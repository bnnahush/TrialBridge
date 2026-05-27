import React, { useState, useEffect } from "react";
import { 
  Users, Check, X, AlertCircle, RefreshCw, Sparkles, Brain, Table, 
  HelpCircle, ChevronRight, Tag, Bookmark, CheckCircle2, ShieldAlert,
  Info, ArrowUpDown, Server, Sliders, Eye
} from "lucide-react";
import { fhirClient } from "../fhirClient";
import { FHIRBundle, ClinicalTrial, PatientSummary, TrialCriteria, FHIRResource } from "../types";
import { useApp } from "../context/AppContext";

// Shared interface representing a computed match for a patient
interface PatientMatchResult {
  patient: PatientSummary & {
    conditionsList: { code: string; display: string }[];
  };
  genderChecked: boolean;
  genderPassed: boolean;
  ageChecked: boolean;
  agePassed: boolean;
  conditionChecked: boolean;
  conditionPassed: boolean;
  overallScore: number; // 0 - 100 based on standard rule weightings
  
  // AI-Assessed Details (if loaded)
  aiResult?: {
    score: number;
    eligible: boolean;
    justification: string;
    matchedCriteria: string[];
    unmatchedCriteria: string[];
  };
  isAiLoading?: boolean;
  aiError?: string;
}

interface SavedCohort {
  id: string;
  name: string;
  gender?: string;
  age?: string;
  condition?: string;
  medication?: string;
  vital?: string;
  createdAt: string;
}

export const CohortMatcher: React.FC = () => {
  const { setSuccess, setError, addToast } = useApp();
  
  // Core Data States
  const [trials, setTrials] = useState<ClinicalTrial[]>([]);
  const [savedCohorts, setSavedCohorts] = useState<SavedCohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>("preset-diabetes");
  const [selectedTrialId, setSelectedTrialId] = useState<string>("");
  
  // FHIR Patients and clinical attachments loading states
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [allConditions, setAllConditions] = useState<FHIRResource[]>([]);
  const [loadingDb, setLoadingDb] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Execution Match Results
  const [matchResults, setMatchResults] = useState<PatientMatchResult[]>([]);
  const [isCrossChecking, setIsCrossChecking] = useState<boolean>(false);
  const [sortField, setSortField] = useState<"name" | "score" | "age">("score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Selection Detail Modal State
  const [selectedMatchDetail, setSelectedMatchDetail] = useState<PatientMatchResult | null>(null);

  // Preset default clinical cohorts to ensure it runs out of the box
  const PRESET_COHORTS: SavedCohort[] = [
    {
      id: "preset-diabetes",
      name: "Diabetes Care Cohort (Preset)",
      gender: "all",
      age: "18-55",
      condition: "44054006", // Type 2 Diabetes
      createdAt: new Date().toISOString(),
    },
    {
      id: "preset-hypertension",
      name: "Hypertension Stage 2 Study (Preset)",
      gender: "all",
      age: "30-75",
      condition: "38341003", // Hypertension
      createdAt: new Date().toISOString(),
    },
    {
      id: "preset-asthma",
      name: "Asthma Bronchial Study (Preset)",
      gender: "female",
      age: "18-65",
      condition: "195967001", // Asthma
      createdAt: new Date().toISOString(),
    },
    {
      id: "preset-all",
      name: "All Safe EHR Patients Directory (Preset)",
      gender: "all",
      age: "0-120",
      createdAt: new Date().toISOString(),
    }
  ];

  // Load registered trials and saved cohorts on mount
  useEffect(() => {
    const initData = async () => {
      setLoadingDb(true);
      try {
        // 1. Fetch Trials
        const trialBundle: FHIRBundle = await fhirClient.getResearchStudies(30);
        const parsedTrials: ClinicalTrial[] = [];
        if (trialBundle && trialBundle.entry) {
          trialBundle.entry.forEach((entry) => {
            if (!entry.resource || entry.resource.resourceType !== "ResearchStudy") return;
            const r = entry.resource;
            
            // Extract code and displays
            const code = r.keyword?.[0]?.coding?.[0]?.code || "";
            const lbl = r.keyword?.[0]?.coding?.[0]?.display || r.keyword?.[0]?.text || "Diagnostic Study";
            const criteria: TrialCriteria[] = [];
            if (code) {
              criteria.push({
                id: "c-cond",
                field: "condition",
                operator: "equals",
                value: code,
                displayValue: lbl
              });
            }

            // Extract phase
            const rawPhase = r.category?.[0]?.coding?.[0]?.display || r.category?.[0]?.text || "Phase 3 Study";

            parsedTrials.push({
              id: r.id || "unknown",
              title: r.title || "Untitled Trial",
              status: (r.status || "active") as any,
              phase: rawPhase,
              sponsor: r.sponsor?.display || "Contract Research Sponsor",
              description: r.description || "No full description compiled in FHIR schema.",
              criteria
            });
          });
        }
        setTrials(parsedTrials);
        if (parsedTrials.length > 0) {
          // Select first trial as default
          setSelectedTrialId(parsedTrials[0].id);
        }

        // 2. Fetch saved cohorts from local storage
        try {
          const stored = localStorage.getItem("fhir-saved-cohorts");
          const custom = stored ? JSON.parse(stored) : [];
          setSavedCohorts(custom);
        } catch (e) {
          console.error("Local cohort parse err:", e);
        }

        // 3. Assemble active patient databases
        await downloadClinicalDatabases();
      } catch (err: any) {
        console.error("Db error:", err);
        setDbError(err.message || "Failed to initialize clinical trial matcher data.");
      } finally {
        setLoadingDb(false);
      }
    };

    initData();
  }, []);

  // Download all patients + conditions to build clinical dossiers
  const downloadClinicalDatabases = async () => {
    try {
      setDbError(null);
      // Fetch Patients
      const ptBundle: FHIRBundle = await fhirClient.request("Patient?_count=100");
      const ptList: PatientSummary[] = [];
      if (ptBundle && ptBundle.entry) {
        ptBundle.entry.forEach((entry) => {
          if (!entry.resource || entry.resource.resourceType !== "Patient") return;
          const r = entry.resource;
          
          let given = "";
          let family = "";
          if (r.name && r.name.length > 0) {
            const n = r.name[0];
            given = n.given?.join(" ") || "";
            family = n.family || "";
          }
          const fullName = `${given} ${family}`.trim() || `Patient ID: ${r.id}`;

          const calculateAge = (bStr: string) => {
            if (!bStr) return 0;
            const b = new Date(bStr);
            const today = new Date();
            let age = today.getFullYear() - b.getFullYear();
            const md = today.getMonth() - b.getMonth();
            if (md < 0 || (md === 0 && today.getDate() < b.getDate())) age--;
            return age;
          };

          ptList.push({
            id: r.id || "unknown",
            name: fullName,
            gender: r.gender || "unknown",
            birthDate: r.birthDate || "",
            age: r.birthDate ? calculateAge(r.birthDate) : 0,
            conditions: [],
            active: r.active !== false
          });
        });
      }
      setPatients(ptList);

      // Fetch all Conditions
      const condBundle: FHIRBundle = await fhirClient.request("Condition?_count=200");
      const condList: FHIRResource[] = [];
      if (condBundle && condBundle.entry) {
        condBundle.entry.forEach((entry) => {
          if (entry.resource && entry.resource.resourceType === "Condition") {
            condList.push(entry.resource);
          }
        });
      }
      setAllConditions(condList);

    } catch (e: any) {
      console.error("Dossier compilation failed:", e);
      throw new Error(`HL7 FHIR server lookup failed: ${e.message}`);
    }
  };

  // Find selected cohort object
  const getSelectedCohortObj = (): SavedCohort | undefined => {
    const all = [...PRESET_COHORTS, ...savedCohorts];
    return all.find((c) => c.id === selectedCohortId);
  };

  const getSelectedTrialObj = (): ClinicalTrial | undefined => {
    return trials.find((t) => t.id === selectedTrialId);
  };

  // Run the cross check: executes logical structural rule checks
  const runCrossCheckFeasibility = () => {
    const cohort = getSelectedCohortObj();
    const trial = getSelectedTrialObj();

    if (!cohort || !trial) {
      setError?.("Please ensure both a clinical cohort and a trial template are fully selected.");
      return;
    }

    setIsCrossChecking(true);
    setSuccess?.(`Cross-referencing cohort "${cohort.name}" eligibility against "${trial.title}"`);

    // Format target parameters from Cohort Filters
    let minAgeLimit = 0;
    let maxAgeLimit = 120;
    if (cohort.age) {
      const parts = cohort.age.split("-");
      if (parts.length === 2) {
        minAgeLimit = parseInt(parts[0], 10) || 0;
        maxAgeLimit = parseInt(parts[1], 10) || 120;
      } else if (cohort.age.startsWith(">")) {
        minAgeLimit = parseInt(cohort.age.replace(">", ""), 10) || 0;
      } else if (cohort.age.startsWith("<")) {
        maxAgeLimit = parseInt(cohort.age.replace("<", ""), 10) || 120;
      }
    }

    // Filter cohort patients
    const cohortPatients = patients.filter((pt) => {
      // 1. Gender filtering
      if (cohort.gender && cohort.gender.toLowerCase() !== "all" && cohort.gender.toLowerCase() !== "any") {
        if (pt.gender.toLowerCase() !== cohort.gender.toLowerCase()) return false;
      }
      // 2. Age filtering
      if (pt.age < minAgeLimit || pt.age > maxAgeLimit) return false;

      // 3. Condition filtering (if required by cohort definition)
      if (cohort.condition) {
        // Does this patient have this condition?
        const patientConditions = allConditions.filter((cond) => {
          const ptIdRef = cond.subject?.reference || cond.patient?.reference || "";
          const pId = ptIdRef.replace("Patient/", "").trim();
          if (pId !== pt.id) return false;

          let condCode = cond.code?.coding?.[0]?.code || "";
          let condText = (cond.code?.text || cond.code?.coding?.[0]?.display || "").toLowerCase();
          
          return condCode === cohort.condition || condText.includes(cohort.condition.toLowerCase());
        });
        if (patientConditions.length === 0) return false;
      }

      return true;
    });

    // Match each of these patients against the SELECTED TRIAL'S CRITERIA
    // Target trial clinical conditions to match against
    const trialKeywords = trial.criteria.filter((c) => c.field === "condition").map((c) => c.value);

    const checkMatchesList: PatientMatchResult[] = cohortPatients.map((pt) => {
      // Attach actual conditions list to patient summary
      const ptConds = allConditions
        .filter((cond) => {
          const ptIdRef = cond.subject?.reference || cond.patient?.reference || "";
          const pId = ptIdRef.replace("Patient/", "").trim();
          return pId === pt.id;
        })
        .map((cond) => ({
          code: cond.code?.coding?.[0]?.code || "n/a",
          display: cond.code?.text || cond.code?.coding?.[0]?.display || "Unspecified Diagnosis"
        }));

      // Let's perform instant structural verification:
      // A. Gender constraint check:
      // Look at trial categories or description if general
      const gPref = trial.description.toLowerCase().includes("female only") ? "female" : 
                    trial.description.toLowerCase().includes("male only") ? "male" : "all";
      
      const genderPassed = gPref === "all" || pt.gender.toLowerCase() === gPref;
      const genderChecked = true;

      // B. Age constraint check
      // Try to parse age limits from description
      let tMinAge = 18;
      let tMaxAge = 65;
      
      const ageMatches = trial.description.match(/(minimum|min|aged?)\s+(\d+)/i);
      if (ageMatches && ageMatches[2]) {
        tMinAge = parseInt(ageMatches[2], 10);
      }
      const ageMaxMatches = trial.description.match(/(maximum|max|under)\s+(\d+)/i);
      if (ageMaxMatches && ageMaxMatches[2]) {
        tMaxAge = parseInt(ageMaxMatches[2], 10);
      }

      const agePassed = pt.age >= tMinAge && pt.age <= tMaxAge;
      const ageChecked = true;

      // C. Condition check:
      // Does patient have the target disease specified as trial keyword?
      let conditionPassed = false;
      let conditionChecked = trialKeywords.length > 0;
      if (conditionChecked) {
        conditionPassed = ptConds.some((c) => {
          return trialKeywords.includes(c.code) || 
            trialKeywords.some(tk => c.display.toLowerCase().includes(tk.toLowerCase()));
        });
      }

      // Compute overall score based on structurally checked attributes
      let score = 50; // base score if age/gender passed
      if (genderPassed && agePassed) {
        score = 80;
        if (conditionChecked) {
          score = conditionPassed ? 95 : 40;
        }
      } else {
        score = 25; // failed core demographics
      }

      return {
        patient: { ...pt, conditionsList: ptConds },
        genderChecked,
        genderPassed,
        ageChecked,
        agePassed,
        conditionChecked,
        conditionPassed,
        overallScore: score
      };
    });

    setMatchResults(checkMatchesList);
    addToast(`Evaluated ${checkMatchesList.length} criteria logs. Rendered Match Table.`, "info");
    setIsCrossChecking(false);
  };

  // Perform Gemini AI-powered deep evaluation of a single patient
  const runAiDeepVerification = async (matchIndex: number) => {
    const item = matchResults[matchIndex];
    if (!item) return;

    // Set loading
    const updated = [...matchResults];
    updated[matchIndex].isAiLoading = true;
    updated[matchIndex].aiError = undefined;
    setMatchResults(updated);

    const trial = getSelectedTrialObj();
    if (!trial) return;

    try {
      const formattedPatient = {
        name: item.patient.name,
        age: item.patient.age,
        gender: item.patient.gender,
        activeConditions: item.patient.conditionsList.map(c => c.display),
      };

      const res = await fetch("/api/gemini/analyze-trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: formattedPatient,
          trials: [{
            nctId: trial.id,
            title: trial.title,
            phase: trial.phase,
            sponsor: trial.sponsor,
            summary: trial.description,
            eligibilityCriteria: trial.description,
          }]
        })
      });

      if (!res.ok) {
        throw new Error(`AI Gateway responded with HTTP error status ${res.status}`);
      }

      const resultsJson = await res.json();
      
      // Look for analyses content
      const analysis = resultsJson.analyses?.[0];
      if (analysis) {
        const fresh = [...matchResults];
        fresh[matchIndex].isAiLoading = false;
        fresh[matchIndex].aiResult = {
          score: analysis.score,
          eligible: analysis.eligible,
          justification: analysis.justification,
          matchedCriteria: analysis.matchedCriteria || [],
          unmatchedCriteria: analysis.unmatchedCriteria || []
        };
        // sync scores with AI
        fresh[matchIndex].overallScore = analysis.score;
        setMatchResults(fresh);
        addToast(`Gemini Deep Match calculated for ${item.patient.name}!`, "value");
      } else {
        throw new Error("Dossier parsing payload is incomplete");
      }
    } catch (err: any) {
      console.error("AI verify failed:", err);
      const fresh = [...matchResults];
      fresh[matchIndex].isAiLoading = false;
      fresh[matchIndex].aiError = err.message || "Failed to contact Gemini Secure Platform.";
      setMatchResults(fresh);
    }
  };

  // Quick run deep verify for the whole cohort list simultaneously
  const verifyAllWithGemini = async () => {
    if (matchResults.length === 0) return;
    addToast(`Triggering background Gemini models for ${matchResults.length} patients...`, "info");
    
    // Process clinical files in parallel streams
    const promises = matchResults.map((_, idx) => runAiDeepVerification(idx));
    await Promise.all(promises);
    setSuccess?.("Gemini cross-check audit complete across the whole cohort!");
  };

  // Client side sorting
  const handleSort = (field: "name" | "score" | "age") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getProgressLabelAndBadge = (score: number) => {
    if (score >= 80) {
      return { label: "Strong Fit", badge: "bg-emerald-50 text-emerald-800 border-emerald-150" };
    } else if (score >= 50) {
      return { label: "Possible Fit", badge: "bg-amber-50 text-amber-800 border-amber-150" };
    }
    return { label: "Excluded", badge: "bg-rose-50 text-rose-800 border-rose-150" };
  };

  const sortedMatchResults = [...matchResults].sort((a, b) => {
    let factor = sortDirection === "asc" ? 1 : -1;
    if (sortField === "name") {
      return a.patient.name.localeCompare(b.patient.name) * factor;
    }
    if (sortField === "age") {
      return (a.patient.age - b.patient.age) * factor;
    }
    // Default score sorting
    return (a.overallScore - b.overallScore) * factor;
  });

  return (
    <div id="cohort-trial-cross-checker" className="space-y-6">
      
      {/* 2-Section top panel: Config & parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LHS Selector Card */}
        <div className="lg:col-span-12 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-105">
            <Sliders className="w-5 h-5 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase">Cross-Check Setup Parameters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-11 gap-4 text-xs">
            
            {/* Cohort selection */}
            <div className="space-y-1.5 lg:col-span-4">
              <label className="text-slate-500 font-bold uppercase text-[9px] tracking-wider block">Import Clinical Cohort</label>
              <select
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg font-medium cursor-pointer"
              >
                <optgroup label="System Preset Cohorts">
                  {PRESET_COHORTS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
                {savedCohorts.length > 0 && (
                  <optgroup label="Your Custom Saved Cohorts">
                    {savedCohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Saved)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Target Trial Selection */}
            <div className="space-y-1.5 lg:col-span-5">
              <label className="text-slate-500 font-bold uppercase text-[9px] tracking-wider block">Evaluate Against Protocol / Trial</label>
              <select
                value={selectedTrialId}
                onChange={(e) => setSelectedTrialId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg font-medium cursor-pointer"
              >
                {trials.length === 0 ? (
                  <option value="">No Active Registered Protocols available</option>
                ) : (
                  trials.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.phase}] {t.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Run button */}
            <div className="flex items-end lg:col-span-2 pt-2 md:pt-0">
              <button
                type="button"
                onClick={runCrossCheckFeasibility}
                disabled={trials.length === 0 || loadingDb}
                className="w-full py-2.5 bg-[#0F2B5B] hover:bg-[#153466] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                {loadingDb ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Load Ledger...
                  </>
                ) : (
                  <>
                    <Table className="w-4 h-4" /> Run Cross-Check
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Detailed filters readout of selected cohort */}
          {getSelectedCohortObj() && (
            <div className="bg-slate-50/50 border border-slate-150 p-3 rounded-lg flex flex-wrap gap-4 items-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider flex items-center gap-1">
                <Bookmark className="w-3.5 h-3.5 text-cyan-600" /> Loaded Cohort Filter Constraints:
              </span>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600">
                  Sex: {getSelectedCohortObj()?.gender || "All"}
                </span>
                <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600">
                  Age Range: {getSelectedCohortObj()?.age || "0-120"}
                </span>
                {getSelectedCohortObj()?.condition && (
                  <span className="px-2 py-0.5 bg-cyan-50 text-cyan-800 border border-cyan-155 rounded">
                    Disease (SNOMED): {getSelectedCohortObj()?.condition}
                  </span>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Main Table output representation */}
      {matchResults.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-2xl bg-white p-12 text-center space-y-4">
          <Users className="w-12 h-12 text-slate-300 mx-auto stroke-[1.25]" />
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest font-sans">Matching Ledger Empty</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Select or import your clinical cohort on the top panel, and click "Run Cross-Check" to parse, filter, and audit study criteria.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          
          {/* Action Header panel inside results */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-teal-50/50 rounded-xl border border-teal-150/80 text-teal-900 text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-teal-600 shrink-0 animate-pulse" />
              <div>
                <p className="font-bold">Structural Check Complete — {matchResults.length} cohort patients mapped!</p>
                <p className="text-slate-500 font-medium">To check unstructured parameters (vitals logs, exclusion phrases), trigger secure Gemini analysis below.</p>
              </div>
            </div>
            <button
              onClick={verifyAllWithGemini}
              className="px-3.5 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Brain className="w-4 h-4 text-amber-300 fill-amber-300 animate-pulse" />
              Verify Cohort with Gemini AI
            </button>
          </div>

          {/* Primary Patients Grid Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                    <th 
                      onClick={() => handleSort("name")}
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>Patient name</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("age")}
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>Age / Sex</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                      </div>
                    </th>
                    <th className="px-6 py-4">Active Conditions</th>
                    <th className="px-6 py-4 col-span-2 text-center">Structural Check</th>
                    <th 
                      onClick={() => handleSort("score")}
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition w-32"
                    >
                      <div className="flex items-center gap-1 justify-end">
                        <span>Comp. Score</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right pr-6 w-36">Deep Verify</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {sortedMatchResults.map((item, idx) => {
                    const originalIndex = matchResults.findIndex(original => original.patient.id === item.patient.id);
                    const fitDetails = getProgressLabelAndBadge(item.overallScore);
                    const isAiLoading = item.isAiLoading;
                    const hasAi = !!item.aiResult;

                    return (
                      <tr key={item.patient.id} className="hover:bg-slate-50/50 transition-colors">
                        
                        {/* Name Column */}
                        <td className="px-6 py-4">
                          <div>
                            <span 
                              onClick={() => setSelectedMatchDetail(item)}
                              className="font-bold text-[#0F2B5B] hover:text-teal-600 block transition cursor-pointer"
                            >
                              {item.patient.name}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono select-all">
                              Patient ID: {item.patient.id}
                            </span>
                          </div>
                        </td>

                        {/* Age / Sex */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700">{item.patient.age}y/o</span>
                            <span className="text-slate-300">•</span>
                            <span className="uppercase text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-150 p-0.5 px-1.5 rounded">
                              {item.patient.gender}
                            </span>
                          </div>
                        </td>

                        {/* Active conditions checklist */}
                        <td className="px-6 py-4">
                          <div className="max-w-xs space-y-1">
                            {item.patient.conditionsList.length === 0 ? (
                              <span className="text-slate-400 italic">No diagnostic codes parsed.</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-h-[48px] overflow-hidden truncate">
                                {item.patient.conditionsList.slice(0, 2).map((c, i) => (
                                  <span key={i} className="text-[9px] px-1.5 py-0.5 bg-slate-50 border border-slate-150 text-slate-600 font-medium rounded truncate max-w-[140px]" title={c.display}>
                                    {c.display}
                                  </span>
                                ))}
                                {item.patient.conditionsList.length > 2 && (
                                  <span className="text-[9px] px-1 text-slate-400 font-bold">+{item.patient.conditionsList.length - 2} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Structural Rules Icons */}
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-3 bg-slate-50 border border-slate-200/80 p-1.5 px-3 rounded-lg text-[10px] select-none font-semibold">
                            <span className="flex items-center gap-1">
                              Sex: {item.genderPassed ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                            </span>
                            <span className="text-slate-205">|</span>
                            <span className="flex items-center gap-1">
                              Age: {item.agePassed ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                            </span>
                            <span className="text-slate-205">|</span>
                            <span className="flex items-center gap-1">
                              Diagnosis: {!item.conditionChecked ? <Info className="w-3 h-3 text-slate-400" /> : item.conditionPassed ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                            </span>
                          </div>
                        </td>

                        {/* Compatibility Score */}
                        <td className="px-6 py-4 text-right">
                          <div className="space-y-1">
                            <div className="font-mono text-sm font-black text-[#0F2B5B]">
                              {item.overallScore}%
                            </div>
                            <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black tracking-wider uppercase border rounded ${fitDetails.badge}`}>
                              {fitDetails.label}
                            </span>
                          </div>
                        </td>

                        {/* One-click Verify with Gemini action button */}
                        <td className="px-6 py-4 text-right pr-6">
                          {isAiLoading ? (
                            <div className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-150 text-amber-800 text-[10px] font-bold rounded animate-pulse select-none">
                              <RefreshCw className="w-3 h-3 animate-spin text-amber-600" /> Analyzing...
                            </div>
                          ) : hasAi ? (
                            <button
                              onClick={() => setSelectedMatchDetail(item)}
                              className="px-2.5 py-1.5 border border-teal-200 bg-teal-50/50 hover:bg-teal-100/50 hover:border-teal-350 text-teal-805 text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 justify-end ml-auto"
                            >
                              <Brain className="w-3.5 h-3.5 text-teal-600" /> Reviewed
                            </button>
                          ) : (
                            <button
                              onClick={() => runAiDeepVerification(originalIndex)}
                              className="px-2.5 py-1.5 bg-slate-50 border border-slate-250 hover:border-emerald-500 hover:text-emerald-800 text-slate-655 text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 justify-end ml-auto group"
                            >
                              <Sparkles className="w-3 h-3 group-hover:text-emerald-500" /> AI Verify
                            </button>
                          )}
                          {item.aiError && (
                            <span className="text-[9px] text-rose-600 block mt-1 font-semibold">Gemini Timeout</span>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 4. Details / Reasoning Modal Slideover */}
      {selectedMatchDetail && (
        <div className="fixed inset-0 z-50 flex overflow-hidden animate-fade-in select-text">
          <div 
            onClick={() => setSelectedMatchDetail(null)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs cursor-pointer"
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between overflow-y-auto animate-slide-in relative p-6 space-y-6">
            
            <div className="space-y-4">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[9px] font-extrabold text-[#0EA5A0] uppercase tracking-widest font-mono">
                    Match Eligibility Dossier
                  </span>
                  <h3 className="text-base font-extrabold text-[#0F2B5B]">
                    {selectedMatchDetail.patient.name}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedMatchDetail(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

              {/* Patient mini specs card */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-150 p-4 rounded-xl text-xs font-medium text-slate-600">
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-400 block tracking-wider">Age profile</span>
                  <span className="font-extrabold text-slate-800">{selectedMatchDetail.patient.age} years old</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-400 block tracking-wider">Gender assigned</span>
                  <span className="font-extrabold text-slate-800 capitalize">{selectedMatchDetail.patient.gender}</span>
                </div>
              </div>

              {/* Conditions List */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Active Conditions Registry</span>
                <div className="p-3.5 bg-white border border-slate-150 rounded-xl space-y-2 max-h-[140px] overflow-y-auto">
                  {selectedMatchDetail.patient.conditionsList.length === 0 ? (
                    <div className="text-center font-semibold text-slate-400 text-xs py-2">No active conditions.</div>
                  ) : (
                    selectedMatchDetail.patient.conditionsList.map((c, i) => (
                      <div key={i} className="flex justify-between text-xs p-1 px-2 bg-slate-50/60 border border-slate-100 rounded leading-snug">
                        <span className="font-bold text-slate-700">{c.display}</span>
                        <span className="font-mono text-[9px] text-slate-400">{c.code}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* AI evaluation section */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 text-xs uppercase select-none">
                  <Brain className="w-4 h-4 text-indigo-500" />
                  <span>Clinical Gemini AI Assessment</span>
                </div>

                {selectedMatchDetail.aiResult ? (
                  <div className="space-y-3.5 text-xs text-slate-700">
                    
                    <div className="flex items-center justify-between bg-violet-50/50 border border-violet-150 p-3 rounded-lg leading-relaxed">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-violet-750 block tracking-wider">AI Score</span>
                        <span className="text-sm font-black text-violet-900 font-mono">{selectedMatchDetail.aiResult.score}% Compatibility</span>
                      </div>
                      <span className={`px-2.5 py-0.5 text-[9px] font-black rounded uppercase ${selectedMatchDetail.aiResult.eligible ? "bg-emerald-100 text-emerald-800 border-emerald-250" : "bg-rose-100 text-rose-800 border-rose-250"}`}>
                        {selectedMatchDetail.aiResult.eligible ? "Pragmatically Eligible" : "Excluded"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold uppercase text-slate-400 block tracking-wider">Clinical Justification</span>
                      <p className="p-3 bg-slate-50 border border-slate-150/85 rounded-xl font-medium leading-relaxed italic text-slate-650 select-text">
                        "{selectedMatchDetail.aiResult.justification}"
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-emerald-700 block tracking-wider mb-1 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Met Inclusion
                        </span>
                        <div className="space-y-1">
                          {selectedMatchDetail.aiResult.matchedCriteria.slice(0, 3).map((item, idx) => (
                            <span key={idx} className="block text-[11px] p-1 border border-slate-100 rounded bg-emerald-50/30 text-slate-600 truncate font-semibold" title={item}>
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase text-rose-700 block tracking-wider mb-1 flex items-center gap-1">
                          <X className="w-3.5 h-3.5" /> Excluded / Unknown
                        </span>
                        <div className="space-y-1">
                          {selectedMatchDetail.aiResult.unmatchedCriteria.slice(0, 3).map((item, idx) => (
                            <span key={idx} className="block text-[11px] p-1 border border-slate-100 rounded bg-rose-50/30 text-slate-600 truncate font-semibold" title={item}>
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="p-5 text-center bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col items-center justify-center space-y-2 select-none">
                    <HelpCircle className="w-8 h-8 text-slate-350 stroke-[1.25]" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Verify details pending digital checkout</span>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-normal">
                      Deep verify connects the patient's entire unstructured diagnostic profile to the study guidelines using Gemini.
                    </p>
                    <button
                      onClick={() => {
                        const originalPos = matchResults.findIndex(r => r.patient.id === selectedMatchDetail.patient.id);
                        if (originalPos !== -1) runAiDeepVerification(originalPos);
                      }}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-teal-800 to-indigo-900 text-white rounded-lg text-xs font-bold shadow transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 fill-amber-300 text-amber-300" /> Start AI Audit Now
                    </button>
                  </div>
                )}
              </div>

            </div>

            <div className="pt-4 border-t border-slate-100 text-right">
              <button 
                onClick={() => setSelectedMatchDetail(null)}
                className="px-4 py-2 border border-slate-205 hover:bg-slate-50 text-xs font-bold rounded-xl text-slate-600 transition cursor-pointer"
              >
                Close Dossier
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, ShieldCheck, 
  MapPin, Building, Sparkles, AlertCircle, HelpCircle, 
  ChevronDown, ChevronUp, User, Tag, FileText, Brain, Heart, ChevronRight,
  ShieldAlert, Info, Pill, Trash, Check, X, Sliders
} from "lucide-react";
import { fhirClient } from "../fhirClient";
import { useApp } from "../context/AppContext";

interface CtGovTrial {
  nctId: string;
  title: string;
  status: string;
  phase: string;
  sponsor: string;
  summary: string;
  eligibilityCriteria: string;
  location: string;
  minimumAge?: string;
  maximumAge?: string;
  sex?: string;
}

interface OpenAIAnalysisResult {
  nctId: string;
  score: number;
  reasoning: string;
  inclusions: string[];
  exclusions: string[];
}

export const PatientTrialsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { setIsLoading, setError, setSuccess } = useApp();

  const [patient, setPatient] = useState<any>(null);
  const [activeConditions, setActiveConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [trials, setTrials] = useState<CtGovTrial[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Expanded states for trial brief summaries
  const [expandedSummary, setExpandedSummary] = useState<Record<string, boolean>>({});

  // Custom OpenAI Match results state
  const [matchResults, setMatchResults] = useState<Record<string, OpenAIAnalysisResult>>({});
  
  // Progress states for chunk streaming
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  const [totalBulkCount, setTotalBulkCount] = useState(0);
  const [completedBulkCount, setCompletedBulkCount] = useState(0);

  // Single trial matching spinner tracker
  const [analyzingTrialId, setAnalyzingTrialId] = useState<string | null>(null);

  // Slide-over detail panel state
  const [selectedTrialForDetail, setSelectedTrialForDetail] = useState<CtGovTrial | null>(null);

  const calculateAge = (birthDateStr: string): number => {
    if (!birthDateStr) return 0;
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const loadPatientAndTrials = async () => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);
    setMatchResults({});
    
    try {
      // 1. Fetch Patient
      const p = await fhirClient.getPatient(id);
      setPatient(p);

      // 2. Fetch Conditions (using multiple fallback paths to be safe)
      let conditionNames: string[] = [];
      try {
        let conditionBundle;
        try {
          conditionBundle = await fhirClient.request(`Condition?patient=Patient/${id}&clinical-status=active`);
        } catch {
          try {
            conditionBundle = await fhirClient.request(`Condition?patient=${id}&clinical-status=active`);
          } catch {
            conditionBundle = await fhirClient.request(`Condition?patient=Patient/${id}`);
          }
        }
        const rawConditions = conditionBundle?.entry?.map((e: any) => e.resource) || [];
        const displayNames = rawConditions
          .map((c: any) => c.code?.coding?.[0]?.display || c.code?.text || "")
          .filter(Boolean);
        conditionNames = Array.from(new Set(displayNames));
        setActiveConditions(conditionNames);
      } catch (err) {
        console.error("Failed to load conditions:", err);
      }

      // 3. Fetch Medications
      let medNames: string[] = [];
      try {
        const response = await fhirClient.request(`MedicationRequest?patient=${id}&status=active&_count=100`);
        const list = response.entry?.map((e: any) => e.resource).filter((r: any) => r && r.resourceType === "MedicationRequest") || [];
        medNames = list.map((m: any) => {
          if (m.medicationCodeableConcept) {
            return m.medicationCodeableConcept.coding?.[0]?.display || m.medicationCodeableConcept.text || "";
          } else if (m.medicationReference) {
            return m.medicationReference.display || "";
          }
          return "";
        }).filter(Boolean);
        setMedications(Array.from(new Set(medNames)));
      } catch (err) {
        console.error("Failed to load medications:", err);
      }

      // 4. Fetch Allergies
      let allergyNames: string[] = [];
      try {
        const response = await fhirClient.request(`AllergyIntolerance?patient=${id}&_count=100`);
        const list = response.entry?.map((e: any) => e.resource).filter((r: any) => r && r.resourceType === "AllergyIntolerance") || [];
        allergyNames = list.map((a: any) => {
          return a.substance?.coding?.[0]?.display || a.substance?.text || a.code?.coding?.[0]?.display || a.code?.text || "";
        }).filter(Boolean);
        setAllergies(Array.from(new Set(allergyNames)));
      } catch (err) {
        console.error("Failed to load allergies:", err);
      }

      // 5. Query studies on ClinicalTrials.gov using conditions as query params
      const condQuery = conditionNames.length > 0 
        ? conditionNames.slice(0, 3).join(" OR ") 
        : "diabetes OR hypertension"; // robust fallback so studies are always found

      const ctGovUrl = `https://clinicaltrials.gov/api/v2/studies?format=json&pageSize=20&query.cond=${encodeURIComponent(condQuery)}&filter.overallStatus=RECRUITING`;
      
      const ctRes = await fetch(ctGovUrl);
      if (!ctRes.ok) {
        throw new Error(`ClinicalTrials.gov registry lookup failed with HTTP status ${ctRes.status}`);
      }
      
      const ctData = await ctRes.json();
      const parsedStudies: CtGovTrial[] = (ctData.studies || []).map((s: any) => {
        const ps = s.protocolSection;
        const nctId = ps?.identificationModule?.nctId || "NCT" + Math.random().toString(10).substring(2, 10);
        const title = ps?.identificationModule?.briefTitle || "Investigation of Target Condition Strategy";
        const status = ps?.statusModule?.overallStatus || "RECRUITING";
        
        const rawPhase = ps?.designModule?.phases?.[0];
        const phase = rawPhase 
          ? rawPhase.replace(/PHASE/i, "Phase ").replace(/_/g, " ")
          : "Phase N/A";

        const sponsor = ps?.sponsorCollaboratorsModule?.leadSponsor?.name || "Independent Clinical Investigators";
        const summary = ps?.descriptionModule?.briefSummary || "No brief summary profile description provided.";
        const eligibilityCriteria = ps?.eligibilityModule?.eligibilityCriteria || "No explicit criteria records listed.";

        const firstLocObj = ps?.contactsLocationsModule?.locations?.[0];
        const location = firstLocObj 
          ? `${firstLocObj.city || ""}${firstLocObj.city && firstLocObj.country ? ", " : ""}${firstLocObj.country || ""}`
          : "Multi-center trial sites";

        const minimumAge = ps?.eligibilityModule?.minimumAge || "N/A";
        const maximumAge = ps?.eligibilityModule?.maximumAge || "N/A";
        const sex = ps?.eligibilityModule?.sex || "ALL";

        return {
          nctId,
          title,
          status,
          phase,
          sponsor,
          summary,
          eligibilityCriteria,
          location,
          minimumAge,
          maximumAge,
          sex
        };
      });

      setTrials(parsedStudies);
    } catch (err: any) {
      console.error("[ClinicalTrials Parsing Exception]:", err);
      setFetchError(err.message || "Failed to establish real-time connection with ClinicalTrials.gov registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatientAndTrials();
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedTrialForDetail(null);
      }
    };
    if (selectedTrialForDetail) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedTrialForDetail]);

  const toggleSummary = (nctId: string) => {
    setExpandedSummary(prev => ({ ...prev, [nctId]: !prev[nctId] }));
  };

  const getPatientSummaryObject = () => {
    const pGiven = patient?.name?.[0]?.given?.join(" ") || "";
    const pFamily = patient?.name?.[0]?.family || "";
    const fullname = `${pGiven} ${pFamily}`.trim() || `Patient #${patient?.id || "Unknown"}`;
    
    return {
      name: fullname,
      age: patient?.birthDate ? calculateAge(patient.birthDate) : "N/A",
      gender: patient?.gender || "unknown",
      conditions: activeConditions.length > 0 ? activeConditions : ["None recorded"],
      medications: medications.length > 0 ? medications : ["None recorded"],
      allergies: allergies.length > 0 ? allergies : ["None recorded"]
    };
  };

  const handleAnalyzeSingleTrial = async (trial: CtGovTrial) => {
    if (!patient) return;
    setAnalyzingTrialId(trial.nctId);
    setError(null);

    const formattedPatient = getPatientSummaryObject();
    try {
      const response = await fetch("/api/match-trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: formattedPatient,
          trials: [{
            nctId: trial.nctId,
            title: trial.title,
            eligibilityCriteria: trial.eligibilityCriteria,
            minAge: trial.minimumAge,
            maxAge: trial.maximumAge,
            sex: trial.sex
          }]
        })
      });

      if (!response.ok) {
        const errDetails = await response.json().catch(() => ({}));
        throw new Error(errDetails.error || "System failed to compute score details.");
      }

      // Read response line-by-line formatted as NDJSON
      if (!response.body) throw new Error("Null response stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line);
          if (parsed.status === "success" && parsed.data) {
            const item: OpenAIAnalysisResult = parsed.data;
            setMatchResults(prev => ({ ...prev, [item.nctId]: item }));
            setSuccess(`AI Match score computed for study ${item.nctId}!`);
          } else if (parsed.error) {
            throw new Error(parsed.error);
          }
        }
      }
    } catch (err: any) {
      console.error("[Single clinical evaluation error]:", err);
      setError(err.message || "Failed to fetch trial matching data.");
    } finally {
      setAnalyzingTrialId(null);
    }
  };

  const handleAnalyzeAllTrials = async () => {
    if (!patient || trials.length === 0) return;
    
    setIsBulkAnalyzing(true);
    setTotalBulkCount(trials.length);
    setCompletedBulkCount(0);
    setError(null);

    const formattedPatient = getPatientSummaryObject();
    try {
      const trialsToSend = trials.map(t => ({
        nctId: t.nctId,
        title: t.title,
        eligibilityCriteria: t.eligibilityCriteria,
        minAge: t.minimumAge,
        maxAge: t.maximumAge,
        sex: t.sex
      }));

      const response = await fetch("/api/match-trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: formattedPatient,
          trials: trialsToSend
        })
      });

      if (!response.ok) {
        const errDetails = await response.json().catch(() => ({}));
        throw new Error(errDetails.error || "Global analysis request failed.");
      }

      if (!response.body) throw new Error("Null response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.status === "success" && parsed.data) {
              const item: OpenAIAnalysisResult = parsed.data;
              setMatchResults(prev => ({ ...prev, [item.nctId]: item }));
              setCompletedBulkCount(curr => curr + 1);
            } else {
              setCompletedBulkCount(curr => curr + 1);
            }
          } catch (e) {
            console.error("Error parsing NDJSON stream chunk", e);
          }
        }
      }

      setSuccess("OpenAI evaluation computed across all recruiting protocols successfully!");
    } catch (err: any) {
      console.error("[Global batch evaluation error]:", err);
      setError(err.message || "Failed to complete streaming analysis.");
    } finally {
      setIsBulkAnalyzing(false);
    }
  };

  const getScoreInfo = (score: number) => {
    if (score >= 80) {
      return {
        badgeText: "Strong Match",
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
        strokeColor: "stroke-emerald-500",
        textColor: "text-emerald-700"
      };
    } else if (score >= 50) {
      return {
        badgeText: "Possible Match",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
        strokeColor: "stroke-amber-500",
        textColor: "text-amber-700"
      };
    } else {
      return {
        badgeText: "Low Match",
        badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
        strokeColor: "stroke-rose-500",
        textColor: "text-rose-700"
      };
    }
  };

  const ScoreDonut: React.FC<{ score: number; large?: boolean }> = ({ score, large }) => {
    const size = large ? 80 : 56;
    const radius = large ? 30 : 18;
    const strokeWidth = large ? 5 : 3.5;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    const info = getScoreInfo(score);
    const center = size / 2;

    return (
      <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            className="stroke-slate-100"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            className={`${info.strokeColor} transition-all duration-500 ease-out`}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute text-center flex flex-col items-center justify-center leading-none">
          <span className={`font-black font-mono text-slate-800 ${large ? "text-lg leading-none" : "text-[11px]"}`}>
            {score}%
          </span>
          {large && (
            <span className="text-[7px] text-slate-400 font-extrabold block mt-0.5 uppercase tracking-wider">
              SCORE
            </span>
          )}
        </div>
      </div>
    );
  };

  // Sort trials descending by match score
  const sortedTrials = [...trials].sort((a, b) => {
    const resultA = matchResults[a.nctId];
    const resultB = matchResults[b.nctId];
    const scoreA = resultA ? resultA.score : -1;
    const scoreB = resultB ? resultB.score : -1;
    return scoreB - scoreA;
  });

  if (loading) {
    return (
      <div className="space-y-6 py-8 px-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-100 animate-pulse rounded-lg" />
          <div className="space-y-2 flex-1 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-1/4" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-8 bg-slate-100 rounded w-1/3 animate-pulse" />
            {[1, 2, 3].map(i => (
              <div key={i} className="p-5 border border-slate-100 rounded-2xl bg-white space-y-3">
                <div className="flex gap-2">
                  <div className="h-5 bg-slate-100 rounded w-16" />
                  <div className="h-5 bg-slate-100 rounded w-16" />
                </div>
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-10 bg-slate-50 rounded w-full pt-2" />
              </div>
            ))}
          </div>
          <div className="h-64 bg-slate-50 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const patientName = patient ? `${patient.name?.[0]?.given?.join(" ") || ""} ${patient.name?.[0]?.family || ""}` : "Patient";
  const patientAge = patient?.birthDate ? calculateAge(patient.birthDate) : "N/A";
  const patientGender = patient?.gender || "unknown";

  const remainingBulkCount = totalBulkCount - completedBulkCount;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 relative">
      
      {/* Real-time Loading Overlay for Streaming Progress */}
      {isBulkAnalyzing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in select-none">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full mx-4 text-center space-y-6">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-dashed border-[#0EA5A0] rounded-full animate-spin" />
              <Brain className="w-10 h-10 text-[#0F2B5B] animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-black text-[#0F2B5B]">OpenAI Engine Active</h3>
              <p className="text-sm font-semibold text-slate-500">
                Analyzing {totalBulkCount} trials with AI...
              </p>
              <div className="inline-flex items-center px-4 py-1 bg-teal-50 border border-teal-100 text-teal-700 text-xs font-bold rounded-full gap-1.5 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                {remainingBulkCount > 0 ? `${remainingBulkCount} remaining` : "Wrapping up..."}
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-[#0EA5A0] to-[#0F2B5B] h-2.5 transition-all duration-300"
                  style={{ width: `${(completedBulkCount / totalBulkCount) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 font-mono">
                <span>{completedBulkCount} EVALUATED</span>
                <span>{totalBulkCount} TOTAL</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Header Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <Link 
            to={`/patients/${id}`}
            className="p-1.5 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg text-slate-500 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-[#0EA5A0] uppercase block">
              Clinical Trials Analyzer
            </span>
            <h1 className="text-2xl font-black text-[#0F2B5B] tracking-tight">
              GPT-4o-mini Eligibility Match
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated medical compatibility screen for <strong className="text-[#0F2B5B]">{patientName}</strong> (Age: {patientAge} | {patientGender})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadPatientAndTrials}
            className="flex items-center gap-1.5 p-2 px-3 border border-slate-200 hover:border-slate-355 bg-white hover:bg-slate-50 text-xs font-bold rounded-xl text-slate-700 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Web Registry
          </button>

          {trials.length > 0 && (
            <button
              onClick={handleAnalyzeAllTrials}
              disabled={isBulkAnalyzing}
              className="flex items-center gap-1.5 p-2 px-4 bg-gradient-to-r from-[#0F2B5B] to-[#1D4ED8] hover:from-[#1E3A8A] hover:to-[#2563EB] text-white text-xs font-extrabold rounded-xl shadow-md cursor-pointer transition disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Analyze All Trials
            </button>
          )}
        </div>
      </div>

      {/* Sticky Dual-column Layout */}
      {fetchError ? (
        <div className="p-8 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 text-xs flex items-start gap-4 shadow-xs">
          <AlertCircle className="w-6 h-6 text-rose-500 shrink-0" />
          <div className="flex-1 space-y-1">
            <h3 className="font-extrabold uppercase tracking-widest text-[10px]">Could not load trials from Registry</h3>
            <p className="leading-relaxed font-semibold">{fetchError}</p>
            <button
              onClick={loadPatientAndTrials}
              className="mt-3 p-1.5 px-3 bg-white border border-rose-200 hover:bg-rose-100 rounded-lg text-rose-800 font-bold transition flex items-center gap-1 cursor-pointer font-sans"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry API Search
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Patient Context Card Sticky LHS Column (Stays visible during scroll) */}
          <div className="lg:col-span-4 lg:sticky lg:top-6 lg:self-start space-y-4 print:hidden">
            <div className="bg-white border border-slate-205/90 rounded-3xl p-6 shadow-xs border-slate-200/80 space-y-5">
              
              <div className="space-y-3">
                <Link 
                  to={`/patients/${id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0EA5A0] hover:text-[#0F2B5B] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  ← Back to Patient Profile
                </Link>
                
                <div className="space-y-1">
                  <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase font-mono">
                    Patient Profile Context
                  </span>
                  <h2 className="text-xl font-black text-[#0F2B5B] tracking-tight leading-tight select-text">
                    {patientName}
                  </h2>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <span className="capitalize">{patientGender}</span>
                    <span className="text-slate-300">•</span>
                    <span>Age {patientAge}</span>
                  </div>
                </div>
              </div>

              {/* Conditions Chips (Teal) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Active Conditions ({activeConditions.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeConditions.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No conditions recorded</span>
                  ) : (
                    activeConditions.map((cond, idx) => (
                      <span 
                        key={idx} 
                        className="px-2.5 py-1 bg-teal-50 border border-teal-200/60 text-teal-800 rounded-lg text-[10px] font-bold inline-block"
                      >
                        {cond}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Medications Chips (Navy) */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Active Medications ({medications.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {medications.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No medications recorded</span>
                  ) : (
                    medications.map((med, idx) => (
                      <span 
                        key={idx} 
                        className="px-2.5 py-1 bg-[#0F2B5B]/5 border border-[#0F2B5B]/15 text-[#0F2B5B] rounded-lg text-[10px] font-bold inline-block"
                      >
                        {med}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Allergies Chips (Red) */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Allergies & Intolerances ({allergies.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {allergies.length === 0 ? (
                    <span className="px-2.5 py-1 bg-slate-50 border border-slate-205 text-slate-550 rounded-lg text-[10px] font-bold inline-block select-none font-mono">
                      NKDA
                    </span>
                  ) : (
                    allergies.map((alg, idx) => (
                      <span 
                        key={idx} 
                        className="px-2.5 py-1 bg-rose-50 border border-rose-200/60 text-rose-700 rounded-lg text-[10px] font-bold inline-block"
                      >
                        {alg}
                      </span>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* AI Agent Engine Diagnostics Advice Panel */}
            <div className="p-5 bg-gradient-to-br from-[#0F2B5B]/5 to-[#0EA5A0]/5 border border-slate-200/70 rounded-2xl space-y-2">
              <h4 className="text-[11px] font-extrabold text-[#0F2B5B] uppercase tracking-wide flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-[#0EA5A0]" />
                Automated Match Diagnostic
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                This evaluator screens age exclusions, biological traits, and unstructured inclusion protocols using gpt-4o-mini clinical assessment guidelines dynamically.
              </p>
            </div>
          </div>

          {/* Available Recruiting Protocols Column (Right column) */}
          <div className="lg:col-span-8 space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 print:hidden">
              <h2 className="text-base font-black text-[#0F2B5B] flex items-center gap-1.5">
                <FileText className="w-4.5 h-4.5 text-slate-400" />
                Recruiting Protocols Catalog
                <span className="text-[10px] font-bold bg-[#0F2B5B]/5 text-[#0F2B5B] px-2 py-0.5 rounded-full font-mono">
                  {sortedTrials.length} found
                </span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sortedTrials.map((trial) => {
                const hasAI = !!matchResults[trial.nctId];
                const result = matchResults[trial.nctId];
                const scoreInfo = hasAI ? getScoreInfo(result.score) : null;
                const isExpanded = !!expandedSummary[trial.nctId];

                return (
                  <div 
                    key={trial.nctId}
                    className={`border bg-white rounded-2xl flex flex-col justify-between overflow-hidden transition-all duration-300 ${
                      hasAI 
                        ? result.score >= 80 
                          ? "border-emerald-300 shadow-md ring-2 ring-emerald-500/5 bg-slate-50/5 hover:-translate-y-0.5" 
                          : "border-slate-200 hover:border-slate-350 hover:shadow-md hover:-translate-y-0.5"
                        : "border-slate-200 hover:border-slate-350 hover:shadow-md hover:-translate-y-0.5"
                    }`}
                  >
                    
                    {/* Top segment for clinical identifiers & phases */}
                    <div className="p-5 space-y-3.5">
                      
                      <div className="flex items-center justify-between flex-wrap gap-2 select-none">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 bg-[#0F2B5B] text-white text-[9px] font-black rounded uppercase">
                            {trial.nctId}
                          </span>
                          <span className="px-1.5 py-0.5 bg-[#0EA5A0]/10 text-[#0EA5A0] border border-[#0EA5A0]/20 text-[9px] font-extrabold rounded">
                            {trial.phase}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                          {trial.status}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-sm font-black text-[#0F2B5B] leading-tight select-text">
                          {trial.title}
                        </h3>
                        <div className="pt-1.5 flex flex-col gap-1 text-[10px] text-slate-500 select-text">
                          <span className="flex items-center gap-1">
                            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[200px]" title={trial.sponsor}>
                              Sponsor: <strong className="text-slate-600 font-bold">{trial.sponsor}</strong>
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#0EA5A0] shrink-0" />
                            <span className="truncate max-w-[200px]">{trial.location}</span>
                          </span>
                        </div>
                      </div>

                      {/* Brief description summary */}
                      <div className="pt-2 border-t border-slate-100/80 text-xs">
                        <p className="text-slate-650 leading-relaxed font-semibold">
                          {isExpanded 
                            ? trial.summary 
                            : trial.summary.length > 140 
                              ? `${trial.summary.substring(0, 140)}...` 
                              : trial.summary
                          }
                          {trial.summary.length > 140 && (
                            <button 
                              onClick={() => toggleSummary(trial.nctId)}
                              className="ml-1 text-[#0EA5A0] hover:text-[#0F2B5B] font-extrabold inline-flex items-center gap-0.5 transition cursor-pointer"
                            >
                              {isExpanded ? "Less" : "Read More"}
                            </button>
                          )}
                        </p>
                      </div>

                    </div>

                    {/* High Quality AI Match Evaluation Region */}
                    <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col justify-end gap-3.5">
                      
                      {hasAI ? (
                        <div className="space-y-2.5">
                          
                          {/* Interactive Match score and badge */}
                          <div className="flex items-center justify-between gap-2 bg-white/40 border border-slate-100 p-2.5 rounded-xl">
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wide">AI Recommendation</span>
                              <span className={`px-2 py-0.5 text-[9px] font-black rounded border block inline-block ${scoreInfo?.badgeColor}`}>
                                {scoreInfo?.badgeText}
                              </span>
                            </div>
                            <ScoreDonut score={result.score} />
                          </div>

                          {/* Recommendation snippet text */}
                          <p className="text-[11px] text-slate-605 line-clamp-2 leading-relaxed italic pr-1 select-text">
                            "{result.reasoning}"
                          </p>

                          {/* View detailed evaluation side drawer launch */}
                          <div className="pt-1.5 border-t border-slate-100/50 flex items-center justify-between select-none">
                            <span className="text-[8px] font-bold text-slate-405 uppercase font-mono tracking-widest">
                              OPENAI SECURE ANALYST
                            </span>
                            <button
                              onClick={() => setSelectedTrialForDetail(trial)}
                              className="text-xs font-extrabold text-[#0EA5A0] hover:text-[#0F2B5B] inline-flex items-center gap-0.5 transition cursor-pointer font-sans"
                            >
                              View Analysis
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>

                        </div>
                      ) : (
                        <div className="py-5 text-center flex flex-col items-center justify-center space-y-2 select-none">
                          <HelpCircle className="w-7 h-7 text-slate-300" />
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Match Rating Pending</span>
                          
                          <button
                            onClick={() => handleAnalyzeSingleTrial(trial)}
                            disabled={analyzingTrialId !== null}
                            className="p-1 px-3 bg-white border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-[11px] font-bold rounded-lg text-slate-705 transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Brain className={`w-3.5 h-3.5 text-blue-500 ${analyzingTrialId === trial.nctId ? "animate-spin" : ""}`} />
                            {analyzingTrialId === trial.nctId ? "Evaluating..." : "Analyze Match"}
                          </button>
                        </div>
                      )}

                    </div>

                  </div>
                );
              })}
            </div>

          </div>

        </div>
      )}

      {/* 4. Highly Polished RHS Slide-Over Panel for "View Analysis" details */}
      {selectedTrialForDetail && (() => {
        const result = matchResults[selectedTrialForDetail.nctId];
        const info = getScoreInfo(result?.score || 0);

        return (
          <div className="fixed inset-0 z-50 overflow-hidden flex animate-fade-in select-text">
            
            {/* Custom Dynamic Print Stylesheet Tag inside code to guarantee window.print isolates this card perfectly */}
            <style>{`
              @media print {
                html, body {
                  background: white !important;
                  color: black !important;
                  height: auto !important;
                  overflow: visible !important;
                }
                body * {
                  visibility: hidden !important;
                }
                #print-analysis-content, #print-analysis-content * {
                  visibility: visible !important;
                }
                #print-analysis-content {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  box-shadow: none !important;
                  border: none !important;
                  overflow: visible !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}</style>

            {/* Backdrop Dimmer Overlay */}
            <div 
              onClick={() => setSelectedTrialForDetail(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
            />

            {/* RHS Panel Frame with full mobile scroll support */}
            <div 
              id="print-analysis-content"
              className="absolute inset-y-0 right-0 max-w-2xl w-full bg-white shadow-2xl flex flex-col justify-between overflow-y-auto animate-slide-in relative select-text"
            >
              
              <div className="p-6 md:p-8 space-y-6">
                
                {/* Header panel details */}
                <div className="bg-[#0F2B5B] text-white p-6 rounded-2xl relative shadow-md flex justify-between items-start gap-4">
                  <div className="space-y-2 flex-1 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-sky-500 text-white text-[10px] font-black tracking-wider rounded uppercase font-mono">
                        {selectedTrialForDetail.nctId}
                      </span>
                      <span className="text-xs font-semibold text-sky-200 uppercase tracking-wider font-mono">
                        AI Compatibility Scorecard
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-extrabold pr-6 leading-snug tracking-tight">
                      {selectedTrialForDetail.title}
                    </h3>

                    <div className="pt-1.5">
                      <a 
                        href={`https://clinicaltrials.gov/study/${selectedTrialForDetail.nctId}`}
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs font-bold text-[#0EA5A0] hover:text-sky-305 underline inline-flex items-center gap-1 transition-colors no-print"
                      >
                        View on ClinicalTrials.gov
                        <ChevronRight className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Large Score Donut Chart placed top-right */}
                  <div className="shrink-0 bg-white p-1 rounded-full shadow-md">
                    <ScoreDonut score={result?.score || 0} large />
                  </div>

                  <button 
                    onClick={() => setSelectedTrialForDetail(null)}
                    className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition cursor-pointer no-print"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Section "Why this could be a match": styled blockquote */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black text-[#0F2B5B] uppercase tracking-wider flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-indigo-505" />
                    Why this could be a match
                  </h4>
                  <blockquote className="text-xs text-slate-700 font-medium leading-relaxed italic bg-indigo-50/20 p-4 border-l-4 border-[#0EA5A0] rounded-r-xl select-text">
                    "{result?.reasoning || 'Diagnostic parameters computed and summarized below.'}"
                  </blockquote>
                </div>

                {/* Section "Criteria met" (green) with checkbox status */}
                <div className="space-y-3 pt-1">
                  <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-pulse" />
                    Criteria Met (Inclusions)
                  </h4>
                  {(!result || !result.inclusions || result.inclusions.length === 0) ? (
                    <p className="text-xs text-slate-400 italic pl-5">No explicit inclusions verified by OpenAI analytics module.</p>
                  ) : (
                    <div className="space-y-2 pl-1 select-text">
                      {result.inclusions.map((m, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-slate-700 text-xs py-1.5 border-b border-slate-50 leading-normal">
                          <span className="p-0.5 rounded-full bg-emerald-50 text-emerald-600 shrink-0 border border-emerald-110 mt-0.5">
                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          </span>
                          <span>{m}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section "Criteria not met or unknown" (red X marks) */}
                <div className="space-y-3 pt-1">
                  <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    Criteria Not Met or Unknown (Exclusions / Risks)
                  </h4>
                  {(!result || !result.exclusions || result.exclusions.length === 0) ? (
                    <p className="text-xs text-emerald-600 italic font-semibold pl-5 flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> No exclusion risk factors detected for this profile.
                    </p>
                  ) : (
                    <div className="space-y-2 pl-1 select-text">
                      {result.exclusions.map((u, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-slate-700 text-xs py-1.5 border-b border-slate-50 leading-normal">
                          <span className="p-0.5 rounded-full bg-rose-50 text-rose-500 shrink-0 border border-rose-110 mt-0.5">
                            <X className="w-3.5 h-3.5" strokeWidth={3} />
                          </span>
                          <span>{u}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section "Trial details" table layout */}
                <div className="space-y-3.5 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black text-[#0F2B5B] uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-slate-400" />
                    National Registry Study Protocols
                  </h4>
                  
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 grid grid-cols-2 gap-4 text-xs font-semibold">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Registry Status</span>
                      <span className="font-extrabold text-[#0F2B5B] mt-0.5 block">{selectedTrialForDetail.status}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Clinical Phase</span>
                      <span className="font-extrabold text-[#0F2B5B] mt-0.5 block">{selectedTrialForDetail.phase}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Lead Sponsor</span>
                      <span className="font-extrabold text-slate-705 mt-0.5 block truncate" title={selectedTrialForDetail.sponsor}>
                        {selectedTrialForDetail.sponsor}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Sites / Location</span>
                      <span className="font-extrabold text-slate-705 mt-0.5 block truncate" title={selectedTrialForDetail.location}>
                        {selectedTrialForDetail.location}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Age Limits</span>
                      <span className="font-extrabold text-[#0F2B5B] mt-0.5 block">
                        {selectedTrialForDetail.minimumAge} to {selectedTrialForDetail.maximumAge}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Enrolled Gender Bias</span>
                      <span className="font-extrabold text-[#0F2B5B] mt-0.5 block uppercase">{selectedTrialForDetail.sex}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Side over footer controls with print trigger */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between no-print select-none">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 border border-slate-250 hover:border-slate-350 bg-white text-slate-700 font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" />
                  Export to PDF
                </button>
                
                <button
                  onClick={() => setSelectedTrialForDetail(null)}
                  className="px-5 py-2 bg-[#0F2B5B] text-white hover:bg-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Close Evaluation
                </button>
              </div>

            </div>

          </div>
        );
      })()}

    </div>
  );
};

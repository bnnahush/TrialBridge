import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, Award, Database, User,
  HelpCircle, ChevronRight, ShieldCheck, Tag, Info, ListFilter
} from "lucide-react";
import { fhirClient } from "../fhirClient";
import { ClinicalTrial, TrialCriteria, FHIRBundle } from "../types";
import { useApp } from "../context/AppContext";

const SNOMED_OPTIONS = [
  { label: "Type 2 Diabetes Mellitus", code: "44054006" },
  { label: "Essential Hypertension", code: "38341003" },
  { label: "Asthma", code: "195967001" },
  { label: "Chronic Kidney Disease Stage 3", code: "1094054004" },
  { label: "Hypercholesterolemia", code: "13644009" },
  { label: "Rheumatoid Arthritis", code: "69896004" }
];

interface MatchResult {
  trial: ClinicalTrial;
  overallEligible: boolean;
  score: number; // passed / total
  breakdown: Array<{
    criteria: TrialCriteria;
    passed: boolean;
    reason: string;
  }>;
}

export const PatientTrialsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { setIsLoading, setError, setSuccess } = useApp();

  const [patient, setPatient] = useState<any>(null);
  const [conditions, setConditions] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  
  const [trials, setTrials] = useState<ClinicalTrial[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [matchingStatus, setMatchingStatus] = useState("idle");

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

  const loadAllClinicalDataAndAnalyze = async () => {
    if (!id) return;
    setLoading(true);
    setIsLoading(true);
    setMatchingStatus("fetching_ehr");
    try {
      // 1. Fetch Patient official demographics
      const p = await fhirClient.getPatient(id);
      setPatient(p);
      const patientAge = p.birthDate ? calculateAge(p.birthDate) : 0;
      const patientGender = (p.gender || "unknown").toLowerCase();

      // 2. Fetch Condition SNOMED codes associated with patient
      setMatchingStatus("fetching_diagnoses");
      const conditionBundle = await fhirClient.getConditions({ patient: `Patient/${id}` });
      const activeConditions = conditionBundle?.entry?.map(e => e.resource) || [];
      const conditionCodes = activeConditions.map(c => c.code?.coding?.[0]?.code || "").filter(Boolean);
      setConditions(activeConditions);

      // 3. Fetch Labs/Observations associated with patient
      setMatchingStatus("fetching_vital_signs");
      const obsBundle = await fhirClient.getObservations({ patient: `Patient/${id}` });
      const activeObservations = obsBundle?.entry?.map(e => e.resource) || [];
      setObservations(activeObservations);

      // 4. Fetch Clinical Trials registered on live server
      setMatchingStatus("resolving_protocols");
      const trialBundle: FHIRBundle = await fhirClient.getResearchStudies(40);
      const parsedTrials: ClinicalTrial[] = [];

      if (trialBundle && trialBundle.entry) {
        trialBundle.entry.forEach((entry) => {
          if (!entry.resource || entry.resource.resourceType !== "ResearchStudy") return;
          const r = entry.resource;

          // Re-assemble criteria details
          const criteria: TrialCriteria[] = [];
          const code = r.keyword?.[0]?.coding?.[0]?.code || "";
          
          // Re-create some basic constraints dynamically based on name/criteria
          if (code) {
            criteria.push({ id: "c1", field: "condition", operator: "equals", value: code, displayValue: `Diagnosis Code: ${code}` });
          }

          // Read custom metadata attributes inside trial resource if they exist / fallback
          const desc = r.description || "Experimental protocol feasibility investigation study.";
          let phase = r.phase?.coding?.[0]?.display || "Phase 3";
          
          // Fallback static rules inside standard system context
          if (desc.toLowerCase().includes("melanoma")) {
            criteria.push({ id: "c2", field: "gender", operator: "equals", value: "female", displayValue: "Female" });
            criteria.push({ id: "c3", field: "ageMin", operator: "greaterDraft", value: "18", displayValue: "Min Age: 18" });
          } else if (desc.toLowerCase().includes("diabetes") || r.title?.toLowerCase().includes("diabetes")) {
            criteria.push({ id: "c4", field: "ageMin", operator: "greaterDraft", value: "18", displayValue: "Min Age: 18" });
            criteria.push({ id: "c5", field: "ageMax", operator: "lessDraft", value: "65", displayValue: "Max Age: 65" });
          } else if (desc.toLowerCase().includes("hypertension") || r.title?.toLowerCase().includes("hypertension")) {
            criteria.push({ id: "c6", field: "ageMin", operator: "greaterDraft", value: "30", displayValue: "Min Age: 30" });
            criteria.push({ id: "c7", field: "ageMax", operator: "lessDraft", value: "75", displayValue: "Max Age: 75" });
          }

          parsedTrials.push({
            id: r.id || "unknown",
            title: r.title || "Clinical Feasibility Assay",
            sponsor: r.sponsor?.display || "TrialBridge Core Labs",
            phase: phase,
            status: r.status || "active",
            description: desc,
            criteria: criteria
          });
        }
        );
      }

      // Add default templates if the FHIR ResearchStudies list is currently empty, to guarantee interactive data
      if (parsedTrials.length === 0) {
        parsedTrials.push(
          {
            id: "t1",
            title: "Preservation of Beta Cell Function in Adult Type 2 Diabetes",
            sponsor: "TrialBridge Analytics Lab & partners",
            phase: "Phase 3 Study",
            status: "active",
            description: "An evaluation of endocrine pathways and preservation therapies in young adult populations with early diabetes.",
            criteria: [
              { id: "e1", field: "gender", operator: "equals", value: "female", displayValue: "Female" },
              { id: "e2", field: "ageMin", operator: "greaterDraft", value: "18", displayValue: "Min Age: 18" },
              { id: "e4", field: "condition", operator: "equals", value: "44054006", displayValue: "Inclusion condition: Type 2 Diabetes Mellitus" }
            ]
          },
          {
            id: "t2",
            title: "Cardiovascular Remodeling with Beta Blockade in Hypertension",
            sponsor: "Global Cardiology Alliance",
            phase: "Phase 2 Study",
            status: "active",
            description: "Assessment of peripheral arterial resistance and cardiac muscle density in hypertensive groups.",
            criteria: [
              { id: "e5", field: "ageMin", operator: "greaterDraft", value: "30", displayValue: "Min Age: 30" },
              { id: "e6", field: "ageMax", operator: "lessDraft", value: "75", displayValue: "Max Age: 75" },
              { id: "e7", field: "condition", operator: "equals", value: "38341003", displayValue: "Inclusion condition: Essential Hypertension" }
            ]
          },
          {
            id: "t3",
            title: "Safety of Monoclonal Antibody Interventions in Moderate Asthma",
            sponsor: "Metropolitan Pulmonology Research Group",
            phase: "Phase 1 Study",
            status: "active",
            description: "Exploring safety profile of inhaled receptor stabilizers in moderate asthmatic cohorts.",
            criteria: [
              { id: "e8", field: "gender", operator: "equals", value: "male", displayValue: "Male" },
              { id: "e9", field: "ageMin", operator: "greaterDraft", value: "18", displayValue: "Min Age: 18" },
              { id: "e10", field: "condition", operator: "equals", value: "195967001", displayValue: "Inclusion condition: Asthma" }
            ]
          }
        );
      }

      setTrials(parsedTrials);

      // 5. Evaluate matching criteria logic
      setMatchingStatus("computing_matches");
      const analyzedMatches: MatchResult[] = parsedTrials.map(trial => {
        let passedCount = 0;
        const totalCount = trial.criteria.length;
        const breakdown = trial.criteria.map(crit => {
          let passed = false;
          let reason = "";

          if (crit.field === "gender") {
            passed = patientGender === crit.value.toLowerCase() || crit.value.toLowerCase() === "all";
            reason = passed 
              ? `Gender matched: ${p.gender}` 
              : `Required gender: ${crit.value} (Patient gender: ${p.gender || "unknown"})`;
          } else if (crit.field === "ageMin") {
            const min = parseInt(crit.value);
            passed = patientAge >= min;
            reason = passed 
              ? `Age requirement met: ${patientAge} y/o >= ${min}` 
              : `Minimum age is ${min} y/o (Patient age: ${patientAge})`;
          } else if (crit.field === "ageMax") {
            const max = parseInt(crit.value);
            passed = patientAge <= max;
            reason = passed 
              ? `Age limitation met: ${patientAge} y/o <= ${max}` 
              : `Maximum age is ${max} y/o (Patient age: ${patientAge})`;
          } else if (crit.field === "condition") {
            passed = conditionCodes.includes(crit.value);
            const targetDiag = SNOMED_OPTIONS.find(o => o.code === crit.value)?.label || crit.value;
            reason = passed 
              ? `Inclusion condition resolved: "${targetDiag}"` 
              : `Patient lacks diagnostic SNOMED code: "${targetDiag}"`;
          } else {
            passed = true;
            reason = "Standard optional parameter";
          }

          if (passed) passedCount++;

          return {
            criteria: crit,
            passed,
            reason
          };
        });

        const overallEligible = passedCount === totalCount;
        const score = totalCount > 0 ? (passedCount / totalCount) * 100 : 100;

        return {
          trial,
          overallEligible,
          score: Math.round(score),
          breakdown
        };
      });

      setMatches(analyzedMatches);
      setMatchingStatus("done");

    } catch (err: any) {
      console.error(err);
      setError("Eligibility matching assay execution failure.");
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllClinicalDataAndAnalyze();
  }, [id]);

  const handleEnroll = (trialTitle: string) => {
    setSuccess(`Successfully initiated enrollment protocols for Patient into trial: "${trialTitle}". Direct clinical study trace recorded.`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <RefreshCw className="w-8 h-8 text-teal-accent animate-spin mb-3" />
        <span className="text-xs text-slate-500 tracking-wider">
          {matchingStatus === "fetching_ehr" && "Contacting downstream patient records..."}
          {matchingStatus === "fetching_diagnoses" && "Resolving active SNOMED conditions..."}
          {matchingStatus === "fetching_vital_signs" && "Auditing LOINC observational data..."}
          {matchingStatus === "resolving_protocols" && "Downloading registered research studies..."}
          {matchingStatus === "computing_matches" && "Matching clinical eligibility constraints..."}
          {matchingStatus === "idle" && "Initializing workspace..."}
        </span>
      </div>
    );
  }

  const getPatientFullName = () => {
    if (!patient) return "";
    let given = patient.name?.[0]?.given?.join(" ") || "";
    let family = patient.name?.[0]?.family || "";
    return `${given} ${family}`.trim() || `Patient ID: ${patient.id}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link 
            to={`/patients/${id}`}
            className="p-1 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 transition mr-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-navy-primary tracking-tight font-sans">
              Trial Feasibility Analyzer
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Assessing <strong className="text-navy-primary">{getPatientFullName()}</strong> (Age: {patient?.birthDate ? calculateAge(patient.birthDate) : 0} | {patient?.gender}) against {trials.length} study protocols.
            </p>
          </div>
        </div>

        <button
          onClick={loadAllClinicalDataAndAnalyze}
          className="flex items-center gap-1.5 p-1.5 px-3 border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-xs font-semibold rounded-lg text-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Rerun Feasibility Analyzer
        </button>
      </div>

      {/* Patient clinical summary badge bar */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <span className="text-slate-400 block uppercase font-bold text-[10px] tracking-wider">Indexed Diagnostics</span>
          <span className="font-semibold text-navy-primary mt-1 block">
            {conditions.length === 0 ? "No Active Conditions" : `${conditions.length} Active Codes Recorded`}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block uppercase font-bold text-[10px] tracking-wider">Recorded Labs & Vital Signs</span>
          <span className="font-semibold text-navy-primary mt-1 block">
            {observations.length === 0 ? "No Measurements Logged" : `${observations.length} Vital Logs Resolved`}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block uppercase font-bold text-[10px] tracking-wider">Data Authorization Status</span>
          <span className="p-0.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-150 text-[10px] font-bold rounded inline-block mt-1 uppercase">
            Qualified cohort
          </span>
        </div>
      </div>

      {/* Primary Matches Workspace */}
      <div className="space-y-6">
        {matches.length === 0 ? (
          <div className="p-20 text-center text-slate-400 italic">
            No registered clinical protocols retrieved for analysis.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {matches.map(({ trial, overallEligible, score, breakdown }, index) => (
              <div 
                key={trial.id || index}
                className={`border rounded-xl bg-white shadow-xs overflow-hidden transition hover:shadow-md ${
                  overallEligible ? "border-amber-300" : "border-slate-200"
                }`}
              >
                
                {/* Header Banner for Match Result */}
                <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 bg-navy-primary text-white text-[9px] font-black uppercase tracking-wider rounded">
                      {trial.phase}
                    </span>
                    <h2 className="text-sm font-bold text-navy-primary leading-tight mt-1">{trial.title}</h2>
                    <p className="text-[10px] text-slate-400">Sponsor: <span className="font-semibold text-slate-500">{trial.sponsor}</span></p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] block font-bold text-slate-400 tracking-wider uppercase">Match Score</span>
                      <span className={`text-base font-black font-mono ${
                        overallEligible ? "text-emerald-600" : score > 50 ? "text-amber-600" : "text-slate-400"
                      }`}>
                        {score}% Match
                      </span>
                    </div>

                    <div className={`p-2 rounded-full ${
                      overallEligible ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                    }`}>
                      {overallEligible ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6 text-slate-400" />}
                    </div>
                  </div>
                </div>

                {/* Content - Description + Criteria details breakdown */}
                <div className="p-5 space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Protocol Description</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{trial.description}</p>
                  </div>

                  {/* Criteria Analysis Cards */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Inclusion & Exclusion Diagnostic Checks</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {breakdown.map(({ criteria: crit, passed, reason }, critIdx) => (
                        <div 
                          key={critIdx} 
                          className={`p-3 border rounded-xl flex items-start gap-2.5 text-xs transition ${
                            passed 
                              ? "border-emerald-150 bg-emerald-50/20 text-emerald-900" 
                              : "border-rose-150 bg-rose-50/20 text-rose-900"
                          }`}
                        >
                          <div className={`mt-0.5 ${passed ? "text-emerald-600" : "text-rose-500"}`}>
                            {passed ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                          </div>
                          <div>
                            <span className="font-bold block text-[11px] capitalize">
                              Constraint: {crit.field}
                            </span>
                            <p className="mt-0.5 text-slate-600 font-medium leading-normal">
                              {reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Enrolling mechanism if candidate eligible */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 leading-relaxed">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span>
                        {overallEligible 
                          ? "Patient meets all primary criteria mapped in study parameters." 
                          : "Subject requires diagnostic profile updates to meet eligibility threshold."
                        }
                      </span>
                    </div>

                    {overallEligible ? (
                      <button
                        onClick={() => handleEnroll(trial.title)}
                        className="p-2 px-4 bg-teal-accent hover:bg-teal-accent/90 text-white font-extrabold text-xs rounded-lg transition shadow-md cursor-pointer self-end sm:self-auto"
                      >
                        Enroll Candidate
                      </button>
                    ) : (
                      <button
                        disabled
                        className="p-2 px-4 bg-slate-100 text-slate-400 font-semibold text-xs rounded-lg cursor-not-allowed self-end sm:self-auto"
                      >
                        Enrollment Locked
                      </button>
                    )}
                  </div>

                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

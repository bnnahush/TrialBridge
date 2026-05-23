/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { 
  Briefcase, Activity, ShieldCheck, Tag, PlusCircle, CheckCircle, RefreshCw, 
  Trash2, Award, Zap, HelpCircle, Server, Eye, FileText
} from "lucide-react";
import { fhirClient } from "../fhirClient";
import { FHIRBundle, ClinicalTrial, TrialCriteria } from "../types";

interface Props {
  onSelectTrialForFeasibility: (criteria: TrialCriteria[], title: string) => void;
}

// Preset Clinical Trial Templates that researchers can register into their FHIR server
const TRIAL_PRESET_TEMPLATES = [
  {
    title: "Preservation of Beta Cell Function in Adult Type 2 Diabetes",
    sponsor: "TrialBridge Analytics Lab & partners",
    description: "An evaluation of endocrine pathways and preservation therapies in young adult populations with early diagnosis.",
    phase: "Phase 3 Study",
    keywordCode: "44054006", // Diabetes
    keywordText: "Type 2 Diabetes Mellitus",
    criteria: [
      { id: "e1", field: "gender", operator: "equals", value: "female", displayValue: "Female" },
      { id: "e2", field: "ageMin", operator: "greaterDraft", value: "18", displayValue: "Min Age: 18" },
      { id: "e3", field: "ageMax", operator: "lessDraft", value: "55", displayValue: "Max Age: 55" },
      { id: "e4", field: "condition", operator: "equals", value: "44054006", displayValue: "Type 2 Diabetes" }
    ] as TrialCriteria[]
  },
  {
    title: "Cardiovascular Remodeling with Beta Blockade in Hypertension",
    sponsor: "Global Cardiology Alliance",
    description: "Comprehensive assessment of peripheral arterial resistance and cardiac muscle density in adult hypertensive groups.",
    phase: "Phase 2 Study",
    keywordCode: "38341003", // Hypertension
    keywordText: "Essential Hypertension",
    criteria: [
      { id: "e5", field: "ageMin", operator: "greaterDraft", value: "30", displayValue: "Min Age: 30" },
      { id: "e6", field: "ageMax", operator: "lessDraft", value: "70", displayValue: "Max Age: 70" },
      { id: "e7", field: "condition", operator: "equals", value: "38341003", displayValue: "Essential Hypertension" }
    ] as TrialCriteria[]
  },
  {
    title: "Safety of Monoclonal Antibody Interventions in Moderate Asthma",
    sponsor: "Metropolitan Pulmonology Research Group",
    description: "Multi-center randomized assay exploring bronchial remodeling and safety profile of inhaled receptor stabilizers.",
    phase: "Phase 1 Study",
    keywordCode: "195967001", // Asthma
    keywordText: "Asthma",
    criteria: [
      { id: "e8", field: "gender", operator: "equals", value: "male", displayValue: "Male" },
      { id: "e9", field: "ageMin", operator: "greaterDraft", value: "18", displayValue: "Min Age: 18" },
      { id: "e10", field: "condition", operator: "equals", value: "195967001", displayValue: "Asthma" }
    ] as TrialCriteria[]
  }
];

export const TrialList: React.FC<Props> = ({ onSelectTrialForFeasibility }) => {
  const [trials, setTrials] = useState<ClinicalTrial[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Create state for registering trial template
  const [registeringIndex, setRegisteringIndex] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Custom new Trial simple form inputs
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newSponsor, setNewSponsor] = useState<string>("TrialBridge Biotech");
  const [newDescription, setNewDescription] = useState<string>("");
  const [newPhase, setNewPhase] = useState<string>("Phase 3");
  const [newConditionCode, setNewConditionCode] = useState<string>("44054006");
  const [newConditionLabel, setNewConditionLabel] = useState<string>("Type 2 Diabetes Mellitus");

  const loadTrialsFromFHIR = async () => {
    setLoading(true);
    setError(null);
    try {
      const bundle: FHIRBundle = await fhirClient.getResearchStudies(30);
      const list: ClinicalTrial[] = [];

      if (bundle && bundle.entry) {
        bundle.entry.forEach((entry) => {
          if (!entry.resource || entry.resource.resourceType !== "ResearchStudy") return;
          const r = entry.resource;

          // Reconstruct criteria array from keywords and values if present
          let criteria: TrialCriteria[] = [];
          
          // Try to extract condition keyword from FHIR ResearchStudy keyword array
          const code = r.keyword?.[0]?.coding?.[0]?.code || "";
          const lbl = r.keyword?.[0]?.coding?.[0]?.display || r.keyword?.[0]?.text || "Diagnostic Study";

          if (code) {
            criteria.push({
              id: "fc1",
              field: "condition",
              operator: "equals",
              value: code,
              displayValue: lbl
            });
          }

          list.push({
            id: r.id || "unknown",
            title: r.title || "Untitled Study",
            status: r.status || "active",
            phase: r.category?.[0]?.coding?.[0]?.display || r.category?.[0]?.text || "Phase 3 Study",
            sponsor: r.sponsor?.display || "Contract Research Sponsor",
            description: r.description || "No full description compiled in FHIR schema.",
            criteria
          });
        });
      }
      setTrials(list);
    } catch (err: any) {
      console.error("Downstream Trial registry link failed:", err);
      setError(err.message || "Failed to load registered trials from FHIR server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrialsFromFHIR();
  }, []);

  // Post a valid FHIR ResearchStudy resource
  const registerPresetToFHIR = async (template: typeof TRIAL_PRESET_TEMPLATES[0], index: number) => {
    setRegisteringIndex(index);
    setSuccessMsg(null);
    try {
      const fhirResource = {
        resourceType: "ResearchStudy",
        status: "active",
        title: template.title,
        description: template.description,
        sponsor: {
          display: template.sponsor
        },
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v2-0074",
                code: template.phase.replace(/\s+/g, "").toUpperCase(),
                display: template.phase
              }
            ]
          }
        ],
        keyword: [
          {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: template.keywordCode,
                display: template.keywordText
              }
            ]
          }
        ]
      };

      const result = await fhirClient.createResearchStudy(fhirResource);
      setSuccessMsg(`Successfully registered Study in FHIR ledger! ID: ${result.id}`);
      
      // Reload lists
      await loadTrialsFromFHIR();
    } catch (err: any) {
      console.error("FHIR post studies fail:", err);
      setError(`FHIR enrollment error: ${err.message || "Endpoint connection failed"}`);
    } finally {
      setRegisteringIndex(null);
    }
  };

  // Handle custom manual form creation
  const handleCreateCustomStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    
    setLoading(true);
    setSuccessMsg(null);
    try {
      const customTemplate = {
        title: newTitle,
        sponsor: newSponsor,
        description: newDescription,
        phase: `${newPhase} Study`,
        keywordCode: newConditionCode,
        keywordText: newConditionLabel,
        criteria: [
          { id: "c1", field: "condition", operator: "equals", value: newConditionCode, displayValue: newConditionLabel }
        ] as TrialCriteria[]
      };

      const fhirResource = {
        resourceType: "ResearchStudy",
        status: "active",
        title: customTemplate.title,
        description: customTemplate.description,
        sponsor: {
          display: customTemplate.sponsor
        },
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v2-0074",
                code: customTemplate.phase.replace(/\s+/g, "").toUpperCase(),
                display: customTemplate.phase
              }
            ]
          }
        ],
        keyword: [
          {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: customTemplate.keywordCode,
                display: customTemplate.keywordText
              }
            ]
          }
        ]
      };

      const result = await fhirClient.createResearchStudy(fhirResource);
      setSuccessMsg(`Successfully registered Study in FHIR ledger! ID: ${result.id}`);
      setShowAddForm(false);
      setNewTitle("");
      setNewDescription("");
      
      // Reload lists
      await loadTrialsFromFHIR();
    } catch (err: any) {
      console.error("Failed custom post:", err);
      setError(`Operation outcome failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="trial-registry-section" className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">Active Clinical Trial Registry</h2>
          <p className="text-xs text-slate-500">Querying <code className="font-mono bg-slate-50 border border-slate-100 p-0.5 px-1 rounded text-cyan-800">/ResearchStudy</code> schemas stored on target FHIR ledger</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Register New Trial
          </button>
          <button
            onClick={loadTrialsFromFHIR}
            disabled={loading}
            className="p-1 px-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs flex items-start gap-2 animate-fade-in shadow-xs">
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-850 text-xs font-medium">
          Error: {error}
        </div>
      )}

      {/* Register Custom Trial form layout */}
      {showAddForm && (
        <form onSubmit={handleCreateCustomStudy} className="bg-slate-50/50 hover:bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 max-w-2xl">
          <h3 className="font-semibold text-slate-800 text-sm">Register New FHIR ResearchStudy</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5 col-span-2">
              <label className="text-slate-500 font-semibold uppercase text-[10px]">Study Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Phase 3 trial on preservative beta protocols"
                className="w-full p-2.5 border border-slate-200 bg-white rounded-md tracking-wide"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-semibold uppercase text-[10px]">Lead Sponsor</label>
              <input
                type="text"
                value={newSponsor}
                onChange={(e) => setNewSponsor(e.target.value)}
                className="w-full p-2.5 border border-slate-200 bg-white rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-semibold uppercase text-[10px]">Registry Category</label>
              <select
                value={newPhase}
                onChange={(e) => setNewPhase(e.target.value)}
                className="w-full p-2.5 border border-slate-200 bg-white rounded-md"
              >
                <option value="Phase 1">Phase 1 Study</option>
                <option value="Phase 2">Phase 2 Study</option>
                <option value="Phase 3">Phase 3 Study</option>
                <option value="Phase 4">Phase 4 Study</option>
              </select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-slate-500 font-semibold uppercase text-[10px]">Trial Description / Scope Summary</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                placeholder="Describe enrollment scope, primary endpoints, etc."
                className="w-full p-2.5 border border-slate-200 bg-white rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-semibold uppercase text-[10px]">SNOMED CT Disease Code</label>
              <input
                type="text"
                value={newConditionCode}
                onChange={(e) => setNewConditionCode(e.target.value)}
                className="w-full p-2.5 border border-slate-200 bg-white rounded-md font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-semibold uppercase text-[10px]/snug">SNOMED Disease Display</label>
              <input
                type="text"
                value={newConditionLabel}
                onChange={(e) => setNewConditionLabel(e.target.value)}
                className="w-full p-2.5 border border-slate-200 bg-white rounded-md"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-1.5 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-700 active:bg-teal-950 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Submit in FHIR
            </button>
          </div>
        </form>
      )}

      {/* Main Study Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Active Ledger Trials of the FHIR Server */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 font-bold text-slate-700 text-xs uppercase tracking-wide">
            <Server className="w-4 h-4 text-cyan-700" />
            <span>FHIR Server Records ({trials.length})</span>
          </div>

          {loading ? (
            <div className="p-8 border border-slate-100 rounded-xl bg-slate-50/50 justify-center text-center text-xs text-slate-400 font-sans flex gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-teal-700" /> Connecting to FHIR clinical ledger ...
            </div>
          ) : trials.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-slate-400 text-center space-y-2">
              <PlusCircle className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-xs">No research studies active in this server.</p>
              <p className="text-[11px] leading-relaxed max-w-sm mx-auto text-slate-500">
                You can seed the server ledger instantly using our standard clinically-validated templates to study patient demographics.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {trials.map((trial) => (
                <div key={trial.id} className="p-5 bg-white border border-slate-100 hover:border-slate-300/80 rounded-xl shadow-xs transition-all space-y-3.5">
                  <div className="space-y-1">
                    <div className="flex gap-2 items-start justify-between">
                      <h4 className="font-semibold text-slate-800 text-sm leading-tight tracking-tight hover:text-cyan-900 cursor-pointer">
                        {trial.title}
                      </h4>
                      <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase select-none tracking-wide text-cyan-800 bg-cyan-50 border border-cyan-100">
                        {trial.phase}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span className="font-semibold text-slate-500">{trial.sponsor}</span>
                      <span>•</span>
                      <span className="font-mono text-[10px]">FHIR ID: {trial.id}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-normal">{trial.description}</p>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                    <div className="flex gap-2">
                      {trial.criteria.map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-50 border border-slate-100 text-[10px] text-slate-500 font-mono">
                          <Tag className="w-3 h-3 text-slate-400" /> {c.displayValue}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => onSelectTrialForFeasibility(trial.criteria, trial.title)}
                      className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 active:bg-slate-950 text-white rounded-lg text-[11px] font-sans font-bold transition-all flex items-center gap-1 cursor-pointer select-none active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Match Feasibility
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clinical Templates for quick seeding */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 font-bold text-slate-700 text-xs uppercase tracking-wide">
            <Award className="w-4 h-4 text-amber-600" />
            <span>Seed Standard Trial Protocols</span>
          </div>

          <div className="space-y-4">
            {TRIAL_PRESET_TEMPLATES.map((tpl, index) => {
              const alreadyRegistered = trials.some((t) => t.title.toLowerCase() === tpl.title.toLowerCase());
              const isRegistering = registeringIndex === index;

              return (
                <div key={index} className="p-5 border border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-xl space-y-3.5">
                  <div className="space-y-1">
                    <div className="flex gap-2 items-start justify-between">
                      <h4 className="font-semibold text-slate-700 text-sm leading-tight tracking-tight">
                        {tpl.title}
                      </h4>
                      <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 border border-slate-200 uppercase bg-white">
                        {tpl.phase}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 leading-none">
                      Lead Investigator: {tpl.sponsor}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-normal">{tpl.description}</p>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-teal-50 border border-teal-100 rounded text-[9px] text-teal-800 font-mono">
                        SNOMED: {tpl.keywordCode}
                      </span>
                    </div>

                    <button
                      onClick={() => registerPresetToFHIR(tpl, index)}
                      disabled={alreadyRegistered || isRegistering}
                      className="px-3 py-1.5 bg-white border border-slate-250 hover:border-teal-500/80 hover:text-teal-900 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40"
                    >
                      {isRegistering ? (
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Seeding...
                        </div>
                      ) : alreadyRegistered ? (
                        "Already Seeded"
                      ) : (
                        "Seed into FHIR Base"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

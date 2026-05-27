import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TrialList } from "../components/TrialList";
import { QueryBuilder } from "../components/QueryBuilder";
import { CohortMatcher } from "../components/CohortMatcher";
import { TrialCriteria } from "../types";
import { useApp } from "../context/AppContext";
import { Database, Layers, HelpCircle, ShieldCheck, Users } from "lucide-react";

export const TrialMatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSuccess } = useApp();
  const [activeTab, setActiveTab] = useState<"protocols" | "matcher" | "cohortMatch">("protocols");
  
  // Handlers for trial criteria selections
  const handleSelectTrialForFeasibility = (criteria: TrialCriteria[], title: string) => {
    // If a trial is selected, notify user and navigate them to custom cohort builder!
    setSuccess(`Loaded criteria variables for block study: "${title}"`);
    setActiveTab("matcher");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-primary tracking-tight">Active Protocol Workspace</h1>
          <p className="text-xs text-slate-500 mt-1">
            Build and audit study cohorts. Map inclusion limits against live LOINC logs and SNOMED diagnostic files.
          </p>
        </div>
      </div>

      {/* Tabs segment */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("protocols")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition focus:outline-none cursor-pointer ${
              activeTab === "protocols"
                ? "border-teal-accent text-teal-accent"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Database className="w-4 h-4" /> Registered Protocols
            </span>
          </button>
          <button
            onClick={() => setActiveTab("matcher")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition focus:outline-none cursor-pointer ${
              activeTab === "matcher"
                ? "border-teal-accent text-teal-accent"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> Ad-Hoc Cohort Matcher
            </span>
          </button>
          <button
            onClick={() => setActiveTab("cohortMatch")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition focus:outline-none cursor-pointer ${
              activeTab === "cohortMatch"
                ? "border-teal-accent text-teal-accent"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Cohort Trial Matcher
            </span>
          </button>
        </div>
      </div>

      {/* Dynamic View rendering */}
      <div className="animate-fade-in">
        {activeTab === "protocols" ? (
          <div>
            <div className="p-4 bg-teal-50 border border-teal-150 text-teal-900 rounded-xl text-xs flex items-center justify-between gap-4 mb-6 leading-relaxed">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-teal-accent shrink-0" />
                <p>
                  <strong>Study Protocol Registry:</strong> Register new study templates, edit diagnostic requirements, or click "Match Feasibility" to open the Cohort tool. To run matching against a specific individual patient, click <strong>"Patients"</strong> on the left, then select <strong>"Match Feasibility"</strong> on that patient profile!
                </p>
              </div>
            </div>
            <TrialList onSelectTrialForFeasibility={handleSelectTrialForFeasibility} />
          </div>
        ) : activeTab === "matcher" ? (
          <QueryBuilder />
        ) : (
          <CohortMatcher />
        )}
      </div>
    </div>
  );
};

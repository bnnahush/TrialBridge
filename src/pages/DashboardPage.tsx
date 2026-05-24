import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Users, Activity, Database, UserPlus, Search, 
  HelpCircle, AlertCircle, ChevronRight, RefreshCw, 
  Layers, AppWindow, Brain, ClipboardCheck, ArrowRight, Dna
} from "lucide-react";
import { fhirClient } from "../fhirClient";
import { FHIRBundle } from "../types";

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // Stats Card States
  const [patientsCount, setPatientsCount] = useState<number | null>(null);
  const [conditionsCount, setConditionsCount] = useState<number | null>(null);
  const [medicationsCount, setMedicationsCount] = useState<number | null>(null);

  const [patientsLoading, setPatientsLoading] = useState(true);
  const [conditionsLoading, setConditionsLoading] = useState(true);
  const [medicationsLoading, setMedicationsLoading] = useState(true);

  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [conditionsError, setConditionsError] = useState<string | null>(null);
  const [medicationsError, setMedicationsError] = useState<string | null>(null);

  // Recent Patients States
  const [recentPatients, setRecentPatients] = useState<any[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  // Individual Fetch Actions
  const fetchPatientsCount = async () => {
    setPatientsLoading(true);
    setPatientsError(null);
    try {
      const data = await fhirClient.request<FHIRBundle>("Patient?_summary=count");
      if (data && typeof data.total === "number") {
        setPatientsCount(data.total);
      } else {
        throw new Error("Invalid count response format");
      }
    } catch (err: any) {
      console.error("Error fetching patient count:", err);
      setPatientsError(err.message || "Failed to load");
    } finally {
      setPatientsLoading(false);
    }
  };

  const fetchConditionsCount = async () => {
    setConditionsLoading(true);
    setConditionsError(null);
    try {
      const data = await fhirClient.request<FHIRBundle>("Condition?clinical-status=active&_summary=count");
      if (data && typeof data.total === "number") {
        setConditionsCount(data.total);
      } else {
        throw new Error("Invalid conditions count format");
      }
    } catch (err: any) {
      console.error("Error fetching condition count:", err);
      setConditionsError(err.message || "Failed to load");
    } finally {
      setConditionsLoading(false);
    }
  };

  const fetchMedicationsCount = async () => {
    setMedicationsLoading(true);
    setMedicationsError(null);
    try {
      const data = await fhirClient.request<FHIRBundle>("MedicationRequest?status=active&_summary=count");
      if (data && typeof data.total === "number") {
        setMedicationsCount(data.total);
      } else {
        throw new Error("Invalid medications count format");
      }
    } catch (err: any) {
      console.error("Error fetching medication count:", err);
      setMedicationsError(err.message || "Failed to load");
    } finally {
      setMedicationsLoading(false);
    }
  };

  const fetchRecentPatients = async () => {
    setRecentLoading(true);
    setRecentError(null);
    try {
      const data = await fhirClient.request<FHIRBundle>("Patient?_count=5&_sort=-_lastUpdated");
      const parsed: any[] = [];
      if (data && data.entry) {
        data.entry.forEach((entry) => {
          if (entry.resource && entry.resource.resourceType === "Patient") {
            const r = entry.resource;
            let given = "";
            let family = "";
            if (r.name && r.name.length > 0) {
              const firstActiveName = r.name[0];
              if (firstActiveName.given && Array.isArray(firstActiveName.given)) {
                given = firstActiveName.given.join(" ");
              }
              family = firstActiveName.family || "";
            }
            let fullName = `${given} ${family}`.trim();
            if (!fullName) {
              fullName = `Unnamed Patient (${r.id || "ID Unknown"})`;
            }
            parsed.push({
              id: r.id,
              name: fullName,
              gender: r.gender || "unknown",
              birthDate: r.birthDate || "---",
            });
          }
        });
      }
      setRecentPatients(parsed);
    } catch (err: any) {
      console.error("Error fetching recent patients:", err);
      setRecentError(err.message || "Could not retrieve the recent patient history list from Server.");
    } finally {
      setRecentLoading(false);
    }
  };

  const handleRefreshAll = () => {
    fetchPatientsCount();
    fetchConditionsCount();
    fetchMedicationsCount();
    fetchRecentPatients();
  };

  useEffect(() => {
    fetchPatientsCount();
    fetchConditionsCount();
    fetchMedicationsCount();
    fetchRecentPatients();
  }, []);

  // Format YYYY-MM-DD
  const formatDate = (dateStr?: string): string => {
    if (!dateStr || dateStr === "---") return "---";
    try {
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
          const formattedDay = day < 10 ? `0${day}` : `${day}`;
          return `${months[monthIdx]} ${formattedDay}, ${year}`;
        }
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const day = d.getDate();
        const formattedDay = day < 10 ? `0${day}` : `${day}`;
        return `${months[d.getMonth()]} ${formattedDay}, ${d.getFullYear()}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Stat Card Skeleton
  const StatCardSkeleton = () => (
    <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs space-y-3 min-h-[120px] animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-3 w-20 bg-slate-200 rounded"></div>
        <div className="h-5 w-5 bg-slate-100 rounded-lg"></div>
      </div>
      <div className="h-8 w-24 bg-slate-200 rounded"></div>
      <div className="h-3 w-32 bg-slate-150 rounded"></div>
    </div>
  );

  // Stat Card Error Element
  const StatCardError: React.FC<{ label: string; error: string; onRetry: () => void }> = ({ label, error, onRetry }) => (
    <div className="p-5 border border-rose-200/60 rounded-2xl bg-rose-50/40 shadow-xs flex flex-col justify-between min-h-[120px]">
      <div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{label}</span>
          <AlertCircle className="w-4 h-4 text-rose-500" />
        </div>
        <p className="text-rose-800 text-[11px] mt-2 font-semibold line-clamp-1">{error}</p>
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
        className="text-left text-[#0EA5A0] hover:text-[#0F2B5B] text-[10px] font-extrabold flex items-center gap-1 mt-2 tracking-wide uppercase transition-all duration-150 cursor-pointer"
      >
        <RefreshCw className="w-2.5 h-2.5" /> Retry Sync
      </button>
    </div>
  );

  return (
    <div className="space-y-8 select-text">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black font-sans text-[#0F2B5B] tracking-tight">System Registry Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time HL7 FHIR database summary, cohort indexes, and intelligent study feasibility analytics.
          </p>
        </div>
        <button 
          onClick={handleRefreshAll}
          className="flex items-center gap-1.5 p-1.5 px-3 border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-xs font-bold rounded-xl text-slate-700 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${(patientsLoading || conditionsLoading || medicationsLoading || recentLoading) ? "animate-spin text-[#0EA5A0]" : ""}`} />
          Refresh Stats
        </button>
      </div>

      {/* Row of 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        
        {/* Total Patients Card */}
        {patientsLoading ? (
          <StatCardSkeleton />
        ) : patientsError ? (
          <StatCardError label="Total Patients" error={patientsError} onRetry={fetchPatientsCount} />
        ) : (
          <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px] transition-all hover:shadow-md duration-200">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Patients</span>
                <div className="p-1.5 bg-teal-50 text-teal-800 rounded-xl">
                  <Users className="w-4 h-4 text-[#0EA5A0]" />
                </div>
              </div>
              <h3 className="text-3xl font-black text-[#0F2B5B] mt-2.5 font-mono">
                {patientsCount !== null ? patientsCount.toLocaleString() : "0"}
              </h3>
            </div>
            <p className="text-[10px] text-emerald-600 font-extrabold mt-3 flex items-center gap-1">
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Direct active FHIR sync
            </p>
          </div>
        )}

        {/* Active Conditions Card */}
        {conditionsLoading ? (
          <StatCardSkeleton />
        ) : conditionsError ? (
          <StatCardError label="Active Conditions" error={conditionsError} onRetry={fetchConditionsCount} />
        ) : (
          <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px] transition-all hover:shadow-md duration-200">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Active Conditions</span>
                <div className="p-1.5 bg-sky-50 text-sky-800 rounded-xl">
                  <Activity className="w-4 h-4 text-sky-600" />
                </div>
              </div>
              <h3 className="text-3xl font-black text-[#0F2B5B] mt-2.5 font-mono">
                {conditionsCount !== null ? conditionsCount.toLocaleString() : "0"}
              </h3>
            </div>
            <p className="text-[10px] text-slate-400 font-extrabold mt-3 uppercase tracking-wider font-mono">
              Filtered by clinical active status
            </p>
          </div>
        )}

        {/* Active Medications Card */}
        {medicationsLoading ? (
          <StatCardSkeleton />
        ) : medicationsError ? (
          <StatCardError label="Active Medications" error={medicationsError} onRetry={fetchMedicationsCount} />
        ) : (
          <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px] transition-all hover:shadow-md duration-200">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Active Medications</span>
                <div className="p-1.5 bg-violet-50 text-violet-800 rounded-xl">
                  <Database className="w-4 h-4 text-violet-600" />
                </div>
              </div>
              <h3 className="text-3xl font-black text-[#0F2B5B] mt-2.5 font-mono">
                {medicationsCount !== null ? medicationsCount.toLocaleString() : "0"}
              </h3>
            </div>
            <p className="text-[10px] text-[#0EA5A0] font-extrabold mt-3 uppercase tracking-wider font-mono">
              Regimen prescription logs
            </p>
          </div>
        )}

      </div>

      {/* Primary Layout Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LHS: Recent Patients Table */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-black text-[#0F2B5B] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              Recent Patients
            </h2>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
              Last 5 updated records
            </span>
          </div>

          {recentLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-6 h-6 text-[#0EA5A0] animate-spin" />
              <span className="text-xs font-bold text-slate-450 uppercase tracking-wider font-mono">
                Loading clinical registry...
              </span>
            </div>
          ) : recentError ? (
            <div className="p-6 bg-rose-50/50 border border-rose-100 rounded-2xl text-rose-800 text-xs flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="font-bold">Error loading recent patients: {recentError}</span>
              </div>
              <button 
                onClick={fetchRecentPatients}
                className="self-start text-xs font-extrabold text-[#0EA5A0] hover:text-[#0F2B5B] underline"
              >
                Retry
              </button>
            </div>
          ) : recentPatients.length === 0 ? (
            <div className="py-12 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-semibold font-sans">No patients found in standard database.</p>
              <Link to="/patients/new" className="text-xs font-bold text-[#0EA5A0] hover:underline inline-block">
                Create first patient →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto min-w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase text-[9px] tracking-wider">
                    <th className="py-3 px-2">Patient Name</th>
                    <th className="py-3 px-2">Biological Gender</th>
                    <th className="py-3 px-2">Date of Birth</th>
                    <th className="py-3 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                  {recentPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-slate-50/60 transition duration-150">
                      <td className="py-3 px-2 font-extrabold text-[#0F2B5B]">
                        {patient.name}
                      </td>
                      <td className="py-3 px-2 capitalize text-slate-500">
                        {patient.gender}
                      </td>
                      <td className="py-3 px-2 font-mono text-slate-500">
                        {formatDate(patient.birthDate)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          onClick={() => navigate(`/patients/${patient.id}`)}
                          className="px-3 py-1 bg-white border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-[11px] font-bold text-slate-700 rounded-lg shadow-2xs transition cursor-pointer inline-flex items-center gap-0.5"
                        >
                          View Profile
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RHS: Quick Actions Card */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-black text-[#0F2B5B] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-400" />
              Quick Actions
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate("/patients/new")}
              className="w-full p-4 bg-teal-50/50 hover:bg-teal-50 border border-teal-100 hover:border-teal-200 text-left rounded-2xl transition duration-150 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white border border-teal-200/60 rounded-xl text-teal-800">
                    <UserPlus className="w-4.5 h-4.5 text-[#0EA5A0]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-[#0F2B5B]">Add New Patient</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Register a clinical sandbox entry</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => navigate("/trial-matches")}
              className="w-full p-4 bg-sky-50/30 hover:bg-sky-50/70 border border-sky-100 hover:border-sky-200 text-left rounded-2xl transition duration-150 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white border border-sky-200/60 rounded-xl text-sky-800">
                    <Database className="w-4.5 h-4.5 text-sky-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-[#0F2B5B]">Browse Trial Matches</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Verify registered study definitions</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => navigate("/patients")}
              className="w-full p-4 bg-slate-50 hover:bg-slate-105/70 border border-slate-150 hover:border-slate-200 text-left rounded-2xl transition duration-150 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white border border-slate-200 rounded-xl text-slate-800">
                    <Search className="w-4.5 h-4.5 text-[#0F2B5B]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-[#0F2B5B]">Search Patients</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Look up existing health files</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Full Width Bottom: How It Works Section */}
      <div className="bg-gradient-to-br from-[#0F2B5B]/5 to-[#0EA5A0]/5 border border-slate-200/70 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="space-y-1">
          <span className="text-[9px] font-black tracking-widest text-[#0EA5A0] uppercase font-mono block">
            TRIALBRIDGE WORKFLOW ENGINE
          </span>
          <h2 className="text-lg font-black text-[#0F2B5B] tracking-tight">
            How TrialBridge Matches Patients To Active Protocols
          </h2>
          <p className="text-xs text-slate-505 leading-relaxed font-semibold">
            An enterprise-level clinical overview designed to identify, assess, and recommend prospective recruits securely.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          
          {/* Step 1 */}
          <div className="bg-white/80 border border-slate-150 p-5 rounded-2xl relative space-y-3.5 shadow-2xs hover:shadow-xs transition duration-200">
            <span className="absolute top-4 right-4 text-2xl font-black font-mono text-slate-100 select-none">
              01
            </span>
            <div className="p-2 bg-teal-50 text-teal-850 rounded-xl w-fit">
              <UserPlus className="w-5 h-5 text-[#0EA5A0]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black text-[#0F2B5B] tracking-wide uppercase">
                1. Find / Add EHR Patient
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                Access the global demographic table or draft a new synthetic patient directory containing secure structured tags perfectly mapped onto the FHIR proxy database.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white/80 border border-slate-150 p-5 rounded-2xl relative space-y-3.5 shadow-2xs hover:shadow-xs transition duration-200">
            <span className="absolute top-4 right-4 text-2xl font-black font-mono text-slate-100 select-none">
              02
            </span>
            <div className="p-2 bg-sky-50 text-sky-850 rounded-xl w-fit">
              <ClipboardCheck className="w-5 h-5 text-sky-600" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black text-[#0F2B5B] tracking-wide uppercase">
                2. Review Clinical Dossier
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                Consolidate diagnostic conditions, medication regiments, and allergen profiles inside the patient details hub. Aggregate unstructured files and verify clinical details instantly.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white/80 border border-slate-150 p-5 rounded-2xl relative space-y-3.5 shadow-2xs hover:shadow-xs transition duration-200">
            <span className="absolute top-4 right-4 text-2xl font-black font-mono text-slate-100 select-none">
              03
            </span>
            <div className="p-2 bg-violet-50 text-violet-850 rounded-xl w-fit">
              <Brain className="w-5 h-5 text-violet-600 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black text-[#0F2B5B] tracking-wide uppercase">
                3. Intelligent Match Diagnosis
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                Trigger target matching scans utilizing secure gpt-4o-mini guidelines to evaluate complex age limit, exclusion, and inclusion rules with detailed explanations and scorecard exports.
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

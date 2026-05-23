/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Users, Search, PlusCircle, Trash2, Filter, AlertCircle, Play, 
  RefreshCw, Info, Calendar, User, Activity, ExternalLink, ChevronDown, CheckCircle
} from "lucide-react";
import { fhirClient } from "../fhirClient";
import { FHIRBundle, TrialCriteria, PatientSummary, FHIRResource } from "../types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

// Pre-loaded diagnostic criteria helpers
const PRESET_CONDITIONS = [
  { label: "Type 2 Diabetes Mellitus", code: "44054006", system: "SNOMED-CT" },
  { label: "Essential Hypertension", code: "38341003", system: "SNOMED-CT" },
  { label: "Asthma", code: "195967001", system: "SNOMED-CT" },
  { label: "Chronic Kidney Disease Stage 3", code: "1094054004", system: "SNOMED-CT" },
  { label: "Hypercholesterolemia", code: "13644009", system: "SNOMED-CT" },
  { label: "Rheumatoid Arthritis", code: "69896004", system: "SNOMED-CT" },
  { label: "COVID-19 (Diagnosis)", code: "840539006", system: "SNOMED-CT" },
];

export const QueryBuilder: React.FC = () => {
  const [criteria, setCriteria] = useState<TrialCriteria[]>([
    { id: "1", field: "gender", operator: "equals", value: "female", displayValue: "Female" },
    { id: "2", field: "ageMin", operator: "greaterDraft", value: "18", displayValue: "Min Age: 18" },
  ]);
  
  // Custom Raw Query UI state
  const [rawQueryText, setRawQueryText] = useState<string>("Patient?gender=female&_count=10");
  const [useRawQuery, setUseRawQuery] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<FHIRBundle | null>(null);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [executedUrl, setExecutedUrl] = useState<string>("");

  // Target patient details sidebar
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientDetailsLoading, setPatientDetailsLoading] = useState<boolean>(false);
  const [selectedPatientConditions, setSelectedPatientConditions] = useState<FHIRResource[]>([]);
  const [selectedPatientObservations, setSelectedPatientObservations] = useState<FHIRResource[]>([]);

  // Local helper for age calculation from FHIR birthDate
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

  // Run the FHIR search query based on current parameters
  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    setBundle(null);
    setPatients([]);
    setSelectedPatientId(null);

    const today = new Date();
    const formatFHIRDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    let fhirUrlAndParams = "";

    try {
      if (useRawQuery) {
        // Direct Query Tester mode
        fhirUrlAndParams = rawQueryText;
        setExecutedUrl(`/fhir-proxy/${rawQueryText}`);
        const result = await fhirClient.request<FHIRBundle>(rawQueryText);
        setBundle(result);
        await parseBundle(result);
      } else {
        // Build visually from criteria list
        const params: Record<string, any> = { _count: 35 };
        let hasConditionCode = "";

        criteria.forEach((rule) => {
          if (!rule.value.trim()) return;

          if (rule.field === "gender" && rule.value !== "all") {
            params.gender = rule.value.toLowerCase();
          } else if (rule.field === "ageMin") {
            // patient must be >= ageMin (born before (Today - ageMin years))
            const ageLimitYear = today.getFullYear() - parseInt(rule.value);
            const limitDate = new Date(today);
            limitDate.setFullYear(ageLimitYear);
            params.birthdateLe = formatFHIRDate(limitDate);
          } else if (rule.field === "ageMax") {
            // patient must be <= ageMax (born after (Today - ageMax - 1 years))
            const ageLimitYear = today.getFullYear() - parseInt(rule.value) - 1;
            const limitDate = new Date(today);
            limitDate.setFullYear(ageLimitYear);
            params.birthdateGe = formatFHIRDate(limitDate);
          } else if (rule.field === "condition") {
            hasConditionCode = rule.value;
          }
        });

        // Resolve reverse chaining if condition filters are defined
        if (hasConditionCode) {
          params._has = `Condition:patient:code=${hasConditionCode}`;
        }

        // Construct preview metadata of exact relative route called
        const parts: string[] = [];
        if (params.gender) parts.push(`gender=${params.gender}`);
        if (params.birthdateLe) parts.push(`birthdate=le${params.birthdateLe}`);
        if (params.birthdateGe) parts.push(`birthdate=ge${params.birthdateGe}`);
        if (params._has) parts.push(`_has=${params._has}`);
        parts.push(`_count=${params._count}`);
        fhirUrlAndParams = `Patient?${parts.join("&")}`;
        setExecutedUrl(`/fhir-proxy/${fhirUrlAndParams}`);

        const result = await fhirClient.searchPatients(params);
        setBundle(result);
        await parseBundle(result);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during downstream resource index resolution.");
    } finally {
      setLoading(false);
    }
  };

  // Parse patient records in Bundle and extract condition links
  const parseBundle = async (fhirBundle: FHIRBundle) => {
    if (!fhirBundle || !fhirBundle.entry) {
      setPatients([]);
      return;
    }

    const patientList: PatientSummary[] = [];

    for (const item of fhirBundle.entry) {
      if (!item.resource || item.resource.resourceType !== "Patient") continue;
      const res = item.resource;

      // Extract Name
      let givenName = "";
      let familyName = "";
      if (res.name && res.name[0]) {
        givenName = res.name[0].given?.join(" ") || "";
        familyName = res.name[0].family || "";
      }
      const fullName = `${givenName} ${familyName}`.trim() || `Patient (ID: ${res.id})`;

      patientList.push({
        id: res.id || "unknown",
        name: fullName,
        gender: res.gender || "unknown",
        birthDate: res.birthDate || "",
        age: res.birthDate ? calculateAge(res.birthDate) : 0,
        conditions: [], // filled on demand or inferred
        active: res.active !== false,
      });
    }

    setPatients(patientList);
  };

  // Trigger loading patient sub-file details (conditions + observations)
  const loadPatientClinicalRecords = async (patientId: string) => {
    setPatientDetailsLoading(true);
    setSelectedPatientId(patientId);
    setSelectedPatientConditions([]);
    setSelectedPatientObservations([]);

    try {
      const conditionPayload = await fhirClient.getConditions({ patient: `Patient/${patientId}` });
      if (conditionPayload && conditionPayload.entry) {
        setSelectedPatientConditions(conditionPayload.entry.map(e => e.resource));
      }

      const observationPayload = await fhirClient.getObservations({ patient: `Patient/${patientId}` });
      if (observationPayload && observationPayload.entry) {
        setSelectedPatientObservations(observationPayload.entry.map(e => e.resource));
      }
    } catch (err) {
      console.error("Clinical audit fail:", err);
    } finally {
      setPatientDetailsLoading(false);
    }
  };

  // Add search condition visual rules
  const addFilter = (field: TrialCriteria["field"], val: string, disp: string) => {
    const newId = Date.now().toString();
    setCriteria([...criteria, { id: newId, field, operator: "equals", value: val, displayValue: disp }]);
  };

  const removeCriteriaRule = (id: string) => {
    setCriteria(criteria.filter((c) => c.id !== id));
  };

  const updateCriteriaValue = (id: string, nv: string) => {
    setCriteria(criteria.map((c) => {
      if (c.id !== id) return c;
      let displayValue = nv;
      if (c.field === "gender") displayValue = nv.charAt(0).toUpperCase() + nv.slice(1);
      if (c.field === "ageMin") displayValue = `Min Age: ${nv}`;
      if (c.field === "ageMax") displayValue = `Max Age: ${nv}`;
      return { ...c, value: nv, displayValue };
    }));
  };

  // Calculate aggregation statistics for clinical trial charts
  const ageDistributionData = () => {
    const groups = { "Pediatric (<18)": 0, "Adult (18-45)": 0, "Middle-Age (46-65)": 0, "Senior (65+)": 0 };
    patients.forEach((p) => {
      if (p.age < 18) groups["Pediatric (<18)"]++;
      else if (p.age <= 45) groups["Adult (18-45)"]++;
      else if (p.age <= 65) groups["Middle-Age (46-65)"]++;
      else groups["Senior (65+)"]++;
    });
    return Object.entries(groups).map(([name, count]) => ({ name, count }));
  };

  const genderDistributionData = () => {
    const genders: Record<string, number> = {};
    patients.forEach((p) => {
      const g = p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "Unknown";
      genders[g] = (genders[g] || 0) + 1;
    });
    const COLORS = ["#0e7490", "#0891b2", "#22d3ee", "#1e293b"];
    return Object.entries(genders).map(([name, value], i) => ({
      name,
      value,
      color: COLORS[i % COLORS.length]
    }));
  };

  const hasResults = patients.length > 0;

  return (
    <div id="cohort-query-builder" className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Visual Query Panel - left */}
        <div className="xl:col-span-5 space-y-5">
          <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-teal-600" />
                <h3 className="font-semibold text-slate-800 text-sm tracking-tight">Inclusion Query Parameters</h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setUseRawQuery(false)}
                  className={`px-2 py-1 rounded transition-colors font-medium cursor-pointer ${!useRawQuery ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Visual Builder
                </button>
                <button
                  onClick={() => setUseRawQuery(true)}
                  className={`px-2 py-1 rounded transition-colors font-medium cursor-pointer ${useRawQuery ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Developer Query
                </button>
              </div>
            </div>

            {/* Visual Builder Mode */}
            {!useRawQuery ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  {criteria.length === 0 ? (
                    <div className="text-center p-6 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                      No matching criteria defined. The system will load a general patient directory.
                    </div>
                  ) : (
                    criteria.map((rule) => (
                      <div key={rule.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-lg border border-slate-100/80">
                        <div className="w-1/3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {rule.field === "gender" && "Gender Restriction"}
                          {rule.field === "ageMin" && "Age Floor limit"}
                          {rule.field === "ageMax" && "Age Ceiling limit"}
                          {rule.field === "condition" && "SNOMED code"}
                        </div>

                        {/* Condition Values / Selection */}
                        <div className="flex-1">
                          {rule.field === "gender" ? (
                            <select
                              value={rule.value}
                              onChange={(e) => updateCriteriaValue(rule.id, e.target.value)}
                              className="w-full text-xs border border-slate-200 bg-white rounded-md p-1.5 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-medium"
                            >
                              <option value="female">Female</option>
                              <option value="male">Male</option>
                              <option value="other">Other</option>
                              <option value="unknown">Unknown</option>
                            </select>
                          ) : rule.field === "ageMin" || rule.field === "ageMax" ? (
                            <input
                              type="number"
                              min="0"
                              max="120"
                              value={rule.value}
                              onChange={(e) => updateCriteriaValue(rule.id, e.target.value)}
                              className="w-full text-xs font-medium border border-slate-200 bg-white rounded-md p-1.5 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-semibold"
                            />
                          ) : (
                            <input
                              type="text"
                              value={rule.value}
                              placeholder="e.g., SNOMED Code"
                              onChange={(e) => updateCriteriaValue(rule.id, e.target.value)}
                              className="w-full text-xs border border-slate-200 bg-white rounded-md p-1.5 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono"
                            />
                          )}
                        </div>

                        <button
                          onClick={() => removeCriteriaRule(rule.id)}
                          className="p-1 px-1.5 text-slate-400 hover:text-red-500 transition-colors shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Filter insertion buttons */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 w-full mb-1">Add Filter Clause:</span>
                  <button
                    onClick={() => addFilter("gender", "female", "Female")}
                    disabled={criteria.some((c) => c.field === "gender")}
                    className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-700 text-xs rounded-md flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-teal-600" /> Gender
                  </button>
                  <button
                    onClick={() => addFilter("ageMin", "18", "Min Age")}
                    disabled={criteria.some((c) => c.field === "ageMin")}
                    className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-700 text-xs rounded-md flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-teal-600" /> Min Age
                  </button>
                  <button
                    onClick={() => addFilter("ageMax", "65", "Max Age")}
                    disabled={criteria.some((c) => c.field === "ageMax")}
                    className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-700 text-xs rounded-md flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-teal-600" /> Max Age
                  </button>
                  <button
                    onClick={() => addFilter("condition", "44054006", "T2 Diabetes")}
                    disabled={criteria.some((c) => c.field === "condition")}
                    className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-700 text-xs rounded-md flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-teal-600" /> Clinical Diagnosis
                  </button>
                </div>

                {/* Patient SNOMED Helpers */}
                <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-xs space-y-2">
                  <div className="font-semibold text-slate-600 flex items-center gap-1 text-[11px]">
                    <Info className="w-3.5 h-3.5 text-teal-700" /> Condition Presets (Click to Add SNOMED Filter)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {PRESET_CONDITIONS.map((preset) => (
                      <button
                        key={preset.code}
                        onClick={() => {
                          if (!criteria.some((c) => c.field === "condition")) {
                            addFilter("condition", preset.code, preset.label);
                          } else {
                            const cId = criteria.find((c) => c.field === "condition")?.id;
                            if (cId) updateCriteriaValue(cId, preset.code);
                          }
                        }}
                        className="p-1 bg-white hover:bg-teal-550 border border-slate-150 hover:border-teal-500 rounded text-[10px] text-slate-600 font-sans transition-colors cursor-pointer text-left shrink-0 active:scale-95"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Developer Mode with Raw Field */
              <div className="space-y-4 text-xs font-mono">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 font-sans space-y-1">
                  <div className="font-semibold text-teal-900">Direct Proxy Query Console</div>
                  <div className="text-[11px] text-slate-500">
                    Query any R4 endpoints directly through our client. The secure token is auto-appended inside the server.
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-sans font-bold text-slate-400 block">Query URI</label>
                  <div className="flex gap-2">
                    <span className="p-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-md font-mono flex items-center select-none text-[11px]">
                      /fhir-proxy/
                    </span>
                    <input
                      type="text"
                      value={rawQueryText}
                      onChange={(e) => setRawQueryText(e.target.value)}
                      placeholder="Patient?gender=male&_count=5"
                      className="flex-1 border border-slate-200 bg-white rounded-md p-2 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-[11px]"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-50 font-sans">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Search Helpers:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px]">
                    <button
                      onClick={() => setRawQueryText("Patient?_count=15")}
                      className="text-left p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded text-slate-600 overflow-hidden font-mono truncate cursor-pointer"
                    >
                      Patient?_count=15
                    </button>
                    <button
                      onClick={() => setRawQueryText("ResearchStudy?_count=10")}
                      className="text-left p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded text-slate-600 overflow-hidden font-mono truncate cursor-pointer"
                    >
                      ResearchStudy?_count=10
                    </button>
                    <button
                      onClick={() => setRawQueryText("Condition?_count=10")}
                      className="text-left p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded text-slate-600 overflow-hidden font-mono truncate cursor-pointer"
                    >
                      Condition?_count=10
                    </button>
                    <button
                      onClick={() => setRawQueryText("Patient?_has:Condition:patient:code=38341003")}
                      className="text-left p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded text-slate-600 overflow-hidden font-mono truncate cursor-pointer"
                    >
                      Patient (Hypertension)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Run query trigger Button */}
            <button
              onClick={executeQuery}
              disabled={loading}
              className="w-full py-2.5 bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white rounded-lg font-semibold tracking-wide text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Resolving Patient Directory ...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" /> Query FHIR Server
                </>
              )}
            </button>
          </div>
        </div>

        {/* Query Output - Right */}
        <div className="xl:col-span-7 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
              <div>
                <h4 className="font-semibold text-xs uppercase tracking-wide"> Downstream Query Rejected</h4>
                <p className="text-xs text-red-700 mt-1 font-mono leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* If query has been executed, show this */}
          {executedUrl && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-150 text-[10px] text-slate-500 font-mono flex items-center justify-between gap-3 truncate">
              <span className="truncate">REQUEST PATH: <code className="text-teal-800 bg-white font-bold px-1.5 py-0.5 rounded border border-slate-100">{executedUrl}</code></span>
              {bundle && (
                <span className="shrink-0 text-slate-400 font-sans">
                  Found: <strong>{bundle.total !== undefined ? bundle.total : patients.length}</strong> matches
                </span>
              )}
            </div>
          )}

          {!bundle && !loading && !error && (
            <div className="h-full min-h-[300px] border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col justify-center items-center text-center p-8 space-y-3">
              <Users className="w-10 h-10 text-slate-300 stroke-[1.5]" />
              <div className="max-w-md">
                <h4 className="font-semibold text-slate-700 text-sm">Cohort Matching Workspace Available</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  TrialBridge allows running live cohort analysis on the connected FHIR R4 repository. Define standard criteria on the left or click "Query FHIR Server" directly to search patients.
                </p>
              </div>
            </div>
          )}

          {/* Results dashboard rendering standard indicators */}
          {bundle && (
            <div className="space-y-6">
              
              {/* Statistical Demographics panel */}
              {hasResults && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Age Distribution Chart */}
                  <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cohort Age Breakdown</h4>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ageDistributionData()}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <Tooltip cursor={{ fill: '#e2e8f0', opacity: 0.3 }} />
                          <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]}>
                            {ageDistributionData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#0891b2" : "#0f766e"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Gender Distribution Chart */}
                  <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Gender Demographics</h4>
                    <div className="h-40 flex items-center justify-center">
                      <div className="w-1/2 h-full">
                        <ResponsiveContainer width="100%" height="105%">
                          <PieChart>
                            <Pie
                              data={genderDistributionData()}
                              cx="50%"
                              cy="50%"
                              innerRadius="50%"
                              outerRadius="80%"
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {genderDistributionData().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-1/2 text-xs space-y-1.5 pl-3">
                        {genderDistributionData().map((entry) => (
                          <div key={entry.name} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-600 font-medium">{entry.name}:</span>
                            <span className="font-bold text-slate-800">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Patients Result Table list */}
              <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-700" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Candidate Cohort ledger ({patients.length} listed)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Showing active patients matching filters</span>
                </div>

                {patients.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Users className="w-8 h-8 text-slate-350 mx-auto" />
                    <p className="text-xs">No active Patient records match current criteria.</p>
                    <p className="text-[11px] leading-normal text-slate-400 max-w-sm mx-auto">
                      Wait, the public FHIR sandbox occasionally resets. Modify your query filters or insert test patient records to run feasibility evaluations.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                    {patients.map((p) => {
                      const isSelected = selectedPatientId === p.id;
                      return (
                        <div 
                          key={p.id}
                          className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50 transition-colors ${isSelected ? "bg-cyan-50/40 relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-cyan-600" : ""}`}
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-slate-800 text-sm cursor-pointer hover:text-cyan-800" onClick={() => loadPatientClinicalRecords(p.id)}>
                                {p.name}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold select-none uppercase ${p.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                {p.active ? "Active" : "Archived"}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500 font-sans">
                              <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {p.gender.toUpperCase()}</span>
                              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Born: {p.birthDate || "n/a"} ({p.age} yrs old)</span>
                              <span className="text-slate-400 font-mono text-[10px]">ID: {p.id}</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => loadPatientClinicalRecords(p.id)}
                            className="px-3 py-1.5 border border-slate-150 hover:border-cyan-500 text-slate-700 hover:text-cyan-900 text-xs rounded font-medium transition-colors cursor-pointer flex items-center gap-1 bg-white shrink-0 shadow-xs"
                          >
                            <Activity className="w-3.5 h-3.5" /> {isSelected ? "Selected" : "Clinical Profile"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Patient Detailed Records Draw - dynamic fetch */}
              {selectedPatientId && (
                <div id="patient-comorbid-panel" className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 transition-all">
                  <div className="flex justify-between items-start pb-2 border-b border-slate-200">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        Clinical File Review: Patient ID <code className="bg-white px-2 py-0.5 border border-slate-200 text-xs text-cyan-800 rounded font-mono font-bold select-all">{selectedPatientId}</code>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">Real-time clinical and laboratory evaluation for trial fit</p>
                    </div>
                    <button 
                      onClick={() => setSelectedPatientId(null)}
                      className="text-slate-400 hover:text-slate-600 font-sans text-xs font-semibold cursor-pointer"
                    >
                      Dismiss file
                    </button>
                  </div>

                  {patientDetailsLoading ? (
                    <div className="py-8 justify-center text-center text-xs text-slate-500 items-center flex gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-teal-700" /> Pulling downstream EHR database...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Conditions list */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Documented Clinical Conditions</span>
                        <div className="p-3 bg-white border border-slate-200 rounded-lg min-h-[100px] max-h-[200px] overflow-y-auto space-y-2">
                          {selectedPatientConditions.length === 0 ? (
                            <div className="text-center text-slate-400 text-xs py-5">No diagnosed conditions documented in FHIR ledger.</div>
                          ) : (
                            selectedPatientConditions.map((cond, idx) => {
                              // Extract display label or raw code
                              const displayLabel = cond.code?.text || cond.code?.coding?.[0]?.display || cond.code?.coding?.[0]?.code || "Unknown condition";
                              const status = cond.clinicalStatus?.coding?.[0]?.code || cond.clinicalStatus?.text || "active";
                              return (
                                <div key={cond.id || idx} className="p-2 border border-slate-100 rounded text-xs flex justify-between items-start gap-2 bg-slate-50/40">
                                  <div>
                                    <div className="font-bold text-slate-700 font-sans leading-snug">{displayLabel}</div>
                                    <div className="font-mono text-[9px] text-slate-400 mt-0.5">Coding: {cond.code?.coding?.[0]?.system?.split("/").pop() || "SNOMED"}:{cond.code?.coding?.[0]?.code || "n/a"}</div>
                                  </div>
                                  <span className="shrink-0 inline-block px-1.5 py-0.5 bg-cyan-50 text-cyan-800 border border-cyan-100 text-[9px] font-bold uppercase rounded">
                                    {status}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Observations list */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Diagnostic Tests & Vitals</span>
                        <div className="p-3 bg-white border border-slate-200 rounded-lg min-h-[100px] max-h-[200px] overflow-y-auto space-y-2">
                          {selectedPatientObservations.length === 0 ? (
                            <div className="text-center text-slate-400 text-xs py-5">No vitals or lab diagnostic tests recorded.</div>
                          ) : (
                            selectedPatientObservations.map((obs, idx) => {
                              const displayLabel = obs.code?.text || obs.code?.coding?.[0]?.display || obs.code?.coding?.[0]?.code || "Observation";
                              // Format value Quantity or String
                              let finalVal = "n/a";
                              if (obs.valueQuantity) {
                                finalVal = `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ""}`;
                              } else if (obs.valueString) {
                                finalVal = obs.valueString;
                              }
                              const obsDate = obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString() : "n/a";
                              return (
                                <div key={obs.id || idx} className="p-2 border border-slate-105 rounded text-xs flex justify-between items-center gap-2 bg-slate-50/40">
                                  <div>
                                    <div className="font-bold text-slate-700 leading-snug">{displayLabel}</div>
                                    <span className="text-[9px] text-slate-400 font-mono">LOINC: {obs.code?.coding?.[0]?.code || "n/a"} • Date: {obsDate}</span>
                                  </div>
                                  <span className="font-mono text-xs font-extrabold text-slate-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 shrink-0">
                                    {finalVal}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

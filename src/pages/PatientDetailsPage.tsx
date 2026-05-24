import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, Edit, RefreshCw, Activity, Calendar, User, Phone, Mail, 
  MapPin, Clipboard, Heart, Lock, AlertCircle, ShieldAlert, Sparkles, Info
} from "lucide-react";
import { fhirClient } from "../fhirClient";
import { useApp } from "../context/AppContext";
import { ResponsiveContainer, LineChart, Line, YAxis } from "recharts";

export const PatientDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { setIsLoading } = useApp();

  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "trials">("overview");

  // Calculate age accurately helper
  const calculateAge = (birthDateStr?: string): number => {
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

  // Humanize gender
  const capitalizeGender = (g?: string): string => {
    if (!g) return "Unknown";
    return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
  };

  // Helper utility to format raw YYYY-MM-DD to MMM DD, YYYY
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return "---";
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

  // Hash calculation for user avatar background color matching the patient ID
  const getHashColor = (patientId: string) => {
    let hash = 0;
    for (let i = 0; i < patientId.length; i++) {
      hash = patientId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      "bg-[#0EA5A0] text-white", // TrialBridge main teal
      "bg-indigo-600 text-white",
      "bg-blue-600 text-white",
      "bg-emerald-600 text-white",
      "bg-violet-600 text-white",
      "bg-purple-600 text-white",
      "bg-pink-600 text-white",
      "bg-amber-600 text-white",
      "bg-rose-600 text-white",
      "bg-cyan-600 text-white",
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (p: any) => {
    if (!p) return "--";
    let given = "";
    let family = "";
    if (p.name && p.name.length > 0) {
      const firstActiveName = p.name[0];
      if (firstActiveName.given && Array.isArray(firstActiveName.given)) {
        given = firstActiveName.given[0] || "";
      }
      family = firstActiveName.family || "";
    }
    
    const firstInit = given.charAt(0).toUpperCase();
    const lastInit = family.charAt(0).toUpperCase();
    
    if (!firstInit && !lastInit) return "PT";
    if (!firstInit) return lastInit;
    if (!lastInit) return firstInit;
    return `${firstInit}${lastInit}`;
  };

  const getPatientFullName = (p: any) => {
    if (!p) return "";
    let given = "";
    let family = "";
    if (p.name && p.name.length > 0) {
      const firstActiveName = p.name[0];
      if (firstActiveName.given && Array.isArray(firstActiveName.given)) {
        given = firstActiveName.given.join(" ");
      }
      family = firstActiveName.family || "";
    }
    return `${given} ${family}`.trim() || `Patient ID: ${p.id}`;
  };

  // Conditions state
  const [conditions, setConditions] = useState<any[]>([]);
  const [conditionsLoading, setConditionsLoading] = useState(true);
  const [conditionsError, setConditionsError] = useState<string | null>(null);

  // Medications state
  const [medications, setMedications] = useState<any[]>([]);
  const [medicationsLoading, setMedicationsLoading] = useState(true);
  const [medicationsError, setMedicationsError] = useState<string | null>(null);

  // Vitals state
  const [vitals, setVitals] = useState<any[]>([]);
  const [vitalsLoading, setVitalsLoading] = useState(true);
  const [vitalsError, setVitalsError] = useState<string | null>(null);

  // Allergies state
  const [allergies, setAllergies] = useState<any[]>([]);
  const [allergiesLoading, setAllergiesLoading] = useState(true);
  const [allergiesError, setAllergiesError] = useState<string | null>(null);

  // Medical History (All Conditions) state
  const [allConditions, setAllConditions] = useState<any[]>([]);
  const [allConditionsLoading, setAllConditionsLoading] = useState(true);
  const [allConditionsError, setAllConditionsError] = useState<string | null>(null);

  // Helper to format onset date to MMM YYYY
  const formatOnset = (onsetStr?: string): string => {
    if (!onsetStr) return "---";
    try {
      const d = new Date(onsetStr);
      if (isNaN(d.getTime())) return onsetStr;
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return onsetStr;
    }
  };

  // Helper for severity badge colors
  const getSeverityColor = (severity?: string) => {
    const s = (severity || "").toLowerCase();
    if (s.includes("severe") || s.includes("high")) {
      return { bg: "bg-rose-500", text: "text-rose-700", border: "border-rose-150", label: "Severe" };
    } else if (s.includes("moderate") || s.includes("medium")) {
      return { bg: "bg-amber-500", text: "text-amber-700", border: "border-amber-155", label: "Moderate" };
    } else if (s.includes("mild") || s.includes("low")) {
      return { bg: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-150", label: "Mild" };
    } else {
      return { bg: "bg-slate-400", text: "text-slate-600", border: "border-slate-150", label: severity || "Unknown" };
    }
  };

  // Helper for resolving medication client name
  const getMedicationName = (medRequest: any): string => {
    if (medRequest.medicationCodeableConcept) {
      return medRequest.medicationCodeableConcept.coding?.[0]?.display || medRequest.medicationCodeableConcept.text || "Unknown Medication";
    }
    if (medRequest.medicationReference) {
      return medRequest.medicationReference.display || `Medication Ref (${medRequest.medicationReference.reference || "Unknown"})`;
    }
    return "Unknown Medication";
  };

  // Helper for resolving prescriber name
  const getPrescriberName = (medRequest: any): string => {
    if (medRequest.requester) {
      return medRequest.requester.display || medRequest.requester.reference || "Unknown Prescriber";
    }
    return "Unknown Prescriber";
  };

  const getConditionYear = (item: any): string => {
    const onset = item.onsetDateTime || item.onsetPeriod?.start || item.recordedDate || "";
    if (!onset) return "Unknown";
    try {
      const d = new Date(onset);
      if (!isNaN(d.getTime())) {
        return d.getFullYear().toString();
      }
    } catch {}
    const match = onset.match(/^\d{4}/);
    return match ? match[0] : "Unknown";
  };

  const getTimelineDateRange = (item: any): string => {
    const onset = item.onsetDateTime || item.onsetPeriod?.start || item.recordedDate;
    const abatement = item.abatementDateTime || item.abatementPeriod?.end || item.abatementString;
    const hasAbatement = !!abatement || item.abatementBoolean === true;

    const formattedOnset = onset ? formatDate(onset.split("T")[0]) : "Unknown Onset";

    if (hasAbatement) {
      const formattedAbatement = (typeof abatement === "string" && !abatement.includes("-"))
        ? abatement
        : (abatement ? formatDate(abatement.split("T")[0]) : "Resolved");
      return `${formattedOnset} — ${formattedAbatement}`;
    }

    const status = (item.clinicalStatus?.coding?.[0]?.code || item.clinicalStatus?.text || "active").toLowerCase();
    if (status === "active") {
      return `${formattedOnset} — Present`;
    } else if (status === "resolved") {
      return `${formattedOnset} — Resolved`;
    } else {
      return formattedOnset;
    }
  };

  const parseVitalsData = (obsList: any[]) => {
    const systolicPoints: any[] = [];
    const diastolicPoints: any[] = [];
    const hrPoints: any[] = [];
    const heightPoints: any[] = [];
    const weightPoints: any[] = [];
    const bmiPoints: any[] = [];
    const spo2Points: any[] = [];
    const tempPoints: any[] = [];

    obsList.forEach((obs: any) => {
      const dateStr = obs.effectiveDateTime || obs.effectivePeriod?.start || "";
      if (!dateStr) return;
      const timestamp = new Date(dateStr).getTime();
      if (isNaN(timestamp)) return;

      const addPoint = (code: string, val: number, unit: string) => {
        const point = { value: val, unit: unit || "", dateStr, timestamp };
        if (code === "8480-6") systolicPoints.push(point);
        if (code === "8462-4") diastolicPoints.push(point);
        if (code === "8867-4") hrPoints.push(point);
        if (code === "8302-2") heightPoints.push(point);
        if (code === "29463-7") weightPoints.push(point);
        if (code === "39156-5") bmiPoints.push(point);
        if (code === "59408-5") spo2Points.push(point);
        if (code === "8310-5") tempPoints.push(point);
      };

      // Main code
      const mainCodings = obs.code?.coding || [];
      const obsValue = obs.valueQuantity?.value;
      const obsUnit = obs.valueQuantity?.unit;
      if (obsValue !== undefined) {
        mainCodings.forEach((c: any) => {
          if (c.code) addPoint(c.code, Number(obsValue), obsUnit || "");
        });
      }

      // Also support components for compound observations (such as Systolic / Diastolic BP)
      const components = obs.component || [];
      components.forEach((comp: any) => {
        const compCodings = comp.code?.coding || [];
        const compValue = comp.valueQuantity?.value;
        const compUnit = comp.valueQuantity?.unit;
        if (compValue !== undefined) {
          compCodings.forEach((c: any) => {
            if (c.code) addPoint(c.code, Number(compValue), compUnit || "");
          });
        }
      });
    });

    const sortAsc = (arr: any[]) => arr.sort((a, b) => a.timestamp - b.timestamp);

    return {
      systolic: sortAsc(systolicPoints),
      diastolic: sortAsc(diastolicPoints),
      heartRate: sortAsc(hrPoints),
      height: sortAsc(heightPoints),
      weight: sortAsc(weightPoints),
      bmi: sortAsc(bmiPoints),
      spo2: sortAsc(spo2Points),
      temp: sortAsc(tempPoints),
    };
  };

  const getTrendElement = (arr: any[]) => {
    if (arr.length < 2) return { arrow: "→", color: "text-slate-400" };
    const latest = arr[arr.length - 1].value;
    const previous = arr[arr.length - 2].value;
    if (latest > previous) return { arrow: "↑", color: "text-rose-500 font-bold" };
    if (latest < previous) return { arrow: "↓", color: "text-blue-500 font-bold" };
    return { arrow: "→", color: "text-slate-400 font-bold" };
  };

  const fetchConditions = async () => {
    if (!id) return;
    setConditionsLoading(true);
    setConditionsError(null);
    try {
      const response = await fhirClient.request(`Condition?patient=${id}&clinical-status=active&_count=100`);
      const list = response.entry?.map((e: any) => e.resource).filter((r: any) => r && r.resourceType === "Condition") || [];
      setConditions(list);
    } catch (err: any) {
      console.error(err);
      setConditionsError(err.message || "Failed to locate active Patient condition entries.");
    } finally {
      setConditionsLoading(false);
    }
  };

  const fetchMedications = async () => {
    if (!id) return;
    setMedicationsLoading(true);
    setMedicationsError(null);
    try {
      const response = await fhirClient.request(`MedicationRequest?patient=${id}&status=active&_count=100`);
      const list = response.entry?.map((e: any) => e.resource).filter((r: any) => r && r.resourceType === "MedicationRequest") || [];
      setMedications(list);
    } catch (err: any) {
      console.error(err);
      setMedicationsError(err.message || "Failed to locate active Patient Medication prescription entries.");
    } finally {
      setMedicationsLoading(false);
    }
  };

  const fetchVitals = async () => {
    if (!id) return;
    setVitalsLoading(true);
    setVitalsError(null);
    try {
      const response = await fhirClient.request(`Observation?patient=${id}&category=vital-signs&_count=200&_sort=-date`);
      const list = response.entry?.map((e: any) => e.resource).filter((r: any) => r && r.resourceType === "Observation") || [];
      setVitals(list);
    } catch (err: any) {
      console.error(err);
      setVitalsError(err.message || "Failed to locate Patient vital signs.");
    } finally {
      setVitalsLoading(false);
    }
  };

  // Fetch Patient from standard FHIR client proxy routing
  const loadPatientData = async () => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);
    setIsLoading(true);
    try {
      const p = await fhirClient.getPatient(id);
      setPatient(p);
    } catch (err: any) {
      console.error(err);
      setFetchError(err.message || "Failed to locate Patient detail record inside active HL7 FHIR repositories.");
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  const fetchAllergies = async () => {
    if (!id) return;
    setAllergiesLoading(true);
    setAllergiesError(null);
    try {
      const response = await fhirClient.request(`AllergyIntolerance?patient=${id}&_count=100`);
      const list = response.entry?.map((e: any) => e.resource).filter((r: any) => r && r.resourceType === "AllergyIntolerance") || [];
      setAllergies(list);
    } catch (err: any) {
      console.error(err);
      setAllergiesError(err.message || "Failed to locate Patient allergy intolerance entries.");
    } finally {
      setAllergiesLoading(false);
    }
  };

  const fetchAllConditions = async () => {
    if (!id) return;
    setAllConditionsLoading(true);
    setAllConditionsError(null);
    try {
      const response = await fhirClient.request(`Condition?patient=${id}&_count=200`);
      const list = response.entry?.map((e: any) => e.resource).filter((r: any) => r && r.resourceType === "Condition") || [];
      setAllConditions(list);
    } catch (err: any) {
      console.error(err);
      setAllConditionsError(err.message || "Failed to locate Patient clinical history condition entries.");
    } finally {
      setAllConditionsLoading(false);
    }
  };

  useEffect(() => {
    loadPatientData();
    fetchConditions();
    fetchMedications();
    fetchVitals();
    fetchAllergies();
    fetchAllConditions();
  }, [id]);

  // Loading skeleton layout with beautiful UI pulses
  if (loading) {
    return (
      <div id="patient-details-skeleton" className="space-y-6 animate-pulse">
        {/* Back Link and Header */}
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-slate-200"></div>
          <div className="space-y-2">
            <div className="w-32 h-5 bg-slate-200 rounded"></div>
            <div className="w-48 h-3 bg-slate-200 rounded"></div>
          </div>
        </div>

        {/* Profile Card Skeleton */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-200"></div>
              <div className="space-y-2">
                <div className="w-48 h-6 bg-slate-200 rounded animate-pulse"></div>
                <div className="flex gap-2">
                  <div className="w-16 h-4 bg-slate-200 rounded"></div>
                  <div className="w-16 h-4 bg-slate-200 rounded"></div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-24 h-9 bg-slate-200 rounded-lg"></div>
              <div className="w-36 h-9 bg-[#e0f1f1] rounded-lg"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="w-20 h-3 bg-slate-200 rounded"></div>
                <div className="w-36 h-4 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-4 border-b border-slate-200 pb-px">
          <div className="w-24 h-8 bg-slate-200 rounded-t-lg"></div>
          <div className="w-24 h-8 bg-slate-200 rounded-t-lg"></div>
        </div>

        {/* Content Skeleton */}
        <div className="h-48 bg-white border border-slate-200 rounded-xl"></div>
      </div>
    );
  }

  // Error block handling with unified try-again trigger
  if (fetchError || !patient) {
    return (
      <div id="patient-details-error-panel" className="max-w-xl mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-rose-50 border border-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <ShieldAlert className="w-8 h-8 text-rose-500 animate-bounce" />
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-extrabold text-[#0F2B5B] font-sans">
            Diagnostic Payload Disconnected
          </h2>
          <p className="text-xs text-rose-700 font-medium leading-relaxed max-w-sm mx-auto">
            {fetchError || "The requested clinical record details could not be found or processed."}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            to="/patients"
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            Back to Registry
          </Link>
          <button
            id="retry-details-fetch-btn"
            onClick={loadPatientData}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0EA5A0] hover:bg-[#0EA5A0]/90 text-white text-xs font-semibold rounded-lg transition shadow-md cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const patientFullName = getPatientFullName(patient);
  const patientInitials = getInitials(patient);
  const avatarBgColor = getHashColor(patient.id || "unknown");

  // Extract phone, email, and address lines safely for display
  let phone = "---";
  let email = "---";
  if (Array.isArray(patient.telecom)) {
    const phoneItem = patient.telecom.find((t: any) => t.system === "phone");
    if (phoneItem) phone = phoneItem.value || "---";

    const emailItem = patient.telecom.find((t: any) => t.system === "email");
    if (emailItem) email = emailItem.value || "---";
  }

  let fullAddress = "---";
  if (Array.isArray(patient.address) && patient.address.length > 0) {
    const addr = patient.address[0];
    const lines = Array.isArray(addr.line) ? addr.line.join(", ") : "";
    const parts = [
      lines,
      addr.city,
      addr.state,
      addr.postalCode,
      addr.country
    ].filter(Boolean);
    if (parts.length > 0) fullAddress = parts.join(", ");
  }

  return (
    <div className="space-y-6">
      
      {/* Dynamic back chevron header */}
      <div className="flex items-center gap-2">
        <Link 
          id="patient-back-to-registry"
          to="/patients"
          className="p-1 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 transition mr-2"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-navy-primary tracking-tight font-sans">
            {patientFullName}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered Cohort Dossier | Reference ID: <strong className="font-mono text-[11px] text-[#0EA5A0] select-all">{patient.id}</strong>
          </p>
        </div>
      </div>

      {/* Profile card section */}
      <div id="patient-profile-top-card" className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          
          <div className="flex items-center gap-4">
            {/* Hash calculated initials circle */}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center font-extrabold text-xl font-sans tracking-wide shrink-0 ${avatarBgColor}`}>
              {patientInitials}
            </div>
            
            <div className="space-y-1">
              <h2 className="text-lg font-black text-[#0F2B5B] tracking-tight font-sans">
                {patientFullName}
              </h2>
              <div className="flex flex-wrap gap-2 pt-0.5">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-150">
                  <User className="w-3 h-3 mr-1" />
                  {capitalizeGender(patient.gender)}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#e6f4f3] text-[#0EA5A0] border border-teal-150">
                  <Calendar className="w-3 h-3 mr-1" />
                  {patient.birthDate ? `${calculateAge(patient.birthDate)} years old` : "Age Unknown"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              id="patient-edit-detail-btn"
              to={`/patients/${patient.id}/edit`}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit Patient
            </Link>
            <Link
              id="patient-trials-matches-btn"
              to={`/patients/${patient.id}/trials`}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#0EA5A0] hover:bg-[#0EA5A0]/90 text-white text-xs font-bold rounded-lg transition shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5 mr-0.5" />
              View Trial Matches
            </Link>
          </div>

        </div>

        {/* Clean four-column patient info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-5 border-t border-slate-100">
          
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Date of Birth
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-755 font-semibold">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{formatDate(patient.birthDate)}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Phone Number
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-755 font-semibold">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="select-all">{phone}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Email Address
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-755 font-semibold">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="select-all break-all">{email}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Residential Address
            </span>
            <div className="flex items-start gap-1.5 text-xs text-slate-755 font-semibold">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="leading-tight">{fullAddress}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Tabs Selector Navigation */}
      <div id="patient-profile-tabs-selector" className="flex border-b border-slate-200">
        <button
          id="tab-overview"
          onClick={() => setActiveTab("overview")}
          className={`py-2 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition select-none flex items-center gap-1.5 ${
            activeTab === "overview"
              ? "border-[#0EA5A0] text-[#0F2B5B]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Activity className="w-4 h-4" />
          Overview
        </button>
        <button
          id="tab-trials"
          onClick={() => setActiveTab("trials")}
          className={`py-2 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition select-none flex items-center gap-1.5 ${
            activeTab === "trials"
              ? "border-[#0EA5A0] text-[#0F2B5B]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Trial Matches
        </button>
      </div>

      {/* Tab Panels */}
      <div id="patient-profile-tabs-content" className="pt-2">
        {activeTab === "overview" ? (
          <div id="overview-tab-content" className="space-y-6">
            
            {/* 1. Allergies Section */}
            <div id="allergies-panel-section" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-1.5">
                  <div className="p-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0F2B5B] uppercase tracking-wider font-sans">Patient Drug & Substance Allergies</h4>
                    <p className="text-[10px] text-slate-400 font-mono">LOINC Intolerance sync stream</p>
                  </div>
                </div>
                {!allergiesLoading && !allergiesError && allergies.length > 0 && (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-black rounded-full border border-rose-150 uppercase tracking-wider">
                    {allergies.length} Recorded Intolerances
                  </span>
                )}
              </div>

              {allergiesLoading ? (
                <div className="flex flex-wrap gap-2 py-1 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-7 w-28 bg-slate-100 rounded-full"></div>
                  ))}
                </div>
              ) : allergiesError ? (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <span>{allergiesError}</span>
                  </div>
                  <button
                    onClick={fetchAllergies}
                    className="flex items-center gap-1 px-2 py-1 bg-[#0EA5A0] hover:bg-[#0EA5A0]/90 text-white rounded text-[10px] font-bold uppercase transition focus:outline-none"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              ) : allergies.length === 0 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-xs uppercase tracking-wider rounded-xl border border-emerald-205 shadow-xs animate-fadeIn select-none">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  NKDA (No Known Drug Allergies)
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5 animate-fadeIn">
                  {allergies.map((item, idx) => {
                    const substance = item.code?.coding?.[0]?.display || item.code?.text || "Unknown Substance";
                    const status = item.clinicalStatus?.coding?.[0]?.code || item.clinicalStatus?.text || "active";
                    const criticality = item.criticality || ""; // high, low, unable-to-assess
                    
                    let critBadgeColor = "bg-slate-105 text-slate-705 border-slate-205";
                    if (criticality === "high") {
                      critBadgeColor = "bg-rose-101 text-rose-800 border-rose-300 font-extrabold";
                    } else if (criticality === "low") {
                      critBadgeColor = "bg-amber-101 text-amber-800 border-amber-300 font-extrabold";
                    } else if (criticality === "unable-to-assess") {
                      critBadgeColor = "bg-slate-201 text-slate-600 border-slate-300";
                    }

                    const reaction = item.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || item.reaction?.[0]?.manifestation?.[0]?.text || "";

                    return (
                      <div 
                        key={item.id || idx} 
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-slate-805 transition duration-155 shadow-xs"
                      >
                        <div className="font-extrabold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          <span>{substance}</span>
                          <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">({status})</span>
                        </div>
                        {reaction && (
                          <span className="text-[10px] text-slate-505 border-l border-slate-200 pl-2">
                            Reaction: <span className="font-semibold italic">{reaction}</span>
                          </span>
                        )}
                        {criticality && (
                          <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold border ${critBadgeColor}`}>
                            {criticality}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Vitals Grid Section */}
            <div id="vitals-panel-section" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-1.5">
                  <div className="p-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg">
                    <Heart className="w-4 h-4 text-rose-505 animate-pulse" />
                  </div>
                  <h4 className="text-xs font-bold text-[#0F2B5B] uppercase tracking-wider font-sans">Patient Vital Signs Telemetry</h4>
                </div>
                {!vitalsLoading && !vitalsError && vitals.length > 0 && (
                  <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-black rounded-full border border-rose-150 uppercase tracking-wider">
                    LOINC Registered Sync
                  </span>
                )}
              </div>

              {vitalsLoading ? (
                <div id="vitals-loading-skeleton" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                  {[...Array(7)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`bg-slate-50 border border-slate-150 rounded-xl p-4 h-36 flex flex-col justify-between ${
                        i === 0 ? "md:col-span-2 lg:col-span-2" : ""
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                          <div className="h-4 bg-slate-200 rounded w-8"></div>
                        </div>
                        <div className="h-5 bg-slate-200 rounded w-1/2"></div>
                        <div className="h-2.5 bg-slate-105 rounded w-1/4"></div>
                      </div>
                      <div className="h-8 bg-slate-101/80 rounded w-full mt-2"></div>
                    </div>
                  ))}
                </div>
              ) : vitalsError ? (
                <div id="vitals-error-banner" className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl text-rose-800 text-xs flex flex-col items-center justify-center space-y-3 py-10 animate-fadeIn">
                  <div className="flex items-start gap-2.5 max-w-xl mx-auto">
                    <AlertCircle className="w-5 h-5 text-rose-505 shrink-0 mt-0.5" />
                    <span className="font-semibold leading-relaxed text-left">{vitalsError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchVitals}
                    className="flex items-center justify-center gap-1.5 py-2 px-4 bg-[#0EA5A0] hover:bg-[#0EA5A0]/95 text-white rounded-lg font-bold uppercase tracking-wider text-[11px] transition shadow-xs cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Sync
                  </button>
                </div>
              ) : (
                (() => {
                  const parsed = parseVitalsData(vitals);
                  
                  // BP details
                  const sysLen = parsed.systolic.length;
                  const diaLen = parsed.diastolic.length;
                  const sysLatest = parsed.systolic[sysLen - 1];
                  const diaLatest = parsed.diastolic[diaLen - 1];
                  const bpHasData = sysLen > 0 || diaLen > 0;
                  const bpLatestDate = sysLatest ? sysLatest.dateStr : (diaLatest ? diaLatest.dateStr : null);

                  const bpSparklineData = [];
                  if (bpHasData) {
                    const maxLen = Math.max(sysLen, diaLen);
                    const count = Math.min(10, maxLen);
                    for (let i = maxLen - count; i < maxLen; i++) {
                      const sysR = parsed.systolic[i] || null;
                      const diaR = parsed.diastolic[i] || null;
                      bpSparklineData.push({
                        index: i,
                        systolic: sysR ? sysR.value : null,
                        diastolic: diaR ? diaR.value : null,
                      });
                    }
                  }

                  const bpTrend = getTrendElement(parsed.systolic);

                  // Generic Configured Vitals
                  const genericVitals = [
                    {
                      id: "vitals-card-hr",
                      title: "Heart Rate",
                      data: parsed.heartRate,
                      fallbackUnit: "bpm",
                    },
                    {
                      id: "vitals-card-spo2",
                      title: "Oxygen Saturation (SpO2)",
                      data: parsed.spo2,
                      fallbackUnit: "%",
                    },
                    {
                      id: "vitals-card-temp",
                      title: "Body Temperature",
                      data: parsed.temp,
                      fallbackUnit: "°F",
                    },
                    {
                      id: "vitals-card-weight",
                      title: "Body Weight",
                      data: parsed.weight,
                      fallbackUnit: "kg",
                    },
                    {
                      id: "vitals-card-height",
                      title: "Body Height",
                      data: parsed.height,
                      fallbackUnit: "cm",
                    },
                    {
                      id: "vitals-card-bmi",
                      title: "Body Mass Index (BMI)",
                      data: parsed.bmi,
                      fallbackUnit: "kg/m²",
                    },
                  ];

                  return (
                    <div id="vitals-metric-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      {/* Blood Pressure Card */}
                      <div id="vitals-card-bp" className={`bg-white border rounded-xl p-4 shadow-xs flex flex-col justify-between h-36 md:col-span-2 lg:col-span-2 ${
                        !bpHasData ? "border-slate-150 bg-slate-50/30 opacity-70" : "border-slate-200"
                      }`}>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold text-[#0C1B33] uppercase tracking-wider">
                              Blood Pressure
                            </span>
                            {bpHasData && (
                              <div className="flex items-center gap-1">
                                <span className={`text-[#0EA5A0] ${bpTrend.color}`}>{bpTrend.arrow}</span>
                                <span className="text-[9px] text-[#0EA5A0] font-black uppercase font-mono tracking-wider ml-1">
                                  {bpTrend.arrow === "↑" ? "RISING" : bpTrend.arrow === "↓" ? "DECREASING" : "STABLE"}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className={`text-xl font-black ${!bpHasData ? "text-slate-401" : "text-slate-805"}`}>
                              {bpHasData 
                                ? `${sysLatest?.value ?? "--"}/${diaLatest?.value ?? "--"}`
                                : "No data"
                              }
                            </span>
                            {bpHasData && (
                              <span className="text-[10px] font-bold text-slate-405 uppercase font-mono">
                                {sysLatest?.unit || "mmHg"}
                              </span>
                            )}
                          </div>

                          <div className="text-[9px] text-slate-400 font-semibold mt-0.5">
                            {bpHasData && bpLatestDate ? `Latest: ${formatDate(bpLatestDate)}` : "No historical sync"}
                          </div>
                        </div>

                        {bpHasData && bpSparklineData.length > 0 ? (
                          <div className="h-10 w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={bpSparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                                <YAxis hide domain={['auto', 'auto']} />
                                <Line 
                                  type="monotone" 
                                  dataKey="systolic" 
                                  stroke="#0EA5A0" 
                                  strokeWidth={1.8} 
                                  dot={false}
                                  isAnimationActive={false}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="diastolic" 
                                  stroke="#2DD4BF" 
                                  strokeWidth={1.2} 
                                  strokeDasharray="2 2"
                                  dot={false}
                                  isAnimationActive={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-10 flex items-center justify-center border-t border-dashed border-slate-100 mt-2">
                            <span className="text-[9px] font-mono text-slate-305 font-bold uppercase tracking-widest select-none">No history recorded</span>
                          </div>
                        )}
                      </div>

                      {/* Generic Cards looped */}
                      {genericVitals.map((card) => {
                        const hasData = card.data.length > 0;
                        const latest = card.data[card.data.length - 1];
                        const trend = getTrendElement(card.data);
                        const sparklineData = card.data.slice(-10).map((pt, i) => ({
                          index: i,
                          value: pt.value,
                        }));

                        return (
                          <div 
                            key={card.id} 
                            id={card.id} 
                            className={`bg-white border rounded-xl p-4 shadow-xs flex flex-col justify-between h-36 ${
                              !hasData ? "border-slate-150 bg-slate-50/30 opacity-70" : "border-slate-200"
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider truncate max-w-[80%]">
                                  {card.title}
                                </span>
                                {hasData && (
                                  <div className="flex items-center gap-0.5">
                                    <span className={`text-[11px] ${trend.color}`}>{trend.arrow}</span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-baseline gap-1 mt-1">
                                <span className={`text-xl font-black ${!hasData ? "text-slate-401" : "text-slate-805"}`}>
                                  {hasData ? latest.value : "No data"}
                                </span>
                                {hasData && (
                                  <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">
                                    {latest.unit || card.fallbackUnit}
                                  </span>
                                )}
                              </div>

                              <div className="text-[9px] text-slate-400 font-semibold mt-0.5">
                                {hasData && latest.dateStr ? `Latest: ${formatDate(latest.dateStr)}` : "No historical sync"}
                              </div>
                            </div>

                            {hasData && sparklineData.length > 0 ? (
                              <div className="h-10 w-full mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={sparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                                    <YAxis hide domain={['auto', 'auto']} />
                                    <Line 
                                      type="monotone" 
                                      dataKey="value" 
                                      stroke="#0EA5A0" 
                                      strokeWidth={1.5} 
                                      dot={false}
                                      isAnimationActive={false}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="h-10 flex items-center justify-center border-t border-dashed border-slate-100 mt-2">
                                <span className="text-[9px] font-mono text-slate-300 font-bold uppercase tracking-widest select-none">No history recorded</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                    </div>
                  );
                })()
              )}

              <div className="text-[9px] text-slate-455 font-mono flex items-center gap-1 border-t border-slate-100 pt-3 mt-2 shrink-0">
                <Lock className="w-3 h-3 text-slate-400" /> Authorized clinical sync with standard FHIR structures
              </div>
            </div>

            {/* In-house health summaries grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Conditions Card */}
              <div id="overview-card-conditions" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between min-h-[22rem]">
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1.5 bg-indigo-50/60 text-indigo-600 border border-indigo-100 rounded-lg">
                        <Clipboard className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-navy-primary uppercase tracking-wider">Conditions</h4>
                    </div>
                    {!conditionsLoading && !conditionsError && conditions.length > 0 && (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-full border border-indigo-150">
                        {conditions.length} Active
                      </span>
                    )}
                  </div>

                  {conditionsLoading ? (
                    <div className="space-y-3 py-2 animate-pulse flex-1">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-start gap-2 pb-2 border-b border-slate-50 last:border-0">
                          <div className="w-2 h-2 rounded-full bg-slate-200 mt-1.5 shrink-0"></div>
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-slate-100 rounded w-4/5"></div>
                            <div className="h-2.5 bg-slate-100 rounded w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : conditionsError ? (
                    <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-lg text-rose-800 text-[11px] space-y-2 my-2 flex-1 flex flex-col justify-center animate-fadeIn">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span className="font-semibold leading-relaxed line-clamp-3">{conditionsError}</span>
                      </div>
                      <button
                        type="button"
                        id="retry-conditions-btn"
                        onClick={fetchConditions}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#0EA5A0] hover:bg-[#0EA5A0]/95 text-white rounded-lg font-bold uppercase tracking-wider text-[10px] transition cursor-pointer self-start shadow-xs"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    </div>
                  ) : conditions.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-6 text-center space-y-2">
                      <Clipboard className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">No active conditions on record</span>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1 flex-1">
                      {conditions.map((item, idx) => {
                        const displayName = item.code?.coding?.[0]?.display || item.code?.text || "Unknown Condition";
                        const status = item.clinicalStatus?.coding?.[0]?.code || "active";
                        const onsetStr = formatOnset(item.onsetDateTime);
                        const severityText = item.severity?.coding?.[0]?.display || "";
                        const sev = getSeverityColor(severityText);
                        
                        return (
                          <div key={item.id || idx} className="flex items-start gap-2 text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${sev.bg}`} title={`Severity: ${sev.label}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-800 truncate block" title={displayName}>
                                  {displayName}
                                </span>
                                {severityText && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${sev.bg}/15 ${sev.text} border ${sev.border} shrink-0`}>
                                    {sev.label}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span className="font-mono text-slate-500">{status}</span>
                                <span>•</span>
                                <span>{onsetStr}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1 border-t border-slate-100 pt-3 mt-2 shrink-0">
                  <Lock className="w-3 h-3 text-slate-400" /> Authorized clinical sync
                </div>
              </div>

              {/* Medications Card */}
              <div id="overview-card-medications" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between min-h-[22rem]">
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1.5 bg-purple-50/60 text-purple-600 border border-purple-100 rounded-lg">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-navy-primary uppercase tracking-wider">Medications</h4>
                    </div>
                    {!medicationsLoading && !medicationsError && medications.length > 0 && (
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-black rounded-full border border-purple-150">
                        {medications.length} Prescribed
                      </span>
                    )}
                  </div>

                  {medicationsLoading ? (
                    <div className="space-y-3 py-2 animate-pulse flex-1">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="p-2.5 bg-slate-50/50 border border-slate-150 rounded-lg space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="h-3 bg-slate-200 rounded w-3/5"></div>
                            <div className="h-4 bg-slate-200 rounded w-12"></div>
                          </div>
                          <div className="h-2.5 bg-slate-150 rounded w-4/5"></div>
                          <div className="h-2 bg-slate-100 rounded w-1/3"></div>
                        </div>
                      ))}
                    </div>
                  ) : medicationsError ? (
                    <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-lg text-rose-800 text-[11px] space-y-2 my-2 flex-1 flex flex-col justify-center animate-fadeIn">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span className="font-semibold leading-relaxed line-clamp-3">{medicationsError}</span>
                      </div>
                      <button
                        type="button"
                        id="retry-medications-btn"
                        onClick={fetchMedications}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#0EA5A0] hover:bg-[#0EA5A0]/95 text-white rounded-lg font-bold uppercase tracking-wider text-[10px] transition cursor-pointer self-start shadow-xs"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    </div>
                  ) : medications.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-6 text-center space-y-2">
                      <Activity className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">No active medications on record</span>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1 flex-1">
                      {medications.map((item, idx) => {
                        const drugName = getMedicationName(item);
                        const dosage = item.dosageInstruction?.[0]?.text || "No dosage instructions noted";
                        const status = item.status || "active";
                        const prescriber = getPrescriberName(item);
                        
                        return (
                          <div key={item.id || idx} className="p-2.5 bg-slate-50 border border-slate-150 rounded-lg flex flex-col justify-between gap-1">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-extrabold text-slate-805 text-xs tracking-tight line-clamp-2" title={drugName}>
                                {drugName}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-150 shrink-0 select-none">
                                {status}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-semibold line-clamp-1" title={dosage}>
                              Dosage: {dosage}
                            </p>
                            <p className="text-[9px] font-mono text-slate-400 mt-0.5">
                              Prescriber: {prescriber}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1 border-t border-slate-100 pt-3 mt-2 shrink-0">
                  <Lock className="w-3 h-3 text-slate-400" /> Authorized clinical sync
                </div>
              </div>
            </div>

            {/* 4. Medical History Timeline */}
            <div id="medical-history-timeline-section" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-1.5">
                  <div className="p-1.5 bg-slate-50 text-slate-650 border border-slate-200 rounded-lg">
                    <Calendar className="w-4 h-4 text-slate-500" />
                  </div>
                  <h4 className="text-xs font-bold text-[#0F2B5B] uppercase tracking-wider font-sans">Medical History Timeline</h4>
                </div>
                {!allConditionsLoading && !allConditionsError && allConditions.length > 0 && (
                  <span className="px-2.5 py-0.5 bg-slate-50 text-slate-650 text-[10px] font-bold rounded-full border border-slate-150 uppercase tracking-wider">
                    {allConditions.length} Total Conditions
                  </span>
                )}
              </div>

              {allConditionsLoading ? (
                <div className="space-y-6 py-4 animate-pulse">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-12 h-4 bg-slate-200 rounded"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-200 mt-1.5 shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                        <div className="h-3 bg-slate-100 rounded w-1/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : allConditionsError ? (
                <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl text-rose-805 text-xs flex flex-col items-center justify-center space-y-3 py-10 animate-fadeIn font-extrabold">
                  <div className="flex items-start gap-2.5 max-w-xl mx-auto">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <span className="font-semibold leading-relaxed text-left">{allConditionsError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchAllConditions}
                    className="flex items-center justify-center gap-1.5 py-2 px-4 bg-[#0EA5A0] hover:bg-[#0EA5A0]/95 text-white rounded-lg font-bold uppercase tracking-wider text-[11px] transition shadow-xs cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Timeline Sync
                  </button>
                </div>
              ) : allConditions.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg bg-slate-50/30">
                  <Activity className="w-8 h-8 text-slate-350 mx-auto mb-2 stroke-[1.5]" />
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">No condition history recorded</span>
                </div>
              ) : (
                (() => {
                  const sorted = [...allConditions].sort((a: any, b: any) => {
                    const dateA = a.onsetDateTime || a.onsetPeriod?.start || a.recordedDate || "";
                    const dateB = b.onsetDateTime || b.onsetPeriod?.start || b.recordedDate || "";
                    if (!dateA) return 1;
                    if (!dateB) return -1;
                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                  });

                  let targetCurrentYear = "";

                  return (
                    <div className="relative pl-2 sm:pl-4 space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[4.5rem] sm:before:left-[5.5rem] before:w-0.5 before:bg-slate-150">
                      {sorted.map((item: any, idx: number) => {
                        const year = getConditionYear(item);
                        const showYear = year !== targetCurrentYear;
                        if (showYear) {
                          targetCurrentYear = year;
                        }

                        const name = item.code?.coding?.[0]?.display || item.code?.text || "Unknown Condition";
                        const status = (item.clinicalStatus?.coding?.[0]?.code || item.clinicalStatus?.text || "active").toLowerCase();
                        
                        let dotColor = "bg-slate-400";
                        if (status === "active") {
                          dotColor = "bg-[#0EA5A0]";
                        } else if (status === "resolved") {
                          dotColor = "bg-slate-400";
                        } else if (status === "inactive") {
                          dotColor = "bg-amber-500";
                        }

                        const statusBadgeStyles = 
                          status === "active" ? "bg-teal-50 text-teal-700 border-teal-150" :
                          status === "resolved" ? "bg-slate-50 text-slate-600 border-slate-150" :
                          status === "inactive" ? "bg-amber-50 text-amber-700 border-amber-155" :
                          "bg-slate-100 text-slate-600 border-slate-200";

                        const range = getTimelineDateRange(item);

                        return (
                          <div key={item.id || idx} className="flex gap-4 items-start relative group">
                            <div className="w-14 sm:w-18 shrink-0 text-right pr-2 select-none">
                              {showYear ? (
                                <span className="text-xs font-black text-slate-805 font-mono bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                  {year}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-300 font-mono">
                                  —
                                </span>
                              )}
                            </div>

                            <div className="relative z-10 flex items-center justify-center w-5 h-5 shrink-0">
                              <span className={`w-3 h-3 rounded-full border-2 border-white ring-2 ring-transparent group-hover:scale-125 transition ${dotColor}`} />
                            </div>

                            <div className="flex-1 min-w-0 bg-slate-50/50 hover:bg-slate-50 border border-slate-150/60 p-3.5 rounded-xl transition shadow-xs">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1 bg-transparent">
                                <h5 className="font-extrabold text-xs text-slate-800 tracking-tight truncate" title={name}>
                                  {name}
                                </h5>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0 select-none ${statusBadgeStyles}`}>
                                  {status}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tight block">
                                Range: {range}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}

              <div className="text-[9px] text-[#0ea5a0] font-mono flex items-center gap-1 border-t border-slate-100 pt-3 mt-2 shrink-0 select-none">
                <Lock className="w-3 h-3 text-slate-300" /> Standardized SNOMED/LOINC mapping timeline sync
              </div>
            </div>

          </div>
        ) : (
          <div id="trials-tab-content" className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4 shadow-sm min-h-[280px] flex flex-col items-center justify-center">
            
            <div className="w-14 h-14 bg-[#e0f1f1] border border-[#aee1df] text-[#0EA5A0] rounded-full flex items-center justify-center shadow-xs">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-sm font-extrabold text-[#0F2B5B] uppercase tracking-wider font-sans">
                AI-Powered Trial Matching Coming Soon
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Our validated clinical trial search engine operates in the next stage. Demographics and health factors will match seamlessly against the active index.
              </p>
            </div>
            
            <div className="pt-2">
              <span className="p-1 px-3 bg-[#e6f4f3] text-[#0EA5A0] font-black text-[9px] tracking-widest uppercase rounded border border-teal-150">
                TrialBridge AI Gateways
              </span>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

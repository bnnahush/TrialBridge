import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { 
  Users, Search, UserPlus, Edit, RefreshCw, AlertCircle, 
  ChevronLeft, ChevronRight, ArrowUpDown, Eye, Trash2, PlusCircle, ShieldAlert,
  SlidersHorizontal, Bookmark, Save, Check, X
} from "lucide-react";
import { fhirClient } from "../fhirClient";
import { FHIRBundle, PatientSummary } from "../types";
import { useApp } from "../context/AppContext";

export interface SavedCohort {
  id: string;
  name: string;
  gender?: string;
  age?: string;
  condition?: string;
  medication?: string;
  vital?: string;
  createdAt: string;
}

export const PatientsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setIsLoading, setSuccess, setError } = useApp();

  const [searchParams] = useSearchParams();
  const genderParam = searchParams.get("gender");
  const conditionParam = searchParams.get("condition");
  const medicationParam = searchParams.get("medication");
  const ageParam = searchParams.get("age");
  const vitalParam = searchParams.get("vital");

  // State managers
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search input state
  const [searchInput, setSearchInput] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [isSearchingSpinner, setIsSearchingSpinner] = useState(false);

  // Client-side Sorting states
  const [sortField, setSortField] = useState<"name" | "dob" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Server-side links for overflow pagination (if returned by Bundle)
  const [nextServerPageUrl, setNextServerPageUrl] = useState<string | null>(null);
  const [prevServerPageUrl, setPrevServerPageUrl] = useState<string | null>(null);

  // Show manual filter controls state
  const [showFilters, setShowFilters] = useState(false);

  // Saved Cohorts list state
  const [savedCohorts, setSavedCohorts] = useState<SavedCohort[]>(() => {
    try {
      const stored = localStorage.getItem("fhir-saved-cohorts");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // State for cohort saving & renaming
  const [cohortNameInput, setCohortNameInput] = useState("");
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);
  const [editingCohortName, setEditingCohortName] = useState("");

  const saveCurrentCohort = () => {
    if (!cohortNameInput.trim()) {
      setError?.("Please specify a description or title for this clinical cohort.");
      return;
    }
    const newCohort: SavedCohort = {
      id: Date.now().toString(),
      name: cohortNameInput.trim(),
      gender: genderParam || undefined,
      age: ageParam || undefined,
      condition: conditionParam || undefined,
      medication: medicationParam || undefined,
      vital: vitalParam || undefined,
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedCohorts, newCohort];
    setSavedCohorts(updated);
    localStorage.setItem("fhir-saved-cohorts", JSON.stringify(updated));
    setCohortNameInput("");
    setSuccess?.("Patient cohort saved successfully!");
  };

  const deleteCohort = (id: string, name: string) => {
    const updated = savedCohorts.filter((c) => c.id !== id);
    setSavedCohorts(updated);
    localStorage.setItem("fhir-saved-cohorts", JSON.stringify(updated));
    setSuccess?.(`Cohort "${name}" deleted.`);
  };

  const applyCohort = (cohort: SavedCohort) => {
    const params = new URLSearchParams();
    if (cohort.gender) params.set("gender", cohort.gender);
    if (cohort.age) params.set("age", cohort.age);
    if (cohort.condition) params.set("condition", cohort.condition);
    if (cohort.medication) params.set("medication", cohort.medication);
    if (cohort.vital) params.set("vital", cohort.vital);
    navigate(`/patients?${params.toString()}`);
    setSuccess?.(`Loaded cohort configuration: "${cohort.name}"`);
    setShowFilters(true);
  };

  const startEditCohortName = (c: SavedCohort) => {
    setEditingCohortId(c.id);
    setEditingCohortName(c.name);
  };

  const saveEditedCohortName = (id: string) => {
    if (!editingCohortName.trim()) return;
    const updated = savedCohorts.map((c) => {
      if (c.id === id) {
        return { ...c, name: editingCohortName.trim() };
      }
      return c;
    });
    setSavedCohorts(updated);
    localStorage.setItem("fhir-saved-cohorts", JSON.stringify(updated));
    setEditingCohortId(null);
    setSuccess?.("Cohort name updated successfully.");
  };

  const updateCohortFilters = (id: string, name: string) => {
    const updated = savedCohorts.map((c) => {
      if (c.id === id) {
        return {
          ...c,
          gender: genderParam || undefined,
          age: ageParam || undefined,
          condition: conditionParam || undefined,
          medication: medicationParam || undefined,
          vital: vitalParam || undefined,
        };
      }
      return c;
    });
    setSavedCohorts(updated);
    localStorage.setItem("fhir-saved-cohorts", JSON.stringify(updated));
    setSuccess?.(`Updated filters set for cohort "${name}".`);
  };

  // Helper utility to calculate age accurately
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

  // Humanize / Capitalize gender helper
  const capitalizeGender = (g?: string): string => {
    if (!g) return "Unknown";
    return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
  };

  // Parse relative pathname from absolute FHIR URLs
  const getPathFromFhirUrl = (urlStr: string): string => {
    try {
      const parsed = new URL(urlStr, window.location.origin);
      return parsed.pathname.replace(/^\/fhir-proxy\//, "") + parsed.search;
    } catch {
      const index = urlStr.indexOf("/fhir-proxy/");
      if (index !== -1) {
        return urlStr.substring(index + "/fhir-proxy/".length);
      }
      const indexPatient = urlStr.indexOf("Patient?");
      if (indexPatient !== -1) {
        return urlStr.substring(indexPatient);
      }
      return urlStr;
    }
  };

  /**
   * Primary EHR cohort fetching engine using direct multi-clinical intersection
   * @param queryName Optional target query string
   * @param pagePath Optional FHIR relative page path to walk
   */
  const loadPatients = async (queryName?: string, pagePath?: string) => {
    setLoading(true);
    setFetchError(null);
    if (queryName) {
      setIsSearchingSpinner(true);
    }

    try {
      let targetPath = "";
      if (pagePath) {
        targetPath = pagePath;
      } else {
        // Build active sets of patient IDs matching each active clinical parameter
        const activeSets: Set<string>[] = [];

        if (conditionParam) {
          const condBundle: FHIRBundle = await fhirClient.request(`Condition?_count=150`);
          const condPtIds = new Set<string>();
          if (condBundle && condBundle.entry) {
            condBundle.entry.forEach((e) => {
              const cond = e.resource;
              if (!cond || cond.resourceType !== "Condition") return;
              
              let condText = "";
              if (cond.code && cond.code.text) {
                condText = cond.code.text;
              } else if (cond.code && cond.code.coding && cond.code.coding.length > 0) {
                condText = cond.code.coding[0].display || cond.code.coding[0].code || "";
              }
              
              const lowerCond = condText.toLowerCase();
              const lowerTarget = conditionParam.toLowerCase();
              if (lowerCond.includes(lowerTarget) || lowerTarget.includes(lowerCond)) {
                if (cond.subject && cond.subject.reference) {
                  const id = cond.subject.reference.replace("Patient/", "").trim();
                  if (id) condPtIds.add(id);
                }
              }
            });
          }
          activeSets.push(condPtIds);
        }

        if (medicationParam) {
          const medBundle: FHIRBundle = await fhirClient.request(`MedicationRequest?_count=150`);
          const medPtIds = new Set<string>();
          if (medBundle && medBundle.entry) {
            medBundle.entry.forEach((e) => {
              const mr = e.resource;
              if (!mr || mr.resourceType !== "MedicationRequest") return;
              
              let medText = "";
              if (mr.medicationCodeableConcept && mr.medicationCodeableConcept.text) {
                mr.medicationCodeableConcept.text = mr.medicationCodeableConcept.text;
                medText = mr.medicationCodeableConcept.text;
              } else if (mr.medicationCodeableConcept && mr.medicationCodeableConcept.coding && mr.medicationCodeableConcept.coding.length > 0) {
                medText = mr.medicationCodeableConcept.coding[0].display || "";
              } else if (mr.medicationReference && mr.medicationReference.display) {
                medText = mr.medicationReference.display;
              }
              
              const lowerMed = medText.toLowerCase();
              const lowerTarget = medicationParam.toLowerCase();
              if (lowerMed.includes(lowerTarget) || lowerTarget.includes(lowerMed)) {
                const ref = mr.subject?.reference || mr.patient?.reference;
                if (ref) {
                  const id = ref.replace("Patient/", "").trim();
                  if (id) medPtIds.add(id);
                }
              }
            });
          }
          activeSets.push(medPtIds);
        }

        if (vitalParam) {
          const obsBundle: FHIRBundle = await fhirClient.request(`Observation?_count=150`);
          const vitalPtIds = new Set<string>();
          if (obsBundle && obsBundle.entry) {
            obsBundle.entry.forEach((e) => {
              const obs = e.resource;
              if (!obs || obs.resourceType !== "Observation") return;
              
              let matches = false;
              const display = (obs.code?.text || obs.code?.coding?.[0]?.display || "").toLowerCase();
              
              if (vitalParam === "systolic_high") {
                if (display.includes("blood pressure") || display.includes("bp")) {
                  if (obs.component && Array.isArray(obs.component)) {
                    obs.component.forEach((comp: any) => {
                      const compText = (comp.code?.text || comp.code?.coding?.[0]?.display || "").toLowerCase();
                      if (compText.includes("systolic") && comp.valueQuantity && comp.valueQuantity.value > 130) {
                        matches = true;
                      } else if (compText.includes("systolic") && comp.valueQuantity && comp.valueQuantity.value) {
                        // Numeric check direct
                        const val = Number(comp.valueQuantity.value);
                        if (!isNaN(val) && val > 130) matches = true;
                      }
                    });
                  }
                }
              } else if (vitalParam === "pulse_high") {
                if (display.includes("heart rate") || display.includes("pulse")) {
                  if (obs.valueQuantity && obs.valueQuantity.value > 85) {
                    matches = true;
                  }
                }
              } else if (vitalParam === "pulse_low") {
                if (display.includes("heart rate") || display.includes("pulse")) {
                  if (obs.valueQuantity && obs.valueQuantity.value < 60) {
                    matches = true;
                  }
                }
              } else if (vitalParam === "temp_high") {
                if (display.includes("body temperature") || display.includes("temperature") || display.includes("temp")) {
                  if (obs.valueQuantity && obs.valueQuantity.value > 38) {
                    matches = true;
                  }
                }
              }
              
              if (matches) {
                const ref = obs.subject?.reference || obs.patient?.reference;
                if (ref) {
                  const id = ref.replace("Patient/", "").trim();
                  if (id) vitalPtIds.add(id);
                }
              }
            });
          }
          activeSets.push(vitalPtIds);
        }

        // Intersect clinical Sets to calculate matches
        let finalPtIds: Set<string> | null = null;
        if (activeSets.length > 0) {
          finalPtIds = new Set<string>(activeSets[0]);
          for (let i = 1; i < activeSets.length; i++) {
            const nextSet = activeSets[i];
            const intersection = new Set<string>();
            nextSet.forEach((id) => {
              if (finalPtIds!.has(id)) {
                intersection.add(id);
              }
            });
            finalPtIds = intersection;
          }
        }

        if (finalPtIds !== null) {
          if (finalPtIds.size > 0) {
            targetPath = `Patient?_id=${Array.from(finalPtIds).join(",")}&_count=100`;
          } else {
            setPatients([]);
            setLoading(false);
            return;
          }
        } else {
          // If no clinical filters are active but gender is, load gender targeted patient bundle
          if (genderParam && !conditionParam && !medicationParam && !vitalParam) {
            targetPath = `Patient?gender=${genderParam.toLowerCase()}&_count=50`;
          } else if (queryName && queryName.trim() !== "") {
            targetPath = `Patient?name=${encodeURIComponent(queryName.trim())}&_count=50`;
          } else {
            targetPath = "Patient?_count=50&_sort=-_lastUpdated";
          }
        }
      }

      const bundle: FHIRBundle = await fhirClient.request(targetPath);
      const tempPatients: PatientSummary[] = [];

      if (bundle && bundle.entry) {
        bundle.entry.forEach((entry) => {
          if (!entry.resource || entry.resource.resourceType !== "Patient") return;
          const r = entry.resource;

          // Bulletproof given/family name parsing
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
            fullName = `Unnamed Block (${r.id || "ID Unknown"})`;
          }

          tempPatients.push({
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

      setPatients(tempPatients);

      // Map upstream next/prev pagination links
      const nextLinkItem = bundle.link?.find((l) => l.relation === "next");
      const prevLinkItem = bundle.link?.find((l) => l.relation === "previous" || l.relation === "prev");

      setNextServerPageUrl(nextLinkItem ? getPathFromFhirUrl(nextLinkItem.url) : null);
      setPrevServerPageUrl(prevLinkItem ? getPathFromFhirUrl(prevLinkItem.url) : null);
      
      // Reset local paging to page 1 unless pagination preserves index
      setCurrentPage(1);
    } catch (err: any) {
      console.error(err);
      setFetchError(err.message || "Failed to establish a reactive stream with HL7 FHIR gateway.");
    } finally {
      setLoading(false);
      setIsSearchingSpinner(false);
    }
  };

  // Fetch initial registries on mount or param changes
  useEffect(() => {
    loadPatients(activeSearchQuery);
  }, [genderParam, conditionParam, medicationParam, ageParam, vitalParam]);

  // Helper helper to update filter search variables
  const handleFilterUpdate = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    navigate(`/patients?${params.toString()}`);
  };

  // Debounce Search update trigger (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== activeSearchQuery) {
        setActiveSearchQuery(searchInput);
        loadPatients(searchInput);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, activeSearchQuery]);

  // Handle Sort triggers
  const executeSort = (field: "name" | "dob") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // Helper filter for clients age segments
  const matchesAgeFilter = (p: PatientSummary): boolean => {
    if (!ageParam) return true;
    const age = p.age;
    if (ageParam === "0-17") return age < 18;
    if (ageParam === "18-35") return age >= 18 && age <= 35;
    if (ageParam === "36-50") return age >= 36 && age <= 50;
    if (ageParam === "51-65") return age >= 51 && age <= 65;
    if (ageParam === "65+") return age > 65;
    return true;
  };

  // Helper helper to format text gender representation
  const removeFilterParam = (key: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete(key);
    navigate(`/patients?${params.toString()}`);
  };

  const clearAllFilters = () => {
    navigate("/patients");
  };

  const matchesGenderFilter = (p: PatientSummary): boolean => {
    if (!genderParam) return true;
    return p.gender.toLowerCase() === genderParam.toLowerCase();
  };

  // Sort patient collection dynamically
  const sortedPatients = [...patients]
    .filter(matchesAgeFilter)
    .filter(matchesGenderFilter)
    .sort((a, b) => {
      if (!sortField) return 0;
      
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      } else if (sortField === "dob") {
        const dateA = a.birthDate || "0000-00-00";
        const dateB = b.birthDate || "0000-00-00";
        comparison = dateA.localeCompare(dateB);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

  // Local Pagination calculation block
  const totalItems = sortedPatients.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPagedPatients = sortedPatients.slice(startIndex, endIndex);

  // Unified pagination handlers supporting seamless fallback
  const handleNextPageAction = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    } else if (nextServerPageUrl) {
      loadPatients(undefined, nextServerPageUrl);
    }
  };

  const handlePrevPageAction = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    } else if (prevServerPageUrl) {
      loadPatients(undefined, prevServerPageUrl);
    }
  };

  const clearSearchQuery = () => {
    setSearchInput("");
    setActiveSearchQuery("");
    loadPatients("");
  };

  return (
    <div className="space-y-6">
      
      {/* Header section with explicit functional title & register action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-primary tracking-tight font-sans">
            EHR Patient Registry
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse and query demographic datasets filtered securely via standard clinical FHIR APIs.
          </p>
        </div>
        <div>
          <Link
            id="register-patient-shortcut"
            to="/patients/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-navy-primary hover:bg-[#1A3E75] text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Register Patient
          </Link>
        </div>
      </div>

      {/* Active Filters Panel */}
      {(genderParam || conditionParam || medicationParam || ageParam || vitalParam) && (
        <div className="bg-[#0EA5A0]/5 border border-[#0EA5A0]/15 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Active Cohort Filters:</span>
            
            {genderParam && (
              <span className="inline-flex items-center gap-1.5 bg-blue-100/60 text-blue-700 text-xs font-black px-3 py-1.5 rounded-lg border border-blue-150">
                Sex: {genderParam.charAt(0).toUpperCase() + genderParam.slice(1).toLowerCase()}
                <button 
                  onClick={() => removeFilterParam("gender")}
                  className="hover:text-rose-600 transition cursor-pointer font-extrabold ml-1.5 text-slate-400 select-none text-[11px]"
                >
                  ✕
                </button>
              </span>
            )}

            {conditionParam && (
              <span className="inline-flex items-center gap-1.5 bg-teal-100/60 text-teal-800 text-xs font-black px-3 py-1.5 rounded-lg border border-teal-150">
                Disorder: {conditionParam.charAt(0).toUpperCase() + conditionParam.slice(1)}
                <button 
                  onClick={() => removeFilterParam("condition")}
                  className="hover:text-rose-600 transition cursor-pointer font-extrabold ml-1.5 text-slate-400 select-none text-[11px]"
                >
                  ✕
                </button>
              </span>
            )}

            {medicationParam && (
              <span className="inline-flex items-center gap-1.5 bg-indigo-100/60 text-indigo-805 text-xs font-black px-3 py-1.5 rounded-lg border border-indigo-150">
                Medication: {medicationParam.charAt(0).toUpperCase() + medicationParam.slice(1)}
                <button 
                  onClick={() => removeFilterParam("medication")}
                  className="hover:text-rose-600 transition cursor-pointer font-extrabold ml-1.5 text-slate-400 select-none text-[11px]"
                >
                  ✕
                </button>
              </span>
            )}

            {vitalParam && (
              <span className="inline-flex items-center gap-1.5 bg-rose-100/60 text-rose-800 text-xs font-black px-3 py-1.5 rounded-lg border border-rose-200">
                Vital Alert: {vitalParam === "systolic_high" ? "High BP (>130)" : vitalParam === "pulse_high" ? "High HR (>85)" : vitalParam === "pulse_low" ? "Low HR (<60)" : "High Temp (>38°C)"}
                <button 
                  onClick={() => removeFilterParam("vital")}
                  className="hover:text-rose-600 transition cursor-pointer font-extrabold ml-1.5 text-slate-400 select-none text-[11px]"
                >
                  ✕
                </button>
              </span>
            )}

            {ageParam && (
              <span className="inline-flex items-center gap-1.5 bg-amber-100/60 text-amber-800 text-xs font-black px-3 py-1.5 rounded-lg border border-amber-200">
                Age: {ageParam}
                <button 
                  onClick={() => removeFilterParam("age")}
                  className="hover:text-rose-600 transition cursor-pointer font-extrabold ml-1.5 text-slate-400 select-none text-[11px]"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          <button
            onClick={clearAllFilters}
            className="text-[10px] font-black text-rose-600 hover:text-rose-700 hover:underline uppercase tracking-wider cursor-pointer flex items-center gap-1 font-mono"
          >
            ✕ Reset All Filters
          </button>
        </div>
      )}

      {/* Live search box with small spinning indicator */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
        <label htmlFor="patient-search-input" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
          Clinical Index Search
        </label>
        <div className="relative max-w-lg">
          <input
            id="patient-search-input"
            type="text"
            placeholder="Query directory by patient name (auto-updates)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent rounded-lg py-1.5 pl-3 pr-10 text-xs text-slate-800 transition focus:outline-none placeholder:text-slate-400"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isSearchingSpinner ? (
              <RefreshCw className="w-3.5 h-3.5 text-teal-accent animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* Main interactive state panels */}
      <div className="border border-slate-200/80 rounded-xl bg-white shadow-sm overflow-hidden min-h-[300px] flex flex-col justify-between">
        
        {/* State A: Loading Skeleton list of 6 rows with shimmer pulse */}
        {loading ? (
          <div id="patient-loading-skeleton" className="p-6 space-y-4">
            <div className="h-6 w-1/4 bg-slate-100 rounded-lg animate-pulse mb-6"></div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col sm:flex-row items-center justify-between py-4 border-b border-slate-100 gap-4 last:border-0">
                <div className="flex items-center gap-4 w-full sm:w-1/3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse shrink-0"></div>
                  <div className="space-y-2 w-full">
                    <div className="h-3.5 bg-slate-100 rounded-md w-3/4 animate-pulse"></div>
                    <div className="h-2 bg-slate-100 rounded-md w-1/2 animate-pulse"></div>
                  </div>
                </div>
                <div className="h-3 bg-slate-100 rounded-md w-20 animate-pulse"></div>
                <div className="h-3 bg-slate-100 rounded-md w-24 animate-pulse"></div>
                <div className="h-3 bg-slate-100 rounded-md w-12 animate-pulse"></div>
                <div className="flex gap-2 shrink-0">
                  <div className="h-7 w-12 bg-slate-100 rounded-lg animate-pulse"></div>
                  <div className="h-7 w-12 bg-slate-100 rounded-lg animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          
          /* State B: Reactive error panel with HTTP status error and custom Retry */
          <div id="connection-error-alert" className="p-8 m-5 border border-rose-150 bg-rose-50/40 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-600">
                <ShieldAlert className="w-6 h-6 shrink-0" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-sm font-bold text-rose-950 font-sans">EHR Gateway Offline</h3>
                <p className="text-xs text-rose-700 leading-relaxed max-w-xl font-medium">
                  {fetchError}
                </p>
                <div className="pt-3">
                  <button
                    id="retry-fetch-btn"
                    onClick={() => loadPatients(searchInput)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition shrink-0 shadow-sm cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : patients.length === 0 ? (
          
          /* State C: Empty lists handler (Unified Database vs Search) */
          activeSearchQuery.trim() !== "" ? (
            <div id="no-search-results-fallback" className="text-center py-20 px-6">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-extrabold text-navy-primary font-sans">No patients found matching '{activeSearchQuery}'</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Confirm naming syntax or look up alternate diagnostic parameters.
              </p>
              <button
                id="clear-search-action-btn"
                onClick={clearSearchQuery}
                className="mt-5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div id="empty-database-fallback" className="text-center py-24 px-6">
              <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 text-slate-300">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-base font-extrabold text-[#0F2B5B] font-sans">Patient Directory Empty</h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
                No active records were parsed from this database. Start clinical tracking by registering your first patient.
              </p>
              <Link
                id="add-first-patient-shortcut"
                to="/patients/new"
                className="mt-6 inline-block px-5 py-2.5 bg-navy-primary hover:bg-[#1A3E75] text-white text-xs font-bold rounded-lg shadow-md transition cursor-pointer"
              >
                Add your first patient
              </Link>
            </div>
          )
        ) : (
          
          /* State D: Render Standard active Patient table with customized styling */
          <>
            <div className="overflow-x-auto">
              {/* Desktop Table View */}
              <table id="patient-catalog-table" className="hidden md:table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-150 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                    
                    {/* Column Header: Name with client-side sort trigger */}
                    <th 
                      id="th-patient-name"
                      onClick={() => executeSort("name")}
                      className="px-6 py-3.5 cursor-pointer hover:bg-slate-100/50 hover:text-navy-primary select-none transition"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Name</span>
                        <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortField === "name" ? "text-teal-accent font-bold" : "text-slate-300"}`} />
                      </div>
                    </th>

                    <th id="th-patient-gender" className="px-6 py-3.5">Gender</th>

                    {/* Column Header: DOB with client-side sort trigger */}
                    <th 
                      id="th-patient-dob"
                      onClick={() => executeSort("dob")}
                      className="px-6 py-3.5 cursor-pointer hover:bg-slate-100/50 hover:text-navy-primary select-none transition"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Date of Birth</span>
                        <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${sortField === "dob" ? "text-teal-accent font-bold" : "text-slate-300"}`} />
                      </div>
                    </th>

                    <th id="th-patient-age" className="px-6 py-3.5">Age</th>
                    <th id="th-patient-status" className="px-6 py-3.5">Cohort Status</th>
                    <th id="th-patient-actions" className="px-6 py-3.5 text-right w-48">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {currentPagedPatients.map((p) => (
                    <tr 
                      key={p.id} 
                      id={`patient-catalog-row-${p.id}`}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <div>
                          <span className="font-extrabold text-[#0F2B5B] block hover:text-teal-accent transition">
                            {p.name}
                          </span>
                          <span className="font-mono text-[9px] text-slate-400 block mt-0.5 select-all">
                            ID: {p.id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          p.gender.toLowerCase() === "female" ? "bg-purple-100/60 text-purple-700 border border-purple-150" :
                          p.gender.toLowerCase() === "male" ? "bg-blue-100/60 text-blue-700 border border-blue-150" :
                          "bg-slate-100 text-slate-600 border border-slate-150"
                        }`}>
                          {capitalizeGender(p.gender)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-slate-600">
                        {formatDate(p.birthDate)}
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-500">
                        {p.age} y/o
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1 p-0.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded text-[9px] font-extrabold uppercase">
                          <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                          HIPAA Safe
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            id={`view-patient-${p.id}-btn`}
                            to={`/patients/${p.id}`}
                            className="p-1 px-2 border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-[10px] font-bold tracking-wider uppercase rounded-lg text-slate-700 transition flex items-center gap-1 outline-none"
                            title="View diagnostics"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </Link>
                          <Link
                            id={`edit-patient-${p.id}-btn`}
                            to={`/patients/${p.id}/edit`}
                            className="p-1 px-2 border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-[10px] font-bold tracking-wider uppercase rounded-lg text-slate-500 transition flex items-center gap-1 outline-none"
                            title="Edit biography"
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Stacked Card List View */}
              <div id="patient-catalog-cards" className="block md:hidden divide-y divide-slate-100">
                {currentPagedPatients.map((p) => (
                  <div key={p.id} id={`patient-card-${p.id}`} className="p-4 space-y-3 hover:bg-slate-50/30 transition">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-[#0F2B5B] text-xs block">
                          {p.name}
                        </span>
                        <span className="font-mono text-[9px] text-slate-400 block select-all">
                          ID: {p.id}
                        </span>
                      </div>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        p.gender.toLowerCase() === "female" ? "bg-purple-100/60 text-purple-700 border border-purple-150" :
                        p.gender.toLowerCase() === "male" ? "bg-blue-100/60 text-blue-700 border border-blue-150" :
                        "bg-slate-100 text-slate-600 border border-slate-150"
                      }`}>
                        {capitalizeGender(p.gender)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-50/50 border border-slate-150 rounded-xl p-3 text-[11px] text-slate-500">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Birth Date</span>
                        <span className="font-semibold text-slate-700">{formatDate(p.birthDate)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Age</span>
                        <span className="font-mono font-bold text-slate-700">{p.age} y/o</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="inline-flex items-center gap-1 p-0.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded text-[9px] font-extrabold uppercase">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        HIPAA Safe
                      </span>
                      <div className="flex gap-2">
                        <Link
                          id={`view-patient-mob-${p.id}`}
                          to={`/patients/${p.id}`}
                          className="px-3 py-1.5 border border-slate-200 hover:border-slate-350 bg-white text-[10px] font-extrabold tracking-wider uppercase rounded-lg text-slate-700 transition flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </Link>
                        <Link
                          id={`edit-patient-mob-${p.id}`}
                          to={`/patients/${p.id}/edit`}
                          className="px-3 py-1.5 border border-slate-200 hover:border-slate-350 bg-white text-[10px] font-extrabold tracking-wider uppercase rounded-lg text-slate-500 transition flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination Controls Section */}
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-semibold">
                Showing <strong className="text-navy-primary">{startIndex + 1}</strong> to{" "}
                <strong className="text-navy-primary">{Math.min(endIndex, totalItems)}</strong> of{" "}
                <strong className="text-navy-primary">{totalItems}</strong> records 
                {(nextServerPageUrl || prevServerPageUrl) && (
                  <span className="text-slate-400 font-normal"> (server pager active)</span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  id="paging-prev-btn"
                  onClick={handlePrevPageAction}
                  disabled={currentPage === 1 && !prevServerPageUrl}
                  className="flex items-center gap-1 p-1.5 px-3 border border-slate-200 disabled:opacity-40 disabled:hover:bg-transparent hover:bg-slate-50 bg-white text-slate-700 text-xs font-semibold rounded-lg transition disabled:cursor-not-allowed select-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="text-xs font-bold text-slate-500 px-2 select-none">
                  Page {currentPage} of {totalPages || 1}
                </div>
                <button
                  id="paging-next-btn"
                  onClick={handleNextPageAction}
                  disabled={currentPage === totalPages && !nextServerPageUrl}
                  className="flex items-center gap-1 p-1.5 px-3 border border-slate-200 disabled:opacity-40 disabled:hover:bg-transparent hover:bg-slate-50 bg-white text-slate-700 text-xs font-semibold rounded-lg transition disabled:cursor-not-allowed select-none"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}

      </div>

      {/* Interactive Multi-Cohort clinical filters card */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#0EA5A0]" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest font-mono">
              Clinical Multi-Cohort Filters
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              id="toggle-filters-panel"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow-xs ${
                showFilters 
                  ? "bg-[#0EA5A0] hover:bg-[#0c8c88] text-white" 
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showFilters ? "Hide Dropdown Filters" : "Filter Cohorts"}
            </button>
          </div>
        </div>

        {/* Dynamic drop-down selection indicators shown conditionally */}
        {showFilters ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2 animate-fadeIn">
            {/* Sex filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Biological Sex
              </label>
              <select
                value={genderParam || ""}
                onChange={(e) => handleFilterUpdate("gender", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-[#0EA5A0] focus:ring-1 focus:ring-[#0EA5A0] rounded-lg py-1.5 px-2.5 text-xs text-slate-800 transition focus:outline-none"
              >
                <option value="">Any Biological Sex</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Age selection */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Age Range
              </label>
              <select
                value={ageParam || ""}
                onChange={(e) => handleFilterUpdate("age", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-[#0EA5A0] focus:ring-1 focus:ring-[#0EA5A0] rounded-lg py-1.5 px-2.5 text-xs text-slate-800 transition focus:outline-none"
              >
                <option value="">Any Age Segment</option>
                <option value="0-17">0-17 (Pediatric)</option>
                <option value="18-35">18-35 (Young Adult)</option>
                <option value="36-50">36-50 (Adult)</option>
                <option value="51-65">51-65 (Mature)</option>
                <option value="65+">65+ (Senior)</option>
              </select>
            </div>

            {/* Condition / Disorder selection */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Clinical Disorder
              </label>
              <select
                value={conditionParam || ""}
                onChange={(e) => handleFilterUpdate("condition", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-[#0EA5A0] focus:ring-1 focus:ring-[#0EA5A0] rounded-lg py-1.5 px-2.5 text-xs text-slate-800 transition focus:outline-none"
              >
                <option value="">Any Clinical Disorder</option>
                <option value="diabetes">Type 2 Diabetes</option>
                <option value="hypertension">Essential Hypertension</option>
                <option value="hyperlipidemia">Hyperlipidemia</option>
                <option value="asthma">Bronchial Asthma</option>
                <option value="kidney">Chronic Kidney Disease</option>
                <option value="depressive">Major Depressive Disorder</option>
                <option value="osteoarthritis">Osteoarthritis</option>
                <option value="coronary">Coronary Artery Disease</option>
              </select>
            </div>

            {/* Medication Therapy select */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Active Medication
              </label>
              <select
                value={medicationParam || ""}
                onChange={(e) => handleFilterUpdate("medication", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-[#0EA5A0] focus:ring-1 focus:ring-[#0EA5A0] rounded-lg py-1.5 px-2.5 text-xs text-slate-800 transition focus:outline-none"
              >
                <option value="">Any Active Prescription</option>
                <option value="lisinopril">Lisinopril</option>
                <option value="metformin">Metformin</option>
                <option value="atorvastatin">Atorvastatin</option>
                <option value="albuterol">Albuterol</option>
                <option value="amlodipine">Amlodipine</option>
                <option value="simvastatin">Simvastatin</option>
                <option value="furosemide">Furosemide</option>
                <option value="aspirin">Aspirin</option>
              </select>
            </div>

            {/* Vitals metrics */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Vital Signs Alerts
              </label>
              <select
                value={vitalParam || ""}
                onChange={(e) => handleFilterUpdate("vital", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-[#0EA5A0] focus:ring-1 focus:ring-[#0EA5A0] rounded-lg py-1.5 px-2.5 text-xs text-slate-800 transition focus:outline-none"
              >
                <option value="">No Active Threshold</option>
                <option value="systolic_high">High BP (Systolic &gt; 130 mmHg)</option>
                <option value="pulse_high">Tachycardia (Pulse &gt; 85 bpm)</option>
                <option value="pulse_low">Bradycardia (Pulse &lt; 60 bpm)</option>
                <option value="temp_high">Hyperthermia (Temp &gt; 38°C)</option>
              </select>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => setShowFilters(true)}
            className="text-center py-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 cursor-pointer hover:bg-[#0EA5A0]/5 hover:border-[#0EA5A0]/20 transition-all text-[#1E3A8A]"
          >
            <span className="text-xs font-semibold flex items-center justify-center gap-1.5 select-none text-[#1E3A8A]">
              <SlidersHorizontal className="w-4 h-4 text-[#0EA5A0] shrink-0" />
              Manual clinical filter dropdowns are hidden. Click here or use 'Filter Cohorts' to toggle and populate.
            </span>
          </div>
        )}
      </div>

      {/* Cohort Saving Box (Rendered when we have active clinical parameters) */}
      {(genderParam || conditionParam || medicationParam || ageParam || vitalParam) && (
        <div className="bg-teal-50/30 border border-teal-150 rounded-xl p-4 space-y-3 shadow-xs animate-fadeIn pb-5">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-[#0EA5A0]" />
            <span className="text-xs font-bold text-slate-700">Save Active Configuration as Patient Cohort</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Securely save this combination of active filters to your browser's workspace library for quick clinical lookup later.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
            <input
              type="text"
              placeholder="Name this cohort (e.g. Diabetics on Metformin, Senior BP Alerts)..."
              value={cohortNameInput}
              onChange={(e) => setCohortNameInput(e.target.value)}
              className="flex-1 bg-white border border-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0EA5A0] focus:border-[#0EA5A0]"
            />
            <button
              onClick={saveCurrentCohort}
              className="bg-[#0ea5a0] hover:bg-[#097e7b] text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-sm transition shrink-0 flex items-center justify-center gap-1 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save Cohort
            </button>
          </div>
        </div>
      )}

      {/* Saved Cohorts Library Workspace */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <span className="p-1 px-2 bg-teal-50 border border-teal-200 rounded text-[9px] font-black uppercase tracking-wider text-teal-700 font-mono">Cohorts Library</span>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
            Your Saved Cohorts
          </h3>
          <span className="text-[10px] text-slate-400 font-sans ml-auto font-mono">
            ({savedCohorts.length} Configurations Stored)
          </span>
        </div>

        {savedCohorts.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400 italic">
            No saved cohorts in database. Use filters panel to specify attributes and save your workspace portfolio.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedCohorts.map((cohort) => {
              const isEditing = editingCohortId === cohort.id;
              
              // Build clean descriptions of cohort filters
              const filterSummaries: string[] = [];
              if (cohort.gender) filterSummaries.push(`Sex: ${cohort.gender.charAt(0).toUpperCase() + cohort.gender.slice(1)}`);
              if (cohort.age) filterSummaries.push(`Age: ${cohort.age}`);
              if (cohort.condition) filterSummaries.push(`Disorder: ${cohort.condition.charAt(0).toUpperCase() + cohort.condition.slice(1)}`);
              if (cohort.medication) filterSummaries.push(`Rx: ${cohort.medication.charAt(0).toUpperCase() + cohort.medication.slice(1)}`);
              if (cohort.vital) {
                const label = cohort.vital === "systolic_high" ? "High BP" : cohort.vital === "pulse_high" ? "Pulse >85" : cohort.vital === "pulse_low" ? "Pulse <60" : "Temp >38°C";
                filterSummaries.push(`Alert: ${label}`);
              }

              return (
                <div key={cohort.id} className="border border-slate-200 hover:border-slate-350 rounded-xl p-3.5 bg-slate-50/10 hover:bg-slate-50/45 transition-all flex flex-col justify-between gap-3 shadow-xs">
                  <div className="space-y-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingCohortName}
                          onChange={(e) => setEditingCohortName(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 text-xs px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-[#0EA5A0]"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditedCohortName(cohort.id);
                            if (e.key === "Escape") setEditingCohortId(null);
                          }}
                        />
                        <button
                          onClick={() => saveEditedCohortName(cohort.id)}
                          className="p-1 px-2 bg-[#0EA5A0] hover:bg-[#0c8c88] text-white rounded text-[10px] font-sans flex items-center shrink-0 cursor-pointer"
                          title="Save change"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCohortId(null)}
                          className="p-1 px-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded text-[10px] font-sans flex items-center shrink-0 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-extrabold text-navy-primary leading-tight">
                            {cohort.name}
                          </h4>
                          <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                            Created: {new Date(cohort.createdAt || Date.now()).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => startEditCohortName(cohort)}
                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition rounded"
                            title="Rename Cohort"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteCohort(cohort.id, cohort.name)}
                            className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition rounded"
                            title="Delete Cohort"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Show criteria details */}
                    <div className="flex flex-wrap gap-1 pt-1.5">
                      {filterSummaries.length > 0 ? (
                        filterSummaries.map((summary, idx) => (
                          <span key={idx} className="bg-slate-100 border border-slate-150 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {summary}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] italics text-slate-400">All Patients Cohort</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => applyCohort(cohort)}
                      className="text-[10px] bg-slate-50 hover:bg-[#0EA5A0]/10 hover:text-teal-900 border border-slate-200 hover:border-[#0EA5A0]/20 text-slate-705 font-extrabold px-2.5 py-1 rounded-md transition cursor-pointer"
                      title="Load these cohorts"
                    >
                      Pull Cohort
                    </button>

                    <button
                      onClick={() => updateCohortFilters(cohort.id, cohort.name)}
                      className="text-[9px] font-bold text-[#0EA5A0] hover:text-[#0b807c] hover:underline cursor-pointer"
                      title="Overwrites saved filter params with current active query variables"
                    >
                      Sync live filters
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

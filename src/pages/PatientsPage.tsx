import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Users, Search, UserPlus, Edit, RefreshCw, AlertCircle, 
  ChevronLeft, ChevronRight, ArrowUpDown, Eye, Trash2, PlusCircle, ShieldAlert
} from "lucide-react";
import { fhirClient } from "../fhirClient";
import { FHIRBundle, PatientSummary } from "../types";
import { useApp } from "../context/AppContext";

export const PatientsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setIsLoading, setSuccess, setError } = useApp();

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
   * Primary EHR cohort fetching engine
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
        if (queryName && queryName.trim() !== "") {
          targetPath = `Patient?name=${encodeURIComponent(queryName.trim())}&_count=50`;
        } else {
          targetPath = "Patient?_count=50&_sort=-_lastUpdated";
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

  // Fetch initial registries on mount
  useEffect(() => {
    loadPatients();
  }, []);

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

  // Sort patient collection dynamically
  const sortedPatients = [...patients].sort((a, b) => {
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
              <table id="patient-catalog-table" className="w-full text-left border-collapse">
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
    </div>
  );
};

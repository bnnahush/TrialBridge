import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, User, HelpCircle, X } from "lucide-react";
import { fhirClient } from "../fhirClient";
import { FHIRBundle } from "../types";

interface SearchResult {
  id: string;
  name: string;
  dob: string;
  gender: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Debounced search logic (400ms)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const bundle = await fhirClient.request<FHIRBundle>(
          `Patient?name=${encodeURIComponent(query.trim())}&_count=10`
        );
        const processed: SearchResult[] = [];

        if (bundle && bundle.entry) {
          bundle.entry.forEach((entry) => {
            if (entry.resource && entry.resource.resourceType === "Patient") {
              const r = entry.resource;
              // Parse Name
              let given = "";
              let family = "";
              if (r.name && r.name.length > 0) {
                const first = r.name[0];
                if (first.given) given = first.given.join(" ");
                family = first.family || "";
              }
              const fullName = `${given} ${family}`.trim() || `Patient ${r.id}`;
              
              processed.push({
                id: r.id || "unknown",
                name: fullName,
                dob: r.birthDate || "No DOB",
                gender: r.gender || "unknown",
              });
            }
          });
        }
        setResults(processed);
        setIsOpen(true);
      } catch (err: any) {
        console.error("Global search failed:", err);
        setErrorMsg("Failed to query patients");
        setResults([]);
        setIsOpen(true);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle Event listeners for closing dropdown and keyboard bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectPatient = (id: string) => {
    setQuery("");
    setIsOpen(false);
    navigate(`/patients/${id}`);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-sm sm:max-w-xs md:max-w-md mx-4 font-sans select-text">
      <div className="relative">
        <label htmlFor="global-search-input" className="sr-only">
          Search Patients
        </label>
        <input
          id="global-search-input"
          type="text"
          placeholder="Global Patient Lookup (Name)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim()) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          className="w-full bg-[#1A3E75]/40 border border-[#1A3E75] hover:bg-[#1A3E75]/60 hover:border-teal-500/80 focus:bg-white focus:text-slate-900 focus:border-teal-500 rounded-xl py-1.5 pl-3 pr-9 text-xs text-slate-100 transition focus:outline-none placeholder:text-slate-300 focus:placeholder:text-slate-400"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear active lookup query"
              className="text-slate-300 hover:text-white p-0.5 rounded transition cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <Search className="w-3.5 h-3.5 text-slate-300" />
          )}
        </div>
      </div>

      {isOpen && (
        <div 
          id="global-search-popover"
          className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 text-slate-900 max-h-80 overflow-y-auto animate-fade-in"
          role="listbox"
        >
          {errorMsg ? (
            <div className="p-4 text-xs text-rose-600 font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              {errorMsg}
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-xs text-slate-400 text-center font-medium">
              {loading ? "Searching clinical registries..." : "No matching patients found"}
            </div>
          ) : (
            <div className="p-1">
              <div className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50">
                Matching EHR Cohorts ({results.length})
              </div>
              <ul className="divide-y divide-slate-50">
                {results.map((patient) => (
                  <li key={patient.id}>
                    <button
                      type="button"
                      onClick={() => selectPatient(patient.id)}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition flex items-center justify-between text-xs cursor-pointer rounded-lg"
                      role="option"
                      aria-selected="false"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1 px-1.5 bg-slate-100 text-[#0F2B5B] rounded font-bold font-mono text-[9px] uppercase">
                          {patient.gender ? patient.gender.charAt(0).toUpperCase() : "?"}
                        </div>
                        <div>
                          <span className="font-extrabold text-[#0F2B5B] block leading-none">
                            {patient.name}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono mt-1 block">
                            ID: {patient.id}
                          </span>
                        </div>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-600 block">
                          DOB: {patient.dob}
                        </span>
                        <span className="text-[9px] text-[#0EA5A0] font-bold uppercase tracking-wider block">
                          FHIR Safe
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

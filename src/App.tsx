/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { 
  BrowserRouter, Routes, Route, Navigate, Link, NavLink, useLocation 
} from "react-router-dom";
import { 
  Dna, Menu, X, LayoutDashboard, Users, Database, Settings, 
  RefreshCw, AlertCircle, CheckCircle, Loader2, ArrowRight,
  Info, AlertTriangle
} from "lucide-react";
import { AppProvider, useApp } from "./context/AppContext";

// Page Component Imports
import { DashboardPage } from "./pages/DashboardPage";
import { PatientsPage } from "./pages/PatientsPage";
import { PatientNewPage } from "./pages/PatientNewPage";
import { PatientDetailsPage } from "./pages/PatientDetailsPage";
import { PatientEditPage } from "./pages/PatientEditPage";
import { PatientTrialsPage } from "./pages/PatientTrialsPage";
import { TrialMatchesPage } from "./pages/TrialMatchesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// Global Search Import
import { GlobalSearch } from "./components/GlobalSearch";

// Error Boundary Import
import { ErrorBoundary } from "./components/ErrorBoundary";

function AppContent() {
  const location = useLocation();
  const { isLoading, toasts, removeToast } = useApp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Automatically scroll to top on routing shifts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMobileSidebarOpen(false); // close mobile sidebar on navigation transition
  }, [location.pathname]);

  // Dynamic page title configuration
  useEffect(() => {
    const path = location.pathname;
    let titleStr = "TrialBridge | Clinical Feasibility Hub";
    if (path === "/dashboard") {
      titleStr = "TrialBridge | Dashboard";
    } else if (path === "/patients") {
      titleStr = "TrialBridge | Patients Directory";
    } else if (path.startsWith("/patients/new")) {
      titleStr = "TrialBridge | Register Patient";
    } else if (path.match(/\/patients\/[^/]+\/trials/)) {
      titleStr = "TrialBridge | AI Trial Matching";
    } else if (path.match(/\/patients\/[^/]+\/edit/)) {
      titleStr = "TrialBridge | Edit Patient";
    } else if (path.startsWith("/patients/")) {
      titleStr = "TrialBridge | Patient Details";
    } else if (path === "/trial-matches") {
      titleStr = "TrialBridge | Study Matching";
    } else if (path === "/settings") {
      titleStr = "TrialBridge | Settings";
    }
    document.title = titleStr;
  }, [location.pathname]);

  // Dynamically set teal DNA/flask favicon on mount
  useEffect(() => {
    const svgFavicon = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%230EA5A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.25-2.5 3-2.5 5h20c0-2-1-3.75-2.5-5"/><path d="M12 2v16"/><path d="M8 12h8"/><path d="M5 6.5C6 8 8 9 12 9s6-1 7-2.5"/><path d="M5 14.5C6 13 8 12 12 12s6 1 7 2.5"/></svg>`;
    
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.getElementsByTagName("head")[0].appendChild(link);
    }
    link.href = svgFavicon;
  }, []);

  const sidebarLinks = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/patients", label: "Patients", icon: Users },
    { to: "/trial-matches", label: "Trial Matches", icon: Database },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans select-none bg-[#F7F9FC] text-slate-900">
      
      {/* 1. Global Loading Overlay Spinner */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center animate-fade-in">
          <div className="p-6 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-[#0EA5A0] animate-spin" />
            <span className="text-xs font-bold text-slate-700 tracking-wider uppercase font-mono">
              Working...
            </span>
          </div>
        </div>
      )}

      {/* 2. Global Toast Notification Stack (Auto-dismissing, slide-in entries) */}
      <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => {
          let bgClass = "bg-blue-50 border-blue-200 text-blue-900";
          let badgeText = "Notice";
          let Icon = Info;
          let iconColor = "text-blue-500";
          let dismissBtnClass = "hover:bg-blue-150 text-blue-500";

          if (toast.type === "success") {
            bgClass = "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-100/40";
            badgeText = "Success";
            Icon = CheckCircle;
            iconColor = "text-emerald-500";
            dismissBtnClass = "hover:bg-emerald-150 text-emerald-500";
          } else if (toast.type === "error") {
            bgClass = "bg-rose-50 border-rose-200 text-rose-900 shadow-rose-100/40";
            badgeText = "EHR System Halt";
            Icon = AlertCircle;
            iconColor = "text-rose-500";
            dismissBtnClass = "hover:bg-rose-150 text-rose-500";
          } else if (toast.type === "warning") {
            bgClass = "bg-amber-50 border-amber-200 text-amber-900 shadow-amber-105/40";
            badgeText = "Attention";
            Icon = AlertTriangle;
            iconColor = "text-amber-500";
            dismissBtnClass = "hover:bg-amber-150 text-amber-500";
          } else {
            // "info"
            bgClass = "bg-sky-50 border-sky-200 text-sky-900 shadow-sky-100/40";
            badgeText = "EHR Syncing";
            Icon = Info;
            iconColor = "text-sky-500";
            dismissBtnClass = "hover:bg-sky-150 text-sky-500";
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto border p-4 rounded-xl shadow-md text-xs flex items-start gap-3 animate-slide-in transition-all duration-300 ${bgClass}`}
            >
              <Icon className={`w-5 h-5 ${iconColor} mt-0.5 shrink-0`} />
              <div className="flex-1 space-y-1">
                <span className="font-extrabold uppercase tracking-widest block text-[9px]">{badgeText}</span>
                <p className="leading-relaxed font-semibold">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
                className={`p-1 rounded font-bold transition self-start cursor-pointer ${dismissBtnClass}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* 4. FIXED TOP NAVIGATION BAR */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#0F2B5B] text-white flex items-center justify-between px-6 z-30 shadow-sm border-b border-[#1A3E75]">
        
        {/* Left Side: Logo & Mobile Menu Hamburger Toggle */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
            aria-label="Toggle mobile navigation menu"
            className="p-1 md:hidden hover:bg-[#1A3E75] rounded text-white"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/" className="flex items-center gap-2 group transition">
            <span className="p-1.5 bg-[#0EA5A0] rounded-lg text-white shadow-xs block group-hover:scale-105 transition-transform duration-255">
              <Dna className="w-5 h-5 text-white animate-pulse" />
            </span>
            <div>
              <span className="text-base font-black tracking-tight block">TrialBridge</span>
              <span className="text-[8px] font-mono tracking-widest uppercase text-slate-300 -mt-1 block">Clinical Feasibility hub</span>
            </div>
          </Link>
        </div>

        {/* Global Patient search bar */}
        <GlobalSearch />

        {/* Right Nav Links: Quick global shortcuts requested */}
        <div className="hidden sm:flex items-center gap-2">
          <NavLink
            to="/patients"
            className={({ isActive }) => `px-3 py-1.5 rounded-lg text-xs font-bold leading-none tracking-wide transition ${
              isActive 
                ? "bg-[#0EA5A0] text-white shadow-sm" 
                : "text-slate-200 hover:text-white hover:bg-[#1A3E75]"
            }`}
          >
            Patients
          </NavLink>
          <NavLink
            to="/trial-matches"
            className={({ isActive }) => `px-3 py-1.5 rounded-lg text-xs font-bold leading-none tracking-wide transition ${
              isActive 
                ? "bg-[#0EA5A0] text-white shadow-sm" 
                : "text-slate-200 hover:text-white hover:bg-[#1A3E75]"
            }`}
          >
            Trial Matches
          </NavLink>
        </div>
      </header>

      {/* 5. SIDEBAR LAYOUT FRAME */}
      <div className="pt-14 flex flex-1">
        
        {/* Left Sidebar Menu (Desktop View) */}
        <aside className="hidden md:flex w-60 bg-white border-r border-slate-200 shrink-0 flex-col py-6 px-4 space-y-1.5 justify-between">
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 block">
              Core Applications
            </span>
            <nav className="space-y-1">
              {sidebarLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold tracking-wide transition ${
                      isActive 
                        ? "bg-slate-100 text-[#0F2B5B] font-extrabold border-l-4 border-[#0EA5A0]" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>{link.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="space-y-3">
            {/* Secure investigator profiling */}
            <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1">
              <p className="text-[10px] font-bold text-navy-primary font-mono leading-none">DR. SARAH CHEN</p>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">PRINCIPAL INVESTIGATOR</p>
            </div>
            
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              className="w-full text-center text-[10px] text-slate-400 hover:text-teal-accent font-extrabold uppercase tracking-widest transition pt-1 cursor-pointer"
            >
              About TrialBridge
            </button>
          </div>
        </aside>

        {/* Floating Drawer Sidebar for Mobile responsive */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-20 flex">
            <div className="fixed inset-0 bg-slate-900/45" onClick={() => setMobileSidebarOpen(false)} />
            <aside className="relative w-64 max-w-sm bg-white border-r border-slate-250 py-6 px-4 flex flex-col justify-between space-y-4 animate-fade-in">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</span>
                  <button 
                    onClick={() => setMobileSidebarOpen(false)} 
                    aria-label="Close navigation menu"
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <nav className="space-y-1">
                  {sidebarLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold tracking-wide transition ${
                          isActive 
                            ? "bg-slate-100 text-[#0F2B5B] font-extrabold border-l-4 border-[#0EA5A0]" 
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>{link.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
                  <p className="text-[10px] font-bold text-navy-primary font-mono">Dr. Sarah Chen</p>
                  <p className="text-[8px] text-slate-400 font-extrabold uppercase mt-1">Investigator</p>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    setAboutOpen(true);
                  }}
                  className="w-full text-center text-[10px] text-slate-400 hover:text-[#0EA5A0] font-extrabold uppercase tracking-widest transition pb-1 cursor-pointer"
                >
                  About TrialBridge
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* 6. MAIN SCROLLABLE CONTENT CANVAS with page transition */}
        <main className="flex-1 overflow-y-auto px-4 py-8 md:p-8">
          <div key={location.pathname} className="max-w-7xl mx-auto animate-fadeIn">
            <Routes>
              {/* Default Redirect from / to /dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Patient Core Routes */}
              <Route path="/patients" element={<ErrorBoundary fallbackName="Patients Directory"><PatientsPage /></ErrorBoundary>} />
              <Route path="/patients/new" element={<ErrorBoundary fallbackName="New Patient"><PatientNewPage /></ErrorBoundary>} />
              <Route path="/patients/:id" element={<ErrorBoundary fallbackName="Patient Details"><PatientDetailsPage /></ErrorBoundary>} />
              <Route path="/patients/:id/edit" element={<ErrorBoundary fallbackName="Edit Patient Record"><PatientEditPage /></ErrorBoundary>} />
              <Route path="/patients/:id/trials" element={<ErrorBoundary fallbackName="Clinical Trial Matching Analysis"><PatientTrialsPage /></ErrorBoundary>} />
              
              {/* Auxiliary Shell Routes */}
              <Route path="/dashboard" element={<ErrorBoundary fallbackName="Dashboard Analytics"><DashboardPage /></ErrorBoundary>} />
              <Route path="/trial-matches" element={<ErrorBoundary fallbackName="Feasibility Protocol Registry"><TrialMatchesPage /></ErrorBoundary>} />
              <Route path="/settings" element={<ErrorBoundary fallbackName="EHR Profile Settings"><SettingsPage /></ErrorBoundary>} />

              {/* 404 Fallback page */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </div>
        </main>

      </div>

      {/* 7. ABOUT TRIALBRIDGE MODAL OVERLAY */}
      {aboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-[2px] select-text animate-fadeIn font-sans">
          <div className="bg-white border border-slate-205 rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-2xl relative space-y-6">
            <button
              onClick={() => setAboutOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title="Close modal"
              aria-label="Close details dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b pb-4 border-slate-100">
              <span className="p-2.5 bg-[#0EA5A0] rounded-xl text-white shadow-sm flex items-center justify-center">
                <Dna className="w-6 h-6 text-white" />
              </span>
              <div>
                <h2 className="text-lg font-black text-navy-primary tracking-tight">About TrialBridge</h2>
                <span className="text-[9px] font-mono font-bold uppercase text-teal-600 tracking-wider">
                  HL7 FHIR & AI-Powered Feasibility matching engine
                </span>
              </div>
            </div>

            <div className="space-y-4 max-h-80 overflow-y-auto pr-1 text-xs text-slate-600 leading-relaxed">
              <div className="space-y-1.5">
                <h4 className="font-bold text-[#0F2B5B] text-xs">Overview & Mission</h4>
                <p>
                  TrialBridge is a judge-ready, interactive clinical feasibility intelligence platform designed to securely bridge the gap between patient electronic health records (EHR) and active clinical protocols. By matching structured clinical data with recruitment parameters in real-time, it optimizes clinical feasibility forecasting.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1">
                  <h5 className="font-extrabold text-navy-primary text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-teal-600" /> HL7 FHIR Interoperability
                  </h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Direct querying of standard R4 FHIR API schemas:
                    <strong className="block mt-1 font-semibold text-slate-600">
                      • Patient: Demographics, age, gender limits
                    </strong>
                    <strong className="block font-semibold text-slate-600">
                      • Condition: ICD-10 & SNOMED CT problem listings
                    </strong>
                    <strong className="block font-semibold text-slate-600">
                      • Observation: Diagnostic biomarkers & lab panels
                    </strong>
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1">
                  <h5 className="font-extrabold text-navy-primary text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-teal-600 animate-spin-slow" /> Registry Protocols
                  </h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Under the hood, TrialBridge parses structured eligibility criteria, medication profiles, patient cohorts, and target locations indexed directly from clinical registries matching targeted therapeutic pathways.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <h4 className="font-bold text-[#0F2B5B] text-xs">AI Evaluation Matrix</h4>
                <p>
                  The matching engine utilizes secure large language models to construct semantic criteria maps. These verify inclusion flags, screen for active physiological exclusions, and convert messy cohort text into structured, clean match confidence distributions on local mount.
                </p>
              </div>

              <div className="bg-teal-50/50 border border-[#0EA5A0]/25 p-3 rounded-xl flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 bg-[#0EA5A0] rounded-full animate-pulse mt-1.5 shrink-0"></span>
                <p className="text-[11px] text-slate-600 leading-normal font-medium">
                  <strong>Compliance Assurance:</strong> HIPAA-isolated architecture pattern. No PHI is ever cached, indexed, or stored permanently. All transactions operate on-demand via the local secure reverse network proxy.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Refrain & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppProvider>
  );
}

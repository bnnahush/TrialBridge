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
  RefreshCw, AlertCircle, CheckCircle, Loader2, ArrowRight
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

function AppContent() {
  const location = useLocation();
  const { isLoading, error, setError, success, setSuccess } = useApp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Automatically scroll to top on routing shifts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMobileSidebarOpen(false); // close mobile sidebar on navigation transition
  }, [location.pathname]);

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

      {/* 2. Global Error Banner Status */}
      {error && (
        <div className="fixed top-20 right-4 z-40 max-w-md bg-rose-50 border border-rose-100 p-4 rounded-xl shadow-md text-rose-800 text-xs flex items-start gap-3 animate-slide-in">
          <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <span className="font-extrabold uppercase tracking-widest block text-[10px]">Operation Halt</span>
            <p className="leading-relaxed font-medium">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="p-1 hover:bg-rose-100 rounded text-rose-500 font-bold transition self-start"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Global Success Notification */}
      {success && (
        <div className="fixed top-20 right-4 z-40 max-w-md bg-emerald-50 border border-emerald-100 p-4 rounded-xl shadow-md text-emerald-800 text-xs flex items-start gap-3 animate-slide-in">
          <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <span className="font-extrabold uppercase tracking-widest block text-[10px]">EHR Synced</span>
            <p className="leading-relaxed font-medium">{success}</p>
          </div>
          <button 
            onClick={() => setSuccess(null)}
            className="p-1 hover:bg-emerald-100 rounded text-emerald-500 font-bold transition self-start"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. FIXED TOP NAVIGATION BAR */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#0F2B5B] text-white flex items-center justify-between px-6 z-30 shadow-sm border-b border-[#1A3E75]">
        
        {/* Left Side: Logo & Mobile Menu Hamburger Toggle */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
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
                    <Icon className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-teal-accent" />
                    <span>{link.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Secure investigator profiling */}
          <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1">
            <p className="text-[10px] font-bold text-navy-primary font-mono leading-none">DR. SARAH CHEN</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">PRINCIPAL INVESTIGATOR</p>
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
                  <button onClick={() => setMobileSidebarOpen(false)} className="p-1 hover:bg-slate-100 rounded text-slate-500">
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

              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
                <p className="text-[10px] font-bold text-navy-primary font-mono">Dr. Sarah Chen</p>
                <p className="text-[8px] text-slate-400 font-extrabold uppercase mt-1">Investigator</p>
              </div>
            </aside>
          </div>
        )}

        {/* 6. MAIN SCROLLABLE CONTENT CANVAS */}
        <main className="flex-1 overflow-y-auto px-4 py-8 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Routes>
              {/* Default Redirect from / to /patients */}
              <Route path="/" element={<Navigate to="/patients" replace />} />
              
              {/* Patient Core Routes */}
              <Route path="/patients" element={<PatientsPage />} />
              <Route path="/patients/new" element={<PatientNewPage />} />
              <Route path="/patients/:id" element={<PatientDetailsPage />} />
              <Route path="/patients/:id/edit" element={<PatientEditPage />} />
              <Route path="/patients/:id/trials" element={<PatientTrialsPage />} />
              
              {/* Auxiliary Shell Routes */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/trial-matches" element={<TrialMatchesPage />} />
              <Route path="/settings" element={<SettingsPage />} />

              {/* 404 Fallback page */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </div>
        </main>

      </div>
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

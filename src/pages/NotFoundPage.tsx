import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Dna, ArrowLeft } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] text-center px-4">
      <div className="p-4 bg-amber-50 rounded-full text-amber-500 mb-6">
        <AlertTriangle className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-extrabold text-navy-primary tracking-tight font-sans">404 - Request Routing Halt</h1>
      <p className="text-sm text-slate-500 max-w-md mt-2 leading-relaxed">
        The system could not resolve the downstream resource endpoints or patient directory query requested. Please review your parameters and try again.
      </p>
      
      <div className="mt-8 flex items-center gap-4">
        <Link 
          to="/"
          className="flex items-center gap-2 px-4 py-2 bg-navy-primary hover:bg-navy-primary/95 text-white text-xs font-semibold rounded-lg transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Dashboard
        </Link>
        <Link 
          to="/patients"
          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition"
        >
          View Patients
        </Link>
      </div>

      <div className="mt-12 flex items-center justify-center gap-2 text-[10px] text-slate-400 font-semibold tracking-wider uppercase font-mono">
        <Dna className="w-4 h-4 text-teal-accent" />
        TrialBridge Feasibility Platform
      </div>
    </div>
  );
};

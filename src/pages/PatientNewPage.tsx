import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { CreateEditPatient } from "../components/CreateEditPatient";

export const PatientNewPage: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link 
          to="/patients"
          className="p-1 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 transition mr-2"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-navy-primary tracking-tight font-sans">Register Patient Cohort</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Add a new patient demographic dataset securely configured via standard clinical FHIR APIs.
          </p>
        </div>
      </div>

      <CreateEditPatient />
    </div>
  );
};

import React from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { CreateEditPatient } from "../components/CreateEditPatient";

export const PatientEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link 
          to={id ? `/patients/${id}` : "/patients"}
          className="p-1 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 transition mr-2"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-navy-primary tracking-tight font-sans">Edit Biography</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Modify official registered demographics for Patient ID: <strong className="font-mono text-[11px] text-teal-accent">{id}</strong>
          </p>
        </div>
      </div>

      <CreateEditPatient patientId={id} />
    </div>
  );
};

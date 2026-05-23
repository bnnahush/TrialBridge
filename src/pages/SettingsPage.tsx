import React, { useEffect, useState } from "react";
import { ConfigurationStatus } from "../components/ConfigurationStatus";
import { FHIRLogConsole } from "../components/FHIRLogConsole";
import { fhirClient } from "../fhirClient";
import { FHIRServerConfig } from "../types";
import { useApp } from "../context/AppContext";
import { Settings, RefreshCw } from "lucide-react";

export const SettingsPage: React.FC = () => {
  const { setIsLoading, setError } = useApp();
  const [config, setConfig] = useState<FHIRServerConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cfg = await fhirClient.getBackendConfig();
      setConfig(cfg);
    } catch (err: any) {
      console.error(err);
      setError("Failed to resolve server proxy configs. Ensure Express backend is responsive.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-primary tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-teal-accent" />
          HL7 FHIR & Proxy Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Verify connected downstream EHR instances, manage credentials, and audit streaming webhook traces.
        </p>
      </div>

      <ConfigurationStatus config={config} onRefresh={fetchConfig} loading={loading} />

      <div className="border-t border-slate-150 pt-6">
        <h3 className="text-sm font-bold text-navy-primary mb-3">Live Network Proxy Logs</h3>
        <p className="text-xs text-slate-500 mb-4">
          All HTTP REST transactions issued from this machine to the external FHIR gateway are captured below with response codes and diagnostics:
        </p>
        <FHIRLogConsole />
      </div>
    </div>
  );
};

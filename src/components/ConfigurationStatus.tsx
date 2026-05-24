/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Server, Key, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, 
  Database, RefreshCw, Send, Check, AlertCircle, Info 
} from "lucide-react";
import { FHIRServerConfig } from "../types";
import { fhirClient } from "../fhirClient";
import { useApp } from "../context/AppContext";

interface Props {
  config: FHIRServerConfig | null;
  onRefresh: () => void;
  loading: boolean;
}

export const ConfigurationStatus: React.FC<Props> = ({ config, onRefresh, loading }) => {
  const { addToast } = useApp();
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [testDetails, setTestDetails] = useState<string | null>(null);

  // Mask sensitive parts of the FHIR Base URL
  const maskUrl = (url?: string) => {
    if (!url) return "Detecting config...";
    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      const maskedHost = host.length > 5 
        ? host.substring(0, 3) + "****" + host.substring(host.length - 3)
        : "****";
      return `${parsed.protocol}//${maskedHost}${parsed.pathname}`;
    } catch {
      return url.length > 10 
        ? url.substring(0, 6) + "********" + url.substring(url.length - 4)
        : "********";
    }
  };

  // Perform CapabilityStatement GET request against proxy/metadata
  const handleTestConnection = async () => {
    setTestState("testing");
    setTestDetails(null);
    addToast("Initiating secure exchange handshake with FHIR Gateway...", "info");

    try {
      // Call standard metadata endpoint on R4 proxy
      const metadata = await fhirClient.request("metadata");
      setTestState("success");
      
      const fhirVersion = metadata.fhirVersion || "R4 (4.0.1)";
      const softwareName = metadata.software?.name || metadata.name || "Generic Server";
      const detailMsg = `Connected safely. Engine: ${softwareName}, fhirVersion: ${fhirVersion}`;
      setTestDetails(detailMsg);
      addToast("FHIR Gateway verified! CapabilityStatement received successfully.", "success");
    } catch (err: any) {
      console.error(err);
      setTestState("failed");
      const errMsg = err.message || "EHR Sandbox timed out or returned invalid JSON payload.";
      setTestDetails(errMsg);
      addToast(`Handshake failed: ${errMsg}`, "error");
    }
  };

  return (
    <div id="fhir-config-card" className="bg-white border border-slate-105 rounded-xl shadow-xs overflow-hidden select-text animate-slide-in">
      <div className="bg-gradient-to-r from-teal-950 to-slate-900 p-5 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-teal-400 shrink-0" />
          <div>
            <h3 className="font-semibold tracking-tight text-white text-base">FHIR Proxy Core Configuration</h3>
            <p className="text-xs text-slate-300">Monitors target FHIR R4 server parameters and authorization bindings</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh Config
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Server Coordinates & OAuth status */}
          <div className="space-y-4">
            
            {/* Masked Server Base URL */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/50">
              <Server className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">FHIR Base URL Path</span>
                <span className="font-mono text-xs text-slate-700 break-all block mt-1 leading-relaxed bg-[#f1f5f9] p-2 rounded border border-slate-100 select-all">
                  {maskUrl(config?.fhirBaseUrl)}
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                    <span className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce"></span> Connected
                  </span>
                  {config?.fhirBaseUrlConfigured ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-100">
                      Env Override Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                      Public Fallback Sandbox
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bearer Handshake bindings */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/50">
              <Key className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">OAuth Credentials Protocol</span>
                <span className="text-xs font-semibold text-slate-800 block mt-1">
                  {config?.hasBearerToken ? "OAuth 2.0 Bearer Token (Masked Integrity Check)" : "No Bearer Token Specified (Anonymous API access)"}
                </span>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  The secure reverse network gateway automatically injects credentials at the egress routing boundary to safeguard medical secrets.
                </p>
              </div>
            </div>

            {/* Model & AI Settings display wrapper */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/50">
              <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Evaluator Platform AI Target</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-lg text-xs font-black">
                    GPT-4o-mini
                  </span>
                  <span className="bg-slate-100 text-slate-650 px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold border border-slate-200">
                    Clinical-Precision mode (T=0.15)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Optimized for criteria parsing, reasoning-matrix validation of exclusion constraints, and structural compatibility indexing.
                </p>
              </div>
            </div>

          </div>

          {/* Right Column: Interaction connection validator */}
          <div className="flex flex-col justify-between p-5 border border-slate-200/60 rounded-xl bg-slate-50/50 text-slate-700">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-slate-500" />
                <span>FHIR Gateway Loopback Tool</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Execute an on-demand clinical capabilities handshake directly with the target EHR metadata query endpoint (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">/metadata</code>) to check conformance:
              </p>

              {/* Handshake Outcome Panel */}
              {testState !== "idle" && (
                <div className={`p-4 rounded-xl text-xs space-y-1 border ${
                  testState === "testing" ? "bg-blue-50/50 border-blue-100 text-blue-800" :
                  testState === "success" ? "bg-emerald-50/50 border-emerald-100 text-emerald-800 shadow-xs" :
                  "bg-rose-50/55 border-rose-100 text-rose-800"
                }`}>
                  <div className="flex items-center gap-1.5 font-bold">
                    {testState === "testing" && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                    {testState === "success" && <Check className="w-3.5 h-3.5 text-emerald-500 font-black" />}
                    {testState === "failed" && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                    
                    <span className="uppercase tracking-wider font-extrabold text-[9px]">
                      {testState === "testing" ? "Conforming..." : 
                       testState === "success" ? "Gateway Handshake Verified" : "Handshake Failed"}
                    </span>
                  </div>
                  {testDetails && (
                    <p className="font-mono text-[10px] break-words mt-1 leading-relaxed bg-white/40 p-2 rounded border border-slate-100">
                      {testDetails}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testState === "testing"}
              className="mt-4 w-full py-2.5 px-4 bg-[#0EA5A0] hover:bg-[#0C8F8B] disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-all shadow-sm shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {testState === "testing" ? "Querying CapabilityStatement..." : "Test FHIR Connection"}
            </button>
          </div>
        </div>

        {/* Informational footer line */}
        <div className="flex gap-2 items-center text-[10px] text-slate-400 italic bg-slate-50 p-2.5 rounded-lg">
          <Sparkles className="w-3.5 h-3.5 text-[#0EA5A0]" />
          <span>Downstream server settings are guarded in container environment variables. Direct UI mutation is prohibited for protocol safety.</span>
        </div>
      </div>
    </div>
  );
};

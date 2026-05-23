/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Server, Key, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Database } from "lucide-react";
import { FHIRServerConfig } from "../types";

interface Props {
  config: FHIRServerConfig | null;
  onRefresh: () => void;
  loading: boolean;
}

export const ConfigurationStatus: React.FC<Props> = ({ config, onRefresh, loading }) => {
  return (
    <div id="fhir-config-card" className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden">
      <div className="bg-gradient-to-r from-teal-900 to-slate-900 p-5 text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-teal-400" />
          <div>
            <h3 className="font-semibold tracking-tight text-white text-base">FHIR Proxy Core Configuration</h3>
            <p className="text-xs text-slate-300">Monitors target FHIR R4 server parameters and authorization bindings</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify Connection"}
        </button>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status Panel */}
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-slate-100">
              <Server className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-xs font-semibold text-slate-500 block">FHIR Base URL Path</span>
                <span className="font-mono text-sm text-slate-800 break-all select-all block mt-1">
                  {config?.fhirBaseUrl || "Detecting downstream..."}
                </span>
                <div className="flex items-center gap-2 mt-2">
                  {config?.fhirBaseUrlConfigured ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Direct Workspace Override Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                      <AlertTriangle className="w-3.5 h-3.5" /> Public Sandbox fallback (hapi.fhir.org)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-slate-100">
              <Key className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-xs font-semibold text-slate-500 block">Authorization Protocol</span>
                <span className="text-sm font-medium text-slate-800 block mt-1">
                  {config?.hasBearerToken ? "OAuth 2.0 Bearer Token (Secure Transmit Active)" : "No Bearer Token Specified (Anonymous API access)"}
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  The proxy appends the secure credentials header automatically on all egress endpoints. React code never receives or logs this token.
                </p>
              </div>
            </div>
          </div>

          {/* Quick instructions panel */}
          <div className="p-5 border border-amber-100 rounded-lg bg-amber-50/40 text-slate-700 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-medium text-sm">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Configuring Private Clinical Directives</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              To connect TrialBridge to your secure hospital sandbox, EHR environment, or specific FHIR provider directory, populate the project secrets via the settings menu:
            </p>
            <div className="space-y-2">
              <div className="bg-white border border-slate-200/60 p-2.5 rounded-md">
                <div className="font-mono text-[11px] font-bold text-slate-800">FHIR_BASE_URL</div>
                <div className="text-[11px] text-slate-500 mt-0.5">e.g., <code className="bg-slate-50 p-0.5 font-mono">https://hapi.fhir.org/baseR4</code> or your internal endpoint</div>
              </div>
              <div className="bg-white border border-slate-200/60 p-2.5 rounded-md">
                <div className="font-mono text-[11px] font-bold text-slate-800">FHIR_BEARER_TOKEN</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Your protected EHR API client authorization Bearer string</div>
              </div>
            </div>
            <div className="flex gap-2 items-center text-[10px] text-slate-400 italic">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Your secrets are encrypted, secure, and isolated.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

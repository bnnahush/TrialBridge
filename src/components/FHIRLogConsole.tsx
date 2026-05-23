/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Terminal, Send, CheckCircle, XCircle, ChevronDown, ChevronRight, Ban } from "lucide-react";
import { QueryLogEntry } from "../types";
import { subscribeToFHIRLogs, getQueryLogs } from "../fhirClient";

export const FHIRLogConsole: React.FC = () => {
  const [logs, setLogs] = useState<QueryLogEntry[]>([]);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);

  useEffect(() => {
    // Populate existing logs
    setLogs(getQueryLogs());

    // Subscribe to new logs
    const unsubscribe = subscribeToFHIRLogs((newLog) => {
      setLogs((currentLogs) => [newLog, ...currentLogs].slice(0, 100));
    });

    return unsubscribe;
  }, []);

  const clearLogs = () => {
    // Simply clear frontend list display
    setLogs([]);
    setSelectedLogIndex(null);
  };

  return (
    <div id="fhir-log-viewer" className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl text-slate-200 font-mono">
      {/* Console Header */}
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <div>
            <span className="font-semibold text-slate-100 text-sm tracking-wide">FHIR R4 Traffic Inspector</span>
            <span className="block text-[10px] text-slate-400 font-sans mt-0.5">Real-time audit log of proxied REST queries</span>
          </div>
        </div>
        <div className="flex gap-2">
          {logs.length > 0 && (
            <button
              onClick={clearLogs}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded text-xs transition-colors cursor-pointer flex items-center gap-1 font-sans"
            >
              <Ban className="w-3.5 h-3.5" /> Clear Trace
            </button>
          )}
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="p-8 text-center text-slate-500 font-sans space-y-2">
          <Send className="w-8 h-8 text-slate-700 mx-auto animate-pulse" />
          <p className="text-sm">Traffic stream idle.</p>
          <p className="text-xs max-w-sm mx-auto text-slate-600">
            Build a clinical query, search the patient directory or trigger feasibility matching to initiate downstream requests through the server proxy.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[300px] max-h-[500px]">
          {/* Logs List - Left */}
          <div className="lg:col-span-5 border-r border-slate-800 overflow-y-auto divide-y divide-slate-800 text-xs">
            {logs.map((log, index) => {
              const isSelected = selectedLogIndex === index;
              return (
                <button
                  key={index}
                  onClick={() => setSelectedLogIndex(isSelected ? null : index)}
                  className={`w-full text-left p-3 flex flex-col gap-1 transition-colors hover:bg-slate-800/50 cursor-pointer ${
                    isSelected ? "bg-slate-800 text-white" : ""
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[10px] text-slate-400">{log.timestamp}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        log.success
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {log.status === 0 ? "ERROR" : `HTTP ${log.status}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[10px] px-1 font-extrabold rounded select-none shrink-0 ${
                        log.method === "GET"
                          ? "bg-sky-500/20 text-sky-400"
                          : log.method === "POST"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-purple-500/20 text-purple-400"
                      }`}
                    >
                      {log.method}
                    </span>
                    <span className="font-mono text-slate-200 font-medium truncate shrink break-all text-left">
                      {log.url}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span className="font-sans">Latency:</span>
                    <span className="font-mono text-slate-300 font-bold">{log.durationMs}ms</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Details - Right */}
          <div className="lg:col-span-7 bg-slate-950 p-4 overflow-y-auto max-h-[500px] text-xs">
            {selectedLogIndex !== null && logs[selectedLogIndex] ? (
              <div className="space-y-4">
                <div className="space-y-2 border-b border-slate-800 pb-3">
                  <div className="text-slate-400 text-[10px] uppercase font-sans font-bold tracking-wider">Connection Metrics</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div className="bg-slate-900/60 p-2 rounded">
                      <span className="text-[10px] text-slate-400 block font-sans">Method</span>
                      <span className="text-sm font-extrabold text-slate-100">{logs[selectedLogIndex].method}</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded">
                      <span className="text-[10px] text-slate-400 block font-sans">Status</span>
                      <span className={`text-sm font-extrabold ${logs[selectedLogIndex].success ? "text-emerald-400" : "text-red-400"}`}>
                        {logs[selectedLogIndex].status === 0 ? "Connection Error" : `HTTP ${logs[selectedLogIndex].status}`}
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded">
                      <span className="text-[10px] text-slate-400 block font-sans">Duration</span>
                      <span className="text-sm font-extrabold text-amber-400">{logs[selectedLogIndex].durationMs} ms</span>
                    </div>
                  </div>
                  <div className="mt-2 text-slate-300 break-all select-all font-mono text-[11px] bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-[9px] text-slate-500 block">PROXIED TARGET:</span>
                    {logs[selectedLogIndex].url}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-slate-400 text-[10px] uppercase font-sans font-bold tracking-wider">
                    <span>FHIR Payload Payload</span>
                    <span className="font-mono text-emerald-400 text-[9px]">application/fhir+json</span>
                  </div>
                  <pre className="p-3 bg-slate-900 border border-slate-800 rounded font-mono text-[11px] text-slate-300 whitespace-pre-wrap overflow-x-auto max-h-[300px]">
                    {(() => {
                      const log = logs[selectedLogIndex];
                      try {
                        const parsedObj = JSON.parse(log.responsePreview);
                        return JSON.stringify(parsedObj, null, 2);
                      } catch {
                        return log.responsePreview || "Empty Response";
                      }
                    })()}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-slate-500 text-center font-sans">
                <ChevronRight className="w-6 h-6 rotate-90 lg:rotate-0 mb-1" />
                <p className="text-sm font-medium">No Packet Selected</p>
                <p className="text-xs text-slate-600 max-w-xs mt-1">Select an active query card from the trace buffer to inspect downstream clinical structures.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

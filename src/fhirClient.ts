/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FHIRBundle, FHIRResource, QueryLogEntry } from "./types";

type LogListener = (entry: QueryLogEntry) => void;
const listeners = new Set<LogListener>();

let queryLogs: QueryLogEntry[] = [];

// Allow UI components to subscribe to real-time FHIR request logs
export const subscribeToFHIRLogs = (listener: LogListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const logQuery = (entry: QueryLogEntry) => {
  queryLogs = [entry, ...queryLogs].slice(0, 100); // keep last 100
  listeners.forEach((listener) => listener(entry));
};

export const getQueryLogs = () => queryLogs;

export const fhirClient = {
  /**
   * Raw FHIR Proxy request wrapper
   */
  async request<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const startTime = Date.now();
    const cleanPath = path.startsWith("/") ? path.substring(1) : path;
    const url = `/fhir-proxy/${cleanPath}`;

    const headers = new Headers(options.headers || {});
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/fhir+json, application/json");
    }

    const method = options.method || "GET";
    const logEntry: Partial<QueryLogEntry> = {
      timestamp: new Date().toLocaleTimeString(),
      method,
      url: `/fhir-proxy/${cleanPath}`,
    };

    try {
      const response = await fetch(url, {
        ...options,
        method,
        headers,
      });

      const durationMs = Date.now() - startTime;
      const status = response.status;
      const responseText = await response.text();

      let parsedData: any;
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        parsedData = responseText;
      }

      logQuery({
        timestamp: new Date().toLocaleTimeString(),
        method,
        url: `[FHIR Server] /${cleanPath}`,
        status,
        durationMs,
        responsePreview: responseText.substring(0, 400) + (responseText.length > 400 ? "..." : ""),
        success: response.ok,
      });

      if (!response.ok) {
        // If it returns a FHIR OperationOutcome, throw that or basic message
        if (parsedData && parsedData.resourceType === "OperationOutcome") {
          const diagnostics = parsedData.issue?.[0]?.diagnostics || "FHIR Server Error";
          throw new Error(`FHIR Error (${status}): ${diagnostics}`);
        }
        throw new Error(`Proxy request failed with status ${status}`);
      }

      return parsedData as T;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      logQuery({
        timestamp: new Date().toLocaleTimeString(),
        method,
        url: `[FHIR Error] /${cleanPath}`,
        status: 0,
        durationMs,
        responsePreview: err.message || "Failed to connect",
        success: false,
      });
      throw err;
    }
  },

  /**
   * Search Patients with parameters
   */
  async searchPatients(params: {
    gender?: string;
    birthdateLe?: string;
    birthdateGe?: string;
    _count?: number;
    _include?: string;
    name?: string;
    _has?: string;
  } = {}): Promise<FHIRBundle> {
    const queryParts: string[] = [];
    if (params.gender) queryParts.push(`gender=${params.gender}`);
    if (params.birthdateLe) queryParts.push(`birthdate=le${params.birthdateLe}`);
    if (params.birthdateGe) queryParts.push(`birthdate=ge${params.birthdateGe}`);
    if (params.name) queryParts.push(`name=${encodeURIComponent(params.name)}`);
    if (params._count) queryParts.push(`_count=${params._count}`);
    if (params._include) queryParts.push(`_include=${params._include}`);
    if (params._has) queryParts.push(`_has=${params._has}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    return fhirClient.request<FHIRBundle>(`Patient${queryString}`);
  },

  /**
   * Get target patient by ID
   */
  async getPatient(id: string): Promise<FHIRResource> {
    return fhirClient.request<FHIRResource>(`Patient/${id}`);
  },

  /**
   * Get active conditions for a patient
   */
  async getConditions(params: { patient?: string; code?: string; _count?: number } = {}): Promise<FHIRBundle> {
    const queryParts: string[] = [];
    if (params.patient) queryParts.push(`patient=${params.patient}`);
    if (params.code) queryParts.push(`code=${params.code}`);
    if (params._count) queryParts.push(`_count=${params._count}`);
    const qs = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    return fhirClient.request<FHIRBundle>(`Condition${qs}`);
  },

  /**
   * Get Observations for diagnostic matching (e.g., HbA1c, Blood pressure)
   */
  async getObservations(params: { patient?: string; code?: string; _count?: number } = {}): Promise<FHIRBundle> {
    const queryParts: string[] = [];
    if (params.patient) queryParts.push(`patient=${params.patient}`);
    if (params.code) queryParts.push(`code=${params.code}`);
    if (params._count) queryParts.push(`_count=${params._count}`);
    const qs = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    return fhirClient.request<FHIRBundle>(`Observation${qs}`);
  },

  /**
   * Get Clinical Trials (ResearchStudies)
   */
  async getResearchStudies(count: number = 20): Promise<FHIRBundle> {
    return fhirClient.request<FHIRBundle>(`ResearchStudy?_count=${count}`);
  },

  /**
   * Create a ResearchStudy in FHIR
   */
  async createResearchStudy(study: FHIRResource): Promise<FHIRResource> {
    return fhirClient.request<FHIRResource>("ResearchStudy", {
      method: "POST",
      headers: {
        "Content-Type": "application/fhir+json",
      },
      body: JSON.stringify(study),
    });
  },

  /**
   * Get system configuration status from Express
   */
  async getBackendConfig(): Promise<{ fhirBaseUrlConfigured: boolean; fhirBaseUrl: string; hasBearerToken: boolean }> {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error("Could not retrieve backend proxy config");
    return res.json();
  }
};

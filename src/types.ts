/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FHIRResource {
  resourceType: string;
  id?: string;
  [key: string]: any;
}

export interface FHIRBundle {
  resourceType: "Bundle";
  id?: string;
  type: string;
  total?: number;
  entry?: Array<{
    fullUrl?: string;
    resource: FHIRResource;
    search?: {
      mode?: string;
      score?: number;
    };
  }>;
  link?: Array<{
    relation: string;
    url: string;
  }>;
}

export interface PatientSummary {
  id: string;
  name: string;
  gender: string;
  birthDate: string;
  age: number;
  conditions: string[];
  active: boolean;
}

export interface TrialCriteria {
  id: string;
  field: "gender" | "ageMin" | "ageMax" | "condition" | "observationName";
  operator: "equals" | "greaterDraft" | "lessDraft" | "contains";
  value: string;
  displayValue: string; // User-facing name e.g. "Diabetes Mellitus" for code "44054006"
}

export interface ClinicalTrial {
  id: string;
  title: string;
  status: "active" | "draft" | "completed" | "terminated";
  phase: string; // e.g. "Phase 1", "Phase 2", "Phase 3"
  sponsor: string;
  description: string;
  criteria: TrialCriteria[];
  created?: string;
}

export interface FHIRServerConfig {
  fhirBaseUrlConfigured: boolean;
  fhirBaseUrl: string;
  hasBearerToken: boolean;
}

export interface QueryLogEntry {
  timestamp: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  responsePreview: string;
  success: boolean;
}

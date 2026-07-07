import { apiFetch } from "./client";

export type ValidationLevel = "error" | "warning" | "info";

export interface ValidationFinding {
  level: ValidationLevel;
  code: string;
  message: string;
}

export interface OntologyClassSummary {
  uri: string;
  label: string | null;
  local_name: string;
}

export interface OntologyRelationSummary {
  uri: string;
  label: string | null;
  local_name: string;
  property_type: "object" | "datatype";
  domain: string | null;
  range: string | null;
}

export interface OntologyValidationInventory {
  classes: OntologyClassSummary[];
  relations: OntologyRelationSummary[];
  truncated: boolean;
}

export interface OntologyValidationReport {
  passed: boolean;
  error_count: number;
  warning_count: number;
  findings: ValidationFinding[];
  stats: Record<string, number>;
  run_at: string;
  run_id: string;
  ai_summary: string | null;
  inventory: OntologyValidationInventory | null;
}

export interface OntologyValidationRunResponse {
  ontology: OntologyDefinitionResponse;
  report: OntologyValidationReport;
  semantic_transaction_id: string | null;
}

export type OntologyDefinitionStatus =
  | "Draft"
  | "Validated"
  | "Approved"
  | "Published"
  | "Versioned"
  | "Retired";

export interface OntologyDefinitionResponse {
  id: string;
  application_id: string;
  version_number: number;
  previous_version_id: string | null;
  status: OntologyDefinitionStatus;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  validated_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  version_created_at: string | null;
  ontology_definition: Record<string, unknown>;
  connector_id?: string | null;
  artifact_uri?: string | null;
  source_format?: string | null;
  semantic_transaction_id?: string | null;
}

export function listOntologies(
  applicationId: string,
  ontologyStatus?: OntologyDefinitionStatus,
): Promise<OntologyDefinitionResponse[]> {
  const params = new URLSearchParams({ application_id: applicationId });
  if (ontologyStatus) {
    params.set("ontology_status", ontologyStatus);
  }
  return apiFetch<OntologyDefinitionResponse[]>(`/ontologies?${params}`);
}

export function getOntology(ontologyId: string): Promise<OntologyDefinitionResponse> {
  return apiFetch<OntologyDefinitionResponse>(`/ontologies/${ontologyId}`);
}

export interface OntologyDefinitionCreateRequest {
  application_id: string;
  title: string;
  created_by?: string;
  description?: string;
  connector_id?: string;
  ontology_definition?: Record<string, unknown>;
}

export function createOntology(
  payload: OntologyDefinitionCreateRequest,
): Promise<OntologyDefinitionResponse> {
  return apiFetch<OntologyDefinitionResponse>("/ontologies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface OntologyDefinitionUpdateRequest {
  title?: string;
  description?: string | null;
  ontology_definition?: Record<string, unknown>;
}

export function updateOntology(
  ontologyId: string,
  payload: OntologyDefinitionUpdateRequest,
): Promise<OntologyDefinitionResponse> {
  return apiFetch<OntologyDefinitionResponse>(`/ontologies/${ontologyId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export interface OntologyDefinitionImportRequest {
  application_id: string;
  title: string;
  connector_id: string;
  source_format: string;
  source_content: string;
  created_by?: string;
  description?: string;
}

export function importOntology(
  payload: OntologyDefinitionImportRequest,
): Promise<OntologyDefinitionResponse> {
  return apiFetch<OntologyDefinitionResponse>("/ontologies/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface OntologyContentValidateRequest {
  source_format: string;
  source_content: string;
  title?: string;
  description?: string;
  application_id?: string;
}

export function validateOntologyContent(
  payload: OntologyContentValidateRequest,
): Promise<OntologyValidationReport> {
  return apiFetch<OntologyValidationReport>("/ontologies/validate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runOntologyValidation(
  ontologyId: string,
): Promise<OntologyValidationRunResponse> {
  return apiFetch<OntologyValidationRunResponse>(`/ontologies/${ontologyId}/validate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function readStoredValidationReport(
  ontology: OntologyDefinitionResponse,
): OntologyValidationReport | null {
  const metadata = ontology.ontology_definition.metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const validation = (metadata as Record<string, unknown>).validation;
  if (!validation || typeof validation !== "object") {
    return null;
  }
  return validation as OntologyValidationReport;
}

const ONTOLOGY_NEXT_STATUSES: Record<OntologyDefinitionStatus, OntologyDefinitionStatus[]> = {
  Draft: ["Validated"],
  Validated: ["Approved", "Draft"],
  Approved: [],
  Published: [],
  Versioned: [],
  Retired: [],
};

export const ONTOLOGY_LIFECYCLE_STEPS: OntologyDefinitionStatus[] = [
  "Draft",
  "Validated",
  "Approved",
];

export function normalizeOntologyLifecycleStatus(
  status: OntologyDefinitionStatus,
): OntologyDefinitionStatus {
  if (status === "Published" || status === "Versioned" || status === "Retired") {
    return "Approved";
  }
  return status;
}

export function getNextOntologyStatuses(
  status: OntologyDefinitionStatus,
): OntologyDefinitionStatus[] {
  return ONTOLOGY_NEXT_STATUSES[status];
}

const ONTOLOGY_STATUS_ACTION_LABELS: Record<OntologyDefinitionStatus, string> = {
  Draft: "Revert to Draft",
  Validated: "Validate",
  Approved: "Approve",
  Published: "Publish",
  Versioned: "Version",
  Retired: "Retire",
};

export function getOntologyStatusActionLabel(status: OntologyDefinitionStatus): string {
  return ONTOLOGY_STATUS_ACTION_LABELS[status];
}

export function updateOntologyStatus(
  ontologyId: string,
  status: OntologyDefinitionStatus,
): Promise<OntologyDefinitionResponse> {
  return apiFetch<OntologyDefinitionResponse>(`/ontologies/${ontologyId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteOntology(ontologyId: string): Promise<void> {
  return apiFetch<void>(`/ontologies/${ontologyId}`, {
    method: "DELETE",
  });
}

export function materializeOntology(ontologyId: string): Promise<OntologyDefinitionResponse> {
  return apiFetch<OntologyDefinitionResponse>(`/ontologies/${ontologyId}/materialize`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

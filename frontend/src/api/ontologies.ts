import { apiFetch } from "./client";

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

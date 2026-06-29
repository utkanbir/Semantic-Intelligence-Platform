import { apiFetch } from "./client";

export type ApplicationStatus =
  | "created"
  | "provisioned"
  | "active"
  | "evolving"
  | "retired";

export interface ApplicationWorkspaceResponse {
  id: string;
  application_id: string;
  status: string;
  postgres_schema: string;
  minio_namespace: string;
  fuseki_dataset: string;
  qdrant_collection: string;
  metadata_domain: string;
  ontology_namespace: string;
  agent_namespace: string;
  product_registry_namespace: string;
  agent_registry_namespace: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface ApplicationResponse {
  id: string;
  key: string;
  name: string;
  status: ApplicationStatus;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  workspace: ApplicationWorkspaceResponse;
}

export function listApplications(): Promise<ApplicationResponse[]> {
  return apiFetch<ApplicationResponse[]>("/applications");
}

export function getApplication(id: string): Promise<ApplicationResponse> {
  return apiFetch<ApplicationResponse>(`/applications/${id}`);
}

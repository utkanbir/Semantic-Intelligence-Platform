import { apiFetch } from "./client";

export type KnowledgeGraphRegistryStatus =
  | "Created"
  | "Populated"
  | "Updated"
  | "Archived";

export interface KnowledgeGraphRegistryResponse {
  id: string;
  application_id: string;
  status: KnowledgeGraphRegistryStatus;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  populated_at: string | null;
  graph_updated_at: string | null;
  archived_at: string | null;
  graph_metadata: Record<string, unknown>;
  bound_ontology_ids: string[];
}

export function listKnowledgeGraphs(
  applicationId: string,
  graphStatus?: KnowledgeGraphRegistryStatus,
): Promise<KnowledgeGraphRegistryResponse[]> {
  const params = new URLSearchParams({ application_id: applicationId });
  if (graphStatus) {
    params.set("graph_status", graphStatus);
  }
  return apiFetch<KnowledgeGraphRegistryResponse[]>(`/knowledge-graphs?${params}`);
}

export function getKnowledgeGraph(
  registryId: string,
): Promise<KnowledgeGraphRegistryResponse> {
  return apiFetch<KnowledgeGraphRegistryResponse>(`/knowledge-graphs/${registryId}`);
}

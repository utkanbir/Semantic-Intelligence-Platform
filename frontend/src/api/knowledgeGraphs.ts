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

export interface KnowledgeGraphRegistryCreateRequest {
  application_id: string;
  title: string;
  created_by?: string;
  description?: string;
  graph_metadata?: Record<string, unknown>;
  bound_ontology_ids?: string[];
}

export function createKnowledgeGraph(
  payload: KnowledgeGraphRegistryCreateRequest,
): Promise<KnowledgeGraphRegistryResponse> {
  return apiFetch<KnowledgeGraphRegistryResponse>("/knowledge-graphs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

const KG_NEXT_STATUSES: Record<KnowledgeGraphRegistryStatus, KnowledgeGraphRegistryStatus[]> = {
  Created: ["Populated"],
  Populated: ["Updated", "Archived"],
  Updated: ["Archived"],
  Archived: [],
};

export function getNextKnowledgeGraphStatuses(
  status: KnowledgeGraphRegistryStatus,
): KnowledgeGraphRegistryStatus[] {
  return KG_NEXT_STATUSES[status];
}

const KG_STATUS_ACTION_LABELS: Record<KnowledgeGraphRegistryStatus, string> = {
  Created: "Revert to Created",
  Populated: "Populate",
  Updated: "Update",
  Archived: "Archive",
};

export function getKnowledgeGraphStatusActionLabel(
  status: KnowledgeGraphRegistryStatus,
): string {
  return KG_STATUS_ACTION_LABELS[status];
}

export function updateKnowledgeGraphStatus(
  registryId: string,
  status: KnowledgeGraphRegistryStatus,
): Promise<KnowledgeGraphRegistryResponse> {
  return apiFetch<KnowledgeGraphRegistryResponse>(`/knowledge-graphs/${registryId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export interface KnowledgeGraphRegistryUpdateRequest {
  title?: string;
  description?: string | null;
  graph_metadata?: Record<string, unknown>;
  bound_ontology_ids?: string[];
}

export function updateKnowledgeGraph(
  registryId: string,
  payload: KnowledgeGraphRegistryUpdateRequest,
): Promise<KnowledgeGraphRegistryResponse> {
  return apiFetch<KnowledgeGraphRegistryResponse>(`/knowledge-graphs/${registryId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function canEditKnowledgeGraphBindings(
  registry: KnowledgeGraphRegistryResponse,
): boolean {
  return registry.status !== "Archived";
}

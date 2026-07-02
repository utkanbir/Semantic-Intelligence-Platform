import { apiFetch } from "./client";

export type SemanticConnectorType = "ontology_store" | "knowledge_graph_store";

export type SemanticConnectorStatus = "Active" | "Retired";

export interface SemanticConnectorResponse {
  id: string;
  connector_key: string;
  connector_type: SemanticConnectorType;
  status: SemanticConnectorStatus;
  title: string;
  description: string | null;
  technology_adapter_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  connector_configuration: Record<string, unknown>;
}

export interface SemanticConnectorCreateRequest {
  connector_key: string;
  connector_type: SemanticConnectorType;
  title: string;
  technology_adapter_id: string;
  created_by?: string;
  description?: string;
  connector_configuration?: Record<string, unknown>;
}

export const SEMANTIC_CONNECTOR_TYPES: SemanticConnectorType[] = [
  "ontology_store",
  "knowledge_graph_store",
];

export function listSemanticConnectors(options?: {
  connectorType?: SemanticConnectorType;
  activeOnly?: boolean;
}): Promise<SemanticConnectorResponse[]> {
  const params = new URLSearchParams();
  if (options?.connectorType) {
    params.set("connector_type", options.connectorType);
  }
  if (options?.activeOnly) {
    params.set("active_only", "true");
  }
  const query = params.toString();
  return apiFetch<SemanticConnectorResponse[]>(
    query ? `/semantic-connectors?${query}` : "/semantic-connectors",
  );
}

export function createSemanticConnector(
  payload: SemanticConnectorCreateRequest,
): Promise<SemanticConnectorResponse> {
  return apiFetch<SemanticConnectorResponse>("/semantic-connectors", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getSemanticConnector(connectorId: string): Promise<SemanticConnectorResponse> {
  return apiFetch<SemanticConnectorResponse>(`/semantic-connectors/${connectorId}`);
}

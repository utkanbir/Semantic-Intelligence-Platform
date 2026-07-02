import { apiFetch } from "./client";

export type ConnectorType =
  | "database"
  | "object_storage"
  | "file_system"
  | "ontology_knowledge_graph";

export type ConnectorStatus =
  | "Registered"
  | "Configured"
  | "Active"
  | "Deprecated"
  | "Retired";

export interface ConnectorResponse {
  id: string;
  connector_type: ConnectorType;
  connector_key: string;
  status: ConnectorStatus;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  configured_at: string | null;
  activated_at: string | null;
  deprecated_at: string | null;
  retired_at: string | null;
  connector_configuration: Record<string, unknown>;
}

export interface ConnectorPingResponse {
  status: string;
  connector_type: string;
}

export const CONNECTOR_TYPES: ConnectorType[] = [
  "database",
  "object_storage",
  "file_system",
  "ontology_knowledge_graph",
];

export const CONNECTOR_TYPE_LABELS: Record<ConnectorType, string> = {
  database: "Database",
  object_storage: "Object storage",
  file_system: "File system",
  ontology_knowledge_graph: "Ontology / knowledge graph",
};

export function listConnectors(options?: {
  connectorType?: ConnectorType;
  status?: ConnectorStatus;
}): Promise<ConnectorResponse[]> {
  const params = new URLSearchParams();
  if (options?.connectorType) {
    params.set("connector_type", options.connectorType);
  }
  if (options?.status) {
    params.set("adapter_status", options.status);
  }
  const query = params.toString();
  return apiFetch<ConnectorResponse[]>(`/connectors${query ? `?${query}` : ""}`);
}

export interface ConnectorCreateRequest {
  connector_type: ConnectorType;
  connector_key: string;
  title: string;
  created_by?: string;
  description?: string;
  connector_configuration?: Record<string, unknown>;
}

export function createConnector(
  payload: ConnectorCreateRequest,
): Promise<ConnectorResponse> {
  return apiFetch<ConnectorResponse>("/connectors", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

const CONNECTOR_NEXT_STATUSES: Record<ConnectorStatus, ConnectorStatus[]> = {
  Registered: ["Configured"],
  Configured: ["Active", "Registered"],
  Active: ["Deprecated"],
  Deprecated: ["Retired"],
  Retired: [],
};

export function getNextConnectorStatuses(status: ConnectorStatus): ConnectorStatus[] {
  return CONNECTOR_NEXT_STATUSES[status];
}

const CONNECTOR_STATUS_ACTION_LABELS: Record<ConnectorStatus, string> = {
  Registered: "Revert to Registered",
  Configured: "Configure",
  Active: "Activate",
  Deprecated: "Deprecate",
  Retired: "Retire",
};

export function getConnectorStatusActionLabel(status: ConnectorStatus): string {
  return CONNECTOR_STATUS_ACTION_LABELS[status];
}

export function updateConnectorStatus(
  connectorId: string,
  status: ConnectorStatus,
): Promise<ConnectorResponse> {
  return apiFetch<ConnectorResponse>(`/connectors/${connectorId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function canPingConnector(connector: ConnectorResponse): boolean {
  return connector.status === "Active";
}

export function pingConnector(connectorId: string): Promise<ConnectorPingResponse> {
  return apiFetch<ConnectorPingResponse>(`/connectors/${connectorId}/ping`, {
    method: "POST",
  });
}

/** @deprecated Use connector types from this module */
export type TechnologyType = ConnectorType;
/** @deprecated Use ConnectorResponse */
export type TechnologyAdapterResponse = ConnectorResponse;
/** @deprecated Use ConnectorStatus */
export type TechnologyAdapterStatus = ConnectorStatus;
/** @deprecated Use CONNECTOR_TYPES */
export const TECHNOLOGY_TYPES = CONNECTOR_TYPES;
/** @deprecated Use listConnectors */
export const listAdapters = listConnectors;
/** @deprecated Use createConnector */
export const createAdapter = createConnector;
/** @deprecated Use updateConnectorStatus */
export const updateAdapterStatus = updateConnectorStatus;
/** @deprecated Use canPingConnector */
export const canPingAdapter = canPingConnector;
/** @deprecated Use pingConnector */
export const pingAdapter = pingConnector;
/** @deprecated Use getNextConnectorStatuses */
export const getNextAdapterStatuses = getNextConnectorStatuses;
/** @deprecated Use getConnectorStatusActionLabel */
export const getAdapterStatusActionLabel = getConnectorStatusActionLabel;

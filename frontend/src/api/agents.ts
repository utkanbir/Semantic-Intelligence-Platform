import { apiFetch } from "./client";

export type AgentDefinitionStatus =
  | "Draft"
  | "Approved"
  | "Active"
  | "Versioned"
  | "Retired";

export interface AgentDefinitionResponse {
  id: string;
  application_id: string;
  version_number: number;
  previous_version_id: string | null;
  status: AgentDefinitionStatus;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  activated_at: string | null;
  version_created_at: string | null;
  agent_definition: Record<string, unknown>;
  bound_product_ids: string[];
}

export function listAgents(applicationId: string): Promise<AgentDefinitionResponse[]> {
  const params = new URLSearchParams({ application_id: applicationId });
  return apiFetch<AgentDefinitionResponse[]>(`/agents?${params}`);
}

export interface AgentDefinitionCreateRequest {
  application_id: string;
  title: string;
  created_by?: string;
  description?: string;
  agent_definition?: Record<string, unknown>;
  bound_product_ids?: string[];
}

export function createAgent(
  payload: AgentDefinitionCreateRequest,
): Promise<AgentDefinitionResponse> {
  return apiFetch<AgentDefinitionResponse>("/agents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface AgentDefinitionUpdateRequest {
  title?: string;
  description?: string | null;
  agent_definition?: Record<string, unknown>;
  bound_product_ids?: string[];
}

export function updateAgent(
  agentId: string,
  payload: AgentDefinitionUpdateRequest,
): Promise<AgentDefinitionResponse> {
  return apiFetch<AgentDefinitionResponse>(`/agents/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

const AGENT_NEXT_STATUSES: Record<AgentDefinitionStatus, AgentDefinitionStatus[]> = {
  Draft: ["Approved"],
  Approved: ["Active", "Draft"],
  Active: ["Versioned"],
  Versioned: ["Retired"],
  Retired: [],
};

export function getNextAgentStatuses(status: AgentDefinitionStatus): AgentDefinitionStatus[] {
  return AGENT_NEXT_STATUSES[status];
}

const AGENT_STATUS_ACTION_LABELS: Record<AgentDefinitionStatus, string> = {
  Draft: "Revert to Draft",
  Approved: "Approve",
  Active: "Activate",
  Versioned: "Version",
  Retired: "Retire",
};

export function getAgentStatusActionLabel(status: AgentDefinitionStatus): string {
  return AGENT_STATUS_ACTION_LABELS[status];
}

export function updateAgentStatus(
  agentId: string,
  status: AgentDefinitionStatus,
): Promise<AgentDefinitionResponse> {
  return apiFetch<AgentDefinitionResponse>(`/agents/${agentId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

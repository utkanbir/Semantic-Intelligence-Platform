import { apiFetch } from "./client";

export type AgentRunStatus = "Pending" | "Running" | "Completed" | "Failed";

export interface AgentRunResponse {
  id: string;
  application_id: string;
  agent_definition_id: string;
  status: AgentRunStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  run_payload: Record<string, unknown>;
  run_result: Record<string, unknown> | null;
}

export function listAgentRuns(
  applicationId: string,
  runStatus?: string,
): Promise<AgentRunResponse[]> {
  const params = new URLSearchParams({ application_id: applicationId });
  if (runStatus !== undefined) {
    params.set("run_status", runStatus);
  }
  return apiFetch<AgentRunResponse[]>(`/agent-runs?${params}`);
}

export function getAgentRun(runId: string): Promise<AgentRunResponse> {
  return apiFetch<AgentRunResponse>(`/agent-runs/${runId}`);
}

export interface AgentRunCreateRequest {
  application_id: string;
  agent_definition_id: string;
  created_by?: string;
  run_payload?: Record<string, unknown>;
}

export function startAgentRun(payload: AgentRunCreateRequest): Promise<AgentRunResponse> {
  return apiFetch<AgentRunResponse>("/agent-runs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

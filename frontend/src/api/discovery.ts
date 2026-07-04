import { apiFetch } from "./client";

export type DiscoverySessionStatus = "Active" | "Paused" | "Completed" | "Archived";

export interface CurrentPhaseResponse {
  phase_number: number;
  phase_name: string;
}

export interface DiscoveryPhaseHistoryResponse {
  id: string;
  session_id: string;
  phase_number: number;
  phase_name: string;
  entered_at: string;
  notes: string | null;
}

export interface DiscoverySessionResponse {
  id: string;
  application_id: string;
  status: DiscoverySessionStatus;
  title: string;
  started_by: string;
  started_at: string;
  completed_at: string | null;
  intent_summary: string | null;
  discovery_notes: string | null;
  recommendations: unknown[] | null;
  generated_blueprint_id: string | null;
  conversation_history: unknown[] | null;
  current_phase: CurrentPhaseResponse | null;
  phase_history: DiscoveryPhaseHistoryResponse[];
}

export function listDiscoverySessions(
  applicationId: string,
): Promise<DiscoverySessionResponse[]> {
  const params = new URLSearchParams({ application_id: applicationId });
  return apiFetch<DiscoverySessionResponse[]>(`/discovery-sessions?${params}`);
}

export interface DiscoverySessionCreateRequest {
  application_id: string;
  title: string;
  started_by?: string;
}

export function createDiscoverySession(
  payload: DiscoverySessionCreateRequest,
): Promise<DiscoverySessionResponse> {
  return apiFetch<DiscoverySessionResponse>("/discovery-sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

const DISCOVERY_NEXT_STATUSES: Record<DiscoverySessionStatus, DiscoverySessionStatus[]> = {
  Active: ["Paused", "Completed", "Archived"],
  Paused: ["Active", "Completed", "Archived"],
  Completed: ["Archived"],
  Archived: [],
};

export function getNextDiscoveryStatuses(
  status: DiscoverySessionStatus,
): DiscoverySessionStatus[] {
  return DISCOVERY_NEXT_STATUSES[status];
}

const DISCOVERY_STATUS_ACTION_LABELS: Record<DiscoverySessionStatus, string> = {
  Active: "Resume",
  Paused: "Pause",
  Completed: "Complete",
  Archived: "Archive",
};

export function getDiscoveryStatusActionLabel(status: DiscoverySessionStatus): string {
  return DISCOVERY_STATUS_ACTION_LABELS[status];
}

export function updateDiscoverySessionStatus(
  sessionId: string,
  status: DiscoverySessionStatus,
): Promise<DiscoverySessionResponse> {
  return apiFetch<DiscoverySessionResponse>(`/discovery-sessions/${sessionId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

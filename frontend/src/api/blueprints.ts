import { apiFetch } from "./client";

export type BlueprintStatus =
  | "Draft"
  | "Review"
  | "Approved"
  | "Versioned"
  | "Retired";

export interface BlueprintResponse {
  id: string;
  application_id: string;
  version_number: number;
  status: BlueprintStatus;
  title: string;
  goal: string | null;
  outcome: string | null;
  created_by: string;
  created_at: string;
  approved_at: string | null;
  version_created_at: string | null;
  blueprint_snapshot: Record<string, unknown>;
}

export function listBlueprints(applicationId: string): Promise<BlueprintResponse[]> {
  const params = new URLSearchParams({ application_id: applicationId });
  return apiFetch<BlueprintResponse[]>(`/blueprints?${params}`);
}

export interface BlueprintCreateRequest {
  application_id: string;
  title: string;
  created_by?: string;
  goal?: string;
  outcome?: string;
  blueprint_snapshot?: Record<string, unknown>;
}

export function createBlueprint(
  payload: BlueprintCreateRequest,
): Promise<BlueprintResponse> {
  return apiFetch<BlueprintResponse>("/blueprints", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

const BLUEPRINT_NEXT_STATUSES: Record<BlueprintStatus, BlueprintStatus[]> = {
  Draft: ["Review"],
  Review: ["Approved", "Draft"],
  Approved: ["Versioned"],
  Versioned: ["Retired"],
  Retired: [],
};

export function getNextBlueprintStatuses(status: BlueprintStatus): BlueprintStatus[] {
  return BLUEPRINT_NEXT_STATUSES[status];
}

const BLUEPRINT_STATUS_ACTION_LABELS: Record<BlueprintStatus, string> = {
  Draft: "Revert to Draft",
  Review: "Submit for review",
  Approved: "Approve",
  Versioned: "Version",
  Retired: "Retire",
};

export function getBlueprintStatusActionLabel(status: BlueprintStatus): string {
  return BLUEPRINT_STATUS_ACTION_LABELS[status];
}

export function updateBlueprintStatus(
  blueprintId: string,
  status: BlueprintStatus,
): Promise<BlueprintResponse> {
  return apiFetch<BlueprintResponse>(`/blueprints/${blueprintId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

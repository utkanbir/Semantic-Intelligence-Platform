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

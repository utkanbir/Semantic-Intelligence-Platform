import { apiFetch } from "./client";

export type PolicyDefinitionStatus = "Draft" | "Approved" | "Active" | "Retired";

export interface PolicyDefinitionResponse {
  id: string;
  policy_key: string;
  status: PolicyDefinitionStatus;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  activated_at: string | null;
  retired_at: string | null;
  policy_definition: Record<string, unknown>;
}

export function listPolicies(): Promise<PolicyDefinitionResponse[]> {
  return apiFetch<PolicyDefinitionResponse[]>("/policies");
}

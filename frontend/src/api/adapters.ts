import { apiFetch } from "./client";

export type TechnologyType =
  | "postgresql"
  | "minio"
  | "fuseki"
  | "qdrant"
  | "openmetadata"
  | "openai";

export type TechnologyAdapterStatus =
  | "Registered"
  | "Configured"
  | "Active"
  | "Deprecated"
  | "Retired";

export interface TechnologyAdapterResponse {
  id: string;
  technology_type: TechnologyType;
  adapter_key: string;
  status: TechnologyAdapterStatus;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  configured_at: string | null;
  activated_at: string | null;
  deprecated_at: string | null;
  retired_at: string | null;
  adapter_configuration: Record<string, unknown>;
}

export interface AdapterPingResponse {
  status: string;
  technology: string;
}

export const TECHNOLOGY_TYPES: TechnologyType[] = [
  "postgresql",
  "minio",
  "fuseki",
  "qdrant",
  "openmetadata",
  "openai",
];

export function listAdapters(): Promise<TechnologyAdapterResponse[]> {
  return apiFetch<TechnologyAdapterResponse[]>("/adapters");
}

export interface TechnologyAdapterCreateRequest {
  technology_type: TechnologyType;
  adapter_key: string;
  title: string;
  created_by?: string;
  description?: string;
  adapter_configuration?: Record<string, unknown>;
}

export function createAdapter(
  payload: TechnologyAdapterCreateRequest,
): Promise<TechnologyAdapterResponse> {
  return apiFetch<TechnologyAdapterResponse>("/adapters", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

const ADAPTER_NEXT_STATUSES: Record<TechnologyAdapterStatus, TechnologyAdapterStatus[]> = {
  Registered: ["Configured"],
  Configured: ["Active", "Registered"],
  Active: ["Deprecated"],
  Deprecated: ["Retired"],
  Retired: [],
};

export function getNextAdapterStatuses(
  status: TechnologyAdapterStatus,
): TechnologyAdapterStatus[] {
  return ADAPTER_NEXT_STATUSES[status];
}

const ADAPTER_STATUS_ACTION_LABELS: Record<TechnologyAdapterStatus, string> = {
  Registered: "Revert to Registered",
  Configured: "Configure",
  Active: "Activate",
  Deprecated: "Deprecate",
  Retired: "Retire",
};

export function getAdapterStatusActionLabel(status: TechnologyAdapterStatus): string {
  return ADAPTER_STATUS_ACTION_LABELS[status];
}

export function updateAdapterStatus(
  adapterId: string,
  status: TechnologyAdapterStatus,
): Promise<TechnologyAdapterResponse> {
  return apiFetch<TechnologyAdapterResponse>(`/adapters/${adapterId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function canPingAdapter(adapter: TechnologyAdapterResponse): boolean {
  return adapter.status === "Active";
}

export function pingAdapter(adapterId: string): Promise<AdapterPingResponse> {
  return apiFetch<AdapterPingResponse>(`/adapters/${adapterId}/ping`, {
    method: "POST",
  });
}

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

export function listAdapters(): Promise<TechnologyAdapterResponse[]> {
  return apiFetch<TechnologyAdapterResponse[]>("/adapters");
}

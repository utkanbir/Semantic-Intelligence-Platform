import { apiFetch } from "./client";

export type AssetType = "Application" | "DiscoverySession" | "Blueprint";

export const ASSET_TYPES: AssetType[] = ["Application", "DiscoverySession", "Blueprint"];

export type AssetRecordStatus =
  | "Draft"
  | "Active"
  | "Published"
  | "Deprecated"
  | "Retired";

export interface AssetRecordResponse {
  id: string;
  application_id: string;
  asset_type: AssetType;
  resource_type: string;
  resource_id: string;
  status: AssetRecordStatus;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

export function listAssets(
  applicationId: string,
  assetType?: AssetType,
): Promise<AssetRecordResponse[]> {
  const params = new URLSearchParams({ application_id: applicationId });
  if (assetType) {
    params.set("asset_type", assetType);
  }
  return apiFetch<AssetRecordResponse[]>(`/assets?${params}`);
}

export function getAsset(assetId: string): Promise<AssetRecordResponse> {
  return apiFetch<AssetRecordResponse>(`/assets/${assetId}`);
}

export interface AssetRecordCreateRequest {
  application_id: string;
  asset_type: AssetType;
  resource_type: string;
  resource_id: string;
  title: string;
  created_by?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export function createAsset(payload: AssetRecordCreateRequest): Promise<AssetRecordResponse> {
  return apiFetch<AssetRecordResponse>("/assets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

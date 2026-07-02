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

export function createAsset(payload: AssetRecordCreateRequest): Promise<AssetRecordResponse> {
  return apiFetch<AssetRecordResponse>("/assets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

const ASSET_NEXT_STATUSES: Record<AssetRecordStatus, AssetRecordStatus[]> = {
  Draft: ["Active"],
  Active: ["Published", "Draft"],
  Published: ["Deprecated"],
  Deprecated: ["Retired", "Active"],
  Retired: [],
};

export function getNextAssetStatuses(status: AssetRecordStatus): AssetRecordStatus[] {
  return ASSET_NEXT_STATUSES[status];
}

const ASSET_STATUS_ACTION_LABELS: Record<AssetRecordStatus, string> = {
  Draft: "Revert to Draft",
  Active: "Activate",
  Published: "Publish",
  Deprecated: "Deprecate",
  Retired: "Retire",
};

export function getAssetStatusActionLabel(status: AssetRecordStatus): string {
  return ASSET_STATUS_ACTION_LABELS[status];
}

export function updateAssetStatus(
  assetId: string,
  status: AssetRecordStatus,
): Promise<AssetRecordResponse> {
  return apiFetch<AssetRecordResponse>(`/assets/${assetId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

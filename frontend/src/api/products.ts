import { apiFetch } from "./client";

export type PublishedDataProductStatus =
  | "Draft"
  | "Certified"
  | "Published"
  | "Versioned"
  | "Retired";

export interface PublishedDataProductResponse {
  id: string;
  application_id: string;
  version_number: number;
  previous_version_id: string | null;
  status: PublishedDataProductStatus;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  certified_at: string | null;
  published_at: string | null;
  version_created_at: string | null;
  product_definition: Record<string, unknown>;
  source_asset_record_ids: string[];
}

export function listProducts(applicationId: string): Promise<PublishedDataProductResponse[]> {
  const params = new URLSearchParams({ application_id: applicationId });
  return apiFetch<PublishedDataProductResponse[]>(`/products?${params}`);
}

export interface PublishedDataProductCreateRequest {
  application_id: string;
  title: string;
  created_by?: string;
  description?: string;
  product_definition?: Record<string, unknown>;
  source_asset_record_ids?: string[];
}

export function createProduct(
  payload: PublishedDataProductCreateRequest,
): Promise<PublishedDataProductResponse> {
  return apiFetch<PublishedDataProductResponse>("/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

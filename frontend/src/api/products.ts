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

const PRODUCT_NEXT_STATUSES: Record<PublishedDataProductStatus, PublishedDataProductStatus[]> = {
  Draft: ["Certified"],
  Certified: ["Published", "Draft"],
  Published: ["Versioned"],
  Versioned: ["Retired"],
  Retired: [],
};

export function getNextProductStatuses(
  status: PublishedDataProductStatus,
): PublishedDataProductStatus[] {
  return PRODUCT_NEXT_STATUSES[status];
}

const PRODUCT_STATUS_ACTION_LABELS: Record<PublishedDataProductStatus, string> = {
  Draft: "Revert to Draft",
  Certified: "Certify",
  Published: "Publish",
  Versioned: "Version",
  Retired: "Retire",
};

export function getProductStatusActionLabel(status: PublishedDataProductStatus): string {
  return PRODUCT_STATUS_ACTION_LABELS[status];
}

export function updateProductStatus(
  productId: string,
  status: PublishedDataProductStatus,
): Promise<PublishedDataProductResponse> {
  return apiFetch<PublishedDataProductResponse>(`/products/${productId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/** D-003: agents may bind only Published or Versioned products. */
export const CONSUMABLE_PRODUCT_STATUSES: PublishedDataProductStatus[] = [
  "Published",
  "Versioned",
];

export function isConsumableProduct(product: PublishedDataProductResponse): boolean {
  return CONSUMABLE_PRODUCT_STATUSES.includes(product.status);
}

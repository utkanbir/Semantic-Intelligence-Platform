import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canForkProduct,
  forkProductVersion,
  type PublishedDataProductResponse,
} from "./products";

const mockProduct: PublishedDataProductResponse = {
  id: "prod-1",
  application_id: "app-1",
  version_number: 1,
  previous_version_id: null,
  status: "Published",
  title: "Customer 360 Product",
  description: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  certified_at: "2025-06-02T10:00:00Z",
  published_at: "2025-06-03T10:00:00Z",
  version_created_at: null,
  product_definition: {},
  source_asset_record_ids: [],
};

describe("products version fork API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("canForkProduct allows Published and Versioned", () => {
    expect(canForkProduct({ ...mockProduct, status: "Published" })).toBe(true);
    expect(canForkProduct({ ...mockProduct, status: "Versioned" })).toBe(true);
    expect(canForkProduct({ ...mockProduct, status: "Draft" })).toBe(false);
  });

  it("forkProductVersion POSTs to versions endpoint", async () => {
    const forked = {
      ...mockProduct,
      id: "prod-2",
      version_number: 2,
      previous_version_id: "prod-1",
      status: "Draft" as const,
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(forked), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(forkProductVersion("prod-1")).resolves.toEqual(forked);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/products/prod-1/versions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
  });
});

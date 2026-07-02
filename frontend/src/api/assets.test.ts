import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAsset, listAssets, type AssetRecordResponse } from "./assets";

const mockAsset: AssetRecordResponse = {
  id: "asset-1",
  application_id: "app-1",
  asset_type: "Blueprint",
  resource_type: "Blueprint",
  resource_id: "bp-1",
  status: "Active",
  title: "Customer Blueprint",
  description: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  metadata: null,
};

describe("assets API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("listAssets calls GET with application_id", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([mockAsset]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(listAssets("app-1")).resolves.toEqual([mockAsset]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/assets?application_id=app-1",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("listAssets passes optional asset_type filter", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await listAssets("app-1", "Blueprint");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/assets?application_id=app-1&asset_type=Blueprint",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("getAsset calls GET for a single asset record", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockAsset), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getAsset("asset-1")).resolves.toEqual(mockAsset);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/assets/asset-1",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });
});

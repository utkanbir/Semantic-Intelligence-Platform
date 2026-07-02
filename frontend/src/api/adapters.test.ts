import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canPingAdapter,
  createAdapter,
  getNextAdapterStatuses,
  pingAdapter,
  updateAdapterStatus,
  type TechnologyAdapterResponse,
} from "./adapters";

const mockAdapter: TechnologyAdapterResponse = {
  id: "adapter-1",
  technology_type: "postgresql",
  adapter_key: "primary-db",
  status: "Active",
  title: "Primary PostgreSQL",
  description: null,
  created_by: "admin",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  configured_at: "2025-06-02T10:00:00Z",
  activated_at: "2025-06-03T10:00:00Z",
  deprecated_at: null,
  retired_at: null,
  adapter_configuration: {},
};

describe("adapters API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("getNextAdapterStatuses maps Registered to Configured", () => {
    expect(getNextAdapterStatuses("Registered")).toEqual(["Configured"]);
    expect(getNextAdapterStatuses("Active")).toEqual(["Deprecated"]);
  });

  it("canPingAdapter allows Active only", () => {
    expect(canPingAdapter({ ...mockAdapter, status: "Active" })).toBe(true);
    expect(canPingAdapter({ ...mockAdapter, status: "Registered" })).toBe(false);
  });

  it("createAdapter POSTs to adapters endpoint", async () => {
    const created = { ...mockAdapter, status: "Registered" as const };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(created), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      createAdapter({
        technology_type: "openmetadata",
        adapter_key: "om-dev",
        title: "OpenMetadata Dev",
      }),
    ).resolves.toEqual(created);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/adapters",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          technology_type: "openmetadata",
          adapter_key: "om-dev",
          title: "OpenMetadata Dev",
        }),
      }),
    );
  });

  it("updateAdapterStatus PATCHes status endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...mockAdapter, status: "Configured" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await updateAdapterStatus("adapter-1", "Configured");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/adapters/adapter-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "Configured" }),
      }),
    );
  });

  it("pingAdapter POSTs to ping endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", technology: "postgresql" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(pingAdapter("adapter-1")).resolves.toEqual({
      status: "ok",
      technology: "postgresql",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/adapters/adapter-1/ping",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

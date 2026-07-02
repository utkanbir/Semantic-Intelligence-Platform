import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canPingConnector,
  createConnector,
  getNextConnectorStatuses,
  pingConnector,
  updateConnectorStatus,
  type ConnectorResponse,
} from "./adapters";

const mockConnector: ConnectorResponse = {
  id: "connector-1",
  connector_type: "database",
  connector_key: "primary-db",
  status: "Active",
  title: "Primary Database",
  description: null,
  created_by: "admin",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  configured_at: "2025-06-02T10:00:00Z",
  activated_at: "2025-06-03T10:00:00Z",
  deprecated_at: null,
  retired_at: null,
  connector_configuration: {},
};

describe("connectors API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("getNextConnectorStatuses maps Registered to Configured", () => {
    expect(getNextConnectorStatuses("Registered")).toEqual(["Configured"]);
    expect(getNextConnectorStatuses("Active")).toEqual(["Deprecated"]);
  });

  it("canPingConnector allows Active only", () => {
    expect(canPingConnector({ ...mockConnector, status: "Active" })).toBe(true);
    expect(canPingConnector({ ...mockConnector, status: "Registered" })).toBe(false);
  });

  it("createConnector POSTs to connectors endpoint", async () => {
    const created = { ...mockConnector, status: "Registered" as const };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(created), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      createConnector({
        connector_type: "ontology_knowledge_graph",
        connector_key: "ontology-dev",
        title: "Ontology Store",
      }),
    ).resolves.toEqual(created);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/connectors",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          connector_type: "ontology_knowledge_graph",
          connector_key: "ontology-dev",
          title: "Ontology Store",
        }),
      }),
    );
  });

  it("updateConnectorStatus PATCHes status endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...mockConnector, status: "Configured" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await updateConnectorStatus("connector-1", "Configured");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/connectors/connector-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "Configured" }),
      }),
    );
  });

  it("pingConnector POSTs to ping endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", connector_type: "database" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(pingConnector("connector-1")).resolves.toEqual({
      status: "ok",
      connector_type: "database",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/connectors/connector-1/ping",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

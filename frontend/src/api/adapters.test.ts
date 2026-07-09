import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConnector,
  formatConnectorStatusLabel,
  getNextConnectorStatuses,
  provisionConnector,
  testConnectorConfiguration,
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

  it("getNextConnectorStatuses only exposes admin lifecycle actions", () => {
    expect(getNextConnectorStatuses("Registered")).toEqual([]);
    expect(getNextConnectorStatuses("Configured")).toEqual([]);
    expect(getNextConnectorStatuses("Active")).toEqual(["Deprecated"]);
    expect(getNextConnectorStatuses("Deprecated")).toEqual(["Retired"]);
  });

  it("formatConnectorStatusLabel maps Active to Ready", () => {
    expect(formatConnectorStatusLabel("Active")).toBe("Ready");
    expect(formatConnectorStatusLabel("Registered")).toBe("Registered");
  });

  it("createConnector POSTs to connectors endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockConnector), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      createConnector({
        connector_type: "ontology_knowledge_graph",
        title: "Ontology Store",
      }),
    ).resolves.toEqual(mockConnector);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/connectors",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          connector_type: "ontology_knowledge_graph",
          title: "Ontology Store",
        }),
      }),
    );
  });

  it("testConnectorConfiguration POSTs to test endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", connector_type: "database" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      testConnectorConfiguration({
        connector_type: "database",
        connector_configuration: { vendor: "postgresql" },
      }),
    ).resolves.toEqual({ status: "ok", connector_type: "database" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/connectors/test",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          connector_type: "database",
          connector_configuration: { vendor: "postgresql" },
        }),
      }),
    );
  });

  it("updateConnectorStatus PATCHes status endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...mockConnector, status: "Deprecated" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await updateConnectorStatus("connector-1", "Deprecated");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/connectors/connector-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "Deprecated" }),
      }),
    );
  });

  it("provisionConnector POSTs to provision endpoint", async () => {
    const provisionResult = {
      connector_id: "connector-1",
      status: "provisioned",
      endpoint: "http://minio.sip-dev.svc:9000",
      started_at: "2025-06-01T10:00:00Z",
      completed_at: "2025-06-01T10:00:05Z",
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(provisionResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(provisionConnector("connector-1")).resolves.toEqual(provisionResult);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/connectors/connector-1/provision",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

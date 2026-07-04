import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api";
import {
  createConnector,
  listConnectors,
  pingConnector,
  provisionConnector,
  updateConnectorStatus,
  type ConnectorResponse,
} from "../../api/adapters";
import { ConnectorsPage } from "./ConnectorsPage";

vi.mock("../../api/adapters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/adapters")>();
  return {
    ...actual,
    listConnectors: vi.fn(),
    createConnector: vi.fn(),
    provisionConnector: vi.fn(),
    updateConnectorStatus: vi.fn(),
    pingConnector: vi.fn(),
    canPingConnector: vi.fn((connector: { status: string }) => connector.status === "Active"),
    getNextConnectorStatuses: vi.fn((status: string) => {
      const map: Record<string, string[]> = {
        Registered: ["Configured"],
        Configured: ["Active", "Registered"],
        Active: ["Deprecated"],
        Deprecated: ["Retired"],
        Retired: [],
      };
      return map[status] ?? [];
    }),
    getConnectorStatusActionLabel: vi.fn((status: string) => {
      const labels: Record<string, string> = {
        Configured: "Configure",
        Active: "Activate",
        Registered: "Revert to Registered",
        Deprecated: "Deprecate",
        Retired: "Retire",
      };
      return labels[status] ?? status;
    }),
  };
});

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
  connector_configuration: {
    schema_version: "2",
    vendor: "postgresql",
    connection_method: "existing_instance",
    connection: { host: "db.local", port: "5432", database: "sip_db" },
  },
};

const registeredConnector: ConnectorResponse = {
  ...mockConnector,
  id: "connector-2",
  status: "Registered",
  title: "New Connector",
  connector_key: "new-key",
  configured_at: null,
  activated_at: null,
};

const newConnector: ConnectorResponse = {
  ...registeredConnector,
  title: "Dev PostgreSQL",
  connector_key: "dev-pg",
  connector_type: "database",
  connector_configuration: {
    schema_version: "2",
    vendor: "postgresql",
    connection_method: "existing_instance",
    connection: { host: "localhost", port: "5432", database: "sip_db" },
  },
};

const provisionedConnector: ConnectorResponse = {
  ...registeredConnector,
  id: "connector-prov-1",
  title: "Cluster MinIO",
  connector_key: "cluster-minio",
  connector_type: "object_storage",
  connector_configuration: {
    schema_version: "2",
    vendor: "minio",
    connection_method: "provision_in_cluster",
    connection: {},
  },
};

describe("ConnectorsPage", () => {
  beforeEach(() => {
    vi.mocked(listConnectors).mockReset();
    vi.mocked(createConnector).mockReset();
    vi.mocked(provisionConnector).mockReset();
    vi.mocked(updateConnectorStatus).mockReset();
    vi.mocked(pingConnector).mockReset();
  });

  it("renders loading then connectors table", async () => {
    vi.mocked(listConnectors).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockConnector]), 0);
        }),
    );

    render(<ConnectorsPage />);

    expect(screen.getByText("Loading connectors…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Primary Database")).toBeInTheDocument();
      expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    });

    expect(listConnectors).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Connectors" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Semantic connectors" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New connector" })).toBeInTheDocument();
  });

  it("renders empty state with New connector button", async () => {
    vi.mocked(listConnectors).mockResolvedValue([]);

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByText("No connectors yet.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "New connector" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Create connector")).not.toBeInTheDocument();
  });

  it("shows create form after clicking New connector on empty list", async () => {
    vi.mocked(listConnectors).mockResolvedValue([]);

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New connector" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New connector" }));

    expect(screen.getByLabelText("Create connector")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("allows cancel on create form when list is empty", async () => {
    vi.mocked(listConnectors).mockResolvedValue([]);

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New connector" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New connector" }));
    expect(screen.getByLabelText("Create connector")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Create connector")).not.toBeInTheDocument();
    expect(screen.getByText("No connectors yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New connector" })).toBeInTheDocument();
  });

  it("creates connector with vendor and connection details", async () => {
    vi.mocked(listConnectors)
      .mockResolvedValueOnce([])
      .mockResolvedValue([newConnector]);
    vi.mocked(createConnector).mockResolvedValue(newConnector);

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New connector" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New connector" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Create connector")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Dev PostgreSQL" } });
    fireEvent.change(screen.getByLabelText("Host"), { target: { value: "localhost" } });
    fireEvent.change(document.getElementById("connection-port")!, { target: { value: "5432" } });
    fireEvent.change(document.getElementById("connection-database")!, {
      target: { value: "sip_db" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create connector" }));

    await waitFor(() => {
      expect(createConnector).toHaveBeenCalledWith({
        connector_type: "database",
        title: "Dev PostgreSQL",
        connector_configuration: {
          schema_version: "2",
          vendor: "postgresql",
          connection_method: "existing_instance",
          connection: {
            host: "localhost",
            port: "5432",
            database: "sip_db",
            username: "",
            password: "",
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Dev PostgreSQL")).toBeInTheDocument();
    });
  });

  it("creates and provisions connector in cluster", async () => {
    vi.mocked(listConnectors)
      .mockResolvedValueOnce([])
      .mockResolvedValue([provisionedConnector]);
    vi.mocked(createConnector).mockResolvedValue(provisionedConnector);
    vi.mocked(provisionConnector).mockResolvedValue({
      connector_id: "connector-prov-1",
      status: "provisioned",
      endpoint: "http://minio.sip-dev.svc:9000",
      started_at: "2025-06-01T10:00:00Z",
      completed_at: "2025-06-01T10:00:05Z",
    });

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New connector" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New connector" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Create connector")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Object storage" }));
    fireEvent.click(screen.getByLabelText("Provision in cluster"));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Cluster MinIO" } });
    fireEvent.click(screen.getByRole("button", { name: "Create connector" }));

    await waitFor(() => {
      expect(createConnector).toHaveBeenCalledWith({
        connector_type: "object_storage",
        title: "Cluster MinIO",
        connector_configuration: {
          schema_version: "2",
          vendor: "minio",
          connection_method: "provision_in_cluster",
          connection: {},
        },
      });
    });

    await waitFor(() => {
      expect(provisionConnector).toHaveBeenCalledWith("connector-prov-1");
    });

    await waitFor(() => {
      expect(screen.getByText(/Connector provisioned/)).toBeInTheDocument();
      expect(screen.getByText("provisioned")).toBeInTheDocument();
      expect(screen.getByText("http://minio.sip-dev.svc:9000")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Host")).not.toBeInTheDocument();
  });

  it("updates vendor options when connector type changes", async () => {
    vi.mocked(listConnectors).mockResolvedValue([]);

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New connector" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New connector" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "PostgreSQL", pressed: true })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Ontology / knowledge graph" }));

    expect(screen.getByRole("button", { name: "Apache Jena Fuseki", pressed: true })).toBeInTheDocument();
    expect(screen.getByLabelText("SPARQL endpoint URL")).toBeInTheDocument();
  });

  it("selects vector database type and vendor via icon tiles", async () => {
    vi.mocked(listConnectors).mockResolvedValue([]);

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New connector" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New connector" }));

    fireEvent.click(screen.getByRole("button", { name: "Vector database" }));
    expect(screen.getByRole("button", { name: "Vector database", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qdrant", pressed: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Weaviate" }));
    expect(screen.getByRole("button", { name: "Weaviate", pressed: true })).toBeInTheDocument();
    expect(screen.getByLabelText("Endpoint URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Class name")).toBeInTheDocument();
  });

  it("configures registered connector via lifecycle action", async () => {
    const configuredConnector: ConnectorResponse = {
      ...registeredConnector,
      status: "Configured",
      configured_at: "2025-06-02T10:00:00Z",
    };
    vi.mocked(listConnectors)
      .mockResolvedValueOnce([registeredConnector])
      .mockResolvedValueOnce([configuredConnector]);
    vi.mocked(updateConnectorStatus).mockResolvedValue(configuredConnector);

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Configure" }));

    await waitFor(() => {
      expect(updateConnectorStatus).toHaveBeenCalledWith("connector-2", "Configured");
    });
  });

  it("pings active connector and shows result", async () => {
    vi.mocked(listConnectors).mockResolvedValue([mockConnector]);
    vi.mocked(pingConnector).mockResolvedValue({ status: "ok", connector_type: "database" });

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Ping" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Ping" }));

    await waitFor(() => {
      expect(pingConnector).toHaveBeenCalledWith("connector-1");
    });

    await waitFor(() => {
      expect(screen.getByText("Ping: ok (database)")).toBeInTheDocument();
    });
  });

  it("renders error state", async () => {
    vi.mocked(listConnectors).mockRejectedValue(new ApiError("Server error", 500));

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });
});

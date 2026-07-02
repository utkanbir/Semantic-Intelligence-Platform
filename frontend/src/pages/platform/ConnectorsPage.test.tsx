import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api";
import {
  createAdapter,
  listAdapters,
  pingAdapter,
  updateAdapterStatus,
  type TechnologyAdapterResponse,
} from "../../api/adapters";
import { listSemanticConnectors } from "../../api/semanticConnectors";
import { ConnectorsPage } from "./ConnectorsPage";

vi.mock("../../api/adapters", () => ({
  listAdapters: vi.fn(),
  createAdapter: vi.fn(),
  updateAdapterStatus: vi.fn(),
  pingAdapter: vi.fn(),
  canPingAdapter: vi.fn((connector: { status: string }) => connector.status === "Active"),
  getNextAdapterStatuses: vi.fn((status: string) => {
    const map: Record<string, string[]> = {
      Registered: ["Configured"],
      Configured: ["Active", "Registered"],
      Active: ["Deprecated"],
      Deprecated: ["Retired"],
      Retired: [],
    };
    return map[status] ?? [];
  }),
  getAdapterStatusActionLabel: vi.fn((status: string) => {
    const labels: Record<string, string> = {
      Configured: "Configure",
      Active: "Activate",
      Registered: "Revert to Registered",
      Deprecated: "Deprecate",
      Retired: "Retire",
    };
    return labels[status] ?? status;
  }),
  TECHNOLOGY_TYPES: ["postgresql", "openmetadata"],
}));

vi.mock("../../api/semanticConnectors", () => ({
  listSemanticConnectors: vi.fn(),
  createSemanticConnector: vi.fn(),
  SEMANTIC_CONNECTOR_TYPES: ["ontology_store", "knowledge_graph_store"],
}));

const mockConnector: TechnologyAdapterResponse = {
  id: "connector-1",
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

const registeredConnector: TechnologyAdapterResponse = {
  ...mockConnector,
  id: "connector-2",
  status: "Registered",
  title: "New Connector",
  adapter_key: "new-key",
  configured_at: null,
  activated_at: null,
};

const newConnector: TechnologyAdapterResponse = {
  ...registeredConnector,
  title: "OpenMetadata Dev",
  adapter_key: "om-dev",
  technology_type: "openmetadata",
};

describe("ConnectorsPage", () => {
  beforeEach(() => {
    vi.mocked(listAdapters).mockReset();
    vi.mocked(listSemanticConnectors).mockReset();
    vi.mocked(createAdapter).mockReset();
    vi.mocked(updateAdapterStatus).mockReset();
    vi.mocked(pingAdapter).mockReset();
    vi.mocked(listSemanticConnectors).mockResolvedValue([]);
  });

  it("renders loading then infrastructure connectors table", async () => {
    vi.mocked(listAdapters).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockConnector]), 0);
        }),
    );

    render(<ConnectorsPage />);

    expect(screen.getByText("Loading infrastructure connectors…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Primary PostgreSQL")).toBeInTheDocument();
    });

    expect(listAdapters).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Connectors" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Infrastructure connectors" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Semantic connectors" })).toBeInTheDocument();
  });

  it("renders empty infrastructure state with create form", async () => {
    vi.mocked(listAdapters).mockResolvedValue([]);

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByText("No infrastructure connectors yet.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Create infrastructure connector")).toBeInTheDocument();
  });

  it("creates infrastructure connector and refreshes list", async () => {
    vi.mocked(listAdapters)
      .mockResolvedValueOnce([])
      .mockResolvedValue([newConnector]);
    vi.mocked(createAdapter).mockResolvedValue(newConnector);

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create infrastructure connector")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Connector key"), { target: { value: "om-dev" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "OpenMetadata Dev" } });
    fireEvent.change(screen.getByLabelText("Connector type"), {
      target: { value: "openmetadata" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create connector" }));

    await waitFor(() => {
      expect(createAdapter).toHaveBeenCalledWith({
        technology_type: "openmetadata",
        adapter_key: "om-dev",
        title: "OpenMetadata Dev",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("OpenMetadata Dev")).toBeInTheDocument();
    });
  });

  it("configures registered connector via lifecycle action", async () => {
    const configuredConnector: TechnologyAdapterResponse = {
      ...registeredConnector,
      status: "Configured",
      configured_at: "2025-06-02T10:00:00Z",
    };
    vi.mocked(listAdapters)
      .mockResolvedValueOnce([registeredConnector])
      .mockResolvedValueOnce([configuredConnector]);
    vi.mocked(updateAdapterStatus).mockResolvedValue(configuredConnector);

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Configure" }));

    await waitFor(() => {
      expect(updateAdapterStatus).toHaveBeenCalledWith("connector-2", "Configured");
    });
  });

  it("pings active connector and shows result", async () => {
    vi.mocked(listAdapters).mockResolvedValue([mockConnector]);
    vi.mocked(pingAdapter).mockResolvedValue({ status: "ok", technology: "postgresql" });

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Ping" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Ping" }));

    await waitFor(() => {
      expect(pingAdapter).toHaveBeenCalledWith("connector-1");
    });

    await waitFor(() => {
      expect(screen.getByText("Ping: ok (postgresql)")).toBeInTheDocument();
    });
  });

  it("renders infrastructure error state", async () => {
    vi.mocked(listAdapters).mockRejectedValue(new ApiError("Server error", 500));
    vi.mocked(listSemanticConnectors).mockResolvedValue([]);

    render(<ConnectorsPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Server error");
    });
  });
});

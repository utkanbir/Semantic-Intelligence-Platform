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
import { AdaptersPage } from "./AdaptersPage";

vi.mock("../../api/adapters", () => ({
  listAdapters: vi.fn(),
  createAdapter: vi.fn(),
  updateAdapterStatus: vi.fn(),
  pingAdapter: vi.fn(),
  canPingAdapter: vi.fn((adapter: { status: string }) => adapter.status === "Active"),
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

const registeredAdapter: TechnologyAdapterResponse = {
  ...mockAdapter,
  id: "adapter-2",
  status: "Registered",
  title: "New Adapter",
  adapter_key: "new-key",
  configured_at: null,
  activated_at: null,
};

const newAdapter: TechnologyAdapterResponse = {
  ...registeredAdapter,
  title: "OpenMetadata Dev",
  adapter_key: "om-dev",
  technology_type: "openmetadata",
};

describe("AdaptersPage", () => {
  beforeEach(() => {
    vi.mocked(listAdapters).mockReset();
    vi.mocked(createAdapter).mockReset();
    vi.mocked(updateAdapterStatus).mockReset();
    vi.mocked(pingAdapter).mockReset();
  });

  it("renders loading then adapters table", async () => {
    vi.mocked(listAdapters).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockAdapter]), 0);
        }),
    );

    render(<AdaptersPage />);

    expect(screen.getByText("Loading adapters…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Primary PostgreSQL")).toBeInTheDocument();
    });

    expect(listAdapters).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ping" })).toBeInTheDocument();
  });

  it("renders empty state with create form", async () => {
    vi.mocked(listAdapters).mockResolvedValue([]);

    render(<AdaptersPage />);

    await waitFor(() => {
      expect(screen.getByText("No adapters yet.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Create adapter")).toBeInTheDocument();
  });

  it("creates adapter from empty state and refreshes list", async () => {
    vi.mocked(listAdapters)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newAdapter]);
    vi.mocked(createAdapter).mockResolvedValue(newAdapter);

    render(<AdaptersPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create adapter")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Adapter key"), { target: { value: "om-dev" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "OpenMetadata Dev" } });
    fireEvent.change(screen.getByLabelText("Technology type"), {
      target: { value: "openmetadata" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create adapter" }));

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

  it("configures registered adapter via lifecycle action", async () => {
    const configuredAdapter: TechnologyAdapterResponse = {
      ...registeredAdapter,
      status: "Configured",
      configured_at: "2025-06-02T10:00:00Z",
    };
    vi.mocked(listAdapters)
      .mockResolvedValueOnce([registeredAdapter])
      .mockResolvedValueOnce([configuredAdapter]);
    vi.mocked(updateAdapterStatus).mockResolvedValue(configuredAdapter);

    render(<AdaptersPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Configure" }));

    await waitFor(() => {
      expect(updateAdapterStatus).toHaveBeenCalledWith("adapter-2", "Configured");
    });
  });

  it("pings active adapter and shows result", async () => {
    vi.mocked(listAdapters).mockResolvedValue([mockAdapter]);
    vi.mocked(pingAdapter).mockResolvedValue({ status: "ok", technology: "postgresql" });

    render(<AdaptersPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Ping" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Ping" }));

    await waitFor(() => {
      expect(pingAdapter).toHaveBeenCalledWith("adapter-1");
    });

    await waitFor(() => {
      expect(screen.getByText("Ping: ok (postgresql)")).toBeInTheDocument();
    });
  });

  it("renders error state", async () => {
    vi.mocked(listAdapters).mockRejectedValue(new ApiError("Server error", 500));

    render(<AdaptersPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api";
import { listAdapters, type TechnologyAdapterResponse } from "../../api/adapters";
import { AdaptersPage } from "./AdaptersPage";

vi.mock("../../api/adapters", () => ({
  listAdapters: vi.fn(),
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

describe("AdaptersPage", () => {
  beforeEach(() => {
    vi.mocked(listAdapters).mockReset();
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
    expect(screen.getByText("primary-db")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    vi.mocked(listAdapters).mockResolvedValue([]);

    render(<AdaptersPage />);

    await waitFor(() => {
      expect(screen.getByText("No adapters yet.")).toBeInTheDocument();
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

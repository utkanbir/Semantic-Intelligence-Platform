import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { listAssets, type AssetRecordResponse } from "../api/assets";
import { AssetsPage } from "./AssetsPage";

vi.mock("../api/assets", () => ({
  listAssets: vi.fn(),
  getAsset: vi.fn(),
}));

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

describe("AssetsPage", () => {
  beforeEach(() => {
    vi.mocked(listAssets).mockReset();
  });

  it("renders loading then assets table", async () => {
    vi.mocked(listAssets).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockAsset]), 0);
        }),
    );

    render(<AssetsPage applicationId="app-1" />);

    expect(screen.getByText("Loading assets…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Customer Blueprint")).toBeInTheDocument();
    });

    expect(listAssets).toHaveBeenCalledWith("app-1");
    expect(screen.getAllByText("Blueprint").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders empty state when no assets exist", async () => {
    vi.mocked(listAssets).mockResolvedValue([]);

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No assets registered yet.")).toBeInTheDocument();
    });
  });

  it("renders error state on API failure", async () => {
    vi.mocked(listAssets).mockRejectedValue(new Error("Network error"));

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });

  it("shows ApiError message on list failure", async () => {
    vi.mocked(listAssets).mockRejectedValue(new ApiError("Application not found", 404));

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Application not found");
    });
  });
});

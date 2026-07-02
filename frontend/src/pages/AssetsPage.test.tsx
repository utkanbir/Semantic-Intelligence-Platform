import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import {
  listAssets,
  updateAssetStatus,
  type AssetRecordResponse,
} from "../api/assets";
import { AssetsPage } from "./AssetsPage";

vi.mock("../api/assets", () => ({
  listAssets: vi.fn(),
  getAsset: vi.fn(),
  updateAssetStatus: vi.fn(),
  getNextAssetStatuses: vi.fn((status: string) => {
    const map: Record<string, string[]> = {
      Draft: ["Active"],
      Active: ["Published", "Draft"],
      Published: ["Deprecated"],
      Deprecated: ["Retired", "Active"],
      Retired: [],
    };
    return map[status] ?? [];
  }),
  getAssetStatusActionLabel: vi.fn((status: string) => {
    const labels: Record<string, string> = {
      Active: "Activate",
      Published: "Publish",
      Draft: "Revert to Draft",
      Deprecated: "Deprecate",
      Retired: "Retire",
    };
    return labels[status] ?? status;
  }),
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

const draftAsset: AssetRecordResponse = {
  ...mockAsset,
  id: "asset-draft",
  status: "Draft",
  title: "Draft Blueprint",
};

describe("AssetsPage", () => {
  beforeEach(() => {
    vi.mocked(listAssets).mockReset();
    vi.mocked(updateAssetStatus).mockReset();
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

  it("activates draft asset via lifecycle action", async () => {
    const activeAsset = { ...draftAsset, status: "Active" as const };
    vi.mocked(listAssets)
      .mockResolvedValueOnce([draftAsset])
      .mockResolvedValueOnce([activeAsset]);
    vi.mocked(updateAssetStatus).mockResolvedValue(activeAsset);

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    await waitFor(() => {
      expect(updateAssetStatus).toHaveBeenCalledWith("asset-draft", "Active");
    });

    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  it("shows lifecycle actions for active assets", async () => {
    vi.mocked(listAssets).mockResolvedValue([mockAsset]);

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Revert to Draft" })).toBeInTheDocument();
    });
  });

  it("shows ApiError message when status update fails", async () => {
    vi.mocked(listAssets).mockResolvedValue([draftAsset]);
    vi.mocked(updateAssetStatus).mockRejectedValue(
      new ApiError("Invalid status transition", 422),
    );

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid status transition");
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { createAsset, listAssets, type AssetRecordResponse } from "../api/assets";
import { AssetsPage } from "./AssetsPage";

vi.mock("../api/assets", () => ({
  listAssets: vi.fn(),
  getAsset: vi.fn(),
  createAsset: vi.fn(),
  ASSET_TYPES: ["Application", "DiscoverySession", "Blueprint"],
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

const newAsset: AssetRecordResponse = {
  ...mockAsset,
  id: "asset-2",
  title: "New Asset",
  status: "Draft",
};

describe("AssetsPage", () => {
  beforeEach(() => {
    vi.mocked(listAssets).mockReset();
    vi.mocked(createAsset).mockReset();
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

  it("renders empty state with create form", async () => {
    vi.mocked(listAssets).mockResolvedValue([]);

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No assets registered yet.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Create asset")).toBeInTheDocument();
  });

  it("creates asset from empty state and refreshes list", async () => {
    vi.mocked(listAssets).mockResolvedValueOnce([]).mockResolvedValueOnce([newAsset]);
    vi.mocked(createAsset).mockResolvedValue(newAsset);

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create asset")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Resource type"), { target: { value: "Blueprint" } });
    fireEvent.change(screen.getByLabelText("Resource ID"), { target: { value: "bp-2" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New Asset" } });
    fireEvent.click(screen.getByRole("button", { name: "Create asset" }));

    await waitFor(() => {
      expect(createAsset).toHaveBeenCalledWith({
        application_id: "app-1",
        asset_type: "Blueprint",
        resource_type: "Blueprint",
        resource_id: "bp-2",
        title: "New Asset",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("New Asset")).toBeInTheDocument();
    });
  });

  it("shows New asset panel when list has items", async () => {
    vi.mocked(listAssets).mockResolvedValue([mockAsset]);

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("Customer Blueprint")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New asset" }));
    expect(screen.getByRole("heading", { name: "New asset" })).toBeInTheDocument();
  });

  it("shows title validation error when title is empty", async () => {
    vi.mocked(listAssets).mockResolvedValue([]);

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create asset")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Resource type"), { target: { value: "Blueprint" } });
    fireEvent.change(screen.getByLabelText("Resource ID"), { target: { value: "bp-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create asset" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Title is required");
    });

    expect(createAsset).not.toHaveBeenCalled();
  });

  it("shows JSON validation error for invalid metadata", async () => {
    vi.mocked(listAssets).mockResolvedValue([]);

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create asset")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Resource type"), { target: { value: "Blueprint" } });
    fireEvent.change(screen.getByLabelText("Resource ID"), { target: { value: "bp-1" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Bad Metadata" } });
    fireEvent.change(screen.getByLabelText(/Metadata/), { target: { value: "not-json" } });
    fireEvent.click(screen.getByRole("button", { name: "Create asset" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Metadata must be valid JSON");
    });

    expect(createAsset).not.toHaveBeenCalled();
  });

  it("submits parsed metadata JSON", async () => {
    vi.mocked(listAssets).mockResolvedValueOnce([]).mockResolvedValueOnce([newAsset]);
    vi.mocked(createAsset).mockResolvedValue(newAsset);

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create asset")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Resource type"), { target: { value: "Blueprint" } });
    fireEvent.change(screen.getByLabelText("Resource ID"), { target: { value: "bp-2" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New Asset" } });
    fireEvent.change(screen.getByLabelText(/Metadata/), {
      target: { value: '{"source": "manual"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create asset" }));

    await waitFor(() => {
      expect(createAsset).toHaveBeenCalledWith({
        application_id: "app-1",
        asset_type: "Blueprint",
        resource_type: "Blueprint",
        resource_id: "bp-2",
        title: "New Asset",
        metadata: { source: "manual" },
      });
    });
  });

  it("shows ApiError message on create failure", async () => {
    vi.mocked(listAssets).mockResolvedValue([]);
    vi.mocked(createAsset).mockRejectedValue(new ApiError("Duplicate resource", 409));

    render(<AssetsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create asset")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Resource type"), { target: { value: "Blueprint" } });
    fireEvent.change(screen.getByLabelText("Resource ID"), { target: { value: "bp-1" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fail Asset" } });
    fireEvent.click(screen.getByRole("button", { name: "Create asset" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Duplicate resource");
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

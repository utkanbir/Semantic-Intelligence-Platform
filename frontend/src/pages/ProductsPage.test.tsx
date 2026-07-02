import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAssets, type AssetRecordResponse } from "../api/assets";
import {
  createProduct,
  listProducts,
  updateProductStatus,
  type PublishedDataProductResponse,
} from "../api/products";
import { ProductsPage } from "./ProductsPage";

vi.mock("../api/products", () => ({
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProductStatus: vi.fn(),
  getNextProductStatuses: vi.fn((status: string) => {
    const map: Record<string, string[]> = {
      Draft: ["Certified"],
      Certified: ["Published", "Draft"],
      Published: ["Versioned"],
      Versioned: ["Retired"],
      Retired: [],
    };
    return map[status] ?? [];
  }),
  getProductStatusActionLabel: vi.fn((status: string) => {
    const labels: Record<string, string> = {
      Certified: "Certify",
      Published: "Publish",
      Draft: "Revert to Draft",
      Versioned: "Version",
      Retired: "Retire",
    };
    return labels[status] ?? status;
  }),
}));

vi.mock("../api/assets", () => ({
  listAssets: vi.fn(),
}));

const mockAsset: AssetRecordResponse = {
  id: "asset-1",
  application_id: "app-1",
  asset_type: "Blueprint",
  resource_type: "blueprint",
  resource_id: "bp-1",
  status: "Active",
  title: "Customer Blueprint",
  description: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  metadata: null,
};

const secondAsset: AssetRecordResponse = {
  ...mockAsset,
  id: "asset-2",
  asset_type: "DiscoverySession",
  title: "Discovery Session A",
};

const mockProduct: PublishedDataProductResponse = {
  id: "prod-1",
  application_id: "app-1",
  version_number: 1,
  previous_version_id: null,
  status: "Published",
  title: "Customer 360 Product",
  description: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  certified_at: "2025-06-02T10:00:00Z",
  published_at: "2025-06-03T10:00:00Z",
  version_created_at: null,
  product_definition: {},
  source_asset_record_ids: [],
};

const draftProduct: PublishedDataProductResponse = {
  ...mockProduct,
  id: "prod-draft",
  status: "Draft",
  published_at: null,
};

const newProduct: PublishedDataProductResponse = {
  ...mockProduct,
  id: "prod-2",
  title: "New Product",
  status: "Draft",
  published_at: null,
};

const certifiedProduct: PublishedDataProductResponse = {
  ...draftProduct,
  status: "Certified",
};

describe("ProductsPage", () => {
  beforeEach(() => {
    vi.mocked(listProducts).mockReset();
    vi.mocked(createProduct).mockReset();
    vi.mocked(updateProductStatus).mockReset();
    vi.mocked(listAssets).mockReset();
    vi.mocked(listAssets).mockResolvedValue([mockAsset, secondAsset]);
  });

  it("renders loading then products table", async () => {
    vi.mocked(listProducts).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockProduct]), 0);
        }),
    );

    render(<ProductsPage applicationId="app-1" />);

    expect(screen.getByText("Loading products…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Customer 360 Product")).toBeInTheDocument();
    });

    expect(listProducts).toHaveBeenCalledWith("app-1");
    expect(listAssets).toHaveBeenCalledWith("app-1");
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("renders empty state with create form", async () => {
    vi.mocked(listProducts).mockResolvedValue([]);

    render(<ProductsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No published data products yet.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Create product")).toBeInTheDocument();
  });

  it("creates product from empty state and refreshes list", async () => {
    vi.mocked(listProducts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newProduct]);
    vi.mocked(createProduct).mockResolvedValue(newProduct);

    render(<ProductsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create product")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New Product" } });
    fireEvent.click(screen.getByRole("button", { name: "Create product" }));

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "New Product",
        product_definition: {},
      });
    });

    await waitFor(() => {
      expect(screen.getByText("New Product")).toBeInTheDocument();
    });
  });

  it("creates product with source asset bindings from empty state", async () => {
    const productWithAssets: PublishedDataProductResponse = {
      ...newProduct,
      source_asset_record_ids: ["asset-1", "asset-2"],
    };
    vi.mocked(listProducts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([productWithAssets]);
    vi.mocked(createProduct).mockResolvedValue(productWithAssets);

    render(<ProductsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create product")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New Product" } });
    fireEvent.click(screen.getByLabelText(/Customer Blueprint/));
    fireEvent.click(screen.getByLabelText(/Discovery Session A/));
    fireEvent.click(screen.getByRole("button", { name: "Create product" }));

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "New Product",
        product_definition: {},
        source_asset_record_ids: ["asset-1", "asset-2"],
      });
    });
  });

  it("shows source asset bindings in products table", async () => {
    const boundProduct: PublishedDataProductResponse = {
      ...mockProduct,
      source_asset_record_ids: ["asset-1", "asset-2"],
    };
    vi.mocked(listProducts).mockResolvedValue([boundProduct]);

    render(<ProductsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("Customer 360 Product")).toBeInTheDocument();
    });

    expect(screen.getByText("2: Customer Blueprint, Discovery Session A")).toBeInTheDocument();
  });

  it("shows None when product has no source asset bindings", async () => {
    vi.mocked(listProducts).mockResolvedValue([mockProduct]);

    render(<ProductsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("Customer 360 Product")).toBeInTheDocument();
    });

    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("shows New product panel when list has items", async () => {
    vi.mocked(listProducts).mockResolvedValue([mockProduct]);

    render(<ProductsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("Customer 360 Product")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New product" }));
    expect(screen.getByRole("heading", { name: "New product" })).toBeInTheDocument();
  });

  it("shows API error on create failure", async () => {
    vi.mocked(listProducts).mockResolvedValue([]);
    vi.mocked(createProduct).mockRejectedValue(new Error("Server error"));

    render(<ProductsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create product")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fail Product" } });
    fireEvent.click(screen.getByRole("button", { name: "Create product" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });

  it("certifies draft product via lifecycle action", async () => {
    vi.mocked(listProducts)
      .mockResolvedValueOnce([draftProduct])
      .mockResolvedValueOnce([certifiedProduct]);
    vi.mocked(updateProductStatus).mockResolvedValue(certifiedProduct);

    render(<ProductsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Certify" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Certify" }));

    await waitFor(() => {
      expect(updateProductStatus).toHaveBeenCalledWith("prod-draft", "Certified");
    });

    await waitFor(() => {
      expect(screen.getByText("Certified")).toBeInTheDocument();
    });
  });

  it("shows action error when status update fails", async () => {
    vi.mocked(listProducts).mockResolvedValue([draftProduct]);
    vi.mocked(updateProductStatus).mockRejectedValue(new Error("Invalid transition"));

    render(<ProductsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Certify" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Certify" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid transition");
    });
  });

  it("renders error state on API failure", async () => {
    vi.mocked(listProducts).mockRejectedValue(new Error("Network error"));

    render(<ProductsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProduct,
  listProducts,
  type PublishedDataProductResponse,
} from "../api/products";
import { ProductsPage } from "./ProductsPage";

vi.mock("../api/products", () => ({
  listProducts: vi.fn(),
  createProduct: vi.fn(),
}));

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

const newProduct: PublishedDataProductResponse = {
  ...mockProduct,
  id: "prod-2",
  title: "New Product",
  status: "Draft",
  published_at: null,
};

describe("ProductsPage", () => {
  beforeEach(() => {
    vi.mocked(listProducts).mockReset();
    vi.mocked(createProduct).mockReset();
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

  it("renders error state on API failure", async () => {
    vi.mocked(listProducts).mockRejectedValue(new Error("Network error"));

    render(<ProductsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });
});

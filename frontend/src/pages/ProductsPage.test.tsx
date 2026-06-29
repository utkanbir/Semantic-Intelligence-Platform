import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProducts, type PublishedDataProductResponse } from "../api/products";
import { ProductsPage } from "./ProductsPage";

vi.mock("../api/products", () => ({
  listProducts: vi.fn(),
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

describe("ProductsPage", () => {
  beforeEach(() => {
    vi.mocked(listProducts).mockReset();
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

  it("renders empty state when no products exist", async () => {
    vi.mocked(listProducts).mockResolvedValue([]);

    render(<ProductsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No published data products yet.")).toBeInTheDocument();
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

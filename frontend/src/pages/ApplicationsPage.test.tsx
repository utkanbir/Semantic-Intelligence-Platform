import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listApplications, type ApplicationResponse } from "../api/applications";
import { ApplicationsPage } from "./ApplicationsPage";

vi.mock("../api/applications", () => ({
  listApplications: vi.fn(),
}));

const mockApplication: ApplicationResponse = {
  id: "app-1",
  key: "demo",
  name: "Demo App",
  status: "active",
  description: null,
  created_at: "2025-06-01T10:00:00Z",
  updated_at: null,
  workspace: {
    id: "ws-1",
    application_id: "app-1",
    status: "active",
    postgres_schema: "app_demo",
    minio_namespace: "app-demo",
    fuseki_dataset: "app-demo",
    qdrant_collection: "app-demo",
    metadata_domain: "app-demo",
    ontology_namespace: "app-demo",
    agent_namespace: "app-demo",
    product_registry_namespace: "app-demo",
    agent_registry_namespace: "app-demo",
    created_at: "2025-06-01T10:00:00Z",
    updated_at: null,
  },
};

describe("ApplicationsPage", () => {
  beforeEach(() => {
    vi.mocked(listApplications).mockReset();
  });

  it("renders loading then list", async () => {
    vi.mocked(listApplications).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockApplication]), 0);
        }),
    );

    render(
      <MemoryRouter>
        <ApplicationsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading applications…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Demo App")).toBeInTheDocument();
    });

    expect(screen.getByText("demo")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(listApplications).toHaveBeenCalledTimes(1);

    const detailLink = screen.getByRole("link", { name: "Demo App" });
    expect(detailLink).toHaveAttribute("href", "/applications/app-1");
    expect(screen.getByRole("link", { name: "demo" })).toHaveAttribute(
      "href",
      "/applications/app-1",
    );
  });
});

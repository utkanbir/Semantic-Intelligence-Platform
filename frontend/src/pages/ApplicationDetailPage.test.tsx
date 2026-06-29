import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getApplication,
  type ApplicationResponse,
} from "../api/applications";
import { listDiscoverySessions } from "../api/discovery";
import { ApplicationDetailPage } from "./ApplicationDetailPage";

vi.mock("../api/applications", () => ({
  getApplication: vi.fn(),
}));

vi.mock("../api/discovery", () => ({
  listDiscoverySessions: vi.fn(),
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

function renderDetailPage(initialEntry = "/applications/app-1") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/applications/:applicationId/*"
          element={<ApplicationDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ApplicationDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getApplication).mockReset();
    vi.mocked(getApplication).mockResolvedValue(mockApplication);
    vi.mocked(listDiscoverySessions).mockReset();
    vi.mocked(listDiscoverySessions).mockResolvedValue([]);
  });

  it("loads application and shows overview by default", async () => {
    renderDetailPage();

    expect(screen.getByText("Loading application…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    expect(getApplication).toHaveBeenCalledWith("app-1");
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("Workspace namespaces")).toBeInTheDocument();
    expect(screen.getByText("app_demo")).toBeInTheDocument();
    expect(screen.getAllByText("app-demo").length).toBeGreaterThan(0);
  });

  it("navigates to discovery sessions list", async () => {
    vi.mocked(listDiscoverySessions).mockResolvedValue([
      {
        id: "session-1",
        application_id: "app-1",
        status: "Active",
        title: "Session A",
        started_by: "bob@example.com",
        started_at: "2025-06-01T10:00:00Z",
        completed_at: null,
        intent_summary: null,
        discovery_notes: null,
        recommendations: [],
        generated_blueprint_id: null,
        conversation_history: [],
        current_phase: {
          phase_number: 1,
          phase_name: "Intent Discovery",
        },
        phase_history: [],
      },
    ]);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "Discovery" }));

    await waitFor(() => {
      expect(screen.getByText("Session A")).toBeInTheDocument();
    });

    expect(listDiscoverySessions).toHaveBeenCalledWith("app-1");
    expect(screen.getByRole("heading", { name: "Discovery" })).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("navigates to placeholder sections", async () => {
    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "Agents" }));

    expect(screen.getByRole("heading", { name: "Agents" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("highlights active section in navigation", async () => {
    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Overview" })).toHaveClass(
        "application-shell__nav-link--active",
      );
    });

    fireEvent.click(screen.getByRole("link", { name: "Blueprint" }));

    expect(screen.getByRole("link", { name: "Blueprint" })).toHaveClass(
      "application-shell__nav-link--active",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveClass(
      "application-shell__nav-link--active",
    );
  });
});

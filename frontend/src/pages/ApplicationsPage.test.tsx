import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import {
  createApplication,
  listApplications,
  type ApplicationResponse,
} from "../api/applications";
import { ApplicationsPage } from "./ApplicationsPage";

vi.mock("../api/applications", () => ({
  listApplications: vi.fn(),
  createApplication: vi.fn(),
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

const newApplication: ApplicationResponse = {
  ...mockApplication,
  id: "app-new",
  key: "new-app",
  name: "New App",
  description: "A new application",
  status: "created",
  workspace: {
    ...mockApplication.workspace,
    id: "ws-new",
    application_id: "app-new",
  },
};

function renderApplicationsPage(initialEntry = "/applications") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/applications" element={<ApplicationsPage />} />
        <Route
          path="/applications/:applicationId"
          element={<div>Application detail</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ApplicationsPage", () => {
  beforeEach(() => {
    vi.mocked(listApplications).mockReset();
    vi.mocked(createApplication).mockReset();
  });

  it("renders loading then list", async () => {
    vi.mocked(listApplications).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockApplication]), 0);
        }),
    );

    renderApplicationsPage();

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

  it("shows create form in empty state and navigates on success", async () => {
    vi.mocked(listApplications)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newApplication]);
    vi.mocked(createApplication).mockResolvedValue(newApplication);

    renderApplicationsPage();

    await waitFor(() => {
      expect(screen.getByText("No applications yet.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Key")).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "new-app" } });
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "New App" } });
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "A new application" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create application" }));

    await waitFor(() => {
      expect(createApplication).toHaveBeenCalledWith({
        key: "new-app",
        name: "New App",
        description: "A new application",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Application detail")).toBeInTheDocument();
    });

    expect(listApplications).toHaveBeenCalledTimes(2);
  });

  it("shows New application action when list has items", async () => {
    vi.mocked(listApplications).mockResolvedValue([mockApplication]);

    renderApplicationsPage();

    await waitFor(() => {
      expect(screen.getByText("Demo App")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Key")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "New application" }));

    expect(screen.getByLabelText("Key")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New application" })).toBeInTheDocument();
  });

  it("displays API error when create fails", async () => {
    vi.mocked(listApplications).mockResolvedValue([]);
    vi.mocked(createApplication).mockRejectedValue(
      new ApiError("Application key already exists", 409),
    );

    renderApplicationsPage();

    await waitFor(() => {
      expect(screen.getByText("No applications yet.")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "demo" } });
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Duplicate" } });
    fireEvent.click(screen.getByRole("button", { name: "Create application" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Application key already exists",
      );
    });

    expect(screen.queryByText("Application detail")).not.toBeInTheDocument();
  });

  it("shows client validation errors for required fields", async () => {
    vi.mocked(listApplications).mockResolvedValue([]);

    renderApplicationsPage();

    await waitFor(() => {
      expect(screen.getByText("No applications yet.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create application" }));

    expect(await screen.findByText("Key is required")).toBeInTheDocument();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(createApplication).not.toHaveBeenCalled();
  });
});

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
  updated_at: "2025-06-01T12:00:00Z",
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

const draftApplication: ApplicationResponse = {
  ...mockApplication,
  id: "app-2",
  key: "pilot",
  name: "Pilot Sandbox",
  status: "created",
  updated_at: null,
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

  it("renders loading then sandbox card grid", async () => {
    vi.mocked(listApplications).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockApplication]), 0);
        }),
    );

    renderApplicationsPage();

    expect(screen.getByText("Yükleniyor…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Demo App")).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "Sandboxlar" })).toBeInTheDocument();
    expect(screen.getByText("Aktif")).toBeInTheDocument();
    expect(screen.getByText("Ontology / KG")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText(/Son kullanım:/)).toBeInTheDocument();
    expect(listApplications).toHaveBeenCalledTimes(1);

    const openLink = screen.getByRole("link", { name: "Aç" });
    expect(openLink).toHaveAttribute("href", "/applications/app-1");
  });

  it("shows error state when list fails", async () => {
    vi.mocked(listApplications).mockRejectedValue(new ApiError("Service unavailable", 503));

    renderApplicationsPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable");
    });
  });

  it("shows create form in empty state and navigates on success", async () => {
    vi.mocked(listApplications)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newApplication]);
    vi.mocked(createApplication).mockResolvedValue(newApplication);

    renderApplicationsPage();

    await waitFor(() => {
      expect(screen.getByText("Henüz sandbox yok.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Yeni sandbox oluştur" }));

    expect(screen.getByLabelText("Anahtar")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Ad$/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Anahtar"), { target: { value: "new-app" } });
    fireEvent.change(screen.getByLabelText(/^Ad$/), { target: { value: "New App" } });
    fireEvent.change(screen.getByLabelText(/Açıklama/), {
      target: { value: "A new application" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sandbox oluştur" }));

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

  it("opens create form from header action when list has items", async () => {
    vi.mocked(listApplications).mockResolvedValue([mockApplication]);

    renderApplicationsPage();

    await waitFor(() => {
      expect(screen.getByText("Demo App")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Anahtar")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Yeni sandbox" }));

    expect(screen.getByLabelText("Anahtar")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Yeni sandbox" })).toBeInTheDocument();
  });

  it("opens create form from inline dashed card", async () => {
    vi.mocked(listApplications).mockResolvedValue([mockApplication]);

    renderApplicationsPage();

    await waitFor(() => {
      expect(screen.getByText("Demo App")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Yeni sandbox oluştur" }));

    expect(screen.getByLabelText("Anahtar")).toBeInTheDocument();
  });

  it("shows draft status badge for created sandboxes", async () => {
    vi.mocked(listApplications).mockResolvedValue([draftApplication]);

    renderApplicationsPage();

    await waitFor(() => {
      expect(screen.getByText("Pilot Sandbox")).toBeInTheDocument();
    });

    expect(screen.getByText("Taslak")).toBeInTheDocument();
  });

  it("displays API error when create fails", async () => {
    vi.mocked(listApplications).mockResolvedValue([]);
    vi.mocked(createApplication).mockRejectedValue(
      new ApiError("Application key already exists", 409),
    );

    renderApplicationsPage();

    await waitFor(() => {
      expect(screen.getByText("Henüz sandbox yok.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Yeni sandbox" }));

    fireEvent.change(screen.getByLabelText("Anahtar"), { target: { value: "demo" } });
    fireEvent.change(screen.getByLabelText(/^Ad$/), { target: { value: "Duplicate" } });
    fireEvent.click(screen.getByRole("button", { name: "Sandbox oluştur" }));

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
      expect(screen.getByText("Henüz sandbox yok.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Yeni sandbox" }));
    fireEvent.click(screen.getByRole("button", { name: "Sandbox oluştur" }));

    expect(await screen.findByText("Anahtar gerekli")).toBeInTheDocument();
    expect(screen.getByText("Ad gerekli")).toBeInTheDocument();
    expect(createApplication).not.toHaveBeenCalled();
  });

  it("opens create form when create=1 query param is present", async () => {
    vi.mocked(listApplications).mockResolvedValue([mockApplication]);

    renderApplicationsPage("/applications?create=1");

    await waitFor(() => {
      expect(screen.getByText("Demo App")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Anahtar")).toBeInTheDocument();
  });
});

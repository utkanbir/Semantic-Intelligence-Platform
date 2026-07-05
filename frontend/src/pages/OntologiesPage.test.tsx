import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import {
  forkOntologyVersion,
  listOntologies,
  updateOntologyStatus,
  type OntologyDefinitionResponse,
} from "../api/ontologies";
import { OntologiesPage } from "./OntologiesPage";

vi.mock("../api/ontologies", () => ({
  listOntologies: vi.fn(),
  getOntology: vi.fn(),
  updateOntologyStatus: vi.fn(),
  forkOntologyVersion: vi.fn(),
  canForkOntology: vi.fn((ontology: { status: string }) =>
    ["Published", "Versioned"].includes(ontology.status),
  ),
  getNextOntologyStatuses: vi.fn((status: string) => {
    const map: Record<string, string[]> = {
      Draft: ["Validated"],
      Validated: ["Approved", "Draft"],
      Approved: ["Published"],
      Published: ["Versioned"],
      Versioned: ["Retired"],
      Retired: [],
    };
    return map[status] ?? [];
  }),
  getOntologyStatusActionLabel: vi.fn((status: string) => {
    const labels: Record<string, string> = {
      Validated: "Validate",
      Approved: "Approve",
      Draft: "Revert to Draft",
      Published: "Publish",
      Versioned: "Version",
      Retired: "Retire",
    };
    return labels[status] ?? status;
  }),
}));

const mockOntology: OntologyDefinitionResponse = {
  id: "onto-1",
  application_id: "app-1",
  version_number: 2,
  previous_version_id: null,
  status: "Published",
  title: "Customer Ontology",
  description: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  validated_at: "2025-06-02T10:00:00Z",
  approved_at: "2025-06-03T10:00:00Z",
  published_at: "2025-06-04T10:00:00Z",
  version_created_at: null,
  ontology_definition: {},
};

const draftOntology: OntologyDefinitionResponse = {
  ...mockOntology,
  id: "onto-draft",
  status: "Draft",
  version_number: 1,
  published_at: null,
  validated_at: null,
  approved_at: null,
};

const validatedOntology: OntologyDefinitionResponse = {
  ...draftOntology,
  status: "Validated",
  validated_at: "2025-06-02T10:00:00Z",
};

function renderPage(initialEntry = "/applications/app-1/ontology") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/applications/:applicationId/ontology"
          element={<OntologiesPage applicationId="app-1" />}
        />
        <Route path="/applications/:applicationId/ontology/create" element={<div>Create</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OntologiesPage", () => {
  beforeEach(() => {
    vi.mocked(listOntologies).mockReset();
    vi.mocked(updateOntologyStatus).mockReset();
    vi.mocked(forkOntologyVersion).mockReset();
  });

  it("renders loading then ontologies table", async () => {
    vi.mocked(listOntologies).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockOntology]), 0);
        }),
    );

    renderPage();

    expect(screen.getByText("Loading ontologies…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Customer Ontology")).toBeInTheDocument();
    });

    expect(listOntologies).toHaveBeenCalledWith("app-1");
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders empty state with create form", async () => {
    vi.mocked(listOntologies).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No ontology definitions yet.")).toBeInTheDocument();
    });

    const createLinks = screen.getAllByRole("link", { name: "Create or import ontology" });
    expect(createLinks[0]).toHaveAttribute("href", "/applications/app-1/ontology/create");
  });

  it("shows the wizard entry link when ontologies exist", async () => {
    vi.mocked(listOntologies).mockResolvedValue([mockOntology]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Customer Ontology")).toBeInTheDocument();
    });

    const createLinks = screen.getAllByRole("link", { name: "Create or import ontology" });
    expect(createLinks[0]).toHaveAttribute("href", "/applications/app-1/ontology/create");
  });

  it("validates draft ontology via lifecycle action", async () => {
    vi.mocked(listOntologies)
      .mockResolvedValueOnce([draftOntology])
      .mockResolvedValueOnce([validatedOntology]);
    vi.mocked(updateOntologyStatus).mockResolvedValue(validatedOntology);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Validate" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Validate" }));

    await waitFor(() => {
      expect(updateOntologyStatus).toHaveBeenCalledWith("onto-draft", "Validated");
    });

    await waitFor(() => {
      expect(screen.getByText("Validated")).toBeInTheDocument();
    });
  });

  it("shows ApiError message when status update fails", async () => {
    vi.mocked(listOntologies).mockResolvedValue([draftOntology]);
    vi.mocked(updateOntologyStatus).mockRejectedValue(
      new ApiError("Invalid status transition", 422),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Validate" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Validate" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid status transition");
    });
  });

  it("forks a published ontology version", async () => {
    vi.mocked(listOntologies)
      .mockResolvedValueOnce([mockOntology])
      .mockResolvedValueOnce([
        {
          ...mockOntology,
          id: "onto-2",
          title: "Customer Ontology v2",
          status: "Draft",
          version_number: 3,
        },
      ]);
    vi.mocked(forkOntologyVersion).mockResolvedValue({
      ...mockOntology,
      id: "onto-2",
      status: "Draft",
      version_number: 3,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New version" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New version" }));

    await waitFor(() => {
      expect(forkOntologyVersion).toHaveBeenCalledWith("onto-1");
    });

    await waitFor(() => {
      expect(screen.getByText("Customer Ontology v2")).toBeInTheDocument();
    });
  });

  it("renders error state on API failure", async () => {
    vi.mocked(listOntologies).mockRejectedValue(new Error("Network error"));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listConnectors } from "../api/adapters";
import { ApiError } from "../api";
import {
  forkOntologyVersion,
  listOntologies,
  updateOntologyStatus,
  type OntologyDefinitionResponse,
} from "../api/ontologies";
import { OntologiesPage } from "./OntologiesPage";

vi.mock("../api/adapters", () => ({
  listConnectors: vi.fn(),
  CONNECTOR_TYPE_LABELS: {
    ontology_knowledge_graph: "Ontology / knowledge graph",
  },
}));

vi.mock("../connectors/catalog", () => ({
  getVendorLabel: vi.fn(() => "Apache Jena Fuseki"),
  readConnectorVendor: vi.fn(() => "apache_fuseki"),
}));

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

const connector = {
  id: "connector-1",
  connector_type: "ontology_knowledge_graph" as const,
  connector_key: "fuseki",
  status: "Active" as const,
  title: "Primary Fuseki",
  description: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  configured_at: "2025-06-01T10:00:00Z",
  activated_at: "2025-06-01T10:00:00Z",
  deprecated_at: null,
  retired_at: null,
  connector_configuration: {
    vendor: "apache_fuseki",
  },
};

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
  connector_id: "connector-1",
  artifact_uri: "fuseki://app-demo/ontologies/onto-1/artifact.ttl",
  source_format: "ttl",
  semantic_transaction_id: "txn-1",
};

const draftOntology: OntologyDefinitionResponse = {
  ...mockOntology,
  id: "onto-draft",
  status: "Draft",
  version_number: 1,
  published_at: null,
  validated_at: null,
  approved_at: null,
  semantic_transaction_id: null,
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
        <Route path="/connectors" element={<div>Connectors</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OntologiesPage", () => {
  beforeEach(() => {
    vi.mocked(listOntologies).mockReset();
    vi.mocked(listConnectors).mockReset();
    vi.mocked(updateOntologyStatus).mockReset();
    vi.mocked(forkOntologyVersion).mockReset();
    vi.mocked(listConnectors).mockResolvedValue([connector]);
  });

  it("renders loading then primary ontology card", async () => {
    vi.mocked(listOntologies).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockOntology]), 0);
        }),
    );

    renderPage();

    expect(screen.getByText("Loading ontologies…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Customer Ontology", level: 3 })).toBeInTheDocument();
    });

    expect(listOntologies).toHaveBeenCalledWith("app-1");
    expect(screen.getAllByText("Published").length).toBeGreaterThan(0);
    expect(screen.getByText(/Version 2/)).toBeInTheDocument();
    expect(screen.getByText("Primary Fuseki — Apache Jena Fuseki")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View semantic transaction" })).toHaveAttribute(
      "href",
      "/applications/app-1/semantic-transactions/txn-1",
    );
  });

  it("renders empty state with mode entry cards", async () => {
    vi.mocked(listOntologies).mockResolvedValue([]);
    vi.mocked(listConnectors).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("No ontology defined for this application yet."),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "Manual: Start manual" })).toHaveAttribute(
      "href",
      "/applications/app-1/ontology/create?mode=manual",
    );
    expect(screen.getByRole("link", { name: "OWL Import: Import OWL" })).toHaveAttribute(
      "href",
      "/applications/app-1/ontology/create?mode=import",
    );
    expect(screen.getByText("Document-assisted")).toBeInTheDocument();
    expect(screen.getAllByText("Coming soon").length).toBe(2);
    expect(screen.getByRole("link", { name: "Open connectors" })).toBeInTheDocument();
  });

  it("shows activate hint when only configured ontology connectors exist", async () => {
    vi.mocked(listOntologies).mockResolvedValue([]);
    vi.mocked(listConnectors).mockResolvedValue([
      {
        ...connector,
        id: "connector-configured",
        status: "Configured" as const,
        activated_at: null,
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/1 configured/)).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "activate to create ontology" })).toHaveAttribute(
      "href",
      "/connectors",
    );
  });

  it("shows the create link when ontologies exist", async () => {
    vi.mocked(listOntologies).mockResolvedValue([mockOntology]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Customer Ontology")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "Create or import ontology" })).toHaveAttribute(
      "href",
      "/applications/app-1/ontology/create",
    );
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
      expect(screen.getAllByText("Validated").length).toBeGreaterThan(0);
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
        mockOntology,
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
      expect(screen.getByRole("heading", { name: "Customer Ontology v2", level: 3 })).toBeInTheDocument();
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

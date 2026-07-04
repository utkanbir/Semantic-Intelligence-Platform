import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listConnectors } from "../api/adapters";
import { importOntology, type OntologyDefinitionResponse } from "../api/ontologies";
import { OntologyStudioPage } from "./OntologyStudioPage";

vi.mock("../api/adapters", () => ({
  listConnectors: vi.fn(),
  CONNECTOR_TYPE_LABELS: {
    ontology_knowledge_graph: "Ontology / knowledge graph",
  },
}));

vi.mock("../api/ontologies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/ontologies")>();
  return {
    ...actual,
    importOntology: vi.fn(),
  };
});

vi.mock("../connectors/catalog", () => ({
  getVendorLabel: vi.fn(() => "Apache Jena Fuseki"),
  readConnectorVendor: vi.fn(() => "apache_fuseki"),
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

const importedOntology: OntologyDefinitionResponse = {
  id: "onto-1",
  application_id: "app-1",
  version_number: 1,
  previous_version_id: null,
  status: "Draft",
  title: "Customer Ontology",
  description: "Business vocabulary",
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  validated_at: null,
  approved_at: null,
  published_at: null,
  version_created_at: null,
  ontology_definition: {},
  connector_id: "connector-1",
  artifact_uri: "fuseki://app-demo/ontologies/onto-1/artifact.ttl",
  source_format: "ttl",
  semantic_transaction_id: "txn-1",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/applications/app-1/ontology-studio"]}>
      <Routes>
        <Route
          path="/applications/:applicationId/ontology-studio"
          element={<OntologyStudioPage applicationId="app-1" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OntologyStudioPage", () => {
  beforeEach(() => {
    vi.mocked(listConnectors).mockReset();
    vi.mocked(importOntology).mockReset();
    vi.mocked(listConnectors).mockResolvedValue([connector]);
  });

  it("creates a minimal ontology and submits it through the import API", async () => {
    vi.mocked(importOntology).mockResolvedValue(importedOntology);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ontology Wizard" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("radio", { name: /Create from scratch/i }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Customer Ontology" },
    });
    fireEvent.change(screen.getByLabelText("Namespace / base IRI"), {
      target: { value: "https://example.com/customer#" },
    });
    fireEvent.change(screen.getByLabelText("Prefix"), {
      target: { value: "cust" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Step 2 · Connector & metadata" }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "Business vocabulary" },
    });
    fireEvent.change(screen.getByLabelText(/Created by/), {
      target: { value: "alice@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByText("Submitted artifact preview")).toBeInTheDocument();
    });

    expect(screen.getByText("Create from scratch")).toBeInTheDocument();
    expect(screen.getByText("Primary Fuseki — Apache Jena Fuseki")).toBeInTheDocument();
    expect(screen.getByText(/@prefix cust:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create ontology" }));

    await waitFor(() => {
      expect(importOntology).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "Customer Ontology",
        connector_id: "connector-1",
        source_format: "ttl",
        source_content: [
          "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
          "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
          "@prefix cust: <https://example.com/customer#> .",
          "",
          "<https://example.com/customer#> a owl:Ontology ;",
          '  rdfs:label "Customer Ontology" ;',
          '  rdfs:comment "Business vocabulary" .',
        ].join("\n"),
        description: "Business vocabulary",
        created_by: "alice@example.com",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Ontology created successfully.")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "View created ontology" })).toHaveAttribute(
      "href",
      "/applications/app-1/ontology#ontology-onto-1",
    );
    expect(screen.getByRole("link", { name: "View semantic transaction" })).toHaveAttribute(
      "href",
      "/applications/app-1/audit-trace/txn-1",
    );
  });

  it("imports pasted ontology content", async () => {
    vi.mocked(importOntology).mockResolvedValue({
      ...importedOntology,
      title: "Imported Ontology",
      source_format: "rdf",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ontology Wizard" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("radio", { name: /Import existing/i }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Imported Ontology" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Paste text/i }));
    fireEvent.change(screen.getByLabelText("Ontology content"), {
      target: { value: "<rdf:RDF></rdf:RDF>" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Step 2 · Connector & metadata" }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Source format"), {
      target: { value: "rdf" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Import ontology" }));

    await waitFor(() => {
      expect(importOntology).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "Imported Ontology",
        connector_id: "connector-1",
        source_format: "rdf",
        source_content: "<rdf:RDF></rdf:RDF>",
      });
    });
  });

  it("supports importing ontology content from a file upload", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ontology Wizard" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("radio", { name: /Import existing/i }));

    const file = new File(["@prefix ex: <https://example.com/> ."], "vendor.ttl", {
      type: "text/turtle",
    });
    fireEvent.change(screen.getByLabelText("Ontology file"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("vendor")).toBeInTheDocument();
    });

    expect(screen.getByText("Loaded vendor.ttl")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Source format")).toHaveValue("ttl");
    });
  });

  it("validates that a mode is selected before continuing", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Ontology Wizard" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Choose whether you want to create a new ontology or import an existing one",
      );
    });
  });
});

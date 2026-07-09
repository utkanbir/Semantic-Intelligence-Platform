import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { listConnectors } from "../api/adapters";
import {
  generateOntology,
  materializeOntology,
  runOntologyValidation,
  updateOntology,
  updateOntologyConnector,
  updateOntologyStatus,
  type OntologyDefinitionResponse,
  type OntologyGenerateResponse,
} from "../api/ontologies";
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
    generateOntology: vi.fn(),
    updateOntology: vi.fn(),
    updateOntologyConnector: vi.fn(),
    runOntologyValidation: vi.fn(),
    updateOntologyStatus: vi.fn(),
    materializeOntology: vi.fn(),
  };
});

const connector = {
  id: "connector-1",
  connector_type: "ontology_knowledge_graph" as const,
  connector_key: "fuseki",
  status: "Active" as const,
  title: "Primary Graph Store",
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

const generatedDraft: OntologyDefinitionResponse = {
  id: "onto-gen-1",
  application_id: "app-1",
  version_number: 1,
  previous_version_id: null,
  status: "Draft",
  title: "Vendor Ontology",
  description: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  validated_at: null,
  approved_at: null,
  published_at: null,
  version_created_at: null,
  ontology_definition: {
    schema_version: "1",
    classes: [{ name: "Vendor", label: "Vendor", description: "A supplier", evidence: [] }],
    properties: [],
    relationships: [],
    metadata: { mode: "generate", generate: {} },
  },
  connector_id: null,
  artifact_uri: null,
  source_format: null,
  semantic_transaction_id: "txn-generate-1",
};

const generateResponse: OntologyGenerateResponse = {
  ontology: generatedDraft,
  extraction: {
    available: true,
    extracted_at: "2025-06-01T10:00:00Z",
    extraction_id: "ext-1",
    model: "stub-model",
    summary: "Extracted 1 class, 1 property, 1 relationship",
    classes: [
      {
        name: "Vendor",
        label: "Vendor",
        description: "A supplier of goods",
        evidence: [{ snippet: "vendors supply goods to customers", source_ref: "notes" }],
      },
    ],
    properties: [
      {
        name: "vendorName",
        label: "Vendor name",
        domain: "Vendor",
        datatype: "string",
        description: null,
        evidence: [],
      },
    ],
    relationships: [
      {
        name: "suppliesTo",
        label: null,
        domain: "Vendor",
        range: "Customer",
        description: null,
        evidence: [{ snippet: "a vendor supplies to a customer", source_ref: null }],
      },
    ],
    sources: [{ kind: "paste", name: "notes", reference_id: null, content_length: 34 }],
  },
  semantic_transaction_id: "txn-generate-1",
};

const unavailableResponse: OntologyGenerateResponse = {
  ontology: {
    ...generatedDraft,
    ontology_definition: {
      schema_version: "1",
      classes: [],
      properties: [],
      relationships: [],
      metadata: { mode: "generate", generate: {} },
    },
  },
  extraction: {
    available: false,
    extracted_at: "2025-06-01T10:00:00Z",
    extraction_id: "ext-2",
    model: null,
    summary: null,
    classes: [],
    properties: [],
    relationships: [],
    sources: [{ kind: "paste", name: "notes", reference_id: null, content_length: 34 }],
  },
  semantic_transaction_id: "txn-generate-2",
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderPage(initialEntry = "/applications/app-1/ontology/create?mode=generate") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/applications/:applicationId/ontology/create"
          element={<OntologyStudioPage applicationId="app-1" />}
        />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const materializedGeneratedDraft: OntologyDefinitionResponse = {
  ...generatedDraft,
  status: "Approved",
  connector_id: "connector-1",
  artifact_uri: "fuseki://app-demo/ontologies/onto-gen-1/artifact.ttl",
  semantic_transaction_id: "txn-materialize-gen-1",
};

async function addPastedSourceAndGenerate() {
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Step 1 · Add sources" })).toBeInTheDocument();
  });

  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Vendor Ontology" },
  });

  fireEvent.click(screen.getByRole("tab", { name: "Paste text" }));
  fireEvent.change(screen.getByLabelText("Pasted text"), {
    target: { value: "vendors supply goods to customers" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add pasted source" }));

  await waitFor(() => {
    expect(screen.getByText(/Sources \(1\)/)).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "Generate draft from sources" }));

  await waitFor(() => {
    expect(
      screen.getByRole("heading", { name: /Step \d+ · Review candidates/ }),
    ).toBeInTheDocument();
  });
}

describe("OntologyStudioPage · Generate from Sources", () => {
  beforeEach(() => {
    vi.mocked(listConnectors).mockReset();
    vi.mocked(generateOntology).mockReset();
    vi.mocked(updateOntology).mockReset();
    vi.mocked(updateOntologyConnector).mockReset();
    vi.mocked(runOntologyValidation).mockReset();
    vi.mocked(updateOntologyStatus).mockReset();
    vi.mocked(materializeOntology).mockReset();
    vi.mocked(listConnectors).mockResolvedValue([connector]);
    vi.mocked(generateOntology).mockResolvedValue(generateResponse);
    vi.mocked(updateOntology).mockResolvedValue(generatedDraft);
    vi.mocked(updateOntologyConnector).mockResolvedValue({
      ...generatedDraft,
      connector_id: "connector-1",
    });
    vi.mocked(runOntologyValidation).mockResolvedValue({
      ontology: generatedDraft,
      report: {
        passed: true,
        error_count: 0,
        warning_count: 0,
        findings: [],
        stats: { triple_count: 3 },
        run_at: "2025-06-01T10:00:00Z",
        run_id: "run-gen-1",
        ai_summary: null,
        inventory: { classes: [], relations: [], truncated: false },
      },
      semantic_review: {
        available: false,
        reviewed_at: "2025-06-01T10:00:00Z",
        review_id: "review-gen-1",
        model: null,
        summary: null,
        findings: [],
      },
      semantic_transaction_id: "txn-validate-gen-1",
    });
    vi.mocked(updateOntologyStatus).mockImplementation(async (_id, status) => ({
      ...generatedDraft,
      status,
      connector_id: "connector-1",
    }));
    vi.mocked(materializeOntology).mockResolvedValue(materializedGeneratedDraft);
  });

  it("allows generate mode without an active graph store connector", async () => {
    vi.mocked(listConnectors).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Step \d+ · Add sources/ })).toBeInTheDocument();
    });

    expect(screen.queryByText(/No graph store connector is ready yet/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate draft from sources" })).toBeInTheDocument();
  });

  it("selects Generate mode from the mode step", async () => {
    renderPage("/applications/app-1/ontology/create");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Create ontology" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("radio", { name: /Generate from Sources/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Step \d+ · Add sources/ })).toBeInTheDocument();
    });
  });

  it("generates a draft from sources and renders editable candidates with evidence", async () => {
    renderPage();
    await addPastedSourceAndGenerate();

    expect(generateOntology).toHaveBeenCalledWith(
      expect.objectContaining({
        application_id: "app-1",
        title: "Vendor Ontology",
        sources: [
          expect.objectContaining({
            kind: "paste",
            content: "vendors supply goods to customers",
            name: "Pasted text",
          }),
        ],
      }),
    );

    // Candidate concepts are rendered as editable inputs.
    expect(screen.getByLabelText("Candidate class name")).toHaveValue("Vendor");
    expect(screen.getByRole("heading", { name: "Sample / stub output" })).toBeInTheDocument();
    expect(screen.getByLabelText("Candidate property name")).toHaveValue("vendorName");
    expect(screen.getByLabelText("Candidate relationship name")).toHaveValue("suppliesTo");

    // Evidence snippets are displayed per suggestion.
    expect(screen.getByText(/vendors supply goods to customers/)).toBeInTheDocument();
    expect(screen.getByText(/a vendor supplies to a customer/)).toBeInTheDocument();
  });

  it("adds a web URL source and sends kind url with url payload", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Step 1 · Add sources" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "URL Ontology" },
    });

    fireEvent.click(screen.getByRole("tab", { name: "Web URL" }));
    fireEvent.change(screen.getByLabelText("Web URL"), {
      target: { value: "https://example.com/glossary" },
    });
    fireEvent.change(screen.getByLabelText(/Source name/), {
      target: { value: "Glossary page" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add URL source" }));

    await waitFor(() => {
      expect(screen.getByText("https://example.com/glossary")).toBeInTheDocument();
      expect(screen.getByText(/url · https:\/\/example\.com\/glossary/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate draft from sources" }));

    await waitFor(() => {
      expect(generateOntology).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "URL Ontology",
          sources: [
            expect.objectContaining({
              kind: "url",
              url: "https://example.com/glossary",
              name: "Glossary page",
            }),
          ],
        }),
      );
    });

    const payload = vi.mocked(generateOntology).mock.calls[0]?.[0];
    expect(payload?.sources?.[0]).not.toHaveProperty("content");
  });

  it("shows client validation error for invalid URL input", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Step 1 · Add sources" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Web URL" }));
    fireEvent.change(screen.getByLabelText("Web URL"), {
      target: { value: "ftp://example.com/doc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add URL source" }));

    await waitFor(() => {
      expect(screen.getByText(/http or https/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Sources \(0\)/)).toBeInTheDocument();
  });

  it("adds a CSV file source with parsed tab-separated content", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Step 1 · Add sources" })).toBeInTheDocument();
    });

    const csvFile = new File(["class,description\nVendor,A supplier"], "vendors.csv", {
      type: "text/csv",
    });

    fireEvent.change(screen.getByLabelText("Source file"), {
      target: { files: [csvFile] },
    });

    await waitFor(() => {
      expect(screen.getByText(/vendors\.csv/)).toBeInTheDocument();
      expect(screen.getByText(/Sources \(1\)/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "CSV Ontology" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate draft from sources" }));

    await waitFor(() => {
      expect(generateOntology).toHaveBeenCalledWith(
        expect.objectContaining({
          sources: [
            expect.objectContaining({
              kind: "file",
              name: "vendors.csv",
              content: "class\tdescription\nVendor\tA supplier",
            }),
          ],
        }),
      );
    });
  });

  it("surfaces API 422 errors from generateOntology", async () => {
    vi.mocked(generateOntology).mockRejectedValue(
      new ApiError("url is required when kind is url", 422, { detail: "url is required when kind is url" }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Step 1 · Add sources" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Vendor Ontology" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Paste text" }));
    fireEvent.change(screen.getByLabelText("Pasted text"), {
      target: { value: "vendors supply goods to customers" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add pasted source" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate draft from sources" }));

    await waitFor(() => {
      expect(screen.getByText("url is required when kind is url")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("heading", { name: /Step \d+ · Review candidates/ }),
    ).not.toBeInTheDocument();
  });

  it("persists edits to a candidate on approval and advances to the connector step", async () => {
    renderPage();
    await addPastedSourceAndGenerate();

    fireEvent.change(screen.getByLabelText("Candidate class name"), {
      target: { value: "Supplier" },
    });

    fireEvent.click(
      screen.getByLabelText(/I approve this generated draft/),
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve & continue" }));

    await waitFor(() => {
      expect(updateOntology).toHaveBeenCalledWith(
        "onto-gen-1",
        expect.objectContaining({
          title: "Vendor Ontology",
          ontology_definition: expect.objectContaining({
            classes: expect.arrayContaining([
              expect.objectContaining({ name: "Supplier" }),
            ]),
          }),
        }),
      );
    });

    // Generate mode now continues into the shared connector → review → materialize
    // path instead of terminating on the draft.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Step \d+ · Connector/ })).toBeInTheDocument();
    });
  });

  it("gates advancing on explicit approval of the generated draft", async () => {
    renderPage();
    await addPastedSourceAndGenerate();

    const approveButton = screen.getByRole("button", { name: "Approve & continue" });
    expect(approveButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/I approve this generated draft/));
    expect(approveButton).toBeEnabled();
    expect(updateOntology).not.toHaveBeenCalled();
  });

  it("handles LLM-unavailable extraction gracefully", async () => {
    vi.mocked(generateOntology).mockResolvedValue(unavailableResponse);

    renderPage();
    await addPastedSourceAndGenerate();

    expect(screen.getByRole("heading", { name: "Extraction unavailable" })).toBeInTheDocument();

    // The empty draft can still be approved and carried into the connector step.
    fireEvent.click(screen.getByLabelText(/I approve this generated draft/));
    fireEvent.click(screen.getByRole("button", { name: "Approve & continue" }));

    await waitFor(() => {
      expect(updateOntology).toHaveBeenCalledWith(
        "onto-gen-1",
        expect.objectContaining({
          ontology_definition: expect.objectContaining({
            classes: [],
            properties: [],
            relationships: [],
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Step \d+ · Connector/ })).toBeInTheDocument();
    });
  });

  it("carries a generated draft through connector, review, and materialize with redirect", async () => {
    renderPage();
    await addPastedSourceAndGenerate();

    fireEvent.click(screen.getByLabelText(/I approve this generated draft/));
    fireEvent.click(screen.getByRole("button", { name: "Approve & continue" }));

    // Connector step attaches the graph store connector to the existing draft.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Step \d+ · Connector/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(updateOntologyConnector).toHaveBeenCalledWith("onto-gen-1", "connector-1");
    });

    // Review & run summary reached for the generated draft.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Step \d+ · Review & run/ }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Classes").nextElementSibling).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Continue to approve" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Step \d+ · Approve & materialize/ }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve & materialize" }));

    await waitFor(() => {
      expect(runOntologyValidation).toHaveBeenCalledWith("onto-gen-1");
      expect(updateOntologyStatus).toHaveBeenCalledWith("onto-gen-1", "Approved");
      expect(materializeOntology).toHaveBeenCalledWith("onto-gen-1");
    });

    await waitFor(() => {
      expect(screen.getByTestId("location-probe")).toHaveTextContent(
        "/applications/app-1/semantic-transactions/txn-materialize-gen-1",
      );
    });
  }, 15000);
});

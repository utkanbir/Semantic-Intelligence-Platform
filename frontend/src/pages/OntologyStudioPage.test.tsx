import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { listConnectors } from "../api/adapters";
import {
  createOntology,
  importOntology,
  materializeOntology,
  runOntologyValidation,
  updateOntology,
  updateOntologyStatus,
  validateOntologyContent,
  type OntologyDefinitionResponse,
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
    createOntology: vi.fn(),
    importOntology: vi.fn(),
    materializeOntology: vi.fn(),
    updateOntology: vi.fn(),
    validateOntologyContent: vi.fn(),
    runOntologyValidation: vi.fn(),
    updateOntologyStatus: vi.fn(),
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

const draftOntology: OntologyDefinitionResponse = {
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
  artifact_uri: null,
  source_format: "ttl",
  semantic_transaction_id: "txn-import-1",
};

const materializedOntology: OntologyDefinitionResponse = {
  ...draftOntology,
  status: "Approved",
  artifact_uri: "fuseki://app-demo/ontologies/onto-1/artifact.ttl",
  semantic_transaction_id: "txn-materialize-1",
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderPage(initialEntry = "/applications/app-1/ontology/create") {
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

const passingValidationReport = {
  passed: true,
  error_count: 0,
  warning_count: 0,
  findings: [],
  stats: { triple_count: 1 },
  run_at: "2025-06-01T10:00:00Z",
  run_id: "run-1",
  ai_summary: "Advisory summary",
  inventory: {
    classes: [
      {
        uri: "http://example.org/Vendor",
        label: "Vendor",
        local_name: "Vendor",
      },
    ],
    relations: [],
    truncated: false,
  },
};

function fillImportPasteContent(
  content: string,
  options?: { format?: string; title?: string },
) {
  if (options?.title) {
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: options.title },
    });
  }
  if (options?.format) {
    fireEvent.change(screen.getByLabelText("Source format"), {
      target: { value: options.format },
    });
  }
  fireEvent.change(screen.getByLabelText("Ontology content"), {
    target: { value: content },
  });
}

async function goToReviewStep(options?: { createdBy?: string; approveImport?: boolean }) {
  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Step \d+ · Validate/ })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  if (options?.approveImport) {
    // Validation runs, but advancing to the Connector step requires the user to
    // explicitly approve the parsed content first.
    await waitFor(() => {
      expect(screen.getByLabelText(/I approve this parsed content/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText(/I approve this parsed content/));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  }

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Step \d+ · Connector/ })).toBeInTheDocument();
  });

  if (options?.createdBy) {
    fireEvent.change(screen.getByLabelText(/Created by/), {
      target: { value: options.createdBy },
    });
  }

  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Step \d+ · Review & run/ })).toBeInTheDocument();
  });
}

describe("OntologyStudioPage", () => {
  beforeEach(() => {
    vi.mocked(listConnectors).mockReset();
    vi.mocked(createOntology).mockReset();
    vi.mocked(importOntology).mockReset();
    vi.mocked(materializeOntology).mockReset();
    vi.mocked(updateOntology).mockReset();
    vi.mocked(validateOntologyContent).mockReset();
    vi.mocked(runOntologyValidation).mockReset();
    vi.mocked(updateOntologyStatus).mockReset();
    vi.mocked(listConnectors).mockResolvedValue([connector]);
    vi.mocked(validateOntologyContent).mockResolvedValue(passingValidationReport);
    vi.mocked(createOntology).mockResolvedValue(draftOntology);
    vi.mocked(updateOntology).mockResolvedValue(draftOntology);
    vi.mocked(importOntology).mockResolvedValue(draftOntology);
    vi.mocked(runOntologyValidation).mockResolvedValue({
      ontology: draftOntology,
      report: passingValidationReport,
      semantic_review: {
        available: false,
        reviewed_at: "2025-06-01T10:00:00Z",
        review_id: "review-1",
        model: null,
        summary: null,
        findings: [],
      },
      semantic_transaction_id: "txn-validate-1",
    });
    vi.mocked(updateOntologyStatus).mockImplementation(async (_id, status) => ({
      ...draftOntology,
      status,
      approved_at: status === "Approved" ? "2025-06-01T11:00:00Z" : null,
      validated_at: status === "Validated" ? "2025-06-01T10:30:00Z" : null,
    }));
    vi.mocked(materializeOntology).mockResolvedValue(materializedOntology);
  });

  it("creates a structured manual ontology draft and materializes after approval", async () => {
    renderPage("/applications/app-1/ontology/create?mode=manual");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Create ontology · Manual" })).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "Step 1 · Edit draft" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Customer Ontology" },
    });
    fireEvent.change(screen.getByLabelText("Namespace / base IRI"), {
      target: { value: "https://example.com/customer#" },
    });
    fireEvent.change(screen.getByLabelText("Prefix"), {
      target: { value: "cust" },
    });
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "Business vocabulary" },
    });

    // Define a class through the manual CRUD table.
    fireEvent.change(screen.getByLabelText("Class label"), {
      target: { value: "Vendor" },
    });
    fireEvent.change(screen.getByLabelText("Class description"), {
      target: { value: "A supplier of goods" },
    });

    // Add a data property for the class.
    fireEvent.click(screen.getByRole("button", { name: "Add data property" }));
    fireEvent.change(screen.getByLabelText("Data property label"), {
      target: { value: "vendor name" },
    });

    // Live Turtle preview reflects the structured draft.
    expect(screen.getByText(/cust:Vendor a owl:Class/)).toBeInTheDocument();
    expect(screen.getByText(/cust:VendorName a owl:DatatypeProperty/)).toBeInTheDocument();

    await goToReviewStep({ createdBy: "alice@example.com" });

    // The draft is created via createOntology at the connector step.
    await waitFor(() => {
      expect(createOntology).toHaveBeenCalledWith(
        expect.objectContaining({
          application_id: "app-1",
          title: "Customer Ontology",
          connector_id: "connector-1",
          created_by: "alice@example.com",
          description: "Business vocabulary",
          ontology_definition: expect.objectContaining({
            classes: expect.arrayContaining([
              expect.objectContaining({ name: "Vendor", label: "Vendor" }),
            ]),
            properties: expect.arrayContaining([
              expect.objectContaining({ name: "VendorName", datatype: "xsd:string" }),
            ]),
          }),
        }),
      );
    });

    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("Primary Graph Store")).toBeInTheDocument();
    expect(screen.getByText(/@prefix cust:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create draft & continue" }));

    // The structured draft is synced to ontology_definition via PATCH.
    await waitFor(() => {
      expect(updateOntology).toHaveBeenCalledWith(
        "onto-1",
        expect.objectContaining({
          title: "Customer Ontology",
          ontology_definition: expect.objectContaining({
            metadata: expect.objectContaining({
              import: expect.objectContaining({ source_format: "ttl" }),
            }),
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Step 5 · Approve & materialize" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve & materialize" }));

    await waitFor(() => {
      expect(runOntologyValidation).toHaveBeenCalledWith("onto-1");
      expect(updateOntologyStatus).toHaveBeenCalledWith("onto-1", "Validated");
      expect(updateOntologyStatus).toHaveBeenCalledWith("onto-1", "Approved");
      expect(materializeOntology).toHaveBeenCalledWith("onto-1");
    });

    // After materialization the wizard returns to the ontology list.
    await waitFor(() => {
      expect(screen.getByTestId("location-probe")).toHaveTextContent(
        "/applications/app-1/ontology",
      );
    });
  }, 15000);

  it("renders the review summary with concept counts and validation status", async () => {
    renderPage("/applications/app-1/ontology/create?mode=manual");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Step 1 · Edit draft" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Customer Ontology" },
    });
    fireEvent.change(screen.getByLabelText("Namespace / base IRI"), {
      target: { value: "https://example.com/customer#" },
    });
    fireEvent.change(screen.getByLabelText("Prefix"), { target: { value: "cust" } });

    fireEvent.change(screen.getByLabelText("Class label"), { target: { value: "Vendor" } });
    fireEvent.click(screen.getByRole("button", { name: "Add data property" }));
    fireEvent.change(screen.getByLabelText("Data property label"), {
      target: { value: "vendor name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add object property" }));
    fireEvent.change(screen.getByLabelText("Object property label"), {
      target: { value: "supplies to" },
    });

    await goToReviewStep();

    // Summary lists class / object-property / data-property counts, the selected
    // connector, and the validation status.
    const summary = screen.getByText("Summary").closest(".ontology-wizard__review-card");
    expect(summary).not.toBeNull();
    const summaryScope = within(summary as HTMLElement);
    expect(summaryScope.getByText("Classes").nextElementSibling).toHaveTextContent("1");
    expect(summaryScope.getByText("Object properties").nextElementSibling).toHaveTextContent("1");
    expect(summaryScope.getByText("Data properties").nextElementSibling).toHaveTextContent("1");
    expect(summaryScope.getByText("Validation status").nextElementSibling).toHaveTextContent(
      "Passed",
    );
    expect(summaryScope.getByText("Primary Graph Store")).toBeInTheDocument();

    // A TTL preview of the draft is rendered alongside the summary.
    expect(screen.getByText("Ontology preview (TTL)")).toBeInTheDocument();
    expect(screen.getByText(/@prefix cust:/)).toBeInTheDocument();
  });

  it("blocks approve & materialize when re-validation reports blocking errors", async () => {
    vi.mocked(runOntologyValidation).mockResolvedValue({
      ontology: draftOntology,
      report: {
        ...passingValidationReport,
        passed: false,
        error_count: 2,
        findings: [
          { level: "error", code: "empty_graph", message: "Ontology graph is empty" },
        ],
      },
      semantic_review: {
        available: false,
        reviewed_at: "2025-06-01T10:00:00Z",
        review_id: "review-err",
        model: null,
        summary: null,
        findings: [],
      },
      semantic_transaction_id: "txn-validate-err",
    });

    renderPage("/applications/app-1/ontology/create?mode=manual");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Step 1 · Edit draft" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Customer Ontology" } });
    fireEvent.change(screen.getByLabelText("Namespace / base IRI"), {
      target: { value: "https://example.com/customer#" },
    });
    fireEvent.change(screen.getByLabelText("Prefix"), { target: { value: "cust" } });
    fireEvent.change(screen.getByLabelText("Class label"), { target: { value: "Vendor" } });

    await goToReviewStep();
    fireEvent.click(screen.getByRole("button", { name: "Create draft & continue" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Step 5 · Approve & materialize" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Approve & materialize" })).toBeDisabled();
    expect(screen.getByText("Ontology graph is empty")).toBeInTheDocument();
    expect(updateOntologyStatus).not.toHaveBeenCalledWith("onto-1", "Approved");
    expect(materializeOntology).not.toHaveBeenCalled();
  });

  it("surfaces a 422 error when materialize fails", async () => {
    vi.mocked(materializeOntology).mockRejectedValue(
      new ApiError("Materialize requires Approved status", 422),
    );

    renderPage("/applications/app-1/ontology/create?mode=manual");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Step 1 · Edit draft" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Customer Ontology" } });
    fireEvent.change(screen.getByLabelText("Namespace / base IRI"), {
      target: { value: "https://example.com/customer#" },
    });
    fireEvent.change(screen.getByLabelText("Prefix"), { target: { value: "cust" } });
    fireEvent.change(screen.getByLabelText("Class label"), { target: { value: "Vendor" } });

    await goToReviewStep();
    fireEvent.click(screen.getByRole("button", { name: "Create draft & continue" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Step 5 · Approve & materialize" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve & materialize" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Materialize requires Approved status",
      );
    });
    // The wizard stays on the finalize step rather than redirecting.
    expect(screen.queryByTestId("location-probe")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Step 5 · Approve & materialize" }),
    ).toBeInTheDocument();
  });

  it("surfaces manual validation hints for duplicate class names", async () => {
    renderPage("/applications/app-1/ontology/create?mode=manual");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Step 1 · Edit draft" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Customer Ontology" },
    });
    fireEvent.change(screen.getByLabelText("Namespace / base IRI"), {
      target: { value: "https://example.com/customer#" },
    });
    fireEvent.change(screen.getByLabelText("Prefix"), {
      target: { value: "cust" },
    });

    fireEvent.change(screen.getByLabelText("Class label"), {
      target: { value: "Vendor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add class" }));

    const classLabels = screen.getAllByLabelText("Class label");
    fireEvent.change(classLabels[1], { target: { value: "Vendor" } });

    const uniquenessCheck = screen.getByText("Class labels map to unique names");
    await waitFor(() => {
      expect(uniquenessCheck.closest("li")).not.toHaveClass(
        "ontology-wizard__validation-item--passed",
      );
    });
  });

  it("imports ontology RDF content through the draft-first flow", async () => {
    vi.mocked(importOntology).mockResolvedValue({
      ...draftOntology,
      title: "Imported Ontology",
      source_format: "rdf",
    });

    renderPage("/applications/app-1/ontology/create?mode=import");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Create ontology · OWL Import" })).toBeInTheDocument();
    });

    fillImportPasteContent("<rdf:RDF></rdf:RDF>", {
      title: "Imported Ontology",
      format: "rdf",
    });

    await goToReviewStep({ approveImport: true });

    fireEvent.click(screen.getByRole("button", { name: "Create draft & continue" }));

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

  it("blocks advancing when backend validation reports errors", async () => {
    vi.mocked(validateOntologyContent).mockResolvedValue({
      ...passingValidationReport,
      passed: false,
      error_count: 1,
      findings: [
        {
          level: "error",
          code: "empty_graph",
          message: "Parsed ontology graph contains no triples",
        },
      ],
    });

    renderPage("/applications/app-1/ontology/create?mode=import");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Create ontology · OWL Import" })).toBeInTheDocument();
    });

    fillImportPasteContent("<rdf:RDF></rdf:RDF>", {
      title: "Imported Ontology",
      format: "rdf",
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Resolve validation errors before continuing",
      );
    });

    expect(importOntology).not.toHaveBeenCalled();
  });

  it("supports importing ontology content by pasting text through the wizard", async () => {
    renderPage("/applications/app-1/ontology/create?mode=import");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Create ontology · OWL Import" })).toBeInTheDocument();
    });

    fillImportPasteContent("@prefix ex: <https://example.com/> .", {
      title: "vendor",
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Step \d+ · Validate/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // Parsed inventory is presented before the user approves the content.
    await waitFor(() => {
      expect(screen.getByText(/Classes \(1\)/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText(/I approve this parsed content/));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Source format")).toHaveValue("ttl");
    });
  });

  it("supports importing ontology content by pasting OWL/RDF text", async () => {
    vi.mocked(importOntology).mockResolvedValue({
      ...draftOntology,
      title: "Pasted Ontology",
    });

    renderPage("/applications/app-1/ontology/create?mode=import");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Create ontology · OWL Import" }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Pasted Ontology" },
    });

    const pastedContent = "@prefix ex: <https://example.com/> .\nex:Vendor a owl:Class .";
    fireEvent.change(screen.getByLabelText("Ontology content"), {
      target: { value: pastedContent },
    });

    await goToReviewStep({ approveImport: true });

    fireEvent.click(screen.getByRole("button", { name: "Create draft & continue" }));

    await waitFor(() => {
      expect(importOntology).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "Pasted Ontology",
        connector_id: "connector-1",
        source_format: "ttl",
        source_content: pastedContent,
      });
    });
  });

  it("requires explicit approval of parsed content before advancing to Connector", async () => {
    renderPage("/applications/app-1/ontology/create?mode=import");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Create ontology · OWL Import" }),
      ).toBeInTheDocument();
    });

    fillImportPasteContent("@prefix ex: <https://example.com/> .", {
      title: "Imported Ontology",
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Step \d+ · Validate/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // Validation runs and the parsed inventory is shown, but advancing is blocked
    // until the user explicitly approves the parsed content.
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Approve the parsed content to continue",
      );
    });
    expect(
      screen.queryByRole("heading", { name: /Step \d+ · Connector/ }),
    ).not.toBeInTheDocument();
    expect(importOntology).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/I approve this parsed content/));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Step \d+ · Connector/ })).toBeInTheDocument();
    });
  });

  it("shows warnings separately and lets the user proceed past them", async () => {
    vi.mocked(validateOntologyContent).mockResolvedValue({
      ...passingValidationReport,
      warning_count: 1,
      findings: [
        {
          level: "warning",
          code: "missing_label",
          message: "Class Vendor has no rdfs:label",
        },
      ],
    });

    renderPage("/applications/app-1/ontology/create?mode=import");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Create ontology · OWL Import" }),
      ).toBeInTheDocument();
    });

    fillImportPasteContent("@prefix ex: <https://example.com/> .", {
      title: "Imported Ontology",
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Step \d+ · Validate/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // Warnings render in a dedicated, non-blocking section.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Warnings" })).toBeInTheDocument();
    });
    expect(screen.getByText("Class Vendor has no rdfs:label")).toBeInTheDocument();
    expect(screen.getByText(/Warnings are advisory/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Blocking errors" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/I approve this parsed content/));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Step \d+ · Connector/ })).toBeInTheDocument();
    });
  });

  it("validates that a mode is selected before continuing", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Create ontology" })).toBeInTheDocument();
    });

    expect(screen.getByText("Generate from Sources")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Choose Manual or OWL Import to continue",
      );
    });
  });

  it("pre-selects manual mode from query string and skips mode step", async () => {
    renderPage("/applications/app-1/ontology/create?mode=manual");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Step 1 · Edit draft" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("heading", { name: /Step 1 · Mode/i })).not.toBeInTheDocument();
  });

  it("shows empty state when no ready graph store connectors exist", async () => {
    vi.mocked(listConnectors).mockResolvedValue([
      {
        ...connector,
        id: "connector-configured",
        status: "Configured",
        activated_at: null,
      },
    ]);

    renderPage("/applications/app-1/ontology/create?mode=import");

    await waitFor(() => {
      expect(screen.getByText(/No graph store connector is ready yet/)).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "Open connectors" })).toHaveAttribute(
      "href",
      "/connectors",
    );
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("blocks manual mode when no ready graph store connectors exist", async () => {
    vi.mocked(listConnectors).mockResolvedValue([]);

    renderPage("/applications/app-1/ontology/create?mode=manual");

    await waitFor(() => {
      expect(screen.getByText(/No graph store connector is ready yet/)).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listConnectors } from "../api/adapters";
import {
  createOntology,
  materializeOntology,
  recordSuggestionDecision,
  runOntologyValidation,
  updateOntology,
  updateOntologyStatus,
  validateOntologyContent,
  type OntologySemanticReview,
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
    recordSuggestionDecision: vi.fn(),
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
  connector_configuration: { vendor: "apache_fuseki" },
};

const passingValidationReport = {
  passed: true,
  error_count: 0,
  warning_count: 0,
  findings: [],
  stats: { triple_count: 1 },
  run_at: "2025-06-01T10:00:00Z",
  run_id: "run-1",
  ai_summary: null,
  inventory: {
    classes: [{ uri: "http://example.org/Vendor", label: "Vendor", local_name: "Vendor" }],
    relations: [],
    truncated: false,
  },
};

const semanticReview: OntologySemanticReview = {
  available: true,
  reviewed_at: "2025-06-01T10:05:00Z",
  review_id: "review-1",
  model: "test-llm",
  summary: "One naming suggestion.",
  findings: [
    {
      id: "finding-1",
      kind: "suggestion",
      title: "Use Supplier instead of Vendor",
      detail: "Aligns better with procurement vocabulary.",
      target: "Vendor",
      decision: null,
    },
    {
      id: "finding-2",
      kind: "warning",
      title: "Sparse property definitions",
      detail: "Only one datatype property detected.",
      target: null,
      decision: null,
    },
  ],
};

const draftOntology = {
  id: "onto-1",
  application_id: "app-1",
  version_number: 1,
  previous_version_id: null,
  status: "Draft" as const,
  title: "Customer Ontology",
  description: null,
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
  semantic_transaction_id: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/applications/app-1/ontology/create?mode=manual"]}>
      <Routes>
        <Route
          path="/applications/:applicationId/ontology/create"
          element={<OntologyStudioPage applicationId="app-1" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function reachFinalizeStep() {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Customer Ontology" } });
  fireEvent.change(screen.getByLabelText("Namespace / base IRI"), {
    target: { value: "https://example.com/customer#" },
  });
  fireEvent.change(screen.getByLabelText("Prefix"), { target: { value: "cust" } });
  fireEvent.change(screen.getByLabelText("Class label"), { target: { value: "Vendor" } });

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Step \d+ · Validate/ })).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Step \d+ · Connector/ })).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Step \d+ · Review & run/ })).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole("button", { name: "Create draft & continue" }));
  await waitFor(() => {
    expect(
      screen.getByRole("heading", { name: /Step \d+ · Approve & materialize/ }),
    ).toBeInTheDocument();
  });
}

describe("OntologyStudioPage · semantic review", () => {
  beforeEach(() => {
    vi.mocked(listConnectors).mockResolvedValue([connector]);
    vi.mocked(validateOntologyContent).mockResolvedValue(passingValidationReport);
    vi.mocked(createOntology).mockResolvedValue(draftOntology);
    vi.mocked(updateOntology).mockResolvedValue(draftOntology);
    vi.mocked(runOntologyValidation).mockResolvedValue({
      ontology: draftOntology,
      report: passingValidationReport,
      semantic_review: semanticReview,
      semantic_transaction_id: "txn-validate-1",
    });
    vi.mocked(updateOntologyStatus).mockImplementation(async (_id, status) => ({
      ...draftOntology,
      status,
    }));
    vi.mocked(materializeOntology).mockResolvedValue({
      ...draftOntology,
      status: "Approved",
      semantic_transaction_id: "txn-materialize-1",
    });
    vi.mocked(recordSuggestionDecision).mockReset();
  });

  it("shows semantic review separately on finalize after validation runs", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Step 1 · Edit draft" })).toBeInTheDocument();
    });

    await reachFinalizeStep();

    await waitFor(() => {
      expect(runOntologyValidation).toHaveBeenCalledWith("onto-1");
    });

    expect(screen.getByRole("heading", { name: "Validation report" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Advisory semantic review" })).toBeInTheDocument();
    expect(screen.getByText("Use Supplier instead of Vendor")).toBeInTheDocument();
    expect(screen.getByText("Sparse property definitions")).toBeInTheDocument();
    expect(screen.getByText(/One naming suggestion/)).toBeInTheDocument();
  });

  it("records accept decision for suggestion findings on finalize", async () => {
    vi.mocked(recordSuggestionDecision).mockResolvedValue({
      ontology: draftOntology,
      semantic_review: {
        ...semanticReview,
        findings: semanticReview.findings.map((finding) =>
          finding.id === "finding-1" ? { ...finding, decision: "accepted" as const } : finding,
        ),
      },
      semantic_transaction_id: "txn-decision-1",
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Step 1 · Edit draft" })).toBeInTheDocument();
    });
    await reachFinalizeStep();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Accept suggestion: Use Supplier instead of Vendor" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Accept suggestion: Use Supplier instead of Vendor" }),
    );

    await waitFor(() => {
      expect(recordSuggestionDecision).toHaveBeenCalledWith("onto-1", "finding-1", {
        decision: "accepted",
      });
    });

    const reviewCard = screen
      .getByRole("heading", { name: "Advisory semantic review" })
      .closest(".ontology-wizard__review-card");
    expect(reviewCard).not.toBeNull();
    expect(within(reviewCard as HTMLElement).getByText("Accepted")).toBeInTheDocument();
  });

  it("shows graceful unavailable message when semantic review is off", async () => {
    vi.mocked(runOntologyValidation).mockResolvedValue({
      ontology: draftOntology,
      report: passingValidationReport,
      semantic_review: {
        available: false,
        reviewed_at: "2025-06-01T10:05:00Z",
        review_id: "review-off",
        model: null,
        summary: null,
        findings: [],
      },
      semantic_transaction_id: "txn-validate-1",
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Step 1 · Edit draft" })).toBeInTheDocument();
    });
    await reachFinalizeStep();

    await waitFor(() => {
      expect(screen.getByText(/Advisory semantic review is unavailable/)).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Accept suggestion/ })).not.toBeInTheDocument();
  });
});

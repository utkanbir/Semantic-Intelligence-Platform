import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import {
  runOntologyValidation,
  updateOntologyStatus,
  type OntologyDefinitionResponse,
} from "../api/ontologies";
import { OntologyValidationPage } from "./OntologyValidationPage";

vi.mock("../api/ontologies", () => ({
  runOntologyValidation: vi.fn(),
  updateOntologyStatus: vi.fn(),
}));

const ontology: OntologyDefinitionResponse = {
  id: "onto-1",
  application_id: "app-1",
  version_number: 1,
  previous_version_id: null,
  status: "Draft",
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
  artifact_uri: "fuseki://app-demo/ontologies/onto-1/artifact.ttl",
  source_format: "ttl",
  semantic_transaction_id: null,
};

const passingReport = {
  passed: true,
  error_count: 0,
  warning_count: 1,
  findings: [
    {
      level: "warning" as const,
      code: "missing_base_namespace",
      message: "No owl:Ontology declaration or xml:base attribute detected",
    },
    {
      level: "info" as const,
      code: "stats",
      message: "Detected 1 classes, 0 properties, 3 triples",
    },
  ],
  stats: { triple_count: 3, class_count: 1, property_count: 0 },
  run_at: "2025-06-01T10:00:00Z",
  run_id: "run-1",
  ai_summary: "Advisory: ontology structure looks usable.",
  inventory: {
    classes: [
      {
        uri: "http://example.org/Vendor",
        label: "Vendor",
        local_name: "Vendor",
      },
    ],
    relations: [
      {
        uri: "http://example.org/placedBy",
        label: "placed by",
        local_name: "placedBy",
        property_type: "object" as const,
        domain: "http://example.org/Order",
        range: "http://example.org/Customer",
      },
    ],
    truncated: false,
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/applications/app-1/ontology/onto-1/validate"]}>
      <Routes>
        <Route
          path="/applications/:applicationId/ontology/:ontologyId/validate"
          element={<OntologyValidationPage applicationId="app-1" ontologyId="onto-1" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const unavailableSemanticReview = {
  available: false,
  reviewed_at: "2025-06-01T10:00:00Z",
  review_id: "review-1",
  model: null,
  summary: null,
  findings: [],
};

describe("OntologyValidationPage", () => {
  beforeEach(() => {
    vi.mocked(runOntologyValidation).mockReset();
    vi.mocked(updateOntologyStatus).mockReset();
    vi.mocked(runOntologyValidation).mockResolvedValue({
      ontology,
      report: passingReport,
      semantic_review: unavailableSemanticReview,
      semantic_transaction_id: "txn-validate-1",
    });
  });

  it("renders validation report and confirms when passed", async () => {
    vi.mocked(updateOntologyStatus).mockResolvedValue({
      ...ontology,
      status: "Validated",
      validated_at: "2025-06-02T10:00:00Z",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Structural validation passed/)).toBeInTheDocument();
    });

    expect(screen.getByText("Vendor")).toBeInTheDocument();
    expect(screen.getByText("placed by")).toBeInTheDocument();
    expect(screen.getByText(passingReport.ai_summary!)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm validation" }));

    await waitFor(() => {
      expect(updateOntologyStatus).toHaveBeenCalledWith("onto-1", "Validated");
    });

    expect(screen.getByText("Ontology marked as Validated.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve ontology" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm validation" })).not.toBeInTheDocument();
  });

  it("approves ontology after validation is confirmed", async () => {
    vi.mocked(updateOntologyStatus)
      .mockResolvedValueOnce({
        ...ontology,
        status: "Validated",
        validated_at: "2025-06-02T10:00:00Z",
      })
      .mockResolvedValueOnce({
        ...ontology,
        status: "Approved",
        validated_at: "2025-06-02T10:00:00Z",
        approved_at: "2025-06-02T11:00:00Z",
      });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm validation" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm validation" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Approve ontology" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve ontology" }));

    await waitFor(() => {
      expect(updateOntologyStatus).toHaveBeenCalledWith("onto-1", "Approved");
    });

    expect(screen.getByText("Ontology approved.")).toBeInTheDocument();
  });

  it("shows approve action when ontology is already validated", async () => {
    vi.mocked(runOntologyValidation).mockResolvedValue({
      ontology: {
        ...ontology,
        status: "Validated",
        validated_at: "2025-06-02T10:00:00Z",
      },
      report: passingReport,
      semantic_review: unavailableSemanticReview,
      semantic_transaction_id: "txn-validate-1",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Approve ontology" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Confirm validation" })).not.toBeInTheDocument();
    expect(screen.getByText(/Structural validation is complete/)).toBeInTheDocument();
  });

  it("disables confirm when validation failed", async () => {
    vi.mocked(runOntologyValidation).mockResolvedValue({
      ontology,
      report: {
        ...passingReport,
        passed: false,
        error_count: 1,
        findings: [
          {
            level: "error",
            code: "empty_graph",
            message: "Parsed ontology graph contains no triples",
          },
        ],
      },
      semantic_review: unavailableSemanticReview,
      semantic_transaction_id: "txn-validate-1",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Structural validation failed/)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Confirm validation" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Approve ontology" })).not.toBeInTheDocument();
  });

  it("does not show approve when validated ontology failed validation", async () => {
    vi.mocked(runOntologyValidation).mockResolvedValue({
      ontology: {
        ...ontology,
        status: "Validated",
        validated_at: "2025-06-02T10:00:00Z",
      },
      report: {
        ...passingReport,
        passed: false,
        error_count: 1,
        findings: [
          {
            level: "error",
            code: "empty_graph",
            message: "Parsed ontology graph contains no triples",
          },
        ],
      },
      semantic_review: unavailableSemanticReview,
      semantic_transaction_id: "txn-validate-1",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Structural validation failed/)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Approve ontology" })).toBeDisabled();
  });

  it("shows load error", async () => {
    vi.mocked(runOntologyValidation).mockRejectedValue(new ApiError("Validation failed", 502));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Validation failed");
    });
  });
});

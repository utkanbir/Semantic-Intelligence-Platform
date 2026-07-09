import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import {
  recordSuggestionDecision,
  type OntologySemanticReview,
} from "../api/ontologies";
import { SemanticReviewPanel } from "./SemanticReviewPanel";

vi.mock("../api/ontologies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/ontologies")>();
  return {
    ...actual,
    recordSuggestionDecision: vi.fn(),
  };
});

const availableReview: OntologySemanticReview = {
  available: true,
  reviewed_at: "2025-06-01T10:00:00Z",
  review_id: "review-1",
  model: "test-model",
  summary: "Two advisory suggestions for naming consistency.",
  findings: [
    {
      id: "finding-suggestion-1",
      kind: "suggestion",
      title: "Rename Vendor class",
      detail: "Consider using Supplier instead of Vendor for clarity.",
      target: "Vendor",
      decision: null,
    },
    {
      id: "finding-warning-1",
      kind: "warning",
      title: "Missing domain",
      detail: "Object property lacks an explicit domain.",
      target: "suppliesTo",
      decision: null,
    },
    {
      id: "finding-improvement-1",
      kind: "improvement",
      title: "Add labels",
      detail: "Several classes are missing rdfs:label values.",
      target: null,
      decision: null,
    },
  ],
};

const unavailableReview: OntologySemanticReview = {
  available: false,
  reviewed_at: "2025-06-01T10:00:00Z",
  review_id: "review-unavailable",
  model: null,
  summary: null,
  findings: [],
};

describe("SemanticReviewPanel", () => {
  beforeEach(() => {
    vi.mocked(recordSuggestionDecision).mockReset();
  });

  it("renders unavailable message without crashing when LLM review is off", () => {
    const onReviewChange = vi.fn();
    render(
      <SemanticReviewPanel
        ontologyId="onto-1"
        review={unavailableReview}
        onReviewChange={onReviewChange}
      />,
    );

    expect(screen.getByRole("heading", { name: "Advisory semantic review" })).toBeInTheDocument();
    expect(screen.getByText(/Advisory semantic review is unavailable/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Accept/ })).not.toBeInTheDocument();
  });

  it("lists semantic findings separately with accept and ignore for suggestions only", () => {
    render(
      <SemanticReviewPanel
        ontologyId="onto-1"
        review={availableReview}
        onReviewChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Rename Vendor class")).toBeInTheDocument();
    expect(screen.getByText("Missing domain")).toBeInTheDocument();
    expect(screen.getByText("Add labels")).toBeInTheDocument();
    expect(screen.getByText(/Two advisory suggestions/)).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Accept suggestion: Rename Vendor class" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ignore suggestion: Rename Vendor class" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Accept suggestion: Missing domain/ })).toBeNull();
  });

  it("records accepted decision and shows accepted state", async () => {
    const onReviewChange = vi.fn();
    vi.mocked(recordSuggestionDecision).mockResolvedValue({
      ontology: {
        id: "onto-1",
        application_id: "app-1",
        version_number: 1,
        previous_version_id: null,
        status: "Draft",
        title: "Test",
        description: null,
        created_by: "alice",
        created_at: "2025-06-01T10:00:00Z",
        updated_at: "2025-06-01T10:00:00Z",
        validated_at: null,
        approved_at: null,
        published_at: null,
        version_created_at: null,
        ontology_definition: {},
      },
      semantic_review: {
        ...availableReview,
        findings: availableReview.findings.map((finding) =>
          finding.id === "finding-suggestion-1"
            ? { ...finding, decision: "accepted" as const }
            : finding,
        ),
      },
      semantic_transaction_id: "txn-decision-1",
    });

    render(
      <SemanticReviewPanel
        ontologyId="onto-1"
        review={availableReview}
        onReviewChange={onReviewChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Accept suggestion: Rename Vendor class" }),
    );

    await waitFor(() => {
      expect(recordSuggestionDecision).toHaveBeenCalledWith("onto-1", "finding-suggestion-1", {
        decision: "accepted",
      });
      expect(onReviewChange).toHaveBeenCalledWith(
        expect.objectContaining({
          findings: expect.arrayContaining([
            expect.objectContaining({ id: "finding-suggestion-1", decision: "accepted" }),
          ]),
        }),
      );
    });
  });

  it("records ignored decision and surfaces API errors", async () => {
    const onError = vi.fn();
    vi.mocked(recordSuggestionDecision).mockRejectedValue(
      new ApiError("Semantic review not available", 422),
    );

    render(
      <SemanticReviewPanel
        ontologyId="onto-1"
        review={availableReview}
        onReviewChange={vi.fn()}
        onError={onError}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ignore suggestion: Rename Vendor class" }),
    );

    await waitFor(() => {
      expect(recordSuggestionDecision).toHaveBeenCalledWith("onto-1", "finding-suggestion-1", {
        decision: "ignored",
      });
      expect(onError).toHaveBeenCalledWith("Semantic review not available");
    });
  });

  it("shows recorded decision state for accepted suggestions", () => {
    render(
      <SemanticReviewPanel
        ontologyId="onto-1"
        review={{
          ...availableReview,
          findings: availableReview.findings.map((finding) =>
            finding.id === "finding-suggestion-1"
              ? { ...finding, decision: "accepted" as const }
              : finding,
          ),
        }}
        onReviewChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Accept suggestion/ })).not.toBeInTheDocument();
  });
});

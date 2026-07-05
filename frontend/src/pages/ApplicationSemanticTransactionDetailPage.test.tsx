import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../api";
import {
  getSemanticTransaction,
  type SemanticTransactionResponse,
} from "../api/auditTrace";
import { ApplicationSemanticTransactionDetailPage } from "./ApplicationSemanticTransactionDetailPage";

vi.mock("../api/auditTrace", () => ({
  getSemanticTransaction: vi.fn(),
}));

const mockTransaction: SemanticTransactionResponse = {
  id: "txn-1",
  transaction_type: "ontology.imported",
  resource_type: "OntologyDefinition",
  resource_id: "ont-1",
  application_id: "app-1",
  created_at: "2025-06-01T10:00:00Z",
  trace_steps: [
    {
      id: "step-1",
      semantic_transaction_id: "txn-1",
      step_number: 1,
      step_type: "validate_request",
      message: "Validated ontology import request",
      created_at: "2025-06-01T10:00:01Z",
    },
    {
      id: "step-2",
      semantic_transaction_id: "txn-1",
      step_number: 2,
      step_type: "persist_ontology",
      message: "Stored ontology definition",
      created_at: "2025-06-01T10:00:02Z",
    },
  ],
};

function renderPage(applicationId = "app-1", transactionId = "txn-1") {
  return render(
    <MemoryRouter>
      <ApplicationSemanticTransactionDetailPage
        applicationId={applicationId}
        transactionId={transactionId}
      />
    </MemoryRouter>,
  );
}

describe("ApplicationSemanticTransactionDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getSemanticTransaction).mockReset();
  });

  it("renders loading then transaction detail with trace timeline", async () => {
    vi.mocked(getSemanticTransaction).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockTransaction), 0);
        }),
    );

    renderPage();

    expect(screen.getByText("Loading semantic transaction…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("ontology.imported")).toBeInTheDocument();
    });

    expect(getSemanticTransaction).toHaveBeenCalledWith("txn-1");
    expect(screen.getByText("Validated ontology import request")).toBeInTheDocument();
    expect(screen.getByText("Stored ontology definition")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Back to semantic transactions" })).toHaveAttribute(
      "href",
      "/applications/app-1/semantic-transactions",
    );
  });

  it("renders not-found when transaction belongs to another application", async () => {
    vi.mocked(getSemanticTransaction).mockResolvedValue({
      ...mockTransaction,
      application_id: "other-app",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Semantic transaction not found.")).toBeInTheDocument();
    });
  });

  it("renders not-found on 404", async () => {
    vi.mocked(getSemanticTransaction).mockRejectedValue(new ApiError("Not found", 404));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Semantic transaction not found.")).toBeInTheDocument();
    });
  });

  it("renders error state", async () => {
    vi.mocked(getSemanticTransaction).mockRejectedValue(new ApiError("Server error", 500));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });
});

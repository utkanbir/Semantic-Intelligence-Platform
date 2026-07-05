import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api";
import {
  listSemanticTransactions,
  type SemanticTransactionResponse,
} from "../../api/auditTrace";
import { SemanticTransactionsPage } from "./SemanticTransactionsPage";

vi.mock("../../api/auditTrace", () => ({
  listSemanticTransactions: vi.fn(),
}));

const mockTransaction: SemanticTransactionResponse = {
  id: "txn-1",
  transaction_type: "ontology.imported",
  resource_type: "OntologyDefinition",
  resource_id: "ont-1",
  created_at: "2025-06-01T10:00:00Z",
  trace_steps: [
    {
      id: "step-1",
      semantic_transaction_id: "txn-1",
      step_number: 1,
      step_type: "VALIDATE",
      message: "Validated ontology import",
      created_at: "2025-06-01T10:00:01Z",
    },
  ],
};

describe("SemanticTransactionsPage", () => {
  beforeEach(() => {
    vi.mocked(listSemanticTransactions).mockReset();
  });

  it("loads ontology semantic transactions on mount", async () => {
    vi.mocked(listSemanticTransactions).mockResolvedValue([mockTransaction]);

    render(<SemanticTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText("ontology.imported")).toBeInTheDocument();
    });

    expect(listSemanticTransactions).toHaveBeenCalledWith({});
    expect(
      screen.queryByRole("checkbox", { name: /ontology semantic lineage only/i }),
    ).not.toBeInTheDocument();
  });

  it("applies resource ID as an optional refinement", async () => {
    vi.mocked(listSemanticTransactions).mockResolvedValue([mockTransaction]);

    render(<SemanticTransactionsPage />);

    await waitFor(() => {
      expect(listSemanticTransactions).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Resource ID"), {
      target: { value: "ont-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(listSemanticTransactions).toHaveBeenLastCalledWith({
        resourceId: "ont-1",
      });
    });
  });

  it("renders empty state", async () => {
    vi.mocked(listSemanticTransactions).mockResolvedValue([]);

    render(<SemanticTransactionsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No ontology semantic transactions found yet."),
      ).toBeInTheDocument();
    });
  });

  it("renders error state", async () => {
    vi.mocked(listSemanticTransactions).mockRejectedValue(new ApiError("Server error", 500));

    render(<SemanticTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });
});

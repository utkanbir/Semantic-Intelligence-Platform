import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import {
  listApplicationAuditTraces,
  type SemanticTransactionResponse,
} from "../api/auditTrace";
import { ApplicationAuditTracePage } from "./ApplicationAuditTracePage";

vi.mock("../api/auditTrace", () => ({
  listApplicationAuditTraces: vi.fn(),
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
  ],
};

describe("ApplicationAuditTracePage", () => {
  beforeEach(() => {
    vi.mocked(listApplicationAuditTraces).mockReset();
  });

  it("renders loading then audit traces table", async () => {
    vi.mocked(listApplicationAuditTraces).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockTransaction]), 0);
        }),
    );

    render(<ApplicationAuditTracePage applicationId="app-1" />);

    expect(screen.getByText("Loading audit traces…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("ontology.imported")).toBeInTheDocument();
    });

    expect(listApplicationAuditTraces).toHaveBeenCalledWith("app-1", {
      resourceType: "OntologyDefinition",
      transactionTypePrefix: "ontology",
    });
    expect(screen.getByText("OntologyDefinition")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    vi.mocked(listApplicationAuditTraces).mockResolvedValue([]);

    render(<ApplicationAuditTracePage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No audit traces yet.")).toBeInTheDocument();
    });
  });

  it("renders error state", async () => {
    vi.mocked(listApplicationAuditTraces).mockRejectedValue(new ApiError("Server error", 500));

    render(<ApplicationAuditTracePage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api";
import {
  listAuditTraces,
  type SemanticTransactionResponse,
} from "../../api/auditTrace";
import { AuditTracePage } from "./AuditTracePage";

vi.mock("../../api/auditTrace", () => ({
  listAuditTraces: vi.fn(),
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
    {
      id: "step-2",
      semantic_transaction_id: "txn-1",
      step_number: 2,
      step_type: "PERSIST",
      message: "Saved record",
      created_at: "2025-06-01T10:00:02Z",
    },
  ],
};

describe("AuditTracePage", () => {
  beforeEach(() => {
    vi.mocked(listAuditTraces).mockReset();
  });

  it("loads the latest ontology semantic transactions on mount", async () => {
    vi.mocked(listAuditTraces).mockResolvedValue([mockTransaction]);

    render(<AuditTracePage />);

    await waitFor(() => {
      expect(screen.getByText("ontology.imported")).toBeInTheDocument();
    });

    expect(listAuditTraces).toHaveBeenCalledWith({
      resourceType: "OntologyDefinition",
      transactionTypePrefix: "ontology",
    });
    expect(
      screen.getByLabelText("Refine semantic transactions"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This page focuses on semantic transactions and their trace steps. Not every audit event appears here.",
      ),
    ).toBeInTheDocument();
  });

  it("applies resource ID as an optional refinement", async () => {
    vi.mocked(listAuditTraces).mockResolvedValue([mockTransaction]);

    render(<AuditTracePage />);

    await waitFor(() => {
      expect(listAuditTraces).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Resource ID"), {
      target: { value: "ont-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(listAuditTraces).toHaveBeenLastCalledWith({
        resourceId: "ont-1",
        resourceType: "OntologyDefinition",
        transactionTypePrefix: "ontology",
      });
    });

    expect(screen.getByText("OntologyDefinition")).toBeInTheDocument();
    expect(screen.getByText("ont-1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("clears the resource filter when submitted blank", async () => {
    vi.mocked(listAuditTraces).mockResolvedValue([mockTransaction]);

    render(<AuditTracePage />);

    await waitFor(() => {
      expect(listAuditTraces).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Resource ID"), {
      target: { value: "ont-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(listAuditTraces).toHaveBeenLastCalledWith({
        resourceId: "ont-1",
        resourceType: "OntologyDefinition",
        transactionTypePrefix: "ontology",
      });
    });

    fireEvent.change(screen.getByLabelText("Resource ID"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(listAuditTraces).toHaveBeenLastCalledWith({
        resourceType: "OntologyDefinition",
        transactionTypePrefix: "ontology",
      });
    });
    expect(screen.queryByText("Resource ID is required")).not.toBeInTheDocument();
  });

  it("can switch from ontology-first view to all semantic transactions", async () => {
    vi.mocked(listAuditTraces).mockResolvedValue([mockTransaction]);

    render(<AuditTracePage />);

    await waitFor(() => {
      expect(listAuditTraces).toHaveBeenCalledWith({
        resourceType: "OntologyDefinition",
        transactionTypePrefix: "ontology",
      });
    });

    expect(
      screen.getByRole("heading", { name: "Ontology semantic transactions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Start with the latest ontology-related semantic transactions across the platform, then refine the list with a resource ID when you need a narrower view.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Optional: narrow the current list to a known ontology or related resource ID",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Show ontology activity only" }));

    await waitFor(() => {
      expect(listAuditTraces).toHaveBeenLastCalledWith({});
    });

    expect(screen.getByRole("heading", { name: "Semantic transactions" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Review the latest semantic transactions across the platform, then refine the list with a resource ID when you need a narrower view.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Optional: narrow the current list to a known resource ID"),
    ).toBeInTheDocument();
  });

  it("renders ontology-first empty state", async () => {
    vi.mocked(listAuditTraces).mockResolvedValue([]);

    render(<AuditTracePage />);

    await waitFor(() => {
      expect(
        screen.getByText("No ontology-related semantic transactions found yet."),
      ).toBeInTheDocument();
    });
  });

  it("renders error state", async () => {
    vi.mocked(listAuditTraces).mockRejectedValue(new ApiError("Server error", 500));

    render(<AuditTracePage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });
});

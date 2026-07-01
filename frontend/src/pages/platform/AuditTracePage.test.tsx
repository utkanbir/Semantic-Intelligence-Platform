import { render, screen, waitFor } from "@testing-library/react";
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
  transaction_type: "CREATE",
  resource_type: "Application",
  resource_id: "app-1",
  created_at: "2025-06-01T10:00:00Z",
  trace_steps: [
    {
      id: "step-1",
      semantic_transaction_id: "txn-1",
      step_number: 1,
      step_type: "VALIDATE",
      message: "Validated input",
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

  it("renders loading then audit traces table", async () => {
    vi.mocked(listAuditTraces).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockTransaction]), 0);
        }),
    );

    render(<AuditTracePage />);

    expect(screen.getByText("Loading audit traces…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("CREATE")).toBeInTheDocument();
    });

    expect(listAuditTraces).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(screen.getByText("app-1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    vi.mocked(listAuditTraces).mockResolvedValue([]);

    render(<AuditTracePage />);

    await waitFor(() => {
      expect(screen.getByText("No audit traces yet.")).toBeInTheDocument();
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

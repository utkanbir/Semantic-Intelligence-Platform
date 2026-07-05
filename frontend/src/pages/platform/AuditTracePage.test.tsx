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
  transaction_type: "connector.provisioned",
  resource_type: "TechnologyAdapter",
  resource_id: "adapter-1",
  created_at: "2025-06-01T10:00:00Z",
  trace_steps: [],
};

describe("AuditTracePage", () => {
  beforeEach(() => {
    vi.mocked(listAuditTraces).mockReset();
  });

  it("loads all audit trace records on mount", async () => {
    vi.mocked(listAuditTraces).mockResolvedValue([mockTransaction]);

    render(<AuditTracePage />);

    await waitFor(() => {
      expect(screen.getByText("connector.provisioned")).toBeInTheDocument();
    });

    expect(listAuditTraces).toHaveBeenCalledWith({});
    expect(screen.getByRole("heading", { name: "Audit trace" })).toBeInTheDocument();
  });

  it("applies trace audience and resource filters", async () => {
    vi.mocked(listAuditTraces).mockResolvedValue([mockTransaction]);

    render(<AuditTracePage />);

    await waitFor(() => {
      expect(listAuditTraces).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Trace audience"), {
      target: { value: "operational_audit" },
    });

    await waitFor(() => {
      expect(listAuditTraces).toHaveBeenLastCalledWith({
        traceAudience: "operational_audit",
      });
    });

    fireEvent.change(screen.getByLabelText("Resource ID"), {
      target: { value: "adapter-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(listAuditTraces).toHaveBeenLastCalledWith({
        traceAudience: "operational_audit",
        resourceId: "adapter-1",
      });
    });
  });

  it("renders empty state", async () => {
    vi.mocked(listAuditTraces).mockResolvedValue([]);

    render(<AuditTracePage />);

    await waitFor(() => {
      expect(screen.getByText("No audit trace records found yet.")).toBeInTheDocument();
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

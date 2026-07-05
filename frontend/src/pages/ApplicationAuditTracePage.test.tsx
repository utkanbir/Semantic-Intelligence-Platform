import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
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
  transaction_type: "connector.provisioned",
  resource_type: "TechnologyAdapter",
  resource_id: "adapter-1",
  application_id: "app-1",
  created_at: "2025-06-01T10:00:00Z",
  trace_steps: [],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ApplicationAuditTracePage applicationId="app-1" />
    </MemoryRouter>,
  );
}

describe("ApplicationAuditTracePage", () => {
  beforeEach(() => {
    vi.mocked(listApplicationAuditTraces).mockReset();
  });

  it("renders loading then audit trace table with detail links", async () => {
    vi.mocked(listApplicationAuditTraces).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockTransaction]), 0);
        }),
    );

    renderPage();

    expect(screen.getByText("Loading audit trace records…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("connector.provisioned")).toBeInTheDocument();
    });

    expect(listApplicationAuditTraces).toHaveBeenCalledWith("app-1", {});
    expect(screen.getByRole("link", { name: "connector.provisioned" })).toHaveAttribute(
      "href",
      "/applications/app-1/audit-trace/txn-1",
    );
  });

  it("filters to operational audit when checkbox is checked", async () => {
    vi.mocked(listApplicationAuditTraces).mockResolvedValue([mockTransaction]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("connector.provisioned")).toBeInTheDocument();
    });

    screen.getByRole("checkbox", { name: "Operational audit only" }).click();

    await waitFor(() => {
      expect(listApplicationAuditTraces).toHaveBeenCalledWith("app-1", {
        traceAudience: "operational_audit",
      });
    });
  });

  it("renders empty state", async () => {
    vi.mocked(listApplicationAuditTraces).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No audit trace records yet.")).toBeInTheDocument();
    });
  });

  it("renders error state", async () => {
    vi.mocked(listApplicationAuditTraces).mockRejectedValue(new ApiError("Server error", 500));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });
});

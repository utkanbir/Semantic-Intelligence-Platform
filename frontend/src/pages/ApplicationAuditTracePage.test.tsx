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

  it("renders loading then semantic transactions table with detail links", async () => {
    vi.mocked(listApplicationAuditTraces).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockTransaction]), 0);
        }),
    );

    renderPage();

    expect(screen.getByText("Loading semantic transactions…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("ontology.imported")).toBeInTheDocument();
    });

    expect(listApplicationAuditTraces).toHaveBeenCalledWith("app-1", {});
    expect(screen.getByText("OntologyDefinition")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ontology.imported" })).toHaveAttribute(
      "href",
      "/applications/app-1/audit-trace/txn-1",
    );
  });

  it("filters to ontology transactions when checkbox is checked", async () => {
    vi.mocked(listApplicationAuditTraces).mockResolvedValue([mockTransaction]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("ontology.imported")).toBeInTheDocument();
    });

    expect(listApplicationAuditTraces).toHaveBeenCalledWith("app-1", {});

    const checkbox = screen.getByRole("checkbox", { name: "Ontology transactions only" });
    checkbox.click();

    await waitFor(() => {
      expect(listApplicationAuditTraces).toHaveBeenCalledWith("app-1", {
        resourceType: "OntologyDefinition",
        transactionTypePrefix: "ontology",
      });
    });
  });

  it("renders empty state", async () => {
    vi.mocked(listApplicationAuditTraces).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No semantic transactions yet.")).toBeInTheDocument();
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

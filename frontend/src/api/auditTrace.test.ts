import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAuditTrace,
  getSemanticTransaction,
  listApplicationAuditTraces,
  listAuditTraces,
  listApplicationSemanticTransactions,
  listSemanticTransactions,
  type SemanticTransactionResponse,
} from "./auditTrace";

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
  ],
};

describe("auditTrace API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("listAuditTraces calls GET without filters by default", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([mockTransaction]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(listAuditTraces()).resolves.toEqual([mockTransaction]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/audit-traces",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("listAuditTraces calls GET with supported filters", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([mockTransaction]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      listAuditTraces({
        limit: 25,
        resourceId: "ont-1",
        resourceType: "OntologyDefinition",
        transactionTypePrefix: "ontology",
      }),
    ).resolves.toEqual([mockTransaction]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/audit-traces?limit=25&resource_id=ont-1&resource_type=OntologyDefinition&transaction_type_prefix=ontology",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("listApplicationAuditTraces calls GET with application_id and filters", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([mockTransaction]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      listApplicationAuditTraces("app-1", {
        resourceType: "OntologyDefinition",
        transactionTypePrefix: "ontology",
      }),
    ).resolves.toEqual([mockTransaction]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/audit-traces?application_id=app-1&resource_type=OntologyDefinition&transaction_type_prefix=ontology",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("getAuditTrace calls GET for a single transaction", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockTransaction), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getAuditTrace("txn-1")).resolves.toEqual(mockTransaction);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/audit-traces/txn-1",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("listSemanticTransactions calls GET on semantic-transactions", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([mockTransaction]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      listSemanticTransactions({
        resourceType: "OntologyDefinition",
      }),
    ).resolves.toEqual([mockTransaction]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/semantic-transactions?resource_type=OntologyDefinition",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("listApplicationSemanticTransactions calls GET with application_id", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([mockTransaction]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(listApplicationSemanticTransactions("app-1", {})).resolves.toEqual([
      mockTransaction,
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/semantic-transactions?application_id=app-1",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("getSemanticTransaction calls GET for a semantic lineage transaction", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockTransaction), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getSemanticTransaction("txn-1")).resolves.toEqual(mockTransaction);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/semantic-transactions/txn-1",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });
});

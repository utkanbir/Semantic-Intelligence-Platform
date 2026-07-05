import { apiFetch } from "./client";

export interface TraceStepResponse {
  id: string;
  semantic_transaction_id: string;
  step_number: number;
  step_type: string;
  message: string | null;
  created_at: string;
}

export interface SemanticTransactionResponse {
  id: string;
  transaction_type: string;
  resource_type: string;
  resource_id: string;
  created_at: string;
  trace_steps: TraceStepResponse[];
  application_id?: string | null;
}

export interface AuditTraceListQuery {
  limit?: number;
  resourceId?: string;
  applicationId?: string;
  resourceType?: string;
  transactionTypePrefix?: string;
  traceAudience?: "semantic_lineage" | "operational_audit" | "platform_provisioning";
}

export type ApplicationAuditTraceQuery = Pick<
  AuditTraceListQuery,
  "resourceType" | "transactionTypePrefix" | "traceAudience"
>;

export type SemanticTransactionListQuery = Pick<
  AuditTraceListQuery,
  "limit" | "resourceId" | "applicationId" | "resourceType"
>;

export type ApplicationSemanticTransactionQuery = Pick<
  SemanticTransactionListQuery,
  "resourceType"
>;

function buildAuditTraceParams(query: AuditTraceListQuery = {}): URLSearchParams {
  const params = new URLSearchParams();

  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.resourceId) {
    params.set("resource_id", query.resourceId);
  }
  if (query.applicationId) {
    params.set("application_id", query.applicationId);
  }
  if (query.resourceType) {
    params.set("resource_type", query.resourceType);
  }
  if (query.transactionTypePrefix) {
    params.set("transaction_type_prefix", query.transactionTypePrefix);
  }
  if (query.traceAudience) {
    params.set("trace_audience", query.traceAudience);
  }

  return params;
}

function buildSemanticTransactionParams(
  query: SemanticTransactionListQuery = {},
): URLSearchParams {
  const params = new URLSearchParams();

  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.resourceId) {
    params.set("resource_id", query.resourceId);
  }
  if (query.applicationId) {
    params.set("application_id", query.applicationId);
  }
  if (query.resourceType) {
    params.set("resource_type", query.resourceType);
  }

  return params;
}

export function listAuditTraces(
  query: AuditTraceListQuery = {},
): Promise<SemanticTransactionResponse[]> {
  const params = buildAuditTraceParams(query);
  const search = params.toString();
  return apiFetch<SemanticTransactionResponse[]>(
    `/audit-traces${search ? `?${search}` : ""}`,
  );
}

export function listSemanticTransactions(
  query: SemanticTransactionListQuery = {},
): Promise<SemanticTransactionResponse[]> {
  const params = buildSemanticTransactionParams(query);
  const search = params.toString();
  return apiFetch<SemanticTransactionResponse[]>(
    `/semantic-transactions${search ? `?${search}` : ""}`,
  );
}

export function listApplicationAuditTraces(
  applicationId: string,
  query: ApplicationAuditTraceQuery = {},
): Promise<SemanticTransactionResponse[]> {
  return listAuditTraces({
    applicationId,
    resourceType: query.resourceType,
    transactionTypePrefix: query.transactionTypePrefix,
    traceAudience: query.traceAudience,
  });
}

export function listApplicationSemanticTransactions(
  applicationId: string,
  query: ApplicationSemanticTransactionQuery = {},
): Promise<SemanticTransactionResponse[]> {
  return listSemanticTransactions({
    applicationId,
    resourceType: query.resourceType,
  });
}

export function getAuditTrace(transactionId: string): Promise<SemanticTransactionResponse> {
  return apiFetch<SemanticTransactionResponse>(`/audit-traces/${transactionId}`);
}

export function getSemanticTransaction(
  transactionId: string,
): Promise<SemanticTransactionResponse> {
  return apiFetch<SemanticTransactionResponse>(`/semantic-transactions/${transactionId}`);
}

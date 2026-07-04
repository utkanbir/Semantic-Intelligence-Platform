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
}

export type ApplicationAuditTraceQuery = Pick<
  AuditTraceListQuery,
  "resourceType" | "transactionTypePrefix"
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

export function listApplicationAuditTraces(
  applicationId: string,
  query: ApplicationAuditTraceQuery = {},
): Promise<SemanticTransactionResponse[]> {
  return listAuditTraces({
    applicationId,
    resourceType: query.resourceType,
    transactionTypePrefix: query.transactionTypePrefix,
  });
}

export function getAuditTrace(transactionId: string): Promise<SemanticTransactionResponse> {
  return apiFetch<SemanticTransactionResponse>(`/audit-traces/${transactionId}`);
}

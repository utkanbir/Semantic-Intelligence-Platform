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

export interface ApplicationAuditTraceQuery {
  resourceType?: string;
  transactionTypePrefix?: string;
}

export function listAuditTraces(resourceId: string): Promise<SemanticTransactionResponse[]> {
  const params = new URLSearchParams({ resource_id: resourceId });
  return apiFetch<SemanticTransactionResponse[]>(`/audit-traces?${params}`);
}

export function listApplicationAuditTraces(
  applicationId: string,
  query: ApplicationAuditTraceQuery = {},
): Promise<SemanticTransactionResponse[]> {
  const params = new URLSearchParams({ application_id: applicationId });
  if (query.resourceType) {
    params.set("resource_type", query.resourceType);
  }
  if (query.transactionTypePrefix) {
    params.set("transaction_type_prefix", query.transactionTypePrefix);
  }
  return apiFetch<SemanticTransactionResponse[]>(`/audit-traces?${params}`);
}

export function getAuditTrace(transactionId: string): Promise<SemanticTransactionResponse> {
  return apiFetch<SemanticTransactionResponse>(`/audit-traces/${transactionId}`);
}

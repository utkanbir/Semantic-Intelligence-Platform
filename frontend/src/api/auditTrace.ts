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
}

export function listAuditTraces(): Promise<SemanticTransactionResponse[]> {
  return apiFetch<SemanticTransactionResponse[]>("/audit-traces");
}

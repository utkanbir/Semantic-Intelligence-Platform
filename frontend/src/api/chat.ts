import { apiFetch } from "./client";

export interface OntologyChatRequest {
  ontology_id: string;
  question: string;
  initiated_by?: string;
}

export interface OntologyChatResponse {
  semantic_transaction_id: string;
  status: string;
  answer: string;
  trace_step_count: number;
}

export function askOntologyQuestion(
  payload: OntologyChatRequest,
): Promise<OntologyChatResponse> {
  return apiFetch<OntologyChatResponse>("/chat/ontology", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

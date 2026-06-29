import { apiFetch } from "./client";

export interface HealthResponse {
  status: string;
  service: string;
  environment: string;
  database?: string;
}

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}

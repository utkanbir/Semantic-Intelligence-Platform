import type {
  ApplicationResponse,
  ApplicationStatus,
  ApplicationWorkspaceResponse,
} from "../../api/applications";

export type HomeStatusTone = "active" | "draft" | "retired";

export interface HomeStatusBadge {
  label: string;
  tone: HomeStatusTone;
}

function parseTimestamp(iso: string | null): number {
  if (!iso) {
    return 0;
  }
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

export function sortApplicationsByRecent(
  applications: ApplicationResponse[],
): ApplicationResponse[] {
  return [...applications].sort(
    (left, right) =>
      parseTimestamp(right.updated_at ?? right.created_at) -
      parseTimestamp(left.updated_at ?? left.created_at),
  );
}

export function formatWorkspaceStack(
  workspace: ApplicationWorkspaceResponse,
): string {
  const parts: string[] = [];

  if (workspace.fuseki_dataset) {
    parts.push("Fuseki");
  }
  if (workspace.postgres_schema) {
    parts.push("PostgreSQL");
  }
  if (workspace.qdrant_collection) {
    parts.push("Qdrant");
  }
  if (workspace.minio_namespace) {
    parts.push("MinIO");
  }

  return parts.length > 0 ? parts.join(" / ") : "Altyapı yapılandırması";
}

function isRunningStatus(status: ApplicationStatus): boolean {
  return status === "active" || status === "provisioned" || status === "evolving";
}

export function sandboxStatusBadge(status: ApplicationStatus): HomeStatusBadge {
  if (status === "retired") {
    return { label: "Arşiv", tone: "retired" };
  }
  if (isRunningStatus(status)) {
    return { label: "Aktif", tone: "active" };
  }
  return { label: "Taslak", tone: "draft" };
}

export function applicationStatusBadge(status: ApplicationStatus): HomeStatusBadge {
  if (status === "retired") {
    return { label: "Arşiv", tone: "retired" };
  }
  if (isRunningStatus(status)) {
    return { label: "Çalışıyor", tone: "active" };
  }
  return { label: "Taslak", tone: "draft" };
}

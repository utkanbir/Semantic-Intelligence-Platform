import { describe, expect, it } from "vitest";
import {
  applicationStatusBadge,
  formatWorkspaceStack,
  sandboxStatusBadge,
  sortApplicationsByRecent,
} from "./homeUtils";

describe("homeUtils", () => {
  it("maps sandbox and application status badges per mockup labels", () => {
    expect(sandboxStatusBadge("active")).toEqual({ label: "Aktif", tone: "active" });
    expect(applicationStatusBadge("active")).toEqual({ label: "Çalışıyor", tone: "active" });
    expect(sandboxStatusBadge("created")).toEqual({ label: "Taslak", tone: "draft" });
  });

  it("formats workspace stack labels for sandbox subtitles", () => {
    expect(
      formatWorkspaceStack({
        id: "ws-1",
        application_id: "app-1",
        status: "active",
        postgres_schema: "app_demo",
        minio_namespace: "demo",
        fuseki_dataset: "demo",
        qdrant_collection: "demo",
        metadata_domain: "demo",
        ontology_namespace: "http://example.org/demo",
        agent_namespace: "http://example.org/demo/agents",
        product_registry_namespace: "http://example.org/demo/products",
        agent_registry_namespace: "http://example.org/demo/agent-registry",
        created_at: null,
        updated_at: null,
      }),
    ).toBe("Fuseki / PostgreSQL / Qdrant / MinIO");
  });

  it("sorts applications by most recently updated", () => {
    const sorted = sortApplicationsByRecent([
      {
        id: "older",
        key: "older",
        name: "Older",
        status: "created",
        description: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
        workspace: {} as never,
      },
      {
        id: "newer",
        key: "newer",
        name: "Newer",
        status: "active",
        description: null,
        created_at: "2026-02-01T00:00:00Z",
        updated_at: "2026-02-02T00:00:00Z",
        workspace: {} as never,
      },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["newer", "older"]);
  });
});

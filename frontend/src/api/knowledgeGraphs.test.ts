import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createKnowledgeGraph,
  getKnowledgeGraph,
  listKnowledgeGraphs,
  type KnowledgeGraphRegistryResponse,
} from "./knowledgeGraphs";

const mockRegistry: KnowledgeGraphRegistryResponse = {
  id: "kg-1",
  application_id: "app-1",
  status: "Populated",
  title: "Customer Knowledge Graph",
  description: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  populated_at: "2025-06-02T10:00:00Z",
  graph_updated_at: null,
  archived_at: null,
  graph_metadata: {},
  bound_ontology_ids: ["onto-1"],
};

describe("knowledgeGraphs API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("listKnowledgeGraphs calls GET with application_id", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([mockRegistry]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(listKnowledgeGraphs("app-1")).resolves.toEqual([mockRegistry]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/knowledge-graphs?application_id=app-1",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("listKnowledgeGraphs passes optional graph_status filter", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await listKnowledgeGraphs("app-1", "Created");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/knowledge-graphs?application_id=app-1&graph_status=Created",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("getKnowledgeGraph calls GET for a single registry", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockRegistry), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getKnowledgeGraph("kg-1")).resolves.toEqual(mockRegistry);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/knowledge-graphs/kg-1",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("createKnowledgeGraph calls POST with payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockRegistry), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const payload = {
      application_id: "app-1",
      title: "Customer Knowledge Graph",
      bound_ontology_ids: ["onto-1"],
      created_by: "alice@example.com",
    };

    await expect(createKnowledgeGraph(payload)).resolves.toEqual(mockRegistry);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/knowledge-graphs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
        headers: expect.any(Headers),
      }),
    );
  });
});

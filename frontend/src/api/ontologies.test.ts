import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOntology,
  getOntology,
  listOntologies,
  type OntologyDefinitionResponse,
} from "./ontologies";

const mockOntology: OntologyDefinitionResponse = {
  id: "onto-1",
  application_id: "app-1",
  version_number: 1,
  previous_version_id: null,
  status: "Published",
  title: "Customer Ontology",
  description: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  validated_at: "2025-06-02T10:00:00Z",
  approved_at: "2025-06-03T10:00:00Z",
  published_at: "2025-06-04T10:00:00Z",
  version_created_at: null,
  ontology_definition: {},
};

describe("ontologies API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("listOntologies calls GET with application_id", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([mockOntology]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(listOntologies("app-1")).resolves.toEqual([mockOntology]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ontologies?application_id=app-1",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("listOntologies passes optional ontology_status filter", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await listOntologies("app-1", "Draft");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ontologies?application_id=app-1&ontology_status=Draft",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("getOntology calls GET for a single definition", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockOntology), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getOntology("onto-1")).resolves.toEqual(mockOntology);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ontologies/onto-1",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("createOntology calls POST with payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockOntology), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const payload = {
      application_id: "app-1",
      title: "Customer Ontology",
      ontology_definition: { classes: [] },
      created_by: "alice@example.com",
    };

    await expect(createOntology(payload)).resolves.toEqual(mockOntology);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ontologies",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
        headers: expect.any(Headers),
      }),
    );
  });
});

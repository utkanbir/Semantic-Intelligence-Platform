import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOntology,
  getNextOntologyStatuses,
  getOntology,
  getOntologyStatusActionLabel,
  importOntology,
  listOntologies,
  materializeOntology,
  updateOntologyStatus,
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

  it("importOntology calls POST with import payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockOntology), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const payload = {
      application_id: "app-1",
      title: "Imported Ontology",
      connector_id: "connector-1",
      source_format: "ttl",
      source_content: "@prefix ex: <https://example.com/> .",
      created_by: "alice@example.com",
    };

    await expect(importOntology(payload)).resolves.toEqual(mockOntology);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ontologies/import",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
        headers: expect.any(Headers),
      }),
    );
  });

  it("generateOntology calls POST with generate payload", async () => {
    const generateResponse = {
      ontology: mockOntology,
      extraction: {
        available: true,
        extracted_at: "2025-06-01T10:00:00Z",
        extraction_id: "ext-1",
        model: "stub-model",
        summary: "Extracted 1 class",
        classes: [],
        properties: [],
        relationships: [],
        sources: [],
      },
      semantic_transaction_id: "txn-generate-1",
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(generateResponse), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { generateOntology } = await import("./ontologies");
    const payload = {
      application_id: "app-1",
      title: "Generated Ontology",
      sources: [{ kind: "paste" as const, content: "vendors supply goods", name: "notes" }],
      created_by: "alice@example.com",
    };

    await expect(generateOntology(payload)).resolves.toEqual(generateResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ontologies/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
        headers: expect.any(Headers),
      }),
    );
  });

  it("materializeOntology calls POST for ontology materialization", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockOntology), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(materializeOntology("onto-1")).resolves.toEqual(mockOntology);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ontologies/onto-1/materialize",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
        headers: expect.any(Headers),
      }),
    );
  });

  it("getNextOntologyStatuses matches backend transitions", () => {
    expect(getNextOntologyStatuses("Draft")).toEqual(["Validated"]);
    expect(getNextOntologyStatuses("Validated")).toEqual(["Approved", "Draft"]);
    expect(getNextOntologyStatuses("Approved")).toEqual([]);
    expect(getNextOntologyStatuses("Published")).toEqual([]);
  });

  it("normalizeOntologyLifecycleStatus maps legacy states to Approved", async () => {
    const { normalizeOntologyLifecycleStatus } = await import("./ontologies");
    expect(normalizeOntologyLifecycleStatus("Published")).toBe("Approved");
    expect(normalizeOntologyLifecycleStatus("Draft")).toBe("Draft");
  });

  it("getOntologyStatusActionLabel returns action labels", () => {
    expect(getOntologyStatusActionLabel("Validated")).toBe("Validate");
    expect(getOntologyStatusActionLabel("Approved")).toBe("Approve");
    expect(getOntologyStatusActionLabel("Draft")).toBe("Revert to Draft");
    expect(getOntologyStatusActionLabel("Published")).toBe("Publish");
    expect(getOntologyStatusActionLabel("Versioned")).toBe("Version");
    expect(getOntologyStatusActionLabel("Retired")).toBe("Retire");
  });

  it("updateOntology calls PATCH with payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockOntology), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const payload = {
      title: "Updated Ontology",
      ontology_definition: { classes: [{ name: "Vendor" }] },
    };

    const { updateOntology } = await import("./ontologies");
    await expect(updateOntology("onto-1", payload)).resolves.toEqual(mockOntology);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ontologies/onto-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(payload),
        headers: expect.any(Headers),
      }),
    );
  });

  it("updateOntologyStatus calls PATCH with status body", async () => {
    const updated = { ...mockOntology, status: "Versioned" as const };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(updateOntologyStatus("onto-1", "Versioned")).resolves.toEqual(updated);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/ontologies/onto-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "Versioned" }),
        headers: expect.any(Headers),
      }),
    );
  });
});

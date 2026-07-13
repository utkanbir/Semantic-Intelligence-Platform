import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askOntologyQuestion, type OntologyChatResponse } from "./chat";

const mockResponse: OntologyChatResponse = {
  semantic_transaction_id: "txn-chat-1",
  status: "Completed",
  answer: "Invoice is a billing document.",
  trace_step_count: 6,
};

describe("chat API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("askOntologyQuestion calls POST /chat/ontology", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      askOntologyQuestion({
        ontology_id: "onto-1",
        question: "What is Invoice?",
      }),
    ).resolves.toEqual(mockResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/chat/ontology",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: JSON.stringify({
          ontology_id: "onto-1",
          question: "What is Invoice?",
        }),
      }),
    );
  });

  it("askOntologyQuestion includes initiated_by when provided", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await askOntologyQuestion({
      ontology_id: "onto-1",
      question: "What is Invoice?",
      initiated_by: "alice@example.com",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/chat/ontology",
      expect.objectContaining({
        body: JSON.stringify({
          ontology_id: "onto-1",
          question: "What is Invoice?",
          initiated_by: "alice@example.com",
        }),
      }),
    );
  });
});

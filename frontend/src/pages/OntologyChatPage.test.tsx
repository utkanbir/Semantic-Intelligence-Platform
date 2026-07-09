import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSemanticTransaction } from "../api/auditTrace";
import { askOntologyQuestion } from "../api/chat";
import { listOntologies } from "../api/ontologies";
import { OntologyChatPage } from "./OntologyChatPage";

vi.mock("../api/ontologies", () => ({
  listOntologies: vi.fn(),
}));

vi.mock("../api/chat", () => ({
  askOntologyQuestion: vi.fn(),
}));

vi.mock("../api/auditTrace", () => ({
  getSemanticTransaction: vi.fn(),
}));

const mockOntology = {
  id: "onto-1",
  application_id: "app-1",
  version_number: 2,
  previous_version_id: null,
  status: "Approved" as const,
  title: "Invoice Ontology",
  description: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  validated_at: null,
  approved_at: null,
  published_at: null,
  version_created_at: null,
  ontology_definition: {},
};

const mockTransaction = {
  id: "txn-chat-1",
  transaction_type: "ontology.chat",
  resource_type: "OntologyDefinition",
  resource_id: "onto-1",
  application_id: "app-1",
  created_at: "2025-06-01T10:00:00Z",
  status: "Completed",
  initiated_by: "alice@example.com",
  participating_assets: {
    ontology_id: "onto-1",
    ontology_title: "Invoice Ontology",
    llm_provider: "stub",
  },
  trace_steps: [
    {
      id: "step-1",
      semantic_transaction_id: "txn-chat-1",
      step_number: 1,
      step_type: "QuestionReceived",
      message: "User question received",
      created_at: "2025-06-01T10:00:01Z",
      layer: "Experience",
      status: "Completed",
      input_summary: "question=What is Invoice?",
      output_summary: "accepted",
      duration_ms: 12,
    },
  ],
};

describe("OntologyChatPage", () => {
  beforeEach(() => {
    vi.mocked(listOntologies).mockReset();
    vi.mocked(askOntologyQuestion).mockReset();
    vi.mocked(getSemanticTransaction).mockReset();
    vi.mocked(listOntologies).mockResolvedValue([mockOntology]);
  });

  it("renders loading then chat form with ontology selector", async () => {
    render(
      <MemoryRouter>
        <OntologyChatPage applicationId="app-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading ontologies…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText("Ontology")).toBeInTheDocument();
    });

    expect(listOntologies).toHaveBeenCalledWith("app-1");
    expect(screen.getByRole("heading", { name: "Ontology chat" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Definitions" })).toHaveAttribute(
      "href",
      "/applications/app-1/ontology",
    );
    expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute(
      "href",
      "/applications/app-1/ontology/chat",
    );
    expect(screen.getByLabelText("Ontology")).toHaveValue("onto-1");
  });

  it("submits a question and renders answer with trace panel", async () => {
    vi.mocked(askOntologyQuestion).mockResolvedValue({
      semantic_transaction_id: "txn-chat-1",
      status: "Completed",
      answer: "Invoice is a billing document.",
      trace_step_count: 1,
    });
    vi.mocked(getSemanticTransaction).mockResolvedValue(mockTransaction);

    render(
      <MemoryRouter>
        <OntologyChatPage applicationId="app-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Question")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "What is Invoice?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask question" }));

    await waitFor(() => {
      expect(screen.getByText("Invoice is a billing document.")).toBeInTheDocument();
    });

    expect(askOntologyQuestion).toHaveBeenCalledWith({
      ontology_id: "onto-1",
      question: "What is Invoice?",
    });
    expect(getSemanticTransaction).toHaveBeenCalledWith("txn-chat-1");
    expect(screen.getByText("What is Invoice?")).toBeInTheDocument();
    expect(screen.getByText("txn-chat-1")).toBeInTheDocument();
    expect(screen.getByText("Invoice Ontology")).toBeInTheDocument();
    expect(screen.getByText("stub")).toBeInTheDocument();
    expect(screen.getByText("Experience")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "txn-chat-1" })).toHaveAttribute(
      "href",
      "/applications/app-1/semantic-transactions/txn-chat-1",
    );
  });

  it("shows validation error when question is empty", async () => {
    render(
      <MemoryRouter>
        <OntologyChatPage applicationId="app-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Ask question" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Ask question" }));

    expect(await screen.findByText("Question is required")).toBeInTheDocument();
    expect(askOntologyQuestion).not.toHaveBeenCalled();
  });
});

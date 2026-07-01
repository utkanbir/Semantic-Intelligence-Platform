import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listKnowledgeGraphs,
  type KnowledgeGraphRegistryResponse,
} from "../api/knowledgeGraphs";
import { KnowledgeGraphsPage } from "./KnowledgeGraphsPage";

vi.mock("../api/knowledgeGraphs", () => ({
  listKnowledgeGraphs: vi.fn(),
  getKnowledgeGraph: vi.fn(),
}));

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

describe("KnowledgeGraphsPage", () => {
  beforeEach(() => {
    vi.mocked(listKnowledgeGraphs).mockReset();
  });

  it("renders loading then knowledge graphs table", async () => {
    vi.mocked(listKnowledgeGraphs).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockRegistry]), 0);
        }),
    );

    render(<KnowledgeGraphsPage applicationId="app-1" />);

    expect(screen.getByText("Loading knowledge graphs…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Customer Knowledge Graph")).toBeInTheDocument();
    });

    expect(listKnowledgeGraphs).toHaveBeenCalledWith("app-1");
    expect(screen.getByText("Populated")).toBeInTheDocument();
  });

  it("renders empty state when no registries", async () => {
    vi.mocked(listKnowledgeGraphs).mockResolvedValue([]);

    render(<KnowledgeGraphsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No knowledge graph registries yet.")).toBeInTheDocument();
    });
  });

  it("renders error state on API failure", async () => {
    vi.mocked(listKnowledgeGraphs).mockRejectedValue(new Error("Network error"));

    render(<KnowledgeGraphsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import {
  createKnowledgeGraph,
  listKnowledgeGraphs,
  updateKnowledgeGraphStatus,
  type KnowledgeGraphRegistryResponse,
} from "../api/knowledgeGraphs";
import { listOntologies, type OntologyDefinitionResponse } from "../api/ontologies";
import { KnowledgeGraphsPage } from "./KnowledgeGraphsPage";

vi.mock("../api/knowledgeGraphs", () => ({
  listKnowledgeGraphs: vi.fn(),
  getKnowledgeGraph: vi.fn(),
  createKnowledgeGraph: vi.fn(),
  updateKnowledgeGraphStatus: vi.fn(),
  getNextKnowledgeGraphStatuses: vi.fn((status: string) => {
    const map: Record<string, string[]> = {
      Created: ["Populated"],
      Populated: ["Updated", "Archived"],
      Updated: ["Archived"],
      Archived: [],
    };
    return map[status] ?? [];
  }),
  getKnowledgeGraphStatusActionLabel: vi.fn((status: string) => {
    const labels: Record<string, string> = {
      Populated: "Populate",
      Updated: "Update",
      Archived: "Archive",
    };
    return labels[status] ?? status;
  }),
}));

vi.mock("../api/ontologies", () => ({
  listOntologies: vi.fn(),
  getOntology: vi.fn(),
}));

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
  validated_at: null,
  approved_at: null,
  published_at: "2025-06-04T10:00:00Z",
  version_created_at: null,
  ontology_definition: {},
};

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

const newRegistry: KnowledgeGraphRegistryResponse = {
  ...mockRegistry,
  id: "kg-2",
  title: "New Knowledge Graph",
  status: "Created",
  populated_at: null,
  bound_ontology_ids: [],
};

const createdRegistry: KnowledgeGraphRegistryResponse = {
  ...mockRegistry,
  id: "kg-created",
  status: "Created",
  populated_at: null,
};

const populatedRegistry: KnowledgeGraphRegistryResponse = {
  ...createdRegistry,
  status: "Populated",
  populated_at: "2025-06-02T10:00:00Z",
};

describe("KnowledgeGraphsPage", () => {
  beforeEach(() => {
    vi.mocked(listKnowledgeGraphs).mockReset();
    vi.mocked(listOntologies).mockReset();
    vi.mocked(createKnowledgeGraph).mockReset();
    vi.mocked(updateKnowledgeGraphStatus).mockReset();
    vi.mocked(listOntologies).mockResolvedValue([mockOntology]);
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
    expect(listOntologies).toHaveBeenCalledWith("app-1");
    expect(screen.getByText("Populated")).toBeInTheDocument();
  });

  it("renders empty state with create form", async () => {
    vi.mocked(listKnowledgeGraphs).mockResolvedValue([]);

    render(<KnowledgeGraphsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No knowledge graph registries yet.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Create knowledge graph")).toBeInTheDocument();
  });

  it("creates knowledge graph from empty state and refreshes list", async () => {
    vi.mocked(listKnowledgeGraphs)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newRegistry]);
    vi.mocked(createKnowledgeGraph).mockResolvedValue(newRegistry);

    render(<KnowledgeGraphsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create knowledge graph")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "New Knowledge Graph" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create knowledge graph" }));

    await waitFor(() => {
      expect(createKnowledgeGraph).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "New Knowledge Graph",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("New Knowledge Graph")).toBeInTheDocument();
    });
  });

  it("submits optional bound ontology ids", async () => {
    vi.mocked(listKnowledgeGraphs)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...newRegistry, bound_ontology_ids: ["onto-1"] }]);
    vi.mocked(createKnowledgeGraph).mockResolvedValue({
      ...newRegistry,
      bound_ontology_ids: ["onto-1"],
    });

    render(<KnowledgeGraphsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create knowledge graph")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Bound KG" },
    });
    fireEvent.click(screen.getByLabelText(/Customer Ontology/));
    fireEvent.click(screen.getByRole("button", { name: "Create knowledge graph" }));

    await waitFor(() => {
      expect(createKnowledgeGraph).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "Bound KG",
        bound_ontology_ids: ["onto-1"],
      });
    });
  });

  it("shows New knowledge graph panel when list has items", async () => {
    vi.mocked(listKnowledgeGraphs).mockResolvedValue([mockRegistry]);

    render(<KnowledgeGraphsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("Customer Knowledge Graph")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New knowledge graph" }));
    expect(screen.getByRole("heading", { name: "New knowledge graph" })).toBeInTheDocument();
  });

  it("shows title validation error when title is empty", async () => {
    vi.mocked(listKnowledgeGraphs).mockResolvedValue([]);

    render(<KnowledgeGraphsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create knowledge graph")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create knowledge graph" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Title is required");
    });

    expect(createKnowledgeGraph).not.toHaveBeenCalled();
  });

  it("populates created registry via lifecycle action", async () => {
    vi.mocked(listKnowledgeGraphs)
      .mockResolvedValueOnce([createdRegistry])
      .mockResolvedValueOnce([populatedRegistry]);
    vi.mocked(updateKnowledgeGraphStatus).mockResolvedValue(populatedRegistry);

    render(<KnowledgeGraphsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Populate" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Populate" }));

    await waitFor(() => {
      expect(updateKnowledgeGraphStatus).toHaveBeenCalledWith("kg-created", "Populated");
    });

    await waitFor(() => {
      expect(screen.getByText("Populated")).toBeInTheDocument();
    });
  });

  it("shows ApiError message when status update fails", async () => {
    vi.mocked(listKnowledgeGraphs).mockResolvedValue([createdRegistry]);
    vi.mocked(updateKnowledgeGraphStatus).mockRejectedValue(
      new ApiError("Invalid status transition", 422),
    );

    render(<KnowledgeGraphsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Populate" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Populate" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid status transition");
    });
  });

  it("shows ApiError message on create failure", async () => {
    vi.mocked(listKnowledgeGraphs).mockResolvedValue([]);
    vi.mocked(createKnowledgeGraph).mockRejectedValue(new ApiError("Duplicate title", 409));

    render(<KnowledgeGraphsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create knowledge graph")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fail KG" } });
    fireEvent.click(screen.getByRole("button", { name: "Create knowledge graph" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Duplicate title");
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

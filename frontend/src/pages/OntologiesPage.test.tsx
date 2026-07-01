import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import {
  createOntology,
  listOntologies,
  type OntologyDefinitionResponse,
} from "../api/ontologies";
import { OntologiesPage } from "./OntologiesPage";

vi.mock("../api/ontologies", () => ({
  listOntologies: vi.fn(),
  getOntology: vi.fn(),
  createOntology: vi.fn(),
}));

const mockOntology: OntologyDefinitionResponse = {
  id: "onto-1",
  application_id: "app-1",
  version_number: 2,
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

const newOntology: OntologyDefinitionResponse = {
  ...mockOntology,
  id: "onto-2",
  title: "New Ontology",
  status: "Draft",
  version_number: 1,
  published_at: null,
  validated_at: null,
  approved_at: null,
};

describe("OntologiesPage", () => {
  beforeEach(() => {
    vi.mocked(listOntologies).mockReset();
    vi.mocked(createOntology).mockReset();
  });

  it("renders loading then ontologies table", async () => {
    vi.mocked(listOntologies).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockOntology]), 0);
        }),
    );

    render(<OntologiesPage applicationId="app-1" />);

    expect(screen.getByText("Loading ontologies…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Customer Ontology")).toBeInTheDocument();
    });

    expect(listOntologies).toHaveBeenCalledWith("app-1");
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders empty state with create form", async () => {
    vi.mocked(listOntologies).mockResolvedValue([]);

    render(<OntologiesPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No ontology definitions yet.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Create ontology")).toBeInTheDocument();
  });

  it("creates ontology from empty state and refreshes list", async () => {
    vi.mocked(listOntologies)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newOntology]);
    vi.mocked(createOntology).mockResolvedValue(newOntology);

    render(<OntologiesPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create ontology")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New Ontology" } });
    fireEvent.click(screen.getByRole("button", { name: "Create ontology" }));

    await waitFor(() => {
      expect(createOntology).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "New Ontology",
        ontology_definition: {},
      });
    });

    await waitFor(() => {
      expect(screen.getByText("New Ontology")).toBeInTheDocument();
    });
  });

  it("shows New ontology panel when list has items", async () => {
    vi.mocked(listOntologies).mockResolvedValue([mockOntology]);

    render(<OntologiesPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("Customer Ontology")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New ontology" }));
    expect(screen.getByRole("heading", { name: "New ontology" })).toBeInTheDocument();
  });

  it("shows title validation error when title is empty", async () => {
    vi.mocked(listOntologies).mockResolvedValue([]);

    render(<OntologiesPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create ontology")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create ontology" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Title is required");
    });

    expect(createOntology).not.toHaveBeenCalled();
  });

  it("shows JSON validation error for invalid ontology definition", async () => {
    vi.mocked(listOntologies).mockResolvedValue([]);

    render(<OntologiesPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create ontology")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Bad JSON" } });
    fireEvent.change(screen.getByLabelText(/Ontology definition/), {
      target: { value: "not-json" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create ontology" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Ontology definition must be valid JSON",
      );
    });

    expect(createOntology).not.toHaveBeenCalled();
  });

  it("submits parsed ontology definition JSON", async () => {
    vi.mocked(listOntologies)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newOntology]);
    vi.mocked(createOntology).mockResolvedValue(newOntology);

    render(<OntologiesPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create ontology")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New Ontology" } });
    fireEvent.change(screen.getByLabelText(/Ontology definition/), {
      target: { value: '{"classes": ["Person"]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create ontology" }));

    await waitFor(() => {
      expect(createOntology).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "New Ontology",
        ontology_definition: { classes: ["Person"] },
      });
    });
  });

  it("shows ApiError message on create failure", async () => {
    vi.mocked(listOntologies).mockResolvedValue([]);
    vi.mocked(createOntology).mockRejectedValue(new ApiError("Duplicate title", 409));

    render(<OntologiesPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create ontology")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fail Ontology" } });
    fireEvent.click(screen.getByRole("button", { name: "Create ontology" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Duplicate title");
    });
  });

  it("renders error state on API failure", async () => {
    vi.mocked(listOntologies).mockRejectedValue(new Error("Network error"));

    render(<OntologiesPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });
});

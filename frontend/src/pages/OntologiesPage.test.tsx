import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listOntologies, type OntologyDefinitionResponse } from "../api/ontologies";
import { OntologiesPage } from "./OntologiesPage";

vi.mock("../api/ontologies", () => ({
  listOntologies: vi.fn(),
  getOntology: vi.fn(),
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

describe("OntologiesPage", () => {
  beforeEach(() => {
    vi.mocked(listOntologies).mockReset();
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

  it("renders empty state when no ontologies", async () => {
    vi.mocked(listOntologies).mockResolvedValue([]);

    render(<OntologiesPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No ontology definitions yet.")).toBeInTheDocument();
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

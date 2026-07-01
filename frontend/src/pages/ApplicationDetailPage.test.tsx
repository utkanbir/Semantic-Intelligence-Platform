import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getApplication,
  type ApplicationResponse,
} from "../api/applications";
import { listAgents } from "../api/agents";
import { listAgentRuns } from "../api/agentRuns";
import { listAuditTraces } from "../api/auditTrace";
import { listBlueprints } from "../api/blueprints";
import { listDiscoverySessions } from "../api/discovery";
import { listKnowledgeGraphs } from "../api/knowledgeGraphs";
import { listOntologies } from "../api/ontologies";
import { listProducts } from "../api/products";
import { ApplicationDetailPage } from "./ApplicationDetailPage";

vi.mock("../api/applications", () => ({
  getApplication: vi.fn(),
}));

vi.mock("../api/discovery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/discovery")>();
  return {
    ...actual,
    listDiscoverySessions: vi.fn(),
    createDiscoverySession: vi.fn(),
    updateDiscoverySessionStatus: vi.fn(),
  };
});

vi.mock("../api/blueprints", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/blueprints")>();
  return {
    ...actual,
    listBlueprints: vi.fn(),
    createBlueprint: vi.fn(),
    updateBlueprintStatus: vi.fn(),
  };
});

vi.mock("../api/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/products")>();
  return {
    ...actual,
    listProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProductStatus: vi.fn(),
  };
});

vi.mock("../api/agents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/agents")>();
  return {
    ...actual,
    listAgents: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    updateAgentStatus: vi.fn(),
  };
});

vi.mock("../api/agentRuns", () => ({
  listAgentRuns: vi.fn(),
}));

vi.mock("../api/auditTrace", () => ({
  listAuditTraces: vi.fn(),
}));

vi.mock("../api/ontologies", () => ({
  listOntologies: vi.fn(),
  getOntology: vi.fn(),
}));

vi.mock("../api/knowledgeGraphs", () => ({
  listKnowledgeGraphs: vi.fn(),
  getKnowledgeGraph: vi.fn(),
}));

const mockApplication: ApplicationResponse = {
  id: "app-1",
  key: "demo",
  name: "Demo App",
  status: "active",
  description: null,
  created_at: "2025-06-01T10:00:00Z",
  updated_at: null,
  workspace: {
    id: "ws-1",
    application_id: "app-1",
    status: "active",
    postgres_schema: "app_demo",
    minio_namespace: "app-demo",
    fuseki_dataset: "app-demo",
    qdrant_collection: "app-demo",
    metadata_domain: "app-demo",
    ontology_namespace: "app-demo",
    agent_namespace: "app-demo",
    product_registry_namespace: "app-demo",
    agent_registry_namespace: "app-demo",
    created_at: "2025-06-01T10:00:00Z",
    updated_at: null,
  },
};

function renderDetailPage(initialEntry = "/applications/app-1") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/applications" element={<div>Applications list</div>} />
        <Route
          path="/applications/:applicationId/*"
          element={<ApplicationDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ApplicationDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getApplication).mockReset();
    vi.mocked(getApplication).mockResolvedValue(mockApplication);
    vi.mocked(listDiscoverySessions).mockReset();
    vi.mocked(listDiscoverySessions).mockResolvedValue([]);
    vi.mocked(listBlueprints).mockReset();
    vi.mocked(listBlueprints).mockResolvedValue([]);
    vi.mocked(listProducts).mockReset();
    vi.mocked(listProducts).mockResolvedValue([]);
    vi.mocked(listAgents).mockReset();
    vi.mocked(listAgents).mockResolvedValue([]);
    vi.mocked(listAgentRuns).mockReset();
    vi.mocked(listAgentRuns).mockResolvedValue([]);
    vi.mocked(listAuditTraces).mockReset();
    vi.mocked(listAuditTraces).mockResolvedValue([]);
    vi.mocked(listOntologies).mockReset();
    vi.mocked(listOntologies).mockResolvedValue([]);
    vi.mocked(listKnowledgeGraphs).mockReset();
    vi.mocked(listKnowledgeGraphs).mockResolvedValue([]);
  });

  it("loads application and shows overview by default", async () => {
    renderDetailPage();

    expect(screen.getByText("Loading application…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    expect(getApplication).toHaveBeenCalledWith("app-1");
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("Workspace namespaces")).toBeInTheDocument();
    expect(screen.getByText("app_demo")).toBeInTheDocument();
    expect(screen.getAllByText("app-demo").length).toBeGreaterThan(0);
  });

  it("navigates to discovery sessions list", async () => {
    vi.mocked(listDiscoverySessions).mockResolvedValue([
      {
        id: "session-1",
        application_id: "app-1",
        status: "Active",
        title: "Session A",
        started_by: "bob@example.com",
        started_at: "2025-06-01T10:00:00Z",
        completed_at: null,
        intent_summary: null,
        discovery_notes: null,
        recommendations: [],
        generated_blueprint_id: null,
        conversation_history: [],
        current_phase: {
          phase_number: 1,
          phase_name: "Intent Discovery",
        },
        phase_history: [],
      },
    ]);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "Discovery" }));

    await waitFor(() => {
      expect(screen.getByText("Session A")).toBeInTheDocument();
    });

    expect(listDiscoverySessions).toHaveBeenCalledWith("app-1");
    expect(screen.getByRole("heading", { name: "Discovery" })).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("navigates to blueprints list", async () => {
    vi.mocked(listBlueprints).mockResolvedValue([
      {
        id: "bp-1",
        application_id: "app-1",
        version_number: 2,
        status: "Approved",
        title: "Blueprint A",
        goal: null,
        outcome: null,
        created_by: "carol@example.com",
        created_at: "2025-06-02T10:00:00Z",
        approved_at: "2025-06-03T10:00:00Z",
        version_created_at: null,
        blueprint_snapshot: {},
      },
    ]);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "Blueprint" }));

    await waitFor(() => {
      expect(screen.getByText("Blueprint A")).toBeInTheDocument();
    });

    expect(listBlueprints).toHaveBeenCalledWith("app-1");
    expect(screen.getByRole("heading", { name: "Blueprint" })).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("navigates to ontology list", async () => {
    vi.mocked(listOntologies).mockResolvedValue([
      {
        id: "onto-1",
        application_id: "app-1",
        version_number: 1,
        previous_version_id: null,
        status: "Draft",
        title: "Ontology A",
        description: null,
        created_by: "alice@example.com",
        created_at: "2025-06-01T10:00:00Z",
        updated_at: "2025-06-01T10:00:00Z",
        validated_at: null,
        approved_at: null,
        published_at: null,
        version_created_at: null,
        ontology_definition: {},
      },
    ]);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "Ontology" }));

    await waitFor(() => {
      expect(screen.getByText("Ontology A")).toBeInTheDocument();
    });

    expect(listOntologies).toHaveBeenCalledWith("app-1");
    expect(screen.getByRole("heading", { name: "Ontology" })).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("navigates to knowledge graph list", async () => {
    vi.mocked(listKnowledgeGraphs).mockResolvedValue([
      {
        id: "kg-1",
        application_id: "app-1",
        status: "Created",
        title: "Knowledge Graph A",
        description: null,
        created_by: "alice@example.com",
        created_at: "2025-06-01T10:00:00Z",
        updated_at: "2025-06-01T10:00:00Z",
        populated_at: null,
        graph_updated_at: null,
        archived_at: null,
        graph_metadata: {},
        bound_ontology_ids: [],
      },
    ]);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "Knowledge graph" }));

    await waitFor(() => {
      expect(screen.getByText("Knowledge Graph A")).toBeInTheDocument();
    });

    expect(listKnowledgeGraphs).toHaveBeenCalledWith("app-1");
    expect(screen.getByRole("heading", { name: "Knowledge graph" })).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("navigates to products list", async () => {
    vi.mocked(listProducts).mockResolvedValue([
      {
        id: "prod-1",
        application_id: "app-1",
        version_number: 1,
        previous_version_id: null,
        status: "Published",
        title: "Product A",
        description: null,
        created_by: "alice@example.com",
        created_at: "2025-06-01T10:00:00Z",
        updated_at: "2025-06-01T10:00:00Z",
        certified_at: null,
        published_at: "2025-06-02T10:00:00Z",
        version_created_at: null,
        product_definition: {},
        source_asset_record_ids: [],
      },
    ]);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "Products" }));

    await waitFor(() => {
      expect(screen.getByText("Product A")).toBeInTheDocument();
    });

    expect(listProducts).toHaveBeenCalledWith("app-1");
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("navigates to agents list", async () => {
    vi.mocked(listAgents).mockResolvedValue([
      {
        id: "agent-1",
        application_id: "app-1",
        version_number: 1,
        previous_version_id: null,
        status: "Active",
        title: "Agent A",
        description: null,
        created_by: "bob@example.com",
        created_at: "2025-06-01T10:00:00Z",
        updated_at: "2025-06-01T10:00:00Z",
        approved_at: null,
        activated_at: null,
        version_created_at: null,
        agent_definition: {},
        bound_product_ids: [],
      },
    ]);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "Agents" }));

    await waitFor(() => {
      expect(screen.getByText("Agent A")).toBeInTheDocument();
    });

    expect(listAgents).toHaveBeenCalledWith("app-1");
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("navigates to agent runs list", async () => {
    vi.mocked(listAgentRuns).mockResolvedValue([
      {
        id: "run-1",
        application_id: "app-1",
        agent_definition_id: "agent-1",
        status: "Completed",
        created_by: "bob@example.com",
        created_at: "2025-06-01T10:00:00Z",
        updated_at: "2025-06-01T10:05:00Z",
        started_at: "2025-06-01T10:00:01Z",
        completed_at: "2025-06-01T10:05:00Z",
        run_payload: {},
        run_result: { answer: "stub" },
      },
    ]);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "Agent runs" }));

    await waitFor(() => {
      expect(screen.getByText("run-1")).toBeInTheDocument();
    });

    expect(listAgentRuns).toHaveBeenCalledWith("app-1");
    expect(screen.getByRole("heading", { name: "Agent runs" })).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("navigates to audit trace list", async () => {
    vi.mocked(listAuditTraces).mockResolvedValue([
      {
        id: "txn-1",
        transaction_type: "CREATE",
        resource_type: "Application",
        resource_id: "app-1",
        created_at: "2025-06-01T10:00:00Z",
        trace_steps: [],
      },
    ]);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "Audit trace" }));

    await waitFor(() => {
      expect(screen.getByText("CREATE")).toBeInTheDocument();
    });

    expect(listAuditTraces).toHaveBeenCalledWith("app-1");
    expect(screen.getByRole("heading", { name: "Audit trace" })).toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("highlights active section in navigation", async () => {
    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Overview" })).toHaveClass(
        "application-shell__nav-link--active",
      );
    });

    fireEvent.click(screen.getByRole("link", { name: "Products" }));

    expect(screen.getByRole("link", { name: "Products" })).toHaveClass(
      "application-shell__nav-link--active",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveClass(
      "application-shell__nav-link--active",
    );
  });

  it("shows breadcrumb with application name on overview", async () => {
    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Applications");
    expect(breadcrumb).toHaveTextContent("Demo App");
    expect(screen.getByRole("link", { name: "Applications" })).toHaveAttribute(
      "href",
      "/applications",
    );
  });

  it.each([
    ["discovery"],
    ["blueprint"],
    ["ontology"],
    ["knowledge-graph"],
    ["products"],
    ["agents"],
    ["agent-runs"],
    ["audit-trace"],
  ] as const)("shows breadcrumb on %s route", async (segment) => {
    renderDetailPage(`/applications/app-1/${segment}`);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Applications");
    expect(breadcrumb).toHaveTextContent("Demo App");
  });

  it("navigates back to applications list from back link", async () => {
    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "← Back to Applications" }));

    expect(screen.getByText("Applications list")).toBeInTheDocument();
  });

  it("navigates back to applications list from breadcrumb", async () => {
    renderDetailPage("/applications/app-1/discovery");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Demo App" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: "Applications" }));

    expect(screen.getByText("Applications list")).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAgent,
  listAgents,
  updateAgent,
  updateAgentStatus,
  type AgentDefinitionResponse,
} from "../api/agents";
import { listProducts, type PublishedDataProductResponse } from "../api/products";
import { AgentsPage } from "./AgentsPage";

vi.mock("../api/agents", () => ({
  listAgents: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  updateAgentStatus: vi.fn(),
  forkAgentVersion: vi.fn(),
  canForkAgent: vi.fn((agent: { status: string }) =>
    ["Active", "Versioned"].includes(agent.status),
  ),
  getNextAgentStatuses: vi.fn((status: string) => {
    const map: Record<string, string[]> = {
      Draft: ["Approved"],
      Approved: ["Active", "Draft"],
      Active: ["Versioned"],
      Versioned: ["Retired"],
      Retired: [],
    };
    return map[status] ?? [];
  }),
  getAgentStatusActionLabel: vi.fn((status: string) => {
    const labels: Record<string, string> = {
      Approved: "Approve",
      Active: "Activate",
      Draft: "Revert to Draft",
      Versioned: "Version",
      Retired: "Retire",
    };
    return labels[status] ?? status;
  }),
}));

vi.mock("../api/products", () => ({
  listProducts: vi.fn(),
  isConsumableProduct: vi.fn(
    (product: PublishedDataProductResponse) =>
      product.status === "Published" || product.status === "Versioned",
  ),
}));

const publishedProduct: PublishedDataProductResponse = {
  id: "prod-1",
  application_id: "app-1",
  version_number: 1,
  previous_version_id: null,
  status: "Published",
  title: "Customer 360 Product",
  description: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  certified_at: "2025-06-02T10:00:00Z",
  published_at: "2025-06-03T10:00:00Z",
  version_created_at: null,
  product_definition: {},
  source_asset_record_ids: [],
};

const draftProduct: PublishedDataProductResponse = {
  ...publishedProduct,
  id: "prod-draft",
  status: "Draft",
  published_at: null,
};

const mockAgent: AgentDefinitionResponse = {
  id: "agent-1",
  application_id: "app-1",
  version_number: 1,
  previous_version_id: null,
  status: "Active",
  title: "Assessment Agent",
  description: null,
  created_by: "bob@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  approved_at: "2025-06-02T10:00:00Z",
  activated_at: "2025-06-03T10:00:00Z",
  version_created_at: null,
  agent_definition: {},
  bound_product_ids: ["prod-1"],
};

const newAgent: AgentDefinitionResponse = {
  ...mockAgent,
  id: "agent-2",
  title: "New Agent",
  status: "Draft",
  bound_product_ids: [],
};

const draftAgent: AgentDefinitionResponse = {
  ...newAgent,
  id: "agent-draft",
  title: "Draft Agent",
};

const approvedAgent: AgentDefinitionResponse = {
  ...draftAgent,
  status: "Approved",
  bound_product_ids: ["prod-1"],
};

describe("AgentsPage", () => {
  beforeEach(() => {
    vi.mocked(listAgents).mockReset();
    vi.mocked(createAgent).mockReset();
    vi.mocked(updateAgent).mockReset();
    vi.mocked(updateAgentStatus).mockReset();
    vi.mocked(listProducts).mockReset();
    vi.mocked(listProducts).mockResolvedValue([publishedProduct, draftProduct]);
  });

  it("renders loading then agents table with bound products", async () => {
    vi.mocked(listAgents).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockAgent]), 0);
        }),
    );

    render(<AgentsPage applicationId="app-1" />);

    expect(screen.getByText("Loading agents…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Assessment Agent")).toBeInTheDocument();
    });

    expect(listAgents).toHaveBeenCalledWith("app-1");
    expect(listProducts).toHaveBeenCalledWith("app-1");
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("1: Customer 360 Product")).toBeInTheDocument();
  });

  it("renders empty state with create form", async () => {
    vi.mocked(listAgents).mockResolvedValue([]);

    render(<AgentsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No agent definitions yet.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Create agent")).toBeInTheDocument();
  });

  it("creates agent with product bindings from empty state", async () => {
    vi.mocked(listAgents)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...newAgent, bound_product_ids: ["prod-1"] }]);
    vi.mocked(createAgent).mockResolvedValue({ ...newAgent, bound_product_ids: ["prod-1"] });

    render(<AgentsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create agent")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New Agent" } });
    fireEvent.click(screen.getByLabelText(/Customer 360 Product/));
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    await waitFor(() => {
      expect(createAgent).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "New Agent",
        agent_definition: {},
        bound_product_ids: ["prod-1"],
      });
    });
  });

  it("shows New agent panel when list has items", async () => {
    vi.mocked(listAgents).mockResolvedValue([mockAgent]);

    render(<AgentsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("Assessment Agent")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New agent" }));
    expect(screen.getByRole("heading", { name: "New agent" })).toBeInTheDocument();
  });

  it("shows API error on create failure", async () => {
    vi.mocked(listAgents).mockResolvedValue([]);
    vi.mocked(createAgent).mockRejectedValue(new Error("Server error"));

    render(<AgentsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create agent")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fail Agent" } });
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });

  it("approves draft agent via lifecycle action", async () => {
    vi.mocked(listAgents)
      .mockResolvedValueOnce([draftAgent])
      .mockResolvedValueOnce([approvedAgent]);
    vi.mocked(updateAgentStatus).mockResolvedValue(approvedAgent);

    render(<AgentsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(updateAgentStatus).toHaveBeenCalledWith("agent-draft", "Approved");
    });

    await waitFor(() => {
      expect(screen.getByText("Approved")).toBeInTheDocument();
    });
  });

  it("edits bindings for approved agent before activate", async () => {
    const updatedAgent: AgentDefinitionResponse = {
      ...approvedAgent,
      bound_product_ids: [],
    };
    vi.mocked(listAgents)
      .mockResolvedValueOnce([approvedAgent])
      .mockResolvedValueOnce([updatedAgent]);
    vi.mocked(updateAgent).mockResolvedValue(updatedAgent);

    render(<AgentsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit bindings" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit bindings" }));
    fireEvent.click(screen.getByLabelText(/Customer 360 Product/));
    fireEvent.click(screen.getByRole("button", { name: "Save bindings" }));

    await waitFor(() => {
      expect(updateAgent).toHaveBeenCalledWith("agent-draft", { bound_product_ids: [] });
    });
  });

  it("shows action error when agent status update fails", async () => {
    vi.mocked(listAgents).mockResolvedValue([draftAgent]);
    vi.mocked(updateAgentStatus).mockRejectedValue(new Error("Binding required"));

    render(<AgentsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Binding required");
    });
  });

  it("renders error state on API failure", async () => {
    vi.mocked(listAgents).mockRejectedValue(new Error("Network error"));

    render(<AgentsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });
});

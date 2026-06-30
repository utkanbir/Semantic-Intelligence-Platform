import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAgent,
  listAgents,
  type AgentDefinitionResponse,
} from "../api/agents";
import { AgentsPage } from "./AgentsPage";

vi.mock("../api/agents", () => ({
  listAgents: vi.fn(),
  createAgent: vi.fn(),
}));

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

describe("AgentsPage", () => {
  beforeEach(() => {
    vi.mocked(listAgents).mockReset();
    vi.mocked(createAgent).mockReset();
  });

  it("renders loading then agents table", async () => {
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
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders empty state with create form", async () => {
    vi.mocked(listAgents).mockResolvedValue([]);

    render(<AgentsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No agent definitions yet.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Create agent")).toBeInTheDocument();
  });

  it("creates agent from empty state and refreshes list", async () => {
    vi.mocked(listAgents)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newAgent]);
    vi.mocked(createAgent).mockResolvedValue(newAgent);

    render(<AgentsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create agent")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New Agent" } });
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    await waitFor(() => {
      expect(createAgent).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "New Agent",
        agent_definition: {},
      });
    });

    await waitFor(() => {
      expect(screen.getByText("New Agent")).toBeInTheDocument();
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

  it("renders error state on API failure", async () => {
    vi.mocked(listAgents).mockRejectedValue(new Error("Network error"));

    render(<AgentsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });
});

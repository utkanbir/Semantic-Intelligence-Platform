import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { listAgents, type AgentDefinitionResponse } from "../api/agents";
import {
  listAgentRuns,
  startAgentRun,
  type AgentRunResponse,
} from "../api/agentRuns";
import { AgentRunsPage } from "./AgentRunsPage";

vi.mock("../api/agentRuns", () => ({
  listAgentRuns: vi.fn(),
  startAgentRun: vi.fn(),
}));

vi.mock("../api/agents", () => ({
  listAgents: vi.fn(),
}));

const mockRun: AgentRunResponse = {
  id: "run-1",
  application_id: "app-1",
  agent_definition_id: "agent-1",
  status: "Completed",
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:05:00Z",
  started_at: "2025-06-01T10:00:01Z",
  completed_at: "2025-06-01T10:05:00Z",
  run_payload: { message: "What is revenue?" },
  run_result: { answer: "stub" },
};

const activeAgent: AgentDefinitionResponse = {
  id: "agent-1",
  application_id: "app-1",
  version_number: 1,
  previous_version_id: null,
  status: "Active",
  title: "Assessment Agent",
  description: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T08:00:00Z",
  updated_at: "2025-06-01T09:00:00Z",
  approved_at: "2025-06-01T08:30:00Z",
  activated_at: "2025-06-01T09:00:00Z",
  version_created_at: null,
  agent_definition: {},
  bound_product_ids: ["prod-1"],
};

const draftAgent: AgentDefinitionResponse = {
  ...activeAgent,
  id: "agent-draft",
  status: "Draft",
  title: "Draft Agent",
  bound_product_ids: ["prod-1"],
};

const activeAgentWithoutBindings: AgentDefinitionResponse = {
  ...activeAgent,
  id: "agent-unbound",
  title: "Unbound Agent",
  bound_product_ids: [],
};

describe("AgentRunsPage", () => {
  beforeEach(() => {
    vi.mocked(listAgentRuns).mockReset();
    vi.mocked(startAgentRun).mockReset();
    vi.mocked(listAgents).mockReset();
    vi.mocked(listAgents).mockResolvedValue([activeAgent]);
  });

  it("renders loading then runs table", async () => {
    vi.mocked(listAgentRuns).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockRun]), 0);
        }),
    );

    render(<AgentRunsPage applicationId="app-1" />);

    expect(screen.getByText("Loading agent runs…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("run-1")).toBeInTheDocument();
    });

    expect(listAgentRuns).toHaveBeenCalledWith("app-1");
    expect(screen.getByText("agent-1")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders empty state when no runs", async () => {
    vi.mocked(listAgentRuns).mockResolvedValue([]);

    render(<AgentRunsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No agent runs yet.")).toBeInTheDocument();
    });
  });

  it("renders error state on API failure", async () => {
    vi.mocked(listAgentRuns).mockRejectedValue(new Error("Network error"));

    render(<AgentRunsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });

  it("renders trigger form with Active agents that have bindings", async () => {
    vi.mocked(listAgentRuns).mockResolvedValue([]);
    vi.mocked(listAgents).mockResolvedValue([
      activeAgent,
      draftAgent,
      activeAgentWithoutBindings,
    ]);

    render(<AgentRunsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Trigger agent run")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Active agent");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Assessment Agent" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Draft Agent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Unbound Agent" })).not.toBeInTheDocument();
  });

  it("starts a run and refreshes the list on success", async () => {
    const newRun: AgentRunResponse = {
      ...mockRun,
      id: "run-2",
    };

    vi.mocked(listAgentRuns)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newRun]);
    vi.mocked(startAgentRun).mockResolvedValue(newRun);

    render(<AgentRunsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Trigger agent run")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Active agent"), {
      target: { value: "agent-1" },
    });
    fireEvent.change(screen.getByLabelText("Stub question"), {
      target: { value: "What is revenue?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start run" }));

    await waitFor(() => {
      expect(startAgentRun).toHaveBeenCalledWith({
        application_id: "app-1",
        agent_definition_id: "agent-1",
        run_payload: { message: "What is revenue?" },
      });
    });

    await waitFor(() => {
      expect(listAgentRuns).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByText("run-2")).toBeInTheDocument();
    });
  });

  it("shows API error message on 422 submit failure", async () => {
    vi.mocked(listAgentRuns).mockResolvedValue([]);
    vi.mocked(startAgentRun).mockRejectedValue(
      new ApiError("Active agent must have bound products", 422),
    );

    render(<AgentRunsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Trigger agent run")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Active agent"), {
      target: { value: "agent-1" },
    });
    fireEvent.change(screen.getByLabelText("Stub question"), {
      target: { value: "What is revenue?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start run" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Active agent must have bound products",
      );
    });
  });
});

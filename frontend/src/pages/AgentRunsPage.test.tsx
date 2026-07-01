import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAgentRuns, type AgentRunResponse } from "../api/agentRuns";
import { AgentRunsPage } from "./AgentRunsPage";

vi.mock("../api/agentRuns", () => ({
  listAgentRuns: vi.fn(),
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
  run_payload: { question: "What is revenue?" },
  run_result: { answer: "stub" },
};

describe("AgentRunsPage", () => {
  beforeEach(() => {
    vi.mocked(listAgentRuns).mockReset();
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
});

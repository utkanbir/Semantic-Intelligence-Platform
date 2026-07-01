import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { getAgentRun, type AgentRunResponse } from "../api/agentRuns";
import { AgentRunDetailPage } from "./AgentRunDetailPage";

vi.mock("../api/agentRuns", () => ({
  getAgentRun: vi.fn(),
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

function renderDetailPage(
  props: { applicationId?: string; runId?: string } = {},
) {
  const applicationId = props.applicationId ?? "app-1";
  const runId = props.runId ?? "run-1";

  return render(
    <MemoryRouter>
      <AgentRunDetailPage applicationId={applicationId} runId={runId} />
    </MemoryRouter>,
  );
}

describe("AgentRunDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getAgentRun).mockReset();
  });

  it("renders loading then run details", async () => {
    vi.mocked(getAgentRun).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockRun), 0);
        }),
    );

    renderDetailPage();

    expect(screen.getByText("Loading agent run…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("agent-1")).toBeInTheDocument();
    });

    expect(getAgentRun).toHaveBeenCalledWith("run-1");
    expect(screen.getByText("agent-1")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText(/"message": "What is revenue\?"/)).toBeInTheDocument();
    expect(screen.getByText(/"answer": "stub"/)).toBeInTheDocument();
  });

  it("renders back link to agent runs list", async () => {
    vi.mocked(getAgentRun).mockResolvedValue(mockRun);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "← Back to agent runs" })).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "← Back to agent runs" })).toHaveAttribute(
      "href",
      "/applications/app-1/agent-runs",
    );
  });

  it("renders 404 state when API returns 404", async () => {
    vi.mocked(getAgentRun).mockRejectedValue(new ApiError("Not found", 404));

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Agent run not found.")).toBeInTheDocument();
    });
  });

  it("renders 404 state when run belongs to another application", async () => {
    vi.mocked(getAgentRun).mockResolvedValue({
      ...mockRun,
      application_id: "app-other",
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Agent run not found.")).toBeInTheDocument();
    });
  });

  it("renders error state on API failure", async () => {
    vi.mocked(getAgentRun).mockRejectedValue(new Error("Network error"));

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });

  it("renders null run result as JSON null", async () => {
    vi.mocked(getAgentRun).mockResolvedValue({
      ...mockRun,
      run_result: null,
    });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByText("Run result")).toBeInTheDocument();
    });

    const resultBlock = screen.getByText("Run result").nextElementSibling;
    expect(resultBlock).toHaveTextContent("null");
  });
});

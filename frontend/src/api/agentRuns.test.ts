import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAgentRun,
  listAgentRuns,
  startAgentRun,
  type AgentRunResponse,
} from "./agentRuns";

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

describe("agentRuns API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("listAgentRuns calls GET with application_id", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([mockRun]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(listAgentRuns("app-1")).resolves.toEqual([mockRun]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/agent-runs?application_id=app-1",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("listAgentRuns includes run_status when provided", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await listAgentRuns("app-1", "Running");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/agent-runs?application_id=app-1&run_status=Running",
      expect.any(Object),
    );
  });

  it("getAgentRun calls GET for a single run", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockRun), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getAgentRun("run-1")).resolves.toEqual(mockRun);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/agent-runs/run-1",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("startAgentRun calls POST with payload", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockRun), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const payload = {
      application_id: "app-1",
      agent_definition_id: "agent-1",
      created_by: "alice@example.com",
      run_payload: { message: "What is revenue?" },
    };

    await expect(startAgentRun(payload)).resolves.toEqual(mockRun);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/agent-runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
        headers: expect.any(Headers),
      }),
    );
  });
});

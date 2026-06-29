import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAgents, type AgentDefinitionResponse } from "../api/agents";
import { AgentsPage } from "./AgentsPage";

vi.mock("../api/agents", () => ({
  listAgents: vi.fn(),
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

describe("AgentsPage", () => {
  beforeEach(() => {
    vi.mocked(listAgents).mockReset();
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

  it("renders empty state when no agents exist", async () => {
    vi.mocked(listAgents).mockResolvedValue([]);

    render(<AgentsPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No agent definitions yet.")).toBeInTheDocument();
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

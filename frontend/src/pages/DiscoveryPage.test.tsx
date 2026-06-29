import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listDiscoverySessions,
  type DiscoverySessionResponse,
} from "../api/discovery";
import { DiscoveryPage } from "./DiscoveryPage";

vi.mock("../api/discovery", () => ({
  listDiscoverySessions: vi.fn(),
}));

const mockSession: DiscoverySessionResponse = {
  id: "session-1",
  application_id: "app-1",
  status: "Active",
  title: "Q2 Intent Discovery",
  started_by: "alice@example.com",
  started_at: "2025-06-01T10:00:00Z",
  completed_at: null,
  intent_summary: null,
  discovery_notes: null,
  recommendations: [],
  generated_blueprint_id: null,
  conversation_history: [],
  current_phase: {
    phase_number: 2,
    phase_name: "User Discovery",
  },
  phase_history: [],
};

describe("DiscoveryPage", () => {
  beforeEach(() => {
    vi.mocked(listDiscoverySessions).mockReset();
  });

  it("renders loading then sessions table", async () => {
    vi.mocked(listDiscoverySessions).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockSession]), 0);
        }),
    );

    render(<DiscoveryPage applicationId="app-1" />);

    expect(screen.getByText("Loading discovery sessions…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Q2 Intent Discovery")).toBeInTheDocument();
    });

    expect(listDiscoverySessions).toHaveBeenCalledWith("app-1");
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("2. User Discovery")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("renders empty state when no sessions exist", async () => {
    vi.mocked(listDiscoverySessions).mockResolvedValue([]);

    render(<DiscoveryPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No discovery sessions yet.")).toBeInTheDocument();
    });
  });

  it("renders error state on API failure", async () => {
    vi.mocked(listDiscoverySessions).mockRejectedValue(new Error("Network error"));

    render(<DiscoveryPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });
});

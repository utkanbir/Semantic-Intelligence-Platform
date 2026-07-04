import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDiscoverySession,
  listDiscoverySessions,
  updateDiscoverySessionStatus,
  type DiscoverySessionResponse,
} from "../api/discovery";
import { DiscoveryPage } from "./DiscoveryPage";

vi.mock("../api/discovery", () => ({
  listDiscoverySessions: vi.fn(),
  createDiscoverySession: vi.fn(),
  updateDiscoverySessionStatus: vi.fn(),
  getNextDiscoveryStatuses: vi.fn((status: string) => {
    const map: Record<string, string[]> = {
      Active: ["Paused", "Completed", "Archived"],
      Paused: ["Active", "Completed", "Archived"],
      Completed: ["Archived"],
      Archived: [],
    };
    return map[status] ?? [];
  }),
  getDiscoveryStatusActionLabel: vi.fn((status: string) => {
    const labels: Record<string, string> = {
      Active: "Resume",
      Paused: "Pause",
      Completed: "Complete",
      Archived: "Archive",
    };
    return labels[status] ?? status;
  }),
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

const newSession: DiscoverySessionResponse = {
  ...mockSession,
  id: "session-2",
  title: "New Session",
  started_by: "bob@example.com",
};

const pausedSession: DiscoverySessionResponse = {
  ...mockSession,
  status: "Paused",
};

describe("DiscoveryPage", () => {
  beforeEach(() => {
    vi.mocked(listDiscoverySessions).mockReset();
    vi.mocked(createDiscoverySession).mockReset();
    vi.mocked(updateDiscoverySessionStatus).mockReset();
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
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("renders empty state with create form", async () => {
    vi.mocked(listDiscoverySessions).mockResolvedValue([]);

    render(<DiscoveryPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No discovery sessions yet.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Create discovery session")).toBeInTheDocument();
  });

  it("creates session from empty state and refreshes list", async () => {
    vi.mocked(listDiscoverySessions)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newSession]);
    vi.mocked(createDiscoverySession).mockResolvedValue(newSession);

    render(<DiscoveryPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create discovery session")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "New Session" },
    });
    fireEvent.change(screen.getByLabelText(/Started by/), {
      target: { value: "bob@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create session" }));

    await waitFor(() => {
      expect(createDiscoverySession).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "New Session",
        started_by: "bob@example.com",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("New Session")).toBeInTheDocument();
    });
  });

  it("shows New session panel when list has items", async () => {
    vi.mocked(listDiscoverySessions).mockResolvedValue([mockSession]);

    render(<DiscoveryPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("Q2 Intent Discovery")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New session" }));
    expect(screen.getByRole("heading", { name: "New discovery session" })).toBeInTheDocument();
  });

  it("pauses active session via lifecycle action", async () => {
    vi.mocked(listDiscoverySessions)
      .mockResolvedValueOnce([mockSession])
      .mockResolvedValueOnce([pausedSession]);
    vi.mocked(updateDiscoverySessionStatus).mockResolvedValue(pausedSession);

    render(<DiscoveryPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => {
      expect(updateDiscoverySessionStatus).toHaveBeenCalledWith("session-1", "Paused");
    });

    await waitFor(() => {
      expect(screen.getByText("Paused")).toBeInTheDocument();
    });
  });

  it("shows action error when status update fails", async () => {
    vi.mocked(listDiscoverySessions).mockResolvedValue([mockSession]);
    vi.mocked(updateDiscoverySessionStatus).mockRejectedValue(
      new Error("Invalid transition"),
    );

    render(<DiscoveryPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid transition");
    });
  });

  it("shows API error on create failure", async () => {
    vi.mocked(listDiscoverySessions).mockResolvedValue([]);
    vi.mocked(createDiscoverySession).mockRejectedValue(new Error("Server error"));

    render(<DiscoveryPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create discovery session")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fail Session" } });
    fireEvent.click(screen.getByRole("button", { name: "Create session" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
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

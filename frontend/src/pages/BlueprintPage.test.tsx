import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBlueprint,
  listBlueprints,
  type BlueprintResponse,
} from "../api/blueprints";
import { BlueprintPage } from "./BlueprintPage";

vi.mock("../api/blueprints", () => ({
  listBlueprints: vi.fn(),
  createBlueprint: vi.fn(),
}));

const mockBlueprint: BlueprintResponse = {
  id: "bp-1",
  application_id: "app-1",
  version_number: 1,
  status: "Draft",
  title: "Q2 Platform Blueprint",
  goal: null,
  outcome: null,
  created_by: "alice@example.com",
  created_at: "2025-06-01T10:00:00Z",
  approved_at: null,
  version_created_at: null,
  blueprint_snapshot: {},
};

const newBlueprint: BlueprintResponse = {
  ...mockBlueprint,
  id: "bp-2",
  title: "New Blueprint",
};

describe("BlueprintPage", () => {
  beforeEach(() => {
    vi.mocked(listBlueprints).mockReset();
    vi.mocked(createBlueprint).mockReset();
  });

  it("renders loading then blueprints table", async () => {
    vi.mocked(listBlueprints).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockBlueprint]), 0);
        }),
    );

    render(<BlueprintPage applicationId="app-1" />);

    expect(screen.getByText("Loading blueprints…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Q2 Platform Blueprint")).toBeInTheDocument();
    });

    expect(listBlueprints).toHaveBeenCalledWith("app-1");
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders empty state with create form", async () => {
    vi.mocked(listBlueprints).mockResolvedValue([]);

    render(<BlueprintPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No blueprints yet.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Create blueprint")).toBeInTheDocument();
  });

  it("creates blueprint from empty state and refreshes list", async () => {
    vi.mocked(listBlueprints)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newBlueprint]);
    vi.mocked(createBlueprint).mockResolvedValue(newBlueprint);

    render(<BlueprintPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create blueprint")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "New Blueprint" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create blueprint" }));

    await waitFor(() => {
      expect(createBlueprint).toHaveBeenCalledWith({
        application_id: "app-1",
        title: "New Blueprint",
        blueprint_snapshot: {},
      });
    });

    await waitFor(() => {
      expect(screen.getByText("New Blueprint")).toBeInTheDocument();
    });
  });

  it("shows New blueprint panel when list has items", async () => {
    vi.mocked(listBlueprints).mockResolvedValue([mockBlueprint]);

    render(<BlueprintPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("Q2 Platform Blueprint")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "New blueprint" }));
    expect(screen.getByRole("heading", { name: "New blueprint" })).toBeInTheDocument();
  });

  it("shows API error on create failure", async () => {
    vi.mocked(listBlueprints).mockResolvedValue([]);
    vi.mocked(createBlueprint).mockRejectedValue(new Error("Server error"));

    render(<BlueprintPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Create blueprint")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fail Blueprint" } });
    fireEvent.click(screen.getByRole("button", { name: "Create blueprint" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });

  it("renders error state on API failure", async () => {
    vi.mocked(listBlueprints).mockRejectedValue(new Error("Network error"));

    render(<BlueprintPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });
});

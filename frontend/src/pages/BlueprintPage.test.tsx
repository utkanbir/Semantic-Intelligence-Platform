import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listBlueprints, type BlueprintResponse } from "../api/blueprints";
import { BlueprintPage } from "./BlueprintPage";

vi.mock("../api/blueprints", () => ({
  listBlueprints: vi.fn(),
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

describe("BlueprintPage", () => {
  beforeEach(() => {
    vi.mocked(listBlueprints).mockReset();
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

  it("renders empty state when no blueprints exist", async () => {
    vi.mocked(listBlueprints).mockResolvedValue([]);

    render(<BlueprintPage applicationId="app-1" />);

    await waitFor(() => {
      expect(screen.getByText("No blueprints yet.")).toBeInTheDocument();
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

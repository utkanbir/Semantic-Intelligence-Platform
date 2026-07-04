import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api";
import { listPolicies, type PolicyDefinitionResponse } from "../../api/governance";
import { GovernancePage } from "./GovernancePage";

vi.mock("../../api/governance", () => ({
  listPolicies: vi.fn(),
}));

const mockPolicy: PolicyDefinitionResponse = {
  id: "policy-1",
  policy_key: "data-retention",
  status: "Active",
  title: "Data Retention Policy",
  description: null,
  created_by: "admin",
  created_at: "2025-06-01T10:00:00Z",
  updated_at: "2025-06-01T10:00:00Z",
  approved_at: "2025-06-02T10:00:00Z",
  activated_at: "2025-06-03T10:00:00Z",
  retired_at: null,
  policy_definition: {},
};

describe("GovernancePage", () => {
  beforeEach(() => {
    vi.mocked(listPolicies).mockReset();
  });

  it("renders loading then policies table", async () => {
    vi.mocked(listPolicies).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([mockPolicy]), 0);
        }),
    );

    render(<GovernancePage />);

    expect(screen.getByText("Loading policies…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Data Retention Policy")).toBeInTheDocument();
    });

    expect(listPolicies).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("data-retention")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    vi.mocked(listPolicies).mockResolvedValue([]);

    render(<GovernancePage />);

    await waitFor(() => {
      expect(screen.getByText("No policies yet.")).toBeInTheDocument();
    });
  });

  it("renders error state", async () => {
    vi.mocked(listPolicies).mockRejectedValue(new ApiError("Server error", 500));

    render(<GovernancePage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server error");
    });
  });
});

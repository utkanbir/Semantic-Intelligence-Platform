import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          service: "sip-backend",
          environment: "test",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders platform header and applications home", async () => {
    render(<App />);
    expect(
      screen.getByText("Semantic Intelligence Platform"),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Applications" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Backend connected")).toBeInTheDocument();
    });
  });
});

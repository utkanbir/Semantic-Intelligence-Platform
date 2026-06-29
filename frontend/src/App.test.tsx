import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/health")) {
        return Promise.resolve(
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
      }

      if (url.includes("/applications")) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
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
      expect(screen.getByText("No applications yet.")).toBeInTheDocument();
    });
  });
});

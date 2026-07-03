import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformShell } from "./PlatformShell";

describe("PlatformShell", () => {
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

      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders grouped platform and applications navigation", async () => {
    render(
      <MemoryRouter>
        <PlatformShell>
          <div>Page content</div>
        </PlatformShell>
      </MemoryRouter>,
    );

    expect(screen.getByText("Semantic Intelligence Platform")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveTextContent(
      "Applications",
    );

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Connectors" })).toHaveAttribute(
      "href",
      "/connectors",
    );
    expect(screen.getByRole("link", { name: "Governance" })).toHaveAttribute(
      "href",
      "/governance",
    );
    expect(screen.getByRole("link", { name: "Semantic Transactions" })).toHaveAttribute(
      "href",
      "/audit-trace",
    );
    expect(screen.getAllByRole("link", { name: "Applications" })[0]).toHaveAttribute(
      "href",
      "/applications",
    );

    await waitFor(() => {
      expect(screen.getByText("Backend connected")).toBeInTheDocument();
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.history.pushState({}, "", "/");
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

  it("renders platform overview at home", async () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Semantic Intelligence Platform" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Sandboxlar" })).toBeInTheDocument();
    });
    expect(
      screen.getByText("Henüz sandbox yok. Yeni sandbox oluşturarak başlayın."),
    ).toBeInTheDocument();
  });

  it("loads platform hub at /platform", async () => {
    window.history.pushState({}, "", "/platform");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Platform" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View and provision connectors/i })).toHaveAttribute(
      "href",
      "/connectors",
    );
  });

  it("loads applications list from home create action", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: "+ Yeni uygulama" }));

    expect(screen.getByRole("heading", { name: "Applications" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("No applications yet.")).toBeInTheDocument();
    });
  });
});

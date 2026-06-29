import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, getApiBaseUrl } from "./client";

describe("getApiBaseUrl", () => {
  it("returns the default base URL when env is unset", () => {
    expect(getApiBaseUrl()).toBe("/api/v1");
  });
});

describe("apiFetch", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("returns parsed JSON on success", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(apiFetch<{ status: string }>("/health")).resolves.toEqual({
      status: "ok",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/health",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("throws ApiError with status and body on HTTP error", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(apiFetch("/missing")).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
      expect((error as ApiError).message).toBe("Not found");
      expect((error as ApiError).body).toEqual({ detail: "Not found" });
      return true;
    });
  });

  it("throws ApiError on network failure", async () => {
    fetchMock.mockRejectedValue(new Error("Failed to fetch"));

    await expect(apiFetch("/health")).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(0);
      expect((error as ApiError).message).toBe("Failed to fetch");
      return true;
    });
  });

  it("sends JSON body and Content-Type for POST requests", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await apiFetch("/applications", {
      method: "POST",
      body: JSON.stringify({ key: "demo" }),
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ key: "demo" }));
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });
});

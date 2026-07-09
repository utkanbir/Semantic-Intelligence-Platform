import { describe, expect, it } from "vitest";
import {
  isValidGenerateSourceUrl,
  normalizeAndValidateGenerateSourceUrl,
} from "./generateSourceUrl";

describe("generateSourceUrl", () => {
  it("normalizes a valid https URL", () => {
    expect(normalizeAndValidateGenerateSourceUrl("https://example.com/page")).toBe(
      "https://example.com/page",
    );
  });

  it("trims whitespace before validating", () => {
    expect(normalizeAndValidateGenerateSourceUrl("  https://example.com  ")).toBe(
      "https://example.com/",
    );
  });

  it("rejects empty input", () => {
    expect(() => normalizeAndValidateGenerateSourceUrl("   ")).toThrow("URL is required");
  });

  it("rejects invalid URLs", () => {
    expect(() => normalizeAndValidateGenerateSourceUrl("not-a-url")).toThrow("valid URL");
    expect(isValidGenerateSourceUrl("not-a-url")).toBe(false);
  });

  it("rejects non-http schemes", () => {
    expect(() => normalizeAndValidateGenerateSourceUrl("ftp://example.com/doc")).toThrow(
      "http or https",
    );
  });
});

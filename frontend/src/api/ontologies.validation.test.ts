import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./client";
import {
  runOntologyValidation,
  validateOntologyContent,
  type OntologyValidationReport,
} from "./ontologies";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

describe("ontologies validation api", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("validateOntologyContent posts payload to validate endpoint", async () => {
    const report: OntologyValidationReport = {
      passed: true,
      error_count: 0,
      warning_count: 0,
      findings: [],
      stats: {},
      run_at: "2025-06-01T10:00:00Z",
      run_id: "run-1",
      ai_summary: null,
      inventory: null,
    };
    vi.mocked(apiFetch).mockResolvedValue(report);

    await expect(
      validateOntologyContent({
        source_format: "ttl",
        source_content: "@prefix ex: <http://example.org/> .",
      }),
    ).resolves.toEqual(report);

    expect(apiFetch).toHaveBeenCalledWith("/ontologies/validate", {
      method: "POST",
      body: JSON.stringify({
        source_format: "ttl",
        source_content: "@prefix ex: <http://example.org/> .",
      }),
    });
  });

  it("runOntologyValidation posts to ontology validate endpoint", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ontology: { id: "onto-1" },
      report: { passed: true },
      semantic_transaction_id: "txn-1",
    });

    await runOntologyValidation("onto-1");

    expect(apiFetch).toHaveBeenCalledWith("/ontologies/onto-1/validate", {
      method: "POST",
      body: JSON.stringify({}),
    });
  });
});

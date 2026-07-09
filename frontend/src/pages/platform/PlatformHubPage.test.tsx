import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PlatformHubPage } from "./PlatformHubPage";

describe("PlatformHubPage", () => {
  it("renders navigable tiles for Connectors, Governance, Semantic Transactions, and Audit Trace", () => {
    render(
      <MemoryRouter>
        <PlatformHubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Platform" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /View and provision connectors/i })).toHaveAttribute(
      "href",
      "/connectors",
    );
    expect(screen.getByRole("link", { name: /Browse governance policies/i })).toHaveAttribute(
      "href",
      "/governance",
    );
    expect(screen.getByRole("link", { name: /Browse semantic transactions/i })).toHaveAttribute(
      "href",
      "/semantic-transactions",
    );
    expect(screen.getByRole("link", { name: /Browse audit trace records/i })).toHaveAttribute(
      "href",
      "/audit-trace",
    );
  });
});

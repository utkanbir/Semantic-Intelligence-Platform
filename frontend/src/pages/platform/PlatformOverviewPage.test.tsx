import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PlatformOverviewPage } from "./PlatformOverviewPage";

describe("PlatformOverviewPage", () => {
  it("renders home sections for platform capabilities and applications", () => {
    render(
      <MemoryRouter>
        <PlatformOverviewPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Platform capabilities" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Applications & sandboxes" }),
    ).toBeInTheDocument();
  });

  it("renders primary navigation links for platform hub and applications", () => {
    render(
      <MemoryRouter>
        <PlatformOverviewPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Open platform hub/i })).toHaveAttribute(
      "href",
      "/platform",
    );
    expect(screen.getByRole("link", { name: /Browse applications/i })).toHaveAttribute(
      "href",
      "/applications",
    );
  });

  it("renders quick-access platform service links", () => {
    render(
      <MemoryRouter>
        <PlatformOverviewPage />
      </MemoryRouter>,
    );

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

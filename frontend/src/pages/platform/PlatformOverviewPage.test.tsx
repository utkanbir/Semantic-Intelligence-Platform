import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PlatformOverviewPage } from "./PlatformOverviewPage";

describe("PlatformOverviewPage", () => {
  it("renders clickable summary cards for Platform and Applications", () => {
    render(
      <MemoryRouter>
        <PlatformOverviewPage />
      </MemoryRouter>,
    );

    const platformLink = screen.getByRole("link", {
      name: /Connectors, governance, semantic transactions/i,
    });
    expect(platformLink).toHaveAttribute("href", "/platform");

    const applicationsLink = screen.getByRole("link", { name: /Open application list/i });
    expect(applicationsLink).toHaveAttribute("href", "/applications");
  });
});

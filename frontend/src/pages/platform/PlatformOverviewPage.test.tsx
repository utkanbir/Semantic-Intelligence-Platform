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

    const platformLink = screen.getByRole("link", { name: /Adapters, governance, audit trace/i });
    expect(platformLink).toHaveAttribute("href", "/adapters");

    const applicationsLink = screen.getByRole("link", { name: /Open application list/i });
    expect(applicationsLink).toHaveAttribute("href", "/applications");
  });
});

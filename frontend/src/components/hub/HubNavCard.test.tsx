import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HubNavCard } from "./HubNavCard";

describe("HubNavCard", () => {
  it("renders a navigable hub card with action label", () => {
    render(
      <MemoryRouter>
        <HubNavCard
          to="/connectors"
          eyebrow="Connectors"
          title="Connectors"
          description="Manage infrastructure and semantic connectors."
          actionLabel="View connectors"
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /View connectors/i });
    expect(link).toHaveAttribute("href", "/connectors");
    expect(link).toHaveTextContent("Connectors");
    expect(link).toHaveTextContent("Manage infrastructure and semantic connectors.");
  });
});

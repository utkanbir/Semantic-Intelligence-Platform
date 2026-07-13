import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeCompareSummary } from "../../components/home/HomeCompareSummary";

describe("HomeCompareSummary", () => {
  it("renders compare summary placeholder", () => {
    render(<HomeCompareSummary />);

    expect(screen.getByRole("heading", { name: "Compare dashboard özeti" })).toBeInTheDocument();
    expect(screen.getByText(/Compare Mode verisi henüz yok/i)).toBeInTheDocument();
  });
});

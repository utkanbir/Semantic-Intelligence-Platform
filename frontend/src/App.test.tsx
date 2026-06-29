import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders platform header and applications home", () => {
    render(<App />);
    expect(
      screen.getByText("Semantic Intelligence Platform"),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Applications" })).toBeInTheDocument();
  });
});

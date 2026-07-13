import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SemanticTransactionTimeline } from "./SemanticTransactionTimeline";
import type { TraceStepResponse } from "../api/auditTrace";

const mockSteps: TraceStepResponse[] = [
  {
    id: "step-2",
    semantic_transaction_id: "txn-1",
    step_number: 2,
    step_type: "persist",
    message: "Saved record",
    created_at: "2025-06-01T10:00:02Z",
  },
  {
    id: "step-1",
    semantic_transaction_id: "txn-1",
    step_number: 1,
    step_type: "validate",
    message: "Validated input",
    created_at: "2025-06-01T10:00:01Z",
  },
];

describe("SemanticTransactionTimeline", () => {
  it("renders ordered trace steps", () => {
    render(<SemanticTransactionTimeline steps={mockSteps} />);

    const items = screen.getAllByText(/^Step \d$/);
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Step 1");
    expect(items[1]).toHaveTextContent("Step 2");
    expect(screen.getByText("Validated input")).toBeInTheDocument();
    expect(screen.getByText("Saved record")).toBeInTheDocument();
  });

  it("renders empty message when no steps", () => {
    render(<SemanticTransactionTimeline steps={[]} />);

    expect(screen.getByText("No trace steps recorded.")).toBeInTheDocument();
  });

  it("renders extended trace fields when present", () => {
    const extendedSteps: TraceStepResponse[] = [
      {
        id: "step-1",
        semantic_transaction_id: "txn-1",
        step_number: 1,
        step_type: "QuestionReceived",
        message: "User question received",
        created_at: "2025-06-01T10:00:01Z",
        layer: "Experience",
        status: "Completed",
        input_summary: "question=What is Invoice?",
        output_summary: "accepted",
        duration_ms: 15,
      },
    ];

    render(<SemanticTransactionTimeline steps={extendedSteps} />);

    expect(screen.getByText("Experience")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Input")).toBeInTheDocument();
    expect(screen.getByText("question=What is Invoice?")).toBeInTheDocument();
    expect(screen.getByText("Output")).toBeInTheDocument();
    expect(screen.getByText("accepted")).toBeInTheDocument();
    expect(screen.getByText("15 ms")).toBeInTheDocument();
  });
});

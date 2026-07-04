import type { TraceStepResponse } from "../api/auditTrace";

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

interface SemanticTransactionTimelineProps {
  steps: TraceStepResponse[];
}

export function SemanticTransactionTimeline({ steps }: SemanticTransactionTimelineProps) {
  if (steps.length === 0) {
    return <p className="semantic-transaction-timeline__empty">No trace steps recorded.</p>;
  }

  const orderedSteps = [...steps].sort((a, b) => a.step_number - b.step_number);

  return (
    <ol className="semantic-transaction-timeline" aria-label="Trace step timeline">
      {orderedSteps.map((step) => (
        <li key={step.id} className="semantic-transaction-timeline__item">
          <div className="semantic-transaction-timeline__header">
            <span className="semantic-transaction-timeline__step-number">
              Step {step.step_number}
            </span>
            <span className="semantic-transaction-timeline__type">{step.step_type}</span>
            <time className="semantic-transaction-timeline__time" dateTime={step.created_at}>
              {formatDate(step.created_at)}
            </time>
          </div>
          {step.message && (
            <p className="semantic-transaction-timeline__message">{step.message}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

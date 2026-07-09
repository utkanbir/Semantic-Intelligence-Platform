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
            {step.layer && (
              <span className="semantic-transaction-timeline__layer">{step.layer}</span>
            )}
            {step.status && (
              <span
                className={`semantic-transaction-timeline__status semantic-transaction-timeline__status--${step.status.toLowerCase()}`}
              >
                {step.status}
              </span>
            )}
            {step.duration_ms != null && (
              <span className="semantic-transaction-timeline__duration">
                {step.duration_ms} ms
              </span>
            )}
            <time className="semantic-transaction-timeline__time" dateTime={step.created_at}>
              {formatDate(step.created_at)}
            </time>
          </div>
          {(step.input_summary || step.output_summary) && (
            <dl className="semantic-transaction-timeline__io">
              {step.input_summary && (
                <>
                  <dt>Input</dt>
                  <dd>{step.input_summary}</dd>
                </>
              )}
              {step.output_summary && (
                <>
                  <dt>Output</dt>
                  <dd>{step.output_summary}</dd>
                </>
              )}
            </dl>
          )}
          {step.message && (
            <p className="semantic-transaction-timeline__message">{step.message}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

import { useEffect, useState } from "react";
import { ApiError } from "../api";
import {
  listAuditTraces,
  type SemanticTransactionResponse,
  type TraceStepResponse,
} from "../api/auditTrace";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; transactions: SemanticTransactionResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function TraceStepsSummary({ steps }: { steps: TraceStepResponse[] }) {
  if (steps.length === 0) {
    return <span>0</span>;
  }

  return (
    <details className="audit-trace-steps">
      <summary>{steps.length}</summary>
      <ol className="audit-trace-steps__list">
        {steps.map((step) => (
          <li key={step.id} className="audit-trace-steps__item">
            <span className="audit-trace-steps__type">{step.step_type}</span>
            {step.message && (
              <span className="audit-trace-steps__message">{step.message}</span>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

interface ApplicationAuditTracePageProps {
  applicationId: string;
}

export function ApplicationAuditTracePage({ applicationId }: ApplicationAuditTracePageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    listAuditTraces(applicationId)
      .then((transactions) => {
        if (!cancelled) {
          setState({ kind: "success", transactions });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load audit traces";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const isEmpty = state.kind === "success" && state.transactions.length === 0;
  const hasTransactions = state.kind === "success" && state.transactions.length > 0;

  return (
    <section className="agent-runs-page" aria-labelledby="application-audit-trace-heading">
      <div className="agent-runs-page__header">
        <div>
          <h2 id="application-audit-trace-heading">Audit trace</h2>
          <p className="agent-runs-page__lead">
            Semantic transactions recorded for this application.
          </p>
        </div>
      </div>

      {state.kind === "loading" && (
        <p className="agent-runs-page__status" role="status" aria-live="polite">
          Loading audit traces…
        </p>
      )}

      {state.kind === "error" && (
        <div className="agent-runs-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="agent-runs-page__empty" role="status">
          <p>No audit traces yet.</p>
        </div>
      )}

      {hasTransactions && (
        <div className="agent-runs-page__table-wrap">
          <table className="agent-runs-table">
            <thead>
              <tr>
                <th scope="col">Transaction type</th>
                <th scope="col">Resource type</th>
                <th scope="col">Trace steps</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {state.transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.transaction_type}</td>
                  <td>{transaction.resource_type}</td>
                  <td>
                    <TraceStepsSummary steps={transaction.trace_steps} />
                  </td>
                  <td>{formatDate(transaction.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

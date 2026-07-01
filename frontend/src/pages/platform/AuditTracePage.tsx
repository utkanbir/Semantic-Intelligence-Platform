import { FormEvent, useState } from "react";
import { ApiError } from "../../api";
import {
  listAuditTraces,
  type SemanticTransactionResponse,
  type TraceStepResponse,
} from "../../api/auditTrace";

type PageState =
  | { kind: "idle" }
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

export function AuditTracePage() {
  const [resourceId, setResourceId] = useState("");
  const [resourceIdError, setResourceIdError] = useState<string | null>(null);
  const [state, setState] = useState<PageState>({ kind: "idle" });

  async function loadTraces(id: string) {
    setState({ kind: "loading" });

    try {
      const transactions = await listAuditTraces(id);
      setState({ kind: "success", transactions });
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to load audit traces";
      setState({ kind: "error", message });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResourceIdError(null);

    const trimmedId = resourceId.trim();
    if (!trimmedId) {
      setResourceIdError("Resource ID is required");
      return;
    }

    void loadTraces(trimmedId);
  }

  const isEmpty = state.kind === "success" && state.transactions.length === 0;
  const hasTransactions = state.kind === "success" && state.transactions.length > 0;

  return (
    <section className="platform-page" aria-labelledby="audit-trace-heading">
      <h1 id="audit-trace-heading">Audit trace</h1>
      <p className="platform-page__lead">
        Browse semantic transactions and trace steps across the platform.
      </p>

      <form
        className="platform-page__filter-form"
        onSubmit={handleSubmit}
        aria-label="Load audit traces by resource ID"
      >
        <div className="platform-page__field">
          <label htmlFor="audit-trace-resource-id">Resource ID</label>
          <p className="platform-page__field-hint">
            Enter an application ID or other resource ID to list semantic transactions
          </p>
          <div className="platform-page__field-row">
            <input
              id="audit-trace-resource-id"
              name="resource_id"
              type="text"
              value={resourceId}
              onChange={(event) => {
                setResourceId(event.target.value);
                if (resourceIdError) {
                  setResourceIdError(null);
                }
              }}
              aria-invalid={resourceIdError ? true : undefined}
              aria-describedby={
                resourceIdError ? "audit-trace-resource-id-error" : undefined
              }
              disabled={state.kind === "loading"}
            />
            <button
              type="submit"
              className="platform-page__button platform-page__button--primary"
              disabled={state.kind === "loading"}
            >
              {state.kind === "loading" ? "Loading…" : "Load"}
            </button>
          </div>
          {resourceIdError && (
            <p
              id="audit-trace-resource-id-error"
              className="platform-page__field-error"
              role="alert"
            >
              {resourceIdError}
            </p>
          )}
        </div>
      </form>

      {state.kind === "loading" && (
        <p className="platform-page__status" role="status" aria-live="polite">
          Loading audit traces…
        </p>
      )}

      {state.kind === "error" && (
        <div className="platform-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="platform-page__empty" role="status">
          <p>No audit traces yet.</p>
        </div>
      )}

      {hasTransactions && (
        <div className="platform-page__table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th scope="col">Transaction type</th>
                <th scope="col">Resource type</th>
                <th scope="col">Resource ID</th>
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
                    <code className="platform-table__code">{transaction.resource_id}</code>
                  </td>
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

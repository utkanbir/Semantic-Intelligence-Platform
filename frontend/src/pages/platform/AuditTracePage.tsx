import { FormEvent, useState } from "react";
import { ApiError } from "../../api";
import {
  listAuditTraces,
  type SemanticTransactionResponse,
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
            : "Failed to load semantic transactions";
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
    <section className="platform-page" aria-labelledby="semantic-transactions-heading">
      <h1 id="semantic-transactions-heading">Semantic transactions</h1>
      <p className="platform-page__lead">
        Search platform-wide semantic transactions by resource ID. Each transaction records
        what changed and the ordered trace steps that executed.
      </p>

      <form
        className="platform-page__filter-form"
        onSubmit={handleSubmit}
        aria-label="Load semantic transactions by resource ID"
      >
        <div className="platform-page__field">
          <label htmlFor="semantic-transactions-resource-id">Resource ID</label>
          <p className="platform-page__field-hint">
            Enter an application ID or other resource ID to list related semantic transactions
          </p>
          <div className="platform-page__field-row">
            <input
              id="semantic-transactions-resource-id"
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
                resourceIdError ? "semantic-transactions-resource-id-error" : undefined
              }
              disabled={state.kind === "loading"}
            />
            <button
              type="submit"
              className="platform-page__button platform-page__button--primary"
              disabled={state.kind === "loading"}
            >
              {state.kind === "loading" ? "Loading…" : "Search"}
            </button>
          </div>
          {resourceIdError && (
            <p
              id="semantic-transactions-resource-id-error"
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
          Loading semantic transactions…
        </p>
      )}

      {state.kind === "error" && (
        <div className="platform-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="platform-page__empty" role="status">
          <p>No semantic transactions found for this resource ID.</p>
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
                  <td>{transaction.trace_steps.length}</td>
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

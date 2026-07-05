import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "../../api";
import {
  listSemanticTransactions,
  type SemanticTransactionListQuery,
  type SemanticTransactionResponse,
} from "../../api/auditTrace";

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

export function SemanticTransactionsPage() {
  const [resourceId, setResourceId] = useState("");
  const [appliedResourceId, setAppliedResourceId] = useState<string | undefined>();
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const query: SemanticTransactionListQuery = {};
    if (appliedResourceId) {
      query.resourceId = appliedResourceId;
    }

    setState({ kind: "loading" });

    listSemanticTransactions(query)
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
                : "Failed to load semantic transactions";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appliedResourceId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedId = resourceId.trim();
    setAppliedResourceId(trimmedId || undefined);
  }

  const isEmpty = state.kind === "success" && state.transactions.length === 0;
  const hasTransactions = state.kind === "success" && state.transactions.length > 0;

  return (
    <section className="platform-page" aria-labelledby="semantic-transactions-heading">
      <h1 id="semantic-transactions-heading">Semantic transactions</h1>
      <p className="platform-page__lead">
        Review ontology semantic lineage across the platform — how meaning evolved through
        ontology create, import, update, and publication flows.
      </p>
      <p className="platform-page__field-hint">
        Product, discovery, connector, and other operational records appear under Audit trace,
        not here.
      </p>

      <form
        className="platform-page__filter-form"
        onSubmit={handleSubmit}
        aria-label="Refine semantic transactions"
      >
        <div className="platform-page__field">
          <label htmlFor="semantic-transactions-resource-id">Resource ID</label>
          <p className="platform-page__field-hint">
            Optional: narrow the list to a known ontology resource ID
          </p>
          <div className="platform-page__field-row">
            <input
              id="semantic-transactions-resource-id"
              name="resource_id"
              type="text"
              value={resourceId}
              onChange={(event) => {
                setResourceId(event.target.value);
              }}
              disabled={state.kind === "loading"}
            />
            <button
              type="submit"
              className="platform-page__button platform-page__button--primary"
              disabled={state.kind === "loading"}
            >
              {state.kind === "loading" ? "Loading…" : "Apply filters"}
            </button>
          </div>
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
          <p>No ontology semantic transactions found yet.</p>
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

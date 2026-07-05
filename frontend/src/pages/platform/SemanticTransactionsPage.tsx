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

interface SemanticTransactionFilters {
  ontologyOnly: boolean;
  resourceId?: string;
}

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
  const [filters, setFilters] = useState<SemanticTransactionFilters>({ ontologyOnly: true });
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const query = buildSemanticTransactionQuery(filters);

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
  }, [filters]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedId = resourceId.trim();
    setFilters((current) => ({
      ...current,
      resourceId: trimmedId || undefined,
    }));
  }

  function buildSemanticTransactionQuery(
    nextFilters: SemanticTransactionFilters,
  ): SemanticTransactionListQuery {
    const query: SemanticTransactionListQuery = nextFilters.ontologyOnly
      ? { resourceType: "OntologyDefinition" }
      : {};

    if (nextFilters.resourceId) {
      query.resourceId = nextFilters.resourceId;
    }

    return query;
  }

  const isEmpty = state.kind === "success" && state.transactions.length === 0;
  const hasTransactions = state.kind === "success" && state.transactions.length > 0;

  return (
    <section className="platform-page" aria-labelledby="semantic-transactions-heading">
      <h1 id="semantic-transactions-heading">Semantic transactions</h1>
      <p className="platform-page__lead">
        Review semantic lineage across the platform — how meaning evolved for ontologies,
        products, agents, and related semantic assets.
      </p>
      <p className="platform-page__field-hint">
        Connector provisioning and other operational audit events appear under Audit trace,
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
            Optional: narrow the list to a known semantic asset resource ID
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
        <label className="platform-page__field-hint">
          <input
            type="checkbox"
            checked={filters.ontologyOnly}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                ontologyOnly: event.target.checked,
              }))
            }
            disabled={state.kind === "loading"}
          />{" "}
          Show ontology semantic lineage only
        </label>
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
          <p>No semantic transactions found yet.</p>
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

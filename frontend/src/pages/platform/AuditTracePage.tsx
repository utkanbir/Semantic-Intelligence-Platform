import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "../../api";
import {
  listAuditTraces,
  type AuditTraceListQuery,
  type SemanticTransactionResponse,
} from "../../api/auditTrace";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; transactions: SemanticTransactionResponse[] };

interface AuditTraceFilters {
  ontologyOnly: boolean;
  resourceId?: string;
}

const ONTOLOGY_ACTIVITY_FILTERS = {
  resourceType: "OntologyDefinition",
  transactionTypePrefix: "ontology",
} as const;

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
  const [filters, setFilters] = useState<AuditTraceFilters>({ ontologyOnly: true });
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const query = buildAuditTraceQuery(filters);

    setState({ kind: "loading" });

    listAuditTraces(query)
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

  function buildAuditTraceQuery(nextFilters: AuditTraceFilters): AuditTraceListQuery {
    const query: AuditTraceListQuery = nextFilters.ontologyOnly
      ? { ...ONTOLOGY_ACTIVITY_FILTERS }
      : {};

    if (nextFilters.resourceId) {
      query.resourceId = nextFilters.resourceId;
    }

    return query;
  }

  function getLoadingMessage(): string {
    return filters.ontologyOnly
      ? "Loading ontology semantic transactions…"
      : "Loading semantic transactions…";
  }

  function getEmptyMessage(): string {
    if (filters.ontologyOnly && filters.resourceId) {
      return "No ontology-related semantic transactions found for this resource.";
    }
    if (filters.ontologyOnly) {
      return "No ontology-related semantic transactions found yet.";
    }
    if (filters.resourceId) {
      return "No semantic transactions found for this resource.";
    }
    return "No semantic transactions found yet.";
  }

  function getPageTitle(): string {
    return filters.ontologyOnly ? "Ontology semantic transactions" : "Semantic transactions";
  }

  function getLeadMessage(): string {
    return filters.ontologyOnly
      ? "Start with the latest ontology-related semantic transactions across the platform, then refine the list with a resource ID when you need a narrower view."
      : "Review the latest semantic transactions across the platform, then refine the list with a resource ID when you need a narrower view.";
  }

  function getResourceHint(): string {
    return filters.ontologyOnly
      ? "Optional: narrow the current list to a known ontology or related resource ID"
      : "Optional: narrow the current list to a known resource ID";
  }

  const isEmpty = state.kind === "success" && state.transactions.length === 0;
  const hasTransactions = state.kind === "success" && state.transactions.length > 0;

  return (
    <section className="platform-page" aria-labelledby="semantic-transactions-heading">
      <h1 id="semantic-transactions-heading">{getPageTitle()}</h1>
      <p className="platform-page__lead">{getLeadMessage()}</p>
      <p className="platform-page__field-hint">
        This page focuses on semantic transactions and their trace steps. Not every audit event
        appears here.
      </p>

      <form
        className="platform-page__filter-form"
        onSubmit={handleSubmit}
        aria-label="Refine semantic transactions"
      >
        <div className="platform-page__field">
          <label htmlFor="semantic-transactions-resource-id">Resource ID</label>
          <p className="platform-page__field-hint">{getResourceHint()}</p>
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
          Show ontology activity only
        </label>
      </form>

      {state.kind === "loading" && (
        <p className="platform-page__status" role="status" aria-live="polite">
          {getLoadingMessage()}
        </p>
      )}

      {state.kind === "error" && (
        <div className="platform-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="platform-page__empty" role="status">
          <p>{getEmptyMessage()}</p>
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

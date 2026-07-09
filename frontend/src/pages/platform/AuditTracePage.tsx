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

type TraceAudienceFilter = AuditTraceListQuery["traceAudience"] | "all";

interface AuditTraceFilters {
  traceAudience: TraceAudienceFilter;
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

export function AuditTracePage() {
  const [resourceId, setResourceId] = useState("");
  const [filters, setFilters] = useState<AuditTraceFilters>({ traceAudience: "all" });
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
                : "Failed to load audit trace records";
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
    const query: AuditTraceListQuery = {};

    if (nextFilters.traceAudience !== "all") {
      query.traceAudience = nextFilters.traceAudience;
    }
    if (nextFilters.resourceId) {
      query.resourceId = nextFilters.resourceId;
    }

    return query;
  }

  const isEmpty = state.kind === "success" && state.transactions.length === 0;
  const hasTransactions = state.kind === "success" && state.transactions.length > 0;

  return (
    <section className="platform-page" aria-labelledby="audit-trace-heading">
      <h1 id="audit-trace-heading">Audit trace</h1>
      <p className="platform-page__lead">
        Explore operational and platform trace records, including connector provisioning and
        workspace events. Semantic lineage lives on the Semantic transactions page.
      </p>

      <form
        className="platform-page__filter-form"
        onSubmit={handleSubmit}
        aria-label="Refine audit trace records"
      >
        <div className="platform-page__field">
          <label htmlFor="audit-trace-audience">Trace audience</label>
          <select
            id="audit-trace-audience"
            value={filters.traceAudience}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                traceAudience: event.target.value as TraceAudienceFilter,
              }))
            }
            disabled={state.kind === "loading"}
          >
            <option value="all">All trace records</option>
            <option value="operational_audit">Operational audit</option>
            <option value="platform_provisioning">Platform provisioning</option>
            <option value="semantic_lineage">Semantic lineage</option>
          </select>
        </div>
        <div className="platform-page__field">
          <label htmlFor="audit-trace-resource-id">Resource ID</label>
          <p className="platform-page__field-hint">
            Optional: narrow the list to a known resource ID
          </p>
          <div className="platform-page__field-row">
            <input
              id="audit-trace-resource-id"
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
          Loading audit trace records…
        </p>
      )}

      {state.kind === "error" && (
        <div className="platform-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="platform-page__empty" role="status">
          <p>No audit trace records found yet.</p>
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

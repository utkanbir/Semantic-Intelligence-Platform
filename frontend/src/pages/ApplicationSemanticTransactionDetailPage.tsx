import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import {
  getSemanticTransaction,
  type SemanticTransactionResponse,
} from "../api/auditTrace";
import { SemanticTransactionTimeline } from "../components/SemanticTransactionTimeline";

type PageState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | { kind: "success"; transaction: SemanticTransactionResponse };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

interface ApplicationSemanticTransactionDetailPageProps {
  applicationId: string;
  transactionId: string;
}

export function ApplicationSemanticTransactionDetailPage({
  applicationId,
  transactionId,
}: ApplicationSemanticTransactionDetailPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    setState({ kind: "loading" });

    getSemanticTransaction(transactionId)
      .then((transaction) => {
        if (!cancelled) {
          if (
            transaction.application_id &&
            transaction.application_id !== applicationId
          ) {
            setState({ kind: "not-found" });
            return;
          }
          setState({ kind: "success", transaction });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 404) {
            setState({ kind: "not-found" });
            return;
          }
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load semantic transaction";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, transactionId]);

  const backHref = `/applications/${applicationId}/semantic-transactions`;

  return (
    <section
      className="agent-runs-page"
      aria-labelledby="semantic-transaction-detail-heading"
    >
      <div className="agent-runs-page__header">
        <div>
          <Link to={backHref} className="agent-run-detail__back">
            ← Back to semantic transactions
          </Link>
          <h2 id="semantic-transaction-detail-heading">Semantic transaction detail</h2>
          <p className="agent-runs-page__lead">
            Transaction <code className="agent-runs-table__id">{transactionId}</code>
          </p>
        </div>
      </div>

      {state.kind === "loading" && (
        <p className="agent-runs-page__status" role="status" aria-live="polite">
          Loading semantic transaction…
        </p>
      )}

      {state.kind === "not-found" && (
        <div className="agent-runs-page__empty" role="status">
          <p>Semantic transaction not found.</p>
          <p className="agent-runs-page__hint">
            <Link to={backHref}>Return to semantic transactions</Link>
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <div className="agent-runs-page__error" role="alert">
          {state.message}
        </div>
      )}

      {state.kind === "success" && (
        <>
          <dl className="application-overview__details agent-run-detail__meta">
            <div className="application-overview__row">
              <dt>Transaction type</dt>
              <dd>{state.transaction.transaction_type}</dd>
            </div>
            <div className="application-overview__row">
              <dt>Resource type</dt>
              <dd>{state.transaction.resource_type}</dd>
            </div>
            <div className="application-overview__row">
              <dt>Resource ID</dt>
              <dd>
                <code>{state.transaction.resource_id}</code>
              </dd>
            </div>
            <div className="application-overview__row">
              <dt>Created</dt>
              <dd>{formatDate(state.transaction.created_at)}</dd>
            </div>
          </dl>

          <h3 className="application-overview__subheading">Trace steps</h3>
          <SemanticTransactionTimeline steps={state.transaction.trace_steps} />
        </>
      )}
    </section>
  );
}

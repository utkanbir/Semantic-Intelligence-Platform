import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import {
  listApplicationSemanticTransactions,
  type SemanticTransactionResponse,
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

interface ApplicationSemanticTransactionsPageProps {
  applicationId: string;
}

export function ApplicationSemanticTransactionsPage({
  applicationId,
}: ApplicationSemanticTransactionsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    listApplicationSemanticTransactions(applicationId)
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
  }, [applicationId]);

  const isEmpty = state.kind === "success" && state.transactions.length === 0;
  const hasTransactions = state.kind === "success" && state.transactions.length > 0;

  return (
    <section
      className="agent-runs-page"
      aria-labelledby="application-semantic-transactions-heading"
    >
      <div className="agent-runs-page__header">
        <div>
          <h2 id="application-semantic-transactions-heading">Semantic transactions</h2>
          <p className="agent-runs-page__lead">
            Ontology semantic lineage for this application.
          </p>
        </div>
      </div>

      {state.kind === "loading" && (
        <p className="agent-runs-page__status" role="status" aria-live="polite">
          Loading semantic transactions…
        </p>
      )}

      {state.kind === "error" && (
        <div className="agent-runs-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="agent-runs-page__empty" role="status">
          <p>No ontology semantic transactions yet.</p>
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
                  <td>
                    <Link
                      to={`/applications/${applicationId}/semantic-transactions/${transaction.id}`}
                      className="agent-runs-table__link"
                    >
                      {transaction.transaction_type}
                    </Link>
                  </td>
                  <td>{transaction.resource_type}</td>
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

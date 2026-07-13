import { Link } from "react-router-dom";
import type { SemanticTransactionResponse } from "../api/auditTrace";
import { SemanticTransactionTimeline } from "./SemanticTransactionTimeline";

interface SemanticTransactionTracePanelProps {
  applicationId: string;
  transaction: SemanticTransactionResponse | null;
  loading?: boolean;
}

function statusClassName(status: string): string {
  return `semantic-trace-panel__status semantic-trace-panel__status--${status.toLowerCase()}`;
}

function formatParticipatingAssetLabel(key: string): string {
  if (key === "ontology_id") {
    return "Ontology ID";
  }
  if (key === "ontology_title") {
    return "Ontology";
  }
  if (key === "llm_provider") {
    return "LLM provider";
  }
  return key.replace(/_/g, " ");
}

export function SemanticTransactionTracePanel({
  applicationId,
  transaction,
  loading = false,
}: SemanticTransactionTracePanelProps) {
  if (loading) {
    return (
      <aside className="semantic-trace-panel" aria-label="Semantic transaction trace">
        <h3 className="semantic-trace-panel__title">Semantic transaction trace</h3>
        <p className="semantic-trace-panel__status-text" role="status" aria-live="polite">
          Loading trace…
        </p>
      </aside>
    );
  }

  if (!transaction) {
    return (
      <aside className="semantic-trace-panel" aria-label="Semantic transaction trace">
        <h3 className="semantic-trace-panel__title">Semantic transaction trace</h3>
        <p className="semantic-trace-panel__empty">
          Ask a question to see the live semantic transaction trace.
        </p>
      </aside>
    );
  }

  const participatingAssets = transaction.participating_assets ?? {};
  const assetEntries = Object.entries(participatingAssets);

  return (
    <aside className="semantic-trace-panel" aria-label="Semantic transaction trace">
      <h3 className="semantic-trace-panel__title">Semantic transaction trace</h3>

      <dl className="semantic-trace-panel__meta">
        <div className="semantic-trace-panel__meta-row">
          <dt>Transaction ID</dt>
          <dd>
            <Link
              to={`/applications/${applicationId}/semantic-transactions/${transaction.id}`}
              className="semantic-trace-panel__link"
            >
              <code>{transaction.id}</code>
            </Link>
          </dd>
        </div>
        {transaction.status && (
          <div className="semantic-trace-panel__meta-row">
            <dt>Status</dt>
            <dd>
              <span className={statusClassName(transaction.status)}>{transaction.status}</span>
            </dd>
          </div>
        )}
        {transaction.initiated_by && (
          <div className="semantic-trace-panel__meta-row">
            <dt>Initiated by</dt>
            <dd>{transaction.initiated_by}</dd>
          </div>
        )}
      </dl>

      {assetEntries.length > 0 && (
        <>
          <h4 className="semantic-trace-panel__subheading">Participating assets</h4>
          <dl className="semantic-trace-panel__meta">
            {assetEntries.map(([key, value]) => (
              <div key={key} className="semantic-trace-panel__meta-row">
                <dt>{formatParticipatingAssetLabel(key)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <h4 className="semantic-trace-panel__subheading">Trace steps</h4>
      <SemanticTransactionTimeline steps={transaction.trace_steps} />
    </aside>
  );
}

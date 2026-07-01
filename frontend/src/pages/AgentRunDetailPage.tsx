import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import { getAgentRun, type AgentRunResponse } from "../api/agentRuns";

type PageState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | { kind: "success"; run: AgentRunResponse };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: AgentRunResponse["status"]): string {
  return `agent-runs-table__status agent-runs-table__status--${status.toLowerCase()}`;
}

function formatJson(value: Record<string, unknown> | null): string {
  if (value === null) {
    return "null";
  }
  return JSON.stringify(value, null, 2);
}

interface AgentRunDetailPageProps {
  applicationId: string;
  runId: string;
}

export function AgentRunDetailPage({ applicationId, runId }: AgentRunDetailPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    setState({ kind: "loading" });

    getAgentRun(runId)
      .then((run) => {
        if (!cancelled) {
          if (run.application_id !== applicationId) {
            setState({ kind: "not-found" });
            return;
          }
          setState({ kind: "success", run });
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
                : "Failed to load agent run";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, runId]);

  const backHref = `/applications/${applicationId}/agent-runs`;

  return (
    <section className="agent-runs-page" aria-labelledby="agent-run-detail-heading">
      <div className="agent-runs-page__header">
        <div>
          <Link to={backHref} className="agent-run-detail__back">
            ← Back to agent runs
          </Link>
          <h2 id="agent-run-detail-heading">Agent run detail</h2>
          <p className="agent-runs-page__lead">
            Run <code className="agent-runs-table__id">{runId}</code>
          </p>
        </div>
      </div>

      {state.kind === "loading" && (
        <p className="agent-runs-page__status" role="status" aria-live="polite">
          Loading agent run…
        </p>
      )}

      {state.kind === "not-found" && (
        <div className="agent-runs-page__empty" role="status">
          <p>Agent run not found.</p>
          <p className="agent-runs-page__hint">
            <Link to={backHref}>Return to agent runs</Link>
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
              <dt>Status</dt>
              <dd>
                <span className={statusClassName(state.run.status)}>{state.run.status}</span>
              </dd>
            </div>
            <div className="application-overview__row">
              <dt>Agent definition</dt>
              <dd>
                <code>{state.run.agent_definition_id}</code>
              </dd>
            </div>
            <div className="application-overview__row">
              <dt>Created by</dt>
              <dd>{state.run.created_by || "—"}</dd>
            </div>
            <div className="application-overview__row">
              <dt>Created</dt>
              <dd>{formatDate(state.run.created_at)}</dd>
            </div>
            <div className="application-overview__row">
              <dt>Updated</dt>
              <dd>{formatDate(state.run.updated_at)}</dd>
            </div>
            <div className="application-overview__row">
              <dt>Started</dt>
              <dd>{formatDate(state.run.started_at)}</dd>
            </div>
            <div className="application-overview__row">
              <dt>Completed</dt>
              <dd>{formatDate(state.run.completed_at)}</dd>
            </div>
          </dl>

          <h3 className="application-overview__subheading">Run payload</h3>
          <pre className="agent-run-detail__json">{formatJson(state.run.run_payload)}</pre>

          <h3 className="application-overview__subheading">Run result</h3>
          <pre className="agent-run-detail__json">{formatJson(state.run.run_result)}</pre>
        </>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { ApiError } from "../api";
import { listAgentRuns, type AgentRunResponse } from "../api/agentRuns";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; runs: AgentRunResponse[] };

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

interface AgentRunsPageProps {
  applicationId: string;
}

export function AgentRunsPage({ applicationId }: AgentRunsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    listAgentRuns(applicationId)
      .then((runs) => {
        if (!cancelled) {
          setState({ kind: "success", runs });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load agent runs";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const isEmpty = state.kind === "success" && state.runs.length === 0;
  const hasRuns = state.kind === "success" && state.runs.length > 0;

  return (
    <section className="agent-runs-page" aria-labelledby="agent-runs-heading">
      <div className="agent-runs-page__header">
        <div>
          <h2 id="agent-runs-heading">Agent runs</h2>
          <p className="agent-runs-page__lead">
            Execution history for agent definitions in this application workspace.
          </p>
        </div>
      </div>

      {state.kind === "loading" && (
        <p className="agent-runs-page__status" role="status" aria-live="polite">
          Loading agent runs…
        </p>
      )}

      {state.kind === "error" && (
        <div className="agent-runs-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="agent-runs-page__empty" role="status">
          <p>No agent runs yet.</p>
          <p className="agent-runs-page__hint">
            Trigger an agent run to see execution history here.
          </p>
        </div>
      )}

      {hasRuns && (
        <div className="agent-runs-page__table-wrap">
          <table className="agent-runs-table">
            <thead>
              <tr>
                <th scope="col">Run ID</th>
                <th scope="col">Agent definition</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {state.runs.map((run) => (
                <tr key={run.id}>
                  <td>
                    <code className="agent-runs-table__id">{run.id}</code>
                  </td>
                  <td>
                    <code className="agent-runs-table__id">{run.agent_definition_id}</code>
                  </td>
                  <td>
                    <span className={statusClassName(run.status)}>{run.status}</span>
                  </td>
                  <td>{formatDate(run.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

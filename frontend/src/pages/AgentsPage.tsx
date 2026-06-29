import { useEffect, useState } from "react";
import { ApiError } from "../api";
import { listAgents, type AgentDefinitionResponse } from "../api/agents";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; agents: AgentDefinitionResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: AgentDefinitionResponse["status"]): string {
  return `agents-table__status agents-table__status--${status.toLowerCase()}`;
}

interface AgentsPageProps {
  applicationId: string;
}

export function AgentsPage({ applicationId }: AgentsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    listAgents(applicationId)
      .then((agents) => {
        if (!cancelled) {
          setState({ kind: "success", agents });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load agents";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  return (
    <section className="agents-page" aria-labelledby="agents-heading">
      <h2 id="agents-heading">Agents</h2>
      <p className="agents-page__lead">
        Agent definitions bind to published data products and drive runtime
        execution in the semantic intelligence lifecycle.
      </p>

      {state.kind === "loading" && (
        <p className="agents-page__status" role="status" aria-live="polite">
          Loading agents…
        </p>
      )}

      {state.kind === "error" && (
        <div className="agents-page__error" role="alert">
          {state.message}
        </div>
      )}

      {state.kind === "success" && state.agents.length === 0 && (
        <div className="agents-page__empty" role="status">
          <p>No agent definitions yet.</p>
          <p className="agents-page__hint">
            Create an agent via the API to see it listed here.
          </p>
        </div>
      )}

      {state.kind === "success" && state.agents.length > 0 && (
        <div className="agents-page__table-wrap">
          <table className="agents-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Version</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {state.agents.map((agent) => (
                <tr key={agent.id}>
                  <td>{agent.title}</td>
                  <td>
                    <span className={statusClassName(agent.status)}>{agent.status}</span>
                  </td>
                  <td>{agent.version_number}</td>
                  <td>{formatDate(agent.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

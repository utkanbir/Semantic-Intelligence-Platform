import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import { listAgents, type AgentDefinitionResponse } from "../api/agents";
import {
  listAgentRuns,
  startAgentRun,
  type AgentRunResponse,
} from "../api/agentRuns";

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

function isRunnableAgent(agent: AgentDefinitionResponse): boolean {
  return agent.status === "Active" && agent.bound_product_ids.length > 0;
}

interface TriggerFormFields {
  agent_definition_id: string;
  message: string;
  created_by: string;
}

interface AgentRunTriggerFormProps {
  applicationId: string;
  runnableAgents: AgentDefinitionResponse[];
  onTriggered: () => void;
}

function AgentRunTriggerForm({
  applicationId,
  runnableAgents,
  onTriggered,
}: AgentRunTriggerFormProps) {
  const [fields, setFields] = useState<TriggerFormFields>({
    agent_definition_id: "",
    message: "",
    created_by: "",
  });
  const [agentError, setAgentError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!fields.agent_definition_id) {
      setAgentError("Select an active agent");
      return;
    }
    setAgentError(null);

    const trimmedMessage = fields.message.trim();
    if (!trimmedMessage) {
      setMessageError("Question is required");
      return;
    }
    setMessageError(null);

    setSubmitting(true);
    try {
      const createdBy = fields.created_by.trim();
      await startAgentRun({
        application_id: applicationId,
        agent_definition_id: fields.agent_definition_id,
        run_payload: { message: trimmedMessage },
        ...(createdBy ? { created_by: createdBy } : {}),
      });
      setFields((current) => ({
        ...current,
        message: "",
        created_by: "",
      }));
      onTriggered();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to start agent run";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="agent-runs-page__form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Trigger agent run"
    >
      <div className="agent-runs-page__field">
        <label htmlFor="agent-run-agent">Active agent</label>
        {runnableAgents.length === 0 ? (
          <p className="agent-runs-page__field-hint">
            No Active agents with bound products are available to run.
          </p>
        ) : (
          <select
            id="agent-run-agent"
            name="agent_definition_id"
            value={fields.agent_definition_id}
            onChange={(event) => {
              setFields((current) => ({
                ...current,
                agent_definition_id: event.target.value,
              }));
              if (agentError) {
                setAgentError(null);
              }
            }}
            aria-invalid={agentError ? true : undefined}
            aria-describedby={agentError ? "agent-run-agent-error" : undefined}
            disabled={submitting}
          >
            <option value="">Select an agent…</option>
            {runnableAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.title}
              </option>
            ))}
          </select>
        )}
        {agentError && (
          <p id="agent-run-agent-error" className="agent-runs-page__field-error" role="alert">
            {agentError}
          </p>
        )}
      </div>

      <div className="agent-runs-page__field">
        <label htmlFor="agent-run-message">Stub question</label>
        <input
          id="agent-run-message"
          name="message"
          type="text"
          value={fields.message}
          onChange={(event) => {
            setFields((current) => ({ ...current, message: event.target.value }));
            if (messageError) {
              setMessageError(null);
            }
          }}
          aria-invalid={messageError ? true : undefined}
          aria-describedby={messageError ? "agent-run-message-error" : undefined}
          disabled={submitting}
        />
        {messageError && (
          <p id="agent-run-message-error" className="agent-runs-page__field-error" role="alert">
            {messageError}
          </p>
        )}
      </div>

      <div className="agent-runs-page__field">
        <label htmlFor="agent-run-created-by">
          Created by <span className="agent-runs-page__optional">(optional)</span>
        </label>
        <input
          id="agent-run-created-by"
          name="created_by"
          type="text"
          value={fields.created_by}
          onChange={(event) =>
            setFields((current) => ({ ...current, created_by: event.target.value }))
          }
          disabled={submitting}
        />
      </div>

      {submitError && (
        <div className="agent-runs-page__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="agent-runs-page__form-actions">
        <button
          type="submit"
          className="agent-runs-page__button agent-runs-page__button--primary"
          disabled={submitting || runnableAgents.length === 0}
        >
          {submitting ? "Starting…" : "Start run"}
        </button>
      </div>
    </form>
  );
}

interface AgentRunsPageProps {
  applicationId: string;
}

export function AgentRunsPage({ applicationId }: AgentRunsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [runnableAgents, setRunnableAgents] = useState<AgentDefinitionResponse[]>([]);

  const loadRuns = useCallback(() => {
    setState({ kind: "loading" });

    return listAgentRuns(applicationId)
      .then((runs) => {
        setState({ kind: "success", runs });
        return runs;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load agent runs";
        setState({ kind: "error", message });
        throw error;
      });
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;

    void listAgents(applicationId)
      .then((agents) => {
        if (!cancelled) {
          setRunnableAgents(agents.filter(isRunnableAgent));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRunnableAgents([]);
        }
      });

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

  function handleTriggered() {
    void loadRuns();
  }

  const isEmpty = state.kind === "success" && state.runs.length === 0;
  const hasRuns = state.kind === "success" && state.runs.length > 0;
  const showTriggerForm = state.kind !== "error";

  const sortedRunnableAgents = useMemo(
    () => [...runnableAgents].sort((a, b) => a.title.localeCompare(b.title)),
    [runnableAgents],
  );

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

      {showTriggerForm && (
        <div className="agent-runs-page__trigger-panel">
          <h3 className="agent-runs-page__trigger-title">Trigger agent run</h3>
          <AgentRunTriggerForm
            applicationId={applicationId}
            runnableAgents={sortedRunnableAgents}
            onTriggered={handleTriggered}
          />
        </div>
      )}

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
                    <Link
                      to={`/applications/${applicationId}/agent-runs/${run.id}`}
                      className="agent-runs-table__link"
                    >
                      <code className="agent-runs-table__id">{run.id}</code>
                    </Link>
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

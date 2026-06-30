import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../api";
import {
  createAgent,
  listAgents,
  type AgentDefinitionResponse,
} from "../api/agents";

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

interface CreateFormFields {
  title: string;
  description: string;
  created_by: string;
}

interface AgentCreateFormProps {
  applicationId: string;
  onCreated: () => void;
  onCancel?: () => void;
}

function AgentCreateForm({ applicationId, onCreated, onCancel }: AgentCreateFormProps) {
  const [fields, setFields] = useState<CreateFormFields>({
    title: "",
    description: "",
    created_by: "",
  });
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const trimmedTitle = fields.title.trim();
    if (!trimmedTitle) {
      setTitleError("Title is required");
      return;
    }
    setTitleError(null);

    setSubmitting(true);
    try {
      const description = fields.description.trim();
      const createdBy = fields.created_by.trim();
      await createAgent({
        application_id: applicationId,
        title: trimmedTitle,
        agent_definition: {},
        ...(description ? { description } : {}),
        ...(createdBy ? { created_by: createdBy } : {}),
      });
      onCreated();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create agent";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="agents-page__form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Create agent"
    >
      <div className="agents-page__field">
        <label htmlFor="agent-title">Title</label>
        <input
          id="agent-title"
          name="title"
          type="text"
          value={fields.title}
          onChange={(event) => {
            setFields((current) => ({ ...current, title: event.target.value }));
            if (titleError) {
              setTitleError(null);
            }
          }}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "agent-title-error" : undefined}
        />
        {titleError && (
          <p id="agent-title-error" className="agents-page__field-error" role="alert">
            {titleError}
          </p>
        )}
      </div>

      <div className="agents-page__field">
        <label htmlFor="agent-description">
          Description <span className="agents-page__optional">(optional)</span>
        </label>
        <textarea
          id="agent-description"
          name="description"
          rows={3}
          value={fields.description}
          onChange={(event) =>
            setFields((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>

      <div className="agents-page__field">
        <label htmlFor="agent-created-by">
          Created by <span className="agents-page__optional">(optional)</span>
        </label>
        <input
          id="agent-created-by"
          name="created_by"
          type="text"
          value={fields.created_by}
          onChange={(event) =>
            setFields((current) => ({ ...current, created_by: event.target.value }))
          }
        />
      </div>

      {submitError && (
        <div className="agents-page__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="agents-page__form-actions">
        {onCancel && (
          <button
            type="button"
            className="agents-page__button agents-page__button--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="agents-page__button agents-page__button--primary"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create agent"}
        </button>
      </div>
    </form>
  );
}

interface AgentsPageProps {
  applicationId: string;
}

export function AgentsPage({ applicationId }: AgentsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadAgents = useCallback(() => {
    setState({ kind: "loading" });

    return listAgents(applicationId)
      .then((agents) => {
        setState({ kind: "success", agents });
        return agents;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load agents";
        setState({ kind: "error", message });
        throw error;
      });
  }, [applicationId]);

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

  function handleCreated() {
    setShowCreateForm(false);
    void loadAgents();
  }

  const isEmpty = state.kind === "success" && state.agents.length === 0;
  const hasAgents = state.kind === "success" && state.agents.length > 0;

  return (
    <section className="agents-page" aria-labelledby="agents-heading">
      <div className="agents-page__header">
        <div>
          <h2 id="agents-heading">Agents</h2>
          <p className="agents-page__lead">
            Agent definitions bind to published data products and drive runtime
            execution in the semantic intelligence lifecycle.
          </p>
        </div>
        {hasAgents && !showCreateForm && (
          <button
            type="button"
            className="agents-page__button agents-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New agent
          </button>
        )}
      </div>

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

      {isEmpty && (
        <div className="agents-page__empty" role="status">
          <p>No agent definitions yet.</p>
          <p className="agents-page__hint">
            Create your first agent definition to get started.
          </p>
          <AgentCreateForm applicationId={applicationId} onCreated={handleCreated} />
        </div>
      )}

      {hasAgents && showCreateForm && (
        <div className="agents-page__create-panel">
          <h3 className="agents-page__create-title">New agent</h3>
          <AgentCreateForm
            applicationId={applicationId}
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {hasAgents && (
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

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../api";
import {
  createDiscoverySession,
  getDiscoveryStatusActionLabel,
  getNextDiscoveryStatuses,
  listDiscoverySessions,
  updateDiscoverySessionStatus,
  type DiscoverySessionResponse,
  type DiscoverySessionStatus,
} from "../api/discovery";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; sessions: DiscoverySessionResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatPhase(session: DiscoverySessionResponse): string {
  const phase = session.current_phase;
  if (!phase) {
    return "—";
  }
  return `${phase.phase_number}. ${phase.phase_name}`;
}

function statusClassName(status: DiscoverySessionResponse["status"]): string {
  return `discovery-table__status discovery-table__status--${status.toLowerCase()}`;
}

interface CreateFormFields {
  title: string;
  started_by: string;
}

interface DiscoveryCreateFormProps {
  applicationId: string;
  onCreated: () => void;
  onCancel?: () => void;
}

function DiscoveryCreateForm({
  applicationId,
  onCreated,
  onCancel,
}: DiscoveryCreateFormProps) {
  const [fields, setFields] = useState<CreateFormFields>({
    title: "",
    started_by: "",
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
      const startedBy = fields.started_by.trim();
      await createDiscoverySession({
        application_id: applicationId,
        title: trimmedTitle,
        ...(startedBy ? { started_by: startedBy } : {}),
      });
      onCreated();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create discovery session";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="discovery-page__form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Create discovery session"
    >
      <div className="discovery-page__field">
        <label htmlFor="discovery-title">Title</label>
        <input
          id="discovery-title"
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
          aria-describedby={titleError ? "discovery-title-error" : undefined}
        />
        {titleError && (
          <p id="discovery-title-error" className="discovery-page__field-error" role="alert">
            {titleError}
          </p>
        )}
      </div>

      <div className="discovery-page__field">
        <label htmlFor="discovery-started-by">
          Started by <span className="discovery-page__optional">(optional)</span>
        </label>
        <input
          id="discovery-started-by"
          name="started_by"
          type="text"
          value={fields.started_by}
          onChange={(event) =>
            setFields((current) => ({ ...current, started_by: event.target.value }))
          }
        />
      </div>

      {submitError && (
        <div className="discovery-page__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="discovery-page__form-actions">
        {onCancel && (
          <button
            type="button"
            className="discovery-page__button discovery-page__button--secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="discovery-page__button discovery-page__button--primary"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create session"}
        </button>
      </div>
    </form>
  );
}

interface DiscoveryPageProps {
  applicationId: string;
}

export function DiscoveryPage({ applicationId }: DiscoveryPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  const loadSessions = useCallback(() => {
    setState({ kind: "loading" });

    return listDiscoverySessions(applicationId)
      .then((sessions) => {
        setState({ kind: "success", sessions });
        return sessions;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load discovery sessions";
        setState({ kind: "error", message });
        throw error;
      });
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;

    listDiscoverySessions(applicationId)
      .then((sessions) => {
        if (!cancelled) {
          setState({ kind: "success", sessions });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load discovery sessions";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  function handleCreated() {
    setShowCreateForm(false);
    void loadSessions();
  }

  async function handleStatusTransition(
    sessionId: string,
    nextStatus: DiscoverySessionStatus,
  ) {
    setActionError(null);
    setPendingSessionId(sessionId);
    try {
      await updateDiscoverySessionStatus(sessionId, nextStatus);
      await loadSessions();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update discovery session status";
      setActionError(message);
    } finally {
      setPendingSessionId(null);
    }
  }

  const isEmpty = state.kind === "success" && state.sessions.length === 0;
  const hasSessions = state.kind === "success" && state.sessions.length > 0;

  return (
    <section className="discovery-page" aria-labelledby="discovery-heading">
      <div className="discovery-page__header">
        <div>
          <h2 id="discovery-heading">Discovery</h2>
          <p className="discovery-page__lead">
            Discovery sessions capture intent, requirements, and recommendations before
            blueprint generation.
          </p>
        </div>
        {hasSessions && !showCreateForm && (
          <button
            type="button"
            className="discovery-page__button discovery-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New session
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <p className="discovery-page__status" role="status" aria-live="polite">
          Loading discovery sessions…
        </p>
      )}

      {state.kind === "error" && (
        <div className="discovery-page__error" role="alert">
          {state.message}
        </div>
      )}

      {actionError && (
        <div className="discovery-page__error discovery-page__action-error" role="alert">
          {actionError}
        </div>
      )}

      {isEmpty && (
        <div className="discovery-page__empty" role="status">
          <p>No discovery sessions yet.</p>
          <p className="discovery-page__hint">
            Create your first discovery session to get started.
          </p>
          <DiscoveryCreateForm applicationId={applicationId} onCreated={handleCreated} />
        </div>
      )}

      {hasSessions && showCreateForm && (
        <div className="discovery-page__create-panel">
          <h3 className="discovery-page__create-title">New discovery session</h3>
          <DiscoveryCreateForm
            applicationId={applicationId}
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}

      {hasSessions && (
        <div className="discovery-page__table-wrap">
          <table className="discovery-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Current phase</th>
                <th scope="col">Started by</th>
                <th scope="col">Started</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.sessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.title}</td>
                  <td>
                    <span className={statusClassName(session.status)}>
                      {session.status}
                    </span>
                  </td>
                  <td>{formatPhase(session)}</td>
                  <td>{session.started_by || "—"}</td>
                  <td>{formatDate(session.started_at)}</td>
                  <td>
                    <div className="discovery-table__actions">
                      {getNextDiscoveryStatuses(session.status).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          className="discovery-page__button discovery-page__button--secondary discovery-table__action"
                          disabled={pendingSessionId === session.id}
                          onClick={() =>
                            void handleStatusTransition(session.id, nextStatus)
                          }
                        >
                          {getDiscoveryStatusActionLabel(nextStatus)}
                        </button>
                      ))}
                      {getNextDiscoveryStatuses(session.status).length === 0 && (
                        <span className="discovery-table__no-actions">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

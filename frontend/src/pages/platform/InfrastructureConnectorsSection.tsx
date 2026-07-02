import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api";
import {
  createAdapter,
  getAdapterStatusActionLabel,
  getNextAdapterStatuses,
  listAdapters,
  pingAdapter,
  TECHNOLOGY_TYPES,
  updateAdapterStatus,
  canPingAdapter,
  type TechnologyAdapterResponse,
  type TechnologyAdapterStatus,
  type TechnologyType,
} from "../../api/adapters";

type SectionState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; connectors: TechnologyAdapterResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: TechnologyAdapterResponse["status"]): string {
  return `platform-table__status platform-table__status--${status.toLowerCase()}`;
}

interface CreateFormFields {
  technology_type: TechnologyType;
  connector_key: string;
  title: string;
  description: string;
  created_by: string;
}

function InfrastructureConnectorCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel?: () => void;
}) {
  const [fields, setFields] = useState<CreateFormFields>({
    technology_type: "postgresql",
    connector_key: "",
    title: "",
    description: "",
    created_by: "",
  });
  const [titleError, setTitleError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
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

    const trimmedKey = fields.connector_key.trim();
    if (!trimmedKey) {
      setKeyError("Connector key is required");
      return;
    }
    setKeyError(null);

    setSubmitting(true);
    try {
      const description = fields.description.trim();
      const createdBy = fields.created_by.trim();
      await createAdapter({
        technology_type: fields.technology_type,
        adapter_key: trimmedKey,
        title: trimmedTitle,
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
            : "Failed to create connector";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="platform-page__create-form"
      onSubmit={(event) => void handleSubmit(event)}
      aria-label="Create infrastructure connector"
    >
      <div className="platform-page__field">
        <label htmlFor="infra-connector-type">Connector type</label>
        <select
          id="infra-connector-type"
          value={fields.technology_type}
          onChange={(event) =>
            setFields((current) => ({
              ...current,
              technology_type: event.target.value as TechnologyType,
            }))
          }
          disabled={submitting}
        >
          {TECHNOLOGY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="platform-page__field">
        <label htmlFor="infra-connector-key">Connector key</label>
        <input
          id="infra-connector-key"
          value={fields.connector_key}
          onChange={(event) => {
            setFields((current) => ({ ...current, connector_key: event.target.value }));
            if (keyError) {
              setKeyError(null);
            }
          }}
          aria-invalid={keyError ? true : undefined}
        />
        {keyError && (
          <p className="platform-page__field-error" role="alert">
            {keyError}
          </p>
        )}
      </div>

      <div className="platform-page__field">
        <label htmlFor="infra-connector-title">Title</label>
        <input
          id="infra-connector-title"
          value={fields.title}
          onChange={(event) => {
            setFields((current) => ({ ...current, title: event.target.value }));
            if (titleError) {
              setTitleError(null);
            }
          }}
          aria-invalid={titleError ? true : undefined}
        />
        {titleError && (
          <p className="platform-page__field-error" role="alert">
            {titleError}
          </p>
        )}
      </div>

      <div className="platform-page__field">
        <label htmlFor="infra-connector-description">
          Description <span className="platform-page__optional">(optional)</span>
        </label>
        <textarea
          id="infra-connector-description"
          rows={3}
          value={fields.description}
          onChange={(event) =>
            setFields((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>

      <div className="platform-page__field">
        <label htmlFor="infra-connector-created-by">
          Created by <span className="platform-page__optional">(optional)</span>
        </label>
        <input
          id="infra-connector-created-by"
          value={fields.created_by}
          onChange={(event) =>
            setFields((current) => ({ ...current, created_by: event.target.value }))
          }
        />
      </div>

      {submitError && (
        <div className="platform-page__error" role="alert">
          {submitError}
        </div>
      )}

      <div className="platform-page__form-actions">
        {onCancel && (
          <button type="button" className="platform-page__button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="platform-page__button platform-page__button--primary"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create connector"}
        </button>
      </div>
    </form>
  );
}

export function InfrastructureConnectorsSection() {
  const [state, setState] = useState<SectionState>({ kind: "loading" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadConnectors = useCallback((options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setState({ kind: "loading" });
    }
    return listAdapters()
      .then((connectors) => {
        setState({ kind: "success", connectors });
        return connectors;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load infrastructure connectors";
        setState({ kind: "error", message });
        throw error;
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    listAdapters()
      .then((connectors) => {
        if (!cancelled) {
          setState({ kind: "success", connectors });
          if (connectors.length === 0) {
            setShowCreateForm(true);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load infrastructure connectors";
          setState({ kind: "error", message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated() {
    setShowCreateForm(false);
    void loadConnectors({ silent: true });
  }

  async function handleStatusTransition(connectorId: string, nextStatus: TechnologyAdapterStatus) {
    setActionError(null);
    setPendingId(connectorId);
    try {
      await updateAdapterStatus(connectorId, nextStatus);
      await loadConnectors();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update connector status";
      setActionError(message);
    } finally {
      setPendingId(null);
    }
  }

  async function handlePing(connectorId: string) {
    setActionError(null);
    setPendingId(connectorId);
    try {
      const result = await pingAdapter(connectorId);
      setPingResults((current) => ({
        ...current,
        [connectorId]: `${result.status} (${result.technology})`,
      }));
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to ping connector";
      setActionError(message);
    } finally {
      setPendingId(null);
    }
  }

  const isEmpty = state.kind === "success" && state.connectors.length === 0;
  const hasConnectors = state.kind === "success" && state.connectors.length > 0;

  return (
    <section className="connectors-page__section" aria-labelledby="infra-connectors-heading">
      <div className="connectors-page__section-header">
        <div>
          <h2 id="infra-connectors-heading">Infrastructure connectors</h2>
          <p className="platform-page__hint">
            Database, object storage, vector store, and other technology endpoints.
          </p>
        </div>
        {state.kind === "success" && !showCreateForm && (
          <button
            type="button"
            className="platform-page__button platform-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New infrastructure connector
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <p className="platform-page__status" role="status">
          Loading infrastructure connectors…
        </p>
      )}

      {state.kind === "error" && (
        <div className="platform-page__error" role="alert">
          {state.message}
        </div>
      )}

      {actionError && (
        <div className="platform-page__error platform-page__action-error" role="alert">
          {actionError}
        </div>
      )}

      {isEmpty && (
        <div className="platform-page__empty" role="status">
          <p>No infrastructure connectors yet.</p>
          {!showCreateForm && (
            <button
              type="button"
              className="platform-page__button platform-page__button--primary platform-page__empty-action"
              onClick={() => setShowCreateForm(true)}
            >
              Create connector
            </button>
          )}
        </div>
      )}

      {showCreateForm && (
        <div className="platform-page__create-panel">
          <h3 className="platform-page__create-title">New infrastructure connector</h3>
          <InfrastructureConnectorCreateForm
            onCreated={handleCreated}
            onCancel={isEmpty ? undefined : () => setShowCreateForm(false)}
          />
        </div>
      )}

      {hasConnectors && (
        <div className="platform-page__table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Type</th>
                <th scope="col">Key</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.connectors.map((connector) => (
                <tr key={connector.id}>
                  <td>{connector.title}</td>
                  <td>
                    <code className="platform-table__code">{connector.technology_type}</code>
                  </td>
                  <td>
                    <code className="platform-table__code">{connector.adapter_key}</code>
                  </td>
                  <td>
                    <span className={statusClassName(connector.status)}>{connector.status}</span>
                    {pingResults[connector.id] && (
                      <span className="platform-table__ping-result">
                        Ping: {pingResults[connector.id]}
                      </span>
                    )}
                  </td>
                  <td>{formatDate(connector.created_at)}</td>
                  <td>
                    <div className="platform-table__actions">
                      {canPingAdapter(connector) && (
                        <button
                          type="button"
                          className="platform-page__button platform-table__action"
                          disabled={pendingId === connector.id}
                          onClick={() => void handlePing(connector.id)}
                        >
                          Ping
                        </button>
                      )}
                      {getNextAdapterStatuses(connector.status).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          className="platform-page__button platform-table__action"
                          disabled={pendingId === connector.id}
                          onClick={() => void handleStatusTransition(connector.id, nextStatus)}
                        >
                          {getAdapterStatusActionLabel(nextStatus)}
                        </button>
                      ))}
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

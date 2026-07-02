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

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; adapters: TechnologyAdapterResponse[] };

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
  adapter_key: string;
  title: string;
  description: string;
  created_by: string;
}

interface AdapterCreateFormProps {
  onCreated: () => void;
  onCancel?: () => void;
}

function AdapterCreateForm({ onCreated, onCancel }: AdapterCreateFormProps) {
  const [fields, setFields] = useState<CreateFormFields>({
    technology_type: "postgresql",
    adapter_key: "",
    title: "",
    description: "",
    created_by: "",
  });
  const [titleError, setTitleError] = useState<string | null>(null);
  const [adapterKeyError, setAdapterKeyError] = useState<string | null>(null);
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

    const trimmedKey = fields.adapter_key.trim();
    if (!trimmedKey) {
      setAdapterKeyError("Adapter key is required");
      return;
    }
    setAdapterKeyError(null);

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
            : "Failed to create adapter";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="platform-page__create-form"
      onSubmit={(event) => void handleSubmit(event)}
      aria-label="Create adapter"
    >
      <div className="platform-page__field">
        <label htmlFor="adapter-technology-type">Technology type</label>
        <select
          id="adapter-technology-type"
          name="technology_type"
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
        <label htmlFor="adapter-key">Adapter key</label>
        <input
          id="adapter-key"
          name="adapter_key"
          type="text"
          value={fields.adapter_key}
          onChange={(event) => {
            setFields((current) => ({ ...current, adapter_key: event.target.value }));
            if (adapterKeyError) {
              setAdapterKeyError(null);
            }
          }}
          aria-invalid={adapterKeyError ? true : undefined}
          aria-describedby={adapterKeyError ? "adapter-key-error" : undefined}
        />
        {adapterKeyError && (
          <p id="adapter-key-error" className="platform-page__field-error" role="alert">
            {adapterKeyError}
          </p>
        )}
      </div>

      <div className="platform-page__field">
        <label htmlFor="adapter-title">Title</label>
        <input
          id="adapter-title"
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
          aria-describedby={titleError ? "adapter-title-error" : undefined}
        />
        {titleError && (
          <p id="adapter-title-error" className="platform-page__field-error" role="alert">
            {titleError}
          </p>
        )}
      </div>

      <div className="platform-page__field">
        <label htmlFor="adapter-description">
          Description <span className="platform-page__optional">(optional)</span>
        </label>
        <textarea
          id="adapter-description"
          name="description"
          rows={3}
          value={fields.description}
          onChange={(event) =>
            setFields((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>

      <div className="platform-page__field">
        <label htmlFor="adapter-created-by">
          Created by <span className="platform-page__optional">(optional)</span>
        </label>
        <input
          id="adapter-created-by"
          name="created_by"
          type="text"
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
          <button
            type="button"
            className="platform-page__button"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="platform-page__button platform-page__button--primary"
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create adapter"}
        </button>
      </div>
    </form>
  );
}

export function AdaptersPage() {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, string>>({});
  const [pendingAdapterId, setPendingAdapterId] = useState<string | null>(null);

  const loadAdapters = useCallback(() => {
    setState({ kind: "loading" });

    return listAdapters()
      .then((adapters) => {
        setState({ kind: "success", adapters });
        return adapters;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load adapters";
        setState({ kind: "error", message });
        throw error;
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    listAdapters()
      .then((adapters) => {
        if (!cancelled) {
          setState({ kind: "success", adapters });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load adapters";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated() {
    setShowCreateForm(false);
    void loadAdapters();
  }

  async function handleStatusTransition(adapterId: string, nextStatus: TechnologyAdapterStatus) {
    setActionError(null);
    setPendingAdapterId(adapterId);
    try {
      await updateAdapterStatus(adapterId, nextStatus);
      await loadAdapters();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update adapter status";
      setActionError(message);
    } finally {
      setPendingAdapterId(null);
    }
  }

  async function handlePing(adapterId: string) {
    setActionError(null);
    setPendingAdapterId(adapterId);
    try {
      const result = await pingAdapter(adapterId);
      setPingResults((current) => ({
        ...current,
        [adapterId]: `${result.status} (${result.technology})`,
      }));
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to ping adapter";
      setActionError(message);
    } finally {
      setPendingAdapterId(null);
    }
  }

  const isEmpty = state.kind === "success" && state.adapters.length === 0;
  const hasAdapters = state.kind === "success" && state.adapters.length > 0;

  return (
    <section className="platform-page" aria-labelledby="adapters-heading">
      <div className="platform-page__header">
        <div>
          <h1 id="adapters-heading">Adapters</h1>
          <p className="platform-page__lead">
            Configure and monitor technology adapters that connect the platform to
            external systems.
          </p>
        </div>
        {hasAdapters && !showCreateForm && (
          <button
            type="button"
            className="platform-page__button platform-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New adapter
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <p className="platform-page__status" role="status" aria-live="polite">
          Loading adapters…
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
          <p>No adapters yet.</p>
          <p className="platform-page__hint">Create your first technology adapter to get started.</p>
          <AdapterCreateForm onCreated={handleCreated} />
        </div>
      )}

      {hasAdapters && showCreateForm && (
        <div className="platform-page__create-panel">
          <h2 className="platform-page__create-title">New adapter</h2>
          <AdapterCreateForm onCreated={handleCreated} onCancel={() => setShowCreateForm(false)} />
        </div>
      )}

      {hasAdapters && (
        <div className="platform-page__table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Technology</th>
                <th scope="col">Adapter key</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.adapters.map((adapter) => (
                <tr key={adapter.id}>
                  <td>{adapter.title}</td>
                  <td>
                    <code className="platform-table__code">{adapter.technology_type}</code>
                  </td>
                  <td>
                    <code className="platform-table__code">{adapter.adapter_key}</code>
                  </td>
                  <td>
                    <span className={statusClassName(adapter.status)}>{adapter.status}</span>
                    {pingResults[adapter.id] && (
                      <span className="platform-table__ping-result">
                        Ping: {pingResults[adapter.id]}
                      </span>
                    )}
                  </td>
                  <td>{formatDate(adapter.created_at)}</td>
                  <td>
                    <div className="platform-table__actions">
                      {canPingAdapter(adapter) && (
                        <button
                          type="button"
                          className="platform-page__button platform-table__action"
                          disabled={pendingAdapterId === adapter.id}
                          onClick={() => void handlePing(adapter.id)}
                        >
                          Ping
                        </button>
                      )}
                      {getNextAdapterStatuses(adapter.status).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          className="platform-page__button platform-table__action"
                          disabled={pendingAdapterId === adapter.id}
                          onClick={() => void handleStatusTransition(adapter.id, nextStatus)}
                        >
                          {getAdapterStatusActionLabel(nextStatus)}
                        </button>
                      ))}
                      {getNextAdapterStatuses(adapter.status).length === 0 &&
                        !canPingAdapter(adapter) && (
                          <span className="platform-table__no-actions">—</span>
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

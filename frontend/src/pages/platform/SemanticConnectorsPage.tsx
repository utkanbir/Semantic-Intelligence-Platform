import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api";
import { listAdapters, type TechnologyAdapterResponse } from "../../api/adapters";
import {
  createSemanticConnector,
  listSemanticConnectors,
  SEMANTIC_CONNECTOR_TYPES,
  type SemanticConnectorResponse,
  type SemanticConnectorType,
} from "../../api/semanticConnectors";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; connectors: SemanticConnectorResponse[] };

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

interface CreateFormFields {
  connector_type: SemanticConnectorType;
  connector_key: string;
  title: string;
  technology_adapter_id: string;
  description: string;
  created_by: string;
}

function SemanticConnectorCreateForm({
  adapters,
  onCreated,
  onCancel,
}: {
  adapters: TechnologyAdapterResponse[];
  onCreated: () => void;
  onCancel?: () => void;
}) {
  const activeAdapters = adapters.filter((adapter) => adapter.status === "Active");
  const [fields, setFields] = useState<CreateFormFields>({
    connector_type: "ontology_store",
    connector_key: "",
    title: "",
    technology_adapter_id: activeAdapters[0]?.id ?? "",
    description: "",
    created_by: "",
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    const trimmedTitle = fields.title.trim();
    const trimmedKey = fields.connector_key.trim();
    if (!trimmedTitle || !trimmedKey || !fields.technology_adapter_id) {
      setSubmitError("Title, connector key, and adapter are required");
      return;
    }

    setSubmitting(true);
    try {
      const description = fields.description.trim();
      const createdBy = fields.created_by.trim();
      await createSemanticConnector({
        connector_type: fields.connector_type,
        connector_key: trimmedKey,
        title: trimmedTitle,
        technology_adapter_id: fields.technology_adapter_id,
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
            : "Failed to create semantic connector";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="platform-page__create-form"
      onSubmit={(event) => void handleSubmit(event)}
      aria-label="Create semantic connector"
    >
      <div className="platform-page__field">
        <label htmlFor="connector-type">Connector type</label>
        <select
          id="connector-type"
          value={fields.connector_type}
          onChange={(event) =>
            setFields((current) => ({
              ...current,
              connector_type: event.target.value as SemanticConnectorType,
            }))
          }
        >
          {SEMANTIC_CONNECTOR_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="platform-page__field">
        <label htmlFor="connector-key">Connector key</label>
        <input
          id="connector-key"
          value={fields.connector_key}
          onChange={(event) =>
            setFields((current) => ({ ...current, connector_key: event.target.value }))
          }
        />
      </div>
      <div className="platform-page__field">
        <label htmlFor="connector-title">Title</label>
        <input
          id="connector-title"
          value={fields.title}
          onChange={(event) =>
            setFields((current) => ({ ...current, title: event.target.value }))
          }
        />
      </div>
      <div className="platform-page__field">
        <label htmlFor="connector-adapter">Technology adapter (Active)</label>
        <select
          id="connector-adapter"
          value={fields.technology_adapter_id}
          onChange={(event) =>
            setFields((current) => ({
              ...current,
              technology_adapter_id: event.target.value,
            }))
          }
        >
          {activeAdapters.length === 0 ? (
            <option value="">No active adapters</option>
          ) : (
            activeAdapters.map((adapter) => (
              <option key={adapter.id} value={adapter.id}>
                {adapter.title} ({adapter.technology_type})
              </option>
            ))
          )}
        </select>
      </div>
      <div className="platform-page__field">
        <label htmlFor="connector-description">Description</label>
        <textarea
          id="connector-description"
          value={fields.description}
          onChange={(event) =>
            setFields((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>
      <div className="platform-page__field">
        <label htmlFor="connector-created-by">Created by</label>
        <input
          id="connector-created-by"
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
        <button type="submit" disabled={submitting || activeAdapters.length === 0}>
          {submitting ? "Creating…" : "Create connector"}
        </button>
        {onCancel && (
          <button type="button" className="platform-page__secondary-button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function SemanticConnectorsPage() {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [adapters, setAdapters] = useState<TechnologyAdapterResponse[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadConnectors = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [connectors, adapterList] = await Promise.all([
        listSemanticConnectors(),
        listAdapters(),
      ]);
      setAdapters(adapterList);
      setState({ kind: "success", connectors });
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to load semantic connectors";
      setState({ kind: "error", message });
    }
  }, []);

  useEffect(() => {
    void loadConnectors();
  }, [loadConnectors]);

  const isEmpty = state.kind === "success" && state.connectors.length === 0;
  const hasConnectors = state.kind === "success" && state.connectors.length > 0;

  return (
    <section className="platform-page" aria-labelledby="semantic-connectors-heading">
      <div className="platform-page__header">
        <div>
          <h1 id="semantic-connectors-heading">Semantic Connectors</h1>
          <p className="platform-page__lead">
            Platform connectors for ontology storage and knowledge graph backends.
          </p>
        </div>
        {state.kind === "success" && !showCreateForm && (
          <button type="button" onClick={() => setShowCreateForm(true)}>
            New connector
          </button>
        )}
      </div>

      {showCreateForm && (
        <SemanticConnectorCreateForm
          adapters={adapters}
          onCreated={() => {
            setShowCreateForm(false);
            void loadConnectors();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {state.kind === "loading" && (
        <p className="platform-page__status" role="status">
          Loading semantic connectors…
        </p>
      )}

      {state.kind === "error" && (
        <div className="platform-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="platform-page__empty" role="status">
          <p>No semantic connectors yet. Create one bound to an Active technology adapter.</p>
        </div>
      )}

      {hasConnectors && (
        <div className="platform-page__table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Key</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {state.connectors.map((connector) => (
                <tr key={connector.id}>
                  <td>{connector.title}</td>
                  <td>
                    <code>{connector.connector_key}</code>
                  </td>
                  <td>{connector.connector_type}</td>
                  <td>{connector.status}</td>
                  <td>{formatDate(connector.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

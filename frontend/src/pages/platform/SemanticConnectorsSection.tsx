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

type SectionState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; connectors: SemanticConnectorResponse[] };

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function SemanticConnectorCreateForm({
  infrastructureConnectors,
  onCreated,
  onCancel,
}: {
  infrastructureConnectors: TechnologyAdapterResponse[];
  onCreated: () => void;
  onCancel?: () => void;
}) {
  const activeConnectors = infrastructureConnectors.filter(
    (connector) => connector.status === "Active",
  );
  const [fields, setFields] = useState({
    connector_type: "ontology_store" as SemanticConnectorType,
    connector_key: "",
    title: "",
    technology_adapter_id: activeConnectors[0]?.id ?? "",
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
      setSubmitError("Title, connector key, and infrastructure connector are required");
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
        <label htmlFor="semantic-connector-type">Semantic role</label>
        <select
          id="semantic-connector-type"
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
        <label htmlFor="semantic-connector-key">Connector key</label>
        <input
          id="semantic-connector-key"
          value={fields.connector_key}
          onChange={(event) =>
            setFields((current) => ({ ...current, connector_key: event.target.value }))
          }
        />
      </div>
      <div className="platform-page__field">
        <label htmlFor="semantic-connector-title">Title</label>
        <input
          id="semantic-connector-title"
          value={fields.title}
          onChange={(event) =>
            setFields((current) => ({ ...current, title: event.target.value }))
          }
        />
      </div>
      <div className="platform-page__field">
        <label htmlFor="semantic-connector-infra">Infrastructure connector (Active)</label>
        <select
          id="semantic-connector-infra"
          value={fields.technology_adapter_id}
          onChange={(event) =>
            setFields((current) => ({
              ...current,
              technology_adapter_id: event.target.value,
            }))
          }
        >
          {activeConnectors.length === 0 ? (
            <option value="">No active infrastructure connectors</option>
          ) : (
            activeConnectors.map((connector) => (
              <option key={connector.id} value={connector.id}>
                {connector.title} ({connector.technology_type})
              </option>
            ))
          )}
        </select>
      </div>
      <div className="platform-page__field">
        <label htmlFor="semantic-connector-description">Description</label>
        <textarea
          id="semantic-connector-description"
          value={fields.description}
          onChange={(event) =>
            setFields((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>
      <div className="platform-page__field">
        <label htmlFor="semantic-connector-created-by">Created by</label>
        <input
          id="semantic-connector-created-by"
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
        <button type="submit" disabled={submitting || activeConnectors.length === 0}>
          {submitting ? "Creating…" : "Create connector"}
        </button>
        {onCancel && (
          <button type="button" className="platform-page__button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function SemanticConnectorsSection() {
  const [state, setState] = useState<SectionState>({ kind: "loading" });
  const [infrastructureConnectors, setInfrastructureConnectors] = useState<
    TechnologyAdapterResponse[]
  >([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadConnectors = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [connectors, infraList] = await Promise.all([
        listSemanticConnectors(),
        listAdapters(),
      ]);
      setInfrastructureConnectors(infraList);
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
    <section className="connectors-page__section" aria-labelledby="semantic-connectors-heading">
      <div className="connectors-page__section-header">
        <div>
          <h2 id="semantic-connectors-heading">Semantic connectors</h2>
          <p className="platform-page__hint">
            Ontology store and knowledge graph roles bound to active infrastructure connectors.
          </p>
        </div>
        {state.kind === "success" && !showCreateForm && (
          <button
            type="button"
            className="platform-page__button platform-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New semantic connector
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="platform-page__create-panel">
          <h3 className="platform-page__create-title">New semantic connector</h3>
          <SemanticConnectorCreateForm
            infrastructureConnectors={infrastructureConnectors}
            onCreated={() => {
              setShowCreateForm(false);
              void loadConnectors();
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
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

      {isEmpty && !showCreateForm && (
        <div className="platform-page__empty" role="status">
          <p>
            No semantic connectors yet. Create an Active MinIO or Fuseki infrastructure connector
            first, then bind an ontology_store or knowledge_graph_store role here.
          </p>
        </div>
      )}

      {hasConnectors && (
        <div className="platform-page__table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Key</th>
                <th scope="col">Semantic role</th>
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

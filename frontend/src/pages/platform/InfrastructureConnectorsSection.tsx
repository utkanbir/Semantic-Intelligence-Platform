import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api";
import {
  CONNECTOR_TYPE_LABELS,
  CONNECTOR_TYPES,
  createConnector,
  getConnectorStatusActionLabel,
  getNextConnectorStatuses,
  listConnectors,
  pingConnector,
  provisionConnector,
  updateConnectorStatus,
  canPingConnector,
  type ConnectorProvisionResponse,
  type ConnectorResponse,
  type ConnectorStatus,
  type ConnectorType,
} from "../../api/adapters";
import {
  buildConnectorConfiguration,
  getConnectionFields,
  getDefaultVendor,
  getVendorLabel,
  readConnectorVendor,
  VENDORS_BY_CONNECTOR_TYPE,
  type ConnectionMethod,
} from "../../connectors/catalog";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; connectors: ConnectorResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: ConnectorResponse["status"]): string {
  return `platform-table__status platform-table__status--${status.toLowerCase()}`;
}

interface CreateFormFields {
  connector_type: ConnectorType;
  vendor: string;
  connection_method: ConnectionMethod;
  connection: Record<string, string>;
  connector_key: string;
  title: string;
  description: string;
  created_by: string;
}

function emptyConnectionValues(vendor: string): Record<string, string> {
  return Object.fromEntries(getConnectionFields(vendor).map((field) => [field.id, ""]));
}

function ConnectorCreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (provisionResult?: ConnectorProvisionResponse) => void;
  onCancel?: () => void;
}) {
  const initialVendor = getDefaultVendor("database");
  const [fields, setFields] = useState<CreateFormFields>({
    connector_type: "database",
    vendor: initialVendor,
    connection_method: "existing_instance",
    connection: emptyConnectionValues(initialVendor),
    connector_key: "",
    title: "",
    description: "",
    created_by: "",
  });
  const [titleError, setTitleError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const vendors = VENDORS_BY_CONNECTOR_TYPE[fields.connector_type];
  const connectionFields = useMemo(
    () => getConnectionFields(fields.vendor),
    [fields.vendor],
  );

  function handleConnectorTypeChange(connectorType: ConnectorType) {
    const vendor = getDefaultVendor(connectorType);
    setFields((current) => ({
      ...current,
      connector_type: connectorType,
      vendor,
      connection: emptyConnectionValues(vendor),
    }));
    setConnectionError(null);
  }

  function handleVendorChange(vendor: string) {
    setFields((current) => ({
      ...current,
      vendor,
      connection: emptyConnectionValues(vendor),
    }));
    setConnectionError(null);
  }

  function handleConnectionChange(fieldId: string, value: string) {
    setFields((current) => ({
      ...current,
      connection: { ...current.connection, [fieldId]: value },
    }));
    if (connectionError) {
      setConnectionError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const isProvision = fields.connection_method === "provision_in_cluster";

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

    if (!isProvision) {
      const missingRequired = connectionFields.find(
        (field) => field.required && !fields.connection[field.id]?.trim(),
      );
      if (missingRequired) {
        setConnectionError(`${missingRequired.label} is required`);
        return;
      }
      setConnectionError(null);
    }

    const trimmedConnection = isProvision
      ? {}
      : Object.fromEntries(
          Object.entries(fields.connection).map(([key, value]) => [key, value.trim()]),
        );

    setSubmitting(true);
    try {
      const description = fields.description.trim();
      const createdBy = fields.created_by.trim();
      const created = await createConnector({
        connector_type: fields.connector_type,
        connector_key: trimmedKey,
        title: trimmedTitle,
        connector_configuration: buildConnectorConfiguration(
          fields.vendor,
          fields.connection_method,
          trimmedConnection,
        ),
        ...(description ? { description } : {}),
        ...(createdBy ? { created_by: createdBy } : {}),
      });
      if (isProvision) {
        const provisionResult = await provisionConnector(created.id);
        onCreated(provisionResult);
      } else {
        onCreated();
      }
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
      aria-label="Create connector"
    >
      <div className="platform-page__field">
        <label htmlFor="connector-type">Connector type</label>
        <select
          id="connector-type"
          value={fields.connector_type}
          onChange={(event) =>
            handleConnectorTypeChange(event.target.value as ConnectorType)
          }
          disabled={submitting}
        >
          {CONNECTOR_TYPES.map((type) => (
            <option key={type} value={type}>
              {CONNECTOR_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="platform-page__field">
        <label htmlFor="connector-vendor">Connector vendor</label>
        <select
          id="connector-vendor"
          value={fields.vendor}
          onChange={(event) => handleVendorChange(event.target.value)}
          disabled={submitting}
        >
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="platform-page__fieldset">
        <legend>Connection method</legend>
        <div className="platform-page__radio-group">
          <label htmlFor="connection-method-existing">
            <input
              id="connection-method-existing"
              type="radio"
              name="connection_method"
              value="existing_instance"
              checked={fields.connection_method === "existing_instance"}
              onChange={() =>
                setFields((current) => ({
                  ...current,
                  connection_method: "existing_instance",
                }))
              }
              disabled={submitting}
            />
            Connect to existing instance
          </label>
          <label htmlFor="connection-method-provision">
            <input
              id="connection-method-provision"
              type="radio"
              name="connection_method"
              value="provision_in_cluster"
              checked={fields.connection_method === "provision_in_cluster"}
              onChange={() =>
                setFields((current) => ({
                  ...current,
                  connection_method: "provision_in_cluster",
                }))
              }
              disabled={submitting}
            />
            Provision in cluster
          </label>
        </div>
      </fieldset>

      {fields.connection_method === "existing_instance" && (
        <div className="platform-page__create-panel platform-page__create-panel--nested">
          <h3 className="platform-page__create-subtitle">Connection details</h3>
          {connectionFields.map((field) => (
            <div className="platform-page__field" key={field.id}>
              <label htmlFor={`connection-${field.id}`}>
                {field.label}
                {!field.required && (
                  <span className="platform-page__optional"> (optional)</span>
                )}
              </label>
              <input
                id={`connection-${field.id}`}
                type={field.inputType ?? "text"}
                placeholder={field.placeholder}
                value={fields.connection[field.id] ?? ""}
                onChange={(event) => handleConnectionChange(field.id, event.target.value)}
                disabled={submitting}
              />
            </div>
          ))}
          {connectionError && (
            <p className="platform-page__field-error" role="alert">
              {connectionError}
            </p>
          )}
        </div>
      )}

      {fields.connection_method === "provision_in_cluster" && (
        <div className="platform-page__hint" role="status">
          A {getVendorLabel(fields.connector_type, fields.vendor)} instance will be provisioned in
          the cluster after you create the connector.
        </div>
      )}

      <div className="platform-page__field">
        <label htmlFor="connector-key">Connector key</label>
        <input
          id="connector-key"
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
        <label htmlFor="connector-title">Title</label>
        <input
          id="connector-title"
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
        <label htmlFor="connector-description">
          Description <span className="platform-page__optional">(optional)</span>
        </label>
        <textarea
          id="connector-description"
          rows={3}
          value={fields.description}
          onChange={(event) =>
            setFields((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>

      <div className="platform-page__field">
        <label htmlFor="connector-created-by">
          Created by <span className="platform-page__optional">(optional)</span>
        </label>
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
          {submitting
            ? fields.connection_method === "provision_in_cluster"
              ? "Provisioning…"
              : "Creating…"
            : "Create connector"}
        </button>
      </div>
    </form>
  );
}

export function ConnectorsSection() {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [provisionSuccess, setProvisionSuccess] = useState<ConnectorProvisionResponse | null>(
    null,
  );
  const [pingResults, setPingResults] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadConnectors = useCallback((options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setState({ kind: "loading" });
    }
    return listConnectors()
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
              : "Failed to load connectors";
        setState({ kind: "error", message });
        throw error;
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    listConnectors()
      .then((connectors) => {
        if (!cancelled) {
          setState({ kind: "success", connectors });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load connectors";
          setState({ kind: "error", message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreated(provisionResult?: ConnectorProvisionResponse) {
    setShowCreateForm(false);
    setProvisionSuccess(provisionResult ?? null);
    void loadConnectors({ silent: true });
  }

  async function handleStatusTransition(connectorId: string, nextStatus: ConnectorStatus) {
    setActionError(null);
    setPendingId(connectorId);
    try {
      await updateConnectorStatus(connectorId, nextStatus);
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
      const result = await pingConnector(connectorId);
      setPingResults((current) => ({
        ...current,
        [connectorId]: `${result.status} (${result.connector_type})`,
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
    <>
      {state.kind === "loading" && (
        <p className="platform-page__status" role="status">
          Loading connectors…
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

      {provisionSuccess && (
        <div className="platform-page__hint" role="status" aria-live="polite">
          Connector provisioned — status: <strong>{provisionSuccess.status}</strong>
          {provisionSuccess.endpoint && (
            <>
              {" "}
              · endpoint: <code className="platform-table__code">{provisionSuccess.endpoint}</code>
            </>
          )}
        </div>
      )}

      {isEmpty && (
        <div className="platform-page__empty" role="status">
          <p>No connectors yet.</p>
        </div>
      )}

      {hasConnectors && (
        <div className="platform-page__table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Type</th>
                <th scope="col">Vendor</th>
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
                    <code className="platform-table__code">
                      {CONNECTOR_TYPE_LABELS[connector.connector_type]}
                    </code>
                  </td>
                  <td>
                    {(() => {
                      const vendorId = readConnectorVendor(connector.connector_configuration);
                      return vendorId ? (
                        <code className="platform-table__code">
                          {getVendorLabel(connector.connector_type, vendorId)}
                        </code>
                      ) : (
                        "—"
                      );
                    })()}
                  </td>
                  <td>
                    <code className="platform-table__code">{connector.connector_key}</code>
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
                      {canPingConnector(connector) && (
                        <button
                          type="button"
                          className="platform-page__button platform-table__action"
                          disabled={pendingId === connector.id}
                          onClick={() => void handlePing(connector.id)}
                        >
                          Ping
                        </button>
                      )}
                      {getNextConnectorStatuses(connector.status).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          className="platform-page__button platform-table__action"
                          disabled={pendingId === connector.id}
                          onClick={() => void handleStatusTransition(connector.id, nextStatus)}
                        >
                          {getConnectorStatusActionLabel(nextStatus)}
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

      {state.kind === "success" && !showCreateForm && (
        <div className="connectors-page__section-actions">
          <button
            type="button"
            className="platform-page__button platform-page__button--primary"
            onClick={() => setShowCreateForm(true)}
          >
            New connector
          </button>
        </div>
      )}

      {showCreateForm && (
        <div className="platform-page__create-panel">
          <h2 className="platform-page__create-title">New connector</h2>
          <ConnectorCreateForm
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}
    </>
  );
}

/** @deprecated Use ConnectorsSection */
export const InfrastructureConnectorsSection = ConnectorsSection;

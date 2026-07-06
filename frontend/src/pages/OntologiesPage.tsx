import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import { listConnectors, type ConnectorResponse } from "../api/adapters";
import {
  canForkOntology,
  forkOntologyVersion,
  getNextOntologyStatuses,
  getOntologyStatusActionLabel,
  listOntologies,
  updateOntologyStatus,
  type OntologyDefinitionResponse,
  type OntologyDefinitionStatus,
} from "../api/ontologies";
import { getVendorLabel, readConnectorVendor } from "../connectors/catalog";
import { formatVersionChain } from "../utils/versionChain";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; ontologies: OntologyDefinitionResponse[] };

const LIFECYCLE_STEPS: OntologyDefinitionStatus[] = [
  "Draft",
  "Validated",
  "Approved",
  "Published",
  "Versioned",
];

const ONTOLOGY_MODES = [
  {
    id: "manual",
    title: "Manual",
    copy: "Define title, namespace, and prefix. A minimal ontology document is generated for materialization.",
    hrefSuffix: "?mode=manual",
    cta: "Start manual",
    enabled: true,
  },
  {
    id: "import",
    title: "OWL Import",
    copy: "Import existing OWL/RDF content from a file upload or pasted text.",
    hrefSuffix: "?mode=import",
    cta: "Import OWL",
    enabled: true,
  },
  {
    id: "document",
    title: "Document-assisted",
    copy: "Upload documents and extract concepts with LLM assistance.",
    hrefSuffix: "",
    cta: "Coming soon",
    enabled: false,
  },
  {
    id: "hybrid",
    title: "Hybrid",
    copy: "Combine manual edits with imported ontology fragments.",
    hrefSuffix: "",
    cta: "Coming soon",
    enabled: false,
  },
] as const;

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: OntologyDefinitionResponse["status"]): string {
  return `ontologies-table__status ontologies-table__status--${status.toLowerCase()}`;
}

function pickPrimaryOntology(
  ontologies: OntologyDefinitionResponse[],
): OntologyDefinitionResponse | null {
  if (ontologies.length === 0) {
    return null;
  }

  const active = ontologies.filter((ontology) => ontology.status !== "Retired");
  const pool = active.length > 0 ? active : ontologies;

  return pool.reduce((best, current) =>
    current.version_number > best.version_number ? current : best,
  );
}

function lifecycleStepState(
  step: OntologyDefinitionStatus,
  currentStatus: OntologyDefinitionStatus,
): "complete" | "current" | "upcoming" {
  if (currentStatus === "Retired") {
    return "complete";
  }

  const currentIndex = LIFECYCLE_STEPS.indexOf(currentStatus);
  const stepIndex = LIFECYCLE_STEPS.indexOf(step);

  if (stepIndex < currentIndex) {
    return "complete";
  }

  if (stepIndex === currentIndex) {
    return "current";
  }

  return "upcoming";
}

function formatConnectorSummary(connector: ConnectorResponse | undefined): string {
  if (!connector) {
    return "—";
  }

  const vendorId = readConnectorVendor(connector.connector_configuration);
  const vendorLabel = vendorId
    ? getVendorLabel(connector.connector_type, vendorId)
    : null;

  return vendorLabel ? `${connector.title} — ${vendorLabel}` : connector.title;
}

function truncateUri(uri: string, maxLength = 48): string {
  if (uri.length <= maxLength) {
    return uri;
  }

  return `${uri.slice(0, maxLength)}…`;
}

interface OntologiesPageProps {
  applicationId: string;
}

export function OntologiesPage({ applicationId }: OntologiesPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [connectors, setConnectors] = useState<ConnectorResponse[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingOntologyId, setPendingOntologyId] = useState<string | null>(null);

  const createBasePath = `/applications/${applicationId}/ontology/create`;

  const loadOntologies = useCallback(() => {
    setState({ kind: "loading" });

    return listOntologies(applicationId)
      .then((ontologies) => {
        setState({ kind: "success", ontologies });
        return ontologies;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load ontologies";
        setState({ kind: "error", message });
        throw error;
      });
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listOntologies(applicationId),
      listConnectors({ connectorType: "ontology_knowledge_graph" }),
    ])
      .then(([ontologies, connectorList]) => {
        if (!cancelled) {
          setConnectors(connectorList);
          setState({ kind: "success", ontologies });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load ontologies";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  async function handleStatusTransition(
    ontologyId: string,
    nextStatus: OntologyDefinitionStatus,
  ) {
    setActionError(null);
    setPendingOntologyId(ontologyId);
    try {
      await updateOntologyStatus(ontologyId, nextStatus);
      await loadOntologies();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update ontology status";
      setActionError(message);
    } finally {
      setPendingOntologyId(null);
    }
  }

  async function handleForkVersion(ontologyId: string) {
    setActionError(null);
    setPendingOntologyId(ontologyId);
    try {
      await forkOntologyVersion(ontologyId);
      await loadOntologies();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create ontology version";
      setActionError(message);
    } finally {
      setPendingOntologyId(null);
    }
  }

  const ontologies = state.kind === "success" ? state.ontologies : [];
  const primaryOntology = useMemo(() => pickPrimaryOntology(ontologies), [ontologies]);
  const historyOntologies = useMemo(() => {
    if (!primaryOntology) {
      return [];
    }

    return ontologies
      .filter((ontology) => ontology.id !== primaryOntology.id)
      .sort((left, right) => right.version_number - left.version_number);
  }, [ontologies, primaryOntology]);

  const primaryConnector = useMemo(() => {
    if (!primaryOntology?.connector_id) {
      return undefined;
    }

    return connectors.find((connector) => connector.id === primaryOntology.connector_id);
  }, [connectors, primaryOntology]);

  const activeConnectors = useMemo(
    () => connectors.filter((connector) => connector.status === "Active"),
    [connectors],
  );

  const isEmpty = state.kind === "success" && ontologies.length === 0;
  const hasOntologies = state.kind === "success" && ontologies.length > 0;

  return (
    <section className="ontologies-page" aria-labelledby="ontologies-heading">
      <div className="ontologies-page__header">
        <div>
          <h2 id="ontologies-heading">Ontology</h2>
          <p className="ontologies-page__lead">
            Defines what things mean in this application. Agents and data products use this
            semantic layer — it is not another database.
          </p>
        </div>
        <Link
          to={createBasePath}
          className="ontologies-page__button ontologies-page__button--primary"
        >
          Create or import ontology
        </Link>
      </div>

      {state.kind === "loading" && (
        <p className="ontologies-page__status" role="status" aria-live="polite">
          Loading ontologies…
        </p>
      )}

      {state.kind === "error" && (
        <div className="ontologies-page__error" role="alert">
          {state.message}
        </div>
      )}

      {actionError && (
        <div className="ontologies-page__error ontologies-page__action-error" role="alert">
          {actionError}
        </div>
      )}

      {state.kind === "success" && (
        <div className="ontologies-page__context-strip" role="status">
          <dl className="ontologies-page__context-list">
            <div>
              <dt>Definitions</dt>
              <dd>{ontologies.length}</dd>
            </div>
            <div>
              <dt>Ready connectors</dt>
              <dd>
                {activeConnectors.length > 0 ? (
                  activeConnectors.length
                ) : (
                  <>
                    None —{" "}
                    <Link to="/connectors" className="ontologies-page__inline-link">
                      create a connector
                    </Link>
                  </>
                )}
              </dd>
            </div>
            {primaryOntology?.semantic_transaction_id && (
              <div>
                <dt>Semantic lineage</dt>
                <dd>
                  <Link
                    to={`/applications/${applicationId}/semantic-transactions/${primaryOntology.semantic_transaction_id}`}
                    className="ontologies-page__inline-link"
                  >
                    View transaction
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {isEmpty && (
        <div className="ontologies-page__empty ontologies-page__empty--modes" role="status">
          <h3 className="ontologies-page__empty-title">
            No ontology defined for this application yet.
          </h3>
          <p className="ontologies-page__hint">
            Choose how you want to capture business meaning. You can refine and validate
            before materializing through a connector.
          </p>

          <div className="ontologies-page__mode-grid" role="list">
            {ONTOLOGY_MODES.map((mode) =>
              mode.enabled ? (
                <div key={mode.id} className="ontologies-page__mode-item" role="listitem">
                  <Link
                    to={`${createBasePath}${mode.hrefSuffix}`}
                    className="ontologies-page__mode-card ontologies-page__mode-card--link"
                    aria-label={`${mode.title}: ${mode.cta}`}
                  >
                    <span className="ontologies-page__mode-title">{mode.title}</span>
                    <span className="ontologies-page__mode-copy">{mode.copy}</span>
                    <span className="ontologies-page__mode-cta">{mode.cta} →</span>
                  </Link>
                </div>
              ) : (
                <div
                  key={mode.id}
                  className="ontologies-page__mode-item ontologies-page__mode-card ontologies-page__mode-card--disabled"
                  role="listitem"
                  aria-disabled="true"
                >
                  <span className="ontologies-page__mode-title">{mode.title}</span>
                  <span className="ontologies-page__mode-copy">{mode.copy}</span>
                  <span className="ontologies-page__mode-cta">{mode.cta}</span>
                </div>
              ),
            )}
          </div>

          <p className="ontologies-page__flow-hint">
            Mode → Edit &amp; validate → Connector → Materialize → Register → Semantic
            transaction
          </p>
        </div>
      )}

      {hasOntologies && primaryOntology && (
        <>
          <article
            className="ontologies-page__primary-card"
            id={`ontology-${primaryOntology.id}`}
            aria-labelledby={`ontology-title-${primaryOntology.id}`}
          >
            <div className="ontologies-page__primary-header">
              <div>
                <h3
                  className="ontologies-page__primary-title"
                  id={`ontology-title-${primaryOntology.id}`}
                >
                  {primaryOntology.title}
                </h3>
                <p className="ontologies-page__primary-subtitle">
                  Version {formatVersionChain(primaryOntology, ontologies)} · Created{" "}
                  {formatDate(primaryOntology.created_at)}
                </p>
              </div>
              <span className={statusClassName(primaryOntology.status)}>
                {primaryOntology.status}
              </span>
            </div>

            <ol
              className="ontologies-page__lifecycle"
              aria-label="Ontology lifecycle"
            >
              {LIFECYCLE_STEPS.map((step) => {
                const stepState = lifecycleStepState(step, primaryOntology.status);

                return (
                  <li
                    key={step}
                    className={`ontologies-page__lifecycle-step ontologies-page__lifecycle-step--${stepState}`}
                  >
                    <span className="ontologies-page__lifecycle-marker" aria-hidden="true" />
                    <span className="ontologies-page__lifecycle-label">{step}</span>
                  </li>
                );
              })}
            </ol>

            <dl className="ontologies-page__primary-meta">
              <div>
                <dt>Connector</dt>
                <dd>
                  {primaryOntology.connector_id
                    ? formatConnectorSummary(primaryConnector)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Artifact URI</dt>
                <dd>
                  {primaryOntology.artifact_uri ? (
                    <code title={primaryOntology.artifact_uri}>
                      {truncateUri(primaryOntology.artifact_uri)}
                    </code>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Source format</dt>
                <dd>{primaryOntology.source_format ?? "—"}</dd>
              </div>
              {primaryOntology.description && (
                <div>
                  <dt>Description</dt>
                  <dd>{primaryOntology.description}</dd>
                </div>
              )}
            </dl>

            <p className="ontologies-page__primary-footnote">
              Materialized via connector · registered in platform · recorded as semantic
              transaction
              {primaryOntology.semantic_transaction_id && (
                <>
                  {" "}
                  ·{" "}
                  <Link
                    to={`/applications/${applicationId}/semantic-transactions/${primaryOntology.semantic_transaction_id}`}
                    className="ontologies-page__inline-link"
                  >
                    View semantic transaction
                  </Link>
                </>
              )}
            </p>

            <div className="ontologies-page__primary-actions">
              {canForkOntology(primaryOntology) && (
                <button
                  type="button"
                  className="ontologies-page__button ontologies-page__button--secondary"
                  disabled={pendingOntologyId === primaryOntology.id}
                  onClick={() => void handleForkVersion(primaryOntology.id)}
                >
                  New version
                </button>
              )}
              {getNextOntologyStatuses(primaryOntology.status).map((nextStatus) => (
                <button
                  key={nextStatus}
                  type="button"
                  className="ontologies-page__button ontologies-page__button--secondary"
                  disabled={pendingOntologyId === primaryOntology.id}
                  onClick={() =>
                    void handleStatusTransition(primaryOntology.id, nextStatus)
                  }
                >
                  {getOntologyStatusActionLabel(nextStatus)}
                </button>
              ))}
            </div>
          </article>

          {historyOntologies.length > 0 && (
            <div className="ontologies-page__history">
              <h3 className="ontologies-page__history-title">Version history</h3>
              <div className="ontologies-page__table-wrap">
                <table className="ontologies-table">
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th scope="col">Status</th>
                      <th scope="col">Version</th>
                      <th scope="col">Created at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyOntologies.map((ontology) => (
                      <tr key={ontology.id} id={`ontology-${ontology.id}`}>
                        <td>{ontology.title}</td>
                        <td>
                          <span className={statusClassName(ontology.status)}>
                            {ontology.status}
                          </span>
                        </td>
                        <td>{formatVersionChain(ontology, ontologies)}</td>
                        <td>{formatDate(ontology.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

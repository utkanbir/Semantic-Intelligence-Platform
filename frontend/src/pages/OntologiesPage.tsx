import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { listConnectors, type ConnectorResponse } from "../api/adapters";
import {
  deleteOntology,
  getNextOntologyStatuses,
  getOntologyStatusActionLabel,
  listOntologies,
  normalizeOntologyLifecycleStatus,
  updateOntologyStatus,
  type OntologyDefinitionResponse,
  type OntologyDefinitionStatus,
} from "../api/ontologies";
import { OntologyAreaNav } from "../components/OntologyAreaNav";
import { getVendorLabel, readConnectorVendor } from "../connectors/catalog";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; ontologies: OntologyDefinitionResponse[] };

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
    copy: "Import existing OWL/RDF content from a local file.",
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

function sortOntologiesNewestFirst(
  ontologies: OntologyDefinitionResponse[],
): OntologyDefinitionResponse[] {
  return [...ontologies].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
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

interface OntologiesPageProps {
  applicationId: string;
}

export function OntologiesPage({ applicationId }: OntologiesPageProps) {
  const navigate = useNavigate();
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

  async function handleDelete(ontology: OntologyDefinitionResponse) {
    const confirmed = window.confirm(
      `Delete ontology "${ontology.title}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setActionError(null);
    setPendingOntologyId(ontology.id);
    try {
      await deleteOntology(ontology.id);
      await loadOntologies();
      navigate(`/applications/${applicationId}/ontology`);
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to delete ontology";
      setActionError(message);
    } finally {
      setPendingOntologyId(null);
    }
  }

  const ontologies = state.kind === "success" ? state.ontologies : [];
  const sortedOntologies = useMemo(
    () => sortOntologiesNewestFirst(ontologies),
    [ontologies],
  );
  const primaryOntology = useMemo(() => pickPrimaryOntology(ontologies), [ontologies]);

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

      <OntologyAreaNav applicationId={applicationId} />

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

      {hasOntologies && (
        <div className="ontologies-page__table-wrap">
          <table className="ontologies-table" aria-label="Ontology definitions">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">Connector</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedOntologies.map((ontology) => {
                const connector = ontology.connector_id
                  ? connectors.find((item) => item.id === ontology.connector_id)
                  : undefined;
                const normalizedStatus = normalizeOntologyLifecycleStatus(ontology.status);

                return (
                  <tr key={ontology.id} id={`ontology-${ontology.id}`}>
                    <td>
                      <strong>{ontology.title}</strong>
                      {ontology.description && (
                        <p className="ontologies-page__table-description">
                          {ontology.description}
                        </p>
                      )}
                    </td>
                    <td>
                      <span className={statusClassName(normalizedStatus)}>
                        {normalizedStatus}
                      </span>
                    </td>
                    <td>{formatDate(ontology.created_at)}</td>
                    <td>{formatConnectorSummary(connector)}</td>
                    <td>
                      <div className="ontologies-table__actions">
                        {ontology.status === "Draft" && ontology.artifact_uri && (
                          <Link
                            to={`/applications/${applicationId}/ontology/${ontology.id}/validate`}
                            className="ontologies-table__action"
                          >
                            Run validation
                          </Link>
                        )}
                        {ontology.status === "Validated" && ontology.artifact_uri && (
                          <Link
                            to={`/applications/${applicationId}/ontology/${ontology.id}/validate`}
                            className="ontologies-table__action"
                          >
                            Review &amp; approve
                          </Link>
                        )}
                        {getNextOntologyStatuses(ontology.status)
                          .filter(
                            (nextStatus) =>
                              !(
                                ontology.status === "Draft" &&
                                nextStatus === "Validated" &&
                                Boolean(ontology.artifact_uri)
                              ) &&
                              !(
                                ontology.status === "Validated" &&
                                nextStatus === "Approved" &&
                                Boolean(ontology.artifact_uri)
                              ),
                          )
                          .map((nextStatus) => (
                            <button
                              key={nextStatus}
                              type="button"
                              className="ontologies-table__action"
                              disabled={pendingOntologyId === ontology.id}
                              onClick={() =>
                                void handleStatusTransition(ontology.id, nextStatus)
                              }
                            >
                              {getOntologyStatusActionLabel(nextStatus)}
                            </button>
                          ))}
                        <button
                          type="button"
                          className="ontologies-table__action"
                          disabled={pendingOntologyId === ontology.id}
                          onClick={() => void handleDelete(ontology)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

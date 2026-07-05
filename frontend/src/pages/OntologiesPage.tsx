import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
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
import { formatVersionChain } from "../utils/versionChain";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; ontologies: OntologyDefinitionResponse[] };

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

interface OntologiesPageProps {
  applicationId: string;
}

export function OntologiesPage({ applicationId }: OntologiesPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingOntologyId, setPendingOntologyId] = useState<string | null>(null);

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

    listOntologies(applicationId)
      .then((ontologies) => {
        if (!cancelled) {
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

  const isEmpty = state.kind === "success" && state.ontologies.length === 0;
  const hasOntologies = state.kind === "success" && state.ontologies.length > 0;

  return (
    <section className="ontologies-page" aria-labelledby="ontologies-heading">
      <div className="ontologies-page__header">
        <div>
          <h2 id="ontologies-heading">Ontology</h2>
          <p className="ontologies-page__lead">
            The ontology captures business meaning for this application — not another
            database, but the semantic context agents and data products rely on.
          </p>
        </div>
        <Link
          to={`/applications/${applicationId}/ontology/create`}
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

      {isEmpty && (
        <div className="ontologies-page__empty" role="status">
          <p>No ontology definitions yet.</p>
          <p className="ontologies-page__hint">
            Create a manual ontology or import existing OWL/RDF content through the
            guided flow.
          </p>
          <p>
            <Link
              to={`/applications/${applicationId}/ontology/create`}
              className="ontologies-page__button ontologies-page__button--primary"
            >
              Create or import ontology
            </Link>
          </p>
        </div>
      )}

      {hasOntologies && (
        <div className="ontologies-page__table-wrap">
          <table className="ontologies-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Version</th>
                <th scope="col">Created at</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.ontologies.map((ontology) => (
                <tr key={ontology.id} id={`ontology-${ontology.id}`}>
                  <td>{ontology.title}</td>
                  <td>
                    <span className={statusClassName(ontology.status)}>{ontology.status}</span>
                  </td>
                  <td>{formatVersionChain(ontology, state.ontologies)}</td>
                  <td>{formatDate(ontology.created_at)}</td>
                  <td>
                    <div className="ontologies-table__actions">
                      {canForkOntology(ontology) && (
                        <button
                          type="button"
                          className="ontologies-page__button ontologies-page__button--secondary ontologies-table__action"
                          disabled={pendingOntologyId === ontology.id}
                          onClick={() => void handleForkVersion(ontology.id)}
                        >
                          New version
                        </button>
                      )}
                      {getNextOntologyStatuses(ontology.status).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          className="ontologies-page__button ontologies-page__button--secondary ontologies-table__action"
                          disabled={pendingOntologyId === ontology.id}
                          onClick={() => void handleStatusTransition(ontology.id, nextStatus)}
                        >
                          {getOntologyStatusActionLabel(nextStatus)}
                        </button>
                      ))}
                      {getNextOntologyStatuses(ontology.status).length === 0 &&
                        !canForkOntology(ontology) && (
                          <span className="ontologies-table__no-actions">—</span>
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

import { useEffect, useState } from "react";
import { ApiError } from "../api";
import {
  listOntologies,
  type OntologyDefinitionResponse,
} from "../api/ontologies";

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

  const isEmpty = state.kind === "success" && state.ontologies.length === 0;
  const hasOntologies = state.kind === "success" && state.ontologies.length > 0;

  return (
    <section className="ontologies-page" aria-labelledby="ontologies-heading">
      <div className="ontologies-page__header">
        <div>
          <h2 id="ontologies-heading">Ontology</h2>
          <p className="ontologies-page__lead">
            Ontology definitions describe the semantic model for this application&apos;s
            knowledge graph and data products.
          </p>
        </div>
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

      {isEmpty && (
        <div className="ontologies-page__empty" role="status">
          <p>No ontology definitions yet.</p>
          <p className="ontologies-page__hint">
            Ontology definitions will appear here once they are created for this application.
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
              </tr>
            </thead>
            <tbody>
              {state.ontologies.map((ontology) => (
                <tr key={ontology.id}>
                  <td>{ontology.title}</td>
                  <td>
                    <span className={statusClassName(ontology.status)}>{ontology.status}</span>
                  </td>
                  <td>{ontology.version_number}</td>
                  <td>{formatDate(ontology.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { ApiError } from "../api";
import {
  listKnowledgeGraphs,
  type KnowledgeGraphRegistryResponse,
} from "../api/knowledgeGraphs";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; registries: KnowledgeGraphRegistryResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(
  status: KnowledgeGraphRegistryResponse["status"],
): string {
  return `knowledge-graphs-table__status knowledge-graphs-table__status--${status.toLowerCase()}`;
}

interface KnowledgeGraphsPageProps {
  applicationId: string;
}

export function KnowledgeGraphsPage({ applicationId }: KnowledgeGraphsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    listKnowledgeGraphs(applicationId)
      .then((registries) => {
        if (!cancelled) {
          setState({ kind: "success", registries });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load knowledge graphs";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const isEmpty = state.kind === "success" && state.registries.length === 0;
  const hasRegistries = state.kind === "success" && state.registries.length > 0;

  return (
    <section className="knowledge-graphs-page" aria-labelledby="knowledge-graphs-heading">
      <div className="knowledge-graphs-page__header">
        <div>
          <h2 id="knowledge-graphs-heading">Knowledge graph</h2>
          <p className="knowledge-graphs-page__lead">
            Knowledge graph registries track populated semantic graphs for this
            application&apos;s ontology-bound data.
          </p>
        </div>
      </div>

      {state.kind === "loading" && (
        <p className="knowledge-graphs-page__status" role="status" aria-live="polite">
          Loading knowledge graphs…
        </p>
      )}

      {state.kind === "error" && (
        <div className="knowledge-graphs-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="knowledge-graphs-page__empty" role="status">
          <p>No knowledge graph registries yet.</p>
          <p className="knowledge-graphs-page__hint">
            Knowledge graph registries will appear here once they are created for this
            application.
          </p>
        </div>
      )}

      {hasRegistries && (
        <div className="knowledge-graphs-page__table-wrap">
          <table className="knowledge-graphs-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Created at</th>
                <th scope="col">Populated at</th>
              </tr>
            </thead>
            <tbody>
              {state.registries.map((registry) => (
                <tr key={registry.id}>
                  <td>{registry.title}</td>
                  <td>
                    <span className={statusClassName(registry.status)}>{registry.status}</span>
                  </td>
                  <td>{formatDate(registry.created_at)}</td>
                  <td>{formatDate(registry.populated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

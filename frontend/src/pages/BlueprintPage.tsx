import { useEffect, useState } from "react";
import { ApiError } from "../api";
import { listBlueprints, type BlueprintResponse } from "../api/blueprints";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; blueprints: BlueprintResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: BlueprintResponse["status"]): string {
  return `blueprint-table__status blueprint-table__status--${status.toLowerCase()}`;
}

interface BlueprintPageProps {
  applicationId: string;
}

export function BlueprintPage({ applicationId }: BlueprintPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    listBlueprints(applicationId)
      .then((blueprints) => {
        if (!cancelled) {
          setState({ kind: "success", blueprints });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load blueprints";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  return (
    <section className="blueprint-page" aria-labelledby="blueprint-heading">
      <h2 id="blueprint-heading">Blueprint</h2>
      <p className="blueprint-page__lead">
        Blueprints define the semantic architecture and provisioning plan derived from
        discovery sessions.
      </p>

      {state.kind === "loading" && (
        <p className="blueprint-page__status" role="status" aria-live="polite">
          Loading blueprints…
        </p>
      )}

      {state.kind === "error" && (
        <div className="blueprint-page__error" role="alert">
          {state.message}
        </div>
      )}

      {state.kind === "success" && state.blueprints.length === 0 && (
        <div className="blueprint-page__empty" role="status">
          <p>No blueprints yet.</p>
          <p className="blueprint-page__hint">
            Create a blueprint via the API to see it listed here.
          </p>
        </div>
      )}

      {state.kind === "success" && state.blueprints.length > 0 && (
        <div className="blueprint-page__table-wrap">
          <table className="blueprint-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Version</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {state.blueprints.map((blueprint) => (
                <tr key={blueprint.id}>
                  <td>{blueprint.title}</td>
                  <td>
                    <span className={statusClassName(blueprint.status)}>
                      {blueprint.status}
                    </span>
                  </td>
                  <td>{blueprint.version_number}</td>
                  <td>{formatDate(blueprint.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

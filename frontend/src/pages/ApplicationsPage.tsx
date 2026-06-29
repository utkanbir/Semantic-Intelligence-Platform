import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import { listApplications, type ApplicationResponse } from "../api/applications";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; applications: ApplicationResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusLabel(status: ApplicationResponse["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ApplicationsPage() {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    listApplications()
      .then((applications) => {
        if (!cancelled) {
          setState({ kind: "success", applications });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load applications";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="applications-page">
      <h1>Applications</h1>
      <p className="applications-page__lead">
        Select an application to manage discovery, assets, and data products. The
        console is organized around your applications—not underlying technologies.
      </p>

      {state.kind === "loading" && (
        <p className="applications-page__status" role="status" aria-live="polite">
          Loading applications…
        </p>
      )}

      {state.kind === "error" && (
        <div className="applications-page__error" role="alert">
          {state.message}
        </div>
      )}

      {state.kind === "success" && state.applications.length === 0 && (
        <div className="applications-page__empty" role="status">
          <p>No applications yet.</p>
          <p className="applications-page__hint">
            Create an application via the API to see it listed here.
          </p>
        </div>
      )}

      {state.kind === "success" && state.applications.length > 0 && (
        <div className="applications-page__table-wrap">
          <table className="applications-table">
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {state.applications.map((application) => (
                <tr key={application.id}>
                  <td>
                    <Link
                      to={`/applications/${application.id}`}
                      className="applications-table__link"
                    >
                      <code className="applications-table__key">{application.key}</code>
                    </Link>
                  </td>
                  <td>
                    <Link
                      to={`/applications/${application.id}`}
                      className="applications-table__link"
                    >
                      {application.name}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={`applications-table__status applications-table__status--${application.status}`}
                    >
                      {statusLabel(application.status)}
                    </span>
                  </td>
                  <td>{formatDate(application.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

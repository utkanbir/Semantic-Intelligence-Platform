import { useEffect, useState } from "react";
import { ApiError } from "../api";
import {
  listDiscoverySessions,
  type DiscoverySessionResponse,
} from "../api/discovery";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; sessions: DiscoverySessionResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatPhase(session: DiscoverySessionResponse): string {
  const phase = session.current_phase;
  if (!phase) {
    return "—";
  }
  return `${phase.phase_number}. ${phase.phase_name}`;
}

function statusClassName(status: DiscoverySessionResponse["status"]): string {
  return `discovery-table__status discovery-table__status--${status.toLowerCase()}`;
}

interface DiscoveryPageProps {
  applicationId: string;
}

export function DiscoveryPage({ applicationId }: DiscoveryPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    listDiscoverySessions(applicationId)
      .then((sessions) => {
        if (!cancelled) {
          setState({ kind: "success", sessions });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load discovery sessions";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  return (
    <section className="discovery-page" aria-labelledby="discovery-heading">
      <h2 id="discovery-heading">Discovery</h2>
      <p className="discovery-page__lead">
        Discovery sessions capture intent, requirements, and recommendations before
        blueprint generation.
      </p>

      {state.kind === "loading" && (
        <p className="discovery-page__status" role="status" aria-live="polite">
          Loading discovery sessions…
        </p>
      )}

      {state.kind === "error" && (
        <div className="discovery-page__error" role="alert">
          {state.message}
        </div>
      )}

      {state.kind === "success" && state.sessions.length === 0 && (
        <div className="discovery-page__empty" role="status">
          <p>No discovery sessions yet.</p>
          <p className="discovery-page__hint">
            Start a session via the API to see it listed here.
          </p>
        </div>
      )}

      {state.kind === "success" && state.sessions.length > 0 && (
        <div className="discovery-page__table-wrap">
          <table className="discovery-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Current phase</th>
                <th scope="col">Started by</th>
                <th scope="col">Started</th>
              </tr>
            </thead>
            <tbody>
              {state.sessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.title}</td>
                  <td>
                    <span className={statusClassName(session.status)}>
                      {session.status}
                    </span>
                  </td>
                  <td>{formatPhase(session)}</td>
                  <td>{session.started_by || "—"}</td>
                  <td>{formatDate(session.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

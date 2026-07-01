import { useEffect, useState } from "react";
import { ApiError } from "../../api";
import {
  listAdapters,
  type TechnologyAdapterResponse,
} from "../../api/adapters";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; adapters: TechnologyAdapterResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: TechnologyAdapterResponse["status"]): string {
  return `platform-table__status platform-table__status--${status.toLowerCase()}`;
}

export function AdaptersPage() {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    listAdapters()
      .then((adapters) => {
        if (!cancelled) {
          setState({ kind: "success", adapters });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load adapters";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isEmpty = state.kind === "success" && state.adapters.length === 0;
  const hasAdapters = state.kind === "success" && state.adapters.length > 0;

  return (
    <section className="platform-page" aria-labelledby="adapters-heading">
      <h1 id="adapters-heading">Adapters</h1>
      <p className="platform-page__lead">
        Configure and monitor technology adapters that connect the platform to
        external systems.
      </p>

      {state.kind === "loading" && (
        <p className="platform-page__status" role="status" aria-live="polite">
          Loading adapters…
        </p>
      )}

      {state.kind === "error" && (
        <div className="platform-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="platform-page__empty" role="status">
          <p>No adapters yet.</p>
        </div>
      )}

      {hasAdapters && (
        <div className="platform-page__table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Technology</th>
                <th scope="col">Adapter key</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {state.adapters.map((adapter) => (
                <tr key={adapter.id}>
                  <td>{adapter.title}</td>
                  <td>
                    <code className="platform-table__code">{adapter.technology_type}</code>
                  </td>
                  <td>
                    <code className="platform-table__code">{adapter.adapter_key}</code>
                  </td>
                  <td>
                    <span className={statusClassName(adapter.status)}>
                      {adapter.status}
                    </span>
                  </td>
                  <td>{formatDate(adapter.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

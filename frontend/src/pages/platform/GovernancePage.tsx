import { useEffect, useState } from "react";
import { ApiError } from "../../api";
import {
  listPolicies,
  type PolicyDefinitionResponse,
} from "../../api/governance";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; policies: PolicyDefinitionResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: PolicyDefinitionResponse["status"]): string {
  return `platform-table__status platform-table__status--${status.toLowerCase()}`;
}

export function GovernancePage() {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    listPolicies()
      .then((policies) => {
        if (!cancelled) {
          setState({ kind: "success", policies });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load policies";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isEmpty = state.kind === "success" && state.policies.length === 0;
  const hasPolicies = state.kind === "success" && state.policies.length > 0;

  return (
    <section className="platform-page" aria-labelledby="governance-heading">
      <h1 id="governance-heading">Governance</h1>
      <p className="platform-page__lead">
        Review policies, approvals, and platform-wide governance controls.
      </p>

      {state.kind === "loading" && (
        <p className="platform-page__status" role="status" aria-live="polite">
          Loading policies…
        </p>
      )}

      {state.kind === "error" && (
        <div className="platform-page__error" role="alert">
          {state.message}
        </div>
      )}

      {isEmpty && (
        <div className="platform-page__empty" role="status">
          <p>No policies yet.</p>
        </div>
      )}

      {hasPolicies && (
        <div className="platform-page__table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Policy key</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {state.policies.map((policy) => (
                <tr key={policy.id}>
                  <td>{policy.title}</td>
                  <td>
                    <code className="platform-table__code">{policy.policy_key}</code>
                  </td>
                  <td>
                    <span className={statusClassName(policy.status)}>
                      {policy.status}
                    </span>
                  </td>
                  <td>{formatDate(policy.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

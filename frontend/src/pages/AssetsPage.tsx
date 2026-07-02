import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api";
import {
  getAssetStatusActionLabel,
  getNextAssetStatuses,
  listAssets,
  updateAssetStatus,
  type AssetRecordResponse,
  type AssetRecordStatus,
} from "../api/assets";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; assets: AssetRecordResponse[] };

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusClassName(status: AssetRecordResponse["status"]): string {
  return `assets-table__status assets-table__status--${status.toLowerCase()}`;
}

interface AssetsPageProps {
  applicationId: string;
}

export function AssetsPage({ applicationId }: AssetsPageProps) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);

  const loadAssets = useCallback(() => {
    setState({ kind: "loading" });

    return listAssets(applicationId)
      .then((assets) => {
        setState({ kind: "success", assets });
        return assets;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to load assets";
        setState({ kind: "error", message });
        throw error;
      });
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;

    listAssets(applicationId)
      .then((assets) => {
        if (!cancelled) {
          setState({ kind: "success", assets });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load assets";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  async function handleStatusTransition(assetId: string, nextStatus: AssetRecordStatus) {
    setActionError(null);
    setPendingAssetId(assetId);
    try {
      await updateAssetStatus(assetId, nextStatus);
      await loadAssets();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to update asset status";
      setActionError(message);
    } finally {
      setPendingAssetId(null);
    }
  }

  const isEmpty = state.kind === "success" && state.assets.length === 0;
  const hasAssets = state.kind === "success" && state.assets.length > 0;

  return (
    <section className="assets-page" aria-labelledby="assets-heading">
      <div className="assets-page__header">
        <div>
          <h2 id="assets-heading">Assets</h2>
          <p className="assets-page__lead">
            Registered assets for this application, including discovery sessions, blueprints,
            and related resources.
          </p>
        </div>
      </div>

      {state.kind === "loading" && (
        <p className="assets-page__status" role="status" aria-live="polite">
          Loading assets…
        </p>
      )}

      {state.kind === "error" && (
        <div className="assets-page__error" role="alert">
          {state.message}
        </div>
      )}

      {actionError && (
        <div className="assets-page__error assets-page__action-error" role="alert">
          {actionError}
        </div>
      )}

      {isEmpty && (
        <div className="assets-page__empty" role="status">
          <p>No assets registered yet.</p>
          <p className="assets-page__hint">
            Assets are created automatically when discovery sessions, blueprints, and other
            resources are registered.
          </p>
        </div>
      )}

      {hasAssets && (
        <div className="assets-page__table-wrap">
          <table className="assets-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Asset type</th>
                <th scope="col">Resource type</th>
                <th scope="col">Status</th>
                <th scope="col">Created at</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.assets.map((asset) => (
                <tr key={asset.id}>
                  <td>{asset.title}</td>
                  <td>{asset.asset_type}</td>
                  <td>{asset.resource_type}</td>
                  <td>
                    <span className={statusClassName(asset.status)}>{asset.status}</span>
                  </td>
                  <td>{formatDate(asset.created_at)}</td>
                  <td>
                    <div className="assets-table__actions">
                      {getNextAssetStatuses(asset.status).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          className="assets-page__button assets-page__button--secondary assets-table__action"
                          disabled={pendingAssetId === asset.id}
                          onClick={() => void handleStatusTransition(asset.id, nextStatus)}
                        >
                          {getAssetStatusActionLabel(nextStatus)}
                        </button>
                      ))}
                      {getNextAssetStatuses(asset.status).length === 0 && (
                        <span className="assets-table__no-actions">—</span>
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

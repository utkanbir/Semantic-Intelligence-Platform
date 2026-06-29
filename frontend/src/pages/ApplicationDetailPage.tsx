import { useEffect, useState } from "react";
import { Route, Routes, useParams } from "react-router-dom";
import { ApiError } from "../api";
import {
  getApplication,
  type ApplicationResponse,
} from "../api/applications";
import { ApplicationShell } from "../components/ApplicationShell";
import { BlueprintPage } from "./BlueprintPage";
import { DiscoveryPage } from "./DiscoveryPage";

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; application: ApplicationResponse };

function statusLabel(status: ApplicationResponse["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function OverviewSection({ application }: { application: ApplicationResponse }) {
  const { workspace } = application;

  return (
    <section className="application-overview" aria-labelledby="overview-heading">
      <h2 id="overview-heading">Overview</h2>

      <dl className="application-overview__details">
        <div className="application-overview__row">
          <dt>Key</dt>
          <dd>
            <code>{application.key}</code>
          </dd>
        </div>
        <div className="application-overview__row">
          <dt>Name</dt>
          <dd>{application.name}</dd>
        </div>
        <div className="application-overview__row">
          <dt>Status</dt>
          <dd>
            <span
              className={`applications-table__status applications-table__status--${application.status}`}
            >
              {statusLabel(application.status)}
            </span>
          </dd>
        </div>
      </dl>

      <h3 className="application-overview__subheading">Workspace namespaces</h3>
      <dl className="application-overview__details application-overview__details--workspace">
        <div className="application-overview__row">
          <dt>Postgres schema</dt>
          <dd>
            <code>{workspace.postgres_schema}</code>
          </dd>
        </div>
        <div className="application-overview__row">
          <dt>MinIO namespace</dt>
          <dd>
            <code>{workspace.minio_namespace}</code>
          </dd>
        </div>
        <div className="application-overview__row">
          <dt>Fuseki dataset</dt>
          <dd>
            <code>{workspace.fuseki_dataset}</code>
          </dd>
        </div>
        <div className="application-overview__row">
          <dt>Qdrant collection</dt>
          <dd>
            <code>{workspace.qdrant_collection}</code>
          </dd>
        </div>
        <div className="application-overview__row">
          <dt>Metadata domain</dt>
          <dd>
            <code>{workspace.metadata_domain}</code>
          </dd>
        </div>
        <div className="application-overview__row">
          <dt>Ontology namespace</dt>
          <dd>
            <code>{workspace.ontology_namespace}</code>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function ComingSoonSection({ section }: { section: string }) {
  return (
    <section className="application-placeholder" aria-labelledby="placeholder-heading">
      <h2 id="placeholder-heading">{section}</h2>
      <p className="application-placeholder__message">Coming soon</p>
    </section>
  );
}

export function ApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    if (!applicationId) {
      setState({ kind: "error", message: "Application ID is required" });
      return;
    }

    let cancelled = false;

    getApplication(applicationId)
      .then((application) => {
        if (!cancelled) {
          setState({ kind: "success", application });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to load application";
          setState({ kind: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (state.kind === "loading") {
    return (
      <p className="application-detail__status" role="status" aria-live="polite">
        Loading application…
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="application-detail__error" role="alert">
        {state.message}
      </div>
    );
  }

  const { application } = state;

  return (
    <ApplicationShell application={application}>
      <Routes>
        <Route index element={<OverviewSection application={application} />} />
        <Route
          path="discovery"
          element={<DiscoveryPage applicationId={application.id} />}
        />
        <Route
          path="blueprint"
          element={<BlueprintPage applicationId={application.id} />}
        />
        <Route
          path="products"
          element={<ComingSoonSection section="Products" />}
        />
        <Route path="agents" element={<ComingSoonSection section="Agents" />} />
      </Routes>
    </ApplicationShell>
  );
}

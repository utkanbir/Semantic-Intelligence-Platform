import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AgentRunDetailPage } from "./AgentRunDetailPage";
import { ApiError } from "../api";
import {
  getApplication,
  type ApplicationResponse,
} from "../api/applications";
import { ApplicationShell } from "../components/ApplicationShell";
import { AgentsPage } from "./AgentsPage";
import { AgentRunsPage } from "./AgentRunsPage";
import { ApplicationAuditTraceDetailPage } from "./ApplicationAuditTraceDetailPage";
import { ApplicationAuditTracePage } from "./ApplicationAuditTracePage";
import { ApplicationSemanticTransactionDetailPage } from "./ApplicationSemanticTransactionDetailPage";
import { ApplicationSemanticTransactionsPage } from "./ApplicationSemanticTransactionsPage";
import { AssetsPage } from "./AssetsPage";
import { BlueprintPage } from "./BlueprintPage";
import { DiscoveryPage } from "./DiscoveryPage";
import { KnowledgeGraphsPage } from "./KnowledgeGraphsPage";
import { OntologiesPage } from "./OntologiesPage";
import { OntologyChatPage } from "./OntologyChatPage";
import { OntologyStudioPage } from "./OntologyStudioPage";
import { OntologyValidationPage } from "./OntologyValidationPage";
import { ProductsPage } from "./ProductsPage";

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

function AgentRunDetailRoute({ applicationId }: { applicationId: string }) {
  const { runId } = useParams<{ runId: string }>();

  if (!runId) {
    return (
      <div className="agent-runs-page__error" role="alert">
        Run ID is required
      </div>
    );
  }

  return <AgentRunDetailPage applicationId={applicationId} runId={runId} />;
}

function AuditTraceDetailRoute({ applicationId }: { applicationId: string }) {
  const { transactionId } = useParams<{ transactionId: string }>();

  if (!transactionId) {
    return (
      <div className="agent-runs-page__error" role="alert">
        Transaction ID is required
      </div>
    );
  }

  return (
    <ApplicationAuditTraceDetailPage
      applicationId={applicationId}
      transactionId={transactionId}
    />
  );
}

function SemanticTransactionDetailRoute({ applicationId }: { applicationId: string }) {
  const { transactionId } = useParams<{ transactionId: string }>();

  if (!transactionId) {
    return (
      <div className="agent-runs-page__error" role="alert">
        Transaction ID is required
      </div>
    );
  }

  return (
    <ApplicationSemanticTransactionDetailPage
      applicationId={applicationId}
      transactionId={transactionId}
    />
  );
}

function OntologyValidationRoute({ applicationId }: { applicationId: string }) {
  const { ontologyId } = useParams<{ ontologyId: string }>();

  if (!ontologyId) {
    return (
      <div className="agent-runs-page__error" role="alert">
        Ontology ID is required
      </div>
    );
  }

  return (
    <OntologyValidationPage applicationId={applicationId} ontologyId={ontologyId} />
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
        <Route path="assets" element={<AssetsPage applicationId={application.id} />} />
        <Route
          path="ontology"
          element={<OntologiesPage applicationId={application.id} />}
        />
        <Route
          path="ontology/chat"
          element={<OntologyChatPage applicationId={application.id} />}
        />
        <Route
          path="ontology/create"
          element={<OntologyStudioPage applicationId={application.id} />}
        />
        <Route
          path="ontology/:ontologyId/validate"
          element={<OntologyValidationRoute applicationId={application.id} />}
        />
        <Route
          path="ontology-studio"
          element={
            <Navigate to={`/applications/${application.id}/ontology/create`} replace />
          }
        />
        <Route
          path="knowledge-graph"
          element={<KnowledgeGraphsPage applicationId={application.id} />}
        />
        <Route
          path="products"
          element={<ProductsPage applicationId={application.id} />}
        />
        <Route path="agents" element={<AgentsPage applicationId={application.id} />} />
        <Route
          path="agent-runs"
          element={<AgentRunsPage applicationId={application.id} />}
        />
        <Route
          path="agent-runs/:runId"
          element={
            <AgentRunDetailRoute applicationId={application.id} />
          }
        />
        <Route
          path="semantic-transactions"
          element={<ApplicationSemanticTransactionsPage applicationId={application.id} />}
        />
        <Route
          path="semantic-transactions/:transactionId"
          element={<SemanticTransactionDetailRoute applicationId={application.id} />}
        />
        <Route
          path="audit-trace"
          element={<ApplicationAuditTracePage applicationId={application.id} />}
        />
        <Route
          path="audit-trace/:transactionId"
          element={<AuditTraceDetailRoute applicationId={application.id} />}
        />
      </Routes>
    </ApplicationShell>
  );
}

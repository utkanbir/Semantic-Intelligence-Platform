import { Navigate } from "react-router-dom";
import { ConnectorsSection } from "./InfrastructureConnectorsSection";

export function ConnectorsPage() {
  return (
    <div className="connectors-page">
      <header className="platform-page__header">
        <div>
          <h1 id="connectors-heading">Connectors</h1>
          <p className="platform-page__lead">
            Register platform connectors by type — database, object storage, file system, and
            ontology / knowledge graph.
          </p>
        </div>
      </header>

      <ConnectorsSection />
    </div>
  );
}

/** @deprecated Use /connectors — kept for bookmarks */
export function AdaptersPageRedirect() {
  return <Navigate to="/connectors" replace />;
}

export function SemanticConnectorsPageRedirect() {
  return <Navigate to="/connectors" replace />;
}

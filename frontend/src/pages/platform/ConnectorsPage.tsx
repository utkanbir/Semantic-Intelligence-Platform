import { Navigate } from "react-router-dom";
import { InfrastructureConnectorsSection } from "./InfrastructureConnectorsSection";
import { SemanticConnectorsSection } from "./SemanticConnectorsSection";

export function ConnectorsPage() {
  return (
    <div className="connectors-page">
      <header className="platform-page__header">
        <div>
          <h1 id="connectors-heading">Connectors</h1>
          <p className="platform-page__lead">
            Register platform connectors by type — database, object storage, knowledge graph,
            ontology store, and more. Infrastructure connectors expose endpoints; semantic
            connectors bind ontology and knowledge-graph roles to active infrastructure.
          </p>
        </div>
      </header>

      <InfrastructureConnectorsSection />
      <SemanticConnectorsSection />
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

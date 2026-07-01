export function PlatformOverviewPage() {
  return (
    <section className="platform-page">
      <h1>Platform overview</h1>
      <p className="platform-page__lead">
        Manage platform-wide framework services—adapters, governance, and audit
        trace—or switch to Applications to work inside an application workspace.
      </p>
      <dl className="platform-page__summary">
        <div className="platform-page__summary-row">
          <dt>Platform</dt>
          <dd>Cross-cutting framework capabilities shared across all applications.</dd>
        </div>
        <div className="platform-page__summary-row">
          <dt>Applications</dt>
          <dd>
            Isolated workspaces for discovery, blueprints, products, and agents.
          </dd>
        </div>
      </dl>
    </section>
  );
}

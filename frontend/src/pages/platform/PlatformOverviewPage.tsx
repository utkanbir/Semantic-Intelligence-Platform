import { NavLink } from "react-router-dom";

const SUMMARY_CARDS = [
  {
    to: "/platform",
    label: "Platform",
    description: "Cross-cutting framework capabilities shared across all applications.",
    hint: "Connectors, governance, audit trace",
  },
  {
    to: "/applications",
    label: "Applications",
    description: "Isolated workspaces for discovery, blueprints, products, and agents.",
    hint: "Open application list",
  },
] as const;

export function PlatformOverviewPage() {
  return (
    <section className="platform-page">
      <h1>Platform overview</h1>
      <p className="platform-page__lead">
        Manage platform-wide framework services—connectors, governance, and audit
        trace—or switch to Applications to work inside an application workspace.
      </p>
      <div className="platform-page__summary">
        {SUMMARY_CARDS.map((card) => (
          <NavLink
            key={card.to}
            to={card.to}
            className={({ isActive }) =>
              `platform-page__summary-card${isActive ? " platform-page__summary-card--active" : ""}`
            }
          >
            <span className="platform-page__summary-label">{card.label}</span>
            <p className="platform-page__summary-description">{card.description}</p>
            <span className="platform-page__summary-hint">{card.hint} →</span>
          </NavLink>
        ))}
      </div>
    </section>
  );
}

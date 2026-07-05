import { NavLink } from "react-router-dom";

const PLATFORM_SECTIONS = [
  {
    to: "/connectors",
    label: "Connectors",
    description: "Manage infrastructure and semantic connectors shared across applications.",
    hint: "View and provision connectors",
  },
  {
    to: "/governance",
    label: "Governance",
    description: "Define and track policies that govern platform data and operations.",
    hint: "Browse governance policies",
  },
  {
    to: "/semantic-transactions",
    label: "Semantic Transactions",
    description: "Review semantic lineage — how meaning evolved for ontologies, products, and agents.",
    hint: "Browse semantic transactions",
  },
  {
    to: "/audit-trace",
    label: "Audit Trace",
    description: "Explore operational and platform trace records, including connector events.",
    hint: "Browse audit trace records",
  },
] as const;

export function PlatformHubPage() {
  return (
    <section className="platform-page" aria-labelledby="platform-hub-heading">
      <h1 id="platform-hub-heading">Platform</h1>
      <p className="platform-page__lead">
        Cross-cutting framework capabilities shared across all applications—connectors,
        governance, and semantic transactions.
      </p>
      <div className="platform-page__summary">
        {PLATFORM_SECTIONS.map((section) => (
          <NavLink
            key={section.to}
            to={section.to}
            className={({ isActive }) =>
              `platform-page__summary-card${isActive ? " platform-page__summary-card--active" : ""}`
            }
          >
            <span className="platform-page__summary-label">{section.label}</span>
            <p className="platform-page__summary-description">{section.description}</p>
            <span className="platform-page__summary-hint">{section.hint} →</span>
          </NavLink>
        ))}
      </div>
    </section>
  );
}

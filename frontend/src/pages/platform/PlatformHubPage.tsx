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
    to: "/audit-trace",
    label: "Audit Trace",
    description: "Review semantic transactions and trace steps across platform activity.",
    hint: "Search audit trace",
  },
] as const;

export function PlatformHubPage() {
  return (
    <section className="platform-page" aria-labelledby="platform-hub-heading">
      <h1 id="platform-hub-heading">Platform</h1>
      <p className="platform-page__lead">
        Cross-cutting framework capabilities shared across all applications—connectors,
        governance, and audit trace.
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

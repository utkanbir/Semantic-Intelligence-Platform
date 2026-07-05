import { type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import type { ApplicationResponse } from "../api/applications";

interface ApplicationShellProps {
  application: ApplicationResponse;
  children: ReactNode;
}

const SECTIONS = [
  { segment: "", label: "Overview", end: true },
  { segment: "discovery", label: "Discovery", end: false },
  { segment: "blueprint", label: "Blueprint", end: false },
  { segment: "assets", label: "Assets", end: false },
  { segment: "ontology", label: "Ontology", end: false },
  { segment: "knowledge-graph", label: "Knowledge graph", end: false },
  { segment: "products", label: "Products", end: false },
  { segment: "agents", label: "Agents", end: false },
  { segment: "agent-runs", label: "Agent runs", end: false },
  { segment: "semantic-transactions", label: "Semantic transactions", end: false },
  { segment: "audit-trace", label: "Audit trace", end: false },
] as const;

function statusLabel(status: ApplicationResponse["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ApplicationShell({ application, children }: ApplicationShellProps) {
  const basePath = `/applications/${application.id}`;

  return (
    <div className="application-shell">
      <nav className="application-shell__context" aria-label="Breadcrumb">
        <Link to="/applications" className="application-shell__back">
          ← Back to Applications
        </Link>
        <ol className="application-shell__breadcrumb">
          <li className="application-shell__breadcrumb-item">
            <Link to="/applications">Applications</Link>
          </li>
          <li
            className="application-shell__breadcrumb-item application-shell__breadcrumb-item--current"
            aria-current="page"
          >
            {application.name}
          </li>
        </ol>
      </nav>

      <header className="application-shell__header">
        <div className="application-shell__identity">
          <h1 className="application-shell__title">{application.name}</h1>
          <code className="application-shell__key">{application.key}</code>
          <span
            className={`application-shell__status application-shell__status--${application.status}`}
          >
            {statusLabel(application.status)}
          </span>
        </div>
      </header>

      <div className="application-shell__body">
        <nav className="application-shell__nav" aria-label="Application sections">
          <ul className="application-shell__nav-list">
            {SECTIONS.map((section) => (
              <li key={section.label}>
                <NavLink
                  to={section.segment ? `${basePath}/${section.segment}` : basePath}
                  end={section.end}
                  className={({ isActive }) =>
                    `application-shell__nav-link${
                      isActive ? " application-shell__nav-link--active" : ""
                    }`
                  }
                >
                  {section.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="application-shell__content">{children}</div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import type { ApplicationResponse } from "../../api/applications";
import type { HomeStatusBadge } from "../../pages/platform/homeUtils";

export interface HomeEntityRow {
  id: string;
  title: string;
  subtitle: string;
  status: HomeStatusBadge;
  to: string;
}

interface HomeEntityPanelProps {
  headingId: string;
  title: string;
  summaryLine: string;
  note?: string;
  listHeading: string;
  rows: HomeEntityRow[];
  emptyMessage: string;
}

export function HomeEntityPanel({
  headingId,
  title,
  summaryLine,
  note,
  listHeading,
  rows,
  emptyMessage,
}: HomeEntityPanelProps) {
  return (
    <article className="home-panel" aria-labelledby={headingId}>
      <header className="home-panel__intro">
        <h2 id={headingId} className="home-panel__title">
          {title}
        </h2>
        <p className="home-panel__summary">{summaryLine}</p>
        {note ? <p className="home-panel__note">{note}</p> : null}
      </header>

      <section className="home-panel__list" aria-labelledby={`${headingId}-list`}>
        <h3 id={`${headingId}-list`} className="home-panel__list-heading">
          {listHeading}
        </h3>

        {rows.length === 0 ? (
          <p className="home-panel__empty" role="status">
            {emptyMessage}
          </p>
        ) : (
          <ul className="home-panel__items">
            {rows.map((row) => (
              <li key={row.id}>
                <Link to={row.to} className="home-panel__item">
                  <div className="home-panel__item-body">
                    <span className="home-panel__item-title">{row.title}</span>
                    <span className="home-panel__item-subtitle">{row.subtitle}</span>
                  </div>
                  <span
                    className={`home-panel__badge home-panel__badge--${row.status.tone}`}
                  >
                    {row.status.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

export function applicationRows(
  applications: ApplicationResponse[],
  mapStatus: (status: ApplicationResponse["status"]) => HomeStatusBadge,
  subtitleFor: (application: ApplicationResponse) => string,
): HomeEntityRow[] {
  return applications.map((application) => ({
    id: application.id,
    title: application.name,
    subtitle: subtitleFor(application),
    status: mapStatus(application.status),
    to: `/applications/${application.id}`,
  }));
}

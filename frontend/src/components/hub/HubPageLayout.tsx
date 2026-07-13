import type { ReactNode } from "react";

interface HubPageLayoutProps {
  title: string;
  lead: ReactNode;
  children: ReactNode;
  headingId?: string;
}

export function HubPageLayout({ title, lead, children, headingId }: HubPageLayoutProps) {
  return (
    <section className="hub-page" aria-labelledby={headingId ?? "hub-page-heading"}>
      <header className="hub-page__header">
        <h1 id={headingId ?? "hub-page-heading"} className="hub-page__title">
          {title}
        </h1>
        <p className="hub-page__lead">{lead}</p>
      </header>
      <div className="hub-page__body">{children}</div>
    </section>
  );
}

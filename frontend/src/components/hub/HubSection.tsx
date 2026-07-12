import type { ReactNode } from "react";

interface HubSectionProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
  headingId: string;
}

export function HubSection({ title, description, children, headingId }: HubSectionProps) {
  return (
    <section className="hub-section" aria-labelledby={headingId}>
      <div className="hub-section__header">
        <h2 id={headingId} className="hub-section__title">
          {title}
        </h2>
        <p className="hub-section__description">{description}</p>
      </div>
      <div className="hub-section__grid">{children}</div>
    </section>
  );
}

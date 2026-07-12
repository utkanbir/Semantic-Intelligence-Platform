import { NavLink } from "react-router-dom";

export interface HubNavCardProps {
  to: string;
  eyebrow?: string;
  title: string;
  description: string;
  actionLabel: string;
  variant?: "default" | "featured";
}

export function HubNavCard({
  to,
  eyebrow,
  title,
  description,
  actionLabel,
  variant = "default",
}: HubNavCardProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `hub-card hub-card--${variant}${isActive ? " hub-card--active" : ""}`
      }
    >
      {eyebrow ? <span className="hub-card__eyebrow">{eyebrow}</span> : null}
      <span className="hub-card__title">{title}</span>
      <p className="hub-card__description">{description}</p>
      <span className="hub-card__action">{actionLabel} →</span>
    </NavLink>
  );
}

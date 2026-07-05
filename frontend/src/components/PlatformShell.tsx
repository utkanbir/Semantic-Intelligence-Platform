import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { getHealth } from "../api";

interface PlatformShellProps {
  children: ReactNode;
}

type BackendConnectionStatus = "loading" | "connected" | "disconnected";

const PLATFORM_NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/connectors", label: "Connectors", end: true },
  { to: "/governance", label: "Governance", end: true },
  { to: "/semantic-transactions", label: "Semantic Transactions", end: true },
  { to: "/audit-trace", label: "Audit Trace", end: true },
] as const;

function connectionLabel(status: BackendConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Backend connected";
    case "disconnected":
      return "Backend disconnected";
    default:
      return "Checking backend…";
  }
}

function navLinkClass(isActive: boolean): string {
  return `platform-nav__link${isActive ? " platform-nav__link--active" : ""}`;
}

export function PlatformShell({ children }: PlatformShellProps) {
  const [connectionStatus, setConnectionStatus] =
    useState<BackendConnectionStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((health) => {
        if (!cancelled) {
          setConnectionStatus(health.status === "ok" ? "connected" : "disconnected");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnectionStatus("disconnected");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="platform-shell">
      <header className="platform-header">
        <div className="platform-header__brand">
          <span className="platform-header__title">Semantic Intelligence Platform</span>
        </div>
        <div className="platform-header__actions">
          <span
            className={`backend-status backend-status--${connectionStatus}`}
            role="status"
            aria-live="polite"
          >
            {connectionLabel(connectionStatus)}
          </span>
          <nav className="platform-nav" aria-label="Primary">
            <div className="platform-nav__group">
              <span className="platform-nav__label">Platform</span>
              <ul className="platform-nav__list">
                {PLATFORM_NAV.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => navLinkClass(isActive)}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
            <div className="platform-nav__group">
              <span className="platform-nav__label">Applications</span>
              <ul className="platform-nav__list">
                <li>
                  <NavLink
                    to="/applications"
                    className={({ isActive }) => navLinkClass(isActive)}
                  >
                    Applications
                  </NavLink>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      </header>
      <main className="platform-main">{children}</main>
    </div>
  );
}

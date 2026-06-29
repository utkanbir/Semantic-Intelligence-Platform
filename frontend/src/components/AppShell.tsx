import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__title">Semantic Intelligence Platform</span>
        </div>
        <nav className="app-nav" aria-label="Primary">
          <a href="/" className="app-nav__link app-nav__link--active" aria-current="page">
            Applications
          </a>
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}

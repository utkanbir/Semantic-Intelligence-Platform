import { NavLink } from "react-router-dom";

interface OntologyAreaNavProps {
  applicationId: string;
}

export function OntologyAreaNav({ applicationId }: OntologyAreaNavProps) {
  const basePath = `/applications/${applicationId}/ontology`;

  return (
    <nav className="ontology-area-nav" aria-label="Ontology area">
      <NavLink
        to={basePath}
        end
        className={({ isActive }) =>
          `ontology-area-nav__link${isActive ? " ontology-area-nav__link--active" : ""}`
        }
      >
        Definitions
      </NavLink>
      <NavLink
        to={`${basePath}/chat`}
        className={({ isActive }) =>
          `ontology-area-nav__link${isActive ? " ontology-area-nav__link--active" : ""}`
        }
      >
        Chat
      </NavLink>
    </nav>
  );
}

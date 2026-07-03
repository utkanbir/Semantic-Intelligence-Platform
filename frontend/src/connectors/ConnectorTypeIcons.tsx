import type { ConnectorType } from "../api/adapters";

interface IconProps {
  className?: string;
}

function DatabaseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <ellipse cx="16" cy="8" rx="10" ry="4" fill="currentColor" opacity="0.25" />
      <path
        d="M6 8v16c0 2.2 4.5 4 10 4s10-1.8 10-4V8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <ellipse cx="16" cy="8" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M6 16c0 2.2 4.5 4 10 4s10-1.8 10-4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ObjectStorageIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        d="M8 14l8-6 8 6v12H8V14z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M8 14h16" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="18" width="6" height="6" rx="1" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

function FileSystemIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        d="M6 10h8l2 3h10v13H6V10z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M6 13h26" stroke="currentColor" strokeWidth="2" opacity="0.4" />
    </svg>
  );
}

function KnowledgeGraphIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="8" cy="16" r="3" fill="currentColor" />
      <circle cx="24" cy="8" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="24" cy="24" r="3" fill="currentColor" opacity="0.7" />
      <path
        d="M11 15l10-5M11 17l10 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function VectorDatabaseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="5" y="6" width="6" height="20" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="13" y="10" width="6" height="16" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="21" y="14" width="6" height="12" rx="1" fill="currentColor" opacity="0.8" />
      <path
        d="M4 26h24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

const CONNECTOR_TYPE_ICON_COMPONENTS: Record<ConnectorType, (props: IconProps) => JSX.Element> = {
  database: DatabaseIcon,
  object_storage: ObjectStorageIcon,
  file_system: FileSystemIcon,
  ontology_knowledge_graph: KnowledgeGraphIcon,
  vector_database: VectorDatabaseIcon,
};

export function ConnectorTypeIcon({
  connectorType,
  className,
}: {
  connectorType: ConnectorType;
  className?: string;
}) {
  const Icon = CONNECTOR_TYPE_ICON_COMPONENTS[connectorType];
  return <Icon className={className} />;
}

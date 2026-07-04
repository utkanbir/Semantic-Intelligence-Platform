interface IconProps {
  className?: string;
}

function PostgreSQLIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        d="M16 4c-5 0-8 3-8 8v4c0 2 1 4 3 5v7h10v-7c2-1 3-3 3-5v-4c0-5-3-8-8-8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="13" cy="14" r="1.5" fill="currentColor" />
      <circle cx="19" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

function OracleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <ellipse cx="16" cy="16" rx="12" ry="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 16h16" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function MySQLIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        d="M8 20c2-4 6-8 8-8s6 4 8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M10 22h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MssqlIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="6" y="8" width="9" height="16" rx="1" fill="currentColor" opacity="0.35" />
      <rect x="17" y="8" width="9" height="16" rx="1" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function MinioIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M6 12h20l-2 14H8L6 12z" fill="currentColor" opacity="0.35" />
      <path d="M6 12l3-6h14l3 6" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function S3Icon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        d="M16 6l10 5v10l-10 5L6 21V11l10-5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M16 11v10M6 11l10 5 10-5" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

function AzureBlobIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M8 22l4-12h8l4 12H8z" fill="currentColor" opacity="0.4" />
      <path d="M10 10h12l-2 6H12l-2-6z" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function GcsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        d="M16 6l8 4.5v9L16 24l-8-4.5v-9L16 6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="15" r="3" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function LocalIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="8" y="10" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 10V8h8v2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function NfsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="6" y="12" width="20" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="11" cy="18" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="16" cy="18" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="21" cy="18" r="2" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function SmbIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M6 14h20v10H6z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 14v-4h12v4" stroke="currentColor" strokeWidth="2" />
      <path d="M12 20h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FusekiIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="10" cy="16" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="22" cy="10" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="22" cy="22" r="3" fill="currentColor" opacity="0.5" />
      <path d="M14 14l6-2M14 18l6 2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function MicrosoftGraphIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="6" y="6" width="9" height="9" fill="currentColor" opacity="0.5" />
      <rect x="17" y="6" width="9" height="9" fill="currentColor" opacity="0.7" />
      <rect x="6" y="17" width="9" height="9" fill="currentColor" opacity="0.7" />
      <rect x="17" y="17" width="9" height="9" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function Neo4jIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="8" r="3" fill="currentColor" />
      <circle cx="8" cy="22" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="24" cy="22" r="3" fill="currentColor" opacity="0.7" />
      <path d="M16 11l-6 8M16 11l6 8M11 22h10" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function FilesystemStoreIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M6 12h10l2 3h10v11H6V12z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 18h12M10 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function QdrantIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="3" fill="currentColor" />
      <path d="M16 6v4M16 22v4M6 16h4M22 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PgvectorIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <ellipse cx="16" cy="10" rx="9" ry="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M7 10v12c0 1.7 4 3 9 3s9-1.3 9-3V10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 18l2 2 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WeaviateIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        d="M8 24V12l8-6 8 6v12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 20h8M12 16h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function GenericVendorIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="4" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

const VENDOR_ICON_COMPONENTS: Record<string, (props: IconProps) => JSX.Element> = {
  postgresql: PostgreSQLIcon,
  oracle: OracleIcon,
  mysql: MySQLIcon,
  mssql: MssqlIcon,
  minio: MinioIcon,
  s3: S3Icon,
  azure_blob: AzureBlobIcon,
  gcs: GcsIcon,
  local: LocalIcon,
  nfs: NfsIcon,
  smb: SmbIcon,
  apache_fuseki: FusekiIcon,
  microsoft_graph: MicrosoftGraphIcon,
  neo4j: Neo4jIcon,
  filesystem: FilesystemStoreIcon,
  qdrant: QdrantIcon,
  pgvector: PgvectorIcon,
  weaviate: WeaviateIcon,
};

export function ConnectorVendorIcon({
  vendorId,
  className,
}: {
  vendorId: string;
  className?: string;
}) {
  const Icon = VENDOR_ICON_COMPONENTS[vendorId] ?? GenericVendorIcon;
  return <Icon className={className} />;
}

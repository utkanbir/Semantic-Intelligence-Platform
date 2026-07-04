import type { ConnectorType } from "../api/adapters";

export type ConnectionMethod = "existing_instance" | "provision_in_cluster";

export interface ConnectorVendor {
  id: string;
  label: string;
}

export interface ConnectionField {
  id: string;
  label: string;
  inputType?: "text" | "number" | "password";
  placeholder?: string;
  required?: boolean;
}

export const VENDORS_BY_CONNECTOR_TYPE: Record<ConnectorType, ConnectorVendor[]> = {
  database: [
    { id: "postgresql", label: "PostgreSQL" },
    { id: "oracle", label: "Oracle" },
    { id: "mysql", label: "MySQL" },
    { id: "mssql", label: "Microsoft SQL Server" },
  ],
  object_storage: [
    { id: "minio", label: "MinIO" },
    { id: "s3", label: "Amazon S3" },
    { id: "azure_blob", label: "Azure Blob Storage" },
    { id: "gcs", label: "Google Cloud Storage" },
  ],
  file_system: [
    { id: "local", label: "Local filesystem" },
    { id: "nfs", label: "NFS" },
    { id: "smb", label: "SMB / CIFS" },
  ],
  ontology_knowledge_graph: [
    { id: "apache_fuseki", label: "Apache Jena Fuseki" },
    { id: "microsoft_graph", label: "Microsoft Graph" },
    { id: "neo4j", label: "Neo4j" },
    { id: "filesystem", label: "Filesystem store" },
  ],
  vector_database: [
    { id: "qdrant", label: "Qdrant" },
    { id: "pgvector", label: "pgvector" },
    { id: "weaviate", label: "Weaviate" },
  ],
};

const DEFAULT_CONNECTION_FIELDS: ConnectionField[] = [
  { id: "host", label: "Host", placeholder: "hostname or IP", required: true },
  { id: "port", label: "Port", inputType: "number", placeholder: "443" },
];

export const CONNECTION_FIELDS_BY_VENDOR: Record<string, ConnectionField[]> = {
  postgresql: [
    ...DEFAULT_CONNECTION_FIELDS,
    { id: "database", label: "Database", required: true },
    { id: "username", label: "Username" },
    { id: "password", label: "Password", inputType: "password" },
  ],
  oracle: [
    ...DEFAULT_CONNECTION_FIELDS,
    { id: "service_name", label: "Service name / SID", required: true },
    { id: "username", label: "Username" },
    { id: "password", label: "Password", inputType: "password" },
  ],
  mysql: [
    ...DEFAULT_CONNECTION_FIELDS,
    { id: "database", label: "Database", required: true },
    { id: "username", label: "Username" },
    { id: "password", label: "Password", inputType: "password" },
  ],
  mssql: [
    ...DEFAULT_CONNECTION_FIELDS,
    { id: "database", label: "Database", required: true },
    { id: "username", label: "Username" },
    { id: "password", label: "Password", inputType: "password" },
  ],
  minio: [
    { id: "endpoint", label: "Endpoint URL", placeholder: "https://minio.example.com", required: true },
    { id: "bucket", label: "Bucket", required: true },
    { id: "access_key", label: "Access key" },
    { id: "secret_key", label: "Secret key", inputType: "password" },
  ],
  s3: [
    { id: "region", label: "Region", placeholder: "eu-west-1", required: true },
    { id: "bucket", label: "Bucket", required: true },
    { id: "access_key", label: "Access key ID" },
    { id: "secret_key", label: "Secret access key", inputType: "password" },
  ],
  azure_blob: [
    { id: "account_name", label: "Storage account", required: true },
    { id: "container", label: "Container", required: true },
    { id: "connection_string", label: "Connection string", inputType: "password" },
  ],
  gcs: [
    { id: "project_id", label: "Project ID", required: true },
    { id: "bucket", label: "Bucket", required: true },
    { id: "credentials_ref", label: "Credentials ref", placeholder: "Secret or key path" },
  ],
  local: [{ id: "base_path", label: "Base path", placeholder: "/data/connectors", required: true }],
  nfs: [
    { id: "server", label: "NFS server", required: true },
    { id: "export_path", label: "Export path", placeholder: "/exports/data", required: true },
  ],
  smb: [
    { id: "server", label: "SMB server", required: true },
    { id: "share", label: "Share name", required: true },
    { id: "username", label: "Username" },
    { id: "password", label: "Password", inputType: "password" },
  ],
  apache_fuseki: [
    { id: "endpoint", label: "SPARQL endpoint URL", placeholder: "http://fuseki:3030/ds", required: true },
    { id: "dataset", label: "Dataset", required: true },
    { id: "username", label: "Username" },
    { id: "password", label: "Password", inputType: "password" },
  ],
  microsoft_graph: [
    { id: "tenant_id", label: "Tenant ID", required: true },
    { id: "client_id", label: "Client ID", required: true },
    { id: "client_secret", label: "Client secret", inputType: "password" },
  ],
  neo4j: [
    ...DEFAULT_CONNECTION_FIELDS,
    { id: "database", label: "Database", placeholder: "neo4j" },
    { id: "username", label: "Username" },
    { id: "password", label: "Password", inputType: "password" },
  ],
  filesystem: [
    { id: "base_path", label: "Store path", placeholder: "/var/ontology", required: true },
  ],
  qdrant: [
    ...DEFAULT_CONNECTION_FIELDS,
    { id: "collection", label: "Collection", required: true },
    { id: "api_key", label: "API key", inputType: "password" },
  ],
  pgvector: [
    ...DEFAULT_CONNECTION_FIELDS,
    { id: "database", label: "Database", required: true },
    { id: "schema", label: "Schema", placeholder: "public" },
    { id: "username", label: "Username" },
    { id: "password", label: "Password", inputType: "password" },
  ],
  weaviate: [
    { id: "endpoint", label: "Endpoint URL", placeholder: "http://weaviate:8080", required: true },
    { id: "class_name", label: "Class name", required: true },
    { id: "api_key", label: "API key", inputType: "password" },
  ],
};

export function getDefaultVendor(connectorType: ConnectorType): string {
  return VENDORS_BY_CONNECTOR_TYPE[connectorType][0]?.id ?? "";
}

export function getVendorLabel(connectorType: ConnectorType, vendorId: string): string {
  const vendor = VENDORS_BY_CONNECTOR_TYPE[connectorType].find((item) => item.id === vendorId);
  return vendor?.label ?? vendorId;
}

export function getConnectionFields(vendorId: string): ConnectionField[] {
  return CONNECTION_FIELDS_BY_VENDOR[vendorId] ?? DEFAULT_CONNECTION_FIELDS;
}

export function buildConnectorConfiguration(
  vendor: string,
  connectionMethod: ConnectionMethod,
  connectionValues: Record<string, string>,
): Record<string, unknown> {
  return {
    schema_version: "2",
    vendor,
    connection_method: connectionMethod,
    connection: connectionValues,
  };
}

export function readConnectorVendor(configuration: Record<string, unknown>): string | null {
  const vendor = configuration.vendor;
  return typeof vendor === "string" ? vendor : null;
}

export function readConnectionMethod(
  configuration: Record<string, unknown>,
): ConnectionMethod | null {
  const method = configuration.connection_method;
  if (method === "existing_instance" || method === "provision_in_cluster") {
    return method;
  }
  return null;
}

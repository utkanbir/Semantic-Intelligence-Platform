export interface OntologyClassRow {
  id: string;
  label: string;
  description: string;
}

export interface OntologyObjectPropertyRow {
  id: string;
  label: string;
  description: string;
  domain: string;
  range: string;
}

export interface OntologyDataPropertyRow {
  id: string;
  label: string;
  description: string;
  domain: string;
  datatype: string;
}

export interface ManualOntologyDraftInput {
  title: string;
  namespaceIri: string;
  prefix: string;
  description: string;
  classes: OntologyClassRow[];
  objectProperties: OntologyObjectPropertyRow[];
  dataProperties: OntologyDataPropertyRow[];
}

export interface OntologyDefinitionPayload {
  schema_version: string;
  classes: Array<{
    name: string;
    label?: string;
    description?: string;
  }>;
  properties: Array<{
    name: string;
    domain?: string;
    datatype?: string;
    label?: string;
    description?: string;
  }>;
  relationships: Array<{
    name: string;
    domain?: string;
    range?: string;
    label?: string;
    description?: string;
  }>;
  metadata: Record<string, unknown>;
}

const XSD_PREFIX = "http://www.w3.org/2001/XMLSchema#";

export function createRowId(): string {
  return `row-${Math.random().toString(36).slice(2, 10)}`;
}

export function localNameFromLabel(label: string, fallback: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return fallback;
  }

  const words = trimmed
    .replace(/[^A-Za-z0-9_\s-]/g, " ")
    .split(/[\s_-]+/)
    .filter(Boolean);

  if (words.length === 0) {
    return fallback;
  }

  const pascal = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");

  return /^[A-Za-z]/.test(pascal) ? pascal : `C${pascal}`;
}

function escapeTurtleLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n");
}

function normalizePrefix(prefix: string): string {
  return prefix.trim().replace(/:$/, "");
}

function normalizeDatatype(datatype: string): string {
  const trimmed = datatype.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.includes(":")) {
    return trimmed;
  }

  return `xsd:${trimmed}`;
}

function formatDatatypeTurtle(datatype: string): string {
  const normalized = normalizeDatatype(datatype);
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("xsd:")) {
    return normalized;
  }

  if (normalized.startsWith(XSD_PREFIX)) {
    return `xsd:${normalized.slice(XSD_PREFIX.length)}`;
  }

  return normalized;
}

function classNamesFromDraft(draft: ManualOntologyDraftInput): string[] {
  return draft.classes
    .map((row, index) => localNameFromLabel(row.label, `Class${index + 1}`))
    .filter(Boolean);
}

export function buildOntologyDefinition(
  draft: ManualOntologyDraftInput,
): OntologyDefinitionPayload {
  const namespace = draft.namespaceIri.trim();
  const prefix = normalizePrefix(draft.prefix);

  return {
    schema_version: "1",
    classes: draft.classes.map((row, index) => {
      const name = localNameFromLabel(row.label, `Class${index + 1}`);
      return {
        name,
        ...(row.label.trim() ? { label: row.label.trim() } : {}),
        ...(row.description.trim() ? { description: row.description.trim() } : {}),
      };
    }),
    properties: draft.dataProperties.map((row, index) => {
      const name = localNameFromLabel(row.label, `DataProperty${index + 1}`);
      return {
        name,
        ...(row.domain.trim() ? { domain: row.domain.trim() } : {}),
        ...(row.datatype.trim() ? { datatype: normalizeDatatype(row.datatype) } : {}),
        ...(row.label.trim() ? { label: row.label.trim() } : {}),
        ...(row.description.trim() ? { description: row.description.trim() } : {}),
      };
    }),
    relationships: draft.objectProperties.map((row, index) => {
      const name = localNameFromLabel(row.label, `ObjectProperty${index + 1}`);
      return {
        name,
        ...(row.domain.trim() ? { domain: row.domain.trim() } : {}),
        ...(row.range.trim() ? { range: row.range.trim() } : {}),
        ...(row.label.trim() ? { label: row.label.trim() } : {}),
        ...(row.description.trim() ? { description: row.description.trim() } : {}),
      };
    }),
    metadata: {
      namespace,
      prefix,
      manual: {
        namespace,
        prefix,
      },
    },
  };
}

export function buildTurtleFromDraft(draft: ManualOntologyDraftInput): string {
  const namespace = draft.namespaceIri.trim();
  const prefix = normalizePrefix(draft.prefix);
  if (!namespace || !prefix) {
    return "";
  }

  const lines = [
    "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
    "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
    `@prefix ${prefix}: <${namespace}> .`,
    "",
  ];

  const ontologyLines = [`<${namespace}> a owl:Ontology`];
  if (draft.title.trim()) {
    ontologyLines.push(`  rdfs:label "${escapeTurtleLiteral(draft.title.trim())}"`);
  }
  if (draft.description.trim()) {
    ontologyLines.push(`  rdfs:comment "${escapeTurtleLiteral(draft.description.trim())}"`);
  }
  lines.push(
    ontologyLines.length === 1
      ? `${ontologyLines[0]} .`
      : `${ontologyLines[0]} ;\n${ontologyLines
          .slice(1)
          .map((line, index) =>
            index === ontologyLines.length - 2 ? `${line} .` : `${line} ;`,
          )
          .join("\n")}`,
  );

  draft.classes.forEach((row, index) => {
    const name = localNameFromLabel(row.label, `Class${index + 1}`);
    const classLines = [`${prefix}:${name} a owl:Class`];
    if (row.label.trim()) {
      classLines.push(`  rdfs:label "${escapeTurtleLiteral(row.label.trim())}"`);
    }
    if (row.description.trim()) {
      classLines.push(`  rdfs:comment "${escapeTurtleLiteral(row.description.trim())}"`);
    }
    lines.push("");
    lines.push(
      classLines.length === 1
        ? `${classLines[0]} .`
        : `${classLines[0]} ;\n${classLines
            .slice(1)
            .map((line, lineIndex) =>
              lineIndex === classLines.length - 2 ? `${line} .` : `${line} ;`,
            )
            .join("\n")}`,
    );
  });

  draft.objectProperties.forEach((row, index) => {
    const name = localNameFromLabel(row.label, `ObjectProperty${index + 1}`);
    const propertyLines = [`${prefix}:${name} a owl:ObjectProperty`];
    if (row.domain.trim()) {
      propertyLines.push(`  rdfs:domain ${prefix}:${row.domain.trim()}`);
    }
    if (row.range.trim()) {
      propertyLines.push(`  rdfs:range ${prefix}:${row.range.trim()}`);
    }
    if (row.label.trim()) {
      propertyLines.push(`  rdfs:label "${escapeTurtleLiteral(row.label.trim())}"`);
    }
    if (row.description.trim()) {
      propertyLines.push(`  rdfs:comment "${escapeTurtleLiteral(row.description.trim())}"`);
    }
    lines.push("");
    lines.push(
      propertyLines.length === 1
        ? `${propertyLines[0]} .`
        : `${propertyLines[0]} ;\n${propertyLines
            .slice(1)
            .map((line, lineIndex) =>
              lineIndex === propertyLines.length - 2 ? `${line} .` : `${line} ;`,
            )
            .join("\n")}`,
    );
  });

  draft.dataProperties.forEach((row, index) => {
    const name = localNameFromLabel(row.label, `DataProperty${index + 1}`);
    const datatypeTurtle = formatDatatypeTurtle(row.datatype);
    const propertyLines = [`${prefix}:${name} a owl:DatatypeProperty`];
    if (row.domain.trim()) {
      propertyLines.push(`  rdfs:domain ${prefix}:${row.domain.trim()}`);
    }
    if (datatypeTurtle) {
      propertyLines.push(`  rdfs:range ${datatypeTurtle}`);
    }
    if (row.label.trim()) {
      propertyLines.push(`  rdfs:label "${escapeTurtleLiteral(row.label.trim())}"`);
    }
    if (row.description.trim()) {
      propertyLines.push(`  rdfs:comment "${escapeTurtleLiteral(row.description.trim())}"`);
    }
    lines.push("");
    lines.push(
      propertyLines.length === 1
        ? `${propertyLines[0]} .`
        : `${propertyLines[0]} ;\n${propertyLines
            .slice(1)
            .map((line, lineIndex) =>
              lineIndex === propertyLines.length - 2 ? `${line} .` : `${line} ;`,
            )
            .join("\n")}`,
    );
  });

  return lines.join("\n");
}

export function buildOntologyDefinitionWithImport(
  draft: ManualOntologyDraftInput,
  options: {
    sourceContent: string;
    ontologyId?: string | null;
    validationReport?: Record<string, unknown> | null;
  },
): OntologyDefinitionPayload {
  const definition = buildOntologyDefinition(draft);
  const sourceContent = options.sourceContent.trim();
  const fusekiGraphUri = options.ontologyId
    ? `urn:sip:ontology:${options.ontologyId}`
    : undefined;

  definition.metadata = {
    ...definition.metadata,
    import: {
      source_format: "ttl",
      content_length: sourceContent.length,
      source_content: sourceContent,
      ...(fusekiGraphUri ? { fuseki_graph_uri: fusekiGraphUri } : {}),
    },
    ...(options.validationReport ? { validation: options.validationReport } : {}),
  };

  return definition;
}

export interface ManualDraftValidationIssue {
  id: string;
  label: string;
  passed: boolean;
}

export function buildManualDraftValidationChecks(
  draft: ManualOntologyDraftInput,
): ManualDraftValidationIssue[] {
  const namespace = draft.namespaceIri.trim();
  const prefix = normalizePrefix(draft.prefix);
  const classNames = classNamesFromDraft(draft);
  const definedClasses = new Set(classNames);
  const duplicateClassNames = classNames.filter(
    (name, index) => classNames.indexOf(name) !== index,
  );

  const propertyNames = [
    ...draft.objectProperties.map((row, index) =>
      localNameFromLabel(row.label, `ObjectProperty${index + 1}`),
    ),
    ...draft.dataProperties.map((row, index) =>
      localNameFromLabel(row.label, `DataProperty${index + 1}`),
    ),
  ];
  const duplicatePropertyNames = propertyNames.filter(
    (name, index) => propertyNames.indexOf(name) !== index,
  );

  const invalidDomains = [
    ...draft.objectProperties.filter(
      (row) => row.domain.trim() && !definedClasses.has(row.domain.trim()),
    ),
    ...draft.dataProperties.filter(
      (row) => row.domain.trim() && !definedClasses.has(row.domain.trim()),
    ),
  ];

  const invalidRanges = draft.objectProperties.filter(
    (row) => row.range.trim() && !definedClasses.has(row.range.trim()),
  );

  return [
    { id: "title", label: "Title provided", passed: Boolean(draft.title.trim()) },
    {
      id: "namespace",
      label: "Namespace / base IRI provided",
      passed: Boolean(namespace),
    },
    { id: "prefix", label: "Prefix provided", passed: Boolean(prefix) },
    {
      id: "prefix-pattern",
      label: "Prefix uses valid characters",
      passed: !prefix || /^[A-Za-z][A-Za-z0-9_-]*$/.test(prefix),
    },
    {
      id: "document",
      label: "Generated ontology document is non-empty",
      passed: Boolean(buildTurtleFromDraft(draft).trim()),
    },
    {
      id: "duplicate-classes",
      label: "Class labels map to unique names",
      passed: duplicateClassNames.length === 0,
    },
    {
      id: "duplicate-properties",
      label: "Property labels map to unique names",
      passed: duplicatePropertyNames.length === 0,
    },
    {
      id: "domain-references",
      label: "Property domains reference defined classes",
      passed: invalidDomains.length === 0,
    },
    {
      id: "range-references",
      label: "Object property ranges reference defined classes",
      passed: invalidRanges.length === 0,
    },
  ];
}

import type {
  CandidateEvidence,
  ClassCandidate,
  OntologyExtraction,
  PropertyCandidate,
  RelationshipCandidate,
} from "../api/ontologies";
import { createRowId } from "./ontologyDraft";

export interface GeneratedClassRow {
  id: string;
  name: string;
  label: string;
  description: string;
  evidence: CandidateEvidence[];
}

export interface GeneratedPropertyRow {
  id: string;
  name: string;
  label: string;
  domain: string;
  datatype: string;
  description: string;
  evidence: CandidateEvidence[];
}

export interface GeneratedRelationshipRow {
  id: string;
  name: string;
  label: string;
  domain: string;
  range: string;
  description: string;
  evidence: CandidateEvidence[];
}

export interface GeneratedDraftRows {
  classes: GeneratedClassRow[];
  properties: GeneratedPropertyRow[];
  relationships: GeneratedRelationshipRow[];
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value : "";
}

function normalizeEvidence(evidence: CandidateEvidence[] | undefined): CandidateEvidence[] {
  if (!Array.isArray(evidence)) {
    return [];
  }
  return evidence
    .filter((item): item is CandidateEvidence => Boolean(item) && typeof item.snippet === "string")
    .map((item) => ({
      snippet: item.snippet,
      source_ref: item.source_ref ?? null,
    }));
}

export function extractionToRows(extraction: OntologyExtraction): GeneratedDraftRows {
  return {
    classes: extraction.classes.map((item) => ({
      id: createRowId(),
      name: normalizeText(item.name),
      label: normalizeText(item.label),
      description: normalizeText(item.description),
      evidence: normalizeEvidence(item.evidence),
    })),
    properties: extraction.properties.map((item) => ({
      id: createRowId(),
      name: normalizeText(item.name),
      label: normalizeText(item.label),
      domain: normalizeText(item.domain),
      datatype: normalizeText(item.datatype),
      description: normalizeText(item.description),
      evidence: normalizeEvidence(item.evidence),
    })),
    relationships: extraction.relationships.map((item) => ({
      id: createRowId(),
      name: normalizeText(item.name),
      label: normalizeText(item.label),
      domain: normalizeText(item.domain),
      range: normalizeText(item.range),
      description: normalizeText(item.description),
      evidence: normalizeEvidence(item.evidence),
    })),
  };
}

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function classToDefinition(row: GeneratedClassRow): ClassCandidate {
  return {
    name: row.name.trim(),
    label: optional(row.label),
    description: optional(row.description),
    evidence: row.evidence,
  };
}

function propertyToDefinition(row: GeneratedPropertyRow): PropertyCandidate {
  return {
    name: row.name.trim(),
    label: optional(row.label),
    domain: optional(row.domain),
    datatype: optional(row.datatype),
    description: optional(row.description),
    evidence: row.evidence,
  };
}

function relationshipToDefinition(row: GeneratedRelationshipRow): RelationshipCandidate {
  return {
    name: row.name.trim(),
    label: optional(row.label),
    domain: optional(row.domain),
    range: optional(row.range),
    description: optional(row.description),
    evidence: row.evidence,
  };
}

/**
 * Rebuilds the ontology_definition body from edited candidate rows, preserving
 * the generate metadata (mode + extraction lineage) returned by the backend.
 * Rows with a blank name are dropped so an empty edit never persists a nameless
 * concept.
 */
export function rowsToGeneratedDefinition(
  rows: GeneratedDraftRows,
  baseDefinition: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...baseDefinition,
    schema_version:
      typeof baseDefinition.schema_version === "string" ? baseDefinition.schema_version : "1",
    classes: rows.classes.filter((row) => row.name.trim()).map(classToDefinition),
    properties: rows.properties.filter((row) => row.name.trim()).map(propertyToDefinition),
    relationships: rows.relationships
      .filter((row) => row.name.trim())
      .map(relationshipToDefinition),
  };
}

export function countCandidates(rows: GeneratedDraftRows): number {
  return rows.classes.length + rows.properties.length + rows.relationships.length;
}

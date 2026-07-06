import { useMemo, useState } from "react";
import type { OntologyValidationInventory } from "../api/ontologies";

const DEFAULT_VISIBLE_ROWS = 50;

function truncateUri(uri: string, maxLength = 56): string {
  if (uri.length <= maxLength) {
    return uri;
  }
  return `${uri.slice(0, maxLength)}…`;
}

function formatPropertyType(propertyType: OntologyValidationInventory["relations"][number]["property_type"]): string {
  return propertyType === "object" ? "Object" : "Datatype";
}

interface OntologyValidationInventoryProps {
  inventory: OntologyValidationInventory | null | undefined;
}

export function OntologyValidationInventoryView({
  inventory,
}: OntologyValidationInventoryProps) {
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [showAllRelations, setShowAllRelations] = useState(false);

  const visibleClasses = useMemo(() => {
    if (!inventory) {
      return [];
    }
    if (showAllClasses) {
      return inventory.classes;
    }
    return inventory.classes.slice(0, DEFAULT_VISIBLE_ROWS);
  }, [inventory, showAllClasses]);

  const visibleRelations = useMemo(() => {
    if (!inventory) {
      return [];
    }
    if (showAllRelations) {
      return inventory.relations;
    }
    return inventory.relations.slice(0, DEFAULT_VISIBLE_ROWS);
  }, [inventory, showAllRelations]);

  if (!inventory) {
    return null;
  }

  return (
    <section className="ontology-validation-page__section" aria-labelledby="validation-inventory">
      <h4 id="validation-inventory">Ontology structure</h4>

      {inventory.truncated && (
        <p className="ontology-validation-page__muted" role="status">
          Large ontology — inventory capped at server limit. Re-run validation after edits if needed.
        </p>
      )}

      <div className="ontology-validation-page__inventory-block">
        <h5>Classes ({inventory.classes.length})</h5>
        {inventory.classes.length === 0 ? (
          <p className="ontology-validation-page__muted">No explicit OWL classes detected.</p>
        ) : (
          <>
            <div className="ontologies-page__table-wrap">
              <table className="ontologies-table">
                <thead>
                  <tr>
                    <th scope="col">Label</th>
                    <th scope="col">URI</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleClasses.map((item) => (
                    <tr key={item.uri}>
                      <td>{item.label ?? item.local_name}</td>
                      <td>
                        <code title={item.uri}>{truncateUri(item.uri)}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {inventory.classes.length > DEFAULT_VISIBLE_ROWS && !showAllClasses && (
              <button
                type="button"
                className="ontologies-page__button ontologies-page__button--secondary"
                onClick={() => setShowAllClasses(true)}
              >
                Show all classes
              </button>
            )}
          </>
        )}
      </div>

      <div className="ontology-validation-page__inventory-block">
        <h5>Relations ({inventory.relations.length})</h5>
        {inventory.relations.length === 0 ? (
          <p className="ontology-validation-page__muted">No explicit OWL properties detected.</p>
        ) : (
          <>
            <div className="ontologies-page__table-wrap">
              <table className="ontologies-table">
                <thead>
                  <tr>
                    <th scope="col">Label</th>
                    <th scope="col">Type</th>
                    <th scope="col">Domain</th>
                    <th scope="col">Range</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRelations.map((item) => (
                    <tr key={item.uri}>
                      <td>{item.label ?? item.local_name}</td>
                      <td>{formatPropertyType(item.property_type)}</td>
                      <td>
                        {item.domain ? (
                          <code title={item.domain}>{truncateUri(item.domain, 40)}</code>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {item.range ? (
                          <code title={item.range}>{truncateUri(item.range, 40)}</code>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {inventory.relations.length > DEFAULT_VISIBLE_ROWS && !showAllRelations && (
              <button
                type="button"
                className="ontologies-page__button ontologies-page__button--secondary"
                onClick={() => setShowAllRelations(true)}
              >
                Show all relations
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

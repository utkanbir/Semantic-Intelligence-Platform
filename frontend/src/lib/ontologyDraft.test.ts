import { describe, expect, it } from "vitest";
import {
  buildManualDraftValidationChecks,
  buildOntologyDefinition,
  buildTurtleFromDraft,
  localNameFromLabel,
} from "./ontologyDraft";

describe("ontologyDraft", () => {
  const baseDraft = {
    title: "Customer Ontology",
    namespaceIri: "https://example.com/customer#",
    prefix: "cust",
    description: "Business vocabulary",
    classes: [{ id: "class-1", label: "Customer", description: "A customer record" }],
    objectProperties: [
      {
        id: "obj-1",
        label: "placed order",
        description: "Links customer to order",
        domain: "Customer",
        range: "Order",
      },
    ],
    dataProperties: [
      {
        id: "data-1",
        label: "email",
        description: "Customer email",
        domain: "Customer",
        datatype: "string",
      },
    ],
  };

  it("derives stable local names from labels", () => {
    expect(localNameFromLabel("placed order", "Fallback")).toBe("PlacedOrder");
    expect(localNameFromLabel("", "Fallback")).toBe("Fallback");
  });

  it("builds structured ontology_definition payloads", () => {
    const definition = buildOntologyDefinition({
      ...baseDraft,
      classes: [
        { id: "class-1", label: "Customer", description: "A customer record" },
        { id: "class-2", label: "Order", description: "" },
      ],
      objectProperties: [
        {
          id: "obj-1",
          label: "placed order",
          description: "",
          domain: "Customer",
          range: "Order",
        },
      ],
    });

    expect(definition.classes).toEqual([
      { name: "Customer", label: "Customer", description: "A customer record" },
      { name: "Order", label: "Order" },
    ]);
    expect(definition.relationships[0]).toMatchObject({
      name: "PlacedOrder",
      domain: "Customer",
      range: "Order",
      label: "placed order",
    });
    expect(definition.properties[0]).toMatchObject({
      name: "Email",
      domain: "Customer",
      datatype: "xsd:string",
      label: "email",
    });
    expect(definition.metadata).toMatchObject({
      namespace: "https://example.com/customer#",
      prefix: "cust",
    });
  });

  it("generates turtle preview with classes and properties", () => {
    const turtle = buildTurtleFromDraft({
      ...baseDraft,
      classes: [
        { id: "class-1", label: "Customer", description: "A customer record" },
        { id: "class-2", label: "Order", description: "" },
      ],
      objectProperties: [
        {
          id: "obj-1",
          label: "placed order",
          description: "",
          domain: "Customer",
          range: "Order",
        },
      ],
    });

    expect(turtle).toContain("@prefix cust: <https://example.com/customer#> .");
    expect(turtle).toContain('rdfs:label "Customer Ontology"');
    expect(turtle).toContain("cust:Customer a owl:Class");
    expect(turtle).toContain("cust:PlacedOrder a owl:ObjectProperty");
    expect(turtle).toContain("rdfs:domain cust:Customer");
    expect(turtle).toContain("rdfs:range cust:Order");
    expect(turtle).toContain("cust:Email a owl:DatatypeProperty");
    expect(turtle).toContain("rdfs:range xsd:string");
  });

  it("flags invalid domain and range references in validation checks", () => {
    const checks = buildManualDraftValidationChecks({
      ...baseDraft,
      objectProperties: [
        {
          id: "obj-1",
          label: "placed order",
          description: "",
          domain: "Missing",
          range: "AlsoMissing",
        },
      ],
    });

    expect(checks.find((check) => check.id === "domain-references")?.passed).toBe(false);
    expect(checks.find((check) => check.id === "range-references")?.passed).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildConnectorConfiguration,
  getConnectionFields,
  getDefaultVendor,
  getVendorLabel,
  VENDORS_BY_CONNECTOR_TYPE,
} from "./catalog";

describe("connector catalog", () => {
  it("lists vendors per connector type", () => {
    expect(VENDORS_BY_CONNECTOR_TYPE.database.map((v) => v.id)).toContain("postgresql");
    expect(VENDORS_BY_CONNECTOR_TYPE.ontology_knowledge_graph.map((v) => v.id)).toContain(
      "apache_fuseki",
    );
  });

  it("returns default vendor for type", () => {
    expect(getDefaultVendor("database")).toBe("postgresql");
    expect(getDefaultVendor("ontology_knowledge_graph")).toBe("apache_fuseki");
  });

  it("returns vendor-specific connection fields", () => {
    expect(getConnectionFields("postgresql").some((field) => field.id === "database")).toBe(true);
    expect(getConnectionFields("apache_fuseki").some((field) => field.id === "endpoint")).toBe(
      true,
    );
  });

  it("builds connector configuration payload", () => {
    expect(
      buildConnectorConfiguration("postgresql", "existing_instance", {
        host: "db.local",
        port: "5432",
      }),
    ).toEqual({
      schema_version: "2",
      vendor: "postgresql",
      connection_method: "existing_instance",
      connection: { host: "db.local", port: "5432" },
    });
  });

  it("resolves vendor labels", () => {
    expect(getVendorLabel("database", "oracle")).toBe("Oracle");
  });
});

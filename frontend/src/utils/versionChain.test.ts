import { describe, expect, it } from "vitest";
import { formatVersionChain } from "./versionChain";

describe("formatVersionChain", () => {
  it("returns version number when no parent", () => {
    expect(
      formatVersionChain(
        { id: "a", version_number: 1, previous_version_id: null },
        [],
      ),
    ).toBe("1");
  });

  it("shows parent version when parent is in list", () => {
    const entities = [
      { id: "parent", version_number: 1, previous_version_id: null },
      { id: "child", version_number: 2, previous_version_id: "parent" },
    ];
    expect(formatVersionChain(entities[1], entities)).toBe("2 ← 1");
  });

  it("shows fork label when parent is missing from list", () => {
    expect(
      formatVersionChain(
        { id: "child", version_number: 3, previous_version_id: "missing" },
        [],
      ),
    ).toBe("3 (fork)");
  });
});

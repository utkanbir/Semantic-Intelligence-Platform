import { describe, expect, it } from "vitest";
import {
  csvToPlainText,
  fileExtension,
  isSpreadsheetFile,
  parseCsvToRows,
  rowsToPlainText,
} from "./generateSourceFiles";

describe("generateSourceFiles", () => {
  it("detects spreadsheet extensions", () => {
    expect(isSpreadsheetFile("data.csv")).toBe(true);
    expect(isSpreadsheetFile("data.xlsx")).toBe(true);
    expect(fileExtension("notes.txt")).toBe(".txt");
    expect(isSpreadsheetFile("notes.txt")).toBe(false);
  });

  it("parses quoted CSV fields", () => {
    expect(parseCsvToRows('name,note\n"Vendor, Inc.",active')).toEqual([
      ["name", "note"],
      ["Vendor, Inc.", "active"],
    ]);
  });

  it("converts CSV rows to tab-separated plain text", () => {
    expect(csvToPlainText("a,b\n1,2")).toBe("a\tb\n1\t2");
    expect(rowsToPlainText([["x", "y"], ["1", "2"]])).toBe("x\ty\n1\t2");
  });
});

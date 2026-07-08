/** Read uploaded generate-source files into plain text (CSV/Excel → TSV rows). */

const SPREADSHEET_EXTENSIONS = new Set([".csv", ".xlsx", ".xls"]);
const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".json",
  ".ttl",
  ".rdf",
  ".owl",
  ".xml",
]);

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export function isSpreadsheetFile(filename: string): boolean {
  return SPREADSHEET_EXTENSIONS.has(fileExtension(filename));
}

export function rowsToPlainText(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => cell.replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t"))
    .join("\n");
}

/** Parse CSV text into rows (handles quoted fields and embedded newlines). */
export function parseCsvToRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];

    if (inQuotes) {
      if (char === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") {
        rows.push(row);
      }
      row = [];
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  if (row.length > 1 || row[0] !== "") {
    rows.push(row);
  }

  return rows;
}

export function csvToPlainText(csv: string): string {
  return rowsToPlainText(parseCsvToRows(csv));
}

function readFileAsText(file: File): Promise<string> {
  const readWithFileReader = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });

  if (typeof file.text === "function") {
    try {
      return file.text().catch(() => readWithFileReader());
    } catch {
      return readWithFileReader();
    }
  }

  return readWithFileReader();
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  const readWithFileReader = () =>
    new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(reader.result instanceof ArrayBuffer ? reader.result : new ArrayBuffer(0));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });

  if (typeof file.arrayBuffer === "function") {
    try {
      return file.arrayBuffer().catch(() => readWithFileReader());
    } catch {
      return readWithFileReader();
    }
  }

  return readWithFileReader();
}

async function inflateDeflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot decompress Excel files. Save as CSV instead.");
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

async function extractZipEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entries = new Map<string, Uint8Array>();
  const eocdOffset = findEndOfCentralDirectory(bytes);

  if (eocdOffset < 0) {
    throw new Error("Invalid Excel file");
  }

  let offset = view.getUint32(eocdOffset + 16, true);

  while (offset < eocdOffset) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      break;
    }

    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );

    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);

    let payload: Uint8Array;
    if (compression === 0) {
      payload = compressed;
    } else if (compression === 8) {
      payload = await inflateDeflateRaw(compressed);
    } else {
      throw new Error("Unsupported Excel compression. Save as CSV instead.");
    }

    entries.set(name, payload);
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function xmlTextContent(node: Element): string {
  return Array.from(node.childNodes)
    .map((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        return child.textContent ?? "";
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        return xmlTextContent(child as Element);
      }
      return "";
    })
    .join("");
}

function parseSharedStrings(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const strings: string[] = [];
  for (const item of doc.getElementsByTagName("si")) {
    strings.push(xmlTextContent(item).trim());
  }
  return strings;
}

function columnLettersToIndex(letters: string): number {
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index - 1;
}

function parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const rows: string[][] = [];

  for (const rowNode of doc.getElementsByTagName("row")) {
    const row: string[] = [];
    let maxIndex = -1;

    for (const cell of rowNode.getElementsByTagName("c")) {
      const ref = cell.getAttribute("r") ?? "";
      const match = /^([A-Z]+)/.exec(ref);
      const columnIndex = match ? columnLettersToIndex(match[1]) : row.length;
      const type = cell.getAttribute("t");
      const valueNode = cell.getElementsByTagName("v")[0];
      const inlineNode = cell.getElementsByTagName("is")[0];
      let value = "";

      if (type === "s" && valueNode?.textContent) {
        const sharedIndex = Number.parseInt(valueNode.textContent, 10);
        value = sharedStrings[sharedIndex] ?? "";
      } else if (inlineNode) {
        value = xmlTextContent(inlineNode);
      } else if (valueNode?.textContent) {
        value = valueNode.textContent;
      }

      while (row.length <= columnIndex) {
        row.push("");
      }
      row[columnIndex] = value;
      maxIndex = Math.max(maxIndex, columnIndex);
    }

    if (maxIndex >= 0) {
      rows.push(row.slice(0, maxIndex + 1));
    }
  }

  return rows;
}

export async function xlsxToPlainText(buffer: ArrayBuffer): Promise<string> {
  const entries = await extractZipEntries(buffer);
  const sharedStringsXml = entries.get("xl/sharedStrings.xml");
  const sheetKey = [...entries.keys()]
    .filter((name) => name.startsWith("xl/worksheets/sheet") && name.endsWith(".xml"))
    .sort()[0];
  const sheetEntry = sheetKey ? entries.get(sheetKey) : undefined;

  if (!sheetEntry) {
    throw new Error("Excel workbook has no readable worksheet");
  }

  const sharedStrings = sharedStringsXml
    ? parseSharedStrings(new TextDecoder().decode(sharedStringsXml))
    : [];
  const rows = parseSheetRows(new TextDecoder().decode(sheetEntry), sharedStrings);
  if (rows.length === 0) {
    throw new Error("Excel worksheet is empty");
  }

  return rowsToPlainText(rows);
}

export async function readGenerateSourceFile(file: File): Promise<string> {
  const extension = fileExtension(file.name);

  if (extension === ".csv") {
    const csv = await readFileAsText(file);
    return csvToPlainText(csv);
  }

  if (extension === ".xlsx") {
    const buffer = await readFileAsArrayBuffer(file);
    return xlsxToPlainText(buffer);
  }

  if (extension === ".xls") {
    throw new Error("Legacy .xls files are not supported. Save as .xlsx or .csv.");
  }

  if (TEXT_EXTENSIONS.has(extension) || file.type.startsWith("text/")) {
    return readFileAsText(file);
  }

  throw new Error(
    `Unsupported file type (${extension || "unknown"}). Use text, CSV, or Excel (.xlsx).`,
  );
}

export const GENERATE_SOURCE_FILE_ACCEPT =
  ".txt,.md,.json,.ttl,.rdf,.owl,.xml,.csv,.xlsx,.xls,text/plain";

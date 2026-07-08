/** Client-side validation for generate-from-sources Web URL inputs. */

export function normalizeAndValidateGenerateSourceUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid URL (for example https://example.com/page)");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must use http or https");
  }

  return parsed.href;
}

export function isValidGenerateSourceUrl(input: string): boolean {
  try {
    normalizeAndValidateGenerateSourceUrl(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shared helpers for parsing LinkedIn Voyager API responses.
 *
 * Voyager returns a normalized format: { data: {...}, included: [...] }
 * where `included` contains flat entity arrays filtered by `$type` suffix.
 */

export function extractEntities(
  included: Array<Record<string, unknown>> | undefined,
  typeSuffix: string,
): Array<Record<string, unknown>> {
  if (!included || !Array.isArray(included)) return [];
  return included.filter(
    (item) => typeof item.$type === "string" && (item.$type as string).endsWith(typeSuffix),
  );
}

export function buildEntityMap(
  included: Array<Record<string, unknown>> | undefined,
): Record<string, Record<string, unknown>> {
  const map: Record<string, Record<string, unknown>> = {};
  if (!included || !Array.isArray(included)) return map;
  for (const item of included) {
    const urn = item.entityUrn ?? item["*entityUrn"];
    if (typeof urn === "string") {
      map[urn] = item;
    }
  }
  return map;
}

export function bestImageUrl(
  vectorImage: Record<string, unknown> | undefined | null,
): string | null {
  if (!vectorImage) return null;
  const rootUrl = vectorImage.rootUrl as string | undefined;
  const artifacts = vectorImage.artifacts as Array<Record<string, unknown>> | undefined;
  if (!rootUrl || !artifacts || artifacts.length === 0) return null;

  // Pick the largest artifact by width
  let best = artifacts[0];
  let bestWidth = 0;
  for (const art of artifacts) {
    const w = (art.width as number) ?? 0;
    if (w > bestWidth) {
      bestWidth = w;
      best = art;
    }
  }

  const suffix = (best.fileIdentifyingUrlPathSegment ?? "") as string;
  return suffix ? `${rootUrl}${suffix}` : rootUrl;
}

export function formatDate(dateObj: Record<string, unknown> | undefined | null): string | null {
  if (!dateObj) return null;
  const year = dateObj.year as number | undefined;
  const month = dateObj.month as number | undefined;
  if (!year) return null;
  if (month) return `${year}-${String(month).padStart(2, "0")}`;
  return String(year);
}

export function resolveRef(
  ref: unknown,
  entityMap: Record<string, Record<string, unknown>>,
): Record<string, unknown> | null {
  if (typeof ref !== "string") return null;
  return entityMap[ref] ?? null;
}

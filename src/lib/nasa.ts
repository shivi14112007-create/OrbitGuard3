// Client-safe NASA Images API helper.
// Fetches satellite mission metadata to enrich existing UI displays.

export interface NasaSatelliteMeta {
  title: string;
  description: string;
  nasa_id: string;
}

export const nasaSatellites: NasaSatelliteMeta[] = [];

const ENDPOINT = "https://images-api.nasa.gov/search?q=satellite&media_type=image";

export async function fetchNASAData(): Promise<NasaSatelliteMeta[]> {
  try {
    const res = await fetch(ENDPOINT, { headers: { accept: "application/json" } });
    if (!res.ok) return nasaSatellites;

    const json = (await res.json()) as {
      collection?: {
        items?: Array<{ data?: Array<{ title?: string; description?: string; nasa_id?: string }> }>;
      };
    };

    const items = json.collection?.items ?? [];
    const parsed: NasaSatelliteMeta[] = [];
    for (const item of items) {
      const d = item.data?.[0];
      if (!d?.title || !d?.nasa_id) continue;
      parsed.push({
        title: d.title,
        description: (d.description ?? "").slice(0, 400),
        nasa_id: d.nasa_id,
      });
    }

    nasaSatellites.splice(0, nasaSatellites.length, ...parsed);
    return nasaSatellites;
  } catch {
    return nasaSatellites;
  }
}

/** Find a NASA mission entry whose title best matches the given satellite name. */
export function findNasaMetaFor(name: string): NasaSatelliteMeta | undefined {
  if (!name || nasaSatellites.length === 0) return undefined;
  const needle = name.toLowerCase().split(/[\s()-]+/).filter(Boolean);
  let best: { meta: NasaSatelliteMeta; score: number } | null = null;
  for (const m of nasaSatellites) {
    const hay = m.title.toLowerCase();
    let score = 0;
    for (const tok of needle) if (tok.length > 2 && hay.includes(tok)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { meta: m, score };
  }
  return best?.meta;
}

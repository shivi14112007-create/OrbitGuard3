// NASA TLE + mission metadata server-only helpers.
// TLE source: https://tle.ivanstanojevic.me (NASA-published Celestrak mirror, no key).
// Mission imagery: https://images-api.nasa.gov (no key required for read).
import * as satellite from "satellite.js";

const TLE_BASE = "https://tle.ivanstanojevic.me/api/tle";
const IMAGES_BASE = "https://images-api.nasa.gov/search";

const TARGETS = [
  { id: 25544, label: "ISS (ZARYA)" },
  { id: 33591, label: "NOAA 19" },
  { id: 39084, label: "LANDSAT 8" },
  { id: 40069, label: "METEOR-M 2" },
  { id: 41866, label: "GOES 16" },
  { id: 43013, label: "NOAA 20" },
  { id: 48274, label: "CSS (TIANHE)" },
  { id: 25994, label: "TERRA" },
];

export interface NasaSat {
  id: string;
  catalogId: number;
  name: string;
  orbit: "LEO" | "MEO" | "GEO";
  lat: number;
  lon: number;
  altitudeKm: number;
  velocityKmS: number;
  inclinationDeg: number;
  periodMin: number;
}

async function fetchTLE(noradId: number): Promise<{ line1: string; line2: string; name: string } | null> {
  try {
    const res = await fetch(`${TLE_BASE}/${noradId}`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as { name: string; line1: string; line2: string };
    return { name: json.name, line1: json.line1, line2: json.line2 };
  } catch {
    return null;
  }
}

function classifyOrbit(periodMin: number): "LEO" | "MEO" | "GEO" {
  if (periodMin < 225) return "LEO";
  if (periodMin < 1200) return "MEO";
  return "GEO";
}

export async function fetchLiveSatellites(): Promise<NasaSat[]> {
  const now = new Date();
  const gmst = satellite.gstime(now);

  const results = await Promise.all(
    TARGETS.map(async (t) => {
      const tle = await fetchTLE(t.id);
      if (!tle) return null;
      try {
        const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
        const pv = satellite.propagate(satrec, now);
        if (!pv || !pv.position || typeof pv.position === "boolean" || !pv.velocity || typeof pv.velocity === "boolean") return null;
        const geo = satellite.eciToGeodetic(pv.position as satellite.EciVec3<number>, gmst);
        const lat = satellite.degreesLat(geo.latitude);
        const lon = satellite.degreesLong(geo.longitude);
        const altitudeKm = geo.height;
        const v = pv.velocity as satellite.EciVec3<number>;
        const velocityKmS = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        const periodMin = (2 * Math.PI) / satrec.no; // satrec.no is rad/min
        return {
          id: `NASA-${t.id}`,
          catalogId: t.id,
          name: tle.name.trim(),
          orbit: classifyOrbit(periodMin),
          lat, lon, altitudeKm, velocityKmS,
          inclinationDeg: (satrec.inclo * 180) / Math.PI,
          periodMin,
        } satisfies NasaSat;
      } catch {
        return null;
      }
    }),
  );

  return results.filter((s): s is NasaSat => s != null);
}

export async function fetchMissionMeta(name: string): Promise<{ title: string; description: string; thumb?: string } | null> {
  try {
    const url = `${IMAGES_BASE}?q=${encodeURIComponent(name)}&media_type=image&page_size=1`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const json = await res.json() as { collection?: { items?: Array<{ data?: Array<{ title?: string; description?: string }>; links?: Array<{ href?: string }> }> } };
    const item = json.collection?.items?.[0];
    const data = item?.data?.[0];
    if (!data?.title) return null;
    return {
      title: data.title,
      description: (data.description ?? "").slice(0, 400),
      thumb: item?.links?.[0]?.href,
    };
  } catch {
    return null;
  }
}

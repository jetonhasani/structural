// src/lib/server/terrainCategory.ts
import "server-only";

export type TerrainCategory = "TC1" | "TC2" | "TC2.5" | "TC3" | "TC4";

const RADIUS_M = 500;
const BUFFER_AREA_M2 = Math.PI * RADIUS_M * RADIUS_M;   // ≈ 785,398 m²
const HECTARES_IN_BUFFER = BUFFER_AREA_M2 / 10_000;      // ≈ 78.54 ha

// ---- small geo helpers (no external libs) ----

// meters per degree latitude ~= 111_320
function metersPerDegLon(latDeg: number) {
  return 111_320 * Math.cos((latDeg * Math.PI) / 180);
}

function pointDistM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const mPerLon = metersPerDegLon((a.lat + b.lat) / 2);
  const dx = (b.lon - a.lon) * mPerLon;
  const dy = (b.lat - a.lat) * 111_320;
  return Math.sqrt(dx * dx + dy * dy);
}

// polygon area via planar approximation on local tangent plane (ok for 500m buffer scale)
function polygonAreaM2(ring: Array<{ lat: number; lon: number }>): number {
  if (ring.length < 3) return 0;
  const lat0 = ring[0].lat;
  const mPerLon = metersPerDegLon(lat0);
  // convert to meters
  const pts = ring.map(p => ({ x: p.lon * mPerLon, y: p.lat * 111_320 }));
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(sum) / 2;
}

// minimum distance from site to any coastline/water node
function minNodeDistanceM(lat: number, lon: number, elements: any[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const el of elements) {
    if (!Array.isArray(el?.geometry)) continue;
    for (const n of el.geometry) {
      const d = pointDistM({ lat, lon }, { lat: n.lat, lon: n.lon });
      if (d < best) best = d;
    }
  }
  return best;
}

// sum polygon “areas” for elements that have a closed geometry; ignore open ways
function sumPolygonAreasM2(elements: any[]): number {
  let total = 0;
  for (const el of elements) {
    const geom = el?.geometry;
    if (!Array.isArray(geom) || geom.length < 3) continue;
    const first = geom[0];
    const last = geom[geom.length - 1];
    const isClosed = first && last && first.lat === last.lat && first.lon === last.lon;
    if (!isClosed) continue; // skip open ways (e.g., coastline without polygon)
    total += polygonAreaM2(geom);
  }
  return total;
}

async function overpass(query: string): Promise<any> {
  const resp = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ data: query }).toString(),
    // Consider adding a 10–15s timeout + retry in prod
  });
  if (!resp.ok) throw new Error(`Overpass error: ${resp.status}`);
  return resp.json();
}

/**
 * Deterministic classifier following AS/NZS 1170.2 descriptions.
 * Ordering matters:
 * 1) TC1 near open water (coast/lake) with low obstructions.
 * 2) TC4 only for true CBD/industrial cores; never near coast (cap at TC3 if within 400 m).
 * 3) Literal obstruction-density thresholds → TC3 / TC2.5 / TC2.
 */
export async function detectTerrainCategory(lat: number, lon: number): Promise<TerrainCategory> {
  const q = `
    [out:json][timeout:35];
    (
      way(around:${RADIUS_M},${lat},${lon})["landuse"~"residential|industrial|commercial"];
      relation(around:${RADIUS_M},${lat},${lon})["landuse"~"residential|industrial|commercial"];

      // water/coastline within 1km so we can judge coastal exposure
      way(around:1000,${lat},${lon})["natural"="water"];
      relation(around:1000,${lat},${lon})["natural"="water"];
      way(around:1000,${lat},${lon})["water"];
      relation(around:1000,${lat},${lon})["water"];
      way(around:1000,${lat},${lon})["natural"="coastline"];

      way(around:${RADIUS_M},${lat},${lon})["building"];
      relation(around:${RADIUS_M},${lat},${lon})["building"];
    );
    out body geom;
  `;

  let data: any;
  try {
    data = await overpass(q);
  } catch {
    // If network fails, choose conservative middle rather than TC1
    return "TC2.5";
  }

  const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];

  // Partition by tags
  const urban = elements.filter(el => {
    const t = el.tags || {};
    return t.landuse && /^(residential|industrial|commercial)$/i.test(t.landuse);
  });
  const water = elements.filter(el => {
    const t = el.tags || {};
    return t.natural === "water" || t.water;
  });
  const coastline = elements.filter(el => el.tags?.natural === "coastline");
  const buildings = elements.filter(el => el.tags?.building);

  // Coverage and density
  const urbanArea = sumPolygonAreasM2(urban);
  const waterArea = sumPolygonAreasM2(water);
  const urbanPct = Math.min(urbanArea / BUFFER_AREA_M2, 1);
  const waterPct = Math.min(waterArea / BUFFER_AREA_M2, 1);

  const buildingCount = buildings.length;
  const buildingsPerHa = buildingCount / HECTARES_IN_BUFFER;

  // Distance to nearest coastline/water edge (based on node geometry)
  const dCoastM = Math.min(
    minNodeDistanceM(lat, lon, coastline),
    minNodeDistanceM(lat, lon, water)
  );

  // ----------------- RULES -----------------
  // A) TC1 (very exposed / all water surfaces)
  // Lock TC1 if clearly coastal or water-dominant with low obstructions.
  const NEAR_COAST = dCoastM <= 250;          // beachfront / dunes / foreshore
  const COASTAL_ZONE = dCoastM <= 400;        // within 400 m of coast ⇒ cap higher classes
  const WATER_DOMINANT = waterPct >= 0.30;    // significant water within buffer

  if ((NEAR_COAST && buildingsPerHa <= 5 && urbanPct <= 0.15) ||
      (WATER_DOMINANT && buildingsPerHa <= 5 && urbanPct <= 0.10)) {
    return "TC1";
  }

  // B) TC4 (large, high, closely-spaced constructions)
  // Only if not coastal (don’t ever call beachfront TC4).
  if (!COASTAL_ZONE) {
    // High density proxy for CBDs/industrial cores.
    const TC4_BY_DENSITY = buildingsPerHa >= 25;         // very dense
    const TC4_BY_URBAN   = urbanPct >= 0.65 && buildingsPerHa >= 15;

    if (TC4_BY_DENSITY || TC4_BY_URBAN) {
      return "TC4";
    }
  }

  // C) Literal obstruction density thresholds per the Standard text:
  //    TC3: >= 10 house-size obstructions per hectare (suburban, light industrial, dense forest)
  if (buildingsPerHa >= 10) return "TC3";

  //    TC2.5: >2 and <10
  if (buildingsPerHa > 2 && buildingsPerHa < 10) return "TC2.5";

  //    TC2: ≤ 2 (open terrain/grassland with well-scattered obstructions)
  // If this were coastal/water dominant we would have hit TC1 above.
  if (buildingsPerHa <= 2) return "TC2";

  // Fallback (shouldn’t hit)
  return "TC2.5";
}
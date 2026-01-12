// src/lib/windTables.ts

// 1. public wind-speed table from your screenshot
export const WIND_SPEEDS: Record<string, Record<string, number>> = {
  // Non-cyclonic
  A: {
    V1: 30,
    V5: 32,
    V10: 34,
    V20: 37,
    V25: 37,
    V50: 39,
    V100: 41,
    V200: 43,
    V250: 43,
    V500: 45,
    V1000: 46,
    V2000: 48,
    V2500: 48,
    V5000: 50,
    V10000: 51,
  },
  B1: {
    V1: 26,
    V5: 28,
    V10: 33,
    V20: 38,
    V25: 39,
    V50: 44,
    V100: 48,
    V200: 52,
    V250: 53,
    V500: 57,
    V1000: 60,
    V2000: 63,
    V2500: 64,
    V5000: 67,
    V10000: 69,
  },
  B2: {
    V1: 26,
    V5: 28,
    V10: 33,
    V20: 38,
    V25: 39,
    V50: 44,
    V100: 48,
    V200: 52,
    V250: 53,
    V500: 57,
    V1000: 60,
    V2000: 63,
    V2500: 64,
    V5000: 67,
    V10000: 69,
  },
  // Cyclonic
  C: {
    V1: 23,
    V5: 33,
    V10: 39,
    V20: 45,
    V25: 47,
    V50: 52,
    V100: 56,
    V200: 61,
    V250: 62,
    V500: 66,
    V1000: 70,
    V2000: 73,
    V2500: 74,
    V5000: 78,
    V10000: 81,
  },
  D: {
    V1: 23,
    V5: 35,
    V10: 43,
    V20: 51,
    V25: 53,
    V50: 60,
    V100: 66,
    V200: 72,
    V250: 74,
    V500: 80,
    V1000: 85,
    V2000: 90,
    V2500: 91,
    V5000: 95,
    V10000: 99,
  },
};

// design working life dropdown
export const DESIGN_WORKING_LIFE_OPTIONS = [
  { value: "temp", label: "Construction equipment / temporary" },
  { value: "lt6", label: "Less than 6 months" },
  { value: "5", label: "5 years or less" },
  { value: "25", label: "25 years or less" },
  { value: "50", label: "50 years or less" },
  { value: "100", label: "100 years or more" },
];

// from your first table
export const ANNUAL_POE_TABLE: Record<string, Record<number, string>> = {
  temp: {
    2: "1/100",
  },
  lt6: {
    1: "1/25",
    2: "1/100",
    3: "1/250",
    4: "1/1000",
  },
  "5": {
    1: "1/25",
    2: "1/250",
    3: "1/500",
    4: "1/1000",
  },
  "25": {
    1: "1/50",
    2: "1/250",
    3: "1/500",
    4: "1/1000",
  },
  "50": {
    1: "1/100",
    2: "1/500", // will be overridden to 1/50 in code
    3: "1/1000",
    4: "1/2500",
  },
  "100": {
    1: "1/250",
    2: "1/1000",
    3: "1/2500",
    4: "1/2500",
  },
};

// map PoE → Vxx
export const POE_TO_RECURRENCE: Record<string, string> = {
  "1/25": "V25",
  "1/50": "V50",
  "1/100": "V100",
  "1/200": "V200",
  "1/250": "V250",
  "1/500": "V500",
  "1/1000": "V1000",
  "1/2000": "V2000",
  "1/2500": "V2500",
  "1/5000": "V5000",
  "1/10000": "V10000",
};

// ============================================
// Climate Change Multiplier Table (Table 3.3)
// ============================================

// Based on AS/NZS 1170.2 Table 3.3 — Climate change multiplier (Mc)
export const CLIMATE_CHANGE_MULTIPLIER: Record<string, number> = {
  A: 1.0,
  A0: 1.0,
  A1: 1.0,
  A2: 1.0,
  A3: 1.0,
  A4: 1.0,
  A5: 1.0,
  B1: 1.0,
  B2: 1.05,
  C: 1.05,
  D: 1.05,
  NZ: 1.0,
};

// helper function
export function getClimateChangeMultiplier(region: string | null): number | null {
  if (!region) return null;
  const key = region.trim().toUpperCase();
  return CLIMATE_CHANGE_MULTIPLIER[key] ?? null;
}

// ============================================
// Wind direction multiplier (Md) — Table 3.2(A)
// ============================================
export const CONSERVATIVE_WIND_DIRECTION_MD: Record<string, number> = {
  A: 1.0,
  B1: 0.95,
  B2: 0.90,
  C: 0.90,
  D: 0.90,
};

// Optional: expose the full table by direction if you later want per-direction logic.
// Keys are illustrative; you can expand if you later distinguish A0..A5 explicitly.
export type CardinalDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

// Aggregated per normalised region (taken from Table 3.2(A))
// These are *not required* for the current conservative flow, but useful to keep.
export const WIND_DIRECTION_MD_BY_DIR: Record<
  "A" | "B1" | "B2" | "C" | "D",
  Record<CardinalDirection, number>
> = {
  // Using a representative A column: all A-subregions have max 1.00; per-dir values vary slightly.
  // If you later need exact A0..A5 columns, split these out; the conservative calc below still holds.
  A:   { N: 0.90, NE: 0.85, E: 0.85, SE: 0.90, S: 0.90, SW: 0.95, W: 1.00, NW: 0.95 },
  B1:  { N: 0.75, NE: 0.75, E: 0.85, SE: 0.90, S: 0.95, SW: 0.95, W: 0.95, NW: 0.90 },
  B2:  { N: 0.90, NE: 0.90, E: 0.90, SE: 0.90, S: 0.90, SW: 0.90, W: 0.90, NW: 0.90 },
  C:   { N: 0.90, NE: 0.90, E: 0.90, SE: 0.90, S: 0.90, SW: 0.90, W: 0.90, NW: 0.90 },
  D:   { N: 0.90, NE: 0.90, E: 0.90, SE: 0.90, S: 0.90, SW: 0.90, W: 0.90, NW: 0.90 },
};

// Helper: conservative Md for a **normalised** region (A, B1, B2, C, D)
export function getConservativeMd(normalisedRegion: string | null): number | null {
  if (!normalisedRegion) return null;
  const key = normalisedRegion.trim().toUpperCase();
  return CONSERVATIVE_WIND_DIRECTION_MD[key] ?? null;
}

// ============================================
// Terrain/height multiplier (Mz,cat) — Table 4.1
// "All regions except A0" — we handle A0 with a rule below.
// Linear interpolation used for heights between tabulated rows.
// ============================================

export type TerrainCat = "TC1" | "TC2" | "TC2.5" | "TC3" | "TC4";

// Heights in metres
const MZCAT_HEIGHTS: number[] = [3, 5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200];

// Per-terrain column values from Table 4.1
const MZCAT_TABLE: Record<TerrainCat, number[]> = {
  TC1:  [0.97, 1.01, 1.08, 1.12, 1.14, 1.18, 1.21, 1.23, 1.27, 1.31, 1.36, 1.39],
  TC2:  [0.91, 0.91, 1.00, 1.05, 1.08, 1.12, 1.16, 1.18, 1.22, 1.24, 1.27, 1.29],
  ["TC2.5"]: [0.87, 0.87, 0.92, 0.97, 1.01, 1.06, 1.10, 1.13, 1.17, 1.20, 1.24, 1.27],
  TC3:  [0.83, 0.83, 0.83, 0.89, 0.94, 1.00, 1.04, 1.07, 1.12, 1.16, 1.21, 1.24],
  TC4:  [0.75, 0.75, 0.75, 0.75, 0.75, 0.80, 0.85, 0.90, 0.98, 1.03, 1.11, 1.16],
};


// Helper: clamp
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// Linear interpolate y for x between (x0,y0) and (x1,y1)
function lerp(x0: number, y0: number, x1: number, y1: number, x: number) {
  if (x1 === x0) return y0;
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

// Normalise free-text terrain to a strict key
export function normaliseTerrainCat(raw: string | null | undefined): TerrainCat | null {
  if (!raw) return null;
  const k = raw.toString().toUpperCase().replace(/\s+/g, "");
  if (k === "TC1" || k === "TERRAINCATEGORY1") return "TC1";
  if (k === "TC2" || k === "TERRAINCATEGORY2") return "TC2";
  if (k === "TC2.5" || k === "TC25" || k === "TERRAINCATEGORY2.5") return "TC2.5";
  if (k === "TC3" || k === "TERRAINCATEGORY3") return "TC3";
  if (k === "TC4" || k === "TERRAINCATEGORY4") return "TC4";
  return null;
}

/**
 * Get Mz,cat for given region/terrain/height.
 * - Uses Table 4.1 for all regions except A0.
 * - Region A0 rule (per note):
 *   * For z ≤ 100 m: use **TC2 column** regardless of terrain.
 *   * For 100 m < z ≤ 200 m: return **1.24** for all terrains.
 * Heights below 3 m use the 3 m row; above 200 m clamp to 200 m row.
 */
export function getMzcat(
  rawRegion: string | null,
  terrainCat: TerrainCat | null,
  heightM: number | null | undefined
): number | null {
  if (heightM == null || Number.isNaN(Number(heightM))) return null;
  const z = clamp(Number(heightM), 0, 1e6);

  // Region A0 special handling
  const isA0 = typeof rawRegion === "string" && rawRegion.trim().toUpperCase() === "A0";
  if (isA0) {
    if (z <= 100) {
      // use TC2 curve across all terrains
      return interpolateFromColumn("TC2", z);
    }
    if (z <= 200) {
      return 1.24; // fixed for 100 < z ≤ 200
    }
    // >200 not defined; be conservative and clamp to 200 m value
    return 1.24;
  }

  // All other regions (A1–A5, B1, B2, C, D, NZ…): use table with the provided terrain
  const terr = terrainCat ?? "TC2"; // default sensibly if missing
  return interpolateFromColumn(terr, z);
}

// Interpolate along a terrain column for height z
function interpolateFromColumn(terrain: TerrainCat, z: number): number {
  // Below first row (≤3 m): use 3 m value
  if (z <= MZCAT_HEIGHTS[0]) {
    return MZCAT_TABLE[terrain][0];
  }
  // Above max row (200 m): clamp to 200 m value
  if (z >= MZCAT_HEIGHTS[MZCAT_HEIGHTS.length - 1]) {
    return MZCAT_TABLE[terrain][MZCAT_HEIGHTS.length - 1];
  }

  // Find bracketing rows
  for (let i = 0; i < MZCAT_HEIGHTS.length - 1; i++) {
    const z0 = MZCAT_HEIGHTS[i];
    const z1 = MZCAT_HEIGHTS[i + 1];
    if (z >= z0 && z <= z1) {
      const y0 = MZCAT_TABLE[terrain][i];
      const y1 = MZCAT_TABLE[terrain][i + 1];
      return lerp(z0, y0, z1, y1, z);
    }
  }

  // Fallback (shouldn’t hit)
  return MZCAT_TABLE[terrain][MZCAT_TABLE[terrain].length - 1];
}

// ============================================
// Turbulence intensity (I_h) — Table 6.1
// Linear interpolation between heights
// ============================================

// Heights (m) exactly as in Table 6.1
const IH_HEIGHTS: number[] = [5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200];

const IH_TABLE: Record<TerrainCat, number[]> = {
  //            ≤5     10     15     20     30     40     50     75     100    150    200
  TC1:   [0.128, 0.117, 0.112, 0.109, 0.104, 0.101, 0.099, 0.095, 0.092, 0.089, 0.087],
  TC2:   [0.196, 0.183, 0.176, 0.171, 0.162, 0.156, 0.151, 0.140, 0.131, 0.117, 0.107],
  ["TC2.5"]: [0.234, 0.211, 0.201, 0.193, 0.183, 0.176, 0.170, 0.158, 0.149, 0.134, 0.123],
  TC3:   [0.271, 0.239, 0.225, 0.215, 0.203, 0.195, 0.188, 0.176, 0.166, 0.150, 0.139],
  TC4:   [0.342, 0.342, 0.342, 0.342, 0.305, 0.285, 0.270, 0.248, 0.233, 0.210, 0.196],
};

// Reuse helpers from above (clamp, lerp, normaliseTerrainCat)

export function getIh(
  terrainCat: TerrainCat | null | undefined,
  heightM: number | null | undefined
): number | null {
  if (heightM == null || Number.isNaN(Number(heightM))) return null;
  const terr = terrainCat ?? "TC2"; // sensible default if missing
  const z = Number(heightM);

  // Below/at 5 m → use 5 m row; above 200 m → clamp to 200 m row
  if (z <= IH_HEIGHTS[0]) return IH_TABLE[terr][0];
  if (z >= IH_HEIGHTS[IH_HEIGHTS.length - 1]) return IH_TABLE[terr][IH_HEIGHTS.length - 1];

  // Find bracketing rows and interpolate
  for (let i = 0; i < IH_HEIGHTS.length - 1; i++) {
    const z0 = IH_HEIGHTS[i], z1 = IH_HEIGHTS[i + 1];
    if (z >= z0 && z <= z1) {
      const y0 = IH_TABLE[terr][i], y1 = IH_TABLE[terr][i + 1];
      return lerp(z0, y0, z1, y1, z);
    }
  }
  return IH_TABLE[terr][IH_HEIGHTS.length - 1]; // fallback (shouldn’t hit)
}
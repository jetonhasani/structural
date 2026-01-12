// src/lib/windCalc.ts
import {
  ANNUAL_POE_TABLE,
  POE_TO_RECURRENCE,
  WIND_SPEEDS,
  getConservativeMd,
  getClimateChangeMultiplier,
  normaliseTerrainCat,
  getMzcat,
  getIh,
} from "@/lib/windTables";

// A1 → A, B1 → B1, etc.
export function normaliseRegion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.replace(/\s+/g, "").toUpperCase();
  const aliases: Record<string, string> = {
    A: "A",
    A0: "A",
    A1: "A",
    A2: "A",
    A3: "A",
    A4: "A",
    A5: "A",
    "A(0TO5)": "A",
    B1: "B1",
    B2: "B2",
    C: "C",
    D: "D",
  };
  return aliases[key] ?? null;
}

// design life + importance → PoE (with your override)
export function getAnnualPoe(
  designLife: string,
  importance: number
): string | null {
  let poe = ANNUAL_POE_TABLE[designLife]?.[importance] ?? null;

  // 50 years + importance 2 → 1/50 (so we get V50 where required)
  if (designLife === "50" && importance === 2) {
    poe = "1/50";
  }
  return poe;
}

export function poeToRecurrence(poe: string | null): string | null {
  if (!poe) return null;
  return POE_TO_RECURRENCE[poe] ?? null;
}

export function getRegionalWindSpeed(
  normalisedRegion: string | null,
  recurrence: string | null
): number | null {
  if (!normalisedRegion || !recurrence) return null;
  const speeds = WIND_SPEEDS[normalisedRegion];
  if (!speeds) return null;
  return speeds[recurrence] ?? null;
}

// Core material → Kt
export type CoreMaterial =
  | "steel_mrf"
  | "steel_ebr"
  | "concrete_mrf"
  | "timber_other";

function ktFor(core: CoreMaterial | null | undefined): number | null {
  switch (core) {
    case "steel_mrf": return 0.11;
    case "steel_ebr": return 0.06;
    case "concrete_mrf": return 0.075;
    case "timber_other": return 0.05;
    default: return null;
  }
}

// gR helper
function computeGR(naHz?: number | null): number | null {
  if (typeof naHz !== "number" || !Number.isFinite(naHz) || naHz <= 0) return null;
  const arg = 1.2 + 2 * Math.log(600 * naHz);
  if (arg <= 0) return null;
  return Math.sqrt(arg);
}

// --- Damping ratio (simplified rule) ---
function getDampingRatio(core?: CoreMaterial | null): number {
  switch (core) {
    case "concrete_mrf":
      return 0.03;
    case "steel_mrf":
    case "steel_ebr":
    case "timber_other":
    default:
      return 0.02;
  }
}

// Main
export function calculateWindFromInputs(opts: {
  rawRegion: string | null;
  designLife: string;
  importance: number;
  mdOverride?: number;
  msOverride?: number;
  mtOverride?: number;
  terrainUsed?: string | null;
  heightM?: number | null;
  coreMaterial?: CoreMaterial | null;
  sOverride?: number | null;

  shapeFactor?: {
    cpe?: number;
    ka?: number;
    kce?: number;
    k1?: number;
    kp?: number;
  };

  naturalFrequencyHz?: number | null;

  // optional width override (m) – kept for transparency, not used by S anymore
  sizeReductionWidthM?: number | null;
}) {
  const region = normaliseRegion(opts.rawRegion);
  const annualPoe = getAnnualPoe(opts.designLife, opts.importance);
  const recurrence = poeToRecurrence(annualPoe);
  const windSpeed = getRegionalWindSpeed(region, recurrence); // V_R

  const Mc = getClimateChangeMultiplier(region);
  const Md =
    typeof opts.mdOverride === "number" && !Number.isNaN(opts.mdOverride)
      ? opts.mdOverride
      : getConservativeMd(region);

  const terr = normaliseTerrainCat(opts.terrainUsed ?? null);
  const Mzcat = getMzcat(opts.rawRegion, terr, opts.heightM ?? null);

  const Ms =
    typeof opts.msOverride === "number" && !Number.isNaN(opts.msOverride)
      ? opts.msOverride
      : 1.0;

  const Mt =
    typeof opts.mtOverride === "number" && !Number.isNaN(opts.mtOverride)
      ? opts.mtOverride
      : 1.0;

  // Aerodynamic shape factor (Cshp)
  const CPE_DEFAULT = 0.80;
  const cpe =
    typeof opts.shapeFactor?.cpe === "number" && Number.isFinite(opts.shapeFactor.cpe)
      ? opts.shapeFactor.cpe
      : CPE_DEFAULT;
  const ka = 1.0, kce = 1.0, k1 = 1.0, kp = 1.0;
  const Cshp = Number((cpe * ka * kce * k1 * kp).toFixed(3));

  const exposureProduct = typeof Mzcat === "number" ? Mzcat * Ms * Mt : null;

  // Final site design wind speed (m/s)
  const Vsit =
    windSpeed !== null && 
    Mc !== null && 
    Md !== null && 
    exposureProduct !== null
      ? Number((windSpeed * Mc * Md * exposureProduct).toFixed(2))
      : null;

  // Dynamics: Cdyn, T1, f
  let Cdyn: number | null = null;
  let T1_s: number | null = null;
  let f_Hz: number | null = null;
  let Kt: number | null = null;

  const h = typeof opts.heightM === "number" ? opts.heightM : null;
  if (h !== null) {
    if (h <= 25) {
      Cdyn = 1.0;
    } else {
      Kt = ktFor(opts.coreMaterial);
      if (Kt !== null) {
        T1_s = 1.25 * Kt * Math.pow(h, 0.75);
        f_Hz = 1 / T1_s;
        Cdyn = null; // computed later from Eq 6.2(1)
      }
    }
  }

  // gR
  const gR = computeGR(f_Hz ?? opts.naturalFrequencyHz ?? null);

  // Lh (m)
  let Lh_m: number | null = null;
  if (typeof h === "number" && h > 0) {
    Lh_m = 85 * Math.pow(h / 10, 0.25);
  }

  // Ih
  const Ih = getIh(terr, h);

  // Natural frequency to use (Hz)
  const na =
    typeof f_Hz === "number" && Number.isFinite(f_Hz)
      ? f_Hz
      : (typeof opts.naturalFrequencyHz === "number" && Number.isFinite(opts.naturalFrequencyHz)
          ? opts.naturalFrequencyHz
          : null);

  // Reduced frequency N = na * Lh * (1 + gv * Ih) / Vdes
  const GV = 3.4;
  const Vdes = typeof Vsit === "number" ? Vsit : null;
  const N =
    na != null && Lh_m != null && Ih != null && Vdes != null && Vdes > 0
      ? (na * Lh_m * (1 + GV * Ih)) / Vdes
      : null;

  // Keep bUsedM for visibility (default 0.5*h)
  const bUsedM =
    typeof opts.sizeReductionWidthM === "number" &&
    Number.isFinite(opts.sizeReductionWidthM) &&
    opts.sizeReductionWidthM > 0
      ? opts.sizeReductionWidthM
      : (typeof h === "number" && h > 0 ? 0.5 * h : null);

  // --- Turbulence spectrum E_t ---
  // E_t = π N / (1 + 70.8 N^2)^(5/6)
  const Et =
    typeof N === "number" && Number.isFinite(N)
      ? (Math.PI * N) / Math.pow(1 + 70.8 * N * N, 5 / 6)
      : null;

  // --- Size reduction factor S (Eq. 6.2(5) form you supplied) ---
  let S: number | null = null;
  if (
    na != null &&
    typeof h === "number" && h > 0 &&
    bUsedM != null && bUsedM > 0 &&
    Ih != null &&
    Vdes != null && Vdes > 0
  ) {
    const factor = 1 + GV * Ih; // (1 + g_v * I_h)
    const bracket1 = 1 + (3.5 * na * h * factor) / Vdes;
    const bracket2 = 1 + (4.0 * na * bUsedM * factor) / Vdes; // b0h = bUsedM
    S = 1 / (bracket1 * bracket2);
  }

  // --- Background factor Bs (Eq. 6.2(2)) ---
  let Bs: number | null = null;
  let sUsedM: number | null = null;

  function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
  }

  if (typeof h === "number" && h > 0 && Lh_m != null && Lh_m > 0) {
    const hasNumericOverride =
      typeof opts.sOverride === "number" && Number.isFinite(opts.sOverride);

    // Use override exactly as provided (even 0). If absent, default to 0.5*h.
    sUsedM = hasNumericOverride ? clamp(opts.sOverride as number, 0, h) : 0.5 * h;

    const bsh = 0.5 * h;
    const numerator = Math.sqrt(0.26 * Math.pow(h - sUsedM, 2) + 0.46 * Math.pow(bsh, 2));
    Bs = 1 / (1 + numerator / Lh_m);
  }

  const dampingRatio = getDampingRatio(opts.coreMaterial);

  // --- H_s (participation at level s): use the same s as Bs ---
  let Hs: number | null = null;
  if (typeof h === "number" && h > 0) {
    const s = typeof sUsedM === "number" ? sUsedM : 0.5 * h; // default only if no override
    Hs = 1 + Math.pow(s / h, 2);
  }

  // --- Dynamic response factor C_dyn (Eq. 6.2(1)) ---
  let CdynCalc: number | null = null;
  if (
    Ih != null && typeof Ih === "number" &&
    Bs != null && typeof Bs === "number" &&
    S  != null && typeof S  === "number" &&
    Et != null && typeof Et === "number" &&
    Hs != null && typeof Hs === "number" &&
    dampingRatio > 0 &&
    gR != null && typeof gR === "number"
  ) {
    const gv = GV; // 3.4
    const num = 1 + 2 * Ih * Math.sqrt(gv * gv * Bs + (Hs * gR * gR * S * Et) / dampingRatio);
    const den = 1 + 2 * gv * Ih;
    CdynCalc = num / den;
  }

  // prefer computed value; keep your old ≤25 m shortcut if applicable
  if (Cdyn === 1.0 /* from earlier ≤25 m rule */) {
    // keep 1.0
  } else {
    Cdyn = CdynCalc;
  }

  // ---------- Design wind pressure ----------
  // P = 0.5 * rho_air * Vdes^2 * Cshp * Cdyn
  // Units: Vdes in m/s → P in Pa (N/m^2). Also return kPa for convenience.
  let P_Pa: number | null = null;
  let P_kPa: number | null = null;
  if (typeof Vsit === "number" && Vsit > 0 && typeof Cshp === "number" && typeof Cdyn === "number" && Cdyn > 0) {
    const rhoAir = 1.2; // kg/m^3
    P_Pa = 0.5 * rhoAir * Vsit * Vsit * Cshp * Cdyn;
    P_kPa = P_Pa / 1000;
  }

  return {
    rawRegion: opts.rawRegion,
    region,
    annualPoe,
    recurrence,
    windSpeed,
    Mc,
    Md,
    Mzcat,
    Ms,
    Mt,
    Vsit,
    Cshp,
    CshpParts: { cpe, ka, kce, k1, kp },

    Cdyn,
    T1_s,
    f_Hz,
    Kt,
    gR,

    Lh_m,
    Ih,
    N,
    Et,
    S,
    Bs,
    bUsedM,
    sUsedM,
    dampingRatio,
    Hs,

    // NEW: wind pressure
    P_Pa,
    P_kPa,
  };
}
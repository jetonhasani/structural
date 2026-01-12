// src/app/api/region/route.ts
import { NextResponse } from "next/server";
import { getRegionForAddress } from "@/lib/server/regionLookup";
import { calculateWindFromInputs } from "@/lib/windCalc";
import { detectTerrainCategory } from "@/lib/server/terrainCategory";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const {
      lat, lon, designLife, importance, roofHeight,
      advanced, coreMaterial, naturalFrequencyHz,
      sLevel: sLevelRoot,
    } = body ?? {};

    const toNum = (x: any): number | undefined =>
      typeof x === "number"
        ? (Number.isFinite(x) ? x : undefined)
        : typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x))
        ? Number(x)
        : undefined;

    const latNum = toNum(lat);
    const lonNum = toNum(lon);
    if (!Number.isFinite(latNum!) || !Number.isFinite(lonNum!)) {
      return NextResponse.json({ error: "lat/lon required" }, { status: 400 });
    }

    const region = await getRegionForAddress(latNum!, lonNum!);
    const terrainAuto = await detectTerrainCategory(latNum!, lonNum!);
    const terrainUsed = (advanced?.terrain as string) || terrainAuto;

    // Prefer advanced.sLevel; else root sLevel; ✅ preserve 0
    const sOverride =
      toNum(advanced?.sLevel) !== undefined
        ? toNum(advanced?.sLevel)
        : toNum(sLevelRoot);

    const result = calculateWindFromInputs({
      rawRegion: region,
      designLife,
      importance: Number(importance),

      mdOverride: toNum(advanced?.mdOverride),
      msOverride:
        toNum(advanced?.shieldingMultiplier) !== undefined &&
        toNum(advanced?.shieldingMultiplier) !== 1.0
          ? toNum(advanced?.shieldingMultiplier)
          : undefined,
      mtOverride:
        toNum(advanced?.mtOverride) !== undefined &&
        toNum(advanced?.mtOverride) !== 1.0
          ? toNum(advanced?.mtOverride)
          : undefined,

      terrainUsed,
      heightM: toNum(roofHeight),

      coreMaterial: coreMaterial ?? null,
      naturalFrequencyHz: toNum(naturalFrequencyHz),

      shapeFactor: { cpe: toNum(advanced?.shapeFactor?.cpe) },

      sizeReductionWidthM: toNum(advanced?.sizeReductionWidthM),

      // ✅ pass through (may be 0)
      sOverride: sOverride ?? null,
    });

    // ✅ Show resolved overrides back to UI (and preserve 0)
    const overridesOut = {
      ...(advanced ?? {}),
      sLevel:
        typeof sOverride === "number" && Number.isFinite(sOverride)
          ? sOverride
          : null,
    };

    return NextResponse.json({
      ...result,
      roofHeight: toNum(roofHeight) ?? null,
      terrainAuto,
      terrain: terrainUsed,
      overrides: overridesOut,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "internal error" }, { status: 500 });
  }
}
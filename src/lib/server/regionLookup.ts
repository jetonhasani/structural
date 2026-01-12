// src/lib/server/regionLookup.ts
import "server-only";
import fs from "fs/promises";
import path from "path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import type { FeatureCollection, Feature, Polygon } from "geojson";

let regionsGeoJSON: FeatureCollection | null = null;

async function loadRegions(): Promise<FeatureCollection> {
  if (regionsGeoJSON) return regionsGeoJSON;
  const filePath = path.join(process.cwd(), "public/data/windregions.geojson");
  const raw = await fs.readFile(filePath, "utf8");
  regionsGeoJSON = JSON.parse(raw) as FeatureCollection;
  return regionsGeoJSON;
}

export async function getRegionForAddress(
  lat: number,
  lon: number
): Promise<string> {
  const regions = await loadRegions();
  const pt = turfPoint([lon, lat]);

  for (const f of regions.features) {
    if (f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")) {
      if (booleanPointInPolygon(pt, f as Feature<Polygon>)) {
        return (f.properties as any)?.region ?? "Unknown";
      }
    }
  }
  return "Unknown";
}
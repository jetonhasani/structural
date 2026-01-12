// src/components/calculators/WindLoadingCalculator.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { DESIGN_WORKING_LIFE_OPTIONS } from "@/lib/windTables";
import { AdvancedToggle } from "@/components/AdvancedToggle";
import "@/styles/calculators.css";

type WindCalcProps = { onAutoSize?: (contentHeightPx: number) => void };
type TerrainCategory = "TC1" | "TC2" | "TC2.5" | "TC3" | "TC4";

export function WindLoadingCalculator({ onAutoSize }: WindCalcProps) {
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [designLife, setDesignLife] = useState("50");
  const [importance, setImportance] = useState(2);
  const [roofHeight, setRoofHeight] = useState<number | "">("");

  const [advanced, setAdvanced] = useState(false);
  const [terrain, setTerrain] = useState<TerrainCategory | "auto">("auto");
  const [shielding, setShielding] = useState<number | "">("");
  const [topoMt, setTopoMt] = useState<string>("");
  const [mdOverride, setMdOverride] = useState<number | "">("");

  const [cpe, setCpe] = useState<string>("");

  const [coreMaterial, setCoreMaterial] = useState<
    "steel_mrf" | "steel_ebr" | "concrete_mrf" | "timber_other" | ""
  >("");

  const [naturalFreq, setNaturalFreq] = useState<string>("");

  const [bOverride, setBOverride] = useState<string>("");
  const [sLevel, setSLevel] = useState<number | "">(""); // metres

  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastSentHeight = useRef<number>(0);

  useEffect(() => {
    if (!rootRef.current || !onAutoSize) return;
    const el = rootRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.ceil(entry.contentRect.height);
        if (h !== lastSentHeight.current) {
          lastSentHeight.current = h;
          onAutoSize(h);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onAutoSize, advanced]);

  useEffect(() => {
    const initAutocomplete = () => {
      if (!window.google?.maps?.places) return;
      const input = inputRef.current;
      if (!input) return;

      const autocomplete = new window.google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: "au" },
        fields: ["formatted_address", "geometry"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry?.location) return;
        setAddress(place.formatted_address || "");
        setCoords({
          lat: place.geometry.location.lat(),
          lon: place.geometry.location.lng(),
        });
      });
    };

    if (window.google?.maps?.places) initAutocomplete();
    else window.addEventListener("load", initAutocomplete);
    return () => window.removeEventListener("load", initAutocomplete);
  }, []);

  async function handleCalculate() {
    if (!coords) {
      alert("Select a full address first");
      return;
    }
    if (roofHeight === "" || Number(roofHeight) <= 0) {
      alert("Enter a valid average roof height (m)");
      return;
    }

    setLoading(true);
    try {
      const toNum = (s: string | number | undefined | null) =>
        typeof s === "number"
          ? (Number.isFinite(s) ? s : undefined)
          : typeof s === "string" && s.trim() !== "" && Number.isFinite(Number(s))
          ? Number(s)
          : undefined;

      const msOverride =
        typeof shielding === "number" && Number.isFinite(shielding) && shielding !== 1.0
          ? shielding
          : undefined;

      const mtOverride =
        toNum(topoMt) !== undefined && toNum(topoMt) !== 1.0 ? toNum(topoMt) : undefined;

      const md = toNum(mdOverride);
      const shapeFactor = advanced && cpe !== "" ? { cpe: toNum(cpe) } : undefined;

      // ✅ allow 0 as a valid sLevel — only filter NaN/undefined
      const sLevelNum =
        typeof sLevel === "number" && Number.isFinite(sLevel)
          ? sLevel
          : toNum(sLevel); // covers string "0"

      const advancedPayload = advanced
        ? {
            terrain: terrain !== "auto" ? terrain : undefined,
            shieldingMultiplier: msOverride,
            mtOverride,
            mdOverride: md,
            shapeFactor,
            sizeReductionWidthM: toNum(bOverride),

            // ✅ send sLevel whenever it's a number (including 0)
            sLevel: typeof sLevel === "number" && Number.isFinite(sLevel) ? sLevel : undefined,
          }
        : undefined;

      const res = await fetch("/api/region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: coords.lat,
          lon: coords.lon,
          designLife,
          importance,
          roofHeight,
          advanced: advancedPayload,
          coreMaterial:
            typeof roofHeight === "number" && roofHeight > 25 ? coreMaterial || null : null,
          naturalFrequencyHz: toNum(naturalFreq),

          // ✅ also forward sLevel at root when numeric (including 0)
          sLevel: typeof sLevel === "number" && Number.isFinite(sLevel) ? sLevel : undefined,
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={rootRef} className="rounded-lg bg-white shadow p-4 space-y-4">
      <h2 className="text-lg font-semibold">Wind Loading Calculator</h2>
      <p className="text-sm text-gray-500">
        Uses AS/NZS 1170.2 regional wind speeds for given location and design life.
      </p>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium">Full address</label>
        <input
          ref={inputRef}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Start typing address..."
          className="w-full border rounded px-2 py-1"
        />
      </div>

      {/* Design life + Importance */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Design working life</label>
          <select
            value={designLife}
            onChange={(e) => setDesignLife(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            {DESIGN_WORKING_LIFE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Importance level</label>
          <select
            value={importance}
            onChange={(e) => setImportance(Number(e.target.value))}
            className="w-full border rounded px-2 py-1"
          >
            <option value={1}>1 (Low)</option>
            <option value={2}>2 (Normal)</option>
            <option value={3}>3 (High)</option>
            <option value={4}>4 (Critical)</option>
          </select>
        </div>
      </div>

      {/* Average roof height */}
      <div>
        <label className="block text-sm font-medium">Average roof height (m)</label>
        <input
          type="number"
          min="0"
          step="0.1"
          value={roofHeight}
          onChange={(e) => setRoofHeight(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="e.g. 6.5"
          className="w-full border rounded px-2 py-1"
        />
      </div>

      {/* Core material (only if height > 25 m) */}
      {typeof roofHeight === "number" && roofHeight > 25 && (
        <div className="field">
          <label className="block text-sm font-medium">
            Core material (required for H &gt; 25 m)
          </label>
          <select
            className="w-full border rounded px-2 py-1"
            value={coreMaterial}
            onChange={(e) => setCoreMaterial(e.target.value as any)}
            required
          >
            <option value="">Select...</option>
            <option value="steel_mrf">Steel — moment-resisting frame (Kt=0.11)</option>
            <option value="steel_ebr">Steel — eccentrically braced frame (Kt=0.06)</option>
            <option value="concrete_mrf">Concrete — moment-resisting (Kt=0.075)</option>
            <option value="timber_other">Timber / Other (Kt=0.05)</option>
          </select>
        </div>
      )}

      {/* Advanced */}
      <AdvancedToggle checked={advanced} onChange={setAdvanced} />
      {advanced && (
        <section className="adv-panel">
          <header className="adv-panel__header">
            <span className="adv-panel__title">Engineer Overrides</span>
            <span className="adv-panel__badge">Optional</span>
          </header>

          <div className="adv-panel__grid">
            {/* Terrain */}
            <div className="field">
              <label className="block text-sm font-medium">
                Terrain category <span className="muted">• Auto-detected</span>
              </label>
              <select
                className="w-full border rounded px-2 py-1"
                value={terrain}
                onChange={(e) => setTerrain(e.target.value as TerrainCategory | "auto")}
              >
                <option value="auto">Auto</option>
                <option value="TC1">TC1</option>
                <option value="TC2">TC2</option>
                <option value="TC2.5">TC2.5</option>
                <option value="TC3">TC3</option>
                <option value="TC4">TC4</option>
              </select>
            </div>

            {/* Shielding (Ms) */}
            <div className="field">
              <label className="block text-sm font-medium">
                Shielding Multiplier (Ms) <span className="muted">• Auto (1.0)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full border rounded px-2 py-1"
                value={shielding}
                onChange={(e) =>
                  setShielding(e.target.value === "" ? "" : parseFloat(e.target.value))
                }
                placeholder="1.00"
              />
            </div>

            {/* Topography (Mt) */}
            <div className="field">
              <label className="block text-sm font-medium">
                Topographic Multiplier (Mt) <span className="muted">• Auto (1.0)</span>
              </label>
              <select
                className="w-full border rounded px-2 py-1"
                value={topoMt}
                onChange={(e) => setTopoMt(e.target.value)}
              >
                <option value="">Auto (1.00)</option>
                <option value="1.10">Hill/Ridge — Near crest (H 10-60m) Mt = 1.10</option>
                <option value="1.15">Hill/Ridge — Near crest (H {'>'} 60m) Mt = 1.15</option>
                <option value="1.05">Hill/Ridge — Mid-slope Mt = 1.05</option>
                <option value="1.00">Hill/Ridge — Lower slope Mt = 1.00</option>
                <option value="1.15">Escarpment — Near edge (H 10-60m) Mt = 1.15</option>
                <option value="1.20">Escarpment — Near edge (H {'>'} 60m) Mt = 1.20</option>
                <option value="1.10">Escarpment — Mid-slope Mt = 1.10</option>
                <option value="1.00">Escarpment — Lower slope Mt = 1.00</option>
              </select>
            </div>

            {/* Md override */}
            <div className="field field-span2">
              <label className="block text-sm font-medium">
                Wind direction multiplier (Md){" "}
                <span className="muted">• Auto uses conservative max for region</span>
              </label>
              <div className="adv-row">
                <input
                  type="number"
                  step="0.01"
                  min="0.70"
                  max="1.10"
                  placeholder="Leave blank for Auto (e.g., 0.95 or 1.00)"
                  className="w-full border rounded px-2 py-1"
                  value={mdOverride}
                  onChange={(e) =>
                    setMdOverride(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              {/* Aerodynamic shape factor (Cshp) */}
              <div className="field-group mt-3">
                <h4 className="text-sm font-semibold">Aerodynamic Shape Factor (Cshp)</h4>
                <p className="text-xs text-gray-600 mb-2">
                  Defaults: Ka=1.00, Kc,e=1.00, K<sub>1</sub>=1.00, K<sub>p</sub>=1.00, C<sub>p,e</sub>=0.80.
                  You can override C<sub>p,e</sub> below if needed.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-sm">
                    C<sub>p,e</sub> (external pressure coefficient)
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border rounded px-2 py-1 mt-1"
                      value={cpe}
                      onChange={(e) => setCpe(e.target.value)}
                      placeholder="0.80"
                    />
                  </label>
                </div>
              </div>

              {/* Dynamic response */}
              <div className="field">
                <label className="block text-sm font-medium">
                  Natural frequency nₐ (Hz) <span className="muted">• Optional</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className="w-full border rounded px-2 py-1"
                  value={naturalFreq}
                  onChange={(e) => setNaturalFreq(e.target.value)}
                  placeholder="e.g. 0.35"
                />
              </div>

              {/* Size reduction width b */}
              <div className="field">
                <label className="block text-sm font-medium">
                  Plan width b (m) <span className="muted">• Default 0.5 × height</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="w-full border rounded px-2 py-1"
                  value={bOverride}
                  onChange={(e) => setBOverride(e.target.value)}
                  placeholder="Leave blank to use 0.5×h"
                />
              </div>

              {/* Bs level s (override) */}
              <div className="field">
                <label className="block text-sm font-medium">
                  Level (s) – at which action effects are being calculated
                  <span className="muted"> • Default 0.5 × height</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="w-full border rounded px-2 py-1"
                  value={sLevel ?? ""}
                  onChange={(e) => setSLevel(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 10 (metres)"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      <button
        disabled={loading}
        onClick={handleCalculate}
        className="bg-black text-white px-3 py-1 rounded"
      >
        {loading ? "Calculating..." : "Calculate Wind Region + Speed"}
      </button>

      {/* Output */}
      {result && (
        <div className="border-t pt-3 space-y-1 text-sm">
          <p><strong>Region:</strong> {result.region}</p>
          <p><strong>Annual PoE:</strong> {result.annualPoe ?? "—"}</p>
          <p><strong>Recurrence:</strong> {result.recurrence ?? "—"}</p>
          <p><strong>Regional Wind Speed (V_R):</strong> {result.windSpeed ? `${result.windSpeed} m/s` : "—"}</p>
          <p><strong>Climate Change Multiplier (M<span style={{ fontVariant: "small-caps" }}>c</span>):</strong> {result.Mc ?? "—"}</p>
          <p><strong>Wind Direction Multiplier (M<span style={{ fontVariant: "small-caps" }}>d</span>):</strong> {result.Md ?? "—"}</p>
          <p><strong>Terrain (auto):</strong> {result.terrainAuto ?? "—"}</p>
          <p><strong>Terrain (used):</strong> {result.terrain ?? "—"}</p>
          <p><strong>Terrain/height multiplier (Mz,cat):</strong> {result.Mzcat ?? "—"}</p>
          <p><strong>Shielding Multiplier (Ms):</strong> {typeof result.Ms === "number" ? result.Ms.toFixed(2) : "1.00"}</p>
          <p><strong>Topographic Multiplier (Mt):</strong> {typeof result.Mt === "number" ? result.Mt.toFixed(2) : "1.00"}</p>

          {/* Final site design wind speed */}
          <p className="mt-2 text-base">
            <strong>Design Site Wind Speed V<sub>sit,β</sub>:</strong>{" "}
            {typeof result.Vsit === "number" ? `${result.Vsit.toFixed(2)} m/s` : "—"}
            {typeof result.Vsit === "number" && <> ({(result.Vsit * 3.6).toFixed(1)} km/h)</>}
          </p>

          {/* Optional: Cshp display */}
          <p><strong>Aerodynamic Shape Factor (Cshp):</strong> {typeof result.Cshp === "number" ? result.Cshp.toFixed(3) : "1.000"}</p>
          {result?.CshpParts && (
            <p className="text-xs text-gray-600">
              C<sub>p,e</sub>={result.CshpParts.cpe}, K<sub>a</sub>={result.CshpParts.ka}, K<sub>c,e</sub>={result.CshpParts.kce}, K<sub>1</sub>={result.CshpParts.k1}, K<sub>p</sub>={result.CshpParts.kp}
            </p>
          )}

          {/* Dynamics */}
          <p>
            <strong>Gust Response Factor (g<sub>R</sub>):</strong>{" "}
            {result.gR === null || typeof result.gR === "undefined" ? "—" : Number(result.gR).toFixed(3)}
          </p>
          {(typeof result.T1_s === "number" || typeof result.f_Hz === "number") && (
            <p>
              <strong>Period T<sub>1</sub>:</strong>{" "}
              {typeof result.T1_s === "number" ? result.T1_s.toFixed(3) + " s" : "—"}{" "}
              • <strong>f:</strong>{" "}
              {typeof result.f_Hz === "number" ? result.f_Hz.toFixed(3) + " Hz" : "—"}{" "}
              {typeof result.Kt === "number" && <>(K<sub>t</sub>={result.Kt})</>}
            </p>
          )}

          <p>
            <strong>Integral Turbulence Length Scale (L<sub>h</sub>):</strong>{" "}
            {typeof result.Lh_m === "number" ? result.Lh_m.toFixed(2) + " m" : "—"}
          </p>

          <p>
            <strong>Turbulence Intensity (I<sub>h</sub>):</strong>{" "}
            {typeof result.Ih === "number" ? result.Ih.toFixed(3) : "—"}
          </p>

          <p>
            <strong>Reduced Frequency (N):</strong>{" "}
            {typeof result.N === "number" ? result.N.toFixed(3) : "—"}
          </p>

          <p>
            <strong>Plan Width Used (b):</strong>{" "}
            {typeof result.bUsedM === "number" ? result.bUsedM.toFixed(2) + " m" : "—"}
          </p>
          <p>
            <strong>Size Reduction Factor (S):</strong>{" "}
            {typeof result.S === "number" ? result.S.toFixed(3) : "—"}
          </p>
          <p>
            <strong>Background Factor (B<sub>s</sub>):</strong>{" "}
            {typeof result.Bs === "number" ? result.Bs.toFixed(3) : "—"}
          </p>

          <p>
            <strong>Reduced Frequency (N):</strong>{" "}
            {typeof result.N === "number" ? result.N.toFixed(3) : "—"}
          </p>

          <p>
            <strong>Turbulence Spectrum (E<sub>t</sub>):</strong>{" "}
            {typeof result.Et === "number" ? result.Et.toFixed(3) : "—"}
          </p>

          <p>
            <strong>Damping Ratio (ζ):</strong>{" "}
            {typeof result.dampingRatio === "number"
              ? result.dampingRatio.toFixed(3)
              : "—"}
          </p>

          <p>
            <strong>Dynamic Response Factor (C<sub>dyn</sub>):</strong>{" "}
            {result.Cdyn === null || typeof result.Cdyn === "undefined" ? "—" : Number(result.Cdyn).toFixed(2)}
          </p>

          <p>
            <strong>Height Factor (H<sub>s</sub>):</strong>{" "}
            {typeof result.Hs === "number" ? result.Hs.toFixed(3) : "—"}
          </p>

          <p>
            <strong>Design Wind Pressure (P):</strong>{" "}
            {typeof result.P_kPa === "number"
              ? `${result.P_kPa.toFixed(3)} kPa`
              : "—"}
            {typeof result.P_Pa === "number" && (
              <> ({result.P_Pa.toFixed(0)} Pa)</>
            )}
          </p>




          {result?.overrides && (
            <div className="mt-2 rounded border p-2">
              <p className="font-semibold">Overrides</p>
              <pre className="text-xs overflow-x-auto">
{JSON.stringify(result.overrides, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WindLoadingCalculator;
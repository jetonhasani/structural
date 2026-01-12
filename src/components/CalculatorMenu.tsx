"use client";
import { useState } from "react";
import { WindLoadingCalculator } from "./calculators/WindLoadingCalculator";
// import { BeamDeflectionCalculator } from "./calculators/BeamDeflectionCalculator";
// import { LoadCombinationCalculator } from "./calculators/LoadCombinationCalculator";

interface CalcSectionProps {
  title: string;
  children: React.ReactNode;
}

function CalcSection({ title, children }: CalcSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className={`calc-section ${open ? "open" : ""}`}>
      <button
        onClick={() => setOpen(!open)}
        className="calc-toggle"
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className={`arrow ${open ? "rotate" : ""}`}> ▼</span>
      </button>

      {open && <div className="calc-content">{children}</div>}
    </section>
  );
}

export function CalculatorMenu() {
  return (
    <main className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <h1 className="text-3xl font-bold text-center mb-8">
        Structural Calculators
      </h1>

      {/* Wind Loading */}
      <CalcSection title="Wind Loading Calculator">
        <WindLoadingCalculator />
      </CalcSection>

      {/* Beam Deflection */}
      <CalcSection title="Beam Deflection Calculator">
        <p>
          Calculates the maximum deflection of a beam under uniform or point
          load. You’ll input span length, load type, E (Young’s Modulus), and I
          (Moment of Inertia).
        </p>
        {/* <BeamDeflectionCalculator /> */}
      </CalcSection>

      {/* Load Combinations */}
      <CalcSection title="Load Combination Calculator">
        <p>
          Computes ultimate and serviceability load combinations based on AS/NZS
          standards (e.g., 1.2G + 1.5Q). Choose your governing load cases and
          safety factors.
        </p>
        {/* <LoadCombinationCalculator /> */}
      </CalcSection>

      {/* Future Calculators */}
      <CalcSection title="Concrete Column Capacity">
        <p>
          Estimate axial load capacity of short concrete columns using concrete
          and steel design parameters.
        </p>
      </CalcSection>
    </main>
  );
}

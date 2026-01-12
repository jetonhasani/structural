// src/components/AdvancedToggle.tsx
"use client";
import React from "react";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  className?: string;
  hint?: string;
};

export function AdvancedToggle({
  checked,
  onChange,
  label = "Advanced mode",
  hint = "Engineer overrides (terrain, shielding, topography)",
  className = "",
}: Props) {
  return (
    <div className={`adv-toggle ${className}`}>
      <div className="adv-toggle__row">
        <div className="adv-toggle__texts">
          <div className="adv-toggle__label">{label}</div>
          <div className="adv-toggle__hint">{hint}</div>
        </div>

        {/* pill switch */}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          className={`adv-switch ${checked ? "on" : ""}`}
          onClick={() => onChange(!checked)}
        >
          <span className="adv-switch__knob" />
        </button>
      </div>
    </div>
  );
}
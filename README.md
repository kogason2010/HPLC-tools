# HPLC Tools

Browser-based calculators for everyday HPLC/UHPLC work. It is a static site with no build step and no dependencies, and all calculations run locally in the browser.

**Live site:** https://kogason2010.github.io/hplc-tools/

## Calculators

| Tab | What it does |
|---|---|
| **Method transfer** | Scales flow rate, injection volume and gradient program between column geometries (e.g. HPLC → UHPLC). Checks the USP <621> L/dp window (−25% to +50%), estimates the pressure change, and calculates dwell-volume compensation (initial hold or injection delay). |
| **System suitability** | k, α, plate count N, resolution Rs (half-height or baseline widths) and USP tailing factor. It also has a Purnell-equation what-if that gives the plates or selectivity needed to reach a target Rs, with a chart. |
| **Buffer prep** | Henderson–Hasselbalch amounts (g or mL) for phosphate, formate, acetate, Tris and ammonium buffers at a target pH, concentration and volume, and flags pH values outside pKa ± 1. |
| **Pressure & viscosity** | Viscosity of water–acetonitrile and water–methanol mixtures versus composition and temperature, plus a Darcy's-law column pressure estimate and the peak pressure across a gradient. |
| **Column & solvent** | Void volume, t0, linear velocity, dwell time, re-equilibration time, and mobile-phase consumption for a sequence. |
| **Units** | Conversions for pressure (bar, psi, MPa, kPa, atm, kgf/cm²) and concentration (mass ↔ molar), and between flow rate and linear velocity. |

## Accuracy notes

- Results are estimates for method development and planning. Pressure and viscosity values are approximate (roughly ±10–30%). Buffer amounts are starting points to be confirmed with a pH meter.
- The USP <621> check covers only the L/dp rule from the harmonized chapter (official December 2022). For regulated methods, verify against the current official chapter and confirm system suitability experimentally.
- The equations used are listed under each tab.

## Running locally

Open `index.html` in any modern browser.

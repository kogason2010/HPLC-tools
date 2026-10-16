# HPLC Tools

Browser-based calculators for everyday HPLC/UHPLC work. It is a static site with no build step and no dependencies, and all calculations run locally in the browser. Inputs are remembered on your device, and every tab has **Copy link** (shares the current inputs) and **Reset** buttons.

**Live site:** https://kogason2010.github.io/HPLC-tools/

## Calculators

| Tab | What it does |
|---|---|
| **Method transfer** | Scales flow, injection volume and the gradient table between column geometries (e.g. HPLC → UHPLC). Checks the USP <621> L/dp window (−25% to +50%) and the ±50% extra-flow allowance. Handles fully porous ↔ superficially porous particle changes. Estimates new pressure against an optional system limit. Calculates dwell-volume compensation (initial hold or injection delay) and shows run-time and solvent savings. The scaled gradient table can be copied straight into a CDS. |
| **Gradient** | Linear-solvent-strength estimates: gradient retention factor k\*, gradient time for a target k\*, gradient volume and slope, peak capacity, and the Snyder–Dolan "isocratic or gradient?" check from a scouting run. |
| **System suitability** | k, α, plate count N, reduced plate height h, resolution Rs (half-height or baseline widths), symmetry factor, S/N (2H/h) with LOD/LOQ estimates, and replicate-injection %RSD. Includes a Purnell-equation what-if with a chart. |
| **Buffers** | Reagent amounts (g or mL) for phosphate, formate, acetate, Tris and ammonium buffers. Uses the full charge balance with Davies activity corrections; plain Henderson–Hasselbalch can be ~30% off near pH 2–3. Shows the effective pKa′, ionic strength and buffer capacity, and flags pH targets the reagent pair cannot reach. Also estimates the pH of x% formic, acetic, TFA or phosphoric acid. |
| **Pressure & viscosity** | Viscosity of water–acetonitrile and water–methanol versus composition and temperature (Chen & Horváth correlation), Darcy's-law pressure estimate, and the peak pressure across a gradient. You can calibrate the flow-resistance factor from one measured pressure. |
| **Column & solvent** | Void volume, t0, linear velocity, dwell time, re-equilibration time, and mobile-phase consumption for a sequence. |
| **Units** | Conversions for pressure, mass ↔ molar concentration (including amount on column), and flow ↔ linear velocity. |

## Accuracy notes

- Results are estimates for method development and planning. Buffer amounts are starting points to be confirmed with a pH meter. Pressure estimates should be calibrated with a measured value where possible.
- USP <621> checks cover the L/dp, particle-type and flow-adjustment rules of the harmonized chapter (official 1 December 2022). For regulated methods, verify against the current official chapter and the monograph, and confirm system suitability experimentally.
- The equations used are listed under each tab.

## Development

- `calc.js` contains all calculations as pure functions (used by the page as `window.HPLC`, and by Node).
- `app.js` is the UI layer; `index.html` and `style.css` are the page.
- Tests: `node tests/calc.test.js`. They check the scaling math, USP limits, viscosity against literature values, and buffer recipes, using an independent forward charge-balance solve.

Open `index.html` in any modern browser to run locally.

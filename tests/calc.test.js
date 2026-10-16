// Run with: node tests/calc.test.js
"use strict";
const assert = require("assert");
const H = require("../calc.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n       " + e.message); process.exitCode = 1; }
}
const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b} ± ${tol}, got ${a}`);
const rel = (a, b, frac, msg) => near(a, b, Math.abs(b) * frac, msg);

console.log("Method transfer");
test("150×4.6 mm 5 µm → 50×2.1 mm 1.7 µm", () => {
  const r = H.transfer({ L1: 150, d1: 4.6, p1: 5, F1: 1.0, V1: 10, L2: 50, d2: 2.1, p2: 1.7 });
  near(r.F2, 1.0 * (2.1 ** 2 / 4.6 ** 2) * (5 / 1.7), 1e-12, "flow");
  near(r.F2, 0.6130, 5e-4, "flow value");
  near(r.V2, 0.6947, 5e-4, "injection volume");
  near(r.lp1, 30000, 1e-9); near(r.lp2, 29411.76, 0.01);
  assert.ok(r.lpOK, "L/dp within −25%…+50%");
  // gradient volume in column volumes is preserved
  near(r.F2 * r.timeFactor / r.volRatio, 1.0, 1e-12, "F·t/V preserved");
});
test("L/dp limits", () => {
  const base = { L1: 150, d1: 4.6, p1: 5, F1: 1, L2: 150, d2: 4.6 };
  assert.ok(H.transfer({ ...base, p2: 5 / 1.5 }).lpOK, "+50% exactly");
  assert.ok(!H.transfer({ ...base, p2: 5 / 1.51 }).lpOK, "> +50%");
  assert.ok(H.transfer({ ...base, p2: 5 / 0.75 }).lpOK, "−25% exactly");
  assert.ok(!H.transfer({ ...base, p2: 5 / 0.74 }).lpOK, "< −25%");
});
test("flow without dp scaling, extra adjustment flagged", () => {
  const r = H.transfer({ L1: 150, d1: 4.6, p1: 5, F1: 1, L2: 150, d2: 3.0, p2: 3, useDp: false, extraPct: 60 });
  near(r.Fgeo, 9 / 21.16, 1e-12);
  assert.ok(!r.flowAdjOK);
});
test("pressure ratio", () => {
  const r = H.transfer({ L1: 150, d1: 4.6, p1: 5, F1: 1, L2: 150, d2: 4.6, p2: 2.5, useDp: false });
  near(r.pressureRatio, 4, 1e-12, "halving dp at same flow = ×4");
});
test("dwell compensation", () => {
  const a = H.dwellCompensation(1.0, 0.05, 0.1, 0.5);
  near(a.target, 0.1, 1e-12); near(a.hold, 0.1, 1e-12); assert.strictEqual(a.delay, 0);
  const b = H.dwellCompensation(1.0, 0.35, 0.1, 0.5);
  near(b.delay, 0.5, 1e-12); assert.strictEqual(b.hold, 0);
});
test("gradient scaling with hold", () => {
  const g = H.scaleGradient([[10, 95], [0, 5], [NaN, 3]], 0.5, 0.2);
  assert.deepStrictEqual(g, [[0, 5], [0.2, 5], [5.2, 95]]);
});

console.log("System suitability");
test("plates, resolution, symmetry", () => {
  near(H.plates(5.4, 0.08, "half"), 25241.6, 0.1);
  near(H.plates(5.4, 0.136, "base"), 16 * (5.4 / 0.136) ** 2, 1e-9);
  near(H.resolution(5.40, 5.85, 0.080, 0.085, "half"), 3.218, 1e-3);
  near(H.resolution(5.40, 5.85, 0.136, 0.144, "base"), 3.214, 1e-3);
  near(H.symmetry(0.16, 0.072), 1.111, 1e-3);
  near(H.signalToNoise(50, 4), 25, 1e-12);
  near(H.reducedPlateHeight(150, 25000, 5), 1.2, 1e-12);
});
test("Purnell round-trips", () => {
  const Rs = H.purnell(10000, 1.1, 4);
  near(Rs, 1.818, 1e-3);
  near(H.purnellPlatesNeeded(Rs, 1.1, 4), 10000, 1e-6);
  near(H.purnellAlphaNeeded(Rs, 10000, 4), 1.1, 1e-9);
  assert.ok(Number.isNaN(H.purnellAlphaNeeded(50, 1000, 1)));
});
test("replicate statistics", () => {
  const s = H.stats(H.parseNumbers("1, 2;3\n4"));
  near(s.mean, 2.5, 1e-12); near(s.sd, 1.2909944, 1e-6); near(s.rsd, 51.639778, 1e-5);
  assert.strictEqual(s.n, 4);
});

console.log("Gradient");
test("k* and gradient time are inverses", () => {
  const k = H.gradientK(10, 1.0, 1.5, 0.9, 4);
  near(k, 10 / (1.15 * 1.5 * 0.9 * 4), 1e-12);
  near(H.gradientTimeForK(k, 1.0, 1.5, 0.9, 4), 10, 1e-12);
  near(H.peakCapacity(20, 0.1), 201, 1e-12);
});

console.log("Column");
test("void volume and velocity", () => {
  near(H.columnVolume(150, 4.6), 2.4929, 1e-4);
  near(H.voidVolume(150, 4.6, 0.65), 1.6204, 1e-4);
  // u0 = L / t0
  const t0 = H.voidVolume(150, 4.6, 0.65) / 1.0; // min
  near(H.linearVelocity(1.0, 4.6, 0.65), 150 / (t0 * 60), 1e-9);
});

console.log("Viscosity (25 °C literature: water 0.89, MeCN 0.34, MeOH 0.54, MeOH–water max ≈1.6 cP)");
test("pure components", () => {
  rel(H.viscosity("acn", 0, 25), 0.89, 0.06, "water (MeCN fit)");
  rel(H.viscosity("meoh", 0, 25), 0.89, 0.06, "water (MeOH fit)");
  rel(H.viscosity("acn", 100, 25), 0.34, 0.08, "acetonitrile");
  rel(H.viscosity("meoh", 100, 25), 0.54, 0.10, "methanol");
});
test("methanol–water maximum", () => {
  let max = 0, at = 0;
  for (let x = 0; x <= 100; x++) { const v = H.viscosity("meoh", x, 25); if (v > max) { max = v; at = x; } }
  rel(max, 1.6, 0.08, "max viscosity");
  assert.ok(at >= 30 && at <= 55, "max between 30–55% (got " + at + ")");
});
test("viscosity falls with temperature", () => {
  assert.ok(H.viscosity("acn", 50, 60) < H.viscosity("acn", 50, 30));
});

console.log("Pressure");
test("Darcy estimate in a realistic range", () => {
  // 150 × 4.6 mm, 5 µm, 1 mL/min, 50% MeCN at 25 °C: typically ~70–120 bar
  const p = H.columnPressure(1000, H.viscosity("acn", 50, 25), 150, 4.6, 5, 1.0, 0.65);
  assert.ok(p > 60 && p < 130, "got " + p);
  // linear in flow and length, inverse square in dp
  const p2 = H.columnPressure(1000, 1, 100, 2.1, 1.7, 0.4, 0.65);
  near(H.columnPressure(1000, 1, 100, 2.1, 1.7, 0.8, 0.65), 2 * p2, 1e-9);
  near(H.columnPressure(1000, 1, 100, 2.1, 3.4, 0.4, 0.65), p2 / 4, 1e-9);
  near(H.flowResistance(p2, 1, 100, 2.1, 1.7, 0.4, 0.65), 1000, 1e-9);
});

console.log("Buffers");
const sys = (id) => H.BUFFERS.find((b) => b.id === id);
// Independent forward check: given the computed amounts, solve the charge
// balance for pH by bisection (same Davies model) and compare with the target.
function forwardPH(s, nA, nB, VmL) {
  const VL = VmL / 1000, cA = nA / VL, cB = nB / VL, C = cA + cB;
  let I = 0.5 * C;
  let pH = 7;
  for (let outer = 0; outer < 100; outer++) {
    const f = Math.sqrt(I) / (1 + Math.sqrt(I)) - 0.3 * I;
    const g1 = Math.pow(10, -0.509 * f);
    const pKaEff = s.pKa + 0.509 * f * (2 * s.za - 1);
    const counter = (x, ions) => ions.reduce((sum, [z, n]) => sum + z * n * x, 0);
    const charge = (p) => {
      const aH = Math.pow(10, -p), r = Math.pow(10, p - pKaEff), al = r / (1 + r);
      return s.za * C * (1 - al) + (s.za - 1) * C * al + aH / g1 - 1e-14 / aH / g1 +
        counter(cA, s.acid.ions) + counter(cB, s.base.ions);
    };
    let lo = -1, hi = 15;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (charge(mid) > 0) lo = mid; else hi = mid; }
    pH = (lo + hi) / 2;
    const aH = Math.pow(10, -pH), r = Math.pow(10, pH - pKaEff), al = r / (1 + r);
    const ions = [[s.za, C * (1 - al)], [s.za - 1, C * al], [1, aH / g1], [-1, 1e-14 / aH / g1]];
    s.acid.ions.forEach(([z, n]) => ions.push([z, cA * n]));
    s.base.ions.forEach(([z, n]) => ions.push([z, cB * n]));
    const Inew = 0.5 * ions.reduce((t, [z, c]) => t + z * z * c, 0);
    if (Math.abs(Inew - I) < 1e-13) break;
    I = 0.5 * (I + Inew);
  }
  return pH;
}
test("Henderson–Hasselbalch limit (no activity, pH = pKa)", () => {
  const r = H.bufferPrep(sys("acetNa"), 4.76, 20, 1000, { activity: false });
  near(r.molBase / (r.molAcid + r.molBase), 0.5, 2e-3);
});
for (const [id, pH, c] of [["phos1", 2.5, 20], ["phos1", 2.1, 25], ["formate", 3.5, 10], ["acetNH4", 4.8, 10],
  ["phos2k", 7.0, 50], ["phos2na", 6.8, 25], ["tris", 8.0, 50], ["ammonia", 9.5, 10]]) {
  test(`forward check ${id} pH ${pH}, ${c} mM`, () => {
    const s = sys(id);
    const r = H.bufferPrep(s, pH, c, 1000);
    assert.ok(r.feasible, "feasible");
    near(forwardPH(s, r.molAcid, r.molBase, 1000), pH, 2e-3, "pH from computed amounts");
    near(r.molAcid + r.molBase, c / 1000, 1e-12, "total");
  });
}
test("low-pH phosphate differs strongly from Henderson–Hasselbalch", () => {
  const r = H.bufferPrep(sys("phos1"), 2.5, 20, 1000);
  assert.ok(r.molBase < 0.8 * r.hhMolBase, `charge balance ${r.molBase} vs HH ${r.hhMolBase}`);
});
test("unreachable pH flagged", () => {
  const r = H.bufferPrep(sys("phos1"), 1.5, 10, 1000);
  assert.ok(!r.feasible); assert.strictEqual(r.needs, "acid");
});
test("additive pH (0.1% v/v): formic ≈2.7, acetic ≈3.2, TFA ≈2.0, phosphoric ≈2.1", () => {
  const ph = (id) => { const a = H.ADDITIVES.find((x) => x.id === id); return H.weakAcidPH(a.pKa, H.additiveMolarity(a, 0.1)); };
  near(ph("formic"), 2.7, 0.1, "formic");
  near(ph("acetic"), 3.25, 0.1, "acetic");
  near(ph("tfa"), 1.95, 0.15, "TFA");
  near(ph("phosphoric"), 2.15, 0.12, "phosphoric");
});

console.log("Units");
test("pressure factors", () => {
  near(400 * H.PRESSURE_PER_BAR.psi, 5801.5, 0.1);
  near(H.PRESSURE_PER_BAR.mpa * 1000, 100, 1e-12);
});

console.log(`\n${passed} passed` + (process.exitCode ? ", some FAILED" : ""));

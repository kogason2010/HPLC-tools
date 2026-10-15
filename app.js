/* HPLC Tools — all calculations run client-side. */
(function () {
  "use strict";

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const num = (id) => {
    const el = $(id);
    if (!el || el.value === "") return NaN;
    return parseFloat(el.value);
  };
  const ok = (...xs) => xs.every((x) => Number.isFinite(x));
  const pos = (...xs) => xs.every((x) => Number.isFinite(x) && x > 0);

  function fmt(x, sig = 3) {
    if (!Number.isFinite(x)) return "—";
    if (x === 0) return "0";
    const a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) return x.toExponential(sig - 1);
    const d = Math.max(0, sig - 1 - Math.floor(Math.log10(a)));
    return x.toFixed(Math.min(d, 6));
  }
  const fix = (x, d) => (Number.isFinite(x) ? x.toFixed(d) : "—");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function stat(label, value, sub = "", cls = "") {
    return `<div class="stat ${cls}"><div class="k">${label}</div><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;
  }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function bindAll(ids, fn) {
    ids.forEach((id) => {
      const el = $(id);
      if (el) { el.addEventListener("input", fn); el.addEventListener("change", fn); }
    });
  }

  // ---------- tabs ----------
  const tabs = document.querySelectorAll(".tabs button");
  function showTab(name, push) {
    let found = false;
    tabs.forEach((b) => {
      const on = b.dataset.tab === name;
      if (on) found = true;
      b.setAttribute("aria-selected", on ? "true" : "false");
      $(b.dataset.tab).hidden = !on;
    });
    if (!found) return showTab("transfer", false);
    if (push) history.replaceState(null, "", "#" + name);
    redrawCharts();
  }
  tabs.forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab, true)));

  // ---------- simple line chart ----------
  function lineChart(canvas, opts) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    if (!w) return;
    const h = parseInt(canvas.getAttribute("height"), 10);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const ink = cssVar("--ink"), muted = cssVar("--muted"), line = cssVar("--line");
    const pad = { l: 52, r: 16, t: 28, b: 40 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    const [x0, x1] = opts.xRange, [y0, y1] = opts.yRange;
    const X = (x) => pad.l + ((x - x0) / (x1 - x0)) * pw;
    const Y = (y) => pad.t + ph - ((y - y0) / (y1 - y0)) * ph;

    ctx.font = "12px " + cssVar("--sans");
    ctx.strokeStyle = line; ctx.fillStyle = muted; ctx.lineWidth = 1;
    // grid + y labels
    const yt = opts.yTicks;
    yt.forEach((v) => {
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(pad.l + pw, Y(v)); ctx.stroke();
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(opts.yFmt ? opts.yFmt(v) : v, pad.l - 6, Y(v));
    });
    opts.xTicks.forEach((v) => {
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(opts.xFmt ? opts.xFmt(v) : v, X(v), pad.t + ph + 6);
    });
    ctx.textAlign = "center";
    ctx.fillText(opts.xLabel, pad.l + pw / 2, h - 16);
    ctx.save(); ctx.translate(13, pad.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(opts.yLabel, 0, 0); ctx.restore();

    // reference lines
    (opts.hLines || []).forEach((hl) => {
      if (hl.y < y0 || hl.y > y1) return;
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = muted;
      ctx.beginPath(); ctx.moveTo(pad.l, Y(hl.y)); ctx.lineTo(pad.l + pw, Y(hl.y)); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = muted; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      ctx.fillText(hl.label, pad.l + pw - 4, Y(hl.y) - 3);
    });

    // series
    ctx.save();
    ctx.beginPath(); ctx.rect(pad.l, pad.t, pw, ph); ctx.clip();
    opts.series.forEach((s) => {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.setLineDash(s.dash || []);
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.stroke();
    });
    ctx.restore();

    // marker
    if (opts.marker && ok(opts.marker.x, opts.marker.y)) {
      const mx = X(opts.marker.x), my = Y(Math.min(Math.max(opts.marker.y, y0), y1));
      ctx.fillStyle = opts.marker.color; ctx.strokeStyle = cssVar("--surface"); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // legend
    let lx = pad.l;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    opts.series.forEach((s) => {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.setLineDash(s.dash || []);
      ctx.beginPath(); ctx.moveTo(lx, 12); ctx.lineTo(lx + 18, 12); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ink; ctx.fillText(s.name, lx + 24, 12);
      lx += 24 + ctx.measureText(s.name).width + 18;
    });
  }

  // =====================================================================
  // 1. METHOD TRANSFER
  // =====================================================================
  const gradRows = [[0, 5], [10, 95], [12, 95], [12.1, 5], [17, 5]];

  function renderGradInputs() {
    const tb = $("t_grad").querySelector("tbody");
    tb.innerHTML = gradRows.map((r, i) => `
      <tr>
        <td><input type="number" step="any" data-i="${i}" data-c="0" value="${r[0]}" aria-label="Original time step ${i + 1}"></td>
        <td><input type="number" step="any" data-i="${i}" data-c="1" value="${r[1]}" aria-label="%B step ${i + 1}"></td>
        <td><button type="button" data-del="${i}" aria-label="Remove step ${i + 1}">×</button></td>
      </tr>`).join("");
    tb.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", (e) => {
      const i = +e.target.dataset.i, c = +e.target.dataset.c;
      gradRows[i][c] = e.target.value === "" ? NaN : parseFloat(e.target.value);
      calcTransfer();
    }));
    tb.querySelectorAll("button[data-del]").forEach((b) => b.addEventListener("click", () => {
      gradRows.splice(+b.dataset.del, 1);
      renderGradInputs(); calcTransfer();
    }));
  }
  $("t_addrow").addEventListener("click", () => {
    const last = gradRows[gradRows.length - 1] || [0, 5];
    gradRows.push([(Number.isFinite(last[0]) ? last[0] : 0) + 1, last[1]]);
    renderGradInputs(); calcTransfer();
  });

  function calcTransfer() {
    const L1 = num("t_L1"), d1 = num("t_d1"), p1 = num("t_p1"), F1 = num("t_F1"), V1 = num("t_V1"), D1 = num("t_D1"), P1 = num("t_P1");
    const L2 = num("t_L2"), d2 = num("t_d2"), p2 = num("t_p2"), D2 = num("t_D2");
    const extra = Number.isFinite(num("t_extra")) ? num("t_extra") : 0;
    const useDp = $("t_dpflow").checked;
    const out = $("t_out"), gout = $("t_gout").querySelector("tbody"), dn = $("t_dwell");

    if (!pos(L1, d1, p1, F1, L2, d2, p2)) {
      out.innerHTML = stat("Enter column dimensions and flow", "—");
      gout.innerHTML = ""; dn.innerHTML = "";
      return;
    }
    const volRatio = (L2 * d2 * d2) / (L1 * d1 * d1);
    const F2 = F1 * (d2 * d2) / (d1 * d1) * (useDp ? p1 / p2 : 1) * (1 + extra / 100);
    const V2 = Number.isFinite(V1) ? V1 * volRatio : NaN;
    const tf = (F1 / F2) * volRatio;
    const lp1 = (L1 * 1000) / p1, lp2 = (L2 * 1000) / p2;
    const lpChange = lp2 / lp1 - 1;
    const lpOK = lpChange >= -0.25 - 1e-9 && lpChange <= 0.5 + 1e-9;
    const pRatio = (F2 / F1) * (L2 / L1) * Math.pow(d1 / d2, 2) * Math.pow(p1 / p2, 2);
    const uRatio = (F2 / (d2 * d2)) / (F1 / (d1 * d1));

    let html = "";
    html += stat("New flow rate", fmt(F2) + " mL/min", `linear velocity ×${fmt(uRatio)}`, "key");
    html += stat("New injection volume", Number.isFinite(V2) ? fmt(V2) + " µL" : "—", "same load per column volume", "key");
    html += stat("Time scaling factor", "×" + fmt(tf), "applies to gradient steps and run time");
    html += stat("L/d<sub>p</sub>", `${fmt(lp1, 4)} → ${fmt(lp2, 4)}`,
      `${lpChange >= 0 ? "+" : ""}${fix(lpChange * 100, 1)}% · USP window −25% to +50% · ${lpOK ? "within" : "outside"}`,
      lpOK ? "pass" : "fail");
    html += stat("Pressure ratio P<sub>2</sub>/P<sub>1</sub>", "×" + fmt(pRatio), "same mobile phase & temperature");
    if (pos(P1)) html += stat("Estimated new pressure", fmt(P1 * pRatio) + " bar", fmt(P1 * pRatio * 14.5038, 3) + " psi");
    html += stat("Column volume ratio", "×" + fmt(volRatio));
    out.innerHTML = html;

    // dwell
    let hold = 0, delay = 0, dwellMsg = "";
    if (ok(D1, D2) && D1 >= 0 && D2 >= 0) {
      const target = D1 * volRatio;
      const diff = target - D2;
      if (Math.abs(diff) < 1e-4) {
        dwellMsg = `The new system's dwell volume already matches the scaled original (${fmt(target)} mL). No compensation needed.`;
      } else if (diff > 0) {
        hold = diff / F2;
        dwellMsg = `Scaled original dwell volume = <b>${fmt(target)} mL</b>; new system = ${fmt(D2)} mL. ` +
          `To reproduce the original gradient delay, add an initial isocratic hold of <b>${fmt(hold)} min</b> (${fmt(diff)} mL at ${fmt(F2)} mL/min).`;
      } else {
        delay = -diff / F2;
        dwellMsg = `Scaled original dwell volume = <b>${fmt(target)} mL</b>; new system = ${fmt(D2)} mL, which is larger. ` +
          `To match, delay injection by <b>${fmt(delay)} min</b> after the gradient starts (if your system supports it), or reduce the dwell volume. ` +
          `Otherwise early-eluting peaks will shift later.`;
      }
    }
    dn.innerHTML = dwellMsg;

    // gradient output
    const includeHold = $("t_hold").checked && hold > 0;
    const rows = gradRows
      .filter((r) => ok(r[0], r[1]))
      .slice()
      .sort((a, b) => a[0] - b[0]);
    const outRows = [];
    rows.forEach((r, i) => {
      let t = r[0] * tf;
      if (includeHold) {
        if (i === 0 && r[0] === 0) {
          outRows.push([0, r[1]]);
          outRows.push([hold, r[1]]);
          return;
        }
        t += hold;
      }
      outRows.push([t, r[1]]);
    });
    gout.innerHTML = outRows.map((r) =>
      `<tr><td class="out">${fix(r[0], 2)}</td><td class="out">${fmt(r[1], 3)}</td><td class="out">${fix(F2, 3)}</td></tr>`
    ).join("");
  }

  bindAll(["t_L1", "t_d1", "t_p1", "t_F1", "t_V1", "t_D1", "t_P1", "t_L2", "t_d2", "t_p2", "t_D2", "t_dpflow", "t_extra", "t_hold"], calcTransfer);

  // =====================================================================
  // 2. SYSTEM SUITABILITY
  // =====================================================================
  function calcSST() {
    const t0 = num("s_t0"), tr1 = num("s_tr1"), tr2 = num("s_tr2"), w1 = num("s_w1"), w2 = num("s_w2");
    const half = $("s_basis").value === "half";
    let html = "";
    const k1 = pos(t0) && ok(tr1) ? (tr1 - t0) / t0 : NaN;
    const k2 = pos(t0) && ok(tr2) ? (tr2 - t0) / t0 : NaN;
    const alpha = k1 > 0 && k2 > 0 ? Math.max(k1, k2) / Math.min(k1, k2) : NaN;
    const c = half ? 5.54 : 16;
    const N1 = pos(tr1, w1) ? c * Math.pow(tr1 / w1, 2) : NaN;
    const N2 = pos(tr2, w2) ? c * Math.pow(tr2 / w2, 2) : NaN;
    const Rs = pos(w1, w2) && ok(tr1, tr2) ? (half ? 1.18 : 2) * Math.abs(tr2 - tr1) / (w1 + w2) : NaN;

    html += stat("k (peak 1)", fmt(k1));
    html += stat("k (peak 2)", fmt(k2));
    html += stat("Selectivity α", fmt(alpha, 4));
    html += stat("Plates N (peak 1)", Number.isFinite(N1) ? Math.round(N1).toLocaleString() : "—");
    html += stat("Plates N (peak 2)", Number.isFinite(N2) ? Math.round(N2).toLocaleString() : "—");
    const rsCls = Number.isFinite(Rs) ? (Rs >= 1.5 ? "pass" : "fail") : "";
    html += stat("Resolution R<sub>s</sub>", fix(Rs, 2), Number.isFinite(Rs) ? (Rs >= 1.5 ? "≥ 1.5: baseline resolved" : "< 1.5: not baseline resolved") : "", rsCls);
    $("s_out").innerHTML = html;

    const W = num("s_w005"), f = num("s_f");
    if (pos(W, f)) {
      const T = W / (2 * f);
      $("s_tail").innerHTML = stat("Tailing factor T", fix(T, 2),
        T <= 2 ? "≤ 2.0 (a common SST limit; check your monograph)" : "> 2.0 — exceeds the common limit", T <= 2 ? "pass" : "fail");
    } else {
      $("s_tail").innerHTML = stat("Tailing factor T", "—");
    }
  }
  bindAll(["s_t0", "s_basis", "s_tr1", "s_tr2", "s_w1", "s_w2", "s_w005", "s_f"], calcSST);

  const purnell = (N, a, k) => (Math.sqrt(N) / 4) * ((a - 1) / a) * (k / (1 + k));

  function calcPurnell() {
    const N = num("p_N"), a = num("p_a"), k = num("p_k"), target = num("p_rs");
    let html = "";
    if (pos(N, k) && a > 1) {
      const Rs = purnell(N, a, k);
      html += stat("Predicted R<sub>s</sub>", fix(Rs, 2), "", "key");
      if (pos(target)) {
        const Nreq = 16 * target * target * Math.pow(a / (a - 1), 2) * Math.pow((1 + k) / k, 2);
        html += stat("Plates needed for target", Math.round(Nreq).toLocaleString(), `×${fmt(Nreq / N)} current N · column length ×${fmt(Nreq / N)} at same d<sub>p</sub>`);
        // alpha needed at current N, k: Rs = sqrt(N)/4 * (1-1/a) * k/(1+k)
        const q = (4 * target) / (Math.sqrt(N) * (k / (1 + k)));
        html += stat("α needed at current N, k", q < 1 ? fmt(1 / (1 - q), 4) : "not reachable", q < 1 ? "" : "target too high for this N and k");
      }
      html += stat("Selectivity term (α−1)/α", fmt((a - 1) / a));
      html += stat("Retention term k/(1+k)", fmt(k / (1 + k)));
    } else {
      html += stat("Enter N > 0, α > 1, k > 0", "—");
    }
    $("p_out").innerHTML = html;
    drawPurnell();
  }

  function drawPurnell() {
    const canvas = $("p_chart");
    if ($("sst").hidden) return;
    const N = num("p_N"), a = num("p_a"), k = num("p_k"), target = num("p_rs");
    if (!(pos(N, k) && a > 1)) { canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height); return; }
    const aMax = Math.max(1.3, Math.ceil((a + 0.1) * 10) / 10);
    const curves = [N / 2, N, N * 2];
    const colors = [cssVar("--muted"), cssVar("--accent"), "#c4793b"];
    const series = curves.map((n, i) => {
      const pts = [];
      for (let x = 1; x <= aMax + 1e-9; x += (aMax - 1) / 120) pts.push([x, purnell(n, x, k)]);
      return { name: `N = ${Math.round(n).toLocaleString()}`, color: colors[i], pts, dash: i === 1 ? [] : [5, 4] };
    });
    const yMax = Math.max(3, Math.ceil(Math.max(...series.map((s) => s.pts[s.pts.length - 1][1]), target || 0) + 0.5));
    const xt = [];
    const step = aMax - 1 > 0.5 ? 0.1 : 0.05;
    for (let x = 1; x <= aMax + 1e-9; x += step) xt.push(Math.round(x * 100) / 100);
    const yt = [];
    const ys = yMax > 8 ? 2 : 1;
    for (let y = 0; y <= yMax; y += ys) yt.push(y);
    lineChart(canvas, {
      xRange: [1, aMax], yRange: [0, yMax], xTicks: xt, yTicks: yt,
      xFmt: (v) => v.toFixed(2), xLabel: `Selectivity α  (k = ${fmt(k)})`, yLabel: "Rs",
      series, hLines: pos(target) ? [{ y: target, label: `target Rs ${target}` }] : [{ y: 1.5, label: "Rs 1.5" }],
      marker: { x: a, y: purnell(N, a, k), color: cssVar("--accent") },
    });
  }
  bindAll(["p_N", "p_a", "p_k", "p_rs"], calcPurnell);

  // =====================================================================
  // 3. BUFFER
  // =====================================================================
  // liquid: mol per mL of the commercial reagent
  const BUFFERS = [
    { id: "phos1", name: "Phosphate, pKa₁ 2.15 — H₃PO₄ (85%) / KH₂PO₄", pKa: 2.15,
      acid: { name: "Phosphoric acid, 85% w/w", mw: 97.995, liquid: (1.685 * 0.85) / 97.995, liqNote: "85% w/w, d 1.685 g/mL ≈ 14.6 M" },
      base: { name: "Potassium dihydrogen phosphate (KH₂PO₄)", mw: 136.09 } },
    { id: "phos2k", name: "Phosphate, pKa₂ 7.20 — KH₂PO₄ / K₂HPO₄", pKa: 7.20,
      acid: { name: "Potassium dihydrogen phosphate (KH₂PO₄)", mw: 136.09 },
      base: { name: "Dipotassium hydrogen phosphate (K₂HPO₄)", mw: 174.18 } },
    { id: "phos2na", name: "Phosphate, pKa₂ 7.20 — NaH₂PO₄ / Na₂HPO₄ (anhydrous)", pKa: 7.20,
      acid: { name: "Sodium dihydrogen phosphate, anhydrous", mw: 119.98 },
      base: { name: "Disodium hydrogen phosphate, anhydrous", mw: 141.96 } },
    { id: "formate", name: "Formate, pKa 3.75 — formic acid / ammonium formate", pKa: 3.75, ms: true,
      acid: { name: "Formic acid, ≥98%", mw: 46.03, liquid: (1.22 * 0.98) / 46.03, liqNote: "≈98%, d 1.22 g/mL ≈ 26 M" },
      base: { name: "Ammonium formate", mw: 63.06 } },
    { id: "acetNa", name: "Acetate, pKa 4.76 — acetic acid / sodium acetate", pKa: 4.76,
      acid: { name: "Acetic acid, glacial", mw: 60.05, liquid: 1.049 / 60.05, liqNote: "glacial, d 1.049 g/mL ≈ 17.5 M" },
      base: { name: "Sodium acetate, anhydrous", mw: 82.03 } },
    { id: "acetNH4", name: "Acetate, pKa 4.76 — acetic acid / ammonium acetate", pKa: 4.76, ms: true,
      acid: { name: "Acetic acid, glacial", mw: 60.05, liquid: 1.049 / 60.05, liqNote: "glacial, d 1.049 g/mL ≈ 17.5 M" },
      base: { name: "Ammonium acetate", mw: 77.08 } },
    { id: "tris", name: "Tris, pKa 8.07 (25 °C) — Tris·HCl / Tris base", pKa: 8.07,
      acid: { name: "Tris hydrochloride", mw: 157.60 },
      base: { name: "Tris base", mw: 121.14 },
      note: "Tris pKa falls by about 0.028 per °C; set pH at the temperature of use." },
    { id: "ammonia", name: "Ammonium, pKa 9.25 — ammonium acetate / ammonia (25%)", pKa: 9.25, ms: true,
      acid: { name: "Ammonium acetate (NH₄⁺ source)", mw: 77.08 },
      base: { name: "Ammonia solution, 25% w/w", mw: 17.03, liquid: (0.91 * 0.25) / 17.03, liqNote: "25% w/w, d 0.91 g/mL ≈ 13.4 M" },
      note: "Concentration here is total ammonia (NH₄⁺ + NH₃); acetate is present as counter-ion. Ammonia is volatile — prepare fresh." },
  ];

  (function initBuffer() {
    $("b_sys").innerHTML = BUFFERS.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("");
    $("b_table").innerHTML = `<table><thead><tr><th>System</th><th>pKa</th><th>Acid form</th><th>Base form</th><th>MS-compatible</th></tr></thead><tbody>` +
      BUFFERS.map((b) => `<tr><td>${esc(b.name.split(" — ")[0])}</td><td>${b.pKa}</td>` +
        `<td>${esc(b.acid.name)}, ${b.acid.mw} g/mol${b.acid.liqNote ? " (" + esc(b.acid.liqNote) + ")" : ""}</td>` +
        `<td>${esc(b.base.name)}, ${b.base.mw} g/mol${b.base.liqNote ? " (" + esc(b.base.liqNote) + ")" : ""}</td>` +
        `<td>${b.ms ? "Yes (volatile)" : "No"}</td></tr>`).join("") +
      `</tbody></table><p>pKa values are thermodynamic values at 25 °C. Effective pKa shifts with ionic strength and organic content.</p>`;
  })();

  function amountText(comp, mol) {
    if (comp.liquid) {
      const mL = mol / comp.liquid;
      return { main: mL >= 1 ? fmt(mL, 3) + " mL" : fmt(mL * 1000, 3) + " µL", sub: `${fmt(mol * 1000, 3)} mmol · ${comp.liqNote}` };
    }
    const g = mol * comp.mw;
    return { main: g >= 1 ? fmt(g, 4) + " g" : fmt(g * 1000, 3) + " mg", sub: `${fmt(mol * 1000, 3)} mmol · MW ${comp.mw}` };
  }

  function calcBuffer() {
    const b = BUFFERS.find((x) => x.id === $("b_sys").value);
    const pH = num("b_pH"), c = num("b_c"), v = num("b_v");
    if (!b || !ok(pH) || !pos(c, v)) { $("b_out").innerHTML = stat("Enter pH, concentration and volume", "—"); return; }
    const ratio = Math.pow(10, pH - b.pKa); // [base]/[acid]
    const totalMol = (c / 1000) * (v / 1000);
    const baseMol = totalMol * ratio / (1 + ratio);
    const acidMol = totalMol - baseMol;
    const a = amountText(b.acid, acidMol), ba = amountText(b.base, baseMol);
    const dist = Math.abs(pH - b.pKa);
    let html = "";
    html += stat(esc(b.acid.name), a.main, a.sub, "key");
    html += stat(esc(b.base.name), ba.main, ba.sub, "key");
    html += stat("Base : acid ratio", fmt(ratio, 3), `fraction as base form ${fix(100 * ratio / (1 + ratio), 1)}%`);
    html += stat("Distance from pKa", fix(dist, 2) + " pH units",
      dist <= 1 ? "within ±1 — good buffering capacity" : "outside pKa ± 1 — weak buffering; choose another buffer",
      dist <= 1 ? "pass" : "fail");
    if (b.note) html += stat("Note", "", esc(b.note));
    $("b_out").innerHTML = html;
  }
  bindAll(["b_sys", "b_pH", "b_c", "b_v"], calcBuffer);

  // =====================================================================
  // 4. PRESSURE & VISCOSITY
  // =====================================================================
  // ln(eta/cP) = phi*(a1 + b1/T) + (1-phi)*(a2 + b2/T) + phi*(1-phi)*(a3 + b3/T)
  // phi = organic volume fraction, T in K. Empirical binary-mixture fit.
  const VISC = {
    acn: { name: "Acetonitrile", a: [-3.476, 726], w: [-5.414, 1566], x: [-1.762, 929] },
    meoh: { name: "Methanol", a: [-4.597, 1211], w: [-5.961, 1736], x: [-6.215, 2809] },
  };
  function viscosity(org, pct, tC) {
    const p = VISC[org], phi = Math.min(Math.max(pct / 100, 0), 1), T = tC + 273.15;
    return Math.exp(phi * (p.a[0] + p.a[1] / T) + (1 - phi) * (p.w[0] + p.w[1] / T) + phi * (1 - phi) * (p.x[0] + p.x[1] / T));
  }
  function pressureBar(phiR, etaCP, Lmm, dcmm, dpum, FmLmin) {
    const eta = etaCP * 1e-3, L = Lmm * 1e-3, dp = dpum * 1e-6, r = dcmm * 1e-3 / 2;
    const u = (FmLmin * 1e-6 / 60) / (Math.PI * r * r);
    return (phiR * eta * L * u) / (dp * dp) / 1e5;
  }

  function calcPressure() {
    const org = $("v_org").value, pct = num("v_pct"), T = num("v_T"), etaO = num("v_eta");
    const L = num("v_L"), d = num("v_d"), dp = num("v_dp"), F = num("v_F"), phi = num("v_phi");
    let html = "";
    const etaCalc = ok(pct, T) ? viscosity(org, pct, T) : NaN;
    const eta = pos(etaO) ? etaO : etaCalc;
    html += stat("Viscosity η", fix(eta, 3) + " cP", pos(etaO) ? "user override" : `${VISC[org].name} ${fmt(pct)}% at ${fmt(T)} °C`);
    if (pos(eta, L, d, dp, F, phi)) {
      const P = pressureBar(phi, eta, L, d, dp, F);
      html += stat("Estimated column ΔP", fmt(P, 3) + " bar", `${fmt(P * 14.5038, 3)} psi · ${fmt(P / 10, 3)} MPa`, "key");
      // pressure maximum across a 5-95% gradient
      let pmax = 0, atPct = 0;
      for (let x = 5; x <= 95; x += 1) {
        const pp = pressureBar(phi, viscosity(org, x, T), L, d, dp, F);
        if (pp > pmax) { pmax = pp; atPct = x; }
      }
      html += stat("Peak ΔP over a 5–95% gradient", fmt(pmax, 3) + " bar", `at ≈${atPct}% ${VISC[org].name.toLowerCase()}`);
      const u = (F / 60) / (Math.PI * Math.pow(d / 20, 2)) * 10; // mm/s superficial
      html += stat("Superficial velocity", fmt(u, 3) + " mm/s", `interstitial ≈ ${fmt(u / 0.4, 3)} mm/s`);
    }
    $("v_out").innerHTML = html;
    drawVisc();
  }

  function drawVisc() {
    if ($("pressure").hidden) return;
    const T = num("v_T"), pct = num("v_pct"), org = $("v_org").value;
    if (!ok(T)) return;
    const mk = (o) => { const pts = []; for (let x = 0; x <= 100; x += 1) pts.push([x, viscosity(o, x, T)]); return pts; };
    const acn = mk("acn"), meoh = mk("meoh");
    const yMax = Math.max(1.0, Math.ceil(Math.max(...meoh.map((p) => p[1]), ...acn.map((p) => p[1])) * 5) / 5 + 0.2);
    const yt = []; for (let y = 0; y <= yMax + 1e-9; y += 0.2) yt.push(Math.round(y * 10) / 10);
    lineChart($("v_chart"), {
      xRange: [0, 100], yRange: [0, yMax], xTicks: [0, 20, 40, 60, 80, 100], yTicks: yt,
      yFmt: (v) => v.toFixed(1), xLabel: `Organic content (% v/v) at ${fmt(T)} °C`, yLabel: "η (cP)",
      series: [
        { name: "Water–methanol", color: "#c4793b", pts: meoh },
        { name: "Water–acetonitrile", color: cssVar("--accent"), pts: acn },
      ],
      marker: ok(pct) ? { x: Math.min(Math.max(pct, 0), 100), y: viscosity(org, pct, T), color: org === "acn" ? cssVar("--accent") : "#c4793b" } : null,
    });
  }
  bindAll(["v_org", "v_pct", "v_T", "v_eta", "v_L", "v_d", "v_dp", "v_F", "v_phi"], calcPressure);

  // =====================================================================
  // 5. COLUMN & SOLVENT
  // =====================================================================
  $("c_type").addEventListener("change", () => {
    const custom = $("c_type").value === "custom";
    $("c_epsw").hidden = !custom;
    if (!custom) $("c_eps").value = $("c_type").value;
    calcColumn();
  });
  function calcColumn() {
    const L = num("c_L"), d = num("c_d"), eps = num("c_eps"), F = num("c_F"), D = num("c_D"), cv = num("c_cv");
    const rt = num("c_rt"), n = num("c_n"), b = num("c_b"), ex = num("c_extra");
    let html = "";
    if (pos(L, d, eps)) {
      const Vempty = Math.PI * Math.pow(d / 2, 2) * L / 1000; // mL
      const Vm = eps * Vempty;
      html += stat("Column void volume V<sub>m</sub>", fmt(Vm * 1000, 3) + " µL", `empty column ${fmt(Vempty, 3)} mL`, "key");
      if (pos(F)) {
        const t0 = Vm / F;
        html += stat("Dead time t<sub>0</sub>", fmt(t0, 3) + " min", fmt(t0 * 60, 3) + " s", "key");
        html += stat("Linear velocity u", fmt(L / (t0 * 60), 3) + " mm/s");
        if (ok(D) && D >= 0) html += stat("Dwell time t<sub>D</sub>", fmt(D / F, 3) + " min", `gradient reaches the column ${fmt(D / F * 60, 3)} s after it starts`);
        if (pos(cv)) {
          const eqV = cv * Vm + (ok(D) && D > 0 ? D : 0);
          html += stat("Re-equilibration", fmt(eqV / F, 3) + " min", `${fmt(cv)} column volumes + dwell = ${fmt(eqV, 3)} mL`);
        }
      }
    }
    if (pos(F, rt, n)) {
      const total = F * rt * n * (1 + (pos(ex) ? ex : 0) / 100);
      const fb = ok(b) ? Math.min(Math.max(b, 0), 100) / 100 : 0.5;
      html += stat("Total mobile phase", total >= 1000 ? fmt(total / 1000, 3) + " L" : fmt(total, 3) + " mL", `${fmt(F * rt, 3)} mL per injection`, "key");
      html += stat("Channel A", fmt(total * (1 - fb), 3) + " mL");
      html += stat("Channel B", fmt(total * fb, 3) + " mL");
      html += stat("Sequence time", fmt(rt * n / 60, 3) + " h");
    }
    $("c_out").innerHTML = html || stat("Enter column dimensions", "—");
  }
  bindAll(["c_L", "c_d", "c_eps", "c_F", "c_D", "c_cv", "c_rt", "c_n", "c_b", "c_extra"], calcColumn);

  // =====================================================================
  // 6. UNITS
  // =====================================================================
  const PRESS = { bar: 1, psi: 14.503774, mpa: 0.1, kpa: 100, atm: 0.98692327, kgf: 1.0197162 }; // per bar
  const pressInputs = document.querySelectorAll("#u_press input");
  function convPress(src) {
    const v = parseFloat(src.value);
    if (!Number.isFinite(v)) return;
    const bar = v / PRESS[src.dataset.u];
    pressInputs.forEach((inp) => { if (inp !== src) inp.value = +(bar * PRESS[inp.dataset.u]).toPrecision(6); });
  }
  pressInputs.forEach((inp) => inp.addEventListener("input", () => convPress(inp)));

  function calcConc() {
    const mw = num("u_mw"), v = num("u_cv"), u = $("u_cu").value;
    if (!pos(mw) || !ok(v)) { $("u_conc").innerHTML = ""; return; }
    const toMgPerMl = { mgml: 1, ugml: 1e-3, ngml: 1e-6 };
    let mgml, molar;
    if (u in toMgPerMl) { mgml = v * toMgPerMl[u]; molar = mgml / mw; }
    else { molar = v * { m: 1, mm: 1e-3, um: 1e-6 }[u]; mgml = molar * mw; }
    $("u_conc").innerHTML =
      stat("mg/mL", fmt(mgml, 4)) + stat("µg/mL (ppm)", fmt(mgml * 1e3, 4)) + stat("ng/mL (ppb)", fmt(mgml * 1e6, 4)) +
      stat("mM", fmt(molar * 1e3, 4)) + stat("µM", fmt(molar * 1e6, 4)) + stat("nM", fmt(molar * 1e9, 4));
  }
  bindAll(["u_mw", "u_cv", "u_cu"], calcConc);

  function calcVel() {
    const d = num("u_d"), eps = num("u_eps"), F = num("u_F");
    if (!pos(d, eps, F)) { $("u_vel").innerHTML = ""; return; }
    const area = Math.PI * Math.pow(d / 2, 2); // mm²
    const u = (F * 1000 / 60) / (eps * area); // mm/s
    $("u_vel").innerHTML = stat("Linear velocity", fmt(u, 3) + " mm/s", fmt(u / 10 * 60, 3) + " cm/min", "key") +
      stat("Flow for 1 mm/s", fmt(eps * area * 60 / 1000, 3) + " mL/min");
  }
  bindAll(["u_d", "u_eps", "u_F"], calcVel);

  // ---------- init ----------
  function redrawCharts() { drawPurnell(); drawVisc(); }
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(redrawCharts, 120); });
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", redrawCharts);

  renderGradInputs();
  calcTransfer(); calcSST(); calcPurnell(); calcBuffer(); calcPressure(); calcColumn(); calcConc(); calcVel();
  convPress(document.querySelector('#u_press input[data-u="bar"]'));
  showTab((location.hash || "#transfer").slice(1), false);
})();

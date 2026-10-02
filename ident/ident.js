// Scorpion Bits ident — the picture.
// Every frame is a pure function of time t. One idea, continuously: a point → a bit → a lattice of bits →
// a blockout of the mark → the mark itself (refined by a wave from the first point) → a pulse through the
// five tail bits → the lockup. The official mark (brand/logo-mark.png) is never redrawn: it is revealed
// pixel by pixel from its own image, lit, and moved — only ever with its proportions intact.
(function () {
'use strict';
const { T, nodes, edgesA, edgesB, cubes, cube0, camera, waveT, REVEAL, ease, prog, clamp, lerp, hash } = TL;
const W = 1920, H = 1080, CX = W / 2, CY = H / 2, TAU = Math.PI * 2;
const MW = GEO.mark[0], MH = GEO.mark[1];
const HR = 440;                 // the mark's height at the reveal
const K = HR / MH;              // mark px → screen px at zoom 1
const U = GEO.U;
const P = {
  ink: '#05090f', deep: '#0b1d30', navy: '#0c2430',
  cyan: '#6ad8fe', sky: '#51a8f6', ice: '#d6f4ff', line: '#86d4f2',
  top: '#5d8ff7', left: '#57c9f7', right: '#16405f',
  text: '#eef5fb',
};
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgba = (h, a) => { const [r, g, b] = hexRGB(h); return `rgba(${r},${g},${b},${clamp(a)})`; };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const spring = (t, f = 14, d = 9) => (t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(f * t));

// ─── images & derived data
const IMG = {};
const load = (k, src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = rej; i.src = src; });

let markPx, Tw, region, alphaIdx;        // per-pixel data of the mark
let revealC, revealX, revealD, glowC, glowX, glowD;
let regionC = [];                        // white silhouettes of tail bits 1..5 and the stinger
let sweepC, sweepX;
let parts = [];                          // the fill particles
let ghost = [];                          // the unlit lattice the system grows into
let LOCK;                                // lockup layout

function init() {
  // the mark's pixels
  const mc = mk(MW, MH), mx = mc.getContext('2d', { willReadFrequently: true });
  mx.drawImage(IMG.mark, 0, 0);
  markPx = mx.getImageData(0, 0, MW, MH).data;
  // wave distance + region per pixel (data.png from geometry.py)
  const dc = mk(MW, MH), dx = dc.getContext('2d', { willReadFrequently: true });
  dx.drawImage(IMG.data, 0, 0);
  const dd = dx.getImageData(0, 0, MW, MH).data;
  Tw = new Float32Array(MW * MH); region = new Uint8Array(MW * MH);
  const idx = [];
  for (let i = 0; i < MW * MH; i++) {
    region[i] = dd[i * 4 + 2];
    if (markPx[i * 4 + 3] > 0) {
      const g = ((dd[i * 4] << 8) | dd[i * 4 + 1]) / 65535 * GEO.gmax;
      Tw[i] = waveT(g); idx.push(i);
    }
  }
  alphaIdx = Int32Array.from(idx);
  // the wave advances cell by cell: each pixel takes (mostly) the time of the lattice bit it lies in, so every
  // bit of the blockout flips into its own piece of the mark
  const c30 = Math.cos(Math.PI / 6), cellT = new Map();
  const ij = (x, y) => { const a = (x - GEO.O[0]) / (U * c30), b = -2 * (y - GEO.O[1]) / U; return [(a + b) / 2, (b - a) / 2]; };
  for (const c of GEO.cubes) { const n = GEO.nodes[c[0]], [i, j] = ij(n[0], n[1]); cellT.set(`${Math.round(i)},${Math.round(j)}`, waveT(c[7])); }
  for (const i of idx) {
    const x = i % MW, y = (i / MW) | 0, [a, b] = ij(x, y);
    let best = null, bd = Infinity;
    for (let di = -1; di <= 2; di++) for (let dj = -1; dj <= 2; dj++) {
      const ci = Math.floor(a) + di, cj = Math.floor(b) + dj;
      if ((((ci + cj) % 3) + 3) % 3) continue;
      const px = GEO.O[0] + (ci - cj) * c30 * U, py = GEO.O[1] - (ci + cj) * 0.5 * U, d = (px - x) ** 2 + (py - y) ** 2;
      if (d < bd) { bd = d; best = `${ci},${cj}`; }
    }
    const tc = cellT.get(best);
    if (tc !== undefined && Math.abs(tc - Tw[i]) < 0.14) Tw[i] = tc + 0.3 * (Tw[i] - tc);
  }
  revealC = mk(MW, MH); revealX = revealC.getContext('2d'); revealD = revealX.createImageData(MW, MH);
  glowC = mk(MW, MH); glowX = glowC.getContext('2d'); glowD = glowX.createImageData(MW, MH);
  const gc = hexRGB(P.ice);
  for (let i = 0; i < MW * MH; i++) { glowD.data[i * 4] = gc[0]; glowD.data[i * 4 + 1] = gc[1]; glowD.data[i * 4 + 2] = gc[2]; }
  // tail regions (labels 2..7)
  for (let k = 0; k < 6; k++) {
    const c = mk(MW, MH), x = c.getContext('2d'), id = x.createImageData(MW, MH);
    for (let i = 0; i < MW * MH; i++) {
      if (region[i] === 2 + k) { id.data[i * 4] = 255; id.data[i * 4 + 1] = 255; id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = markPx[i * 4 + 3]; }
    }
    x.putImageData(id, 0, 0); regionC.push(c);
  }
  sweepC = mk(MW, MH); sweepX = sweepC.getContext('2d');

  // fill particles: sampled from the mark's own pixels, each arriving the moment its pixel becomes final
  const step = 4.3;
  for (let y = 1; y < MH; y += step) for (let x = 1; x < MW; x += step) {
    const px = Math.round(x + (hash(x * 3.1 + y * 7.7) - 0.5) * 2), py = Math.round(y + (hash(x * 5.3 + y * 1.9) - 0.5) * 2);
    if (px < 1 || py < 1 || px >= MW - 1 || py >= MH - 1) continue;
    const i = py * MW + px;
    if (markPx[i * 4 + 3] < 200) continue;
    // direction of the wave here (gradient of the wave time), and its perpendicular
    let gx = Tw[i + 1] - Tw[i - 1], gy = Tw[i + MW] - Tw[i - MW];
    const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
    const r = hash(i * 0.731), len = 8 + 22 * r * r;
    const sw = 0.5;                        // a little swirl, one direction everywhere: a magnetic field
    parts.push({
      x: px, y: py, tw: Tw[i] + 0.004 * (hash(i) - 0.5),
      ox: (gx * 0.8 - gy * sw) * len, oy: (gy * 0.8 + gx * sw) * len,
      lead: 0.2 + 0.14 * hash(i * 1.37),
      c: [markPx[i * 4], markPx[i * 4 + 1], markPx[i * 4 + 2]],
      s: 0.8 + 0.6 * hash(i * 2.9),
    });
  }
  // the unlit lattice: every lattice point within a wide hexagon around the first point
  for (let i = -46; i <= 46; i++) for (let j = -46; j <= 46; j++) {
    const x = GEO.O[0] + (i - j) * c30 * U, y = GEO.O[1] - (i + j) * 0.5 * U;
    const d = Math.hypot(x - GEO.O[0], y - GEO.O[1]);
    if (d < 46 * U * 0.8) ghost.push({ x, y, d, r: hash(i * 13.1 + j * 7.7) });
  }

  // lockup — the site header's proportions (mark height 31 : font 16, mark→name gap 10 : 16, Grotesk 700,
  // -0.03em, "Bits" in cyan), the name typeset as one phrase with a word space, as on the site's cover image
  const t = mk(10, 10).getContext('2d');
  const meas = (s, f) => { t.font = `700 ${f}px SG`; t.letterSpacing = `${-0.03 * f}px`; return t.measureText(s); };
  const markW = h => h * MW / MH;
  const unit = meas('Scorpion Bits', 100).width / 100 + 0.625 + markW(31 / 16);   // total width per px of font size
  const F = Math.round(1130 / unit);
  const hl = F * 31 / 16, ml = markW(hl), gap = 0.625 * F;
  const total = ml + gap + meas('Scorpion Bits', F).width;
  const x0 = CX - total / 2, m = meas('Scorpion', F);
  LOCK = {
    F, hl, ml, gap, wS: m.width, xB: meas('Scorpion ', F).width,
    mx: x0 + ml / 2, my: CY,
    tx: x0 + ml + gap,
    base: CY + (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2,
  };
}

// ─── the lockup move: after the impact the whole world (already at mark framing) scales/moves into place
function lockMove(t) {
  const p = ease.inOutQuint(prog(t, T.lock0, T.lock1));
  // a hair of overshoot as it settles
  const o = t > T.lock1 ? Math.exp(-(t - T.lock1) * 9) * Math.sin((t - T.lock1) * 20) * 0.006 : 0;
  const cam = camera(T.dum);
  const s1 = LOCK.hl / (HR * cam.zoom);
  return { s: lerp(1, s1, p) * (1 - o * 0.4), x: lerp(CX, LOCK.mx, p) - o * 60, y: lerp(CY, LOCK.my, p) };
}

// projection of mark-space points (x, y, z) through the camera, then the lockup move
function makeProj(t) {
  const cam = camera(t);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const D = 3000 / cam.zoom;     // a dolly: close means stronger perspective, far means flat
  const L = t >= T.lock0 ? lockMove(t) : { s: 1, x: CX, y: CY };
  const f = (x, y, z = 0) => {
    const X = (x - cam.fx) * K, Y = (y - cam.fy) * K, Z = z * K;
    const X1 = X * cy + Z * sy, Z1 = -X * sy + Z * cy;
    const Y2 = Y * cp - Z1 * sp, Z2 = Y * sp + Z1 * cp;
    const s = D / Math.max(D * 0.15, D + Z2);
    return [L.x + X1 * s * cam.zoom * L.s, L.y + Y2 * s * cam.zoom * L.s, s * cam.zoom * L.s];
  };
  f.cam = cam; f.L = L;
  // the flat affine of the mark plane (valid once the plane faces us)
  f.flat = () => { const [x, y] = f(0, 0), [x1] = f(1, 0); return { x, y, s: x1 - x }; };
  return f;
}

// node position at time t (in mark space, plus depth)
function nodePos(n, t, cam) {
  const zj = n.z * 5 * cam.depth * clamp(n.hop / 5);
  if (t < n.born) return null;
  let x = n.x, y = n.y;
  // grows out of its parent along the lattice edge
  if (n.parent >= 0) {
    const p = nodes[n.parent], q = ease.outCubic(prog(t, n.born, n.born + 0.16));
    const back = 1 + 0.12 * Math.sin(Math.PI * q) * (1 - q);  // a hint of overshoot
    x = lerp(p.x, n.x, q * back); y = lerp(p.y, n.y, q * back);
  }
  // the morph: a magnetic, curved path onto the mark's line art, a small snap at the end
  if (t > n.depart) {
    const m = prog(t, n.depart, n.arrive);
    const e = m < 1 ? ease.inOutCubic(m) : 1;
    const snap = m >= 1 ? 0 : Math.sin(Math.PI * Math.pow(m, 1.6)) * 0.035 * (m > 0.8 ? -1 : 1);
    const dx = n.tx - n.x, dy = n.ty - n.y, dl = Math.hypot(dx, dy);
    const curl = Math.sin(Math.PI * e) * 0.22 * dl;
    x = lerp(n.x, n.tx, e + snap) + (-dy / (dl || 1)) * curl;
    y = lerp(n.y, n.ty, e + snap) + (dx / (dl || 1)) * curl;
  }
  return [x, y, zj];
}

// ─── the scene
function draw(ctx, t) {
  const proj = makeProj(t), cam = proj.cam;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
  ctx.fillStyle = P.ink; ctx.fillRect(0, 0, W, H);

  const [mcx, mcy, msc] = proj(MW / 2, MH / 2);
  // ambient: the void lights up a little as the system lives, a halo stays behind the final mark
  {
    const a = 0.55 * smooth(prog(t, 1.6, 3.4)) + 0.25 * Math.exp(-Math.max(0, t - T.dum) * 2.2) * (t > T.dum ? 1 : 0)
      + 0.16 * Math.exp(-Math.max(0, t - T.complete) * 3) * (t > T.complete && t < T.dum ? 1 : 0)
      + (t > T.still ? 0.04 * Math.sin((t - T.still) * TAU / 2.6) * smooth(prog(t, T.still, T.still + 1)) : 0);
    const R = Math.max(360, MH * msc * 1.25);
    const g = ctx.createRadialGradient(mcx, mcy, 0, mcx, mcy, R);
    g.addColorStop(0, rgba(P.deep, a)); g.addColorStop(1, rgba(P.deep, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // the unlit lattice: shown by the ripple, then faintly around the living system
  if (t > T.pulse - 0.05 && t < T.complete + 0.3) {
    const rp = prog(t, T.pulse, T.pulse + 1.35), rr = ease.outCubic(rp) * 9.5 * U;
    const base = 0.05 * smooth(prog(t, 1.4, 2.2)) * (1 - smooth(prog(t, 3.6, 4.9)));
    const sysR = (cam.zoom > 0 ? 1 : 0) * (8 + 34 * smooth(prog(t, 1.5, 3.2))) * U;
    for (const q of ghost) {
      const ring = rp > 0 && rp < 1 ? Math.exp(-Math.pow((q.d - rr) / (0.9 * U), 2)) * 0.55 * Math.pow(1 - rp, 1.3) : 0;
      const near = base * Math.exp(-Math.pow(q.d / sysR, 2) * 1.2) * (0.6 + 0.4 * q.r);
      const a = ring + near;
      if (a < 0.004) continue;
      const p = proj(q.x, q.y); if (p[0] < -4 || p[0] > W + 4 || p[1] < -4 || p[1] > H + 4) continue;
      const s = clamp(0.9 + p[2] * 0.12, 1, 2.4);
      ctx.fillStyle = rgba(P.line, a); ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
    }
    // the ripple itself: a ring in the plane
    if (rp > 0 && rp < 1) {
      ctx.beginPath();
      for (let k = 0; k <= 160; k++) {
        const an = k / 160 * TAU, p = proj(GEO.O[0] + Math.cos(an) * rr, GEO.O[1] + Math.sin(an) * rr);
        k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.strokeStyle = rgba(P.line, 0.38 * Math.pow(1 - rp, 1.8)); ctx.lineWidth = 1.1; ctx.stroke();
    }
  }

  // ─── the blockout: faces of the lattice cubes, in the studio cube's three tones
  if (t > T.close && t < T.complete) {
    const org = smooth(prog(t, 2.75, 3.35));            // the system organises itself: the silhouette emerges
    for (const c of cubes) {
      const first = c === cubes[0] ? 0.34 * (1 - smooth(prog(t, 2.05, 2.7))) : 0;   // the first bit, briefly the studio's cube
      const fin = c === cubes[0] ? smooth(prog(t, T.close + 0.02, T.close + 0.14)) : smooth(prog(t, c.born + 0.04, c.born + 0.3));
      const a = (0.10 + 0.20 * org + first) * fin * (1 - smooth(prog(t, c.gone - 0.06, c.gone + 0.16)));
      if (a < 0.005) continue;
      const pc = nodes[c.c], r = c.rim.map(i => nodes[i]);
      const P0 = proj(pc.x, pc.y), R = r.map(n => proj(n.x, n.y));
      const quad = (a0, a1, a2, col, k) => {
        ctx.beginPath(); ctx.moveTo(P0[0], P0[1]); ctx.lineTo(R[a0][0], R[a0][1]); ctx.lineTo(R[a1][0], R[a1][1]); ctx.lineTo(R[a2][0], R[a2][1]); ctx.closePath();
        ctx.fillStyle = rgba(col, a * k); ctx.fill();
      };
      quad(0, 1, 2, P.top, 1.0); quad(2, 3, 4, P.right, 1.3); quad(4, 5, 0, P.left, 0.9);
    }
  }

  // ─── the mark, becoming final pixel by pixel as the wave passes (exact pixels of the official PNG)
  const flat = proj.flat();
  if (t > T.refine - 0.02 && t < T.complete) {
    const out = revealD.data, gl = glowD.data;
    for (let k = 0; k < alphaIdx.length; k++) {
      const i = alphaIdx[k], i4 = i * 4, d = t - Tw[i];
      if (d < -0.1) { out[i4 + 3] = 0; gl[i4 + 3] = 0; continue; }
      const r = smooth(d / REVEAL), ma = markPx[i4 + 3];
      out[i4] = markPx[i4]; out[i4 + 1] = markPx[i4 + 1]; out[i4 + 2] = markPx[i4 + 2]; out[i4 + 3] = ma * r;
      const rim = Math.exp(-Math.pow((d - 0.015) / 0.04, 2));
      gl[i4 + 3] = ma * rim * 0.42;
    }
    revealX.putImageData(revealD, 0, 0); glowX.putImageData(glowD, 0, 0);
    ctx.save(); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(revealC, flat.x, flat.y, MW * flat.s, MH * flat.s);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowC, flat.x, flat.y, MW * flat.s, MH * flat.s);
    ctx.restore();
  }
  if (t >= T.complete) {
    ctx.save(); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(IMG.mark, flat.x, flat.y, MW * flat.s, MH * flat.s);
    ctx.restore();
  }

  // ─── lattice edges: drawn on as nodes are born, dissolving as nodes leave for the line art
  if (t > T.spawn && t < T.complete) {
    const pos = new Array(nodes.length);
    for (const n of nodes) { const q = nodePos(n, t, cam); pos[n.i] = q ? proj(q[0], q[1], q[2]) : null; }
    draw.pos = pos;
    const lw = clamp(0.8 + 0.42 * Math.log(cam.zoom + 1), 0.9, 1.9);
    ctx.lineWidth = lw; ctx.lineCap = 'round';
    for (const e of edgesA) {
      if (t < e.t0) continue;
      const A = pos[e.a], B = pos[e.b]; if (!A || !B) continue;
      const na = nodes[e.a], nb = nodes[e.b];
      const m = Math.max(prog(t, na.depart, na.depart + 0.3), prog(t, nb.depart, nb.depart + 0.3));
      const q = e.grow ? 1 : ease.outCubic(prog(t, e.t0, e.t0 + e.len));
      const fresh = Math.exp(-(t - e.t0) * 5);
      const a = (0.34 + 0.5 * fresh) * Math.pow(1 - m, 1.5) * (0.9 + 0.1 * Math.sin(t * 3 + na.seed * 6));
      if (a < 0.01) continue;
      ctx.strokeStyle = rgba(fresh > 0.4 ? P.ice : P.line, a);
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(lerp(A[0], B[0], q), lerp(A[1], B[1], q)); ctx.stroke();
    }
  }

  // ─── fill particles: the blockout breaks into light that settles exactly where the mark's pixels are
  if (t > T.refine - 0.6 && t < T.complete + 0.1) {
    for (const p of parts) {
      const t0 = p.tw - p.lead;
      if (t < t0 || t > p.tw + 0.08) continue;
      const u = prog(t, t0, p.tw);
      const pull = Math.pow(u, 2.1);                   // attraction grows as it closes in
      const x = p.x + p.ox * (1 - pull), y = p.y + p.oy * (1 - pull);
      const a = smooth(u / 0.25) * (1 - smooth((t - p.tw) / 0.08));
      const [sx, sy, sc] = proj(x, y);
      const c = p.c, w = 0.7 * (1 - u * u);
      ctx.fillStyle = `rgba(${Math.round(lerp(c[0], 214, w))},${Math.round(lerp(c[1], 244, w))},${Math.round(lerp(c[2], 255, w))},${a * 0.72})`;
      const s = clamp(p.s * (1.0 + 0.6 * (1 - u)) * Math.sqrt(sc / K), 0.8, 2.4);
      ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
  }

  // ─── the line art: the mark's own outline, lit as the nodes arrive on it
  if (t > T.refine && t < T.complete + 0.8) {
    const pos = draw.pos && t < T.complete ? draw.pos : nodes.map(n => proj(n.tx, n.ty));
    const fade = 1 - smooth(prog(t, T.complete - 0.02, T.complete + 0.6));
    ctx.lineCap = 'round'; ctx.lineWidth = 1.5;
    for (const e of edgesB) {
      if (t < e.t) continue;
      const A = pos[e.a], B = pos[e.b]; if (!A || !B) continue;
      const fresh = Math.exp(-(t - e.t) * 6);
      const lock = t > T.complete ? 0.6 * Math.exp(-(t - T.complete) * 7) : 0;   // the mark is whole: its outline lights once
      const a = smooth((t - e.t) / 0.08) * (0.55 + 0.45 * fresh + lock) * fade;
      if (a < 0.01) continue;
      ctx.strokeStyle = rgba(P.ice, a);
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
    }
  }

  // ─── nodes: points of light
  if (t > T.appear && t < T.complete) {
    const pos = draw.pos;
    for (const n of nodes) {
      if (t < n.born) continue;
      const p = pos ? pos[n.i] : proj(n.x, n.y); if (!p) continue;
      const arrived = t > n.arrive;
      const a = (n.i === cube0[0] && t < T.spawn ? 0 : 1) * (1 - smooth((t - n.arrive) / 0.12)) * (n.kind === 0 && arrived ? 0 : 1);
      if (a <= 0.01) continue;
      const pop = Math.exp(-(t - n.born) * 9);
      const r = clamp(1.05 * Math.sqrt(p[2] / K) + 1.2 * pop, 0.9, 3.4);
      ctx.fillStyle = rgba(pop > 0.3 ? '#ffffff' : P.ice, a * (0.75 + 0.25 * pop));
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
    }
  }

  // ─── the point: the very first signal
  if (t > T.appear && t < T.spawn + 0.5) {
    const [px, py] = proj(GEO.O[0], GEO.O[1]);
    const inA = smooth(prog(t, T.appear, T.appear + 0.18));
    const pulse = t > T.pulse ? Math.exp(-(t - T.pulse) * 5.5) : 0;
    const antic = smooth(prog(t, T.antic, T.spawn)) * (t < T.spawn ? 1 : 0);
    const pop = t > T.spawn ? Math.exp(-(t - T.spawn) * 7) : 0;
    const breathe = 1 + 0.06 * Math.sin(t * TAU * 1.3);
    const core = (1.7 * breathe + 2.2 * pulse - 0.5 * antic + 1.6 * pop) * inA;
    const halo = (16 * breathe + 46 * pulse - 6 * antic + 40 * pop) * inA;
    const fade = 1 - smooth(prog(t, T.spawn + 0.05, T.spawn + 0.45));
    const g = ctx.createRadialGradient(px, py, 0, px, py, Math.max(1, halo));
    g.addColorStop(0, rgba(P.ice, 0.55 * inA)); g.addColorStop(0.25, rgba(P.cyan, 0.16 * inA)); g.addColorStop(1, rgba(P.cyan, 0));
    ctx.globalAlpha = Math.max(fade, 0.0); ctx.fillStyle = g; ctx.fillRect(px - halo, py - halo, halo * 2, halo * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba('#ffffff', inA * (0.85 + 0.15 * pulse));
    ctx.beginPath(); ctx.arc(px, py, Math.max(0.6, core), 0, TAU); ctx.fill();
  }

  // ─── THE REVEAL: a light passes through the mark
  if (t > T.sweep0 && t < T.sweep1) {
    const p = ease.inOutSine(prog(t, T.sweep0, T.sweep1));
    sweepX.globalCompositeOperation = 'source-over'; sweepX.clearRect(0, 0, MW, MH);
    const cx = lerp(-160, MW + 160, p), cy = lerp(MH + 60, -60, p);
    const g = sweepX.createLinearGradient(cx - 90, cy - 52, cx + 90, cy + 52);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(235,250,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    sweepX.fillStyle = g; sweepX.fillRect(0, 0, MW, MH);
    sweepX.globalCompositeOperation = 'destination-in'; sweepX.drawImage(IMG.mark, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.42 * Math.sin(Math.PI * p);
    ctx.drawImage(sweepC, flat.x, flat.y, MW * flat.s, MH * flat.s); ctx.restore();
  }

  // ─── the pulse: from the first point, up through the five tail bits, to the stinger
  if (t > T.arp[0] - 0.2 && t < T.dum + 1.2) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const times = [...T.arp, T.dum];
    times.forEach((tk, k) => {
      if (t < tk - 0.02) return;
      const a = smooth((t - tk + 0.02) / 0.03) * Math.exp(-(t - tk) * (k === 5 ? 3.6 : 7)) * (k === 5 ? 0.5 : 0.42);
      if (a < 0.005) return;
      ctx.globalAlpha = a; ctx.drawImage(regionC[k], flat.x, flat.y, MW * flat.s, MH * flat.s);
    });
    // the signal itself: a single bit of light travelling the chain
    const path = [GEO.O, ...GEO.tail, GEO.stinger], pts = [T.arp[0] - 0.13, ...T.arp, T.dum];
    if (t > pts[0] && t < T.dum) {
      let k = 0; while (k < pts.length - 2 && t > pts[k + 1]) k++;
      const u = ease.inOutSine(prog(t, pts[k], pts[k + 1]));
      const x = lerp(path[k][0], path[k + 1][0], u), y = lerp(path[k][1], path[k + 1][1], u);
      const [sx, sy] = proj(x, y);
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 16);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.3, rgba(P.cyan, 0.35)); g.addColorStop(1, rgba(P.cyan, 0));
      ctx.fillStyle = g; ctx.fillRect(sx - 16, sy - 16, 32, 32);
    }
    ctx.restore();
  }

  // the impact: one restrained ring from the stinger
  if (t > T.dum && t < T.dum + 1.3) {
    const p = prog(t, T.dum, T.dum + 1.3);
    const [sx, sy] = makeProj(T.dum)(GEO.stinger[0], GEO.stinger[1]);
    ctx.strokeStyle = rgba(P.ice, 0.32 * Math.pow(1 - p, 2)); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(sx, sy, 20 + ease.outExpo(p) * 520, 0, TAU); ctx.stroke();
  }

  // ─── THE SIGNATURE: the wordmark slides out from behind the mark and locks
  if (t > T.lock0) {
    const L = proj.L;
    const markRight = L.x + (MW / 2) * flat.s;      // right edge of the moving mark
    ctx.save();
    ctx.beginPath(); ctx.rect(markRight + LOCK.gap * 0.35, 0, W, H); ctx.clip();
    ctx.font = `700 ${LOCK.F}px SG`; ctx.letterSpacing = `${-0.03 * LOCK.F}px`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const words = [['Scorpion', LOCK.tx, P.text], ['Bits', LOCK.tx + LOCK.xB, P.cyan]];   // one phrase, one motion
    const d = 0.06, s = spring(t - T.lock0 - d, 10, 9.5);
    const off = (1 - s) * -(LOCK.wS * 0.55);
    for (const [word, x, col] of words) {
      ctx.globalAlpha = smooth(prog(t, T.lock0 + d, T.lock0 + d + 0.32));
      ctx.fillStyle = col; ctx.fillText(word, x + off, LOCK.base);
    }
    ctx.restore();
  }

  // ─── THE ENDING: the first point, once more, inside the mark
  if (t > T.glint - 0.05 && t < T.glint + 0.9) {
    const [gx, gy] = proj(GEO.O[0], GEO.O[1]);
    const a = smooth(prog(t, T.glint, T.glint + 0.06)) * Math.exp(-Math.max(0, t - T.glint - 0.06) * 4.2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 14);
    g.addColorStop(0, rgba('#ffffff', 0.8 * a)); g.addColorStop(0.3, rgba(P.cyan, 0.25 * a)); g.addColorStop(1, rgba(P.cyan, 0));
    ctx.fillStyle = g; ctx.fillRect(gx - 14, gy - 14, 28, 28);
    ctx.restore();
  }
  // barely perceptible dust in the stillness
  if (t > T.still - 0.5) {
    const a0 = smooth(prog(t, T.still - 0.5, T.still + 0.8)) * (1 - smooth(prog(t, 9.25, 9.9)));
    for (let k = 0; k < 42; k++) {
      const r1 = hash(k * 3.3), r2 = hash(k * 7.9), r3 = hash(k * 1.1);
      const x = (r1 * W + Math.sin(t * 0.21 + k) * 18 + t * 6 * (r3 - 0.5)) % W, y = (r2 * H - t * (3 + 5 * r3) + H) % H;
      const a = a0 * (0.035 + 0.05 * r3) * (0.6 + 0.4 * Math.sin(t * 0.9 + k * 2.1));
      ctx.fillStyle = rgba(P.line, a); ctx.fillRect(x, y, 1 + r3, 1 + r3);
    }
  }
  draw.pos = null;
}

// ─── finishing: motion blur (sub-frames), bloom, vignette, grain
const scene = mk(W, H), sctx = scene.getContext('2d');
const accum = mk(W, H), actx = accum.getContext('2d');
const small = mk(W / 4, H / 4), smctx = small.getContext('2d');
const small2 = mk(W / 4, H / 4), sm2ctx = small2.getContext('2d');
let grains = [], vignette;
function buildStatic() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let g = 0; g < 6; g++) {
    const c = mk(W / 2, H / 2), x = c.getContext('2d'), id = x.createImageData(W / 2, H / 2);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (rnd() - 0.5) * 180; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0); grains.push(c);
  }
  vignette = mk(W, H); const v = vignette.getContext('2d');
  const g = v.createRadialGradient(CX, CY, H * 0.35, CX, CY, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  v.fillStyle = g; v.fillRect(0, 0, W, H);
}
function post(ctx, t, frame) {
  const bloom = lerp(0.6, 0.2, smooth(prog(t, 3.4, T.complete))) * lerp(1, 0.55, smooth(prog(t, T.dum, T.still)));
  smctx.filter = 'brightness(0.62) contrast(3)'; smctx.drawImage(ctx.canvas, 0, 0, W / 4, H / 4); smctx.filter = 'none';
  sm2ctx.clearRect(0, 0, W / 4, H / 4); sm2ctx.filter = 'blur(6px)'; sm2ctx.drawImage(small, 0, 0); sm2ctx.filter = 'none';
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = bloom; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small2, 0, 0, W, H); ctx.restore();
  ctx.drawImage(vignette, 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.035;
  ctx.drawImage(grains[frame % grains.length], 0, 0, W, H); ctx.restore();
}
function renderFrame(ctx, t, sub, frame, fps) {
  const shutter = 0.5 / fps;
  for (let s = 0; s < sub; s++) {
    const ts = Math.min(TL.DUR - 1e-4, t + (sub > 1 ? (s / sub - 0.5) * shutter : 0));
    draw(sctx, Math.max(0, ts));
    actx.globalAlpha = 1 / (s + 1); actx.drawImage(scene, 0, 0);
  }
  actx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(accum, 0, 0);
  post(ctx, t, frame);
}

// ─── boot
const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
const ready = Promise.all([
  ...['400', '700'].map(w => document.fonts.load(`${w} 40px SG`)),
  load('mark', 'brand/logo-mark.png'), load('data', 'data.png'),
]).then(() => { init(); buildStatic(); });

window.ident = {
  ready, T,
  async frame(f, fps = 60, sub = 5, type = 'image/png', q = 0.95) {
    await ready;
    const t = f / fps;
    renderFrame(ctx, t, sub, f, fps);
    return canvas.toDataURL(type, q);
  },
};
if (new URLSearchParams(location.search).has('render')) return;

ready.then(() => {
  const audio = new Audio('soundtrack.wav');
  const q = new URLSearchParams(location.search);
  let start = performance.now() - (Number(q.get('t')) || 0) * 1000;
  const play = document.getElementById('play');
  play.onclick = () => { play.style.display = 'none'; start = performance.now(); audio.currentTime = 0; audio.play().catch(() => {}); };
  let frame = 0;
  const loop = () => {
    const el = (performance.now() - start) / 1000;
    const t = !audio.paused ? audio.currentTime : Math.min(el % (TL.DUR + 1.5), TL.DUR - 1e-3);
    renderFrame(ctx, t, 1, frame++, 60);
    requestAnimationFrame(loop);
  };
  loop();
});
})();

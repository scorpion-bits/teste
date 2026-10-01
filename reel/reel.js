// Motion Reel 2026 — a 15 s procedural showreel.
// Every frame is a pure function of time: no keyframes, no assets besides fonts.
// 128 BPM, 8 bars, 32 beats = exactly 15.000 s. One scene per bar.

(() => {
'use strict';

const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const FPS = 60, DUR = 15;
const BPM = 128, B = 60 / BPM, BAR = B * 4;
const C = {
  ink: '#0B0B10', paper: '#F2EFE9', orange: '#FF4D1C', cobalt: '#2F4BFF',
  lime: '#C8FF3D', pink: '#FF3DA8', white: '#FFFFFF', navy: '#0A1030',
};

// ───────────────────────────────────────────── math
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const TAU = Math.PI * 2;
const E = {
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: t => 1 - Math.pow(1 - t, 5),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = f => f * f * (3 - 2 * f);
const noise1 = x => { const i = Math.floor(x); return lerp(hash(i), hash(i + 1), smooth(x - i)) * 2 - 1; };
const noise2 = (x, y) => {
  const ix = Math.floor(x), iy = Math.floor(y), ux = smooth(x - ix), uy = smooth(y - iy);
  return lerp(lerp(hash2(ix, iy), hash2(ix + 1, iy), ux), lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), ux), uy) * 2 - 1;
};
// decaying pulse on every beat after `from`
const beatPulse = (t, k = 8, from = 0) => (t < from ? 0 : Math.exp(-((t - from) % B) * k));

// ───────────────────────────────────────────── canvas helpers
const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const bg = (ctx, col) => { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); };
const font = (ctx, fam, px) => { ctx.font = `${fam === 'IS' ? 'italic ' : ''}${px}px ${fam}`; };
const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); };
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

// lay out letters of `text` centred on cx; returns [{ch, x, w}]
function layout(ctx, text, cx, spacing = 0) {
  const ws = [...text].map(ch => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + spacing * (ws.length - 1);
  let x = cx - total / 2;
  return [...text].map((ch, i) => { const o = { ch, x: x + ws[i] / 2, w: ws[i] }; x += ws[i] + spacing; return o; });
}

// glyph-scramble text that resolves to `text` over progress p
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>*+=';
function scramble(text, p, seed) {
  return [...text].map((ch, i) => {
    if (ch === ' ' || p * (text.length + 3) - 3 > i) return ch;
    if (p * (text.length + 3) < i) return '';
    return GLYPHS[Math.floor(hash(seed + i * 13.7) * GLYPHS.length)];
  }).join('');
}

function caption(ctx, lt, num, label, col = C.white) {
  const p = E.outExpo(prog(lt, 0.15, 0.6));
  const q = 1 - E.inExpo(prog(lt, BAR - 0.35, BAR - 0.05));
  ctx.save();
  ctx.globalAlpha = q;
  ctx.fillStyle = col; ctx.strokeStyle = col;
  font(ctx, 'JB', 20); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillRect(96, H - 150, 280 * p, 2);
  const seed = Math.floor(lt * FPS);
  ctx.fillText(scramble(`${num} — ${label}`, prog(lt, 0.2, 0.75), seed), 96, H - 124);
  ctx.restore();
}

// ───────────────────────────────────────────── shared offscreens
const scene = mk(), sctx = scene.getContext('2d');
const accum = mk(), actx = accum.getContext('2d');
const tmp = mk(), tctx = tmp.getContext('2d');
const chan = mk(), chctx = chan.getContext('2d');
const word = mk(), wctx = word.getContext('2d');

let grains = [], vignette;
function buildStatic() {
  for (let g = 0; g < 8; g++) {
    const c = mk(W / 2, H / 2), x = c.getContext('2d'), id = x.createImageData(W / 2, H / 2);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 128 + (hash(g * 7919 + i * 0.25) - 0.5) * 255;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
    }
    x.putImageData(id, 0, 0); grains.push(c);
  }
  vignette = mk(); const v = vignette.getContext('2d');
  const g = v.createRadialGradient(CX, CY, H * 0.35, CX, CY, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  v.fillStyle = g; v.fillRect(0, 0, W, H);
}

// ═════════════════════════════════════════════ SCENE 1 — the dot
function sIntro(ctx, lt) {
  const b = lt / B;
  bg(ctx, C.ink);

  // beat ripples
  ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    const p = (lt - k * B) / (B * 1.8);
    if (p > 0 && p < 1) {
      ctx.strokeStyle = rgba(C.white, (1 - p) * 0.35);
      circle(ctx, CX, CY, 24 + E.outExpo(p) * 620); ctx.stroke();
    }
  }

  const pop = E.outBack(prog(lt, 0, 0.32));
  const split = E.inOutExpo(prog(b, 1, 1.7));
  const draw = E.outCubic(prog(b, 1.25, 2.1));
  const round = E.inOutCubic(prog(b, 2, 2.9));
  const rot = E.inOutExpo(prog(b, 2, 2.9)) * Math.PI / 2 + lt * 0.15;
  const fillIn = E.outExpo(prog(b, 3, 3.35));
  const grow = E.inExpo(prog(b, 3.2, 3.88));
  const hs = 150 * split * lerp(1, Math.hypot(W, H) / 2 / 150 + 0.2, grow);

  ctx.save();
  ctx.translate(CX, CY); ctx.rotate(rot);
  if (split > 0) {
    // the square → circle outline, drawn on
    const r = hs * round;
    const per = 8 * hs - (8 - TAU) * r;
    ctx.beginPath(); ctx.roundRect(-hs, -hs, hs * 2, hs * 2, r);
    ctx.setLineDash([per * draw, per + 1]);
    ctx.strokeStyle = C.white; ctx.lineWidth = 3; ctx.stroke();
    ctx.setLineDash([]);
    if (fillIn > 0) {
      ctx.save(); ctx.clip();
      ctx.fillStyle = C.orange; circle(ctx, 0, 0, hs * 1.5 * fillIn); ctx.fill();
      ctx.restore();
    }
    // corner dots ride the corners, then slide onto the circle
    const d = hs * lerp(Math.SQRT2, 1, round) / Math.SQRT2;
    ctx.fillStyle = C.orange;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      circle(ctx, sx * d, sy * d, 11 * (1 - fillIn)); ctx.fill();
    }
  }
  ctx.fillStyle = C.orange;
  circle(ctx, 0, 0, 20 * pop * (1 - split) + 20 * (1 - split) * beatPulse(lt, 14) * 0.3); ctx.fill();
  ctx.restore();

  // typewriter line
  const msg = 'HELLO. I MAKE THINGS MOVE.';
  const n = Math.floor(prog(lt, 0.25, 1.2) * msg.length);
  const fade = 1 - prog(b, 3.1, 3.5);
  if (fade > 0) {
    ctx.save(); ctx.globalAlpha = fade;
    font(ctx, 'JB', 26); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.letterSpacing = '6px';
    const full = ctx.measureText(msg).width;
    const x = CX - full / 2, y = CY + 300;
    ctx.fillStyle = C.paper; ctx.fillText(msg.slice(0, n), x, y);
    const cw = ctx.measureText(msg.slice(0, n)).width;
    if (Math.floor(lt * 4) % 2 === 0 || n < msg.length) { ctx.fillStyle = C.orange; ctx.fillRect(x + cw + 4, y - 14, 14, 28); }
    // load counter
    font(ctx, 'JB', 18); ctx.letterSpacing = '4px'; ctx.fillStyle = rgba(C.paper, 0.5);
    const pct = Math.floor(E.inOutCubic(prog(lt, 0, BAR * 0.95)) * 100);
    ctx.fillText(`LOADING REEL_2026 ……… ${String(pct).padStart(3, '0')}%`, x, y + 56);
    ctx.restore();
  }
}

// ═════════════════════════════════════════════ SCENE 2 — kinetic type
function sType(ctx, lt) {
  const b = lt / B;
  const flip = b >= 2 && b < 3 && Math.floor(b * 4) % 2 === 1;
  bg(ctx, flip ? C.ink : C.orange);
  const fg = flip ? C.orange : C.ink;

  // ticker rows behind
  ctx.save();
  font(ctx, 'UB', 120); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.strokeStyle = rgba(flip ? C.orange : C.ink, 0.18); ctx.lineWidth = 2;
  const row = 'MOTION · DESIGN · ANIMATION · ';
  const rw = ctx.measureText(row).width;
  for (let r = -1; r < 7; r++) {
    const dir = r % 2 ? 1 : -1;
    const x = ((lt * 520 * dir + r * 400) % rw + rw) % rw - rw;
    for (let k = 0; k < 3; k++) ctx.strokeText(row, x + k * rw, r * 150 + 90);
  }
  ctx.restore();

  // main word into offscreen
  wctx.clearRect(0, 0, W, H);
  const size = 300, wy = CY - 40;
  font(wctx, 'UB', size); wctx.textBaseline = 'middle'; wctx.textAlign = 'center';
  wctx.save();
  wctx.beginPath(); wctx.rect(0, wy - size * 0.62, W, size * 1.24); wctx.clip();
  layout(wctx, 'MOTION', CX, -6).forEach((L, i) => {
    const d = i * 0.045;
    const p = E.outExpo(prog(lt, d, d + 0.55));
    wctx.save();
    wctx.translate(L.x, wy + (1 - p) * size * 1.25);
    wctx.rotate((1 - p) * 0.35 * (i % 2 ? 1 : -1));
    wctx.fillStyle = fg; wctx.fillText(L.ch, 0, 0);
    wctx.restore();
  });
  wctx.restore();

  // stutter slices + echo zoom
  const stut = b >= 2 && b < 3.1 ? Math.exp(-((lt - 2 * B) % (B / 2)) * 9) : 0;
  const echo = E.inOutCubic(prog(b, 3, 3.6));
  const out = E.inExpo(prog(b, 3.3, 3.95));
  ctx.save();
  ctx.translate(CX, CY); ctx.scale(1 + out * 2.2, 1 - out * 0.95); ctx.translate(-CX, -CY);
  for (let e = 6; e >= 1; e--) {
    if (echo <= 0) break;
    const s = 1 + e * 0.11 * echo;
    ctx.globalAlpha = 0.16 * echo * (1 - e / 7);
    ctx.drawImage(word, CX - CX * s, CY - CY * s, W * s, H * s);
  }
  ctx.globalAlpha = 1;
  const strips = 9, sh = (size * 1.24) / strips, top = wy - size * 0.62;
  for (let k = 0; k < strips; k++) {
    const off = stut * 140 * Math.sin(k * 1.9 + Math.floor(lt * 30) * 2.3);
    ctx.drawImage(word, 0, top + k * sh, W, sh, off, top + k * sh, W, sh);
  }
  ctx.restore();

  // serif sub-line
  const words = ['is', 'my', 'native', 'language.'];
  ctx.save();
  font(ctx, 'IS', 78); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const gap = 22;
  const widths = words.map(w => ctx.measureText(w).width);
  let x = CX - (widths.reduce((a, c) => a + c, 0) + gap * 3) / 2;
  const sy = CY + 175;
  ctx.beginPath(); ctx.rect(0, sy - 60, W, 120); ctx.clip();
  const gone = E.inExpo(prog(b, 1.85, 2.05));
  words.forEach((w, i) => {
    const p = E.outExpo(prog(b, 0.9 + i * 0.12, 1.6 + i * 0.12));
    ctx.fillStyle = fg;
    ctx.fillText(w, x, sy + (1 - p) * 110 - gone * 120);
    x += widths[i] + gap;
  });
  ctx.restore();

  // slice wipe to black
  const wp = prog(b, 3.45, 4);
  if (wp > 0) {
    ctx.fillStyle = C.ink;
    const n = 10, bh = H / n;
    for (let k = 0; k < n; k++) {
      const p = E.inOutExpo(prog(wp, k * 0.04, 0.6 + k * 0.04));
      if (k % 2) ctx.fillRect(W - W * p, k * bh, W * p + 1, bh + 1);
      else ctx.fillRect(0, k * bh, W * p + 1, bh + 1);
    }
  }
}

// ═════════════════════════════════════════════ SCENE 3 — ripple grid
const SOURCES = [[0.5, 0.5], [0.18, 0.3], [0.82, 0.7], [0.5, 0.5]];
function sGrid(ctx, lt) {
  const b = lt / B;
  bg(ctx, C.ink);
  const cols = 32, rows = 18, cell = 60;
  const col = E.inExpo(prog(b, 3.1, 4));
  const swirl = col * Math.PI * 1.5;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x0 = i * cell + cell / 2, y0 = j * cell + cell / 2;
    const dc = Math.hypot(x0 - CX, y0 - CY);
    const appear = E.outBack(prog(lt, dc * 0.00045, dc * 0.00045 + 0.35));
    if (appear <= 0) continue;
    let v = Math.sin(lt * 3 - dc * 0.012) * 0.35;
    SOURCES.forEach(([sx, sy], k) => {
      const ts = lt - k * B; if (ts < 0) return;
      const d = Math.hypot(x0 - sx * W, y0 - sy * H);
      const front = clamp((ts * 1500 - d) / 200);
      v += front * Math.exp(-ts * 1.4) * Math.sin(ts * 11 - d * 0.02) * 1.1;
    });
    v = Math.tanh(v * 1.4);
    const a = Math.atan2(y0 - CY, x0 - CX) + swirl * (1 - dc / 1100);
    const rr = dc * (1 - col);
    const x = CX + Math.cos(a) * rr, y = CY + Math.sin(a) * rr;
    const s = cell * 0.44 * (0.2 + 0.8 * Math.abs(v)) * appear * (1 - col * 0.6);
    const hue = 230 + 140 * (v + 1) / 2;
    ctx.fillStyle = `hsl(${hue % 360},100%,${55 + 10 * Math.abs(v)}%)`;
    ctx.save(); ctx.translate(x, y); ctx.rotate(v * Math.PI / 4 + swirl);
    ctx.beginPath(); ctx.roundRect(-s, -s, s * 2, s * 2, s * (v + 1) / 2); ctx.fill();
    ctx.restore();
  }
  // collapse core glow
  if (col > 0) {
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 260);
    g.addColorStop(0, rgba(C.white, col)); g.addColorStop(1, rgba(C.white, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  caption(ctx, lt, '01', 'GENERATIVE SYSTEMS');
}

// ═════════════════════════════════════════════ SCENE 4 — 3D point morphs
const NP = 1400;
const PTS = (() => {
  const sph = [], cube = [], tor = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NP; i++) {
    const y = 1 - (i / (NP - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
    const p = [Math.cos(th) * r, y, Math.sin(th) * r];
    sph.push(p);
    const m = Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]));
    cube.push(p.map(c => (c / m) * 0.82));
    const u = TAU * (i / NP) * 1, v = TAU * ((i * 34 / NP) % 1);
    const R = 0.85, rr = 0.36;
    tor.push([(R + rr * Math.cos(v)) * Math.cos(u * 1), rr * Math.sin(v), (R + rr * Math.cos(v)) * Math.sin(u)]);
  }
  return { sph, cube, tor };
})();
function sSphere(ctx, lt) {
  const b = lt / B;
  bg(ctx, C.ink);
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 900);
  g.addColorStop(0, rgba(C.cobalt, 0.45)); g.addColorStop(1, rgba(C.navy, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const m1 = E.inOutExpo(prog(b, 1.25, 1.85));
  const m2 = E.inOutExpo(prog(b, 2.25, 2.85));
  const boom = E.inExpo(prog(b, 3.3, 4));
  const ry = lt * 1.1 + m1 * 0.8 + m2 * 0.8, rx = 0.45 + Math.sin(lt * 1.3) * 0.25 + m2 * 0.5;
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
  const enter = E.outExpo(prog(lt, 0, 0.6));
  const R = 330 * enter * (1 + beatPulse(lt, 10) * 0.06);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < NP; i++) {
    const a = PTS.sph[i], c = PTS.cube[i], t = PTS.tor[i];
    let x = lerp(lerp(a[0], c[0], m1), t[0], m2);
    let y = lerp(lerp(a[1], c[1], m1), t[1], m2);
    let z = lerp(lerp(a[2], c[2], m1), t[2], m2);
    const disp = 1 + beatPulse(lt, 7) * 0.12 * noise2(i * 0.05, lt * 2) * (1 - m1);
    const ex = 1 + boom * (4 + hash(i) * 8);
    x *= disp * ex; y *= disp * ex; z *= disp * ex;
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
    const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
    const f = 2.6 / (2.6 + z2);
    if (f <= 0) continue;
    const px = CX + x1 * R * f, py = CY + y2 * R * f;
    const depth = clamp((1 - z2) / 2);
    ctx.fillStyle = depth > 0.62 ? rgba(C.lime, 0.9) : rgba(i % 7 ? '#7F94FF' : C.pink, 0.35 + depth * 0.6);
    const s = (1 + depth * 2.6) * f;
    ctx.fillRect(px - s, py - s, s * 2, s * 2);
  }
  ctx.globalCompositeOperation = 'source-over';

  // orbit rings + satellites
  ctx.save(); ctx.translate(CX, CY);
  for (let k = 0; k < 2; k++) {
    ctx.save(); ctx.rotate(k ? -0.4 : 0.3);
    const rx2 = (520 + k * 90) * enter * (1 + boom * 2), ry2 = (110 + k * 40) * enter * (1 + boom * 2);
    ctx.strokeStyle = rgba(C.white, 0.22 * (1 - boom)); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, rx2, ry2, 0, 0, TAU); ctx.stroke();
    const a = lt * (k ? -1.6 : 2.1);
    ctx.fillStyle = k ? C.orange : C.white;
    circle(ctx, Math.cos(a) * rx2, Math.sin(a) * ry2, 7); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // shape readout
  const label = b < 1.5 ? 'SPHERE' : b < 2.5 ? 'CUBE' : 'TORUS';
  const since = b < 1.5 ? b : b < 2.5 ? b - 1.5 : b - 2.5;
  ctx.save();
  font(ctx, 'JB', 20); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillStyle = C.lime; ctx.letterSpacing = '4px';
  ctx.fillText(`[ ${scramble(label, clamp(since * 2), Math.floor(lt * FPS))} ]`, W - 96, CY);
  ctx.fillStyle = rgba(C.white, 0.5);
  ctx.fillText(`N=${NP}  RX=${rx.toFixed(2)}  RY=${(ry % TAU).toFixed(2)}`, W - 96, CY + 36);
  ctx.restore();
  caption(ctx, lt, '02', '3D / SIMULATION');

  const fl = prog(b, 3.7, 4);
  if (fl > 0) { ctx.fillStyle = rgba(C.white, E.inCubic(fl)); ctx.fillRect(0, 0, W, H); }
}

// ═════════════════════════════════════════════ SCENE 5 — principles montage
const M = 64, G = 20, AW = W - M * 2, AH = H - M * 2;
const pw3 = (AW - G * 2) / 3, ph2 = (AH - G) / 2, pw2 = (AW - G) / 2;
const STAGES = [
  [[M, M, AW, AH], null, null, null, null, null],
  [[M, M, pw2, AH], [M + pw2 + G, M, pw2, AH], null, null, null, null],
  [[M, M, pw2, ph2], [M + pw2 + G, M, pw2, ph2], [M, M + ph2 + G, pw2, ph2], [M + pw2 + G, M + ph2 + G, pw2, ph2], null, null],
  [0, 1, 2, 3, 4, 5].map(i => [M + (i % 3) * (pw3 + G), M + Math.floor(i / 3) * (ph2 + G), pw3, ph2]),
];
// panel order in the 3x2: make sure earlier panels keep roughly their spot
const ORDER3 = [0, 1, 3, 4, 2, 5];
STAGES[3] = ORDER3.map(k => STAGES[3][k]);
function stageRect(s, i) {
  const r = STAGES[s][i];
  if (r) return r;
  for (let k = s + 1; k < STAGES.length; k++) {
    const n = STAGES[k][i];
    if (n) return [n[0] + n[2] / 2, n[1] + n[3] / 2, 0, 0];
  }
}
const PANELS = [
  { bg: C.orange, label: 'SQUASH & STRETCH', draw: pBall },
  { bg: C.ink, label: 'OVERLAP / FOLLOW-THROUGH', draw: pPendulum },
  { bg: C.cobalt, label: 'ARCS', draw: pLissajous },
  { bg: C.lime, label: 'EASING', draw: pEase },
  { bg: C.pink, label: 'TIMING', draw: pBars },
  { bg: C.ink, label: 'ORGANIC FORM', draw: pBlob },
];
function sPanels(ctx, lt) {
  const b = lt / B;
  bg(ctx, C.paper);
  const wipe = E.inExpo(prog(b, 3.05, 3.8));
  if (wipe > 0) { ctx.fillStyle = C.ink; circle(ctx, CX, CY, wipe * 1200); ctx.fill(); }
  const st = Math.min(3, Math.floor(b * 2));
  const e = E.outExpo(prog(b * 2 - st, 0, 0.9));
  PANELS.forEach((P, i) => {
    const a = stageRect(Math.max(0, st - 1), i), c = stageRect(st, i);
    const k = st === 0 ? 1 : e;
    let [x, y, w, h] = a.map((v, n) => lerp(v, c[n], k));
    if (st === 0) { const pin = E.outExpo(prog(lt, 0, 0.35)); x = lerp(CX, x, pin); y = lerp(CY, y, pin); w *= pin; h *= pin; }
    const out = E.inExpo(prog(b, 3 + i * 0.07, 3.55 + i * 0.07));
    if (w < 1 || h < 1 || out >= 1) return;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(out * 0.5 * (i % 2 ? 1 : -1)); ctx.scale(1 - out, 1 - out);
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 14); ctx.fillStyle = P.bg; ctx.fill(); ctx.clip();
    const sc = Math.min(w / pw3, h / ph2) * 0.95;
    ctx.save(); ctx.scale(sc, sc); P.draw(ctx, lt, i); ctx.restore();
    const fgc = P.bg === C.ink || P.bg === C.cobalt ? C.paper : C.ink;
    font(ctx, 'JB', 15); ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.letterSpacing = '3px';
    ctx.fillStyle = fgc; ctx.fillText(`0${i + 1}  ${P.label}`, -w / 2 + 22, -h / 2 + 20);
    ctx.restore();
  });
  ctx.letterSpacing = '0px';
}
function pBall(ctx, lt) {
  const ph = (lt % B) / B, ht = 1 - Math.pow(2 * ph - 1, 2);
  const floor = 150, y = floor - 40 - ht * 230;
  const contact = Math.exp(-Math.min(ph, 1 - ph) * 28);
  const speed = Math.abs(2 * ph - 1);
  const syc = (1 - 0.45 * contact) * (1 + 0.35 * Math.pow(speed, 4) * (1 - contact));
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, floor, 60 * (1 - ht * 0.5), 10 * (1 - ht * 0.5), 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.ink; ctx.fillRect(-240, floor, 480, 3);
  ctx.save(); ctx.translate(0, y + 40 * (1 - syc)); ctx.scale(1 / syc, syc);
  ctx.fillStyle = C.paper; circle(ctx, 0, 0, 40); ctx.fill();
  ctx.restore();
}
function pPendulum(ctx, lt) {
  for (let i = 0; i < 15; i++) {
    const x = Math.sin(lt * TAU * (0.6 + i * 0.045)) * 200, y = -170 + i * 25;
    ctx.strokeStyle = rgba(C.paper, 0.12); ctx.beginPath(); ctx.moveTo(0, -210); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = i % 5 === 4 ? C.orange : C.paper; circle(ctx, x, y + 20, 9); ctx.fill();
  }
}
function pLissajous(ctx, lt) {
  ctx.lineWidth = 4; ctx.lineCap = 'round';
  const n = 70;
  for (let k = 0; k < n; k++) {
    const t0 = (lt - 1.1 * (1 - k / n)) * 1.6, t1 = (lt - 1.1 * (1 - (k + 1) / n)) * 1.6;
    ctx.strokeStyle = rgba(C.lime, k / n);
    ctx.beginPath();
    ctx.moveTo(Math.sin(3 * t0) * 210, Math.sin(4 * t0 + 0.5) * 165 + 15);
    ctx.lineTo(Math.sin(3 * t1) * 210, Math.sin(4 * t1 + 0.5) * 165 + 15);
    ctx.stroke();
  }
  const t = lt * 1.6;
  ctx.fillStyle = C.white; circle(ctx, Math.sin(3 * t) * 210, Math.sin(4 * t + 0.5) * 165 + 15, 12); ctx.fill();
}
function pEase(ctx, lt) {
  ctx.save(); ctx.translate(0, 15);
  const ring = 'EASE IN · EASE OUT · ';
  font(ctx, 'JB', 22); ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [...ring].forEach((ch, i) => {
    const a = (i / ring.length) * TAU + lt * 1.2;
    ctx.save(); ctx.rotate(a); ctx.fillText(ch, 0, -165); ctx.restore();
  });
  const p = (lt % (B * 2)) / (B * 2);
  const e = p < 0.5 ? E.inOutExpo(p * 2) : 1 - E.inOutExpo((p - 0.5) * 2);
  ctx.fillStyle = C.ink;
  ctx.save(); ctx.translate(lerp(-90, 90, e), 0); ctx.rotate(e * Math.PI);
  ctx.fillRect(-34, -34, 68, 68); ctx.restore();
  ctx.restore();
}
function pBars(ctx, lt) {
  ctx.fillStyle = C.ink;
  for (let i = 0; i < 16; i++) {
    const v = 0.25 + 0.75 * Math.abs(noise1(i * 0.9 + lt * 6)) * (0.55 + beatPulse(lt, 6) * 0.6);
    const h = v * 330;
    ctx.beginPath(); ctx.roundRect(-232 + i * 29, 175 - h, 20, h, 10); ctx.fill();
  }
}
function pBlob(ctx, lt) {
  const g = ctx.createLinearGradient(-200, -200, 200, 200);
  g.addColorStop(0, C.orange); g.addColorStop(1, C.pink);
  ctx.fillStyle = g; ctx.beginPath();
  for (let k = 0; k <= 72; k++) {
    const a = (k / 72) * TAU;
    const r = 150 + 45 * noise2(Math.cos(a) * 1.4 + lt * 1.5, Math.sin(a) * 1.4 + lt) + 25 * beatPulse(lt, 9) * Math.sin(a * 5);
    k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r + 15) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r + 15);
  }
  ctx.fill();
}

// ═════════════════════════════════════════════ SCENE 6 — tunnel
function sTunnel(ctx, lt) {
  const b = lt / B;
  bg(ctx, C.ink);
  let travel = lt * 0.42;
  for (let k = 0; k < 4; k++) travel += E.outExpo(prog(lt, k * B, k * B + 0.3)) * 0.09;
  const squash = E.inExpo(prog(b, 3.55, 4));
  ctx.save();
  ctx.translate(CX, CY); ctx.scale(1 + squash * 0.3, lerp(1, 0.003, squash));

  // streaks
  for (let i = 0; i < 90; i++) {
    const a = hash(i) * TAU, sp = 0.5 + hash(i + 50);
    const d = ((lt * sp * 1.1 + hash(i + 99)) % 1);
    const r0 = 60 + d * d * 1400, r1 = r0 + 40 + d * 260 * (1 + beatPulse(lt, 6) * 2);
    ctx.strokeStyle = rgba(C.white, d * 0.5); ctx.lineWidth = 1 + d * 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
  }
  const N = 27, cols = [C.lime, C.pink, C.white];
  const rings = [];
  for (let k = 0; k < N; k++) {
    const u = k / N + travel;
    const depth = 1 - (u - Math.floor(u));
    const id = k - N * Math.floor(u);
    rings.push({ depth, id: ((id % 3) + 3) % 3, kid: id });
  }
  rings.sort((a, c) => c.depth - a.depth);
  ctx.lineJoin = 'round';
  for (const r of rings) {
    const dz = r.depth * 3 + 0.08;
    const rad = 95 / dz;
    const al = clamp((1 - r.depth) * 2.5) * clamp(r.depth * 10);
    ctx.strokeStyle = rgba(cols[r.id], al); ctx.lineWidth = 1.5 + (1 - r.depth) * 9;
    const sides = r.id === 1 ? 4 : 6;
    const rot = r.kid * 0.14 + lt * 0.5;
    ctx.beginPath();
    for (let s = 0; s <= sides; s++) {
      const a = rot + (s / sides) * TAU;
      s ? ctx.lineTo(Math.cos(a) * rad * 1.15, Math.sin(a) * rad) : ctx.moveTo(Math.cos(a) * rad * 1.15, Math.sin(a) * rad);
    }
    ctx.stroke();
  }
  // beat words
  const words = ['EVERY', 'FRAME', 'ON THE', 'BEAT.'];
  const k = Math.min(3, Math.floor(b));
  const punch = Math.exp(-(lt - k * B) * 11);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 520);
  glow.addColorStop(0, 'rgba(11,11,16,0.85)'); glow.addColorStop(1, 'rgba(11,11,16,0)');
  ctx.fillStyle = glow; ctx.fillRect(-W, -H, W * 2, H * 2);
  ctx.save(); ctx.scale(1 + punch * 0.28, 1 + punch * 0.28); ctx.rotate(punch * 0.05 * (k % 2 ? 1 : -1));
  font(ctx, 'UB', 190); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = k === 3 ? C.lime : C.white;
  ctx.fillText(words[k], 0, 0);
  ctx.restore();
  ctx.restore();

  const fl = Math.exp(-lt * 14);
  if (fl > 0.01) { ctx.fillStyle = rgba(C.white, fl); ctx.fillRect(0, 0, W, H); }
}

// ═════════════════════════════════════════════ SCENE 7 — data lines
function sWaves(ctx, lt) {
  const b = lt / B;
  bg(ctx, C.ink);
  const L = 34, x0 = 260, x1 = 1660;
  const spread = E.outExpo(prog(lt, 0, 0.75)) * (1 - E.inOutExpo(prog(b, 3.3, 3.95)));
  const build = prog(b, 2, 3.4);
  const amp = (60 + 120 * build * build) * spread;
  const roll = b >= 2 ? Math.exp(-((lt - 2 * B) % (B / (b < 3 ? 2 : 4))) * 14) : beatPulse(lt, 7);
  ctx.lineJoin = 'round';
  for (let i = 0; i < L; i++) {
    const y0 = CY + (i - (L - 1) / 2) * 21 * spread + 30 * spread;
    const jitter = build * 6 * noise1(i * 3 + lt * 40) * spread;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 7) {
      const env = Math.exp(-Math.pow((x - CX) / 260, 2));
      const n = 0.5 + 0.5 * noise2(x * 0.011 + i * 9.1, i * 0.6 + lt * 2.4);
      const y = y0 - env * n * n * amp * (0.75 + roll * 0.6) + jitter;
      x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo(x1, H); ctx.lineTo(x0, H); ctx.closePath();
    ctx.fillStyle = C.ink; ctx.fill();
    // re-stroke only the top edge
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 7) {
      const env = Math.exp(-Math.pow((x - CX) / 260, 2));
      const n = 0.5 + 0.5 * noise2(x * 0.011 + i * 9.1, i * 0.6 + lt * 2.4);
      const y = y0 - env * n * n * amp * (0.75 + roll * 0.6) + jitter;
      x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const hot = i === 21;
    ctx.strokeStyle = hot ? C.orange : rgba(C.paper, 0.9); ctx.lineWidth = hot ? 4 : 2.2;
    ctx.stroke();
  }
  // scanner
  const sx = lerp(x0, x1, (lt * 0.8) % 1);
  ctx.strokeStyle = rgba(C.lime, 0.6 * spread); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(sx, 140); ctx.lineTo(sx, H - 180); ctx.stroke();
  ctx.save();
  font(ctx, 'JB', 16); ctx.fillStyle = rgba(C.lime, spread); ctx.textBaseline = 'middle';
  ctx.fillText(`${(20 + ((sx - x0) / (x1 - x0)) * 19980).toFixed(0).padStart(5, '0')} Hz`, sx + 12, 152);
  ctx.restore();
  caption(ctx, lt, '03', 'AUDIO-REACTIVE / DATA');
}

// ═════════════════════════════════════════════ SCENE 8 — end card
function sEnd(ctx, lt) {
  bg(ctx, C.ink);
  // drifting colour fields
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  [[C.orange, 0], [C.cobalt, 2]].forEach(([c, o]) => {
    const x = CX + Math.cos(lt * 0.7 + o) * 560, y = CY + Math.sin(lt * 0.9 + o) * 260;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 720);
    g.addColorStop(0, rgba(c, 0.32 * E.outCubic(prog(lt, 0, 0.6)))); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
  ctx.restore();

  const lineY = lerp(CY + 30, CY + 95, E.outExpo(prog(lt, 0.02, 0.5)));
  const lw = lerp(1400, 1060, E.outExpo(prog(lt, 0.05, 0.6)));
  ctx.fillStyle = lt < 0.12 ? C.paper : C.orange;
  ctx.fillRect(CX - lw / 2, lineY - 2, lw, 4);

  // name rising from the line
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, lineY - 6); ctx.clip();
  font(ctx, 'UB', 210); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
  layout(ctx, 'CLAUDE', CX, 4).forEach((L, i) => {
    const p = E.outExpo(prog(lt, 0.06 + i * 0.045, 0.75 + i * 0.045));
    ctx.fillStyle = C.paper;
    ctx.fillText(L.ch, L.x, lineY - 28 + (1 - p) * 260);
  });
  ctx.restore();

  // title, tracking in
  const tp = E.outExpo(prog(lt, 0.2, 1.0));
  ctx.save();
  font(ctx, 'SG', 36); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${lerp(48, 16, tp)}px`;
  ctx.globalAlpha = tp; ctx.fillStyle = C.paper;
  ctx.fillText('MOTION DESIGNER', CX + lerp(24, 8, tp), lineY - 300);
  ctx.restore();

  // mark: drawn circle + orbiting dot
  const mp = E.outCubic(prog(lt, 0.1, 0.8));
  const my = lineY - 400;
  ctx.strokeStyle = C.paper; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(CX, my, 30, -Math.PI / 2, -Math.PI / 2 + TAU * mp); ctx.stroke();
  const oa = -Math.PI / 2 + TAU * mp + lt * 3;
  ctx.fillStyle = C.orange; circle(ctx, CX + Math.cos(oa) * 30, my + Math.sin(oa) * 30, 8 * mp); ctx.fill();

  // serif tagline below line, masked
  ctx.save();
  ctx.beginPath(); ctx.rect(0, lineY + 6, W, 140); ctx.clip();
  const sp = E.outExpo(prog(lt, 0.3, 0.95));
  font(ctx, 'IS', 72); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = C.orange;
  ctx.fillText('Showreel — 2026', CX, lineY + 72 - (1 - sp) * 120);
  ctx.restore();

  // nerd stats
  const stats = `${FPS * DUR} FRAMES · ${FPS} FPS · ${BPM} BPM · 0 KEYFRAMES · 100% CODE`;
  ctx.save();
  font(ctx, 'JB', 18); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '5px';
  ctx.fillStyle = rgba(C.paper, 0.6);
  ctx.fillText(scramble(stats, prog(lt, 0.55, 1.15), Math.floor(lt * FPS)), CX, H - 120);
  ctx.restore();

  // iris close → the dot we started with
  const ip = E.inExpo(prog(lt, 1.42, 1.78));
  if (ip > 0) {
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(CX, CY, (1 - ip) * 1150, 0, TAU, true); ctx.fill();
  }
  const dp = E.outBack(prog(lt, 1.74, 1.85));
  if (dp > 0) { ctx.fillStyle = C.orange; circle(ctx, CX, CY, 20 * dp); ctx.fill(); }
}

// ═════════════════════════════════════════════ HUD + post
const SCENES = [sIntro, sType, sGrid, sSphere, sPanels, sTunnel, sWaves, sEnd];
const HITS = [
  [BAR, 1.1], [BAR * 2, 0.8], [BAR * 3, 0.8], [BAR * 4, 0.9], [BAR * 5, 1], [BAR * 6, 0.8], [BAR * 7, 1.4],
  [BAR + 2 * B, 0.5], [BAR * 3 + 1.25 * B, 0.45], [BAR * 3 + 2.25 * B, 0.45],
  [BAR * 5 + B, 0.5], [BAR * 5 + 2 * B, 0.5], [BAR * 5 + 3 * B, 0.6],
];
const impact = t => HITS.reduce((s, [h, w]) => (t >= h ? s + w * Math.exp(-(t - h) * 7) : s), 0);

function renderScene(ctx, t) {
  const i = Math.min(SCENES.length - 1, Math.floor(t / BAR));
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = 1; ctx.setLineDash([]);
  SCENES[i](ctx, t - i * BAR);
  ctx.restore();
}

function hud(ctx, t) {
  const on = E.outExpo(prog(t, BAR, BAR + 0.5)) * (1 - prog(t, BAR * 7, BAR * 7 + 0.15));
  if (on <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.strokeStyle = C.white; ctx.fillStyle = C.white; ctx.lineWidth = 2;
  const m = 40, a = 34 * on;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + sy * a); ctx.lineTo(x, y); ctx.lineTo(x + sx * a, y); ctx.stroke();
  }
  ctx.globalAlpha = on;
  font(ctx, 'JB', 16); ctx.letterSpacing = '3px'; ctx.textBaseline = 'middle';
  const f = Math.floor(t * FPS);
  const tc = `00:00:${String(Math.floor(f / FPS)).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`;
  ctx.textAlign = 'left'; ctx.fillText('REEL—2026', m + 48, m + 6);
  ctx.textAlign = 'right';
  ctx.fillText(`SC ${String(Math.min(8, Math.floor(t / BAR) + 1)).padStart(2, '0')}/08`, W - m - 48, m + 6);
  ctx.fillText(tc, W - m - 48, H - m - 6);
  ctx.textAlign = 'left'; ctx.fillText(`${BPM} BPM`, m + 48, H - m - 6);
  const beat = Math.floor(t / B) % 4;
  for (let k = 0; k < 4; k++) {
    if (k === beat) ctx.fillRect(m + 170 + k * 18, H - m - 12, 12, 12);
    else ctx.strokeRect(m + 171 + k * 18, H - m - 11, 10, 10);
  }
  ctx.fillRect(m + 270, H - m - 7, (W - 2 * m - 620) * (t / DUR), 2);
  ctx.restore();
}

function post(ctx, t, frame) {
  const imp = impact(t);
  // chromatic split on impacts
  const amt = imp * 14;
  if (amt > 0.6) {
    tctx.globalCompositeOperation = 'copy'; tctx.drawImage(ctx.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (const [col, dx] of [['#f00', -amt], ['#0f0', 0], ['#00f', amt]]) {
      chctx.globalCompositeOperation = 'copy'; chctx.drawImage(tmp, dx, dx * 0.25);
      chctx.globalCompositeOperation = 'multiply'; chctx.fillStyle = col; chctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(chan, 0, 0);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(vignette, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.09;
  ctx.drawImage(grains[frame % grains.length], 0, 0, W, H);
  ctx.restore();
}

// motion-blurred frame: average `sub` sub-frames across a 180° shutter
function renderFrame(ctx, t, sub = 1, frame = Math.round(t * FPS)) {
  const shutter = 0.5 / FPS;
  for (let s = 0; s < sub; s++) {
    const ts = Math.min(DUR - 1e-4, t + (sub > 1 ? (s / sub) * shutter : 0));
    renderScene(sctx, ts);
    actx.globalAlpha = 1 / (s + 1);
    actx.drawImage(scene, 0, 0);
  }
  actx.globalAlpha = 1;
  const imp = impact(t);
  const shx = noise1(t * 30) * imp * 16, shy = noise1(t * 30 + 50) * imp * 16;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const z = 1 + Math.min(imp, 1) * 0.02;
  ctx.drawImage(accum, CX - CX * z + shx, CY - CY * z + shy, W * z, H * z);
  post(ctx, t, frame);
  hud(ctx, t);
}

// ═════════════════════════════════════════════ boot
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const ready = Promise.all(['900 40px UB', '300 40px UL', '500 40px SG', '500 40px JB', 'italic 40px IS']
  .map(f => document.fonts.load(f))).then(buildStatic);

const RENDER = new URLSearchParams(location.search).has('render');
window.reel = {
  FPS, DUR, ready,
  async frame(f, sub = 4, type = 'image/jpeg', q = 0.95) {
    await ready;
    renderFrame(ctx, f / FPS, sub, f);
    return canvas.toDataURL(type, q);
  },
};

if (RENDER) { document.body.classList.add('render'); return; }

ready.then(() => {
  const audio = new Audio('soundtrack.wav');
  let start = performance.now();
  const play = document.getElementById('play');
  play.onclick = () => { play.style.display = 'none'; audio.currentTime = 0; audio.play().catch(() => {}); start = performance.now(); };
  audio.onended = () => { audio.currentTime = 0; audio.play(); };
  const loop = () => {
    const t = !audio.paused ? audio.currentTime % DUR : ((performance.now() - start) / 1000) % DUR;
    renderFrame(ctx, t, 1);
    requestAnimationFrame(loop);
  };
  loop();
});
})();

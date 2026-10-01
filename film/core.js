// Scorpion Bits — brand film · core engine
// Pure functions of time. Shared helpers for every chapter: math, easing, colour, type, 3D, isometric cubes,
// image/text → particles, HUD and the finishing layer (motion blur, bloom, grain, RGB split, shake).
(function () {
'use strict';
const { B, BAR, FPS, DUR, CH } = TL;
const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const TAU = Math.PI * 2;

// ─── palette (from scorpionbits.com CSS + pixels of the official mark)
const P = {
  ink: '#05090f', ink2: '#080e16', ink3: '#0c141f', ink4: '#111c2a',
  navy: '#0c2430', face: '#0c3048', deep: '#3c90c0',
  cyan: '#60d8fc', sky: '#48a8f0', azure: '#48c0e4', indigo: '#5490fc', ice: '#90e4fc', lilac: '#84b4fc',
  violet: '#8b5cf6', amber: '#ffc46b', mint: '#7ee2a8', red: '#ff5a5f',
  text: '#eef5fb', soft: '#b4c6d7', dim: '#7d94aa', faint: '#55697d', white: '#ffffff',
};

// ─── math
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const smooth = f => f * f * (3 - 2 * f);
const fract = x => x - Math.floor(x);
const E = {
  lin: t => t,
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: t => 1 - Math.pow(1 - t, 5),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  outElastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};
// damped spring step response (anticipation-free overshoot), t in seconds
const spring = (t, f = 9, d = 7) => (t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(f * t));
const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const hash2 = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const hash3 = (x, y, z) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
const noise1 = x => { const i = Math.floor(x); return lerp(hash(i), hash(i + 1), smooth(x - i)) * 2 - 1; };
const noise2 = (x, y) => {
  const ix = Math.floor(x), iy = Math.floor(y), ux = smooth(x - ix), uy = smooth(y - iy);
  return lerp(lerp(hash2(ix, iy), hash2(ix + 1, iy), ux), lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), ux), uy) * 2 - 1;
};
const noise3 = (x, y, z) => {
  const iz = Math.floor(z), uz = smooth(z - iz);
  return lerp(noise2(x + iz * 17.3, y - iz * 9.1), noise2(x + (iz + 1) * 17.3, y - (iz + 1) * 9.1), uz);
};
const fbm2 = (x, y, o = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * noise2(x * f, y * f); a *= 0.5; f *= 2.03; } return s; };
// curl-ish flow from a scalar noise potential
const flow = (x, y, t) => {
  const e = 0.01, n = (a, b) => noise3(a, b, t);
  return [(n(x, y + e) - n(x, y - e)) / (2 * e), -(n(x + e, y) - n(x - e, y)) / (2 * e)];
};
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const beatPulse = (t, k = 8, from = 0, len = B) => (t < from ? 0 : Math.exp(-((t - from) % len) * k));

// ─── colour
const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgba = (h, a = 1) => { const [r, g, b] = hexRGB(h); return `rgba(${r},${g},${b},${clamp(a)})`; };
const mix = (h1, h2, t, a = 1) => {
  const p = hexRGB(h1), q = hexRGB(h2);
  return `rgba(${Math.round(lerp(p[0], q[0], t))},${Math.round(lerp(p[1], q[1], t))},${Math.round(lerp(p[2], q[2], t))},${clamp(a)})`;
};

// ─── canvas helpers
const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const bg = (ctx, col = P.ink) => { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); };
const FAM = { SG: 'SG', IN: 'IN', JB: 'JB' };
const font = (ctx, fam, px, wght = 400) => { ctx.font = `${Math.round(wght)} ${px}px ${FAM[fam] || fam}`; };
const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); };
const seg = (ctx, x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
const reset = ctx => {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none'; ctx.setLineDash([]); ctx.lineWidth = 1; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px'; ctx.shadowBlur = 0;
};

// soft glowing dot (cheap bloom-in-place)
function glow(ctx, x, y, r, col, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(0.35, rgba(col, a * 0.35)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ─── typography
// letters of `text` laid out around cx with tracking (px); returns [{ch, x, w}]
function layout(ctx, text, cx, track = 0, align = 'center') {
  const chars = [...text];
  const ws = chars.map(ch => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + track * (ws.length - 1);
  let x = align === 'center' ? cx - total / 2 : align === 'right' ? cx - total : cx;
  return chars.map((ch, i) => { const o = { ch, x: x + ws[i] / 2, w: ws[i], i }; x += ws[i] + track; return o; });
}
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>*+=_';
function scramble(text, p, seed = 0) {
  const n = [...text].length;
  return [...text].map((ch, i) => {
    if (ch === ' ' || p * (n + 4) - 4 > i) return ch;
    if (p * (n + 4) < i) return '';
    return GLYPHS[Math.floor(hash(seed * 0.37 + i * 13.7) * GLYPHS.length)];
  }).join('');
}
const typed = (text, p) => [...text].slice(0, Math.floor(clamp(p) * [...text].length + 1e-6)).join('');

// mono label: [— LABEL] with drawn rule; used for HUD and captions
function label(ctx, text, x, y, a = 1, col = P.soft, size = 15, align = 'left') {
  ctx.save(); font(ctx, 'JB', size, 500); ctx.letterSpacing = '3px';
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = rgba(col, a); ctx.fillText(text, x, y); ctx.restore();
}

// ─── sampling: text / images → point clouds (cached)
const _cache = new Map();
function textPoints(text, fam, wght, size, step = 6, track = 0) {
  const key = `T|${text}|${fam}|${wght}|${size}|${step}|${track}`;
  if (_cache.has(key)) return _cache.get(key);
  const c = mk(W * 2, size * 2), x = c.getContext('2d', { willReadFrequently: true });
  font(x, fam, size, wght); x.letterSpacing = `${track}px`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#fff'; x.fillText(text, W, size);
  const d = x.getImageData(0, 0, c.width, c.height).data, pts = [];
  for (let yy = 0; yy < c.height; yy += step) for (let xx = 0; xx < c.width; xx += step) {
    if (d[(yy * c.width + xx) * 4 + 3] > 128) pts.push({ x: xx - W, y: yy - size, r: hash2(xx, yy) });
  }
  _cache.set(key, pts); return pts;
}
function imagePoints(img, step = 6, h = 400) {
  const key = `I|${img.src}|${step}|${h}`;
  if (_cache.has(key)) return _cache.get(key);
  const s = h / img.height, w = Math.round(img.width * s);
  const c = mk(w, h), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, pts = [];
  for (let yy = 0; yy < h; yy += step) for (let xx = 0; xx < w; xx += step) {
    const k = (yy * w + xx) * 4;
    if (d[k + 3] > 160) pts.push({ x: xx - w / 2, y: yy - h / 2, c: `rgb(${d[k]},${d[k + 1]},${d[k + 2]})`, rgb: [d[k], d[k + 1], d[k + 2]], r: hash2(xx, yy) });
  }
  _cache.set(key, pts); return pts;
}

// ─── brand images
const IMG = {};
function loadImg(name, src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[name] = i; res(); }; i.onerror = rej; i.src = src; }); }
// draw the official mark at height h, centred — proportions always preserved
function drawMark(ctx, x, y, h, a = 1, which = 'mark') {
  const img = IMG[which]; if (!img || a <= 0) return;
  const w = h * img.width / img.height;
  ctx.save(); ctx.globalAlpha *= a; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, x - w / 2, y - h / 2, w, h); ctx.restore();
}

// ─── 3D
// camera: {x,y,z, yaw, pitch, roll, f}; returns [sx, sy, scale, depth] or null when behind
function cam(c) {
  const cy = Math.cos(c.yaw || 0), sy = Math.sin(c.yaw || 0), cp = Math.cos(c.pitch || 0), sp = Math.sin(c.pitch || 0);
  const cr = Math.cos(c.roll || 0), sr = Math.sin(c.roll || 0), f = c.f || 900, ox = c.cx ?? CX, oy = c.cy ?? CY;
  return (x, y, z) => {
    x -= c.x || 0; y -= c.y || 0; z -= c.z || 0;
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    if (z2 <= 1) return null;
    const x3 = x1 * cr - y2 * sr, y3 = x1 * sr + y2 * cr;
    const s = f / z2;
    return [ox + x3 * s, oy + y3 * s, s, z2];
  };
}
const rotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c]; };
const rotX = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
const rotZ = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };

// ─── isometric
const ISO = { cx: Math.cos(Math.PI / 6), sy: 0.5 };
// grid (i, j, k) → screen offset for cube edge length s
const iso = (i, j, k, s) => [(i - j) * ISO.cx * s, (i + j) * ISO.sy * s - k * s];
// the brand cube: three faces in the mark's palette, dark outline like the logo
const CUBE_PAL = {
  brand: { top: [P.lilac, P.indigo], left: [P.cyan, P.azure], right: [P.face, P.navy], line: P.navy },
  mid: { top: ['#3a6fae', '#2f5f9c'], left: ['#2f86b8', '#2a78a6'], right: ['#0c2a42', '#0a2236'], line: '#0c2430' },
  ghost: { top: ['#1a2b40', '#14233a'], left: ['#13243a', '#0f1d30'], right: ['#0b1626', '#09121f'], line: '#24405e' },
  white: { top: ['#ffffff', '#e8f6ff'], left: ['#d8f2ff', '#c4e8ff'], right: ['#9cc8e8', '#86b6da'], line: '#0c2430' },
  amber: { top: ['#ffe2a8', '#ffc46b'], left: ['#ffc46b', '#f0a94a'], right: ['#7a4a1a', '#5a3410'], line: '#2a1a08' },
  mint: { top: ['#c4f5d8', '#7ee2a8'], left: ['#7ee2a8', '#5cc890'], right: ['#1f5a40', '#164430'], line: '#0c2a1e' },
};
function isoCube(ctx, x, y, s, pal = CUBE_PAL.brand, a = 1, lw = null) {
  if (a <= 0 || s <= 0.3) return;
  const hx = ISO.cx * s, hy = ISO.sy * s;
  ctx.save(); ctx.globalAlpha *= a; ctx.lineJoin = 'round';
  const flat = s < 6;
  // top
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + hx, y - s + hy); ctx.lineTo(x, y); ctx.lineTo(x - hx, y - s + hy); ctx.closePath();
  ctx.fillStyle = pal.top[0]; ctx.fill();
  // left
  ctx.beginPath(); ctx.moveTo(x - hx, y - s + hy); ctx.lineTo(x, y); ctx.lineTo(x, y + s); ctx.lineTo(x - hx, y + hy); ctx.closePath();
  ctx.fillStyle = pal.left[0]; ctx.fill();
  // right
  ctx.beginPath(); ctx.moveTo(x + hx, y - s + hy); ctx.lineTo(x, y); ctx.lineTo(x, y + s); ctx.lineTo(x + hx, y + hy); ctx.closePath();
  ctx.fillStyle = pal.right[0]; ctx.fill();
  if (!flat) {
    // sheen like the mark's top face
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + hx, y - s + hy); ctx.lineTo(x + hx * 0.3, y - s + hy * 1.3); ctx.lineTo(x - hx * 0.55, y - s + hy * 0.45); ctx.closePath();
    ctx.fillStyle = rgba('#ffffff', 0.12); ctx.fill();
    ctx.strokeStyle = pal.line; ctx.lineWidth = lw ?? Math.max(1, s * 0.09);
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.lineTo(x + hx, y - s + hy); ctx.lineTo(x + hx, y + hy); ctx.lineTo(x, y + s); ctx.lineTo(x - hx, y + hy); ctx.lineTo(x - hx, y - s + hy); ctx.closePath();
    ctx.moveTo(x - hx, y - s + hy); ctx.lineTo(x, y); ctx.lineTo(x + hx, y - s + hy); ctx.moveTo(x, y); ctx.lineTo(x, y + s);
    ctx.stroke();
  }
  ctx.restore();
}
// wireframe cube in 3D (for morphs/rotations) — edges list
const CUBE_V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const CUBE_E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
const ISO_YAW = Math.PI / 4, ISO_PITCH = Math.atan(1 / Math.SQRT2);

// ─── HUD
function hud(ctx, t, opts = {}) {
  const c = chapterAt(t), lt = t - CH[c], len = CH[c + 1] - CH[c];
  const a = (opts.a ?? 1) * (opts.instant ? 1 : E.outCubic(prog(lt, 0.2, 1.0))) * (opts.hold ? 1 : 1 - prog(lt, len - 0.4, len));
  if (a <= 0.01) return;
  ctx.save();
  const m = 44;
  ctx.strokeStyle = rgba(P.soft, 0.35 * a); ctx.lineWidth = 1.5;
  const arm = 22;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + sy * arm); ctx.lineTo(x, y); ctx.lineTo(x + sx * arm, y); ctx.stroke();
  }
  drawMark(ctx, m + 40, m + 22, 34, 0.9 * a);
  label(ctx, 'SCORPION BITS', m + 68, m + 23, 0.75 * a, P.text, 14);
  const ttl = `${String(c + 1).padStart(2, '0')} / 10 — ${TL.TITLES[c]}`;
  label(ctx, scramble(ttl, prog(lt, 0.2, 1.1), Math.floor(t * FPS)), W - m - 30, m + 23, 0.75 * a, P.text, 14, 'right');
  const f = Math.floor(t * FPS);
  const tc = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`;
  label(ctx, tc, m + 30, H - m - 22, 0.6 * a, P.soft, 13);
  if (opts.word) label(ctx, opts.word, W - m - 30, H - m - 22, 0.6 * a, P.cyan, 13, 'right');
  // film progress
  ctx.fillStyle = rgba(P.soft, 0.18 * a); ctx.fillRect(m + 140, H - m - 23, W - 2 * m - 420, 1);
  ctx.fillStyle = rgba(P.cyan, 0.7 * a); ctx.fillRect(m + 140, H - m - 23, (W - 2 * m - 420) * t / DUR, 1);
  ctx.restore();
}
const chapterAt = t => { for (let i = CH.length - 2; i >= 0; i--) if (t >= CH[i]) return i; return 0; };

// caption: statement in Inter, masked rise per line; lines = [{text, size, wght, col}]
function statement(ctx, lines, x, y, lt, t0, t1, opts = {}) {
  const align = opts.align || 'left';
  let yy = y;
  lines.forEach((L, i) => {
    const size = L.size || 44, d = t0 + i * (opts.stagger ?? 0.12);
    const p = E.outExpo(prog(lt, d, d + 0.9)), q = E.inExpo(prog(lt, t1 + i * 0.05, t1 + 0.45 + i * 0.05));
    if (p <= 0 || q >= 1) { yy += size * 1.25; return; }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, yy - size * 1.05, W, size * 1.4); ctx.clip();
    font(ctx, L.fam || 'IN', size, L.wght || 400); ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    if (L.track) ctx.letterSpacing = `${L.track}px`;
    ctx.fillStyle = rgba(L.col || P.text, 1);
    ctx.fillText(L.text, x, yy + (1 - p) * size * 1.2 - q * size * 1.2);
    ctx.restore();
    yy += size * (L.lh || 1.25);
  });
}

// isometric floor grid (the tilemap motif): two line families at ±30°
function isoGrid(ctx, s, ox, oy, a, col = P.soft, lw = 1) {
  if (a <= 0) return;
  // simpler, robust version: draw lines through lattice points
  ctx.save(); ctx.strokeStyle = rgba(col, a); ctx.lineWidth = lw; ctx.beginPath();
  const dx = Math.cos(Math.PI / 6), dy = Math.sin(Math.PI / 6), L = 3000;
  const pitch = s; // spacing between parallel lines measured vertically = s
  const n = Math.ceil((H + W * dy) / pitch) + 4;
  const offA = ((oy + ox * dy / dx) % pitch + pitch) % pitch, offB = ((oy - ox * dy / dx) % pitch + pitch) % pitch;
  for (let i = -n; i <= n; i++) {
    const ya = offA + i * pitch; ctx.moveTo(-L * dx, ya + L * dy); ctx.lineTo(L * dx, ya - L * dy);
    const yb = offB + i * pitch; ctx.moveTo(-L * dx, yb - L * dy); ctx.lineTo(L * dx, yb + L * dy);
  }
  ctx.stroke(); ctx.restore();
}

window.CORE = {
  W, H, CX, CY, TAU, P, clamp, lerp, prog, smooth, fract, E, spring, hash, hash2, hash3, noise1, noise2, noise3, fbm2, flow, rng, beatPulse,
  hexRGB, rgba, mix, mk, bg, font, circle, seg, reset, glow, layout, scramble, typed, label, textPoints, imagePoints,
  IMG, loadImg, drawMark, cam, rotX, rotY, rotZ, ISO, iso, isoCube, CUBE_PAL, CUBE_V, CUBE_E, ISO_YAW, ISO_PITCH,
  hud, chapterAt, statement, isoGrid,
};
})();

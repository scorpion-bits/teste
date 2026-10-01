// Scorpion Bits — brand film · soundtrack
// Synthesised sample-by-sample on the same master clock as the picture (timeline.js): 96 BPM, D minor, 300.000 s.
// Every cue in the timeline gets its own sound; the music bed follows the chapter structure.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const DIR = path.dirname(fileURLToPath(import.meta.url));
const TL = require(path.join(DIR, 'timeline.js'));
const { B, BAR, DUR, CH } = TL;
const SR = 48000, N = SR * DUR, S16 = B / 4;
const L = new Float32Array(N), R = new Float32Array(N), VL = new Float32Array(N), VR = new Float32Array(N);
const GATE = new Float32Array(N).fill(1);
const TAU = Math.PI * 2;
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

class Biquad {
  constructor(type) { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  set(f, q = 0.707) {
    const w = TAU * Math.min(Math.max(f, 10), SR * 0.45) / SR, c = Math.cos(w), a = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a; this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - a) / a0; return this;
  }
  run(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}
function voice(t0, len, fn, { gain = 1, pan = 0, send = 0 } = {}) {
  const s0 = Math.round(t0 * SR), n = Math.round(len * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const k = s0 + i; if (k < 0) continue; if (k >= N) break;
    const v = fn(i / SR, i); L[k] += v * gl; R[k] += v * gr;
    if (send) { VL[k] += v * gl * send; VR[k] += v * gr * send; }
  }
}

// ─── instruments
function kick(t0, g = 1) { let ph = 0; voice(t0, 0.5, t => { ph += TAU * (42 + 120 * Math.exp(-t * 30)) / SR; return Math.tanh(Math.sin(ph) * Math.exp(-t * 6.5) * Math.min(1, t / 0.002) * 2.2) * 0.85 + rnd() * Math.exp(-t * 380) * 0.2; }, { gain: g }); }
function clap(t0, g = 1, pan = 0) { const bp = new Biquad('bp').set(1500, 0.9); voice(t0, 0.4, t => { const b = [0, 0.011, 0.022].reduce((s, o) => s + (t >= o ? Math.exp(-(t - o) * 150) : 0), 0); return bp.run(rnd()) * (b * 0.7 + Math.exp(-t * 13) * 0.5) * 2.2; }, { gain: g, pan, send: 0.35 }); }
function hat(t0, open = false, g = 1, pan = 0) { const hp = new Biquad('hp').set(8000, 0.8); voice(t0, open ? 0.3 : 0.06, t => hp.run(rnd()) * Math.exp(-t * (open ? 11 : 75)), { gain: g, pan }); }
function bass(t0, len, m, g = 1, cut = 1100) { const lp = new Biquad('lp'), f = mtof(m); let p1 = 0, p2 = 0; voice(t0, len, t => { p1 = (p1 + f / SR) % 1; p2 = (p2 + f * 1.006 / SR) % 1; lp.set(140 + cut * Math.exp(-t * 12), 1.5); const env = Math.min(1, t / 0.004) * Math.min(1, (len - t) / 0.02); return (lp.run((p1 + p2 - 1) * 0.5) * 0.85 + Math.sin(TAU * f * t) * 0.55) * env; }, { gain: g }); }
function pluck(t0, m, g = 1, pan = 0, decay = 7, send = 0.35) { const lp = new Biquad('lp'), f = mtof(m); let p1 = 0, p2 = 0; voice(t0, 0.7, t => { p1 = (p1 + f / SR) % 1; p2 = (p2 + f * 1.008 / SR) % 1; lp.set(300 + 5200 * Math.exp(-t * 15), 2.4); return lp.run((p1 + p2 - 1) * 0.7) * Math.exp(-t * decay) * Math.min(1, t / 0.002); }, { gain: g, pan, send }); }
function pad(t0, len, notes, g = 1, att = 0.6, rel = 0.8, cut = 1500) {
  notes.forEach(m => [-1, 1].forEach(side => {
    const lp = new Biquad('lp').set(cut, 0.7), f = mtof(m) * (1 + side * 0.004); let p = hash(m + side) ;
    voice(t0, len, t => { p = (p + f / SR) % 1; const env = Math.min(1, t / att) * Math.min(1, Math.max(0, (len - t) / rel)); return lp.run(p * 2 - 1) * env * 0.13; }, { gain: g, pan: side * 0.6, send: 0.5 });
  }));
}
function ep(t0, len, notes, g = 1) { // FM electric piano for the human chapter
  notes.forEach((m, i) => { const f = mtof(m); voice(t0 + i * 0.02, len, t => { const mod = Math.sin(TAU * f * t) * 1.2 * Math.exp(-t * 3); return Math.sin(TAU * f * t + mod) * Math.exp(-t * 0.9) * Math.min(1, t / 0.005) * Math.min(1, (len - t) / 0.3) * 0.18; }, { gain: g, pan: (i % 2 ? 0.3 : -0.3), send: 0.55 }); });
}
function square(t0, len, m, g = 1, pan = 0) { const f = mtof(m); let p = 0; voice(t0, len, t => { p = (p + f / SR) % 1; return (p < 0.5 ? 1 : -1) * 0.12 * Math.exp(-t * 4) * Math.min(1, (len - t) / 0.01); }, { gain: g, pan, send: 0.2 }); }
function impact(t0, g = 1, len = 1.8) {
  let ph = 0; voice(t0, len, t => { ph += TAU * (30 + 70 * Math.exp(-t * 5)) / SR; return Math.sin(ph) * Math.exp(-t * 2.4) * 0.9; }, { gain: g });
  const hp = new Biquad('hp').set(2500, 0.6); voice(t0, len, t => hp.run(rnd()) * Math.exp(-t * 3.2) * 0.42, { gain: g, send: 0.6 });
}
function riser(t0, len, g = 1) { const bp = new Biquad('bp'); let ph = 0; voice(t0, len, t => { const p = t / len; bp.set(300 * Math.pow(30, p), 4); ph += TAU * (220 * Math.pow(5, p)) / SR; return (bp.run(rnd()) * 1.4 + Math.sin(ph) * 0.12) * p * p; }, { gain: g, send: 0.3 }); }
function swell(tEnd, len, g = 1) { const hp = new Biquad('hp').set(1200, 0.7); voice(tEnd - len, len, t => hp.run(rnd()) * Math.pow(t / len, 3) * 0.6, { gain: g, send: 0.5 }); }
function ping(t0, f, g = 1, pan = 0, k = 9) { voice(t0, 1.2, t => Math.sin(TAU * f * t + Math.sin(TAU * f * 2 * t) * Math.exp(-t * 30)) * Math.exp(-t * k), { gain: g, pan, send: 0.55 }); }
function whoosh(t0, len, g = 1) { const bp = new Biquad('bp'); voice(t0, len, t => { const p = t / len; bp.set(400 + 4000 * Math.sin(Math.PI * p), 1.2); return bp.run(rnd()) * Math.sin(Math.PI * p) ** 2; }, { gain: g, send: 0.3 }); }
function click(t0, g = 1) { const hp = new Biquad('hp').set(3000, 1); voice(t0, 0.04, t => (hp.run(rnd()) * 0.6 + Math.sin(TAU * 2200 * t) * 0.5) * Math.exp(-t * 180), { gain: g, send: 0.15 }); }
function tick(t0, f = 2400, g = 1) { voice(t0, 0.05, t => Math.sin(TAU * f * t) * Math.exp(-t * 120), { gain: g, pan: (hash(t0 * 7) - 0.5) * 1.2, send: 0.2 }); }
function thump(t0, g = 1) { let ph = 0; voice(t0, 0.6, t => { ph += TAU * (50 + 60 * Math.exp(-t * 20)) / SR; return Math.sin(ph) * Math.exp(-t * 7) * 1.1; }, { gain: g, send: 0.15 }); }
function glide(t0, len, f0, f1, g = 1) { let ph = 0; voice(t0, len, t => { const p = t / len; ph += TAU * f0 * Math.pow(f1 / f0, p) / SR; return Math.sin(ph) * Math.sin(Math.PI * p) * 0.4; }, { gain: g, send: 0.4 }); }
function stamp(t0, g = 1) { thump(t0, g * 0.8); const bp = new Biquad('bp').set(900, 1.4); voice(t0, 0.25, t => bp.run(rnd()) * Math.exp(-t * 22) * 1.2, { gain: g, send: 0.3 }); }
function typeKey(t0, g = 1) { const bp = new Biquad('bp').set(2600 + hash(t0) * 1200, 3); voice(t0, 0.05, t => bp.run(rnd()) * Math.exp(-t * 140) * 2, { gain: g, pan: (hash(t0 * 3) - 0.5) * 0.8 }); }
function glitch(t0, len, g = 1) { const n = Math.floor(len / 0.03); for (let k = 0; k < n; k++) if (hash(t0 + k) > 0.45) { const f = 200 + hash(k * 9 + t0) * 4000, tt = t0 + k * 0.03; voice(tt, 0.028, t => (Math.sign(Math.sin(TAU * f * t)) * 0.3 + rnd() * 0.2), { gain: g * 0.5, pan: hash(k) - 0.5 }); } }
function sweepFx(t0, len, g = 1) { const bp = new Biquad('bp'); voice(t0, len, t => { const p = t / len; bp.set(200 * Math.pow(40, p), 6); return bp.run(rnd()) * Math.sin(Math.PI * p) * 1.5; }, { gain: g, send: 0.4 }); }
function drop(t0, g = 1) { let ph = 0; voice(t0, 1.4, t => { ph += TAU * (120 * Math.exp(-t * 2.5) + 30) / SR; return Math.sin(ph) * Math.exp(-t * 2) * 0.9; }, { gain: g, send: 0.3 }); }
function chime(t0, g = 1) { [74, 81, 86].forEach((m, i) => ping(t0 + i * 0.04, mtof(m), g * 0.6, (i - 1) * 0.4, 3)); }
function boing(t0, clean, g = 1) { let ph = 0; voice(t0, 0.35, t => { const wob = (1 - clean) * Math.sin(t * 90) * 0.25; ph += TAU * (220 + 440 * Math.exp(-t * 9)) * (1 + wob) / SR; const nz = (1 - clean) * rnd() * 0.25; return (Math.sin(ph) + nz) * Math.exp(-t * 9); }, { gain: g, send: 0.25 }); }
function drip(t0, g = 1) { let ph = 0; voice(t0, 0.3, t => { ph += TAU * (1600 * Math.exp(-t * 18) + 500) / SR; return Math.sin(ph) * Math.exp(-t * 16); }, { gain: g, send: 0.6, pan: (hash(t0) - 0.5) }); }
function rain(t0, len, g = 1) { const bp = new Biquad('bp').set(3500, 0.5); voice(t0, len, t => bp.run(rnd()) * (0.4 + 0.6 * (rnd() > 0.995 ? 1 : 0.3)) * Math.min(1, t / 0.3) * Math.min(1, (len - t) / 0.3) * 0.4, { gain: g, send: 0.2 }); }
function morph(t0, g = 1) { sweepFx(t0 - 0.6, 0.9, g * 0.6); thump(t0, g * 0.7); }
function implode(t0, len, g = 1) { const lp = new Biquad('lp'); voice(t0, len, t => { const p = t / len; lp.set(200 + 8000 * p * p, 1.5); return lp.run(rnd()) * p * p * p * 1.2; }, { gain: g, send: 0.4 }); thump(t0 + len, g); }
function pen(t0, len, g = 1) { const bp = new Biquad('bp').set(5000, 1.5); voice(t0, len, t => bp.run(rnd()) * (0.5 + 0.5 * Math.sin(t * 23) * Math.sin(t * 7.3)) * 0.35 * Math.min(1, t / 0.1) * Math.min(1, (len - t) / 0.1), { gain: g }); }
function drone(t0, len, m, g = 1) { const lp = new Biquad('lp').set(500, 0.8); voice(t0, len, t => { const f = mtof(m); const v = Math.sin(TAU * f * t) * 0.5 + Math.sin(TAU * f * 2.003 * t) * 0.25 + Math.sin(TAU * f * 0.5 * t) * 0.35; return lp.run(v) * Math.min(1, t / 3) * Math.min(1, (len - t) / 2) * (0.8 + 0.2 * Math.sin(t * 0.7)); }, { gain: g, send: 0.3 }); }
function grains(t0, len, g = 1, dens0 = 4, dens1 = 40) { let t = t0; while (t < t0 + len) { const p = (t - t0) / len, d = dens0 + (dens1 - dens0) * p * p; const f = mtof(62 + Math.floor(hash(t * 13) * 5) * 3 + 12 * Math.floor(hash(t * 7) * 2)); const tt = t; voice(tt, 0.06, x => Math.sin(TAU * f * x) * Math.sin(Math.PI * x / 0.06) ** 2 * 0.25, { gain: g, pan: hash(tt * 3) * 2 - 1, send: 0.4 }); t += 1 / d; } }
function silence(t0, len) { const s0 = Math.round(t0 * SR), n = Math.round(len * SR), r = Math.round(0.004 * SR); for (let i = -r; i < n + r; i++) { const k = s0 + i; if (k < 0 || k >= N) continue; const e = i < 0 ? -i / r : i >= n ? (i - n) / r : 0; GATE[k] = Math.min(GATE[k], e); } }

// ─── harmony: i – VI – III – VII in D minor, one chord per bar
const PROG = [
  { root: 38, pad: [50, 53, 57, 64], arp: [62, 65, 69, 74] },
  { root: 34, pad: [46, 50, 53, 60], arp: [58, 62, 65, 70] },
  { root: 41, pad: [53, 57, 60, 67], arp: [65, 69, 72, 77] },
  { root: 36, pad: [48, 52, 55, 62], arp: [60, 64, 67, 72] },
];
const chordAt = t => PROG[Math.floor(t / BAR) % 4];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 2];

// a bar of groove: k=kick pattern, c=clap, h=hat level, b=bass level, a=arp level, p=pad level
function groove(t0, t1, o) {
  for (let t = t0; t < t1 - 1e-6; t += BAR) {
    const ch = chordAt(t + 0.01);
    for (let s = 0; s < 16; s++) {
      const ts = t + s * S16; if (ts >= t1) break;
      if (o.k && o.k.includes(s)) kick(ts, o.kg ?? 0.9);
      if (o.c && o.c.includes(s)) clap(ts, o.cg ?? 0.45);
      if (o.h) { hat(ts + (o.swing && s % 2 ? 0.02 : 0), false, o.h * (s % 4 === 2 ? 1.3 : s % 2 ? 0.8 : 0.55), s % 2 ? 0.3 : -0.3); if (s % 4 === 2 && o.oh) hat(ts, true, o.oh, 0.2); }
      if (o.b && s % 2 === 0 && !(o.k && o.k.includes(s) && s === 0)) bass(ts, S16 * 2 - 0.01, ch.root + (s % 8 === 6 ? 12 : 0), o.b, o.bc ?? 1000);
      if (o.a) pluck(ts, ch.arp[ARP[s]] + (o.aUp && s >= 12 ? 12 : 0), o.a, s % 2 ? 0.45 : -0.45);
    }
    if (o.p) pad(t, BAR + 0.05, ch.pad, o.p, 0.3, 0.3, o.pc ?? 1500);
  }
}
const KA = [0, 6, 8], K4 = [0, 4, 8, 12], CL = [4, 12];

// ─── score
const [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10] = CH;
// CH01 — near silence → signal → system → the mark
drone(1.5, 23.5, 26, 0.6);
groove(c1 + 12.5, c1 + 20, { k: [0, 8], kg: 0.45, h: 0.04 });
groove(c1 + 15, c1 + 20, { h: 0.07 });
grains(c1 + 10, 10, 0.5, 6, 70);
swell(TL.c1.logo, 1.4, 0.9);
pad(TL.c1.logo, 3.9, [38, 50, 53, 57, 64, 69], 0.9, 0.05, 1.5);
// CH02 — the studio: the groove arrives
groove(c2, c2 + 10, { k: KA, c: CL, h: 0.08, b: 0.42, p: 0.35 });
groove(c2 + 10, c3, { k: KA, c: CL, h: 0.1, oh: 0.07, b: 0.45, a: 0.13, p: 0.3 });
// CH03 — chaos, then order, then three clean tones, then the test loop
groove(c3, TL.c3.few, { k: KA, c: CL, h: 0.1, b: 0.45, bc: 1600, p: 0.25 });
for (let t = c3; t < TL.c3.sorted; t += 0.07) { // data blips: random timing that snaps to the grid as the scan passes
  const order = clamp((t - TL.c3.scan) / (TL.c3.sorted - TL.c3.scan));
  const grid = Math.round(t / S16) * S16, tt = t + (grid - t) * order + (1 - order) * (hash(t * 9) - 0.5) * 0.05;
  if (hash(t * 3.3) > 0.55 - order * 0.3) ping(tt, mtof(order > 0.5 ? chordAt(tt).arp[Math.floor(hash(t) * 4)] + 12 : 70 + Math.floor(hash(t * 5) * 18)), 0.07, hash(t * 7) * 2 - 1, 30);
}
[74, 77, 81].forEach((m, i) => ping(TL.c3.few + 0.4 + i * 0.6, mtof(m), 0.35, (i - 1) * 0.5, 2));
pad(TL.c3.few, TL.c3.test - TL.c3.few + 0.5, [38, 50, 57, 62], 0.6, 1, 1, 900);
groove(TL.c3.test, c4, { h: 0.06, k: [0], kg: 0.5 });
// CH04 — the pipeline: each stage adds a layer
groove(c4, c4 + 5, { k: [0, 8], kg: 0.6, h: 0.05, p: 0.3 });
groove(c4 + 5, c4 + 10, { k: KA, c: CL, h: 0.07, b: 0.35 });
for (let t = c4 + 5; t < c4 + 10; t += S16 * 2) click(t, 0.18);
groove(c4 + 10, c4 + 15, { k: KA, c: CL, h: 0.09, b: 0.42, bc: 1400 });
for (let t = c4 + 10; t < c4 + 15; t += S16) if (hash(t) > 0.5) tick(t, 600 + hash(t * 3) * 300, 0.12);
groove(c4 + 15, c4 + 20, { h: 0.05, b: 0.3 });
groove(c4 + 20, c4 + 25, { k: KA, c: CL, h: 0.09, b: 0.42 });
groove(c4 + 25, c5, { k: K4, c: CL, h: 0.1, oh: 0.06, b: 0.45, p: 0.25 });
[74, 77, 81, 77, 74, 72, 74, 69, 74, 77, 81, 84, 86, 84, 81, 77].forEach((m, k) => { square(c4 + 25 + k * S16 * 2, S16 * 2 - 0.02, m, 0.9, 0.1); });
// CH05 — technology: the biggest bed
groove(c5, c5 + 5, { k: K4, kg: 0.95, h: 0.08, b: 0.5, p: 0.45, pc: 2200 });
groove(c5 + 5, c5 + 25, { k: K4, c: CL, h: 0.11, oh: 0.07, b: 0.5, a: 0.15, aUp: true, p: 0.4, pc: 2400 });
groove(c5 + 25, c6, { h: 0.06, a: 0.12, p: 0.45, pc: 1200 });
drone(c5, 30, 26, 0.5);
// CH06 — what the studio builds
groove(c6, c6 + 7.5, { k: KA, c: CL, h: 0.08, b: 0.4, p: 0.3 });
groove(c6 + 7.5, c6 + 22.5, { k: [0, 8], kg: 0.7, h: 0.06, b: 0.32 });
groove(c6 + 22.5, c7, { k: KA, c: CL, h: 0.08, b: 0.38, a: 0.1, p: 0.35 });
// CH07 — the system in motion: drive, accelerate, peak, silence
groove(c7, TL.c7.loop, { k: K4, c: CL, h: 0.1, oh: 0.06, b: 0.45, bc: 1500, a: 0.1 });
groove(TL.c7.loop, TL.c7.peak, { k: K4, c: CL, h: 0.13, oh: 0.08, b: 0.5, bc: 2600, a: 0.14, aUp: true, p: 0.3, pc: 3000 });
for (let t = TL.c7.peak - BAR; t < TL.c7.peak; t += S16) kick(t, 0.25 + 0.6 * (t - TL.c7.peak + BAR) / BAR);
// CH08 — people: no drums, an electric piano breathing
[[50, 57, 60, 64, 69], [46, 53, 57, 60, 65], [41, 57, 60, 64, 67], [48, 55, 59, 62, 64]].forEach((ch, i) => { for (let r = 0; r < 3; r++) ep(c8 + (i + r * 4) * BAR, BAR * 1.1, ch, 1); });
pad(c8, 30, [38, 50, 57], 0.35, 4, 3, 700);
pen(c8 + 0.2, 3.0, 0.5);
TL.c8.roles.forEach(t => pen(t + 0.1, 1.2, 0.4));
groove(TL.c8.roda, TL.c8.rise, { k: [0, 8], kg: 0.35 });
// CH09 — every layer returns, escalation, flash, the mark
groove(c9, TL.c9.climb, { k: K4, c: CL, h: 0.1, oh: 0.06, b: 0.48, a: 0.12, p: 0.35 });
groove(TL.c9.climb, TL.c9.flash, { k: K4, c: CL, h: 0.13, oh: 0.09, b: 0.52, bc: 2400, a: 0.15, aUp: true, p: 0.4, pc: 3200 });
for (let t = TL.c9.flash - BAR * 1.5, k = 0; t < TL.c9.flash - 0.01; k++) { const p = 1 - (TL.c9.flash - t) / (BAR * 1.5); clap(t, 0.15 + 0.4 * p, (k % 2 ? 0.3 : -0.3)); t += p < 0.35 ? S16 * 2 : p < 0.7 ? S16 : S16 / 2; }
swell(TL.c9.mark, TL.c9.mark - TL.c9.flash, 0.8);
pad(TL.c9.mark, c10 - TL.c9.mark + 0.5, [38, 50, 57, 62, 64, 69, 74], 1.0, 0.05, 0.8, 2600);
groove(TL.c9.mark, c10, { k: [0], kg: 0.8, h: 0.05, a: 0.1 });
// CH10 — end card
pad(c10 + 2.5, 17.3, [38, 50, 53, 57, 64, 69], 0.75, 1.5, 4, 1600);
drone(c10, 20, 26, 0.45);

// ─── cue sounds (shared with the picture)
for (const c of TL.cues) {
  const g = c.g ?? 0.5;
  switch (c.kind) {
    case 'hit': impact(c.t, (c.w ?? 0.6) * 0.75, 1.6 + (c.w ?? 0.6)); kick(c.t, 0.9); break;
    case 'ping': ping(c.t, c.f ?? 1760, g); break;
    case 'glide': glide(c.t, c.len, c.f0, c.f1, 0.6); break;
    case 'click': click(c.t, g); break;
    case 'whoosh': whoosh(c.t, c.len ?? 0.6, g); break;
    case 'thump': thump(c.t, g); break;
    case 'swell': swell(c.t + (c.len ?? 1), c.len ?? 1, g); break;
    case 'riser': riser(c.t, c.len, g); break;
    case 'tick': tick(c.t, c.f ?? 2400, g); break;
    case 'stamp': stamp(c.t, g); break;
    case 'type': typeKey(c.t, g); break;
    case 'pop': ping(c.t, 1200, g * 0.6, 0, 18); thump(c.t, g * 0.5); break;
    case 'glitch': glitch(c.t, c.len ?? 0.5, g); break;
    case 'sweep': sweepFx(c.t, c.len ?? 2, g); break;
    case 'drop': drop(c.t, g); break;
    case 'chime': chime(c.t, g); break;
    case 'boing': boing(c.t, c.clean ?? 1, g); break;
    case 'pix': pluck(c.t, c.m, 0.32, 0, 5, 0.4); break;
    case 'morph': morph(c.t, g); break;
    case 'implode': implode(c.t, c.len ?? 2.5, g); break;
    case 'pluck': ep(c.t, 2.2, [69, 76], 1.2); break;
    case 'silence': silence(c.t, c.len); break;
    case 'proj': {
      const t = c.t;
      if (c.i === 0) { pad(t, 2.6, [38, 45, 50, 53], 1.1, 0.02, 1.2, 900); impact(t, 0.35, 1.5); }
      if (c.i === 1) { [62, 66, 69, 74, 78, 81, 86].forEach((m, k) => square(t + k * 0.06, 0.12, m, 0.8)); whoosh(t + 0.5, 1.5, 0.3); }
      if (c.i === 2) for (let k = 0; k < 8; k++) pluck(t + 0.15 + k * 0.18, PROG[0].arp[k % 4] + (k >= 4 ? 12 : 0), 0.3, (k / 7) * 2 - 1);
      if (c.i === 3) for (let k = 0; k < 5; k++) drip(t + k * 0.6, 0.45);
      if (c.i === 4) { ep(t, 2.9, [50, 57, 60, 64, 65], 1.1); rain(t, 3, 0.5); }
      break;
    }
  }
}

// ─── reverb on the send bus
function reverb(inp, offs) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => ({ buf: new Float32Array(d + offs), i: 0, lp: 0 }));
  const aps = [556, 441, 341].map(d => ({ buf: new Float32Array(d + offs), i: 0 }));
  const out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const x = inp[n] * 0.08; let s = 0;
    for (const c of combs) { const y = c.buf[c.i]; c.lp = y * 0.7 + c.lp * 0.3; c.buf[c.i] = x + c.lp * 0.87; c.i = (c.i + 1) % c.buf.length; s += y; }
    for (const a of aps) { const y = a.buf[a.i]; a.buf[a.i] = s + y * 0.5; s = y - s * 0.5; a.i = (a.i + 1) % a.buf.length; }
    out[n] = s;
  }
  return out;
}
const rl = reverb(VL, 0), rr = reverb(VR, 23);

// ─── master: sum, gate (true silences), soft clip, normalise, fade the tail
let peak = 0;
for (let n = 0; n < N; n++) {
  L[n] = Math.tanh((L[n] + rl[n] * 2.0) * 0.85) * GATE[n];
  R[n] = Math.tanh((R[n] + rr[n] * 2.0) * 0.85) * GATE[n];
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const norm = 0.89 / peak, fade = Math.round(1.2 * SR);
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28);
pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) {
  const f = n > N - fade ? Math.pow((N - n) / fade, 2) : 1;
  pcm.writeInt16LE(Math.round(clamp(L[n] * norm * f, -1, 1) * 32767), 44 + n * 4);
  pcm.writeInt16LE(Math.round(clamp(R[n] * norm * f, -1, 1) * 32767), 46 + n * 4);
}
const out = path.join(DIR, 'soundtrack.wav');
fs.writeFileSync(out, pcm);
console.log(`→ ${out}  (peak before norm ${peak.toFixed(2)}, cues ${TL.cues.length})`);

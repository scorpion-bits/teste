// Scorpion Bits ident — the sound. Synthesised sample by sample from the same master clock as the picture
// (timeline.js): every node that is born clicks, every connection ticks, every tail bit plays its note.
//
//   node audio.mjs                 → soundtrack.wav   (10.000 s, 48 kHz stereo, synced to the picture)
//   node audio.mjs --signature     → sonic-logo.wav   (the sonic logo alone: five bits → the impact → the tail)
//
// The sonic logo: the five tail bits of the mark climb up and over and come back down to the stinger. The
// melody has the same contour — E5 A5 B5 E6 C#6 — and resolves on A (add9) at the stinger: the shape of the
// logo, heard.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const DIR = path.dirname(fileURLToPath(import.meta.url));
const TL = require(path.join(DIR, 'timeline.js'));
const { T } = TL;
const SIGNATURE = process.argv.includes('--signature');

const SR = 48000, TAU = Math.PI * 2;
// in signature mode the sonic logo is lifted out of the timeline: it starts just before the first bit note
const OFF = SIGNATURE ? T.arp[0] - 0.18 : 0;
const DUR = SIGNATURE ? 3.4 : TL.DUR;
const N = Math.round(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N), VL = new Float32Array(N), VR = new Float32Array(N);

let seed = 11;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const hash = TL.hash;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

class Biquad {
  constructor(type) { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  set(f, q = 0.707) {
    const w = TAU * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), a = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - a) / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y;
  }
}

// write a voice: fn(t, i) → sample, for `len` seconds starting at t0 (timeline seconds)
function voice(t0, len, fn, { gain = 1, pan = 0, send = 0 } = {}) {
  t0 -= OFF;
  const s0 = Math.round(t0 * SR), n = Math.round(len * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const k = s0 + i; if (k < 0) continue; if (k >= N) break;
    const v = fn(i / SR, i);
    L[k] += v * gl; R[k] += v * gr;
    if (send) { VL[k] += v * gl * send; VR[k] += v * gr * send; }
  }
}
const att = (t, a) => Math.min(1, t / a);

// ─── instruments
// the bit: a pure tone with a glassy FM partial and a whisper of a pulse wave (the game in it)
function bit(t0, m, g = 1, pan = 0, { decay = 4.2, bright = 1, send = 0.45, len = 1.6 } = {}) {
  const f = mtof(m); let pp = 0;
  const lp = new Biquad('lp').set(f * 3.2, 0.8);
  voice(t0, len, t => {
    const e = att(t, 0.003) * Math.exp(-t * decay);
    const fm = Math.sin(TAU * f * 4 * t) * 2.2 * Math.exp(-t * 18) * bright;
    pp = (pp + f / SR) % 1;
    const pulse = lp.run(pp < 0.25 ? 1 : -0.33) * 0.16 * bright * Math.exp(-t * 9);
    return (Math.sin(TAU * f * t + fm) * 0.8 + Math.sin(TAU * f * 2 * t) * 0.12 * Math.exp(-t * 6) + pulse) * e;
  }, { gain: g, pan, send });
}
// a node is born: a tiny, dry click
function click(t0, g = 1, pan = 0, f = 3200) {
  const bp = new Biquad('bp').set(f, 1.4);
  voice(t0, 0.03, t => (bp.run(rnd()) * 1.6 + Math.sin(TAU * f * 0.5 * t)) * Math.exp(-t * 260), { gain: g, pan, send: 0.08 });
}
// a connection forms: a short, high electronic tick
function tick(t0, g = 1, pan = 0, f = 6200) {
  voice(t0, 0.025, t => Math.sin(TAU * f * t) * Math.exp(-t * 330) * att(t, 0.0005), { gain: g, pan, send: 0.15 });
}
function sub(t0, len, f0, f1, g = 1, k = 4) {
  let ph = 0;
  voice(t0, len, t => { ph += TAU * (f1 + (f0 - f1) * Math.exp(-t * k)) / SR; return Math.sin(ph) * att(t, 0.004) * Math.exp(-t * 3 / len); }, { gain: g });
}
function noiseHit(t0, len, g = 1, f = 3000, send = 0.4) {
  const hp = new Biquad('hp').set(f, 0.6);
  voice(t0, len, t => hp.run(rnd()) * Math.exp(-t * 9 / len) * att(t, 0.001), { gain: g, send });
}
// warm voices for the pad and the chord: detuned triangles through a moving low-pass
function warm(t0, len, m, g, { attack = 0.4, release = 0.6, cutoff = t => 1400, pan = 0, send = 0.5, detune = 0.005 } = {}) {
  [-1, 1].forEach(side => {
    const lp = new Biquad('lp'); const f = mtof(m) * (1 + side * detune); let p = Math.abs(hash(m + side));
    voice(t0, len, (t, i) => {
      p = (p + f / SR) % 1;
      if (i % 32 === 0) lp.set(cutoff(t), 0.7);
      const tri = 1 - 4 * Math.abs(p - 0.5);
      return lp.run(tri) * att(t, attack) * clamp((len - t) / release) * 0.5;
    }, { gain: g, pan: pan + side * 0.35, send });
  });
}
// electric-piano-ish FM voice for the impact chord
function ep(t0, m, g = 1, pan = 0, decay = 1.2, len = 3.6) {
  const f = mtof(m);
  voice(t0, len, t => {
    const mod = Math.sin(TAU * f * t) * 1.4 * Math.exp(-t * 3.5);
    return Math.sin(TAU * f * t + mod) * att(t, 0.004) * Math.exp(-t * decay);
  }, { gain: g, pan, send: 0.55 });
}
function riser(t0, len, g = 1, cut = 0) {
  const bp = new Biquad('bp'); let ph = 0;
  voice(t0, len, (t, i) => {
    const p = t / len;
    if (i % 16 === 0) bp.set(500 * Math.pow(16, p), 3);
    ph += TAU * (mtof(57) * Math.pow(2, p * 1.0)) / SR;
    const gate = cut ? clamp((len - t) / cut) : 1;
    return (bp.run(rnd()) * 1.1 + Math.sin(ph) * 0.1 + Math.sin(ph * 1.5) * 0.06) * p * p * gate;
  }, { gain: g, send: 0.35 });
}
function whoosh(t0, len, g = 1, f0 = 400, f1 = 5000, pan = 0) {
  const bp = new Biquad('bp');
  voice(t0, len, (t, i) => {
    const p = t / len; if (i % 16 === 0) bp.set(f0 * Math.pow(f1 / f0, p), 1.3);
    return bp.run(rnd()) * Math.sin(Math.PI * p) ** 2;
  }, { gain: g, pan, send: 0.4 });
}
function swell(tEnd, len, g = 1, f = 1500) {
  const hp = new Biquad('hp').set(f, 0.7);
  voice(tEnd - len, len, t => hp.run(rnd()) * Math.pow(t / len, 3), { gain: g, send: 0.4 });
}

// ─── the motif: five tail bits, then the stinger on A
const MOTIF = [76, 81, 83, 88, 85];   // E5 A5 B5 E6 C#6 — the contour of the tail
const PANS = [-0.35, -0.5, -0.15, 0.2, 0.45];

if (!SIGNATURE) {
  // ── THE SIGNAL
  warm(0, 6.8, 33, 0.05, { attack: 2.2, release: 1.4, cutoff: () => 220, send: 0.2 });   // a breath of A, very low
  warm(0, 6.8, 40, 0.025, { attack: 2.6, release: 1.4, cutoff: () => 260, send: 0.2 });
  bit(T.appear, 93, 0.10, 0, { decay: 14, bright: 0.4, send: 0.6 });                   // the point: a tiny pulse
  sub(T.pulse, 0.7, 70, 46, 0.3, 9);                                                      // it pulses once
  bit(T.pulse, 81, 0.14, 0, { decay: 3, bright: 0.3, send: 0.9 });
  whoosh(T.pulse + 0.02, 1.1, 0.035, 2600, 500);                                          // the ripple
  swell(T.spawn, T.spawn - T.antic, 0.07, 2500);                                          // inhale
  // ── THE SYSTEM
  sub(T.spawn, 0.25, 140, 90, 0.18, 30);
  TL.Y.forEach((_, k) => click(T.spawn + k * 0.018, 0.5, [-0.4, 0.4, 0][k], 2600 + k * 500));
  [0, 1, 2].forEach(k => tick(T.close + 0.02 + k * 0.015, 0.22, [-0.3, 0.3, 0][k], 5200 + k * 700));
  bit(T.close + 0.04, 81, 0.24, 0, { decay: 3.2, bright: 0.8, send: 0.6 });               // the first bit
  // the lattice grows: one cue per hop, its weight the number of nodes; an accelerating, climbing arpeggio
  const LADDER = [57, 59, 61, 64, 66, 69, 71, 73, 76, 78, 81];
  TL.groups.forEach((gr, k) => {
    const w = Math.sqrt(gr.n) / 7;
    click(gr.t, 0.32 * w + 0.08, k % 2 ? 0.3 : -0.3, 2400 + 140 * k);
    const m = LADDER[Math.min(LADDER.length - 1, Math.floor(k * (LADDER.length - 1) / (TL.groups.length - 1)))];
    bit(gr.t, m, 0.05 + 0.03 * w, (hash(k * 3.3) - 0.5) * 0.9, { decay: 9, bright: 0.5, send: 0.35, len: 0.5 });
  });
  // every node clicks, every closing edge ticks — together a texture that thickens as the system accelerates
  TL.nodes.forEach(n => { if (n.born > T.grow0 - 0.01) click(n.born + 0.004 * hash(n.i), 0.05, (hash(n.i * 1.7) - 0.5) * 1.6, 2000 + 4000 * hash(n.i * 2.9)); });
  TL.edgesA.forEach((e, k) => { if (!e.grow && e.t0 > T.grow0) tick(e.t0, 0.035, (hash(k * 0.37) - 0.5) * 1.6, 5000 + 3500 * hash(k * 1.3)); });
  // the system organises itself: the tone rises from below
  warm(2.6, 2.75, 45, 0.13, { attack: 1.1, release: 0.3, cutoff: t => 300 + 2400 * Math.pow(t / 2.75, 2), send: 0.5 });
  warm(2.75, 2.6, 52, 0.09, { attack: 1.2, release: 0.3, cutoff: t => 300 + 2600 * Math.pow(t / 2.6, 2), send: 0.5 });
  warm(3.0, 2.3, 59, 0.075, { attack: 1.2, release: 0.3, cutoff: t => 400 + 3000 * Math.pow(t / 2.3, 2), send: 0.55 });
  warm(3.2, 2.1, 61, 0.065, { attack: 1.1, release: 0.3, cutoff: t => 400 + 3200 * Math.pow(t / 2.1, 2), send: 0.55 });
  // ── THE TRANSFORMATION: rhythm in 16ths, then 32nds, under the wave
  for (let t = 3.375; t < T.complete - 0.01; t += TL.S16 / (t >= 4.25 ? 2 : 1)) {
    const p = (t - 3.375) / (T.complete - 3.375), on = Math.round((t - 3.375) / TL.S16 * 2) % 2 === 0;
    const hp = new Biquad('hp').set(7500, 0.8);
    voice(t, 0.05, tt => hp.run(rnd()) * Math.exp(-tt * 90), { gain: (0.09 + 0.17 * p) * (on ? 1 : 0.6), pan: on ? -0.35 : 0.35, send: 0.1 });
  }
  for (let t = 3.25, k = 0; t < T.complete - 0.05; t += TL.B / 2, k++) {
    const p = (t - 3.25) / (T.complete - 3.25), lp = new Biquad('lp'); let ph = 0;
    voice(t, 0.24, (tt, i) => {
      if (i % 32 === 0) lp.set(180 + 900 * p * p + 400 * Math.exp(-tt * 20), 1.2);
      ph = (ph + mtof(33) / SR) % 1;
      return lp.run(ph * 2 - 1) * att(tt, 0.004) * Math.exp(-tt * 9);
    }, { gain: 0.1 + 0.14 * p, send: 0.1 });
  }
  [3.5, 4.0, 4.5].forEach((t, k) => sub(t, 0.35, 90, 52, 0.22 + 0.07 * k, 14));             // a heartbeat
  TL.arrivals.forEach((t, k) => tick(t, 0.045, (hash(k * 5.1) - 0.5) * 1.4, 3800 + 3000 * hash(k * 7.7)));   // lines connect
  TL.tailNotes.forEach((t, k) => bit(t, MOTIF[k], 0.13, PANS[k], { decay: 5, bright: 0.45, send: 0.6 }));  // the tail, foreshadowed
  // ── THE REVEAL: the mark is whole
  sub(T.complete, 1.2, 82, 55, 0.5, 10);
  noiseHit(T.complete, 0.4, 0.05, 4000, 0.5);
  [69, 73, 76].forEach((m, k) => bit(T.complete + 0.003 * k, m, 0.12, [-0.3, 0, 0.3][k], { decay: 3.6, bright: 0.6, send: 0.7 }));
  whoosh(T.sweep0 - 0.04, T.sweep1 - T.sweep0 + 0.1, 0.04, 1200, 9000, 0.2);                 // the light passing
  // the build into the signature
  riser(5.08, T.dum - 5.08 - 0.055, 0.2, 0.03);
  warm(5.1, T.dum - 5.1 - 0.05, 57, 0.085, { attack: 1.2, release: 0.02, cutoff: t => 600 + 3000 * Math.pow(t / 1.35, 2), send: 0.4 });
  warm(5.1, T.dum - 5.1 - 0.05, 64, 0.07, { attack: 1.2, release: 0.02, cutoff: t => 600 + 3000 * Math.pow(t / 1.35, 2), send: 0.4 });
}

// ── THE SIGNATURE (also the stand-alone sonic logo)
T.arp.forEach((t, k) => {
  bit(t, MOTIF[k], 0.32, PANS[k], { decay: 4.5, bright: 1, send: 0.5 });
  tick(t, 0.06, PANS[k], 7000);
});
swell(T.dum - 0.01, 0.55, 0.12, 1800);
// the impact: the stinger. A low A, a warm A add9, a glassy A on top
sub(T.dum, 2.4, 92, 55, 0.95, 7);
noiseHit(T.dum, 0.7, 0.13, 2200, 0.7);
[33, 45, 52, 57, 61, 64, 71].forEach((m, k) => ep(T.dum + 0.004 * k, m, [0.34, 0.3, 0.24, 0.2, 0.17, 0.15, 0.12][k], [0, -0.2, 0.2, -0.35, 0.35, -0.15, 0.15][k], 0.9 + 0.15 * k));
warm(T.dum, 3.3, 45, 0.09, { attack: 0.01, release: 1.6, cutoff: t => 1800 * Math.exp(-t * 0.9) + 300, send: 0.6 });
warm(T.dum, 3.3, 52, 0.06, { attack: 0.01, release: 1.6, cutoff: t => 1800 * Math.exp(-t * 0.9) + 300, send: 0.6 });
bit(T.dum, 81, 0.3, -0.1, { decay: 1.5, bright: 0.9, send: 0.8, len: 3 });
bit(T.dum + 0.005, 88, 0.16, 0.15, { decay: 1.8, bright: 0.7, send: 0.9, len: 3 });
// the lockup: one soft slide, one final tick as it settles
whoosh(T.lock0 + 0.04, 0.7, 0.03, 300, 2400, 0.3);
tick(T.lock1 + 0.02, 0.07, 0.25, 4400);
// THE ENDING: one residual tone that breathes, and the first point once more
warm(T.dum + 0.3, TL.DUR - T.dum - 0.4, 69, 0.03, { attack: 0.9, release: 1.6, cutoff: () => 1500, send: 0.7, detune: 0.0025 });
bit(T.glint, 93, 0.1, 0, { decay: 9, bright: 0.4, send: 0.7 });

// ─── reverb on the send bus (Schroeder / Freeverb-lite), a slightly larger room for the ident
function reverb(inp, offs, fb = 0.87) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map(d => ({ buf: new Float32Array(d + offs), i: 0, lp: 0 }));
  const aps = [556, 441, 341, 225].map(d => ({ buf: new Float32Array(d + offs), i: 0 }));
  const out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const x = inp[n] * 0.06;
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.lp = y * 0.6 + c.lp * 0.4;
      c.buf[c.i] = x + c.lp * fb;
      c.i = (c.i + 1) % c.buf.length; s += y;
    }
    for (const a of aps) {
      const y = a.buf[a.i];
      a.buf[a.i] = s + y * 0.5;
      s = y - s * 0.5; a.i = (a.i + 1) % a.buf.length;
    }
    out[n] = s;
  }
  return out;
}
const rl = reverb(VL, 0), rr = reverb(VR, 23);

// ─── master: sum, gentle low cut, soft clip, normalise, clean tail
const hpl = new Biquad('hp').set(28, 0.7), hpr = new Biquad('hp').set(28, 0.7);
let peak = 0;
for (let n = 0; n < N; n++) {
  L[n] = Math.tanh(hpl.run(L[n] + rl[n] * 1.8) * 1.1);
  R[n] = Math.tanh(hpr.run(R[n] + rr[n] * 1.8) * 1.1);
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const norm = 0.89 / peak;                  // -1 dBFS peak
const fadeLen = Math.round((SIGNATURE ? 0.6 : 0.25) * SR);
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8);
pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
const cl = x => Math.max(-1, Math.min(1, x));
for (let n = 0; n < N; n++) {
  const f = n > N - fadeLen ? Math.pow((N - n) / fadeLen, 2) : 1;
  pcm.writeInt16LE(Math.round(cl(L[n] * norm * f) * 32767), 44 + n * 4);
  pcm.writeInt16LE(Math.round(cl(R[n] * norm * f) * 32767), 46 + n * 4);
}
const out = path.join(DIR, SIGNATURE ? 'sonic-logo.wav' : 'soundtrack.wav');
fs.writeFileSync(out, pcm);
console.log(`→ ${out}  ${DUR.toFixed(3)} s  (peak before normalising ${peak.toFixed(2)})`);

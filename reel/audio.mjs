// Synthesises the 15 s soundtrack (128 BPM, A minor) sample-by-sample → soundtrack.wav
// Every hit lands on the same beat grid the visuals use.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000, DUR = 15, N = SR * DUR;
const BPM = 128, B = 60 / BPM, BAR = B * 4, S16 = B / 4;
const L = new Float32Array(N), R = new Float32Array(N);
const VL = new Float32Array(N), VR = new Float32Array(N); // reverb send
const TAU = Math.PI * 2;

let seed = 1;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// RBJ biquad with per-sample retuning
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

// write a voice: fn(t, i) → sample, for `len` seconds starting at t0
function voice(t0, len, fn, { gain = 1, pan = 0, send = 0 } = {}) {
  const s0 = Math.round(t0 * SR), n = Math.round(len * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const k = s0 + i; if (k < 0) continue; if (k >= N) break;
    const v = fn(i / SR, i);
    L[k] += v * gl; R[k] += v * gr;
    if (send) { VL[k] += v * gl * send; VR[k] += v * gr * send; }
  }
}

// ── instruments
function kick(t0, g = 1) {
  let ph = 0;
  voice(t0, 0.5, t => {
    ph += TAU * (44 + 130 * Math.exp(-t * 32)) / SR;
    const env = Math.exp(-t * 6.5) * Math.min(1, t / 0.002);
    return Math.tanh(Math.sin(ph) * env * 2.2) * 0.85 + rnd() * Math.exp(-t * 400) * 0.25;
  }, { gain: g });
}
function clap(t0, g = 1) {
  const bp = new Biquad('bp').set(1400, 0.9);
  voice(t0, 0.35, t => {
    const burst = [0, 0.011, 0.022].reduce((s, o) => s + (t >= o ? Math.exp(-(t - o) * 160) : 0), 0);
    return bp.run(rnd()) * (burst * 0.7 + Math.exp(-t * 15) * 0.5) * 2.2;
  }, { gain: g, send: 0.35 });
}
function hat(t0, open = false, g = 1, pan = 0) {
  const hp = new Biquad('hp').set(8500, 0.8);
  voice(t0, open ? 0.3 : 0.06, t => hp.run(rnd()) * Math.exp(-t * (open ? 11 : 70)), { gain: g, pan });
}
function bass(t0, len, m, g = 1) {
  const lp = new Biquad('lp'); const f = mtof(m); let p1 = 0, p2 = 0;
  voice(t0, len, t => {
    p1 = (p1 + f / SR) % 1; p2 = (p2 + f * 1.005 / SR) % 1;
    lp.set(160 + 1100 * Math.exp(-t * 14), 1.6);
    const saw = (p1 * 2 - 1 + p2 * 2 - 1) * 0.5;
    const env = Math.min(1, t / 0.004) * Math.min(1, (len - t) / 0.02);
    return (lp.run(saw) * 0.8 + Math.sin(TAU * f * t) * 0.6) * env;
  }, { gain: g });
}
function pluck(t0, m, g = 1, pan = 0, decay = 7) {
  const lp = new Biquad('lp'); const f = mtof(m); let p1 = 0, p2 = 0;
  voice(t0, 0.6, t => {
    p1 = (p1 + f / SR) % 1; p2 = (p2 + f * 1.008 / SR) % 1;
    lp.set(300 + 5200 * Math.exp(-t * 16), 2.5);
    return lp.run((p1 + p2 - 1) * 0.7) * Math.exp(-t * decay) * Math.min(1, t / 0.002);
  }, { gain: g, pan, send: 0.35 });
}
function pad(t0, len, notes, g = 1, att = 0.25) {
  notes.forEach((m, n) => {
    [-1, 1].forEach(side => {
      const lp = new Biquad('lp').set(1500, 0.7); const f = mtof(m) * (1 + side * 0.004); let p = rnd() * 0.5 + 0.5;
      voice(t0, len, t => {
        p = (p + f / SR) % 1;
        const env = Math.min(1, t / att) * Math.min(1, (len - t) / 0.4);
        return lp.run(p * 2 - 1) * env * 0.16;
      }, { gain: g, pan: side * 0.6, send: 0.5 });
    });
  });
}
function impact(t0, g = 1, len = 1.6) {
  let ph = 0;
  voice(t0, len, t => { ph += TAU * (30 + 70 * Math.exp(-t * 5)) / SR; return Math.sin(ph) * Math.exp(-t * 2.6) * 0.9; }, { gain: g });
  const hp = new Biquad('hp').set(2500, 0.6);
  voice(t0, len, t => hp.run(rnd()) * Math.exp(-t * 3.2) * 0.45, { gain: g, send: 0.6 });
}
function riser(t0, len, g = 1) {
  const bp = new Biquad('bp'); let ph = 0;
  voice(t0, len, t => {
    const p = t / len;
    bp.set(300 * Math.pow(30, p), 4);
    ph += TAU * (220 * Math.pow(5, p)) / SR;
    return (bp.run(rnd()) * 1.4 + Math.sin(ph) * 0.12) * p * p;
  }, { gain: g, send: 0.3 });
}
function swell(tEnd, len, g = 1) {
  const hp = new Biquad('hp').set(1200, 0.7);
  voice(tEnd - len, len, t => hp.run(rnd()) * Math.pow(t / len, 3) * 0.6, { gain: g, send: 0.5 });
}
function blip(t0, f, g = 1, pan = 0, k = 22) {
  voice(t0, 0.3, t => Math.sin(TAU * f * t + Math.sin(TAU * f * 2 * t) * Math.exp(-t * 30)) * Math.exp(-t * k), { gain: g, pan, send: 0.4 });
}
function whoosh(t0, len, g = 1) {
  const bp = new Biquad('bp');
  voice(t0, len, t => { const p = t / len; bp.set(400 + 4000 * Math.sin(Math.PI * p), 1.2); return bp.run(rnd()) * Math.sin(Math.PI * p) ** 2; }, { gain: g, send: 0.3 });
}

// ── arrangement
const CHORDS = [ // bar: [bass midi, arp notes]
  null,
  [33, [57, 60, 64, 69]],   // Am
  [29, [57, 60, 65, 69]],   // F
  [36, [60, 64, 67, 72]],   // C
  [31, [59, 62, 67, 71]],   // G
  [33, [57, 60, 64, 69]],   // Am
  [29, [57, 60, 65, 69]],   // F → build
  [33, [57, 60, 64, 69]],   // Am (end)
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 2];

// bar 0 — intro: ticks, dot blips, pad, reverse swell
pad(0, BAR + 0.2, [57, 64, 72], 0.7, 0.8);
[81, 84, 88, 93].forEach((m, k) => blip(k * B, mtof(m), 0.32, [-0.3, 0.3, -0.15, 0.15][k]));
for (let k = 0; k < 16; k++) hat(k * S16, false, 0.08 + k * 0.006, k % 2 ? 0.4 : -0.4);
swell(BAR, 1.2, 0.9);
riser(BAR - 0.9, 0.9, 0.35);

for (let bar = 1; bar <= 6; bar++) {
  const t0 = bar * BAR, [root, arp] = CHORDS[bar];
  const breakKick = bar === 6;
  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * B;
    if (!(breakKick && b >= 2)) kick(tb, 0.95);
    if (b % 2 === 1 && !(breakKick && b >= 2)) clap(tb, 0.55);
    hat(tb + B / 2, true, 0.13, 0.2);
    for (let s = 0; s < 4; s++) if (s !== 2) hat(tb + s * S16, false, s % 2 ? 0.07 : 0.1, -0.3);
    // offbeat bass with octave jumps
    if (!(breakKick && b >= 2)) {
      bass(tb + B / 2, B / 2 - 0.01, root, 0.55);
      bass(tb + B * 0.75, B / 4 - 0.01, root + 12, 0.35);
    }
  }
  if (bar >= 2) for (let s = 0; s < 16; s++) {
    if (breakKick && s >= 8) continue;
    pluck(t0 + s * S16, arp[ARP[s]] + (s >= 12 && bar % 2 ? 12 : 0), 0.2, s % 2 ? 0.45 : -0.45);
  }
  impact(t0, bar === 1 ? 0.9 : 0.45, 1.2);
  whoosh(t0 - 0.35, 0.45, 0.25);
}

// scene-specific sound design
clap(BAR + 2 * B + B / 2, 0.3); // type stutter
for (let k = 0; k < 4; k++) hat(BAR + 2 * B + k * B / 4, false, 0.18, k % 2 ? 0.7 : -0.7);
blip(3 * BAR + 1.25 * B, mtof(76), 0.25); // sphere → cube
blip(3 * BAR + 2.25 * B, mtof(79), 0.25); // cube → torus
riser(3 * BAR + 3 * B, B, 0.3);           // explode
[0, 1, 2, 3].forEach(k => blip(4 * BAR + k * B / 2, mtof(84 + k * 2), 0.18, k % 2 ? 0.5 : -0.5, 30)); // panels splitting
for (let k = 0; k < 4; k++) impact(5 * BAR + k * B, 0.22, 0.5); // tunnel words
// bar 6 build: snare roll + riser
for (let t = 6 * BAR + 2 * B, k = 0; t < 7 * BAR - 0.01; k++) {
  const half = t < 6 * BAR + 3 * B;
  clap(t, 0.2 + 0.35 * ((t - (6 * BAR + 2 * B)) / (2 * B)));
  t += half ? B / 4 : B / 8;
}
riser(6 * BAR + B, 3 * B, 0.6);
swell(7 * BAR, 0.6, 0.7);

// bar 7 — the end card hit
const END = 7 * BAR;
kick(END, 1.1);
impact(END, 1.2, 2.2);
bass(END, 1.2, 33, 0.6);
pad(END, BAR + 0.1, [45, 57, 64, 71, 72], 1.0, 0.01);
[69, 72, 76, 79, 81, 84].forEach((m, k) => pluck(END + 0.12 + k * S16 * 1.2, m, 0.18, k % 2 ? 0.5 : -0.5, 4));
whoosh(END + 1.36, 0.42, 0.3);
blip(END + 1.74 * 1 + 0.003, mtof(81), 0.45, 0, 10); // the final dot

// ── reverb (Schroeder/Freeverb-lite) on the send bus
function reverb(inp, offs) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => ({ buf: new Float32Array(d + offs), i: 0, lp: 0 }));
  const aps = [556, 441, 341].map(d => ({ buf: new Float32Array(d + offs), i: 0 }));
  const out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const x = inp[n] * 0.08;
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.lp = y * 0.7 + c.lp * 0.3;
      c.buf[c.i] = x + c.lp * 0.86;
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

// ── master: sum, soft-clip, normalise, fade tail
let peak = 0;
for (let n = 0; n < N; n++) {
  L[n] = Math.tanh((L[n] + rl[n] * 2.2) * 0.9);
  R[n] = Math.tanh((R[n] + rr[n] * 2.2) * 0.9);
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const norm = 0.89 / peak, fade = Math.round(0.03 * SR);
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8);
pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) {
  const f = n > N - fade ? (N - n) / fade : 1;
  pcm.writeInt16LE(Math.round(clampS(L[n] * norm * f) * 32767), 44 + n * 4);
  pcm.writeInt16LE(Math.round(clampS(R[n] * norm * f) * 32767), 46 + n * 4);
}
function clampS(x) { return Math.max(-1, Math.min(1, x)); }
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'soundtrack.wav');
fs.writeFileSync(out, pcm);
console.log(`→ ${out}  (peak before norm ${peak.toFixed(2)})`);

// Scorpion Bits ident — the master clock.
// One table of times, read by the picture (ident.js, in the browser) and by the sound (audio.mjs, in node),
// so every visual event and its sound come from the same number.
(function (root) {
'use strict';
const GEO = typeof module !== 'undefined' ? require('./geometry.js') : root.GEO;

const DUR = 10;
const BPM = 120, B = 60 / BPM, S16 = B / 4;   // 16th = 0.125 s: the signature's grid

// ─── the ten seconds
const T = {
  appear: 0.10,                 // THE SIGNAL: one point
  pulse: 0.75,                  //   it pulses once, a ripple
  antic: 1.18,                  //   inhale before the first move
  spawn: 1.50,                  // THE SYSTEM: three points, the Y
  close: 1.75,                  //   the hexagon closes: the first bit
  grow0: 2.00,                  //   the lattice grows, accelerating
  grow1: 3.05,                  //   …until it has filled the mark (the blockout)
  refine: 3.30,                 // THE TRANSFORMATION: a wave from the first point refines blockout → mark
  complete: 5.00,               // THE REVEAL: the mark is whole
  sweep0: 5.14, sweep1: 5.78,   //   a light passes through it
  arp: [0, 1, 2, 3, 4].map(k => 5.875 + k * S16), // the pulse runs up the five tail bits
  dum: 6.50,                    // THE SIGNATURE: the stinger, the impact
  lock0: 6.50, lock1: 7.30,     //   mark and wordmark lock together
  still: 7.70,                  //   complete stillness
  glint: 8.85,                  // THE ENDING: the first point, once more, inside the mark
  end: DUR,
};

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ─── wave: distance through the mark (px of the mark) → the moment that pixel becomes final.
// The knots put the five tail bits on the 16th-note grid and the stinger last.
const G = GEO.tailG; // [bit1..bit5, stinger]
const KNOTS = [
  [0, T.refine],
  [G[0], 4.375], [G[1], 4.500], [G[2], 4.625], [G[3], 4.750], [G[4], 4.875],
  [G[5], 4.905], [GEO.gmax + 1, 4.93],
];
function waveT(g) {
  if (g <= 0) return KNOTS[0][1];
  for (let i = 1; i < KNOTS.length; i++) {
    if (g <= KNOTS[i][0]) {
      const [g0, t0] = KNOTS[i - 1], [g1, t1] = KNOTS[i];
      return lerp(t0, t1, (g - g0) / (g1 - g0));
    }
  }
  return KNOTS[KNOTS.length - 1][1];
}
const REVEAL = 0.07; // a pixel goes from blockout to final in 70 ms after its wave time

// ─── the lattice: nodes, hops, births
const N = GEO.nodes.length;
const nodes = GEO.nodes.map(([x, y, g, tx, ty, tg, kind], i) => ({ i, x, y, g, tx, ty, tg, kind, nb: [] }));
GEO.edgesA.forEach(([a, b]) => { nodes[a].nb.push(b); nodes[b].nb.push(a); });
const cube0 = GEO.cubes[0].slice(0, 7);       // the first bit: centre + six rim nodes
const Y = [cube0[1], cube0[3], cube0[5]];      // its Y: up-left, up-right, down
// hop distance from the first cube
const hop = new Array(N).fill(-1);
let front = cube0.slice(); front.forEach(i => (hop[i] = 0));
let maxHop = 0;
while (front.length) {
  const nxt = [];
  for (const i of front) for (const j of nodes[i].nb) if (hop[j] < 0) { hop[j] = hop[i] + 1; maxHop = hop[j]; nxt.push(j); }
  front = nxt;
}
const hopTime = h => (h <= 0 ? T.grow0 : T.grow0 + (T.grow1 - T.grow0) * Math.pow((h - 1) / Math.max(1, maxHop - 1), 0.56) + 0.0);
nodes.forEach((n, i) => {
  n.hop = hop[i];
  if (i === cube0[0]) n.born = T.appear;
  else if (Y.includes(i)) n.born = T.spawn;
  else if (cube0.includes(i)) n.born = T.close;
  else n.born = hopTime(hop[i]) + 0.012 * (hash(i * 7.31) - 0.5);
});
// each node grows out of its earliest-born neighbour
nodes.forEach(n => {
  let best = -1, bt = Infinity;
  for (const j of n.nb) if (nodes[j].born < n.born - 1e-6 && nodes[j].born < bt) { bt = nodes[j].born; best = j; }
  n.parent = best;
});
// ─── the morph: leave when the wave passes where you are, arrive when it reaches where you go
nodes.forEach((n, i) => {
  n.depart = Math.max(T.refine - 0.1, waveT(n.g) - 0.38 - 0.06 * hash(i * 3.7));
  n.arrive = Math.max(waveT(n.tg) - 0.015, n.depart + 0.42);
  n.z = (hash(i * 9.13) - 0.5) * 2;   // depth jitter while the system is alive
  n.seed = hash(i * 1.618);
});
const edgesA = GEO.edgesA.map(([a, b]) => {
  const [p, q] = nodes[a].born <= nodes[b].born ? [a, b] : [b, a];
  // the edge a node grows along is drawn with it; edges that close a cell draw on just after
  const grow = nodes[q].parent === p;
  return { a: p, b: q, grow, t0: grow ? nodes[q].born : nodes[q].born + 0.05, len: 0.11 };
});
const edgesB = GEO.edgesB.map(([a, b]) => ({ a, b, t: Math.max(nodes[a].arrive, nodes[b].arrive) }));
const cubes = GEO.cubes.map(c => ({
  c: c[0], rim: c.slice(1, 7), g: c[7],
  born: Math.max(...c.slice(0, 7).map(i => nodes[i].born)),
  gone: waveT(c[7]) - 0.06,
}));

// ─── audio cues derived from the same data
const groups = []; // lattice growth: one cue per hop, its size
for (let h = 1; h <= maxHop; h++) {
  const ns = nodes.filter(n => n.hop === h && !cube0.includes(n.i));
  if (ns.length) groups.push({ t: hopTime(h), n: ns.length, h });
}
const arrivals = nodes.filter(n => n.kind === 1).map(n => n.arrive).sort((a, b) => a - b);
const tailNotes = G.slice(0, 5).map(waveT);

// ─── camera: very close on the point, pulling back as the system grows, arriving at the framing of the mark
const ease = {
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutQuint: t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
};
const prog = (t, a, b) => clamp((t - a) / (b - a));
function camera(t) {
  // zoom in log space: 6.6 → 7.0 (a slow push while there is only the point), then the pull-back
  const lz0 = Math.log(6.6), lz1 = Math.log(7.0), lz2 = Math.log(1.26), lz3 = Math.log(1.0), lz4 = Math.log(0.985);
  let lz = lerp(lz0, lz1, ease.inOutSine(prog(t, 0, T.spawn)));
  lz = lerp(lz, lz2, ease.inOutCubic(prog(t, T.spawn - 0.05, 3.35)));
  lz = lerp(lz, lz3, ease.inOutSine(prog(t, 3.0, T.complete)));
  lz = lerp(lz, lz4, ease.inOutSine(prog(t, T.complete, T.dum)));
  const zoom = Math.exp(lz);
  // focus: the first point, then the centre of the mark
  const fo = ease.inOutCubic(prog(t, 1.9, 4.2));
  const fx = lerp(GEO.O[0], GEO.mark[0] / 2, fo), fy = lerp(GEO.O[1], GEO.mark[1] / 2, fo);
  // the first bit is seen square-on; while the lattice grows the plane leans away a little (depth, parallax),
  // and it turns back to face us as the system organises itself
  const lean = ease.inOutSine(prog(t, 1.9, 2.65)) * (1 - ease.inOutSine(prog(t, 2.7, 3.55)));
  return { zoom, fx, fy, pitch: 0.24 * lean, yaw: -0.16 * lean, depth: lean };
}

const TL = { DUR, BPM, B, S16, T, waveT, REVEAL, KNOTS, nodes, edgesA, edgesB, cubes, cube0, Y, maxHop, hopTime, groups, arrivals, tailNotes, camera, ease, prog, clamp, lerp, hash };
if (typeof module !== 'undefined') module.exports = TL; else root.TL = TL;
})(this);

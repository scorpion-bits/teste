// Scorpion Bits — brand film. The master clock, shared by picture (browser) and sound (node).
// 96 BPM: one beat = 0.625 s, one bar = 2.5 s, the film = 120 bars = 300.000 s.
// Every chapter boundary falls on a bar line. Every sonic event the visuals rely on is a cue here.
(function (root) {
  'use strict';
  const BPM = 96, B = 60 / BPM, BAR = B * 4, DUR = 300, FPS = 30;
  const CH = [0, 25, 55, 85, 115, 145, 185, 220, 250, 280, 300];
  const TITLES = [
    'ABERTURA', 'O ESTÚDIO', 'O PROBLEMA', 'O MÉTODO', 'TECNOLOGIA',
    'O QUE FAZEMOS', 'SISTEMA EM MOVIMENTO', 'PESSOAS', 'O QUE VEM', 'SCORPION BITS',
  ];
  // bar/beat → absolute seconds inside chapter c (1-based)
  const at = (c, bar, beat = 0) => CH[c - 1] + bar * BAR + beat * B;

  // ── cues ────────────────────────────────────────────────────────────────
  // kind: hit (impact: shake + rgb split + sub boom), flash (white frame), ping, click, tick,
  // whoosh, riser{len}, swell{len}, stamp, type, glitch, silence{len}, drop
  const cues = [];
  const cue = (t, kind, o = {}) => { cues.push(Object.assign({ t, kind }, o)); return t; };

  // CH01 — a point → a line → geometry → a system → the mark
  const c1 = {
    point: cue(at(1, 0, 1), 'ping', { f: 1760, g: 0.35 }),
    pulses: [2, 3, 4, 5, 6].map(b => cue(at(1, 0, b) , 'ping', { f: 880 * Math.pow(2, (b - 2) / 12 * 2), g: 0.25 + b * 0.04 })),
    stretch: cue(at(1, 1, 3), 'glide', { len: B * 1.6, f0: 220, f1: 880 }),
    fold1: cue(at(1, 2, 2), 'click', { g: 0.6 }),
    fold2: cue(at(1, 2, 3), 'click', { g: 0.7 }),
    extrude: cue(at(1, 3, 0), 'whoosh', { len: 1.2, g: 0.4 }),
    settle: cue(at(1, 3, 3), 'thump', { g: 0.7 }),
    spread: cue(at(1, 4, 0), 'swell', { len: 0.6, g: 0.3 }),
    terrain: at(1, 5, 0),
    build: cue(at(1, 6, 0), 'riser', { len: BAR * 2, g: 0.55 }),
    converge: at(1, 8, 0),
    logo: cue(at(1, 8, 2), 'hit', { w: 1.4, flash: 0.9 }),
    word: cue(at(1, 9, 0), 'stamp', { g: 0.5 }),
  };
  // the spawn of the tilemap: one tick per ring of cubes
  for (let k = 0; k < 14; k++) cue(c1.spread + k * 0.09, 'tick', { g: 0.18, f: 2400 + k * 160 });

  // CH02 — the studio, in its own words
  const c2 = {
    estudio: cue(at(2, 0, 0), 'hit', { w: 0.8 }),
    indie: cue(at(2, 1, 0), 'stamp', { g: 0.8, w: 0.5 }),
    ideias: cue(at(2, 2, 0), 'swell', { len: 0.8, g: 0.3 }),
    viram: cue(at(2, 3, 0), 'whoosh', { len: 1.6, g: 0.45 }),
    jogo: cue(at(2, 4, 0), 'hit', { w: 0.7 }),
    cube: cue(at(2, 4, 2), 'pop', { g: 0.6 }),
    brasil: cue(at(2, 5, 0), 'stamp', { g: 0.6 }),
    godot: cue(at(2, 6, 0), 'stamp', { g: 0.6 }),
    split: cue(at(2, 7, 0), 'hit', { w: 0.6 }),
    four: cue(at(2, 9, 0), 'whoosh', { len: 0.8, g: 0.4 }),
    house: cue(at(2, 10, 2), 'thump', { g: 0.9 }),
    burst: cue(at(2, 11, 3), 'glitch', { len: B, g: 0.5 }),
  };
  [0, 1, 2, 3].forEach(k => cue(at(2, 9, 0) + k * B, 'ping', { f: [587, 698, 880, 1047][k], g: 0.25 }));
  // typewriters: one key click per character
  c2.typeA = { t0: at(2, 0, 2), dt: 0.075, text: 'DE JOGOS' };
  c2.typeB = { t0: at(2, 3, 0) + 0.2, dt: 0.05, text: 'ideias que viram' };
  c2.typeC = { t0: at(2, 6, 1), dt: 0.045, text: 'GODOT · GDSCRIPT · ASEPRITE · FL STUDIO' };
  [c2.typeA, c2.typeB, c2.typeC].forEach(ty => [...ty.text].forEach((ch, i) => { if (ch !== ' ') cue(ty.t0 + i * ty.dt, 'type', { g: 0.22 }); }));

  // CH03 — the problem: a list of half-finished features
  const c3 = {
    chaos: cue(at(3, 0, 0), 'hit', { w: 0.9 }),
    tangle: cue(at(3, 3, 0), 'glitch', { len: BAR * 0.5, g: 0.45 }),
    scan: cue(at(3, 4, 2), 'sweep', { len: BAR * 1.5, g: 0.5 }),
    sorted: cue(at(3, 6, 0), 'hit', { w: 0.6 }),
    few: cue(at(3, 6, 2), 'drop', { g: 0.6 }),
    test: at(3, 9, 0),
    obvious: cue(at(3, 11, 0), 'chime', { g: 0.5 }),
  };
  for (let k = 0; k < 12; k++) cue(c3.test + k * (BAR * 2 / 12), 'boing', { g: 0.3, clean: k / 11 });

  // CH04 — the method: a pipeline you can see
  const STAGES = ['IDEIA', 'PROTÓTIPO', 'MECÂNICA', 'GAME FEEL', 'ARTE & SOM', 'JOGO'];
  const c4 = { stages: STAGES.map((s, i) => cue(at(4, i * 2, 0), i ? 'whoosh' : 'chime', { len: 0.7, g: 0.4, label: s })) };
  // GAME FEEL: peso, aceleração, recuo, pausa de impacto — one per beat, then a real hit-stop
  c4.feel = [0, 1, 2, 3].map(k => at(4, 6, k * 1.5));
  cue(c4.feel[0], 'thump', { g: 0.8 });
  cue(c4.feel[1], 'glide', { len: 0.5, f0: 110, f1: 440 });
  cue(c4.feel[2], 'hit', { w: 0.5 });
  c4.hitstop = cue(c4.feel[3], 'hit', { w: 1.0, flash: 0.35 });
  cue(c4.hitstop + 0.02, 'silence', { len: 0.2 });
  c4.freeze = [c4.hitstop, 0.2]; // the film itself stops for 6 frames
  // ARTE & SOM: a 16-step piano roll — each step fills one row of the sprite and plays one note
  c4.roll = [69, 72, 76, 79, 81, 79, 76, 72, 74, 77, 81, 84, 86, 84, 81, 77];
  c4.pix = c4.roll.map((m, k) => cue(at(4, 8, 0) + k * B / 2, 'pix', { m, g: 0.16 + k * 0.006 }));
  c4.game = cue(at(4, 10, 0), 'hit', { w: 0.7 });

  // CH05 — technology: one continuous camera through the toolset
  const c5 = {
    sphere: cue(at(5, 0, 0), 'hit', { w: 0.7 }),
    cube: cue(at(5, 2, 0), 'morph', { g: 0.6 }),
    tree: cue(at(5, 4, 0), 'morph', { g: 0.6 }),
    surface: cue(at(5, 6, 0), 'morph', { g: 0.6 }),
    iface: cue(at(5, 8, 0), 'morph', { g: 0.6 }),
    dissolve: cue(at(5, 10, 0), 'glitch', { len: BAR, g: 0.4 }),
    stack: [0, 1, 2, 3, 4].map(k => at(5, 2 + k * 1.5, 2)),
    out: cue(at(5, 11, 2), 'riser', { len: B * 2, g: 0.4 }),
  };
  c5.stack.forEach(t => cue(t, 'stamp', { g: 0.35 }));

  // CH06 — what the studio builds (3 ways to work, 5 real projects with their real status)
  const c6 = {
    three: cue(at(6, 0, 0), 'hit', { w: 0.8 }),
    producao: cue(at(6, 1, 0), 'stamp', { g: 0.6 }),
    novo: cue(at(6, 2, 0), 'whoosh', { len: 0.6, g: 0.35 }),
    projects: [0, 1, 2, 3, 4].map(k => at(6, 3, 0) + k * 3),
    ensino: cue(at(6, 9, 0), 'hit', { w: 0.7 }),
    tirania: at(6, 12, 0),
    parcerias: cue(at(6, 13, 0), 'stamp', { g: 0.6 }),
    eco: cue(at(6, 15, 0), 'swell', { len: BAR, g: 0.5 }),
  };
  c6.projects.forEach((t, i) => cue(t, 'proj', { i, g: 0.6 }));
  c6.encontros = Array.from({ length: 15 }, (_, k) => cue(at(6, 9, 2) + k * 0.16, 'tick', { g: 0.16, f: 900 + k * 70 }));
  c6.modulos = Array.from({ length: 21 }, (_, k) => cue(at(6, 10, 2) + k * 0.1, 'tick', { g: 0.14, f: 1800 + k * 50 }));

  // CH07 — the system in motion: one bit, one impossible camera move
  const c7 = { start: at(7, 0, 0), stage: 2.5, loop: at(7, 9, 0), peak: at(7, 12, 2), cut: at(7, 13, 0), dot: at(7, 13, 2) };
  cue(c7.start, 'hit', { w: 0.7 });
  for (let k = 1; k <= 9; k++) { cue(c7.start + k * c7.stage - 1.1, 'whoosh', { len: 1.1, g: 0.32 }); cue(c7.start + k * c7.stage, 'click', { g: 0.55 }); }
  // the accelerating loop: one tick per stage passed (same formula the picture uses)
  c7.u = lt => { const tt = lt - (c7.loop - c7.start); return 9 + (Math.pow(2, tt / 2.9) - 1) * 2.3; };
  for (let k = 10; k < 40; k++) { const tt = 2.9 * Math.log2((k - 9) / 2.3 + 1); const t = c7.loop + tt; if (t < c7.cut) cue(t, 'tick', { g: 0.2, f: 1400 + (k - 10) * 60 }); }
  cue(c7.loop, 'riser', { len: c7.peak - c7.loop, g: 0.7 });
  cue(c7.peak, 'hit', { w: 1.2, flash: 0.6 });
  cue(c7.cut, 'silence', { len: at(8, 0) - c7.cut });
  cue(c7.dot, 'ping', { f: 1760, g: 0.3 });

  // CH08 — people
  const c8 = {
    stroke: at(8, 0, 0),
    roles: [0, 1, 2, 3].map(k => at(8, 3 + k, 0)),
    roda: at(8, 7, 0),
    rise: cue(at(8, 11, 0), 'swell', { len: BAR, g: 0.4 }),
  };
  c8.roles.forEach(t => cue(t, 'pluck', { g: 0.35 }));

  // CH09 — what comes next: every motif returns
  const c9 = {
    universe: cue(at(9, 0, 0), 'hit', { w: 0.8 }),
    connect: cue(at(9, 3, 0), 'swell', { len: BAR, g: 0.4 }),
    forming: cue(at(9, 5, 0), 'stamp', { g: 0.6 }),
    climb: cue(at(9, 7, 0), 'riser', { len: BAR * 2.5, g: 0.85 }),
    flash: cue(at(9, 9, 2), 'hit', { w: 1.6, flash: 1 }),
    mark: cue(at(9, 10, 0), 'hit', { w: 1.0 }),
  };

  // CH10 — the end card
  const c10 = {
    collapse: cue(at(10, 0, 0), 'implode', { len: BAR, g: 0.8 }),
    lock: cue(at(10, 1, 0), 'thump', { g: 0.8 }),
    word: cue(at(10, 2, 0), 'stamp', { g: 0.45 }),
    tag: at(10, 3, 0),
    final: at(10, 5, 0),
    pulses: [5, 6, 7].map(k => cue(at(10, k, 0) + B, 'ping', { f: 1760, g: 0.22 })),
  };

  const HITS = cues.filter(c => c.kind === 'hit' || c.w).map(c => [c.t, c.w || 0.5, c.flash || 0]);
  const FREEZES = [c4.freeze];

  const TL = { BPM, B, BAR, DUR, FPS, CH, TITLES, at, cues, HITS, FREEZES, STAGES, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10 };
  if (typeof module !== 'undefined' && module.exports) module.exports = TL;
  else root.TL = TL;
})(typeof globalThis !== 'undefined' ? globalThis : this);

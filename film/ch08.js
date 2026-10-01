// CH08 — PESSOAS (3:40–4:10)
// The tone turns human. Ink-like strokes, a fingerprint, imperfect gestures traced over by precise lines.
// Copy from scorpionbits.com/sobre and the team section: "A Scorpion Bits nasceu de um grupo de amigos de faculdade…",
// "Um estúdio de quatro pessoas, quatro frentes", the four roles, and
// "Quem explica bem entende melhor — e a turma sai fazendo, não assistindo."
(function () {
const { W, H, CX, CY, TAU, P, clamp, lerp, prog, E, hash, noise1, noise2, noise3, flow, rgba, bg, font, circle, glow, seg, label, isoCube, CUBE_PAL, statement } = CORE;
const { B, c8 } = TL;
const T0 = TL.CH[7];
const ROLES = c8.roles.map(t => t - T0), RODA = c8.roda - T0, RISE = c8.rise - T0;

const TEAM = [
  { role: 'Música & Sound Design', name: 'Thales Hajes', desc: ['Compõe a trilha sonora e desenha', 'os efeitos, da gravação à mixagem final.'] },
  { role: 'Programação · Gameplay', name: 'Giovane Sotratto', desc: ['Programa controle, câmera e a', 'interação do jogador com o mundo.'] },
  { role: 'Programação · Sistemas', name: 'Milan Bahrami', desc: ['Programa a arquitetura do projeto:', 'componentes, progressão e ferramentas.'] },
  { role: 'Arte · Animação', name: 'Christian Amancio', desc: ['Leva o conceito até a arte final e anima', 'personagens, inimigos e efeitos.'] },
];

// ink ribbon: a polyline with pressure-varying width
function ink(ctx, pts, p, col, w0 = 3, seed = 0) {
  const n = Math.max(2, Math.floor(pts.length * clamp(p)));
  if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const u = i / (pts.length - 1);
    const w = w0 * (0.35 + 0.65 * Math.sin(Math.PI * clamp(u * 1.05))) * (0.8 + 0.4 * noise1(i * 0.15 + seed));
    L.push([pts[i][0] - dy / d * w, pts[i][1] + dx / d * w]); R.push([pts[i][0] + dy / d * w, pts[i][1] - dx / d * w]);
  }
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
  L.forEach(q => ctx.lineTo(q[0], q[1])); for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath(); ctx.fill();
}
// hand wobble on any path
const hand = (pts, amp, seed) => pts.map(([x, y], i) => [x + noise1(i * 0.09 + seed) * amp, y + noise1(i * 0.09 + seed + 50) * amp]);
function precise(ctx, pts, p, col, lw = 2) {
  const n = Math.floor(pts.length * clamp(p)); if (n < 2) return;
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.beginPath();
  for (let i = 0; i < n; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]); ctx.stroke();
}

function fingerprint(ctx, x, y, s, p, col, seed = 0) {
  for (let r = 0; r < 22; r++) {
    const pr = clamp(p * 24 - r * 0.9); if (pr <= 0) continue;
    const rx = (8 + r * 7.5) * s, ry = rx * 1.32, gap = 0.5 + hash(r + seed) * 0.8, a0 = hash(r * 3 + seed) * TAU;
    ctx.strokeStyle = col; ctx.lineWidth = 1.6 * s; ctx.beginPath();
    for (let k = 0; k <= 80; k++) {
      const a = a0 + gap / 2 + (TAU - gap) * (k / 80) * pr;
      const wob = noise2(Math.cos(a) * 1.5 + r * 0.2 + seed, Math.sin(a) * 1.5) * 4 * s;
      const xx = x + Math.cos(a) * (rx + wob) + Math.sin(r * 0.3) * 6 * s, yy = y + Math.sin(a) * (ry + wob) - r * 0.6 * s;
      k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }
}

// four gestures: hand-drawn first, then traced by a precise machine line
const G = [
  (cx, cy) => Array.from({ length: 120 }, (_, i) => { const u = i / 119; return [cx - 170 + u * 340, cy + Math.sin(u * TAU * 3) * 60 * Math.sin(Math.PI * u)]; }),
  (cx, cy) => Array.from({ length: 120 }, (_, i) => { const u = i / 119; return [cx - 170 + u * 340, cy + 80 - 4 * 170 * u * (1 - u)]; }),
  (cx, cy) => { const pts = []; const box = (x, y, w, h) => { for (let k = 0; k <= 40; k++) { const u = k / 40 * 4, side = Math.min(3, Math.floor(u)), f = u - side; const c = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]; pts.push([lerp(c[side][0], c[side + 1][0], f), lerp(c[side][1], c[side + 1][1], f)]); } };
    box(cx - 50, cy - 110, 100, 56); for (let k = 0; k <= 20; k++) pts.push([cx, cy - 54 + k * 2.5]); box(cx - 170, cy - 4, 120, 56); box(cx + 50, cy - 4, 120, 56); return pts; },
  (cx, cy) => Array.from({ length: 160 }, (_, i) => { const u = i / 159, b = Math.abs(Math.sin(u * Math.PI * 3)); return [cx - 170 + u * 340, cy + 80 - b * 150]; }),
];

function draw(ctx, lt) {
  // warmer, quieter ink
  bg(ctx, '#07080d');
  const warm = ctx.createRadialGradient(CX, CY + 200, 0, CX, CY + 200, 1000);
  warm.addColorStop(0, rgba(P.amber, 0.06)); warm.addColorStop(1, rgba(P.amber, 0)); ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);

  // ── 0. the point becomes a pen; a fingerprint is written (0 – 7.5)
  const out0 = E.inOutCubic(prog(lt, ROLES[0] - 1.1, ROLES[0] - 0.3));
  if (lt < ROLES[0] + 0.2) {
    const pen = prog(lt, 0.2, 3.2);
    // the pen sweeps in from below and spirals into the fingerprint it is about to write
    const pts = [], fx0 = CX + 360, fy0 = CY - 20;
    for (let i = 0; i < 260; i++) {
      const u = i / 259, bx = lerp(CX, fx0, E.inOutSine(u)), by = lerp(CY, fy0, E.inOutSine(u)) + Math.sin(Math.PI * u) * 260;
      const r = 70 * Math.sin(Math.PI * u) * (1 - u * 0.6) * Math.min(1, u * 8);
      pts.push([bx + Math.cos(u * TAU * 2.2) * r + noise1(u * 9) * 10, by + Math.sin(u * TAU * 2.2) * r * 0.7 + noise1(u * 9 + 40) * 10]);
    }
    ctx.save(); ctx.globalAlpha = 1 - out0;
    ink(ctx, pts, pen, rgba(P.text, 0.9), 3, 1);
    fingerprint(ctx, CX + 360, CY - 20, 1.6, prog(lt, 1.5, 5.5), rgba(P.amber, 0.7), 3);
    if (pen < 1) { const q = pts[Math.min(pts.length - 1, Math.floor(pts.length * pen))]; glow(ctx, q[0], q[1], 40, P.cyan, 0.4); ctx.fillStyle = P.white; circle(ctx, q[0], q[1], 4); ctx.fill(); }
    ctx.restore();
    statement(ctx, [
      { text: 'A Scorpion Bits nasceu de um grupo', size: 50, wght: 300, col: P.text, lh: 1.25 },
      { text: 'de amigos de faculdade', size: 50, wght: 600, col: P.text, lh: 1.6 },
      { text: 'e virou um estúdio que faz jogos indie e ensina game dev.', size: 30, wght: 300, col: P.soft },
    ], 140, CY - 90, lt, 1.2, ROLES[0] - 0.7, { stagger: 0.5 });
  }

  // ── 1. four people, four fronts (7.5 – 17.5)
  if (lt >= ROLES[0] - 0.5 && lt < RODA + 0.3) {
    const out = E.inExpo(prog(lt, RODA - 1.0, RODA - 0.3));
    statement(ctx, [{ text: 'Um estúdio de quatro pessoas, quatro frentes.', size: 54, wght: 300, fam: 'SG', col: P.text }], CX, 170, lt, ROLES[0] - 0.7, RODA - 1.0, { align: 'center' });
    TEAM.forEach((m, i) => {
      const t0 = ROLES[i] - (i ? 0 : 0.5); if (lt < t0 - 0.2) return;
      const cx = 290 + i * 447, cy = 440;
      const a = (1 - out) * E.outCubic(prog(lt, t0 - 0.2, t0 + 0.4));
      ctx.save(); ctx.globalAlpha = a;
      fingerprint(ctx, cx, cy, 0.95, prog(lt, t0, t0 + 1.6), rgba(P.amber, 0.12), i * 7);
      const g = G[i](cx, cy);
      ink(ctx, hand(g, 7, i * 13), prog(lt, t0 + 0.1, t0 + 1.3), rgba(P.text, 0.85), 3.2, i);
      precise(ctx, g, prog(lt, t0 + 1.1, t0 + 2.0), rgba(P.cyan, 0.95), 2);
      ctx.restore();
      // the person
      const tp = E.outExpo(prog(lt, t0 + 0.2, t0 + 0.9));
      ctx.save(); ctx.globalAlpha = a * tp; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      font(ctx, 'SG', 30, 600); ctx.fillStyle = P.text; ctx.fillText(m.role, cx, 690 + (1 - tp) * 20);
      font(ctx, 'IN', 24, 400); ctx.fillStyle = P.amber; ctx.fillText(m.name, cx, 730 + (1 - tp) * 20);
      font(ctx, 'IN', 19, 300); ctx.fillStyle = P.soft; m.desc.forEach((d, k) => ctx.fillText(d, cx, 778 + k * 28 + (1 - tp) * 20));
      ctx.restore();
    });
  }

  // ── 2. the roda: explain well, and the class leaves making (17.5 – 27.5)
  if (lt >= RODA - 0.5) {
    const a = E.outCubic(prog(lt, RODA - 0.5, RODA + 0.2));
    const rise = E.inOutExpo(prog(lt, RISE, 30));
    const cx = 1340, cy = CY + 20, R = 250;
    ctx.save(); ctx.globalAlpha = a;
    // ribbons following invisible forces between people
    for (let r = 0; r < 26; r++) {
      const pts = []; let x = cx + Math.cos(r) * 120, y = cy + Math.sin(r) * 120;
      for (let i = 0; i < 70; i++) { const [fx, fy] = flow(x * 0.003, y * 0.003, lt * 0.15 + r * 0.01); x += fx * 4 * (1 - rise) + (cx - x) * 0.02 * rise; y += fy * 4 * (1 - rise) + (cy - y) * 0.02 * rise; pts.push([x, y]); }
      ink(ctx, pts, prog(lt, RODA + 0.5 + r * 0.05, RODA + 2.5 + r * 0.05), rgba(r % 4 ? P.sky : P.amber, 0.22), 1.6, r);
    }
    for (let k = 0; k < 17; k++) {
      const an = -Math.PI / 2 + k / 17 * TAU, wob = noise1(k * 3 + lt * 0.8) * 8;
      const x = cx + Math.cos(an) * (R + wob), y = cy + Math.sin(an) * (R + wob);
      const on = E.outBack(prog(lt, RODA - 0.4 + k * 0.05, RODA + k * 0.05), 2);
      // explanation: from the centre to each
      const ex = prog(lt, RODA + 1.2 + k * 0.05, RODA + 1.8 + k * 0.05);
      if (ex > 0) { ctx.strokeStyle = rgba(P.soft, 0.25); ctx.lineWidth = 1.2; seg(ctx, cx, cy, lerp(cx, x, ex), lerp(cy, y, ex)); }
      ctx.fillStyle = rgba(P.text, on); circle(ctx, x, y, 8 * on); ctx.fill();
      // making: each one builds outward
      const mk = prog(lt, RODA + 3.2 + k * 0.1, RODA + 4.4 + k * 0.1);
      for (let c = 0; c < 3; c++) {
        const m = clamp(mk * 3 - c);
        if (m > 0) isoCube(ctx, x + Math.cos(an) * (34 + c * 26), y + Math.sin(an) * (34 + c * 26), 11 * E.outBack(m, 2), c === 2 ? CUBE_PAL.amber : CUBE_PAL.brand, 1);
      }
    }
    ctx.restore();
    statement(ctx, [
      { text: 'Quem explica bem', size: 72, wght: 300, fam: 'SG', col: P.text, lh: 1.1 },
      { text: 'entende melhor —', size: 72, wght: 300, fam: 'SG', col: P.text, lh: 1.4 },
      { text: 'e a turma sai fazendo,', size: 72, wght: 700, fam: 'SG', col: P.text, lh: 1.1 },
      { text: 'não assistindo.', size: 72, wght: 700, fam: 'SG', col: P.amber },
    ], 140, CY - 160, lt, RODA + 0.1, RISE + 0.6, { stagger: 0.35 });
    statement(ctx, [{ text: 'Trabalhamos juntos desde maio de 2026.', size: 22, wght: 500, fam: 'JB', col: P.dim, track: 2 }], 140, H - 130, lt, RODA + 5.5, RISE + 0.6);
  }
}

(window.CHAPTERS = window.CHAPTERS || [])[7] = {
  draw,
  fx: lt => ({ bloom: 0.25, grain: 0.075 }),
  hud: () => null,
};
})();

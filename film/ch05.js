// CH05 — TECNOLOGIA (1:55–2:25)
// One continuous camera through a world of 4,000 points that keeps changing nature:
// sphere → cube → scene tree (Godot) → sound surface → GDScript interface → particle stream.
// The studio's real toolset (scorpionbits.com/sobre): Godot Engine, GDScript, Git & GitHub, Aseprite, FL Studio…
// "Um pipeline enxuto, escolhido para dar mecânica robusta, visual marcante e som polido sem inflar o projeto."
(function () {
const { W, H, CX, CY, TAU, P, clamp, lerp, prog, E, hash, noise1, noise2, noise3, flow, rgba, mix, bg, font, circle, glow, seg,
  label, scramble, textPoints, cam, statement } = CORE;
const { B, c5 } = TL;
const T0 = TL.CH[4];
const L = k => c5[k] - T0;
const N = 4000;

const TREE = [
  { n: 'Main', c: 'Node2D', p: [0, -470, 0] },
  { n: 'Player', c: 'CharacterBody2D', p: [-620, -170, 0], parent: 0 },
  { n: 'World', c: 'Node2D', p: [-160, -170, 160], parent: 0 },
  { n: 'HUD', c: 'CanvasLayer', p: [300, -170, -120], parent: 0 },
  { n: 'Music', c: 'AudioStreamPlayer', p: [700, -170, 60], parent: 0 },
  { n: 'Sprite2D', c: '', p: [-900, 160, -60], parent: 1 },
  { n: 'CollisionShape2D', c: '', p: [-690, 160, 170], parent: 1 },
  { n: 'AnimationPlayer', c: '', p: [-470, 160, -140], parent: 1 },
  { n: 'Camera2D', c: '', p: [-330, 300, 60], parent: 1 },
  { n: 'TileMapLayer', c: '', p: [-60, 180, 280], parent: 2 },
  { n: 'Label', c: '', p: [210, 160, -260], parent: 3 },
  { n: 'ProgressBar', c: '', p: [440, 180, -40], parent: 3 },
];
const CODE = [
  ['extends', ' CharacterBody2D'],
  [''],
  ['const', ' SPEED := 220.0'],
  ['const', ' JUMP := -420.0'],
  ['var', ' gravity := 980.0'],
  [''],
  ['func', ' _physics_process(delta: float) -> void:'],
  ['', '    velocity.y += gravity * delta'],
  ['if', '    if Input.is_action_just_pressed("jump") and is_on_floor():'],
  ['', '        velocity.y = JUMP'],
  ['', '    velocity.x = Input.get_axis("left", "right") * SPEED'],
  ['', '    move_and_slide()'],
];
const CODE_X = -560, CODE_Y = -250, CODE_LH = 44, CODE_PX = 25;

let S = [], C = [], T = [], F = [], R = [];
function init() {
  const ga = Math.PI * (3 - Math.sqrt(5));
  const edges = TREE.filter(t => t.parent !== undefined).map(t => [TREE[t.parent].p, t.p]);
  // the interface: code rendered and sampled into points
  const cv = CORE.mk(1400, 640), x = cv.getContext('2d', { willReadFrequently: true });
  x.font = `500 ${CODE_PX}px JB`; x.textBaseline = 'middle'; x.fillStyle = '#fff';
  CODE.forEach((ln, i) => x.fillText(ln.length > 1 ? (ln[0] === 'if' ? ln[1] : ln[0] + ln[1]) : ln[0], 40, 40 + i * CODE_LH));
  x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(4, 4, 1392, 632);
  const d = x.getImageData(0, 0, 1400, 640).data, ip = [];
  for (let yy = 0; yy < 640; yy += 3) for (let xx = 0; xx < 1400; xx += 3) if (d[(yy * 1400 + xx) * 4 + 3] > 120) ip.push([xx - 700 + 100, yy - 320 + 60]);
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
    const s = [Math.cos(th) * r * 420, y * 420, Math.sin(th) * r * 420];
    S.push(s);
    let c;
    if (i % 3 === 0) { // on an edge of the cube
      const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]][i % 12];
      const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
      const u = hash(i * 1.7); c = V[e[0]].map((v, k) => lerp(v, V[e[1]][k], u) * 300);
    } else { const m = Math.max(Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2])); c = s.map(v => (v / m) * 300); }
    C.push(c);
    if (i % 4 === 0) { const nd = TREE[i / 4 % TREE.length].p; T.push(nd.map(v => v + (hash(i * 3.1 + nd[0]) - 0.5) * 36)); }
    else { const [a, b] = edges[i % edges.length], u = hash(i * 2.3); T.push(a.map((v, k) => lerp(v, b[k], u) + (hash(i + k) - 0.5) * 6)); }
    F.push([(i % 64 - 31.5) * 42, 0, (Math.floor(i / 64) - 31) * 42 + 900]);
    const q = ip[Math.floor(hash(i * 0.913) * ip.length)];
    R.push([q[0], q[1], 0]);
  }
}

// camera: piecewise shots blended into one continuous move
const shots = [
  { t0: 0, t1: 9.4, f: lt => { const a = -0.35 + lt * 0.12, r = lerp(1700, 1150, E.outCubic(prog(lt, 0, 5))) + 300 * E.inOutCubic(prog(lt, 4.5, 6.5)); return [[Math.sin(a) * r, -260 - 140 * Math.sin(lt * 0.3), -Math.cos(a) * r], [0, 0, 0]]; } },
  { t0: 10.4, t1: 14.4, f: lt => { const p = prog(lt, 10.4, 14.4); return [[lerp(-650, 450, p), lerp(-480, -760, p), -1550], [lerp(-150, 50, p), 40, 0]]; } },
  { t0: 15.4, t1: 20.2, f: lt => { const p = prog(lt, 15.4, 20.2); const z = lerp(-1350, -150, p); return [[260 * Math.sin(lt * 0.5), -250, z], [0, 90, z + 900]]; } },
  { t0: 22.0, t1: 25.0, f: () => [[0, 0, -900], [0, 0, 0]] },
  { t0: 25.6, t1: 30, f: lt => { const z = lerp(-900, 500, E.inCubic(prog(lt, 25.6, 30))); return [[0, 0, z], [0, 0, z + 900]]; } },
];
function camAt(lt) {
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (lt >= s.t0 && lt <= s.t1) return s.f(lt);
    const n = shots[i + 1];
    if (n && lt > s.t1 && lt < n.t0) {
      const a = s.f(s.t1), b = n.f(n.t0), p = E.inOutCubic(prog(lt, s.t1, n.t0));
      return [a[0].map((v, k) => lerp(v, b[0][k], p)), a[1].map((v, k) => lerp(v, b[1][k], p))];
    }
  }
  return shots[shots.length - 1].f(lt);
}
function look(pos, tgt) {
  const d = [tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]];
  const yaw = Math.atan2(d[0], d[2]), hz = Math.hypot(d[0], d[2]);
  return cam({ x: pos[0], y: pos[1], z: pos[2], yaw, pitch: Math.atan2(d[1], hz), f: 900 });
}

function surfH(x, z, lt) {
  const r = Math.hypot(x, z - 900);
  let h = Math.sin(r * 0.012 - lt * 3) * 60 * Math.exp(-r * 0.0009) + noise2(x * 0.003 + lt * 0.3, z * 0.003) * 90;
  // beat pulses roll across the surface like sound
  for (let k = 0; k < 8; k++) { const tb = L('surface') + k * B; const dt = lt - tb; if (dt > 0 && dt < 2) h += Math.exp(-dt * 2.2) * Math.sin(r * 0.02 - dt * 14) * 70 * clamp(dt * 900 / (r + 1)); }
  return h;
}

function draw(ctx, lt) {
  const [pos, tgt] = camAt(lt);
  const pr = look(pos, tgt);
  bg(ctx, P.ink);
  const sky = ctx.createRadialGradient(CX, CY, 0, CX, CY, 1100);
  sky.addColorStop(0, rgba('#0d2240', 0.85)); sky.addColorStop(1, rgba(P.ink, 0)); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  const born = E.outBack(prog(lt, 0, 1.0), 1.5);
  const m1 = k => E.inOutExpo(prog(lt, L('cube') + hash(k) * 0.5, L('cube') + 1.1 + hash(k) * 0.5));
  const m2 = k => E.inOutExpo(prog(lt, L('tree') + hash(k * 1.3) * 0.6, L('tree') + 1.3 + hash(k * 1.3) * 0.6));
  const m3 = k => E.inOutExpo(prog(lt, L('surface') + hash(k * 1.7) * 0.6, L('surface') + 1.4 + hash(k * 1.7) * 0.6));
  const m4 = k => E.inOutExpo(prog(lt, L('iface') + hash(k * 2.1) * 0.9, L('iface') + 1.6 + hash(k * 2.1) * 0.9));
  const m5 = k => E.inCubic(prog(lt, L('dissolve') + 0.3 + hash(k * 2.9) * 1.6, L('dissolve') + 2.6 + hash(k * 2.9) * 1.6));
  const rotA = lt * 0.35;
  const focus = Math.hypot(tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]);
  const crisp = prog(lt, L('iface') + 2.4, L('iface') + 2.9) * (1 - prog(lt, L('dissolve') + 0.1, L('dissolve') + 0.6));

  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < N; k++) {
    // sphere/cube spin as one object; later shapes are world-fixed
    let p = S[k].map(v => v * born * (1 + CORE.beatPulse(lt, 9) * 0.05 * (1 - prog(lt, 4.5, 5)) * noise1(k * 0.05 + lt)));
    const a1 = m1(k), a2 = m2(k), a3 = m3(k), a4 = m4(k), a5 = m5(k);
    p = p.map((v, i) => lerp(v, C[k][i], a1));
    const c = Math.cos(rotA * (1 - a2)), s = Math.sin(rotA * (1 - a2));
    p = [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
    if (a2 > 0) p = p.map((v, i) => lerp(v, T[k][i], a2));
    if (a3 > 0) { const f = F[k]; const fy = 260 + surfH(f[0], f[2], lt); p = [lerp(p[0], f[0], a3), lerp(p[1], fy, a3), lerp(p[2], f[2], a3)]; }
    if (a4 > 0) p = p.map((v, i) => lerp(v, R[k][i], a4));
    if (a5 > 0) {
      const [fx, fy] = flow(R[k][0] * 0.003, R[k][1] * 0.003, lt * 0.4);
      p = [p[0] + fx * 600 * a5, p[1] + fy * 600 * a5, p[2] - a5 * (1800 + hash(k) * 2400)];
    }
    const q = pr(p[0], p[1], p[2]);
    if (!q) continue;
    const [x, y, sc, z] = q;
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
    // depth of field: out-of-focus points grow and fade
    const blur = Math.min(10, Math.abs(z - focus) * 0.006);
    const size = (1.6 + sc * 2.2) + blur;
    const al = clamp(1.1 / (1 + blur * 0.55)) * (1 - crisp * 0.92);
    let col;
    if (a4 > 0.5) col = k % 9 === 0 ? P.amber : P.cyan;
    else if (a3 > 0.5) { const h = (260 - p[1]) / 220; col = h > 0.45 ? P.white : h > 0.1 ? P.cyan : P.indigo; }
    else if (a2 > 0.5) col = k % 4 === 0 ? P.cyan : P.sky;
    else if (a1 > 0.5) col = k % 3 === 0 ? P.white : P.sky;
    else col = k % 5 === 0 ? P.white : P.cyan;
    ctx.fillStyle = rgba(col, al * (k % 4 === 0 && a2 > 0.5 && a3 < 0.5 ? 1 : 0.75));
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  ctx.restore();

  // tree labels (Godot scene tree)
  const tl = prog(lt, L('tree') + 1.6, L('tree') + 2.2) * (1 - prog(lt, L('surface') - 0.2, L('surface') + 0.3));
  if (tl > 0) TREE.forEach((nd, i) => {
    const q = pr(nd.p[0], nd.p[1], nd.p[2]); if (!q) return;
    const a = tl * clamp((lt - L('tree') - 1.6 - i * 0.06) * 4);
    ctx.fillStyle = rgba(P.white, a); circle(ctx, q[0], q[1], 5); ctx.fill();
    label(ctx, nd.n, q[0] + 14, q[1] - 10, a, P.text, 15);
    if (nd.c) label(ctx, nd.c, q[0] + 14, q[1] + 12, a * 0.7, P.cyan, 12);
  });
  if (tl > 0) label(ctx, 'SCENE TREE', 96, H - 150, 0.6 * tl, P.dim, 13);
  // the interface, crisp
  if (crisp > 0) {
    const x0 = CX + CODE_X + 100 - 140, y0 = CY + CODE_Y + 60 - 300;
    ctx.save(); ctx.globalAlpha = crisp;
    ctx.fillStyle = rgba('#0a1424', 0.85); ctx.strokeStyle = rgba(P.sky, 0.6); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(CX - 700 + 100 + 4, CY - 320 + 60 + 4, 1392, 632, 12); ctx.fill(); ctx.stroke();
    font(ctx, 'JB', CODE_PX, 500); ctx.textBaseline = 'middle';
    CODE.forEach((ln, i) => {
      const y = CY - 320 + 60 + 40 + i * CODE_LH, x = CX - 700 + 100 + 40;
      const full = ln.length > 1 ? (ln[0] === 'if' ? ln[1] : ln[0] + ln[1]) : ln[0];
      // simple syntax colouring
      const kw = /\b(extends|const|var|func|if|and)\b/g;
      let last = 0, m, xx = x;
      ctx.fillStyle = P.text;
      const parts = [];
      while ((m = kw.exec(full))) { parts.push([full.slice(last, m.index), P.text]); parts.push([m[0], P.amber]); last = m.index + m[0].length; }
      parts.push([full.slice(last), P.text]);
      parts.forEach(([s, col]) => {
        const segs = s.split(/("[^"]*")/);
        segs.forEach(sg => { ctx.fillStyle = sg.startsWith('"') ? P.mint : /\d/.test(sg) && !/[a-z]/i.test(sg.trim()) ? P.cyan : col; ctx.fillText(sg, xx, y); xx += ctx.measureText(sg).width; });
      });
    });
    label(ctx, 'player.gd', CX - 600 + 30, CY - 260 - 24, 0.8, P.soft, 13);
    ctx.restore();
  }

  // the toolset flies through the space as monumental type
  const stack = ['GODOT', 'GDSCRIPT', 'FL STUDIO', 'ASEPRITE', 'GIT & GITHUB'];
  c5.stack.forEach((t, i) => {
    const p = (lt - (t - T0)) / 2.6;
    if (p < 0 || p > 1) return;
    const d = lerp(3200, 260, E.inCubic(p)), sc = 900 / d;
    const a = clamp(p * 4) * (1 - prog(p, 0.75, 1));
    ctx.save(); ctx.translate(CX + (i % 2 ? 1 : -1) * 260 * sc * 0.6, CY + (i % 2 ? -1 : 1) * 120 * sc * 0.4); ctx.scale(sc, sc);
    font(ctx, 'SG', 150, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '6px';
    ctx.fillStyle = rgba(P.text, a); ctx.fillText(stack[i], 0, 0);
    ctx.restore();
  });

  statement(ctx, [
    { text: 'Um pipeline enxuto,', size: 96, wght: 700, fam: 'SG', col: P.text, lh: 1.2 },
    { text: 'escolhido para dar mecânica robusta, visual marcante', size: 38, wght: 300, col: P.soft, lh: 1.35 },
    { text: 'e som polido sem inflar o projeto.', size: 38, wght: 300, col: P.soft },
  ], CX, CY - 40, lt, L('dissolve') + 0.6, L('out') - 0.1, { align: 'center' });

  // everything converges to a single point (handoff to chapter 06)
  const conv = prog(lt, 29.2, 30);
  if (conv > 0) { glow(ctx, CX, CY, 220 * conv, P.cyan, conv); ctx.fillStyle = P.white; circle(ctx, CX, CY, 7 * conv); ctx.fill(); }
}

(window.CHAPTERS = window.CHAPTERS || [])[4] = {
  init, draw,
  fx: lt => ({ bloom: 0.55, grain: 0.05 }),
  hud: () => ({ word: 'SYSTEM' }),
};
})();

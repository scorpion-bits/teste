// CH07 — SISTEMA EM MOVIMENTO (3:05–3:40)
// Stop explaining, start demonstrating: one impossible camera move. Each stage lives inside the "bit" of the
// previous one; the camera dives through: input → signal → code → physics → game feel → sprite → sound → frame
// → player → input again. The loop accelerates, peaks, and then everything is removed: silence, black, one point.
(function () {
const { W, H, CX, CY, TAU, P, clamp, lerp, prog, E, hash, noise1, noise2, rgba, bg, font, circle, glow, seg, label, scramble, isoCube, CUBE_PAL } = CORE;
const { B, c7 } = TL;
const T0 = TL.CH[6];
const STAGE = c7.stage, LOOP = c7.loop - T0, PEAK = c7.peak - T0, CUT = c7.cut - T0, DOT = c7.dot - T0;
const Z = 24, PR = 48; // zoom per stage, portal radius (scene units)
const NAMES = ['INPUT', 'SINAL', 'CÓDIGO', 'FÍSICA', 'GAME FEEL', 'SPRITE', 'SOM', 'FRAME', 'JOGADOR'];
const HUDW = ['INPUT', 'SIGNAL', 'DATA', 'PROCESS', 'FEEL', 'PIXEL', 'AUDIO', 'OUTPUT', 'PLAYER'];

// continuous stage index: dwell on each stage, then dive into its bit, arriving on the bar line
function U(lt) {
  if (lt < LOOP) { const k = Math.floor(lt / STAGE), f = (lt % STAGE) / STAGE; return k + E.inOutCubic(clamp((f - 0.5) / 0.5)); }
  return c7.u(lt);
}
let dens = 0;

const SPRITE = [
  '................', '....oooooooo....', '...occccccccso..', '...occccccccso..', '...onnnnnnnnso..', '...onwwnnnwwso..',
  '...onnnnnnnnso..', '...oddddddddso..', '....oaaaaaaoo...', '...ossssssssa...', '..ocssssssssao..', '..ocssssssssoo..',
  '...odddddddo....', '...oddo..oddo...', '...oddo..oddo...', '...oooo..oooo...',
];
const SPAL = { o: '#0c2430', c: P.cyan, s: P.sky, d: P.deep, w: '#ffffff', n: P.face, a: P.amber };

// ── stage scenes, in scene units (screen = ±960 × ±540 at scale 1); the bit/portal sits at (0,0), radius PR
const SC = [
  function input(ctx, t) {
    bg2(ctx, '#070d18');
    ring(ctx, 0, 0, 170, rgba(P.soft, 0.5), 6); ring(ctx, 0, 0, 120, rgba(P.cyan, 0.9), 10);
    for (let k = 0; k < 4 + dens * 6; k++) { const p = ((t * 0.9 + k / 4) % 1); ring(ctx, 0, 0, 170 + p * 500, rgba(P.cyan, (1 - p) * 0.5), 3); }
    ctx.strokeStyle = rgba(P.soft, 0.4); ctx.lineWidth = 8;
    ctx.strokeRect(-640, -40, 160, 80); ctx.strokeRect(-600, -80, 80, 160);
    [[430, -130], [560, 0], [430, 130], [300, 0]].forEach(([x, y]) => ring(ctx, x, y, 44, rgba(P.soft, 0.4), 6));
    txt(ctx, 'Input.is_action_just_pressed("jump")', 0, -330, 30, P.soft);
  },
  function signal(ctx, t) {
    bg2(ctx, '#06121a');
    for (let k = 0; k < 18 + dens * 18; k++) {
      const an = k / (18 + dens * 18) * TAU, r0 = 900, mid = 300 + hash(k) * 300;
      const x0 = Math.cos(an) * r0, y0 = Math.sin(an) * r0 * 0.6, xm = Math.cos(an) * mid, ym = Math.sin(an) * mid * 0.6;
      ctx.strokeStyle = rgba(P.sky, 0.35); ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xm, y0); ctx.lineTo(xm, ym); ctx.lineTo(Math.cos(an) * PR, Math.sin(an) * PR); ctx.stroke();
      const f = (t * 0.8 + hash(k * 3)) % 1;
      const px = f < 0.5 ? lerp(x0, xm, f * 2) : lerp(xm, Math.cos(an) * PR, (f - 0.5) * 2), py = f < 0.5 ? y0 : lerp(y0, Math.sin(an) * PR, (f - 0.5) * 2);
      ctx.fillStyle = P.white; ctx.fillRect(px - 9, py - 9, 18, 18);
    }
    ring(ctx, 0, 0, PR + 26, rgba(P.cyan, 0.9), 10);
  },
  function code(ctx, t) {
    bg2(ctx, '#0a1424');
    const lines = ['func _physics_process(delta):', '    velocity.y += gravity * delta', '    if Input.is_action_just_pressed("jump"):', '        velocity.y = JUMP', '    move_and_slide()'];
    ctx.fillStyle = rgba(P.cyan, 0.12); ctx.fillRect(-960, -40, 1920, 80);
    lines.forEach((s, i) => txt(ctx, s, -80, (i - 3) * 90, 46, i === 3 ? P.text : P.dim, 'right'));
    for (let k = 0; k < dens * 30; k++) txt(ctx, '0x' + Math.floor(hash(k + Math.floor(t * 8)) * 65535).toString(16), (hash(k * 3) - 0.5) * 1800, (hash(k * 5) - 0.5) * 1000, 24, P.faint);
    ring(ctx, 0, 0, PR, rgba(P.amber, 1), 8);
  },
  function physics(ctx, t) {
    bg2(ctx, '#08101e');
    ctx.strokeStyle = rgba(P.soft, 0.08); ctx.lineWidth = 3;
    for (let x = -960; x <= 960; x += 120) seg(ctx, x, -540, x, 540);
    for (let y = -540; y <= 540; y += 120) seg(ctx, -960, y, 960, y);
    ctx.strokeStyle = rgba(P.text, 0.6); ctx.lineWidth = 6; ctx.setLineDash([20, 20]); ctx.beginPath();
    for (let u = -1; u <= 1; u += 0.02) { const x = u * 700, y = u * u * 420; u > -1 ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    for (let k = -4; k <= 4; k++) if (k) { const u = k / 5; ring(ctx, u * 700, u * u * 420, PR, rgba(P.sky, 0.25), 4); }
    arrowS(ctx, 0, 0, 260, 0, P.cyan); arrowS(ctx, 0, 90, 0, 300, P.amber);
    txt(ctx, 'v', 280, -30, 40, P.cyan); txt(ctx, 'g', 30, 330, 40, P.amber);
  },
  function feel(ctx, t) {
    bg2(ctx, '#0b0d22');
    for (let k = 0; k < 24 + dens * 30; k++) {
      const an = hash(k) * TAU, r0 = 120 + ((t * 600 + hash(k * 3) * 800) % 800);
      ctx.strokeStyle = rgba(k % 3 ? P.white : P.amber, 0.7); ctx.lineWidth = 10;
      seg(ctx, Math.cos(an) * r0, Math.sin(an) * r0, Math.cos(an) * (r0 + 120), Math.sin(an) * (r0 + 120));
    }
    for (let k = 0; k < 3; k++) { const p = ((t * 1.3 + k / 3) % 1); ring(ctx, 0, 0, PR + p * 600, rgba(P.white, (1 - p) * 0.8), 12 * (1 - p) + 2); }
    txt(ctx, 'PESO · ACELERAÇÃO · RECUO · PAUSA DE IMPACTO', 0, -380, 36, P.soft);
  },
  function pixel(ctx, t) {
    bg2(ctx, '#05090f');
    const c = 96; // the white eye pixel (row 5, col 5) sits on the portal
    SPRITE.forEach((r, i) => [...r].forEach((ch, j) => {
      if (ch === '.') return; ctx.fillStyle = SPAL[ch];
      ctx.fillRect((j - 5.5) * c, (i - 5.5) * c, c - 4, c - 4);
    }));
    ring(ctx, 0, 0, PR + 6, rgba(P.white, 1), 6);
  },
  function sound(ctx, t) {
    bg2(ctx, '#071019');
    const n = 96;
    for (let k = 0; k < n; k++) {
      const an = k / n * TAU, a = 40 + Math.abs(noise1(k * 0.4 + t * 6)) * (240 + dens * 260) * (0.6 + 0.4 * Math.sin(t * 9 + k));
      ctx.strokeStyle = k % 8 ? P.cyan : P.white; ctx.lineWidth = 14;
      seg(ctx, Math.cos(an) * 110, Math.sin(an) * 110, Math.cos(an) * (110 + a), Math.sin(an) * (110 + a));
    }
    ring(ctx, 0, 0, PR + 20, rgba(P.sky, 0.9), 6);
  },
  function frame(ctx, t) {
    const g = ctx.createLinearGradient(0, -540, 0, 540); g.addColorStop(0, '#0d1b33'); g.addColorStop(1, '#16335a');
    ctx.fillStyle = g; ctx.fillRect(-3000, -3000, 6000, 6000);
    ctx.fillStyle = '#132a4a'; ctx.beginPath(); ctx.moveTo(-960, 300);
    for (let x = -960; x <= 960; x += 20) ctx.lineTo(x, 150 - 120 * (0.5 + 0.5 * noise1(x * 0.004 + t * 0.4))); ctx.lineTo(960, 300); ctx.fill();
    for (let k = -12; k < 13; k++) { ctx.fillStyle = k % 2 ? P.face : P.navy; ctx.fillRect(k * 80 - ((t * 200) % 160), 300, 80, 240); ctx.fillStyle = P.sky; ctx.fillRect(k * 80 - ((t * 200) % 160), 300, 80, 12); }
    for (let k = 0; k < 6; k++) isoCube(ctx, -700 + k * 280 - ((t * 200) % 280), -160 + Math.sin(t * 4 + k) * 20, 28, CUBE_PAL.brand, 0.9);
    isoCube(ctx, 0, 0, 74, CUBE_PAL.brand, 1);
    txt(ctx, 'BITS 042', -880, -480, 40, P.text, 'left'); txt(ctx, '▶ PLAY', 880, -480, 40, P.mint, 'right');
  },
  function player(ctx, t) {
    bg2(ctx, '#0a0f1f');
    for (let k = 0; k < 6; k++) { const p = ((t * 0.7 + k / 6) % 1); ring(ctx, 0, 0, 160 + p * 800, rgba(P.cyan, (1 - p) * 0.35), 4); }
    ctx.strokeStyle = P.cyan; ctx.lineWidth = 14; ctx.lineCap = 'round';
    const a0 = t * 2; ctx.beginPath(); ctx.arc(0, 0, 130, a0, a0 + TAU * 0.8); ctx.stroke();
    const ax = Math.cos(a0 + TAU * 0.8) * 130, ay = Math.sin(a0 + TAU * 0.8) * 130, ta = a0 + TAU * 0.8 + Math.PI / 2;
    ctx.fillStyle = P.cyan; ctx.beginPath(); ctx.moveTo(ax + Math.cos(ta) * 30, ay + Math.sin(ta) * 30); ctx.lineTo(ax + Math.cos(ta + 2.3) * 30, ay + Math.sin(ta + 2.3) * 30); ctx.lineTo(ax + Math.cos(ta - 2.3) * 30, ay + Math.sin(ta - 2.3) * 30); ctx.fill();
    txt(ctx, 'dá vontade de repetir', 0, -300, 52, P.text);
  },
];
function bg2(ctx, col) { ctx.fillStyle = col; ctx.fillRect(-3000, -3000, 6000, 6000); }
function ring(ctx, x, y, r, col, lw) { ctx.strokeStyle = col; ctx.lineWidth = lw; circle(ctx, x, y, r); ctx.stroke(); }
function txt(ctx, s, x, y, size, col, align = 'center') { font(ctx, 'JB', size, 500); ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
function arrowS(ctx, x0, y0, x1, y1, col) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 10; seg(ctx, x0, y0, x1, y1);
  const a = Math.atan2(y1 - y0, x1 - x0); ctx.beginPath(); ctx.moveTo(x1 + Math.cos(a) * 30, y1 + Math.sin(a) * 30);
  ctx.lineTo(x1 + Math.cos(a + 2.4) * 34, y1 + Math.sin(a + 2.4) * 34); ctx.lineTo(x1 + Math.cos(a - 2.4) * 34, y1 + Math.sin(a - 2.4) * 34); ctx.fill();
}

function level(ctx, j, u, lt, depth) {
  const s = Math.pow(Z, u - j);
  if (s * PR * Z < 1.5) return; // too small to see
  ctx.save();
  ctx.translate(CX, CY); ctx.rotate((u - j) * 0.22); ctx.scale(s, s);
  SC[((j % 9) + 9) % 9](ctx, lt);
  ctx.restore();
  if (depth > 0) {
    // the bit is a lens onto the next stage
    ctx.save(); ctx.beginPath(); ctx.arc(CX, CY, PR * s, 0, TAU); ctx.clip();
    level(ctx, j + 1, u, lt, depth - 1);
    ctx.restore();
    ctx.strokeStyle = rgba(P.white, clamp(0.9 - (s - 1) * 0.08)); ctx.lineWidth = 2; circle(ctx, CX, CY, PR * s); ctx.stroke();
  }
}

function draw(ctx, lt) {
  bg(ctx, '#000');
  if (lt >= CUT) {
    // silence. black. one small point.
    const p = E.outBack(prog(lt, DOT, DOT + 0.3), 3);
    if (p > 0) { glow(ctx, CX, CY, 50 * p, P.cyan, 0.35); ctx.fillStyle = P.white; circle(ctx, CX, CY, 5 * p); ctx.fill(); }
    return;
  }
  dens = prog(lt, LOOP, PEAK);
  const u = U(lt);
  const j0 = Math.floor(u);
  level(ctx, j0, u, lt, 2);
  // stage title (screen space), only while dwelling
  const k = ((Math.round(u) % 9) + 9) % 9;
  const dwell = lt < LOOP ? 1 - Math.abs(u - Math.round(u)) * 4 : 0.6;
  if (dwell > 0) {
    const a = clamp(dwell);
    label(ctx, `${String(k + 1).padStart(2, '0')} — ${HUDW[k]}`, 120, H - 230, a * 0.8, P.cyan, 15);
    ctx.save(); font(ctx, 'SG', 110, 700); ctx.fillStyle = rgba(P.text, a); ctx.textBaseline = 'alphabetic';
    ctx.fillText(lt < LOOP ? NAMES[k] : scramble(NAMES[k], 0.6, Math.floor(lt * 30)), 112, H - 120); ctx.restore();
  }
  // the stage strip: where the bit is in the system
  const sa = 1 - prog(lt, PEAK, PEAK + 0.4);
  NAMES.forEach((n, i) => {
    const x = W - 120 - (8 - i) * 36, on = i === k;
    ctx.fillStyle = rgba(on ? P.cyan : P.soft, (on ? 1 : 0.3) * sa); ctx.fillRect(x, H - 140, 26, on ? 8 : 4);
  });
  // the peak: maximal, then removed
  if (lt > PEAK) { const f = prog(lt, PEAK, CUT); ctx.fillStyle = rgba('#ffffff', 0.15 + 0.5 * f * f); ctx.fillRect(0, 0, W, H); }
}

(window.CHAPTERS = window.CHAPTERS || [])[6] = {
  draw,
  fx: lt => ({ bloom: lt < CUT ? 0.45 : 0.6, grain: lt < CUT ? 0.05 : 0.03, rgb: lt > LOOP && lt < CUT ? prog(lt, LOOP, PEAK) * 6 : 0, scan: lt > LOOP && lt < CUT ? 0.08 * prog(lt, LOOP, PEAK) : 0 }),
  hud: lt => (lt < CUT ? { word: HUDW[((Math.round(U(lt)) % 9) + 9) % 9] } : null),
};
})();

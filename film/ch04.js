// CH04 — O MÉTODO (1:25–1:55)
// The studio's way of working as a pipeline you can watch (scorpionbits.com):
// "Do protótipo de uma mecânica ao jogo fechado, com arte, animação e trilha feitas junto."
// "Peso, aceleração, recuo, pausa de impacto. É o que separa um comando que funciona de um que dá vontade de repetir."
// "Do sprite à trilha, tudo é produzido internamente."
// One character travels through the stages and changes nature at each one.
(function () {
const { W, H, CX, CY, TAU, P, clamp, lerp, prog, E, spring, hash, noise1, noise2, rgba, bg, font, circle, glow, seg,
  label, scramble, typed, iso, isoCube, CUBE_PAL, isoGrid, statement } = CORE;
const { B, c4, STAGES } = TL;
const T0 = TL.CH[3];
const ST = c4.stages.map(t => t - T0);           // 0, 5, 10, 15, 20, 25
const FEEL = c4.feel.map(t => t - T0);
const PIX = c4.pix.map(t => t - T0);
const FLOOR = CY + 150;

// a 16×16 pixel hero, original to this film (palette from the brand)
const SPRITE = [
  '................', '....oooooooo....', '...occccccccso..', '...occccccccso..', '...onnnnnnnnso..', '...onwwnnnwwso..',
  '...onnnnnnnnso..', '...oddddddddso..', '....oaaaaaaoo...', '...ossssssssa...', '..ocssssssssao..', '..ocssssssssoo..',
  '...odddddddo....', '...oddo..oddo...', '...oddo..oddo...', '...oooo..oooo...',
];
const SPAL = { o: '#0c2430', c: P.cyan, s: P.sky, d: P.deep, w: '#ffffff', n: P.face, a: P.amber };
function sprite(ctx, x, y, cell, rows = 16, a = 1, bob = 0) {
  ctx.save(); ctx.globalAlpha *= a;
  for (let r = 15; r >= 16 - rows; r--) for (let c = 0; c < 16; c++) {
    const ch = SPRITE[r][c]; if (ch === '.') continue;
    ctx.fillStyle = SPAL[ch];
    const legs = r >= 13 ? Math.round(bob) * (c < 8 ? 1 : -1) : 0;
    ctx.fillRect(Math.round(x + (c - 8) * cell), Math.round(y + (r - 16) * cell + (r < 13 ? -Math.abs(bob) : legs)), cell + 0.5, cell + 0.5);
  }
  ctx.restore();
}

function capsule(ctx, x, y, w, h, fill, line, sx = 1, sy = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
  ctx.beginPath(); ctx.roundRect(-w / 2, -h, w, h, w / 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = 3; ctx.stroke(); }
  ctx.restore();
}

// pipeline header: six stations, progress, the travelling bit
function header(ctx, lt) {
  const a = E.outCubic(prog(lt, 0.2, 1));
  const xs = STAGES.map((_, i) => CX + (i - 2.5) * 290), y = 140;
  const cur = Math.min(5, Math.floor(lt / 5) + (lt < 0 ? -1 : 0));
  const pr = clamp((lt - 0.6) / 25);
  ctx.save(); ctx.globalAlpha = a;
  ctx.strokeStyle = rgba(P.soft, 0.18); ctx.lineWidth = 2; seg(ctx, xs[0], y, xs[5], y);
  const px = lerp(xs[0], xs[5], E.inOutSine(clamp(lt / 25)));
  ctx.strokeStyle = rgba(P.cyan, 0.8); seg(ctx, xs[0], y, px, y);
  STAGES.forEach((s, i) => {
    const on = i <= cur, now = i === cur;
    ctx.fillStyle = on ? P.cyan : P.ink; ctx.strokeStyle = on ? P.cyan : rgba(P.soft, 0.4); ctx.lineWidth = 2;
    circle(ctx, xs[i], y, now ? 8 : 6); ctx.fill(); ctx.stroke();
    if (now) { ctx.strokeStyle = rgba(P.cyan, 0.5 * (1 - ((lt * 1.6) % 1))); circle(ctx, xs[i], y, 8 + ((lt * 1.6) % 1) * 18); ctx.stroke(); }
    label(ctx, s, xs[i], y + 36, now ? 1 : on ? 0.65 : 0.3, now ? P.text : P.soft, 15, 'center');
  });
  ctx.fillStyle = P.white; ctx.fillRect(px - 4, y - 4, 8, 8);
  ctx.restore();
  return cur;
}

// sketchy stroke along a path with hand jitter, drawn progressively
function sketch(ctx, pts, p, col, seed, wob = 5) {
  const n = Math.floor(pts.length * clamp(p));
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = rgba(col, pass ? 0.45 : 0.9); ctx.lineWidth = pass ? 1.2 : 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[i];
      const jx = noise1(i * 0.21 + seed + pass * 40) * wob, jy = noise1(i * 0.23 + seed + 9 + pass * 40) * wob;
      i ? ctx.lineTo(x + jx, y + jy) : ctx.moveTo(x + jx, y + jy);
    }
    ctx.stroke();
  }
}
function capsulePath(x, y, w, h, n = 90) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n * TAU;
    // superellipse-ish capsule
    const cx = Math.cos(u), sy = Math.sin(u);
    pts.push([x + Math.sign(cx) * Math.pow(Math.abs(cx), 0.7) * w / 2, y - h / 2 + Math.sign(sy) * Math.pow(Math.abs(sy), 0.9) * h / 2]);
  }
  return pts;
}

function draw(ctx, lt) {
  const later = [], say = (...args) => later.push(() => statement(...args));
  bg(ctx, P.ink);
  const stage = Math.min(5, Math.floor(lt / 5));
  // environment slide between stations
  const slide = i => (i - (stage + E.inOutExpo(prog(lt % 5, 4.6, 5.0)) * (stage < 5 ? 1 : 0))) * 1500;
  // background grid: graph paper in prototype/mechanics, iso grid elsewhere
  isoGrid(ctx, 70, -lt * 30, 0, 0.035);

  // giant faint stage word behind
  ctx.save(); font(ctx, 'SG', 300, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  STAGES.forEach((s, i) => {
    const ox = slide(i); if (Math.abs(ox) > 1800) return;
    ctx.strokeStyle = rgba(P.soft, 0.09); ctx.lineWidth = 2; ctx.strokeText(s, CX + ox, CY - 10);
  });
  ctx.restore();
  header(ctx, lt);
  const SC = 1.35;
  ctx.save(); ctx.translate(CX, FLOOR); ctx.scale(SC, SC); ctx.translate(-CX, -FLOOR);

  const hx = CX;
  // ── 0 · IDEIA: a point, then the first loose sketch
  if (lt < ST[1] + 0.6) {
    const ox = slide(0);
    const fly = E.inOutExpo(prog(lt, 0, 1.2));
    const px = lerp(240, hx, fly), py = lerp(CY, FLOOR - 60, fly);
    const morph = prog(lt, ST[1] - 0.4, ST[1] + 0.4);
    ctx.save(); ctx.translate(ox * 0.2, 0);
    if (lt > 1.0) {
      sketch(ctx, capsulePath(hx, FLOOR, 74, 118), prog(lt, 1.1, 2.6), P.amber, 3);
      const arc = []; for (let u = 0; u <= 1; u += 0.02) arc.push([hx + 60 + u * 340, FLOOR - 90 - Math.sin(u * Math.PI) * 190]);
      sketch(ctx, arc, prog(lt, 2.5, 3.4), P.amber, 7, 4);
      // arrow head
      if (lt > 3.4) sketch(ctx, [[hx + 380, FLOOR - 120], [hx + 402, FLOOR - 88], [hx + 370, FLOOR - 84]], prog(lt, 3.4, 3.6), P.amber, 11, 2);
      // little burst of "!"
      const bp = prog(lt, 3.6, 4.2);
      for (let k = 0; k < 6; k++) {
        const an = -Math.PI / 2 + (k - 2.5) * 0.35;
        sketch(ctx, [[hx + Math.cos(an) * 90, FLOOR - 180 + Math.sin(an) * 50], [hx + Math.cos(an) * (90 + 40 * bp), FLOOR - 180 + Math.sin(an) * (50 + 40 * bp)]], bp, P.amber, k * 3, 2);
      }
    }
    ctx.restore();
    if (morph < 1) {
      glow(ctx, px, py, 70, P.cyan, 0.5 * (1 - morph));
      ctx.fillStyle = P.white; circle(ctx, px + (lt > 1.2 ? Math.cos(lt * 5) * 30 * (1 - morph) : 0), py + (lt > 1.2 ? Math.sin(lt * 7) * 20 * (1 - morph) : 0), 6 * (1 - morph)); ctx.fill();
    }
  }

  // ── 1 · PROTÓTIPO: greybox. Stiff, linear, honest.
  if (lt >= ST[1] - 0.4 && lt < ST[2] + 0.6) {
    const ox = slide(1);
    ctx.save(); ctx.translate(ox, 0);
    const boxes = [[-520, 0, 260, 26], [180, -150, 200, 26], [-200, -260, 160, 26], [430, -40, 180, 26]];
    boxes.forEach(([x, y, w, h], i) => {
      const a = E.outBack(prog(lt, ST[1] + i * 0.12, ST[1] + 0.4 + i * 0.12));
      ctx.fillStyle = rgba('#6b7a8c', 0.9 * a); ctx.fillRect(hx + x, FLOOR + y, w * a, h);
      label(ctx, `box_${i}`, hx + x, FLOOR + y + 46, 0.4 * a, P.dim, 11);
    });
    ctx.fillStyle = rgba('#6b7a8c', 0.5); ctx.fillRect(hx - 900, FLOOR, 1800, 4);
    ctx.restore();
  }
  // ── 2 · MECÂNICA: rules made visible
  if (lt >= ST[2] - 0.4 && lt < ST[3] + 0.6) {
    const ox = slide(2);
    ctx.save(); ctx.translate(ox, 0);
    // state machine
    const states = ['IDLE', 'RUN', 'JUMP', 'FALL'];
    const ph = ((lt - ST[2]) % (B * 4)) / (B * 4);
    const active = ph < 0.25 ? 0 : ph < 0.5 ? 1 : ph < 0.72 ? 2 : 3;
    const sx0 = hx + 430, sy0 = CY - 170;
    states.forEach((s, i) => {
      const x = sx0 + (i % 2) * 180, y = sy0 + Math.floor(i / 2) * 90;
      const on = i === active;
      ctx.strokeStyle = on ? P.cyan : rgba(P.soft, 0.35); ctx.lineWidth = 2; ctx.fillStyle = on ? rgba(P.cyan, 0.15) : 'transparent';
      ctx.beginPath(); ctx.roundRect(x - 70, y - 24, 140, 48, 24); ctx.fill(); ctx.stroke();
      label(ctx, s, x, y, on ? 1 : 0.5, on ? P.text : P.soft, 14, 'center');
    });
    ctx.strokeStyle = rgba(P.soft, 0.3);
    seg(ctx, sx0 + 70, sy0, sx0 + 110, sy0); seg(ctx, sx0 + 180, sy0 + 24, sx0 + 180, sy0 + 66); seg(ctx, sx0 + 110, sy0 + 90, sx0 + 70, sy0 + 90); seg(ctx, sx0, sy0 + 66, sx0, sy0 + 24);
    label(ctx, 'STATE MACHINE', sx0 + 90, sy0 - 60, 0.5, P.dim, 12, 'center');
    ctx.fillStyle = rgba('#6b7a8c', 0.5); ctx.fillRect(hx - 900, FLOOR, 1800, 4);
    ctx.restore();
  }
  // ── 3 · GAME FEEL: peso, aceleração, recuo, pausa de impacto
  const words = ['PESO', 'ACELERAÇÃO', 'RECUO', 'PAUSA DE IMPACTO'];
  if (lt >= ST[3] - 0.4 && lt < ST[4] + 0.6) {
    const ox = slide(3);
    ctx.save(); ctx.translate(ox, 0);
    ctx.fillStyle = rgba(P.soft, 0.4); ctx.fillRect(hx - 900, FLOOR, 1800, 4);
    let k = -1; FEEL.forEach((t, i) => { if (lt >= t) k = i; });
    if (k >= 0 && lt < 18.2) later.push(() => {
      const p = prog(lt, FEEL[k], FEEL[k] + 0.25);
      ctx.save(); ctx.translate(hx, CY - 230); const sc = lerp(1.6, 1, E.outBack(p, 2)); ctx.scale(sc, sc);
      font(ctx, 'SG', 130, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(k === 3 ? P.cyan : P.text, clamp(p * 3)); ctx.fillText(words[k], 0, 0);
      ctx.restore();
      label(ctx, `0${k + 1} / 04`, hx, CY - 120, 0.6, P.dim, 13, 'center');
    });
    // acceleration graph
    if (lt > FEEL[1] && lt < FEEL[2] + 0.5) {
      const gp = prog(lt, FEEL[1], FEEL[1] + 0.7), gx = hx - 640, gy = FLOOR - 40;
      ctx.strokeStyle = rgba(P.soft, 0.4); ctx.lineWidth = 1.5; seg(ctx, gx, gy, gx + 240, gy); seg(ctx, gx, gy, gx, gy - 150);
      ctx.strokeStyle = P.cyan; ctx.lineWidth = 3; ctx.beginPath();
      for (let u = 0; u <= gp; u += 0.02) { const y = gy - E.outCubic(u) * 140; u ? ctx.lineTo(gx + u * 240, y) : ctx.moveTo(gx, y); }
      ctx.stroke(); label(ctx, 'v(t)', gx + 8, gy - 168, 0.6, P.dim, 12);
    }
    ctx.restore();
    if (lt > 18.15) say(ctx, [
      { text: 'É o que separa um comando que funciona', size: 46, wght: 600, fam: 'SG', col: P.text, lh: 1.25 },
      { text: 'de um que dá vontade de repetir.', size: 46, wght: 600, fam: 'SG', col: P.cyan },
    ], CX, CY - 250, lt, 18.2, ST[4] - 0.5, { align: 'center' });
  }
  // ── 4 · ARTE & SOM: the sprite is painted row by row, each row a note of the trilha
  if (lt >= ST[4] - 0.4 && lt < ST[5] + 0.6) {
    const ox = slide(4);
    ctx.save(); ctx.translate(ox, 0);
    // palette swatches
    Object.values(SPAL).forEach((c, i) => {
      const a = E.outBack(prog(lt, ST[4] + i * 0.08, ST[4] + 0.4 + i * 0.08));
      ctx.fillStyle = c; ctx.fillRect(hx - 520, CY - 190 + i * 46, 36 * a, 36);
    });
    label(ctx, 'PIXEL ART', hx - 520, CY - 230, 0.6, P.dim, 12);
    // piano roll
    const rx = hx + 300, ry = CY - 200, cw = 22, rh = 16;
    const roll = c4.roll, lo = Math.min(...roll), hi = Math.max(...roll);
    ctx.strokeStyle = rgba(P.soft, 0.12); ctx.lineWidth = 1;
    for (let r = 0; r <= hi - lo; r++) seg(ctx, rx, ry + r * rh, rx + 16 * cw, ry + r * rh);
    for (let s = 0; s <= 16; s++) { ctx.strokeStyle = rgba(P.soft, s % 4 ? 0.08 : 0.22); seg(ctx, rx + s * cw, ry, rx + s * cw, ry + (hi - lo) * rh); }
    roll.forEach((m, s) => {
      const on = lt >= PIX[s], hot = on && lt < PIX[s] + B / 2;
      ctx.fillStyle = hot ? P.white : on ? P.cyan : rgba(P.soft, 0.18);
      ctx.fillRect(rx + s * cw + 2, ry + (hi - m) * rh - rh / 2 + 2, cw - 4, rh - 4);
    });
    const ph = clamp((lt - PIX[0]) / (B * 8));
    if (ph > 0 && ph < 1) { ctx.fillStyle = P.amber; ctx.fillRect(rx + ph * 16 * cw, ry - 10, 2, (hi - lo) * rh + 20); }
    label(ctx, 'TRILHA', rx, ry - 40, 0.6, P.dim, 12);
    ctx.restore();
    say(ctx, [
      { text: 'Do sprite à trilha,', size: 60, wght: 700, fam: 'SG', col: P.text, lh: 1.15 },
      { text: 'tudo é produzido internamente.', size: 44, wght: 300, col: P.soft },
    ], CX, H - 190, lt, ST[4] + 0.6, ST[5] - 0.5, { align: 'center' });
  }

  // ── the hero, in camera space
  if (lt >= ST[1] - 0.4 && lt < ST[5] + 0.2) {
    let x = hx, y = FLOOR, sx = 1, sy = 1, look = stage;
    if (lt < ST[2]) {
      // greybox: linear patrol + triangle-wave hop (no easing on purpose)
      const tt = lt - ST[1];
      const fromSketch = prog(lt, ST[1] - 0.4, ST[1] + 0.2);
      x = hx + (tt > 0.6 ? Math.abs(((tt - 0.6) * 0.5) % 2 - 1) * 2 - 1 : -1) * 120 + 120;
      const hop = ((tt * 1.2) % 1); y = FLOOR - (hop < 0.5 ? hop : 1 - hop) * 2 * 110 * (tt > 1.2 ? 1 : 0);
      capsule(ctx, x, y, 74, 118, rgba('#6b7a8c', fromSketch), null);
      label(ctx, 'player_placeholder', x, y - 145, 0.5 * fromSketch, P.dim, 11, 'center');
    } else if (lt < ST[3]) {
      // mechanics: run / jump / fall with debug overlay
      const ph = ((lt - ST[2]) % (B * 4)) / (B * 4);
      x = hx - 160 + Math.sin(ph * TAU) * 160;
      const j = ph > 0.5 ? clamp((ph - 0.5) / 0.45) : 0; y = FLOOR - 4 * 160 * j * (1 - j);
      capsule(ctx, x, y, 74, 118, rgba(P.sky, 0.25), P.sky);
      ctx.setLineDash([6, 6]); ctx.strokeStyle = rgba(P.amber, 0.8); ctx.lineWidth = 1.5; ctx.strokeRect(x - 42, y - 124, 84, 124); ctx.setLineDash([]);
      // velocity + gravity vectors
      const vx = Math.cos(ph * TAU) * 120, vy = -(1 - 2 * j) * 150 * (j > 0 ? 1 : 0);
      arrow(ctx, x, y - 60, x + vx, y - 60 + vy, P.cyan, 'v');
      arrow(ctx, x + 70, y - 100, x + 70, y - 30, P.amber, 'g');
      // predicted trajectory
      ctx.setLineDash([3, 7]); ctx.strokeStyle = rgba(P.text, 0.5); ctx.beginPath();
      for (let u = 0; u <= 1; u += 0.05) { const xx = x + u * 300, yy = FLOOR - 60 - 4 * 160 * u * (1 - u); u ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.stroke(); ctx.setLineDash([]);
      label(ctx, `vel ${vx.toFixed(0).padStart(4)}, ${vy.toFixed(0).padStart(4)}`, x, y - 160, 0.6, P.dim, 11, 'center');
    } else if (lt < ST[4]) {
      // game feel demonstrations
      const [t1, t2, t3, t4] = FEEL;
      x = hx; y = FLOOR;
      if (lt < t2) { // PESO: fall + heavy land
        const f = prog(lt, ST[3], t1), land = lt >= t1 ? Math.exp(-(lt - t1) * 9) : 0;
        y = FLOOR - (1 - E.inCubic(f)) * 520 * (lt < t1 ? 1 : 0);
        sy = lt < t1 ? 1.15 : 1 - 0.42 * land * Math.cos((lt - t1) * 18); sx = 1 / sy;
        if (lt >= t1) dust(ctx, x, FLOOR, lt - t1);
      } else if (lt < t3) { // ACELERAÇÃO: dash with ease-in and lean
        const d = prog(lt, t2, t2 + 0.6), back = prog(lt, t2 + 0.65, t3);
        x = hx + E.inCubic(d) * 380 - E.inOutCubic(back) * 380; sx = 1 + 0.25 * Math.sin(Math.PI * d); sy = 1 / sx;
        if (d > 0.2 && d < 1) for (let k = 0; k < 6; k++) { ctx.strokeStyle = rgba(P.cyan, 0.5); seg(ctx, x - 60 - k * 24 - d * 40, FLOOR - 20 - k * 16, x - 120 - k * 30, FLOOR - 20 - k * 16); }
      } else if (lt < t4) { // RECUO: hit by a projectile, knocked back
        const inc = prog(lt, t3 - 0.25, t3), kb = prog(lt, t3, t3 + 0.5);
        ctx.save(); isoCube(ctx, lerp(hx + 700, hx + 40, inc), FLOOR - 60, 16, CUBE_PAL.amber, 1 - kb * 3); ctx.restore();
        x = hx - E.outCubic(kb) * 160 + E.inOutCubic(prog(lt, t3 + 0.5, t4)) * 160; sx = 1 - 0.2 * Math.exp(-(lt - t3) * 10) * (lt > t3 ? 1 : 0); sy = 1 / sx;
        if (lt > t3) sparks(ctx, hx + 40, FLOOR - 60, lt - t3, P.amber);
      } else { // PAUSA DE IMPACTO: the whole film holds its breath
        const hit = lt - t4;
        x = hx; sx = 1.1; sy = 0.9;
        if (hit < 0.6) { sparks(ctx, hx + 30, FLOOR - 70, Math.max(0.02, hit), P.white, 18); ctx.strokeStyle = rgba(P.white, 0.9 * (1 - hit / 0.6)); ctx.lineWidth = 4; circle(ctx, hx + 30, FLOOR - 70, 40 + hit * 400); ctx.stroke(); }
        label(ctx, 'HIT-STOP · 6 FRAMES', hx, FLOOR + 50, 0.7 * (1 - prog(hit, 1, 1.5)), P.cyan, 13, 'center');
      }
      capsule(ctx, x, y, 74, 118, P.sky, '#0c2430', sx, sy);
    } else {
      // ART: the capsule becomes the sprite, row by row
      let rows = 0; PIX.forEach(t => { if (lt >= t) rows++; });
      const caps = 1 - prog(lt, ST[4], PIX[15] + 0.3);
      if (caps > 0) capsule(ctx, hx, FLOOR, 74, 118, rgba(P.sky, 0.3 * caps), rgba(P.sky, caps));
      if (lt < ST[5] - 0.1) {
        ctx.strokeStyle = rgba(P.soft, 0.08); ctx.lineWidth = 1;
        for (let k = 0; k <= 16; k++) { seg(ctx, hx - 80 + k * 10, FLOOR - 160, hx - 80 + k * 10, FLOOR); seg(ctx, hx - 80, FLOOR - 160 + k * 10, hx + 80, FLOOR - 160 + k * 10); }
        sprite(ctx, hx, FLOOR, 10, rows, 1);
      }
    }
  }

  ctx.restore();
  // ── 5 · JOGO: everything together in a frame
  if (lt >= ST[5] - 0.3) game(ctx, lt - ST[5]);
  if (lt < ST[5] + 1) say(ctx, [{ text: 'Do protótipo de uma mecânica ao jogo fechado,', size: 34, wght: 300, col: P.soft }],
    CX, H - 110, lt, ST[1] + 0.5, ST[2] - 0.6, { align: 'center' });
  say(ctx, [
    { text: 'Do protótipo de uma mecânica ao jogo fechado,', size: 36, wght: 300, col: P.soft, lh: 1.4 },
    { text: 'com arte, animação e trilha feitas junto.', size: 36, wght: 600, col: P.text },
  ], CX, H - 150, lt, ST[5] + 1.2, 28.6, { align: 'center' });
  if (lt >= ST[2] && lt < ST[3]) say(ctx, [{ text: 'Mecânicas polidas.', size: 64, wght: 700, fam: 'SG', col: P.text }], CX, H - 140, lt, ST[2] + 0.5, ST[3] - 0.5, { align: 'center' });
  later.forEach(f => f());
}

function arrow(ctx, x0, y0, x1, y1, col, txt) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5; seg(ctx, x0, y0, x1, y1);
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.4) * 12, y1 - Math.sin(a - 0.4) * 12); ctx.lineTo(x1 - Math.cos(a + 0.4) * 12, y1 - Math.sin(a + 0.4) * 12); ctx.fill();
  label(ctx, txt, x1 + 10, y1, 0.8, col, 12);
}
function dust(ctx, x, y, t) {
  for (let k = 0; k < 14; k++) {
    const d = (k % 2 ? 1 : -1) * (40 + E.outCubic(clamp(t * 2)) * (80 + hash(k) * 120));
    ctx.fillStyle = rgba(P.soft, 0.5 * (1 - clamp(t * 1.4)));
    circle(ctx, x + d, y - 6 - hash(k * 3) * 20 * clamp(t * 3), 4 + hash(k * 7) * 8 * clamp(t * 2)); ctx.fill();
  }
}
function sparks(ctx, x, y, t, col, n = 12) {
  for (let k = 0; k < n; k++) {
    const a = hash(k * 2.7) * TAU, r = E.outCubic(clamp(t * 2.5)) * (60 + hash(k) * 120);
    ctx.strokeStyle = rgba(col, 1 - clamp(t * 1.6)); ctx.lineWidth = 3;
    seg(ctx, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
}

// the finished game, in a frame (all procedural)
function game(ctx, t) {
  const open = E.outExpo(prog(t, -0.3, 0.6));
  const close = E.inExpo(prog(t, 3.9, 5.0));
  const w = 1360 * open * (1 - close) + 120 * close, h = 700 * open * (1 - close) + 120 * close;
  const x0 = CX - w / 2, y0 = CY - h / 2 + 20 * (1 - close);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x0, y0, w, h, lerp(18, 60, close)); ctx.clip();
  const sky = ctx.createLinearGradient(0, y0, 0, y0 + h); sky.addColorStop(0, '#0d1b33'); sky.addColorStop(1, '#16335a');
  ctx.fillStyle = sky; ctx.fillRect(x0, y0, w, h);
  const scroll = t * 260;
  // parallax: far stars, mid iso hills, ground tiles
  for (let k = 0; k < 60; k++) { ctx.fillStyle = rgba(P.text, 0.3 + hash(k) * 0.5); ctx.fillRect(((hash(k * 3) * 2400 - scroll * 0.1) % 1200 + 1200) % 1200 + CX - 600, CY - 280 + hash(k * 5) * 300, 2, 2); }
  [[0.15, '#132a4a', 160, 0.004], [0.35, '#1a3a63', 110, 0.007]].forEach(([par, col, amp, f]) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, CY + 220);
    for (let xx = x0; xx <= x0 + w + 10; xx += 10) ctx.lineTo(xx, CY + 120 - amp * (0.5 + 0.5 * noise1((xx + scroll * par) * f)));
    ctx.lineTo(x0 + w, CY + 220); ctx.fill();
  });
  for (let k = 0; k < 8; k++) {
    const px = ((k * 420 - scroll * 0.75) % 3360 + 3360) % 3360 + CX - 1680, py = CY - 60 - (k % 3) * 70;
    for (let s = 0; s < 3; s++) { const [ix, iy] = iso(s, 0, 0, 22); isoCube(ctx, px + ix, py + iy, 22, CUBE_PAL.mid, 0.9); }
  }
  const gy = CY + 200;
  for (let k = -1; k < 40; k++) { const gx = CX - 600 + k * 40 - (scroll % 40); ctx.fillStyle = k % 2 ? P.face : P.navy; ctx.fillRect(gx, gy, 40, 120); ctx.fillStyle = P.sky; ctx.fillRect(gx, gy, 40, 6); }
  // bits to collect
  let score = 0;
  for (let k = 0; k < 12; k++) {
    const cx = CX - 300 + k * 230 - scroll, cy = gy - 140 - (k % 3) * 40;
    const got = cx < CX - 60; if (got) { score++; continue; }
    isoCube(ctx, cx, cy + Math.sin(t * 6 + k) * 6, 14, CUBE_PAL.brand, 1);
  }
  // hero runs and jumps on the beat
  const ph = (t % (B * 2)) / (B * 2), j = Math.sin(Math.PI * clamp(ph * 1.6)) * (ph < 0.62 ? 1 : 0);
  sprite(ctx, CX - 120, gy - j * 170, 8, 16, 1, Math.sin(t * 18) * 3 * (1 - j));
  // in-game HUD
  font(ctx, 'JB', 18, 500); ctx.fillStyle = P.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`BITS ${String(score).padStart(3, '0')}`, x0 + 30, y0 + 36);
  ctx.fillStyle = P.mint; ctx.fillText('▶ PLAY', x0 + w - 120, y0 + 36);
  if (close > 0) { ctx.fillStyle = rgba('#ffffff', close); ctx.fillRect(x0, y0, w, h); }
  ctx.restore();
  ctx.strokeStyle = rgba(P.soft, 0.5 * open * (1 - close)); ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, lerp(18, 60, close)); ctx.stroke();
  if (close > 0) glow(ctx, CX, CY, 200 * close, P.cyan, close);
}

(window.CHAPTERS = window.CHAPTERS || [])[3] = {
  draw,
  fx: lt => ({ bloom: 0.35, grain: 0.05 }),
  hud: () => ({ word: 'PROCESS' }),
};
})();

// CH06 — O QUE FAZEMOS (2:25–3:05)
// "Três formas de trabalhar junto": Produção de jogos, Ensino, Parcerias (scorpionbits.com/contato)
// and the real state of every project (scorpionbits.com/portfolio): "Nada aqui é vaporware."
(function () {
const { W, H, CX, CY, TAU, P, clamp, lerp, prog, E, spring, hash, noise1, noise2, rgba, mix, bg, font, circle, glow, seg,
  label, scramble, typed, iso, isoCube, CUBE_PAL, isoGrid, statement } = CORE;
const { B, c6 } = TL;
const T0 = TL.CH[5];
const L = k => c6[k] - T0;
const PJ = c6.projects.map(t => t - T0);

const PROJECTS = [
  { name: 'TIRANIA', status: 'NO AR', sc: P.mint, tags: 'AÇÃO 2D · PIXEL ART · WEB, WINDOWS E LINUX · GRATUITO',
    line: ['“Quando a coroa foge com a vida do povo,', 'resta a uma mulher trazer a justiça.”'], tint: '#2a0c10' },
  { name: 'ASTRODASH', status: 'NO AR', sc: P.mint, tags: 'PIXEL ART · GODOT · GRATUITO',
    line: ['Pilote entre meteoros e obstáculos', 'num jogo de gameplay direto e rápido.'], tint: '#07102a' },
  { name: 'TOWER DEFENCE', status: 'EM DESENVOLVIMENTO', sc: P.amber, tags: 'GODOT · CRAFTING · ÁRVORE DE HABILIDADES',
    line: ['Defesa de torres em que você fabrica as próprias torres.', 'Oito tipos de torre configurados.'], tint: '#0b1a1c' },
  { name: 'SITIS', status: 'PRÉ-PRODUÇÃO', sc: P.violet, tags: 'GODOT · TOP-DOWN · PIXEL ART',
    line: ['Presa numa dungeon onde a água é escassa:', 'uma única barra faz de vida e de energia.'], tint: '#061a24' },
  { name: 'PROJETO NOIR', status: 'PRÉ-PRODUÇÃO', sc: P.violet, tags: 'GODOT · INVESTIGAÇÃO · NOIR · NOME EM PLANEJAMENTO',
    line: ['Jogo de investigação com estética noir, em pixel art.', ''], tint: '#0e0e10' },
];

function badge(ctx, text, x, y, col, a) {
  ctx.save(); ctx.globalAlpha *= a; font(ctx, 'JB', 15, 500); ctx.letterSpacing = '3px';
  const w = ctx.measureText(text).width + 34;
  ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x, y - 16, w, 32, 16); ctx.stroke();
  ctx.fillStyle = col; circle(ctx, x + 16, y, 4); ctx.fill();
  ctx.textBaseline = 'middle'; ctx.fillText(text, x + 28, y + 1); ctx.restore();
}

// ── visual metaphors, each in its own animation language (drawn in the right half)
function vTirania(ctx, t, a) {
  const cx = 1380, cy = 470;
  // spotlight cone
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgba('#ffe7b0', 0.32 * a)); g.addColorStop(1, rgba('#ffe7b0', 0.02 * a));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - 50, 0); ctx.lineTo(cx + 50, 0); ctx.lineTo(cx + 330, H); ctx.lineTo(cx - 330, H); ctx.fill();
  // dust in the light
  for (let k = 0; k < 70; k++) {
    const y = ((hash(k) * H + t * (20 + hash(k * 3) * 40)) % H), w = 40 + 280 * (y / H);
    ctx.fillStyle = rgba('#fff2d0', 0.5 * a * hash(k * 5)); ctx.fillRect(cx + (hash(k * 7) - 0.5) * w * 2, y, 2, 2);
  }
  // the crown falls, turning slowly (it "runs away" with the kingdom)
  const fall = E.outCubic(prog(t, 0, 2.6)), y = lerp(80, cy + 120, fall), rot = Math.sin(t * 1.4) * 0.25 + (1 - fall) * 0.8;
  ctx.save(); ctx.translate(cx, y); ctx.rotate(rot); ctx.scale(1.4, 1.4);
  ctx.strokeStyle = rgba(P.amber, a); ctx.fillStyle = rgba(P.amber, 0.15 * a); ctx.lineWidth = 4; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-80, 40); ctx.lineTo(-90, -40); ctx.lineTo(-45, 0); ctx.lineTo(0, -60); ctx.lineTo(45, 0); ctx.lineTo(90, -40); ctx.lineTo(80, 40); ctx.closePath();
  ctx.fill(); ctx.stroke();
  [[-90, -40], [0, -60], [90, -40]].forEach(([x, yy]) => { ctx.fillStyle = rgba('#c8323c', a); circle(ctx, x, yy - 8, 9); ctx.fill(); });
  ctx.restore();
  // red cape ribbon below, flowing
  ctx.strokeStyle = rgba('#c8323c', 0.8 * a); ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath();
  for (let u = 0; u <= 1; u += 0.02) { const x = cx - 360 + u * 720, yy = H - 160 + Math.sin(u * 7 + t * 3) * 26 * u; u ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
  ctx.stroke();
}
function vAstro(ctx, t, a) {
  const cx = 1380, cy = 520;
  for (let k = 0; k < 140; k++) {
    const z = (hash(k) + t * 0.5) % 1, x = cx + (hash(k * 3) - 0.5) * 900 * (0.4 + z), y = cy + (hash(k * 5) - 0.5) * 900 * (0.4 + z);
    ctx.strokeStyle = rgba(P.text, z * a); ctx.lineWidth = 1 + z * 2; seg(ctx, x, y, x - (x - cx) * 0.08 * z, y - (y - cy) * 0.08 * z);
  }
  // meteors crossing diagonally
  for (let k = 0; k < 7; k++) {
    const p = (t * (0.35 + hash(k) * 0.3) + hash(k * 9)) % 1, x = lerp(1900, 900, p) + hash(k * 2) * 200, y = lerp(80 + k * 120, 300 + k * 110, p);
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * (1 + hash(k)) + k);
    const r = 22 + hash(k * 4) * 36;
    ctx.fillStyle = rgba('#5a4a6a', a); ctx.strokeStyle = rgba(P.lilac, a); ctx.lineWidth = 2; ctx.beginPath();
    for (let v = 0; v < 8; v++) { const an = v / 8 * TAU, rr = r * (0.75 + hash(k * 10 + v) * 0.4); v ? ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : ctx.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  // the ship weaves between them
  const sx = cx - 250 + Math.sin(t * 2.2) * 60, sy = cy + Math.sin(t * 3.1) * 140, ang = Math.cos(t * 3.1) * 0.5;
  for (let k = 1; k < 12; k++) { ctx.fillStyle = rgba(P.cyan, (1 - k / 12) * 0.5 * a); circle(ctx, sx - k * 14, sy - Math.sin(t * 3.1 - k * 0.08) * 140 + Math.sin(t * 3.1) * 140, 6 - k * 0.4); ctx.fill(); }
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang); ctx.fillStyle = rgba(P.cyan, a);
  ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(-22, -18); ctx.lineTo(-12, 0); ctx.lineTo(-22, 18); ctx.closePath(); ctx.fill(); ctx.restore();
}
function vTower(ctx, t, a) {
  const cx = 1380, cy = 520, R = 230;
  // empty nodes all around
  for (let k = 0; k < 40; k++) {
    const an = k / 40 * TAU + 0.04, r = R + 90 + (k % 2) * 60;
    ctx.strokeStyle = rgba(P.soft, 0.25 * a); ctx.lineWidth = 1.5; circle(ctx, cx + Math.cos(an) * r, cy + Math.sin(an) * r, 9); ctx.stroke();
  }
  // eight towers in a circle, built from cubes (crafting), lighting up one by one
  for (let k = 0; k < 8; k++) {
    const an = -Math.PI / 2 + k / 8 * TAU, x = cx + Math.cos(an) * R, y = cy + Math.sin(an) * R;
    const on = E.outBack(prog(t, 0.15 + k * 0.18, 0.5 + k * 0.18), 2);
    ctx.strokeStyle = rgba(P.cyan, 0.3 * a * on); ctx.lineWidth = 2; seg(ctx, cx, cy, x, y);
    ctx.fillStyle = rgba(P.ink, a); circle(ctx, x, y, 46); ctx.fill();
    ctx.strokeStyle = rgba(on > 0.5 ? P.cyan : P.soft, a * (0.3 + 0.7 * on)); ctx.lineWidth = 2.5; circle(ctx, x, y, 46); ctx.stroke();
    const hgt = 1 + (k % 3);
    for (let s = 0; s < hgt; s++) isoCube(ctx, x, y + 18 - s * 20 * on, 17 * on, s === hgt - 1 ? CUBE_PAL.amber : CUBE_PAL.brand, a * on);
  }
  isoCube(ctx, cx, cy + 20, 40, CUBE_PAL.brand, a);
  label(ctx, '8 / 8 TORRES', cx, cy + R + 200, 0.6 * a * prog(t, 1.5, 2), P.dim, 13, 'center');
}
function vSitis(ctx, t, a) {
  const cx = 1380, cy = 480;
  // dungeon floor, top-down tiles
  for (let i = -6; i <= 6; i++) for (let j = -5; j <= 5; j++) {
    const v = hash(i * 7.1 + j * 3.3);
    ctx.fillStyle = rgba(v > 0.85 ? '#0e2a36' : '#0a1c26', a); ctx.fillRect(cx + i * 64 - 31, cy + j * 64 - 31, 62, 62);
  }
  const vg = ctx.createRadialGradient(cx, cy, 60, cx, cy, 420); vg.addColorStop(0, rgba(P.ink, 0)); vg.addColorStop(1, rgba(P.ink, 0.95 * a));
  ctx.fillStyle = vg; ctx.fillRect(cx - 500, cy - 420, 1000, 840);
  // a single drop, ripples with each power used
  for (let k = 0; k < 4; k++) {
    const p = ((t - k * 0.6) % 2.4) / 2.4; if (t < k * 0.6) continue;
    ctx.strokeStyle = rgba(P.cyan, (1 - p) * 0.8 * a); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy + 40, 30 + p * 260, (30 + p * 260) * 0.45, 0, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = rgba(P.cyan, a); ctx.beginPath(); ctx.moveTo(cx, cy - 60); ctx.bezierCurveTo(cx + 40, cy - 10, cx + 36, cy + 30, cx, cy + 34); ctx.bezierCurveTo(cx - 36, cy + 30, cx - 40, cy - 10, cx, cy - 60); ctx.fill();
  // one bar = life and energy; every power spends it
  const lvl = clamp(1 - Math.floor(t / 0.6) * 0.17 - (t % 0.6) * 0.05);
  const bx = cx - 260, by = cy + 300;
  ctx.strokeStyle = rgba(P.soft, 0.7 * a); ctx.lineWidth = 2; ctx.strokeRect(bx, by, 520, 22);
  ctx.fillStyle = rgba(P.cyan, a); ctx.fillRect(bx + 3, by + 3, 514 * lvl, 16);
  label(ctx, 'VIDA = ENERGIA = ÁGUA', bx, by - 22, 0.7 * a, P.soft, 13);
}
function vNoir(ctx, t, a) {
  const cx = 1380, cy = 500;
  // venetian-blind light across the wall
  ctx.save(); ctx.globalAlpha = a;
  for (let k = 0; k < 9; k++) { ctx.fillStyle = rgba('#d8d8d8', 0.07); ctx.save(); ctx.translate(cx - 200, 120 + k * 52); ctx.transform(1, 0.35, 0, 1, 0, 0); ctx.fillRect(0, 0, 520, 24); ctx.restore(); }
  // rain on the window
  for (let k = 0; k < 120; k++) { const x = 1000 + hash(k) * 800, y = ((hash(k * 3) * H + t * (600 + hash(k) * 400)) % H); ctx.strokeStyle = rgba('#9aa4ae', 0.35); seg(ctx, x, y, x - 4, y + 22); }
  // desk lamp cone (the only warm colour)
  const g = ctx.createRadialGradient(cx - 120, cy + 120, 10, cx - 120, cy + 120, 380);
  g.addColorStop(0, rgba(P.amber, 0.5 + 0.05 * Math.sin(t * 30))); g.addColorStop(1, rgba(P.amber, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - 150, cy - 40); ctx.lineTo(cx - 90, cy - 40); ctx.lineTo(cx + 140, cy + 260); ctx.lineTo(cx - 380, cy + 260); ctx.fill();
  ctx.fillStyle = '#1a1a1c'; ctx.fillRect(cx - 460, cy + 260, 760, 26);
  ctx.strokeStyle = '#3a3a3e'; ctx.lineWidth = 6; seg(ctx, cx - 120, cy - 40, cx - 40, cy + 260);
  // a pixel silhouette in a coat and hat, waiting for a name
  const px = cx + 170, py = cy + 260, c = 9;
  const SIL = ['..oooo..', '.oooooo.', 'oooooooo', '..oooo..', '..oooo..', '.oooooo.', 'oooooooo', 'oooooooo', 'oooooooo', '.oooooo.', '.oo..oo.', '.oo..oo.'];
  SIL.forEach((r, i) => [...r].forEach((ch, j) => { if (ch === 'o') { ctx.fillStyle = '#060607'; ctx.fillRect(px + (j - 4) * c, py - (SIL.length - i) * c, c, c); } }));
  ctx.fillStyle = rgba(P.amber, 0.9); ctx.fillRect(px - c, py - 9 * c - 2, 2, 2);
  ctx.restore();
}
const VIS = [vTirania, vAstro, vTower, vSitis, vNoir];

function projectCard(ctx, i, t) {
  const pr = PROJECTS[i];
  const inP = E.outExpo(prog(t, 0, 0.55)), outP = E.inExpo(prog(t, 2.72, 3.0));
  const a = inP * (1 - outP);
  // tinted backdrop slides in like a page turn
  ctx.save(); ctx.beginPath(); ctx.rect(W * (1 - inP), 0, W, H); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, P.ink); g.addColorStop(1, pr.tint);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  VIS[i](ctx, t, 1 - outP);
  ctx.restore();
  // text column
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * 0.62, H); ctx.clip();
  label(ctx, `0${i + 1} / 05`, 150, CY - 230, a, P.dim, 15);
  const tp = E.outExpo(prog(t, 0.05, 0.7));
  ctx.save(); ctx.beginPath(); ctx.rect(120, CY - 200, 1000, 170); ctx.clip();
  font(ctx, 'SG', 128, 700); ctx.textBaseline = 'alphabetic'; ctx.fillStyle = rgba(P.text, 1 - outP);
  ctx.fillText(pr.name, 146, CY - 60 + (1 - tp) * 170 + outP * -170);
  ctx.restore();
  badge(ctx, pr.status, 150, CY + 10, pr.sc, a * prog(t, 0.3, 0.6));
  label(ctx, pr.tags, 150, CY + 64, 0.75 * a * prog(t, 0.4, 0.7), P.soft, 13);
  font(ctx, 'IN', 34, 300); ctx.fillStyle = rgba(P.text, a * prog(t, 0.6, 1.0)); ctx.textBaseline = 'middle';
  pr.line.forEach((s, k) => ctx.fillText(s, 150, CY + 140 + k * 48));
  ctx.restore();
}

function ecosystem(ctx, lt, focus = -1, a = 1, scale = 1) {
  // three ways to work around the studio cube
  const nodes = [['PRODUÇÃO DE JOGOS', -1], ['ENSINO', 0], ['PARCERIAS', 1]];
  const pts = nodes.map((_, i) => { const an = -Math.PI / 2 + i * TAU / 3 + lt * 0.08; return [CX + Math.cos(an) * 360 * scale, CY + 20 + Math.sin(an) * 300 * scale]; });
  ctx.save(); ctx.globalAlpha *= a;
  pts.forEach((p, i) => {
    ctx.strokeStyle = rgba(P.cyan, 0.35); ctx.lineWidth = 2; seg(ctx, CX, CY + 20, p[0], p[1]);
    const q = pts[(i + 1) % 3]; ctx.strokeStyle = rgba(P.soft, 0.15); seg(ctx, p[0], p[1], q[0], q[1]);
    const f = (lt * 0.8 + i / 3) % 1; ctx.fillStyle = P.white; ctx.fillRect(lerp(CX, p[0], f) - 2, lerp(CY + 20, p[1], f) - 2, 4, 4);
  });
  isoCube(ctx, CX, CY + 20, 70 * scale, CUBE_PAL.brand, 1);
  pts.forEach((p, i) => {
    ctx.fillStyle = P.ink; circle(ctx, p[0], p[1], 14); ctx.fill();
    ctx.strokeStyle = i === focus ? P.cyan : P.soft; ctx.lineWidth = 2.5; circle(ctx, p[0], p[1], 14); ctx.stroke();
    font(ctx, 'SG', 42, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = i === focus ? P.cyan : P.text;
    ctx.fillText(nodes[i][0], p[0], p[1] + (p[1] < CY ? -46 : 50));
  });
  ctx.restore();
}

function draw(ctx, lt) {
  bg(ctx, P.ink);
  isoGrid(ctx, 80, lt * 10, -lt * 4, 0.035);

  // ── 0. three ways to work (0 – 5)
  if (lt < L('novo') + 0.3) {
    const a = E.outBack(prog(lt, 0, 0.7), 1.4) * (1 - prog(lt, L('novo') - 0.4, L('novo') + 0.2));
    ecosystem(ctx, lt, lt > L('producao') ? 0 : -1, a, lerp(0.2, 1, a));
    statement(ctx, [{ text: 'Três formas de trabalhar junto.', size: 54, wght: 600, fam: 'SG', col: P.text }], CX, 150, lt, 0.4, L('producao') - 0.3, { align: 'center' });
    statement(ctx, [{ text: 'Produção de jogos — jogo completo, protótipo, arte e trilha.', size: 34, wght: 300, col: P.soft }], CX, H - 120, lt, L('producao') + 0.2, L('novo') - 0.4, { align: 'center' });
  }
  // ── 1. "Somos um estúdio novo, mas já temos jogo no ar." (5 – 7.5)
  if (lt >= L('novo') - 0.1 && lt < PJ[0] + 0.3) {
    statement(ctx, [
      { text: 'Somos um estúdio novo,', size: 84, wght: 300, fam: 'SG', col: P.soft, lh: 1.15 },
      { text: 'mas já temos jogo no ar.', size: 84, wght: 700, fam: 'SG', col: P.text, lh: 1.6 },
      { text: 'Nada aqui é vaporware: este é o estado real de cada projeto.', size: 32, wght: 300, col: P.mint },
    ], CX, CY - 80, lt, L('novo'), PJ[0] - 0.45, { align: 'center', stagger: 0.18 });
  }
  // ── 2. the five projects (7.5 – 22.5)
  PJ.forEach((t0, i) => { if (lt >= t0 && lt < t0 + 3) projectCard(ctx, i, lt - t0); });

  // ── 3. ENSINO: GameLab at SESC Araraquara (22.5 – 32.5)
  const en = L('ensino'), pa = L('parcerias');
  if (lt >= en - 0.1 && lt < pa + 0.2) {
    const a = E.outCubic(prog(lt, en, en + 0.5)) * (1 - prog(lt, pa - 0.5, pa));
    const rcx = 1300, rcy = CY + 40, R = 250;
    ctx.save(); ctx.globalAlpha = a;
    // 15 encontros: arcs around the circle
    c6.encontros.forEach((tt, k) => {
      const on = prog(lt, tt - T0, tt - T0 + 0.25); if (on <= 0) return;
      const a0 = -Math.PI / 2 + k / 15 * TAU + 0.03, a1 = a0 + TAU / 15 * on - 0.06;
      ctx.strokeStyle = rgba(P.cyan, 0.85); ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(rcx, rcy, R + 70, a0, a1); ctx.stroke();
    });
    // 17 students in a circle, each one making (lines in, cubes out)
    for (let k = 0; k < 17; k++) {
      const an = -Math.PI / 2 + k / 17 * TAU, x = rcx + Math.cos(an) * R, y = rcy + Math.sin(an) * R;
      const on = E.outBack(prog(lt, en + 0.3 + k * 0.05, en + 0.6 + k * 0.05), 2);
      ctx.fillStyle = rgba(P.text, on); circle(ctx, x, y, 9 * on); ctx.fill();
      const mk = prog(lt, en + 4 + k * 0.08, en + 4.6 + k * 0.08);
      if (mk > 0) isoCube(ctx, lerp(x, rcx + Math.cos(an) * (R - 70), mk), lerp(y, rcy + Math.sin(an) * (R - 70), mk), 9, CUBE_PAL.brand, mk);
    }
    // 21 módulos stack in the centre
    c6.modulos.forEach((tt, k) => {
      const on = E.outBack(prog(lt, tt - T0, tt - T0 + 0.3), 2); if (on <= 0) return;
      const lay = k < 9 ? 0 : k < 16 ? 1 : k < 20 ? 2 : 3, idx = k < 9 ? k : k < 16 ? k - 9 : k < 20 ? k - 16 : 0;
      const side = [3, 3, 2, 1][lay], i = idx % side, j = Math.floor(idx / side);
      const [x, y] = iso(i - (side - 1) / 2 + (lay === 1 ? 0 : 0), j - (side - 1) / 2, lay, 24);
      isoCube(ctx, rcx + x, rcy + 30 + y - (1 - on) * 80, 24, k === 20 ? CUBE_PAL.white : CUBE_PAL.brand, on);
    });
    ctx.restore();
    statement(ctx, [
      { text: 'ENSINO · GAMELAB · SESC ARARAQUARA', size: 16, wght: 500, fam: 'JB', col: P.cyan, track: 3, lh: 2.2 },
      { text: 'Ensinamos game dev', size: 80, wght: 700, fam: 'SG', col: P.text, lh: 1.1 },
      { text: 'do zero no SESC.', size: 80, wght: 300, fam: 'SG', col: P.text, lh: 1.5 },
      { text: 'Do zero absoluto até um jogo 2D top-down', size: 30, wght: 300, col: P.soft, lh: 1.3 },
      { text: 'completo em Godot. Material próprio, público e aberto.', size: 30, wght: 300, col: P.soft },
    ], 150, CY - 220, lt, en + 0.2, pa - 0.6, { stagger: 0.1 });
    // the facts, as they appear on the site
    const facts = [['15', 'ENCONTROS PRESENCIAIS'], ['45h', 'DE CURSO'], ['21', 'MÓDULOS PUBLICADOS'], ['17', 'ALUNOS SIMULTÂNEOS'], ['13/13', 'FARIAM OUTRA EDIÇÃO']];
    facts.forEach(([n, l], k) => {
      const p = E.outExpo(prog(lt, en + 2.4 + k * 0.35, en + 3.2 + k * 0.35)) * (1 - prog(lt, pa - 0.6, pa - 0.1));
      if (p <= 0) return;
      const x = 150 + k * 175, y = H - 200;
      ctx.save(); ctx.globalAlpha = p; font(ctx, 'SG', 52, 700); ctx.fillStyle = P.text; ctx.textBaseline = 'alphabetic';
      ctx.fillText(n, x, y + (1 - p) * 30); ctx.restore();
      label(ctx, l.split(' ')[0], x, y + 26, 0.7 * p, P.dim, 11);
      label(ctx, l.split(' ').slice(1).join(' '), x, y + 44, 0.7 * p, P.dim, 11);
    });
    // Tirania was born in the GameLab: the ecosystem connects
    const ti = prog(lt, L('tirania'), L('tirania') + 0.6) * (1 - prog(lt, pa - 0.6, pa - 0.1));
    if (ti > 0) {
      const tx = rcx + 420, ty = rcy - 300;
      ctx.strokeStyle = rgba(P.amber, ti); ctx.setLineDash([6, 6]); ctx.lineWidth = 2; seg(ctx, rcx + R * 0.7, rcy - R * 0.7, lerp(rcx + R * 0.7, tx, ti), lerp(rcy - R * 0.7, ty, ti)); ctx.setLineDash([]);
      label(ctx, 'TIRANIA — FEITO NO GAMELAB', tx - 10, ty - 26, ti, P.amber, 13, 'right');
    }
  }
  // ── 4. PARCERIAS (32.5 – 37.5)
  const eco = L('eco');
  if (lt >= pa - 0.1 && lt < eco + 0.2) {
    const a = E.outCubic(prog(lt, pa, pa + 0.5)) * (1 - prog(lt, eco - 0.4, eco));
    const outer = ['INSTITUIÇÕES DE ENSINO', 'CULTURA', 'EDITAIS DE FOMENTO', 'EVENTOS', 'AÇÕES EDUCATIVAS', 'PUBLICADORAS'];
    const cx = 1320, cy = CY + 20;
    ctx.save(); ctx.globalAlpha = a;
    outer.forEach((s, k) => {
      const an = -Math.PI / 2 + k / outer.length * TAU + 0.3, r = 330;
      const p = E.outExpo(prog(lt, pa + 0.2 + k * 0.12, pa + 0.9 + k * 0.12));
      const x = cx + Math.cos(an) * r * p, y = cy + Math.sin(an) * r * 0.8 * p;
      ctx.strokeStyle = rgba(P.cyan, 0.4); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo((cx + x) / 2 + Math.sin(an) * 60, (cy + y) / 2 - Math.cos(an) * 60, x, y); ctx.stroke();
      for (const dir of [0, 1]) {
        const f = ((lt * 0.7 + k * 0.17 + dir * 0.5) % 1), u = dir ? 1 - f : f;
        const qx = (1 - u) * (1 - u) * cx + 2 * u * (1 - u) * ((cx + x) / 2 + Math.sin(an) * 60) + u * u * x;
        const qy = (1 - u) * (1 - u) * cy + 2 * u * (1 - u) * ((cy + y) / 2 - Math.cos(an) * 60) + u * u * y;
        ctx.fillStyle = dir ? P.amber : P.white; ctx.fillRect(qx - 2.5, qy - 2.5, 5, 5);
      }
      ctx.fillStyle = P.ink; circle(ctx, x, y, 10); ctx.fill(); ctx.strokeStyle = P.text; circle(ctx, x, y, 10); ctx.stroke();
      label(ctx, s, x, y + (y < cy ? -30 : 32), p, P.text, 16, 'center');
    });
    isoCube(ctx, cx, cy, 56, CUBE_PAL.brand, 1);
    ctx.restore();
    statement(ctx, [
      { text: 'PARCERIAS', size: 16, wght: 500, fam: 'JB', col: P.cyan, track: 3, lh: 2.2 },
      { text: 'Instituições de ensino', size: 64, wght: 700, fam: 'SG', col: P.text, lh: 1.1 },
      { text: 'e cultura, projetos de fomento', size: 64, wght: 300, fam: 'SG', col: P.text, lh: 1.1 },
      { text: 'e ações educativas.', size: 64, wght: 300, fam: 'SG', col: P.text },
    ], 150, CY - 120, lt, pa + 0.2, eco - 0.5, { stagger: 0.1 });
  }
  // ── 5. the ecosystem: all of it connected, then compressed into one bit (37.5 – 40)
  if (lt >= eco - 0.2) {
    const a = E.outCubic(prog(lt, eco - 0.2, eco + 0.4));
    const comp = E.inExpo(prog(lt, 38.9, 39.9));
    ctx.save(); ctx.translate(CX, CY + 20); ctx.scale(1 - comp * 0.98, 1 - comp * 0.98); ctx.translate(-CX, -CY - 20);
    ecosystem(ctx, lt, -1, a, 1);
    PROJECTS.forEach((p, i) => {
      const an = lt * 0.5 + i / 5 * TAU, x = CX + Math.cos(an) * 640, y = CY + 20 + Math.sin(an) * 330;
      ctx.fillStyle = p.sc; circle(ctx, x, y, 6); ctx.fill();
      label(ctx, p.name, x, y - 24, 0.8 * a, P.text, 16, 'center');
    });
    ctx.restore();
    if (comp > 0.7) { glow(ctx, CX, CY + 20, 160, P.cyan, comp); }
  }
}

(window.CHAPTERS = window.CHAPTERS || [])[5] = {
  draw,
  fx: lt => ({ bloom: 0.35, grain: 0.05 }),
  hud: () => ({ word: 'OUTPUT' }),
};
})();

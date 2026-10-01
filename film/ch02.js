// CH02 — O ESTÚDIO (0:25–0:55)
// The studio in its own words (scorpionbits.com): "Estúdio de jogos indie", "Ideias que viram jogo.",
// "Feito no Brasil, em Godot.", games + education, and "Programação, arte, game design e música ficam dentro de casa."
(function () {
const { W, H, CX, CY, TAU, P, clamp, lerp, prog, E, spring, hash, noise1, noise2, rgba, bg, font, circle, glow, seg,
  layout, scramble, typed, label, textPoints, rotX, rotY, iso, isoCube, CUBE_PAL, CUBE_V, CUBE_E, ISO_YAW, ISO_PITCH, isoGrid, statement } = CORE;
const { B, c2 } = TL;
const T0 = TL.CH[1];
const L = k => c2[k] - T0;

const NP = 3400;
let S0, S1, S2, IDX;
function init() {
  S0 = textPoints('ESTÚDIO', 'SG', 700, 300, 6);
  S1 = textPoints('Ideias', 'SG', 300, 330, 4);
  S2 = textPoints('jogo.', 'SG', 700, 330, 6);
  IDX = Array.from({ length: NP }, (_, k) => [hash(k * 1.71), hash(k * 2.93 + 1), hash(k * 0.37 + 4)]);
}
const pick = (S, k) => S[Math.floor(IDX[k][0] * S.length)];

// slice-displaced text: N strips slide in from alternating sides
function sliced(ctx, text, x, y, size, wght, col, p, n = 6) {
  ctx.save(); font(ctx, 'SG', size, wght); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const h = size * 1.1, top = y - h / 2;
  for (let k = 0; k < n; k++) {
    const q = E.outExpo(clamp(p * 1.4 - k * 0.07));
    ctx.save(); ctx.beginPath(); ctx.rect(0, top + k * h / n, W, h / n + 0.5); ctx.clip();
    ctx.fillStyle = col; ctx.fillText(text, x + (1 - q) * (k % 2 ? 900 : -900), y);
    ctx.restore();
  }
  ctx.restore();
}

function draw(ctx, lt) {
  bg(ctx, P.ink);
  isoGrid(ctx, 64, lt * 18, lt * 6, 0.05);

  // ── A. ESTÚDIO / de jogos INDIE (0 – 5)
  const dissolve = L('ideias') - 0.6;
  if (lt < dissolve + 0.05) {
    const out = prog(lt, dissolve - 0.25, dissolve);
    font(ctx, 'SG', 300, 700);
    const lay = layout(ctx, 'ESTÚDIO', CX, 6);
    lay.forEach((Lt, i) => {
      const sp = spring(lt - 0.05 - i * 0.06, 13, 6.5);
      const wv = 0.5 + 0.5 * Math.sin(lt * 4.2 - i * 0.8);
      const settle = prog(lt, 3.2, 3.9);
      const w = lerp(lerp(300, 700, wv), 700, settle) * clamp(lt * 3) + 300 * (1 - clamp(lt * 3));
      ctx.save();
      font(ctx, 'SG', 300, w); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(P.text, 1 - out);
      ctx.translate(Lt.x, CY - 70 - (1 - sp) * 700);
      ctx.scale(1 + (sp - 1) * 0.15, 1 - (sp - 1) * 0.25);
      ctx.fillText(Lt.ch, 0, 0);
      ctx.restore();
    });
    // "DE JOGOS" typewriter + INDIE stamp
    const ta = c2.typeA, tx = typed(ta.text, (lt - (ta.t0 - T0)) / (ta.dt * ta.text.length));
    const exit2 = E.inExpo(prog(lt, dissolve - 0.4, dissolve));
    ctx.save(); ctx.beginPath(); ctx.rect(0, CY + 90, W, 190); ctx.clip();
    ctx.translate(0, exit2 * 200 + 50);
    font(ctx, 'JB', 46, 500); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '8px';
    ctx.fillStyle = P.soft; ctx.fillText(tx, CX - 10, CY + 125);
    if (lt > ta.t0 - T0 && tx.length < ta.text.length + 1 && Math.floor(lt * 5) % 2 === 0) { ctx.fillStyle = P.cyan; ctx.fillRect(CX - 4, CY + 105, 16, 40); }
    const st = prog(lt, L('indie'), L('indie') + 0.28);
    if (st > 0) {
      const sc = lerp(2.4, 1, E.outBack(st, 2.2)), sq = 1 - 0.18 * Math.sin(Math.PI * prog(lt, L('indie') + 0.2, L('indie') + 0.45));
      ctx.save(); ctx.translate(CX + 40, CY + 125); ctx.scale(sc / sq, sc * sq);
      font(ctx, 'SG', 120, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '2px';
      ctx.fillStyle = rgba(P.cyan, clamp(st * 3)); ctx.fillText('INDIE', 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // ── B. particles: ESTÚDIO → Ideias → (swirl) → jogo. (4.4 – 10)
  const jogo = L('jogo');
  if (lt >= dissolve - 0.25 && lt < jogo + 0.4) {
    const toIdeias = (k) => E.inOutCubic(prog(lt, dissolve + IDX[k][1] * 0.5, dissolve + 1.3 + IDX[k][1] * 0.5));
    const chaos = E.inOutCubic(prog(lt, L('viram') - 0.3, L('viram') + 1.0));
    const fade = 1 - prog(lt, jogo, jogo + 0.3);
    const born = prog(lt, dissolve - 0.25, dissolve);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < NP; k++) {
      const a = pick(S0, k), b = pick(S1, k), c = pick(S2, k);
      const p = toIdeias(k);
      const wob = Math.sin(Math.PI * p) * 140;
      let x = lerp(CX + a.x, CX + b.x, p) + noise2(k * 0.1, lt * 1.5) * wob;
      let y = lerp(CY - 70 + a.y, CY - 40 + b.y, p) + noise2(k * 0.1 + 40, lt * 1.5) * wob;
      // ideas swirl: a vortex around the centre
      if (chaos > 0) {
        const ang = IDX[k][2] * TAU + lt * (1.2 + IDX[k][1]);
        const R = 120 + IDX[k][0] * 520;
        x = lerp(x, CX + Math.cos(ang) * R * 1.4 + noise2(k, lt) * 60, chaos);
        y = lerp(y, CY - 20 + Math.sin(ang) * R * 0.55 + noise2(k + 9, lt) * 60, chaos);
      }
      const conv = E.inOutExpo(prog(lt, jogo - 1.25 + IDX[k][1] * 0.35, jogo));
      x = lerp(x, CX + c.x, conv); y = lerp(y, CY + 60 + c.y, conv);
      const s = 2 + IDX[k][2] * 1.8;
      ctx.fillStyle = rgba(IDX[k][0] > 0.86 ? P.cyan : P.text, (0.55 + 0.45 * IDX[k][1]) * fade * born);
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.restore();
  }
  // small line above: "Ideias que viram"
  const tb = c2.typeB;
  if (lt > tb.t0 - T0 && lt < L('brasil') + 0.2) {
    const out = E.inExpo(prog(lt, L('brasil') - 0.55, L('brasil') - 0.1));
    ctx.save(); ctx.beginPath(); ctx.rect(0, CY - 290, W, 130); ctx.clip();
    font(ctx, 'IN', 72, 300); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '1px';
    ctx.fillStyle = P.soft;
    const s = typed('Ideias que viram', (lt - (tb.t0 - T0)) / (tb.dt * 16));
    ctx.fillText(s, CX, CY - 225 - out * 130);
    ctx.restore();
  }
  // solid "jogo." and the period that becomes a cube
  if (lt >= jogo - 0.05 && lt < L('brasil') + 0.2) {
    const out = E.inExpo(prog(lt, L('brasil') - 0.55, L('brasil') - 0.1));
    const a = prog(lt, jogo - 0.05, jogo + 0.15);
    font(ctx, 'SG', 330, 700);
    const wj = ctx.measureText('jogo').width, wd = ctx.measureText('.').width, total = wj + wd;
    const cubeT = L('cube');
    ctx.save(); ctx.beginPath(); ctx.rect(0, CY - 160, W, 420); ctx.clip();
    ctx.translate(0, -out * 420);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = rgba(P.text, a);
    ctx.fillText(lt < cubeT ? 'jogo.' : 'jogo', CX - total / 2, CY + 60);
    if (lt >= cubeT) {
      // the period pops into the brand cube, jumps once, lands with squash & stretch
      const px = CX - total / 2 + wj + wd / 2, py = CY + 60 + 112;
      const pop = E.outBack(prog(lt, cubeT, cubeT + 0.3), 3);
      const j = prog(lt, cubeT + 0.45, cubeT + 1.1), hgt = Math.sin(Math.PI * j) * 190;
      const land = Math.exp(-Math.max(0, lt - cubeT - 1.1) * 14) * (lt > cubeT + 1.1 ? 1 : 0);
      const stretch = j > 0 && j < 1 ? 1 + 0.25 * Math.abs(Math.cos(Math.PI * j)) : 1;
      const sy = (1 - land * 0.35) * stretch, sx = 1 / sy;
      ctx.save(); ctx.translate(px, py - hgt); ctx.scale(sx, sy);
      isoCube(ctx, 0, -36 * pop, 36 * pop, CUBE_PAL.brand, 1);
      ctx.restore();
    }
    ctx.restore();
  }

  // ── C. FEITO NO BRASIL, / EM GODOT. (12.5 – 17.5)
  const br = L('brasil'), gd = L('godot'), sp = L('split');
  if (lt >= br - 0.05 && lt < sp + 0.1) {
    const squeeze = E.inExpo(prog(lt, sp - 0.5, sp));
    ctx.save(); ctx.translate(CX, CY); ctx.scale(lerp(1, 0.002, squeeze), 1); ctx.translate(-CX, -CY);
    const wp = E.inOutExpo(prog(lt, br, br + 0.7));
    ctx.save(); ctx.beginPath(); ctx.rect(0, CY - 190, W * wp, 240); ctx.clip();
    font(ctx, 'SG', 150, 300); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.text;
    ctx.fillText('FEITO NO ', CX + 40, CY - 70);
    font(ctx, 'SG', 150, 700); ctx.textAlign = 'left'; ctx.fillText('BRASIL,', CX + 40, CY - 70);
    ctx.restore();
    if (wp > 0 && wp < 1) { ctx.fillStyle = P.cyan; ctx.fillRect(W * wp - 3, CY - 150, 6, 180); }
    if (lt >= gd) sliced(ctx, 'EM GODOT.', CX, CY + 95, 150, 700, P.cyan, prog(lt, gd, gd + 0.8), 8);
    const tc = c2.typeC;
    if (lt > tc.t0 - T0) {
      ctx.save(); font(ctx, 'JB', 24, 500); ctx.letterSpacing = '6px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = P.dim; ctx.fillText(typed(tc.text, (lt - (tc.t0 - T0)) / (tc.dt * tc.text.length)), CX, CY + 255);
      label(ctx, 'STACK', CX, CY + 212, 0.6, P.faint, 13, 'center');
      ctx.restore();
    }
    ctx.restore();
    if (squeeze > 0.9) { ctx.fillStyle = P.cyan; ctx.fillRect(CX - 1.5, 0, 3, H); }
  }

  // ── D. split: JOGOS | EDUCAÇÃO (17.5 – 22.5)
  const four = L('four');
  if (lt >= sp && lt < four + 0.2) {
    const open = E.outExpo(prog(lt, sp, sp + 0.6));
    const close = E.inOutExpo(prog(lt, four - 0.65, four));
    const half = (1 - close);
    ctx.fillStyle = P.ink3; ctx.fillRect(CX, 0, (W / 2) * half, H);
    ctx.fillStyle = P.ink; ctx.fillRect(CX - (W / 2) * half, 0, (W / 2) * half, H);
    ctx.save(); ctx.beginPath(); ctx.rect(CX - (W / 2) * half, 0, W * half, H); ctx.clip();
    // left: games — a cube bouncing on the beat
    const lx = lerp(CX, W * 0.25, open) - close * 200, rx = lerp(CX, W * 0.75, open) + close * 200;
    ctx.save(); font(ctx, 'SG', 110, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, CX, H); ctx.clip(); ctx.globalAlpha = prog(open, 0.3, 0.8); ctx.fillStyle = P.text; ctx.fillText('JOGOS', lx, CY - 250); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(CX, 0, CX, H); ctx.clip(); ctx.globalAlpha = prog(open, 0.3, 0.8); ctx.fillStyle = P.cyan; ctx.fillText('EDUCAÇÃO', rx, CY - 250); ctx.restore();
    ctx.restore();
    const ph = ((lt - sp) % B) / B, hgt = (1 - Math.pow(2 * ph - 1, 2)) * 210;
    const contact = Math.exp(-Math.min(ph, 1 - ph) * 26), speed = Math.abs(2 * ph - 1);
    const syc = (1 - 0.4 * contact) * (1 + 0.3 * Math.pow(speed, 4) * (1 - contact));
    const floor = CY + 200;
    ctx.fillStyle = rgba('#000', 0.35); ctx.beginPath(); ctx.ellipse(lx, floor + 4, 70 * (1 - hgt / 420), 12 * (1 - hgt / 420), 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(P.soft, 0.3); seg(ctx, lx - 220, floor + 4, lx + 220, floor + 4);
    ctx.save(); ctx.translate(lx, floor - hgt); ctx.scale(1 / syc, syc);
    isoCube(ctx, 0, -62, 62, CUBE_PAL.brand, open); ctx.restore();
    label(ctx, 'PESO · ACELERAÇÃO · RECUO', lx, floor + 60, 0.55 * open, P.dim, 13, 'center');
    // right: education — 21 modules climb like a staircase
    for (let k = 0; k < 21; k++) {
      const a = E.outBack(prog(lt, sp + 0.4 + k * 0.12, sp + 0.75 + k * 0.12), 2);
      const [x, y] = iso((k % 7) * 1.3 - 4, Math.floor(k / 7) * 1.3 - 1.3, 0, 30);
      isoCube(ctx, rx + x, floor - 70 + y - (1 - a) * 60, 30 * clamp(a), k === 20 ? CUBE_PAL.white : CUBE_PAL.brand, clamp(a));
    }
    label(ctx, `${String(Math.min(21, Math.max(0, Math.floor((lt - sp - 0.4) / 0.12) + 1))).padStart(2, '0')} / 21 MÓDULOS · GAMELAB · SESC`, rx, floor + 60, 0.7 * open, P.dim, 13, 'center');
    ctx.restore();
    ctx.fillStyle = P.cyan; ctx.fillRect(CX - 1.5, 0, 3, H * (1 - prog(lt, sp + 0.2, sp + 0.9)) );
    statement(ctx, [{ text: 'Estúdio de jogos indie e educação em desenvolvimento de jogos.', size: 34, wght: 300, col: P.soft }],
      CX, H - 120, lt, sp + 0.8, four - 0.7, { align: 'center' });
  }

  // ── E. four disciplines orbit the cube, then move inside it (22.5 – 30)
  const house = L('house'), burst = L('burst');
  if (lt >= four - 0.1) {
    const words = ['PROGRAMAÇÃO', 'ARTE', 'GAME DESIGN', 'MÚSICA'];
    const inward = E.inExpo(prog(lt, house - 1.3, house - 0.05));
    const settle = clamp(spring(lt - (house - 1.3), 6, 4));
    const yaw = lerp(lt * 0.7, ISO_YAW + TAU * Math.round(lt * 0.7 / TAU), settle);
    const pitch = lerp(0.42, ISO_PITCH, settle);
    const K = 92, ccx = CX, ccy = CY - 60;
    const fill = prog(lt, house - 0.05, house + 0.15);
    const shatter = E.outExpo(prog(lt, burst, burst + 0.6));
    const shake = prog(lt, burst - 0.6, burst) * (1 - shatter) * 10;
    const draws = [];
    words.forEach((w, k) => {
      const t0 = four + k * B;
      if (lt < t0) return;
      const ap = E.outBack(prog(lt, t0, t0 + 0.4), 2);
      const ang = lt * 0.9 + k * TAU / 4;
      const R = 470 * (1 - inward), z = Math.sin(ang);
      draws.push({ z, fn: () => {
        const sc = (0.85 + z * 0.25) * ap * (1 - inward * 0.8);
        ctx.save(); ctx.translate(ccx + Math.cos(ang) * R, ccy + z * 140 * (1 - inward));
        ctx.scale(sc, sc); font(ctx, 'SG', 76, 500 + 200 * (z + 1) / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(k % 2 ? P.cyan : P.text, (0.5 + 0.5 * (z + 1) / 2) * (1 - inward * 0.9)); ctx.fillText(w, 0, 0);
        ctx.restore();
      } });
    });
    draws.filter(d => d.z < 0).forEach(d => d.fn());
    if (shatter < 1) {
      ctx.save(); ctx.translate(ccx + noise1(lt * 40) * shake, ccy + noise1(lt * 40 + 9) * shake);
      if (fill < 1) {
        const V = CUBE_V.map(v => rotX(rotY(v, yaw), pitch).map(c => c * K * E.outBack(prog(lt, four - 0.1, four + 0.4), 2)));
        ctx.strokeStyle = rgba(P.cyan, 0.9 * (1 - fill)); ctx.lineWidth = 2.5;
        CUBE_E.forEach(([a, c]) => seg(ctx, V[a][0], V[a][1], V[c][0], V[c][1]));
      }
      if (fill > 0) isoCube(ctx, 0, 0, K * 1.633, CUBE_PAL.brand, fill * (1 - shatter));
      ctx.restore();
    }
    draws.filter(d => d.z >= 0).forEach(d => d.fn());
    statement(ctx, [
      { text: 'Programação, arte, game design e música', size: 44, wght: 300, col: P.soft, lh: 2.0 },
      { text: 'ficam dentro de casa.', size: 80, wght: 600, fam: 'SG', col: P.text },
    ], CX, CY + 240, lt, house + 0.1, burst - 0.5, { align: 'center' });
    // the house can't hold it: it bursts into the chaos of chapter 03
    if (shatter > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 600; k++) {
        const a = hash(k * 3.1) * TAU, sp2 = 200 + hash(k * 7.7) * 1400;
        const x = ccx + Math.cos(a) * sp2 * shatter, y = ccy + Math.sin(a) * sp2 * shatter * 0.7;
        const s = 2 + hash(k) * 5;
        ctx.fillStyle = rgba(hash(k * 1.3) > 0.7 ? P.cyan : P.sky, 0.9 * (1 - shatter * 0.3));
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      ctx.restore();
    }
  }
}

(window.CHAPTERS = window.CHAPTERS || [])[1] = {
  init, draw,
  fx: lt => ({ bloom: 0.35, grain: 0.05 }),
  hud: () => ({ instant: true, word: 'INPUT' }),
};
})();

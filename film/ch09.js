// CH09 — O QUE VEM (4:10–4:40)
// The computational universe returns, and everything we've seen is in it: cubes, fingerprints, half-finished
// features, scene-tree nodes, piano-roll notes, the crown, meteors, the tower ring, the drop, the lamp, code.
// It connects, accelerates into the opening point, flashes white, and the mark assembles from its own particles.
// Copy (scorpionbits.com/portfolio, /sobre): "O que vem a seguir", "Um estúdio em formação."
(function () {
const { W, H, CX, CY, TAU, P, clamp, lerp, prog, E, hash, noise1, noise2, rgba, bg, font, circle, glow, seg, label,
  imagePoints, IMG, drawMark, isoCube, CUBE_PAL, cam, CUBE_V, CUBE_E, rotX, rotY, statement } = CORE;
const { B, c9 } = TL;
const T0 = TL.CH[8];
const L = k => c9[k] - T0;
const N = 280, ZR = 4200;
let items = [], logoPts = [];

function init() {
  for (let i = 0; i < N; i++) {
    let x, y, n = 0;
    do { x = (hash(i * 1.3 + n * 17.1) - 0.5) * 3400; y = (hash(i * 2.7 + n * 9.7) - 0.5) * 1900; n++; } while (Math.hypot(x, y * 1.4) < 380 && n < 50);
    items.push({ x, y, z: hash(i * 3.9) * ZR, type: i % 12, s: hash(i * 5.1) });
  }
  logoPts = imagePoints(IMG.mark, 5, 520);
}

// tiny glyphs of every earlier chapter, drawn at screen scale k
function glyph(ctx, it, x, y, k, a, lt) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.globalAlpha *= a;
  switch (it.type) {
    case 0: isoCube(ctx, 0, 0, 40, CUBE_PAL.brand, 1); break;
    case 1: ctx.strokeStyle = P.amber; ctx.lineWidth = 2; for (let r = 0; r < 6; r++) { ctx.beginPath(); ctx.ellipse(0, 0, 8 + r * 9, (8 + r * 9) * 1.3, 0, 0.4, TAU - 0.2); ctx.stroke(); } break;
    case 2: font(ctx, 'JB', 22, 500); ctx.fillStyle = P.soft; ctx.textAlign = 'center'; ctx.fillText('ranking online', -40, 8); ctx.fillStyle = P.amber; ctx.fillRect(60, -2, 40, 8); ctx.fillStyle = rgba(P.soft, 0.3); ctx.fillRect(100, -2, 40, 8); break;
    case 3: ctx.strokeStyle = P.cyan; ctx.lineWidth = 3; seg(ctx, 0, -40, -40, 20); seg(ctx, 0, -40, 40, 20); ctx.fillStyle = P.white; [[0, -40], [-40, 20], [40, 20]].forEach(([a, b]) => { circle(ctx, a, b, 7); ctx.fill(); }); break;
    case 4: ctx.fillStyle = P.cyan; for (let s = 0; s < 6; s++) ctx.fillRect(-60 + s * 20, -30 + ((s * 37) % 50), 16, 10); break;
    case 5: ctx.strokeStyle = P.amber; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-45, 25); ctx.lineTo(-50, -20); ctx.lineTo(-25, 0); ctx.lineTo(0, -32); ctx.lineTo(25, 0); ctx.lineTo(50, -20); ctx.lineTo(45, 25); ctx.closePath(); ctx.stroke(); break;
    case 6: ctx.fillStyle = '#5a4a6a'; ctx.strokeStyle = P.lilac; ctx.lineWidth = 2; ctx.beginPath(); for (let v = 0; v < 7; v++) { const an = v / 7 * TAU + lt, r = 30 + hash(it.s * 9 + v) * 14; v ? ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r) : ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 7: ctx.strokeStyle = P.cyan; ctx.lineWidth = 3; circle(ctx, 0, 0, 44); ctx.stroke(); for (let v = 0; v < 8; v++) { ctx.fillStyle = P.white; circle(ctx, Math.cos(v / 8 * TAU) * 44, Math.sin(v / 8 * TAU) * 44, 6); ctx.fill(); } break;
    case 8: ctx.fillStyle = P.cyan; ctx.beginPath(); ctx.moveTo(0, -40); ctx.bezierCurveTo(28, -6, 26, 22, 0, 24); ctx.bezierCurveTo(-26, 22, -28, -6, 0, -40); ctx.fill(); break;
    case 9: ctx.fillStyle = rgba(P.amber, 0.6); ctx.beginPath(); ctx.moveTo(-10, -40); ctx.lineTo(10, -40); ctx.lineTo(50, 40); ctx.lineTo(-50, 40); ctx.fill(); break;
    case 10: font(ctx, 'JB', 24, 500); ctx.fillStyle = P.text; ctx.textAlign = 'center'; ctx.fillText('move_and_slide()', 0, 8); break;
    case 11: { const S = ['.oooo.', 'occcco', 'onwwno', '.osso.', 'oddddo', '.o..o.']; const pal = { o: '#0c2430', c: P.cyan, n: P.face, w: '#fff', s: P.sky, d: P.deep };
      S.forEach((r, i) => [...r].forEach((ch, j) => { if (ch !== '.') { ctx.fillStyle = pal[ch]; ctx.fillRect((j - 3) * 12, (i - 3) * 12, 12, 12); } })); break; }
  }
  ctx.restore();
}

function draw(ctx, lt) {
  bg(ctx, P.ink);
  const flashT = L('flash'), markT = L('mark');
  const climb = prog(lt, L('climb'), flashT);
  const pull = E.inExpo(climb);
  const travel = lt * 420 + (lt > L('climb') ? Math.pow(lt - L('climb'), 3) * 120 : 0);
  const f = 900;
  const deep = ctx.createRadialGradient(CX, CY, 0, CX, CY, 1200);
  deep.addColorStop(0, rgba('#10284a', 0.8 + pull * 0.2)); deep.addColorStop(1, rgba(P.ink, 0)); ctx.fillStyle = deep; ctx.fillRect(0, 0, W, H);

  if (lt < flashT) {
    // the tilemap returns as a perspective floor
    const fl = prog(lt, L('connect'), L('connect') + 2) * (1 - pull);
    if (fl > 0) {
      ctx.strokeStyle = rgba(P.sky, 0.18 * fl); ctx.lineWidth = 1.2;
      const yF = 520;
      for (let z = (200 - (travel % 200)); z < ZR; z += 200) { const s = f / z; seg(ctx, CX - 3000 * s, CY + yF * s, CX + 3000 * s, CY + yF * s); }
      for (let x = -3000; x <= 3000; x += 200) { seg(ctx, CX + x * f / 150, CY + yF * f / 150, CX + x * f / ZR, CY + yF * f / ZR); }
      ctx.strokeStyle = rgba(P.sky, 0.18 * fl);
      for (let z = (200 - (travel % 200)); z < ZR; z += 200) { const s = f / z; seg(ctx, CX - 3000 * s, CY - yF * s, CX + 3000 * s, CY - yF * s); }
    }
    // items fly past; connections appear between them
    const con = prog(lt, L('connect'), L('connect') + 3);
    const proj = items.map(it => {
      const z = ((it.z - travel) % ZR + ZR) % ZR + 60;
      const x = it.x * (1 - pull), y = it.y * (1 - pull);
      return [CX + x * f / z, CY + y * f / z, f / z, z];
    });
    if (con > 0) {
      ctx.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        const j = (i * 7 + 3) % N, a = proj[i], b = proj[j];
        if (Math.abs(a[3] - b[3]) > 900) continue;
        const al = con * 0.35 * clamp(1 - a[3] / ZR) * clamp(a[3] / 400);
        ctx.strokeStyle = rgba(i % 5 ? P.sky : P.amber, al); seg(ctx, a[0], a[1], b[0], b[1]);
        // and everything is wired to the centre
        if (i % 9 === 0) { ctx.strokeStyle = rgba(P.cyan, al * 0.6); seg(ctx, a[0], a[1], CX, CY); }
      }
    }
    items.map((it, i) => [it, proj[i]]).sort((a, b) => b[1][3] - a[1][3]).forEach(([it, p]) => {
      const a = clamp(1 - p[3] / ZR) * clamp(p[3] / 250) * E.outCubic(prog(lt, 0, 1.2));
      if (p[0] < -200 || p[0] > W + 200 || p[1] < -200 || p[1] > H + 200) return;
      glyph(ctx, it, p[0], p[1], p[2] * 1.2, a, lt);
    });
    // the opening geometry returns at the centre: point → ring → cube
    const geo = prog(lt, L('forming') - 1, L('forming'));
    if (geo > 0 || lt < 2) {
      const pulse = CORE.beatPulse(lt, 8) + (climb > 0.5 ? CORE.beatPulse(lt, 14, 0, B / 2) : 0);
      ctx.strokeStyle = rgba(P.white, 0.8 * Math.max(geo, 0)); ctx.lineWidth = 2.5;
      const K = 80 * E.outBack(geo, 2) * (1 + pulse * 0.08) * (1 - pull * 0.9);
      const V = CUBE_V.map(v => rotX(rotY(v, lt * 0.9), 0.5 + lt * 0.3).map(c => c * K));
      CUBE_E.forEach(([a, b]) => seg(ctx, CX + V[a][0], CY + V[a][1], CX + V[b][0], CY + V[b][1]));
      for (let k = 0; k < 4; k++) { const p = ((lt * (1 + climb * 3) + k / 4) % 1); ctx.strokeStyle = rgba(P.cyan, (1 - p) * 0.4 * Math.max(geo, 0)); circle(ctx, CX, CY, 20 + p * 600 * (1 - pull * 0.7)); ctx.stroke(); }
      glow(ctx, CX, CY, 80 + pull * 400, P.cyan, 0.5 + pull * 0.5);
      ctx.fillStyle = P.white; circle(ctx, CX, CY, 6 + pull * 20); ctx.fill();
    }
    const backing = Math.max(prog(lt, 1.2, 1.8) * (1 - prog(lt, 6.6, 7.2)), prog(lt, L('forming') - 0.2, L('forming') + 0.4) * (1 - prog(lt, L('climb') - 0.2, L('climb') + 0.3)));
    if (backing > 0) { const g = ctx.createRadialGradient(CX, CY + 120, 0, CX, CY + 120, 760); g.addColorStop(0, rgba(P.ink, 0.85 * backing)); g.addColorStop(1, rgba(P.ink, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    statement(ctx, [{ text: 'O que vem a seguir', size: 96, wght: 300, fam: 'SG', col: P.text }], CX, CY + 30, lt, 1.4, 6.6, { align: 'center' });
    statement(ctx, [{ text: 'Um estúdio em formação.', size: 104, wght: 700, fam: 'SG', col: P.text }], CX, CY + 250, lt, L('forming'), L('climb') - 0.2, { align: 'center' });
    statement(ctx, [{ text: 'Jogos no ar e jogos no forno.', size: 36, wght: 300, col: P.soft }], CX, CY + 330, lt, L('forming') + 0.6, L('climb') - 0.2, { align: 'center' });
  }

  // ── the mark assembles from its own particles (flash → mark)
  if (lt >= flashT - 0.05) {
    const LY = CY - 20;
    const crisp = prog(lt, markT, markT + 0.3);
    const push = 1 + E.inOutSine(prog(lt, markT, 30)) * 0.05;
    // rings breathing from the mark, the floor glowing underneath
    for (let k = 0; k < 3; k++) { const p = (((lt - markT) / (B * 2) + k / 3) % 1); if (lt > markT) { ctx.strokeStyle = rgba(P.cyan, (1 - p) * 0.25); ctx.lineWidth = 2; circle(ctx, CX, LY, 280 + p * 700); ctx.stroke(); } }
    if (crisp < 1) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      logoPts.forEach((p, i) => {
        const d = hash(i * 0.77) * 0.45;
        const q = E.outExpo(prog(lt, flashT + d * 0.9, flashT + d * 0.9 + 0.75));
        const an = hash(i * 1.9) * TAU, R = 900 + hash(i * 3.3) * 900;
        const x = lerp(CX + Math.cos(an) * R, CX + p.x * push, q), y = lerp(LY + Math.sin(an) * R * 0.6, LY + p.y * push, q);
        ctx.fillStyle = q > 0.97 ? p.c : rgba(P.ice, 0.8);
        ctx.globalAlpha = (1 - crisp) * clamp(q * 3);
        const s = lerp(3, 5, q); ctx.fillRect(x - s / 2, y - s / 2, s, s);
      });
      ctx.restore();
    }
    if (crisp > 0) {
      glow(ctx, CX, LY, 600, P.sky, 0.18 * crisp);
      drawMark(ctx, CX, LY, 520 * push, crisp);
      const sw = prog(lt, markT + 0.4, markT + 1.6);
      if (sw > 0 && sw < 1 && window.SWEEP) window.SWEEP(ctx, CX, LY, 520 * push, sw);
    }
  }
}

(window.CHAPTERS = window.CHAPTERS || [])[8] = {
  init, draw,
  fx: lt => ({ bloom: lt > L('mark') ? 0.25 : 0.5, grain: 0.05, rgb: lt > L('climb') && lt < L('flash') ? prog(lt, L('climb'), L('flash')) * 8 : 0,
    flash: lt > L('flash') ? 0.35 * Math.exp(-(lt - L('flash')) * 2.5) : 0 }),
  hud: lt => (lt < L('climb') ? { word: 'SYSTEM' } : null),
};
})();

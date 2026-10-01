// CH10 — SCORPION BITS (4:40–5:00)
// The whole universe compresses into one precise mark. A title treatment with the studio's own line
// ("Ideias que viram jogo." — the H1 of scorpionbits.com), then the final minimal lockup, as the site's header
// pairs them: the mark and "Scorpion Bits". It ends on the mark and a subtle pulse — the same pulse as the first point.
(function () {
const { W, H, CX, CY, TAU, P, clamp, lerp, prog, E, hash, rgba, bg, font, circle, glow, seg, label, layout, drawMark, isoGrid } = CORE;
const { B, c10 } = TL;
const T0 = TL.CH[9];
const L = k => c10[k] - T0;

function draw(ctx, lt) {
  bg(ctx, P.ink);
  const lock = L('lock'), word = L('word'), tag = L('tag'), fin = L('final');
  isoGrid(ctx, 80, 0, 0, 0.04 * (1 - prog(lt, fin - 1, fin)));
  const deep = ctx.createRadialGradient(CX, CY, 0, CX, CY, 1000);
  deep.addColorStop(0, rgba('#10284a', 0.55 * (1 - prog(lt, lock, fin)) + 0.25)); deep.addColorStop(1, rgba(P.ink, 0));
  ctx.fillStyle = deep; ctx.fillRect(0, 0, W, H);

  // ── collapse: the universe streaks into the mark
  const col = prog(lt, 0, lock);
  if (lt < lock + 0.3) {
    for (let k = 0; k < 420; k++) {
      const an = hash(k * 1.7) * TAU, d0 = 300 + hash(k * 3.1) * 1400;
      const p = E.inExpo(clamp(col * 1.25 - hash(k * 5.3) * 0.25));
      const r = d0 * (1 - p) + 60, tail = (30 + 260 * p) * (1 - p) * 1.6;
      const x = CX + Math.cos(an) * r, y = CY - 20 + Math.sin(an) * r * 0.6;
      ctx.strokeStyle = rgba(k % 7 ? P.cyan : P.amber, 0.7 * (1 - p * p) * (1 - prog(lt, lock - 0.1, lock + 0.2)));
      ctx.lineWidth = 1.5 + p * 2; seg(ctx, x, y, x + Math.cos(an) * tail, y + Math.sin(an) * tail * 0.6);
    }
  }
  // mark: from the chapter-09 size down to the title size, then into the final lockup
  const m1 = E.inOutExpo(prog(lt, 0.4, lock));
  const m2 = E.inOutExpo(prog(lt, fin - 0.2, fin + 1.0));
  let mh = lerp(lerp(520, 300, m1), 180, m2), mx = lerp(CX, CX - 330, m2), my = lerp(lerp(CY - 20, CY - 110, m1), CY, m2);
  // lock: a thin ring snaps closed around the mark
  const snap = prog(lt, lock - 0.15, lock + 0.25);
  if (snap > 0 && lt < fin) {
    ctx.strokeStyle = rgba(P.cyan, (1 - prog(lt, lock + 0.2, lock + 1.6)) * 0.9); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 210 + (1 - E.outBack(snap, 2)) * 120, -Math.PI / 2, -Math.PI / 2 + TAU * E.outCubic(snap)); ctx.stroke();
  }
  glow(ctx, mx, my, mh * 1.3, P.sky, 0.12 + 0.2 * (1 - prog(lt, lock, lock + 1.5)));
  drawMark(ctx, mx, my, mh, 1);
  const sw = prog(lt, lock + 0.6, lock + 1.8);
  if (sw > 0 && sw < 1 && window.SWEEP) window.SWEEP(ctx, mx, my, mh, sw);

  // ── title treatment: SCORPION BITS / Ideias que viram jogo.
  if (lt >= word - 0.1 && lt < fin + 0.4) {
    const out = E.inExpo(prog(lt, fin - 0.6, fin));
    const p = E.outExpo(prog(lt, word, word + 1.4));
    ctx.save();
    ctx.beginPath(); ctx.rect(0, CY + 70, W, 150); ctx.clip();
    font(ctx, 'SG', 120, lerp(300, 700, p)); ctx.textBaseline = 'alphabetic'; ctx.fillStyle = P.text;
    const lay = layout(ctx, 'SCORPION BITS', CX, lerp(60, 14, p));
    lay.forEach((Lt, i) => {
      const q = E.outExpo(prog(lt, word + i * 0.035, word + 0.8 + i * 0.035));
      ctx.textAlign = 'center'; ctx.fillText(Lt.ch, Lt.x, CY + 190 + (1 - q) * 150 - out * 150);
    });
    ctx.restore();
    const tp = E.outExpo(prog(lt, tag, tag + 1.2));
    ctx.save(); ctx.globalAlpha = tp * (1 - out);
    font(ctx, 'IN', 44, 300); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.soft; ctx.letterSpacing = `${lerp(14, 2, tp)}px`;
    ctx.fillText('Ideias que viram jogo.', CX, CY + 290);
    ctx.restore();
  }

  // ── final lockup: the mark + "Scorpion Bits", as on the site's header
  if (lt >= fin - 0.1) {
    const p = E.outExpo(prog(lt, fin + 0.5, fin + 1.6));
    ctx.save(); ctx.beginPath(); ctx.rect(CX - 225, CY - 100, 980, 200); ctx.clip();
    font(ctx, 'SG', 118, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.text;
    ctx.fillText('Scorpion Bits', CX - 215 + (1 - p) * -120, CY + 6);
    ctx.restore();
    const u = prog(lt, fin + 2.0, fin + 3.0);
    label(ctx, 'SCORPIONBITS.COM', CX - 210, CY + 108, 0.6 * u, P.dim, 15);
  }
  // the pulse: the same signal as the very first point of the film
  c10.pulses.forEach(tp => {
    const p = (lt - (tp - T0)) / 1.8;
    if (p <= 0 || p >= 1) return;
    ctx.strokeStyle = rgba(P.cyan, (1 - p) * 0.55); ctx.lineWidth = 1.5;
    circle(ctx, mx, my, mh * 0.55 + E.outExpo(p) * 160); ctx.stroke();
  });
}

(window.CHAPTERS = window.CHAPTERS || [])[9] = {
  draw,
  fx: lt => ({ bloom: 0.22, grain: 0.04 }),
  hud: () => null,
};
})();

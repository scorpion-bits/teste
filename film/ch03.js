// CH03 — O PROBLEMA (0:55–1:25)
// "Poucas mecânicas bem resolvidas valem mais que uma lista de recursos pela metade.
//  Testamos até parecer óbvio pra quem joga." — scorpionbits.com
// A wall of half-finished features → a tangled dependency network → a scanning intelligence that orders it →
// three polished mechanics → one mechanic tested until it feels obvious.
(function () {
const { W, H, CX, CY, TAU, P, clamp, lerp, prog, E, hash, hash2, noise1, noise2, rgba, mix, bg, font, circle, glow, seg,
  label, scramble, iso, isoCube, CUBE_PAL, statement } = CORE;
const { B, c3 } = TL;
const T0 = TL.CH[2];
const L = k => c3[k] - T0;

// generic feature-creep (illustrative, not the studio's projects)
const FEATURES = ['mundo aberto', 'multiplayer', 'clima dinâmico', 'ciclo dia/noite', 'pesca', 'editor de fases', 'facções',
  'romance', 'fazenda', 'parkour', 'stealth', 'veículos', 'mergulho', 'escalada', 'cartas', 'economia', 'ranking online',
  'dublagem', 'física de tecido', 'reputação', 'pets', 'minigames', 'cidade viva', 'construção', 'conquistas', 'skins',
  'modo foto', 'PvP', 'raids', 'guildas', 'chat de voz', 'leilão', 'temporadas', 'IA de companheiros', 'destruição total',
  'cutscenes 3D', 'modo VR', 'cross-save', 'battle royale', 'mapa gigante', 'clãs', 'ranqueada'];
const COLS = 6, ROWH = 34, NODES = 700, GC = 35;
let nodes = [], edges = [];
function init() {
  for (let k = 0; k < NODES; k++) {
    const c = k % COLS, r = Math.floor(k / COLS);
    nodes.push({
      k, h: hash(k * 3.7), cx: CX + (hash(k * 1.1) - 0.5) * 1900, cy: CY + (hash(k * 2.3 + 7) - 0.5) * 1000,
      rx: 110 + c * 300, ry: 20 + r * ROWH, gx: 165 + (k % GC) * 46.5, gy: 150 + Math.floor(k / GC) * 40,
    });
  }
  for (let k = 0; k < NODES; k++) {
    if (k % GC < GC - 1 && hash(k * 9.1) > 0.25) edges.push([k, k + 1]);
    if (k + GC < NODES && hash(k * 5.3) > 0.45) edges.push([k, k + GC]);
  }
}

function rowsWall(ctx, lt, a) {
  ctx.save(); font(ctx, 'JB', 15, 500); ctx.textBaseline = 'middle';
  const total = Math.ceil(H / ROWH) + 2;
  for (let c = 0; c < COLS; c++) {
    const dir = c % 2 ? 1 : -1, speed = 40 + hash(c * 7) * 90;
    const off = ((lt * speed * dir) % ROWH + ROWH) % ROWH;
    const base = Math.floor(lt * speed * dir / ROWH);
    for (let r = -1; r < total; r++) {
      const id = (r - base) * COLS + c + 1000;
      const x = 80 + c * 300, y = r * ROWH + off;
      const flick = hash2(id, Math.floor(lt * 12)) > 0.93 ? 0.3 : 1;
      const al = a * flick * (0.7 + 0.3 * hash(id * 1.3));
      const pct = 0.3 + 0.3 * hash(id * 2.9) + 0.03 * Math.sin(lt * 6 + id);
      const warn = hash(id * 4.1) > 0.86;
      ctx.strokeStyle = rgba(P.soft, al * 0.7); ctx.lineWidth = 1.2; ctx.strokeRect(x, y - 7, 14, 14);
      ctx.fillStyle = rgba(warn ? P.amber : P.soft, al);
      ctx.fillText(FEATURES[Math.floor(hash(id * 0.7) * FEATURES.length)], x + 26, y);
      ctx.fillStyle = rgba(P.soft, al * 0.18); ctx.fillRect(x + 200, y - 3, 55, 6);
      ctx.fillStyle = rgba(warn ? P.amber : P.sky, al * 0.85); ctx.fillRect(x + 200, y - 3, 55 * pct, 6);
      ctx.fillStyle = rgba(P.dim, al); ctx.fillText(`${Math.round(pct * 100)}%`, x + 262, y);
    }
  }
  ctx.restore();
}

function draw(ctx, lt) {
  bg(ctx, P.ink);
  const tangle = L('tangle'), scan = L('scan'), sorted = L('sorted'), few = L('few'), test = L('test');

  // ── A. the wall of half-finished features (0 – 8)
  if (lt < tangle + 1.2) {
    const a = E.outCubic(prog(lt, 0.1, 1.2)) * (1 - prog(lt, tangle, tangle + 0.6));
    // burst fragments from chapter 02 decelerate into the wall
    if (lt < 1.2) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 600; k++) {
        const an = hash(k * 3.1) * TAU, sp = 200 + hash(k * 7.7) * 1400, d = 1 + E.outCubic(prog(lt, 0, 1.2)) * 0.25;
        const s = 2 + hash(k) * 5;
        ctx.fillStyle = rgba(P.sky, 0.7 * (1 - lt / 1.2));
        ctx.fillRect(CX + Math.cos(an) * sp * d - s / 2, CY - 60 + Math.sin(an) * sp * d * 0.7 - s / 2, s, s);
      }
      ctx.restore();
    }
    const z = lerp(2.6, 1, E.inOutCubic(prog(lt, 0, 6.5)));
    ctx.save(); ctx.translate(CX, CY); ctx.scale(z, z); ctx.rotate(-0.06 * (z - 1)); ctx.translate(-CX, -CY);
    rowsWall(ctx, lt, a);
    ctx.restore();
    if (a > 0) {
      const g = ctx.createRadialGradient(CX, CY, 100, CX, CY, 900);
      g.addColorStop(0, rgba(P.ink, 0)); g.addColorStop(1, rgba(P.ink, 0.5)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const n = Math.floor(lt * 237 + 120);
      label(ctx, `RECURSOS PELA METADE  ·  ${String(n).padStart(4, '0')}`, 96, H - 96, 0.7 * a, P.amber, 13);
    }
  }

  // ── B/C. tangle → scan → ordered grid (7.5 – 17)
  if (lt >= tangle - 0.2 && lt < few + 1.6) {
    const into = E.inOutExpo(prog(lt, tangle - 0.2, tangle + 1.0));
    const sx = lerp(-200, W + 200, E.inOutSine(prog(lt, scan, sorted)));
    const dropP = prog(lt, few, few + 1.4);
    const pos = n => {
      const wob = 1 + prog(lt, tangle, scan) * 1.5;
      let x = lerp(n.rx, n.cx + noise2(n.k * 0.3, lt * 0.5) * 90 * wob, into);
      let y = lerp(n.ry, n.cy + noise2(n.k * 0.3 + 50, lt * 0.5) * 90 * wob, into);
      const o = E.outExpo(prog(sx - n.cx, 0, 380));
      x = lerp(x, n.gx, o); y = lerp(y, n.gy, o);
      if (dropP > 0 && !n.keep) { y += E.inCubic(clamp(dropP * 1.5 - n.h * 0.5)) * 900; }
      return [x, y, o];
    };
    const P2 = nodes.map(pos);
    const fade = 1 - prog(lt, few + 0.4, few + 1.5);
    // edges
    ctx.lineWidth = 1;
    edges.forEach(([a, b], i) => {
      const p = P2[a], q = P2[b];
      const ord = Math.min(p[2], q[2]);
      const conflict = ord < 0.5 && hash2(i, Math.floor(lt * 7)) > 0.97;
      ctx.strokeStyle = conflict ? rgba(i % 2 ? P.amber : P.red, 0.7 * fade) : rgba(mix(P.sky, P.cyan, ord) === '' ? P.sky : P.sky, (0.14 + ord * 0.25) * fade * into);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]);
      if (ord > 0.9) { ctx.lineTo(q[0], p[1]); ctx.lineTo(q[0], q[1]); } else ctx.lineTo(q[0], q[1]);
      ctx.stroke();
      // signals travelling along dependencies
      if (i % 5 === 0 && into > 0.5) {
        const f = (lt * (0.6 + hash(i) * 1.2) + hash(i * 3)) % 1;
        ctx.fillStyle = rgba(ord > 0.9 ? P.cyan : P.text, 0.8 * fade);
        ctx.fillRect(lerp(p[0], q[0], f) - 1.5, lerp(p[1], q[1], f) - 1.5, 3, 3);
      }
    });
    // nodes
    nodes.forEach((n, i) => {
      const [x, y, o] = P2[i];
      if (n.keep) return;
      const blink = o < 0.5 && hash2(i, Math.floor(lt * 9)) > 0.9;
      const s = lerp(3, 5, o) * (blink ? 1.8 : 1);
      ctx.fillStyle = rgba(o > 0.5 ? P.cyan : blink ? P.amber : P.soft, (0.5 + o * 0.5) * fade * into);
      if (o > 0.6) ctx.fillRect(x - s / 2, y - s / 2, s, s); else { circle(ctx, x, y, s / 2); ctx.fill(); }
    });
    // the scanning beam
    if (lt > scan && lt < sorted + 0.2) {
      const g = ctx.createLinearGradient(sx - 260, 0, sx + 20, 0);
      g.addColorStop(0, rgba(P.cyan, 0)); g.addColorStop(0.9, rgba(P.cyan, 0.12)); g.addColorStop(1, rgba(P.cyan, 0.7));
      ctx.fillStyle = g; ctx.fillRect(sx - 260, 0, 280, H);
      ctx.fillStyle = rgba(P.white, 0.9); ctx.fillRect(sx - 1, 0, 2, H);
      label(ctx, 'PROCESS · ORDENANDO', sx + 18, 120, 0.8, P.cyan, 13);
    }
    if (lt > tangle + 0.5 && lt < sorted + 0.5) {
      const a = prog(lt, tangle + 0.5, tangle + 1.2) * (1 - prog(lt, sorted, sorted + 0.5));
      label(ctx, `DEPENDÊNCIAS  ·  ${edges.length}  ·  CONFLITOS ${String(Math.floor(40 + noise1(lt * 3) * 30) * (1 - prog(lt, scan, sorted)) | 0).padStart(2, '0')}`, 96, H - 96, 0.7 * a, P.soft, 13);
    }
  }

  // ── D. few mechanics, well resolved (16.25 – 22.5)
  const keep = [[-380, 0], [0, 0], [380, 0]];
  if (lt >= few - 0.1 && lt < test + 7.5) {
    const grow = E.outBack(prog(lt, few, few + 0.8), 1.6);
    const toTest = E.inOutExpo(prog(lt, test - 0.6, test + 0.2));
    keep.forEach(([dx], i) => {
      const n = nodes[GC * 10 + 15 + i * 2];
      const x0 = n.gx, y0 = n.gy;
      let x = lerp(x0, CX + dx, E.inOutExpo(prog(lt, few, few + 0.9))), y = lerp(y0, CY - 40, E.inOutExpo(prog(lt, few, few + 0.9)));
      const s = lerp(4, 82, grow);
      if (i !== 1) {
        const a = 1 - toTest;
        if (a <= 0) return;
        glow(ctx, x, y, s * 3, P.sky, 0.12 * a);
        isoCube(ctx, x, y, s, CUBE_PAL.brand, a);
        label(ctx, `MECÂNICA 0${i + 1}`, x, y + s + 40, 0.6 * a * grow, P.dim, 13, 'center');
      } else if (lt < test) {
        glow(ctx, x, y, s * 3, P.sky, 0.12);
        isoCube(ctx, x, y, s, CUBE_PAL.brand, 1);
        label(ctx, 'MECÂNICA 02', x, y + s + 40, 0.6 * grow, P.dim, 13, 'center');
      }
    });
    statement(ctx, [
      { text: 'Poucas mecânicas bem resolvidas', size: 84, wght: 700, fam: 'SG', col: P.text, lh: 1.15 },
      { text: 'valem mais que uma lista de recursos pela metade.', size: 40, wght: 300, col: P.soft },
    ], CX, CY + 230, lt, few + 0.9, test - 0.9, { align: 'center' });
  }

  // ── E. testing until it feels obvious (22.5 – 30)
  if (lt >= test - 0.6) {
    const enter = E.inOutExpo(prog(lt, test - 0.6, test + 0.2));
    const out = E.inExpo(prog(lt, 29.0, 29.85));
    const x0 = CX - 460, x1 = CX + 460, fy = CY + 120;
    ctx.save(); ctx.globalAlpha = 1 - out;
    ctx.strokeStyle = rgba(P.soft, 0.7 * enter); ctx.lineWidth = 4; ctx.lineCap = 'round';
    seg(ctx, x0 - 90, fy, x0 + 90, fy); seg(ctx, x1 - 90, fy, x1 + 90, fy);
    ctx.restore();
    const n = 12, dt = (L('obvious') - test) / n;
    const finalT = L('obvious'), finalLen = 0.85;
    const arcOf = (k) => {
      const q = Math.min(1, k / (n - 1));
      return { err: (1 - q) * (hash(k * 3.3) - 0.5) * 520, apex: 300 + (1 - q) * (hash(k * 5.1) - 0.5) * 260, jag: (1 - q) * 36, q };
    };
    const path = (A, u, k) => {
      const x = lerp(x0, x1 + A.err, u), y = fy - 36 - 4 * A.apex * u * (1 - u) + noise1(u * 14 + k * 7) * A.jag * Math.sin(Math.PI * u);
      return [x, y];
    };
    // ghosts of earlier attempts
    const cur = lt < finalT ? Math.floor((lt - test) / dt) : n;
    for (let k = 0; k < Math.min(cur, n); k++) {
      const A = arcOf(k);
      ctx.strokeStyle = rgba(A.q > 0.9 ? P.cyan : P.soft, (0.08 + 0.2 * A.q) * (1 - out)); ctx.lineWidth = 1.5;
      ctx.beginPath(); for (let u = 0; u <= 1; u += 0.02) { const [x, y] = path(A, u, k); u ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    }
    let k = cur, u, A;
    if (lt >= finalT) { A = { err: 0, apex: 300, jag: 0, q: 1 }; u = E.inOutSine(prog(lt, finalT, finalT + finalLen)); k = n; }
    else if (lt >= test) { A = arcOf(k); u = clamp((lt - test - k * dt) / (dt * 0.85)); }
    if (A && enter > 0.5) {
      // current attempt: trail + cube
      ctx.strokeStyle = rgba(A.q === 1 ? P.cyan : P.text, 0.9 * (1 - out)); ctx.lineWidth = A.q === 1 ? 3 : 2;
      ctx.beginPath(); for (let v = 0; v <= u; v += 0.02) { const [x, y] = path(A, v, k); v ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      const [x, y] = path(A, u, k);
      const miss = Math.abs(A.err) > 100 && u >= 1;
      const land = u >= 1 ? Math.exp(-(lt - (lt >= finalT ? finalT + finalLen : test + k * dt + dt * 0.85)) * 16) : 0;
      ctx.save(); ctx.translate(x, y + 36 + (miss ? 60 * (1 - land) : 0)); ctx.scale(1 + land * 0.3, 1 - land * 0.3);
      isoCube(ctx, 0, -36, 36, CUBE_PAL.brand, (miss ? 0.4 : 1) * (1 - out) * enter);
      ctx.restore();
      label(ctx, `TESTE ${String(Math.min(k + 1, 13)).padStart(2, '0')}`, CX, CY - 320, 0.7 * (1 - out), lt >= finalT ? P.cyan : P.soft, 15, 'center');
    } else if (enter > 0) {
      isoCube(ctx, lerp(CX, x0, enter), lerp(CY - 40, fy - 36, enter) + 36 - 36, lerp(82, 36, enter), CUBE_PAL.brand, 1);
    }
    statement(ctx, [
      { text: 'Testamos até parecer óbvio', size: 76, wght: 700, fam: 'SG', col: P.text, lh: 1.1 },
      { text: 'pra quem joga.', size: 76, wght: 300, fam: 'SG', col: P.cyan },
    ], CX, CY + 290, lt, finalT + 0.3, 29.0, { align: 'center' });
    // what remains is a point — the seed of chapter 04
    if (out > 0) {
      const p = E.inOutExpo(prog(lt, 29.2, 30));
      glow(ctx, lerp(x1, 240, p), lerp(fy - 40, CY, p), 60, P.cyan, 0.6 * out);
      ctx.fillStyle = P.white; circle(ctx, lerp(x1, 240, p), lerp(fy - 40, CY, p), 6 * out); ctx.fill();
    }
  }
}

(window.CHAPTERS = window.CHAPTERS || [])[2] = {
  init, draw,
  fx: lt => ({ bloom: 0.4, grain: 0.06, scan: lt < L('sorted') ? 0.1 : 0 }),
  hud: () => ({ word: 'DATA' }),
};
})();

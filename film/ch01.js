// CH01 — ABERTURA (0:00–0:25)
// A point. A pulse. It becomes a line, the line folds into a square, the square turns in 3D and settles into
// the isometric brand cube. The cube multiplies into a tilemap, the tilemap becomes a living system,
// and every cube flies home to become one bit of the official mark.
(function () {
const { W, H, CX, CY, TAU, P, clamp, lerp, prog, E, spring, hash, hash2, noise1, fbm2, rgba, mix, bg, font, circle, glow,
  layout, scramble, label, imagePoints, IMG, drawMark, rotX, rotY, iso, isoCube, CUBE_PAL, CUBE_V, CUBE_E, ISO_YAW, ISO_PITCH, ISO } = CORE;
const { B, c1 } = TL;
const T0 = TL.CH[0];
const L = k => c1[k] - T0; // local cue times

const S_CUBE = 150, K = S_CUBE / 1.633; // iso hexagon radius ↔ 3D half-edge
const LAT = 26, R_MAX = 24;              // lattice cube size and extent
let cells = [], targets = [];

function init() {
  // lattice cells, painter-ordered
  for (let i = -R_MAX; i <= R_MAX; i++) for (let j = -R_MAX; j <= R_MAX; j++) {
    const d = Math.max(Math.abs(i), Math.abs(j), Math.abs(i + j) * 0.75);
    cells.push({ i, j, d, h: hash2(i * 1.3, j * 2.1), id: cells.length });
  }
  cells.sort((a, b) => a.i + a.j - (b.i + b.j));
  // the mark sampled as a mosaic: each target is a "bit"
  targets = imagePoints(IMG.mark, 12, 480).map((p, k) => ({ ...p, k }));
  // assign each target a source cell (deterministic scatter among the inner rings)
  const pool = cells.filter(c => c.d <= 15);
  targets.forEach((tg, k) => { tg.src = pool[Math.floor(hash(k * 7.31 + 0.5) * pool.length)]; });
  const used = new Set(targets.map(t => t.src.id));
  cells.forEach(c => { c.used = used.has(c.id); });
}

// the line / square / cube outline as a closed polyline of N samples
const N = 160;
function linePts(lt, amp) {
  const half = 430 * E.outExpo(prog(lt, L('stretch') + 0.12, L('stretch') + 1.0));
  const pts = [];
  for (let n = 0; n < N; n++) {
    const u = n / (N - 1), x = lerp(-half, half, u);
    const env = Math.sin(Math.PI * u);
    const y = amp * env * (Math.sin(u * TAU * 3 + lt * 9) * 0.6 + Math.sin(u * TAU * 7 - lt * 13) * 0.3 + noise1(u * 12 + lt * 6) * 0.25);
    pts.push([x, y]);
  }
  return pts;
}
function squarePts(a) {
  // perimeter of a square of half-side a, starting at the left edge midpoint so it unfolds from the line
  const pts = [];
  for (let n = 0; n < N; n++) {
    const u = n / (N - 1) * 4, side = Math.min(3, Math.floor(u)), f = u - side;
    const c = [[-a, a], [-a, -a], [a, -a], [a, a]], d = [[-a, -a], [a, -a], [a, a], [-a, a]];
    pts.push([lerp(c[side][0], d[side][0], f), lerp(c[side][1], d[side][1], f)]);
  }
  return pts;
}

function draw(ctx, lt) {
  const b = lt / B;
  bg(ctx, P.ink);
  // depth haze grows with complexity
  const haze = prog(lt, 10, 18) * (1 - prog(lt, 21.25, 23));
  if (haze > 0) {
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 1100);
    g.addColorStop(0, rgba('#0f2440', 0.9 * haze)); g.addColorStop(1, rgba(P.ink, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ── 1. the point and its pulses (0 – 4.4)
  const born = E.outBack(prog(lt, L('point'), L('point') + 0.35), 3);
  const stretchAt = L('stretch');
  if (lt < stretchAt + 0.2) {
    let ring = 0;
    c1.pulses.forEach(tp => {
      const p = (lt - (tp - T0)) / 1.6;
      if (p > 0 && p < 1) {
        ctx.strokeStyle = rgba(P.cyan, (1 - p) * 0.45); ctx.lineWidth = 1.5;
        circle(ctx, CX, CY, 8 + E.outExpo(p) * 260); ctx.stroke();
      }
      if (lt >= tp - T0) ring = Math.max(ring, Math.exp(-(lt - (tp - T0)) * 5) * Math.cos((lt - (tp - T0)) * 40));
    });
    // anticipation: squash before the stretch
    const anti = E.inOutCubic(prog(lt, stretchAt - 0.25, stretchAt)) * (1 - prog(lt, stretchAt, stretchAt + 0.12));
    const r = 6 * born * (1 + ring * 0.6) + Math.sin(lt * 3) * 0.4 * born;
    ctx.save(); ctx.translate(CX, CY); ctx.scale(1 - anti * 0.45, 1 + anti * 0.6);
    glow(ctx, 0, 0, 60 * born, P.cyan, 0.35 + ring * 0.2);
    ctx.fillStyle = P.white; circle(ctx, 0, 0, r); ctx.fill();
    ctx.restore();
    if (born > 0) label(ctx, 'SIGNAL', CX, CY + 60, 0.35 * born * (1 - anti), P.dim, 12, 'center');
  }

  // ── 2. line → square → 3D cube (4.4 – 9.4)
  const f1 = L('fold1'), f2 = L('fold2'), settle = L('settle');
  if (lt >= stretchAt && lt < settle + 0.6) {
    const amp = 46 * prog(lt, stretchAt + 0.3, stretchAt + 1.1) * (1 - prog(lt, f1 - 0.3, f1));
    const A = linePts(lt, amp), Sq = squarePts(K);
    const m = E.outBack(prog(lt, f1, f1 + 0.5), 1.2);
    // depth extrusion and rotation into isometric
    const ext = E.outBack(prog(lt, f2, f2 + 0.9), 1.4);
    const rp = prog(lt, f2, settle);
    const sp = clamp(spring(lt - f2, 5.2, 3.2) * (rp < 1 ? 1 : 1));
    const yaw = lerp(-Math.PI * 0.75, ISO_YAW, sp), pitch = lerp(0, ISO_PITCH, sp);
    const fill = E.outCubic(prog(lt, settle - 0.05, settle + 0.25));
    ctx.save(); ctx.translate(CX, CY);
    ctx.shadowColor = P.cyan; ctx.shadowBlur = 12;
    if (lt < f2) {
      ctx.strokeStyle = P.white; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      A.forEach((p, n) => { const q = Sq[n], x = lerp(p[0], q[0], m), y = lerp(p[1], q[1], m); n ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      // corner sparks when the fold lands
      if (m > 0.9) {
        const k = 1 - prog(lt, f1 + 0.5, f1 + 0.9);
        ctx.fillStyle = rgba(P.cyan, k);
        [[-K, -K], [K, -K], [K, K], [-K, K]].forEach(([x, y]) => { circle(ctx, x, y, 4); ctx.fill(); });
      }
    } else if (fill < 1) {
      const V = CUBE_V.map(v => rotX(rotY([v[0], v[1], v[2] * Math.max(0.001, ext)], yaw), pitch).map(c => c * K));
      CUBE_E.forEach(([a, c]) => {
        const z = (V[a][2] + V[c][2]) / 2;
        ctx.strokeStyle = rgba(P.white, (z < K * 0.2 ? 1 : 0.28) * (1 - fill));
        ctx.lineWidth = z < 0 ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(V[a][0], V[a][1]); ctx.lineTo(V[c][0], V[c][1]); ctx.stroke();
      });
      ctx.fillStyle = P.white;
      V.forEach(v => { if (v[2] < K * 0.2) { circle(ctx, v[0], v[1], 3.5 * (1 - fill)); ctx.fill(); } });
    }
    ctx.restore();
    if (fill > 0 && lt < L('spread') + 0.1) {
      isoCube(ctx, CX, CY, S_CUBE, CUBE_PAL.brand, fill);
      glow(ctx, CX, CY, 340, P.cyan, 0.18 * fill * (1 - prog(lt, settle, settle + 1.2)));
    }
  }

  // ── 3. the tilemap: one cube becomes a system (10 – 20)
  const spread = L('spread'), conv = L('converge'), logoT = L('logo');
  if (lt >= L('spread') && lt < L('logo') + 0.05) {
    const zoom = lerp(S_CUBE / LAT, 1, E.inOutExpo(prog(lt, spread, spread + 2.2))) * lerp(1, 0.82, E.inOutCubic(prog(lt, 15, 20)));
    const terr = E.inOutCubic(prog(lt, L('terrain'), L('terrain') + 2.5));
    const build = prog(lt, L('build'), conv);
    const s = LAT * zoom;
    const cp = prog(lt, conv, logoT - 0.12);
    // pan drifts slowly, as if the camera was floating over the system
    const panX = Math.sin(lt * 0.21) * 40 * terr, panY = -40 * terr + Math.cos(lt * 0.17) * 20 * terr;
    const pulse = (k) => { // radial ripple on beats from the build onward
      let v = 0;
      for (let q = 0; q < 16; q++) { const tb = L('terrain') + q * B * 2; const dt = lt - tb; if (dt > 0 && dt < 3) v += Math.exp(-dt * 1.8) * Math.sin(dt * 9 - k * 0.55) * clamp(dt * 6 - k * 0.12); }
      return v;
    };
    let count = 0;
    for (const c of cells) {
      const appear = E.outBack(prog(lt, spread + c.d * 0.09, spread + c.d * 0.09 + 0.35), 2);
      if (appear <= 0) continue;
      if (c.d > 10 + terr * 4 + build * 12) continue;
      const hgt = terr * (fbm2(c.i * 0.13 + lt * 0.12, c.j * 0.13 - lt * 0.08) * 3.2 + pulse(c.d) * 0.6 * (0.4 + build));
      let [x, y] = iso(c.i * 1.18, c.j * 1.18, hgt * 1.4, s);
      x += CX + panX; y += CY + panY;
      if (x < -60 || x > W + 60 || y < -80 || y > H + 80) continue;
      const hi = clamp(0.5 + hgt * 0.25 + (c.h - 0.5) * 0.25);
      if (c.used && cp > 0) continue; // drawn by the flight below
      // unused cubes fall away when the system resolves
      let fall = 0, a = appear;
      if (cp > 0) { fall = E.inCubic(clamp(cp * 1.6 - c.h * 0.6)) * 900; a *= 1 - prog(cp, 0.2 + c.h * 0.3, 0.7 + c.h * 0.3); }
      if (a <= 0) continue;
      const pal = hi > 0.66 ? CUBE_PAL.brand : hi > 0.5 ? CUBE_PAL.mid : CUBE_PAL.ghost;
      isoCube(ctx, x, y + fall, s * 0.62 * appear, pal, a * (0.55 + hi * 0.45));
      // signals: thin beams rising from the tallest cubes
      if (terr > 0 && hgt > 1.6 && c.h > 0.6) {
        const bl = ctx.createLinearGradient(x, y - s, x, y - s - 220);
        bl.addColorStop(0, rgba(P.cyan, 0.5 * terr * a)); bl.addColorStop(1, rgba(P.cyan, 0));
        ctx.fillStyle = bl; ctx.fillRect(x - 1, y - s - 220, 2, 220);
      }
      count++;
    }
    // ── 4. convergence: each used cube flies to its bit of the mark
    if (cp > 0) {
      const LY = CY - 30;
      for (const tg of targets) {
        const c = tg.src;
        const hgt = terr * fbm2(c.i * 0.13 + conv * 0.12, c.j * 0.13 - conv * 0.08) * 3.2;
        let [x0, y0] = iso(c.i * 1.18, c.j * 1.18, hgt * 1.4, s);
        x0 += CX + panX; y0 += CY + panY;
        const d0 = tg.r * 0.35;
        const p = E.inOutExpo(prog(cp, d0, d0 + 0.65));
        const arc = Math.sin(p * Math.PI) * (80 + tg.r * 160);
        const x = lerp(x0, CX + tg.x, p) + Math.cos(tg.k) * arc * 0.4, y = lerp(y0, LY + tg.y, p) - arc;
        if (p < 0.85) isoCube(ctx, x, y, lerp(s * 0.62, 7, p), CUBE_PAL.brand, 1);
        else { ctx.fillStyle = tg.c; ctx.globalAlpha = prog(p, 0.85, 1); ctx.fillRect(x - 6, y - 6, 12, 12); ctx.globalAlpha = 1; }
      }
    }
    if (lt > L('terrain') && lt < conv + 0.2) {
      const a = prog(lt, L('terrain'), L('terrain') + 1) * (1 - prog(lt, conv - 0.3, conv));
      label(ctx, `SYSTEM  ·  ${String(count).padStart(4, '0')} BITS`, 96, H - 96, 0.55 * a, P.soft, 13);
      label(ctx, 'ISO 2:1  ·  TILEMAP', W - 96, H - 96, 0.55 * a, P.soft, 13, 'right');
    }
  }

  // ── 5. the mark, then the wordmark (21.25 – 25)
  if (lt >= logoT - 0.02) {
    const word = L('word');
    const lift = E.inOutExpo(prog(lt, word - 0.6, word + 0.3));
    // final handoff: mark flies into the HUD bug for chapter 02
    const hand = E.inOutExpo(prog(lt, 23.9, 24.95));
    const mx = lerp(CX, 84, hand), my = lerp(lerp(CY - 30, CY - 95, lift), 66, hand), mh = lerp(lerp(480, 380, lift), 34, hand);
    // mosaic dissolves into the crisp mark
    const crisp = prog(lt, logoT, logoT + 0.25);
    if (crisp < 1) for (const tg of targets) {
      ctx.fillStyle = tg.c; ctx.globalAlpha = 1 - crisp;
      ctx.fillRect(CX + tg.x - 6, CY - 30 + tg.y - 6, 12, 12);
    }
    ctx.globalAlpha = 1;
    glow(ctx, mx, my, mh * 1.2, P.sky, 0.25 * (1 - hand) * (1 - prog(lt, logoT, logoT + 3)) + 0.08 * (1 - hand));
    drawMark(ctx, mx, my, mh, crisp);
    // light sweep across the mark (masked by its own alpha)
    const sw = prog(lt, logoT + 0.3, logoT + 1.3);
    if (sw > 0 && sw < 1 && hand === 0) sweep(ctx, mx, my, mh, sw);
    // wordmark
    if (lt >= word - 0.1) {
      const p = E.outExpo(prog(lt, word, word + 1.2));
      const out = hand;
      ctx.save();
      font(ctx, 'SG', lerp(92, 14, out), lerp(300, 700, p));
      ctx.letterSpacing = `${lerp(lerp(70, 18, p), 3, out)}px`;
      ctx.textAlign = out > 0.5 ? 'left' : 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(P.text, prog(lt, word, word + 0.3));
      const txt = scramble('SCORPION BITS', prog(lt, word, word + 0.9), Math.floor(lt * 30));
      const x = out > 0.5 ? lerp(CX - 300, 112, out) : CX, y = lerp(CY + 210, 67, out);
      ctx.fillText(txt, x, y);
      ctx.restore();
    }
  }
}

const sweepC = CORE.mk(800, 800), swx = sweepC.getContext('2d');
function sweep(ctx, x, y, h, p) {
  const img = IMG.mark, w = h * img.width / img.height;
  swx.clearRect(0, 0, 800, 800);
  swx.globalCompositeOperation = 'source-over'; swx.drawImage(img, 400 - w / 2, 400 - h / 2, w, h);
  swx.globalCompositeOperation = 'source-in';
  const gx = lerp(400 - w, 400 + w, p), bw = h * 0.16;
  const g = swx.createLinearGradient(gx - bw, 0, gx + bw, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  swx.fillStyle = g; swx.fillRect(0, 0, 800, 800);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(sweepC, x - 400, y - 400); ctx.restore();
}

(window.CHAPTERS = window.CHAPTERS || [])[0] = {
  init, draw,
  fx: lt => ({ bloom: lt > L('logo') - 0.2 ? 0.25 : 0.5, grain: 0.05 }),
  hud: () => null,
};
window.SWEEP = sweep;
})();

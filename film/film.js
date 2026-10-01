// Scorpion Bits — brand film · runner
// Chooses the chapter for time t, renders motion-blurred sub-frames, applies the finishing layer.
(function () {
'use strict';
const { W, H, CX, CY, P, clamp, lerp, prog, E, noise1, mk, reset, hud, chapterAt, loadImg, rgba } = CORE;
const { FPS, DUR, CH, HITS, FREEZES } = TL;

const CHAPTERS = (window.CHAPTERS = window.CHAPTERS || []);

const scene = mk(), sctx = scene.getContext('2d');
const accum = mk(), actx = accum.getContext('2d');
const tmp = mk(), tctx = tmp.getContext('2d');
const chan = mk(), chctx = chan.getContext('2d');
const small = mk(W / 4, H / 4), smctx = small.getContext('2d');
const small2 = mk(W / 4, H / 4), sm2ctx = small2.getContext('2d');

let grains = [], vignette;
function buildStatic() {
  for (let g = 0; g < 6; g++) {
    const c = mk(W / 2, H / 2), x = c.getContext('2d'), id = x.createImageData(W / 2, H / 2);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 200;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
    }
    x.putImageData(id, 0, 0); grains.push(c);
  }
  vignette = mk(); const v = vignette.getContext('2d');
  const g = v.createRadialGradient(CX, CY, H * 0.3, CX, CY, H * 1.0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  v.fillStyle = g; v.fillRect(0, 0, W, H);
}

// hit-stop: the film itself pauses (TL.FREEZES)
const warp = t => { for (const [f0, len] of FREEZES) if (t >= f0 && t < f0 + len) return f0; return t; };
const impact = t => HITS.reduce((s, [h, w]) => (t >= h && t - h < 2 ? s + w * Math.exp(-(t - h) * 6.5) : s), 0);
const flash = t => HITS.reduce((s, [h, , f]) => (f && t >= h && t - h < 1 ? s + f * Math.exp(-(t - h) * 9) : s), 0);

function renderScene(ctx, t) {
  const c = chapterAt(t);
  reset(ctx);
  const ch = CHAPTERS[c];
  if (ch) ch.draw(ctx, t - CH[c], t);
  else { ctx.fillStyle = P.ink; ctx.fillRect(0, 0, W, H); }
  reset(ctx);
  return ch;
}

function post(ctx, t, frame, ch) {
  const fx = (ch && ch.fx && ch.fx(t - CH[chapterAt(t)])) || {};
  // bloom: bright-pass on a quarter-res copy, blur, add back
  const bloom = fx.bloom ?? 0.55;
  if (bloom > 0) {
    smctx.filter = 'brightness(0.7) contrast(3.2)'; smctx.drawImage(ctx.canvas, 0, 0, W / 4, H / 4); smctx.filter = 'none';
    sm2ctx.clearRect(0, 0, W / 4, H / 4); sm2ctx.filter = 'blur(7px)'; sm2ctx.drawImage(small, 0, 0); sm2ctx.filter = 'none';
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = bloom;
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(small2, 0, 0, W, H); ctx.restore();
  }
  // RGB separation on major hits
  const amt = impact(t) * 10 + (fx.rgb || 0);
  if (amt > 0.8) {
    tctx.globalCompositeOperation = 'copy'; tctx.drawImage(ctx.canvas, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (const [col, dx] of [['#f00', -amt], ['#0f0', 0], ['#00f', amt]]) {
      chctx.globalCompositeOperation = 'copy'; chctx.drawImage(tmp, dx, 0);
      chctx.globalCompositeOperation = 'multiply'; chctx.fillStyle = col; chctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(chan, 0, 0);
    }
    ctx.restore();
  }
  // exposure flash
  const fl = clamp(flash(t) + (fx.flash || 0));
  if (fl > 0.01) { ctx.fillStyle = rgba('#ffffff', fl); ctx.fillRect(0, 0, W, H); }
  // scanlines (only where a chapter asks)
  if (fx.scan) {
    ctx.save(); ctx.globalAlpha = fx.scan; ctx.fillStyle = '#000';
    for (let y = (frame * 2) % 4; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    ctx.restore();
  }
  ctx.drawImage(vignette, 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = fx.grain ?? 0.05;
  ctx.drawImage(grains[frame % grains.length], 0, 0, W, H); ctx.restore();
  if (fx.fade) { ctx.fillStyle = rgba('#000000', fx.fade); ctx.fillRect(0, 0, W, H); }
}

// motion-blurred frame: average `sub` sub-frames across a 180° shutter
function renderFrame(ctx, t, sub = 1, frame = Math.round(t * FPS)) {
  const shutter = 0.5 / FPS;
  let ch;
  for (let s = 0; s < sub; s++) {
    const ts = Math.min(DUR - 1e-4, warp(t + (sub > 1 ? (s / sub) * shutter : 0)));
    ch = renderScene(sctx, ts);
    actx.globalAlpha = 1 / (s + 1);
    actx.drawImage(scene, 0, 0);
  }
  actx.globalAlpha = 1;
  const imp = Math.min(impact(t), 1.6);
  const shx = noise1(t * 26) * imp * 14, shy = noise1(t * 26 + 50) * imp * 14;
  reset(ctx);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const z = 1 + imp * 0.015;
  ctx.drawImage(accum, CX - CX * z + shx, CY - CY * z + shy, W * z, H * z);
  post(ctx, t, frame, ch);
  const wt = warp(t), c = chapterAt(wt);
  if (ch && ch.hud) { const o = ch.hud(wt - CH[c]); if (o) hud(ctx, wt, o); }
}

// ─── boot
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const ready = Promise.all([
  ...['300', '400', '500', '600', '700'].map(w => document.fonts.load(`${w} 40px SG`)),
  ...['200', '400', '600', '800'].map(w => document.fonts.load(`${w} 40px IN`)),
  document.fonts.load('500 40px JB'),
  loadImg('mark', 'brand/logo-mark.png'),
  loadImg('stamp', 'brand/scorpion_bits_logo_stamp.png'),
  loadImg('cube', 'brand/scorpion_bits_isometric_cube.png'),
]).then(() => { buildStatic(); CHAPTERS.forEach(c => c && c.init && c.init()); });

const RENDER = new URLSearchParams(location.search).has('render');
window.film = {
  FPS, DUR, ready,
  async frame(f, sub = 4, type = 'image/jpeg', q = 0.94) {
    await ready;
    renderFrame(ctx, f / FPS, sub, f);
    return canvas.toDataURL(type, q);
  },
};
if (RENDER) { document.body.classList.add('render'); return; }

ready.then(() => {
  const audio = new Audio('soundtrack.wav');
  const q = new URLSearchParams(location.search);
  let start = performance.now() - (Number(q.get('t')) || 0) * 1000;
  const play = document.getElementById('play');
  play.onclick = () => { play.style.display = 'none'; audio.currentTime = (performance.now() - start) / 1000 % DUR; audio.play().catch(() => {}); };
  const loop = () => {
    const t = !audio.paused ? audio.currentTime : ((performance.now() - start) / 1000) % DUR;
    renderFrame(ctx, t, 1);
    requestAnimationFrame(loop);
  };
  loop();
});
})();

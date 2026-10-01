// Renders the reel frame-by-frame in headless Chromium and pipes it into ffmpeg.
//   node render.mjs                       → ../showreel.mp4 (60 fps, 4× motion-blur sub-frames, with soundtrack)
//   node render.mjs --stills 1,4.2,9      → stills/*.png at those timestamps (for quick checks)
//   node render.mjs --sub 1 --out x.mp4   → faster draft
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const DIR = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const SUB = Number(arg('sub', 4));
const OUT = path.resolve(DIR, arg('out', '../showreel.mp4'));
const STILLS = arg('stills');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = path.join(DIR, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(DIR) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error('page error:', e); process.exit(1); });
await page.goto(`http://localhost:${port}/index.html?render`);
await page.evaluate(() => window.reel.ready);
const { FPS, DUR } = await page.evaluate(() => ({ FPS: window.reel.FPS, DUR: window.reel.DUR }));

const grab = async (f, type, sub) => {
  const url = await page.evaluate(([f, type, sub]) => window.reel.frame(f, sub, type, 0.95), [f, type, sub]);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};

if (STILLS) {
  fs.mkdirSync(path.join(DIR, 'stills'), { recursive: true });
  for (const s of STILLS.split(',').map(Number)) {
    const f = Math.round(s * FPS);
    fs.writeFileSync(path.join(DIR, 'stills', `t${s.toFixed(2).padStart(5, '0')}.png`), await grab(f, 'image/png', SUB));
  }
  console.log('stills written');
} else {
  const wav = path.join(DIR, 'soundtrack.wav');
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...(fs.existsSync(wav) ? ['-i', wav, '-c:a', 'aac', '-b:a', '256k'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-movflags', '+faststart', '-t', String(DUR), OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(FPS * DUR), t0 = Date.now();
  for (let f = 0; f < total; f++) {
    const buf = await grab(f, 'image/jpeg', SUB);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log(`\n→ ${OUT}`);
}
await browser.close();
server.close();

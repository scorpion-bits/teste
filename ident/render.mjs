// Renders the ident in headless Chromium → ffmpeg.
//   node render.mjs --stills 0.75,1.8,3.0          PNG stills in .work/ (add --sub 1 for no motion blur)
//   node render.mjs --sheet 0,10 --n 40            contact sheet of a time range → .work/sheet_0-10.jpg
//   node render.mjs                                the ident: 1080p60 → .work/master-60.mp4 (lossless RGB)
//   node render.mjs --fps 30                       the 30 fps master
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const DIR = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const FPS = Number(arg('fps', 60)), SUB = Number(arg('sub', 5)), DUR = 10;
const WORK = path.join(DIR, '.work');
fs.mkdirSync(WORK, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.wav': 'audio/wav' };
function serve() {
  return new Promise(res => {
    const s = http.createServer((req, r) => {
      const p = path.join(DIR, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(DIR) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(r);
    }).listen(0, () => res(s));
  });
}
async function open() {
  const server = await serve();
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => { console.error('page error:', e); process.exit(1); });
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://localhost:${server.address().port}/index.html?render`);
  await page.evaluate(() => window.ident.ready);
  const grab = async (f, type = 'image/png', sub = SUB) => {
    const url = await page.evaluate(([f, fps, sub, type]) => window.ident.frame(f, fps, sub, type, 0.95), [f, FPS, sub, type]);
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  };
  return { grab, close: async () => { await browser.close(); server.close(); } };
}

async function encodeRange(f0, f1, out) {
  const { grab, close } = await open();
  // lossless RGB intermediate — the delivery encode (and the one colour conversion) happens in encode.sh
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-crf', '0', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const buf = await grab(f);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 60 === 0) console.log(`[${path.basename(out)}] ${f - f0}/${f1 - f0}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await close();
}

const STILLS = arg('stills'), SHEET = arg('sheet'), CHUNK = arg('chunk');
if (STILLS) {
  const { grab, close } = await open();
  for (const s of STILLS.split(',').map(Number)) {
    const out = path.join(WORK, `t${s.toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(out, await grab(Math.round(s * FPS)));
    console.log(out);
  }
  await close();
} else if (SHEET) {
  const [a, b] = SHEET.split(',').map(Number), n = Number(arg('n', 20));
  const { grab, close } = await open();
  const dir = path.join(WORK, 'sheet'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const ts = Array.from({ length: n }, (_, i) => a + (b - a) * i / Math.max(1, n - 1));
  for (let i = 0; i < n; i++) fs.writeFileSync(path.join(dir, `${String(i).padStart(3, '0')}.jpg`), await grab(Math.round(ts[i] * FPS), 'image/jpeg', Number(arg('sub', 1))));
  await close();
  const cols = Number(arg('cols', 5)), rows = Math.ceil(n / cols);
  const out = path.join(WORK, `sheet_${a}-${b}.jpg`);
  const labels = ts.map(t => t.toFixed(2));
  fs.writeFileSync(path.join(dir, 'labels.txt'), labels.join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(dir, '%03d.jpg'), '-vf',
    `scale=480:270,drawtext=text='%{expr\\:n*${(b - a) / Math.max(1, n - 1)}+${a}}':x=6:y=6:fontsize=16:fontcolor=yellow,tile=${cols}x${rows}:padding=3`, '-frames:v', '1', out]);
  console.log(`→ ${out}`);
} else if (CHUNK) {
  const [f0, f1] = CHUNK.split(':').map(Number);
  await encodeRange(f0, f1, arg('out'));
} else {
  const N = Number(arg('workers', 4)), total = Math.round(FPS * DUR);
  const per = Math.ceil(total / N), parts = [];
  const t0 = Date.now();
  await Promise.all(Array.from({ length: N }, (_, k) => {
    const f0 = k * per, f1 = Math.min(total, (k + 1) * per), out = path.join(WORK, `part${FPS}_${k}.mp4`);
    parts.push(out);
    return new Promise((res, rej) => {
      const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--chunk', `${f0}:${f1}`, '--out', out, '--sub', String(SUB), '--fps', String(FPS)], { stdio: 'inherit' });
      p.on('close', c => (c === 0 ? res() : rej(new Error(`worker ${k} exited ${c}`))));
    });
  }));
  fs.writeFileSync(path.join(WORK, 'parts.txt'), parts.map(p => `file '${p}'`).join('\n'));
  const master = path.join(WORK, `master-${FPS}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(WORK, 'parts.txt'), '-c', 'copy', master]);
  console.log(`rendered ${total} frames in ${((Date.now() - t0) / 60000).toFixed(1)} min → ${master}`);
}

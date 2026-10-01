// Renders the film in headless Chromium → ffmpeg.
//   node render.mjs --stills 12.5,30,61            PNG stills (fast checks; add --sub 4 for motion blur)
//   node render.mjs --sheet 25,55 --n 16           contact sheet of a time range → stills/sheet_25-55.jpg
//   node render.mjs --workers 4                    full film: N parallel browsers → chunks → ../scorpionbits-film.mp4
//   node render.mjs --from 25 --to 55 --sub 2      a preview clip of a range
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
const SUB = Number(arg('sub', 4));
const TL = require(path.join(DIR, 'timeline.js'));
const { FPS, DUR } = TL;
const WORK = path.join(DIR, '.work');
fs.mkdirSync(WORK, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png', '.wav': 'audio/wav' };
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
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-gpu-vsync'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => { console.error('page error:', e); process.exit(1); });
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://localhost:${server.address().port}/index.html?render`);
  await page.evaluate(() => window.film.ready);
  const grab = async (f, type = 'image/jpeg', sub = SUB) => {
    const url = await page.evaluate(([f, type, sub]) => window.film.frame(f, sub, type, 0.94), [f, type, sub]);
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  };
  return { grab, close: async () => { await browser.close(); server.close(); } };
}

async function encodeRange(f0, f1, out, withAudio = false) {
  const { grab, close } = await open();
  const wav = path.join(DIR, 'soundtrack.wav');
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...(withAudio && fs.existsSync(wav) ? ['-ss', String(f0 / FPS), '-i', wav, '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '13', '-pix_fmt', 'yuv420p', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const buf = await grab(f);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 150 === 0) console.log(`[${path.basename(out)}] ${f - f0}/${f1 - f0}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await close();
}

const STILLS = arg('stills'), SHEET = arg('sheet'), CHUNK = arg('chunk');
if (STILLS) {
  const { grab, close } = await open();
  fs.mkdirSync(path.join(DIR, 'stills'), { recursive: true });
  for (const s of STILLS.split(',').map(Number)) {
    fs.writeFileSync(path.join(DIR, 'stills', `t${s.toFixed(2).padStart(6, '0')}.png`), await grab(Math.round(s * FPS), 'image/png'));
  }
  await close();
  console.log('stills written');
} else if (SHEET) {
  const [a, b] = SHEET.split(',').map(Number), n = Number(arg('n', 16));
  const { grab, close } = await open();
  const dir = path.join(WORK, 'sheet'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < n; i++) {
    const t = a + (b - a) * (i + 0.5) / n;
    fs.writeFileSync(path.join(dir, `${String(i).padStart(3, '0')}.jpg`), await grab(Math.round(t * FPS)));
  }
  await close();
  const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  fs.mkdirSync(path.join(DIR, 'stills'), { recursive: true });
  const out = path.join(DIR, 'stills', `sheet_${a}-${b}.jpg`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, '%03d.jpg'), '-vf', `scale=640:360,drawtext=fontfile=${path.join(DIR, 'fonts/JetBrainsMono-Medium.ttf')}:text='%{n}':x=8:y=8:fontsize=18:fontcolor=yellow,tile=${cols}x${rows}:padding=4`, '-frames:v', '1', out]);
  console.log(`→ ${out}  (t = ${Array.from({ length: n }, (_, i) => (a + (b - a) * (i + 0.5) / n).toFixed(1)).join(', ')})`);
} else if (CHUNK) {
  const [f0, f1] = CHUNK.split(':').map(Number);
  await encodeRange(f0, f1, arg('out'));
} else if (arg('from')) {
  const f0 = Math.round(Number(arg('from')) * FPS), f1 = Math.round(Number(arg('to')) * FPS);
  const out = path.resolve(DIR, arg('out', `stills/clip_${arg('from')}-${arg('to')}.mp4`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await encodeRange(f0, f1, out, true);
  console.log(`→ ${out}`);
} else {
  // full film: N worker processes, one browser each
  const N = Number(arg('workers', 4)), total = Math.round(FPS * DUR);
  const per = Math.ceil(total / N), parts = [];
  const t0 = Date.now();
  await Promise.all(Array.from({ length: N }, (_, k) => {
    const f0 = k * per, f1 = Math.min(total, (k + 1) * per), out = path.join(WORK, `part${k}.mp4`);
    parts.push(out);
    return new Promise((res, rej) => {
      const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--chunk', `${f0}:${f1}`, '--out', out, '--sub', String(SUB)], { stdio: 'inherit' });
      p.on('close', c => (c === 0 ? res() : rej(new Error(`worker ${k} exited ${c}`))));
    });
  }));
  fs.writeFileSync(path.join(WORK, 'parts.txt'), parts.map(p => `file '${p}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(WORK, 'parts.txt'), '-c', 'copy', path.join(WORK, 'master.mp4')]);
  console.log(`rendered in ${((Date.now() - t0) / 60000).toFixed(1)} min → .work/master.mp4  (run ./encode.sh for the delivery file)`);
}

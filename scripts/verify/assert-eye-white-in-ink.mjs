// ASSERT-EYE-WHITE-IN-INK: light pixels inside the letters, and ghost outlines beside them.
//
// WHAT HE SAW, 2026-09-24: "shit still has these artifacting things, these white spots."
// Controller, by eye on the 09-24 film: white specks in both "e"s and a white bar at the foot of
// the Doodles "D" (1130, 1250), ghost outlines in returnTurn (1115), a sliver in the "l" at
// emerge (640). assert-drawin-attrs counts ink pixels and a speck barely moves that total.
//
// THREE INSTRUMENTS, all printed per frame:
//   B  PAIRED, resting frames only (ink box within 2 px of the flat reference's, not draw).
//      Pixels that are solid ink in the flat reference (last breath frame, ink eroded 1 px) and
//      lighter than LIGHT_T here. Only white where ink belongs can differ.
//   A  SELF-CONTAINED, every frame. Light pixels in small holes (under COUNTER_MIN, so the
//      o/e/D/d counters are removed whole) or in gaps a 1 px closing fills, MINUS the same
//      instrument on the flat reference resized to this frame's ink box. Squeezing clean ink
//      makes letters touch, so only the excess over clean ink at the same size means anything.
//   G  HAIRLINES. Looking at 1115 at 6x showed the "white ghosts" are grey lines (lum 126 to 207)
//      tracing a second copy of a letter's edge 2 to 6 px off the stroke, paper between. G counts
//      pixels under HAIR_T at least HAIR_D px from any solid ink, minus the clean control.
//
// MUST-PASS CONTROLS AND BARS, derived every run, never typed:
//   - `--selftest`: a clean synthetic word drawn with @napi-rs/canvas reads A 0, B 0; with 29 px of
//     planted specks it reads A 29, B 29. The instrument can see.
//   - breath frames 463..572 (flat 2D ink, the controller opened 0460 and read it clean):
//     B max 0, A excess 0, G excess 0 on 09-24.
//   - pose sweep: the flat reference squeezed to 1..0.3 width, tilted -4/0/+4 deg, 1/0.9 height,
//     42 clean poses. A excess -33..104 (worst at 0.3 width), G excess 0 at every pose.
//   Bar = max(6, ceil(1.5 x worst clean excess)) among sweep poses within 0.15 of the frame's
//   width ratio. On 09-24: A 17 at full width, 24 at 0.75, 116 at 0.5 to 0.6, 156 at 0.3 to 0.4.
//   G 6 everywhere. B 6 (breath max 0, floor 6: a real speck at 1x is about 2 x 3 px).
//   The factor 1.5 and floor 6 were set before the defect frames were run and not tuned after.
//
// CORPUS, AND WHAT IS OUTSIDE IT. Dark ink on a light page. Blind to: a hole of counter size
// that should not exist; a speck under LIGHT_T; a light defect in a squeezed frame smaller than
// that squeeze's A bar (at half width A cannot see under 116 px, which is why 1100 reads clean on
// A); grey hairlines within 1 px of ink; frames under MIN_INK ink px (skipped and counted).
// G is unverified on the 3D phases: standup, orbit and tilt go red on G, and nobody has yet looked
// at whether that grey is a ghost or the solid's own shaded side. Treat those reds as unread.
//
// Usage: node scripts/verify/assert-eye-white-in-ink.mjs <filmDir> [--out=dir] [--ref=NNNN]
//        [--calibrate] [--selftest] [--frames=a-b,c]
// Exit 1 when any frame is over a bar, 0 when none is, 2 when the film cannot be read.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const INK_T = 128;        // midway between ink (21) and paper (250), measured on 0460
const LIGHT_T = 135;      // "clearly lighter than ink": above the ink/paper midpoint
const CLOSE_R = 1;        // fills a light line up to 2 px wide. r=2 and r=3 read MORE on clean ink than
                          // the defect adds (09-24: clean 160 / 279, frame 1250 192 / 352), so they drown it
const COUNTER_MIN = 40;   // hole area in px; the smallest real counter (the Desk "e") is larger
const MIN_INK = 400;      // below this there is no word to judge yet
const BAR_FACTOR = 1.5;   // bar = 1.5 x the worst clean reading in the frame's squeeze band
const BAND = 0.15;        // sweep poses within this of the frame's width ratio count as its band
const FLOOR = 6;          // no bar under 6 px: the smallest real speck at 1x is about 2 x 3 px

// ---------- film ----------
export function loadFilm(dir) {
  const framesDir = path.join(dir, 'frames');
  if (!fs.existsSync(framesDir)) throw new Error(`no frames/ in ${dir}`);
  const files = fs.readdirSync(framesDir).filter(f => /^\d{4}\.png$/.test(f)).sort();
  if (!files.length) throw new Error(`frames/ in ${dir} holds no NNNN.png`);
  const trace = JSON.parse(fs.readFileSync(path.join(dir, 'trace.json'), 'utf8'));
  const t0 = trace.trace[0][0];
  const phases = files.map((f, i) => {
    const m = trace.manifest[i];
    if (!m) throw new Error(`manifest has no entry for frame ${i}`);
    const ms = t0 + m.tSec * 1000; // checked against the 09-24 brief table: 12 of 12 boundaries match
    let ph = trace.trace[0][2];
    for (const e of trace.trace) { if (e[0] <= ms) ph = e[2]; else break; }
    return ph;
  });
  return { framesDir, files, phases };
}

export async function gray(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, L = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = (0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2]) | 0;
  return { W, H, L };
}

function bboxOf(mask, W, H) {
  let x0 = W, x1 = -1, y0 = H, y1 = -1, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) {
    n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, x1, y0, y1, n };
}

function disk(r) { const o = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) o.push([dx, dy]); return o; }
function dilate(m, W, H, off) {
  const o = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x])
    for (const [dx, dy] of off) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) o[Y * W + X] = 1; }
  return o;
}
function erode(m, W, H, off) {
  const o = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let ok = 1;
    for (const [dx, dy] of off) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H || !m[Y * W + X]) { ok = 0; break; } }
    o[y * W + x] = ok;
  }
  return o;
}
// 4-connected components; returns label array and areas
function components(m, W, H) {
  const lab = new Int32Array(W * H).fill(-1), areas = [], st = [];
  for (let i = 0; i < W * H; i++) if (m[i] && lab[i] < 0) {
    const id = areas.length; let a = 0; st.push(i); lab[i] = id;
    while (st.length) {
      const p = st.pop(); a++; const x = p % W, y = (p / W) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1])
        if (q >= 0 && m[q] && lab[q] < 0) { lab[q] = id; st.push(q); }
    }
    areas.push(a);
  }
  return { lab, areas };
}

const PAD = 10;
// Crop to the ink bbox + PAD, so morphology is cheap and the flood starts on paper.
export function cropInk(g) {
  const ink = new Uint8Array(g.W * g.H);
  for (let i = 0; i < ink.length; i++) ink[i] = g.L[i] < INK_T ? 1 : 0;
  const b = bboxOf(ink, g.W, g.H);
  if (b.n < MIN_INK) return null;
  const x0 = Math.max(0, b.x0 - PAD), y0 = Math.max(0, b.y0 - PAD);
  const x1 = Math.min(g.W - 1, b.x1 + PAD), y1 = Math.min(g.H - 1, b.y1 + PAD);
  const W = x1 - x0 + 1, H = y1 - y0 + 1, L = new Uint8Array(W * H), m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = g.L[(y + y0) * g.W + x + x0]; L[y * W + x] = v; m[y * W + x] = v < INK_T ? 1 : 0; }
  return { x0, y0, W, H, L, ink: m, bbox: b };
}

const DISK = disk(CLOSE_R), ONE = disk(1);

export function specksA(c) {
  const { W, H, L, ink } = c;
  // holes: !ink not reachable from the crop border
  const paper = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) paper[i] = ink[i] ? 0 : 1;
  const { lab, areas } = components(paper, W, H);
  const outside = new Set();
  for (let x = 0; x < W; x++) { outside.add(lab[x]); outside.add(lab[(H - 1) * W + x]); }
  for (let y = 0; y < H; y++) { outside.add(lab[y * W]); outside.add(lab[y * W + W - 1]); }
  const counter = new Uint8Array(W * H), hole = new Uint8Array(W * H);
  let counters = 0;
  const bigIds = new Set();
  areas.forEach((a, id) => { if (!outside.has(id) && a >= COUNTER_MIN) { bigIds.add(id); counters++; } });
  for (let i = 0; i < W * H; i++) { const id = lab[i]; if (id < 0 || outside.has(id)) continue; if (bigIds.has(id)) counter[i] = 1; else hole[i] = 1; }
  const closed = erode(dilate(ink, W, H, DISK), W, H, DISK);
  const sp = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (!ink[i] && !counter[i] && (hole[i] || closed[i]) && L[i] > LIGHT_T) sp[i] = 1;
  const cc = components(sp, W, H);
  let n = 0; for (const a of cc.areas) n += a;
  return { n, blobs: cc.areas.length, maxBlob: cc.areas.length ? Math.max(...cc.areas) : 0, counters, mask: sp };
}

// G: hairline ghosts. On 09-24 the returnTurn "white ghost outlines" measured as thin GREY
// lines (luminance 126 to 207) tracing a second copy of a letter's edge 2 to 6 px off the solid
// stroke, with paper between. Count pixels darker than HAIR_T that sit at least HAIR_D px
// (Chebyshev) from any solid ink pixel. Clean anti-aliasing lives within 1 px of the ink.
const HAIR_T = 200;       // under the page's darkest grid line (216 on frame 0000)
const HAIR_D = 2;
export function hairlines(c) {
  const { W, H, L, ink } = c;
  const near = dilate(ink, W, H, (() => { const o = []; for (let dy = -HAIR_D + 1; dy <= HAIR_D - 1; dy++) for (let dx = -HAIR_D + 1; dx <= HAIR_D - 1; dx++) o.push([dx, dy]); return o; })());
  const m = new Uint8Array(W * H); let n = 0;
  for (let i = 0; i < W * H; i++) if (!near[i] && L[i] < HAIR_T) { m[i] = 1; n++; }
  return { n, mask: m };
}

export function specksB(g, ref) {
  // ref: { core (Uint8Array full-frame), bbox }
  let n = 0; const W = g.W, sp = new Uint8Array(g.W * g.H);
  for (let i = 0; i < sp.length; i++) if (ref.core[i] && g.L[i] > LIGHT_T) { sp[i] = 1; n++; }
  return { n, mask: sp };
}

function samePose(b, rb) { return Math.abs(b.x0 - rb.x0) <= 2 && Math.abs(b.x1 - rb.x1) <= 2 && Math.abs(b.y0 - rb.y0) <= 2 && Math.abs(b.y1 - rb.y1) <= 2; }

// ---------- the pose-matched clean control for instrument A ----------
// The flat reference's ink box, resized to THIS frame's ink box with bilinear resampling, on
// paper, read by the same instrument. Squeezing clean ink makes letters touch and junctions
// narrow, so the clean reading climbs with squeeze (20 holes px at full width, 52 at half on
// 09-24). A reads the EXCESS over clean ink at the same size, never an absolute count.
export async function makeControl(refGray) {
  const rc = cropInk(refGray); const b = rc.bbox;
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  const raw = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * w + x] = refGray.L[(y + b.y0) * refGray.W + x + b.x0];
  const cache = new Map();
  return async (bw, bh) => {
    const k = bw + 'x' + bh; if (cache.has(k)) return cache.get(k);
    const r = await sharp(raw, { raw: { width: w, height: h, channels: 1 } }).resize(bw, bh, { fit: 'fill', kernel: 'linear' })
      .extend({ top: PAD * 2, bottom: PAD * 2, left: PAD * 2, right: PAD * 2, background: { r: 250, g: 250, b: 250 } }).raw().toBuffer({ resolveWithObject: true });
    const L = new Uint8Array(r.info.width * r.info.height); for (let i = 0; i < L.length; i++) L[i] = r.data[i * r.info.channels];
    const c = cropInk({ W: r.info.width, H: r.info.height, L });
    const v = c ? { A: specksA(c).n, G: hairlines(c).n } : { A: 0, G: 0 }; cache.set(k, v); return v;
  };
}

// The clean pose sweep: the flat reference squeezed, stretched and tilted the way the turn
// moves it, each read as A minus its own pose-matched control. Its max is the instrument's
// noise on clean ink in a moving pose, and the bar comes from it.
export async function poseSweep(refGray, control) {
  const rc = cropInk(refGray);
  const src = await sharp(Buffer.from(rc.L), { raw: { width: rc.W, height: rc.H, channels: 1 } }).png().toBuffer();
  const rows = [];
  for (const sx of [1, 0.9, 0.75, 0.6, 0.5, 0.4, 0.3]) for (const rot of [0, -4, 4]) for (const sy of [1, 0.9]) {
    const a = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
    const r = await sharp(src).affine([[sx * a, -s * sy], [sx * s, a * sy]], { background: { r: 250, g: 250, b: 250 }, interpolator: 'bilinear' })
      .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 250, g: 250, b: 250 } }).raw().toBuffer({ resolveWithObject: true });
    const L = new Uint8Array(r.info.width * r.info.height);
    for (let i = 0; i < L.length; i++) L[i] = r.data[i * r.info.channels];
    const c = cropInk({ W: r.info.width, H: r.info.height, L });
    const A = specksA(c).n, G = hairlines(c).n, ctl = await control(c.bbox.x1 - c.bbox.x0 + 1, c.bbox.y1 - c.bbox.y0 + 1);
    rows.push({ sx, rot, sy, A, ctl: ctl.A, ex: A - ctl.A, G, gctl: ctl.G, gex: G - ctl.G });
  }
  return rows;
}

export async function saveCrop(file, box, maskFull, W, out, scale = 4) {
  // crop of the frame with speck pixels outlined in red beside the raw crop
  const x0 = Math.max(0, box.x0), y0 = Math.max(0, box.y0), w = box.w, h = box.h;
  const raw = await sharp(file).removeAlpha().extract({ left: x0, top: y0, width: w, height: h }).raw().toBuffer();
  const mark = Buffer.from(raw);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (maskFull && maskFull[(y + y0) * W + x + x0]) { const k = (y * w + x) * 3; mark[k] = 255; mark[k + 1] = 0; mark[k + 2] = 0; }
  const both = Buffer.alloc(w * 2 * h * 3 + 0);
  for (let y = 0; y < h; y++) { raw.copy(both, y * w * 2 * 3, y * w * 3, (y + 1) * w * 3); mark.copy(both, y * w * 2 * 3 + w * 3, y * w * 3, (y + 1) * w * 3); }
  await sharp(both, { raw: { width: w * 2, height: h, channels: 3 } }).resize(w * 2 * scale, h * scale, { kernel: 'nearest' }).png().toFile(out);
}

export function parseFrames(s, n) {
  if (!s) return null; const set = new Set();
  for (const part of s.split(',')) { const [a, b] = part.split('-').map(Number); for (let i = a; i <= (b ?? a); i++) if (i < n) set.add(i); }
  return set;
}
export async function grayBuf(buf) { const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true }); const L = new Uint8Array(info.width * info.height); for (let i = 0; i < L.length; i++) L[i] = (0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2]) | 0; return { W: info.width, H: info.height, L }; }

async function selftest() {
  // A clean synthetic word drawn with @napi-rs/canvas: round-capped strokes of the film's
  // width and colours, with closed counters (a "D", an "o", an "e") and an "l". Then the same
  // word with three planted light specks. The positive control: A must SEE the plants.
  const { createCanvas } = require('@napi-rs/canvas');
  const cv = createCanvas(420, 160), x = cv.getContext('2d');
  x.fillStyle = 'rgb(250,250,250)'; x.fillRect(0, 0, 420, 160);
  x.strokeStyle = 'rgb(21,21,21)'; x.lineWidth = 12; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(40, 30); x.lineTo(40, 130); x.bezierCurveTo(120, 130, 120, 30, 40, 30); x.stroke();
  x.beginPath(); x.ellipse(170, 95, 30, 32, 0, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.moveTo(230, 95); x.lineTo(290, 95); x.bezierCurveTo(290, 55, 230, 55, 230, 95); x.bezierCurveTo(230, 135, 280, 135, 292, 118); x.stroke();
  x.beginPath(); x.moveTo(330, 20); x.lineTo(335, 130); x.stroke();
  const png = cv.toBuffer('image/png');
  const clean = await grayBuf(png), dirty = await grayBuf(png);
  const plant = (px, py, w, h) => { for (let yy = py; yy < py + h; yy++) for (let xx = px; xx < px + w; xx++) dirty.L[yy * dirty.W + xx] = 250; };
  plant(39, 80, 3, 3); plant(329, 70, 8, 2); plant(260, 94, 2, 2);
  const a = specksA(cropInk(clean)), b = specksA(cropInk(dirty));
  const refCore = erode(Uint8Array.from(clean.L, v => v < INK_T ? 1 : 0), clean.W, clean.H, ONE);
  let bClean = 0, bDirty = 0; for (let i = 0; i < clean.L.length; i++) if (refCore[i]) { if (clean.L[i] > LIGHT_T) bClean++; if (dirty.L[i] > LIGHT_T) bDirty++; }
  console.log(`selftest  clean synthetic word:           A = ${a.n} px in ${a.blobs} blobs (counters seen ${a.counters}), B vs itself = ${bClean}`);
  console.log(`selftest  same word + 3 planted (29 px):  A = ${b.n} px in ${b.blobs} blobs, B vs clean = ${bDirty}`);
  const ok = b.n - a.n >= 20 && bDirty >= 20 && bClean === 0;
  console.log(ok ? 'selftest  SEES the plants' : 'selftest  BLIND: the instrument did not see the plants');
  process.exit(ok ? 0 : 1);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = k => { const a = args.find(s => s.startsWith(`--${k}`)); return a ? (a.includes('=') ? a.split('=')[1] : true) : null; };
  if (flag('selftest')) return selftest();
  const dir = args.find(a => !a.startsWith('--'));
  if (!dir) { console.error('usage: assert-eye-white-in-ink.mjs <filmDir> [--out=dir] [--ref=NNNN] [--calibrate] [--frames=a-b,c]'); process.exit(2); }
  let film; try { film = loadFilm(dir); } catch (e) { console.error(`CANNOT READ FILM: ${e.message}`); process.exit(2); }
  const out = flag('out') || 'docs/verification/eye-checks-2026-09-24/white-in-ink';
  const N = film.files.length;
  const breath = film.phases.map((p, i) => p === 'breath' ? i : -1).filter(i => i >= 0);
  if (!breath.length && !flag('ref')) { console.error('no breath frames in trace; pass --ref=NNNN'); process.exit(2); }
  const refI = flag('ref') ? Number(flag('ref')) : breath[breath.length - 1];
  const rg = await gray(path.join(film.framesDir, film.files[refI]));
  const rink = new Uint8Array(rg.W * rg.H); for (let i = 0; i < rink.length; i++) rink[i] = rg.L[i] < INK_T ? 1 : 0;
  const ref = { core: erode(rink, rg.W, rg.H, ONE), bbox: bboxOf(rink, rg.W, rg.H) };
  const control = await makeControl(rg);

  // The bars are derived every run from the clean controls, never typed. See header.
  const sweep = await poseSweep(rg, control);
  const breathEx = [];
  for (const i of breath) { if (i === refI) continue; const g = await gray(path.join(film.framesDir, film.files[i])); const c = cropInk(g); if (!c) continue; const ctl = await control(c.bbox.x1 - c.bbox.x0 + 1, c.bbox.y1 - c.bbox.y0 + 1); breathEx.push({ B: specksB(g, ref).n, ex: specksA(c).n - ctl.A, gex: hairlines(c).n - ctl.G }); }
  const bMax = Math.max(0, ...breathEx.map(r => r.B));
  const BAR_B = Math.max(BAR_FACTOR * bMax, FLOOR);
  const refW = ref.bbox.x1 - ref.bbox.x0 + 1;
  const band = (sq, key) => {
    let rs = sweep.filter(r => Math.abs(r.sx - sq) <= BAND);
    if (!rs.length) rs = sweep; // squeeze outside the sweep: the whole sweep's noise
    const m = Math.max(0, ...rs.map(r => r[key]), ...breathEx.map(r => r[key]));
    return Math.max(Math.ceil(BAR_FACTOR * m), FLOOR);
  };
  if (flag('calibrate')) {
    console.log(`CALIBRATE ref ${refI}. breath frames ${breathEx.length}: B max ${bMax}, A-excess max ${Math.max(...breathEx.map(r => r.ex))}, G-excess max ${Math.max(...breathEx.map(r => r.gex))}`);
    console.log(`pose sweep, ${sweep.length} clean poses (flat ref squeezed/tilted), each minus its own size-matched control:`);
    for (const r of sweep) console.log(`  sx ${String(r.sx).padEnd(4)} rot ${String(r.rot).padStart(2)} sy ${String(r.sy).padEnd(3)}  A ${String(r.A).padStart(3)} ctl ${String(r.ctl).padStart(3)} ex ${String(r.ex).padStart(4)}  |  G ${String(r.G).padStart(3)} ctl ${String(r.gctl).padStart(3)} ex ${String(r.gex).padStart(4)}`);
    for (const sq of [1, 0.9, 0.75, 0.6, 0.5, 0.4, 0.3]) console.log(`  bar at squeeze ${sq}: A excess > ${band(sq, 'ex')}, G excess > ${band(sq, 'gex')}`);
    console.log(`  B bar ${BAR_B}`);
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const only = parseFrames(flag('frames'), N);
  const rows = []; let skipped = 0;
  for (let i = 0; i < N; i++) {
    if (only && !only.has(i)) continue;
    const g = await gray(path.join(film.framesDir, film.files[i]));
    const c = cropInk(g);
    if (!c) { skipped++; continue; }
    const bw = c.bbox.x1 - c.bbox.x0 + 1, bh = c.bbox.y1 - c.bbox.y0 + 1, sq = bw / refW;
    const a = specksA(c), h = hairlines(c), ctl = await control(bw, bh);
    const b = film.phases[i] !== 'draw' && samePose(c.bbox, ref.bbox) && i !== refI ? specksB(g, ref).n : null; // draw: the word is unfinished, so missing ink is not a speck
    const barA = band(sq, 'ex'), barG = band(sq, 'gex');
    const ex = a.n - ctl.A, gex = h.n - ctl.G;
    const redA = ex > barA, redG = gex > barG, redB = b !== null && b > BAR_B;
    rows.push({ i, phase: film.phases[i], sq, A: a.n, ctl: ctl.A, ex, barA, G: h.n, gctl: ctl.G, gex, barG, B: b, red: redA || redB || redG, redA, redB, redG, crop: { x0: c.x0, y0: c.y0, w: c.W, h: c.H } });
  }
  const fmt = r => `${String(r.i).padStart(4, '0')} ${r.phase.padEnd(11)} width ${r.sq.toFixed(2)} | A ${String(r.A).padStart(4)} clean ${String(r.ctl).padStart(3)} ex ${String(r.ex).padStart(4)}/${r.barA} | G ${String(r.G).padStart(4)} clean ${String(r.gctl).padStart(3)} ex ${String(r.gex).padStart(4)}/${r.barG} | B ${r.B === null ? ' n/a' : String(r.B).padStart(4) + '/' + BAR_B}${r.red ? '  RED' + (r.redA ? ' A' : '') + (r.redG ? ' G' : '') + (r.redB ? ' B' : '') : ''}`;
  const hdr = `white-in-ink ${dir}\nflat reference ${refI}. judged ${rows.length} of ${N} frames, skipped ${skipped} with under ${MIN_INK} ink px.\ncolumns: width = ink width / flat width. A = light px inside ink (holes + 1 px closing), minus the same instrument on clean flat ink at this size, over its bar. G = grey hairline px >= ${HAIR_D} px off solid ink, same. B = px solid in the flat reference and light here (resting pose only), bar ${BAR_B}.\n`;
  fs.writeFileSync(path.join(out, 'per-frame.txt'), hdr + rows.map(fmt).join('\n') + '\n');
  console.log(hdr.trim());
  const score = r => Math.max(r.ex / r.barA, r.gex / r.barG, (r.B ?? 0) / BAR_B);
  for (const ph of [...new Set(rows.map(r => r.phase))]) {
    const pr = rows.filter(r => r.phase === ph);
    const w = pr.reduce((m, r) => score(r) > score(m) ? r : m, pr[0]);
    const f = path.join(film.framesDir, film.files[w.i]);
    const g = await gray(f); const c = cropInk(g);
    const which = [[w.ex / w.barA, 'A'], [w.gex / w.barG, 'G'], [(w.B ?? -1) / BAR_B, 'B']].sort((x, y) => y[0] - x[0])[0][1];
    let mask = new Uint8Array(g.W * g.H);
    if (which === 'B') mask = specksB(g, ref).mask;
    else { const m = which === 'A' ? specksA(c).mask : hairlines(c).mask; for (let k = 0; k < m.length; k++) if (m[k]) mask[(((k / c.W) | 0) + c.y0) * g.W + (k % c.W) + c.x0] = 1; }
    const cf = path.join(out, `worst-${ph}-${String(w.i).padStart(4, '0')}-${which}.png`);
    await saveCrop(f, w.crop, mask, g.W, cf, 2);
    console.log(`${ph.padEnd(11)} ${String(pr.filter(r => r.red).length).padStart(3)} of ${String(pr.length).padStart(3)} red. worst ${fmt(w)}\n            crop (raw left, ${which} pixels red on the right): ${cf}`);
  }
  if (only) for (const r of rows) console.log('frame ' + fmt(r));
  const red = rows.filter(r => r.red).length;
  console.log(`${red} of ${rows.length} judged frames over a bar`);
  process.exit(red ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(2); });

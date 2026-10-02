// STATUS 2026-09-24 late: SELFTEST NOT YET RELIABLE. Pen-track TURN passes every control on the old film's
// times (sw 14) and FAILS on the new film's (sw 15: zigzag 82 deg under a 91 deg bar). The reading depends on
// where a corner falls between frame samples (about 3 px apart). No film reading has been taken. See F118.
//
// ASSERT-EYE-S-SHAPE: is each "s" drawn along a smooth s, and does the "." sit apart from the last one?
//
// WHAT WAS SAID, 2026-09-24: *"There's a weird fucking way the S is made, and it is fucking
// god-awful at the end."* The controller saw the "es." ending as a squashed zigzag fused with the
// period.
//
// FINDING THE s's AND THE ".". Both come from the draw: `assert-eye-draw-reads-written` reads the
// pen-downs, and every draw pixel gets the frame it was first ink (its birth).
//   final s  every pen-down from the last one that starts right of all the ink before it and is not
//            dot-sized, to the end of the draw.
//   Desk s   the pen-down just before the first STEM (a pen-down under 2.5 stroke widths wide and over
//            0.6 of the word's height: the k's stem). Dot-sized pen-downs are skipped.
//   "."      the ink component, in the last draw frame where one exists, that holds final-s ink,
//            touches no older ink and is dot-sized (area at most DOT_AREA x stroke width squared, box
//            at most DOT_BOX stroke widths). When no draw frame has one, the film has no "." and GAP
//            prints NOT MEASURED: that is not a pass.
// Resting frames (breath, hold) take each ink pixel's label from the nearest labelled draw-end pixel
// within 2 px.
//
// TWO NUMBERS:
//   TURN  per s, from the DRAW: the pen's track, the centroid of each frame's new ink in each of the
//         s's pen-downs, resampled every 0.5 px and smoothed at sigma 0.5 px. TURN is the sharpest turn
//         of that track in degrees, chord to chord over 0.1 stroke width of track each side (under one
//         frame of pen travel: the angle between two frames' steps). Window and smoothing were chosen
//         on the synthetic controls only, from 0.1 to 0.7 stroke widths and sigma 0.35 to 1 px: wider
//         windows read the tight bowls of a small smooth s as sharp as the zigzag.
//         A smooth s turns on its bowl's radius; a zigzag turns its whole corner at one point. A step
//         of more than one stroke width between two frames (a pop) splits the track: nothing is read
//         across it, and the number of splits is printed.
//   GAP   per resting frame, the paper between the final s and the ".", nearest pixels, in stroke
//         widths. Touching reads 0.
//
// TRIED AND DROPPED, 2026-09-24: TURN as the sharpest concave turn of the s's OUTLINE at rest. At the
// film's size (s 51 px tall, stroke 14 px) a smooth s's counters close to slits and their tips turn
// 144 degrees, more than the zigzag's inner corner (97). The first selftest run showed it; the pen
// track replaced it before any film frame was read.
//
// MUST-PASS AND BARS, set every run before any film frame is judged, at the film's own stroke width,
// pen speed, playhead times and each s's own height, drawn with @napi-rs/canvas (round cap and join):
//   - clean poses: a smooth s (two arcs) at slant -10, 0, +10 degrees and scale 1 and 0.85, with a
//     separate dot at 0.5, 0.8 and 1.2 stroke widths. 18 poses.
//     TURN bar = 1.5 x the worst clean turn. GAP bar = the smallest clean gap / 1.5.
//   - held out, must read clean against bars they did not set: the smooth s 1.3x wider at slant 5
//     with the dot at 0.4 stroke widths; the smooth s at scale 1.15 with the dot at 2 stroke widths.
//   - must-FAIL: a zigzag s (four points, two sharp corners) with a separate dot, red on TURN only;
//     the smooth s with the dot touching it, red on GAP only.
//   `--selftest` prints them all at both s heights and exits 1 on any wrong reading.
//
// BLIND TO: an s whose path is smooth but whose shape is wrong (a backwards s, an s squashed flat,
// the wrong number of bowls); a corner made where two pen-downs meet (each track is read on its own);
// anything that bends the s after the draw (the 3D turn): TURN reads the draw only; a reveal that
// does not follow the pen (the track is where new ink appears, which is the pen only if ink lands
// where the pen is); a "." that grows after it fuses (its label is fixed at its last separate frame);
// any letter but the two s's.
//
// Usage: node scripts/verify/assert-eye-s-shape.mjs <filmDir> [--out=dir] [--selftest]
// Exit 1 when anything is over a bar; 3 when nothing is but a half was NOT MEASURED (no "."); 0 when
// everything was measured and nothing is over a bar; 2 when the film cannot be read.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { gray } from './assert-eye-white-in-ink.mjs';
import { readDraw, analyse } from './assert-eye-draw-reads-written.mjs';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const INK_T = 128, PAPER = 250, INK = 21;
const DOT_AREA = 6, DOT_BOX = 3;   // x stroke width (squared for area): the largest a "." may be
const BAR_FACTOR = 1.5;
const SIGMA = 0.5;                 // px, track smoothing
const TRACK_ARC = 0.1;             // x stroke width of track each side of the point the turn is read at
const SPLIT = 1;                   // x stroke width: a track step longer than this is a pop, split there
const MIN_PX = 4;                  // new ink in one frame smaller than this gives no track point
const OUT = 'docs/verification/eye-checks-2026-09-24/s-shape';

// ---------- geometry ----------
const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
function comps(m, W, H) {
  const lab = new Int32Array(W * H).fill(-1), out = [], st = [];
  for (let i = 0; i < W * H; i++) if (m[i] && lab[i] < 0) {
    const px = []; st.push(i); lab[i] = out.length;
    while (st.length) { const p = st.pop(); px.push(p); const x = p % W, y = (p / W) | 0; for (const [dx, dy] of N8) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const q = Y * W + X; if (m[q] && lab[q] < 0) { lab[q] = lab[i]; st.push(q); } } }
    out.push(px);
  }
  return out;
}
// birth[i] = the index in `frames` where pixel i first reads ink
function births(frames, W, H) {
  const b = new Int32Array(W * H).fill(-1);
  frames.forEach((fr, k) => { for (let i = 0; i < W * H; i++) if (b[i] < 0 && fr.L[i] < INK_T) b[i] = k; });
  return b;
}
// one pen-down's track: the centroid of the ink it added in each of its frames
function penTrack(pen, birth, W) {
  const by = new Map();
  for (const q of pen.px) { const f = birth[q]; if (f < 0) continue; let e = by.get(f); if (!e) by.set(f, e = [0, 0, 0]); e[0] += q % W; e[1] += (q / W) | 0; e[2]++; }
  return [...by.entries()].filter(([, e]) => e[2] >= MIN_PX).sort((a, b) => a[0] - b[0]).map(([f, e]) => [e[0] / e[2], e[1] / e[2], f]);
}
function resampleOpen(pts, step = 0.5) {
  const out = [[pts[0][0], pts[0][1], pts[0][2]]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = step - acc;
    while (t <= d) { const u = t / d; out.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1]), u < 0.5 ? a[2] : b[2]]); t += step; }
    acc = d - (t - step);
  }
  return out;
}
function smoothOpen(S, step = 0.5) {
  const r = Math.ceil(3 * SIGMA / step), w = []; for (let k = -r; k <= r; k++) w.push(Math.exp(-((k * step) ** 2) / (2 * SIGMA * SIGMA)));
  return S.map((p, i) => { let x = 0, y = 0, ws = 0; for (let k = -r; k <= r; k++) { const j = i + k; if (j < 0 || j >= S.length) continue; x += S[j][0] * w[k + r]; y += S[j][1] * w[k + r]; ws += w[k + r]; } return [x / ws, y / ws, p[2]]; });
}
// the sharpest turn of a set of tracks. Returns { turn, where, frame, splits, points }
export function trackTurn(tracks, sw) {
  let turn = 0, where = null, frame = -1, splits = 0, points = 0;
  const step = 0.5, k = Math.max(1, Math.round(TRACK_ARC * sw / step));
  for (const tr of tracks) {
    points += tr.length;
    // split at pops
    const pieces = []; let cur = [];
    for (const p of tr) { if (cur.length && Math.hypot(p[0] - cur.at(-1)[0], p[1] - cur.at(-1)[1]) > SPLIT * sw) { pieces.push(cur); cur = []; splits++; } cur.push(p); }
    if (cur.length) pieces.push(cur);
    for (const pc of pieces) {
      if (pc.length < 2) continue;
      const S = smoothOpen(resampleOpen(pc, step), step);
      for (let i = k; i < S.length - k; i++) {
        const p0 = S[i - k], p = S[i], p1 = S[i + k];
        const a1 = Math.atan2(p[1] - p0[1], p[0] - p0[0]), a2 = Math.atan2(p1[1] - p[1], p1[0] - p[0]);
        let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        const deg = Math.abs(d) * 180 / Math.PI;
        if (deg > turn) { turn = deg; where = [p[0], p[1]]; frame = p[2]; }
      }
    }
  }
  return { turn, where, frame, splits, points };
}

// GAP on one resting mask: sMask (the s), dotMask (the "."). Returns gap in stroke widths and the nearest pair.
export function measureGap(sMask, dotMask, W, H, sw) {
  const sp = [], dp = [];
  for (let i = 0; i < W * H; i++) { if (sMask[i]) sp.push(i); if (dotMask[i]) dp.push(i); }
  if (!sp.length || !dp.length) return { gap: NaN, gapPx: NaN, pair: null };
  let bx0 = W, bx1 = 0, by0 = H, by1 = 0; for (const q of dp) { const x = q % W, y = (q / W) | 0; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  let best = Infinity, pair = null; const R = 4 * sw;
  for (const p of sp) { const x = p % W, y = (p / W) | 0; if (x < bx0 - R || x > bx1 + R || y < by0 - R || y > by1 + R) continue; for (const q of dp) { const d = Math.hypot(x - q % W, y - ((q / W) | 0)); if (d < best) { best = d; pair = [[x, y], [q % W, (q / W) | 0]]; } } }
  if (!pair) return { gap: Infinity, gapPx: Infinity, pair: null };
  const gapPx = Math.max(0, best - 1);
  return { gap: gapPx / sw, gapPx, pair };
}

// ---------- synthetic ----------
function sCenter(R, { slant = 0, sx = 1 } = {}) {
  const p = [], sl = Math.tan(slant * Math.PI / 180);
  for (let a = -30; a >= -270; a -= 3) { const r = a * Math.PI / 180; p.push([R * Math.cos(r), -R + R * Math.sin(r)]); }
  for (let a = -87; a <= 150; a += 3) { const r = a * Math.PI / 180; p.push([R * Math.cos(r), R + R * Math.sin(r)]); }
  return p.map(([x, y]) => [x * sx - y * sl, y]);
}
function zigCenter(R) { return [[0.9 * R, -1.8 * R], [-0.9 * R, -1.0 * R], [0.9 * R, 0.9 * R], [-0.9 * R, 1.8 * R]]; }
function polyline(pts) { const seg = []; let L = 0; for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push(d); L += d; } return { pts, seg, L }; }
function upTo(pl, s) { const out = [pl.pts[0]]; let acc = 0; for (let k = 1; k < pl.pts.length; k++) { const d = pl.seg[k - 1]; if (acc + d >= s) { const u = (s - acc) / d; out.push([pl.pts[k - 1][0] + u * (pl.pts[k][0] - pl.pts[k - 1][0]), pl.pts[k - 1][1] + u * (pl.pts[k][1] - pl.pts[k - 1][1])]); return out; } acc += d; out.push(pl.pts[k]); } return out; }
function draw(x, W, H, sw, pts, ox, oy, dot) {
  x.fillStyle = `rgb(${PAPER},${PAPER},${PAPER})`; x.fillRect(0, 0, W, H);
  x.strokeStyle = `rgb(${INK},${INK},${INK})`; x.fillStyle = x.strokeStyle; x.lineWidth = sw; x.lineCap = 'round'; x.lineJoin = 'round';
  if (dot) { x.beginPath(); x.arc(ox + pts[0][0], oy + pts[0][1], sw * 0.55, 0, 7); x.fill(); }
  else if (pts.length) { x.beginPath(); x.moveTo(ox + pts[0][0], oy + pts[0][1]); if (pts.length === 1) x.lineTo(ox + pts[0][0] + 0.01, oy + pts[0][1]); for (const q of pts.slice(1)) x.lineTo(ox + q[0], oy + q[1]); x.stroke(); }
  return x.getImageData(0, 0, W, H).data;
}
function canvas(W, H) { const { createCanvas } = require('@napi-rs/canvas'); return createCanvas(W, H).getContext('2d'); }
const toMask = d => { const m = new Uint8Array(d.length / 4); for (let i = 0; i < m.length; i++) m[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) < INK_T ? 1 : 0; return m; };
const toGray = d => { const L = new Uint8Array(d.length / 4); for (let i = 0; i < L.length; i++) L[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) | 0; return L; };

function poseGeom(sw, sH, { shape = 's', slant = 0, sx = 1, scale = 1 } = {}) {
  const R = sH * scale / 4 - sw / 4, W = Math.ceil(6 * R * Math.max(1, sx) + 8 * sw), H = Math.ceil(5 * R + 6 * sw);
  const c = shape === 'zig' ? zigCenter(R) : sCenter(R, { slant, sx });
  return { R, W, H, ox: W * 0.4, oy: H / 2, c };
}
// TURN on a pose: draw the s point by point at the film's pen speed on the film's playhead times,
// read it with the draw check's own reader, and take the track of every pen-down it finds.
function synthTurn(sw, sH, times, v, p) {
  const G = poseGeom(sw, sH, p), pl = polyline(G.c), x = canvas(G.W, G.H);
  const t0 = times[0] + 0.05, tEnd = t0 + pl.L / v + 0.1;
  const fr = times.filter(t => t <= tEnd).map(t => { const d = (t - t0) * v; return { t, L: toGray(draw(x, G.W, G.H, sw, d > 0 ? upTo(pl, Math.min(pl.L, d)) : [], G.ox, G.oy)) }; });
  const a = analyse(fr, G.W, G.H, sw), b = births(fr, G.W, G.H);
  const tracks = a.pens.map(pen => penTrack(pen, b, G.W));
  return { ...trackTurn(tracks, sw), pens: a.pens.length, G, last: fr.at(-1).L, tracks };
}
// GAP on a pose: the finished s and a dot placed `gap` stroke widths of paper beyond its lowest-right
// ink on its baseline, stepped right until the measured gap reads at least that (gap 0: overlapping)
function synthGap(sw, sH, p) {
  const G = poseGeom(sw, sH, p), x = canvas(G.W, G.H), gap = p.gap ?? 0.8;
  const s = toMask(draw(x, G.W, G.H, sw, G.c, G.ox, G.oy));
  let maxX = 0, baseY = 0; for (let i = 0; i < s.length; i++) if (s[i]) baseY = Math.max(baseY, (i / G.W) | 0);
  for (let i = 0; i < s.length; i++) if (s[i] && (i / G.W | 0) > baseY - sw * 1.5) maxX = Math.max(maxX, i % G.W);
  const cy = baseY - sw * 0.55 + 1;
  for (let cx = maxX - 2 * sw; cx < maxX + 6 * sw; cx += 0.25) {
    const d = toMask(draw(x, G.W, G.H, sw, [[cx, cy]], 0, 0, true));
    const r = measureGap(s, d, G.W, G.H, sw);
    const hit = gap <= 0 ? r.gapPx === 0 && [...s].some((v, i) => v && d[i]) : r.gap >= gap;
    if (hit) return { ...r, G, s, d };
  }
  throw new Error('could not place the synthetic dot');
}

function cases() {
  const clean = [];
  for (const slant of [-10, 0, 10]) for (const scale of [1, 0.85]) for (const gap of [0.5, 0.8, 1.2]) clean.push({ name: `clean s${slant} x${scale} g${gap}`, p: { slant, scale, gap } });
  return {
    clean,
    held: [{ name: 'held wide slant5 g0.4', p: { sx: 1.3, slant: 5, gap: 0.4 } }, { name: 'held x1.15 g2', p: { scale: 1.15, gap: 2 } }],
    fail: [{ name: 'zigzag s, dot apart', p: { shape: 'zig', gap: 0.8 }, want: 'TURN' }, { name: 'smooth s, dot touching', p: { gap: 0 }, want: 'GAP' }],
  };
}
// bars at one s height, from the 18 clean poses only
function barsFrom(sw, sH, times, v, log = () => {}) {
  const C = cases(); let worst = 0, minGap = Infinity;
  for (const c of C.clean) { const t = synthTurn(sw, sH, times, v, c.p), g = synthGap(sw, sH, c.p); worst = Math.max(worst, t.turn); minGap = Math.min(minGap, g.gap); log(c.name, t, g); }
  return { turn: BAR_FACTOR * worst, gap: minGap / BAR_FACTOR, worst, minGap, C, sH };
}
const turnRed = (t, B) => t > B.turn;
const gapRed = (g, B) => Number.isFinite(g) ? g < B.gap : false;

// ---------- the film ----------
async function readFilm(dir) {
  const R = await readDraw(dir);
  const { D, a } = R, W = D.W, H = D.H, sw = D.sw;
  const draw = D.frames.filter(f => D.film.phases[f.i] === 'draw');
  // D.frames is the draw frames in order, then 10 breath frames; pen frame ids index D.frames
  const birth = births(draw, W, H);
  const dotSized = p => p.len <= 2 && p.box.x1 - p.box.x0 <= 2.5 * sw && p.box.y1 - p.box.y0 <= 2.5 * sw;
  const boxOf = px => { let x0 = W, x1 = 0, y0 = H, y1 = 0; for (const q of px) { const x = q % W, y = (q / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1 }; };
  const inDraw = p => p.f0 < draw.length;
  // final s
  let g = -1, maxX = -Infinity;
  a.pens.forEach((p, k) => { if (inDraw(p) && !dotSized(p) && p.start[0] > maxX) g = k; maxX = Math.max(maxX, p.box.x1); });
  if (g < 0) throw new Error('no pen-down starts right of the ink before it');
  const g0 = a.pens[g].f0;
  // Desk s: the pen-down before the first stem
  let wy0 = H, wy1 = 0; for (let i = 0; i < W * H; i++) if (D.restL[i] < INK_T) { const y = (i / W) | 0; wy0 = Math.min(wy0, y); wy1 = Math.max(wy1, y); }
  const wordH = wy1 - wy0 + 1;
  const stem = a.pens.findIndex(p => inDraw(p) && p.box.x1 - p.box.x0 + 1 < 2.5 * sw && p.box.y1 - p.box.y0 + 1 > 0.6 * wordH);
  let desk = -1; for (let k = stem - 1; k >= 0; k--) if (!dotSized(a.pens[k])) { desk = k; break; }
  // the ".": last draw frame with a separate, dot-sized component holding final-s ink
  let dot = null, dotFrame = -1;
  for (let k = draw.length - 1; k >= g0 && !dot; k--) {
    const ink = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) ink[i] = draw[k].L[i] < INK_T ? 1 : 0;
    for (const px of comps(ink, W, H)) {
      if (!px.some(q => birth[q] >= g0)) continue;
      if (px.some(q => birth[q] >= 0 && birth[q] < g0)) continue; // part of older ink
      const b = boxOf(px);
      if (px.length <= DOT_AREA * sw * sw && b.x1 - b.x0 + 1 <= DOT_BOX * sw && b.y1 - b.y0 + 1 <= DOT_BOX * sw) {
        const cx = (b.x0 + b.x1) / 2; if (!dot || cx > dot.cx) dot = { px, cx, box: b };
      }
    }
    if (dot) dotFrame = draw[k].i;
  }
  // label every draw-end pixel: 0 older, 1 final s, 2 the "."
  const label = new Int8Array(W * H).fill(-1);
  for (let i = 0; i < W * H; i++) if (birth[i] >= 0) label[i] = birth[i] >= g0 ? 1 : 0;
  if (dot) for (const q of dot.px) label[q] = 2;
  // the s groups, their pen-downs, heights and tracks
  const group = (ids) => {
    const pens = ids.map(k => a.pens[k]).filter(p => !dotSized(p) && !(dot && p.px.every(q => label[q] === 2)));
    const px = pens.flatMap(p => p.px), b = boxOf(px);
    return { ids: pens.map(p => p.id), pens, box: b, sH: b.y1 - b.y0 + 1, tracks: pens.map(p => penTrack(p, birth, W)) };
  };
  const finalIds = a.pens.map((p, k) => k).filter(k => k >= g && inDraw(a.pens[k]));
  const final = group(finalIds);
  const deskG = desk >= 0 ? group([desk]) : null;
  return { R, D, W, H, sw, birth, label, g, g0Frame: draw[g0].i, dot, dotFrame, final, desk: deskG, stem, draw, times: D.frames.map(f => f.t), v: R.sp.v };
}
function labelFrame(L, label, W, H) {
  // each ink pixel takes the nearest label within 2 px
  const s = new Uint8Array(W * H), d = new Uint8Array(W * H), all = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (L[i] >= INK_T) continue; all[i] = 1;
    let best = 9, lb = -1;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const l = label[Y * W + X]; if (l < 0) continue; const e = dx * dx + dy * dy; if (e < best) { best = e; lb = l; } }
    if (lb === 1) s[i] = 1; else if (lb === 2) d[i] = 1;
  }
  return { s, d, all };
}

// ---------- pictures ----------
// crop: dark = the s, blue = the ".", grey = other ink; the track in orange, the sharpest turn in a
// red box, the nearest s and "." pixels in green boxes
async function saveCrop(W, H, all, s, d, marks, file, scale = 5) {
  const rgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) { const k = i * 3; if (s[i]) { rgb[k] = 40; rgb[k + 1] = 40; rgb[k + 2] = 40; } else if (d[i]) { rgb[k] = 30; rgb[k + 1] = 90; rgb[k + 2] = 220; } else if (all[i]) { rgb[k] = rgb[k + 1] = rgb[k + 2] = 170; } else { rgb[k] = rgb[k + 1] = rgb[k + 2] = 250; } }
  const put = (X, Y, c) => { if (X >= 0 && Y >= 0 && X < W && Y < H) { const k = (Y * W + X) * 3; rgb[k] = c[0]; rgb[k + 1] = c[1]; rgb[k + 2] = c[2]; } };
  const box = (p, c) => { if (!p) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) === 2 || Math.abs(dy) === 2) put(Math.round(p[0]) + dx, Math.round(p[1]) + dy, c); };
  for (const tr of marks.tracks || []) for (const p of tr) put(Math.round(p[0]), Math.round(p[1]), [240, 140, 0]);
  box(marks.turn, [230, 20, 20]); if (marks.pair) { box(marks.pair[0], [20, 170, 60]); box(marks.pair[1], [20, 170, 60]); }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).resize(W * scale, H * scale, { kernel: 'nearest' }).png().toFile(file);
}
async function saveSynth(sw, sH, times, v, p, file) {
  const t = synthTurn(sw, sH, times, v, p), g = synthGap(sw, sH, p), { W, H } = t.G;
  const s = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) s[i] = t.last[i] < INK_T ? 1 : 0;
  const all = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) all[i] = s[i] | g.d[i];
  await saveCrop(W, H, all, s, g.d, { tracks: t.tracks, turn: t.where, pair: g.pair }, file, 4);
}

// ---------- selftest ----------
async function selftestAt(F, sH, tag) {
  console.log(`\nselftest at s height ${sH} px (${tag}), stroke width ${F.sw} px, pen speed ${F.v.toFixed(0)} px/s`);
  const fmt = (n, t, g) => `  ${n.padEnd(26)} turn ${t.turn.toFixed(0).padStart(4)} deg (pen-downs ${t.pens}, splits ${t.splits})  gap ${g.gap.toFixed(2)} sw`;
  const B = barsFrom(F.sw, sH, F.times, F.v, (n, t, g) => console.log(fmt(n, t, g) + '  (sets the bars)'));
  console.log(`  bars: TURN ${B.turn.toFixed(0)} deg (worst clean ${B.worst.toFixed(0)} x 1.5), GAP ${B.gap.toFixed(2)} sw (smallest clean ${B.minGap.toFixed(2)} / 1.5)`);
  let ok = true;
  for (const c of [...B.C.held, ...B.C.fail]) {
    const t = synthTurn(F.sw, sH, F.times, F.v, c.p), g = synthGap(F.sw, sH, c.p);
    const red = [...(turnRed(t.turn, B) ? ['TURN'] : []), ...(gapRed(g.gap, B) ? ['GAP'] : [])];
    const pass = c.want ? red.length === 1 && red[0] === c.want : red.length === 0;
    if (!pass) ok = false;
    console.log(`${fmt(c.name, t, g)}  red ${red.join(',') || 'none'}  => ${pass ? (c.want ? 'caught' : 'clean') : 'WRONG'}`);
  }
  return { ok, B };
}
async function selftest(dir) {
  const F = await readFilm(dir);
  const a = await selftestAt(F, F.final.sH, 'final s');
  const b = F.desk ? await selftestAt(F, F.desk.sH, 'Desk s') : { ok: true };
  fs.mkdirSync(OUT, { recursive: true });
  await saveSynth(F.sw, F.final.sH, F.times, F.v, { gap: 0.8 }, path.join(OUT, 'control-clean.png'));
  await saveSynth(F.sw, F.final.sH, F.times, F.v, { shape: 'zig', gap: 0.8 }, path.join(OUT, 'control-turn.png'));
  await saveSynth(F.sw, F.final.sH, F.times, F.v, { gap: 0 }, path.join(OUT, 'control-gap.png'));
  const ok = a.ok && b.ok;
  console.log(ok ? '\nselftest  clean and held-out poses read clean, zigzag red on TURN only, touching dot red on GAP only, at both heights' : '\nselftest  FAILED');
  return ok;
}

// ---------- main ----------
async function main() {
  const args = process.argv.slice(2);
  const flag = k => { const a = args.find(s => s.startsWith(`--${k}`)); return a ? (a.includes('=') ? a.split('=')[1] : true) : null; };
  const dir = args.find(a => !a.startsWith('--'));
  if (!dir) { console.error('usage: assert-eye-s-shape.mjs <filmDir> [--out=dir] [--selftest]'); process.exit(2); }
  if (flag('selftest')) { let ok; try { ok = await selftest(dir); } catch (e) { console.error(`CANNOT READ: ${e.stack}`); process.exit(2); } process.exit(ok ? 0 : 1); }
  const out = flag('out') || path.join(OUT, path.basename(dir));
  fs.mkdirSync(out, { recursive: true });
  let F; try { F = await readFilm(dir); } catch (e) { console.error(`CANNOT READ FILM: ${e.message}`); process.exit(2); }
  const { D, W, H, sw } = F;
  // the bars are set here, at each s's own height, before a resting frame is read
  const Bf = barsFrom(sw, F.final.sH, F.times, F.v);
  const Bd = F.desk ? barsFrom(sw, F.desk.sH, F.times, F.v) : null;
  const lines = [], fi = f => String(f).padStart(4, '0');
  lines.push(`s-shape ${dir}`);
  lines.push(`stroke width ${sw} px, pen speed ${F.v.toFixed(0)} px/s.`);
  let red = 0, unmeasured = [];
  const readS = (name, G, B) => {
    if (!G) { lines.push(`${name}: NOT FOUND (no pen-down before a stem)`); unmeasured.push(`${name} TURN`); return null; }
    const t = trackTurn(G.tracks, sw), r = turnRed(t.turn, B);
    if (r) red++;
    lines.push(`${name}: pen-down(s) ${G.ids.join(',')} from frame ${fi(D.frames[G.pens[0].f0].i)}, box ${G.box.x1 - G.box.x0 + 1} x ${G.sH} px, ${t.points} track points, ${t.splits} split(s) at pops.`);
    lines.push(`  bars from 18 clean poses at s height ${G.sH}: TURN ${B.turn.toFixed(0)} deg (worst clean ${B.worst.toFixed(0)}).`);
    lines.push(`  TURN ${t.turn.toFixed(0)} deg at frame ${t.frame >= 0 ? fi(D.frames[t.frame].i) : '-'} (x ${t.where ? t.where[0].toFixed(0) : '-'}, y ${t.where ? t.where[1].toFixed(0) : '-'})${r ? '  RED TURN' : '  under the bar'}`);
    for (const p of G.pens) { const tp = trackTurn([penTrack(p, F.birth, W)], sw); lines.push(`    pen ${p.id}: frames ${fi(D.frames[p.f0].i)}..${fi(D.frames[p.frames.at(-1)].i)}, turn ${tp.turn.toFixed(0)} deg, splits ${tp.splits}`); }
    return t;
  };
  const tF = readS('FINAL s', F.final, Bf);
  const tD = readS('DESK s', F.desk, Bd);
  lines.push('');
  // GAP, per resting frame
  const rest = D.film.phases.map((p, i) => p === 'breath' || p === 'hold' ? i : -1).filter(i => i >= 0);
  let worstG = null; const byPhase = {};
  if (!F.dot) {
    lines.push(`GAP: NOT MEASURED. No separate dot-sized "." at any draw frame after the final s starts (frame ${fi(F.g0Frame)} on). Nothing to measure, and that is not a pass.`);
    unmeasured.push('GAP');
  } else {
    lines.push(`GAP: the "." is the last separate dot-sized piece, at frame ${fi(F.dotFrame)} (${F.dot.px.length} px, box ${F.dot.box.x1 - F.dot.box.x0 + 1} x ${F.dot.box.y1 - F.dot.box.y0 + 1}). bar ${Bf.gap.toFixed(2)} stroke widths (smallest clean ${Bf.minGap.toFixed(2)}).`);
    lines.push('PER RESTING FRAME: frame, phase, gap px, gap in stroke widths, red');
    const cut = g => { const L = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L[y * W + x] = g.L[(y + D.roi.y0) * g.W + x + D.roi.x0]; return L; };
    let gRed = 0, noDot = 0;
    for (const i of rest) {
      const L = cut(await gray(path.join(D.film.framesDir, D.film.files[i])));
      const m = labelFrame(L, F.label, W, H), r = measureGap(m.s, m.d, W, H, sw), j = gapRed(r.gap, Bf);
      if (!Number.isFinite(r.gap)) noDot++;
      if (j) gRed++;
      const ph = D.film.phases[i]; (byPhase[ph] ||= []).push(r.gap);
      if (Number.isFinite(r.gap) && (!worstG || r.gap < worstG.r.gap)) worstG = { i, r, m };
      lines.push(`${fi(i)} ${ph.padEnd(6)} gap ${Number.isFinite(r.gapPx) ? r.gapPx.toFixed(1).padStart(5) + ' px ' + r.gap.toFixed(2) + ' sw' : 'NOT MEASURED (no s or no "." ink in this frame)'}${j ? '  RED GAP' : ''}`);
    }
    for (const [ph, gs] of Object.entries(byPhase)) { const v = gs.filter(Number.isFinite).sort((a, b) => a - b); lines.push(`${ph}: ${gs.length} frames, ${v.length} measured. gap min ${v[0]?.toFixed(2)} median ${v[v.length >> 1]?.toFixed(2)} max ${v.at(-1)?.toFixed(2)} sw (bar ${Bf.gap.toFixed(2)}).`); }
    lines.push(`GAP RED: ${gRed} of ${rest.length} resting frames${noDot ? `, ${noDot} not measured` : ''}.`);
    if (gRed) red++;
    if (noDot) unmeasured.push(`GAP in ${noDot} frames`);
  }
  lines.push('');
  lines.push(`VERDICT: ${red ? 'RED' : unmeasured.length ? 'NOTHING OVER A BAR, BUT NOT MEASURED: ' + unmeasured.join('; ') : 'nothing over a bar'}.`);
  fs.writeFileSync(path.join(out, 'per-frame.txt'), lines.join('\n') + '\n');
  console.log(lines.filter(l => !/^\d{4} /.test(l)).join('\n'));
  // crops, on the draw-end frame for TURN and on the worst resting frame for GAP
  const drawEnd = F.draw.at(-1).L;
  const endM = labelFrame(drawEnd, F.label, W, H);
  const cropAround = async (b, all, s, d, marks, file) => {
    const pad = 2 * sw, x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad), x1 = Math.min(W - 1, b.x1 + pad), y1 = Math.min(H - 1, b.y1 + pad), w = x1 - x0 + 1, h = y1 - y0 + 1;
    const sub = a => { const o = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = a[(y + y0) * W + x + x0]; return o; };
    const sh = p => p && [p[0] - x0, p[1] - y0];
    await saveCrop(w, h, sub(all), sub(s), sub(d), { tracks: (marks.tracks || []).map(tr => tr.map(sh)), turn: sh(marks.turn), pair: marks.pair && marks.pair.map(sh) }, file);
    console.log(`crop: ${file}`);
  };
  if (tF) await cropAround(F.final.box, endM.all, endM.s, endM.d, { tracks: F.final.tracks, turn: tF.where }, path.join(out, 'turn-final-s.png'));
  if (tD) {
    const s = new Uint8Array(W * H); for (const p of F.desk.pens) for (const q of p.px) s[q] = 1;
    await cropAround(F.desk.box, endM.all, s, new Uint8Array(W * H), { tracks: F.desk.tracks, turn: tD.where }, path.join(out, 'turn-desk-s.png'));
  }
  if (worstG) await cropAround(F.final.box, worstG.m.all, worstG.m.s, worstG.m.d, { pair: worstG.r.pair }, path.join(out, `worst-gap-${fi(worstG.i)}.png`));
  process.exit(red ? 1 : unmeasured.length ? 3 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(2); });

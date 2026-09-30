// ASSERT-EYE-DRAW-READS-WRITTEN: during the draw, does the pen advance along the stroke the way
// a hand writes?
//
// WHAT IT READS. Per frame, the RAW new ink: pixels that are ink now and were not ink in the frame
// before. Pen advance and speed come from the raw mask. The 1 px filter (raw ink more than 1 px from
// old ink) only decides which raw pieces count: at least MIN_BLOB px and either reaching past the
// 1 px band or at least half a stroke width of px (the crescent a round nib adds at 0.5 px a frame).
// Tiny raw pieces touching the pen's last new ink are CREEP: the pen still moving, not a stop.
// On 09-24 the old reading (advance from the filtered mask) gave 71 px/s; raw gives 297 px/s.
// Counted pieces are grouped into "places" (closer than MERGE x stroke width is one place, so a pen
// crossing an older stroke is still one place) and followed frame to frame into pen-downs: a place
// within JUMP x stroke width of a pen's last new ink continues it, otherwise it starts one.
// Time is the PLAYHEAD from trace.json, not the tape clock, so a recorder stall is not a freeze.
//
// FOUR DEFECTS, each printed per frame and per pen-down:
//   TWO     new ink in two separate places in one frame (a hand has one pen).
//   POP     more than the pop bar of stroke, in stroke widths, appearing in one frame at one place.
//   FREEZE  inside one pen-down, playhead time with no new ink over the freeze bar, and the ink then
//           carries on where it stopped (within CROSS x stroke width). Ink that resumes about a stroke
//           width away after a gap went across old ink; that is printed as "cross", not red.
//   JUMP    a new pen-down far from the last one, started with no more ink-free playhead time than the
//           freeze bar (the pen never left the paper for longer than it does inside one stroke). The one
//           exception: the straight line between them lies over existing ink (at least RETRACE of it),
//           where the pen may be going back over a stroke. That is "retrace?" and not red.
// Also reported, never judged: every pen-lift (playhead ms between the last ink of one pen-down and
// the first of the next), the travel in px and its speed, the stroke order (each pen-down's start as
// a fraction of the word's width, and whether it goes back left), and `pen-order.png`, the resting
// word with each pen-down's ink in its own colour, numbered at its first ink.
//
// MUST-PASS AND BARS, set every run before any film frame is judged, on the film's own playhead
// times and stroke width. Synthetic strokes drawn with @napi-rs/canvas point by point at even speed:
// an "e" whose loop crosses its own bar, at the film's pen speed and at 0.8 px per playhead step.
// Those two set the bars: freeze = 1.5 x their longest stop inside a pen-down (floor 2 x the median
// step); pop = 1.5 x their longest new ink in one frame (floor POP_LEN). HELD OUT, must read clean
// against bars they did not set: the e at 1.5 px per step, the e at twice the film's speed, a straight
// bar. MUST-FAIL: a planted 150 ms freeze mid-e, a whole second stroke popping in, a second stroke with
// ink on the very next frame far away, a second stroke growing while the e is drawn. Each must be
// caught as its own kind and nothing else. `--selftest` runs all nine and exits 1 on any wrong reading.
//
// BLIND TO: consecutive strokes whose next start is within JUMP x stroke width of the last end with no
// time between (they read as one pen-down, so the film reads fewer pen-downs than the schedule has);
// a pen going back over its own ink (no new ink appears); a pen slower than about 80 px/s (its gaps can
// exceed the freeze bar); the DIRECTION a stroke is drawn in (a backwards "e" reads clean); the SHAPE of
// what is written (see assert-eye-s-shape); speed that is even but wrong; ink that appears then
// vanishes; a pen lift itself, since a pen in the air leaves no pixels: a lift is only the playhead time
// between two inks, and if the ink reveal lags the pen, the schedule's lift can hide inside it.
//
// Usage: node scripts/verify/assert-eye-draw-reads-written.mjs <filmDir> [--out=dir] [--selftest]
// Exit 1 when any defect is found, 0 when none is, 2 when the film cannot be read.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { loadFilm, gray } from './assert-eye-white-in-ink.mjs';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const INK_T = 128, PAPER = 250, INK = 21;
const MIN_BLOB = 4;      // px; a piece of new ink smaller than this is edge noise
const MERGE = 1.5;       // x stroke width: pieces this close are one place (a crossing splits one advance by one stroke width)
const JUMP = 1.5;        // x stroke width: farther than this from the last new ink starts a pen-down
const POP_LEN = 2;       // x stroke width: a pen-down this long drawn in one frame is a pop
const RETRACE = 0.9;
const CROSS = 0.5;       // x stroke width: ink that resumes farther than this from where it stopped went across old ink     // share of the straight path over existing ink that makes a jump a possible retrace
const BAR_FACTOR = 1.5;

export function playheads(dir) {
  const tr = JSON.parse(fs.readFileSync(path.join(dir, 'trace.json'), 'utf8'));
  const t0 = tr.trace[0][0];
  return tr.manifest.map(m => {
    const ms = t0 + m.tSec * 1000; let p = tr.trace[0][1];
    for (const e of tr.trace) { if (e[0] <= ms) p = e[1]; else break; }
    return p;
  });
}

function comps8(m, W, H, minA) {
  const lab = new Int32Array(W * H).fill(-1), out = [], st = [];
  for (let i = 0; i < W * H; i++) if (m[i] && lab[i] < 0) {
    const px = []; st.push(i); lab[i] = out.length;
    while (st.length) {
      const p = st.pop(); px.push(p); const x = p % W, y = (p / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const q = Y * W + X; if (m[q] && lab[q] < 0) { lab[q] = lab[i]; st.push(q); }
      }
    }
    if (px.length >= minA) out.push(px);
  }
  return out;
}
function minDist(a, b, W) {
  // a, b: pixel index arrays. Subsample the larger one; these are small sets.
  let best = Infinity;
  const sa = a.length > 400 ? a.filter((_, k) => k % Math.ceil(a.length / 400) === 0) : a;
  const sb = b.length > 400 ? b.filter((_, k) => k % Math.ceil(b.length / 400) === 0) : b;
  for (const p of sa) { const px = p % W, py = (p / W) | 0; for (const q of sb) { const dx = px - q % W, dy = py - ((q / W) | 0); const d = dx * dx + dy * dy; if (d < best) best = d; } }
  return Math.sqrt(best);
}
const centroid = (px, W) => { let sx = 0, sy = 0; for (const p of px) { sx += p % W; sy += (p / W) | 0; } return [sx / px.length, sy / px.length]; };

export function strokeWidth(L, W, H) {
  const runs = [];
  for (let y = 0; y < H; y++) { let r = 0; for (let x = 0; x <= W; x++) { const on = x < W && L[y * W + x] < INK_T; if (on) r++; else if (r) { runs.push(r); r = 0; } } }
  for (let x = 0; x < W; x++) { let r = 0; for (let y = 0; y <= H; y++) { const on = y < H && L[y * W + x] < INK_T; if (on) r++; else if (r) { runs.push(r); r = 0; } } }
  runs.sort((a, b) => a - b); return runs[runs.length >> 1];
}

// The analysis. frames: array of { t, L } (L = grey Uint8Array, all W x H). bars: { freeze, pop }
// (Infinity to read without judging). Returns per-frame rows, pen-downs, and the defects list.
//
// RAW vs FILTERED. raw = ink now, not ink in the frame before. filtered = raw more than 1 px from
// any old ink. Pen ADVANCE is measured from the raw mask: a pen moving under 1 px per frame puts all
// of its new ink within 1 px of old ink, so the filtered mask reads it as a pen that stopped. The
// filtered mask only decides which raw pieces count: a raw piece of at least MIN_BLOB px counts when
// it reaches past the 1 px band somewhere, or when it is at least one stroke width of px (the thin
// crescent a slow round nib adds across its whole tip). Thin slivers along an old edge do not count.
export function analyse(frames, W, H, sw, bars = { freeze: Infinity, pop: Infinity }) {
  const rows = [], pens = []; let prev = null, lastNew = null, lastPen = null, lastInkFrame = -1, others = [];
  for (let f = 0; f < frames.length; f++) {
    const { t, L } = frames[f];
    const ink = new Uint8Array(W * H); for (let i = 0; i < ink.length; i++) ink[i] = L[i] < INK_T ? 1 : 0;
    if (!prev) { prev = ink; rows.push({ f, t, n: 0, raw: 0, places: 0, adv: 0, pens: [], flags: [] }); continue; }
    const grown = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (prev[y * W + x])
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) grown[Y * W + X] = 1; }
    const raw = new Uint8Array(W * H); let rawN = 0;
    for (let i = 0; i < raw.length; i++) if (ink[i] && !prev[i]) { raw[i] = 1; rawN++; }
    const all = comps8(raw, W, H, 1);
    const counts = pc => pc.length >= MIN_BLOB && (pc.length >= sw / 2 || pc.some(q => !grown[q]));
    const pieces = all.filter(counts), small = all.filter(pc => !counts(pc));
    // group pieces into places
    const places = [];
    for (const pc of pieces) {
      const near = places.filter(pl => minDist(pl, pc, W) <= MERGE * sw);
      if (!near.length) places.push(pc.slice());
      else { const m = near[0]; for (const q of pc) m.push(q); for (const o of near.slice(1)) { for (const q of o) m.push(q); places.splice(places.indexOf(o), 1); } }
    }
    const n = places.reduce((a, p) => a + p.length, 0);
    const row = { f, t, n, raw: rawN, places: places.length, sep: 0, adv: n / sw, pens: [], flags: [] };
    if (places.length > 1) { let s = 0; for (let a = 0; a < places.length; a++) for (let b = a + 1; b < places.length; b++) s = Math.max(s, minDist(places[a], places[b], W)); row.sep = s; row.flags.push('TWO'); }
    for (const pl of places) if (pl.length / sw >= bars.pop) { row.flags.push('POP'); row.popLen = Math.max(row.popLen || 0, pl.length / sw); }
    if (places.length) {
      // which place continues the pen that drew the last new ink? the nearest, if within JUMP
      let cont = -1, contD = Infinity;
      if (lastPen) {
        const dists = places.map(pl => minDist(pl, lastNew, W));
        const k = dists.indexOf(Math.min(...dists)); if (dists[k] <= JUMP * sw) { cont = k; contD = dists[k]; }
      }
      let follow = null, followPlace = null; const grew = [];
      places.forEach((pl, k) => {
        const c = centroid(pl, W);
        if (k === cont) {
          const gap = t - lastPen.tEnd;
          // where the ink carries on: touching where it stopped (a stop), or across old ink about a
          // stroke width away (the pen crossed an older stroke, which adds no new ink while it is on it)
          const crossed = contD > CROSS * sw;
          lastPen.gaps.push({ f, gap, crossed });
          if (gap > bars.freeze) {
            if (crossed) { lastPen.crosses.push({ f, ms: Math.round(gap * 1000) }); row.flags.push('cross'); }
            else { lastPen.freezes.push({ f, ms: Math.round(gap * 1000) }); row.flags.push('FREEZE'); }
          }
          lastPen.frames.push(f); lastPen.tEnd = t; lastPen.area += pl.length; lastPen.end = c;
          lastPen.maxFrameLen = Math.max(lastPen.maxFrameLen, pl.length / sw);
          if (pl.length / sw >= bars.pop) lastPen.pops.push({ f, len: pl.length / sw });
          for (const q of pl) lastPen.px.push(q); row.pens.push(lastPen.id);
          follow = lastPen; followPlace = pl;
          return;
        }
        // a second pen already growing in the frame before (a TWO frame) carries on as the same pen-down
        const o = others.find(q => minDist(pl, q.place, W) <= JUMP * sw);
        if (o) {
          o.pen.frames.push(f); o.pen.tEnd = t; o.pen.area += pl.length; o.pen.end = c;
          o.pen.maxFrameLen = Math.max(o.pen.maxFrameLen, pl.length / sw);
          for (const q of pl) o.pen.px.push(q); row.pens.push(o.pen.id); grew.push({ pen: o.pen, place: pl });
          return;
        }
        const pen = { id: pens.length, f0: f, t0: t, tPrev0: frames[f - 1].t, tEnd: t, frames: [f], area: pl.length, start: c, end: c, freezes: [], crosses: [], gaps: [], pops: [], box: null, px: pl.slice(), maxFrameLen: pl.length / sw };
        if (pl.length / sw >= bars.pop) pen.pops.push({ f, len: pl.length / sw });
        if (lastPen) {
          pen.liftMs = Math.round((t - lastPen.tEnd) * 1000);
          pen.emptyFrames = f - lastInkFrame - 1;
          pen.dist = Math.hypot(c[0] - lastPen.end[0], c[1] - lastPen.end[1]);
          // no more ink-free playhead time than the pen spends between two frames of one clean stroke,
          // and far away: the pen went there without lifting
          if (places.length === 1 && t - lastPen.tEnd <= bars.freeze) {
            let on = 0, tot = 0; const [x0, y0] = lastPen.end;
            for (let s = 0; s <= 1; s += 1 / Math.max(1, pen.dist)) { tot++; const X = Math.round(x0 + (c[0] - x0) * s), Y = Math.round(y0 + (c[1] - y0) * s); if (prev[Y * W + X] || ink[Y * W + X]) on++; }
            pen.overInk = on / tot;
            if (pen.overInk >= RETRACE) row.flags.push('retrace?'); else { pen.jump = true; row.flags.push('JUMP'); }
          }
        }
        pens.push(pen); row.pens.push(pen.id); grew.push({ pen, place: pl });
        if (cont < 0 && !follow) { follow = pen; followPlace = pl; }
      });
      if (!follow) { follow = grew[0].pen; followPlace = grew[0].place; }
      others = grew.filter(g => g.pen !== follow);
      lastPen = follow; lastNew = followPlace;
      lastInkFrame = f;
    } else if (lastPen && small.length) {
      // CREEP: pieces too small to count on their own, touching the pen's last new ink. A pen moving
      // well under 1 px a frame adds a few px at its tip; that is the pen still moving, not a stop.
      const near = small.filter(pc => minDist(pc, lastNew, W) <= 1.5);
      if (near.length) {
        for (const pc of near) { for (const q of pc) { lastPen.px.push(q); lastNew.push(q); } lastPen.area += pc.length; }
        lastPen.gaps.push({ f, gap: t - lastPen.tEnd, crossed: false, creep: true });
        if (t - lastPen.tEnd > bars.freeze) { lastPen.freezes.push({ f, ms: Math.round((t - lastPen.tEnd) * 1000) }); row.flags.push('FREEZE'); }
        lastPen.tEnd = t; row.creep = near.reduce((a, pc) => a + pc.length, 0); row.pens.push(lastPen.id);
      }
    }
    rows.push(row); prev = ink;
  }
  for (const p of pens) {
    p.len = p.area / sw; p.durMs = Math.round((p.tEnd - p.tPrev0) * 1000);
    let x0 = W, x1 = 0, y0 = H, y1 = 0; for (const q of p.px) { const x = q % W, y = (q / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    p.box = { x0, x1, y0, y1 };
  }
  const defects = [];
  for (const r of rows) if (r.flags && r.flags.includes('TWO')) defects.push({ kind: 'TWO', f: r.f, sep: r.sep });
  for (const p of pens) {
    for (const z of p.pops) defects.push({ kind: 'POP', f: z.f, pen: p.id, len: z.len });
    for (const z of p.freezes) defects.push({ kind: 'FREEZE', f: z.f, pen: p.id, ms: z.ms });
    if (p.jump) defects.push({ kind: 'JUMP', f: p.f0, pen: p.id, dist: p.dist });
  }
  return { rows, pens, defects };
}

// ---------- synthetic strokes ----------
function polyline(pts) { const seg = []; let L = 0; for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push(d); L += d; } return { pts, seg, L }; }
function upTo(pl, s) { const out = [pl.pts[0]]; let acc = 0; for (let k = 1; k < pl.pts.length; k++) { const d = pl.seg[k - 1]; if (acc + d >= s) { const u = (s - acc) / d; out.push([pl.pts[k - 1][0] + u * (pl.pts[k][0] - pl.pts[k - 1][0]), pl.pts[k - 1][1] + u * (pl.pts[k][1] - pl.pts[k - 1][1])]); return out; } acc += d; out.push(pl.pts[k]); } return out; }
function loopStroke(ox, oy, R) {
  // an "e": a bar left to right, then a loop over the top and round, crossing the bar, and out
  const p = []; for (let x = 0; x <= 2 * R; x += 2) p.push([ox + x, oy]);
  for (let a = 0; a <= Math.PI * 1.85; a += 0.05) p.push([ox + R + R * Math.cos(a), oy - R * Math.sin(a) * 1.0]);
  for (let k = 1; k <= 12; k++) p.push([ox + R + R * Math.cos(Math.PI * 1.85) + k * 3, oy - R * Math.sin(Math.PI * 1.85) + k * 1.5]);
  return polyline(p);
}
function lineStroke(x0, y0, x1, y1) { const p = []; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2); for (let k = 0; k <= n; k++) p.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]); return polyline(p); }

// schedule: [{ pl, s(t) -> arclength drawn }]
function renderSynth(W, H, sw, times, schedule) {
  const { createCanvas } = require('@napi-rs/canvas');
  const cv = createCanvas(W, H), x = cv.getContext('2d');
  return times.map(t => {
    x.fillStyle = `rgb(${PAPER},${PAPER},${PAPER})`; x.fillRect(0, 0, W, H);
    x.strokeStyle = `rgb(${INK},${INK},${INK})`; x.lineWidth = sw; x.lineCap = 'round'; x.lineJoin = 'round';
    for (const { pl, s } of schedule) {
      const d = s(t); if (d <= 0) continue;
      const pts = upTo(pl, Math.min(pl.L, d)); x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 1) x.lineTo(pts[0][0] + 0.01, pts[0][1]); for (const q of pts.slice(1)) x.lineTo(q[0], q[1]); x.stroke();
    }
    const d = x.getImageData(0, 0, W, H).data, L = new Uint8Array(W * H);
    for (let i = 0; i < L.length; i++) L[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) | 0;
    return { t, L };
  });
}

function synthSet(sw, v, times) {
  const W = 360, H = 160, R = Math.max(18, sw * 2.2);
  const e = loopStroke(40, 100, R);
  const tStart = times[0] + 0.05;
  const even = (t0, speed = v) => t => (t - t0) * speed;
  const cases = {};
  cases.clean = [{ pl: e, s: even(tStart) }];
  const T1 = tStart + e.L / v; // end of the e
  const bar = lineStroke(260, 40, 260, 130);
  // freeze: a 150 ms stop at the middle of the e, then it carries on from the same point
  const mid = e.L / 2, tm = tStart + mid / v;
  cases.freeze = [{ pl: e, s: t => t < tm ? (t - tStart) * v : t < tm + 0.15 ? mid : (t - tStart - 0.15) * v }];
  // pop: after a 100 ms lift, a whole second stroke appears in one frame
  cases.pop = [{ pl: e, s: even(tStart) }, { pl: bar, s: t => t >= T1 + 0.1 ? bar.L : 0 }];
  // jump: the e's last ink lands on frame tLast; the bar has ink on the very next frame, far away
  const tLast = times.find(t => t >= T1 - 1e-9);
  const tJ = times.find(t => t > tLast + 1e-9);
  const step = tJ - tLast;
  cases.jump = [{ pl: e, s: even(tStart) }, { pl: bar, s: t => tJ !== undefined && t >= tJ - 1e-9 ? (t - tJ + step) * v : 0 }];
  // two: a second stroke grows while the e is still being drawn
  cases.two = [{ pl: e, s: even(tStart) }, { pl: bar, s: even(tStart + 0.03) }];
  // the slow clean stroke: the same e at 0.8 px per playhead step, under the 1 px at which the old
  // filtered mask saw nothing. It sets the bars together with the clean one.
  const vSlow = 0.8 / medStep(times);
  cases.slow = [{ pl: e, s: even(tStart, vSlow) }];
  // held out, never used to set a bar: the e at 1.5 px per step and at twice the film's speed, and
  // a plain bar at the film's speed
  const vMid = 1.5 / medStep(times);
  cases.mid = [{ pl: e, s: even(tStart, vMid) }];
  cases.fast = [{ pl: e, s: even(tStart, 2 * v) }];
  cases.line = [{ pl: bar, s: even(tStart) }];
  const tEnd = Math.max(tStart + e.L / vSlow + 0.1, T1 + 0.6);
  return { W, H, cases, vSlow, vMid, times: times.filter(t => t <= tEnd) };
}

function medStep(times) { const d = times.slice(1).map((t, k) => t - times[k]).filter(x => x > 0).sort((a, b) => a - b); return d[d.length >> 1] || 0.01; }

// Bars, from the clean even-speed stroke only, before any film frame is judged.
//   freeze: 1.5 x the clean stroke's longest ink-free playhead gap inside its pen-down, floor 2 x
//           the median playhead step. The same bar separates a pen that is still down from a lift:
//           a far new start inside it is a JUMP.
//   pop:    1.5 x the clean stroke's longest new ink in one frame, in stroke widths, floor POP_LEN.
function barsFrom(times, sw, v) {
  const step = medStep(times);
  const S = synthSet(sw, v, times);
  let gap = 0, maxLen = 0, crossGap = 0, cleanPens = 0;
  for (const name of ['clean', 'slow']) {
    const frames = renderSynth(S.W, S.H, sw, S.times, S.cases[name]);
    const a = analyse(frames, S.W, S.H, sw); cleanPens = Math.max(cleanPens, a.pens.length);
    for (const p of a.pens) { maxLen = Math.max(maxLen, p.maxFrameLen); for (const g of p.gaps) if (g.crossed) crossGap = Math.max(crossGap, g.gap); else gap = Math.max(gap, g.gap); }
  }
  return { freeze: Math.max(BAR_FACTOR * gap, 2 * step), pop: Math.max(BAR_FACTOR * maxLen, POP_LEN), cleanGap: gap, crossGap, cleanLen: maxLen, cleanPens, step, S };
}

async function loadDraw(dir) {
  const film = loadFilm(dir), ph = playheads(dir);
  const draw = film.phases.map((p, i) => p === 'draw' ? i : -1).filter(i => i >= 0);
  const breath = film.phases.map((p, i) => p === 'breath' ? i : -1).filter(i => i >= 0);
  if (!draw.length || !breath.length) throw new Error('no draw or no breath frames in trace');
  const idx = [...draw, ...breath.slice(0, 10)];
  const rest = await gray(path.join(film.framesDir, film.files[breath[breath.length - 1]]));
  // ROI: the rest ink box + 24 px
  let x0 = rest.W, x1 = 0, y0 = rest.H, y1 = 0;
  for (let y = 0; y < rest.H; y++) for (let x = 0; x < rest.W; x++) if (rest.L[y * rest.W + x] < INK_T) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  x0 = Math.max(0, x0 - 24); y0 = Math.max(0, y0 - 24); x1 = Math.min(rest.W - 1, x1 + 24); y1 = Math.min(rest.H - 1, y1 + 24);
  const W = x1 - x0 + 1, H = y1 - y0 + 1;
  const cut = g => { const L = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L[y * W + x] = g.L[(y + y0) * g.W + x + x0]; return L; };
  const frames = [];
  for (const i of idx) frames.push({ i, t: ph[i], L: cut(await gray(path.join(film.framesDir, film.files[i]))) });
  const restL = cut(rest);
  return { film, frames, W, H, roi: { x0, y0 }, restL, sw: strokeWidth(restL, W, H), drawEnd: draw[draw.length - 1] };
}

// The film's pen speed, from the RAW new ink: total length over total playhead time of every
// pen-down with at least 3 ink frames. Also the median raw new-ink px per ink frame.
function filmSpeed(a, frames) {
  let len = 0, dur = 0; const raw = [];
  for (const p of a.pens) if (p.frames.length >= 3) { len += p.len; dur += p.tEnd - p.tPrev0; }
  for (const r of a.rows) if (r.n > 0) raw.push(r.raw);
  raw.sort((x, y) => x - y);
  return { v: len / dur, rawMed: raw[raw.length >> 1] };
}

export async function readDraw(dir) {
  const D = await loadDraw(dir);
  const pre = analyse(D.frames, D.W, D.H, D.sw);
  const sp = filmSpeed(pre, D.frames);
  const B = barsFrom(D.frames.map(f => f.t), D.sw, sp.v);
  const a = analyse(D.frames, D.W, D.H, D.sw, B);
  return { D, sp, B, a };
}

async function selftest(dir) {
  const D = await loadDraw(dir);
  const pre = analyse(D.frames, D.W, D.H, D.sw);
  const sp = filmSpeed(pre, D.frames);
  const times = D.frames.map(f => f.t);
  const B = barsFrom(times, D.sw, sp.v);
  console.log(`selftest on the film's own playhead times (${times.length} frames, median step ${(B.step * 1000).toFixed(0)} ms), stroke width ${D.sw} px`);
  console.log(`even speed = the film's pen speed from raw new ink, ${sp.v.toFixed(0)} px/s (${(sp.v * B.step).toFixed(1)} px per step; film median raw new ink ${sp.rawMed} px per ink frame)`);
  console.log(`bars from the clean and slow strokes (${B.cleanPens} pen-down each at most): freeze ${(B.freeze * 1000).toFixed(0)} ms (its longest stop inside the pen-down ${(B.cleanGap * 1000).toFixed(0)} ms x 1.5, floor 2 x step; its crossing of its own bar took ${(B.crossGap * 1000).toFixed(0)} ms and is not a stop), pop ${B.pop.toFixed(1)} stroke widths in one frame (its longest ${B.cleanLen.toFixed(1)} x 1.5, floor ${POP_LEN})`);
  let ok = true;
  const want = { clean: null, slow: null, mid: null, fast: null, line: null, freeze: 'FREEZE', pop: 'POP', jump: 'JUMP', two: 'TWO' };
  const note = { clean: 'must-pass, sets the bars', slow: `must-pass, sets the bars, ${B.S.vSlow.toFixed(0)} px/s`, mid: `held out, ${B.S.vMid.toFixed(0)} px/s`, fast: `held out, ${(2 * sp.v).toFixed(0)} px/s`, line: 'held out, a straight bar', freeze: 'planted 150 ms stop', pop: 'planted whole stroke in one frame', jump: 'planted far start, no lift', two: 'planted second pen' };
  const table = [];
  for (const name of ['clean', 'slow', 'mid', 'fast', 'line', 'freeze', 'pop', 'jump', 'two']) {
    const fr = renderSynth(B.S.W, B.S.H, D.sw, B.S.times, B.S.cases[name]);
    const a = analyse(fr, B.S.W, B.S.H, D.sw, B);
    const kinds = [...new Set(a.defects.map(d => d.kind))];
    // a planted case must be caught as its own kind and as nothing else it was not built to be
    const pass = want[name] === null ? a.defects.length === 0 : kinds.includes(want[name]) && kinds.every(k => k === want[name]);
    if (!pass) ok = false;
    if (process.env.DRW_DEBUG === name) for (const d of a.defects) for (const r of a.rows.slice(Math.max(0, d.f - 8), d.f + 3)) console.log(`    ${d.kind}@${d.f} row ${r.f} t ${r.t.toFixed(3)} raw ${r.raw} n ${r.n} places ${r.places} creep ${r.creep || 0} pens ${r.pens.join(',')} ${r.flags.join(' ')}`);
    const line = `  ${name.padEnd(7)} ${note[name].padEnd(34)} pen-downs ${a.pens.length}, defects ${a.defects.length ? a.defects.map(d => d.kind + '@' + d.f).join(' ') : 'none'}  => ${pass ? (want[name] ? 'caught' : 'clean') : 'WRONG'}`;
    console.log(line); table.push(line);
  }
  console.log(ok ? 'selftest  all five clean strokes read clean, all four planted defects caught' : 'selftest  FAILED');
  return ok;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = k => { const a = args.find(s => s.startsWith(`--${k}`)); return a ? (a.includes('=') ? a.split('=')[1] : true) : null; };
  const dir = args.find(a => !a.startsWith('--'));
  if (!dir) { console.error('usage: assert-eye-draw-reads-written.mjs <filmDir> [--out=dir] [--selftest]'); process.exit(2); }
  if (flag("selftest")) { const ok = await selftest(dir); process.exit(ok ? 0 : 1); }
  let R; try { R = await readDraw(dir); } catch (e) { console.error(`CANNOT READ FILM: ${e.message}`); process.exit(2); }
  const { D, sp, B, a } = R; const v = sp.v; // bars come from the synthetic strokes inside readDraw, before the film is judged
  const out = flag('out') || 'docs/verification/eye-checks-2026-09-24/draw-reads-written';
  fs.mkdirSync(out, { recursive: true });
  const wordX0 = (() => { let m = D.W; for (let i = 0; i < D.restL.length; i++) if (D.restL[i] < INK_T) m = Math.min(m, i % D.W); return m; })();
  const wordX1 = (() => { let m = 0; for (let i = 0; i < D.restL.length; i++) if (D.restL[i] < INK_T) m = Math.max(m, i % D.W); return m; })();
  const fx = x => ((x - wordX0) / (wordX1 - wordX0)).toFixed(2);
  const lines = [];
  lines.push(`draw-reads-written ${dir}`);
  lines.push(`draw frames ${D.frames[0].i}..${D.drawEnd} plus 10 breath frames. stroke width ${D.sw} px. film pen speed from raw new ink ${v.toFixed(0)} px/s, median raw new ink ${sp.rawMed} px per ink frame.`);
  lines.push(`bars, from synthetic even-speed strokes on these playhead times: freeze ${(B.freeze * 1000).toFixed(0)} ms (longest clean stop ${(B.cleanGap * 1000).toFixed(0)} ms x 1.5), pop ${B.pop.toFixed(1)} stroke widths in one frame (longest clean ${B.cleanLen.toFixed(1)} x 1.5).`);
  lines.push('');
  lines.push('PER FRAME: frame, playhead s, counted new-ink px (raw px), places, separation px when two, advance in stroke widths, pen-down ids, flags');
  for (const r of a.rows) lines.push(`${String(D.frames[r.f].i).padStart(4, '0')} t ${r.t.toFixed(3)} new ${String(r.n).padStart(4)} (${String(r.raw ?? 0).padStart(4)}) places ${r.places}${r.places > 1 ? ' sep ' + r.sep.toFixed(0) : ''} adv ${(r.adv ?? 0).toFixed(1).padStart(5)} pen ${(r.pens || []).join(',') || '-'}${r.flags && r.flags.length ? '  ' + r.flags.join(' ') : ''}`);
  lines.push('');
  lines.push('PEN-DOWNS in the order the film draws them: id, first frame, frames with ink, duration ms, length in stroke widths, start as x fraction of the word (0 left, 1 right), box, lift before (ms, empty frames), notes');
  let maxX = -Infinity, back = 0; const lifts = [];
  for (const p of a.pens) {
    const sx = p.start[0], goesBack = sx < maxX - 2 * D.sw; if (goesBack) back++;
    if (p.liftMs !== undefined) lifts.push(p.liftMs);
    lines.push(`pen ${String(p.id).padStart(2)} frame ${String(D.frames[p.f0].i).padStart(4, '0')} ink-frames ${String(p.frames.length).padStart(3)} dur ${String(p.durMs).padStart(4)} ms len ${p.len.toFixed(1).padStart(5)} start x ${fx(sx)} y ${(p.start[1] + D.roi.y0).toFixed(0)} box x ${fx(p.box.x0)}-${fx(p.box.x1)} | lift ${p.liftMs === undefined ? '  -' : String(p.liftMs).padStart(3) + ' ms (' + p.emptyFrames + ' empty)'}${p.liftMs !== undefined && p.liftMs > 0 ? ' travel ' + p.dist.toFixed(0) + ' px at ' + Math.round(p.dist / p.liftMs * 1000) + ' px/s' : ''}${goesBack ? ' | goes back left' : ''}${p.pops.length ? ' | POP ' + p.pops.map(z => z.len.toFixed(1) + ' sw at ' + String(D.frames[z.f].i).padStart(4, '0')).join(', ') : ''}${p.crosses.length ? ' | crosses old ink ' + p.crosses.map(z => z.ms + ' ms').join(', ') : ''}${p.jump ? ` | JUMP ${p.dist.toFixed(0)} px, ${Math.round(p.overInk * 100)} % over ink` : p.overInk !== undefined ? ` | retrace? ${Math.round(p.overInk * 100)} % over ink` : ''}${p.freezes.length ? ' | FREEZE ' + p.freezes.map(z => z.ms + ' ms at ' + String(D.frames[z.f].i).padStart(4, '0')).join(', ') : ''}`);
    maxX = Math.max(maxX, p.box.x1);
  }
  const ls = [...lifts].sort((x, y) => x - y);
  const hist = {}; for (const l of lifts) hist[l] = (hist[l] || 0) + 1;
  lines.push('');
  lines.push(`PEN LIFTS: ${lifts.length}. min ${ls[0]} ms, median ${ls[ls.length >> 1]} ms, max ${ls[ls.length - 1]} ms. by value: ${Object.entries(hist).sort((x, y) => Number(x[0]) - Number(y[0])).map(([k, n]) => `${k} ms x${n}`).join(', ')}`);
  lines.push(`STROKE ORDER: ${a.pens.length} pen-downs, ${back} start more than 2 stroke widths left of where the pen had already reached.`);
  lines.push(`DEFECTS: ${a.defects.length}. ${['TWO', 'POP', 'FREEZE', 'JUMP'].map(k => `${k} ${a.defects.filter(d => d.kind === k).length}`).join(', ')}`);
  for (const d of a.defects) lines.push(`  ${d.kind.padEnd(6)} frame ${String(D.frames[d.f].i).padStart(4, '0')}${d.sep ? ' places ' + d.sep.toFixed(0) + ' px apart' : ''}${d.len ? ' length ' + d.len.toFixed(1) + ' stroke widths in one frame' : ''}${d.ms ? ' ' + d.ms + ' ms without new ink' : ''}${d.dist ? ' ' + d.dist.toFixed(0) + ' px with no lift' : ''}`);
  fs.writeFileSync(path.join(out, 'per-frame.txt'), lines.join('\n') + '\n');
  const summaryStart = lines.findIndex(l => l.startsWith('PEN-DOWNS'));
  console.log(lines.slice(0, 3).join('\n')); console.log(lines.slice(summaryStart).join('\n'));

  // crops: for the worst few defects, the frame before and the frame, with new ink in red
  const shown = [];
  const sev = d => d.sep || d.len || d.ms || d.dist || 0; // worst first: widest apart, longest pop, longest stop, farthest jump
  for (const kind of ['TWO', 'POP', 'JUMP', 'FREEZE']) for (const d of a.defects.filter(x => x.kind === kind).sort((x, y) => sev(y) - sev(x)).slice(0, 2)) shown.push(d);
  for (const d of shown) {
    const f = d.f, cur = D.frames[f].L, prv = D.frames[Math.max(0, f - 1)].L, W = D.W, H = D.H;
    const rgb = Buffer.alloc(W * H * 3 * 2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, o1 = (y * W * 2 + x) * 3, o2 = (y * W * 2 + W + x) * 3;
      rgb[o1] = rgb[o1 + 1] = rgb[o1 + 2] = prv[i];
      const isNew = cur[i] < INK_T && prv[i] >= INK_T;
      rgb[o2] = isNew ? 230 : cur[i]; rgb[o2 + 1] = isNew ? 30 : cur[i]; rgb[o2 + 2] = isNew ? 30 : cur[i];
    }
    const cf = path.join(out, `${d.kind.toLowerCase()}-${String(D.frames[f].i).padStart(4, '0')}.png`);
    await sharp(rgb, { raw: { width: W * 2, height: H, channels: 3 } }).resize(W * 4, H * 2, { kernel: 'nearest' }).png().toFile(cf);
    console.log(`crop ${d.kind} frame ${D.frames[f].i} (frame before left, this frame right, new ink red): ${cf}`);
  }
  // the stroke order as the film draws it: the resting word, each pen-down's new ink in its own
  // colour, numbered at its first ink in draw order, scaled 2x
  {
    const { createCanvas } = require('@napi-rs/canvas');
    const W = D.W, H = D.H, S = 2, cv = createCanvas(W * S, H * S), x = cv.getContext('2d');
    const img = x.createImageData(W, H);
    const own = new Int32Array(W * H).fill(-1); for (const p of a.pens) for (const q of p.px) if (own[q] < 0) own[q] = p.id;
    const hue = id => `hsl(${(id * 137.5) % 360},75%,45%)`;
    const rgbOf = id => { const h = ((id * 137.5) % 360) / 60, c = 0.75 * (1 - Math.abs(2 * 0.45 - 1)), X = c * (1 - Math.abs(h % 2 - 1)), m = 0.45 - c / 2; const [r, g, b] = h < 1 ? [c, X, 0] : h < 2 ? [X, c, 0] : h < 3 ? [0, c, X] : h < 4 ? [0, X, c] : h < 5 ? [X, 0, c] : [c, 0, X]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; };
    for (let i = 0; i < W * H; i++) { const k = i * 4; if (own[i] >= 0) { const [r, g, b] = rgbOf(own[i]); img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; } else { const v = D.restL[i] < INK_T ? 150 : 250; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; } img.data[k + 3] = 255; }
    const tmp = createCanvas(W, H); tmp.getContext('2d').putImageData(img, 0, 0);
    x.imageSmoothingEnabled = false; x.drawImage(tmp, 0, 0, W * S, H * S);
    x.font = 'bold 22px sans-serif';
    for (const p of a.pens) { const [cx, cy] = p.start; x.fillStyle = '#000'; x.fillText(String(p.id), cx * S + 6, cy * S - 6); x.fillStyle = hue(p.id); x.beginPath(); x.arc(cx * S, cy * S, 5, 0, 7); x.fill(); }
    const of = path.join(out, 'pen-order.png'); fs.writeFileSync(of, cv.toBuffer('image/png'));
    console.log(`stroke order map (each pen-down in its own colour, numbered at its first ink): ${of}`);
  }
  process.exit(a.defects.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(2); });

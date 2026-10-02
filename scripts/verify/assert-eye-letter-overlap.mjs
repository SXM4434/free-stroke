// ASSERT-EYE-LETTER-OVERLAP: does the word turn like one thin card, or do its letters pile up?
//
// WHAT WAS SEEN, 2026-09-24: the controller saw the word crush to about half width at 1100 and
// stack into one sliver at 90 degrees, each letter seeming to turn on its own axis into its
// neighbour. A previous lane measured why (F118 step 2 note): the lit solid turns at FULL depth.
// The strokes are round tubes, so a stem stays full width while the spacing between letters
// shrinks by cos(yaw). Ink width alone cannot see that, since a clean rigid turn also narrows.
//
// THE CONTROL EVERY FRAME IS READ AGAINST. The flat resting ink (last breath frame), resized to
// THIS frame's ink box. That is what a thin card turned to this width looks like: every stem and
// every gap squeezed by the same factor. Three ratios, frame over control, printed per frame:
//   M  MASS. Ink px over the control's ink px. A thin card keeps M near 1. A thick body turning
//      keeps its stems, so it carries more ink than a card of the same width.
//   S  STEM. Mean horizontal ink run over the control's. A card's stems narrow with the turn,
//      so S stays near 1. Full-width stems at half the spacing read S near 2.
//   P  PILE-UP. Mean ink px per occupied column over the control's. When separate letters stack
//      into the same columns, each column holds more ink than the card's column does.
//   w  the ink width over the rest width, printed for reading, never judged on its own.
//
// MUST-PASS AND BARS, derived every run, before any film frame is judged:
//   - the thin card: the flat ink rendered by an area-splat renderer (not the resize the control
//     uses) at cos(yaw) 1 .. 0.03, heights 1 and 0.97, and with a 10 % perspective gradient either
//     way. 13 x 2 x 3 = 78 clean poses. Each must read clean.
//   - bar per metric = 1 + 1.5 x the worst clean excess over 1 among the height-1 poses within
//     0.15 of the frame's width, floor 0.10. The height-0.97 poses are held out: they must read
//     clean against bars they did not set. The factor and floor were written before the film ran.
//   - the must-FAIL control: the same flat ink turned as a round tube (core squeezed, then the
//     stem radius put back), the shape the step 2 lane described. It must go red by half width.
//   `--selftest` prints both and exits 1 if the card reads red or the tube reads clean.
//
// SECOND REFERENCE: the resting solid (last "solid" frame) squeezed the same way. The turn
// starts and ends on the solid, which carries 1.17x the flat ink at full width on 09-24. RED needs
// over a bar against BOTH references, so a frame that is merely the resting solid squeezed is not red.
//
// JUDGED: frames in the yaw turns (anticipation, emerge, returnTurn). Every other phase after draw
// is printed with the same numbers, marked "info", because tilt, standup, orbit and descend turn
// the word about other axes and a card squeezed in x is not their clean control.
//
// BLIND TO: overlap in a pitch or orbit turn; letters that collide at full width; a word that
// turns cleanly but in the wrong direction; frames with under 400 ink px (skipped, counted).
// At w under about 0.05 the card is nearly invisible, so any ink there reads as a large ratio,
// which is correct for a solid edge-on (a thin card vanishes) but not a measure of pile-up.
//
// Usage: node scripts/verify/assert-eye-letter-overlap.mjs <filmDir> [--out=dir] [--ref=NNNN]
//        [--calibrate] [--selftest] [--frames=a-b,c]
// Exit 1 when a judged frame is over a bar, 0 when none is, 2 when the film cannot be read.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { loadFilm, gray, cropInk, parseFrames } from './assert-eye-white-in-ink.mjs';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const INK_T = 128, PAPER = 250, INK = 21;
const BAR_FACTOR = 1.5, BAR_FLOOR = 0.10, BAND = 0.15;
const TURN_PHASES = new Set(['anticipation', 'emerge', 'returnTurn']);
const COS = [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.03];
const PAD = 12;

// ---------- the measure ----------
export function measure(L, W, H) {
  let x0 = W, x1 = -1, y0 = H, y1 = -1, area = 0;
  const col = new Int32Array(W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (L[y * W + x] < INK_T) {
    area++; col[x]++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (!area) return null;
  const runs = [];
  for (let y = y0; y <= y1; y++) { let r = 0; for (let x = x0; x <= x1 + 1; x++) { const on = x <= x1 && L[y * W + x] < INK_T; if (on) r++; else if (r) { runs.push(r); r = 0; } } }
  // MEAN run, not median: the median is a whole number of px, and at a third of the width a
  // 1 px step is 25 %, which the held-out card poses caught on the first run (S 1.25 on clean ink).
  let rs = 0; for (const r of runs) rs += r;
  let occ = 0; for (let x = x0; x <= x1; x++) if (col[x]) occ++;
  return { bw: x1 - x0 + 1, bh: y1 - y0 + 1, area, hrun: rs / runs.length, hmed: runs.sort((a, b) => a - b)[runs.length >> 1], colMass: area / occ, occ, box: { x0, x1, y0, y1 } };
}

// The rest ink crop, as grey, for the control and the synthetic turns.
function restCrop(g) {
  const c = cropInk(g); const b = c.bbox;
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, L = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) L[y * w + x] = g.L[(y + b.y0) * g.W + x + b.x0];
  return { w, h, L };
}

// Control: the rest crop resized (sharp, lanczos) to bw x bh, on paper.
export function makeControl(rest) {
  const cache = new Map();
  return async (bw, bh) => {
    const k = bw + 'x' + bh; if (cache.has(k)) return cache.get(k);
    const r = await sharp(Buffer.from(rest.L), { raw: { width: rest.w, height: rest.h, channels: 1 } })
      .resize(Math.max(1, bw), Math.max(1, bh), { fit: 'fill' })
      .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: PAPER, g: PAPER, b: PAPER } })
      .raw().toBuffer({ resolveWithObject: true });
    const L = new Uint8Array(r.info.width * r.info.height); for (let i = 0; i < L.length; i++) L[i] = r.data[i * r.info.channels];
    const m = measure(L, r.info.width, r.info.height); cache.set(k, m); return m;
  };
}

// Area-splat renderer: each source pixel's darkness spread over the output columns its squeezed
// footprint covers. This is how a GPU with multisampling paints a thin card turned to cos(yaw).
// persp: the squeeze varies linearly across the word by +-persp, a crude near/far side.
export function splatCard(src, c, sy = 1, persp = 0) {
  const { w, h, L } = src;
  const cx = w / 2;
  const scale = x => c * (1 + persp * ((x - cx) / w) * 2);
  const X = x => { // integral of scale from cx to x, so the mapping is monotone
    const a = x - cx; return cx * c + c * (a + persp * a * a / w);
  };
  const W2 = Math.ceil(X(w) - X(0)) + 2 * PAD + 2, H2 = Math.ceil(h * sy) + 2 * PAD + 2;
  const acc = new Float32Array(W2 * H2);
  const off = PAD - X(0);
  for (let y = 0; y < h; y++) {
    const ya = y * sy + PAD, yb = (y + 1) * sy + PAD;
    for (let x = 0; x < w; x++) {
      const d = Math.max(0, Math.min(1, (PAPER - L[y * w + x]) / (PAPER - INK)));
      if (!d) continue;
      const xa = X(x) + off, xb = X(x + 1) + off;
      for (let oy = Math.floor(ya); oy < yb; oy++) {
        const fy = Math.min(yb, oy + 1) - Math.max(ya, oy); if (fy <= 0) continue;
        for (let ox = Math.floor(xa); ox < xb; ox++) {
          const fx = Math.min(xb, ox + 1) - Math.max(xa, ox); if (fx <= 0) continue;
          acc[oy * W2 + ox] += d * fx * fy;
        }
      }
    }
  }
  const out = new Uint8Array(W2 * H2);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(PAPER - (PAPER - INK) * Math.min(1, acc[i]));
  return { W: W2, H: H2, L: out };
}

// Must-FAIL: the same ink turned as a round tube. Erode to the core, squeeze the core as a card,
// threshold, then dilate by the stem radius: the stems keep their full width while the spacing
// between letters shrinks by cos(yaw).
export function tubeTurn(src, c, r) {
  const { w, h, L } = src;
  const ink = Uint8Array.from(L, v => v < INK_T ? 1 : 0);
  const core = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let ok = 1;
    for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h || !ink[Y * w + X]) { ok = 0; break; }
    }
    core[y * w + x] = ok;
  }
  const coreL = Uint8Array.from(core, v => v ? INK : PAPER);
  const sq = splatCard({ w, h, L: coreL }, c);
  const m = Uint8Array.from(sq.L, v => v < 200 ? 1 : 0); // any core coverage marks the centreline
  const out = new Uint8Array(sq.W * sq.H).fill(PAPER);
  for (let y = 0; y < sq.H; y++) for (let x = 0; x < sq.W; x++) if (m[y * sq.W + x])
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < sq.W && Y < sq.H) out[Y * sq.W + X] = INK;
    }
  return { W: sq.W, H: sq.H, L: out };
}

export async function ratios(img, control, restW) {
  const m = measure(img.L, img.W, img.H); if (!m) return null;
  const c = await control(m.bw, m.bh);
  if (!c) return { w: m.bw / restW, M: Infinity, S: Infinity, P: Infinity, m, c: null };
  return { w: m.bw / restW, M: m.area / c.area, S: m.hrun / c.hrun, P: m.colMass / c.colMass, m, c };
}

async function cleanSweep(rest, control) {
  const rows = [];
  for (const c of COS) for (const sy of [1, 0.97]) for (const persp of [0, 0.1, -0.1]) {
    const r = await ratios(splatCard(rest, c, sy, persp), control, rest.w);
    if (r) rows.push({ ...r, cos: c, sy, persp });
  }
  return rows;
}

// Bars come from the height-1 poses only (39). The height-0.97 poses (39) are HELD OUT and must
// read clean against bars they did not set, so the must-pass is not true by construction.
function barsFrom(sweep) {
  const src = sweep.filter(r => r.sy === 1);
  return w => {
    let rs = src.filter(r => Math.abs(r.w - w) <= BAND); if (!rs.length) rs = src;
    const b = k => 1 + Math.max(BAR_FLOOR, BAR_FACTOR * Math.max(0, ...rs.map(r => r[k] - 1)));
    return { M: b('M'), S: b('S'), P: b('P') };
  };
}

function stemRadius(rest) {
  const m = measure(rest.L, rest.w, rest.h); return Math.max(1, Math.floor(m.hmed / 2) - 1); // median run is the stem width; the mean carries the long horizontals
}

const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : ' inf').padStart(5);

async function setup(restG) {
  const rest = restCrop(restG);
  const control = makeControl(rest);
  const sweep = await cleanSweep(rest, control);
  const bar = barsFrom(sweep);
  return { rest, control, sweep, bar };
}

async function selftest(dir, refArg) {
  const film = loadFilm(dir);
  const breath = film.phases.map((p, i) => p === 'breath' ? i : -1).filter(i => i >= 0);
  const refI = refArg ?? breath[breath.length - 1];
  const { rest, control, sweep, bar } = await setup(await gray(path.join(film.framesDir, film.files[refI])));
  let cardRed = 0;
  console.log(`selftest, flat ink from frame ${refI}, rest width ${rest.w} px`);
  console.log('MUST-PASS thin card, 78 poses (cos, height, perspective):');
  for (const r of sweep) {
    const b = bar(r.w); const red = r.M > b.M || r.S > b.S || r.P > b.P; if (red && r.sy !== 1) cardRed++;
    console.log(`  ${r.sy === 1 ? 'derive ' : 'HELDOUT'} cos ${String(r.cos).padEnd(4)} sy ${String(r.sy).padEnd(4)} persp ${String(r.persp).padStart(4)}  w ${r.w.toFixed(2)}  M ${f2(r.M)}/${b.M.toFixed(2)}  S ${f2(r.S)}/${b.S.toFixed(2)}  P ${f2(r.P)}/${b.P.toFixed(2)}${red ? '  RED' : ''}`);
  }
  const rr = stemRadius(rest); let tubeRed = 0, tubeHalf = true;
  console.log(`MUST-FAIL round tube, stem radius ${rr} px:`);
  for (const c of COS) {
    const r = await ratios(tubeTurn(rest, c, rr), control, rest.w); const b = bar(r.w);
    const red = r.M > b.M || r.S > b.S || r.P > b.P; if (red) tubeRed++; if (c <= 0.5 && !red) tubeHalf = false;
    console.log(`  cos ${String(c).padEnd(4)}  w ${r.w.toFixed(2)}  M ${f2(r.M)}/${b.M.toFixed(2)}  S ${f2(r.S)}/${b.S.toFixed(2)}  P ${f2(r.P)}/${b.P.toFixed(2)}${red ? '  RED' : ''}`);
  }
  const ok = cardRed === 0 && tubeHalf;
  console.log(`held-out thin card red in ${cardRed} of ${sweep.filter(r => r.sy !== 1).length} poses; tube red in ${tubeRed} of ${COS.length}, ${tubeHalf ? 'every' : 'NOT every'} pose at cos <= 0.5`);
  console.log(ok ? 'selftest  card clean, tube caught' : 'selftest  FAILED: the instrument cannot tell a card from a tube');
  process.exit(ok ? 0 : 1);
}

async function saveCrop(file, box, out, scale = 3) {
  await sharp(file).removeAlpha().extract({ left: box.x0, top: box.y0, width: box.w, height: box.h })
    .resize(box.w * scale, box.h * scale, { kernel: 'nearest' }).png().toFile(out);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = k => { const a = args.find(s => s.startsWith(`--${k}`)); return a ? (a.includes('=') ? a.split('=')[1] : true) : null; };
  const dir = args.find(a => !a.startsWith('--'));
  if (!dir) { console.error('usage: assert-eye-letter-overlap.mjs <filmDir> [--out=dir] [--ref=NNNN] [--calibrate] [--selftest] [--frames=a-b,c]'); process.exit(2); }
  if (flag('selftest')) return selftest(dir, flag('ref') ? Number(flag('ref')) : undefined);
  let film; try { film = loadFilm(dir); } catch (e) { console.error(`CANNOT READ FILM: ${e.message}`); process.exit(2); }
  const out = flag('out') || 'docs/verification/eye-checks-2026-09-24/letter-overlap';
  const N = film.files.length;
  const breath = film.phases.map((p, i) => p === 'breath' ? i : -1).filter(i => i >= 0);
  if (!breath.length && !flag('ref')) { console.error('no breath frames in trace; pass --ref=NNNN'); process.exit(2); }
  const refI = flag('ref') ? Number(flag('ref')) : breath[breath.length - 1];
  const { rest, control, sweep, bar } = await setup(await gray(path.join(film.framesDir, film.files[refI])));
  // Second clean reference: the resting SOLID (last solid frame), squeezed the same way. The turn
  // starts and ends on the solid, which already carries 1.17x the flat ink's mass at full width.
  // A frame is red only when it is over the bar against BOTH: neither the flat card nor the solid
  // card, squeezed to this width, looks like it.
  const solidIs = film.phases.map((p, i) => p === 'solid' ? i : -1).filter(i => i >= 0);
  const solidI = solidIs.length ? solidIs[solidIs.length - 1] : null;
  const solidRest = solidI === null ? null : restCrop(await gray(path.join(film.framesDir, film.files[solidI])));
  const solidControl = solidRest ? makeControl(solidRest) : null;
  if (flag('calibrate')) {
    for (const w of [1, 0.9, 0.75, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05]) { const b = bar(w); console.log(`bar at width ${w}: M ${b.M.toFixed(2)}  S ${b.S.toFixed(2)}  P ${b.P.toFixed(2)}`); }
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const only = parseFrames(flag('frames'), N);
  const rows = []; let skipped = 0;
  for (let i = 0; i < N; i++) {
    if (only && !only.has(i)) continue;
    if (film.phases[i] === 'draw') continue;
    const g = await gray(path.join(film.framesDir, film.files[i]));
    const c = cropInk(g); if (!c) { skipped++; continue; }
    const r = await ratios({ W: c.W, H: c.H, L: c.L }, control, rest.w);
    if (!r) { skipped++; continue; }
    const b = bar(r.w), judged = TURN_PHASES.has(film.phases[i]);
    const over = { M: r.M > b.M, S: r.S > b.S, P: r.P > b.P };
    const s = solidControl ? await ratios({ W: c.W, H: c.H, L: c.L }, solidControl, rest.w) : null;
    const overS = s ? (s.M > b.M || s.S > b.S || s.P > b.P) : true;
    rows.push({ i, phase: film.phases[i], ...r, b, judged, over, s, overS, red: judged && (over.M || over.S || over.P) && overS, crop: { x0: c.x0, y0: c.y0, w: c.W, h: c.H } });
  }
  const fmt = r => `${String(r.i).padStart(4, '0')} ${r.phase.padEnd(12)} w ${r.w.toFixed(2)} (${String(r.m.bw).padStart(3)} px) | M ${f2(r.M)}/${r.b.M.toFixed(2)} | S ${f2(r.S)}/${r.b.S.toFixed(2)} (stem ${r.m.hrun.toFixed(1)} vs card ${r.c ? r.c.hrun.toFixed(1) : '-'} px) | P ${f2(r.P)}/${r.b.P.toFixed(2)} || vs solid card M ${r.s ? f2(r.s.M) : '  -'} S ${r.s ? f2(r.s.S) : '  -'} P ${r.s ? f2(r.s.P) : '  -'}${r.s ? (r.overS ? ' over' : ' clean') : ''}${r.judged ? '' : '  info'}${r.red ? '  RED' + (r.over.M ? ' M' : '') + (r.over.S ? ' S' : '') + (r.over.P ? ' P' : '') : ''}`;
  const hdr = `letter-overlap ${dir}\nflat reference ${refI}, rest ink width ${rest.w} px. ${rows.length} frames read after draw, ${rows.filter(r => r.judged).length} judged (phases ${[...TURN_PHASES].join(', ')}), ${skipped} skipped with no word.\ncolumns: w = ink width over rest width. M = ink px, S = mean horizontal ink run (stem width), P = ink px per occupied column; each over a thin card of the flat ink resized to this frame's ink box, then over its bar (from the clean card poses near this width). "vs solid card": the same three against the resting solid (frame ${solidI}) squeezed the same way. RED needs over a bar against both.\n`;
  fs.writeFileSync(path.join(out, 'per-frame.txt'), hdr + rows.map(fmt).join('\n') + '\n');
  console.log(hdr.trim());
  const score = r => Math.max((r.M - 1) / (r.b.M - 1), (r.S - 1) / (r.b.S - 1), (r.P - 1) / (r.b.P - 1));
  for (const ph of [...new Set(rows.map(r => r.phase))]) {
    const pr = rows.filter(r => r.phase === ph).filter(r => Number.isFinite(score(r)));
    if (!pr.length) continue;
    const w = pr.reduce((m, r) => score(r) > score(m) ? r : m, pr[0]);
    const cf = path.join(out, `worst-${ph}-${String(w.i).padStart(4, '0')}.png`);
    if (TURN_PHASES.has(ph)) await saveCrop(path.join(film.framesDir, film.files[w.i]), w.crop, cf);
    console.log(`${ph.padEnd(12)} ${pr[0].judged ? String(pr.filter(r => r.red).length).padStart(3) + ' of ' + String(pr.length).padStart(3) + ' red' : 'info only    '}. worst ${fmt(w)}${TURN_PHASES.has(ph) ? '\n             crop: ' + cf : ''}`);
  }
  // the named frame and its pair beside a thin card of the same width
  for (const n of [1100, 660, 1105]) {
    const r = rows.find(x => x.i === n); if (!r) continue;
    const cardW = Math.round(r.w * rest.w);
    const card = splatCard(rest, cardW / rest.w);
    // film crop on top, the thin card of the same width under it, both at 3x
    const g = await gray(path.join(film.framesDir, film.files[n])); const c = cropInk(g);
    const cw = Math.max(c.W, card.W), both = new Uint8Array(cw * (c.H + card.H + 4)).fill(PAPER);
    for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) both[y * cw + x] = c.L[y * c.W + x];
    for (let x = 0; x < cw; x++) both[(c.H + 1) * cw + x] = 128;
    for (let y = 0; y < card.H; y++) for (let x = 0; x < card.W; x++) both[(y + c.H + 4) * cw + x] = card.L[y * card.W + x];
    const pf = path.join(out, `film-over-card-${String(n).padStart(4, '0')}.png`);
    await sharp(Buffer.from(both), { raw: { width: cw, height: c.H + card.H + 4, channels: 1 } }).resize(cw * 3, (c.H + card.H + 4) * 3, { kernel: 'nearest' }).png().toFile(pf);
    console.log(`frame ${fmt(r)}\n             film (top) over a thin card of the same width (bottom): ${pf}`);
  }
  if (only) for (const r of rows) console.log('frame ' + fmt(r));
  const red = rows.filter(r => r.red).length, judged = rows.filter(r => r.judged).length;
  console.log(`${red} of ${judged} judged frames over a bar`);
  process.exit(red ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(2); });

// ASSERT-STROKE-SCHEDULE — does `DRAW IN` exist, act, and act on EVERY engine?
//
// ── WHAT THIS GATE IS FOR ──────────────────────────────────────────────────
// `docs/animation-toolset-map.md` §8 states the bar for this feature in its own
// words, and both halves of it are rows below:
//
//   *"A gate whose negative control is `order: as drawn · overlap 0` producing a
//    BYTE-IDENTICAL render to today's, and a FILMED check that `overlap > 0`
//    actually puts two pen tips on the page at the same instant. A green row
//    that cannot fail is the lie this repo keeps paying for."*
//
// ── IT DRIVES THE DIALS. THAT IS THE POINT. ────────────────────────────────
// Explainer 24 §6: *"A sweep that never moves a dial cannot see this class, and
// it is the second time that hole has cost this project a week."* Every row here
// moves a control — most of them through the REAL PANEL, by clicking the button
// a user clicks, because *"a whole panel in this repo once rendered zero
// controls while harness assertions passed."*
//
// ── AND IT CARRIES ITS OWN KNOWN-BAD ───────────────────────────────────────
// `__captureHarness.setTipRidesSchedule(false)` is the map's red-flagged trap,
// parked as a render: the tip field keeps the RECORDING's arcs while the keys
// and the playhead have moved to the BEAT's. Row 9 requires it to FAIL, with the
// measured number printed either way.
//
// Usage: FS_PORT=3102 node scripts/verify/assert-stroke-schedule.mjs
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { LAB_URL } from "./lib/dev-server.mjs"
import { fixture, ENGINES } from "./_probe-stroke-schedule.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "gate")
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/stroke-schedule/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 18 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "stroke-schedule", `assert-${LABEL}`)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const VIEW = { width: 1600, height: 1600 }
const DEFAULTS = { order: "asDrawn", overlap: 0, align: "start", unit: "group", seed: 1 }

let pass = true
const rows = []
const say = (ok, label, detail) => {
  if (!ok) pass = false
  rows.push({ ok, label, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16)

/* ---- pixels ------------------------------------------------------------- */
async function pixels(png) {
  const img = await loadImage(png)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { w: img.width, h: img.height, d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data }
}
/* ---- 🔴 A COMPARISON OF TWO DIFFERENT RASTERS IS NOT A COMPARISON --------
 *
 * Every raster row on this gate compares two frames, and every comparison below
 * walks the FIRST buffer's length. Hand them frames of two different sizes and
 * NOTHING THROWS: the loop runs to the shorter one and reads a different pixel
 * at every index past the first row. A byte-identity row would go red for a
 * reason that has nothing to do with its subject; a set-algebra row would go
 * GREEN on garbage.
 *
 * That is not hypothetical on this gate. Measured 2026-08-07: its own grabs come
 * back at **799×1508 and 799×1468** in one run, because the 3-D viewport is a
 * flex child whose height depends on WHICH CONFIG STRIP the geometry mode is
 * showing — this file's own `stillSize` comment says exactly that, and nobody
 * had connected it to the capture. Switching engines resizes the raster.
 *
 * So the guard is not "assert the sizes match" bolted on beside the helpers; it
 * is IN them, because the defect is that they answer a question they were not
 * asked. Same shape as the repo's own ruling about a gate naming its own server:
 * the fix is not another check, it is removing the ability to get it wrong
 * silently.
 */
const rasterGuard = { comparisons: 0, mismatches: [] }
function sameShape(a, b, where) {
  rasterGuard.comparisons++
  const aw = a.w ?? a.length
  const ah = a.h ?? 1
  const bw = b.w ?? b.length
  const bh = b.h ?? 1
  if (aw !== bw || ah !== bh) {
    rasterGuard.mismatches.push(`${where}: ${aw}x${ah} vs ${bw}x${bh}`)
    return false
  }
  return true
}

/** A boolean mask of "this pixel is not what the empty page looks like". */
function inkMask(a, empty, thresh = 12) {
  sameShape(a, empty, "inkMask")
  const n = a.d.length / 4
  const m = new Uint8Array(n)
  let count = 0
  for (let i = 0; i < n; i++) {
    const p = i * 4
    const dd = Math.max(
      Math.abs(a.d[p] - empty.d[p]),
      Math.abs(a.d[p + 1] - empty.d[p + 1]),
      Math.abs(a.d[p + 2] - empty.d[p + 2]),
      Math.abs(a.d[p + 3] - empty.d[p + 3]),
    )
    if (dd > thresh) {
      m[i] = 1
      count++
    }
  }
  return { m, count, w: a.w, h: a.h }
}
function iou(A, B) {
  sameShape(A, B, "iou")
  let inter = 0
  let uni = 0
  for (let i = 0; i < A.m.length; i++) {
    const a = A.m[i]
    const b = B.m[i]
    if (a || b) uni++
    if (a && b) inter++
  }
  return uni > 0 ? inter / uni : 1
}
function differingPixels(a, b, thresh = 0) {
  sameShape(a, b, "differingPixels")
  let n = 0
  for (let i = 0; i < a.d.length; i += 4) {
    const dd = Math.max(
      Math.abs(a.d[i] - b.d[i]),
      Math.abs(a.d[i + 1] - b.d[i + 1]),
      Math.abs(a.d[i + 2] - b.d[i + 2]),
      Math.abs(a.d[i + 3] - b.d[i + 3]),
    )
    if (dd > thresh) n++
  }
  return n
}
/**
 * How many SEPARATE places on the page grew between two playheads.
 *
 * A pen is a moving boundary, so what a second pen looks like is a second,
 * disconnected patch of newly-inked pixels in the same instant. The mask is
 * dilated by `r` before labelling so a nib's own antialiased edge does not
 * fragment into a dozen components — the question is "how many places", not
 * "how many pixels". Components under `minPx` are dropped as raster noise.
 */
function growthComponents(before, after, empty, { r = 4, minPx = 220 } = {}) {
  sameShape(before, after, "growthComponents")
  sameShape(before, empty, "growthComponents/empty")
  const A = inkMask(before, empty)
  const B = inkMask(after, empty)
  const w = A.w
  const h = A.h
  const grew = new Uint8Array(w * h)
  for (let i = 0; i < grew.length; i++) grew[i] = B.m[i] && !A.m[i] ? 1 : 0
  // dilate
  const dil = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grew[y * w + x]) continue
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          dil[yy * w + xx] = 1
        }
      }
    }
  }
  // label
  const seen = new Uint8Array(w * h)
  const comps = []
  const stack = new Int32Array(w * h)
  for (let s = 0; s < w * h; s++) {
    if (!dil[s] || seen[s]) continue
    let top = 0
    stack[top++] = s
    seen[s] = 1
    let size = 0
    let sx = 0
    let sy = 0
    while (top > 0) {
      const p = stack[--top]
      size++
      const x = p % w
      const y = (p / w) | 0
      sx += x
      sy += y
      if (x > 0 && dil[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[top++] = p - 1 }
      if (x < w - 1 && dil[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[top++] = p + 1 }
      if (y > 0 && dil[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[top++] = p - w }
      if (y < h - 1 && dil[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[top++] = p + w }
    }
    comps.push({ size, cx: sx / size, cy: sy / size })
  }
  const kept = comps.filter((c) => c.size >= minPx).sort((a, b) => b.size - a.size)
  /* HOW FAR APART THE GROWING PLACES ARE, and it is the statistic that actually
   * answers the question. A component COUNT above one is not the same claim as
   * "two pens": the fused implicit surface fragments a single stroke's growth
   * wherever a later stroke crosses it — the triangles at a crossing take the
   * LATER stroke's key, so a hole opens along the drawing stroke and heals when
   * the neighbour arrives. That is the standing artifacting defect
   * (`docs/animation-toolset-map.md` §6.7), it is not caused here, and it makes
   * a bare count read two for one pen. Two PENS are two places, so the
   * separation is what gets asserted and the count is reported beside it. */
  let sep = 0
  for (let i = 0; i < kept.length; i++) {
    for (let j = i + 1; j < kept.length; j++) {
      const d = Math.hypot(kept[i].cx - kept[j].cx, kept[i].cy - kept[j].cy)
      if (d > sep) sep = d
    }
  }
  return {
    count: kept.length,
    sizes: kept.slice(0, 6).map((c) => c.size),
    sepPx: Math.round(sep),
    grewPx: grew.reduce((a, b) => a + b, 0),
    /* THE LARGEST CHANGING PLACE, so step 3 can ask how far the LEADING edge is
     * from the TRAILING one. `sepPx` above answers "how far apart are the
     * growing places"; a window's claim is about two edges of DIFFERENT SIGN,
     * which needs a centroid from each of two calls. */
    cx: kept.length ? kept[0].cx : null,
    cy: kept.length ? kept[0].cy : null,
  }
}
/** The pixels that came OFF the page between two frames. `growthComponents`
 *  with its arguments swapped — one implementation, because "grew" and "shrank"
 *  are the same question asked in two directions and two copies of a connected
 *  -component labeller is how they would come to disagree about `minPx`. */
function shrinkComponents(before, after, empty, opts) {
  return growthComponents(after, before, empty, opts)
}
/** Set difference on two ink masks: |A \ B| and |A ∩ B|. */
function maskOps(A, B) {
  sameShape(A, B, "maskOps")
  let onlyA = 0
  let onlyB = 0
  let both = 0
  let either = 0
  for (let i = 0; i < A.m.length; i++) {
    const a = A.m[i]
    const b = B.m[i]
    if (a && b) both++
    else if (a) onlyA++
    else if (b) onlyB++
    if (a || b) either++
  }
  return { onlyA, onlyB, both, either, iou: either > 0 ? both / either : 1 }
}
/** A mask of `A \ B`, so the window's claim can be compared against a real set
 *  rather than against a count. */
function maskMinus(A, B) {
  sameShape(A, B, "maskMinus")
  const m = new Uint8Array(A.m.length)
  let count = 0
  for (let i = 0; i < A.m.length; i++) {
    if (A.m[i] && !B.m[i]) {
      m[i] = 1
      count++
    }
  }
  return { m, count, w: A.w, h: A.h }
}

/* ═══ THE MODEL HALF — plain node, no browser ══════════════════════════════
 *
 * `docs/README.md`'s own split: *"a gate for [a MODEL defect] has no business
 * paying for a GPU."* These four claims are exact and a raster could only ever
 * approximate them — and one of them is the geometry-invariance claim that
 * `geometry-baseline.mjs` cannot make in this lane at all (see §5 of the
 * return: that script hard-codes `http://localhost:3000` and does not read
 * `FS_PORT`, so it cannot be aimed at a lane's own server).
 */
async function modelRows() {
  const { loadTs } = await import("./_ts-load.mjs")
  const S = loadTs("lib/stroke-schedule.ts")
  const R = loadTs("lib/pen-reveal.ts")

  // A synthetic word: four strokes of deliberately different lengths.
  const mk = (x0, y0, x1, y1, n, t0) => ({
    points: Array.from({ length: n }, (_, i) => ({
      x: x0 + ((x1 - x0) * i) / (n - 1),
      y: y0 + ((y1 - y0) * i) / (n - 1),
      t: t0 + i * 12,
    })),
  })
  const strokes = [mk(0, 0, 300, 0, 30, 0), mk(0, 50, 40, 50, 8, 500), mk(0, 100, 150, 100, 20, 900), mk(0, 150, 90, 150, 12, 1400)]
  const spans = R.strokeArcSpans(strokes)

  const idSched = S.scheduleFromStrokes(strokes, null, S.DRAW_IN_DEFAULTS)
  say(
    idSched.identity === true && Math.abs(idSched.scale - 1) < 1e-12,
    "MODEL · the default schedule is the identity, computed not declared",
    `identity=${idSched.identity} scale=${idSched.scale}`,
  )

  // filterStrokesBySchedule at the identity MUST equal filterStrokesByProgress.
  let worst = 0
  for (let i = 1; i < 20; i++) {
    const p = i / 20
    const a = R.filterStrokesByProgress(strokes, p)
    const b = S.filterStrokesBySchedule(strokes, idSched, p)
    const fa = JSON.stringify(a.map((s) => s.points.map((q) => [q.x.toFixed(9), q.y.toFixed(9)])))
    const fb = JSON.stringify(b.map((s) => s.points.map((q) => [q.x.toFixed(9), q.y.toFixed(9)])))
    if (fa !== fb) worst++
  }
  say(
    worst === 0,
    "MODEL · at the identity the new rebuild clip is the OLD one, point for point",
    `${20 - 1 - worst}/${20 - 1} playheads agree to 9 decimals`,
  )

  // Every non-identity schedule keeps the arc map monotone INSIDE each track.
  const params = [
    { ...S.DRAW_IN_DEFAULTS, order: "reversed" },
    { ...S.DRAW_IN_DEFAULTS, order: "byLength" },
    { ...S.DRAW_IN_DEFAULTS, overlap: 1, align: "end" },
    { ...S.DRAW_IN_DEFAULTS, order: "random", seed: 3, overlap: 0.4 },
  ]
  let monoBad = 0
  let slopeBad = 0
  for (const p of params) {
    const sc = S.scheduleFromStrokes(strokes, null, p)
    if (!sc.uniformSlope) slopeBad++
    for (const t of sc.tracks) {
      /* SAMPLED ON THE HALF-OPEN INTERVAL `(from, to]`, and that is the model's
       * own convention rather than a convenience: `strokeArcSpans` puts `to` at
       * the arc where the pen LEAVES a stroke, and the next stroke's `from` is
       * the same number — *"the FAR end of a primitive, not its near end: a
       * piece of the mark is fully drawn only once the pen has left it"*
       * (`lib/pen-reveal.ts` §M). So the shared value belongs to the EARLIER
       * track, `scheduleArc` resolves it that way, and a test that sampled the
       * closed interval would read that correct answer as a jump. */
      let prev = -Infinity
      for (let k = 1; k <= 20; k++) {
        const a = t.from + ((t.to - t.from) * k) / 20
        const v = S.scheduleArc(sc, a)
        if (v < prev - 1e-9) monoBad++
        prev = v
      }
    }
  }
  say(
    monoBad === 0 && slopeBad === 0,
    "MODEL · S(a) is monotone inside every track, at one slope — no un-drawing is representable",
    `${monoBad} monotonicity breaks, ${slopeBad} non-uniform slopes over ${params.length} schedules`,
  )
  say(
    S.scheduleArc(S.scheduleFromStrokes(strokes, null, params[0]), 2) === 2,
    "MODEL · the tip field's 'nothing reached here' sentinel (2) passes through untouched",
    "a remapped sentinel would ink the paper",
  )

  /* THE GEOMETRY-INVARIANCE CLAIM, exact. A schedule may REORDER triangles; it
   * may never change the SET of them. Explainer 18 proved the original sort
   * "index-order-only, byte for byte" and every measurement this repo takes on
   * the Inflate surface depends on that still being true. */
  const tri = 5000
  const idx = new Uint32Array(tri * 3)
  for (let i = 0; i < idx.length; i++) idx[i] = (i * 7919) % 4000
  const keys = new Float32Array(tri)
  // SEEDED, not `Math.random()`. A gate whose input changes between runs cannot
  // be re-run against a failure, and this repo has already paid for that once.
  let rs = 12345
  for (let t = 0; t < tri; t++) {
    rs = (rs * 1103515245 + 12345) & 0x7fffffff
    keys[t] = rs / 0x7fffffff
  }
  const sorted = S.sortTrianglesByKey(keys)
  const permSeen = new Uint8Array(tri)
  for (const v of sorted.order) permSeen[v] = 1
  const isPerm = permSeen.every((v) => v === 1) && sorted.order.length === tri
  let asc = true
  for (let t = 1; t < tri; t++) if (sorted.keys[t] < sorted.keys[t - 1]) asc = false
  const permuted = S.permuteTriangles(idx, null, sorted.order)
  const back = S.permuteTriangles(permuted, sorted.order, null)
  let identical = back.length === idx.length
  for (let i = 0; i < idx.length && identical; i++) if (back[i] !== idx[i]) identical = false
  // …and the multiset of TRIANGLES is preserved, not just recoverable.
  const key3 = (a, i) => `${a[i * 3]},${a[i * 3 + 1]},${a[i * 3 + 2]}`
  const setA = new Map()
  const setB = new Map()
  for (let t = 0; t < tri; t++) {
    setA.set(key3(idx, t), (setA.get(key3(idx, t)) ?? 0) + 1)
    setB.set(key3(permuted, t), (setB.get(key3(permuted, t)) ?? 0) + 1)
  }
  let sameSet = setA.size === setB.size
  for (const [k, v] of setA) if (setB.get(k) !== v) sameSet = false
  say(
    isPerm && asc && identical && sameSet,
    "MODEL · the re-sort is INDEX-ORDER-ONLY — same triangles, ascending keys, exactly reversible",
    `permutation=${isPerm} ascending=${asc} round-trip=${identical} same-triangle-multiset=${sameSet} over ${tri} triangles`,
  )
  /* AND IT CAN FAIL. A permutation with a duplicate is the defect this row
   * exists to catch — it would silently drop a triangle and duplicate another,
   * which no raster of a 148k-triangle surface would show. */
  const brokenPerm = sorted.order.slice()
  brokenPerm[10] = brokenPerm[11]
  const brokenOut = S.permuteTriangles(idx, null, brokenPerm)
  let brokenSame = true
  const setC = new Map()
  for (let t = 0; t < tri; t++) setC.set(key3(brokenOut, t), (setC.get(key3(brokenOut, t)) ?? 0) + 1)
  for (const [k, v] of setA) if (setC.get(k) !== v) brokenSame = false
  say(
    brokenSame === false,
    "MODEL · …and the KNOWN-BAD permutation is REJECTED — a duplicated slot changes the set",
    "one index duplicated in a 5000-triangle permutation",
  )

  /* ═══ STEP 3 · THE WINDOW ══════════════════════════════════════════════════
   *
   * `docs/animation-toolset-map.md` §8's second slice. Five claims, all exact,
   * all in plain node for the reason the block above gives: a raster could only
   * approximate an interval and these are statements about arithmetic.
   */
  const WMODES = ["grow", "travel", "vanish", "shrink"]
  const PH = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1]
  // 1 · `grow` IS the prefix, at every playhead, and it is the only mode that is.
  let growBad = 0
  for (const d of PH) {
    const w = S.windowAt({ mode: "grow", length: 0.25 }, d)
    if (!(w.lo === 0 && Math.abs(w.hi - d) < 1e-12 && w.identity && w.openBack)) growBad++
  }
  const modeSigs = new Map()
  for (const m of WMODES) {
    modeSigs.set(
      m,
      PH.map((d) => {
        const w = S.windowAt({ mode: m, length: 0.25 }, d)
        return `${w.lo.toFixed(6)}:${w.hi.toFixed(6)}`
      }).join("|"),
    )
  }
  say(
    growBad === 0 && new Set(modeSigs.values()).size === WMODES.length,
    "MODEL · WINDOW — `grow` is the PREFIX exactly, and the four modes are four different intervals",
    `${PH.length}/${PH.length} playheads have lo=0 hi=d under grow · ${new Set(modeSigs.values()).size}/${WMODES.length} distinct interval tracks`,
  )

  // 2 · A travelling window holds its LENGTH through the middle and closes at
  //     both ends — which is what makes it a segment rather than a second grow.
  /* ⚠ THE SAMPLE PLAYHEADS ARE DERIVED FROM `L`, NOT PICKED — and the first
   * draft of this row picked them and FAILED honestly, which is the useful
   * kind. A travelling window is only at its full width once it has fully
   * ENTERED the mark and before it starts leaving: the head is `d(1+L)`, so the
   * tail clears zero at `d = L/(1+L)` and the head reaches one at
   * `d = 1/(1+L)`. At `L = 0.6` those are 0.375 and 0.625, and a hard-coded
   * 0.3 lands in the entry ramp where the width is CORRECTLY short. Testing a
   * derived window at a hard-coded playhead is the same class of error as a
   * gate whose window was sized for an old beat. */
  let travelBad = 0
  const travelRows = []
  for (const L of [0.1, 0.25, 0.6]) {
    const p = { mode: "travel", length: L }
    const ends = [S.windowAt(p, 0), S.windowAt(p, 1)]
    if (!(ends[0].empty && ends[1].empty)) travelBad++
    const dLo = L / (1 + L)
    const dHi = 1 / (1 + L)
    for (const f of [0.0, 0.5, 1.0]) {
      const d = dLo + (dHi - dLo) * f
      const w = S.windowAt(p, d)
      const wid = w.hi - w.lo
      travelRows.push(`L${L}@${d.toFixed(3)} w=${wid.toFixed(4)}`)
      if (Math.abs(wid - L) > 1e-9) travelBad++
      if (w.identity) travelBad++
      // The tail is off zero strictly INSIDE the fully-entered range.
      if (f > 0 && f < 1 && w.openBack) travelBad++
    }
    // …and the entry ramp is correctly SHORT rather than clipped to nothing.
    const entry = S.windowAt(p, dLo * 0.5)
    if (!(entry.openBack && entry.hi - entry.lo < L && entry.hi > 0)) travelBad++
  }
  say(
    travelBad === 0,
    "MODEL · WINDOW — `travel` is a FIXED-LENGTH segment that enters and leaves the mark",
    `${travelBad} violations · width holds at L across the fully-entered range, is short in the entry ramp, and closes at both ends · ${travelRows.join(" ")}`,
  )

  // 3 · REVERSE — S runs BACKWARDS inside every reversed track, at ONE |slope|,
  //     and the sign agrees with the flag the track carries.
  let revBad = 0
  let revSeen = 0
  const revScheds = [
    { ...S.DRAW_IN_DEFAULTS, reverse: "all" },
    { ...S.DRAW_IN_DEFAULTS, reverse: "alternate" },
    { ...S.DRAW_IN_DEFAULTS, order: "reversed", reverse: "all", overlap: 0.5 },
  ].map((p) => S.scheduleFromStrokes(strokes, null, p))
  for (const sc of revScheds) {
    if (!sc.uniformSlope) revBad++
    for (const t of sc.tracks) {
      if (t.reverse) revSeen++
      if (!(t.start < t.end || t.start === t.end)) revBad++
      let prev = t.reverse ? Infinity : -Infinity
      for (let k = 1; k <= 20; k++) {
        const a = t.from + ((t.to - t.from) * k) / 20
        const v = S.scheduleArc(sc, a)
        if (t.reverse ? v > prev + 1e-9 : v < prev - 1e-9) revBad++
        prev = v
      }
    }
  }
  say(
    revBad === 0 && revSeen > 0,
    "MODEL · REVERSE — S runs BACKWARDS inside every reversed track and forwards in the rest, one |slope|",
    `${revSeen} reversed tracks over ${revScheds.length} schedules, ${revBad} violations · slot stays ordered (start <= end) throughout`,
  )

  /* 4 · 🔴 THE ARC MAP IS THE MAP — the model half of the tip-field finding.
   *
   * `scheduleArcCoeffs` is what `buildTipField` folds into its minimum, and if
   * it is not `scheduleArc` to the last bit the field keys every texel to a
   * boundary the shader is not testing against. The KNOWN-BAD is the exact
   * mistake step 2's remap makes: drop the SIGN, and every reversed track's
   * coefficients describe a map running the other way. */
  let coefBad = 0
  let badCoefCaught = 0
  let coefSamples = 0
  for (const sc of revScheds) {
    const c = S.scheduleArcCoeffs(sc)
    if (!c) {
      coefBad++
      continue
    }
    for (let i = 0; i < sc.tracks.length; i++) {
      const t = sc.tracks[i]
      for (let k = 1; k <= 8; k++) {
        const a = t.from + ((t.to - t.from) * k) / 9
        const viaMap = c[i * 2] + c[i * 2 + 1] * a
        const viaFn = S.scheduleArc(sc, a)
        coefSamples++
        if (Math.abs(viaMap - viaFn) > 1e-9) coefBad++
        // KNOWN-BAD: the sign dropped, which is remap-after-the-minimum.
        const bad = Math.abs(c[i * 2 + 1]) * a + c[i * 2]
        if (t.reverse && Math.abs(bad - viaFn) > 1e-6) badCoefCaught++
      }
    }
  }
  say(
    coefBad === 0 && badCoefCaught > 0,
    "MODEL · 🔴 the tip field's ARC MAP reproduces `scheduleArc` exactly — and the sign-dropped KNOWN-BAD is REJECTED",
    `${coefSamples} samples agree to 1e-9 · ${badCoefCaught} of them diverge once the sign is dropped (that IS step 2's remap under a reverse)`,
  )

  // 5 · The interval reader GENERALISES the prefix reader rather than replacing
  //     it — at `grow` on any schedule, `strokeSpansIn` is `[0, progress]`.
  let spanBad = 0
  let spanSamples = 0
  for (const sc of [idSched, ...revScheds, S.scheduleFromStrokes(strokes, null, { ...S.DRAW_IN_DEFAULTS, order: "byLength", overlap: 0.5 })]) {
    for (const d of PH) {
      const w = S.windowAt({ mode: "grow", length: 0.25 }, d)
      const sp = S.strokeSpansIn(sc, w.lo, w.hi)
      const pr = S.strokeProgressAt(sc, d)
      for (let i = 0; i < pr.length; i++) {
        spanSamples++
        const f0 = sc.tracks[i].reverse ? 1 - pr[i] : 0
        const f1 = sc.tracks[i].reverse ? 1 : pr[i]
        if (Math.abs(sp[i * 2] - f0) > 1e-12 || Math.abs(sp[i * 2 + 1] - f1) > 1e-12) spanBad++
      }
    }
  }
  say(
    spanBad === 0,
    "MODEL · WINDOW — `strokeSpansIn` at `grow` IS `strokeProgressAt`, with a reversed track's ends swapped",
    `${spanSamples - spanBad}/${spanSamples} agree to 1e-12 over 6 schedules × ${PH.length} playheads`,
  )

  /* 6 · 🔴 THE SET IDENTITY — `W[lo,hi] = P(hi) \ P(lo)`, on the MODEL.
   *
   * The claim the whole trailing-edge design turns on, checked as arc length
   * rather than as pixels, so the raster row later has something exact to be
   * an instance of. The clip under a travelling window must carry the window's
   * own width of the word, and it must be the SAME ink the two prefixes differ
   * by. */
  let setBad = 0
  const arcOf = (ss) => {
    let L = 0
    for (const s of ss)
      for (let i = 1; i < s.points.length; i++)
        L += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
    return L
  }
  const totalArc = arcOf(strokes)
  const setRows = []
  for (const L of [0.2, 0.35]) {
    for (const d of [0.35, 0.5, 0.65]) {
      const w = S.windowAt({ mode: "travel", length: L }, d)
      const inWin = arcOf(S.filterStrokesBySchedule(strokes, idSched, d, w))
      const pHi = arcOf(R.filterStrokesByProgress(strokes, w.hi))
      const pLo = arcOf(R.filterStrokesByProgress(strokes, w.lo))
      const diff = Math.abs(inWin - (pHi - pLo)) / totalArc
      setRows.push(`L${L}@${d}: ${(inWin / totalArc).toFixed(4)} vs ${((pHi - pLo) / totalArc).toFixed(4)}`)
      if (diff > 1e-9) setBad++
      if (Math.abs(inWin / totalArc - L) > 1e-9) setBad++
    }
  }
  say(
    setBad === 0,
    "MODEL · 🔴 THE WINDOW IS SET SUBTRACTION — arc(W[lo,hi]) === arc(P(hi)) − arc(P(lo)), and it is exactly the window's length",
    `${setRows.length} cells, worst deviation 0 · ${setRows.join(" · ")}`,
  )
}

async function main() {
  EV.open()
  await modelRows()

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
    recordVideo: { dir: OUT, size: VIEW },
  })
  const page = await context.newPage()
  const pageErrors = []
  const consoleAll = []
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)))
  // EVERY LEVEL. The message that named explainer 24's defect was a WARNING.
  page.on("console", (m) => consoleAll.push(`${m.type()}: ${m.text().slice(0, 240)}`))

  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__revealHarness && window.__captureHarness,
    null,
    { timeout: 120000 },
  )
  await page.evaluate(
    (poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 12, gapMs: 60 }),
    fixture(),
  )
  await page.waitForTimeout(1600)

  const settle = async (ms = 260) => {
    await page.waitForTimeout(ms)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }
  /* 🔴 EVERY GRAB IN THIS RUN, CENSUSED — see §15. Every raster row on this
   * gate is a comparison between two frames, and a comparison between frames of
   * DIFFERENT SIZES is not a comparison. `differingPixels` walks `a.d.length`,
   * so a wider `b` would be read only as far as `a` goes and the extra column
   * would never be looked at — a silent, one-sided read rather than a throw. */
  const grabCensus = { n: 0, sizes: {}, wrongSubject: 0, info: null }
  const grab = async (name) => {
    const [url, info] = await page.evaluate(() => [
      window.__captureHarness.grab(),
      window.__captureHarness.grabInfo ? window.__captureHarness.grabInfo() : null,
    ])
    const buf = Buffer.from(String(url).split(",")[1], "base64")
    const key = `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`
    grabCensus.n++
    grabCensus.sizes[key] = (grabCensus.sizes[key] ?? 0) + 1
    if (info) {
      grabCensus.info = info
      if (info.firstUnderContainer === false) grabCensus.wrongSubject++
    }
    writeFileSync(join(OUT, name), buf)
    return buf
  }
  const setDrawIn = async (patch) => {
    const ok = await page.evaluate(
      (p) => window.__revealHarness.setDrawIn(p),
      { ...DEFAULTS, ...patch },
    )
    await page.waitForTimeout(650)
    return ok
  }
  const model = () => page.evaluate(() => window.__fsSchedule ?? null)
  const seek = async (v) => {
    await page.evaluate((x) => window.__revealHarness.setProgress(x), v)
    await settle()
  }
  const setEngine = async (eng) => {
    await page.evaluate(
      ([mode, family, inflate]) => {
        window.__styleHarness.setEngine(family)
        window.__styleHarness.setMode(mode)
        window.__styleHarness.setInflate(inflate ?? { fusion: "auto" })
      },
      [eng.mode, eng.family, eng.inflate ?? null],
    )
    await page.waitForTimeout(1800)
    await page.evaluate(() => window.__captureHarness.frontView(0.8))
    await settle(500)
  }
  /** The BEAT this frame — the scalar the keys are compared against. Null on
   *  every path that reveals by rebuilding rather than by `setDrawRange`. */
  const beatNow = () =>
    page.evaluate(() => {
      try {
        return window.__inflateProbe.revealState().frac
      } catch {
        return null
      }
    })
  /** Find the `setProgress` value whose BEAT lands on `target`. The playhead is
   *  a TIME fraction and the keys live in BEAT space; a gate that assumed the
   *  two were the same number would be measuring a window it did not choose. */
  const seekBeat = async (target) => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2
      await page.evaluate((x) => window.__revealHarness.setProgress(x), mid)
      /* ⚠ A FRAME HAS TO RENDER BEFORE THE BEAT IS READABLE. `liveRevealFrac`
       * is written by the frame loop, so reading it straight after
       * `setProgress` returns the PREVIOUS playhead's answer — and a bisection
       * on a lagged reading converges to the wrong number while looking
       * perfectly healthy. Measured the hard way: a search for beat 0.149
       * landed at 0.508, and three arms that were supposed to share one instant
       * were captured at three, which made a correct feature read as a 0.1478
       * IoU collapse. */
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      const b = await beatNow()
      if (b === null) return null
      if (b < target) lo = mid
      else hi = mid
    }
    const t = (lo + hi) / 2
    await page.evaluate((x) => window.__revealHarness.setProgress(x), t)
    await settle()
    const beat = await beatNow()
    return { t, beat, target, err: beat === null ? null : Math.abs(beat - target) }
  }

  /* ═══ 0 · THE PANEL IS REAL ═══════════════════════════════════════════════
   * Through the DOM, not the harness. A whole panel in this repo once rendered
   * zero controls while harness assertions passed. */
  await page.click("button[aria-haspopup='dialog'][aria-expanded='false']").catch(() => {})
  await page.waitForTimeout(400)
  const panel = await page.evaluate(() => {
    const dlg = document.querySelector("[role='dialog'][aria-label='Draw-in timing']")
    if (!dlg) return { found: false }
    const btns = [...dlg.querySelectorAll("button")].map((b) => b.textContent.trim())
    const ranges = [...dlg.querySelectorAll("input[type=range]")].length
    return { found: true, btns, ranges }
  })
  say(panel.found, "the Timing popover opens from the transport bar", panel.found ? "" : "no dialog")
  const wantBtns = ["As drawn", "Reversed", "Short first", "Left to right", "Random", "Start together", "End together", "Groups", "Strokes"]
  const missing = wantBtns.filter((b) => !(panel.btns ?? []).includes(b))
  say(
    missing.length === 0,
    "…and it renders every DRAW IN control a user needs",
    missing.length ? `MISSING ${missing.join(", ")}` : `${(panel.btns ?? []).length} buttons, ${panel.ranges} sliders`,
  )
  // The overlap slider is the second range in the dialog (delay is the other).
  const clicked = await page.evaluate(() => {
    const dlg = document.querySelector("[role='dialog'][aria-label='Draw-in timing']")
    const b = [...dlg.querySelectorAll("button")].find((x) => x.textContent.trim() === "Reversed")
    if (!b) return false
    b.click()
    return true
  })
  await page.waitForTimeout(600)
  const afterClick = await model()
  say(
    clicked && afterClick && afterClick.params.order === "reversed" && afterClick.identity === false,
    "CLICKING the real 'Reversed' button changes the MODEL",
    afterClick ? `order=${afterClick.params.order} identity=${afterClick.identity}` : "no model published",
  )
  await page.evaluate(() => {
    const dlg = document.querySelector("[role='dialog'][aria-label='Draw-in timing']")
    const b = [...dlg.querySelectorAll("button")].find((x) => x.textContent.trim() === "As drawn")
    b?.click()
  })
  await page.waitForTimeout(500)
  // Close the popover so it cannot overlap the stage in any capture.
  await page.keyboard.press("Escape").catch(() => {})
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button[aria-haspopup='dialog']")].find(
      (b) => b.getAttribute("aria-expanded") === "true",
    )
    btn?.click()
  })
  await page.waitForTimeout(300)

  /* ═══ 1 · THE MODEL ═══════════════════════════════════════════════════════ */
  await setDrawIn({})
  const mDefault = await model()
  say(!!mDefault, "the scene publishes its schedule", mDefault ? mDefault.sig : "no __fsSchedule")
  const trackOk =
    mDefault &&
    mDefault.tracks.every((t) => Math.abs(t.start - t.from) < 1e-9 && Math.abs(t.end - t.to) < 1e-9)
  say(
    !!mDefault && mDefault.identity === true && Math.abs(mDefault.scale - 1) < 1e-9 && trackOk,
    "DEFAULT is the IDENTITY — every track sits on its own recorded span",
    mDefault ? `identity=${mDefault.identity} scale=${mDefault.scale} tracks=${mDefault.tracks.length}` : "",
  )
  /* ⚠ THE GROUPING IS READ UNDER A NON-DEFAULT ORDER, ON PURPOSE. At
   * `asDrawn` + `overlap 0` the scene skips `assignLetters` entirely, because
   * "as drawn" takes every stroke's own recorded span and a grouping cannot
   * change what the recording was — so `unitCount` there is the stroke count by
   * construction and a row asserting otherwise would be measuring the skip. */
  await setDrawIn({ order: "reversed" })
  const mGrouped = await model()
  say(
    !!mGrouped && mGrouped.unitCount < mGrouped.strokeCount,
    "the ink's own grouping FUSES the strokes that touch — fewer units than strokes",
    mGrouped ? `${mGrouped.unitCount} groups / ${mGrouped.strokeCount} strokes` : "",
  )
  await setDrawIn({})

  const sigs = new Map()
  const slopes = []
  for (const p of [
    { order: "asDrawn" },
    { order: "reversed" },
    { order: "byLength" },
    { order: "byPosition" },
    { order: "random", seed: 7 },
    { order: "random", seed: 8 },
    { order: "asDrawn", overlap: 0.5 },
    { order: "asDrawn", overlap: 1, align: "start" },
    { order: "asDrawn", overlap: 1, align: "end" },
    { order: "reversed", unit: "stroke" },
  ]) {
    await setDrawIn(p)
    const m = await model()
    sigs.set(JSON.stringify(p), m?.sig ?? "none")
    slopes.push(m?.uniformSlope === true)
  }
  say(
    new Set(sigs.values()).size === sigs.size,
    "NON-VACUITY — ten distinct dial states produce ten distinct schedules",
    `${new Set(sigs.values()).size} distinct of ${sigs.size}`,
  )
  say(
    slopes.every(Boolean),
    "every schedule has a UNIFORM SLOPE — the tip's whole cheap fix rests on it",
    `${slopes.filter(Boolean).length}/${slopes.length}`,
  )
  await setDrawIn({ order: "reversed", unit: "stroke" })
  const mStroke = await model()
  say(
    !!mStroke && !!mGrouped && mStroke.unitCount === mStroke.strokeCount && mStroke.unitCount > mGrouped.unitCount,
    "'Strokes' OPENS every group to its members",
    mStroke && mGrouped ? `${mGrouped.unitCount} groups -> ${mStroke.unitCount} strokes` : "",
  )
  await setDrawIn({})

  /* ═══ 2 · EVERY ENGINE, AND THE ROUND TRIP ════════════════════════════════ */
  const engineMoves = []
  const roundTrip = []
  for (const eng of ENGINES) {
    await setEngine(eng)
    await setDrawIn({})
    await seek(0)
    const empty = await pixels(await grab(`${eng.key}-empty.png`))
    await seek(0.44)
    const defBuf = await grab(`${eng.key}-default-p44.png`)
    const def = await pixels(defBuf)
    await setDrawIn({ order: "reversed" })
    await seek(0.44)
    const revBuf = await grab(`${eng.key}-reversed-p44.png`)
    const rev = await pixels(revBuf)
    await setDrawIn({})
    await seek(0.44)
    const backBuf = await grab(`${eng.key}-back-p44.png`)

    const A = inkMask(def, empty)
    const B = inkMask(rev, empty)
    const j = iou(A, B)
    engineMoves.push({ engine: eng.key, iou: j, inkDefault: A.count, inkReversed: B.count })
    roundTrip.push({ engine: eng.key, same: sha(defBuf) === sha(backBuf), a: sha(defBuf), b: sha(backBuf) })
  }
  const moved = engineMoves.filter((e) => e.iou < 0.75)
  say(
    moved.length === ENGINES.length,
    "`order: reversed` VISIBLY changes the draw on EVERY engine",
    engineMoves.map((e) => `${e.engine} IoU ${e.iou.toFixed(3)}`).join(" · "),
  )
  const rtBad = roundTrip.filter((r) => !r.same)
  say(
    rtBad.length === 0,
    "ROUND TRIP — putting the dials back gives back the BYTE-IDENTICAL default render",
    rtBad.length ? rtBad.map((r) => `${r.engine} ${r.a}!=${r.b}`).join(" · ") : `${roundTrip.length}/${roundTrip.length} engines`,
  )

  /* ═══ 3 · ALIGN, AND TWO PENS ON THE PAGE AT ONCE ═════════════════════════
   *
   * ON THE FUSED SURFACE, and that is a correction rather than a preference:
   * `fusion: "auto"` builds LOFTS on this fixture and reveals them by rebuild,
   * with no `revealKeys` and therefore no pen tip at all. The `setDrawRange`
   * prefix and the fragment test — the two mechanisms `DRAW IN` actually acts
   * through on Free Stroke — are only reachable at `fusion: "implicit"`. */
  const inflate = ENGINES.find((e) => e.key === "inflate-implicit")
  await setEngine(inflate)
  await setDrawIn({})
  await seek(0.44)
  const fusedBeat = await beatNow()
  say(
    fusedBeat !== null,
    "the fused implicit surface is live — it reveals by drawRange, so the pen tip exists",
    `beat=${fusedBeat}`,
  )
  await seek(0)
  const emptyI = await pixels(await grab("inflate-empty.png"))

  await setDrawIn({ overlap: 1, align: "start" })
  await seek(0.5)
  const alignStart = await pixels(await grab("align-start-p50.png"))
  await setDrawIn({ overlap: 1, align: "end" })
  await seek(0.5)
  const alignEnd = await pixels(await grab("align-end-p50.png"))
  const alignDiff = differingPixels(alignStart, alignEnd)
  say(
    alignDiff > 2000,
    "ALIGN acts — 'start together' and 'end together' are different pictures",
    `${alignDiff} px differ at overlap 1, playhead 0.50`,
  )

  /* THE FILMED CLAIM, MEASURED: how many SEPARATE places on the page are being
   * inked in the same instant. One pen at overlap 0; more than one above it.
   *
   * ⚠ THE WINDOW IS DERIVED FROM THE MODEL'S OWN OFFSETS, not picked. A window
   * straddling a stroke HANDOVER shows two growing places at overlap 0 too —
   * correctly, because a handover is two places for one instant — so a
   * hard-coded playhead would either fail honestly or pass by luck depending on
   * where the fixture's strokes happen to end. The window is taken strictly
   * INSIDE the longest track, and the same beat window is then used for both
   * arms so the only thing that differs between them is the dial. */
  await setDrawIn({ overlap: 0 })
  const mSeq = await model()
  const longest = [...mSeq.tracks].sort((a, b) => b.end - b.start - (a.end - a.start))[0]
  const span = longest.end - longest.start
  const bA = longest.start + span * 0.35
  const bB = longest.start + span * 0.65
  const pens = {}
  const seeks = {}
  for (const [key, patch] of [
    ["overlap0", { overlap: 0 }],
    ["overlap100", { overlap: 1, align: "start" }],
  ]) {
    await setDrawIn(patch)
    const sA = await seekBeat(bA)
    const f0 = await pixels(await grab(`pens-${key}-a.png`))
    const sB = await seekBeat(bB)
    const f1 = await pixels(await grab(`pens-${key}-b.png`))
    pens[key] = growthComponents(f0, f1, emptyI)
    seeks[key] = { sA, sB }
  }
  /* The ruler is the MARK's own size, not a pixel constant — the framing is
   * `frontView(0.8)` on whatever was drawn, so a fixed threshold would mean a
   * different thing on a different drawing. */
  await setDrawIn({})
  await seek(1)
  const inkAll = inkMask(await pixels(await grab("pens-full.png")), emptyI)
  let x0 = 1e9
  let y0 = 1e9
  let x1 = -1e9
  let y1 = -1e9
  for (let i = 0; i < inkAll.m.length; i++) {
    if (!inkAll.m[i]) continue
    const x = i % inkAll.w
    const y = (i / inkAll.w) | 0
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  const markDiag = Math.hypot(x1 - x0, y1 - y0)
  const SEP_FLOOR = markDiag * 0.25
  say(
    pens.overlap0.sepPx < SEP_FLOOR,
    "at OVERLAP 0 the growth is all in ONE PLACE — one pen",
    `separation ${pens.overlap0.sepPx}px vs floor ${SEP_FLOOR.toFixed(0)}px (mark diag ${markDiag.toFixed(0)}px) · ${pens.overlap0.count} components, ${pens.overlap0.grewPx} px grew · beat window ${bA.toFixed(3)}→${bB.toFixed(3)} inside track ${longest.stroke}`,
  )
  say(
    pens.overlap100.count >= 2 && pens.overlap100.sepPx >= SEP_FLOOR,
    "at OVERLAP 1 TWO OR MORE places FAR APART are growing in the SAME instant — two pen tips",
    `separation ${pens.overlap100.sepPx}px vs floor ${SEP_FLOOR.toFixed(0)}px · ${pens.overlap100.count} components ${JSON.stringify(pens.overlap100.sizes)}, ${pens.overlap100.grewPx} px grew · same beat window`,
  )

  /* ═══ 4 · 🔴 THE TIP RIDES THE SCHEDULE, AND ITS KNOWN-BAD ════════════════
   *
   * The map's red trap. The pen tip's boundary is a per-fragment test; the
   * `setDrawRange` cull in front of it is not. So the honest question is
   * whether the fragment test REFINES that boundary or RELOCATES it: with the
   * tip off, the mark is exactly the drawRange prefix, and a tip that rides the
   * schedule must land on top of it. One that does not is reading the
   * recording's arcs against the beat's playhead, and eats the wrong ink. */
  const tipModes = []
  for (const [key, tip, rides, order] of [
    // The IDENTITY control first — without it the two scheduled arms have no
    // ruler, and "0.95 is good" would be a number pulled out of the air.
    ["identity-off", "off", true, "asDrawn"],
    ["identity-on", "reed", true, "asDrawn"],
    ["tip-off", "off", true, "reversed"],
    ["tip-on-rides", "reed", true, "reversed"],
    ["tip-on-KNOWNBAD", "reed", false, "reversed"],
  ]) {
    await setDrawIn({ order })
    await page.evaluate(
      ([t, r]) => {
        window.__captureHarness.setPenTip(t)
        window.__captureHarness.setTipRidesSchedule(r)
      },
      [tip, rides],
    )
    await page.waitForTimeout(500)
    /* ONE `setProgress` VALUE FOR EVERY ARM, not one beat. The playhead is
     * deterministic and shared; bisecting for a beat per arm would land the
     * arms on different instants and make a boundary comparison meaningless —
     * which is exactly what it did before this line was written. */
    await seek(0.44)
    const px = await pixels(await grab(`tip-${key}-p44.png`))
    const live = await page.evaluate(() => ({
      tip: window.__captureHarness.penTip(),
      rides: window.__captureHarness.tipRidesSchedule(),
      beat: (() => {
        try {
          return window.__inflateProbe.revealState().frac
        } catch {
          return null
        }
      })(),
      tipField: window.__heroPenTip ? window.__heroPenTip.texels : null,
    }))
    tipModes.push({ key, px, live })
  }
  await page.evaluate(() => {
    window.__captureHarness.setTipRidesSchedule(true)
    window.__captureHarness.setPenTip("reed")
  })
  const M = Object.fromEntries(tipModes.map((t) => [t.key, t]))
  say(
    M["tip-on-KNOWNBAD"].live.rides === false && M["tip-on-rides"].live.rides === true,
    "the known-bad ACTUALLY TOOK — a control that silently refuses proves nothing",
    `rides: ${tipModes.map((t) => `${t.key}=${t.live.rides}`).join(" ")}`,
  )
  const mk = (k) => inkMask(M[k].px, emptyI)
  const jIdentity = iou(mk("identity-off"), mk("identity-on"))
  const jGood = iou(mk("tip-off"), mk("tip-on-rides"))
  const jBad = iou(mk("tip-off"), mk("tip-on-KNOWNBAD"))
  /* NON-VACUITY FOR THIS PAIR. If the tip is inert — which it is on every path
   * that reveals by rebuilding, including plain `fusion: "auto"` on this
   * fixture — all the arms are one picture, the IoU rows read 1.0000 / 1.0000
   * and the good row passes while proving nothing. So the pair is required to
   * be a real pair first. */
  const tipDelta = differingPixels(M["tip-off"].px, M["tip-on-rides"].px)
  say(
    tipDelta > 200 && M["tip-on-rides"].live.tipField !== null,
    "the pen tip is ACTUALLY ACTING here — tip off and tip on are different pictures",
    `${tipDelta} px differ, field ${M["tip-on-rides"].live.tipField} texels, beat ${M["tip-on-rides"].live.beat}`,
  )
  say(
    jGood >= 0.9 && jGood >= jIdentity - 0.06,
    "🔴 THE NOSE IS ON THE INK — a schedule does not move the tip off the stroke it is drawing",
    `IoU(tip-on, tip-off): reversed ${jGood.toFixed(4)} vs the identity control ${jIdentity.toFixed(4)}`,
  )
  say(
    jBad < 0.9 && jGood - jBad > 0.05,
    "…and the KNOWN-BAD is REJECTED — the tip left in the recording's arcs",
    `IoU ${jBad.toFixed(4)} against ${jGood.toFixed(4)} — a ${(jGood - jBad).toFixed(4)} collapse`,
  )

  /* ═══════════════════════════════════════════════════════════════════════
   * STEP 3 · THE WINDOW, IN THE BROWSER
   *
   * Everything below is on `inflate-implicit` — the fused surface — because
   * that is where both mechanisms the window acts through live: the
   * `setDrawRange` prefix (now an interval) and the per-fragment tip test (now
   * two-sided). `fusion: "auto"` builds LOFTS and reveals by rebuild, so an arm
   * captured there would exercise neither.
   * ═══════════════════════════════════════════════════════════════════════ */
  /* ⚠ IT WAITS, AND THE FIRST DRAFT DID NOT. `setWindow` writes React state and
   * `__revealHarness` is REINSTALLED on that state (it closes over the params),
   * so reading `windowAt` in the same tick returns the PREVIOUS window's shape.
   * Measured the hard way: a `travel` arm rendered at length 0.30 was compared
   * against two prefixes bounded by length 0.25's edges, and a correct feature
   * read as a 0.7253 IoU. Exactly the lag `seekBeat`'s own note records for
   * `liveRevealFrac`, one control over. */
  const setWindow = async (patch) => {
    const ok = await page.evaluate(
      (p) => window.__revealHarness.setWindow({ mode: "grow", length: 0.25, ...p }),
      patch,
    )
    await page.waitForTimeout(650)
    return ok
  }
  const winModel = () => page.evaluate(() => window.__fsWindow?.params ?? null)
  const liveWindow = () =>
    page.evaluate(() => {
      try {
        return window.__inflateProbe.revealState().window
      } catch {
        return null
      }
    })
  /** Where `setDrawRange` actually starts and stops, off the live buffers. */
  const drawRanges = () =>
    page.evaluate(() => {
      try {
        return window.__inflateProbe.revealState().ranges.map((r) => ({
          start: r.drawStart ?? r.start ?? null,
          count: r.drawCount ?? r.count ?? null,
        }))
      } catch {
        return null
      }
    })

  /* ---- 6 · THE PANEL IS REAL, AGAIN AND FOR THE NEW CONTROLS ------------- */
  await page.click("button[aria-haspopup='dialog'][aria-expanded='false']").catch(() => {})
  await page.waitForTimeout(400)
  const winPanel = await page.evaluate(() => {
    const dlg = document.querySelector("[role='dialog'][aria-label='Draw-in timing']")
    if (!dlg) return { found: false }
    const btns = [...dlg.querySelectorAll("button")].map((b) => b.textContent.trim())
    const ranges = [...dlg.querySelectorAll("input[type=range]")]
    return {
      found: true,
      btns,
      ranges: ranges.length,
      disabledRanges: ranges.filter((r) => r.disabled).length,
    }
  })
  /* THE DIRECTION LABELS NAME A PATH, NOT A TIME — see `REVERSE_LABELS`. The
   * shipped transport toggle eight lines below in the same popover is labelled
   * "Reverse", so a pill reading "Backwards" beside it is the mislabel defect
   * with two coats of paint. This row is what pins the fix. */
  const wantWin = ["Grow", "Travel", "Vanish", "Shrink", "Start \u2192 end", "End \u2192 start", "Alternating"]
  /* …and NOTHING in this panel may read as a near-synonym of the transport's own
   * "Reverse". Asserted rather than trusted, because the first draft shipped
   * exactly that collision and no row would have caught it. */
  const nearSynonyms = (winPanel.btns ?? []).filter(
    (b) => /^(Backwards?|Reversed?)$/i.test(b) && b !== "Reverse" && b !== "Reversed",
  )
  const missWin = wantWin.filter((b) => !(winPanel.btns ?? []).includes(b))
  say(
    winPanel.found && missWin.length === 0 && nearSynonyms.length === 0,
    "the popover renders every WINDOW and DIRECTION control a user needs, and none of them collides with the transport's own Reverse",
    missWin.length
      ? `MISSING ${missWin.join(", ")}`
      : `${(winPanel.btns ?? []).length} buttons, ${winPanel.ranges} sliders, ${winPanel.disabledRanges} correctly disabled at the default · 0 labels colliding with "Reverse"`,
  )
  /* THE LENGTH SLIDER IS DEAD OUTSIDE `travel` AND SAYS SO — explainer 06 §3's
   * rule, the same one `align` follows at overlap 0. A control on screen that
   * cannot act is a defect, and "it is disabled" is a claim about the DOM. */
  const lengthGating = await page.evaluate(() => {
    const dlg = document.querySelector("[role='dialog'][aria-label='Draw-in timing']")
    const pick = (label) =>
      [...dlg.querySelectorAll("button")].find((x) => x.textContent.trim() === label)
    /* BY ITS OWN NAME, not by position. The first draft took the LAST range in
     * the dialog and got the Delay slider, which is never disabled — so the row
     * failed while the control it was aiming at was working correctly. Three
     * sliders now carry `aria-label`s for exactly this reason; "the last one"
     * is a fact about layout and this is a question about a control. */
    const lengthEl = () => dlg.querySelector("input[type=range][aria-label='Window length']")
    const atGrow = lengthEl().disabled
    pick("Travel")?.click()
    return new Promise((r) =>
      setTimeout(() => {
        const atTravel = lengthEl().disabled
        pick("Grow")?.click()
        setTimeout(() => r({ atGrow, atTravel, back: lengthEl().disabled }), 250)
      }, 250),
    )
  })
  say(
    lengthGating.atGrow === true && lengthGating.atTravel === false && lengthGating.back === true,
    "…and LENGTH is disabled everywhere it cannot act, live, both ways",
    `grow=${lengthGating.atGrow ? "disabled" : "live"} travel=${lengthGating.atTravel ? "disabled" : "live"} back=${lengthGating.back ? "disabled" : "live"}`,
  )
  /* CLICKED, not set. Same reason row 3 clicks `Reversed`. */
  const winClicked = await page.evaluate(() => {
    const dlg = document.querySelector("[role='dialog'][aria-label='Draw-in timing']")
    const b = [...dlg.querySelectorAll("button")].find((x) => x.textContent.trim() === "Travel")
    if (!b) return false
    b.click()
    return true
  })
  await page.waitForTimeout(600)
  const winAfterClick = await winModel()
  say(
    winClicked && winAfterClick && winAfterClick.mode === "travel",
    "CLICKING the real 'Travel' button changes the MODEL",
    winAfterClick ? `mode=${winAfterClick.mode} length=${winAfterClick.length}` : "no __fsWindow",
  )
  await page.evaluate(() => {
    const dlg = document.querySelector("[role='dialog'][aria-label='Draw-in timing']")
    ;[...dlg.querySelectorAll("button")].find((x) => x.textContent.trim() === "Grow")?.click()
    ;[...dlg.querySelectorAll("button")].find((x) => x.textContent.trim() === "Start \u2192 end")?.click()
  })
  await page.waitForTimeout(400)
  await page.keyboard.press("Escape").catch(() => {})
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button[aria-haspopup='dialog']")].find(
      (b) => b.getAttribute("aria-expanded") === "true",
    )
    btn?.click()
  })
  await page.waitForTimeout(300)

  /* ---- 7 · TWO BINARY SEARCHES — `setDrawRange`'s START LEAVES ZERO ------
   *
   * The map names the whole cost of this slice as *"two binary searches instead
   * of one on the `setDrawRange` path."* This is that claim read off the live
   * buffer rather than argued: under `grow` the submitted range starts at 0 at
   * every playhead, and under `travel` it does not. A window implemented by
   * culling from the front only would pass every visual row above and fail
   * this one. */
  await setEngine(inflate)
  await setDrawIn({})
  await setWindow({ mode: "grow" })
  await seek(0.5)
  const rangeGrow = await drawRanges()
  await setWindow({ mode: "travel", length: 0.25 })
  await seek(0.5)
  const rangeTravel = await drawRanges()
  const growStarts = (rangeGrow ?? []).map((r) => r.start)
  const travelStarts = (rangeTravel ?? []).map((r) => r.start)
  say(
    growStarts.length > 0 &&
      growStarts.every((s) => s === 0) &&
      travelStarts.length > 0 &&
      travelStarts.some((s) => s > 0),
    "TWO BINARY SEARCHES — `setDrawRange` starts at 0 under `grow` and OFF zero under `travel`",
    `grow starts ${JSON.stringify(growStarts)} · travel starts ${JSON.stringify(travelStarts)}`,
  )

  /* ---- 8 · 🔴 THE WINDOW IS SET SUBTRACTION, ON THE RASTER ---------------
   *
   * The model row proved `arc(W[lo,hi]) === arc(P(hi)) − arc(P(lo))` exactly.
   * This is the same identity in pixels, and it is the row the trailing-edge
   * law was CHOSEN to make checkable: a `travel` frame at one playhead against
   * the DIFFERENCE of two `grow` frames taken at that window's own two edges.
   * A trailing boundary in the wrong place, or shaped by a mirrored nib rather
   * than by the same `when`, fails it. */
  const TRAVEL_L = 0.3
  await setEngine(inflate)
  await setDrawIn({})
  await setWindow({ mode: "travel", length: TRAVEL_L })
  const wT = await page.evaluate((d) => window.__revealHarness.windowAt(d), 0.5)
  const bTravel = await seekBeat(0.5)
  const travelPx = await pixels(await grab("win-travel-p50.png"))
  await setWindow({ mode: "grow" })
  const bHi = await seekBeat(wT.hi)
  const growHiPx = await pixels(await grab("win-grow-hi.png"))
  const bLo = await seekBeat(wT.lo)
  const growLoPx = await pixels(await grab("win-grow-lo.png"))
  const mTravel = inkMask(travelPx, emptyI)
  const mHi = inkMask(growHiPx, emptyI)
  const mLo = inkMask(growLoPx, emptyI)
  const expected = maskMinus(mHi, mLo)
  const setIoU = iou(mTravel, expected)
  const growVsTravel = iou(mTravel, mHi)
  /* THE BEATS THE THREE ARMS ACTUALLY LANDED ON, printed either way. Three
   * frames that were supposed to share a window and did not is the failure
   * `seekBeat` carries its own warning about, and it made a correct feature
   * read as a collapse once already tonight. */
  const beatErr = Math.max(
    Math.abs((bTravel?.beat ?? 0) - 0.5),
    Math.abs((bHi?.beat ?? 0) - wT.hi),
    Math.abs((bLo?.beat ?? 0) - wT.lo),
  )
  say(
    setIoU >= 0.9 && setIoU > growVsTravel && beatErr < 0.002,
    "🔴 THE WINDOW IS SET SUBTRACTION ON THE RASTER — `travel` IS `grow(hi)` minus `grow(lo)`",
    `IoU ${setIoU.toFixed(4)} against the difference of two prefixes, vs ${growVsTravel.toFixed(4)} against the prefix itself · window [${wT.lo.toFixed(3)}, ${wT.hi.toFixed(3)}] width ${(wT.hi - wT.lo).toFixed(3)} (asked ${TRAVEL_L}) · worst beat error ${beatErr.toFixed(5)} · ink ${mTravel.count} vs ${expected.count}`,
  )

  /* ---- 9 · 🔴 THE LEADING EDGE, ISOLATED --------------------------------
   *
   * The dispatch's bar is explicit that a window has the tip trap TWICE and
   * that each edge is proved on its own. This isolates the LEADING one, and the
   * isolation is exact rather than approximate:
   *
   *     travel ∪ grow(lo)   ==   grow(hi)
   *
   * Every pixel the trailing edge could get wrong lies BELOW `lo`, and every
   * such pixel is already in `grow(lo)` — so the union swallows the trailing
   * error entirely and the only thing left that can move this number is where
   * the leading boundary is. */
  const unionTravelLo = { m: new Uint8Array(mTravel.m.length), w: mTravel.w, h: mTravel.h, count: 0 }
  for (let i = 0; i < unionTravelLo.m.length; i++) {
    if (mTravel.m[i] || mLo.m[i]) {
      unionTravelLo.m[i] = 1
      unionTravelLo.count++
    }
  }
  const jLead = iou(unionTravelLo, mHi)
  say(
    jLead >= 0.97,
    "🔴 THE LEADING EDGE IS UNMOVED BY THE WINDOW — `travel ∪ grow(lo)` reconstructs `grow(hi)`",
    `IoU ${jLead.toFixed(4)} · the union cancels the trailing edge by construction, so only the leading boundary can move it`,
  )

  /* …AND ITS KNOWN-BAD. The leading edge's trap is step 2's — the field left in
   * the recording's arcs — and it is INERT at the identity schedule by
   * construction, so the arm has to carry a real schedule or the row would pass
   * while proving nothing. Same union statistic, same instant, one control. */
  const leadArms = {}
  for (const [key, rides] of [
    ["rides", true],
    ["KNOWNBAD", false],
  ]) {
    await setDrawIn({ order: "reversed" })
    await page.evaluate((r) => window.__captureHarness.setTipRidesSchedule(r), rides)
    await page.waitForTimeout(400)
    await setWindow({ mode: "travel", length: TRAVEL_L })
    const w2 = await page.evaluate((d) => window.__revealHarness.windowAt(d), 0.5)
    await seekBeat(0.5)
    const tPx = await pixels(await grab(`lead-${key}-travel.png`))
    await setWindow({ mode: "grow" })
    await seekBeat(w2.hi)
    const hPx = await pixels(await grab(`lead-${key}-hi.png`))
    await seekBeat(w2.lo)
    const lPx = await pixels(await grab(`lead-${key}-lo.png`))
    const a = inkMask(tPx, emptyI)
    const b = inkMask(hPx, emptyI)
    const c = inkMask(lPx, emptyI)
    const u = { m: new Uint8Array(a.m.length), w: a.w, h: a.h, count: 0 }
    for (let i = 0; i < u.m.length; i++)
      if (a.m[i] || c.m[i]) {
        u.m[i] = 1
        u.count++
      }
    leadArms[key] = { iou: iou(u, b), live: await page.evaluate(() => window.__captureHarness.tipRidesSchedule()) }
  }
  await page.evaluate(() => window.__captureHarness.setTipRidesSchedule(true))
  await page.waitForTimeout(300)
  say(
    leadArms.KNOWNBAD.live === false && leadArms.rides.live === true,
    "the leading-edge known-bad ACTUALLY TOOK — a control that silently refuses proves nothing",
    `tipRidesSchedule read back: rides=${leadArms.rides.live} knownbad=${leadArms.KNOWNBAD.live}`,
  )
  say(
    leadArms.rides.iou >= 0.95 && leadArms.rides.iou - leadArms.KNOWNBAD.iou > 0.05,
    "…🔴 and it is REJECTED — under a window AND a reorder, a tip left in the recording's arcs breaks the leading edge",
    `union IoU: rides ${leadArms.rides.iou.toFixed(4)} · KNOWN-BAD ${leadArms.KNOWNBAD.iou.toFixed(4)} — a ${(leadArms.rides.iou - leadArms.KNOWNBAD.iou).toFixed(4)} collapse`,
  )

  /* ---- 10 · 🔴 THE TRAILING EDGE, ISOLATED -------------------------------
   *
   * The other half of the trap, and the half that did not exist before step 3.
   * With the leading edge proved above, the only thing left that can put ink
   * outside `grow(hi) \ grow(lo)` is the trailing boundary — so the statistic
   * is the EXCESS: how much ink the window is showing that the two prefixes
   * say should already be gone.
   *
   * `setTipTrailsWindow(false)` leaves that boundary at the `setDrawRange`
   * cull, which sits a whole nose-margin further back and is faceted at
   * marching-cubes granularity. */
  await setDrawIn({})
  await setWindow({ mode: "travel", length: TRAVEL_L })
  await seekBeat(0.5)
  const trailOnPx = await pixels(await grab("win-trail-on.png"))
  await page.evaluate(() => window.__captureHarness.setTipTrailsWindow(false))
  await page.waitForTimeout(400)
  await seekBeat(0.5)
  const trailOffPx = await pixels(await grab("win-trail-off.png"))
  const trailLive = await page.evaluate(() => window.__captureHarness.tipTrailsWindow())
  await page.evaluate(() => window.__captureHarness.setTipTrailsWindow(true))
  await page.waitForTimeout(300)
  const mOn = inkMask(trailOnPx, emptyI)
  const mOff = inkMask(trailOffPx, emptyI)
  const exOn = maskMinus(mOn, expected).count / expected.count
  const exOff = maskMinus(mOff, expected).count / expected.count
  const ops = maskOps(mOff, mOn)
  say(
    trailLive === false && ops.onlyA > 300,
    "the trailing-edge known-bad ACTUALLY TOOK — a control that silently refuses proves nothing",
    `tipTrailsWindow read back ${trailLive} · ${ops.onlyA} px of ink survive ONLY with the second test off, ${ops.onlyB} px are lost`,
  )
  say(
    exOn < 0.04 && exOff > exOn * 3 && ops.onlyB * 4 < ops.onlyA,
    "…🔴 and it is REJECTED — one-sided, the trailing boundary is the drawRange cull, a nose-margin too far back",
    `EXCESS ink outside grow(hi)−grow(lo): trailing test ON ${(exOn * 100).toFixed(2)}% · OFF ${(exOff * 100).toFixed(2)}% — ${(exOff / Math.max(exOn, 1e-9)).toFixed(1)}× · the off arm is a strict SUPERSET (${ops.onlyA} px extra, ${ops.onlyB} px missing)`,
  )

  /* ---- 11 · 🔴 REVERSE, AND THE FIELD-BAKE KNOWN-BAD ---------------------
   *
   * The finding step 3 turned up inside step 2's own path: the `arc` channel is
   * a MINIMUM over coverers, and `min` commutes with a remap only while the
   * remap is INCREASING. Under `reverse` it is not, so a field baked in the
   * recording's arcs and remapped afterwards records the arc at which the nib
   * LAST covered a texel instead of the arc at which it FIRST did — off by the
   * nib's own sweep, one diameter.
   *
   * ⚠ THE STATISTIC IS NOT `IoU(tip on, tip off)`, AND THE FIRST DRAFT'S WAS —
   * it failed, correctly, because that comparison is INVERTED for this defect.
   * With the tip OFF the drawRange margin is not paid at all, so `tip off` is
   * the mark cut at exactly the playhead; a nose that reaches FURTHER (which is
   * the CORRECT behaviour) therefore scores a LOWER IoU against it than one
   * that reaches less far. Measured: baked 0.9755, remapped-after 0.9790 — the
   * defect scoring better on the wrong ruler.
   *
   * ⚠ AND THE SECOND DRAFT'S WAS AN EDGE POSITION, WHICH IS NOT AVAILABLE HERE.
   * It measured stroke A1's leftmost inked column and read **x = 0 on both
   * arms** — because `frontView(0.8)` frames this fixture edge to edge on an
   * 800 px canvas (`canvasWidth = innerWidth / 2`), so the mark's bbox is
   * `x 0..798` and BOTH boundaries are clipped. An absolute edge position is
   * simply not measurable in this framing; recording that rather than nudging
   * the band until a number appeared is the whole of the difference between a
   * measurement and a result.
   *
   * So the claim is stated in the form the framing DOES support, and it is the
   * same claim: inking late makes the drawn set strictly SMALLER, everywhere,
   * at every playhead. The defect's mark must therefore be CONTAINED in the
   * correct one — `remapped ⊂ baked`, with a real difference between them. If
   * the bake were the broken half the containment would run the other way and
   * this row would fail, which is what makes it a test rather than a reading. */
  await setWindow({ mode: "grow" })
  await setDrawIn({ reverse: "all" })
  await page.waitForTimeout(600)
  const revModel = await model()
  say(
    !!revModel && revModel.reversedCount === revModel.strokeCount && revModel.uniformSlope === true,
    "REVERSE — every unit runs backwards and the slope MAGNITUDE survives it, which is what the tip's cheap fix rests on",
    revModel
      ? `${revModel.reversedCount}/${revModel.strokeCount} tracks reversed · uniformSlope=${revModel.uniformSlope} · scale=${revModel.scale}`
      : "no model",
  )
  const revArms = {}
  for (const [key, bake] of [
    ["baked", true],
    ["KNOWNBAD-remap", false],
  ]) {
    await page.evaluate((b) => window.__captureHarness.setTipFieldBake(b), bake)
    await page.evaluate(() => window.__captureHarness.setPenTip("reed"))
    await page.waitForTimeout(900)
    await seek(0.44)
    const px = await pixels(await grab(`rev-${key}-p44.png`))
    revArms[key] = {
      px,
      flags: await page.evaluate(() => ({
        baked: window.__heroPenTip?.scheduleBaked ?? null,
        remap: window.__heroPenTip?.remapApplied ?? null,
        live: window.__captureHarness.tipFieldBake(),
      })),
    }
  }
  await page.evaluate(() => window.__captureHarness.setTipFieldBake(true))
  await page.waitForTimeout(900)
  const mBaked = inkMask(revArms.baked.px, emptyI)
  const mRemap = inkMask(revArms["KNOWNBAD-remap"].px, emptyI)
  const revOps = maskOps(mBaked, mRemap)
  const revDelta = differingPixels(revArms.baked.px, revArms["KNOWNBAD-remap"].px)
  say(
    revArms.baked.flags.baked === true &&
      revArms["KNOWNBAD-remap"].flags.live === false &&
      revArms["KNOWNBAD-remap"].flags.remap === true,
    "the FIELD-BAKE known-bad ACTUALLY TOOK — the field really was rebuilt down the parked path",
    `scheduleBaked ${revArms.baked.flags.baked} -> ${revArms["KNOWNBAD-remap"].flags.baked} · remapApplied ${revArms["KNOWNBAD-remap"].flags.remap} · live ${revArms["KNOWNBAD-remap"].flags.live}`,
  )
  say(
    revOps.onlyA > 250 && revOps.onlyB * 5 < revOps.onlyA && revDelta > 200,
    "🔴 UNDER A REVERSE the REMAP-AFTER known-bad INKS LATE — its mark is a strict SUBSET and is REJECTED",
    `${revOps.onlyA} px are drawn ONLY by the baked field and ${revOps.onlyB} px only by the remapped one — short, never long, which is the signature of a texel keyed to the LAST covering sample instead of the first · ink ${mBaked.count} vs ${mRemap.count} · ${revDelta} px differ · NOTE an absolute edge position is not measurable in this framing: frontView(0.8) fits this fixture edge to edge on the ${inkAll.w}px canvas, mark bbox x ${x0}..${x1}`,
  )
  await setDrawIn({})
  await setWindow({ mode: "grow" })

  /* ---- 12 · THE FILMED CLAIM — INK COMES OFF THE PAGE --------------------
   *
   * Step 2's filmed claim was that `overlap > 0` puts two pen tips on the page
   * at once, measured as the SEPARATION of the growing places. Step 3's is a
   * different claim and it needs a different quantity: a prefix can only ever
   * ADD ink, so what a window has to show is ink being REMOVED — and removed
   * somewhere ELSE than it is being added, which is what makes it a travelling
   * segment rather than a mark that fades.
   *
   * Both arms are measured over the same beat window on the same fixture with
   * only the mode moved, and the floor is the mark's own diagonal rather than a
   * pixel constant, exactly as step 2's is. */
  const edge = {}
  for (const [key, patch] of [
    ["grow", { mode: "grow" }],
    ["travel", { mode: "travel", length: 0.25 }],
  ]) {
    await setWindow(patch)
    await seekBeat(0.45)
    const f0 = await pixels(await grab(`edge-${key}-a.png`))
    await seekBeat(0.6)
    const f1 = await pixels(await grab(`edge-${key}-b.png`))
    const g = growthComponents(f0, f1, emptyI)
    const s = shrinkComponents(f0, f1, emptyI)
    const sep =
      g.cx !== null && s.cx !== null ? Math.round(Math.hypot(g.cx - s.cx, g.cy - s.cy)) : 0
    edge[key] = { grew: g.grewPx, shrank: s.grewPx, sep, gc: g.count, sc: s.count }
  }
  await setWindow({ mode: "grow" })
  say(
    edge.grow.shrank < 400,
    "at GROW nothing comes off the page — a prefix can only add, and the raster says so",
    `${edge.grow.grewPx ?? edge.grow.grew} px added, ${edge.grow.shrank} px removed, ${edge.grow.sc} shrinking places`,
  )
  say(
    edge.travel.shrank > 2000 &&
      edge.travel.sc >= 1 &&
      edge.travel.sep >= SEP_FLOOR,
    "at TRAVEL ink is coming OFF the page while other ink goes ON, and the two edges are FAR APART",
    `${edge.travel.grew} px added and ${edge.travel.shrank} px removed in the same beat window · edges ${edge.travel.sep}px apart vs floor ${SEP_FLOOR.toFixed(0)}px (mark diag ${markDiag.toFixed(0)}px) · grow arm removed ${edge.grow.shrank} px`,
  )

  /* ---- 13 · ROUND TRIP, THE WINDOW'S OWN ---------------------------------
   *
   * Step 2's round trip proved a schedule can be undone. Step 3's has to prove
   * the same for the window on EVERY engine, because the window touches four
   * things a schedule does not: `setDrawRange`'s offset, a second uniform, the
   * rebuild clip's near end, and Rod's ring offset. Any one of them left set
   * would leave the default rendering a window nobody asked for. */
  const winRoundTrip = []
  for (const eng of ENGINES) {
    await setEngine(eng)
    await setDrawIn({})
    await setWindow({ mode: "grow" })
    await seek(0.44)
    const a = await grab(`win-rt-${eng.key}-before.png`)
    await setWindow({ mode: "travel", length: 0.3 })
    await seek(0.44)
    const mid = await grab(`win-rt-${eng.key}-travel.png`)
    await setDrawIn({ reverse: "all" })
    await seek(0.44)
    const rev = await grab(`win-rt-${eng.key}-rev.png`)
    await setWindow({ mode: "grow" })
    await setDrawIn({})
    await seek(0.44)
    const b = await grab(`win-rt-${eng.key}-after.png`)
    winRoundTrip.push({
      engine: eng.key,
      same: sha(a) === sha(b),
      moved: sha(a) !== sha(mid),
      revMoved: sha(a) !== sha(rev),
      a: sha(a),
      b: sha(b),
    })
  }
  const wrtBad = winRoundTrip.filter((r) => !r.same)
  say(
    wrtBad.length === 0,
    "WINDOW ROUND TRIP — grow → travel → reverse → back gives the BYTE-IDENTICAL default render, every engine",
    wrtBad.length
      ? wrtBad.map((r) => `${r.engine} ${r.a}!=${r.b}`).join(" · ")
      : `${winRoundTrip.length}/${winRoundTrip.length} engines`,
  )
  const wrtStill = winRoundTrip.filter((r) => !r.moved || !r.revMoved)
  say(
    wrtStill.length === 0,
    "…and NON-VACUOUSLY — `travel` and `reverse` each moved the picture on every engine first",
    wrtStill.length
      ? `did NOT move: ${wrtStill.map((r) => `${r.engine}${r.moved ? "" : " travel"}${r.revMoved ? "" : " reverse"}`).join(", ")}`
      : `${winRoundTrip.length}/${winRoundTrip.length} engines moved under both`,
  )
  await setEngine(inflate)

  /* ═══ 14 · 🔴 THE HARNESS SETTER THAT VALIDATED NOTHING ══════════════════
   *
   * WHY THIS LIVES ON THIS GATE. `__captureHarness.setFlatten` used to return
   * `true` for `{__laneDBogus: 0}` — a key that cannot exist — because
   * `Partial<FlatState>` is a COMPILE-TIME type and the object crosses a
   * `page.evaluate` boundary as JSON. That is not a latent hazard; it already
   * published a verdict. Explainer 24 §8: two of the twelve rows in that file's
   * most-cited ruled-out table **measured nothing**, one of them because the arm
   * set `flat`, which is not on `FlatState` at all, and the row reported
   * *"not it"* about a path it had never touched.
   *
   * §8 item 4 names the row this has to come with, and names it as the reason
   * the change survives: *"a sweep row that calls `setFlatten({<a key that
   * cannot exist>: 0})` and REQUIRES `false`. The negative control is the point
   * of the change; without the row the change is one refactor away from being
   * reverted."*
   *
   * THREE ROWS, NOT ONE, AND THE SECOND TWO ARE WHAT MAKE THE FIRST MEAN
   * ANYTHING:
   *
   *   · the REJECT row is the control §8 asks for;
   *   · the ACCEPT row is the other half, and it is the one a lazy fix fails —
   *     a blanket `typeof v === "number"` passes the reject row and silently
   *     breaks `color` (a string) and `letters` (an array of objects). §8 calls
   *     that *"the 'widen an exemption, never the rule' trap in the other
   *     direction — a validator that is wrong about a real key gets deleted the
   *     first time it blocks someone."* All THIRTEEN are driven, one at a time;
   *   · the PIXEL row proves the refusal actually refused. A rejected object
   *     must move ZERO pixels — and that reading is worthless on its own,
   *     because a blind comparison also reads zero. So it is paired with a
   *     calibration: the SAME object minus the impossible key, which must move
   *     pixels through the same comparison in the same session.
   *
   * ⚠ THE FIRST CALIBRATION ARM WAS `{depth: 1}` — the retracted row's own valid
   * half — AND IT MEASURES NOTHING HERE. Measured on `/` at playhead 0.50:
   * `depth 1` moves **0 px**, because the host already renders this surface at
   * depth 1, so the arm asks for the state it is already in. `ink 0`,
   * `penCarve 1` and `lit 0` are at the floor here too; `depth 0.004` (43 444),
   * `ink 1` (44 058), `shade 0.6` (44 045), `yaw 25` (41 895) and `squashY 0.7`
   * (75 122) all act. That is explainer 24 §8's own closing sentence arriving
   * from underneath — *"a 0-change reading cannot distinguish 'the arm did not
   * reach the render' from 'the state was already what the arm asked for'"* —
   * and it caught this row on its first run. The pair is now `{flat: 0, ink: 1}`
   * refused against `{ink: 1}` accepted, which is the same SHAPE as the
   * historical defect (an impossible key beside a real one that does act) with a
   * calibration that cannot read zero for the wrong reason.
   */
  await page.evaluate(() => window.__captureHarness.setFlatten(null))
  await settle()

  /* One round trip: every value is built IN PAGE, because `NaN`, `Infinity` and
   * an own key set to `undefined` do not all survive a JSON boundary intact —
   * and a control whose bad input was laundered on the way in is not a control. */
  const flatArms = await page.evaluate(() => {
    const H = window.__captureHarness
    const out = []
    const run = (label, kind, make) => {
      let got
      try {
        got = H.setFlatten(make())
      } catch (e) {
        got = `THREW: ${String(e).slice(0, 80)}`
      }
      H.setFlatten(null)
      out.push({ label, kind, got, ok: got === (kind === "accept") })
    }

    /* `null` MEANS CLEAR — the documented contract at the setter, which callers
     * rely on and which a key check must not eat. */
    run("null (the documented clear)", "accept", () => null)

    /* All thirteen, one at a time, with a legal value for that key's KIND. */
    const legal = {
      ink: 0.5,
      depth: 0.5,
      yaw: 10,
      pitch: 10,
      shade: 0.3,
      shadow: 0.4,
      squashX: 1.1,
      squashY: 0.9,
      jointBreak: 1,
      penCarve: 0.5,
      lit: 1,
      color: "#123456",
      letters: [
        { yaw: 0, flat: 0, depth: 1, shade: 0 },
        { yaw: 5, flat: 1, depth: 0, shade: 0.2, settle: 0.5 },
      ],
    }
    for (const k of Object.keys(legal)) run(k, "accept", () => ({ [k]: legal[k] }))

    /* THE ROW §8 REQUIRES. */
    run("__laneMBogus (a key that cannot exist)", "reject", () => ({ __laneMBogus: 0 }))
    /* …and the historical one, by name. `flat` is what the retracted row set. */
    run("flat (the retracted row's own key)", "reject", () => ({ flat: 0 }))
    run("flat + depth (the retracted PAIR, refused whole)", "reject", () => ({ flat: 0, depth: 1 }))

    /* A real key carrying the wrong KIND of value. */
    run("ink: \"0\" (a string on a numeric key)", "reject", () => ({ ink: "0" }))
    run("ink: NaN", "reject", () => ({ ink: NaN }))
    run("depth: Infinity", "reject", () => ({ depth: Infinity }))
    run("color: 0 (a number on the STRING key)", "reject", () => ({ color: 0 }))
    run("letters: 3 (a number on the ARRAY key)", "reject", () => ({ letters: 3 }))
    run("letters: [{yaw}] (a malformed entry)", "reject", () => ({ letters: [{ yaw: 0 }] }))
    run("[] (an array as the whole object)", "reject", () => [])
    return out
  })

  const flatAccept = flatArms.filter((a) => a.kind === "accept")
  const flatReject = flatArms.filter((a) => a.kind === "reject")
  const flatAcceptBad = flatAccept.filter((a) => !a.ok)
  const flatRejectBad = flatReject.filter((a) => !a.ok)
  const flatBogus = flatArms.find((a) => a.label.startsWith("__laneMBogus"))

  say(
    flatBogus?.got === false,
    "🔴 `setFlatten({<a key that cannot exist>: 0})` returns FALSE — explainer 24 §8's required row",
    `returned ${JSON.stringify(flatBogus?.got)}; before this change it returned true, which is how {flat: 0} became a published verdict`,
  )
  say(
    flatRejectBad.length === 0,
    "…and every other malformed object is refused too — an unknown key, a wrong-KIND value, a malformed letter",
    flatRejectBad.length
      ? `ACCEPTED and should not have: ${flatRejectBad.map((a) => `${a.label}→${JSON.stringify(a.got)}`).join(" | ")}`
      : `${flatReject.length}/${flatReject.length} refused`,
  )
  say(
    flatAcceptBad.length === 0,
    "…and the sweep still ACCEPTS all THIRTEEN real keys plus `null` — including the two that are not numbers",
    flatAcceptBad.length
      ? `REFUSED a real key: ${flatAcceptBad.map((a) => `${a.label}→${JSON.stringify(a.got)}`).join(" | ")}`
      : `${flatAccept.length}/${flatAccept.length} accepted (11 numeric + color:string + letters:object[] + null)`,
  )

  /* The pixel half, with its calibration beside it. */
  await page.evaluate(() => window.__captureHarness.setFlatten(null))
  await settle()
  const flatBase = await pixels(await grab("flatvalidate-base.png"))
  await page.evaluate(() => window.__captureHarness.setFlatten({ flat: 0, ink: 1 }))
  await settle()
  const flatRefused = await pixels(await grab("flatvalidate-refused.png"))
  await page.evaluate(() => window.__captureHarness.setFlatten(null))
  await settle()
  await page.evaluate(() => window.__captureHarness.setFlatten({ ink: 1 }))
  await settle()
  const flatCalib = await pixels(await grab("flatvalidate-calibration.png"))
  await page.evaluate(() => window.__captureHarness.setFlatten(null))
  await settle()

  const refusedPx = differingPixels(flatBase, flatRefused, 2)
  const calibPx = differingPixels(flatBase, flatCalib, 2)
  say(
    refusedPx === 0,
    "…and a REFUSED object sets nothing — the render is unchanged, to the pixel",
    `{flat: 0, ink: 1} moved ${refusedPx} px (needs 0). Before the fix this arm applied its valid half and moved the mark while the row reported a verdict about \`flat\``,
  )
  say(
    calibPx > 0,
    "…CALIBRATED — the SAME comparison sees `{ink: 1}` alone, so the zero above is a refusal and not a blind read",
    `${calibPx} px (needs > 0). ⚠ \`{depth: 1}\` — the retracted row's own valid half — reads 0 px here because the host already renders at depth 1, which is the "already what the arm asked for" floor and is why this arm is \`ink\``,
  )

  /* ---- THE KNOWN-BAD: the setter that shipped, re-armed --------------------
   * Not a synthetic mutant. `setFlattenValidates(false)` IS the code that
   * published the retracted row, parked so the defect stays re-renderable — and
   * armed HERE, inline, so the control runs on the bare invocation rather than
   * behind a flag no sweep passes (explainer 31 §1: *"the machinery that proves
   * this repo's instruments can fail is the machinery no sweep runs"*). */
  const kbTook = await page.evaluate(() => {
    const H = window.__captureHarness
    if (!H.setFlattenValidates) return null
    const before = H.flattenValidates()
    H.setFlattenValidates(false)
    return { before, after: H.flattenValidates() }
  })
  say(
    kbTook !== null && kbTook.before === true && kbTook.after === false,
    "the setFlatten known-bad ACTUALLY TOOK — a control that silently refuses proves nothing",
    kbTook === null
      ? "`setFlattenValidates` is absent — the parked prior is unreachable, so §14's rows have never been shown able to fail"
      : `validates ${kbTook.before} -> ${kbTook.after}`,
  )
  const kbBogus = await page.evaluate(() => {
    const H = window.__captureHarness
    const r = H.setFlatten({ __laneMBogus: 0 })
    H.setFlatten(null)
    return r
  })
  await page.evaluate(() => window.__captureHarness.setFlatten({ flat: 0, ink: 1 }))
  await settle()
  const kbFrame = await pixels(await grab("flatvalidate-knownbad.png"))
  await page.evaluate(() => window.__captureHarness.setFlatten(null))
  await page.evaluate(() => window.__captureHarness.setFlattenValidates(true))
  await settle()
  const kbPx = differingPixels(flatBase, kbFrame, 2)
  say(
    kbBogus === true && kbPx > 0,
    "…🔴 and the KNOWN-BAD REPRODUCES THE DEFECT — the shipped setter accepts an impossible key AND applies the valid half behind it",
    `setFlatten({__laneMBogus: 0}) returned ${JSON.stringify(kbBogus)} (needs true) · {flat: 0, ink: 1} moved ${kbPx} px (needs > 0) while returning true — that is the retracted row, exactly: an arm that set nothing it was asked about, moved the mark, and published "not it"`,
  )
  const kbRestored = await page.evaluate(() => window.__captureHarness.flattenValidates())
  say(
    kbRestored === true,
    "…and the known-bad was DISARMED before anything else was measured",
    `validates back to ${kbRestored}`,
  )

  /* ═══ 15 · 🔴 THE CAPTURE KNOWS WHAT IT CAPTURED ═════════════════════════
   *
   * On 2026-08-07 `_probe-stroke-schedule.mjs`'s THIRD film take wrote seven
   * frames at **1584×1468** into a directory of 799×1468 frames — the last
   * seven of the last take. No page error, no GL warning, no exception. The
   * loop asked for a frame, got a frame, and wrote it under the filename it had
   * planned; it was found by listing the directory.
   *
   * WHY THAT IS THIS GATE'S BUSINESS AND NOT A HOUSEKEEPING NOTE. Every raster
   * row above is a comparison of two frames — `iou`, `differingPixels`,
   * `maskOps` — and all three walk the FIRST buffer's length. Hand them frames
   * of two different sizes and nothing throws: the comparison silently runs to
   * the shorter one and reads a different pixel at every index past the first
   * row. A byte-identity row would go red for a reason that has nothing to do
   * with its subject, and a set-algebra row would go GREEN on garbage. **The
   * frames being one size is a precondition of every number on this gate**, and
   * until now nothing checked it.
   *
   * The row costs one integer per grab. That it never fired before is not
   * evidence it could not — 360 frames of a deliberate reproduction did not
   * reproduce it either.
   */
  const grabSizes = Object.keys(grabCensus.sizes)
  say(
    rasterGuard.mismatches.length === 0,
    "🔴 not one raster comparison in this run compared two DIFFERENT-SHAPED frames — every helper walks the first buffer and would read one-sided in silence",
    rasterGuard.mismatches.length
      ? `${rasterGuard.mismatches.length} of ${rasterGuard.comparisons} comparisons crossed a size boundary and every number derived from them is VOID: ${rasterGuard.mismatches.slice(0, 4).join(" | ")}`
      : `${rasterGuard.comparisons} comparisons, 0 mismatches. NOTE the run's grabs are NOT all one size — ${JSON.stringify(grabCensus.sizes)} — because the viewport is a flex child whose height follows the geometry mode's config strip, so switching engines resizes the raster. That is legal; comparing across it is not, and that is what this row holds.`,
  )
  say(
    grabCensus.info !== null && grabCensus.wrongSubject === 0,
    "…and the harness resolves its grab target by IDENTITY, with position still agreeing",
    grabCensus.info === null
      ? "`grabInfo()` is absent — the capture cannot say what it grabbed, which is the state this row exists to end"
      : `firstUnderContainer true on ${grabCensus.n - grabCensus.wrongSubject}/${grabCensus.n} grabs · ` +
        `${grabCensus.info.canvasesUnderContainer} canvas(es) under the viewport container, ` +
        `${grabCensus.info.canvasesInDocument} in the document ` +
        `(the drawing canvas is the other one, and its container's class list is byte-identical to this one's)`,
  )

  /* ═══ 5 · THE DRIVER'S OWN VERDICT ═══════════════════════════════════════ */
  const glBad = consoleAll.filter((c) => /not big enough|INVALID_OPERATION/i.test(c))
  say(glBad.length === 0, "no rejected draws at any dial position", glBad.slice(0, 2).join(" | ") || "0")
  say(pageErrors.length === 0, "no page errors across the whole walk", pageErrors.slice(0, 2).join(" | ") || "0")

  writeFileSync(
    join(OUT, "report.json"),
    JSON.stringify(
      {
        rows,
        engineMoves,
        roundTrip,
        pens,
        seeks,
        tip: { jIdentity, jGood, jBad, tipDelta },
        alignDiff,
        // ---- step 3 ----
        window: {
          panel: winPanel,
          lengthGating,
          drawRangeStarts: { grow: growStarts, travel: travelStarts },
          setSubtraction: { iou: setIoU, vsPrefix: growVsTravel, w: wT, beatErr },
          leading: { unionIoU: jLead, arms: leadArms },
          trailing: { excessOn: exOn, excessOff: exOff, ops, live: trailLive },
          reverse: {
            model: revModel,
            containment: revOps,
            delta: revDelta,
            flags: {
              baked: revArms.baked.flags,
              knownBad: revArms["KNOWNBAD-remap"].flags,
            },
          },
          edges: edge,
          roundTrip: winRoundTrip,
        },
        // ---- §14, the harness setter's own validation ----
        flatValidation: { arms: flatArms, refusedPx, calibPx },
        // ---- §15, what the capture was actually of ----
        grabCensus,
        rasterGuard,
        pageErrors,
        glBad,
      },
      null,
      2,
    ),
  )
  await context.close()
  await browser.close()

  console.log("")
  console.log(pass ? "STROKE SCHEDULE HOLDS" : "STROKE SCHEDULE BROKEN")
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`frames + film: ${FINAL}`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  // A crash is NOT a verdict about the subject — say so rather than letting the
  // exit code be read as "the schedule failed". `assert-gate-integrity` treats a
  // bare `.catch(exit(1))` as un-coupled for exactly this reason.
  console.log("FAIL  the gate itself threw — this is not a measurement of the schedule")
  process.exit(1)
})

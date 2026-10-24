// FORM ORBIT ASSERTIONS — turns the orbit frames into pass/fail.
//
// verify-form-orbit captures; this decides. Per the project rule, each check
// asserts the SIGNATURE OF THE FIX, not "did anything change":
//
//   1. MASS COUNT — Solid must produce as many disjoint masses as the drawing
//      has disjoint marks. Catches BOTH of this pass's Solid bugs at once: the
//      phantom connector bars fused five letters into one mass (count 1, too
//      few), and the largest-component filter dropped four of them (count 1
//      again, from the other direction). Measured on the rendered alpha, not
//      on engine state, so the engine cannot witness itself.
//
//   2. SILHOUETTE SMOOTHNESS — the circle's rendered outline must have no
//      facet ladder. Measured as the distribution of per-vertex turn angle
//      along the traced silhouette: a faceted polygon concentrates turn into
//      a few large steps, a smooth curve spreads it evenly. This is the
//      circle-vs-square pair: the CIRCLE must be smooth AND the SQUARE must
//      still have exactly four sharp corners, so a fix that merely blurs
//      everything fails.
//
//   3. THE SMOOTHER ACTUALLY RAN — window.__contourSmoothDebug counts what
//      happened INSIDE smoothLatticeLoop. Its two guards fall back to the raw
//      staircase; a run where every loop fell back would still produce frames,
//      so the pixel checks are paired with the witness.
//
// Usage: node scripts/verify/assert-form-orbit.mjs --label=after
import { chromium } from "./lib/browser.mjs"
import { existsSync } from "node:fs"
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "after")
const DIR = join(ROOT, "docs", "verification", "form-orbit", LABEL)

let failures = 0
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

/** Read a captured frame's alpha as a boolean occupancy grid. */
async function readAlpha(file) {
  const img = await loadImage(file)
  const width = img.width, height = img.height
  const cv = createCanvas(width, height)
  const ctx = cv.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, width, height).data
  const on = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) on[i] = data[i * 4 + 3] > 40 ? 1 : 0
  return { on, width, height }
}

/** Count 8-connected components of rendered form, ignoring specks. */
function countMasses({ on, width, height }, minPx) {
  const seen = new Uint8Array(width * height)
  const stack = new Int32Array(width * height)
  let masses = 0
  for (let start = 0; start < on.length; start++) {
    if (!on[start] || seen[start]) continue
    let sp = 0
    stack[sp++] = start
    seen[start] = 1
    let size = 0
    while (sp > 0) {
      const p = stack[--sp]
      size++
      const x = p % width
      const y = (p / width) | 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const q = ny * width + nx
          if (on[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q }
        }
      }
    }
    if (size >= minPx) masses++
  }
  return masses
}

/**
 * Trace the outer silhouette of the largest mass and report the per-vertex
 * turn-angle profile, sampled at a stride large enough to see SHAPE rather
 * than pixel quantisation.
 */
function silhouetteTurns({ on, width, height }, stride) {
  // March around the outline by taking, for each row, the leftmost and
  // rightmost lit pixel — enough for the convex-ish fixtures here (circle,
  // square) and immune to interior holes.
  const left = [], right = []
  for (let y = 0; y < height; y++) {
    let lo = -1, hi = -1
    for (let x = 0; x < width; x++) {
      if (on[y * width + x]) { if (lo < 0) lo = x; hi = x }
    }
    if (lo >= 0) { left.push([lo, y]); right.push([hi, y]) }
  }
  if (left.length < 3 * stride) return []
  const ring = [...left, ...right.reverse()]
  const turns = []
  for (let i = stride; i < ring.length - stride; i += stride) {
    const [px, py] = ring[i - stride]
    const [cx, cy] = ring[i]
    const [nx, ny] = ring[i + stride]
    const ax = cx - px, ay = cy - py
    const bx = nx - cx, by = ny - cy
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by)
    if (la < 1e-6 || lb < 1e-6) continue
    let cos = (ax * bx + ay * by) / (la * lb)
    cos = Math.max(-1, Math.min(1, cos))
    turns.push(Math.acos(cos))
  }
  return turns
}

async function main() {
  if (!existsSync(DIR)) {
    console.error(`[assert] no frames at ${DIR} — run verify-form-orbit.mjs --label=${LABEL} first`)
    process.exit(1)
  }

  /* ═══ PROVENANCE · DOES THIS EVIDENCE BELONG TO THIS TREE ═══════════════════
   *
   * ⚠ MEASURED 2026-08-28: `docs/verification/form-orbit/after` is 24.7 days
   * behind the newest source it grades. Sections 1 and 2 below read those
   * `word_solid/0000.png`, `circle_solid/0000.png` and `square_solid/0000.png`
   * frames and print mass counts and corner counts about them.
   *
   * THIS GATE CANNOT RECAPTURE THOSE FRAMES, and `assert-gate-integrity.mjs`
   * does not know that. Channel F classifies it LIVE+STORED and hands it the
   * lenient 1.5-day bar, because section 3 below opens a browser. But section 3
   * reads a LIVE witness — `window.__contourSmoothDebug` — and writes nothing;
   * the frames come from `verify-form-orbit.mjs` and no run of this file
   * refreshes them. Liveness in one section bought leniency for another, which
   * is how 24.7 days of drift read as inside the bar.
   *
   * So the pixel sections are gated on the frames' age and section 3 is not: it
   * is a statement about the running build either way.
   *
   * Subject is all three roots, the same three channel F compares against.
   * `captureFreshness()` is not called because it walks `lib/` alone.
   * DISPATCH §3 — a SKIP is not a pass. */
  {
    const cap = newestCapture(DIR, /\.png$/)
    const subj = ["lib", "app", "components"]
      .map((d) => newestUnder(join(ROOT, d)))
      .filter((x) => x.file)
      .sort((x, y) => y.ms - x.ms)[0]
    const rel = (f) => (f && f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f)
    const stamp = (ms) => new Date(ms).toLocaleString()
    const fresh = Boolean(cap.file) && Boolean(subj?.file) && subj.ms <= cap.ms
    check(
      "PROVENANCE · every frame graded here post-dates every source under lib/ app/ components/",
      fresh,
      cap.file && subj?.file
        ? fresh
          ? `newest frame ${rel(cap.file)} ${stamp(cap.ms)} · newest source ${rel(subj.file)} ${stamp(subj.ms)}`
          : `STALE BY ${((subj.ms - cap.ms) / 3600000).toFixed(1)}h — newest frame ${rel(cap.file)} ${stamp(cap.ms)} ` +
            `but ${rel(subj.file)} was written ${stamp(subj.ms)}. Re-capture with ` +
            `node scripts/verify/verify-form-orbit.mjs --label=${LABEL}; do NOT relax this row.`
        : `no PNGs under ${rel(DIR)}, or no source under lib/ app/ components/ — the comparison cannot be made`,
    )
    if (!fresh) {
      console.log(
        "\n⚠ NO PIXEL VERDICT. The stored orbit frames predate the code they would be\n" +
          "  judging, so the mass and corner readings below would describe a dead build.",
      )
      process.exit(1)
    }
  }

  // ---- 1. MASS COUNT ----
  // "hello" in the capture font is five disjoint marks: h(2 strokes, touching),
  // e, l, l, o. Rendered head-on they must read as five separate masses.
  const wordFile = join(DIR, "word_solid", "0000.png")
  if (existsSync(wordFile)) {
    const img = await readAlpha(wordFile)
    const masses = countMasses(img, 400)
    check(
      "solid / separate marks stay separate masses",
      masses === 5,
      `${masses} masses (expected 5: h e l l o)`,
    )
  } else {
    check("solid / separate marks stay separate masses", false, "frame missing")
  }

  // Extrude is per-stroke geometry and was never affected by the pool bugs —
  // it is the control that says the fixture itself really is five marks.
  const wordExFile = join(DIR, "word_extrude", "0000.png")
  if (existsSync(wordExFile)) {
    const masses = countMasses(await readAlpha(wordExFile), 400)
    check("extrude / control: same fixture reads as 5 marks", masses === 5, `${masses} masses`)
  }

  // ---- 2. SILHOUETTE SMOOTHNESS, AND ITS CONTROL ----
  const circleFile = join(DIR, "circle_solid", "0000.png")
  const squareFile = join(DIR, "square_solid", "0000.png")
  const STRIDE = 6
  // A facet is a turn concentrated at one vertex. On a smooth curve sampled at
  // this stride no single vertex should turn more than ~12°.
  const FACET_RAD = 0.21
  if (existsSync(circleFile)) {
    const turns = silhouetteTurns(await readAlpha(circleFile), STRIDE)
    const facets = turns.filter((t) => t > FACET_RAD).length
    const maxTurn = turns.length ? Math.max(...turns) : 0
    check(
      "solid / circle silhouette has no facet ladder",
      turns.length > 20 && facets <= 2,
      `${facets} vertices over ${FACET_RAD.toFixed(2)} rad, max ${maxTurn.toFixed(3)} (n=${turns.length})`,
    )
  }
  if (existsSync(squareFile)) {
    // The control: smoothing must NOT round the square. Its four corners are
    // real turns and must survive as such.
    const turns = silhouetteTurns(await readAlpha(squareFile), STRIDE)
    const corners = turns.filter((t) => t > 0.6).length
    check(
      "solid / square keeps its corners (smoothing is not a blur)",
      corners >= 2,
      `${corners} sharp corners on the traced silhouette`,
    )
  }

  // ---- 3. THE SMOOTHER ACTUALLY RAN ----
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness, null, { timeout: 30000 })
  await page.evaluate(() => {
    const p = []
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2
      p.push({ x: 440 + Math.cos(t) * 210, y: 360 + Math.sin(t) * 210 })
    }
    window.__styleHarness.injectStrokes([p], { msPerPoint: 10 })
  })
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__styleHarness.setMode("solid"))
  // Wait for a build to actually LAND rather than for a fixed delay. On a cold
  // dev-server compile the first Solid build can arrive seconds after the mode
  // switch, and reading the witness before then reports 0 — which would be an
  // assertion failing on its own timing rather than on the code.
  await page
    .waitForFunction(
      () => (window.__contourSmoothDebug?.smoothed ?? 0) > 0
        || (window.__contourSmoothDebug?.areaFallbacks ?? 0) > 0
        || (window.__contourSmoothDebug?.selfIntersectFallbacks ?? 0) > 0,
      null,
      { timeout: 20000 },
    )
    .catch(() => {})
  const dbg = await page.evaluate(() => window.__contourSmoothDebug ?? null)
  await browser.close()

  check("contour smoother is reachable", dbg !== null, dbg ? "witness present" : "no witness")
  if (dbg) {
    check(
      "contour smoother ran without falling back to the raw staircase",
      dbg.smoothed > 0 && dbg.areaFallbacks === 0 && dbg.selfIntersectFallbacks === 0,
      `smoothed ${dbg.smoothed}, areaFallback ${dbg.areaFallbacks}, selfIntersectFallback ${dbg.selfIntersectFallbacks}`,
    )
    check(
      "decimation collapsed the staircase before smoothing",
      dbg.lastDecimatedPoints > 0 && dbg.lastDecimatedPoints < dbg.lastInPoints * 0.5,
      `${dbg.lastInPoints} -> ${dbg.lastDecimatedPoints} -> ${dbg.lastOutPoints} points`,
    )
  }

  console.log(failures === 0 ? "\nALL FORM-ORBIT ASSERTIONS PASS" : `\n${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

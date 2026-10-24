// ASSERT-DRAWIN-MONOTONE — INK THE PEN HAS LAID DOWN MUST NEVER COME BACK OFF.
//
// ── THE COMPLAINT, VERBATIM ─────────────────────────────────────────────────
//
// Sebs, 2026-08-04, three stepped screenshots of `/desk-doodles` on the DESK
// DOODLES engine at DRAW 61 / 69 / 75 %:
//
//   *"there like artifacts that appear ahead of where the stroke is animating,
//    and if a letter covers another like the d over the o it leaves part of the
//    o just like erased — the o should still be fully drawn but its edge doesnt
//    get drawn on that side."*
//
// ── WHY THAT IS A MODEL QUESTION AND NOT A PIXEL ONE ────────────────────────
//
// A reveal is monotone BY DEFINITION: the inked set at playhead t contains the
// inked set at t − dt. Nothing about lights, materials or the camera bears on
// that, so this asks it of the BUFFERS, in plain node, through the real
// engines. `docs/DISPATCH.md` §1.5 — name the in-repo implementation and use
// it: `lib/engine-registry.ts` resolves (mode, family), `lib/pen-reveal.ts`
// owns the clip, and `_hero-word.mjs` builds the word the page renders.
//
// ── THE TWO MECHANISMS, BOTH RUN, ONE REQUIRED TO FAIL ──────────────────────
//
//   SHIPPED   build ONCE from the full strokes; every mesh carries
//             `revealKeys`, a per-triangle global arc position, ascending, with
//             the index buffer sorted to match. The playhead is a binary search
//             and a `setDrawRange` — the prefix of a buffer that never changes.
//             (lib/implicit-surface.ts §6 for Free Stroke; lib/dd-engine's
//             `bakeRevealKeys` for Desk Doodles, added 2026-08-04.)
//
//   PRIOR     REBUILD from an arc-length-clipped copy
//             (`filterStrokesByProgress`). This is the mechanism the Desk
//             Doodles engine used until 2026-08-04 and it is this gate's
//             KNOWN-BAD INPUT — §2.6, "calibrate the instrument against a
//             known-bad input and require it to fail." It is not a synthetic
//             mutant: it is the code that shipped, still in the tree, still
//             driving Solid and Extrude, and it is REQUIRED to be rejected
//             here. A gate whose negative control passes is measuring nothing.
//
// ── WHY THE PRIOR MECHANISM LOSES INK, NAMED SO THE ROW MEANS SOMETHING ─────
//
// Nothing fuses on the Desk Doodles path — every stroke is its own mesh — so a
// neighbouring letter cannot reach into the `o`. What reaches into it is the
// stroke's OWN builder: `lib/dd-engine/strokeTo3d.ts` `buildInflateGeometry`
// parametrises its radius profile on normalised position along the polyline it
// is HANDED (`u = i / segments`, `r = tip + (base − tip)·sin(πu)^0.8`), clamps
// `baseRadius` to `arcLen × INFLATE_MAX_BASE_TO_LENGTH`, sizes its ring count
// from `pts.length`, and synthesises pressure from that polyline's curvature.
// Hand it a growing prefix and it re-shapes every millimetre of ink already on
// the page, every frame.
//
// gate-integrity: differential — both arms are built by the SAME engine from the
// SAME constants, so every published value of `lib/dd-engine/strokeTo3d.ts` and
// `lib/geometry-engines.ts` moves the shipped arm and the known-bad arm
// together. That is the point: the claim is "a prefix of a fixed buffer cannot
// reshape what is behind it, and a rebuild from a growing clip can", and it is
// true at any radius, any profile exponent and any ring count. The two names
// this gate writes down that channel D can reach — `SOLID_DEBUG.canvasWidth` and
// `.canvasHeight` — are not constants it asserts on at all; they are the two
// PARAMETER names `GeometryEngine.buildPreview` requires, and the module's
// same-named debug fields are overwritten at every build, so no value of either
// can decide any row here or anywhere else.
//
// Usage:  node scripts/verify/assert-drawin-monotone.mjs
//         [--steps=40] [--grid=1500] [--verbose]
import { loadTs } from "./_ts-load.mjs"
import * as HW from "./_hero-word.mjs"

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const STEPS = Math.max(4, parseInt(arg("steps", "40"), 10))
const GRID = Math.max(200, parseInt(arg("grid", "1500"), 10))
const VERBOSE = process.argv.includes("--verbose")

const { getEngineFor } = loadTs("lib/engine-registry.ts")
const { ENGINE_FAMILIES } = loadTs("lib/engine-registry.ts")
const { REGISTERS, REGISTER_ORDER } = loadTs("lib/registers.ts")
const { filterStrokesByProgress } = loadTs("lib/pen-reveal.ts")
const G = loadTs("lib/geometry-engines.ts")

let pass = true
let rows = 0
const say = (ok, label, detail) => {
  rows++
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/* ---- HIS STATE, and the word the page actually renders --------------------
 *
 * wobble 0 and endpoint CLEAN are the two dials in his screenshots, and they
 * are also the pair the eraser bug needed (MORNING-BRIEF §1) — a build that is
 * only ever exercised at defaults is a build nobody has used. */
const HAND_FEEL = { wobble: 0, endpoint: "clean", inkWidth: HW.HERO_INK_WIDTH_PX }
const strokes = HW.processedHeroStrokes(HAND_FEEL)

/* The canvas the hero mounts at: `viewport-3d.tsx` takes `innerWidth / 2` and
 * `innerHeight - 48`, and the capture rule is a >= 1440 square stage. The exact
 * numbers do not matter to a monotonicity question — both arms use the same
 * pair — but they are stated rather than invented. */
const CW = 800
const CH = 1552

/** The hero's own Inflate params. Mirrored, and the mirror is CHECKED — the
 *  same discipline `_hero-word.mjs` applies to the three settings it restates. */
const HERO_INFLATE = { fusion: "implicit", blend: 0.45, resolution: 5 }
{
  const { readFileSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { ROOT } = await import("./_ts-load.mjs")
  const src = readFileSync(join(ROOT, "app/desk-doodles/page.tsx"), "utf8")
  const want = [
    [`fusion: "${HERO_INFLATE.fusion}"`, "fusion"],
    [`blend: ${HERO_INFLATE.blend}`, "blend"],
    [`resolution: ${HERO_INFLATE.resolution}`, "resolution"],
  ]
  const missing = want.filter(([needle]) => !src.includes(needle)).map(([, w]) => w)
  say(
    missing.length === 0,
    "HERO_INFLATE still matches app/desk-doodles/page.tsx",
    missing.length ? `moved: ${missing.join(", ")}` : `fusion ${HERO_INFLATE.fusion} · blend ${HERO_INFLATE.blend} · res ${HERO_INFLATE.resolution}`,
  )
}

const params = {
  canvasWidth: CW,
  canvasHeight: CH,
  solidParams: G.DEFAULT_SOLID_PARAMS,
  extrudeParams: G.DEFAULT_EXTRUDE_PARAMS,
  inflateParams: { ...G.DEFAULT_INFLATE_PARAMS, ...HERO_INFLATE },
}

/* ---- THE SET THIS GATE COVERS, ENUMERATED FROM THE SOURCE OF TRUTH --------
 *
 * Channel E of `assert-gate-integrity` exists because hand-written lists stop
 * mirroring the closed set they claim to cover — a four-film list against a
 * seven-film panel shipped two films unwatched. So the families come from
 * `ENGINE_FAMILIES` and the mode comes from the REGISTERS' own `defaultMode`,
 * and the count is asserted rather than assumed. */
const FAMILIES = ENGINE_FAMILIES.map((f) => f.value)
const MODES = [...new Set(REGISTER_ORDER.map((id) => REGISTERS[id].defaultMode))]
say(
  FAMILIES.length >= 2 && MODES.length >= 1,
  "the set under test is enumerated from ENGINE_FAMILIES and REGISTERS, not hand-listed",
  `${FAMILIES.length} families × ${MODES.length} mode(s): ${FAMILIES.join(", ")} × ${MODES.join(", ")}`,
)

/* ---- RASTERISER — the XY silhouette of a triangle set --------------------
 *
 * The draw beat drives the mark to near-zero depth, so what a viewer reads is
 * the filled silhouette. Projecting to XY and filling every triangle is that
 * silhouette exactly, and it is the only projection under which "did ink
 * disappear" is a question about the object rather than about a camera. */
function bbox(meshes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const m of meshes) {
    const g = m.tubeGeometry
    if (!g) continue
    const a = g.getAttribute("position")
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i), y = a.getY(i)
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return { x0, y0, x1, y1 }
}

function makeGrid(box, across) {
  const w = box.x1 - box.x0
  const h = box.y1 - box.y0
  const s = (across - 2) / Math.max(w, h)
  return { box, s, W: Math.max(2, Math.ceil(w * s) + 2), H: Math.max(2, Math.ceil(h * s) + 2) }
}

/**
 * @param {Array<{geo:any, count:number}>} draws  geometry + how many INDICES to draw
 *        — exactly the `setDrawRange(0, count)` the viewport issues.
 */
function raster(draws, gr) {
  const { box, s, W, H } = gr
  const m = new Uint8Array(W * H)
  for (const d of draws) {
    const a = d.geo.getAttribute("position")
    const idx = d.geo.getIndex()
    const n = Math.min(d.count, idx ? idx.count : a.count)
    for (let t = 0; t + 2 < n; t += 3) {
      const i0 = idx ? idx.getX(t) : t
      const i1 = idx ? idx.getX(t + 1) : t + 1
      const i2 = idx ? idx.getX(t + 2) : t + 2
      const ax = (a.getX(i0) - box.x0) * s + 1, ay = (a.getY(i0) - box.y0) * s + 1
      const bx = (a.getX(i1) - box.x0) * s + 1, by = (a.getY(i1) - box.y0) * s + 1
      const cx = (a.getX(i2) - box.x0) * s + 1, cy = (a.getY(i2) - box.y0) * s + 1
      const den = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
      if (!(Math.abs(den) > 1e-12)) continue
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)))
      const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)))
      const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)))
      const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)))
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5
          const w0 = ((bx - ax) * (py - ay) - (px - ax) * (by - ay)) / den
          const w1 = ((px - ax) * (cy - ay) - (cx - ax) * (py - ay)) / den
          if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue
          m[y * W + x] = 1
        }
      }
    }
  }
  return m
}

/** The lower bound `AnimatedStrokes` runs on `revealKeys`, verbatim in shape. */
function trianglesUpTo(keys, front) {
  let lo = 0
  let hi = keys.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (keys[mid] <= front) lo = mid + 1
    else hi = mid
  }
  return lo
}

/* ---- THE TWO MECHANISMS, AS FUNCTIONS OF THE DISTANCE FRACTION -----------
 *
 * The playhead is swept in DISTANCE, which is what both mechanisms consume:
 * `revealDistanceFraction` sits upstream of both and is monotone in time, so
 * sweeping distance tests the mechanisms without also testing the pen clock.
 *
 * The `setDrawRange` arm deliberately takes NO front margin. The shipped
 * margin (`radiusArc × max(2, nose + 1)`) is a cheap cull in FRONT of the real
 * boundary, which is `applyPenTip`'s fragment test — a GPU thing this file
 * cannot run. Including it would only ever draw MORE, so it cannot rescue a
 * failing arm; leaving it out measures the boundary a viewer sees.
 */
function shippedDraws(meshes, frac) {
  const out = []
  for (const m of meshes) {
    const geo = m.tubeGeometry
    if (!geo) continue
    const total = geo.getIndex() ? geo.getIndex().count : geo.getAttribute("position").count
    if (!m.revealKeys || m.revealKeys.length === 0) return null
    const count = frac >= 1 ? total : frac <= 0 ? 0 : Math.min(trianglesUpTo(m.revealKeys, frac) * 3, total)
    out.push({ geo, count })
  }
  return out
}

function priorDraws(engine, frac) {
  const clipped = filterStrokesByProgress(strokes, frac)
  const meshes = engine.buildPreview(clipped, params)
  return meshes
    .filter((m) => m.tubeGeometry)
    .map((m) => ({
      geo: m.tubeGeometry,
      count: m.tubeGeometry.getIndex()
        ? m.tubeGeometry.getIndex().count
        : m.tubeGeometry.getAttribute("position").count,
    }))
}

/**
 * WORST IS TRACKED AS A FRACTION OF THE STANDING INK, not as a raw cell count,
 * and the difference is not cosmetic. The raw count peaks late — there is
 * simply more mark on the page to take ink off — while what a viewer notices is
 * a bite out of the small amount of word that exists at the time. Measured on
 * the Desk Doodles rebuild arm: the worst COUNT is 1061 cells at 90 → 92.5 %,
 * which is 1.09 %; the worst FRACTION is 386 cells at 2.5 → 5.0 %, which is
 * **16.07 %** of everything drawn. Reporting the count alone would have made
 * the defect look ten times smaller than it is.
 */
function sweep(label, drawsAt, gr) {
  let prev = null
  let worst = { lost: 0, of: 0, frac: 0, at: "—" }
  let steps = 0
  let lossy = 0
  let lastInk = 0
  for (let k = 0; k <= STEPS; k++) {
    const frac = k / STEPS
    const m = raster(drawsAt(frac), gr)
    let ink = 0
    for (let i = 0; i < m.length; i++) ink += m[i]
    if (prev) {
      let lost = 0
      for (let i = 0; i < m.length; i++) if (prev.m[i] && !m[i]) lost++
      steps++
      if (lost > 0) lossy++
      const f = prev.ink > 0 ? lost / prev.ink : 0
      const at = `${(((k - 1) / STEPS) * 100).toFixed(1)} % → ${(frac * 100).toFixed(1)} %`
      if (f > worst.frac) worst = { lost, of: prev.ink, frac: f, at }
      if (VERBOSE && lost > 0) {
        console.log(`      ${label}  ${at}   standing ${prev.ink}   LOST ${lost}  (${(f * 100).toFixed(2)} %)`)
      }
    }
    lastInk = ink
    prev = { m, ink }
  }
  return { worst, steps, lossy, lastInk, final: prev.m }
}

/* ---- RUN ---------------------------------------------------------------- */
const summary = []
for (const family of FAMILIES) {
  for (const mode of MODES) {
    const engine = getEngineFor(mode, family)
    const full = engine.buildPreview(strokes, params)
    const gr = makeGrid(bbox(full), GRID)
    const tag = `${family} · ${mode}`

    /* WHICH MECHANISM THE APP WOULD ACTUALLY RUN, decided the way the app
     * decides it. `inflateRevealsByDrawRange` in components/viewport-3d.tsx is
     * not a family name — it is STATE the built meshes correct: "revealKeys is
     * not a request, it is a thing the built surface either has or has not."
     * So this reads the same evidence off the same meshes, and when a family
     * has no table the sweep below runs the REBUILD, because that is what the
     * viewport falls back to. A gate that stopped here would report "no table"
     * where the thing Sebs sees is "the ink came off". */
    const carries = full.length > 0 && full.every((m) => m.revealKeys && m.revealKeys.length > 0)
    say(
      carries,
      `${tag} — every mesh carries a reveal table, so the shipped reveal is a setDrawRange`,
      `${full.length} mesh(es), ${full.filter((m) => m.revealKeys?.length).length} with keys` +
        (carries ? "" : " → the viewport falls back to REBUILD-FROM-CLIPPED"),
    )

    /* THE TABLE IS ASCENDING AND SPANS THE WHOLE WORD. A table that is flat, or
     * that stops short, would make every arm below trivially monotone. */
    let ascending = true
    let lo = Infinity
    let hi = -Infinity
    for (const m of full) {
      const k = m.revealKeys
      if (!k || !k.length) continue
      for (let i = 1; i < k.length; i++) if (k[i] < k[i - 1]) ascending = false
      if (k[0] < lo) lo = k[0]
      if (k[k.length - 1] > hi) hi = k[k.length - 1]
    }
    if (!carries) {
      lo = 0
      hi = 1
      ascending = true
    }
    say(ascending, `${tag} — the reveal table is ASCENDING`, ascending ? "no inversion" : "INVERTED")
    /* THE TAIL TOLERANCE IS MEASURED, NOT PICKED, and it is one percent of the
     * word for one reason: the implicit path's key is a per-triangle MAX over
     * its three vertices of the NEAREST CAPSULE's arc, so the triangles at the
     * very end of the mark can key a few capsules short of 1. Measured on the
     * hero word 2026-08-04: Desk Doodles reaches 1.0000 exactly (its key is the
     * builder's own curve parameter) and Free Stroke reaches 0.9969 — 0.31 %,
     * about three capsules on a 1009-segment word.
     *
     * A short tail cannot leave ink undrawn, and that is asserted rather than
     * argued two rows below: `frac >= 1` short-circuits to the full index count
     * in `AnimatedStrokes`, and "the finished reveal IS the static mark" checks
     * the result at zero cells. This row's job is only to catch a table that has
     * been TRUNCATED — one that stops at half the word would sail through every
     * other row here, because a reveal that never reaches its end is perfectly
     * monotone. */
    say(
      lo <= 0.01 && hi >= 0.99,
      `${tag} — the table spans the whole word`,
      `${lo.toFixed(4)} … ${hi.toFixed(4)} (tail short by ${((1 - hi) * 100).toFixed(2)} %)`,
    )

    const drawsAt = carries ? (f) => shippedDraws(full, f) : (f) => priorDraws(engine, f)
    const how = carries ? "setDrawRange" : "rebuild-from-clipped"
    const shipped = sweep(tag, drawsAt, gr)
    say(
      shipped.worst.lost === 0,
      `${tag} — SHIPPED (${how}): ink already drawn NEVER comes back off`,
      shipped.worst.lost === 0
        ? `0 cells lost on any of ${shipped.steps} steps (grid ${gr.W}×${gr.H})`
        : `${shipped.lossy} of ${shipped.steps} steps lose ink, worst ${(shipped.worst.frac * 100).toFixed(2)} % of the standing ink (${shipped.worst.lost} of ${shipped.worst.of} cells) at ${shipped.worst.at}`,
    )

    /* THE REVEAL HAS TO MOVE. A gate that only asks "did anything disappear"
     * passes an arm that draws nothing at all, and passes an arm that draws
     * everything from frame one — which is the exact defect
     * `assert-drawin-parity` was written for ("the word just auto appears"). */
    const startEmpty = raster(drawsAt(0), gr).reduce((a, b) => a + b, 0)
    const midInk = raster(drawsAt(0.5), gr).reduce((a, b) => a + b, 0)
    say(
      startEmpty === 0 && midInk > 0 && midInk < shipped.lastInk * 0.85,
      `${tag} — and the reveal actually TRAVELS`,
      `0 % → ${startEmpty} cells · 50 % → ${midInk} · 100 % → ${shipped.lastInk}`,
    )

    /* THE FINAL FRAME IS THE STATIC PREVIEW. `setDrawRange` at the full count
     * draws every triangle of the same buffer the static build produces, so
     * this is a check that the reveal reordered the index buffer and did not
     * LOSE any of it. */
    const staticMask = raster(
      full.filter((m) => m.tubeGeometry).map((m) => ({
        geo: m.tubeGeometry,
        count: m.tubeGeometry.getIndex().count,
      })),
      gr,
    )
    let missing = 0
    for (let i = 0; i < staticMask.length; i++) if (staticMask[i] && !shipped.final[i]) missing++
    say(missing === 0, `${tag} — the finished reveal IS the static mark`, `${missing} cells missing`)

    /* ---- THE NEGATIVE CONTROL ------------------------------------------- */
    const prior = sweep(`${tag} PRIOR`, (f) => priorDraws(engine, f), gr)
    summary.push({
      tag,
      shipped: shipped.worst.frac * 100,
      shippedLossy: shipped.lossy,
      prior: prior.worst.frac * 100,
      priorLossy: prior.lossy,
      steps: prior.steps,
    })
    say(
      prior.worst.lost > 0,
      `${tag} — KNOWN-BAD (rebuild from a clipped copy) is REJECTED`,
      prior.worst.lost > 0
        ? `${prior.lossy} of ${prior.steps} steps lose ink, worst ${(prior.worst.frac * 100).toFixed(2)} % (${prior.worst.lost} of ${prior.worst.of} cells) at ${prior.worst.at}`
        : "the known-bad passed, so this gate is measuring nothing",
    )
  }
}

console.log("")
for (const s of summary) {
  console.log(
    `  ${s.tag.padEnd(24)}  SHIPPED ${String(s.shippedLossy).padStart(2)}/${s.steps} steps lossy, worst ${s.shipped.toFixed(2).padStart(6)} %` +
      `   ·   PRIOR ${String(s.priorLossy).padStart(2)}/${s.steps}, worst ${s.prior.toFixed(2).padStart(6)} %`,
  )
}
console.log("")
console.log(`${rows} rows · ${pass ? "ALL PASS" : "FAILURES ABOVE"}`)
process.exit(pass ? 0 : 1)

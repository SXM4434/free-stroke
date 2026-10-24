// WHERE IS THE 2 px cy STEP? — a diagnostic, not a gate.
//
// `assert-hero-transition.mjs` reads `max cy step 2.00 px` against a `< 2`
// ceiling on a fresh capture, while `cx` reads 1.00. A control capture with the
// K7 joint-break rendering DISABLED reads the identical 2.00 on 72/72
// byte-identical emerge frames, so the break is ruled out. This prints the whole
// per-frame series so the step can be LOCATED rather than reasoned about: which
// frame pair, which phase, what the bbox edges did, and whether the frame is
// inside the gate's own legibility scope.
//
// It duplicates nothing from the judge except the bbox, deliberately: the gate's
// row shape is `{n,w,h,cx,cy}` off the FULL (un-eroded) mask at
// `INK_MAX_LUMA 150` over the top 75 % of the stage, and those four constants
// are the entire measurement. The gates themselves are imported from
// `lib/hero-moment.mjs` so this cannot disagree with the shipped verdict.
//
//   node scripts/verify/_probe-cy-step.mjs --label=k7final [--label2=reg-affine]
//
// Prints, per frame: phase · bbox y0/y1 · cy · step · whether legible.

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { momentStats, registrationGate, LEGIBLE_MIN } from "./lib/hero-moment.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}

const INK_MAX_LUMA = 150

async function bboxOf(file) {
  const img = await loadImage(file)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, n = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      if (l > INK_MAX_LUMA) continue
      n++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (!Number.isFinite(minX)) return null
  return {
    n,
    x0: minX, x1: maxX, y0: minY, y1: maxY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  }
}

async function seriesFor(label) {
  const base = join(ROOT, "docs", "verification", "hero-transition", label)
  const dir = join(base, "emerge")
  if (!existsSync(dir)) throw new Error(`no emerge frames at ${dir}`)
  const man = existsSync(join(base, "emerge-manifest.json"))
    ? JSON.parse(readFileSync(join(base, "emerge-manifest.json"), "utf8"))
    : null
  const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort()
  const out = []
  for (let i = 0; i < files.length; i++) {
    const b = await bboxOf(join(dir, files[i]))
    if (!b) continue
    out.push({ f: i, t: man?.[i]?.t ?? null, phase: man?.[i]?.phase ?? null, ...b })
  }
  return out
}

async function report(label) {
  const series = await seriesFor(label)
  const phases = series.map((r) => r.phase)
  const labelled = phases.some((p) => p != null)
  const turnStart = labelled ? phases.findIndex((p) => p === "emerge") : -1
  const parked = turnStart > 0 ? series.slice(turnStart) : series
  const rows = parked.map((r) => ({ f: r.f, n: r.n, w: r.w, h: r.h, cx: r.cx, cy: r.cy }))
  const st = momentStats(rows)
  const reg = registrationGate(st)

  console.log(`\n═══ ${label} ═══`)
  console.log(`frames ${series.length}, parked window ${parked.length} (from f${parked[0].f})`)
  console.log(`settled width ${st.settled}, legibility floor ${(LEGIBLE_MIN * st.settled).toFixed(1)} px`)
  console.log(`${reg.pass ? "PASS" : "FAIL"}  ${reg.detail}`)

  console.log(
    `\n  f   t      phase          y0   y1     h     w     cy      dcy    cx      dcx   legible`,
  )
  let prevLeg = null
  let prev = null
  const cyHits = []
  for (const r of series) {
    const inParked = turnStart <= 0 || r.f >= parked[0].f
    const legible = inParked && r.w >= LEGIBLE_MIN * st.settled
    const dcx = prev && inParked ? r.cx - prev.cx : null
    const dcy = legible && prevLeg ? r.cy - prevLeg.cy : null
    if (dcy != null && Math.abs(dcy) >= 1.5) cyHits.push({ from: prevLeg, to: r, dcy })
    console.log(
      [
        String(r.f).padStart(3),
        (r.t ?? 0).toFixed(3).padStart(6),
        String(r.phase ?? "-").padEnd(14),
        String(r.y0).padStart(4),
        String(r.y1).padStart(4),
        String(r.h).padStart(5),
        String(r.w).padStart(5),
        r.cy.toFixed(1).padStart(7),
        (dcy == null ? "" : dcy.toFixed(1)).padStart(7),
        r.cx.toFixed(1).padStart(7),
        (dcx == null ? "" : dcx.toFixed(1)).padStart(6),
        legible ? "  yes" : (inParked ? "   no" : "  OUT"),
      ].join(" "),
    )
    if (inParked) prev = r
    if (legible) prevLeg = r
  }

  console.log(`\n  cy steps >= 1.5 px inside the gate's scope: ${cyHits.length}`)
  for (const h of cyHits) {
    console.log(
      `    f${h.from.f} (${h.from.phase}, t ${h.from.t}) -> f${h.to.f} (${h.to.phase}, t ${h.to.t}): ` +
        `cy ${h.from.cy} -> ${h.to.cy} (${h.dcy > 0 ? "+" : ""}${h.dcy}), ` +
        `y0 ${h.from.y0}->${h.to.y0}, y1 ${h.from.y1}->${h.to.y1}, w ${h.from.w}->${h.to.w}`,
    )
  }
  return { label, series, st, reg, cyHits }
}

const labels = [arg("label", "k7final"), arg("label2", null)].filter(Boolean)
for (const l of labels) await report(l)

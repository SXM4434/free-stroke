// THE SELF-CROSSINGS, ARC-KEYED, THROUGH THE REAL LAW — priced one at a time.
//
// ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
// `_probe-crossing-census.mjs` found that seven strokes on this word cross
// THEMSELVES — the cursive loops of `D s D o o d e`, 54° to 88°, the only steep
// crossings besides 7→8 — and that `findHeroJunctions` was excluding all of them
// on a reason that is false. It could only MODEL them, by splitting the stroke
// in two, because `HeroJunctionInput` carried two stroke INDICES and a
// self-crossing collapsed to one sample.
//
// `lib/flat-ink.ts` now keys the two samples on ARC (`underAt` / `overAt`) and
// carries the enumeration + the crossing test as `findSelfCrossings`. This runs
// THAT function and THAT law — not a restatement of either — over the real
// processed strokes, and prices each junction on the picture.
//
// ── THE MODEL, AND WHERE IT COMES FROM ─────────────────────────────────────
// The raster / break / dilate / component model is `_probe-break-carve.mjs`'s,
// copied with its constants and its comments intact rather than re-derived,
// because it is CALIBRATED: at the shipped tube-sized law it reproduces the live
// gate's 9 components and at the carve-sized law its 7. A second implementation
// that agreed with a bug is the defect class this repo pays for most.
//
// ⚠ IT IS A MODEL AND THE GATE IS THE PAGE. Every verdict here is confirmed on
// the real render by `assert-hero-k7-intact.mjs` / `assert-hero-k7-news.mjs`
// before it is believed; this exists to say WHICH junction did what, which a
// live component count cannot.
//
// Usage:
//   node scripts/verify/_probe-self-cross.mjs                       the census + the law
//   node scripts/verify/_probe-self-cross.mjs --perBreak --png      one at a time, 5x crops
//   node scripts/verify/_probe-self-cross.mjs --diag=16-16          one break at 10x
//   node scripts/verify/_probe-self-cross.mjs --raw                 no crossing test
//   node scripts/verify/_probe-self-cross.mjs --distinct            + the live distinct set
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createCanvas } from "@napi-rs/canvas"
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes } from "./_hero-word.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "hero-k7", "self-cross")
const CACHE = join(ROOT, "docs", "verification", "hero-k7", "break-carve", "live-junctions.json")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const has = (k) => process.argv.includes(`--${k}`)

const flat = loadTs("lib/flat-ink.ts")
const {
  buildPenField,
  samplePenField,
  buildJointBreaks,
  findSelfCrossings,
  carvedHalfWidth,
  JOINT_BREAK_KEEP_K,
  PEN_NIB_DEFAULT,
} = flat

const strokes = processedHeroStrokes().map((s) => ({ points: s.points }))

if (!existsSync(CACHE)) {
  console.error(`no cache at ${CACHE} — run \`_probe-break-carve.mjs --pull\` first`)
  process.exit(2)
}
const live = JSON.parse(readFileSync(CACHE, "utf8"))
const ink = live.inkWidth
const R = ink / 2
const carve = Number(arg("carve", "1"))
const breakK = Number(arg("breakK", String(live.breakK)))

/** Live px per stroke unit — measured on the shipped stage (`--pull`). */
const PX_PER_UNIT = Number(arg("ppu", "0.5303"))
const MIN_COMPONENT_PX = 40
/** See `dilateRemoved` — 1 reproduces the live gate, 0 is the raw law. */
const DILATE = Number(arg("dilate", "1"))

/* ---------------------------------------------------------------------- */
/*  The model — _probe-break-carve.mjs's, copied with its calibration       */
/* ---------------------------------------------------------------------- */

function rasterCarved(field, c, W, H, x0, y0, ppu) {
  const m = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    const sy = y0 + (y + 0.5) / ppu
    for (let x = 0; x < W; x++) {
      const sx = x0 + (x + 0.5) / ppu
      const f = samplePenField(field, sx, sy)
      m[y * W + x] = f.tube + (f.pen - f.tube) * c <= 0 ? 1 : 0
    }
  }
  return m
}

const seg = (qx, qy, ax, ay, bx, by) => {
  const vx = bx - ax
  const vy = by - ay
  const L = vx * vx + vy * vy
  const t = L > 0 ? Math.max(0, Math.min(1, ((qx - ax) * vx + (qy - ay) * vy) / L)) : 0
  return Math.hypot(ax + t * vx - qx, ay + t * vy - qy)
}

/* ⚠ THE ARC KEEPS COUNTING PAST THE SAMPLE'S END — `_probe-break-carve.mjs`'s
 * note, kept verbatim because the correction is load-bearing: `polyNearest`
 * clamps the projection, so a query BEYOND the three-point sample reports
 * arc === reach exactly and passes `arc <= reach`. */
const near = (qx, qy, p) => {
  let best = null
  for (let s = 0; s < 2; s++) {
    const a = p[s]
    const b = p[s + 1]
    const vx = b.x - a.x
    const vy = b.y - a.y
    const L = vx * vx + vy * vy
    const raw = L > 0 ? ((qx - a.x) * vx + (qy - a.y) * vy) / L : 0
    const t = Math.max(0, Math.min(1, raw))
    const px = a.x + t * vx
    const py = a.y + t * vy
    const d = Math.hypot(px - qx, py - qy)
    if (!best || d < best.d) {
      const len = Math.sqrt(L)
      const over = s === 0 ? Math.max(0, -raw) * len : Math.max(0, raw - 1) * len
      best = { x: px, y: py, d, arc: (s === 0 ? (1 - t) * len : t * len) + over }
    }
  }
  return best
}

/** The break law, as the shader runs it, over an already-carved mask. */
function applyBreaks(mask, breaks, reach, W, H, x0, y0, ppu) {
  const out = Uint8Array.from(mask)
  for (let y = 0; y < H; y++) {
    const qy = y0 + (y + 0.5) / ppu
    for (let x = 0; x < W; x++) {
      const p = y * W + x
      if (!out[p]) continue
      const qx = x0 + (x + 0.5) / ppu
      for (const b of breaks) {
        const n = near(qx, qy, b.under)
        if (n.d > b.keepUnder || n.arc > reach) continue
        const dOver = Math.min(
          seg(n.x, n.y, b.over[0].x, b.over[0].y, b.over[1].x, b.over[1].y),
          seg(n.x, n.y, b.over[1].x, b.over[1].y, b.over[2].x, b.over[2].y),
        )
        if (dOver <= b.keepOver || dOver > b.outer) continue
        out[p] = 0
        break
      }
    }
  }
  return out
}

/* THE LIVE CUT IS WIDER THAN THE MODEL'S BY ABOUT A PIXEL, and it has to be —
 * the shader converts the cut to COVERAGE and `alphaToCoverage` makes boundary
 * pixels partial samples, which the gate's luma-150 threshold then drops below
 * about half coverage. Calibrated, not assumed: see `_probe-break-carve.mjs`. */
function dilateRemoved(base, broken, W, H, n) {
  let out = Uint8Array.from(broken)
  for (let pass = 0; pass < n; pass++) {
    const next = Uint8Array.from(out)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const p = y * W + x
        if (!out[p] || !base[p]) continue
        for (let dy = -1; dy <= 1 && next[p]; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
            const q = ny * W + nx
            if (base[q] && !out[q]) {
              next[p] = 0
              break
            }
          }
      }
    out = next
  }
  return out
}

function componentsOf(mask, W, H) {
  const lab = new Int32Array(W * H).fill(-1)
  const sizes = []
  const boxes = []
  const stack = new Int32Array(W * H)
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || lab[s] >= 0) continue
    const id = sizes.length
    let sp = 0
    stack[sp++] = s
    lab[s] = id
    let n = 0
    let x0 = 1e9
    let y0 = 1e9
    let x1 = -1
    let y1 = -1
    while (sp > 0) {
      const q = stack[--sp]
      n++
      const x = q % W
      const y = (q / W) | 0
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const r = ny * W + nx
          if (!mask[r] || lab[r] >= 0) continue
          lab[r] = id
          stack[sp++] = r
        }
    }
    sizes.push(n)
    boxes.push({ n, x0, y0, x1, y1 })
  }
  const real = boxes.filter((b) => b.n >= MIN_COMPONENT_PX).sort((a, b) => b.n - a.n)
  return { real, sizes: real.map((b) => b.n), crumbs: boxes.filter((b) => b.n < MIN_COMPONENT_PX) }
}

/* ---------------------------------------------------------------------- */
/*  The census, through the real function                                  */
/* ---------------------------------------------------------------------- */

const keepTube = (JOINT_BREAK_KEEP_K * ink) / 2
const sized = (pts, i) =>
  keepTube + (carvedHalfWidth(pts, i, R, PEN_NIB_DEFAULT) - keepTube) * carve
const arcOf = (pts) => {
  const a = [0]
  for (let i = 1; i < pts.length; i++)
    a.push(a[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return a
}
const tangent = (pts, i) => {
  const a = pts[Math.max(0, i - 1)]
  const b = pts[Math.min(pts.length - 1, i + 1)]
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
  return { x: (b.x - a.x) / L, y: (b.y - a.y) / L }
}
const angleBetween = (pts, i, k) => {
  const t = tangent(pts, i)
  const u = tangent(pts, k)
  return (Math.acos(Math.max(0, Math.min(1, Math.abs(t.x * u.x + t.y * u.y)))) * 180) / Math.PI
}

const RAW = has("raw")
console.log(
  `carve ${carve.toFixed(2)} · ink ${ink.toFixed(2)} · breakK ${breakK} · ` +
    `crossing test ${RAW ? "OFF (--raw)" : "ON"}\n`,
)

const selfJunctions = []
console.log("   stroke  underArc  overArc  angle   sep     verdict")
for (let s = 0; s < strokes.length; s++) {
  const P = strokes[s].points
  if (P.length < 3) continue
  const arc = arcOf(P)
  const wid = P.map((_, i) => sized(P, i))
  const all = findSelfCrossings(P, ink, carve, breakK, { farSide: false, capTest: false })
  const admitted = findSelfCrossings(P, ink, carve, breakK, RAW ? { farSide: false } : {})
  const isIn = (x) => admitted.some((a) => a.underAt === x.underAt && a.overAt === x.overAt)
  for (const x of all) {
    const sep = Math.hypot(P[x.underAt].x - P[x.overAt].x, P[x.underAt].y - P[x.overAt].y) -
      wid[x.underAt] - wid[x.overAt]
    console.log(
      `   ${String(s).padStart(6)}  ${arc[x.underAt].toFixed(1).padStart(8)} ` +
        `${arc[x.overAt].toFixed(1).padStart(8)}  ${angleBetween(P, x.underAt, x.overAt).toFixed(1).padStart(5)}°  ` +
        `${sep.toFixed(1).padStart(5)}u  ${isIn(x) ? "ADMIT" : "reject"}`,
    )
  }
  for (const x of admitted)
    selfJunctions.push({ under: s, over: s, x: x.x, y: x.y, gap: x.gap, underAt: x.underAt, overAt: x.overAt })
}
console.log(
  `\n${selfJunctions.length} self-crossing junction(s): ` +
    `[${selfJunctions.map((j) => `${j.under}@${j.underAt}->${j.overAt}`).join(" ")}]\n`,
)

/* ---------------------------------------------------------------------- */
/*  Through the law, and onto the picture                                  */
/* ---------------------------------------------------------------------- */

const list = has("distinct") ? [...live.list, ...selfJunctions] : selfJunctions
const built = buildJointBreaks(strokes, list, ink, breakK, carve)
console.log(
  `buildJointBreaks: ${list.length} in -> ${built.breaks.length} breaks, ${built.dropped} dropped ` +
    `· reach ${built.reach.toFixed(1)}u · gap ${built.gap.toFixed(1)}u\n`,
)
for (const b of built.breaks) {
  const ratio = (b.cut * b.keepOver) / Math.max(1e-6, b.behind * built.gap)
  console.log(
    `   ${String(b.underIndex).padStart(2)}->${String(b.overIndex).padEnd(2)}` +
      `${b.underIndex === b.overIndex ? " SELF" : "     "}  cut ${b.cut.toFixed(1).padStart(5)}u  ` +
      `behind ${b.behind.toFixed(1).padStart(5)}u  ratio ${ratio.toFixed(2).padStart(5)}  ` +
      `keepU ${(b.keepUnder / R).toFixed(2)}R keepO ${(b.keepOver / R).toFixed(2)}R  ` +
      `window ${(b.behind + b.cut).toFixed(1)}/${(2 * built.reach).toFixed(1)}`,
  )
}

const field = buildPenField(strokes, ink)
const x0 = field.minX
const y0 = field.minY
const W = Math.ceil((field.maxX - field.minX) * PX_PER_UNIT)
const H = Math.ceil((field.maxY - field.minY) * PX_PER_UNIT)
const base = rasterCarved(field, carve, W, H, x0, y0, PX_PER_UNIT)
const b0 = componentsOf(base, W, H)
console.log(
  `\nUNBROKEN at carve ${carve.toFixed(2)}: ${b0.real.length} components [${b0.sizes.join(", ")}]`,
)

mkdirSync(OUT, { recursive: true })

function cropPair(b, one, name, Z = 5) {
  const cxp = Math.round((b.c.x - x0) * PX_PER_UNIT)
  const cyp = Math.round((b.c.y - y0) * PX_PER_UNIT)
  const M = Math.round(3.2 * ink * PX_PER_UNIT)
  const ax = Math.max(0, cxp - M)
  const ay = Math.max(0, cyp - M)
  const bx = Math.min(W - 1, cxp + M)
  const by = Math.min(H - 1, cyp + M)
  const cw = bx - ax + 1
  const ch = by - ay + 1
  const cv = createCanvas(cw * Z * 2 + 10, ch * Z)
  const cx = cv.getContext("2d")
  cx.fillStyle = "#ff3b30"
  cx.fillRect(0, 0, cv.width, cv.height)
  for (const [src, ox] of [
    [base, 0],
    [one, cw * Z + 10],
  ]) {
    for (let yy = 0; yy < ch; yy++)
      for (let xx = 0; xx < cw; xx++) {
        cx.fillStyle = src[(ay + yy) * W + (ax + xx)] ? "#111111" : "#fafafa"
        cx.fillRect(ox + xx * Z, yy * Z, Z, Z)
      }
  }
  const p = join(OUT, name)
  writeFileSync(p, cv.toBuffer("image/png"))
  return p
}

/* THE BREAK WITH ITS OWN GEOMETRY ON TOP, at 10x — removed ink RED, the under
 * arc BLUE, the over arc GREEN, the junction a ring. "Which arc did the cut land
 * on, and where relative to the arc in front" is not a thing a component count
 * can answer. */
function diagOne(b, one, name, Z = 10) {
  const cxp = (b.c.x - x0) * PX_PER_UNIT
  const cyp = (b.c.y - y0) * PX_PER_UNIT
  const M = Math.round(Number(arg("wide", "4.5")) * ink * PX_PER_UNIT)
  const ax = Math.max(0, Math.round(cxp - M))
  const ay = Math.max(0, Math.round(cyp - M))
  const bx2 = Math.min(W - 1, Math.round(cxp + M))
  const by2 = Math.min(H - 1, Math.round(cyp + M))
  const cw = bx2 - ax + 1
  const ch = by2 - ay + 1
  const cv = createCanvas(cw * Z, ch * Z)
  const cx = cv.getContext("2d")
  for (let yy = 0; yy < ch; yy++)
    for (let xx = 0; xx < cw; xx++) {
      const p2 = (ay + yy) * W + (ax + xx)
      cx.fillStyle = one[p2] ? "#1a1a1a" : base[p2] ? "#e8342b" : "#fbfbfb"
      cx.fillRect(xx * Z, yy * Z, Z, Z)
    }
  const sx = (u) => ((u - x0) * PX_PER_UNIT - ax) * Z
  const sy = (v) => ((v - y0) * PX_PER_UNIT - ay) * Z
  const line = (pts, colour, wdt) => {
    cx.strokeStyle = colour
    cx.lineWidth = wdt
    cx.beginPath()
    pts.forEach((p, i) => (i ? cx.lineTo(sx(p.x), sy(p.y)) : cx.moveTo(sx(p.x), sy(p.y))))
    cx.stroke()
  }
  line(strokes[b.underIndex].points, "#1f6feb", 3)
  line(strokes[b.overIndex].points, "#1a7f37", 3)
  line(b.over, "#1a7f37", 7)
  line(b.under, "#1f6feb", 7)
  cx.strokeStyle = "#8250df"
  cx.lineWidth = 3
  cx.beginPath()
  cx.arc(sx(b.c.x), sy(b.c.y), 8, 0, Math.PI * 2)
  cx.stroke()
  /* WHERE THE PEN STARTED AND STOPPED — orange in, cyan out. Which side of the
   * cut is the LEAD-IN is the whole question when a loop is meant to hold
   * itself together through its own far side, and it is not readable from the
   * arcs alone. */
  const P = strokes[b.underIndex].points
  for (const [pt, colour] of [
    [P[0], "#fb8500"],
    [P[P.length - 1], "#00b4d8"],
  ]) {
    cx.fillStyle = colour
    cx.beginPath()
    cx.arc(sx(pt.x), sy(pt.y), 10, 0, Math.PI * 2)
    cx.fill()
  }
  const p = join(OUT, name)
  writeFileSync(p, cv.toBuffer("image/png"))
  return p
}

/* ---- ONE BREAK AT A TIME, so damage is attributable --------------------- */
if (has("perBreak")) {
  console.log("")
  for (const b of built.breaks) {
    const one = dilateRemoved(
      base,
      applyBreaks(base, [b], built.reach, W, H, x0, y0, PX_PER_UNIT),
      W,
      H,
      DILATE,
    )
    const c1 = componentsOf(one, W, H)
    let rm = 0
    for (let p = 0; p < base.length; p++) if (base[p] && !one[p]) rm++
    const tag = `${b.underIndex}-${b.overIndex}${b.underIndex === b.overIndex ? `@${b.underAt ?? ""}` : ""}`
    console.log(
      `   break ${tag.padEnd(9)} cut ${b.cut.toFixed(1).padStart(5)}u  ${String(rm).padStart(4)} px  ` +
        `-> ${c1.real.length} comps [${c1.sizes.slice(0, 10).join(", ")}]` +
        `${c1.real.length === b0.real.length ? "  ✓" : "  ✗ DAMAGE"}` +
        `${c1.crumbs.length !== b0.crumbs.length ? `  crumbs ${b0.crumbs.length}->${c1.crumbs.length}` : ""}`,
    )
    if (c1.real.length !== b0.real.length) {
      const beforeSet = b0.sizes.slice()
      for (const c of c1.real) {
        const i = beforeSet.indexOf(c.n)
        if (i >= 0) beforeSet.splice(i, 1)
        else
          console.log(
            `            NEW/CHANGED body ${c.n} px at [${c.x0},${c.y0}]-[${c.x1},${c.y1}]`,
          )
      }
    }
    if (has("png")) console.log(`            ${cropPair(b, one, `self-${tag}.png`)}`)
    if (arg("diag", null) === `${b.underIndex}-${b.overIndex}` || has("diagAll"))
      console.log(`            ${diagOne(b, one, `diag-${tag}.png`)}`)
  }
}

/* ---- ALL OF THEM TOGETHER ---------------------------------------------- */
const drop = (arg("drop", "") || "").split(",").filter(Boolean)
const kept = built.breaks.filter(
  (b) =>
    !drop.includes(`${b.underIndex}-${b.overIndex}`) &&
    !drop.includes(`${b.underIndex}-${b.overIndex}@${b.underAt}`),
)
const broken = dilateRemoved(
  base,
  applyBreaks(base, kept, built.reach, W, H, x0, y0, PX_PER_UNIT),
  W,
  H,
  DILATE,
)
const cAll = componentsOf(broken, W, H)
let removed = 0
for (let p = 0; p < base.length; p++) if (base[p] && !broken[p]) removed++
console.log(
  `\nALL ${kept.length} BREAK(S): ${b0.real.length} -> ${cAll.real.length} components` +
    `${cAll.real.length === b0.real.length ? "  ✓ assembled" : "  ✗ DAMAGE"}` +
    ` · crumbs ${b0.crumbs.length} -> ${cAll.crumbs.length}` +
    ` · ${removed} px of paper opened, against the gate's 200 px floor\n   [${cAll.sizes.join(", ")}]`,
)
if (has("png")) {
  /* THE WHOLE MARK, EVERY CONNECTED BODY IN ITS OWN COLOUR, removed ink in red.
   * A component COUNT says the mark came apart; only this says WHICH piece
   * left, which is the whole question when a loop is supposed to hold itself
   * together through its own far side. */
  const Z = Number(arg("zoom", "2"))
  const cv = createCanvas(W * Z, H * Z)
  const cx = cv.getContext("2d")
  /* MAXIMALLY DISTINCT, and that is not decoration: the first palette here put
   * `#1f6feb` next to `#0969da` and a 849 px body that had just come off the
   * `e` was INVISIBLE against the body it came off. A component map whose
   * colours are not separable at a glance is a green row that cannot fail. */
  const HUES = [
    "#111111", "#1f6feb", "#1a7f37", "#8250df", "#bf8700", "#cf222e",
    "#ff00ff", "#00cfff", "#7f4f00", "#00ff7f",
  ]
  const lab = new Int32Array(W * H).fill(-1)
  const stack = new Int32Array(W * H)
  let id = 0
  const order = []
  for (let s = 0; s < W * H; s++) {
    if (!broken[s] || lab[s] >= 0) continue
    let sp = 0
    stack[sp++] = s
    lab[s] = id
    let n = 0
    while (sp > 0) {
      const q = stack[--sp]
      n++
      const x = q % W
      const y = (q / W) | 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const r = ny * W + nx
          if (!broken[r] || lab[r] >= 0) continue
          lab[r] = id
          stack[sp++] = r
        }
    }
    order.push({ id, n })
    id++
  }
  const rank = new Map(order.sort((a, b) => b.n - a.n).map((o, i) => [o.id, i]))
  cx.fillStyle = "#fafafa"
  cx.fillRect(0, 0, cv.width, cv.height)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x
      if (broken[p]) cx.fillStyle = HUES[(rank.get(lab[p]) ?? 0) % HUES.length]
      else if (base[p]) cx.fillStyle = "#ff3b30"
      else continue
      cx.fillRect(x * Z, y * Z, Z, Z)
    }
  const p = join(OUT, `whole-carve${carve}${RAW ? "-raw" : ""}.png`)
  writeFileSync(p, cv.toBuffer("image/png"))
  console.log(`\n   ${p}   (bodies largest-first: ${HUES.slice(0, Math.min(6, order.length)).join(" ")})`)
}

/**
 * THE PICTURE — four arms, ONE crop rectangle, computed from the UNION of every
 * arm's own ink bounding box so the frame cannot move under the comparison.
 *
 * C2, 2026-08-28. Each arm anchors its D-stem band to its own ink bbox (the
 * film's law, so the band lands on the same letter whatever the mark weighs).
 * Those four bands differ by 1-2 px because the mark's bbox does. Cropping each
 * arm to its OWN band would then compare four slightly different windows, and a
 * false read tonight came from exactly that. So the crop used here is the union
 * of the four, applied identically to all four.
 *
 * Usage: node scripts/verify/_probe-spike-compose.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const DIR = join(ROOT, "docs", "verification", "spike-2026-08-28")
const ARMS = [
  { dir: "a18-desk-doodles", title: "desk-doodles - aspect 1.8 (SHIPPED)" },
  { dir: "a10-desk-doodles", title: "desk-doodles - aspect 1.0 (round pen)" },
  { dir: "a18-free-stroke", title: "free-stroke - aspect 1.8 (SHIPPED)" },
  { dir: "a10-free-stroke", title: "free-stroke - aspect 1.0 (round pen)" },
]

const loaded = ARMS.map((a) => {
  const p = join(DIR, a.dir, "measure.json")
  if (!existsSync(p)) throw new Error(`missing arm: ${p}`)
  return { ...a, m: JSON.parse(readFileSync(p, "utf8")) }
})

/* THE UNION. Not any one arm's band. */
const L = Math.min(...loaded.map((a) => a.m.band.left))
const T = Math.min(...loaded.map((a) => a.m.band.top))
const R = Math.max(...loaded.map((a) => a.m.band.left + a.m.band.width))
const B = Math.max(...loaded.map((a) => a.m.band.top + a.m.band.height))
const CROP = { left: L, top: T, width: R - L, height: B - T }
console.log("union crop", JSON.stringify(CROP), "from bands:")
for (const a of loaded) console.log("  ", a.dir, JSON.stringify(a.m.band), "bbox", JSON.stringify(a.m.bbox))

const Z = 8
const PAD = 10
const LABEL_H = 34
const cw = CROP.width * Z
const chh = CROP.height * Z

const tiles = []
for (const a of loaded) {
  const buf = await sharp(join(DIR, a.dir, "final.png"))
    .extract(CROP)
    .resize({ width: cw, kernel: "nearest" })
    .png()
    .toBuffer()
  tiles.push({ ...a, buf })
}

const cols = 2
const rows = 2
const W = PAD + cols * (cw + PAD)
const H = PAD + rows * (chh + LABEL_H + PAD)

const svgLabel = (t) =>
  Buffer.from(
    `<svg width="${cw}" height="${LABEL_H}"><rect width="100%" height="100%" fill="#ffffff"/>` +
      `<text x="4" y="23" font-family="Menlo,monospace" font-size="19" fill="#111">${t}</text></svg>`,
  )

const composite = []
tiles.forEach((t, i) => {
  const cx = PAD + (i % cols) * (cw + PAD)
  const cy = PAD + Math.floor(i / cols) * (chh + LABEL_H + PAD)
  composite.push({ input: svgLabel(t.title), left: cx, top: cy })
  composite.push({ input: t.buf, left: cx, top: cy + LABEL_H })
})

const out = join(DIR, "AB-spike-pinch.png")
await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
  .composite(composite)
  .png()
  .toFile(out)
console.log("wrote", out, `${W}x${H}`)

/* The two desk-doodles arms alone, stacked, at the same union crop — the
 * before/after shape the shipped AB used, so the two are read the same way. */
const dd = tiles.filter((t) => t.dir.endsWith("desk-doodles"))
const H2 = PAD + dd.length * (chh + LABEL_H + PAD)
const comp2 = []
dd.forEach((t, i) => {
  const cy = PAD + i * (chh + LABEL_H + PAD)
  comp2.push({ input: svgLabel(t.title), left: PAD, top: cy })
  comp2.push({ input: t.buf, left: PAD, top: cy + LABEL_H })
})
const out2 = join(DIR, "AB-dd-aspect.png")
await sharp({ create: { width: PAD * 2 + cw, height: H2, channels: 3, background: "#ffffff" } })
  .composite(comp2)
  .png()
  .toFile(out2)
console.log("wrote", out2)

writeFileSync(join(DIR, "crop.json"), JSON.stringify({ CROP, bands: loaded.map((a) => ({ arm: a.dir, band: a.m.band, bbox: a.m.bbox, ink: a.m.ink })) }, null, 2))

/* ══════════════════════════════════════════════════════════════════════════
 * IS THE PINCH THE NIB WORKING CORRECTLY?
 *
 * A broad nib is anisotropic, so a stroke that CHANGES DIRECTION through a
 * joint changes width by design, and that would be the pen being right rather
 * than a defect. This is the check, and it needs no opinion: read the stem's
 * own direction out of the render at the crossing and at the plateau, and ask
 * what the shipped nib does to the half-width between those two directions.
 *
 * Half-width across travel, for an ellipse with semi-axes a along `e1` and b
 * along `e2`, is the support function in the normal direction n:
 *
 *     h(n) = sqrt( a^2 (e1.n)^2 + b^2 (e2.n)^2 )
 *
 * with a = R*sqrt(aspect), b = R/sqrt(aspect), e1 at the world pen angle.
 * Canvas y is flipped into world, which is why the angle is negated — the same
 * `alphaWorld` `inflateResolveNib` computes.
 * ═══════════════════════════════════════════════════════════════════════ */
const ASPECT = 1.8
const ANGLE_DEG = 30
const alphaWorld = (-ANGLE_DEG * Math.PI) / 180
const e1 = [Math.cos(alphaWorld), Math.sin(alphaWorld)]
const e2 = [-Math.sin(alphaWorld), Math.cos(alphaWorld)]
const a2 = ASPECT
const b2 = 1 / ASPECT

/** Half-width in units of R, for a canvas travel direction (dx, dy). */
function halfWidth(dx, dy) {
  const L = Math.hypot(dx, dy)
  // canvas -> world flips y; n is the unit normal to travel.
  const tx = dx / L, ty = -dy / L
  const nx = -ty, ny = tx
  const p1 = e1[0] * nx + e1[1] * ny
  const p2 = e2[0] * nx + e2[1] * ny
  return Math.sqrt(a2 * p1 * p1 + b2 * p2 * p2)
}

/** The stem's own slope, read off one arm's rows between two y values. */
function stemSlope(m, yA, yB, lo, hi) {
  const at = (y) => {
    const r = m.rows.find((q) => q.y === y)
    const s = r?.runs.filter((q) => q.x0 >= lo && q.x0 <= hi).sort((p, q) => p.x0 - q.x0)[0]
    return s ? { x: s.x0 + s.len / 2, w: s.len } : null
  }
  const A = at(yA), B = at(yB)
  if (!A || !B) return null
  return { dx: B.x - A.x, dy: yB - yA, wA: A.w, wB: B.w }
}

const dd18 = loaded.find((x) => x.dir === "a18-desk-doodles").m
// y=476 is the first row clear of the crossing; y=545 is inside the plateau.
const sl = stemSlope(dd18, 476, 545, 560, 590)
if (sl) {
  const hCross = halfWidth(sl.dx / sl.dy, 1)
  // Local slope near the crossing vs near the plateau, read the same way.
  const near = stemSlope(dd18, 476, 495, 560, 590)
  const far = stemSlope(dd18, 519, 545, 560, 590)
  const hNear = halfWidth(near.dx / near.dy, 1)
  const hFar = halfWidth(far.dx / far.dy, 1)
  console.log("\n=== IS THE PINCH THE NIB? desk-doodles, aspect 1.8 ===")
  console.log(`  stem at the crossing (y476-495): slope ${(near.dx / near.dy).toFixed(4)} px/px, ink ${near.wA} px`)
  console.log(`  stem at the plateau  (y519-545): slope ${(far.dx / far.dy).toFixed(4)} px/px, ink ${far.wB} px`)
  console.log(`  direction turns ${(Math.abs(Math.atan(far.dx / far.dy) - Math.atan(near.dx / near.dy)) * 180 / Math.PI).toFixed(2)} deg over that stretch`)
  console.log(`  the NIB's half-width over that turn: ${hNear.toFixed(4)} R -> ${hFar.toFixed(4)} R ` +
    `= ${(((hFar - hNear) / hNear) * 100).toFixed(1)} %`)
  console.log(`  the INK actually goes ${near.wA} px -> ${far.wB} px = ${(((far.wB - near.wA) / near.wA) * 100).toFixed(1)} %`)
  console.log(`  overall stem slope y476-545: ${(sl.dx / sl.dy).toFixed(4)} (h = ${hCross.toFixed(4)} R)`)
}

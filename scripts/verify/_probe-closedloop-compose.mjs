/**
 * THE PICTURE — four arms, ONE crop rectangle per band, computed from the UNION
 * of every arm's own band so the frame cannot move under the comparison.
 *
 * D1, 2026-08-28. C2's law, kept verbatim and for its reason: *"the bands
 * differ by 1-2 px between arms because the mark's bbox does. Cropping each arm
 * to its OWN band would compare four slightly different windows, and a false
 * read tonight came from exactly that."* The arms here are before/after x
 * desk-doodles/free-stroke rather than two nib aspects, and the union is taken
 * across all four.
 *
 * Also computes THE NEEDLE, which is the thing the eye is being asked about:
 * rows of ink standing above the `D`'s top bar whose run is under a quarter of
 * the bar's own width. The two or three rows where the bar itself ramps in are
 * not a needle and are reported separately, so the count cannot flatter itself.
 *
 * Usage: node scripts/verify/_probe-closedloop-compose.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"
import { ROOT } from "./_ts-load.mjs"

const DIR = join(ROOT, "docs", "verification", "closedloop-2026-08-28")
/* Four arms by default — F70's before/after on both families. `--arms=` swaps
 * the set without a second script: F71 re-films the same bands with the taper
 * bounded, and the AB it needs is the same AB read against different frames.
 * `--out=` keeps the two sets from overwriting each other. */
const argOf = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const TITLES = {
  before: "BEFORE (shipped)",
  after: "AFTER (F70 closed loops)",
  f71: "AFTER (F70 + F71 closed sweep)",
}
const ARMS = argOf("arms", "before-desk-doodles,after-desk-doodles,before-free-stroke,after-free-stroke")
  .split(",")
  .map((dir) => {
    const [state, ...rest] = dir.split("-")
    return { dir, title: `${rest.join("-")} - ${TITLES[state] ?? state}` }
  })
const SUFFIX = argOf("out", "")
const BANDS = ["Dstem", "o1", "o2"]

const loaded = ARMS.map((a) => {
  const p = join(DIR, a.dir, "measure.json")
  if (!existsSync(p)) throw new Error(`missing arm: ${p}`)
  return { ...a, m: JSON.parse(readFileSync(p, "utf8")) }
})

/** Ink standing over the top of the letter, split into needle and bar ramp. */
function needle(rows) {
  let barY = null, barLen = 0
  for (const r of rows) {
    const L = r.runs[0]?.len ?? 0
    if (L > barLen) { barLen = L; barY = r.y }
  }
  const above = rows.filter((r) => r.y < barY && r.total > 0)
  const needleRows = above.filter((r) => r.runs[0].len <= barLen * 0.25)
  const rampRows = above.filter((r) => r.runs[0].len > barLen * 0.25)
  return {
    barY, barLen,
    needleRows: needleRows.length,
    needleWidths: needleRows.map((r) => r.runs[0].len),
    rampRows: rampRows.length,
    rampWidths: rampRows.map((r) => r.runs[0].len),
  }
}

const report = { crops: {}, needle: {}, ink: {}, strokes: {} }

console.log("=== THE NEEDLE ABOVE THE D's TOP BAR ===")
for (const a of loaded) {
  const n = needle(a.m.bands.Dstem.rows)
  report.needle[a.dir] = n
  console.log(
    `  ${a.dir.padEnd(22)} barY ${n.barY} barLen ${n.barLen}  ` +
      `NEEDLE ${n.needleRows} rows [${n.needleWidths}]  bar ramp ${n.rampRows} rows [${n.rampWidths}]`,
  )
}

console.log("\n=== THE THREE LOOPS, ON THE PAGE THAT DREW THE FRAME ===")
for (const a of loaded) {
  report.strokes[a.dir] = a.m.strokes
  report.ink[a.dir] = a.m.ink
  const loops = a.m.strokes.filter((s) => [0, 5, 6, 7].includes(s.i))
  console.log(
    `  ${a.dir.padEnd(22)} ink ${a.m.ink}  ` +
      loops.map((s) => `#${s.i} ${s.rawGap}->${s.processedGap}${s.closed ? " CLOSED" : ""}`).join("  "),
  )
}

const Z = 6
const PAD = 10
const LABEL_H = 30
const svgLabel = (t, w) =>
  Buffer.from(
    `<svg width="${w}" height="${LABEL_H}"><rect width="100%" height="100%" fill="#ffffff"/>` +
      `<text x="4" y="21" font-family="Menlo,monospace" font-size="17" fill="#111">${t}</text></svg>`,
  )

for (const key of BANDS) {
  const L = Math.min(...loaded.map((a) => a.m.bands[key].band.left))
  const T = Math.min(...loaded.map((a) => a.m.bands[key].band.top))
  const R = Math.max(...loaded.map((a) => a.m.bands[key].band.left + a.m.bands[key].band.width))
  const B = Math.max(...loaded.map((a) => a.m.bands[key].band.top + a.m.bands[key].band.height))
  const CROP = { left: L, top: T, width: R - L, height: B - T }
  report.crops[key] = { CROP, bands: loaded.map((a) => ({ arm: a.dir, band: a.m.bands[key].band, bbox: a.m.bbox })) }
  console.log(`\n${key}: union crop ${JSON.stringify(CROP)}`)
  for (const a of loaded) console.log("   ", a.dir, JSON.stringify(a.m.bands[key].band))

  const cw = CROP.width * Z
  const chh = CROP.height * Z
  const tiles = []
  for (const a of loaded) {
    tiles.push({
      ...a,
      buf: await sharp(join(DIR, a.dir, "final.png"))
        .extract(CROP).resize({ width: cw, kernel: "nearest" }).png().toBuffer(),
    })
  }
  const cols = 2, rowsN = 2
  const W = PAD + cols * (cw + PAD)
  const H = PAD + rowsN * (chh + LABEL_H + PAD)
  const composite = []
  tiles.forEach((t, i) => {
    const cx = PAD + (i % cols) * (cw + PAD)
    const cy = PAD + Math.floor(i / cols) * (chh + LABEL_H + PAD)
    composite.push({ input: svgLabel(t.title, cw), left: cx, top: cy })
    composite.push({ input: t.buf, left: cx, top: cy + LABEL_H })
  })
  const out = join(DIR, `AB${SUFFIX}-${key}.png`)
  await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } })
    .composite(composite).png().toFile(out)
  console.log("wrote", out, `${W}x${H}`)
}

/* THE WHOLE WORD, same four arms, one crop — because three letters growing
 * while ten stay put is a thing only the whole word can show. */
{
  const L = Math.min(...loaded.map((a) => a.m.bbox.x0)) - 12
  const T = Math.min(...loaded.map((a) => a.m.bbox.y0)) - 12
  const R = Math.max(...loaded.map((a) => a.m.bbox.x1)) + 12
  const B = Math.max(...loaded.map((a) => a.m.bbox.y1)) + 12
  const CROP = { left: L, top: T, width: R - L, height: B - T }
  report.crops.word = { CROP }
  const cw = CROP.width, chh = CROP.height
  const composite = []
  for (let i = 0; i < loaded.length; i++) {
    const a = loaded[i]
    const buf = await sharp(join(DIR, a.dir, "final.png")).extract(CROP).png().toBuffer()
    const cy = PAD + i * (chh + LABEL_H + PAD)
    composite.push({ input: svgLabel(a.title, cw), left: PAD, top: cy })
    composite.push({ input: buf, left: PAD, top: cy + LABEL_H })
  }
  const out = join(DIR, `AB${SUFFIX}-word.png`)
  await sharp({
    create: { width: PAD * 2 + cw, height: PAD + loaded.length * (chh + LABEL_H + PAD), channels: 3, background: "#ffffff" },
  }).composite(composite).png().toFile(out)
  console.log("wrote", out)
}

writeFileSync(join(DIR, `compose${SUFFIX}.json`), JSON.stringify(report, null, 2))

/* ══════════════════════════════════════════════════════════════════════════
 * THE DILATION, KEPT AS A PICTURE.
 *
 * The first attempt at this fix reached `applyEndpointBehavior`'s closed branch
 * with the caller's ink scale still on the amount — 4 px became 17.35 px — and
 * the two `o`s nearly doubled in area. That is not a hypothetical: it rendered,
 * it was filmed, and the frames are kept under `inkscaled-*` so the reason the
 * branch runs unscaled is a picture rather than an assertion.
 * ═══════════════════════════════════════════════════════════════════════ */
{
  const dilArms = [
    { dir: "before-desk-doodles", title: "dd - BEFORE" },
    { dir: "inkscaled-desk-doodles", title: "dd - radial push x ink scale (17.35 px)" },
    { dir: "after-desk-doodles", title: "dd - radial push verbatim (4 px)" },
  ].filter((a) => existsSync(join(DIR, a.dir, "measure.json")))
  if (dilArms.length === 3) {
    const ms = dilArms.map((a) => ({ ...a, m: JSON.parse(readFileSync(join(DIR, a.dir, "measure.json"), "utf8")) }))
    const key = "o1"
    const L = Math.min(...ms.map((a) => a.m.bands[key].band.left))
    const T = Math.min(...ms.map((a) => a.m.bands[key].band.top))
    const R = Math.max(...ms.map((a) => a.m.bands[key].band.left + a.m.bands[key].band.width))
    const B = Math.max(...ms.map((a) => a.m.bands[key].band.top + a.m.bands[key].band.height))
    const CROP = { left: L, top: T, width: R - L, height: B - T }
    const cw = CROP.width * Z, chh = CROP.height * Z
    const composite = []
    for (let i = 0; i < ms.length; i++) {
      const buf = await sharp(join(DIR, ms[i].dir, "final.png"))
        .extract(CROP).resize({ width: cw, kernel: "nearest" }).png().toBuffer()
      const cx = PAD + i * (cw + PAD)
      composite.push({ input: svgLabel(ms[i].title, cw), left: cx, top: PAD })
      composite.push({ input: buf, left: cx, top: PAD + LABEL_H })
    }
    const out = join(DIR, "AB-o1-dilation.png")
    await sharp({
      create: { width: PAD + ms.length * (cw + PAD), height: PAD * 2 + chh + LABEL_H, channels: 3, background: "#ffffff" },
    }).composite(composite).png().toFile(out)
    console.log("wrote", out, `union crop ${JSON.stringify(CROP)}`)
  }
}

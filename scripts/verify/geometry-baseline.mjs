// GEOMETRY REGRESSION NET.
//
// The PRD locked the geometry engines because this project spent months in
// engine-rescue mode. That lock is now lifted deliberately, so the engines can
// be improved — which means we need a way to tell "improved" from "broken".
//
// This captures a fingerprint of what each engine currently produces, for a
// battery of stroke shapes that historically caused trouble (loops, near-touch
// gaps, sharp corners, thin/thick extremes, self-intersection). Re-run it after
// any engine change and compare:
//
//   node scripts/verify/geometry-baseline.mjs --save=before
//   ...change engines...
//   node scripts/verify/geometry-baseline.mjs --save=after
//   node scripts/verify/geometry-baseline.mjs --compare=before,after
//
// What it records per (mode x shape):
//   - vertex / triangle counts        (topology scale)
//   - bounding box                    (did the form change size/place?)
//   - export byte length              (does it still export at all?)
//   - a rendered frame                (does it still LOOK right?)
//   - build status / diagnostics      (engine's own health report)
//
// A change is not automatically a regression — improving an engine SHOULD move
// these numbers. The point is that every move is visible and deliberate rather
// than discovered three phases later.
import { chromium } from "playwright-core"
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const BASE = join(ROOT, "docs", "verification", "geometry")

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}

const MODES = ["rod", "extrude", "solid", "inflate"]

/**
 * Stroke shapes chosen from this project's own history of geometry failures —
 * every one of these is named in SESSION-HANDOFF as a case that broke something
 * at some point.
 */
const SHAPES = {
  // the everyday case
  loopyS: () => {
    const p = []
    for (let i = 0; i <= 120; i++) {
      const t = i / 120
      p.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 })
    }
    return [p]
  },
  // open C — must NOT produce a fake hole in Solid
  openC: () => {
    const p = []
    for (let i = 0; i <= 90; i++) {
      const a = Math.PI * 0.35 + (i / 90) * Math.PI * 1.3
      p.push({ x: 420 + Math.cos(a) * 180, y: 380 + Math.sin(a) * 180 })
    }
    return [p]
  },
  // closed O — SHOULD produce a through-hole in Solid
  closedO: () => {
    const p = []
    for (let i = 0; i <= 100; i++) {
      const a = (i / 100) * Math.PI * 2
      p.push({ x: 420 + Math.cos(a) * 170, y: 380 + Math.sin(a) * 170 })
    }
    return [p]
  },
  // near-touch gap — must NOT bridge into a false hole
  nearTouch: () => {
    const p = []
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 1.93
      p.push({ x: 420 + Math.cos(a) * 170, y: 380 + Math.sin(a) * 170 })
    }
    return [p]
  },
  // sharp corners — corner preservation vs smoothing
  zigzag: () => {
    const p = []
    for (let i = 0; i <= 8; i++) {
      p.push({ x: 120 + i * 80, y: i % 2 === 0 ? 260 : 500 })
    }
    return [p]
  },
  // self-intersecting scribble — the classic Extrude killer
  scribble: () => {
    const p = []
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 6
      p.push({ x: 420 + Math.cos(t) * (60 + t * 18), y: 380 + Math.sin(t * 1.3) * 120 })
    }
    return [p]
  },
  // multi-stroke: two separate marks
  twoStrokes: () => [
    Array.from({ length: 50 }, (_, i) => ({ x: 140 + i * 6, y: 300 })),
    Array.from({ length: 50 }, (_, i) => ({ x: 140 + i * 6, y: 460 })),
  ],
  // very short tick — degenerate input
  tick: () => [Array.from({ length: 6 }, (_, i) => ({ x: 400 + i * 4, y: 380 + i * 3 }))],
}

async function capture(label) {
  const OUT = join(BASE, label)
  mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--use-angle=metal"] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__geomDebug,
    null,
    { timeout: 30000 },
  )
  await page.evaluate(() => window.__captureHarness.enable())

  const report = {}
  for (const [name, make] of Object.entries(SHAPES)) {
    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 12 }), make())
    await page.waitForTimeout(900)
    await page.evaluate(() => window.__revealHarness.setProgress(1))

    for (const mode of MODES) {
      await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
      await page.waitForTimeout(700)
      await page.evaluate(() => window.__captureHarness.frontView(1))
      await page.waitForTimeout(350)

      const stats = await page.evaluate(() => window.__geomDebug.stats?.() ?? null)
      const bytes = await page.evaluate(() => window.__geomDebug.exportBytes())
      const url = await page.evaluate(() => window.__captureHarness.grab())
      const m = (url || "").match(/base64,(.+)/)
      if (m) writeFileSync(join(OUT, `${name}_${mode}.png`), Buffer.from(m[1], "base64"))

      report[`${name}/${mode}`] = { ...(stats || {}), exportBytes: bytes }
      console.log(
        `[geom] ${name}/${mode}  verts=${stats?.vertices ?? "?"} tris=${stats?.triangles ?? "?"} bytes=${bytes}`,
      )
    }
  }

  report.__consoleErrors = errors.length
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2))
  await browser.close()
  console.log(`\n[geom] saved baseline '${label}' (console errors: ${errors.length})`)
}

function compare(a, b) {
  const ra = JSON.parse(readFileSync(join(BASE, a, "report.json"), "utf8"))
  const rb = JSON.parse(readFileSync(join(BASE, b, "report.json"), "utf8"))
  console.log(`\ncase                       verts        tris         bytes`)
  let broke = 0
  for (const k of Object.keys(ra)) {
    if (k.startsWith("__")) continue
    const x = ra[k]
    const y = rb[k] || {}
    const d = (p) => {
      const u = x[p] ?? 0
      const v = y[p] ?? 0
      if (u === v) return "="
      const pct = u ? Math.round(((v - u) / u) * 100) : 0
      return `${v}(${pct > 0 ? "+" : ""}${pct}%)`
    }
    // The only hard failure is producing NOTHING where there was something.
    const died = (x.vertices ?? 0) > 0 && (y.vertices ?? 0) === 0
    const noExport = (x.exportBytes ?? 0) > 1000 && (y.exportBytes ?? 0) <= 1000
    if (died || noExport) broke++
    console.log(
      `${k.padEnd(26)} ${String(d("vertices")).padEnd(12)} ${String(d("triangles")).padEnd(12)} ${d(
        "exportBytes",
      )}${died ? "   *** GEOMETRY DIED ***" : ""}${noExport ? "   *** EXPORT DIED ***" : ""}`,
    )
  }
  console.log(
    broke === 0
      ? "\nNo hard regressions (nothing died). Compare the PNGs to judge whether the changes are improvements."
      : `\n${broke} HARD REGRESSION(S) — geometry or export died.`,
  )
  process.exit(broke === 0 ? 0 : 1)
}

const save = arg("save", "")
const cmp = arg("compare", "")
if (cmp) {
  const [a, b] = cmp.split(",")
  if (!existsSync(join(BASE, a)) || !existsSync(join(BASE, b))) {
    console.error(`missing baseline: need ${a} and ${b} under ${BASE}`)
    process.exit(1)
  }
  compare(a, b)
} else {
  capture(save || "baseline").catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

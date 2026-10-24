// _PROBE-PENTIP-LAB3D — the OTHER surface the tip lands on, and the one where
// the argument for it does not hold.
//
// `applyPenTip`'s whole justification is that through the hero's draw beat the
// mark is FLAT, so what reads is a filled silhouette and a fragment discard can
// carve it to any 2D shape. **`/` is not flat.** The lab draws the same word in
// on the same Inflate surface with `flatten` at its solid default, so there the
// discard is cutting a TUBE — and a tube with its end removed is open, which is
// a thing you can see into.
//
// This does not assume that is fine. It captures the same mid-draw playhead with
// the tip OFF and ON, in Inflate, on the real lab page, and asks two questions
// the flat surface cannot answer:
//
//   1. Does the moving end still read as a solid form, or has a hole opened?
//      Measured as the DARKEST interior value near the tip — a hole into an
//      unlit tube interior is much darker than the lit exterior, and the parked
//      prior has the same open end (a flat cut), so the comparison is
//      open-vs-open rather than solid-vs-open.
//   2. Does anything come apart — stray fragments detached from the mark?
//      Counted as connected components, which is a property no single number
//      about brightness can carry.
//
// Usage: node scripts/verify/_probe-pentip-lab3d.mjs
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "pentip", "lab3d")
const VIEW = { width: 1500, height: 1460 }
const MODES = ["off", "cut", "nib", "quill"]
const ATS = [0.35, 0.55, 0.75]

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
  // RETURNS ITS OWN VERDICT. It used to return `undefined`, so the caller's
  // `if (!say(...))` was true on every row and the inert-guard tripped on a
  // run where all three shapes had moved — a gate red when everything is right,
  // which is the same disease as one green when nothing is.
  return ok
}

async function read(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = img.height
  const luma = new Uint8Array(W * H)
  const hist = new Uint32Array(256)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[p] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  const m = new Uint8Array(W * H)
  let n = 0
  let darkest = 255
  for (let p = 0; p < luma.length; p++) {
    if (luma[p] < cut) {
      m[p] = 1
      n++
      if (luma[p] < darkest) darkest = luma[p]
    }
  }
  /* CONNECTED COMPONENTS over the form's own mask. A count that jumps means the
   * mark came apart, which is the failure a brightness number cannot see. Only
   * components above a floor count — single antialiased pixels at a threshold
   * are noise in both arms and would swamp the signal. */
  const seen = new Uint8Array(W * H)
  const stack = new Int32Array(W * H)
  let comps = 0
  for (let p = 0; p < W * H; p++) {
    if (!m[p] || seen[p]) continue
    let sp = 0
    stack[sp++] = p
    seen[p] = 1
    let size = 0
    while (sp > 0) {
      const q = stack[--sp]
      size++
      const qx = q % W
      const qy = (q / W) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = qx + dx
        const ny = qy + dy
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue
        const r = ny * W + nx
        if (m[r] && !seen[r]) {
          seen[r] = 1
          stack[sp++] = r
        }
      }
    }
    if (size >= 24) comps++
  }
  return { img, n, darkest, comps, paper }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(`${LAB_URL}/`, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness, null, { timeout: 120000 })
  const pts = []
  for (let i = 0; i <= 90; i++) {
    const t = i / 90
    pts.push({ x: 170 + t * 430, y: 330 + Math.sin(t * Math.PI * 2.2) * 105 })
  }
  await page.evaluate((x) => window.__styleHarness.injectStrokes(x, { msPerPoint: 12 }), [pts])
  await page.waitForTimeout(1500)

  /* INFLATE **WITH `fusion: "implicit"`**, and the second half is the whole
   * point of this probe.
   *
   * ⚠ THE FIRST VERSION OF THIS PROBE WAS A GREEN ROW THAT COULD NOT FAIL. It
   * clicked the Inflate pill and stopped there — and `DEFAULT_INFLATE_PARAMS`
   * ships `fusion: "auto"`, which `inflateRevealsByDrawRange` does NOT accept
   * (it tests `=== "implicit"`). So the lab was revealing by REBUILDING from
   * clipped strokes, which already produces a real end, `revealKeys` was absent,
   * the tip was correctly inert, and all four modes rendered byte-identical
   * frames — 140932 / 178491 / 237464 ink at the three playheads, the SAME in
   * every arm. Every assertion passed by comparing a frame to itself.
   *
   * That finding is worth keeping rather than deleting: **the defect this lane
   * fixes only exists where the reveal is a `setDrawRange` prefix**, which is
   * exactly where explainer 18 put it. Everywhere else the moving end is a real
   * end the engine drew. So the probe now FORCES the implicit path through the
   * page's own harness, asserts it took, and refuses to report anything unless
   * the four shapes actually diverge. */
  await page.evaluate(() => window.__styleHarness.setMode("inflate"))
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__styleHarness.setInflate({ fusion: "implicit" }))
  await page.waitForTimeout(3500)
  const cfg = await page.evaluate(() => {
    const g = window.__styleHarness.get()
    return { mode: g.geometryMode, fusion: g.inflateParams?.fusion ?? null }
  })
  say(cfg.mode === "inflate", "the lab is in INFLATE", String(cfg.mode))
  say(
    cfg.fusion === "implicit",
    "and its fusion is IMPLICIT — the only path with a reveal table, i.e. the only one this fix reaches",
    `${cfg.fusion} (the shipped default is "auto", which reveals by REBUILD and needs no fix)`,
  )
  const hasTip = await page.evaluate(() => typeof window.__captureHarness?.setPenTip === "function")
  say(hasTip, "the lab page carries the tip hook too", String(hasTip))

  const setP = async (u) => {
    await page.evaluate((uu) => window.__revealHarness.setProgress(uu), u)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(200)
  }

  const rows = []
  for (const u of ATS) {
    const per = {}
    for (const m of MODES) {
      await page.evaluate((mm) => window.__captureHarness.setPenTip(mm), m)
      await setP(Math.max(0, u - 0.02))
      await setP(u)
      const buf = await page.screenshot()
      writeFileSync(join(OUT, `u${String(Math.round(u * 100))}-${m}.png`), buf)
      per[m] = await read(buf)
    }
    rows.push({ u, per })
    console.log(
      `  u=${u}  ` +
        MODES.map((m) => `${m} ink ${per[m].n} darkest ${per[m].darkest} comps ${per[m].comps}`).join("  ·  "),
    )
  }

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")

  /* ---- THE TIP MUST NOT BE INERT HERE, OR NOTHING BELOW MEANS ANYTHING ----
   * Every row after this compares an arm against the parked prior. If the arms
   * are the same frame, all of them pass by comparing a frame to itself. */
  let alive = true
  for (const r of rows) {
    const moved = MODES.filter((m) => m !== "off" && r.per[m].n !== r.per.off.n).length
    if (!say(moved > 0, `u=${r.u} — the tip actually MOVES this surface`, `${moved} of 3 shapes differ from the prior in ink`)) alive = false
  }
  if (!alive) {
    console.log(
      "\n⚠ THE TIP IS INERT ON THIS SURFACE. Nothing below is reported: every row\n" +
        "  compares an arm against the prior, and identical arms pass by comparing a\n" +
        "  frame to itself. Check that `fusion` is `implicit` — `auto` reveals by\n" +
        "  rebuild and this fix does not (and need not) reach it.",
    )
    writeFileSync(join(OUT, "lab3d.json"), JSON.stringify({ inert: true, rows: rows.map((r) => ({ u: r.u, ink: Object.fromEntries(MODES.map((m) => [m, r.per[m].n])) })) }, null, 2))
    await context.close()
    await browser.close()
    process.exit(1)
  }

  for (const r of rows) {
    /* THE PARKED PRIOR IS THE REFERENCE, not an absolute. Its end is already an
     * open cut through the tube, so the question is whether the fix opens it
     * FURTHER — not whether the tube is open, which it always was. */
    for (const m of MODES) {
      say(
        r.per[m].darkest >= r.per.off.darkest - 6,
        `u=${r.u} ${m} — the moving end is no darker inside than the prior's own open cut`,
        `darkest ${r.per[m].darkest} vs prior ${r.per.off.darkest}`,
      )
      say(
        r.per[m].comps <= r.per.off.comps,
        `u=${r.u} ${m} — the mark does not come apart`,
        `${r.per[m].comps} components vs prior ${r.per.off.comps}`,
      )
    }
  }

  writeFileSync(
    join(OUT, "lab3d.json"),
    JSON.stringify(
      rows.map((r) => ({ u: r.u, per: Object.fromEntries(MODES.map((m) => [m, { ink: r.per[m].n, darkest: r.per[m].darkest, comps: r.per[m].comps }])) })),
      null,
      2,
    ),
  )
  await context.close()
  await browser.close()
  console.log(`\nframes: ${OUT}`)
  console.log(pass ? "\nALL PASS" : "\nFAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

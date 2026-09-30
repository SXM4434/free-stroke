// DRAWIN-CURVE · Custom, the fifth ease, on the draw-in itself (row 12, ruling item 3).
//
// Seven rows, each with an arm that MUST fail and is shown failing:
//   1 the four presets give byte-identical playheads to main 45ed049fc at 64 clocks;
//   2 picking Custom from a preset writes nothing: the playhead stays the preset's at 64 clocks;
//   3 after a drag, the live playhead follows the dragged bezier at 64 clocks within 1e-6;
//   4 an overshoot handle: the reveal CLAMPS at 1 and holds, never passes it;
//   5 a per-stroke curve lands on that stroke's row and no other;
//   6 the envelope curve and the stroke curve survive a reload;
//   7 Cmd-Z undoes a whole drag in one press.
//
// CORPUS: the whole-draw ease through the frame loop's own ref, and the per-stroke ease as the
// take's rows. NOT covered: the per-stroke curve's effect on a stroke's drawn length (the take
// rows feed `easeFnOf`, which assert-stroke-timing-browser grades), and any host but the lab.
//
// Reads the ease the frame loop reads (`__revealHarness.liveEase` / `playheadAt`, both through
// `revealEaseRef`). Main's reference is main's own `easeReveal` source, pulled with `git show`.
// Env: FS_PORT (3139 for the lane), FS_HEADED=0.

import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { execSync } from "node:child_process"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "drawin-curve")
const MAIN = "45ed049fc"
const N = 64
const T = Array.from({ length: N }, (_, k) => k / (N - 1))
const K = 5
const PRESETS = ["linear", "in", "out", "inOut"]

let pass = 0
let fail = 0
const results = []
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  :  ${detail}` : ""}`)
  results.push({ ok, name, detail: detail ?? null })
  ok ? pass++ : fail++
}
/* A must-fail arm: `check` run on a broken input has to come back false. */
const mustFail = (name, broke, detail) => row(broke === false, `${name} [must-fail fires]`, detail)

/* MAIN'S easeReveal, from main's own source, never retyped here. */
const mainSrc = execSync(`git -C "${ROOT}" show ${MAIN}:lib/stroke-timing.ts`, { encoding: "utf8" })
const m = mainSrc.match(/export function easeReveal\(t: number, ease: RevealEase\): number \{([\s\S]*?)\n\}\n/)
if (!m) throw new Error("main's easeReveal not found: the reference cannot be built")
const mainEase = new Function("t", "ease", m[1])

/* An independent cubic-bezier: Newton on x with a bisection fallback. Not the app's solver. */
const bzAt = (c, u) => {
  if (u <= 0) return 0
  if (u >= 1) return 1
  const X = (s) => 3 * (1 - s) ** 2 * s * c.x1 + 3 * (1 - s) * s * s * c.x2 + s ** 3
  const dX = (s) => 3 * (1 - s) ** 2 * c.x1 + 6 * (1 - s) * s * (c.x2 - c.x1) + 3 * s * s * (1 - c.x2)
  let s = u
  for (let i = 0; i < 12; i++) {
    const d = dX(s)
    if (Math.abs(d) < 1e-9) break
    s = Math.min(1, Math.max(0, s - (X(s) - u) / d))
  }
  if (Math.abs(X(s) - u) > 1e-13) {
    let lo = 0, hi = 1
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2
      X(mid) < u ? (lo = mid) : (hi = mid)
    }
    s = (lo + hi) / 2
  }
  return 3 * (1 - s) ** 2 * s * c.y1 + 3 * (1 - s) * s * s * c.y2 + s ** 3
}
const maxErr = (a, b) => a.reduce((mx, v, i) => Math.max(mx, Math.abs(v - b[i])), 0)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

mkdirSync(OUT, { recursive: true })
const polys = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8")).polylines
const browser = await chromium.launch()
const pageErrors = []
/* React catches a render crash in a boundary, so it never reaches `pageerror`: the harness just
 * vanishes and the next read times out. Console errors are kept so that timeout names its cause. */
const consoleErrors = []
let context = null
let page = null

/* The harness is re-published when the ease changes, so every read waits for it. */
const ready = () => page.waitForFunction(() => window.__revealHarness?.liveEase, null, { timeout: 60000 })
const live = async () => (await ready(), page.evaluate(() => window.__revealHarness.liveEase()))
const samples = async () => (await ready(), page.evaluate((t) => t.map((c) => window.__revealHarness.playheadAt(c)), T))
const knock = (name) => page.evaluate((n) => { window.__fsCurveKnockout = n }, name)
const take = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__fsTake.get().take)))
const click = async (sel) => {
  await page.locator(sel).first().click()
  await page.waitForTimeout(350)
}
const drag = async (tag, side, fx, fy) => {
  /* A second editor open above pushes this one past the panel's scroll edge, and a mouse
   * event at an off-screen point lands on nothing: the drag "ran" and wrote nothing. */
  await page.locator(`[data-ease-curve="${tag}"]`).first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(150)
  const box = await page.locator(`[data-ease-curve="${tag}"] [data-curve-box]`).first().boundingBox()
  const h = await page.locator(`[data-ease-curve="${tag}"] [data-curve-handle="${side}"]`).first().boundingBox()
  const x0 = h.x + h.width / 2, y0 = h.y + h.height / 2
  const x1 = box.x + fx * box.width, y1 = box.y + box.height - fy * box.height
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  for (let k = 1; k <= 8; k++) await page.mouse.move(x0 + ((x1 - x0) * k) / 8, y0 + ((y1 - y0) * k) / 8)
  await page.mouse.up()
  await page.waitForTimeout(400)
}
const open = async (fresh) => {
  if (context) await context.close()
  context = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })
  page = await context.newPage()
  page.on("pageerror", (e) => pageErrors.push(String(e)))
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness?.liveEase && window.__fsTake, null, { timeout: 240000 })
  if (fresh) {
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
    await page.waitForTimeout(1500)
    await page.evaluate(() => { window.__revealHarness.setEase("linear"); window.__revealHarness.setPlaying(false) })
  }
  await page.waitForTimeout(600)
  await page.getByRole("button", { name: /^Animation/ }).first().click()
  await page.waitForTimeout(800)
}

try {
  await open(true)

  // ── 1 · presets byte-identical to main ──
  let bad1 = []
  for (const id of PRESETS) {
    await click(`[data-envelope-ease="${id}"]`)
    const e = await live()
    const got = await samples()
    const want = T.map((t) => mainEase(t, id))
    if (e !== id || !same(got, want)) bad1.push(`${id}: ease ${JSON.stringify(e)}, max diff ${maxErr(got, want)}`)
  }
  row(bad1.length === 0, "1 presets: live playhead at 64 clocks === main's easeReveal, all four", bad1.join("; ") || "4 of 4 byte-identical")
  {
    await click(`[data-envelope-ease="in"]`)
    const got = await samples()
    mustFail("1 live `in` compared with main's `out`", same(got, T.map((t) => mainEase(t, "out"))))
  }

  // ── 2 · Custom seeded from a preset writes nothing ──
  let bad2 = []
  const seedErr = {}
  for (const id of PRESETS) {
    await click(`[data-envelope-ease="${id}"]`)
    await click(`[data-ease-custom="envelope"]`)
    const e = await live()
    const got = await samples()
    const opened = await page.locator(`[data-ease-curve="envelope"]`).count()
    const seed = await page.locator(`[data-ease-curve="envelope"]`).first().evaluate((el) => ({
      x1: +el.dataset.x1, y1: +el.dataset.y1, x2: +el.dataset.x2, y2: +el.dataset.y2,
    }))
    seedErr[id] = maxErr(T.map((t) => bzAt(seed, t)), T.map((t) => mainEase(t, id)))
    if (e !== id || !same(got, T.map((t) => mainEase(t, id))) || opened !== 1) bad2.push(`${id}: ease ${JSON.stringify(e)}, editor ${opened}`)
  }
  row(bad2.length === 0, "2 Custom from each preset: editor opens, ease unchanged, 64 playheads === main", bad2.join("; ") || "4 of 4")
  row(seedErr.linear < 1e-12 && seedErr.in < 1e-12 && seedErr.out < 1e-12 && seedErr.inOut < 0.0085,
    "2b the seed drawn in the editor is the preset's curve",
    Object.entries(seedErr).map(([k, v]) => `${k} ${v.toExponential(2)}`).join(", ") + " (inOut is two cubics; no single bezier is it)")
  {
    await click(`[data-envelope-ease="inOut"]`)
    await knock("seed-write")
    await click(`[data-ease-custom="envelope"]`)
    const e = await live()
    const got = await samples()
    await knock(null)
    mustFail("2 knockout seed-write: Custom writes the seed", e === "inOut" && same(got, T.map((t) => mainEase(t, "inOut"))),
      `ease became ${JSON.stringify(e)}, max diff ${maxErr(got, T.map((t) => mainEase(t, "inOut"))).toExponential(2)}`)
  }

  // ── 3 · after a drag the playhead follows the bezier ──
  await click(`[data-envelope-ease="out"]`)
  await click(`[data-ease-custom="envelope"]`)
  await drag("envelope", "in", 0.2, 0.8)
  const c3 = await live()
  const got3 = await samples()
  const want3 = T.map((t) => bzAt(c3, t))
  const moved3 = maxErr(got3, T.map((t) => mainEase(t, "out")))
  row(typeof c3 === "object" && maxErr(got3, want3) <= 1e-6 && moved3 > 1e-3,
    "3 after a drag: live playhead at 64 clocks follows the dragged bezier within 1e-6",
    `curve ${JSON.stringify(c3)}, max err ${maxErr(got3, want3).toExponential(2)}, moved from out by ${moved3.toFixed(3)}`)
  {
    const off = { ...c3, y2: c3.y2 + 0.01 }
    mustFail("3 compared with the curve 0.01 off", maxErr(got3, T.map((t) => bzAt(off, t))) <= 1e-6)
  }
  await page.locator(`[data-envelope-ease="out"]`).first().evaluate((el) => el.closest(".flex.flex-col")?.scrollIntoView({ block: "center" }))
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(OUT, "custom-editor-1512x982.png") })

  // ── 3c · the editor fits its column ──
  /* Every number field and preset inside the field's own box. `n` is the positive control:
   * 4 numbers and 2 presets must be SEEN, or an empty editor would pass by containing nothing. */
  const fits = () => page.evaluate(() => {
    const f = document.querySelector('[data-ease-curve="envelope"]')
    if (!f) return { n: 0, out: ["no editor"], hold: false }
    const r = f.getBoundingClientRect()
    const kids = [...f.querySelectorAll("[data-curve-num], [data-curve-preset]")]
    const out = kids.filter((k) => {
      const b = k.getBoundingClientRect()
      return b.right > r.right + 0.5 || b.left < r.left - 0.5 || b.bottom > r.bottom + 0.5 || b.height > 30
    })
    return { n: kids.length, out: out.map((k) => k.dataset.curveNum ?? k.dataset.curvePreset), hold: !!f.querySelector('[data-curve-preset="hold"]'), w: Math.round(r.width) }
  })
  const f3 = await fits()
  row(f3.n === 6 && f3.out.length === 0 && !f3.hold,
    "3c the Custom editor fits its column: 4 numbers and 2 presets inside the field, one line each, no Hold",
    `field ${f3.w}px, seen ${f3.n}, outside [${f3.out}], hold ${f3.hold}`)
  {
    await knock("no-fit")
    await click(`[data-envelope-ease="out"]`)
    await click(`[data-ease-custom="envelope"]`)
    const k3 = await fits()
    await knock(null)
    await click(`[data-envelope-ease="out"]`)
    await click(`[data-ease-custom="envelope"]`)
    mustFail("3c knockout no-fit: the key lanes' 430px row in the column", k3.n >= 6 && k3.out.length === 0 && !k3.hold,
      `seen ${k3.n}, outside [${k3.out}], hold ${k3.hold}`)
  }

  // ── 4 · overshoot: clamps ──
  await drag("envelope", "in", 0.4, 1.4)
  const c4 = await live()
  const got4 = await samples()
  const rawMax = Math.max(...Array.from({ length: 2001 }, (_, k) => bzAt(c4, k / 2000)))
  const okShape = (s) => s.every((v, i) => v <= 1 && v >= 0 && (i === 0 || v >= s[i - 1])) && Math.max(...s) === 1
  const firstFull = got4.findIndex((v) => v === 1)
  row(typeof c4 === "object" && c4.y2 > 1 && rawMax > 1 && okShape(got4) && firstFull < N - 1,
    "4 overshoot handle: the reveal CLAMPS at 1 and holds; it never passes 1 or runs back",
    `y2 ${c4.y2}, raw curve peaks ${rawMax.toFixed(4)}, live max ${Math.max(...got4)}, full from clock ${T[firstFull]?.toFixed(3)}`)
  mustFail("4 the same shape check on the raw, unclamped bezier", okShape(T.map((t) => bzAt(c4, t))))

  // ── 5 · a per-stroke curve changes only that stroke ──
  await click(`[data-envelope-ease="linear"]`)
  await page.locator("[data-selected]").nth(K).click()
  await page.waitForTimeout(500)
  const before5 = await take()
  await click(`[data-ease-custom="stroke"]`)
  const seed5 = await take()
  await drag("stroke", "in", 0.2, 0.9)
  const after5 = await take()
  const changed = (a, b) => Object.keys({ ...a.strokes, ...b.strokes }).filter((k) => !same(a.strokes[k] ?? null, b.strokes[k] ?? null))
  const ch5 = changed(before5, after5)
  const e5 = after5.strokes[K]?.ease
  const seedCh5 = changed(before5, seed5)
  row(seedCh5.length === 0 && same(ch5, [String(K)]) && e5?.kind === "bezier" && (await live()) === "linear",
    "5 per-stroke Custom: opening it writes nothing, a drag changes only stroke 5's row to a bezier, the whole-draw ease stays linear",
    `rows changed by opening [${seedCh5}], by the drag [${ch5}], stroke ${K} ease ${JSON.stringify(e5)}`)
  {
    const pre = await take()
    await knock("stroke-neighbour")
    await drag("stroke", "in", 0.3, 0.7)
    await knock(null)
    const post = await take()
    mustFail("5 knockout stroke-neighbour: the curve lands on stroke 6", same(changed(pre, post), [String(K)]), `changed rows [${changed(pre, post)}]`)
  }

  // ── 6 · survives save and reload ──
  await click(`[data-envelope-ease="in"]`)
  await click(`[data-ease-custom="envelope"]`)
  await drag("envelope", "out", 0.5, -0.1)
  const c6 = await live()
  const s6 = (await take()).strokes[K]?.ease
  await page.waitForTimeout(2500)
  /* What the save wrote, read raw, so a miss says whether the write or the read lost it. */
  const stored6 = await page.evaluate(() => {
    for (let k = 0; k < localStorage.length; k++) {
      const v = localStorage.getItem(localStorage.key(k)) ?? ""
      const at = v.indexOf('"revealEnvelope"')
      if (at >= 0) return v.slice(at, at + 160)
    }
    return "no saved revealEnvelope"
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => window.__revealHarness?.liveEase && window.__fsTake, null, { timeout: 240000 })
  await page.waitForTimeout(1500)
  const c6r = await live()
  const s6r = (await take()).strokes[K]?.ease
  row(typeof c6 === "object" && same(c6, c6r) && s6?.kind === "bezier" && same(s6, s6r),
    "6 reload: the whole-draw curve and stroke 5's curve come back exact",
    `before ${JSON.stringify(c6)}, stored ${stored6}, after ${JSON.stringify(c6r)}, stroke ${JSON.stringify(s6r)}`)
  {
    const ctx2 = await browser.newContext({ viewport: { width: 1512, height: 982 } })
    const p2 = await ctx2.newPage()
    await p2.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
    await p2.waitForFunction(() => window.__revealHarness?.liveEase, null, { timeout: 240000 })
    const fresh = await p2.evaluate(() => window.__revealHarness.liveEase())
    await ctx2.close()
    mustFail("6 a fresh profile with no saved doc", same(c6, fresh), `fresh ease ${JSON.stringify(fresh)}`)
  }

  // ── 7 · Cmd-Z undoes a drag ──
  await page.getByRole("button", { name: /^Animation/ }).first().click().catch(() => {})
  await page.waitForTimeout(600)
  const c7a = await live()
  await drag("envelope", "in", 0.7, 0.3)
  const c7b = await live()
  await page.keyboard.press("Meta+z")
  await page.waitForTimeout(600)
  const c7c = await live()
  row(!same(c7a, c7b) && same(c7a, c7c), "7 one Cmd-Z after an 8-move drag puts the curve back", `before ${JSON.stringify(c7a)}, after undo ${JSON.stringify(c7c)}`)
  {
    await knock("gesture")
    await drag("envelope", "in", 0.3, 0.6)
    await knock(null)
    await page.keyboard.press("Meta+z")
    await page.waitForTimeout(600)
    mustFail("7 knockout gesture: every move is its own undo step", same(c7c, await live()), `after one undo ${JSON.stringify(await live())}`)
  }
} catch (e) {
  row(false, "gate ran to the end", `${String(e).slice(0, 300)}${consoleErrors.length ? ` | console: ${consoleErrors.slice(-2).join(" | ")}` : ""}`)
} finally {
  row(pageErrors.length === 0, "no page errors", pageErrors.slice(0, 2).join(" | "))
  writeFileSync(join(OUT, "result.json"), JSON.stringify({ main: MAIN, pass, fail, results }, null, 2))
  await browser.close()
  console.log(`\nassert-drawin-curve: ${pass} pass, ${fail} fail`)
  process.exit(fail ? 1 : 0)
}

// _PROBE-VIEWPORT-COMMIT — WHERE THE MAIN THREAD GOES ON THE GESTURE HE MAKES.
//
// ── WHY THIS ONE AND NOT `_probe-hero-lag` ─────────────────────────────────
//
// That probe measures rAF INTERVALS, which is what the compositor delivered.
// This one measures JS SELF TIME, which is what the page spent, and they are
// different questions: at 120 Hz a page can be inside budget on the first and
// still be burning two thirds of its frame on React.
//
// ⚠ AND IT PROFILES THE GESTURE HE ACTUALLY PERFORMS. A previous lane measured
// a load-and-idle, declared the surface clean, and it was visibly janky in the
// hand. So one take covers: LOAD → press PLAY → watch the whole 12.37 s beat →
// SCRUB the transport → SWITCH the engine and look pills. Retina
// (deviceScaleFactor 2), because the fragment cost of the carve and the tip is
// per PIXEL and dsf 1 hides four fifths of it.
//
// Usage: node scripts/verify/_probe-viewport-commit.mjs [--label=run] [--dsf=2]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const DSF = parseFloat(arg("dsf", "2"))
const ENGINE = arg("engine", "desk-doodles")
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/viewport-commit/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 3 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "viewport-commit", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const VIEW = { width: 1600, height: 1600 }

const main = async () => {
  EV.open()

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(2500)
  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(3500)

  // wobble 0, endpoint clean — his state.
  await page.evaluate(() => {
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const t = (inp.closest("div")?.parentElement?.textContent ?? "").toLowerCase()
      if (t.includes("wobble")) {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        s.call(inp, "0")
        inp.dispatchEvent(new Event("input", { bubbles: true }))
        inp.dispatchEvent(new Event("change", { bubbles: true }))
        break
      }
    }
  })
  await page.waitForTimeout(2000)
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); break }
    }
  })
  await page.waitForTimeout(2000)

  /* A WARM TAKE FIRST. The first play after load pays for shader compile and the
   * first geometry build, and neither is the beat. */
  await page.click("[data-hero-play]")
  await page.waitForTimeout(13500)
  await page.evaluate(() => {
    document.querySelectorAll("button").forEach((b) => {
      if ((b.textContent ?? "").trim().toLowerCase() === "reset") b.click()
    })
  })
  await page.waitForTimeout(1200)

  const cdp = await context.newCDPSession(page)
  await cdp.send("Profiler.enable")
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 })
  await page.evaluate(() => {
    window.__ft = []
    let last = performance.now()
    const f = () => {
      const n = performance.now()
      window.__ft.push(n - last)
      last = n
      window.__ftRaf = requestAnimationFrame(f)
    }
    window.__ftRaf = requestAnimationFrame(f)
  })
  await cdp.send("Profiler.start")

  /* ---- THE GESTURE ------------------------------------------------------- */
  const marks = []
  const mark = async (name, fn, ms) => {
    const t0 = Date.now()
    await fn()
    if (ms) await page.waitForTimeout(ms)
    marks.push({ name, ms: Date.now() - t0 })
  }
  await mark("PLAY + watch the whole beat", () => page.click("[data-hero-play]"), 13000)
  await mark(
    "SCRUB the transport",
    async () => {
      for (let i = 0; i <= 24; i++) {
        await page.evaluate((v) => {
          const el = document.querySelector("[data-hero-scrub]")
          const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
          s.call(el, String(v))
          el.dispatchEvent(new Event("input", { bubbles: true }))
        }, (i / 24) * 12.3)
        await page.waitForTimeout(40)
      }
    },
    300,
  )
  await mark(
    "SWITCH the pills",
    async () => {
      for (const sel of [
        '[data-engine-option="free-stroke"]',
        '[data-engine-option="desk-doodles"]',
      ]) {
        await page.click(sel)
        await page.waitForTimeout(1800)
      }
    },
    300,
  )

  const { profile } = await cdp.send("Profiler.stop")
  const ft = await page.evaluate(() => {
    cancelAnimationFrame(window.__ftRaf)
    return window.__ft.slice(5)
  })

  /* ---- SELF TIME BY FUNCTION -------------------------------------------- */
  const byId = new Map()
  for (const n of profile.nodes) byId.set(n.id, n)
  const hits = new Map()
  for (const n of profile.nodes) hits.set(n.id, n.hitCount || 0)
  const total = profile.samples ? profile.samples.length : 0
  const dur = (profile.endTime - profile.startTime) / 1000
  const perSample = total > 0 ? dur / total : 0
  const rows = []
  for (const n of profile.nodes) {
    const h = hits.get(n.id) || 0
    if (!h) continue
    const f = n.callFrame
    const where = f.url ? f.url.replace(/^https?:\/\/[^/]+\//, "") : "(native)"
    rows.push({
      name: f.functionName || "(anonymous)",
      where: `${where}:${f.lineNumber + 1}`,
      ms: h * perSample,
    })
  }
  const merged = new Map()
  for (const r of rows) {
    const k = `${r.name}|${r.where}`
    merged.set(k, (merged.get(k) || 0) + r.ms)
  }
  const top = [...merged.entries()]
    .map(([k, ms]) => ({ name: k.split("|")[0], where: k.split("|")[1], ms }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 30)

  /* ---- INCLUSIVE TIME UNDER A NAMED FRAME -------------------------------
   *
   * Self time says WHICH function burned the thread; it cannot say WHOSE
   * subtree asked for it. `jsxDEV` is one function called from everywhere, so a
   * self-time table cannot distinguish "the canvas re-renders per pose" from
   * "the panel's seconds readout re-renders per pose" — and those want opposite
   * fixes. This walks the sampler's own call tree and totals every sample
   * beneath each named frame, which is the question. */
  const childrenOf = new Map()
  for (const n of profile.nodes) childrenOf.set(n.id, n.children || [])
  const subtree = (id) => {
    let sum = 0
    const st = [id]
    const seen = new Set()
    while (st.length) {
      const x = st.pop()
      if (seen.has(x)) continue
      seen.add(x)
      sum += hits.get(x) || 0
      for (const c of childrenOf.get(x) || []) st.push(c)
    }
    return sum * perSample
  }
  const NAMED = [
    "DeskDoodlesHeroPage",
    "Viewport3D",
    "Viewport3DWrapper",
    "Scene",
    "AnimatedStrokes",
    "AnimatedStrokesInner",
    "StylePanelScaffold",
    "Canvas",
  ]
  const inclusive = []
  for (const name of NAMED) {
    let ms = 0
    let n = 0
    for (const node of profile.nodes) {
      if ((node.callFrame.functionName || "") !== name) continue
      ms += subtree(node.id)
      n++
    }
    if (n) inclusive.push({ name, ms, n })
  }
  inclusive.sort((a, b) => b.ms - a.ms)

  const s = [...ft].sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))]
  const frames = { n: s.length, p50: q(0.5), p95: q(0.95), worst: s[s.length - 1], over16: ft.filter((d) => d > 16.8).length, over33: ft.filter((d) => d > 33.4).length }

  /* REACT'S OWN COST, gathered by name. `performSyncWorkOnRoot` /
   * `commitRootImpl` / `beginWork` / `renderWithHooks` are the render+commit
   * phases; anything under `useMemo` shows up as the memo body itself. */
  const REACT = /^(performSyncWorkOnRoot|performConcurrentWorkOnRoot|renderRootSync|workLoopSync|beginWork|completeWork|commitRoot|commitRootImpl|commitMutationEffects|commitLayoutEffects|renderWithHooks|updateFunctionComponent|flushSync|dispatchSetState|updateMemo|mountMemo|reconcileChildFibers|createChild)/
  let reactMs = 0
  for (const [k, ms] of merged) if (REACT.test(k.split("|")[0])) reactMs += ms

  console.log(`\ngesture (dsf ${DSF}, engine ${ENGINE}) — profile ${dur.toFixed(0)} ms, ${total} samples @ ${(perSample * 1000).toFixed(0)} µs`)
  for (const m of marks) console.log(`   ${m.name.padEnd(30)} ${m.ms} ms`)
  console.log(`\nrAF intervals: n ${frames.n}  p50 ${frames.p50.toFixed(2)}  p95 ${frames.p95.toFixed(2)}  worst ${frames.worst.toFixed(2)}  >16.8ms ${frames.over16}  >33.4ms ${frames.over33}`)
  console.log(`\nJS self time, top 30:`)
  for (const r of top) console.log(`   ${r.ms.toFixed(1).padStart(8)} ms  ${r.name.padEnd(32)} ${r.where}`)
  console.log(`\nINCLUSIVE time under each named component (the whole subtree, not its own body):`)
  for (const r of inclusive) console.log(`   ${r.ms.toFixed(1).padStart(8)} ms  ${r.name}  (${r.n} call-tree node(s))`)
  console.log(`\nREACT render+commit self time: ${reactMs.toFixed(1)} ms of ${dur.toFixed(0)} ms wall (${((reactMs / dur) * 100).toFixed(1)} %)`)
  console.log(`page errors: ${errors.length ? errors.join(" | ") : 0}`)

  writeFileSync(join(OUT, "profile.json"), JSON.stringify({ marks, frames, top, inclusive, reactMs, dur, dsf: DSF, engine: ENGINE, errors }, null, 2))
  await context.close()
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\n${FINAL}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

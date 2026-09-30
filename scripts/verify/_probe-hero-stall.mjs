// _PROBE-HERO-STALL — the 1.2 s block, reproduced, repeated, and compared
// across the two engines.
//
// `_probe-hero-interact-cost.mjs` found it: changing a hand-feel dial WHILE THE
// BEAT IS PLAYING costs ONE long task of 1222 ms — a 1233 ms frame gap, i.e. the
// page freezes for over a second. The same change AT REST cost zero long tasks.
// That is a real, felt stall and it is Sebs's "laggy at parts".
//
// This repeats it N times per engine per gesture so the number is not one
// sample, and it asks the question the port depends on: DOES THE DESK DOODLES
// ENGINE PAY IT TOO? If it does not, that is a second thing the Desk Doodles
// path does better and it belongs in the same answer as the pen tip.
//
// The idle window is the control: if it ever records a long task, the observer
// is picking up something other than the gesture and the numbers are void.
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "stall")
const REPS = parseInt(arg("reps", "3"), 10)
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/hero-lag/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 5 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "hero-lag", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const VIEW = { width: 1600, height: 1600 }

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  EV.open()
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(1800)
  await page.click(`[data-register-option="desk-doodles"]`)
  await page.waitForTimeout(400)

  await page.evaluate(() => {
    window.__lt = []
    window.__gaps = []
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lt.push({ start: e.startTime, dur: e.duration })
    }).observe({ entryTypes: ["longtask"] })
    let last = performance.now()
    const tick = (now) => {
      window.__gaps.push(now - last)
      last = now
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  const measure = async (fn, settleMs = 3200) => {
    await page.evaluate(() => {
      window.__lt = []
      window.__gaps = []
    })
    await fn()
    await page.waitForTimeout(settleMs)
    const r = await page.evaluate(() => ({ lt: window.__lt.slice(), gaps: window.__gaps.slice() }))
    return {
      tasks: r.lt.length,
      blockedMs: r.lt.reduce((a, e) => a + e.dur, 0),
      worstTaskMs: r.lt.reduce((a, e) => Math.max(a, e.dur), 0),
      worstGapMs: r.gaps.reduce((a, g) => Math.max(a, g), 0),
    }
  }
  const setWobble = (v) =>
    page.evaluate((val) => {
      for (const inp of document.querySelectorAll('input[type="range"]')) {
        const row = inp.closest("div")?.parentElement
        if ((row?.textContent ?? "").toLowerCase().includes("wobble")) {
          const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
          s.call(inp, String(val))
          inp.dispatchEvent(new Event("input", { bubbles: true }))
          inp.dispatchEvent(new Event("change", { bubbles: true }))
          return
        }
      }
    }, v)
  const reset = async () => {
    await page.evaluate(() => {
      document.querySelectorAll("button").forEach((b) => {
        if ((b.textContent ?? "").trim().toLowerCase() === "reset") b.click()
      })
    })
    await page.waitForTimeout(400)
  }
  const stop = () =>
    page.evaluate(() => {
      document.querySelectorAll("button").forEach((b) => {
        if ((b.textContent ?? "").trim().toLowerCase() === "pause") b.click()
      })
    })

  const report = {}
  for (const engine of ["free-stroke", "desk-doodles"]) {
    await page.click(`[data-engine-option="${engine}"]`)
    await page.waitForTimeout(3500)
    await setWobble(0.4)
    await page.waitForTimeout(3500)

    const idle = await measure(async () => page.waitForTimeout(1500), 800)
    const rest = []
    const playing = []
    for (let i = 0; i < REPS; i++) {
      const v = 0.4 + 0.05 * (i + 1)
      // AT REST
      await stop()
      await page.waitForTimeout(500)
      rest.push(await measure(() => setWobble(v)))
      await setWobble(0.4)
      await page.waitForTimeout(3200)
      // WHILE PLAYING — the beat is 12.4 s so the nudge lands inside the draw
      await reset()
      await page.click("[data-hero-play]")
      await page.waitForTimeout(500)
      playing.push(await measure(() => setWobble(v)))
      await stop()
      await setWobble(0.4)
      await page.waitForTimeout(3200)
    }
    report[engine] = { idle, rest, playing }
    const f = (xs, k) => xs.map((x) => x[k].toFixed(0)).join(" / ")
    console.log(`\n=== ${engine} ===`)
    console.log(`  idle control            long tasks ${idle.tasks}  worst gap ${idle.worstGapMs.toFixed(0)} ms`)
    console.log(`  wobble nudge AT REST    long tasks ${rest.map((r) => r.tasks).join(" / ")}   worst task ${f(rest, "worstTaskMs")} ms   worst gap ${f(rest, "worstGapMs")} ms`)
    console.log(`  wobble nudge PLAYING    long tasks ${playing.map((r) => r.tasks).join(" / ")}   worst task ${f(playing, "worstTaskMs")} ms   worst gap ${f(playing, "worstGapMs")} ms`)
    say(idle.tasks === 0, `${engine} — CONTROL: the idle window records no long task`, `${idle.tasks}`)
  }

  const worstOf = (e, k) => Math.max(...report[e][k].map((r) => r.worstGapMs))
  console.log(
    `\n  WORST FRAME GAP on a dial nudge while PLAYING:  free-stroke ${worstOf("free-stroke", "playing").toFixed(0)} ms   ` +
      `desk-doodles ${worstOf("desk-doodles", "playing").toFixed(0)} ms`,
  )
  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  writeFileSync(join(OUT, "stall.json"), JSON.stringify(report, null, 2))
  await context.close()
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\njson: ${FINAL}`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

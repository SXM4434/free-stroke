// _PROBE-DIAL-LATENCY — the instrument this lane's before/after is read off.
//
// THE DEFECT. Touching a dial on `/desk-doodles` with the Free Stroke engine
// selected freezes the page for over a second. This file measures that, and it
// is built to measure BOTH SIDES OF THE FIX IN ONE SESSION rather than as two
// runs an hour apart:
//
//   BEFORE = `window.__implicitDefer.law.mode = "sync"` — the parked prior, the
//            module exactly as it was before the worker existed.
//   AFTER  = `"worker"` — the shipped default.
//
// Same browser, same page load, same viewport, same dpr, same wall clock, same
// code doing the measuring. A before/after whose halves were taken under
// different conditions is not a before/after, and this repo has been burned by
// exactly that (a perf lane measuring dpr 1 in isolation while the real surface
// lagged at dpr 2).
//
// WHAT IT MEASURES, and why each channel is here:
//
//   longtask   The browser's own PerformanceObserver. A "long task" is >= 50 ms
//              of blocked main thread — the platform's definition, not one
//              chosen here, which is what makes it uncheatable.
//   rAF gap    The largest interval between two rendered frames in the window.
//              This is the number a HUMAN feels. A long task and a dropped
//              frame are not the same thing — work can block without dropping a
//              frame, and frames can drop with no long task — so both are
//              recorded and neither stands in for the other.
//   build ms   `window.__implicitDefer.debug` — which PATH built the surface
//              (sync / worker / cache) and what it cost there. Without this the
//              run could only say "it felt fast", never "it deferred".
//   buildCount `window.__geomDebug.buildCount()`. One dial change must equal
//              ONE geometry build; if this reads 2 the headline number is
//              measuring a double build, not a slow one.
//
// THE CONTROLS, which are what make the rows mean anything:
//
//   1. IDLE. A window where nothing is touched must record ZERO long tasks. If
//      an idle window reports a block, every other row is noise and the run is
//      void.
//   2. THE OTHER ENGINE. The same nudge on Desk Doodles, which does not
//      polygonise a field. If BOTH engines are slow the probe is measuring the
//      page, not the engine; if BOTH are fast the gesture never reached the
//      dial.
//   3. A BLOCK THE PROBE WAS HANDED. `--calibrate` burns 600 ms inside a
//      page-owned task and the probe must report it on BOTH channels. An
//      instrument that cannot see a cost handed to it is not evidence about the
//      absence of one. Note: the loop is scheduled from a `setTimeout` inside
//      the page, NOT run in `page.evaluate` — measured first-hand 2026-08-01, a
//      busy loop inside an `evaluate` produced a 591 ms frame gap and ZERO
//      longtask entries, because Chrome does not attribute a CDP-driven task to
//      the longtask observer. Calibrating that way would have proved nothing.
//
// Usage:
//   node scripts/verify/_run-clean.mjs scripts/verify/_probe-dial-latency.mjs --label=lane18 --calibrate
//   node scripts/verify/_probe-dial-latency.mjs --compare=lane18
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"
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
const has = (k) => process.argv.includes(`--${k}`)

const LABEL = arg("label", "run")
const DPR = parseFloat(arg("dpr", "2"))
const REPS = parseInt(arg("reps", "3"), 10)
const CALIBRATE = has("calibrate")
const COMPARE = arg("compare", "")
const BASE = join(ROOT, "docs", "verification", "dial-latency")
const VIEW = { width: 1600, height: 1600 }

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/* ---------------------------------------------------------------- compare */
if (COMPARE) {
  const p = join(BASE, COMPARE, "rows.json")
  if (!existsSync(p)) {
    console.error(`missing run: ${p}`)
    process.exit(1)
  }
  const rows = JSON.parse(readFileSync(p, "utf8"))
  const arms = [...new Set(rows.map((r) => r.arm))]
  console.log(`\n${"arm".padEnd(46)} ${"tasks".padStart(6)} ${"blocked".padStart(9)} ${"worst task".padStart(11)} ${"worst gap".padStart(10)}`)
  for (const arm of arms) {
    for (const r of rows.filter((x) => x.arm === arm)) {
      console.log(
        `${(r.arm + " #" + r.rep).padEnd(46)} ${String(r.tasks).padStart(6)} ${r.blockedMs.toFixed(0).padStart(9)} ${r.worstTaskMs
          .toFixed(0)
          .padStart(11)} ${r.worstGapMs.toFixed(0).padStart(10)}`,
      )
    }
  }
  process.exit(0)
}

/* ------------------------------------------------------------------- run */
async function main() {
  /* STAGED. `docs/verification/dial-latency/<label>`, and the label is an argument,
   * so the reach is the whole subtree: 3 tracked files. The stored set is
   * replaced only once the run completes. lib/evidence-swap.mjs. */
  const FINAL = join(BASE, LABEL)
  const ev = stageEvidence(FINAL)
  const OUT = ev.open()

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(2000)
  await page.click(`[data-register-option="desk-doodles"]`)
  await page.waitForTimeout(500)

  const arm = async () => {
    const ok = await page.evaluate(() => {
      window.__lt = []
      window.__gaps = []
      try {
        if (window.__po) window.__po.disconnect()
        const po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) window.__lt.push({ start: e.startTime, dur: e.duration })
        })
        po.observe({ entryTypes: ["longtask"] })
        window.__po = po
      } catch {
        return false
      }
      if (window.__rafId) cancelAnimationFrame(window.__rafId)
      let last = performance.now()
      const tick = (now) => {
        window.__gaps.push(now - last)
        last = now
        window.__rafId = requestAnimationFrame(tick)
      }
      window.__rafId = requestAnimationFrame(tick)
      return true
    })
    return ok
  }
  say(await arm(), "the long-task observer armed (without it this probe measures nothing)")
  say(
    await page.evaluate(() => !!window.__implicitDefer),
    "window.__implicitDefer is published (the run cannot say WHICH path built otherwise)",
  )

  const nudge = (v) =>
    page.evaluate((val) => {
      for (const inp of document.querySelectorAll('input[type="range"]')) {
        const row = inp.closest("div")?.parentElement
        if ((row?.textContent ?? "").toLowerCase().includes("wobble")) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
          setter.call(inp, String(val))
          inp.dispatchEvent(new Event("input", { bubbles: true }))
          inp.dispatchEvent(new Event("change", { bubbles: true }))
          return true
        }
      }
      return false
    }, v)

  const rows = []
  let reloaded = 0
  const measure = async (armName, rep, gesture, settleMs = 4000) => {
    const before = await page.evaluate(() => {
      const lost = !Array.isArray(window.__lt) || !Array.isArray(window.__gaps)
      window.__lt = []
      window.__gaps = []
      return {
        lost,
        bc: typeof window.__geomDebug?.buildCount === "function" ? window.__geomDebug.buildCount() : -1,
        d: window.__implicitDefer ? { ...window.__implicitDefer.debug } : null,
      }
    })
    if (before.lost) reloaded++
    const t0 = Date.now()
    await gesture()
    await page.waitForTimeout(settleMs)
    const r = await page.evaluate(() => ({
      lt: Array.isArray(window.__lt) ? window.__lt.slice() : [],
      gaps: Array.isArray(window.__gaps) ? window.__gaps.slice() : [],
      bc: typeof window.__geomDebug?.buildCount === "function" ? window.__geomDebug.buildCount() : -1,
      d: window.__implicitDefer ? { ...window.__implicitDefer.debug } : null,
    }))
    const blockedMs = r.lt.reduce((a, e) => a + e.dur, 0)
    const worstTaskMs = r.lt.reduce((a, e) => Math.max(a, e.dur), 0)
    const worstGapMs = r.gaps.reduce((a, g) => Math.max(a, g), 0)
    const dd = (k) => (r.d && before.d ? r.d[k] - before.d[k] : -1)
    const row = {
      arm: armName,
      rep,
      tasks: r.lt.length,
      blockedMs,
      worstTaskMs,
      worstGapMs,
      builds: r.bc >= 0 && before.bc >= 0 ? r.bc - before.bc : -1,
      syncBuilds: dd("syncBuilds"),
      deferredBuilds: dd("deferredBuilds"),
      cacheHits: dd("cacheHits"),
      workerErrors: dd("workerErrors"),
      lastPath: r.d?.lastHashSource ?? "",
      lastWorkerMs: r.d?.lastWorkerMs ?? 0,
      lastSyncMs: r.d?.lastSyncMs ?? 0,
      wallMs: Date.now() - t0,
    }
    rows.push(row)
    console.log(
      `  ${(armName + " #" + rep).padEnd(46)} tasks ${String(row.tasks).padStart(3)} · blocked ${blockedMs
        .toFixed(0)
        .padStart(5)} ms · worst task ${worstTaskMs.toFixed(0).padStart(5)} ms · worst frame gap ${worstGapMs
        .toFixed(0)
        .padStart(5)} ms · builds ${row.builds} · path ${row.lastPath || "-"} (sync ${row.syncBuilds} / worker ${row.deferredBuilds} / cache ${row.cacheHits})`,
    )
    return row
  }

  const setMode = async (mode) => {
    await page.evaluate((m) => {
      window.__implicitDefer.law.mode = m
      window.__implicitDefer.reset()
    }, mode)
  }
  const selectEngine = async (which) => {
    await page.click(`[data-engine-option="${which}"]`)
    await page.waitForTimeout(4500)
  }

  await selectEngine("free-stroke")

  console.log("\n--- CONTROL: idle, nothing touched ---")
  for (let i = 1; i <= REPS; i++)
    await measure("idle control", i, async () => page.waitForTimeout(1500), 0)

  if (CALIBRATE) {
    console.log("\n--- CONTROL: a 600 ms block the probe was HANDED ---")
    await measure(
      "600ms busy loop (must be seen)",
      1,
      () =>
        page.evaluate(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                const t = performance.now()
                while (performance.now() - t < 600) {
                  /* deliberately blocking */
                }
                resolve(null)
              }, 0)
            }),
        ),
      1500,
    )
  }

  let w = 0.4
  const nextW = () => {
    w += 0.05
    return w.toFixed(2)
  }

  // ---- BEFORE: the parked prior, synchronous on the main thread ----------
  console.log("\n--- BEFORE · law.mode = 'sync' (the module before the worker existed) ---")
  await setMode("sync")
  await nudge(nextW())
  await page.waitForTimeout(4000) // warm the slot; not measured
  for (let i = 1; i <= REPS; i++) await measure("BEFORE wobble nudge at rest", i, () => nudge(nextW()))

  console.log("\n--- BEFORE · while the beat is PLAYING (when a block is felt) ---")
  const play = async () => {
    await page.evaluate(() => {
      document.querySelectorAll("button").forEach((b) => {
        if ((b.textContent ?? "").trim().toLowerCase() === "reset") b.click()
      })
    })
    await page.waitForTimeout(400)
    await page.click("[data-hero-play]")
    await page.waitForTimeout(400)
  }
  const stop = async () => {
    await page.evaluate(() => {
      document.querySelectorAll("button").forEach((b) => {
        if ((b.textContent ?? "").trim().toLowerCase() === "pause") b.click()
      })
    })
    await page.waitForTimeout(300)
  }
  for (let i = 1; i <= REPS; i++) {
    await play()
    await measure("BEFORE wobble nudge while playing", i, () => nudge(nextW()))
    await stop()
  }

  console.log("\n--- BEFORE · a real DRAG, 8 steps one per frame ---")
  const drag = (from) =>
    page.evaluate(async (start) => {
      let target = null
      for (const inp of document.querySelectorAll('input[type="range"]')) {
        const row = inp.closest("div")?.parentElement
        if ((row?.textContent ?? "").toLowerCase().includes("wobble")) {
          target = inp
          break
        }
      }
      if (!target) return
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      for (let i = 1; i <= 8; i++) {
        setter.call(target, String(start + i * 0.05))
        target.dispatchEvent(new Event("input", { bubbles: true }))
        target.dispatchEvent(new Event("change", { bubbles: true }))
        await new Promise((r) => requestAnimationFrame(r))
      }
    }, from)
  await measure("BEFORE wobble DRAG 8 steps", 1, () => drag(0.4), 12000)

  // ---- AFTER: the shipped default -------------------------------------
  console.log("\n--- AFTER · law.mode = 'worker' (shipped default) ---")
  await setMode("worker")
  w = 0.4
  await nudge(nextW())
  await page.waitForTimeout(4000) // first build of a fresh slot is always sync
  for (let i = 1; i <= REPS; i++) await measure("AFTER wobble nudge at rest", i, () => nudge(nextW()))

  console.log("\n--- AFTER · while the beat is PLAYING ---")
  for (let i = 1; i <= REPS; i++) {
    await play()
    await measure("AFTER wobble nudge while playing", i, () => nudge(nextW()))
    await stop()
  }

  console.log("\n--- AFTER · a real DRAG, 8 steps one per frame ---")
  await measure("AFTER wobble DRAG 8 steps", 1, () => drag(0.4), 12000)

  // ---- CONTROL ENGINE ----------------------------------------------------
  console.log("\n--- CONTROL: DESK DOODLES engine (no implicit polygonisation) ---")
  await selectEngine("desk-doodles")
  w = 0.4
  for (let i = 1; i <= REPS; i++) await measure("CONTROL desk-doodles nudge", i, () => nudge(nextW()))

  /* ------------------------------------------------------------- verdict */
  const worstOf = (a) => rows.filter((r) => r.arm === a).reduce((m, r) => Math.max(m, r.worstGapMs), 0)
  const worstTaskOf = (a) => rows.filter((r) => r.arm === a).reduce((m, r) => Math.max(m, r.worstTaskMs), 0)
  const tasksOf = (a) => rows.filter((r) => r.arm === a).reduce((m, r) => Math.max(m, r.tasks), 0)

  console.log("")
  say(tasksOf("idle control") === 0, "CONTROL: an idle window records ZERO long tasks", `${tasksOf("idle control")}`)
  if (CALIBRATE) {
    const cal = rows.find((r) => r.arm.startsWith("600ms busy loop"))
    say(
      !!cal && cal.worstTaskMs >= 400 && cal.worstGapMs >= 400,
      "CALIBRATION: the probe SEES a 600 ms block it was handed, on BOTH channels",
      cal ? `task ${cal.worstTaskMs.toFixed(0)} ms · gap ${cal.worstGapMs.toFixed(0)} ms` : "missing",
    )
  }
  // THE CONTROL ENGINE IS A REFERENCE, NOT A CONSTANT — and this row used to be
  // a hardcoded `< 300 ms` taken from the dispatch brief's reading of 17-33 ms.
  // That number does not reproduce: it was measured on a `next dev` that had
  // been up for three and a half days at 5.4 GB RSS, and on a freshly started
  // server the same nudge costs 204-297 ms on the Desk Doodles engine too. A
  // threshold copied from another machine-state is a green row waiting to lie
  // in whichever direction the drift went. So the claim is stated as what it
  // actually is — a COMPARISON — and the reference is measured in the same run.
  const ctl = worstOf("CONTROL desk-doodles nudge")
  say(
    ctl < worstOf("BEFORE wobble nudge at rest") * 0.6,
    "CONTROL: the other engine's nudge is much cheaper than the defect (else the probe measures the page)",
    `${ctl.toFixed(0)} ms vs ${worstOf("BEFORE wobble nudge at rest").toFixed(0)} ms`,
  )
  // THE ACCEPTANCE. Free Stroke's implicit build is off the main thread when
  // touching its dial costs no more than the engine that never had the build at
  // all. `1.35x` is headroom for run-to-run noise on a shared machine, not a
  // target: the two arms measured 258 ms and 308 ms in the run this was written
  // against, i.e. Free Stroke came out FASTER than its own control.
  const afterRest = worstOf("AFTER wobble nudge at rest")
  say(
    afterRest <= ctl * 1.35,
    "ACCEPTANCE: touching the dial on Free Stroke now costs what it costs on the engine with no field build",
    `free-stroke ${afterRest.toFixed(0)} ms vs desk-doodles ${ctl.toFixed(0)} ms`,
  )
  say(
    worstTaskOf("BEFORE wobble nudge at rest") > 500,
    "the DEFECT reproduces on the parked prior (a fix cannot be shown against a defect that vanished)",
    `${worstTaskOf("BEFORE wobble nudge at rest").toFixed(0)} ms blocked`,
  )
  const beforeDeferred = rows
    .filter((r) => r.arm.startsWith("BEFORE"))
    .every((r) => r.deferredBuilds === 0)
  say(beforeDeferred, "the BEFORE arm really ran synchronously (0 deferred builds)", "")
  const afterDeferred = rows
    .filter((r) => r.arm.startsWith("AFTER wobble nudge"))
    .every((r) => r.deferredBuilds > 0 || r.cacheHits > 0)
  say(afterDeferred, "the AFTER arm really went off-thread (deferred or cached, never sync)", "")
  say(
    rows.every((r) => r.workerErrors <= 0),
    "no worker errors (an error silently falls back to the blocking path)",
  )
  say(reloaded === 0, "the page never reloaded mid-run (a fast-refresh voids every row)", `${reloaded}`)
  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")

  console.log("\n  HEADLINE — worst gap between rendered frames, the number a human feels:")
  for (const a of [
    "BEFORE wobble nudge at rest",
    "AFTER wobble nudge at rest",
    "BEFORE wobble nudge while playing",
    "AFTER wobble nudge while playing",
    "BEFORE wobble DRAG 8 steps",
    "AFTER wobble DRAG 8 steps",
    "CONTROL desk-doodles nudge",
    "idle control",
  ]) {
    const rs = rows.filter((r) => r.arm === a)
    if (!rs.length) continue
    console.log(
      `    ${a.padEnd(38)} ${rs.map((r) => r.worstGapMs.toFixed(0).padStart(5)).join(" /")} ms   (blocked ${rs
        .map((r) => r.blockedMs.toFixed(0))
        .join(" / ")} ms)`,
    )
  }
  const b = worstOf("BEFORE wobble nudge at rest")
  const a2 = worstOf("AFTER wobble nudge at rest")
  console.log(`\n    at rest: ${b.toFixed(0)} ms -> ${a2.toFixed(0)} ms   (${(b / Math.max(a2, 1e-9)).toFixed(1)}x)`)

  writeFileSync(join(OUT, "rows.json"), JSON.stringify(rows, null, 2))
  await context.close()
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. */
  ev.commit()
  console.log(`\njson: ${join(FINAL, "rows.json")}`)
  console.log(pass ? "\nDONE" : "\nSEE FAILURES ABOVE")
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

// WHAT DOES THE PEN-FIELD BAKE COST THE DIAL, AND WHAT DOES DEFERRING IT BUY?
//
// Explainer 20 took the implicit GEOMETRY build off the main thread and the dial
// freeze went 859-942 ms to 250-259 ms. Its §10 then attributes the residual,
// off a CDP profile of the SAME gesture taken after that change:
//
//     105.6 ms  buildPenField      lib/flat-ink.ts:1460
//      61.3 ms  nibHalfWidth       lib/flat-ink.ts   (inside it)
//      29.4 ms  penTaperProfile    lib/flat-ink.ts   (inside it)
//
// This measures whether moving THAT off-thread removes it, and it is written
// against the one lesson explainer 20 §2 paid for: **a ratio between two numbers
// taken in different sessions is not a measurement.** Both arms run in ONE page
// load, same browser, same wall clock, same code doing the timing, switched live
// through `window.__penFieldDefer.law.mode`.
//
// THE ARMS. The geometry deferral stays ON throughout — it already shipped, and
// the question here is what is left AFTER it:
//
//   BEFORE  implicit=worker · penField=sync    the state explainer 20 shipped
//   AFTER   implicit=worker · penField=worker  this pass
//   CONTROL the Desk Doodles engine, which builds no implicit field at all
//
// WHY THE CONTROL MATTERS AND WHY IT MOVES TOO. The carve block in
// `components/viewport-3d.tsx` is NOT engine-gated, so `buildPenField` runs on
// the Desk Doodles arm as well. That is not a flaw in the control, it is the
// finding: the pen field is a cost BOTH engines were paying, which is exactly
// why explainer 20's acceptance ("Free Stroke at 259 ms against the control's
// 308 ms") could not go any lower without this change.
//
// CALIBRATION. `--calibrate` hands the page a 600 ms busy loop from a page-owned
// `setTimeout` and requires the probe to SEE it. Not from inside `page.evaluate`:
// Chrome does not attribute a CDP-driven task to the longtask observer, so that
// version produced a 591 ms frame gap and ZERO longtask entries — an instrument
// that reads green on a known-bad input.
//
//   node scripts/verify/_run-clean.mjs scripts/verify/_probe-penfield-latency.mjs --calibrate
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
const BASE = join(ROOT, "docs", "verification", "penfield-latency")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const REPS = Number(arg("reps", "3"))
const DPR = Number(arg("dpr", "2"))
const CALIBRATE = process.argv.includes("--calibrate")
const VIEW = { width: 1600, height: 1600 }

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  /* STAGED. `docs/verification/penfield-latency/<label>`, and the label is an argument,
   * so the reach is the whole subtree: 1 tracked files. The stored set is
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
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2000)
  await page.click(`[data-register-option="desk-doodles"]`)
  await page.waitForTimeout(500)

  const armObservers = () =>
    page.evaluate(() => {
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

  say(await armObservers(), "the long-task observer armed (without it this probe measures nothing)")
  say(
    await page.evaluate(() => !!window.__penFieldDefer),
    "window.__penFieldDefer is published (the run cannot say WHICH path baked otherwise)",
  )
  say(
    await page.evaluate(() => !!window.__implicitDefer),
    "window.__implicitDefer is published (the geometry arm has to be pinned, not assumed)",
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
    /* 🔴 RE-ARM AFTER A RELOAD, AND COUNT THE SAMPLES.
     *
     * The first honest run of this probe reported "267 ms -> 0 ms, 266x". It
     * was an artefact. A mid-run reload (a sibling lane saved a file and
     * Turbopack fast-refreshed) destroys the `PerformanceObserver` and the rAF
     * sampler; every window after it then reports `tasks 0` and `worst frame
     * gap 0` — not because nothing blocked, but because NOTHING WAS MEASURED.
     * A dead instrument reads exactly like a perfect result, which is this
     * repo's most expensive recurring defect. So the observers are re-armed the
     * moment a loss is detected, and every row carries its own sample count
     * with an assertion below that refuses a window that recorded none. */
    let before = await page.evaluate(() => {
      const lost = !Array.isArray(window.__lt) || !Array.isArray(window.__gaps)
      window.__lt = []
      window.__gaps = []
      return { lost, p: window.__penFieldDefer ? { ...window.__penFieldDefer.debug } : null }
    })
    if (before.lost) {
      reloaded++
      await armObservers()
      await page.waitForTimeout(500)
      before = await page.evaluate(() => {
        window.__lt = []
        window.__gaps = []
        return { lost: false, p: window.__penFieldDefer ? { ...window.__penFieldDefer.debug } : null }
      })
    }
    const t0 = Date.now()
    await gesture()
    await page.waitForTimeout(settleMs)
    const r = await page.evaluate(() => ({
      lt: Array.isArray(window.__lt) ? window.__lt.slice() : [],
      gaps: Array.isArray(window.__gaps) ? window.__gaps.slice() : [],
      p: window.__penFieldDefer ? { ...window.__penFieldDefer.debug } : null,
      bakeMs: window.__heroPenField?.bakeMs ?? -1,
      path: window.__heroPenField?.path ?? "",
    }))
    const blockedMs = r.lt.reduce((a, e) => a + e.dur, 0)
    const worstTaskMs = r.lt.reduce((a, e) => Math.max(a, e.dur), 0)
    const worstGapMs = r.gaps.reduce((a, g) => Math.max(a, g), 0)
    const dd = (k) => (r.p && before.p ? r.p[k] - before.p[k] : -1)
    const row = {
      arm: armName,
      rep,
      tasks: r.lt.length,
      blockedMs,
      worstTaskMs,
      worstGapMs,
      pfSync: dd("syncBuilds"),
      pfWorker: dd("deferredBuilds"),
      pfCache: dd("cacheHits"),
      pfErrors: dd("workerErrors"),
      pfPath: r.path,
      bakeMs: r.bakeMs,
      /** rAF ticks recorded in this window. ZERO means the instrument was dead,
       *  never that the page was smooth. Asserted below. */
      samples: r.gaps.length,
      wallMs: Date.now() - t0,
    }
    rows.push(row)
    console.log(
      `  ${(armName + " #" + rep).padEnd(44)} n ${String(row.samples).padStart(3)} · tasks ${String(row.tasks).padStart(3)} · blocked ${blockedMs
        .toFixed(0)
        .padStart(5)} ms · worst task ${worstTaskMs.toFixed(0).padStart(5)} ms · worst frame gap ${worstGapMs
        .toFixed(0)
        .padStart(5)} ms · penfield ${row.pfPath || "-"} (sync ${row.pfSync} / worker ${row.pfWorker} / cache ${row.pfCache}) · bake ${row.bakeMs}ms`,
    )
    return row
  }

  const setPenMode = async (mode) =>
    page.evaluate((m) => {
      window.__penFieldDefer.law.mode = m
      window.__penFieldDefer.reset()
    }, mode)
  /* The geometry arm is PINNED, not left to whatever the module ships, so this
   * probe measures one variable. Reset too, or arm B would be answered out of
   * the geometry cache arm A populated. */
  const pinGeometry = async () =>
    page.evaluate(() => {
      window.__implicitDefer.law.mode = "worker"
      window.__implicitDefer.reset()
    })
  const selectEngine = async (which) => {
    await page.click(`[data-engine-option="${which}"]`)
    await page.waitForTimeout(4500)
  }

  await selectEngine("free-stroke")
  await pinGeometry()

  /* THE DIAL'S OWN STEP, READ OFF THE DIAL.
   *
   * The first version walked the wobble by 0.037 and a third of its nudges
   * produced NO REBUILD — the slider quantises to its `step`, so two nudges
   * inside one step are the same value and React never sees a change. That
   * reads as "the arm did not bake", which is a true statement about a gesture
   * that never happened, and it would have been reported as a result. Two steps
   * per nudge guarantees every gesture is a real one. */
  const dial = await page.evaluate(() => {
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      if ((row?.textContent ?? "").toLowerCase().includes("wobble")) {
        return { min: Number(inp.min || 0), max: Number(inp.max || 1), step: Number(inp.step || 0.01) }
      }
    }
    return null
  })
  say(!!dial, "the wobble dial was found, with its own range and step", JSON.stringify(dial))
  const STEP = Math.max((dial?.step ?? 0.01) * 2, 1e-6)
  const LO = (dial?.min ?? 0) + STEP
  const HI = (dial?.max ?? 1) - STEP
  let w = LO
  const nextWobble = () => {
    w += STEP
    if (w > HI) w = LO
    return w.toFixed(4)
  }

  console.log("\n--- CONTROL: idle, nothing touched ---")
  for (let i = 1; i <= REPS; i++) await measure("idle control", i, () => page.waitForTimeout(1500), 0)

  if (CALIBRATE) {
    console.log("\n--- CONTROL: a 600 ms block the probe was HANDED ---")
    await measure(
      "600ms busy loop (must be seen)",
      1,
      () =>
        page.evaluate(
          () =>
            new Promise((resolve) => {
              /* From a PAGE-OWNED timer, not from this evaluate: Chrome does not
               * attribute a CDP-driven task to the longtask observer, and the
               * version that ran it inline produced a 591 ms frame gap and ZERO
               * longtask entries. */
              setTimeout(() => {
                const t = performance.now()
                while (performance.now() - t < 600) {
                  /* burn */
                }
                resolve()
              }, 50)
            }),
        ),
      1500,
    )
  }

  /* ---- BEFORE: the pen field on the main thread (the parked prior) ---- */
  console.log("\n--- BEFORE: penField = sync (what explainer 20 shipped) ---")
  await setPenMode("sync")
  await nudge(nextWobble())
  await page.waitForTimeout(4000)
  for (let i = 1; i <= REPS; i++)
    await measure("BEFORE wobble nudge at rest", i, async () => {
      await nudge(nextWobble())
    })

  /* ---- AFTER: the pen field in a worker ---- */
  console.log("\n--- AFTER: penField = worker ---")
  await setPenMode("worker")
  // The first bake of a fresh slot is always synchronous by design, and it is
  // also what MEASURES the cost the policy gates on. Seed it, then measure.
  await nudge(nextWobble())
  await page.waitForTimeout(4000)
  for (let i = 1; i <= REPS; i++)
    await measure("AFTER wobble nudge at rest", i, async () => {
      await nudge(nextWobble())
    })

  console.log("\n--- AFTER: an 8-step drag, one step per frame ---")
  await measure(
    "AFTER wobble DRAG 8 steps",
    1,
    async () => {
      for (let i = 0; i < 8; i++) {
        await nudge(nextWobble())
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())))
      }
    },
    6000,
  )

  /* ---- THE CONTROL ENGINE, on BOTH arms ---- */
  console.log("\n--- CONTROL ENGINE: Desk Doodles (no implicit field) ---")
  await selectEngine("desk-doodles")
  await setPenMode("sync")
  await nudge(nextWobble())
  await page.waitForTimeout(3000)
  for (let i = 1; i <= REPS; i++)
    await measure("CONTROL desk-doodles · penField sync", i, async () => {
      await nudge(nextWobble())
    })
  await setPenMode("worker")
  await nudge(nextWobble())
  await page.waitForTimeout(3000)
  for (let i = 1; i <= REPS; i++)
    await measure("CONTROL desk-doodles · penField worker", i, async () => {
      await nudge(nextWobble())
    })

  /* ------------------------------------------------------------------ */
  const pick = (name) => rows.filter((r) => r.arm === name)
  const worst = (name) => pick(name).map((r) => r.worstGapMs)
  const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN)

  const idle = pick("idle control")
  const before = pick("BEFORE wobble nudge at rest")
  const after = pick("AFTER wobble nudge at rest")
  const ctlSync = pick("CONTROL desk-doodles · penField sync")
  const ctlWorker = pick("CONTROL desk-doodles · penField worker")

  console.log("")
  say(idle.every((r) => r.tasks === 0), "the idle control records ZERO long tasks", idle.map((r) => r.tasks).join("/"))
  if (CALIBRATE) {
    const cal = pick("600ms busy loop (must be seen)")[0]
    say(cal && cal.worstTaskMs > 400, "the 600 ms burn is SEEN as a long task", `${cal?.worstTaskMs.toFixed(0)} ms`)
    say(cal && cal.worstGapMs > 400, "…and as a frame gap", `${cal?.worstGapMs.toFixed(0)} ms`)
  }
  say(
    before.every((r) => r.pfSync >= 1 && r.pfWorker === 0),
    "the BEFORE arm really baked on the main thread (0 deferred)",
    before.map((r) => `${r.pfSync}s/${r.pfWorker}w`).join(" "),
  )
  say(
    after.every((r) => r.pfWorker >= 1 || r.pfCache >= 1),
    "the AFTER arm really deferred (or hit the cache) on every nudge",
    after.map((r) => `${r.pfSync}s/${r.pfWorker}w/${r.pfCache}c`).join(" "),
  )
  say(rows.every((r) => r.pfErrors <= 0), "no worker errors on any arm")
  /* THE ROW THAT MAKES EVERY OTHER ROW MEAN ANYTHING. A measured window with no
   * rAF samples recorded NOTHING, and its zeros are instrument death rather
   * than smoothness. `idle control` is excluded only because it is a 0 ms
   * settle by construction; every gesture window must have ticked. */
  const measured = rows.filter((r) => r.arm !== "idle control")
  say(
    measured.every((r) => r.samples > 10),
    "every gesture window actually recorded frames — a window with no samples is a DEAD instrument, not a fast page",
    measured.map((r) => r.samples).join("/"),
  )
  say(reloaded === 0, "the page never reloaded mid-run", `${reloaded} reload(s)`)
  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")

  const b = med(worst("BEFORE wobble nudge at rest"))
  const a = med(worst("AFTER wobble nudge at rest"))
  say(a < b * 0.7, "ACCEPTANCE: the worst frame gap on a nudge is materially smaller", `${b.toFixed(0)} ms -> ${a.toFixed(0)} ms`)

  console.log("\n================ HEADLINE ================")
  const line = (name, arr) =>
    `${name.padEnd(42)} worst frame gap ${arr.map((r) => r.worstGapMs.toFixed(0)).join(" / ").padStart(18)} ms   blocked ${arr
      .map((r) => r.blockedMs.toFixed(0))
      .join(" / ")} ms`
  console.log(line("BEFORE  free-stroke, penField sync", before))
  console.log(line("AFTER   free-stroke, penField worker", after))
  console.log(line("CONTROL desk-doodles, penField sync", ctlSync))
  console.log(line("CONTROL desk-doodles, penField worker", ctlWorker))
  console.log(`\nnudge worst frame gap: ${b.toFixed(0)} ms -> ${a.toFixed(0)} ms  (${(b / Math.max(a, 1)).toFixed(2)}x)`)
  console.log("==========================================")

  writeFileSync(join(OUT, "rows.json"), JSON.stringify(rows, null, 2))
  await context.close()
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. */
  ev.commit()
  console.log(`\njson: ${join(FINAL, "rows.json")}`)
  console.log(pass ? "\nALL ASSERTIONS PASS" : "\nSEE FAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

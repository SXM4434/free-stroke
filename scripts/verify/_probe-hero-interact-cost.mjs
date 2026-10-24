// _PROBE-HERO-INTERACT-COST — where the lag actually is, when the page is being
// DRIVEN rather than played.
//
// Sebs: *"IT'S ALSO LAGGY AT PARTS"*. `_probe-hero-lag.mjs` measured the whole
// 12.4 s beat through Play in his exact state, at dpr 1 AND dpr 2, and found
// nothing: median 8.3 ms, worst 18.1 ms, ZERO frames over 33.4 ms in twelve
// phases. So the lag is not in playback, and the next place to look is the thing
// he is actually doing — TOUCHING THE CONTROLS.
//
// That is not a guess, it is the shape of a defect the sibling repo already
// found and wrote down: *"scroll+hover were ALREADY clean (0 long tasks, p95
// 9ms) — the prior lane measured the wrong gesture. The cost was DIAL CHANGES:
// one change = a 990 ms block; a slider drag of 8 = 8 long tasks / 7,826 ms
// FROZEN."*
//
// MEASURED HERE, on the real page, with the browser's own long-task observer:
//   1. flipping the ENGINE pill
//   2. dragging the WOBBLE slider (8 steps, as a real drag would)
//   3. flipping the ENDPOINT pill
//   4. the same three WHILE THE BEAT IS PLAYING, which is when a block is felt
//
// A long task is >= 50 ms of blocked main thread — the browser's definition, not
// one chosen here.
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
const DPR = parseFloat(arg("dpr", "2"))
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
/* The incumbent override, copied verbatim from `_probe-pentip-shape.mjs` so
 * this repo keeps ONE name for this knob rather than growing a second. */
const VIEW = { width: 1600, height: 1600 }

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  EV.open()

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(1800)
  await page.click(`[data-register-option="desk-doodles"]`)
  await page.waitForTimeout(400)
  await page.click(`[data-engine-option="free-stroke"]`)
  await page.waitForTimeout(3000)

  // The observer + a rAF sampler. The observer says "the main thread was blocked
  // for N ms"; the rAF sampler says "and here is the gap a viewer saw".
  const armed = await page.evaluate(() => {
    window.__lt = []
    window.__gaps = []
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__lt.push({ start: e.startTime, dur: e.duration })
      })
      po.observe({ entryTypes: ["longtask"] })
      window.__po = po
    } catch {
      return false
    }
    let last = performance.now()
    const tick = (now) => {
      window.__gaps.push(now - last)
      last = now
      window.__rafId = requestAnimationFrame(tick)
    }
    window.__rafId = requestAnimationFrame(tick)
    return true
  })
  say(armed, "the long-task observer armed (without it this probe measures nothing)")

  const window_ = async (label, fn) => {
    await page.evaluate(() => {
      window.__lt = []
      window.__gaps = []
    })
    const t0 = Date.now()
    await fn()
    await page.waitForTimeout(1200)
    const r = await page.evaluate(() => ({ lt: window.__lt.slice(), gaps: window.__gaps.slice() }))
    const total = r.lt.reduce((a, e) => a + e.dur, 0)
    const worstLt = r.lt.reduce((a, e) => Math.max(a, e.dur), 0)
    const worstGap = r.gaps.reduce((a, g) => Math.max(a, g), 0)
    console.log(
      `  ${label.padEnd(46)} long tasks ${String(r.lt.length).padStart(3)} · blocked ${total.toFixed(0).padStart(5)} ms · ` +
        `worst task ${worstLt.toFixed(0).padStart(4)} ms · worst frame gap ${worstGap.toFixed(0).padStart(5)} ms · wall ${(Date.now() - t0)} ms`,
    )
    return { label, tasks: r.lt.length, blockedMs: total, worstTaskMs: worstLt, worstGapMs: worstGap }
  }

  const rows = []
  console.log("\n--- AT REST (paused) ---")
  rows.push(await window_("idle, nothing touched", async () => page.waitForTimeout(1500)))
  rows.push(
    await window_("ENGINE pill  free-stroke -> desk-doodles", async () => {
      await page.click(`[data-engine-option="desk-doodles"]`)
      await page.waitForTimeout(2500)
    }),
  )
  rows.push(
    await window_("ENGINE pill  desk-doodles -> free-stroke", async () => {
      await page.click(`[data-engine-option="free-stroke"]`)
      await page.waitForTimeout(2500)
    }),
  )
  rows.push(
    await window_("ENDPOINT pill  protrude -> kink", async () => {
      await page.evaluate(() => {
        for (const b of document.querySelectorAll("button"))
          if ((b.textContent ?? "").trim().toLowerCase() === "kink") { b.click(); return }
      })
      await page.waitForTimeout(2500)
    }),
  )
  rows.push(
    await window_("ENDPOINT pill  kink -> protrude", async () => {
      await page.evaluate(() => {
        for (const b of document.querySelectorAll("button"))
          if ((b.textContent ?? "").trim().toLowerCase() === "protrude") { b.click(); return }
      })
      await page.waitForTimeout(2500)
    }),
  )
  rows.push(
    await window_("WOBBLE slider drag, 8 steps 0.40 -> 0.80", async () => {
      await page.evaluate(async () => {
        let target = null
        for (const inp of document.querySelectorAll('input[type="range"]')) {
          const row = inp.closest("div")?.parentElement
          if ((row?.textContent ?? "").toLowerCase().includes("wobble")) { target = inp; break }
        }
        if (!target) return
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        for (let i = 1; i <= 8; i++) {
          setter.call(target, String(0.4 + i * 0.05))
          target.dispatchEvent(new Event("input", { bubbles: true }))
          target.dispatchEvent(new Event("change", { bubbles: true }))
          await new Promise((r) => requestAnimationFrame(r))
        }
      })
      await page.waitForTimeout(4000)
    }),
  )
  /* THE THREE GESTURES THIS FILE DID NOT COVER, AND THE DISPATCH NAMES ALL
   * THREE. The rows above are the ones a prior lane chose; Sebs's sentence is
   * about *playback*, and the controls he touches around playback are the FILM
   * pill, the CAMERA pill and the SCRUB handle. A film pill rewrites the whole
   * exposure sheet and a scrub drag asks for a new pose every single frame,
   * which is the same shape as the dial-drag defect that started all of this. */
  rows.push(
    await window_("FILM pill  shipped -> turn lands", async () => {
      await page.click(`[data-read-film="turnLands"]`)
      await page.waitForTimeout(2500)
    }),
  )
  rows.push(
    await window_("FILM pill  turn lands -> letter by letter", async () => {
      await page.click(`[data-read-film="letterByLetter"]`)
      await page.waitForTimeout(2500)
    }),
  )
  rows.push(
    await window_("FILM pill  letter by letter -> shipped", async () => {
      await page.click(`[data-read-film="shipped"]`)
      await page.waitForTimeout(2500)
    }),
  )
  rows.push(
    await window_("CAMERA pill  four moves -> desk 3/4", async () => {
      await page.click(`[data-read-camera="desk"]`)
      await page.waitForTimeout(2000)
    }),
  )
  rows.push(
    await window_("CAMERA pill  desk 3/4 -> four moves", async () => {
      await page.click(`[data-read-camera="prior"]`)
      await page.waitForTimeout(2000)
    }),
  )
  /* A REAL SCRUB, not a jump: 40 steps across the whole beat, one per animation
   * frame, which is what dragging the handle actually generates. A single
   * `value=` write would ask for ONE pose and would measure nothing. */
  rows.push(
    await window_("SCRUB drag across the whole beat, 40 steps", async () => {
      await page.evaluate(async () => {
        const el = document.querySelector("[data-hero-scrub]")
        if (!el) return
        const max = parseFloat(el.max)
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        for (let i = 0; i <= 40; i++) {
          setter.call(el, String((max * i) / 40))
          el.dispatchEvent(new Event("input", { bubbles: true }))
          el.dispatchEvent(new Event("change", { bubbles: true }))
          await new Promise((r) => requestAnimationFrame(r))
        }
      })
      await page.waitForTimeout(2500)
    }),
  )

  // Put it back, and let the rebuild settle before the playing block.
  await page.evaluate(() => {
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      if ((row?.textContent ?? "").toLowerCase().includes("wobble")) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        setter.call(inp, "0.4")
        inp.dispatchEvent(new Event("input", { bubbles: true }))
        inp.dispatchEvent(new Event("change", { bubbles: true }))
        return
      }
    }
  })
  await page.waitForTimeout(4000)

  console.log("\n--- WHILE THE BEAT IS PLAYING (this is when a block is FELT) ---")
  const play = async () => {
    await page.evaluate(() => {
      document.querySelectorAll("button").forEach((b) => {
        if ((b.textContent ?? "").trim().toLowerCase() === "reset") b.click()
      })
    })
    await page.waitForTimeout(400)
    await page.click("[data-hero-play]")
    await page.waitForTimeout(300)
  }
  const stop = async () => {
    await page.evaluate(() => {
      document.querySelectorAll("button").forEach((b) => {
        if ((b.textContent ?? "").trim().toLowerCase() === "pause") b.click()
      })
    })
  }
  await play()
  rows.push(await window_("PLAYING · engine pill flipped mid-draw", async () => {
    await page.click(`[data-engine-option="desk-doodles"]`)
    await page.waitForTimeout(3000)
  }))
  await stop()
  await page.click(`[data-engine-option="free-stroke"]`)
  await page.waitForTimeout(3000)
  await play()
  rows.push(await window_("PLAYING · wobble nudged one step mid-draw", async () => {
    await page.evaluate(() => {
      for (const inp of document.querySelectorAll('input[type="range"]')) {
        const row = inp.closest("div")?.parentElement
        if ((row?.textContent ?? "").toLowerCase().includes("wobble")) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
          setter.call(inp, "0.45")
          inp.dispatchEvent(new Event("input", { bubbles: true }))
          inp.dispatchEvent(new Event("change", { bubbles: true }))
          return
        }
      }
    })
    await page.waitForTimeout(3000)
  }))
  await stop()
  await play()
  rows.push(await window_("PLAYING · FILM pill switched mid-beat", async () => {
    await page.click(`[data-read-film="turnLands"]`)
    await page.waitForTimeout(3000)
  }))
  await stop()
  await page.click(`[data-read-film="shipped"]`)
  await page.waitForTimeout(2000)
  await play()
  rows.push(await window_("PLAYING · SCRUB dragged mid-beat, 20 steps", async () => {
    await page.evaluate(async () => {
      const el = document.querySelector("[data-hero-scrub]")
      if (!el) return
      const max = parseFloat(el.max)
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      for (let i = 0; i <= 20; i++) {
        setter.call(el, String((max * i) / 20))
        el.dispatchEvent(new Event("input", { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
        await new Promise((r) => requestAnimationFrame(r))
      }
    })
    await page.waitForTimeout(2500)
  }))
  await stop()

  const idle = rows[0]
  say(idle.tasks === 0, "CONTROL: an idle window records no long task", `${idle.tasks}`)
  const worst = rows.slice(1).reduce((a, r) => (r.worstTaskMs > a.worstTaskMs ? r : a), rows[1])
  console.log(`\n  WORST INTERACTION: ${worst.label} — ${worst.worstTaskMs.toFixed(0)} ms blocked in one task, worst frame gap ${worst.worstGapMs.toFixed(0)} ms`)
  say(
    worst.worstTaskMs > 50,
    "the probe RESOLVES a block (if nothing here exceeds 50 ms, interaction is not the lag)",
    `${worst.worstTaskMs.toFixed(0)} ms`,
  )
  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")

  writeFileSync(join(OUT, "interact.json"), JSON.stringify(rows, null, 2))
  await context.close()
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\njson: ${FINAL}`)
  console.log(pass ? "\nDONE" : "\nSEE FAILURES ABOVE")
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

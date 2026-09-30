// MEASURE-DRAWIN-FRAMES — the JANK half, in the time domain, through the page's
// own Play button.
//
// Sebs: *"and the fucking drawing is fast and janky."* FAST is pacing and is
// measured in plain node by `measure-drawin-pacing.mjs`. JANKY is FRAME
// DELIVERY, which has no representation in a still and none in a scrub either —
// a scrub has no clock, so it structurally cannot see a stall. This drives the
// real transport and records every rAF interval.
//
// FOUR TAKES, and the comparisons are the point:
//
//   engine=free-stroke  channel=ref     the shipped path — a ref read inside
//                                       the render loop
//   engine=free-stroke  channel=state   THE PARKED PRIOR — `setProgress`, i.e.
//                                       a React commit of the whole viewport
//                                       per drawn frame. The negative control:
//                                       if this is not worse, the ref did
//                                       nothing and the claim is wrong.
//   engine=desk-doodles channel=ref     the newly-enabled rebuild reveal, which
//                                       is the path this lane switched ON and
//                                       therefore the one most likely to stall
//   engine=desk-doodles channel=state   the same, on the prior channel
//
// Explainer 18 measured the fixed stall at worst 16.7 ms / median 8.3 ms /
// 0 frames over 100 ms. Those are the numbers to hold.
//
// Usage: node scripts/verify/measure-drawin-frames.mjs [--label=after]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync, readdirSync, renameSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this tool spelled the default HERO surface address, so a lane
// on its own port measured the CANONICAL tree's draw-in frame budget. DISPATCH §3;
// explainers 27 §1 and 28 §3.2. The two surfaces are both derived from the port,
// which is the knob; importing the resolver is what keeps the legacy-name throw
// reachable (Lane F). No address is spelled in this comment (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "after")
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/drawin-frames/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 10 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "drawin-frames", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const VIEW = { width: 1600, height: 1600 }

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

const stats = (xs) => {
  if (!xs.length) return { n: 0 }
  const s = [...xs].sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))]
  return {
    n: s.length,
    p50: q(0.5),
    p95: q(0.95),
    p99: q(0.99),
    worst: s[s.length - 1],
    over33: xs.filter((d) => d > 33.4).length,
    over100: xs.filter((d) => d > 100).length,
  }
}

async function main() {
  EV.open()

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: VIEW },
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(1500)

  const span = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-draw-span]")
    return JSON.parse(el.getAttribute("data-hero-draw-span"))
  })
  console.log(`draw phase: ${span.duration.toFixed(3)}s starting at ${span.at.toFixed(3)}s\n`)

  const report = {}
  for (const engine of ["free-stroke", "desk-doodles"]) {
    for (const channel of ["ref", "state"]) {
      const key = `${engine}__${channel}`
      await page.click(`[data-engine-option="${engine}"]`)
      await page.waitForTimeout(2500)
      await page.evaluate((c) => {
        window.__heroRevealChannel = c
      }, channel)

      // A THROWAWAY TAKE FIRST, AND IT IS NOT OPTIONAL.
      //
      // The first play after an engine switch pays for the geometry build, the
      // shader compile and the texture upload, none of which are the draw-in.
      // The first run of this script proved the point against itself: the take
      // that happened to run first came back with the WORST frame of the four
      // (24.9 ms against 10.4 ms for the same engine on the other channel) and
      // the difference was the ordering, not the channel. A measurement whose
      // result depends on which take ran first is a measurement of the warm-up.
      const reset = async () => {
        await page.evaluate(() => {
          document.querySelectorAll("button").forEach((b) => {
            if ((b.textContent ?? "").trim().toLowerCase() === "reset") b.click()
          })
        })
        await page.waitForTimeout(600)
      }
      const pause = async () => {
        await page.evaluate(() => {
          document.querySelectorAll("button").forEach((b) => {
            if ((b.textContent ?? "").trim().toLowerCase() === "pause") b.click()
          })
        })
      }
      await reset()
      await page.click("[data-hero-play]")
      await page.waitForTimeout((span.duration + 0.4) * 1000)
      await pause()
      await reset()

      await page.evaluate(() => {
        window.__fl = []
        window.__pl = []
        window.__ph = []
        let last = performance.now()
        const tick = (now) => {
          window.__fl.push(now - last)
          last = now
          const el = document.querySelector("[data-hero-phase]")
          window.__pl.push(el?.getAttribute("data-hero-phase") ?? "")
          window.__ph.push(Number(el?.getAttribute("data-hero-phase-t") ?? 0))
          window.__raf = requestAnimationFrame(tick)
        }
        window.__raf = requestAnimationFrame(tick)
      })

      await page.click("[data-hero-play]")
      // Only the draw beat plus a margin — this is a draw-in measurement, and
      // running the whole 11s beat would bury the draw's frames in the orbit's.
      await page.waitForTimeout((span.duration + 0.8) * 1000)
      const rec = await page.evaluate(() => {
        cancelAnimationFrame(window.__raf)
        return { dts: window.__fl.slice(), phases: window.__pl.slice(), ts: window.__ph.slice() }
      })
      await pause()

      // Frames tagged `draw`, minus the first (its delta spans the click).
      const drawIdx = rec.phases
        .map((p, i) => (p === "draw" ? i : -1))
        .filter((i) => i > 0)
      const drawDts = drawIdx.map((i) => rec.dts[i])
      const st = stats(drawDts)
      report[key] = { ...st, frames: drawDts.length, samples: drawDts }

      // Did the reveal actually ADVANCE monotonically across those frames? A
      // beat that stalls and then jumps still delivers frames; what it does not
      // deliver is even PROGRESS. Largest single jump in phase-t is the metric
      // that separates the two, and it is the one the 1.1s stall showed up in.
      const drawTs = drawIdx.map((i) => rec.ts[i])
      let maxJump = 0
      for (let i = 1; i < drawTs.length; i++) {
        maxJump = Math.max(maxJump, drawTs[i] - drawTs[i - 1])
      }

      console.log(`${key}`)
      console.log(
        `  frames on the draw ${st.n}  ·  median ${st.p50?.toFixed(1)}ms  p95 ${st.p95?.toFixed(1)}ms  ` +
          `p99 ${st.p99?.toFixed(1)}ms  worst ${st.worst?.toFixed(1)}ms`,
      )
      console.log(
        `  over 33.4ms (a dropped frame at 30fps): ${st.over33}  ·  over 100ms: ${st.over100}  ` +
          `·  largest phase-t jump ${(maxJump * 100).toFixed(1)} % of the draw`,
      )
      report[key].maxJump = maxJump

      if (channel === "ref") {
        say(st.worst < 100, `${key} — no frame over 100ms`, `worst ${st.worst?.toFixed(1)}ms`)
        say(st.over33 <= 2, `${key} — at most 2 dropped frames across the draw`, `${st.over33}`)
        say(
          st.n >= span.duration * 40,
          `${key} — the draw is actually rendered`,
          `${st.n} frames over ${span.duration.toFixed(2)}s`,
        )
        say(maxJump < 0.15, `${key} — the reveal advances evenly`, `largest jump ${(maxJump * 100).toFixed(1)} %`)
      }
      console.log("")
    }
  }

  // THE COMPARISON THE JANK CLAIM RESTS ON. If the parked `state` channel is not
  // measurably worse than the ref one, then moving the playhead off React did
  // nothing and this lane should say so rather than claim a fix.
  for (const engine of ["free-stroke", "desk-doodles"]) {
    const a = report[`${engine}__ref`]
    const b = report[`${engine}__state`]
    if (!a?.n || !b?.n) continue
    console.log(
      `${engine}:  ref median ${a.p50.toFixed(1)}ms / worst ${a.worst.toFixed(1)}ms` +
        `   vs   state median ${b.p50.toFixed(1)}ms / worst ${b.worst.toFixed(1)}ms`,
    )
    say(
      a.worst <= b.worst,
      `${engine} — the ref channel is not worse than the parked React-commit channel`,
      `worst ${a.worst.toFixed(1)}ms vs ${b.worst.toFixed(1)}ms`,
    )
  }

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  writeFileSync(join(OUT, "frames.json"), JSON.stringify(report, null, 2))
  await context.close()
  await browser.close()

  for (const f of readdirSync(OUT).filter((f) => f.endsWith(".webm"))) {
    renameSync(join(OUT, f), join(OUT, "drawin.webm"))
    break
  }
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\nvideo + json: ${FINAL}`)
  console.log(pass ? "\nALL PASS" : "\nFAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

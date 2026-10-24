// _PROBE-HERO-LAG — "IT'S ALSO LAGGY AT PARTS", in HIS state, across the WHOLE
// beat, through the page's own Play button.
//
// Sebs, 2026-08-01. `measure-drawin-frames.mjs` already covers the DRAW phase on
// four engine x channel takes; this one exists because his sentence says "at
// PARTS", and the draw is one of twelve. A stall in `emerge` or `orbit` is
// invisible to a draw-window measurement, and the 1.1 s stall this beat used to
// carry lived exactly at the draw/emerge boundary.
//
// So: one take, his configuration, every rAF interval of the whole 12 s beat,
// bucketed by the PHASE THE PAGE ITSELF REPORTS (`data-hero-phase`) rather than
// by an assumed offset table.
//
// TWO THINGS MAKE IT AN INSTRUMENT RATHER THAN A LOG:
//   · a WARM take first — the first play after load pays for shader compile and
//     the first geometry build, neither of which is the beat;
//   · a NEGATIVE CONTROL take on `__heroRevealChannel = "state"`, the parked
//     React-commit-per-frame channel, which MUST come out worse. If it does not,
//     this probe is not resolving frame cost and its numbers mean nothing.
//
// Usage: node scripts/verify/_probe-hero-lag.mjs [--label=run] [--engine=free-stroke]
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
const ENGINE = arg("engine", "free-stroke")
const DPR = parseFloat(arg("dpr", "1"))
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
    over16: xs.filter((d) => d > 16.8).length,
    over33: xs.filter((d) => d > 33.4).length,
    over100: xs.filter((d) => d > 100).length,
  }
}

async function main() {
  EV.open()

  const browser = await chromium.launch()
  // RETINA IS NOT OPTIONAL TO CHECK. A prior perf lane on the sibling repo
  // measured dpr 1 in isolation, reported clean, and the real surface lagged;
  // the note it left is "always profile the FINAL path at retina".
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
  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(3000)

  const st = await page.evaluate(() => {
    let wobble = null
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      if ((row?.textContent ?? "").toLowerCase().includes("wobble")) { wobble = Number(inp.value); break }
    }
    const LAB = { clean: "clean", protrude: "protrude", long: "long-overshoot", kink: "kink" }
    let endpoint = null
    for (const b of document.querySelectorAll("button")) {
      const t = (b.textContent ?? "").trim().toLowerCase()
      if (!LAB[t]) continue
      const bg = getComputedStyle(b).backgroundColor
      if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") endpoint = LAB[t]
    }
    const scrub = document.querySelector("[data-hero-scrub]")
    return {
      wobble,
      endpoint,
      engine: document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family"),
      total: Number(scrub?.getAttribute("max") ?? 0),
    }
  })
  /* THE RENDERER IS LOAD-BEARING AND MUST BE PRINTED, NOT ASSUMED. Without
   * --use-angle=metal Chrome falls back to SwiftShader, which silently pauses
   * the rAF loop — and every millisecond below would then be a measurement of
   * nothing. A frozen animation and a still one are identical in a screenshot,
   * so the only defence is to read the string and assert on it. */
  const renderer = await page.evaluate(() => {
    const c = document.createElement("canvas")
    const gl = c.getContext("webgl2") || c.getContext("webgl")
    if (!gl) return "NO WEBGL"
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
  })
  console.log(`dpr ${DPR}`)
  console.log(`renderer: ${renderer}`)
  say(/metal/i.test(renderer), "real GPU (ANGLE Metal), not SwiftShader", renderer)
  console.log(`state: engine=${st.engine} wobble=${st.wobble} endpoint=${st.endpoint} beat=${st.total.toFixed(2)}s`)
  say(st.engine === ENGINE, `engine is ${ENGINE}`, String(st.engine))
  say(st.wobble === 0.4, "wobble 0.40", String(st.wobble))
  say(st.endpoint === "protrude", "endpoint PROTRUDE", String(st.endpoint))

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

  const take = async (channel) => {
    await page.evaluate((c) => { window.__heroRevealChannel = c }, channel)
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
    await page.waitForTimeout((st.total + 0.6) * 1000)
    const rec = await page.evaluate(() => {
      cancelAnimationFrame(window.__raf)
      return { dts: window.__fl.slice(), phases: window.__pl.slice(), ts: window.__ph.slice() }
    })
    await pause()
    return rec
  }

  // WARM — the first play pays for compile + first build; it is not the beat.
  await take("ref")

  const report = {}
  for (const channel of ["ref", "state"]) {
    const rec = await take(channel)
    // Drop index 0: its delta spans the click.
    const rows = rec.dts.map((d, i) => ({ d, phase: rec.phases[i], t: rec.ts[i] })).slice(1)
    const byPhase = {}
    for (const r of rows) (byPhase[r.phase] ??= []).push(r.d)
    const all = rows.map((r) => r.d)
    report[channel] = { all: stats(all), byPhase: {} }
    console.log(`\n--- channel ${channel} · ${rows.length} frames over the whole beat ---`)
    console.log(`  phase          n    median    p95     p99    worst   >16.8  >33.4  >100`)
    for (const [ph, xs] of Object.entries(byPhase)) {
      const s = stats(xs)
      report[channel].byPhase[ph] = s
      console.log(
        `  ${ph.padEnd(13)}${String(s.n).padStart(4)}   ${s.p50.toFixed(1).padStart(6)}  ${s.p95.toFixed(1).padStart(6)}  ` +
          `${s.p99.toFixed(1).padStart(6)}  ${s.worst.toFixed(1).padStart(6)}  ${String(s.over16).padStart(5)}  ${String(s.over33).padStart(5)}  ${String(s.over100).padStart(4)}`,
      )
    }
    const s = stats(all)
    console.log(
      `  ${"ALL".padEnd(13)}${String(s.n).padStart(4)}   ${s.p50.toFixed(1).padStart(6)}  ${s.p95.toFixed(1).padStart(6)}  ` +
        `${s.p99.toFixed(1).padStart(6)}  ${s.worst.toFixed(1).padStart(6)}  ${String(s.over16).padStart(5)}  ${String(s.over33).padStart(5)}  ${String(s.over100).padStart(4)}`,
    )
    // The ten worst frames and where they landed.
    const worst = [...rows].sort((a, b) => b.d - a.d).slice(0, 10)
    console.log(`  ten worst frames: ` + worst.map((w) => `${w.d.toFixed(1)}ms@${w.phase}:${(w.t * 100).toFixed(0)}%`).join("  "))
    report[channel].worst10 = worst
  }

  const a = report.ref.all
  const b = report.state.all
  console.log(`\n  ref  worst ${a.worst.toFixed(1)}ms · >33.4ms ${a.over33}    vs    state worst ${b.worst.toFixed(1)}ms · >33.4ms ${b.over33}`)
  say(
    b.worst > a.worst || b.over16 > a.over16,
    "CONTROL: the parked React-commit channel measures WORSE (or this probe cannot resolve frame cost)",
    `ref ${a.worst.toFixed(1)}ms/${a.over16} vs state ${b.worst.toFixed(1)}ms/${b.over16}`,
  )
  say(a.over100 === 0, "no frame over 100ms anywhere in the beat", `${a.over100}`)
  say(a.over33 <= 3, "at most 3 dropped frames across the whole beat", `${a.over33}`)
  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")

  writeFileSync(join(OUT, "lag.json"), JSON.stringify(report, null, 2))
  await context.close()
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\njson: ${FINAL}`)
  console.log(pass ? "\nALL PASS" : "\nFAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

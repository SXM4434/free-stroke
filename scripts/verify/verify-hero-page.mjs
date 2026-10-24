// VERIFY THE HERO PAGE THROUGH ITS OWN UI — the four bugs and the timeline.
//
// Every check here goes through the page as a human reaches it: the real
// buttons, the real dock, the real rAF clock. State-injection harnesses have
// already passed on this project while the feature they tested was unreachable,
// so nothing below reads a window global that the UI does not also drive.
//
// STANDING RULE: headed Chrome, Metal ANGLE. Headless silently pauses the rAF
// loop here, so a headless run of the stall test would record a frozen scene
// and report a beautiful zero.
//
// What it checks:
//   1. TOGGLES      — both segmented pills are LABELLED and list their two
//                     options in the SAME order. The bug was two unlabelled
//                     mirrored pills.
//   2. TRANSPORTS   — exactly ONE playhead readout and ONE scrub slider inside
//                     the stage column. The bug was the viewport drawing its own
//                     4.6s bar under the page's 5.12s/10.60s one.
//   3. PHASE        — the readout carries its progress WITHIN the phase, so
//                     "STANDUP at el 65.1" reads as "0% into the stand-up",
//                     which is what it always meant. Sampled across the beat and
//                     cross-checked against the pose the sampler reports.
//   4. STALL        — the beat is played in REAL TIME through the page's own
//                     Play button while every rAF interval is recorded. A stall
//                     is a time-domain artefact; scrubbing has no clock and
//                     structurally cannot see one.
//   5. TIMELINE     — DialKit's dock is mounted, carries the eight phases as
//                     clips, and DRAGGING A CLIP EDGE RETIMES THE BEAT: the
//                     panel's own duration readout has to follow the drag,
//                     which is the whole point of the thing.
//
// Usage: node scripts/verify/verify-hero-page.mjs [--label=after]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync, readdirSync, renameSync, existsSync } from "node:fs"
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
const LABEL = arg("label", "after")
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/hero-page/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 18 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "hero-page", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  EV.open()

  const browser = await chromium.launch({ headed: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 240))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 240)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 60000 })
  // The implicit surface builds once, at mount. Wait for the scene to attach
  // rather than for a fixed sleep.
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 90000,
  })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: join(OUT, "01-loaded.png") })

  /* ---- 1. the two toggles ------------------------------------------------ */
  const pills = await page.evaluate(() => {
    const groups = Array.from(document.querySelectorAll("[data-pill-group]"))
    return groups.map((g) => ({
      label: g.getAttribute("data-pill-group") ?? "",
      aria: g.getAttribute("aria-label") ?? "",
      options: Array.from(g.querySelectorAll("button")).map((b) => b.textContent?.trim() ?? ""),
    }))
  })
  say(pills.length === 2, "two segmented pills in the header", `${pills.length} found`)
  say(
    pills.every((p) => p.label.length > 0),
    "both pills are LABELLED",
    pills.map((p) => `${p.label || "(none)"}: ${p.options.join(" | ")}`).join("   "),
  )
  say(
    pills.length === 2 && JSON.stringify(pills[0].options) === JSON.stringify(pills[1].options),
    "both pills list their options in the SAME order",
    pills.map((p) => p.options.join(" | ")).join("   vs   "),
  )

  /* ---- 2. one transport -------------------------------------------------- */
  const transports = await page.evaluate(() => {
    const stage = document.querySelector("main")
    if (!stage) return null
    return {
      sliders: stage.querySelectorAll("input[type=range]").length,
      // Any "N.NNs" clock readout inside the stage column.
      clocks: Array.from(stage.querySelectorAll("span, div"))
        .map((e) => (e.children.length === 0 ? e.textContent ?? "" : ""))
        .filter((t) => /\d+\.\d\d\s*s/.test(t)).length,
      playButtons: Array.from(stage.querySelectorAll("button")).filter((b) =>
        /^(play|pause)$/i.test((b.textContent ?? "").trim()),
      ).length,
    }
  })
  say(transports?.sliders === 1, "exactly one scrub slider in the stage column", `${transports?.sliders}`)
  say(transports?.playButtons === 1, "exactly one Play/Pause button in the stage column", `${transports?.playButtons}`)

  /* ---- 5a. the timeline is mounted --------------------------------------- */
  const dock = await page.evaluate(() => {
    const root = document.querySelector(".dialkit-root.dialkit-timeline")
    if (!root) return null
    const r = root.getBoundingClientRect()
    return { height: Math.round(r.height), top: Math.round(r.top), text: (root.textContent ?? "").slice(0, 400) }
  })
  say(!!dock, "DialKit timeline dock is mounted", dock ? `${dock.height}px tall` : "NOT FOUND")
  if (dock) {
    const phases = ["draw", "breath", "emerge", "tilt", "anticipation", "standup", "orbit", "hold"]
    const missing = phases.filter((p) => !dock.text.toLowerCase().includes(p))
    say(missing.length === 0, "all eight phases appear as clips in the dock", missing.length ? `missing: ${missing.join(", ")}` : "")
    // The dock must not cover the page's own transport.
    const overlap = await page.evaluate(() => {
      const root = document.querySelector(".dialkit-root.dialkit-timeline")
      const play = document.querySelector("[data-hero-play]")
      if (!root || !play) return null
      const a = root.getBoundingClientRect()
      const b = play.getBoundingClientRect()
      return b.bottom > a.top ? Math.round(b.bottom - a.top) : 0
    })
    say(overlap === 0, "the dock does not cover the page's own transport", overlap ? `${overlap}px overlap` : "clear")
  }
  await page.screenshot({ path: join(OUT, "02-dock.png") })

  /* ---- 3. the phase readout ---------------------------------------------- */
  const total = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-scrub]")
    return el ? parseFloat(el.max) : 0
  })
  say(total > 0, "the transport reports a total duration", `${total.toFixed(2)}s`)

  const readouts = []
  for (let i = 0; i <= 20; i++) {
    const t = (total * i) / 20
    await page.evaluate((v) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.waitForTimeout(70)
    readouts.push(
      await page.evaluate(() => {
        const el = document.querySelector("[data-hero-phase]")
        return {
          phase: el?.getAttribute("data-hero-phase") ?? "",
          phaseT: parseFloat(el?.getAttribute("data-hero-phase-t") ?? "NaN"),
          text: (el?.textContent ?? "").replace(/\s+/g, " ").trim(),
        }
      }),
    )
  }
  say(
    readouts.every((r) => r.phase && Number.isFinite(r.phaseT)),
    "the phase readout always carries a phase AND its progress",
  )
  say(
    readouts.every((r) => /\d+%/.test(r.text)),
    "the progress is VISIBLE, not just in a data attribute",
    readouts[10]?.text ?? "",
  )
  const phasesSeen = [...new Set(readouts.map((r) => r.phase))]
  say(phasesSeen.length >= 6, "scrubbing walks the phases", phasesSeen.join(" → "))

  /* ---- 5b. dragging a clip retimes the beat ------------------------------ */
  const beatBefore = await page.evaluate(
    () => document.querySelector('[data-beat="orbit"]')?.getAttribute("data-beat-sec") ?? null,
  )
  say(beatBefore !== null, "the panel reports the live beat durations", `orbit ${beatBefore}s`)

  // Drag the ORBIT clip's END handle to the left. DialKit's own markup:
  // `.dialkit-timeline-clip` carries `title="<Label> — <at> for <duration>"`,
  // and its resize grips are `.dialkit-timeline-clip-handle[data-edge]`.
  const dragged = await (async () => {
    const box = await page.evaluate(() => {
      const clips = Array.from(document.querySelectorAll(".dialkit-timeline-clip"))
      const clip = clips.find((c) => /^orbit\b/i.test(c.getAttribute("title") ?? ""))
      if (!clip) {
        return {
          err: "no orbit clip",
          titles: clips.map((c) => (c.getAttribute("title") ?? "").slice(0, 24)),
        }
      }
      const handle = clip.querySelector('.dialkit-timeline-clip-handle[data-edge="end"]')
      if (!handle) return { err: "orbit clip has no end handle" }
      const r = handle.getBoundingClientRect()
      const c = clip.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, clipW: c.width }
    })
    if (box.err) return { ok: false, why: `${box.err}${box.titles ? " — saw " + box.titles.join(", ") : ""}` }
    await page.mouse.move(box.x, box.y)
    await page.mouse.down()
    // Well past DRAG_THRESHOLD_PX, and in steps so pointermove actually fires.
    await page.mouse.move(box.x - box.clipW * 0.35, box.y, { steps: 15 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    return { ok: true }
  })()
  const beatAfter = await page.evaluate(
    () => document.querySelector('[data-beat="orbit"]')?.getAttribute("data-beat-sec") ?? null,
  )
  await page.screenshot({ path: join(OUT, "03-after-drag.png") })
  say(
    dragged.ok && beatAfter !== null && beatBefore !== null && beatAfter !== beatBefore,
    "DRAGGING A CLIP EDGE RETIMES THE BEAT (one source of truth)",
    `orbit ${beatBefore}s → ${beatAfter}s${dragged.why ? " — " + dragged.why : ""}`,
  )
  // And the derived total has to have followed it.
  const totalAfter = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-scrub]")
    return el ? parseFloat(el.max) : 0
  })
  say(
    Math.abs(totalAfter - total) > 0.01,
    "the beat's total followed the retimed clip",
    `${total.toFixed(2)}s → ${totalAfter.toFixed(2)}s`,
  )
  // Put it back so the stall measurement runs on the captured choreography.
  await page.evaluate(() => {
    document.querySelectorAll("button").forEach((b) => {
      if ((b.textContent ?? "").toLowerCase().includes("revert to captured")) b.click()
    })
  })
  await page.waitForTimeout(400)
  const totalReverted = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-scrub]")
    return el ? parseFloat(el.max) : 0
  })
  say(
    Math.abs(totalReverted - total) < 0.02,
    "Revert to captured values restores the timeline's own clips",
    `${totalAfter.toFixed(2)}s → ${totalReverted.toFixed(2)}s (was ${total.toFixed(2)}s)`,
  )

  /* ---- 4. THE STALL, in real time through the page's own Play button ----- */
  await page.evaluate(() => {
    window.__frameLog = []
    window.__phaseLog = []
    let last = performance.now()
    const tick = (now) => {
      window.__frameLog.push(now - last)
      last = now
      const el = document.querySelector("[data-hero-phase]")
      window.__phaseLog.push(el?.getAttribute("data-hero-phase") ?? "")
      window.__frameRaf = requestAnimationFrame(tick)
    }
    window.__frameRaf = requestAnimationFrame(tick)
  })
  // Reset to zero, then press the page's own Play.
  await page.evaluate(() => {
    document.querySelectorAll("button").forEach((b) => {
      if ((b.textContent ?? "").trim().toLowerCase() === "reset") b.click()
    })
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    window.__frameLog.length = 0
    window.__phaseLog.length = 0
  })
  const tPlay = Date.now()
  await page.click("[data-hero-play]")
  await page.waitForTimeout((totalReverted + 1.2) * 1000)
  const wall = (Date.now() - tPlay) / 1000
  const frames = await page.evaluate(() => {
    cancelAnimationFrame(window.__frameRaf)
    return { dts: window.__frameLog.slice(), phases: window.__phaseLog.slice() }
  })
  await page.screenshot({ path: join(OUT, "04-after-play.png") })

  const dts = frames.dts.slice(1)
  dts.sort((a, b) => a - b)
  const p50 = dts[Math.floor(dts.length * 0.5)] ?? 0
  const p99 = dts[Math.floor(dts.length * 0.99)] ?? 0
  const worst = dts[dts.length - 1] ?? 0
  const over100 = dts.filter((d) => d > 100).length
  console.log(
    `\n  real-time play: ${frames.dts.length} frames over ${wall.toFixed(1)}s wall — ` +
      `median ${p50.toFixed(1)}ms, p99 ${p99.toFixed(1)}ms, worst ${worst.toFixed(1)}ms, ` +
      `${over100} frames over 100ms`,
  )
  // 100ms is three dropped frames — well below the 1.1s stall and well above
  // ordinary jitter on a WebGL page, so it can distinguish the two.
  say(worst < 250, "no frame stalls during the beat", `worst frame ${worst.toFixed(0)}ms (was ~1100ms)`)
  say(over100 === 0, "no frame over 100ms", `${over100} frames`)

  // The emerge is 0.54s of a 10.2s beat. If the stall eats it, it is simply
  // never rendered — which is the symptom this whole thing dies of.
  const emergeFrames = frames.phases.filter((p) => p === "emerge").length
  say(emergeFrames > 5, "the EMERGE beat is actually rendered", `${emergeFrames} frames on it`)
  const seen = [...new Set(frames.phases.filter(Boolean))]
  say(seen.length >= 7, "every phase is rendered during real-time playback", seen.join(" → "))

  /* ---- console ------------------------------------------------------------ */
  say(errors.length === 0, "no console errors", errors.slice(0, 3).join(" | "))

  writeFileSync(
    join(OUT, "report.json"),
    JSON.stringify(
      { pills, transports, dock: dock && { height: dock.height }, total, totalAfter, totalReverted, p50, p99, worst, over100, emergeFrames, seen, errors },
      null,
      2,
    ),
  )

  await context.close()
  await browser.close()
  for (const f of readdirSync(OUT)) {
    if (f.endsWith(".webm")) renameSync(join(OUT, f), join(OUT, "play.webm"))
  }
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\n${pass ? "ALL CHECKS PASS" : "FAILURES ABOVE"}   frames+video: ${FINAL}`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

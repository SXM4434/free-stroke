// HOW THE DRAW-IN PLAYS — delay, ease, reverse, loop (PRD §7 Phase 22).
//
// WHAT WAS THERE BEFORE, stated plainly: play/pause, a scrubber, and three
// speed buttons. That was the user's ENTIRE authority over the single most
// important motion in the product. Of the PRD's geometry-animation v1 list —
// speed, duration, delay, loop, reverse, easing, reveal styles — three existed
// (speed, the strokes' own duration, and Natural/Authentic/Smooth) and four did
// not exist in any form.
//
// THE ONE DISTINCTION THIS FILE HAS TO PROTECT
// ---------------------------------------------------------------------------
// `revealMode` (Natural / Authentic / Smooth) reshapes how ARC LENGTH maps to
// time from the recorded pen speed — a property of the HAND. `revealEase`
// reshapes the clock over the WHOLE draw — a property of the SHOT. They are
// different controls that compose, and if the ease were secretly just another
// reveal mode this suite would be testing a duplicate. Section B measures the
// ease with the reveal mode held fixed, and section F drives them together.
//
// EVERY ROW HAS A CONTROL THAT GOES RED
// ---------------------------------------------------------------------------
// A green row that cannot fail is the lie this repo keeps paying for, so each
// claim below is paired with a configuration in which the SAME measurement must
// come back the other way — linear against eased, delay 0 against delay 1.5,
// forwards against reverse, loop off against loop on.
//
// Usage: node scripts/verify/assert-drawin-timing.mjs [--save]
//        node scripts/verify/_run-clean.mjs scripts/verify/assert-drawin-timing.mjs
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const SAVE = process.argv.includes("--save")
const OUT = join(ROOT, "docs", "verification", "drawin-timing")

let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function decode(dataUrl) {
  const buf = Buffer.from(dataUrl.match(/base64,(.+)/)[1], "base64")
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data, buf }
}
/** How much of the frame carries mark. The reveal's own quantity. */
function coverage(a) {
  let n = 0
  for (let i = 3; i < a.d.length; i += 4) if (a.d[i] >= 20) n++
  return n / (a.d.length / 4)
}

function testStroke() {
  const pts = []
  for (let i = 0; i <= 140; i++) {
    const t = i / 140
    pts.push({ x: 150 + t * 600, y: 340 + Math.sin(t * Math.PI * 2.1) * 130 })
  }
  return [pts]
}

/* The envelope, re-derived here ONLY to check the app against an independent
 * implementation. If this file imported the app's own `easeReveal` the row
 * would be `f(x) === f(x)` — true, and worth nothing. */
const refEase = (u, e) =>
  e === "in"
    ? u * u * u
    : e === "out"
      ? 1 - Math.pow(1 - u, 3)
      : e === "inOut"
        ? u < 0.5
          ? 4 * u * u * u
          : 1 - Math.pow(-2 * u + 2, 3) / 2
        : u

async function main() {
  if (SAVE) mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1500 },
    reducedMotion: "no-preference",
  })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)))
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness && window.__revealHarness, null, {
    timeout: 30000,
  })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1500)

  const wait = (ms) => page.waitForTimeout(ms)
  const R = (fn, ...a) => page.evaluate(fn, ...a)
  const shot = async (name) => {
    const f = await decode(await R(() => window.__captureHarness.grab()))
    if (SAVE && name) writeFileSync(join(OUT, `${name}.png`), f.buf)
    return f
  }

  /* PLAY FOR A BOUNDED WINDOW, MEASURED IN-PAGE.
   *
   * ⚠ AN INSTRUMENT BUG, CAUGHT BY RUNNING THIS SUITE AFTER EIGHT OTHER BROWSER
   * RUNS RATHER THAN ALONE. The first version drove `setPlaying(true)`, waited
   * with `page.waitForTimeout(ms)`, then drove `setPlaying(false)` — three
   * separate CDP round trips. The reveal advances on `performance.now()`, so
   * the window it actually ran for was `ms + however long the PAUSE call took
   * to arrive`, and under load that round trip is unbounded. Standalone the row
   * read a playhead of 0.50; inside the sweep the same code read 1.00, i.e. the
   * draw had finished before the pause landed, and the row failed for a reason
   * that had nothing to do with what it was testing.
   *
   * A gate that goes red when the machine is busy is not a gate — it teaches
   * people to re-run until it is green, which is how a real failure gets
   * re-run away. So the play, the wait, the sample and the pause all happen
   * inside ONE page call: the window is bounded by the page's own clock and no
   * round trip can stretch it. */
  /* CLOUD-FLAKES: the window is now exact, not merely bounded. The in-page
   * setTimeout above still let the page's frames decide how far the pass got
   * (a 756 ms sleep read clocks 0.37 to 0.46 over ten quiet runs), and the
   * coverage CONTROL in B ("the same ease at the same moment draws the same
   * amount of mark", bar 12%) compares two such windows: measured 0.333% vs
   * 0.281%, 16% apart, red, on unchanged code. So the play runs on the driven
   * clock (`playDriven`, below): exactly `ms` of the reveal's own clock, read
   * on the frame after. The parked prior, for the record:
   *
   *     R(async (d) => { h.setPlaying(true); await sleep(d)
   *                      read clock, head, playing; h.setPlaying(false) }, ms)
   */
  const playFor = (ms) => playDriven(ms)

  /* PLAY UNTIL THE PLAYHEAD IS ACTUALLY WHERE WE WANT TO READ IT. F108.
   *
   * `playFor` sleeps a fixed slice of wall time and then reads the clock, which
   * is a BET THAT THE MACHINE KEEPS UP. Under load the page misses frames, the
   * pass finishes early, and a sample meant for the middle lands at 1.000000.
   * Measured 2026-09-05: red inside a battery sharing the box with a production
   * server, and 4 of 4 green on a quiet machine, on identical code. The same
   * thing cost a lane most of an hour on 09-04.
   *
   * ⚠ THE BAR DOES NOT MOVE. The control still requires `0.2 < head < 0.8`.
   * This only makes the SAMPLER land where it always intended to, by watching
   * the page's own playhead instead of the wall clock. It is the lesson the
   * Delay row learned this morning, applied to the other direction: grade
   * against the clock you are measuring, not against the one on the wall.
   *
   * ⚠ AND IT KEEPS ITS TEETH. If the playhead never enters the band, this
   * returns the last reading it saw and the control fails exactly as before. A
   * transport that does not move still fails; only the false red goes away. */
  const playUntilHead = (lo, hi, capMs) =>
    R(async ([l, h_, cap]) => {
      const h = window.__revealHarness
      const head0 = h.getProgress()
      h.setPlaying(true)
      const t0 = performance.now()
      let last = { clock: h.getClock(), head: h.getProgress(), playing: h.isPlaying() }
      let landed = false
      /* ⚠ DO NOT BAIL BEFORE PLAYBACK HAS ACTUALLY STARTED, and this cost a
       * wrong first version. Pressing play while the playhead sits AT THE END
       * restarts the pass from 0, but the restart lands on the NEXT frame, so
       * the first reading is still 1.0000. An immediate "the pass is over"
       * check therefore fired 42ms in, every time, on a healthy transport. That
       * is exactly the mistake the old fixed sleep accidentally avoided by
       * never looking early. So the terminal check ARMS only once the head has
       * been seen below 1: until then, a 1 means "not started yet", not "over". */
      let started = false
      while (performance.now() - t0 < cap) {
        const head = h.getProgress()
        last = { clock: h.getClock(), head, playing: h.isPlaying() }
        if (head < 1) started = true
        if (started && head >= l && head <= h_) { landed = true; break }
        if (started && head >= 1) break // the pass really did end without landing
        await new Promise((r) => requestAnimationFrame(() => r()))
      }
      h.setPlaying(false)
      return { ...last, landed, head0, waitedMs: Math.round(performance.now() - t0) }
    }, [lo, hi, capMs])

  /* PLAY EXACTLY `ms` OF THE PAGE'S OWN CLOCK, AT A FIXED FRAME. CLOUD-FLAKES.
   *
   * `playUntilHead` still SAMPLED: it polled the playhead once a frame and
   * read it if it happened to be inside 0.3..0.5. The band is 0.2 of a 1680 ms
   * pass, 336 ms, so one stalled frame of 336 ms or more steps clean over it.
   * The poll then sees 0.55, is not in the band, is not at 1, and keeps
   * polling until the pass ends, so the row reads 1.000000 and goes red. That
   * is the 24 of 25 on main: a loaded frame, not the transport.
   *
   * The reveal advances on `performance.now()` deltas taken once a frame
   * (PlaybackController in components/viewport-3d.tsx). So this DRIVES that
   * clock instead of racing it: inside one page call `performance.now` reads a
   * value this function sets, and it moves only when this function moves it.
   *   1. Press play and step the clock 1 ms a frame until the playhead moves.
   *      The controller arms on its first playing frame and advances on the
   *      next, so the first move is exactly one 1 ms step, however many frames
   *      React takes to deliver `playing`.
   *   2. Step it once more by `ms - 1`. The controller spends the whole step on
   *      its next frame, so the pass has run exactly `ms`, read on the frame
   *      after it, whatever the frame rate and however long the frames took.
   * Nothing is read off the wall. A busy machine makes this slower, never
   * different.
   *
   * ⚠ IT KEEPS ITS TEETH. A transport that does not move never takes the 1 ms
   * step, so the loop runs out at `capFrames` and returns the head where it
   * sat with `moved: false`; the CONTROL below then fails on "did not move",
   * exactly as Codex's frozen-transport sabotage requires. The bar is not
   * touched: 0.2 < head < 0.8 still, and the identity row still to 1e-9.
   *
   * `performance.now` is put back before the call returns, and only once the
   * real clock has caught up with the driven one, so nothing in the page sees
   * time run backwards. */
  const playDriven = (ms, capFrames = 900) =>
    R(async ([d, cap]) => {
      const h = window.__revealHarness
      const perf = window.performance
      const hadOwn = Object.prototype.hasOwnProperty.call(perf, "now")
      const ownNow = perf.now
      const realNow = Performance.prototype.now.bind(perf)
      const t0 = realNow()
      let virt = t0
      perf.now = () => virt
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()))
      try {
        const head0 = h.getProgress()
        const clock0 = h.getClock()
        h.setPlaying(true)
        let frames = 0
        let moved = false
        while (frames < cap) {
          await frame()
          frames++
          if (h.getClock() !== clock0) { moved = true; break }
          virt += 1
        }
        const clockArmed = h.getClock()
        const armSteps = Math.round(virt - t0)
        if (moved && d > 1) {
          virt += d - 1
          moved = false
          while (frames < cap) {
            await frame()
            frames++
            if (h.getClock() !== clockArmed) { moved = true; break }
          }
        }
        /* Let the frame's consequences land before reading: an end of pass pauses the transport
         * through React state, a commit or two later. The driven clock stands still meanwhile,
         * so these frames advance nothing; they only let `isPlaying` catch up. */
        for (let k = 0; k < 4; k++) await frame()
        await new Promise((r) => setTimeout(r, 100))
        await frame()
        const out = { clock: h.getClock(), head: h.getProgress(), playing: h.isPlaying(), head0, moved, frames, armSteps, drivenMs: d }
        h.setPlaying(false)
        while (h.isPlaying() && frames < cap + 60) { await frame(); frames++ }
        await frame()
        await frame()
        while (realNow() < virt) await new Promise((r) => setTimeout(r, 10))
        return out
      } finally {
        if (hadOwn) perf.now = ownNow
        else delete perf.now
      }
    }, [ms, capFrames])

  /* ================================================================== */
  /*  A · THE CONTROL SURFACE EXISTS AND CARRIES ITS STATE               */
  /* ================================================================== */
  console.log("\n=== A · the control surface ===")
  /* PANEL-2: the Timing popover is the dock's Draw-in section now. The button
   * opens it, and the header (button plus its summary) carries the state. */
  const timingBtn = page.locator("[data-animation-drawin]")
  const timingHead = timingBtn.locator("..")
  say(await timingBtn.isVisible(), "the transport has a Timing control")
  await timingBtn.click()
  await wait(250)
  const dlg = page.getByRole("region", { name: "Draw-in timing" })
  say(await dlg.isVisible(), "…which opens a panel")
  const labels = await R(() =>
    [...document.querySelectorAll('[data-animation-drawin-body] button')].map((b) => b.textContent.trim()),
  )
  say(
    ["Linear", "Ease in", "Ease out", "Ease in-out", "Reverse", "Loop"].every((l) => labels.includes(l)),
    "…carrying all four missing controls: delay, ease, reverse, loop",
    labels.join(" · "),
  )
  /* PANEL-5: the row "Escape dismisses it" is BACK, pointed at the section.
   * PANEL-3 retired it because the Timing popover it tested was gone and the
   * Draw-in disclosure had nothing for Escape to do. PANEL-4 bound Escape to
   * shut the section (viewport-3d, the ESCAPE SHUTS THE DRAW-IN SECTION
   * effect), so the contract holds again and is read here on the region and on
   * the header's `aria-expanded`. The header row after it stays: it reopens
   * the section and closes it with the control that closes it, so every row
   * below starts shut, as it did when Escape shut the popover. */
  await page.keyboard.press("Escape")
  await wait(200)
  const escExpanded = await timingBtn.getAttribute("aria-expanded")
  say(
    !(await dlg.isVisible()) && escExpanded === "false",
    "CONTROL · Escape dismisses it (same contract as the still-export popover)",
    `region visible ${await dlg.isVisible()} · aria-expanded ${escExpanded}`,
  )
  await timingBtn.click()
  await wait(250)
  const reopened = await dlg.isVisible()
  await timingBtn.click()
  await wait(200)
  const expanded = await timingBtn.getAttribute("aria-expanded")
  say(
    reopened && !(await dlg.isVisible()) && expanded === "false",
    "CONTROL · the Draw-in header opens it again and closes it again",
    `reopened ${reopened} · region visible ${await dlg.isVisible()} · aria-expanded ${expanded}`,
  )

  const btnText = async () => (await timingHead.textContent()).trim()
  const plain = await btnText()
  await R(() => window.__revealHarness.setLoop(true))
  await R(() => window.__revealHarness.setDelay(1.5))
  await wait(250)
  const loaded = await btnText()
  say(
    plain === "Draw-in" && /1\.5s/.test(loaded) && /loop/.test(loaded),
    "the collapsed control SAYS what is set — a delay is never a mystery pause",
    `"${plain}" → "${loaded}"`,
  )
  await R(() => window.__revealHarness.setLoop(false))
  await R(() => window.__revealHarness.setDelay(0))
  await wait(200)

  await R(() => window.__captureHarness.enable())
  await R(() => window.__captureHarness.orbitView(0, 0, 1.0))
  await wait(500)
  const totalMs = await R(() => window.__revealHarness.getTotalDuration())
  console.log(`  (the drawing's own timeline: ${totalMs.toFixed(0)} ms)`)

  /* ================================================================== */
  /*  B · EASE — the frame loop actually runs the envelope               */
  /* ================================================================== */
  console.log("\n=== B · ease over the whole draw ===")
  const easeRow = async (e) => {
    await R(() => window.__revealHarness.setProgress(0))
    await R((x) => window.__revealHarness.setEase(x), e)
    await wait(200)
    const { clock, head } = await playFor(Math.round(totalMs * 0.45))
    return { e, clock, head, want: refEase(clock, e) }
  }
  const eases = []
  for (const e of ["linear", "in", "out", "inOut"]) eases.push(await easeRow(e))
  console.log("ease      clock    playhead  expected")
  for (const r of eases)
    console.log(`${r.e.padEnd(9)} ${r.clock.toFixed(4)}   ${r.head.toFixed(4)}    ${r.want.toFixed(4)}`)

  say(
    eases.every((r) => Math.abs(r.head - r.want) < 0.02),
    "the playhead IS ease(clock) — the envelope runs in the frame loop, not only in a helper",
    eases.map((r) => `${r.e} Δ${Math.abs(r.head - r.want).toFixed(4)}`).join(" · "),
  )
  const lin = eases.find((r) => r.e === "linear")
  say(
    Math.abs(lin.head - lin.clock) < 1e-6,
    "CONTROL · on Linear the playhead and the clock are the same number (the check can read 'no reshaping')",
    `|${lin.head.toFixed(6)} − ${lin.clock.toFixed(6)}|`,
  )
  const easeIn = eases.find((r) => r.e === "in")
  const easeOut = eases.find((r) => r.e === "out")
  say(
    easeIn.head < easeIn.clock - 0.05 && easeOut.head > easeOut.clock + 0.05,
    "…and they part in the right DIRECTIONS: ease-in is behind the clock, ease-out ahead of it",
    `in ${easeIn.head.toFixed(3)} < ${easeIn.clock.toFixed(3)} · out ${easeOut.head.toFixed(3)} > ${easeOut.clock.toFixed(3)}`,
  )

  /* THE PIXEL CHANNEL. Numbers agreeing with a formula is not the claim; the
   * claim is that a viewer sees a different amount of mark at the same moment. */
  const coverageAt = async (e, frac, name) => {
    await R(() => window.__revealHarness.setProgress(0))
    await R((x) => window.__revealHarness.setEase(x), e)
    await wait(200)
    await playFor(Math.round(totalMs * frac))
    await wait(300)
    return coverage(await shot(name))
  }
  const covLinear = await coverageAt("linear", 0.4, SAVE ? "mid_linear" : null)
  const covIn = await coverageAt("in", 0.4, SAVE ? "mid_easeIn" : null)
  const covLinear2 = await coverageAt("linear", 0.4, SAVE ? "mid_linear_repeat" : null)
  say(
    Math.abs(covLinear - covLinear2) < covLinear * 0.12,
    "CONTROL · the same ease at the same moment draws the same amount of mark",
    `${(covLinear * 100).toFixed(3)}% vs ${(covLinear2 * 100).toFixed(3)}%`,
  )
  say(
    covIn < covLinear * 0.75,
    "EASE IS VISIBLE: 40% of the way through, ease-in has laid down far less mark than linear",
    `ease-in ${(covIn * 100).toFixed(3)}% vs linear ${(covLinear * 100).toFixed(3)}%`,
  )

  /* SWITCHING THE ENVELOPE MUST NOT TELEPORT THE MARK. */
  await R(() => window.__revealHarness.setEase("linear"))
  await R(() => window.__revealHarness.setProgress(0.5))
  await wait(400)
  const beforeSwitch = await shot(SAVE ? "switch_before" : null)
  await R(() => window.__revealHarness.setEase("inOut"))
  await wait(400)
  const afterSwitch = await shot(SAVE ? "switch_after" : null)
  const headAfter = await R(() => window.__revealHarness.getProgress())
  const clockAfter = await R(() => window.__revealHarness.getClock())
  say(
    Math.abs(headAfter - 0.5) < 1e-6 && coverage(beforeSwitch) === coverage(afterSwitch),
    "changing the ease while paused leaves the FRAME exactly as it was — it only changes what happens next",
    `playhead ${headAfter.toFixed(6)}, coverage ${(coverage(beforeSwitch) * 100).toFixed(4)}% → ${(coverage(afterSwitch) * 100).toFixed(4)}%`,
  )
  say(
    Math.abs(refEase(clockAfter, "inOut") - 0.5) < 0.01,
    "CONTROL · the clock behind it was RE-DERIVED, so resuming continues from where the viewer is",
    `clock ${clockAfter.toFixed(4)} → ease(clock) ${refEase(clockAfter, "inOut").toFixed(4)}`,
  )
  await R(() => window.__revealHarness.setEase("linear"))

  /* ================================================================== */
  /*  C · DELAY — stillness, not a slow start                            */
  /* ================================================================== */
  console.log("\n=== C · delay ===")
  const delayRow = async (sec) => {
    await R(() => window.__revealHarness.setProgress(0))
    await R((x) => window.__revealHarness.setDelay(x), sec)
    await wait(250)
    const probe = await R(async (t) => {
      const h = window.__revealHarness
      h.setPlaying(true)
      await new Promise((r) => setTimeout(r, 600))
      const early = h.getProgress()
      await new Promise((r) => setTimeout(r, t))
      const late = h.getProgress()
      h.setPlaying(false)
      return { early, late }
    }, Math.round(1400 + totalMs))
    return { sec, early: probe.early, late: probe.late }
  }
  const d0 = await delayRow(0)
  const d15 = await delayRow(1.5)
  say(
    d15.early === 0,
    "with a 1.5s delay the mark has not moved AT ALL 600 ms in — it is stillness, not a slow start",
    `playhead ${d15.early}`,
  )
  say(
    d0.early > 0.15,
    "CONTROL · with no delay it is already well under way at the same 600 ms",
    `playhead ${d0.early.toFixed(3)}`,
  )
  say(
    d15.late > 0.9,
    "…and the delay costs the draw none of its own duration — it still finishes",
    `playhead ${d15.late.toFixed(3)} after delay + timeline`,
  )
  await R(() => window.__revealHarness.setDelay(0))

  /* ================================================================== */
  /*  D · REVERSE — the mark un-draws                                    */
  /* ================================================================== */
  console.log("\n=== D · reverse ===")
  await R(() => window.__revealHarness.setReverse(false))
  await R(() => window.__revealHarness.setProgress(0))
  await wait(250)
  await playFor(Math.round(totalMs * 0.3))
  await wait(300)
  const fwdA = coverage(await shot(SAVE ? "fwd_early" : null))
  await playFor(Math.round(totalMs * 0.3))
  await wait(300)
  const fwdB = coverage(await shot(SAVE ? "fwd_late" : null))

  await R(() => window.__revealHarness.setReverse(true))
  await R(() => window.__revealHarness.setProgress(1))
  await wait(250)
  await playFor(Math.round(totalMs * 0.3))
  await wait(300)
  const revA = coverage(await shot(SAVE ? "rev_early" : null))
  await playFor(Math.round(totalMs * 0.3))
  await wait(300)
  const revB = coverage(await shot(SAVE ? "rev_late" : null))
  say(
    revB < revA,
    "REVERSE un-draws: the mark carries LESS ink as the pass goes on",
    `${(revA * 100).toFixed(3)}% → ${(revB * 100).toFixed(3)}%`,
  )
  say(
    fwdB > fwdA,
    "CONTROL · forwards, on the same clock, the same measurement goes the other way",
    `${(fwdA * 100).toFixed(3)}% → ${(fwdB * 100).toFixed(3)}%`,
  )
  /* A reverse pass ends at 0, so the OLD end-of-pass test (`progress >= 1`)
   * could never have fired on it. This is the row that catches that. */
  await R(() => window.__revealHarness.setProgress(1))
  await R(() => window.__revealHarness.setPlaying(true))
  await wait(Math.round(totalMs * 1.6 + 900))
  const revEnded = await R(() => ({
    playing: window.__revealHarness.isPlaying(),
    p: window.__revealHarness.getProgress(),
  }))
  say(
    revEnded.playing === false && revEnded.p < 0.02,
    "a reverse pass STOPS when it reaches the start — it does not run against the floor forever",
    `playing ${revEnded.playing}, playhead ${revEnded.p.toFixed(4)}`,
  )
  await R(() => window.__revealHarness.setReverse(false))

  /* ================================================================== */
  /*  E · LOOP                                                           */
  /* ================================================================== */
  console.log("\n=== E · loop ===")
  const endState = async (loop) => {
    await R((x) => window.__revealHarness.setLoop(x), loop)
    await R(() => window.__revealHarness.setProgress(0))
    await wait(250)
    const w = await playFor(Math.round(totalMs * 1.45))
    return { playing: w.playing, p: w.head }
  }
  const noLoop = await endState(false)
  const withLoop = await endState(true)
  say(
    withLoop.playing === true && withLoop.p < 0.9,
    "LOOP restarts: past the end of the timeline it is still playing, from near the beginning",
    `playing ${withLoop.playing}, playhead ${withLoop.p.toFixed(3)}`,
  )
  say(
    noLoop.playing === false && noLoop.p > 0.99,
    "CONTROL · with loop off the same run has stopped, pinned at the end",
    `playing ${noLoop.playing}, playhead ${noLoop.p.toFixed(3)}`,
  )
  await R(() => window.__revealHarness.setLoop(false))

  /* ================================================================== */
  /*  F · THEY COMPOSE, AND THE DEFAULTS ARE THE OLD BEHAVIOUR           */
  /* ================================================================== */
  console.log("\n=== F · composition + defaults ===")
  await R(() => window.__revealHarness.setEase("out"))
  await R(() => window.__revealHarness.setDelay(0.5))
  await R(() => window.__revealHarness.setReverse(true))
  await R(() => window.__revealHarness.setLoop(true))
  await R(() => window.__revealHarness.setProgress(1))
  await wait(250)
  const comb = await R(async (t) => {
    const h = window.__revealHarness
    h.setPlaying(true)
    await new Promise((r) => setTimeout(r, 300))
    const early = h.getProgress()
    await new Promise((r) => setTimeout(r, t))
    const out = { early, playing: h.isPlaying(), p: h.getProgress() }
    h.setPlaying(false)
    return out
  }, Math.round(500 + totalMs * 1.5))
  const combEarly = comb.early
  const combLate = { playing: comb.playing, p: comb.p }
  say(
    combEarly === 1 && combLate.playing === true,
    "all four at once: the delay holds the full mark, then it un-draws, and it keeps going",
    `at +300ms playhead ${combEarly}, still playing after a full pass: ${combLate.playing}`,
  )

  await R(() => {
    window.__revealHarness.setEase("linear")
    window.__revealHarness.setDelay(0)
    window.__revealHarness.setReverse(false)
    window.__revealHarness.setLoop(false)
    window.__revealHarness.setProgress(0)
  })
  await wait(300)
  /* Play exactly 40% of the pass on the DRIVEN clock and read on the frame
   * after (`playDriven`, CLOUD-FLAKES). 0.4 is the middle of the old 0.3..0.5
   * band, well inside the control's own 0.2..0.8. The old `playUntilHead`
   * stays in the file for the record; nothing calls it. */
  const DEF_FRAC = 0.4
  const def = await playDriven(totalMs * DEF_FRAC)
  const defClock = def.clock
  const defHead = def.head
  console.log(
    `  (defaults: head BEFORE play ${def.head0.toFixed(4)} · read at ${defHead.toFixed(6)} after ${def.drivenMs.toFixed(1)} ms of driven clock` +
      ` (arm steps ${def.armSteps}, ${def.frames} frames)` +
      `${def.moved ? "" : "; THE DRIVEN CLOCK NEVER MOVED THE PLAYHEAD, the control below will say so"})`,
  )
  /* ⚠ THIS WAS ONE ROW AND IT REPORTED TWO DIFFERENT FAILURES THE SAME WAY.
   *
   * PARKED PRIOR:
   *
   *     say(Math.abs(defClock - defHead) < 1e-9 && defHead > 0.2 && defHead < 0.8,
   *         "AT THE DEFAULTS the transport is exactly what it was before these
   *          controls existed",
   *         `clock ${defClock.toFixed(6)} === playhead ${defHead.toFixed(6)}`)
   *
   * The `&&` bolted a SAMPLING condition onto an IDENTITY claim. It can fail
   * because the envelope reshaped the clock — the thing the row is for — or
   * because the pass simply finished before the sample, which says nothing
   * about the envelope and everything about how loaded the machine was. Both
   * printed the same sentence, and the second one prints `clock 1.000000`.
   *
   * MEASURED, 2026-09-04. The browser battery of 12:17 reported this row red
   * with `clock 1.000000`. On a dedicated server the same row is green three
   * runs running at clock 0.3367 / 0.3466 / 0.3369, so the red was the sample
   * landing past the end of a 35% window, not the transport. That battery ran
   * inside a wave of commits with the dev server recompiling under it. Working
   * out which of the two had happened cost a lane most of an hour, because the
   * row could not say.
   *
   * So they are two rows now. The identity keeps its bar to the ULP; the window
   * keeps its bar exactly where it was and says out loud what it means when it
   * is the one that fired. Neither bar moved. */
  say(
    Math.abs(defClock - defHead) < 1e-9,
    "AT THE DEFAULTS the transport is exactly what it was before these controls existed",
    `clock ${defClock.toFixed(6)} === playhead ${defHead.toFixed(6)}` +
      (Math.abs(defClock - defHead) < 1e-9
        ? ""
        : ` — Δ${Math.abs(defClock - defHead).toExponential(3)}. Something is reshaping the clock at the shipped defaults. ` +
          `REVEAL_ENVELOPE_DEFAULTS.cadence flipped to "twos" produces exactly this (quantised display against a continuous clock).`),
  )
  /* 🔴 F113 FINDING 5 (Codex, 2026-09-18), reproduced 2026-09-22. "Mid-pass"
   * was read as "the playhead is inside 0.2..0.8", and a playhead FROZEN at 0.4
   * is inside 0.2..0.8. Codex pinned getProgress and getClock at 0.4 and made
   * setPlaying do nothing: landed=true, playing=false, and both rows passed, so
   * the row that claims "the clock was still moving" never checked that it moved.
   * The sample now also has to be taken WHILE PLAYING and AHEAD of where the head
   * sat before play was pressed. The 0.2..0.8 bar is unchanged. */
  /* CLOUD-FLAKES: `moved` is the driven sampler's own word that the playhead
   * answered the driven clock; it is ANDed in, never instead of the checks
   * Codex's sabotage needs. */
  const sampleMoved = (s) =>
    s.playing === true && s.moved === true && Number.isFinite(s.head) && Number.isFinite(s.head0) && s.head > s.head0
  say(
    defHead > 0.2 && defHead < 0.8 && sampleMoved(def),
    "CONTROL · that sample landed mid-pass, so the identity above was read while the clock was still moving",
    `playhead ${defHead.toFixed(6)} after ${def.drivenMs.toFixed(1)} ms of driven clock in a ${Math.round(totalMs)}ms pass` +
      ` · head before play ${def.head0.toFixed(6)} · playing at the sample: ${def.playing}` +
      (sampleMoved(def) ? "" : " — THE PLAYHEAD DID NOT MOVE while playing, so no clock was read in motion") +
      (def.moved ? " (read on the frame after a driven step, not a wall-clock sleep)" : " (the driven clock never moved the playhead)") +
      (defHead >= 0.8
        ? "; AT OR PAST THE END. The driven clock was stepped 40% of the pass and the playhead reads past 0.8, so the " +
          "transport ran on something other than the clock it reads, or ran faster than 1x."
        : defHead <= 0.2
          ? " — BARELY STARTED. The pass had hardly moved, so the identity above was read against a clock near its anchor."
          : ""),
  )
  say(await timingHead.textContent().then((t) => t.trim() === "Draw-in"), "…and the control says so — no state on the label")

  say(errors.length === 0, "no console or page errors across the whole run", errors.length ? errors[0] : "0")
  await browser.close()
  console.log(
    fails === 0 ? `\nALL ${checks} DRAW-IN TIMING ASSERTIONS PASS` : `\n${fails} of ${checks} DRAW-IN TIMING ASSERTIONS FAILED`,
  )
  process.exit(fails === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

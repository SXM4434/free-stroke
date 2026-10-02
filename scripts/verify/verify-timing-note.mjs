// NATURAL vs AUTHENTIC — does the panel tell the truth about itself?
//
// The note under the timing toggle claims two things:
//   1. the two settings differ only by how far the recorded pen speed departs
//      from constant, and
//   2. for THESE strokes the departure is X%.
//
// So this script does not just screenshot the note. It reads the note out of
// the REAL DOM (not a harness mirror), then renders the draw-in twice — once on
// Natural, once on Authentic — and measures whether the frames actually differ.
// If the note says "both settings render the same reveal" the frames must be
// identical; if it says they differ, the frames must differ. A note that
// disagreed with the renderer would be worse than no note.
//
// Three inputs, so BOTH branches of the note get tested:
//   constSpeed — points laid out at equal ARC LENGTH with a fixed ms per point,
//                i.e. genuinely constant pen speed. The note must say the two
//                settings render the same reveal, and the frames must agree.
//   fontLike   — injected with a fixed ms per point, exactly how the letter font
//                and the capture scripts stamp strokes
//   handDrawn  — drawn through the actual canvas with real pointer events at
//                varying speed, including a dwell
//
// HOW THE TOGGLE IS DRIVEN, and why it is not a detail.
// A previous revision flipped the setting with `page.click("text=Natural")`
// while DEV capture mode was on. That was wrong twice over: the string matches
// the note's own prose as well as the button, and capture mode resizes the
// viewport to a fixed 1920x1080 target which pushes the Authentic button past
// the right edge of a 1600px window, where Playwright can never click it. The
// script therefore rendered Natural twice, measured a frame difference of
// exactly 0.000, and would have "proved" the note wrong. Now: the mode is
// switched by a real mouse click on the real button with capture mode OFF (so
// the control is on screen), and the button's own pressed state is READ BACK
// and asserted before a single frame is captured.
//
// Usage: node scripts/verify/verify-timing-note.mjs
// Output: docs/verification/timing-note/
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "timing-note")

const REVEAL_FRAMES = 16
/**
 * Mean per-pixel difference (0-255) below which two reveals are the same
 * picture. Antialiasing on an identical mesh lands around 0.02; a one-ring
 * difference in where the tube is cut lands two orders of magnitude above it.
 */
const FRAME_DIFF_EPS = 0.1
/** Cases whose note disagreed with the frames. Non-empty means exit 1. */
const failures = []

async function meanDiff(a, b) {
  const px = async (f) => {
    const img = await loadImage(f)
    const c = createCanvas(img.width, img.height)
    c.getContext("2d").drawImage(img, 0, 0)
    return c.getContext("2d").getImageData(0, 0, img.width, img.height).data
  }
  const A = await px(a)
  const B = await px(b)
  let sum = 0
  let n = 0
  for (let i = 0; i < A.length; i += 4) {
    if (A[i + 3] < 20 && B[i + 3] < 20) continue
    sum += (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3
    n++
  }
  return n ? sum / n : 0
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, {
    timeout: 30000,
  })

  const report = {}

  const readNote = async () => {
    const el = await page.$('[data-testid="timing-note"]')
    if (!el) return null
    return (await el.innerText()).replace(/\s+/g, " ").trim()
  }

  // Screenshot the REAL control panel out of the page (not the WebGL capture
  // target) so what is proven is what a person sees.
  //
  // Capture mode has to be OFF and settled first: it swaps the viewport for a
  // fixed 1920x1080 render target, which makes the control bar wider than the
  // window and silently truncates the note out of the right-hand side of the
  // shot. The clip is also clamped to the window, because Playwright drops a
  // clip that runs past the viewport rather than shrinking it.
  //
  // Since L3 the note sits at the foot of the dock's Timeline panel, which
  // spans the window under both panels and loads folded, so the dock is
  // opened on its Timeline tab first (a folded dock hides the note). The
  // panel is as wide as the window by design now, so the crop test is on the
  // NOTE, the evidence itself: it must sit wholly inside the window.
  // MUST-FAIL ARM: TIMING_NOTE_MUTATE=noopen skips the open; the visibility
  // check has to throw.
  const shotPanel = async (name) => {
    await page.evaluate(() => window.__captureHarness.disable())
    if (process.env.TIMING_NOTE_MUTATE !== "noopen") await page.evaluate(() => window.__dockHarness?.dock.open("timeline"))
    await page.waitForTimeout(600)
    const note = await page.$('[data-testid="timing-note"]')
    if (!note) throw new Error("timing note is not in the DOM")
    if (!(await note.isVisible())) throw new Error("timing note is in the DOM but not visible: the dock did not open")
    const panel = await note.evaluateHandle((n) => n.parentElement)
    const box = await panel.asElement().boundingBox()
    const noteBox = await note.boundingBox()
    const view = page.viewportSize()
    const x = Math.max(0, box.x - 4)
    const y = Math.max(0, box.y - 4)
    await page.screenshot({
      path: join(OUT, `${name}_panel.png`),
      clip: {
        x,
        y,
        width: Math.min(box.width + 8, view.width - x),
        height: Math.min(box.height + 8, view.height - y),
      },
    })
    if (noteBox.x < 0 || noteBox.x + noteBox.width > view.width || noteBox.y < 0 || noteBox.y + noteBox.height > view.height) {
      throw new Error(
        `the note runs outside the window (${Math.round(noteBox.width)}x${Math.round(noteBox.height)} at ${Math.round(noteBox.x)},${Math.round(noteBox.y)}, window ${view.width}x${view.height}): it would be cropped out of the evidence`,
      )
    }
  }

  /** Read every reveal-mode button and whether it is the pressed one. */
  const modeButtons = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .filter((b) => ["Natural", "Authentic", "Smooth"].includes(b.textContent.trim()))
        .map((b) => ({
          label: b.textContent.trim(),
          active: b.className.includes("bg-foreground"),
        })),
    )

  /**
   * Switch the reveal mode by clicking the REAL button with a real mouse, then
   * confirm the UI actually moved. Capture mode must be off: it re-lays the page
   * around a fixed 1920x1080 render target and the toggle leaves the viewport.
   */
  const setMode = async (mode) => {
    await page.evaluate(() => window.__captureHarness.disable())
    await page.waitForTimeout(250)
    await page
      .getByRole("button", { name: mode, exact: true })
      .first()
      .click({ timeout: 10000 })
    await page.waitForTimeout(400)
    const btns = await modeButtons()
    const on = btns.find((b) => b.label === mode)
    if (!on || !on.active) {
      throw new Error(
        `reveal mode did not switch to ${mode} — buttons read ${JSON.stringify(btns)}`,
      )
    }
    return btns
  }

  // Render the draw-in at REVEAL_FRAMES steps in one reveal mode.
  const revealSeries = async (tag, mode) => {
    report[`${tag}_buttons_${mode}`] = await setMode(mode)
    await page.evaluate(() => window.__captureHarness.enable())
    await page.waitForTimeout(300)
    await page.evaluate(() => window.__captureHarness.frontView(1.0))
    await page.waitForTimeout(300)
    const files = []
    for (let i = 0; i <= REVEAL_FRAMES; i++) {
      const p = i / REVEAL_FRAMES
      await page.evaluate((v) => window.__revealHarness.setProgress(v), p)
      await page.waitForTimeout(220)
      const url = await page.evaluate(() => window.__captureHarness.grab())
      const m = (url || "").match(/base64,(.+)/)
      if (!m) throw new Error("grab failed")
      const f = join(OUT, `${tag}_${mode.toLowerCase()}_${String(i).padStart(2, "0")}.png`)
      writeFileSync(f, Buffer.from(m[1], "base64"))
      files.push(f)
    }
    return files
  }

  /**
   * Reload before every case. DEV capture mode takes the viewport out of the
   * flow (position: fixed, 1920x1080) and turning it off does not put the
   * control bar back at its laid-out width in the same tick, so a panel shot
   * taken after an earlier case's capture run comes back cropped. A fresh
   * document is the honest way to photograph the panel as a user sees it, and
   * it also makes the three cases independent of each other.
   */
  const freshPage = async () => {
    await page.goto(LAB_URL, { waitUntil: "networkidle" })
    await page.waitForFunction(
      () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
      null,
      { timeout: 30000 },
    )
    await page.waitForTimeout(400)
  }

  const runCase = async (tag) => {
    await page.evaluate(() => window.__styleHarness.setMode("rod"))
    await page.waitForTimeout(600)
    const note = await readNote()
    await shotPanel(tag)

    const natural = await revealSeries(tag, "Natural")
    const authentic = await revealSeries(tag, "Authentic")
    let worst = 0
    const perFrame = []
    for (let i = 0; i < natural.length; i++) {
      const d = await meanDiff(natural[i], authentic[i])
      perFrame.push(Number(d.toFixed(3)))
      if (d > worst) worst = d
    }
    await page.evaluate(() => window.__captureHarness.disable())
    await page.waitForTimeout(300)

    // The judgement. The note makes a falsifiable claim in prose; this turns it
    // into a pass/fail against the frames the renderer actually produced.
    const claimsSame = /render the same reveal/.test(note || "")
    const claimsDiffer = /so the two settings differ/.test(note || "")
    const framesDiffer = worst >= FRAME_DIFF_EPS
    const verdict =
      claimsSame && !framesDiffer
        ? "AGREE (note says same, frames same)"
        : claimsDiffer && framesDiffer
          ? "AGREE (note says differ, frames differ)"
          : `DISAGREE — note ${claimsSame ? "says SAME" : claimsDiffer ? "says DIFFER" : "makes no claim"} but frames ${framesDiffer ? "DIFFER" : "are identical"}`

    report[tag] = {
      note,
      worstFrameDiff: Number(worst.toFixed(3)),
      framesDiffer,
      verdict,
      perFrame,
    }
    if (verdict.startsWith("DISAGREE")) failures.push(`${tag}: ${verdict}`)
    console.log(
      `\n[timing] ${tag}\n  note: ${note}\n  worst Natural-vs-Authentic frame diff: ${worst.toFixed(3)}\n  ${verdict}`,
    )
  }

  // ---- Case 0: genuinely constant pen speed -------------------------------
  await freshPage()
  // Points at equal ARC LENGTH with a fixed ms per point. This is the case the
  // control was accused of being broken in: there is nothing in the input for
  // the toggle to express, and the note has to say so.
  await page.evaluate(() => {
    const dense = []
    for (let i = 0; i <= 4000; i++) {
      const t = i / 4000
      dense.push({ x: 120 + t * 620, y: 360 + Math.sin(t * Math.PI * 2.2) * 130 })
    }
    let total = 0
    const cum = [0]
    for (let i = 1; i < dense.length; i++) {
      total += Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y)
      cum.push(total)
    }
    const N = 120
    const poly = []
    let k = 0
    for (let j = 0; j <= N; j++) {
      const target = (total * j) / N
      while (k < cum.length - 2 && cum[k + 1] < target) k++
      const span = cum[k + 1] - cum[k]
      const a = span > 0 ? (target - cum[k]) / span : 0
      poly.push({
        x: dense[k].x + (dense[k + 1].x - dense[k].x) * a,
        y: dense[k].y + (dense[k + 1].y - dense[k].y) * a,
      })
    }
    window.__styleHarness.injectStrokes([poly], { msPerPoint: 12 })
  })
  await page.waitForTimeout(1000)
  await runCase("constSpeed")

  // ---- Case 1: font-like injection, fixed ms per point --------------------
  await freshPage()
  await page.evaluate(() => {
    const poly = []
    for (let i = 0; i <= 120; i++) {
      const t = i / 120
      poly.push({ x: 120 + t * 620, y: 360 + Math.sin(t * Math.PI * 2.2) * 130 })
    }
    window.__styleHarness.injectStrokes([poly], { msPerPoint: 12 })
  })
  await page.waitForTimeout(1000)
  await runCase("fontLike")

  // ---- Case 2: drawn through the real canvas at varying speed -------------
  await freshPage()
  const cbox = await page.evaluate(() => {
    const c = document.querySelector("canvas")
    const r = c.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  {
    const y0 = cbox.y + cbox.h * 0.45
    const x0 = cbox.x + cbox.w * 0.12
    const span = cbox.w * 0.76
    await page.mouse.move(x0, y0)
    await page.mouse.down()
    for (let i = 1; i <= 60; i++) {
      const t = i / 60
      const x = x0 + span * t
      const y = y0 + Math.sin(t * Math.PI * 2.0) * cbox.h * 0.16
      await page.mouse.move(x, y)
      // Fast through the first third, a DWELL in the middle, fast out again —
      // the shape of an actual hand-drawn stroke.
      if (t > 0.42 && t < 0.58) await page.waitForTimeout(90)
      else await page.waitForTimeout(6)
    }
    await page.mouse.up()
  }
  await page.waitForTimeout(1200)
  await runCase("handDrawn")

  writeFileSync(join(OUT, "report.json"), JSON.stringify({ ...report, errors, failures }, null, 2))
  console.log(`\n[timing] console errors: ${errors.length}`)
  await browser.close()
  if (failures.length) {
    console.error(`\n[timing] FAIL — the note disagrees with the renderer:\n  ${failures.join("\n  ")}`)
    process.exit(1)
  }
  console.log("[timing] PASS — every note matched what the renderer produced.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

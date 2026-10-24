// DOES A SHINE BAND SURVIVE SWITCHING AWAY FROM A BAND-DRIVING FUSION?
//
// The claim under test is written into lib/style-fusion.ts:768-778: viewport-3d
// applies the band inside `if (fz.sweep)` and on the else branch restores only
// the sweep's DIRECTION, so `uFsSweepAmt` keeps whatever the last band-driving
// frame left in it. That comment is the reason a custom fusion emits its
// shineBand link at amount 0 rather than skipping it.
//
// ── THE FIRST VERSION OF THIS PROBE WAS UNCONTROLLED, AND IT LIED BY 8x. ────
// It compared `terminalGel` reached fresh against `terminalGel` reached from
// `asciiRubber` with `motionMode: "independent"`, and read median luma 21.8 vs
// 174.8 — which looked like a parked band and is not. Terminal Gel BREATHES: its
// own oscillator is a function of `clock.elapsed`, so two reads taken at two
// wall-clock moments are two phases of one animation and the difference says
// nothing about state carried over. `motionMode: "off"` freezes every fusion
// choreography (viewport-3d.tsx:1664-1672), which is what makes the two arms
// comparable at all.
//
// Usage: node scripts/verify/_probe-sweep-stale.mjs
import { chromium } from "./lib/browser.mjs"
// DISPATCH §3 — one knob, one name. `FS_URL` was a FOURTH name for the knob that
// lib/dev-server.mjs had never heard of, so it was neither honoured nor thrown on.
// It now throws, and this probe reads the resolver instead. Explainer 27 §1.
import { LAB_URL } from "./lib/dev-server.mjs"

const URL = LAB_URL

const WORD = [
  [
    { x: 220, y: 300 }, { x: 280, y: 220 }, { x: 340, y: 300 },
    { x: 400, y: 220 }, { x: 460, y: 300 },
  ],
  [
    { x: 240, y: 380 }, { x: 320, y: 360 }, { x: 400, y: 380 }, { x: 470, y: 350 },
  ],
]

const settle = (page, ms) => page.evaluate((m) => new Promise((r) => setTimeout(r, m)), ms)

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message))
  await page.goto(URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => !!window.__styleHarness, { timeout: 30000 })
  await page.evaluate((w) => window.__styleHarness.injectStrokes(w), WORD)
  await settle(page, 1500)

  const arm = async (preset) => {
    await page.evaluate((p) => {
      window.__styleHarness.setStyle({
        fusionPreset: p,
        fusionEnabled: p !== "none",
        asciiEnabled: true,
        // FROZEN. Every number below is then a property of the STATE, not of
        // when the screenshot happened to be taken.
        motionMode: "off",
      })
    }, preset)
    await settle(page, 700)
  }

  const read = () =>
    page.evaluate(() => {
      // THE LAST canvas, not the first: `/` mounts the 2-D drawing canvas
      // before the WebGL viewport, and reading the first one measured the
      // drawing surface — 1780 near-black pixels that could never have moved.
      const all = [...document.querySelectorAll("canvas")]
      const c = all[all.length - 1]
      if (!c) return null
      const g = document.createElement("canvas")
      g.width = c.width
      g.height = c.height
      const ctx = g.getContext("2d")
      ctx.drawImage(c, 0, 0)
      const px = ctx.getImageData(0, 0, g.width, g.height)
      const d = px.data
      const lum = []
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 8) continue
        lum.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])
      }
      const sorted = [...lum].sort((a, b) => a - b)
      const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)
      return {
        n: lum.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p99: mean(sorted.slice(Math.floor(sorted.length * 0.99))),
        sig: c.toDataURL("image/png"),
      }
    })

  const runs = []
  // Interleaved so that any residual drift in the page is shared by both arms
  // rather than assigned to one of them.
  for (let i = 0; i < 2; i++) {
    await arm("none")
    await arm("terminalGel")
    const fresh = await read()

    await arm("none")
    await arm("asciiRubber")
    const banded = await read()
    await arm("terminalGel")
    const after = await read()

    const same = fresh.sig === after.sig
    runs.push({ fresh, banded, after, same })
    console.log(
      `run ${i}  fresh median ${fresh.median.toFixed(2)} p99 ${fresh.p99.toFixed(1)} | ` +
        `banded ${banded.median.toFixed(2)} | after ${after.median.toFixed(2)} p99 ${after.p99.toFixed(1)} | ` +
        `identical: ${same}`,
    )
  }

  const bad = runs.filter((r) => !r.same).length
  console.log(
    bad === 0
      ? "\nNO STALE BAND: terminalGel reached from asciiRubber is byte-identical to terminalGel reached fresh."
      : `\nSTALE STATE: ${bad}/${runs.length} runs differ — reaching terminalGel from a band-driving fusion does not render the same picture.`,
  )

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

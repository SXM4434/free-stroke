/**
 * ASSERT: THE CAMERA FRAMES THE DRAWING WITHOUT BEING ASKED.
 *
 * WHY THIS EXISTS, and it was found by looking rather than by measuring.
 * On 2026-09-04 the draw-in was filmed at 24 frames across the beat and the
 * contact sheet read like this: the first stroke drew over the opening second,
 * and the remaining three seconds were a STATIC first stroke while the rest of
 * the mark drew off-screen to the right. Eighteen of twenty-four frames were
 * the same picture. One click of "Reset camera" before pressing play fixed it
 * completely, on the same code and the same settings, which is what proved the
 * camera could always frame the mark and that nothing ever asked it to.
 *
 * ⚠ THE BAR IS THE PICTURE, NOT THE CALL. A gate that asserted "orbitView was
 * called" would pass while the mark sat outside the frame. This measures INK
 * IN THE VIEWPORT, so it fails for any reason the picture is wrong, including
 * reasons nobody has thought of yet.
 */
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import sharp from "sharp"
import { writeFileSync } from "fs"

let pass = 0, fail = 0
const say = (ok, what, detail) => {
  if (ok) { pass++; console.log(`PASS  ${what} — ${detail}`) }
  else { fail++; console.log(`FAIL  ${what} — ${detail}`) }
}

const b = await chromium.launch()
const page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
const errs = []
page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)))
await page.goto(LAB_URL, { waitUntil: "domcontentloaded" })

/* ⚠ WAIT FOR THE ENGINE, DO NOT SLEEP AND HOPE. An earlier version of this
 * gate slept 9 seconds and then measured. Its screenshot was the words
 * "Starting the 3D engine / One moment", and every number it produced was that
 * text: 460 ink px, span 0.205. It reported a confident FAIL about a camera
 * that had not been asked to frame anything yet. The readiness test is the
 * harness the rest of this gate drives, plus the absence of the placeholder. */
const ready = async () => {
  for (let i = 0; i < 60; i++) {
    const ok = await page.evaluate(() =>
      typeof window.__revealHarness?.setProgress === "function" &&
      !document.body.innerText.includes("Starting the 3D engine"))
    if (ok) return i
    await page.waitForTimeout(1000)
  }
  return null
}
const waited = await ready()
say(waited !== null, "the 3D engine started before anything was measured",
  waited === null ? "still on the placeholder after 60s" : `ready after ~${waited}s`)
if (waited === null) { await b.close(); console.log("\nREFUSED: nothing below can be judged"); process.exit(1) }

/* THREE MARKS SPREAD ACROSS THE PAGE. One squiggle would fit any framing and
 * would pass this gate while the defect was live. The spread IS the subject.
 * The 2D drawing panel is the FIRST canvas; the 3D viewport found above is the
 * second. Filming the wrong one produced 24 identical static frames once. */
const box = await (await page.$("canvas")).boundingBox()
const strokes = [
  [[0.18, 0.55], [0.20, 0.38], [0.24, 0.55], [0.26, 0.38]],
  [[0.34, 0.40], [0.34, 0.58], [0.40, 0.58], [0.40, 0.40], [0.34, 0.40]],
  [[0.48, 0.36], [0.50, 0.60], [0.56, 0.44], [0.62, 0.60], [0.64, 0.36]],
]
for (const pts of strokes) {
  await page.mouse.move(box.x + box.width * pts[0][0], box.y + box.height * pts[0][1])
  await page.mouse.down()
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
    for (let t = 1; t <= 14; t++) {
      await page.mouse.move(box.x + box.width * (x0 + (x1 - x0) * t / 14), box.y + box.height * (y0 + (y1 - y0) * t / 14))
    }
  }
  await page.mouse.up()
  await page.waitForTimeout(700)
}
await page.waitForTimeout(3000)

/* The 3D viewport, not the 2D drawing panel. Filming the wrong canvas is how
 * the first pass at this produced 24 identical static frames and no finding. */
const cs = await page.$$("canvas")
let vp = null, best = -1
for (const el of cs) {
  const bb = await el.boundingBox()
  if (bb && bb.x > 400 && bb.width * bb.height > best) { best = bb.width * bb.height; vp = el }
}
const cb = await vp.boundingBox()
/* ⚠ CROP ABOVE THE TRANSPORT. The canvas bounding box includes the transport
 * bar and its caption, which are overlaid ON the canvas, and that text is dark
 * and spans the full width. Measured before this crop existed: the horizontal
 * span read 0.927038626609442 at the baseline, after "Top", and after a drag
 * orbit — IDENTICAL to fifteen decimal places across three different camera
 * positions, while the ink count moved 22,479 to 24,668 to 17,074. A number
 * that cannot move is not measuring the subject. */
const barTop = await page.evaluate(() => {
  /* The Timing button's immediate parent is an inner row and sits ~70px below
   * the strip's real top, which left the caption and the group bars inside the
   * measured region. Anchored on the caption itself instead. */
  const cap = [...document.querySelectorAll("*")].find(
    (e) => e.children.length === 0 && e.textContent.trim() === "When each group draws")
  const el = cap?.closest("div")?.parentElement ?? cap?.parentElement
  return el ? el.getBoundingClientRect().top : null
})
/* THE MEASURED REGION IS THE VISIBLE VIEWPORT: canvas top down to where the
 * transport strip covers it. The transport is an OVERLAY, so ink underneath it
 * is hidden from the user and counts as clipped.
 * ⚠ Cutting 20px above the strip instead read 0.998 and called the mark
 * clipped, when its lowest ink sat 21px clear of the strip and the crop line
 * was the thing it was touching. 3px clears the border and nothing else. */
const bottom = barTop !== null ? Math.min(cb.y + cb.height, barTop - 3) : cb.y + cb.height * 0.82
const clip = {
  x: Math.round(cb.x), y: Math.round(cb.y),
  width: Math.round(cb.width), height: Math.round(bottom - cb.y),
}
say(clip.height > 200, "the measured region excludes the transport overlay",
  `canvas ${Math.round(cb.height)}px tall, measuring the top ${clip.height}px, transport at ${barTop === null ? "not found, fell back to 82%" : Math.round(barTop)}`)

/** Ink bbox and coverage inside the viewport, as fractions of the canvas. */
const inkBox = async (tag) => {
  const f = `/tmp/gate-cam-${tag}.png`
  await page.screenshot({ path: f, clip })
  const { data, info } = await sharp(f).greyscale().raw().toBuffer({ resolveWithObject: true })
  let minX = info.width, maxX = -1, minY = info.height, maxY = -1, n = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] < 170) {
        n++
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }
  }
  if (n === 0) return { n: 0 }
  return { n, w: info.width, h: info.height,
    l: minX / info.width, r: maxX / info.width, t: minY / info.height, bo: maxY / info.height,
    frac: n / (info.width * info.height) }
}

await ready()


await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.waitForTimeout(2500)
const m = await inkBox("framed")

say(m.n > 0, "the finished mark renders at all", `${m.n} ink px`)

/* CLIPPING. Ink touching an edge is the exact defect: the mark drew off-screen.
 * A 1.5 percent margin, so a stroke that legitimately reaches near the edge is
 * not called clipped. */
const MARGIN = 0.015
say(m.l > MARGIN && m.r < 1 - MARGIN && m.t > MARGIN && m.bo < 1 - MARGIN,
  "no ink is clipped by the viewport edge",
  `left ${m.l.toFixed(3)} right ${m.r.toFixed(3)} top ${m.t.toFixed(3)} bottom ${m.bo.toFixed(3)}, margin ${MARGIN}`)

/* FILLS THE FRAME. The other half of the bug: a camera so far out that the
 * mark is a speck is also unframed, and would pass a clipping test. */
const spanX = m.r - m.l, spanY = m.bo - m.t
say(Math.max(spanX, spanY) > 0.35,
  "the mark actually fills the frame, rather than sitting in it as a speck",
  `widest span ${Math.max(spanX, spanY).toFixed(3)} of the canvas, floor 0.35`)

/* CONTROL 1 — THE FRAME TRACKS GROWTH. A fourth mark, far right of everything
 * already drawn. If nothing frames the drawing, it lands outside and the right
 * edge pins at 1.0, which is precisely the reported defect. This is the
 * mechanism under test, driven with the only input a user has.
 *
 * ⚠ Two earlier controls were thrown out rather than reported: `window.__fsViewportApi`
 * does not exist, and Playwright's synthetic wheel moved the camera by 0.000
 * across fourteen scrolls. A control that cannot move the subject is not a control. */
await page.mouse.move(box.x + box.width * 0.86, box.y + box.height * 0.30)
await page.mouse.down()
for (let t = 1; t <= 14; t++) await page.mouse.move(box.x + box.width * (0.86 + 0.06 * t / 14), box.y + box.height * (0.30 + 0.22 * t / 14))
await page.mouse.up()
await page.waitForTimeout(4000)
await ready()
await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.waitForTimeout(2000)
const grown = await inkBox("grown")
say(grown.n > 0 && grown.r < 1 - MARGIN && grown.l > MARGIN,
  "CONTROL — a mark drawn far outside the current frame is framed too",
  grown.n === 0 ? "nothing rendered" : `right edge ${grown.r.toFixed(3)} against the ${(1 - MARGIN).toFixed(3)} ceiling, ink ${grown.n} px`)

/* CONTROL 2 — THE INK READER CAN READ ABSENCE. Without this, every ink count
 * above is a number nobody has proven can reach zero. */
await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Clear")?.click())
await page.waitForTimeout(3500)
const cleared = await inkBox("cleared")
/* The bar is that the reader can TELL THE TWO APART and that Clear really does
 * return to the empty state, both measured against the reading taken before a
 * single stroke existed. */
/* Clear does not return the canvas to nothing, it returns it to the app's own
 * invitation, which draws ink of its own. So the bar is SEPARATION, stated as a
 * multiple rather than as a percentage: a percentage ceiling moves with how big
 * the mark happens to be, and an earlier 5 percent version went red at fillK
 * 1.7 for no reason except a smaller mark.
 * ⚠ The empty state cannot be read BEFORE the strokes, because the crop is
 * anchored on the transport and the transport does not exist until something
 * has been drawn. Measured after Clear instead, which is the same picture. */
say(m.n > cleared.n * 4,
  "CONTROL — the ink reader separates the mark from an empty canvas",
  `${m.n} px with the mark against ${cleared.n} px after Clear, ${(m.n / Math.max(1, cleared.n)).toFixed(1)}x, floor 4x`)

say(errs.length === 0, "no uncaught page errors during the run", errs.length ? errs.slice(0, 2).join(" | ") : "clean")

await b.close()
console.log(`\n${fail === 0 ? `ALL ${pass} CAMERA-FRAMING ASSERTIONS PASS (control included)` : `${fail} of ${pass + fail} CAMERA-FRAMING ASSERTIONS FAILED`}`)
process.exit(fail === 0 ? 0 : 1)

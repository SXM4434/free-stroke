// ANIM-1C3 step 3 probe: can a real drawing put ink past innerWidth / 2?
// Draw two strokes with the mouse at 1440x900 (A left, B near the panel's right
// edge), shrink the window to 1000x900, then read Solid and Extrude's meshes.
// Extrude builds from the points and is the control. Solid built B when its
// mesh spans as wide as Extrude's; when it drops B its span is A's alone.
//   FS_PORT=3139 node scripts/verify/_probe-solid-exposure.mjs <repo root>   (ANIM-1C4 copied it in from the ANIM-1C3 scratchpad)
const ROOT = process.argv[2]
const { chromium } = await import(ROOT + "/scripts/verify/lib/browser.mjs")
const { LAB_URL } = await import(ROOT + "/scripts/verify/lib/dev-server.mjs")
const browser = await chromium.launch()
const out = {}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 180000 })
  await page.waitForTimeout(2000)
  const cv = page.locator('canvas[aria-label^="Drawing canvas"]')
  const r = await cv.boundingBox()
  out.panel = { left: r.x, width: r.width, height: r.height, innerWidth: 1440, half: 720 }
  const draw = async (x0, x1, y) => {
    await page.mouse.move(r.x + x0, r.y + y)
    await page.mouse.down()
    for (let i = 1; i <= 30; i++) await page.mouse.move(r.x + x0 + ((x1 - x0) * i) / 30, r.y + y + Math.sin(i / 5) * 40)
    await page.mouse.up()
    await page.waitForTimeout(300)
  }
  const A = [0.15 * r.width, 0.35 * r.width], B = [0.8 * r.width, 0.97 * r.width]
  await draw(A[0], A[1], r.height * 0.5)
  await draw(B[0], B[1], r.height * 0.5)
  out.strokesPx = { A, B }
  const span = async (mode) => {
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(3000)
    return page.evaluate(() => {
      const d = window.__geomDebug.dumpMeshes()
      if (!d || !d.pos.length) return { meshes: d ? d.meshes : null, verts: 0, span: 0 }
      let lo = Infinity, hi = -Infinity
      for (let i = 0; i < d.pos.length; i += 3) { lo = Math.min(lo, d.pos[i]); hi = Math.max(hi, d.pos[i]) }
      return { meshes: d.meshes, verts: d.pos.length / 3, xmin: +lo.toFixed(3), xmax: +hi.toFixed(3), span: +(hi - lo).toFixed(3) }
    })
  }
  out.wide = { solid: await span("solid"), extrude: await span("extrude") }
  await page.setViewportSize({ width: 1000, height: 900 })
  await page.waitForTimeout(2500)
  out.narrowHalf = await page.evaluate(() => window.innerWidth / 2)
  out.narrow = { solid: await span("solid"), extrude: await span("extrude") }
  for (const k of ["wide", "narrow"]) {
    const s = out[k].solid.span, e = out[k].extrude.span
    out[k].solidOverExtrude = e ? +(s / e).toFixed(3) : null
    out[k].bBuiltOnSolid = e ? s / e > 0.8 : null
  }
  out.inkPastHalfAfterShrink = B[1] > out.narrowHalf
} finally {
  await browser.close()
}
console.log(JSON.stringify(out, null, 1))

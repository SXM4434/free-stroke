// IS `nibAspect` A DRIVEABLE DIAL, AND WHAT PROVES IT REACHED THE GEOMETRY?
//
// F59 / F61 left an opening: the honest repair for `assert-elbow`'s ROUTE-5/6
// and `assert-mode-rims`' inflate rows needs a KNOWN-BAD BUILT UNDER THE NIB,
// and `syntheticElbow` builds at aspect 1. `nibAspect` is a real `InflateParams`
// field, so if a capture can drive it and PROVE the drive landed, those gates
// can carry a round-pen arm of their own instead of staying red against a
// yardstick that assumes an isotropic pen.
//
// ── 🔴 THE READBACK THAT LOOKS LIKE PROOF AND IS NOT ───────────────────────
// This probe was started as `setInflate({ nibAspect }) -> debug().nibAspect`,
// and that pair CANNOT fail. `lib/geometry-engines.ts` sets
// `INFLATE_DEBUG.nibAspect = build.nib.aspect`, and `build.nib` is
// `inflateResolveNib(params)` — the RESOLVED DIAL. The file says so itself,
// four lines above the field:
//
//   "REQUESTED and PRODUCED are separate rows on purpose. `nibAspect` is the
//    dial; `nibContrastBuilt` is max/min half-width over this drawing's own
//    arc-length-weighted direction census, so a nib that was asked for and did
//    not reach the geometry reads as 1.000 here instead of as its dial."
//
// So `debug().nibAspect` echoes the number you just sent. A driver validated on
// it reports success for a nib that never touched a vertex. The PRODUCED value
// is `nibContrastBuilt`, and this probe reads both and prints them side by side.
//
// ── AND THE FIXTURE IS HALF THE INSTRUMENT ────────────────────────────────
// `nibContrastBuilt` is max/min half-width over the DIRECTIONS THIS DRAWING
// TRAVELS IN. A straight line travels in one direction, so it has one
// half-width and the census reads 1.000 at every aspect — correctly. Probe an
// elliptical pen with a straight line and the honest answer is "this drawing
// cannot tell". That is arm B below, and it is this file's must-fail: the dial
// reads 2.4 while the geometry census reads ~1.0, on the same page, in the same
// run, with nothing broken.
//
// Usage: FS_PORT=<port> FS_HEADED=0 node scripts/verify/_probe-elbow-nib.mjs
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"

const ASPECTS = [1.0, 1.4, 1.8, 2.4]

/** A CIRCLE: every direction, arc-length weighted, which is the census's own
 *  domain. `assert-elbow`'s square is the shape under test elsewhere; here the
 *  question is only whether the dial reaches the mesh, and a circle answers it
 *  without a corner in the way. */
const circle = () => {
  const pts = []
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * Math.PI * 2
    pts.push({ x: 360 + Math.cos(t) * 190, y: 330 + Math.sin(t) * 190 })
  }
  return [pts]
}
/** ONE DIRECTION. The control that shows the readback needs a fixture. */
const line = () => {
  const pts = []
  for (let i = 0; i <= 90; i++) pts.push({ x: 200 + (i / 90) * 300, y: 250 })
  return [pts]
}

const browser = await chromium.launch({ headed: true, label: "elbow-nib" })
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)))
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(
  () => window.__styleHarness && window.__geomDebug && window.__inflateProbe,
  null, { timeout: 60000 })

let fails = 0
const pass = (m) => console.log("PASS  " + m)
const fail = (m) => { console.log("FAIL  " + m); fails++ }

async function arm(name, poly) {
  await page.evaluate(() => window.__styleHarness.clearStrokes())
  await page.waitForTimeout(400)
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), poly)
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__styleHarness.setMode("inflate"))
  await page.waitForTimeout(1800)
  const rows = []
  for (const a of ASPECTS) {
    await page.evaluate((v) => window.__styleHarness.setInflate({ nibAspect: v }), a)
    /* WAIT ON THE BUILD COUNTER, NOT ON A SLEEP. `buildCount` is the number of
     * geometry rebuilds; a fixed timeout that is one machine too short reads
     * the PREVIOUS mesh and attributes it to this dial. */
    const before = await page.evaluate(() => window.__geomDebug.buildCount())
    await page
      .waitForFunction((b) => window.__geomDebug.buildCount() > b, before, { timeout: 15000 })
      .catch(() => {})
    await page.waitForTimeout(900)
    const d = await page.evaluate(() => window.__inflateProbe.debug())
    const s = await page.evaluate(() => window.__geomDebug.stats())
    rows.push({
      asked: a,
      dial: d.nibAspect,
      builtContrast: +Number(d.nibContrastBuilt).toFixed(4),
      semiMajor: +Number(d.nibSemiMajor).toFixed(4),
      semiMinor: +Number(d.nibSemiMinor).toFixed(4),
      meanWidth: +Number(d.nibMeanWidth).toFixed(4),
      hairlineFrac: +Number(d.nibHairlineFrac).toFixed(4),
      verts: s?.vertices ?? null,
      tris: s?.triangles ?? null,
      bbox: s?.bbox ?? null,
    })
  }
  console.log(`\n--- ARM ${name} ---`)
  for (const r of rows) {
    console.log(
      `  asked ${String(r.asked).padEnd(4)} dial ${String(r.dial).padEnd(4)} ` +
        `builtContrast ${String(r.builtContrast).padEnd(7)} semi ${r.semiMajor}/${r.semiMinor} ` +
        `meanWidth ${String(r.meanWidth).padEnd(7)} hairline ${String(r.hairlineFrac).padEnd(7)} ` +
        `verts ${String(r.verts).padEnd(7)} bbox ${JSON.stringify(r.bbox)}`,
    )
  }
  return rows
}

const A = await arm("A · a CIRCLE, which travels in every direction", circle())
const B = await arm("B · a STRAIGHT LINE, which travels in one", line())

console.log("")
/* 1 · the dial is reachable at all. Necessary, and on its own worth nothing. */
if (A.every((r) => r.dial === r.asked)) {
  pass(`setInflate({ nibAspect }) reaches the resolver — dial echoed ${A.map((r) => r.dial).join(" / ")}`)
} else {
  fail(`setInflate({ nibAspect }) did NOT reach the resolver — ${JSON.stringify(A.map((r) => [r.asked, r.dial]))}`)
}
/* 2 · the dial reaches the GEOMETRY, read off the produced census. */
const a1 = A.find((r) => r.asked === 1.0)
const a24 = A.find((r) => r.asked === 2.4)
if (Math.abs(a1.builtContrast - 1) <= 0.02) {
  pass(`at aspect 1.0 the built census reads a MONOLINE — builtContrast ${a1.builtContrast}`)
} else {
  fail(`at aspect 1.0 the built census should read 1.000 and reads ${a1.builtContrast} — the census is not measuring the pen`)
}
const monotone = A.every((r, i) => i === 0 || r.builtContrast >= A[i - 1].builtContrast - 0.005)
if (monotone && a24.builtContrast > a1.builtContrast + 0.5) {
  pass(`the dial REACHES THE MESH — builtContrast climbs ${A.map((r) => `${r.asked}->${r.builtContrast}`).join(" ")}`)
} else {
  fail(`the built census does not track the dial — ${A.map((r) => `${r.asked}->${r.builtContrast}`).join(" ")}`)
}
/* 3 · a SECOND, independent channel moved. A census computed from the same
 *     params as the dial could still be an echo; the vertex count is not. */
const vertsMoved = new Set(A.map((r) => r.verts)).size > 1 || new Set(A.map((r) => JSON.stringify(r.bbox))).size > 1
if (vertsMoved) {
  pass(`a second channel moved with the dial — bbox ${A.map((r) => JSON.stringify(r.bbox)).join(" ")}`)
} else {
  fail(`neither the vertex count nor the bounding box moved across ${ASPECTS.join("/")} — the mesh may be the same mesh`)
}
/* 4 · THE MUST-FAIL. The dial reads 2.4 and the geometry census reads ~1.0 on
 *     a one-direction drawing. If this row ever passes, `debug().nibAspect` is
 *     being used as proof somewhere and it cannot be. */
const b24 = B.find((r) => r.asked === 2.4)
if (b24.dial === 2.4 && Math.abs(b24.builtContrast - 1) <= 0.05) {
  pass(
    `MUST-FAIL ARM · on a straight line the dial reads ${b24.dial} while the built census reads ` +
      `${b24.builtContrast} — so debug().nibAspect is an ECHO OF THE REQUEST and can never validate a drive`,
  )
} else {
  fail(
    `the straight-line arm did not separate request from production (dial ${b24.dial}, built ` +
      `${b24.builtContrast}) — this probe's whole claim rests on that separation`,
  )
}
if (errors.length) fail(`page errors: ${errors.slice(0, 3).join(" | ")}`)

console.log(
  `\nNOTE  debug().fieldBaseRadius reads 0 on this path and is not a measurement of anything here: ` +
    `geometry-engines.ts writes it only on the implicit-surface build and zeroes it otherwise.`,
)
console.log(`\n${fails ? `${fails} FAILED` : "ALL ASSERTIONS PASS"}`)
await browser.close()
process.exit(fails ? 1 : 0)

// Layering evidence: captures the SAME stroke with style systems switched on
// one at a time, so the composition can be judged rather than assumed.
//   1 none -> 2 texture -> 3 texture+dither -> 4 texture+dither+ascii
// This is the visual answer to the PRD's layering gate ("dither + ASCII +
// texture + material coexist without unreadable soup").
//
// Usage: node scripts/verify/verify-stack.mjs
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
// ...AND THE SAME DEFECT ON THE OUTPUT SIDE. This read
// an ABSOLUTE path naming the canonical checkout and its stack-v1 evidence dir. Re-pointing the URL alone would have
// left a tool that reads the right tree and files the frames in somebody else's,
// which is the more expensive half: `assert-stack.mjs` grades this directory, so
// a lane running this capture published its evidence into the shared checkout's
// stored set. `assert-one-knob` cannot see it — the defect is a PATH, not a URL.
// Derived here from the script's own location; in the canonical tree it resolves
// byte-identically to the string it replaces, so nothing that ran before moves.
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "verification", "stack-v1")
mkdirSync(OUT, { recursive: true })
const stroke = () => { const p=[]; for(let i=0;i<=120;i++){const t=i/120; p.push({x:120+t*620,y:330+Math.sin(t*Math.PI*2.2)*130+Math.sin(t*Math.PI*6)*22})} return [p] }
const b = await chromium.launch({ headed: true })
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } })
await page.goto(LAB_URL, { waitUntil: "networkidle" })

/* ── WHY THIS TOOL COULD NOT RUN, AND WHY ITS EVIDENCE WENT 24 DAYS STALE ──
 *
 * `assert-stack.mjs` grades docs/verification/stack-v1 and its PROVENANCE row
 * refuses to grade frames older than lib/. The row was right and the frames were
 * from 2026-08-04, so the gate was red with no way back. Running this tool to get
 * the way back found two defects in the tool itself, both measured 2026-08-28:
 *
 * 1. THE READINESS WAIT WAS SHORT ONE HARNESS. It waited on __styleHarness and
 *    __captureHarness, then called `__revealHarness.setProgress`. __revealHarness
 *    is installed by components/viewport-3d.tsx, which mounts AFTER the other two,
 *    so the call threw "Cannot read properties of undefined" and the run died at
 *    line 36 every time. verify-material-craft.mjs:142 and verify-screen-layers
 *    .mjs:295 already wait on all three; this file did not.
 *
 * 2. A FAST REFRESH KILLED IT MID-SWEEP. With the readiness wait fixed it reached
 *    4 of 22 captures and died on "Execution context was destroyed, most likely
 *    because of a navigation". This runs against a live dev server while other
 *    work lands in the tree; every save remounts the page and the harnesses
 *    vanish. verify-screen-layers.mjs:310 carries the shape that survives it, and
 *    the whole test bed is re-established rather than the run abandoned.
 *
 * THE STATE HAS TO COME BACK WITH IT. Re-establishing resets the style, so a
 * capture taken after a silent re-establish would be filed under a label whose
 * settings it does not have — a PNG that looks fine and means something else.
 * `capture()` below applies the style and grabs as one retryable unit, so the
 * frame on disk always matches the name on it. */
async function bootstrap() {
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
    null, { timeout: 60000 })
  await page.evaluate((p) => { window.__styleHarness.injectStrokes(p,{msPerPoint:12}); window.__captureHarness.enable() }, stroke())
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.evaluate(() => window.__styleHarness.setMode("solid"))
  await page.waitForTimeout(800)
  await page.evaluate(() => window.__captureHarness.frontView(1))
}
for (let attempt = 0; ; attempt++) {
  try { await bootstrap(); break }
  catch (e) { if (attempt >= 4) throw e; console.log("[stack] bootstrap retry", attempt + 1); await page.waitForTimeout(1500) }
}
/** true when the bed had to be rebuilt, so the caller knows its state is gone. */
async function ensureHarness() {
  const ok = await page
    .evaluate(() => !!(window.__styleHarness && window.__captureHarness && window.__revealHarness))
    .catch(() => false)
  if (ok) return false
  console.log("[stack] harness vanished (hot reload) — re-establishing")
  await bootstrap()
  return true
}
const grab = async (n) => { const u = await page.evaluate(()=>window.__captureHarness.grab()); writeFileSync(`${OUT}/${n}.png`, Buffer.from(u.match(/base64,(.+)/)[1],"base64")) }
const set = (p) => page.evaluate((x)=>window.__styleHarness.setStyle(x), p)
/** apply-then-grab as ONE unit, so a reload between the two cannot file a frame
 *  under a label whose settings it does not carry. */
async function capture(name, apply) {
  for (let attempt = 0; ; attempt++) {
    try {
      await ensureHarness()
      await apply()
      await grab(name)
      return
    } catch (e) {
      if (attempt >= 4) throw e
      console.log("[stack] capture retry", name, attempt + 1, String(e).split("\n")[0])
      await page.waitForTimeout(1500)
    }
  }
}
const OFF = { textureEnabled:false, ditherEnabled:false, asciiEnabled:false, textureAnimated:false, ditherAnimated:false, asciiAnimated:false }
const BASE = {
  textureEnabled: true, textureMode: "contour", textureScale: 1.2, textureIntensity: 0.6,
  textureContrast: 0.55, textureLockMode: "object",
  ditherEnabled: true, ditherType: "bayer4", ditherScale: 4, ditherLevels: 3,
  ditherIntensity: 0.8, ditherContrast: 0.55, ditherThreshold: 0.5, ditherLockMode: "screen",
  asciiEnabled: true, asciiCharset: "classic", asciiCellSize: 14, asciiDensity: 0.5,
  asciiContrast: 0.5, asciiLockMode: "screen",
}
const cases = [
  // --- progressive layering ---
  ["1_none", OFF],
  ["2_texture_only", {...OFF, ...BASE, ditherEnabled:false, asciiEnabled:false}],
  ["3_texture_dither", {...OFF, ...BASE, asciiEnabled:false}],
  ["4_all_three", {...OFF, ...BASE}],
  // --- ORDER: same layers, swapped post-lighting order ---
  ["5_order_ditherFirst", {...OFF, ...BASE, layerStackEnabled:true, stackOrder:"ditherFirst",
    stackTextureOpacity:0.5, stackDitherOpacity:0.9, stackAsciiOpacity:0.9}],
  ["6_order_asciiFirst", {...OFF, ...BASE, layerStackEnabled:true, stackOrder:"asciiFirst",
    stackTextureOpacity:0.5, stackDitherOpacity:0.9, stackAsciiOpacity:0.9}],
  // --- BLEND: same layers, different dither blend ---
  ["7_blend_normal", {...OFF, ...BASE, layerStackEnabled:true, stackDitherBlend:"normal",
    stackTextureOpacity:0.5, stackDitherOpacity:0.9, stackAsciiOpacity:0.6}],
  ["8_blend_multiply", {...OFF, ...BASE, layerStackEnabled:true, stackDitherBlend:"multiply",
    stackTextureOpacity:0.5, stackDitherOpacity:0.9, stackAsciiOpacity:0.6}],
  ["9_blend_screen", {...OFF, ...BASE, layerStackEnabled:true, stackDitherBlend:"screen",
    stackTextureOpacity:0.5, stackDitherOpacity:0.9, stackAsciiOpacity:0.6}],
  // --- OPACITY: stack dialing a layer down must visibly change it ---
  ["10_opacity_full", {...OFF, ...BASE, layerStackEnabled:true, stackAsciiOpacity:1,
    stackTextureOpacity:0.5, stackDitherOpacity:0.8}],
  ["11_opacity_low", {...OFF, ...BASE, layerStackEnabled:true, stackAsciiOpacity:0.15,
    stackTextureOpacity:0.5, stackDitherOpacity:0.8}],
]

for (const [n, p] of cases) {
  await capture(n, async () => { await set(p); await page.waitForTimeout(500) })
  console.log("captured", n)
}

// Stack PRESETS, applied through the real preset-selection path.
const PRESETS = [
  "cleanInkStack", "ditheredGelStack", "terminalStack", "graphicSlabStack", "softSignalStack",
  "newsprintStack", "woodcutStack", "porcelainPrintStack", "marqueeStack", "blueprintStack", "gildedStack",
]
for (const id of PRESETS) {
  await capture(`preset_${id}`, async () => {
    await set(OFF)
    await page.waitForTimeout(200)
    await page.evaluate((x) => window.__styleHarness.selectPreset("layerStack", x), id)
    await page.waitForTimeout(600)
  })
  console.log("captured preset", id)
}
await b.close()

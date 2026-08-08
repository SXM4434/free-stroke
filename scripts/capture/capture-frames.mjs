// Drives the running dev preview through the DEV harnesses to capture the
// transparent draw-in of the traced "Desk Doodles" logo strokes.
// Output: scripts/capture/frames/3d_0000.png ... 3d_full.png (1920x1080 alpha)
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { layoutWord } from "./letters.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRAMES = join(__dirname, "frames")
const STROKES = join(__dirname, "logo-strokes.json")

const DRAW_FRAMES = parseInt(process.env.DRAW_FRAMES || "60", 10)
const ROUGHNESS = parseFloat(process.env.ROUGHNESS || "0.35")
// STROKE_SOURCE=font (Variant B, clean hand font) | trace (Variant A, traced logo skeleton)
const STROKE_SOURCE = process.env.STROKE_SOURCE || "font"

function ab(args) {
  return execFileSync("agent-browser", args, { encoding: "utf8" }).trim()
}
function evalJS(js) {
  return ab(["eval", js])
}

function setup() {
  rmSync(FRAMES, { recursive: true, force: true })
  mkdirSync(FRAMES, { recursive: true })
}

function injectAndStyle() {
  const { polylines } = JSON.parse(readFileSync(STROKES, "utf8"))
  const poly = JSON.stringify(polylines)
  // Ink material but with a slightly higher roughness via the custom path,
  // since the "ink" preset is locked to 0.3 and the user asked for ~0.35.
  // 'custom' preset is required for the roughness override to take effect
  // (the 'ink' preset is locked to roughness 0.3). We seed custom with ink's
  // look (near-black, matte, no clearcoat/sheen) and only bump roughness.
  const js = `(() => {
    const H = window.__styleHarness;
    H.setMode('inflate');
    H.setMaterial('custom');
    H.setCustom({ color: '#1a1a1a', roughness: ${ROUGHNESS}, metalness: 0.0, clearcoat: 0.0, sheen: 0.0, emissiveIntensity: 0.0, envMapIntensity: 1.0 });
    H.injectStrokes(${poly}, { msPerPoint: 12, gapMs: 60 });
    window.__captureHarness.enable();
    return 'ok';
  })()`
  console.log("[cap] inject+style:", evalJS(js))
}

function grabTo(file) {
  const url = evalJS("window.__captureHarness.grab()")
  const m = url.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)
  if (!m) throw new Error("grab returned no data url")
  writeFileSync(file, Buffer.from(m[1], "base64"))
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  setup()
  injectAndStyle()
  await sleep(1500)
  // front-on framing so the flat word matches the 2D logo orientation
  console.log("[cap] frontView:", evalJS("String(window.__captureHarness.frontView(1.0))"))
  await sleep(800)

  for (let i = 0; i < DRAW_FRAMES; i++) {
    const p = i / (DRAW_FRAMES - 1)
    evalJS(`window.__revealHarness.setProgress(${p.toFixed(4)})`)
    await sleep(160) // let the inflate rebuild + render settle
    const name = i === DRAW_FRAMES - 1 ? "3d_full" : `3d_${String(i).padStart(4, "0")}`
    grabTo(join(FRAMES, `${name}.png`))
    if (i % 10 === 0) console.log(`[cap] frame ${i}/${DRAW_FRAMES} p=${p.toFixed(2)}`)
  }
  // ensure a clean full frame
  evalJS("window.__revealHarness.setProgress(1.0)")
  await sleep(400)
  grabTo(join(FRAMES, "3d_full.png"))
  console.log("[cap] done")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

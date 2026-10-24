// STRICT test of the user's original complaint: "a lot of the animations for
// textures are hard to notice or just don't do anything".
//
// For every texture pattern, animated at realistic settings, measure the mean
// consecutive-frame change over ink pixels. This is the number that decides
// whether an animation is NOTICEABLE, not merely non-zero.
//
// Thresholds are deliberately strict — a pattern that only clears "detectable
// by diffing" has failed the complaint that prompted this test.
import { chromium } from "./lib/browser.mjs"
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

/* ── AND THE URL WAS ONLY HALF OF IT — THIS GATE ALSO NAMED A CHECKOUT TWICE ──
 *
 * Re-pointing the URL fixes which tree the BROWSER half reads. It says nothing
 * about the two absolute paths below, and the second of them is the worse
 * defect in this whole class, because it is an INPUT rather than an output:
 *
 *   OUT  an absolute path into a checkout's docs/verification
 *   SRC  an absolute path to that same checkout's lib/style-system.ts
 *
 * SRC is where the matrix comes from. `declared()` reads the `TextureMode` and
 * `TextureDirection` unions out of that file, so the SET OF ROWS this gate
 * grades was taken from the shared checkout no matter which tree it was run in.
 * A lane that added, renamed or removed a texture mode in its own tree got a
 * green matrix over the SHARED tree's mode list — and the rows would still be
 * headed with the right pattern names, because the names came from the same
 * place. The header three blocks down says a hand-copied list "reads identically
 * to a mode that passed"; an absolutely-pathed list reads identically to the
 * caller's list, which is the same lie sourced one directory further out.
 *
 * Both are now derived from the script's own location. In the shared checkout
 * they resolve byte-identically to the strings they replace, so this changes the
 * gate's SUBJECT without changing its OUTPUT there. `assert-one-knob` was blind
 * to both until channel F: the defect is a PATH, not a URL. Reference fix and
 * write-up: `_probe-drawin-film.mjs:17-27`. DISPATCH §2.1 (cite per change).
 *
 * ⚠ Nothing is ever written into OUT — `mkdirSync` runs and `writeFileSync` is
 * imported and never called. Said out loud rather than deleted: this gate's only
 * effect on disk is an empty directory, and a reader looking for its evidence
 * there will find none. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "texture-motion")
mkdirSync(OUT, { recursive: true })

/* ── THE MATRIX IS READ FROM THE TYPE, NOT RESTATED (class 4) ──────────────
 *
 * `PATTERNS` was twelve string literals. `TextureMode` (lib/style-system.ts)
 * declares THIRTEEN non-`none` members, and the one the list left out —
 * `procedural` — is the first entry in the type. A hand-copied list is exactly
 * the rot this file exists to catch one level down: a mode nobody enumerated is
 * a mode whose animation nobody has ever measured, and it reads identically to
 * a mode that passed.
 *
 * Both axes are now derived, so adding a texture mode or a travel direction to
 * the type adds rows here automatically instead of silently widening the gap. */
const SRC = readFileSync(join(ROOT, "lib", "style-system.ts"), "utf8")
function declared(typeName) {
  const m = SRC.match(new RegExp(`export type ${typeName}\\s*=([\\s\\S]*?)\\n\\n`))
  if (!m) throw new Error(`could not read ${typeName} from lib/style-system.ts`)
  return [...m[1].matchAll(/"([a-zA-Z]+)"/g)].map((x) => x[1]).filter((v) => v !== "none")
}
const PATTERNS = declared("TextureMode")
// The degenerate case: a direction parallel to a pattern's own invariant axis.
// scanlines/bands/woodgrain/brushed all vary in y, so "horizontal" travel used
// to move the sample point along a line the pattern is constant on -> zero
// visible motion. Every direction must animate every pattern.
//
// `TextureDirection` is the right type here and it has exactly three members —
// `DitherDirection` is a different type with a fourth (`static`) and belongs to
// the dither rail, not this one. Derived anyway, for the same reason as above.
const DIRECTIONS = declared("TextureDirection")
const ROWS = PATTERNS.length * DIRECTIONS.length
const DEAD = 1.0      // below this: does nothing
const WEAK = 4.0      // below this: "hard to notice" — still fails the complaint

const stroke=()=>{const p=[];for(let i=0;i<=120;i++){const t=i/120;p.push({x:120+t*620,y:330+Math.sin(t*Math.PI*2.2)*130})}return[p]}
async function px(buf){const img=await loadImage(buf);const c=createCanvas(img.width,img.height);c.getContext("2d").drawImage(img,0,0);return c.getContext("2d").getImageData(0,0,img.width,img.height).data}
function diff(a,b){let s=0,n=0;for(let i=0;i<a.length;i+=4){if(a[i+3]<20&&b[i+3]<20)continue;s+=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;n++}return n?s/n:0}

const b=await chromium.launch({ headed: true })
const page=await b.newPage({viewport:{width:1200,height:800}})
await page.goto(LAB_URL,{waitUntil:"networkidle"})
await page.waitForFunction(()=>window.__styleHarness&&window.__captureHarness)
await page.evaluate(p=>{window.__styleHarness.injectStrokes(p,{msPerPoint:12});window.__captureHarness.enable()},stroke())
await page.waitForTimeout(1500)
await page.evaluate(()=>window.__revealHarness.setProgress(1))
await page.evaluate(()=>window.__styleHarness.setMode("solid"))
await page.waitForTimeout(900)
await page.evaluate(()=>window.__captureHarness.frontView(1))

let fail=0
for (const DIR of DIRECTIONS) {
console.log(`\n--- travel: ${DIR} ---`)
console.log("pattern        consecΔ   verdict")
for (const p of PATTERNS) {
  await page.evaluate(([t,DIR])=>window.__styleHarness.setStyle({
    textureEnabled:true, textureMode:t, textureAnimated:true,
    textureScale:1.2, textureIntensity:0.7, textureContrast:0.55,
    textureSpeed:1, textureDirection:DIR, textureLockMode:"object",
    motionMode:"independent", textureSyncMode:"independent",
    ditherEnabled:false, asciiEnabled:false, layerStackEnabled:false,
  }), [p,DIR])
  await page.waitForTimeout(600)
  const shots=[]
  for(let i=0;i<6;i++){await page.waitForTimeout(180);const u=await page.evaluate(()=>window.__captureHarness.grab());shots.push(Buffer.from(u.match(/base64,(.+)/)[1],"base64"))}
  let tot=0,prev=await px(shots[0])
  for(let i=1;i<shots.length;i++){const c=await px(shots[i]);tot+=diff(prev,c);prev=c}
  const m=tot/(shots.length-1)
  const verdict = m<DEAD ? "DOES NOTHING" : m<WEAK ? "HARD TO NOTICE" : "clearly moves"
  if (m<WEAK) fail++
  console.log(`${p.padEnd(13)} ${m.toFixed(2).padStart(6)}   ${verdict}`)
}
}
/* ── THE NEGATIVE CONTROL, MEASURED, ON THE DEFAULT PATH ───────────────────
 *
 * Thirty-six green rows prove nothing until this ruler has been seen to go red,
 * and until 2026-08-01 nothing here ever had — the matrix was written when it
 * was failing, then it stopped failing and no control replaced the failures.
 *
 * `ripple` on DIAGONAL is the control, and it is not synthetic: it is the row
 * that WAS red (2.97, "hard to notice"), it is red again on demand, and the
 * thing that makes it red is the parked prior shipped beside the fix
 * (`uFsTexRipplePrior`, lib/texture-shader.ts). Same page, same camera, same
 * arithmetic — one uniform apart. If the WEAK threshold ever stops being able
 * to catch that, every row above it is decoration.
 */
/* ⚠ AND UNTIL 2026-08-02 THE CONTROL COULD SKIP ITSELF (class 7).
 *
 * The block below opened:
 *
 *   let controlOk = null
 *   const harness = await page.evaluate(() => typeof window.__textureShaderHarness?.set === "function")
 *   if (!harness) {
 *     console.log("\nFAIL  control — window.__textureShaderHarness.set is missing, …")
 *   } else { … }
 *
 * The `!harness` branch PRINTED the word FAIL and never touched `fail`. So if
 * the harness were ever renamed, tree-shaken out of a production build, or
 * simply not yet mounted when the probe ran, the script printed a FAIL line,
 * then printed
 *
 *   ALL TEXTURE ANIMATIONS CLEARLY MOVE IN EVERY DIRECTION, AND THE RULER WAS
 *   SHOWN TO FAIL
 *
 * and exited 0 — claiming, in the same breath, both that the control failed and
 * that the control had passed. The header three paragraphs up says "thirty-six
 * green rows prove nothing until this ruler has been seen to go red". A missing
 * ruler is the one case where that is most true, and it was the one case that
 * could not fail the run.
 *
 * The absence of the control is now a failure of the run, and the summary line
 * can no longer claim the ruler was demonstrated unless it actually was. */
let controlOk = null
/* KNOWN-BAD INPUT for the repair above: `--drop-harness` removes
 * `window.__textureShaderHarness` from the page before the probe, reproducing
 * exactly the "the ruler is not there" condition that used to exit 0. It touches
 * nothing on disk and nothing in lib/. This gate must exit non-zero under it. */
if (process.argv.includes("--drop-harness")) {
  await page.evaluate(() => { delete window.__textureShaderHarness })
  console.log("\n[known-bad] --drop-harness: window.__textureShaderHarness removed from the page on purpose")
}
const harness = await page.evaluate(() => typeof window.__textureShaderHarness?.set === "function")
if (!harness) {
  controlOk = false
  fail++
  console.log("\nFAIL  control — window.__textureShaderHarness.set is missing, so NOTHING above has been shown to able to fail. Every green row in this matrix is undemonstrated.")
} else {
  await page.evaluate(() => window.__textureShaderHarness.set("uFsTexRipplePrior", 1))
  await page.evaluate(()=>window.__styleHarness.setStyle({
    textureEnabled:true, textureMode:"ripple", textureAnimated:true,
    textureScale:1.2, textureIntensity:0.7, textureContrast:0.55,
    textureSpeed:1, textureDirection:"diagonal", textureLockMode:"object",
    motionMode:"independent", textureSyncMode:"independent",
    ditherEnabled:false, asciiEnabled:false, layerStackEnabled:false,
  }))
  await page.waitForTimeout(700)
  const shots=[]
  for(let i=0;i<6;i++){await page.waitForTimeout(180);const u=await page.evaluate(()=>window.__captureHarness.grab());shots.push(Buffer.from(u.match(/base64,(.+)/)[1],"base64"))}
  let tot=0,prev=await px(shots[0])
  for(let i=1;i<shots.length;i++){const c=await px(shots[i]);tot+=diff(prev,c);prev=c}
  const m=tot/(shots.length-1)
  await page.evaluate(() => window.__textureShaderHarness.set("uFsTexRipplePrior", 0))
  const restored = (await page.evaluate(() => window.__textureShaderHarness.get("uFsTexRipplePrior"))).every((v)=>v===0)
  controlOk = m < WEAK && restored
  if (!controlOk) fail++
  console.log(
    `\n${controlOk ? "PASS" : "FAIL"}  control — ripple/diagonal on the PARKED prior reads ${m.toFixed(2)}, ` +
    `which must be under the WEAK line of ${WEAK} for this matrix to mean anything` +
    (restored ? " (uniform restored)" : " *** UNIFORM NOT RESTORED ***"),
  )
}

await b.close()
/* The summary is now conditional on the control having RUN and passed. `fail===0`
 * alone used to license the sentence "AND THE RULER WAS SHOWN TO FAIL" even on a
 * run where the ruler was never touched. */
console.log(
  fail === 0 && controlOk === true
    ? `\nALL ${ROWS} TEXTURE ANIMATIONS CLEARLY MOVE IN EVERY DIRECTION, AND THE RULER WAS SHOWN TO FAIL`
    : `\n${fail} FAILING ROW(S) OF ${ROWS} + 1 CONTROL` +
      (controlOk === true ? "" : "  — AND THE CONTROL DID NOT DEMONSTRATE THAT THIS MATRIX CAN GO RED"),
)
process.exit(fail === 0 && controlOk === true ? 0 : 1)

// assert-export-app.mjs — THE ANIMATED EXPORT, DRIVEN THE WAY A USER DRIVES IT.
//
// `assert-export-live.mjs` proves `lib/export/**` works in a browser against a
// synthetic canvas. This proves the WIRING: a real stroke drawn with real
// pointer events, the real Video button in the real export bar, the real
// download the browser writes, and ffmpeg's opinion of the file that lands.
//
//   node scripts/verify/_run-clean.mjs scripts/verify/assert-export-app.mjs
//
// Needs `next dev` on :3000. `--keep` leaves the temp downloads on disk.
//
// ── WHAT IT IS FOR, AND WHY THE LAST ROW IS THE ONLY ONE THAT MATTERS ───────
// The first WebM this module ever produced decoded cleanly, had the right frame
// count, the right duration and 121 distinct frames — and the contact sheet was
// a near-black rectangle, because video has no alpha and a transparent canvas
// composites onto black. EVERY NUMERIC ROW WAS GREEN. So this gate does not
// only count frames: it reads the pixels, requires the ground to be paper and
// the ink to be present, and reproduces the black-rectangle defect on demand
// through `window.__fsExportGround = "none"`. A row whose control comes back
// clean is announced as blind rather than counted.
//
// It also settles the style clock, which is the other half of "frame-locked":
//   drive arm — the same mark exported at two different render speeds must
//               decode to IDENTICAL bytes;
//   wall arm  — `window.__fsExportClock = "wall"` parks the prior behaviour and
//               the same pair must then DIFFER, or the check is measuring
//               nothing.
import { chromium } from "./lib/browser.mjs"
import { execFileSync, spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, rmSync, mkdtempSync, existsSync, readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { tmpdir } from "node:os"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const FFMPEG = require("ffmpeg-static")
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "export-v2")
const TMP = mkdtempSync(join(tmpdir(), "fs-exportapp-"))
const KEEP = process.argv.includes("--keep")
/* ONE KNOB, ONE NAME. This line used to be `const BASE = "http://localhost:3000"`
 * and it is one of the 35 browser gates explainer 27 §1 measured as ignoring
 * `FS_PORT` entirely. On the shared checkout the literal and the derived URL are
 * the same string, so the defect is invisible there; run the battery anywhere
 * else and this gate reports on a tree it never touched, in green.
 *
 * The rule that closes it is not "add FS_PORT here" — it is that a gate must not
 * be able to NAME its own server. `lib/dev-server.mjs` is the only thing allowed
 * to know the address; every gate that was free to write its own string
 * eventually wrote the wrong one. */
import { LAB_URL } from "./lib/dev-server.mjs"
import { makePaired } from "./lib/paired.mjs"
const BASE = LAB_URL

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  —  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
/* ONE PLACE OF TRUTH, and it fixes a real defect. This file's own copy
 * swallowed a THROWING control into `b = false`, so `ok = a && !b`
 * collapsed to `a` and the row PASSED while its control was crashing.
 * See scripts/verify/lib/paired.mjs for the measurement. */
const paired = makePaired(row)

/* ------------------------------------------------------------------ */
/*  ffmpeg — the judge                                                */
/* ------------------------------------------------------------------ */
function runCapture(argv) {
  const [bin, ...args] = argv
  const r = spawnSync(bin, args, { maxBuffer: 1 << 28, encoding: "utf8" })
  return `${r.stdout ?? ""}${r.stderr ?? ""}`
}
function probe(file) {
  const clean = runCapture([FFMPEG, "-v", "error", "-i", file, "-f", "null", "-"]).trim()
  const text = runCapture([FFMPEG, "-i", file, "-f", "null", "-"])
  const f = [...text.matchAll(/frame=\s*(\d+)/g)].map((m) => +m[1])
  const d = text.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
  const size = text.match(/,\s(\d+)x(\d+)[,\s]/)
  return {
    ok: clean === "",
    err: clean.split("\n")[0] ?? "",
    frames: f.length ? f[f.length - 1] : 0,
    declared: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : NaN,
    width: size ? +size[1] : 0,
    height: size ? +size[2] : 0,
  }
}
/** Every frame as raw 8-bit grey. The only honest way to ask "what is in it". */
function decodeGray(file, w, h) {
  const buf = execFileSync(FFMPEG, ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "gray", "-"], {
    maxBuffer: 1 << 28,
  })
  const size = w * h
  const out = []
  for (let o = 0; o + size <= buf.length; o += size) out.push(buf.subarray(o, o + size))
  return out
}
/** Every frame as raw RGBA — used for the APNG's alpha and for hashing. */
function decodeRgba(file, w, h) {
  /* 2 ** 31, not 1 << 28 (2026-09-30). At the 1600 x 1500 page this gate
   * opens, a Rod film is 798 x 1182: 3.77 MB a frame, so 1 << 28 held 71
   * frames and the APNG arm died with ENOBUFS at 84 (73 on the unchanged base
   * in the cloud session), before any of its paired rows ran. Same cliff as
   * `pixelHash`'s note below; this reader still has to hold the film. */
  const buf = execFileSync(FFMPEG, ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], {
    maxBuffer: 2 ** 31,
  })
  const size = w * h * 4
  const out = []
  for (let o = 0; o + size <= buf.length; o += size) out.push(buf.subarray(o, o + size))
  return out
}
/**
 * sha256 of every decoded pixel of the whole film, STREAMED.
 *
 * RGBA and not RGB because the determinism arms run on the APNG path, and the
 * reason they do is that APNG is LOSSLESS. Hashing a VP9 file would be asking
 * whether libvpx is bit-reproducible, which is a question about a codec and not
 * about this app's clock — the first run of this gate failed exactly there.
 *
 * ⚠ IT USED TO BUFFER THE WHOLE FILM, AND THE FILM'S LENGTH IS THE GESTURE'S.
 * `execFileSync` with `maxBuffer: 1 << 28` holds 268 435 456 bytes. On
 * 2026-08-28 a 36-frame film decoded to 268 500 942 — sixty-five kilobytes over
 * — and the gate died with `ENOBUFS` at row 14 of 22, printing no FAIL row for
 * it. Nothing about that cliff was a property of the app: at 1584×1408 RGBA one
 * frame is 8.92 MB, so the cap allowed THIRTY FRAMES, while the pen timebase
 * will happily plan hundreds. Raising the number would only move the cliff, so
 * the buffer is gone: ffmpeg's stdout goes into the hash as it arrives and the
 * memory is constant however long the gesture was. Lane N20, row F24.
 */
function pixelHash(file, w, h) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", "-"])
    const digest = createHash("sha256")
    let bytes = 0
    let stderr = ""
    proc.stdout.on("data", (chunk) => {
      digest.update(chunk)
      bytes += chunk.length
    })
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    proc.on("error", reject)
    proc.on("close", (code) =>
      code === 0
        ? resolve({ hash: digest.digest("hex").slice(0, 16), bytes })
        : reject(new Error(`ffmpeg exited ${code} decoding ${file}: ${stderr.slice(0, 200)}`)),
    )
  })
}
const meanOf = (f) => {
  let s = 0
  for (let i = 0; i < f.length; i++) s += f[i]
  return s / f.length
}
const minOf = (f) => {
  let m = 255
  for (let i = 0; i < f.length; i++) if (f[i] < m) m = f[i]
  return m
}
/**
 * A sheet you can LOOK at. Not decoration — it is what caught the black one.
 *
 * ⚠ AND IT LIED ONCE, THE SAME WAY THE EXPORT DID. The first control sheet
 * written here came out of ffmpeg as an RGBA PNG with 95.8 % of its pixels at
 * alpha 0 — so every viewer composited it onto ITS OWN white, and a film that
 * measured mean 1.05 was displayed as a clean mark on paper. A transparent
 * contact sheet of a transparency defect is the defect wearing a second coat.
 *
 * So the ground is DECLARED, never inherited:
 *   `ground = null`  → alpha is dropped, exactly as an opaque container's
 *                      player drops it. This is the truth about a WebM.
 *   `ground = "0x…"` → flattened over that colour, for an APNG whose alpha IS
 *                      the point. The sheet then shows the mark AND where the
 *                      file is see-through.
 */
function contactSheet(file, out, ground = null, cols = 6, rows = 6) {
  const p = probe(file)
  const step = Math.max(1, Math.floor(p.frames / (cols * rows)))
  const tile = `select=not(mod(n\\,${step})),scale=220:-1,tile=${cols}x${rows}`
  const args =
    ground === null
      ? ["-vf", `${tile},format=rgb24`]
      : ["-filter_complex", `[0:v]${tile}[t];color=c=${ground}:s=16x16[c];[c][t]scale2ref[bg][t2];[bg][t2]overlay,format=rgb24`]
  spawnSync(FFMPEG, ["-y", "-v", "error", "-i", file, ...args, "-frames:v", "1", out], { maxBuffer: 1 << 28 })
  return existsSync(out) ? out : null
}
/** Mean luminance and alpha coverage of a written sheet — so the gate can
 *  assert the picture it is asking a human to look at is not itself a lie. */
function sheetStats(file) {
  const buf = execFileSync(FFMPEG, ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], {
    maxBuffer: 1 << 28,
  })
  let s = 0, n = 0, a0 = 0
  for (let i = 0; i < buf.length; i += 4) {
    s += (buf[i] + buf[i + 1] + buf[i + 2]) / 3
    n++
    if (buf[i + 3] === 0) a0++
  }
  return { mean: s / n, alphaZero: a0 / n }
}

/* ------------------------------------------------------------------ */
/*  The browser                                                       */
/* ------------------------------------------------------------------ */
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1600, height: 1500 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
})
const page = await context.newPage()
const pageErrors = []
page.on("pageerror", (e) => pageErrors.push(String(e)))
const consoleErrors = []
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text())
})

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 })
await page.waitForFunction(
  () => !!window.__revealHarness && !!window.__captureHarness && !!window.__styleHarness,
  null,
  { timeout: 240000 },
)

/* ---- DRAW A REAL STROKE, WITH THE BROWSER'S OWN TIMESTAMPS ----------
 * Not injected points. The whole claim under test is "the film is as long as
 * the gesture was", and a gesture whose timing this script invented would be
 * testing the script. */
const box = await page.locator('canvas[aria-label*="Drawing canvas"]').boundingBox()
await page.mouse.move(box.x + box.width * 0.12, box.y + box.height * 0.62)
await page.mouse.down()
/* The driver's own clock, bracketing exactly the points it asks the app to
 * record: first move after the pen goes down, last move before it comes up. */
const drivenFrom = Date.now()
for (let i = 1; i <= 26; i++) {
  const t = i / 26
  await page.mouse.move(
    box.x + box.width * (0.12 + t * 0.74),
    box.y + box.height * (0.62 - 0.34 * Math.sin(t * Math.PI)),
  )
  await page.waitForTimeout(22)
}
const drivenTo = Date.now()
await page.mouse.up()
await page.waitForTimeout(2500)

const penMs = await page.evaluate(() => window.__revealHarness.getTotalDuration())
const drivenMs = drivenTo - drivenFrom

/**
 * ⚠ ONCE, THIS READ 166 ms FROM A GESTURE THIS FILE DRIVES FOR AT LEAST 572 ms.
 *
 * 2026-08-28, lane N4: one run of this gate recorded a 166 ms stroke; run 2 read
 * 831 ms and the gate went 22 PASS 0 FAIL. Unreproduced, and recorded as a
 * fragility rather than a failure — but the product's whole claim is that the
 * film is as long as the gesture, and once it silently was not. Row F24.
 *
 * THE OLD BAR COULD NOT HAVE NAMED IT. `penMs > 200` is a number with no
 * relationship to what was driven: it goes red on a 166 ms read and says
 * "a real stroke was drawn", which is the wrong sentence about the wrong
 * quantity. 26 steps of 22 ms is 572 ms of driving BEFORE any browser
 * overhead, so the interesting number was always the RATIO and nobody had it.
 *
 * THE FLOOR COMES FROM THE CLAIM, NOT FROM TASTE. The app cannot record more
 * time than elapsed, so the ratio's ceiling is 1. A recording holding less than
 * HALF the gesture's elapsed time has dropped at least half of it, and a film
 * built on it is not "as long as the gesture" in any sense a user would accept.
 * The observed failure sat at 0.29. A healthy run sits near 1 and the ratio is
 * printed every time, so the next person to see this drift has the number.
 */
const PEN_FLOOR = 0.5
const penRatio = (recorded, driven) => (driven > 0 ? recorded / driven : 0)
const penTimingOk = (recorded, driven) => recorded > 200 && penRatio(recorded, driven) >= PEN_FLOOR
row(
  penTimingOk(penMs, drivenMs),
  "a real stroke was drawn and the app recorded the gesture it was given",
  `totalDuration=${penMs.toFixed(1)}ms · driven ${drivenMs}ms · recorded ${(
    penRatio(penMs, drivenMs) * 100
  ).toFixed(1)}% of the gesture (floor ${PEN_FLOOR * 100}%)`,
)
/* THE NEGATIVE CONTROL, ON THE BARE INVOCATION, AGAINST THE REAL OBSERVATION.
 * A floor nobody has watched reject anything is a floor nobody has shown can
 * bite, and the first pair here is N4's measurement rather than an invented one.
 *
 * ⚠ THE MIDDLE PAIR EXISTS BECAUSE THE FIRST ONE DOES NOT TEST THE FLOOR.
 * 166 fails `recorded > 200` on its own, so `penTimingOk(166, 572)` would come
 * back false with the ratio arm deleted and the control would still be green —
 * a control that passes for the wrong reason. 250 of 900 clears the 200 ms
 * check and is rejected by the RATIO alone, which is the arm this row is for. */
row(
  penTimingOk(166, 572) === false &&
    penTimingOk(250, 900) === false &&
    penTimingOk(831, 900) === true,
  "KNOWN-BAD · that floor REJECTS the 166 ms read N4 saw, rejects 250 of 900 on the RATIO alone, and accepts a healthy run",
  `166 of 572 = 29.0% rejected · 250 of 900 = 27.8% rejected past the 200ms check · 831 of 900 = 92.3% accepted`,
)

/* ---- THE PANEL IS A CONTROL, SO DRIVE IT ---------------------------- */
const videoBtn = page.locator('button[title*="Save the animation"]')
row((await videoBtn.count()) === 1, "the export bar carries a Video button", `found ${await videoBtn.count()}`)
await page.locator('button[aria-label="Video export settings"]').click()
await page.waitForTimeout(150)
const panelText = await page.locator("text=the time this took you to draw").first().innerText().catch(() => "")
row(
  /the time this took you to draw/.test(panelText),
  "the panel SAYS the pen timebase out loud — the product's argument, in the UI",
  JSON.stringify(panelText.slice(0, 90)),
)
// 24 fps: fewer frames per export, six exports in this run.
await page.locator('button:has-text("24")').first().click()
await page.waitForTimeout(120)
await page.locator('button[aria-label="Video export settings"]').click()
await page.waitForTimeout(150)

/* ---- ONE EXPORT, THROUGH THE BUTTON, CAUGHT AS A DOWNLOAD ---------- */
async function exportOnce(tag) {
  const t0 = Date.now()
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 300000 }),
    videoBtn.click(),
  ])
  const name = dl.suggestedFilename()
  const path = join(TMP, `${tag}-${name}`)
  await dl.saveAs(path)
  // The button re-enables when the export releases; wait for it so the next
  // arm cannot start on top of this one.
  await page.waitForFunction(
    () => {
      const b = document.querySelector('button[title*="Save the animation"], button[title="Stop the export"]')
      return !!b && !/^\d+%$|^…$/.test(b.textContent.trim())
    },
    null,
    { timeout: 120000 },
  )
  await page.waitForTimeout(250)
  return { path, name, ms: Date.now() - t0 }
}
const setLaw = (patch) => page.evaluate((p) => Object.assign(window, p), patch)

/* PARK THE SCRUBBER SOMEWHERE DISTINCTIVE FIRST. An export walks the playhead
 * from 0 to 1; a forward export ENDS at 1, which is also where a freshly drawn
 * stroke leaves it — so "it is still at 1 afterwards" is a row that cannot
 * fail. 0.37 can. */
await page.evaluate(() => window.__revealHarness.setProgress(0.37))
await page.waitForTimeout(200)

const a = await exportOnce("main")
console.log(`\n  main export: ${a.name} in ${(a.ms / 1000).toFixed(1)}s`)

row(
  /_anim_.*\.webm$/.test(a.name),
  "the file follows the APP's naming law and is a video",
  a.name,
)

/* THE TOAST MUST NOT LAND ON THE BUTTON THAT RAISED IT.
 * Asked because it has already happened once in this app — the Clear toast sat
 * on the Undo button its own text told the user to press. `elementFromPoint` at
 * the button's centre, not a bounding-box guess. */
{
  const covered = await page.evaluate(() => {
    const b = document.querySelector('button[title*="Save the animation"]')
    if (!b) return "no button"
    const r = b.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return hit && hit.closest("[data-sonner-toaster]") ? "covered by the toast" : "clear"
  })
  row(covered === "clear", "the export toast does not cover the button that raised it", covered)
}

/* AND THE TRANSPORT IS WHERE IT WAS. Pressing "save a file" must not move the
 * user's scrubber to the end of the drawing. */
{
  const p = await page.evaluate(() => window.__revealHarness.getProgress())
  row(Math.abs(p - 0.37) < 1e-6, "the export left the playhead where it found it", `progress=${p} (parked at 0.37)`)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(200)
}

const pa = probe(a.path)
row(pa.ok && pa.frames > 0, "ffmpeg decodes the file the browser downloaded", `${pa.frames} frames · ${pa.width}x${pa.height} · declared ${pa.declared.toFixed(3)}s · ${pa.err}`)

/* THE PEN TIMEBASE, MEASURED OFF THE FILE. The plan is leadIn(0) + pen + hold
 * (600ms), so the file's declared length has to be the drawing's own duration
 * plus the hold, to within one frame. */
const wantSec = (penMs + 600) / 1000
row(
  Math.abs(pa.declared - wantSec) < 1 / 24 + 0.02,
  "PEN TIMEBASE: the film is as long as the drawing took",
  `declared ${pa.declared.toFixed(3)}s vs pen ${(penMs / 1000).toFixed(3)}s + 0.600s hold = ${wantSec.toFixed(3)}s`,
)

const frames = decodeGray(a.path, pa.width, pa.height)
const means = frames.map(meanOf)
const distinct = new Set(means.map((m) => m.toFixed(3))).size
row(distinct > frames.length * 0.5, "the reveal is IN the file — the mark grows frame to frame", `${distinct} distinct frame means of ${frames.length}`)
row(means[means.length - 1] < means[0] - 0.5, "the last frame carries more ink than the first", `first ${means[0].toFixed(2)} · last ${means[means.length - 1].toFixed(2)}`)

/* ---- 🔴 THE ROW THE NUMBERS ONCE MISSED ---------------------------- */
const lastMean = means[means.length - 1]
const lastMin = minOf(frames[frames.length - 1])
const groundOk = lastMean > 200 && lastMin < 140

const sheet = contactSheet(a.path, join(OUT, "app-contact.png"), null)

/* The control: the parked prior, which composites a transparent canvas into a
 * container with no alpha and therefore onto BLACK. */
await setLaw({ __fsExportGround: "none" })
const bad = await exportOnce("ground-none")
await setLaw({ __fsExportGround: undefined })
const pb = probe(bad.path)
const badFrames = decodeGray(bad.path, pb.width, pb.height)
const badMean = meanOf(badFrames[badFrames.length - 1])
const controlSheet = contactSheet(bad.path, join(OUT, "app-contact-black-control.png"), null)

paired(
  "🔴 THE FILM IS A MARK ON PAPER, NOT A BLACK RECTANGLE",
  () => groundOk,
  "background:null — a transparent canvas into a container with no alpha",
  () => badMean > 200 && minOf(badFrames[badFrames.length - 1]) < 140,
  `paper: mean ${lastMean.toFixed(1)} min ${lastMin} · control: mean ${badMean.toFixed(1)}`,
)
/* THE SHEET A HUMAN IS ABOUT TO LOOK AT MUST NOT ITSELF BE TRANSPARENT.
 * Written because it happened: the first control sheet was 95.8 % alpha 0 and
 * every viewer composited it onto white, so a black film LOOKED correct. */
{
  const s = sheetStats(sheet)
  const c = sheetStats(controlSheet)
  row(
    s.alphaZero === 0 && c.alphaZero === 0 && s.mean > 200 && c.mean < 20,
    "the contact sheets are OPAQUE, so what a human sees is what the file holds",
    `paper sheet mean ${s.mean.toFixed(1)} alpha0 ${(s.alphaZero * 100).toFixed(1)}% · control sheet mean ${c.mean.toFixed(1)} alpha0 ${(c.alphaZero * 100).toFixed(1)}%`,
  )
}
console.log(`      contact sheet → ${sheet}`)
console.log(`      control sheet → ${controlSheet}`)

/* ---- TRANSPARENT MEANS APNG, AND IT MEANS IT -----------------------
 * Switched here rather than at the end because the style-clock arms below run
 * on this path: APNG is LOSSLESS, so two identical renders produce identical
 * bytes and a hash comparison is a question about the app rather than about
 * whether libvpx is bit-reproducible. */
await page.locator('button[aria-label="Video export settings"]').click()
await page.waitForTimeout(150)
await page.locator('button:has-text("Transparent")').last().click()
await page.waitForTimeout(120)
/* TRANSPARENT HAS TWO CONTAINERS NOW (2026-09-30): WebM with a VP9 alpha
 * stream, the default, and APNG. The rows below are about APNG, lossless on
 * purpose (see above), so it is picked by name; the WebM arm has its own gate,
 * assert-export-webm-alpha-app.mjs. */
await page.locator('button:has-text("APNG")').last().click()
await page.waitForTimeout(120)
await page.locator('button[aria-label="Video export settings"]').click()
await page.waitForTimeout(150)

/* ---- THE STYLE CLOCK ------------------------------------------------
 * Needs a time-varying layer on, or there is nothing for the clock to move and
 * two identical files would prove nothing at all. */
await page.evaluate(() =>
  window.__styleHarness.setStyle({
    motionMode: "independent",
    textureEnabled: true,
    textureMode: "dots",
    textureScale: 1.2,
    textureIntensity: 0.9,
    textureContrast: 0.7,
    textureLockMode: "object",
    textureAnimated: true,
    textureSyncMode: "independent",
    textureSpeed: 1.6,
    textureDirection: "right",
  }),
)
await page.waitForTimeout(700)

async function shoot(tag, stall) {
  await setLaw({ __fsExportStallMs: stall })
  const f = await exportOnce(tag)
  const p = probe(f.path)
  return { ...f, ...p, ...(await pixelHash(f.path, p.width, p.height)) }
}

const driveFast = await shoot("drive-fast", 0)
const driveRepeat = await shoot("drive-repeat", 0)
const driveSlow = await shoot("drive-slow", 90)
await setLaw({ __fsExportClock: "wall" })
const wallFast = await shoot("wall-fast", 0)
const wallRepeat = await shoot("wall-repeat", 0)
const wallSlow = await shoot("wall-slow", 90)
await setLaw({ __fsExportClock: undefined, __fsExportStallMs: 0 })

row(/_anim_.*\.png$/.test(driveFast.name), "transparent exports an animated PNG, not a video wearing the label", driveFast.name)
row(driveFast.ok && driveFast.frames > 1, "ffmpeg decodes the APNG, animated", `${driveFast.frames} frames · ${driveFast.width}x${driveFast.height}`)
{
  const rgba = decodeRgba(driveFast.path, driveFast.width, driveFast.height)
  const last = rgba[rgba.length - 1]
  let zero = 0
  for (let i = 3; i < last.length; i += 4) if (last[i] === 0) zero++
  const frac = zero / (last.length / 4)
  row(frac > 0.5, "the APNG really is transparent where the mark is not", `${(frac * 100).toFixed(1)}% of pixels at alpha 0`)
  /* Flattened over a declared mid-grey, not over the viewer's own background:
   * on this file the alpha IS the subject, so the sheet has to show both the
   * ink and the see-through, and it has to say which grey it chose. */
  contactSheet(driveFast.path, join(OUT, "app-contact-transparent-over-grey.png"), "0x9a9a9a")
}

/* HOW FAR APART two films are, in pixels. A hash says "not identical" and
 * stops; this says how many pixels of how many frames and by how much, which is
 * the difference between a red row and a diagnosis — and it is what showed that
 * the driven arm's residual is 2 pixels of 1,123,584, not a clock error. */
function frameDiff(aFile, bFile, w, h) {
  const A = decodeRgba(aFile, w, h)
  const B = decodeRgba(bFile, w, h)
  const n = Math.min(A.length, B.length)
  let px = 0
  let dirtyFrames = 0
  let worst = 0
  /* WHERE THE RESIDUAL SITS, not just how big it is.
   *
   * The bar below used to be `driveNoise.px === 0` while a comment nine lines
   * under it said the residual is "0–2 pixels of 39,325,440, intermittent … the
   * GPU's own run-to-run rasterisation". A file that carries both the bar and the
   * evidence the bar cannot be met produces an intermittent red, and an
   * intermittent red teaches everyone to ignore the gate — which is worse than a
   * steady one, because a steady red gets fixed.
   *
   * "It is rasterisation" was an ASSERTION. This makes it a measurement. GPU
   * rasterisation jitter lands on ANTI-ALIASED EDGES: a pixel whose neighbours
   * in the reference frame already span a wide range, i.e. a pixel that is
   * halfway between ink and paper and whose coverage the rasteriser is free to
   * round either way. A real defect — a dropped sample, an off-by-one in the
   * clock, a stale tile — lands on FLAT interior, where the neighbours agree and
   * no rounding is available to explain it.
   *
   * So every differing pixel is classified by its local gradient in A, and the
   * split is reported with the row. `edge` is consistent with rasterisation;
   * `flat` is not, and one flat pixel is worth more than a hundred edge ones. */
  const sites = []
  let onEdge = 0
  let onFlat = 0
  for (let i = 0; i < n; i++) {
    let d4 = 0
    let mx = 0
    for (let j = 0; j < A[i].length; j++) {
      const d = Math.abs(A[i][j] - B[i][j])
      if (!d) continue
      d4++
      if (d > mx) mx = d
      const p = (j / 4) | 0
      const x = p % w
      const y = (p / w) | 0
      /* local gradient in the REFERENCE frame, luma-ish on this channel */
      let lo = 255
      let hi = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const v = A[i][(ny * w + nx) * 4 + (j % 4)]
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
      }
      const grad = hi - lo
      if (grad >= 8) onEdge++
      else onFlat++
      if (sites.length < 40) sites.push({ frame: i, x, y, ch: j % 4, d, grad })
    }
    if (d4) dirtyFrames++
    px += d4 / 4
    if (mx > worst) worst = mx
  }
  return {
    frames: n,
    dirtyFrames,
    px: Math.round(px),
    worst,
    total: w * h * n,
    subpixels: onEdge + onFlat,
    onEdge,
    onFlat,
    sites,
  }
}
const D = (a, b) => frameDiff(a.path, b.path, a.width, a.height)
const driveNoise = D(driveFast, driveRepeat)
const driveStall = D(driveFast, driveSlow)
const wallNoise = D(wallFast, wallRepeat)
const wallStall = D(wallFast, wallSlow)
const say = (n, d) =>
  `${n}: ${d.px} px on ${d.dirtyFrames}/${d.frames} frames (worst Δ${d.worst}) of ${d.total} px` +
  (d.subpixels ? `  [${d.onEdge} on an anti-aliased edge, ${d.onFlat} on FLAT interior]` : "")
/* Machine-readable, for the characterisation sweep that set the bar below. A
 * distribution measured by re-parsing prose is a distribution measured through a
 * regex nobody gated. */
if (process.env.FS_EXPORT_NOISE_JSON) {
  console.log(
    `NOISEJSON ${JSON.stringify({
      drivePx: driveNoise.px,
      driveWorst: driveNoise.worst,
      driveEdge: driveNoise.onEdge,
      driveFlat: driveNoise.onFlat,
      driveFrames: driveNoise.dirtyFrames,
      sites: driveNoise.sites,
      stallPx: driveStall.px,
      wallPx: wallNoise.px,
    })}`,
  )
}
console.log(
  `\n  ${say("drive · same speed twice", driveNoise)}` +
    `\n  ${say("drive · 0ms vs 90ms   ", driveStall)}` +
    `\n  ${say("wall  · same speed twice", wallNoise)}` +
    `\n  ${say("wall  · 0ms vs 90ms   ", wallStall)}`,
)

row(
  driveSlow.ms > driveFast.ms * 1.3,
  "the two arms really did render at different speeds — the stall is doing something",
  `fast ${(driveFast.ms / 1000).toFixed(1)}s vs slow ${(driveSlow.ms / 1000).toFixed(1)}s over ${driveFast.frames} frames`,
)

/* THE FLOOR, MEASURED AND NOT ASSUMED. Press the button twice with nothing
 * changed: on the driven clock the two files are bit-identical, so the
 * comparison below has a real zero to be measured against rather than a
 * tolerance this script invented.
 *
 * ── THE BAR STAYS AT ZERO, AND IT WAS RE-MEASURED BEFORE THAT WAS DECIDED ────
 *
 * This row was reported red at "2 px differ of 39,325,440" on 2026-08-07, beside
 * a comment nine lines below claiming a 0–2 px intermittent residual — a file
 * carrying both a bar and the evidence its bar cannot be met. An intermittent red
 * is worse than a steady one: a steady red gets fixed, an intermittent one
 * teaches everyone to ignore the gate.
 *
 * So it was CHARACTERISED rather than adjusted: the real gate, run 24 times
 * end-to-end against a dedicated dev server, on a machine with three sibling
 * lanes live. **`driveNoise.px` came back 0 on 24 of 24 runs** (`driveStall`, a
 * different quantity, showed 5–6 px on 3 of 24, against its own 64 px bar). The
 * residual did not reproduce, so there is nothing here to widen the bar to.
 *
 * Moving a number until it passes, for a defect that did not reproduce, would be
 * inventing a tolerance for a phenomenon nobody has measured on this tree — and
 * it would delete the only row that can notice the export becoming
 * nondeterministic. If it ever does fire, the detail below now carries the
 * diagnosis instead of leaving it to be re-argued from a comment: rasterisation
 * jitter lands on ANTI-ALIASED EDGES, where the rasteriser may legitimately round
 * coverage either way; a real defect lands on FLAT interior, where the
 * neighbours agree and no rounding is available to explain it. */
row(
  driveNoise.px === 0,
  "REPRODUCIBLE: the same mark exported twice is the same file, pixel for pixel",
  `${driveNoise.px} px differ of ${driveNoise.total} across ${driveNoise.frames} frames` +
    (driveNoise.px
      ? `  ·  ${driveNoise.onEdge} differing subpixel(s) on an ANTI-ALIASED EDGE (consistent with GPU ` +
        `rasterisation), ${driveNoise.onFlat} on FLAT INTERIOR (NOT — one of these is worth a hundred ` +
        `edge pixels)  ·  worst channel Δ${driveNoise.worst} on ${driveNoise.dirtyFrames}/${driveNoise.frames} frames` +
        `  ·  first sites: ${driveNoise.sites
          .slice(0, 6)
          .map((s) => `f${s.frame}(${s.x},${s.y})Δ${s.d}/grad${s.grad}`)
          .join(" ")}` +
        `\n      Measured 2026-08-07: 0 px on 24 of 24 consecutive runs. A non-zero here is NEW, not the ` +
        `known residual — read the edge/flat split above before touching this bar.`
      : ""),
)

/* ONE YARDSTICK FOR BOTH ARMS. An earlier draft judged the control against its
 * OWN noise floor, which the wall arm has in the hundreds of thousands — so the
 * control passed and the row could not fail. A control measured with a
 * different ruler is not a control. `driveNoise` is the floor for both.
 *
 * The residual on the real arm is stated rather than hidden. ⚠ THE NUMBER IN
 * THIS COMMENT WAS "0–2 pixels of 39,325,440, intermittent, at a channel delta
 * of ~10 … the GPU's own run-to-run rasterisation" — WRITTEN AS AN ASSERTION AND
 * NEVER MEASURED, and it was the sentence used to explain away a red on the row
 * above. Re-measured 2026-08-07 over 24 consecutive end-to-end runs:
 * `driveStall.px` is **0 on 21 of 24 and 5–6 px on 3 of 24**, against this row's
 * 64 px bar; `driveNoise.px` was **0 on all 24**. So the residual is real on THIS
 * arm and was never on that one, and the two were being conflated.
 *
 * `frameDiff` now classifies each differing pixel as edge or flat, so the
 * rasterisation claim is a reading rather than a story. A clock error does not
 * look like either — the control shows what one looks like, which is a third of a
 * million pixels on every frame. Five orders of magnitude is the argument. */
paired(
  "DETERMINISTIC STYLE CLOCK: how long a frame takes to render does not change the film",
  () => driveStall.px <= Math.max(driveNoise.px * 4, 64) && driveStall.total > 0,
  '__fsExportClock = "wall" — the prior, wall-driven behaviour, judged by the same ruler',
  () => wallStall.px <= Math.max(driveNoise.px * 4, 64),
  `drive ${driveStall.px} px changed (floor ${driveNoise.px}) · wall ${wallStall.px} px changed on ${wallStall.dirtyFrames}/${wallStall.frames} frames`,
)

/* AND THE PRIOR IS WORSE THAN "SPEED-DEPENDENT" — IT IS NOT REPEATABLE AT ALL.
 *
 * Stated as its own row because it is the finding, not the setup: on the parked
 * behaviour, pressing the same button twice with NOTHING changed already moves
 * a third of a million pixels. The animated layer runs on wall time, so two
 * exports are two different films whatever the machine is doing. That is what
 * "the style clock is still wall-driven" cost, measured. */
row(
  wallNoise.px > driveNoise.px * 1000 + 10000,
  "the parked prior is not reproducible even at a FIXED render speed — the defect, measured",
  `wall: ${wallNoise.px} px differ on ${wallNoise.dirtyFrames}/${wallNoise.frames} frames between two identical presses · drive: ${driveNoise.px}`,
)

/* AND IT SAYS WHICH PATH RAN. Two files matching is not evidence the driven
 * path was taken — it is also what a scene with nothing animated would produce.
 * The clock publishes its own source and this reads it back. */
const clockSource = await page.evaluate(async () => {
  const seen = new Set()
  const stop = Date.now() + 400
  while (Date.now() < stop) {
    seen.add(window.__geomDebug.styleClock().source)
    await new Promise((r) => requestAnimationFrame(r))
  }
  return [...seen]
})
row(
  clockSource.length === 1 && clockSource[0] === "wall",
  "the clock is handed BACK when the export ends — the page is wall-driven again",
  `source after export: ${clockSource.join(",")}`,
)

row(pageErrors.length === 0, "no page errors across seven exports", pageErrors.slice(0, 2).join(" | ") || "0 errors")
const realConsole = consoleErrors.filter((m) => !/favicon|DevTools|Download the React/i.test(m))
row(realConsole.length === 0, "no console errors across seven exports", realConsole.slice(0, 2).join(" | ") || "0 errors")

await browser.close()
if (!KEEP) rmSync(TMP, { recursive: true, force: true })
console.log(`\nartefacts → ${OUT}`)
console.log(`assert-export-app: ${pass} PASS · ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)

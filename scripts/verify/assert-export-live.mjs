// assert-export-live.mjs — RUN THE EXPORT MODULE IN A REAL BROWSER, then let
// ffmpeg judge what came out.
//
// `assert-export-encoders.mjs` proves the two writers produce decodable files
// from synthetic bytes, in node. It cannot prove the part that only exists in a
// browser: `VideoEncoder`, `VideoFrame`, `CompressionStream`, reading pixels
// back off a live canvas, and the recorder's await-per-frame loop. This does
// that — same Chrome, same `--use-angle=metal` flag, same headless mode the
// rest of the repo's harnesses use.
//
// TWO MODES:
//   (default)  a synthetic page: a canvas whose drawing is a function of the
//              playhead. Needs nothing but Chrome, so this gate always runs.
//   --app      drive the REAL app on :3000 through its own dev hooks
//              (`__revealHarness.setProgress` + `__captureHarness.grab`), on a
//              stroke drawn with real pointer events and therefore real
//              timestamps. This is the entry path a user takes.
//
// Every claim is settled by DECODING the produced file, and each has a control
// that must fail.
//
//   node scripts/verify/_run-clean.mjs scripts/verify/assert-export-live.mjs
//   node scripts/verify/_run-clean.mjs scripts/verify/assert-export-live.mjs --app
import { chromium } from "./lib/browser.mjs"
import ts from "typescript"
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { tmpdir } from "node:os"
import { createRequire } from "node:module"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"
import { makePaired } from "./lib/paired.mjs"

const require = createRequire(import.meta.url)
const FFMPEG = require("ffmpeg-static")
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "export-v1")
const TMP = mkdtempSync(join(tmpdir(), "fs-live-"))

const APP_MODE = process.argv.includes("--app")
const KEEP = process.argv.includes("--keep")

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
/*  Serve lib/export/ to the page as ES modules                       */
/*                                                                    */
/*  Not bundled and not copied into the app: the page imports the     */
/*  ACTUAL source files, transpiled on the way through, so this gate  */
/*  can never drift from what ships.                                  */
/* ------------------------------------------------------------------ */
const MODULES = ["frame-plan", "webm", "apng", "encoders", "recorder", "index"]
function transpiled(name) {
  const src = readFileSync(join(ROOT, "lib", "export", `${name}.ts`), "utf8")
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: `${name}.ts`,
  }).outputText
  // Relative specifiers need an extension in the browser.
  return js.replace(/from\s+["']\.\/([a-z-]+)["']/g, 'from "./$1.js"')
}

async function serveModules(page, base) {
  for (const m of MODULES) {
    await page.route(`${base}/${m}.js`, (route) =>
      route.fulfill({ status: 200, contentType: "text/javascript", body: transpiled(m) }),
    )
  }
}

/* ------------------------------------------------------------------ */
/*  ffmpeg readers                                                    */
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
  const t = [...text.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)].map((m) => +m[1] * 3600 + +m[2] * 60 + +m[3])
  const d = text.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
  return {
    ok: clean === "",
    err: clean.split("\n")[0] ?? "",
    frames: f.length ? f[f.length - 1] : 0,
    seconds: t.length ? t[t.length - 1] : 0,
    declared: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : NaN,
  }
}
function decodeGray(file, w, h) {
  const buf = execFileSync(FFMPEG, ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 28 })
  const size = w * h
  const out = []
  for (let o = 0; o + size <= buf.length; o += size) out.push(buf.subarray(o, o + size))
  return out
}
/** Mean luminance per frame — the cheapest honest read of "is the mark growing". */
function meanOf(frame) {
  let s = 0
  for (let i = 0; i < frame.length; i++) s += frame[i]
  return s / frame.length
}

/* ------------------------------------------------------------------ */

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
const page = await context.newPage()
const pageErrors = []
page.on("pageerror", (e) => pageErrors.push(String(e)))

mkdirSync(OUT, { recursive: true })

let results = null

if (!APP_MODE) {
  /* ---- SYNTHETIC PAGE ------------------------------------------------
   * https:// so the page is a secure context — measured 2026-08-01, that is
   * exactly what decides whether `VideoEncoder` exists at all: on about:blank
   * it is UNDEFINED while `isSecureContext` still reports true. */
  const BASE = "https://free-stroke.test"
  await page.route(`${BASE}/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><meta charset="utf-8"><title>export gate</title><canvas id="c" width="320" height="240"></canvas>`,
    }),
  )
  await serveModules(page, BASE)
  await page.goto(`${BASE}/`)

  results = await page.evaluate(async () => {
    const mod = await import("https://free-stroke.test/index.js")
    const canvas = document.getElementById("c")
    const ctx = canvas.getContext("2d")

    /** A mark that GROWS with the playhead — the shape of the real reveal. */
    let playhead = 0
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = "#111"
      ctx.lineWidth = 14
      ctx.lineCap = "round"
      ctx.beginPath()
      const N = 120
      const upto = Math.max(1, Math.round(playhead * N))
      for (let i = 0; i <= upto; i++) {
        const t = i / N
        const x = 20 + t * 280
        const y = 120 + Math.sin(t * Math.PI * 2) * 70
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    const host = {
      seek(p) { playhead = p },
      grabFrame() {
        render()
        return Promise.resolve({ kind: "canvas", canvas, width: canvas.width, height: canvas.height })
      },
    }
    const staticHost = {
      seek() { playhead = 0.5 },
      grabFrame() {
        render()
        return Promise.resolve({ kind: "canvas", canvas, width: canvas.width, height: canvas.height })
      },
    }

    const toB64 = async (blob) => {
      const buf = new Uint8Array(await blob.arrayBuffer())
      let s = ""
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
      return btoa(s)
    }

    const PEN_MS = 4237
    const webm = await mod.exportAnimation({
      host, penDurationMs: PEN_MS, timebase: "pen", fps: 30, scale: 1, format: "webm", holdMs: 300,
    })
    const apng = await mod.exportAnimation({
      host, penDurationMs: 1000, timebase: "pen", fps: 20, scale: 1, transparent: true,
    })
    const still = await mod.exportAnimation({
      host: staticHost, penDurationMs: PEN_MS, timebase: "pen", fps: 30, format: "webm", holdMs: 300,
    })

    return {
      hasVideoEncoder: typeof VideoEncoder !== "undefined",
      penMs: PEN_MS,
      webm: { b64: await toB64(webm.blob), ...meta(webm) },
      apng: { b64: await toB64(apng.blob), ...meta(apng) },
      still: { b64: await toB64(still.blob), ...meta(still) },
    }

    function meta(r) {
      return {
        filename: r.filename, encoderId: r.encoderId, frames: r.frames, width: r.width, height: r.height,
        durationMs: r.durationMs, warnings: r.warnings, summary: r.summary,
        planDrawMs: r.plan.drawDurationMs, planTimebase: r.plan.timebase,
      }
    }
  })
} else {
  /* ---- THE REAL APP --------------------------------------------------- */
  const BASE = LAB_URL
  await serveModules(page, BASE + "/__fsexport")
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForFunction(() => !!window.__revealHarness && !!window.__captureHarness, null, { timeout: 180000 })

  /* DRAW A REAL STROKE WITH REAL POINTER TIMING. Not injected points — the
   * timestamps have to be the browser's own, or the "pen timebase" claim is
   * being tested against numbers this script made up. */
  const box = await page.locator('canvas[aria-label*="Drawing canvas"]').boundingBox()
  await page.mouse.move(box.x + 60, box.y + box.height * 0.6)
  await page.mouse.down()
  for (let i = 1; i <= 40; i++) {
    const t = i / 40
    await page.mouse.move(box.x + 60 + t * (box.width - 120), box.y + box.height * (0.6 - 0.35 * Math.sin(t * Math.PI)))
    await page.waitForTimeout(25)
  }
  await page.mouse.up()
  await page.waitForTimeout(2500)

  results = await page.evaluate(async () => {
    const mod = await import("/__fsexport/index.js")
    const rh = window.__revealHarness
    const ch = window.__captureHarness
    const penMs = rh.getTotalDuration()
    const el = document.querySelector("canvas.webgl, canvas") // the 3D canvas is the last one
    const canvases = [...document.querySelectorAll("canvas")]
    const gl = canvases[canvases.length - 1]
    void el

    const host = {
      seek(p) { rh.setProgress(p) },
      easePlayhead: (c) => rh.ease(c, "linear"),
      settle: () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      async grabFrame() {
        const url = ch.grab()
        if (!url) return null
        const blob = await (await fetch(url)).blob()
        return { kind: "blob", blob, width: gl.width, height: gl.height }
      },
    }
    const res = await mod.exportAnimation({
      host, penDurationMs: penMs, timebase: "pen", fps: 24, scale: 1, format: "auto", holdMs: 300, markName: "live",
    })
    const buf = new Uint8Array(await res.blob.arrayBuffer())
    let s = ""
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return {
      hasVideoEncoder: typeof VideoEncoder !== "undefined",
      penMs,
      webm: {
        b64: btoa(s), filename: res.filename, encoderId: res.encoderId, frames: res.frames,
        width: res.width, height: res.height, durationMs: res.durationMs, warnings: res.warnings,
        summary: res.summary, planDrawMs: res.plan.drawDurationMs, planTimebase: res.plan.timebase,
      },
    }
  })
}

await browser.close()

/* ------------------------------------------------------------------ */
/*  Write what came out, then let ffmpeg grade it                     */
/* ------------------------------------------------------------------ */
const write = (name, b64) => {
  const p = join(OUT, name)
  writeFileSync(p, Buffer.from(b64, "base64"))
  return p
}

row(pageErrors.length === 0, "no page errors during the export", pageErrors.slice(0, 2).join(" | ") || "0 errors")
row(results.hasVideoEncoder === true, "WebCodecs VideoEncoder exists in this browser", `hasVideoEncoder=${results.hasVideoEncoder}`)

const webmPath = write(APP_MODE ? "live-app.webm" : "live-synthetic.webm", results.webm.b64)
const w = results.webm

row(w.encoderId === "webm", "the WebM path was actually taken, not the APNG fallback", `encoderId=${w.encoderId} · ${w.summary}`)

{
  const p = probe(webmPath)
  paired(
    "the exported WebM decodes, with exactly the frames the plan asked for",
    () => p.ok && p.frames === w.frames,
    "a truncated copy of the same file must come up short",
    () => {
      const bytes = readFileSync(webmPath)
      const cut = join(TMP, "cut.webm")
      writeFileSync(cut, bytes.subarray(0, Math.floor(bytes.length * 0.5)))
      const q = probe(cut)
      return q.ok && q.frames === w.frames
    },
    `${p.frames}/${w.frames} frames · declared ${p.declared.toFixed(3)}s · ffmpeg clean=${p.ok}${p.ok ? "" : ` (${p.err})`}`,
  )
  paired(
    "the file's declared duration is the plan's duration",
    () => Math.abs(p.declared - w.durationMs / 1000) <= 0.02,
    "the PEN duration and the FIXED 3s default must not be the same number",
    () => Math.abs(w.planDrawMs - 3000) < 1,
    `declared ${p.declared.toFixed(3)}s vs plan ${(w.durationMs / 1000).toFixed(3)}s · draw ${w.planDrawMs.toFixed(0)}ms vs pen ${results.penMs.toFixed(0)}ms`,
  )
  paired(
    "PEN TIMEBASE: the film's draw phase is the drawing's own recorded duration",
    () => Math.abs(w.planDrawMs - results.penMs) < 1 && w.planTimebase === "pen",
    "a fixed-timebase export would not track the pen",
    () => Math.abs(w.planDrawMs - results.penMs) >= 1,
    `${w.planDrawMs.toFixed(1)}ms draw vs ${results.penMs.toFixed(1)}ms recorded`,
  )
}

/* THE MARK ACTUALLY GROWS. A file that decodes and has the right length can
 * still be 128 copies of one frame — which is what a broken seek produces. */
{
  const frames = decodeGray(webmPath, w.width, w.height)
  const means = frames.map(meanOf)
  const first = means[0]
  const last = means[means.length - 1]
  const distinct = new Set(means.map((m) => m.toFixed(3))).size
  paired(
    "the reveal is IN the file: ink grows from the first frame to the last",
    () => distinct > frames.length * 0.5 && Math.abs(last - first) > 0.5,
    "a static export must NOT pass that",
    () => {
      if (APP_MODE) return false // the static arm is synthetic-only
      const sp = write("live-static-control.webm", results.still.b64)
      const sf = decodeGray(sp, results.still.width, results.still.height)
      const sm = sf.map(meanOf)
      const sd = new Set(sm.map((m) => m.toFixed(3))).size
      return sd > sf.length * 0.5 && Math.abs(sm[sm.length - 1] - sm[0]) > 0.5
    },
    `${distinct} distinct frame means of ${frames.length} · mean ${first.toFixed(2)} → ${last.toFixed(2)}`,
  )
}

if (!APP_MODE) {
  const apngPath = write("live-synthetic.png", results.apng.b64)
  const a = results.apng
  const p = probe(apngPath)
  paired(
    "the transparent export is an APNG that decodes, with alpha",
    () => a.encoderId === "apng" && p.ok && p.frames === a.frames,
    "a truncated copy must not decode to the full frame count",
    () => {
      const bytes = readFileSync(apngPath)
      const cut = join(TMP, "cut.png")
      writeFileSync(cut, bytes.subarray(0, Math.floor(bytes.length * 0.5)))
      const q = probe(cut)
      return q.ok && q.frames === a.frames
    },
    `${p.frames}/${a.frames} frames · ${a.width}×${a.height} · ${a.summary}`,
  )
  {
    const raw = execFileSync(FFMPEG, ["-v", "error", "-i", apngPath, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 28 })
    let transparent = 0
    for (let i = 3; i < raw.length; i += 4) if (raw[i] === 0) transparent++
    const frac = transparent / (raw.length / 4)
    paired(
      "the APNG really is transparent where the mark is not",
      () => frac > 0.4,
      "an opaque file would have no fully-clear pixels at all",
      () => frac === 0,
      `${(frac * 100).toFixed(1)}% of pixels have alpha 0`,
    )
  }
}

if (!KEEP) rmSync(TMP, { recursive: true, force: true })
console.log(`\nartefacts → ${OUT}`)
console.log(`assert-export-live${APP_MODE ? " --app" : ""}: ${pass} PASS · ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)

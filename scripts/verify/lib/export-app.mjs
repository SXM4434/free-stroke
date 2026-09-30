// SHARED DRIVING FOR THE EXPORT-FORMAT BROWSER GATES (GIF, transparent WebM,
// animated GLB): open the real app, draw a real stroke with real pointer
// events, press a real export-bar button and catch the file the browser writes.
//
// Kept to what the three gates share. Every gate still owns its rows, its
// counters and its known-bad arms; this file only knows how to reach the app.
import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { createRequire } from "node:module"
import { chromium } from "./browser.mjs"
import { LAB_URL } from "./dev-server.mjs"

const require = createRequire(import.meta.url)
export const FFMPEG = require("ffmpeg-static")

export async function openApp({ tmp }) {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1500 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on("pageerror", (e) => pageErrors.push(String(e)))
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  await page.waitForFunction(
    () => !!window.__revealHarness && !!window.__captureHarness && !!window.__styleHarness,
    null,
    { timeout: 240000 },
  )
  return { browser, page, pageErrors, tmp }
}

/** One arc stroke across the drawing canvas, with the browser's own timing. */
export async function drawArc(page, { steps = 22, stepMs = 22 } = {}) {
  const box = await page.locator('canvas[aria-label*="Drawing canvas"]').boundingBox()
  await page.mouse.move(box.x + box.width * 0.12, box.y + box.height * 0.62)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    await page.mouse.move(box.x + box.width * (0.12 + t * 0.74), box.y + box.height * (0.62 - 0.34 * Math.sin(t * Math.PI)))
    await page.waitForTimeout(stepMs)
  }
  await page.mouse.up()
  await page.waitForTimeout(2500)
  return page.evaluate(() => window.__revealHarness.getTotalDuration())
}

/** Press `locator`, save the download, wait until no export button is counting. */
export async function clickDownload(page, locator, tmp, tag) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 600000 }), locator.click()])
  const name = dl.suggestedFilename()
  const path = join(tmp, `${tag}-${name}`)
  await dl.saveAs(path)
  await page.waitForFunction(
    () => ![...document.querySelectorAll("button")].some((b) => /^\d+%$|^…$|^Saving…$/.test(b.textContent.trim())),
    null,
    { timeout: 300000 },
  )
  await page.waitForTimeout(300)
  return { path, name }
}

/** Open a settings chevron, run `fn`, close it again. */
export async function inPanel(page, ariaLabel, fn) {
  await page.locator(`button[aria-label="${ariaLabel}"]`).click()
  await page.waitForTimeout(150)
  await fn()
  await page.locator(`button[aria-label="${ariaLabel}"]`).click()
  await page.waitForTimeout(150)
}

/** ffmpeg's view of a file: clean decode, frame count, size. */
export function probe(file, extra = []) {
  const clean = spawnSync(FFMPEG, ["-v", "error", ...extra, "-i", file, "-f", "null", "-"], { encoding: "utf8" })
  const loud = spawnSync(FFMPEG, [...extra, "-i", file, "-fps_mode", "passthrough", "-f", "null", "-"], { encoding: "utf8" })
  const text = `${loud.stdout}${loud.stderr}`
  const f = [...text.matchAll(/frame=\s*(\d+)/g)].map((m) => +m[1])
  const size = text.match(/Video:.*?(\d{2,5})x(\d{2,5})/)
  const d = text.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
  return {
    ok: clean.status === 0 && `${clean.stderr}`.trim() === "",
    err: `${clean.stderr}`.trim().split("\n")[0] ?? "",
    frames: f.length ? f[f.length - 1] : 0,
    width: size ? +size[1] : 0,
    height: size ? +size[2] : 0,
    declared: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : NaN,
  }
}

/** Decoded frame `n` (0-based, no rate conversion) as raw pixels. */
export function frameAt(file, n, { pixFmt = "rgba", extra = [] } = {}) {
  const r = spawnSync(
    FFMPEG,
    ["-v", "error", ...extra, "-i", file, "-fps_mode", "passthrough", "-vf", `select=eq(n\\,${n})`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", pixFmt, "-"],
    { maxBuffer: 2 ** 31 - 1 },
  )
  if (r.status !== 0) throw new Error(`ffmpeg could not read frame ${n} of ${file}: ${String(r.stderr).split("\n")[0]}`)
  return r.stdout
}

/**
 * One sha1 per decoded frame, streamed: ffmpeg decodes the file ONCE and each
 * frame is hashed as its bytes arrive, so memory stays one frame whatever the
 * film's length (a per-frame `frameAt` loop decodes the file N times).
 */
export function frameHashes(file, width, height, { pixFmt = "rgba", extra = [] } = {}) {
  const frameBytes = width * height * (pixFmt === "rgba" ? 4 : 3)
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, ["-v", "error", ...extra, "-i", file, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", pixFmt, "-"])
    const hashes = []
    let h = createHash("sha1")
    let filled = 0
    let err = ""
    proc.stdout.on("data", (chunk) => {
      let o = 0
      while (o < chunk.length) {
        const take = Math.min(frameBytes - filled, chunk.length - o)
        h.update(chunk.subarray(o, o + take))
        filled += take
        o += take
        if (filled === frameBytes) {
          hashes.push(h.digest("hex"))
          h = createHash("sha1")
          filled = 0
        }
      }
    })
    proc.stderr.on("data", (c) => (err += String(c)))
    proc.on("error", reject)
    proc.on("close", (code) => (code === 0 ? resolve(hashes) : reject(new Error(`ffmpeg exited ${code}: ${err.slice(0, 200)}`))))
  })
}

/** A still image (PNG) as raw RGBA plus its size. */
export function stillRgba(file) {
  const p = probe(file)
  return { ...p, rgba: frameAt(file, 0) }
}

/**
 * Compare an exported frame against a live reference at the same size,
 * top-left aligned (the recorder trims an odd right/bottom pixel off, never
 * the left or top). Paper is the reference's exact ground colour.
 */
export function compareToLive(live, lw, lh, got, gw, gh, paper) {
  const w = Math.min(lw, gw)
  const h = Math.min(lh, gh)
  let paperWrong = 0
  let paperPx = 0
  let inkErr = 0
  let inkPx = 0
  let maxErr = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = (y * lw + x) * 4
      const b = (y * gw + x) * 4
      const isPaper = live[a] === paper[0] && live[a + 1] === paper[1] && live[a + 2] === paper[2]
      const e = Math.abs(live[a] - got[b]) + Math.abs(live[a + 1] - got[b + 1]) + Math.abs(live[a + 2] - got[b + 2])
      if (isPaper) {
        paperPx++
        if (got[b] !== paper[0] || got[b + 1] !== paper[1] || got[b + 2] !== paper[2]) paperWrong++
      } else {
        inkPx++
        inkErr += e / 3
        if (e / 3 > maxErr) maxErr = e / 3
      }
    }
  }
  return { paperWrong, paperPx, inkPx, inkMean: inkPx ? inkErr / inkPx : 0, maxErr, w, h }
}

/** The panel's plan sentence, e.g. "2.97s at 30 fps, ... · 89 frames". */
export function parsePlanNote(text) {
  const s = text.match(/(\d+(?:\.\d+)?)s at (\d+) fps/)
  const f = text.match(/(\d+) frames/)
  return { seconds: s ? +s[1] : NaN, fps: s ? +s[2] : NaN, frames: f ? +f[1] : NaN }
}

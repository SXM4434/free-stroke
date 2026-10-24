// assert-export-webm-alpha-app.mjs · TRANSPARENT VIDEO, DRIVEN THE WAY A USER DRIVES IT.
//
// The Video panel on Transparent, container WebM (the default), a real stroke,
// the real Video button, the real download. Judged by ffmpeg's libvpx decoder
// (which reads the alpha stream) and by Chrome's own <video> element. "Live"
// is the app's own PNG export at 1x on a transparent ground, taken with the
// playhead parked where the film's first and last frames were rendered.
//
// Rows, each with an arm that MUST fail:
//   count and size   AlphaMode 1, one Block per planned frame each carrying an
//                    alpha frame, at the live frame's size; libvpx decodes all
//                                    | the DISTINCT decoded frames number the plan too
//   see-through      the last frame is mostly alpha 0 with opaque ink in it
//                                    | the same file through ffmpeg's native vp9
//                                      decoder, which ignores the alpha stream
//   first and last   match live: no alpha more than 8 px from the live ink, and
//                    40 dB or better on premultiplied RGBA inside it
//                                    | the last frame against live at mid-draw
//   no veil          nothing is see-through-but-not-quite far from the ink
//                                    | the parked prior, the alpha coded at the colour
//                                      bitrate (window.__fsExportAlphaCoding = "bitrate")
//   Chrome plays it  a <video> of the file draws transparent where the mark is not
//                                    | the same bytes with AlphaMode set to 0
//   fallback         with WebCodecs removed, the same press writes an APNG and
//                    the toast says why | the toast of the WebM run says it too
//   fallback APNG    the downloaded file itself decodes: more than one frame, the
//                    size it claims, transparent pixels in the first and last frame,
//                    and the last frame holds 10x the first frame's opaque ink | the
//                    first frame read as the last shows the finished ink too
//
//   FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-export-webm-alpha-app.mjs [--keep]
//   ... --mutate=apng-one-frame   the must-fail of the fallback APNG row (CL-BROWSERD,
//     2026-10-03). Nothing on disk changes: the fallback page's JS chunks are routed
//     and ApngEncoder.addFrame, found after its own "apng: no 2d context" string,
//     returns early on every frame after the first, so the encoder keeps one frame.
//     A run whose mutant was never applied exits 3 and grades nothing; only an
//     applied mutant can make the row red.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makePaired } from "./lib/paired.mjs"
import { walkWebm } from "./lib/ebml-walk.mjs"
import { openApp, drawArc, openExportPanel, clickDownload, inPanel, probe, frameAt, frameHashes, stillRgba, parsePlanNote } from "./lib/export-app.mjs"

const TMP = mkdtempSync(join(tmpdir(), "fs-webmaapp-"))
const KEEP = process.argv.includes("--keep")
const LIBVPX = ["-c:v", "libvpx-vp9"]
const APNG_IN = ["-f", "apng"]
const MUTATE = (process.argv.find((a) => a.startsWith("--mutate=")) ?? "").slice(9)
if (MUTATE && MUTATE !== "apng-one-frame") {
  console.log(`--mutate=${MUTATE}: not a mutant this gate knows (apng-one-frame)`)
  process.exit(3)
}
let mutantApplied = 0

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
const paired = makePaired(row)

/** Live vs exported, RGBA straight alpha, top-left aligned. */
function matchLive(live, lw, lh, got, gw, gh) {
  const w = Math.min(lw, gw)
  const h = Math.min(lh, gh)
  // Distance field from live ink (alpha > 0), capped at 9 px, by two passes.
  const INF = 1e9
  const dist = new Float64Array(w * h).fill(INF)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (live[(y * lw + x) * 4 + 3] > 0) dist[y * w + x] = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (x > 0) dist[i] = Math.min(dist[i], dist[i - 1] + 1)
      if (y > 0) dist[i] = Math.min(dist[i], dist[i - w] + 1)
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      if (x < w - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1)
      if (y < h - 1) dist[i] = Math.min(dist[i], dist[i + w] + 1)
    }
  let veil = 0
  let se = 0
  let n = 0
  let ink = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = (y * lw + x) * 4
      const b = (y * gw + x) * 4
      const d = dist[y * w + x]
      if (live[a + 3] > 0) ink++
      if (d > 8) {
        if (got[b + 3] !== 0) veil++
        continue
      }
      for (let c = 0; c < 3; c++) {
        const e = (live[a + c] * live[a + 3]) / 255 - (got[b + c] * got[b + 3]) / 255
        se += e * e
      }
      const ea = live[a + 3] - got[b + 3]
      se += ea * ea
      n += 4
    }
  }
  const mse = n ? se / n : 0
  return { veil, psnr: mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse), inkPx: ink, near: n / 4 }
}

const { browser, page, pageErrors } = await openApp({ tmp: TMP })
let fallbackRun = null
try {
  const penMs = await drawArc(page)
  row(penMs > 200, "a real stroke was drawn", `totalDuration=${penMs.toFixed(1)} ms`)
  await openExportPanel(page)

  let note = ""
  let webmChoice = ""
  await inPanel(page, "Video export settings", async () => {
    await page.locator('button:has-text("24")').first().click()
    await page.locator('button:has-text("Transparent")').last().click()
    await page.waitForTimeout(150)
    webmChoice = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "WebM")
      return b ? b.className : ""
    })
    note = await page.locator("text=the time this took you to draw").first().innerText().catch(() => "")
  })
  const plan = parsePlanNote(note)
  console.log(`  panel: ${JSON.stringify(note)}`)
  row(/bg-background/.test(webmChoice), "Transparent offers WebM and APNG, and WebM is the one picked by default", webmChoice ? "WebM button present and selected" : "no WebM button")

  await page.evaluate(() => {
    window.__revealHarness.setEase("linear")
    window.__revealHarness.setPlaying(false)
    window.__revealHarness.setProgress(0.37)
  })
  await page.waitForTimeout(200)
  const videoBtn = page.locator('button[title*="Save the animation"]')
  const vid = await clickDownload(page, videoBtn, TMP, "alpha")
  const toastWebm = await page.locator("[data-sonner-toast]").last().innerText().catch(() => "")
  console.log(`  file: ${vid.name}`)
  row(/_anim_.*\.webm$/.test(vid.name), "the file follows the app's naming law and is a .webm", vid.name)
  const bytes = readFileSync(vid.path)
  const walk = walkWebm(bytes)
  const pr = probe(vid.path, LIBVPX)

  /* The parked prior: the alpha stream coded at the colour bitrate. */
  await page.evaluate(() => {
    window.__fsExportAlphaCoding = "bitrate"
  })
  const lossy = await clickDownload(page, videoBtn, TMP, "alpha-bitrate")
  await page.evaluate(() => {
    delete window.__fsExportAlphaCoding
  })

  /* ---- live references: the PNG export at 1x, transparent ------------- */
  await inPanel(page, "PNG export settings", async () => {
    await page.locator('button:has-text("1×")').first().click()
    await page.getByRole("button", { name: "Transparent", exact: true }).click()
  })
  const pngBtn = page.locator("button", { hasText: /^PNG$/ })
  const liveAt = async (p, tag) => {
    await page.evaluate((v) => window.__revealHarness.setProgress(v), p)
    await page.waitForTimeout(400)
    const f = await clickDownload(page, pngBtn, TMP, tag)
    return stillRgba(f.path)
  }
  const liveFirst = await liveAt(0, "live-first")
  const liveLast = await liveAt(1, "live-last")
  const liveMid = await liveAt(0.5, "live-mid")

  /* ---- count and size ------------------------------------------------- */
  {
    const wantW = liveLast.width - (liveLast.width % 2)
    const wantH = liveLast.height - (liveLast.height % 2)
    const hashes = new Set(await frameHashes(vid.path, walk.width, walk.height, { extra: LIBVPX }))
    paired(
      "AlphaMode 1, one Block per planned frame each with its alpha frame, at the live size, and libvpx decodes every one",
      () =>
        walk.alphaMode === 1 &&
        walk.frames.length === plan.frames &&
        walk.frames.every((f) => f.additional && f.additional.length > 0) &&
        walk.width === wantW &&
        walk.height === wantH &&
        pr.ok &&
        pr.frames === plan.frames,
      "the DISTINCT decoded frames number the plan too (a coalescing writer's count)",
      () => hashes.size === plan.frames,
      `plan ${plan.frames} · blocks ${walk.frames.length}, ${walk.frames.filter((f) => f.additional).length} with alpha · alphaMode ${walk.alphaMode} · ${walk.width}x${walk.height} vs live even ${wantW}x${wantH} · libvpx ${pr.frames} frames clean=${pr.ok} ${pr.err} · distinct ${hashes.size} · ${bytes.length} bytes`,
    )
  }

  /* ---- see-through ---------------------------------------------------- */
  const gLast = frameAt(vid.path, walk.frames.length - 1, { extra: LIBVPX })
  {
    const native = frameAt(vid.path, walk.frames.length - 1)
    const stats = (px) => {
      let z = 0
      let full = 0
      for (let i = 3; i < px.length; i += 4) {
        if (px[i] === 0) z++
        if (px[i] === 255) full++
      }
      return { zero: z / (px.length / 4), full }
    }
    const s = stats(gLast)
    const n = stats(native)
    paired(
      "the last frame is see-through where the mark is not, with opaque ink in it",
      () => s.zero > 0.5 && s.full > 0,
      "the same file through ffmpeg's native vp9 decoder (which ignores the alpha stream) is see-through too",
      () => n.zero > 0.5 && n.full > 0,
      `libvpx: ${(s.zero * 100).toFixed(1)}% alpha 0, ${s.full} px opaque · native: ${(n.zero * 100).toFixed(1)}% alpha 0`,
    )
  }

  /* ---- first and last match live -------------------------------------- */
  {
    const g0 = frameAt(vid.path, 0, { extra: LIBVPX })
    const m0 = matchLive(liveFirst.rgba, liveFirst.width, liveFirst.height, g0, walk.width, walk.height)
    const mN = matchLive(liveLast.rgba, liveLast.width, liveLast.height, gLast, walk.width, walk.height)
    const mM = matchLive(liveMid.rgba, liveMid.width, liveMid.height, gLast, walk.width, walk.height)
    const good = (m) => m.veil === 0 && m.psnr >= 40
    const fmt = (m) => `veil ${m.veil} px, ${m.psnr === Infinity ? "exact" : `${m.psnr.toFixed(2)} dB`} over ${m.near} px near ${m.inkPx} live ink px`
    paired(
      "first and last frames match live: no alpha more than 8 px from the live ink, 40 dB or better near it",
      () => good(m0) && good(mN) && mN.inkPx > 0,
      "the last frame matches live at mid-draw as well",
      () => good(mM),
      `first: ${fmt(m0)} · last: ${fmt(mN)} · last vs mid: ${fmt(mM)}`,
    )
    const lw = walkWebm(readFileSync(lossy.path))
    const l0 = matchLive(liveFirst.rgba, liveFirst.width, liveFirst.height, frameAt(lossy.path, 0, { extra: LIBVPX }), lw.width, lw.height)
    const lN = matchLive(liveLast.rgba, liveLast.width, liveLast.height, frameAt(lossy.path, lw.frames.length - 1, { extra: LIBVPX }), lw.width, lw.height)
    paired(
      "no veil: the lossless alpha stream is exactly 0 away from the ink on the first and last frames",
      () => m0.veil === 0 && mN.veil === 0,
      "the parked prior, alpha coded at the colour bitrate, is veil-free too",
      () => l0.veil === 0 && lN.veil === 0,
      `lossless: ${m0.veil} and ${mN.veil} px · bitrate-coded alpha (${lossy.name}, ${readFileSync(lossy.path).length} bytes vs ${bytes.length}): ${l0.veil} and ${lN.veil} px`,
    )
  }

  /* ---- Chrome plays it with alpha ------------------------------------- */
  {
    const noAlpha = Buffer.from(bytes)
    const at = noAlpha.indexOf(Buffer.from([0x53, 0xc0, 0x81, 0x01]))
    if (at >= 0) noAlpha[at + 3] = 0
    const inChrome = async (buf) =>
      page.evaluate(async (b64) => {
        const bin = atob(b64)
        const u8 = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
        const url = URL.createObjectURL(new Blob([u8], { type: "video/webm" }))
        const v = document.createElement("video")
        v.muted = true
        v.src = url
        await new Promise((r, j) => {
          v.onloadeddata = r
          v.onerror = () => j(new Error("video error " + (v.error && v.error.code)))
        })
        v.currentTime = Math.max(0, v.duration - 0.05)
        await new Promise((r) => (v.onseeked = r))
        const c = document.createElement("canvas")
        c.width = v.videoWidth
        c.height = v.videoHeight
        const x = c.getContext("2d")
        x.drawImage(v, 0, 0)
        const d = x.getImageData(0, 0, c.width, c.height).data
        let z = 0
        let full = 0
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] === 0) z++
          if (d[i] === 255) full++
        }
        URL.revokeObjectURL(url)
        return { zero: z / (d.length / 4), full, w: c.width, h: c.height }
      }, buf.toString("base64"))
    let real = null
    let ctrl = null
    try {
      real = await inChrome(bytes)
      ctrl = await inChrome(noAlpha)
    } catch (e) {
      real = real ?? { error: e.message }
      ctrl = ctrl ?? { error: e.message }
    }
    paired(
      "Chrome's own <video> plays the file see-through where the mark is not",
      () => !!real && !real.error && real.zero > 0.5 && real.full > 0,
      "the same bytes with AlphaMode set to 0 play see-through too",
      () => !!ctrl && !ctrl.error && ctrl.zero > 0.5,
      `played ${real && !real.error ? `${real.w}x${real.h}, ${(real.zero * 100).toFixed(1)}% alpha 0` : JSON.stringify(real)} · AlphaMode 0: ${ctrl && !ctrl.error ? `${(ctrl.zero * 100).toFixed(1)}% alpha 0` : JSON.stringify(ctrl)} (patched at byte ${at})`,
    )
  }

  /* ---- the fallback, in a page with no WebCodecs ---------------------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1500 }, deviceScaleFactor: 1, acceptDownloads: true })
    await ctx.addInitScript(() => {
      delete window.VideoEncoder
      delete window.VideoFrame
    })
    if (MUTATE === "apng-one-frame") {
      await ctx.route("**/_next/static/**/*.js*", async (route) => {
        const res = await route.fetch()
        let body = await res.text()
        const at = body.indexOf("apng: no 2d context")
        const k = at >= 0 ? body.indexOf("await this.writer.addFrame(", at) : -1
        if (k >= 0) {
          body = body.slice(0, k) + "if (this.__oneFrame) return; this.__oneFrame = true; " + body.slice(k)
          mutantApplied++
        }
        await route.fulfill({ response: res, body })
      })
    }
    const p2 = await ctx.newPage()
    await p2.goto(page.url(), { waitUntil: "domcontentloaded", timeout: 180000 })
    await p2.waitForFunction(() => !!window.__revealHarness && !!window.__styleHarness, null, { timeout: 240000 })
    const hasVE = await p2.evaluate(() => typeof window.VideoEncoder)
    await drawArc(p2, { steps: 10 })
    await openExportPanel(p2)
    await inPanel(p2, "Video export settings", async () => {
      await p2.locator('button:has-text("24")').first().click()
      await p2.locator('button:has-text("Transparent")').last().click()
    })
    const f = await clickDownload(p2, p2.locator('button[title*="Save the animation"]'), TMP, "fallback")
    const toast = await p2.locator("[data-sonner-toast]").last().innerText().catch(() => "")
    fallbackRun = { name: f.name, toast, hasVE }
    const said = (t) => /cannot encode WebM video/.test(t)
    paired(
      "with WebCodecs removed, Transparent + WebM writes an animated PNG and the toast says why",
      () => hasVE === "undefined" && /_anim_.*\.png$/.test(f.name) && said(toast),
      "the toast of the WebM run says the same",
      () => said(toastWebm),
      `VideoEncoder ${hasVE} · ${f.name} · toast: ${JSON.stringify(toast.replace(/\s+/g, " ").slice(0, 220))}`,
    )
    // THE FALLBACK FILE ITSELF (cx-exportgaps, written for a browser lane; run by CL-BROWSERD).
    // The row above reads the name and the toast, and both stay right when the encoder writes one
    // frame. This one decodes the downloaded bytes (f.path, never the name), with the apng demuxer
    // forced so ffmpeg cannot read the file as one still PNG.
    let apng = null, first = null, last = null, decodeErr = null
    try {
      apng = probe(f.path, APNG_IN)
      first = frameAt(f.path, 0, { extra: APNG_IN })
      last = frameAt(f.path, Math.max(0, apng.frames - 1), { extra: APNG_IN })
    } catch (e) {
      decodeErr = e
    }
    const alpha = (rgba, value) => {
      let count = 0
      for (let i = 3; i < rgba.length; i += 4) if (rgba[i] === value) count++
      return count
    }
    // FINISHED INK, NOT ANY INK. The handoff's control asked only for an opaque pixel, and the first
    // frame of the real download already carries the pen's first touch (33 opaque px against 7138 on
    // the last, CL-BROWSERD 2026-10-03), so that control fired and the row could not pass. The end
    // frame must hold opaque ink at least ten times the first frame's: the draw-in grows the mark, and
    // a file that ends where it started does not.
    const finished = (end, start) => alpha(end, 255) > 0 && alpha(end, 255) >= 10 * alpha(start, 255)
    paired(
      "fallback APNG decodes into multiple transparent frames and ends with visible ink",
      () => {
        if (decodeErr) throw decodeErr
        return apng.ok && apng.frames > 1 && apng.width > 0 && apng.height > 0 &&
          first.length === apng.width * apng.height * 4 && last.length === first.length &&
          alpha(first, 0) > 0 && alpha(last, 0) > 0 && finished(last, first) &&
          !first.equals(last)
      },
      "using the first frame as the last shows the finished ink too",
      () => {
        if (decodeErr) throw decodeErr
        return finished(first, first)
      },
      apng
        ? `${apng.frames} decoded frames at ${apng.width}x${apng.height}, clean=${apng.ok}${apng.err ? ` (${apng.err})` : ""}; transparent px first ${first ? alpha(first, 0) : "?"}, last ${last ? alpha(last, 0) : "?"}; opaque px first ${first ? alpha(first, 255) : "?"}, last ${last ? alpha(last, 255) : "?"}`
        : `not decoded: ${decodeErr?.message}`,
    )
    await ctx.close()
  }

  row(pageErrors.length === 0, "no page errors", pageErrors.slice(0, 2).join(" | ") || "0 errors")
} finally {
  await browser.close()
  if (!KEEP) rmSync(TMP, { recursive: true, force: true })
  else console.log(`kept ${TMP}`)
}
if (MUTATE) {
  console.log(`mutant ${MUTATE}: applied in ${mutantApplied} served chunk(s)`)
  if (!mutantApplied) {
    console.log(`MUTANT NOT APPLIED: no served chunk carried ApngEncoder.addFrame after "apng: no 2d context"; nothing is graded`)
    process.exit(3)
  }
}
console.log(`\nassert-export-webm-alpha-app: ${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)

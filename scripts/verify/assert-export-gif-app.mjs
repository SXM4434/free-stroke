// assert-export-gif-app.mjs · THE GIF BUTTON, DRIVEN THE WAY A USER DRIVES IT.
//
// `assert-export-gif.mjs` proves the writer and the palette in node. This
// proves the wiring: a real stroke drawn with real pointer events, the GIF
// button in the real export bar, the real download, and ffmpeg's opinion of
// it. "Live" is the app's own PNG export at the same scale, taken with the
// playhead parked where the GIF's first and last frames were rendered.
//
// Rows, each with an arm that MUST fail:
//   the bar carries GIF between Video and GLB
//   decodes            ffmpeg decodes the download | the same file cut short
//   count and size     one frame per planned frame, the live frame's size
//                                        | the number of DISTINCT frames (a coalescing
//                                          writer's count) equals the plan's too
//   first and last     match live: paper exact, ink within 2 levels on average
//                                        | the last frame against live at mid-draw
//   timing             delays sum to the panel's duration to the centisecond
//                                        | the same frames at whole-gap rounding
//
//   FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-export-gif-app.mjs [--keep]
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makePaired } from "./lib/paired.mjs"
import { parseGif } from "./lib/gif-walk.mjs"
import { openApp, drawArc, clickDownload, inPanel, probe, frameAt, frameHashes, stillRgba, compareToLive, parsePlanNote } from "./lib/export-app.mjs"

const TMP = mkdtempSync(join(tmpdir(), "fs-gifapp-"))
const KEEP = process.argv.includes("--keep")
const PAPER = [0xfa, 0xfa, 0xfa]

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
const paired = makePaired(row)

const { browser, page, pageErrors } = await openApp({ tmp: TMP })
try {
  const penMs = await drawArc(page)
  row(penMs > 200, "a real stroke was drawn", `totalDuration=${penMs.toFixed(1)} ms`)

  /* ---- where the button sits ---------------------------------------- */
  const order = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("button")].map((b) => b.textContent.trim())
    return ["PNG", "Video", "GIF", "GLB"].map((l) => labels.indexOf(l))
  })
  row(
    order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2] && order[2] < order[3],
    "the export bar carries GIF between Video and GLB, no new panel",
    `button order PNG ${order[0]} · Video ${order[1]} · GIF ${order[2]} · GLB ${order[3]}`,
  )
  const gifBtn = page.locator('button[title^="Save a GIF of the animation"]')

  /* 24 fps keeps the film short; the panel's sentence is the plan the GIF gets. */
  let note = ""
  await inPanel(page, "Video export settings", async () => {
    await page.locator('button:has-text("24")').first().click()
    await page.waitForTimeout(150)
    note = await page.locator("text=the time this took you to draw").first().innerText().catch(() => "")
  })
  const plan = parsePlanNote(note)
  console.log(`  panel: ${JSON.stringify(note)}`)

  /* ---- the export ----------------------------------------------------- */
  await page.evaluate(() => {
    window.__revealHarness.setEase("linear")
    window.__revealHarness.setPlaying(false)
    window.__revealHarness.setProgress(0.37)
  })
  await page.waitForTimeout(200)
  const gif = await clickDownload(page, gifBtn, TMP, "gif")
  console.log(`  GIF: ${gif.name}`)
  row(/_anim_.*\.gif$/.test(gif.name), "the file follows the app's naming law and is a .gif", gif.name)
  const bytes = readFileSync(gif.path)
  const walk = parseGif(bytes)
  const pr = probe(gif.path)

  /* ---- live references: the app's own PNG export at 1x ---------------- */
  await inPanel(page, "PNG export settings", async () => {
    await page.locator('button:has-text("1×")').first().click()
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

  /* ---- decodes -------------------------------------------------------- */
  {
    const cut = join(TMP, "cut.gif")
    writeFileSync(cut, bytes.subarray(0, Math.floor(bytes.length * 0.6)))
    const pc = probe(cut)
    paired(
      "ffmpeg decodes the downloaded GIF cleanly",
      () => pr.ok && pr.frames > 0,
      "the same file cut to 60% of its bytes decodes cleanly to every frame",
      () => pc.ok && pc.frames === pr.frames,
      `${pr.frames} frames · ${pr.width}x${pr.height} · ${bytes.length} bytes · cut copy: ok=${pc.ok} frames=${pc.frames}`,
    )
  }

  /* ---- count and size ------------------------------------------------- */
  {
    const hashes = new Set(await frameHashes(gif.path, walk.width, walk.height))
    const wantW = liveLast.width - (liveLast.width % 2)
    const wantH = liveLast.height - (liveLast.height % 2)
    paired(
      "one GIF frame per planned frame (walker and ffmpeg agree), at the live frame's size",
      () => walk.frames === plan.frames && pr.frames === plan.frames && walk.width === wantW && walk.height === wantH,
      "a coalescing writer's count, the DISTINCT frames, equals the plan's too",
      () => hashes.size === plan.frames,
      `plan ${plan.frames} · walker ${walk.frames} · ffmpeg ${pr.frames} · ${walk.width}x${walk.height} vs live ${liveLast.width}x${liveLast.height} (even ${wantW}x${wantH}) · distinct ${hashes.size}`,
    )
  }

  /* ---- first and last match live -------------------------------------- */
  {
    const g0 = frameAt(gif.path, 0)
    const gN = frameAt(gif.path, walk.frames - 1)
    const c0 = compareToLive(liveFirst.rgba, liveFirst.width, liveFirst.height, g0, walk.width, walk.height, PAPER)
    const cN = compareToLive(liveLast.rgba, liveLast.width, liveLast.height, gN, walk.width, walk.height, PAPER)
    const cM = compareToLive(liveMid.rgba, liveMid.width, liveMid.height, gN, walk.width, walk.height, PAPER)
    const good = (c) => c.paperWrong === 0 && c.inkMean <= 2
    const fmt = (c) => `paper wrong ${c.paperWrong}/${c.paperPx}, ink mean ${c.inkMean.toFixed(3)} (max ${c.maxErr.toFixed(0)}) over ${c.inkPx} px`
    paired(
      "first and last GIF frames match live: paper exact, ink within 2 levels on average",
      () => good(c0) && good(cN) && cN.inkPx > 0,
      "the last GIF frame matches live at mid-draw as well",
      () => good(cM),
      `first: ${fmt(c0)} · last: ${fmt(cN)} · last vs mid: ${fmt(cM)}`,
    )
  }

  /* ---- timing ---------------------------------------------------------- */
  {
    const total = walk.delays.reduce((a, b) => a + b, 0)
    const want = Math.round(plan.seconds * 100)
    const gapRounded = walk.frames * Math.round(100 / plan.fps)
    paired(
      "the GIF's delays sum to the panel's duration to the centisecond, none under 2 cs",
      () => Math.abs(total - want) <= 1 && walk.delays.every((d) => d >= 2),
      "the same frames at whole-gap rounding land on it too",
      () => Math.abs(gapRounded - want) <= 1,
      `file ${total} cs · panel ${plan.seconds}s = ${want} cs · pattern ${[...new Set(walk.delays)].join("/")} cs · gap-rounded ${gapRounded} cs`,
    )
    row(walk.loops === 0, "the GIF loops forever", `NETSCAPE2.0 loops=${walk.loops}`)
  }

  /* ---- the transport is where it was ---------------------------------- */
  row(pageErrors.length === 0, "no page errors", pageErrors.slice(0, 2).join(" | ") || "0 errors")
} finally {
  await browser.close()
  if (!KEEP) rmSync(TMP, { recursive: true, force: true })
  else console.log(`kept ${TMP}`)
}
console.log(`\nassert-export-gif-app: ${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)

#!/usr/bin/env node
/* ============================================================================
 * assert-export-formats: the three export formats of coverage rows 92, 94 and
 * 96 (`docs/research-2026-09-26/animation-asks-coverage.md`), built from a
 * fixed frame list and decoded. Node only, no browser.
 *
 *   node scripts/verify/assert-export-formats.mjs              rows, then every must-fail
 *   node scripts/verify/assert-export-formats.mjs --rows-only  rows only (a mutant child runs this)
 *
 * THE FRAME LIST. One `planFrames` plan (lib/export/frame-plan.ts, the plan the
 * app's Video button uses) and a synthetic draw-in rendered at each planned
 * clock: a pen line on #fafafa paper, anti-aliased, written left to right. The
 * source frames are pixels this script made, so "the file matches the source"
 * has an answer that does not depend on the app.
 *
 * WHAT EACH SECTION READS.
 *   G · GIF        lib/export/gif.ts. Header and frames parsed by this script,
 *                  pixels decoded by ffmpeg.
 *
 * WHAT IT DOES NOT READ. The viewport, the browser's encoders, the export
 * panel. `assert-export-app.mjs` is the browser gate for the button.
 *
 * MUST-FAILS. One-line sabotages of the format modules, applied by
 * `_ts-load.mjs` through GATE_MUTATE_FILE (nothing on disk changes). A mutant
 * counts as caught only when the child ran to completion AND every named row
 * went red. Every row must be named by at least one mutant.
 * ========================================================================== */
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")
const require = createRequire(import.meta.url)

/* ffmpeg-static's binary is fetched by its postinstall, which a frozen pnpm
 * install can skip. The system ffmpeg is the same judge when it is there. */
const FFMPEG = (() => {
  try {
    const p = require("ffmpeg-static")
    if (p && existsSync(p)) return p
  } catch {}
  return "ffmpeg"
})()

const rows = []
function row(id, ok, what, detail) {
  rows.push({ id, ok: !!ok, what, detail })
}
async function check(id, what, fn) {
  try {
    await fn()
  } catch (e) {
    row(id, false, what, `threw: ${e && e.message}`)
  }
}

const DIR = mkdtempSync(join(tmpdir(), "fs-export-formats-"))

/* ---- the fixed frame list ---------------------------------------------- */

const PAPER = [0xfa, 0xfa, 0xfa]
const W = 96
const H = 64
const { planFrames } = loadTs("lib/export/frame-plan.ts")
/* 800 ms at 30 fps with a 100 ms hold: 28 frames, the first at clock 0 (empty
 * paper) and the last three held at clock 1 (the finished mark). */
const PLAN = planFrames({ penDurationMs: 800, fps: 30, timebase: "pen", holdMs: 100 })

/** The pen line at `clock`: y = a sine across the frame, written left to right. */
const penY = (x) => H / 2 + Math.sin((x / W) * Math.PI * 2) * (H * 0.28)

/**
 * One source frame. `rich` gives the ink a hue ramp along its length, so the
 * frame has far more than 256 colours and the palette has to quantise; flat
 * ink has few enough colours to be kept exact. `alpha` leaves the paper out.
 */
function sourceFrame(clock, { rich = false, alpha = false } = {}) {
  const rgba = new Uint8Array(W * H * 4)
  const reach = clock * (W - 8) + 4
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4
      let cover = 0
      if (clock > 0 && x <= reach) {
        const d = Math.abs(y - penY(x))
        cover = Math.max(0, Math.min(1, 3.2 - d))
      }
      const ink = rich ? [Math.round(20 + (x / W) * 200), Math.round(30 + (y / H) * 120), 90] : [24, 24, 28]
      /* THE CONTACT SHADOW, on the rich frame only: a broad gaussian under the
       * mark, 10 levels deep at its core, whose long tail sits 1 and 2 levels
       * under the paper across much of the frame. So the paper shares its 5-bit
       * colour bin with a crowd of near-paper greys, which is the case where a
       * palette with no exact paper entry drifts the whole ground. */
      const shade = rich ? Math.round(10 * Math.exp(-((y - H * 0.85) ** 2) / (2 * 16 ** 2))) : 0
      const ground = PAPER.map((c) => c - shade)
      if (alpha) {
        const a = Math.round(cover * 255)
        rgba.set(a ? [...ink, a] : [0, 0, 0, 0], o)
      } else {
        rgba[o] = Math.round(ground[0] * (1 - cover) + ink[0] * cover)
        rgba[o + 1] = Math.round(ground[1] * (1 - cover) + ink[1] * cover)
        rgba[o + 2] = Math.round(ground[2] * (1 - cover) + ink[2] * cover)
        rgba[o + 3] = 255
      }
    }
  }
  return rgba
}

const framesOf = (opts) => PLAN.frames.map((f) => sourceFrame(f.clock, opts))

/* ---- ffmpeg ----------------------------------------------------------- */

function decodeRgba(file, extra = []) {
  const r = spawnSync(FFMPEG, ["-v", "error", ...extra, "-i", file, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], {
    maxBuffer: 1 << 28,
  })
  if (r.status !== 0) throw new Error(`ffmpeg refused ${file}: ${String(r.stderr).trim().split("\n")[0]}`)
  const buf = r.stdout
  const n = W * H * 4
  const out = []
  for (let o = 0; o + n <= buf.length; o += n) out.push(new Uint8Array(buf.buffer, buf.byteOffset + o, n))
  return { frames: out, rest: buf.length % n }
}

function compare(a, b) {
  let diff = 0
  let maxErr = 0
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const e = Math.abs(a[i] - b[i])
    if (e) diff++
    if (e > maxErr) maxErr = e
    sum += e
  }
  return { diff, maxErr, mean: sum / a.length }
}

/** Source paper pixels that did not come back as exactly the paper. */
function paperSpeckle(src, got) {
  let bad = 0
  for (let o = 0; o < src.length; o += 4) {
    if (src[o] === PAPER[0] && src[o + 1] === PAPER[1] && src[o + 2] === PAPER[2]) {
      if (got[o] !== PAPER[0] || got[o + 1] !== PAPER[1] || got[o + 2] !== PAPER[2]) bad++
    }
  }
  return bad
}

/* ---- G · GIF ------------------------------------------------------------ */

/** A GIF parsed by hand: screen size, loop extension, one entry per image. */
function parseGif(bytes) {
  const sig = String.fromCharCode(...bytes.subarray(0, 6))
  const width = bytes[6] | (bytes[7] << 8)
  const height = bytes[8] | (bytes[9] << 8)
  let o = 13
  if (bytes[10] & 0x80) o += 3 * (1 << ((bytes[10] & 7) + 1))
  const images = []
  let loop = null
  let gce = null
  const skipBlocks = () => {
    while (bytes[o] !== 0) o += bytes[o] + 1
    o++
  }
  for (;;) {
    const b = bytes[o++]
    if (b === 0x3b) break
    if (b === 0x21) {
      const label = bytes[o++]
      if (label === 0xf9) {
        gce = { disposal: (bytes[o + 1] >> 2) & 7, transparent: bytes[o + 1] & 1, delayCs: bytes[o + 2] | (bytes[o + 3] << 8) }
        o += bytes[o] + 1
        skipBlocks()
      } else if (label === 0xff) {
        const app = String.fromCharCode(...bytes.subarray(o + 1, o + 12))
        o += bytes[o] + 1
        if (app === "NETSCAPE2.0") loop = bytes[o + 2] | (bytes[o + 3] << 8)
        skipBlocks()
      } else {
        o += bytes[o] + 1
        skipBlocks()
      }
    } else if (b === 0x2c) {
      const iw = bytes[o + 4] | (bytes[o + 5] << 8)
      const ih = bytes[o + 6] | (bytes[o + 7] << 8)
      const packed = bytes[o + 8]
      o += 9
      if (packed & 0x80) o += 3 * (1 << ((packed & 7) + 1))
      o++ // LZW minimum code size
      skipBlocks()
      images.push({ width: iw, height: ih, ...(gce ?? { disposal: 0, transparent: 0, delayCs: 0 }) })
      gce = null
    } else {
      throw new Error(`gif: unexpected byte 0x${b?.toString(16)} at ${o - 1}`)
    }
    if (o > bytes.length) throw new Error("gif: ran past the end")
  }
  return { sig, width, height, loop, images }
}

async function sectionGif() {
  const { GifWriter } = loadTs("lib/export/gif.ts")
  const write = (frames, opts, name) => {
    const w = new GifWriter({ width: W, height: H, loops: 0, ...opts })
    for (const f of frames) w.addFrame({ rgba: f, delayMs: PLAN.frameIntervalMs })
    const bytes = w.finish()
    const file = join(DIR, name)
    writeFileSync(file, bytes)
    return { file, bytes, writer: w }
  }
  const flat = framesOf({})
  const rich = framesOf({ rich: true })
  const gFlat = write(flat, { reserve: ["#fafafa"] }, "flat.gif")
  const gRich = write(rich, { reserve: ["#fafafa"] }, "rich.gif")

  await check("GIF-HEAD", "the GIF's own header: GIF89a, the frame size, loops forever, one image per planned frame", () => {
    const g = parseGif(gFlat.bytes)
    const ok =
      g.sig === "GIF89a" &&
      g.width === W &&
      g.height === H &&
      g.loop === 0 &&
      g.images.length === PLAN.frames.length &&
      g.images.every((im) => im.width === W && im.height === H)
    row("GIF-HEAD", ok, "the GIF's own header: GIF89a, the frame size, loops forever, one image per planned frame",
      `${g.sig} ${g.width}x${g.height} loop ${g.loop} · ${g.images.length} images, plan ${PLAN.frames.length}`)
  })

  await check("GIF-DECODE", "ffmpeg decodes the GIF to the planned frame count at the source size", () => {
    const d = decodeRgba(gFlat.file)
    row("GIF-DECODE", d.frames.length === PLAN.frames.length && d.rest === 0,
      "ffmpeg decodes the GIF to the planned frame count at the source size",
      `${d.frames.length} frames of ${W}x${H} (leftover bytes ${d.rest}), plan ${PLAN.frames.length}`)
  })

  await check("GIF-ENDS", "first and last frames match the source: exact for flat ink, paper exact and ink close for a >256-colour mark", () => {
    const df = decodeRgba(gFlat.file).frames
    const dr = decodeRgba(gRich.file).frames
    const n = PLAN.frames.length - 1
    const f0 = compare(flat[0], df[0])
    const fN = compare(flat[n], df[n])
    const r0 = compare(rich[0], dr[0])
    const rN = compare(rich[n], dr[n])
    const speck = paperSpeckle(rich[n], dr[n])
    const ok = df.length === PLAN.frames.length && f0.diff === 0 && fN.diff === 0 && r0.diff === 0 && rN.mean < 1.5 && rN.maxErr <= 40 && speck === 0
    row("GIF-ENDS", ok, "first and last frames match the source: exact for flat ink, paper exact and ink close for a >256-colour mark",
      `flat first ${f0.diff} / last ${fN.diff} bytes off · rich first ${r0.diff} off, last mean ${rN.mean.toFixed(3)} max ${rN.maxErr}, paper off ${speck}`)
  })

  await check("GIF-PAPER", "no speckle: every paper pixel in every frame comes back exactly #fafafa", () => {
    const dr = decodeRgba(gRich.file).frames
    let bad = 0
    let paper = 0
    for (let i = 0; i < rich.length; i++) {
      bad += paperSpeckle(rich[i], dr[i] ?? new Uint8Array(W * H * 4))
      for (let o = 0; o < rich[i].length; o += 4) if (rich[i][o] === 0xfa && rich[i][o + 1] === 0xfa && rich[i][o + 2] === 0xfa) paper++
    }
    row("GIF-PAPER", bad === 0 && dr.length === rich.length, "no speckle: every paper pixel in every frame comes back exactly #fafafa",
      `${bad} of ${paper} paper pixels off across ${dr.length} frames`)
  })

  await check("GIF-TIME", "delays sum to the plan's duration within 10 ms, none under 2 cs", () => {
    const g = parseGif(gFlat.bytes)
    const total = g.images.reduce((s, im) => s + im.delayCs * 10, 0)
    const min = Math.min(...g.images.map((im) => im.delayCs))
    row("GIF-TIME", Math.abs(total - PLAN.durationMs) <= 10 && min >= 2, "delays sum to the plan's duration within 10 ms, none under 2 cs",
      `${total} ms of delays, plan ${PLAN.durationMs.toFixed(1)} ms, shortest ${min} cs, pattern ${g.images.slice(0, 6).map((im) => im.delayCs).join(",")}`)
  })

  await check("GIF-ALPHA", "transparent GIF: see-through where the source is, ink where it is, in every frame, with a moving mark", () => {
    /* A dot that TRAVELS, so a frame that keeps the previous one under its
     * see-through pixels (the wrong disposal) leaves a trail that shows. */
    const travel = PLAN.frames.map((f) => {
      const rgba = new Uint8Array(W * H * 4)
      const cx = 6 + f.clock * (W - 12)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if ((x - cx) ** 2 + (y - H / 2) ** 2 <= 25) rgba.set([24, 24, 28, 255], (y * W + x) * 4)
      }
      return rgba
    })
    const g = write(travel, { transparent: true }, "alpha.gif")
    const d = decodeRgba(g.file).frames
    let off = 0
    for (let i = 0; i < travel.length; i++) {
      const got = d[i]
      if (!got) { off += W * H; continue }
      for (let o = 0; o < got.length; o += 4) if ((got[o + 3] >= 128) !== (travel[i][o + 3] >= 128)) off++
    }
    const head = parseGif(g.bytes)
    row("GIF-ALPHA", off === 0 && d.length === travel.length && head.images.every((im) => im.transparent === 1 && im.disposal === 2),
      "transparent GIF: see-through where the source is, ink where it is, in every frame, with a moving mark",
      `${off} pixels with the wrong coverage across ${d.length} frames · disposal ${[...new Set(head.images.map((im) => im.disposal))].join(",")}`)
  })
}

/* ---- the must-fails ----------------------------------------------------- */

const MUTANTS = [
  {
    name: "GIF: the paper and the frequent colours lose their exact entries",
    file: "lib/export/gif.ts",
    find: "if (key !== null && census.has(key)) keep(key)",
    text: "if (false) keep(key)",
    also: { find: "for (const [key] of frequent.slice(0, EXACT_MAX)) keep(key)", text: "for (const [key] of frequent.slice(0, 0)) keep(key)" },
    red: ["GIF-PAPER", "GIF-ENDS"],
  },
  {
    name: "GIF: delays rounded frame by frame, not on the running clock",
    file: "lib/export/gif.ts",
    find: "let cs = Math.round(this.elapsedMs / 10) - start",
    text: "let cs = Math.round(frame.delayMs / 10)",
    red: ["GIF-TIME"],
  },
  {
    name: "GIF: the first frame is dropped when the file is written",
    file: "lib/export/gif.ts",
    find: "for (const p of this.parts) n += p.length",
    text: "for (const p of this.parts.slice(1)) n += p.length",
    also: { find: "    for (const p of this.parts) {\n      out.set(p, o)", text: "    for (const p of this.parts.slice(1)) {\n      out.set(p, o)" },
    red: ["GIF-HEAD", "GIF-DECODE"],
  },
  {
    name: "GIF: LZW widens its codes one entry late",
    file: "lib/export/gif.ts",
    find: "if (next > 1 << width && width < 12) width++",
    text: "if (next > (1 << width) + 1 && width < 12) width++",
    red: ["GIF-ENDS"],
  },
  {
    name: "GIF: transparent frames keep the previous frame under them",
    file: "lib/export/gif.ts",
    find: "const disposal = transparent ? 2 : 1",
    text: "const disposal = 1",
    red: ["GIF-ALPHA"],
  },
]

function editFor(src, file, find, text) {
  const at = src.indexOf(find)
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`mutant text not unique in ${file}: ${JSON.stringify(find)}`)
  return { pos: at, end: at + find.length, text, was: find }
}

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-export-formats-mut-"))
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const src = readFileSync(join(ROOT, m.file), "utf8")
      const edits = [editFor(src, m.file, m.find, m.text)]
      if (m.also) edits.push(editFor(src, m.file, m.also.find, m.also.text))
      const jf = join(dir, "m.json")
      writeFileSync(jf, JSON.stringify({ [m.file]: edits }))
      const r = spawnSync(process.execPath, [SELF, "--rows-only"], { env: { ...process.env, GATE_MUTATE_FILE: jf }, encoding: "utf8", maxBuffer: 1 << 28 })
      const line = (r.stdout || "").split("\n").find((l) => l.startsWith("ROWS_JSON "))
      if (!line) {
        note = `child did not finish (exit ${r.status}): ${(r.stderr || "").trim().split("\n").slice(-1)[0]}`
      } else {
        const got = JSON.parse(line.slice(10))
        const red = m.red.filter((id) => got.find((x) => x.id === id && !x.ok))
        caught = red.length === m.red.length
        note = `red: ${red.join(", ") || "none"} of ${m.red.join(", ")}; other reds: ${got.filter((x) => !x.ok && !m.red.includes(x.id)).map((x) => x.id).join(", ") || "none"}`
      }
    } catch (e) {
      note = `mutant could not be built: ${e.message}`
    }
    out.push({ ...m, caught, note })
  }
  rmSync(dir, { recursive: true, force: true })
  return out
}

/* ---- main ---------------------------------------------------------------- */
try {
  await sectionGif()
} catch (e) {
  row("RUN", false, "the rows ran to completion", String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e))
}
rmSync(DIR, { recursive: true, force: true })
if (ROWS_ONLY) {
  console.log("ROWS_JSON " + JSON.stringify(rows.map(({ id, ok }) => ({ id, ok }))))
  process.exit(rows.every((r) => r.ok) ? 0 : 1)
}
console.log(`ffmpeg: ${FFMPEG} · plan: ${PLAN.frames.length} frames, ${PLAN.durationMs.toFixed(1)} ms at ${PLAN.fps} fps · source ${W}x${H}\n`)
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(15)} ${r.what}\n      ${r.detail}`)
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
const unguarded = rows.filter((r) => r.id !== "RUN" && !MUTANTS.some((m) => m.red.includes(r.id))).map((r) => r.id)
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught; rows with no must-fail: ${unguarded.join(", ") || "none"}`)
process.exit(pass === rows.length && caught === muts.length && unguarded.length === 0 ? 0 : 1)

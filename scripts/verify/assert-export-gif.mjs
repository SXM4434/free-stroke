// assert-export-gif.mjs · DOES THE GIF WE WRITE DECODE, COUNT, TIME AND LOOK RIGHT?
//
// Node only. The film is synthetic but shaped like the product: a lit, anti-
// aliased stroke growing across the export paper over a planned draw-in, with
// the plan made by the real `planFrames` (pen timebase, 600 ms hold), so the
// hold frames that change nothing are in it too. It goes through the real
// palette (`buildInkPalette`), the real mapper and the real `GifWriter`, and
// the judge of the file is ffmpeg's GIF decoder, not this repo.
//
// Every row is paired with a known-bad build or input that MUST fail:
//
//   decodes          ffmpeg decodes it  | a cut-short copy of the same file
//   count and size   one GIF frame per planned frame, at W x H
//                                      | a writer that skips frames that did not change
//   LZW exact        every decoded pixel is the palette colour we mapped
//                                      | a writer that widens its codes one step early
//   first and last   match the source frame: paper exact, ink within 2 levels
//                                      | the same film on a uniform 6x7x6 palette
//   clean ink        no pixel that is paper in the source is anything but paper
//                    in the file, across every frame
//                                      | the same palette with Floyd-Steinberg dithering
//   timing           delays sum to the plan's length to the centisecond
//                                      | delays rounded gap by gap
//   fps ceiling      at the 50 fps ceiling no delay is under 2 cs
//                                      | the same plan at 60 fps
//   loop             NETSCAPE2.0 loop count 0, forever | a file written with loops = 3
//
//   node scripts/verify/assert-export-gif.mjs [--keep]
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"
import { loadTsMutant } from "./lib/ts-mutant.mjs"
import { makePaired } from "./lib/paired.mjs"
import { parseGif } from "./lib/gif-walk.mjs"

const require = createRequire(import.meta.url)
const FFMPEG = require("ffmpeg-static")
const GIF = loadTs("lib/export/gif.ts")
const { planFrames } = loadTs("lib/export/frame-plan.ts")
const { EXPORT_PAPER_HEX } = { EXPORT_PAPER_HEX: "#fafafa" }

const DIR = mkdtempSync(join(tmpdir(), "fs-gif-"))
const keep = process.argv.includes("--keep")

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
const paired = makePaired(row)

/* ---- the film ------------------------------------------------------- */

const W = 240
const H = 160
const PAPER = GIF.parseHexColor(EXPORT_PAPER_HEX)
const plan = planFrames({ penDurationMs: 2000, fps: 30, timebase: "pen", holdMs: 600 })
const N = plan.frames.length

/* A sine stroke, radius 7 px, lit across its width: a dark core rising to a
 * lighter shoulder, the way a lit tube reads on screen. Many colours on
 * purpose, so the palette has to choose. */
const PATH = []
for (let i = 0; i <= 200; i++) {
  const t = i / 200
  PATH.push([20 + 200 * t, 80 + 45 * Math.sin(t * Math.PI * 2.2)])
}
const R = 7
const INK_LO = [22, 24, 34]
/* The lit shoulder turns from slate blue to gold along the stroke, so the film
 * holds well over 256 colours and median cut has to choose. */
const HI_A = [96, 108, 150]
const HI_B = [214, 160, 58]

function renderFrame(reveal) {
  const upto = Math.max(1, Math.round(reveal * (PATH.length - 1)))
  const px = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let d = Infinity
      let along = 0
      if (reveal > 0) {
        for (let i = 1; i <= upto; i++) {
          const [ax, ay] = PATH[i - 1]
          const [bx, by] = PATH[i]
          const vx = bx - ax, vy = by - ay
          const wx = x + 0.5 - ax, wy = y + 0.5 - ay
          const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)))
          const dd = Math.hypot(wx - t * vx, wy - t * vy)
          if (dd < d) {
            d = dd
            along = (i - 1 + t) / (PATH.length - 1)
          }
        }
      }
      const cover = Math.max(0, Math.min(1, R + 0.5 - d))
      const k = Math.min(1, d / R) ** 0.7
      const o = (y * W + x) * 4
      for (let c = 0; c < 3; c++) {
        const hi = HI_A[c] + (HI_B[c] - HI_A[c]) * along
        const ink = hi + (INK_LO[c] - hi) * (1 - k)
        px[o + c] = Math.round(PAPER[c] + (ink - PAPER[c]) * cover)
      }
      px[o + 3] = 255
    }
  }
  return px
}

const cache = new Map()
const frames = plan.frames.map((f) => {
  const key = f.clock.toFixed(6)
  if (!cache.has(key)) cache.set(key, renderFrame(f.clock))
  return cache.get(key)
})
const timestampsUs = plan.frames.map((f) => Math.round(f.timeMs * 1000))
const endUs = timestampsUs[N - 1] + Math.round(plan.frameIntervalMs * 1000)

/* ---- writing -------------------------------------------------------- */

function samplesOf(fr) {
  // The recorder's own choice: 12 frames, first and last among them.
  const k = 12
  const idx = new Set()
  for (let j = 0; j < k; j++) idx.add(Math.round((j * (fr.length - 1)) / (k - 1)))
  return [...idx].map((i) => fr[i])
}

function writeGif(mod, { palette, indexFrames, delays, loops = 0 }) {
  const w = new mod.GifWriter({ width: W, height: H, palette, loops })
  for (let i = 0; i < indexFrames.length; i++) w.addFrame({ indices: indexFrames[i], delayCs: delays[i] })
  return w.finish()
}

const palette = GIF.buildInkPalette(samplesOf(frames), { ground: PAPER })
const mapper = new GIF.PaletteMapper(palette)
const indexFrames = frames.map((f) => mapper.mapFrame(f))
const delays = GIF.gifDelaysCs(timestampsUs, endUs)
const bytes = writeGif(GIF, { palette, indexFrames, delays })
const FILE = join(DIR, "film.gif")
writeFileSync(FILE, bytes)

/* ---- reading: an independent block walker, and ffmpeg ---------------- */

/** Every frame as RGBA, one output frame per GIF frame (no rate conversion). */
function decode(file) {
  const r = spawnSync(FFMPEG, ["-v", "error", "-i", file, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], {
    maxBuffer: 2 ** 31 - 1,
  })
  if (r.status !== 0) throw new Error(`ffmpeg refused the file: ${String(r.stderr).split("\n")[0]}`)
  const size = W * H * 4
  const out = []
  for (let o = 0; o + size <= r.stdout.length; o += size) out.push(r.stdout.subarray(o, o + size))
  return { frames: out, clean: String(r.stderr).trim() === "" }
}

function isPaper(px, o) {
  return px[o] === PAPER[0] && px[o + 1] === PAPER[1] && px[o + 2] === PAPER[2]
}

/** Paper exact, and the mean abs error over ink pixels. */
function compare(src, dec) {
  let paperWrong = 0
  let inkErr = 0
  let inkN = 0
  for (let o = 0; o < src.length; o += 4) {
    if (isPaper(src, o)) {
      if (!isPaper(dec, o)) paperWrong++
    } else {
      inkErr += Math.abs(src[o] - dec[o]) + Math.abs(src[o + 1] - dec[o + 1]) + Math.abs(src[o + 2] - dec[o + 2])
      inkN += 3
    }
  }
  return { paperWrong, inkMean: inkN ? inkErr / inkN : 0, inkPx: inkN / 3 }
}

function specks(decFrames, srcFrames) {
  let n = 0
  for (let f = 0; f < decFrames.length; f++) {
    const s = srcFrames[f], d = decFrames[f]
    for (let o = 0; o < s.length; o += 4) if (isPaper(s, o) && !isPaper(d, o)) n++
  }
  return n
}

const distinct = new Set()
for (const f of frames) for (let o = 0; o < f.length; o += 4) distinct.add((f[o] << 16) | (f[o + 1] << 8) | f[o + 2])
console.log(`film: ${N} planned frames, ${distinct.size} distinct source colours`)
console.log(`film: ${N} planned frames, ${W}x${H}, ${plan.durationMs.toFixed(1)} ms, palette ${palette.count} colours (paper #${palette.groundIndex}, ink #${palette.inkIndex}), ${bytes.length} bytes`)

/* 1 · decodes */
const real = decode(FILE)
{
  const cut = join(DIR, "cut.gif")
  writeFileSync(cut, bytes.subarray(0, Math.floor(bytes.length * 0.6)))
  paired(
    "ffmpeg decodes the GIF, cleanly, to W x H frames",
    () => real.clean && real.frames.length > 0,
    "a copy cut to 60% of its bytes decodes cleanly to every frame",
    () => {
      try {
        const d = decode(cut)
        return d.clean && d.frames.length === N
      } catch {
        return false
      }
    },
    `${real.frames.length} frames decoded, stderr clean=${real.clean}`,
  )
}

/* 2 · count and size */
const info = parseGif(bytes)
{
  const Skip = loadTsMutant("lib/export/gif.ts", [
    ["        x0 = 0; y0 = 0; x1 = 0; y1 = 0\n", "        return\n"],
  ])
  const skipBytes = writeGif(Skip, { palette, indexFrames, delays })
  const skipInfo = parseGif(skipBytes)
  const skipFile = join(DIR, "skip.gif")
  writeFileSync(skipFile, skipBytes)
  const holdFrames = plan.frames.filter((f) => f.phase === "hold").length
  paired(
    "one GIF frame per planned frame, at the planned size, by our walker AND by ffmpeg",
    () => info.frames === N && real.frames.length === N && info.width === W && info.height === H && info.trailer,
    "a writer that drops frames that did not change keeps the plan's count",
    () => skipInfo.frames === N && decode(skipFile).frames.length === N,
    `walker ${info.frames}/${N} · ffmpeg ${real.frames.length}/${N} · ${info.width}x${info.height} · the skipping writer keeps ${skipInfo.frames} (the plan has ${holdFrames} hold frames)`,
  )
}

/* 3 · LZW exact
 * The film alone cannot fail an LZW width bug: long paper runs keep the code
 * table under 512 entries, so the width never changes (measured: the early-
 * width mutant decoded the film exactly). So the row also writes one frame of
 * seeded noise over the full palette, which fills the 4096-entry table and
 * resets it several times, and holds both files to exact. */
{
  const expectRgb = (idx) => {
    const out = new Uint8Array(idx.length * 4)
    for (let p = 0; p < idx.length; p++) {
      out[p * 4] = palette.rgb[idx[p] * 3]
      out[p * 4 + 1] = palette.rgb[idx[p] * 3 + 1]
      out[p * 4 + 2] = palette.rgb[idx[p] * 3 + 2]
      out[p * 4 + 3] = 255
    }
    return out
  }
  const exactOf = (idxFrames, dec) => {
    let bad = 0
    for (let f = 0; f < idxFrames.length; f++) {
      const e = expectRgb(idxFrames[f])
      const d = dec[f]
      if (!d) return Infinity
      for (let i = 0; i < e.length; i++) if (e[i] !== d[i]) bad++
    }
    return bad
  }
  let seed = 12345
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 8) % palette.count
  const noise = [new Uint8Array(W * H).map(() => rnd())]
  const tryExact = (mod, idxFrames, dl, name) => {
    const f = join(DIR, name)
    writeFileSync(f, writeGif(mod, { palette, indexFrames: idxFrames, delays: dl }))
    try {
      return exactOf(idxFrames, decode(f).frames)
    } catch {
      return Infinity
    }
  }
  const Early = loadTsMutant("lib/export/gif.ts", [
    ["if (next > 1 << codeSize && codeSize < 12) codeSize++", "if (next >= 1 << codeSize && codeSize < 12) codeSize++"],
  ])
  const filmBad = exactOf(indexFrames, real.frames)
  const noiseBad = tryExact(GIF, noise, [10], "noise.gif")
  const earlyFilm = tryExact(Early, indexFrames, delays, "early.gif")
  const earlyNoise = tryExact(Early, noise, [10], "early-noise.gif")
  paired(
    "LZW: every pixel decodes to the palette colour it was mapped to, on the film and on a table-filling noise frame",
    () => filmBad === 0 && noiseBad === 0,
    "a writer that widens its codes one step early decodes both exactly too",
    () => earlyFilm === 0 && earlyNoise === 0,
    `film ${filmBad} and noise ${noiseBad} channel values differ · early-width mutant: film ${earlyFilm}, noise ${earlyNoise}`,
  )
}

/* 4 · first and last frames match the source */
{
  const first = compare(frames[0], real.frames[0])
  const last = compare(frames[N - 1], real.frames[N - 1])
  // Known-bad: a fixed 6x7x6 uniform palette, the classic "web" cube.
  const cube = []
  for (let r = 0; r < 6; r++) for (let g = 0; g < 7; g++) for (let b = 0; b < 6; b++) cube.push(Math.round((r * 255) / 5), Math.round((g * 255) / 6), Math.round((b * 255) / 5))
  const cubePal = { rgb: Uint8Array.from(cube), count: cube.length / 3, groundIndex: -1, inkIndex: -1 }
  const cubeMap = new GIF.PaletteMapper(cubePal)
  const cubeFile = join(DIR, "cube.gif")
  writeFileSync(cubeFile, writeGif(GIF, { palette: cubePal, indexFrames: frames.map((f) => cubeMap.mapFrame(f)), delays }))
  const cubeDec = decode(cubeFile).frames
  const cf = compare(frames[0], cubeDec[0])
  const cl = compare(frames[N - 1], cubeDec[N - 1])
  const good = (c) => c.paperWrong === 0 && c.inkMean <= 2
  paired(
    "first and last frames match the source: paper exact, ink within 2 levels on average",
    () => good(first) && good(last),
    "the same film on a uniform 6x7x6 palette matches as well",
    () => good(cf) && good(cl),
    `first: paper wrong ${first.paperWrong}, ink mean ${first.inkMean.toFixed(3)} over ${first.inkPx} px · last: paper wrong ${last.paperWrong}, ink mean ${last.inkMean.toFixed(3)} over ${last.inkPx} px · cube last: paper wrong ${cl.paperWrong}, ink mean ${cl.inkMean.toFixed(2)}`,
  )
}

/* 5 · clean ink, every frame */
{
  const realSpecks = specks(real.frames, frames)
  // Known-bad: Floyd-Steinberg over the SAME palette.
  const fs = frames.map((src) => {
    const err = new Float32Array(W * H * 3)
    const out = new Uint8Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x
        const c = [0, 1, 2].map((k) => Math.max(0, Math.min(255, src[p * 4 + k] + err[p * 3 + k])))
        const i = mapper.index(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]))
        out[p] = i
        for (let k = 0; k < 3; k++) {
          const e = c[k] - palette.rgb[i * 3 + k]
          const spread = (dx, dy, w) => {
            const xx = x + dx, yy = y + dy
            if (xx >= 0 && xx < W && yy < H) err[(yy * W + xx) * 3 + k] += e * w
          }
          spread(1, 0, 7 / 16)
          spread(-1, 1, 3 / 16)
          spread(0, 1, 5 / 16)
          spread(1, 1, 1 / 16)
        }
      }
    }
    return out
  })
  const fsFile = join(DIR, "fs.gif")
  writeFileSync(fsFile, writeGif(GIF, { palette, indexFrames: fs, delays }))
  const fsSpecks = specks(decode(fsFile).frames, frames)
  paired(
    "clean ink: no pixel that is paper in the source is anything else in the GIF, across all frames",
    () => realSpecks === 0,
    "the same palette with Floyd-Steinberg dithering is speck-free too",
    () => fsSpecks === 0,
    `${realSpecks} specks over ${N} frames · dithered: ${fsSpecks} specks`,
  )
}

/* 6 · timing */
{
  const want = Math.round(endUs / 10000) - Math.round(timestampsUs[0] / 10000)
  const got = info.delays.reduce((a, b) => a + b, 0)
  const naive = timestampsUs.map((t, i) => Math.round(((i + 1 < N ? timestampsUs[i + 1] : endUs) - t) / 10000))
  const naiveSum = naive.reduce((a, b) => a + b, 0)
  paired(
    "delays sum to the plan's length to the centisecond, none under 2 cs",
    () => got === want && info.delays.every((d) => d >= 2),
    "delays rounded gap by gap land on the same length",
    () => naiveSum === want,
    `file ${got} cs vs plan ${want} cs · pattern ${[...new Set(info.delays)].join("/")} cs · gap-rounded ${naiveSum} cs`,
  )
}

/* 7 · the fps ceiling */
{
  const at = (fps) => {
    const p = planFrames({ penDurationMs: 2000, fps, timebase: "pen", holdMs: 600 })
    const ts = p.frames.map((f) => Math.round(f.timeMs * 1000))
    const end = ts[ts.length - 1] + Math.round(p.frameIntervalMs * 1000)
    return GIF.gifDelaysCs(ts, end)
  }
  const capped = at(Math.min(60, GIF.GIF_MAX_FPS))
  const uncapped = at(60)
  paired(
    `a 60 fps request is planned at the ${GIF.GIF_MAX_FPS} fps ceiling, where no delay is under 2 cs`,
    () => GIF.GIF_MAX_FPS <= 50 && capped.every((d) => d >= 2),
    "the same plan at 60 fps keeps every delay at 2 cs or more",
    () => uncapped.every((d) => d >= 2),
    `at ${GIF.GIF_MAX_FPS}: min ${Math.min(...capped)} cs · at 60: ${uncapped.filter((d) => d < 2).length} of ${uncapped.length} delays under 2 cs`,
  )
}

/* 8 · loop */
{
  const three = parseGif(writeGif(GIF, { palette, indexFrames: indexFrames.slice(0, 2), delays, loops: 3 }))
  paired(
    "the GIF loops forever (NETSCAPE2.0, count 0)",
    () => info.loops === 0,
    "a file written with loops = 3 reads as looping forever",
    () => three.loops === 0,
    `loops=${info.loops} · control loops=${three.loops}`,
  )
}

if (!keep) rmSync(DIR, { recursive: true, force: true })
else console.log(`kept ${DIR}`)
console.log(`\nassert-export-gif: ${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)

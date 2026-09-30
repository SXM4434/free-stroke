// assert-export-webm-alpha.mjs · DOES THE TRANSPARENT WEBM WE WRITE CARRY ITS ALPHA?
//
// Node only; the browser half is `assert-export-webm-alpha-app.mjs`. Two
// questions, each judged by ffmpeg's libvpx decoder (the one that reads the
// alpha side channel; ffmpeg's native vp9 decoder ignores it):
//
//   THE CONTAINER. ffmpeg encodes a VP9-with-alpha film and muxes it itself.
//   We take ffmpeg's own frames (colour Block + alpha BlockAdditional) out of
//   its file and re-mux them through `WebmMuxer({ alpha: true })`. If our
//   container is right the two files decode to identical RGBA, by construction.
//
//   THE PLANES. `rgbaToI420Pair` builds the colour frame and the alpha frame
//   the browser encoder is handed. They are encoded LOSSLESSLY here (so the
//   codec adds nothing), muxed by us, decoded, and held against the source:
//   alpha exact everywhere, colour close where the ink is opaque.
//
// Rows, each with an arm that MUST fail:
//   container exact   our mux of ffmpeg's frames decodes like ffmpeg's file
//                                   | a muxer that drops the BlockAdditions
//   count and size    AlphaMode 1, one Block per planned frame, each with its
//                     alpha, at W x H; ffmpeg decodes every one
//                                   | the same frames muxed without `alpha`
//   first and last    decoded frames match the source: alpha exact, opaque ink
//                     no worse than ffmpeg's own RGBA to yuva420p conversion
//                                   | an alpha plane written through the colour
//                                     conversion (limited range, the canvas path)
//   transparent is 0  every pixel that is transparent in the source is alpha 0
//                     in every decoded frame
//                                   | the same limited-range alpha plane
//
//   node scripts/verify/assert-export-webm-alpha.mjs [--keep]
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"
import { loadTsMutant } from "./lib/ts-mutant.mjs"
import { makePaired } from "./lib/paired.mjs"
import { walkWebm } from "./lib/ebml-walk.mjs"

const require = createRequire(import.meta.url)
const FFMPEG = require("ffmpeg-static")
const { WebmMuxer } = loadTs("lib/export/webm.ts")
const ALPHA = loadTs("lib/export/webm-alpha.ts")
const { planFrames } = loadTs("lib/export/frame-plan.ts")

const DIR = mkdtempSync(join(tmpdir(), "fs-webma-"))
const keep = process.argv.includes("--keep")

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
const paired = makePaired(row)

/* ---- the film: a lit stroke drawing in over NOTHING ------------------ */
const W = 240
const H = 160
const FPS = 30
const plan = planFrames({ penDurationMs: 1500, fps: FPS, timebase: "pen", holdMs: 300 })
const N = plan.frames.length
const PATH = []
for (let i = 0; i <= 160; i++) {
  const t = i / 160
  PATH.push([24 + 192 * t, 80 + 42 * Math.sin(t * Math.PI * 2)])
}
const R = 8
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
      const k = Math.min(1, d / R)
      const o = (y * W + x) * 4
      // A dark core rising to a shoulder that turns from teal to amber.
      const hi = [40 + 180 * along, 150 - 30 * along, 160 - 120 * along]
      const lo = [18, 20, 28]
      for (let c = 0; c < 3; c++) px[o + c] = cover > 0 ? Math.round(lo[c] + (hi[c] - lo[c]) * k) : 0
      px[o + 3] = Math.round(cover * 255)
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

/* ---- helpers -------------------------------------------------------- */
function ff(args, input) {
  const r = spawnSync(FFMPEG, ["-v", "error", ...args], { input, maxBuffer: 2 ** 31 - 1 })
  if (r.status !== 0) throw new Error(`ffmpeg: ${String(r.stderr).split("\n")[0]}`)
  return r
}
/** Decode through libvpx so the alpha side channel is read. */
function decodeAlpha(file) {
  const r = spawnSync(FFMPEG, ["-v", "error", "-c:v", "libvpx-vp9", "-i", file, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], {
    maxBuffer: 2 ** 31 - 1,
  })
  if (r.status !== 0) throw new Error(`ffmpeg refused ${file}: ${String(r.stderr).split("\n")[0]}`)
  const size = W * H * 4
  const out = []
  for (let o = 0; o + size <= r.stdout.length; o += size) out.push(r.stdout.subarray(o, o + size))
  return { frames: out, clean: String(r.stderr).trim() === "" }
}
function mux(mod, walked, { alpha = true } = {}) {
  const m = new mod.WebmMuxer({ width: W, height: H, codec: "V_VP9", fps: FPS, alpha })
  for (const f of walked.frames) {
    m.addFrame({ data: f.data, additional: f.additional ?? undefined, keyFrame: f.key, timestampUs: f.timeMs * 1000, durationUs: 1e6 / FPS })
  }
  return m.finish()
}
function sameBytes(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/* ---- 1 · the container ---------------------------------------------- */
const rawRgba = Buffer.concat(frames.map((f) => Buffer.from(f)))
const REF = join(DIR, "ffmpeg-ref.webm")
ff(["-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "1M", "-auto-alt-ref", "0", "-y", REF], rawRgba)
const refWalk = walkWebm(readFileSync(REF))
const OURS = join(DIR, "ours.webm")
writeFileSync(OURS, mux({ WebmMuxer }, refWalk))
{
  const NoAdd = loadTsMutant("lib/export/webm.ts", [["        if (f.additional && f.additional.length) {", "        if (false) {"]])
  const NOADD = join(DIR, "no-additions.webm")
  writeFileSync(NOADD, mux(NoAdd, refWalk))
  const ref = decodeAlpha(REF)
  const ours = decodeAlpha(OURS)
  const noadd = decodeAlpha(NOADD)
  const eq = (a, b) => a.frames.length === b.frames.length && a.frames.every((f, i) => sameBytes(f, b.frames[i]))
  const refAlpha0 = (() => {
    let z = 0
    for (let i = 3; i < ref.frames[N - 1].length; i += 4) if (ref.frames[N - 1][i] === 0) z++
    return z
  })()
  paired(
    "container: our mux of ffmpeg's own VP9+alpha frames decodes byte-identical to ffmpeg's file",
    () => ref.frames.length === N && eq(ref, ours) && ours.clean && refAlpha0 > 0,
    "a muxer that drops the BlockAdditions decodes identically too",
    () => eq(ref, noadd),
    `ffmpeg ${ref.frames.length} frames, ours ${ours.frames.length}, ${refWalk.frames.filter((f) => f.additional).length} alpha payloads carried · ref last frame ${refAlpha0} px at alpha 0`,
  )
}

/* ---- 2 · the planes, lossless ------------------------------------------ */
function planesFile(mod, name) {
  const yuva = []
  for (const f of frames) {
    const p = mod.rgbaToI420Pair(f, W, H)
    const ySize = W * H
    // yuva420p = Y, U, V, then A (the alpha frame's Y plane)
    yuva.push(Buffer.from(p.color), Buffer.from(p.alpha.subarray(0, ySize)))
  }
  const ref = join(DIR, `${name}-ffmpeg.webm`)
  ff(["-f", "rawvideo", "-pix_fmt", "yuva420p", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-", "-c:v", "libvpx-vp9", "-lossless", "1", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-y", ref], Buffer.concat(yuva))
  const walked = walkWebm(readFileSync(ref))
  const file = join(DIR, `${name}.webm`)
  writeFileSync(file, mux({ WebmMuxer }, walked))
  return { file, walked }
}
const good = planesFile(ALPHA, "planes")
const Veil = loadTsMutant("lib/export/webm-alpha.ts", [["        alpha[y * w + x] = a\n", "        alpha[y * w + x] = Math.round(16 + (219 * a) / 255)\n"]])
const veil = planesFile(Veil, "veil")
const dec = decodeAlpha(good.file)
const decVeil = decodeAlpha(veil.file)

/* THE REFERENCE CONVERSION. 4:2:0 shares one chroma sample between four
 * pixels, so no plane builder gets opaque ink back exactly: a stroke whose
 * colour turns across its own width loses some of that turn. The bar for OUR
 * planes is therefore ffmpeg's own RGBA to yuva420p conversion of the same
 * frames, encoded the same lossless way (first written as an absolute 2
 * levels, which ffmpeg itself misses on this film at 2.279). */
const FFCONV = join(DIR, "ffmpeg-conversion.webm")
ff(["-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-", "-c:v", "libvpx-vp9", "-lossless", "1", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-y", FFCONV], rawRgba)
const decFf = decodeAlpha(FFCONV)

/* ---- 3 · count and size ------------------------------------------------ */
{
  const w = walkWebm(readFileSync(good.file))
  const plainBytes = mux({ WebmMuxer }, good.walked, { alpha: false })
  const plain = walkWebm(plainBytes)
  const ok = (x) => x.alphaMode === 1 && x.frames.length === N && x.frames.every((f) => f.additional && f.additional.length > 0) && x.width === W && x.height === H && x.frames[0].key
  paired(
    "AlphaMode 1, one Block per planned frame each carrying its alpha frame, at W x H, and ffmpeg decodes all of them",
    () => ok(w) && dec.frames.length === N && dec.clean,
    "the same frames muxed without `alpha` pass the same test",
    () => ok(plain),
    `alphaMode ${w.alphaMode} · ${w.frames.length}/${N} blocks, ${w.frames.filter((f) => f.additional).length} with alpha · ${w.width}x${w.height} · ${w.frames.filter((f) => f.key).length} keyframes · decoded ${dec.frames.length} · without alpha: alphaMode ${plain.alphaMode}, ${plain.frames.filter((f) => f.additional).length} alpha payloads`,
  )
}

/* ---- 4 · first and last frames match the source ------------------------ */
function compare(src, got) {
  let alphaWrong = 0
  let opaqueErr = 0
  let opaqueN = 0
  for (let o = 0; o < src.length; o += 4) {
    if (src[o + 3] !== got[o + 3]) alphaWrong++
    if (src[o + 3] === 255) {
      opaqueErr += (Math.abs(src[o] - got[o]) + Math.abs(src[o + 1] - got[o + 1]) + Math.abs(src[o + 2] - got[o + 2])) / 3
      opaqueN++
    }
  }
  return { alphaWrong, opaqueMean: opaqueN ? opaqueErr / opaqueN : 0, opaqueN }
}
{
  const f0 = compare(frames[0], dec.frames[0])
  const fN = compare(frames[N - 1], dec.frames[N - 1])
  const v0 = compare(frames[0], decVeil.frames[0])
  const vN = compare(frames[N - 1], decVeil.frames[N - 1])
  const r0 = compare(frames[0], decFf.frames[0])
  const rN = compare(frames[N - 1], decFf.frames[N - 1])
  const okc = (c, r) => c.alphaWrong === 0 && c.opaqueMean <= r.opaqueMean
  const fmt = (c) => `alpha wrong ${c.alphaWrong}, opaque ink mean ${c.opaqueMean.toFixed(3)} over ${c.opaqueN} px`
  paired(
    "first and last decoded frames match the source: alpha exact, opaque ink no worse than ffmpeg's own 4:2:0 conversion",
    () => okc(f0, r0) && okc(fN, rN) && fN.opaqueN > 0,
    "an alpha plane written through the colour conversion (limited range) matches as well",
    () => okc(v0, r0) && okc(vN, rN),
    `first: ${fmt(f0)} · last: ${fmt(fN)} · ffmpeg's conversion, last: ${fmt(rN)} · limited-range alpha, last: ${fmt(vN)}`,
  )
}

/* ---- 5 · transparent stays transparent, every frame -------------------- */
{
  const veiled = (d) => {
    let n = 0
    let worst = 0
    for (let f = 0; f < N; f++) {
      const s = frames[f]
      const g = d.frames[f]
      for (let o = 3; o < s.length; o += 4) {
        if (s[o] === 0 && g[o] !== 0) {
          n++
          if (g[o] > worst) worst = g[o]
        }
      }
    }
    return { n, worst }
  }
  const a = veiled(dec)
  const b = veiled(decVeil)
  paired(
    "every pixel transparent in the source decodes to alpha 0, in every frame",
    () => a.n === 0,
    "the limited-range alpha plane keeps transparent at 0 too",
    () => b.n === 0,
    `${a.n} veiled px over ${N} frames · limited-range: ${b.n} px, worst alpha ${b.worst}`,
  )
}

if (!keep) rmSync(DIR, { recursive: true, force: true })
else console.log(`kept ${DIR}`)
console.log(`\nassert-export-webm-alpha: ${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)

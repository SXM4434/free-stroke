// assert-export-encoders.mjs — DOES THE FILE WE WRITE ACTUALLY DECODE?
//
// The failure this gate exists to stop: an export that downloads. A muxer with
// a wrong size field, a CRC over the wrong bytes, or a block timecode that goes
// negative all produce a file of plausible length that a "did it download?"
// check passes and no player will open. So the judge here is not this repo —
// it is the `ffmpeg` binary already vendored as a devDependency
// (`ffmpeg-static`), asked to DECODE what we wrote and hand back raw pixels.
//
// The WebM path is verified against ffmpeg's OWN container for the SAME encoded
// frames: one VP9 encode → an IVF → (a) ffmpeg remuxes it to WebM, (b) we mux
// it to WebM. Both are decoded to rawvideo and compared byte for byte. If our
// container is right, the pixels are identical by construction; if it is wrong
// in any way that matters, they are not.
//
// Every row is paired with a mutation that must FAIL.
//
//   node scripts/verify/assert-export-encoders.mjs [--keep]
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"
import { makePaired } from "./lib/paired.mjs"

const require = createRequire(import.meta.url)
const FFMPEG = require("ffmpeg-static")
const { ApngWriter } = loadTs("lib/export/apng.ts")
const { WebmMuxer } = loadTs("lib/export/webm.ts")

const DIR = mkdtempSync(join(tmpdir(), "fs-export-"))
const keep = process.argv.includes("--keep")

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

/* ---- ffmpeg helpers -------------------------------------------------- */

/** Decode a media file to raw pixels. Throws when ffmpeg refuses it. */
function decodeRaw(file, pixFmt = "rgba") {
  return execFileSync(FFMPEG, ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", pixFmt, "-"], {
    maxBuffer: 1 << 28,
  })
}

/**
 * ffmpeg writes its progress and its complaints to STDERR, and `execFileSync`
 * only hands stderr back when the process FAILS — so the first version of this
 * helper read an empty string on every successful run and every duration came
 * back 0.000s. Four rows went red for a reason that had nothing to do with the
 * files. `spawnSync` gives both streams either way.
 */
function runCapture(argv) {
  const [bin, ...args] = argv
  const r = spawnSync(bin, args, { maxBuffer: 1 << 28, encoding: "utf8" })
  return `${r.stdout ?? ""}${r.stderr ?? ""}`
}

function parseStats(text) {
  const frames = [...text.matchAll(/frame=\s*(\d+)/g)].map((m) => +m[1])
  const times = [...text.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)].map((m) => +m[1] * 3600 + +m[2] * 60 + +m[3])
  /* The DECLARED duration, read off the file's own header rather than counted
   * from the decode. For WebM that is literally the `Duration` element this
   * muxer writes, so it is the one number that tests the muxer's own arithmetic
   * instead of the decoder's. */
  const decl = text.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
  return {
    frames: frames.length ? frames[frames.length - 1] : 0,
    seconds: times.length ? times[times.length - 1] : 0,
    declared: decl ? +decl[1] * 3600 + +decl[2] * 60 + +decl[3] : NaN,
    text,
  }
}

/** ffmpeg's stderr, for the rows that need to prove a REFUSAL. */
function decodes(file) {
  const t = runCapture([FFMPEG, "-v", "error", "-i", file, "-f", "null", "-"])
  const s = parseStats(runCapture([FFMPEG, "-i", file, "-f", "null", "-"]))
  return { ok: t.trim() === "", frames: s.frames, seconds: s.seconds, declared: s.declared, err: t.trim().split("\n")[0] ?? "" }
}

/* ================================================================== */
/*  A · APNG                                                          */
/* ================================================================== */

const W = 64
const H = 48
const N = 12

/** A moving opaque bar on a半-transparent wash — alpha and motion in one. */
function synthFrame(i) {
  const rgba = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4
      const inBar = x >= i * 4 && x < i * 4 + 8
      rgba[o] = inBar ? 255 : (x * 3) & 0xff
      rgba[o + 1] = inBar ? 40 : (y * 5) & 0xff
      rgba[o + 2] = inBar ? 10 : 128
      // A real alpha gradient, so "the alpha survived" is a claim with teeth.
      rgba[o + 3] = inBar ? 255 : Math.round((x / (W - 1)) * 200)
    }
  }
  return rgba
}

async function writeApng(frames, delayMs, corruptCrc = false) {
  const w = new ApngWriter({ width: W, height: H, loops: 0 })
  for (const f of frames) await w.addFrame({ rgba: f, delayMs })
  const bytes = w.finish()
  if (corruptCrc) {
    // Flip one byte inside the FIRST IDAT's payload. The chunk length is still
    // right, so only the CRC can catch it — which is the point.
    const idat = bytes.indexOf(0x49) // scan for "IDAT"
    let at = -1
    for (let i = 8; i < bytes.length - 4; i++) {
      if (bytes[i] === 0x49 && bytes[i + 1] === 0x44 && bytes[i + 2] === 0x41 && bytes[i + 3] === 0x54) { at = i + 8; break }
    }
    void idat
    if (at < 0) throw new Error("no IDAT found to corrupt")
    bytes[at] ^= 0xff
  }
  const file = join(DIR, `apng-${delayMs}-${corruptCrc ? "bad" : "ok"}-${frames.length}-${Math.random().toString(36).slice(2, 7)}.png`)
  writeFileSync(file, bytes)
  return file
}

const source = Array.from({ length: N }, (_, i) => synthFrame(i))
const apngOk = await writeApng(source, 33)
const apngSlow = await writeApng(source, 100)
const apngStatic = await writeApng(Array.from({ length: N }, () => synthFrame(3)), 33)
const apngBad = await writeApng(source, 33, true)

/* A1 — ffmpeg decodes it, and to the RIGHT number of frames. */
{
  const d = decodes(apngOk)
  paired(
    "APNG: ffmpeg decodes our file, all frames present",
    () => d.ok && d.frames === N,
    "a corrupted IDAT must be REFUSED",
    () => {
      const b = decodes(apngBad)
      return b.ok && b.frames === N
    },
    `${d.frames}/${N} frames, ffmpeg clean=${d.ok}`,
  )
}

/* A2 — LOSSLESS: the decoded pixels are the bytes we handed in. */
{
  let raw = null
  try { raw = decodeRaw(apngOk, "rgba") } catch { /* handled below */ }
  const expected = W * H * 4 * N
  const identical = () => {
    if (!raw || raw.length !== expected) return false
    for (let f = 0; f < N; f++) {
      const off = f * W * H * 4
      for (let i = 0; i < W * H * 4; i++) if (raw[off + i] !== source[f][i]) return false
    }
    return true
  }
  paired(
    "APNG is LOSSLESS and keeps alpha: decoded RGBA === the bytes we wrote",
    identical,
    "comparing against the WRONG frame order must fail",
    () => {
      if (!raw || raw.length !== expected) return false
      for (let f = 0; f < N; f++) {
        const off = f * W * H * 4
        const wrong = source[(f + 1) % N]
        for (let i = 0; i < W * H * 4; i++) if (raw[off + i] !== wrong[i]) return false
      }
      return true
    },
    `${raw ? raw.length : 0} bytes decoded, expected ${expected}`,
  )
}

/* A3 — the DELAY is real: doubling it lengthens the file. */
{
  const fast = decodes(apngOk)
  const slow = decodes(apngSlow)
  paired(
    "APNG delay is written as a real ms rational — 33ms vs 100ms changes the duration",
    () => slow.seconds > fast.seconds * 2.5,
    "the two must not read the same duration",
    () => Math.abs(slow.seconds - fast.seconds) < 1e-6,
    `33ms → ${fast.seconds.toFixed(3)}s · 100ms → ${slow.seconds.toFixed(3)}s`,
  )
}

/* A4 — the animation actually MOVES (the instrument's own negative control). */
{
  const raw = decodeRaw(apngOk, "rgba")
  const rawStatic = decodeRaw(apngStatic, "rgba")
  const framesDiffer = (buf) => {
    const size = W * H * 4
    for (let f = 1; f < N; f++) {
      let same = true
      for (let i = 0; i < size; i++) if (buf[f * size + i] !== buf[(f - 1) * size + i]) { same = false; break }
      if (same) return false
    }
    return true
  }
  paired(
    "every APNG frame differs from the one before it",
    () => framesDiffer(raw),
    "twelve identical frames must FAIL that check",
    () => framesDiffer(rawStatic),
    `${N} frames`,
  )
}

/* ================================================================== */
/*  B · WEBM                                                          */
/* ================================================================== */

const VW = 160
const VH = 120
const VFPS = 30
const VSECS = 2

// One VP9 encode, reused by both containers, so any pixel difference between
// them is the CONTAINER's fault and nothing else's.
const ivf = join(DIR, "src.ivf")
execFileSync(FFMPEG, [
  "-v", "error", "-y",
  "-f", "lavfi", "-i", `testsrc2=size=${VW}x${VH}:rate=${VFPS}:duration=${VSECS}`,
  "-c:v", "libvpx-vp9", "-b:v", "600k", "-deadline", "realtime", "-cpu-used", "8",
  "-f", "ivf", ivf,
])

/** IVF: 32-byte file header, then per frame `size:u32le · pts:u64le · data`. */
function readIvf(file) {
  const buf = readFileSync(file)
  if (buf.toString("ascii", 0, 4) !== "DKIF") throw new Error("not an IVF file")
  const headerLen = buf.readUInt16LE(6)
  const out = []
  let o = headerLen
  while (o + 12 <= buf.length) {
    const size = buf.readUInt32LE(o)
    const pts = Number(buf.readBigUInt64LE(o + 4))
    const data = buf.subarray(o + 12, o + 12 + size)
    out.push({ data: new Uint8Array(data), pts })
    o += 12 + size
  }
  return out
}

/**
 * VP9 keyframe, read off the uncompressed header's first byte:
 *   bits 7..6 frame_marker (2) · 5 profile_low · 4 profile_high
 *   bit 3 show_existing_frame · bit 2 frame_type (0 = KEY)
 * Profile 0 only, which is what `vp09.00.*` and this encode are.
 */
function vp9IsKeyFrame(data) {
  const b = data[0]
  if (b >>> 6 !== 0b10) return false
  const showExisting = (b >>> 3) & 1
  if (showExisting) return false
  return ((b >>> 2) & 1) === 0
}

const ivfFrames = readIvf(ivf)

function muxOurs({ timescaleBug = false, noKeyFrames = false, corrupt = false, swap = null, truncate = 0 } = {}) {
  const m = new WebmMuxer({ width: VW, height: VH, codec: "V_VP9", fps: VFPS })
  let frames = ivfFrames
  if (swap) {
    frames = ivfFrames.slice()
    const [i, j] = swap
    const t = frames[i]
    frames[i] = frames[j]
    frames[j] = t
  }
  frames.forEach((f, i) => {
    const tsUs = Math.round((i * 1e6) / VFPS) * (timescaleBug ? 2 : 1)
    m.addFrame({
      data: f.data,
      timestampUs: tsUs,
      durationUs: Math.round(1e6 / VFPS),
      keyFrame: noKeyFrames ? false : vp9IsKeyFrame(f.data),
    })
  })
  let bytes = m.finish()
  if (corrupt) {
    /* THE FIRST MUTATION HERE WAS NOT FATAL, and the row said so: flipping one
     * byte at 60% of the file left ffmpeg decoding all 60 frames without a
     * complaint, because VP9 tolerates a damaged residual and the byte may not
     * even land in a frame. A mutation that the subject survives is not a
     * control. Truncation is unambiguous — the clusters that are not there
     * cannot decode. */
    bytes = bytes.subarray(0, Math.floor(bytes.length * 0.55))
  }
  if (truncate > 0) bytes = bytes.subarray(0, Math.floor(bytes.length * truncate))
  const file = join(DIR, `ours-${timescaleBug ? "ts" : ""}${noKeyFrames ? "nk" : ""}${corrupt ? "bad" : ""}${swap ? "sw" : ""}-${Math.random().toString(36).slice(2, 7)}.webm`)
  writeFileSync(file, bytes)
  return file
}

const ffwebm = join(DIR, "ffmpeg.webm")
execFileSync(FFMPEG, ["-v", "error", "-y", "-i", ivf, "-c", "copy", ffwebm])
const ours = muxOurs()

/* B0 — the keyframe reader is not a rubber stamp. */
{
  const keys = ivfFrames.filter((f) => vp9IsKeyFrame(f.data)).length
  paired(
    "the VP9 keyframe reader finds the real keyframes, not all of them and not none",
    () => keys >= 1 && keys < ivfFrames.length,
    "a reader that says everything is a keyframe",
    () => ivfFrames.every((f) => vp9IsKeyFrame(f.data)),
    `${keys} keyframes in ${ivfFrames.length} frames`,
  )
}

/* B1 — it decodes at all, and to the right frame count. */
{
  const d = decodes(ours)
  paired(
    "WebM: ffmpeg decodes OUR container, all frames present",
    () => d.ok && d.frames === ivfFrames.length,
    "a corrupted cluster must be REFUSED or come up short",
    () => {
      const b = decodes(muxOurs({ corrupt: true }))
      return b.ok && b.frames === ivfFrames.length
    },
    `${d.frames}/${ivfFrames.length} frames · ${d.seconds.toFixed(3)}s · clean=${d.ok}`,
  )
}

/* B2 — our container gives the SAME pixels as ffmpeg's own for the same
 *      encoded frames. This is the row that makes the muxer trustworthy. */
{
  let a = null
  let b = null
  try { a = decodeRaw(ours, "rgb24"); b = decodeRaw(ffwebm, "rgb24") } catch { /* below */ }
  const same = () => !!a && !!b && a.length === b.length && a.equals(b)
  paired(
    "WebM: our muxing decodes bit-identically to ffmpeg's own muxing of the same VP9 frames",
    same,
    /* THE FIRST CONTROL HERE WAS BLIND, and it said so on its first run: a
     * file muxed with every SimpleBlock flagged as a delta frame decoded
     * BIT-IDENTICALLY, because ffmpeg's VP9 decoder reads frame type from the
     * bitstream and ignores the container's flag. A control that comes back
     * clean means the instrument cannot see. Swapping two frames moves real
     * pixels through a real decoder, so this one can. */
    "two frames swapped in the container must NOT decode identically",
    () => {
      try {
        const sw = decodeRaw(muxOurs({ swap: [10, 20] }), "rgb24")
        return !!a && sw.length === a.length && sw.equals(a)
      } catch {
        return false
      }
    },
    `${a ? a.length : 0} vs ${b ? b.length : 0} bytes`,
  )
}

/* B3 — the timestamps in the file are OUR timestamps.
 *
 * TWO numbers, on purpose. `declared` is the `Duration` element this muxer
 * writes (last PTS + one frame = 2.000s); `seconds` is where the decoder
 * actually ran out of frames (last PTS = 59/30 = 1.967s). They differ by
 * exactly one frame interval and BOTH are correct — asserting only the second
 * against `n/fps` was this row's first, wrong, expectation. */
{
  const d = decodes(ours)
  const expectedDeclared = ivfFrames.length / VFPS
  const expectedLastPts = (ivfFrames.length - 1) / VFPS
  paired(
    "WebM carries OUR timestamps: declared duration and last-frame time both land",
    () =>
      Math.abs(d.declared - expectedDeclared) <= 0.01 &&
      Math.abs(d.seconds - expectedLastPts) <= 1 / VFPS + 1e-6,
    "doubling every timestamp must break both",
    () => {
      const t = decodes(muxOurs({ timescaleBug: true }))
      return (
        Math.abs(t.declared - expectedDeclared) <= 0.01 &&
        Math.abs(t.seconds - expectedLastPts) <= 1 / VFPS + 1e-6
      )
    },
    `declared ${d.declared.toFixed(3)}s (want ${expectedDeclared.toFixed(3)}) · last frame ${d.seconds.toFixed(3)}s (want ${expectedLastPts.toFixed(3)})`,
  )
}

if (!keep) rmSync(DIR, { recursive: true, force: true })
else console.log(`\nartefacts kept in ${DIR}`)

console.log(`\nassert-export-encoders: ${pass} PASS · ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)

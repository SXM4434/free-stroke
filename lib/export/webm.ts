/**
 * A MINIMAL WEBM (MATROSKA) MUXER — enough to make WebCodecs output playable.
 *
 * ── WHY THIS EXISTS AT ALL ────────────────────────────────────────────────
 * WebCodecs' `VideoEncoder` hands back `EncodedVideoChunk`s, and a pile of
 * chunks is not a video file. The WebCodecs Fundamentals guide states it in a
 * code comment — *"This will not work!"* over `new Blob(chunks, {type:
 * "video/mp4"})* — and names the missing step as muxing
 * (webcodecsfundamentals.org/basics/muxing, captured 2026-08-01 →
 * `docs/refs-competitive/ref-06-webcodecs-muxing.png`).
 *
 * ── WHY WE WRITE IT RATHER THAN DEPEND ON ONE ─────────────────────────────
 * The two candidates were looked at first-hand. `Vanilagy/webm-muxer` is
 * "WebM multiplexer in pure TypeScript with support for WebCodecs API", MIT,
 * 337 stars — and its own repo shows commits titled **"Deprecate webm-muxer"**
 * against `MIGRATION-GUIDE.md` and `package.json`, with its homepage pointing
 * at its successor (`ref-14-webm-writer.png`). That successor, Mediabunny, is
 * genuinely the better long-term answer — "a bit like FFmpeg, but built for the
 * web's needs", zero dependencies, and its feature list explicitly includes
 * **transparent WebM** (`ref-05-mediabunny.png`). It is also a new dependency
 * in a `package.json` that three other lanes are live against, and this module
 * needs one container with one video track and no audio.
 *
 * So: this file is the smallest correct thing, ~250 lines, verified by DECODING
 * its output with a real ffmpeg (`scripts/verify/assert-export-encoders.mjs`),
 * and `docs/research/` carries the Mediabunny upgrade path as a recommendation
 * rather than a decision.
 *
 * ── THE FORMAT, IN THE AMOUNT NEEDED ──────────────────────────────────────
 * Matroska is EBML: every element is `ID · size · payload`, IDs are written
 * with their length marker baked in, sizes are variable-length integers.
 * The tree we emit:
 *
 *   EBML header            doctype "webm"
 *   Segment
 *     Info                 TimecodeScale 1e6 ns (so all timecodes are ms), Duration
 *     Tracks               one video TrackEntry: codec, pixel dimensions
 *     Cluster*             Timecode + SimpleBlock per frame
 *     Cues                 one CuePoint per keyframe, so seeking works
 *
 * A SimpleBlock's timecode is a SIGNED 16-BIT value relative to its cluster, so
 * a new cluster is opened on every keyframe and whenever the relative time
 * would leave that range. Getting this wrong produces a file that plays for a
 * few seconds and then reports a negative timestamp, which is exactly the kind
 * of defect a "did it download?" check cannot see — hence the decode gate.
 */

export type WebmCodec = "V_VP8" | "V_VP9" | "V_AV1"

export interface WebmFrame {
  /** The encoder's bytes for one frame. */
  data: Uint8Array
  /** Presentation time in MICROSECONDS (WebCodecs' unit). */
  timestampUs: number
  /** Frame duration in microseconds. May be 0 for the last frame. */
  durationUs: number
  keyFrame: boolean
  /**
   * The ALPHA stream's bytes for this frame: a second VP8/VP9 frame whose luma
   * is the alpha (see `./webm-alpha`). Written as the Block's
   * `BlockAdditional` with BlockAddID 1 when the muxer was made with `alpha`.
   */
  additional?: Uint8Array
}

export interface WebmMuxerOptions {
  width: number
  height: number
  codec: WebmCodec
  /** Nominal frame rate, written as DefaultDuration. */
  fps: number
  /** Codec private data (AV1 needs it; VP8/VP9 do not). */
  codecPrivate?: Uint8Array
  writingApp?: string
  /**
   * A WebM with alpha: `AlphaMode = 1` on the track and every frame written as
   * a BlockGroup whose BlockAdditions carry the frame's `additional` bytes.
   * Off, the file is byte for byte what this muxer always wrote.
   */
  alpha?: boolean
}

/* ---- EBML primitives ------------------------------------------------- */

/** Variable-length size. Length is the smallest that can hold the value. */
function vint(value: number): Uint8Array {
  for (let len = 1; len <= 8; len++) {
    // The all-ones payload of a given length is RESERVED as "unknown size", so
    // a value that would encode to it must move up a length.
    const max = 2 ** (7 * len) - 1
    if (value < max) {
      const out = new Uint8Array(len)
      let v = value
      for (let i = len - 1; i >= 0; i--) {
        out[i] = v & 0xff
        v = Math.floor(v / 256)
      }
      out[0] |= 1 << (8 - len)
      return out
    }
  }
  throw new Error(`webm: size ${value} does not fit in 8 bytes`)
}

/** Unsigned integer, minimum bytes (Matroska allows 1..8). */
function uint(value: number): Uint8Array {
  const v = Math.max(0, Math.round(value))
  let len = 1
  while (len < 8 && v >= 2 ** (8 * len)) len++
  const out = new Uint8Array(len)
  let x = v
  for (let i = len - 1; i >= 0; i--) {
    out[i] = x & 0xff
    x = Math.floor(x / 256)
  }
  return out
}

/** Signed integer, minimum bytes, two's complement. */
function sint(value: number): Uint8Array {
  const v = Math.round(value)
  let len = 1
  while (len < 8 && (v < -(2 ** (8 * len - 1)) || v >= 2 ** (8 * len - 1))) len++
  const out = new Uint8Array(len)
  let x = v < 0 ? 2 ** (8 * len) + v : v
  for (let i = len - 1; i >= 0; i--) {
    out[i] = x & 0xff
    x = Math.floor(x / 256)
  }
  return out
}

function float64(value: number): Uint8Array {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setFloat64(0, value, false)
  return out
}

function ascii(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0x7f
  return out
}

function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0
  for (const p of parts) n += p.length
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** `ID · vint(size) · payload`. IDs carry their own length marker. */
function el(id: number[], payload: Uint8Array): Uint8Array {
  return concat([new Uint8Array(id), vint(payload.length), payload])
}

/* Element IDs, written as their raw bytes so nothing has to re-derive the
 * class marker. Names match the Matroska spec exactly. */
const ID = {
  EBML: [0x1a, 0x45, 0xdf, 0xa3],
  EBMLVersion: [0x42, 0x86],
  EBMLReadVersion: [0x42, 0xf7],
  EBMLMaxIDLength: [0x42, 0xf2],
  EBMLMaxSizeLength: [0x42, 0xf3],
  DocType: [0x42, 0x82],
  DocTypeVersion: [0x42, 0x87],
  DocTypeReadVersion: [0x42, 0x85],
  Segment: [0x18, 0x53, 0x80, 0x67],
  Info: [0x15, 0x49, 0xa9, 0x66],
  TimecodeScale: [0x2a, 0xd7, 0xb1],
  MuxingApp: [0x4d, 0x80],
  WritingApp: [0x57, 0x41],
  Duration: [0x44, 0x89],
  Tracks: [0x16, 0x54, 0xae, 0x6b],
  TrackEntry: [0xae],
  TrackNumber: [0xd7],
  TrackUID: [0x73, 0xc5],
  TrackType: [0x83],
  FlagLacing: [0x9c],
  CodecID: [0x86],
  CodecPrivate: [0x63, 0xa2],
  DefaultDuration: [0x23, 0xe3, 0x83],
  Video: [0xe0],
  PixelWidth: [0xb0],
  PixelHeight: [0xba],
  AlphaMode: [0x53, 0xc0],
  Cluster: [0x1f, 0x43, 0xb6, 0x75],
  Timecode: [0xe7],
  SimpleBlock: [0xa3],
  BlockGroup: [0xa0],
  Block: [0xa1],
  ReferenceBlock: [0xfb],
  BlockAdditions: [0x75, 0xa1],
  BlockMore: [0xa6],
  BlockAddID: [0xee],
  BlockAdditional: [0xa5],
  Cues: [0x1c, 0x53, 0xbb, 0x6b],
  CuePoint: [0xbb],
  CueTime: [0xb3],
  CueTrackPositions: [0xb7],
  CueTrack: [0xf7],
  CueClusterPosition: [0xf1],
}

const TRACK_NUMBER = 1
/** SimpleBlock relative timecodes are int16; leave headroom. */
const MAX_CLUSTER_SPAN_MS = 30000

/**
 * Buffers every frame and serialises on `finish()`.
 *
 * Buffering is a deliberate choice: it lets the file carry a real `Duration`
 * and a real `Cues` index (so the result is seekable and shows the right length
 * in every player) at the cost of holding the encoded frames in memory. An
 * export is seconds long, so that cost is a few megabytes; a streaming muxer
 * would trade both of those for a property nothing here needs.
 */
export class WebmMuxer {
  private frames: WebmFrame[] = []
  constructor(private readonly opts: WebmMuxerOptions) {}

  addFrame(frame: WebmFrame) {
    this.frames.push(frame)
  }

  get frameCount() {
    return this.frames.length
  }

  finish(): Uint8Array {
    const { width, height, codec, fps, codecPrivate, writingApp, alpha } = this.opts
    if (this.frames.length === 0) throw new Error("webm: no frames")

    /* DocTypeVersion 4 when the file uses BlockAdditions and AlphaMode (as
     * libwebm writes it); 2, as always, otherwise. */
    const docVersion = alpha ? 4 : 2
    const header = el(ID.EBML, concat([
      el(ID.EBMLVersion, uint(1)),
      el(ID.EBMLReadVersion, uint(1)),
      el(ID.EBMLMaxIDLength, uint(4)),
      el(ID.EBMLMaxSizeLength, uint(8)),
      el(ID.DocType, ascii("webm")),
      el(ID.DocTypeVersion, uint(docVersion)),
      el(ID.DocTypeReadVersion, uint(2)),
    ]))

    /* Timecodes are in MILLISECONDS because TimecodeScale is 1e6 ns. Chosen so
     * the ints stay small and a cluster can span 30 s; the source timestamps
     * are microseconds and are divided here, once, in one place. */
    const last = this.frames[this.frames.length - 1]
    const durationMs = (last.timestampUs + (last.durationUs || 1e6 / fps)) / 1000

    const info = el(ID.Info, concat([
      el(ID.TimecodeScale, uint(1_000_000)),
      el(ID.MuxingApp, ascii("free-stroke")),
      el(ID.WritingApp, ascii(writingApp ?? "free-stroke/lib/export")),
      el(ID.Duration, float64(durationMs)),
    ]))

    const videoParts = [el(ID.PixelWidth, uint(width)), el(ID.PixelHeight, uint(height))]
    if (alpha) videoParts.push(el(ID.AlphaMode, uint(1)))
    const trackParts = [
      el(ID.TrackNumber, uint(TRACK_NUMBER)),
      el(ID.TrackUID, uint(TRACK_NUMBER)),
      el(ID.TrackType, uint(1)), // 1 = video
      el(ID.FlagLacing, uint(0)),
      el(ID.CodecID, ascii(codec)),
      el(ID.DefaultDuration, uint(Math.round(1e9 / fps))),
    ]
    if (codecPrivate && codecPrivate.length) trackParts.push(el(ID.CodecPrivate, codecPrivate))
    trackParts.push(el(ID.Video, concat(videoParts)))
    const tracks = el(ID.Tracks, el(ID.TrackEntry, concat(trackParts)))

    /* ---- clusters --------------------------------------------------- */
    const clusters: Uint8Array[] = []
    const cuePoints: { timeMs: number; clusterOffset: number }[] = []
    /* Offsets in Cues are relative to the START OF SEGMENT DATA, so they can be
     * accumulated as clusters are built — Info and Tracks are already sized. */
    let offset = info.length + tracks.length

    let blocks: Uint8Array[] = []
    let clusterTimeMs = 0
    let clusterHasCue = false
    let prevTimeMs = 0

    const flush = () => {
      if (blocks.length === 0) return
      const cluster = el(ID.Cluster, concat([el(ID.Timecode, uint(clusterTimeMs)), ...blocks]))
      clusters.push(cluster)
      offset += cluster.length
      blocks = []
    }

    for (const f of this.frames) {
      const tMs = Math.round(f.timestampUs / 1000)
      const needNew =
        blocks.length === 0 ||
        (f.keyFrame && blocks.length > 0) ||
        tMs - clusterTimeMs > MAX_CLUSTER_SPAN_MS
      if (needNew) {
        flush()
        clusterTimeMs = tMs
        clusterHasCue = false
      }
      const rel = tMs - clusterTimeMs
      if (rel < -32768 || rel > 32767) throw new Error(`webm: block timecode ${rel} out of int16 range`)
      const head = new Uint8Array(4)
      head[0] = 0x80 | TRACK_NUMBER // vint of the track number, 1 byte
      new DataView(head.buffer).setInt16(1, rel, false)
      if (alpha) {
        /* A BLOCKGROUP, BECAUSE A SIMPLEBLOCK HAS NOWHERE TO PUT THE ALPHA.
         * A Block has no keyframe flag; a frame that depends on another says
         * so with a ReferenceBlock (the signed offset to the frame before),
         * and a keyframe carries none. That is how ffmpeg writes it and how
         * Chrome's demuxer reads it. */
        head[3] = 0x00
        const parts = [el(ID.Block, concat([head, f.data]))]
        if (!f.keyFrame) parts.push(el(ID.ReferenceBlock, sint(prevTimeMs - tMs)))
        if (f.additional && f.additional.length) {
          parts.push(
            el(ID.BlockAdditions, el(ID.BlockMore, concat([el(ID.BlockAddID, uint(1)), el(ID.BlockAdditional, f.additional)]))),
          )
        }
        blocks.push(el(ID.BlockGroup, concat(parts)))
      } else {
        head[3] = f.keyFrame ? 0x80 : 0x00
        blocks.push(el(ID.SimpleBlock, concat([head, f.data])))
      }
      prevTimeMs = tMs
      if (f.keyFrame && !clusterHasCue) {
        // `offset` is the position this cluster WILL occupy: everything before
        // it has already been added.
        cuePoints.push({ timeMs: clusterTimeMs, clusterOffset: offset })
        clusterHasCue = true
      }
    }
    flush()

    const cues = el(ID.Cues, concat(cuePoints.map((c) =>
      el(ID.CuePoint, concat([
        el(ID.CueTime, uint(c.timeMs)),
        el(ID.CueTrackPositions, concat([
          el(ID.CueTrack, uint(TRACK_NUMBER)),
          el(ID.CueClusterPosition, uint(c.clusterOffset)),
        ])),
      ])),
    )))

    const segmentBody = concat([info, tracks, ...clusters, cues])
    return concat([header, el(ID.Segment, segmentBody)])
  }
}

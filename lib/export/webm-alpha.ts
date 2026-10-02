/**
 * TRANSPARENT WEBM: the two planes a VP9-with-alpha film is made of.
 *
 * Coverage row 96 (R2 N39): "Transparent video", MISSING until this file. Until
 * now `transparent` meant APNG, because the muxer wrote no alpha and WebCodecs
 * will not encode it.
 *
 * ── HOW WEBM CARRIES ALPHA ────────────────────────────────────────────────
 * Not as a fourth channel. A WebM with alpha is TWO ordinary VP8/VP9 streams
 * in one track: the colour stream in each Block, and a second stream whose
 * LUMA plane is the alpha, in that Block's `BlockAdditional` (BlockAddID 1),
 * with `AlphaMode = 1` on the track. That is the layout libvpx's own tools,
 * ffmpeg and Chrome's demuxer agree on, and `./webm` now writes it.
 *
 * ── WHY TWO ENCODERS AND PLANES WE BUILD OURSELVES ────────────────────────
 * Measured in this repo's Chromium (141, 2026-09-30): `VideoEncoder` with
 * `alpha: "keep"` answers `isConfigSupported` false for VP8 and VP9, and
 * `configure` throws "Alpha encoding is not currently supported." So the alpha
 * stream is a second opaque encode of a frame whose Y plane IS the alpha.
 *
 * That frame cannot come from a canvas. A grey canvas pixel (a, a, a) goes
 * through the browser's RGB to YUV conversion into LIMITED range, Y = 16 +
 * 219 * a / 255, and a decoder hands that Y back as alpha: fully transparent
 * paper would come back at alpha 16, six per cent opaque, a grey veil over
 * whatever the film is laid on. So both frames are built here as I420 buffers,
 * the alpha plane written straight (Y = a, chroma neutral), and handed to
 * `new VideoFrame(buffer, { format: "I420" })`. The gate's known-bad arm is
 * exactly that veil.
 *
 * ── THE COLOUR UNDER A TRANSPARENT PIXEL ──────────────────────────────────
 * Chroma is shared by a 2x2 block. Averaged plainly, the transparent black
 * around a stroke would darken its edge colour; so chroma is averaged WEIGHTED
 * BY ALPHA, and a fully transparent pixel takes its block's weighted luma.
 * What a viewer composites is colour times alpha, so a transparent pixel's own
 * colour is never seen, only its bleed into its neighbours, and this makes that
 * bleed the ink's colour rather than black.
 *
 * Colour is BT.601 limited range (`smpte170m`), which is what VP9 decoders
 * assume for an untagged stream, and the frame says so in its `colorSpace`.
 *
 * Pure: no DOM, no three, no app module, so the planes are checked in node
 * by `assert-export-webm-alpha.mjs`.
 */

export interface I420Pair {
  /** The colour frame, I420: Y (w*h), then U and V ((w/2)*(h/2) each). */
  color: Uint8Array
  /** The alpha frame, I420: Y = alpha, U = V = 128. */
  alpha: Uint8Array
  width: number
  height: number
}

/** Byte length of one I420 frame of even `w` x `h`. */
export function i420Size(w: number, h: number): number {
  return w * h + 2 * ((w >> 1) * (h >> 1))
}

const clamp8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v))

/** BT.601 limited range, the matrix `smpte170m` names. */
export function rgbToYuv601(r: number, g: number, b: number): [number, number, number] {
  return [
    16 + (65.481 * r + 128.553 * g + 24.966 * b) / 255,
    128 + (-37.797 * r - 74.203 * g + 112.0 * b) / 255,
    128 + (112.0 * r - 93.786 * g - 18.214 * b) / 255,
  ]
}

/**
 * Straight (not premultiplied) RGBA, even `w` x `h`, to the colour frame and
 * the alpha frame of one WebM-with-alpha picture.
 */
export function rgbaToI420Pair(rgba: Uint8Array, w: number, h: number): I420Pair {
  if (w % 2 || h % 2) throw new Error(`webm-alpha: ${w}x${h} is not even`)
  if (rgba.length < w * h * 4) throw new Error("webm-alpha: short RGBA buffer")
  const size = i420Size(w, h)
  const color = new Uint8Array(size)
  const alpha = new Uint8Array(size)
  const cw = w >> 1
  const ch = h >> 1
  const uOff = w * h
  const vOff = uOff + cw * ch
  alpha.fill(128, uOff)

  for (let by = 0; by < ch; by++) {
    for (let bx = 0; bx < cw; bx++) {
      let aSum = 0
      let ySum = 0
      let uSum = 0
      let vSum = 0
      const ys: number[] = [0, 0, 0, 0]
      const as: number[] = [0, 0, 0, 0]
      for (let k = 0; k < 4; k++) {
        const x = bx * 2 + (k & 1)
        const y = by * 2 + (k >> 1)
        const o = (y * w + x) * 4
        const a = rgba[o + 3]
        const [Y, U, V] = rgbToYuv601(rgba[o], rgba[o + 1], rgba[o + 2])
        ys[k] = Y
        as[k] = a
        aSum += a
        ySum += Y * a
        uSum += U * a
        vSum += V * a
        alpha[y * w + x] = a
      }
      const yFill = aSum > 0 ? ySum / aSum : 16
      for (let k = 0; k < 4; k++) {
        const x = bx * 2 + (k & 1)
        const y = by * 2 + (k >> 1)
        color[y * w + x] = clamp8(as[k] > 0 ? ys[k] : yFill)
      }
      color[uOff + by * cw + bx] = clamp8(aSum > 0 ? uSum / aSum : 128)
      color[vOff + by * cw + bx] = clamp8(aSum > 0 ? vSum / aSum : 128)
    }
  }
  return { color, alpha, width: w, height: h }
}

/** The `VideoColorSpaceInit` the colour frame is written in. */
export const WEBM_ALPHA_COLOR_SPACE = {
  primaries: "smpte170m",
  transfer: "smpte170m",
  matrix: "smpte170m",
  fullRange: false,
} as const

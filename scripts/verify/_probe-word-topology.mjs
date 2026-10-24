// READ THE TOPOLOGY OFF A RENDERED FRAME — counters and pieces, in pixels.
//
// The geometry probe (`_probe-font-legibility.mjs`) answers what the font CAN
// do. This answers what the page DID: the same two counts, taken off the actual
// stage screenshot, so wobble, the tube builder, the carve and the reveal are
// all inside the measurement rather than assumed away.
//
// Shared by `_probe-word-ladder.mjs`'s reader and by
// `assert-hero-word-legible.mjs`, so the gate and the eye are reading the same
// numbers off the same pixels.
import sharp from "sharp"

/** Connected components of `want` in a mask. 8-connected ink, 4-connected paper. */
function components(mask, W, H, want, eight) {
  const seen = new Uint8Array(W * H)
  const stack = new Int32Array(W * H)
  const out = []
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || mask[i] !== want) continue
    let sp = 0
    stack[sp++] = i
    seen[i] = 1
    let border = false
    let size = 0
    while (sp > 0) {
      const c = stack[--sp]
      size++
      const cx = c % W
      const cy = (c - cx) / W
      if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) border = true
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          if (!eight && dx !== 0 && dy !== 0) continue
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const n = ny * W + nx
          if (seen[n] || mask[n] !== want) continue
          seen[n] = 1
          stack[sp++] = n
        }
      }
    }
    out.push({ border, size })
  }
  return out
}

/**
 * Measure one frame.
 *
 * `minPiecePx` / `minCounterPx` throw away specks. They are set from the
 * measured ink, not from a constant: a counter is a fraction of the mark's own
 * ink area, so the same thresholds work whether the word fills the frame or
 * sits small inside it. Without that, a gate calibrated on a big word passes
 * everything on a small one — the failure mode where a green row is measuring
 * nothing at all.
 */
export async function frameTopology(pngPath, { inkMax = 110 } = {}) {
  const { data, info } = await sharp(pngPath)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const W = info.width
  const H = info.height
  const mask = new Uint8Array(W * H)
  let inkPx = 0
  for (let i = 0; i < W * H; i++) {
    if (data[i] <= inkMax) {
      mask[i] = 1
      inkPx++
    }
  }
  if (inkPx === 0) return { inkPx: 0, pieces: 0, counters: 0, W, H }

  const minPiece = Math.max(24, inkPx * 0.0015)
  const minCounter = Math.max(12, inkPx * 0.0004)
  const ink = components(mask, W, H, 1, true).filter((c) => c.size >= minPiece)
  const paper = components(mask, W, H, 0, false).filter((c) => !c.border && c.size >= minCounter)
  return { inkPx, pieces: ink.length, counters: paper.length, W, H }
}

// HOW MUCH IS ACTUALLY IN THE FRAME YOU JUST SAVED.
//
// WHY THIS EXISTS, and it is a guard-that-could-not-fail caught in the act.
// The blank-frame guard copied between the capture scripts here counted ink by
// walking `document.querySelectorAll("canvas")`, taking the LARGEST, and reading
// pixels off it. On this page the largest canvas is the 2-D DRAWING canvas —
// the one holding the strokes the user drew — not the 3-D canvas
// `__captureHarness.grab()` returns. Measured 2026-07-31 across twelve captures
// of four different builds at three different camera positions: `ink` came back
// as exactly 863 on EVERY ONE of them. It was reporting the same 2-D drawing
// twelve times while three of the saved frames were completely EMPTY 3-D
// renders, and it passed all twelve.
//
// So the guard now reads the BYTES THAT WERE WRITTEN TO DISK. It decodes the
// grabbed PNG with @napi-rs/canvas (Skia — already a devDependency, already the
// rasteriser engine-node.mjs uses) and counts pixels that are neither
// transparent nor page-white. A frame whose only content is the studio's grid
// lines scores in the low hundreds; a frame with a form in it scores in the tens
// of thousands, so the two do not overlap and the threshold is not a tuning.
import { createCanvas, loadImage } from "@napi-rs/canvas"

/**
 * @param {Buffer} png the exact bytes about to be (or just) written to disk
 * @returns {Promise<{ink:number, total:number, frac:number}>}
 */
export async function frameInk(png) {
  const img = await loadImage(png)
  const cv = createCanvas(img.width, img.height)
  const g = cv.getContext("2d")
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, img.width, img.height).data
  let ink = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= 8) continue
    if (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245) continue
    ink++
  }
  const total = img.width * img.height
  return { ink, total, frac: ink / total }
}

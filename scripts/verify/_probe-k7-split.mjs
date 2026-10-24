// WHICH FRAGMENT CAME OFF, AND WHERE — the component diff the intact gate's
// verdict does not carry.
//
// `assert-hero-k7-intact.mjs` reports two COUNTS. A count cannot say which part
// of the drawing fell off, and the fix for an over-cut break depends entirely on
// which one did. So this labels both frames' components, matches them by pixel
// overlap, and prints every K7 component that is not the same body as the K1
// component it sits inside — with its bounding box, so the next step can crop
// there and LOOK at it.
//
// It also writes a 5x side-by-side crop per split, K1 left / K7 right, because
// this defect was found by eye at 5x and every judgement about the fix has to be
// made at that magnification too.
//
// Usage: node scripts/verify/_probe-k7-split.mjs [--a=k1.png] [--b=k7.png] [--tag=]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createCanvas, loadImage } from "@napi-rs/canvas"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const DIR = join(ROOT, "docs", "verification", "hero-k7", "intact")
const A = arg("a", join(DIR, "k1.png"))
const B = arg("b", join(DIR, "k7.png"))
const TAG = arg("tag", "")
const OUT = join(ROOT, "docs", "verification", "hero-k7", "split")

// Identical to the gate's, deliberately — a diff measured under a different
// threshold would explain a defect the gate is not seeing.
const INK_MAX_LUMA = 150
const MIN_COMPONENT_PX = 40

async function label(path) {
  const img = await loadImage(readFileSync(path))
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const mask = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    mask[p] = l <= INK_MAX_LUMA ? 1 : 0
  }
  const lab = new Int32Array(W * H).fill(-1)
  const comps = []
  const stack = new Int32Array(W * H)
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || lab[s] >= 0) continue
    const id = comps.length
    let sp = 0
    stack[sp++] = s
    lab[s] = id
    let n = 0
    let x0 = 1e9
    let y0 = 1e9
    let x1 = -1
    let y1 = -1
    while (sp > 0) {
      const p = stack[--sp]
      n++
      const x = p % W
      const y = (p / W) | 0
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const q = ny * W + nx
          if (!mask[q] || lab[q] >= 0) continue
          lab[q] = id
          stack[sp++] = q
        }
    }
    comps.push({ id, n, x0, y0, x1, y1 })
  }
  return { W, H, mask, lab, comps, img, full: { W: img.width, H: img.height } }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const a = await label(A)
  const b = await label(B)
  const realA = a.comps.filter((c) => c.n >= MIN_COMPONENT_PX)
  const realB = b.comps.filter((c) => c.n >= MIN_COMPONENT_PX)
  console.log(`A ${A}\n  ${realA.length} components: ${realA.map((c) => c.n).sort((p, q) => q - p).join(", ")}`)
  console.log(`B ${B}\n  ${realB.length} components: ${realB.map((c) => c.n).sort((p, q) => q - p).join(", ")}\n`)

  /* MATCH BY OVERLAP. Every B component's pixels are a subset of the ink that
   * was there in A (the break only removes), so each B component sits inside
   * exactly one A component — the one it shares the most pixels with. Any A
   * component that ends up with more than one B child is a body that came
   * APART, and its smaller children are the fragments that came off. */
  const parent = new Map() // B id -> {aId, shared}
  for (const cb of realB) {
    const tally = new Map()
    for (let p = 0; p < b.lab.length; p++) {
      if (b.lab[p] !== cb.id) continue
      const ai = a.lab[p]
      if (ai < 0) continue
      tally.set(ai, (tally.get(ai) ?? 0) + 1)
    }
    let best = -1
    let bestN = 0
    for (const [k, v] of tally) if (v > bestN) ((bestN = v), (best = k))
    parent.set(cb.id, { aId: best, shared: bestN })
  }

  const kids = new Map()
  for (const cb of realB) {
    const k = parent.get(cb.id).aId
    ;(kids.get(k) ?? kids.set(k, []).get(k)).push(cb)
  }

  const splits = []
  for (const [aId, list] of kids) {
    if (list.length < 2) continue
    list.sort((p, q) => q.n - p.n)
    const ca = a.comps.find((c) => c.id === aId)
    console.log(
      `A#${aId} (${ca.n} px, bbox ${ca.x0},${ca.y0}..${ca.x1},${ca.y1}) came apart into ` +
        `${list.length}: ${list.map((c) => `${c.n}px@${c.x0},${c.y0}..${c.x1},${c.y1}`).join("  ")}`,
    )
    for (const frag of list.slice(1)) splits.push({ aId, frag })
  }
  if (!splits.length) console.log("no split: every A body has exactly one B child.")

  /* THE 5x CROPS. One per fragment, framed on the fragment with a margin wide
   * enough to carry the break that isolated it and the stroke it came off. */
  let i = 0
  for (const { frag } of splits) {
    i++
    const M = 34
    const x0 = Math.max(0, frag.x0 - M)
    const y0 = Math.max(0, frag.y0 - M)
    const x1 = Math.min(a.full.W - 1, frag.x1 + M)
    const y1 = Math.min(a.full.H - 1, frag.y1 + M)
    const w = x1 - x0 + 1
    const h = y1 - y0 + 1
    const Z = 5
    const c = createCanvas(w * Z * 2 + 12, h * Z)
    const ctx = c.getContext("2d")
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = "#ff3b30"
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(a.img, x0, y0, w, h, 0, 0, w * Z, h * Z)
    ctx.drawImage(b.img, x0, y0, w, h, w * Z + 12, 0, w * Z, h * Z)
    const p = join(OUT, `split${TAG ? `-${TAG}` : ""}-${i}.png`)
    writeFileSync(p, c.toBuffer("image/png"))
    console.log(`  crop ${frag.n}px  ${x0},${y0} ${w}x${h} @5x  ->  ${p}`)
  }
  console.log(`\nout: ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

// THE WHOLE BEAT'S TONAL ARC, TWO CAPTURES SIDE BY SIDE, PHASE BY PHASE.
//
// The switch is one instant, and a fix aimed at one instant can wreck the rest
// of the film without anything in the emerge window noticing. Two things in
// particular have to be looked at end to end and neither is in the emerge:
//
//   · K7 — the RETURN. The object goes back to being a drawing, so making the
//     object lighter makes the return a BIGGER tonal event too. That is either
//     a strengthening of the round trip or an overshoot, and only the arc says
//     which.
//   · The held ¾ and the orbit, which is where `assert-hero-transition` gate 2
//     samples and where a brighter form is most likely to stop reading as ink.
//
// It reads two labels' `scrub/` directories through the value-wash gate's own
// eroded-interior statistic and prints them against the phase each frame is in,
// taken from the capture's own manifest rather than from a hardcoded second.
//
// Usage: node scripts/verify/_probe-beat-arc.mjs --a=pre-tone --b=lit-after
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const A = arg("a", "pre-tone")
const B = arg("b", "lit-after")
const INK_MAX_LUMA = 150
const ERODE = 3

function dirOf(label) {
  const d = join(ROOT, "docs", "verification", "hero-transition", label)
  if (!existsSync(d)) {
    console.error(`no capture "${label}" at ${d} — refusing to report on evidence that does not exist`)
    process.exit(1)
  }
  return d
}

async function seriesOf(label) {
  const base = dirOf(label)
  const scrub = join(base, "scrub")
  const man = JSON.parse(readFileSync(join(base, "manifest.json"), "utf8"))
  /* `manifest.json`'s per-frame array is called `manifest`, not `frames` —
   * `frames` is the COUNT. Reading the wrong one silently produced a table
   * whose every phase column was "-" and one bucket called "?", which still
   * printed a plausible arc. Named here because it is the same class as every
   * other defect in this beat's tooling: a lookup that returns nothing and a
   * report that looks fine. */
  const list = Array.isArray(man.manifest) ? man.manifest : []
  if (!list.length) {
    console.error(`capture "${label}" has no per-frame manifest — refusing to report phases it cannot read`)
    process.exit(1)
  }
  const phases = new Map(list.map((m) => [m.i, m]))
  const files = readdirSync(scrub).filter((f) => f.endsWith(".png")).sort()
  const out = []
  for (const f of files) {
    const i = parseInt(f, 10)
    const img = await loadImage(join(scrub, f))
    const c = createCanvas(img.width, img.height)
    const x = c.getContext("2d")
    x.drawImage(img, 0, 0)
    const { data } = x.getImageData(0, 0, img.width, img.height)
    const W = img.width
    const H = Math.floor(img.height * 0.75)
    const luma = new Float32Array(W * H)
    for (let p = 0; p < W * H; p++) {
      const q = p * 4
      luma[p] = 0.2126 * data[q] + 0.7152 * data[q + 1] + 0.0722 * data[q + 2]
    }
    let cur = new Uint8Array(W * H)
    for (let p = 0; p < W * H; p++) cur[p] = luma[p] <= INK_MAX_LUMA ? 1 : 0
    for (let pass = 0; pass < ERODE; pass++) {
      const next = new Uint8Array(W * H)
      for (let y = 1; y < H - 1; y++)
        for (let px = 1; px < W - 1; px++) {
          const p = y * W + px
          if (!cur[p]) continue
          if (
            cur[p - 1] && cur[p + 1] && cur[p - W] && cur[p + W] &&
            cur[p - W - 1] && cur[p - W + 1] && cur[p + W - 1] && cur[p + W + 1]
          ) next[p] = 1
        }
      cur = next
    }
    const vals = []
    for (let p = 0; p < W * H; p++) if (cur[p]) vals.push(luma[p])
    const s = vals.slice().sort((a, b) => a - b)
    out.push({
      i,
      phase: phases.get(i)?.phase ?? null,
      t: phases.get(i)?.t ?? null,
      med: s.length ? s[Math.floor(s.length / 2)] : null,
      n: s.length,
    })
  }
  return out
}

const a = await seriesOf(A)
const b = await seriesOf(B)
console.log(`\n   f      t        phase       ${A.padEnd(10)} ${B.padEnd(10)}   Δ`)
for (let i = 0; i < Math.min(a.length, b.length); i++) {
  const ra = a[i], rb = b[i]
  const d = ra.med !== null && rb.med !== null ? rb.med - ra.med : null
  console.log(
    String(ra.i).padStart(4),
    (ra.t === null ? "-" : ra.t.toFixed(2)).padStart(7),
    String(ra.phase ?? "-").padStart(13),
    (ra.med === null ? "-" : ra.med.toFixed(1)).padStart(10),
    (rb.med === null ? "-" : rb.med.toFixed(1)).padStart(10),
    (d === null ? "-" : (d >= 0 ? "+" : "") + d.toFixed(1)).padStart(8),
  )
}
/* PER PHASE, because that is the unit the beat is authored in and a per-frame
 * list is not readable as an arc. */
console.log("\nPER PHASE — interior median, mean over the phase's frames")
const byPhase = new Map()
for (let i = 0; i < Math.min(a.length, b.length); i++) {
  const p = a[i].phase ?? "?"
  if (!byPhase.has(p)) byPhase.set(p, { a: [], b: [] })
  if (a[i].med !== null) byPhase.get(p).a.push(a[i].med)
  if (b[i].med !== null) byPhase.get(p).b.push(b[i].med)
}
console.log("phase".padEnd(15) + A.padStart(10) + B.padStart(12) + "        Δ   frames")
for (const [p, v] of byPhase) {
  if (!v.a.length || !v.b.length) continue
  const ma = v.a.reduce((x, y) => x + y, 0) / v.a.length
  const mb = v.b.reduce((x, y) => x + y, 0) / v.b.length
  console.log(
    p.padEnd(15) + ma.toFixed(1).padStart(10) + mb.toFixed(1).padStart(12) +
      ((mb - ma >= 0 ? "+" : "") + (mb - ma).toFixed(1)).padStart(9) +
      String(v.a.length).padStart(8),
  )
}

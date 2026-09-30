// CALIBRATION PROBE FOR GATE 1'S STATISTIC — how much trim, and where it breaks.
//
// Gate 1 (`assert-hero-transition.mjs`) is *"a flat drawn mark is ONE VALUE
// inside a hard silhouette"*, measured as the standard deviation of the ink's
// luminance after a 3-px isotropic erosion drops the antialiased boundary.
//
// At full pen carve that statistic reads 1.256 on a picture that is correct:
// 4148 of 4151 interior pixels sit at exactly luma 21 and THREE do not, at the
// tip of a hairline paper gap the carve opens between two strokes of the "D".
// An isotropic erosion cannot reach a sub-pixel CONCAVE notch — every one of
// that pixel's 48 neighbours is ink — so the ramp survives inside the interior
// by construction. Those three pixels are COVERAGE samples, not surface
// samples: their value is a blend with the paper and carries no information
// about shading.
//
// This probe exists to choose the tolerance from data rather than from taste.
// It sweeps the trim fraction across every arm at once and prints, for each:
//
//   * the raw sd / spread          (today's verdict)
//   * the trimmed sd / spread      (the candidate)
//   * the off-modal residue        (how many pixels are not at the one value)
//
// and then finds the BREAK-EVEN trim — the fraction at which the negative
// control (`before/`, lit inflate tubes head-on: sd 5.8, spread 65.6) would
// start to pass. A tolerance is only calibrated if the distance to that number
// is stated.
//
// Usage: node scripts/verify/_probe-flat-value.mjs
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { flatInterior } from "./lib/flat-interior.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

/** The breath frame of a scrub capture — the frame gate 1 actually judges. */
function breathFrame(label) {
  const base = join(ROOT, "docs", "verification", "hero-transition", label)
  const manifest = JSON.parse(readFileSync(join(base, "manifest.json"), "utf8"))
  const breath = manifest.manifest.filter((m) => m.phase === "breath")
  const i = breath.length ? breath[Math.floor(breath.length / 2)].i : 20
  return join(base, "scrub", String(i).padStart(4, "0") + ".png")
}

/** Trimmed sd + spread over the interior, discarding `frac` at EACH end. */
function trimmed(vals, frac) {
  const k = Math.floor(frac * vals.length)
  const kept = k > 0 ? vals.slice(k, vals.length - k) : vals
  if (kept.length === 0) return { n: 0, sd: 0, spread: 0, cut: k }
  let s = 0
  let s2 = 0
  for (const v of kept) {
    s += v
    s2 += v * v
  }
  const m = s / kept.length
  return {
    n: kept.length,
    sd: Math.sqrt(Math.max(0, s2 / kept.length - m * m)),
    spread: kept[kept.length - 1] - kept[0],
    cut: k,
  }
}

function residue(vals) {
  const h = new Map()
  for (const v of vals) {
    const k = Math.round(v)
    h.set(k, (h.get(k) ?? 0) + 1)
  }
  let modal = 0
  let best = -1
  for (const [k, c] of h) if (c > best) ((best = c), (modal = k))
  let off = 0
  for (const v of vals) if (Math.abs(v - modal) > 1) off++
  return { modal, off, frac: off / vals.length }
}

async function arm(name, png) {
  if (!existsSync(png)) return null
  const it = await flatInterior(readFileSync(png))
  const vals = []
  for (let p = 0; p < it.luma.length; p++) if (it.interior[p]) vals.push(it.luma[p])
  vals.sort((a, b) => a - b)
  return { name, png, it, vals, res: residue(vals) }
}

const FRACS = [0, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2]

async function main() {
  const arms = (
    await Promise.all([
      arm("flat, CARVED (penCarve 1)", join(ROOT, "docs/verification/pen-carve/flat-carve1.png")),
      arm("flat, uncarved (penCarve 0)", join(ROOT, "docs/verification/pen-carve/flat-carve0.png")),
      arm("BEFORE — lit tubes head-on ⛔", breathFrame("before")),
      arm("k7final breath", breathFrame("k7final")),
      arm("reg-affine breath", breathFrame("reg-affine")),
    ])
  ).filter(Boolean)

  for (const a of arms) {
    console.log(`\n── ${a.name}`)
    console.log(`   interior ${a.vals.length} px · modal luma ${a.res.modal} · off-modal ${a.res.off} (${(100 * a.res.frac).toFixed(4)} %)`)
    console.log(`   trim%     kept      sd     spread`)
    for (const f of FRACS) {
      const t = trimmed(a.vals, f)
      console.log(
        `   ${(100 * f).toFixed(2).padStart(6)}  ${String(t.n).padStart(7)}  ` +
          `${t.sd.toFixed(3).padStart(7)}  ${t.spread.toFixed(1).padStart(7)}` +
          (f === 0 ? "   <- today's verdict" : ""),
      )
    }
  }

  /* ---- THE BREAK-EVEN: where the negative control would start to pass ---- */
  const ctrl = arms.find((a) => a.name.startsWith("BEFORE"))
  if (ctrl) {
    const findBreak = (pred) => {
      // Fine sweep, so the answer is a number and not a bracket.
      for (let f = 0; f <= 0.49; f += 0.0005) {
        if (pred(trimmed(ctrl.vals, f))) return f
      }
      return null
    }
    const bSd = findBreak((t) => t.sd < 1)
    const bSpread = findBreak((t) => t.spread < 8)
    console.log(`\n── BREAK-EVEN on the negative control (must never be reached)`)
    console.log(`   sd < 1      first passes at trim ${bSd === null ? "never (> 49 %)" : (100 * bSd).toFixed(2) + " %"}`)
    console.log(`   spread < 8  first passes at trim ${bSpread === null ? "never (> 49 %)" : (100 * bSpread).toFixed(2) + " %"}`)
    console.log(`   off-modal residue on the control: ${(100 * ctrl.res.frac).toFixed(2)} % of its interior`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

// Turns the material/fusion/stack/timing craft frames into verdicts.
//
// The split matters (see docs/README.md): verify-* captures, assert-* decides.
// What this decides, per phase:
//
//   presets  every material preset must be DISTINGUISHABLE from every other
//            one — not merely different from "off". Reports the full pairwise
//            distance matrix and names the collapsed pairs.
//   dials    every dial must keep changing the render across its whole range.
//            Reports per-step delta and the point where a dial goes inert.
//   matanim  every animation must MOVE, and the movement must have range.
//   fusion   every preset must differ from its own un-fused baseline AND from
//            the other fusion presets; animated must differ from static.
//   stack    blends/orders must not collapse onto each other.
//   timing   the six sync modes must behave differently, not be six names for
//            "it moves".
//
// Usage: node scripts/verify/assert-material-craft.mjs --phase=presets
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readdirSync, existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { captureFreshness } from "./_capture-freshness.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")

/** `StyleSyncMode`, read from source so "the six sync modes" in the header is a
 *  fact this file can check rather than a number it repeats. */
function declaredSyncModes() {
  const src = readFileSync(join(ROOT, "lib", "style-system.ts"), "utf8")
  const m = src.match(/export type StyleSyncMode\s*=([\s\S]*?)\n\n/)
  if (!m) throw new Error("could not read StyleSyncMode from lib/style-system.ts")
  return [...m[1].matchAll(/"([a-zA-Z]+)"/g)].map((x) => x[1])
}
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=")[1] : d
}
const PHASE = arg("phase", "presets")
const DIR = join(ROOT, "docs", "verification", "material-craft", arg("label", PHASE))

const cache = new Map()
async function px(file) {
  if (cache.has(file)) return cache.get(file)
  const img = await loadImage(join(DIR, file))
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  const v = { d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height }
  cache.set(file, v)
  return v
}

/** Mean absolute RGB difference over pixels where EITHER frame has ink. */
function diff(a, b) {
  let sum = 0, n = 0, max = 0
  for (let i = 0; i < a.d.length; i += 4) {
    if (a.d[i + 3] < 20 && b.d[i + 3] < 20) continue
    const d = (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2])) / 3
    sum += d
    if (d > max) max = d
    n++
  }
  return { mean: n ? sum / n : 0, max, px: n }
}

/** Perceptual descriptors of one render, over inked pixels only. */
function stats(a) {
  let n = 0, sr = 0, sg = 0, sb = 0
  const lum = []
  for (let i = 0; i < a.d.length; i += 4) {
    if (a.d[i + 3] < 40) continue
    const r = a.d[i], g = a.d[i + 1], b = a.d[i + 2]
    sr += r; sg += g; sb += b
    lum.push(0.2126 * r + 0.7152 * g + 0.0722 * b)
    n++
  }
  if (!n) return null
  lum.sort((x, y) => x - y)
  const q = (p) => lum[Math.min(lum.length - 1, Math.floor(p * lum.length))]
  const mean = lum.reduce((s, v) => s + v, 0) / n
  const sd = Math.sqrt(lum.reduce((s, v) => s + (v - mean) ** 2, 0) / n) || 1
  // GLOSS, measured the way the perception literature measures it.
  // Motoyoshi, Nishida, Sharan & Adelson (Nature 447, 2007) showed that the
  // SKEWNESS of the luminance histogram predicts perceived glossiness, and is
  // inversely correlated with perceived albedo: a glossy surface is mostly
  // dark with a small very bright tail (strong positive skew). A pale matte
  // surface has a symmetric, clipped histogram (skew ≈ 0 or negative) and
  // CANNOT read as glossy however low its roughness is. That is why a
  // near-white "glazed" preset collapses onto a near-white "chalk" one: they
  // are both pinned at the top of the display range with no room for a tail.
  const skew = lum.reduce((s, v) => s + ((v - mean) / sd) ** 3, 0) / n
  return {
    n,
    lum: mean,
    // specular headroom: how far the brightest 1% sits above the median. This
    // is what separates "glossy" from "matte" numerically.
    spec: q(0.99) - q(0.5),
    skew,
    contrast: sd,
    // chroma: max channel spread. Near 0 = neutral gray family.
    chroma: Math.max(sr, sg, sb) / n - Math.min(sr, sg, sb) / n,
    r: sr / n, g: sg / n, b: sb / n,
  }
}

const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".png")) : []
/* DEFERRED, not exited on here — the CONTROLS at the bottom of this file must
 * run on the bare invocation whether or not this tree carries capture frames.
 * Four of the five need no frames at all, and a gate that skips its own controls
 * because the SUBJECT's evidence is missing has the dependency backwards. */
const NO_FRAMES = !files.length
let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function presets() {
  /* ⚠ `if (!list.length) continue` WAS A SILENT ZERO-CHECK EXIT (class 7).
   *
   * The view x mode grid is hardcoded — three views, two modes — and every cell
   * that found no files was skipped without a word. Point this phase at a
   * directory captured by a different phase and all six cells skip, `fails`
   * stays 0, and the script prints "all checks pass" and exits 0. Demonstrated:
   *
   *   node scripts/verify/assert-material-craft.mjs --phase=matanim --label=presets
   *   -> (no output) -> "all checks pass" -> exit 0
   *
   * A phase that examined nothing must not be indistinguishable from a phase
   * that examined everything and found it sound. The skip is kept — a genuinely
   * absent cell is normal, since not every capture run films every view — but it
   * is now COUNTED, and the phase refuses if no cell was ever populated. The
   * exit-code guard at the bottom of the file is the second half of this fix. */
  let cellsFound = 0
  const cellsEmpty = []
  for (const view of ["front", "orbit", "close"]) {
    for (const mode of ["solid", "rod"]) {
      const list = files.filter((f) => f.startsWith(`${view}_${mode}_`))
      if (!list.length) { cellsEmpty.push(`${view}/${mode}`); continue }
      cellsFound++
      const names = list.map((f) => f.replace(`${view}_${mode}_`, "").replace(".png", ""))
      console.log(`\n=== ${view} / ${mode} — per-preset descriptors ===`)
      console.log("preset            lum    spec   skew   contr  chroma   rgb")
      const S = {}
      for (const [i, f] of list.entries()) {
        const s = stats(await px(f))
        S[names[i]] = s
        console.log(
          `${names[i].padEnd(16)} ${s.lum.toFixed(1).padStart(6)} ${s.spec.toFixed(1).padStart(6)} ` +
          `${s.skew.toFixed(2).padStart(6)} ` +
          `${s.contrast.toFixed(1).padStart(6)} ${s.chroma.toFixed(1).padStart(6)}   ` +
          `${Math.round(s.r)},${Math.round(s.g)},${Math.round(s.b)}`,
        )
      }
      // pairwise distance
      const pairs = []
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const d = diff(await px(list[i]), await px(list[j]))
          pairs.push({ a: names[i], b: names[j], mean: d.mean })
        }
      }
      pairs.sort((x, y) => x.mean - y.mean)
      console.log(`--- closest 8 pairs (${view}/${mode}) ---`)
      for (const p of pairs.slice(0, 8)) {
        console.log(`  ${p.mean.toFixed(2).padStart(6)}  ${p.a} ~ ${p.b}`)
      }
      const collapsed = pairs.filter((p) => p.mean < 4)
      say(collapsed.length === 0, `${view}/${mode} — no collapsed preset pairs (<4)`,
        collapsed.length ? collapsed.map((p) => `${p.a}~${p.b}=${p.mean.toFixed(1)}`).join(", ") : `min ${pairs[0].mean.toFixed(1)}`)
    }
  }
  say(
    cellsFound > 0,
    "the preset phase found at least one populated view/mode cell to grade",
    cellsFound
      ? `${cellsFound} of 6 cells populated${cellsEmpty.length ? ` (empty: ${cellsEmpty.join(", ")})` : ""}`
      : `ALL SIX CELLS EMPTY in ${DIR} — this phase graded nothing. The directory holds ${files.length} PNG(s), none named <view>_<mode>_*. Wrong --label for --phase=presets?`,
  )
}

async function dials() {
  const groups = {}
  for (const f of files) {
    const m = f.match(/^(matint|fusint|stackop|custom)_(.+)_(\d{3})\.png$/)
    if (!m) continue
    const key = `${m[1]}_${m[2]}`
    ;(groups[key] ||= []).push({ f, v: parseInt(m[3], 10) })
  }
  for (const key of Object.keys(groups).sort()) {
    const g = groups[key].sort((a, b) => a.v - b.v)
    const base = await px(g[0].f)
    const rows = []
    let prev = base
    for (const s of g) {
      const cur = await px(s.f)
      rows.push({ v: s.v, fromZero: diff(base, cur).mean, step: diff(prev, cur).mean })
      prev = cur
    }
    const total = rows[rows.length - 1].fromZero
    // A dial's step deltas tell you WHERE it works. Dead zone = a run of
    // consecutive steps that each move the render less than 1% of the dial's
    // full travel.
    const deadThresh = Math.max(0.35, total * 0.04)
    const dead = rows.slice(1).filter((r) => r.step < deadThresh).map((r) => r.v)
    console.log(
      `\n${key}: total travel ${total.toFixed(2)}  steps [` +
      rows.slice(1).map((r) => r.step.toFixed(2)).join(" ") + "]",
    )
    say(total >= 2.0, `${key} — dial has visible travel end to end`, `Δ ${total.toFixed(2)}`)
    say(dead.length <= 3, `${key} — no large dead zone`, dead.length ? `inert at ${dead.join(",")}` : "live across range")
  }
}

async function motion(prefix, minMean, minRange) {
  const groups = {}
  for (const f of files) {
    const m = f.match(new RegExp(`^${prefix}_(.+)_(\\d{2})(_[a-z]+)?\\.png$`))
    if (!m) continue
    ;(groups[m[1]] ||= []).push(f)
  }
  for (const key of Object.keys(groups).sort()) {
    const g = groups[key].sort()
    const imgs = []
    for (const f of g) imgs.push(await px(f))
    const steps = []
    for (let i = 1; i < imgs.length; i++) steps.push(diff(imgs[i - 1], imgs[i]).mean)
    // Range across the WHOLE take: the largest distance between any two frames.
    let range = 0
    for (let i = 0; i < imgs.length; i++)
      for (let j = i + 1; j < imgs.length; j++)
        range = Math.max(range, diff(imgs[i], imgs[j]).mean)
    const mean = steps.reduce((s, v) => s + v, 0) / steps.length
    const still = steps.filter((s) => s < 0.15).length
    console.log(
      `\n${prefix}/${key}: frames ${g.length}  mean step ${mean.toFixed(2)}  ` +
      `range ${range.toFixed(2)}  still frames ${still}/${steps.length}`,
    )
    say(mean >= minMean, `${prefix}/${key} — moves frame to frame`, `mean Δ ${mean.toFixed(2)}`)
    say(range >= minRange, `${prefix}/${key} — has real amplitude`, `range ${range.toFixed(2)}`)
  }
}

async function fusion() {
  // 1. each fusion preset must depart from its own un-fused baseline
  const presetsSeen = new Set()
  for (const f of files) {
    const m = f.match(/^fus_(.+?)_(static|anim)_00\.png$/)
    if (m) presetsSeen.add(m[1])
  }
  console.log("\n=== fusion vs its own un-fused baseline ===")
  for (const p of [...presetsSeen].sort()) {
    for (const tag of ["static", "anim"]) {
      const frames = files.filter((f) => f.startsWith(`fus_${p}_${tag}_`)).sort()
      if (!frames.length || !existsSync(join(DIR, `base_${p}.png`))) continue
      const b = await px(`base_${p}.png`)
      let maxd = 0
      for (const f of frames) maxd = Math.max(maxd, diff(b, await px(f)).mean)
      say(maxd >= 2.0, `fusion ${p}/${tag} — departs from un-fused baseline`, `max Δ ${maxd.toFixed(2)}`)
    }
  }
  // 2. animated must differ from static
  console.log("\n=== animated fusion vs static fusion ===")
  for (const p of [...presetsSeen].sort()) {
    const s = files.filter((f) => f.startsWith(`fus_${p}_static_`)).sort()
    const a = files.filter((f) => f.startsWith(`fus_${p}_anim_`)).sort()
    if (!s.length || !a.length) continue
    let best = 0
    for (let i = 0; i < Math.min(s.length, a.length); i++) {
      best = Math.max(best, diff(await px(s[i]), await px(a[i])).mean)
    }
    say(best >= 1.5, `fusion ${p} — animated is a different behaviour from static`, `max Δ ${best.toFixed(2)}`)
  }
  // 3. presets must not collapse onto each other
  console.log("\n=== fusion preset separation (static, frame 00) ===")
  const list = [...presetsSeen].sort().filter((p) => existsSync(join(DIR, `fus_${p}_static_00.png`)))
  const pairs = []
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      pairs.push({ a: list[i], b: list[j], mean: diff(await px(`fus_${list[i]}_static_00.png`), await px(`fus_${list[j]}_static_00.png`)).mean })
  pairs.sort((x, y) => x.mean - y.mean)
  for (const p of pairs.slice(0, 6)) console.log(`  ${p.mean.toFixed(2).padStart(6)}  ${p.a} ~ ${p.b}`)
  say(pairs[0].mean >= 2.0, "fusion presets do not collapse onto each other", `closest ${pairs[0].a}~${pairs[0].b}=${pairs[0].mean.toFixed(2)}`)
  // 4. motion of each animated fusion
  await motion("fus", 0.25, 1.5)
}

async function stack() {
  const blends = files.filter((f) => f.startsWith("blend_")).sort()
  console.log("\n=== stack blend x order separation ===")
  /* ⚠ THIS PHASE USED TO CRASH RATHER THAN REFUSE (class 7).
   *
   * With no `blend_*` files, `pairs` is empty and `pairs[0].mean` threw
   *   TypeError: Cannot read properties of undefined (reading 'mean')
   * out of a top-level await, i.e. a stack trace instead of a verdict.
   * Demonstrated: --phase=stack --label=presets.
   *
   * A crash is at least loud, but it is not a FAIL row and it tells the reader
   * nothing about what was missing — and any future harness that swallows the
   * rejection (an outer try, a runner that only reads stdout) turns it straight
   * back into a silent pass. So the empty case is now an assertion with a
   * message, and the crash is gone because the condition is stated. */
  if (blends.length < 2) {
    say(
      false,
      "stack blend/order combinations are all distinct",
      `NOTHING GRADED — ${blends.length} blend_* file(s) in ${DIR}, need at least 2 to form a pair. ` +
        `The directory holds ${files.length} PNG(s). Wrong --label for --phase=stack?`,
    )
    return
  }
  const pairs = []
  for (let i = 0; i < blends.length; i++)
    for (let j = i + 1; j < blends.length; j++)
      pairs.push({ a: blends[i].replace("blend_", "").replace(".png", ""), b: blends[j].replace("blend_", "").replace(".png", ""), mean: diff(await px(blends[i]), await px(blends[j])).mean })
  pairs.sort((x, y) => x.mean - y.mean)
  for (const p of pairs.slice(0, 10)) console.log(`  ${p.mean.toFixed(2).padStart(6)}  ${p.a} ~ ${p.b}`)
  const dupes = pairs.filter((p) => p.mean < 0.4)
  say(dupes.length === 0, "stack blend/order combinations are all distinct", dupes.length ? `${dupes.length} identical pairs, e.g. ${dupes[0].a} ~ ${dupes[0].b}` : `closest ${pairs[0].mean.toFixed(2)}`)
  await motion("sanim", 0.2, 1.0)
}

async function timing() {
  const modes = [...new Set(files.map((f) => f.match(/^sync_(.+?)_[rp]/)?.[1]).filter(Boolean))]
  /* ⚠ THE HEADER SAYS THIS PHASE GATES "the six sync modes". IT DID NOT (class 1+4).
   *
   * `modes` is whatever `sync_*` filenames happen to be on disk. Nothing ever
   * compared that list to `StyleSyncMode`, and the verdict string "all six
   * differ" was a LITERAL — never derived from `names.length`, never checked
   * against six of anything. With zero sync_* files the loop body never runs,
   * `collide` is empty, and the row prints:
   *
   *   PASS  sync modes have distinct signatures — all six differ
   *
   * on a directory containing none of them. Demonstrated:
   *   node scripts/verify/assert-material-craft.mjs --phase=timing --label=presets
   *   -> that exact PASS line -> "all checks pass" -> exit 0
   *
   * A claim of "six" that survives zero is not a weak check, it is a sentence
   * with no referent. The expected set is now read from lib/style-system.ts and
   * every member must have frames; the verdict string counts what it graded. */
  const SYNC_MODES = declaredSyncModes()
  const missing = SYNC_MODES.filter((m) => !modes.includes(m))
  say(
    modes.length > 0 && missing.length === 0,
    `every StyleSyncMode has sync_* frames on disk (${SYNC_MODES.length} declared in lib/style-system.ts)`,
    modes.length === 0
      ? `NO sync_* FRAMES AT ALL in ${DIR} — this phase graded nothing. Expected ${SYNC_MODES.join(", ")}.`
      : missing.length
        ? `NO EVIDENCE for ${missing.join(", ")} — found ${modes.length}: ${modes.join(", ")}`
        : modes.join(", "),
  )
  console.log("\n=== sync mode behaviour signature ===")
  console.log("mode                 revealΔ   freeΔ   verdict")
  const sig = {}
  for (const m of modes.sort()) {
    const r = files.filter((f) => f.startsWith(`sync_${m}_r`)).sort()
    const p = files.filter((f) => f.startsWith(`sync_${m}_p`)).sort()
    let rd = 0
    for (let i = 1; i < r.length; i++) rd += diff(await px(r[i - 1]), await px(r[i])).mean
    rd /= Math.max(1, r.length - 1)
    let pd = 0
    for (let i = 1; i < p.length; i++) pd += diff(await px(p[i - 1]), await px(p[i])).mean
    pd /= Math.max(1, p.length - 1)
    sig[m] = { rd, pd }
    const verdict = rd > 0.4 && pd > 0.4 ? "moves always" : rd > 0.4 ? "reveal-driven only" : pd > 0.4 ? "free-running only" : "STILL"
    console.log(`${m.padEnd(20)} ${rd.toFixed(2).padStart(7)} ${pd.toFixed(2).padStart(7)}   ${verdict}`)
  }
  // Every mode must be a distinct signature from every other.
  const names = Object.keys(sig)
  const collide = []
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const A = sig[names[i]], B = sig[names[j]]
      if (Math.abs(A.rd - B.rd) < 0.25 && Math.abs(A.pd - B.pd) < 0.25) collide.push(`${names[i]}~${names[j]}`)
    }
  // The verdict string is DERIVED. "all six differ" used to be a literal, so it
  // printed unchanged over a `names` array of length 0.
  say(
    collide.length === 0 && names.length > 0,
    "sync modes have distinct signatures",
    collide.length
      ? collide.join(", ")
      : names.length
        ? `all ${names.length} graded modes differ (${names.join(", ")})`
        : "NOTHING GRADED — zero sync_* modes found, so this row has no referent",
  )
  // Scrub test: reveal-driven modes must track the playhead.
  console.log("\n=== scrub (motionMode=syncToDraw): does the layer follow the playhead? ===")
  for (const m of modes.sort()) {
    const s = files.filter((f) => f.startsWith(`scrub_${m}_`)).sort()
    if (s.length < 2) continue
    let d = 0
    for (let i = 1; i < s.length; i++) d += diff(await px(s[i - 1]), await px(s[i])).mean
    console.log(`  ${m.padEnd(20)} total scrub Δ ${d.toFixed(2)}`)
  }
}

const run = { presets, dials, matanim: () => motion("anim", 0.3, 2.0), fusion, stack, timing }

/* ⚠ AN UNRECOGNISED PHASE USED TO RUN `presets()` (class 7).
 *
 *   await (run[PHASE] || presets)()
 *
 * A typo in --phase silently fell through to a DIFFERENT phase, which then found
 * no files it recognised, skipped every cell and exited 0. Demonstrated:
 *   node scripts/verify/assert-material-craft.mjs --phase=zzz --label=iridescence
 *   -> "all checks pass" -> exit 0
 * "I did not understand your instruction, so I ran something else and told you
 * it passed" is the worst answer available. A misspelled phase in a CI line
 * would have read green forever. */
/* BREAK-TESTED 2026-08-07: restoring the recorded defect here —
 *     await (run[PHASE] || presets)()   and dropping this guard
 * turns control 1 RED ("exit 3, NO stated refusal in its output") and the gate
 * exits 1. Deliberately NOT left behind an env var: a switch that disables a
 * refusal is a switch that will one day be set. Re-run it by hand. */
if (!run[PHASE]) {
  console.error(
    `FAIL  unrecognised --phase=${PHASE}. Known phases: ${Object.keys(run).join(", ")}. ` +
      `Refusing to silently run a different phase and report its verdict as yours.`,
  )
  process.exit(1)
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE CONTROLS — the mis-invocations this file already recorded, EXECUTED.
 *
 * Until 2026-08-07 this gate had NO control of any kind: no flag, no parked arm,
 * no known-bad anywhere in 452 lines. Every row asserted the subject and the
 * only refusals were anti-vacuity guards. It was one of four gates in the repo
 * with no control mechanism at all (explainer 31 §1).
 *
 * And yet the evidence was already here, which is the whole point. Four separate
 * mis-invocations are written into the comments at `:128`, `:298`, `:338` and
 * `:409` — each one DEMONSTRATED BY HAND at the time, each with the exact
 * command and the exact wrong answer it produced:
 *
 *   --phase=matanim --label=presets     -> six cells skipped -> "all checks pass" -> 0
 *   --phase=stack   --label=presets     -> TypeError out of a top-level await
 *   --phase=timing  --label=presets     -> "sync modes ... all six differ" on zero files
 *   --phase=zzz     --label=iridescence -> silently ran presets() -> "all checks pass" -> 0
 *
 * **That is the disease in one file: somebody did the right experiment and then
 * stored it as prose.** A demonstration that lives in a comment cannot notice
 * when the fix it describes stops working. These now RUN, on the bare
 * invocation, and the gate is red if any of them stops being refused.
 *
 * WHY SELF-SPAWN. Each recorded defect is a property of THIS FILE'S OWN ENTRY
 * PATH — the argument parsing, the phase dispatch, the zero-check guard — so the
 * only honest way to exercise it is to invoke the file the way the comment says
 * it was invoked. Re-implementing the checks inline would put two
 * implementations of one idea in the one place where a divergence is invisible:
 * the copy would be the thing certifying the original. Same reasoning, and the
 * same shape, as `assert-hero-transition`'s controls.
 *
 * 🔴 THE CHILDREN'S ROWS ARE NOT ECHOED. A control run is REQUIRED to print red,
 * and both battery runners count `/^\s*(?:\[…\]\s*)?(?:\*\*\* )?(?:PASS|FAIL(?:ED)?)\b/gm`
 * — `^\s*` means an INDENTED `FAIL` still counts — so echoing a child would post
 * its required reds to the scoreboard as this gate's failures. Only a sanitised
 * one-line summary is quoted.
 * ═══════════════════════════════════════════════════════════════════════════ */
const THIS_FILE = fileURLToPath(import.meta.url)
const IS_CONTROL_CHILD = process.env.FS_MC_CONTROL === "1"

if (!IS_CONTROL_CHILD) {
  console.log("\n=== CONTROLS · the recorded mis-invocations, executed ===")
  /* `need` names the capture directory a control needs, or null when it needs
   * none. Three of these point a phase at ANOTHER phase's directory, which is
   * the defect they reproduce, so they need that directory to exist. */
  const CONTROLS = [
    {
      argv: ["--phase=zzz", "--label=iridescence"],
      need: null,
      site: ":409",
      want: /unrecognised --phase/i,
      why: "an unrecognised phase must REFUSE, not silently run presets() and report its verdict as yours",
    },
    {
      argv: ["--phase=presets", "--label=__gate_control_no_such_label__"],
      need: null,
      site: ":107 + the zero-check guard",
      want: /UNSWEPT|ZERO checks|no frames/i,
      why: "a label that resolves to nothing must not be indistinguishable from a clean sweep",
    },
    {
      argv: ["--phase=matanim", "--label=presets"],
      need: "presets",
      site: ":128",
      want: /ZERO checks|UNSWEPT|FAIL/,
      why: "every cell skipped for want of matching files must not print `all checks pass` and exit 0",
    },
    {
      argv: ["--phase=stack", "--label=presets"],
      need: "presets",
      site: ":298",
      want: /FAIL|ZERO checks|UNSWEPT/,
      why: "the empty-pairs case must be a STATED refusal, not a TypeError out of a top-level await",
    },
    {
      argv: ["--phase=timing", "--label=presets"],
      need: "presets",
      site: ":338",
      want: /FAIL|ZERO checks|UNSWEPT/,
      reject: /all six differ/,
      why: "a claim of `six` must not survive zero sync_* files — a sentence with no referent",
    },
  ]
  let unswept = 0
  for (const c of CONTROLS) {
    const label = `CONTROL · KNOWN-BAD ${c.argv.join(" ")} (recorded at ${c.site})`
    if (c.need && !existsSync(join(ROOT, "docs", "verification", "material-craft", c.need))) {
      unswept++
      console.log(
        `UNSWEPT  ${label}\n         needs docs/verification/material-craft/${c.need}/, which this tree does not carry. ` +
          `NOT a pass — the known-bad was never armed. Recapture with ` +
          `\`node scripts/verify/verify-material-craft.mjs --phase=${c.need}\`.`,
      )
      continue
    }
    const r = spawnSync("node", [THIS_FILE, ...c.argv], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 120_000,
      env: { ...process.env, FS_MC_CONTROL: "1" },
      maxBuffer: 16 * 1024 * 1024,
    })
    const said = (r.stdout || "") + (r.stderr || "")
    /* THREE conditions, and the third is the one that matters most: the child
     * must not have claimed a clean sweep. An exit code alone would be satisfied
     * by a crash, and a crash is the very thing `:298` was fixed to stop. */
    const refused = r.status !== 0
    const named = c.want.test(said)
    const notClean = !/all \d+ checks pass|all checks pass/.test(said) && !(c.reject && c.reject.test(said))
    const crashed = /TypeError|ReferenceError|SyntaxError/.test(said)
    say(
      refused && named && notClean && !crashed,
      label,
      `${c.why} — exit ${r.status}` +
        (crashed ? ", CRASHED (a stack trace is not a verdict)" : "") +
        (named ? ", refused in words" : ", NO stated refusal in its output") +
        (notClean ? "" : ", AND IT CLAIMED A CLEAN SWEEP"),
    )
  }
  if (unswept) {
    console.log(
      `\nUNSWEPT  ${unswept} of ${CONTROLS.length} controls could not be armed on this tree — named above, not counted green.`,
    )
  }
}

/* PROVENANCE. These are stored PNGs and nothing checked they belong to this
 * tree — see scripts/verify/_capture-freshness.mjs for the measured ten-hour
 * case that motivated it. */
if (NO_FRAMES) {
  /* EXIT 3, NOT 1 — Lane K's ladder. Nothing failed and a channel was never
   * REACHED: there are no frames to grade. Exiting 1 made this gate a bare RED
   * in every tree without a capture run (i.e. every lane tree), which is the
   * wolf-crying that gets an instrument switched off; exiting 0 was never on the
   * table. The CONTROLS above have already run and are already judged. */
  console.error(
    `\nUNSWEPT  the ${PHASE} phase — no frames in ${DIR}. ` +
      `Recapture with \`node scripts/verify/verify-material-craft.mjs --phase=${PHASE}\`.`,
  )
  console.error(
    fails
      ? `\n${fails} FAILING CONTROL(S) — the controls ran and one of them did not refuse.`
      : `\nNOT A PASS AND NOT A FAILURE — the controls held; the subject was never reached.`,
  )
  process.exit(fails ? 1 : 3)
}
const fresh = captureFreshness(DIR, {
  subjects: ["lib/style-system.ts", "lib/style-shader.ts", "lib/style-fusion.ts", "lib/style-stack.ts", "lib/style-clock.ts"],
  recapture: `node scripts/verify/verify-material-craft.mjs --phase=${PHASE}`,
})
say(fresh.ok, fresh.label, fresh.detail)

/* The zero-check guard below must count the PHASE's own checks. Counting the
 * provenance row too would let a fresh-but-empty directory exit 0 again with a
 * single PASS — the same hole one row further along. */
const checksBeforePhase = checks
await run[PHASE]()
const phaseChecks = checks - checksBeforePhase

/* THE ZERO-CHECK GUARD — the defect three separate paths in this file shared.
 * `fails ? 1 : 0` treats "nothing was examined" and "everything was examined and
 * was sound" as the same answer. They are opposites. Three demonstrated routes
 * to exit 0 on zero assertions are recorded at their sites above; this is the
 * backstop that catches the fourth nobody has found yet. */
if (phaseChecks === 0) {
  console.error(
    `\nFAIL  --phase=${PHASE} ran ZERO checks over ${DIR} (${files.length} PNG file(s) present). ` +
      `A gate that examined nothing must not exit 0 — it is indistinguishable from a clean sweep. ` +
      `Check the --label matches the phase.`,
  )
  process.exit(1)
}
console.log(fails ? `\n${fails} FAILING CHECK(S) of ${checks}` : `\nall ${checks} checks pass`)
process.exit(fails ? 1 : 0)

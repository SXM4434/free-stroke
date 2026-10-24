// THE CAMERA PROGRAM, ASSERTED — velocity continuity, spacing, and the pose.
//
// Sebs, on the beat as it stood: *"i also dont full geth janky can angels once
// it turn 3d"*. Both halves of that are checkable. **Janky** is a time-domain
// defect, so it is measured as the camera's per-frame VELOCITY and where that
// velocity steps. **Not getting it** is a spacing and staging defect, so the
// same series is measured against `reference-film-mechanics.md` §6.1, §6.3 and
// §6.5 — the only camera evidence the project has.
//
// WHAT WAS WRONG, ALL FOUR MEASURED OFF THIS SAMPLER BEFORE ANY CHANGE:
//
//   orbit -> descend   0 -> 375.9 deg/s of azimuth in ONE FRAME, out of 933ms
//                      in which the camera had not moved by a pixel.
//                      `easeOutStrong` is `1-(1-t)^5`, so f'(0) = 5: the move
//                      leaves at five times its own average speed. The largest
//                      discontinuity in the program by a factor of three.
//   tilt -> standup    0.8 -> 84.0 deg/s of elevation, SAME DIRECTION. The
//                      camera glides to a near-stop over six frames and then
//                      speeds back up 105x without turning around.
//   the tilt itself    `easeInOutStrong`, velocity peak at 52% of the move,
//                      rise/decay 0.91x — spaced 50:50, the exact defect §10.5
//                      call 3 removed from the rise and left here. And 700ms,
//                      the one row in the beat outside §6.3's transition band.
//   the pose           `lieEl: 65` names the deepest look-down and the camera
//                      reached 70.5, because the rise's gather is a fraction of
//                      its own TRAVEL and stacked 5.5 degrees on top of a
//                      destination the tilt had already arrived at. The beat's
//                      least legible frame was in the rise's anticipation, past
//                      the pose everything was authored against.
//
// THE CONTROL IS THE WHOLE PRIOR CAMERA — `tiltLaw: "prior"`, `descendLaw:
// "prior"`, `beats.tilt: 0.7`. Every claim is re-run against it, and the ones
// that describe the change are REQUIRED to fail there. Three instrument bugs
// have already been caught in this beat, one of them an assertion that passed
// on a beat with no turn in it because it was vacuously true. A green row that
// cannot fail is the lie.
//
// Usage: node scripts/verify/assert-hero-camera.mjs
import { loadTs } from "./_ts-load.mjs"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const M = loadTs("lib/hero-motion.ts")
const { DEFAULT_HERO_MOTION, sampleHeroMotion, phaseOffsets, HERO_PHASES, totalDuration } = M

/* ══ THE REDUCED-MOTION ARM IS READ OUT OF page.tsx NOW ═══════════════════════
 *
 * ⚠ DEFECT (class 3, a gate guarding a file it never opened). The `reduced` row
 * below used to build its arm from three zeroes typed here:
 *
 *     { ...P, emerge: { ...P.emerge, overshoot: 0 }, riseOvershoot: 0, backC1: 0 }
 *
 * and the row's own detail said *"page.tsx:661 zeroes backC1 and
 * emerge.overshoot"*, while `app/desk-doodles/page.tsx` said, at its `played`
 * memo, *"`assert-hero-camera.mjs`'s reduced row fails if either is dropped."*
 * Two files each citing the other as the check. Neither statement was true:
 * this file imported nothing but `_ts-load` — no `readFileSync`, no page — so
 * deleting `riseOvershoot: 0` from the page left the row green at `sail 0.00`,
 * because the row was scoring a copy of the page's intent rather than the page.
 * (The cited line number was stale too: the site is the `played` memo, not 661.)
 *
 * So the arm is now PARSED from the page's own reduced-motion branch, and the
 * gate asserts that what it parsed matches what it expects to find. A zero the
 * page drops disappears from the parsed arm, the camera sails, and the row goes
 * red — which is what the page's comment always claimed. The calibration below
 * drops each of the three in turn and requires a FAIL each time. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const PAGE_PATH = join(ROOT, "app", "desk-doodles", "page.tsx")
const PAGE = readFileSync(PAGE_PATH, "utf8")

/**
 * The dotted paths the page zeroes when `reduceMotion` is true, read off the
 * source. Scoped to the `reduceMotion ?` branch of the `played` memo so an
 * unrelated `backC1: 0` elsewhere in a 3,600-line file cannot be mistaken for
 * it, and so the parse fails loudly rather than silently matching nothing.
 */
function readReducedZeroes(src) {
  // The branch: from `reduceMotion` in the `played` memo to the `: motion` that
  // closes the ternary.
  const start = src.indexOf("const played = useMemo")
  if (start < 0) return { paths: [], site: null, error: "no `const played = useMemo` in page.tsx" }
  const branchStart = src.indexOf("reduceMotion", start)
  const branchEnd = src.indexOf(": motion", branchStart)
  if (branchStart < 0 || branchEnd < 0)
    return { paths: [], site: null, error: "could not find the reduceMotion ternary in the played memo" }
  const branch = src.slice(branchStart, branchEnd)
  const line = src.slice(0, branchStart).split("\n").length
  const paths = []
  // `emerge: { ...motion.emerge, overshoot: 0 }` -> "emerge.overshoot"
  for (const m of branch.matchAll(/(\w+)\s*:\s*\{[^{}]*?\.\.\.motion\.\1[^{}]*?\}/g)) {
    for (const inner of m[0].matchAll(/(\w+)\s*:\s*0(?![.\d])/g)) paths.push(`${m[1]}.${inner[1]}`)
  }
  // Top-level `riseOvershoot: 0`, with the nested objects removed first so a
  // nested zero is not counted twice.
  const flat = branch.replace(/\{[^{}]*\}/g, "")
  for (const m of flat.matchAll(/(\w+)\s*:\s*0(?![.\d])/g)) paths.push(m[1])
  return { paths: [...new Set(paths)], site: `page.tsx:${line}`, error: null }
}

const REDUCED = readReducedZeroes(PAGE)
/** What this lane put in the page, named here so a DROP is distinguishable from
 *  a rename and both are reportable. Not the source of the arm — the source of
 *  the arm is the page — but the source of the CLAIM that the page still does
 *  what the row's prose says. */
const REDUCED_EXPECTED = ["emerge.overshoot", "riseOvershoot", "backC1"]
/**
 * WHICH OF THOSE THIS FILE CAN ACTUALLY GUARD, and the exclusion is named
 * rather than silently skipped — same rule as the `standup` start exclusion.
 *
 * `riseOvershoot` and `backC1` move the CAMERA, so dropping either makes the
 * sail row red: measured below at 5.00 and 3.80 against a 0.2 bar. That is what
 * `page.tsx`'s own comment claims ("fails if either is dropped") and it is now
 * true — before this repair it was true of `backC1` only, and `riseOvershoot`
 * could be deleted with the row still reading sail 0.00.
 *
 * `emerge.overshoot` is an INK dial — the mark puffing past full thickness —
 * and it moves no camera channel at all, so this row cannot guard it and must
 * not pretend to. Dropping it measures sail 0.00 here, correctly. It is guarded
 * by `assert-hero-reduced-motion.mjs` gate 1 and by `assert-hero-transition`'s
 * flatness rows, which read pixels rather than the camera.
 */
const REDUCED_CAMERA = ["riseOvershoot", "backC1"]

function zeroPaths(P, paths) {
  const out = structuredClone(P)
  for (const path of paths) {
    const parts = path.split(".")
    let o = out
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]
    o[parts[parts.length - 1]] = 0
  }
  return out
}

const CH = ["az", "el", "fill"]
// Fill is a distance multiplier, not degrees; scaled so a "jump" is comparable.
const SCALE = { az: 1, el: 1, fill: 100 }

/**
 * The camera per phase: its per-output-frame series, whether each channel
 * moves, and the peak/first/last step of the ones that do. The phase is sampled
 * at its own frame rate because that is the exposure the eye reads — an
 * analytically smooth curve can still be a kick on a 30fps sheet.
 */
function phases(P) {
  const off = phaseOffsets(P)
  const out = []
  for (const ph of HERO_PHASES) {
    const n = Math.max(1, Math.round(P.beats[ph] * P.fps))
    const rows = []
    for (let i = 0; i <= n; i++) {
      const t = Math.min(off[ph] + i / P.fps, off[ph] + P.beats[ph] - 1e-9)
      rows.push(sampleHeroMotion(P, t))
    }
    const chans = {}
    for (const c of CH) {
      const steps = []
      for (let i = 1; i <= n; i++) steps.push((rows[i][c] - rows[i - 1][c]) * SCALE[c])
      const travel = Math.abs((rows[n][c] - rows[0][c]) * SCALE[c])
      const peak = Math.max(...steps.map(Math.abs))
      chans[c] = {
        moves: travel > 1e-6,
        travel,
        peak,
        first: Math.abs(steps[0]),
        last: Math.abs(steps[steps.length - 1]),
        // deg/s at the very start and the very end, one frame wide.
        v0: steps[0] * P.fps,
        v1: steps[steps.length - 1] * P.fps,
        steps,
      }
    }
    out.push({ ph, n, sec: P.beats[ph], chans, rows })
  }
  return out
}

/** Every frame of the whole beat, for the program-wide rows. */
function beatSeries(P) {
  const n = Math.round(totalDuration(P) * P.fps)
  const rows = []
  for (let i = 0; i <= n; i++) rows.push(sampleHeroMotion(P, Math.min(i / P.fps, totalDuration(P))))
  return rows
}

function claims(P, reducedPreFix = false, reducedPaths = REDUCED.paths) {
  const ph = phases(P)
  const by = Object.fromEntries(ph.map((p) => [p.ph, p]))
  const rows = beatSeries(P)

  /* --- 1 · HANDOVERS. A channel moving on both sides of a seam must not change
     speed there. This is the row that names the tilt->standup hitch. --- */
  const handovers = []
  for (let k = 1; k < ph.length; k++) {
    const a = ph[k - 1]
    const b = ph[k]
    for (const c of CH) {
      if (!a.chans[c].moves || !b.chans[c].moves) continue
      const before = a.chans[c].v1
      const after = b.chans[c].v0
      const denom = Math.max(Math.abs(before), Math.abs(after), 1e-9)
      handovers.push({
        seam: `${a.ph}->${b.ph}`,
        c,
        before,
        after,
        err: Math.abs(after - before) / denom,
      })
    }
  }
  const worstHand = handovers.length
    ? handovers.reduce((x, y) => (y.err > x.err ? y : x))
    : { seam: "none", c: "-", before: 0, after: 0, err: 0 }

  /* --- 2 · TRANSIT STARTS. `tilt` and `descend` are the beat's two camera
     transits: they leave a parked camera and their only job is to re-frame.
     Babbu's dolly (§6.2) puts 3 of a 21-frame peak into its first frame = 14%.
     An instant start reads 100%.

     THE STANDUP IS DELIBERATELY NOT IN THIS ROW, and its number is printed
     anyway so the exclusion is visible rather than hidden. Its first frame is
     the rise's GATHER opening — a wind-up, which §6.5 gives its own mode and
     which is allowed to snap where a transit is not. It measures 41% and it is
     unchanged by this lane. --- */
  const TRANSITS = ["tilt", "descend"]
  const starts = []
  for (const name of TRANSITS) {
    const p = by[name]
    for (const c of CH) {
      if (!p.chans[c].moves || p.chans[c].peak <= 0) continue
      starts.push({ ph: name, c, frac: p.chans[c].first / p.chans[c].peak })
    }
  }
  const worstStart = starts.reduce((x, y) => (y.frac > x.frac ? y : x), { ph: "-", c: "-", frac: 0 })
  const standupStart = by.standup.chans.az.peak
    ? by.standup.chans.az.first / by.standup.chans.az.peak
    : 0

  /* --- 3 · TRANSIT ARRIVALS. A move that ends into a PARKED phase must have
     stopped, or the hold is a hold with a camera still drifting under it. --- */
  const arrivals = []
  for (let k = 0; k < ph.length - 1; k++) {
    const a = ph[k]
    const b = ph[k + 1]
    for (const c of CH) {
      if (!a.chans[c].moves || b.chans[c].moves || a.chans[c].peak <= 0) continue
      arrivals.push({ seam: `${a.ph}->${b.ph}`, c, frac: a.chans[c].last / a.chans[c].peak })
    }
  }
  const worstArrival = arrivals.reduce((x, y) => (y.frac > x.frac ? y : x), { seam: "-", c: "-", frac: 0 })

  /* --- 4 · THE POSE. `lieEl` is the dial that names the deepest look-down.
     It has to be what the camera actually reaches. --- */
  const maxEl = Math.max(...rows.map((r) => r.el))
  const poseErr = Math.abs(maxEl - P.lieEl)

  /* --- 5 · TRANSIT LENGTHS. §6.3 / transfer #10: *"292 ms or 433-467 ms. Two
     values, used consistently. Nothing in between."* The rise is exempt by a
     decision that is on the record — §10.5 call 3, 1.4s kept — and is named
     here rather than silently skipped. --- */
  const inBand = (ms) => (ms >= 282 && ms <= 302) || (ms >= 423 && ms <= 477)
  const lengths = TRANSITS.map((name) => ({ ph: name, ms: by[name].sec * 1000, ok: inBand(by[name].sec * 1000) }))

  /* --- 6 · SPACING. §6.1: *"Every move in the reference set is ease-out
     dominant… nothing eases in symmetrically."* A symmetric curve peaks at
     50%. --- */
  const spacing = []
  for (const p of ph) {
    const c = p.chans.el.travel >= p.chans.az.travel ? "el" : "az"
    if (!p.chans[c].moves || p.n < 2) continue
    const st = p.chans[c].steps.map(Math.abs)
    let pk = 0
    for (let i = 1; i < st.length; i++) if (st[i] > st[pk]) pk = i
    spacing.push({ ph: p.ph, c, peakAt: (pk + 1) / p.n })
  }
  const worstSpacing = spacing.reduce((x, y) => (y.peakAt > x.peakAt ? y : x), { ph: "-", peakAt: 0 })

  /* --- 7 · THE EXPOSURE SHEET. The direct read of "janky": across the
     elevation arc, how abruptly does one frame's step become the next's while
     the camera is still going the same way? Steps under 0.3 deg are ignored on
     both sides — a ratio between two invisible numbers is not a kick. --- */
  const off = phaseOffsets(P)
  const t0 = off.tilt
  const t1 = off.orbit
  const nArc = Math.round((t1 - t0) * P.fps)
  const el = []
  for (let i = 0; i <= nArc; i++) el.push(sampleHeroMotion(P, Math.min(t0 + i / P.fps, t1 - 1e-6)).el)
  const st = []
  for (let i = 1; i <= nArc; i++) st.push(el[i] - el[i - 1])
  let stepRatio = 1
  let stepAt = 0
  for (let i = 1; i < st.length; i++) {
    const a = Math.abs(st[i - 1])
    const b = Math.abs(st[i])
    if (Math.max(a, b) < 0.3) continue
    if (Math.sign(st[i]) !== Math.sign(st[i - 1])) continue
    const r = Math.max(a, b) / Math.max(0.05, Math.min(a, b))
    if (r > stepRatio) {
      stepRatio = r
      stepAt = i
    }
  }

  /* --- 8 · REDUCED MOTION. `app/desk-doodles/page.tsx:661` plays
     `{ ...motion, emerge: { overshoot: 0 }, backC1: 0 }` when the reader asks
     for less motion, and `backC1`'s own doc promises that removes the
     anticipation. Under `riseCurve: "riseOut"` it stopped doing so, because
     that curve reads `riseGatherDepth` instead — so the camera still swung 3.8
     degrees the wrong way and pushed 2% past its framing. Asserted here off the
     sampler, because it is a property of the motion model and needs no browser
     to be true or false. --- */
  // `reducedPreFix` reproduces what `riseOut` + reduced motion ACTUALLY did
  // before this lane: `emerge.overshoot: 0` reached the curve and `backC1: 0`
  // did not, so the counter-dip survived. It is the control this row needs, and
  // it is a real prior state rather than a synthetic one.
  //
  // ⚠ `riseOvershoot` JOINED THE LIST, and this row is the reason the split was
  // safe to make. The rise used to read its overshoot off `emerge.overshoot` —
  // an INK dial, on an arm that has no ink swell — so zeroing the ink also
  // quieted the camera by accident. Now the rise has its own number and the page
  // zeroes both; if a future edit drops one, this row goes red rather than the
  // reader silently getting a camera that still swings.
  //
  // ⚠ AND THE ARM IS NO LONGER TYPED HERE — see `readReducedZeroes` at the top
  // of this file for what was wrong with typing it. `reducedPaths` is what
  // `page.tsx`'s own reduced-motion branch zeroes, parsed off the source, so a
  // zero the page drops is a zero this arm loses.
  const red = reducedPreFix
    ? { ...P, emerge: { ...P.emerge, overshoot: 0 } }
    : zeroPaths(P, reducedPaths)
  const offR = phaseOffsets(red)
  let sail = 0
  const nR = Math.round(red.beats.standup * red.fps)
  for (let i = 0; i <= nR; i++) {
    const s = sampleHeroMotion(red, offR.standup + i / red.fps)
    sail = Math.max(
      sail,
      red.holdEl - s.el,
      0 - s.az,
      100 * (s.fill - red.fillLie),
    )
  }

  /* --- 9 · THE UNREADABLE PASS. The mark lies in the page, so its on-screen
     height goes as cos(el) — the board's own 99 -> 47px at el 65 (§3 K5). This
     counts how long the beat spends where the hero mark is under 60% of its
     full height. It is the measurable form of *"a detour through
     unreadability"*. --- */
  const illegible = rows.filter((r) => Math.cos((r.el * Math.PI) / 180) < 0.6).length

  return [
    {
      key: "handover",
      name: "no camera channel CHANGES SPEED at a phase seam",
      pass: worstHand.err <= 0.25,
      detail:
        `worst ${worstHand.seam} on ${worstHand.c}: ${worstHand.before.toFixed(1)} -> ` +
        `${worstHand.after.toFixed(1)} deg/s = ${(100 * worstHand.err).toFixed(1)}% (needs <= 25%), ` +
        `across ${handovers.length} moving/moving channel seams`,
    },
    {
      key: "start",
      name: "no camera TRANSIT leaves a parked camera at full speed",
      pass: worstStart.frac <= 0.25,
      detail:
        `worst ${worstStart.ph}/${worstStart.c}: first frame is ${(100 * worstStart.frac).toFixed(0)}% ` +
        `of the move's own peak step (needs <= 25%; Babbu's dolly is 3 of 21 = 14%, §6.2). ` +
        `NOT COUNTED, printed so the exclusion is visible: standup/az ` +
        `${(100 * standupStart).toFixed(0)}% — that frame is the rise's gather opening, a wind-up, ` +
        `and this lane did not touch it`,
    },
    {
      key: "arrival",
      name: "no camera TRANSIT hands a parked phase a velocity",
      pass: worstArrival.frac <= 0.1,
      detail:
        `worst ${worstArrival.seam} on ${worstArrival.c}: last frame is ` +
        `${(100 * worstArrival.frac).toFixed(0)}% of peak (needs <= 10%), across ${arrivals.length} moving/parked seams`,
    },
    {
      key: "pose",
      name: "the deepest look-down IS lieEl — the dial does not lie",
      pass: poseErr < 0.2,
      detail: `max elevation ${maxEl.toFixed(2)} deg against lieEl ${P.lieEl} (needs within 0.2)`,
    },
    {
      key: "length",
      name: "both camera TRANSITS are a reference transition length",
      pass: lengths.every((l) => l.ok),
      detail:
        lengths.map((l) => `${l.ph} ${l.ms.toFixed(0)}ms ${l.ok ? "in" : "OUT of"} band`).join(" · ") +
        ` (292 or 433-467ms, §6.3). Exempt by decision, named not skipped: standup ` +
        `${(by.standup.sec * 1000).toFixed(0)}ms — §10.5 call 3 keeps 1.4s`,
    },
    {
      key: "spacing",
      name: "no camera move is spaced symmetrically",
      pass: worstSpacing.peakAt <= 0.35,
      detail:
        `worst ${worstSpacing.ph}: velocity peaks at ${(100 * worstSpacing.peakAt).toFixed(0)}% of the move ` +
        `(needs <= 35%; a symmetric curve peaks at 50%). §6.1: "nothing eases in symmetrically"`,
    },
    {
      key: "exposure",
      name: "the elevation arc has no KICK — one frame's step to the next",
      pass: stepRatio <= 8,
      detail:
        `worst same-direction step ratio ${stepRatio.toFixed(1)}x at frame ${stepAt} of the ` +
        `${nArc}-frame tilt+rise arc (needs <= 8x)`,
    },
    {
      key: "reduced",
      name: "prefers-reduced-motion really does remove the anticipation",
      pass: sail < 0.2,
      detail:
        `worst channel sails ${sail.toFixed(2)} past its target under the page's own reduced-motion ` +
        `params (needs < 0.2). riseOut reads riseGatherDepth, so the switch had stopped reaching ` +
        `the counter-dip` +
        `\n      arm READ FROM ${REDUCED.site ?? "page.tsx (UNPARSEABLE)"}: zeroes ` +
        `{ ${reducedPaths.join(", ") || "NOTHING"} }` +
        (reducedPreFix ? " — overridden by the pre-fix control arm" : ""),
    },
    {
      /* THE ROW THAT MAKES THE ROW ABOVE MEAN ANYTHING. Without it, a page that
       * dropped ALL THREE zeroes would produce an empty `reducedPaths`, `red`
       * would be the unreduced params, and the sail row would go red for the
       * right reason — but a page that RENAMED a zero would produce a parse
       * that silently matched nothing, which reads the same as a page with no
       * reduced-motion handling at all. Naming what is expected separates
       * "dropped" from "renamed" from "this file can no longer read the page". */
      key: "reduced-source",
      name: "the reduced-motion arm is the PAGE's, and the page still zeroes all three",
      pass:
        !REDUCED.error &&
        REDUCED_EXPECTED.every((p) => REDUCED.paths.includes(p)) &&
        REDUCED.paths.length === REDUCED_EXPECTED.length,
      detail: REDUCED.error
        ? `COULD NOT READ page.tsx: ${REDUCED.error} — this row is the reason that is a FAIL and not a skip`
        : `${REDUCED.site} zeroes { ${REDUCED.paths.join(", ")} }` +
          (REDUCED_EXPECTED.filter((p) => !REDUCED.paths.includes(p)).length
            ? ` — DROPPED: ${REDUCED_EXPECTED.filter((p) => !REDUCED.paths.includes(p)).join(", ")}`
            : "") +
          (REDUCED.paths.filter((p) => !REDUCED_EXPECTED.includes(p)).length
            ? ` — NEW, and unaccounted for by this gate: ${REDUCED.paths.filter((p) => !REDUCED_EXPECTED.includes(p)).join(", ")}`
            : "") +
          ` (expected exactly ${REDUCED_EXPECTED.join(", ")})`,
    },
    {
      key: "legibility",
      name: "the unreadable pass is SHORT",
      pass: illegible <= 12,
      detail:
        `${illegible} frames under 60% of full mark height = ${(illegible / P.fps).toFixed(2)}s ` +
        `(needs <= 12 fr). The mark lies in the page, so its height goes as cos(el)`,
    },
  ]
}

/* -------------------------------------------------------------------------- */

const P = DEFAULT_HERO_MOTION
// The whole prior camera, in one arm: the symmetric 700ms tilt that arrived at
// rest, and the descend that left its hold at full speed.
const CONTROL = {
  ...P,
  beats: { ...P.beats, tilt: 0.7 },
  tiltLaw: "prior",
  descendLaw: "prior",
}

console.log(
  `THE CAMERA — ${totalDuration(P).toFixed(3)}s at ${P.fps}fps · ` +
    `tiltLaw "${P.tiltLaw}" · descendLaw "${P.descendLaw}" · cameraPark "${P.cameraPark}"\n`,
)
const shipped = claims(P)
for (const c of shipped) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}\n      ${c.detail}`)

const controlled = claims(CONTROL, true)
console.log(
  `\nNEGATIVE CONTROL — the whole prior camera: tilt 700ms on easeInOutStrong arriving\n` +
    `at rest, descend on easeOutStrong leaving its hold at five times average speed`,
)
for (const c of controlled) console.log(`  ${c.pass ? "passes" : "fails, correctly"}  ${c.name}\n      ${c.detail}`)

// PER-DIAL CONTROLS. The combined arm above proves the instrument can fail; it
// does NOT prove each change is carrying its own weight — one dominant fix
// could be failing every row while the other two do nothing. Reverting one dial
// at a time says which claim each one actually owns.
const SOLO = {
  'tiltLaw: "prior"': { ...P, tiltLaw: "prior" },
  'descendLaw: "prior"': { ...P, descendLaw: "prior" },
  "beats.tilt: 0.7": { ...P, beats: { ...P.beats, tilt: 0.7 } },
}
// The reduced-motion regression is not a dial, it is a code path, so its solo
// control is the pre-fix arm rather than a parameter.
const SOLO_FLAGS = { "reduced-motion pre-fix": true }
console.log(`\nPER-DIAL CONTROLS — which claim does each change own, on its own?`)
for (const [label, arm] of Object.entries(SOLO)) {
  const broke = claims(arm).filter((c) => !c.pass).map((c) => c.key)
  console.log(`  ${label.padEnd(24)} breaks: ${broke.length ? broke.join(", ") : "NOTHING — this dial owns no claim"}`)
}
for (const [label, flag] of Object.entries(SOLO_FLAGS)) {
  const broke = claims(P, flag).filter((c) => !c.pass).map((c) => c.key)
  console.log(`  ${label.padEnd(24)} breaks: ${broke.length ? broke.join(", ") : "NOTHING — this fix owns no claim"}`)
}

/* ---- CALIBRATION: THE PAGE DROPPING A ZERO ---------------------------------
 *
 * The known-bad this repair exists for, constructed one zero at a time. Before
 * it, `riseOvershoot: 0` could be deleted from `page.tsx` and this row stayed
 * green at `sail 0.00`, because the arm was three literals typed into this file
 * rather than a read of the page. Now the arm IS the read, so a dropped zero
 * has to move the number — and each of the three has to move it past 0.2 on its
 * own, or that zero is not something this row is actually guarding.
 *
 * Simulated by removing the path from the PARSED list, which is exactly the
 * value this file would compute if the page's own branch stopped zeroing it. No
 * source file is edited to run this. */
console.log(
  `\nCALIBRATION — the page dropping one of its reduced-motion zeroes, one at a time` +
    `\n  arm as read from ${REDUCED.site ?? "?"}: { ${REDUCED.paths.join(", ") || "NOTHING"} }`,
)
let reducedCalibrated = REDUCED.paths.length > 0 && !REDUCED.error
if (!reducedCalibrated) {
  console.log(
    `  UNCALIBRATED — nothing was parsed out of page.tsx, so no zero can be dropped from it.`,
  )
}
for (const drop of REDUCED.paths) {
  const arm = REDUCED.paths.filter((p) => p !== drop)
  const row = claims(P, false, arm).find((c) => c.key === "reduced")
  const guarded = REDUCED_CAMERA.includes(drop)
  if (guarded && row.pass) reducedCalibrated = false
  const verdict = guarded
    ? row.pass
      ? "MISSED — this zero is NOT guarded"
      : "caught, correctly"
    : row.pass
      ? "not counted, correctly"
      : "caught — and it was not expected to be"
  console.log(
    `  ${verdict}  page.tsx stops zeroing \`${drop}\`` +
      (guarded ? "" : "  [INK dial, no camera consequence — see REDUCED_CAMERA]") +
      `\n        ${row.detail.split("\n")[0]}`,
  )
}
console.log(
  `  NOT COUNTED, printed so the exclusion is visible: \`emerge.overshoot\` is the ink's swell and` +
    `\n  moves no camera channel, so this file cannot guard it. \`assert-hero-reduced-motion.mjs\`` +
    `\n  gate 1 and \`assert-hero-transition\`'s flatness rows do, on pixels.`,
)

// The control is NOT required to fail every row. `arrival` is a property BOTH
// cameras have — `easeOutStrong` also stops — and asserting it exists to stop a
// future change breaking it, not to prove this one fixed it. Saying which rows
// must fail, and which are keepers, is the only thing that makes the control
// mean anything.
const MUST_FAIL = new Set(["handover", "start", "pose", "length", "spacing", "exposure", "legibility", "reduced"])
const blind = controlled.filter((c) => MUST_FAIL.has(c.key) && c.pass)
const keepers = controlled.filter((c) => !MUST_FAIL.has(c.key) && !c.pass)
const failed = shipped.filter((c) => !c.pass)
/* `keepers` USED TO BE COMPUTED, PRINTED AS A NOTE, AND LEFT OUT OF THE EXIT
 * CONDITION — the exit tested only `failed.length || blind.length`, so a keeper
 * row failing on the control printed a NOTE under a green SOUND and a zero exit.
 * A keeper is a row asserted to be true of BOTH cameras; it going red on the
 * control means the row is not describing what it says it describes, which is
 * an instrument finding and not a footnote. It is in the verdict now. */
const notSound = failed.length || blind.length || keepers.length || !reducedCalibrated

console.log(
  `\n${shipped.length - failed.length}/${shipped.length} claims hold on the shipped camera.` +
    `\n${MUST_FAIL.size - blind.length}/${MUST_FAIL.size} claims that describe the change correctly FAIL on the control.`,
)
if (blind.length) {
  console.log(
    `\nINSTRUMENT IS BLIND — the prior camera passes a claim it should not:\n` +
      blind.map((c) => `  - ${c.name}`).join("\n"),
  )
}
if (keepers.length) {
  console.log(
    `\nKEEPER ROW RED ON THE CONTROL — and this now counts. That row is asserted to be\n` +
      `true of BOTH cameras, so its failing here means it is not describing what it says:\n` +
      keepers.map((c) => `  - ${c.name}\n        ${c.detail.split("\n")[0]}`).join("\n"),
  )
}
if (!reducedCalibrated) {
  console.log(
    `\nINSTRUMENT IS BLIND — a reduced-motion zero can be dropped from page.tsx without\n` +
      `the reduced row noticing. That is the defect this lane repaired; see the calibration above.`,
  )
}
console.log(notSound ? "\nNOT SOUND" : "\nSOUND")
process.exit(notSound ? 1 : 0)

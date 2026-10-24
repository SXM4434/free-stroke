// EVERY CONTROL ON THE HERO PANEL, SWEPT: does moving it change a rendered
// channel, in the state the panel actually shows it?
//
// WHY THIS FILE EXISTS. Four separate dead controls have been found in this one
// beat, each by hand, each after it had already shipped:
//
//   `pushScaleEnd`      declared, defaulted, documented — no consumer   (§10.2 C2)
//   `squashX`/`squashY` computed by the model, printed as text          (§11.4.3)
//   `standupAz/El`, `fillStand`  read only on the PARKED camera read
//   `anticipation.holdSec`       read by nothing, on any read
//
// Finding the fifth by hand as well would be the same mistake a fifth time. This
// is the sweep, as an assertion: perturb each control, sample the WHOLE beat at
// its own frame rate, and diff every channel that reaches the render.
//
// TWO THINGS IT CHECKS, AND THE SECOND IS THE ONE THAT KEEPS BEING MISSED:
//
//   1 · A control the panel SHOWS must move a rendered channel. Not "some"
//       channel — a RENDERED one, because `squashX` moved a channel for months
//       while nothing drew it.
//   2 · Every channel a control can move must have a real consumer. The channel
//       list below is not "the fields of HeroSample", it is the fields the page
//       and the viewport actually read, with the site named. A field that only
//       reaches a readout is declared NOT-RENDERED here rather than counted.
//
// VISIBILITY IS PART OF THE CLAIM. A dial that is inert under the shipped read
// and live under a parked one is not broken wiring — it belongs to the parked
// read — but a panel that shows it anyway is lying. So each entry carries the
// state in which the panel renders it, and is judged in that state. `holdAz`
// under the parked camera and `standupAz` under the drifting one are both live;
// showing `standupAz` while the camera is parked is the defect.
//
// CALIBRATION — three known-bad inputs, because a sweep that has only ever seen
// live dials is a sweep nobody has shown can fire:
//   a) a synthetic dial pointing at a parameter nothing reads MUST report DEAD;
//   b) a dial known to be live MUST NOT report DEAD;
//   c) the pre-fix panel — the four dials this lane gated — MUST report DEAD,
//      reproducing the defect on demand.
//
// Usage: node scripts/verify/assert-hero-dials.mjs [--verbose]
//
// It opens Chrome. Both browser arms — the panel driven for real, and the
// frozen-panel control that must come back all-DEAD — run on this bare
// invocation. There is no flag to turn them off, because there was one and no
// sweep ever passed it (see the block above `liveArm`).
import { loadTs } from "./_ts-load.mjs"

const { DEFAULT_HERO_MOTION, sampleHeroMotion, totalDuration, HERO_SHEETS } =
  loadTs("lib/hero-motion.ts")
const VERBOSE = process.argv.includes("--verbose")
/** Every film the panel offers, derived — the sample's own SHAPE is
 *  film-dependent, so a discovery that visits one film sees one film's
 *  channels. See `discoverChannels`. */
const FILM_SHAPES = Object.keys(HERO_SHEETS)

/* ---- what actually reaches the screen -------------------------------------
 * Each channel names its consumer. These were read first-hand, not assumed:
 * `app/desk-doodles/page.tsx` builds `flatten` from the sample and passes it to
 * `components/viewport-3d.tsx`, writes `reveal` to a ref the frame loop reads,
 * and drives `az`/`el`/`fill` through `__captureHarness.orbitView`.
 *
 * ⚠ `jointBreak` USED TO BE IN `NOT_RENDERED` AND THAT IS NO LONGER TRUE — the
 * note said *"`FlatState` in viewport-3d.tsx has no field for it"*, which was a
 * fact about the tree on the day it was written and is a false statement about
 * the tree now. `FlatState.jointBreak` exists (viewport-3d.tsx), the page puts
 * `jointBreak: sample.jointBreak` into the flatten memo and lists it in that
 * memo's deps, and `assert-hero-k7-news.mjs` gates the result on pixels at 8/8.
 * So it is counted here, `ret.breakK` reports live because it IS live, and the
 * NOT-RENDERED list is left carrying only things that really are not drawn.
 *
 * This is the second half of the same class as the `penCarve` row below it: a
 * channel arrives in two files and the map that says where channels arrive is a
 * THIRD file, so it rots silently in the window between them. The map is still
 * hand-maintained — see the NOT-COVERED note at the bottom, which says so —
 * but a hand-maintained map that nobody re-reads is how a dial gets certified
 * live against a consumer that no longer exists, or dead against one that now
 * does. */
const RENDERED = {
  az: "page.tsx __captureHarness.orbitView",
  el: "page.tsx __captureHarness.orbitView",
  fill: "page.tsx __captureHarness.orbitView",
  reveal: "page.tsx revealRef -> AnimatedStrokes",
  flat: "flatten.ink -> viewport-3d FlatState",
  depth: "flatten.depth -> viewport-3d FlatState",
  yaw: "flatten.yaw -> viewport-3d FlatState",
  shade: "flatten.shade -> viewport-3d FlatState",
  shadow: "flatten.shadow -> viewport-3d contact shadow opacityScale",
  squashX: "flatten.squashX -> viewport-3d :1715",
  squashY: "flatten.squashY -> viewport-3d :1715",
  jointBreak: "flatten.jointBreak -> viewport-3d applyJointBreak (gated by assert-hero-k7-news)",
  penCarve: "flatten.penCarve -> viewport-3d applyPenCarve (gated by assert-pen-carve)",
  /* ⚠ THESE TWO WERE MISSING AND THE MAP SAID "13 of 13" — DEFECT (class 3, a
   * hand-maintained map that rotted exactly the way the note above predicts).
   * `HeroSample` carries `pitch` (hero-motion.ts:3153) and `letters` (:3168),
   * both of them added by O2 and O5, and BOTH RENDER:
   *   page.tsx:1778  `pitch: sample.pitch ?? 0`   -> FlatState.pitch (viewport-3d:918, applied :5205)
   *   page.tsx:1870  `letters: sample.letters`    -> applyLetterMotion (viewport-3d:2675, called :3513)
   * So it is 15, not 13. This is not cosmetic: SEVEN of the panel's dials move
   * nothing else — `Stands up` moves only `pitch`, and the cascade's five move
   * only `letters` — so with these two absent every one of them reports DEAD
   * the moment the sweep can see them, and the row would have read as seven
   * dead controls on a panel where all seven are live.
   *
   * Both are OPTIONAL on the sample (the fast path omits them entirely on the
   * six films that have no hinge and no cascade), and `letters` is an ARRAY of
   * `LetterState`. `Math.abs(undefined - undefined)` is NaN and `NaN > 1e-12`
   * is FALSE, so under the old numeric-only diff the channel would not have
   * thrown — it would have gone silently invisible, which is worse. See
   * `channelDelta`. */
  pitch: "flatten.pitch -> viewport-3d FlatState.pitch (:918, applied :5205)",
  letters: "flatten.letters -> viewport-3d applyLetterMotion (:2675, called :3513)",
}
/* ⚠ AND THIS WAS `{}`, WHICH MADE THE GHOST ROW STRUCTURALLY UNABLE TO FAIL —
 * DEFECT (class 1, a row that cannot fail).
 *
 * The sweep visited `[...CHANNELS, ...Object.keys(NOT_RENDERED)]`, and
 * `Object.keys({})` is empty, so every channel it ever looked at was a key of
 * `RENDERED`. `c in RENDERED` was therefore true for all of them, so
 * `onlyUnrendered` — "the control moved something and NONE of it renders" — was
 * false BY CONSTRUCTION, and the claim "no control moves ONLY a channel nothing
 * draws" could not go red on any input whatsoever. It was green for the same
 * reason `0 === 0` is green.
 *
 * The list is populated again with the three quantities the model computes that
 * genuinely do not reach a pixel, each with the site that consumes them named,
 * and the sweep now walks EVERY channel the sample carries rather than a
 * hand-written union of two lists — see `discoverChannels`. */
const NOT_RENDERED = {
  phase: "page.tsx:2352 data-hero-phase + :2398 the readout — a TAG, drawn as text",
  phaseT: "page.tsx:2353 data-hero-phase-t + :2400 the readout — a TAG, drawn as text",
  sx: "the turn's extent. Read by assert-hero-ledger's moment detection and by " +
    "emerge.edgeFloor; the RENDER reconstructs it from yaw, and no host passes it",
}
const CHANNELS = Object.keys(RENDERED)

/* ---- the panel, as data ---------------------------------------------------
 * One row per control the hero panel renders, in panel order. `when` is the
 * state in which the panel SHOWS it — the sweep drives that state before it
 * judges the control, so a dial belonging to a parked read is judged on the
 * parked read.
 *
 * KEEP THIS IN SYNC WITH THE PANEL. It is a second copy of one thing, which
 * this codebase rightly distrusts — so `dialsInPanel` below reads the real
 * `<Dial label=` / `data-read-*` sites out of page.tsx and fails if the two
 * disagree. The table is not trusted, it is checked. */
const PANEL = [
  // Emerge
  { label: "Swell", path: "emerge.overshoot", probe: 0.3, when: { "emerge.mode": "prior" } },
  { label: "Light lag", path: "emerge.lightLagSec", probe: 0.25, when: { "emerge.mode": "prior" } },
  { label: "Light", path: "emerge.lightSec", probe: 1.4, when: { "emerge.mode": "prior" } },
  // The panel hides this one on the parked carve, so it is judged on the read
  // that shows it — the same rule `Swell` and `Drift cut` are judged under.
  { label: "Pen carve", path: "carveAmount", probe: 0.2, when: { carveLaw: "pen" } },
  // Camera arc — the desk pose replaces the arc's five dials on the two parked
  // laws that use it, so it is judged in the state the panel shows it in, which
  // is the same rule `Swell` and `Drift cut` are judged under.
  { label: "Desk azimuth", path: "deskAz", probe: 55, when: { camera: "desk" } },
  { label: "Desk elevation", path: "deskEl", probe: 55, when: { camera: "desk" } },
  { label: "Lying elevation", path: "lieEl", probe: 40 },
  { label: "Stand azimuth", path: "standupAz", probe: 80, when: { cameraPark: "prior" } },
  { label: "Stand elevation", path: "standupEl", probe: 50, when: { cameraPark: "prior" } },
  { label: "Hold azimuth", path: "holdAz", probe: 80 },
  { label: "Hold elevation", path: "holdEl", probe: 50 },
  // Push
  { label: "Lying", path: "fillLie", probe: 1.4 },
  { label: "Standing", path: "fillStand", probe: 1.4, when: { cameraPark: "prior" } },
  { label: "Held", path: "fillHold", probe: 1.4 },
  // Curve
  { label: "Overshoot", path: "backC1", probe: 3.5, when: { riseCurve: "prior" } },
  { label: "Wind-up depth", path: "riseGatherDepth", probe: 0.3 },
  { label: "Wind-up length", path: "riseGatherFrac", probe: 0.35 },
  { label: "Rise overshoot", path: "riseOvershoot", probe: 0.35 },
  { label: "Drift cut", path: "driftCut", probe: 0.2, when: { cameraPark: "prior" } },
  { label: "Draw linearity", path: "drawLinearBlend", probe: 0 },
  // Anticipation squash
  { label: "Compress", path: "anticipation.compressSec", probe: 0.05 },
  { label: "Hold tension", path: "anticipation.holdSec", probe: 0.02 },
  { label: "Release", path: "anticipation.releaseSec", probe: 0.05 },
  { label: "Scale Y", path: "anticipation.scaleY", probe: 0.86 },
  { label: "Scale X", path: "anticipation.scaleX", probe: 1.09 },
  /* ⚠ THE SEVEN THE COVERAGE ROW NEVER SAW — and the row printed "25 dials …
   * table and panel agree" the whole time. See the regex note below `PANEL` for
   * the miss itself; these are the controls it hid. Each one is judged under the
   * film that shows it, the same rule `Swell` and `Drift cut` are judged under —
   * the pop-up's two and the cascade's five render only while their own film is
   * selected.
   *
   * SIX OF THE SEVEN MOVE ONLY `pitch` OR `letters`, so before those two joined
   * `RENDERED` every one of them would have reported DEAD on a panel where all
   * seven are live. That is why the channel map had to be fixed first. */
  // O2's hinge — the pop-up's two numbers.
  { label: "Stands up", path: "popStandDeg", probe: 40, when: { shape: "popUp" } },
  { label: "Commit", path: "popStandFH", probe: 0.4, when: { shape: "popUp" } },
  // O5's cascade — the letter-by-letter film's five.
  { label: "Ends turned", path: "letterLandYaw", probe: 40, when: { shape: "letterByLetter" } },
  { label: "First letter alone", path: "letterLeadSec", probe: 1.2, when: { shape: "letterByLetter" } },
  { label: "Beat", path: "letterBeatSec", probe: 0.9, when: { shape: "letterByLetter" } },
  { label: "Doubling from", path: "letterPairFrom", probe: 3, when: { shape: "letterByLetter" } },
  { label: "Edge held", path: "letterEdgePinSec", probe: 0.4, when: { shape: "letterByLetter" } },
  // The film — the two rows that pick a whole beat and a whole camera.
  // `shape` is probed at the SHIPPED durations deliberately: the panel writes an
  // exposure sheet into the dock when the pill is clicked, and this sweep does
  // not drive the dock. So the row proves the LAW changed the picture on its
  // own, without the retime helping it, which is the stricter reading.
  { label: "The film", path: "shape", probe: "turnLands", pill: "film" },
  { label: "Camera", path: "camera", probe: "deadOn", pill: "camera" },
  // Reads — the pill rows
  { label: "Ending", path: "ret.mode", probe: "prior", pill: "ending" },
  { label: "Exposure", path: "cadence", probe: "ones", pill: "exposure" },
  { label: "Shadow", path: "shadowLaw", probe: "prior", pill: "shadow" },
  { label: "The turn", path: "emerge.mode", probe: "prior", pill: "turn" },
  { label: "The drawing", path: "carveLaw", probe: "prior", pill: "carve" },
  { label: "The rise", path: "riseCurve", probe: "prior", pill: "rise" },
  { label: "After the rise", path: "cameraPark", probe: "prior", pill: "park" },
  { label: "The wind-up", path: "releaseLaw", probe: "prior", pill: "release" },
  { label: "Lying down", path: "tiltLaw", probe: "prior", pill: "tilt" },
  { label: "Coming back", path: "descendLaw", probe: "prior", pill: "descend" },
]

/* ---- machinery ------------------------------------------------------------ */
function set(obj, path, v) {
  const parts = path.split(".")
  const copy = structuredClone(obj)
  let o = copy
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]
  o[parts[parts.length - 1]] = v
  return copy
}
function get(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj)
}

/** Every output frame of the beat, so a channel that only moves for two frames
 *  in the middle of an eleven-second take is still caught. */
function series(P) {
  const n = Math.round(totalDuration(P) * P.fps)
  const rows = []
  for (let i = 0; i <= n; i++) rows.push(sampleHeroMotion(P, i / P.fps))
  return rows
}

/* ---- CHANNEL DISCOVERY, AND WHY A HAND-WRITTEN UNION WAS NOT ENOUGH --------
 *
 * The sweep used to iterate `[...CHANNELS, ...Object.keys(NOT_RENDERED)]` —
 * two hand-written lists — so a channel in NEITHER was invisible. That is how
 * `pitch` and `letters` went unswept: they were added to `HeroSample` by O2 and
 * O5 and nothing in this file had to notice.
 *
 * The channels are read off the sample itself now, across every film, because
 * the sample's own shape is film-dependent: `sampleHeroMotion` takes a FAST
 * PATH on the six films with no hinge and no cascade and does not carry `pitch`
 * or `letters` as keys AT ALL there. A discovery that only looked at the
 * shipped film would still have missed both.
 *
 * A channel the sample has that neither list classifies is then a scored
 * failure — the map has rotted and the file says so, rather than sweeping past
 * it. */
function discoverChannels(P) {
  const found = new Set()
  for (const shape of FILM_SHAPES) {
    const p = { ...P, shape }
    const total = totalDuration(p)
    for (const f of [0, 0.2, 0.4, 0.55, 0.7, 0.85, 1]) {
      for (const k of Object.keys(sampleHeroMotion(p, f * total))) found.add(k)
    }
  }
  return [...found]
}

/**
 * HOW FAR ONE CHANNEL MOVED BETWEEN TWO SERIES.
 *
 * ⚠ THIS WAS `Math.abs(a[i][c] - b[i][c])` AND IT COULD NOT SEE HALF THE MODEL.
 *
 *   · `pitch` and `letters` are OPTIONAL. On the six films that omit them the
 *     subtraction is `undefined - undefined` = NaN, and `NaN > 1e-12` is FALSE
 *     — so the channel reported "did not move" rather than throwing. A silent
 *     invisible channel is the failure mode this whole file exists to catch.
 *   · `letters` is an ARRAY of `LetterState`, so arithmetic on it is
 *     meaningless in both directions.
 *   · `phase` is a STRING.
 *
 * Each case is handled by name, and an unhandled one RAISES rather than
 * returning a falsy number, because returning 0 for "I could not compare this"
 * is exactly the defect.
 */
const LETTER_FIELDS = ["yaw", "flat", "depth", "shade"]
function channelDelta(x, y) {
  if (x === undefined && y === undefined) return 0
  // Present on one arm and absent on the other IS a move — a film gaining or
  // losing a whole channel is the largest move there is.
  if (x === undefined || y === undefined) return Infinity
  if (Array.isArray(x) || Array.isArray(y)) {
    if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) return Infinity
    let m = 0
    for (let k = 0; k < x.length; k++) {
      for (const f of LETTER_FIELDS) m = Math.max(m, Math.abs(x[k][f] - y[k][f]))
    }
    if (Number.isNaN(m)) throw new Error("letter fields did not compare numerically")
    return m
  }
  if (typeof x === "string" || typeof y === "string") return x === y ? 0 : Infinity
  const d = Math.abs(x - y)
  if (Number.isNaN(d)) throw new Error(`channel did not compare numerically: ${x} vs ${y}`)
  return d
}

function moved(a, b, channels = ALL_CHANNELS) {
  const out = []
  const n = Math.min(a.length, b.length)
  for (const c of channels) {
    let m = 0
    for (let i = 0; i < n; i++) {
      let d
      try {
        d = channelDelta(a[i][c], b[i][c])
      } catch (e) {
        // NOT a silent zero. A channel this file cannot compare is a hole in
        // the sweep and has to be visible as one.
        UNCOMPARABLE.set(c, String(e.message))
        d = 0
      }
      if (d > m) m = d
    }
    if (m > 1e-12) out.push({ c, m, rendered: c in RENDERED })
  }
  return out
}
const UNCOMPARABLE = new Map()

/** Judge one control in the state the panel shows it. */
function judge(entry, base, rendered = RENDERED) {
  let P = base
  for (const [k, v] of Object.entries(entry.when ?? {})) P = set(P, k, v)
  const before = series(P)
  const after = series(set(P, entry.path, entry.probe))
  const ch = moved(before, after).map((c) => ({ ...c, rendered: c.c in rendered }))
  return {
    ...entry,
    channels: ch,
    live: ch.some((c) => c.rendered),
    onlyUnrendered: ch.length > 0 && !ch.some((c) => c.rendered),
  }
}

/* ---- the table is checked against the real panel --------------------------- */
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { PORT } from "./lib/dev-server.mjs"
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const PAGE = readFileSync(join(ROOT, "app", "desk-doodles", "page.tsx"), "utf8")
/* ⚠ THE REGEX MATCHED ONE LINE AND THE PANEL IS NOT ONE LINE — DEFECT (class 4,
 * a coverage row that measured a subset of its own subject).
 *
 * `/<Dial label="([^"]+)"/` requires `label=` to be the first attribute AND on
 * the same line as the tag. `page.tsx` writes 25 of its dials that way and NINE
 * across several lines, so the coverage row read 25 dials, compared 25 against
 * a 25-row table, and printed *"25 dials and 12 pill rows read out of page.tsx;
 * table and panel agree"* while seven `HeroMotionParams` controls went unswept.
 * It is the same shape as the 4-films-against-7 miss this file's own sibling
 * header records: a gate grading a subset it defines itself cannot notice what
 * it is not looking at, and the number it prints reads like coverage.
 *
 * Multi-line tolerant now. `[\s\S]*?` is lazy and bounded by the first
 * `label="` after a `<Dial ` tag, so it cannot run past one dial into the next. */
const panelDials = [...PAGE.matchAll(/<Dial\s[\s\S]*?label="([^"]+)"/g)].map((m) => m[1])
const panelPills = [...PAGE.matchAll(/data-read-([a-zA-Z]+)=\{id\}/g)].map((m) => m[1])

/**
 * DIALS THIS SWEEP CANNOT REACH, NAMED RATHER THAN LEFT OUT OF THE REGEX.
 *
 * The NOT COVERED block at the bottom of this file already says these exist —
 * *"the hand's Wobble and stroke-ending pills… are not parameters of
 * `HeroMotionParams` and this sweep cannot reach them"*. It said so while the
 * regex was quietly not matching them, which meant the exclusion was enforced by
 * an accident of formatting rather than by a decision. If `Wobble` were ever
 * rewritten onto one line the coverage row would have started failing for a
 * reason nobody had written down.
 *
 * An exclusion has to be a list with a reason on it, and it has to be checked:
 * a name here that is NOT on the panel is as much a rot signal as a panel dial
 * that is not in the table.
 */
const PANEL_EXCLUDED = {
  Wobble: "the hand's tremor — it changes what the DRAWING is, not how the beat moves, " +
    "so it is not a parameter of HeroMotionParams and this sweep cannot reach it",
  /* Same class as Wobble, and named for the same reason rather than left to a
   * regex. This one sets `LETTER_REACH_FRAC` for `assignLetters`, so what it
   * moves is the LETTER MAP — how many pieces the word comes apart into. The
   * page then writes that count into `letterCount`, which this sweep DOES cover.
   * So the dial is live and its effect is gated; it is simply one level upstream
   * of `HeroMotionParams`, which is the only thing this file can drive.
   * `assert-hero-options.mjs`'s LETTER MAP rows are where it is judged, against
   * two authored words and with the shipped 1.0-nib value as the known-bad. */
  "Fused when closer than":
    "it sets the letter LAW's reach, not a motion channel — it changes how many " +
    "pieces the word is, and the page writes that into letterCount, which this " +
    "sweep does cover. Judged by assert-hero-options.mjs's LETTER MAP rows.",
}

/* ---- run ------------------------------------------------------------------ */
const P = DEFAULT_HERO_MOTION
const ALL_CHANNELS = discoverChannels(P)
const unclassified = ALL_CHANNELS.filter((c) => !(c in RENDERED) && !(c in NOT_RENDERED))
const results = PANEL.map((e) => judge(e, P))

console.log(`THE HERO PANEL — ${PANEL.length} controls swept over the whole ${totalDuration(P).toFixed(2)}s beat\n`)
console.log("      control            parameter                    state shown in        moves")
for (const r of results) {
  const state = r.when
    ? Object.entries(r.when).map(([k, v]) => `${k}=${v}`).join(",")
    : "always"
  const ch = r.channels.length
    ? r.channels.map((c) => (c.rendered ? c.c : `${c.c}*`)).join(" ")
    : "NOTHING"
  console.log(
    `${r.live ? "live" : "DEAD"}  ${r.label.padEnd(18)} ${r.path.padEnd(28)} ${state.padEnd(20)} ${ch}`,
  )
}
console.log(
  `\n  ${Object.keys(RENDERED).length} of ${ALL_CHANNELS.length} channels on HeroSample render; ` +
    `* = the channel moves but nothing draws it:\n` +
    Object.entries(NOT_RENDERED).map(([k, v]) => `      ${k.padEnd(8)} ${v}`).join("\n"),
)

if (VERBOSE) {
  console.log("\n  channel -> consumer")
  for (const [c, site] of Object.entries(RENDERED)) console.log(`    ${c.padEnd(10)} ${site}`)
}

/* ---- claims --------------------------------------------------------------- */
const dead = results.filter((r) => !r.live)
const ghosts = results.filter((r) => r.onlyUnrendered)
const missingFromTable = panelDials.filter(
  (l) => !PANEL.some((e) => e.label === l) && !(l in PANEL_EXCLUDED),
)
/** An exclusion for a dial the panel no longer has is rot in the other direction. */
const staleExclusions = Object.keys(PANEL_EXCLUDED).filter((l) => !panelDials.includes(l))
const staleInTable = PANEL.filter(
  (e) => !e.pill && !panelDials.includes(e.label),
).map((e) => e.label)
const pillsMissing = panelPills.filter((p) => !PANEL.some((e) => e.pill === p))

const claims = [
  {
    name: "every control the panel SHOWS moves something that renders",
    pass: dead.length === 0,
    detail:
      dead.length === 0
        ? `${results.length}/${results.length} controls, each judged in the state the panel shows it`
        : `DEAD: ${dead.map((d) => `${d.label} (${d.path})`).join(" · ")}`,
  },
  {
    name: "no control moves ONLY a channel nothing draws",
    pass: ghosts.length === 0,
    detail:
      ghosts.length === 0
        ? "0 — this is the squashX class: a number that changes and never reaches a pixel"
        : `GHOSTS: ${ghosts.map((g) => `${g.label} -> ${g.channels.map((c) => c.c).join(",")}`).join(" · ")}`,
  },
  {
    name: "the sweep covers the panel — every dial and every pill row is in the table",
    pass:
      missingFromTable.length === 0 &&
      staleInTable.length === 0 &&
      pillsMissing.length === 0 &&
      staleExclusions.length === 0 &&
      panelDials.length === PANEL.filter((e) => !e.pill).length + Object.keys(PANEL_EXCLUDED).length,
    detail:
      `${panelDials.length} dials and ${panelPills.length} pill rows read out of page.tsx ` +
      `(multi-line tolerant — the one-line regex read 25 of the ${panelDials.length}); ` +
      `${PANEL.filter((e) => !e.pill).length} swept + ${Object.keys(PANEL_EXCLUDED).length} named ` +
      `exclusion(s) [${Object.keys(PANEL_EXCLUDED).join(", ")}] = ${panelDials.length}; ` +
      (missingFromTable.length ? `NOT SWEPT: ${missingFromTable.join(", ")}; ` : "") +
      (staleInTable.length ? `IN THE TABLE BUT NOT IN THE PANEL: ${staleInTable.join(", ")}; ` : "") +
      (staleExclusions.length ? `EXCLUDED BUT NOT ON THE PANEL: ${staleExclusions.join(", ")}; ` : "") +
      (pillsMissing.length ? `PILL ROWS NOT SWEPT: ${pillsMissing.join(", ")}; ` : "") +
      "table and panel agree",
  },
  {
    /* THE MAP IS CHECKED AGAINST THE MODEL, not just maintained. `pitch` and
     * `letters` were on `HeroSample` for two whole films' worth of work while
     * this file's map said "13 of 13". */
    name: "every channel the model produces is classified — rendered, or named as not drawn",
    pass: unclassified.length === 0 && UNCOMPARABLE.size === 0,
    detail:
      `${ALL_CHANNELS.length} channels on HeroSample across all ${FILM_SHAPES.length} films: ` +
      `${Object.keys(RENDERED).length} rendered, ${Object.keys(NOT_RENDERED).length} named as not drawn` +
      (unclassified.length ? ` — UNCLASSIFIED: ${unclassified.join(", ")}` : "") +
      (UNCOMPARABLE.size
        ? ` — COULD NOT BE COMPARED: ${[...UNCOMPARABLE].map(([c, why]) => `${c} (${why})`).join("; ")}`
        : ""),
  },
]
console.log("")
for (const c of claims) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}\n      ${c.detail}`)

/* ---- calibration ---------------------------------------------------------- */
console.log("\nCALIBRATION — three known-bad inputs, each required to be caught")

// (a) A parameter nothing reads. Added to the params object at run time, so it
//     is genuinely unread rather than merely unused-looking.
const synthetic = judge(
  { label: "__deadProbe", path: "__deadProbe", probe: 99 },
  { ...P, __deadProbe: 1 },
)
const aOk = !synthetic.live
console.log(
  `  ${aOk ? "caught, correctly" : "MISSED"}  a synthetic dial on a parameter nothing reads reports ` +
    `${synthetic.live ? "LIVE" : "DEAD"}`,
)

// (b) A dial that is unambiguously live must not be swept up with them.
const known = results.find((r) => r.label === "Hold azimuth")
const bOk = known.live
console.log(
  `  ${bOk ? "clean, correctly" : "FALSE POSITIVE"}  a known-live dial (Hold azimuth) reports ` +
    `${known.live ? "LIVE" : "DEAD"}`,
)

// (c) THE PANEL AS IT SHIPPED, reproduced: the four controls this lane gated
//     were shown unconditionally, i.e. judged with NO `when`. Every one of them
//     must come back DEAD, or this file did not measure the defect it was
//     written for.
const PRE_FIX = [
  { label: "Stand azimuth", path: "standupAz", probe: 80 },
  { label: "Stand elevation", path: "standupEl", probe: 50 },
  { label: "Standing", path: "fillStand", probe: 1.4 },
  { label: "Drift cut", path: "driftCut", probe: 0.2 },
  { label: "Light lag", path: "emerge.lightLagSec", probe: 0.25 },
  { label: "Light", path: "emerge.lightSec", probe: 1.4 },
  { label: "Overshoot", path: "backC1", probe: 3.5 },
]
const preFix = PRE_FIX.map((e) => judge(e, P))
const cOk = preFix.every((r) => !r.live)
console.log(
  `  ${cOk ? "reproduced, correctly" : "NOT REPRODUCED"}  the pre-fix panel showed these unconditionally: ` +
    preFix.map((r) => `${r.label} ${r.live ? "LIVE" : "DEAD"}`).join(" · "),
)
// And the one that was dead on EVERY read, not just the shipped one.
const holdSecPre = judge(
  { label: "Hold tension", path: "anticipation.holdSec", probe: 0.02 },
  { ...P, releaseLaw: "prior" },
)
const dOk = !holdSecPre.live
console.log(
  `  ${dOk ? "reproduced, correctly" : "NOT REPRODUCED"}  Hold tension under the PRIOR wind-up law ` +
    `reports ${holdSecPre.live ? "LIVE" : "DEAD"} — it was dead on every read until the release wired it`,
)

/* ---- what this file does NOT cover, stated rather than implied ------------- */
console.log(
  `\nNOT COVERED, and named so it is not mistaken for a clean bill:` +
    `\n  · Controls outside the motion model — Look, Engine, the word source, the hand's` +
    `\n    Wobble and stroke-ending pills, the pen's clock. They change what the DRAWING is,` +
    `\n    not how the beat moves, so they are not parameters of \`HeroMotionParams\` and this` +
    `\n    sweep cannot reach them. They want their own sweep against the built strokes.` +
    `\n  · The consumer side is a MAP, not a measurement. \`RENDERED\` above names where each` +
    `\n    channel is read; that was checked by hand and it can rot. \`assert-hero-dead-channels\`` +
    `\n    is the pixel-level check on the two channels that actually went dead once.` +
    `\n  · Beat DURATIONS are the timeline dock's and are not controls here.`,
)

/* (e) THE GHOST ROW, PROVED ABLE TO FIRE. It was `false` by construction for as
 *     long as `NOT_RENDERED` was `{}` — see the note there. `Shadow` moves
 *     exactly one channel, `shadow`, so re-judging it against a map in which
 *     that channel is declared undrawn must report a GHOST. If it does not, the
 *     row is still vacuous and the repair did nothing. */
const ghostMap = { ...RENDERED }
delete ghostMap.shadow
const ghostProbe = judge({ label: "Shadow", path: "shadowLaw", probe: "prior" }, P, ghostMap)
const eOk = ghostProbe.onlyUnrendered
console.log(
  `  ${eOk ? "caught, correctly" : "MISSED — the ghost row is still vacuous"}  a dial that moves ONLY an ` +
    `undrawn channel reports ${eOk ? "GHOST" : "clean"} (Shadow -> ` +
    `${ghostProbe.channels.map((c) => c.c).join(",") || "nothing"}, judged against a map with \`shadow\` undrawn)`,
)

/* ══════════════════════════════════════════════════════════════════════════════
 * THE LIVE ARM — because 44/44 above is NOT evidence that the panel works.
 *
 * ⚠ DEFECT (class 1, a vacuous subject), and it was proved on this build rather
 * than argued. A sibling lane deliberately FROZE the panel's memo dependencies
 * in `app/desk-doodles/page.tsx` as a mutation control, so the dial controls
 * genuinely stopped updating the render. `assert-hero-option-panel` went RED on
 * three rows. THIS FILE STAYED GREEN AT 37/37 AND PRINTED SOUND.
 *
 * It could not have done anything else. Everything above sweeps the MODEL —
 * `sampleHeroMotion` over `DEFAULT_HERO_MOTION` — and never opens the page. Its
 * subject is "does this parameter reach a rendered channel", which is a fact
 * about `lib/hero-motion.ts` and stays true no matter what the panel does. So
 * "every control the panel SHOWS moves something that renders" was, read
 * precisely, "every parameter the TABLE lists moves something the MAP calls
 * rendered" — a claim with no panel in it at all. The word SHOWS was doing work
 * the file never did.
 *
 * That gap matters more now than it did, because the panel has just grown
 * FILM-CONDITIONAL dial blocks — the pop-up's two and the cascade's five — that
 * render only while their own film is selected. Those are exactly the controls
 * whose existence is a property of the panel and not of the model.
 *
 * So: `--live` drives the real dials in the real browser and reads the RENDER
 * back as pixels off the stage. Not a readout — this file's own rule is that a
 * field which only reaches a readout is not rendered, and that rule applies to
 * the instrument too.
 *
 * THE KNOWN-BAD IS `--live --freeze`, and it is the frozen panel reproduced
 * without touching a source file: an init script drops `input`/`change` events
 * from the panel's dials (and only those — the transport still scrubs), so the
 * controls are on screen, the user moves them, and nothing happens. That is
 * what a frozen memo looks like from the render's side, which is the side this
 * arm measures. It does NOT distinguish a frozen memo from an unwired handler;
 * both are the same defect to a viewer and to a pixel, and the arm says so
 * rather than claiming more.
 * ══════════════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════════════
 * 2026-08-07 · `--live` AND `--freeze` ARE GONE. BOTH ARMS RUN ON THE BARE
 * INVOCATION, AND THAT IS THE ENTIRE FIX.
 *
 * WHAT THEY COST. This file's browser arm — the panel, the thing
 * `docs/README.md:198` advertises it for ("every panel control, judged in the
 * state it is SHOWN in") — sat behind `--live`. **Neither battery runner passes
 * any flag**, deliberately: `run-browser-battery.mjs`'s header says so, and it is
 * right to, because the bare invocation is the one the next person types.
 *
 * The consequence, measured in the browser battery on 2026-08-07 (explainer 27
 * §2): this gate ran in **0.3 seconds, emitted 4 rows, and never opened Chrome.**
 * It is classified BROWSER because its source contains `chromium.launch`, so
 * `run-battery.mjs` refuses it as a model gate and `run-browser-battery.mjs` runs
 * it without the flag that makes it a browser gate. **It fell between the two
 * runners while appearing in both their inventories** — green, in both.
 *
 * WHY THE FLAG WAS REMOVED RATHER THAN PASSED BY THE RUNNERS. A runner-passed
 * flag only helps people who go through a runner; anyone typing the gate's own
 * name still gets the model sweep wearing the panel's name. An arm that always
 * runs cannot drift out of a table, needs no exemption, and needs nobody to
 * remember it. `run-battery.mjs`'s `EXTRA_ARGS` carries a comment recording that
 * this gate is deliberately absent from it.
 *
 * AND THE CONTROL RUNS BY DEFAULT TOO. `--freeze` was the known-bad — the panel
 * with its dials held inert, which every live row must then report DEAD. Keeping
 * a negative control behind a flag is the same defect one level down: explainer
 * 21 §7 states the standing rule, "the gate runs three kinds of control on the
 * DEFAULT invocation, never behind a flag", precisely because this repo has
 * caught eleven instruments reporting green while measuring nothing. A control
 * nobody runs cannot show the instrument is awake.
 *
 * The second launch is what that costs, and it is stated rather than hidden.
 * ══════════════════════════════════════════════════════════════════════════════ */

/** The dials the live arm drives, and the playhead each one is judged at.
 *  `at` is derived from the model's own phase layout — never a wall-clock
 *  second, for the reason every other file in this directory records. */
const LIVE_DIALS = [
  { label: "Lying elevation", path: "lieEl", to: 25, why: "the look-down's depth — the whole frame swings" },
  { label: "Scale Y", path: "anticipation.scaleY", to: 0.86, why: "K2's squash — the mark loses height" },
  { label: "Draw linearity", path: "drawLinearBlend", to: 0, why: "the draw-in's spacing — where the pen is mid-stroke" },
  { label: "Hold elevation", path: "holdEl", to: 45, why: "the held framing" },
]

/* WHERE TO LOOK, DERIVED FROM THE MODEL RATHER THAN NAMED BY HAND.
 *
 * The first version of this arm named a PHASE per dial and got two of four
 * wrong — `Hold elevation` judged inside `hold`, which since K7 landed is the
 * round trip back to K1's framing where `holdEl` no longer applies, and
 * `Draw linearity` probed to a value it already held. Both reported DEAD on
 * controls that are live, which is a false positive of exactly the kind this
 * file exists to prevent, produced by the instrument.
 *
 * §11.8's rule again — *"every hardcoded time in this beat's tooling has now
 * been wrong at least once… derive it from the model's own data, and print what
 * was actually read."* The model already knows where a dial's effect is
 * largest: sweep base against probed and take the frame with the biggest
 * rendered-channel delta. The chosen time is printed with the row. */
function peakTimeFor(entry) {
  const a = series(P)
  const b = series(set(P, entry.path, entry.to))
  const n = Math.min(a.length, b.length)
  let best = 0
  let bestI = 0
  for (let i = 0; i < n; i++) {
    let m = 0
    for (const c of Object.keys(RENDERED)) {
      let d = 0
      try {
        d = channelDelta(a[i][c], b[i][c])
      } catch {
        d = 0
      }
      if (Number.isFinite(d)) m = Math.max(m, d / (SCALE_HINT[c] ?? 1))
    }
    if (m > best) {
      best = m
      bestI = i
    }
  }
  return { t: bestI / P.fps, delta: best, frame: bestI, of: n }
}
/** Channels live in different units; this only ranks frames, so a rough
 *  normaliser is enough and being rough is stated rather than hidden. */
const SCALE_HINT = { az: 30, el: 30, fill: 0.5 }

async function liveArm(FREEZE) {
  const { chromium } = await import("./lib/browser.mjs")
  const { phaseOffsets } = loadTs("lib/hero-motion.ts")
  const OFF = phaseOffsets(P)
  const require2 = createRequire(import.meta.url)
  const { createCanvas, loadImage } = require2("@napi-rs/canvas")

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1440 },
    deviceScaleFactor: 1,
  })
  if (FREEZE) {
    /* THE PANEL, FROZEN. A capture-phase listener on `document` runs before the
     * React root's delegated one, so `stopImmediatePropagation` there means the
     * dial's change never reaches state — the control is live in the DOM and
     * inert in the render, which is the defect.
     *
     * SCOPED TO THE PANEL'S OWN SLIDERS. The transport is a range input too, and
     * a control that also froze the scrubber would be proving that a page with
     * no playhead renders the same picture twice, which proves nothing. The
     * perf lane's frozen memo left the timeline working; so does this. */
    await context.addInitScript(() => {
      const block = (e) => {
        const t = e.target
        if (!(t instanceof HTMLInputElement) || t.type !== "range") return
        if (t.hasAttribute("data-hero-scrub")) return
        e.stopImmediatePropagation()
      }
      document.addEventListener("input", block, true)
      document.addEventListener("change", block, true)
    })
  }
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(3000)

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(140)
  }
  const shot = () => page.locator("[data-hero-stage]").screenshot()
  /** How many pixels of the stage actually changed. A mean would let a large
   *  faint drift and a small sharp move look alike. */
  const diff = async (a, b) => {
    const [ia, ib] = await Promise.all([loadImage(a), loadImage(b)])
    const grab = (img) => {
      const c = createCanvas(img.width, img.height)
      const x = c.getContext("2d")
      x.drawImage(img, 0, 0)
      return x.getImageData(0, 0, img.width, img.height).data
    }
    const da = grab(ia)
    const db = grab(ib)
    if (da.length !== db.length) return { px: Infinity, of: 0 }
    let px = 0
    for (let i = 0; i < da.length; i += 4) {
      const la = 0.2126 * da[i] + 0.7152 * da[i + 1] + 0.0722 * da[i + 2]
      const lb = 0.2126 * db[i] + 0.7152 * db[i + 1] + 0.0722 * db[i + 2]
      if (Math.abs(la - lb) > 8) px++
    }
    return { px, of: da.length / 4 }
  }

  const setDial = (label, value) =>
    page.evaluate(
      ([lab, v]) => {
        const hit = [...document.querySelectorAll("span")].find((s) => s.textContent === lab)
        if (!hit) return { ok: false, why: "no such label on the panel" }
        const row = hit.parentElement
        // The readout is the sibling span in the dial's own header row — it is
        // rendered from STATE, so it is what a frozen panel fails to update.
        const readBefore = (row?.textContent ?? "").replace(lab, "").trim()
        let el = hit
        let input = null
        for (let i = 0; i < 6 && el; i++) {
          el = el.parentElement
          input = el?.querySelector('input[type="range"]')
          if (input) break
        }
        if (!input) return { ok: false, why: "label found but no slider under it" }
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        set.call(input, String(v))
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))
        return { ok: true, readBefore }
      },
      [label, value],
    )
  const readout = (label) =>
    page.evaluate((lab) => {
      const hit = [...document.querySelectorAll("span")].find((s) => s.textContent === lab)
      return hit ? (hit.parentElement?.textContent ?? "").replace(lab, "").trim() : null
    }, label)

  /* THE NOISE FLOOR, MEASURED RATHER THAN ASSUMED. Two shots of the same state
   * at the same playhead. The render is deterministic, so this should be 0 — but
   * a threshold nobody measured is a threshold nobody can defend. */
  await seek(OFF.tilt + P.beats.tilt * 0.5)
  const n0 = await shot()
  await page.waitForTimeout(180)
  const n1 = await shot()
  const noise = (await diff(n0, n1)).px
  const FLOOR = Math.max(300, noise * 10)

  const live = []
  for (const d of LIVE_DIALS) {
    const peak = peakTimeFor(d)
    d.peak = peak
    // The peak, and one frame either side of it, so a single sub-pixel frame
    // cannot decide the row.
    const at = [peak.t, Math.max(0, peak.t - 2 / P.fps), peak.t + 2 / P.fps]
    const shots = []
    for (const t of at) {
      await seek(t)
      shots.push(await shot())
    }
    const set = await setDial(d.label, d.to)
    await page.waitForTimeout(250)
    const after = await readout(d.label)
    let best = 0
    for (let i = 0; i < at.length; i++) {
      await seek(at[i])
      best = Math.max(best, (await diff(shots[i], await shot())).px)
    }
    live.push({ ...d, set, after, moved: best, tookInPanel: set.ok && set.readBefore !== after })
  }
  await context.close()
  await browser.close()

  console.log(
    `\nTHE LIVE ARM${FREEZE ? "  [CONTROL: the panel's dials are held inert]" : ""} — ` +
      `${LIVE_DIALS.length} dials driven through the real panel, judged on STAGE PIXELS` +
      `\n  noise floor: ${noise} px changed between two shots of the same state; a dial must move > ${FLOOR}\n`,
  )
  /* ── THE ROWS SPEAK THE REPO'S VOCABULARY NOW, AND THAT IS A REAL FIX ──────
   *
   * These rows used to print `live` / `DEAD`. Nothing in this repo reads that.
   * `run-battery.mjs` and `run-browser-battery.mjs` count rows with
   * `/^\s*(?:\*\*\* )?(?:PASS|FAIL)\b/gm`, and `assert-gate-integrity.mjs` finds
   * judgements with `EMIT_RE = /\bPASS\b|\bFAIL\b/`. So the four verdicts this
   * arm exists to produce were invisible to EVERY scoreboard in the tree: even
   * once `--live` was passed, the battery would have printed "4 rows" — the
   * model rows — and the meta-gate's channel A could not see this arm at all.
   *
   * A judgement nobody's reader can parse is a judgement nobody reads. The
   * detail is kept verbatim after the verdict token; only the prefix changed.
   *
   * UNDER THE CONTROL THE VERDICT INVERTS. With the dials held inert a DEAD row
   * is the CORRECT answer, so printing FAIL for it would file the control's
   * success as a failure and make the sweep red for working. */
  for (const r of live) {
    const moved = r.moved > FLOOR
    const ok = FREEZE ? !moved : moved
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${(FREEZE ? "CONTROL · " : "") + r.label.padEnd(18)} -> ${String(r.to).padEnd(6)} ` +
        `${moved ? "live" : "DEAD"}${FREEZE ? " (inert panel: DEAD is required)" : ""} ` +
        `at t=${r.peak.t.toFixed(2)}s (f${r.peak.frame} of ${r.peak.of}, the model's own peak for this dial)   ` +
        `${r.set.ok ? `${r.moved} px changed` : `SLIDER UNREACHABLE: ${r.set.why}`}` +
        `   panel readout ${r.set.ok ? `${r.set.readBefore} -> ${r.after}${r.tookInPanel ? "" : "  (DID NOT TAKE)"}` : "-"}`,
    )
  }
  if (errors.length) console.log(`  page errors: ${errors.join(" | ")}`)
  return { live, noise, FLOOR, errors }
}


/* ---- verdict --------------------------------------------------------------- */
const failed = claims.filter((c) => !c.pass)
const calibrated = aOk && bOk && cOk && dOk && eOk

/* ---- BOTH BROWSER ARMS, ON THE BARE INVOCATION ------------------------------
 *
 * The subject first, then its control. Two Chrome launches, stated in the output
 * so nobody has to guess what the runtime bought. */
let liveFailed = 0

const { live: driven, FLOOR } = await liveArm(false)
const drivenDead = driven.filter((r) => r.moved <= FLOOR)
liveFailed = drivenDead.length
console.log(
  `\n${driven.length - drivenDead.length}/${driven.length} dials driven through the REAL PANEL moved the REAL RENDER.`,
)

/* INVERTED VERDICT — THE CONTROL. With the panel's dials held inert every live
 * row MUST come back dead; a green here would mean the arm is measuring
 * something other than the panel driving the render, which is the whole thing it
 * exists to measure.
 *
 * It runs every time. This file printed **37/37 SOUND** while a lane had
 * genuinely frozen this panel's memo deps — the model sweep cannot see a frozen
 * panel, and the arm that can is only worth anything if it has been shown to
 * fire. */
const { live: frozen, FLOOR: frozenFloor } = await liveArm(true)
const frozenAlive = frozen.filter((r) => r.moved > frozenFloor)
let controlFailed = 0
if (frozenAlive.length === 0) {
  console.log(
    `\nPASS  CONTROL · all ${frozen.length} live rows went DEAD with the panel's dials held inert, as ` +
      `required. The live arm can see a frozen panel — which the model sweep above cannot, and did not.`,
  )
} else {
  controlFailed = frozenAlive.length
  console.log(
    `\nFAIL  CONTROL · FAILED TO FAIL. ${frozenAlive.length} row(s) still reported the render moving ` +
      `while the panel's dials were held inert, so the live arm's green means nothing.`,
  )
}

console.log(`\n${claims.length - failed.length}/${claims.length} model rows hold.`)
/* THE CLAIM, STATED — and this block is load-bearing, not a disclaimer. It used
 * to be the `!LIVE` branch, printing "MODEL ONLY — this run opened no browser"
 * under a green exit code that every sweep in the repo recorded as a pass. The
 * gate was honest in its log and silent in the scoreboard; only one of those is
 * read. Now the browser arm always runs, so the note says what the run covered
 * instead of what it did not. */
console.log(
  `\nTHE MODEL SWEEP says every parameter in the TABLE reaches a channel in the MAP.\n` +
    `THE LIVE ARM says the real panel drives the real render, and its CONTROL says the\n` +
    `live arm can tell the difference. All three ran on this bare invocation — the model\n` +
    `claim alone is NOT evidence the panel works, and used to be all a sweep ever got.`,
)
/* `controlFailed` IS IN THE EXIT NOW. A control that fails is not a footnote:
 * it says the live arm's greens are unearned, which is worse news than a red
 * dial. It used to be exit-coupled only on the `--live --freeze` invocation,
 * i.e. only when someone typed a flag no sweep typed. */
const notSound = failed.length || !calibrated || liveFailed || controlFailed
console.log(notSound ? "\nNOT SOUND" : "\nSOUND")
process.exit(notSound ? 1 : 0)

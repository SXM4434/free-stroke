// THE OPTION SET, ASSERTED — the parked cameras and the three new films.
//
// Sebs, after a board that described seven animations and built none of them:
// *"none of the weird camera angles are fixed. where tf are the toggles i had
// for the different type of animations — remember i asked to come up with some
// of ur own as well"*. This gate judges what was built off that: the three
// parked camera laws of `docs/hero-animation-options-board.md` §2, and the
// three films of §4 that this repo's renderer can actually perform.
//
// IT RUNS ON THE MODEL, NOT ON PIXELS, AND THAT IS DELIBERATE. Every claim here
// is a property of the choreography — where the camera is, whether it moves,
// where a turn lands, how long a frame is empty. Pixels are the other gates'
// job (`assert-hero-transition.mjs` judges a real capture; `assert-hero-k7-news`
// judges the breaks). This one runs in milliseconds so the numbers that decide
// whether an option IS an option can be checked on every edit.
//
// ── THE CONTROLS ARE THE POINT ──────────────────────────────────────────────
// Twelve instruments in this repo have been caught reporting green while
// measuring nothing, one of them passing on a beat with no turn in it because
// its claim was vacuously true. So every discriminating row below names a
// specific known-bad arm and is REQUIRED to fail on it — and the rows that
// cannot discriminate are printed as SHAPE rows and are not counted as
// discrimination. The controls are not "the defaults": they are constructed
// wrong on purpose, one per claim, in the exact way that claim is about.
//
// Usage: node scripts/verify/assert-hero-options.mjs [--verbose]
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { loadTs, ROOT } from "./_ts-load.mjs"
import { layoutWord } from "../capture/letters.mjs"
import { rawHeroStrokes, processedHeroStrokes, HERO_INK_WIDTH_PX } from "./_hero-word.mjs"

const M = loadTs("lib/hero-motion.ts")
const LETTERS = loadTs("lib/hero-letters.ts")
const {
  DEFAULT_HERO_MOTION,
  HERO_SHEETS,
  HERO_PHASES,
  sampleHeroMotion,
  phaseOffsets,
  totalDuration,
  cutSeparationDeg,
  cascadeClipSec,
} = M

const VERBOSE = process.argv.includes("--verbose")
const DEG = 180 / Math.PI

/* ---- arms ------------------------------------------------------------------
 * A film is a LAW plus an EXPOSURE SHEET, and the panel writes both when a pill
 * is clicked. So an arm here is both, or the gate would be judging four films
 * on one film's timing — which is exactly the half-wired shape the build was
 * told not to ship. */
const FILM_CAMERA = {
  shipped: "prior",
  turnLands: "deadOn",
  solidFirst: "deadOn",
  cutaway: "desk",
  /* O2. Bound to the desk ¾ from frame 0 — a hinge viewed dead-on is a mark
   * getting shorter, and gravity may not be retconned mid-film. */
  popUp: "desk",
  /* Same binding, and it keeps the desk through the turn so the rotation is
   * unambiguously the object's. */
  standTurn: "desk",
  /* O5. Dead-on, because at C-A the only oblique thing in the frame is the
   * LETTERS — and because K1 and K7 are the same picture there, which is what
   * makes the closing frame an identity claim rather than a resemblance. */
  letterByLetter: "deadOn",
}

function arm(shape, over = {}) {
  return {
    ...DEFAULT_HERO_MOTION,
    ...over,
    shape,
    camera: over.camera ?? FILM_CAMERA[shape],
    beats: { ...HERO_SHEETS[shape], ...(over.beats ?? {}) },
  }
}

/** How many per-letter slots the flattened rows carry. Matches `FS_LETTER_MAX`. */
const LMAX = 16
/** The four channels each letter carries, in `LetterState`'s own order. */
const LCH = ["yaw", "flat", "depth", "shade"]

/**
 * Every output frame of a beat, at that beat's own rate — with the per-letter
 * channels FLATTENED into scalar keys.
 *
 * ⚠ THE FLATTENING IS NOT TIDINESS, IT IS THE SAME OMISSION `pitch` ALREADY
 * TAUGHT THIS FILE. `same()` compares values with `===`, so an array property
 * would compare two different arrays as unequal on every frame and two
 * IDENTICAL cascades as unequal too — and, worse, `sampleHeroMotion` returns
 * `undefined` for it on the six films that have no letters, so `undefined ===
 * undefined` would make a film whose only difference is its cascade compare
 * IDENTICAL to a film that has none. Expanding to `L0yaw … L15shade` puts every
 * channel a frame actually has into the one list every row reads.
 */
function series(P) {
  const n = Math.round(totalDuration(P) * P.fps)
  const rows = []
  for (let i = 0; i <= n; i++) {
    const s = sampleHeroMotion(P, i / P.fps)
    if (s.letters) {
      const row = { ...s }
      for (let l = 0; l < LMAX; l++) {
        const st = s.letters[l]
        for (const c of LCH) row[`L${l}${c}`] = st ? st[c] : null
      }
      rows.push(row)
    } else rows.push(s)
  }
  return rows
}

/** The last frame before the return on which any letter's yaw changes. */
function lastFlipFrame(P) {
  const r = series(P)
  const ret = Math.round(phaseOffsets(P).returnTurn * P.fps)
  let last = 0
  for (let l = 0; l < Math.min(P.letterCount, LMAX); l++) {
    for (let i = 1; i < ret && i < r.length; i++) {
      if (r[i][`L${l}yaw`] !== r[i - 1][`L${l}yaw`]) last = Math.max(last, i)
    }
  }
  return last
}

/**
 * DOES `page.tsx` TAKE THE CASCADE'S CLIP FROM THE ONE PLACE IT IS DECIDED?
 *
 * A text predicate, because the page cannot be imported here, and it names the
 * ARGUMENT, not just the call. `/cascadeClipSec\(/` was the first attempt and it
 * was measured green against a planted `cascadeClipSec(DEFAULT_HERO_MOTION)` —
 * the derivation restored to the sheet's own seed, which is the defect with the
 * fix's name on it. The live params are the whole claim, so the needle is the
 * live params. It is exact on purpose, the same bargain `_hero-word.mjs` makes:
 * rename the variable and this goes red, and the answer is to update the mirror,
 * never to loosen the measurement.
 *
 * Taken as a function so the control below can run it on a source with the write
 * removed and watch it say no — a grep that matches whatever it is handed is the
 * "check that cannot fail" this file exists to keep out.
 */
function pageRelaysClip(src) {
  return src.includes("cascadeClipSec") && /emerge:\s*cascadeClipSec\(p\)/.test(src)
}

/** The channels a frame is made of, for identity and for movement. */
/* ⚠ `pitch` IS IN THIS LIST AND HAS TO BE. It is O2's only event, so a film
 * that differed from another by nothing but its hinge would compare IDENTICAL
 * on a list that omitted it — the "green row that cannot fail" class this gate's
 * header is about, reintroduced by an omission rather than by a bad claim.
 *
 * The `L…` keys are O5's, for exactly the same reason: its whole-word channels
 * are PARKED by design, so a cascade compared on the word's channels alone is a
 * film with no motion in it at all. See `series`. */
const FORM = [
  "reveal", "flat", "depth", "yaw", "pitch", "shade", "shadow", "jointBreak", "penCarve", "squashX", "squashY",
  ...Array.from({ length: LMAX }, (_, l) => LCH.map((c) => `L${l}${c}`)).flat(),
]
const CAM = ["az", "el", "fill"]
const same = (a, b, keys) => keys.every((k) => a[k] === b[k])

/** Largest single-frame step in a channel, and how many frames carry any step. */
function steps(rows, keys) {
  let max = 0
  let moved = 0
  for (let i = 1; i < rows.length; i++) {
    let d = 0
    for (const k of keys) d = Math.max(d, Math.abs(rows[i][k] - rows[i - 1][k]))
    if (d > 0) moved++
    max = Math.max(max, d)
  }
  return { max, moved }
}

/** Total path length travelled by a set of channels, summed frame to frame. */
function travel(rows, keys) {
  let t = 0
  for (let i = 1; i < rows.length; i++) for (const k of keys) t += Math.abs(rows[i][k] - rows[i - 1][k])
  return t
}

/** The longest run of frames that are identical in every rendered channel. */
function longestStill(rows, fps) {
  let best = 0
  let run = 1
  for (let i = 1; i < rows.length; i++) {
    if (same(rows[i], rows[i - 1], [...FORM, ...CAM])) run++
    else {
      best = Math.max(best, run)
      run = 1
    }
  }
  best = Math.max(best, run)
  // n frames of an identical state span (n - 1) intervals of held time.
  return (best - 1) / fps
}

/**
 * Where 50 % of a channel's total change has happened, as a fraction of the
 * window it happened in — `reference-film-mechanics.md` §6.5's `value-half`.
 * Below 37 % is the ARRIVAL band; 79–93 % is the WIND-UP band; 42–58 % is the
 * crossfade dead band and is what a linear move measures.
 */
function valueHalf(vals) {
  const a = vals[0]
  const b = vals[vals.length - 1]
  if (a === b) return null
  const half = a + (b - a) / 2
  for (let i = 1; i < vals.length; i++) {
    const p = vals[i - 1]
    const q = vals[i]
    if ((p - half) * (q - half) <= 0 && p !== q) {
      return (i - 1 + (half - p) / (q - p)) / (vals.length - 1)
    }
  }
  return null
}

/* ---- the claims ------------------------------------------------------------ */
const rows = []
const add = (name, pass, detail, kind = "hard") => rows.push({ name, pass, detail, kind })

const deadOn = arm("turnLands")
const desk = arm("cutaway")
const cut = arm("turnLands", { camera: "cut" })
const shipped = arm("shipped")

/* 1 · A PARKED CAMERA DOES NOT MOVE. Not "moves little" — the reference set's
 *     own number is 0 px of drift in 114 s, so the bar is exact equality. */
{
  const a = steps(series(deadOn), CAM)
  const b = steps(series(desk), CAM)
  add(
    "a parked camera does not move — at all, on any frame",
    a.max === 0 && b.max === 0,
    `dead-on: ${a.moved} frames carry camera motion, largest step ${a.max}; ` +
      `desk 3/4: ${b.moved} frames, largest step ${b.max}`,
  )
}

/* 2 · C-C IS TWO CUTS AND NOTHING ELSE. A cut is a one-frame change to the full
 *     separation; a glide is many small ones. The distinction has to be
 *     measured or "one authored cut" is just a description. */
let cutFrames = []
{
  const r = series(cut)
  for (let i = 1; i < r.length; i++) if (!same(r[i], r[i - 1], CAM)) cutFrames.push(i)
  const az = cut.deskAz
  const el = cut.deskEl
  const full = cutFrames.every((i) => {
    const d = Math.hypot(r[i].az - r[i - 1].az, r[i].el - r[i - 1].el)
    return Math.abs(d - Math.hypot(az, el)) < 1e-9
  })
  add(
    "the one-cut camera is TWO CUTS and no glide — each lands the whole framing in one frame",
    cutFrames.length === 2 && full,
    `${cutFrames.length} camera changes at frames ${cutFrames.join(", ")}; ` +
      `each moves the full ${Math.hypot(az, el).toFixed(1)} of dial travel in a single frame: ${full}`,
  )
}

/* 3 · AND EACH CUT LANDS ON STILLNESS. `reference-film-mechanics.md` §2.2 —
 *     cuts are preceded by a hold and land on stillness; the reveal cut leaves
 *     a 4.29 s frozen frame. So the MARK must be identical across the cut. */
{
  const r = series(cut)
  const still = cutFrames.every((i) => same(r[i], r[i - 1], FORM))
  add(
    "each cut lands on stillness — the mark is identical on the frames either side",
    cutFrames.length > 0 && still,
    cutFrames
      .map((i) => `f${i}: mark ${same(r[i], r[i - 1], FORM) ? "frozen" : "MOVING"}`)
      .join(" · "),
  )
}

/* 4 · THE 30-DEGREE RULE. Two framings closer than 30 deg apart make a jump,
 *     not a cut (`storyboarding.md` §4). Computed off the two dials as a real
 *     angle between view directions, because subtracting azimuths would have
 *     said 20 and passed a jump. */
{
  const sep = cutSeparationDeg(DEFAULT_HERO_MOTION)
  add(
    "the two framings clear the 30-degree rule",
    sep >= 30,
    `${sep.toFixed(2)} deg between dead-on and the desk 3/4 (needs >= 30)`,
  )
}

/* 5 · THE PUSH IS CUT. */
{
  const bad = [deadOn, desk, cut].filter((P) => steps(series(P), ["fill"]).max !== 0)
  add(
    "the push is gone — one framing size, opening frame to closing frame",
    bad.length === 0,
    bad.length === 0
      ? "fill is constant on all three parked laws, so K1 and K7 are the same size"
      : `${bad.length} parked law(s) still push`,
  )
}

/* 6 · THE ROOT DIAGNOSIS, AS A NUMBER. The board's sentence is *"the camera
 *     performs the product's verb while the mark never moves"*. Inverted: every
 *     degree of angular change in the film has to belong to the object. */
{
  const camTravel = travel(series(deadOn), ["az", "el"])
  const markTravel = travel(series(deadOn), ["yaw"]) * DEG
  add(
    "the camera watches and the mark performs — every degree of the film belongs to the object",
    camTravel === 0 && markTravel > 0,
    `camera travels ${camTravel.toFixed(2)} deg; the mark travels ${markTravel.toFixed(1)} deg`,
  )
}

/* 7 · EVERY FILM IS A DIFFERENT FILM. A pill that renders what another pill
 *     renders is not an option. */
{
  const names = ["shipped", "turnLands", "solidFirst", "cutaway", "popUp", "standTurn", "letterByLetter"]
  const S = Object.fromEntries(names.map((n) => [n, series(arm(n))]))
  const clashes = []
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = S[names[i]]
      const b = S[names[j]]
      const n = Math.min(a.length, b.length)
      let differs = a.length !== b.length
      for (let k = 0; k < n && !differs; k++) if (!same(a[k], b[k], [...FORM, ...CAM])) differs = true
      if (!differs) clashes.push(`${names[i]}=${names[j]}`)
    }
  }
  const pairs = (names.length * (names.length - 1)) / 2
  add(
    `the ${names.length} films are ${names.length} different films`,
    clashes.length === 0,
    clashes.length === 0
      ? `all ${pairs} pairs differ; lengths ${names.map((n) => `${n} ${totalDuration(arm(n)).toFixed(2)}s`).join(" · ")}`
      : `IDENTICAL: ${clashes.join(", ")}`,
  )
}

/* 7b · O2 · THE HINGE IS THE FILM. Three claims, because three different ways
 *      of getting this wrong all still produce a moving mark:
 *
 *      it TRAVELS      — a hinge that never leaves the page is the dead-dial
 *                        class; this beat has shipped one three times.
 *      it HOLDS        — dead still through `solid`, the money frame. A hinge
 *                        that keeps creeping through the payoff is the "it just
 *                        dollies side to side" read the board is a reaction to.
 *      it RETURNS      — back to flat, or the film cannot end where it began
 *                        and the identity claim is not made.
 *
 *      And the camera must not move a pixel through any of it, or the stand
 *      belongs to the viewpoint. */
{
  const P = arm("popUp")
  const r = series(P)
  const off = phaseOffsets(P)
  const pit = r.map((x) => x.pitch ?? 0)
  const at = (tSec) => pit[Math.min(pit.length - 1, Math.max(0, Math.round(tSec * P.fps)))]
  /* ⚠ TRAVEL, NOT ABSOLUTE ANGLE — and the first version of these rows got that
   * wrong in a way the model could not see. This film RESTS lying down at -90°
   * and stands toward upright, so "peak pitch" and "ends at zero" are both
   * meaningless here; a row written against them passes on a mark that starts
   * upright and tips over, which is exactly the defect the render caught. See
   * `pitchAt`. */
  const lie = pit[0]
  const standTravel = Math.max(...pit) - Math.min(...pit)

  add(
    "the pop-up starts lying on the desk, not standing",
    Math.abs(lie + Math.PI / 2) < 1e-9,
    `rest pitch ${((lie * 180) / Math.PI).toFixed(1)} deg — face-up on the page`,
  )

  add(
    "the pop-up's hinge actually travels",
    standTravel > 0.5,
    `${((standTravel * 180) / Math.PI).toFixed(1)} deg of stand (dial ${P.popStandDeg}), ` +
      `${((lie * 180) / Math.PI).toFixed(0)} deg -> ${((Math.max(...pit) * 180) / Math.PI).toFixed(0)} deg`,
  )

  // Sampled INSIDE the hold, clear of both boundaries, so a phase-edge
  // quantisation step cannot be mistaken for a creep.
  {
    const a = off.solid + 0.2
    const b = off.solid + P.beats.solid - 0.2
    let maxStep = 0
    for (let t = a; t <= b; t += 1 / P.fps) maxStep = Math.max(maxStep, Math.abs(at(t) - at(a)))
    add(
      "the pop-up holds dead still while it is standing",
      maxStep === 0,
      `${((maxStep * 180) / Math.PI).toFixed(4)} deg of drift across the ${P.beats.solid.toFixed(2)}s hold`,
    )
  }

  add(
    "the pop-up lies back down — the film ends where it began",
    Math.abs(pit[pit.length - 1] - lie) < 1e-9,
    `final pitch ${((pit[pit.length - 1] * 180) / Math.PI).toFixed(4)} deg against a rest of ${((lie * 180) / Math.PI).toFixed(1)}`,
  )

  /* THE HINGE IS THE ONLY CONVERSION. Filmed proof that this row is needed:
   * before it, the stand and the shipped yaw turn both ran during `emerge` and
   * the word collapsed to a sliver mid-stand. A film may make one claim per
   * shot. */
  {
    const turned = r.filter((x) => Math.abs(x.yaw) > 1e-9).length
    const shippedTurns = series(shipped).filter((x) => Math.abs(x.yaw) > 1e-9).length
    add(
      "the pop-up converts on the hinge alone — it never turns",
      turned === 0,
      `${turned} of ${r.length} frames carry a yaw; the shipped film turns on ${shippedTurns}`,
    )
  }

  /* 7c · STAND & TURN · THE TWO EVENTS ARE SEQUENTIAL, WITH A HOLD BETWEEN.
   *      This is the whole claim of the film and it is the one the pop-up's
   *      first cut got wrong, so it is asserted rather than described: the
   *      hinge finishes before the yaw starts, and there is dead stillness in
   *      between. A film that ran them together would still stand and still
   *      turn — every other row here would pass — which is exactly why this
   *      row has to exist. */
  {
    const Q = arm("standTurn")
    const rq = series(Q)
    const offq = phaseOffsets(Q)
    const qp = rq.map((x) => x.pitch ?? 0)
    const qy = rq.map((x) => x.yaw)

    const hingeFrames = []
    const yawFrames = []
    for (let i = 1; i < rq.length; i++) {
      if (Math.abs(qp[i] - qp[i - 1]) > 1e-9) hingeFrames.push(i)
      if (Math.abs(qy[i] - qy[i - 1]) > 1e-9) yawFrames.push(i)
    }
    // The return brings both home together and is one gesture by design, so the
    // separation claim is about the OPENING half only.
    const retFrame = Math.round(offq.returnTurn * Q.fps)
    const hingeOpen = hingeFrames.filter((i) => i < retFrame)
    const yawOpen = yawFrames.filter((i) => i < retFrame)
    const lastHinge = Math.max(...hingeOpen)
    const firstYaw = Math.min(...yawOpen)
    const gapFrames = firstYaw - lastHinge - 1

    add(
      "stand & turn moves ONE channel at a time — the hinge finishes before the turn starts",
      hingeOpen.length > 0 && yawOpen.length > 0 && firstYaw > lastHinge,
      `hinge moves on frames ${lastHinge - hingeOpen.length + 1}-${lastHinge}, ` +
        `the turn on ${firstYaw}-${Math.max(...yawOpen)} — no frame carries both`,
    )
    add(
      "...and a real hold sits between them",
      gapFrames / Q.fps >= 1.0,
      `${(gapFrames / Q.fps).toFixed(2)}s of dead stillness between the stand and the turn (needs >= 1.0)`,
    )
    add(
      "stand & turn shows the body — it reaches a real 3/4, and the camera never moves to do it",
      Math.max(...qy) > 0.5 && steps(rq, CAM).max === 0,
      `object turns to ${((Math.max(...qy) * 180) / Math.PI).toFixed(1)} deg ` +
        `(silhouette to ${(Math.abs(Math.cos(Math.max(...qy))) * 100).toFixed(0)}% of full); camera travel ${travel(rq, ["az", "el"]).toFixed(2)} deg`,
    )
  }

  add(
    "the pop-up's camera never moves while the mark stands",
    steps(r, CAM).max === 0,
    `camera travel ${travel(r, ["az", "el"]).toFixed(2)} deg; mark hinge travel ${((standTravel * 180) / Math.PI).toFixed(1)} deg`,
  )
}

/* ---- 7c-ii · THE LETTER MAP ITSELF ------------------------------------------
 *
 * ⚠ THIS IS THE GATE THREE FILES ALREADY CITED AND NOBODY HAD WRITTEN.
 * `lib/hero-letters.ts:38`, `components/viewport-3d.tsx:2676` and `:5347` all
 * name `scripts/verify/assert-hero-letters.mjs` as the thing that checks the
 * letter law against the font's authored map. **There is no such file.** Three
 * citations to a measurement nobody made — DISPATCH §2.2 exactly: *"a citation
 * is not evidence, it is a claim that evidence exists."* The rows live here
 * rather than in a new file because the brief's own instruction is to extend
 * this gate rather than start a parallel one, and because the cascade's laws and
 * the map that lays them out belong under one `--verbose`.
 *
 * TWO WORDS, and the second one is the whole point. `"Desk Doodles"` in the font
 * has eleven authored letters and no two of them come within a nib, so it only
 * ever exercised the MERGE half of the law and had no opinion at all on the half
 * that has to DECLINE to merge. `"the quick brown fox jumps"` has 21 and does.
 */
{
  /** THE WORD `scripts/capture/logo-strokes.json` IS — Sebs's hand writing it,
   *  and the same string the font arm lays out, so the two arms cannot drift. */
  const HERO_WORD = "Desk Doodles"
  const laid = layoutWord(HERO_WORD, { x: 0, y: 0, size: 120, tracking: 12 })
  const kk = 1100 / laid.width
  const font = laid.polylines.map((pl) => ({ points: pl.map((p) => ({ x: p.x * kk, y: 400 + p.y * kk })) }))
  const long = layoutWord("the quick brown fox jumps", { x: 0, y: 0, size: 120, tracking: 12 })
  const lk = 1100 / long.width
  const longS = long.polylines.map((pl) => ({ points: pl.map((p) => ({ x: p.x * lk, y: 400 + p.y * lk })) }))
  /** `want` is index-parallel to the STROKES, so its length is a stroke count —
   *  the letter count is the separate number the layout returns. */
  const exact = (m, want, count) => m.count === count && m.of.every((v, i) => v === want[i])
  const run = (s, seed, frac) => LETTERS.assignLetters(s, HERO_INK_WIDTH_PX, seed, frac)

  {
    const f = run(font, laid.letterOf)
    const l = run(longS, long.letterOf)
    add(
      "the LETTER LAW reproduces both authored maps exactly — 11 and 21, not one word and a hope",
      exact(f, laid.letterOf, laid.letterCount) && exact(l, long.letterOf, long.letterCount),
      `"Desk Doodles" ${f.count}/${laid.letterCount}${exact(f, laid.letterOf, laid.letterCount) ? " EXACT" : " ✗"} · ` +
        `"the quick brown fox jumps" ${l.count}/${long.letterCount}${exact(l, long.letterOf, long.letterCount) ? " EXACT" : " ✗"} ` +
        `at reach ${LETTERS.LETTER_REACH_FRAC} nib`,
    )
  }

  /* THE MODEL'S DEFAULT IS THE WORD'S OWN ANSWER, not an integer somebody typed.
   *
   * `letterCount` shipped as 8 while the page rendered 6 — the constant was
   * measured on the raw trace and the page measured the same law on the
   * hand-feel-processed strokes, so the model gate and the screen disagreed
   * about how many beats the film had and every row above passed on a cascade
   * nobody could see. This row is the join: it runs the REAL law over the REAL
   * hero word through `_hero-word.mjs`, which greps `page.tsx` on import and
   * throws if the page's own settings have moved. */
  {
    const got = run(rawHeroStrokes())
    add(
      "...and the model's letterCount is that law's answer on the hero word, not a typed integer",
      got.count === DEFAULT_HERO_MOTION.letterCount,
      `the traced word measures ${got.count} pieces; DEFAULT_HERO_MOTION.letterCount is ` +
        `${DEFAULT_HERO_MOTION.letterCount}. It shipped as 8 against a page rendering 6.`,
    )
  }

  /* THE SILENT BEAT FALLS AT THE WORD GAP, AND WHERE THAT IS COMES FROM THE WORD.
   *
   * `letterGapAfter` MEASURES: it finds the widest gap between consecutive
   * pieces of ink. What it used to be measured against was the integer 2, typed
   * once and then left behind — N8's sub-nib stub filter stopped two taps
   * bridging the `s` to the `k`, the trace went from ten pieces to eleven, and
   * the gap moved to 3 while the literal stayed at 2. The row could not pass at
   * any model constant, and its own message printed 3 while naming a grouping
   * (`D · e · sk`) the ink had stopped having. Same defect as the 160-frame clip,
   * one file over: a measurement frozen into a literal and outlived by its input.
   *
   * So the expectation is derived from the word. The space in "Desk Doodles"
   * falls after the letters of "Desk", which `layoutWord` counts by the same
   * rule the letter map counts pieces by — a character that draws ink takes an
   * index. One piece per letter puts the silence after piece `head - 1`. Each
   * MERGE before the gap pulls it one earlier, and nothing here can say which
   * side of the space a merge fell on, so the window is `head-1-merges .. head-1`:
   * exact at today's eleven-pieces-for-eleven-letters, and a stated range rather
   * than a fresh literal if the ink ever merges again. A rest landing inside
   * "Doodles" is outside the window either way, which is what this row is for. */
  {
    const s = rawHeroStrokes()
    const map = run(s)
    const got = LETTERS.letterGapAfter(s, map)
    const head = layoutWord(HERO_WORD.slice(0, HERO_WORD.indexOf(" ")), { x: 0, y: 0, size: 120, tracking: 12 })
    const merges = Math.max(0, laid.letterCount - map.count)
    const hi = head.letterCount - 1
    const lo = hi - merges
    add(
      "...and the cascade's silent beat falls at the WORD GAP, after 'Desk'",
      got >= lo && got <= hi && got === DEFAULT_HERO_MOTION.letterSilentAfter,
      `word gap measured after piece ${got}; "${HERO_WORD}" puts its space after ` +
        `${head.letterCount} letters and the trace draws ${map.count} pieces for ` +
        `${laid.letterCount}, so ${merges} merge${merges === 1 ? "" : "s"} — the silence belongs on ` +
        `piece ${lo === hi ? `${hi}` : `${lo}-${hi}`}. letterSilentAfter is ` +
        `${DEFAULT_HERO_MOTION.letterSilentAfter}.`,
    )
  }
}

/* ---- 7d · O5 · LETTER BY LETTER --------------------------------------------
 *
 * FIVE claims, because five different ways of getting this wrong all still
 * produce eight letters that move:
 *
 *   it CASCADES   — a word that flips all at once is the whole-word beat with
 *                   extra machinery. The board's rule, learned the hard way by
 *                   the pop-up: one piece of news per shot, sequential.
 *   it FITS       — every flip finishes inside the cascade's own clip, or the
 *                   tail of the run happens during the money frame.
 *   it CONVERTS   — each letter goes in a drawing and comes out an object. A
 *                   cascade of already-solid letters turning is a different and
 *                   much weaker film.
 *   it SLIVERS    — each letter passes through its own EDGE at full thickness.
 *                   Board: *"the edge-on sliver of a letter is its stroke depth,
 *                   which does not shrink with letter width."* That is the whole
 *                   reason per-letter flips survive the head-on trap.
 *   it LANDS TURNED — *"a letter that lands head-on lands invisible."*
 *
 * And the WORD may not move through any of it, or the cascade is riding on a
 * whole-mark event and is not the thing being seen.
 */
let letterBeats = null
{
  const P = arm("letterByLetter")
  const r = series(P)
  const off = phaseOffsets(P)
  const n = Math.min(P.letterCount, LMAX)
  const retFrame = Math.round(off.returnTurn * P.fps)
  const emergeEnd = Math.round((off.emerge + P.beats.emerge) * P.fps)

  /** The frames on which letter `l`'s pose changes, before the return. */
  const movesOf = (l) => {
    const out = []
    for (let i = 1; i < retFrame && i < r.length; i++) {
      if (r[i][`L${l}yaw`] !== r[i - 1][`L${l}yaw`]) out.push(i)
    }
    return out
  }
  const windows = []
  for (let l = 0; l < n; l++) {
    const m = movesOf(l)
    windows.push(m.length ? { l, from: m[0], to: m[m.length - 1] } : null)
  }
  letterBeats = windows

  /* THE LANDINGS. His three calls, 2026-09-26: *"Letter by letter lands dead
   * on. Each letter turns on its own centre and lands facing front on its rest
   * box, one at a time, then the word turns as one."* That SUPERSEDES the
   * 30-degree landing these two rows used to grade, where each letter settled at
   * `letterLandYaw` in its own yaw and never moved again.
   *
   * So a letter's OWN window runs from its first yaw change to its LANDING: the
   * first frame after that on which its yaw is back at 0, facing front. Every
   * frame after the landing belongs to the word. A letter that never comes back
   * to 0 before the return has no landing and reads null here, and that is the
   * film on main at 9f6ba5363: every letter lands at 30 in its own yaw.
   *
   * `windows` above is untouched and still runs to each letter's LAST move, so
   * FITS and the step row keep reading the word's turn too. These two rows read
   * `landings`, and nothing else does. */
  const FRONT = 1e-9 // rad; the model writes an exact 0 at rest
  const landings = windows.map((w, l) => {
    if (!w) return null
    for (let i = w.from; i < retFrame && i < r.length; i++) {
      if (Math.abs(r[i][`L${l}yaw`]) <= FRONT) return { l, from: w.from, to: i }
    }
    return null
  })

  /* IT CASCADES. Two letters may share a beat — that is the board's own
   * doubling — so the test is not "no two letters move together" but "no two
   * BEATS overlap": windows that start on different frames may not intersect.
   * Graded on `landings` since his three calls, 2026-09-26, and with the other
   * half of that ruling: each landed letter holds dead on until the last one
   * lands, and from there every letter's yaw is the same number on the same
   * frame, which is the word turning as one. */
  {
    const live = landings.filter(Boolean)
    const unlanded = landings.map((w, l) => (w ? -1 : l)).filter((l) => l >= 0)
    const lastLand = live.reduce((m, w) => Math.max(m, w.to), 0)
    let drift = 0 // frames a landed letter moves before the last letter lands
    for (const w of live) {
      for (let i = w.to; i <= lastLand; i++) if (Math.abs(r[i][`L${w.l}yaw`]) > FRONT) drift++
    }
    let apart = 0 // frames after the last landing on which the letters disagree
    for (let i = lastLand; live.length && i < retFrame && i < r.length; i++) {
      const y0 = r[i][`L0yaw`].toFixed(9)
      for (let l = 1; l < n; l++) if (r[i][`L${l}yaw`].toFixed(9) !== y0) { apart++; break }
    }
    let overlaps = 0
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i]
        const b = live[j]
        if (a.from === b.from && a.to === b.to) continue // one beat, two letters
        if (a.from <= b.to && b.from <= a.to) overlaps++
      }
    }
    const starts = [...new Set(live.map((w) => w.from))].sort((a, b) => a - b)
    const stuckAt = unlanded.length
      ? ` NEVER LAND FACING FRONT: letter${unlanded.length > 1 ? "s" : ""} ${unlanded.join(", ")}, ` +
        `letter ${unlanded[0]} holds ${(r[retFrame - 1][`L${unlanded[0]}yaw`] * DEG).toFixed(3)} deg in its own yaw.`
      : ""
    add(
      "the cascade is a CASCADE: each letter lands facing front on its own beat, one at a time, " +
        "then the word turns as one (his three calls, 2026-09-26)",
      live.length === n && overlaps === 0 && starts.length > 1 && drift === 0 && apart === 0,
      `${live.length} of ${n} letters land at yaw 0, on ${starts.length} separate beats ` +
        `(frames ${starts.join(", ")}; landings ${live.map((w) => w.to).join(", ")}); ` +
        `${overlaps} pairs of beats overlap; ${drift} frames a landed letter moves before the last lands; ` +
        `${apart} frames after it where the letters' yaws differ.${stuckAt}`,
    )
  }

  /* IT FITS. */
  {
    const last = windows.filter(Boolean).reduce((m, w) => Math.max(m, w.to), 0)
    add(
      "...and every flip finishes inside the cascade's own clip",
      last > 0 && last <= emergeEnd,
      `the last letter stops moving on frame ${last}; the cascade clip ends at ${emergeEnd} ` +
        `(cascade law ${M.cascadeSec(P).toFixed(3)}s into a ${P.beats.emerge.toFixed(3)}s clip)`,
    )
  }

  /* ...AND IT FITS A WORD THE SHEET WAS NEVER MEASURED FOR, which is the half
   * the defaults could not exercise.
   *
   * `HERO_SHEETS.letterByLetter.emerge` seeds itself from `cascadeClipSec` on the
   * DEFAULTS, so it is the right length for "Desk Doodles" and for no other word.
   * The labs box relays the LAYOUT from the live word — `letterCount` comes off
   * the ink — and until tonight it left the BUDGET on the default's, so every
   * word with a different beat count ran its last flips past the clip and into
   * the payoff hold. `solid` keeps the twos the cascade is excluded from, so
   * those flips were sampled at 12 Hz while the rest of the word was drawn at 30.
   *
   * The arm is the page's own path, end to end: lay a typed word out, measure its
   * pieces and its word gap with the real letter law, and take the clip from the
   * same function the sheet takes it from. `FS_LETTER_MAX` is 16 and `series`
   * flattens 16 slots, so the word is one the gate can see all of. */
  {
    const TYPED = "Free Stroke Labs"
    const laid = layoutWord(TYPED, { x: 0, y: 0, size: 120, tracking: 12 })
    const k = 1100 / laid.width
    const ink = laid.polylines.map((pl) => ({ points: pl.map((q) => ({ x: q.x * k, y: 400 + q.y * k })) }))
    const map = LETTERS.assignLetters(ink, HERO_INK_WIDTH_PX, laid.letterOf)
    const live = { letterCount: map.count, letterSilentAfter: LETTERS.letterGapAfter(ink, map) }
    const W = arm("letterByLetter", { ...live, beats: { emerge: cascadeClipSec({ ...DEFAULT_HERO_MOTION, ...live }) } })
    const lastW = lastFlipFrame(W)
    const endW = Math.round((phaseOffsets(W).emerge + W.beats.emerge) * W.fps)
    add(
      "...and the clip follows a word the SHEET was never measured for",
      lastW > 0 && lastW <= endW,
      `"${TYPED}" measures ${map.count} pieces with its gap after ${live.letterSilentAfter}; the clip ` +
        `derives to ${Math.round(W.beats.emerge * W.fps)} fr where the sheet's own is ` +
        `${Math.round(HERO_SHEETS.letterByLetter.emerge * W.fps)} fr. Last flip on frame ${lastW}, clip ends ${endW}.`,
    )
  }

  /* ...AND THE PAGE ACTUALLY CALLS IT, because a derivation nothing reaches is a
   * comment. `app/desk-doodles/page.tsx` is a React module and `_ts-load` cannot
   * execute it — JSX and `next/*` — so this is the same mirror check
   * `_hero-word.mjs` runs on the page's process settings, and it is a MIRROR, not
   * a render: it proves the call is written, not that the frame came out right.
   * The render proof lives in `docs/verification/liveword-2026-08-28/`. */
  {
    const page = readFileSync(join(ROOT, "app/desk-doodles/page.tsx"), "utf8")
    add(
      "...and the labs box relays the CLIP as well as the layout",
      pageRelaysClip(page),
      pageRelaysClip(page)
        ? "page.tsx imports cascadeClipSec and writes it into the cascade film's emerge, so a typed " +
          "word retimes the clip on the same commit it retimes the layout"
        : "page.tsx no longer derives its emerge from cascadeClipSec — the labs box is back to laying " +
          "out a live word inside the default word's budget",
    )
  }

  /* IT CONVERTS. A drawing goes in, an object comes out — per letter. */
  {
    const bad = []
    for (let l = 0; l < n; l++) {
      const wasInk = r.some(
        (x, i) => i < retFrame && x[`L${l}flat`] === 1 && x[`L${l}depth`] === P.emerge.flatDepth,
      )
      const isSolid = r.some((x, i) => i < retFrame && x[`L${l}flat`] === 0 && x[`L${l}depth`] === 1)
      if (!wasInk || !isSolid) bad.push(`${l}${wasInk ? "" : " never ink"}${isSolid ? "" : " never solid"}`)
    }
    add(
      "...and every letter CONVERTS — it goes in a drawing and comes out an object",
      bad.length === 0,
      bad.length === 0
        ? `all ${n} letters are flat ink at depth ${P.emerge.flatDepth} before their beat and lit solid at depth 1 after it`
        : `NOT A CONVERSION: ${bad.join(" · ")}`,
    )
  }

  /* IT SLIVERS — ON EVERY LETTER, AND ON THE FRAME GRID RATHER THAN IN THE LAW.
   *
   * This row is the reason `letterEdgePinSec` exists. Built to the board's
   * literal instruction (no dwell on flips 2-11) the LAW passes through 90° on
   * every letter and the EXPOSURE does not: at 30 fps three of the eight
   * narrowest frames measured 0.33-0.36 of their own letter's width, decided by
   * where the grid happened to fall relative to that letter's beat. The option's
   * whole defence against §1.1 is that a letter's flip still slivers, so a row
   * that read the law instead of the exposure would have been green on a film
   * with three missing moments.
   *
   * Two clauses, because both have to hold: the pose is REACHED (exactly 90°,
   * on at least one sampled frame) and the letter is SOLID when it gets there
   * (depth 1 — the sliver is the thickness, so a thin sliver is nothing). */
  {
    const bad = []
    const widths = []
    for (let l = 0; l < n; l++) {
      let minW = 1
      let atEdge = 0
      let thin = false
      for (let i = 0; i < retFrame && i < r.length; i++) {
        const w = Math.abs(Math.cos(r[i][`L${l}yaw`]))
        if (w < minW) minW = w
        if (Math.abs(r[i][`L${l}yaw`] - Math.PI / 2) < 1e-9) {
          atEdge++
          if (r[i][`L${l}depth`] !== 1) thin = true
        }
      }
      widths.push(minW)
      if (atEdge === 0) bad.push(`${l} never lands on its edge (narrowest ${minW.toFixed(3)})`)
      else if (thin) bad.push(`${l} slivers at less than full depth`)
    }
    add(
      "...and every letter is SAMPLED at its own edge, at full thickness",
      bad.length === 0,
      bad.length === 0
        ? `narrowest sampled width per letter: ${widths.map((w) => w.toFixed(3)).join(", ")} — ` +
            `every one exactly 0 (dead edge-on) at depth 1. Without the one-frame pin three of them ` +
            `read 0.362, 0.334, 0.362, which is a third of a letter, not a sliver.`
        : bad.join(" · "),
    )
  }

  /* IT LANDS TURNED, AND THE WORD NEVER MOVES. */
  {
    const want = (Math.max(0, P.letterLandYaw) * Math.PI) / 180
    const settled = r[retFrame - 1]
    const landed = []
    for (let l = 0; l < n; l++) landed.push(Math.abs(settled[`L${l}yaw`] - want) < 1e-9)
    const wordTravel = travel(r, ["yaw"]) * DEG
    add(
      "the rank lands TURNED — every letter shows its side, and the WORD never turns to do it",
      want > 0 && landed.every(Boolean) && wordTravel === 0,
      `all ${n} letters settle at ${P.letterLandYaw} deg ` +
        `(on-screen width ${(Math.abs(Math.cos(want)) * 100).toFixed(1)}% of full); ` +
        `the word's own yaw travels ${wordTravel.toFixed(4)} deg across the whole film`,
    )
  }

  /* THE WHOLE-WORD CHANNELS ARE PARKED. If any of them moved, the conversion
   * would be a mark event with a cascade painted on top of it. */
  {
    const word = ["flat", "depth", "yaw", "shade"]
    const moved = word.filter((k) => {
      for (let i = 1; i < retFrame && i < r.length; i++) if (r[i][k] !== r[i - 1][k]) return true
      return false
    })
    add(
      "...because the word's own channels are PARKED — the letters are the only thing converting",
      moved.length === 0,
      moved.length === 0
        ? `flat, depth, yaw and shade are constant across all ${retFrame} frames before the return; the shipped film moves all four`
        : `THE WORD MOVES: ${moved.join(", ")}`,
    )
  }

  /* ---- 7d-ii · THE TWO ROWS SEBS'S EYE ADDED ------------------------------
   *
   * *"it flips so ugly and abrupt and feels like artifacting happens."* Two
   * different complaints, and each one is a number nothing above was reading.
   */

  /* EVERY QUICK FLIP IS DRAWN IDENTICALLY — the "artifacting" row.
   *
   * The cascade is ONE EVENT REPEATED. Every letter after the first runs the
   * same `letterFlip` for the same `letterQuickSec`, so every letter should be
   * DRAWN the same — same yaws, on the same offsets from its own beat. It was
   * not. At `letterBeatSec: 0.46` the interval is 13.8 frames, so each beat
   * started 0.8 of a frame later in the grid than the last and the 30 fps
   * exposure caught each flip at a different phase: four different pictures of
   * one event across eight letters (`letterBeatSec`'s note has the table). That
   * is a rhythm jittering, which is what "artifacting" describes and what no
   * amount of looking at a single flip can find.
   *
   * The test is exact equality of the sampled yaw sequence, letter to letter,
   * indexed from each letter's own beat — not a tolerance, because on the frame
   * grid these are the same arithmetic and any difference at all means the grid
   * is sliding underneath the cascade.
   *
   * Since his three calls, 2026-09-26, a flip runs from its beat to its LANDING
   * facing front (`landings`), not to the word's shared turn, and every quick
   * flip must have one. */
  {
    const quick = landings.map((w, l) => ({ w, l })).filter((x) => x.w && x.l > 0)
    const shapes = quick.map(({ w, l }) => {
      const out = []
      for (let i = w.from - 1; i <= w.to + 1 && i < r.length; i++) out.push(r[i][`L${l}yaw`].toFixed(9))
      return out.join(" ")
    })
    const distinct = [...new Set(shapes)]
    add(
      "...and every quick flip, beat to landing facing front, is DRAWN IDENTICALLY: one event, " +
        "not a jittering one (his three calls, 2026-09-26)",
      quick.length === n - 1 && quick.length > 1 && distinct.length === 1,
      quick.length < n - 1
        ? `${n - 1 - quick.length} of ${n - 1} quick flips NEVER LAND FACING FRONT before the return, ` +
            `so there is no ruled flip to draw identically`
        : distinct.length === 1
        ? `all ${quick.length} quick flips sample the same ${shapes[0].split(" ").length} yaws to 9 dp ` +
            `(lead ${(P.letterLeadSec * P.fps).toFixed(2)} fr · beat ${(P.letterBeatSec * P.fps).toFixed(2)} fr · ` +
            `flip ${(P.letterQuickSec * P.fps).toFixed(2)} fr — all whole frames, so the grid cannot slide)`
        : `${distinct.length} DIFFERENT PICTURES of one event across ${quick.length} letters`,
    )
  }

  /* NO FLIP OUTRUNS THE TURN IT IS A SCALED COPY OF — the "abrupt" row.
   *
   * Board §4 O5: *"each letter-flip is the BUILT turn, scaled to a letter."*
   * The built turn is in this same file and its largest single-frame yaw step is
   * 29.8°. A flip scaled in DURATION keeps that; a flip scaled by simply being
   * given fewer frames does not, and at 292 ms the letters were stepping 50.9°
   * — the same gesture drawn at 58 % of the angular resolution.
   *
   * The bar is the whole-word turn's own number plus 15 %, which is the width of
   * the band the frame grid can move it by; a flip inside that is the built turn
   * and a flip at 50.9° is a different, coarser event. */
  {
    const W = arm("standTurn")
    const rw = series(W)
    let wordStep = 0
    for (let i = 1; i < rw.length; i++) wordStep = Math.max(wordStep, Math.abs(rw[i].yaw - rw[i - 1].yaw) * DEG)
    let worst = 0
    let worstL = -1
    for (const w of windows) {
      if (!w) continue
      for (let i = w.from; i <= w.to && i < r.length; i++) {
        const d = Math.abs(r[i][`L${w.l}yaw`] - r[i - 1][`L${w.l}yaw`]) * DEG
        if (d > worst) {
          worst = d
          worstL = w.l
        }
      }
    }
    const bar = wordStep * 1.15
    add(
      "...and no flip outruns the whole-word turn it is a scaled copy of",
      worst > 0 && worst <= bar,
      `worst single-frame step ${worst.toFixed(1)}° (letter ${worstL}) against the built turn's ` +
        `${wordStep.toFixed(1)}° — bar ${bar.toFixed(1)}°. At the shipped 292 ms flip this read 50.9°.`,
    )
  }
}

/* 8 · O1 — THE TURN LANDS SOMEWHERE THAT SHOWS SOMETHING. §1.1 of the board:
 *     the head-on solid IS the drawing, to three decimals of half-width. A
 *     landing that shows side walls has to change the silhouette. */
{
  const r = series(deadOn)
  const settled = r[r.length - 1 - Math.round(deadOn.beats.hold * deadOn.fps) + 1]
  const held = r[Math.round((phaseOffsets(deadOn).orbit + 0.5) * deadOn.fps)]
  const want = Math.abs(Math.cos(deadOn.landYaw / DEG))
  const ok = Math.abs(held.sx - want) < 1e-9 && held.sx < 0.95
  add(
    "the landed pose shows the form's side — the silhouette really changes",
    ok,
    `settled on-screen width ${held.sx.toFixed(4)} of full (= cos ${deadOn.landYaw} deg), ` +
      `a ${((1 - held.sx) * 100).toFixed(1)}% silhouette change; the shipped landing is ` +
      `${series(shipped)[Math.round((phaseOffsets(shipped).orbit + 0.4) * shipped.fps)].sx.toFixed(4)}` +
      (settled ? "" : ""),
  )
}

/* 9 · AND THE LANDING DID NOT MOVE B1. The out-turn's 87 % wind-up breakdown is
 *     the one measured number the rebuild was told not to lose; the landing
 *     remaps the half AFTER the dwell and must leave the half before it alone. */
function outBreakdown(P) {
  const off = phaseOffsets(P)
  const dwell = P.emerge.dwellSec
  const turnSec = P.beats.emerge - dwell
  const half = turnSec / 2
  const N = 4000
  const vals = []
  for (let i = 0; i <= N; i++) vals.push(sampleHeroMotion(P, off.emerge + (half * i) / N).sx)
  for (let i = 1; i <= N; i++) {
    if ((vals[i - 1] - 0.5) * (vals[i] - 0.5) <= 0 && vals[i - 1] !== vals[i]) {
      return (i - 1 + (vals[i - 1] - 0.5) / (vals[i - 1] - vals[i])) / N
    }
  }
  return null
}
{
  // Read off the RAW law rather than the exposure so the twos grid cannot
  // quantise the two arms differently and make a real match look like a miss.
  const a = outBreakdown({ ...shipped, cadence: "ones" })
  const b = outBreakdown({ ...deadOn, cadence: "ones" })
  add(
    "the landing left B1 alone — the turn-out's wind-up breakdown is unmoved",
    a !== null && b !== null && Math.abs(a - b) < 1e-9 && b > 0.79 && b < 0.93,
    `turn-out half-width passing position: shipped ${(a * 100).toFixed(2)}% · lands ${(b * 100).toFixed(2)}% ` +
      `(the reference set's wind-up band is 79-93%)`,
  )
}

/* 10 · AND THE LANDING IS SPACED AS AN ARRIVAL. A shape row: the shipped turn's
 *      in-half is arrival-spaced too, so this cannot separate the two arms. It
 *      is printed with what a LINEAR landing of the same length would measure,
 *      which is the only thing that makes a band worth quoting. */
{
  const P = { ...deadOn, cadence: "ones" }
  const off = phaseOffsets(P)
  const dwell = P.emerge.dwellSec
  const turnSec = P.beats.emerge - dwell
  const half = turnSec / 2
  const start = off.emerge + half + dwell
  const N = 2000
  const vals = []
  for (let i = 0; i <= N; i++) vals.push(sampleHeroMotion(P, start + (half * i) / N).sx)
  const vh = valueHalf(vals)
  add(
    "the land is spaced as an ARRIVAL, not as a travel",
    vh !== null && vh >= 0.09 && vh <= 0.37,
    `half of the landing's width change is done at ${(vh * 100).toFixed(1)}% of it ` +
      `(arrival band 9-37%; a linear landing measures 50.0%, inside the crossfade dead band 42-58%)`,
    "shape",
  )
}

/* 11 · O4 — THE ARC RUNS BACKWARDS. */
{
  const r = series(arm("solidFirst"))
  const first = r[0]
  const last = r[r.length - 1]
  // Ruled 2026-10-02, call 1 of "Controller's calls on the hero beat's stale
  // checks" (docs/rulings/2026-09-26.md): the drawing comes back IDENTICAL, so
  // the last frame's junctions are fused. Was `last.jointBreak === 1`, "changed".
  add(
    "solid first opens on the object and ends on the identical drawing",
    first.flat === 0 && first.depth === 1 && last.flat === 1 && last.jointBreak === 0,
    `frame 0: flat ${first.flat} depth ${first.depth} yaw ${(first.yaw * DEG).toFixed(1)} deg · ` +
      `last frame: flat ${last.flat} depth ${last.depth.toFixed(3)} breaks ${last.jointBreak}`,
  )
}

/* 12 · AND IT HAS NO DRAW-IN. Its price, stated as a measurement rather than as
 *      a caveat: the hand is asserted by linework and pen order only. */
{
  const r = series(arm("solidFirst"))
  const distinct = [...new Set(r.map((s) => s.reveal))]
  const shp = [...new Set(series(shipped).map((s) => s.reveal))]
  add(
    "solid first has no draw-in — the word is there or it is not, never part-written",
    distinct.length === 2 && distinct.includes(0) && distinct.includes(1),
    `${distinct.length} distinct reveal values (${distinct.join(", ")}); the shipped film has ${shp.length}`,
  )
}

/* 13 · THE POP-IN IS AN ARRIVAL. EC's sheet pop-in measures a value-half of
 *      19.5 %; ours runs `easeOutStrong`, whose value-half is 12.9 %. */
function popHalf(P) {
  const r = series(P)
  const vals = r.map((s) => s.squashY)
  const i0 = vals.findIndex((v) => v !== 1)
  if (i0 < 0) return null
  let i1 = i0
  while (i1 + 1 < vals.length && vals[i1 + 1] !== 1) i1++
  // Include the frame that reaches 1 again, which is the end of the settle.
  return valueHalf(vals.slice(i0, Math.min(i1 + 2, vals.length)))
}
{
  const vh = popHalf({ ...arm("solidFirst"), cadence: "ones" })
  add(
    "the pop-in is spaced as an ARRIVAL — matter landing, not a scale being set",
    vh !== null && vh >= 0.09 && vh <= 0.37,
    vh === null
      ? "no pop-in on screen at all"
      : `half the settle is done at ${(vh * 100).toFixed(1)}% of it (arrival band 9-37%; EC's own sheet pop-in is 19.5%)`,
  )
}

/* 14 · O6 — THE TRANSFORM IS NEVER SHOWN. This is the whole option, so it is
 *      the one row that must be exact: no part-way state, no turn, ever. */
{
  const r = series(arm("cutaway"))
  const between = r.filter((s) => s.flat > 0 && s.flat < 1).length
  const turning = r.filter((s) => Math.abs(s.yaw) > 0).length
  const shp = series(shipped).filter((s) => Math.abs(s.yaw) > 0).length
  add(
    "the cutaway never shows the change — no half-state and no turn, on any frame",
    between === 0 && turning === 0,
    `${between} frames part-way between drawing and object, ${turning} frames of turn ` +
      `(the shipped film turns on ${shp})`,
  )
}

/* 15 · AND THE ABSENCE IS THE RIGHT LENGTH, AND IS A CUT AT BOTH ENDS. Under
 *      ~350 ms it is a glitch; over ~700 ms it is a stall. */
let absence = null
{
  const P = arm("cutaway")
  const r = series(P)
  const gaps = []
  let i = 0
  while (i < r.length) {
    if (r[i].reveal === 0) {
      const s = i
      while (i < r.length && r[i].reveal === 0) i++
      gaps.push({ from: s, to: i - 1 })
    } else i++
  }
  // The opening frames of any film are "before the ink exists" and are not an
  // absence; only a hole with drawn frames on BOTH sides counts.
  const holes = gaps.filter((g) => g.from > 0 && g.to < r.length - 1)
  absence = holes[0] ?? null
  const ms = absence ? ((absence.to - absence.from + 1) / P.fps) * 1000 : 0
  const cutIn = absence ? r[absence.from - 1].reveal === 1 : false
  const cutOut = absence ? r[absence.to + 1].reveal === 1 : false
  add(
    "the absence is a held breath, not a dropped frame — and it is a CUT at both ends",
    holes.length === 2 && ms >= 350 && ms <= 700 && cutIn && cutOut,
    `${holes.length} holes in the film; the first is ${ms.toFixed(0)} ms ` +
      `(band 350-700; EC empties its frame for 625 ms at a frame-to-frame difference of exactly 0.000), ` +
      `entered by a cut: ${cutIn}, left by a cut: ${cutOut}`,
  )
}

/* 16 · EVERY FILM HOLDS ITS PAYOFF INSIDE THE GENRE BAND. The single biggest
 *      difference between the reference set and our beat (`online` §7 row 2):
 *      *"Hold the finished form for 1.7-3.3 s, dead still."* */
{
  const held = ["turnLands", "solidFirst", "cutaway", "letterByLetter"].map((n) => {
    const P = arm(n)
    return { n, s: longestStill(series(P), P.fps) }
  })
  const sh = longestStill(series(shipped), shipped.fps)
  add(
    "every new film holds its payoff dead still for 1.7-3.3 s",
    held.every((h) => h.s >= 1.7 && h.s <= 3.3),
    `${held.map((h) => `${h.n} ${h.s.toFixed(2)}s`).join(" · ")}; the shipped film's longest still run is ${sh.toFixed(2)}s`,
  )
}

/* 17 · NAMES MATCH BEHAVIOUR — the new dials are inert where they should be and
 *      live where they should be. `landYaw` defaults to 38 and the shipped film
 *      still lands head-on; reading the dial unconditionally would have re-posed
 *      the default beat, which is the "improve a read in place" deletion. */
function movesUnder(P, path, probe) {
  const set = (o, p, v) => {
    const parts = p.split(".")
    const c = structuredClone(o)
    let x = c
    for (let i = 0; i < parts.length - 1; i++) x = x[parts[i]]
    x[parts[parts.length - 1]] = v
    return c
  }
  const a = series(P)
  const b = series(set(P, path, probe))
  if (a.length !== b.length) return true
  for (let i = 0; i < a.length; i++) if (!same(a[i], b[i], [...FORM, ...CAM])) return true
  return false
}
{
  const inert = ["shipped", "cutaway"].filter((n) => movesUnder(arm(n), "landYaw", 70))
  const live = ["turnLands", "solidFirst"].filter((n) => !movesUnder(arm(n), "landYaw", 70))
  add(
    "the landing dial is live where a film asks for it and inert where none does",
    inert.length === 0 && live.length === 0,
    inert.length || live.length
      ? `LEAKS INTO: ${inert.join(", ")} · DEAD ON: ${live.join(", ")}`
      : "moves turn-lands and solid-first; moves nothing on the shipped film or the cutaway",
  )
}

/* 17b · AND SO ARE O5's FOUR. Same claim, same shape, and it is the row that
 *       would have caught the dead-dial class this beat has shipped three
 *       times — a control on the panel that renders nothing. Every one of these
 *       is exposed as a slider while the cascade is the active film, so every
 *       one of them has to move it. */
{
  const probes = [
    ["letterLandYaw", 40],
    ["letterLeadSec", 1.2],
    ["letterBeatSec", 0.8],
    ["letterPairFrom", 1],
  ]
  const dead = probes.filter(([k, v]) => !movesUnder(arm("letterByLetter"), k, v)).map(([k]) => k)
  const leaks = []
  for (const [k, v] of probes) {
    for (const n of ["shipped", "turnLands", "solidFirst", "cutaway", "popUp", "standTurn"]) {
      if (movesUnder(arm(n), k, v)) leaks.push(`${k}->${n}`)
    }
  }
  add(
    "every one of the cascade's four panel dials moves the cascade, and none of them reaches another film",
    dead.length === 0 && leaks.length === 0,
    dead.length || leaks.length
      ? `${dead.length ? `DEAD: ${dead.join(", ")} ` : ""}${leaks.length ? `LEAKS: ${leaks.join(", ")}` : ""}`
      : `${probes.map(([k]) => k).join(", ")} all move letter-by-letter; 0 of ${probes.length * 6} film/dial pairs leak`,
  )
}

/* 18 · §0.7 — NOTHING WAS DELETED. Every phase survives in every sheet, and the
 *      shipped film is untouched by every parameter the option set added. */
{
  const missing = []
  for (const [name, sheet] of Object.entries(HERO_SHEETS)) {
    for (const ph of HERO_PHASES) if (!(sheet[ph] > 0)) missing.push(`${name}.${ph}`)
  }
  const leaks = [
    "landYaw", "popScale", "popSettleSec", "absenceSec", "openEmptySec", "deskAz", "deskEl",
    // O5's seven. `letterCount` is in here deliberately: it is the one that
    // would leak most quietly, because the page WRITES it from the live word on
    // every film. If it reached any other film, typing a word would retime a
    // beat that has no letters in it.
    "letterCount", "letterSilentAfter", "letterPairFrom", "letterLandYaw",
    "letterLeadSec", "letterBeatSec", "letterFlipSec", "letterQuickSec", "letterEdgePinSec",
  ].filter((k) => movesUnder(shipped, k, k === "popScale" ? 0.5 : 70))
  add(
    "nothing was deleted and nothing leaked — every phase survives every sheet, the shipped film is untouched",
    missing.length === 0 && leaks.length === 0,
    missing.length || leaks.length
      ? `${missing.length ? `PHASES DROPPED: ${missing.join(", ")} ` : ""}${leaks.length ? `LEAKED INTO THE SHIPPED FILM: ${leaks.join(", ")}` : ""}`
      : `${HERO_PHASES.length} phases present in all ${Object.keys(HERO_SHEETS).length} sheets; ` +
          `16 new parameters, 0 of them reach the shipped film`,
  )
}

/* ---- print ---------------------------------------------------------------- */
console.log(
  `THE OPTION SET — 3 parked cameras and 3 new films, judged off the sampler\n` +
    Object.keys(HERO_SHEETS)
      .map((n) => `  ${n.padEnd(11)} ${totalDuration(arm(n)).toFixed(2)}s  ${Math.round(totalDuration(arm(n)) * 30)} fr`)
      .join("\n") +
    "\n",
)
for (const r of rows) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.kind === "shape" ? "   [shape row]" : ""}`)
  console.log(`      ${r.detail}`)
}

/* ---- the controls ---------------------------------------------------------
 * One per discriminating claim, each constructed wrong in the way that claim is
 * about, each REQUIRED to fail. A row whose control comes back clean is a row
 * that is measuring nothing. */
console.log("\nCONTROLS — each is a known-bad arm and each MUST fail")
const controls = []
const ctl = (name, broken, why) => controls.push({ name, broken, why })

// (a) The shipped four-move camera, against claims 1, 5 and 6.
{
  const r = series(shipped)
  const s = steps(r, CAM)
  const camTravel = travel(r, ["az", "el"])
  ctl(
    "the shipped camera, against 'a parked camera does not move'",
    s.max !== 0 && camTravel > 0,
    `${s.moved} of ${r.length} frames carry camera motion, largest step ${s.max.toFixed(2)}, ` +
      `total camera travel ${camTravel.toFixed(0)} deg — while the mark stands still through all of it`,
  )
  ctl(
    "the shipped camera, against 'the push is gone'",
    steps(r, ["fill"]).max !== 0,
    `fill runs ${r[0].fill.toFixed(2)} -> ${Math.min(...r.map((x) => x.fill)).toFixed(2)}`,
  )
}

/* (a2) A POP-UP THAT NEVER STANDS, against 'the pop-up's hinge actually
 *      travels'. `popStandDeg: 0` is the exact defect the row is about — every
 *      other channel of the film still runs, so the beat still moves and still
 *      differs from its siblings. If the row could pass on this arm it would be
 *      measuring the film's existence rather than its hinge. */
{
  const dead = arm("popUp", { popStandDeg: 0 })
  const peak = Math.max(...series(dead).map((x) => x.pitch ?? 0))
  ctl(
    "a pop-up with a 0 deg stand, against 'the hinge actually travels'",
    !(peak > 0.5),
    `peak pitch ${((peak * 180) / Math.PI).toFixed(4)} deg — the mark never leaves the page`,
  )
}

/* (a3) STAND & TURN WITH THE TWO EVENTS OVERLAPPED, against 'one channel at a
 *      time'. Collapsing the standing hold to a single frame slides the turn
 *      up against the end of the stand — which is the pop-up's original defect
 *      reconstructed deliberately. The film still stands and still turns, so
 *      every other stand-&-turn row stays green on this arm; only the
 *      separation row may catch it, which is what makes it the right control. */
{
  const jam = arm("standTurn", { beats: { solid: 1 / 30 } })
  const rj = series(jam)
  const offj = phaseOffsets(jam)
  const jp = rj.map((x) => x.pitch ?? 0)
  const jy = rj.map((x) => x.yaw)
  const ret = Math.round(offj.returnTurn * jam.fps)
  let lastHinge = -1
  let firstYaw = Infinity
  for (let i = 1; i < ret; i++) {
    if (Math.abs(jp[i] - jp[i - 1]) > 1e-9) lastHinge = i
    if (Math.abs(jy[i] - jy[i - 1]) > 1e-9 && i < firstYaw) firstYaw = i
  }
  const gap = (firstYaw - lastHinge - 1) / jam.fps
  ctl(
    "stand & turn with its hold cut to one frame, against 'a real hold sits between them'",
    !(gap >= 1.0),
    `only ${gap.toFixed(2)}s between the stand and the turn — the two events run into each other`,
  )
}

/* (a4) O5 · FOUR ARMS, ONE PER CLAIM. Each is the cascade with exactly one
 *      thing wrong, and each is wrong in a way that leaves every OTHER O5 row
 *      green — which is the whole test of whether those rows measure anything.
 *      An arm that failed five rows at once would prove nothing about any of
 *      them. */
{
  const letterWindows = (P) => {
    const r = series(P)
    const off = phaseOffsets(P)
    const ret = Math.round(off.returnTurn * P.fps)
    const n = Math.min(P.letterCount, LMAX)
    const out = []
    for (let l = 0; l < n; l++) {
      const m = []
      for (let i = 1; i < ret && i < r.length; i++) {
        if (r[i][`L${l}yaw`] !== r[i - 1][`L${l}yaw`]) m.push(i)
      }
      out.push(m.length ? { l, from: m[0], to: m[m.length - 1] } : null)
    }
    return { r, out, ret, n, off }
  }

  /* THE WORD FLIPPING AT ONCE, against 'the cascade is a cascade'. Zero lead
   * and zero interval puts every beat on frame one. The film still converts,
   * still slivers, still lands turned and still holds — this is the whole-word
   * beat wearing the cascade's machinery, and only the separation row sees it. */
  {
    const jam = arm("letterByLetter", { letterLeadSec: 0, letterBeatSec: 0 })
    const { out } = letterWindows(jam)
    const live = out.filter(Boolean)
    const starts = [...new Set(live.map((w) => w.from))]
    ctl(
      "a cascade with no lead and no interval, against 'beats fire one at a time'",
      starts.length <= 1,
      `all ${live.length} letters start on frame ${starts.join("/")} — one beat for the whole word, ` +
        `which is the shipped film with extra machinery`,
    )
  }

  /* A CASCADE THAT OVERRUNS ITS CLIP, against 'every flip finishes inside it'.
   * The interval is dragged to 1.2s, which is a retime a person can do; the
   * last flips then happen during the rank hold, stealing the money frame. */
  {
    const over = arm("letterByLetter", { letterBeatSec: 1.2 })
    const { out, off } = letterWindows(over)
    const end = Math.round((off.emerge + over.beats.emerge) * over.fps)
    const last = out.filter(Boolean).reduce((m, w) => Math.max(m, w.to), 0)
    ctl(
      "a cascade retimed to a 1.2s beat, against 'every flip finishes inside the clip'",
      last > end,
      `the last flip runs to frame ${last} against a clip that ends at ${end} — ` +
        `${((last - end) / over.fps).toFixed(2)}s of cascade spilling into the payoff hold`,
    )
  }

  /* THE BOARD'S LITERAL INSTRUCTION, against 'every letter is sampled at its
   * own edge'. Flips 2-11 with no pin at all — which is what §4 O5 asks for in
   * words, and what this build shipped until the row above caught it. It is the
   * RIGHT control precisely because it is not a strawman: the film still
   * cascades, still converts, still lands turned and still holds its payoff, and
   * the law still passes through 90°. Only the exposure misses, on the letters
   * whose beat happens to fall between two frames — which is the whole-word
   * turn's own historical defect, one scale down (`sampleEmerge`: *"the beat
   * spent ZERO frames at the edge. The moment silently did not exist."*).
   *
   * ⚠ `letterEdgePinSec: 0` ALONE STOPPED BEING A CONTROL, and why it stopped is
   * the finding. The flip is now 12 frames and the interval 14, both whole
   * numbers, so `u` lands on exactly 0.5 on exactly one frame of every flip by
   * arithmetic — the pin is belt-and-braces rather than the only thing holding
   * the moment up. A control that has been repaired by the fix is not a control
   * any more; keeping it would be a green row that cannot fail, which is the
   * thing this file exists to refuse.
   *
   * So the control is the SHIPPED CONFIGURATION, whole: the board's literal
   * no-dwell AND the 292 ms flip it was written for. 292 ms is 8.75 frames, the
   * beat was 13.8, and off the grid the edge is reached only when the grid
   * cooperates. That is the historical defect exactly, and it still fails. */
  {
    const nopin = arm("letterByLetter", { letterEdgePinSec: 0, letterQuickSec: 0.2917, letterBeatSec: 0.46 })
    const { r, ret, n } = letterWindows(nopin)
    let missed = 0
    const worst = []
    for (let l = 0; l < n; l++) {
      let minW = 1
      let hit = false
      for (let i = 0; i < ret && i < r.length; i++) {
        minW = Math.min(minW, Math.abs(Math.cos(r[i][`L${l}yaw`])))
        if (Math.abs(r[i][`L${l}yaw`] - Math.PI / 2) < 1e-9) hit = true
      }
      if (!hit) {
        missed++
        worst.push(minW)
      }
    }
    ctl(
      "the board's literal 'no dwell on flips 2-11', against 'every letter is sampled at its own edge'",
      missed > 0,
      `${missed} of ${n} letters never land on their edge; their narrowest sampled widths are ` +
        `${worst.map((w) => w.toFixed(3)).join(", ")} of a letter — a third of the letter is not a sliver`,
    )
  }

  /* THE SHIPPED REACH, against 'both authored maps exactly'. 1.0 nib is not
   * "the ink touches", it is the ink GRAZES — the lens two nibs share at that
   * distance has width zero. On the eleven-letter word it happens to be right,
   * which is exactly why one word was not a calibration; on the 21-letter word
   * it loses eleven letters. */
  {
    const laid = layoutWord("the quick brown fox jumps", { x: 0, y: 0, size: 120, tracking: 12 })
    const k2 = 1100 / laid.width
    const s = laid.polylines.map((pl) => ({ points: pl.map((p) => ({ x: p.x * k2, y: 400 + p.y * k2 })) }))
    const got = LETTERS.assignLetters(s, HERO_INK_WIDTH_PX, laid.letterOf, 1.0)
    ctl(
      "the shipped 1.0-nib reach, against 'the letter law reproduces both authored maps'",
      got.count !== laid.letterCount,
      `${laid.letterCount} authored letters came back as ${got.count} — ` +
        `${laid.letterCount - got.count} of them swallowed by a neighbour they only grazed`,
    )
  }

  /* THE HAND-FEEL INK AS THE MAP'S SOURCE, against 'letterCount is the law's
   * answer on the hero word'. This is the film Sebs actually watched: the same
   * law, the same word, read off the ink AFTER the protrude pass has run every
   * stroke past its own end into its neighbour. */
  {
    const got = LETTERS.assignLetters(processedHeroStrokes(), HERO_INK_WIDTH_PX)
    ctl(
      "the map read off hand-feel-protruded ink, against 'letterCount is the word's own answer'",
      got.count !== DEFAULT_HERO_MOTION.letterCount,
      `${got.count} pieces instead of ${DEFAULT_HERO_MOTION.letterCount} — the protruded tails fuse ` +
        `letters into their neighbours, which is the "some go multiple at a time" Sebs reported`,
    )
  }

  /* THE SAME PROTRUDED INK, against 'the silent beat falls at the WORD GAP'.
   * The row used to be a comparison with the integer 2 and could not pass at any
   * model constant; it derives its expectation from the word now, so it needs an
   * arm that puts the rest in the WRONG PLACE rather than one that moves the
   * constant. This is that arm, and it is the film Sebs actually watched: the
   * protrude pass fuses letters, the word space shrinks relative to the letter
   * spaces, and the widest gap lands inside "Doodles". */
  {
    const s = processedHeroStrokes()
    const map = LETTERS.assignLetters(s, HERO_INK_WIDTH_PX)
    const got = LETTERS.letterGapAfter(s, map)
    const laidC = layoutWord("Desk Doodles", { x: 0, y: 0, size: 120, tracking: 12 }).letterCount
    const hi = layoutWord("Desk", { x: 0, y: 0, size: 120, tracking: 12 }).letterCount - 1
    const lo = hi - Math.max(0, laidC - map.count)
    ctl(
      "the map read off hand-feel-protruded ink, against 'the silent beat falls at the word gap'",
      !(got >= lo && got <= hi),
      `the rest lands after piece ${got} on ${map.count} pieces, where the word's own space allows ` +
        `${lo}-${hi} — a silent beat inside "Doodles"`,
    )
  }

  /* THE SHEET'S FROZEN CLIP ON A TYPED WORD, against 'the clip follows a word the
   * sheet was never measured for'. Same word, same layout, same letter law: only
   * the clip comes from `HERO_SHEETS` instead of from `cascadeClipSec` on the live
   * params. That is exactly what `page.tsx` did before tonight, and it is where
   * the overrun is spent — inside `solid`, which keeps its twos. */
  {
    const TYPED = "Free Stroke Labs"
    const laid = layoutWord(TYPED, { x: 0, y: 0, size: 120, tracking: 12 })
    const k = 1100 / laid.width
    const ink = laid.polylines.map((pl) => ({ points: pl.map((q) => ({ x: q.x * k, y: 400 + q.y * k })) }))
    const map = LETTERS.assignLetters(ink, HERO_INK_WIDTH_PX, laid.letterOf)
    const F = arm("letterByLetter", {
      letterCount: map.count,
      letterSilentAfter: LETTERS.letterGapAfter(ink, map),
    })
    const last = lastFlipFrame(F)
    const end = Math.round((phaseOffsets(F).emerge + F.beats.emerge) * F.fps)
    ctl(
      "the sheet's frozen clip on a typed word, against 'the clip follows the live word'",
      last > end,
      `"${TYPED}" flips until frame ${last} inside a clip that ends at ${end} — ${last - end} frames of ` +
        `cascade spent inside the payoff hold, sampled at the twos while the rest of the word is on ones`,
    )
  }

  /* THE PAGE WITH THE CALL TAKEN OUT, against 'the labs box relays the CLIP'.
   * A text predicate that matches whatever it is handed is a green light with no
   * bulb behind it, so the same function is run on the same file with the write
   * deleted and is required to say no. */
  {
    const page = readFileSync(join(ROOT, "app/desk-doodles/page.tsx"), "utf8")
    const stripped = page.replace(/emerge:\s*cascadeClipSec\(p\)/g, "emerge: beats.emerge")
    ctl(
      "page.tsx with the clip derivation deleted, against 'the labs box relays the CLIP'",
      pageRelaysClip(page) && !pageRelaysClip(stripped),
      `the predicate holds on the file as it stands and fails on the same file with ` +
        `\`emerge: cascadeClipSec(p)\` removed — ${page.length} bytes read`,
    )
  }

  /* THE SHIPPED 0.46 s BEAT, against 'every quick flip is drawn identically'.
   * 0.46 s is 13.8 frames. Nothing else about the film changes: it still
   * cascades, still converts, still slivers, still lands turned. Only the
   * sub-frame offset walks, and the same event comes out as several pictures. */
  {
    const P2 = arm("letterByLetter", { letterBeatSec: 0.46, beats: { emerge: 200 / 30 } })
    const { r: r2, ret: ret2, n: n2 } = letterWindows(P2)
    const shapes = []
    for (let l = 1; l < n2; l++) {
      const m = []
      for (let i = 1; i < ret2 && i < r2.length; i++) if (r2[i][`L${l}yaw`] !== r2[i - 1][`L${l}yaw`]) m.push(i)
      if (!m.length) continue
      const out = []
      for (let i = m[0] - 1; i <= m[m.length - 1] + 1 && i < r2.length; i++) out.push(r2[i][`L${l}yaw`].toFixed(9))
      shapes.push(out.join(" "))
    }
    const distinct = new Set(shapes).size
    ctl(
      "the shipped 0.46 s beat (13.8 frames), against 'every quick flip is drawn identically'",
      distinct > 1,
      `${distinct} different pictures of one event across ${shapes.length} letters — the interval is ` +
        `not a whole number of frames, so each beat is sampled 0.8 of a frame later than the last`,
    )
  }

  /* THE SHIPPED 292 ms FLIP, against 'no flip outruns the whole-word turn'.
   * A sound citation (the reference set's shorter transition) spent on the wrong
   * quantity: what it buys at 30 fps is 7.75 turn frames for 180°. */
  {
    const P2 = arm("letterByLetter", { letterQuickSec: 0.2917 })
    const { r: r2, ret: ret2, n: n2 } = letterWindows(P2)
    let worst = 0
    for (let l = 1; l < n2; l++)
      for (let i = 1; i < ret2 && i < r2.length; i++)
        worst = Math.max(worst, Math.abs(r2[i][`L${l}yaw`] - r2[i - 1][`L${l}yaw`]) * DEG)
    const W = arm("standTurn")
    const rw = series(W)
    let wordStep = 0
    for (let i = 1; i < rw.length; i++) wordStep = Math.max(wordStep, Math.abs(rw[i].yaw - rw[i - 1].yaw) * DEG)
    ctl(
      "the shipped 292 ms flip, against 'no flip outruns the whole-word turn'",
      worst > wordStep * 1.15,
      `worst single-frame step ${worst.toFixed(1)}° against the built turn's ${wordStep.toFixed(1)}° — ` +
        `the same gesture drawn at ${((wordStep / worst) * 100).toFixed(0)} % of the angular resolution`,
    )
  }

  /* A RANK THAT LANDS HEAD-ON, against 'the rank lands turned'. Board §1.1:
   * head-on the solid IS the drawing, to three decimals of half-width — so a
   * cascade that lands at 0 spends fourteen seconds arriving at the frame it
   * started from. It still cascades, still converts and still slivers. */
  {
    const flatLand = arm("letterByLetter", { letterLandYaw: 0 })
    const { r, ret, n } = letterWindows(flatLand)
    const settled = r[ret - 1]
    const turned = []
    for (let l = 0; l < n; l++) if (Math.abs(settled[`L${l}yaw`]) > 1e-9) turned.push(l)
    ctl(
      "a cascade landing head-on, against 'the rank lands turned'",
      turned.length === 0,
      `${turned.length} of ${n} letters end up turned — the rank lands at the same pose the ` +
        `drawing started at, which §1.1 measures as the same picture`,
    )
  }
}

// (b) A desk pose too close to dead-on, against the 30-degree rule.
{
  const near = { ...DEFAULT_HERO_MOTION, deskAz: 8, deskEl: 8 }
  const sep = cutSeparationDeg(near)
  ctl(
    "a desk pose 8/8 deg out, against the 30-degree rule",
    sep < 30,
    `${sep.toFixed(2)} deg — a jump, correctly rejected`,
  )
}

/* (c) A cut that lands on a MOVING mark, against 'each cut lands on stillness'.
 *
 * ⚠ THE FIRST VERSION OF THIS CONTROL CAME BACK CLEAN AND THE ROW ABOVE WAS
 * THEREFORE UNPROVEN. It shrank `land` and `solid` to one frame each, expecting
 * the cut point to walk back into the turn — and it cannot, because the cut is
 * authored at a PHASE BOUNDARY and `tilt` always begins after the whole emerge.
 * The retime moved the cut and left it on a settled mark, so the control
 * reported "0 of 2 cuts land on a moving mark" and called that a catch. A
 * control that cannot construct the defect is not a control.
 *
 * This one constructs it. The shadow is the one channel that can still be in
 * motion at the top of `tilt`: it starts `shadowLagSec` after `land` and runs
 * for `shadowSec`, so a retime that shortens `land` below its own landing —
 * exactly what dragging that clip in the dock does — leaves it ramping across
 * the cut. Same arm, same law, one retimed clip, and the mark is genuinely
 * moving when the camera cuts.
 */
{
  const P = arm("shipped", { camera: "cut", shadowLagSec: 0, shadowSec: 0.5 })
  P.beats = { ...P.beats, land: 1 / 30, solid: 1 / 30 }
  const r = series(P)
  const cf = []
  for (let i = 1; i < r.length; i++) if (!same(r[i], r[i - 1], CAM)) cf.push(i)
  const moving = cf.filter((i) => !same(r[i], r[i - 1], FORM))
  ctl(
    "a cut retimed onto a still-landing shadow, against 'each cut lands on stillness'",
    moving.length > 0,
    `${moving.length} of ${cf.length} cuts land on a moving mark — correctly caught` +
      (moving.length ? ` (shadow ${r[moving[0] - 1].shadow.toFixed(3)} -> ${r[moving[0]].shadow.toFixed(3)} across the cut)` : ""),
  )
}

// (c2) Solid first coming back CHANGED, against 'ends on the identical drawing'.
//      Ruled 2026-10-02, call 1 (docs/rulings/2026-09-26.md): the control is
//      "changed", and it must fail.
{
  const P = arm("solidFirst", { ret: { ...DEFAULT_HERO_MOTION.ret, mode: "changed" } })
  const r = series(P)
  const last = r[r.length - 1]
  ctl(
    "solid first with ret.mode 'changed', against 'ends on the identical drawing'",
    last.jointBreak !== 0,
    `last frame breaks ${last.jointBreak} (the identical drawing has 0)`,
  )
}

// (d) A film with no pop, against 'the pop-in is an arrival'.
{
  const vh = popHalf({ ...arm("solidFirst"), popScale: 1, cadence: "ones" })
  ctl(
    "a solid-first film with the pop removed, against 'the pop-in is an arrival'",
    vh === null,
    "nothing settles, so there is nothing to space — the row goes unmeasurable rather than silently true",
  )
}

// (e) An absence too short to be a breath.
{
  const P = arm("cutaway", { absenceSec: 3 / 30 })
  const r = series(P)
  let ms = 0
  for (let i = 1; i < r.length; i++) {
    if (r[i].reveal === 0 && r[i - 1].reveal === 1) {
      let j = i
      while (j < r.length && r[j].reveal === 0) j++
      ms = ((j - i) / P.fps) * 1000
      break
    }
  }
  ctl(
    "a 3-frame absence, against 'the absence is a held breath'",
    ms < 350,
    `${ms.toFixed(0)} ms — a jump cut between two near-identical framings, correctly rejected`,
  )
}

// (f) The shipped film, against 'holds its payoff 1.7-3.3 s'.
{
  const s = longestStill(series(shipped), shipped.fps)
  ctl(
    "the shipped film, against 'holds its payoff 1.7-3.3 s'",
    s < 1.7,
    `longest dead-still run ${s.toFixed(2)}s — below the genre band, correctly caught`,
  )
}

// (g) A landing applied to the OUT half as well, against 'B1 is unmoved'.
//     Simulated by asking for the breakdown of a turn whose out half is
//     compressed to the landing angle — the shape the naive implementation has.
{
  const P = { ...deadOn, cadence: "ones" }
  const off = phaseOffsets(P)
  const dwell = P.emerge.dwellSec
  const half = (P.beats.emerge - dwell) / 2
  const N = 4000
  // Read the out half through a linear yaw instead of the ported |cos| law.
  const vals = []
  for (let i = 0; i <= N; i++) vals.push(Math.abs(Math.cos((Math.PI / 2) * (i / N))))
  let naive = null
  for (let i = 1; i <= N; i++) {
    if ((vals[i - 1] - 0.5) * (vals[i] - 0.5) <= 0) {
      naive = (i - 1 + (vals[i - 1] - 0.5) / (vals[i - 1] - vals[i])) / N
      break
    }
  }
  const real = outBreakdown(P)
  ctl(
    "a turn whose out half runs linearly in yaw, against 'B1 is unmoved'",
    naive !== null && Math.abs(naive - real) > 0.1,
    `linear-yaw breakdown ${(naive * 100).toFixed(1)}% against the built ${(real * 100).toFixed(1)}% ` +
      `— 33 points apart, so the row can tell a wind-up from a travel`,
  )
  void off
  void half
}

for (const c of controls) {
  console.log(`  ${c.broken ? "caught, correctly" : "MISSED"}  ${c.name}`)
  console.log(`      ${c.why}`)
}

if (VERBOSE) {
  console.log("\n  exposure sheets, in frames at 30 fps")
  for (const [n, sheet] of Object.entries(HERO_SHEETS)) {
    console.log(`    ${n.padEnd(11)} ${HERO_PHASES.map((p) => `${p} ${Math.round(sheet[p] * 30)}`).join(" · ")}`)
  }
}

const hard = rows.filter((r) => r.kind === "hard")
const failed = rows.filter((r) => !r.pass)
const missed = controls.filter((c) => !c.broken)
console.log(
  `\n${rows.filter((r) => r.pass).length}/${rows.length} rows hold ` +
    `(${hard.length} discriminating, ${rows.length - hard.length} shape). ` +
    `${controls.length - missed.length}/${controls.length} controls correctly fail.`,
)
console.log(failed.length === 0 && missed.length === 0 ? "\nSOUND" : "\nNOT SOUND")
process.exit(failed.length === 0 && missed.length === 0 ? 0 : 1)

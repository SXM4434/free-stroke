// THE FRAME LEDGER — what the beat actually costs, against the budget it was
// given.
//
// `docs/hero-beat-storyboard.md` §10.3 closes its arithmetic at **270 frames /
// 9.00s** and prints the table so *"the cost is visible rather than asserted"*.
// This is that table, measured off the model rather than added up by hand, plus
// the two rows the board's own exposure sheet never had.
//
// THE TWO MISSING ROWS, STATED PLAINLY BECAUSE THEY ARE THE WHOLE OVERAGE. §7
// has K4 at el 0° and then K5 at *"el 65→10°"* with nothing in between that
// gets the camera to 65; and it has K6 at az 38° / el 10° and then the return
// turns "parked" at K1's framing with nothing in between that gets it back.
// Both moves have to exist for the shots either side of them to be the shots
// the board describes, and neither has a row. They are `tilt` (21 frames,
// inherited) and `descend` (13 frames, new). Everything else lands on the
// ledger.
//
// AND THE STILLNESS BAR IS C8's, NOT §5's. §10.2 C8: 61% is a whole-film number
// across 114 seconds and 22 cuts, and *"our beat is one continuous take with no
// cuts to hold between. The comparable unit is Exquisite Corpse's payoff unit"*
// — 4.5s of which 1.6s, **36%**, is a parked frame with nothing happening.
// *"36% is the bar."*
//
// NEGATIVE CONTROL: the whole prior beat — the durations, the ramp instead of
// the turn, the drift instead of the hold, no return, no landing, ones instead
// of twos. It is the beat the board was written against, and it has to fail
// every row here or none of this is measuring anything.
//
// Usage: node scripts/verify/assert-hero-ledger.mjs
import { loadTs } from "./_ts-load.mjs"

const { DEFAULT_HERO_MOTION, sampleHeroMotion, totalDuration, phaseOffsets, HERO_PHASES } =
  loadTs("lib/hero-motion.ts")

const KEYS = ["az", "el", "fill", "flat", "depth", "yaw", "shade", "shadow", "jointBreak", "reveal", "squashX", "squashY"]
const sig = (s) => KEYS.map((k) => s[k]).join("|")

/** §10.3's table, in frames. The two camera moves it has no row for are named
 *  separately below rather than folded in, so the overage cannot hide. */
const LEDGER = {
  // 140 frames = 4.667s. RE-CUT, and the re-cut is the point: 64 was the ledger
  // trimming the draw-in to buy stillness, over the objection §10.3 itself
  // records — *"the draw-in trim is the one line in that table I would not
  // defend hard. Handwriting is the product's other claim."* The trim is given
  // back and the stillness bar is still cleared, by one third of a frame. See
  // `beats.draw` in lib/hero-motion.ts for how 4.667s is derived rather than
  // picked, and for the three falsified numbers it replaces.
  draw: 140,
  breath: 33,
  anticipation: 9,
  emerge: 28,
  land: 9,
  solid: 18,
  // The ledger splits the rise into "rise 30" + "settle 12"; this model has one
  // phase whose own overshoot IS the settle, so the row is their sum.
  standup: 42,
  orbit: 28,
  returnTurn: 28,
  hold: 11,
}
const UNCOUNTED = ["tilt", "descend"]
/** The four shots §7 counts as HELD. */
const HOLD_SHOTS = ["breath", "solid", "orbit", "hold"]
/** §7's own number, written once, so the row below is not comparing a literal
 *  with itself — see the note on that row. */
const HELD_SHOT_COUNT = 4

/* ⚠ THE INVENTORY IS DERIVED-AGAINST NOW, AND THIS IS THE DEFECT THAT FORCED IT.
 *
 * DEFECT (class 4, a hand-written inventory nothing checks): `LEDGER` above is
 * ten phases typed by hand and `UNCOUNTED` is two, against a model whose
 * `HERO_PHASES` is twelve. Nothing compared the two lists. The only quantity
 * that would have noticed a THIRTEENTH phase was `allAccounted`, and
 * `allAccounted` went into `report` — printed, never scored — and appeared in no
 * `pass` field at all. So a new phase of any duration shipped unledgered while
 * this file printed 4/4 green, which is the exact shape §11's catalogue calls a
 * green row that cannot fail.
 *
 * Worse, the frame tolerance was `<= HERO_PHASES.length` — twelve frames, four
 * tenths of a second. That is not a rounding tolerance, it is a hole a whole
 * `land` beat (9 fr) or `hold` (11 fr) fits through. Real rounding is bounded by
 * half a frame per phase, because each phase's frame count is one `Math.round`.
 *
 * The repair: the ledger's own coverage is a SCORED row that compares the two
 * hand-written lists against `HERO_PHASES` as SETS, `allAccounted` joins the
 * exit condition, and the tolerance is the true rounding bound. A thirteenth
 * phase now fails on its NAME, before its duration is even looked at — which is
 * what makes it catchable at any duration, including zero. */
const HALF_FRAME = 0.5

function frames(P, phase) {
  return Math.round(P.beats[phase] * P.fps)
}

/** `phases` is a parameter so the calibration arm can hand in a thirteenth. */
function claims(P, phases = HERO_PHASES) {
  const fps = P.fps
  const off = phaseOffsets(P)
  const total = totalDuration(P)
  const totalFrames = Math.round(total * fps)

  // Every frame of the beat, so stillness is read off what renders.
  const all = []
  for (let i = 0; i < totalFrames; i++) all.push(sampleHeroMotion(P, i / fps))

  const rows = Object.entries(LEDGER).map(([ph, want]) => ({
    ph,
    want,
    got: frames(P, ph),
    ok: Math.abs(frames(P, ph) - want) <= 1,
  }))
  const onLedger = rows.every((r) => r.ok)
  const ledgerGot = rows.reduce((a, r) => a + r.got, 0)
  const ledgerWant = rows.reduce((a, r) => a + r.want, 0)
  const extra = UNCOUNTED.reduce((a, ph) => a + frames(P, ph), 0)
  // Every frame in the beat belongs to a ledger row or to one of the two named
  // camera moves. The tolerance is per-phase frame rounding, not slack: each
  // phase's count is one `Math.round`, so the accumulated error cannot exceed
  // half a frame per phase. Twelve phases -> 6 frames, and the beat measures 1.
  const namedFrames = ledgerGot + extra
  const roundingBound = HALF_FRAME * phases.length
  const framesAccounted = Math.abs(namedFrames - totalFrames) <= roundingBound

  /* THE INVENTORY, AS A SET COMPARISON. This is the row a thirteenth phase
   * fails, and it fails on the NAME rather than on the arithmetic — so a phase
   * of zero duration, which moves no frame count at all, is still caught. */
  const inventory = new Set([...Object.keys(LEDGER), ...UNCOUNTED])
  const unledgered = phases.filter((ph) => !inventory.has(ph))
  const phantom = [...inventory].filter((ph) => !phases.includes(ph))
  const inventoryOK = unledgered.length === 0 && phantom.length === 0
  const allAccounted = inventoryOK && framesAccounted

  /* ---- HELD, and a hold only counts if something STOPPED ------------------
   * THE FIRST VERSION COUNTED PHASE MEMBERSHIP AND THE PRIOR BEAT PASSED IT.
   * It summed the four hold shots' durations, so the prior's 96-frame `orbit`
   * — 3.2 seconds of `driftEase` — counted as 3.2 seconds of stillness and the
   * beat the board calls *"never still"* scored 46.7%. That is exactly the row
   * that cannot fail.
   *
   * A shot is held if its frames are IDENTICAL, which is also how the reference
   * films are measured (adjacent-frame difference at or near zero). §3 K6's
   * complaint is the whole point: *"A hold only reads as a hold if something
   * stopped."* */
  const shotFrames = (ph) => {
    const n = frames(P, ph)
    const rows = []
    for (let i = 0; i < n; i++) rows.push(sampleHeroMotion(P, off[ph] + i / fps))
    return rows
  }
  const heldShots = HOLD_SHOTS.map((ph) => {
    const rows = shotFrames(ph)
    const stillShot = rows.length > 0 && rows.every((r) => sig(r) === sig(rows[0]))
    return { ph, n: rows.length, still: stillShot }
  })
  const authored = heldShots.reduce((a, s) => a + (s.still ? s.n : 0), 0)
  const holdSpans = heldShots
    .filter((s) => s.still)
    .map((s) => ({ ph: s.ph, at: off[s.ph], n: s.n }))
  const inHold = (i) =>
    holdSpans.some((h) => i / fps >= h.at - 1e-9 && i / fps < h.at + h.n / fps - 1e-9)
  let repeats = 0
  for (let i = 1; i < all.length; i++) {
    if (inHold(i)) continue
    if (sig(all[i]) === sig(all[i - 1])) repeats++
  }
  const readStill = authored + repeats
  const readPct = (100 * readStill) / totalFrames
  const authoredPct = (100 * authored) / totalFrames

  // MOMENTS. A moment is a phase in which the extent collapses to the edge
  // floor and is HELD there for at least two frames.
  const momentPhases = phases.filter((ph) => {
    const n = frames(P, ph)
    let hits = 0
    for (let i = 0; i < n; i++) {
      const s = sampleHeroMotion(P, off[ph] + i / fps)
      if (s.sx <= P.emerge.edgeFloor + 1e-9) hits++
    }
    return hits >= 2
  })

  const shotsHeld = heldShots.every((s) => s.n >= 9 && s.still)
  /** A hold shot naming a phase the model does not have. `shotFrames` would
   *  quietly return an empty array for it, so `every` would be vacuously true
   *  on a list of nothing but strays. */
  const strayHolds = HOLD_SHOTS.filter((ph) => !phases.includes(ph))

  return {
    /* BOOKKEEPING, printed and never scored. These are true of any beat, so
     * asserting them would be four more rows that cannot fail. */
    report: [
      `${ledgerGot} frames on the ledger's own rows + ${extra} in the two camera moves it has no row for ` +
        `(${UNCOUNTED.map((ph) => `${ph} ${frames(P, ph)}`).join(", ")}) = ${namedFrames} of ${totalFrames} total, ${total.toFixed(2)}s`,
      `the overage against §10.3's 270 is ${totalFrames - ledgerWant} frames — ` +
        `${allAccounted ? "all of it in those two moves" : "NOT all of it in those two moves"}`,
    ],
    claims: [
      {
        /* THE ROW A THIRTEENTH PHASE FAILS. It did not exist: `allAccounted` was
         * computed, printed in `report`, and scored nowhere, so the inventory
         * above could drift from `HERO_PHASES` indefinitely behind 4/4 green. */
        key: "inventory",
        name: "the ledger accounts for EVERY phase the model has — no phase ships unledgered",
        pass: allAccounted,
        detail:
          `${Object.keys(LEDGER).length} ledger rows + ${UNCOUNTED.length} named camera moves ` +
          `(${UNCOUNTED.join(", ")}) = ${inventory.size} against HERO_PHASES' ${phases.length}` +
          (unledgered.length ? ` — UNLEDGERED: ${unledgered.join(", ")}` : "") +
          (phantom.length ? ` — IN THE LEDGER BUT NOT IN THE MODEL: ${phantom.join(", ")}` : "") +
          `; ${namedFrames} named frames against ${totalFrames} total, ` +
          `off by ${Math.abs(namedFrames - totalFrames)} (rounding bound is ` +
          `${roundingBound} = half a frame per phase, NOT the 12-frame slack this used to allow)`,
      },
      {
        key: "ledger",
        name: "the beat lands on §10.3's ledger, row by row",
        pass: onLedger,
        detail: rows
          .map((r) => `${r.ph} ${r.got}${r.ok ? "" : `≠${r.want}`}`)
          .join(" · ") + ` — ${ledgerGot} frames against the ledger's ${ledgerWant}`,
      },
      {
        /* ⚠ THE SECOND CONJUNCT WAS `heldShots.length === 4` AND IT COMPARED A
         * LITERAL WITH ITSELF. `heldShots` is `HOLD_SHOTS.map(...)`, so its
         * length IS `HOLD_SHOTS.length`, i.e. the row asserted that a
         * four-element array typed four lines above has four elements. It could
         * not fail, and it made the row's own name — "FOUR held shots" — read
         * as a checked claim when nothing checked it.
         *
         * The claim that is actually worth making is that every hold shot names
         * a real phase of the model, and that all four STOP. The count is now
         * asserted against §7's number written down once, and the membership
         * against `HERO_PHASES`, so a renamed or removed phase goes red instead
         * of being silently mapped over. */
        key: "held",
        name: "FOUR held shots, and every one of them actually STOPS",
        pass: shotsHeld && HOLD_SHOTS.length === HELD_SHOT_COUNT && strayHolds.length === 0,
        detail: heldShots
          .map((s) => `${s.ph} ${s.n}fr ${s.still ? "still" : "MOVING"}`)
          .join(" · ") + " (each needs >= 9 frames and zero movement)" +
          (HOLD_SHOTS.length === HELD_SHOT_COUNT
            ? ""
            : ` — §7 counts ${HELD_SHOT_COUNT} held shots and this list has ${HOLD_SHOTS.length}`) +
          (strayHolds.length ? ` — NOT A PHASE OF THE MODEL: ${strayHolds.join(", ")}` : ""),
      },
      {
        key: "moments",
        name: "TWO moments, and exactly two",
        pass: momentPhases.length === 2,
        detail:
          momentPhases.length === 0
            ? "no frame anywhere collapses to the edge — the beat has no moment at all"
            : `${momentPhases.join(" and ")} (needs exactly 2: the turn and its return)`,
      },
      {
        key: "stillness",
        name: "read stillness clears C8's 36% bar",
        pass: readPct >= 36,
        detail:
          `${authored} frames in shots that genuinely stop (${authoredPct.toFixed(1)}%) + ${repeats} frames elsewhere ` +
          `identical to the frame before them = ${readStill} of ${totalFrames} = ${readPct.toFixed(1)}% ` +
          `(§10.3 predicted ≈43%; C8's bar is 36%, from Exquisite Corpse's own payoff unit)`,
      },
    ],
  }
}

/* ---- run ------------------------------------------------------------------ */
const P = DEFAULT_HERO_MOTION
console.log(`THE FRAME LEDGER — ${totalDuration(P).toFixed(2)}s at ${P.fps}fps\n`)
const run = claims(P)
const shipped = run.claims
for (const line of run.report) console.log(`      ${line}`)
console.log("")
for (const c of shipped) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}\n      ${c.detail}`)

/** The whole prior beat: its durations, its ramp, its drift, no return. */
const PRIOR = {
  ...P,
  cadence: "ones",
  cameraPark: "prior",
  riseCurve: "prior",
  shadowLaw: "prior",
  ret: { ...P.ret, mode: "prior" },
  emerge: { ...P.emerge, mode: "prior" },
  beats: {
    draw: 2.6,
    breath: 0.5,
    anticipation: 0.36,
    emerge: 0.54,
    land: 0,
    solid: 0,
    tilt: 0.7,
    standup: 1.4,
    orbit: 3.2,
    descend: 0,
    returnTurn: 0,
    hold: 0.9,
  },
}

const got = claims(PRIOR).claims
console.log(
  `\nNEGATIVE CONTROL — the whole prior beat: its durations, the ramp instead of the turn,` +
    `\nthe drift instead of the hold, no landing, no return, ones instead of twos`,
)
/* WHICH ROWS THE CONTROL MUST FAIL, AND WHICH ARE KEEPERS — named, not assumed.
 *
 * The prior beat is a control on the beat's SHAPE: its durations, its ramp, its
 * drift. It is not a control on the phase INVENTORY, because the prior beat has
 * the same twelve phases this one does — it only retimes them. So the inventory
 * row correctly passes here, and requiring every row to fail would have forced
 * the choice between deleting the new row and softening it.
 *
 * This is `assert-hero-camera.mjs`'s own MUST_FAIL/keepers accounting, ported:
 * saying which rows must fail is the only thing that makes a control mean
 * anything. The inventory row's proof-of-fireability is the 13th-phase
 * calibration below, which is a control aimed at exactly what it claims. */
const MUST_FAIL = new Set(["ledger", "held", "moments", "stillness"])
let blind = false
for (const c of got) {
  const must = MUST_FAIL.has(c.key)
  if (must && c.pass) blind = true
  console.log(
    `  ${c.pass ? (must ? "PASS <- WRONG" : "passes — KEEPER, and it should") : "fails, correctly"}  ${c.name}\n        ${c.detail}`,
  )
}
const keepers = got.filter((c) => !MUST_FAIL.has(c.key) && !c.pass)
if (keepers.length)
  console.log(
    `\nNOTE — the control fails a keeper row, so that row is not describing something\n` +
      `the prior beat already had:\n` +
      keepers.map((c) => `  - ${c.name}`).join("\n"),
  )

/* ---- CALIBRATION: A THIRTEENTH PHASE, REQUIRED TO FAIL ---------------------
 *
 * The defect this file shipped with, constructed: a phase that exists in the
 * model and in NOBODY'S ledger. Before the repair, the only quantity that could
 * see it was `allAccounted`, which was printed and never scored — so this arm
 * came back 4/4 green and SOUND, which is the whole reason the repair exists.
 *
 * The synthetic phase is handed in as an INVENTORY, not as a duration, and that
 * is deliberate: `HERO_PHASES` is what `totalDuration` and `phaseOffsets` walk,
 * so a phase the model does not know about cannot move a frame count. Catching
 * it therefore has to happen on the NAME, which is exactly the property that
 * makes a zero-duration phase catchable too.
 *
 * Two arms, because a phase can arrive from either side:
 *   13th   the model gains `reprise` and the ledger has never heard of it.
 *   gone   the ledger still lists `land` after the model dropped it.
 */
const SYNTH_PHASE = "reprise"
const withThirteenth = claims({ ...P, beats: { ...P.beats, [SYNTH_PHASE]: 0.5 } }, [
  ...HERO_PHASES,
  SYNTH_PHASE,
])
const withoutLand = claims(P, HERO_PHASES.filter((ph) => ph !== "land"))
const cal = [
  {
    label: `a 13th phase "${SYNTH_PHASE}" in the model that no ledger row names`,
    row: withThirteenth.claims.find((c) => c.key === "inventory"),
  },
  {
    label: `the ledger still listing "land" after the model dropped it`,
    row: withoutLand.claims.find((c) => c.key === "inventory"),
  },
]
console.log(
  `\nCALIBRATION — the defect this file used to be blind to, constructed and required to FAIL`,
)
let calibrated = true
for (const { label, row } of cal) {
  if (row.pass) calibrated = false
  console.log(`  ${row.pass ? "MISSED" : "caught, correctly"}  ${label}\n        ${row.detail}`)
}

const failed = shipped.filter((c) => !c.pass)
console.log(`\n${shipped.length - failed.length}/${shipped.length} rows hold on the shipped beat.`)
console.log(
  `${got.filter((c) => MUST_FAIL.has(c.key) && !c.pass).length}/${MUST_FAIL.size} rows that describe the ` +
    `beat's SHAPE correctly FAIL on the prior beat (the inventory row is a keeper — see above).`,
)
if (blind) console.log(`\nINSTRUMENT IS BLIND — the prior beat passed a row it cannot honestly pass.`)
if (!calibrated)
  console.log(
    `\nINSTRUMENT IS BLIND — an unledgered phase passes the inventory row, which is the` +
      `\ndefect this row exists for.`,
  )
console.log(failed.length || blind || !calibrated ? "\nNOT SOUND" : "\nSOUND")
process.exit(failed.length || blind || !calibrated ? 1 : 0)

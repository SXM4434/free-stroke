// assert-export-plan.mjs — the animated export's TIMEBASE, as numbers.
//
// The claim this gate settles is the product claim: "the export lasts as long
// as the drawing took, and every frame lands on an exact instant." That is
// arithmetic, so it is checked as arithmetic — no browser, no capture.
//
// EVERY row runs with a NEGATIVE CONTROL that must FAIL. A green row that
// cannot go red is the lie this repo has caught eleven times.
//
//   node scripts/verify/assert-export-plan.mjs
//   node scripts/verify/assert-export-plan.mjs --mutate=wholespeed   (§4 must go RED)
//   node scripts/verify/assert-export-plan.mjs --mutate=endsfull     (§9 must go RED)
//
// `--mutate=wholespeed` is §4's KNOWN-BAD INPUT, and it exists because §4's
// control used to be a false literal (see the block above §4). It feeds the
// REAL arm the timeline a build that applied `speed` to the whole film would
// produce — lead-in and hold divided by the speed — and §4 must fail on it.
// `frame-plan.ts` is not touched: the defect is injected as an INPUT to the
// same real `planFrames`, which is the only place a harness is allowed to
// reproduce a surface defect from.
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { loadTs } from "./_ts-load.mjs"
import { makePaired } from "./lib/paired.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const { planFrames, describePlan, revealEndsFor, DEFAULT_MAX_FRAMES } = loadTs("lib/export/frame-plan.ts")

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  —  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
/** A check plus the mutation that must break it. */
/* ONE PLACE OF TRUTH. See scripts/verify/lib/paired.mjs.
 * This file thunks, no try/catch: a throwing control crashed the gate rather than passing it, so this one was SAFE. Consolidated for one place of truth, and it gains the named-throw reporting. */
const paired = makePaired(row)

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps

/** The known-bad injector. See the header. */
const MUTATE = (process.argv.find((a) => a.startsWith("--mutate=")) || "").split("=")[1] || ""
if (MUTATE) console.log(`[mutate=${MUTATE}] a known-bad input is armed — a row MUST go red\n`)

/* ── 1 · THE PEN TIMEBASE ────────────────────────────────────────────── */
{
  const pen = 4237 // ms — a real-ish hand gesture
  const p = planFrames({ penDurationMs: pen, fps: 30, timebase: "pen" })
  paired(
    "pen timebase: output duration IS the recorded drawing duration",
    () => near(p.drawDurationMs, pen) && Math.abs(p.durationMs - pen) < 1000 / 30,
    "fixed timebase must NOT match the pen",
    () => {
      const q = planFrames({ penDurationMs: pen, fps: 30, timebase: "fixed", fixedDurationMs: 3000 })
      return near(q.drawDurationMs, pen)
    },
    `draw ${p.drawDurationMs.toFixed(1)}ms vs pen ${pen}ms · ${p.frames.length} frames`,
  )
}

/* ── 2 · FRAME SPACING IS EXACT, NOT ACCUMULATED ─────────────────────── */
{
  const p = planFrames({ penDurationMs: 4237, fps: 30, timebase: "pen" })
  let worst = 0
  for (const f of p.frames) worst = Math.max(worst, Math.abs(f.timeMs - (f.index * 1000) / 30))
  paired(
    "every frame time is index/fps to floating-point exactness",
    () => worst < 1e-9,
    "a 1ms-per-frame accumulator drifts",
    () => {
      // The classic bug: t += round(1000/fps). At 30fps that is 33ms and the
      // clip runs 3% slow — inaudible per frame, a whole second over 30s.
      let t = 0
      let w = 0
      for (const f of p.frames) {
        w = Math.max(w, Math.abs(f.timeMs - t))
        t += Math.round(1000 / 30)
      }
      return w < 1e-9
    },
    `worst deviation ${worst.toExponential(2)}ms`,
  )
}

/* ── 3 · THE CLOSING FRAME EXISTS ────────────────────────────────────── */
{
  const p = planFrames({ penDurationMs: 1000, fps: 30, timebase: "pen" })
  const last = p.frames[p.frames.length - 1]
  paired(
    "the mark is SEEN finished: the last frame's clock is exactly 1",
    () => last.clock === 1,
    "dropping the closing frame leaves it unfinished",
    () => {
      const cut = p.frames.slice(0, -1)
      return cut[cut.length - 1].clock === 1
    },
    `last frame #${last.index} @ ${last.timeMs.toFixed(2)}ms clock=${last.clock}`,
  )
}

/* ── 4 · LEAD-IN AND HOLD ARE STILLNESS, AND SPEED DOES NOT TOUCH THEM ─
 *
 * ⚠ THE CONTROL HERE WAS A CONSTANT, AND A CONSTANT IS NOT A MUTATION
 * (found 2026-08-03). It read:
 *
 *     () => { const wrong = (200 + 2000 + 500) / 2
 *             return near(200 + p.drawDurationMs + 500, wrong) }
 *
 * `p.drawDurationMs` is 1000 at speed 2, so that is `near(1700, 1350)` — FALSE
 * for every possible build of `frame-plan.ts`, today and after any edit. It
 * never called `planFrames`, so no change to the subject could ever make it
 * come back true, and `paired()`'s whole contract is that `control()` is the
 * SAME question asked of a MUTATED subject. A control that is a false literal
 * dressed as an expression makes the row read as two-armed while it is one.
 * Parked verbatim below rather than deleted, because the shape is worth
 * recognising the next time it appears.
 *
 * THE REPAIR. The stillness law is factored into a predicate over a plan and
 * the lead/hold that plan was ASKED for, and the control runs that identical
 * predicate against a timeline whose lead-in and hold WERE scaled by the speed
 * — 100 ms and 250 ms instead of 200 and 500, which is precisely what "speed
 * applied to the whole timeline" produces. Same question, mutated subject. If
 * `planFrames` ever starts dividing `leadInMs`/`holdMs` by `speed`, the REAL
 * arm returns 100/250 against an expected 200/500 and the row goes red — which
 * the old form could not do at all. */
{
  // `--mutate=wholespeed`: the lead-in and the hold arrive already divided by
  // the speed, which is what a build that scaled the WHOLE timeline would hand
  // back. The real arm must reject it.
  const SPEED_BUG = MUTATE === "wholespeed"
  const p = planFrames({
    penDurationMs: 2000,
    fps: 30,
    timebase: "pen",
    speed: 2,
    leadInMs: SPEED_BUG ? 100 : 200,
    holdMs: SPEED_BUG ? 250 : 500,
  })
  const lead = p.frames.filter((f) => f.phase === "lead")
  const hold = p.frames.filter((f) => f.phase === "hold")
  const draw = p.frames.filter((f) => f.phase === "draw")

  /** The stillness law, asked of any plan against the lead/hold it was asked for. */
  const stillnessHolds = (q, wantLeadMs, wantHoldMs) => {
    const l = q.frames.filter((f) => f.phase === "lead")
    const h = q.frames.filter((f) => f.phase === "hold")
    const d = q.frames.filter((f) => f.phase === "draw")
    return (
      near(q.drawDurationMs, 1000) &&
      l.every((f) => f.clock === 0) &&
      h.every((f) => f.clock === 1) &&
      l.length > 0 &&
      h.length > 0 &&
      d.length > 0 &&
      // THE TWO NUMBERS THE CLAIM IS ABOUT. Without these the predicate never
      // looked at the lead-in or the hold at all — it only counted frames.
      near(q.leadInMs, wantLeadMs) &&
      near(q.holdMs, wantHoldMs) &&
      near(q.durationMs - q.frameIntervalMs, q.frames[q.frames.length - 1].timeMs)
    )
  }

  /* PARKED — the prior control, kept as a diagnostic so its value is visible.
   * It prints `false` on every build; that is the defect, not a result. */
  const parkedConstantControl = near(200 + p.drawDurationMs + 500, (200 + 2000 + 500) / 2)

  paired(
    "2x speed halves the DRAW only; lead-in and hold keep their real length",
    () => stillnessHolds(p, 200, 500),
    "the SAME law on a timeline whose lead-in and hold were scaled by the speed too",
    () =>
      stillnessHolds(
        planFrames({ penDurationMs: 2000, fps: 30, timebase: "pen", speed: 2, leadInMs: 100, holdMs: 250 }),
        200,
        500,
      ),
    `lead ${lead.length}f (${p.leadInMs}ms) · draw ${draw.length}f (${p.drawDurationMs}ms) · hold ${hold.length}f (${p.holdMs}ms)` +
      ` · parked constant control reads ${parkedConstantControl} (it always did)`,
  )
}

/* ── 5 · THE HOLD IS WHERE COMPLETION-KEYED STYLE LIVES ──────────────── */
{
  const withHold = planFrames({ penDurationMs: 1000, fps: 30, timebase: "pen", holdMs: 800 })
  const without = planFrames({ penDurationMs: 1000, fps: 30, timebase: "pen" })
  const framesAfterComplete = (p) => p.frames.filter((f) => f.clock === 1).length
  paired(
    "a completion pulse has frames to happen in",
    () => framesAfterComplete(withHold) >= 24,
    "no hold leaves exactly one frame after completion",
    () => framesAfterComplete(without) >= 24,
    `${framesAfterComplete(withHold)} frames at clock=1 with an 800ms hold, ${framesAfterComplete(without)} without`,
  )
}

/* ── 6 · REVERSE ─────────────────────────────────────────────────────── */
{
  const f = planFrames({ penDurationMs: 1000, fps: 30, timebase: "pen", reverse: true })
  paired(
    "reverse starts complete and ends empty",
    () => f.frames[0].clock === 1 && f.frames[f.frames.length - 1].clock === 0,
    "forward does the opposite",
    () => {
      const g = planFrames({ penDurationMs: 1000, fps: 30, timebase: "pen" })
      return g.frames[0].clock === 1 && g.frames[g.frames.length - 1].clock === 0
    },
    `first=${f.frames[0].clock} last=${f.frames[f.frames.length - 1].clock}`,
  )
}

/* ── 7 · TRUNCATION IS ANNOUNCED, NOT SILENT ─────────────────────────── */
{
  /* THE CAP ITSELF IS PINNED, and the row below is why it has to be.
   *
   * `assert-gate-integrity` channel D moved `DEFAULT_MAX_FRAMES` 3600 -> 5760 and
   * this file did not notice: every use of it here is `p.frames.length ===
   * DEFAULT_MAX_FRAMES`, so both sides of the comparison move together and the
   * assertion is true at any value. That is the differential shape the meta-gate
   * warns about, and here it is hiding something a user can feel — the cap is the
   * ceiling on how long an exported animation can be (3600 frames = 2 minutes at
   * 30 fps). Doubling it silently doubles the worst-case export.
   *
   * So one row states the VALUE, once, and it is the row that goes red when the
   * constant moves. Everything else stays relative to it. */
  row(
    DEFAULT_MAX_FRAMES === 3600,
    "the frame cap is still 3600 — the export ceiling, stated rather than compared to itself",
    `DEFAULT_MAX_FRAMES = ${DEFAULT_MAX_FRAMES} (3600 = 120 s at 30 fps; every other row here compares the cap to itself and cannot see it move)`,
  )
  const p = planFrames({ penDurationMs: 10 * 60 * 1000, fps: 30, timebase: "pen" })
  paired(
    "an absurdly long drawing is capped AND says so",
    () => p.truncated === true && p.frames.length === DEFAULT_MAX_FRAMES && p.requestedFrames > DEFAULT_MAX_FRAMES,
    "a normal drawing must NOT be flagged truncated",
    () => planFrames({ penDurationMs: 4000, fps: 30, timebase: "pen" }).truncated === true,
    `${p.requestedFrames} requested → ${p.frames.length} kept`,
  )
}

/* ── 8 · THE SENTENCE THE USER READS ─────────────────────────────────── */
{
  const s = describePlan(planFrames({ penDurationMs: 4237, fps: 30, timebase: "pen" }))
  const t = describePlan(planFrames({ penDurationMs: 4237, fps: 30, timebase: "fixed", fixedDurationMs: 3000 }))
  paired(
    "the pen timebase SAYS what it is; the fixed one does not pretend to",
    () => /the time this took you to draw/.test(s) && !/the time this took you to draw/.test(t),
    "both strings identical would make the label meaningless",
    () => s === t,
    JSON.stringify(s),
  )
}

/* ── 9 · DEGENERATE INPUT ────────────────────────────────────────────── */
{
  const p = planFrames({ penDurationMs: 0, fps: 30, timebase: "pen" })
  paired(
    "a zero-length drawing still yields one usable frame",
    () => p.frames.length >= 1 && Number.isFinite(p.durationMs) && p.frames.every((f) => Number.isFinite(f.timeMs)),
    "a NaN duration must not silently produce NaN frames",
    () => {
      const q = planFrames({ penDurationMs: Number.NaN, fps: 30, timebase: "pen" })
      return q.frames.some((f) => Number.isNaN(f.timeMs))
    },
    `${p.frames.length} frame(s)`,
  )
}

/* ── 10 · THE COPIED CONSTANT CANNOT ROT ─────────────────────────────
 *
 * `lib/export/index.ts` carries `EXPORT_PAPER`, a copy of `STILL_PAPER` in
 * `components/viewport-3d.tsx`, because `lib/` may not import a component. A
 * pasted constant that nobody re-reads is this repo's most expensive recurring
 * defect (the `motion.mjs` block, found stale on two consecutive days). So the
 * copy is GATED: this row reads the literal out of the component's source and
 * fails the moment the two disagree. */
/* ── 9 · 🔴 THE TAIL, ACROSS ALL EIGHT REACHABLE STATES ────────────────
 *
 * WHY THIS ROW EXISTS, MEASURED RATHER THAN ARGUED. On 2026-08-28 the
 * ends-full assumption was put back into `frame-plan.ts` — one line,
 * `holdSuppressed = false` — and THIS GATE STILL READ 11 PASS · 0 FAIL. Every
 * row above is about arithmetic on a clock, and the defect is about what the
 * clock's endpoints SHOW, so none of them could see it. The only guard that
 * went red was `assert-export-window.mjs` §A, which launches a browser, and
 * whose `--model` arm the meta-gate already reports as a judgement no sweep
 * reaches. So the model battery had no guard on it at all.
 *
 * THE INVARIANT IS NOT "THE LAST FRAME IS NOT BLANK". Vanish genuinely ends on
 * an empty page; that is what Vanish IS, and a row demanding ink there would be
 * demanding the feature be broken. The invariant is that a film ends on at most
 * ONE empty frame — the terminal instant the mode itself defines — and never on
 * a HELD RUN of them. Measured tonight at 30 fps with the app's own 600 ms hold:
 * the shipped tree gives a trailing-empty run of 0 or 1 in all eight states;
 * with the assumption restored, `travel`, `vanish`, `shrink`, `grow+rev` and
 * `travel+rev` give 18.
 *
 * EMPTINESS IS ASKED OF `windowAt` ITSELF, not of the copy in `frame-plan.ts`.
 * `REVEAL_WINDOW_ENDS` is that copy, `assert-export-window.mjs` already gates
 * the two against each other, and a row that read the copy would be checking
 * the plan against its own homework. */
{
  const { windowAt, REVEAL_WINDOW_DEFAULTS } = loadTs("lib/stroke-schedule.ts")
  const MODES = ["grow", "travel", "vanish", "shrink"]
  const HOLD = 600 // `handleExportVideo`'s own hard-coded hold
  const PEN = 4237
  const FPS = 30

  /* The known-bad is injected as an INPUT, never by editing the subject: an
   * ends-full plan is exactly the plan you get by not telling it the ends. */
  const plan = (mode, reverse) =>
    planFrames({
      penDurationMs: PEN, fps: FPS, timebase: "pen", holdMs: HOLD, reverse,
      ...(MUTATE === "endsfull" ? {} : { revealEnds: revealEndsFor(mode) }),
    })

  /** Trailing frames whose reveal window is EMPTY. Exact, not a threshold. */
  const emptyTail = (p, mode) => {
    const w = { mode, length: REVEAL_WINDOW_DEFAULTS.length }
    let n = 0
    for (let i = p.frames.length - 1; i >= 0; i--) {
      if (!windowAt(w, p.frames[i].clock).empty) break
      n++
    }
    return n
  }

  const states = []
  for (const mode of MODES) {
    for (const reverse of [false, true]) {
      const p = plan(mode, reverse)
      states.push({ name: `${mode}${reverse ? "+rev" : ""}`, mode, tail: emptyTail(p, mode), n: p.frames.length })
    }
  }
  const bad = states.filter((x) => x.tail > 1)
  console.log(
    `      the eight (window × reverse) states — trailing EMPTY frames, ${FPS} fps, ${HOLD}ms hold:\n` +
      `      ${states.map((x) => `${x.name} ${x.tail}/${x.n}f`).join(" · ")}`,
  )
  paired(
    "🔴 no reachable state welds a HELD RUN of blank frames to the tail of the film",
    () => bad.length === 0,
    "…and the census can see one — the SAME check on a plan that was never told the ends must fail",
    () => {
      const blind = MODES.flatMap((mode) =>
        [false, true].map((reverse) => {
          const p = planFrames({ penDurationMs: PEN, fps: FPS, timebase: "pen", holdMs: HOLD, reverse })
          return emptyTail(p, mode)
        }),
      )
      return blind.every((t) => t <= 1)
    },
    `${states.length - bad.length}/8 states end on at most one empty frame` +
      (bad.length ? ` · WELDED: ${bad.map((x) => `${x.name}(${x.tail})`).join(", ")}` : ""),
  )
}

{
  const src = readFileSync(join(ROOT, "components", "viewport-3d.tsx"), "utf8")
  const m = src.match(/const STILL_PAPER = "([^"]+)"/)
  const indexSrc = readFileSync(join(ROOT, "lib", "export", "index.ts"), "utf8")
  const mine = indexSrc.match(/export const EXPORT_PAPER = "([^"]+)"/)
  /* The comparison is a function of two literals, so the control mutates one
   * of them: the SAME check run against a wrong app value must come back
   * false. Without that, "both were NOT FOUND" would read as a pass. */
  const agree = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase()
  paired(
    "EXPORT_PAPER still equals the app's STILL_PAPER",
    () => agree(m && m[1], mine && mine[1]),
    "the same check against a mutated app value must FAIL",
    () => agree("#123456", mine && mine[1]),
    `viewport-3d STILL_PAPER=${m ? m[1] : "NOT FOUND"} · lib/export EXPORT_PAPER=${mine ? mine[1] : "NOT FOUND"}`,
  )
}

console.log(`\nassert-export-plan: ${pass} PASS · ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)

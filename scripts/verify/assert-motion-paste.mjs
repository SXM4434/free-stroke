/**
 * DOES THE PASTE STILL DESCRIBE THE BEAT? — the hole `docs/README.md` names and
 * nothing closed.
 *
 * N8, 2026-08-28, at the controller's request. `docs/README.md`, verbatim:
 *
 *   *"The beat has one owner and it is `lib/hero-motion.ts`.
 *   `scripts/capture/motion.mjs` is a downstream **manual paste** of its
 *   constants (the page's "Copy motion.mjs constants" button), and **it has now
 *   been found stale twice in two days.** If you change a beat, the paste is the
 *   last step and **nothing gates it**."*
 *
 * Found stale twice in two days, defended by a sentence in a README. A rendered
 * film shot through `motion.mjs` after a beat moved is not a film of the beat
 * that shipped, and NOTHING about it looks wrong — the capture runs clean, the
 * frames are sharp, and the timing is somebody's older opinion. That is the
 * silent-degradation shape exactly.
 *
 * ── HOW IT MATCHES, AND WHY IT IS NOT A TABLE ─────────────────────────────
 *
 * The paste screams its names (`RISE_GATHER_FRAC`) and the source camel-cases
 * them (`riseGatherFrac`), so 29 of the 32 exports resolve by RULE. Three do
 * not, and they are aliases with reasons written into the paste itself, so they
 * get a named table.
 *
 * ⚠ AND THE TABLE CANNOT GO SILENTLY SHORT, which is the failure every
 * hand-list in this repo has had. An export that resolves to NOTHING is a RED
 * ROW, not a skip — so the next constant somebody adds to the paste fails this
 * gate until it is either matched or explained. `one-system` §4.6, and the
 * lesson `scripts/verify/lib/dev-server.mjs` paid for: *"a blacklist can only
 * ever catch the names somebody already thought of."*
 *
 * ── AND THE OTHER DIRECTION, WHICH THIS GATE DID NOT HAVE ─────────────────
 *
 * An independent crosscheck on 2026-08-28 DELETED a pasted export and this gate
 * returned 5/5, exit 0. `reconcile` walks `Object.keys(paste)`, so an export
 * that is no longer there is an export it never asks about, and the `new key`
 * control tests the opposite direction — an extra export, never an omitted one.
 * A paste short one constant is the stalest paste there is: the capture then
 * reads `undefined` for a beat and renders it as whatever `undefined` does in
 * arithmetic, which is exactly the silent shape the gate exists for.
 *
 * The fix is NOT a hand-list of the 31 names. `lib/hero-motion.ts` already has
 * the button's own generator, `toMotionMjsSource(p)` — the function the page's
 * "Copy motion.mjs constants" button calls. So the expected inventory is READ
 * OFF THE GENERATOR: every `export const` the button would write must exist in
 * the paste. Derive, never enumerate (`one-system` §4.6). A constant added to
 * the generator and not to the paste is red on the next run, with no edit here.
 *
 * ── PRECISION ─────────────────────────────────────────────────────────────
 *
 * The paste is a ROUNDED copy — `4.6667` for `14/3`, `0.1905` for `4/21` — so a
 * bit-exact comparison would be red on a fresh paste. Each value is compared at
 * the number of decimals the paste itself wrote, which is the tightest bar that
 * a correct paste passes and the loosest that a real drift fails: `emerge`
 * moving from 0.9167 to 0.9200 is caught at four decimals.
 */

// gate-integrity: differential — the two constants channel D can reach here, letterCount and
// letterSilentAfter, are the two this file prints a note to say the paste does NOT carry, so moving
// them correctly requires no re-paste and correctly moves no row. The rows that ARE value-sensitive
// compare 32 pasted constants against lib/hero-motion.ts and the `precision` known-bad proves they
// bite on a drift in the last decimal of one of them.
import { loadTs } from "./_ts-load.mjs"
import * as PASTE from "../capture/motion.mjs"

const M = loadTs("lib/hero-motion.ts")
const P = M.DEFAULT_HERO_MOTION

/**
 * The three exports the camel-case rule cannot reach, each with the paste's own
 * stated reason. A resolver returning `undefined` here is a RED row below, never
 * a skip.
 */
const ALIASES = {
  // "THE PHASE ORDER IS PART OF THE PROGRAM… It is `HERO_PHASES` in
  // lib/hero-motion.ts and the sampler walks it in this sequence."
  PHASES: () => M.HERO_PHASES,
  // `HeroMotionParams.ret` — "the round trip".
  RETURN: () => P.ret,
  // "Old paste target… this alias exists so a script written against the
  // previous file still resolves rather than reading `undefined.sec`."
  CROSSFADE: () => ({ sec: P.beats.emerge }),
  /* ⚠ THE PASTE FLATTENS THE CLIP INTO THE TURN, and the source does not.
   * `HeroMotionParams.emerge` is the turn's SHAPE (overshoot, light lag, flat
   * depth); how long the clip runs is `beats.emerge`. The paste's own line is
   * `sec: BEATS.emerge`, so this is that line, read the other way. Found by this
   * gate on its first run, which is the whole argument for having it: nobody
   * writing a comparison by hand would have gone looking for a key that exists
   * on one side of a "manual paste of its constants". */
  "EMERGE.sec": () => P.beats.emerge,
}

const camel = (n) => n.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())

/** How many decimals the paste itself wrote for this number. */
const decimalsOf = (v) => {
  const s = String(v)
  const i = s.indexOf(".")
  return i < 0 ? 0 : s.length - i - 1
}

/**
 * THE COMPARATOR, as a pure function of two objects — kept separate so the
 * known-bads below can hand it a drifted paste and watch it say no. A comparator
 * whose only testable surface is the live pair is a comparator nobody can hand a
 * known-bad (`scripts/verify/lib/dev-server.mjs`'s own rule).
 */
export function reconcile(paste, source, expected = []) {
  const unresolved = []
  const disagree = []
  let checked = 0
  const walk = (name, a, b, path) => {
    /* A PATH-LEVEL ALIAS BEATS THE STRUCTURE, so a paste that flattens a nested
     * value can still be reconciled against where it really lives. */
    if (path in ALIASES) b = ALIASES[path]()
    if (b === undefined) { unresolved.push(path); return }
    if (typeof a === "number" && typeof b === "number") {
      checked++
      const d = decimalsOf(a)
      if (Number(b.toFixed(d)) !== a) disagree.push(`${path} paste ${a} vs source ${b}`)
      return
    }
    if (Array.isArray(a)) {
      checked++
      if (!Array.isArray(b) || a.length !== b.length || a.some((v, i) => v !== b[i])) {
        disagree.push(`${path} paste [${a}] vs source [${b}]`)
      }
      return
    }
    if (a && typeof a === "object") {
      for (const k of Object.keys(a)) walk(k, a[k], b[k], `${path}.${k}`)
      return
    }
    checked++
    if (a !== b) disagree.push(`${path} paste ${JSON.stringify(a)} vs source ${JSON.stringify(b)}`)
  }
  for (const k of Object.keys(paste)) {
    if (k === "default" || typeof paste[k] === "function") continue
    const src = k in ALIASES ? ALIASES[k]() : camel(k) in source ? source[camel(k)] : undefined
    walk(k, paste[k], src, k)
  }
  /* THE OTHER DIRECTION. Everything above walks the paste, so a constant the
   * paste DROPPED is a key this loop never reaches. `expected` is the button's
   * own output, read off the generator rather than typed out here. */
  const missing = expected.filter((n) => !(n in paste))
  return { unresolved, disagree, missing, checked }
}

/** What the page's "Copy motion.mjs constants" button would write, as a list of
 *  names. The generator is `lib/hero-motion.ts`'s `toMotionMjsSource` — the
 *  function the button calls — so this is the paste's contents according to the
 *  only thing entitled to an opinion about them. */
export function buttonExports(source = P) {
  return [...M.toMotionMjsSource(source).matchAll(/^export const ([A-Z][A-Z_0-9]*)\s*=/gm)].map((m) => m[1])
}

const EXPECTED = buttonExports()
const live = reconcile(PASTE, P, EXPECTED)

const rows = []
const say = (key, ok, label, detail) => {
  rows.push({ key, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

console.log(`\n=== THE PASTE: does scripts/capture/motion.mjs still describe lib/hero-motion.ts? ===\n`)

say("resolved", live.unresolved.length === 0,
  "every constant the paste exports resolves to something in the beat's owner",
  live.unresolved.length
    ? `UNRESOLVED: ${live.unresolved.join(", ")} — add it to ALIASES with the reason, or the paste is describing a fact the source does not have`
    : `${Object.keys(PASTE).filter((k) => typeof PASTE[k] !== "function").length} exports, all matched (29 by the camel-case rule, ${Object.keys(ALIASES).length} by name)`)

say("agree", live.disagree.length === 0,
  "…and every one of them still carries the value the source has",
  live.disagree.length ? live.disagree.join(" · ") : `${live.checked} leaf values compared at the paste's own precision`)

/* THE OTHER DIRECTION, AND IT IS THE ONE A DELETION USES. `EXPECTED` is not a
 * list somebody typed: it is the names `toMotionMjsSource` writes, so the bar
 * moves with the button and never with this file. */
say("complete", EXPECTED.length > 0 && live.missing.length === 0,
  "…and the paste is not SHORT — every constant the button writes is still in the file",
  live.missing.length
    ? `MISSING: ${live.missing.join(", ")} — the paste dropped a constant the button emits; press the button, do not delete this row`
    : EXPECTED.length === 0
      ? "THE GENERATOR EMITTED NOTHING — the inventory is derived from lib/hero-motion.ts's toMotionMjsSource and it returned no `export const`, so this row is measuring air"
      : `all ${EXPECTED.length} constants toMotionMjsSource writes are present (the paste also keeps ${Object.keys(PASTE).filter((k) => typeof PASTE[k] !== "function" && k !== "default" && !EXPECTED.includes(k)).join(", ") || "nothing"} beyond them)`)

/* ---- THE KNOWN-BADS, on the real comparator, on the bare invocation ------
 * Each hands `reconcile` a paste that is wrong in the exact way one row is
 * about. These are the two stalenesses the README says have already happened. */
console.log(`\n--- known-bad inputs, each required to turn its row red ---`)

{
  /* THE DRIFT. A beat moved in the source and nobody pressed the button — the
   * defect verbatim. `emerge` because it is the cascade's own clip, the number
   * this repo has already had wrong "in both directions at once". */
  const drifted = { ...PASTE, BEATS: { ...PASTE.BEATS, emerge: PASTE.BEATS.emerge + 0.0334 } }
  const r = reconcile(drifted, P, EXPECTED)
  say("kb-drift", r.disagree.length === 1 && r.disagree[0].startsWith("BEATS.emerge"),
    "KNOWN-BAD `drift` — one beat moved and the paste was not re-pressed — turns the `agree` row red, on that key alone",
    `${r.disagree.length} disagreement(s): ${r.disagree.join(" · ") || "NONE — the comparator cannot see a moved beat"}`)
}

{
  /* THE DELETION, WHICH IS THE ONE THAT GOT PAST THIS GATE. A constant is gone
   * from the paste — a bad merge, a hand-edit, a half-finished re-paste — and
   * the walk above cannot ask about a key that is not there. `SHADOW_LAG_SEC`
   * because it is the beat this repo has already had wrong on the shadow. */
  const short = { ...PASTE }
  delete short.SHADOW_LAG_SEC
  const r = reconcile(short, P, EXPECTED)
  say("kb-deleted", r.missing.length === 1 && r.missing[0] === "SHADOW_LAG_SEC" && r.unresolved.length === 0 && r.disagree.length === 0,
    "KNOWN-BAD `deleted` — a constant REMOVED from the paste — turns the `complete` row red, and nothing else notices it",
    `missing: ${r.missing.join(", ") || "NONE — the comparator cannot see an omitted export"} · ` +
      `unresolved ${r.unresolved.length}, disagree ${r.disagree.length} (both 0 is the point: only the new row can see this)`)
}

{
  /* THE SHORT TABLE. Someone adds a constant to the paste and the matcher has
   * never heard of it. The gate must NOT shrug. */
  const grown = { ...PASTE, LETTER_PAIR_FROM_XYZ: -1 }
  const r = reconcile(grown, P, EXPECTED)
  say("kb-new-key", r.unresolved.includes("LETTER_PAIR_FROM_XYZ"),
    "KNOWN-BAD `new key` — a pasted constant with no counterpart in the source — turns the `resolved` row red rather than being skipped",
    `unresolved: ${r.unresolved.join(", ") || "NONE — the matcher skipped a name it could not place"}`)
}

{
  /* AND THE POSITIVE CONTROL ON THE PRECISION RULE, because a comparator that
   * rounds is a comparator that can be made blind by rounding. A change one
   * decimal below the paste's own precision must still be caught if the paste
   * wrote that decimal. */
  const fine = { ...PASTE, MOVE_ACCEL_FRAC: PASTE.MOVE_ACCEL_FRAC + 0.0001 }
  const r = reconcile(fine, P, EXPECTED)
  say("kb-precision", r.disagree.length === 1,
    "KNOWN-BAD `precision` — a drift in the LAST decimal the paste wrote is still caught",
    `MOVE_ACCEL_FRAC ${PASTE.MOVE_ACCEL_FRAC} → ${(PASTE.MOVE_ACCEL_FRAC + 0.0001).toFixed(4)}: ${r.disagree.length} disagreement(s)`)
}

/* NOT A ROW, A NOTE, because it is what N8 needed to know and the next lane
 * will too: the paste does not carry the letter constants at all, so a change to
 * `letterCount` or `letterSilentAfter` needs no re-paste. */
console.log(
  `\nnote: the paste carries no letter constants — ` +
    `letterCount ${P.letterCount} and letterSilentAfter ${P.letterSilentAfter} live only in lib/hero-motion.ts, ` +
    `so moving them does NOT require pressing the button.`,
)

const failed = rows.filter((r) => !r.ok)
console.log(
  `\n${failed.length === 0 ? "THE PASTE STILL DESCRIBES THE BEAT" : "PASTE GATE FAILED"} — ` +
    `${rows.length - failed.length}/${rows.length} rows${failed.length ? ": " + failed.map((f) => f.key).join(", ") : ""}`,
)
process.exit(failed.length === 0 ? 0 : 1)

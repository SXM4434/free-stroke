// THE META-GATE — is every `assert-` script actually a gate?
//
// WHY THIS EXISTS
//
//   Eleven instruments in this repo have reported green while measuring nothing.
//   Three of them shared one structure, and it is the structure this file tests:
//
//     assert-taper-envelope.mjs   contained no check at all and printed
//                                 "NOT CONFIRMED" for a cycle with nobody reading it
//     assert-joint-beading.mjs    emits ZERO PASS/FAIL rows on its default
//                                 invocation — it is a capture wearing an `assert-` name
//     assert-layer-flicker.mjs    emits ZERO rows on its default invocation —
//                                 all ten of its assertion paths sit behind
//                                 `--fusion` / `--guard` / `--calibrate` flags
//
//   All three exited 0 in every sweep, so all three read as green forever. The
//   defect is not in any one of them. It is a CLASS, it keeps recurring, and a
//   one-off audit of it decays the moment the next script is written. So the
//   audit is an assertion, and it runs beside the others.
//
// WHAT A GATE HAS TO BE, stated as three independent channels
//
//   A · EMITS       On the DEFAULT invocation — no flags — at least one PASS/FAIL
//                   row is reachable. A script whose only judgements live behind
//                   `--calibrate` is a capture with an opinion mode.
//   B · EXIT-COUPLED  On the default invocation, a non-zero exit is reachable
//                   from the script's OWN judgement. `.catch(() => exit(1))` does
//                   not count: that reports the script crashed, never that the
//                   subject failed. A sweep reads exit codes, so an uncoupled
//                   exit is a green row that CANNOT fail.
//   C · EVIDENCE    Where does the judgement's input come from — the LIVE app
//                   (a browser or the engine loaded in node), or STORED frames on
//                   disk? Both are legitimate; `docs/README.md` says so plainly:
//                   "verify-* captures frames. assert-* and diff-frames turn them
//                   into pass/fail." But a STORED gate has a failure mode a LIVE
//                   one does not — it can pass without touching the current tree
//                   — so every STORED script is additionally RUN against a label
//                   that does not exist and must exit non-zero.
//
//   The three are independent on purpose. `bad-always-zero` passes A and fails B.
//   `bad-flag-gated` fails A while its assertions are perfectly good. Collapsing
//   them into one verdict would hide which half is broken.
//
// ── 2026-08-03 · A, B AND C WERE NOT ENOUGH, AND THE COUNT KEPT RISING ───────
//
//   All 80 scripts passed A, B and C on 2026-08-02 and the tree read green. In
//   the twenty-four hours after that, four more instruments were found unable to
//   fail — every one of them BY ACCIDENT, every one while somebody was chasing
//   an unrelated defect:
//
//     assert-drawin-pentip   its measuring disc gathered ink from NEIGHBOURING
//                            strokes (median 27.7 % foreign), and its per-playhead
//                            noise was 1.3-2.9x the entire effect it resolved
//     assert-pen-field row 5 tested carve = 0, an amplitude the shader
//                            short-circuits; never referenced PEN_CARVE_ENVELOPE_R,
//                            so 2.6 shipped for a day with every row green; and its
//                            subject was a raster every pixel of which is inside
//                            even a 1.0 R envelope, so NO value could fail it
//     assert-hero-option-panel  a hardcoded FOUR-film list against a SEVEN-film
//                            panel — two films shipped unwatched
//     assert-hero-transition silently judged a 3.8-DAY-OLD capture when run with
//                            no --label=, returning three confident RED rows that
//                            belonged to a different build
//
//   A, B and C ask *is this a gate*. None of them asks *can this gate fail*. Those
//   are different questions and the second is the one that was costing time. So
//   five more channels, each aimed at one member of the taxonomy those four
//   defects fall into:
//
//   D · SUBJECT     Move a constant the gate NAMES, in the module the gate LOADS,
//                   and require the gate to notice. A gate that survives every
//                   move to every constant it names is not measuring them. This
//                   is the only channel that settles the question by EXECUTION
//                   rather than by reading code, and it is therefore the strongest
//                   one here. The substitution happens inside `_ts-load.mjs`
//                   between reading the file and transpiling it — no source file
//                   is touched, which also makes it safe under concurrency.
//                   Catches: vacuous subject, unreachable branch, unguarded constant.
//
//   E · INVENTORY   A hand-written list of films/modes/rails that has stopped
//                   covering the closed set it mirrors. Static, and one-sided in
//                   the safe direction: a gate that never writes the word
//                   `procedural` is certainly not testing `procedural`.
//                   Catches: hardcoded inventory.
//
//   F · FRESHNESS   A STORED gate whose default label points at a capture OLDER
//                   than the code it grades. C already proves a stored gate
//                   refuses evidence that does not EXIST; it says nothing about
//                   evidence that exists and is three days stale, which is the
//                   defect that actually shipped.
//                   Catches: stale input.
//
//   G · SKIP        A run that prints a skip and still exits 0 under an all-pass
//                   summary. `verify-gates.mjs` once printed ALL GATES PASS with
//                   all four geometry gates skipped.
//                   Catches: skip counted as pass.
//
//   I · BARE        The invocation with NO arguments is the one the next person
//                   types, so it is the one that has to mean something. Found
//                   2026-08-03 on `assert-pentip-specks`: its author reported
//                   "9 rows, ALL PASS", and run bare it is RED — because it
//                   defaults to `--arm=t275 --arm2=t160` against a capture whose
//                   `free-stroke` reference was shot at the OLD tip shape, so the
//                   row silently compares the new taper against the shape it
//                   replaced. The capture is not stale and the assertion is not
//                   wrong; the ARM SELECTION is, so the gate answers a question
//                   nobody asked and prints red about it.
//
//                   That is its own class — call it WRONG DEFAULTS. It is
//                   adjacent to F (stale input) and to E (hardcoded inventory)
//                   and is neither: the evidence is fresh and the list is
//                   complete, but the two arms being compared are not the two the
//                   row is a claim about. Several gates here are only correct
//                   when invoked with arguments nobody has written down.
//
//                   D already runs every model gate bare. The bug was that a red
//                   bare run was filed as a SKIP — "cannot mutate what is already
//                   red" — and a skip is not a pass. It is now a row.
//
//   H · DIALS       Reported, not gated. A pen-field allocation bug cost days and
//                   was reachable ONLY by moving a control — a plain load-and-play
//                   never resizes the field, but the wobble slider and the
//                   endpoint pill both do. The battery loads and scrubs and never
//                   touches a dial. That is a coverage class, not an instrument
//                   class, so it is counted and named rather than failed.
//
//   WHAT NO CHANNEL HERE CATCHES, stated so it is not mistaken for a clean bill:
//   the NOISE class — a statistic whose spread swamps the effect it resolves
//   (assert-drawin-pentip's 1.3-2.9x). That needs the gate's own numbers and
//   their variance across repeats, which means running each gate many times and
//   knowing which printed number is the subject and which is the threshold.
//   Neither is available to a static sweep and the row formats are not uniform
//   enough to parse. The closest thing written here is D: a gate whose noise
//   swamps its subject will usually also survive a mutation of that subject, so
//   D catches the WORST of the noise cases without being able to name them as
//   noise. Section H's report is the other half of the honest answer — it says
//   which gates never vary their input at all, which is where noise hides.
//
// HOW A IS DECIDED — and why it is not a grep
//
//   Grepping for "PASS" finds the string in a dead function, in a comment, and
//   in a block gated off by a flag. All three of the real defects above would
//   have passed a grep. So the file is PARSED (the `typescript` devDependency is
//   already used for exactly this by `_ts-load.mjs`) and the question asked
//   structurally:
//
//     1. Find every DIRECT emission: a console.* call carrying the token PASS or
//        FAIL in a string or template.
//     2. Resolve HELPERS to a fixpoint: `say`, `check`, `judge` — a function
//        whose body emits is itself an emission when CALLED.
//     3. Walk the CALL GRAPH from the module's top level. A judgement inside a
//        function nothing calls is not reachable, and `bad-dead-judge.mjs` is the
//        control that proves this file can tell the difference.
//     4. Gate on FLAGS: a binding initialised from `has("x")` or
//        `arg("x", "")` is false on the default invocation, so anything in the
//        then-branch of an `if` on it is unreachable by default. The else-branch
//        is not: that is where `assert-joint-beading` keeps its capture.
//
//   Static analysis cannot prove reachability in general and this does not claim
//   to. What it can do is answer the one question this class of defect turns on —
//   is the judgement behind a flag, behind a call nobody makes, or thrown away at
//   the exit — and it is CALIBRATED against fixtures that carry each disease.
//
// CALIBRATION — the whole point, and it is not optional
//
//   `--calibrate` runs the analyser over `lib/gate-fixtures/`, seven files whose
//   verdict is fixed by their filename, five of them KNOWN BAD. It exits non-zero
//   unless every one comes out as named. An analyser that has never rejected
//   anything is the same disease it is looking for, one level up.
//
// Usage:
//   node scripts/verify/assert-gate-integrity.mjs --calibrate   # prove it can fail
//   node scripts/verify/assert-gate-integrity.mjs               # sweep all assert-*
//   node scripts/verify/assert-gate-integrity.mjs --no-probe    # skip C's dynamic half
//   node scripts/verify/assert-gate-integrity.mjs --no-mutate   # skip D (the slow one)
//   node scripts/verify/assert-gate-integrity.mjs --static      # A, B, E, J, K only
//   node scripts/verify/assert-gate-integrity.mjs --recite      # re-cite MOVED control lines (K)
//
//   K · CONTROL    Does the gate exercise a KNOWN-BAD on the bare invocation at
//                  all? J asks the narrow question — is a judgement behind a
//                  flag — and answers it from the syntax tree. The LAW
//                  (explainer 21 §7) is broader, and a gate can satisfy J
//                  perfectly while running no control anywhere. No AST can tell
//                  a control from a measurement, because the difference is
//                  whether the input is DELIBERATELY WRONG, which is a claim
//                  about intent — so the ruling is HUMAN, written down one entry
//                  per gate in `lib/control-manifest.json`, and what the machine
//                  owns is that the ruling cannot rot silently. See the channel
//                  itself for K1-K5.
//
//   J · WITHHELD    A judgement that is reachable ONLY with a flag, in a gate
//                   whose OTHER judgements run bare. A is satisfied, the row
//                   prints `gate`, the battery prints `pass`, and the arm the
//                   gate is advertised for was never executed by anything.
//
//                   Found 2026-08-07 on `assert-hero-dials`: `docs/README.md:198`
//                   calls it "every panel control, judged in the state it is
//                   SHOWN in", and its whole browser arm sits behind `--live`,
//                   which NEITHER battery runner passes. In the browser battery
//                   it ran 0.3 s, emitted 4 rows, and never opened Chrome
//                   (explainer 27 §2). Its own log says so — "MODEL ONLY — this
//                   run opened no browser" — and the scoreboard above it does
//                   not, which is the difference between an honest gate and an
//                   honest sweep.
//
//                   A IS NOT ENOUGH BECAUSE A IS SATISFIED BY ONE ROW. A gate can
//                   be PARTLY swept, and partly reads as green. J is A's
//                   complement, and the data was already here: `deadEmissions`
//                   has been computed on every sweep since this file was written
//                   and read only inside the "why each red row is red" block —
//                   i.e. only for gates that had already failed A. For every gate
//                   that PASSED, the list of judgements it withholds was thrown
//                   away unread.
//
//                   Three fixes are accepted, and the third is a schedule rather
//                   than an excuse: pass the flag from a runner (`EXTRA_ARGS` in
//                   `run-battery.mjs`, which this file IMPORTS rather than
//                   restates), remove the flag so the arm always runs, or add an
//                   ALLOW entry that says WHY and names WHAT DOES run it. An
//                   ALLOW entry claiming a runner passes the flag is CHECKED
//                   against that runner's table — an exemption that describes a
//                   sweep which does not happen is this channel's own defect one
//                   level up.
import ts from "typescript"
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join, relative } from "node:path"
import { enumerateMutants } from "./lib/mutants.mjs"
import { collectInventories, partialCoverage } from "./lib/inventories.mjs"
/* WHAT A VERDICT LOOKS LIKE lives in ONE file now, and both this gate and the
 * two battery runners read it from there. It used to live here as
 *     const EMIT_RE = /\bPASS\b|\bFAIL\b/
 * and, separately, in each runner as `/^\s*(?:\*\*\* )?(?:PASS|FAIL)\b/gm` —
 * two copies of one rule, carrying one identical hole: `\bFAIL\b` does not match
 * `FAILED`. See `lib/verdict-rows.mjs` for the measurement and the alphabet. */
import {
  carriesVerdict,
  countRows,
  countReds,
  assertReadersAgree,
  selftest as verdictSelftest,
} from "./lib/verdict-rows.mjs"
/* Channel J verifies its own exemptions against the sweep's REAL argument table
 * rather than against a sentence written here. `run-battery.mjs` is guarded by
 * `IS_MAIN`, so importing it runs no battery. */
/* …and `classify` for the same reason one level down: this file used to carry a
 * THIRD copy of the MODEL/BROWSER rule, as a raw-text regex, and used it to
 * decide what channels D, G and I skip. One implementation, three readers.
 * (Lane K's hunk 1, landed here 2026-08-07.) */
/* …and `discover` for the third time, which is the whole of F23b. See THE
 * INVENTORY below: this file used to answer "what is a gate?" with a flat
 * readdir while the battery answered it with a recursive walk, and one real gate
 * lived in the gap. */
import { EXTRA_ARGS, classify, classifySelfTest, discover, ROW_RE, FAIL_ROW_RE } from "./run-battery.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const VERIFY = join(ROOT, "scripts", "verify")
const FIXTURES = join(VERIFY, "lib", "gate-fixtures")
const has = (k) => process.argv.includes(`--${k}`)
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : d
}
const CALIBRATE = has("calibrate")
const STATIC_ONLY = has("static")
const NO_PROBE = has("no-probe") || STATIC_ONLY
const NO_MUTATE = has("no-mutate") || STATIC_ONLY
/* Mutants per gate. The sweep is a regression tool, so it has to stay runnable;
 * the cap is REPORTED per row rather than hidden, because "we tested 8 of 34
 * constants" and "we tested all of them" are different claims. */
const MUTANT_CAP = Number(arg("mutants", "10"))
const MUT_JSON = join(ROOT, "docs", "verification", "gate-integrity", ".mutant.json")

/* A label no capture will ever have written. The C-channel probe points a
 * stored-evidence assert at it and requires the script to refuse. */
const MISSING_LABEL = "__gate_integrity_missing__"

/* ═══════════════════════════════════════════════════════════════════════════
 * THE INVENTORY · ONE TABLE, AND THIS FILE WAS THE THIRD READER
 *
 * Until 2026-08-28 this file answered "what is a gate?" with a FLAT
 * `readdirSync(VERIFY)` and `run-battery.mjs` answered it with a recursive walk
 * of the repo. Measured by lanes N4 and N7: the battery found 102 `assert-*`
 * scripts, this file found 101, and the one in the gap was
 * `docs/storyboard/tools/assert-moment.mjs`, a gate with four synthetic
 * negative controls, run by both batteries, visible to no integrity channel.
 *
 * ⚠ THAT IS THE DEFECT THE BATTERY'S OWN HEADER RECORDS CLOSING. A scoping line
 * nobody updated left the same file in no sweep at all for a week; the fix
 * widened one reader and left the other stating the scope in its own words, so
 * the defect MOVED instead of closing. A gate this file cannot see is a gate it
 * cannot rule uncontrolled, which is the meta-gate's whole job.
 *
 * So the scope is IMPORTED, never restated. Two deliberate differences remain,
 * and both are about EXECUTION rather than about what counts as a gate:
 *
 *   · `discover()` EXCLUDES this file, because running the meta-gate from
 *     inside a battery of the gates it spawns is a fork bomb. That is a rule
 *     about what a BATTERY may run. Channel K rules on gates, and a meta-gate
 *     that exempts itself from its own manifest is exactly the shape it exists
 *     to catch, so it is added back here, once, by name.
 *   · The manifest is keyed by BASENAME and stays that way. Two gates sharing a
 *     basename would therefore share one ruling, and the second would be graded
 *     by an entry written about the first with nothing saying so. That is a
 *     silent collision, so it THROWS rather than letting a Map overwrite decide.
 * ═══════════════════════════════════════════════════════════════════════════ */
const SELF = "assert-gate-integrity.mjs"

function gateInventory() {
  const paths = new Map()
  for (const p of discover()) {
    const base = p.split("/").pop()
    const seen = paths.get(base)
    if (seen) {
      throw new Error(
        `two gates share the basename ${base}:\n  ${relative(ROOT, seen)}\n  ${relative(ROOT, p)}\n` +
          `The control manifest is keyed by basename, so one ruling would silently cover both and the ` +
          `second would be graded by an entry written about the first. Rename one.`,
      )
    }
    paths.set(base, p)
  }
  paths.set(SELF, join(VERIFY, SELF))
  return { names: [...paths.keys()].sort(), paths }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE CITED TOKEN IS EXECUTABLE TEXT, NOT PROSE, AND THE PARSER SAYS WHICH
 *
 * Channel K's token lookup runs over a copy of the gate with every COMMENT
 * blanked and every line number kept. Without that, token-primary lookup is a
 * regression on the thing K is for: the entry claims a real negative control
 * exists at that site, and a header paragraph SAYING there is one satisfies a
 * raw-text search perfectly. Measured across the 99 cited entries, four gates
 * carry their cited phrase in BOTH a header comment and the control itself
 * (`assert-hero-rise` :15 and :114, `assert-hero-windup` :25 and :277, and two
 * more), so a first-hit-wins search would have cited prose in four places.
 *
 * 🔴 AND IT FOUND ONE ALREADY WRONG. This file's own entry cited :897, a
 * paragraph ABOUT the control, while the control itself, `failed +=
 * calibrate()`, is at :1994. It passed K3 for three weeks. Same class as
 * `assert-flat-silhouette` citing a threshold scaler: a citation can sit on its
 * line and still not be a control.
 *
 * WHY THE PARSER AND NOT A REGEX. A hand-rolled comment stripper gets `"a //
 * not a comment"` and `/["']/` wrong in opposite directions, and a stripper
 * that reads a regex literal as a string mask can blank a real line of code:
 * a FALSE RED in the one channel that must never cry wolf. `analyse()` already
 * parses every one of these files with `ts.createSourceFile`; this reads the
 * same tree. Comments are trivia and are never leaf tokens, so the union of the
 * leaf spans IS the executable text, by construction rather than by pattern.
 * Measured: 99 entries in 301 ms, and the whole set resolves 96 unique · 2
 * ambiguous · 1 with no code hit at all.
 * ═══════════════════════════════════════════════════════════════════════════ */
function codeLinesOf(src) {
  const sf = ts.createSourceFile("gate.mjs", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const out = src.split("").map((c) => (c === "\n" ? "\n" : " "))
  const keep = (node) => {
    const kids = node.getChildren(sf)
    if (!kids.length) {
      for (let i = node.getStart(sf), end = node.getEnd(); i < end; i++) out[i] = src[i]
      return
    }
    for (const k of kids) keep(k)
  }
  keep(sf)
  return out.join("").split("\n")
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CHANNEL L's SUBJECT · THE INSTRUMENTS THAT ARE NOT GATES
 *
 * K asks whether every GATE can say no. L asks the same question one step out.
 * This repo also carries instruments that are not `assert-*` and should not
 * become `assert-*`, and on 2026-08-28 three of them landed already carrying
 * known-answer self-tests: `lib/frame-guard.mjs --selftest` (24 PASS, 0 FAIL),
 * `sweep-browsers.mjs --selftest` (11 controls, 5 of them known-bad) and
 * `refs-capture.mjs --selftest` (a known-bad URL and a known-good one). Not one
 * of them was in any sweep.
 *
 * 🔴 AND NO LANE WAS WRONG TO LEAVE THEM OUT. K1 makes a new `assert-*` file
 * default RED, so the only way in was to write a manifest entry at the same
 * time, which means F22, open, was actively pushing new controls OUT of the
 * sweep. An instrument in no sweep is a green nobody reads;
 * `run-battery.mjs`'s header says it about the same defect one directory over:
 * "a gate nobody runs cannot fail in practice, whatever the meta-gate says
 * about it in principle."
 *
 * WHY NOT RENAME THEM TO `assert-*`. The prefixes mean different things here
 * and the difference is load-bearing: some 200 `_probe-*` files are hand-run
 * diagnostics, and a rename that blurs the two argues the other 199 should be
 * renamed too. `lib/frame-guard.mjs` is a LIBRARY, and calling it a gate would be
 * a claim about what it is, made to satisfy a readdir.
 *
 * WHY NOT A LIST OF NAMES. A registry rots the day something arrives and nobody
 * adds it, which is this file's own defect rebuilt one level up. So the set is
 * DERIVED: any `.mjs` under `scripts/verify` that is not an `assert-*` gate and
 * PARSES a `--selftest` flag. An instrument that adopts the convention joins on
 * its own, with no edit here.
 *
 * ⚠ AND ZERO IS A FAILURE, not a clean sweep. If this predicate ever stops
 * matching, L finds nothing and reports nothing, which reads exactly like every
 * instrument being sound. That is the shape of every defect in this file's
 * header, so an empty result is red. */
const L_SKIP = new Set(["node_modules", "gate-fixtures", "verification", ".next", ".git"])

/** Does this source ANSWER to `--selftest`, or only talk about it?
 *
 *  The flag and `argv` on ONE LINE. `lib/verdict-rows.mjs` names `--selftest` in
 *  a comment and would otherwise be spawned with a flag it has never heard of,
 *  exit 0 having done nothing, and be counted sound. Pure, so `--calibrate` can
 *  hand it both answers. */
export const parsesSelftest = (src) =>
  String(src).split("\n").some((l) => l.includes("--selftest") && l.includes("argv"))

/** L's verdict on one self-test run. Pure for the same reason.
 *
 *  ZERO ROWS IS A FAILURE and that is not pedantry: a self-test that asserted
 *  nothing exits 0 and prints nothing, which is indistinguishable from one where
 *  every arm passed. It is the first entry in this file's own taxonomy. */
export function judgeSelftest(status, out) {
  const rows = countRows(out)
  const reds = countReds(out)
  if (rows === 0) return { ok: false, rows, reds, why: `exit ${status} and NOT ONE verdict row. This self-test asserts nothing.` }
  if (status !== 0) return { ok: false, rows, reds, why: `${rows} row(s), ${reds} red, exit ${status}` }
  return { ok: true, rows, reds, why: `${rows} row(s), ${reds} red, exit ${status}` }
}

function selftestInstruments(root = VERIFY) {
  const found = []
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!L_SKIP.has(e.name)) walk(join(dir, e.name))
        continue
      }
      if (!e.name.endsWith(".mjs") || e.name.startsWith("assert-")) continue
      const p = join(dir, e.name)
      let src
      try {
        src = readFileSync(p, "utf8")
      } catch {
        continue
      }
      if (parsesSelftest(src)) found.push(p)
    }
  }
  walk(root)
  return found.sort()
}

/** The reader channel K and `--recite` share: `{ raw, code }` for a gate, or
 *  null if it cannot be read. Memoised, because the sweep asks for the same handful of
 *  files from four places and a parse is 3 ms. */
function makeGateReader(paths) {
  const cache = new Map()
  return (g) => {
    if (cache.has(g)) return cache.get(g)
    let out = null
    try {
      const src = readFileSync(paths?.get(g) ?? join(VERIFY, g), "utf8")
      out = { raw: src.split("\n"), code: codeLinesOf(src) }
    } catch {
      out = null
    }
    cache.set(g, out)
    return out
  }
}

/* ── CHANNEL J's EXEMPTION LIST ────────────────────────────────────────────
 *
 * WHY THERE IS ONE AT ALL, stated plainly: a gate with no exemption mechanism
 * gets DISABLED the first time it is wrong. This channel will be wrong — a
 * `--save` arm that rewrites a baseline genuinely must not run on every sweep,
 * and a channel that fails such a gate with no way to say so teaches the next
 * person to comment the channel out. Then A, B, C, D, E, F, G and I stop running
 * too, because they live in the same file. The exemption list is not the soft
 * part of this gate; it is the part that keeps the gate alive.
 *
 * WHAT AN ENTRY COSTS, deliberately: a sentence saying WHY the arm is not on the
 * default path, and a sentence naming WHAT DOES run it. "It is slow" is not a
 * reason on its own — every browser gate is slow and they all run. The question
 * an entry has to answer is why running it in the sweep would be WRONG, not why
 * it would be inconvenient.
 *
 * `runner: true` means the claim is "a battery passes this flag", and that claim
 * is CHECKED against `EXTRA_ARGS` — never against the `sweptBy` sentence. An
 * exemption describing a sweep that does not happen is precisely the defect this
 * channel exists to find, one level up, and it is the shape a stale exemption
 * takes: the runner entry gets deleted, the exemption stays, and the gate goes
 * quiet about an arm nothing runs.
 *
 * EVERY ENTRY PRINTS ON EVERY RUN. A list nobody reads is a list that rots. */
const ALLOW = {
  /* ── THE THREE RATCHET RECORDERS ──────────────────────────────────────────
   * `--record` on these three is a MAINTENANCE WRITER, not a judgement arm. Each
   * one REFUSES on a red run ("recording a baseline during a red run
   * grandfathers whatever made it red") and refuses again unless the measurement
   * LOWERS the baseline ("a ratchet that can be raised is a debt counter"). A
   * sweep that passed it would write a baseline on every run, which is the
   * opposite of what a ratchet is for. Added 2026-09-04 with the numbers each
   * one's own refusal prints. */
  "assert-citations.mjs": {
    "--record": {
      why: "writes `citation-baseline.json` and REFUSES unless every non-ratchet channel is green AND the measurement falls. Sweeping it would re-baseline the rot on every run.",
      sweptBy: "run BY HAND after a lane lowers a count. The judged arms all run bare — the ratchet row itself is the bare verdict, and it caught uncheckable 44 -> 45 on 2026-09-04.",
    },
  },
  "assert-one-browser.mjs": {
    "--record": {
      why: "same recorder shape: refuses on any red channel, refuses to RAISE, then writes the baseline. Not a judgement.",
      sweptBy: "run by hand when a count is lowered. Every judged channel runs on the bare invocation.",
    },
  },
  "assert-one-knob.mjs": {
    "--record": {
      why: "same recorder shape, same two refusals, same baseline write.",
      sweptBy: "run by hand when a count is lowered. Every judged channel runs bare.",
    },
  },
  /* ── AND ONE DELIBERATE, PRINTED SKIP ─────────────────────────────────────
   * `--no-http` exists so the gate still runs in a battery with NO SERVER, and
   * its own comment says why the skip is printed rather than silent: "a silent
   * skip is how `verify-gates` once reported ALL PASS with every geometry gate
   * skipped." A sweep must NOT pass it, because the sweep has a server and the
   * bare arm is the fuller one. The flag makes the gate weaker on purpose. */
  /* ── AND THIS FILE'S OWN SPEED FLAG, held to the same rule ────────────────
   * `--static` is `--no-probe --no-mutate` in one word. It makes THIS gate
   * weaker on purpose so a quick structural pass is cheap, and it says so on
   * every line it skips: "NOT RUN (--static). A SKIP IS NOT A PASS." Exempting
   * my own gate from a channel my own gate enforces would be the exact shape
   * this file exists to catch, so the entry says the same thing the other four
   * say and points at the same bare arm. */
  "assert-gate-integrity.mjs": {
    "--static": {
      why: "sets NO_PROBE and NO_MUTATE together, so channels C and the mutation sweep do not run and channel L prints `NOT RUN (--static). A SKIP IS NOT A PASS.` per file. It is a speed flag, not a judgement.",
      sweptBy: "NOT passed by any sweep, correctly. The bare invocation runs the probes, the mutants and the self-tests, and that is the arm every verdict in this repo rests on.",
    },
  },
  "assert-tsc-baseline.mjs": {
    "--no-http": {
      why: "drops the route channel so the gate can run with no server, and prints `unsweptRow` saying so. The bare arm checks BOTH the typecheck and the routes.",
      sweptBy: "NOT passed by any sweep, correctly. The sweep runs bare with a server up, which is the stronger arm. The flag is for a serverless run by hand.",
    },
  },
  "assert-joint-beading.mjs": {
    "--compare=": {
      why: "`compare(a, b)` grades TWO named capture runs against each other and refuses (`:691`) when either directory is absent. There is no bare invocation of it — a sweep cannot invent the pair, and the two labels encode which intervention is being compared, which is a question only the person running it has. This is an alternate SUBJECT selected by argument, not the same subject with its judgement withheld.",
      sweptBy: "run by hand with the two labels, when a beading intervention is being judged. The DEFAULT arm — `capture(LABEL)` then judge, `:697` — runs bare in the browser battery and emitted 25 rows there on 2026-08-07.",
    },
    "--holdsteady=": {
      why: "same shape: `holdSteady(a, b)` needs two existing capture directories and refuses without them (`:684`). Requiring it bare would make the gate red for the absence of evidence nobody asked it to have.",
      sweptBy: "run by hand with the two labels. The default judged arm runs bare in the browser battery.",
    },
  },
}

/** Does a sweep actually pass this flag to this gate? Read off the runners' own
 *  table, never off the ALLOW sentence that claims it. */
function sweepPasses(file, flagKey) {
  const args = EXTRA_ARGS[file] ?? []
  return flagKey
    .split(" ")
    .filter(Boolean)
    .every((f) => args.some((a) => a === f || a.startsWith(f)))
}

/** DOES THE GATE PASS ITS OWN FLAG? — proposed and prototyped by lane I, landed
 *  here 2026-08-07.
 *
 *  Channel J asks "does any sweep pass this flag", and answers it from
 *  `EXTRA_ARGS`, the runners' table. It cannot see the case where the thing that
 *  passes the flag is THE GATE ITSELF: a bare run that spawns
 *  `node <this file> --mutate=<k>` once per control and turns each child's exit
 *  code into a row. That is the shape `assert-hero-transition.mjs` now has, and
 *  J still reported it — correctly, by its own rule, because the
 *  inverted-verdict block the children execute IS still guarded by the flag. It
 *  has to be. That block is the control.
 *
 *  ★ WHY THIS IS NOT AN ALLOW ENTRY, WHICH IS THE PART WORTH KEEPING (lane I):
 *  an exemption says *"nothing runs this, and here is why that is right."* This
 *  is the opposite — something DOES run it, on every bare invocation. Writing it
 *  down as an exemption would park a true statement in a list whose whole job is
 *  to hold statements that must be re-argued, and it would go stale the moment
 *  the self-spawn was removed, silently, which is the property every defect in
 *  explainer 21 shares.
 *
 *  Deliberately narrow: the call must re-invoke THIS file (by `__filename` /
 *  `import.meta.url` / `fileURLToPath`) and mention every flag in the key. A
 *  gate spawning some OTHER script with `--mutate=` is not running its own
 *  control and must stay red. */
function collectSelfSpawns(sf) {
  const out = []
  const visit = (n) => {
    if (ts.isCallExpression(n) && /\b(spawnSync|spawn|execFileSync|execFile)$/.test(txt(n.expression))) {
      const argv = n.arguments[1]
      if (argv && ts.isArrayLiteralExpression(argv)) {
        const t = argv.elements.map((e) => txt(e)).join(" ")
        if (/THIS_FILE|__filename|import\.meta\.url|fileURLToPath/.test(t)) out.push(t)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

/** …and does one of those self-spawns carry every flag in this key? */
function selfSweeps(selfSpawnArgv, flagKey) {
  const flags = flagKey.split(" ").filter(Boolean)
  if (!flags.length) return false
  return selfSpawnArgv.some((t) => flags.every((f) => t.includes(f.replace(/=$/, ""))))
}

/* ------------------------------------------------------------------------- *
 * PARSE
 * ------------------------------------------------------------------------- */

const txt = (n) => (n ? n.getText() : "")

/** Is this a `console.*` call? */
function isConsoleCall(n) {
  if (!ts.isCallExpression(n)) return false
  const e = n.expression
  return ts.isPropertyAccessExpression(e) && txt(e.expression) === "console"
}

/** Does any string/template inside this node carry a PASS/FAIL token? */
function carriesVerdictToken(n) {
  let found = false
  const walk = (x) => {
    if (found) return
    if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) {
      if (carriesVerdict(x.text)) found = true
      return
    }
    if (ts.isTemplateExpression(x)) {
      if (carriesVerdict(x.head.text)) found = true
      for (const s of x.templateSpans) if (carriesVerdict(s.literal.text)) found = true
    }
    ts.forEachChild(x, walk)
  }
  walk(n)
  return found
}

/** Named function-likes, at ANY scope, keyed by name. Single-module scripts, so
 *  a name collision across scopes would be a bug in the script itself. */
function collectFunctions(sf) {
  const out = new Map()
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) out.set(n.name.text, n)
    if (
      ts.isVariableDeclaration(n) &&
      n.name &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
    ) {
      out.set(n.name.text, n.initializer)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

/** Bindings that are FALSE / empty on the default invocation. */
function collectFalsyFlags(sf) {
  const flags = new Set()
  const falsyInit = (init) => {
    if (!init) return false
    if (ts.isParenthesizedExpression(init)) return falsyInit(init.expression)
    /* A flag defined in terms of an EARLIER flag is still a flag. Found by
     * running this file against `assert-layer-flicker.mjs`, which declares
     *   const CALIBRATE = has("calibrate") || GUARD_ONLY
     * Without this line CALIBRATE was not recognised, its whole calibration
     * block read as default-reachable, and the analyser reported that script as
     * a gate — the exact false green it exists to find, in its own output. */
    if (ts.isIdentifier(init)) return flags.has(init.text)
    /* An empty string literal is falsy. Needed for the `?? ""` tail below, and
     * it makes the existing `||` rule work on `SOMETHING || ""`. */
    if ((ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) && init.text === "") return true
    /* ⚠ THE HAND-ROLLED `arg()` — A THIRD WAY TO BE BLIND, found 2026-08-07 by
     * running this channel against `assert-drawin-2d-parity.mjs:85`:
     *
     *   const CONTROL = (process.argv.find((a) => a.startsWith("--control=")) ?? "").split("=")[1] ?? ""
     *
     * That is `arg("control", "")` written out longhand, and because it is not
     * the repo's helper, `CONTROL` never joined the falsy-flag set — so
     * `if (CONTROL) { …the whole negative control… }` read as reachable by
     * default and channel J said nothing about a gate whose control is entirely
     * behind `--control=`. Same defect as the `===` one below, from the other
     * direction: the analyser knew one spelling of an idiom and the repo has
     * three.
     *
     * The test is deliberately narrow — the initialiser must READ `process.argv`
     * and must DEFAULT to an empty string via `??`/`||`. A binding that reads
     * argv and defaults to something non-empty is not empty on a bare run, and
     * treating it as one would mark real default paths as withheld. */
    if (ts.isBinaryExpression(init)) {
      const k = init.operatorToken.kind
      if (k === ts.SyntaxKind.QuestionQuestionToken || k === ts.SyntaxKind.BarBarToken) {
        const right = init.right
        const emptyDefault =
          (ts.isStringLiteral(right) || ts.isNoSubstitutionTemplateLiteral(right)) && right.text === ""
        if (emptyDefault && /process\s*\.\s*argv/.test(txt(init.left))) return true
      }
    }
    if (ts.isCallExpression(init)) {
      const callee = txt(init.expression)
      /* has("x") — the repo's own idiom for a boolean CLI flag.
       *
       * ⚠ THE PATTERN USED TO BE `/(^|\.)has$/` AND IT MATCHED ANY `.has(…)`.
       * Found 2026-08-07 by channel J, on `assert-mode-rims.mjs:811`:
       *     const corners = HAS_DRAWN_CORNERS.has(key)
       * A Set membership test on a data table was read as a command-line flag,
       * so `corners` joined the falsy-flag set and every judgement under
       * `if (corners)` was scored as blocked-by-default. That is a wrong answer
       * in the DANGEROUS direction for A and B as well as J: an inflated flag set
       * makes real rows look unreachable, and this file's whole job is to know
       * which rows a bare run reaches. The repo's helper is a bare `has(…)`
       * identifier call; a property access is somebody's Map or Set. */
      if (/^has$/.test(callee)) return true
      // process.argv.includes("--x")
      if (/process\.argv\.includes/.test(callee)) return true
      // arg("k", <falsy default>) — a string option nobody passed
      if (/^arg$/.test(callee)) {
        const d = init.arguments[1]
        if (!d) return true
        if (ts.isStringLiteral(d) && d.text === "") return true
        if (d.kind === ts.SyntaxKind.NullKeyword) return true
        if (ts.isIdentifier(d) && d.text === "undefined") return true
        if (d.kind === ts.SyntaxKind.FalseKeyword) return true
        if (ts.isNumericLiteral(d) && Number(d.text) === 0) return true
        return false
      }
      return false
    }
    if (ts.isBinaryExpression(init)) {
      const k = init.operatorToken.kind
      if (k === ts.SyntaxKind.BarBarToken) return falsyInit(init.left) && falsyInit(init.right)
      if (k === ts.SyntaxKind.AmpersandAmpersandToken) return falsyInit(init.left) || falsyInit(init.right)
    }
    return false
  }
  /* WHICH CLI FLAG a binding came from — channel J has to NAME the flag, not
   * just know that one exists. "a row behind a flag" is unactionable; "a row
   * behind `--live`, which no runner passes" is a fix. Same recursion as
   * `falsyInit`, reading the string instead of the truth value; a binding
   * defined off an earlier flag inherits that flag's name. */
  const cli = new Map()
  const cliNameOf = (init) => {
    if (!init) return null
    if (ts.isParenthesizedExpression(init)) return cliNameOf(init.expression)
    if (ts.isIdentifier(init)) return cli.get(init.text) ?? null
    if (ts.isCallExpression(init)) {
      const callee = txt(init.expression)
      const a0 = init.arguments[0]
      if (!a0 || !ts.isStringLiteral(a0)) return null
      if (/^has$/.test(callee)) return "--" + a0.text
      if (/process\.argv\.includes/.test(callee)) return a0.text
      if (/^arg$/.test(callee)) return "--" + a0.text + "="
      return null
    }
    if (ts.isBinaryExpression(init)) {
      return cliNameOf(init.left) ?? cliNameOf(init.right)
    }
    /* …and for the hand-rolled form, the flag's name is the `--x=` literal
     * somewhere inside the argv expression. Read it out so J can NAME the flag —
     * "a row behind a flag" is unactionable, "a row behind `--control=`" is a fix. */
    const t = txt(init)
    if (/process\s*\.\s*argv/.test(t)) {
      const m = t.match(/["'](--[\w-]+=?)["']/)
      if (m) return m[1]
    }
    return null
  }
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && falsyInit(n.initializer)) {
      flags.add(n.name.text)
      const name = cliNameOf(n.initializer)
      if (name) cli.set(n.name.text, name)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return { flags, cli }
}

/** Is this condition FALSE on the default invocation? */
function condFalsyByDefault(expr, flags) {
  if (!expr) return false
  if (ts.isParenthesizedExpression(expr)) return condFalsyByDefault(expr.expression, flags)
  if (ts.isIdentifier(expr)) return flags.has(expr.text)
  if (ts.isCallExpression(expr)) {
    const callee = txt(expr.expression)
    if (/^has$/.test(callee)) return true
    if (/process\.argv\.includes/.test(callee)) return true
    return false
  }
  if (ts.isBinaryExpression(expr)) {
    const k = expr.operatorToken.kind
    if (k === ts.SyntaxKind.AmpersandAmpersandToken) {
      return condFalsyByDefault(expr.left, flags) || condFalsyByDefault(expr.right, flags)
    }
    if (k === ts.SyntaxKind.BarBarToken) {
      return condFalsyByDefault(expr.left, flags) && condFalsyByDefault(expr.right, flags)
    }
    /* ⚠ `FLAG === "prior"` — THE COMMONEST WAY A CONTROL IS WITHHELD IN THIS
     * REPO, AND THIS FUNCTION COULD NOT SEE IT. Measured 2026-08-07 across the
     * 19 gates that run no control on a bare invocation: most select WHICH
     * known-bad to arm by comparing a string flag against a literal —
     *
     *     const MUTATE = arg("mutate", "")        // "" on a bare run
     *     if (MUTATE === "prior") { …the control… }
     *
     * The `===` fell through to `return false`, so the whole control block read
     * as reachable by default and channel J reported nothing. The old code
     * handled a BARE `if (MUTATE)` and nothing else, which is why the two gates
     * J did see are the two that happen to write it that way.
     *
     * Sound because the comparison is decided at the DEFAULT value: `arg` with
     * an empty-string default returns `""`, and `"" === "prior"` is false. Both
     * directions are handled, and the safe one matters as much as the other:
     *   · `FLAG === "x"`  (x non-empty) -> FALSE by default -> blocked
     *   · `FLAG !== "x"`                -> TRUE  by default -> NOT blocked
     *   · `FLAG === ""`                 -> TRUE  by default -> NOT blocked
     * Getting that last one wrong would mark a gate's DEFAULT path as withheld,
     * which is the wolf-crying this file's header says gets a meta-gate switched
     * off. */
    const EQ = k === ts.SyntaxKind.EqualsEqualsEqualsToken || k === ts.SyntaxKind.EqualsEqualsToken
    const NE = k === ts.SyntaxKind.ExclamationEqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsToken
    if (EQ || NE) {
      const sides = [
        [expr.left, expr.right],
        [expr.right, expr.left],
      ]
      for (const [a, b] of sides) {
        if (!ts.isIdentifier(a) || !flags.has(a.text)) continue
        if (!ts.isStringLiteral(b) && !ts.isNoSubstitutionTemplateLiteral(b)) continue
        const nonEmpty = b.text.length > 0
        // `FLAG === "x"` is false by default iff x is non-empty; `!==` is its inverse.
        return EQ ? nonEmpty : !nonEmpty
      }
    }
  }
  return false
}

/** Is this function-like reachable by NAME — a declaration, or an arrow bound to
 *  a variable? An anonymous callback is not; it is part of whatever encloses it. */
function isNamedFn(p) {
  if (ts.isFunctionDeclaration(p) && p.name) return true
  if (
    (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
    p.parent &&
    ts.isVariableDeclaration(p.parent) &&
    p.parent.initializer === p &&
    ts.isIdentifier(p.parent.name)
  ) {
    return true
  }
  return false
}

/** The enclosing NAMED function-like of a node, or null for module scope.
 *
 * ANONYMOUS CALLBACKS ARE TRANSPARENT, and that is not a shortcut — it is the
 * fix for a false red this file produced on its own subject. `assert-joint-
 * beading` ends with
 *   capture(LABEL).then(() => { process.exit(judge(LABEL) === 0 ? 0 : 1) })
 * and the first version treated that arrow as its own scope, so the call to
 * `judge` belonged to a function nothing calls, `judge` came out unreachable,
 * and a script that had just been fixed was still reported as not-a-gate. A
 * callback is executed by whatever creates it; attributing it to the nearest
 * named enclosing scope is both simpler and correct. */
function ownerFn(n) {
  let p = n.parent
  while (p) {
    if (isNamedFn(p)) return p
    p = p.parent
  }
  return null
}

/** Walk up to `stop`, collecting the branch conditions this node sits under. */
function guardsUpTo(n, stop, flags) {
  const guards = []
  let child = n
  let p = n.parent
  while (p && p !== stop) {
    if (ts.isIfStatement(p)) {
      if (p.thenStatement === child) guards.push({ expr: p.expression, negated: false })
      else if (p.elseStatement === child) guards.push({ expr: p.expression, negated: true })
    } else if (ts.isConditionalExpression(p)) {
      if (p.whenTrue === child) guards.push({ expr: p.condition, negated: false })
      else if (p.whenFalse === child) guards.push({ expr: p.condition, negated: true })
    } else if (ts.isBinaryExpression(p) && p.right === child) {
      const k = p.operatorToken.kind
      if (k === ts.SyntaxKind.AmpersandAmpersandToken) guards.push({ expr: p.left, negated: false })
      if (k === ts.SyntaxKind.BarBarToken) guards.push({ expr: p.left, negated: true })
    }
    child = p
    p = p.parent
  }
  // Blocked when a POSITIVE branch depends on a flag that is off by default.
  // A negative branch is not blocked: `if (--flag) {…} else { the default }` is
  // exactly where assert-joint-beading keeps its capture, and that path RUNS.
  const blocked = guards.some((g) => !g.negated && condFalsyByDefault(g.expr, flags))
  /* WHICH flag bindings do the blocking — channel J names them. Collected from
   * the blocking guards only, so an unrelated flag mentioned in a passing guard
   * does not get the blame. */
  const blockedBy = []
  for (const g of guards) {
    if (g.negated || !condFalsyByDefault(g.expr, flags)) continue
    const walk = (n) => {
      if (ts.isIdentifier(n) && flags.has(n.text)) blockedBy.push(n.text)
      ts.forEachChild(n, walk)
    }
    walk(g.expr)
  }
  return {
    blocked,
    blockedBy: [...new Set(blockedBy)],
    guards: guards.map((g) => (g.negated ? "!" : "") + txt(g.expr).slice(0, 60)),
  }
}

/** Is this node inside a `.catch(…)` HANDLER or a `catch {}` clause?
 *
 * The child has to be tracked. `capture().then(judge).catch(crash)` puts the
 * `.then` callback inside the `.catch` call's RECEIVER, not its argument, and a
 * receiver-blind version marked the judging `process.exit` as a crash handler —
 * the second false red this file produced on assert-joint-beading. */
function insideCatch(n) {
  let child = n
  let p = n.parent
  while (p) {
    if (ts.isCatchClause(p)) return true
    if (
      ts.isCallExpression(p) &&
      ts.isPropertyAccessExpression(p.expression) &&
      p.expression.name.text === "catch" &&
      p.arguments.some((a) => a === child)
    ) {
      return true
    }
    child = p
    p = p.parent
  }
  return false
}

function analyse(file) {
  const src = readFileSync(file, "utf8")
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS)
  const funcs = collectFunctions(sf)
  const { flags, cli } = collectFalsyFlags(sf)
  const byNode = new Map()
  for (const [name, node] of funcs) byNode.set(node, name)

  /* Per owner (function node, or null for module): what it emits, what it calls,
   * where it exits, and what evidence it touches. */
  const info = new Map() // owner node|null -> {emits:[], calls:[], refs:[], exits:[], live:[], stored:[]}
  const slot = (owner) => {
    if (!info.has(owner)) {
      info.set(owner, { emits: [], calls: [], refs: [], exits: [], live: [], stored: [] })
    }
    return info.get(owner)
  }
  slot(null)
  for (const node of funcs.values()) slot(node)

  const LIVE_RE = /^(chromium|firefox|webkit)\.launch$|(^|\.)loadTs$/
  const STORED_RE = /(^|\.)(readFileSync|readdirSync|loadImage)$/

  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const owner = ownerFn(n)
      const s = slot(owner)
      const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
      const g = guardsUpTo(n, owner ?? sf, flags)
      const callee = txt(n.expression)
      if (isConsoleCall(n) && carriesVerdictToken(n)) {
        s.emits.push({ line, blocked: g.blocked, blockedBy: g.blockedBy, guards: g.guards, direct: true })
      }
      if (ts.isIdentifier(n.expression) && funcs.has(n.expression.text)) {
        s.calls.push({
          name: n.expression.text,
          line,
          blocked: g.blocked,
          blockedBy: g.blockedBy,
          guards: g.guards,
          /* The ARGUMENTS, normalised — channel J needs to tell a blocked call
           * that duplicates work already done from a blocked call that is its
           * own distinct row. See the `sameWorkRunsAnyway` note below. */
          args: n.arguments.map((a) => txt(a).replace(/\s+/g, " ")).join(", ").slice(0, 200),
        })
      }
      if (/^process\.exit$/.test(callee)) {
        const a = n.arguments[0]
        const literalZero = a && ts.isNumericLiteral(a) && Number(a.text) === 0
        s.exits.push({
          line,
          blocked: g.blocked,
          /* Channel J reads these too, and it has to NAME the flag — see the
           * exit-derived arm in the `withheld` block below. */
          blockedBy: g.blockedBy,
          guards: g.guards,
          inCatch: insideCatch(n),
          failureCapable: !literalZero,
          code: a ? txt(a).slice(0, 40) : "0",
        })
      }
      if (LIVE_RE.test(callee)) s.live.push({ callee, line, blocked: g.blocked })
      if (STORED_RE.test(callee)) s.stored.push({ callee, line, blocked: g.blocked })
    }
    /* A function used as a VALUE may be called through a table this analyser
     * cannot follow. Found by running the sweep: `assert-material-craft.mjs`
     * dispatches with
     *   const run = { presets, dials, matanim, fusion, stack, timing }
     *   await (run[PHASE] || presets)()
     * and the first version reported it "no-verdict" because it saw no direct
     * call to anything that emits. That was a FALSE POSITIVE, and a meta-gate
     * that cries wolf gets switched off. So a value reference counts as a
     * possible call — conservative in the direction that keeps this file honest.
     * The two real defects survive it: `compare`/`holdSteady` in
     * assert-joint-beading are only ever named as callees inside flag-gated
     * branches, and `bad-dead-judge`'s judge is never named at all. */
    if (ts.isIdentifier(n) && funcs.has(n.text)) {
      const p = n.parent
      const isCallee = p && ts.isCallExpression(p) && p.expression === n
      const isDeclName =
        p &&
        ((ts.isVariableDeclaration(p) && p.name === n) ||
          (ts.isFunctionDeclaration(p) && p.name === n) ||
          (ts.isPropertyAssignment(p) && p.name === n) ||
          ts.isPropertyAccessExpression(p))
      if (!isCallee && !isDeclName) {
        const owner = ownerFn(n)
        const g = guardsUpTo(n, owner ?? sf, flags)
        slot(owner).refs.push({
          name: n.text,
          line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
          blocked: g.blocked,
          blockedBy: g.blockedBy,
          guards: g.guards,
        })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)

  /* ---- reachability from the module's top level ------------------------ */
  const reachable = new Set([null])
  for (let pass = 0; pass < 12; pass++) {
    let grew = false
    for (const owner of [...reachable]) {
      const s = slot(owner)
      for (const c of [...s.calls, ...s.refs]) {
        if (c.blocked) continue
        const target = funcs.get(c.name)
        if (target && !reachable.has(target)) {
          reachable.add(target)
          grew = true
        }
      }
    }
    if (!grew) break
  }

  /* A helper `say()` emits when CALLED, so a function that calls an emitting
   * function is itself emitting. Fixpoint over the call graph. */
  const emitting = new Set()
  for (const [owner, s] of info) if (s.emits.some((e) => !e.blocked)) emitting.add(owner)
  for (let pass = 0; pass < 12; pass++) {
    let grew = false
    for (const [owner, s] of info) {
      if (emitting.has(owner)) continue
      for (const c of [...s.calls, ...s.refs]) {
        if (c.blocked) continue
        const target = funcs.get(c.name)
        if (target && emitting.has(target)) {
          emitting.add(owner)
          grew = true
          break
        }
      }
    }
    if (!grew) break
  }

  /* A · are any judgements reachable on the default invocation? */
  const liveEmissions = []
  for (const [owner, s] of info) {
    if (!reachable.has(owner)) continue
    for (const e of s.emits) {
      if (!e.blocked) liveEmissions.push({ owner: byNode.get(owner) ?? "<module>", ...e })
    }
    for (const c of [...s.calls, ...s.refs]) {
      if (c.blocked) continue
      const target = funcs.get(c.name)
      if (target && emitting.has(target)) {
        liveEmissions.push({ owner: byNode.get(owner) ?? "<module>", via: c.name, line: c.line })
      }
    }
  }

  /* J · THE MIRROR OF A, AND IT WAS ALREADY BEING COMPUTED AND THROWN AWAY.
   *
   * Channel A asks "is at least ONE judgement reachable bare" and stops there.
   * `deadEmissions` below has held the blocked ones since this file was written
   * — and it is read in exactly one place, the "why each red row is red" block,
   * which only runs for a gate that ALREADY failed A. So for every gate that
   * passes A, the list of judgements it withholds is computed on every sweep and
   * discarded unread.
   *
   * That is the whole `assert-hero-dials` defect. It emits four model rows bare,
   * so A is satisfied and the row prints `gate`; its browser arm — the panel, the
   * thing `docs/README.md:198` advertises it for — sits behind `--live`, which
   * NEITHER battery runner passes. Explainer 27 §2: in the browser battery it ran
   * in 0.3 s, emitted 4 rows, and never opened Chrome.
   *
   * A gate can be partly swept, and "partly" reads as green. So J takes the
   * complement of A's set: emissions blocked by a flag, in a function the default
   * invocation DOES reach. Two shapes count, because both are how a real arm is
   * withheld:
   *   · a direct `console.log("PASS …")` under `if (FLAG)`;
   *   · a CALL to an emitting function under `if (FLAG)` — which is the shape
   *     assert-hero-dials uses (`liveArm()` at :842 under `if (LIVE)`), and a
   *     direct-emit-only check would have missed the very gate this exists for.
   *
   * `blocked && !reachable` is NOT J's business — a blocked row inside a function
   * nothing calls is channel A's finding, and counting it here would report the
   * same defect twice under two names. */
  /* Every UNBLOCKED call, as `name(argText)`. A blocked call whose exact twin
   * also runs unguarded is a SHORTCUT to work the default path already does, not
   * a withheld judgement.
   *
   * THE TWO CASES THIS SEPARATES, both found on the first run of this channel:
   *   · `assert-gate-integrity.mjs` itself — `if (CALIBRATE) process.exit(
   *     calibrate() …)` beside an unconditional `failed += calibrate()`. Same
   *     callee, same (empty) arguments, same rows. NOT withheld.
   *   · `assert-drawin-parity.mjs:170` — `say(…)` under `--expect-pop`, where
   *     `say` is the row helper called fifty times elsewhere. Same callee,
   *     DIFFERENT arguments, and therefore a different ROW: one that no sweep
   *     emits. Withheld.
   * Keying on the callee alone merges them and loses the second, which is the
   * commoner shape. Keying on callee + arguments keeps both answers right. */
  const ranAnyway = new Set()
  /* The bare NAMES too — the exit-arm below matches against an exit expression
   * like `calibrate() === 0 ? 0 : 1`, where the arguments are not recoverable. */
  const ranAnywayNames = []
  for (const [owner, s] of info) {
    if (!reachable.has(owner)) continue
    for (const c of s.calls) {
      if (c.blocked) continue
      ranAnyway.add(`${c.name}(${c.args ?? ""})`)
      ranAnywayNames.push(c.name)
    }
  }

  const withheld = []
  for (const [owner, s] of info) {
    if (!reachable.has(owner)) continue
    const ownerName = byNode.get(owner) ?? "<module>"
    for (const e of s.emits) {
      if (!e.blocked) continue
      withheld.push({ kind: "emit", owner: ownerName, line: e.line, guards: e.guards, flags: (e.blockedBy ?? []).map((n) => cli.get(n) ?? n) })
    }
    /* ── A JUDGEMENT IS A VERDICT THAT REACHES THE EXIT CODE ─────────────────
     *
     * The lexical half above finds a withheld arm only when it PRINTS a verdict
     * token. Measured 2026-08-07 on the 19 gates that run no control bare: most
     * of them announce their control's verdict in a vocabulary no token rule can
     * ever chase —
     *
     *     "MUTATION CONTROL --mutate=prior: both subject rows went RED, as required."
     *     "NOT SOUND"          "STAYED GREEN ✗"          "control SOUND"
     *
     * Widening the alphabet until it matched those would end with it matching
     * prose, which is the defect one level up. But every one of those blocks
     * ends the same way, and it is the way this file's OWN HEADER defines a
     * judgement, for channel B: *a non-zero exit reachable from the script's own
     * judgement.* Channel J was defining a judgement LEXICALLY while channel B
     * defined it STRUCTURALLY — two halves of one file disagreeing about what a
     * judgement is.
     *
     * So a blocked, non-`catch`, failure-capable `process.exit()` is a withheld
     * judgement: a red the default invocation can never return. `s.exits` has
     * been computed on every sweep since this file was written and read only by
     * channel B — which is exactly the shape of the `deadEmissions` finding that
     * created channel J in the first place, one level deeper.
     *
     * `.catch` handlers are excluded for B's reason, verbatim: that reports the
     * script crashed, never that the subject failed. `exit(0)` is excluded
     * because a withheld GREEN withholds no evidence.
     *
     * These are tagged `kind: "exit"` and the report DE-DUPLICATES: within one
     * (gate, flag) group, exit-derived arms are dropped when the lexical half
     * already found one, because a block that prints "CONTROL FAILED" and then
     * exits 1 is ONE judgement expressed twice, not two. That undercounts arms
     * in the rare block that holds both a printed verdict and a separate exit
     * judgement, and undercounting an already-red row's arm tally hides no gate;
     * overcounting would make the number mean less than it says. */
    for (const e of s.exits) {
      if (!e.blocked || e.inCatch || !e.failureCapable) continue
      /* ⚠ EXIT 2 IS A REFUSAL, NOT A VERDICT — measured across all 95 gates, and
       * every single occurrence is the same idiom: `unknown --control="x"`,
       * `no capture at <dir> — run _probe-… first`, `frame counts differ.
       * Re-capture both.`, `the mutant did not ARM; refusing to grade it`. The
       * gate is declining to judge, which is the OPPOSITE of a withheld
       * judgement, and counting it would make J report a usage error as a
       * suppressed control. Same exclusion, and the same reason, as channel B's
       * `.catch` rule: that says the script could not run, never that the
       * subject failed. */
      if (/^2$/.test(String(e.code).trim())) continue
      /* …AND THE SHORTCUT THIS FILE ALREADY DOCUMENTS ABOUT ITSELF. `main()` has
       *     if (CALIBRATE) process.exit(calibrate() === 0 ? 0 : 1)
       * beside an unconditional `failed += calibrate()`. The EXIT is behind a
       * flag; the JUDGEMENT is not. The call-arm of this channel has guarded
       * that case since it was written (`ranAnyway`), and the first version of
       * the exit-arm re-introduced the identical false positive — on this very
       * file, which is how it was caught. A meta-gate failing itself for a
       * defect it does not have is the fastest way to get a channel switched
       * off, so the exit-arm gets the same guard: an exit whose expression
       * invokes a function that ALSO runs unguarded terminates a judgement the
       * default path already makes. */
      if (ranAnywayNames.some((n) => new RegExp(`\\b${n}\\s*\\(`).test(String(e.code)))) continue
      withheld.push({
        kind: "exit",
        owner: ownerName,
        line: e.line,
        exitCode: e.code,
        guards: e.guards ?? [],
        flags: (e.blockedBy ?? []).map((n) => cli.get(n) ?? n),
      })
    }
    for (const c of [...s.calls, ...s.refs]) {
      if (!c.blocked) continue
      const target = funcs.get(c.name)
      if (!target || !emitting.has(target)) continue
      /* A FUNCTION CALLED BEHIND A FLAG **AND** ALSO CALLED IDENTICALLY WITHOUT
       * ONE IS NOT WITHHELD — see `ranAnyway`. This line is here because the
       * first version of this channel reported THIS FILE, for a `calibrate()`
       * shortcut beside a `calibrate()` that runs every sweep. A meta-gate
       * failing itself for a defect it does not have is the fastest way to get a
       * channel switched off. */
      if (ranAnyway.has(`${c.name}(${c.args ?? ""})`)) continue
      withheld.push({ kind: "emit", owner: ownerName, via: c.name, line: c.line, guards: c.guards ?? [], flags: (c.blockedBy ?? []).map((n) => cli.get(n) ?? n) })
    }
  }

  /* B · can the default invocation exit non-zero off its own judgement? */
  const liveExits = []
  for (const [owner, s] of info) {
    if (!reachable.has(owner)) continue
    for (const e of s.exits) {
      if (e.blocked || e.inCatch || !e.failureCapable) continue
      liveExits.push({ owner: byNode.get(owner) ?? "<module>", ...e })
    }
  }

  /* C · where does the evidence come from on the default path? */
  let touchesLive = false
  let touchesStored = false
  for (const [owner, s] of info) {
    if (!reachable.has(owner)) continue
    if (s.live.some((x) => !x.blocked)) touchesLive = true
    if (s.stored.some((x) => !x.blocked)) touchesStored = true
  }

  const relabelable = /\barg\(\s*["']label["']/.test(src) || /\barg\(\s*["']dir["']/.test(src)

  /* ---- what D and F and H need to know about this script ----------------- */

  /** The pure-TS modules it loads through `_ts-load.mjs` — D's mutation targets. */
  const modules = [...new Set([...src.matchAll(/loadTs\(\s*["']([^"']+\.tsx?)["']/g)].map((m) => m[1]))]

  /** Does it drive a browser? Those are slow and need a dev server, so D skips them. */
  /* PARSED, NOT GREPPED, and not a second copy of the rule — `run-battery.mjs`
   * decides, this file asks. The old regex matched raw text, so a driver named
   * in a comment or a negative-control fixture classified the file, and a gate
   * driving Chrome through a CHILD was invisible to it:
   * `assert-hero-word-legible.mjs` spawns `_probe-word-ladder.mjs`, which imports
   * playwright-core, and D/G/I had been treating it as model-only — i.e. this
   * file was mutating and bare-running a gate that launches Chrome against a
   * hardcoded `:3000`. `classify()` follows the child and reads the `battery:`
   * directive as a DIRECTIVE rather than as text that happens to match.
   * (Lane K's hunk 2 — it and hunk 1 are one fix and land together.) */
  const drivesBrowser = classify(file).list === "browser"

  /** The DEFAULT `--label`, which is what a bare invocation grades — F's subject.
   *
   * ⚠ COMMENTS ARE STRIPPED FIRST, AND THAT WAS A REAL FALSE RED. The plain
   * regex takes the FIRST `arg("label", "...")` anywhere in the file, and
   * `assert-pentip-specks.mjs` documents its own repair with the line
   *
   *     * PARKED PRIOR: `arg("label", "tipshape-sweep")`, with
   *
   * eighteen lines above the live `const LABEL = arg("label", "ship-dsf1")`. So
   * channel F graded the staleness of `docs/verification/pentip/tipshape-sweep`
   * — a capture that gate deliberately no longer reads — and reported the wrong
   * directory as the reason a bare run was untrustworthy. A meta-gate reading a
   * comment as code is the same class of defect it exists to find, which is why
   * `analyse()`'s A-channel is a PARSE and not a grep; this one line was still a
   * grep. Stripping is enough here (the target is a string literal inside a call,
   * and no gate writes one across a comment boundary). */
  const labelDefault = (() => {
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    const m = code.match(/\barg\(\s*["']label["']\s*,\s*["']([^"']*)["']\s*\)/)
    return m ? m[1] : null
  })()

  /** H · does it ever MOVE a control, or only exercise the default state?
   *  A dial the battery never touches is a dial the battery cannot gate.
   *
   *  THE FIRST VERSION OF THIS PREDICATE WAS ITSELF A FALSE GREEN, which is worth
   *  leaving on the record given what this file is for. It included a bare
   *  `\bset[A-Z]\w*\(`, which matches `setTimeout`, `setAttribute`, `setProperty`
   *  and `setInterval` — so every browser gate in the repo "moved a control" and
   *  the channel reported 0 of 44, i.e. nothing, confidently. A hand audit of the
   *  same set had already found `assert-sweep-release` to be default-state-only
   *  and `verify-gates` never to scrub the reveal.
   *
   *  So it is a POSITIVE list of the things that actually move a control in this
   *  app, not a pattern that happens to catch them. Being explicit costs a line
   *  per idiom and cannot silently widen. */
  const movesAControl = [
    /\.click\(/, // a real DOM click on a pill or button
    /\.fill\(|\.setInputFiles\(/, // Playwright form input
    /dispatchEvent|pointerdown|pointermove|pointerup/, // synthesised pointer gestures
    /__captureHarness\s*\.\s*\w+/, // the hero harness — orbitView, scrub, flatten
    /__styleHarness\s*\.\s*\w+/, // the style harness — setStyle, setExtrude
    /__geomDebug\s*\.\s*\w+/,
    /\bsetProgress\(|\bsetStyle\(|\bsetFlatten\(|\bsetSpin\(|\bsetExtrude\(/,
    /data-hero-scrub|\[data-read-|\bscrubTo\(/,
    /input\.value\s*=/,
  ].some((re) => re.test(src))

  /* …and "moves SOMETHING" turned out to be the wrong question too: every browser
   * gate in the repo writes some state, so the answer was 0 of 44 a second time.
   * The bug that cost days was reachable only through the dials that RE-ALLOCATE —
   * the pen field is rebuilt by the wobble slider and the endpoint pill and by a
   * viewport resize, and never by a plain load-and-play. So H reports the three
   * axes separately, and a gate touching none of them is the finding. */
  const movesWhat = {
    scrub: /setProgress\(|scrubTo\(|data-hero-scrub|__captureHarness\s*\.\s*(scrub|playhead|seek)|revealRef/.test(src),
    resize: /setViewportSize|deviceScaleFactor|\bdsf\b|setDeviceScale|\.resize\(/.test(src),
    inkDial: /inkWidth|wobble|endpoint|nibAngle|\btaper\b|setInk|strokeEnd|penTip/i.test(src),
  }

  return {
    file,
    modules,
    drivesBrowser,
    /* The argv of every spawn that re-invokes THIS file — channel J's
     * `selfSweeps`. Kept as text so nothing AST-shaped reaches report.json. */
    selfSpawnArgv: collectSelfSpawns(sf),
    labelDefault,
    movesAControl,
    movesWhat,
    flags: [...flags],
    cliFlags: Object.fromEntries(cli),
    emits: liveEmissions,
    withheld,
    exits: liveExits,
    deadEmissions: [...info].flatMap(([owner, s]) =>
      s.emits
        .filter((e) => e.blocked || !reachable.has(owner))
        .map((e) => ({
          owner: byNode.get(owner) ?? "<module>",
          line: e.line,
          why: !reachable.has(owner) ? "never called" : "behind " + e.guards.join(" && "),
        })),
    ),
    allExits: [...info].flatMap(([owner, s]) =>
      s.exits.map((e) => ({ owner: byNode.get(owner) ?? "<module>", ...e })),
    ),
    source: touchesLive ? (touchesStored ? "LIVE+STORED" : "LIVE") : touchesStored ? "STORED" : "NONE",
    relabelable,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CHANNEL K · DOES THE GATE RUN A NEGATIVE CONTROL AT ALL?
 *
 * Proposed and prototyped by lane I, landed here 2026-08-07.
 *
 * WHY K IS NOT J. Channel J asks a narrow question — is a judgement withheld
 * behind a CLI flag — and answers it from the syntax tree. The LAW is broader.
 * `docs/explainers/21-losing-your-work.md` §7:
 *
 *     "This repo has caught eleven instruments reporting green while measuring
 *      nothing, so the gate runs three kinds of control on the DEFAULT
 *      invocation, never behind a flag."
 *
 * A gate can satisfy J perfectly and have no control anywhere in it. Measured
 * 2026-08-07, all 89 gates READ (not grepped): 19 run no control on the bare
 * invocation, and J flagged TWO of them.
 *
 * WHY A MANIFEST AND NOT AN ANALYSER — lane I's ruling, and it should not be
 * relitigated. **No AST can tell a control from a measurement, because the
 * difference is whether the input is DELIBERATELY WRONG, which is a claim about
 * intent.** Lane C counted this class by pattern and got nine; lane G read the
 * nine and got six — "only 2 of C's 9 survive reading; 4 they didn't list do
 * have the defect." A pattern-matched survey is wrong in BOTH directions.
 *
 * So the ruling is human and written down, one entry per gate, and what the
 * machine owns is that the ruling CANNOT ROT SILENTLY:
 *
 *   K1  every discovered gate has an entry           (a new gate defaults to RED)
 *   K2  every entry names a discovered gate          (a deleted gate's entry is stale)
 *   K3  every `control` entry's cited token is still SOMEWHERE IN THE CODE
 *   K4  every `control` entry HAS a citation         (see below — this one is mine)
 *   K5  the counts print every run, and the `none` gates are listed BY NAME
 *
 * K3 IS THE LOAD-BEARING ONE, and it is the ALLOW list's own lesson applied one
 * level up: an exemption that matches nothing is a defect, so a ruling whose
 * evidence has moved is a defect too. Without it this manifest becomes exactly
 * what it was written to prevent — a green nobody has re-read.
 *
 * ── 2026-08-28 · K3 CITES BY TOKEN. THE LINE IS ADVISORY. (F23a) ────────────
 *
 * K3 used to ask whether line N still carried the token, and lane N7 measured
 * what that cost: 25 of 101 entries red, and NOT ONE of them from rot. None of
 * those 25 gates had a commit between the manifest's last commit and HEAD;
 * `assert-motion-off`'s token has sat on :302 in every commit that ever
 * contained the file while the manifest said :306; 21 of the 25 offsets were
 * exactly 4. The 08-07 survey ran against a working tree that was not committed
 * until 08-24. **The citations were wrong the day they were written, and a
 * line-primary check reports that as decay.**
 *
 * So the token is the claim and the line is a bookmark:
 *
 *   · exactly one code hit    -> reconciled. If the line disagrees it is DRIFT,
 *                                printed by name and fixed with `--recite`. Not
 *                                a failure: nothing about the control changed.
 *   · no code hit at all      -> RED. The control is gone, or it only ever
 *                                existed in prose. Re-rule it; no tool may.
 *   · more than one code hit  -> the line disambiguates, and must name one of
 *                                them. If it names none, RED.
 *
 * WHY THE LINE STILL DECIDES THE AMBIGUOUS ONES, rather than ambiguity itself
 * being red. Measured over all 99 cited entries: 96 tokens are unique in code,
 * 2 are not, and BOTH of those two are correct. `assert-corner-split` runs the
 * prior arm on a straight line at :70 and on an elbow at :82, and
 * `assert-screen-layers` reads its `reveal_control` cell at four sites. Failing
 * an honest entry for the crime of a gate having two control arms is the
 * wolf-crying this file's own header warns about, and the only thing it would
 * teach is to pad tokens until they are unique, which makes the manifest less
 * readable and no more true. The line keeps its job in the 2 cases where the
 * token alone is not an answer, and stops being able to invent 25 failures in
 * the 96 where it was never anything but a bookmark.
 *
 * ⚠ WHAT THIS STILL DOES NOT CATCH, stated because N7 refused to soften it and
 * so does this: leave the cited text in place and neuter the arm, `const
 * controlOk = true`, and K stays green. A GREEN MANIFEST MEANS A CONTROL IS
 * CITED IN LIVE CODE. It has never meant the control can still say no. What the
 * code-only lookup adds is the one degradation next door: a control COMMENTED
 * OUT with its prose intact now goes red, where a raw-text search read the
 * surviving comment as evidence of the control it replaced.
 *
 * ⚠ K4 EXISTS BECAUSE THE PROTOTYPE HAD A HOLE AND IT WAS ALREADY LOAD-BEARING.
 * Lane I's version guarded K3 with `e.verdict === "control" && e.line > 0`, and
 * lane I's own three fixes were written with `line: 0` — so the three most
 * recently changed control rulings in the file were the three the rot check
 * SKIPPED. An uncitable ruling is not a ruling; it is a claim. All three are
 * cited now and a `control` entry without a citation is red.
 *
 * AND THE NUMBER THAT ARGUES FOR THE WHOLE CHANNEL: re-verifying lane I's 89
 * citations against the tree a few HOURS later found 2 already rotted
 * (`assert-fusion-authoring` :214 -> :219, `assert-fusion-ui` :171 -> :193) and
 * 6 gates landed with no entry at all. Two more rotted during this lane's own
 * edits. A manifest nobody re-checks is the ALLOW list's failure mode with more
 * entries.
 * ═══════════════════════════════════════════════════════════════════════════ */

const MANIFEST_PATH = join(VERIFY, "lib", "control-manifest.json")

/** `--recite` — the maintenance affordance, and it is deliberately NARROW.
 *
 *  Channel E already has `--rebaseline` for the same reason: a check that can
 *  only be satisfied by hand-editing JSON gets satisfied by deleting the check.
 *  But a blanket "accept whatever is there now" would launder the one thing K3
 *  exists to catch, so this refuses unless it can prove the control MOVED:
 *
 *    · the token sits on exactly one line of CODE  -> re-cite it
 *    · the token appears on no line of code        -> REFUSE, loudly
 *    · the token sits on several lines of code     -> REFUSE, loudly
 *
 *  The second case is a control that was DELETED, and no tool may rule on that.
 *  Lane I's wording: "Either the control moved (re-cite it) or it is gone
 *  (re-rule it)." Only the first half is mechanical. The third case is new with
 *  the token-primary rule and refuses for the same reason: picking one of two
 *  real control arms is a judgement about which one the entry is about, and a
 *  tool that guessed would write a citation nobody made. */
function recite(entries, readGate) {
  const moved = []
  const gone = []
  const ambiguous = []
  for (const [g, e] of Object.entries(entries)) {
    if (e.verdict !== "control" || !e.token) continue
    const src = readGate(g)
    if (!src) continue
    const hits = []
    src.code.forEach((l, i) => l.includes(e.token) && hits.push(i + 1))
    if (hits.includes(e.line)) continue
    if (!hits.length) {
      const prose = src.raw.findIndex((l) => l.includes(e.token))
      gone.push(prose < 0 ? g : `${g}  (the phrase survives at :${prose + 1}, but only inside a comment)`)
    } else if (hits.length > 1) {
      ambiguous.push(`${g}  :${e.line} -> one of :${hits.join(" :")}`)
    } else {
      moved.push(`${g}  :${e.line} -> :${hits[0]}`)
      e.line = hits[0]
    }
  }
  return { moved, gone, ambiguous }
}

/** K's verdict, as a pure function so `--calibrate` can drive it with a
 *  deliberately broken manifest. Returns the failures, never prints. */
export function reconcileControls(gates, entries, readGate) {
  const fail = []
  for (const g of gates) {
    const e = entries[g]
    if (!e) {
      fail.push({
        gate: g,
        kind: "missing-entry",
        why: "NO ENTRY. A gate with no ruling is not a gate with a control. Read it, rule on it, add it.",
      })
      continue
    }
    if (e.verdict !== "control") continue
    if (!(e.line > 0) || !e.token) {
      fail.push({
        gate: g,
        kind: "uncited",
        why: "ruled `control` with NO CITATION — nothing here can be re-checked, so the ruling cannot be shown to have rotted. Cite the line and the token.",
      })
      continue
    }
    const src = readGate(g)
    if (!src) {
      fail.push({ gate: g, kind: "unreadable", why: "the manifest rules on a file this sweep cannot read" })
      continue
    }
    const hits = []
    src.code.forEach((l, i) => l.includes(e.token) && hits.push(i + 1))
    if (!hits.length) {
      /* The distinction the raw text pays for: a control that was DELETED reads
       * the same as one that was COMMENTED OUT, and only the second leaves the
       * ruling's own words behind to look convincing. Name which one it is. */
      const prose = src.raw.findIndex((l) => l.includes(e.token)) + 1
      fail.push({
        gate: g,
        kind: "control-gone",
        why: prose
          ? `THE CONTROL IS NOT CODE ANY MORE. The token ${JSON.stringify(e.token.slice(0, 44))} survives at ` +
            `:${prose}, but only inside a COMMENT. A paragraph about a control is not a control. Either it was ` +
            `commented out (restore it) or the entry was cited on prose from the start (re-rule it).`
          : `THE CONTROL IS GONE. The token ${JSON.stringify(e.token.slice(0, 44))} appears on no line of code in ` +
            `this gate. Either it MOVED and was renamed (re-cite it) or it was DELETED (re-rule it). No tool may ` +
            `decide which.`,
      })
      continue
    }
    if (hits.length > 1 && !hits.includes(e.line)) {
      fail.push({
        gate: g,
        kind: "ambiguous-citation",
        why:
          `AMBIGUOUS CITATION. The token sits on ${hits.length} lines of code (:${hits.join(" :")}) and the entry ` +
          `names :${e.line}, which is none of them. With more than one candidate the line is the only thing that ` +
          `says which control this ruling is about, so it has to name one.`,
      })
    }
  }
  for (const k of Object.keys(entries)) {
    if (!gates.includes(k)) {
      fail.push({ gate: k, kind: "stale-entry", why: "STALE ENTRY. The manifest rules on a gate that does not exist." })
    }
  }
  return fail
}

/** The advisory half of K3, kept OUT of the verdict on purpose.
 *
 *  A bookmark that points a few lines off is not a defect, and treating it as
 *  one is what produced 25 red rows about gates nobody had touched. It is still
 *  worth printing: a citation drifting is the cheapest early sign that a gate is
 *  being edited around its control, and `--recite` fixes the whole list in one
 *  pass. Separate function rather than a flagged row in `reconcileControls`,
 *  because a channel whose failures come back mixed with its non-failures is one
 *  `filter` away from counting the wrong thing. */
export function citationDrift(gates, entries, readGate) {
  const drift = []
  for (const g of gates) {
    const e = entries[g]
    if (!e || e.verdict !== "control" || !(e.line > 0) || !e.token) continue
    const src = readGate(g)
    if (!src) continue
    const hits = []
    src.code.forEach((l, i) => l.includes(e.token) && hits.push(i + 1))
    if (hits.length === 1 && hits[0] !== e.line) drift.push({ gate: g, from: e.line, to: hits[0] })
  }
  return drift
}

/* ------------------------------------------------------------------------- *
 * CHANNEL C — the dynamic half: a stored-evidence gate must refuse missing
 * evidence. Static analysis cannot answer this; running it can, and it costs a
 * second because a STORED script never opens a browser.
 * ------------------------------------------------------------------------- */
function probeMissingEvidence(file) {
  const res = spawnSync("node", [file, `--label=${MISSING_LABEL}`], {
    cwd: ROOT,
    timeout: 90_000,
    encoding: "utf8",
  })
  if (res.error && res.error.code === "ETIMEDOUT") return { ok: false, why: "timed out (90s)" }
  const code = res.status
  const said = (res.stdout || "") + (res.stderr || "")
  const passed = /ALL .*PASS|ASSERTIONS PASS/.test(said)
  return {
    ok: code !== 0,
    code,
    why:
      code !== 0
        ? `refused (exit ${code})`
        : passed
          ? "EXITED 0 AND REPORTED PASS ON EVIDENCE THAT DOES NOT EXIST"
          : `exited 0 on evidence that does not exist`,
  }
}

/* ------------------------------------------------------------------------- *
 * CHANNEL D — CAN IT FAIL? Move a constant it names; require it to notice.
 *
 * The known-bad input for a model gate is mechanical: a constant of the module
 * it loads, moved a long way. `lib/mutants.mjs` enumerates those; `_ts-load.mjs`
 * applies one via `GATE_MUTATE_FILE` between reading the file and transpiling
 * it, so nothing on disk changes and two lanes can run this at once.
 *
 * ONLY CONSTANTS THE GATE NAMES, and that restriction is the whole precision of
 * this channel. `assert-hero-turn` has no business noticing `letterCount` move,
 * and failing it for that would be the wolf-crying that gets a meta-gate
 * switched off. But `assert-taper-envelope` re-declares `INFLATE_PROFILE_EXP` in
 * its own source and asserts nothing that moves when the engine's copy does —
 * that is `PEN_CARVE_ENVELOPE_R` again, and it is exactly what this catches.
 *
 * A DIFFERENTIAL GATE CORRECTLY SURVIVES EVERY MUTANT, and that is not a defect.
 * `assert-hero-dials` perturbs a dial and diffs two samples of the same model;
 * moving the base constant moves both arms together, so it killed 0 of 24 in the
 * first sweep and was right to. Such a gate names no constant of its subject in
 * an assertion, so the "names none" branch reports it rather than failing it.
 * ------------------------------------------------------------------------- */

/** Base runs, memoised — G reads what D already paid for rather than paying twice.
 *
 * The first version re-ran every model gate for channel G. `assert-pentip-specks`
 * takes 94 s and spawns a browser of its own, `spawnSync`'s default SIGTERM did
 * not reach the grandchild, and the sweep sat on one gate for 39 minutes. Hence
 * both halves of this fix: SIGKILL below, and the cache here. */
const BASE_RUNS = new Map()

/** Run a gate, optionally under one mutant. */
function runGate(file, extraArgs, mutant) {
  const cacheable = !mutant && extraArgs.length === 0
  if (cacheable && BASE_RUNS.has(file)) return BASE_RUNS.get(file)
  if (mutant) {
    mkdirSync(dirname(MUT_JSON), { recursive: true })
    writeFileSync(MUT_JSON, JSON.stringify({ [mutant.module]: [mutant.edit] }))
  }
  const env = { ...process.env }
  if (mutant) env.GATE_MUTATE_FILE = MUT_JSON
  else delete env.GATE_MUTATE_FILE
  const t0 = Date.now()
  const res = spawnSync("node", [file, ...extraArgs], {
    cwd: ROOT,
    timeout: 120_000,
    /* SIGKILL, not the default SIGTERM. A gate that has launched Chrome does not
     * die on a TERM it never handles, and the sweep inherits the hang. */
    killSignal: "SIGKILL",
    encoding: "utf8",
    env,
    maxBuffer: 32 * 1024 * 1024,
  })
  const out = {
    code: res.status,
    ms: Date.now() - t0,
    out: (res.stdout || "") + (res.stderr || ""),
    timedOut: !!(res.error && res.error.code === "ETIMEDOUT"),
  }
  if (cacheable) BASE_RUNS.set(file, out)
  return out
}

const wordRe = (w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)

function probeMutation(a) {
  const file = a.file
  const src = readFileSync(file, "utf8")
  if (a.drivesBrowser) return { skip: "drives a browser — needs a dev server and a GPU; D is model-only" }

  /* The base run happens FIRST, for every model gate, even one with nothing to
   * mutate — channel G reads this output, and G judging only the gates D could
   * mutate would leave most of the battery unexamined for skip-as-pass. */
  const base = runGate(file, [], null)

  if (!a.modules.length) return { skip: "loads no lib module through _ts-load — nothing to mutate", base }

  /* Only constants whose leaf name the gate actually writes down IN CODE.
   *
   * ⚠ COMMENTS ARE STRIPPED, AND THE FIRST VERSION'S FAILURE TO DO SO PRODUCED A
   * FALSE ACCUSATION — measured 2026-08-03. `assert-drawin-pentip.mjs` loads
   * `lib/pen-reveal.ts` for exactly one function and never touches
   * `PEN_TIP_SHAPES`, but it carries the comment
   *
   *     /** A half-plane cut and an arc cut must both stay under a tenth of the nose. *\/
   *
   * and the leaf of `PEN_TIP_SHAPES.quill.nose` is `nose`. So a word search over
   * the raw source "found" five constants the gate names, mutated all five,
   * watched all five survive — they cannot do anything, the gate never reads
   * them — and printed `killed 0/5 … SURVIVED EVERY MUTANT of a constant it
   * names`. That is this file accusing a healthy instrument on the strength of a
   * sentence, which is the crying-wolf its own header says gets a meta-gate
   * switched off; the A channel is a PARSE for exactly this reason and both this
   * test and channel F's label extraction were still greps.
   *
   * Stripping is enough: the question is whether a NAME is written down, and an
   * identifier in code is never split across a comment boundary. */
  const codeSrc = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
  const named = []
  for (const mod of a.modules) {
    const abs = join(ROOT, mod)
    if (!existsSync(abs)) continue
    let all
    try {
      all = enumerateMutants(abs)
    } catch {
      continue
    }
    for (const m of all) {
      const leaf = m.name.split(".").pop().replace(/\[\d+\]$/, "").replace(/\(.*$/, "")
      if (leaf.length >= 3 && wordRe(leaf).test(codeSrc)) named.push({ ...m, module: mod, leaf })
    }
  }
  if (!named.length) {
    return {
      names: 0,
      skip:
        "names no constant of the module(s) it loads — either it is a DIFFERENTIAL gate " +
        "(both arms move together, which is correct) or it guards no published value",
    }
  }

  /* A DECLARED DIFFERENTIAL — reported with its reason, never silently skipped.
   *
   * The header already says a differential gate correctly survives every mutant,
   * and routes it through the "names none" branch. That branch is too narrow: a
   * gate can NAME a hundred constants — because it ENUMERATES a registry by name
   * — and assert nothing about any single value. `assert-style-contracts` names
   * 95 and killed 0 of 38; its claims are that every preset resolves, that the
   * merge rule holds, that a fusion frame is finite. Every one of those is true
   * at any value of any of the 95, and SHOULD be. Failing it says only that this
   * channel asked the wrong gate the wrong question.
   *
   * So a gate may declare itself, in one line, with a REASON:
   *
   *     // gate-integrity: differential — <why no single value decides a row>
   *
   * The reason is required (a bare marker does not match), it is PRINTED on every
   * sweep beside the count of constants the gate names, and the row stays in the
   * table. That is the same shape as channel E's `partial` declaration and the
   * same rule as everywhere else here: name what you could not probe rather than
   * skipping it. An unjustified declaration is then visible in the output rather
   * than invisible in a green count. */
  /* RAW source, not `codeSrc` — the declaration IS a comment, and the first
   * version of this block searched the comment-stripped copy, so every
   * declaration was invisible and all three declared gates still failed. Caught
   * by running it. `codeSrc` exists for the NAMING test, where a comment must
   * not count; here a comment is the whole point. */
  const decl = src.match(/gate-integrity:\s*differential\s*[-—]\s*([^\n]+)/)
  if (decl) {
    return {
      names: named.length,
      skip: `DECLARED DIFFERENTIAL — ${decl[1].trim()}`,
      declared: true,
    }
  }

  if (base.code !== 0) {
    /* Same ladder as channel I: exit 3 is PARTIAL, not red, and calling it red
     * mislabels WHY D skipped the gate. */
    return {
      names: named.length,
      skip:
        base.code === 3
          ? `PARTIAL on its own default invocation (exit 3) — a channel it could not reach; mutating it would grade an incomplete run`
          : `already RED on its own default invocation (exit ${base.code}) — a mutation cannot make it redder`,
    }
  }
  if (base.ms > 20_000) {
    return { names: named.length, skip: `base run takes ${(base.ms / 1000).toFixed(1)}s — too slow to mutate inside a sweep` }
  }

  /* ESCALATE RATHER THAN ACCUSE ON A SMALL SAMPLE.
   *
   * `assert-preset-registry` names 300 constants. "Survived 10 of 10 sampled" is
   * a suspicion; "survived 40 of 40" is close to a finding; and the first draft
   * of this channel printed the first as though it were the second, which is the
   * same over-claiming this whole file exists to stop. So the sample is cheap
   * while the gate is healthy — one kill ends it — and only widens where 0 kills
   * makes the accusation worth paying for. `tested` is printed either way, so a
   * reader can see what the claim actually rests on. */
  const sample = (n) => {
    const step = Math.max(1, Math.ceil(named.length / n))
    return named.filter((_, i) => i % step === 0).slice(0, n)
  }
  const survivors = []
  const done = new Set()
  let killer = null
  let picked = []
  for (const budget of [MUTANT_CAP, Math.min(named.length, MUTANT_CAP * 4)]) {
    for (const m of sample(budget)) {
      const key = m.module + ":" + m.pos
      if (done.has(key)) continue
      done.add(key)
      picked.push(m)
      const r = runGate(file, [], {
        module: m.module,
        edit: { pos: m.pos, end: m.end, was: m.was, text: m.text },
      })
      if (r.code === 0) survivors.push(`${m.name} ${m.value}->${m.mutant}`)
      else if (!killer) killer = `${m.name} ${m.value}->${m.mutant} @${m.module}:${m.line} (exit ${r.code})`
    }
    if (killer) break // healthy: one demonstrated known-bad is the whole claim
  }
  /* A gate may write a report file; the mutated runs wrote mutated ones. Put the
   * real numbers back so a sibling lane reading that JSON is not handed a mutant. */
  runGate(file, [], null)
  return {
    names: named.length,
    tested: picked.length,
    killed: picked.length - survivors.length,
    killer,
    survivors: survivors.slice(0, 8),
    ok: survivors.length < picked.length,
  }
}

/* ------------------------------------------------------------------------- *
 * CHANNEL F — a stored gate must not grade a capture older than its subject.
 *
 * C proves a stored gate refuses evidence that does not EXIST. It says nothing
 * about evidence that exists and is three days stale, and that is the defect
 * that actually shipped: `assert-hero-transition` returned three confident RED
 * rows belonging to a build from before the turn landed, because its `--label`
 * defaults to a directory nobody had recaptured.
 * ------------------------------------------------------------------------- */

function newestMtime(dir, depth = 4) {
  let newest = 0
  const walk = (d, k) => {
    if (k < 0) return
    let entries
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p, k - 1)
      else {
        try {
          const m = statSync(p).mtimeMs
          if (m > newest) newest = m
        } catch {
          /* raced with another lane's write */
        }
      }
    }
  }
  walk(dir, depth)
  return newest
}

let SUBJECT_MTIME = null
function subjectMtime() {
  if (SUBJECT_MTIME === null) {
    SUBJECT_MTIME = Math.max(
      newestMtime(join(ROOT, "lib")),
      newestMtime(join(ROOT, "app")),
      newestMtime(join(ROOT, "components")),
    )
  }
  return SUBJECT_MTIME
}

/** Where does a bare invocation of this script read its frames from? */
function defaultCaptureDir(a) {
  if (!a.labelDefault) return null
  const src = readFileSync(a.path ?? a.file, "utf8")
  // docs/verification/<pass>/<label>  — the repo's one layout
  const m = src.match(/["']verification["']\s*,\s*["']([\w-]+)["']/)
  if (!m) return null
  const d = join(ROOT, "docs", "verification", m[1], a.labelDefault)
  return existsSync(d) ? d : null
}

/** E's verdict, as a pure function so `--calibrate` can drive it.
 *  Members that were not in the closed set at baseline and are still not in the
 *  gate. Judged on the MEMBERS, not the count, so a set that gained one and lost
 *  one is not scored as unchanged. */
export function inventoryRegression(wasMissing, nowMissing) {
  return nowMissing.filter((m) => !wasMissing.includes(m))
}

/** The verdict itself, as a pure function so `--calibrate` can drive it.
 *
 * TWO BARS, BECAUSE THERE ARE TWO KINDS OF STORED GATE and only one of them can
 * refresh its own evidence.
 *
 *   · A pure STORED gate (channel C's classification) never opens a browser. It
 *     can only ever read what somebody else captured, so ANY staleness is the
 *     defect — that is `assert-hero-transition` at 4.2 days and
 *     `assert-timing-frames` at 4.5, exactly.
 *   · A LIVE+STORED gate captures and then judges the same run. Its `--label=run`
 *     directory is rewritten every invocation, so a few hours of drift means a
 *     sibling lane saved a file after the capture, not that the gate is judging a
 *     dead build. The first draft of this channel failed 22 gates, sixteen of
 *     them for gaps under a day, which is the wolf-crying that gets a meta-gate
 *     switched off.
 *
 * 1.5 days for the second kind: under a working day a capture and the tree are
 * the same build in practice, since this repo captures and edits in one session.
 * Past it, the capture has certainly missed a build cycle. Every age is PRINTED
 * either way — the bar decides what fails, never what is shown.
 */
export function freshnessOf(captureMtime, subjectMs, { pureStored = true } = {}) {
  const ageD = (subjectMs - captureMtime) / 86_400_000
  const bar = pureStored ? 0 : 1.5
  const ok = ageD <= bar
  return {
    ok,
    ageD,
    why: ok
      ? ageD <= 0
        ? "capture is newer than lib/app/components"
        : `capture is ${ageD.toFixed(1)}d behind the tree, inside the ${bar}d bar for a gate that recaptures its own evidence`
      : `capture predates its subject by ${ageD.toFixed(1)} days — a bare run grades a build that no longer exists` +
        (pureStored ? " and this gate cannot recapture it" : ""),
  }
}

function probeFreshness(a) {
  if (!a.labelDefault) return { skip: "no default --label — a bare run has no stored capture to go stale" }
  const dir = defaultCaptureDir(a)
  if (!dir) return { skip: `default --label=${a.labelDefault} does not resolve to a capture directory this sweep can find` }
  const cap = newestMtime(dir)
  if (!cap) return { skip: `${relative(ROOT, dir)} is empty` }
  return {
    ...freshnessOf(cap, subjectMtime(), { pureStored: a.source === "STORED" }),
    dir: relative(ROOT, dir),
    label: a.labelDefault,
    source: a.source,
  }
}

/* ------------------------------------------------------------------------- *
 * CHANNEL G — a SKIP IS NOT A PASS.
 *
 * `verify-gates.mjs` once printed ALL GATES PASS with all four geometry gates
 * skipped. The test is the conjunction: the run said it skipped something, the
 * run summarised itself as all-pass, and the run exited 0. Any two of those are
 * fine; all three together is the defect.
 * ------------------------------------------------------------------------- */

const SKIP_RE = /\bSKIP(?:PED)?\b|\bskipped\b|\bnot probed\b|\bno capture\b|gates skipped/
const ALLPASS_RE = /ALL[^\n]*PASS|ASSERTIONS PASS|all checks pass|ALL GATES PASS/

function judgeSkip(out, code) {
  /* ⚠ A CONTROL ROW ABOUT SKIPPING IS NOT A SKIP, AND THIS TESTED THE WHOLE
   * OUTPUT AS ONE STRING. `assert-material-craft` carries the row
   *   "CONTROL · KNOWN-BAD ... every cell skipped for want of matching files
   *    must not print `all checks pass` and exit 0"
   * which is a gate proving it REFUSES to sell a skip as a pass. It matched on
   * the word inside its own control label and was reported as the very defect
   * it exists to prevent.
   *
   * That is this repo's most-repeated mistake, four times over: a guard matching
   * its own citation comment, the control manifest citing a paragraph ABOUT a
   * control, `_probe-drawin-film.mjs` carrying a "destroying evidence is strictly
   * worse" note six lines above the code that destroys it, and a lane's new
   * comments tripping the detector it had just written. Prose read as code.
   *
   * NARROW ON PURPOSE. Only CONTROL rows are excused, because a control is by
   * definition testing the rule rather than exercising it. A plain
   * "PASS ... 3 cells skipped" still trips this, which is the case that matters. */
  const skipCandidates = out.split("\n").filter((l) => !/\bCONTROL\b/.test(l))
  const skipped = SKIP_RE.test(skipCandidates.join("\n"))
  const claimed = ALLPASS_RE.test(out)
  /* THE STRUCTURAL HALF, which needs no list of summary phrasings (Lane K's
   * hunk 4). G fires on a conjunction of three things and `assert-tsc-baseline`
   * satisfied two of them for four days: its summary is `TSC BASELINE HOLDS`,
   * which `ALLPASS_RE` had never heard of — so G let through the exact gate it
   * exists for. Same shape as `dev-server.mjs`'s banned-names list being found
   * short twice: a list of phrases can only catch the phrases somebody already
   * thought of.
   *
   * A run that NAMES an unreached channel and still exits 0 is selling a skip as
   * a pass, whatever its last line says. Exit 3 is the honest version of the
   * same run and is clean here — that is the whole point of the ladder. */
  if (/^.*\bUNSWEPT\b.*$/m.test(out) && code === 0) {
    return { ok: false, why: "PRINTED AN UNSWEPT CHANNEL AND EXITED 0 — a skip sold as a pass, whatever the summary says" }
  }
  if (!skipped) return { ok: true, why: "no skip in the output" }
  if (code !== 0) return { ok: true, why: "skipped something and exited non-zero — the skip is not being sold as a pass" }
  if (!claimed) return { ok: true, why: "skipped something, exited 0, but claims no all-pass summary" }
  return { ok: false, why: "PRINTED AN ALL-PASS SUMMARY AND EXITED 0 WITH A SKIP IN THE OUTPUT" }
}

/* ------------------------------------------------------------------------- *
 * REPORT
 * ------------------------------------------------------------------------- */

function verdictOf(a) {
  const reasons = []
  if (!a.emits.length) reasons.push("no-verdict")
  if (!a.exits.length) reasons.push("exit-uncoupled")
  return { ok: reasons.length === 0, reasons }
}

function calibrate() {
  const EXPECT = {
    "good-live-gate.mjs": { ok: true },
    "good-stored-gate.mjs": { ok: true },
    "bad-capture-only.mjs": { ok: false, reason: "no-verdict" },
    "bad-flag-gated.mjs": { ok: false, reason: "no-verdict" },
    "bad-always-zero.mjs": { ok: false, reason: "exit-uncoupled" },
    "bad-dead-judge.mjs": { ok: false, reason: "no-verdict" },
    "bad-catch-only-exit.mjs": { ok: false, reason: "exit-uncoupled" },
  }
  let failed = 0
  console.log("\n=== CALIBRATION — the analyser against nine fixtures, six of them KNOWN BAD ===\n")
  for (const [name, want] of Object.entries(EXPECT)) {
    const p = join(FIXTURES, name)
    if (!existsSync(p)) {
      console.log(`FAIL  ${name.padEnd(24)} fixture missing at ${p}`)
      failed++
      continue
    }
    const a = analyse(p)
    const v = verdictOf(a)
    const matched =
      v.ok === want.ok && (want.ok || v.reasons.includes(want.reason))
    if (!matched) failed++
    console.log(
      `${matched ? "PASS" : "FAIL"}  ${name.padEnd(24)} judged ${
        v.ok ? "GATE" : "NOT-A-GATE (" + v.reasons.join(",") + ")"
      }${matched ? "" : `  *** expected ${want.ok ? "GATE" : "NOT-A-GATE (" + want.reason + ")"} ***`}`,
    )
  }
  /* ---- D, E, F and G get their own known-answer controls ------------------
   * The A/B/C fixtures above are judged by reading. D, E, F and G are judged by
   * RUNNING, so their controls have to run too. Same rule as ever: an analyser
   * that has never rejected anything is the disease it is looking for, one level
   * up — and one that has never ACCEPTED anything is just as useless, so each
   * channel gets a pair. */
  let n = 7
  const expect = (ok, name, detail) => {
    n++
    if (!ok) failed++
    console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(24)} ${detail}`)
  }

  /* ---- CHANNEL J's PAIR — a reject and an accept ------------------------
   * The reject fixture is deliberately NOT `bad-flag-gated.mjs`: that one hides
   * every judgement and is caught by A. J's subject is the PARTIAL case, which
   * A passes, so the fixture has to pass A too or the test proves nothing. */
  {
    const badJ = analyse(join(FIXTURES, "bad-withheld-arm.mjs"))
    const goodJ = analyse(join(FIXTURES, "good-arm-always-runs.mjs"))
    expect(
      verdictOf(badJ).ok && badJ.emits.length > 0,
      "bad-withheld-arm",
      `passes A and B first (${badJ.emits.length} reachable row(s)) — otherwise J would be proving A's point, not its own`,
    )
    expect(
      badJ.withheld.length > 0 && badJ.withheld.some((w) => w.flags.includes("--live")),
      "bad-withheld-arm",
      badJ.withheld.length
        ? `J CAUGHT the arm behind ${[...new Set(badJ.withheld.flatMap((w) => w.flags))].join(" ")} — wanted CAUGHT`
        : "*** J saw nothing — a gate that cannot fail, one level up ***",
    )
    expect(
      verdictOf(goodJ).ok && goodJ.withheld.length === 0,
      "good-arm-always-runs",
      goodJ.withheld.length
        ? `*** J flagged a gate whose judgements all run bare (${goodJ.withheld.map((w) => w.flags.join("")).join(",")}) — a false red gets the channel switched off ***`
        : "judged CLEAN — --verbose and --label= are not withheld arms",
    )
  }

  if (!NO_MUTATE) {
    for (const [fx, mustFail] of [
      ["good-sees-its-constant.mjs", true],
      ["bad-blind-to-its-constant.mjs", false],
    ]) {
      const p = probeMutation({
        file: join(FIXTURES, fx),
        drivesBrowser: false,
        modules: ["lib/hero-motion.ts"],
      })
      const got = p.skip ? null : p.ok
      expect(
        got === mustFail,
        fx.replace(".mjs", ""),
        p.skip
          ? `*** NOT PROBED: ${p.skip} ***`
          : `D killed ${p.killed}/${p.tested} — ${p.ok ? "CAN fail" : "CANNOT fail"}, wanted ${mustFail ? "CAN" : "CANNOT"}`,
      )
    }
  } else {
    console.log("SKIP  D's two controls   (--no-mutate / --static) — NOT a pass, unrun")
  }

  const invs = collectInventories(ROOT)
  for (const [fx, mustHit] of [
    ["bad-partial-inventory.mjs", true],
    ["good-full-inventory.mjs", false],
  ]) {
    const hits = partialCoverage(join(FIXTURES, fx), invs)
    const hero = hits.find((h) => h.set === "HeroShape")
    expect(
      !!hero === mustHit,
      fx.replace(".mjs", ""),
      hero
        ? `E reported ${hero.named}/${hero.total} of HeroShape (missing ${hero.missing.join(",")})`
        : `E reported no gap on HeroShape`,
    )
  }

  /* E's growth rule, on the four-films-against-seven case as it actually
   * happened: the gate covered 4 of 5 films, two more landed, the gate did not
   * follow. E must name exactly the two that arrived — and must stay silent when
   * the set has not moved, or it is back to failing every deliberate subset. */
  expect(
    inventoryRegression(["cutaway"], ["cutaway", "standTurn", "letterByLetter"]).join(",") ===
      "standTurn,letterByLetter",
    "E set grew",
    "two films arrived after baseline and are named as the regression",
  )
  expect(
    inventoryRegression(["cutaway", "standTurn"], ["cutaway", "standTurn"]).length === 0,
    "E set unchanged",
    "a partial inventory that has not moved is NOT a failure",
  )

  const DAY = 86_400_000
  expect(
    freshnessOf(1_000 * DAY, 1_004 * DAY, { pureStored: true }).ok === false,
    "F stale, pure STORED",
    "a read-only gate 4 days behind its subject is REFUSED",
  )
  expect(
    freshnessOf(1_005 * DAY, 1_004 * DAY, { pureStored: true }).ok === true,
    "F fresh capture",
    "a capture newer than its subject is accepted",
  )
  expect(
    freshnessOf(1_003.9 * DAY, 1_004 * DAY, { pureStored: true }).ok === false,
    "F 2h, pure STORED",
    "a gate that cannot recapture is refused at ANY staleness — 0.1d fails",
  )
  expect(
    freshnessOf(1_003.9 * DAY, 1_004 * DAY, { pureStored: false }).ok === true,
    "F 2h, recaptures",
    "a gate that rewrites its own evidence is not failed for a sibling lane's save",
  )
  expect(
    freshnessOf(1_002 * DAY, 1_004 * DAY, { pureStored: false }).ok === false,
    "F 2d, recaptures",
    "past 1.5d even a self-capturing gate has missed a build cycle",
  )

  /* I's pair: a gate that is red typed bare, and one that is not. The bar is the
   * exit code of the argument-free invocation and nothing else — the sweep cannot
   * tell a broken surface from wrong defaults, and does not claim to. */
  const i1 = runGate(join(FIXTURES, "bad-wrong-defaults.mjs"), [], null)
  expect(i1.code !== 0, "bad-wrong-defaults", `I bare run exits ${i1.code} — the defaults compare the wrong two arms`)
  const i2 = runGate(join(FIXTURES, "bad-wrong-defaults.mjs"), ["--ref=prior"], null)
  expect(i2.code === 0, "…with the right arms", `I exits ${i2.code} once --ref names the shape it replaced`)

  const g1 = runGate(join(FIXTURES, "bad-skip-as-pass.mjs"), [], null)
  const j1 = judgeSkip(g1.out, g1.code)
  expect(j1.ok === false, "bad-skip-as-pass", `G ${j1.why}`)
  const g2 = runGate(join(FIXTURES, "good-stored-gate.mjs"), ["--label=__none__"], null)
  const j2 = judgeSkip(g2.out, g2.code)
  expect(j2.ok === true, "good-stored-gate", `G ${j2.why}`)

  /* G's STRUCTURAL half gets its own pair. Same output, same UNSWEPT line, same
   * summary phrasing nothing has a rule for — the ONLY difference is the exit
   * code, which is the thing the rule is actually about. Without both halves
   * this is a rule nobody has watched fail OR pass. */
  const g3 = runGate(join(FIXTURES, "bad-unswept-as-pass.mjs"), [], null)
  const j3 = judgeSkip(g3.out, g3.code)
  expect(j3.ok === false, "bad-unswept-as-pass", `G ${j3.why}`)
  const g4 = runGate(join(FIXTURES, "good-unswept-is-partial.mjs"), [], null)
  const j4 = judgeSkip(g4.out, g4.code)
  expect(
    j4.ok === true && g4.code === 3,
    "good-unswept-is-partial",
    `G ${j4.why} (exit ${g4.code} — PARTIAL, so the skip is not being sold)`,
  )

  /* ---- CHANNEL K's FOUR CONTROLS — one per failure mode, plus an accept ---
   *
   * Driven against a REAL manifest that is then deliberately broken four ways.
   * Lane I proved all of these in its prototype; they run here every sweep,
   * because a channel whose failure modes were demonstrated once in a scratch
   * file is a channel whose failure modes were demonstrated once. */
  {
    const inv = gateInventory()
    const realGates = inv.names
    const readGate = makeGateReader(inv.paths)
    let real = null
    try {
      real = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")).gates
    } catch {
      /* handled by the accept case below */
    }
    if (!real) {
      expect(false, "K manifest", "*** the control manifest could not be read — every K verdict below is unproven ***")
    } else {
      const clean = reconcileControls(realGates, real, readGate)
      expect(
        clean.length === 0,
        "K accepts the real one",
        clean.length
          ? `*** ${clean.length} unexpected: ${clean.slice(0, 2).map((f) => f.gate + " " + f.kind).join(", ")} ***`
          : `${realGates.length} gates reconcile in both directions, every cited token still live code`,
      )
      /* ── THE SUBJECT OF THE TOKEN BREAKS IS DERIVED, NOT NAMED ───────────
       * Enumerate a gate here and the break test dies the day that gate is
       * renamed, quietly, because a break that cannot be set up looks exactly
       * like a break that was caught. So the subject is the first `control`
       * entry whose token resolves to exactly one line of code, and it is
       * PRINTED, because "we proved this on something" is not a claim. */
      const uniqueSubject = realGates.find((g) => {
        const e = real[g]
        if (!e || e.verdict !== "control" || !e.token) return false
        const src = readGate(g)
        return src && src.code.filter((l) => l.includes(e.token)).length === 1
      })
      /* …and the ambiguous case needs a token that really is on several lines of
       * code. Rather than hoping the manifest contains one, it is BUILT: a
       * phrase taken from this file's own code that occurs more than once. */
      const selfCode = readGate(SELF)?.code ?? []
      const repeated = (() => {
        const seen = new Map()
        for (const l of selfCode) {
          const t = l.trim()
          if (t.length < 16) continue
          seen.set(t, (seen.get(t) ?? 0) + 1)
          if (seen.get(t) > 1) return t
        }
        return null
      })()

      /** Re-read a gate with ONE line edited, re-parsed for real. Nothing on
       *  disk is touched, so two lanes can run this at once. */
      const readerWithEdit = (gate, edit) => (g) => {
        const src = readGate(g)
        if (g !== gate || !src) return src
        const e = real[gate]
        const at = src.code.findIndex((l) => l.includes(e.token))
        const raw = [...src.raw]
        edit(raw, at)
        const text = raw.join("\n")
        return { raw, code: codeLinesOf(text) }
      }

      const breaks = [
        ["missing-entry", () => { const e = { ...real }; delete e["assert-data-safety.mjs"]; return e }, readGate,
          "a gate arrives with no ruling"],
        ["stale-entry", () => ({ ...real, "assert-a-gate-that-was-deleted.mjs": { verdict: "control", line: 1, token: "x" } }), readGate,
          "a ruling outlives its gate"],
        ["uncited", () => ({ ...real, [uniqueSubject]: { ...real[uniqueSubject], line: 0 } }), readGate,
          "a `control` ruling with nothing to re-check"],
        /* 🔴 THE ONE THIS CHANNEL IS FOR. The control is DELETED from the gate:
         * the line spliced out, everything below it shifted, exactly what a real
         * edit does, and K must go red on that entry. This is the arm that
         * proves the token rule did not buy its 25 green rows by giving up. */
        ["control-gone", () => real, readerWithEdit(uniqueSubject, (raw, at) => raw.splice(at, 1)),
          "the control DELETED from the gate"],
        /* …and its quieter twin, which the old raw-text lookup could not see: the
         * control commented out with its own words left standing. A paragraph
         * about a control is not a control. */
        ["control-gone (commented out)", () => real, readerWithEdit(uniqueSubject, (raw, at) => { raw[at] = "// " + raw[at] }),
          "the control COMMENTED OUT, prose intact"],
        ["ambiguous-citation", () => ({ ...real, [SELF]: { ...real[SELF], token: repeated, line: 1 } }), readGate,
          "a token on several control arms, cited on none of them"],
      ]
      /* BASELINE-RELATIVE, not absolute. The break must add EXACTLY its own
       * failure to whatever the tree already has — asserting `length === 1`
       * would make every break test fail the moment one real citation rots,
       * which is a control that stops working precisely when the channel it
       * guards starts finding things. */
      for (const [name, mutate, reader, what] of breaks) {
        const kind = name.split(" ")[0]
        if (!uniqueSubject || (kind === "ambiguous-citation" && !repeated)) {
          expect(false, `K rejects ${name}`, "*** the break could not be SET UP, which is not the same as caught ***")
          continue
        }
        const got = reconcileControls(realGates, mutate(), reader)
        const hit = got.find((f) => f.kind === kind && !clean.some((c) => c.gate === f.gate && c.kind === f.kind))
        expect(
          !!hit && got.length === clean.length + 1,
          `K rejects ${name}`,
          hit
            ? `${what} (${clean.length} pre-existing + 1): ${hit.gate}`
            : `*** the break did not bite. K cannot detect ${name}, so its green means nothing ***`,
        )
      }

      /* ── AND THE ACCEPT ARM OF THE SAME RULE, which is the whole of F23a ──
       * A citation whose LINE is wrong and whose TOKEN is still in the code must
       * reconcile. Without this the two halves are untested against each other
       * and "token-primary" is a comment. */
      if (uniqueSubject) {
        const movedLine = { ...real, [uniqueSubject]: { ...real[uniqueSubject], line: 1 } }
        const got = reconcileControls(realGates, movedLine, readGate)
        const drift = citationDrift(realGates, movedLine, readGate)
        expect(
          got.length === clean.length && drift.some((d) => d.gate === uniqueSubject),
          "K accepts a moved citation",
          got.length === clean.length
            ? `${uniqueSubject} cited on :1 and found at :${drift.find((d) => d.gate === uniqueSubject)?.to}, reconciled, reported as drift, NOT failed`
            : `*** ${got.length - clean.length} new failure(s): the line is still deciding, so F23a did not land ***`,
        )
      }
    }
  }

  /* ---- CHANNEL L's TWO RULES, each with the answer it must refuse -------
   *
   * L is DERIVED (which instruments answer to `--selftest`) and then JUDGED
   * (did the self-test say anything, and did it exit on it). Both halves are
   * pure functions so both halves get known answers here, with no fixture files
   * to go stale beside them. */
  {
    const answers = "const SELFTEST = process.argv.includes(\"--selftest\")"
    const mentions = "/* run it with --selftest to see the arms */"
    expect(
      parsesSelftest(answers) && !parsesSelftest(mentions) && !parsesSelftest("nothing here"),
      "L derives the convention",
      "a file that PARSES --selftest is matched; one that only names it in prose is not (lib/verdict-rows.mjs is the real case)",
    )
    const sound = judgeSelftest(0, "PASS  a control fired\nPASS  and the clean case did not\n")
    expect(sound.ok === true, "L accepts a sound self-test", `${sound.rows} row(s), exit 0. ${sound.why}`)
    const red = judgeSelftest(1, "PASS  one arm held\nFAIL  the known-bad was ACCEPTED\n")
    expect(red.ok === false, "L rejects a failing self-test", `L ${red.why}. This is the arm that makes L worth having.`)
    /* THE ONE THAT LOOKS LIKE A PASS. Exit 0, no rows: the instrument ran and
     * asserted nothing, and every sweep that counts exit codes calls it green. */
    const mute = judgeSelftest(0, "frame-guard: nothing to do\n")
    expect(mute.ok === false, "L rejects a self-test with no arms", `L ${mute.why}`)
  }

  /* ---- THE ROW PREDICATE · ONE RULE, AND THE PROOF IT IS ONE -------------
   *
   * `lib/verdict-rows.mjs` states what a verdict looks like; `run-battery.mjs`
   * states it again as `ROW_RE`/`FAIL_ROW_RE`. Two statements of one rule is the
   * defect this repo pays for most often, so until the runner IMPORTS from the
   * shared module (a diff handed to the controller — it is not this lane's
   * file), the two are PROVED EQUAL here, on every sweep, over REAL OUTPUT.
   *
   * Fixtures alone would not do: this whole class of defect is made of formats
   * nobody thought to write a fixture for. The corpus is the browser battery's
   * own 48 logs. */
  {
    const vr = verdictSelftest()
    expect(vr === 0, "verdict-rows selftest", `20 cases, 6 must-NOT-match, both anchorings — ${vr} wrong`)
    const LOGS = join(ROOT, "docs", "verification", "gate-integrity", "browser-logs")
    const agree = assertReadersAgree(ROW_RE, FAIL_ROW_RE, LOGS)
    expect(
      agree.ok,
      "row rule: 1 rule 2 readers",
      agree.ok
        ? `verdict-rows.mjs and run-battery.mjs's ROW_RE are the SAME FUNCTION — ${agree.corpus}` +
          (agree.files ? ` (${agree.files} logs, ${agree.rows} rows, ${agree.reds} red)` : "")
        : `*** THE TWO READERS HAVE DRIFTED: ${agree.drift.slice(0, 3).join(" | ")} ***`,
    )
  }

  console.log(
    failed === 0
      ? `\nCALIBRATED. ${n}/${n} across channels A-L, every one of them a known-answer pair: each rule has a case it must REJECT and a case it must ACCEPT. Its verdicts below are usable.`
      : `\nNOT CALIBRATED — ${failed}/${n} wrong. Every verdict this file prints is unproven until this is green.`,
  )
  return failed
}

function main() {
  let failed = 0
  if (has("recite")) {
    const readGate = makeGateReader(gateInventory().paths)
    const man = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
    const { moved, gone, ambiguous } = recite(man.gates, readGate)
    for (const m of moved) console.log(`re-cited  ${m}`)
    if (ambiguous.length) {
      console.log(`\nREFUSING to re-cite ${ambiguous.length} entr(y/ies): the token is on SEVERAL lines of code.`)
      console.log(`Which of them the ruling is about is the ruling, and this tool does not make rulings:`)
      for (const g of ambiguous) console.log(`  · ${g}`)
    }
    if (gone.length) {
      console.log(`\nREFUSING to re-cite ${gone.length} entr(y/ies): the cited token appears on no line of CODE.`)
      console.log(`That is not a control that moved, it is a control that is GONE, and re-ruling it is a`)
      console.log(`human call — the same call as writing the entry in the first place:`)
      for (const g of gone) console.log(`  · ${g}`)
    }
    if (gone.length || ambiguous.length) {
      /* 2, not 1 — this is a REFUSAL to grade, which is this repo's exit-2
       * convention, and channel J's exit-arm reads it as such. A meta-gate that
       * broke its own rule here would be reporting a usage error as a withheld
       * control, on itself. And it refuses BEFORE writing, so a run that cannot
       * settle every entry does not half-settle the file. */
      process.exit(2)
    }
    writeFileSync(MANIFEST_PATH, JSON.stringify(man, null, 2) + "\n")
    console.log(`\n${moved.length} citation(s) re-cited. LOOK at each move before trusting it.`)
    process.exit(0)
  }
  if (CALIBRATE) {
    process.exit(calibrate() === 0 ? 0 : 1)
  }
  // The sweep calibrates FIRST, every run. A verdict from an uncalibrated
  // analyser is the thing this file exists to stop.
  failed += calibrate()
  if (failed) {
    console.log("\nRefusing to sweep on an uncalibrated analyser.")
    process.exit(1)
  }
  /* …and so does the classifier this file now depends on. A verdict about which
   * gates are model-only is worth exactly what its classifier is worth, and
   * channels D, G and I all read it. (Lane K's hunk 1, second half.) */
  {
    const c = classifySelfTest()
    if (!c.ok) {
      for (const r of c.rows) console.log(r)
      console.log("\nRefusing to sweep on an uncalibrated CLASSIFIER.")
      process.exit(1)
    }
  }

  /* THE SCOPE IS IMPORTED. See THE INVENTORY at the top of this file. */
  const inventory = gateInventory()
  const files = inventory.names
  const outside = files.filter((f) => !inventory.paths.get(f).startsWith(VERIFY + "/"))

  console.log(`\n=== SWEEP: ${files.length} assert-* scripts, from run-battery's own discover() ===\n`)
  if (outside.length) {
    /* Named, not counted. These are the ones a flat readdir of scripts/verify
     * could never see, and the reason this file no longer uses one. */
    console.log(`  ${outside.length} of them live OUTSIDE scripts/verify and were invisible to this sweep until 2026-08-28:`)
    for (const f of outside) console.log(`    · ${relative(ROOT, inventory.paths.get(f))}`)
    console.log("")
  }
  console.log(
    "script                                  A:emits  B:exit-coupled  C:evidence   verdict",
  )
  const rows = []
  for (const f of files) {
    const a = analyse(inventory.paths.get(f))
    const v = verdictOf(a)
    if (!v.ok) failed++
    /* `a.file` is the ABSOLUTE path `analyse()` was handed, and spreading it
     * after `file: f` overwrote the bare name with it — which is why channel C
     * printed full paths, and why E and F (which joined VERIFY to it a second
     * time) went looking for `scripts/verify/Users/sebs/…`. Both names are kept
     * now, each labelled for what it is. */
    rows.push({ ...a, verdict: v, file: f, path: a.file })
    console.log(
      `${f.padEnd(40)}${(a.emits.length ? "yes" : "NO").padEnd(9)}${(a.exits.length ? "yes" : "NO").padEnd(16)}${a.source.padEnd(13)}${
        v.ok ? "gate" : "*** NOT A GATE: " + v.reasons.join(", ") + " ***"
      }`,
    )
  }

  /* ---- the detail behind every red row --------------------------------- */
  const bad = rows.filter((r) => !r.verdict.ok)
  if (bad.length) {
    console.log("\n--- why each red row is red ---")
    for (const r of bad) {
      console.log(`\n${r.file}  (${r.verdict.reasons.join(", ")})`)
      if (!r.emits.length) {
        if (!r.deadEmissions.length) {
          console.log("  · the file contains no PASS/FAIL emission anywhere")
        } else {
          for (const d of r.deadEmissions.slice(0, 6)) {
            console.log(`  · line ${String(d.line).padStart(4)} in ${d.owner}(): unreachable — ${d.why}`)
          }
          if (r.deadEmissions.length > 6) console.log(`  · …and ${r.deadEmissions.length - 6} more`)
        }
      }
      if (!r.exits.length) {
        if (!r.allExits.length) console.log("  · no process.exit anywhere — always 0")
        for (const e of r.allExits.slice(0, 6)) {
          const why = e.inCatch
            ? "only reports a CRASH (inside .catch)"
            : !e.failureCapable
              ? "always exits 0"
              : "unreachable by default"
          console.log(`  · line ${String(e.line).padStart(4)} exit(${e.code}) — ${why}`)
        }
      }
    }
  }

  /* ---- CHANNEL J · WITHHELD — a judgement no sweep can reach ------------- */
  console.log("\n--- J · judgements behind a flag, against what actually passes that flag ---")
  const jRows = []
  const jDeferred = []
  const jSelf = []
  const jSwept = []
  for (const r of rows) {
    if (!r.withheld.length) continue
    /* A gate that fails A is already red for having NO reachable judgement;
     * saying it also withholds one is the same fact twice under two names. */
    if (!r.emits.length) continue
    const byFlag = new Map()
    for (const w of r.withheld) {
      const key = (w.flags.length ? w.flags : ["(unnamed flag)"]).join(" ")
      if (!byFlag.has(key)) byFlag.set(key, [])
      byFlag.get(key).push(w)
    }
    for (const [flag, all] of byFlag) {
      /* DE-DUPLICATE the two halves: a block that prints "CONTROL FAILED" and
       * then exits 1 is ONE judgement expressed twice. The exit-derived arms are
       * the FALLBACK — they only count where the lexical half found nothing,
       * which is exactly the case they were added for. */
      const arms = all.some((a) => a.kind === "emit") ? all.filter((a) => a.kind === "emit") : all
      const allow = ALLOW[r.file]?.[flag]
      const swept = sweepPasses(r.file, flag)
      const selfSwept = selfSweeps(r.selfSpawnArgv ?? [], flag)
      const where = arms
        .slice(0, 3)
        .map((a) => `:${a.line}${a.via ? ` ${a.via}()` : a.kind === "exit" ? ` exit(${a.exitCode})` : ""}`)
        .join(" ")
      /* THE GATE RUNS ITS OWN CONTROL — see `selfSweeps` above for why this is a
       * recognised shape and not an ALLOW entry. Named and printed, never
       * silent: a skip nobody can see is indistinguishable from the defect. */
      if (selfSwept) {
        jSelf.push({ file: r.file, flag, arms: arms.length, at: where })
        continue
      }
      /* A RUNNER GENUINELY PASSES THE FLAG. The header names this as the FIRST
       * of the three accepted fixes, and until now the code did not implement
       * it: `swept` was consulted only to validate an ALLOW entry, so a gate
       * whose flag WAS in `EXTRA_ARGS` and which needed no exemption would still
       * have been failed. Latent rather than shipped — `EXTRA_ARGS` is `{}`, so
       * it has never fired — but it is a false RED waiting for the first entry,
       * and a channel that fails the fix it recommends is the fastest way to get
       * itself switched off. */
      if (swept && !allow) {
        jSwept.push({ file: r.file, flag, arms: arms.length, at: where, by: (EXTRA_ARGS[r.file] ?? []).join(" ") })
        continue
      }
      if (allow) {
        /* AN ALLOW ENTRY IS A CLAIM, AND A CLAIM GETS CHECKED. An entry that says
         * a runner passes the flag is verified against the runner's OWN table —
         * never against the sentence in this file. That sentence is the exact
         * shape of the defect the channel exists for, one level up. */
        if (allow.runner && !swept) {
          jRows.push({ file: r.file, flag, why: "ALLOW claims a runner passes it; the runner's table does not" })
          failed++
          console.log(
            `  FAIL  ${r.file.padEnd(38)} ${flag.padEnd(22)} ALLOW says \`${allow.runner}\` passes this flag —` +
              `\n          its EXTRA_ARGS table does not. The exemption is describing a sweep that does not happen.`,
          )
          continue
        }
        jDeferred.push({ file: r.file, flag, arms: arms.length, ...allow })
        continue
      }
      jRows.push({ file: r.file, flag, arms: arms.length, at: where })
      failed++
      console.log(
        `  FAIL  ${r.file.padEnd(38)} ${flag.padEnd(22)} ${arms.length} judgement(s) no sweep reaches  (${where})`,
      )
      console.log(
        `          This gate is GREEN in the battery without running them. Fix it one of three ways:` +
          `\n          pass the flag from a runner (EXTRA_ARGS), remove the flag so the arm always runs,` +
          `\n          or add an ALLOW entry naming WHY and WHAT DOES sweep it. A silent skip is not a pass.`,
      )
    }
  }
  if (!jRows.length) console.log("  no gate withholds a judgement from every sweep.")

  /* THE TWO NON-FAILING OUTCOMES PRINT TOO. A gate that dropped off this
   * channel's red list is a fact a reader needs, and an invisible pass is how a
   * self-spawn gets deleted later with nothing to say so. */
  if (jSelf.length) {
    console.log(`\n  ${jSelf.length} arm(s) run BY THE GATE ITSELF on the bare invocation — not withheld:`)
    for (const d of jSelf) {
      console.log(`    · ${d.file.padEnd(36)} ${d.flag.padEnd(20)} ${d.arms} arm(s)  (${d.at})`)
      console.log(`        the bare run spawns \`node <this file> ${d.flag}…\` and turns each child's exit code into a row.`)
    }
  }
  if (jSwept.length) {
    console.log(`\n  ${jSwept.length} arm(s) reached because a RUNNER passes the flag (EXTRA_ARGS, read from the table):`)
    for (const d of jSwept) console.log(`    · ${d.file.padEnd(36)} ${d.flag.padEnd(20)} swept with \`${d.by}\``)
  }

  /* AN EXEMPTION THAT MATCHES NOTHING IS A DEFECT, NOT A TIDY LINE.
   *
   * This is how an exemption list actually kills the gate that owns it: the arm
   * is fixed or renamed, the entry stays, and the next arm that lands under the
   * same flag name is exempted by an argument nobody made about it. A stale
   * ALLOW is silent by construction — which is the property every defect in
   * explainer 21 shares. So the list is reconciled against the measurement on
   * every run, in both directions. */
  const matched = new Set(jDeferred.map((d) => `${d.file} ${d.flag}`))
  for (const [file, flags] of Object.entries(ALLOW)) {
    for (const flag of Object.keys(flags)) {
      if (matched.has(`${file} ${flag}`)) continue
      failed++
      console.log(
        `  FAIL  ${file.padEnd(38)} ${flag.padEnd(22)} STALE EXEMPTION — nothing withheld matches it.` +
          `\n          Either the arm was fixed (delete the entry) or it moved behind a different flag` +
          `\n          (the entry now exempts something nobody argued for). An exemption is only honest` +
          `\n          while the thing it excuses still exists.`,
      )
    }
  }
  /* THE EXEMPTIONS PRINT. A list nobody reads is a list that rots, and an
   * exemption that is invisible is indistinguishable from the defect. */
  if (jDeferred.length) {
    console.log(`\n  ${jDeferred.length} DEFERRED ARM(S) — named, with a reason and a sweep. A skip that is`)
    console.log(`  named and swept elsewhere is a SCHEDULE; a skip that is silent is the defect:`)
    for (const d of jDeferred) {
      console.log(`    · ${d.file.padEnd(36)} ${d.flag.padEnd(20)} ${d.arms} arm(s)`)
      console.log(`        why:     ${d.why}`)
      console.log(`        swept by: ${d.sweptBy}`)
    }
  }

  /* ---- CHANNEL K · does each gate run a NEGATIVE CONTROL at all? --------- */
  console.log("\n--- K · does each gate run a negative control on the BARE invocation? ---")
  const gateNames = rows.map((r) => r.file)
  let manifest = null
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
  } catch (e) {
    failed++
    console.log(
      `  FAIL  the control manifest is unreadable at ${relative(ROOT, MANIFEST_PATH)} — ${e.message}` +
        `\n        This channel is the written half of the control law. Without it the law is unenforced,` +
        `\n        and an unenforced law reads exactly like a satisfied one. That is not a skip.`,
    )
  }
  const kRows = []
  if (manifest) {
    const entries = manifest.gates ?? {}
    const readGate = makeGateReader(inventory.paths)
    const kFail = reconcileControls(gateNames, entries, readGate)
    const kDrift = citationDrift(gateNames, entries, readGate)
    const tally = { control: 0, partial: 0, none: 0 }
    for (const g of gateNames) if (entries[g]) tally[entries[g].verdict] = (tally[entries[g].verdict] ?? 0) + 1
    const noneList = gateNames.filter((g) => entries[g]?.verdict === "none")
    console.log(
      `  ${tally.control} of ${gateNames.length} gates run a negative control on the bare invocation` +
        ` · ${tally.partial} partial · ${tally.none} none`,
    )
    /* THE `none` GATES PRINT BY NAME, EVERY RUN. A count is a number somebody can
     * get used to; a list of names is a list of things somebody has to answer
     * for. This is the same rule as the ALLOW list's "every entry prints on every
     * run" — a list nobody reads is a list that rots. */
    if (noneList.length) {
      console.log(`\n  ${noneList.length} GATE(S) WITH NO CONTROL ON THE BARE INVOCATION — every green they`)
      console.log(`  print is worth what an unrun control is worth (explainer 21 §7):`)
      for (const n of noneList) {
        const e = entries[n]
        console.log(`    · ${n.padEnd(34)} ${e.withheld ? "withheld: " + e.withheld : "NO CONTROL MECHANISM AT ALL"}`)
      }
    }
    for (const f of kFail) {
      failed++
      kRows.push(f)
      console.log(`  FAIL  ${f.gate.padEnd(38)} ${f.why}`)
    }
    if (!kFail.length) {
      console.log(`\n  K: the manifest reconciles with the gate list in BOTH directions, and every`)
      console.log(`  \`control\` ruling's cited token is still live code in the gate it names.`)
    }
    /* DRIFT IS REPORTED, NEVER FAILED, which is F23a's whole point. The bookmark moved;
     * the control did not. Printing it keeps the manifest honest without letting
     * a stale line number invent a failure, which is what produced 25 red rows
     * about gates nobody had edited. */
    if (kDrift.length) {
      console.log(`\n  ${kDrift.length} citation(s) point at the wrong LINE and the right CODE. Advisory, not a failure.`)
      console.log(`  \`node ${relative(ROOT, fileURLToPath(import.meta.url))} --recite\` moves them:`)
      for (const d of kDrift) console.log(`    · ${d.gate.padEnd(34)} :${d.from} -> :${d.to}`)
    }
  }

  /* ---- CHANNEL L · self-tests that no sweep could fail on --------------- */
  console.log("\n--- L · instruments that are not gates, and their self-tests ---")
  const lFiles = selftestInstruments()
  if (!lFiles.length) {
    failed++
    console.log(
      "  FAIL  the `--selftest` derivation matched NOTHING." +
        "\n        Three instruments answered to it on 2026-08-28. Zero is not a clean sweep; it is a" +
        "\n        predicate that has stopped seeing its subject, and it reads exactly like all-sound.",
    )
  }
  for (const p of lFiles) {
    const name = relative(ROOT, p)
    if (STATIC_ONLY) {
      console.log(`  ---   ${name.padEnd(42)} NOT RUN (--static). A SKIP IS NOT A PASS.`)
      continue
    }
    const res = spawnSync("node", [p, "--selftest"], { cwd: ROOT, timeout: 120_000, encoding: "utf8" })
    const said = (res.stdout || "") + (res.stderr || "")
    const j = judgeSelftest(res.status, said)
    if (!j.ok) failed++
    console.log(
      `  ${j.ok ? "PASS" : "FAIL"}  ${name.padEnd(42)} ` +
        (res.error?.code === "ETIMEDOUT" ? "timed out (120s)" : j.why),
    )
  }

  /* AND THE ONES L STILL CANNOT REACH, BY NAME, EVERY RUN. Same rule as the
   * `none` gates above: a count is a number somebody gets used to, a list of
   * names is a list of things somebody has to answer for. This block is small on
   * purpose: it is a job queue, not a permanent exemption, and each entry
   * carries the one change that would move its subject into a sweep. */
  const unswept = manifest?.unswept ?? {}
  const unsweptNames = Object.keys(unswept).filter((k) => k !== "_")
  if (unsweptNames.length) {
    console.log(`\n  ${unsweptNames.length} SOUND INSTRUMENT(S) STILL IN NO SWEEP. Nothing here can turn this run red:`)
    for (const n of unsweptNames) {
      const e = unswept[n]
      console.log(`    · ${n}`)
      console.log(`        why:  ${e.why}`)
      console.log(`        fix:  ${e.toWireIt}`)
      /* A list that outlives its subjects is the ALLOW list's failure mode. */
      if (!existsSync(join(ROOT, n))) {
        failed++
        console.log(`        FAIL  this file does not exist. The exemption outlived its subject. Delete the entry.`)
      }
    }
  }

  /* ---- CHANNEL C, the dynamic half ------------------------------------- */
  console.log("\n--- C · stored-evidence gates, run against a label that does not exist ---")
  const stored = rows.filter((r) => r.source === "STORED" && r.verdict.ok)
  const unprobed = []
  if (NO_PROBE) {
    console.log("  (--no-probe: skipped. This channel is NOT a pass; it is unrun.)")
    for (const r of stored) unprobed.push({ file: r.file, why: "--no-probe" })
  } else {
    for (const r of stored) {
      if (r.file.endsWith("assert-gate-integrity.mjs")) {
        unprobed.push({
          file: r.file,
          why: "this file — it is calibrated against lib/gate-fixtures/ instead, which is a stronger control than a missing directory",
        })
        continue
      }
      if (!r.relabelable) {
        unprobed.push({ file: r.file, why: "reads a FIXED evidence directory — no --label to redirect" })
        continue
      }
      const p = probeMissingEvidence(r.path)
      if (!p.ok) failed++
      console.log(`  ${p.ok ? "PASS" : "FAIL"}  ${r.file.padEnd(38)} ${p.why}`)
    }
  }
  const liveOnly = rows.filter((r) => r.source !== "STORED")
  console.log(
    `  ${liveOnly.length} script(s) take their evidence from the LIVE app and are exempt from this probe by construction.`,
  )
  if (unprobed.length) {
    console.log(`  ${unprobed.length} NOT PROBED — a SKIP IS NOT A PASS, each one named:`)
    for (const u of unprobed) console.log(`    · ${u.file} — ${u.why}`)
  }

  /* ---- CHANNEL E · INVENTORY — a list that stopped covering its set ------
   *
   * E FAILS ON THE CHANGE, NOT ON THE LEVEL, and that is the whole design.
   *
   * The first draft failed any gate covering under all of a set, and reported 15
   * of 80 — most of them gates deliberately testing three specific phases rather
   * than trying to enumerate twelve. That is the wolf-crying this file's own
   * header warns about: "a meta-gate that cries wolf gets switched off", and a
   * meta-gate switched off is worse than none, because A/B/C stop running too.
   *
   * The defect is not "covers a subset". It is "covered the whole set, the set
   * GREW, and the gate did not". So the coverage is BASELINED, and a member that
   * arrives in a closed set after the baseline without arriving in the gate is
   * the failure — which is precisely the four-films-against-seven case, caught at
   * the moment the fifth film lands rather than three films later.
   *
   * Day one is therefore silent by construction. That is not the check being
   * toothless; it is the check having nothing to say yet, and the levels are
   * printed every run so a reader can see what is being watched. */
  console.log("\n--- E · closed sets, against the coverage each gate had at baseline ---")
  const inventories = collectInventories(ROOT)
  const BASE_PATH = join(ROOT, "docs", "verification", "gate-integrity", "inventory-baseline.json")
  const baseline = existsSync(BASE_PATH) ? JSON.parse(readFileSync(BASE_PATH, "utf8")) : {}
  const REBASE = has("rebaseline")
  const eRows = []
  const eNew = []
  const nextBaseline = {}
  for (const r of rows) {
    const hits = partialCoverage(r.path, inventories)
    if (!hits.length) continue
    nextBaseline[r.file] = {}
    for (const h of hits) {
      nextBaseline[r.file][h.set] = { named: h.named, total: h.total, missing: h.missing }
      const was = baseline[r.file]?.[h.set]
      if (!was || REBASE) {
        eNew.push({ file: r.file, ...h })
        continue
      }
      /* Members that were not in the set at baseline and are not in the gate now.
       * `missing` is recorded rather than `total` so a set that gained AND lost a
       * member is judged on the members, not on the count. */
      const arrived = inventoryRegression(was.missing, h.missing)
      if (!arrived.length) continue
      eRows.push({ file: r.file, set: h.set, at: h.at, arrived, named: h.named, total: h.total })
      failed++
      console.log(
        `  FAIL  ${r.file.padEnd(38)} ${h.set} GREW and this gate did not follow it (${h.at})`,
      )
      console.log(
        `          arrived since baseline and never named here: ${arrived.join(", ")}` +
          `\n          coverage ${was.named}/${was.total} -> ${h.named}/${h.total}`,
      )
    }
  }
  for (const f of Object.keys(baseline)) if (!(f in nextBaseline)) nextBaseline[f] = baseline[f]
  mkdirSync(dirname(BASE_PATH), { recursive: true })
  if (REBASE || !existsSync(BASE_PATH)) {
    writeFileSync(BASE_PATH, JSON.stringify(nextBaseline, null, 2))
  }
  console.log(
    `  ${inventories.length} closed sets read out of lib/ app/ components/.` +
      `\n  ${Object.keys(nextBaseline).length} gate(s) carry a partial inventory that is now WATCHED — a member` +
      `\n  arriving in one of these sets without arriving in the gate is a FAIL from the next run on:`,
  )
  for (const [f, sets] of Object.entries(nextBaseline)) {
    for (const [s, v] of Object.entries(sets)) {
      const isNew = eNew.some((x) => x.file === f && x.set === s)
      console.log(`    ${isNew ? "NEW " : "    "}· ${f.padEnd(36)} ${String(v.named).padStart(2)}/${v.total} of ${s}`)
    }
  }
  console.log(
    `  A DELIBERATE subset is declarable — put \`// gate-integrity: partial <SetName> — <reason>\`` +
      `\n  in the gate and it drops out of this table entirely. \`--rebaseline\` accepts the current` +
      `\n  levels as the new watermark; do that only when the gaps have been LOOKED at.`,
  )

  /* ---- CHANNEL F · FRESHNESS — a bare run must not grade a dead build ---- */
  console.log("\n--- F · default --label captures, against the mtime of the code they grade ---")
  const fRows = []
  const fSkipped = []
  const subjWhen = new Date(subjectMtime()).toISOString().slice(0, 16).replace("T", " ")
  console.log(`  newest source under lib/ app/ components/: ${subjWhen}`)
  for (const r of rows) {
    const p = probeFreshness(r)
    if (p.skip) {
      if (r.labelDefault) fSkipped.push({ file: r.file, why: p.skip })
      continue
    }
    fRows.push({ file: r.file, ...p })
    if (!p.ok) failed++
    console.log(
      `  ${p.ok ? "PASS" : "FAIL"}  ${r.file.padEnd(38)} ${String(p.source).padEnd(12)} --label=${String(p.label).padEnd(16)} ${p.why}`,
    )
  }
  if (fSkipped.length) {
    console.log(`  ${fSkipped.length} carry a default --label this sweep could not resolve to a directory — NOT a pass:`)
    for (const s of fSkipped) console.log(`    · ${s.file} — ${s.why}`)
  }

  /* ---- CHANNEL D · SUBJECT — mutate a named constant, require a red ------ */
  console.log("\n--- D · move a constant the gate NAMES; the gate must notice ---")
  const dRows = []
  const dSkipped = []
  if (NO_MUTATE) {
    console.log("  (--no-mutate: skipped. This channel is NOT a pass; it is unrun.)")
    for (const r of rows) dSkipped.push({ file: r.file, why: "--no-mutate" })
  } else {
    for (const r of rows) {
      if (r.file.endsWith("assert-gate-integrity.mjs")) {
        dSkipped.push({ file: r.file, why: "this file — its own control is --calibrate against lib/gate-fixtures/" })
        continue
      }
      const p = probeMutation({ ...r, file: r.path })
      if (p.skip) {
        dSkipped.push({ file: r.file, why: p.skip, names: p.names })
        continue
      }
      dRows.push({ file: r.file, ...p })
      if (!p.ok) failed++
      console.log(
        `  ${p.ok ? "PASS" : "FAIL"}  ${r.file.padEnd(38)} killed ${p.killed}/${p.tested} sampled of ${p.names} named constant(s)` +
          (p.ok ? `  — e.g. ${p.killer}` : ""),
      )
      if (!p.ok) {
        console.log(`          SURVIVED EVERY MUTANT of a constant it names. Tested:`)
        for (const s of p.survivors) console.log(`            · ${s}`)
      }
    }
  }
  console.log(
    `  ${dSkipped.length} NOT MUTATED — a SKIP IS NOT A PASS, each one named:` +
      (dRows.length ? `` : ` (nothing was probed)`),
  )
  for (const s of dSkipped) console.log(`    · ${s.file} — ${s.why}`)

  /* ---- CHANNEL G · SKIP — did any of the runs D made sell a skip as a pass? */
  console.log("\n--- G · a skip counted as a pass, on the runs this sweep already made ---")
  const gRows = []
  if (NO_MUTATE) {
    console.log("  (--no-mutate: G rides on D's base runs, so it is unrun too. NOT a pass.)")
  } else {
    /* Only gates D ALREADY RAN. G is a second reading of the same output, never a
     * second execution — re-running the battery here is what hung the sweep. A
     * gate D skipped is therefore unjudged by G, and is named below rather than
     * counted. */
    const gUnrun = []
    for (const r of rows) {
      if (r.file.endsWith("assert-gate-integrity.mjs") || r.drivesBrowser) continue
      if (!BASE_RUNS.has(r.path)) {
        gUnrun.push(r.file)
        continue
      }
      const base = BASE_RUNS.get(r.path)
      const j = judgeSkip(base.out, base.code)
      if (j.ok) continue
      gRows.push({ file: r.file, ...j })
      failed++
      console.log(`  FAIL  ${r.file.padEnd(38)} ${j.why}`)
    }
    if (gUnrun.length) {
      console.log(`  ${gUnrun.length} NOT JUDGED — D never ran them, so there is no output to read. NOT a pass:`)
      for (const f of gUnrun) console.log(`    · ${f}`)
    }
    console.log(
      gRows.length
        ? ``
        : `  no model-only gate printed a skip under an all-pass summary. Browser gates are not run here.`,
    )
  }

  /* ---- CHANNEL I · BARE — the invocation the next person will type -------
   *
   * D already ran every model gate with no arguments. The first draft filed a
   * red bare run as a SKIP ("cannot mutate what is already red"), which buried
   * the single most actionable fact the sweep holds: this gate, typed the way
   * anyone would type it, says the build is broken.
   *
   * Two things make a bare red, and the sweep cannot tell them apart — so it
   * reports the fact and demands a human decide:
   *   · the SURFACE is broken, which must be visible; or
   *   · the DEFAULTS are wrong, which is `assert-pentip-specks`'s defect —
   *     fresh capture, complete inventory, correct assertion, and the two arms
   *     being compared are not the two the row is a claim about.
   * Either way a gate that is red when typed bare is not in a shippable state,
   * so it fails here rather than being noted. */
  console.log("\n--- I · BARE — every model gate, typed with no arguments ---")
  const iRows = []
  const iUnrun = []
  const iPartial = []
  for (const r of rows) {
    if (r.file.endsWith("assert-gate-integrity.mjs") || r.drivesBrowser) continue
    if (!BASE_RUNS.has(r.path)) {
      iUnrun.push(r.file)
      continue
    }
    const b = BASE_RUNS.get(r.path)
    if (b.code === 0 && !b.timedOut) continue
    /* EXIT 3 IS PARTIAL, NOT RED (Lane K's hunk 3 — a DEPENDENCY of work already
     * landed in `assert-tsc-baseline.mjs` and `assert-data-safety.mjs`).
     *
     * `assert-tsc-baseline` was the one gate of 32 that stayed GREEN pointed at a
     * dead port: two PASS rows, two SKIPs, exit 0. It now exits 3 — PARTIAL:
     * nothing failed and a channel was never REACHED — and prints an `UNSWEPT`
     * line naming the channel and the command that answers it.
     *
     * Reporting that as "the bare run is broken" is the wolf-crying this file's
     * header warns about, in every lane tree (none of which has a dev server);
     * reporting it as a PASS would be the skip-as-pass that channel G exists for.
     * So it is a third row: named, never counted green, never counted red. */
    if (b.code === 3 && !b.timedOut) {
      const un = (b.out.match(/^.*\bUNSWEPT\b.*$/m) || ["(exit 3 with no UNSWEPT line — the gate should print one)"])[0]
      iPartial.push({ file: r.file, why: un.trim().slice(0, 150) })
      console.log(`  PARTIAL  ${r.file.padEnd(36)} bare run exits 3 — ${un.trim().slice(0, 110)}`)
      continue
    }
    iRows.push({ file: r.file, code: b.code, timedOut: b.timedOut })
    failed++
    const firstFail = (b.out.match(/^.*(?:\*\*\* )?FAIL\b.*$/m) || ["(no FAIL row — non-zero exit without one)"])[0]
    console.log(
      `  FAIL  ${r.file.padEnd(38)} bare run exits ${b.timedOut ? "TIMEOUT" : b.code}` +
        `\n          ${firstFail.trim().slice(0, 150)}` +
        `\n          Either the surface is broken or the DEFAULTS point at the wrong arms. Both need a person.`,
    )
  }
  if (!iRows.length) console.log("  every model gate is green when typed with no arguments.")
  if (iPartial.length) {
    console.log(`  ${iPartial.length} PARTIAL when typed bare — a channel each could not REACH. NOT a pass and NOT a red:`)
    for (const p of iPartial) console.log(`    · ${p.file} — ${p.why}`)
  }
  if (iUnrun.length) {
    console.log(`  ${iUnrun.length} NOT RUN BARE — no output to read. NOT a pass:`)
    for (const f of iUnrun) console.log(`    · ${f}`)
  }

  /* ---- CHANNEL H · DIALS — reported, never gated ------------------------- */
  const browserRows = rows.filter((r) => r.drivesBrowser)
  const axes = ["scrub", "resize", "inkDial"]
  const untouched = Object.fromEntries(axes.map((a) => [a, browserRows.filter((r) => !r.movesWhat[a])]))
  const noneOfThree = browserRows.filter((r) => axes.every((a) => !r.movesWhat[a]))
  console.log("\n--- H · REPORTED, NOT GATED · which dials the battery actually moves ---")
  console.log(
    `  The pen-field allocation bug that broke the mark for days was reachable ONLY by moving a\n` +
      `  control: a plain load-and-play never resizes the field, the wobble slider and the endpoint\n` +
      `  pill both do. So the question is not "does this gate move something" — every browser gate\n` +
      `  writes some state, and asking it that way returned 0 of ${browserRows.length} twice. It is which of the three\n` +
      `  axes that REALLOCATE get exercised. Coverage class, not instrument class: counted, not failed.\n`,
  )
  for (const a of axes) {
    console.log(
      `  ${a.padEnd(8)} moved by ${browserRows.length - untouched[a].length}/${browserRows.length} browser gates`,
    )
  }
  console.log(`\n  ${noneOfThree.length} browser gate(s) move NONE of the three. Each one named:`)
  for (const r of noneOfThree) console.log(`    · ${r.file}`)

  const OUT = join(ROOT, "docs", "verification", "gate-integrity")
  mkdirSync(OUT, { recursive: true })
  writeFileSync(
    join(OUT, "report.json"),
    JSON.stringify(
      {
        rows,
        unprobed,
        inventory: eRows,
        freshness: { rows: fRows, unresolved: fSkipped },
        mutation: { rows: dRows, skipped: dSkipped },
        skipAsPass: gRows,
        withheldArms: jRows,
        deferredArms: jDeferred,
        redWhenBare: iRows,
        dialCoverage: {
          axes,
          movesNone: noneOfThree.map((r) => r.file),
          perAxisUntouched: Object.fromEntries(axes.map((a) => [a, untouched[a].map((r) => r.file)])),
        },
      },
      null,
      2,
    ),
  )

  console.log(
    failed === 0
      ? `\nALL ${files.length} assert-* SCRIPTS ARE GATES, AND EVERY ONE PROBED WAS SHOWN ABLE TO FAIL.`
      : `\n${failed} FAILURE(S) across channels A-L, scripts named assert-* that cannot report a failure,` +
          `\nor cannot report the failure they exist for, or self-tests beside them that no longer say no.`,
  )
  console.log(`wrote ${join(OUT, "report.json")}`)
  process.exit(failed === 0 ? 0 : 1)
}

main()

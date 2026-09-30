// STORED EVIDENCE HAS TO BELONG TO THIS TREE. The provenance check every
// PNG-grading gate in this directory was missing.
//
// ── THE DEFECT THIS EXISTS FOR (class 6) ──────────────────────────────────
//
//   Six gates in scripts/verify/ decide PASS/FAIL by loading PNGs off disk. Not
//   one of them ever asked whether those PNGs were rendered by the code being
//   graded. There is no manifest hash, no git SHA, no mtime comparison — the
//   only thing a `--label=` selects is a directory name.
//
//   Measured on this tree, 2026-08-02:
//     docs/verification/stack-anim-v1   captured 2026-08-01 13:52
//     lib/style-stack.ts                last written 2026-08-01 23:59
//   The stack-animation gate was grading a build ten hours and seven minutes
//   older than the module it claims to guard, and reporting ALL PASS. Timing is
//   worse: timing-v1 is from 2026-07-28 16:18, four days and eight hours behind
//   lib/style-clock.ts.
//
//   A green row on stale frames is not a weak signal. It is a FALSE one: it
//   says "the current code does X" on evidence that cannot speak about the
//   current code at all. Every regression landed in those ten hours is invisible
//   and will stay invisible for as long as nobody re-captures.
//
// ── WHY IT FAILS RATHER THAN WARNS ────────────────────────────────────────
//
//   `assert-timing-frames.mjs` already carries the shape to copy: a MANIFEST of
//   required frame counts that REFUSES on incomplete evidence rather than
//   grading what happens to be there. Same rule here. A warning that the
//   evidence is stale, printed above a wall of PASS rows, is read as "PASS with
//   a note" — this repo has shipped that shape before and it is how the ten-hour
//   gap survived. "We did not look at the current build" must not exit 0.
//
//   THE FIX IS NEVER TO LOWER THIS. It is to re-run the matching verify-*.mjs
//   capture script, which takes minutes and produces evidence that means
//   something.
//
// ── WHAT IS COMPARED ──────────────────────────────────────────────────────
//
//   capture side  the NEWEST artefact in the capture directory. Deliberately the
//                 newest and not the oldest: it is the most generous reading of
//                 the evidence, so a set that fails this has no frame at all
//                 that post-dates its subject.
//   subject side  the NEWEST source file under lib/. Deliberately the whole
//                 tree and not a hand-picked module list, because a hand-picked
//                 list is the same hand-maintained-table rot these gates keep
//                 dying of — a new module a gate transitively depends on would
//                 never be added to it.
//
//   `subjects` narrows only the EXPLANATORY line, never the verdict: it names
//   the modules the gate believes it is grading so a reader can tell a genuine
//   subject change from an unrelated one, without letting that judgement soften
//   the gate.

import { readdirSync, statSync, existsSync } from "node:fs"
import { join, dirname, relative } from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

const SOURCE_EXT = /\.(ts|tsx|js|mjs|glsl)$/

/** Newest source file under a directory, recursively. */
export function newestUnder(dir, filter = SOURCE_EXT) {
  let best = { ms: 0, file: null }
  const walk = (d) => {
    let entries
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = join(d, e.name)
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name.startsWith(".")) continue
        walk(p)
        continue
      }
      if (!filter.test(e.name)) continue
      const ms = statSync(p).mtimeMs
      if (ms > best.ms) best = { ms, file: p }
    }
  }
  walk(dir)
  return best
}

/** Newest artefact in a capture directory, recursively (PNG / JSON evidence). */
export function newestCapture(dir, filter = /\.(png|json|jpg|webm)$/) {
  return newestUnder(dir, filter)
}

const rel = (p) => (p && p.startsWith(ROOT) ? relative(ROOT, p) : p)
/* LOCAL time, not ISO/UTC. The reader compares these against `ls -la`, and a
 * timestamp that disagrees with the shell by the UTC offset reads as a bug in
 * the gate and gets the whole row discounted. */
const stamp = (ms) => {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
const hours = (ms) => (ms / 3600000).toFixed(1)

/**
 * Decide whether a stored capture directory may be graded at all.
 *
 * @param {string} captureDir  absolute path to the evidence directory
 * @param {object} opts
 * @param {string[]} opts.subjects  repo-relative paths named for the report line
 * @param {string}   opts.recapture the command that regenerates the evidence
 * @returns {{ok:boolean, label:string, detail:string}}
 */
export function captureFreshness(captureDir, { subjects = [], recapture = "the matching verify-*.mjs" } = {}) {
  const cap = newestCapture(captureDir)
  const lib = newestUnder(join(ROOT, "lib"))

  if (!cap.file) {
    return {
      ok: false,
      label: "PROVENANCE · the stored evidence belongs to this tree",
      detail: `no artefacts at ${rel(captureDir)} — nothing to grade. Run ${recapture}.`,
    }
  }
  if (!lib.file) {
    return {
      ok: false,
      label: "PROVENANCE · the stored evidence belongs to this tree",
      detail: "no source files found under lib/ — the freshness comparison cannot be made, so no verdict below is trustworthy",
    }
  }

  // The named subjects narrow the EXPLANATION only. They never decide.
  const named = subjects
    .map((s) => ({ s, p: join(ROOT, s) }))
    .filter(({ p }) => existsSync(p))
    .map(({ s, p }) => ({ s, ms: statSync(p).mtimeMs }))
    .sort((a, b) => b.ms - a.ms)
  const namedNewest = named[0] || null

  const behind = lib.ms - cap.ms
  const ok = behind <= 0

  const subjectNote = namedNewest
    ? ` · named subject ${namedNewest.s} ${stamp(namedNewest.ms)}${namedNewest.ms > cap.ms ? " (ALSO newer than the capture)" : " (older than the capture)"}`
    : ""

  return {
    ok,
    label: "PROVENANCE · the stored evidence post-dates every source file it grades",
    detail: ok
      ? `capture ${rel(cap.file)} ${stamp(cap.ms)} · newest under lib/ ${rel(lib.file)} ${stamp(lib.ms)}${subjectNote}`
      : `STALE BY ${hours(behind)}h — newest capture ${rel(cap.file)} ${stamp(cap.ms)} but ${rel(lib.file)} was written ${stamp(lib.ms)}. ` +
        `Every verdict below describes a build that no longer exists. Re-capture with ${recapture}; do NOT relax this check.${subjectNote}`,
  }
}

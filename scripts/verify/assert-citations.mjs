// ASSERT — every `file:line` citation in the APPLICATION SOURCE TREE still
// points at what it claims to point at.
//
// ── WHAT CHANGED 2026-08-07, AND THE NUMBER THAT MOTIVATED IT (lane AA) ─────
// It said "in the engine modules" and meant seven files named in a list below.
// The source tree has 123. Measured: those seven carried **14 of the 144
// `:line` citations in the tree — 9.7%**. Explainer 46 is the write-up; the
// short version is that this gate was the eighth instance of explainer 43's
// shape, and the most self-referential: an instrument that checks whether a
// claim points at its evidence, which was itself a claim that did not point at
// its evidence. Its header even named the file it was not watching.
//
// SCAN is discovered by walking now, not listed, so a new module is covered with
// no edit here. On the first honest run: **1 159 citations, 44 ROTTED.**
//
// ── THE VERDICT IS RATCHETED, AND THE ROWS SAY SO ───────────────────────────
// 44 rotted citations live in files this gate's owner may not write, so "fail
// until they are all fixed" would make it red forever — and a gate that cries
// wolf gets switched off, which is the argument the DRIFT_WINDOW note below
// already makes. So the three rot counts are pinned in `citation-baseline.json`
// (Lane O's mechanism, copied not reinvented) and may FALL, never RISE. A new
// rotted citation turns the RATCHET row red.
//
// Per-citation lines are prefixed `ROT` / `WARN`, NOT `FAIL`. They are evidence
// behind a pinned count, not verdicts, and `run-battery.mjs` counts `FAIL` rows:
// leaving them as FAIL made the sweep read **44 red rows from a gate that exits
// 0** — the summary disagreeing with the rows, which is the exact defect the
// hardcoded-PASS note at the bottom of this file records. Same distinction Lane
// K drew in explainer 34 §1 between a row and a summary. The verdict rows are
// the ratchet, the ledger, the rulings and the controls: 17 rows, all readable.
//
// The HARD channels — the ones that still fail outright — are the KNOWN_OPEN
// ledger, the NOT-A-PATH rulings, and every control.
//
// WHY THIS EXISTS. The dispatch contract states the rule and the failure that
// produced it: *"A citation is not evidence — OPEN THE LINE YOU CITE.
// Line-numbers rot: tonight's briefs were wrong repeatedly."* The engine modules
// here carry thousands of lines of comment that ARE the documentation, and they
// cite each other and the components by `path:line`. Measured 2026-08-02, before
// this gate existed: six of the ten checkable `file:line` citations in the six
// engine modules pointed at the wrong line, one comment cited
// `docs/explainers/08-implicit-fusion.md` — a file that has never existed — and
// several cited `assert-*` scripts that had not been written.
//
// A wrong citation is worse than none: it sends a reader to a line that looks
// unrelated, and the natural conclusion is that they have misunderstood the code
// rather than that the comment is stale.
//
// ── HOW IT CANNOT PASS ON A STALE NUMBER ────────────────────────────────────
// Checking that the path exists is not enough — every wrong number pointed into
// a file that exists. So a citation must carry an ANCHOR: a backticked
// identifier or quoted string on the citation's own line or the line either side
// of it. The anchor must appear ON the cited line. When it does not, the gate
// SEARCHES the file and prints where the anchor actually is, so the failure
// arrives with its own fix.
//
// ── THE ONE-SCREEN WINDOW, AND WHY IT IS NOT A DEFEAT ───────────────────────
// Several of these citations point into `components/viewport-3d.tsx` and
// `lib/flat-ink.ts`, which OTHER LANES are editing right now; two of them moved
// by ten lines during the run that produced this file. Demanding an exact line
// across a file this lane does not own makes the gate red for reasons nobody in
// this lane can fix, and a gate that cries wolf gets switched off — which is how
// a real defect then ships (explainer 19 §3 makes the same argument about
// per-component fold counting).
//
// So: anchor ON the line = PASS. Anchor within ONE SCREEN (40 lines) = DRIFT —
// reported, counted, printed with the true line, not fatal, because a reader
// following the citation still lands on the right thing. Anchor anywhere else,
// or nowhere in the file, or the file missing = FAIL. The window is calibrated,
// not defeated: a citation off by hundreds of lines, or pointing at a symbol
// that no longer exists, still fails.
//
// ── UNCHECKABLE IS NOT A PASS ───────────────────────────────────────────────
// A citation with no usable anchor is reported and counted, never silently
// skipped — the `assert-gate-integrity` lesson applied to this instrument:
// *"names anything it could not probe rather than skipping it."*
//
// ── THE KNOWN_OPEN LEDGER ───────────────────────────────────────────────────
// Same pattern as the fold census (explainer 19 §4): defects that exist, are
// measured, and belong to somebody else are PINNED at their exact count rather
// than left to be rediscovered. A new one fails. A pinned one getting WORSE
// fails. A pinned one getting BETTER also fails, loudly, so the ledger is
// updated rather than quietly over-permitting for the next reader.
//
// ── THE CONTROLS RUN ON THE BARE INVOCATION ─────────────────────────────────
// They used to live behind `--selftest`, and that flag ALSO exited before the
// real rows — so the gate had two modes and no invocation ran both. Nothing in
// this repo ever typed it, which made the greens above worth exactly what an
// unrun control is worth (`docs/explainers/21-losing-your-work.md` §7: *"the
// gate runs three kinds of control on the DEFAULT invocation, never behind a
// flag"*; explainer 31 counted 19 gates violating it and this was one).
//
// The flag is DELETED rather than handed to a runner, for explainer 29 §5's
// reason: a runner-passed flag only helps people who go through a runner, and
// anyone typing this gate's name still gets the half of it that cannot fail.
//
// `judge()` is the whole judgement, and the controls grade THE SAME judge the
// real citations do — a second implementation of the check would be the copy
// certifying the original. Three known-bads run every time:
//
//   1. a citation whose anchor is NOT on the line it names must be REJECTED,
//      paired with a correct one that must be ACCEPTED (a checker that refuses
//      everything is as blind as one that accepts everything);
//   2. a KNOWN_OPEN pin whose file is no longer cited must fail LEDGER STALE;
//   3. a KNOWN_OPEN pin whose count has moved must fail LEDGER MOVED.
//
// (2) and (3) exist because `KNOWN_OPEN` is `{}` on this tree, so the ledger's
// two-directional PASS row asserts nothing about anything — the exact shape of
// a green that cannot fail, one row below the one this file was dispatched for.
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { ROOT } from "./_ts-load.mjs"

const RECORD = process.argv.includes("--record")
const RECITE = process.argv.includes("--recite")
const WRITE = process.argv.includes("--write")
const LIST = process.argv.includes("--list")

/* ═══════════════════════════════════════════════════════════════════════════
 * THE SUBJECT IS DISCOVERED, NOT LISTED. (Lane AA, 2026-08-07.)
 *
 * `SCAN` was seven hand-written engine modules. `lib/flat-ink.ts` was not one of
 * them, and on 2026-08-07 lane X found FOUR rotted citations in it — one of them
 * lane T's own, rotted by the same edit that wrote it (T inserted 25 comment
 * lines above the clause it was citing, so `:848` became `:880` as the sentence
 * describing it was being typed). Explainer 42 §4 states the shape:
 *
 *   "assert-citations.mjs exists precisely to catch this and would have caught
 *    all of it — but its SCAN list is seven engine modules, and lib/flat-ink.ts
 *    is not one of them, DESPITE THE GATE'S OWN HEADER NAMING IT as a file whose
 *    citations move."
 *
 * MEASURED BEFORE THIS CHANGE: the seven files carried 14 of the 144 `file:line`
 * citations in the source tree. **The gate watched 9.7% of its own subject.**
 *
 * A hand-list is what produced that, so it is not replaced with a longer
 * hand-list. The criterion is a SCOPE, and every file in it is found by walking:
 *
 *     every .ts / .tsx file under app/ components/ hooks/ lib/
 *
 * — the application source tree, whose comments ARE this project's
 * documentation. A new module is picked up with no edit to this file, which is
 * the promise `docs/README.md:311` already makes for gates themselves ("Add a
 * new `assert-*` and it will be checked automatically") applied to their
 * subject. There is deliberately NO size or citation-count threshold: a
 * threshold is a place for a file to hide by losing a citation, and "over N
 * lines" would have excluded `lib/hand-feel.ts` — 237 lines carrying 19 `:line`
 * citations, more than the entire previous SCAN.
 * ═══════════════════════════════════════════════════════════════════════════ */
const ROOTS = ["app", "components", "hooks", "lib"]

function discover() {
  const out = []
  const walk = (rel) => {
    const entries = readdirSync(join(ROOT, rel), { withFileTypes: true })
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const e of entries) {
      if (e.name.startsWith(".")) continue
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) walk(r)
      else if (/\.tsx?$/.test(e.name)) out.push(r)
    }
  }
  for (const r of ROOTS) if (existsSync(join(ROOT, r))) walk(r)
  return out
}
const SCAN = discover()

/** One screen. See the header. */
const DRIFT_WINDOW = 40

/**
 * MISSING FILES THIS LANE DID NOT CREATE AND MAY NOT WRITE, pinned at their
 * exact citation count. Empty today — and it did its job on the way there: it
 * was seeded with two `penfield` harnesses believed missing, and the exact-count
 * check immediately reported LEDGER STALE because both exist. A ledger that can
 * only ever over-permit is not a ledger.
 */
const KNOWN_OPEN = {}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE RATCHET — because widening SCAN found more rot than one lane can fix, and
 * "fix it all first" is how a gate never lands.
 *
 * This is NOT a third mechanism. It is Lane O's, copied from
 * `assert-one-knob.mjs` + `one-knob-baseline.json`, including both halves that
 * were learned the hard way and are load-bearing:
 *
 *   1. THE GROUND LIVES IN A DATA FILE, NOT A PRIVATE CONST. Lane J paid 85
 *      sites down and COULD NOT RECORD IT, because lowering the number meant
 *      editing a gate it did not own (DISPATCH §4: two live lanes may never hold
 *      the same file). "A ratchet only its author can lower is a debt counter,
 *      not a gate." Every lane here is in exactly that position: the rotted
 *      citations live in `viewport-3d.tsx` and `flat-ink.ts`, which this lane
 *      may not write. So any lane that fixes one runs `--record` and holds the
 *      ground, owning nothing.
 *
 *   2. `--record` REFUSES WHILE ANY NON-RATCHET CHANNEL IS RED, and refuses any
 *      count that would RISE. O's first version ran BEFORE the sweep and was a
 *      laundering channel — with two known-bads planted the sweep went red and
 *      `--record` still wrote the number down, because it had headroom. Both
 *      consequences are kept here: `--record` runs LAST, and a red control or a
 *      red ledger blocks it.
 *
 * A MISSING BASELINE IS A FAILURE, NOT A DEFAULT. Falling back to a built-in
 * number would make deleting the file a way to choose the ceiling.
 * ═══════════════════════════════════════════════════════════════════════════ */
const BASELINE_FILE = join(dirname(new URL(import.meta.url).pathname), "citation-baseline.json")
const BASELINE_KEYS = {
  stale: "citations pointing at a line that no longer contains what they claim",
  missing: "citations naming a file that does not exist",
  uncheckable: "citations with no anchor this gate can grade",
}
function readBaseline() {
  if (!existsSync(BASELINE_FILE)) return null
  try {
    const j = JSON.parse(readFileSync(BASELINE_FILE, "utf8"))
    for (const k of Object.keys(BASELINE_KEYS))
      if (!Number.isInteger(j[k])) return { bad: `\`${k}\` is missing or not an integer` }
    if (j.notAPath && typeof j.notAPath !== "object") return { bad: "`notAPath` is not an object" }
    return j
  } catch (e) {
    return { bad: String(e.message).slice(0, 120) }
  }
}
/** THE RATCHET, as one function so --record and the controls ask the SAME
 *  question. A measurement may be recorded only if no count rises. */
function canRecord(measured, base) {
  if (!base || base.bad) return { ok: false, rises: [], why: "there is no readable baseline to compare against" }
  const rises = Object.keys(BASELINE_KEYS).filter((k) => measured[k] > base[k])
  return { ok: rises.length === 0, rises, why: rises.map((k) => `${k}: ${base[k]} -> ${measured[k]}`).join(" · ") }
}

/* `tsx` before `ts` so a `.tsx` path is not truncated to `.ts` + a stray `x` —
 * an earlier draft of this scan reported six phantom "missing" files that way,
 * which is the shape of an instrument that finds defects it invented.
 *
 * ⚠ THAT FIX WAS HALF OF THE RULE, AND THE OTHER HALF WAS STILL LIVE. Ordering
 * the alternation fixes `.tsx`; it does nothing for an extension followed by
 * MORE extension. Measured on the widened scan, 2026-08-07: `package.json` was
 * being read as the file `package.js` (3×), `tsconfig.json` as `tsconfig.js`,
 * and `logo-strokes.json` as `logo-strokes.js` (3×) — seven phantom "missing"
 * files, the SAME defect class the sentence above records as fixed, surviving in
 * the half of the pattern nobody re-read. The trailing boundary is the whole
 * rule: an extension may not be followed by another word character. */
const CITE = /([~A-Za-z0-9_\-./]+\.(?:tsx|mjs|ts|js|md))(?![A-Za-z0-9])(?::(\d+))?/g
const ANCHOR = /`([^`\n]{2,80})`|"([^"\n]{3,80})"/g

/* ── THE RESOLVER INDEXES THE TREE; IT NO LONGER GUESSES AT ELEVEN DIRECTORIES ─
 *
 * `SEARCH_DIRS` was an eleven-entry hand-list of "directories a bare filename
 * can mean" — the same defect as `SCAN` one layer down, and it was failing the
 * same way. Measured 2026-08-07 on the widened scan: `compose.ORIGINAL-FLIP.mjs`
 * (6 citations) resolved NOWHERE because `docs/reference-original/` was not on
 * the list, and `motion.mjs` (3) because `scripts/capture/` was not either.
 * NINE citations reported as MISSING FILE against files that are on disk — an
 * instrument inventing defects, which the EXTERNAL note below already calls
 * worse than one that misses them.
 *
 * So the index is BUILT by walking the repo. A new directory needs no edit here,
 * and a bare filename resolves iff exactly one file in the tree carries that
 * name — AMBIGUITY IS REPORTED, never silently resolved to the first hit, which
 * is what an ordered list does by construction. The walk costs ~15 ms over 733
 * text files; `node_modules`, `.next` and the evidence tree are pruned. */
const INDEX_EXT = /\.(tsx|ts|mjs|js|md|json)$/
const INDEX_PRUNE = new Set(["node_modules", ".next", ".git", "dist", "build"])

function buildIndex(root) {
  /** exact repo-relative path -> true */
  const byPath = new Set()
  /** basename -> [repo-relative paths] */
  const byName = new Map()
  const walk = (rel) => {
    let entries
    try {
      entries = readdirSync(join(root, rel), { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || INDEX_PRUNE.has(e.name)) continue
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) walk(r)
      else if (INDEX_EXT.test(e.name)) {
        byPath.add(r)
        const list = byName.get(e.name)
        if (list) list.push(r)
        else byName.set(e.name, [r])
      }
    }
  }
  walk("")
  return { byPath, byName }
}

const REPO_INDEX = buildIndex(ROOT)

/* ⚠ THE EVIDENCE TREE HOLDS COPIES OF THE SOURCE TREE, AND THEY SHADOWED IT.
 *
 * `docs/verification/unfinished-lane-T/lib/flat-ink.ts` is a SNAPSHOT of
 * `lib/flat-ink.ts` — a dead lane's tree, kept as evidence. Indexing both made a
 * bare `flat-ink.ts` ambiguous, and the first cut of this resolver reported
 * `flat-ink.ts`, `page.tsx`, `viewport-3d.tsx`, `style-fusion.ts` and four gate
 * names as MISSING FILES *because there were two of each*. Eleven invented
 * defects, in the resolver written to stop invented defects.
 *
 * A snapshot is not a citable target: nobody writing `flat-ink.ts` in a comment
 * means a dead lane's copy of it. So live paths WIN over evidence paths, and
 * ambiguity is only reported when it survives that. An explicit
 * `docs/verification/...` path still resolves exactly — this ranks, it does not
 * hide. */
const EVIDENCE = /^docs\/verification\//

/** Resolve `p` against an index. Returns the repo-relative path, `{ambiguous}`, or null. */
function resolveIn(index, p) {
  const norm = p.replace(/^\.\//, "")
  if (index.byPath.has(norm)) return norm
  const pick = (hits) => {
    if (hits.length === 1) return hits[0]
    const live = hits.filter((f) => !EVIDENCE.test(f))
    if (live.length === 1) return live[0]
    return { ambiguous: live.length ? live : hits }
  }
  /* a citation may name a suffix of the real path — `smartHachure/index.ts` for
   * `src/app/lib/smartHachure/index.ts`. Suffix must start at a path boundary. */
  const suffix = [...index.byPath].filter((f) => f.endsWith("/" + norm))
  if (suffix.length) return pick(suffix)
  if (!norm.includes("/")) {
    const hits = index.byName.get(norm)
    if (hits && hits.length) return pick(hits)
  }
  return null
}

function resolveRepo(p) {
  const r = resolveIn(REPO_INDEX, p)
  return r && r.ambiguous ? null : r
}

/* ── A PORT'S COMMENTS BELONG TO THE REPO IT CAME FROM ──────────────────────
 *
 * `lib/dd-engine/` is Desk Doodles' engine copied across byte-for-byte, and its
 * comments cite Desk Doodles' tree — `Stroke3DScene.tsx`, `smartHachure/index.ts`,
 * `docs/design/3d-roundtrip-build-plan.md`. Graded against THIS repo they are 60+
 * missing files; graded against the repo they were written in, they are ordinary
 * citations that mostly resolve. Calling them rot would be the instrument
 * inventing defects again, and exempting the directory by name would be the
 * hand-list defect a third time.
 *
 * So it is DERIVED FROM THE FILE. Each port carries a provenance header naming
 * its own origin:
 *
 *     //   source repo   ~/Desktop/Projects/desk-doodles  @ cb97683
 *     //   source file   src/app/lib/geometry3d/strokeTo3d.ts
 *
 * — so the gate reads that line and resolves that file's citations against that
 * tree first. It is strictly better than the directory hand-list it replaces,
 * and measurably so: 14 files declare it and one of them, `lib/dd-extrude-relief.ts`,
 * is OUTSIDE `lib/dd-engine/` entirely. A list of "dd-engine/*" would have missed
 * it. The two files in that directory WITHOUT the header — `adapter.ts` and
 * `external-types.ts`, Free Stroke's own code by their own headers — are
 * correctly graded against this repo.
 *
 * A future port from anywhere gets this for free, provided it declares itself.
 * A port that does NOT declare itself is graded here, which is the right default:
 * an undeclared port is indistinguishable from our own code, and should be. */
const HOME = process.env.HOME ?? ""
const PORT_DECL = /^\s*(?:\/\/|\*)\s*source repo\s+(\S+)/m
const EXT_INDEX_CACHE = new Map()

function portRootOf(relFile) {
  let head
  try {
    head = readFileSync(join(ROOT, relFile), "utf8").slice(0, 4000)
  } catch {
    return null
  }
  const m = head.match(PORT_DECL)
  if (!m) return null
  const abs = m[1].startsWith("~/") ? HOME + m[1].slice(1) : m[1]
  return existsSync(abs) ? abs : { missing: m[1] }
}

function externalIndex(root) {
  let idx = EXT_INDEX_CACHE.get(root)
  if (!idx) {
    idx = buildIndex(root)
    EXT_INDEX_CACHE.set(root, idx)
  }
  return idx
}

/** The port's own source path, so a `../smart/coverage.ts` in a ported comment
 *  resolves against the directory it was written in rather than against ours. */
/** Collapse `a/b/../c` to `a/c` without touching the filesystem. */
function normalisePath(p) {
  const out = []
  for (const seg of p.split("/")) {
    if (seg === "." || seg === "") continue
    if (seg === "..") out.pop()
    else out.push(seg)
  }
  return out.join("/")
}

const PORT_SRC = /^\s*(?:\/\/|\*)\s*source file\s+(\S+)/m
function portSrcDirOf(relFile) {
  try {
    const m = readFileSync(join(ROOT, relFile), "utf8").slice(0, 4000).match(PORT_SRC)
    return m ? dirname(m[1]) : null
  } catch {
    return null
  }
}

/* ── THE SIBLING REPOS ARE DERIVED FROM THE PORTS, NOT LISTED ───────────────
 *
 * These comments cite Desk Doodles constantly — `DeskDoodlesHome.tsx:637`,
 * `desk-doodles/docs/submission/VIDEO-DIRECTION.md`, `Stroke3DScene.tsx` — from
 * files that are NOT ports and so get no port root. Rather than name the repo
 * here (a hand-list, for the fourth time), the set of sibling repos IS the set
 * of `source repo` declarations already present in the tree. Today that is one
 * repo, declared by 14 files. A future port from a third repo makes that repo's
 * citations resolvable with no edit here.
 *
 * Consulted AFTER this repo's own index and only when that index came back
 * empty — never when it came back AMBIGUOUS. `page.tsx` names two real files
 * here and none in Desk Doodles; letting a sibling repo break an in-repo tie
 * would answer the wrong question quietly. */
const SIBLING_REPOS = [...new Set(SCAN.map(portRootOf).filter((p) => p && !p.missing))]

/**
 * PATHS THAT MEAN A FILE OUTSIDE THIS REPO — and, where the checkout is on this
 * machine, WHERE THAT FILE IS so the citation can still be verified.
 *
 * ⚠ THE ORDER MATTERS AND IT COST A ROUND OF FALSE POSITIVES. A bare
 * `strokeTo3d.ts:173` in these comments means DESK DOODLES' file. This repo also
 * has `lib/dd-engine/strokeTo3d.ts`, a byte-for-byte port with a 19-line
 * provenance header prepended — so resolving in-repo first made every one of
 * those citations report "+19 drift", against citations that are exactly right.
 * An instrument that invents defects is worse than one that misses them. So
 * EXTERNAL is consulted BEFORE the in-repo search, and the +19 is now the
 * evidence that the port is intact rather than a false alarm.
 */
const EXTERNAL = [
  { re: /^src\/app\/(.*)$/, root: "~/Desktop/Projects/desk-doodles/src/app/", strip: /^src\/app\// },
  {
    re: /^(strokeTo3d|handFeel)\.(ts|tsx)$/,
    root: "~/Desktop/Projects/desk-doodles/src/app/lib/geometry3d/",
  },
  {
    re: /^SvgStyleTransform\.(ts|tsx)$/,
    root: "~/Desktop/Projects/desk-doodles/src/app/components/canvas/",
  },
  /* An explicit `node_modules/...` path is third-party BY NAME — no ruling
   * needed and no guessing. The index prunes `node_modules`, so without this
   * the two citations that spell it out (`node_modules/dialkit/dist/index.js`,
   * `node_modules/sonner/dist/index.mjs`) read as missing files. They are
   * verified against the real installed package when it is present. */
  { re: /^node_modules\//, root: join(ROOT, "") + "/" },
  { re: /^three(\/|\.js$)/ },
  { re: /^THREE\.js$/ },
  { re: /^MarchingCubes\.js$/ },
  { re: /^[A-Z0-9][A-Z0-9-]+\.md$/ }, // ROCK3D-ENGINE-COMPLETE.md and friends
  { re: /^perfect-freehand/ },
]
/** The external file this path names, if it is on this machine. */
function resolveExternal(p) {
  for (const e of EXTERNAL) {
    if (!e.re.test(p)) continue
    if (!e.root) return { external: true, abs: null }
    const rel = e.strip ? p.replace(e.strip, "") : p
    const abs = (e.root.startsWith("~/") ? HOME + e.root.slice(1) : e.root) + rel
    return { external: true, abs: existsSync(abs) && statSync(abs).isFile() ? abs : null }
  }
  return null
}

const rows = []
const portRoots = {}
for (const f of SCAN) {
  const lines = readFileSync(join(ROOT, f), "utf8").split("\n")
  const port = portRootOf(f)
  if (port) portRoots[f] = port
  const portSrcDir = port && !port.missing ? portSrcDirOf(f) : null
  /* ── A CITATION WRAPPED ACROSS TWO COMMENT LINES IS STILL ONE CITATION ──────
   *
   * A line-based scan sees only the tail. Measured 2026-08-07, all three of
   * these name real files and all three read as MISSING:
   *
   *     `docs/research/competitive-landscape-and-the-   ->  missing-export.md
   *      missing-export.md`
   *     (docs/research/screen-space-layer-              ->  quality.md
   *      quality.md)
   *     (RUNNING-TODO-ARCHIVE                           ->  -pre-2026-06-19.md
   *      -pre-2026-06-19.md:111)
   *
   * The gate reported the FRAGMENT as a missing file — an invented defect, and a
   * particularly misleading one: `quality.md` looks exactly like a real file
   * somebody deleted. DISPATCH's trap is the instruction — a grep cannot tell
   * code from prose, PARSE.
   *
   * ⚠ AND THE OBVIOUS VERSION OF THIS FIX WAS WRONG, WHICH IS WHY IT IS A
   * PRE-PASS. Joining line i to line i+1 and then scanning i+1 AGAIN counts
   * every citation on a continuation line TWICE — measured, 1157 -> 1187
   * citations, an instrument inflating its own subject. So the continuation
   * token is MOVED, not copied: appended to line i and REMOVED from line i+1.
   * The reported line number stays the line the citation starts on. */
  const scanLines = lines.slice()
  const CONT = /^(\s*(?:\*|\/\/)\s*)([A-Za-z0-9_.\-/]{2,}(?::\d+)?)/
  for (let i = 0; i < scanLines.length - 1; i++) {
    if (!/^\s*(\*|\/\/|\/\*)/.test(scanLines[i])) continue
    /* the break can fall on EITHER side, and both shapes are in the tree:
     *   `…screen-space-layer-`  +  `quality.md`      (hyphen ends line i)
     *   `…RUNNING-TODO-ARCHIVE` + `-pre-2026-06-19.md` (hyphen opens line i+1)
     * so one side must carry the break and the other must complete a FILENAME. */
    const endsOpen = /[-/]\s*$/.test(scanLines[i])
    if (!endsOpen && !/[A-Za-z0-9_./-]\s*$/.test(scanLines[i])) continue
    const nm = scanLines[i + 1].match(CONT)
    if (!nm) continue
    const tok = nm[2]
    /* must complete into something file-shaped, and the break must be real.
     * A markdown bullet — `//   - smartHachure/index.ts` — yields the token `-`
     * alone (a space follows), is under two chars, and is rejected here. */
    if (!tok.includes(".")) continue
    if (!endsOpen && !/^[-/]/.test(tok)) continue
    scanLines[i] = scanLines[i].replace(/\s*$/, "") + tok
    scanLines[i + 1] = nm[1] + scanLines[i + 1].slice(nm[0].length)
  }

  scanLines.forEach((l, i) => {
    if (!/^\s*(\*|\/\/|\/\*)/.test(l)) return
    CITE.lastIndex = 0
    let m
    while ((m = CITE.exec(l))) {
      const p = m[1]
      /* `./foo.ts` is relative TO THE CITING FILE. It used to be rewritten to
       * `lib/` + the name unconditionally — correct only while every scanned
       * file lived in `lib/`, which stopped being true the moment SCAN was
       * widened to `components/` and `app/`. A relative path resolved against
       * the wrong directory is the citation defect this gate exists to catch,
       * committed by the gate. */
      const norm = p.startsWith("./") ? `${dirname(f)}/${p.slice(2)}` : p
      rows.push({
        file: f,
        line: i + 1,
        path: norm,
        port: port && !port.missing ? port : null,
        /* the same citation, resolved against the directory the PORTED file
         * lived in — `../smart/coverage.ts` from `src/app/lib/geometry3d/`. */
        portRel: portSrcDir && p.startsWith(".") ? normalisePath(`${portSrcDir}/${p}`) : null,
        ref: m[2] ? +m[2] : null,
        /* +/-3 lines, not +/-1. A comment often names the symbol a line or two
         * before the citation — `stroke-processing.ts:274` states the formula
         * two lines under the `SvgStyleTransform.tsx:1873-1874` it cites, and
         * that citation is exactly RIGHT. A window too tight reports a correct
         * citation as unanchored, which is a false alarm with extra steps. */
        ctx: lines.slice(Math.max(0, i - 3), i + 4).join("\n"),
        text: l.trim(),
      })
    }
  })
}

/* THE KNOWN-BAD AND ITS KNOWN-GOOD TWIN. `docs/README.md:1` reads
 * "# Free Stroke docs", so the second row's anchor IS on the cited line and the
 * first's is not — and `polygoniseCapsuleFieldBuffers` appears nowhere in that
 * file at all, so it cannot be excused as drift either. They are held OUT of
 * `rows` and graded separately: a control's red must never reach the subject's
 * count, or the gate reports its own control as a defect in the codebase. */
const CONTROL_CITATIONS = [
  {
    file: "<control-wrong>",
    line: 0,
    path: "docs/README.md",
    ref: 1,
    ctx: "CONTROL `polygoniseCapsuleFieldBuffers` at docs/README.md:1",
    text: "CONTROL wrong",
  },
  {
    file: "<control-right>",
    line: 0,
    path: "docs/README.md",
    ref: 1,
    ctx: "CONTROL `Free Stroke docs` at docs/README.md:1",
    text: "CONTROL right",
  },
]
/** A path that cannot resolve, for the ledger controls. */
const CONTROL_MISSING = "lib/__control_missing_file__.ts"
const controlMissingRow = {
  file: "<control-ledger>",
  line: 0,
  path: CONTROL_MISSING,
  ref: 1,
  ctx: "CONTROL `aFileThatDoesNotExist` at " + CONTROL_MISSING + ":1",
  text: "CONTROL ledger",
}

/** Anchors are matched exactly, then by their leading identifier — `Foo.bar`
 *  is satisfied by the line that DECLARES `Foo`. Not a loosening: a citation to
 *  a member is a citation to where its owner lives. */
function anchorForms(t) {
  const forms = [t]
  const id = t.match(/^[A-Za-z_$][\w$]*/)
  if (id && id[0] !== t && id[0].length >= 3) forms.push(id[0])
  return forms
}

/**
 * THE WHOLE JUDGEMENT, IN ONE PLACE, so the controls grade the same code the
 * real citations do. It was straight-line statements against module-level
 * counters until 2026-08-07; the only change is that they are now fields on a
 * returned object, because a control has to be able to run it a second time
 * without its findings landing in the subject's totals.
 */
function judge(rows, ledgerPins, mentionRulings = {}) {
let missingNew = 0
let stale = 0
let uncheckable = 0
let drift = 0
let ok = 0
let external = 0
let ruledMention = 0
const missingSeen = {}
const mentionSeen = {}
const out = []
const moves = []

let externalUnverifiable = 0
for (const r of rows) {
  /* EXTERNAL FIRST — see the note on EXTERNAL. */
  const ext = resolveExternal(r.path)
  let resolved = null
  let absPath = null
  let label = null
  if (ext) {
    external++
    if (!ext.abs || r.ref === null) {
      if (!ext.abs) externalUnverifiable++
      continue
    }
    absPath = ext.abs
    label = r.path + " (external)"
  } else if (r.port && r.portRel && resolveIn(externalIndex(r.port), r.portRel)) {
    /* A PORT-RELATIVE path (`../smart/coverage.ts`), resolved against the
     * directory the ported file lived in, taken from its own `source file`
     * header line. These are the port's record of which import specifiers were
     * rewritten; against THIS tree they are 8 phantom missing files. */
    const hit = resolveIn(externalIndex(r.port), r.portRel)
    external++
    if (hit.ambiguous || r.ref === null) {
      if (hit.ambiguous) externalUnverifiable++
      continue
    }
    absPath = join(r.port, hit)
    label = `${hit} (port source)`
  } else if (r.port && resolveIn(externalIndex(r.port), r.path)) {
    /* A PORT'S CITATION, GRADED AGAINST THE TREE IT WAS WRITTEN IN. Same
     * precedence as EXTERNAL and for the same reason: this repo also holds a
     * copy, and grading against the copy reports every correct citation as
     * drift by the size of the provenance header. */
    const hit = resolveIn(externalIndex(r.port), r.path)
    external++
    if (hit.ambiguous || r.ref === null) {
      if (hit.ambiguous) externalUnverifiable++
      continue
    }
    absPath = join(r.port, hit)
    label = `${hit} (port source)`
  } else {
    const own = resolveIn(REPO_INDEX, r.path)
    if (own && own.ambiguous) {
      /* NAMES MORE THAN ONE REAL FILE. `page.tsx` is `app/page.tsx` AND
       * `app/desk-doodles/page.tsx`; a reader following it has to guess, and so
       * would this gate. Counted as ungradeable rather than as rot — the claim
       * is under-specified, not false — and never silently resolved to the
       * first hit, which is what the ordered SEARCH_DIRS list did. */
      uncheckable++
      out.push(`WARN  AMBIGUOUS      ${r.file}:${r.line}  cites ${r.path}  — names ${own.ambiguous.length} files: ${own.ambiguous.slice(0, 3).join(" · ")}`)
      out.push(`                     ${r.text.slice(0, 112)}`)
      continue
    }
    resolved = own
    if (!resolved) {
      /* A SIBLING REPO THIS PROJECT PORTS FROM — see SIBLING_REPOS. */
      let sib = null
      for (const s of SIBLING_REPOS) {
        const hit = resolveIn(externalIndex(s), r.path.replace(/^~?\/?(?:Desktop\/Projects\/)?[^/]*desk-doodles\//, ""))
        if (hit && !hit.ambiguous) {
          sib = { root: s, rel: hit }
          break
        }
      }
      if (sib) {
        external++
        if (r.ref === null) continue
        absPath = join(sib.root, sib.rel)
        label = `${sib.rel} (sibling repo)`
      }
    }
    if (!resolved && !absPath) {
      /* ── IS THIS A CITATION AT ALL? A HUMAN RULING, MACHINE-HELD ──────────
       *
       * A path that resolves nowhere is one of two things and no analyser can
       * tell them apart, because the difference is whether the author was
       * making a claim about a location. `assert-hero-letters.mjs` is a claim,
       * and a false one — docs/README.md:260 records it as "cited from three
       * call sites and never written". `rough.js` in "no DOM, no rough.js, no
       * deps" is the name of a library in a sentence, and calling it a broken
       * citation is the instrument inventing a defect.
       *
       * Explainer 34 §3 settled this class one level up, for controls: "No
       * syntax tree can tell a control from a measurement, because the
       * difference is whether the input is deliberately wrong, which is a claim
       * about intent. So the ruling is written down, one entry per gate, and
       * the machine owns only that it cannot rot silently."
       *
       * Same shape here. A ruling in `citation-baseline.json` says NOT-A-PATH
       * and gives the reason; anything unruled is a MISSING FILE and red. The
       * machine owns two things and neither is the ruling: a ruled token that
       * becomes resolvable FAILS (stale), and a ruled token nobody cites any
       * more FAILS (stale). Rulings print every run. */
      const bare = r.path
      if (mentionRulings[bare]) {
        ruledMention++
        mentionSeen[bare] = (mentionSeen[bare] ?? 0) + 1
        continue
      }
      // Normalise to the repo-relative form the ledger is keyed on.
      const key = r.path.includes("/") ? r.path : `scripts/verify/${r.path}`
      missingSeen[key] = (missingSeen[key] ?? 0) + 1
      if (!(key in KNOWN_OPEN)) {
        missingNew++
        out.push(`ROT   MISSING FILE   ${r.file}:${r.line}  cites ${r.path}  — no such file in this repo`)
        out.push(`                     ${r.text.slice(0, 112)}`)
      }
      continue
    }
    if (resolved) {
      if (r.ref === null) {
        ok++
        continue
      }
      absPath = join(ROOT, resolved)
      label = resolved
    }
  }
  const tgt = readFileSync(absPath, "utf8").split("\n")
  if (r.ref < 1 || r.ref > tgt.length) {
    stale++
    out.push(`ROT   PAST EOF       ${r.file}:${r.line}  cites ${label}:${r.ref}  — file has ${tgt.length} lines`)
    continue
  }
  const anchors = []
  ANCHOR.lastIndex = 0
  let a
  while ((a = ANCHOR.exec(r.ctx))) {
    const t = (a[1] ?? a[2]).trim()
    if (/\.(tsx|ts|mjs|js|md)(:\d+)?$/.test(t)) continue // a path is not an anchor
    if (/^[:§][0-9.]+$/.test(t)) continue
    if (t.length < 3) continue
    anchors.push(t)
  }
  if (anchors.length === 0) {
    uncheckable++
    out.push(`WARN  UNCHECKABLE    ${r.file}:${r.line}  cites ${label}:${r.ref}  — no anchor near it`)
    out.push(`                     ${r.text.slice(0, 112)}`)
    continue
  }
  const at = tgt[r.ref - 1]
  if (anchors.some((t) => anchorForms(t).some((f) => at.includes(f)))) {
    ok++
    continue
  }
  // Where is it really?
  const hits = []
  for (const t of anchors) {
    for (const f of anchorForms(t)) {
      tgt.forEach((l, i) => {
        if (l.includes(f)) hits.push({ t, f, line: i + 1 })
      })
    }
  }
  /* THE MOVE, RECORDED BY THE SAME PASS THAT JUDGES IT. `--recite` reads this,
   * so a re-citation can never disagree with the verdict that motivated it —
   * a second walk of the same rule is the copy certifying the original. Both
   * DRIFT and STALE are moves: the anchor is somewhere in the file, at a known
   * line. `hits.length === 0` is NOT here, and that is the whole design. */
  if (hits.length) moves.push({ file: r.file, line: r.line, path: r.path, from: r.ref, to: hits[0].line, anchor: hits[0].f, label })
  else moves.push({ file: r.file, line: r.line, path: r.path, from: r.ref, to: null, anchor: anchors[0], label, gone: true })

  const near = hits.filter((h) => Math.abs(h.line - r.ref) <= DRIFT_WINDOW)
  if (near.length) {
    drift++
    out.push(
      `DRIFT ${r.file}:${r.line}  cites ${label}:${r.ref} — \`${near[0].f}\` is at :${near[0].line}` +
        ` (${near[0].line - r.ref > 0 ? "+" : ""}${near[0].line - r.ref}, inside the ${DRIFT_WINDOW}-line window)`,
    )
    continue
  }
  stale++
  out.push(`ROT   STALE LINE     ${r.file}:${r.line}  cites ${label}:${r.ref}`)
  out.push(`                     cited line reads: ${at.trim().slice(0, 96)}`)
  out.push(`                     anchors: ${anchors.slice(0, 3).map((t) => `\`${t}\``).join(" ")}`)
  out.push(
    `                     actually at: ${
      hits.length ? [...new Set(hits.map((h) => `\`${h.f}\`:${h.line}`))].slice(0, 6).join(" ") : "NOWHERE in that file"
    }`,
  )
}

/* The ledger is exact in BOTH directions. */
let ledger = 0
for (const [k, want] of Object.entries(ledgerPins)) {
  const got = missingSeen[k] ?? 0
  if (got === want) {
    out.push(`OPEN  ${k} — still missing, ${got} citation(s), pinned (not this lane's to write)`)
  } else if (got === 0) {
    ledger++
    out.push(`FAIL  LEDGER STALE   ${k} now EXISTS or is no longer cited — remove it from KNOWN_OPEN`)
  } else {
    ledger++
    out.push(`FAIL  LEDGER MOVED   ${k} cited ${got}× , pinned at ${want} — update the pin deliberately`)
  }
}
  /* A RULING THAT NO LONGER RULES ON ANYTHING IS ITSELF A FAILURE. Lane F's
   * mechanism, and it caught three stale entries in real use within hours. Two
   * ways an entry rots and both are red: the token became RESOLVABLE (it is a
   * real file now, so the "not a path" ruling is false), or nobody cites it any
   * more (the ruling is dead weight nobody will re-read). */
  let mentionStale = 0
  const mentionRows = []
  for (const [k, why] of Object.entries(mentionRulings)) {
    const nowResolves = resolveExternal(k) || resolveRepo(k)
    const seen = mentionSeen[k] ?? 0
    if (nowResolves) {
      mentionStale++
      mentionRows.push(`FAIL  RULING STALE   \`${k}\` RESOLVES now — it is a real file, so "not a path" is false. Remove the ruling.`)
    } else if (seen === 0) {
      mentionStale++
      mentionRows.push(`FAIL  RULING STALE   \`${k}\` is cited by nothing in scope — remove it rather than leave it to be re-read.`)
    } else {
      mentionRows.push(`RULED \`${k}\` ×${seen} — ${why}`)
    }
  }
  return { missingNew, stale, uncheckable, drift, ok, external, externalUnverifiable, ledger, missingSeen, out, moves, ruledMention, mentionSeen, mentionStale, mentionRows }
}

const BASE = readBaseline()
const MENTIONS = BASE && !BASE.bad ? (BASE.notAPath ?? {}) : {}

const R = judge(rows, KNOWN_OPEN, MENTIONS)
const { missingNew, stale, uncheckable, drift, ok, external, externalUnverifiable, ledger, missingSeen, out, ruledMention, mentionStale, mentionRows } = R

/* THE ROT, AS ONE NUMBER, BECAUSE THAT IS THE HEADLINE NOBODY HAD.
 * A citation is ROTTED when it points at a line that no longer contains what it
 * claims, or at a file that does not exist. Drift (inside one screen) is not
 * rot — a reader following it still lands on the right thing — and uncheckable
 * is not rot either, it is a citation this gate cannot grade. Both are counted
 * and printed; neither is folded into the headline, because a number that mixes
 * "wrong" with "unverifiable" cannot be acted on. */
const ROT = stale + missingNew

console.log("=== citation gate — every file:line in the application source tree ===")
console.log(
  `scanned ${SCAN.length} files under ${ROOTS.join("/ ")}/, ${rows.length} citations   ` +
    `ok=${ok}  external=${external} (${externalUnverifiable} not on this machine)  drift=${drift}  ` +
    `stale=${stale}  missing=${missingNew}  uncheckable=${uncheckable}  ` +
    `ruled-not-a-path=${ruledMention}  ledger=${Object.keys(KNOWN_OPEN).length}\n`,
)
for (const l of out) console.log(l)
if (mentionRows.length) {
  console.log("\n── NOT-A-PATH RULINGS · every one printed every run, per §3.2 ──")
  for (const l of mentionRows) console.log(l)
  console.log("")
}

/* ⚠ THESE TWO ROWS WERE HARDCODED `PASS` STRINGS. They printed the word PASS
 * whatever the counts said, so on a tree with a stale citation the run said
 * "every checkable file:line citation resolves" and exited 1 — the summary
 * disagreeing with the rows. The verdict is read off the counts now. */
const MEASURED = { stale, missing: missingNew, uncheckable }
const baseOk = BASE !== null && !BASE.bad
const rises = baseOk ? Object.keys(BASELINE_KEYS).filter((k) => MEASURED[k] > BASE[k]) : []
const falls = baseOk ? Object.keys(BASELINE_KEYS).filter((k) => MEASURED[k] < BASE[k]) : []

console.log(
  `${baseOk ? "PASS" : "FAIL"}  the baseline file is readable — ` +
    (baseOk
      ? `${Object.keys(BASELINE_KEYS).map((k) => `${k}=${BASE[k]}`).join(" · ")} (recorded ${BASE.measuredAt ?? "?"})`
      : `${BASE === null ? "MISSING" : BASE.bad} — the ratchet cannot be judged without it. Recreate with \`node scripts/verify/assert-citations.mjs --record\` from a tree you trust.`),
)
console.log(
  `${baseOk && rises.length === 0 ? "PASS" : "FAIL"}  RATCHET · no citation-rot count has RISEN — ` +
    (!baseOk
      ? "no baseline"
      : rises.length
        ? `${rises.map((k) => `${k} ${BASE[k]} -> ${MEASURED[k]}`).join(" · ")} — a NEW rotted citation landed. Fix it, or say plainly that you added it.`
        : falls.length
          ? `${falls.map((k) => `${k} ${BASE[k]} -> ${MEASURED[k]}`).join(" · ")} — it FELL; run \`--record\` to hold the ground (no ownership of this file needed)`
          : `held at ${Object.values(MEASURED).reduce((a, b) => a + b, 0)} across ${Object.keys(BASELINE_KEYS).length} channels`),
)
console.log(
  `${mentionStale === 0 ? "PASS" : "FAIL"}  every NOT-A-PATH ruling still rules on something — ` +
    `${Object.keys(MENTIONS).length} ruling(s) covering ${ruledMention} mention(s); ${mentionStale} stale`,
)
console.log(
  `${ledger === 0 ? "PASS" : "FAIL"}  the ledger is exact — a KNOWN_OPEN entry that got better or worse fails rather than over-permitting — ` +
    `${Object.keys(KNOWN_OPEN).length} pinned, ${Object.keys(missingSeen).length} missing-file path(s) seen`,
)

/* ── THE CONTROLS · every one of them runs here, on the bare invocation ────── */
let controlFailed = 0
const control = (ok2, label, detail) => {
  if (!ok2) controlFailed++
  console.log(`${ok2 ? "PASS" : "FAIL"}  CONTROL · ${label}${detail ? " — " + detail : ""}`)
}

{
  const C = judge(CONTROL_CITATIONS, {})
  const wrongRejected = C.out.some((l) => l.includes("<control-wrong>") && l.startsWith("ROT"))
  const rightAccepted = !C.out.some((l) => l.includes("<control-right>"))
  control(
    wrongRejected,
    "KNOWN-BAD — a citation whose anchor is NOWHERE in the file it names is REJECTED",
    `\`polygoniseCapsuleFieldBuffers\` at docs/README.md:1 → ` +
      `stale=${C.stale} drift=${C.drift} ok=${C.ok} (needs a STALE LINE row; ` +
      `${wrongRejected ? "got one" : "GOT NONE — THIS GATE IS BLIND"})`,
  )
  control(
    rightAccepted,
    "…and the SAME judge ACCEPTS a correct one, so it is not simply refusing everything",
    `\`Free Stroke docs\` at docs/README.md:1 → ${rightAccepted ? "no row, i.e. accepted" : "REJECTED — the gate fails correct citations"}`,
  )
}
{
  /* THE LEDGER, ARMED. `KNOWN_OPEN` is `{}` on this tree, so the ledger loop
   * iterates zero times and its PASS row below is a claim about nothing. These
   * three drive the same loop with a synthetic pin: exact, stale, and moved. */
  const key = CONTROL_MISSING
  const exact = judge([controlMissingRow], { [key]: 1 })
  const stalePin = judge([], { [key]: 1 })
  const movedPin = judge([controlMissingRow], { [key]: 2 })
  control(
    exact.ledger === 0 && exact.out.some((l) => l.startsWith("OPEN")),
    "a pin that MATCHES its real count is accepted (OPEN, not a failure)",
    `pinned 1, seen 1 → ledger=${exact.ledger}`,
  )
  control(
    stalePin.ledger === 1 && stalePin.out.some((l) => l.includes("LEDGER STALE")),
    "KNOWN-BAD — a pin whose file is no longer cited FAILS rather than going quiet",
    `pinned 1, seen 0 → ledger=${stalePin.ledger} (needs 1)`,
  )
  control(
    movedPin.ledger === 1 && movedPin.out.some((l) => l.includes("LEDGER MOVED")),
    "KNOWN-BAD — a pin whose count MOVED fails rather than over-permitting",
    `pinned 2, seen 1 → ledger=${movedPin.ledger} (needs 1)`,
  )
}

{
  /* THE RATCHET, ARMED. The rows above compare MEASURED against the baseline on
   * disk; on a held tree that comparison is `equal === equal`, which is a green
   * that cannot fail — the exact shape this file's own header was dispatched
   * for, one channel over. These drive `canRecord` with synthetic measurements:
   * a rise must be refused, a fall must be accepted, a hold must be accepted. */
  const b = { stale: 10, missing: 10, uncheckable: 10 }
  const rise = canRecord({ stale: 11, missing: 10, uncheckable: 10 }, b)
  const fall = canRecord({ stale: 9, missing: 10, uncheckable: 10 }, b)
  const hold = canRecord({ ...b }, b)
  const noBase = canRecord({ ...b }, null)
  control(
    !rise.ok && rise.rises.length === 1,
    "RATCHET · a measurement that would RAISE a count is REFUSED",
    `stale 10 -> 11 → ${rise.ok ? "ACCEPTED — THIS IS A DEBT COUNTER, NOT A RATCHET" : `refused (${rise.why})`}`,
  )
  control(
    fall.ok,
    "…and one that LOWERS a count is ACCEPTED, so paying debt down is recordable",
    `stale 10 -> 9 → ${fall.ok ? "accepted" : "REFUSED — a lane that fixes a citation cannot hold the ground"}`,
  )
  control(hold.ok, "…and an unchanged measurement is accepted (holding the ground is not a rise)", "10/10/10 → accepted")
  control(!noBase.ok, "KNOWN-BAD — with NO baseline to compare against, --record refuses rather than inventing a ceiling", noBase.why)
}
{
  /* THE NOT-A-PATH RULINGS, ARMED. Same argument: with every ruling healthy the
   * staleness row asserts nothing. Two synthetic rulings, one of each rot. */
  const resolvable = judge([], {}, { "docs/README.md": "a ruling on a file that plainly EXISTS" })
  const uncited = judge([], {}, { "__nothing_cites_this__.ts": "a ruling nobody cites" })
  control(
    resolvable.mentionStale === 1 && resolvable.mentionRows.some((l) => l.includes("RESOLVES now")),
    "KNOWN-BAD — a NOT-A-PATH ruling on a file that RESOLVES fails rather than over-permitting",
    `ruled \`docs/README.md\` → mentionStale=${resolvable.mentionStale} (needs 1)`,
  )
  control(
    uncited.mentionStale === 1 && uncited.mentionRows.some((l) => l.includes("cited by nothing")),
    "KNOWN-BAD — a ruling nothing cites any more fails, so the list cannot silently rot",
    `mentionStale=${uncited.mentionStale} (needs 1)`,
  )
}
{
  /* `--recite`, ARMED — BOTH DIRECTIONS, which is the whole design (§3.3).
   * A target that MOVED must be re-citable; a target that is GONE must refuse.
   * Driven through the same `judge()` the real rows go through. */
  const movedRow = {
    file: "<control-recite-moved>",
    line: 0,
    path: "docs/README.md",
    ref: 2,
    ctx: "CONTROL `Free Stroke docs` at docs/README.md:2",
    text: "CONTROL recite moved",
  }
  const goneRow = {
    file: "<control-recite-gone>",
    line: 0,
    path: "docs/README.md",
    ref: 1,
    ctx: "CONTROL `polygoniseCapsuleFieldBuffers` at docs/README.md:1",
    text: "CONTROL recite gone",
  }
  const M = judge([movedRow], {})
  const G = judge([goneRow], {})
  const mv = M.moves.find((m) => m.file === "<control-recite-moved>")
  const gn = G.moves.find((m) => m.file === "<control-recite-gone>")
  control(
    !!mv && !mv.gone && mv.to === 1,
    "RECITE · a citation whose target MOVED is re-citable, and the new line is derived not guessed",
    `\`Free Stroke docs\` cited at :2, actually at :${mv?.to} → ${mv && !mv.gone ? "re-citable" : "NOT OFFERED — --recite is blind"}`,
  )
  control(
    !!gn && gn.gone === true,
    "KNOWN-BAD — a citation whose token appears NOWHERE is marked GONE and --recite REFUSES it",
    `\`polygoniseCapsuleFieldBuffers\` → ${gn?.gone ? "gone, refused (a deleted claim is a human call)" : "OFFERED AS A MOVE — --recite would launder a lie"}`,
  )
}

/* ONE EXPLICIT ROW PER OUTCOME, EVEN WHEN THERE IS NOTHING WRONG.
 *
 * ⚠ THIS FILE USED TO EMIT NO `PASS` LINE AT ALL ON A CLEAN RUN — it printed
 * only the failures, then "ALL PASS". `run-battery.mjs` counts PASS/FAIL rows
 * and reported it under "exited 0 having emitted NO PASS/FAIL row — that is not
 * a pass either", which is the right complaint: in a sweep table, a gate that
 * says nothing when it is happy is indistinguishable from a gate that measured
 * nothing, and this repo has shipped three of the latter. The numbers were
 * always in the header line; they are rows now, so the sweep can read them.
 *
 * ⚠ AND THE VERDICT IS NO LONGER `stale + missing + uncheckable`. Widening SCAN
 * from 7 files to the source tree took the raw rot count from 1 to a number no
 * single lane can fix, in files this lane may not write. A gate that is red
 * forever is a gate that gets switched off — the argument this file's own
 * DRIFT_WINDOW note already makes. So the ROT counts are RATCHETED (they may
 * fall, never rise) and the ledger, the rulings and the controls are HARD. */
const ratchetRed = (baseOk ? 0 : 1) + (rises.length ? 1 : 0)
const hardBad = ledger + controlFailed + mentionStale
const bad = hardBad + ratchetRed
console.log(
  `\n${bad === 0 ? "ALL PASS" : `${bad} PROBLEM(S)`}   ` +
    `(${ROT} ROTTED citation(s) of ${rows.length}, pinned at the baseline; ${drift} drift and ${uncheckable} uncheckable, reported not fatal` +
    `${controlFailed ? `; ${controlFailed} CONTROL row(s) red — the instrument, not the codebase` : ""})`,
)

if (LIST) {
  console.log("\n── ROT BY FILE ──")
  const byFile = {}
  for (const l of out) {
    const m = l.match(/^ROT\s+(?:STALE LINE|MISSING FILE|PAST EOF)\s+(\S+?):(\d+)/)
    if (m) byFile[m[1]] = (byFile[m[1]] ?? 0) + 1
  }
  for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${f}`)
  console.log(`  ${String(ROT).padStart(3)}  TOTAL`)
}

if (RECITE) {
  /* ── RE-CITE WHAT MOVED; REFUSE WHAT IS GONE ───────────────────────────────
   *
   * Lane L's mechanism (`assert-gate-integrity.mjs --recite`, explainer 34 §3),
   * with ONE deliberate difference, stated because a silent deviation from a
   * proven mechanism is how the third implementation of an idea gets born.
   *
   * L's `--recite` writes a JSON manifest L owned. THIS gate's citations live in
   * `viewport-3d.tsx`, `flat-ink.ts` and `page.tsx` — source files held by other
   * live lanes, where an unannounced write is a collision (DISPATCH §4). So the
   * default is a DRY RUN that prints the exact edits and writes nothing, and
   * `--write` applies them. The refusal is NOT weakened by that: `gone` refuses
   * in both modes, before anything is written.
   *
   * L's warning to its reader is the right tone and is kept verbatim:
   * "N citation(s) re-cited. LOOK at each move before trusting it." */
  const moved = R.moves.filter((m) => !m.gone)
  const gone = R.moves.filter((m) => m.gone)
  for (const m of moved) console.log(`re-cite  ${m.file}:${m.line}  ${m.path}:${m.from} -> :${m.to}   (anchor \`${m.anchor}\`)`)
  if (gone.length) {
    console.log(`\nREFUSING to re-cite ${gone.length} citation(s): the anchor appears NOWHERE in the file named.`)
    console.log(`That is not a citation that moved, it is a claim that has become FALSE, and re-pointing it`)
    console.log(`at a nearby line would launder a lie. Re-ruling it is a human call:`)
    for (const m of gone) console.log(`  · ${m.file}:${m.line} cites ${m.label ?? m.path}:${m.from}  anchor \`${m.anchor}\``)
    /* 2, not 1 — a REFUSAL to grade, this repo's exit-2 convention. */
    process.exit(2)
  }
  if (!WRITE) {
    console.log(`\n${moved.length} citation(s) WOULD be re-cited. Nothing was written — pass \`--write\` to apply.`)
    console.log(`LOOK at each move before trusting it.`)
    process.exit(0)
  }
  const byFile = {}
  for (const m of moved) (byFile[m.file] ??= []).push(m)
  for (const [f, ms] of Object.entries(byFile)) {
    const lines = readFileSync(join(ROOT, f), "utf8").split("\n")
    for (const m of ms) {
      const i = m.line - 1
      lines[i] = lines[i].replace(`${m.path}:${m.from}`, `${m.path}:${m.to}`)
    }
    writeFileSync(join(ROOT, f), lines.join("\n"))
  }
  console.log(`\n${moved.length} citation(s) re-cited across ${Object.keys(byFile).length} file(s). LOOK at each move before trusting it.`)
  process.exit(0)
}

if (RECORD) {
  /* THE PAYDOWN PATH, AND IT NEEDS NO OWNERSHIP OF THIS FILE. Lane O's rules,
   * both of them: it runs LAST, and it refuses while any NON-ratchet channel is
   * red — because recording during a red run grandfathers whatever made it red. */
  const verdict = canRecord(MEASURED, BASE)
  console.log("")
  if (hardBad > 0) {
    console.log(`REFUSED — ${hardBad} channel(s) other than the ratchet are RED. Nothing was written.`)
    console.log("  Recording a baseline during a red run grandfathers whatever made it red.")
    process.exit(1)
  }
  if (!verdict.ok) {
    console.log(`REFUSED — --record may only LOWER a baseline. ${verdict.why}`)
    console.log("  Nothing was written. A ratchet that can be raised is a debt counter.")
    process.exit(1)
  }
  const next = { ...BASE, ...MEASURED, measuredAt: new Date().toISOString().slice(0, 10) }
  writeFileSync(BASELINE_FILE, JSON.stringify(next, null, 2) + "\n")
  for (const k of Object.keys(BASELINE_KEYS))
    console.log(`  ${k}: ${BASE[k]} -> ${MEASURED[k]}${BASE[k] === MEASURED[k] ? "  (held)" : `  (paid down ${BASE[k] - MEASURED[k]})`}`)
  console.log(`recorded to scripts/verify/citation-baseline.json`)
  process.exit(0)
}

process.exit(bad === 0 ? 0 : 1)

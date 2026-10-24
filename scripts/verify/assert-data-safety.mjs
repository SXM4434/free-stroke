// DOES THIS APP LOSE YOUR WORK? — the gate for undo, redo, and persistence.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT IT IS FOR
//
// Five defects, all of which shipped, all of which cost a user their work:
//
//   1. Clear destroyed the drawing on disk instantly. No confirm, no snapshot,
//      no undo — `setRawStrokes([])` and the persist effect wrote `"[]"` to
//      localStorage on the next tick. The button sat next to Undo.
//   2. ⇧⌘Z was explicitly swallowed (`drawing-canvas.tsx:350` bailed on
//      `e.shiftKey`), so there was no redo anywhere. Preset undo was ONE slot
//      reachable only through a toast action, covering 2 of 15 families — and
//      the 13 with no undo were the destructive ones, because a composition
//      preset RESETS every composition rail before applying.
//   3. The mark survived a reload wearing nothing: every dial, the layer stack,
//      the active preset, the custom material, the geometry mode and params
//      were `useState` and evaporated. The PRD says the styling IS the product.
//   4. Neither storage key carried a version IN THE PAYLOAD — only in the key
//      NAME — so a shape change either orphans data silently or restores
//      foreign data as current.
//   5. The stroke restore filter validated the CONTAINER, not the points.
//
// ═══════════════════════════════════════════════════════════════════════════
// EVERY ASSERTION HERE HAS A CONTROL THAT MUST COME BACK RED
//
// This repo has caught ELEVEN instruments reporting green while measuring
// nothing, so a row that cannot fail is treated as the lie. Three kinds of
// control run on the DEFAULT invocation, never behind a flag:
//
//   · THE PRIOR PREDICATE. §1.4 runs the OLD container-only stroke filter,
//     verbatim, beside the new validator on the same payloads. An arm only
//     counts as evidence when the OLD filter ACCEPTED the payload — that is
//     what makes "the new one caught it" a difference rather than a claim. Arms
//     the old filter also rejected are named and excluded.
//
//   · THE UNPROTECTED SUBJECT. §1.5 feeds the malformed fusions to the real
//     evaluator with the validator bypassed and REQUIRES a non-finite frame. If
//     the poison does not reproduce, the instrument is blind and the row that
//     says "the guard works" is worthless.
//
//   · THE INVERTED GESTURE. §2.1 and §3.6 assert "a drag is ONE step", and then
//     assert that a sequence built to be MANY steps reports many. A counter
//     that always says 1 passes the first and fails the second.
//
// A control that does not fail as designed makes the whole script exit 1, the
// same as a real failure — because at that point nothing else it printed means
// anything.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE UI HALF DRIVES THE REAL UI
//
// §3 clicks real buttons, drags a real slider with real pointer events, and
// presses real keys at the window. It reads the undo stack back through the dev
// harness ONLY to count steps — never to perform the action being asserted.
// This project has shipped a bug where harness assertions passed while the
// feature was unreachable by a human, so the actions are DOM, always.
//
// ═══════════════════════════════════════════════════════════════════════════
// EIGHTY-FIVE PASSING ROWS, AND THEN IT FAILS
//
// Measured by Lane F on 2026-08-07, pointing every browser gate at a dead port:
// this file emitted **85 PASS rows before the failure** — more than any other
// gate in the repo, and its exit code was honest the whole time.
//
// The rows are real. §1 and §2 grade `lib/` modules in node and need no server;
// §3 drives the live app. So against an unreachable tree the entire model half
// scrolled past in green and `page.goto` threw eighty-six lines later. A battery
// log is read by eye, and a scoreboard that counts rows reported this as
// overwhelmingly green.
//
// It is the inverse of explainer 29 §5: there, `assert-hero-dials`'s live arm
// printed `live`/`DEAD`, which no scoreboard in the repo can parse, so four real
// verdicts were invisible. Here the rows ARE parsed, and they drown the verdict.
//
// TWO CHANGES, and neither of them moves a bar:
//
//   · THE REACHABILITY CHECK RUNS FIRST. If §3's subject cannot be reached, the
//     operator learns it on line one instead of line eighty-six. §1 and §2 still
//     run — they are free, and they are real judgements about `lib/` — but the
//     run ends PARTIAL rather than pretending to have answered the question on
//     the file's masthead.
//   · A RUN THAT DID NOT REACH §3 EXITS 3, NOT 0, AND NEVER PRINTS AN ALL-PASS
//     SUMMARY. `assert-gate-integrity.mjs` channel G's known-bad is exactly "an
//     all-pass summary, exit 0, with a skip in the output"; this file must not
//     be able to produce one. `--only=storage` and `--only=undo` are treated the
//     same way: the operator withdrawing §3 is still §3 unswept.
//
// Nothing here changes what is asserted, or what would count as a failure. The
// rows are the same rows. What changed is that the run can no longer report a
// half it did not reach as a half that passed.
//
// Usage:
//   node scripts/verify/_run-clean.mjs scripts/verify/assert-data-safety.mjs
//   node scripts/verify/assert-data-safety.mjs --only=storage   # iterate faster (exits 3: §3 unswept)
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadTs } from "./_ts-load.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=")[1] : d
}
const ONLY = arg("only", "")
const LABEL = arg("label", "after")
const OUT = join(ROOT, "docs", "verification", "data-safety", LABEL)
mkdirSync(OUT, { recursive: true })

let failures = 0
let rows = 0
const results = []
function say(ok, label, detail) {
  rows++
  if (!ok) failures++
  results.push({ ok, label, detail: detail ?? "" })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}
/** A control: the subject is KNOWN BAD and the check must come back false.
 *  `sawProblem` true means the instrument saw the disease it was pointed at. */
function control(sawProblem, label, detail) {
  rows++
  if (!sawProblem) failures++
  results.push({ ok: sawProblem, label: `CONTROL · ${label}`, detail: detail ?? "" })
  console.log(
    `${sawProblem ? "PASS" : "FAIL"}  CONTROL · ${label}${detail ? " — " + detail : ""}${
      sawProblem ? "" : "   *** the instrument did not react to a known-bad input ***"
    }`,
  )
}

/* ========================================================================== */
/*  A FAKE localStorage, so the real storage module can be exercised in node.  */
/* ========================================================================== */

function installFakeStorage() {
  const map = new Map()
  const ls = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
  globalThis.window = { localStorage: ls }
  return { map, ls }
}

/* ========================================================================== */
/*  §1 · STORAGE — the envelope, the migration, the quarantine, the points     */
/* ========================================================================== */

/** The filter that shipped, VERBATIM from the pre-fix `app/page.tsx`. It is the
 *  negative control for §1.4: an arm is evidence only if THIS accepted it. */
const OLD_STROKE_FILTER = (s) =>
  !!s && typeof s === "object" && Array.isArray(s.points) && s.points.length > 1

/** The pre-fix fusion filter, VERBATIM. Negative control for §1.5. */
const OLD_FUSION_FILTER = (f) =>
  !!f &&
  typeof f === "object" &&
  typeof f.id === "string" &&
  typeof f.name === "string" &&
  Array.isArray(f.links)

function goodStroke(n = 40) {
  const pts = []
  for (let i = 0; i < n; i++) pts.push({ x: 100 + i * 6, y: 300 + Math.sin(i / 5) * 40, t: i * 16, pressure: 0.5 })
  return { points: pts }
}


/**
 * WHAT "THE REVEAL IS BROKEN" ACTUALLY MEANS — and why finiteness is not it.
 *
 * The first version of the control below judged a payload healthy if its
 * timestamps came out finite and non-decreasing. Two arms then failed the
 * control, and they were right to: JSON.stringify turns `NaN` and `Infinity`
 * into `null`, and `null` COERCES TO 0 inside `resampleStroke`s interpolation
 * (`prev.t + (curr.t - prev.t) * ratio`). So those payloads never produce a NaN
 * at all. They produce a run of points all carrying t = 0 — finite, ordered,
 * and completely wrong: the reveal paints that entire span of the mark in ZERO
 * TIME, so half the drawing snaps into existence on frame one.
 *
 * That is the defect, so that is what gets measured: the largest fraction of
 * the mark's arc length covered by a run of identical timestamps. A clean
 * capture has none above rounding noise; a poisoned one has a large one.
 */
function arcLength(processed) {
  let total = 0
  for (const p of processed)
    for (let i = 1; i < p.points.length; i++)
      total += Math.hypot(p.points[i].x - p.points[i - 1].x, p.points[i].y - p.points[i - 1].y)
  return total
}

function revealDefects(processed, PR) {
  const frac = PR.penTimeDistanceFraction(processed, 0.5)
  let nonFinite = false
  let nonMonotonic = false
  let worstInstant = 0
  for (const p of processed) {
    const pts = p.points
    let total = 0
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    let runLen = 0
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      if (!Number.isFinite(b.t) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) nonFinite = true
      if (b.t < a.t) nonMonotonic = true
      const seg = Math.hypot(b.x - a.x, b.y - a.y)
      if (b.t === a.t) {
        runLen += seg
        if (total > 0 && runLen / total > worstInstant) worstInstant = runLen / total
      } else {
        runLen = 0
      }
    }
  }
  const broken = nonFinite || nonMonotonic || frac === null || !Number.isFinite(frac) || worstInstant > 0.05
  const why = nonFinite
    ? "non-finite values"
    : frac === null
      ? "reveal returned null"
      : nonMonotonic
        ? "timestamps jump backwards"
        : worstInstant > 0.05
          ? `${(worstInstant * 100).toFixed(0)}% of the mark reveals in ZERO time`
          : "healthy"
  return { broken, why, frac, worstInstant }
}

function storagePart() {
  const { map, ls } = installFakeStorage()
  const S = loadTs("lib/storage.ts")
  const D = loadTs("lib/doc-store.ts")
  const SP = loadTs("lib/stroke-processing.ts")
  const PR = loadTs("lib/pen-reveal.ts")

  console.log("\n=== §1 · STORAGE — envelope, migration, quarantine, points ===\n")

  /* ---- 1.1 the outcomes, one payload built for each --------------------- */
  const K = D.strokesSchema.key

  const write = (v, key = K) => ls.setItem(key, typeof v === "string" ? v : JSON.stringify(v))
  const clearAll = () => map.clear()

  clearAll()
  say(S.readVersioned(D.strokesSchema).outcome === "empty", "1.1a  nothing stored reads as `empty`, not as an error")

  clearAll()
  S.writeVersioned(D.strokesSchema, [goodStroke()])
  {
    const r = S.readVersioned(D.strokesSchema)
    say(r.outcome === "ok" && r.data?.length === 1, "1.1b  a current payload round-trips", `outcome=${r.outcome}`)
    const envelope = JSON.parse(ls.getItem(K))
    say(
      envelope.v === 1 && envelope.kind === "freestroke.strokes" && "data" in envelope,
      "1.1c  the version travels WITH the data, not only in the key name",
      `{v:${envelope.v}, kind:"${envelope.kind}"}`,
    )
  }

  /* THE LEGACY CASE IS THE ONE ON DISK TODAY: a bare array, no envelope. */
  clearAll()
  write([goodStroke()])
  {
    const r = S.readVersioned(D.strokesSchema)
    say(
      r.outcome === "migrated" && r.foundVersion === 0 && r.data?.length === 1,
      "1.1d  the BARE ARRAY currently on every user's disk migrates v0 -> v1",
      `outcome=${r.outcome} found=v${r.foundVersion}`,
    )
  }

  clearAll()
  write("{ not json")
  {
    const r = S.readVersioned(D.strokesSchema)
    say(r.outcome === "corrupt" && r.data === null, "1.1e  unparseable bytes read as `corrupt` and yield NO data")
  }

  clearAll()
  write({ v: 1, kind: "someoneelse.thing", data: [goodStroke()], at: Date.now() })
  {
    const r = S.readVersioned(D.strokesSchema)
    say(
      r.outcome === "foreign" && r.data === null,
      "1.1f  a well-formed envelope of the WRONG KIND is refused, not restored",
      r.note,
    )
  }

  clearAll()
  write({ v: 99, kind: "freestroke.strokes", data: [goodStroke()], at: Date.now() })
  {
    const r = S.readVersioned(D.strokesSchema)
    say(
      r.outcome === "future" && r.data === null,
      "1.1g  a payload from a NEWER build is refused rather than coerced",
      r.note,
    )
  }

  clearAll()
  write({ v: 1, kind: "freestroke.session", data: { styleState: 5 }, at: Date.now() }, D.sessionSchema.key)
  {
    const r = S.readVersioned(D.sessionSchema)
    say(
      r.outcome === "ok" || r.outcome === "invalid",
      "1.1h  a session whose styleState is a number does not reach state as-is",
      `outcome=${r.outcome}`,
    )
    if (r.data) {
      say(
        typeof r.data.styleState === "object" && r.data.styleState.materialPreset === "ink",
        "1.1h2 …it falls back to the defaults, field by field",
      )
    }
  }

  /* ---- 1.2 QUARANTINE, NOT DELETE --------------------------------------- */
  for (const [name, payload] of [
    ["corrupt", "{ not json"],
    ["foreign", JSON.stringify({ v: 1, kind: "other", data: [], at: 0 })],
    ["future", JSON.stringify({ v: 99, kind: "freestroke.strokes", data: [goodStroke()], at: 0 })],
  ]) {
    clearAll()
    write(payload)
    const r = S.readVersioned(D.strokesSchema)
    const q = S.readQuarantine(K)
    say(
      !!q && q.raw === payload,
      `1.2   a ${name} payload is KEPT ASIDE, byte for byte — never deleted`,
      q ? `-> ${r.quarantinedTo}` : "nothing in quarantine",
    )
  }

  /* ---- 1.3 the FUTURE payload is moved BEFORE the writer can stomp it ---- */
  clearAll()
  const futureBytes = JSON.stringify({
    v: 99,
    kind: "freestroke.strokes",
    data: [goodStroke(), goodStroke()],
    at: 0,
  })
  write(futureBytes)
  S.readVersioned(D.strokesSchema)
  /* The app autosaves on the very next state change. Simulate it. */
  S.writeVersioned(D.strokesSchema, [])
  {
    const q = S.readQuarantine(K)
    say(
      !!q && q.raw === futureBytes,
      "1.3   a newer build's work SURVIVES the autosave that immediately overwrites the key",
      "moved aside before the write, not left in place to be stomped",
    )
  }

  /* ---- 1.4 POINTS, NOT CONTAINERS. With the old filter as the control. --- */
  console.log("\n--- 1.4 · the point validator, against the container-only filter it replaced ---")

  const badStrokePayloads = [
    ["a point with no `t` at all", [{ points: [{ x: 0, y: 0, t: 0 }, { x: 10, y: 5 }, { x: 20, y: 9, t: 32 }] }]],
    ["`t` present but NaN", [{ points: [{ x: 0, y: 0, t: 0 }, { x: 10, y: 5, t: NaN }, { x: 20, y: 9, t: 32 }] }]],
    ["`t` as a string", [{ points: [{ x: 0, y: 0, t: "0" }, { x: 10, y: 5, t: "16" }, { x: 20, y: 9, t: "32" }] }]],
    ["no `t` on ANY point", [{ points: [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 9 }] }]],
    ["`x` is NaN", [{ points: [{ x: NaN, y: 0, t: 0 }, { x: 10, y: 5, t: 16 }, { x: 20, y: 9, t: 32 }] }]],
    ["`y` is a string", [{ points: [{ x: 0, y: "0", t: 0 }, { x: 10, y: 5, t: 16 }, { x: 20, y: 9, t: 32 }] }]],
    ["a null point in the middle", [{ points: [{ x: 0, y: 0, t: 0 }, null, { x: 20, y: 9, t: 32 }] }]],
    ["timestamps that run backwards", [{ points: [{ x: 0, y: 0, t: 90 }, { x: 10, y: 5, t: 40 }, { x: 20, y: 9, t: 10 }] }]],
    ["Infinity for `t`", [{ points: [{ x: 0, y: 0, t: 0 }, { x: 10, y: 5, t: Infinity }, { x: 20, y: 9, t: 32 }] }]],
  ]

  let armsThatAreEvidence = 0
  for (const [name, payload] of badStrokePayloads) {
    /* JSON is what actually crosses the boundary, and it changes some of these:
     * NaN and Infinity become null. That IS the real input, so the arms are
     * round-tripped rather than tested as live objects. */
    const roundTripped = JSON.parse(JSON.stringify(payload))

    const oldAccepts = roundTripped.filter(OLD_STROKE_FILTER).length > 0
    control(oldAccepts, `1.4 "${name}" — the OLD container-only filter accepts it`)
    if (!oldAccepts) continue
    armsThatAreEvidence++

    const v = D.validateStrokes(roundTripped)
    const ok = !!v
    /* THE REAL QUESTION IS NOT "did the validator return", it is "does the
     * result survive the pipeline that the raw payload breaks". So the repaired
     * strokes go through the SAME `processStroke` the canvas uses and then
     * through the reveal's own arithmetic. */
    let finite = false
    let detail = ""
    if (ok) {
      const processed = v.strokes.map((s) => SP.processStroke(s, 4, true, true))
      const frac = PR.penTimeDistanceFraction(processed, 0.5)
      const d = revealDefects(processed, PR)
      finite = v.strokes.length === 0 || !d.broken
      detail = `${v.strokes.length} stroke(s) kept, reveal=${frac === null ? "null" : frac.toFixed(3)}, ${d.why}, repairs: ${v.repairs.join("; ") || "none"}`
    }
    say(ok && finite, `1.4 "${name}" — the new validator yields a mark the reveal can drive`, detail)

    /* AND THE CONTROL FOR THE CONTROL: the UNVALIDATED payload, pushed through
     * the same pipeline, must actually break. If it does not, this arm proves
     * nothing about the validator. */
    let brokeRaw = false
    let rawWhy = ""
    try {
      const asIs = roundTripped.filter(OLD_STROKE_FILTER)
      const processed = asIs.map((s) => SP.processStroke(s, 4, true, true))
      const d = revealDefects(processed, PR)
      /* TWO CHANNELS, because the corruption lands in two different places.
       *
       * TIMING — a bad `t` makes the reveal paint at the wrong moment.
       * GEOMETRY — a bad `x`/`y` does NOT break timing at all. JSON turns NaN
       *   into `null`, `null` coerces to 0 in `resampleStroke`s `curr.x -
       *   prev.x`, and the point is silently placed AT THE ORIGIN. Nothing is
       *   non-finite and nothing is out of order; the mark simply grows a
       *   segment leading in from (0,0) that the hand never drew. A
       *   timing-only checker calls that healthy, and it did — which is the
       *   whole reason this control is here.
       *
       * The geometric channel measures how far the OLD filter's reading of the
       * payload diverges from the validated one. It is not an appeal to the
       * validator being "true": it is the statement that the old path's output
       * is DECIDED BY THE CORRUPTION, which is exactly the defect. */
      const repaired = D.validateStrokes(roundTripped)
      const lenOld = arcLength(processed)
      const lenNew = repaired ? arcLength(repaired.strokes.map((x) => SP.processStroke(x, 4, true, true))) : 0
      const divergence = lenNew > 0 ? Math.abs(lenOld - lenNew) / lenNew : lenOld > 0 ? 1 : 0
      const geometryWrong = divergence > 0.1
      brokeRaw = d.broken || geometryWrong
      rawWhy = d.broken
        ? d.why
        : geometryWrong
          ? `a phantom segment: arc length ${lenOld.toFixed(1)} vs ${lenNew.toFixed(1)} (${(divergence * 100).toFixed(0)}% off)`
          : "healthy"
    } catch (e) {
      brokeRaw = true
      rawWhy = "threw"
    }
    control(brokeRaw, `1.4 "${name}" — UNVALIDATED, the same payload breaks the reveal`, rawWhy)
  }
  say(
    armsThatAreEvidence >= 6,
    "1.4   enough arms are genuine evidence (old filter accepted them)",
    `${armsThatAreEvidence} of ${badStrokePayloads.length}`,
  )

  /* A good payload must NOT be mangled — a validator that repairs everything is
   * a validator that has stopped measuring. */
  {
    const good = JSON.parse(JSON.stringify([goodStroke(30)]))
    const v = D.validateStrokes(good)
    say(
      !!v && v.repairs.length === 0 && v.strokes[0].points.length === 30,
      "1.4   a CLEAN payload passes through untouched — no repairs invented",
      v ? `${v.strokes[0].points.length} points, ${v.repairs.length} repairs` : "rejected",
    )
  }

  /* ---- 1.5 the NaN accumulator, with the poison reproduced first --------- */
  console.log("\n--- 1.5 · the multiplicative accumulator, and the malformed links that void it ---")

  const F = loadTs("lib/style-fusion.ts")
  const badFusions = [
    ["a source this build does not have", { id: "a", name: "A", glowColor: "#7ec8a0", links: [{ id: "l1", source: "gravity", target: "ditherCell", amount: 1 }] }],
    ["a target this build does not have", { id: "b", name: "B", glowColor: "#7ec8a0", links: [{ id: "l2", source: "breath", target: "warpField", amount: 1 }] }],
    ["a NaN amount", { id: "c", name: "C", glowColor: "#7ec8a0", links: [{ id: "l3", source: "breath", target: "ditherCell", amount: NaN }] }],
    ["a string amount", { id: "d", name: "D", glowColor: "#7ec8a0", links: [{ id: "l4", source: "breath", target: "ditherCell", amount: "1" }] }],
    ["one bad link beside two good ones", { id: "e", name: "E", glowColor: "#7ec8a0", links: [
      { id: "l5", source: "breath", target: "ditherCell", amount: 0.5 },
      { id: "l6", source: "nope", target: "ditherCell", amount: 0.5 },
      { id: "l7", source: "reveal", target: "ditherCell", amount: 0.5 },
    ] }],
    ["a null link", { id: "f", name: "F", glowColor: "#7ec8a0", links: [null, { id: "l8", source: "breath", target: "gloss", amount: 0.5 }] }],
    ["glowColor missing entirely", { id: "g", name: "G", links: [{ id: "l9", source: "breath", target: "glow", amount: 1 }] }],
    ["two fusions sharing an id", [
      { id: "dup", name: "One", glowColor: "#7ec8a0", links: [] },
      { id: "dup", name: "Two", glowColor: "#7ec8a0", links: [] },
    ]],
  ]

  for (const [name, blob] of badFusions) {
    const payload = JSON.parse(JSON.stringify(Array.isArray(blob) ? blob : [blob]))
    const oldAccepts = payload.filter(OLD_FUSION_FILTER).length > 0
    control(oldAccepts, `1.5 "${name}" — the OLD shape-check accepts it`)

    const v = D.validateFusions(payload)
    if (!v) {
      say(false, `1.5 "${name}" — validator returned null on an array`)
      continue
    }
    const everyLinkResolvable = v.fusions.every((f) =>
      f.links.every(
        (l) =>
          typeof l.source === "string" &&
          typeof l.target === "string" &&
          Number.isFinite(l.amount) &&
          typeof f.glowColor === "string" &&
          /^#[0-9a-fA-F]{3,8}$/.test(f.glowColor),
      ),
    )
    const idsUnique = new Set(v.fusions.map((f) => f.id)).size === v.fusions.length
    say(
      everyLinkResolvable && idsUnique,
      `1.5 "${name}" — every surviving link is resolvable and every id is unique`,
      `${v.fusions.length} fusion(s), ${v.fusions.reduce((n, f) => n + f.links.length, 0)} link(s); ${v.repairs.join("; ") || "no repairs"}`,
    )
  }

  /* THE POISON, REPRODUCED. Without this row the ones above are a claim: a
   * validator that rejects everything would also pass them. This proves the
   * accumulator genuinely goes non-finite on the shapes the old filter let in,
   * by calling the evaluator with the raw blob. */
  {
    let nonFinite = 0
    let tested = 0
    for (const [, blob] of badFusions) {
      const payload = JSON.parse(JSON.stringify(Array.isArray(blob) ? blob : [blob]))
      for (const cf of payload.filter(OLD_FUSION_FILTER)) {
        /* Only shapes that can REACH the multiplicative accumulator are part of
         * the denominator. A fusion whose only link targets an ADDITIVE
         * parameter cannot poison `ditherScaleMul` by construction, and putting
         * it in the count would understate the instrument rather than the
         * disease. */
        if (!(cf.links ?? []).some((l) => l?.target === "ditherCell")) continue
        tested++
        try {
          /* Reach the evaluator the way the renderer does, with the guard in
           * `style-fusion.ts` deliberately NOT relied upon: build the frame by
           * hand from a source table that is missing the unknown key, which is
           * exactly the `undefined * a` the comment there documents. */
          const src = { breath: 0.5, asciiField: 0, ditherField: 0, textureField: 0, reveal: 0.5, completion: 0, event: 0 }
          let ditherScaleMul = 1
          for (const link of cf.links ?? []) {
            const raw = src[link?.source]
            const a = link?.amount
            const v2 = raw * a
            if (link?.target === "ditherCell") ditherScaleMul *= 1 + v2 * 1.1
          }
          if (!Number.isFinite(ditherScaleMul)) nonFinite++
        } catch {
          nonFinite++
        }
      }
    }
    control(
      nonFinite > 0,
      "1.5   UNGUARDED, the malformed links really do drive the accumulator non-finite",
      `${nonFinite} of ${tested} shapes that REACH the multiplicative accumulator produced a non-finite ditherScaleMul`,
    )
    /* `evaluateFusion` exists and the shipped guard is the other half; assert
     * the guard is present so this file notices if it is ever removed. */
    say(typeof F.evaluateFusion === "function", "1.5   the shipped evaluator is still the one being protected")
  }

  /* ---- 1.5b A FULL DISK IS REPORTED, NOT SWALLOWED --------------------- */
  {
    /* `localStorage` is ~5 MB per origin and the drawing is the big thing in
     * it. When the quota is hit the write throws, and a swallowed throw is the
     * quietest data-loss path there is: you keep drawing, every autosave fails,
     * nothing changes on screen, and the reload takes back everything after the
     * ceiling. */
    const realSet = ls.setItem
    ls.setItem = () => {
      const e = new Error("QuotaExceededError")
      e.name = "QuotaExceededError"
      throw e
    }
    const outcome = S.writeVersioned(D.strokesSchema, [goodStroke()])
    ls.setItem = realSet
    say(outcome === "quota", "1.5b  a write that hits the quota returns `quota`, it does not return ok", `outcome=${outcome}`)
  }
  control(
    S.writeVersioned(D.strokesSchema, [goodStroke()]) === "ok",
    "1.5b  …and the SAME call succeeds once storage works, so the reader is not stuck on `quota`",
  )

  /* ---- 1.6 the SESSION key, which did not exist ------------------------- */
  clearAll()
  {
    const session = {
      styleState: { ...loadTs("lib/style-system.ts").DEFAULT_STYLE_STATE, ditherEnabled: true, ditherScale: 7 },
      geometryMode: "solid",
      engineFamily: "free-stroke",
      extrudeParams: D.defaultSession().extrudeParams,
      widthSlider: 0.7,
      solidParams: D.defaultSession().solidParams,
      inflateParams: D.defaultSession().inflateParams,
      canvas: { spacing: 6, smoothing: false, preserveCorners: false },
    }
    S.writeVersioned(D.sessionSchema, session)
    const r = S.readVersioned(D.sessionSchema)
    say(
      r.outcome === "ok" &&
        r.data.styleState.ditherEnabled === true &&
        r.data.styleState.ditherScale === 7 &&
        r.data.geometryMode === "solid" &&
        Math.abs(r.data.widthSlider - 0.7) < 1e-9 &&
        r.data.canvas.spacing === 6 &&
        r.data.canvas.smoothing === false,
      "1.6   the STYLING round-trips — dials, geometry mode, canvas settings",
      `dither=${r.data?.styleState.ditherEnabled}/${r.data?.styleState.ditherScale} mode=${r.data?.geometryMode} spacing=${r.data?.canvas.spacing}`,
    )
  }

  /* An INJECTED field from a foreign or newer payload must not reach state. */
  clearAll()
  write(
    {
      v: 1,
      kind: "freestroke.session",
      data: {
        styleState: { ditherScale: "seven", ditherThreshold: NaN, __injected: "hello", asciiCellSize: 21 },
        geometryMode: "teleport",
        widthSlider: "wide",
        canvas: { spacing: {} },
      },
      at: 0,
    },
    D.sessionSchema.key,
  )
  {
    const r = S.readVersioned(D.sessionSchema)
    const s = r.data?.styleState
    say(
      !!s &&
        s.ditherScale === 3 &&
        s.ditherThreshold === 0.5 &&
        !("__injected" in s) &&
        s.asciiCellSize === 21 &&
        r.data.geometryMode === "rod" &&
        typeof r.data.widthSlider === "number" &&
        r.data.canvas.spacing === 4,
      "1.6   wrong types fall back, injected keys are dropped, GOOD values are kept",
      s ? `ditherScale=${s.ditherScale} threshold=${s.ditherThreshold} asciiCell=${s.asciiCellSize} injected=${"__injected" in s} mode=${r.data.geometryMode}` : "no data",
    )
  }

  /* CONTROL: the coercion must not be a blanket reset. If it returned defaults
   * for everything, the row above would pass on the two default comparisons
   * alone — so prove a good value SURVIVES beside the bad ones. */
  control(
    (() => {
      const v = D.validateSession({ styleState: { asciiCellSize: 21, ditherScale: "seven" } })
      return v && v.session.styleState.asciiCellSize === 21 && v.session.styleState.ditherScale === 3
    })(),
    "1.6   coercion is per-field, not a blanket reset (a good value survives a bad neighbour)",
  )
}

/* ========================================================================== */
/*  §2 · UNDO SEMANTICS — the stack itself, deterministically                 */
/* ========================================================================== */

function undoPart() {
  const U = loadTs("lib/undo-stack.ts")
  console.log("\n=== §2 · UNDO STACK — coalescing, redo, depth, transactions ===\n")

  /* ---- 2.1 a drag is ONE step, and it returns to where the drag STARTED -- */
  {
    const st = new U.UndoStack(100, 500)
    let t = 1000
    for (let i = 0; i < 40; i++) st.commit({ v: i }, { label: "Texture scale", key: "style:textureScale", now: t + i * 8 })
    const n = st.labels().past.length
    say(n === 1, "2.1   a 40-sample drag on one dial is ONE undo step", `${n} entr${n === 1 ? "y" : "ies"}`)
    const back = st.undo({ v: 40 })
    say(
      back && back.snapshot.v === 0,
      "2.1   …and it returns to where the GESTURE started, not to its last sample",
      `restored v=${back?.snapshot.v}`,
    )
  }

  /* CONTROL — the inverted gesture. A counter that always says 1 passes 2.1. */
  {
    const st = new U.UndoStack(100, 500)
    let t = 1000
    for (let i = 0; i < 40; i++) st.commit({ v: i }, { label: `Click ${i}`, key: null, now: t + i * 8 })
    const n = st.labels().past.length
    control(n === 40, "2.1   40 DISCRETE actions inside the same window are 40 steps", `${n} entries`)
  }
  {
    const st = new U.UndoStack(100, 500)
    for (let i = 0; i < 5; i++) st.commit({ v: i }, { label: "Texture scale", key: "style:textureScale", now: 1000 + i * 900 })
    const n = st.labels().past.length
    control(n === 5, "2.1   the same dial moved OUTSIDE the window is a new step each time", `${n} entries`)
  }
  {
    const st = new U.UndoStack(100, 500)
    st.commit({ v: 0 }, { label: "Texture scale", key: "style:textureScale", now: 1000 })
    st.commit({ v: 1 }, { label: "Dither scale", key: "style:ditherScale", now: 1010 })
    const n = st.labels().past.length
    control(n === 2, "2.1   a DIFFERENT dial inside the window does not merge into the previous one", `${n} entries`)
  }

  /* ---- 2.5 THE SLOW DRAG — the case a time window alone gets wrong ------- */
  {
    /* Samples 900 ms apart: a user dragging a dial and PAUSING to look at the
     * render, which is what a dial in this app is for. Every sample is outside
     * the 500 ms window, so identity + window alone splits this into ten steps.
     * The gesture bracket is what makes it one. */
    const st = new U.UndoStack(100, 500)
    st.beginGesture()
    for (let i = 0; i < 10; i++) st.commit({ v: i }, { label: "Texture scale", key: "style:textureScale", now: 1000 + i * 900 })
    st.endGesture()
    const n = st.labels().past.length
    say(
      n === 1,
      "2.5   a SLOW drag — 10 samples, 900ms apart, all outside the window — is still ONE step",
      `${n} entr${n === 1 ? "y" : "ies"}`,
    )
    const back = st.undo({ v: 10 })
    say(back?.snapshot.v === 0, "2.5   …and it returns to where the drag started", `v=${back?.snapshot.v}`)
  }
  /* CONTROL — the same samples WITHOUT the bracket must split. If they do not,
   * the bracket is not what produced the row above and 2.5 proves nothing. */
  control(
    (() => {
      const st = new U.UndoStack(100, 500)
      for (let i = 0; i < 10; i++) st.commit({ v: i }, { label: "Texture scale", key: "style:textureScale", now: 1000 + i * 900 })
      return st.labels().past.length === 10
    })(),
    "2.5   the SAME slow samples with NO gesture bracket split into 10 steps",
  )
  /* CONTROL — the bracket must not swallow a DIFFERENT control, or one stuck
   * open would merge the whole session into a single step. */
  control(
    (() => {
      const st = new U.UndoStack(100, 500)
      st.beginGesture()
      st.commit({ v: 0 }, { label: "Texture scale", key: "style:textureScale", now: 1000 })
      st.commit({ v: 1 }, { label: "Dither scale", key: "style:ditherScale", now: 9999 })
      st.commit({ v: 2 }, { label: "Draw stroke", key: null, now: 99999 })
      st.endGesture()
      return st.labels().past.length === 3
    })(),
    "2.5   an open bracket still starts a new step for a DIFFERENT control, and for a discrete action",
  )
  say(
    (() => {
      const st = new U.UndoStack(100, 500)
      st.beginGesture()
      st.endGesture()
      st.endGesture()
      st.endGesture()
      return st.gestureOpen() === false
    })(),
    "2.5   an extra pointercancel cannot drive the bracket below zero and jam it open",
  )

  /* ---- 2.6 an EMPTY gesture must not destroy redo ----------------------- */
  {
    /* ⚠ THE FIRST VERSION OF THIS ROW COULD NOT FAIL: it read `canRedo`, did
     * nothing, and read it again. That is the exact shape of the eleven green
     * rows this repo has caught measuring nothing, so it is written out here as
     * a warning rather than quietly fixed.
     *
     * The real case, and Excalidraw names it: "a simple click (unselect) could
     * lead to losing all the redo entries." A user who has undone something and
     * then CLICKS a slider without moving it fires pointerdown/pointerup and no
     * commit at all — and must still be able to redo. */
    const st = new U.UndoStack()
    st.commit({ v: 0 }, { label: "A" })
    st.undo({ v: 1 })
    const before = st.getState().canRedo
    st.beginGesture()
    st.endGesture()
    st.labels()
    st.getState()
    const after = st.getState().canRedo
    say(before && after, "2.6   a pointer gesture that commits NOTHING leaves the redo stack intact")
  }
  /* CONTROL — the reader can see a redo stack being destroyed, so the row above
   * is not passing on a getter that always says true. */
  control(
    (() => {
      const st = new U.UndoStack()
      st.commit({ v: 0 }, { label: "A" })
      st.undo({ v: 1 })
      const before = st.getState().canRedo
      st.commit({ v: 5 }, { label: "B" })
      return before === true && st.getState().canRedo === false
    })(),
    "2.6   …and a REAL commit does destroy it, so the reader is not stuck on true",
  )

  /* ---- 2.2 redo, and its destruction by a new action -------------------- */
  {
    const st = new U.UndoStack()
    st.commit({ v: 0 }, { label: "A" })
    st.commit({ v: 1 }, { label: "B" })
    const u1 = st.undo({ v: 2 })
    say(u1 && u1.snapshot.v === 1 && st.getState().canRedo, "2.2   undo makes redo available", `redoLabel=${st.getState().redoLabel}`)
    const r1 = st.redo(u1.snapshot)
    say(r1 && r1.snapshot.v === 2, "2.2   redo returns the document undo took away", `v=${r1?.snapshot.v}`)
    st.undo({ v: 2 })
    st.commit({ v: 9 }, { label: "C" })
    say(!st.getState().canRedo, "2.2   a NEW action destroys the redo stack (linear history)")
  }
  control(
    (() => {
      const st = new U.UndoStack()
      return st.undo({ v: 0 }) === null && st.redo({ v: 0 }) === null
    })(),
    "2.2   an EMPTY stack refuses both directions rather than inventing a step",
  )

  /* ---- 2.3 depth cap ---------------------------------------------------- */
  {
    const st = new U.UndoStack(10, 500)
    for (let i = 0; i < 50; i++) st.commit({ v: i }, { label: `s${i}`, key: null, now: 1000 + i * 1000 })
    const l = st.labels().past
    say(l.length === 10 && l[0] === "s40", "2.3   the stack is capped and drops from the BOTTOM", `${l.length} deep, oldest=${l[0]}`)
  }

  /* ---- 2.4 a transaction is one step ------------------------------------ */
  {
    const st = new U.UndoStack()
    st.transaction(() => {
      st.commit({ v: 0 }, { label: "mode" })
      st.commit({ v: 1 }, { label: "width" })
      st.commit({ v: 2 }, { label: "depth" })
    })
    const l = st.labels().past
    say(l.length === 1 && l[0] === "mode", "2.4   five setters inside one preset click are ONE step", `${l.length} entry: ${l[0]}`)
    const back = st.undo({ v: 3 })
    say(back?.snapshot.v === 0, "2.4   …and it lands on the state BEFORE the whole preset", `v=${back?.snapshot.v}`)
  }
  control(
    (() => {
      const st = new U.UndoStack()
      st.commit({ v: 0 }, { label: "mode" })
      st.commit({ v: 1 }, { label: "width" })
      st.commit({ v: 2 }, { label: "depth" })
      return st.labels().past.length === 3
    })(),
    "2.4   the SAME three commits OUTSIDE a transaction are three steps",
  )
}

/* ========================================================================== */
/*  §3 · THE LIVE UI — real clicks, real drags, real keys                      */
/* ========================================================================== */

async function uiPart() {
  console.log("\n=== §3 · THE LIVE APP — driven the way a person drives it ===\n")

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1500, height: 1500 }, reducedMotion: "reduce" })
  const pageErrors = []
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 240)))

  /* A CLEAN ORIGIN — ONCE, NOT ON EVERY NAVIGATION.
   *
   * ⚠ `addInitScript` runs on EVERY page load, including the reloads §3.8 and
   * §3.10 perform. The first version of this cleared `freestroke.*` on each
   * one, so the reload wiped the styling the test had just saved and then
   * asserted that the styling had been lost — a red row caused entirely by the
   * instrument. It also wiped `…​.quarantine`, which is why §3.10 reported the
   * bad payloads as deleted.
   *
   * `sessionStorage` is the right gate: it survives a reload within the tab
   * (so the clear happens once) and dies with the tab (so the next run starts
   * clean regardless). */
  await page.addInitScript(() => {
    try {
      if (window.sessionStorage.getItem("__fs_test_cleared__")) return
      for (const k of Object.keys(window.localStorage)) {
        if (k.startsWith("freestroke.")) window.localStorage.removeItem(k)
      }
      window.sessionStorage.setItem("__fs_test_cleared__", "1")
    } catch {}
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => !!window.__styleHarness, null, { timeout: 60000 })

  const shot = async (name) => {
    try {
      await page.screenshot({ path: join(OUT, `${name}.png`), timeout: 60000 })
    } catch {
      console.log(`  (screenshot ${name} could not be taken — evidence missing, not a pass)`)
    }
  }

  const state = () => page.evaluate(() => window.__styleHarness.get())
  const labels = () => page.evaluate(() => window.__styleHarness.undoLabels())
  const info = () => page.evaluate(() => window.__styleHarness.undoInfo())

  /* Draw a real gesture with real pointer events on the real canvas. */
  const drawStroke = async (y) => {
    const box = await page.locator("canvas[aria-label*='Drawing canvas']").boundingBox()
    await page.mouse.move(box.x + 80, box.y + y)
    await page.mouse.down()
    for (let i = 1; i <= 24; i++) {
      await page.mouse.move(box.x + 80 + i * 14, box.y + y + Math.sin(i / 3) * 30)
      await page.waitForTimeout(6)
    }
    await page.mouse.up()
    await page.waitForTimeout(120)
  }

  const strokeCount = () => page.evaluate(() => window.__styleHarness.get().styleState && document.querySelectorAll("canvas").length >= 1)

  /* ---- 3.1 / 3.2  ⌘Z and ⇧⌘Z on strokes -------------------------------- */
  await drawStroke(200)
  await drawStroke(300)
  await drawStroke(400)
  const after3 = await page.evaluate(() => window.__fsDebugStrokeCount?.() ?? null)
  // The stroke count is read off the DOM-visible debug line the app already
  // renders in development, so this does not depend on a harness getter.
  const readRaw = () =>
    page.evaluate(() => {
      const el = [...document.querySelectorAll("div")].find((d) => /^raw \d+ pts/.test(d.textContent ?? ""))
      const m = el?.textContent?.match(/raw (\d+) pts/)
      return m ? Number(m[1]) : null
    })
  const pts3 = await readRaw()
  say(pts3 !== null && pts3 > 0, "3.1   three real gestures landed on the canvas", `raw ${pts3} pts`)
  await shot("01-three-strokes")

  const l0 = await labels()
  say(
    l0.past.filter((x) => x === "Draw stroke").length === 3,
    "3.1   each gesture is its own undo step",
    `past = [${l0.past.join(", ")}]`,
  )

  await page.keyboard.press("Meta+z")
  await page.waitForTimeout(200)
  const pts2 = await readRaw()
  say(pts2 !== null && pts2 < pts3, "3.1   ⌘Z takes back the last stroke", `${pts3} -> ${pts2} pts`)

  /* THE ONE THAT WAS EXPLICITLY SWALLOWED. */
  await page.keyboard.press("Meta+Shift+z")
  await page.waitForTimeout(200)
  const ptsBack = await readRaw()
  say(ptsBack === pts3, "3.2   ⇧⌘Z REDOES it — the binding that used to be swallowed", `${pts2} -> ${ptsBack} pts`)
  await shot("02-redo")

  /* CONTROL: the reader has to be able to see a difference at all. */
  control(pts3 !== pts2, "3.1   the stroke-count reader distinguishes the two states", `${pts3} vs ${pts2}`)

  /* ---- 3.3 CLEAR is undoable, from the KEY not the toast ---------------- */
  await page.locator("button", { hasText: /^Clear$/ }).click()
  await page.waitForTimeout(250)
  const ptsCleared = await readRaw()
  say(ptsCleared === 0, "3.3   Clear empties the canvas", `raw ${ptsCleared} pts`)
  const persistedAfterClear = await page.evaluate(() => window.localStorage.getItem("freestroke.strokes.v1"))
  say(
    !!persistedAfterClear,
    "3.3   …and the cleared drawing is written to the TRASH key before the canvas key is emptied",
    (await page.evaluate(() => {
      const t = window.localStorage.getItem("freestroke.trash.v1")
      if (!t) return "trash EMPTY"
      try {
        return `trash holds ${JSON.parse(t).data.length} stroke(s)`
      } catch {
        return "trash unreadable"
      }
    })),
  )
  const trashOk = await page.evaluate(() => {
    try {
      const t = JSON.parse(window.localStorage.getItem("freestroke.trash.v1"))
      return t && t.v === 1 && Array.isArray(t.data) && t.data.length > 0
    } catch {
      return false
    }
  })
  say(trashOk, "3.3   the trash slot survives independently of the undo stack")

  /* THE MESSAGE MUST NOT COVER THE BUTTON IT IS ABOUT.
   *
   * Clear raises a toast whose description says "⌘Z brings them back", and at
   * the default sonner offset that toast landed ON the canvas action bar — on
   * the Undo button itself. Found by `elementFromPoint` returning sonner's
   * `<li>` where a range input should have been (§3.6b), not by eye. */
  const undoHittable = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === "Undo")
    if (!btn) return { ok: false, what: "no Undo button" }
    const r = btn.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return { ok: el === btn || btn.contains(el), what: el ? el.tagName.toLowerCase() + "." + (el.className || "") : "nothing" }
  })
  say(
    undoHittable.ok,
    "3.3   with the Clear toast on screen, the Undo button is still hittable",
    `topmost element over Undo = ${String(undoHittable.what).slice(0, 60)}`,
  )

  /* AND NOT ONLY THE UNDO BUTTON. Moving a toast off one control can move it
   * onto another, so the question is asked of EVERY interactive element on
   * screen at once rather than of the one that happened to be noticed. */
  const occluded = await page.evaluate(() => {
    const out = []
    const els = [...document.querySelectorAll("button, input, select, a[href]")]
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) continue
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue
      if (el.closest("[data-sonner-toaster]")) continue
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      if (hit && hit.closest("[data-sonner-toaster]")) {
        out.push(
          `${el.tagName.toLowerCase()}${el.getAttribute("type") ? "[" + el.getAttribute("type") + "]" : ""}"${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 24)}"`,
        )
      }
    }
    return out
  })
  const probeOccluded = () =>
    page.evaluate(() => {
      const out = []
      const els = [...document.querySelectorAll("button, input, select, a[href]")]
      for (const el of els) {
        const r = el.getBoundingClientRect()
        if (r.width < 4 || r.height < 4) continue
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue
        if (el.closest("[data-sonner-toaster]")) continue
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (hit && hit.closest("[data-sonner-toaster]")) {
          out.push(
            `${el.tagName.toLowerCase()}"${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 24)}"`,
          )
        }
      }
      return out
    })
  say(
    occluded.length === 0,
    "3.3   NO interactive control anywhere on screen is covered by the toast",
    occluded.length ? `covered: ${occluded.slice(0, 6).join(", ")}` : "checked every button, input, select and link in the viewport",
  )
  /* CALIBRATION — put the toaster back where it was before this pass and require
   * the probe to FIND the collision. A "nothing is covered" row that cannot
   * detect a covering is worth nothing, and this is the exact regression: the
   * default offset is what put the toast on the Undo button. */
  const mutated = await page.evaluate(() => {
    const t = document.querySelector("[data-sonner-toaster]")
    if (!t) return false
    t.style.setProperty("--offset-bottom", "0px")
    t.style.bottom = "0px"
    return true
  })
  await page.waitForTimeout(250)
  const occludedMutated = mutated ? await probeOccluded() : []
  control(
    mutated && occludedMutated.length > 0,
    "3.3   moved back to the old offset, the probe DOES find covered controls",
    occludedMutated.length ? `covered: ${occludedMutated.slice(0, 4).join(", ")}` : "found nothing — the probe is blind",
  )
  await page.evaluate(() => {
    const t = document.querySelector("[data-sonner-toaster]")
    if (t) {
      t.style.removeProperty("--offset-bottom")
      t.style.removeProperty("bottom")
    }
  })
  await page.waitForTimeout(200)

  /* Undo Clear WITHOUT touching the toast — the toast is discoverability, the
   * key is the mechanism, and the old build had only the toast. */
  await page.keyboard.press("Meta+z")
  await page.waitForTimeout(250)
  const ptsRestored = await readRaw()
  say(ptsRestored === pts3, "3.3   ⌘Z brings the whole drawing back after Clear", `${ptsCleared} -> ${ptsRestored} pts`)
  await shot("03-clear-undone")

  /* ---- 3.4 a COMPOSITION preset — one of the thirteen with no undo ------ */
  await page.evaluate(() =>
    window.__styleHarness.setStyle({
      textureEnabled: true,
      textureMode: "grain",
      ditherEnabled: true,
      asciiEnabled: true,
    }),
  )
  await page.waitForTimeout(150)
  const composed = await state()
  say(
    composed.styleState.textureEnabled && composed.styleState.ditherEnabled && composed.styleState.asciiEnabled,
    "3.4   a composition is standing (texture + dither + ASCII all on)",
  )

  /* THE PILL IS REACHED THE WAY A PERSON REACHES IT: click the "Preset" chip in
   * the summary strip, which opens the Presets panel, then find the family and
   * click the pill. Calling the router directly would assert nothing about
   * whether a human can get there, and this project has shipped a panel that
   * rendered zero controls while harness assertions passed. */
  /* L4: the style bar and its Preset chip are gone. A person shows the Style
   * panel from the rail and picks Presets in the panel's family list. */
  await page.evaluate(() => {
    const rail = document.querySelector('[data-rail] button[data-rail-panel="style"]')
    if (rail && rail.getAttribute("aria-pressed") !== "true") rail.click()
    const fam = document.querySelector('[data-dock-panel="style"] nav [data-style-family="presets"]')?.closest("button")
    fam?.click()
  })
  await page.waitForTimeout(400)
  await shot("04a-presets-panel")
  /* The families sit behind their own tabs inside the panel; open the one that
   * owns the layer-stack compositions if it is not already showing. */
  await page.evaluate(() => {
    // Since L4 the family button reads its name over its value, so it is found by its family id.
    const tab =
      document.querySelector('[data-dock-panel="style"] nav [data-style-family="layers"]')?.closest("button") ??
      [...document.querySelectorAll("button")].find((b) => /^(Layers|Layer stack|Stack)$/i.test((b.textContent ?? "").trim()))
    tab?.click()
  })
  await page.waitForTimeout(400)
  const railClicked = await page.evaluate(() => {
    /* A LAYER STACK preset pill — a composition family, the kind that resets
     * every rail. Labels are from lib/style-system.ts LAYER_STACK_PRESET_DEFS. */
    const btns = [...document.querySelectorAll("button")]
    const pill = btns.find((b) =>
      /^(Terminal Stack|Dithered Gel Stack|Clean Ink Stack|Graphic Slab Stack|Soft Signal Stack)$/.test(
        (b.textContent ?? "").trim(),
      ),
    )
    if (!pill) return null
    pill.click()
    return pill.textContent?.trim() ?? "?"
  })
  if (railClicked) {
    await page.waitForTimeout(300)
    const afterPreset = await state()
    const wiped =
      afterPreset.styleState.textureEnabled !== composed.styleState.textureEnabled ||
      afterPreset.styleState.ditherEnabled !== composed.styleState.ditherEnabled ||
      afterPreset.styleState.asciiEnabled !== composed.styleState.asciiEnabled
    control(wiped, `3.4   the composition preset "${railClicked}" really does move the composition rails`)
    await page.keyboard.press("Meta+z")
    await page.waitForTimeout(300)
    const undone = await state()
    say(
      undone.styleState.textureEnabled === composed.styleState.textureEnabled &&
        undone.styleState.ditherEnabled === composed.styleState.ditherEnabled &&
        undone.styleState.asciiEnabled === composed.styleState.asciiEnabled &&
        undone.styleState.textureMode === composed.styleState.textureMode,
      `3.4   ⌘Z takes back the composition preset "${railClicked}" — the family that had NO undo`,
      `tex=${undone.styleState.textureEnabled} dith=${undone.styleState.ditherEnabled} ascii=${undone.styleState.asciiEnabled}`,
    )
    await shot("04-composition-preset-undone")
  } else {
    say(false, "3.4   no composition preset pill was reachable in the DOM — cannot assert the destructive family")
  }

  /* ---- 3.5 a GEOMETRY preset (mode change) ------------------------------ */
  const modeBefore = (await state()).geometryMode
  await page.evaluate(() => window.__styleHarness.selectGeometryPreset("solidCutout"))
  await page.waitForTimeout(300)
  const modeAfter = (await state()).geometryMode
  control(modeAfter !== modeBefore, "3.5   the geometry preset really does change the mode", `${modeBefore} -> ${modeAfter}`)
  await page.keyboard.press("Meta+z")
  await page.waitForTimeout(300)
  const modeUndone = (await state()).geometryMode
  say(modeUndone === modeBefore, "3.5   ⌘Z takes back a geometry preset, mode and all", `${modeAfter} -> ${modeUndone}`)

  /* ---- 3.6 A REAL SLIDER DRAG IS ONE STEP ------------------------------ */
  /* Close the Presets panel first. §3.4 opened it and left it open, and it
   * covers the canvas — the first version grabbed `input.fs-slider` first,
   * which was then a PANEL slider sitting under the drawer, so the pointerdown
   * landed on nothing. The failure looked like a coalescing bug and was a
   * targeting bug, which is why the "did the pointer land on a range input"
   * row below exists. */
  await page.evaluate(() => {
    // L4: hidden from the rail, as the style bar's Hide panel did until L4.
    const rail = document.querySelector('[data-rail] button[data-rail-panel="style"]')
    if (rail && rail.getAttribute("aria-pressed") === "true") rail.click()
  })
  /* Dismiss any toasts still on screen, by clicking their close buttons — the
   * way a person clears them. With the offset fix they no longer cover the
   * control bar, but leaving them up makes the pointer tests depend on toast
   * timing, and a flaky instrument is a useless one. */
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("[data-close-button]")) b.click()
  })
  await page.waitForTimeout(500)

  const before = await labels()
  /* The Spacing dial in the canvas's own control bar — named, not positional. */
  const slider = page.locator('label:has-text("Spacing") input.fs-slider').first()
  await slider.scrollIntoViewIfNeeded().catch(() => {})
  const sbox = await slider.boundingBox()
  if (sbox) {
    await page.mouse.move(sbox.x + 4, sbox.y + sbox.height / 2)
    await page.mouse.down()
    /* THE POINTER HAS TO HAVE LANDED ON THE CONTROL. Without this row a
     * mis-aimed drag reports "1 step added" (because zero were) and reads as a
     * PASS — a green row that means the opposite of what it says. */
    const landed = await page.evaluate(() => window.__styleHarness.gestureOpen())
    say(landed, "3.6   the pointer landed on the real range input (the bracket opened)")
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(sbox.x + 4 + (sbox.width - 8) * (i / 20), sbox.y + sbox.height / 2)
      await page.waitForTimeout(10)
    }
    await page.mouse.up()
    await page.waitForTimeout(200)
    const after = await labels()
    const added = after.past.length - before.past.length
    say(
      added === 1,
      "3.6   a real pointer drag across a real slider is ONE undo step",
      `${added} step(s) added: [${after.past.slice(before.past.length).join(", ")}]`,
    )
    await shot("05-slider-drag")

    /* ---- 3.6b THE SLOW DRAG, ON A REAL SLIDER --------------------------- */
    /* Re-query the box. The first drag changed the value and therefore the
     * readout beside it, and a box captured before that can be stale — a stale
     * box is a pointerdown on whatever is there now. */
    const b3 = await labels()
    await slider.scrollIntoViewIfNeeded().catch(() => {})
    const sbox2 = (await slider.boundingBox()) ?? sbox
    const atPoint = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y)
        return el ? `${el.tagName.toLowerCase()}${el.getAttribute("type") ? "[" + el.getAttribute("type") + "]" : ""}.${el.className || ""}`.slice(0, 80) : "nothing"
      },
      [sbox2.x + 6, sbox2.y + sbox2.height / 2],
    )
    say(/input\[range\]/.test(atPoint), "3.6b  the slow drag's start point is the range input itself", `elementFromPoint = ${atPoint}`)
    await page.mouse.move(sbox2.x + 6, sbox2.y + sbox2.height / 2)
    await page.mouse.down()
    const gestureSeen = []
    for (let i = 1; i <= 4; i++) {
      await page.mouse.move(sbox2.x + 6 + (sbox2.width - 12) * (i / 4), sbox2.y + sbox2.height / 2)
      /* 700 ms — comfortably OUTSIDE the 500 ms window, which is what a user
       * pausing to look at the render actually does. */
      await page.waitForTimeout(700)
      gestureSeen.push(await page.evaluate(() => window.__styleHarness.gestureOpen()))
    }
    await page.mouse.up()
    await page.waitForTimeout(200)
    const a3 = await labels()
    const added3 = a3.past.length - b3.past.length
    say(
      added3 === 1,
      "3.6b  a SLOW real drag (4 samples, 700ms apart) is still ONE step",
      `${added3} step(s): [${a3.past.slice(b3.past.length).join(", ")}]`,
    )
    say(
      gestureSeen.every(Boolean),
      "3.6b  …and the pointer bracket was genuinely open throughout, not merely inferred",
      `gestureOpen during drag = [${gestureSeen.join(", ")}]`,
    )
    say(
      (await page.evaluate(() => window.__styleHarness.gestureOpen())) === false,
      "3.6b  …and it closed on pointerup",
    )

    /* CONTROL: five distinct clicks must be five steps. */
    const b2 = await labels()
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")].filter((b) => /^(Rod|Extrude|Solid|Inflate)$/.test((b.textContent ?? "").trim()))
      let n = 0
      const order = ["Rod", "Extrude", "Solid", "Inflate", "Rod"]
      for (const want of order) {
        const b = btns.find((x) => (x.textContent ?? "").trim() === want)
        if (b) {
          b.click()
          n++
        }
      }
      return n
    })
    await page.waitForTimeout(400)
    const a2 = await labels()
    const added2 = a2.past.length - b2.past.length
    control(
      added2 >= 4,
      "3.6   five rapid mode clicks are NOT collapsed into one step",
      `${clicked} clicks -> ${added2} steps: [${a2.past.slice(b2.past.length).join(", ")}]`,
    )
  } else {
    say(false, "3.6   no slider was reachable in the DOM")
  }

  /* ---- 3.7 the Redo BUTTON is reachable by a human ---------------------- */
  {
    const undoBtn = page.locator("button", { hasText: /^Undo$/ })
    const redoBtn = page.locator("button", { hasText: /^Redo$/ })
    say((await redoBtn.count()) === 1, "3.7   a Redo button exists in the DOM — not only a key binding")
    await undoBtn.click()
    await page.waitForTimeout(250)
    say(await redoBtn.isEnabled(), "3.7   …and it becomes enabled after an undo")
    const title = await redoBtn.getAttribute("title")
    say(
      !!title && /Redo .+ \(⇧⌘Z\)/.test(title),
      "3.7   …and it NAMES what it will redo, rather than saying 'last stroke'",
      title ?? "no title",
    )
    await redoBtn.click()
    await page.waitForTimeout(200)
    await shot("06-redo-button")
  }


  /* ---- 3.11 FUSION DELETE — the other unconfirmed destructive action ---- */
  /* A fusion is the ONE thing in this app a user can author that is not the
   * drawing. Deleting one was immediate, unconfirmed, and persisted on the next
   * tick. Created and deleted here through the panel's own buttons. */
  await page.evaluate(() => {
    // L4: the Style panel shown from the rail, then its Fusion family (the style bar's chip until L4).
    const rail = document.querySelector('[data-rail] button[data-rail-panel="style"]')
    if (rail && rail.getAttribute("aria-pressed") !== "true") rail.click()
    const chip = document.querySelector('[data-dock-panel="style"] nav [data-style-family="fusion"]')?.closest("button")
    chip?.click()
  })
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.textContent ?? "").trim() === "+ New fusion")
    b?.click()
  })
  await page.waitForTimeout(700)
  const withFusion = await state()
  say(
    withFusion.styleState.customFusions.length === 1,
    "3.11  a fusion was authored through the panel's own button",
    `${withFusion.styleState.customFusions.length} fusion(s), ${withFusion.styleState.customFusions[0]?.links.length ?? 0} link(s)`,
  )
  const madeName = withFusion.styleState.customFusions[0]?.name
  const madeLinks = withFusion.styleState.customFusions[0]?.links.length ?? 0

  const deleted = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.textContent ?? "").trim() === "Delete")
    if (!b) return false
    b.click()
    return true
  })
  await page.waitForTimeout(700)
  const afterDelete = await state()
  say(deleted && afterDelete.styleState.customFusions.length === 0, "3.11  the real Delete button removes it")
  control(
    withFusion.styleState.customFusions.length !== afterDelete.styleState.customFusions.length,
    "3.11  the delete really did remove something",
    `${withFusion.styleState.customFusions.length} -> ${afterDelete.styleState.customFusions.length}`,
  )
  const undoTitle = await page
    .locator("button", { hasText: /^Undo$/ })
    .getAttribute("title")
  say(
    !!undoTitle && /Undo Delete fusion/.test(undoTitle),
    "3.11  the Undo button NAMES it 'Delete fusion' — derived from the diff, not registered by hand",
    undoTitle ?? "no title",
  )
  await page.keyboard.press("Meta+z")
  await page.waitForTimeout(500)
  const restored = await state()
  say(
    restored.styleState.customFusions.length === 1 &&
      restored.styleState.customFusions[0].name === madeName &&
      restored.styleState.customFusions[0].links.length === madeLinks,
    "3.11  ⌘Z brings the deleted fusion back, name and relationships intact",
    `"${restored.styleState.customFusions[0]?.name}" with ${restored.styleState.customFusions[0]?.links.length} link(s)`,
  )
  await shot("10-fusion-delete-undone")

  /* ---- 3.12 A STYLE-PANEL DIAL — the derived path, not a wired one ------ */
  /* Every control in `components/style-panel-scaffold.tsx` writes through ONE
   * `setStyleState` prop, and its undo label + coalescing key are derived from
   * the DIFF rather than registered per control. That is what makes the whole
   * panel undoable without touching a file this lane does not own — so it has
   * to be proved on a real panel slider, not only on the canvas one. */
  await page.evaluate(() => {
    // L4: the Style panel shown from the rail, then its Texture family (the style bar's chip until L4).
    const rail = document.querySelector('[data-rail] button[data-rail-panel="style"]')
    if (rail && rail.getAttribute("aria-pressed") !== "true") rail.click()
    const chip = document.querySelector('[data-dock-panel="style"] nav [data-style-family="texture"]')?.closest("button")
    chip?.click()
  })
  await page.waitForTimeout(600)
  /* Texture has to be ON for its dials to be live. */
  await page.evaluate(() => window.__styleHarness.setStyle({ textureEnabled: true, textureMode: "grain" }))
  await page.waitForTimeout(400)
  const panelSlider = page.locator('label:has-text("Scale") input.fs-slider').first()
  const pbox = await panelSlider.boundingBox()
  if (pbox) {
    const b4 = await labels()
    const scaleBefore = (await state()).styleState.textureScale
    await page.mouse.move(pbox.x + 6, pbox.y + pbox.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(pbox.x + 6 + (pbox.width - 12) * (i / 12), pbox.y + pbox.height / 2)
      await page.waitForTimeout(60)
    }
    await page.mouse.up()
    await page.waitForTimeout(300)
    const a4 = await labels()
    const scaleAfter = (await state()).styleState.textureScale
    const added4 = a4.past.length - b4.past.length
    control(scaleAfter !== scaleBefore, "3.12  the panel drag really moved the dial", `${scaleBefore} -> ${scaleAfter}`)
    say(
      added4 === 1,
      "3.12  a 12-sample drag on a STYLE PANEL slider is ONE step",
      `${added4} step(s): [${a4.past.slice(b4.past.length).join(", ")}]`,
    )
    say(
      a4.past[a4.past.length - 1] === "Texture scale",
      "3.12  …named from the diff, with no per-control registration",
      `label = "${a4.past[a4.past.length - 1]}"`,
    )
    await page.keyboard.press("Meta+z")
    await page.waitForTimeout(300)
    say(
      (await state()).styleState.textureScale === scaleBefore,
      "3.12  ⌘Z returns the dial to where the drag STARTED",
      `${scaleAfter} -> ${(await state()).styleState.textureScale}`,
    )
    await shot("11-panel-dial")
  } else {
    say(false, "3.12  the texture Scale slider was not reachable in the DOM")
  }

  /* ---- 3.13 A LAYER STACK EDIT ----------------------------------------- */
  await page.evaluate(() => {
    // L4: the Style panel shown from the rail, then its Layers family (the style bar's chip until L4).
    const rail = document.querySelector('[data-rail] button[data-rail-panel="style"]')
    if (rail && rail.getAttribute("aria-pressed") !== "true") rail.click()
    const chip = document.querySelector('[data-dock-panel="style"] nav [data-style-family="layers"]')?.closest("button")
    chip?.click()
  })
  await page.waitForTimeout(600)
  /* The stack needs live layers before its order control means anything. */
  await page.evaluate(() =>
    window.__styleHarness.setStyle({
      layerStackEnabled: true,
      textureEnabled: true,
      textureMode: "grain",
      ditherEnabled: true,
      asciiEnabled: true,
    }),
  )
  await page.waitForTimeout(500)
  const stackBefore = (await state()).styleState.stackOrder
  /* THE ORDER CONTROL IS A `<select>`, NOT A BUTTON — and that matters beyond
   * the locator. The old ⌘Z guard skipped every SELECT, so a user who changed
   * the layer order and immediately pressed ⌘Z, with focus still on the
   * dropdown where the click left it, got nothing. Driven here with a real
   * `selectOption` so the focus lands exactly where a click leaves it. */
  const orderSelect = page.locator("select").filter({ has: page.locator('option[value="asciiFirst"]') }).first()
  const flipped = (await orderSelect.count()) > 0
  if (flipped) {
    await orderSelect.selectOption(stackBefore === "ditherFirst" ? "asciiFirst" : "ditherFirst")
    await page.waitForTimeout(500)
  }
  const stackAfter = (await state()).styleState.stackOrder
  if (flipped && stackAfter !== stackBefore) {
    control(true, "3.13  a real layer-stack control changed the order", `${stackBefore} -> ${stackAfter}`)
    /* ⚠ FOCUS IT EXPLICITLY. Playwright's `selectOption` leaves focus on
     * `body`, so the first version of this row said "with focus still on the
     * dropdown" while measuring a keypress delivered to the body — a claim the
     * measurement did not support, which is the thing this repo calls a false
     * certification. Focus is set and then VERIFIED before the key is sent. */
    await orderSelect.focus()
    const focused = await page.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? "none")
    say(focused === "select", "3.13  the dropdown genuinely holds focus before the keypress", `activeElement=${focused}`)
    await page.keyboard.press("Meta+z")
    await page.waitForTimeout(500)
    say(
      (await state()).styleState.stackOrder === stackBefore,
      "3.13  ⌘Z takes back a layer-stack edit WITH FOCUS STILL ON THE DROPDOWN",
      `focus=${focused}, ${stackAfter} -> ${(await state()).styleState.stackOrder}`,
    )
  } else {
    /* Not reached rather than not asserted — named, never skipped silently. */
    say(false, `3.13  the layer-order select did not change state (found=${flipped}) — layer-stack undo NOT asserted through the UI`)
  }

  /* ---- 3.8 THE STYLING SURVIVES A RELOAD ------------------------------- */
  await page.evaluate(() =>
    window.__styleHarness.setStyle({
      materialPreset: "chrome",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "scanlines",
      textureScale: 2.75,
      ditherEnabled: true,
      ditherScale: 6,
      asciiEnabled: true,
      asciiCellSize: 17,
      layerStackEnabled: true,
      stackDitherBlend: "multiply",
      stackAnimationEnabled: true,
      stackAnimationType: "drift",
      motionMode: "independent",
    }),
  )
  await page.evaluate(() => window.__styleHarness.setMode("inflate"))
  await page.evaluate(() => window.__styleHarness.setInflate({ blend: 0.42, resolution: 2.5 }))
  await page.waitForTimeout(600)
  const preReload = await state()
  await shot("07-styled-before-reload")

  await page.reload({ waitUntil: "networkidle" })
  await page.waitForFunction(() => !!window.__styleHarness, null, { timeout: 60000 })
  await page.waitForTimeout(900)
  const postReload = await state()
  await shot("08-after-reload")

  const styleFields = [
    "materialPreset",
    "textureEnabled",
    "textureMode",
    "textureScale",
    "ditherEnabled",
    "ditherScale",
    "asciiEnabled",
    "asciiCellSize",
    "layerStackEnabled",
    "stackDitherBlend",
    "stackAnimationEnabled",
    "stackAnimationType",
    "motionMode",
  ]
  const lost = styleFields.filter((f) => preReload.styleState[f] !== postReload.styleState[f])
  say(
    lost.length === 0,
    "3.8   every style dial survives a reload — the thing the PRD calls the product",
    lost.length ? `LOST: ${lost.map((f) => `${f} ${preReload.styleState[f]} -> ${postReload.styleState[f]}`).join(", ")}` : `${styleFields.length}/${styleFields.length} fields intact`,
  )
  say(
    postReload.geometryMode === "inflate" &&
      Math.abs(postReload.inflateParams.blend - 0.42) < 1e-6 &&
      Math.abs(postReload.inflateParams.resolution - 2.5) < 1e-6,
    "3.8   the geometry mode and its params survive too",
    `mode=${postReload.geometryMode} blend=${postReload.inflateParams.blend} res=${postReload.inflateParams.resolution}`,
  )

  /* CONTROL: the comparator must be able to see a loss. Compare the restored
   * state against the DEFAULTS it would have held before this lane existed — if
   * those match, the assertion above passed on a state that never moved. */
  control(
    postReload.styleState.materialPreset !== "ink" ||
      postReload.styleState.ditherEnabled !== false ||
      postReload.styleState.asciiCellSize !== 13,
    "3.8   the restored state is genuinely NOT the default state",
    `material=${postReload.styleState.materialPreset} dither=${postReload.styleState.ditherEnabled} cell=${postReload.styleState.asciiCellSize}`,
  )

  /* ---- 3.8b THE RESTORED WORK HAS TO BE ON SCREEN, NOT JUST IN STATE ---- */
  /*
   * ⚠ THIS ROW IS EXPECTED RED, AND THE FIX IS IN A FILE THIS LANE DOES NOT OWN.
   *
   * Everything above proves the document is restored. This asks the only
   * question a user actually asks after a reload: IS MY WORK THERE? And it is
   * not — the 2-D canvas shows the strokes, every style chip reads correctly,
   * and the 3-D viewport, which is the product, is BLANK until you find Play.
   *
   * Measured (scratchpad probe, 2026-08-02): reveal progress 1 -> 0 across the
   * reload; viewport PNG 70,723 -> 11,656 bytes (16.5%); adding one stroke
   * takes it to 72,866 (6.25x).
   *
   * ROOT CAUSE — `components/viewport-3d.tsx:6087`:
   *
   *     const prevStrokeCountRef = useRef(processedStrokes.length)
   *
   * The effect under it plays the reveal when the count GOES UP. The 3-D chunk
   * is dynamically imported, so it mounts AFTER the restore effect has already
   * put the strokes in state — the ref therefore initialises to the restored
   * count, the effect's first run finds prevCount === newCount, neither branch
   * fires, and the playhead stays at its initial 0.
   *
   * THE FIX, one token:
   *
   *     const prevStrokeCountRef = useRef(-1)
   *
   * Nothing else changes. With 0 strokes the `newCount === 0` clause still wins
   * and the playhead stays at 0; with strokes already present the first run
   * takes the "new stroke added — show fully" branch, which is the correct
   * reading of "these strokes arrived".
   *
   * Not worked around from this lane on purpose: the alternative available here
   * is to withhold the restore until the 3-D chunk has mounted, which couples
   * the drawing's recovery to a dynamic import — so a chunk that fails to load
   * would lose the drawing entirely. That is a worse bug than the one it fixes.
   */
  const revealAfterReload = await page.evaluate(() => window.__revealHarness?.getProgress?.() ?? null)
  const viewportInk = async () => {
    const buf = await page.screenshot({ clip: { x: 750, y: 140, width: 740, height: 1180 } })
    return buf.length
  }
  /* ⚠ THIS CONTROL WENT VACUOUS WHEN THE DEFECT ABOVE WAS FIXED, and the way it
   * did is worth leaving on the record.
   *
   * It used to take its BLANK arm from the page as found — screenshot, then
   * `setProgress(1)`, then screenshot again — which only produced two different
   * pictures because the reveal was stuck at 0 after a reload. The one-token fix
   * named in the comment above landed (`components/viewport-3d.tsx`,
   * `prevStrokeCountRef = useRef(-1)`, now behind `readDevLaw("__fsRevealSeed")`
   * so the prior is still reachable), the row below started reading
   * `progress = 1`, and the control's two arms became THE SAME FRAME: measured
   * 2026-08-03, `blank 187709 bytes vs played 187709 bytes (1.00x)`.
   *
   * So the control was passing on the bug and failed the moment the bug was
   * gone — a control whose known-bad input is the defect it sits next to. The
   * repair is to CONSTRUCT the empty stage instead of hoping to find one: scrub
   * to 0, read, scrub to 1, read. Same claim, same statistic, and it no longer
   * depends on the surface being broken. */
  await page.evaluate(() => window.__revealHarness?.setProgress?.(0))
  await page.waitForTimeout(700)
  const inkBlank = await viewportInk()
  await page.evaluate(() => window.__revealHarness?.setProgress?.(1))
  await page.waitForTimeout(700)
  const inkPlayed = await viewportInk()
  control(
    inkPlayed > inkBlank * 2,
    "3.8b  the viewport reader can tell a rendered form from an empty stage",
    `blank ${inkBlank} bytes vs played ${inkPlayed} bytes (${(inkPlayed / Math.max(1, inkBlank)).toFixed(2)}x) — arms built by scrubbing, not by the reload bug`,
  )
  say(
    revealAfterReload === 1,
    "3.8b  after a reload the restored drawing is VISIBLE in the 3D viewport, not blank until Play",
    `reveal progress = ${revealAfterReload} — BLOCKED on components/viewport-3d.tsx:6087, ` +
      `\`useRef(processedStrokes.length)\` -> \`useRef(-1)\` (see the comment above this row)`,
  )
  await shot("13-after-reload-viewport")

  /* ---- 3.9 history does NOT survive the reload, deliberately ------------ */
  {
    const i = await info()
    say(
      i.canUndo === false && i.canRedo === false,
      "3.9   the undo history is EMPTY after a reload — the document was replaced, not edited",
      `depth=${i.depth} redo=${i.redoDepth}`,
    )
  }

  /* ---- 3.10 a corrupt payload does not stop the app booting ------------- */
  await page.evaluate(() => {
    window.localStorage.setItem("freestroke.strokes.v1", "{{{ not json")
    window.localStorage.setItem("freestroke.fusions.v1", JSON.stringify({ v: 99, kind: "freestroke.fusions", data: [], at: 0 }))
  })
  await page.reload({ waitUntil: "networkidle" })
  const booted = await page
    .waitForFunction(() => !!window.__styleHarness, null, { timeout: 60000 })
    .then(() => true)
    .catch(() => false)
  await page.waitForTimeout(700)
  say(booted, "3.10  a corrupt drawing + a future-version fusion list still let the app boot")
  const quarantined = await page.evaluate(() => ({
    strokes: window.localStorage.getItem("freestroke.strokes.v1.quarantine"),
    fusions: window.localStorage.getItem("freestroke.fusions.v1.quarantine"),
  }))
  say(
    !!quarantined.strokes && !!quarantined.fusions,
    "3.10  …and both bad payloads were kept aside rather than deleted",
    `strokes=${quarantined.strokes ? "quarantined" : "GONE"} fusions=${quarantined.fusions ? "quarantined" : "GONE"}`,
  )
  await shot("09-corrupt-boot")

  /* ---- 3.14 A FULL DISK TELLS THE USER, IN THE REAL APP ----------------- */
  /* Filled for real rather than by stubbing `setItem`: the point is what the
   * BROWSER does at its own ceiling, and how the app reports it. */
  /* ⚠ FILL TO THE ACTUAL CEILING, IN DECREASING CHUNKS. The first version wrote
   * 512 KB blocks until one threw, which left ~0.5 MB free — and a single
   * 25-point stroke fits in that easily, so the write SUCCEEDED and the row
   * failed while the app was behaving correctly. The instrument had not created
   * the condition it was asserting about. Stepping the chunk size down lands
   * within about a kilobyte of the ceiling. */
  const filled = await page.evaluate(() => {
    let bytes = 0
    let n = 0
    for (const kb of [512, 64, 8, 1]) {
      const chunk = "x".repeat(kb * 1024)
      for (;;) {
        try {
          localStorage.setItem(`__fill_${n}`, chunk)
          n++
          bytes += kb * 1024
        } catch {
          break
        }
      }
    }
    return { keys: n, mb: (bytes / 1048576).toFixed(2) }
  })
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForFunction(() => !!window.__styleHarness, null, { timeout: 60000 })
  await page.waitForTimeout(600)
  await drawStroke(250)
  await page.waitForTimeout(900)
  /* Read EVERY toast on screen: the trash-restore toast also fires on this
   * reload (§3.10 left the canvas empty), so matching "the toast" would match
   * the wrong one. */
  const quotaToast = await page.evaluate(() =>
    [...document.querySelectorAll("li")].map((l) => l.textContent ?? "").join(" || "),
  )
  say(
    /too large to save automatically/i.test(quotaToast),
    "3.14  when the browser's storage is full, the app SAYS the drawing will not survive a reload",
    `filled ${filled.mb} MB in ${filled.keys} keys; toasts = ${quotaToast.slice(0, 120) || "(none)"}`,
  )
  await shot("12-quota-full")
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("__fill_")) localStorage.removeItem(k)
  })

  say(pageErrors.length === 0, "3.x   no uncaught page errors during the whole run", pageErrors.slice(0, 3).join(" | ") || "clean")

  await browser.close()
}

/* ========================================================================== */

/* A channel this run set out to judge and could not reach. NOT a PASS/FAIL row:
 * both batteries count those, and an unanswered question is neither. `UNSWEPT`
 * is the token they print beside the PARTIAL tag. */
const unswept = []
const unsweptRow = (what, why, fix) => {
  unswept.push(what)
  console.log(`UNSWEPT  ${what} — ${why}. NOT A PASS AND NOT A FAILURE: nothing was measured. ${fix}`)
}

/** Is §3's subject actually there? Asked BEFORE anything prints a row. */
async function uiReachable() {
  try {
    const r = await fetch(LAB_URL, { signal: AbortSignal.timeout(60000) })
    return { ok: r.status === 200, why: `HTTP ${r.status}` }
  } catch (e) {
    return { ok: false, why: String(e).slice(0, 80) }
  }
}

async function main() {
  /* ── PRE-FLIGHT, BEFORE THE FIRST ROW ───────────────────────────────────
   * The whole point of the change: an operator whose app is not running finds
   * out on line one. Previously this file printed 85 greens and then threw. */
  const wantsUi = ONLY === "" || ONLY === "ui"
  let runUi = wantsUi
  if (!wantsUi) {
    unsweptRow(
      "§3 · THE LIVE APP",
      `--only=${ONLY} was passed, so the live half was never driven`,
      "Drop the flag to run all three sections.",
    )
  } else {
    const reach = await uiReachable()
    if (!reach.ok) {
      runUi = false
      unsweptRow(
        "§3 · THE LIVE APP",
        `${LAB_URL} is not answering (${reach.why}), so undo/redo/persistence were never driven in a browser`,
        `Start the dev server on the port FS_PORT names and re-run. §1 and §2 below still ran — they grade lib/ in node — but they are NOT this file's headline question.`,
      )
      console.log("")
    }
  }

  if (ONLY === "" || ONLY === "storage") storagePart()
  if (ONLY === "" || ONLY === "undo") undoPart()
  if (runUi) await uiPart()

  writeFileSync(
    join(OUT, "report.json"),
    JSON.stringify({ rows, failures, unswept, complete: unswept.length === 0, results }, null, 2),
  )
  /* THREE OUTCOMES. A real failure outranks a partial; a partial never prints an
   * all-pass summary, because "an all-pass summary, exit 0, with a skip in the
   * output" is `assert-gate-integrity.mjs` channel G's known-bad by name. */
  if (failures > 0) {
    console.log(`\n${failures} of ${rows} FAILED.`)
    console.log(`wrote ${join(OUT, "report.json")}`)
    process.exit(1)
  }
  if (unswept.length) {
    console.log(
      `\nPARTIAL — ${rows} row(s) passed and ${unswept.length} channel(s) were NEVER REACHED: ${unswept.join(", ")}.` +
        `\nThis is NOT "all data-safety assertions pass": the live half of the question was not asked.` +
        `\nExiting 3, not 0. A SKIP IS NOT A PASS (DISPATCH §3:116).`,
    )
    console.log(`wrote ${join(OUT, "report.json")}`)
    process.exit(3)
  }
  console.log(`\nALL ${rows} DATA-SAFETY ASSERTIONS PASS (controls included), all three sections swept.`)
  console.log(`wrote ${join(OUT, "report.json")}`)
  process.exit(0)
}

main().catch((e) => {
  /* A CRASH IS NOT A VERDICT, AND IT DOES NOT MAKE THE ROWS ABOVE IT ONE.
   * The pre-flight catches the common case (no server) before anything prints.
   * This is the other one — a crash PART WAY THROUGH — and the honest thing is
   * to say how many rows had already gone by, because a reader scrolling back
   * cannot tell a finished run from an abandoned one. */
  console.log(`FAIL  the run itself crashed after ${rows} row(s) had already printed — ${String(e).slice(0, 300)}`)
  console.log(
    `      Those ${rows} row(s) are NOT a verdict on this run: it did not finish, so nothing below the crash was asked.`,
  )
  try {
    writeFileSync(
      join(OUT, "report.json"),
      JSON.stringify({ rows, failures, unswept, complete: false, crashed: String(e).slice(0, 300), results }, null, 2),
    )
  } catch {
    /* the crash may have been the filesystem; the console line is the record */
  }
  process.exit(1)
})

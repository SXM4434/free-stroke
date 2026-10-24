// PROBE — can a single coordinate hang `resampleStroke` until the process dies?
//
// WHY THIS EXISTS. `lib/stroke-processing.ts`'s arc-length resampler walks each
// segment with
//
//     while (walked <= segLen) { out.push(...); walked += spacing }
//
// and its only guard was `if (segLen === 0) continue`. `segLen` is
// `Math.sqrt(dx*dx + dy*dy)`, which is +Infinity for a non-finite coordinate AND
// for two finite coordinates far enough apart that the SQUARE overflows a double
// (|dx| > ~1.34e154). `walked <= Infinity` is true forever, so the loop never
// terminates and `out` grows without bound: the tab does not throw, it dies.
//
// The other family is `spacing`: `walked += spacing` with `spacing <= 0` or NaN
// never advances either. `spacing` comes from a UI slider
// (`components/drawing-canvas.tsx:510`) and from persisted documents
// (`lib/doc-store.ts`), neither of which is a trusted channel.
//
// HOW IT IS PROVED, given the failure mode is "never returns": each case runs in
// its OWN child process with a hard `--max-old-space-size` cap and a wall-clock
// timeout. Nothing here can hang the parent.
//
// BOTH ARMS ARE RUN. `RESAMPLE_TUNING.guards = "off"` restores the pre-fix walk
// verbatim, and it is the NEGATIVE CONTROL: every malformed case must still die
// there. A guard whose only evidence is its own green row is a green row that
// cannot fail.
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const SELF = fileURLToPath(import.meta.url)

/* Each case: a stroke, a spacing, and a one-line statement of the channel it
 * arrives through. All of them are reachable from user input.
 *
 * `expectPoints` is the count MEASURED on the pre-fix code, never a target —
 * the guards must not move a well-formed result by one point. */
export const CASES = {
  infX: {
    why: "a non-finite x — Infinity survives a hand-edited/persisted doc",
    pts: [{ x: 0, y: 0, t: 0 }, { x: Infinity, y: 0, t: 10 }, { x: 20, y: 0, t: 20 }],
    spacing: 4,
    malformed: true,
  },
  overflow: {
    why: "two FINITE coords whose separation squared overflows a double (1e200)",
    pts: [{ x: 0, y: 0, t: 0 }, { x: 1e200, y: 0, t: 10 }],
    spacing: 4,
    malformed: true,
  },
  nanY: {
    why: "a NaN y — the pointer stream can emit one on a lost capture",
    pts: [{ x: 0, y: 0, t: 0 }, { x: 10, y: NaN, t: 10 }, { x: 20, y: 0, t: 20 }],
    spacing: 4,
    malformed: true,
    // NaN never hung (the `<=` comparison is false), so the PRIOR arm returns
    // cleanly too. Recorded honestly rather than claimed as a save.
    priorSurvives: true,
  },
  zeroSpacing: {
    why: "spacing 0 — the slider's own floor is not enforced in the function",
    pts: [{ x: 0, y: 0, t: 0 }, { x: 40, y: 0, t: 10 }],
    spacing: 0,
    malformed: true,
  },
  negSpacing: {
    why: "spacing < 0 — a persisted doc can carry one",
    pts: [{ x: 0, y: 0, t: 0 }, { x: 40, y: 0, t: 10 }],
    spacing: -4,
    malformed: true,
  },
  nanSpacing: {
    why: "spacing NaN",
    pts: [{ x: 0, y: 0, t: 0 }, { x: 40, y: 0, t: 10 }],
    spacing: NaN,
    malformed: true,
    priorSurvives: true,
  },
  tinySpacing: {
    why: "spacing 1e-9 — LEGAL but unhonourable; degrades to the budget, never dies",
    pts: [{ x: 0, y: 0, t: 0 }, { x: 1000, y: 0, t: 10 }],
    spacing: 1e-9,
    malformed: true,
    // The budget is MAX_RESAMPLE_POINTS = 200_000 samples; +1 seed, +float slack.
    maxPoints: 200_010,
  },
  /* THE CONTROLS. Ordinary strokes, same code path. If either ever reports HANG
   * the harness itself is broken, and if a guard ever moves their point count
   * the fix has changed real behaviour. */
  control: {
    why: "CONTROL — an ordinary 40px stroke at spacing 4",
    pts: [{ x: 0, y: 0, t: 0 }, { x: 40, y: 0, t: 10 }],
    spacing: 4,
    expectPoints: 12,
  },
  control2: {
    why: "CONTROL — 3 segments incl. a 0-length one (the OLD guard's only case)",
    pts: [
      { x: 0, y: 0, t: 0 },
      { x: 20, y: 0, t: 10 },
      { x: 20, y: 0, t: 20 },
      { x: 20, y: 30, t: 30 },
    ],
    spacing: 5,
    expectPoints: 13,
  },
  control3: {
    why: "CONTROL — carry across many short segments, spacing 7 (slider max is 8)",
    pts: Array.from({ length: 40 }, (_, i) => ({ x: i * 2.3, y: Math.sin(i / 4) * 9, t: i * 10 })),
    spacing: 7,
    expectPoints: 18,
  },
}

/* ---------------- child mode ---------------- */
if (process.argv[2] === "--case") {
  const name = process.argv[3]
  const arm = process.argv[4] // "on" | "off"
  const c = CASES[name]
  const { loadTs } = await import("./_ts-load.mjs")
  const mod = loadTs("lib/stroke-processing.ts")
  mod.RESAMPLE_TUNING.guards = arm
  const t0 = Date.now()
  const r = mod.processStroke({ points: c.pts.map((p) => ({ ...p })) }, c.spacing, false, false)
  const nonFinite = r.points.filter((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)).length
  console.log(JSON.stringify({ n: r.points.length, nonFinite, ms: Date.now() - t0 }))
  process.exit(0)
}

/* ---------------- parent mode ---------------- */
const TIMEOUT_MS = 8000
const HEAP_MB = 512

export function runCase(name, arm) {
  const r = spawnSync(
    process.execPath,
    [`--max-old-space-size=${HEAP_MB}`, SELF, "--case", name, arm],
    { timeout: TIMEOUT_MS, encoding: "utf8" },
  )
  const timedOut = r.signal === "SIGTERM" || r.error?.code === "ETIMEDOUT"
  const oom = /heap out of memory|Allocation failed|JavaScript heap/i.test(String(r.stderr))
  if (timedOut) return { verdict: "HANG", detail: `no return in ${TIMEOUT_MS} ms` }
  if (oom) return { verdict: "OOM", detail: `heap exhausted at ${HEAP_MB} MB` }
  if (r.status !== 0)
    return {
      verdict: "THREW",
      detail: String(r.stderr).trim().split("\n").slice(-1)[0].slice(0, 110),
    }
  const out = JSON.parse(r.stdout.trim().split("\n").pop())
  return {
    verdict: out.nonFinite > 0 ? "NON-FINITE" : "CLEAN",
    detail: `${out.n} points, ${out.nonFinite} non-finite, ${out.ms} ms`,
    n: out.n,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let fails = 0
  console.log("=== resampleStroke under malformed input — BOTH ARMS ===")
  console.log(`    each case: its own node, --max-old-space-size=${HEAP_MB}, ${TIMEOUT_MS} ms wall clock`)
  console.log(`    guards=on  is what ships.  guards=off restores the pre-fix walk verbatim.\n`)
  console.log(
    `${"case".padEnd(13)}${"SHIPPED".padEnd(12)}${"PRIOR (control)".padEnd(17)}detail`,
  )
  /* THE KNOWN-BAD FOR `assert-stroke-guards.mjs`'s COUNT ROW.
   *
   * That gate used to read `rows.length >= 9` against a probe emitting 10, so a
   * case deleted from `CASES` above would have left it green. The count is now
   * exact and derived from `CASES`, and this env var is what proves it: it makes
   * the probe silently omit one case, exactly as a deletion would, without
   * editing this file. `FS_PROBE_DROP=nanY node scripts/verify/assert-stroke-guards.mjs`
   * must go red on the count row. */
  const DROP = process.env.FS_PROBE_DROP || ""
  if (DROP) console.log(`[FS_PROBE_DROP=${DROP}] one case is being omitted — the gate's count row MUST go red\n`)
  for (const [name, c] of Object.entries(CASES)) {
    if (name === DROP) continue
    const on = runCase(name, "on")
    const off = runCase(name, "off")
    let ok = on.verdict === "CLEAN"
    let note = on.detail
    if (c.expectPoints !== undefined && on.n !== c.expectPoints) {
      ok = false
      note += ` — EXPECTED ${c.expectPoints}`
    }
    if (c.maxPoints !== undefined && !(on.n <= c.maxPoints)) {
      ok = false
      note += ` — OVER BUDGET ${c.maxPoints}`
    }
    // The negative control: a malformed case that the PRIOR arm survives proves
    // nothing about the guard, and is declared as such rather than counted.
    if (c.malformed && !c.priorSurvives && off.verdict === "CLEAN") {
      ok = false
      note += " — PRIOR ARM DID NOT FAIL: this guard has no negative control"
    }
    if (!c.malformed && off.verdict !== "CLEAN") {
      ok = false
      note += " — PRIOR ARM BROKE ON A CONTROL: the harness is wrong"
    }
    /* THE INVARIANT THAT MATTERS MOST. On a well-formed stroke the guarded and
     * the ungated walks must emit the SAME points. Anything else means the fix
     * changed real geometry, which is the one thing it must not do. */
    if (!c.malformed && on.n !== off.n) {
      ok = false
      note += ` — GUARDS MOVED A WELL-FORMED RESULT: ${on.n} vs prior ${off.n}`
    }
    if (!ok) fails++
    console.log(
      `${ok ? "PASS" : "FAIL"} ${name.padEnd(13)}${on.verdict.padEnd(12)}${off.verdict.padEnd(17)}${note}`,
    )
    console.log(`${" ".repeat(5)}${" ".repeat(13)}${c.why}`)
  }
  console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAIL`}`)
  process.exit(fails === 0 ? 0 : 1)
}

// RUN A VERIFICATION SCRIPT AND PROVE NO SIBLING LANE MOVED THE TREE UNDER IT.
//
// WHY. Every harness here drives ONE shared Next dev server on :3000, and other
// lanes are editing `components/viewport-3d.tsx` and `lib/hero-motion.ts` at the
// same time. A save on either triggers fast-refresh, which REMOUNTS the 3-D
// scene mid-capture. Measured first-hand, 2026-07-31: a `geometry-baseline
// --save` run reported "GEOMETRY DIED" on six of thirty-two cases —
// `nearTouch/{extrude,solid,inflate}` and `zigzag/{extrude,solid,inflate}` at
// verts 0 — while `exportBytes` was byte-identical to the previous baseline on
// five of the six. Geometry that has died does not export the same bytes; the
// scene had been remounted between the build and the read. `viewport-3d.tsx`
// was written at 11:52:14 and `hero-motion.ts` at 11:53:05, inside that run's
// window.
//
// A measurement taken across a remount is DISCARDED, never adjusted. So this
// stamps the mtimes of every file a sibling lane owns before and after, and
// fails the run if any of them moved. It is the same rule the dispatch contract
// states for a stale worktree, applied to a shared dev server instead.
//
// Usage: node scripts/verify/_run-clean.mjs <script.mjs> [args...]
import { statSync, existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve as resolvePath, relative } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")

// Files this lane does NOT own, whose edits reload the server it is measuring.
//
// ⚠ THE LIST WAS INCOMPLETE, AND IT COST A WHOLE REGRESSION BATTERY
// (2026-08-01). Seven browser asserts came back red at once with the mark
// measuring `ink 0` on every frame and `no page errors — 0`. The cause was a
// sibling lane mid-edit in **`lib/texture-shader.ts`**, three minutes earlier:
// `uFsTexDarkBoost` had been added to the uniforms object and to the GLSL body
// but its `uniform float` declaration had not landed yet, so
// `THREE.WebGLProgram: Shader Error … 'uFsTexDarkBoost' : undeclared
// identifier` killed the material and the word rendered NOTHING. That file was
// not on this list, so the run was reported as clean and every one of those
// seven results would have been recorded as a regression in this lane's work.
//
// A missing entry here does not produce a wrong-looking answer, it produces a
// CONFIDENTLY WRONG one — which is the failure mode this whole file exists to
// stop. So the list now covers every module the hero surface renders through,
// not just the ones a lane happens to be editing. Adding an entry can only
// cause MORE re-runs; it can never mask a contaminated one.
//
// ⚠ AND IT WAS STILL INCOMPLETE AFTER THAT FIX (2026-08-01, second pass). The
// list named seventeen files; the app's real import closure is THIRTY. Thirteen
// modules the scene renders through were unwatched, including
// `components/style-panel-scaffold.tsx` (the whole control surface — every
// panel row that writes style state), `lib/style-stack.ts`, `lib/style-clock.ts`,
// `lib/style-shader.ts`, `lib/style-fusion.ts`, `lib/ascii-shader.ts`,
// `lib/dither-shader.ts` and both halves of the ported Desk Doodles engine.
// Each is exactly the same hazard as `lib/texture-shader.ts` was: a half-saved
// edit to any of them kills the material or the build, and this file would have
// reported the run CLEAN.
//
// SO THE LIST NO LONGER ROTS. `WATCH` is now the union of the hand list below
// (the floor — files that matter even if nothing imports them) and the import
// closure of the two entry pages, WALKED AT RUN TIME. A new module added to the
// scene is watched the moment it is imported, with nobody remembering to come
// back here. The walk is ~30 regex passes over files already in the page cache;
// it costs nothing against a run that drives a browser for minutes.
const WATCH_FLOOR = [
  "components/viewport-3d.tsx",
  "components/viewport-3d-wrapper.tsx",
  "lib/hero-motion.ts",
  "app/page.tsx",
  "app/desk-doodles/page.tsx",
  "lib/geometry-engines.ts",
  "lib/implicit-surface.ts",
  "lib/solid-mask.ts",
  // Added 2026-08-01 — every one of these is compiled into the hero's material
  // or its geometry, and an edit to any of them reloads the scene mid-capture.
  "lib/texture-shader.ts",
  "lib/flat-ink.ts",
  "lib/registers.ts",
  "lib/style-system.ts",
  "lib/stroke-processing.ts",
  "lib/pen-reveal.ts",
  "lib/pen-kinematics.ts",
  "lib/engine-registry.ts",
  "lib/hand-feel.ts",
  // Named explicitly by the 2026-08-01 second pass so the entry survives even
  // if the closure walk is ever unable to resolve it.
  "components/style-panel-scaffold.tsx",
]

/** The two pages every harness here drives. */
const ENTRIES = ["app/page.tsx", "app/desk-doodles/page.tsx"]

/**
 * Import closure of the entry pages, resolved the way the tsconfig does
 * (`@/` -> repo root, relative paths, `.ts`/`.tsx`/`/index`). Only local files
 * are followed — a package edit is not a fast-refresh hazard.
 *
 * `components/ui/*` is excluded deliberately: shadcn primitives are vendored
 * and never edited by a lane, and including forty of them would make the
 * contamination report unreadable.
 */
function importClosure() {
  const seen = new Set()
  const resolveSpec = (spec, fromFile) => {
    let p
    if (spec.startsWith("@/")) p = join(ROOT, spec.slice(2))
    else if (spec.startsWith(".")) p = resolvePath(dirname(fromFile), spec)
    else return null
    for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
      const c = p + ext
      try {
        if (existsSync(c) && statSync(c).isFile()) return c
      } catch {
        /* unreadable path is simply not a dependency we can follow */
      }
    }
    return null
  }
  const walk = (f) => {
    if (seen.has(f)) return
    seen.add(f)
    let src
    try {
      src = readFileSync(f, "utf8")
    } catch {
      return
    }
    const re = /(?:from\s+|import\s+)["']([^"']+)["']/g
    let m
    while ((m = re.exec(src))) {
      const r = resolveSpec(m[1], f)
      if (r) walk(r)
    }
  }
  for (const e of ENTRIES) {
    const p = join(ROOT, e)
    if (existsSync(p)) walk(p)
  }
  return [...seen]
    .map((f) => relative(ROOT, f))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith("components/ui/"))
}

const WATCH = [...new Set([...WATCH_FLOOR, ...importClosure()])].sort()

const stamp = () => {
  const out = {}
  for (const f of WATCH) {
    try {
      out[f] = statSync(join(ROOT, f)).mtimeMs
    } catch {
      out[f] = null
    }
  }
  return out
}

const [, , script, ...rest] = process.argv

/* `--watch-paths` prints one repo-relative path per line and NOTHING else.
 *
 * IT IS AN API, NOT A CONVENIENCE. `_run-when-quiet.sh` used to recover this
 * list by regex-scraping the `const WATCH = [ … ]` array literal out of this
 * file's source, which meant the two files were coupled through this file's
 * FORMATTING. Turning WATCH into a computed expression silently broke that
 * scrape: the match returned null, the shell's `$W` came back empty, and the
 * "wait for a quiet window" loop degenerated into "there is nothing to wait
 * for, run immediately" — a guard that had stopped guarding, with no error.
 * Exactly the class this file exists to prevent, introduced INTO this file.
 * So the list is now published deliberately and consumed deliberately. */
if (script === "--watch-paths") {
  for (const f of WATCH) console.log(f)
  process.exit(0)
}

/* `--watchlist` prints the resolved set and exits. A watch list you cannot read
 * is a watch list you cannot check, and the two times this file was found
 * incomplete it was found by a red battery, not by anyone looking. */
if (script === "--watchlist") {
  console.log(`[run-clean] ${WATCH.length} files watched (floor ${WATCH_FLOOR.length} ∪ import closure)`)
  for (const f of WATCH) {
    const inFloor = WATCH_FLOOR.includes(f)
    const exists = existsSync(join(ROOT, f))
    console.log(`  ${exists ? " " : "!"} ${f}${inFloor ? "" : "   (via import closure)"}`)
  }
  const missing = WATCH.filter((f) => !existsSync(join(ROOT, f)))
  if (missing.length) console.log(`[run-clean] ⚠️  ${missing.length} listed file(s) do not exist: ${missing.join(", ")}`)
  process.exit(0)
}

if (!script) {
  console.error("usage: node scripts/verify/_run-clean.mjs <script.mjs> [args...]")
  console.error("       node scripts/verify/_run-clean.mjs --watchlist")
  process.exit(2)
}

const before = stamp()
const t0 = Date.now()
const res = spawnSync("node", [script, ...rest], { stdio: "inherit", cwd: ROOT })
const after = stamp()
const moved = WATCH.filter((f) => before[f] !== after[f])

console.log(`\n[run-clean] ${script} ${rest.join(" ")} — ${((Date.now() - t0) / 1000).toFixed(0)}s, exit ${res.status}`)
if (moved.length) {
  console.log(`[run-clean] ⚠️  CONTAMINATED: these files changed DURING the run, so the dev server`)
  console.log(`[run-clean]    fast-refreshed under it. DISCARD this run and repeat it:`)
  for (const f of moved) console.log(`[run-clean]      ${f}`)
  process.exit(3)
}
console.log(`[run-clean] clean — no watched file moved during the run`)
process.exit(res.status ?? 0)

// WRITE THIS LANE'S DIFF AGAINST THE SHARED CHECKOUT.
//
// The worktree's own git branch is 40-odd commits behind the state everyone is
// actually working on — nothing in this repo is committed (see
// `HANDOFF-2026-08-02.md` §0) — so `git diff` describes nothing useful. The real
// baseline is the shared checkout's WORKING TREE, and this writes a unified diff
// from that to this worktree so the lane can be integrated by hand.
import { execFileSync } from "node:child_process"
import { writeFileSync, existsSync } from "node:fs"
import { join, dirname, resolve, basename, relative } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."))

/* ── THE ONE SITE IN THIS CLASS THAT MUST NOT BE "DERIVED FROM HERE" ─────────
 *
 * Every other absolute-path site in scripts/verify was an output (or an input)
 * that should always have pointed at the CALLER's tree, and the fix is to derive
 * it from the script's own location. This one is the opposite by construction:
 * the baseline is ANOTHER tree. Deriving it from HERE would make the tool diff a
 * tree against itself and write a patch with `+0/-0` — silently, exit 0. That is
 * a green row that cannot fail, which is the exact class this repo keeps paying
 * for, so the "fix" would have been a worse defect than the hardcode.
 *
 * So the literal goes, and what replaces it is a resolution ORDER plus refusals:
 *
 *   1. `FS_SHARED_CHECKOUT` — the operator says so explicitly.
 *   2. the nearest ANCESTOR that is itself a checkout (handles a lane nested
 *      inside the shared tree, e.g. <shared>/<lanes-dir>/<lane>).
 *   3. a sibling directory with this repo's own name (handles a lane made by
 *      copying the checkout beside itself, which is how it is done here).
 *
 * …and then it REFUSES rather than producing a patch about nothing: if the
 * baseline resolves to this same tree, if it does not exist, if it is not a
 * checkout, or if the finished diff is empty with no new files. Every refusal
 * exits non-zero and names the variable to set. DISPATCH §2.6 — an instrument
 * that cannot fail is the lie; §2.10 — flag rather than ship a shortcut. */
const isCheckout = (p) => existsSync(join(p, "package.json")) && existsSync(join(p, "scripts", "verify"))
function findShared() {
  if (process.env.FS_SHARED_CHECKOUT) return { path: resolve(process.env.FS_SHARED_CHECKOUT), how: "FS_SHARED_CHECKOUT" }
  for (let d = dirname(HERE); d !== dirname(d); d = dirname(d)) {
    if (isCheckout(d)) return { path: d, how: "nearest ancestor checkout" }
  }
  const sibling = resolve(join(HERE, "..", basename(HERE).replace(/[ _-]\d+$/, "")))
  if (sibling !== HERE && isCheckout(sibling)) return { path: sibling, how: "sibling checkout of the same name" }
  return { path: null, how: "not found" }
}
const found = findShared()
const SHARED = found.path
const refuse = (why) => {
  console.error(`REFUSED — ${why}`)
  console.error(`  this tree: ${HERE}`)
  console.error(`  baseline : ${SHARED ?? "(none)"}  [${found.how}]`)
  console.error(`  set FS_SHARED_CHECKOUT=<path to the shared checkout> and re-run.`)
  process.exit(1)
}
if (!SHARED) refuse("no baseline checkout found")
if (SHARED === HERE) refuse("the baseline resolved to THIS tree — a diff against itself is empty, not clean")
if (!isCheckout(SHARED)) refuse(`the baseline is not a checkout (no package.json + scripts/verify): ${SHARED}`)

const CHANGED = [
  "lib/hero-motion.ts",
  "components/viewport-3d.tsx",
  "components/viewport-3d-wrapper.tsx",
  "app/desk-doodles/page.tsx",
  "scripts/verify/assert-hero-options.mjs",
  "scripts/verify/assert-hero-option-panel.mjs",
  "scripts/verify/film-hero-beat.mjs",
  "scripts/verify/assert-drawin-parity.mjs",
  "scripts/verify/assert-hero-flatstate.mjs",
  "scripts/verify/verify-gates.mjs",
  "scripts/verify/verify-hero-transition.mjs",
]
const ADDED = [
  "lib/hero-letters.ts",
  "scripts/verify/_probe-letter-map.mjs",
  "scripts/verify/_probe-letter-zoom.mjs",
  "scripts/verify/_probe-letter-graze.mjs",
  "scripts/verify/_probe-letter-shred.mjs",
  "scripts/verify/_probe-lane-patch.mjs",
]

let out = ""
let plus = 0
let minus = 0
for (const f of CHANGED) {
  const a = join(SHARED, f)
  const b = join(HERE, f)
  if (!existsSync(a)) {
    out += `# NEW (not in the shared checkout): ${f}\n`
    continue
  }
  let d = ""
  try {
    d = execFileSync("diff", ["-u", a, b], { encoding: "utf8", maxBuffer: 1 << 28 })
  } catch (e) {
    d = e.stdout ?? ""
  }
  if (!d.trim()) continue
  out += d
  for (const line of d.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) plus++
    if (line.startsWith("-") && !line.startsWith("---")) minus++
  }
}
out =
  `# O5 · LETTER BY LETTER — this lane against the shared checkout's working tree\n` +
  `# baseline: ${SHARED}\n# lane:     ${HERE}\n#\n` +
  `# NEW FILES (copy them across; they have no counterpart to diff against):\n` +
  ADDED.map((f) => `#   ${f}`).join("\n") +
  `\n#\n# MODIFIED: ${CHANGED.length} files, +${plus} / -${minus} lines\n#\n` +
  out

// AN EMPTY PATCH IS NOT A CLEAN LANE — it is the shape a tree-against-itself
// diff produces, and it used to be written and reported as a success.
//
// ⚠ THE FIRST VERSION OF THIS GUARD COULD NOT FIRE, and its own control caught
// it: `_probe-lane-patch.mjs` is itself in ADDED, and it is on disk in every
// tree it runs in — because it is the file being run. So `newOnDisk` was never
// empty and the guard was decoration. The script's own presence is evidence
// about the TOOL, never about the lane's work, so it is excluded from the count.
const SELF = relative(HERE, fileURLToPath(import.meta.url))
const newOnDisk = ADDED.filter((f) => f !== SELF && existsSync(join(HERE, f)))
if (plus === 0 && minus === 0 && newOnDisk.length === 0) {
  refuse(`nothing to integrate: 0 changed lines across ${CHANGED.length} files and 0 of ${ADDED.length} new files present`)
}

writeFileSync(join(HERE, "O5-LANE.patch"), out)
console.log(`wrote O5-LANE.patch — ${CHANGED.length} modified (+${plus}/-${minus}), ${newOnDisk.length}/${ADDED.length} new files present`)
console.log(`  baseline: ${SHARED}  [${found.how}]`)

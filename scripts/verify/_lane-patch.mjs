// THIS LANE'S DIFF AGAINST THE SHARED CHECKOUT — only the files this lane owns.
//
// A whole-tree diff is not the integrable artefact here: the shared checkout is
// live and moved twice while this lane ran, so a `diff -r` reports other lanes'
// files as if this lane had reverted them. The list below is declared, and
// anything outside it is somebody else's — which is `docs/DISPATCH.md` §4's
// file-ownership rule expressed as an artefact instead of a promise.
//
// Usage: node scripts/verify/_lane-patch.mjs [--src=/path/to/shared] [--out=…]
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const SRC = arg("src", join(ROOT, "..", "..", ".."))
const OUT = arg("out", join(ROOT, "docs", "verification", "switch-tone", "lane-lit.patch"))

/** EDITED — existed before, changed here. */
const EDITED = [
  "app/desk-doodles/page.tsx",
  "components/viewport-3d.tsx",
  "scripts/verify/assert-hero-flatstate.mjs",
  "scripts/verify/assert-flat-silhouette.mjs",
  "scripts/verify/verify-gates.mjs",
  "scripts/verify/verify-hero-transition.mjs",
]
/** ADDED — new in this lane. */
const ADDED = [
  "scripts/verify/assert-hero-switch.mjs",
  "scripts/verify/_probe-switch-tone.mjs",
  "scripts/verify/_probe-lit-sweep.mjs",
  "scripts/verify/_probe-lit-hue.mjs",
  "scripts/verify/_probe-stroke-profile.mjs",
  "scripts/verify/_probe-beat-arc.mjs",
  "scripts/verify/_crop-switch.mjs",
  "scripts/verify/_film-switch-ab.mjs",
  "scripts/verify/_lane-patch.mjs",
  "scripts/verify/_lane-gates.sh",
]

let out = ""
const stat = []
for (const f of [...EDITED, ...ADDED]) {
  const a = join(SRC, f)
  const b = join(ROOT, f)
  if (!existsSync(b)) {
    stat.push([f, "MISSING IN WORKTREE"])
    continue
  }
  const isNew = !existsSync(a)
  try {
    execFileSync("diff", ["-u", isNew ? "/dev/null" : a, b], { encoding: "utf8" })
    stat.push([f, "identical"])
  } catch (e) {
    // `diff` exits 1 when files differ — that is the normal path, not an error.
    const d = String(e.stdout ?? "")
    out += d.replace(new RegExp(escape(b), "g"), f).replace(new RegExp(escape(a), "g"), f)
    const plus = (d.match(/^\+(?!\+\+)/gm) ?? []).length
    const minus = (d.match(/^-(?!--)/gm) ?? []).length
    stat.push([f, `${isNew ? "NEW" : "edited"}  +${plus} -${minus}`])
  }
}
function escape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }

writeFileSync(OUT, out)
console.log(`shared checkout: ${SRC}`)
console.log(`patch:           ${OUT}  (${out.split("\n").length} lines)\n`)
for (const [f, s] of stat) console.log("  " + f.padEnd(46) + s)
console.log(
  "\nEverything else that differs between the two trees belongs to another lane and is NOT in this patch.",
)

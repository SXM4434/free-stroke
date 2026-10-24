/**
 * WHICH LANE COMMITS NEVER REACHED THE BRANCH.
 *
 * WHY IT EXISTS. On 2026-09-04 lane D3 finished, filed its rows and stopped. Seven of its eight
 * commits had merged. The eighth, `b54dcef0`, had not, and it was the one that mattered: it fixed
 * `assert-export-window`'s reorder row, which compared two films differing in BOTH order and
 * overlap and so passed with no reorder in the film at all. Nothing noticed for two weeks. It was
 * found on 2026-09-18 only because a disk-space audit happened to hash every lane, and landed as
 * `5afc0dc9`. A lane can do its best work and leave it behind, and the leaving is silent.
 *
 * WHAT IT CHECKS. For every git checkout under the lanes directory, it fetches the lane's HEAD into
 * this repo's object store (objects only, no ref is written) and asks `git cherry` which of the
 * lane's commits have NO PATCH-EQUIVALENT on the branch. Patch-equivalence, not SHA reachability,
 * because lanes get cherry-picked: seven of D3's eight commits reached the branch under different
 * SHAs, and a SHA test would have reported all eight as missing.
 *
 * ⚠ IT SAYS WHAT IT DID NOT WALK. A missing lanes directory, or one with no git checkouts in it, is
 * printed as exactly that. "0 unlanded" is only ever printed next to how many lanes were read,
 * because a check that walked nothing and printed zero is the failure it exists to catch.
 *
 * Usage:
 *   node scripts/gen/unlanded-lanes.mjs                      # against the current branch
 *   node scripts/gen/unlanded-lanes.mjs --against=<ref>      # against any ref
 *   node scripts/gen/unlanded-lanes.mjs --lanes=<dir>        # default ~/.fs-lanes
 * Exits 1 when any lane holds an unlanded commit, 2 when there was nothing it could read.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, statSync, readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : d
}
const git = (args, cwd = REPO) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()

const LANES = arg("lanes", join(homedir(), ".fs-lanes"))
const AGAINST = arg("against", git(["rev-parse", "--abbrev-ref", "HEAD"]))
const againstSha = git(["rev-parse", "--verify", `${AGAINST}^{commit}`])

if (!existsSync(LANES)) {
  console.log(`NO LANES DIRECTORY at ${LANES}. Walked 0 lanes. This is not a clean result, it is no result.`)
  process.exit(2)
}

const dirs = readdirSync(LANES).filter((d) => {
  try { return statSync(join(LANES, d)).isDirectory() } catch { return false }
})
const checkouts = dirs.filter((d) => existsSync(join(LANES, d, ".git")))

/* LANDED BY HAND. A lane commit merged by resolving conflicts has no patch-equivalent, so cherry
 * keeps calling it unlanded forever. The ledger records each such landing, and every entry is
 * checked: its `as` commit must be an ancestor of the branch being checked. A stale or invented
 * entry therefore fails instead of hiding a commit. */
const LEDGER_PATH = join(REPO, "scripts", "gen", "landed-by-hand.json")
const ledger = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, "utf8")) : {}
const byHand = (sha) => {
  const e = Object.entries(ledger).find(([k]) => k !== "_" && (k.startsWith(sha) || sha.startsWith(k)))
  if (!e) return null
  const [, v] = e
  try {
    const as = git(["rev-parse", "--verify", `${v.as}^{commit}`])
    git(["merge-base", "--is-ancestor", as, againstSha])
    return { ok: true, ...v }
  } catch {
    return { ok: false, ...v }
  }
}

let unlandedTotal = 0
const rows = []
for (const d of checkouts) {
  const path = join(LANES, d)
  let head
  try {
    head = git(["rev-parse", "HEAD"], path)
  } catch (e) {
    rows.push({ d, note: `UNREADABLE: ${String(e.message).split("\n")[0]}` })
    continue
  }
  // Objects only: FETCH_HEAD is overwritten on the next fetch, and no ref is left behind.
  git(["fetch", "--quiet", "--no-tags", path, "HEAD"])
  const cherry = git(["cherry", againstSha, head])
  const lines = cherry ? cherry.split("\n") : []
  const plus = lines.filter((l) => l.startsWith("+")).map((l) => l.slice(2))
  const hand = []
  const bad = []
  const unlanded = []
  for (const sha of plus) {
    const h = byHand(sha)
    if (h && h.ok) hand.push({ sha, ...h })
    else if (h && !h.ok) bad.push({ sha, ...h })
    else unlanded.push(sha)
  }
  const landed = lines.length - plus.length
  unlandedTotal += unlanded.length + bad.length
  rows.push({ d, head: head.slice(0, 8), ahead: lines.length, landed, unlanded, hand, bad })
}

console.log(`lanes directory ${LANES}`)
console.log(`against ${AGAINST} (${againstSha.slice(0, 8)})`)
console.log(`walked ${dirs.length} lane(s), ${checkouts.length} of them git checkouts, ${dirs.length - checkouts.length} plain copies (a plain copy has no commits to lose; check its files instead)`)
for (const r of rows) {
  if (r.note) { console.log(`  ${r.d.padEnd(16)} ${r.note}`); continue }
  const tag = r.unlanded.length || r.bad.length ? "🔴 UNLANDED" : "ok"
  console.log(`  ${r.d.padEnd(16)} HEAD ${r.head}  ${r.ahead} not on the branch by SHA: ${r.landed} there by patch, ${r.hand.length} landed by hand, ${r.unlanded.length + r.bad.length} not  ${tag}`)
  for (const sha of r.unlanded) console.log(`      ${git(["log", "-1", "--format=%h %cI %s", sha]).slice(0, 120)}`)
  for (const b of r.hand) console.log(`      by hand: ${b.sha.slice(0, 8)} landed as ${b.as} (${b.why})`.slice(0, 160))
  for (const b of r.bad) console.log(`      🔴 LEDGER CLAIMS ${b.sha.slice(0, 8)} landed as ${b.as}, but ${b.as} is not on ${AGAINST}`)
}
if (!checkouts.length) {
  console.log(`\nNO GIT CHECKOUTS among ${dirs.length} lane(s), so there were no commits to check.`)
  process.exit(2)
}
console.log(`\n${unlandedTotal} unlanded commit(s) across ${checkouts.length} checkout(s).`)
process.exit(unlandedTotal ? 1 : 0)

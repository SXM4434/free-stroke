// _PROBE-PENTIP-SPECKS-NOISE: how far does one arm's AA band move between two
// captures of the same tree?
//
// Written for F116. `assert-pentip-specks` went red on one row after the
// 2026-09-22 recapture: "the PRIOR divisor leaves LESS antialiasing", which is
// `lo.medGrey < hi.medGrey` with no margin, and read t160-aaprior 11401 against
// t160 11398. A strict comparison is only meaningful if the gap it sees is wider
// than the spread of the same number on a repeat capture, so this measures that
// spread instead of assuming it.
//
// What it does, N times, one run at a time:
//   1. `_probe-pentip-shape.mjs --dsf=1 --only=<arms>` into a scratch folder
//      outside the repo (the probe's label is joined to docs/verification/pentip,
//      so a relative label walks out of it). Nothing under docs/verification/pentip
//      is touched.
//   2. `assert-pentip-specks.mjs --dir=<that folder>`, which writes specks.json
//      there. Its exit code is recorded, not trusted as the answer.
//   3. Reads medGrey and medW per arm, and hashes every frame so the summary says
//      whether two runs rendered the same pixels or only the same median.
//
// The arms are the three the gate refuses to run without (free-stroke, chisel,
// t160) plus both AA pairs. medGrey is a per-arm median over that arm's own
// frames, so dropping the other four arms cannot move it.
//
// Usage: FS_PORT=3105 FS_HEADED=1 node scripts/verify/_probe-pentip-specks-noise.mjs --runs=3 --scratch=<abs dir>
//        [--summary=docs/verification/pentip-specks-noise/summary.json]
import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { dirname, join, relative, isAbsolute } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const RUNS = parseInt(arg("runs", "3"), 10)
const SCRATCH = arg("scratch", null)
const START = parseInt(arg("start", "1"), 10)
const SUMMARY = join(ROOT, arg("summary", "docs/verification/pentip-specks-noise/summary.json"))
const ARMS = ["free-stroke", "chisel", "t160", "t160-aaprior", "t275", "t275-aaprior"]
const PAIRS = [
  ["t160-aaprior", "t160"],
  ["t275-aaprior", "t275"],
]

if (!SCRATCH || !isAbsolute(SCRATCH)) {
  console.error("--scratch=<absolute dir> is required, and it must sit outside docs/verification/pentip")
  process.exit(2)
}
if (!process.env.FS_PORT) {
  console.error("FS_PORT is unset, so the probe would read :3000. Set FS_PORT to the dev server you mean.")
  process.exit(2)
}

const hashDir = (d) => {
  const out = {}
  for (const f of readdirSync(d).filter((f) => f.endsWith(".png")).sort())
    out[f] = createHash("sha1").update(readFileSync(join(d, f))).digest("hex")
  return out
}

const prior = existsSync(SUMMARY) ? JSON.parse(readFileSync(SUMMARY, "utf8")) : { runs: [] }
const runs = prior.runs ?? []

for (let r = START; r < START + RUNS; r++) {
  const dir = join(SCRATCH, `r${r}`)
  const label = relative(join(ROOT, "docs", "verification", "pentip"), dir)
  const t0 = Date.now()
  console.log(`\n== run ${r}: capture into ${dir}`)
  const cap = spawnSync(
    process.execPath,
    [join(__dirname, "_probe-pentip-shape.mjs"), `--label=${label}`, "--dsf=1", `--only=${ARMS.join(",")}`],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", env: process.env, maxBuffer: 64 << 20 },
  )
  writeFileSync(join(SCRATCH, `r${r}-capture.log`), (cap.stdout ?? "") + (cap.stderr ?? ""))
  if (cap.status !== 0 || !existsSync(join(dir, "meta.json"))) {
    console.error(`capture ${r} exited ${cap.status}; see ${join(SCRATCH, `r${r}-capture.log`)}`)
    runs.push({ run: r, captureExit: cap.status, failed: true })
    continue
  }
  const capSec = (Date.now() - t0) / 1000
  const gate = spawnSync(process.execPath, [join(__dirname, "assert-pentip-specks.mjs"), `--dir=${dir}`], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 64 << 20,
  })
  const glog = (gate.stdout ?? "") + (gate.stderr ?? "")
  writeFileSync(join(SCRATCH, `r${r}-gate.log`), glog)
  const sp = JSON.parse(readFileSync(join(dir, "specks.json"), "utf8"))
  const arms = Object.fromEntries(
    ARMS.map((a) => [a, { medGrey: sp.arms[a]?.medGrey ?? null, medW: sp.arms[a]?.medW ?? null }]),
  )
  const hashes = Object.fromEntries(ARMS.map((a) => [a, hashDir(join(dir, a))]))
  writeFileSync(join(SCRATCH, `r${r}-hashes.json`), JSON.stringify(hashes))
  const rows = glog
    .split("\n")
    .filter((l) => /PRIOR divisor|NULL ·/.test(l))
    .map((l) => l.slice(0, 400))
  runs.push({
    run: r,
    at: new Date().toISOString(),
    captureSec: Math.round(capSec),
    gateExit: gate.status,
    failures: (glog.match(/^FAIL /gm) ?? []).length,
    arms,
    pairs: PAIRS.map(([lo, hi]) => ({ prior: lo, arm: hi, delta: arms[lo].medGrey - arms[hi].medGrey })),
    rows,
  })
  console.log(`run ${r}: ${JSON.stringify(runs.at(-1).pairs)}`)
  mkdirSync(dirname(SUMMARY), { recursive: true })
  writeFileSync(SUMMARY, JSON.stringify({ arms: ARMS, runs }, null, 2))
}

/* PIXEL IDENTITY ACROSS RUNS: a median that repeats could hide frames that do
 * not, so say how many frames of each arm match run START byte for byte. */
const done = runs.filter((r) => !r.failed)
const ident = {}
const base = join(SCRATCH, `r${done[0]?.run}-hashes.json`)
if (done.length > 1 && existsSync(base)) {
  const h0 = JSON.parse(readFileSync(base, "utf8"))
  for (const r of done.slice(1)) {
    const p = join(SCRATCH, `r${r.run}-hashes.json`)
    if (!existsSync(p)) continue
    const h = JSON.parse(readFileSync(p, "utf8"))
    ident[`r${r.run}-vs-r${done[0].run}`] = Object.fromEntries(
      ARMS.map((a) => {
        const ks = Object.keys(h0[a] ?? {})
        return [a, `${ks.filter((k) => h[a]?.[k] === h0[a][k]).length}/${ks.length}`]
      }),
    )
  }
}
writeFileSync(SUMMARY, JSON.stringify({ arms: ARMS, runs, identicalFrames: ident }, null, 2))
console.log(JSON.stringify(ident, null, 2))
console.log(`\nsummary: ${relative(ROOT, SUMMARY)}`)

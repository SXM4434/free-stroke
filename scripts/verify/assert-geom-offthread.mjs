// ASSERT: THE WORKER'S SURFACE IS THE SAME SURFACE, BYTE FOR BYTE.
//
// WHAT IS AT RISK. `lib/implicit-defer.ts` moved the implicit polygonisation to
// a Web Worker so touching a dial stops freezing the page. That is worth
// nothing — worse than nothing — if the surface it hands back is not the one
// the main thread would have built. This engine's output has been wrong before;
// `verify-gates`, the fold census, the seam and elbow asserts and
// `geometry-baseline` all exist because of it. A faster build that changes
// geometry is a regression, not an optimisation.
//
// WHY THE OTHER GATES CANNOT ANSWER THIS.
//   - `geometry-baseline` records vertex counts, triangle counts, a bounding box
//     and `exportBytes`. `exportBytes` comes from `buildExport`, which NEVER
//     defers — so on this change that column is a green row that CANNOT FAIL.
//     And counts plus a bbox would agree on a mesh in which every triangle had
//     moved.
//   - `assert-implicit-reveal` runs in node, where there is no Worker at all.
//   - The browser asserts drive fixtures that build in tens of milliseconds, so
//     they never leave the synchronous path (`IMPLICIT_DEFER.minCostMs`).
// None of them touches the worker. This does.
//
// THE MEASUREMENT. `IMPLICIT_DEFER.hash` turns on an FNV-1a over EVERY BYTE of
// the adopted build — positions, normals, indices and reveal keys, after the Z
// un-scale, i.e. the surface that actually renders. The hero word is then built
// down both paths and the two hashes compared:
//
//   A. law.mode = "sync"    -> wobble V   -> hash, lastHashSource must be "sync"
//   B. law.mode = "worker"  -> wobble V   -> hash, lastHashSource must be "worker"
//   A and B must be IDENTICAL.
//
// THE CONTROLS, because an equality test that cannot fail proves nothing:
//   1. DIFFERENT INPUT. The same comparison at a different wobble must produce a
//      DIFFERENT hash. If it does not, the hash is blind and arm A == arm B
//      means only that the channel is dead.
//   2. PATH PROVENANCE. Each arm asserts `lastHashSource`, so "the worker built
//      it" is read off the module rather than assumed from a mode flag. Without
//      this, a worker that silently fell back to the synchronous path would
//      compare itself against itself and pass forever — which is exactly how
//      this repo has produced eleven green rows that measured nothing.
//   3. NON-EMPTY. A build that produced no triangles would hash equal on both
//      arms. Vertex and triangle counts are asserted > 0 and asserted EQUAL.
//
// Usage:
//   node scripts/verify/_run-clean.mjs scripts/verify/assert-geom-offthread.mjs
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
/* STAGED. `docs/verification/geom-offthread/<label>`, and the label is an
 * argument, so the reach is the whole subtree: 1 tracked file.
 * lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "geom-offthread", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  EV.open()

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1600 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2000)
  await page.click(`[data-register-option="desk-doodles"]`)
  await page.waitForTimeout(400)
  await page.click(`[data-engine-option="free-stroke"]`)
  await page.waitForTimeout(5000)

  say(
    await page.evaluate(() => !!window.__implicitDefer),
    "window.__implicitDefer is published (without it this script measures nothing)",
  )

  const nudge = (v) =>
    page.evaluate((val) => {
      for (const inp of document.querySelectorAll('input[type="range"]')) {
        const row = inp.closest("div")?.parentElement
        if ((row?.textContent ?? "").toLowerCase().includes("wobble")) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
          setter.call(inp, String(val))
          inp.dispatchEvent(new Event("input", { bubbles: true }))
          inp.dispatchEvent(new Event("change", { bubbles: true }))
          return true
        }
      }
      return false
    }, v)

  /**
   * Build `wobble` down `mode`, and report the hash of what was adopted.
   *
   * The cache is turned OFF for the whole run. With it on, arm B could be
   * answered out of the cache arm A populated — the two arms would then be
   * comparing one build against itself, and the equality would be a tautology.
   */
  const buildAt = async (mode, wobble) => {
    await page.evaluate((m) => {
      window.__implicitDefer.law.hash = true
      window.__implicitDefer.law.cacheEntries = 0
      window.__implicitDefer.law.mode = m
      window.__implicitDefer.reset()
    }, mode)
    // A fresh slot has nothing on screen to hold, so its FIRST build is always
    // synchronous by design. Warm it at a throwaway value, then measure the
    // value we care about — otherwise the "worker" arm would silently be a
    // synchronous build and the comparison would pass while proving nothing.
    await nudge((wobble + 0.13).toFixed(3))
    await page.waitForTimeout(4000)
    await nudge(wobble.toFixed(3))
    await page.waitForTimeout(1000)
    await page.evaluate(() => window.__implicitDefer.idle(20000))
    await page.waitForTimeout(600)
    return page.evaluate(() => ({ ...window.__implicitDefer.debug }))
  }

  const V1 = 0.42
  const V2 = 0.71

  console.log("\n--- ARM A: mode 'sync' (the parked prior, on the main thread) ---")
  const a = await buildAt("sync", V1)
  console.log(`  hash ${a.lastHash}  source ${a.lastHashSource}  verts ${a.lastVertices}  tris ${a.lastTriangles}`)

  console.log("\n--- ARM B: mode 'worker' (shipped default, off the main thread) ---")
  const b = await buildAt("worker", V1)
  console.log(`  hash ${b.lastHash}  source ${b.lastHashSource}  verts ${b.lastVertices}  tris ${b.lastTriangles}`)

  console.log("\n--- CONTROL: a DIFFERENT input, off the main thread ---")
  const c = await buildAt("worker", V2)
  console.log(`  hash ${c.lastHash}  source ${c.lastHashSource}  verts ${c.lastVertices}  tris ${c.lastTriangles}`)

  console.log("")
  say(a.lastHashSource === "sync", "ARM A really ran on the main thread", `source=${a.lastHashSource}`)
  say(b.lastHashSource === "worker", "ARM B really ran in the worker", `source=${b.lastHashSource}`)
  say(c.lastHashSource === "worker", "the control arm really ran in the worker", `source=${c.lastHashSource}`)
  say(a.lastTriangles > 1000 && a.lastVertices > 1000, "the surface is non-empty (an empty mesh hashes equal on both arms)", `${a.lastVertices} verts / ${a.lastTriangles} tris`)
  say(!!a.lastHash && a.lastHash.length > 4, "the hash channel produced a value", a.lastHash)

  say(a.lastVertices === b.lastVertices, "same vertex count", `${a.lastVertices} vs ${b.lastVertices}`)
  say(a.lastTriangles === b.lastTriangles, "same triangle count", `${a.lastTriangles} vs ${b.lastTriangles}`)
  say(
    a.lastHash === b.lastHash,
    "BYTE-IDENTICAL: the worker's positions, normals, indices and reveal keys equal the main thread's",
    `${a.lastHash} vs ${b.lastHash}`,
  )
  say(
    c.lastHash !== a.lastHash,
    "NEGATIVE CONTROL: a different wobble produces a DIFFERENT hash (the channel can fail)",
    `${a.lastHash} vs ${c.lastHash}`,
  )
  /* INSTRUMENT REPAIR 2026-08-03 — VACUOUS FIELD READ.
   *
   *   WAS: say((a.workerErrors ?? 0) === 0 && (b.workerErrors ?? 0) === 0, …)
   *
   * `workerErrors` is a field of `__implicitDefer.debug`. If the module ever
   * stops publishing it — renamed, moved onto a sub-object, dropped in a
   * refactor — `undefined ?? 0` is `0` and the row goes green FOREVER while
   * reporting on nothing. That is the same shape as control 2 in this file's own
   * header ("a worker that silently fell back… would compare itself against
   * itself and pass forever"), one line further down. The `?? 0` is the whole
   * defect: it converts "the channel is gone" into "the channel is clean".
   *
   * Existence is now asserted before the value is, on BOTH arms, so a missing
   * field is a FAIL with its own row rather than a silent zero. The detail line
   * prints the raw values so `undefined` is visible when it happens. */
  const hasWorkerErrors = typeof a.workerErrors === "number" && typeof b.workerErrors === "number"
  say(
    hasWorkerErrors,
    "the worker-error channel EXISTS (a missing field must not read as zero errors)",
    `armA=${JSON.stringify(a.workerErrors)} armB=${JSON.stringify(b.workerErrors)}`,
  )
  say(
    hasWorkerErrors && a.workerErrors === 0 && b.workerErrors === 0,
    "no worker errors",
    `armA=${JSON.stringify(a.workerErrors)} armB=${JSON.stringify(b.workerErrors)}`,
  )
  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")

  writeFileSync(join(OUT, "hashes.json"), JSON.stringify({ armA: a, armB: b, control: c }, null, 2))

  /* ═══ PROVENANCE · WAS THIS VERDICT MEASURED ON THIS RUN, ON THIS TREE? ═════
   *
   * ⚠ MEASURED 2026-08-28: this gate's capture directory was 21.3 days behind before tonight (08-07), and this lane's first run of it closed that gap.
   * `assert-gate-integrity.mjs` channel F called that out and was right.
   *
   * THIS GATE CAN RECAPTURE — it drives the browser and rewrites the directory
   * on every invocation — so the cure for the AGE is to run it, and running it
   * is what makes the row below pass. What the row guards is the part running
   * does not cure:
   *
   *   the capture is younger than this process   what was just graded was written
   *                                              by THIS run, not left behind by
   *                                              an older one. `lib/evidence-swap.mjs`
   *                                              keeps the previous set when a run
   *                                              dies partway, which is exactly the
   *                                              case where stale frames get graded.
   *   no source moved while it ran               six lanes share this checkout
   *                                              tonight. A lib/ write landing
   *                                              mid-capture straddles two builds
   *                                              and the reading belongs to neither.
   *
   * Together they imply channel F's own test: a capture younger than a process
   * that started after every source write post-dates every source write.
   *
   * The subject is all three roots, the same three channel F compares against;
   * `captureFreshness()` walks `lib/` alone and tonight `app/` moved with it.
   * `hashes.json` IS this gate's own output, and it is the only artefact this
   * capture leaves on disk — there is no renderer file to compare against
   * instead. So an age check alone would certify the gate's own write, the
   * trap `assert-drawin-pentip.mjs` recorded. That is why the row asks WHEN
   * the write happened relative to this process rather than how old it is.
   * DISPATCH §3 — a SKIP is not a pass. */
  {
    const capNow = newestCapture(OUT, /\.json$/)
    const subjNow = ["lib", "app", "components"]
      .map((d) => newestUnder(join(ROOT, d)))
      .filter((x) => x.file)
      .sort((x, y) => y.ms - x.ms)[0]
    const relP = (f) => (f && f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f)
    const stampP = (ms) => new Date(ms).toLocaleString()
    const started = performance.timeOrigin
    const landed = Boolean(capNow.file) && capNow.ms >= started
    const treeHeld = Boolean(subjNow?.file) && subjNow.ms <= started
      const detailP = !landed
    ? (capNow.file
          ? `THE CAPTURE DID NOT LAND — newest artefact ${relP(capNow.file)} ${stampP(capNow.ms)} predates this run, which started ${stampP(started)}. ` +
            `The rows here graded evidence an earlier run left behind. Re-run node scripts/verify/assert-geom-offthread.mjs --label=${LABEL}; do NOT relax this row.`
          : `NO ARTEFACT written by this run under ${relP(OUT)} — nothing was graded, so nothing below is a verdict.`)
      : !treeHeld
        ? `THE TREE MOVED UNDER THIS RUN — ${relP(subjNow.file)} was written ${stampP(subjNow.ms)}, after this run started ${stampP(started)}. ` +
          `The capture straddles two builds and belongs to neither. Re-run node scripts/verify/assert-geom-offthread.mjs --label=${LABEL}; do NOT relax this row.`
        : `capture ${relP(capNow.file)} ${stampP(capNow.ms)} · run started ${stampP(started)} · newest source ${relP(subjNow.file)} ${stampP(subjNow.ms)}`
    say(
      landed && treeHeld,
      "PROVENANCE · this verdict was measured on this run, against a tree that did not move under it",
      detailP,
    )
  }

  await context.close()
  await browser.close()
  EV.commit()
  console.log(`\njson: ${join(FINAL, "hashes.json")}`)
  console.log(pass ? "\nALL ASSERTIONS PASS" : "\nSEE FAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

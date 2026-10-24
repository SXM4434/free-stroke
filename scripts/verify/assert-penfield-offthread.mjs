// ASSERT: THE WORKER'S PEN FIELD IS THE SAME FIELD, BYTE FOR BYTE.
//
// WHAT IS AT RISK. `lib/pen-field-defer.ts` moved the pen-field bake to a Web
// Worker so touching a dial stops freezing the page. That is worth nothing —
// worse than nothing — if the field it hands back is not the one the main
// thread would have baked. The field IS the carve: `penCarve` is a fragment
// `discard` against `mix(tube, pen, carve)`, so a field that is merely close
// moves the silhouette of the mark this whole product is about.
//
// WHY THE OTHER GATES CANNOT ANSWER THIS.
//   - `assert-pen-carve.mjs` reads `__heroPenField`'s dimensions, radius and
//     box. A field whose every texel had moved would agree on all of them.
//   - `geometry-baseline` never touches the pen field at all — it is a shader
//     discard, not geometry, so `exportBytes` and the vertex counts are green
//     rows that CANNOT FAIL on this change.
//   - Every node-side assert runs where there is no Worker.
// None of them touches the worker. This does.
//
// THE MEASUREMENT. `PEN_FIELD_DEFER.hash` turns on an FNV-1a over EVERY BYTE of
// the adopted `Float32Array` — both channels, every texel. The hero word's
// field is then baked down both paths and the two hashes compared:
//
//   A. law.mode = "sync"    -> wobble V  -> hash, lastHashSource must be "sync"
//   B. law.mode = "worker"  -> wobble V  -> hash, lastHashSource must be "worker"
//   A and B must be IDENTICAL.
//
// THE CONTROLS, because an equality test that cannot fail proves nothing:
//   1. DIFFERENT INPUT. The same comparison at a different wobble must produce a
//      DIFFERENT hash. If it does not, the hash is blind and A == B means only
//      that the channel is dead.
//   2. PATH PROVENANCE. Each arm asserts `lastHashSource`, read off the module,
//      so "the worker baked it" is not inferred from a mode flag. Without this,
//      a worker that silently fell back to the synchronous path would compare
//      itself against itself and pass forever.
//   3. NON-EMPTY. A zero-texel field would hash equal on both arms. Width and
//      height are asserted > 0 and asserted EQUAL.
//
// Usage:
//   node scripts/verify/_run-clean.mjs scripts/verify/assert-penfield-offthread.mjs
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
/* STAGED. `docs/verification/penfield-offthread/<label>`, and the label is an
 * argument, so the reach is the whole subtree: 1 tracked file.
 * lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "penfield-offthread", LABEL)
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
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 2 })
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
    await page.evaluate(() => !!window.__penFieldDefer),
    "window.__penFieldDefer is published (without it this script measures nothing)",
  )
  say(
    await page.evaluate(() => !!window.__heroPenField),
    "the pen field is actually being baked on this page (penCarve > 0)",
    JSON.stringify(await page.evaluate(() => window.__heroPenField ?? null)),
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
   * Bake `wobble` down `mode`, and report the hash of what was adopted.
   *
   * The cache is turned OFF for the whole run. With it on, arm B could be
   * answered out of the cache arm A populated — the two arms would then be
   * comparing one bake against itself and the equality would be a tautology.
   */
  const bakeAt = async (mode, wobble) => {
    await page.evaluate((m) => {
      window.__penFieldDefer.law.hash = true
      window.__penFieldDefer.law.cacheEntries = 0
      window.__penFieldDefer.law.mode = m
      window.__penFieldDefer.reset()
    }, mode)
    // A fresh slot has nothing on screen to hold, so its FIRST bake is always
    // synchronous by design. Warm it at a throwaway value, then measure the
    // value we care about — otherwise the "worker" arm would silently be a
    // synchronous bake and the comparison would pass while proving nothing.
    await nudge((wobble + 0.13).toFixed(3))
    await page.waitForTimeout(4000)
    await nudge(wobble.toFixed(3))
    await page.waitForTimeout(1000)
    await page.evaluate(() => window.__penFieldDefer.idle(20000))
    await page.waitForTimeout(600)
    return page.evaluate(() => ({
      ...window.__penFieldDefer.debug,
      minCostMs: window.__penFieldDefer.law.minCostMs,
      /* READ BACK, because the law is set in one `evaluate` and consumed in a
       * later frame: a page reload between the two (Turbopack HMR does it
       * unprompted the first time a worker chunk is built) silently resets the
       * module and `lastHash` comes back EMPTY — which would then "differ" from
       * every other hash and make the negative control pass while measuring
       * nothing. Carried out so the rows below can refuse that. */
      hashOn: window.__penFieldDefer.law.hash,
      modeNow: window.__penFieldDefer.law.mode,
    }))
  }

  const V1 = 0.42
  const V2 = 0.71

  console.log("\n--- ARM A: mode 'sync' (the parked prior, on the main thread) ---")
  const a = await bakeAt("sync", V1)
  console.log(`  hash ${a.lastHash}  source ${a.lastHashSource}  ${a.lastWidth}x${a.lastHeight}  syncMs ${a.lastSyncMs.toFixed(1)}`)

  console.log("\n--- ARM B: mode 'worker' (shipped default, off the main thread) ---")
  const b = await bakeAt("worker", V1)
  console.log(`  hash ${b.lastHash}  source ${b.lastHashSource}  ${b.lastWidth}x${b.lastHeight}  workerMs ${b.lastWorkerMs.toFixed(1)}`)

  console.log("\n--- CONTROL: a DIFFERENT input, off the main thread ---")
  const c = await bakeAt("worker", V2)
  console.log(`  hash ${c.lastHash}  source ${c.lastHashSource}  ${c.lastWidth}x${c.lastHeight}`)

  console.log("")
  say(a.lastHashSource === "sync", "ARM A really ran on the main thread", `source=${a.lastHashSource}`)
  say(
    b.lastHashSource === "worker",
    "ARM B really ran in the worker",
    `source=${b.lastHashSource} · the seeding bake cost ${a.lastSyncMs.toFixed(1)}ms against a ${b.minCostMs}ms floor`,
  )
  say(c.lastHashSource === "worker", "the control arm really ran in the worker", `source=${c.lastHashSource}`)
  say(
    a.lastWidth > 100 && a.lastHeight > 100,
    "the field is non-empty (a zero-texel field hashes equal on both arms)",
    `${a.lastWidth}x${a.lastHeight} = ${a.lastWidth * a.lastHeight} texels`,
  )
  say(!!a.lastHash && a.lastHash.length > 4, "the hash channel produced a value", a.lastHash)

  say(a.lastWidth === b.lastWidth && a.lastHeight === b.lastHeight, "same texel dimensions", `${a.lastWidth}x${a.lastHeight} vs ${b.lastWidth}x${b.lastHeight}`)
  say(
    a.lastHash === b.lastHash,
    "BYTE-IDENTICAL: the worker's pen and tube distances equal the main thread's, every texel",
    `${a.lastHash} vs ${b.lastHash}`,
  )
  /* AN EMPTY HASH DIFFERS FROM EVERYTHING, so it is refused explicitly before
   * the inequality is allowed to mean anything. Found the hard way: a reload
   * mid-run reset `law.hash` and the control came back with `lastHash: ""`,
   * which "passed" the row below while proving exactly nothing. */
  say(
    !!a.lastHash && !!b.lastHash && !!c.lastHash && a.hashOn && b.hashOn && c.hashOn,
    "every arm actually hashed (an empty hash would 'differ' from anything)",
    `A "${a.lastHash}" B "${b.lastHash}" C "${c.lastHash}" · hashOn ${a.hashOn}/${b.hashOn}/${c.hashOn}`,
  )
  say(
    !!c.lastHash && c.lastHash !== a.lastHash,
    "NEGATIVE CONTROL: a different wobble produces a DIFFERENT hash (the channel can fail)",
    `${a.lastHash} vs ${c.lastHash}`,
  )
  say((a.workerErrors ?? 0) === 0 && (b.workerErrors ?? 0) === 0, "no worker errors", `${b.workerErrors}`)
  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")

  writeFileSync(join(OUT, "hashes.json"), JSON.stringify({ armA: a, armB: b, control: c }, null, 2))

  /* ═══ PROVENANCE · WAS THIS VERDICT MEASURED ON THIS RUN, ON THIS TREE? ═════
   *
   * ⚠ MEASURED 2026-08-28: this gate's capture directory was 21.3 days behind before tonight (08-07).
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
            `The rows here graded evidence an earlier run left behind. Re-run node scripts/verify/assert-penfield-offthread.mjs --label=${LABEL}; do NOT relax this row.`
          : `NO ARTEFACT written by this run under ${relP(OUT)} — nothing was graded, so nothing below is a verdict.`)
      : !treeHeld
        ? `THE TREE MOVED UNDER THIS RUN — ${relP(subjNow.file)} was written ${stampP(subjNow.ms)}, after this run started ${stampP(started)}. ` +
          `The capture straddles two builds and belongs to neither. Re-run node scripts/verify/assert-penfield-offthread.mjs --label=${LABEL}; do NOT relax this row.`
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

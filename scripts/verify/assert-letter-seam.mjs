// battery: browser
// ASSERT-LETTER-SEAM — NO TRIANGLE MAY BELONG TO TWO LETTERS.
//
// ── WHAT SEBS PHOTOGRAPHED ─────────────────────────────────────────────────
//
// 2026-08-04, `letterByLetter`, **engine FREE STROKE**, look Desk Doodles,
// SOLID 57 %, camera dead-on: *"look how the [mesh] gets fucked on letter by
// letter."* Hard-edged flat grey slabs sticking out of the `D`, the `e`, the
// `s`, the second `D`, the `o`, the `l` and the `e` — planar, angled, lighter
// than the ink, belonging to no letterform.
//
// ── WHY THIS IS A TOPOLOGY CLAIM AND NEEDS NO RASTER ──────────────────────
//
// Inflate builds ONE FUSED SURFACE for the whole word, so `buildLetterGeometry`
// assigns each VERTEX the letter whose ink is nearest. `applyLetterMotion` then
// rotates each vertex by ITS OWN letter's yaw. A triangle whose three vertices
// do not agree therefore has corners on two different rigid bodies, and the
// instant those two yaws differ it is stretched into a flat sheet across the
// gap. The count of such triangles is exact, it is a property of the buffers,
// and it does not need a camera, a light or a screenshot to settle.
//
// So the bar is ZERO, and it is a bar rather than a budget: one spanning
// triangle is one shard.
//
// ── THE CENSUS IS TAKEN OFF THE LIVE SCENE GRAPH ──────────────────────────
//
// `__inflateProbe.letterCensus()` walks the geometry that is actually mounted
// and counts again. `window.__letterSeam` is what the BUILDER says it did, and
// the two are compared — a builder that reported a fix it did not perform is the
// "green that cannot fail" shape this repo has now been burned by twelve times.
//
// ── THE KNOWN-BAD IS THE SHIPPED PRIOR, RE-RENDERED ───────────────────────
//
// `__captureHarness.setLetterWholeTriangles(false)` restores the per-vertex
// stamp. It takes on the next BUILD rather than the next frame — the stamp is
// baked into the geometry — so the arm is followed by a rebuild through a real
// control. That arm MUST come back with spanning > 0 or this gate is measuring
// nothing.
//
// ══════════════════════════════════════════════════════════════════════════
// ⚠ AND THE TRIANGLE CENSUS ABOVE WAS NECESSARY BUT NOT SUFFICIENT — 2026-08-04
// ══════════════════════════════════════════════════════════════════════════
//
// Everything above passed — 788 spanning triangles before the split, 0 after,
// 550 vertices split, 11 rows ALL PASS — and **the picture was still torn.**
// Driven at the exact state Sebs photographed (`letterByLetter` · FREE STROKE ·
// look Desk Doodles · dead-on · SOLID 57 %) the shipped arm carries a white
// stippled crack straight through the `e|sk`, the `d|l` and the `e|s` joins,
// and the two triangle-ownership arms disagree on a CONSTANT 1147 px for the
// whole 2.2 s solid hold. Whole triangles removed the grey slabs that had been
// covering the gap; they did not close it.
//
// **The gap is arithmetic.** `fsLetterPose` maps `q = R(p − piv) + piv`, so two
// letters at the SAME yaw about DIFFERENT pivots are two DIFFERENT rigid
// motions, separated by `(I − R)·Δpiv`. The cascade lands every letter on one
// shared yaw and holds it, so every join opens by `(1 − cos 30°) = 13.4 %` of
// the pivot separation. It closes IFF the landed letters share ONE axis — not a
// tolerance, an identity, because any translation that closes it algebraically
// reduces to `R(p − piv_word) + piv_word`.
//
// So the census claim is joined by the claim it could not state, and it is
// exact for the same reason the census is — a rigid motion of a continuous
// surface is continuous, so a SHARED AXIS *is* a closed seam and needs no
// raster. Its known-bad is `setLetterSettle(false)`, the parked prior, which
// pins each letter to its own centre and re-renders the crack. That is a
// UNIFORM, so it takes on the next frame and needs no rebuild.
//
// Usage: node scripts/verify/assert-letter-seam.mjs [--film=letterByLetter]
import { chromium } from "./lib/browser.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const FILM = arg("film", "letterByLetter")

let pass = true
let rows = 0
const say = (ok, label, detail) => {
  rows++
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)

  /* HIS STATE. The engine matters and is asserted off the DOM: the shards are on
   * FREE STROKE, because that is the family whose Inflate fuses the whole word
   * into one surface. Desk Doodles builds one mesh per stroke, so its stamp is a
   * constant per mesh and it cannot span — which is a real difference between
   * the two engines and is checked below rather than assumed. */
  await page.click('[data-engine-option="free-stroke"]')
  await page.waitForTimeout(3500)
  const pill = page.locator(`[data-read-film="${FILM}"]`)
  if ((await pill.count()) !== 1) throw new Error(`no [data-read-film="${FILM}"] pill`)
  await pill.click()
  await page.waitForTimeout(3000)

  const family = await page.evaluate(
    () => document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family") ?? null,
  )
  say(family === "free-stroke", "engine is FREE STROKE — the family whose Inflate fuses the word", String(family))

  const census = async () =>
    page.evaluate(() => ({
      live: window.__inflateProbe?.letterCensus?.() ?? null,
      builder: window.__letterSeam ?? null,
      whole: window.__captureHarness?.letterWholeTriangles?.() ?? null,
    }))

  const a = await census()
  say(!!a.live && a.live.withAttr > 0, "the cascade's per-vertex letter attribute is on the live geometry", a.live ? `${a.live.withAttr}/${a.live.meshes} mesh(es), ${a.live.triangles} triangles` : "no census")
  if (!a.live || a.live.withAttr === 0) {
    await context.close()
    await browser.close()
    console.log(`\n${rows} rows · FAILURES ABOVE`)
    process.exit(1)
  }

  /* THE SURFACE IS FUSED — otherwise the bar below is trivially met and the gate
   * would read green on a build where the cascade could not tear because there
   * was nothing to tear. One mesh carrying more than one letter is the condition
   * that makes the claim non-vacuous. */
  say(
    a.live.letters.length > 1,
    "the fused surface really does carry more than one letter",
    `${a.live.letters.length} letters present: ${a.live.letters.join(",")}`,
  )

  say(a.whole === true, "whole-triangle ownership is the shipped setting", String(a.whole))
  say(
    a.live.spanning === 0,
    "NO triangle spans two letters — the cascade cannot stretch a sheet across a join",
    `${a.live.spanning} of ${a.live.triangles} triangles`,
  )

  /* THE BUILDER'S OWN NUMBERS, CHECKED AGAINST THE OBJECT. */
  say(
    !!a.builder && a.builder.spanningAfter === a.live.spanning,
    "the builder's census agrees with the live geometry",
    a.builder ? `builder ${a.builder.spanningAfter} · live ${a.live.spanning} · split ${a.builder.splitVerts} vertices` : "builder published nothing",
  )
  say(
    !!a.builder && a.builder.spanningBefore > 0,
    "…and it had something to fix — the per-vertex stamp DOES span joins on this word",
    a.builder ? `${a.builder.spanningBefore} spanning before the split` : "no builder census",
  )

  /* ---- THE KNOWN-BAD, RE-RENDERED ---------------------------------------- */
  const ok = await page.evaluate(() => window.__captureHarness.setLetterWholeTriangles(false))
  say(ok === true, "the prior arm can be selected", String(ok))
  // A REBUILD, through a real control — the stamp is baked, so a uniform write
  // would not reach it. Switching the engine away and back rebuilds the mark.
  await page.click('[data-engine-option="desk-doodles"]')
  await page.waitForTimeout(2500)
  await page.click('[data-engine-option="free-stroke"]')
  await page.waitForTimeout(3500)
  const b = await census()
  say(b.whole === false, "the prior arm actually TOOK", String(b.whole))
  say(
    !!b.live && b.live.spanning > 0,
    "KNOWN-BAD (per-vertex ownership) is REJECTED",
    b.live ? `${b.live.spanning} of ${b.live.triangles} triangles span two letters` : "no census",
  )

  await page.evaluate(() => window.__captureHarness.setLetterWholeTriangles(true))

  /* ════════════════════════════════════════════════════════════════════════
   * THE SEAM ITSELF — DO THE LANDED LETTERS SHARE AN AXIS?
   * ════════════════════════════════════════════════════════════════════════ */

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(200)
  }

  /* THE SETTLED POSE IS FOUND, NOT TYPED. A hardcoded second is the drift class
   * this repo has been burned by repeatedly — a window sized for an old beat
   * still reads green while measuring the wrong frames. So the transport is
   * scanned for the phase by NAME and the midpoint of it is taken. */
  const total = await page.evaluate(() =>
    Number(document.querySelector("[data-hero-scrub]").getAttribute("max")),
  )
  let lo = null
  let hi = null
  for (let i = 0; i <= 120; i++) {
    const t = (total * i) / 120
    await seek(t)
    const ph = await page.evaluate(
      () => document.querySelector("[data-hero-phase]")?.getAttribute("data-hero-phase") ?? null,
    )
    if (ph === "solid") {
      if (lo === null) lo = t
      hi = t
    }
  }
  say(lo !== null, "the cascade has a SETTLED (solid) hold to judge", lo === null ? "no solid phase" : `${lo.toFixed(2)}s … ${hi.toFixed(2)}s`)

  if (lo !== null) {
    await seek((lo + hi) / 2)
    const axes = await page.evaluate(() => ({
      ax: window.__captureHarness?.letterPivots?.() ?? null,
      settle: window.__captureHarness?.letterSettle?.() ?? null,
    }))
    const spread = (a) => (a && a.length ? Math.max(...a) - Math.min(...a) : NaN)

    say(axes.settle === true, "settling onto the word's axis is the shipped setting", String(axes.settle))
    say(!!axes.ax && axes.ax.count > 1, "the settled pose publishes its per-letter axes", axes.ax ? `${axes.ax.count} letters` : "nothing published")

    if (axes.ax && axes.ax.count > 1) {
      /* NON-VACUITY, BOTH WAYS. The claim is empty if the letters' own centres
       * already coincide (nothing to converge) or if the settled yaw is 0 (a
       * rotation of 0 is the identity about ANY axis, so the seam cannot open
       * and the row would pass on a broken build). `letterLandYaw: 0` is a real,
       * reachable arm, which is exactly why this has to be checked and not
       * assumed. */
      const ownSpread = spread(axes.ax.own)
      say(ownSpread > 1e-3, "…and the letters really do have DIFFERENT centres, so there is something to converge", `own-axis spread ${ownSpread.toFixed(4)}`)
      const yawSpread = spread(axes.ax.yaw)
      const yawMag = Math.max(...axes.ax.yaw.map(Math.abs))
      say(yawSpread < 1e-6, "…and every letter has LANDED — one shared yaw", `yaw spread ${yawSpread.toExponential(2)}`)
      say(yawMag > 1e-3, "…at a yaw that is not zero, so the axis is observable at all", `|yaw| ${yawMag.toFixed(4)} rad`)

      const liveSpread = spread(axes.ax.live)
      say(
        liveSpread < 1e-6,
        "THE SEAM IS CLOSED — every landed letter turns about ONE axis, so the rank is one rigid motion",
        `live-axis spread ${liveSpread.toExponential(2)} · word axis ${axes.ax.wordX.toFixed(4)}`,
      )

      /* ---- THE KNOWN-BAD: the parked prior, re-rendered ------------------- */
      const took = await page.evaluate(() => window.__captureHarness.setLetterSettle(false))
      await page.waitForTimeout(350)
      const bad = await page.evaluate(() => ({
        ax: window.__captureHarness?.letterPivots?.() ?? null,
        settle: window.__captureHarness?.letterSettle?.() ?? null,
      }))
      say(took === true && bad.settle === false, "the parked prior arm (own axis) actually TOOK", String(bad.settle))
      const badSpread = bad.ax ? spread(bad.ax.live) : NaN
      say(
        badSpread > 1e-3,
        "KNOWN-BAD (each letter on its OWN axis) is REJECTED — the landed rank is NOT one rigid motion",
        `live-axis spread ${Number.isFinite(badSpread) ? badSpread.toFixed(4) : "n/a"} (bar 1e-3)`,
      )
      await page.evaluate(() => window.__captureHarness.setLetterSettle(true))
    }
  }

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")

  await context.close()
  await browser.close()
  console.log(`\n${rows} rows · ${pass ? "ALL PASS" : "FAILURES ABOVE"}`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

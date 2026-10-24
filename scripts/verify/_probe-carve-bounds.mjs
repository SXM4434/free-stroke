// _PROBE-CARVE-BOUNDS — the form's world bounds, with the pose it was read at.
//
// 🔴 RESTATED AND THE POSE RECORDED, 2026-08-07. This probe published two
// numbers — `bounds.center` and `bounds.radius` — at a pose it never set and
// never wrote down. Explainer 39 §3.3 lists it as one of two files that do
// exactly that: `:15 await p.waitForTimeout(2500)` and then straight to
// `setFlatten({penCarve: 0.5})`, so whatever beat the page happened to be on
// when the wait elapsed WAS the pose, and it was unrecorded.
//
// The pose it actually takes is the page's INITIAL playhead — `phase draw`,
// `phaseT 0`, scrub 0 — because nothing here ever moves it.
//
// ── AND THE NUMBER TURNS OUT TO BE POSE-INVARIANT, WHICH IS THE POINT ──────
//
// Measured at five poses with `penCarve 0.5` held constant — scrub 0, DRAW 50 %,
// DRAW 96 %, the finished mark, and the hold at t=12:
//
//     center {0.284525463037429, 1.2607324893086729, 0}   radius 1.325013223271808
//     BYTE-IDENTICAL AT ALL FIVE
//
// That is not luck and it is not a licence to keep skipping the pose. The reason
// is mechanical: `bounds()` is `apiBounds` (`components/viewport-3d.tsx:10030`),
// which returns `boundsRef.current` — a value written at GEOMETRY BUILD. So the
// number is **build-scoped, not pose-scoped**, and it moves when the geometry is
// rebuilt (a dial, an engine switch, a word change), not when the playhead moves.
//
// A probe that neither sets nor records the pose cannot say any of that. It
// could not tell a number that is invariant from a number that happened to be
// read twice on the same frame. It says it now — the pose is READ and PUBLISHED
// beside the number, so the day `bounds` starts depending on the playhead, this
// output shows it instead of averaging over it.
//
// This is explainer 39 §4 rule 4 applied to the smallest possible instrument:
// "Put the pose in the header, beside the number. Derived from the page, not a
// constant."
//
// Usage: node scripts/verify/_probe-carve-bounds.mjs
import { chromium } from "playwright-core"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] })
const c = await b.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 })
const p = await c.newPage()
await p.goto(HERO_URL, { waitUntil: "networkidle" })
await p.waitForSelector("[data-hero-play]", { timeout: 90000 })
await p.waitForFunction(() => window.__captureHarness, null, { timeout: 120000 })
await p.waitForTimeout(2500)

/* THE ARM READS WHAT THE DRIVER RETURNED. `setFlatten` refuses a key that is not
 * on `FlatState` and returns `false`; an arm that never reached the render and
 * an arm that reached it and changed nothing publish the same bounds. Explainer
 * 39 §4 rule 1; the channel that holds it is `assert-arm-took.mjs`. */
const took = await p.evaluate(() => window.__captureHarness.setFlatten({ penCarve: 0.5 }))
if (took !== true) {
  console.error(JSON.stringify({ error: "setFlatten({penCarve: 0.5}) REFUSED", returned: took }, null, 2))
  await c.close()
  await b.close()
  process.exit(1)
}
await p.waitForTimeout(1500)

const out = await p.evaluate(() => {
  /* THE POSE, READ OFF THE PAGE — never a constant. These are the same
   * attributes `_probe-drawin-holes.mjs` asserts its own pose from. */
  const el = document.querySelector("[data-hero-phase]")
  const scrub = document.querySelector("[data-hero-scrub]")
  return {
    pose: {
      phase: el?.getAttribute("data-hero-phase") ?? null,
      phaseT: el ? Number(el.getAttribute("data-hero-phase-t")) : null,
      carve: el ? Number(el.getAttribute("data-hero-carve")) : null,
      carveLaw: el?.getAttribute("data-hero-carve-law") ?? null,
      scrub: scrub ? Number(scrub.value) : null,
      note: "the page's INITIAL playhead — this probe sets no pose, and that is now stated rather than hidden",
    },
    bounds: window.__captureHarness.bounds(),
    boundsAre: "BUILD-SCOPED, not pose-scoped: apiBounds returns boundsRef.current, written at geometry build (viewport-3d.tsx:10030). Measured byte-identical at five poses on 2026-08-07.",
    penField: window.__heroPenField,
    junctions: window.__heroJunctions
      ? {
          inkWidth: window.__heroJunctions.inkWidth,
          /* the count that ATTRIBUTES a joint-break reading — `list.length`.
           * `_probe-drawin-holes.mjs` spent its whole life censusing two key
           * names that do not exist on this object; the real five are
           * inkWidth · breakK · law · carve · list
           * (`app/desk-doodles/page.tsx:1753`). */
          junctionCount: window.__heroJunctions.list?.length ?? null,
          keys: Object.keys(window.__heroJunctions),
        }
      : null,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
  }
})
console.log(JSON.stringify(out, null, 2))
await c.close()
await b.close()

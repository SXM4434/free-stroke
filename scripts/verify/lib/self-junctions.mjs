// THE SELF-CROSSING JUNCTIONS, ON A LIVE PAGE, WITHOUT EDITING THE PAGE.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
// `lib/flat-ink.ts` can now express a self-crossing (`HeroJunctionInput`'s
// `underAt` / `overAt`) and owns the law that finds one (`findSelfCrossings`).
// The only thing left is the CALL SITE — twenty lines in
// `app/desk-doodles/page.tsx`'s `findHeroJunctions` — and that file belongs to
// another lane. So the same call is made here, from Node, and the result is
// written onto `window.__heroJunctions` before the gate measures.
//
// ── AND IT IS THE REAL FUNCTION ON THE REAL STROKES, WHICH IS THE POINT ────
// The strokes are read back off the page (`window.__handFeelHarness.processed`)
// rather than rebuilt in Node, so the junction set is computed against exactly
// the geometry the renderer built. The law is `findSelfCrossings` itself, loaded
// from `lib/flat-ink.ts` — not a restatement of it, because a second
// implementation that agrees with a bug is this repo's most expensive defect
// class. Everything downstream — `buildJointBreaks`, `syncBreakTable`, the
// fragment shader — is the shipped path, untouched.
//
// WHAT IS THEREFORE *NOT* PROVEN by a gate run through this file: that
// `page.tsx` publishes the set. That is the diff this lane hands over, and it is
// stated plainly wherever a gate reports through here rather than assumed away.
//
// ⚠ `syncBreakTable` CACHES ON THE LIST'S OBJECT IDENTITY (`cur.junctions ===
// list`), so the write has to be a NEW array on a NEW object or the renderer
// keeps the old table and the run silently grades the un-injected page. The
// helper returns the counts it wrote and the caller asserts on them.
import { loadTs } from "../_ts-load.mjs"

const flat = loadTs("lib/flat-ink.ts")
const { findSelfCrossings } = flat

/**
 * Compute the self-crossing set from the page's own strokes and publish the
 * extended junction list. Returns `{ before, self, after }` px counts.
 *
 * @param page      a Playwright page already past `__heroJunctions`
 * @param carve     the amplitude the guard is sized at — the same number the
 *                  gate drives `HeroMotionParams.carveAmount` with
 */
export async function injectSelfJunctions(page, carve) {
  const data = await page.evaluate(() => {
    const jg = window.__heroJunctions
    return {
      inkWidth: jg.inkWidth,
      breakK: jg.breakK,
      law: jg.law,
      count: jg.list.length,
      strokes: window.__handFeelHarness.processed.map((st) =>
        st.map((p) => ({ x: p[0], y: p[1] })),
      ),
    }
  })
  /* ── ⚠ THE CALL SITE LANDED, SO THIS FILE IS OBSOLETE ON `"selfcross"` ─────
   *
   * `app/desk-doodles/page.tsx` now publishes the self-crossings itself (lane
   * 31, 2026-08-02). Injecting them again APPENDS a second copy of the same
   * set: every break would be built twice, `__heroBreaks.junctions` would read
   * double, and a long enough list would start hitting `JOINT_BREAK_MAX` and
   * report `truncated` — a silently wrong grade on a run that looks like it
   * worked. That is exactly the failure this helper's own header warns about
   * from the other direction.
   *
   * So it refuses, loudly, and returns `self: 0` — which every caller already
   * treats as "an arm that did not switch is not a control" and exits 2 on. The
   * flag stays parked rather than deleted: `--self` is still the way to drive
   * the set on the PARKED `"crossings"` arm, where the page does not publish
   * it — reached with `window.__heroJunctionLaw = "crossings"` in an init
   * script, the same shape every other parked arm is reached by. */
  if (data.law === "selfcross") {
    console.error(
      `--self is OBSOLETE on law "${data.law}": the page publishes the ` +
        `self-crossings itself (${data.count} junctions). Injecting would ` +
        `DOUBLE the set. Drop the flag — or set ` +
        `window.__heroJunctionLaw = "crossings" first, which is the parked arm ` +
        `that still needs injecting.`,
    )
    return { before: data.count, self: 0, after: data.count, law: data.law }
  }
  const self = []
  for (let s = 0; s < data.strokes.length; s++) {
    const pts = data.strokes[s]
    if (pts.length < 3) continue
    for (const x of findSelfCrossings(pts, data.inkWidth, carve, data.breakK))
      self.push({
        under: s,
        over: s,
        x: x.x,
        y: x.y,
        gap: x.gap,
        underAt: x.underAt,
        overAt: x.overAt,
      })
  }
  const after = await page.evaluate((add) => {
    const jg = window.__heroJunctions
    window.__heroJunctions = { ...jg, list: [...jg.list, ...add], selfInjected: add.length }
    return window.__heroJunctions.list.length
  }, self)
  return { before: data.count, self: self.length, after, law: data.law }
}

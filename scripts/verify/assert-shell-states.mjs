#!/usr/bin/env node
/**
 * THE THREE SHELL STATES NOTHING HAD EVER DRIVEN.
 *
 * The product shell has three surfaces a user only ever meets when something is
 * slow, broken, or full — and not one of them had a gate:
 *
 *   §1  THE LOADING STATE. `ViewportLoading` (components/viewport-3d-wrapper.tsx)
 *       is what fills the right half of the screen while a ~7,000-line chunk
 *       carrying three.js, R3F, drei and the GLTF exporter downloads. Nothing
 *       had ever seen it, because on a warm dev server it is gone in a frame.
 *
 *   §2  THE ERROR BOUNDARY. `ViewportErrorBoundary`
 *       (components/viewport-error-boundary.tsx, applied from
 *       components/viewport-3d-wrapper.tsx) has a "Rebuild the view" button, a
 *       second copy for a repeat failure, and a collapsed technical detail —
 *       and THERE WAS NO WAY TO MAKE IT APPEAR. It had never presented a frame.
 *       docs/README.md names that exact category: "correct code that rendered
 *       wrong, and none would have survived a frame check."
 *       The button then spent two days recorded as a control that could not
 *       act. It could; the gate could not see it. See the block above
 *       `p.addInitScript` below — that is the correction, and it is the
 *       expensive kind, because a gate wrong about the app teaches everyone
 *       reading it the same wrong thing.
 *
 *   §3  THE TOAST PATHS. Every one of them is a message shown at the moment the
 *       app has bad news — a failed restore, a full disk, a ⌘Z that reached
 *       nothing. They are also, structurally, the app's most dangerous UI: a
 *       toast in this product once landed ON TOP OF the Undo button while
 *       telling the user to press it (app/page.tsx:1874). So every one of them
 *       is driven AND collision-checked against every interactive element.
 *
 * CALIBRATION — each section states the arm it must go RED on, and runs it.
 * A gate that cannot fail is the lie this repo has shipped eleven times.
 *
 * Usage: node scripts/verify/assert-shell-states.mjs
 */
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "..", "docs", "verification", "shell-states")
mkdirSync(OUT, { recursive: true })
const URL = LAB_URL

let pass = 0
let fail = 0
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`)
  cond ? pass++ : fail++
  return cond
}

const b = await chromium.launch()

/* ==================================================================== */
/*  §1 · THE LOADING STATE                                              */
/* -------------------------------------------------------------------- */
/*  The chunk is held at the network layer rather than simulated, so     */
/*  what is asserted is the real `next/dynamic` loading branch.          */
/* ==================================================================== */
console.log("\n--- §1 · the 3D chunk's loading state ---")
{
  const p = await b.newPage({ viewport: { width: 1500, height: 1460 }, reducedMotion: "no-preference" })
  let held = 0
  await p.route("**/*.js", async (route) => {
    const u = route.request().url()
    // The viewport chunk is the one that carries three.js. Hold anything big
    // and app-owned long enough for the loading branch to be observable.
    if (/_next\/static\/chunks\//.test(u)) {
      held++
      await new Promise((r) => setTimeout(r, 2600))
    }
    await route.continue()
  })
  await p.goto(URL, { waitUntil: "domcontentloaded" })
  const seen = await p
    .waitForSelector('text=Starting the 3D engine', { timeout: 9000 })
    .then(() => true)
    .catch(() => false)
  ok(held > 0, `the chunk route was actually intercepted (${held} requests held) — the instrument is in the path`)
  ok(seen, "the loading state renders while the 3D chunk is in flight")
  if (seen) writeFileSync(join(OUT, "loading.png"), await p.screenshot())
  // It must also GO AWAY. A loading state that never clears is the worse bug.
  await p.unroute("**/*.js")
  const cleared = await p
    .waitForSelector('text=Starting the 3D engine', { state: "detached", timeout: 25000 })
    .then(() => true)
    .catch(() => false)
  ok(cleared, "and it clears once the chunk lands")
  await p.close()
}

/* ==================================================================== */
/*  §2 · THE ERROR BOUNDARY                                             */
/* ==================================================================== */
console.log("\n--- §2 · ViewportErrorBoundary ---")
{
  const p = await b.newPage({ viewport: { width: 1500, height: 1460 }, reducedMotion: "no-preference" })
  const consoleErrs = []
  const pageErrs = []
  p.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text()) })
  p.on("pageerror", (e) => pageErrs.push(String(e)))

  /* ══════════════════════════════════════════════════════════════════════
   * THE GATE MUST NOT BE THE THING BREAKING THE APP IT MEASURES.
   *
   * This file already carries one instance of that lesson — §3's note on why
   * toasts are dismissed through their close button and never `.remove()`. Here
   * is the second, and it is what kept the recovery row below red for two days
   * while the button underneath it was fine.
   *
   * The crash law poisons a stroke with a `points` getter that throws on EVERY
   * read. React catches the first read — that one is in `Viewport3D`'s render
   * body, the boundary sees it, the card appears, and every row above passes.
   * Then React DOM's DEVELOPMENT build reads the same getter a SECOND time,
   * from its own Performance Track instrumentation, walking props to build a
   * DevTools diff:
   *
   *     at get points                  (app/page.tsx — the law)
   *     at addObjectDiffToProperties   ×3   (props -> array -> stroke)
   *     at logComponentRender
   *     at commitPassiveMountOnFiber   <- the COMMIT phase, not render
   *
   * Nothing can catch that; it is in no component's render. And it is fatal,
   * because `flushPassiveEffects` sets `executionContext |= CommitContext`
   * before the passive effects and restores it on the line AFTER them, while
   * its `finally` restores only `ReactDOMSharedInternals.p` and
   * `ReactSharedInternals.T`. The throw skips the restore, `CommitContext`
   * stays set forever, and every later flush hits `performWorkOnRoot`'s
   * "Should not already be working." — FiberRoot.pendingLanes stuck at 34, no
   * commit ever again, so the card's own `setState` is inert too.
   *
   * `logComponentRender` and `addObjectDiffToProperties` appear ZERO times in
   * `react-dom-client.production.js`. No shipped build has that reader, and a
   * real crash leaves plain data in props rather than a getter that throws
   * forever — so the wedge belongs to the instrument, not to the product.
   *
   * `supportsUserTiming` is computed once at react-dom module init from
   * `typeof console.timeStamp === "function"`, and every `logComponentRender`
   * call sits behind it. Deleting it before any page script therefore switches
   * off exactly one thing: whether React walks a fiber's props for the DevTools
   * timeline. Nothing else in the app reads it. The law still delivers the
   * render-phase throw the boundary was written for — every row above still
   * runs against it — it just no longer delivers a second one that no product
   * build can produce.
   *
   * The full two-arm measurement is `scripts/verify/_probe-root-wedge.mjs`:
   * same law, one variable, `raw 41 -> 41` with the track on and `41 -> 81`
   * with it off.
   * ══════════════════════════════════════════════════════════════════════ */
  await p.addInitScript(() => { delete console.timeStamp })

  await p.goto(URL, { waitUntil: "networkidle" })
  await p.waitForFunction(() => window.__styleHarness)
  const pts = []
  for (let i = 0; i <= 80; i++) { const t = i / 80; pts.push({ x: 150 + t * 420, y: 330 + Math.sin(t * Math.PI * 2) * 100 }) }
  await p.evaluate((x) => window.__styleHarness.injectStrokes(x, { msPerPoint: 12 }), [pts])
  await p.waitForTimeout(1500)

  /* THE NEGATIVE CONTROL, RUN FIRST. Before the law is fired the boundary must
   * be ABSENT. Without this, "the boundary is on screen" could be true because
   * it is always on screen, and the row could not fail. */
  const before = await p.evaluate(() =>
    !![...document.querySelectorAll("p")].find((e) => e.textContent.includes("The 3D view stopped")),
  )
  ok(!before, "negative control — the boundary is NOT showing before the law fires")

  /* THE HEALTHY SHAPE, READ FROM THE RUNNING APP RATHER THAN WRITTEN DOWN.
   * "Recovered" has to mean "back to this", not "the card's text went away" —
   * a boundary that cleared onto a dead viewport would pass a text-only row. */
  const healthy = await p.evaluate(() => ({
    canvases: document.querySelectorAll("canvas").length,
    rawPts: Number((document.body.innerText.match(/raw (\d+) pts/) || [])[1] || 0),
  }))
  ok(
    healthy.canvases >= 2 && healthy.rawPts > 0,
    `baseline read from the healthy app (${healthy.canvases} canvases, raw ${healthy.rawPts} pts) — recovery is graded against this`,
  )

  const lawExists = await p.evaluate(() => typeof window.__styleHarness.crashViewport === "function")
  ok(lawExists, "the dev law exists (`__styleHarness.crashViewport`)")

  await p.evaluate(() => window.__styleHarness.crashViewport(true))
  await p.waitForTimeout(1500)
  const after = await p.evaluate(() => ({
    boundary: !![...document.querySelectorAll("p")].find((e) => e.textContent.includes("The 3D view stopped")),
    canvases: document.querySelectorAll("canvas").length,
    globalCrash: /Application error/.test(document.body.innerText),
    stack: window.__fsCrashReaderStack || "",
  }))
  ok(pageErrs.some((e) => /forced scene-side throw/.test(e)) || after.globalCrash || after.boundary,
    "the law actually threw (it is not a no-op)")

  const shown = after.boundary
  if (!ok(shown, "firing it puts the REAL boundary on screen")) {
    /* ⚠ KNOWN OPEN DEFECT — AND THE FORCED THROW IS WHAT FOUND IT.
     *
     * The boundary does not appear, and the reason is structural rather than a
     * missing trigger. The first thing to read a stroke is a `useMemo` in
     * `Viewport3D`'s OWN render body:
     *
     *   at get points                    (app/page.tsx, the law)
     *   at penTimeDistanceFraction       (lib/pen-kinematics)
     *   at measureTimingCharacter
     *   at Viewport3D.useMemo[timingCharacter]   <-- Viewport3D's own body
     *   at Viewport3D
     *   at renderWithHooks / beginWork
     *
     * `ViewportErrorBoundary` is rendered BY `Viewport3D`, inside its returned
     * JSX (components/viewport-3d.tsx:7637). A React error boundary catches
     * errors from its CHILDREN — and `Viewport3D`'s own body is its PARENT. So
     * the boundary is structurally incapable of catching the failure class it
     * was written for: the stroke reads, the geometry memos and the camera
     * framing all run above it.
     *
     * OBSERVED CONSEQUENCE: canvases 0 and the document body reading
     * "Application error: a client-side exception has occurred". The user gets
     * Next.js's global white screen, NOT the "Rebuild the view" card, and the
     * drawing goes with it.
     *
     * THE FIX IS ONE MOVE AND IT IS NOT IN THIS LANE'S FILES: the boundary has
     * to wrap `<Viewport3D>` from OUTSIDE — i.e. in
     * `components/viewport-3d-wrapper.tsx`, around the `dynamic()` component —
     * rather than live inside it. Wrapping the `<Canvas>` as well is fine and
     * costs nothing; wrapping ONLY the Canvas is what produced this.
     * Owner: components/viewport-3d.tsx + components/viewport-3d-wrapper.tsx.
     */
    console.log("      ↳ canvases now:", after.canvases, "· global 'Application error' shown:", after.globalCrash)
    console.log("      ↳ first reader of the poisoned stroke:")
    for (const line of String(after.stack).split("\n").slice(1, 7)) console.log("        " + line.trim())
    console.log("      ↳ DIAGNOSIS: ViewportErrorBoundary is rendered INSIDE Viewport3D (viewport-3d.tsx:7637),")
    console.log("        so it cannot catch throws from Viewport3D's own render body. It must wrap <Viewport3D>")
    console.log("        from components/viewport-3d-wrapper.tsx instead. NOT this lane's file — reported, not patched.")
    writeFileSync(join(OUT, "error-boundary-MISSED.png"), await p.screenshot())
  }
  if (shown) {
    writeFileSync(join(OUT, "error-boundary.png"), await p.screenshot())
    const hasRebuild = await p.evaluate(() =>
      !![...document.querySelectorAll("button")].find((e) => e.textContent.includes("Rebuild the view")),
    )
    ok(hasRebuild, "it offers 'Rebuild the view'")
    const detail = await p.evaluate(() => {
      const s = [...document.querySelectorAll("summary")].find((e) => e.textContent.includes("Technical detail"))
      return s ? s.parentElement.textContent : ""
    })
    ok(/forced scene-side throw/.test(detail), `the technical detail carries the real message (${JSON.stringify(detail.slice(0, 70))})`)
    ok(
      consoleErrs.some((t) => /Viewport\] crashed/.test(t)),
      "componentDidCatch logged the stack (the half that locates the fault)",
    )

    /* THE RECOVERY PATH. "Rebuild the view" that silently does nothing is worse
     * than no button — the boundary's own comment says so. */
    const clickRebuild = () =>
      p.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((e) => e.textContent.includes("Rebuild the view"))
        btn?.click()
      })
    const shell = () =>
      p.evaluate(() => {
        const card = [...document.querySelectorAll("p")].find((e) => e.textContent.includes("The 3D view stopped"))
        const body = card?.parentElement?.textContent || ""
        return {
          up: !!card,
          again: /stopped again/.test(body),
          reloadBtn: !![...document.querySelectorAll("button")].find((e) => e.textContent.includes("Reload the page")),
          canvases: document.querySelectorAll("canvas").length,
          rawPts: Number((document.body.innerText.match(/raw (\d+) pts/) || [])[1] || 0),
        }
      })

    /* ── THE CONTROL THAT MAKES THE ROW BELOW MEAN SOMETHING ──────────────
     * Press the button with the fault STILL LIVE. A button that does nothing
     * and a button that rebuilds into the same throw both leave a card on
     * screen — so a row that only checked "is the card gone" could not tell
     * them apart, and would read the same whether the control worked or not.
     * They differ in the copy: a rebuild that actually re-mounted and re-threw
     * flips the card to its second-failure wording and adds the Reload button.
     * That is the difference this asserts. */
    await clickRebuild()
    await p.waitForTimeout(2200)
    const stillFaulty = await shell()
    ok(
      stillFaulty.up && stillFaulty.again && stillFaulty.reloadBtn,
      `control — pressed while the fault is LIVE, the button re-mounts and re-throws: card up=${stillFaulty.up}, second-failure copy=${stillFaulty.again}, Reload offered=${stillFaulty.reloadBtn}`,
    )
    writeFileSync(join(OUT, "error-boundary-second-failure.png"), await p.screenshot())

    /* ── NOW THE REAL THING. Fault gone, same button. ─────────────────── */
    await p.evaluate(() => window.__styleHarness.crashViewport(false))
    await p.waitForTimeout(600)
    await clickRebuild()
    await p.waitForTimeout(3000)
    const rec = await shell()
    ok(!rec.up, "'Rebuild the view' actually recovers once the fault is gone")
    /* Not just "the card left". A viewport that came back dead would satisfy
     * that and nothing else here. */
    ok(
      rec.canvases >= healthy.canvases,
      `and the viewport is really back — ${rec.canvases} canvases, the healthy count (${healthy.canvases})`,
    )
    ok(
      rec.rawPts === healthy.rawPts && rec.rawPts > 0,
      `THE DRAWING SURVIVED the crash and the rebuild (raw ${rec.rawPts} pts, was ${healthy.rawPts})`,
    )
    if (!rec.up) writeFileSync(join(OUT, "error-boundary-recovered.png"), await p.screenshot())

    /* ── "AGAIN" HAS TO MEAN AGAIN. ───────────────────────────────────────
     * `retries` used to count button presses, so once a rebuild could actually
     * hold, the next unrelated fault in the same session would be met with "it
     * stopped again in the same place" and pushed at a reload it did not need.
     * A recovery that held resets it (`componentDidUpdate` on the boundary). */
    await p.evaluate(() => window.__styleHarness.crashViewport(true))
    await p.waitForTimeout(1800)
    const fresh = await shell()
    ok(
      fresh.up && !fresh.again && !fresh.reloadBtn,
      `a NEW fault after a recovery reads as a first failure, not "again" (again=${fresh.again}, Reload offered=${fresh.reloadBtn})`,
    )
    await p.evaluate(() => window.__styleHarness.crashViewport(false))
    await p.waitForTimeout(400)
    await clickRebuild()
    await p.waitForTimeout(2500)

    /* ── AND THE CARD'S RELOAD ADVICE HAS TO BE TRUE. ─────────────────────
     * The second-failure copy sends the user to a reload. It used to add "Your
     * drawing is not saved, so copy anything you need first", which is the
     * scariest thing this product says and was false — `app/page.tsx` autosaves
     * `rawStrokes` and restores them at boot. The copy now says the drawing
     * comes back; this is the row that keeps that honest. */
    const beforeReload = (await shell()).rawPts
    await p.reload({ waitUntil: "networkidle" })
    await p.waitForFunction(() => window.__styleHarness)
    await p.waitForTimeout(2200)
    const afterReload = (await shell()).rawPts
    ok(
      afterReload === beforeReload && afterReload > 0,
      `the card's reload advice is true — the drawing comes back (raw ${beforeReload} pts -> ${afterReload} pts)`,
    )
  }
  await p.close()
}

/* ==================================================================== */
/*  §3 · THE TOAST PATHS, AND WHAT THEY SIT ON TOP OF                   */
/* ==================================================================== */
console.log("\n--- §3 · toasts, driven and collision-checked ---")
{
  const p = await b.newPage({ viewport: { width: 1500, height: 1460 }, reducedMotion: "no-preference" })
  await p.goto(URL, { waitUntil: "networkidle" })
  await p.waitForFunction(() => window.__styleHarness)
  await p.evaluate(() => window.__styleHarness.clearStrokes())
  await p.waitForTimeout(400)

  /* THE COLLISION PROBE. For every interactive element in the shell, ask the
   * document what is actually AT its centre. If the answer is inside the
   * toaster, a toast is covering a control — which is the defect that already
   * shipped here once, with Clear's toast covering the Undo button it was
   * telling the user to press. */
  const collisions = async (label) => {
    // Retried once: a sibling lane saving a watched file fast-refreshes the
    // page and destroys the execution context mid-evaluate. `_run-clean.mjs`
    // reports the contamination afterwards; this just gets far enough to be
    // told so instead of dying with a stack trace.
    const hits = await p.evaluate(() => {
      const out = []
      const els = [...document.querySelectorAll("button, input, select, a[href]")]
      for (const el of els) {
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) continue
        if (r.bottom < 0 || r.top > innerHeight) continue
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (!top) continue
        if (top === el || el.contains(top) || top.contains(el)) continue
        if (top.closest("[data-sonner-toaster],[data-sonner-toast],li[data-sonner-toast]")) {
          out.push((el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 34))
        }
      }
      return out
    }).catch(async () => {
      await p.waitForTimeout(1500)
      return p.evaluate(() => []).catch(() => ["<context destroyed — run is contaminated>"])
    })
    return { label, hits }
  }

  /* CALIBRATION: prove the collision probe CAN see an overlap. A toast is
   * temporarily moved onto the control bar; the probe must report hits. A probe
   * that comes back clean on a deliberate overlap is blind. */
  await p.evaluate(() => window.__styleHarness.injectStrokes([[{ x: 200, y: 300 }, { x: 400, y: 380 }, { x: 520, y: 300 }]], {}))
  await p.waitForTimeout(300)
  await p.evaluate(() => window.__styleHarness.clearCanvas())
  await p.waitForSelector("[data-sonner-toast]", { timeout: 4000 })
  await p.waitForTimeout(500)
  await p.evaluate(() => {
    const t = document.querySelector("[data-sonner-toaster]")
    if (t) { t.style.setProperty("bottom", "0px", "important"); t.style.setProperty("--offset", "0px") }
  })
  await p.waitForTimeout(400)
  const cal = await collisions("calibration (toaster forced to bottom:0)")
  ok(cal.hits.length > 0, `calibration — the collision probe SEES a deliberate overlap (${cal.hits.length} controls covered: ${cal.hits.slice(0, 3).join(", ")})`)
  await p.evaluate(() => {
    const t = document.querySelector("[data-sonner-toaster]")
    if (t) { t.style.removeProperty("bottom"); t.style.removeProperty("--offset") }
  })
  await p.waitForTimeout(500)

  const cases = []
  /* TOASTS ARE DISMISSED THROUGH THEIR OWN CLOSE BUTTON, NEVER `.remove()`.
   * The first version ripped the `<li>`s out of the DOM directly; they are
   * React-managed, so the next reconcile threw, React unmounted the tree, and
   * `app/page.tsx`'s harness effect ran its cleanup — every later step then
   * failed with "Cannot read properties of undefined (reading 'clearStrokes')".
   * The gate was breaking the app it was measuring. `<Toaster … closeButton />`
   * is already on, so there is a real control to press. */
  const dismissAll = async () => {
    for (let i = 0; i < 8; i++) {
      const btn = await p.$("[data-sonner-toast] [data-close-button]")
      if (!btn) break
      await btn.click().catch(() => {})
      await p.waitForTimeout(140)
    }
    await p.waitForTimeout(260)
  }
  const drive = async (name, fn, expect) => {
    await dismissAll()
    await p.waitForFunction(() => !!window.__styleHarness, null, { timeout: 8000 })
    await fn()
    const found = await p
      .waitForSelector(`[data-sonner-toast]:has-text("${expect}")`, { timeout: 6000 })
      .then(() => true)
      .catch(() => false)
    await p.waitForTimeout(450)
    const c = await collisions(name)
    cases.push({ name, found, hits: c.hits })
    if (found) writeFileSync(join(OUT, `toast-${name.replace(/[^a-z0-9]+/gi, "-")}.png`), await p.screenshot())
  }

  /* THESE TWO NEED A DOCUMENT WITH NO HISTORY, and the first version did not
   * give them one: §3's own setup calls `clearStrokes()`, which is an `edit()`
   * and therefore a real undo entry, so ⌘Z had something to reach and correctly
   * stayed silent. Draining the stack instead of reloading would be worse —
   * every undo pushes a REDO, so the redo case would then be unreachable too.
   * A reload is the only state with both stacks genuinely empty (history is
   * in-memory by design — see lib/doc-store.ts). */
  await p.reload({ waitUntil: "networkidle" })
  await p.waitForFunction(() => !!window.__styleHarness)
  await p.waitForTimeout(600)
  const stacks = await p.evaluate(() => window.__styleHarness.undoInfo())
  ok(!stacks.canUndo && !stacks.canRedo, `fresh document has both stacks empty (canUndo=${stacks.canUndo} canRedo=${stacks.canRedo})`)

  await drive("nothing-to-redo", async () => {
    await p.keyboard.press("Meta+Shift+z")
  }, "Nothing to redo")

  await drive("nothing-to-undo", async () => {
    await p.keyboard.press("Meta+z")
  }, "Nothing to undo")

  await drive("canvas-cleared", async () => {
    await p.evaluate(() => window.__styleHarness.injectStrokes([[{ x: 200, y: 300 }, { x: 400, y: 380 }, { x: 520, y: 300 }]], {}))
    await p.waitForTimeout(400)
    await p.evaluate(() => window.__styleHarness.clearCanvas())
  }, "Canvas cleared")

  /* ⚠ THIS STATE LOST ITS LAST NATURAL TRIGGER — 2026-08-03, and the fix is the
   * repo's own dev-law shape rather than deleting the row.
   *
   * It used to fire by selecting `videoPreviewExport`, the last view preset with
   * a blocker. That blocker closed when `applyViewPresetById` got its
   * `target === "video"` branch, so the same call now frames a camera and starts
   * a multi-second render — it would film the wrong state AND write a file into
   * a shell-state sweep.
   *
   * The refusal path itself is unchanged and still shipping: it is what a member
   * that outruns the app gets, and `viewPresetBlockers` is deliberately kept for
   * that. `window.__fsViewBlocker` injects a SYNTHETIC blocker for one named id
   * (lib/style-system.ts, non-production only, inert unless set) so the toast and
   * the greyed pill stay reachable and filmable. Cleared straight after, because
   * a law left on would make every later row in this file grade a rigged app. */
  await drive("view-preset-refused", async () => {
    await p.evaluate(() => {
      window.__fsViewBlocker = "topDownMark"
    })
    await p.evaluate(() => window.__styleHarness.selectViewPreset("topDownMark"))
  }, "not buildable yet")
  await p.evaluate(() => {
    delete window.__fsViewBlocker
  })

  await drive("view-preset-nothing-to-frame", async () => {
    await p.evaluate(() => window.__styleHarness.clearStrokes())
    await p.waitForTimeout(500)
    await p.evaluate(() => window.__styleHarness.selectViewPreset("portfolioSpin"))
  }, "Nothing to frame")

  /* THE QUOTA PATH, DRIVEN BY A REAL FULL ORIGIN. `writeVersioned`'s only
   * quota signal is `setItem` throwing (lib/storage.ts:409), so the origin has
   * to be genuinely full — nothing is mocked. The ballast is written until the
   * browser refuses it, and that refusal count is asserted, because a fill that
   * quietly succeeded would make the row below a green one that cannot fail. */
  const ballast = await p.evaluate(() => window.__styleHarness.fillStorage())
  const full = await p.evaluate(() => {
    try {
      window.localStorage.setItem("__fsProbeFull", "x".repeat(256 * 1024))
      window.localStorage.removeItem("__fsProbeFull")
      return false
    } catch {
      return true
    }
  })
  ok(full, `the origin is actually full after ${ballast} ballast chunks — the quota branch is reachable`)
  await drive("storage-quota", async () => {
    await p.evaluate(() => {
      const big = []
      for (let i = 0; i < 6000; i++) big.push({ x: 100 + (i % 400), y: 200 + ((i * 7) % 300) })
      window.__styleHarness.injectStrokes([big], {})
    })
  }, "too large to save")
  await p.evaluate(() => window.__styleHarness.dropBallast())

  for (const c of cases) {
    ok(c.found, `toast raised: ${c.name}`)
    ok(c.hits.length === 0, `no control is covered while "${c.name}" is up${c.hits.length ? ` — COVERED: ${c.hits.join(", ")}` : ""}`)
  }
  await p.close()
}

await b.close()
console.log(`\n${pass} pass · ${fail} fail`)
console.log(`frames in ${OUT}`)
if (fail) process.exit(1)

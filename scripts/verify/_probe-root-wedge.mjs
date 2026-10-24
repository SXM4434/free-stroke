#!/usr/bin/env node
/**
 * WHAT STATE IS THE REACT ROOT ACTUALLY IN AFTER THE CRASH LAW FIRES?
 *
 * `components/viewport-error-boundary.tsx`'s `rebuild()` doc, and
 * `HANDOFF-2026-08-02.md` §3.3, both say: "the React root wedges after a
 * render-phase throw ... nothing on the page can commit afterwards", proved by
 * `__styleHarness.injectStrokes` with a different point count leaving
 * `drawing-canvas.tsx:484`'s readout at its old value.
 *
 * That reproduces. THE ATTRIBUTED CAUSE DOES NOT. Two arms, one variable:
 *
 *   A · as shipped.
 *   B · identical, with `console.timeStamp` deleted BEFORE any page script runs.
 *
 * (B) is not a hack around the app — it is how you switch off React's dev-only
 * Performance Track. `supportsUserTiming` is computed once at react-dom module
 * init from `typeof console.timeStamp === "function" && typeof
 * performance.measure === "function"`, and every `logComponentRender` call sits
 * behind it. Nothing else in the app reads `console.timeStamp`. So B changes
 * exactly one thing: whether React walks a fiber's props to build a props-diff
 * for the DevTools performance timeline.
 *
 * If the wedge is caused by the render-phase throw, both arms wedge.
 * If it is caused by React reading the poisoned getter a SECOND time from its
 * own dev instrumentation, only A wedges.
 *
 * The root is read from React's own bookkeeping — `__reactContainer$…` is the
 * HostRoot fiber, `.stateNode` the FiberRoot — not inferred from the DOM.
 * `pendingLanes` that never drain is a root that cannot commit.
 *
 * Usage: node scripts/verify/_probe-root-wedge.mjs --label=<x>
 */
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const label = (process.argv.find((a) => a.startsWith("--label=")) || "--label=wedge").split("=")[1]
const OUT = join(__dirname, "..", "..", "docs", "verification", "shell-states", `probe-${label}`)
mkdirSync(OUT, { recursive: true })
const URL = LAB_URL

const b = await chromium.launch()

const mk = (n) => {
  const pts = []
  for (let i = 0; i < n; i++) { const t = i / (n - 1); pts.push({ x: 150 + t * 420, y: 330 + Math.sin(t * Math.PI * 2) * 100 }) }
  return pts
}

const READER = () => {
  window.__fsReadRoot = () => {
    const nodes = [document, document.documentElement, document.body, ...document.body.children,
      ...document.querySelectorAll("div")]
    for (const n of nodes) {
      const k = Object.keys(n).find((x) => x.startsWith("__reactContainer$"))
      if (!k) continue
      const root = n[k].stateNode
      return {
        pendingLanes: root.pendingLanes,
        suspendedLanes: root.suspendedLanes,
        expiredLanes: root.expiredLanes,
        finishedWork: root.finishedWork ? "NON-NULL" : null,
        callbackPriority: root.callbackPriority,
      }
    }
    return { notFound: true }
  }
}

async function arm(name, { killPerfTrack }) {
  console.log(`\n${"=".repeat(72)}\n  ARM ${name}\n${"=".repeat(72)}`)
  const p = await b.newPage({ viewport: { width: 1500, height: 1460 }, reducedMotion: "no-preference" })
  const t0 = Date.now()
  const pageErrs = []
  p.on("pageerror", (e) =>
    pageErrs.push({ ms: Date.now() - t0, msg: String(e).split("\n")[0].slice(0, 140), stack: String(e.stack || "") }),
  )
  const consoleErrs = []
  p.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text().split("\n")[0].slice(0, 140)) })

  if (killPerfTrack) {
    /* BEFORE any page script. react-dom snapshots this at module init. */
    await p.addInitScript(() => { delete console.timeStamp })
  }
  await p.goto(URL, { waitUntil: "networkidle" })
  await p.waitForFunction(() => window.__styleHarness)
  await p.evaluate(READER)

  const read = async (tag) => {
    const dom = await p.evaluate(() => {
      const t = document.body.innerText
      const m = t.match(/raw (\d+) pts/)
      return {
        rawPts: m ? Number(m[1]) : null,
        boundary: !![...document.querySelectorAll("p")].find((e) => e.textContent.includes("The 3D view stopped")),
        canvases: document.querySelectorAll("canvas").length,
        globalCrash: /Application error/.test(t),
      }
    })
    const root = await p.evaluate(() => window.__fsReadRoot())
    console.log(`  [${tag}]  raw=${dom.rawPts} boundary=${dom.boundary} canvases=${dom.canvases} · pendingLanes=${root.pendingLanes} finishedWork=${root.finishedWork}`)
    return { dom, root }
  }

  await p.evaluate((x) => window.__styleHarness.injectStrokes(x, { msPerPoint: 12 }), [mk(41)])
  await p.waitForTimeout(1500)
  const s1 = await read("41-pt drawing, no fault")

  await p.evaluate(() => window.__styleHarness.crashViewport(true))
  await p.waitForTimeout(1800)
  const s2 = await read("fault fired — boundary up")
  writeFileSync(join(OUT, `${name}-01-boundary.png`), await p.screenshot())

  /* THE HANDOFF'S OWN PROOF: an update that has nothing to do with the viewport.
   * The readout is drawing-canvas.tsx:484, outside the boundary entirely. */
  await p.evaluate((x) => window.__styleHarness.injectStrokes(x, { msPerPoint: 12 }), [mk(81)])
  await p.waitForTimeout(1800)
  const s3 = await read("unrelated 81-pt update")
  const commits = s3.dom.rawPts === 81

  await p.evaluate(() => window.__styleHarness.crashViewport(false))
  await p.waitForTimeout(700)
  const s4 = await read("fault cleared, button NOT pressed")

  await p.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((e) => e.textContent.includes("Rebuild the view"))
    btn?.click()
  })
  await p.waitForTimeout(3200)
  const s5 = await read("after clicking 'Rebuild the view'")
  writeFileSync(join(OUT, `${name}-02-after-rebuild.png`), await p.screenshot())

  console.log(`\n  --- page errors (${pageErrs.length}) ---`)
  for (const e of pageErrs) {
    console.log(`   ! +${e.ms}ms  ${e.msg}`)
    // The origin is stripped from stack lines for readability, and it must be
    // THIS run's origin. It was a hardcoded regex literal — which `assert-one-knob`
    // channel D cannot see, because its analyser reads string and template
    // literals only (`ts.isStringLiteral` / template), never a RegExp literal.
    // So a dev-server address written as a regex is invisible to the ratchet.
    // Reported to the controller; fixed here because the file is this lane's.
    for (const l of e.stack.split("\n").slice(1, 7)) console.log("       " + l.trim().replace(new RegExp("\\(" + LAB_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "("))
  }
  console.log(`  --- console errors (${consoleErrs.length}) ---`)
  for (const e of consoleErrs.slice(0, 6)) console.log("   ·", e)

  console.log(`\n  VERDICT ${name}:`)
  console.log(`    root commits an unrelated update while the boundary is up : ${commits ? "YES" : "NO — WEDGED"}`)
  console.log(`    "Should not already be working." thrown                   : ${pageErrs.some((e) => /Should not already be working/.test(e.msg)) ? "YES" : "no"}`)
  console.log(`    boundary gone after Rebuild                               : ${s5.dom.boundary ? "NO — still up" : "YES"}`)
  console.log(`    canvas back                                               : ${s5.dom.canvases >= 2 ? "YES" : `no (${s5.dom.canvases})`}`)
  console.log(`    drawing survived (raw pts)                                : ${s5.dom.rawPts}`)
  await p.close()
  return { name, commits, s1, s2, s3, s4, s5, pageErrs }
}

const A = await arm("A-as-shipped", { killPerfTrack: false })
const B = await arm("B-no-perf-track", { killPerfTrack: true })

/* ---------------------------------------------------------------------- *
 *  C · IS THE CARD'S RELOAD ADVICE TRUE?
 *
 *  The second-failure copy used to read "Your drawing is not saved, so copy
 *  anything you need first." `app/page.tsx` autosaves `rawStrokes` on every
 *  change (the `writeVersioned(strokesSchema, …)` effect) and restores them at
 *  boot, so this asks the browser rather than the comment.
 * ---------------------------------------------------------------------- */
console.log(`\n${"=".repeat(72)}\n  ARM C · does a drawing survive a reload?\n${"=".repeat(72)}`)
{
  const p = await b.newPage({ viewport: { width: 1500, height: 1460 }, reducedMotion: "no-preference" })
  await p.goto(URL, { waitUntil: "networkidle" })
  await p.waitForFunction(() => window.__styleHarness)
  await p.evaluate((x) => window.__styleHarness.injectStrokes(x, { msPerPoint: 12 }), [mk(57)])
  await p.waitForTimeout(1800)
  const before = await p.evaluate(() => (document.body.innerText.match(/raw (\d+) pts/) || [])[1])
  await p.reload({ waitUntil: "networkidle" })
  await p.waitForFunction(() => window.__styleHarness)
  await p.waitForTimeout(2200)
  const after = await p.evaluate(() => (document.body.innerText.match(/raw (\d+) pts/) || [])[1])
  console.log(`  raw pts before reload = ${before} · after reload = ${after}`)
  console.log(`  VERDICT: the drawing ${String(before) === String(after) && Number(after) > 0 ? "SURVIVES a reload — the 'not saved' copy is false" : "is LOST on reload — the copy is correct"}`)
  writeFileSync(join(OUT, "C-after-reload.png"), await p.screenshot())
  await p.close()
}

console.log(`\n${"=".repeat(72)}\n  ONE VARIABLE, TWO ANSWERS\n${"=".repeat(72)}`)
console.log(`  A (React dev Performance Track ON) : root commits after the throw = ${A.commits}`)
console.log(`  B (Performance Track OFF)          : root commits after the throw = ${B.commits}`)
console.log(`  frames in ${OUT}`)
await b.close()

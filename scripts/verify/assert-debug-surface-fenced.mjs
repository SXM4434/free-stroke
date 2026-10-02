// IS THE DEBUG PANEL A DEV SURFACE, OR DOES IT SHIP? — the fence, both sides.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE DEFECT
//
// `components/viewport-3d.tsx` rendered a `Debug` popup over the 3-D canvas
// with no production guard: stroke count, point count, duration, reveal mode,
// and then the whole style substrate under its INTERNAL FIELD NAMES —
// `activeMaterialPreset`, `materialAppliedToInflate`, `userMaterialOverride`.
// It was opened by a visible button in the transport row, beside Timing. Not a
// keyboard shortcut, not a window global: a button any user could click in the
// shipped build.
//
// ── WHAT MAKES IT A DEFECT RATHER THAN A PREFERENCE ────────────────────────
//
// The repo already has a stated convention and this panel was outside it.
// `app/page.tsx` guards its own dev surface with
// `if (process.env.NODE_ENV === "production") return`, and says why in the
// comment above it: *"DEV-ONLY capture harness … Guarded to non-production."*
// `components/drawing-canvas.tsx:481` fences its own on-canvas telemetry the
// same way — *"development-only telemetry; hidden in demo/production build"*.
// Two of the three dev readouts in this app were fenced. This was the third.
//
// ── AND THE DOOR IS GUARDED WITH THE ROOM ──────────────────────────────────
//
// Guarding the panel and leaving the button is the half-fix: a toggle that
// exists and opens nothing is a dial with no wire behind it (DISPATCH §2.7).
// So `showDebug` itself is false in production by construction, and the button
// that flips it is behind the same constant. There is no reachable state where
// one exists without the other.
//
// ── WHAT THIS DELIBERATELY DOES NOT TOUCH ──────────────────────────────────
//
// `window.__captureHarness`, `__revealHarness` and `__styleHarness`. A window
// API a test drives is not a panel a user sees, and every browser gate in this
// repo drives them. They were ALREADY fenced — measured by this file's §2.3,
// which reads all three as `undefined` in the production build — so nothing had
// to be done to them and nothing was.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE CONTROL, AND WHY THIS FILE HAS ONE AT ALL
//
// The first reading taken against the production build said `debugButtons: 0`
// and it was WORTHLESS: the probe had drawn nothing, so the viewport was in its
// empty state and the whole transport row — Timing, the speed pills, Debug —
// was absent for a reason that had nothing to do with the guard. A count of
// zero looked exactly like a pass.
//
// So every arm here asserts the TRANSPORT IS PRESENT first, on the same page
// load, before it is allowed to say anything about the Debug button. An arm
// that cannot see Timing cannot report on Debug.
//
// The positive control is §1: in DEV the same reader must find the button, and
// clicking it must produce the panel. A reader that returns 0 everywhere passes
// §2 and fails §1.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE PRODUCTION ARM NEEDS A PRODUCTION BUILD, AND SAYS SO WHEN IT HAS NONE
//
// `process.env.NODE_ENV` is replaced at BUILD time, so the only honest subject
// is a real `next build` output being served. This gate does not build one —
// building into `.next` would overwrite the dev server every other lane on this
// machine is driving. It takes the port of one you have already started:
//
//   # in a scratch copy of the tree, NOT this one:
//   npx next build && npx next start -p <port>
//   node scripts/verify/assert-debug-surface-fenced.mjs --prod-port=<port>
//
// Without it the production half is UNSWEPT and the run exits 3, never 0 and
// never with an all-pass summary — `assert-gate-integrity.mjs` channel G's
// known-bad is exactly "an all-pass summary, exit 0, with a skip in the output".
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — the dev subject comes from the resolver, never from a
// name this file invents. The production subject is a port the OPERATOR passes
// on argv: it is a build they made, not a server this repo runs.
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=")[1] : d
}
const PROD_PORT = arg("prod-port", "")
const LABEL = arg("label", "after")
const OUT = join(ROOT, "docs", "verification", "persist-2026-08-28", `debug-fence-${LABEL}`)
mkdirSync(OUT, { recursive: true })

let failures = 0
let rows = 0
const results = []
function say(ok, label, detail) {
  rows++
  if (!ok) failures++
  results.push({ ok, label, detail: detail ?? "" })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}
function control(sawWhatItShould, label, detail) {
  rows++
  if (!sawWhatItShould) failures++
  results.push({ ok: sawWhatItShould, label: `CONTROL · ${label}`, detail: detail ?? "" })
  console.log(
    `${sawWhatItShould ? "PASS" : "FAIL"}  CONTROL · ${label}${detail ? " — " + detail : ""}${
      sawWhatItShould ? "" : "   *** the instrument did not react as designed ***"
    }`,
  )
}
const unswept = []
const unsweptRow = (what, why, fix) => {
  unswept.push(what)
  console.log(`UNSWEPT  ${what} — ${why}. NOT A PASS AND NOT A FAILURE: nothing was measured. ${fix}`)
}

/** Open a page, draw one real stroke, and report what the transport carries.
 *  ⚠ THE STROKE IS NOT DECORATION. With an empty canvas the viewport renders
 *  its empty state and the whole transport row is absent, so "no Debug button"
 *  is true for a reason that has nothing to do with any guard. */
async function readSurface(url, shotName) {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } })
    await page.goto(url, { waitUntil: "networkidle" })
    await page.waitForTimeout(2500)
    const box = await page.locator("canvas[aria-label*='Drawing canvas']").boundingBox()
    await page.mouse.move(box.x + 80, box.y + 240)
    await page.mouse.down()
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(box.x + 80 + i * 16, box.y + 240 + Math.sin(i / 3) * 28)
      await page.waitForTimeout(6)
    }
    await page.mouse.up()
    await page.waitForTimeout(2500)

    const before = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")].map((b) => (b.textContent ?? "").trim())
      return {
        transport: !!document.querySelector("[data-animation-drawin]"), // PANEL-2: the dock's Draw-in header
        debugButtons: btns.filter((t) => t === "Debug").length,
        harnesses: {
          reveal: typeof window.__revealHarness,
          capture: typeof window.__captureHarness,
          style: typeof window.__styleHarness,
        },
        panelText: document.body.innerText.includes("activeMaterialPreset"),
      }
    })

    /* If the door is there, walk through it — a guarded panel behind an
     * unguarded button would pass a button-count check and still ship. */
    let opened = null
    if (before.debugButtons > 0) {
      await page.locator("button", { hasText: /^Debug$/ }).first().click()
      await page.waitForTimeout(400)
      opened = await page.evaluate(() => ({
        panelText: document.body.innerText.includes("activeMaterialPreset"),
        closeButton: !!document.querySelector("button[aria-label='Close debug panel']"),
      }))
    }
    try {
      await page.screenshot({ path: join(OUT, `${shotName}.png`), timeout: 60000 })
    } catch {
      console.log(`  (screenshot ${shotName} could not be taken — evidence missing, not a pass)`)
    }
    return { ...before, opened }
  } finally {
    await browser.close()
  }
}

async function reachable(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) })
    return { ok: r.status === 200, why: `HTTP ${r.status}` }
  } catch (e) {
    return { ok: false, why: String(e).slice(0, 80) }
  }
}

async function main() {
  /* ── §1 · DEV. The positive control for the whole file. ─────────────────── */
  const devReach = await reachable(LAB_URL)
  if (!devReach.ok) {
    unsweptRow(
      "§1 · DEV",
      `${LAB_URL} is not answering (${devReach.why}), so the reader was never shown a Debug button it should find`,
      "Start the dev server on the port FS_PORT names and re-run. Without this arm, §2's zero is not evidence.",
    )
  } else {
    console.log("\n=== §1 · DEV — the panel is still there, and the reader can see it ===\n")
    const dev = await readSurface(LAB_URL, "01-dev")
    control(dev.transport, "1.0   the transport row rendered, so this arm can report on what is IN it", `Timing present: ${dev.transport}`)
    control(
      dev.debugButtons === 1,
      "1.1   the reader FINDS the Debug button in development — a reader that returns 0 everywhere would fail here",
      `Debug buttons on screen: ${dev.debugButtons}`,
    )
    say(
      dev.opened?.panelText === true && dev.opened?.closeButton === true,
      "1.2   clicking it opens the real panel, style substrate and all — the dev surface still works",
      `substrate readout: ${dev.opened?.panelText} · close button: ${dev.opened?.closeButton}`,
    )
    say(
      dev.panelText === false,
      "1.3   …and it is CLOSED until clicked. The guard did not pin it open",
      `substrate readout before the click: ${dev.panelText}`,
    )
  }

  /* ── §2 · PRODUCTION. The subject the guard is actually about. ──────────── */
  if (!PROD_PORT) {
    unsweptRow(
      "§2 · PRODUCTION",
      "no --prod-port was given, so no production build was ever looked at",
      "`process.env.NODE_ENV` is replaced at BUILD time — a dev server cannot answer this. Build a scratch copy of the tree, `next start` it, and pass --prod-port=<port>.",
    )
  } else {
    const prodUrl = `http://127.0.0.1:${PROD_PORT}/`
    const prodReach = await reachable(prodUrl)
    if (!prodReach.ok) {
      unsweptRow(
        "§2 · PRODUCTION",
        `the production build at port ${PROD_PORT} is not answering (${prodReach.why})`,
        "Start it and re-run.",
      )
    } else {
      console.log("\n=== §2 · PRODUCTION — a real `next build`, served and driven ===\n")
      const prod = await readSurface(prodUrl, "02-prod")
      control(
        prod.transport,
        "2.0   the transport row rendered HERE TOO — so a zero below is about the guard and not about an empty stage",
        `Timing present: ${prod.transport}`,
      )
      say(
        prod.debugButtons === 0,
        "2.1   ⭐ NO Debug button anywhere in the production build",
        `Debug buttons on screen: ${prod.debugButtons}`,
      )
      say(
        prod.panelText === false,
        "2.2   …and no style-substrate readout on the page — the panel is not merely hidden behind a missing button",
        `"activeMaterialPreset" in the rendered text: ${prod.panelText}`,
      )
      say(
        prod.harnesses.reveal === "undefined" &&
          prod.harnesses.capture === "undefined" &&
          prod.harnesses.style === "undefined",
        "2.3   the three window harnesses were ALREADY fenced and still are — this change did not touch them",
        `__revealHarness=${prod.harnesses.reveal} __captureHarness=${prod.harnesses.capture} __styleHarness=${prod.harnesses.style}`,
      )
    }
  }

  writeFileSync(
    join(OUT, "report.json"),
    JSON.stringify({ rows, failures, unswept, complete: unswept.length === 0, results }, null, 2),
  )
  if (failures > 0) {
    console.log(`\n${failures} of ${rows} FAILED.`)
    console.log(`wrote ${join(OUT, "report.json")}`)
    process.exit(1)
  }
  if (unswept.length) {
    console.log(
      `\nPARTIAL — ${rows} row(s) passed and ${unswept.length} channel(s) were NEVER REACHED: ${unswept.join(", ")}.` +
        `\nExiting 3, not 0. A SKIP IS NOT A PASS (DISPATCH §3:116).`,
    )
    console.log(`wrote ${join(OUT, "report.json")}`)
    process.exit(3)
  }
  console.log(`\nALL ${rows} DEBUG-FENCE ASSERTIONS PASS (controls included), dev and production both swept.`)
  console.log(`wrote ${join(OUT, "report.json")}`)
  process.exit(0)
}

main().catch((e) => {
  console.log(`FAIL  the run itself crashed after ${rows} row(s) had already printed — ${String(e).slice(0, 300)}`)
  console.log(`      Those ${rows} row(s) are NOT a verdict on this run: it did not finish.`)
  try {
    writeFileSync(
      join(OUT, "report.json"),
      JSON.stringify({ rows, failures, unswept, complete: false, crashed: String(e).slice(0, 300), results }, null, 2),
    )
  } catch {}
  process.exit(1)
})

// _PROBE-PENTIP-SHAPE — CAPTURE HALF of the tip-shape sweep.
//
// ── WHY THIS EXISTS AND WHY IT IS NOT `_probe-pentip-sweep.mjs` ─────────────
// That probe sweeps the four NAMED shapes. This one sweeps the two NUMBERS
// behind them, because the named shapes are four points on a continuum and the
// gap this lane has to close is a distance along it:
//
//     assert-drawin-pentip, docs/verification/pentip/fix-base
//       free-stroke (quill)  0.7720 w   pen score 2.434
//       desk-doodles         1.6884 w   pen score 5.796
//
// The shader's boundary is `u = nose*R*sqrt(1-r^2) - taper*R*r` with r = rho/R,
// so `f = r` exactly and the gate's own f = 0.75 -> 0.25 span is
//
//     span  =  nose * 0.3068  +  taper * 0.5      (half-widths)
//
// which predicts `nib` at 0.3068 (measured 0.3036) and `quill` at 0.7318
// (measured 0.7720). The prediction is therefore usable to CHOOSE a taper, and
// this probe is what checks the choice against the real renderer rather than
// against the algebra.
//
// ── EVERY ARM IN ONE PAGE SESSION, WITH ONE NUMBER MOVING ──────────────────
// `setPenTipShape` writes two uniforms and the drawRange margin; nothing
// rebakes, nothing recompiles. So all arms share one build, one engine switch
// and one wall clock — explainer 20 §2, *"a ratio between two numbers taken in
// different sessions is not a measurement."* Each arm's shape is READ BACK off
// the page before a frame is taken, so an arm that did not take cannot be
// scored as one.
//
// ── THE SPECK CONTROL IS AN ARM, NOT A SEPARATE RUN ────────────────────────
// The reason `quill` shipped at 0.85 instead of 1.6 is that the long taper
// "came apart into loose specks". `PEN_TIP_AA_FWIDTH` says that was the
// coverage ramp being divided by the wrong gradient. So the sweep carries the
// SAME long taper twice — once with each divisor — and `assert-pentip-specks`
// requires the parked divisor to break and the fixed one not to.
//
// Writes `docs/verification/pentip/<label>/` in EXACTLY the layout
// `assert-drawin-pentip.mjs` reads, so the ruler that judges the shipped tip is
// the ruler that judges these, with no second implementation to drift.
//
// Usage: node scripts/verify/_probe-pentip-shape.mjs --label=tipshape-sweep [--samples=201]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "tipshape-sweep")
const SAMPLES = parseInt(arg("samples", "201"), 10)
const DSF = parseFloat(arg("dsf", "2"))
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/pentip/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 8317 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "pentip", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
// >= 1440 x 1440 per the standing rule.
const VIEW = { width: 1600, height: 1600 }

/**
 * THE ARMS.
 *
 * `free-stroke` and `free-stroke-off` keep those exact names because
 * `assert-drawin-pentip.mjs` builds its known-bad inputs and its parked-prior
 * rows off them. `free-stroke` here is the SHIPPED quill, so the sweep carries
 * its own before-arm and the deltas are read inside one capture.
 *
 * The taper ladder brackets the solved value rather than landing on it: a
 * single arm at the prediction cannot show whether the prediction has the right
 * SLOPE, and slope is what makes it a model instead of a coincidence.
 */
const ARMS = [
  { key: "free-stroke", engine: "free-stroke", tip: "quill", shape: null, aa: true },
  { key: "free-stroke-off", engine: "free-stroke", tip: "off", shape: null, aa: true },
  /* THE SHAPE THAT SHIPPED ON 2026-08-02, taken through its own NAME rather
   * than through a shape override — so the do-not-regress reference is the
   * parked prior as the renderer will actually produce it, not a probe's
   * reconstruction of it. `PEN_TIP_SHAPES.chisel`. */
  { key: "chisel", engine: "free-stroke", tip: "chisel", shape: null, aa: true },
  /* THE ONE THAT WAS REJECTED. Same number, on the fixed divisor. */
  { key: "t160", engine: "free-stroke", tip: "quill", shape: { nose: 1, taper: 1.6 }, aa: true },
  { key: "t240", engine: "free-stroke", tip: "quill", shape: { nose: 1, taper: 2.4 }, aa: true },
  { key: "t275", engine: "free-stroke", tip: "quill", shape: { nose: 1, taper: 2.75 }, aa: true },
  { key: "t310", engine: "free-stroke", tip: "quill", shape: { nose: 1, taper: 3.1 }, aa: true },
  /* THE SPECK CONTROL: the taper that ships, on the DIVISOR THAT SHIPPED
   * BEFORE. This is the arm that has to come apart. */
  {
    key: "t275-aaprior",
    engine: "free-stroke",
    tip: "quill",
    shape: { nose: 1, taper: 2.75 },
    aa: false,
  },
  /* AND THE ONE WITH THE REJECTED TAPER ON THE REJECTING DIVISOR — the exact
   * arm the 2026-08-02 note was written about, so the note is re-rendered
   * rather than quoted. */
  {
    key: "t160-aaprior",
    engine: "free-stroke",
    tip: "quill",
    shape: { nose: 1, taper: 1.6 },
    aa: false,
  },
  { key: "desk-doodles", engine: "desk-doodles", tip: "quill", shape: null, aa: true },
]

/**
 * `--only=a,b,c` narrows the arm list. It exists for ONE reason and it is not
 * convenience: the speck claim this sweep re-examines was made at
 * deviceScaleFactor **1** — *"a mark thirteen screen pixels wide"*, and the
 * areal half-width the gate reads off this capture at dsf 2 is 12.53 px, i.e.
 * 25 px across, so the dsf-2 run is answering a question about a mark twice the
 * width of the one the claim was about. A sub-pixel coverage ramp is only
 * sub-pixel at the raster it was measured on. So the AA pair is re-run at dsf 1
 * with the arms that bear on it and nothing else.
 *
 * An unknown name is REFUSED rather than ignored — a filter that silently
 * matches nothing captures zero arms and reports the run clean.
 */
const ONLY = arg("only", null)
const SELECTED = ONLY
  ? ONLY.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null
if (SELECTED) {
  const known = new Set(ARMS.map((a) => a.key))
  const bad = SELECTED.filter((s) => !known.has(s))
  if (bad.length) {
    console.error(`--only names arms that do not exist: ${bad.join(", ")}`)
    console.error(`known arms: ${[...known].join(", ")}`)
    process.exit(2)
  }
}
const RUN_ARMS = SELECTED ? ARMS.filter((a) => SELECTED.includes(a.key)) : ARMS

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  EV.open()

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(2000)

  await page.click(`[data-register-option="desk-doodles"]`)
  await page.waitForTimeout(400)

  /* HIS STATE, ASSERTED OFF THE DOM. Same reader as `_probe-pentip-sweep.mjs`,
   * because an arm captured under a different wobble is not comparable to the
   * baseline this sweep is measured against. */
  const state = await page.evaluate(() => {
    const txt = (el) => (el?.textContent ?? "").trim()
    let wobble = null
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      const t = (row?.textContent ?? "").toLowerCase()
      if (t.includes("wobble")) {
        wobble = Number(inp.value)
        break
      }
    }
    const LABELS = { clean: "clean", protrude: "protrude", long: "long-overshoot", kink: "kink" }
    let endpoint = null
    for (const b of [...document.querySelectorAll("button")].filter((b) =>
      LABELS[txt(b).toLowerCase()],
    )) {
      const bg = getComputedStyle(b).backgroundColor
      if (!(bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) endpoint = LABELS[txt(b).toLowerCase()]
    }
    return {
      wobble,
      endpoint,
      tip: window.__captureHarness.penTip?.() ?? null,
      hasShapeApi: typeof window.__captureHarness.setPenTipShape === "function",
      hasAaApi: typeof window.__captureHarness.setTipAA === "function",
    }
  })
  console.log("live state:", JSON.stringify(state))
  say(state.wobble === 0.4, "wobble is 0.40 — his setting", String(state.wobble))
  say(state.endpoint === "protrude", "endpoint is PROTRUDE — his setting", String(state.endpoint))
  say(state.hasShapeApi, "the page exposes setPenTipShape", String(state.hasShapeApi))
  say(state.hasAaApi, "the page exposes setTipAA", String(state.hasAaApi))

  /* THE OVERRIDE MUST BE ABLE TO REFUSE. A setter that accepts anything cannot
   * stop a sweep capturing one arm under two labels — the exact failure
   * `setPenTipMode`'s own boolean return exists for. */
  const refuses = await page.evaluate(() => {
    const h = window.__captureHarness
    const bad = [
      h.setPenTipShape({ nose: Number.NaN, taper: 1 }),
      h.setPenTipShape({ nose: 1, taper: -1 }),
      h.setPenTipShape({ nose: 1, taper: Number.POSITIVE_INFINITY }),
    ]
    h.setPenTipShape(null)
    return bad
  })
  say(
    refuses.every((r) => r === false),
    "setPenTipShape REFUSES a shape that is not two finite non-negative numbers",
    JSON.stringify(refuses),
  )

  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
  )
  console.log(`draw phase: at ${span.at.toFixed(3)}s, ${span.duration.toFixed(3)}s long`)

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    )
    await page.waitForTimeout(120)
  }

  const meta = { span, samples: SAMPLES, view: VIEW, dsf: DSF, shippedTip: state.tip, engines: {} }
  const shapes = {}

  for (const armSpec of RUN_ARMS) {
    await page.click(`[data-engine-option="${armSpec.engine}"]`)
    await page.waitForTimeout(3000)
    const fam = await page.evaluate(() =>
      document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family"),
    )
    say(fam === armSpec.engine, `${armSpec.key} — the engine pill actually switched`, String(fam))

    const okTip = await page.evaluate((m) => window.__captureHarness.setPenTip(m), armSpec.tip)
    const okShape = await page.evaluate(
      (s) => window.__captureHarness.setPenTipShape(s),
      armSpec.shape,
    )
    const okAa = await page.evaluate((a) => window.__captureHarness.setTipAA(a), armSpec.aa)
    await page.waitForTimeout(150)

    /* READ BACK WHAT THE RENDERER WILL USE, not what was asked for. */
    const got = await page.evaluate(() => ({
      tip: window.__captureHarness.penTip(),
      shape: window.__captureHarness.penTipShape(),
      override: window.__captureHarness.penTipShapeOverride(),
      aa: window.__captureHarness.tipAA(),
    }))
    const wantShape = armSpec.shape ?? null
    const shapeTook =
      wantShape === null
        ? got.override === null
        : got.override !== null &&
          Math.abs(got.override.nose - wantShape.nose) < 1e-9 &&
          Math.abs(got.override.taper - wantShape.taper) < 1e-9
    say(
      okTip === true && got.tip === armSpec.tip,
      `${armSpec.key} — the tip MODE actually took`,
      String(got.tip),
    )
    say(
      okShape === true && shapeTook,
      `${armSpec.key} — the tip SHAPE actually took`,
      JSON.stringify(got.shape),
    )
    say(okAa === true && got.aa === armSpec.aa, `${armSpec.key} — the AA divisor actually took`, String(got.aa))
    shapes[armSpec.key] = { asked: armSpec, live: got }

    const dir = join(OUT, armSpec.key)
    mkdirSync(dir, { recursive: true })
    const reveals = []
    for (let k = 0; k < SAMPLES; k++) {
      const t = span.at + (span.duration * k) / (SAMPLES - 1)
      await seek(t)
      const phase = await page.evaluate(() => {
        const el = document.querySelector("[data-hero-phase]")
        return {
          phase: el?.getAttribute("data-hero-phase"),
          t: Number(el?.getAttribute("data-hero-phase-t")),
        }
      })
      reveals.push({ k, t, phase: phase.phase, phaseT: phase.t, tip: armSpec.tip })
      const buf = await page.locator("[data-hero-stage]").screenshot()
      writeFileSync(join(dir, `${String(k).padStart(3, "0")}.png`), buf)
    }
    meta.engines[armSpec.key] = reveals
    console.log(`  captured ${armSpec.key}: ${SAMPLES} frames`)
  }

  /* LEAVE THE PAGE AS IT WAS FOUND. A probe that walks away with an override
   * live would poison the next lane's capture on the shared dev server. */
  await page.evaluate(() => {
    window.__captureHarness.setPenTipShape(null)
    window.__captureHarness.setTipAA(true)
  })

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  meta.shapes = shapes
  writeFileSync(join(OUT, "meta.json"), JSON.stringify(meta, null, 2))
  writeFileSync(join(OUT, "shapes.json"), JSON.stringify(shapes, null, 2))
  await context.close()
  await browser.close()

  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\nframes: ${FINAL}`)
  console.log(pass ? "\nCAPTURE CLEAN" : "\nCAPTURE PROBLEMS ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

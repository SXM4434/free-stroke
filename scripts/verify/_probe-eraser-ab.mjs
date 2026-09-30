// _PROBE-ERASER-AB — his two screenshots, reproduced, with the fix on and off.
//
// Sebs, 2026-08-02, twice:
//   *"THE 2D DRAWIN ANIMTION LEAVES BLANCK SPORTS"* — /desk-doodles, DRAW 80 %,
//   ENGINE DESK DOODLES, wobble 0, endpoint CLEAN
//   and then, at BREATH 83 % with the draw already COMPLETE, ENGINE FREE
//   STROKE: *"random white blank spots… like someone ran a eraser all over it."*
//
// Both arms are the SAME build, the SAME frame and the SAME field. The only
// difference is `setFieldRealloc` — see the block of that name in
// components/viewport-3d.tsx. The dial has to be thrown BEFORE the dials move,
// because the defect is a second upload into an allocation sized by the first.
//
// ⚠ THE DIALS ARE THE TRIGGER, and that is why the gate battery never saw this.
// `_probe-field-alloc.mjs` measures it: a plain load and a full play leave the
// GL storage at 1192x324 with a 1192x324 field in it — no mismatch. Move the
// wobble slider and the field becomes 1185x324; set endpoint CLEAN and it
// becomes 1152x294. The allocation never moves. Sebs's reported state is wobble
// 0 + endpoint CLEAN, i.e. both dials off their defaults.
//
// Usage: node scripts/verify/_probe-eraser-ab.mjs --label=x --realloc=on|off
//        [--engine=desk-doodles|free-stroke]
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
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "ab")
const ENGINE = arg("engine", "desk-doodles")
const REALLOC = arg("realloc", "on")
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/drawin-holes/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 618 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "drawin-holes", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const VIEW = { width: 1600, height: 1600 }

let pass = true
const say = (ok, l, d) => { if (!ok) pass = false; console.log(`${ok ? "PASS" : "FAIL"}  ${l}${d ? " — " + d : ""}`) }

async function main() {
  EV.open()
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => !!window.__captureHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)

  const want = REALLOC !== "off"
  await page.evaluate((v) => window.__captureHarness.setFieldRealloc(v), want)
  say((await page.evaluate(() => window.__captureHarness.fieldRealloc())) === want,
    `the realloc arm (${want ? "FIXED" : "PRIOR"}) took`, String(want))

  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(3500)
  await page.waitForFunction(() => !!window.__captureHarness, null, { timeout: 60000 })
  await page.evaluate(() => {
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      if (((row?.textContent ?? "").toLowerCase()).includes("wobble")) {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        s.call(inp, "0")
        inp.dispatchEvent(new Event("input", { bubbles: true }))
        inp.dispatchEvent(new Event("change", { bubbles: true }))
        break
      }
    }
  })
  await page.waitForTimeout(2200)
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button"))
      if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); break }
  })
  await page.waitForTimeout(2500)

  const st = await page.evaluate(() => {
    let wobble = null
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      if (((row?.textContent ?? "").toLowerCase()).includes("wobble")) { wobble = Number(inp.value); break }
    }
    const L = { clean: "clean", protrude: "protrude", long: "long-overshoot", kink: "kink" }
    let endpoint = null
    for (const b of document.querySelectorAll("button")) {
      const k = L[(b.textContent ?? "").trim().toLowerCase()]
      if (!k) continue
      const bg = getComputedStyle(b).backgroundColor
      if (!(bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) endpoint = k
    }
    return { wobble, endpoint, engineFamily: document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family") ?? null }
  })
  say(st.engineFamily === ENGINE, `engine is ${ENGINE}`, String(st.engineFamily))
  say(st.wobble === 0, "wobble is 0 — his setting", String(st.wobble))
  say(st.endpoint === "clean", "endpoint is CLEAN — his setting", String(st.endpoint))

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      s.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(300)
  }
  const phase = () => page.evaluate(() => {
    const el = document.querySelector("[data-hero-phase]")
    return { phase: el?.getAttribute("data-hero-phase"), t: Number(el?.getAttribute("data-hero-phase-t")), carve: Number(el?.getAttribute("data-hero-carve")) }
  })

  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")))
  const dur = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))

  const shots = []
  // HIS FIRST FRAME: DRAW 80 %.
  await seek(span.at + span.duration * 0.8)
  let ph = await phase()
  say(ph.phase === "draw" && Math.abs(ph.t - 0.8) < 0.03, "DRAW 80 % — his first frame", `${ph.phase} ${(ph.t * 100).toFixed(1)}%`)
  writeFileSync(join(OUT, "draw80.png"), await page.locator("[data-hero-stage]").screenshot())
  shots.push({ name: "draw80", ...ph })

  // HIS SECOND FRAME: BREATH, the draw already complete. Scanned, never hardcoded.
  const hits = []
  for (let k = 0; k <= 96; k++) {
    const t = (dur * k) / 96
    await seek(t)
    const nm = await page.evaluate(() => document.querySelector("[data-hero-phase]")?.getAttribute("data-hero-phase"))
    if (String(nm).toLowerCase().includes("breath")) hits.push(t)
  }
  const T = hits[0] + (hits[hits.length - 1] - hits[0]) * 0.83
  await seek(T)
  ph = await phase()
  say(String(ph.phase).includes("breath"), "BREATH — his second frame", `${ph.phase} ${(ph.t * 100).toFixed(1)}%`)
  say(ph.carve > 0.5, "the carve is ON at BREATH", String(ph.carve))
  writeFileSync(join(OUT, "breath.png"), await page.locator("[data-hero-stage]").screenshot())
  shots.push({ name: "breath", ...ph })

  const g = await page.evaluate(() => window.__heroPenField)
  console.log(`field ${g.width}x${g.height}  GL ${g.texW}x${g.texH}  realloc=${g.fieldRealloc}  envelopeR=${g.envelopeR}`)
  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  writeFileSync(join(OUT, "meta.json"), JSON.stringify({ st, shots, field: g, realloc: REALLOC }, null, 2))
  await context.close()
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`frames: ${FINAL}`)
  process.exit(pass ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })

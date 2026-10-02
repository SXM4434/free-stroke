// _PROBE-DRAWIN-HOLES — reproduce HIS state and photograph the blank spots.
//
// Sebs, 2026-08-02, with a screenshot of `/desk-doodles` at DRAW 80 %:
//   *"THE 2D DRAWIN ANIMTION LEAVES BLANCK SPORTS AND STILL DOES THE SAME
//    STUPID SWEEP REVEAL AS IF ITS REVERSE ERASING"*
//
// His state, and every one of the four is ASSERTED off the live DOM rather than
// assumed, because all four are page state a sibling lane could move:
//   engine   DESK DOODLES        wobble 0        endpoint CLEAN     DRAW 80 %
//
// This is the CAPTURE half and it is OFAT. One arm per suspect, each differing
// from `shipped` by exactly one channel, so a difference in the frames can be
// attributed. `_probe-drawin-holes-read.mjs` does the crops and the arithmetic.
//
// Usage: node scripts/verify/_probe-drawin-holes.mjs [--label=run] [--pct=80]
import { chromium } from "playwright-core"
import { mkdirSync, writeFileSync, existsSync, readdirSync, renameSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"
const require = createRequire(import.meta.url)
let FFMPEG = require("ffmpeg-static")
if (!FFMPEG || !existsSync(FFMPEG)) FFMPEG = "ffmpeg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const PCT = parseFloat(arg("pct", "80")) / 100
const ENGINE = arg("engine", "desk-doodles")
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
// >= 1440 x 1440 per the standing rule: shorter lets the timeline dock squeeze
// the stage and CLIP the mark.
const VIEW = { width: 1600, height: 1600 }

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  EV.open()

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    // LOAD-BEARING (docs/DISPATCH.md §3): without it Chrome falls back to
    // SwiftShader, which silently pauses the rAF loop.
    args: ["--use-angle=metal"],
  })
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: VIEW },
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(2500)

  /* ---- HIS STATE ------------------------------------------------------- */
  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(3500)

  // wobble -> 0, driven through the real range input the panel renders.
  await page.evaluate(() => {
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      const t = (row?.textContent ?? "").toLowerCase()
      if (t.includes("wobble")) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        setter.call(inp, "0")
        inp.dispatchEvent(new Event("input", { bubbles: true }))
        inp.dispatchEvent(new Event("change", { bubbles: true }))
        break
      }
    }
  })
  await page.waitForTimeout(2500)

  // endpoint -> clean
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); break }
    }
  })
  await page.waitForTimeout(2500)

  const state = await page.evaluate(() => {
    let wobble = null
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      const t = (row?.textContent ?? "").toLowerCase()
      if (t.includes("wobble")) { wobble = Number(inp.value); break }
    }
    const LABELS = { clean: "clean", protrude: "protrude", long: "long-overshoot", kink: "kink" }
    let endpoint = null
    for (const b of document.querySelectorAll("button")) {
      const key = LABELS[(b.textContent ?? "").trim().toLowerCase()]
      if (!key) continue
      const bg = getComputedStyle(b).backgroundColor
      if (!(bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) endpoint = key
    }
    return {
      wobble,
      endpoint,
      engineFamily: document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family") ?? null,
      penTip: window.__captureHarness?.penTip?.() ?? null,
    }
  })
  console.log("live state:", JSON.stringify(state))
  say(state.engineFamily === ENGINE, `engine is ${ENGINE} — his setting`, String(state.engineFamily))
  say(state.wobble === 0, "wobble is 0 — his setting", String(state.wobble))
  say(state.endpoint === "clean", "endpoint is CLEAN — his setting", String(state.endpoint))

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
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(220)
  }

  const readPhase = () =>
    page.evaluate(() => {
      const el = document.querySelector("[data-hero-phase]")
      return {
        phase: el?.getAttribute("data-hero-phase"),
        phaseT: Number(el?.getAttribute("data-hero-phase-t")),
        carve: Number(el?.getAttribute("data-hero-carve")),
        carveLaw: el?.getAttribute("data-hero-carve-law"),
      }
    })

  const T = span.at + span.duration * PCT
  await seek(T)
  const ph = await readPhase()
  say(ph.phase === "draw", `the playhead is INSIDE the draw phase`, `${ph.phase} ${(ph.phaseT * 100).toFixed(1)}%`)
  say(Math.abs(ph.phaseT - PCT) < 0.03, `phaseT is ${(PCT * 100).toFixed(0)} % — his frame`, ph.phaseT.toFixed(3))
  console.log(`published penCarve at this frame: ${ph.carve} (law ${ph.carveLaw})`)

  /* WHAT THE PAGE PUBLISHES ABOUT ITS OWN FIELDS, so the arms below can be
   * attributed to something rather than guessed at. */
  const globals = await page.evaluate(() => {
    const w = window
    const pick = (o, keys) => {
      if (!o) return null
      const out = {}
      for (const k of keys) if (k in o) out[k] = o[k]
      return out
    }
    /* 🔴 A CENSUS OF AN OBJECT WHOSE KEY NAMES WERE GUESSED — fixed 2026-08-07.
     *
     * This read `pick(w.__heroJunctions, ["inkWidth", "count", "total"])`.
     * `__heroJunctions` has FIVE keys and neither `count` nor `total` is one of
     * them: it is written at `app/desk-doodles/page.tsx:1753` as
     * `{ inkWidth, breakK, law, carve, list }`. `pick` guards with `if (k in o)`,
     * so the two invented names could not throw — they were simply ABSENT from
     * every `globals.json` this probe has ever written, silently, and nothing
     * downstream could tell a key that was missing from a key that was zero.
     *
     * The number that was lost is the one that ATTRIBUTES the joint-break arm:
     * `list.length` is how many junctions existed to be opened, and a 0-pixel
     * joint-break frame means something different at 7 junctions than at 2.
     * The arm below has been unable to explain itself for as long as it has
     * existed, for want of a key name. Published now, beside the arm that needs
     * it, with `law` and `carve` — which the page publishes precisely so a
     * reader never has to infer which arm ran. */
    return {
      penField: w.__heroPenField ?? null,
      junctions: pick(w.__heroJunctions, ["inkWidth", "breakK", "law", "carve"]),
      junctionCount: w.__heroJunctions?.list?.length ?? null,
      breaks: w.__heroBreaks ?? null,
      inflate: w.__inflateDebug ?? null,
      penTip: w.__captureHarness?.penTip?.() ?? null,
    }
  })
  writeFileSync(join(OUT, "globals.json"), JSON.stringify(globals, null, 2))
  console.log("globals:", JSON.stringify(globals).slice(0, 700))

  const shot = async (name) => {
    const buf = await page.locator("[data-hero-stage]").screenshot()
    writeFileSync(join(OUT, `${name}.png`), buf)
  }

  /* ---- THE BEFORE/AFTER, FROM ONE BUILD ---------------------------------
   * Both arms are the SAME page, the SAME frame and the SAME field — only the
   * carve's envelope moves (`PEN_CARVE_ENVELOPE_R` in components/viewport-3d.tsx).
   * That is what makes the pair attributable: a "before" captured from an older
   * build differs by everything that changed since, and this lane has already
   * watched a defaulted `--label=` judge a capture 3.8 days stale. */
  const envArm = async (r, name) => {
    const ok = await page.evaluate((rr) => window.__captureHarness.setCarveEnvelope(rr), r)
    if (!ok) { console.error(`setCarveEnvelope(${r}) refused`); process.exit(1) }
    await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))))
    await page.waitForTimeout(320)
    const live = await page.evaluate(() => window.__captureHarness.carveEnvelope())
    say(Math.abs(live - r) < 1e-9, `the envelope arm ${r} actually TOOK`, String(live))
    await shot(name)
  }
  await envArm(1.35, "env-prior")
  await envArm(2.6, "env-fixed")

  /* ---- THE ARMS. OFAT: each differs from `shipped` by ONE channel. ------
   *
   * EVERY ARM READS WHAT THE DRIVER RETURNED. `setFlatten` and `setPenTip` both
   * refuse bad input and say so, and until 2026-08-07 the first of them returned
   * `true` for anything — which is how `{flat: 0}`, a key that is not on
   * `FlatState`, became a published verdict about a path it never touched
   * (explainer 24 §8). An arm that never reached the render and an arm that
   * reached it and changed nothing produce the SAME PICTURE, and only the
   * boolean separates them, so the boolean is part of the reading now.
   * `scripts/verify/assert-arm-took.mjs` is the channel that keeps it that way. */
  const setFlat = async (o) => {
    const took = await page.evaluate((oo) => window.__captureHarness.setFlatten(oo), o)
    if (o !== null) say(took === true, `the arm ${JSON.stringify(o)} actually TOOK`, `setFlatten returned ${took}`)
    return took
  }
  const setTip = async (m) => {
    const took = await page.evaluate((mm) => window.__captureHarness.setPenTip(mm), m)
    say(took === true, `the pen-tip arm "${m}" actually TOOK`, `setPenTip returned ${took}`)
    return took
  }
  /* THE TEARDOWN RESTORES WHAT WAS THERE, NOT A NAMED GUESS. This block used to
   * end `setTip("quill")` — a value that is correct only while `quill` is what
   * shipped. A teardown that names a value instead of restoring one silently
   * changes the surface for every arm after it, which is not OFAT any more; the
   * same defect is recorded in `_probe-lane3-blank-tail.mjs`, where four arms
   * ran off a restored-to `"reed"`. Read it first, put it back after. */
  const tipBefore = await page.evaluate(() => window.__captureHarness.penTip())

  await shot("shipped")

  await setFlat({ penCarve: 0 })
  await page.waitForTimeout(320)
  await shot("carve0")

  /* ---- THE JOINT-BREAK ARM · WHAT THIS FRAME IS AND IS NOT EVIDENCE OF ----
   *
   * 🔴 RESTATED 2026-08-07, and NOT re-posed — the pose is not the reason.
   *
   * Explainer 39 §3.2 lists this line as one of two arms in the `INERT HERE`
   * class, on the reading that `jointBreak` is 0 px in both directions at
   * DRAW 80 % and 96 % and live (437 px) on the settled frame. The obvious
   * repair is therefore "move the arm to a playhead where the junctions exist."
   * MEASURED ON THIS PROBE'S OWN SURFACE, that repair does not work:
   *
   *     pose                          jointBreak 0   jointBreak 1   pair
   *     DRAW 80 % (`:163`, this one)             0              0      0
   *     DRAW 96 %                                0              0      0
   *     the FIRST breath frame                   0              0      0
   *     the LAST breath frame                    0              0      0
   *
   * No playhead on THIS surface makes this arm evidence, because the variable
   * that silences it is not the playhead — it is the ENDPOINT dial, and this
   * probe sets `endpoint CLEAN` deliberately, because that is Sebs's state
   * (`:9`). Isolated one dial at a time on the settled frame:
   *
   *     wobble 0.4 · endpoint protrude   7 junctions   440 px   <- Q's 437, reproduced
   *     wobble 0.4 · endpoint CLEAN      3 junctions     0 px
   *     wobble 0   · endpoint protrude   6 junctions   337 px
   *     wobble 0   · endpoint CLEAN      2 junctions     0 px   <- HIS state, and this probe's
   *
   * `clean` collapses the junction list and the channel goes silent; wobble
   * moves the pixels and never silences it. So explainer 39's law needs a fourth
   * axis beside surface, pose and camera: **a DIAL the harness does not own.**
   *
   * WHAT THIS FRAME IS: a record of the mark at DRAW 80 % with the joint break
   * off, in the state Sebs reported the defect from.
   * WHAT IT IS NOT: evidence that the joint break is not the cause of the holes.
   * It could not have come out any other way on this surface, and the positive
   * control below is what makes that statement falsifiable instead of an excuse.
   * The arm is KEPT, because a number published under a wrong claim is a claim
   * that can be corrected and a deleted arm is a finding that is lost. */
  const jTook = await setFlat({ jointBreak: 0 })
  await page.waitForTimeout(320)
  await shot("break0")
  const jCensus = await page.evaluate(() => {
    const j = window.__heroJunctions
    return { junctions: j?.list?.length ?? null, law: j?.law ?? null, carve: j?.carve ?? null }
  })
  /* THE POSITIVE CONTROL. Two independent things must both hold for the 0 to
   * mean what the row above says it means: the arm TOOK, and there were no
   * junctions for it to open. If the arm ever takes on a surface that HAS
   * junctions and still reads 0, this row goes red and the explanation above is
   * wrong — which is the only reason it is worth writing down. */
  say(jTook === true, `the joint-break arm TOOK`, `setFlatten returned ${jTook}`)
  say(
    jCensus.junctions === 0 || jCensus.junctions === null || jCensus.junctions <= 2,
    `…and the joint break is SILENT HERE FOR A STATED REASON — endpoint CLEAN leaves it almost nothing to open`,
    `${jCensus.junctions} junction(s) in __heroJunctions.list (law ${jCensus.law}, carve ${jCensus.carve}) — ` +
      `if this is large and the frame still does not move, the endpoint explanation is FALSE and this row is the one that says so`,
  )

  await setFlat(null)
  await setTip("off")
  await page.waitForTimeout(320)
  await shot("tipoff")
  await setTip(tipBefore)

  // Both together, so a partial explanation is visible as a partial one.
  await setFlat({ penCarve: 0, jointBreak: 0 })
  await page.waitForTimeout(320)
  await shot("carve0-break0")
  await setFlat(null)
  await page.waitForTimeout(320)

  // The FINISHED mark, same box, same state: what "no holes" looks like here.
  await seek(span.at + span.duration)
  await page.waitForTimeout(400)
  await shot("finished")

  // A dense scrub of the whole draw, so the thing can be WATCHED.
  const dir = join(OUT, "scrub")
  mkdirSync(dir, { recursive: true })
  const N = 41
  for (let k = 0; k < N; k++) {
    await seek(span.at + (span.duration * k) / (N - 1))
    const buf = await page.locator("[data-hero-stage]").screenshot()
    writeFileSync(join(dir, `${String(k).padStart(3, "0")}.png`), buf)
  }
  try {
    execFileSync(
      FFMPEG,
      ["-y", "-framerate", "8", "-i", join(dir, "%03d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", join(OUT, "scrub.mp4")],
      { stdio: "ignore" },
    )
  } catch (e) {
    console.warn("ffmpeg scrub failed:", e.message)
  }

  // REAL-TIME PLAY, filmed — crawl and judder do not exist in a still.
  await page.evaluate(() => {
    document.querySelectorAll("button").forEach((b) => {
      if ((b.textContent ?? "").trim().toLowerCase() === "reset") b.click()
    })
  })
  await page.waitForTimeout(800)
  await page.click("[data-hero-play]")
  await page.waitForTimeout(14000)

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  writeFileSync(
    join(OUT, "meta.json"),
    JSON.stringify({ state, span, pct: PCT, T, phase: ph, globals, view: VIEW }, null, 2),
  )
  await context.close()
  await browser.close()

  for (const f of readdirSync(OUT).filter((f) => f.endsWith(".webm"))) {
    renameSync(join(OUT, f), join(OUT, "play.webm"))
    break
  }
  try {
    if (existsSync(join(OUT, "play.webm"))) {
      execFileSync(FFMPEG, ["-y", "-i", join(OUT, "play.webm"), "-c:v", "libx264", "-pix_fmt", "yuv420p", join(OUT, "play.mp4")], { stdio: "ignore" })
    }
  } catch (e) {
    console.warn("ffmpeg play failed:", e.message)
  }

  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\nframes + video: ${FINAL}`)
  console.log(pass ? "\nCAPTURE CLEAN" : "\nCAPTURE PROBLEMS ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

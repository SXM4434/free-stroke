// _PROBE-HERO-GPU-STALL — the 263 ms hole in `tilt` that no CPU probe can see.
//
// WHY THIS EXISTS. `_probe-hero-lag.mjs` measures rAF intervals and finds the
// beat clean (median 8.3 ms, ZERO frames over 33.4 ms). `_probe-hero-interact-
// cost.mjs` measures long tasks and finds interaction clean (worst 53 ms). Both
// are right, and both are blind to the defect `film-hero-beat.mjs` records:
//
//     worst paint gap  0.264s / 0.262s   at playhead 8.2s, phase "tilt"
//     worst rAF gap    0.019s / 0.021s   -- the main thread was NEVER blocked
//
// A quarter-second in which the page runs ~31 rAF callbacks and PRESENTS NOT ONE
// FRAME. That combination rules out every main-thread explanation: JS ran, the
// transport advanced, and the compositor still had nothing new to show. The work
// is happening off the renderer thread, which on ANGLE/Metal means the GPU
// process -- and the thing that blocks a Metal pipeline for a quarter second is
// `glLinkProgram` building a pipeline state object from MSL.
//
// three.js links a program whenever a material's PROGRAM KEY changes: a #define
// flipping, `needsUpdate`, a map being attached, shadows turning on. If one of
// those flips at `tilt`, every affected material re-links mid-beat.
//
// SO THIS MEASURES THE LINK ITSELF, not a proxy for it. `linkProgram` is patched
// before any page script runs, and each call is stamped with the playhead and
// phase the page reports. `getProgramParameter(LINK_STATUS)` is timed
// separately, because ANGLE defers the real compile to the first status query --
// timing only `linkProgram` would report ~0 ms and prove nothing.
//
// THE CONTROL. A probe that finds links is only meaningful if it can also report
// their absence, so the same instrument runs a SECOND take on a beat that has
// already played once. Programs are cached by key, so a warm take must show
// materially FEWER links in `tilt`. If both takes look the same, the links are
// not what the first take is paying for and this probe has not found the cause.
//
// Usage: node scripts/verify/_probe-hero-gpu-stall.mjs [--label=run] [--dpr=2]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { HERO_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const DPR = parseFloat(arg("dpr", "2"))
const OUT = join(ROOT, "docs", "verification", "hero-gpu-stall", LABEL)
/* The incumbent override, copied verbatim from `_probe-pentip-shape.mjs` so
 * this repo keeps ONE name for this knob rather than growing a second. */
const VIEW = { width: 1600, height: 1600 }

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR })

  /* PATCHED BEFORE ANY PAGE SCRIPT RUNS. A patch installed after three.js has
   * its context would miss every link the first render performs. */
  await context.addInitScript(() => {
    window.__links = []
    const stamp = () => {
      const el = document.querySelector("[data-hero-phase]")
      const sc = document.querySelector("[data-hero-scrub]")
      return {
        phase: el ? el.getAttribute("data-hero-phase") : null,
        t: sc ? parseFloat(sc.value) : -1,
      }
    }
    for (const P of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      if (!P) continue
      const link = P.prototype.linkProgram
      P.prototype.linkProgram = function (prog) {
        const t0 = performance.now()
        const r = link.call(this, prog)
        const dt = performance.now() - t0
        window.__links.push({ kind: "link", ms: dt, at: performance.now(), ...stamp() })
        return r
      }
      /* ANGLE defers the real MSL compile + pipeline build to the first status
       * query, so THIS is usually where the wall time actually lands. */
      const getPP = P.prototype.getProgramParameter
      P.prototype.getProgramParameter = function (prog, pname) {
        const isStatus = pname === this.LINK_STATUS
        const t0 = isStatus ? performance.now() : 0
        const r = getPP.call(this, prog, pname)
        if (isStatus) {
          const dt = performance.now() - t0
          window.__links.push({ kind: "status", ms: dt, at: performance.now(), ...stamp() })
        }
        return r
      }
    }
  })

  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(4000)

  const renderer = await page.evaluate(() => {
    const c = document.createElement("canvas")
    const gl = c.getContext("webgl2") || c.getContext("webgl")
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info")
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown"
  })
  console.log(`renderer: ${renderer}`)
  say(/metal/i.test(renderer), "real GPU (ANGLE Metal), not SwiftShader", renderer)
  say(
    await page.evaluate(() => Array.isArray(window.__links)),
    "the linkProgram patch is installed (without it this probe measures nothing)",
  )

  const parkAndPlay = async (tag) => {
    await page.evaluate(() => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(el, "0")
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await page.waitForTimeout(1200)
    // Clear, so each take reports only its own links.
    await page.evaluate(() => {
      window.__links = []
      window.__gaps = []
      window.__last = performance.now()
      const tick = (now) => {
        const el = document.querySelector("[data-hero-phase]")
        const sc = document.querySelector("[data-hero-scrub]")
        window.__gaps.push([
          now - window.__last,
          sc ? parseFloat(sc.value) : -1,
          el ? el.getAttribute("data-hero-phase") : null,
        ])
        window.__last = now
        window.__raf = requestAnimationFrame(tick)
      }
      window.__raf = requestAnimationFrame(tick)
    })
    const total = await page
      .locator("[data-hero-scrub]")
      .evaluate((el) => parseFloat(el.max))
    await page.click("[data-hero-play]")
    await page.waitForTimeout((total + 1.2) * 1000)
    const rec = await page.evaluate(() => {
      cancelAnimationFrame(window.__raf)
      return { links: window.__links.slice(), gaps: window.__gaps.slice() }
    })
    console.log(`\n=== TAKE ${tag} ===`)
    const links = rec.links.filter((l) => l.kind === "link")
    const status = rec.links.filter((l) => l.kind === "status")
    const totalLink = links.reduce((a, b) => a + b.ms, 0)
    const totalStatus = status.reduce((a, b) => a + b.ms, 0)
    console.log(
      `  program links ${links.length}  (${totalLink.toFixed(1)} ms in linkProgram) · ` +
        `LINK_STATUS queries ${status.length} (${totalStatus.toFixed(1)} ms — this is where ANGLE really pays)`,
    )
    const byPhase = {}
    for (const l of rec.links) {
      const k = l.phase ?? "-"
      byPhase[k] ??= { link: 0, linkMs: 0, status: 0, statusMs: 0 }
      byPhase[k][l.kind === "link" ? "link" : "status"] += 1
      byPhase[k][l.kind === "link" ? "linkMs" : "statusMs"] += l.ms
    }
    console.log(`  phase          links   linkMs   status   statusMs`)
    for (const [p, v] of Object.entries(byPhase))
      console.log(
        `  ${p.padEnd(13)}${String(v.link).padStart(5)}  ${v.linkMs.toFixed(1).padStart(7)}  ` +
          `${String(v.status).padStart(6)}  ${v.statusMs.toFixed(1).padStart(9)}`,
      )
    const g = rec.gaps.slice(1)
    const worst = [...g].sort((a, b) => b[0] - a[0]).slice(0, 6)
    console.log(`  worst rAF gaps: ` + worst.map((w) => `${w[0].toFixed(0)}ms@${w[2]}:${w[1].toFixed(2)}s`).join("  "))
    return { links, status, byPhase, gaps: rec.gaps, totalLink, totalStatus }
  }

  /* CALIBRATION FIRST. The take clears `__links`, so "0 links during playback"
   * is only a finding if the patch is known to catch links AT ALL. The page's
   * own load links every program it uses, so that count is the calibration —
   * a patch that reports 0 there is broken, not informative. */
  const loadLinks = await page.evaluate(() => ({
    n: window.__links.filter((l) => l.kind === "link").length,
    ms: window.__links.filter((l) => l.kind === "link").reduce((a, b) => a + b.ms, 0),
    statusMs: window.__links.filter((l) => l.kind === "status").reduce((a, b) => a + b.ms, 0),
  }))
  console.log(
    `\nCALIBRATION — programs linked during page load: ${loadLinks.n} ` +
      `(${loadLinks.ms.toFixed(1)} ms link, ${loadLinks.statusMs.toFixed(1)} ms LINK_STATUS)`,
  )
  say(
    loadLinks.n > 0,
    "CALIBRATION: the patch catches real links during load (if 0, the patch is broken and every 0 below is meaningless)",
    `${loadLinks.n}`,
  )

  const cold = await parkAndPlay("COLD (first play after load)")
  const warm = await parkAndPlay("WARM (second play, programs cached)")

  console.log("")
  const coldTilt = (cold.byPhase.tilt?.link ?? 0) + (cold.byPhase.tilt?.status ?? 0)
  const warmTilt = (warm.byPhase.tilt?.link ?? 0) + (warm.byPhase.tilt?.status ?? 0)
  console.log(`  tilt-phase GL program events — cold ${coldTilt} · warm ${warmTilt}`)

  /* ---- IS THE PAINT GAP THE PAGE, OR THE INSTRUMENT? ----------------------
   * `film-hero-beat.mjs` reports the gap from CDP `Page.startScreencast` with
   * `format: "png"`. A screencast frame is only emitted when the browser has
   * ENCODED one, and PNG-encoding a 1440x1440 frame is not free. So a "paint
   * gap" can be the encoder rather than the page — and that would make the
   * headline number of this whole investigation an artifact.
   *
   * The test is a mutation of the INSTRUMENT, not of the subject: run the same
   * beat twice, changing only the encoder. The page is byte-identical across
   * the two. If the gap tracks the encoder, it was never the page. */
  const screencastTake = async (format, quality) => {
    await page.evaluate(() => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(el, "0")
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await page.waitForTimeout(1000)
    const client = await context.newCDPSession(page)
    const ts = []
    client.on("Page.screencastFrame", async (f) => {
      ts.push(f.metadata.timestamp)
      try {
        await client.send("Page.screencastFrameAck", { sessionId: f.sessionId })
      } catch {}
    })
    const opts = { format, everyNthFrame: 1, maxWidth: 1440, maxHeight: 1440 }
    if (quality != null) opts.quality = quality
    await client.send("Page.startScreencast", opts)
    const total = await page.locator("[data-hero-scrub]").evaluate((el) => parseFloat(el.max))
    await page.click("[data-hero-play]")
    await page.waitForTimeout((total + 0.8) * 1000)
    await client.send("Page.stopScreencast").catch(() => {})
    await client.detach().catch(() => {})
    const gaps = []
    for (let i = 1; i < ts.length; i++) gaps.push(ts[i] - ts[i - 1])
    gaps.sort((a, b) => b - a)
    const span = ts.length ? ts[ts.length - 1] - ts[0] : 1
    console.log(
      `  screencast ${String(format).padEnd(4)}${quality != null ? " q" + quality : "    "} — ` +
        `${String(ts.length).padStart(4)} frames · ${(ts.length / span).toFixed(1)} fps · ` +
        `worst gap ${(gaps[0] ?? 0).toFixed(3)}s · next four ${gaps.slice(1, 5).map((g) => g.toFixed(3)).join(", ")}`,
    )
    return { format, quality, frames: ts.length, worst: gaps[0] ?? 0, gaps: gaps.slice(0, 10) }
  }

  console.log(`\n=== IS THE PAINT GAP REAL, OR IS IT THE ENCODER? ===`)
  const png = await screencastTake("png", null)
  const jpg = await screencastTake("jpeg", 60)
  say(
    true,
    `encoder A/B recorded — png worst ${png.worst.toFixed(3)}s vs jpeg worst ${jpg.worst.toFixed(3)}s`,
    png.worst > jpg.worst * 2
      ? "THE GAP TRACKS THE ENCODER — film-hero-beat's 'worst paint gap' is an instrument artifact"
      : "the gap survives the encoder change — it is the page",
  )

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")

  writeFileSync(
    join(OUT, "gpu-stall.json"),
    JSON.stringify({ renderer, loadLinks, cold, warm, png, jpg }, null, 2),
  )
  await context.close()
  await browser.close()
  console.log(`\njson: ${OUT}`)
  console.log(pass ? "\nALL PASS" : "\nFAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

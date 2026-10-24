// Does ONE tab of the app eat the machine? 2026-09-25, after "you crashed my computer every time
// you open up a chrome tab with one page, 150gb were being used of memory".
//
// Opens one page in our own Chrome (never his), samples every second the resident memory of every
// process in that Chrome's tree (browser, GPU, renderer) plus the page's JS heap, and KILLS that
// Chrome by exact pid the moment the tree passes the limit. A probe that can take the machine down
// is worse than no probe, so the watchdog runs on the Node side, outside the page.
//
// Usage: FS_PORT=3105 node scripts/verify/_probe-memory-leak.mjs <outdir> [--limit-gb=6]
//        [--route=/] [--scenario=idle|play|hero|travel] [--seconds=60]
//        travel: [--engine=rod|inflate] [--toggle-s=5]  (a seamless Travel loop, engine flipped every N s)
//        flip:   the same word and the same engine flips, no Travel window and no Play (F119)
//        [--skip-dispose=1]  F119 must-fail: sets window.__fsF119SkipRodDispose before load, so the
//                            viewport keeps every Rod tube a rebuild replaces, as before the fix
// EXIT CODES. 0 and a failure never look the same:
//   0 clean · 1 the scenario threw (the "stopped:" line) · 2 blind (no GL buffer ever created, or
//   the watchdog cannot see our Chrome) · 3 the watchdog killed our Chrome · 4 LEAK: over the
//   flips, the last return to an engine holds more geometries, or more than 2 more GL buffers,
//   than the first return to it (2 absorbs Travel's in-flight wrap index, measured at +-1)
//   · 5 after a flip the Play click failed or Travel is no longer playing · 6 Travel refused because the transport is not playing,
//   `isPlaying` missing counts as not playing.
// --mustfail=playing-null|click|throw  proves exits 6, 5 and 1 fire. Exit 3 is proven with a real
//   --limit-gb=0.05, exit 2 with --mustfail=blind (the GL counters are never installed), and exit 4
//   with --skip-dispose=1.
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split("=").slice(1).join("=")
const OUT = process.argv[2]
const LIMIT_GB = Number(arg("limit-gb", "6"))
const ROUTE = arg("route", "/")
const SCENARIO = arg("scenario", "idle")
const SECONDS = Number(arg("seconds", "60"))
mkdirSync(OUT, { recursive: true })

function psTable() {
  const out = execFileSync("ps", ["-Ao", "pid=,ppid=,rss=,command="], { encoding: "utf8", maxBuffer: 64 << 20 })
  return out.split("\n").filter(Boolean).map((l) => {
    const m = l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)
    return m ? { pid: +m[1], ppid: +m[2], rssKb: +m[3], cmd: m[4] } : null
  }).filter(Boolean)
}
// Our Chrome is the process whose command line carries this node process's launcher marker.
function ourTree() {
  const t = psTable()
  // The launcher's marker is `--fs-browser=<repo folder name>:<owner pid>:`. The folder name is
  // "free-stroke" only in the main tree; in a lane clone (nightL) it is the clone's name, and a
  // literal "free-stroke" here found no process, so the watchdog summed 0 GB and could never fire.
  const mark = new RegExp(`--fs-browser=[^:\\s]+:${process.pid}:`)
  const roots = t.filter((p) => mark.test(p.cmd) && !p.cmd.includes("--type="))
  const ids = new Set(roots.map((r) => r.pid))
  let grew = true
  while (grew) { grew = false; for (const p of t) if (ids.has(p.ppid) && !ids.has(p.pid)) { ids.add(p.pid); grew = true } }
  const procs = t.filter((p) => ids.has(p.pid))
  const kind = (c) => (c.match(/--type=([a-z-]+)/)?.[1] ?? "browser")
  const by = {}
  for (const p of procs) by[kind(p.cmd)] = (by[kind(p.cmd)] ?? 0) + p.rssKb
  return { roots: roots.map((r) => r.pid), procs, byKindGb: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, +(v / 1e6).toFixed(3)])), totalGb: procs.reduce((a, p) => a + p.rssKb, 0) / 1e6 }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1512, height: 982 } })
// renderer.info, read probe-side. three.js announces every WebGLRenderer it builds on
// `__THREE_DEVTOOLS__` ("observe"), so defining that before the page loads hands us the live
// renderer with no app hook. Next to it, raw WebGL create/delete counts, because a buffer or
// texture made outside three would never show in renderer.info, and 2D canvases made per second.
const MUSTFAIL = arg("mustfail", "")
let exitCode = 0
const fail = (code, why) => { console.log(`FAIL(${code}): ${why}`); if (!exitCode) exitCode = code }
if (arg("skip-dispose", "0") === "1") await page.addInitScript(() => { window.__fsF119SkipRodDispose = true })
if (MUSTFAIL === "blind") await page.addInitScript(() => { window.__fsProbeMustfailBlind = true })
await page.addInitScript(() => {
  const w = window
  w.__memProbe = { renderers: [], gl: {}, canvases2d: 0, raf: 0 }
  const hub = new EventTarget()
  hub.addEventListener("observe", (e) => { const d = e.detail; if (d && d.isWebGLRenderer) w.__memProbe.renderers.push(d) })
  w.__THREE_DEVTOOLS__ = hub
  const count = (k, n = 1) => { w.__memProbe.gl[k] = (w.__memProbe.gl[k] ?? 0) + n }
  for (const C of w.__fsProbeMustfailBlind ? [] : [w.WebGLRenderingContext, w.WebGL2RenderingContext]) {
    if (!C) continue
    for (const m of ["createBuffer", "deleteBuffer", "createTexture", "deleteTexture", "createProgram", "deleteProgram", "createFramebuffer", "deleteFramebuffer", "createRenderbuffer", "deleteRenderbuffer", "createVertexArray", "deleteVertexArray", "bufferData", "texImage2D", "texSubImage2D"]) {
      const f = C.prototype[m]
      if (typeof f !== "function") continue
      C.prototype[m] = function (...a) { count(m); return f.apply(this, a) }
    }
  }
  const ce = Document.prototype.createElement
  Document.prototype.createElement = function (t, ...r) { if (String(t).toLowerCase() === "canvas") w.__memProbe.canvases2d++; return ce.call(this, t, ...r) }
  const raf = w.requestAnimationFrame.bind(w)
  w.requestAnimationFrame = (cb) => { w.__memProbe.raf++; return raf(cb) }
})
const samples = []
// Browser-side counters the page cannot fake: DOM nodes, listeners, V8 heap used AND total.
const cdp = await page.context().newCDPSession(page)
let consoleCount = 0
page.on("console", () => { consoleCount++ })
let killed = null
const watchdog = setInterval(() => {
  const t = ourTree()
  if (t.totalGb > LIMIT_GB && !killed) {
    killed = { at: new Date().toISOString(), totalGb: t.totalGb, byKindGb: t.byKindGb }
    for (const pid of t.roots) { try { process.kill(pid, "SIGKILL") } catch {} }
    console.log(`WATCHDOG: our Chrome tree reached ${t.totalGb.toFixed(2)} GB > ${LIMIT_GB} GB, killed pids ${t.roots.join(",")}`)
  }
}, 500)

{
  const seen = ourTree()
  if (!seen.roots.length) { console.log("WATCHDOG BLIND: no process carries our --fs-browser marker, refusing to run"); try { await browser.close() } catch {} ; process.exit(2) }
  console.log("watchdog sees browser pids", seen.roots.join(","))
}
const t0 = Date.now()
async function sample(label) {
  const t = ourTree()
  let heap = null
  let info = null
  try {
    heap = await page.evaluate(() => (performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null))
    info = await page.evaluate(() => {
      const p = window.__memProbe
      if (!p) return null
      const r = p.renderers.map((x) => ({ geo: x.info.memory.geometries, tex: x.info.memory.textures, prog: x.info.programs?.length ?? null, frame: x.info.render.frame, calls: x.info.render.calls }))
      return { r, gl: { ...p.gl }, canvases: p.canvases2d, raf: p.raf, dom: document.getElementsByTagName("*").length, transport: document.querySelector('button[aria-label="Pause"],button[aria-label="Play"]')?.getAttribute("aria-label") ?? null }
    })
  } catch {}
  let dc = null, hu = null, perfEntries = null
  try { dc = await cdp.send("Memory.getDOMCounters") } catch {}
  try { hu = await cdp.send("Runtime.getHeapUsage") } catch {}
  try { perfEntries = await page.evaluate(() => performance.getEntries().length) } catch {}
  if (info) info.cdp = { nodes: dc?.nodes, listeners: dc?.jsEventListeners, docs: dc?.documents, v8UsedMb: hu ? +(hu.usedSize / 1e6).toFixed(1) : null, v8TotalMb: hu ? +(hu.totalSize / 1e6).toFixed(1) : null, perfEntries, console: consoleCount }
  const s = { t: +((Date.now() - t0) / 1000).toFixed(1), label, totalGb: +t.totalGb.toFixed(3), ...t.byKindGb, heapMb: heap ? +(heap.used / 1e6).toFixed(1) : null, info }
  samples.push(s)
  console.log(JSON.stringify(s))
}

let travel = null
try {
  await page.goto(LAB_URL.replace(/\/$/, "") + ROUTE, { waitUntil: "domcontentloaded" })
  for (let i = 0; i < 10 && !killed; i++) { await page.waitForTimeout(1000); await sample("load") }
  if (SCENARIO === "play") {
    const box = { x: 120, y: 650 }
    for (let s = 0; s < 4 && !killed; s++) {
      await page.mouse.move(box.x + s * 110, box.y + 40); await page.mouse.down()
      for (let k = 0; k <= 24; k++) await page.mouse.move(box.x + s * 110 + (k / 24) * 80, box.y + 40 + Math.sin((k / 24) * 6.28 + s) * 50, { steps: 2 })
      await page.mouse.up()
    }
    const loop = page.getByRole("button", { name: /^Loop$/i }).first()
    const play = page.getByRole("button", { name: /^Play$/i }).first()
    if (await play.count()) await play.click().catch(() => {})
    const timing = page.getByRole("button", { name: /^Timing$/i }).first()
    console.log("controls found:", JSON.stringify({ play: await play.count(), loop: await loop.count(), timing: await timing.count() }))
    if (await timing.count()) { await timing.click().catch(() => {}); if (await loop.count()) await loop.click().catch(() => {}); await page.keyboard.press("Escape").catch(() => {}) }
  }
  // F118 TRAVEL-7, a seamless Travel. The logo word goes in through `__styleHarness`, the
  // window is Travel with Loop on (that is what makes it seamless), and Play runs. A doubled
  // index is only left behind when a WRAPPED geometry is rebuilt, and a loop that plays on one
  // build rebuilds nothing, so every --toggle-s seconds the engine flips Rod <-> Inflate while
  // the loop runs. Each flip retires the wrapped geometries of the engine it leaves.
  // --toggle-s=0 plays the loop with no rebuild, the steady-state arm.
  // F119, the plain flip: the same word and the same engine flips, with no Travel window and no
  // Play, so a climb here cannot come from the loop wrap or the transport.
  if (SCENARIO === "travel" || SCENARIO === "flip") {
    const { readFileSync } = await import("node:fs")
    const raw = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8"))
    await page.waitForFunction(() => window.__styleHarness && window.__revealHarness, null, { timeout: 180000 })
    const cb = await page.locator("canvas").first().boundingBox()
    const k = (cb.width * 0.9) / raw.width, ox = (cb.width - raw.width * k) / 2, oy = (cb.height - raw.height * k) / 2
    const polys = raw.polylines.map((pl) => pl.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k })))
    await page.evaluate((s) => window.__styleHarness.injectStrokes(s, { msPerPoint: 12, gapMs: 400 }), polys)
    await page.waitForTimeout(2500)
    const engines = [arg("engine", "rod"), arg("engine", "rod") === "rod" ? "inflate" : "rod"]
    const pick = async (e) => { const r = page.getByRole("radio", { name: new RegExp(`^${e}$`, "i") }).first(); await r.click(); await page.waitForTimeout(1500); return r.getAttribute("aria-checked") }
    const took = await pick(engines[0])
    if (SCENARIO === "flip") {
      travel = { engines, took, flip: true, toggles: 0 }
      console.log("flip:", JSON.stringify(travel))
      if (took !== "true") { console.log("REFUSED: could not select", engines[0]); throw new Error("no engine") }
    } else {
    await page.evaluate(() => { const h = window.__revealHarness; h.setDelay?.(0); h.setWindow({ mode: "travel", length: 0.25 }); h.setLoop(true) })
    await page.waitForTimeout(800)
    const play = page.getByRole("button", { name: /^Play$/i }).first()
    if (await play.count()) await play.click()
    await page.waitForTimeout(500)
    if (MUSTFAIL === "playing-null") await page.evaluate(() => { delete window.__revealHarness.isPlaying })
    travel = { engines, took, window: await page.evaluate(() => window.__revealHarness.window()), playing: await page.evaluate(() => window.__revealHarness.isPlaying?.() ?? null), toggles: 0 }
    console.log("travel:", JSON.stringify(travel))
    // `window()` hands back the document's window, which never carries `seamless`, so the check
    // is the rule itself (lib/stroke-schedule.ts effectiveWindow): Travel, Loop on, no delay, and
    // the transport actually playing.
    // `playing` must be TRUE. null means the harness has no isPlaying, and "cannot tell" is not "playing".
    if (took !== "true" || travel.window?.mode !== "travel" || travel.playing !== true) { console.log("REFUSED: the scenario is not a seamless Travel on", engines[0], "playing:", travel.playing); fail(6, "Travel is not playing"); throw new Error("not seamless") }
    }
  }
  const TOGGLE_S = Number(arg("toggle-s", "5"))
  for (let i = 0; i < SECONDS && !killed; i++) {
    await page.waitForTimeout(1000)
    if (travel && TOGGLE_S > 0 && (i + 1) % TOGGLE_S === 0) {
      travel.toggles++
      const e = travel.engines[travel.toggles % 2]
      await page.getByRole("radio", { name: new RegExp(`^${e}$`, "i") }).first().click()
      const play = page.getByRole("button", { name: /^Play$/i }).first()
      await page.waitForTimeout(300)
      // Measured: after a flip the transport stays playing, so Play is usually absent and this
      // click rarely runs. --mustfail=click forces it against a 1 ms timeout to prove the error
      // reaches exit 5. The standing check is the one after it: Travel must still be playing.
      if (!travel.flip && (MUSTFAIL === "click" || (await play.count()))) {
        travel.playClicks = (travel.playClicks ?? 0) + 1
        await play.click({ timeout: MUSTFAIL === "click" ? 1 : 5000 }).catch((err) => fail(5, `Play click after flip ${travel.toggles}: ${String(err).slice(0, 120)}`))
      }
      if (!travel.flip) {
        const on = await page.evaluate(() => window.__revealHarness.isPlaying?.() ?? null)
        if (on !== true) fail(5, `Travel not playing after flip ${travel.toggles} (isPlaying: ${on})`)
      }
    }
    await sample(SCENARIO)
    // F119: one row per flip, read in the last second before the next flip, so the build it
    // started (Inflate's worker included) has settled and the slope is per flip, not per second.
    if (travel && TOGGLE_S > 0 && travel.toggles > 0 && (i + 2) % TOGGLE_S === 0) {
      const s = samples[samples.length - 1]
      ;(travel.perFlip ??= []).push({ flip: travel.toggles, engine: travel.engines[travel.toggles % 2],
        geo: s?.info?.r?.map((x) => x.geo) ?? null, liveBuffers: (s?.info?.gl?.createBuffer ?? 0) - (s?.info?.gl?.deleteBuffer ?? 0) })
    }
  }
  if (MUSTFAIL === "throw") throw new Error("mustfail=throw")
  if (travel) travel.end = await page.evaluate(() => ({ window: window.__revealHarness.window(), playing: window.__revealHarness.isPlaying?.() ?? null, p: window.__revealHarness.getProgress() })).catch(() => null)
} catch (e) {
  console.log("stopped:", String(e).slice(0, 200))
  fail(1, "scenario stopped")
} finally {
  clearInterval(watchdog)
  const first = samples.find((s) => s.label !== "load") ?? samples[0]
  const last = samples[samples.length - 1]
  const summary = { route: ROUTE, scenario: SCENARIO, limitGb: LIMIT_GB, killed, samples: samples.length, firstGb: first?.totalGb, lastGb: last?.totalGb, peakGb: Math.max(...samples.map((s) => s.totalGb)), growthGbPerMin: first && last && last.t > first.t ? +(((last.totalGb - first.totalGb) / (last.t - first.t)) * 60).toFixed(3) : null }
  if (travel) {
    // GL buffers alive = createBuffer - deleteBuffer. A count of 0 created means the init script
    // never reached the context, and the "no leak" it would print is blindness, not a result.
    const gl = (s) => s?.info?.gl ?? {}
    const live = (s) => (gl(s).createBuffer ?? 0) - (gl(s).deleteBuffer ?? 0)
    const geo = (s) => s?.info?.r?.map((x) => x.geo) ?? null
    summary.travel = { ...travel, created: gl(last).createBuffer ?? 0, deleted: gl(last).deleteBuffer ?? 0,
      liveBuffersFirst: live(first), liveBuffersLast: live(last), geometriesFirst: geo(first), geometriesLast: geo(last),
      blind: !(gl(last).createBuffer > 0) }
    if (summary.travel.blind) fail(2, "BLIND: 0 GL buffers created, the counters never reached the context")
    // F119 verdict: first vs last return to each engine. A leak that grows by one geometry per flip
    // shows here; a bounded cache that fills once and stops does not.
    for (const e of travel.engines) {
      const rows = (travel.perFlip ?? []).filter((r) => r.engine === e)
      if (rows.length < 2) continue
      const a = rows[0], b = rows[rows.length - 1], ga = a.geo?.[0] ?? 0, gb = b.geo?.[0] ?? 0
      summary.travel[`drift_${e}`] = { flips: rows.length, geo: gb - ga, liveBuffers: b.liveBuffers - a.liveBuffers }
      if (gb > ga || b.liveBuffers - a.liveBuffers > 2) fail(4, `LEAK on ${e}: geometries ${ga} -> ${gb}, live GL buffers ${a.liveBuffers} -> ${b.liveBuffers} over ${rows.length} returns`)
    }
  }
  // The kill outranks the "stopped" it causes, so a watchdog kill always reads as 3.
  if (killed) { fail(3, `watchdog killed our Chrome at ${killed.totalGb.toFixed(2)} GB`); exitCode = 3 }
  summary.exitCode = exitCode
  writeFileSync(join(OUT, `memory-${SCENARIO}-${ROUTE.replace(/\W+/g, "_") || "root"}.json`), JSON.stringify({ summary, samples }, null, 2))
  console.log("SUMMARY", JSON.stringify(summary))
  try { await browser.close() } catch {}
  process.exit(exitCode)
}

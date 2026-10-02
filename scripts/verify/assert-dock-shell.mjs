// assert-dock-shell · L1 of the layout rethink (docs/research-2026-09-26/layout-rethink/BUILD-PLAN.md §5).
//
// The two columns are two dockview panels now (components/dock-shell.tsx). Rows, logo drawn, against the
// reference server (main, read-only):
//
//   BUFFERS    (a) every canvas on the page has the same backing buffer (width x height) as main's, canvas by
//              canvas in document order, at 1512x982, 1280x800 and 834x1112 (the stacked layout). Each lane
//              load runs under a 20 s watchdog (60 s for main, a shared server): a load that does not finish
//              is a FAIL that says "hung", never a skip. The column boxes on both sides are printed beside it.
//   FRAMES     (b) at each size where BUFFERS holds, the 3D frame (`__captureHarness.grab()`) and every 2D
//              canvas (`toDataURL`) hash byte-identical to main's. Grabbed at equal buffer size only: where
//              the buffers differ the row is a FAIL that says so, not a comparison of two sizes.
//              TWO FRAMES, because main's frame at load is not always a fixed thing (L1-4, measured):
//              AT LOAD, graded only where main's 3D canvas held ONE size through the load. Below `lg` it does
//              not: the stacked canvas grows 188 to 217.72 px over about 700 ms, and page.tsx refits the camera
//              (`orbitView`, 450 ms after the last stroke) with zoom = the canvas's half-height at THAT moment.
//              Which growth step the timer lands on varies by load, on main too: main's at-load zoom at 834x1112
//              read 34.78, 34.68, 33.92 and 33.92 over four loads, and three different main hashes are on
//              record. There a byte comparison is two samples of a race, so it is printed and not counted.
//              AFTER RESET, graded at every size: "Reset camera" clicked on both pages once they have settled,
//              so both frame from the same settled canvas and the same bounds.
//              POSITIVE CONTROL, first: the lane's frame at reveal progress 0.5 must differ from its frame at
//              1, or the grab cannot see the scene and every FRAMES pass below means nothing. And the reset
//              frame must differ from the at-load one on main, or the click did not reframe anything.
//   PAGE       REPORT ONLY, never counted: the page screenshot diff against main, each differing region named.
//   SURVIVES   the 3D canvas node, its WebGL context and its three.js scene are the SAME objects, no
//              `webglcontextlost` fires, no new WebGL context is created anywhere on the page, the drawing
//              layers hash the same and the 3D frame hashes the same once the size is back, across
//              (a) a move of the 3D panel into the drawing's group and back out to the right,
//              (b) maximize and restore of the 3D panel, (c) 20 consecutive `fromJSON` loads with
//              `reuseExistingPanels`, (d) a move of the 3D panel into the drawing's group as a tab BEHIND the
//              drawing, so the 3D panel is hidden, and back out. (d) also asks that the canvas stays in the
//              document while hidden, and fails if the panel never hid (then the step measured nothing).
//              Only (d) can tell the renderers apart: (a) to (c) never hide the 3D panel, and a move keeps
//              the node and context under either renderer. On dockview 8.3.1 `onlyWhenVisible` hides a panel
//              with `content.element.remove()` (dockview-core, ContentContainer.closePanel) and dockview-react
//              has no `onHide`, so React keeps the canvas mounted but OUT OF THE DOCUMENT. That is what
//              `always` buys here, and what (d) catches.
//   DRAW       after the 20 loads, a stroke drawn with the mouse changes the drawing layers AND the 3D frame.
//
// WHY THE BAR MOVED, 2026-09-26 (controller's call, lane L1-2). This gate's first row, IDENTICAL, asked the
// whole page screenshot to equal main's within 0 px. It failed on one thing only: today's flex columns put
// the rule on a half pixel (756.5 and 755.5 at 1512) and dockview lays out in whole pixels, so every pixel
// of the resampled canvases moved. Page-level pixel identity is the wrong bar for L1, because L4 redesigns
// the layout and throws those pixels away. What L1 must not change is what the two canvases render and how
// big their buffers are, so the bar is (a) BUFFERS, (b) FRAMES, and (c) the resize gates staying green
// (assert-resize-settles, run beside this one, not inside it). IDENTICAL is REPLACED, not loosened: the page
// diff still runs and still names its regions as PAGE, it just no longer decides anything.
//
// WHY THE PAGES ARE SET UP, L3 (2026-09-30). L3 moved the take dock out of the 3D column into a dockview
// group under both panels (BUILD-PLAN.md §5 row L3), so no lane page has main's two canvas sizes any more:
// main's 3D canvas gave its column's bottom to the in-column dock (755x533 at 1512x982) and L3's gives the
// dock's 36 px header under both. BUFFERS and FRAMES keep their bar, byte-equal at equal buffers, by
// comparing the one arrangement both trees can show: the two canvases with no dock beside them. The lane
// hides its dock group (`__dockHarness.dock.setHidden`, the rail's show/hide from L4); a reference that
// still docks under the canvas (`[data-take-dock]`) gets the stylesheet `lib/undock.mjs` used to float that
// dock off the canvas, kept here for reference trees only. Both then draw 755x890 at 1512x982, which is
// main's size before the take dock existed. A reference page with neither (main before ANIM-3C) is taken as
// it is. The SURVIVES and DRAW rows run on the same pages.
//
// L4 (2026-09-30) put the 48 px rail left of the panels and took the 44 px style bar away, so no L4 page can
// draw either canvas at a pre-L4 reference's size, whatever is hidden. The lane is set to the closest thing
// (`workspace.today()`: the Drawing and the 3D view alone, at today's split of what the rail leaves), and
// BUFFERS and FRAMES stay as they are: against a pre-L4 reference they go red, by the plan's design, until a
// reference with the same chrome is chosen (a question in LOG.md). SURVIVES and DRAW are unaffected.
//
// MUST-FAIL ARMS, set before navigation through `window.__fsDockMutant`, read once by the shell:
//   header           BUFFERS must go red: group headers stay visible, a 28 px strip over the 3D view
//   noReuse          SURVIVES must go red: the harness's loads pass `reuseExistingPanels: false`
//   onlyWhenVisible  SURVIVES must go red at (d): the renderer swapped, the hidden canvas leaves the document
//   stale            DRAW must go red: the panels render the slots captured at mount
//
// CORPUS. The page at `/` only. BUFFERS and FRAMES read every <canvas> in the document, WebGL ones told
// apart by the init script's getContext probe; a canvas main has and the lane lacks is a count mismatch and
// a FAIL. FRAMES hashes the WebGL canvas through the grab only (its toDataURL is not reliable without a
// preserved buffer), so a second WebGL canvas would be counted by BUFFERS and not hashed. The 3D canvas is found as the largest canvas under
// [data-dock-panel="view3d"]; the drawing layers are every canvas under [data-dock-panel="drawing"].
// A remount that keeps the node but rebuilds the scene is caught by the scene identity, one that keeps
// the scene but makes a new context by the context count. What it does not see: a remount of anything
// outside those two panels, and a frame that differs only while the size is changed (only the restored
// frame is compared).
//
// FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-dock-shell.mjs [--ref=http://localhost:3000] [--only=clean|arms] [--size=834x1112]
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")

const OUT = new URL("../../docs/verification/dock-shell/", import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const REF = (process.argv.find((a) => a.startsWith("--ref=")) ?? "--ref=http://localhost:3000").slice(6)
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "--only=all").slice(7)
const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const STILL = { motionMode: "off", materialAnimationEnabled: false, textureAnimated: false, ditherAnimated: false, asciiAnimated: false, stackAnimationEnabled: false, fusionAnimationEnabled: false }
const SIZE = (process.argv.find((a) => a.startsWith("--size=")) ?? "").slice(7)
const SIZES = [[1512, 982], [1280, 800], [834, 1112]].filter(([w, h]) => !SIZE || SIZE === `${w}x${h}`)
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16)

const browser = await chromium.launch()
const results = []
const say = (row, arm, ok, detail) => {
  results.push({ row, arm, ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${row} [${arm}] ${detail}`)
}

async function open(url, [w, h], arm) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.addInitScript((m) => {
    if (m) window.__fsDockMutant = m
    window.__dockProbe = { made: 0, lost: 0, sizes: [] }
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...a) {
      const c = orig.call(this, type, ...a)
      if (c && /webgl/.test(type) && !this.__dockSeen) {
        this.__dockSeen = true
        window.__dockProbe.made++
        this.addEventListener("webglcontextlost", () => { window.__dockProbe.lost++ })
        // Every css size the first 3D canvas takes during load, past the 300x150 default (FRAMES AT LOAD).
        if (window.__dockProbe.made === 1) new ResizeObserver(() => {
          const r = this.getBoundingClientRect(), k = `${r.width}x${r.height}`, z = window.__dockProbe.sizes
          if (k !== "300x150" && z[z.length - 1] !== k) z.push(k)
        }).observe(this)
        // Every camera framing during load, with the half-height it read (FRAMES AT LOAD): the zoom setter
        // is wrapped once the canvas's controls can be reached through the fiber, as IDENT does below.
        if (window.__dockProbe.made === 1) {
          const cv = this, t0 = performance.now(); window.__dockProbe.fits = []
          const tick = () => {
            let f = cv[Object.keys(cv).find((k) => k.startsWith("__reactFiber$"))], ctl = null
            const hit = (p) => { if (!p) return null; if (p.controlsRef) return p.controlsRef; for (const x of [].concat(p.children)) if (x?.props?.controlsRef) return x.props.controlsRef; return null }
            while (f && !ctl) { ctl = hit(f.memoizedProps); f = f.return }
            const cam = ctl?.current?.object
            if (cam && cam.isOrthographicCamera) {
              let z = cam.zoom
              window.__dockCam = cam
              Object.defineProperty(cam, "zoom", { configurable: true, get: () => z, set: (v) => { if (v !== z) window.__dockProbe.fits.push(cam.top); z = v } })
            } else if (performance.now() - t0 < 10000) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      }
      return c
    }
  }, arm === "clean" ? null : arm)
  page.on("pageerror", (e) => console.log(`  pageerror ${arm}: ${e.message.slice(0, 160)}`))
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness, null, { timeout: 240000 })
  await noDock(page)
  const blank = await drawHash(page)
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await page.evaluate((st) => { window.__styleHarness.setStyle(st); window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) }, STILL)
  await settle(page, 1500)
  return { ctx, page, blank }
}
/* NO DOCK BESIDE THE CANVASES (see "WHY THE PAGES ARE SET UP, L3"). Before any stroke lands, so neither
   canvas takes another size first. The reference stylesheet is `lib/undock.mjs`'s, as it was at L2. */
const REF_FLOAT =
  "[data-take-dock]{padding-bottom:0!important}" +
  "[data-take-dock]>:is([data-animation-panel],:has([data-take-timeline])){position:absolute!important;left:12px;right:12px;bottom:64px;margin:0!important}"
async function noDock(page) {
  const how = await page.evaluate(() => {
    // L4 and later: the two canvases alone at today's split (dock and Style hidden).
    const w = window.__dockHarness?.workspace
    if (w?.today) { w.today(); return "today" }
    const d = window.__dockHarness?.dock
    if (d) { d.setHidden(true); return "hidden" }
    return document.querySelector("[data-take-dock]") ? "float" : "none"
  })
  if (how === "float") await page.addStyleTag({ content: REF_FLOAT })
  await page.waitForTimeout(300)
  return how
}
const settle = async (page, ms) => { await page.waitForTimeout(ms); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
const drawHash = (page) => page.evaluate(() => [...document.querySelectorAll('[data-dock-panel="drawing"] canvas')].map((c) => `${c.width}x${c.height}:${c.toDataURL()}`).join("|")).then(sha)
const canvases = (page) => page.evaluate(() => [...document.querySelectorAll("canvas")].map((c) => { const r = c.getBoundingClientRect(); return `${r.x},${r.y} ${r.width}x${r.height} buf ${c.width}x${c.height}` }))

// The 3D view's identity: node, context, scene, reached through the fiber exactly as
// assert-resize-settles does, plus the page-wide context counters from the init script.
const IDENT = () => {
  const panel = document.querySelector('[data-dock-panel="view3d"]')
  const c = panel && [...panel.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0]
  if (!c) return null
  let f = c[Object.keys(c).find((k) => k.startsWith("__reactFiber$"))], ctl = null
  const hit = (p) => { if (!p) return null; if (p.controlsRef) return p.controlsRef; for (const x of [].concat(p.children)) if (x?.props?.controlsRef) return x.props.controlsRef; return null }
  while (f && !ctl) { ctl = hit(f.memoizedProps); f = f.return }
  const st = ctl?.current?.object?.__r3f?.root ?? ctl?.current?.__r3f?.root ?? null
  const s = st?.getState()
  return { c, gl: s?.gl.getContext() ?? null, scene: s?.scene ?? null }
}
async function snap(page) {
  return page.evaluate((src) => {
    const now = new Function(`return (${src})()`)()
    const b = window.__dockBase
    const r = now?.c.getBoundingClientRect()
    return {
      sameNode: !!now && now.c === b.c, sameGL: !!now?.gl && now.gl === b.gl, sameScene: !!now?.scene && now.scene === b.scene,
      made: window.__dockProbe.made, lost: window.__dockProbe.lost,
      size: now ? `${r.width}x${r.height} buf ${now.c.width}x${now.c.height}` : "none",
      maximized: window.__dockHarness?.api.hasMaximizedGroup() ?? null,
    }
  }, IDENT.toString())
}
const frame = (page) => page.evaluate(() => window.__captureHarness.grab()).then((u) => (typeof u === "string" ? sha(u) : "none"))
// The app's own "Reset camera": the frame taken from the settled canvas and the final bounds (FRAMES AFTER RESET).
const resetFrame = (page) => page.evaluate(async () => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Reset camera")
  if (!b) return "no Reset camera button"
  b.click()
  await new Promise((r) => setTimeout(r, 600))
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  return window.__captureHarness.grab()
}).then((u) => (typeof u === "string" && u.startsWith("data:") ? sha(u) : `none (${u})`))

// ---------- pixel diff, in a blank page so no decoder is added to the repo ----------
async function diff(aPng, bPng) {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  const out = await p.evaluate(async ([a, b]) => {
    const img = async (s) => { const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob()); const c = new OffscreenCanvas(bm.width, bm.height); const g = c.getContext("2d"); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height) }
    const A = await img(a), B = await img(b)
    if (A.width !== B.width || A.height !== B.height) return { n: -1, dims: `${A.width}x${A.height} vs ${B.width}x${B.height}`, boxes: [] }
    const CELL = 16, cw = Math.ceil(A.width / CELL), cells = new Map()
    let n = 0
    for (let i = 0; i < A.data.length; i += 4) {
      if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2]) {
        n++; const px = (i / 4) % A.width, py = Math.floor(i / 4 / A.width), k = Math.floor(py / CELL) * cw + Math.floor(px / CELL)
        const e = cells.get(k) ?? [px, py, px, py, 0]; cells.set(k, [Math.min(e[0], px), Math.min(e[1], py), Math.max(e[2], px), Math.max(e[3], py), e[4] + 1])
      }
    }
    // merge touching cells into regions
    const seen = new Set(), boxes = []
    for (const k of cells.keys()) {
      if (seen.has(k)) continue
      const stack = [k], box = [1e9, 1e9, -1, -1, 0]; seen.add(k)
      while (stack.length) {
        const q = stack.pop(), e = cells.get(q)
        box[0] = Math.min(box[0], e[0]); box[1] = Math.min(box[1], e[1]); box[2] = Math.max(box[2], e[2]); box[3] = Math.max(box[3], e[3]); box[4] += e[4]
        const x = q % cw, y = Math.floor(q / cw)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const nk = (y + dy) * cw + (x + dx); if (x + dx >= 0 && x + dx < cw && cells.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk) } }
      }
      boxes.push(`x${box[0]}-${box[2]} y${box[1]}-${box[3]} (${box[4]} px)`)
    }
    return { n, dims: `${A.width}x${A.height}`, boxes }
  }, [aPng.toString("base64"), bPng.toString("base64")])
  await ctx.close()
  return out
}

// A load that never settles (an earlier split hold hung the page at 834x1112) must end as a FAIL.
const within = (ms, p, what) => {
  let t
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`hung: ${what} did not finish in ${ms / 1000} s`)), ms) })]).finally(() => clearTimeout(t))
}
// Every canvas in document order: buffer, box, WebGL or 2D, and a 2D canvas's pixels.
const census = (page) => page.evaluate(() => [...document.querySelectorAll("canvas")].map((c) => {
  const r = c.getBoundingClientRect()
  return { buf: `${c.width}x${c.height}`, box: `${r.x},${r.y} ${r.width}x${r.height}`, gl: !!c.__dockSeen, px: c.__dockSeen ? null : c.toDataURL() }
}))
// The two columns' boxes: the dock panels on the lane, the flex row's two children on main.
const columns = (page) => page.evaluate(() => {
  const fmt = (e, n) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return `${n} y${r.y} h${r.height} x${r.x} w${r.width} content ${e.scrollHeight} minH ${s.minHeight}` }
  const dock = [...document.querySelectorAll("[data-dock-panel]")]
  if (dock.length) return dock.map((e) => fmt(e, e.dataset.dockPanel))
  let e = [...document.querySelectorAll("canvas")].find((c) => c.__dockSeen)
  while (e?.parentElement && !/lg:flex-row/.test(e.parentElement.className)) e = e.parentElement
  return e?.parentElement ? [...e.parentElement.children].map((k, i) => fmt(k, i ? "view3d" : "drawing")) : ["flex row not found"]
})
const frameAt = (page, p) => page.evaluate(async (p) => { window.__revealHarness.setProgress(p); await new Promise((r) => setTimeout(r, 600)); return window.__captureHarness.grab() }, p).then((u) => (typeof u === "string" ? sha(u) : "none"))

async function measure(url, sz, arm, ms) {
  const o = await within(ms, open(url, sz, arm), `${url === REF ? "main" : "lane"} load at ${sz.join("x")}`)
  try {
    return await within(ms, (async () => ({ o, png: await o.page.screenshot(), cv: await census(o.page), cols: await columns(o.page), frame: await frame(o.page), sizes: await o.page.evaluate(() => window.__dockProbe.sizes.slice()), fit: await o.page.evaluate(() => ({ fits: (window.__dockProbe.fits || []).slice(), top: window.__dockCam?.top ?? null })), reset: await resetFrame(o.page) }))(), "measuring")
  } catch (e) { await o.ctx.close().catch(() => {}); throw e }
}

async function buffers(arm, sizes) {
  for (const sz of sizes) {
    const tag = `${sz[0]}x${sz[1]}`
    let ref, lane
    try { ref = await measure(REF, sz, "clean", 60000) } catch (e) { say("BUFFERS", arm, false, `${tag}: main ${e.message}; nothing measured`); continue }
    await ref.o.ctx.close()
    try { lane = await measure(LAB_URL, sz, arm, 20000) } catch (e) { say("BUFFERS", arm, false, `${tag}: lane ${e.message}`); continue }
    if (arm === "clean" && sz[0] === 1512) { writeFileSync(`${OUT}ref-${tag}.png`, ref.png); writeFileSync(`${OUT}lane-${tag}.png`, lane.png) }
    if (arm !== "clean") writeFileSync(`${OUT}arm-${arm}-${tag}.png`, lane.png)
    const rb = ref.cv.map((c) => c.buf), lb = lane.cv.map((c) => c.buf)
    const bufOk = rb.length > 0 && JSON.stringify(rb) === JSON.stringify(lb)
    say("BUFFERS", arm, bufOk, `${tag}: ${lb.length} lane canvases against ${rb.length} on main; buffers ${bufOk ? "equal" : "DIFFER"}: main ${rb.join(" ")} | lane ${lb.join(" ")}`)
    console.log(`  boxes main ${ref.cv.map((c) => c.box).join(" | ")}\n  boxes lane ${lane.cv.map((c) => c.box).join(" | ")}`)
    console.log(`  columns main ${ref.cols.join(" | ")}\n  columns lane ${lane.cols.join(" | ")}`)
    if (arm === "clean") {
      if (!bufOk) say("FRAMES", arm, false, `${tag}: not compared, the buffers differ (a grab of two sizes is not a comparison)`)
      else {
        const bad = []
        // Graded where main's LAST framing read the canvas at its settled half-height: then the frame is
        // fixed by the layout, not by when the refit timer landed. A canvas that moved and settled before
        // the refit (1280) is graded; one still growing when it fired (834) is not.
        const fits = ref.fit.fits, held = fits.length > 0 && ref.fit.top !== null && fits[fits.length - 1] === ref.fit.top
        if (held && (ref.frame === "none" || ref.frame !== lane.frame)) bad.push(`3D frame at load main ${ref.frame} lane ${lane.frame}`)
        if (!/^[0-9a-f]{16}$/.test(ref.reset) || ref.reset !== lane.reset) bad.push(`3D frame after reset main ${ref.reset} lane ${lane.reset}`)
        ref.cv.forEach((c, i) => { if (!c.gl && c.px !== lane.cv[i].px) bad.push(`2D canvas ${i} (${c.buf})`) })
        const n2d = ref.cv.filter((c) => !c.gl).length
        const atLoad = held ? `at load ${lane.frame}, ` : ""
        say("FRAMES", arm, bad.length === 0, `${tag}: ${bad.length ? `DIFFER: ${bad.join(", ")}` : `3D frame ${atLoad}after reset ${lane.reset}, and ${n2d} of ${n2d} 2D canvases byte-identical`}`)
        console.log(`  at load: ${held ? `graded, main's last framing read the settled half-height ${ref.fit.top}` : `NOT graded, main's last framing read half-height ${fits[fits.length - 1]} against a settled ${ref.fit.top} (canvas sizes ${ref.sizes.join(" > ")}), so its at-load frame is a sample of the refit race`}; main framings read ${fits.join(", ") || "none"}; main ${ref.frame} lane ${lane.frame}`)
        say("FRAMES", "control", ref.reset !== ref.frame, `${tag}: reset control, main's frame after reset ${ref.reset} ${ref.reset !== ref.frame ? "differs from" : "EQUALS"} its frame at load ${ref.frame}${ref.reset !== ref.frame ? ", the click reframed" : ", the click did nothing"}`)
      }
      if (sz[0] === 1512) {
        const half = await within(20000, frameAt(lane.o.page, 0.5), "control grab")
        const full = await within(20000, frameAt(lane.o.page, 1), "control grab")
        say("FRAMES", "control", half !== full && full === lane.reset, `positive control: frame at progress 0.5 ${half}, at 1 ${full} (${half !== full ? "differ, the grab sees the scene" : "EQUAL, the grab is blind"}${full === lane.reset ? "" : "; the regrab at 1 did not return to the frame before it"})`)
      }
    }
    const sash = await lane.o.page.evaluate(() => [...document.querySelectorAll(".dv-sash")].map((s) => getComputedStyle(s).pointerEvents).join(",") || "none")
    await lane.o.ctx.close()
    const d = await diff(ref.png, lane.png)
    console.log(`  PAGE (report only) ${arm} ${tag}: ${d.n} px differ of ${d.dims}${d.boxes.length ? ` in ${d.boxes.length} region(s): ${d.boxes.slice(0, 8).join("; ")}` : ""}; sash pointer-events ${sash}`)
  }
}

async function survives(arm) {
  const { ctx, page, blank } = await open(LAB_URL, [1512, 982], arm)
  const armed = await page.evaluate((src) => { const b = new Function(`return (${src})()`)(); window.__dockBase = b; return !!(b && b.gl && b.scene && window.__dockHarness) }, IDENT.toString())
  if (!armed) { say("SURVIVES", arm, false, "the 3D canvas, its context, scene or the dock harness was not reachable; nothing below would measure anything"); await ctx.close(); return }
  const base = { snap: await snap(page), draw: await drawHash(page), frame: await frame(page) }
  const again = await frame(page)
  console.log(`  base ${base.snap.size} contexts ${base.snap.made} frame ${base.frame} (regrab ${again === base.frame ? "equal" : "DIFFERS, frame hash is not stable"}) drawing ${base.draw}${base.draw === blank ? " = BLANK, logo not drawn" : ""}`)
  const check = async (step, extra = "") => {
    await settle(page, 1200)
    const s = await snap(page), dr = await drawHash(page), fr = await frame(page)
    const bad = []
    if (!s.sameNode) bad.push("canvas node replaced")
    if (!s.sameGL) bad.push("WebGL context replaced")
    if (!s.sameScene) bad.push("scene replaced")
    if (s.lost) bad.push(`webglcontextlost x${s.lost}`)
    if (s.made !== base.snap.made) bad.push(`contexts made ${base.snap.made} -> ${s.made}`)
    if (dr !== base.draw || dr === blank) bad.push("drawing layers changed")
    if (s.size !== base.snap.size) bad.push(`size ${base.snap.size} -> ${s.size}`)
    if (fr !== base.frame) bad.push(`frame ${base.frame} -> ${fr}`)
    say("SURVIVES", arm, bad.length === 0 && again === base.frame && base.draw !== blank, `${step}${extra}: ${bad.length ? bad.join(", ") : "same node, context, scene; 0 lost; drawing and frame equal"}`)
  }
  // (a) into the drawing's group as a tab, then back out to its right
  await page.evaluate(() => { const a = window.__dockHarness.api, d = a.getPanel("drawing"), v = a.getPanel("view3d"); v.api.moveTo({ group: d.group, position: "center" }) })
  await settle(page, 800)
  const mid = await page.evaluate(() => window.__dockHarness.api.groups.length)
  await page.evaluate(() => { const a = window.__dockHarness.api, d = a.getPanel("drawing"), v = a.getPanel("view3d"); v.api.moveTo({ group: d.group, position: "right" }) })
  await check("(a) move to the drawing's group and back", ` (groups while moved: ${mid})`)
  // (b) maximize and restore
  await page.evaluate(() => window.__dockHarness.api.getPanel("view3d").api.maximize())
  await settle(page, 1000)
  const max = await snap(page)
  await page.evaluate(() => window.__dockHarness.api.getPanel("view3d").api.exitMaximized())
  await check("(b) maximize and restore", ` (maximized ${max.maximized}, ${max.size})`)
  // (d) into the drawing's group as a tab BEHIND the drawing, so the 3D panel is hidden, then back out
  await page.evaluate(() => { const a = window.__dockHarness.api, d = a.getPanel("drawing"), v = a.getPanel("view3d"); v.api.moveTo({ group: d.group, position: "center" }); d.api.setActive() })
  await settle(page, 1000)
  const hid = await page.evaluate(() => { const a = window.__dockHarness.api, v = a.getPanel("view3d"), b = window.__dockBase; return { visible: v.api.isVisible, active: a.getPanel("drawing").api.isActive, same: v.group === a.getPanel("drawing").group, connected: b.c.isConnected, glLost: b.gl.isContextLost() } })
  console.log(`  (d) while hidden: 3D visible ${hid.visible}, drawing active ${hid.active}, one group ${hid.same}, canvas in document ${hid.connected}, context lost ${hid.glLost}`)
  if (hid.visible !== false || !hid.same) say("SURVIVES", arm, false, "(d) the 3D panel never hid behind the drawing; this step cannot tell the renderers apart")
  else if (!hid.connected) say("SURVIVES", arm, false, "(d) hidden behind the drawing: the 3D canvas LEFT THE DOCUMENT (removed, not display:none)")
  await page.evaluate(() => { const a = window.__dockHarness.api, d = a.getPanel("drawing"), v = a.getPanel("view3d"); v.api.moveTo({ group: d.group, position: "right" }) })
  await check("(d) hidden as a tab behind the drawing and back", ` (while hidden: in document ${hid.connected}, context lost ${hid.glLost})`)
  // (c) 20 consecutive loads of the layout it is already in
  const loads = await page.evaluate(async () => {
    const h = window.__dockHarness, j = h.api.toJSON()
    for (let i = 0; i < 20; i++) { h.load(j); await new Promise((r) => requestAnimationFrame(r)) }
    return h.api.panels.length
  })
  await check("(c) 20 fromJSON loads", ` (${loads} panels after)`)

  // DRAW, on the same page after the 20 loads
  const d0 = await drawHash(page), f0 = await frame(page)
  const box = await page.evaluate(() => { const r = document.querySelector('[data-dock-panel="drawing"]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
  await page.mouse.move(box.x + box.w * 0.15, box.y + box.h * 0.2)
  await page.mouse.down()
  for (let i = 1; i <= 24; i++) await page.mouse.move(box.x + box.w * (0.15 + 0.012 * i), box.y + box.h * (0.2 + 0.006 * i * (i % 2 ? 1 : 0.6)), { steps: 2 })
  await page.mouse.up()
  await page.waitForTimeout(1500)
  await page.evaluate((st) => { window.__styleHarness.setStyle(st); window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) }, STILL)
  await settle(page, 1500)
  const d1 = await drawHash(page), f1 = await frame(page), after = await snap(page)
  say("DRAW", arm, d1 !== d0 && f1 !== f0 && after.sameNode && after.sameGL, `stroke after 20 loads: drawing ${d1 !== d0 ? "changed" : "UNCHANGED"}, 3D frame ${f1 !== f0 ? "changed" : "UNCHANGED"}, ${after.sameNode && after.sameGL ? "same canvas and context" : "canvas or context replaced"}`)
  if (arm === "clean") writeFileSync(`${OUT}lane-after-draw-1512x982.png`, await page.screenshot())
  await ctx.close()
}

try {
  if (ONLY !== "arms") {
    // Warm the lane's route untimed, so the 20 s watchdog measures a load, not a first compile.
    const w = await open(LAB_URL, SIZES[0], "clean"); await w.ctx.close()
    await buffers("clean", SIZES); await survives("clean")
  }
  if (ONLY !== "clean") {
    await buffers("header", [SIZES[0]])
    for (const arm of ["noReuse", "onlyWhenVisible", "stale"]) await survives(arm)
  }
} finally {
  await browser.close()
}

const clean = results.filter((r) => r.arm === "clean")
const fired = (row, arm) => results.some((r) => r.row === row && r.arm === arm && !r.ok)
const need = [["BUFFERS", "header"], ["SURVIVES", "noReuse"], ["SURVIVES", "onlyWhenVisible"], ["DRAW", "stale"]]
const control = results.filter((r) => r.arm === "control")
const controlOk = ONLY === "arms" || (control.length > 0 && control.every((r) => r.ok))
writeFileSync(`${OUT}result.json`, JSON.stringify({ served: LAB_URL, ref: REF, date: new Date().toISOString(), results }, null, 2))
if (ONLY !== "clean") for (const [row, arm] of need) console.log(`MUST-FAIL ${row} [${arm}] ${fired(row, arm) ? "fired" : "DID NOT FIRE"}`)
const armsOk = ONLY === "clean" || need.every(([row, arm]) => fired(row, arm))
console.log(`CLEAN ${clean.filter((r) => r.ok).length}/${clean.length} PASS · CONTROL ${controlOk ? "sees" : "BLIND OR NOT RUN"} · ARMS ${armsOk ? "all fired" : "NOT all fired"}`)
process.exit(clean.every((r) => r.ok) && controlOk && armsOk ? 0 : 1)

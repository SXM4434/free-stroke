#!/usr/bin/env node
// F122 · THE FRAME AFTER A RESIZE IS THE FRAME THE PAGE SETTLES ON.
//
// three 0.175's `setSize` floors the drawing buffer (`canvas.width =
// floor(w * pr)`) but rounds the viewport. On a canvas 755.5 CSS px wide every
// frame squeezed a 756 px viewport into a 755 px buffer, a 1/755 stretch in x,
// until something called `setRenderTarget(null)`. On `/` only drei's
// <Environment> does that, when its host re-renders. `syncViewportToBuffer` in
// components/viewport-3d.tsx points the viewport at the buffer right after every
// `setSize`: R3F's resize (a store subscriber in Scene) and the still export.
//
// Rows, each graded on a fresh page:
//   1  Preset panel opens: the first frame at the new buffer size equals the
//      frame after `setStyle({})` settles it.
//   2  Window 1512x982 to 1400x900: the first frame equals the frame after
//      `setRenderTarget(null)`, the call that settled it on main.
//   3  Still export through the PNG button at 1x, 2x and 4x: every render while
//      it runs draws a viewport the size of the buffer, and so does the screen
//      after it. At 1x on Transparent the PNG equals the screen frame (grid and
//      shadow hidden on both) pixel for pixel. The UI offers 1x, 2x and 4x; on an x.5 px canvas only 1x lands
//      on a half pixel, so 1x is the arm that can go red.
//   4  No resize: the untouched, dither and ASCII frames are byte-identical to
//      main's, recorded before the fix with `--record` (two loads must agree).
//   5  F123 · After the row 2 window resize has settled, a later unrelated
//      re-render (`setStyle({})`) moves 0 px, and the form's world width holds.
//      The stroke-to-world frame is read once, from the window Viewport3D
//      mounted in; main read it on every render, so the resize reached the
//      form only at whatever re-rendered Viewport3D next.
//
// MUST-FAIL ARMS. `window.__fsViewportSync = "off"`, set before navigation,
// parks main's rounding: rows 1-3 MUST go red on it. Row 4 must stay green on
// it, because that arm IS main; row 4's own must-fail is a viewport written by
// hand one px wider than the buffer, which must change the hash. Row 5's arm is
// `window.__fsStrokeFrame = "live"`, main's per-render read of the window,
// with the viewport sync on: row 5 MUST go red on it.
//
// Corpus: `/` at dpr 1, headless, the docked layout main ships. It does not see
// dpr 2 (a 755.5 px canvas is 1511 exact there; x.25 widths would still show it)
// or the 3-Up compare canvases.
//
// BASE PROVENANCE (HARDEN-B4). Row 4's base comes from a8c03f2c8, the parent of
// the fix f494b6349, so main before F122-B. The server's commit comes from
// lib/server-commit.mjs serverCommit(FS_PORT), never from the --base label.
// `--record` exits 2 unless --base names a8c03f2c8 (the default), that server is
// clean under app, components, lib, hooks, styles AND its HEAD is the commit the
// label resolves to. It reads the server again after the run and writes nothing
// if the pid, HEAD or cleanliness changed; the file stores { sha, recordedFrom, at }.
// Compare mode exits 2 on a base file that is missing or has no 40-hex sha,
// before it reads the server. When the base's sha equals the served HEAD, or
// has no code difference from it (codeDiffers), row 4 and its must-fail read
// SELF: the tree compared to itself, never PASS, outside the graded count, named
// in the summary. SELF rows count toward the row total, so the total check
// holds, and a SELF row does not by itself fail the run.
//
// FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-resize-settles.mjs [--record [--base=a8c03f2c8]]
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { execFileSync } from "node:child_process"
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
const { openStyle } = await import("./lib/dock.mjs")

const OUT = new URL("../../docs/verification/resize/", import.meta.url).pathname
const HASHES = `${OUT}main-hashes.json`
const RECORD = process.argv.includes("--record")
const STILL = { motionMode: "off", materialAnimationEnabled: false, textureAnimated: false, ditherAnimated: false, asciiAnimated: false, stackAnimationEnabled: false, fusionAnimationEnabled: false }
const LOOKS = [["untouched", {}], ["dither", { ditherEnabled: true, ditherScale: 7 }], ["ascii", { asciiEnabled: true }]]
const sha = (u) => createHash("sha256").update(Buffer.from(u.split(",")[1], "base64")).digest("hex").slice(0, 16)
const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines

const RESIZE_BASE = "a8c03f2c8"
const refuse = (msg) => { console.log(`REFUSED  ${msg}`); process.exit(2) }
const baseArg = (process.argv.find((a) => a.startsWith("--base=")) ?? `--base=${RESIZE_BASE}`).slice(7)
if (RECORD && baseArg !== RESIZE_BASE) refuse(`--base=${baseArg}: row 4's base is ${RESIZE_BASE}, the commit before the fix f494b6349`)
// Compare mode: a missing or unlabelled base is refused before any server is read.
let baseRec = null
if (!RECORD) {
  if (!existsSync(HASHES)) refuse(`${HASHES} is missing; record it with --record --base=${RESIZE_BASE} against a clean ${RESIZE_BASE} server`)
  baseRec = JSON.parse(readFileSync(HASHES, "utf8"))
  if (!(typeof baseRec.sha === "string" && /^[0-9a-f]{40}$/.test(baseRec.sha))) refuse(`${HASHES} has no stored sha (got ${JSON.stringify(baseRec.sha)}); record it again with --record --base=${RESIZE_BASE}`)
}
const { serverCommit, codeDiffers } = await import("./lib/server-commit.mjs")
const PORT = Number(new URL(LAB_URL).port || 80)
let srv
try { srv = serverCommit(PORT) } catch (e) { refuse(e.message) }
console.log(`server :${PORT} pid ${srv.pid} cwd ${srv.cwd} head ${srv.head}${srv.dirty ? " DIRTY" : " clean"}`)
if (RECORD) {
  let labelSha
  try { labelSha = execFileSync("git", ["-C", srv.top, "rev-parse", "--verify", "--quiet", `${baseArg}^{commit}`], { encoding: "utf8" }).trim() } catch { refuse(`--base=${baseArg} does not name a commit in the server's repo ${srv.top}`) }
  if (srv.dirty) refuse(`the server on :${PORT} (${srv.cwd}) has uncommitted changes under app, components, lib, hooks or styles; a base is recorded from a clean tree only`)
  if (srv.head !== labelSha) refuse(`--base=${baseArg} is ${labelSha}, but the server on :${PORT} (${srv.cwd}) runs ${srv.head}`)
}
// SELF: the base's code is the served code, so row 4 compares the tree to itself.
let isSelf = false
if (!RECORD) try { isSelf = baseRec.sha === srv.head || !codeDiffers(srv, baseRec.sha) } catch (e) { refuse(e.message) }
const selfNote = () => `; base ${baseRec.sha.slice(0, 9)} has the served code (${srv.head.slice(0, 9)}), so this compares the tree to itself`

const browser = await chromium.launch()
const results = []
const say = (row, arm, ok, detail) => {
  const self = isSelf && (row === 4 || row === "4-mf")
  results.push({ row, arm, ok, self })
  console.log(`${self ? "SELF" : ok ? "PASS" : "FAIL"}  ${row} [${arm}] ${detail}${self ? selfNote() : ""}`)
}

async function open(arm) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1, acceptDownloads: true })
  const page = await ctx.newPage()
  if (arm === "off") await page.addInitScript(() => { window.__fsViewportSync = "off" })
  if (arm === "live") await page.addInitScript(() => { window.__fsStrokeFrame = "live" })
  page.on("pageerror", (e) => console.log(`  pageerror: ${e.message}`))
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  // The R3F store, reached through the fiber: <Scene>'s controlsRef holds the
  // camera and the camera holds its root. No hook is added to the page.
  const reached = await page.evaluate(() => {
    const c = document.querySelector("canvas[data-engine]") || [...document.querySelectorAll("canvas")].find((x) => x.width > 300)
    let f = c[Object.keys(c).find((k) => k.startsWith("__reactFiber$"))], ctl = null
    const hit = (p) => { if (!p) return null; if (p.controlsRef) return p.controlsRef; for (const x of [].concat(p.children)) if (x?.props?.controlsRef) return x.props.controlsRef; return null }
    while (f && !ctl) { ctl = hit(f.memoizedProps); f = f.return }
    window.__rsStore = ctl?.current?.object?.__r3f?.root ?? ctl?.current?.__r3f?.root ?? null
    return !!window.__rsStore
  })
  if (!reached) throw new Error("R3F store not reachable through the fiber; the rows below would measure nothing")
  const x = helpers(page)
  await x.still(); await x.settle(800)
  return { ctx, page, ...x }
}

function helpers(page) {
  const raf2 = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const settle = async (ms) => { await page.waitForTimeout(ms); await raf2() }
  return {
    raf2, settle,
    still: () => page.evaluate((st) => { window.__styleHarness.setStyle(st); window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) }, STILL),
    grab: () => page.evaluate(() => window.__captureHarness.grab()),
    size: () => page.evaluate(() => { const i = window.__captureHarness.grabInfo(); return `${i.width}x${i.height}` }),
    // viewport as GL holds it, against the buffer
    // world width of the form: every visible mesh outside the fsChrome groups
    formW: () => page.evaluate(() => {
      const chrome = (o) => { for (let p = o; p; p = p.parent) if (p.userData?.fsChrome) return true; return false }
      let lo = Infinity, hi = -Infinity, n = 0
      window.__rsStore.getState().scene.traverse((o) => {
        if (!o.isMesh || !o.visible || chrome(o) || !o.geometry?.attributes?.position) return
        o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)
        lo = Math.min(lo, b.min.x); hi = Math.max(hi, b.max.x); n++
      })
      return n ? Math.round((hi - lo) * 1e4) / 1e4 : null
    }),
    vp: () => page.evaluate(() => { const gl = window.__rsStore.getState().gl, c = gl.getContext(), v = c.getParameter(c.VIEWPORT); return { vw: v[2], vh: v[3], bw: gl.domElement.width, bh: gl.domElement.height, css: gl.domElement.getBoundingClientRect().width } }),
  }
}
const vpStr = (v) => `viewport ${v.vw}x${v.vh} on buffer ${v.bw}x${v.bh} (css ${v.css})`
const vpOk = (v) => v.vw === v.bw && v.vh === v.bh

async function diff(page, a, b) {
  return page.evaluate(async ([a, b]) => {
    const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u })
    const [ia, ib] = await Promise.all([load(a), load(b)])
    if (ia.width !== ib.width || ia.height !== ib.height) return { n: -1, text: `size ${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` }
    const px = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data }
    const da = px(ia), db = px(ib)
    let n = 0, max = 0
    for (let k = 0; k < da.length; k += 4) { const d = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2]), Math.abs(da[k + 3] - db[k + 3])); if (d) { n++; max = Math.max(max, d) } }
    return { n, text: `${n} px differ of ${ia.width}x${ia.height}, max ${max}` }
  }, [a, b])
}

// Row 4's frames. Each look is set, settled, grabbed, and undone.
async function looks(s) {
  const out = {}
  for (const [name, st] of LOOKS) {
    if (Object.keys(st).length) await s.page.evaluate((x) => window.__styleHarness.setStyle(x), st)
    await s.settle(800)
    out[name] = { hash: sha(await s.grab()), size: await s.size(), vp: vpStr(await s.vp()) }
    if (Object.keys(st).length) { await s.page.evaluate(() => window.__styleHarness.undo()); await s.still(); await s.settle(600) }
  }
  return out
}

// Rows 1 and 2: the first frame at the new buffer size, against the settled one.
async function resizeRow(s, row, arm, act, label, settleBy = "style") {
  const before = await s.size()
  const v0 = await s.vp()
  await act()
  await s.page.waitForFunction((b) => { const i = window.__captureHarness.grabInfo(); return `${i.width}x${i.height}` !== b }, before, { polling: "raf", timeout: 10000 })
  await s.raf2()
  const a1 = await s.grab(); const va = await s.vp()
  await s.settle(600); const a3 = await s.grab()
  // Settle: the panel row uses the product's own path, `setStyle({})`, whose
  // re-render reaches drei's <Environment> and its `setRenderTarget(null)`. The
  // window row calls `setRenderTarget(null)` directly, so it grades F122 alone;
  // the `setStyle({})` after it is row 5 (F123).
  if (settleBy === "target") await s.page.evaluate(() => window.__rsStore.getState().gl.setRenderTarget(null))
  else await s.page.evaluate(() => window.__styleHarness.setStyle({}))
  await s.settle(600); const b = await s.grab(); const vb = await s.vp()
  const d1 = await diff(s.page, a1, b), d3 = await diff(s.page, a3, b)
  say(row, arm, d1.n === 0 && d3.n === 0,
    `${label}: ${before} -> ${await s.size()} (before: ${vpStr(v0)}). A1 vs B settled by ${settleBy === "target" ? "setRenderTarget(null)" : "setStyle({})"}: ${d1.text}; A3 (600 ms) vs B: ${d3.text}. A1 ${vpStr(va)}; B ${vpStr(vb)}`)
  if (settleBy === "target") {
    // Row 5: the resize has settled; an unrelated re-render must not move the form.
    const w0 = await s.formW()
    await s.page.evaluate(() => window.__styleHarness.setStyle({})); await s.settle(600)
    const c = await s.grab(), w1 = await s.formW(), d5 = await diff(s.page, b, c)
    say(5, arm, d5.n === 0 && w0 !== null && w0 === w1,
      `window resize settled, then setStyle({}): ${d5.text}; form world width ${w0} -> ${w1}${w0 === null ? " (BLIND: no form mesh found)" : ""}`)
    if (arm !== "off") writeFileSync(`${OUT}f123-${arm}-after-setstyle.png`, Buffer.from(c.split(",")[1], "base64"))
  }
  return { a1, b }
}

// Row 3: a still export through the PNG button, logging the viewport at every
// on-screen render (render target null) from the click to the download.
async function exportRow(s, arm) {
  await s.page.evaluate(() => {
    const gl = window.__rsStore.getState().gl, orig = gl.render.bind(gl)
    window.__rsLog = null
    gl.render = (scene, cam) => { orig(scene, cam); if (window.__rsLog && gl.getRenderTarget() === null) { const c = gl.getContext(), v = c.getParameter(c.VIEWPORT); window.__rsLog.push([v[2], v[3], gl.domElement.width, gl.domElement.height]) } }
  })
  // Since L3 the export controls are the dock's Export panel, which loads
  // folded; it is opened once, before the rows below measure anything.
  await s.page.evaluate(() => window.__dockHarness?.dock.open("export"))
  await s.page.waitForTimeout(400)
  const openPanel = async () => {
    const btn = s.page.getByRole("button", { name: "PNG export settings" })
    if ((await btn.getAttribute("aria-expanded")) !== "true") { await btn.click(); await s.page.waitForTimeout(200) }
  }
  const lines = [], bad = []
  let exportDraws = 0, pixel = null
  await openPanel()
  await s.page.getByRole("button", { name: "Transparent", exact: true }).click()
  await s.page.waitForTimeout(150)
  for (const label of ["1×", "2×", "4×"]) {
    await openPanel()
    await s.page.getByRole("button", { name: label, exact: true }).click()
    await s.page.waitForTimeout(150)
    // At 1x on a Transparent ground the export is the screen's own buffer with
    // the grid and contact shadow hidden, so hide them on screen and grab it.
    let screen = null
    if (label === "1×") {
      await s.page.evaluate(() => { window.__rsHidden = []; window.__rsStore.getState().scene.traverse((o) => { if (o.userData?.fsChrome && o.visible) { o.visible = false; window.__rsHidden.push(o) } }) })
      await s.raf2(); screen = await s.grab()
    }
    await s.page.evaluate(() => { window.__rsLog = [] })
    const [dl] = await Promise.all([s.page.waitForEvent("download", { timeout: 60000 }), s.page.getByRole("button", { name: "PNG", exact: true }).click()])
    const file = await dl.path()
    if (screen) {
      const d = await diff(s.page, screen, `data:image/png;base64,${readFileSync(file).toString("base64")}`)
      pixel = d
      if (d.n !== 0) bad.push(`1× export vs screen: ${d.text}`)
      if (arm === "fix") writeFileSync(`${OUT}settles-export-1x.png`, readFileSync(file))
      await s.page.evaluate(() => { for (const o of window.__rsHidden) o.visible = true })
    }
    const log = await s.page.evaluate(() => { const l = window.__rsLog; window.__rsLog = null; return l })
    const big = log.filter(([, , bw]) => bw > 800)
    exportDraws += big.length
    const off = log.filter(([vw, vh, bw, bh]) => vw !== bw || vh !== bh)
    for (const o of off) bad.push(`${label} ${o[0]}x${o[1]} on ${o[2]}x${o[3]}`)
    await s.raf2()
    const v = await s.vp()
    if (!vpOk(v)) bad.push(`${label} screen after export ${vpStr(v)}`)
    lines.push(`${label}: ${log.length} renders (${big.length} at export size), ${off.length} off; screen after: ${vpStr(v)}`)
  }
  // Positive control: the log saw the export's own renders at 2x and 4x.
  say(3, arm, bad.length === 0 && exportDraws >= 2 && pixel !== null,
    `1× export vs screen (chrome hidden): ${pixel?.text ?? "NOT MEASURED"} | ${lines.join(" | ")}${bad.length ? ` | OFF: ${bad.slice(0, 4).join(", ")}` : ""}${exportDraws < 2 ? " | BLIND: no export-size render logged" : ""}`)
}

try {
  if (RECORD) {
    const runs = []
    for (let i = 0; i < 2; i++) { const s = await open("fix"); runs.push(await looks(s)); await s.ctx.close() }
    const agree = LOOKS.every(([n]) => runs[0][n].hash === runs[1][n].hash)
    console.log(JSON.stringify(runs, null, 1))
    // The server must still be the one checked before the run: same pid, same
    // HEAD, still clean. Otherwise nothing is written.
    let after
    try { after = serverCommit(PORT) } catch (e) { await browser.close(); refuse(`after the run: ${e.message}`) }
    if (after.pid !== srv.pid || after.head !== srv.head || after.dirty) await browser.close(), refuse(`the server changed during the run: pid ${srv.pid} -> ${after.pid}, head ${srv.head} -> ${after.head}, dirty ${after.dirty}; nothing written`)
    if (!agree) { console.log("FAIL  two loads of main disagree; nothing recorded"); process.exitCode = 1 }
    else { mkdirSync(OUT, { recursive: true }); writeFileSync(HASHES, JSON.stringify({ base: baseArg, sha: srv.head, recordedFrom: srv.cwd, at: new Date().toISOString(), note: `no-resize frames at 1512x982 dpr 1 from ${baseArg}, main before the F122-B fix f494b6349; two loads agreed`, frames: runs[0] }, null, 1) + "\n"); console.log(`recorded ${HASHES} sha ${srv.head} from ${srv.cwd}`) }
  } else {
    const main = baseRec.frames
    for (const arm of ["fix", "off"]) {
      const s = await open(arm)
      const got = await looks(s)
      const same = LOOKS.filter(([n]) => got[n].hash === main[n].hash).length
      say(4, arm, same === LOOKS.length, `no resize: ${same} of ${LOOKS.length} frames byte-identical to main (${LOOKS.map(([n]) => `${n} ${got[n].hash}${got[n].hash === main[n].hash ? "" : ` vs ${main[n].hash}`}`).join(", ")}); ${got.untouched.vp}`)
      if (arm === "fix") {
        // Row 4 must-fail: a viewport written by hand one px wider than the buffer.
        await s.page.evaluate(() => { const gl = window.__rsStore.getState().gl, pr = gl.getPixelRatio(); gl.setViewport(0, 0, (gl.domElement.width + 1) / pr, gl.domElement.height / pr) })
        await s.raf2()
        const h = sha(await s.grab())
        say("4-mf", arm, h !== main.untouched.hash, `hand-written 1 px wider viewport changes the untouched hash: ${h} vs ${main.untouched.hash}`)
        await s.page.evaluate(() => { const gl = window.__rsStore.getState().gl, pr = gl.getPixelRatio(); gl.setViewport(0, 0, gl.domElement.width / pr, gl.domElement.height / pr) })
        await s.raf2()
      }
      // L4: the Presets family in the Style panel, shown from the rail: the resize that opening it causes.
      const r1 = await resizeRow(s, 1, arm, () => openStyle(s.page, "presets"), "Preset panel open")
      if (arm === "fix") for (const [n, u] of [["panel-a1", r1.a1], ["panel-b", r1.b]]) writeFileSync(`${OUT}settles-${n}.png`, Buffer.from(u.split(",")[1], "base64"))
      await exportRow(s, arm)
      await s.ctx.close()
      const w = await open(arm)
      await resizeRow(w, 2, arm, () => w.page.setViewportSize({ width: 1400, height: 900 }), "window 1512x982 -> 1400x900", "target")
      await w.ctx.close()
    }
    // Row 5's must-fail: main's per-render window read, viewport sync on.
    const l = await open("live")
    await resizeRow(l, 2, "live", () => l.page.setViewportSize({ width: 1400, height: 900 }), "window 1512x982 -> 1400x900", "target")
    await l.ctx.close()
    // Rows 1-3 must pass on the fix and fail on the parked arm; row 4 passes on
    // both; row 5 passes on the fix and fails on the live arm.
    const ok = (row, arm) => results.find((r) => r.row === row && r.arm === arm)?.ok
    const verdict = [1, 2, 3].map((r) => [r, ok(r, "fix") === true && ok(r, "off") === false])
      .concat([[4, ok(4, "fix") === true && ok(4, "off") === true && ok("4-mf", "fix") === true]])
      .concat([[5, ok(5, "fix") === true && ok(5, "live") === false]])
    const why = { 4: "identical on both arms, and the hand-written viewport moves it", 5: "0 px with the fix, red with __fsStrokeFrame live" }
    // Row 4 reads SELF when its base is the served code: never GRADED, never
    // BROKEN, and it still counts toward the total so the check below holds.
    const selfRows = isSelf ? [4] : []
    for (const [r, v] of verdict) console.log(selfRows.includes(r) ? `SELF    row ${r}: no-resize frames against base ${baseRec.sha.slice(0, 9)}, the served code; not graded` : `${v ? "GRADED" : "BROKEN"}  row ${r}: ${why[r] ?? "green with the fix, red with __fsViewportSync off"}`)
    const n = verdict.filter(([r, v]) => v && !selfRows.includes(r)).length
    console.log(`${n}/${verdict.length - selfRows.length} rows graded; ${selfRows.length} SELF, not graded${selfRows.length ? ": row " + selfRows.join(", row ") : ""}`)
    if (n + selfRows.length !== verdict.length) process.exitCode = 1
  }
} finally {
  await browser.close()
}

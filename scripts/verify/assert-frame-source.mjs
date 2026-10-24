// WHERE THE FORM SITS IN THE 3D VIEW WHEN THE DRAWING PANEL IS NOT HALF THE WINDOW (CL-F123, 2026-10-02).
//
// THE LEAD (CL-GATES-2): F123 (`components/viewport-3d.tsx`, `loadFrame`) reads the stroke-to-world frame
// once at mount as innerWidth/2 x innerHeight-48, the drawing column of the pre-L4 two-column page. Since L4
// the dockview panels can be resized and moved, so the drawing canvas is no longer that size, and the lead
// was that the 3D framing comes out wrong whenever the split is not even.
//
// WHAT THIS GATE MEASURED, 1512x982, Draw workspace, the split set through dockview and the page reloaded so
// F123 runs at mount at that split: F123 read 756x934 at every split (it never reads the split); the drawing
// canvas was 732x870 (even), 512x870 (35%), 951x870 (65%). The same 400 px wide logo, drawn at the drawing
// canvas's centre, rendered 306x223 px in the 3D view at all three, centred to 0.001 of the canvas. The
// camera frames the form's bounds, so the frame's offset moves the form in the world, never in the view.
// The lead is dead for framing. What the offset DOES move is the form against the ground grid: the frame
// centre is 12 px (even), 122 px (35%) and 97.5 px (65%) from the canvas centre, and the grid's main axis
// crosses the word at a different letter at each split. FRAME INPUTS prints that offset; it is not graded.
// The box is the camera's fit, so it barely sees scale: the `scale` arm's 15% smaller logo rendered 307x224
// against 306x223. The pixel count sees it (13.4% more): the rod keeps its world width while the form
// shrinks, so the count is the row that catches a frame whose scale moves with the split.
//
// ROWS, each split against the even split:
//   FRAMING     the form's box in the 3D view: width and height within SIZE_TOL px, centre within
//               CENTRE_TOL of the canvas, drawn pixel count within COUNT_TOL. This is what the lead said moves.
//   INSTRUMENT  two grabs of the unchanged scene differ by 0 px (noise), the drawn scene twice by 0 px, and
//               the form is found and is smaller than the canvas (positive control: it can SEE the form).
//   FRAME INPUTS F123's read against the drawing canvas, printed, not graded. Read from the source line: if
//               the `loadFrame` expression changed, the row says NOT COMPARED instead of printing stale inputs.
//
// THE PAIR: the form's pixels are the drawn 3D canvas against the same canvas with the reveal at 0. A grab
// taken before the strokes land differs everywhere (the empty state and scene change once strokes exist)
// and reads the whole canvas as the form: the first probe of this gate did exactly that.
//
// MUST-FAIL ARMS, `FRAME_SOURCE_MUTATE`, each must exit 1:
//   scale   the logo is drawn 15% smaller at 35% and 65%, so the FRAMING rows must go red
//   blind   the pair is the before-strokes grab, so INSTRUMENT must go red (the form fills the canvas)
// The old `innerWidth / 2` read cannot be a must-fail here: it is the code under test, and it passes.
//
// CORPUS: the largest canvas under [data-dock-panel="view3d"] and [data-dock-panel="drawing"], one window
// (1512x982, dpr 1), the default Draw workspace, Rod, motion off. Not covered: other windows, a panel moved
// into another group, motion modes that turn about the world origin, and stroke width against form size.
//
//   FS_HEADED=0 FS_PORT=3138 node scripts/verify/assert-frame-source.mjs
//   FRAME_SOURCE_MUTATE=scale FS_HEADED=0 FS_PORT=3138 node scripts/verify/assert-frame-source.mjs
import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync, readFileSync } from "node:fs"
import sharp from "sharp"
import { readCanvases } from "./lib/dock-size.mjs"
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")

const ARMS = ["scale", "blind"]
const MUTATE = process.env.FRAME_SOURCE_MUTATE ?? ""
if (MUTATE && !ARMS.includes(MUTATE)) throw new Error(`FRAME_SOURCE_MUTATE=${MUTATE} is not an arm. Use one of: ${ARMS.join(", ")}.`)
if (MUTATE) console.log(`[frame-source] MUST-FAIL ARM FRAME_SOURCE_MUTATE=${MUTATE} is on. The gate has to exit 1.`)
const OUT = new URL("../../docs/verification/frame-source/", import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const SPLITS = [["even", 0.5], ["35", 0.35], ["65", 0.65]]
const SIZE_TOL = 2, CENTRE_TOL = 0.005, COUNT_TOL = 0.01
const STILL = { motionMode: "off", materialAnimationEnabled: false, textureAnimated: false, ditherAnimated: false, asciiAnimated: false, stackAnimationEnabled: false, fusionAnimationEnabled: false }
const RAW = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const LOGO_W = 400
// The logo at LOGO_W px wide, centred in the drawing canvas: where a person draws, in the canvas's own px.
const placed = ([cw, ch], w) => {
  const p = RAW.flat(), x0 = Math.min(...p.map((q) => q.x)), x1 = Math.max(...p.map((q) => q.x)), y0 = Math.min(...p.map((q) => q.y)), y1 = Math.max(...p.map((q) => q.y))
  const k = w / (x1 - x0), ox = cw / 2 - ((x1 - x0) * k) / 2, oy = ch / 2 - ((y1 - y0) * k) / 2
  return RAW.map((l) => l.map((q) => ({ x: ox + (q.x - x0) * k, y: oy + (q.y - y0) * k })))
}
const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16)
const raf2 = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const f = (n, d = 3) => (typeof n === "number" ? n.toFixed(d) : String(n))

// F123's inputs, from the source, so a changed read is named and never reported with stale numbers.
const SRC = readFileSync(new URL("../../components/viewport-3d.tsx", import.meta.url), "utf8")
const F123_READ = /\{ w: window\.innerWidth \/ 2, h: window\.innerHeight - 48 \}/.test(SRC)

async function grab(page, id) {
  const r = await page.evaluate((id) => {
    const c = [...document.querySelectorAll(`[data-dock-panel="${id}"] canvas`)].map((c) => c.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height)[0]
    return c ? { x: c.x, y: c.y, w: c.width, h: c.height } : null
  }, id)
  if (!r) throw new Error(`no canvas under [data-dock-panel="${id}"]`)
  const png = await page.screenshot({ clip: { x: r.x, y: r.y, width: r.w, height: r.h } })
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
  return { data, w: info.width, h: info.height, ch: info.channels }
}
function diff(a, b) {
  if (a.w !== b.w || a.h !== b.h) return { n: -1, why: `size ${a.w}x${a.h} vs ${b.w}x${b.h}` }
  let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const i = (y * a.w + x) * a.ch
    if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) {
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
    }
  }
  if (!n) return { n }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1
  return { n, box: [x0, y0, bw, bh], cx: (x0 + bw / 2) / a.w, cy: (y0 + bh / 2) / a.h, whole: bw >= a.w - 1 && bh >= a.h - 1 }
}
const ready = (page) => page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__dockHarness?.api && document.querySelector('[data-dock-panel="view3d"] canvas') && document.querySelector('[data-dock-panel="drawing"] canvas'), null, { timeout: 240000 })

const results = []
const say = (row, ok, detail) => { results.push({ row, ok }); console.log(`${ok === null ? "NOTE" : ok ? "PASS" : "FAIL"}  ${row}  ${detail}`) }

const browser = await chromium.launch()
const rows = []
try {
  for (const [name, share] of SPLITS) {
    const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    page.on("pageerror", (e) => console.log(`  pageerror ${name}: ${e.message.slice(0, 160)}`))
    await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
    await ready(page)
    await page.waitForTimeout(1500)
    // The split, through dockview, then a reload: the layout save lands 300 ms after the change, and F123
    // runs at mount, so the reload is what makes it run at this split.
    const m0 = await readCanvases(page)
    const want = Math.round((m0.drawing.css[0] + m0.view3d.css[0]) * share)
    await page.evaluate((w) => window.__dockHarness.api.getPanel("drawing").group.api.setSize({ width: w }), want + (m0.drawing.panel[0] - m0.drawing.css[0]))
    await page.waitForTimeout(1200)
    await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 })
    await ready(page)
    await page.waitForTimeout(2000)
    const m = await readCanvases(page)
    const got = m.drawing.css[0] / (m.drawing.css[0] + m.view3d.css[0])
    const frame = [m.win[0] / 2, m.win[1] - 48]
    const blankA = await grab(page, "view3d")
    await page.waitForTimeout(400)
    const blankB = await grab(page, "view3d")
    const logoW = MUTATE === "scale" && name !== "even" ? LOGO_W * 0.85 : LOGO_W
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), placed(m.drawing.css, logoW))
    await page.waitForTimeout(1500)
    await page.evaluate((st) => { window.__styleHarness.setStyle(st); window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) }, STILL)
    await page.waitForTimeout(2500); await raf2(page)
    const drawn = await grab(page, "view3d")
    await page.evaluate(() => window.__revealHarness.setProgress(0))
    await page.waitForTimeout(800); await raf2(page)
    const bare = await grab(page, "view3d")
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(800); await raf2(page)
    const again = await grab(page, "view3d")
    const shot = `${OUT}split-${name}${MUTATE ? `-${MUTATE}` : ""}.png`
    await page.screenshot({ path: shot })
    const form = diff(MUTATE === "blind" ? blankA : bare, drawn)
    const row = { name, share: got, win: m.win, drawing: m.drawing.css, view3d: m.view3d.css, frame, noise: diff(blankA, blankB).n, back: diff(drawn, again).n, form, hash3: sha(drawn.data), shot }
    rows.push(row)
    await ctx.close()
  }
} finally {
  await browser.close()
}

const even = rows.find((r) => r.name === "even")
for (const r of rows) {
  const tag = `${r.name.padEnd(4)} drawing ${r.drawing.map((n) => f(n, 1)).join("x")} (${f(r.share * 100, 1)}%), 3D ${r.view3d.map((n) => f(n, 1)).join("x")}`
  const ok = r.noise === 0 && r.back === 0 && r.form.n > 0 && !r.form.whole
  say(`INSTRUMENT ${r.name}`, ok, `${tag}: noise ${r.noise} px, drawn twice ${r.back} px, form ${r.form.n} px in ${r.form.box?.join(",") ?? "none"}${r.form.whole ? " (THE WHOLE CANVAS: the pair cannot place the form)" : ""}`)
  if (F123_READ) {
    const dx = r.drawing[0] / 2 - r.frame[0] / 2, dy = r.drawing[1] / 2 - r.frame[1] / 2
    say(`FRAME INPUTS ${r.name}`, null, `F123 read ${r.frame.join("x")}, the drawing canvas is ${r.drawing.map((n) => f(n, 1)).join("x")}: its centre sits ${f(dx, 1)},${f(dy, 1)} px from the frame's`)
  } else say(`FRAME INPUTS ${r.name}`, null, "NOT COMPARED: F123's `loadFrame` no longer reads innerWidth/2 x innerHeight-48, so this gate does not know its inputs")
  if (r === even || !even?.form.box || !r.form.box) continue
  const dw = r.form.box[2] - even.form.box[2], dh = r.form.box[3] - even.form.box[3]
  const dcx = r.form.cx - even.form.cx, dcy = r.form.cy - even.form.cy, dn = r.form.n / even.form.n - 1
  const pass = Math.abs(dw) <= SIZE_TOL && Math.abs(dh) <= SIZE_TOL && Math.abs(dcx) <= CENTRE_TOL && Math.abs(dcy) <= CENTRE_TOL && Math.abs(dn) <= COUNT_TOL
  say(`FRAMING ${r.name}`, pass, `form ${r.form.box[2]}x${r.form.box[3]} px against even's ${even.form.box[2]}x${even.form.box[3]} (${dw},${dh}; tol ${SIZE_TOL}), centre ${f(r.form.cx)},${f(r.form.cy)} against ${f(even.form.cx)},${f(even.form.cy)} (tol ${CENTRE_TOL}), pixels ${f(dn * 100, 2)}% (tol ${COUNT_TOL * 100}%)`)
}
writeFileSync(`${OUT}result${MUTATE ? `-${MUTATE}` : ""}.json`, JSON.stringify({ when: new Date().toISOString(), mutate: MUTATE || null, f123Read: F123_READ, rows }, null, 2))
const graded = results.filter((r) => r.ok !== null), passed = graded.filter((r) => r.ok).length
const allOk = passed === graded.length && graded.length === 3 + 2
console.log(`frame-source: ${passed} of ${graded.length} graded rows pass${MUTATE ? `, MUST-FAIL ARM ${MUTATE}: ${allOk ? "DID NOT FIRE" : "fired"}` : ""}`)
process.exit(allOk ? 0 : 1)

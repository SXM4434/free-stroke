// assert-perform.mjs · DOES PERFORM WRITE HIS TIMING INTO THE TAKE, AND ONLY WHEN HE KEEPS IT?
//
//   FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-perform.mjs --phase=base --base=<main sha>   # against a clean main server
//   FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-perform.mjs                                  # against this tree
//
// BASE PROVENANCE (HARDEN-B4). The commit a base is recorded from is the SERVER's, read by
// lib/server-commit.mjs serverCommit(FS_PORT), never this script's own repo. `--phase=base` exits 2
// without `--base=<label>`, and unless that server is clean under app, components, lib, hooks,
// styles AND its HEAD is the commit the label resolves to. It reads the server again after the
// grab and writes nothing if the pid, HEAD or cleanliness changed; base-main.json stores
// { sha, recordedFrom, at }. The lane run exits 2 on a base-main.json that is missing or has no
// 40-hex sha, before it reads the server. When the base's sha equals the served HEAD, or has no
// code difference from it (codeDiffers), row 8 reads SELF: never PASS, outside the pass count,
// named in the summary, and it does not by itself fail the run.
//
// ANIM-2 put a Perform stage on the strip (`components/perform-take.tsx`): he drags along a stroke,
// the page records when the stroke's arc reached each point, and Keep writes that into the take as a
// `performed` row. This gate drives it with real pointer events (CDP `Input.dispatchMouseEvent`
// through `page.mouse`) on the stage's own paths, read off its `d` attributes.
//
// WHERE THE EXPECTATIONS COME FROM. Pointer times come from the clock the stage reads,
// `performance.now()` in a capture listener ahead of the stage's handler (logged by an init
// script). During a performance this script DRIVES that clock (CLOUD-FLAKES, `__fsDrive`): each
// event happens at t0 plus the plan's milliseconds, never at whenever CDP delivered it. What a
// performance wrote is read from `__fsTake.get()`. What the played take drew is Rod's per-stroke
// drawRange, `get().live.meshes[i].count`, after `__revealHarness.setProgress`. On Inflate, Extrude
// and Solid (row 1b, F121) no mesh count names one stroke, so it is the inked share of stroke D's
// pixel mask, built as `assert-stroke-timing-browser` builds its masks.
//
// EVERY ROW HAS AN ARM THAT MUST FAIL: the same predicate applied to a state where it cannot hold.
// A control that throws fails the row (paired).
//
// CORPUS. The hero word (`scripts/capture/logo-strokes.json`, 12 strokes) at 12 ms a point, ease
// linear, 1512x982 at DPR 1, Rod for pictures (Inflate too in row 8; Inflate, Extrude and Solid
// in row 1b). Stroke 5 is the D, stroke 6
// the first "o" (a closed loop). NOT COVERED: touch and pen pressure, Perform "All, in order" across
// several strokes, the group-mode strip, dark theme, other widths.
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import { hideDock, openDock } from "./lib/dock.mjs"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execSync, execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { makePaired } from "./lib/paired.mjs"
const { createCanvas, loadImage } = createRequire(import.meta.url)("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "perform")
const PHASE = (process.argv.find((a) => a.startsWith("--phase=")) ?? "--phase=lane").split("=")[1]
const SHOT = process.argv.includes("--shot")
/* Row 1b's engines past Rod. `--dwell-engines=inflate` runs one; each one left out prints NOT RUN
 * and the run exits 1, so a partial run cannot read as the gate passing. */
const DWELL_ALL = ["inflate", "extrude", "solid"]
const DWELL = (process.argv.find((a) => a.startsWith("--dwell-engines="))?.split("=")[1].split(",") ?? DWELL_ALL).filter((e) => DWELL_ALL.includes(e))
let notRun = 0
const WAIT = 1500
const FRAME = 1000 / 60
const D = 5
const O = 6
const GRID = Array.from({ length: 9 }, (_, i) => i / 8)

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  :  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
const paired = makePaired(row)
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16)
const f1 = (v) => (typeof v === "number" ? v.toFixed(1) : String(v))
const J = (v) => JSON.stringify(v)

const selfRows = []
const selfRow = (name, detail) => { selfRows.push(name); console.log(`SELF  ${name}${detail ? `  :  ${detail}` : ""}`) }
const refuse = (msg) => { console.log(`REFUSED  ${msg}`); process.exit(2) }
const BASE_FILE = join(OUT, "base-main.json")
const baseArg = process.argv.find((a) => a.startsWith("--base="))?.slice(7)
if (PHASE === "base" && !baseArg) refuse("--phase=base needs --base=<the main sha the server runs>")
// Lane run: a missing or unlabelled base is refused before any server is read.
let base = null
if (PHASE === "lane" && !SHOT) {
  if (!existsSync(BASE_FILE)) refuse(`${BASE_FILE} is missing; record it with --phase=base --base=<sha> against a clean main server`)
  base = JSON.parse(readFileSync(BASE_FILE, "utf8"))
  if (!(typeof base.sha === "string" && /^[0-9a-f]{40}$/.test(base.sha))) refuse(`${BASE_FILE} has no stored sha (got ${J(base.sha)}); record it again with --phase=base --base=<sha> against a clean main server`)
}
const { serverCommit, codeDiffers } = await import("./lib/server-commit.mjs")
const PORT = Number(new URL(LAB_URL).port || 80)
let srv
try { srv = serverCommit(PORT) } catch (e) { refuse(e.message) }
console.log(`server :${PORT} pid ${srv.pid} cwd ${srv.cwd} head ${srv.head}${srv.dirty ? " DIRTY" : " clean"}`)
if (PHASE === "base") {
  let labelSha
  try { labelSha = execFileSync("git", ["-C", srv.top, "rev-parse", "--verify", "--quiet", `${baseArg}^{commit}`], { encoding: "utf8" }).trim() } catch { refuse(`--base=${baseArg} does not name a commit in the server's repo ${srv.top}`) }
  if (srv.dirty) refuse(`the server on :${PORT} (${srv.cwd}) has uncommitted changes under app, components, lib, hooks or styles; a base is recorded from a clean tree only`)
  if (srv.head !== labelSha) refuse(`--base=${baseArg} is ${labelSha}, but the server on :${PORT} (${srv.cwd}) runs ${srv.head}`)
}
// SELF: the base's code is the served code, so row 8 compares the tree to itself.
let isSelf = false
if (base) try { isSelf = base.sha === srv.head || !codeDiffers(srv, base.sha) } catch (e) { refuse(e.message) }

mkdirSync(OUT, { recursive: true })
const polys = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8")).polylines
const browser = await chromium.launch()
const counters = () => {
  const w = window
  const c = (w.__perfCount = { raf: 0, caf: 0, kdAdd: 0, kdRem: 0 })
  const raf = w.requestAnimationFrame.bind(w)
  const caf = w.cancelAnimationFrame.bind(w)
  w.requestAnimationFrame = (f) => (c.raf++, raf(f))
  w.cancelAnimationFrame = (id) => (c.caf++, caf(id))
  const add = EventTarget.prototype.addEventListener
  const rem = EventTarget.prototype.removeEventListener
  EventTarget.prototype.addEventListener = function (t, ...a) {
    if (this === w && t === "keydown") c.kdAdd++
    return add.call(this, t, ...a)
  }
  EventTarget.prototype.removeEventListener = function (t, ...a) {
    if (this === w && t === "keydown") c.kdRem++
    return rem.call(this, t, ...a)
  }
  /* CLOUD-FLAKES · THE STAGE'S CLOCK, DRIVEN. `components/perform-take.tsx` stamps every sample
   * with `performance.now()` read in its handlers and in a per-frame loop, so what a performance
   * writes is wall time at DELIVERY: a CDP move held up behind a slow SwiftShader frame lands late
   * and leaves a flat run in the pace that nobody performed. Row 2's "no flat run of 200 ms" and
   * row 1b's "held within one frame of the dwell" were graded on that noise. This makes
   * `performance.now` drivable: `__fsDrive.begin(t)` freezes it at t, `__fsDrive.at(t)` sets the
   * time the NEXT stage pointer event happens at, applied in this capture listener before the
   * stage's own handler runs, and `__fsDrive.end()` hands it back to the real clock. Between
   * events it stands still, so the stage's frame loop samples the time of the last event, as a
   * held pen does on an infinitely fast machine. Undriven (the default) it is the real clock. */
  const perf = w.performance
  const realNow = Performance.prototype.now.bind(perf)
  let virt = null
  let pending = null
  perf.now = () => (virt === null ? realNow() : virt)
  w.__fsDrive = {
    begin: (t) => { virt = t; pending = null },
    at: (t) => { pending = t },
    end: () => { virt = null; pending = null },
    real: () => realNow(),
    driven: () => virt,
  }
  /* The log reads the stage's own clock, so the dwell a row expects is the dwell the stage
   * recorded. It used to read `e.timeStamp`, the event's creation time, a second clock that a
   * busy main thread pulls away from the handler's. */
  w.__ptrLog = []
  for (const type of ["pointerdown", "pointermove", "pointerup"])
    add.call(w, type, (e) => {
      if (!e.target?.closest?.("[data-perform-stage]")) return
      if (virt !== null && pending !== null) (virt = pending), (pending = null)
      w.__ptrLog.push({ type, t: perf.now() })
    }, true)
}
let context = null
let page = null
const pageErrors = []

const settle = async (ms = 280) => {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
const fsGet = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__fsTake.get())))
const setRows = async (rows) => {
  // A refused take leaves the last one playing and looks like success, so a refusal throws.
  if (!(await page.evaluate((r) => window.__fsTake.set(r), rows))) throw new Error(`__fsTake refused ${J(rows).slice(0, 200)}`)
  await page.waitForTimeout(WAIT)
}
const clearTake = async () => {
  await page.evaluate(() => window.__fsTake.clear() && window.__fsTake.knockout(null))
  await page.waitForTimeout(WAIT)
}
const setEngine = async (m) => {
  await page.evaluate((x) => {
    window.__styleHarness.setMode(x)
    if (x === "inflate") window.__styleHarness.setInflate({ fusion: "auto" })
  }, m)
  await page.waitForTimeout(2500)
}
const undoN = () => page.evaluate(() => window.__styleHarness.undoLabels().past.length)
const counts = () => page.evaluate(() => ({ ...window.__perfCount }))
const ptr = () => page.evaluate(() => window.__ptrLog.splice(0))
const staged = () => page.evaluate(() => !!document.querySelector("[data-perform-stage]"))

/** Open the stage on stroke i at capture speed s. */
const open = async (i, s = 1) => {
  await page.click("[data-strip-perform]")
  await page.waitForSelector("[data-perform-stage]", { timeout: 10000 })
  await page.selectOption("[data-perform-target]", String(i))
  await page.click(`[data-perform-capture="${s}"]`)
  await settle(120)
  await ptr()
}
/** The stage's drawn paths in page px, and each stroke's lit ink fraction. */
const stage = () =>
  page.evaluate(() => {
    const svg = document.querySelector("[data-perform-stage]")
    const b = svg.getBoundingClientRect()
    return [...svg.querySelectorAll("[data-perform-stroke]")].map((g) => {
      const [bg, ink] = g.querySelectorAll("path")
      const pts = bg.getAttribute("d").slice(1).split("L").map((s) => s.split(" ").map(Number))
      const [on, off] = ink.getAttribute("stroke-dasharray").split(" ").map(Number)
      return { pts: pts.map(([x, y]) => [x + b.x, y + b.y]), ink: on / Math.max(off - 1, 1e-9) }
    })
  })
const arcOf = (pts) => pts.reduce((a, p, j) => (j ? [...a, a[j - 1] + Math.hypot(p[0] - pts[j - 1][0], p[1] - pts[j - 1][1])] : [0]), [])
const at = (pts, arc, f) => {
  const L = arc[arc.length - 1]
  const s = f * L
  let j = 1
  while (j < arc.length - 1 && arc[j] < s) j++
  const u = arc[j] > arc[j - 1] ? (s - arc[j - 1]) / (arc[j] - arc[j - 1]) : 0
  return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * u, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * u]
}
/**
 * Perform stroke i. `plan` is a list of `{ to, steps, ms }` moves along the arc and `{ dwell }`
 * holds. `onMove` runs after every move. Leaves the pointer up; returns the page's pointer log.
 */
/* CLOUD-FLAKES: every pointer event of a performance happens at a time this script sets on the
 * stage's driven clock (`__fsDrive` in `counters`): t0 plus the plan's own milliseconds, so a 1 s
 * dwell is 1000 ms on the clock the stage reads however late the next move is delivered. t0 is
 * a whole millisecond and every step a whole number of them, so each difference the stage takes
 * is exact and two runs write the same take. The real waits stay, so the page lives through the
 * performance at the old pace; they no longer decide what is recorded. */
const perform = async (i, plan, onMove) => {
  const { pts } = (await stage())[i]
  const arc = arcOf(pts)
  let f = 0
  const t0 = await page.evaluate(() => {
    const t = Math.ceil(window.__fsDrive.real()) + 1
    window.__fsDrive.begin(t)
    return t
  })
  let off = 0
  const at_ = () => page.evaluate((t) => window.__fsDrive.at(t), t0 + off)
  try {
    const [x0, y0] = at(pts, arc, 0)
    await page.mouse.move(x0, y0)
    await at_()
    await page.mouse.down()
    for (const s of plan) {
      if (s.dwell) {
        await page.waitForTimeout(s.dwell)
        off += s.dwell
        continue
      }
      if (s.xy) {
        await at_()
        await page.mouse.move(s.xy[0], s.xy[1])
        if (onMove) await onMove(s)
        continue
      }
      const from = f
      for (let k = 1; k <= s.steps; k++) {
        const g = from + ((s.to - from) * k) / s.steps
        const [x, y] = at(pts, arc, Math.min(g, 1))
        await at_()
        await page.mouse.move(x, y)
        if (onMove) await onMove({ f: g, x, y })
        const ms = typeof s.ms === "function" ? s.ms(k) : s.ms ?? 16
        if (ms) await page.waitForTimeout(ms)
        off += ms
      }
      f = s.to
    }
    await at_()
    await page.mouse.up()
    await settle(120)
  } finally {
    // Hand the clock back only once the real one has passed the driven one: nothing sees time go back.
    await page.evaluate(async () => {
      const d = window.__fsDrive
      while (d.driven() !== null && d.real() < d.driven()) await new Promise((r) => setTimeout(r, 10))
      d.end()
    })
  }
  return ptr()
}
const keep = async () => {
  await page.click("[data-perform-keep]")
  await page.waitForTimeout(WAIT)
}
/** The longest run of equal values in a pace, as a fraction of the slot. */
const flatRun = (pf) => {
  let best = 0, bi = 0, s = 0
  for (let k = 1; k < pf.length; k++) {
    if (pf[k] !== pf[k - 1]) s = k
    else if (k - s > best) (best = k - s), (bi = s)
  }
  return { frac: best / (pf.length - 1), lo: bi / (pf.length - 1), hi: (bi + best) / (pf.length - 1) }
}
/** Mean |second difference| at a 40 ms stride (8 of the pace's 5 ms bins), so rounding in the
 *  graph's printed points cannot pass for shake. At stride 1 it measured the rounding. */
const jitter = (ys, h = 8) => {
  let s = 0
  for (let k = h; k < ys.length - h; k++) s += Math.abs(ys[k + h] - 2 * ys[k] + ys[k - h])
  return s / Math.max(ys.length - 2 * h, 1)
}
/** Rod's drawn count for stroke i at take time t ms. */
const countAt = async (i, t) => {
  const g = await fsGet()
  await page.evaluate((x) => window.__revealHarness.setProgress(x), Math.max(0, Math.min(1, t / g.takeMs)))
  await settle(200)
  return (await fsGet()).live.meshes[i]?.count ?? -1
}
/** The picture with no performance: every grid frame on Rod and Inflate, plus the take readout. */
const picture = async () => {
  const g = await fsGet()
  const out = { take: g.take, slots: g.slots, takeMs: g.takeMs, penMs: g.penMs, totalDuration: g.totalDuration, engines: {} }
  for (const eng of ["rod", "inflate"]) {
    await setEngine(eng)
    out.engines[eng] = []
    for (const p of GRID) {
      await page.evaluate((x) => window.__revealHarness.setProgress(x), p)
      await settle()
      out.engines[eng].push(sha(await page.evaluate(() => window.__captureHarness.grab())))
    }
  }
  await setEngine("rod")
  return out
}

/* A fresh context per page, so nothing the last page stored comes back. `undocked` hides the dock
   (`lib/dock.mjs`, L3) before the strokes land, so the canvas is main's size from mount. Docked, the
   dock is opened on its Timeline tab after the strokes land, since Perform lives on the strip. */
const openPage = async ({ undocked }) => {
  if (context) await context.close()
  context = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })
  await context.addInitScript(counters)
  page = await context.newPage()
  page.on("pageerror", (e) => pageErrors.push(String(e)))
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  if (undocked) await hideDock(page)
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    window.__revealHarness.setEase("linear")
    window.__revealHarness.setPlaying(false)
  })
  await page.waitForTimeout(600)
  await page.waitForFunction(() => !!window.__fsTake, null, { timeout: 60000 })
  if (!undocked) await openDock(page)
}

try {
  // Every row but 8 drives the Perform stage on the strip, so this page keeps the dock as shipped.
  await openPage({ undocked: false })
  const head = srv.head.slice(0, 9)

  if (PHASE === "base") {
    /* HARDEN-B4: row 8 grabs on a fresh page with the dock floated, canvas 755x890 from mount, so the
     * base is grabbed the same way. Main has carried the take dock since ANIM-3C; on 0fcee4b7e the
     * docked grab moved every rod frame. `hideDock` throws on a page with no dock, so a dockless main
     * refuses here instead of recording at another canvas size. */
    await openPage({ undocked: true })
    /* Before HARDEN-B4 the base had to lack the Perform button, the only sign it was not the lane itself.
     * Perform is on main now, so that sign is gone; the base's sha and codeDiffers carry it, and a base with
     * the served code reads SELF. performButton stays in the file as a record only. */
    const button = await page.evaluate(() => !!document.querySelector("[data-strip-perform]"))
    const out = { base: baseArg, sha: srv.head, recordedFrom: srv.cwd, at: new Date().toISOString(), head, undocked: true, performButton: button, ...(await picture()) }
    // The server must still be the one checked before the grab: same pid, same HEAD, still clean.
    let after
    try { after = serverCommit(PORT) } catch (e) { await browser.close(); refuse(`after the run: ${e.message}`) }
    if (after.pid !== srv.pid || after.head !== srv.head || after.dirty) await browser.close(), refuse(`the server changed during the run: pid ${srv.pid} -> ${after.pid}, head ${srv.head} -> ${after.head}, dirty ${after.dirty}; nothing written`)
    writeFileSync(BASE_FILE, JSON.stringify(out, null, 1))
    console.log(`wrote base-main.json at ${srv.head} from ${srv.cwd}, Perform button ${button}: rod ${new Set(out.engines.rod).size} distinct, inflate ${new Set(out.engines.inflate).size} distinct`)
  } else if (SHOT) {
    await open(D, 1)
    await page.screenshot({ path: join(OUT, "stage-ready.png") })
    await perform(D, [{ to: 0.55, steps: 30 }])
    await page.screenshot({ path: join(OUT, "stage-paused.png") })
    await page.keyboard.press("Escape")
    await open(D, 1)
    await perform(D, [{ to: 0.5, steps: 30 }, { dwell: 600 }, { to: 1, steps: 30 }])
    await page.screenshot({ path: join(OUT, "stage-review.png") })
    await page.keyboard.press("Escape")
    console.log("wrote stage-ready.png, stage-paused.png, stage-review.png")
  } else {
    /* The take before any performance, for row 1a's arm. Row 8 grabs its frames in its own page. */
    const before = await picture()
    // HARDEN-B: the take readout's three clocks are part of the picture record, so they are compared.
    const same = (a, b) => !!a && !!b && J(a.take) === J(b.take) && J(a.slots) === J(b.slots) && J(a.engines) === J(b.engines) && J(a.takeMs) === J(b.takeMs) && J(a.penMs) === J(b.penMs) && J(a.totalDuration) === J(b.totalDuration)

    /* ── risk · stage stroke i is schedule track i, reversed tracks from their last point ── */
    await open(D, 1)
    const fwd = await stage()
    await page.keyboard.press("Escape")
    await page.evaluate(() => window.__revealHarness.setDrawIn({ reverse: "alternate" }))
    await settle(800)
    const sched = await page.evaluate(() => {
      const s = window.__revealHarness.schedule()
      return s ? s.tracks.map((t) => ({ stroke: t.stroke, reverse: t.reverse })) : null
    })
    await open(D, 1)
    const rev = await stage()
    await page.keyboard.press("Escape")
    await page.evaluate(() => window.__revealHarness.setDrawIn({ reverse: "off" }))
    await settle(800)
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5
    const mapOk = (st) =>
      !!sched && sched.length === fwd.length && sched.every((t, i) => t.stroke === i) &&
      st.every((s, i) => {
        const f = fwd[i].pts
        return sched[i].reverse ? near(s.pts[0], f[f.length - 1]) && near(s.pts[s.pts.length - 1], f[0]) : near(s.pts[0], f[0])
      })
    const nRev = sched ? sched.filter((t) => t.reverse).length : 0
    paired(
      "R1 stage stroke i is schedule track i; a reversed track starts at its last point",
      mapOk(rev) && nRev > 0,
      "the forward stage read against the alternate schedule",
      mapOk(fwd),
      `${fwd.length} stage strokes, ${sched?.length} tracks, ${nRev} reversed`,
    )

    /* ── 1 · a 1 s dwell writes a performed row, and the played take holds it ── */
    const u0 = await undoN()
    const cPre = await counts()
    await open(D, 1)
    const c0 = await counts()
    const log1 = await perform(D, [{ to: 0.5, steps: 30 }, { dwell: 1000 }, { to: 1, steps: 30 }])
    const c1 = await counts()
    const moves = log1.filter((e) => e.type === "pointermove")
    let dwellMs = 0
    for (let k = 1; k < moves.length; k++) dwellMs = Math.max(dwellMs, moves[k].t - moves[k - 1].t)
    const recMs = log1[log1.length - 1].t - log1[0].t
    await keep()
    const g1 = await fsGet()
    const r1 = g1.take.strokes[D]
    const slot1 = g1.slots[D * 2 + 1] - g1.slots[D * 2]
    const fr1 = r1?.performed ? flatRun(r1.performed) : { frac: 0, lo: 0, hi: 0 }
    const rowDwell = fr1.frac * slot1
    const bin = r1?.performed ? slot1 / (r1.performed.length - 1) : 0
    const u1 = await undoN()
    paired(
      "1a a 1 s dwell writes a performed row whose flat run is the dwell, within one frame and the reader's two bins",
      !!r1?.performed && Math.abs(rowDwell - dwellMs) <= FRAME + 2 * bin && g1.rejected.length === 0,
      "the same flat-run test on the take before the performance",
      Math.abs((before.take.strokes?.[D]?.performed ? flatRun(before.take.strokes[D].performed).frac * slot1 : 0) - dwellMs) <= FRAME,
      `dwell on the page clock ${f1(dwellMs)} ms, row flat run ${f1(rowDwell)} ms of a ${f1(slot1)} ms slot, ${r1?.performed?.length ?? 0} samples, rejected ${g1.rejected.length}`,
    )

    /* R2 · the per-frame loop: while recording, no keydown listener is re-added and no frame cancelled */
    const recS = recMs / 1000
    const kdRate = (c1.kdAdd - c0.kdAdd) / recS
    const cafRate = (c1.caf - c0.caf) / recS
    paired(
      "R2 while he records, the stage re-adds no keydown listener and cancels no frame",
      kdRate < 1 && cafRate < 1 && c1.kdAdd - c1.kdRem <= c0.kdAdd - c0.kdRem + 0,
      "the counters can see: opening the stage added a keydown listener",
      !(c0.kdAdd - cPre.kdAdd >= 1),
      `over ${f1(recS)} s of recording: ${f1(kdRate)} keydown adds/s, ${f1(cafRate)} cancelled frames/s, ${moves.length} moves seen; live keydown listeners ${c0.kdAdd - c0.kdRem} -> ${c1.kdAdd - c1.kdRem}`,
    )

    /* 1b · played on Rod, stroke D's drawRange stays flat across the dwell */
    const tLo = g1.slots[D * 2] + fr1.lo * slot1
    const tHi = g1.slots[D * 2] + fr1.hi * slot1
    const mid = (tLo + tHi) / 2
    const cMid = await countAt(D, mid)
    const edge = async (a, b, inside) => {
      // a is outside the flat run, b inside; halve to 1 ms
      while (Math.abs(b - a) > 1) {
        const m = (a + b) / 2
        if ((await countAt(D, m)) === inside) b = m
        else a = m
      }
      return b
    }
    const left = await edge(tLo - 120, mid, cMid)
    const right = await edge(tHi + 120, mid, cMid)
    const played = right - left
    const plain = { ...r1 }
    delete plain.performed
    await setRows({ ...g1.take.strokes, [D]: plain })
    const cA = await countAt(D, tLo + 100)
    const cB = await countAt(D, tHi - 100)
    await setRows(g1.take.strokes)
    paired(
      "1b the played take holds stroke D still for the dwell, within one frame",
      Math.abs(played - dwellMs) <= FRAME && cMid > 0,
      "the same slot played without its pace (linear) stays flat across the dwell",
      cA === cB,
      `drawn count ${cMid} held ${f1(played)} ms (${f1(left)} to ${f1(right)}); dwell ${f1(dwellMs)} ms; linear draws ${cA} -> ${cB}`,
    )

    /* 1b on Inflate, Extrude and Solid (F121). 6375c32cf made the stage hand `performed` to every
     * engine; this films it. None of the three can be read by drawRange: Inflate is one fused mesh,
     * and Extrude and Solid rebuild their geometry from the clipped strokes, so a mesh count is the
     * whole rebuilt mesh. The instrument is stroke D's PIXEL MASK, built the way
     * `assert-stroke-timing-browser` builds it: ink in the finished no-rows frame, background with D
     * alone held back 5 s, and ink with D alone whole (every other stroke held back 20 s). Pixels D
     * shares with a neighbour are in no mask, and neither is any pixel within NB_REACH (1 px, a 3x3
     * square) of a finished neighbour's ink (F125): a neighbour caught mid-stroke inks up to a pixel
     * past its finished edge, so on Solid the first "o" opening at 7668 ms, inside D's dwell, inked
     * (388,256) and (389,255), each 1.0 px out, and moved D's count 532 -> 533 -> 534 while D's own
     * vertices held exactly. "Held still" is the EXACT inked count on that mask: a
     * held frame is the same render, so the count cannot drift by one pixel. Each row carries
     *   a positive control: the mask reads nothing before D's slot, the whole stroke after it, and a
     *     partial stroke at the dwell, so a blind or empty mask cannot pass as a stroke that holds;
     *   a stability control: the dwell's middle read twice, with a seek away between, gives one count;
     *   the take restored exactly after the mask frames, so the rows after this read the kept take;
     *   the linear must-fail: the same slot without `performed` moves across the dwell;
     *   a reach audit (F125): the take replayed with D alone held back, so only the neighbours ink,
     *     at the same slots, read at every clock this row read; one counted pixel inked fails the
     *     row, so the 1 px margin is checked where it was used, not assumed;
     *   each end of the held count within one frame of the row's own flat run (F121-C), not only
     *     the held span, so a hold that starts late and ends late cannot pass on its length;
     *   on Inflate, the holds the tip bake published on `__heroPenTip`: one kept hold on stroke D
     *     whose `[t0, t1]` is the row's flat run within 1 ms, and every dropped hold no longer than
     *     the shortest kept one, so the held count is the hold path working and the cap drops the
     *     shortest runs, never the dwell. The dropped count and the longest are printed: this
     *     gate's stepped pointer leaves dozens of 15 to 30 ms runs past the cap of 8.
     * CORPUS: stroke D (the D, stroke 5) of the hero word, docked page 1512x982, the 1 s dwell of row
     * 1a. NOT COVERED: other strokes, a dwell at the stroke's ends, Knockout, reversed tracks. */
    const LINEAR = { kind: "preset", id: "linear" }
    const NEUTRAL = { delayMs: 0, speed: 1, holdBack: false, ease: LINEAR }
    const INK = 24
    const NB_REACH = 1
    /* HARDEN-B, 2026-09-26: THE LEFT-OUT SHARE IS CAPPED. The margin above leaves pixels out of the
     * mask, and a defect confined to them moves no count this row reads. Measured on a6ee983f9:
     * 25 of 873 candidate pixels on Solid (2.9%), 16 of 600 on Inflate (2.7%), 7 of 461 on Extrude
     * (1.5%). The bound is 5% of the candidates (mask plus left out); above it the row fails. Its
     * must-fail is the same frames read with a NB_WIDE px margin, which must leave out more. */
    const NB_CAP = 0.05
    const NB_WIDE = 4
    const inked = (d, bg, i) => Math.abs(d[i] - bg[i]) > INK || Math.abs(d[i + 1] - bg[i + 1]) > INK || Math.abs(d[i + 2] - bg[i + 2]) > INK
    const grab = () => page.evaluate(() => window.__captureHarness.grab())
    const frameAt = async (t) => {
      const g = await fsGet()
      // With no take set, `takeMs` is null and t / null seeks NaN: the empty mask of the first run.
      const T = g.takeMs ?? g.totalDuration
      if (!(T > 0)) throw new Error(`no clock to seek on: takeMs ${g.takeMs}, totalDuration ${g.totalDuration}`)
      await page.evaluate((x) => window.__revealHarness.setProgress(x), Math.max(0, Math.min(1, t / T)))
      await settle()
      return grab()
    }
    const f121 = { head: execSync("git rev-parse --short=9 HEAD", { cwd: ROOT }).toString().trim(), dwellMs, slot: slot1, tLo, tHi, engines: {} }
    for (const eng of DWELL_ALL) {
      if (!DWELL.includes(eng)) {
        console.log(`NOT RUN  1b ${eng}: left out by --dwell-engines`)
        notRun++
        continue
      }
      await setEngine(eng)
      await clearTake()
      const g0 = await fsGet()
      const pen = g0.totalDuration
      await setRows(Object.fromEntries(polys.map((_, i) => [i, { ...NEUTRAL, holdBack: true, delayMs: 5000 }])))
      const bg = (await pixels(await frameAt(100))).d
      await clearTake()
      const full = await pixels(await frameAt(pen))
      await setRows({ [D]: { ...NEUTRAL, holdBack: true, delayMs: 5000 } })
      const held = (await pixels(await frameAt(pen + 100))).d
      await setRows(Object.fromEntries(polys.map((_, i) => [i, i === D ? NEUTRAL : { ...NEUTRAL, holdBack: true, delayMs: 20000 }])))
      const alone = (await pixels(await frameAt(pen + 100))).d
      const W = full.w
      const Hh = full.d.length / 4 / W
      const maskAt = (reach) => {
        const nearNb = new Uint8Array(W * Hh)
        for (let p = 0; p < W * Hh; p++) {
          if (!inked(held, bg, p * 4)) continue
          const px = p % W, py = (p - px) / W
          for (let dy = -reach; dy <= reach; dy++)
            for (let dx = -reach; dx <= reach; dx++) {
              const x = px + dx, y = py + dy
              if (x >= 0 && y >= 0 && x < W && y < Hh) nearNb[y * W + x] = 1
            }
        }
        const idx = []
        let nbLeftOut = 0
        let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
        for (let i = 0; i < full.d.length; i += 4)
          if (inked(full.d, bg, i) && !inked(held, bg, i) && inked(alone, bg, i)) {
            if (nearNb[i >> 2]) {
              nbLeftOut++
              continue
            }
            idx.push(i)
            const px = (i >> 2) % full.w, py = Math.floor((i >> 2) / full.w)
            x0 = Math.min(x0, px), x1 = Math.max(x1, px), y0 = Math.min(y0, py), y1 = Math.max(y1, py)
          }
        const cand = idx.length + nbLeftOut
        return { idx, nbLeftOut, cand, share: cand ? nbLeftOut / cand : 1, x0, y0, x1, y1 }
      }
      const { idx, nbLeftOut, cand, share, x0, y0, x1, y1 } = maskAt(NB_REACH)
      const wide = maskAt(NB_WIDE)
      // An empty candidate set reads share 1, so a blind mask cannot pass the cap.
      const capOk = cand > 0 && share <= NB_CAP
      await setRows(g1.take.strokes)
      const gr = await fsGet()
      const restored = J(gr.take) === J(g1.take) && J(gr.slots) === J(g1.slots)
      const readTimes = []
      const inkAt = async (t) => {
        readTimes.push(t)
        const d = (await pixels(await frameAt(t))).d
        let n = 0
        for (const i of idx) if (inked(d, bg, i)) n++
        return n
      }
      const N = Math.max(idx.length, 1)
      const nPre = await inkAt(g1.slots[D * 2] - 30)
      const nPost = await inkAt(g1.slots[D * 2 + 1] + 100)
      const nMid = await inkAt(mid)
      const nMid2 = await inkAt(mid)
      const pEdge = async (a, b) => {
        while (Math.abs(b - a) > 1) {
          const m = (a + b) / 2
          if ((await inkAt(m)) === nMid) b = m
          else a = m
        }
        return b
      }
      const pl = await pEdge(tLo - 120, mid)
      const pr = await pEdge(tHi + 120, mid)
      const pPlayed = pr - pl
      /* Four frames for the eye, cropped to D's box: 60 ms before the dwell, its two ends, 60 ms after. */
      const strip = []
      for (const t of [pl - 60, pl + 20, pr - 20, pr + 60]) strip.push(await frameAt(t))
      const tip =
        eng === "inflate"
          ? await page.evaluate(() => {
              const t = window.__heroPenTip
              return t ? { holds: t.holds ?? null, dropped: t.holdsDropped ?? null, max: t.holdMax ?? null } : null
            })
          : null
      const holdMs = (h) => h.t1Ms - h.t0Ms
      const dHold = tip?.holds?.find((h) => h.stroke === D && Math.abs(h.t0Ms - tLo) <= 1 && Math.abs(h.t1Ms - tHi) <= 1) ?? null
      const keptMin = tip?.holds?.length ? Math.min(...tip.holds.map(holdMs)) : 0
      const dropMax = tip?.dropped?.length ? Math.max(...tip.dropped.map(holdMs)) : 0
      // The bake publishes each time to 0.1 ms, so two equal runs can print 0.1 ms apart.
      const tipOk = eng !== "inflate" || (!!dHold && Array.isArray(tip.dropped) && dropMax <= keptMin + 0.11)
      await setRows({ ...g1.take.strokes, [D]: plain })
      const lA = await inkAt(tLo + 100)
      const lB = await inkAt(tHi - 100)
      /* F125 reach audit. D alone held back 20 s, so the frame holds only the neighbours, at the
       * slots the kept take gave them (checked: a moved neighbour would audit the wrong state). */
      await setRows({ ...g1.take.strokes, [D]: { ...NEUTRAL, holdBack: true, delayMs: 20000 } })
      const ga = await fsGet()
      const sv = (s) => Object.values(s ?? {})
      const slotsSame = sv(ga.slots).length === sv(g1.slots).length && sv(ga.slots).every((v, k) => k >> 1 === D || Math.abs(v - sv(g1.slots)[k]) < 1e-6)
      const auditTimes = [...new Set(readTimes)].sort((a, b) => a - b)
      const reached = []
      for (const t of auditTimes) {
        const d = (await pixels(await frameAt(t))).d
        const hit = idx.filter((i) => inked(d, bg, i))
        if (hit.length) reached.push({ t, n: hit.length, px: hit.slice(0, 4).map((i) => [(i >> 2) % W, Math.floor((i >> 2) / W)]) })
      }
      await setRows(g1.take.strokes)
      const reachOk = slotsSame && auditTimes.length > 0 && reached.length === 0
      const seen = idx.length >= 50 && nPre / N < 0.005 && nPost / N >= 0.98 && nMid / N > 0.02 && nMid / N < 0.98
      const endL = pl - tLo
      const endR = pr - tHi
      const r = { mask: idx.length, nbLeftOut, nbReach: NB_REACH, cand, share, cap: NB_CAP, wide: { reach: NB_WIDE, nbLeftOut: wide.nbLeftOut, share: wide.share }, box: [x0, y0, x1, y1], pre: nPre, post: nPost, mid: nMid, mid2: nMid2, left: pl, right: pr, played: pPlayed, endL, endR, linear: [lA, lB], restored, audit: { times: auditTimes.length, slotsSame, reached }, ...(tip ? { tip } : {}) }
      f121.engines[eng] = r
      if (idx.length) await writeStrip(join(OUT, `f121-dwell-${eng}.png`), strip, r.box)
      paired(
        `1b ${eng}: the played take holds stroke D still for the dwell, within one frame`,
        seen && nMid === nMid2 && restored && Math.abs(pPlayed - dwellMs) <= FRAME && Math.abs(endL) <= FRAME && Math.abs(endR) <= FRAME && tipOk && reachOk && capOk,
        `the same slot played without its pace (linear) stays flat across the dwell, or a ${NB_WIDE} px margin stays under the ${NB_CAP * 100}% cap`,
        lA === lB || wide.share <= NB_CAP,
        `mask ${idx.length} px (${nbLeftOut} of ${cand} within ${NB_REACH} px of neighbour ink left out, ${(share * 100).toFixed(1)}%, cap ${NB_CAP * 100}%${capOk ? "" : ", OVER THE CAP"}; a ${NB_WIDE} px margin leaves out ${wide.nbLeftOut} of ${wide.cand}, ${(wide.share * 100).toFixed(1)}%), box ${r.box}; neighbours alone at ${auditTimes.length} read clocks ${reached.length ? `ink counted px: ${reached.map((x) => `${f1(x.t)} ms ${x.n} px at ${x.px.map((p) => `(${p})`).join(" ")}`).join("; ")}` : "ink none of it"}${slotsSame ? "" : ", NEIGHBOUR SLOTS MOVED with D held back, audit void"}; ink ${nPre} before the slot, ${nPost} after, ${nMid} (${(nMid / N).toFixed(3)}) held ${f1(pPlayed)} ms (${f1(pl)} to ${f1(pr)}), read twice ${nMid}/${nMid2}; ends ${f1(endL)} and ${f1(endR)} ms from the row's flat run (${f1(tLo)} to ${f1(tHi)}); dwell ${f1(dwellMs)} ms;${tip ? ` tip holds ${tip.holds?.length ?? "none"} (D ${dHold ? `${f1(dHold.t0Ms)} to ${f1(dHold.t1Ms)}` : "missing"}), dropped ${tip.dropped?.length ?? "unread"}, longest ${f1(dropMax)} ms against a shortest kept ${f1(keptMin)} ms;` : ""} linear inks ${lA} -> ${lB}; take restored ${restored}`,
      )
    }
    await setEngine("rod")
    writeFileSync(join(OUT, `f121-dwell-engines${DWELL.length === DWELL_ALL.length ? "" : `-${DWELL.join("-")}`}.json`), JSON.stringify(f121, null, 1))

    /* ── 2 · re-performing a stroke overwrites its row ───────────────────── */
    const u1b = await undoN()
    await open(D, 1)
    await perform(D, [{ to: 1, steps: 40 }])
    await keep()
    const g2 = await fsGet()
    const r2 = g2.take.strokes[D]
    const overwrote = (r, g) =>
      !!r?.performed && flatRun(r.performed).frac * (g.slots[D * 2 + 1] - g.slots[D * 2]) < 200 &&
      Object.keys(g.take.strokes).length === Object.keys(g1.take.strokes).length
    paired(
      "2 re-performing stroke D replaces its row whole",
      overwrote(r2, g2) && J(r2.performed) !== J(r1.performed),
      "the same test on the first take's row",
      overwrote(r1, g1),
      `rows ${Object.keys(g1.take.strokes).length} -> ${Object.keys(g2.take.strokes).length}, samples ${r1.performed.length} -> ${r2?.performed?.length}, delay ${f1(r1.delayMs)} -> ${f1(r2?.delayMs)}, speed ${r1.speed?.toFixed(3)} -> ${r2?.speed?.toFixed(3)}`,
    )

    /* ── 4 · one undo restores the previous take ─────────────────────────── */
    const u2 = await undoN()
    await page.evaluate(() => window.__styleHarness.undo())
    await page.waitForTimeout(WAIT)
    const g4 = await fsGet()
    paired(
      "4 one Keep is one undo step, and one undo gives the previous take back",
      u1 === u0 + 1 && u2 === u1b + 1 && J(g4.take) === J(g1.take),
      "the take before the undo equals the previous take",
      J(g2.take) === J(g1.take),
      `undo steps: first Keep ${u0} -> ${u1}, second ${u1b} -> ${u2}, after undo ${J(g4.take) === J(g1.take) ? "equals" : "differs from"} the first take`,
    )

    /* ── 3 · Esc writes nothing ──────────────────────────────────────────── */
    const esc = async (key) => {
      const before = await fsGet()
      const ub = await undoN()
      await open(1, 1)
      await perform(1, [{ to: 1, steps: 30 }])
      await page.keyboard.press(key)
      await page.waitForTimeout(WAIT)
      const after = await fsGet()
      return { changed: J(after.take) !== J(before.take), open: await staged(), undo: (await undoN()) - ub }
    }
    const e3 = await esc("Escape")
    const n3 = await esc("Enter")
    paired(
      "3 Esc closes the stage and writes nothing",
      !e3.changed && !e3.open && e3.undo === 0,
      "the same performance closed with Enter",
      !n3.changed,
      `Esc: changed ${e3.changed}, stage open ${e3.open}, undo steps +${e3.undo}; Enter: changed ${n3.changed}, +${n3.undo}`,
    )
    await page.evaluate(() => window.__styleHarness.undo())
    await page.waitForTimeout(WAIT)

    /* ── 5 · capture 0.5x: a performance of T seconds is a slot of T/2 ───── */
    const cap = async (s) => {
      await open(1, s)
      const log = await perform(1, [{ to: 1, steps: 60, ms: 20 }])
      const T = log.filter((e) => e.type === "pointermove").pop().t - log.find((e) => e.type === "pointerdown").t
      await keep()
      const g = await fsGet()
      return { T, slot: g.slots[3] - g.slots[2] }
    }
    const h5 = await cap(0.5)
    const w5 = await cap(1)
    const halfOf = (x) => Math.abs(x.slot - x.T / 2) <= FRAME
    paired(
      "5 capture 0.5x: he performs for T and the take plays it in T/2",
      halfOf(h5),
      "the same test on the same stroke performed at 1x",
      halfOf(w5),
      `0.5x: performed ${f1(h5.T)} ms, slot ${f1(h5.slot)} ms; 1x: performed ${f1(w5.T)} ms, slot ${f1(w5.slot)} ms`,
    )

    /* ── 6 · smoothing lowers the pace curve's jitter ────────────────────── */
    await open(4, 1)
    await perform(4, [{ to: 1, steps: 36, ms: (k) => (k % 3 ? 4 : 60) }])
    const ys = () =>
      page.evaluate(() =>
        document.querySelector("[data-perform-graph] polyline").getAttribute("points").split(" ").map((p) => Number(p.split(",")[1])),
      )
    const j0 = jitter(await ys())
    await page.focus("[data-perform-smoothing]")
    await page.keyboard.press("End")
    await settle(120)
    const j1 = jitter(await ys())
    await page.keyboard.press("Home")
    await settle(120)
    const j0b = jitter(await ys())
    await page.keyboard.press("End")
    await settle(120)
    await keep()
    const r6 = (await fsGet()).take.strokes[4]
    const jRow = r6?.performed ? jitter(r6.performed.map((v) => 44 - v * 40)) : NaN
    paired(
      "6 smoothing at 100% lowers the pace's jitter, and Keep writes the smoothed pace",
      j1 < j0 * 0.6 && Math.abs(jRow - j1) < j1 * 0.25 + 1e-6,
      "the same test with the slider back at 0",
      j0b < j0 * 0.6,
      `mean |2nd difference| of the pace, px: 0% ${j0.toFixed(4)}, 100% ${j1.toFixed(4)}, back at 0% ${j0b.toFixed(4)}, kept row ${jRow.toFixed(4)}`,
    )

    /* ── 7 · progress never jumps across the "o" ─────────────────────────── */
    await open(O, 1)
    const oPts = (await stage())[O].pts
    const oArc = arcOf(oPts)
    const trace = []
    const inks = []
    const read = async (s) => {
      trace.push(s.xy ?? [s.x, s.y])
      inks.push((await stage())[O].ink)
    }
    const across = at(oPts, oArc, 0.8)
    await perform(O, [{ to: 0.3, steps: 18 }, { xy: across }, { dwell: 50 }, { xy: at(oPts, oArc, 0.3) }, { to: 1, steps: 44 }], read)
    const oL = oArc[oArc.length - 1]
    const naive = trace.map(([x, y]) => {
      let best = 0, bd = Infinity
      for (let j = 1; j < oPts.length; j++) {
        const [ax, ay] = oPts[j - 1], [bx, by] = oPts[j]
        const dx = bx - ax, dy = by - ay, sg = dx * dx + dy * dy
        const u = sg > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / sg)) : 0
        const d = Math.hypot(ax + dx * u - x, ay + dy * u - y)
        if (d < bd) (bd = d), (best = (oArc[j - 1] + (oArc[j] - oArc[j - 1]) * u) / oL)
      }
      return best
    })
    const maxStep = (xs) => xs.reduce((m, v, k) => (k ? Math.max(m, v - xs[k - 1]) : m), 0)
    const monotone = inks.every((v, k) => !k || v >= inks[k - 1] - 1e-9)
    const window7 = Math.max(48, 0.2 * oL) / oL
    await page.keyboard.press("Escape")
    paired(
      "7 on the o, the ink only moves forward and never leaps across the loop",
      monotone && maxStep(inks) <= window7 + 0.02 && inks[inks.length - 1] >= 0.999,
      "the same leap test on a nearest-point reading of the same pointer path",
      maxStep(naive) <= window7 + 0.02,
      `${inks.length} moves, largest ink step ${maxStep(inks).toFixed(3)} (window ${window7.toFixed(3)}), final ${inks[inks.length - 1]}; nearest-point largest step ${maxStep(naive).toFixed(3)}`,
    )

    /* ── 8 · with no performance the page is the same as main ────────────── */
    // Main's frames were grabbed at 755x890, so all three pictures come from a fresh page with the
    // dock floated (`lib/undock.mjs`), the canvas that size from mount.
    await openPage({ undocked: true })
    const none = await picture()
    await setRows(g1.take.strokes)
    const performed = await picture()
    await clearTake()
    await open(D, 1)
    await perform(D, [{ to: 0.6, steps: 20 }])
    await page.keyboard.press("Escape")
    await page.waitForTimeout(WAIT)
    const after = await picture()
    /* HARDEN-B2: a take 1 ms longer must fail `same`. Each clock is bumped on its own, so a `same`
     * that stopped reading any one of the three is caught; takeMs is null with no take, so its arm
     * reads 1 against null, and penMs and totalDuration carry the 1 ms test proper. */
    const longer = ["takeMs", "penMs", "totalDuration"].map((k) => ({ k, eq: same({ ...none, [k]: (none[k] ?? 0) + 1 }, base) }))
    const row8 = `8 no performance: take, slots and 18 frames equal main's (${base?.head ?? "no base"}), before and after an Esc`
    const row8Detail = base ? `takeMs ${none.takeMs}/${base.takeMs}, penMs ${none.penMs}/${base.penMs}, totalDuration ${none.totalDuration}/${base.totalDuration}; 1 ms longer: ${longer.map((x) => `${x.k} ${x.eq ? "EQUAL (blind)" : "unequal"}`).join(", ")}; rod ${none.engines.rod.filter((h, k) => h === base.engines.rod[k]).length}/9, inflate ${none.engines.inflate.filter((h, k) => h === base.engines.inflate[k]).length}/9 before; after Esc ${J(after.engines) === J(base.engines)}; performed frames equal ${J(performed.engines) === J(base.engines)}; Perform button on the base ${base.performButton}` : "base-main.json missing: run --phase=base against main"
    if (isSelf) selfRow(row8, `${row8Detail}; base ${base.sha.slice(0, 9)} has the served code (${srv.head.slice(0, 9)}), so this compares the tree to itself`)
    else paired(
      row8,
      same(none, base) && same(after, base),
      "the same comparison with the dwell row set, or with any one of the three clocks 1 ms longer",
      same(performed, base) || longer.some((x) => x.eq),
      row8Detail,
    )
    row(pageErrors.length === 0, "no page errors", pageErrors.slice(0, 3).join(" | "))
  }
} catch (e) {
  row(false, "gate threw", String(e?.stack ?? e).split("\n").slice(0, 3).join(" | "))
} finally {
  await browser.close()
}
if (PHASE === "lane" && !SHOT) console.log(`\n${pass} PASS  ${fail} FAIL${notRun ? `  ${notRun} NOT RUN` : ""}  ${selfRows.length} SELF, not graded${selfRows.length ? ": " + selfRows.join(" | ") : ""}`)
process.exitCode = fail || notRun ? 1 : 0

/** A frame's RGBA, decoded once. */
async function pixels(u) {
  const img = await loadImage(Buffer.from(u.split(",")[1], "base64"))
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { w: img.width, h: img.height, d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data }
}

/** Frames side by side, each cropped to `box` plus 24 px, 8 px apart. */
async function writeStrip(path, urls, box) {
  const [bx0, by0, bx1, by1] = box
  const imgs = await Promise.all(urls.map((u) => loadImage(Buffer.from(u.split(",")[1], "base64"))))
  const x = Math.max(0, bx0 - 24), y = Math.max(0, by0 - 24)
  const w = Math.min(imgs[0].width, bx1 + 25) - x, h = Math.min(imgs[0].height, by1 + 25) - y
  if (!(w > 0 && h > 0)) throw new Error(`strip box ${box} is empty`)
  const c = createCanvas(w * imgs.length + 8 * (imgs.length - 1), h)
  const g = c.getContext("2d")
  imgs.forEach((im, k) => g.drawImage(im, x, y, w, h, k * (w + 8), 0, w, h))
  writeFileSync(path, c.toBuffer("image/png"))
}

// assert-stroke-timing-browser.mjs · DOES THE PER-STROKE TAKE DRAW WHAT IT SAYS, ON ROD AND INFLATE?
//
//   FS_PORT=3138 node scripts/verify/assert-stroke-timing-browser.mjs --phase=base   # against a 1051bc8e1 server
//   FS_PORT=3138 node scripts/verify/assert-stroke-timing-browser.mjs                # against this tree
//
// ANIM-1A3 built the take (`lib/stroke-timing.ts`, `window.__fsTake`). This is its browser gate.
//
// WHERE THE EXPECTATIONS COME FROM. Never from `get().slots`. Every expected number is read off
// the render: `get().live.meshes[k].count / total`, the drawRange the last frame drew, measured
// on a NO-ROWS run of the same word at the same instant. A take that is wrong in the schedule and
// wrong in the same way in the slots would pass a slot-based check; it cannot pass this one.
//
// EVERY CHECK HAS AN ARM THAT MUST FAIL. `__fsTake.knockout(name)` zeroes one field of every row
// before the build (speed, delay, holdBack, ease), turns off the tip slope (slope), or hands the
// export the pen time (exportpen). The check is re-run under it and must come back red.
// The identity check's must-fail is a positive control instead: a 1 ms delay must change a frame.
//
// CORPUS. The hero word (`scripts/capture/logo-strokes.json`, 12 strokes) injected through
// `__styleHarness.injectStrokes` at 12 ms a point. Rod, Inflate, Extrude and Solid are graded
// (ANIM-1C wired Extrude and Solid; before it they were printed NOT WIRED and never counted). The export
// rows drive `lib/export` the way the host does (penDurationMs = getTotalDuration()), not the
// Video button, so a host that stopped passing exportMs to the button would not be seen here.
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import { hideDock } from "./lib/dock.mjs"
import ts from "typescript"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { makePaired } from "./lib/paired.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "stroke-timing")
/* THE BASE EACH ENGINE'S 6a IS HELD TO. Rod and Inflate: 1051bc8e1, the head before the take.
 * Extrude: 57a97b4d1, main before ANIM-1C wired it (ANIM-1C, 2026-09-25). One file per head;
 * `--phase=base --base=<sha>` merges the engines it grabs into that head's file.
 * SOLID: 62358b9ff, the raster fix before the wiring (ANIM-1C4, his ruling, 2026-09-25). Its
 * 57a97b4d1 frames were grabbed while Solid dropped strokes 7 to 11 (ink past x 720) and clipped
 * stroke 0's left cap, so they held the bug: 1 of 25 still match. Grabbed twice, byte-equal. */
const BASE_OF = { rod: "1051bc8e1", inflate: "1051bc8e1", extrude: "57a97b4d1", solid: "62358b9ff" }
const baseFile = (h) => join(OUT, `base-${h}.json`)
const BASE_HEAD = (process.argv.find((a) => a.startsWith("--base=")) ?? "--base=1051bc8e1").split("=")[1]
const BASE_FILE = baseFile(BASE_HEAD)
const PHASE = (process.argv.find((a) => a.startsWith("--phase=")) ?? "--phase=lane").split("=")[1]
const ONLY = (process.argv.find((a) => a.startsWith("--engines=")) ?? "--engines=rod,inflate").split("=")[1].split(",")
// `--rows=1,2,6` runs only those numbered rows (R0 always runs). A skipped row prints SKIPPED and is not counted.
const ROWS = (process.argv.find((a) => a.startsWith("--rows=")) ?? "").split("=")[1]?.split(",") ?? null
const want = (n) => !ROWS || ROWS.includes(String(n))
const TAKE_WAIT = Number(process.env.FS_TAKE_WAIT_MS || 1500) // ms after a take is set, before it is read
const K = 5 // the D of Doodle, the longest stroke after the first
const TOL = 0.02 // fraction of a stroke's indices; one ring segment is under 1%
const GRID = Array.from({ length: 25 }, (_, i) => i / 24)

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  :  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
const paired = makePaired(row)
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16)
const LINEAR = { kind: "preset", id: "linear" }
const NEUTRAL = { delayMs: 0, speed: 1, holdBack: false, ease: LINEAR }

mkdirSync(OUT, { recursive: true })
const polys = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8")).polylines
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await context.newPage()
const pageErrors = []
page.on("pageerror", (e) => pageErrors.push(String(e)))

const MODULES = ["frame-plan", "webm", "apng", "encoders", "recorder", "index"]
const transpiled = (name) =>
  ts
    .transpileModule(readFileSync(join(ROOT, "lib", "export", `${name}.ts`), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: `${name}.ts`,
    })
    .outputText.replace(/from\s+["']\.\/([a-z-]+)["']/g, 'from "./$1.js"')
if (PHASE === "lane")
  for (const m of MODULES)
    await page.route(`${LAB_URL}/__fsexport/${m}.js`, (r) =>
      r.fulfill({ status: 200, contentType: "text/javascript", body: transpiled(m) }),
    )

const settle = async (ms = 280) => {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
const grab = async () => page.evaluate(() => window.__captureHarness.grab())
const seekP = async (p) => {
  await page.evaluate((x) => window.__revealHarness.setProgress(x), Math.max(0, Math.min(1, p)))
  await settle()
}
const setEngine = async (mode) => {
  await page.evaluate((m) => {
    window.__styleHarness.setMode(m)
    if (m === "inflate") window.__styleHarness.setInflate({ fusion: "auto" })
  }, mode)
  await page.waitForTimeout(2500)
}

try {
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  // Every row here reads frames or masks, none the strip, so the one page hides the dock and the
  // canvas is main's size from mount (`lib/dock.mjs`, L3). The base head has no dock and is not hidden.
  if (PHASE === "lane") await hideDock(page)
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness, null, {
    timeout: 240000,
  })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    window.__revealHarness.setEase("linear")
    window.__revealHarness.setPlaying(false)
  })
  await page.waitForTimeout(600)

  /* ── PHASE BASE: the base head is not wired for these engines. Grab the grid and leave. ── */
  if (PHASE === "base") {
    const penMs = await page.evaluate(() => window.__revealHarness.getTotalDuration())
    const prior = existsSync(BASE_FILE) ? JSON.parse(readFileSync(BASE_FILE, "utf8")) : null
    if (prior && prior.penMs !== penMs) throw new Error(`${BASE_FILE} was grabbed at penMs ${prior.penMs}, this server reads ${penMs}`)
    const out = { head: BASE_HEAD, penMs, engines: { ...(prior?.engines ?? {}) } }
    for (const eng of ONLY) {
      await setEngine(eng)
      const hashes = []
      for (const p of GRID) {
        await seekP(p)
        hashes.push(sha(await grab()))
      }
      out.engines[eng] = hashes
      console.log(`base ${eng}: ${hashes.length} frames, ${new Set(hashes).size} distinct`)
    }
    writeFileSync(BASE_FILE, JSON.stringify(out, null, 1))
    console.log(`wrote ${BASE_FILE}`)
    process.exitCode = 0
  } else {
    await page.waitForFunction(() => !!window.__fsTake, null, { timeout: 60000 })
    const baseFor = (eng) => (existsSync(baseFile(BASE_OF[eng])) ? JSON.parse(readFileSync(baseFile(BASE_OF[eng]), "utf8")) : null)

    /* The take, set and READ BACK in a later tick (the harness is reinstalled on the new state). */
    const take = async (rows, knock = null, ripple = false) => {
      const ok = await page.evaluate(
        ([r, k, rp]) => (r ? window.__fsTake.set(r, { ripple: rp }) : window.__fsTake.clear()) && window.__fsTake.knockout(k),
        [rows, knock, ripple],
      )
      await page.waitForTimeout(TAKE_WAIT)
      const g = await page.evaluate(() => window.__fsTake.get())
      if (!ok) throw new Error(`__fsTake refused ${JSON.stringify(rows)} knockout=${knock}`)
      if (g.knockout !== knock) throw new Error(`knockout reads ${g.knockout}, asked ${knock}`)
      return g
    }
    const live = () => page.evaluate(() => window.__fsTake.get())
    /* Fraction of stroke k drawn at `ms` on the take's own clock.
     *
     * ROD: `live.meshes[k].count / total`, the drawRange the last frame drew.
     * INFLATE: one fused mesh, so `live.meshes` has one entry and cannot say which stroke drew.
     * The instrument is pixels instead: stroke k's MASK is the set of pixels that are ink in the
     * finished no-rows frame and background in a frame where only stroke k is missing (k held
     * back with a long delay, every other stroke finished) AND ink in a frame where stroke k is
     * whole and every other stroke is held back 20 s (k alone). Reach is the share of that mask
     * that is ink now. Pixels two strokes share are in neither mask, so a neighbour cannot move it.
     * WHY "k alone". Inflate is one fused mesh. ANIM-1A7 dumped the frame at s + 400 + 0.9d under a
     * 400 ms delay (--overlap): 88 of stroke 5's 1396 mask pixels were ink there and not in the
     * no-rows frame, all at the D's stem top; a neighbour with 5 absent inked 0 of them, and 78 were
     * not ink with 5 alone and whole. They are stroke 5's surface drawn on stroke 6's front, in the
     * shipped path too (no rows at s + 0.9d lacks them, the finished frame has them). Either stroke
     * can own them, so the k-alone term drops them from the mask. Rows 2 and 3 read 0.0595 on them.
     * The mask's bounding box is the stroke's screen box and is printed with R0. */
    let masks = null // inflate only: { bg, list: [{ idx: Int32Array, box }] }
    const INK = 24
    const inked = (d, bg, i) => Math.abs(d[i] - bg[i]) > INK || Math.abs(d[i + 1] - bg[i + 1]) > INK || Math.abs(d[i + 2] - bg[i + 2]) > INK
    const fracAt = async (k, ms, dur) => {
      await seekP(ms / dur)
      if (masks) {
        const m = masks.list[k]
        const d = (await pixels(await grab())).d
        let n = 0
        for (const i of m.idx) if (inked(d, masks.bg, i)) n++
        return n / m.idx.length
      }
      const g = await live()
      const m = g.live.meshes[k]
      if (!m || !m.total) throw new Error(`no live mesh ${k} (${g.live.meshes.length} meshes)`)
      return m.count / m.total
    }
    /* First ms at which stroke k shows any ink, and first at which it is whole, by bisection on the render. */
    const edge = async (k, dur, pred, lo, hi) => {
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2
        if (pred(await fracAt(k, mid, dur))) hi = mid
        else lo = mid
      }
      return hi
    }

    const ENGS = process.argv.some((a) => a.startsWith("--engines=")) ? ONLY : ["rod", "inflate", "extrude", "solid"]
    for (const eng of ENGS) {
      await setEngine(eng)
      console.log(`\n§ ${eng.toUpperCase()}`)
      if (eng === "solid" && !process.argv.includes("--grade-solid")) {
        console.log(`NOT GRADED  solid under a timed take. ANIM-1C3 wired it (Solid now rasterizes union(canvas, ink bounds), so the strokes past x 720 build). Not graded, not counted; --grade-solid grades it.`)
        continue
      }
      const g0 = await take(null)
      const pen = g0.totalDuration
      masks = null
      if (eng !== "rod") {
        /* Build the pixel masks. Inflate is one fused mesh; Extrude and Solid rebuild their geometry
         * from the clipped strokes, so a drawRange there is the whole rebuilt mesh and says nothing
         * about reach. All three read reach off the same masks (ANIM-1C). BG is the empty page: every stroke held back 5 s, which queues them
         * one after another from 5 s on, and read at 100 ms, before the first of them opens. */
        const far = Object.fromEntries(polys.map((_, i) => [i, { ...NEUTRAL, holdBack: true, delayMs: 5000 }]))
        const tb = await take(far)
        await seekP(100 / tb.takeMs)
        const bg = (await pixels(await grab())).d
        await take(null)
        await seekP(1)
        const full = await pixels(await grab())
        const list = []
        for (let k = 0; k < polys.length; k++) {
          const th = await take({ [k]: { ...NEUTRAL, holdBack: true, delayMs: 5000 } })
          await seekP((pen + 100) / th.takeMs)
          const heldUrl = await grab()
          if (process.env.FS_MASK_DUMP) writeFileSync(join(process.env.FS_MASK_DUMP, `held-${k}.png`), Buffer.from(heldUrl.split(",")[1], "base64"))
          const held = (await pixels(heldUrl)).d
          const ta = await take(Object.fromEntries(polys.map((_, i) => [i, i === k ? NEUTRAL : { ...NEUTRAL, holdBack: true, delayMs: 20000 }])))
          await seekP((pen + 100) / ta.takeMs)
          const aloneUrl = await grab()
          if (process.env.FS_MASK_DUMP) writeFileSync(join(process.env.FS_MASK_DUMP, `alone-${k}.png`), Buffer.from(aloneUrl.split(",")[1], "base64"))
          const alone = (await pixels(aloneUrl)).d
          const idx = []
          let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
          for (let i = 0; i < full.d.length; i += 4)
            if (inked(full.d, bg, i) && !inked(held, bg, i) && inked(alone, bg, i)) {
              idx.push(i)
              const px = (i >> 2) % full.w
              const py = Math.floor((i >> 2) / full.w)
              if (px < x0) x0 = px
              if (px > x1) x1 = px
              if (py < y0) y0 = py
              if (py > y1) y1 = py
            }
          list.push({ idx: Int32Array.from(idx), box: [x0, y0, x1, y1] })
        }
        await take(null)
        masks = { bg, list }
        const small = list.map((m, k) => (m.idx.length < 50 ? k : null)).filter((k) => k !== null)
        const reachI = (eng !== "inflate" || g0.live.meshes.length === 1) && small.length === 0
        row(reachI, `${eng} R0  the pixel masks reach every stroke`,
          `${list.length} masks of ${polys.length}, ${g0.live.meshes.length} live mesh${eng === "inflate" ? " (fused)" : ""}, smallest ${Math.min(...list.map((m) => m.idx.length))} px${small.length ? `, EMPTY ${small}` : ""} · stroke ${K} box ${list[K].box} (${list[K].idx.length} px)`)
        if (!reachI) {
          console.log(`  ${eng}: the masks do not describe this engine. Every row below is NOT RUN, not passed.`)
          continue
        }
      } else {
        const modes = [...new Set(g0.live.meshes.map((m) => m.mode))].join(",")
        const reach = g0.live.meshes.length === polys.length && g0.live.meshes.every((m) => m.total > 0)
        row(reach, `${eng} R0  the live draw ranges reach every stroke`, `${g0.live.meshes.length} meshes of ${polys.length}, modes ${modes}, penMs ${pen}`)
        if (!reach) {
          console.log(`  ${eng}: live meshes do not describe this engine. Every row below is NOT RUN, not passed.`)
          continue
        }
      }
      /* The no-rows render: stroke K's window, and the half-reach instants of K and K + 1.
       * LEVELS. Rod's drawRange is exact, so "any ink" is > 0 and "whole" is 1. A pixel mask is not:
       * a travelling nose or a fused neighbour tints a few of its pixels outside the stroke's own
       * time (ANIM-1A5 measured first ink 69 ms BEFORE the slot opens, and 0.999 until the last
       * stroke ends). On Inflate "any ink" is > 2% of the mask, "whole" is 98%, and "nothing" is
       * at most 0.5%. The slot is read from half-reach crossings on both engines, never from edges. */
      const LV0 = masks ? 0.02 : 0
      const LV1 = masks ? 0.98 : 1
      const NONE = masks ? 0.005 : 0
      const s = await edge(K, pen, (f) => f > LV0, 0, pen)
      const e = await edge(K, pen, (f) => f >= LV1, s, pen)
      const d = e - s
      const h = await edge(K, pen, (f) => f >= 0.5, s, e)
      const hN = await edge(K + 1, pen, (f) => f >= 0.5, e, pen)
      const g = async (ms) => fracAt(K, ms, pen)
      console.log(`  stroke ${K} draws ${s.toFixed(1)}..${e.toFixed(1)} ms live (${d.toFixed(1)} ms), half at ${h.toFixed(1)}; stroke ${K + 1} half at ${hN.toFixed(1)} ms`)
      const U = [0.2, 0.4, 0.6, 0.8]
      const baseAt = []
      for (const u of U) baseAt.push(await g(s + u * d))
      const worst = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])))

      /* THE SLOT, FROM THE RENDER. Ink sits inside the stroke's slot, not on its edges, so the
       * ink window is the wrong length for hold back and ease. Two rows give the slot:
       *   speed 2 compresses the slot about its start B0, so half reach h2 = B0 + (h - B0)/2  ->  B0 = 2·h2 - h
       *   speed 2 with ripple on moves every later stroke by half the slot  ->  L = 2·(hN - hN')
       * Neither reads `get().slots`. */
      const t2 = await take({ [K]: { ...NEUTRAL, speed: 2 } })
      const h2 = await edge(K, t2.takeMs, (f) => f >= 0.5, 0, h)
      const B0r = 2 * h2 - h
      const tr = await take({ [K]: { ...NEUTRAL, speed: 2 } }, null, true)
      const hNr = await edge(K + 1, tr.takeMs, (f) => f >= 0.5, 0, hN)
      const Lr = 2 * (hN - hNr)
      console.log(`  slot from the render: B0 ${B0r.toFixed(1)} ms (speed-2 half reach ${h2.toFixed(1)}), length ${Lr.toFixed(1)} ms (stroke ${K + 1} moved ${(hN - hNr).toFixed(1)} ms under ripple)`)
      if (!(Lr > 0.5 * d)) console.log(`  the ripple did not move stroke ${K + 1}: slot length ${Lr.toFixed(1)} ms is not a measurement, rows 3 and 4 will fail on it`)

      /* --profile: print stroke K's reach curve under no rows, twelve neutral rows and a 400 ms delay
       * (shifted back by 400), 50 ms apart. A diagnostic; it grades nothing. */
      if (process.argv.includes("--profile")) {
        const Ts = []
        for (let T = s - 300; T <= e + 300; T += 50) Ts.push(T)
        const curve = async (rows, shift) => {
          const t = rows ? await take(rows) : (await take(null), { takeMs: pen })
          const out = []
          for (const T of Ts) out.push((await fracAt(K, T + shift, t.takeMs)).toFixed(3))
          return out
        }
        const c0 = await curve(null, 0)
        const cN = await curve(Object.fromEntries(polys.map((_, i) => [i, NEUTRAL])), 0)
        const cD = await curve({ [K]: { ...NEUTRAL, delayMs: 400 } }, 400)
        if (process.env.FS_MASK_DUMP) {
          for (const [nm, rows, T] of [["none", null, 7125], ["neutral", Object.fromEntries(polys.map((_, i) => [i, NEUTRAL])), 7125], ["delay400", { [K]: { ...NEUTRAL, delayMs: 400 } }, 7125]]) {
            const t = rows ? await take(rows) : (await take(null), { takeMs: pen })
            await seekP(T / t.takeMs)
            writeFileSync(join(process.env.FS_MASK_DUMP, `profile-${nm}-${T}.png`), Buffer.from((await grab()).split(",")[1], "base64"))
          }
        }
        for (let i = 0; i < Ts.length; i++) console.log(`  profile T ${Ts[i].toFixed(0)}  none ${c0[i]}  neutral ${cN[i]}  delay400 ${cD[i]}`)
        await take(null)
      }
      /* --overlap (Inflate, with FS_MASK_DUMP): where does stroke K's mask disagree under a 400 ms
       * delay at u = 0.9? Four frames: Fn no rows at s + 0.9d, Fd delay 400 at s + 400 + 0.9d,
       * Fh stroke K held back far at that same instant (every neighbour in Fd's state, K absent),
       * Fa stroke K alone and whole. Prints how many of the disagreeing mask pixels a neighbour inks
       * at that instant (Fh) and how many are not ink with K alone (Fa). A diagnostic; grades nothing. */
      if (masks && process.argv.includes("--overlap") && process.env.FS_MASK_DUMP) {
        const shot = async (rows, ms) => {
          const t = rows ? await take(rows) : (await take(null), { takeMs: pen })
          await seekP(ms / t.takeMs)
          const u = await grab()
          return { u, px: await pixels(u) }
        }
        const Tn = s + 0.9 * d
        const Fn = await shot(null, Tn)
        const Fd = await shot({ [K]: { ...NEUTRAL, delayMs: 400 } }, Tn + 400)
        const Fh = await shot({ [K]: { ...NEUTRAL, holdBack: true, delayMs: 20000 } }, Tn + 400)
        const Fa = await shot(Object.fromEntries(polys.map((_, i) => [i, i === K ? NEUTRAL : { ...NEUTRAL, holdBack: true, delayMs: 20000 }])), e + 200)
        const bg = masks.bg
        const m = masks.list[K]
        const inM = new Uint8Array(Fn.px.d.length >> 2)
        for (const i of m.idx) inM[i >> 2] = 1
        const [x0, y0, x1, y1] = m.box
        const P = 20, S = 3, W = x1 - x0 + 2 * P, H = y1 - y0 + 2 * P
        const c = createCanvas(W * S, H * S)
        const cx = c.getContext("2d")
        cx.fillStyle = "#000"
        cx.fillRect(0, 0, W * S, H * S)
        const n = { both: 0, dOnly: 0, nOnly: 0, dOnlyH: 0, dOnlyNotA: 0, nOnlyH: 0, nOnlyNotA: 0 }
        for (let y = y0 - P; y < y1 + P; y++)
          for (let x = x0 - P; x < x1 + P; x++) {
            if (x < 0 || y < 0 || x >= Fn.px.w || y >= Fn.px.h) continue
            const i = (y * Fn.px.w + x) * 4
            const a = inked(Fd.px.d, bg, i), b = inked(Fn.px.d, bg, i)
            let col = null
            if (inM[i >> 2]) {
              const hh = inked(Fh.px.d, bg, i), aa = inked(Fa.px.d, bg, i)
              if (a && b) (n.both++, (col = "#fff"))
              else if (a) (n.dOnly++, hh && n.dOnlyH++, !aa && n.dOnlyNotA++, (col = hh ? "#f0f" : "#f00"))
              else if (b) (n.nOnly++, hh && n.nOnlyH++, !aa && n.nOnlyNotA++, (col = hh ? "#0ff" : "#00f"))
              else col = "#333"
            } else if (a) col = "#666"
            if (col) {
              cx.fillStyle = col
              cx.fillRect((x - x0 + P) * S, (y - y0 + P) * S, S, S)
            }
          }
        const D0 = process.env.FS_MASK_DUMP
        writeFileSync(join(D0, `overlap-map-${eng}.png`), c.toBuffer("image/png"))
        for (const [nm, f] of [["Fn", Fn], ["Fd", Fd], ["Fh", Fh], ["Fa", Fa]]) writeFileSync(join(D0, `overlap-${nm}.png`), Buffer.from(f.u.split(",")[1], "base64"))
        console.log(`  overlap at u 0.9 (Tn ${Tn.toFixed(1)}): mask ${m.idx.length} px, ink in both ${n.both}, delay only ${n.dOnly} (neighbour inks ${n.dOnlyH}, not ink with ${K} alone ${n.dOnlyNotA}), no-rows only ${n.nOnly} (neighbour inks ${n.nOnlyH}, not ink alone ${n.nOnlyNotA}) · map white both, red/magenta delay only (magenta a neighbour inks it), blue/cyan no-rows only, grey ink outside the mask`)
        await take(null)
      }
      if (want(1)) {
      /* 1 · SPEED. speed 2 compresses the slot about its start B0 (read off the render above), so
       * the reach that no rows show at T0 = s + u·d shows at B0 + (T0 - B0)/2. Measured from first
       * ink instead (s + u·d/2), the expectation is off by (s - B0)/2 wherever ink opens after the
       * slot does: ANIM-1A6 read 0.0831 on Inflate against a take that was right. */
      const speedArm = async (knock) => {
        const t = await take({ [K]: { ...NEUTRAL, speed: 2 } }, knock)
        const got = []
        for (const u of U) got.push(await fracAt(K, B0r + (s + u * d - B0r) / 2, t.takeMs))
        return { w: worst(got, baseAt), got }
      }
      const sp = await speedArm(null)
      const spK = await speedArm("speed")
      paired(`${eng} 1   speed 2 draws stroke ${K} in half its live time`, sp.w <= TOL, "knockout speed", spK.w <= TOL,
        `worst |Δ| ${sp.w.toFixed(4)} (knockout ${spK.w.toFixed(4)}), want ${baseAt.map((x) => x.toFixed(3))} got ${sp.got.map((x) => x.toFixed(3))}`)
      } else console.log(`SKIPPED  ${eng} 1`)
      if (want(2)) {
      /* 2 · DELAY. 400 ms: nothing at s + 200, and f(s + 400 + u·d) = g(s + u·d). */
      const D = 400
      const delayArm = async (knock) => {
        const t = await take({ [K]: { ...NEUTRAL, delayMs: D } }, knock)
        const early = await fracAt(K, s + D / 2, t.takeMs)
        const got = []
        for (const u of U) got.push(await fracAt(K, s + D + u * d, t.takeMs))
        return { ok: early <= NONE && worst(got, baseAt) <= TOL, early, w: worst(got, baseAt) }
      }
      const dl = await delayArm(null)
      const dlK = await delayArm("delay")
      paired(`${eng} 2   a 400 ms delay starts stroke ${K} 400 ms late and draws it unchanged`, dl.ok, "knockout delay", dlK.ok,
        `ink at s+200: ${dl.early.toFixed(3)} (knockout ${dlK.early.toFixed(3)}), worst |Δ| ${dl.w.toFixed(4)}`)
      } else console.log(`SKIPPED  ${eng} 2`)
      if (want(3)) {
      /* 3 · HOLD BACK. Nothing at its own midpoint. Its slot opens when the rest end (pen), so first
       * ink lands at pen + (s - B0); it then draws unchanged, and the take grows by the slot length. */
      const holdArm = async (knock) => {
        const t = await take({ [K]: { ...NEUTRAL, holdBack: true } }, knock)
        const mid = await fracAt(K, s + d / 2, t.takeMs)
        const sh = await edge(K, t.takeMs, (f) => f > LV0, mid > NONE ? 0 : s + d / 2, t.takeMs)
        const got = []
        for (const u of U) got.push(await fracAt(K, sh + u * d, t.takeMs))
        const grow = t.takeMs - pen
        const want0 = pen + (s - B0r)
        const ok = mid <= NONE && sh >= pen - 0.5 && Math.abs(sh - want0) <= 0.02 * d && worst(got, baseAt) <= TOL && Math.abs(grow - Lr) <= 0.02 * Lr
        return { ok, mid, sh, want0, w: worst(got, baseAt), grow }
      }
      const hb = await holdArm(null)
      const hbK = await holdArm("holdBack")
      paired(`${eng} 3   hold back draws stroke ${K} after every other stroke`, hb.ok, "knockout holdBack", hbK.ok,
        `ink at own midpoint ${hb.mid.toFixed(3)} (knockout ${hbK.mid.toFixed(3)}), first ink ${hb.sh.toFixed(1)} want ${hb.want0.toFixed(1)} (pen ${pen}), worst |Δ| after the rest ${hb.w.toFixed(4)}, take grew ${hb.grow.toFixed(1)} ms for a ${Lr.toFixed(1)} ms slot`)
      } else console.log(`SKIPPED  ${eng} 3`)
      if (want(4)) {
      /* 4 · EASE. "in" (u³) on the slot: f(T) = g(B0 + L·((T - B0)/L)³), T across the ink window. */
      const inAt = (T) => B0r + Lr * Math.pow(Math.max(0, Math.min(1, (T - B0r) / Lr)), 3)
      const baseIn = []
      for (const u of U) baseIn.push(await g(inAt(s + u * d)))
      const easeArm = async (knock) => {
        const t = await take({ [K]: { ...NEUTRAL, ease: { kind: "preset", id: "in" } } }, knock)
        const got = []
        for (const u of U) got.push(await fracAt(K, s + u * d, t.takeMs))
        return { w: worst(got, baseIn), got }
      }
      const ea = await easeArm(null)
      const eaK = await easeArm("ease")
      paired(`${eng} 4   ease "in" bends stroke ${K}'s own slot by u³`, ea.w <= TOL, "knockout ease", eaK.w <= TOL,
        `worst |Δ| ${ea.w.toFixed(4)} (knockout ${eaK.w.toFixed(4)}), want ${baseIn.map((x) => x.toFixed(3))} got ${ea.got.map((x) => x.toFixed(3))}`)
      } else console.log(`SKIPPED  ${eng} 4`)
      if (want(5) && eng === "rod") {
        console.log(`NOT APPLICABLE  rod 5  the nose: the tip slope texture is Inflate's tip shader and Rod does not read it (ANIM-1A4 measured 3 px with and without it). Not graded, not counted.`)
      } else if (want(5) && eng !== "inflate") {
        console.log(`NOT APPLICABLE  ${eng} 5  the nose: the tip slope texture is Inflate's tip shader; ${eng} rebuilds its geometry from the clipped strokes and draws no tip. Not graded, not counted.`)
      } else if (want(5)) {
      /* 5 · THE NOSE AT SPEED 2. Speed 1 at T1 and speed 2 at the instant with the same reach,
       * B0 + (T1 - B0)/2: the pixels must agree. With the slope knocked out the tip is drawn for
       * the wrong speed and they must not. */
      const T1 = s + 0.5 * d
      await take(null)
      await seekP(T1 / pen)
      const ref = await grab()
      const noseArm = async (knock) => {
        const t = await take({ [K]: { ...NEUTRAL, speed: 2 } }, knock)
        await seekP((B0r + (T1 - B0r) / 2) / t.takeMs)
        const shot = await grab()
        return { n: await diffPx(ref, shot), shot }
      }
      const no = await noseArm(null)
      const noK = await noseArm("slope")
      writeFileSync(join(OUT, `${eng}-nose-speed1.png`), Buffer.from(ref.split(",")[1], "base64"))
      writeFileSync(join(OUT, `${eng}-nose-speed2.png`), Buffer.from(no.shot.split(",")[1], "base64"))
      writeFileSync(join(OUT, `${eng}-nose-speed2-noslope.png`), Buffer.from(noK.shot.split(",")[1], "base64"))
      paired(`${eng} 5   the nose rides at speed 2 (speed 2 frame matches speed 1 at the same reach)`, no.n <= 40, "knockout slope", noK.n <= 40,
        `${no.n} px differ (knockout slope ${noK.n} px), bar 40 px`)
      } else console.log(`SKIPPED  ${eng} 5`)
      if (want(6)) {
      /* 6 · IDENTITY. No rows vs 1051bc8e1, byte for byte; neutral rows vs no rows; a 1 ms delay must differ. */
      await take(null)
      const none = []
      const noneLive = []
      for (const p of GRID) {
        await seekP(p)
        none.push(sha(await grab()))
        noneLive.push((await live()).live.meshes.map((m) => m.count))
      }
      const bh = baseFor(eng)?.engines?.[eng]
      const same = bh ? none.filter((h, i) => h === bh[i]).length : 0
      row(!!bh && same === GRID.length, `${eng} 6a  no rows is byte-identical to ${BASE_OF[eng]}`, bh ? `${same}/${GRID.length} frames` : `no base file ${baseFile(BASE_OF[eng])} for ${eng}, NOT RUN`)
      const allNeutral = Object.fromEntries(polys.map((_, i) => [i, NEUTRAL]))
      const tn = await take(allNeutral)
      const neu = []
      const neuLive = []
      for (const p of GRID) {
        await seekP(p)
        neu.push(sha(await grab()))
        neuLive.push((await live()).live.meshes.map((m) => m.count))
      }
      const neuSame = neu.filter((h, i) => h === none[i]).length
      /* Where a frame differs, name the grid index and every stroke whose drawRange moved. */
      const where = neu
        .map((h, i) => (h === none[i] ? null : `p${i}/24: ` + (neuLive[i].map((c, k) => (c !== noneLive[i][k] ? `s${k} ${noneLive[i][k]}->${c}` : null)).filter(Boolean).join(" ") || "no drawRange moved")))
        .filter(Boolean)
      row(neuSame === GRID.length, `${eng} 6b  twelve neutral rows draw the no-rows frames`, `${neuSame}/${GRID.length} frames, timed=${tn.timed}, takeMs ${tn.takeMs}${where.length ? " · differ at " + where.join(" | ") : ""}`)
      /* 6c · POSITIVE CONTROL. A 1 ms delay on EVERY row is the no-rows film 1 ms late. It can only
       * show at an instant where the render steps inside that 1 ms, so find one on the render: bisect
       * stroke K's reach from its midpoint to the next change, and stand 0.4 ms past it. */
      await take(null)
      const m0 = s + 0.5 * d
      const c0 = await g(m0)
      let lo = m0
      let hi = m0 + 60
      if ((await g(hi)) === c0) throw new Error(`stroke ${K} reach does not step within 60 ms of ${m0}`)
      while (hi - lo > 0.2) {
        const mid = (lo + hi) / 2
        if ((await g(mid)) === c0) lo = mid
        else hi = mid
      }
      const T6 = hi + 0.4
      const before = await g(T6 - 1)
      await seekP(T6 / pen)
      const atS = sha(await grab())
      const atSf = await g(T6)
      const t1 = await take(Object.fromEntries(polys.map((_, i) => [i, { ...NEUTRAL, delayMs: 1 }])))
      await seekP(T6 / t1.takeMs)
      const atS1 = sha(await grab())
      const atS1f = await fracAt(K, T6, t1.takeMs)
      row(atS1 !== atS && before !== atSf, `${eng} 6c  POSITIVE CONTROL: a 1 ms delay on every row changes the frame at a ring step`,
        `at ${T6.toFixed(2)} ms: stroke ${K} reach ${atSf.toFixed(4)} no rows, ${atS1f.toFixed(4)} delayed (no rows 1 ms earlier ${before.toFixed(4)}) · ${atS} vs ${atS1}`)

      /* 7 · EXPORT MATCHES LIVE, TWICE. The export walks its plan; the live arm seeks each plan
       * frame's real time over the take's own length. Knockout exportpen hands the export pen time. */
      const TAKE = { [K]: { ...NEUTRAL, holdBack: true }, 2: { ...NEUTRAL, speed: 0.5 } }
      /* SOLID ONE-TICK TOLERANCE. `SolidAnimationTick` syncs the playhead into the rebuild only
       * when `now - lastSyncTimeRef.current >= 22`, so a Solid frame can show the take up to one
       * tick either side of the clock it was asked for. On Solid, a frame whose export hash misses
       * the live hash at its own clock passes if the live frame 22 ms of take time earlier or later
       * matches it. Every other engine keeps exact equality (tickMs 0). The knockout still fails:
       * pen time against take time is off by far more than one tick. */
      const tickMs = eng === "solid" ? 22 : 0
      const exportArm = async (knock) => {
        const t = await take(TAKE, knock)
        return page.evaluate(async ([takeMs, tickMs]) => {
          const mod = await import("/__fsexport/index.js")
          const rh = window.__revealHarness
          const ch = window.__captureHarness
          const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
          const h = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).slice(0, 8).join(".")
          const D = rh.getTotalDuration()
          const film = []
          const host = {
            seek: async (p) => rh.setProgress(p),
            easePlayhead: (c) => rh.ease(c, "linear"),
            settle,
            async grabFrame() {
              const url = ch.grab()
              film.push(await h(url))
              const gi = ch.grabInfo()
              return { kind: "blob", blob: await (await fetch(url)).blob(), width: gi.width, height: gi.height }
            },
          }
          const r = await mod.exportAnimation({ host, penDurationMs: D, timebase: "pen", fps: 8, scale: 1, transparent: false, format: "apng", holdMs: 250, markName: "take" })
          const clocks = r.plan.frames.map((f) => f.clock)
          const liveAt = async (ms) => {
            rh.setProgress(Math.min(1, Math.max(0, ms / takeMs)))
            await new Promise((r) => setTimeout(r, 120))
            await settle()
            return h(ch.grab())
          }
          const f = film.slice(film.length - clocks.length)
          let same = 0, withinTick = 0
          for (let i = 0; i < clocks.length; i++) {
            const ms = clocks[i] * D
            if ((await liveAt(ms)) === f[i]) { same++; continue }
            if (tickMs > 0 && ((await liveAt(ms - tickMs)) === f[i] || (await liveAt(ms + tickMs)) === f[i])) withinTick++
          }
          return { D, takeMs, n: clocks.length, same: same + withinTick, exact: same, withinTick }
        }, [t.takeMs, tickMs])
      }
      const ex1 = await exportArm(null)
      const ex2 = await exportArm(null)
      const exK = await exportArm("exportpen")
      const ok = (x) => x.n > 0 && x.same === x.n && Math.abs(x.D - x.takeMs) < 1e-6
      paired(`${eng} 7   the export films the take the viewport plays, twice`, ok(ex1) && ok(ex2), "knockout exportpen", ok(exK),
        `run 1 ${ex1.same}/${ex1.n} frames at ${ex1.D.toFixed(1)} ms · run 2 ${ex2.same}/${ex2.n} · knockout ${exK.same}/${exK.n} at ${exK.D.toFixed(1)} of ${exK.takeMs.toFixed(1)} ms` +
          (tickMs ? ` · within ${tickMs} ms, not exact: run 1 ${ex1.withinTick}, run 2 ${ex2.withinTick}, knockout ${exK.withinTick}` : ""))
      } else console.log(`SKIPPED  ${eng} 7`)
      await take(null)
    }
    row(pageErrors.length === 0, "no pageerror during the run", pageErrors.slice(0, 3).join(" | ") || "0")
    console.log(`\n${pass} PASS · ${fail} FAIL  (engines ${ENGS.join(", ")})`)
    process.exitCode = fail ? 1 : 0
  }
} finally {
  await browser.close()
}

/** A frame's RGBA, decoded once. */
async function pixels(u) {
  const img = await loadImage(Buffer.from(u.split(",")[1], "base64"))
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { w: img.width, h: img.height, d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data }
}

/** Pixels that differ by more than 24 on any channel. Same size or it throws, never a partial read. */
async function diffPx(a, b) {
  const load = async (u) => {
    const img = await loadImage(Buffer.from(u.split(",")[1], "base64"))
    const c = createCanvas(img.width, img.height)
    c.getContext("2d").drawImage(img, 0, 0)
    return { w: img.width, h: img.height, d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data }
  }
  const A = await load(a)
  const B = await load(b)
  if (A.w !== B.w || A.h !== B.h) throw new Error(`frame sizes differ ${A.w}x${A.h} vs ${B.w}x${B.h}`)
  let n = 0
  for (let i = 0; i < A.d.length; i += 4)
    if (Math.abs(A.d[i] - B.d[i]) > 24 || Math.abs(A.d[i + 1] - B.d[i + 1]) > 24 || Math.abs(A.d[i + 2] - B.d[i + 2]) > 24) n++
  return n
}

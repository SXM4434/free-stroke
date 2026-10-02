// assert-stroke-strip.mjs · DOES DRAGGING A BAR ON THE STROKE STRIP CHANGE THE TAKE, AND ONLY THE TAKE?
//
//   FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-stroke-strip.mjs --phase=base   # against a 3a211a36d server
//   FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-stroke-strip.mjs                # against this tree
//
// ANIM-1B put `components/stroke-strip.tsx` on `/`: one bar per stroke, drag the body to delay a
// stroke, drag an end to change its speed. This is its browser gate. The setup is copied from
// `assert-stroke-timing-browser.mjs`: `chromium` from `lib/browser.mjs`, the hero word through
// `__styleHarness.injectStrokes`, `__revealHarness.setProgress`, `__captureHarness.grab`,
// `__fsTake.get/set/clear/knockout`, and `paired` from `lib/paired.mjs`.
//
// WHERE THE EXPECTATIONS COME FROM. Drags are real mouse events on the bars. What a drag wrote is
// read from `__fsTake.get().take` (the doc) and `get().slots` (the viewport's timed schedule, built
// in the Scene, not in the strip). The strip builds its own copy of that schedule, so row 1 checks
// the two agree. Pictures are `__captureHarness.grab()` hashes, and on Rod also
// `get().live.meshes[k].count`, the drawRange the last frame drew.
//
// EVERY ROW HAS AN ARM THAT MUST FAIL. Either a knockout (`__fsTake.knockout`) re-run that must come
// back red, or the same predicate applied to a state where it cannot hold (the take before the
// drag, the dragged end, two drags instead of one). A control that throws fails the row (paired).
//
// CORPUS. The hero word (`scripts/capture/logo-strokes.json`, 12 strokes) at 12 ms a point, ease
// linear, 1512x982 at DPR 1. Stroke K = 5 (the D of Doodle) is dragged. Pictures on Rod and Inflate;
// Extrude and Solid only for row 6 (no notice, ANIM-1C6). NOT COVERED: touch input, keyboard nudges, the strip at
// other widths, dark theme, and the group-mode strip (assert-take-timeline covers that view).
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import { hideDock, openDock, openStyle, closeStyle } from "./lib/dock.mjs"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { makePaired } from "./lib/paired.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "stroke-strip")
const BASE_FILE = join(OUT, "base-3a211a36d.json")
const PHASE = (process.argv.find((a) => a.startsWith("--phase=")) ?? "--phase=lane").split("=")[1]
const TAKE_WAIT = Number(process.env.FS_TAKE_WAIT_MS || 1500)
const K = 5
const GRID = Array.from({ length: 9 }, (_, i) => i / 8)
const ENGINES = ["rod", "inflate"]

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  :  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
const paired = makePaired(row)
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16)
const LINEAR = { kind: "preset", id: "linear" }
const f1 = (v) => (typeof v === "number" ? v.toFixed(1) : String(v))

mkdirSync(OUT, { recursive: true })
const polys = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8")).polylines
const browser = await chromium.launch()
let context = null
let page = null
const pageErrors = []

const settle = async (ms = 280) => {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
const grab = async () => sha(await page.evaluate(() => window.__captureHarness.grab()))
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
const fsGet = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__fsTake.get())))
const knock = async (name) => {
  if (!(await page.evaluate((n) => window.__fsTake.knockout(n), name))) throw new Error(`knockout ${name} refused`)
  await page.waitForTimeout(TAKE_WAIT)
}
const clearTake = async () => {
  await page.evaluate(() => window.__fsTake.clear() && window.__fsTake.knockout(null))
  await page.waitForTimeout(TAKE_WAIT)
}
/** Everything the strip says about itself, read off the DOM. */
const strip = () =>
  page.evaluate(() => {
    const root = document.querySelector("[data-stroke-strip]")
    if (!root) return null
    const band = root.querySelector("[role=listbox]")
    const bb = band.getBoundingClientRect()
    return {
      axisMs: Number(root.getAttribute("data-axis-ms")),
      ease: root.getAttribute("data-ease"),
      ripple: root.getAttribute("data-ripple"),
      W: band.clientWidth,
      bandX: bb.x,
      notice: root.querySelector("[data-take-notice]")?.textContent ?? null,
      bars: [...root.querySelectorAll("[data-take-bar]")].map((b) => {
        const r = b.getBoundingClientRect()
        return {
          i: Number(b.getAttribute("data-take-bar")),
          t0: Number(b.getAttribute("data-t0")),
          t1: Number(b.getAttribute("data-t1")),
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          sel: b.getAttribute("data-selected") === "1",
        }
      }),
    }
  })
/** A real mouse drag on bar i: "body" from its middle, "start"/"end" 2 px inside that end. */
const drag = async (i, where, dx, steps = 12) => {
  const s = await strip()
  const b = s.bars[i]
  const x = where === "body" ? b.x + b.w / 2 : where === "start" ? b.x + 2 : b.x + b.w - 2
  const y = b.y + b.h / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let k = 1; k <= steps; k++) await page.mouse.move(x + (dx * k) / steps, y)
  await page.mouse.up()
  await page.waitForTimeout(TAKE_WAIT)
  return s
}
const t0Of = (g, i) => g.slots[i * 2]
const t1Of = (g, i) => g.slots[i * 2 + 1]

/* A fresh context per page, so nothing the last page stored comes back. `undocked` hides the dock
   (`lib/dock.mjs`, L3) before the strokes land, so the canvas is main's size from mount. Docked, the
   dock is opened on its Timeline tab once the strokes land, since every later row drives the strip. */
const openPage = async ({ undocked }) => {
  if (context) await context.close()
  context = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })
  page = await context.newPage()
  page.on("pageerror", (e) => pageErrors.push(String(e)))
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  if (undocked) await hideDock(page)
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
  await page.waitForFunction(() => !!window.__fsTake, null, { timeout: 60000 })
  if (!undocked && PHASE !== "base") await openDock(page)
}

try {
  // Row 0 compares frames against main's, so the lane grabs them undocked. The base head has no dock.
  await openPage({ undocked: PHASE !== "base" })

  /* The no-drag picture: every grid frame on Rod and Inflate, plus the take readout minus live. */
  const noDrag = async () => {
    const g = await fsGet()
    const out = {
      take: g.take,
      timed: g.timed,
      penMs: g.penMs,
      totalDuration: g.totalDuration,
      exportMs: g.exportMs,
      engines: {},
    }
    for (const eng of ENGINES) {
      await setEngine(eng)
      const hashes = []
      for (const p of GRID) {
        await seekP(p)
        hashes.push(await grab())
      }
      out.engines[eng] = hashes
    }
    await setEngine("rod")
    return out
  }

  if (PHASE === "base") {
    const out = { head: "3a211a36d", ...(await noDrag()) }
    writeFileSync(BASE_FILE, JSON.stringify(out, null, 1))
    console.log(`wrote ${BASE_FILE}: ${ENGINES.map((e) => `${e} ${new Set(out.engines[e]).size} distinct`).join(", ")}`)
  } else {
    const base = existsSync(BASE_FILE) ? JSON.parse(readFileSync(BASE_FILE, "utf8")) : null

    /* ── 0 · NO DRAG: the page draws what main draws ─────────────────────── */
    const lane = await noDrag()
    if (!base) row(false, "0 no drag vs main 3a211a36d", `base file missing, ${BASE_FILE}. Run --phase=base against main`)
    else {
      const sameMeta = ["take", "timed", "penMs", "totalDuration", "exportMs"].every(
        (k) => JSON.stringify(lane[k]) === JSON.stringify(base[k]),
      )
      const diffs = ENGINES.flatMap((e) => lane.engines[e].map((h, j) => (h === base.engines[e][j] ? null : `${e}@${GRID[j]}`))).filter(Boolean)
      // Positive control: a 300 ms delay on stroke K must change at least one Rod frame.
      await page.evaluate(
        ([k, ease]) => window.__fsTake.set({ [k]: { delayMs: 300, speed: 1, holdBack: false, ease } }),
        [K, LINEAR],
      )
      await page.waitForTimeout(TAKE_WAIT)
      const ctl = []
      for (const p of GRID) {
        await seekP(p)
        ctl.push(await grab())
      }
      await clearTake()
      const ctlDiffs = ctl.filter((h, j) => h !== base.engines.rod[j]).length
      paired(
        "0 no drag: take, durations and 18 frames (Rod, Inflate) byte-identical to main",
        sameMeta && diffs.length === 0,
        "a 300 ms delay on stroke 5 leaves every Rod frame identical",
        ctlDiffs === 0,
        `meta ${sameMeta ? "same" : `lane ${JSON.stringify(lane.take)} ${f1(lane.totalDuration)} vs main ${JSON.stringify(base.take)} ${f1(base.totalDuration)}`}, frames differing ${diffs.length}/18 ${diffs.join(" ")}, control changed ${ctlDiffs}/9`,
      )
    }
    // Every row after 0 drives the strip itself, so they run in a fresh page with the dock as shipped.
    await openPage({ undocked: false })
    const s0 = await strip()
    if (!s0) throw new Error("no [data-stroke-strip] on the page")
    if (s0.ease !== "linear") throw new Error(`strip ease is ${s0.ease}, the mapping below assumes linear`)

    /* ── 1 · the strip's slots are the viewport's slots ──────────────────── */
    await page.evaluate(
      ([ease]) =>
        window.__fsTake.set({
          3: { delayMs: 400, speed: 1.5, holdBack: false, ease },
          8: { delayMs: 0, speed: 1, holdBack: true, ease },
        }),
      [LINEAR],
    )
    await page.waitForTimeout(TAKE_WAIT)
    {
      const g = await fsGet()
      const s = await strip()
      const pxMs = s.axisMs / s.W
      const agree = (st) =>
        st.bars.length === g.slots.length / 2 &&
        st.bars.every(
          (b) =>
            Math.abs(b.t0 - t0Of(g, b.i)) < 0.01 &&
            Math.abs(b.t1 - t1Of(g, b.i)) < 0.01 &&
            Math.abs(b.x - s.bandX - (t0Of(g, b.i) / s.axisMs) * s.W) <= 1 &&
            (b.w <= 3 || Math.abs(b.w - ((t1Of(g, b.i) - t0Of(g, b.i)) / s.axisMs) * s.W) <= 1),
        )
      const worst = Math.max(...s.bars.map((b) => Math.max(Math.abs(b.t0 - t0Of(g, b.i)), Math.abs(b.t1 - t1Of(g, b.i)))))
      paired(
        "1 strip data-t0/t1 = __fsTake.get().slots, and bar pixels within 1 px",
        g.timed && agree(s),
        "the no-rows strip checked against the same slots",
        agree(s0),
        `${s.bars.length} bars, ${g.slots.length / 2} slots, worst ${worst.toFixed(3)} ms, axis ${f1(s.axisMs)} = takeMs ${f1(g.takeMs)}, 1 px = ${pxMs.toFixed(1)} ms`,
      )
    }
    await clearTake()

    /* ── 2 · body drag: delay by the mapped amount, and the picture moves ── */
    {
      const N = 60
      const before = await fsGet()
      const s = await drag(K, "body", N)
      const g = await fsGet()
      const want = (N * s.axisMs) / s.W
      const got = g.take.strokes[K]?.delayMs
      const mapOk = (d) => typeof d === "number" && Math.abs(d - want) <= 1
      const only = Object.keys(g.take.strokes).join(",") === String(K)
      paired(
        `2a body drag ${N} px: stroke ${K + 1} delayMs = N x axisMs / W`,
        mapOk(got) && only,
        "the take before the drag",
        mapOk(before.take.strokes[K]?.delayMs ?? 0),
        `got ${got}, want ${want.toFixed(1)} (axis ${f1(s.axisMs)}, W ${s.W}), rows ${Object.keys(g.take.strokes)}`,
      )
      // A clock instant inside the shift: after the old start, before the new one.
      const oldT0 = s.bars[K].t0
      const newT0 = t0Of(g, K)
      const T = (oldT0 + newT0) / 2
      const dragged = g.take.strokes
      for (const eng of ENGINES) {
        await setEngine(eng)
        await page.evaluate((r) => window.__fsTake.set(r), dragged)
        await page.waitForTimeout(TAKE_WAIT)
        const gd = await fsGet()
        await seekP(T / gd.takeMs)
        const hD = await grab()
        const cD = (await fsGet()).live.meshes[K]?.count
        await knock("delay")
        await seekP(T / gd.takeMs)
        const hK = await grab()
        await clearTake()
        await seekP(T / before.penMs)
        const hN = await grab()
        const cN = (await fsGet()).live.meshes[K]?.count
        const rodInk = eng === "rod" ? cN > 0 && cD === 0 : true
        paired(
          `2b ${eng}: at ${f1(T)} ms, inside the shift, the drawn picture changes`,
          hD !== hN && rodInk,
          "knockout delay: the same instant under the dragged take",
          hK !== hN,
          `shift ${f1(oldT0)} to ${f1(newT0)} ms${eng === "rod" ? `, stroke ${K + 1} drawRange ${cN} -> ${cD}` : ""}, frames drag ${hD} none ${hN} knocked ${hK}`,
        )
      }
      await setEngine("rod")
    }

    /* ── 3 · end drag: speed changes, the other end stays ────────────────── */
    for (const [where, dx] of [
      ["end", 40],
      ["start", -30],
    ]) {
      await clearTake()
      const before = await fsGet()
      const s = await drag(K, where, dx)
      const g = await fsGet()
      const pxMs = s.axisMs / s.W
      const t0 = s.bars[K].t0
      const t1 = s.bars[K].t1
      const base = t1 - t0
      const nt0 = t0Of(g, K)
      const nt1 = t1Of(g, K)
      const want = where === "end" ? base / (t1 + dx * pxMs - t0) : base / (t1 - (t0 + dx * pxMs))
      const sp = g.take.strokes[K]?.speed
      const speedOk = (v) => typeof v === "number" && Math.abs(v - want) / want < 0.005
      const stays = where === "end" ? (a, b) => Math.abs(a - b) < pxMs : (a, b) => Math.abs(a - b) < pxMs
      const keptA = where === "end" ? t0 : t1
      const keptB = where === "end" ? nt0 : nt1
      const movedA = where === "end" ? t1 : t0
      const movedB = where === "end" ? nt1 : nt0
      paired(
        `3${where === "end" ? "a" : "b"} ${where} drag ${dx} px: speed = base / new length`,
        speedOk(sp),
        "the take before the drag",
        speedOk(before.take.strokes[K]?.speed ?? 1),
        `speed ${sp}, want ${want.toFixed(3)}`,
      )
      paired(
        `3${where === "end" ? "c" : "d"} ${where} drag: the other end stays within 1 px`,
        stays(keptA, keptB),
        "the same test on the dragged end",
        stays(movedA, movedB),
        `kept ${f1(keptA)} -> ${f1(keptB)}, dragged ${f1(movedA)} -> ${f1(movedB)} ms, 1 px = ${pxMs.toFixed(1)} ms`,
      )
    }
    await clearTake()

    /* ── 4 · Ripple ──────────────────────────────────────────────────────── */
    {
      const R = 3
      const later = Array.from({ length: 12 - R - 1 }, (_, j) => R + 1 + j)
      const run = async (on) => {
        await clearTake()
        const g0 = await fsGet()
        const b0 = (await strip()).bars.map((b) => b.t0)
        if ((await strip()).ripple !== (on ? "1" : "0")) await page.click("[data-strip-ripple]")
        await page.waitForTimeout(TAKE_WAIT)
        await drag(R, "body", 40)
        const g = await fsGet()
        const shift = t0Of(g, R) - b0[R]
        return { shift, moved: later.map((i) => t0Of(g, i) - b0[i]), ripple: g.take.ripple, penMs: g0.penMs }
      }
      const on = await run(true)
      const off = await run(false)
      const allMoved = (r) => r.shift > 100 && r.moved.every((m) => Math.abs(m - r.shift) < 1)
      const noneMoved = (r) => r.shift > 100 && r.moved.every((m) => Math.abs(m) < 0.5)
      paired(
        "4a Ripple on: every later stroke moves with the dragged one",
        on.ripple === true && allMoved(on),
        "the same test on the Ripple off drag",
        allMoved(off),
        `shift ${f1(on.shift)} ms, later ${on.moved.map(f1).join(" ")}`,
      )
      paired(
        "4b Ripple off: no later stroke moves",
        off.ripple === false && noneMoved(off),
        "the same test on the Ripple on drag",
        noneMoved(on),
        `shift ${f1(off.shift)} ms, later ${off.moved.map(f1).join(" ")}`,
      )
    }
    await clearTake()

    /* ── 5 · one drag is one undo step, and undo gives the rows back ─────── */
    {
      await page.evaluate(
        ([ease]) => window.__fsTake.set({ 2: { delayMs: 120, speed: 0.8, holdBack: false, ease }, 9: { delayMs: 0, speed: 1, holdBack: true, ease } }),
        [LINEAR],
      )
      await page.waitForTimeout(TAKE_WAIT)
      const snap = JSON.stringify((await fsGet()).take)
      const n0 = await page.evaluate(() => window.__styleHarness.undoLabels().past.length)
      await drag(K, "body", 50, 24)
      const n1 = await page.evaluate(() => window.__styleHarness.undoLabels().past.length)
      const labels = await page.evaluate(() => window.__styleHarness.undoLabels().past)
      const draggedTake = JSON.stringify((await fsGet()).take)
      await page.evaluate(() => window.__styleHarness.undo())
      await page.waitForTimeout(TAKE_WAIT)
      const back = JSON.stringify((await fsGet()).take)
      // Control for the count: two drags.
      const m0 = await page.evaluate(() => window.__styleHarness.undoLabels().past.length)
      await drag(K, "body", 30, 12)
      await drag(K, "body", -20, 12)
      const m1 = await page.evaluate(() => window.__styleHarness.undoLabels().past.length)
      paired(
        "5a one drag of 24 moves is one undo step, labelled Stroke timing",
        n1 - n0 === 1 && labels[labels.length - 1] === "Stroke timing",
        "the same count over two drags",
        m1 - m0 === 1,
        `steps ${n1 - n0} (two drags ${m1 - m0}), last label ${labels[labels.length - 1]}`,
      )
      paired(
        "5b undo restores the rows exactly",
        back === snap,
        "the same comparison on the dragged take",
        draggedTake === snap,
        back === snap ? `${back.length} chars` : `before ${snap} after undo ${back}`,
      )
    }
    await clearTake()

    /* ── 6 · no mode says it ignores the take (ANIM-1C6) ─────────────────
     * Until ANIM-1C6 this row held the strip to "Stroke timing does not reach Extrude/Solid yet".
     * Every engine now plays the take, graded on all four by `assert-stroke-timing-browser.mjs
     * --grade-solid`, and the line is gone. The row holds the new truth: with rows on Extrude and on
     * Solid the strip is up with one bar per stroke, and no [data-take-notice] exists anywhere in
     * the page (the strip and both panel doors). Its arm is a POSITIVE CONTROL: a notice planted
     * in the strip must be read back, so a reader gone blind cannot pass the row. */
    {
      for (const mode of ["extrude", "solid"]) {
        await page.evaluate(([k, ease]) => window.__fsTake.set({ [k]: { delayMs: 200, speed: 1, holdBack: false, ease } }), [K, LINEAR])
        await page.waitForTimeout(TAKE_WAIT)
        await setEngine(mode)
        const s = await strip()
        const g = await page.evaluate(() => window.__fsTake.get())
        const anywhere = await page.evaluate(() => document.querySelectorAll("[data-take-notice]").length)
        const planted = await page.evaluate(() => {
          const root = document.querySelector("[data-stroke-strip]")
          if (!root) return false
          const el = document.createElement("span")
          el.setAttribute("data-take-notice", "")
          el.setAttribute("data-planted", "")
          el.textContent = "PLANTED"
          root.appendChild(el)
          return true
        })
        const seen = (await strip())?.notice ?? null
        await page.evaluate(() => document.querySelectorAll("[data-planted]").forEach((e) => e.remove()))
        const name = mode[0].toUpperCase() + mode.slice(1)
        paired(
          `6 ${mode}: with rows, the strip is up and nothing says the take does not reach ${name}`,
          !!s && !!g && s.bars.length === g.slots.length / 2 && s.bars.length > 0 && s.notice === null && anywhere === 0,
          "positive control: a notice planted in the strip reads as no notice",
          !planted || seen !== "PLANTED",
          `bars ${s?.bars.length} of ${g ? g.slots.length / 2 : "?"}, strip notice ${JSON.stringify(s?.notice)}, notices in the page ${anywhere}, planted read back ${JSON.stringify(seen)}`,
        )
      }
      await setEngine("rod")
    }
    await clearTake()

    /* ── 7 · the selected stroke's numbers, in both doors ───────────────── */
    {
      const s = await strip()
      const b = s.bars[K]
      await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2)
      await page.waitForTimeout(TAKE_WAIT)
      // A click is a zero-length drag: it must select and write nothing.
      const afterClick = await fsGet()
      const sel = (await strip()).bars[K].sel
      const g0 = await fsGet()
      const n0 = { t0: s.bars[K].t0, len: s.bars[K].t1 - s.bars[K].t0 }

      // Door 1: the Animation family of the Style panel (the style bar's Animation pill until L4).
      await openStyle(page, "animation")
      await page.waitForTimeout(800)
      const blocks1 = await page.locator(`[data-stroke-block="${K}"]`).count()
      await page.locator(`[data-stroke-block="${K}"] [data-stroke-field="delay"]`).first().fill("250")
      await page.waitForTimeout(TAKE_WAIT)
      const g1 = await fsGet()
      const shift1 = t0Of(g1, K) - n0.t0
      await knock("delay")
      const g1k = await fsGet()
      const shift1k = g1k.slots ? t0Of(g1k, K) - n0.t0 : 0
      await knock(null)
      paired(
        `7a Animation tab: stroke ${K + 1} delay 250 moves its slot 250 ms`,
        sel && Object.keys(afterClick.take.strokes).length === 0 && blocks1 === 1 && g1.take.strokes[K]?.delayMs === 250 && Math.abs(shift1 - 250) < 1,
        "knockout delay, the same slot",
        Math.abs(shift1k - 250) < 1,
        `selected ${sel}, click wrote ${Object.keys(afterClick.take.strokes).length} rows, blocks ${blocks1}, delay ${g1.take.strokes[K]?.delayMs}, slot moved ${f1(shift1)} (knocked ${f1(shift1k)})`,
      )
      // Close the panel, so the popover's block is the only one: another family first, so the
      // Animation family's blocks leave the page, then the panel itself.
      await openStyle(page, "presets")
      await closeStyle(page)
      await page.waitForTimeout(600)

      // Door 2: the Timing popover.
      await page.locator("[data-animation-drawin]").first().click()
      await page.waitForTimeout(800)
      const blocks2 = await page.locator(`[data-stroke-block="${K}"]`).count()
      const shown = await page.locator(`[data-stroke-block="${K}"] [data-stroke-field="delay"]`).first().inputValue()
      await page.locator(`[data-stroke-block="${K}"] [data-stroke-field="speed"]`).first().fill("2")
      await page.waitForTimeout(TAKE_WAIT)
      const g2 = await fsGet()
      const len2 = t1Of(g2, K) - t0Of(g2, K)
      await knock("speed")
      const g2k = await fsGet()
      const len2k = t1Of(g2k, K) - t0Of(g2k, K)
      await knock(null)
      const halved = (l) => Math.abs(l - n0.len / 2) < 1
      paired(
        `7b Timing popover: the same stroke, speed 2 halves its slot`,
        blocks2 === 1 && shown === "250" && g2.take.strokes[K]?.speed === 2 && halved(len2),
        "knockout speed, the same slot",
        halved(len2k),
        `blocks ${blocks2}, popover shows delay ${shown}, speed ${g2.take.strokes[K]?.speed}, length ${f1(n0.len)} -> ${f1(len2)} (knocked ${f1(len2k)})`,
      )
      await page.keyboard.press("Escape")
      void g0
    }
    await clearTake()

    row(pageErrors.length === 0, "no page errors", pageErrors.slice(0, 3).join(" | "))
  }
} catch (e) {
  row(false, "gate threw", String(e?.stack ?? e).split("\n").slice(0, 3).join(" | "))
} finally {
  await browser.close()
}
if (PHASE !== "base") console.log(`\n${pass} PASS  ${fail} FAIL`)
process.exitCode = fail ? 1 : 0

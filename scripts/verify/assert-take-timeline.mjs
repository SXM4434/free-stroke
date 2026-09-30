// assert-take-timeline.mjs · DOES THE STRIP DRAW THE SCHEDULE THAT RENDERS?
//
//   FS_PORT=3105 node scripts/verify/assert-take-timeline.mjs
//   FS_PORT=3105 node scripts/verify/assert-take-timeline.mjs --keep   # keep the pngs
//
// `docs/animation-toolset-map.md` §3 item 11, verbatim: *"There is no visual
// representation of WHEN anything happens to your drawing."* `components/take-timeline.tsx`
// closes it. This is what says so, and what will say when it stops being true.
//
// ── WHAT THIS GATE IS FOR, IN ONE LINE ────────────────────────────────────
//
// A strip that draws bars is easy. A strip that draws THE SCHEDULE THE
// RENDERER IS USING is the claim, and the two are indistinguishable in a
// screenshot. So every geometric row here is measured against
// `window.__fsSchedule.tracks`, the model `Scene` publishes and the render
// paths read, never against a second copy of the law computed in this file.
//
// ── AND HALF THE GATES IN THIS REPO CANNOT REPORT THEIR OWN FAILURE ────────
//
// `STATUS.md`, measured 2026-08-28: *"~53 of 104 gates cannot report the
// failure they exist for."* So no comparator here is trusted until it has been
// shown to REFUSE something:
//
//   §B3  the ordering comparator is re-run against a SHUFFLED copy of the
//        model's tracks and must FAIL. A comparator that cannot tell a
//        reordered word from an as-drawn one is measuring the DOM, not the
//        feature.
//   §C1  `order: reversed` must MOVE the bars. An inert strip, one that draws
//        a plausible staircase from the stroke list and never reads the
//        schedule, passes every other row in this file and dies here.
//   §D2  `Vanish` must make the ink go DOWN as the playhead advances. The first
//        build of this component filled every bar from the left, which is right
//        for one of the four window modes and a lie in the other three. This
//        row is that bug, held.
//   §F2  the read-only claim is paired: clicking a BAR must not change the
//        take, and clicking a real pill must. Without the second half, "the
//        take did not change" is also what a broken reader reports.
//
// ── ON `/` THE STRIP IS A CONTROL NOW. THE RULING ─────────────────────────
//
// `docs/rulings/2026-09-25-animation-comes-back.md`, his words: *"we're
// bringing basically everything back"*. It voided "the strip is a view" on
// `/` and made it a stroke timeline he drags (`components/stroke-strip.tsx`).
// `take-timeline.tsx`'s default export picks by host: the editable strip where
// a host provides the take, the read-only view everywhere else. So this gate
// reads whichever band rendered (`kind`), and §F and §C4 branch on it:
//
//   view   F1 and F2 exactly as above. No host renders the view today (`/`
//          provides the take, `/desk-doodles` is chromeless and has no strip),
//          and §G says so on every run that could not ask them.
//   strip  F1  every bar IS a control. Must-fail: the same probe on the ticks.
//          F2  a click selects and writes nothing. Must-fail: the same reader
//              after a real drag must see the write.
//          F3  a drag writes the take. Must-fail: the same drag over the
//              strip's title writes nothing.
//          C4  the strip keeps one row per stroke, so "fewer rows" cannot
//              apply. Asked instead at overlap 0.8, where Scene groups: one bar
//              per stroke, in the grouped model's order. Must-fail: a rotated
//              model, as in B2.
//
// ── WHAT IT DOES NOT CHECK ────────────────────────────────────────────────
// Named in the run's own output, not left for a reader to infer. See §G.
import { chromium } from "./lib/browser.mjs"
import { LAB_URL, PORT } from "./lib/dev-server.mjs"
import { mkdirSync, rmSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { makePaired } from "./lib/paired.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "take-timeline")
const KEEP = process.argv.includes("--keep")

let pass = 0
let fail = 0
const skipped = []
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  —  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
/** A row whose control MUST come back false, or the row proves nothing. */
/* ONE PLACE OF TRUTH. See scripts/verify/lib/paired.mjs.
 * This file passed VALUES rather than thunks, so nothing could throw inside it and it was SAFE. `makePaired` accepts a value or a thunk, so the call sites are unchanged. */
const paired = makePaired(row)
/** Not a pass. A row that could not be asked is recorded as unasked. */
const vacuous = (name, why) => {
  console.log(`VACUOUS  ${name}  —  ${why}`)
  skipped.push(`${name}: ${why}`)
}

mkdirSync(OUT, { recursive: true })
const written = []

/* ══════════════════════════════════════════════════════════════════════════
 * §0 · WHICH SERVER IS BEING GRADED, AND HOW OLD ITS BUILD IS
 *
 * `DISPATCH.md` §3 already rules on this: *"Restart the dev server before a
 * battery, and re-run a red before you write it down."* It was written after 18
 * runs where **all six gate-by-mode cells disagreed with themselves** and the
 * variable turned out to be the server, not the window.
 *
 * ⚠ MEASURED AGAIN 2026-09-04, WHICH IS WHY THIS BLOCK EXISTS RATHER THAN A
 * SENTENCE IN A DOC. The `next dev --webpack -p 3105` serving this checkout had
 * been up **9 d 3 h**, and its file watcher had stopped firing: two edits to
 * `components/take-timeline.tsx` compiled, and every edit after them was
 * invisible. The gate then reported §D red for an hour against a build that no
 * longer existed on disk. The same thing happened to a fresh server after its
 * FIRST change. **A stale server does not announce itself and every row below
 * is a claim about the BUILD, never about the file.**
 *
 * So the uptime is printed as provenance on every run, the way
 * `lib/dev-server.mjs` prints the port, and if anything goes red on an old
 * server the summary names this first. It does not fail a row: an old server is
 * a hazard, not a verdict, and a gate that went red on somebody's uptime would
 * be reporting about the machine rather than about the mark.
 * ════════════════════════════════════════════════════════════════════════ */
const serverAge = (() => {
  try {
    const pid = execFileSync("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")[0]
      .trim()
    if (!pid) return null
    const et = execFileSync("ps", ["-o", "etime=", "-p", pid], { encoding: "utf8" }).trim()
    // `[[dd-]hh:]mm:ss`
    const m = et.match(/^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/)
    if (!m) return { pid, etime: et, hours: null }
    const hours = (+(m[1] ?? 0)) * 24 + +(m[2] ?? 0) + +m[3] / 60 + +m[4] / 3600
    return { pid, etime: et, hours }
  } catch {
    return null
  }
})()
console.log(
  `[server] :${PORT} — ${
    serverAge
      ? `pid ${serverAge.pid}, up ${serverAge.etime}`
      : "could not be identified, so its build's age is UNKNOWN"
  }`,
)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on("pageerror", (e) => pageErrors.push(String(e)))

try {
  /* `networkidle` stalls on this app; `domcontentloaded` plus a settle is the
   * shape every browser gate here uses. The harness is the readiness signal. */
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(9000)
  await page.waitForFunction(() => !!window.__revealHarness, null, { timeout: 60000 })

  const shot = async (name) => {
    try {
      written.push(join(OUT, `${name}.png`))
      await page.screenshot({ path: join(OUT, `${name}.png`), timeout: 60000 })
    } catch {
      console.log(`  (screenshot ${name} could not be taken. Evidence missing, not a pass)`)
    }
  }

  /** Everything the strip is currently saying, read off the DOM.
   *
   * TWO BANDS, ONE READER. The read-only view's band is `role=img`; the
   * editable strip's (`[data-stroke-strip]`) is `role=listbox`. The reader
   * names which one it found in `kind`, and a root with NEITHER band throws
   * rather than returning a zero that reads like an empty strip: that is how
   * this gate crashed after A1 on 2026-09-25, and a quiet zero would have been
   * worse. A bar may carry more than one `[data-take-ink]` segment on the
   * strip (a Travel window split across the bar), so ink is summed per bar;
   * reading only the first segment would under-count and look like a mark
   * that emptied. */
  const strip = () =>
    page.evaluate(() => {
      const root = document.querySelector("[data-take-timeline]")
      if (!root) return { present: false, bars: [], rows: 0, ticks: 0, edges: 0, inked: 0 }
      const editable = root.hasAttribute("data-stroke-strip")
      const band = root.querySelector(editable ? "[role=listbox]" : "[role=img]")
      if (!band) throw new Error(`strip(): a ${editable ? "stroke-strip" : "read-only"} root with no ${editable ? "listbox" : "img"} band`)
      const bb = band.getBoundingClientRect()
      const bars = [...root.querySelectorAll("[data-take-bar]")].map((b) => {
        const r = b.getBoundingClientRect()
        const inks = [...b.querySelectorAll("[data-take-ink]")].map((k) => k.getBoundingClientRect())
        return {
          stroke: Number(b.getAttribute("data-take-bar")),
          start: Number(b.getAttribute("data-start")),
          end: Number(b.getAttribute("data-end")),
          selected: b.getAttribute("data-selected"),
          t0: Number(b.getAttribute("data-t0")),
          left: r.left,
          width: r.width,
          top: r.top,
          height: r.height,
          inkLeft: inks.length ? Math.min(...inks.map((k) => k.left)) : null,
          inkWidth: inks.length ? inks.reduce((a, k) => a + k.width, 0) : null,
        }
      })
      return {
        present: true,
        kind: editable ? "strip" : "view",
        band: { left: bb.left, width: bb.width, height: bb.height },
        bars,
        rows: root.querySelectorAll("[data-take-row]").length,
        ticks: root.querySelectorAll("[data-take-tick]").length,
        edges: root.querySelectorAll("[data-take-edge]").length,
        inked: bars.filter((b) => b.inkWidth !== null && b.inkWidth > 0).length,
        inkTotal: bars.reduce((a, b) => a + (b.inkWidth ?? 0), 0),
        text: (root.innerText ?? "").replace(/\n/g, " | "),
      }
    })

  /** THE MODEL. What `Scene` published, which is what every render path reads. */
  const model = () =>
    page.evaluate(() => {
      const s = window.__fsSchedule
      if (!s) return null
      return {
        tracks: s.tracks.map((t) => ({ stroke: t.stroke, start: t.start, end: t.end, reverse: t.reverse })),
        unitCount: s.unitCount,
        identity: s.identity,
        params: s.params,
      }
    })

  const setDrawIn = async (patch) => {
    const ok = await page.evaluate((p) => window.__revealHarness.setDrawIn(p), patch)
    /* React state, then the harness is reinstalled on it. Explainer 26 §13:
     * reading in the same tick returns the PREVIOUS value. */
    await page.waitForTimeout(400)
    return ok
  }
  const setWindow = async (patch) => {
    const ok = await page.evaluate((p) => window.__revealHarness.setWindow(p), patch)
    await page.waitForTimeout(400)
    return ok
  }
  const seek = async (v) => {
    await page.evaluate((p) => window.__revealHarness.setProgress(p), v)
    await page.waitForTimeout(280)
  }

  /* ══════════════════════════════════════════════════════════════════════
   * §A · IT IS REACHED BY DRAWING, NOT BY READING A RENDER CONDITION
   * ════════════════════════════════════════════════════════════════════ */
  console.log("\n§A · reachability. The strip is driven to, not reasoned about")

  const before = await strip()
  row(
    before.present === false,
    "A1   an empty page has no strip",
    "map §8: a timeline with nothing to show is a worse product than no timeline",
  )
  await shot("A1-empty")

  const box = await page.locator("canvas[aria-label*='Drawing canvas']").boundingBox()
  const drawStroke = async (x0, y0, steps, dx, dy) => {
    await page.mouse.move(box.x + x0, box.y + y0)
    await page.mouse.down()
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(box.x + x0 + i * dx, box.y + y0 + i * dy + Math.sin(i / 3) * 18)
      await page.waitForTimeout(8)
    }
    await page.mouse.up()
    await page.waitForTimeout(150)
  }
  /* Five strokes, and two of them CROSS on purpose: the group/stroke row in §C3
   * is vacuous on a drawing whose ink never fuses, and a vacuous row that
   * prints PASS is the silent green this repo keeps paying for. */
  await drawStroke(90, 150, 18, 15, 1)
  await drawStroke(90, 300, 10, 16, 2)
  await drawStroke(120, 250, 14, 4, 12) //  crosses the next one
  await drawStroke(70, 300, 14, 12, 0) //   crossed by the previous one
  await drawStroke(110, 470, 22, 13, -1)
  await page.waitForTimeout(1200)

  const m0 = await model()
  const s0 = await strip()
  row(s0.present === true, "A2   drawing five strokes brings the strip into being")
  row(
    m0 !== null && m0.tracks.length === 5,
    "A3   the model published five tracks",
    `tracks = ${m0 ? m0.tracks.length : "null"} of 5 strokes drawn`,
  )
  row(
    s0.bars.length === m0.tracks.length,
    "A4   one bar per stroke, no more and no fewer",
    `${s0.bars.length} bars of ${m0.tracks.length} tracks`,
  )
  row(s0.ticks === 3, "A5   three quarter ticks on the axis", `${s0.ticks} of 3`)
  row(
    s0.text.includes("When each") && /\d\.\ds total/.test(s0.text),
    "A6   the strip says what it is and how long the beat is",
    JSON.stringify(s0.text),
  )
  await shot("A2-drawn")

  /* ══════════════════════════════════════════════════════════════════════
   * §B · THE BARS ARE WHERE THE PUBLISHED SCHEDULE SAYS THEY ARE
   * ════════════════════════════════════════════════════════════════════ */
  console.log("\n§B · the strip against the model, with the comparator calibrated")

  /* B1 · the pixels agree with the bar's own declared interval. Catches a
   * layout bug that leaves the numbers right and the picture wrong. */
  {
    let worst = 0
    for (const b of s0.bars) {
      const wantL = s0.band.left + b.start * s0.band.width
      const wantW = Math.max(1, (b.end - b.start) * s0.band.width)
      worst = Math.max(worst, Math.abs(b.left - wantL), Math.abs(b.width - wantW))
    }
    row(worst <= 1.5, "B1   every bar's pixels match its declared interval", `worst |Δ| = ${worst.toFixed(2)} px over ${s0.bars.length} bars, bar = 1.5 px`)
  }

  /* B2 · the ORDER the strip draws is the order the model scheduled. Compared
   * as a partial order over every pair, so no time law is restated here. */
  const orderAgrees = (bars, tracks) => {
    const byStroke = new Map(bars.map((b) => [b.stroke, b]))
    let tested = 0
    let bad = 0
    for (let i = 0; i < tracks.length; i++) {
      for (let j = 0; j < tracks.length; j++) {
        if (i === j) continue
        if (!(tracks[i].start + 1e-4 < tracks[j].start)) continue
        const bi = byStroke.get(tracks[i].stroke)
        const bj = byStroke.get(tracks[j].stroke)
        if (!bi || !bj) continue
        tested++
        if (!(bi.start <= bj.start + 1e-6)) bad++
      }
    }
    return { tested, bad, ok: tested > 0 && bad === 0 }
  }
  {
    const real = orderAgrees(s0.bars, m0.tracks)
    /* THE KNOWN-BAD. Same comparator, same bars, a rotated model. If a rotation
     * still agrees, the comparator is reading nothing. */
    const rotated = m0.tracks.map((t, i) => ({ ...t, stroke: m0.tracks[(i + 1) % m0.tracks.length].stroke }))
    const ctrl = orderAgrees(s0.bars, rotated)
    paired(
      "B2   every scheduled ordering the model states is the ordering drawn",
      real.ok,
      "the same comparator against a rotated model",
      ctrl.ok,
      `${real.tested - real.bad} of ${real.tested} ordered pairs agree`,
    )
  }

  /* ══════════════════════════════════════════════════════════════════════
   * §C · IT IS A VIEW OF THE MODIFIERS. Turn a dial, the picture moves
   * ════════════════════════════════════════════════════════════════════ */
  console.log("\n§C · the dials reach the picture")

  const firstBar = (s) => s.bars.find((b) => b.stroke === 0)
  const lastBar = (s) => s.bars.find((b) => b.stroke === s.bars.length - 1)

  const asDrawn = s0
  await setDrawIn({ order: "reversed" })
  const reversed = await strip()
  const mRev = await model()
  await shot("C1-reversed")
  {
    const movedRight = firstBar(reversed).left - firstBar(asDrawn).left
    const movedLeft = lastBar(asDrawn).left - lastBar(reversed).left
    paired(
      "C1   `Reversed` flips the staircase, the first stroke drawn lands last",
      movedRight > 20 && movedLeft > 20,
      "an inert strip: the bars did not move at all",
      Math.abs(movedRight) < 1 && Math.abs(movedLeft) < 1,
      `stroke 0 moved +${movedRight.toFixed(0)} px right, stroke 4 moved ${movedLeft.toFixed(0)} px left`,
    )
    const rev = orderAgrees(reversed.bars, mRev.tracks)
    row(rev.ok, "C2   and the reversed picture still matches the reversed model", `${rev.tested - rev.bad} of ${rev.tested} ordered pairs`)
  }

  const overlaps = (bars) => {
    let n = 0
    for (let i = 0; i < bars.length; i++)
      for (let j = i + 1; j < bars.length; j++)
        if (Math.min(bars[i].end, bars[j].end) - Math.max(bars[i].start, bars[j].start) > 1e-4) n++
    return n
  }
  await setDrawIn({ order: "asDrawn", overlap: 0 })
  const seq = await strip()
  await setDrawIn({ overlap: 0.8 })
  const conc = await strip()
  await shot("C3-overlap")
  paired(
    "C3   `Overlap` puts two units on the page at once, and the strip shows it",
    overlaps(conc.bars) > 0,
    "the same count at overlap 0, where exactly one unit is ever drawing",
    overlaps(seq.bars) > 0,
    `${overlaps(conc.bars)} overlapping pairs at 0.8, ${overlaps(seq.bars)} at 0`,
  )

  await setDrawIn({ overlap: 0, unit: "stroke" })
  const perStroke = await strip()
  await setDrawIn({ unit: "group" })
  const perGroup = await strip()
  await shot("C4-groups")
  /* C4 ON THE STRIP. The editable strip keeps ONE ROW PER STROKE by design
   * (a bar is the handle for one stroke's timing), so the view's question,
   * "do fused strokes collapse into fewer rows", has no meaning there, and
   * asking it prints "the ink never fused" about a drawing whose ink did.
   * Nor do fused strokes share an interval: `buildSchedule` lays a unit's
   * members one after another inside the unit's slot. And at `asDrawn` +
   * overlap 0, where the view's C4 runs, Scene skips the grouping entirely
   * (take-timeline.tsx, "ONE DELIBERATE DIVERGENCE"), so `Groups` moves
   * nothing there. So the strip is asked at overlap 0.8, where Scene does
   * group: one bar per stroke kept, and every ordering the grouped model
   * states is the ordering drawn. Must-fail: the same comparator against a
   * rotated model, as in B2. Vacuous, with the model's own count, when no ink
   * fused. ANIM-1B3, 2026-09-25. */
  if (perGroup.kind === "strip") {
    await setDrawIn({ overlap: 0.8, unit: "stroke" })
    const sS = await strip()
    await setDrawIn({ unit: "group" })
    const sG = await strip()
    const mG = await model()
    await setDrawIn({ overlap: 0 })
    const units = mG ? mG.unitCount : null
    if (units === null || units >= sG.bars.length) {
      vacuous(
        "C4   under `Groups` the strip keeps one bar per stroke, in the grouped model's order",
        `the model reports ${units} units from ${sG.bars.length} strokes at overlap 0.8, so no ink fused and the row cannot be asked`,
      )
    } else {
      const real = orderAgrees(sG.bars, mG.tracks)
      const rotated = mG.tracks.map((t, i) => ({ ...t, stroke: mG.tracks[(i + 1) % mG.tracks.length].stroke }))
      const ctrl = orderAgrees(sG.bars, rotated)
      const moved = sG.bars.filter((b) => {
        const o = sS.bars.find((x) => x.stroke === b.stroke)
        return !o || Math.abs(o.t0 - b.t0) > 1
      }).length
      paired(
        "C4   under `Groups` the strip keeps one bar per stroke, in the grouped model's order",
        sG.bars.length === sS.bars.length && sG.bars.length === mG.tracks.length && real.ok,
        "the same comparator against a rotated model",
        ctrl.ok,
        `${units} units from ${sG.bars.length} strokes at overlap 0.8, ${real.tested - real.bad} of ${real.tested} ordered pairs agree, ${moved} of ${sG.bars.length} bars moved from Strokes`,
      )
    }
  } else if (perStroke.rows === perGroup.rows) {
    vacuous(
      "C4   `Groups` collapses fused ink into fewer rows",
      `this drawing's ink never fused. ${perGroup.rows} groups from ${perStroke.rows} strokes, so the row cannot be asked`,
    )
  } else {
    row(
      perGroup.rows < perStroke.rows && perGroup.bars.length === perStroke.bars.length,
      "C4   `Groups` collapses fused ink into fewer rows without losing a bar",
      `${perGroup.rows} rows of ${perStroke.rows} strokes, bars ${perGroup.bars.length} both ways`,
    )
  }

  /* ══════════════════════════════════════════════════════════════════════
   * §D · THE INK ON THE STRIP IS THE INK ON THE PAGE
   * ════════════════════════════════════════════════════════════════════ */
  console.log("\n§D · the window law. The row the first build would have failed")

  await setDrawIn({ order: "asDrawn", overlap: 0, unit: "group" })
  await setWindow({ mode: "grow" })

  const growProfile = []
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    await seek(p)
    growProfile.push((await strip()).inkTotal)
  }
  row(
    growProfile[0] < 1 &&
      growProfile.every((v, i) => i === 0 || v >= growProfile[i - 1] - 0.5) &&
      growProfile[4] > growProfile[0] + 10,
    "D1   under `Grow` the ink only ever increases, from nothing to the whole beat",
    `inked px at 0/.25/.5/.75/1 = ${growProfile.map((v) => v.toFixed(0)).join(" → ")}`,
  )
  await shot("D1-grow")

  await setWindow({ mode: "vanish" })
  const vanishProfile = []
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    await seek(p)
    vanishProfile.push((await strip()).inkTotal)
  }
  await shot("D2-vanish")
  paired(
    "D2   under `Vanish` the ink DECREASES. The strip empties with the mark",
    vanishProfile[4] < vanishProfile[0] - 10 &&
      vanishProfile.every((v, i) => i === 0 || v <= vanishProfile[i - 1] + 0.5),
    "a strip that just fills from the left: ink would rise under Vanish too",
    vanishProfile[4] > vanishProfile[0],
    `inked px at 0/.25/.5/.75/1 = ${vanishProfile.map((v) => v.toFixed(0)).join(" → ")}`,
  )

  await setWindow({ mode: "travel", length: 0.25 })
  await seek(0.5)
  const trav = await strip()
  await shot("D3-travel")
  {
    /* A travelling band has left the start behind. The leftmost ink must sit
     * clear of the band's left edge, which a prefix can never do. */
    const inked = trav.bars.filter((b) => b.inkWidth > 0)
    const leftMost = inked.length ? Math.min(...inked.map((b) => b.inkLeft)) : trav.band.left
    row(
      inked.length > 0 && leftMost > trav.band.left + 8,
      "D3   under `Travel` the lit band has left the start of the beat behind",
      `leftmost ink is ${(leftMost - trav.band.left).toFixed(0)} px in, over ${inked.length} inked bars`,
    )
  }
  await setWindow({ mode: "grow" })

  /* ══════════════════════════════════════════════════════════════════════
   * §E · IT COSTS WHAT A VIEW COSTS
   * ════════════════════════════════════════════════════════════════════ */
  console.log("\n§E · cost. Map §6.4's law, which this must not even engage")

  await seek(0)
  const layoutBefore = (await strip()).bars.map((b) => `${b.start.toFixed(6)}/${b.end.toFixed(6)}`).join(",")
  const fps = await page.evaluate(async () => {
    window.__revealHarness.setPlaying(true)
    let ticks = 0
    const t0 = performance.now()
    await new Promise((res) => {
      const step = () => {
        ticks++
        if (performance.now() - t0 < 3000) requestAnimationFrame(step)
        else res()
      }
      requestAnimationFrame(step)
    })
    window.__revealHarness.setPlaying(false)
    return (ticks / (performance.now() - t0)) * 1000
  })
  await page.waitForTimeout(300)
  const layoutAfter = (await strip()).bars.map((b) => `${b.start.toFixed(6)}/${b.end.toFixed(6)}`).join(",")
  row(
    layoutBefore === layoutAfter,
    "E1   three seconds of playback moved the ink and not one bar's layout",
    `${(await strip()).bars.length} bars, every declared interval identical before and after`,
  )
  row(fps >= 50, "E2   the beat still runs at frame rate with the strip live", `${fps.toFixed(1)} rAF ticks/s over 3 s, bar = 50`)

  /* Which strip this host rendered decides what §F asks. `take-timeline.tsx`'s
   * default export renders the editable strip wherever a host provides the
   * take (`/` does, through `StrokeTakeProvider`) and the read-only view
   * everywhere else. The ruling voided read-only ON `/` only, so the view keeps
   * its F1 and F2 word for word, and the strip is held to the ruled meaning. */
  const sF = await strip()
  if (sF.kind === "view") {
    /* ══════════════════════════════════════════════════════════════════════
     * §F · IT IS READ-ONLY. Pick 3's whole point
     * ════════════════════════════════════════════════════════════════════ */
    console.log("\n§F · read-only. Nothing here authors, and nothing here looks like it does")

    const affordances = await page.evaluate(() => {
      const root = document.querySelector("[data-take-timeline]")
      const bad = []
      for (const el of root.querySelectorAll("*")) {
        const tag = el.tagName.toLowerCase()
        if (["button", "input", "select", "textarea", "a"].includes(tag)) bad.push(`<${tag}>`)
        if (el.getAttribute("role") === "button") bad.push("role=button")
        if (el.draggable) bad.push("draggable")
        if (el.onclick || el.onpointerdown || el.onmousedown) bad.push("a pointer handler")
        const cur = getComputedStyle(el).cursor
        if (["grab", "grabbing", "pointer", "col-resize", "ew-resize", "move"].includes(cur))
          bad.push(`cursor:${cur}`)
      }
      return bad
    })
    row(affordances.length === 0, "F1   nothing under the strip is, or looks like, a control", affordances.length ? affordances.join(", ") : "no button, input, drag, pointer handler or grab cursor")

    const takeOf = () => page.evaluate(() => JSON.stringify(window.__revealHarness.drawIn()))
    const t0 = await takeOf()
    {
      const b = (await strip()).bars[2]
      await page.mouse.click(b.left + b.width / 2, (await page.evaluate(() => {
        const r = document.querySelector("[data-take-bar='2']").getBoundingClientRect()
        return r.top + r.height / 2
      })))
      await page.waitForTimeout(400)
    }
    const tAfterBar = await takeOf()
    /* THE POSITIVE CONTROL. "The take did not change" is also what a broken
     * reader says, so a real pill is clicked and the same reader must see it. */
    await page.locator("button", { hasText: /^Timing/ }).first().click()
    await page.waitForTimeout(200)
    await page.locator("button", { hasText: /^Reversed$/ }).click()
    await page.waitForTimeout(400)
    const tAfterPill = await takeOf()
    paired(
      "F2   clicking a bar changes nothing about the take",
      tAfterBar === t0,
      "the same reader after a real pill. It must be able to SEE a change",
      tAfterPill === t0,
      `take unchanged by the bar, changed by the pill`,
    )
    await shot("F2-readonly")
  } else {
    /* ════════════════════════════════════════════════════════════════════
     * §F · ON `/` THE STRIP IS A CONTROL. The ruling, not pick 3
     *
     * `docs/rulings/2026-09-25-animation-comes-back.md` voided "the strip is a
     * view" on `/`. So the view's F1 ("nothing is a control") and F2 ("a click
     * changes nothing") are asked here in their ruled meaning, each paired with
     * a control that must come back false:
     *   F1  every bar IS a control. Control: the same probe on the axis ticks.
     *   F2  a click SELECTS and writes nothing. Control: the same reader after
     *       the F3 drag, which did write, must see the change.
     *   F3  a drag on a bar WRITES the take. Control: the same drag over the
     *       strip's title, where nothing listens, must write nothing.
     * The take reader is `__fsTake.get().take` AND the draw-in. The view's
     * reader read the draw-in only, so on `/` it could not see a write to the
     * take at all, and its F2 passed there for that reason (measured
     * 2026-09-25, ANIM-1B3). End drags, ripple and undo are
     * `assert-stroke-strip.mjs`'s rows, not repeated here.
     * ══════════════════════════════════════════════════════════════════ */
    console.log("\n§F · on `/` the strip is a control. A click selects, a drag writes")

    const probe = await page.evaluate(() => {
      const root = document.querySelector("[data-stroke-strip]")
      const band = root.querySelector("[role=listbox]")
      const HOLD = ["grab", "grabbing", "ew-resize", "col-resize", "move"]
      /* A control: an option in a focusable listbox, reached by the pointer at
       * its own centre, with a cursor that says a drag lives there and two
       * ends that say resize. */
      const isControl = (el) => {
        const r = el.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        const cs = getComputedStyle(el)
        const ends = [...el.querySelectorAll("*")].filter((c) => getComputedStyle(c).cursor === "ew-resize").length
        return (
          el.getAttribute("role") === "option" &&
          el.closest("[role=listbox]") === band &&
          band.tabIndex >= 0 &&
          cs.pointerEvents !== "none" &&
          HOLD.includes(cs.cursor) &&
          ends >= 2 &&
          !!hit &&
          el.contains(hit)
        )
      }
      const bars = [...root.querySelectorAll("[data-take-bar]")]
      const ticks = [...root.querySelectorAll("[data-take-tick]")]
      return {
        bars: bars.length,
        barControls: bars.filter(isControl).length,
        ticks: ticks.length,
        tickControls: ticks.filter(isControl).length,
      }
    })
    paired(
      "F1   the strip IS a control: every bar is an option you can grab, with two ends to resize",
      probe.bars === sF.bars.length && probe.bars > 0 && probe.barControls === probe.bars,
      "the same probe on the axis ticks, which are drawn and not held",
      probe.ticks === 0 || probe.tickControls > 0,
      `${probe.barControls} of ${probe.bars} bars are controls, ${probe.tickControls} of ${probe.ticks} ticks`,
    )

    const takeOf = () =>
      page.evaluate(() =>
        window.__fsTake && window.__revealHarness
          ? JSON.stringify({ take: window.__fsTake.get().take, drawIn: window.__revealHarness.drawIn() })
          : null,
      )
    const T = 2
    const barT = async () => (await strip()).bars.find((b) => b.stroke === T)
    const DX = 80
    const drag = async (x, y) => {
      await page.mouse.move(x, y)
      await page.mouse.down()
      for (let i = 1; i <= 10; i++) {
        await page.mouse.move(x + (DX * i) / 10, y)
        await page.waitForTimeout(16)
      }
      await page.mouse.up()
      await page.waitForTimeout(400)
    }

    const t0 = await takeOf()
    const selBefore = sF.bars.filter((b) => b.selected === "1").map((b) => b.stroke)
    {
      const b = await barT()
      await page.mouse.click(b.left + b.width / 2, b.top + b.height / 2)
      await page.waitForTimeout(400)
    }
    const tClick = await takeOf()
    const selAfter = (await strip()).bars.filter((b) => b.selected === "1").map((b) => b.stroke)
    await shot("F2-click-selects")

    const title = await page.evaluate(() => {
      const el = [...document.querySelectorAll("[data-stroke-strip] span")].find((s) => s.textContent === "When each stroke draws")
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.left + 4, y: r.top + r.height / 2 }
    })
    const tBeforeTitle = await takeOf()
    if (title) await drag(title.x, title.y)
    const tTitle = await takeOf()

    const axisMs = await page.evaluate(() => Number(document.querySelector("[data-stroke-strip]").getAttribute("data-axis-ms")))
    const bandW = (await strip()).band.width
    const wantMs = (DX / bandW) * axisMs
    const bBefore = await barT()
    await drag(bBefore.left + bBefore.width / 2, bBefore.top + bBefore.height / 2)
    const tDrag = await takeOf()
    const bAfter = await barT()
    const rowT = await page.evaluate((i) => (window.__fsTake ? window.__fsTake.get().take.strokes[i] ?? null : null), T)
    await shot("F3-drag-writes")

    paired(
      "F2   a click on a bar selects it and writes nothing: the take is unchanged",
      t0 !== null && tClick === t0 && !selBefore.includes(T) && selAfter.length === 1 && selAfter[0] === T,
      "the same reader after the F3 drag, which wrote. It must be able to SEE a change",
      tDrag === t0,
      `selected ${JSON.stringify(selBefore)} → ${JSON.stringify(selAfter)}, take ${tClick === t0 ? "unchanged" : "CHANGED"} by the click, ${tDrag === t0 ? "UNCHANGED" : "changed"} by the drag`,
    )
    const movedMs = bAfter.t0 - bBefore.t0
    paired(
      "F3   a drag on a bar writes the take: its delay grows by the time under the pointer",
      tDrag !== null && tDrag !== tTitle && !!rowT && rowT.delayMs >= 0.5 * wantMs && movedMs >= 0.5 * wantMs,
      "the same drag over the strip's title, where nothing listens",
      title === null || tTitle !== tBeforeTitle,
      `${DX} px ≈ ${wantMs.toFixed(0)} ms under the pointer; stroke ${T} delayMs ${rowT ? rowT.delayMs : "no row"}, t0 moved ${movedMs.toFixed(0)} ms; title drag ${title === null ? "NOT ASKED, no title found" : tTitle === tBeforeTitle ? "wrote nothing" : "WROTE"}`,
    )
  }

  /* ══════════════════════════════════════════════════════════════════════
   * §G · WHAT THIS RUN DID NOT CHECK
   * ════════════════════════════════════════════════════════════════════ */
  console.log("\n§G · not checked by this gate. A skipped check is not a passed check")
  const notChecked = [
    "the strip's WALL-CLOCK accuracy. Every row above compares the strip to the model's own ordering and to the renderer's own window. Nothing here films the mark and times a unit's arrival against the bar that predicted it, so `bar at 0.8s` is consistent, not corroborated.",
    "`Direction` (`Start → end` / `End → start` / `Alternating`). It cannot show: a reversed unit occupies the same slot, so the strip is silent by design and there is nothing to assert.",
    "`Delay`, `Loop` and the transport's `Reverse`. The strip draws the beat, not the lead-in or the repeat.",
    "the >48-unit path, where the band scrolls and takes a tab stop. Five strokes is what this run drew.",
    "any engine but the one `/` opens on. The strip reads the schedule, not the geometry, so it should be engine-blind, and that is an argument rather than a measurement.",
  ]
  if (sF.kind === "strip") {
    notChecked.push(
      "the read-only view's F1 and F2. This host rendered the editable strip, and no host renders the view today: `/` provides the take through `StrokeTakeProvider`, and `/desk-doodles` is chromeless, so it mounts no strip at all. The rows are kept and run on any host without a take.",
      "the strip's end drags, Ripple, keyboard nudges and undo. `assert-stroke-strip.mjs` owns those rows.",
    )
  } else {
    notChecked.push("the editable strip's F1 to F3. This host rendered the read-only view, so the ruled rows for `/` could not be asked here.")
  }
  for (const n of notChecked) console.log(`  · ${n}`)
  for (const s of skipped) console.log(`  · VACUOUS ROW · ${s}`)

  if (pageErrors.length) {
    row(false, "G1   the page threw nothing while the strip was driven", pageErrors.slice(0, 3).join(" | "))
  } else {
    row(true, "G1   the page threw nothing while the strip was driven", "0 pageerror events over the whole run")
  }

  console.log(`\n${pass} PASS · ${fail} FAIL · ${skipped.length} VACUOUS`)
  if (fail > 0 && serverAge && (serverAge.hours === null || serverAge.hours > 1)) {
    console.log(
      `\n⚠ READ THIS BEFORE BLAMING THE CODE. The server on :${PORT} (pid ${serverAge.pid}) has been\n` +
        `  up ${serverAge.etime}. On 2026-09-04 an instance up 9 d 3 h had a dead file watcher and\n` +
        `  served a build that no longer existed on disk, and this gate went red for an hour on it.\n` +
        `  Restart it and re-run before you write the red down. DISPATCH.md §3.`,
    )
  }
  console.log(`evidence: ${OUT}`)
} finally {
  await browser.close()
  /* Only the pngs this run wrote. The folder also holds committed run logs
   * (ANIM-1B3), and removing the whole folder deleted tracked files. */
  if (!KEEP) for (const f of written) rmSync(f, { force: true })
}

process.exit(fail > 0 ? 1 : 0)

// undock.mjs: float the take dock over the canvas, as main does, for a gate
// that compares drawing frames or pixel masks against bases recorded on main.
// ANIM-3H, F118. Checks added by HARDEN-A2.
//
// The ruled dock (ANIM-3C) puts the take panel in flow under the canvas, so at
// 1512x982 the live canvas is 755x533 where main's is 755x890. A frame or a
// mask compared against a base recorded at 890 then differs on the size alone.
// This stylesheet drops the host's 64 px pad and takes the panel out of flow,
// 12 px in and 64 px up as main's floating card sat, so the canvas fills the
// pane at 755x890. Test-only; the product is untouched.
//
// CALL IT RIGHT AFTER `goto`, before any stroke lands. The canvas keeps its
// size history (ANIM-3G: a canvas that mounts at one size and shrinks draws
// differently from one mounted at the final size), so the style has to be in
// place before the viewport mounts.
//
// KEYED ON `[data-take-dock]`, the dock host in `components/viewport-3d.tsx`,
// present only while the panel docks. The panel is the host's child marked
// `[data-animation-panel]`, or the host's child holding the take strip,
// `[data-take-timeline]`; either one floats. No Tailwind class is read.
//
// WHAT IT PROVES, AND WHEN. HARDEN-A2 read on :3139 that the panel mounted
// only once strokes landed. PANEL changed that: the panel now renders whenever
// the host docks (`(docked || strokeCount > 0) && !chromeless`), with no take
// strip in it until strokes land. The empty panel sat in flow and took 85 px
// of the host (canvas 755x805) until PANEL-3 keyed the float on
// `[data-animation-panel]` too. undock checks in two steps:
//   1. Before returning: the host matched, its computed padding-bottom is 0
//      (the stylesheet landed); if the host holds a `[data-animation-panel]`
//      child, the panel selector matched it and its computed position is
//      absolute or fixed; and the host's canvas fills the host's content box
//      within 1 px, and is 755x890 within 1 px when the window is 1512x982.
//      It waits for the canvas to size, up to `timeout`. Any miss throws.
//   2. When the take strip first mounts: `[data-take-dock] > :has([data-take-
//      timeline])` matched, its computed position is absolute or fixed, and the
//      canvas still passes step 1's size check. A miss closes the page with the
//      reason, so the caller's next page call throws with the message, and sets
//      process.exitCode = 1. On a pass it logs "[undock] panel floated".
// LIMIT: step 2 runs only if a take strip mounts on this page. On a page with
// no strokes the panel is checked only by step 1, and only if it carries
// `[data-animation-panel]`. `[undock] panel floated` missing from a run's
// output means the strip never mounted.
// Other viewports: at 1440x900 (stroke-timing-browser) main's size is not
// recorded here, so only the fill check applies there.
//
// IT REFUSES. If no `[data-take-dock]` appears, it throws, so a renamed marker
// cannot quietly leave the gate comparing at the docked size. It throws on
// main too, which has no dock: a base run must not call it.
//
// MUST-FAIL ARMS: UNDOCK_MUTATE=selector points the panel selector at nothing,
// UNDOCK_MUTATE=css neuters the stylesheet. Each must throw by name. Any other
// value is refused.

const ARMS = ["selector", "css"]
const MUTATE = process.env.UNDOCK_MUTATE ?? ""
if (MUTATE && !ARMS.includes(MUTATE)) throw new Error(`UNDOCK_MUTATE=${MUTATE} is not an arm. Use one of: ${ARMS.join(", ")}.`)
if (MUTATE) console.log(`[undock] MUST-FAIL ARM UNDOCK_MUTATE=${MUTATE} is on. This run has to throw.`)

export const HOST = "[data-take-dock]"
// The marker step 1 reads to know a panel is there, whatever PANEL says.
const MARK = "[data-animation-panel]"
export const PANEL = MUTATE === "selector" ? `${HOST}>:has([data-undock-mutant-matches-nothing])` : `${HOST}>:is(${MARK},:has([data-take-timeline]))`
export const STRIP = "[data-take-timeline]"
const MAIN = { win: [1512, 982], canvas: [755, 890] }

export const UNDOCK_CSS =
  MUTATE === "css"
    ? "/* UNDOCK_MUTATE=css: the stylesheet is neutered */"
    : `${HOST}{padding-bottom:0!important}` +
      `${PANEL}{position:absolute!important;left:12px;right:12px;bottom:64px;margin:0!important}`

// In the page: the host's padding, content box, first canvas, the window, and
// the panel: whether the host holds a marked child, and what PANEL matched.
const measure = ([host, panel, mark]) => {
  const h = document.querySelector(host)
  if (!h) return null
  const cs = getComputedStyle(h)
  const p = document.querySelector(panel)
  const c = h.querySelector("canvas")
  const r = c?.getBoundingClientRect()
  return {
    padB: cs.paddingBottom,
    content: [h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), h.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)],
    canvas: r ? [r.width, r.height] : null,
    win: [innerWidth, innerHeight],
    marked: !!h.querySelector(`:scope>${mark}`),
    panelPos: p ? getComputedStyle(p).position : null,
  }
}
const ARGS = [HOST, PANEL, MARK]

// `!(x <= 1)` so a NaN size fails instead of passing.
const off = (a, b) => !(Math.abs(a - b) <= 1)
const px = ([w, h]) => `${Math.round(w * 10) / 10}x${Math.round(h * 10) / 10}`
const sizeMiss = (m) => {
  if (!m) return `no ${HOST} on the page`
  if (!m.canvas) return `no canvas inside ${HOST}`
  if (off(m.canvas[0], m.content[0]) || off(m.canvas[1], m.content[1])) return `canvas ${px(m.canvas)} does not fill the dock host's content box ${px(m.content)} within 1 px`
  if (m.win[0] === MAIN.win[0] && m.win[1] === MAIN.win[1] && (off(m.canvas[0], MAIN.canvas[0]) || off(m.canvas[1], MAIN.canvas[1])))
    return `canvas ${px(m.canvas)} is not main's ${px(MAIN.canvas)} within 1 px at ${MAIN.win.join("x")}`
  return null
}

const bound = new WeakSet()

export const undock = async (page, { timeout = 240000 } = {}) => {
  await page.addStyleTag({ content: UNDOCK_CSS })
  try {
    await page.waitForSelector(HOST, { state: "attached", timeout })
  } catch (e) {
    if (e?.name !== "TimeoutError") throw e
    throw new Error(
      `undock: no ${HOST} on the page after ${timeout} ms. The dock host in components/viewport-3d.tsx lost its marker, so this page would compare at the docked size.`,
    )
  }
  // Step 1a: the stylesheet landed on the host.
  const first = await page.evaluate(measure, ARGS)
  if (first?.padB !== "0px")
    throw new Error(`undock: the stylesheet did not land. ${HOST} has computed padding-bottom ${first?.padB}, not 0px, so the canvas would sit at the docked size.`)
  // Step 1b: a panel that is already there floats.
  if (first.marked && !first.panelPos)
    throw new Error(`undock: the panel selector ${PANEL} matched nothing, though ${HOST} holds a ${MARK} child, so the panel sits in flow under the canvas.`)
  if (first.panelPos && first.panelPos !== "absolute" && first.panelPos !== "fixed")
    throw new Error(`undock: the panel has computed position ${first.panelPos}, so it sits in flow under the canvas.`)
  // Step 1c: the canvas sizes to the host, and to main's size at 1512x982.
  const t0 = Date.now()
  let m = first
  while (sizeMiss(m) && Date.now() - t0 < timeout) {
    await page.waitForTimeout(100)
    m = await page.evaluate(measure, ARGS)
  }
  const miss = sizeMiss(m)
  if (miss) throw new Error(`undock: ${miss}, still after ${Date.now() - t0} ms (host padding-bottom ${m?.padB}).`)
  console.log(
    `[undock] host floated: canvas ${px(m.canvas)} fills the host at ${m.win.join("x")}; ${first.panelPos ? `panel already mounted, position ${first.panelPos}` : "no panel yet"}; the panel is checked again when the take strip mounts`,
  )

  // Step 2: check the panel the moment it exists.
  if (bound.has(page)) throw new Error("undock: called twice on one page. Call it once, right after goto.")
  bound.add(page)
  await page.exposeBinding("__undockVerdict", async (_src, v) => {
    const why = []
    if (!v.matched) why.push(`the panel selector ${PANEL} matched nothing when the take strip mounted`)
    else if (v.position !== "absolute" && v.position !== "fixed") why.push(`the panel mounted with computed position ${v.position}, so it sits in flow under the canvas`)
    const s = sizeMiss(v.m)
    if (s) why.push(`${s} once the panel mounted`)
    if (!why.length) return console.log(`[undock] panel floated: position ${v.position}, canvas ${px(v.m.canvas)}`)
    const msg = `undock: ${why.join("; ")}. The page is closed so the gate cannot compare frames at the docked size.`
    console.error(msg)
    process.exitCode = 1
    if (!page.isClosed()) await page.close({ reason: msg })
  })
  await page.evaluate(
    ([args, panel, strip, measureSrc]) => {
      const measure = new Function(`return (${measureSrc})`)()
      const host = args
      const read = () =>
        setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => {
          const p = document.querySelector(panel)
          window.__undockVerdict({ matched: !!p, position: p ? getComputedStyle(p).position : null, m: measure(host) })
        })), 500)
      if (document.querySelector(strip)) return read()
      const mo = new MutationObserver(() => {
        if (!document.querySelector(strip)) return
        mo.disconnect()
        read()
      })
      mo.observe(document.body, { childList: true, subtree: true })
    },
    [ARGS, PANEL, STRIP, measure.toString()],
  )
}

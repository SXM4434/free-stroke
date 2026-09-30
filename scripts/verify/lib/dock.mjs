// THE DOCK, AS A GATE MEETS IT (L3, BUILD-PLAN.md §5 row L3). Replaces
// `lib/undock.mjs`, which is retired with the dock it floated.
//
// Until L3 the take dock sat in the 3D view's column, in flow under the canvas,
// and a gate that compared frames against a dockless main floated it over the
// canvas with a test-only stylesheet so the canvas came back to main's 755x890.
// Since L3 the dock is its own dockview group under both the Drawing and the
// 3D view, folded to its 36 px header on load. Two moves cover what gates need,
// and both are the page's own layout operations, driven through the dock
// harness (`components/dock-shell.tsx`, `__dockHarness.dock`), never a
// stylesheet:
//
//   hideDock(page)  the dock group hidden, as the rail's show/hide does from
//                   L4. The Drawing and the 3D view take the shell's height
//                   and the canvas is dockless main's own size, 755x890 at
//                   1512x982, checked here within 1 px as undock did. For
//                   pages that grab frames to compare with a dockless base.
//   openDock(page)  the dock open on its Timeline tab, so the strip, Perform
//                   and the keys are on screen and take real pointer events.
//                   Checked: the strip is visible and hit at its centre. For
//                   pages that drive the strip; call it after the strokes
//                   land, since the strip draws only once there is one.
//
// MUST-FAIL ARMS, one env var, `DOCK_MUTATE`:
//   nohide   hideDock skips the hide; its size check must throw
//   noopen   openDock skips the open; its visibility check must throw
//   FS_PORT=3139 DOCK_MUTATE=nohide node scripts/verify/lib/dock.mjs --self
// runs one page through each helper on its own, the way the arms are shown.

const ARMS = ["nohide", "noopen"]
const MUTATE = process.env.DOCK_MUTATE ?? ""
if (MUTATE && !ARMS.includes(MUTATE)) throw new Error(`DOCK_MUTATE=${MUTATE} is not an arm. Use one of: ${ARMS.join(", ")}.`)
if (MUTATE) console.log(`[dock] MUST-FAIL ARM DOCK_MUTATE=${MUTATE} is on. This run has to throw.`)

const MAIN = { win: [1512, 982], canvas: [755, 890] }
const off = (a, b) => !(Math.abs(a - b) <= 1)
const px = ([w, h]) => `${Math.round(w * 10) / 10}x${Math.round(h * 10) / 10}`

const measure = () => {
  const c = document.querySelector('[data-dock-panel="view3d"] canvas')
  const p = document.querySelector('[data-dock-panel="view3d"]')
  const r = c?.getBoundingClientRect(), q = p?.getBoundingClientRect()
  return { canvas: r ? [r.width, r.height] : null, panel: q ? [q.width, q.height] : null, win: [innerWidth, innerHeight] }
}
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

const harness = async (page, timeout) => {
  try {
    await page.waitForFunction(() => window.__dockHarness?.dock, null, { timeout })
  } catch (e) {
    if (e?.name !== "TimeoutError") throw e
    throw new Error(`dock: no __dockHarness.dock on the page after ${timeout} ms. The dock shell (components/dock-shell.tsx) did not mount, or this is a production build.`)
  }
}

export const hideDock = async (page, { timeout = 240000 } = {}) => {
  await harness(page, timeout)
  // L4 and later: the two canvases alone at today's split, the closest to a
  // dockless main the rail allows. It cannot reach main's 755x890 (the rail
  // takes 48 px, and the style bar's 44 px went back to the canvases), so on
  // a page with the rail the check is that the canvas fills its panel, and
  // its size is printed: a frame base recorded on a pre-L4 tree is at another
  // size, so the row that compares with it fails on its own and has to be
  // recorded again on this layout. Pages without the rail keep main's check.
  const railed = await page.evaluate(() => !!window.__dockHarness.workspace?.today)
  if (MUTATE !== "nohide")
    await page.evaluate(() => {
      const w = window.__dockHarness.workspace
      if (w?.today) w.today()
      else window.__dockHarness.dock.setHidden(true)
    })
  const t0 = Date.now()
  let m
  const miss = (m) => {
    if (!m.canvas) return "no canvas in the 3D view panel"
    if (off(m.canvas[0], m.panel[0]) || off(m.canvas[1], m.panel[1])) return `canvas ${px(m.canvas)} does not fill its panel ${px(m.panel)} within 1 px`
    if (!railed && m.win[0] === MAIN.win[0] && m.win[1] === MAIN.win[1] && (off(m.canvas[0], MAIN.canvas[0]) || off(m.canvas[1], MAIN.canvas[1])))
      return `canvas ${px(m.canvas)} is not main's ${px(MAIN.canvas)} within 1 px at ${MAIN.win.join("x")}`
    return null
  }
  do {
    await frame(page)
    m = await page.evaluate(measure)
    if (!miss(m)) break
    await page.waitForTimeout(100)
  } while (Date.now() - t0 < timeout)
  const why = miss(m)
  if (why) throw new Error(`hideDock: ${why}, still after ${Date.now() - t0} ms. The page would compare at the docked size.`)
  const hidden = await page.evaluate(() => window.__dockHarness.dock.hidden())
  if (!hidden) throw new Error("hideDock: the canvas fills its panel but the dock group still reports visible.")
  console.log(`[dock] hidden: canvas ${px(m.canvas)} fills the 3D view at ${m.win.join("x")}${railed ? " (the rail's layout: not main's 755x890, a pre-L4 frame base will not match)" : ""}`)
  return m
}

export const openDock = async (page, { tab = "timeline", timeout = 240000 } = {}) => {
  await harness(page, timeout)
  if (MUTATE !== "noopen") await page.evaluate((t) => window.__dockHarness.dock.open(t), tab)
  const t0 = Date.now()
  let v
  const read = () =>
    page.evaluate((t) => {
      const sel = t === "timeline" ? "[data-take-timeline]" : `[data-dock-panel="${t}"]`
      const el = document.querySelector(sel)
      if (!el || !el.checkVisibility({ visibilityProperty: true })) return { ok: false, why: `${sel} is not visible` }
      const r = el.getBoundingClientRect()
      if (r.height < 8) return { ok: false, why: `${sel} is ${Math.round(r.height)} px tall` }
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 12))
      if (!hit || !el.contains(hit)) return { ok: false, why: `${sel}'s centre is covered by ${hit?.tagName}` }
      return { ok: true, box: [r.width, r.height] }
    }, tab)
  do {
    await frame(page)
    v = await read()
    if (v.ok) break
    await page.waitForTimeout(100)
  } while (Date.now() - t0 < Math.min(timeout, 15000))
  if (!v.ok) throw new Error(`openDock: ${v.why} after ${Date.now() - t0} ms. The dock did not open on ${tab}.`)
  const m = await page.evaluate(measure)
  console.log(`[dock] open on ${tab}: canvas ${m.canvas ? px(m.canvas) : "none"}`)
  return m
}

/* THE STYLE PANEL, AS A GATE MEETS IT (L4). The style bar's pills and its
   Show panel are gone; the Style panel is one of the shell's panels, shown and
   hidden from the rail. `openStyle(page, family)` shows it the way the rail's
   Style button does (a no-op when it already shows) and, given a family,
   clicks that family in the panel's own list, then checks the panel says it
   is the open one (`aria-current`). `family` is the panel id or its label:
   material, animation, texture, dither, ascii, presets, layers, fusion.
   `closeStyle(page)` hides it again. Both throw with the reason on a miss. */
const FAMILY = { material: "Material", animation: "Animation", texture: "Texture", dither: "Dither", ascii: "ASCII", presets: "Presets", preset: "Presets", layers: "Layers", fusion: "Fusion" }

export const openStyle = async (page, family = null, { timeout = 60000 } = {}) => {
  await page.waitForFunction(() => window.__dockHarness?.workspace, null, { timeout })
  await page.evaluate(() => { const w = window.__dockHarness.workspace; if (!w.shown().style) w.toggle("style") })
  await frame(page)
  if (!family) return
  const label = FAMILY[String(family).toLowerCase()] ?? family
  const id = Object.keys(FAMILY).find((k) => FAMILY[k] === label && k !== "preset") ?? String(family).toLowerCase()
  // Each family button carries `data-style-family` (its name over its value, L4).
  const find = ([id, label]) =>
    document.querySelector(`[data-dock-panel="style"] nav [data-style-family="${id}"]`)?.closest("button") ??
    [...document.querySelectorAll('[data-dock-panel="style"] nav button')].find((x) => x.textContent.trim() === label)
  const ok = await page.evaluate(([id, label, src]) => {
    const nav = document.querySelector('[data-dock-panel="style"] nav[aria-label="Style panel sections"]')
    if (!nav) return "no Style panel family list on the page"
    const b = new Function(`return (${src})`)()([id, label])
    if (!b) return `no family named ${label} in the Style panel`
    if (b.getAttribute("aria-current") !== "true") b.click()
    return true
  }, [id, label, find.toString()])
  if (ok !== true) throw new Error(`openStyle: ${ok}`)
  await frame(page)
  const current = await page.evaluate(([id, label, src]) => {
    const b = new Function(`return (${src})`)()([id, label])
    return b?.getAttribute("aria-current") === "true" && b.checkVisibility({ visibilityProperty: true })
  }, [id, label, find.toString()])
  if (!current) throw new Error(`openStyle: ${label} is not the open family, or the Style panel is not showing`)
}

export const closeStyle = async (page) => {
  await page.evaluate(() => { const w = window.__dockHarness.workspace; if (w.shown().style) w.toggle("style") })
  await frame(page)
}

/* Self test: one page through each helper, so each arm can be shown firing. */
if (process.argv[1]?.endsWith("dock.mjs") && process.argv.includes("--self")) {
  const { chromium } = await import("./browser.mjs")
  const { LAB_URL } = await import("./dev-server.mjs")
  const b = await chromium.launch()
  let code = 0
  const styleCheck = async (page) => {
    await openStyle(page, "presets")
    await closeStyle(page)
    // must-fail, always run: a family the panel does not have has to throw.
    let threw = false
    try { await openStyle(page, "nosuchfamily") } catch { threw = true }
    if (!threw) throw new Error("openStyle did not throw on a family the panel does not have")
    console.log("[dock] openStyle: presets opened and closed; FIRED on a missing family")
  }
  const steps = [["openDock", openDock], ["hideDock", hideDock]]
  steps.push(["openStyle", styleCheck])
  for (const [name, fn] of steps) {
    const ctx = await b.newContext({ viewport: { width: 1512, height: 982 } })
    const page = await ctx.newPage()
    await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
    // The strip draws once there is a stroke; a gate opens the dock after its strokes land.
    await page.waitForFunction(() => window.__styleHarness, null, { timeout: 240000 })
    await page.evaluate(() => window.__styleHarness.injectStrokes([[{ x: 200, y: 300 }, { x: 400, y: 380 }, { x: 520, y: 300 }]], { msPerPoint: 12, gapMs: 60 }))
    await page.waitForTimeout(800)
    try {
      await fn(page, { timeout: 20000 })
      console.log(`PASS  ${name}`)
    } catch (e) {
      console.log(`THREW ${name}: ${e.message}`)
      code = 1
    }
    await ctx.close()
  }
  await b.close()
  process.exit(code)
}

// _probe-layout-fromjson.mjs · WHAT DOCKVIEW DOES WITH A SAVE layoutProblem LETS THROUGH
//
//   node scripts/verify/_probe-layout-fromjson.mjs
//
// A probe, not a gate: it backs the LOADABLE row of assert-workspace-layouts.mjs with
// dockview-core 8.3.1's own `fromJSON`, run in a headless Chromium on a blank page (no
// dev server, no app). Each case is the shell's default Animate layout with one thing
// wrong; for each it prints what `layoutProblem` says and what dockview did: loaded
// the six panels, loaded something else, or threw (and what was left on screen after
// the throw). The shell always loads with `reuseExistingPanels: true`
// (components/dock-shell.tsx `loadLayout`): on its mount into an empty dockview,
// and on a workspace switch over the six live panels. The probe runs both.
//
// The content renderer here is a bare div for every component name. dockview-react
// renders `components[contentComponent]` instead, so a name it lacks is undefined
// there; that half is read from its code (dockview-react.js, createComponent), not run.
import { readFileSync, realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { ROOT, loadTs } from "./_ts-load.mjs"

// Playwright's own Chromium, not lib/browser.mjs's pinned Chrome: nothing here draws
// with the GPU, and the cloud container has no Chrome. Headless always.
const { chromium } = await import("playwright-core")
const W = loadTs("components/workspace/workspaces.ts")

const leavesOf = (n, out = []) => {
  if (n && n.type === "leaf") out.push(n)
  else if (n && n.type === "branch" && Array.isArray(n.data)) for (const c of n.data) leavesOf(c, out)
  return out
}
const base = () => JSON.parse(JSON.stringify(W.defaultLayout("animate", 1464, 942, true)))
const cases = [["control: the default, unchanged", base()]]
const add = (what, edit) => {
  const l = base()
  edit(l)
  cases.push([what, l])
}
add("the drawing entry names panel id ghost", (l) => (l.panels.drawing.id = "ghost"))
add("the 3D view entry names component ghost", (l) => (l.panels.view3d.contentComponent = "ghost"))
add("the style entry is null", (l) => (l.panels.style = null))
add("a group id is a number", (l) => (leavesOf(l.grid.root)[0].data.id = 7))
add("two groups share an id", (l) => {
  const ls = leavesOf(l.grid.root)
  ls[1].data.id = ls[0].data.id
})
add("the root is a leaf holding all six", (l) => {
  const all = leavesOf(l.grid.root).flatMap((g) => g.data.views)
  l.grid.root = { type: "leaf", data: { views: all, activeView: all[0], id: "g-all" }, size: 942 }
})
add("an unknown view ghost in the grid only, beside the 3D view", (l) => leavesOf(l.grid.root)[1].data.views.push("ghost"))

// dockview-core is not hoisted under pnpm: resolve it the way dockview-react does.
const fromReact = createRequire(join(realpathSync(join(ROOT, "node_modules/dockview-react")), "package.json"))
const core = readFileSync(fromReact.resolve("dockview-core/dist/dockview-core.js"), "utf8")
const browser = await chromium.launch({ headless: true, executablePath: process.env.FS_CHROMIUM || "/opt/pw-browsers/chromium" })
try {
  const page = await browser.newPage({ viewport: { width: 1464, height: 942 } })
  await page.setContent(`<!doctype html><html><body style="margin:0"><div id="box" style="position:absolute;inset:0"></div></body></html>`)
  await page.addScriptTag({ content: core })
  for (const [what, layout] of cases) {
    const problem = W.layoutProblem(layout)
    console.log(`${what}\n    layoutProblem: ${problem === null ? "passes it" : `refuses it: ${problem}`}`)
    // FIRST LOAD is the shell's mount (an empty dockview, nothing to reuse);
    // SWITCH is a workspace switch over the six live panels.
    for (const mode of ["first load", "switch"]) {
    const r = await page.evaluate(
      ({ def, layout, mode }) => {
        const D = window["dockview-core"]
        const box = document.getElementById("box")
        box.innerHTML = ""
        const el = document.createElement("div")
        el.style.cssText = "position:absolute;inset:0"
        box.appendChild(el)
        const part = () => {
          const element = document.createElement("div")
          return { element, init() {}, dispose() {} }
        }
        const dv = new D.DockviewComponent(el, { createComponent: part, createTabComponent: part, disableDnd: true, locked: true })
        dv.layout(1464, 942)
        if (mode === "switch") dv.fromJSON(def, { reuseExistingPanels: true })
        let threw = null
        try {
          dv.fromJSON(layout, { reuseExistingPanels: true })
        } catch (e) {
          threw = String(e && e.message)
        }
        const out = { threw, panels: dv.panels.map((p) => p.id).sort(), groups: dv.groups.length, empty: dv.groups.filter((g) => g.panels.length === 0).length }
        dv.dispose()
        return out
      },
      { def: base(), layout, mode },
    )
    const six = JSON.stringify(r.panels) === JSON.stringify([...W.PANEL_IDS].sort())
    const verdict = r.threw ? `THREW "${r.threw}", left ${r.panels.length} panels in ${r.groups} groups` : six ? `loaded the six (${r.groups} groups, ${r.empty} empty)` : `loaded ${r.panels.join(", ") || "nothing"} (${r.groups} groups, ${r.empty} empty), NOT the six`
    console.log(`    dockview, ${mode}: ${verdict}`)
    }
  }
} finally {
  await browser.close()
}

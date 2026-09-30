"use client"

/* ==================================================================
   DOCK SHELL · L1 of the layout rethink (docs/research-2026-09-26/
   layout-rethink/BUILD-PLAN.md §1 and §5).

   Today's two columns, Drawing and 3D view, hosted as two dockview panels.
   Nothing moves for him yet: no headers, no drag to dock, no sash, the same
   1 px rule between the two, the same stack below `lg`. What L1 buys is the
   proof that the 3D view survives the operations every later phase is built
   on, before any of them exists:

     · a panel move to another group and back,
     · maximize and restore,
     · `fromJSON(layout, { reuseExistingPanels: true })`, the workspace switch.

   THE THREE SETTINGS THAT KEEP THE GL CONTEXT ALIVE, and each one is load-
   bearing (scripts/verify/assert-dock-shell.mjs proves it, with arms):

     1. `defaultRenderer: "always"`. The panel's DOM lives in one overlay
        layer and is repositioned over its group, never re-parented.
     2. Every layout load goes through `reuseExistingPanels: true`. With
        `false`, dockview removes the panel and adds a new one, React unmounts
        the viewport and a new canvas with a new context replaces it.
     3. The panels read today's components LIVE, through context, never from
        the `params` they were created with. A panel that renders what it was
        handed at creation keeps drawing the page as it was on that frame.

   MUST-FAIL ARMS, read once at mount from `window.__fsDockMutant`, which the
   gate sets before navigation and nothing else ever sets:
     "header"          group headers stay visible (the 28 px strip IDENTICAL
                       must catch)
     "onlyWhenVisible" renderer 1 above swapped
     "noReuse"         the harness's layout loads drop setting 2
     "stale"           panels render the slots captured at mount (setting 3)
   ================================================================== */

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react"
import { DockviewReact, type DockviewApi, type DockviewReadyEvent, type IDockviewPanelProps, type SerializedDockview } from "dockview-react"
import "dockview-react/dist/styles/dockview.css"

type Slots = { drawing: ReactNode; view: ReactNode }
type Mutant = "header" | "onlyWhenVisible" | "noReuse" | "stale" | null

const SlotContext = createContext<Slots>({ drawing: null, view: null })

const readMutant = (): Mutant => {
  if (typeof window === "undefined") return null
  const m = (window as unknown as { __fsDockMutant?: string }).__fsDockMutant
  return m === "header" || m === "onlyWhenVisible" || m === "noReuse" || m === "stale" ? m : null
}

/* Same classes as the two columns they replace. The border stays on the
   drawing side and follows the axis at `lg`, exactly as before; dockview's
   own separator is switched off (`hideBorders`) so the rule is drawn once.

   EACH PANEL IS TODAY'S FLEX ROW AROUND TODAY'S COLUMN, and that is load-
   bearing below `lg`. There the two columns were flex items in a column, and
   a flex item keeps `min-height: auto`: it never gets shorter than its
   content. With a drawing on the page at 834x1112 the 3D column's content is
   574.47 px (the canvas at its current height, the 280.75 px settings card,
   `mt-3` and `pb-16`), more than its 509.5 px half, so the column grew past
   the stack and `overflow-hidden` cut its bottom 65 px off below the window.
   A dockview group has no such minimum; it is exactly its share, so the card
   was squeezed to 244.75 and the canvas to 188.25 against 217.72
   (assert-dock-shell BUFFERS, 834x1112). `min-height: min-content` on the
   panel did not reproduce it: the content's `h-full` resolved against the
   panel's own height, so the minimum came out 509. Wrapping the column in the
   same `flex flex-col lg:flex-row` it sat in gives it the same automatic
   minimum, computed by the same rule; it runs past its group the way it ran
   past the stack, and the shell's `overflow-hidden` cuts it where the window
   did. At `lg` the wrapper is a row, the minimum moves to the width, and
   `min-w-0` switches it off there exactly as it did before. */
const ROW = "flex h-full w-full flex-col lg:flex-row"

/* Below `lg` the two vars below carry the half pixel dockview cannot (see
   holdTodaysSplit). Unset at `lg`, where the fallbacks are plain `h-full`
   and no shift. */
const DRAWING_H = { height: "var(--fs-dock-dh, 100%)" } as React.CSSProperties
const VIEW_SHIFT = { marginTop: "var(--fs-dock-shift, 0px)" } as React.CSSProperties

function DrawingPanel(_: IDockviewPanelProps) {
  const { drawing } = useContext(SlotContext)
  return (
    <div className={ROW} style={DRAWING_H}>
      <div data-dock-panel="drawing" className="relative min-w-0 flex-1 border-b border-border lg:border-b-0 lg:border-r">
        {drawing}
      </div>
    </div>
  )
}

function ViewPanel(_: IDockviewPanelProps) {
  const { view } = useContext(SlotContext)
  return (
    <div className={ROW} style={VIEW_SHIFT}>
      <div data-dock-panel="view3d" className="min-w-0 flex-1">
        {view}
      </div>
    </div>
  )
}

const COMPONENTS = { drawing: DrawingPanel, view3d: ViewPanel }

/* A theme that sets nothing: every dockview colour var is inherited from the
   wrapper below as transparent, so the groups paint no ground of their own. */
const THEME = { name: "free-stroke", className: "fs-dock-theme" }
const QUIET = {
  "--dv-group-view-background-color": "transparent",
  "--dv-separator-border": "transparent",
  "--dv-paneview-active-outline-color": "transparent",
  "--dv-tabs-and-actions-container-background-color": "transparent",
} as React.CSSProperties

const LG = "(min-width: 1024px)"

/* TODAY'S SPLIT IS NOT HALF, AND L1 KEEPS IT. The columns were `flex-1`
   each with a 1 px border on the drawing side. Flex shares out what is left
   after that border, so the drawing column is (W + 1) / 2 and the 3D column
   (W - 1) / 2: 756.5 and 755.5 at 1512, a rule on a half pixel. Dockview
   splits evenly and in whole pixels, 756 / 756, which resampled both canvases
   and made the 3D buffer 756 wide: 33,824 px differed at 1512x982 in
   assert-dock-shell's first run. Lending dockview one extra pixel did not
   help, it still rounds to whole pixels (46,405 px).

   So the drawing group is set to (W + 1) / 2 with `setSize`, which takes a
   fractional size, after dockview has laid itself out: one frame after a
   resize, a panel move, a restore from maximize or a layout load. Nothing
   here listens to layout changes, so setting the size cannot re-trigger it.
   Below `lg` the same on the height, floored, and the half pixel carried by
   two CSS vars (see the branch). */
function holdTodaysSplit(api: DockviewApi, box: HTMLElement) {
  const d = api.getPanel("drawing"), v = api.getPanel("view3d")
  if (api.hasMaximizedGroup() || !d || !v || d.group === v.group || window.matchMedia(LG).matches) {
    box.style.removeProperty("--fs-dock-dh")
    box.style.removeProperty("--fs-dock-shift")
  }
  if (api.hasMaximizedGroup() || !d || !v || d.group === v.group) return
  const r = box.getBoundingClientRect(), g = d.group.element.getBoundingClientRect()
  if (window.matchMedia(LG).matches) {
    const t = (r.width + 1) / 2
    if (Math.abs(g.width - t) > 0.01) d.group.api.setSize({ width: t })
  } else {
    // Stacked, the size goes through dockview's Splitview.resizeView, which
    // rounds (`size = Math.round(size)`): 510.5 at 834x1112 landed on 511 and
    // gave the drawing a 510 buffer against main's 509. So the group is
    // floored to 510, and the half pixel it cannot hold is put back inside
    // the panels: the drawing's row is set to today's exact (H + 1) / 2,
    // 510.5, and the 3D row is pushed down by what the group lost, 0.5, so
    // its top lands on main's 602.5. Measured (L1-3): every column and
    // canvas box at 834x1112 now equals main's. The 3D frame hash did NOT
    // move with it (af0c4bdd before and after), so the half pixel was not
    // what made that frame differ.
    const exact = (r.height + 1) / 2
    const t = Math.floor(exact)
    if (Math.abs(g.height - t) > 0.01) d.group.api.setSize({ height: t })
    const held = v.group.element.getBoundingClientRect().top - r.top
    box.style.setProperty("--fs-dock-dh", `${exact}px`)
    box.style.setProperty("--fs-dock-shift", `${exact - held}px`)
  }
}

export type DockHarness = {
  api: DockviewApi
  mutant: Mutant
  load: (layout: SerializedDockview) => void
}

export function DockShell({ drawing, view }: Slots) {
  const mutantRef = useRef<Mutant>(null)
  const apiRef = useRef<DockviewApi | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const hold = useCallback(() => requestAnimationFrame(() => {
    if (apiRef.current && boxRef.current) holdTodaysSplit(apiRef.current, boxRef.current)
  }), [])
  const frozen = useRef<Slots | null>(null)
  if (frozen.current === null) frozen.current = { drawing, view }
  const slots = mutantRef.current === "stale" ? frozen.current : { drawing, view }

  const hideHeaders = useCallback((api: DockviewApi) => {
    if (mutantRef.current === "header") return
    for (const g of api.groups) g.model.header.hidden = true
  }, [])

  const onReady = useCallback((e: DockviewReadyEvent) => {
    const api = e.api
    const mutant = readMutant()
    mutantRef.current = mutant
    const wide = window.matchMedia(LG).matches
    const d = api.addPanel({ id: "drawing", component: "drawing", title: "Drawing" })
    api.addPanel({
      id: "view3d",
      component: "view3d",
      title: "3D view",
      position: { referencePanel: d, direction: wide ? "right" : "below" },
    })
    hideHeaders(api)
    // Groups come and go on a move, a maximize and a layout load; each new
    // one arrives with its header showing unless it is hidden here.
    api.onDidAddGroup((g) => { if (mutant !== "header") g.model.header.hidden = true })
    api.onDidLayoutFromJSON(() => hideHeaders(api))
    apiRef.current = api
    api.onDidMovePanel(hold)
    api.onDidMaximizedGroupChange(hold)
    api.onDidLayoutFromJSON(hold)
    hold()

    if (process.env.NODE_ENV !== "production") {
      const harness: DockHarness = {
        api,
        mutant,
        load: (layout) => api.fromJSON(layout, { reuseExistingPanels: mutant !== "noReuse" }),
      }
      ;(window as unknown as { __dockHarness?: DockHarness }).__dockHarness = harness
    }
  }, [hideHeaders, hold])

  // Below `lg` the two stack, as the flex column did: the 3D view moves under
  // the drawing. It is a panel move, the same one the gate proves.
  useEffect(() => {
    const mq = window.matchMedia(LG)
    const onChange = () => {
      const api = apiRef.current
      const d = api?.getPanel("drawing"), v = api?.getPanel("view3d")
      if (!d || !v) return
      v.api.moveTo({ group: d.group, position: mq.matches ? "right" : "bottom" })
    }
    mq.addEventListener("change", onChange)
    const ro = new ResizeObserver(hold)
    if (boxRef.current) ro.observe(boxRef.current)
    return () => { mq.removeEventListener("change", onChange); ro.disconnect() }
  }, [hold])

  return (
    <SlotContext.Provider value={slots}>
      <div ref={boxRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden" style={QUIET}>
        <DockviewReact
          className="absolute inset-0"
          components={COMPONENTS}
          onReady={onReady}
          theme={THEME}
          defaultRenderer={readMutant() === "onlyWhenVisible" ? "onlyWhenVisible" : "always"}
          hideBorders
          disableDnd
          disableFloatingGroups
          locked
        />
      </div>
    </SlotContext.Provider>
  )
}

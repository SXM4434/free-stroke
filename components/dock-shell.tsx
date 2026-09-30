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

   L3 ADDS THE DOCK UNDER BOTH (BUILD-PLAN.md §5, row L3). One group under
   the Drawing and the 3D view holds three panels as tabs: Timeline (the
   strip, Perform, the keys, the timing note), Draw-in and Export. The
   transport is that group's header row, before the tabs, so Play shows
   while the dock is collapsed to its header. The panels hold empty hosts
   (`components/workspace/dock-hosts.tsx`); the viewport portals its
   controls into them and keeps the state they drive. The Drawing and 3D
   view groups keep their headers hidden; only the dock shows one.

   The dock opens collapsed, its header only, which is the Draw arrangement
   of §3: the Drawing and the 3D view get the height. Any tab click opens it
   (to the height it last had open), the chevron at the header's right end
   folds and opens it, and a drag on the edge between them sizes it.

   MUST-FAIL ARMS, read once at mount from `window.__fsDockMutant`, which the
   gate sets before navigation and nothing else ever sets:
     "header"          group headers stay visible (the 28 px strip IDENTICAL
                       must catch)
     "onlyWhenVisible" renderer 1 above swapped
     "noReuse"         the harness's layout loads drop setting 2
     "stale"           panels render the slots captured at mount (setting 3)
     L3, read by scripts/verify/assert-dock-panels.mjs:
     "nodock"          the dock's three panels are never added (reach must
                       go red)
     "toast182"        the toast offset stays at the pre-L3 fixed 182 px
                       (a toast must land on a dock control)
     "nosync"          the store's `drawInOpen` no longer drives the tab (the
                       drawer's "Show in dock" must go red)
   ================================================================== */

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import {
  DockviewReact,
  type DockviewApi,
  type DockviewGroupPanel,
  type DockviewReadyEvent,
  type IDockviewHeaderActionsProps,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
  type SerializedDockview,
} from "dockview-react"
import "dockview-react/dist/styles/dockview.css"
import "./workspace/dock.css"
import { DockHostProvider, useDockHostRef, type DockHostName } from "@/components/workspace/dock-hosts"
import { useTakeTransport } from "@/lib/take-transport"

type Slots = { drawing: ReactNode; view: ReactNode }
type Mutant = "header" | "onlyWhenVisible" | "noReuse" | "stale" | "nodock" | "toast182" | "nosync" | null

const SlotContext = createContext<Slots>({ drawing: null, view: null })

const readMutant = (): Mutant => {
  if (typeof window === "undefined") return null
  const m = (window as unknown as { __fsDockMutant?: string }).__fsDockMutant
  return m === "header" || m === "onlyWhenVisible" || m === "noReuse" || m === "stale" || m === "nodock" || m === "toast182" || m === "nosync" ? m : null
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
const DRAWING_H = { height: "var(--fs-dock-dh, 100%)", width: "var(--fs-dock-dw, 100%)" } as React.CSSProperties
const VIEW_SHIFT = {
  marginTop: "var(--fs-dock-shift, 0px)",
  marginLeft: "var(--fs-dock-xshift, 0px)",
  width: "calc(100% - var(--fs-dock-xshift, 0px))",
} as React.CSSProperties

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

/* ---- THE DOCK (L3) ---------------------------------------------------- */

/** The dock's three panels, in tab order. Their ids are fixed (§3). */
export const DOCK_PANELS = ["timeline", "drawin", "export"] as const
type DockPanelId = (typeof DOCK_PANELS)[number]
const DOCK_TITLES: Record<DockPanelId, string> = { timeline: "Timeline", drawin: "Draw-in", export: "Export" }
/** The dock's header, and so its collapsed height: the transport's 28 px Play
 *  button with 4 px above and below. */
export const DOCK_HEADER_PX = 36
/** Open, the dock takes a third of the shell, and never less than this. */
const DOCK_OPEN_MIN_PX = 220
const isDockGroup = (g: DockviewGroupPanel | undefined) => !!g && g.panels.some((p) => (DOCK_PANELS as readonly string[]).includes(p.id))

function DockHost({ name, className }: { name: DockHostName; className: string }) {
  const ref = useDockHostRef(name)
  return <div ref={ref} data-dock-host={name} className={className} />
}

function TimelinePanel(_: IDockviewPanelProps) {
  return (
    <div data-dock-panel="timeline" className="h-full w-full">
      <DockHost name="timeline" className="h-full w-full" />
    </div>
  )
}
function DrawInPanel(_: IDockviewPanelProps) {
  return (
    <div data-dock-panel="drawin" className="h-full w-full">
      <DockHost name="drawin" className="h-full w-full" />
    </div>
  )
}
function ExportDockPanel(_: IDockviewPanelProps) {
  return (
    <div data-dock-panel="export" className="h-full w-full overflow-auto">
      <DockHost name="export" className="w-full" />
    </div>
  )
}

const COMPONENTS = { drawing: DrawingPanel, view3d: ViewPanel, timeline: TimelinePanel, drawin: DrawInPanel, export: ExportDockPanel }

/* What the dock's header needs from the shell: whether it is folded, and the
   two moves it makes. Provided by `DockShell`, read by the tabs and the
   header's actions, which dockview renders outside the shell's own tree. */
type DockControl = {
  collapsed: boolean
  /** Open the dock if it is folded, and show `id`. */
  show: (id: DockPanelId) => void
  toggleCollapsed: () => void
}
const DockControlContext = createContext<DockControl>({ collapsed: true, show: () => {}, toggleCollapsed: () => {} })

/* THE TABS. dockview's own tab activates on pointerdown; these take the
   pointerdown themselves and act on click, so a click on a folded dock opens
   it, and a synthetic `click()` (every gate that drove the old Draw-in button
   did it that way) does the same as a real one. Draw-in keeps the old
   button's contract: `data-animation-drawin`, `aria-expanded` for whether its
   controls show, a click that shows them or, shown, goes back to the
   Timeline, and the summary of what is set beside its name. */
function DockTab({ api }: IDockviewPanelHeaderProps) {
  const { collapsed, show } = useContext(DockControlContext)
  const id = api.id as DockPanelId
  const store = useTakeTransport()
  // `api.isActive` is not React state; the tab re-renders when it changes.
  const [isActive, setIsActive] = useState(api.isActive)
  useEffect(() => {
    setIsActive(api.isActive)
    const d = api.onDidActiveChange((e) => setIsActive(e.isActive))
    return () => d.dispose()
  }, [api])
  const active = isActive && !collapsed
  const drawIn = id === "drawin"
  const onClick = () => {
    if (drawIn && active) {
      show("timeline")
      return
    }
    show(id)
  }
  return (
    <button
      type="button"
      data-dock-tab={id}
      data-active={active ? "1" : "0"}
      {...(drawIn
        ? {
            "data-animation-drawin": "",
            "data-open": active ? "1" : "0",
            "aria-expanded": active,
            "aria-controls": "animation-drawin-body",
            title: active ? "Hide the draw-in controls" : "Show the draw-in controls: order, overlap, delay, easing, reverse and loop",
          }
        : { "aria-pressed": active })}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={`fs-press flex h-7 max-w-[20rem] items-center gap-1.5 rounded-md px-2 text-[10px] font-medium transition-colors ${
        active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {DOCK_TITLES[id] ?? api.title}
      {drawIn && store && <DockHost name="drawin-summary" className={`min-w-0 truncate ${active ? "[&_*]:!text-background/70" : ""}`} />}
    </button>
  )
}
const TAB_COMPONENTS = { dock: DockTab }

/* THE HEADER ROW BEFORE THE TABS: the transport's host, in the dock group
   only. Other groups keep their headers hidden and render nothing here. */
function DockHeaderPrefix({ group }: IDockviewHeaderActionsProps) {
  if (!isDockGroup(group)) return null
  return <DockHost name="transport" className="flex h-full min-w-0 flex-1 items-center" />
}
/* THE HEADER ROW AFTER THE TABS: the chevron that folds and opens the dock. */
function DockHeaderActions({ group }: IDockviewHeaderActionsProps) {
  const { collapsed, toggleCollapsed } = useContext(DockControlContext)
  if (!isDockGroup(group)) return null
  return (
    <div className="flex h-full items-center px-2">
      <button
        type="button"
        data-dock-collapse
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Open the dock" : "Fold the dock to its header"}
        title={collapsed ? "Open the dock" : "Fold the dock to its header"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={toggleCollapsed}
        className="fs-press flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d={collapsed ? "M1.5 6.5L5 3l3.5 3.5" : "M1.5 3.5L5 7l3.5-3.5"} />
        </svg>
      </button>
    </div>
  )
}

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
  const off = api.hasMaximizedGroup() || !d || !v || d.group === v.group
  if (off || window.matchMedia(LG).matches) {
    box.style.removeProperty("--fs-dock-dh")
    box.style.removeProperty("--fs-dock-shift")
  }
  if (off || !window.matchMedia(LG).matches) {
    box.style.removeProperty("--fs-dock-dw")
    box.style.removeProperty("--fs-dock-xshift")
  }
  if (off) return
  const r = box.getBoundingClientRect(), g = d.group.element.getBoundingClientRect()
  if (window.matchMedia(LG).matches) {
    // L3 put the dock under both, so the root is VERTICAL and the two
    // columns are a nested row. A nested size goes through the same rounding
    // resizeView as the stacked case below (L1 set it at the root, where a
    // fractional width held): 756.5 landed on 756 and the 3D buffer came out
    // 756 wide against main's 755 (assert-dock-shell BUFFERS, L3's first
    // run). So the width is carried the stacked way, on the other axis: the
    // group floored, the drawing's row set to today's exact (W + 1) / 2, and
    // the 3D row pushed right by what the group lost, and narrowed by it.
    const exact = (r.width + 1) / 2
    const t = Math.floor(exact)
    if (Math.abs(g.width - t) > 0.01) d.group.api.setSize({ width: t })
    const held = v.group.element.getBoundingClientRect().left - r.left
    box.style.setProperty("--fs-dock-dw", `${exact}px`)
    box.style.setProperty("--fs-dock-xshift", `${exact - held}px`)
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
    // The dock (L3) sits under both, so the two share the shell less the dock.
    const dock = api.groups.find(isDockGroup)
    const shared = r.height - (dock ? dock.element.getBoundingClientRect().height : 0)
    const exact = (shared + 1) / 2
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
  /** The dock under both (L3): gates open, fold and read it through here. */
  dock: {
    collapsed: () => boolean
    open: (id?: DockPanelId) => void
    fold: () => void
    expand: () => void
    /** The whole dock group hidden (true) or shown. Hidden, the Drawing and the
     *  3D view share the shell as they did before L3; L4's rail does this. */
    setHidden: (hidden: boolean) => void
    hidden: () => boolean
  }
}

export function DockShell({ drawing, view }: Slots) {
  return (
    <DockHostProvider>
      <DockShellInner drawing={drawing} view={view} />
    </DockHostProvider>
  )
}

function DockShellInner({ drawing, view }: Slots) {
  const mutantRef = useRef<Mutant>(null)
  const apiRef = useRef<DockviewApi | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const store = useTakeTransport()

  /* THE DOCK'S FOLD. `collapsedRef` is what the layout code reads inside
     dockview's callbacks; `collapsed` is what the header renders. */
  const [collapsed, setCollapsedState] = useState(true)
  const collapsedRef = useRef(true)
  const openPxRef = useRef<number | null>(null)
  const dockGroup = () => apiRef.current?.groups.find(isDockGroup)
  const setCollapsed = useCallback((v: boolean) => {
    collapsedRef.current = v
    setCollapsedState(v)
  }, [])

  /* The toast sits above the dock and the drawing's own action bar above it.
     88 px over the dock's top edge is the clearance `app/page.tsx` measured for
     the drawing bar; the page's Toaster reads it through `--fs-toast-offset`. */
  const publishEdge = useCallback(() => {
    const g = dockGroup()
    if (!g) return
    // Hidden, the dock takes no room and the drawing's bar is on the window's floor.
    const top = g.api.isVisible ? g.element.getBoundingClientRect().top : window.innerHeight
    const px = mutantRef.current === "toast182" ? 182 : Math.round(window.innerHeight - top + 88)
    document.documentElement.style.setProperty("--fs-toast-offset", `${px}px`)
  }, [])

  const hold = useCallback(() => requestAnimationFrame(() => {
    const api = apiRef.current
    if (!api || !boxRef.current) return
    const g = api.groups.find(isDockGroup)
    if (g && collapsedRef.current && !api.hasMaximizedGroup() && Math.abs(g.element.getBoundingClientRect().height - DOCK_HEADER_PX) > 0.5)
      g.api.setSize({ height: DOCK_HEADER_PX })
    holdTodaysSplit(api, boxRef.current)
    publishEdge()
  }), [publishEdge])

  const openPx = () => {
    const h = boxRef.current?.getBoundingClientRect().height ?? 900
    return openPxRef.current ?? Math.max(DOCK_OPEN_MIN_PX, Math.round(h / 3))
  }
  const expand = useCallback(() => {
    const g = dockGroup()
    if (!g) return
    setCollapsed(false)
    g.api.setSize({ height: openPx() })
    hold()
  }, [hold, setCollapsed])
  const fold = useCallback(() => {
    const g = dockGroup()
    if (!g) return
    const h = g.element.getBoundingClientRect().height
    if (h > DOCK_HEADER_PX + 1) openPxRef.current = h
    setCollapsed(true)
    g.api.setSize({ height: DOCK_HEADER_PX })
    hold()
  }, [hold, setCollapsed])
  const show = useCallback((id: DockPanelId) => {
    apiRef.current?.getPanel(id)?.api.setActive()
    if (collapsedRef.current) expand()
    syncDrawIn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expand])
  const toggleCollapsed = useCallback(() => (collapsedRef.current ? expand() : fold()), [expand, fold])

  /* DRAW-IN OPEN IS THE DRAW-IN TAB SHOWING. The store's `drawInOpen` is what
     the Animation drawer's "Show in dock" writes (OPEN_ANIMATION_PANEL_EVENT)
     and what Escape clears, both in the viewport; the tab is what the dock
     shows. Each follows the other, and each write is skipped when the two
     already agree, so neither loops. */
  const syncDrawIn = () => {
    const g = dockGroup()
    if (!store || !g) return
    const shown = g.activePanel?.id === "drawin" && !collapsedRef.current
    if (store.get("drawInOpen") !== shown) store.set("drawInOpen", shown)
  }
  const subDrawIn = useCallback((fn: () => void) => (store ? store.subscribe("drawInOpen", fn) : () => {}), [store])
  const readDrawIn = useCallback(() => store?.get("drawInOpen") ?? false, [store])
  const drawInOpen = useSyncExternalStore(subDrawIn, readDrawIn, () => false)
  useEffect(() => {
    const g = dockGroup()
    if (!g || mutantRef.current === "nosync") return
    const shown = g.activePanel?.id === "drawin" && !collapsedRef.current
    if (drawInOpen && !shown) show("drawin")
    else if (!drawInOpen && shown) apiRef.current?.getPanel("timeline")?.api.setActive()
  }, [drawInOpen, show])
  useEffect(() => syncDrawIn(), [collapsed]) // eslint-disable-line react-hooks/exhaustive-deps

  const frozen = useRef<Slots | null>(null)
  if (frozen.current === null) frozen.current = { drawing, view }
  const slots = mutantRef.current === "stale" ? frozen.current : { drawing, view }

  /* Every group but the dock keeps its header hidden (L1). The dock's header
     is the transport row and the tabs, and it is marked for `dock.css`. */
  const dressGroup = useCallback((g: DockviewGroupPanel) => {
    if (isDockGroup(g)) {
      g.model.header.hidden = false
      g.element.setAttribute("data-fs-dock", "")
      return
    }
    g.element.removeAttribute("data-fs-dock")
    if (mutantRef.current !== "header") g.model.header.hidden = true
  }, [])
  const hideHeaders = useCallback((api: DockviewApi) => {
    for (const g of api.groups) dressGroup(g)
  }, [dressGroup])

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
    // THE DOCK, under both, folded to its header (see the note at the top).
    if (mutant !== "nodock") {
      const t = api.addPanel({
        id: "timeline",
        component: "timeline",
        tabComponent: "dock",
        title: DOCK_TITLES.timeline,
        position: { direction: "below" },
        minimumHeight: DOCK_HEADER_PX,
        initialHeight: DOCK_HEADER_PX,
      })
      for (const id of ["drawin", "export"] as const)
        api.addPanel({
          id,
          component: id,
          tabComponent: "dock",
          title: DOCK_TITLES[id],
          position: { referencePanel: t, direction: "within" },
          inactive: true,
          minimumHeight: DOCK_HEADER_PX,
        })
      t.api.setActive()
    }
    hideHeaders(api)
    // Groups come and go on a move, a maximize and a layout load; each new
    // one arrives with its header showing unless it is hidden here.
    api.onDidAddGroup((g) => dressGroup(g))
    api.onDidLayoutFromJSON(() => hideHeaders(api))
    apiRef.current = api
    api.onDidMovePanel(hold)
    api.onDidMaximizedGroupChange(hold)
    api.onDidLayoutFromJSON(hold)
    api.onDidActivePanelChange(() => syncDrawIn())
    /* A drag on the edge above the dock folds or opens it as far as it goes:
       at its header it is folded, anything taller is open. */
    api.onDidLayoutChange(() => {
      const g = api.groups.find(isDockGroup)
      if (!g) return
      const h = g.element.getBoundingClientRect().height
      const folded = h <= DOCK_HEADER_PX + 1
      if (folded !== collapsedRef.current) setCollapsed(folded)
      publishEdge()
    })
    hold()

    if (process.env.NODE_ENV !== "production") {
      const harness: DockHarness = {
        api,
        mutant,
        load: (layout) => api.fromJSON(layout, { reuseExistingPanels: mutant !== "noReuse" }),
        dock: {
          collapsed: () => collapsedRef.current,
          open: (id = "timeline") => show(id),
          fold,
          expand,
          setHidden: (hidden) => {
            api.groups.find(isDockGroup)?.api.setVisible(!hidden)
            hold()
          },
          hidden: () => !(api.groups.find(isDockGroup)?.api.isVisible ?? false),
        },
      }
      ;(window as unknown as { __dockHarness?: DockHarness }).__dockHarness = harness
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideHeaders, dressGroup, hold, publishEdge, setCollapsed])

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
      <DockControlContext.Provider value={{ collapsed, show, toggleCollapsed }}>
        <div ref={boxRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden" style={QUIET}>
          <DockviewReact
            className="absolute inset-0"
            components={COMPONENTS}
            tabComponents={TAB_COMPONENTS}
            prefixHeaderActionsComponent={DockHeaderPrefix}
            rightHeaderActionsComponent={DockHeaderActions}
            onReady={onReady}
            theme={THEME}
            defaultRenderer={readMutant() === "onlyWhenVisible" ? "onlyWhenVisible" : "always"}
            hideBorders
            disableDnd
            disableFloatingGroups
            locked
          />
        </div>
      </DockControlContext.Provider>
    </SlotContext.Provider>
  )
}

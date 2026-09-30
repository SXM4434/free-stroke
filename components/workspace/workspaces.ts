/* ==================================================================
   WORKSPACES · L4 of the layout rethink (docs/research-2026-09-26/
   layout-rethink/BUILD-PLAN.md §3; his ruling of 2026-09-26: workspaces on
   dockable panels, switched from B's left rail).

   Three workspaces, Draw, Style and Animate, each a saved arrangement of the
   same six panels. The panel ids are fixed and no layout ever removes one: a
   panel a workspace does not show is in the layout, hidden, which is what
   keeps the 3D view's GL context alive across a switch (§1).

     drawing   the 2D canvas
     view3d    the 3D view
     style     the Style panel: the eight families and the open one
     timeline  the dock's Timeline tab (with drawin and export, one group)

   Defaults at 1512x982 (§3), with the rail's 48 px and the top bar's 40 px
   off, so the panels share 1464x942:

     Draw     Drawing 872 | 3D view 592, the dock folded to its header
     Style    3D view | Style 360, Drawing hidden, the dock folded
     Animate  3D view | Style 360 over the dock open at 390

   Below 1024 px wide the page stacks, as it always has: Drawing over the 3D
   view over the dock, Style hidden, in every workspace (§6 risk 7).

   Every layout change saves the current workspace's `toJSON()` under
   `fs.layout.v1.<workspace>`; every read and write sits in try/catch.
   ================================================================== */

import type { SerializedDockview } from "dockview-react"

export type WorkspaceId = "draw" | "style" | "animate"
export const WORKSPACES: readonly { id: WorkspaceId; label: string; key: string }[] = [
  { id: "draw", label: "Draw", key: "1" },
  { id: "style", label: "Style", key: "2" },
  { id: "animate", label: "Animate", key: "3" },
]

/** The fixed panel ids (§3). */
export const PANEL_IDS = ["drawing", "view3d", "style", "timeline", "drawin", "export"] as const
export type PanelId = (typeof PANEL_IDS)[number]

export const STORAGE_PREFIX = "fs.layout.v1."
export const storageKey = (ws: WorkspaceId) => `${STORAGE_PREFIX}${ws}`

/** The dock's header height: folded, the dock is this tall. */
export const DOCK_HEADER_PX = 36
/** The Style panel's width in Style and Animate (§3). */
export const STYLE_PX = 360
/** The Animate dock, open: 390 of 982 at 1512x982 (§3). */
export const ANIMATE_DOCK_PX = 390
/** The Drawing's share of the top row in Draw: 872 of 1464 (§3). */
const DRAW_SHARE = 872 / 1464

export const PANEL_META: Record<PanelId, { component: string; title: string; tabComponent?: string; minimumHeight?: number; minimumWidth?: number }> = {
  drawing: { component: "drawing", title: "Drawing", tabComponent: "panel" },
  view3d: { component: "view3d", title: "3D view", tabComponent: "panel" },
  style: { component: "style", title: "Style", tabComponent: "panel", minimumWidth: 280 },
  timeline: { component: "timeline", title: "Timeline", tabComponent: "dock", minimumHeight: DOCK_HEADER_PX },
  drawin: { component: "drawin", title: "Draw-in", tabComponent: "dock", minimumHeight: DOCK_HEADER_PX },
  export: { component: "export", title: "Export", tabComponent: "dock", minimumHeight: DOCK_HEADER_PX },
}

type Leaf = { type: "leaf"; data: { views: string[]; activeView: string; id: string; hideHeader?: boolean }; size: number; visible?: boolean }
type Branch = { type: "branch"; data: (Leaf | Branch)[]; size: number }

const leaf = (id: string, views: PanelId[], size: number, visible: boolean, hideHeader: boolean, active: PanelId = views[0]): Leaf => ({
  type: "leaf",
  data: { views: [...views], activeView: active, id, ...(hideHeader ? { hideHeader: true } : {}) },
  size: Math.max(0, Math.round(size)),
  ...(visible ? {} : { visible: false }),
})

const panels = () =>
  Object.fromEntries(
    PANEL_IDS.map((id) => {
      const m = PANEL_META[id]
      return [
        id,
        {
          id,
          contentComponent: m.component,
          ...(m.tabComponent ? { tabComponent: m.tabComponent } : {}),
          title: m.title,
          ...(m.minimumWidth ? { minimumWidth: m.minimumWidth } : {}),
          ...(m.minimumHeight ? { minimumHeight: m.minimumHeight } : {}),
        },
      ]
    }),
  )

/** The group ids are fixed too, so a saved layout and a default name the same groups. */
export const GROUP_IDS = { drawing: "g-drawing", view3d: "g-view3d", style: "g-style", dock: "g-dock" } as const

/**
 * A workspace's default arrangement for a shell of `w` x `h` px. `wide` is the
 * `lg` breakpoint (1024 px); below it every workspace is the stacked one.
 */
export function defaultLayout(ws: WorkspaceId, w: number, h: number, wide = true): SerializedDockview {
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h))
  const dockOpen = ws === "animate"
  const dockPx = dockOpen ? Math.min(ANIMATE_DOCK_PX, Math.round(H * 0.4)) : DOCK_HEADER_PX
  const topH = H - dockPx
  let top: Branch
  if (wide) {
    const drawing = ws === "draw"
    const style = ws !== "draw"
    const styleW = style ? STYLE_PX : 0
    const drawW = drawing ? Math.round((W - styleW) * DRAW_SHARE) : Math.round(W * DRAW_SHARE)
    const viewW = W - styleW - (drawing ? drawW : 0)
    top = {
      type: "branch",
      size: topH,
      data: [
        leaf(GROUP_IDS.drawing, ["drawing"], drawW, drawing, false),
        leaf(GROUP_IDS.view3d, ["view3d"], viewW, true, false),
        leaf(GROUP_IDS.style, ["style"], STYLE_PX, style, false),
      ],
    }
  } else {
    // Stacked: the drawing over the 3D view, halves, as the columns stacked,
    // each group straight in the VERTICAL root, the dock last.
    const half = Math.floor(topH / 2)
    return {
      grid: {
        root: {
          type: "branch",
          size: W,
          data: [
            leaf(GROUP_IDS.drawing, ["drawing"], half, true, false),
            leaf(GROUP_IDS.view3d, ["view3d"], topH - half, true, false),
            leaf(GROUP_IDS.style, ["style"], STYLE_PX, false, false),
            leaf(GROUP_IDS.dock, ["timeline", "drawin", "export"], dockPx, true, false, "timeline"),
          ],
        },
        width: W,
        height: H,
        orientation: "VERTICAL",
      },
      panels: panels(),
      activeGroup: GROUP_IDS.dock,
    } as unknown as SerializedDockview
  }
  return {
    grid: {
      root: {
        type: "branch",
        size: W,
        data: [top, leaf(GROUP_IDS.dock, ["timeline", "drawin", "export"], dockPx, true, false, "timeline")],
      },
      width: W,
      height: H,
      orientation: "VERTICAL",
    },
    panels: panels(),
    activeGroup: GROUP_IDS.dock,
  } as unknown as SerializedDockview
}

/**
 * Why a saved layout cannot be loaded as it is, or null when it can: every
 * fixed panel present once, nothing else. A layout that names a panel this
 * build does not have, or lacks one, falls back to the default and says which.
 */
export function layoutProblem(layout: unknown): string | null {
  if (!layout || typeof layout !== "object") return "it is not a layout object"
  const l = layout as { grid?: { root?: unknown }; panels?: Record<string, unknown> }
  if (!l.grid || !l.grid.root) return "it has no grid"
  if (!l.panels || typeof l.panels !== "object") return "it has no panels"
  const ids = Object.keys(l.panels)
  const extra = ids.filter((id) => !(PANEL_IDS as readonly string[]).includes(id))
  if (extra.length) return `it names panel${extra.length > 1 ? "s" : ""} this build does not have: ${extra.join(", ")}`
  const missing = PANEL_IDS.filter((id) => !ids.includes(id))
  if (missing.length) return `it lacks panel${missing.length > 1 ? "s" : ""} ${missing.join(", ")}`
  const seen: string[] = []
  const walk = (n: unknown): boolean => {
    if (!n || typeof n !== "object") return false
    const node = n as { type?: string; data?: unknown }
    if (node.type === "leaf") {
      const views = (node.data as { views?: unknown })?.views
      if (!Array.isArray(views)) return false
      seen.push(...(views as string[]))
      return true
    }
    if (node.type === "branch" && Array.isArray(node.data)) return node.data.every(walk)
    return false
  }
  if (!walk(l.grid.root)) return "its grid is malformed"
  const dup = seen.filter((v, i) => seen.indexOf(v) !== i)
  if (dup.length) return `it places ${dup.join(", ")} twice`
  const unplaced = PANEL_IDS.filter((id) => !seen.includes(id))
  if (unplaced.length) return `it does not place ${unplaced.join(", ")}`
  return null
}

/* ---- storage, every touch guarded ------------------------------------- */

export type Stored = { ok: true; layout: unknown | null } | { ok: false; why: string }

export function readSaved(ws: WorkspaceId): Stored {
  try {
    const raw = window.localStorage.getItem(storageKey(ws))
    if (raw === null) return { ok: true, layout: null }
    try {
      return { ok: true, layout: JSON.parse(raw) }
    } catch {
      return { ok: true, layout: { __unparsable: raw.slice(0, 40) } }
    }
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : String(e) }
  }
}

export function writeSaved(ws: WorkspaceId, layout: SerializedDockview): { ok: true } | { ok: false; why: string } {
  try {
    window.localStorage.setItem(storageKey(ws), JSON.stringify(layout))
    return { ok: true }
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : String(e) }
  }
}

export function deleteSaved(ws: WorkspaceId): { ok: true } | { ok: false; why: string } {
  try {
    window.localStorage.removeItem(storageKey(ws))
    return { ok: true }
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : String(e) }
  }
}

export const CURRENT_KEY = `${STORAGE_PREFIX}current`
export function readCurrent(): WorkspaceId | null {
  try {
    const v = window.localStorage.getItem(CURRENT_KEY)
    return v === "draw" || v === "style" || v === "animate" ? v : null
  } catch {
    return null
  }
}
export function writeCurrent(ws: WorkspaceId): void {
  try {
    window.localStorage.setItem(CURRENT_KEY, ws)
  } catch {
    // Storage blocked: the shell already said so once; the workspace still switches.
  }
}

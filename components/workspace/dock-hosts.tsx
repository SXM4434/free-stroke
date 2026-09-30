"use client"

/* ==================================================================
   DOCK HOSTS · L3 of the layout rethink (docs/research-2026-09-26/
   layout-rethink/BUILD-PLAN.md §2 and §5, row L3).

   The dock left the viewport: the transport, the strip, Perform, the keys,
   the timing note, the Draw-in controls and Export render in dockview panels
   under both the Drawing and the 3D view. The STATE they read did not move
   with them. The export handlers, the compare cycle and the video plan still
   live in `components/viewport-3d.tsx`, next to the renderer they drive, so
   the viewport renders those controls into the panels through React portals.

   Each dock panel (and the dock group's header) mounts one empty host element
   and registers it here under a fixed name. The viewport reads the host with
   `useDockHost` and portals into it. React context crosses the portal, so the
   controls keep every provider they had inside the viewport, and nothing about
   what they write changes.

   A page with no dock (the `/desk-doodles` beat, which is chromeless anyway)
   has no provider: every host reads null and the viewport keeps its old
   floating card.
   ================================================================== */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

export type DockHostName =
  | "transport"
  | "timeline"
  | "drawin"
  | "drawin-summary"
  | "export"

type Hosts = Partial<Record<DockHostName, HTMLElement>>

type Registry = {
  hosts: Hosts
  register: (name: DockHostName, el: HTMLElement | null) => void
}

const DockHostContext = createContext<Registry | null>(null)

export function DockHostProvider({ children }: { children: ReactNode }) {
  const [hosts, setHosts] = useState<Hosts>({})
  const register = useCallback((name: DockHostName, el: HTMLElement | null) => {
    setHosts((prev) => {
      if ((prev[name] ?? null) === el) return prev
      const next = { ...prev }
      if (el) next[name] = el
      else delete next[name]
      return next
    })
  }, [])
  const value = useMemo(() => ({ hosts, register }), [hosts, register])
  return <DockHostContext.Provider value={value}>{children}</DockHostContext.Provider>
}

/** The element a dock panel holds for `name`, or null with no dock on the page. */
export function useDockHost(name: DockHostName): HTMLElement | null {
  return useContext(DockHostContext)?.hosts[name] ?? null
}

/** True when the page has a dock at all, mounted or not yet. */
export function useHasDock(): boolean {
  return useContext(DockHostContext) !== null
}

/** A ref callback that registers the element it lands on as host `name`. */
export function useDockHostRef(name: DockHostName): (el: HTMLElement | null) => void {
  const reg = useContext(DockHostContext)?.register
  return useCallback((el: HTMLElement | null) => reg?.(name, el), [reg, name])
}

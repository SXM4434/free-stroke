/* ──────────────────────────────────────────────────────────────────────────
 * THE TAKE TRANSPORT, one store per page (layout rethink phase L2).
 *
 * Play, the clock, the pace, the speed and the dock's open flags used to be
 * `useState` and `useRef` inside `components/viewport-3d.tsx`, so nothing
 * outside the viewport could read or drive them. Phase L3 takes the dock
 * (strip, key lanes, transport, export) out of the viewport and into dockview
 * panels, and those panels need the SAME values the frame loop runs on, not a
 * copy: a `useState` mirror in a panel lags the frame loop by at least a frame.
 *
 * So the state lives here, in an external store read with
 * `useSyncExternalStore`, provided by `app/page.tsx` beside
 * `StrokeTakeProvider`. The viewport reads the same store. A host with no
 * provider (the hero page) gets a store of its own from the viewport, which is
 * the state it had before this file existed.
 *
 * Three kinds of value:
 *   · refs      `playheadRef`, `clockRef`, `openingRef`. Written by the frame
 *               loop every frame and read in `useFrame`, never through React.
 *               The objects are the ones `Scene` reads, so any reader holding
 *               the store reads the frame loop's own number.
 *   · progress  the throttled readout value (about 15 per second) the time
 *               label, the scrubber and the strip's playhead subscribe to.
 *   · slots     React state: `playing`, `speed`, the pace override, the dock's
 *               open flags, the export name and the in-flight flags. Each slot
 *               has its own subscribers, so a panel that reads `speed` does
 *               not re-render when `playing` flips.
 *   · derived   what the viewport computes from the document and the take
 *               (`totalDuration`, `revealEase`, `revealMode`, `seamWindow`),
 *               published after each commit for readers outside it. The
 *               viewport itself reads its own render's values, so nothing it
 *               draws waits on the publish.
 * ────────────────────────────────────────────────────────────────────────── */

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react"
import type { SetStateAction } from "react"
import type { RevealMode } from "@/lib/pen-reveal"
import { effectiveWindow, type RevealEase, type RevealEnvelopeParams, type RevealWindowParams } from "@/lib/stroke-schedule"
import { easeReveal } from "@/lib/stroke-timing"

/* ---- The readout value -----------------------------------------------------
 *
 * Moved here from `viewport-3d.tsx` unchanged. Measured 2026-09-25, night R:
 * while `progress` lived in the viewport's `useState`, each 66 ms readout tick
 * re-rendered the whole host and about 50 components of the R3F tree. Nothing
 * in the scene reads it; the scene reads `playheadRef` inside `useFrame`. So
 * only the readouts subscribe. */
export type ProgressStore = {
  get: () => number
  set: (v: number) => void
  subscribe: (fn: () => void) => () => void
}
export function createProgressStore(initial: number): ProgressStore {
  return progressStoreWithReset(initial).store
}
/** The store, plus a reset only the transport holds: back to `initial` with
 *  no notify. Kept off `ProgressStore` so no readout can call it. */
function progressStoreWithReset(initial: number): { store: ProgressStore; reset: () => void } {
  let value = initial
  const subs = new Set<() => void>()
  return {
    store: {
      get: () => value,
      set: (v: number) => {
        if (Object.is(v, value)) return
        value = v
        subs.forEach((fn) => fn())
      },
      subscribe: (fn) => {
        subs.add(fn)
        return () => subs.delete(fn)
      },
    },
    reset: () => {
      value = initial
    },
  }
}
export function useProgressValue(store: ProgressStore): number {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/* ---- The slots ------------------------------------------------------------ */

export interface TransportState {
  playing: boolean
  speed: number
  /** The diagnostic's pace (compare, the debug `smooth` pill). Persists nowhere. */
  modeOverride: RevealMode | null
  hybridBlend: number
  /** The dock's Draw-in section. */
  drawInOpen: boolean
  /** The timing note under the transport, folded by default. */
  timingNoteOpen: boolean
  /** The Debug toggle as pressed. The viewport ANDs it with the dev guard. */
  debugRequested: boolean
  exportName: string
  /** GLB in flight. */
  exporting: boolean
  exportingPng: boolean
  exportingVideo: boolean
}

/** The values the viewport had in `useState` before, in the same order. */
export const TRANSPORT_DEFAULTS: Readonly<TransportState> = Object.freeze({
  playing: false,
  speed: 1,
  modeOverride: null,
  hybridBlend: 0.4,
  drawInOpen: false,
  timingNoteOpen: false,
  debugRequested: false,
  exportName: "",
  exporting: false,
  exportingPng: false,
  exportingVideo: false,
})

/* ---- Derived ---------------------------------------------------------------- */

export interface TransportDerived {
  /** `max(takeLen, keysEndMs(keys))`: the transport's length in ms. */
  totalDuration: number
  /** `takeMs ?? penMs`: the take's own length, keys aside. */
  takeLen: number
  revealEase: RevealEase
  /** `modeOverride ?? envelope.mode`. */
  revealMode: RevealMode
  /** The window the frame loop runs, `seamless` folded in. */
  seamWindow: RevealWindowParams
}

/** The pace the transport plays: the diagnostic's override, else the document's. */
export function revealModeOf(modeOverride: RevealMode | null, envelope: RevealEnvelopeParams): RevealMode {
  return modeOverride ?? envelope.mode
}

/** The transport's length: the take's, stretched to the last key. */
export function transportLengths(takeMs: number | null, penMs: number, keysEndMs: number): { takeLen: number; totalDuration: number } {
  const takeLen = takeMs ?? penMs
  return { takeLen, totalDuration: Math.max(takeLen, keysEndMs) }
}

/** F118: the window the frame loop runs. `Scene` decides `seamless` from the
 *  same three inputs through the same function. */
export function seamWindowOf(revealWindow: RevealWindowParams, envelope: Pick<RevealEnvelopeParams, "loop" | "delaySeconds">): RevealWindowParams {
  return effectiveWindow(revealWindow, { loop: envelope.loop, delaySeconds: envelope.delaySeconds })
}

/**
 * The inverse of `easeReveal`, by bisection rather than by algebra. Moved here
 * from `viewport-3d.tsx` unchanged, so a panel outside the viewport can map a
 * scrub back to the clock without importing the file that renders it.
 *
 * Closed forms exist for all four eases, but they are three different formulas
 * plus a piecewise split, and each one is a chance for the scrubber to disagree
 * with the clock by a hair. Thirty bisection steps on a monotonic function is
 * exact to about 1e-9, runs once per scrub, and cannot drift from `easeReveal`,
 * because it calls it.
 */
export function unEaseReveal(p: number, ease: RevealEase): number {
  /* THE ENDPOINTS ARE RETURNED EXACTLY, AND THAT IS NOT TIDINESS.
   *
   * Bisection converges TOWARD 1 and lands one ulp short of it (1 - 2^-30), so
   * `setProgress(1)` under an ease left the clock at 0.999999999. The playback
   * loop then asked `clockRef.current >= 1` to decide whether a REVERSE pass was
   * starting from the top and therefore whether to arm the delay; the answer
   * was false, the delay never armed, and "wait half a second, then un-draw"
   * un-drew immediately. Caught by `assert-drawin-timing.mjs` §F reading a
   * playhead of 0.9948 where 1 was required. */
  if (p <= 0) return 0
  if (p >= 1) return 1
  if (ease === "linear") return p
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (easeReveal(mid, ease) < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/* ---- The store ---------------------------------------------------------------- */

type Setter<V> = (v: SetStateAction<V>) => void
type Setters = { [K in keyof TransportState]: Setter<TransportState[K]> }

export interface TakeTransport {
  /** 0..1, `easeReveal(clock)`. What every reveal consumer reads. */
  readonly playheadRef: { current: number }
  /** Wall-clock 0..1, before the ease. */
  readonly clockRef: { current: number }
  /** F118 TRAVEL-5: true until a looping pass wraps. */
  readonly openingRef: { current: boolean }
  readonly progress: ProgressStore
  get<K extends keyof TransportState>(key: K): TransportState[K]
  /** Updater form included, like a `useState` setter. */
  set<K extends keyof TransportState>(key: K, v: SetStateAction<TransportState[K]>): void
  subscribe(key: keyof TransportState, fn: () => void): () => void
  /** One stable setter per slot, the same function for the store's life. */
  readonly setters: Readonly<Setters>
  derived(): TransportDerived | null
  publishDerived(d: TransportDerived): void
  subscribeDerived(fn: () => void): () => void
  /**
   * Back to the defaults WITHOUT notifying. The viewport calls it once when it
   * mounts, so a viewport the error boundary remounts starts where a fresh one
   * did before this store existed (paused, at 0, speed 1). Silent because it
   * runs during render, where notifying another component is an error.
   */
  resetSilently(): void
}

export function createTakeTransport(): TakeTransport {
  const state: TransportState = { ...TRANSPORT_DEFAULTS }
  const subs = new Map<keyof TransportState, Set<() => void>>()
  let derived: TransportDerived | null = null
  const derivedSubs = new Set<() => void>()
  const playheadRef = { current: 0 }
  const clockRef = { current: 0 }
  const openingRef = { current: true }
  const { store: progress, reset: resetProgress } = progressStoreWithReset(0)

  function get<K extends keyof TransportState>(key: K): TransportState[K] {
    return state[key]
  }
  function set<K extends keyof TransportState>(key: K, v: SetStateAction<TransportState[K]>) {
    const prev = state[key]
    const next = typeof v === "function" ? (v as (p: TransportState[K]) => TransportState[K])(prev) : v
    if (Object.is(next, prev)) return
    state[key] = next
    subs.get(key)?.forEach((fn) => fn())
  }
  function subscribe(key: keyof TransportState, fn: () => void) {
    let s = subs.get(key)
    if (!s) subs.set(key, (s = new Set()))
    s.add(fn)
    return () => {
      s!.delete(fn)
    }
  }
  const setters = {} as Setters
  for (const key of Object.keys(TRANSPORT_DEFAULTS) as (keyof TransportState)[]) {
    ;(setters as Record<string, Setter<unknown>>)[key] = (v) =>
      set(key, v as SetStateAction<TransportState[typeof key]>)
  }

  return {
    playheadRef,
    clockRef,
    openingRef,
    progress,
    get,
    set,
    subscribe,
    setters: Object.freeze(setters),
    derived: () => derived,
    publishDerived(d) {
      if (
        derived &&
        derived.totalDuration === d.totalDuration &&
        derived.takeLen === d.takeLen &&
        derived.revealEase === d.revealEase &&
        derived.revealMode === d.revealMode &&
        derived.seamWindow === d.seamWindow
      )
        return
      derived = d
      derivedSubs.forEach((fn) => fn())
    },
    subscribeDerived(fn) {
      derivedSubs.add(fn)
      return () => {
        derivedSubs.delete(fn)
      }
    },
    resetSilently() {
      Object.assign(state, TRANSPORT_DEFAULTS)
      playheadRef.current = 0
      clockRef.current = 0
      openingRef.current = true
      derived = null
      resetProgress()
    },
  }
}

/* ---- React ---------------------------------------------------------------- */

const TakeTransportContext = createContext<TakeTransport | null>(null)

/** One store for the page. `app/page.tsx` mounts it beside `StrokeTakeProvider`. */
export function TakeTransportProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createTakeTransport(), [])
  /* DEV ONLY, the store as a gate reads it: `assert-take-transport.mjs`
   * compares its playhead with the one the frame loop drew, every frame, and
   * drives the slots from outside the viewport the way an L3 panel will. */
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>
    w.__fsTransport = {
      playhead: () => store.playheadRef.current,
      clock: () => store.clockRef.current,
      opening: () => store.openingRef.current,
      progress: () => store.progress.get(),
      get: (k: keyof TransportState) => store.get(k),
      set: (k: keyof TransportState, v: unknown) => {
        if (!(k in TRANSPORT_DEFAULTS)) return false
        store.set(k, v as TransportState[typeof k])
        return true
      },
      derived: () => store.derived(),
    }
    return () => {
      delete w.__fsTransport
    }
  }, [store])
  return createElement(TakeTransportContext.Provider, { value: store }, children)
}

/** The page's store, or null on a host that mounts none. */
export function useTakeTransport(): TakeTransport | null {
  return useContext(TakeTransportContext)
}

/** One slot as `[value, setter]`, the shape `useState` returns. The setter is
 *  stable for the store's life, as a `useState` setter is. */
export function useTransportSlot<K extends keyof TransportState>(
  store: TakeTransport,
  key: K,
): [TransportState[K], Setter<TransportState[K]>] {
  const sub = useCallback((fn: () => void) => store.subscribe(key, fn), [store, key])
  const read = useCallback(() => store.get(key), [store, key])
  const value = useSyncExternalStore(sub, read, read)
  return [value, store.setters[key]]
}

/** The derived values, null until the viewport has published once. */
export function useTransportDerived(store: TakeTransport): TransportDerived | null {
  return useSyncExternalStore(store.subscribeDerived, store.derived, store.derived)
}

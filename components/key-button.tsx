"use client"

/* ==================================================================
   THE KEY BUTTON · K3 of the layout rethink (docs/research-2026-09-26/
   layout-rethink/BUILD-PLAN.md §4 "The key button in Field"; his ruling of
   2026-09-26: keyframe anything, the After Effects stopwatch, Rive's and
   Blender's diamond).

   One per keyable style value (`KEYABLE_PATHS`, lib/keyframes.ts), 8 px after
   its field's label text in the Style panel. A diamond drawn at 12 px in a
   square 24x24 hit box, three looks:

     outline          the value has no keys
     filled           keyed, and a key sits on this frame
     outline, a dot   keyed, no key on this frame

   A click adds a key at the playhead holding the value on screen, or takes
   away the key that sits there (the last key taken away removes the lane,
   `compactKeys`). A value no key drives (`KEY_DISABLED`, K2) shows the button
   disabled, with the reason as its label: a key button that does nothing is a
   dead dial.
   ================================================================== */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
  type ReactNode,
} from "react"
import { useStrokeTake } from "@/components/stroke-strip"
import { useTakeTransport } from "@/lib/take-transport"
import {
  KEYABLE_PATHS,
  KEY_DISABLED,
  compactKeys,
  framedKeys,
  makeKey,
  styleAt,
  validateKeys,
  type StyleKeyPath,
  type TakeKeys,
  type Track,
} from "@/lib/keyframes"
import { KEY_UI_MUTANT, styleKeyMeta } from "@/lib/style-key-meta"
import type { StyleState } from "@/lib/style-system"

/** How close in ms a key counts as "on this frame": half a 60 fps frame. */
export const KEY_ON_FRAME_MS = 1000 / 120

const KEYABLE = new Set<string>(KEYABLE_PATHS.map((p) => p.path))
export const isKeyablePath = (p: string): p is StyleKeyPath => KEYABLE.has(p)

export function readPath(state: StyleState, path: string): number {
  let o: unknown = state
  for (const part of path.split(".")) o = (o as Record<string, unknown>)?.[part]
  return typeof o === "number" ? o : Number.NaN
}

/** True when any style path holds a key. */
export function hasStyleKeys(keys: TakeKeys | undefined): boolean {
  return !!keys && KEYABLE_PATHS.some((p) => ((keys[p.path] as Track | undefined)?.length ?? 0) > 0)
}

/** The Style panel's keyed context: the style as it shows at the playhead
 *  (each keyed value sampled, `styleAt`). Absent, no key button draws. */
export const KeyStyleCtx = createContext<{ styleState: StyleState } | null>(null)

/** The key clock the frame loop samples: the transport's playhead times the
 *  keyed length (`makeKeyReader` in components/viewport-3d.tsx). */
function readKeyClock(store: ReturnType<typeof useTakeTransport>): number {
  return store ? store.progress.get() * (store.derived()?.totalDuration ?? 0) : 0
}

/** The key clock, as state. Read from the throttled progress readout, so a
 *  reader re-renders about 15 times a second while playing, not every frame;
 *  and only while `on` (something is keyed), so an unkeyed panel never
 *  re-renders for the playhead. */
export function useKeyClockMs(on = true): number {
  const store = useTakeTransport()
  const sub = useCallback(
    (fn: () => void) => {
      if (!store || !on) return () => {}
      const a = store.progress.subscribe(fn)
      const b = store.subscribeDerived(fn)
      return () => {
        a()
        b()
      }
    },
    [store, on],
  )
  const read = useCallback(() => (on ? readKeyClock(store) : 0), [store, on])
  return useSyncExternalStore(sub, read, () => 0)
}

/** The key under the playhead on `track`, or -1. */
export function keyAt(track: Track | undefined, clockMs: number): number {
  if (!track) return -1
  return track.findIndex((k) => Math.abs(k.tMs - clockMs) <= KEY_ON_FRAME_MS)
}

/** `keys` with `path` keyed to `value` at `clockMs`: the key there replaced, or a new one added in time order. */
export function withKeyAt(keys: TakeKeys | undefined, path: StyleKeyPath, clockMs: number, value: number): TakeKeys {
  const track = [...((keys?.[path] as Track | undefined) ?? [])]
  const at = keyAt(track, clockMs)
  if (at >= 0) track[at] = { ...track[at], value }
  else {
    track.push(makeKey(Math.round(clockMs * 1000) / 1000, value))
    track.sort((a, b) => a.tMs - b.tMs)
  }
  return { ...(keys ?? {}), [path]: track }
}

/**
 * EDITING A KEYED VALUE WRITES A KEY AT THE PLAYHEAD (BUILD-PLAN.md §4, After
 * Effects' rule once the stopwatch is on). Otherwise the next frame's sample
 * overwrites the edit and the slider looks broken. `prev` and `next` are the
 * doc's style before and after an edit; the keys come back with a key at
 * `clockMs` for each keyed path the edit moved, or null when it moved none.
 * A path whose new value is the one already showing there (a whole-state
 * write that carried a sampled value along) is left alone, and so is a path
 * no key drives.
 */
export function keyedStyleEdit(prev: StyleState, next: StyleState, keys: TakeKeys | undefined, clockMs: number): TakeKeys | null {
  if (!hasStyleKeys(keys) || KEY_UI_MUTANT === "noeditkey") return null
  const framed = framedKeys(keys)
  const shown = styleAt(prev, framed, clockMs)
  let out: TakeKeys | null = null
  for (const { path } of KEYABLE_PATHS) {
    if (KEY_DISABLED[path] || !((keys?.[path] as Track | undefined)?.length)) continue
    const nv = readPath(next, path)
    if (!Number.isFinite(nv) || nv === readPath(prev, path)) continue
    if (Math.abs(nv - readPath(shown, path)) < 1e-9) continue
    out = withKeyAt(out ?? keys, path, clockMs, nv)
  }
  if (!out) return null
  return validateKeys(out).length ? null : compactKeys(out) ?? {}
}

/**
 * THE STYLE PANEL'S VIEW OF THE KEYS. Rendered inside the page's providers, it
 * hands its child the style as it shows at the playhead (the doc's own object
 * when no style value is keyed), provides it to every key button, and points
 * `clockRef` at the key clock so the page's style setter can key an edit at
 * the playhead (`keyedStyleEdit`).
 */
export function KeyedStyle({
  styleState,
  clockRef,
  children,
}: {
  styleState: StyleState
  clockRef?: MutableRefObject<() => number>
  children: (shown: StyleState) => ReactNode
}) {
  const take = useStrokeTake()
  const store = useTakeTransport()
  const keys = take?.keys
  const keyed = hasStyleKeys(keys)
  const clockMs = useKeyClockMs(keyed)
  useEffect(() => {
    if (!clockRef) return
    clockRef.current = () => readKeyClock(store)
  }, [clockRef, store])
  const shown = useMemo(
    () => (keyed ? styleAt(styleState, framedKeys(keys), clockMs) : styleState),
    [keyed, styleState, keys, clockMs],
  )
  const ctx = useMemo(() => ({ styleState: shown }), [shown])
  return <KeyStyleCtx.Provider value={ctx}>{children(shown)}</KeyStyleCtx.Provider>
}

export function KeyButton({ path, className = "" }: { path: string; className?: string }) {
  const take = useStrokeTake()
  const store = useTakeTransport()
  const doc = useContext(KeyStyleCtx)
  const track = (take?.keys as Readonly<Record<string, Track | undefined>> | undefined)?.[path]
  const keyed = (track?.length ?? 0) > 0
  // Only a keyed value's look follows the playhead; an unkeyed one reads the clock on click.
  const clockMs = useKeyClockMs(keyed)
  if (!isKeyablePath(path) || !take?.setKeys || !doc) return null
  const disabled = KEY_DISABLED[path]
  const on = keyAt(track, clockMs)
  const meta = styleKeyMeta(path)
  const name = meta ? `${meta.family.label} ${meta.label.toLowerCase()}` : path
  const look = disabled ? "disabled" : !keyed ? "none" : on >= 0 ? "on" : "off"
  const label = disabled
    ? `${name} cannot be keyed: ${disabled}`
    : look === "on"
      ? `Remove the ${name} key at the playhead`
      : `Add a ${name} key at the playhead`
  const click = () => {
    if (disabled || !take.setKeys) return
    if (on >= 0) {
      const rest = track!.filter((_, i) => i !== on)
      take.setKeys(compactKeys({ ...(take.keys ?? {}), [path]: rest }), null)
      return
    }
    const v = readPath(doc.styleState, path)
    if (!Number.isFinite(v)) return
    take.setKeys(withKeyAt(take.keys, path, readKeyClock(store), v), null)
  }
  return (
    <button
      type="button"
      data-key-button={path}
      data-key-look={look}
      aria-label={label}
      aria-pressed={look === "on"}
      title={label}
      disabled={!!disabled}
      onClick={click}
      /* A square hit box: a rounded corner is not hit, so the hover plate
         inside carries the rounding. */
      className={`fs-press group/key inline-flex h-6 w-6 shrink-0 items-center justify-center align-middle text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 ${className}`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-[3px] transition-colors group-hover/key:bg-foreground/10 group-disabled/key:bg-transparent">
        <span aria-hidden="true" className="relative block h-[8.5px] w-[8.5px] rotate-45">
          <span
            data-key-mark
            className={`absolute inset-0 rounded-[1px] border ${
              look === "on" ? "border-foreground bg-foreground" : look === "off" ? "border-foreground" : "border-current"
            }`}
          />
          {look === "off" && (
            <span className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
          )}
        </span>
      </span>
    </button>
  )
}

/** Gap from the label's text to the diamond: 8 px, as the edited mark sits. */
const SPOT_GAP = 8
const BUTTON = 24
const DIAMOND = 12

/** The label a slider's key button follows: the first <label> holding a range
 *  input, and in it the first span with text of its own. */
function sliderLabelOf(box: HTMLElement): HTMLElement | null {
  const label = [...box.querySelectorAll("label")].find((l) => l.querySelector('input[type="range"]'))
  if (!label) return null
  for (const s of label.querySelectorAll<HTMLElement>("span")) {
    if (s.closest("button, select, option")) continue
    for (const n of s.childNodes) if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) return s
  }
  return null
}

function keySpot(box: HTMLElement): { left: number; top: number } | null {
  const label = sliderLabelOf(box)
  if (!label) return null
  const range = document.createRange()
  range.selectNodeContents(label)
  const rects = [...range.getClientRects()].filter((r) => r.width > 0)
  if (!rects.length) return null
  const lastTop = Math.max(...rects.map((r) => r.top))
  const line = rects.filter((r) => r.top > lastTop - 4)
  const b = box.getBoundingClientRect()
  const right = Math.max(...line.map((r) => r.right)) - b.left
  const mid = (Math.min(...line.map((r) => r.top)) + Math.max(...line.map((r) => r.bottom))) / 2 - b.top
  // The diamond, not the hit box, starts SPOT_GAP after the text.
  const left = right + SPOT_GAP - (BUTTON - DIAMOND) / 2
  return { left: Math.round(Math.min(left, b.width - BUTTON)), top: Math.round(mid - BUTTON / 2) }
}

/**
 * A slider with its key button: the button sits after the slider's label text,
 * a sibling of the <label> (inside it, the button would become the control
 * the label names). Measured again on every render, as the value in the label
 * changes width while the slider moves, and when the field resizes. With no
 * keyed context (Customize, a page with no doc) it renders the slider alone.
 */
export function KeySpot({ path, children }: { path: string; children: ReactNode }) {
  const doc = useContext(KeyStyleCtx)
  const take = useStrokeTake()
  const live = !!doc && !!take?.setKeys && isKeyablePath(path)
  const boxRef = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null)
  const place = () => {
    const next = boxRef.current ? keySpot(boxRef.current) : null
    setSpot((prev) => (prev === next || (prev && next && prev.left === next.left && prev.top === next.top) ? prev : next))
  }
  useLayoutEffect(() => {
    if (live) place()
  })
  useEffect(() => {
    const box = boxRef.current
    if (!live || !box || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => place())
    ro.observe(box)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live])
  if (!live) return <>{children}</>
  return (
    <div ref={boxRef} className="relative" data-key-spot={path}>
      {children}
      {spot && (
        <span className="absolute z-10 flex" style={spot}>
          <KeyButton path={path} />
        </span>
      )}
    </div>
  )
}

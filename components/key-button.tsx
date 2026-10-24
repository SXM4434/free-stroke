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
import { keyClockMs, useTakeTransport } from "@/lib/take-transport"
import {
  ENVELOPE_KEY_PATHS,
  KEYABLE_PATHS,
  KEY_DISABLED,
  envelopeRangeOf,
  envelopeValueAt,
  framedKeys,
  isKeyed,
  styleAt,
  type EnvelopeKeyPath,
  type EnvelopeKeyablePath,
  type StyleKeyPath,
  type TakeKeys,
  type Track,
} from "@/lib/keyframes"
import { KEY_UI_MUTANT, styleKeyMeta } from "@/lib/style-key-meta"
import type { StyleState } from "@/lib/style-system"
import { hasStyleKeys, keyAt, readPath, refusalWords, withKeyAt, withoutKeyAt, type KeyRefusal } from "@/lib/key-edit"

/* The pure key edits live in lib/key-edit.ts (a Node gate runs them); the
 * names this file always exported stay exported from here. */
export { KEY_ON_FRAME_MS, hasStyleKeys, keyAt, keyedStyleEdit, readPath, withKeyAt } from "@/lib/key-edit"

/* The style values and, since CL-EXTRAKEYS, the three draw-in extras
 * (`ENVELOPE_KEY_PATHS`), so the panel's Field wraps an extra's slider in a
 * key button exactly as it wraps a style slider. */
const KEYABLE = new Set<string>([...KEYABLE_PATHS.map((p) => p.path), ...ENVELOPE_KEY_PATHS.map((p) => p.path)])
export const isKeyablePath = (p: string): p is StyleKeyPath | EnvelopeKeyPath => KEYABLE.has(p)

/** The draw-in extras as they show at the playhead, for the key buttons of
 *  `ENVELOPE_KEY_PATHS` (CL-EXTRAKEYS). The draw-in controls provide it;
 *  absent, an extra draws no key button. */
export type KeyedExtras = Readonly<Record<EnvelopeKeyablePath["field"], number>>
export const KeyEnvelopeCtx = createContext<KeyedExtras | null>(null)

/** The value a key button keys: a draw-in extra from the envelope context, a
 *  style value from the style context; null when its context is absent. */
function keyedValueOf(path: string, styleCtx: { styleState: StyleState } | null, envCtx: KeyedExtras | null): number | null {
  const env = envelopeRangeOf(path)
  if (env) return envCtx ? envCtx[env.field] : null
  return styleCtx ? readPath(styleCtx.styleState, path) : null
}

/* ---- WHY A KEY WAS REFUSED (REVIEW 1 finding 5) ----------------------------
 * A refused key used to do nothing and say nothing. The reason now shows in
 * words beside the diamond of the path it belongs to, whether the refusal came
 * from the diamond itself or from an edit on a keyed value (a preset moving
 * several at once names each path it could not key). One line per path, in a
 * page-wide store so the page's style setter can report into it. It clears on
 * the next key that path takes, or after `REFUSAL_MS`. */
export const REFUSAL_MS = 6000
const refusals = new Map<string, { words: string; at: number }>()
const refusalSubs = new Set<() => void>()
const refusalTimers = new Map<string, ReturnType<typeof setTimeout>>()
function notifyRefusals() {
  refusalSubs.forEach((fn) => fn())
}
export function reportKeyRefusal(path: string, words: string | null) {
  const t = refusalTimers.get(path)
  if (t) clearTimeout(t)
  refusalTimers.delete(path)
  if (words === null) {
    if (!refusals.delete(path)) return
  } else {
    refusals.set(path, { words, at: Date.now() })
    refusalTimers.set(
      path,
      setTimeout(() => {
        refusalTimers.delete(path)
        if (refusals.delete(path)) notifyRefusals()
      }, REFUSAL_MS),
    )
  }
  notifyRefusals()
}
/** Every refusal in one edit, each on its own path. */
export function reportEditRefusals(refused: readonly KeyRefusal[]) {
  for (const r of refused) reportKeyRefusal(r.path, refusalWords("edit", r.reasons))
}
function useKeyRefusal(path: string): string | null {
  const sub = useCallback((fn: () => void) => {
    refusalSubs.add(fn)
    return () => {
      refusalSubs.delete(fn)
    }
  }, [])
  const read = useCallback(() => refusals.get(path)?.words ?? null, [path])
  return useSyncExternalStore(sub, read, () => null)
}
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  ;(window as unknown as { __fsKeyRefusals?: unknown }).__fsKeyRefusals = () => Object.fromEntries([...refusals].map(([p, r]) => [p, r.words]))
}

/** The Style panel's keyed context: the style as it shows at the playhead
 *  (each keyed value sampled, `styleAt`). Absent, no key button draws. */
export const KeyStyleCtx = createContext<{ styleState: StyleState } | null>(null)

/** The key clock the frame loop samples: the frame loop's own playhead times
 *  the keyed length (`keyClockMs`, lib/take-transport.ts; `makeKeyReader` in
 *  components/viewport-3d.tsx). Not the throttled readout, which trails it
 *  (REVIEW 1 finding 7). `__fsKeyMutant = "readout"` is the gate's must-fail
 *  arm: the readout, as before. */
function readKeyClock(store: ReturnType<typeof useTakeTransport>): number {
  if (KEY_UI_MUTANT === "readout") return store ? store.progress.get() * (store.derived()?.totalDuration ?? 0) : 0
  return keyClockMs(store)
}

/** The key clock, as state. Re-rendered by the throttled progress readout, so
 *  a reader renders about 15 times a second while playing, not every frame,
 *  and reads the frame loop's playhead each time; and only while `on`
 *  (something is keyed), so an unkeyed panel never re-renders for the
 *  playhead. */
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

export function KeyButton({ path, className = "", room }: { path: string; className?: string; room?: number }) {
  const take = useStrokeTake()
  const store = useTakeTransport()
  const doc = useContext(KeyStyleCtx)
  const envCtx = useContext(KeyEnvelopeCtx)
  const shownValue = keyedValueOf(path, doc, envCtx)
  const track = (take?.keys as Readonly<Record<string, Track | undefined>> | undefined)?.[path]
  const keyed = (track?.length ?? 0) > 0
  // Only a keyed value's look follows the playhead; an unkeyed one reads the clock on click.
  const clockMs = useKeyClockMs(keyed)
  const refusal = useKeyRefusal(path)
  if (!isKeyablePath(path) || !take?.setKeys || shownValue === null) return null
  const disabled = KEY_DISABLED[path]
  const on = keyAt(track, clockMs)
  const meta = styleKeyMeta(path)
  const name = meta ? `${meta.family.label} ${meta.label.toLowerCase()}` : envelopeRangeOf(path)?.label ?? path
  const look = disabled ? "disabled" : !keyed ? "none" : on >= 0 ? "on" : "off"
  const label = disabled
    ? `${name} cannot be keyed: ${disabled}`
    : look === "on"
      ? `Remove the ${name} key at the playhead`
      : `Add a ${name} key at the playhead`
  const click = () => {
    if (disabled || !take.setKeys) return
    /* The playhead the click keys at is read now, from the frame loop's own
     * number, not the one this render saw. */
    const now = readKeyClock(store)
    const at = keyAt(track, now)
    if (at >= 0) {
      const bad = take.setKeys(withoutKeyAt(take.keys, path, now), null)
      reportKeyRefusal(path, bad.length ? refusalWords("remove", bad) : null)
      return
    }
    let v = shownValue
    if (path === "envelope.durationSeconds" && v === 0) {
      // Off means "as drawn". Key the length the take is playing now, so
      // the first diamond click keeps that timing instead of refusing 0.
      const durationMs = store?.derived()?.totalDuration
      if (!durationMs || !Number.isFinite(durationMs)) {
        reportKeyRefusal(path, "Draw something before keying Duration")
        return
      }
      const range = envelopeRangeOf(path)!
      v = Math.min(range.max, Math.max(range.min, durationMs / 1000))
    }
    if (!Number.isFinite(v)) {
      reportKeyRefusal(path, "Not keyed: this value has no number to key")
      return
    }
    const bad = take.setKeys(withKeyAt(take.keys, path, now, v), null)
    reportKeyRefusal(path, bad.length ? refusalWords("add", bad) : null)
  }
  const refusalId = `key-refusal-${path.replace(/\./g, "-")}`
  return (
    <>
    <button
      type="button"
      aria-describedby={refusal ? refusalId : undefined}
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
    {refusal && KEY_UI_MUTANT !== "silentrefusal" && (
      /* WHY THE KEY WAS REFUSED, in words beside the diamond (finding 5). */
      <span
        id={refusalId}
        role="status"
        data-key-refusal={path}
        style={room !== undefined ? { maxWidth: Math.max(96, room) } : undefined}
        className="ml-1 self-center rounded-[3px] bg-background/95 px-1.5 py-0.5 text-[11px] leading-4 text-destructive shadow-sm"
      >
        {refusal}
      </span>
    )}
    </>
  )
}

/**
 * THE DRAW-IN EXTRAS' KEYED VIEW (CL-EXTRAKEYS). `shown` is each extra as it
 * plays at the playhead: the lane's sample where the lane holds keys, the
 * envelope's own value where it does not. `keyEdit` keys a slider's new value
 * at the playhead while its lane holds keys, as a keyed style slider does
 * (`keyedStyleEdit`), and returns false when the lane is empty, so the caller
 * writes the envelope as before. Unkeyed, `shown` is the same values and no
 * render follows the playhead.
 */
export function useKeyedEnvelope(envelope: KeyedExtras): { shown: KeyedExtras; keyEdit: (field: EnvelopeKeyablePath["field"], v: number) => boolean } {
  const take = useStrokeTake()
  const store = useTakeTransport()
  const keys = take?.keys
  const keyed = ENVELOPE_KEY_PATHS.some((p) => isKeyed(keys, p.path))
  const clockMs = useKeyClockMs(keyed)
  const { tipHighlight, pressureReveal, durationSeconds } = envelope
  const shown = useMemo(
    () =>
      keyed
        ? {
            tipHighlight: envelopeValueAt("tipHighlight", tipHighlight, keys, clockMs),
            pressureReveal: envelopeValueAt("pressureReveal", pressureReveal, keys, clockMs),
            durationSeconds: envelopeValueAt("durationSeconds", durationSeconds, keys, clockMs),
          }
        : { tipHighlight, pressureReveal, durationSeconds },
    [keyed, keys, clockMs, tipHighlight, pressureReveal, durationSeconds],
  )
  const keyEdit = (field: EnvelopeKeyablePath["field"], v: number) => {
    const path = ENVELOPE_KEY_PATHS.find((p) => p.field === field)!.path
    if (!take?.setKeys || !isKeyed(take.keys, path)) return false
    const bad = take.setKeys(withKeyAt(take.keys, path, readKeyClock(store), v), null)
    reportKeyRefusal(path, bad.length ? refusalWords("add", bad) : null)
    return true
  }
  return { shown, keyEdit }
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

function keySpot(box: HTMLElement): { left: number; top: number; room: number } | null {
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
  const at = Math.round(Math.min(left, b.width - BUTTON))
  // The width left after the button, for a refusal's words beside it.
  return { left: at, top: Math.round(mid - BUTTON / 2), room: Math.round(b.width - at - BUTTON - 4) }
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
  const envCtx = useContext(KeyEnvelopeCtx)
  const take = useStrokeTake()
  const live = (envelopeRangeOf(path) ? !!envCtx : !!doc) && !!take?.setKeys && isKeyablePath(path)
  const boxRef = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState<{ left: number; top: number; room: number } | null>(null)
  const place = () => {
    const next = boxRef.current ? keySpot(boxRef.current) : null
    setSpot((prev) => (prev === next || (prev && next && prev.left === next.left && prev.top === next.top && prev.room === next.room) ? prev : next))
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
      <span className="absolute z-10 flex" style={spot ? { left: spot.left, top: spot.top } : { right: 0, top: 0 }}>
        <KeyButton path={path} room={spot?.room} />
      </span>
    </div>
  )
}

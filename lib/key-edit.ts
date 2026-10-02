/* ==================================================================
   KEY EDITS, PURE (REVIEW 1 finding 5). What a key button click and an
   edit on a keyed value write into the keys, and, when a key is refused,
   why, in words a person reads beside the diamond.

   Moved out of components/key-button.tsx so a Node gate can run it
   (scripts/verify/assert-keyed-playback.mjs); the button re-exports it.

   A REFUSED PATH NEVER TAKES THE OTHERS WITH IT. An edit that moves several
   keyed values at once (a preset) keys each path on its own: a path whose
   new key `validateTrack` refuses keeps its track as it was and is named in
   `refused` with its reasons, and every other path still gets its key.
   ================================================================== */

import {
  KEYABLE_PATHS,
  KEY_DISABLED,
  compactKeys,
  framedKeys,
  makeKey,
  styleAt,
  validateTrack,
  type StyleKeyPath,
  type TakeKeys,
  type Track,
} from "@/lib/keyframes"
import { KEY_UI_MUTANT } from "@/lib/style-key-meta"
import type { StyleState } from "@/lib/style-system"

/** How close in ms a key counts as "on this frame": half a 60 fps frame. */
export const KEY_ON_FRAME_MS = 1000 / 120

export function readPath(state: StyleState, path: string): number {
  let o: unknown = state
  for (const part of path.split(".")) o = (o as Record<string, unknown>)?.[part]
  return typeof o === "number" ? o : Number.NaN
}

/** True when any style path holds a key. */
export function hasStyleKeys(keys: TakeKeys | undefined): boolean {
  return !!keys && KEYABLE_PATHS.some((p) => ((keys[p.path] as Track | undefined)?.length ?? 0) > 0)
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

/** `keys` with the key under the playhead on `path` taken away; the last one taken removes the lane. */
export function withoutKeyAt(keys: TakeKeys | undefined, path: StyleKeyPath, clockMs: number): TakeKeys | undefined {
  const track = (keys?.[path] as Track | undefined) ?? []
  const at = keyAt(track, clockMs)
  if (at < 0) return keys
  return compactKeys({ ...(keys ?? {}), [path]: track.filter((_, i) => i !== at) })
}

export interface KeyRefusal {
  path: StyleKeyPath
  /** `validateTrack`'s reasons, as the validator wrote them. */
  reasons: string[]
}

export interface KeyedEdit {
  /** The keys after the edit: every path that could be keyed, keyed. */
  keys: TakeKeys | undefined
  /** The paths whose key was refused, each kept as it was. */
  refused: KeyRefusal[]
}

/**
 * EDITING A KEYED VALUE WRITES A KEY AT THE PLAYHEAD (BUILD-PLAN.md §4, After
 * Effects' rule once the stopwatch is on). Otherwise the next frame's sample
 * overwrites the edit and the slider looks broken. `prev` and `next` are the
 * doc's style before and after an edit; the result has a key at `clockMs` for
 * each keyed path the edit moved, or is null when it moved none. A path whose
 * new value is the one already showing there (a whole-state write that
 * carried a sampled value along) is left alone, and so is a path no key
 * drives. Each path is checked on its own, so a refused one never drops the
 * keys of the others in the same edit.
 */
export function keyedStyleEdit(prev: StyleState, next: StyleState, keys: TakeKeys | undefined, clockMs: number): KeyedEdit | null {
  if (!hasStyleKeys(keys) || KEY_UI_MUTANT === "noeditkey") return null
  const framed = framedKeys(keys)
  const shown = styleAt(prev, framed, clockMs)
  let out: TakeKeys | null = null
  const refused: KeyRefusal[] = []
  for (const { path } of KEYABLE_PATHS) {
    if (KEY_DISABLED[path] || !((keys?.[path] as Track | undefined)?.length)) continue
    const nv = readPath(next, path)
    if (!Number.isFinite(nv) || nv === readPath(prev, path)) continue
    if (Math.abs(nv - readPath(shown, path)) < 1e-9) continue
    const tried = withKeyAt(out ?? keys, path, clockMs, nv)
    const bad = validateTrack(tried[path], path)
    if (bad.length) {
      if (KEY_UI_MUTANT === "dropall") return { keys, refused: [{ path, reasons: bad }] }
      refused.push({ path, reasons: bad })
      continue
    }
    out = tried
  }
  if (!out && refused.length === 0) return null
  return { keys: out ? compactKeys(out) : keys, refused }
}

const num = (s: string) => {
  const n = Number(s)
  return Number.isFinite(n) ? String(+n.toFixed(3)) : s
}

/**
 * WHY A KEY WAS REFUSED, IN WORDS, for the line beside the diamond. `action`
 * is what the click tried: "add" a key, "remove" one, or "edit" a keyed value.
 * Reads the validator's own reasons, so a reason it gives that this does not
 * know still shows, as it was written.
 */
export function refusalWords(action: "add" | "remove" | "edit", reasons: readonly string[]): string {
  const verb = action === "remove" ? "Not removed" : "Not keyed"
  for (const r of reasons) {
    const range = / (-?[\d.e+-]+) is outside (-?[\d.e+-]+)\.\.(-?[\d.e+-]+)/.exec(r)
    if (range) return `${verb}: ${num(range[1])} is outside ${num(range[2])} to ${num(range[3])}`
    const swing = /the curve swings to (-?[\d.e+-]+) between them, outside (-?[\d.e+-]+)\.\.(-?[\d.e+-]+)/.exec(r)
    if (swing) {
      return action === "remove"
        ? `${verb}: without this key the curve would swing to ${num(swing[1])}, outside ${num(swing[2])} to ${num(swing[3])}`
        : `${verb}: the curve would swing to ${num(swing[1])}, outside ${num(swing[2])} to ${num(swing[3])}`
    }
  }
  return reasons.length ? `${verb}: ${reasons[0]}` : verb
}

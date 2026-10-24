// The hero frame set and the geometry signature, one copy for bench.mjs and
// assert-width-keys.mjs. assert-width-keys checks that its own shipped Solid
// signatures equal `bench.mjs --input=hero --sigs=` 120 of 120, so both must read
// the hero, the frames and the signature from here.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const REPO = fileURLToPath(new URL("../../../", import.meta.url))

/** The hero word, scripts/capture/logo-strokes.json, fitted to 90 % of the harness canvas. */
export function heroPolys(CW, CH) {
  const raw = JSON.parse(readFileSync(REPO + "scripts/capture/logo-strokes.json", "utf8"))
  const k = (CW * 0.9) / raw.width
  const ox = (CW - raw.width * k) / 2, oy = (CH - raw.height * k) / 2
  return raw.polylines.map((pl) => pl.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k })))
}

/** What Scene passes from the first frame of play: ANIMATION_GATED, nothing active yet. */
export const HS_GATED = { mode: "ANIMATION_GATED", activeFinalHolesWorld: [] }

/** Frame f of n is the reveal at f / (n + 1), f = 1..n: never empty, never complete. */
export const heroProgress = (f, n) => f / (n + 1)

/* Folds any typed array into the running FNV hash. Floats by their bits, so -0
 * and 0 and two NaN payloads differ; integers (an index buffer) by value. */
function fold(h, arr) {
  const u = arr instanceof Float32Array || arr instanceof Float64Array ? new Uint32Array(arr.buffer, arr.byteOffset, arr.byteLength / 4) : arr
  for (let i = 0; i < u.length; i++) h = Math.imul(h ^ (u[i] >>> 0), 16777619) >>> 0
  return h
}
const foldStr = (h, str) => {
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0
  return h
}

/* 2026-09-25: the signature hashed the position buffer alone, so one triangle's
 * winding reversed in the index, a flipped normal, or a mesh with no position
 * attribute all gave the same signature. It now folds, per mesh and in order:
 * the mesh's own fields (key, mode, solidStatus, filteredCount), every attribute
 * by sorted name with its itemSize, normalized flag and every element, the index
 * buffer, groups, drawRange and morph attributes. A mesh with no geometry is
 * folded as the word NOGEO rather than skipped. The prefix is still the position
 * vertex count and the tail still ends in `cen=` when there is no centroid.
 *
 * `sd` is Solid's `SOLID_DEBUG.lastStages.solidDiagnostics` (pass `{}` when it is
 * missing). Pass `null` for the other three engines: SOLID_DEBUG then holds the
 * last Solid build, not this one, so the tail is left off rather than stale. */
export function sig(meshes, sd) {
  let n = 0, h = 2166136261 >>> 0
  h = foldStr(h, `meshes=${meshes.length}`)
  for (const m of meshes) {
    h = foldStr(h, `|${m.key}|${m.mode}|${m.solidStatus}|${m.filteredCount}`)
    const g = m.tubeGeometry
    if (!g) {
      h = foldStr(h, "NOGEO")
      continue
    }
    n += g.getAttribute("position")?.count ?? 0
    for (const name of Object.keys(g.attributes).sort()) {
      const a = g.attributes[name]
      h = foldStr(h, `a:${name}:${a.itemSize}:${!!a.normalized}:${a.count}`)
      h = fold(h, a.array)
    }
    if (g.index) {
      h = foldStr(h, `i:${g.index.count}`)
      h = fold(h, g.index.array)
    } else h = foldStr(h, "i:none")
    h = foldStr(h, `g:${JSON.stringify(g.groups ?? [])}|d:${g.drawRange?.start},${g.drawRange?.count}`)
    for (const name of Object.keys(g.morphAttributes ?? {}).sort())
      for (const a of g.morphAttributes[name]) h = fold(foldStr(h, `m:${name}`), a.array)
  }
  if (sd === null) return `${n}:${h.toString(16)}`
  const cen = (sd.detectedPartialHoleCentroidsWorld ?? []).map((c) => `${c.x.toFixed(5)},${c.y.toFixed(5)},${c.areaPx}`).join(";")
  return `${n}:${h.toString(16)}|valid=${sd.validHoleCount}|cen=${cen}`
}

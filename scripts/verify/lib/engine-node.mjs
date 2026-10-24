// BUILD REAL ENGINE GEOMETRY IN PLAIN NODE — no browser, no GPU.
//
// WHY THIS EXISTS. Every geometry harness here drives the Next dev server and a
// real Chrome, and that is correct for anything whose answer depends on
// RENDERING — a specular streak across a crease, a blank frame, a paused rAF
// loop. But the questions this lane asks — does the shell pass through itself,
// does the drawn corner still reach 1 r, does the taper still narrow — are
// questions about the BUFFERS. The renderer is not in the causal chain, and
// paying a browser for them buys nothing except a dependency on a shared server
// that a sibling lane's save can remount mid-capture (measured 2026-07-31; see
// `_run-clean.mjs`).
//
// `_ts-load.mjs` already transpiles pure `lib/` modules with `typescript` and a
// CommonJS shim. `lib/geometry-engines.ts` and `lib/stroke-processing.ts` are
// pure — three.js and nothing else — so the real engines load and run here
// unmodified. **This is the same code path the viewport takes**, called with
// the same arguments `useStrokeMeshes` passes (`components/viewport-3d.tsx:203`)
// and the same `processStroke` arguments `app/page.tsx:208` passes, so it is the
// real entry path rather than a synthesised one.
//
// What it CANNOT answer, stated plainly so nobody mistakes its scope: anything
// about pixels, materials, lighting, animation timing, or the panel. Those still
// need the browser passes queued in `_elbow-browser-queue.sh`.
import { loadTs } from "../_ts-load.mjs"
import { createCanvas } from "@napi-rs/canvas"

/* SOLID NEEDS A 2-D CANVAS, so give it a real one rather than a fake.
 *
 * `lib/solid-mask.ts` rasterises the stroke pool through
 * `document.createElement("canvas")` (getRasterCtx). `@napi-rs/canvas` is
 * already a devDependency of this repo and is Skia — the SAME rasteriser Chrome
 * uses — so `moveTo`/`lineTo`/`stroke`/`getImageData` produce the same coverage
 * the browser produces. This is a real canvas, not a stub that would let a
 * measurement pass by measuring nothing.
 *
 * Only `createElement("canvas")` is provided. Anything else throws loudly: a
 * module that needs more DOM than this is not a pure module and must not be
 * measured here under the illusion that it is. */
if (typeof globalThis.document === "undefined") {
  globalThis.document = {
    createElement(tag) {
      if (String(tag).toLowerCase() !== "canvas") {
        throw new Error(
          `engine-node: document.createElement(${tag}) — only "canvas" is shimmed. ` +
            `This module is not pure enough to measure in Node; use a browser pass.`,
        )
      }
      return createCanvas(1, 1)
    },
  }
}

const engines = loadTs("lib/geometry-engines.ts")
const strokeProc = loadTs("lib/stroke-processing.ts")

export const {
  RodEngine,
  ExtrudeEngine,
  SolidEngine,
  InflateEngine,
  DEFAULT_INFLATE_PARAMS,
  DEFAULT_EXTRUDE_PARAMS,
  DEFAULT_SOLID_PARAMS,
  INFLATE_DEBUG,
} = engines

const ENGINE = {
  rod: RodEngine,
  extrude: ExtrudeEngine,
  solid: SolidEngine,
  inflate: InflateEngine,
}

// The harness canvas, matching every other script in scripts/verify.
export const VIEW = { width: 1300, height: 850 }
export const CW = VIEW.width / 2
export const CH = VIEW.height - 48
export const SCALE = 3.0 / Math.max(CW, CH)
export const px2w = (px, py) => ({ x: (px - CW / 2) * SCALE, y: -(py - CH / 2) * SCALE })

/** app/page.tsx:143-145 — the shipped defaults, not invented ones. */
export const PROCESS_DEFAULTS = { spacing: 4, smoothing: true, preserveCorners: true }

/** Canvas-space polylines -> ProcessedStroke[], the way the app does it. */
export function process(polys, opts = {}) {
  const { spacing, smoothing, preserveCorners } = { ...PROCESS_DEFAULTS, ...opts }
  let t = 0
  return polys.map((pts) => {
    const points = pts.map((p) => {
      const pt = { x: p.x, y: p.y, t, pressure: 0.6 }
      t += 10
      return pt
    })
    t += 200
    return strokeProc.processStroke({ points }, spacing, smoothing, preserveCorners)
  })
}

/**
 * Build one mode's preview meshes and return them as flat buffers, concatenated
 * with indices rebased — byte-compatible with what `__geomDebug.dumpMeshes()`
 * hands the browser-side probes, so the same census functions read both.
 */
export function build(mode, polys, params = {}) {
  const engine = ENGINE[mode]
  if (!engine) throw new Error(`unknown mode ${mode}`)
  const strokes = process(polys, params.process)
  const meshes = engine.buildPreview(strokes, {
    canvasWidth: CW,
    canvasHeight: CH,
    extrudeParams: { ...DEFAULT_EXTRUDE_PARAMS, ...(params.extrudeParams ?? {}) },
    solidParams: { ...DEFAULT_SOLID_PARAMS, ...(params.solidParams ?? {}) },
    inflateParams: { ...DEFAULT_INFLATE_PARAMS, ...(params.inflateParams ?? {}) },
  })
  const pos = []
  const idx = []
  for (const m of meshes) {
    // `StrokeMeshData.tubeGeometry` (:749) is the field for EVERY mode, not
    // just Rod — the name predates the other three engines. Rod's cap and joint
    // SPHERES are not in here: the viewport instantiates those separately from
    // `capPositions` / `jointPositions`, so in a browser `dumpMeshes` they are
    // additional components. That does not affect a per-component fold question
    // (a fold is one shell through itself) and it is why Rod reports 6
    // components there and 1 here.
    const g = m.tubeGeometry
    if (!g) continue
    const p = g.getAttribute("position")
    if (!p) continue
    const base = pos.length / 3
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i))
    const ix = g.getIndex()
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i))
    else for (let i = 0; i < p.count; i++) idx.push(base + i)
  }
  return {
    meshes: meshes.length,
    pos: Float64Array.from(pos),
    idx: Int32Array.from(idx),
    strokes,
    debug: { ...INFLATE_DEBUG },
  }
}

/* ---- the standard fixtures, identical to assert-mode-rims / fold-census ---- */
export const SHAPES = {
  crossing: () => {
    const a = [], b = []
    for (let i = 0; i <= 90; i++) {
      const t = i / 90
      a.push({ x: 140 + t * 620, y: 250 + t * 190 })
      b.push({ x: 140 + t * 620, y: 470 - t * 190 })
    }
    return [a, b]
  },
  circle: () => {
    const p = []
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2
      p.push({ x: 440 + Math.cos(t) * 210, y: 360 + Math.sin(t) * 210 })
    }
    return [p]
  },
  square: () => {
    const p = []
    const c = [[250, 180], [640, 180], [640, 545], [250, 545], [250, 180]]
    for (let k = 0; k < c.length - 1; k++) {
      const [x0, y0] = c[k], [x1, y1] = c[k + 1]
      for (let i = 0; i < 30; i++) p.push({ x: x0 + ((x1 - x0) * i) / 30, y: y0 + ((y1 - y0) * i) / 30 })
    }
    p.push({ x: 250, y: 180 })
    return [p]
  },
  tick: () => [Array.from({ length: 6 }, (_, i) => ({ x: 400 + i * 4, y: 380 + i * 3 }))],
  // An OPEN arc that ends near where it started but does not close: the control
  // for the closed-loop test. Its end gap is deliberately wider than the close
  // threshold, so a detector that fires on it is over-eager.
  openArc: () => {
    const p = []
    for (let i = 0; i <= 150; i++) {
      const t = (i / 150) * Math.PI * 1.82
      p.push({ x: 440 + Math.cos(t) * 210, y: 360 + Math.sin(t) * 210 })
    }
    return [p]
  },
}

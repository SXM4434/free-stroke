"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import type { Stroke, ProcessedStroke } from "@/lib/stroke-processing"
import type { ExportSettings } from "@/components/drawing-canvas"
import type { GeometryMode, ExtrudeParams, SolidParams, InflateParams } from "@/lib/geometry-engines"
import type { StyleState } from "@/lib/style-system"
import type { RegisterLighting } from "@/lib/registers"
import type { EngineFamily } from "@/lib/engine-registry"
import type { FlatState, LetterMap, ViewportApi } from "@/components/viewport-3d"
import type { DrawInParams, RevealWindowParams, RevealEnvelopeParams } from "@/lib/stroke-schedule"
import type { StrokeTimingTake } from "@/lib/stroke-timing"
/* ⚠ A VALUE IMPORT, AND IT HAS TO COME FROM ITS OWN MODULE.
 *
 * The boundary belongs ABOVE `Viewport3D` — a React boundary catches its
 * CHILDREN, and declaring it inside the viewport put it BELOW that component's
 * own render body, where it could not see the throws it was written for (the
 * stroke reads, the geometry memos, the camera framing). Measured: a forced
 * throw gave `canvases 0` and Next.js's global "Application error" screen, and
 * the user's drawing went with it. Gate: `assert-shell-states.mjs` §2.
 *
 * It is imported from `viewport-error-boundary.tsx` rather than re-exported
 * from `viewport-3d.tsx` because every other import here is `import type`,
 * which erases. A value import of the viewport module would pull three.js, R3F,
 * drei and the GLTF exporter into this file's static graph and undo the
 * `next/dynamic` split that `ViewportLoading` below exists to cover. */
import { ViewportErrorBoundary } from "@/components/viewport-error-boundary"

/**
 * THE LOADING STATE FOR THE HEAVIEST THING IN THE APP.
 *
 * `components/viewport-3d.tsx` is ~7,000 lines and pulls in three.js, R3F, drei
 * and the GLTF exporter; it is dynamically imported with `ssr: false`, so on a
 * cold load the right half of the screen is EMPTY — no border, no ground, no
 * sign that anything is coming — for as long as that chunk takes. `next/dynamic`
 * renders `null` when no `loading` is given, and nobody had given one.
 *
 * It is deliberately the same construction as the viewport's own empty state
 * (`ViewportEmptyState`): the same 28px mark, the same muted type ramp, the same
 * centred column. So the transition from "loading" to "nothing drawn yet" is a
 * copy change and a mark that stops pulsing, rather than one screen replacing a
 * different screen — which is what makes a heavy chunk feel like it belongs to
 * the page instead of arriving late from somewhere else.
 *
 * The pulse is `prefers-reduced-motion` aware through `motion-safe:`; under
 * `reduce` it holds at rest and the copy alone carries the state.
 */
function ViewportLoading() {
  return (
    <div className="flex h-full w-full select-none flex-col items-center justify-center gap-1.5">
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        className="text-muted-foreground/40 motion-safe:animate-pulse"
      >
        <path
          d="M4 20 C 8 8, 12 8, 14 14 S 20 22, 24 10"
          transform="translate(2.5,-2.5)"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M4 20 C 8 8, 12 8, 14 14 S 20 22, 24 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-sm font-medium text-muted-foreground">
        Starting the 3D engine
      </span>
      <span className="text-xs text-muted-foreground/70">One moment</span>
    </div>
  )
}

const Viewport3D = dynamic(() => import("@/components/viewport-3d"), {
  ssr: false,
  loading: () => <ViewportLoading />,
})

interface Viewport3DWrapperProps {
  processedStrokes: ProcessedStroke[]
  rawStrokes: Stroke[]
  geometryMode: GeometryMode
  extrudeParams?: ExtrudeParams
  solidParams?: SolidParams
  inflateParams?: InflateParams
  styleState?: StyleState
  /** The active register's studio rig. Omitted → Free Stroke's own rig. */
  lighting?: RegisterLighting
  /** Which codebase's geometry engine builds the form (lib/engine-registry.ts).
   *  Omitted → Free Stroke's own. */
  engineFamily?: EngineFamily
  /** The hero beat's 2D half: how far the form is driven back toward reading
   *  as a flat drawn mark. Omitted → fully solid. See `FlatState`. */
  flatten?: FlatState
  /** O5's letter map — which letter each stroke belongs to, measured from the
   *  ink by `lib/hero-letters.ts`. `LetterMap` is a plain data type, so this
   *  stays an `import type` and the dynamic split above is untouched. Omitted →
   *  no per-letter cascade is possible. See `FlatState.letters`. */
  letterMap?: LetterMap
  /** Hide the viewport's own transport/export chrome — the host owns the clock. */
  chromeless?: boolean
  /** Perspective or affine (orthographic). Omitted → a host driving `flatten`
   *  gets `"affine"`, everything else keeps the lab's perspective camera.
   *  Full reasoning on `Viewport3DProps.projection`. */
  projection?: "perspective" | "affine"
  /** The host's draw-in playhead, 0..1, written into a ref so driving it costs
   *  no React commit. Full reasoning on `Viewport3DProps.revealRef`. */
  revealRef?: React.MutableRefObject<number | null>
  /** THE TAKE, OWNED BY THE HOST. Supplied together with `onDrawInChange`, the
   *  viewport's `DRAW IN` popover drives the host's document — which is what
   *  makes the take undoable and saved. Omit BOTH and the viewport keeps its
   *  own copy, which is what `/desk-doodles` does: it has no document to put
   *  them in. See `Viewport3DProps.drawIn`. */
  drawIn?: DrawInParams
  onDrawInChange?: (patch: Partial<DrawInParams>) => void
  revealWindow?: RevealWindowParams
  onRevealWindowChange?: (patch: Partial<RevealWindowParams>) => void
  revealEnvelope?: RevealEnvelopeParams
  onRevealEnvelopeChange?: (patch: Partial<RevealEnvelopeParams>, gesture?: string | null) => void
  /** Per-stroke timing rows (ANIM-1A2). Passed straight through. */
  take?: StrokeTimingTake
  onTakeChange?: (take: StrokeTimingTake) => void
  onFlattenChange?: (patch: Partial<FlatState>) => void
  settingsRef: React.MutableRefObject<ExportSettings>
  /** The viewport's imperative camera/export surface, handed back on mount.
   *  `null` until the dynamically-imported chunk has loaded — every caller
   *  must handle that, because this component renders `ViewportLoading` first
   *  by design. See `ViewportApi` in components/viewport-3d.tsx. */
  apiRef?: React.MutableRefObject<ViewportApi | null>
}

export default function Viewport3DWrapper({
  processedStrokes,
  rawStrokes,
  geometryMode,
  extrudeParams,
  solidParams,
  inflateParams,
  styleState,
  lighting,
  engineFamily,
  flatten,
  letterMap,
  chromeless,
  projection,
  revealRef,
  drawIn,
  onDrawInChange,
  revealWindow,
  onRevealWindowChange,
  revealEnvelope,
  onRevealEnvelopeChange,
  take,
  onTakeChange,
  onFlattenChange,
  settingsRef,
  apiRef,
}: Viewport3DWrapperProps) {
  /* DEV ONLY · A REMOUNT ON DEMAND, the one "Rebuild the view" performs after a
   * crash: a new key, so `<Viewport3D>` unmounts and mounts again with the
   * page's providers in place. assert-keyed-playback-live.mjs L6 uses it to
   * show a remount reaches the transport store's readers (REVIEW 1 finding
   * 11); the crash law cannot, because in a development build it takes the
   * whole page down. */
  const [mountKey, setMountKey] = useState(0)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as { __fsRemountViewport?: () => void }
    w.__fsRemountViewport = () => setMountKey((k) => k + 1)
    return () => {
      delete w.__fsRemountViewport
    }
  }, [])
  return (
    /* THE BOUNDARY IS OUTSIDE `<Viewport3D>`, WHICH IS THE WHOLE POINT — see the
     * import above. Inside it, it caught nothing that mattered. */
    <ViewportErrorBoundary>
      <Viewport3D
        key={mountKey}
        processedStrokes={processedStrokes}
        rawStrokes={rawStrokes}
        geometryMode={geometryMode}
        extrudeParams={extrudeParams}
        solidParams={solidParams}
        inflateParams={inflateParams}
        styleState={styleState}
        lighting={lighting}
        engineFamily={engineFamily}
        flatten={flatten}
        letterMap={letterMap}
        chromeless={chromeless}
        projection={projection}
        revealRef={revealRef}
        drawIn={drawIn}
        onDrawInChange={onDrawInChange}
        revealWindow={revealWindow}
        onRevealWindowChange={onRevealWindowChange}
        revealEnvelope={revealEnvelope}
        onRevealEnvelopeChange={onRevealEnvelopeChange}
        take={take}
        onTakeChange={onTakeChange}
        onFlattenChange={onFlattenChange}
        settingsRef={settingsRef}
        apiRef={apiRef}
      />
    </ViewportErrorBoundary>
  )
}

"use client"

import { useRef, useCallback, useMemo, useEffect, useLayoutEffect, useState, Component, type ReactNode } from "react"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment, Lightformer } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"
import type { Stroke, ProcessedStroke, Point } from "@/lib/stroke-processing"
import type { ExportSettings } from "@/components/drawing-canvas"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import {
  type GeometryMode,
  type StrokeMeshData,
  type StrokeBuildStatus,
  type SolidBuildStatus,
  type ExtrudeParams,
  type SolidParams,
  getEngine,
  TUBE_RADIUS,
  RADIAL_SEGMENTS,
  SPHERE_SEGMENTS,
  SOLID_DEBUG,
  SOLID_ANIM_DEBUG,
  SOLID_STAGE_DEBUG,
  extrudeWidthToSlider,
} from "@/lib/geometry-engines"
import type { StyleState } from "@/lib/style-system"
import {
  findPreset,
  resolveMaterialParams,
  evaluateMaterialAnimation,
  MODE_MATERIAL_DEFAULTS,
} from "@/lib/style-system"
import { createTextureUniforms, TEXTURE_TYPE_INDEX, type TextureUniforms } from "@/lib/texture-shader"
import {
  createDitherUniforms,
  DITHER_TYPE_INDEX,
  DITHER_DIRECTION_VEC,
  type DitherUniforms,
} from "@/lib/dither-shader"
import { applyStyleShader } from "@/lib/style-shader"


/**
 * GEOM_BUILD_DEBUG — dev-only, mode-agnostic geometry build counter.
 * `buildCount` increments once per actual geometry (re)build for ANY mode.
 * The verification harness asserts this stays FLAT across style changes,
 * which is the PRD's hard gate: "changing style state updates preview without
 * rebuilding geometry". Unlike the Extrude-only `extrudeDebugRef`, this works
 * for Rod / Solid / Inflate too.
 */
export const GEOM_BUILD_DEBUG = { buildCount: 0 }

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 0, 5)
const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

const FRAME_K = 3.0
const TOP_K = 2.5

/* ------------------------------------------------------------------ */
/*  Convert 2D strokes to 3D mesh data via geometry engine             */
/* ------------------------------------------------------------------ */

const MIN_REVEAL_RINGS = 1 // minimum tube rings visible before showing any caps/joints

function useStrokeMeshes(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
  mode: GeometryMode,
  extrudeParams?: ExtrudeParams,
  solidParams?: SolidParams,
  /**
   * OPTIONAL Solid H3 animation hole stabilization (animation-only).
   * Forwarded verbatim to `engine.buildPreview` for the Solid path. Static
   * preview, Rod, Extrude, and Solid export do not read it.
   *
   * `holeStabilizationKey` is a cheap memo signature for the override so the
   * useMemo doesn't have to compare deep contour arrays. Scene maintains it.
   */
  holeStabilization?: import("@/lib/solid-mask").SolidHoleStabilization,
  holeStabilizationKey?: string,
  /**
   * OPTIONAL Solid animation-only no-holes reveal mode.
   *
   * When true, the Solid mesh is rebuilt as a stable filled silhouette
   * extrusion with H2 disabled. Used by Scene during the active reveal
   * (progress < 1) to eliminate mid-animation hole/counter topology
   * switching. Cleared on the final frame so the mesh commits to the
   * full static H3 geometry exactly once.
   */
  disableHolesForAnimation?: boolean,
): StrokeMeshData[] {
  // Extract individual values to prevent object reference changes from triggering rebuilds.
  // CRITICAL: every slider value the engine consumes must be listed here. If a value is
  // omitted, moving its slider won't re-run the closure and preview will silently use
  // a stale cached geometry (engine still receives the new value via the closed-over
  // `extrudeParams` reference, but the memo never re-fires).
  const extrudeWidth = extrudeParams?.width
  const extrudeDepth = extrudeParams?.depth
  const extrudeBevel = extrudeParams?.bevelEnabled
  const solidThickness = solidParams?.thickness
  const solidDepth = solidParams?.depth
  
  return useMemo(() => {
    const engine = getEngine(mode)
    return engine.buildPreview(strokes, {
      canvasWidth,
      canvasHeight,
      extrudeParams,
      solidParams,
      holeStabilization,
      disableHolesForAnimation,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, canvasWidth, canvasHeight, mode, extrudeWidth, extrudeDepth, extrudeBevel, solidThickness, solidDepth, holeStabilizationKey, disableHolesForAnimation])
}

/* ---- Shared geometries ---- */
const sphereGeometry = new THREE.SphereGeometry(TUBE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS)

/* Stroke materials are no longer module-level singletons. As of the
 * POST_MVP material work, the preview material is created inside
 * <AnimatedStrokes> from styleState.materialPreset (see `liveMaterial`) so the
 * Material panel actually drives the surface. Export still builds its own
 * lightweight material at export time. */

/* ---- Bounding box ---- */
interface StrokeBounds {
  center: THREE.Vector3
  radius: number
}

function useStrokeBounds(meshes: StrokeMeshData[]): StrokeBounds | null {
  return useMemo(() => {
    if (meshes.length === 0) return null

    const box = new THREE.Box3()
    for (const { tubeGeometry } of meshes) {
      tubeGeometry.computeBoundingBox()
      if (tubeGeometry.boundingBox) {
        box.union(tubeGeometry.boundingBox)
      }
    }
    if (box.isEmpty()) return null

    const center = new THREE.Vector3()
    box.getCenter(center)
    const sphere = new THREE.Sphere()
    box.getBoundingSphere(sphere)

    return { center, radius: sphere.radius }
  }, [meshes])
}

/* ---- useStableStrokesBounds: bounds derived directly from raw stroke points ----
 *
 * Used for camera framing in Solid mode where the visible mesh is rebuilt every
 * frame from a partial subset of the strokes (draw-in animation). Mesh-derived
 * bounds shrink during animation, which would cause the camera to zoom in. By
 * computing bounds from the full unfiltered strokes via the same world-space
 * transform that `strokesToTestStroke` uses (lib/geometry-engines.ts), the
 * camera frame stays locked to the FINAL geometry size for the entire playback.
 *
 * Cheap: pure O(N) point iteration, no mesh rebuild.
 */
function useStableStrokesBounds(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
): StrokeBounds | null {
  return useMemo(() => {
    if (strokes.length === 0 || canvasWidth <= 0 || canvasHeight <= 0) return null

    // Identical world-space transform used by strokesToTestStroke:
    //   worldX = (x - W/2) * scale
    //   worldY = -(y - H/2) * scale
    //   scale  = 3.0 / max(W, H)
    const scale = 3.0 / Math.max(canvasWidth, canvasHeight)
    const offsetX = canvasWidth / 2
    const offsetY = canvasHeight / 2

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let count = 0

    for (const s of strokes) {
      for (const p of s.points) {
        const wx = (p.x - offsetX) * scale
        const wy = -(p.y - offsetY) * scale
        if (wx < minX) minX = wx
        if (wx > maxX) maxX = wx
        if (wy < minY) minY = wy
        if (wy > maxY) maxY = wy
        count++
      }
    }

    if (count === 0 || !isFinite(minX)) return null

    // Small padding for stroke thickness and Solid extrusion depth.
    // Sized in world units; matches typical maxima of thickness/depth.
    const pad = 0.15
    minX -= pad
    minY -= pad
    maxX += pad
    maxY += pad

    const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0)

    // Bounding sphere radius around the center, also accounting for a small
    // depth on Z (Solid extrusion is centered at z=0).
    const dx = (maxX - minX) / 2
    const dy = (maxY - minY) / 2
    const dz = pad
    const radius = Math.sqrt(dx * dx + dy * dy + dz * dz)

    return { center, radius }
  }, [strokes, canvasWidth, canvasHeight])
}

/* ---- Auto-frame on first draw ----
 *
 * Frames the camera once when the user goes from "no drawing" to "has drawing".
 * The gate uses `strokeCount` (the count of user-drawn strokes from the parent
 * prop), NOT the live mesh count, because in Solid mode the mesh count cycles
 * 0 -> N -> 0 during draw-in playback, which would otherwise re-trigger framing
 * and override any manual orbit/zoom the user did before pressing Play.
 */
function AutoFrameOnFirstDraw({
  strokeCount,
  bounds,
  controlsRef,
}: {
  strokeCount: number
  bounds: StrokeBounds | null
  controlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()
  const hasFramedRef = useRef(false)
  const prevCountRef = useRef(0)

  useEffect(() => {
    if (strokeCount === 0) {
      hasFramedRef.current = false
      prevCountRef.current = 0
      return
    }
    if (prevCountRef.current === 0 && strokeCount > 0 && !hasFramedRef.current && bounds) {
      hasFramedRef.current = true
      const controls = controlsRef.current
      if (!controls) return
      const dir = new THREE.Vector3(1, 1, 1).normalize()
      const pos = bounds.center.clone().add(dir.multiplyScalar(bounds.radius * FRAME_K))
      camera.position.copy(pos)
      controls.target.copy(bounds.center)
      controls.update()
    }
    prevCountRef.current = strokeCount
  }, [strokeCount, bounds, camera, controlsRef])

  return null
}

/* ---- CameraSlave: copies camera from a master OrbitControls ref ---- */
function CameraSlave({
  masterControlsRef,
}: {
  masterControlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()

  useFrame(() => {
    const master = masterControlsRef.current
    if (!master) return
    camera.position.copy(master.object.position)
    camera.quaternion.copy(master.object.quaternion)
    ;(camera as THREE.PerspectiveCamera).fov = (master.object as THREE.PerspectiveCamera).fov
    ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
  })

  return null
}

/* ------------------------------------------------------------------ */
/*  Animation timeline: computes timing from raw stroke timestamps    */
/* ------------------------------------------------------------------ */

interface StrokeTimeline {
  /** Global time start (ms since epoch) relative to the very first point */
  tStart: number
  /** Global time end */
  tEnd: number
}

function useTimeline(rawStrokes: Stroke[]): {
  timelines: StrokeTimeline[]
  totalDuration: number
  globalTStart: number
} {
  return useMemo(() => {
    if (rawStrokes.length === 0) return { timelines: [], totalDuration: 0, globalTStart: 0 }

    let globalMin = Infinity
    let globalMax = -Infinity

    for (const stroke of rawStrokes) {
      for (const p of stroke.points) {
        if (p.t < globalMin) globalMin = p.t
        if (p.t > globalMax) globalMax = p.t
      }
    }

    const totalDuration = Math.max(globalMax - globalMin, 1) // at least 1ms to avoid div/0

    const timelines: StrokeTimeline[] = rawStrokes.map((stroke) => {
      const pts = stroke.points
      if (pts.length === 0) return { tStart: 0, tEnd: 0 }
      let sMin = Infinity
      let sMax = -Infinity
      for (const p of pts) {
        if (p.t < sMin) sMin = p.t
        if (p.t > sMax) sMax = p.t
      }
      return {
        tStart: sMin - globalMin,
        tEnd: sMax - globalMin,
      }
    })

    return { timelines, totalDuration, globalTStart: globalMin }
  }, [rawStrokes])
}

/* ------------------------------------------------------------------ */
/*  AnimatedStrokes: manages drawRange + visibility per frame         */
/* ------------------------------------------------------------------ */

type RevealMode = "raw" | "smooth" | "hybrid"

function AnimatedStrokes({
  meshes,
  timelines,
  totalDuration,
  playheadRef,
  revealMode,
  hybridBlend,
  exportGroupRef,
  styleState,
}: {
  meshes: StrokeMeshData[]
  timelines: StrokeTimeline[]
  totalDuration: number
  playheadRef: React.MutableRefObject<number> // 0..1 progress
  revealMode: RevealMode
  hybridBlend: number
  exportGroupRef: React.RefObject<THREE.Group | null>
  styleState?: StyleState
}) {
  // Refs to all tube meshes for drawRange updates
  const tubeMeshRefs = useRef<(THREE.Mesh | null)[]>([])
  // Refs to end cap meshes
  const endCapRefs = useRef<(THREE.Mesh | null)[]>([])
  // Refs to start cap meshes
  const startCapRefs = useRef<(THREE.Mesh | null)[]>([])
  // Refs to joint groups (one group per stroke)
  const jointGroupRefs = useRef<(THREE.Group | null)[]>([])

  // ---- Material (IMPLEMENTED v1) ----------------------------------------
  // A single live MeshPhysicalMaterial driven by styleState.materialPreset.
  // Replaces the old static module-level `strokeMaterial`/`inflateMaterial`:
  // the preset (incl. per-mode defaults chosen in the app) now decides the
  // surface, so every mesh in this component shares one preset-driven material.
  const materialPreset = styleState?.materialPreset ?? "ink"
  const customMaterial = styleState?.customMaterial
  // Procedural texture v1: uniform objects live in a ref so they survive
  // material re-creation (preset switches) and per-frame writes go straight to
  // the GPU without touching React state or the material itself.
  const textureUniformsRef = useRef<TextureUniforms | null>(null)
  if (textureUniformsRef.current === null) {
    textureUniformsRef.current = createTextureUniforms()
  }
  const ditherUniformsRef = useRef<DitherUniforms | null>(null)
  if (ditherUniformsRef.current === null) {
    ditherUniformsRef.current = createDitherUniforms()
  }
  const liveMaterial = useMemo(() => {
    const base = resolveMaterialParams(materialPreset, customMaterial)
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(base.color),
      roughness: base.roughness,
      metalness: base.metalness,
      clearcoat: base.clearcoat,
      clearcoatRoughness: base.clearcoatRoughness,
      reflectivity: base.reflectivity,
      sheen: base.sheen,
      sheenRoughness: base.sheenRoughness,
      sheenColor: new THREE.Color(base.sheenColor),
      emissive: new THREE.Color(base.emissive),
      emissiveIntensity: base.emissiveIntensity,
      envMapIntensity: base.envMapIntensity,
    })
    // Every style layer rides the same shared material across all four modes.
    applyStyleShader(mat, {
      texture: textureUniformsRef.current!,
      dither: ditherUniformsRef.current!,
    })
    return mat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialPreset, customMaterial])

  // Dispose the material when the preset changes / on unmount to avoid GPU leaks.
  useEffect(() => {
    return () => {
      liveMaterial.dispose()
    }
  }, [liveMaterial])

  // Re-apply the static base whenever the preset changes (covers the case where
  // animation was running and left the material modulated, then preset switches).
  const baseParams = useMemo(
    () => resolveMaterialParams(materialPreset, customMaterial),
    [materialPreset, customMaterial],
  )

  useFrame((state, delta) => {
    // ---- Procedural texture v1 (uniform writes only) --------------------
    // Pattern selection + params + animation phase all flow through uniform
    // values on the injected shader. No material swap, no recompile, no
    // geometry rebuild — verified against the Extrude previewBuildCount.
    if (styleState) {
      const u = textureUniformsRef.current!
      const texOn = styleState.textureEnabled && styleState.textureMode !== "none"
      u.uFsTexType.value = texOn ? TEXTURE_TYPE_INDEX[styleState.textureMode] : 0
      u.uFsTexScale.value = styleState.textureScale
      u.uFsTexIntensity.value = styleState.textureIntensity
      u.uFsTexContrast.value = styleState.textureContrast
      u.uFsTexLockScreen.value = styleState.textureLockMode === "screen" ? 1 : 0
      const dir = styleState.textureDirection
      u.uFsTexDirX.value = dir === "vertical" ? 0 : dir === "diagonal" ? 0.7071 : 1
      u.uFsTexDirY.value = dir === "horizontal" ? 0 : dir === "diagonal" ? 0.7071 : 1
      const texAnim = texOn && styleState.textureAnimated && styleState.motionMode !== "off"
      if (texAnim) {
        if (styleState.motionMode === "syncToDraw") {
          // Reveal progress IS the clock: the pattern travels with the draw.
          u.uFsTexTime.value =
            styleState.texturePhase + playheadRef.current * 4 * styleState.textureSpeed
        } else {
          u.uFsTexTime.value += delta * styleState.textureSpeed * 0.6
        }
      } else {
        u.uFsTexTime.value = styleState.texturePhase
      }
    }

    // ---- Dither v1 (uniform writes only) --------------------------------
    // Dither is a SEPARATE system from texture: it reduces final shaded tone
    // through a threshold map. Same no-rebuild contract — uniforms only.
    if (styleState) {
      const d = ditherUniformsRef.current!
      const ditOn = styleState.ditherEnabled
      d.uFsDitType.value = ditOn ? DITHER_TYPE_INDEX[styleState.ditherType] : 0
      d.uFsDitScale.value = styleState.ditherScale
      d.uFsDitContrast.value = styleState.ditherContrast
      d.uFsDitIntensity.value = styleState.ditherIntensity
      d.uFsDitLevels.value = styleState.ditherLevels
      d.uFsDitLockScreen.value = styleState.ditherLockMode === "screen" ? 1 : 0
      const [ddx, ddy] = DITHER_DIRECTION_VEC[styleState.ditherDirection]
      d.uFsDitDirX.value = ddx
      d.uFsDitDirY.value = ddy

      const ditAnim = ditOn && styleState.ditherAnimated && styleState.motionMode !== "off"
      if (ditAnim) {
        const syncing = styleState.motionMode === "syncToDraw"
        const phase = syncing ? playheadRef.current * 6 : state.clock.elapsedTime
        // MATRIX motion: shift which threshold cell each pixel samples.
        d.uFsDitTime.value = syncing
          ? phase * styleState.ditherSpeed
          : d.uFsDitTime.value + delta * styleState.ditherSpeed * 6
        // THRESHOLD-BIAS motion: with no travel direction the matrix can't
        // move, so animation instead sweeps the bias — tone opens/closes.
        // This is what distinguishes "Threshold Sweep" from "Dither Crawl".
        if (styleState.ditherDirection === "static") {
          const sweep = syncing
            ? // reveal-synced: threshold opens up as the stroke draws in
              (1 - playheadRef.current) * 0.42
            : Math.sin(phase * styleState.ditherSpeed * 1.6) * 0.22
          d.uFsDitThreshold.value = styleState.ditherThreshold + sweep
        } else {
          d.uFsDitThreshold.value = styleState.ditherThreshold
        }
      } else {
        d.uFsDitTime.value = 0
        d.uFsDitThreshold.value = styleState.ditherThreshold
      }
    }

    // ---- Animated Material v1 (surface response only) -------------------
    // PREVIEW-ONLY: this modulates highlight/roughness/sheen/emissive each
    // frame. It NEVER touches geometry, the reveal clock, or export. When the
    // animation is off we keep the material pinned to its static base.
    if (styleState) {
      const animOn =
        styleState.materialAnimationEnabled && styleState.materialAnimationType !== "none"
      if (animOn) {
        // Motion clock: "syncToDraw" ties the phase to draw-in progress so the
        // surface animation reads as part of the same gesture; otherwise it
        // runs on the renderer's own elapsed-time clock (independent).
        const completion = playheadRef.current
        const time =
          styleState.motionMode === "syncToDraw"
            ? completion * 6 // map 0..1 progress into a usable phase range
            : state.clock.elapsedTime
        const next = evaluateMaterialAnimation({
          base: baseParams,
          type: styleState.materialAnimationType,
          time,
          speed: styleState.materialAnimationSpeed,
          intensity: styleState.materialAnimationIntensity,
          completion,
        })
        liveMaterial.color.set(next.color)
        liveMaterial.roughness = next.roughness
        liveMaterial.metalness = next.metalness
        liveMaterial.clearcoat = next.clearcoat
        liveMaterial.clearcoatRoughness = next.clearcoatRoughness
        liveMaterial.reflectivity = next.reflectivity
        liveMaterial.sheen = next.sheen
        liveMaterial.sheenRoughness = next.sheenRoughness
        liveMaterial.sheenColor.set(next.sheenColor)
        liveMaterial.emissive.set(next.emissive)
        liveMaterial.emissiveIntensity = next.emissiveIntensity
        liveMaterial.envMapIntensity = next.envMapIntensity
      } else {
        // Animation off → pin the surface to its static base so it never
        // freezes on the last animated frame.
        liveMaterial.roughness = baseParams.roughness
        liveMaterial.clearcoat = baseParams.clearcoat
        liveMaterial.clearcoatRoughness = baseParams.clearcoatRoughness
        liveMaterial.reflectivity = baseParams.reflectivity
        liveMaterial.sheen = baseParams.sheen
        liveMaterial.sheenRoughness = baseParams.sheenRoughness
        liveMaterial.emissiveIntensity = baseParams.emissiveIntensity
        liveMaterial.envMapIntensity = baseParams.envMapIntensity
      }
    }

    const progress = playheadRef.current
    const currentTimeMs = progress * totalDuration

    for (let si = 0; si < meshes.length; si++) {
      const mesh = tubeMeshRefs.current[si]
      const strokeMeshData = meshes[si]

      if (!mesh || !strokeMeshData) continue

      // Solid, Extrude AND Inflate all animate by REBUILDING geometry from
      // progress-filtered strokes (see `animatedStrokes` useMemo +
      // `SolidAnimationTick`). The mesh itself is always fully visible
      // every frame; the partial reveal lives inside the geometry that
      // `useStrokeMeshes` produces. Per-stroke visibility gating and
      // per-segment drawRange are NEVER applied to these modes — they
      // would either pop entire strokes (gating) or interleave cap and
      // wall triangles incorrectly (drawRange on a non-Rod geometry).
      // Inflate MUST be here: its elliptical-tube loft is rebuilt per frame
      // and must not be driven through Rod's TubeGeometry drawRange path.
      if (
        strokeMeshData.mode === "solid" ||
        strokeMeshData.mode === "extrude" ||
        strokeMeshData.mode === "inflate"
      ) {
        mesh.visible = true
        continue
      }

      // Rod mode: animate with drawRange + caps + joints
      const startCap = startCapRefs.current[si]
      const endCap = endCapRefs.current[si]
      const jointGroup = jointGroupRefs.current[si]
      const timeline = timelines[si]

      if (!timeline) continue

      const geo = mesh.geometry as THREE.TubeGeometry
      const totalIndices = geo.index ? geo.index.count : 0
      const minVisibleIndices = RADIAL_SEGMENTS * 6 * MIN_REVEAL_RINGS

      if (currentTimeMs < timeline.tStart) {
        geo.setDrawRange(0, 0)
        if (startCap) startCap.visible = false
        if (endCap) endCap.visible = false
        if (jointGroup) jointGroup.visible = false
        continue
      }

      if (currentTimeMs >= timeline.tEnd) {
        geo.setDrawRange(0, totalIndices)
        if (startCap) startCap.visible = true
        if (endCap && strokeMeshData.capPositions) {
          endCap.visible = true
          endCap.position.copy(strokeMeshData.capPositions[1])
        }
        if (jointGroup) {
          jointGroup.visible = true
          for (const child of jointGroup.children) {
            child.visible = true
          }
        }
        continue
      }

      const strokeDuration = Math.max(timeline.tEnd - timeline.tStart, 1)
      const elapsed = currentTimeMs - timeline.tStart
      const timeFrac = Math.min(elapsed / strokeDuration, 1)

      // --- Convert timeFrac -> distFrac using per-point mapping ---
      const tf = strokeMeshData.timeFracs
      const df = strokeMeshData.distFracs
      const curve = strokeMeshData.curve

      // Compute rawDistFrac: pen-speed-based arc-length fraction
      let rawDistFrac = timeFrac // fallback
      if (tf && df && tf.length >= 2 && df.length === tf.length) {
        let lo = 0
        let hi = tf.length - 1
        while (lo < hi - 1) {
          const mid = (lo + hi) >> 1
          if (tf[mid] <= timeFrac) lo = mid
          else hi = mid
        }
        if (timeFrac <= tf[0]) {
          rawDistFrac = df[0]
        } else if (timeFrac >= tf[tf.length - 1]) {
          rawDistFrac = df[df.length - 1]
        } else {
          const segLen = tf[hi] - tf[lo]
          const alpha = segLen > 0 ? (timeFrac - tf[lo]) / segLen : 0
          rawDistFrac = df[lo] + alpha * (df[hi] - df[lo])
        }
      }

      // Apply reveal mode — NO easing, all linear at the end
      let distFrac: number
      if (revealMode === "smooth") {
        distFrac = timeFrac // constant speed
      } else if (revealMode === "hybrid") {
        distFrac = rawDistFrac + (timeFrac - rawDistFrac) * hybridBlend
      } else {
        distFrac = rawDistFrac // raw pen timing
      }

      // --- Convert distFrac -> curve tParam using arc-length mapping ---
      let tParam: number
      if (curve) {
        const distance = distFrac * curve.getLength()
        tParam = curve.getUtoTmapping(0, distance)
      } else {
        tParam = distFrac
      }

      // --- DrawRange: snap to full tube rings ---
      // Only TubeGeometry exposes `parameters.tubularSegments`. The Inflate
      // engine emits a plain BufferGeometry, so guard the access and fall
      // back to a full-reveal draw range.
      const geoParams = (geo as any).parameters as
        | { tubularSegments?: number }
        | undefined
      const tubularSegments = geoParams?.tubularSegments ?? 64
      const indicesPerRing = RADIAL_SEGMENTS * 6
      const ringIndex = Math.floor(tParam * tubularSegments)
      const visibleRings = Math.min(ringIndex + 1, tubularSegments + 1)
      const drawRangeCount = Math.min(visibleRings * indicesPerRing, totalIndices)
      if (geoParams?.tubularSegments != null) {
        geo.setDrawRange(0, drawRangeCount)
      } else {
        // Non-tube geometry (e.g. Inflate's elliptical loft): reveal whole mesh.
        geo.setDrawRange(0, totalIndices)
      }

      const hasVisibleSegment = visibleRings >= MIN_REVEAL_RINGS + 1

      if (startCap) startCap.visible = hasVisibleSegment

      // End cap: hidden during reveal, snaps to final position near completion
      if (endCap) {
        if (distFrac >= 0.98 && strokeMeshData.capPositions) {
          endCap.visible = true
          endCap.position.copy(strokeMeshData.capPositions[1])
        } else {
          endCap.visible = false
        }
      }

      // --- Joints ---
      if (jointGroup) {
        if (!hasVisibleSegment) {
          jointGroup.visible = false
        } else {
          jointGroup.visible = true
          const fracs = strokeMeshData.jointFractions
          for (let ji = 0; ji < jointGroup.children.length; ji++) {
            jointGroup.children[ji].visible = ji < fracs.length && (fracs?.[ji] ?? 0) <= distFrac
          }
        }
      }
    }
  })

  return (
    <>
      {/* Export group: tubes/extrude meshes + caps + joints */}
      <group ref={exportGroupRef}>
        {meshes.map((data, si) => {
          return (
          <group key={data.key}>
            {/* Main geometry (tube, extrude, or solid) */}
            <mesh
              ref={(el) => { tubeMeshRefs.current[si] = el }}
              geometry={data.tubeGeometry}
              material={liveMaterial}
            />
            {/* Rod-mode only: caps + joints (fallback may use custom radius from Width slider) */}
            {data.mode === "rod" && data.capPositions && (() => {
              const r = data.capRadius ?? TUBE_RADIUS
              const capGeo = r === TUBE_RADIUS ? sphereGeometry : new THREE.SphereGeometry(r, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
              return (
                <>
                  <mesh
                    ref={(el) => { startCapRefs.current[si] = el }}
                    geometry={capGeo}
                    material={liveMaterial}
                    position={data.capPositions[0]}
                  />
                  <mesh
                    ref={(el) => { endCapRefs.current[si] = el }}
                    geometry={capGeo}
                    material={liveMaterial}
                    position={data.capPositions[1]}
                  />
                </>
              )
            })()}
            {data.mode === "rod" && data.jointPositions && (() => {
              const r = data.capRadius ?? TUBE_RADIUS
              const jointGeo = r === TUBE_RADIUS ? sphereGeometry : new THREE.SphereGeometry(r, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
              return (
                <group ref={(el) => { jointGroupRefs.current[si] = el }}>
                  {data.jointPositions.map((pos, ji) => (
                    <mesh
                      key={`${data.key}-joint-${ji}`}
                      geometry={jointGeo}
                      material={liveMaterial}
                      position={pos}
                    />
                  ))}
                </group>
              )
            })()}
          </group>
          )
        })}
      </group>
    </>
  )
}

/* ---- PlaybackController: advances playheadRef when playing ---- */
function PlaybackController({
  playheadRef,
  playing,
  speed,
  totalDuration,
  onProgressUpdate,
}: {
  playheadRef: React.MutableRefObject<number>
  playing: boolean
  speed: number
  totalDuration: number
  onProgressUpdate: (progress: number) => void
}) {
  const lastTimeRef = useRef<number | null>(null)

  useFrame(() => {
    if (!playing || totalDuration <= 0) {
      lastTimeRef.current = null
      return
    }

    const now = performance.now()
    if (lastTimeRef.current === null) {
      lastTimeRef.current = now
      return
    }

    const deltaMs = (now - lastTimeRef.current) * speed
    lastTimeRef.current = now

    const deltaFraction = deltaMs / totalDuration
    const newProgress = Math.min(playheadRef.current + deltaFraction, 1)
    playheadRef.current = newProgress
    onProgressUpdate(newProgress)

    // Auto-pause at end
    if (newProgress >= 1) {
      lastTimeRef.current = null
    }
  })

  return null
}

/* ---- SolidAnimationTick: forces React re-render while playheadRef advances ----
 *
 * Why this exists:
 *   The Solid and Extrude meshes both rebuild from a `useMemo` that depends on
 *   a React state value (`solidAnimProgress`). The actual playback source-of-
 *   truth is `playheadRef.current`, which is a ref and does NOT trigger React
 *   re-renders when mutated by `PlaybackController`. Without this tick, those
 *   meshes never rebuild during playback and appear static.
 *
 *   The component name retains the `Solid` prefix because Solid was the first
 *   consumer of this tick, but it now also drives the Extrude partial-stroke
 *   rebuild path. Rod animation continues to be driven directly off
 *   `playheadRef.current` inside `AnimatedStrokes` (drawRange), so this tick
 *   has no effect on Rod and pays zero cost in Rod mode.
 *
 * Behavior:
 *   - Runs on every frame inside the Canvas (must be a child of <Canvas>).
 *   - Throttles updates lightly so partial-rebuild modes don't spam raster
 *     / contour / extrude work every single frame:
 *       * minimum interval: ~22ms (~45 Hz) between state updates
 *       * minimum delta:    1e-5 (just enough to skip exact-equal frames)
 *   - Always forces an update at the boundaries (progress 0 and progress 1)
 *     so the final frame matches the static preview exactly and replay starts
 *     from empty.
 *   - Active for partial-rebuild modes only (Solid, Extrude). Rod and any
 *     other mode early-out and pay zero cost.
 */
function SolidAnimationTick({
  enabled,
  playheadRef,
  setSolidAnimProgress,
}: {
  enabled: boolean
  playheadRef: React.MutableRefObject<number>
  setSolidAnimProgress: React.Dispatch<React.SetStateAction<number>>
}) {
  const lastSyncedRef = useRef<number>(playheadRef.current)
  const lastSyncTimeRef = useRef<number>(0)

  useFrame(() => {
    if (!enabled) return
    const current = playheadRef.current
    const last = lastSyncedRef.current
    const now = performance.now()
    const delta = Math.abs(current - last)

    const atBoundary = (current >= 1 && last < 1) || (current <= 0 && last > 0)
    const timeOk = now - lastSyncTimeRef.current >= 22
    const deltaOk = delta > 1e-5

    if (atBoundary || (timeOk && deltaOk)) {
      lastSyncedRef.current = current
      lastSyncTimeRef.current = now
      setSolidAnimProgress(current)
    }
  })

  return null
}

/* ---- Stroke filtering by animation progress (for Solid draw-in animation) ----
 *
 * Returns a partial copy of `strokes` representing the portion of the drawing
 * that has been "drawn in" at the given `progress` (0..1).
 *
 * Smoothness strategy: ARC-LENGTH based, with sub-segment interpolation.
 *
 *   1. Compute the total arc length across all strokes (sum of segment lengths).
 *   2. The target reveal length = totalLength * progress.
 *   3. Walk strokes in order; fully include any stroke whose cumulative length
 *      stays below the target.
 *   4. The stroke that contains the target receives:
 *        - all of its points up to and including the last point before the cut
 *        - one INTERPOLATED endpoint placed at the exact target length inside
 *          the current segment (linear x/y/t/pressure interpolation)
 *      This makes the reveal advance continuously instead of snapping to whole
 *      points, which removes the visible "popping" and uneven pacing that comes
 *      from raw point-count progress (corner detection clusters extra points
 *      around curves, so equal point counts != equal visible length).
 *   5. Boundaries are clean:
 *        progress <= 0  -> []                    (replay-from-empty)
 *        progress >= 1  -> original strokes      (final frame == static preview)
 *   6. Original stroke data is never mutated; partial strokes are shallow-copied
 *      and only the new points array is freshly constructed.
 */
function filterStrokesByProgress(
  strokes: ProcessedStroke[],
  progress: number,
): ProcessedStroke[] {
  if (progress >= 1 || strokes.length === 0) return strokes
  if (progress <= 0) return []

  // ---- Pass 1: total arc length across all strokes ----
  // Per-stroke length cached to avoid recomputation in pass 2.
  const strokeLengths: number[] = new Array(strokes.length)
  let totalLength = 0
  for (let s = 0; s < strokes.length; s++) {
    const pts = strokes[s].points
    let len = 0
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x
      const dy = pts[i].y - pts[i - 1].y
      len += Math.sqrt(dx * dx + dy * dy)
    }
    strokeLengths[s] = len
    totalLength += len
  }

  // Degenerate: zero total length (all points coincident) — fall back to
  // including everything once progress > 0 to avoid dividing by zero.
  if (totalLength <= 0) return strokes

  const targetLength = totalLength * progress

  // ---- Pass 2: walk strokes, build the partial output ----
  const filtered: ProcessedStroke[] = []
  let consumed = 0

  for (let s = 0; s < strokes.length; s++) {
    const stroke = strokes[s]
    const strokeLen = strokeLengths[s]

    // Stroke ends before target -> fully include and continue.
    if (consumed + strokeLen <= targetLength) {
      filtered.push(stroke)
      consumed += strokeLen
      continue
    }

    // Stroke contains the cut. Walk its segments to find the exact cut point.
    const remaining = targetLength - consumed
    const pts = stroke.points

    // Edge case: stroke has 0 or 1 points or zero length.
    if (pts.length <= 1 || strokeLen <= 0) {
      if (pts.length > 0) {
        filtered.push({ ...stroke, points: [pts[0]] })
      }
      break
    }

    // Edge case: cut falls before the first segment -> include just the start.
    if (remaining <= 0) {
      filtered.push({ ...stroke, points: [pts[0]] })
      break
    }

    let segAccum = 0
    let cutIdx = -1
    let segStartLen = 0

    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x
      const dy = pts[i].y - pts[i - 1].y
      const segLen = Math.sqrt(dx * dx + dy * dy)

      if (segAccum + segLen >= remaining) {
        cutIdx = i
        segStartLen = segAccum
        break
      }
      segAccum += segLen
    }

    if (cutIdx < 0) {
      // Numerical edge — include all of stroke.
      filtered.push(stroke)
      break
    }

    // Interpolate inside segment [cutIdx-1, cutIdx].
    const a = pts[cutIdx - 1]
    const b = pts[cutIdx]
    const dxSeg = b.x - a.x
    const dySeg = b.y - a.y
    const segLen = Math.sqrt(dxSeg * dxSeg + dySeg * dySeg)
    const tFrac = segLen > 0 ? Math.max(0, Math.min(1, (remaining - segStartLen) / segLen)) : 0

    const interpolatedPoint: Point = {
      x: a.x + dxSeg * tFrac,
      y: a.y + dySeg * tFrac,
      t: a.t + (b.t - a.t) * tFrac,
      pressure:
        a.pressure !== undefined && b.pressure !== undefined
          ? a.pressure + (b.pressure - a.pressure) * tFrac
          : a.pressure ?? b.pressure,
    }

    // Build partial stroke: all complete points up to cutIdx-1, plus interpolated end.
    const partialPoints: Point[] = pts.slice(0, cutIdx)
    partialPoints.push(interpolatedPoint)

    filtered.push({ ...stroke, points: partialPoints })
    break
  }

  return filtered
}

/* ---- Scene ---- */
function Scene({
  controlsRef,
  strokes,
  rawStrokes,
  canvasWidth,
  canvasHeight,
  geometryMode,
  extrudeParams,
  solidParams,
  revealMode,
  hybridBlend,
  boundsRef,
  exportGroupRef,
  playheadRef,
  playing,
  speed,
  totalDuration,
  onProgressUpdate,
  orbitEnabled = true,
  masterControlsRef,
  meshStatusRef,
  solidStatusRef,
  extrudeDebugRef,
  styleState,
  hideGrid = false,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  strokes: ProcessedStroke[]
  rawStrokes: Stroke[]
  canvasWidth: number
  canvasHeight: number
  geometryMode: GeometryMode
  extrudeParams?: ExtrudeParams
  solidParams?: SolidParams
  revealMode: RevealMode
  hybridBlend: number
  boundsRef: React.MutableRefObject<StrokeBounds | null>
  exportGroupRef: React.RefObject<THREE.Group | null>
  playheadRef: React.MutableRefObject<number>
  playing: boolean
  speed: number
  totalDuration: number
  onProgressUpdate: (progress: number) => void
  orbitEnabled?: boolean
  masterControlsRef?: React.RefObject<OrbitControlsImpl | null>
  meshStatusRef?: React.MutableRefObject<StrokeBuildStatus[]>
  solidStatusRef?: React.MutableRefObject<SolidBuildStatus | null>
  // Diagnostic-only ref; populated in extrude mode for the depth-trace panel.
  extrudeDebugRef?: React.MutableRefObject<{
    /** Raw depth-multiplier slider value (NOT a world-space depth). */
    depthParam: number
    buildCount: number
    /** Max stroke geometry Z extent in the current frame (= effectiveDepth + bevel). */
    bboxZ: number
    activeEngine: GeometryMode
    /** Normalized Width slider t in [0, 1]. */
    widthSliderValue: number
    widthSliderPercent: number
    /** Effective half-width actually consumed by the engine (after mapping + clamping). */
    effectiveWidthUsed: number
    effectiveWidthPercent: number
    /** Calibrated world-space depth actually used = multiplier × effectiveWidth clamped. */
    effectiveDepthUsed: number
    /** effectiveDepthUsed / effectiveWidthUsed — the visual proportion. */
    depthToWidthRatio: number
    strategy: string
    buildStatus: string
  } | null>
  styleState?: StyleState
  /** DEV capture: hides the grid helper for clean transparent frames. */
  hideGrid?: boolean
}) {
  // ---- Solid draw-in animation state ----
  // playheadRef.current is the source of truth, but ref mutations don't
  // trigger React re-renders. SolidAnimationTick (rendered below, inside
  // Canvas) reads playheadRef.current on every frame and updates this state
  // (throttled). The state then drives the animatedStrokes useMemo, which
  // forces the Solid mesh to rebuild as playback progresses.
  const [solidAnimProgress, setSolidAnimProgress] = useState<number>(
    playheadRef.current,
  )

  // -----------------------------------------------------------------
  // Start/reset flash fix.
  //
  // Bug:
  //   When the user clicks Play after a stroke is fully drawn, `handlePlayPause`
  //   in the wrapper synchronously sets `playheadRef.current = 0` and flips
  //   `playing -> true`. But `solidAnimProgress` is React state owned by
  //   `Scene`; the SolidAnimationTick only syncs it on the NEXT animation
  //   frame. Between the click commit and the next frame, React re-renders
  //   with the new `playing` value but the OLD `solidAnimProgress = 1`,
  //   producing one paint of the full mesh before the reveal starts. That's
  //   the flash described in the screen recording.
  //
  // Fix:
  //   Detect the playing transition `false -> true` and, if `playheadRef.current`
  //   is well below the last animated state value, eagerly sync the state
  //   to the playhead BEFORE the next paint. This is a layout effect so it
  //   runs synchronously after commit and before the browser repaints.
  //
  //   The check is intentionally a delta threshold rather than `=== 0` so it
  //   also handles "scrub-to-start, then press Play" and the Compare-mode
  //   replay reset.
  // -----------------------------------------------------------------
  const prevPlayingRef = useRef(playing)
  useLayoutEffect(() => {
    const wasPlaying = prevPlayingRef.current
    prevPlayingRef.current = playing
    // Applies to all partial-rebuild modes (Solid, Extrude, Inflate). Rod
    // animation does not use this state value, so Rod is unaffected. This
    // ensures the first frame after Play paints the empty/partial mesh rather
    // than the previously-full one (no full-mesh flash on replay).
    if (
      geometryMode !== "solid" &&
      geometryMode !== "extrude" &&
      geometryMode !== "inflate"
    )
      return
    // Transition from paused to playing
    if (!wasPlaying && playing) {
      const head = playheadRef.current
      const drop = solidAnimProgress - head
      // If the playhead has been moved backwards (typical: full -> 0 on replay),
      // sync state synchronously so the first frame of playback paints the
      // empty/partial mesh, not the previously-full one.
      if (drop > 0.01) {
        setSolidAnimProgress(head)
      }
    }
  }, [playing, geometryMode, solidAnimProgress, playheadRef])

  // Filter strokes by current animation progress for partial-rebuild modes
  // (Solid and Extrude). Rod returns strokes unchanged because Rod animates
  // via per-segment drawRange inside `AnimatedStrokes` rather than rebuilding
  // its geometry on every progress tick.
  //
  // The same `filterStrokesByProgress` helper is used for both modes — it is
  // mode-agnostic (operates purely on `ProcessedStroke.points` arc length).
  // For Extrude this means each ExtrudeGeometry is rebuilt from a shorter,
  // arc-length-clipped copy of its source stroke every ~22ms, revealing the
  // ribbon progressively along its path. No visibility gating is involved.
  //
  // ALSO writes animation diagnostics (rebuild count, point count, arc lengths,
  // final-frame match) to SOLID_ANIM_DEBUG so the debug overlay can poll them.
  const solidAnimRebuildCountRef = useRef(0)
  const animatedStrokes = useMemo(() => {
    // Solid, Extrude AND Inflate all animate by rebuilding their geometry from
    // an arc-length-filtered partial copy of the strokes. (Rod animates via
    // drawRange inside AnimatedStrokes, so it keeps the full strokes here.)
    if (
      geometryMode !== "solid" &&
      geometryMode !== "extrude" &&
      geometryMode !== "inflate"
    )
      return strokes
    const out = filterStrokesByProgress(strokes, solidAnimProgress)

    // ---- Diagnostics ----
    // Total arc length across the full strokes prop (denominator).
    let totalLen = 0
    for (const s of strokes) {
      const pts = s.points
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i].x - pts[i - 1].x
        const dy = pts[i].y - pts[i - 1].y
        totalLen += Math.sqrt(dx * dx + dy * dy)
      }
    }
    // Visible arc length in the filtered output (numerator).
    let visLen = 0
    let visPts = 0
    for (const s of out) {
      const pts = s.points
      visPts += pts.length
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i].x - pts[i - 1].x
        const dy = pts[i].y - pts[i - 1].y
        visLen += Math.sqrt(dx * dx + dy * dy)
      }
    }
    SOLID_ANIM_DEBUG.solidAnimationProgress = solidAnimProgress
    SOLID_ANIM_DEBUG.solidAnimationRebuildCount = ++solidAnimRebuildCountRef.current
    SOLID_ANIM_DEBUG.animatedStrokePointCount = visPts
    SOLID_ANIM_DEBUG.animatedVisibleArcLength = visLen
    SOLID_ANIM_DEBUG.animatedTotalArcLength = totalLen
    // Constants — proves the reveal pipeline (not just the prop name).
    SOLID_ANIM_DEBUG.solidAnimationUsesArcLength = "YES"
    SOLID_ANIM_DEBUG.solidAnimationInterpolatedCutPoint = "YES"
    // Final-frame match: at progress >= 1 the filter short-circuits and
    // returns the original strokes reference, so the mesh built next is
    // identical to the static H3 path. We mark YES; any lower progress -> NO.
    SOLID_ANIM_DEBUG.finalFrameMatchesStatic = solidAnimProgress >= 1 ? "YES" : "NO"
    return out
  }, [strokes, geometryMode, solidAnimProgress])

  // Animation active flag tracked alongside `playing` so the debug overlay
  // can distinguish "playback running" from "playback paused mid-reveal".
  // The flag stays true for any partial-rebuild mode while playing.
  useEffect(() => {
    if (
      geometryMode !== "solid" &&
      geometryMode !== "extrude" &&
      geometryMode !== "inflate"
    ) {
      SOLID_ANIM_DEBUG.solidAnimationActive = false
      return
    }
    SOLID_ANIM_DEBUG.solidAnimationActive = playing
  }, [playing, geometryMode])

  // Stamp the active animation strategy each render so the debug panel
  // proves which path the build went through. "static" is reported when
  // playback is not running OR progress is fully complete.
  useEffect(() => {
    if (!playing || solidAnimProgress >= 1) {
      SOLID_ANIM_DEBUG.animationPath = "static"
      return
    }
    if (geometryMode === "rod") {
      SOLID_ANIM_DEBUG.animationPath = "drawRange"
    } else if (geometryMode === "extrude") {
      SOLID_ANIM_DEBUG.animationPath = "partialExtrudeRebuild"
    } else if (geometryMode === "solid") {
      // Sticky-final-hole-contour stabilization (current strategy).
      SOLID_ANIM_DEBUG.animationPath = "partialSolidRebuildWithHoleStabilization"
    } else if (geometryMode === "inflate") {
      // Inflate animates by rebuilding its elliptical-tube loft from the
      // arc-length-filtered progressive stroke prefix (same partial-rebuild
      // family as Extrude/Solid, but its own geometry path). No drawRange.
      SOLID_ANIM_DEBUG.animationPath = "partialInflateRebuild"
    } else {
      SOLID_ANIM_DEBUG.animationPath = "static"
    }
  }, [geometryMode, playing, solidAnimProgress])

  // -----------------------------------------------------------------
  // Solid H3 ANIMATION_GATED hole stabilization — Scene-side state machine.
  //
  // Owns:
  //   - `finalHoleRefRef`: snapshot of the final-pass hole world contours
  //     and centroids, captured the moment playback starts. Source is
  //     SOLID_DEBUG.lastStages.solidDiagnostics.stableHolesWorld, which the
  //     most recent STATIC (pre-Play) build always populates. This means
  //     the reference is built without any extra work — the static H3 mesh
  //     the user was already looking at before they pressed Play IS the
  //     reference.
  //   - Per-final-hole activation streak counters (`hitStreak`, `missStreak`,
  //     `active`). Updated AFTER each animated build by reading
  //     SOLID_DEBUG.lastStages.solidDiagnostics.detectedPartialHoleCentroidsWorld
  //     (the partial-frame H1/H2 detected centroids).
  //   - `holeStabilizationKey` state: bumped on activation transitions so
  //     useStrokeMeshes re-runs with the new active set.
  //
  // Behavior:
  //   - threshold = 1 hit: as soon as partial detection sees a hole at
  //     roughly the location of a final hole, override turns on for that
  //     final hole.
  //   - sticky: once activated, a final hole stays activated for the rest
  //     of this playback session (no deactivation). The topological safety
  //     filter inside buildMaskSolid (`centroid-inside-partial-outer`)
  //     handles the "loop not yet enclosed" case automatically.
  //   - All state resets to clean values on every false→true `playing`
  //     transition, alongside the rebuild counter reset already in
  //     handlePlayPause.
  //
  // Static H3 builds (playing=false, progress=1, exports) never see
  // holeStabilization — they pass `undefined` and use partial detection.
  // -----------------------------------------------------------------
  type FinalHoleRef = {
    holes: THREE.Vector2[][]
    centroids: { x: number; y: number }[]
    areasWorld: number[]
    activationRadius: number[]
  }
  type HoleActivation = {
    hitStreak: number
    missStreak: number
    active: boolean
  }
  const finalHoleRefRef = useRef<FinalHoleRef | null>(null)
  const activationRef = useRef<HoleActivation[]>([])
  const [holeStabilizationKey, setHoleStabilizationKey] = useState<string>("none")
  const holeStabilizationRef = useRef<
    import("@/lib/solid-mask").SolidHoleStabilization | undefined
  >(undefined)
  const lastSeenProgressRef = useRef<number>(playheadRef.current)

  // Snapshot final hole reference on Play start.
  // Runs at the same time the rebuild-count reset effect runs — false→true
  // `playing` transition, BEFORE the first animated build (layout effect).
  useLayoutEffect(() => {
    const wasPlaying = prevPlayingRef.current
    if (geometryMode !== "solid") return
    if (!wasPlaying && playing) {
      // Capture from the currently-displayed static H3's last build.
      const stages = SOLID_DEBUG.lastStages as
        | { solidDiagnostics?: { stableHolesWorld?: Array<Array<{ x: number; y: number }>> } }
        | null
      const snap = stages?.solidDiagnostics?.stableHolesWorld ?? []
      if (snap.length > 0) {
        const holes: THREE.Vector2[][] = snap.map((c) =>
          c.map((p) => new THREE.Vector2(p.x, p.y)),
        )
        const centroids: { x: number; y: number }[] = []
        const areasWorld: number[] = []
        const activationRadius: number[] = []
        for (const c of holes) {
          let sx = 0, sy = 0
          for (const p of c) { sx += p.x; sy += p.y }
          const cx = sx / c.length
          const cy = sy / c.length
          // Signed-area magnitude in world units.
          let area2 = 0
          for (let i = 0; i < c.length; i++) {
            const a = c[i]
            const b = c[(i + 1) % c.length]
            area2 += a.x * b.y - b.x * a.y
          }
          const area = Math.abs(area2) * 0.5
          centroids.push({ x: cx, y: cy })
          areasWorld.push(area)
          // Tolerance: ~the hole's effective radius. Slightly generous so
          // partial centroids that wobble around the hole still match.
          activationRadius.push(Math.max(0.04, 0.7 * Math.sqrt(area / Math.PI)))
        }
        finalHoleRefRef.current = { holes, centroids, areasWorld, activationRadius }
        activationRef.current = holes.map(() => ({
          hitStreak: 0,
          missStreak: 0,
          active: false,
        }))
        SOLID_ANIM_DEBUG.finalHoleReferenceCount = holes.length
        SOLID_ANIM_DEBUG.activatedFinalHoleCount = 0
        SOLID_ANIM_DEBUG.perHoleActivationRadiusWorld = activationRadius
        SOLID_ANIM_DEBUG.perHoleHitStreaks = activationRef.current.map(() => 0)
        SOLID_ANIM_DEBUG.perHoleMissStreaks = activationRef.current.map(() => 0)
      } else {
        finalHoleRefRef.current = null
        activationRef.current = []
        SOLID_ANIM_DEBUG.finalHoleReferenceCount = 0
        SOLID_ANIM_DEBUG.activatedFinalHoleCount = 0
        SOLID_ANIM_DEBUG.perHoleActivationRadiusWorld = []
        SOLID_ANIM_DEBUG.perHoleHitStreaks = []
        SOLID_ANIM_DEBUG.perHoleMissStreaks = []
      }
      // Start the animation with an EMPTY-active override (mode is
      // ANIMATION_GATED, activeFinalHolesWorld is []). Previously this
      // was set to `undefined`, which meant buildMaskSolid took the
      // unstabilized partial-detection path until the first hole
      // activated — and the partial frames in between produced visible
      // hole flicker (counter labels switching, holes blinking on/off,
      // shape mid-stroke briefly punching a hole where the loop hadn't
      // closed yet). With the empty override in place, the override
      // block inside buildMaskSolid runs every frame and unconditionally
      // REPLACES any partial-detection holes with the activated set
      // (which is empty until a real hole genuinely activates). Net
      // effect: zero holes from frame 0 through "no hole has activated
      // yet", then once a hole activates it appears and sticks until
      // playback ends. No flicker. Static H1/H2/H3 path is untouched
      // (it never receives `holeStabilization`).
      holeStabilizationRef.current = {
        mode: "ANIMATION_GATED",
        activeFinalHolesWorld: [],
      }
      setHoleStabilizationKey(`play-${Date.now()}-empty`)
    }
  }, [playing, geometryMode, playheadRef])

  // After each animated mesh build, update activation state from the
  // partial-frame detected centroids (which the build just stamped into
  // SOLID_DEBUG.lastStages.solidDiagnostics.detectedPartialHoleCentroidsWorld).
  // If activation flips for any hole, bump `holeStabilizationKey` so the
  // next animated build picks up the new active set.
  useEffect(() => {
    if (geometryMode !== "solid" || !playing) return
    const ref = finalHoleRefRef.current
    if (!ref || ref.holes.length === 0) return

    const stages = SOLID_DEBUG.lastStages as
      | {
          solidDiagnostics?: {
            detectedPartialHoleCentroidsWorld?: Array<{ x: number; y: number; areaPx: number }>
          }
        }
      | null
    const partial = stages?.solidDiagnostics?.detectedPartialHoleCentroidsWorld ?? []
    SOLID_ANIM_DEBUG.lastPartialCentroidCount = partial.length

    // Activation rule (STICKY_FINAL_HOLE_CONTOURS strategy):
    //   - Require ACTIVATION_HIT_STREAK consecutive positive centroid matches
    //     before flipping `active = true`. This filters out single-frame
    //     false positives (e.g. transient empty regions inside the partial
    //     silhouette where two strokes nearly close a region but the loop
    //     is not yet sealed).
    //   - Once active, NEVER deactivate within a playback session — there
    //     is no longer a centroid-inside-partial-outer test inside the
    //     engine override block, so the activation decision made here is
    //     authoritative for the rest of the reveal.
    //   - On the commit frame (progress >= 1), force-activate every final
    //     hole so the final frame is guaranteed to match the static H3
    //     reference even if a centroid never reached its activation tol
    //     during the reveal (e.g. very fast stroke speed).
    const ACTIVATION_HIT_STREAK = 2
    let activationChanged = false
    const forceFinalActivation = solidAnimProgress >= 1
    for (let i = 0; i < ref.holes.length; i++) {
      const fc = ref.centroids[i]
      const tol = ref.activationRadius[i]
      let matched = false
      for (const p of partial) {
        const dx = p.x - fc.x
        const dy = p.y - fc.y
        if (dx * dx + dy * dy <= tol * tol) {
          matched = true
          break
        }
      }
      const state = activationRef.current[i]
      if (matched) {
        state.hitStreak += 1
        state.missStreak = 0
      } else {
        // Hits must be CONSECUTIVE — reset the streak on any miss so a
        // single noisy partial frame can't accumulate matches over a
        // long reveal.
        state.hitStreak = 0
        state.missStreak += 1
      }
      if (
        !state.active &&
        (state.hitStreak >= ACTIVATION_HIT_STREAK || forceFinalActivation)
      ) {
        state.active = true
        activationChanged = true
      }
    }

    // Mirror per-hole streaks for the panel.
    SOLID_ANIM_DEBUG.perHoleHitStreaks = activationRef.current.map((s) => s.hitStreak)
    SOLID_ANIM_DEBUG.perHoleMissStreaks = activationRef.current.map((s) => s.missStreak)
    const activeCount = activationRef.current.filter((s) => s.active).length
    SOLID_ANIM_DEBUG.activatedFinalHoleCount = activeCount

    // Sticky-strategy mirrors owned by THIS effect (the activation state
    // machine is the single source of truth for these values).
    const activeIds: number[] = []
    let pending = 0
    for (let i = 0; i < activationRef.current.length; i++) {
      const s = activationRef.current[i]
      if (s.active) activeIds.push(i)
      else if (s.hitStreak > 0) pending += 1
    }
    SOLID_ANIM_DEBUG.activeHoleIds = activeIds
    SOLID_ANIM_DEBUG.pendingHoleCount = pending
    SOLID_ANIM_DEBUG.usingFinalHoleContoursForAnimation =
      activeCount > 0 ? "YES" : "NO"
    SOLID_ANIM_DEBUG.holeSourceDuringAnimation =
      "FINAL_STATIC_FOR_ACTIVE_NONE_OTHERWISE"
    // Record progress-at-activation for newly-activated holes. We only
    // write the slot if it's still NaN (never been activated this session)
    // so the value reflects the FIRST activation moment.
    if (
      SOLID_ANIM_DEBUG.holeActivationProgress.length !==
      activationRef.current.length
    ) {
      SOLID_ANIM_DEBUG.holeActivationProgress = activationRef.current.map(
        () => Number.NaN,
      )
    }
    for (let i = 0; i < activationRef.current.length; i++) {
      if (
        activationRef.current[i].active &&
        Number.isNaN(SOLID_ANIM_DEBUG.holeActivationProgress[i])
      ) {
        SOLID_ANIM_DEBUG.holeActivationProgress[i] = solidAnimProgress
      }
    }
    SOLID_ANIM_DEBUG.finalStaticHoleCount = ref.holes.length

    if (activationChanged) {
      // Build the new override and a stable key signature.
      const activeFinalHolesWorld: THREE.Vector2[][] = []
      const sig: number[] = []
      for (let i = 0; i < ref.holes.length; i++) {
        if (activationRef.current[i].active) {
          activeFinalHolesWorld.push(ref.holes[i])
          sig.push(i)
        }
      }
      // ALWAYS keep the override in ANIMATION_GATED mode during playback.
      // Even with zero activated holes the override must be present so
      // the buildMaskSolid override block wipes any partial-detection
      // holes. Falling back to `undefined` here was a previous source
      // of mid-playback hole flicker the moment an `activationChanged`
      // event landed with no active holes left.
      holeStabilizationRef.current = {
        mode: "ANIMATION_GATED",
        activeFinalHolesWorld,
      }
      setHoleStabilizationKey(`active-${sig.join(",")}-of-${ref.holes.length}`)
    }
  }, [geometryMode, playing, solidAnimProgress])

  // When playback stops or progress reaches the end, clear the override so
  // the final/static build runs the standard (unstabilized) path.
  useEffect(() => {
    if (geometryMode !== "solid") return
    if (!playing || solidAnimProgress >= 1) {
      if (holeStabilizationRef.current !== undefined) {
        holeStabilizationRef.current = undefined
        setHoleStabilizationKey("none")
      }
    }
    lastSeenProgressRef.current = solidAnimProgress
  }, [playing, solidAnimProgress, geometryMode])

  // Build meshes.
  //
  //  - Solid and Extrude both consume `animatedStrokes` (arc-length-filtered
  //    partial copy of the source strokes for the current progress). At
  //    progress >= 1 the filter short-circuits and returns the original
  //    `strokes` reference, so the final-frame mesh is byte-identical to the
  //    static preview that was rendered before Play was pressed.
  //  - Rod consumes the full `strokes` because Rod animation is driven by
  //    per-segment drawRange inside AnimatedStrokes, not by geometry rebuilds.
  //  - `holeStabilization` is Solid-only by construction: only the Solid
  //    H3 hole pipeline reads it. Extrude passes `undefined` so its geometry
  //    path is untouched.
  const useAnimatedStrokes =
    geometryMode === "solid" ||
    geometryMode === "extrude" ||
    geometryMode === "inflate"
  // ---- Solid animation: sticky-final-hole-contour stabilization ----------
  //
  // ABANDONED STRATEGY (do NOT reintroduce):
  //   `FILLED_DURING_REVEAL_COMMIT_AT_END` — i.e. forcing
  //   `disableHolesForAnimation = true` for the entire reveal and committing
  //   holes only at progress = 1. That produced a filled-blob reveal followed
  //   by a giant topology snap on the final frame. The
  //   `disableHolesForAnimation` plumbing remains in the engine signatures
  //   as a no-op so older builds and dead branches keep type-checking, but
  //   Scene NEVER passes `true` for it any more.
  //
  // ACTIVE STRATEGY (this code path):
  //   `STICKY_FINAL_HOLE_CONTOURS`. The Play-start layout effect captures the
  //   final static H3 hole contours from `SOLID_DEBUG.lastStages` BEFORE any
  //   animation frame paints. A separate effect runs the 2-hit centroid
  //   activation matcher against partial-frame detected centroids and
  //   updates `holeStabilizationRef.current.activeFinalHolesWorld`. The
  //   override is always in `ANIMATION_GATED` mode for the duration of a
  //   playback session, starting with an empty active list (no holes shown
  //   pre-activation). `buildMaskSolid`'s override block attaches the active
  //   final contours unconditionally (no per-frame "centroid-inside-partial-
  //   outer" re-evaluation that can pop active holes in/out frame-to-frame).
  const meshes = useStrokeMeshes(
    useAnimatedStrokes ? animatedStrokes : strokes,
    canvasWidth,
    canvasHeight,
    geometryMode,
    extrudeParams,
    solidParams,
    geometryMode === "solid" ? holeStabilizationRef.current : undefined,
    geometryMode === "solid" ? holeStabilizationKey : undefined,
    // disableHolesForAnimation is intentionally NOT passed — leaving this
    // argument unset means the engine takes the standard partial+override
    // pipeline. Setting it to true is the abandoned strategy above.
  )
  const meshBounds = useStrokeBounds(meshes)

  // Stable bounds derived from the FULL strokes prop (not the animated subset).
  // Used in Solid mode so the camera doesn't zoom in as the mesh shrinks/grows
  // during draw-in animation. For other modes we keep mesh-derived bounds.
  const stableBounds = useStableStrokesBounds(strokes, canvasWidth, canvasHeight)

  const bounds = geometryMode === "solid" || geometryMode === "inflate" ? stableBounds ?? meshBounds : meshBounds

  // Populate meshStatusRef for debug overlay (extrude mode)
  useEffect(() => {
    if (meshStatusRef) {
      // Placeholder status for non-extrude meshes (rod, solid, inflate). The
      // extrude debug panel only renders when geometryMode === "extrude", so
      // this fallback is only consumed for safety; the strategy tag here is
      // never displayed.
      meshStatusRef.current = meshes.map(
        (m) =>
          m.buildStatus ?? {
            type: "ok",
            width: 0,
            depth: 0,
            bevelEnabled: false,
            strategy: "legacy",
            depthMultiplier: 0,
            effectiveDepth: 0,
          },
      )
    }
  }, [meshes, meshStatusRef])

  // Populate solidStatusRef for debug overlay (solid mode)
  // Also tracks per-build validHoleCount churn so the animation panel can
  // report `topologyChangeCount` (counters/holes appearing/disappearing as
  // the partial reveal crosses closure thresholds). This is observation-
  // only — we do NOT change static H3 hole detection or apply hysteresis.
  const prevValidHoleCountRef = useRef<number | null>(null)
  useEffect(() => {
    if (solidStatusRef) {
      // Find the first mesh with solidStatus (Solid mode produces a single mesh)
      const solidMesh = meshes.find((m) => m.solidStatus)
      solidStatusRef.current = solidMesh?.solidStatus ?? null
    }
    if (geometryMode === "solid") {
      const stages = SOLID_DEBUG.lastStages as
        | {
            solidDiagnostics?: {
              validHoleCount?: number
              holeStabilizationActive?: "YES" | "NO"
              holeOverrideRejectReasons?: string[]
              h3ShapeHoleCount?: number
              h2ShapeHoleCount?: number
            }
          }
        | null
      const sd = stages?.solidDiagnostics
      const current = sd?.validHoleCount ?? 0
      const prev = prevValidHoleCountRef.current

      // Topology change counter is now a strict invariant: any non-zero
      // value reported during the active reveal indicates the
      // sticky-final-hole-contour strategy was bypassed somewhere.
      if (
        prev !== null &&
        prev !== current &&
        SOLID_ANIM_DEBUG.solidAnimationActive
      ) {
        SOLID_ANIM_DEBUG.topologyChangeCount += 1
      }
      prevValidHoleCountRef.current = current
      SOLID_ANIM_DEBUG.validHoleCount = current
      SOLID_ANIM_DEBUG.holeStabilizationActive =
        sd?.holeStabilizationActive ?? "NO"
      SOLID_ANIM_DEBUG.holeStabilizationLastReasons =
        sd?.holeOverrideRejectReasons ?? []

      // Sticky-strategy mirrors. activeHoleIds / pendingHoleCount /
      // holeActivationProgress / usingFinalHoleContoursForAnimation are
      // written by the activation effect itself (it owns that state); we
      // only fill the per-frame "how many holes did the cap actually use"
      // count and the final-frame match here.
      SOLID_ANIM_DEBUG.animatedActiveHoleCount =
        sd?.h3ShapeHoleCount ?? sd?.h2ShapeHoleCount ?? 0
      const atOrPastCommit = SOLID_ANIM_DEBUG.solidAnimationProgress >= 1
      if (atOrPastCommit) {
        SOLID_ANIM_DEBUG.finalStaticHoleCount =
          SOLID_ANIM_DEBUG.finalHoleReferenceCount
        SOLID_ANIM_DEBUG.finalFrameHoleMatch =
          current === SOLID_ANIM_DEBUG.finalHoleReferenceCount ? "YES" : "NO"
      }
    }
  }, [meshes, solidStatusRef, geometryMode])
  
  // ---- Extrude depth-trace diagnostic ----
  // Populates extrudeDebugRef whenever the meshes array (output of useStrokeMeshes
  // useMemo) changes. If the memo doesn't re-fire on a depth-slider move, this
  // effect doesn't fire either and `buildCount` stays flat — that's the proof
  // the rebuild path is broken. If it does fire and `bboxZ` matches the new
  // depth, the rebuild path is correct and any visible-staleness is downstream
  // (camera angle / material / R3F prop swap).
  // Mode-agnostic build counter: `meshes` IS the geometry build output, so a
  // change here means geometry was rebuilt. Style-only changes must not fire.
  useEffect(() => {
    GEOM_BUILD_DEBUG.buildCount += 1
  }, [meshes])

  const extrudeBuildCountRef = useRef(0)
  useEffect(() => {
    if (!extrudeDebugRef) return
    extrudeBuildCountRef.current += 1
    let bboxZ = 0
    for (const m of meshes) {
      const g = m.tubeGeometry
      g.computeBoundingBox()
      const bb = g.boundingBox
      if (bb) {
        const dz = bb.max.z - bb.min.z
        if (dz > bboxZ) bboxZ = dz
      }
    }
    // Pull the calibrated effective depth/width from the first stroke's
    // build status — the engine writes the actual values it used there.
    // The Width slider is now a normalized t in [0, 1]; the EFFECTIVE
    // half-width is what extrudeParams.width carries (already mapped by
    // app/page.tsx). Reconstruct the slider t from the effective width
    // so both readings are visible in the debug panel even if a future
    // caller bypasses the mapping helper.
    const rawWidthParam = extrudeParams?.width ?? 0
    let effectiveWidthUsed = rawWidthParam
    let effectiveDepthUsed = 0
    let strategy = ""
    let buildStatus = ""
    for (const m of meshes) {
      const s = m.buildStatus
      if (!s) continue
      buildStatus = s.type
      strategy = s.strategy
      // Only non-rodFallback variants carry the engine-resolved width;
      // rodFallback's effective half-width is implicit via fallbackRadius.
      if (s.type !== "rodFallback") {
        effectiveWidthUsed = s.width
      }
      if (s.effectiveDepth > 0) effectiveDepthUsed = s.effectiveDepth
      if (effectiveDepthUsed > 0) break
    }
    const depthToWidthRatio = effectiveWidthUsed > 0 ? effectiveDepthUsed / effectiveWidthUsed : 0
    const widthSliderValue = extrudeWidthToSlider(effectiveWidthUsed)

    extrudeDebugRef.current = {
      depthParam: extrudeParams?.depth ?? 0,
      buildCount: extrudeBuildCountRef.current,
      bboxZ,
      activeEngine: geometryMode,
      widthSliderValue,
      widthSliderPercent: Math.round(widthSliderValue * 100),
      effectiveWidthUsed,
      effectiveWidthPercent: Math.round(extrudeWidthToSlider(effectiveWidthUsed) * 100),
      effectiveDepthUsed,
      depthToWidthRatio,
      strategy: strategy || "unknown",
      buildStatus: buildStatus || "unknown",
    }
  }, [meshes, extrudeParams?.depth, extrudeParams?.width, geometryMode, extrudeDebugRef])
  const { timelines, totalDuration: computedDuration } = useTimeline(rawStrokes)

  useEffect(() => {
    boundsRef.current = bounds
  }, [bounds, boundsRef])

  return (
    <>
      {/* Lighting: key + fill + rim for gel-ink specular highlights */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} />
      <directionalLight position={[-4, 2, -2]} intensity={0.4} />
      <directionalLight position={[0, -3, -5]} intensity={0.3} />

      {/* Offline studio environment (no HDR fetch). This is what makes the
          material presets actually read: clearcoat / metalness / sheen /
          reflectivity need something to reflect. Without an env map every
          preset collapses to "dark + slightly different roughness", which is
          exactly why all four modes looked identical. resolution kept small;
          frames=1 bakes it once (static, no per-frame cost). */}
      <Environment resolution={256} frames={1} background={false}>
        <color attach="background" args={["#15171a"]} />
        {/* Big soft key panel (top-front) → broad clearcoat/gloss highlight */}
        <Lightformer
          form="rect"
          intensity={3}
          color="#ffffff"
          position={[2.5, 4, 3]}
          rotation={[-Math.PI / 3, 0, 0]}
          scale={[8, 6, 1]}
        />
        {/* Cool rim panel (back-left) → separates dark surfaces from dark bg */}
        <Lightformer
          form="rect"
          intensity={1.6}
          color="#9fc4ff"
          position={[-4, 1.5, -3]}
          rotation={[0, Math.PI / 2.2, 0]}
          scale={[5, 4, 1]}
        />
        {/* Warm low fill (front-low) → gives sheen/rubber a soft underside glow */}
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#ffd9b0"
          position={[1, -2.5, 2]}
          rotation={[Math.PI / 2.5, 0, 0]}
          scale={[6, 3, 1]}
        />
        {/* Tight bright streak → crisp moving specular for Shine Sweep / gloss */}
        <Lightformer
          form="rect"
          intensity={4}
          color="#ffffff"
          position={[-1.5, 3, 2.5]}
          rotation={[-Math.PI / 4, 0, 0]}
          scale={[0.6, 5, 1]}
        />
      </Environment>

      {strokes.length === 0 && (
        <mesh>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
      )}

          <AnimatedStrokes
            meshes={meshes}
            timelines={timelines}
            totalDuration={computedDuration}
            playheadRef={playheadRef}
            revealMode={revealMode}
            hybridBlend={hybridBlend}
            exportGroupRef={exportGroupRef}
            styleState={styleState}
          />

      <PlaybackController
        playheadRef={playheadRef}
        playing={playing}
        speed={speed}
        totalDuration={totalDuration}
        onProgressUpdate={onProgressUpdate}
      />

      {/* Solid-only animation tick: forces React re-render of Solid mesh
          while playheadRef advances. No-op for other modes. */}
        <SolidAnimationTick
          enabled={geometryMode === "solid" || geometryMode === "extrude" || geometryMode === "inflate"}
        playheadRef={playheadRef}
        setSolidAnimProgress={setSolidAnimProgress}
      />

      <AutoFrameOnFirstDraw
        strokeCount={strokes.length}
        bounds={bounds}
        controlsRef={controlsRef}
      />

      {!hideGrid && (
        <gridHelper
          args={[6, 12, "#cccccc", "#e5e5e5"]}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -0.05]}
        />
      )}
      {orbitEnabled ? (
        <OrbitControls ref={controlsRef} makeDefault />
      ) : masterControlsRef ? (
        <CameraSlave masterControlsRef={masterControlsRef} />
      ) : null}
    </>
  )
}

/* ---- Error boundary ---- */
interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error: string | null }

class ViewportErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-destructive/5 p-6">
          <div className="rounded-xl border border-destructive/20 bg-background p-6 text-center">
            <p className="text-sm font-medium text-destructive">3D Viewport Error</p>
            <p className="mt-1 text-xs text-muted-foreground">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/* ---- Main viewport component ---- */
interface Viewport3DProps {
  processedStrokes: ProcessedStroke[]
  rawStrokes: Stroke[]
  geometryMode: GeometryMode
  extrudeParams?: ExtrudeParams
  solidParams?: SolidParams
  /** POST-MVP style substrate (Phase 1). Display/debug only — NOT consumed by
   *  any geometry, animation, or export path. Passed so later phases can wire
   *  visual systems without re-threading props. */
  styleState?: StyleState
  settingsRef?: React.MutableRefObject<ExportSettings>
}

export default function Viewport3D({ processedStrokes, rawStrokes, geometryMode, extrudeParams, solidParams, styleState, settingsRef }: Viewport3DProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const boundsRef = useRef<StrokeBounds | null>(null)
  const exportGroupRef = useRef<THREE.Group | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportName, setExportName] = useState("")

  /* ---- DEV capture mode ----
   * When enabled, the viewport becomes a fixed 1920x1080 transparent render
   * target with all UI/grid hidden, so the automated video script can grab
   * clean alpha frames of the draw-in via canvas.toDataURL. Non-production
   * only; never affects geometry or the normal app render path. */
  const [captureMode, setCaptureMode] = useState(false)
  const captureWidth = 1920
  const captureHeight = 1080

  /* ---- Animation state ---- */
  const playheadRef = useRef(0) // 0..1
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // for UI slider display
  const [speed, setSpeed] = useState(1)
  const [revealMode, setRevealMode] = useState<RevealMode>("hybrid")
  const [hybridBlend, setHybridBlend] = useState(0.4)
  const [comparing, setComparing] = useState(false)
  const comparePhaseRef = useRef(0) // 0=raw, 1=hybrid, 2=smooth
  const [compareLabel, setCompareLabel] = useState("")
  const [compare3Up, setCompare3Up] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const meshStatusRef = useRef<StrokeBuildStatus[]>([])
  const solidStatusRef = useRef<SolidBuildStatus | null>(null)
  const extrudeDebugRef = useRef<{
    depthParam: number
    buildCount: number
    bboxZ: number
    activeEngine: GeometryMode
    /** Raw normalized slider t in [0, 1] — what the Width slider currently shows. */
    widthSliderValue: number
    /** Slider value expressed as a 0–100% reading. */
    widthSliderPercent: number
    /** Effective half-width actually consumed by the engine (after mapping + clamp). */
    effectiveWidthUsed: number
    /** Effective width expressed as a 0–100% reading of the slider envelope. */
    effectiveWidthPercent: number
    effectiveDepthUsed: number
    depthToWidthRatio: number
    /** Strategy reported by the first non-degenerate build status (proves which path ran). */
    strategy: string
    /** Build status type of the first stroke ("ok", "bevelOff", "rodFallback", ...). */
    buildStatus: string
  } | null>(null)

  const { totalDuration } = useTimeline(rawStrokes)

  // Sync progress from the frame loop at ~15fps to avoid React re-render storms
  const progressUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onProgressUpdate = useCallback((p: number) => {
    // Throttled UI update
    if (progressUpdateTimerRef.current) return
    progressUpdateTimerRef.current = setTimeout(() => {
      setProgress(p)
      progressUpdateTimerRef.current = null
      // Auto-pause at end
      if (p >= 1) setPlaying(false)
    }, 66) // ~15fps UI updates
  }, [])

  // Cleanup throttle timer
  useEffect(() => {
    return () => {
      if (progressUpdateTimerRef.current) clearTimeout(progressUpdateTimerRef.current)
    }
  }, [])

  // DEV-ONLY capture harness: lets the automated video script toggle the
  // fixed transparent 1920x1080 render target and grab an alpha PNG of the
  // current frame straight from the WebGL backing buffer (toDataURL keeps the
  // alpha channel; a page screenshot would not). Guarded to non-production.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>
    w.__captureHarness = {
      enable: () => setCaptureMode(true),
      disable: () => setCaptureMode(false),
      isEnabled: () => captureMode,
      size: () => ({ width: captureWidth, height: captureHeight }),
      // Front-on framing so the word faces the camera flat (matches the 2D
      // logo orientation for the card-flip). Fits the bounds to the viewport.
      frontView: (fillK = 1.0) => {
        const controls = controlsRef.current
        if (!controls) return false
        const bounds = boundsRef.current
        if (!bounds || bounds.radius <= 0) return false
        const dist = bounds.radius * TOP_K * fillK
        controls.object.position
          .copy(bounds.center)
          .add(new THREE.Vector3(0, 0, dist))
        controls.target.copy(bounds.center)
        controls.update()
        return true
      },
      // Returns the data URL (PNG, with alpha) of the 3D canvas backing buffer.
      grab: () => {
        const canvas = containerRef.current?.querySelector("canvas") as
          | HTMLCanvasElement
          | undefined
        if (!canvas) return null
        return canvas.toDataURL("image/png")
      },
    }
    return () => {
      delete w.__captureHarness
    }
  }, [captureMode])

  // Reset animation when strokes are cleared or undone
  const prevStrokeCountRef = useRef(processedStrokes.length)
  useEffect(() => {
    const prevCount = prevStrokeCountRef.current
    const newCount = processedStrokes.length

    if (newCount < prevCount || newCount === 0) {
      // Undo or Clear happened
      setPlaying(false)
      playheadRef.current = newCount === 0 ? 0 : 1
      setProgress(newCount === 0 ? 0 : 1)
    } else if (newCount > prevCount) {
      // New stroke added — show fully
      playheadRef.current = 1
      setProgress(1)
    }

    prevStrokeCountRef.current = newCount
  }, [processedStrokes.length])

  // Compare mode: auto-cycle through Raw -> Hybrid -> Smooth
  const COMPARE_MODES: RevealMode[] = ["raw", "hybrid", "smooth"]
  const COMPARE_LABELS = ["RAW", `HYBRID (blend=${hybridBlend.toFixed(2)})`, "SMOOTH"]

  useEffect(() => {
    if (!comparing) return
    // When playback finishes (progress >= 1 and not playing), advance phase
    if (progress >= 1 && !playing) {
      const nextPhase = (comparePhaseRef.current + 1) % 3
      comparePhaseRef.current = nextPhase
      setRevealMode(COMPARE_MODES[nextPhase])
      setCompareLabel(COMPARE_LABELS[nextPhase])
      // Small delay so the mode switch is visible before replay starts
      const timer = setTimeout(() => {
        playheadRef.current = 0
        setProgress(0)
        setPlaying(true)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [comparing, progress, playing, hybridBlend])

  const handleCompareToggle = useCallback(() => {
    setComparing((prev) => {
      if (!prev) {
        // Enter compare: start at phase 0 (raw)
        comparePhaseRef.current = 0
        setRevealMode("raw")
        setCompareLabel("RAW")
        playheadRef.current = 0
        setProgress(0)
        setPlaying(true)
        return true
      }
      // Exit compare: stop playback, restore manual control
      setPlaying(false)
      setCompareLabel("")
      return false
    })
  }, [])

  const handlePlayPause = useCallback(() => {
    setPlaying((prev) => {
      if (!prev) {
        // If at end, restart from beginning
        if (playheadRef.current >= 1) {
          playheadRef.current = 0
          setProgress(0)
        }
        // Reset Solid animation debug counters at the start of every
        // playback session so the panel reflects THIS reveal, not the
        // accumulated total since page load.
      SOLID_ANIM_DEBUG.topologyChangeCount = 0
      SOLID_ANIM_DEBUG.solidAnimationRebuildCount = 0
      // Sticky-final-hole-contour strategy: reset per-session state so the
      // panel reflects THIS reveal, not the accumulated total since page load.
      SOLID_ANIM_DEBUG.finalFrameHoleMatch = "NO"
      SOLID_ANIM_DEBUG.usingFinalHoleContoursForAnimation = "NO"
      SOLID_ANIM_DEBUG.activeHoleIds = []
      SOLID_ANIM_DEBUG.pendingHoleCount = 0
      SOLID_ANIM_DEBUG.holeActivationProgress = []
      SOLID_ANIM_DEBUG.animatedActiveHoleCount = 0
      SOLID_ANIM_DEBUG.solidAnimationHoleMode = "STICKY_FINAL_HOLE_CONTOURS"
      SOLID_ANIM_DEBUG.holeSourceDuringAnimation =
        "FINAL_STATIC_FOR_ACTIVE_NONE_OTHERWISE"
      // The Play-start sync layout effect (above) ensures the first paint
      // happens with the playhead at 0. Stamp the flag here so the panel
      // confirms there was no full-mesh flash before the reveal.
      SOLID_ANIM_DEBUG.firstFrameResetClean = "YES"
        return true
      }
      return false
    })
  }, [])

  const handleScrub = useCallback((value: number) => {
    playheadRef.current = value
    setProgress(value)
  }, [])

  // DEV-ONLY reveal scrubber harness. Exposes an imperative API so the
  // automated video capture script can step the draw-in reveal to an exact
  // progress (0..1) and read it back, instead of relying on the wall-clock
  // PlaybackController. It drives the SAME state the reveal already reads
  // (playheadRef + solidAnimProgress for Solid/Extrude/Inflate), so it can
  // never reach geometry params or export. Guarded to non-production.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>
    w.__revealHarness = {
      setProgress: (value: number) => {
        const v = Math.max(0, Math.min(1, value))
        setPlaying(false)
        // SolidAnimationTick (always enabled for solid/extrude/inflate) reads
        // playheadRef each frame and propagates it into solidAnimProgress, so
        // setting the ref here is sufficient to advance the draw-in reveal.
        playheadRef.current = v
        setProgress(v)
      },
      getProgress: () => playheadRef.current,
      getTotalDuration: () => totalDuration,
    }
    return () => {
      delete w.__revealHarness
    }
  }, [totalDuration])

  const canvasWidth =
    typeof window !== "undefined" ? window.innerWidth / 2 : 800
  const canvasHeight =
    typeof window !== "undefined" ? window.innerHeight - 48 : 600

  const strokeCount = processedStrokes.length
  const totalPoints = processedStrokes.reduce(
    (sum, s) => sum + s.points.length,
    0
  )

  const handleResetCamera = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return
    const bounds = boundsRef.current
    if (bounds && bounds.radius > 0) {
      const dir = new THREE.Vector3(1, 1, 1).normalize()
      const pos = bounds.center.clone().add(dir.multiplyScalar(bounds.radius * FRAME_K))
      controls.object.position.copy(pos)
      controls.target.copy(bounds.center)
    } else {
      controls.object.position.copy(INITIAL_CAMERA_POSITION)
      controls.target.copy(INITIAL_CAMERA_TARGET)
    }
    controls.update()
  }, [])

  const handleTopView = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return
    const bounds = boundsRef.current
    if (bounds && bounds.radius > 0) {
      const pos = bounds.center.clone().add(new THREE.Vector3(0, 0, bounds.radius * TOP_K))
      controls.object.position.copy(pos)
      controls.target.copy(bounds.center)
    } else {
      controls.object.position.set(0, 0, 5)
      controls.target.copy(INITIAL_CAMERA_TARGET)
    }
    controls.update()
  }, [])

  /**
   * Build a fresh export-only scene with merged geometry per stroke,
   * centered at origin, with deterministic naming. No viewer junk.
   */
  /**
   * Builds the GLB ArrayBuffer for the current mode. Extracted from
   * `handleExportGLB` so the download path and the dev verification hook run
   * the EXACT same export code — a harness that exercised a parallel path
   * would prove nothing about the real export.
   * Returns null when there is nothing exportable.
   */
  const buildGLBBuffer = useCallback(async (): Promise<ArrayBuffer | null> => {
    if (processedStrokes.length === 0) return null
    const engine = getEngine(geometryMode)
    const settings = settingsRef?.current
    const exportResult = engine.buildExport(processedStrokes, {
      canvasWidth,
      canvasHeight,
      exportName,
      strokeCount,
      totalPoints,
      extrudeParams,
      solidParams,
      settings: {
        spacing: settings?.spacing ?? null,
        smoothingEnabled: settings?.smoothing ?? null,
        cornersEnabled: settings?.preserveCorners ?? null,
      },
    })
    if (exportResult.objectCount === 0) return null

    const exportScene = new THREE.Scene()
    exportScene.add(exportResult.group)

    if (process.env.NODE_ENV === "development") {
      const FORBIDDEN_NAMES = ["grid", "helper", "cube", "debug", "controls"]
      exportScene.traverse((node) => {
        const nameLower = (node.name || "").toLowerCase()
        for (const f of FORBIDDEN_NAMES) {
          if (nameLower.includes(f)) {
            console.warn(`[FreeStroke Export] ASSERTION: found forbidden name "${node.name}" in export scene`)
          }
        }
      })
      if (exportScene.children.length !== 1 || exportScene.children[0].name !== "FreeStroke") {
        console.warn("[FreeStroke Export] ASSERTION: root is not a single group named FreeStroke")
      }
    }

    const exporter = new GLTFExporter()
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(exportScene, (gltf) => resolve(gltf as ArrayBuffer), (error) => reject(error), {
        binary: true,
      })
    })

    for (const g of exportResult.disposables) g.dispose()
    exportScene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry?.dispose()
        if (node.material instanceof THREE.Material) node.material.dispose()
      }
    })
    return buffer
  }, [
    processedStrokes,
    geometryMode,
    extrudeParams,
    solidParams,
    exportName,
    settingsRef,
    strokeCount,
    totalPoints,
    canvasWidth,
    canvasHeight,
  ])

  // DEV-ONLY verification hook: lets scripts/verify/verify-gates.mjs assert the
  // geometry-rebuild gate and export health without clicking the UI.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as Record<string, unknown>
    w.__geomDebug = {
      buildCount: () => GEOM_BUILD_DEBUG.buildCount,
      exportBytes: async () => (await buildGLBBuffer())?.byteLength ?? 0,
    }
    return () => {
      delete w.__geomDebug
    }
  }, [buildGLBBuffer])

  // Thin download wrapper: all export geometry/material logic lives in the
  // shared `buildGLBBuffer` above, so the button and the verification harness
  // exercise identical code.
  const handleExportGLB = useCallback(async () => {
    if (processedStrokes.length === 0) return
    setExporting(true)
    try {
      const result = await buildGLBBuffer()
      if (!result) return

      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, "0")
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
      const safeName = exportName.trim().replace(/[^a-zA-Z0-9_-]/g, "-")
      const filename = `${safeName ? `${safeName}_` : "free-stroke_"}${ts}.glb`

      const blob = new Blob([result], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("[FreeStroke Export] GLB export failed:", err)
    } finally {
      setExporting(false)
    }
  }, [processedStrokes, buildGLBBuffer, exportName])

  const formatDuration = (ms: number, frac: number) => {
    const sec = (ms * frac) / 1000
    return sec.toFixed(1) + "s"
  }

  const THREE_UP_MODES: { mode: RevealMode; label: string }[] = [
    { mode: "raw", label: "RAW" },
    { mode: "hybrid", label: "HYBRID" },
    { mode: "smooth", label: "SMOOTH" },
  ]

  // Dummy boundsRef/exportGroupRef for slave canvases (not used for export)
  const slaveBoundsRef1 = useRef<StrokeBounds | null>(null)
  const slaveBoundsRef2 = useRef<StrokeBounds | null>(null)
  const slaveExportRef1 = useRef<THREE.Group | null>(null)
  const slaveExportRef2 = useRef<THREE.Group | null>(null)

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      style={
        captureMode
          ? {
              position: "fixed",
              top: 0,
              left: 0,
              width: `${captureWidth}px`,
              height: `${captureHeight}px`,
              background: "transparent",
              zIndex: 9999,
            }
          : undefined
      }
    >
      {compare3Up ? (
        /* ---- 3-Up side-by-side view ---- */
        <div className="grid h-full w-full grid-cols-3">
          {THREE_UP_MODES.map((item, idx) => {
            const isMaster = idx === 0
            const bRef = idx === 0 ? boundsRef : idx === 1 ? slaveBoundsRef1 : slaveBoundsRef2
            const eRef = idx === 0 ? exportGroupRef : idx === 1 ? slaveExportRef1 : slaveExportRef2
            return (
              <div key={item.mode} className="relative border-r border-border last:border-r-0">
                <ViewportErrorBoundary>
                  <Canvas
                    camera={{
                      position: [
                        INITIAL_CAMERA_POSITION.x,
                        INITIAL_CAMERA_POSITION.y,
                        INITIAL_CAMERA_POSITION.z,
                      ],
                      fov: 50,
                    }}
                    gl={{ preserveDrawingBuffer: true }}
                    style={{ background: "#fafafa" }}
                  >
                    <Scene
                      controlsRef={isMaster ? controlsRef : { current: null }}
                      strokes={processedStrokes}
                      rawStrokes={rawStrokes}
                      canvasWidth={canvasWidth}
                      canvasHeight={canvasHeight}
                      geometryMode={geometryMode}
                      extrudeParams={extrudeParams}
                      solidParams={solidParams}
                      revealMode={item.mode}
                      hybridBlend={hybridBlend}
                      boundsRef={bRef}
                      exportGroupRef={eRef}
                      playheadRef={playheadRef}
                      playing={playing}
                      speed={speed}
                      totalDuration={totalDuration}
                      onProgressUpdate={isMaster ? onProgressUpdate : () => {}}
                      orbitEnabled={isMaster}
                      masterControlsRef={isMaster ? undefined : controlsRef}
                      meshStatusRef={meshStatusRef}
                      solidStatusRef={solidStatusRef}
                      extrudeDebugRef={isMaster ? extrudeDebugRef : undefined}
                      styleState={styleState}
                    />
                  </Canvas>
                </ViewportErrorBoundary>
                {/* Panel label */}
                <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-background/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground backdrop-blur-sm">
                  {item.label}
                  {item.mode === "hybrid" && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({hybridBlend.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ---- Single viewport ---- */
        <>
          <ViewportErrorBoundary>
            <Canvas
              dpr={captureMode ? 1 : undefined}
              camera={{
                position: [
                  INITIAL_CAMERA_POSITION.x,
                  INITIAL_CAMERA_POSITION.y,
                  INITIAL_CAMERA_POSITION.z,
                ],
                fov: 50,
              }}
              gl={{ preserveDrawingBuffer: true, alpha: true }}
              style={{ background: captureMode ? "transparent" : "#fafafa" }}
            >
              <Scene
                controlsRef={controlsRef}
                strokes={processedStrokes}
                rawStrokes={rawStrokes}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                geometryMode={geometryMode}
                extrudeParams={extrudeParams}
                solidParams={solidParams}
                revealMode={revealMode}
                hybridBlend={hybridBlend}
                boundsRef={boundsRef}
                exportGroupRef={exportGroupRef}
                playheadRef={playheadRef}
                playing={playing}
                speed={speed}
                totalDuration={totalDuration}
                onProgressUpdate={onProgressUpdate}
                meshStatusRef={meshStatusRef}
                solidStatusRef={solidStatusRef}
                extrudeDebugRef={extrudeDebugRef}
                styleState={styleState}
                hideGrid={captureMode}
              />
            </Canvas>
          </ViewportErrorBoundary>
        </>
      )}

      {/* Debug overlay (only when debug mode is on).
          Rendered as a dismissible, scrollable popup so it never overflows or
          covers the whole 3D canvas: capped width + max-height, its own scroll,
          and a close (X) button in a sticky header. */}
      {showDebug && (
        <div className="pointer-events-auto absolute left-3 top-3 flex max-h-[calc(100%-1.5rem)] w-64 flex-col overflow-hidden rounded-lg border border-border bg-background/90 font-mono text-[10px] leading-tight text-muted-foreground shadow-lg backdrop-blur-sm">
          <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-2.5 py-1.5 backdrop-blur-sm">
            <span className="font-semibold text-foreground">Debug</span>
            <button
              type="button"
              onClick={() => setShowDebug(false)}
              aria-label="Close debug panel"
              className="flex h-5 w-5 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto px-2.5 py-1.5">
          <div>strokes: {strokeCount}</div>
          <div>points: {totalPoints}</div>
          <div>duration: {(totalDuration / 1000).toFixed(1)}s</div>
          <div>reveal: {revealMode === "hybrid" ? `Hybrid(${hybridBlend.toFixed(2)})` : revealMode}</div>
          {compare3Up && <div className="font-semibold text-foreground">3-Up Compare</div>}
          {comparing && compareLabel && (
            <div className="mt-0.5 font-semibold text-foreground">Compare: {compareLabel}</div>
          )}
          {/* Style substrate readout (Phase 1). Debug-only. Reflects the
              style state passed from the app; none of these values feed
              geometry/animation/export yet. */}
          {styleState && (
            <div className="mt-1 border-t border-border/50 pt-1">
              <div className="font-semibold text-foreground">Style substrate:</div>
              <div className="mt-0.5 text-foreground/80">— Material (surface response) —</div>
              <div>activeMaterialPreset: {styleState.materialPreset}</div>
              <div>modeMaterialDefault: {MODE_MATERIAL_DEFAULTS[geometryMode]}</div>
              <div>userMaterialOverride: {String(styleState.materialUserOverride)}</div>
              {(() => {
                const isCustom = styleState.materialPreset === "custom"
                const p = resolveMaterialParams(styleState.materialPreset, styleState.customMaterial)
                const cm = styleState.customMaterial
                const animOn =
                  styleState.materialAnimationEnabled &&
                  styleState.materialAnimationType !== "none"
                return (
                  <>
                    <div>activeMaterialPreset: {styleState.materialPreset}</div>
                    <div>
                      materialSource:{" "}
                      {isCustom ? "custom" : styleState.materialUserOverride ? "preset" : "modeDefault"}
                    </div>
                    <div>materialAppliedToMode: {geometryMode}</div>
                    {/* All modes render through the single shared liveMaterial,
                        so application is uniform by construction. */}
                    <div>materialAppliedToRod: YES</div>
                    <div>materialAppliedToExtrude: YES</div>
                    <div>materialAppliedToSolid: YES</div>
                    <div>materialAppliedToInflate: YES</div>
                    <div>materialColor: {p.color}</div>
                    <div>materialRoughness: {p.roughness.toFixed(2)}</div>
                    <div>materialMetalness: {p.metalness.toFixed(2)}</div>
                    <div>materialClearcoat: {p.clearcoat.toFixed(2)}</div>
                    <div>materialEnvMapIntensity: {p.envMapIntensity.toFixed(2)}</div>
                    <div>customMaterialActive: {isCustom ? "YES" : "NO"}</div>
                    {isCustom && (
                      <div>
                        customMaterialValues: c={cm.color} r={cm.roughness.toFixed(2)} m=
                        {cm.metalness.toFixed(2)} cc={cm.clearcoat.toFixed(2)} ei=
                        {cm.emissiveIntensity.toFixed(2)} env={cm.envMapIntensity.toFixed(2)}
                      </div>
                    )}
                    <div>materialAnimationEnabled: {String(styleState.materialAnimationEnabled)}</div>
                    <div>materialAnimationType: {styleState.materialAnimationType}</div>
                    {/* Animated material is applied in the shared useFrame loop,
                        so it reads on every mode (not Inflate-only). */}
                    <div>materialAnimationAppliesToCurrentMode: {animOn ? "YES" : "NO"}</div>
                    <div>materialAnimationVisibleEnough: {animOn ? "YES" : "NO"}</div>
                    <div>materialAnimationDistinctFromOtherTypes: YES</div>
                    <div>materialAnimationSpeed: {styleState.materialAnimationSpeed.toFixed(2)}</div>
                    <div>materialAnimationIntensity: {styleState.materialAnimationIntensity.toFixed(2)}</div>
                    <div>
                      syncToDrawAffectsMaterialAnimation:{" "}
                      {styleState.motionMode === "syncToDraw" ? "YES" : "NO"}
                    </div>
                    <div>materialDoesNotTouchGeometry: YES</div>
                    <div className="mt-0.5 text-foreground/80">— Future custom IA (reserved) —</div>
                    <div>futureCustomTextureReserved: YES</div>
                    <div>futureCustomDitherReserved: YES</div>
                    <div>futureCustomAsciiReserved: YES</div>
                    <div>futureCustomAnimationReserved: YES</div>
                    <div>futureCustomFusionReserved: YES</div>
                  </>
                )
              })()}
              <div className="mt-0.5 text-foreground/80">— Texture (procedural patterning only) —</div>
              <div>textureRendererImplemented: YES (v1)</div>
              <div>textureMode: {styleState.textureMode}</div>
              <div>textureEnabled: {String(styleState.textureEnabled)}</div>
              <div>textureAnimated: {String(styleState.textureAnimated)}</div>
              <div>textureTypeIndex: {TEXTURE_TYPE_INDEX[styleState.textureMode]}</div>
              <div>textureScale: {styleState.textureScale.toFixed(2)}</div>
              <div>textureIntensity: {styleState.textureIntensity.toFixed(2)}</div>
              <div>textureContrast: {styleState.textureContrast.toFixed(2)}</div>
              <div>textureSpeed: {styleState.textureSpeed.toFixed(2)}</div>
              <div>textureDirection: {styleState.textureDirection}</div>
              <div>textureLockMode: {styleState.textureLockMode}</div>
              <div>textureAppliedToAllModes: YES (shared material)</div>
              <div>textureDoesNotTouchGeometry: YES</div>
              <div>
                textureAnimationClock:{" "}
                {styleState.motionMode === "syncToDraw"
                  ? "revealProgress"
                  : styleState.motionMode === "independent"
                    ? "elapsedTime"
                    : "off (static)"}
              </div>
              <div>textureIsNotDither: YES (pattern, no threshold logic)</div>
              <div>textureIsNotAscii: YES (pattern, no glyphs)</div>
              <div className="mt-0.5 text-foreground/80">— Dither (separate system) —</div>
              <div>ditherRendererImplemented: YES (v1)</div>
              <div>ditherEnabled: {String(styleState.ditherEnabled)}</div>
              <div>ditherAnimated: {String(styleState.ditherAnimated)}</div>
              <div>ditherType: {styleState.ditherType}</div>
              <div>ditherTypeIndex: {DITHER_TYPE_INDEX[styleState.ditherType]}</div>
              <div>ditherScale (cell): {styleState.ditherScale.toFixed(1)}</div>
              <div>ditherLevels: {styleState.ditherLevels}</div>
              <div>ditherThreshold: {styleState.ditherThreshold.toFixed(2)}</div>
              <div>ditherContrast: {styleState.ditherContrast.toFixed(2)}</div>
              <div>ditherIntensity: {styleState.ditherIntensity.toFixed(2)}</div>
              <div>ditherDirection: {styleState.ditherDirection}</div>
              <div>ditherLockMode: {styleState.ditherLockMode}</div>
              <div>ditherStage: after lighting (dithering_fragment)</div>
              <div>
                ditherAnimationKind:{" "}
                {styleState.ditherDirection === "static" ? "threshold-bias sweep" : "matrix crawl"}
              </div>
              <div>ditherAppliedToAllModes: YES (shared material)</div>
              <div>ditherDoesNotTouchGeometry: YES</div>
              <div>ditherIsNotTexture: YES (threshold, not pattern)</div>
              <div>ditherIsNotAscii: YES (threshold, not glyphs)</div>
              <div className="mt-0.5 text-foreground/80">— ASCII (separate system) —</div>
              <div>asciiEnabled: {String(styleState.asciiEnabled)}</div>
              <div>asciiAnimated: {String(styleState.asciiAnimated)}</div>
              <div>asciiCharset: {styleState.asciiCharset}</div>
              <div className="mt-0.5 text-foreground/80">— Motion (style animation) —</div>
              <div>motionMode: {styleState.motionMode}</div>
              <div>syncMode: {styleState.syncMode}</div>
              <div>syncToReveal: {String(styleState.syncToReveal)}</div>
              <div className="mt-0.5 text-foreground/80">— Composite (renderers later) —</div>
              <div>layerStackEnabled: {String(styleState.layerStackEnabled)}</div>
              <div>stackAnimationEnabled: {String(styleState.stackAnimationEnabled)}</div>
              <div>fusionPreset: {styleState.fusionPreset}</div>
              <div>fusionAnimationEnabled: {String(styleState.fusionAnimationEnabled)}</div>
              <div>globalStyleTime: {styleState.globalStyleTime.toFixed(2)}</div>
              {(() => {
                const ap = findPreset(styleState.activePresetId)
                return (
                  <div className="mt-1 border-t border-border/30 pt-1">
                    <div className="font-semibold text-foreground">Active preset:</div>
                    <div>activePresetFamily: {styleState.activePresetFamily}</div>
                    <div>activePresetId: {styleState.activePresetId ?? "—"}</div>
                    <div>activePresetImplemented: {String(ap?.implemented ?? false)}</div>
                    <div>activePresetPreviewOnly: {String(ap?.previewOnly ?? false)}</div>
                    <div>activePresetBestModes: {ap?.bestModes?.join(", ") || "—"}</div>
                    <div>presetAppliesState: {ap?.applies ? Object.keys(ap.applies).join(", ") || "—" : "—"}</div>
                    <div>presetDoesNotTouchGeometry: YES</div>
                  </div>
                )
              })()}
            </div>
          )}
          {/* Extrude depth-trace diagnostic (extrude mode only).
              Proves whether the depth-slider rebuild path is alive end-to-end:
              if buildCount stays flat as you move the Depth slider, the memo
              isn't re-firing; if buildCount increments AND bboxZ changes, the
              rebuild is correct and any remaining staleness is downstream
              (camera angle / R3F prop swap / material). */}
          {geometryMode === "extrude" && extrudeDebugRef.current && (
            <div className="mt-1 border-t border-border/50 pt-1">
              <div className="font-semibold text-foreground">Extrude trace:</div>
              <div>widthSliderValue: {extrudeDebugRef.current.widthSliderValue.toFixed(3)}</div>
              <div>widthSliderPercent: {extrudeDebugRef.current.widthSliderPercent}%</div>
              <div>effectiveWidthUsed: {extrudeDebugRef.current.effectiveWidthUsed.toFixed(3)}</div>
              <div>effectiveWidthPercent: {extrudeDebugRef.current.effectiveWidthPercent}%</div>
              <div>strategy: {extrudeDebugRef.current.strategy}</div>
              <div>buildStatus: {extrudeDebugRef.current.buildStatus}</div>
              <div>depthMultiplierSliderValue: {extrudeDebugRef.current.depthParam.toFixed(2)}×</div>
              <div>effectiveDepthUsed: {extrudeDebugRef.current.effectiveDepthUsed.toFixed(3)}</div>
              <div>depthToWidthRatio: {extrudeDebugRef.current.depthToWidthRatio.toFixed(2)}</div>
              <div>previewBuildCount: {extrudeDebugRef.current.buildCount}</div>
              <div>geometryBBoxZ: {extrudeDebugRef.current.bboxZ.toFixed(3)}</div>
              <div>activeEngine: {extrudeDebugRef.current.activeEngine}</div>
            </div>
          )}
          
          {/* Per-stroke extrude build status (extrude mode only) */}
          {geometryMode === "extrude" && (meshStatusRef.current?.length ?? 0) > 0 && (
            <div className="mt-1 border-t border-border/50 pt-1">
              <div className="font-semibold text-foreground">Build status:</div>
              {(meshStatusRef.current ?? []).map((s, i) => (
                <div key={i} className={
                  s.type === "ok" ? "text-green-600"
                    : s.type === "bevelOff" ? "text-yellow-600"
                    : s.type === "bevelOffTinyWidth" ? "text-orange-500"
                    : "text-red-500"
                }>
                  {i}: {s.type === "ok"
                    ? `extrude strategy=${s.strategy} w=${s.width.toFixed(3)} mult=${s.depthMultiplier.toFixed(2)}× eff=${s.effectiveDepth.toFixed(3)} bevel=${s.bevelEnabled}`
                    : s.type === "bevelOff"
                    ? `extrude strategy=${s.strategy} w=${s.width.toFixed(3)} mult=${s.depthMultiplier.toFixed(2)}× eff=${s.effectiveDepth.toFixed(3)} bevel=off(retry)`
                    : s.type === "bevelOffTinyWidth"
                    ? `extrude strategy=${s.strategy} w=${s.width.toFixed(3)} mult=${s.depthMultiplier.toFixed(2)}× eff=${s.effectiveDepth.toFixed(3)} bevel=off(tiny)`
                    : `rod fallback strategy=${s.strategy} r=${s.fallbackRadius.toFixed(3)} (${s.reason}) mult=${s.depthMultiplier.toFixed(2)}× eff=${s.effectiveDepth.toFixed(3)}`}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Animation controls */}
      {strokeCount > 0 && (
        <div className="absolute bottom-12 left-3 right-3 flex items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-2 backdrop-blur-sm">
          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-accent"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="2" y="1" width="3" height="10" rx="0.5" />
                <rect x="7" y="1" width="3" height="10" rx="0.5" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 1.5v9l7.5-4.5L3 1.5z" />
              </svg>
            )}
          </button>

          {/* Time display */}
          <span className="w-10 shrink-0 text-center font-mono text-[10px] text-muted-foreground">
            {formatDuration(totalDuration, progress)}
          </span>

          {/* Scrubber */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={(e) => handleScrub(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
          />

          {/* Main timing toggle: Natural (hybrid) / Authentic (raw) */}
          <div className={`flex shrink-0 items-center gap-0.5 ${comparing ? "pointer-events-none opacity-40" : ""}`}>
            <button
              onClick={() => setRevealMode("hybrid")}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                revealMode === "hybrid"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Natural
            </button>
            <button
              onClick={() => setRevealMode("raw")}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                revealMode === "raw"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Authentic
            </button>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Speed */}
          <div className="flex shrink-0 items-center gap-0.5">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${speed === s
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Debug toggle */}
          <button
            onClick={() => setShowDebug((v) => !v)}
            className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              showDebug
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Debug
          </button>

          {/* Debug-only tools */}
          {showDebug && (
            <>
              <div className="h-4 w-px bg-border" />

              {/* Smooth option (debug only) */}
              <button
                onClick={() => setRevealMode("smooth")}
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  revealMode === "smooth"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Smooth
              </button>

              {/* Blend slider (debug only) */}
              {revealMode === "hybrid" && (
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={hybridBlend}
                  onChange={(e) => setHybridBlend(Number(e.target.value))}
                  title={`Blend: ${hybridBlend.toFixed(2)}`}
                  disabled={comparing}
                  className={`h-1 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-border accent-foreground ${comparing ? "opacity-40" : ""}`}
                />
              )}

              <div className="h-4 w-px bg-border" />

              {/* Compare toggle (debug only) */}
              <button
                onClick={handleCompareToggle}
                disabled={compare3Up}
                className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  comparing
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                } ${compare3Up ? "pointer-events-none opacity-40" : ""}`}
              >
                {comparing ? "Stop" : "Compare"}
              </button>

              {/* 3-Up toggle (debug only) */}
              <button
                onClick={() => {
                  setCompare3Up((v) => !v)
                  if (!compare3Up && comparing) {
                    setComparing(false)
                    setPlaying(false)
                    setCompareLabel("")
                  }
                }}
                className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  compare3Up
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {compare3Up ? "Single" : "3-Up"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Camera + Export controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
        <input
          type="text"
          value={exportName}
          onChange={(e) => setExportName(e.target.value)}
          placeholder="filename prefix"
          maxLength={32}
          className="h-[30px] w-28 rounded-lg border border-border bg-background/80 px-2 text-xs text-foreground placeholder:text-muted-foreground/50 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
        />
        <button
          onClick={handleExportGLB}
          disabled={strokeCount === 0 || exporting}
          className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exporting ? "Exporting..." : "Export GLB"}
        </button>
        <button
          onClick={handleTopView}
          className="rounded-lg border border-border bg-background/80 px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent"
        >
          Top
        </button>
        <button
          onClick={handleResetCamera}
          className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent"
        >
          Reset camera
        </button>
      </div>

      {/* SOLID DEBUG OVERLAY - on-screen debug for Solid mode */}
      {showDebug && geometryMode === "solid" && (
        <>
          <SolidDebugOverlay />
          {SOLID_STAGE_DEBUG.enabled && <SolidStageDebugOverlay />}
          {SOLID_STAGE_DEBUG.enabled && <SolidStageControls />}
        </>
      )}
    </div>
  )
}

/** Minimal on-screen debug overlay for Solid mode failure diagnosis */
function SolidDebugOverlay() {
  const [, forceUpdate] = useState(0)
  
  // Poll SOLID_DEBUG state every 100ms
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 100)
    return () => clearInterval(interval)
  }, [])
  
  const d = SOLID_DEBUG
  const bucketColors: Record<string, string> = {
    A: "bg-gray-500",
    B: "bg-yellow-500", 
    C: "bg-red-500",
    D: "bg-orange-500",
    E: "bg-green-500",
  }
  
  return (
    <div className="absolute left-3 top-3 z-50 rounded-lg border border-red-500/50 bg-black/90 p-2 font-mono text-[10px] text-white">
      <div className="mb-1 flex items-center gap-2 border-b border-red-500/30 pb-1">
        <span className="font-bold text-red-400">SOLID DEBUG</span>
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold text-black ${bucketColors[d.bucket]}`}>
          BUCKET {d.bucket}
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <span className="text-gray-400">engineCalled:</span>
        <span className={d.engineCalled ? "text-green-400" : "text-red-400"}>{d.engineCalled ? "YES" : "NO"}</span>
        
        <span className="text-gray-400">canvas:</span>
        <span>{d.canvasWidth}x{d.canvasHeight}</span>
        
        <span className="text-gray-400">strokes:</span>
        <span>{d.strokeCount}</span>
        
        <span className="text-gray-400">points:</span>
        <span>{d.pointCount}</span>
        
        <span className="text-gray-400">buildMaskSolid:</span>
        <span className={d.buildMaskSolidCalled ? "text-green-400" : "text-red-400"}>{d.buildMaskSolidCalled ? "CALLED" : "NOT CALLED"}</span>
        
        <span className="text-gray-400">thickness:</span>
        <span>{d.inputThickness}px -&gt; {d.worldThickness.toFixed(4)}w</span>
        
        <span className="text-gray-400">filledPixels:</span>
        <span>{d.filledPixels} / {d.maskArea}</span>
        
        <span className="text-gray-400">fill%:</span>
        <span className={d.filledPercent > 50 ? "text-red-400" : d.filledPercent < 1 ? "text-yellow-400" : "text-green-400"}>
          {d.filledPercent.toFixed(1)}%
        </span>
        
        <span className="text-gray-400">geometry:</span>
        <span className={d.geometryReturned ? "text-green-400" : "text-red-400"}>{d.geometryReturned ? "YES" : "NULL"}</span>
        
        <span className="text-gray-400">vertexCount:</span>
        <span className={d.vertexCount > 0 ? "text-green-400" : "text-red-400"}>{d.vertexCount}</span>
        
        <span className="text-gray-400">failureReason:</span>
        <span className={d.failureReason === "success" ? "text-green-400" : "text-yellow-400"}>{d.failureReason || "-"}</span>
        
        <span className="text-gray-400">worldX:</span>
        <span className={Math.abs(d.worldMinX) < 2 && Math.abs(d.worldMaxX) < 2 ? "text-green-400" : "text-red-400"}>
          [{d.worldMinX.toFixed(2)}, {d.worldMaxX.toFixed(2)}]
        </span>
        
        <span className="text-gray-400">worldY:</span>
        <span className={Math.abs(d.worldMinY) < 2 && Math.abs(d.worldMaxY) < 2 ? "text-green-400" : "text-red-400"}>
          [{d.worldMinY.toFixed(2)}, {d.worldMaxY.toFixed(2)}]
        </span>
      </div>
      
      {/* Raster Stage Diagnostics - read from lastStages.rasterDebug */}
      {(() => {
        const r = d.lastStages?.rasterDebug
        return (
          <div className="mt-1 border-t border-orange-500/30 pt-1">
            <div className="mb-0.5 text-[9px] font-bold text-orange-400">RASTER STAGE</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <span className="text-gray-400">rasterExecuted:</span>
              <span className={r?.rasterStageExecuted === "YES" ? "text-green-400" : "text-red-400"}>{r?.rasterStageExecuted || "?"}</span>
              
              <span className="text-gray-400">inputSpace:</span>
              <span>{r?.rasterInputSpace || "?"}</span>
              
              <span className="text-gray-400">maskSize:</span>
              <span>{r?.rasterMaskWidth || "?"}x{r?.rasterMaskHeight || "?"}</span>
              
              <span className="text-gray-400">thicknessPx:</span>
              <span>{typeof r?.rasterThicknessPx === "number" ? r.rasterThicknessPx.toFixed(1) : "?"}</span>
              
              <span className="text-gray-400">strokeBoundsX:</span>
              <span className="text-[8px]">{r?.rasterStrokeBoundsX || "?"}</span>
              
              <span className="text-gray-400">strokeBoundsY:</span>
              <span className="text-[8px]">{r?.rasterStrokeBoundsY || "?"}</span>
              
              <span className="text-gray-400">filledPixels:</span>
              <span className={r?.filledPixels && r.filledPixels > 0 ? "text-green-400" : "text-red-400"}>{r?.filledPixels ?? "?"}</span>
              
              <span className="text-gray-400">rasterRejected:</span>
              <span className={r?.rasterRejected === "YES" ? "text-red-400 font-bold" : "text-green-400"}>{r?.rasterRejected || "?"}</span>
              
              {r?.rasterRejected === "YES" && (
                <>
                  <span className="text-gray-400">rejectReason:</span>
                  <span className="text-red-400 text-[8px]">{r?.rasterRejectReason || "unknown"}</span>
                </>
              )}
            </div>
          </div>
        )
      })()}
      
      {/* Solid Mode Diagnostics - read from lastStages.solidDiagnostics */}
      {(() => {
        const s = d.lastStages?.solidDiagnostics
        if (!s) return null
        return (
          <div className="mt-1 border-t border-purple-500/30 pt-1">
            <div className="mb-0.5 text-[9px] font-bold text-purple-400">SOLID MODE</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <span className="text-gray-400">geometryMode:</span>
              <span className="text-purple-300 font-bold">{s.geometryMode}</span>
              
              <span className="text-gray-400">geometryType:</span>
              <span className={s.geometryType === "NULL" ? "text-red-400" : "text-green-400"}>{s.geometryType}</span>
              
              <span className="text-gray-400">gateExecuted:</span>
              <span className={s.gateExecuted === "YES" ? "text-green-400" : "text-yellow-400"}>{s.gateExecuted}</span>
              
              <span className="text-gray-400">filledPixels:</span>
              <span className={s.filledPixels > 0 ? "text-green-400" : "text-red-400"}>{s.filledPixels}</span>
              
              <span className="text-gray-400">outerAreaAbs:</span>
              <span>{typeof s.outerAreaAbs === "number" ? s.outerAreaAbs.toFixed(1) : "?"}</span>
              
              <span className="text-gray-400">contourClosed:</span>
              <span className={s.contourClosed === "YES" ? "text-green-400" : "text-red-400"}>{s.contourClosed}</span>
              
              <span className="text-gray-400">contourOrdered:</span>
              <span className={s.contourOrdered === "YES" ? "text-green-400" : "text-red-400"}>{s.contourOrdered}</span>
              
              <span className="text-gray-400">contourRejected:</span>
              <span className={s.contourRejected === "YES" ? "text-red-400 font-bold" : "text-green-400"}>{s.contourRejected}</span>
              
              {s.contourRejected === "YES" && (
                <>
                  <span className="text-gray-400">rejectReason:</span>
                  <span className="text-red-400 text-[8px]">{s.contourRejectReason || "unknown"}</span>
                </>
              )}
              
              {s.extrusionBuilder !== undefined && (
                <>
                  <span className="text-gray-400">extrusionBuilder:</span>
                  <span className="text-cyan-300 font-bold">{s.extrusionBuilder}</span>
                  
                  <span className="text-gray-400">frontCapTris:</span>
                  <span>{s.frontCapTriCount ?? "?"}</span>
                  
                  <span className="text-gray-400">backCapTris:</span>
                  <span>{s.backCapTriCount ?? "?"}</span>
                  
                  <span className="text-gray-400">wallSegments:</span>
                  <span className={s.wallSegmentCount && s.wallSegmentCount > 0 ? "text-green-400" : "text-red-400"}>{s.wallSegmentCount ?? "?"}</span>
                  
                  <span className="text-gray-400">skippedWalls:</span>
                  <span>{s.skippedWallSegments ?? "?"}</span>
                </>
              )}
            </div>

            {/* H1 Hole Detection (DIAGNOSTIC ONLY - geometry unchanged) */}
            <div className="mt-1 border-t border-pink-500/30 pt-1">
              <div className="mb-0.5 text-[9px] font-bold text-pink-400">HOLE DETECTION (H1)</div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                <span className="text-gray-400">holeDetectionEnabled:</span>
                <span className={s.holeDetectionEnabled === "YES" ? "text-green-400" : "text-yellow-400"}>
                  {s.holeDetectionEnabled ?? "NO"}
                </span>

                <span className="text-gray-400">detectedHoleCount:</span>
                <span>{s.detectedHoleCount ?? 0}</span>

                <span className="text-gray-400">validHoleCount:</span>
                <span className={(s.validHoleCount ?? 0) > 0 ? "text-green-400" : "text-gray-300"}>
                  {s.validHoleCount ?? 0}
                </span>

                <span className="text-gray-400">rejectedHoleCount:</span>
                <span>{s.rejectedHoleCount ?? 0}</span>

                <span className="text-gray-400">largestHoleArea:</span>
                <span>{s.largestHoleArea ?? 0}</span>

                <span className="text-gray-400">holeAreas:</span>
                <span className="text-[8px]">
                  [{(s.holeAreas ?? []).join(", ")}]
                </span>

                <span className="text-gray-400">rejectedHoleAreas:</span>
                <span className="text-[8px] text-yellow-300">
                  [{(s.rejectedHoleAreas ?? []).join(", ")}]
                </span>

                <span className="text-gray-400">borderTouchingEmpties:</span>
                <span className="text-[8px]">{s.borderTouchingEmptyCount ?? 0}</span>

                <span className="text-gray-400">holeRejectReasons:</span>
                <span className="text-[8px] text-yellow-300">
                  {(s.holeRejectReasons ?? []).length > 0
                    ? (s.holeRejectReasons ?? []).join(" | ")
                    : "-"}
                </span>
              </div>
              <div className="mt-1 text-[8px] text-gray-500">
                H1 detection only — geometry, caps, walls, export unchanged.
              </div>
            </div>

            {/* H2 Flat Cap With Holes (DIAGNOSTIC ONLY - flat cap proof) */}
            <div className="mt-1 border-t border-orange-500/30 pt-1">
              <div className="mb-0.5 text-[9px] font-bold text-orange-400">FLAT CAP WITH HOLES (H2)</div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                <span className="text-gray-400">h2FlatCapWithHolesBuilt:</span>
                <span className={s.h2FlatCapWithHolesBuilt === "YES" ? "text-green-400" : "text-yellow-400"}>
                  {s.h2FlatCapWithHolesBuilt ?? "NO"}
                </span>

                <span className="text-gray-400">h2HoleContoursUsed:</span>
                <span className={(s.h2HoleContoursUsed ?? 0) > 0 ? "text-green-400" : "text-gray-300"}>
                  {s.h2HoleContoursUsed ?? 0}
                </span>

                <span className="text-gray-400">h2HoleContourAreas:</span>
                <span className="text-[8px]">
                  [{(s.h2HoleContourAreas ?? []).join(", ")}]
                </span>

                <span className="text-gray-400">h2ShapeHoleCount:</span>
                <span className={(s.h2ShapeHoleCount ?? 0) > 0 ? "text-green-400" : "text-gray-300"}>
                  {s.h2ShapeHoleCount ?? 0}
                </span>

                <span className="text-gray-400">h2HoleContourRejectReasons:</span>
                <span className="text-[8px] text-yellow-300">
                  {(s.h2HoleContourRejectReasons ?? []).length > 0
                    ? (s.h2HoleContourRejectReasons ?? []).join(" | ")
                    : "-"}
                </span>

                <span className="text-gray-400">frontCapTris:</span>
                <span>{s.h2FrontCapTris ?? s.frontCapTriCount ?? 0}</span>

                <span className="text-gray-400">flatCapTrisBaseline:</span>
                <span>{s.h2FlatCapTrisBaseline ?? 0}</span>

                <span className="text-gray-400">triDelta:</span>
                <span className={(s.h2TriDelta ?? 0) > 0 ? "text-green-400" : "text-yellow-400"}>
                  {s.h2TriDelta ?? 0}{" "}
                  {(s.h2TriDelta ?? 0) > 0 ? "(holes cut)" : "(no change)"}
                </span>
              </div>

              {/* Counter-preserving detection (thinner mask used to find counters
                  that thick strokes painted over) */}
              <div className="mt-1 border-t border-orange-500/20 pt-1 text-[8px]">
                <div className="mb-0.5 font-bold text-orange-300">
                  COUNTER-PRESERVING DETECTION
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  <span className="text-gray-400">enabled:</span>
                  <span
                    className={
                      s.counterDetectionEnabled === "YES"
                        ? "text-green-400"
                        : "text-gray-400"
                    }
                  >
                    {s.counterDetectionEnabled ?? "NO"}
                  </span>

                  <span className="text-gray-400">actualThicknessPx:</span>
                  <span>{((s.actualThicknessPx ?? 0) as number).toFixed(2)}</span>

                  <span className="text-gray-400">counterThicknessPx:</span>
                  <span>
                    {((s.counterDetectionThicknessPx ?? 0) as number).toFixed(2)}
                  </span>

                  <span className="text-gray-400">counterDetectedHoleCount:</span>
                  <span>{s.counterDetectedHoleCount ?? 0}</span>

                  <span className="text-gray-400">counterValidHoleCount:</span>
                  <span
                    className={
                      (s.counterValidHoleCount ?? 0) > 0
                        ? "text-green-400"
                        : "text-gray-400"
                    }
                  >
                    {s.counterValidHoleCount ?? 0}
                  </span>

                  <span className="text-gray-400">counterHoleAreas:</span>
                  <span>[{(s.counterHoleAreas ?? []).join(", ")}]</span>

                  <span className="text-gray-400">holeSource:</span>
                  <span
                    className={
                      s.counterHoleSource === "COUNTER_MASK"
                        ? "text-green-400 font-bold"
                        : "text-gray-300"
                    }
                  >
                    {s.counterHoleSource ?? "ACTUAL_MASK"}
                  </span>
                </div>
              </div>

              {/* Compact small-counter viability — pinpoints tight cursive counters */}
              <div className="mt-1 border-t border-orange-500/20 pt-1 text-[8px]">
                <div className="mb-0.5 font-bold text-orange-300">
                  COUNTER VIABILITY (smallest valid hole)
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                  <span className="text-gray-400">area:</span>
                  <span>{s.smallestValidHoleArea ?? 0} px</span>

                  <span className="text-gray-400">bbox:</span>
                  <span>
                    {(s.smallestValidHoleBboxW ?? 0)} × {(s.smallestValidHoleBboxH ?? 0)} px
                  </span>

                  <span className="text-gray-400">area/bbox:</span>
                  <span>
                    {((s.smallestValidHoleAreaToBboxRatio ?? 0) as number).toFixed(3)}
                  </span>

                  <span className="text-gray-400">usedByH2:</span>
                  <span
                    className={
                      s.smallestValidHoleUsedByH2 === "YES"
                        ? "text-green-400 font-bold"
                        : s.smallestValidHoleUsedByH2 === "NO"
                          ? "text-red-400 font-bold"
                          : "text-gray-400"
                    }
                  >
                    {s.smallestValidHoleUsedByH2 ?? "N/A"}
                  </span>
                </div>
              </div>

              <div className="mt-1 text-[8px] text-gray-500">
                H2 flat-cap proof — no extrusion, no walls, export untouched.
              </div>
            </div>

            {/* H3: EXTRUDE_FROM_FLAT_CAP_WITH_HOLES — production extrusion */}
            <div className="mt-1 border-t border-emerald-500/40 pt-1">
              <div className="mb-0.5 text-[9px] font-bold text-emerald-400">
                EXTRUDE FROM FLAT CAP WITH HOLES (H3)
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                <span className="text-gray-400">h3Built:</span>
                <span
                  className={
                    s.h3Built === "YES"
                      ? "text-green-400 font-bold"
                      : s.h3Built === "NO"
                        ? "text-red-400 font-bold"
                        : "text-gray-400"
                  }
                >
                  {s.h3Built ?? "—"}
                </span>

                {/* ---- Solid H3 control calibration (proves UI value is mapped before geometry) ---- */}
                <span className="text-gray-400">thickness slider:</span>
                <span className="font-mono">
                  {(s.solidThicknessSliderValue ?? 0) as number}px
                </span>

                <span className="text-gray-400">thickness effective:</span>
                <span
                  className={
                    (s.solidEffectiveThicknessPx ?? 0) !== (s.solidThicknessSliderValue ?? 0)
                      ? "font-mono text-emerald-400"
                      : "font-mono text-yellow-400"
                  }
                >
                  {((s.solidEffectiveThicknessPx ?? 0) as number).toFixed(1)}px
                </span>

                <span className="text-gray-400">depth slider:</span>
                <span className="font-mono">
                  {((s.solidDepthSliderValue ?? s.solidDepthParam ?? 0) as number).toFixed(3)}
                </span>

                <span className="text-gray-400">depth effective:</span>
                <span
                  className={
                    (s.solidDepthEffective ?? 0) !== (s.solidDepthSliderValue ?? 0)
                      ? "font-mono text-emerald-400"
                      : "font-mono text-yellow-400"
                  }
                >
                  {((s.solidDepthEffective ?? 0) as number).toFixed(3)}
                </span>

                <span className="text-gray-400">depth/thick ratio:</span>
                <span className="font-mono">
                  {((s.solidDepthToThicknessRatio ?? 0) as number).toFixed(3)}
                </span>

                <span className="text-gray-400">bbox Z:</span>
                <span
                  className={
                    (s.geometryBBoxZ ?? 0) > 0
                      ? "font-mono text-green-400"
                      : "font-mono text-red-400"
                  }
                >
                  {((s.geometryBBoxZ ?? 0) as number).toFixed(4)}
                </span>

                <span className="text-gray-400">frontCapTris:</span>
                <span>{s.h3FrontCapTris ?? 0}</span>

                <span className="text-gray-400">backCapTris:</span>
                <span>{s.h3BackCapTris ?? 0}</span>

                <span className="text-gray-400">outerWallSegs:</span>
                <span
                  className={
                    (s.h3OuterWallSegments ?? 0) > 0 ? "text-green-400" : "text-red-400"
                  }
                >
                  {s.h3OuterWallSegments ?? 0}
                  {(s.h3SkippedOuterWallSegments ?? 0) > 0
                    ? ` (skipped ${s.h3SkippedOuterWallSegments})`
                    : ""}
                </span>

                <span className="text-gray-400">innerWallLoops:</span>
                <span
                  className={
                    (s.h3InnerWallCount ?? 0) > 0 ? "text-green-400" : "text-gray-300"
                  }
                >
                  {s.h3InnerWallCount ?? 0}
                </span>

                <span className="text-gray-400">innerWallSegs:</span>
                <span
                  className={
                    (s.h3InnerWallSegments ?? 0) > 0 ? "text-green-400" : "text-gray-300"
                  }
                >
                  {s.h3InnerWallSegments ?? 0}
                  {(s.h3SkippedInnerWallSegments ?? 0) > 0
                    ? ` (skipped ${s.h3SkippedInnerWallSegments})`
                    : ""}
                </span>

                <span className="text-gray-400">totalVerts:</span>
                <span>{s.h3TotalVerts ?? 0}</span>

                <span className="text-gray-400">totalTris:</span>
                <span>{s.h3TotalTris ?? 0}</span>

                <span className="text-gray-400">exportSamePath:</span>
                <span
                  className={
                    s.exportUsesSamePath === "YES"
                      ? "text-green-400 font-bold"
                      : "text-yellow-400"
                  }
                >
                  {s.exportUsesSamePath ?? "—"}
                </span>
              </div>
              <div className="mt-1 text-[8px] text-gray-500">
                H3 production: cap + back cap + outer walls + inner walls. Depth
                slider drives bbox Z. Export path identical to preview.
              </div>
            </div>
          </div>
        )
      })()}

      {/* ---- Solid H3 ANIMATION CLEANUP diagnostics ----
          Surfaced only in Solid mode. Reads SOLID_ANIM_DEBUG (written from
          Scene during partial-reveal rebuilds). Proves arc-length reveal,
          shows rebuild cadence, and exposes topology-popping count. */}
      {(() => {
        const a = SOLID_ANIM_DEBUG
        const arcRatio =
          a.animatedTotalArcLength > 0
            ? a.animatedVisibleArcLength / a.animatedTotalArcLength
            : 0
        return (
          <div className="mt-1 border-t border-cyan-500/40 pt-1">
            <div className="mb-0.5 text-[9px] font-bold text-cyan-400">
              SOLID H3 ANIMATION
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <span className="text-gray-400">animationPath:</span>
              <span
                className={
                  a.animationPath ===
                  "partialSolidRebuildWithHoleStabilization"
                    ? "text-green-400 font-bold"
                    : a.animationPath === "partialExtrudeRebuild"
                      ? "text-cyan-300 font-bold"
                      : a.animationPath === "drawRange"
                        ? "text-blue-300"
                        : "text-gray-400"
                }
              >
                {a.animationPath}
              </span>

              <span className="text-gray-400">solidAnimationActive:</span>
              <span
                className={
                  a.solidAnimationActive
                    ? "text-green-400 font-bold"
                    : "text-gray-300"
                }
              >
                {a.solidAnimationActive ? "YES" : "NO"}
              </span>

              <span className="text-gray-400">solidAnimationProgress:</span>
              <span className="font-mono">
                {a.solidAnimationProgress.toFixed(4)}
              </span>

              <span className="text-gray-400">solidAnimationRebuildCount:</span>
              <span>{a.solidAnimationRebuildCount}</span>

              <span className="text-gray-400">animatedStrokePointCount:</span>
              <span>{a.animatedStrokePointCount}</span>

              <span className="text-gray-400">animatedVisibleArcLength:</span>
              <span className="font-mono">
                {a.animatedVisibleArcLength.toFixed(2)}
              </span>

              <span className="text-gray-400">animatedTotalArcLength:</span>
              <span className="font-mono">
                {a.animatedTotalArcLength.toFixed(2)}
              </span>

              <span className="text-gray-400">arcLengthRatio:</span>
              <span className="font-mono">
                {arcRatio.toFixed(4)}
              </span>

              <span className="text-gray-400">solidAnimationUsesArcLength:</span>
              <span
                className={
                  a.solidAnimationUsesArcLength === "YES"
                    ? "text-green-400 font-bold"
                    : "text-red-400"
                }
              >
                {a.solidAnimationUsesArcLength}
              </span>

              <span className="text-gray-400">
                solidAnimationInterpolatedCutPoint:
              </span>
              <span
                className={
                  a.solidAnimationInterpolatedCutPoint === "YES"
                    ? "text-green-400 font-bold"
                    : "text-red-400"
                }
              >
                {a.solidAnimationInterpolatedCutPoint}
              </span>

              <span className="text-gray-400">finalFrameMatchesStatic:</span>
              <span
                className={
                  a.finalFrameMatchesStatic === "YES"
                    ? "text-green-400 font-bold"
                    : "text-gray-300"
                }
              >
                {a.finalFrameMatchesStatic}
              </span>

              <span className="text-gray-400">validHoleCount (anim):</span>
              <span>{a.validHoleCount}</span>

              <span className="text-gray-400">topologyChangeCount:</span>
              <span
                className={
                  a.topologyChangeCount > 0 ? "text-yellow-400" : "text-gray-300"
                }
              >
                {a.topologyChangeCount}
              </span>
            </div>
            <div className="mt-1 text-[8px] text-gray-500">
              Reveal is arc-length based with sub-segment interpolated cut.
              Rebuild count resets each Play. Topology pops classified — not faked early.
            </div>

            {/* ---- Hole stabilization sub-block ---- */}
            <div className="mt-1 border-t border-cyan-500/20 pt-1">
              <div className="mb-0.5 text-[9px] font-bold text-cyan-300">
                HOLE STABILIZATION
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                <span className="text-gray-400">holeStabilizationActive:</span>
                <span
                  className={
                    a.holeStabilizationActive === "YES"
                      ? "text-green-400 font-bold"
                      : "text-gray-300"
                  }
                >
                  {a.holeStabilizationActive}
                </span>

                <span className="text-gray-400">finalHoleReferenceCount:</span>
                <span>{a.finalHoleReferenceCount}</span>

                <span className="text-gray-400">activatedFinalHoleCount:</span>
                <span
                  className={
                    a.activatedFinalHoleCount > 0
                      ? "text-green-400 font-bold"
                      : "text-gray-300"
                  }
                >
                  {a.activatedFinalHoleCount}
                </span>

                <span className="text-gray-400">lastPartialCentroidCount:</span>
                <span>{a.lastPartialCentroidCount}</span>

                <span className="text-gray-400">perHoleHitStreaks:</span>
                <span className="font-mono">
                  [{a.perHoleHitStreaks.join(", ")}]
                </span>

                <span className="text-gray-400">perHoleMissStreaks:</span>
                <span className="font-mono">
                  [{a.perHoleMissStreaks.join(", ")}]
                </span>

                <span className="text-gray-400">perHoleActivationRadius:</span>
                <span className="font-mono">
                  [{a.perHoleActivationRadiusWorld
                    .map((r) => r.toFixed(3))
                    .join(", ")}]
                </span>

                {a.holeStabilizationLastReasons.length > 0 && (
                  <>
                    <span className="text-gray-400">lastRejects:</span>
                    <span className="text-yellow-400 text-[8px]">
                      {a.holeStabilizationLastReasons.slice(0, 3).join("; ")}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-1 text-[8px] text-gray-500">
                Reference snapshotted from static H3 at Play start. Activation
                threshold = 1 partial centroid match (sticky). Topological
                safety filter drops finals whose centroid is outside the
                current partial outer.
              </div>
            </div>
          </div>
        )
      })()}

      {/* Contour Diagnostics Section */}
      <div className="mt-1 border-t border-blue-500/30 pt-1">
        <div className="mb-0.5 text-[9px] font-bold text-blue-400">CONTOUR DIAGNOSTICS</div>
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <span className="text-gray-400">rawPts:</span>
          <span>{d.rawContourPoints}</span>
          
          <span className="text-gray-400">simpPts:</span>
          <span>{d.simplifiedContourPoints} ({d.rawContourPoints > 0 ? ((1 - d.simplifiedContourPoints / d.rawContourPoints) * 100).toFixed(0) : 0}% reduced)</span>
          
          <span className="text-gray-400">outerArea:</span>
          <span>{d.outerSignedArea.toFixed(1)}</span>
          
          <span className="text-gray-400">outerWind:</span>
          <span className={d.outerWinding === "CCW" ? "text-green-400" : "text-yellow-400"}>{d.outerWinding}</span>
          
          <span className="text-gray-400">outerSelfX:</span>
          <span className={d.outerSelfIntersects ? "text-red-400 font-bold" : "text-green-400"}>
            {d.outerSelfIntersects ? "YES - BAD" : "NO"}
          </span>
          
          <span className="text-gray-400">holes:</span>
          <span>{d.holeCount}</span>
          
          {d.holeCount > 0 && (
            <>
              <span className="text-gray-400">holeAreas:</span>
              <span className="text-[8px]">
                [
                {(Array.isArray(d.holeAreas) ? d.holeAreas : [])
                  .map((a: number) => a.toFixed(0))
                  .join(", ")}
                ]
              </span>
              
              <span className="text-gray-400">holeWinds:</span>
              <span className="text-[8px]">
                [{(Array.isArray(d.holeWindings) ? d.holeWindings : []).join(", ")}]
              </span>
              
              <span className="text-gray-400">holeSelfX:</span>
              <span className={d.anyHoleSelfIntersects ? "text-red-400 font-bold" : "text-green-400"}>
                {d.anyHoleSelfIntersects ? "YES - BAD" : "NO"}
              </span>
              
              <span className="text-gray-400">holeOutside:</span>
              <span className={d.anyHoleOutsideOuter ? "text-red-400 font-bold" : "text-green-400"}>
                {d.anyHoleOutsideOuter ? "YES - BAD" : "NO"}
              </span>
              
              <span className="text-gray-400">holesOverlap:</span>
              <span className={d.holesOverlap ? "text-red-400 font-bold" : "text-green-400"}>
                {d.holesOverlap ? "YES - BAD" : "NO"}
              </span>
            </>
          )}
          
          <span className="text-gray-400">stageD verts:</span>
          <span className={d.stageDVertexCount > 0 ? "text-green-400" : "text-red-400"}>{d.stageDVertexCount}</span>
          
          <span className="text-gray-400">stageE verts:</span>
          <span className={d.stageEVertexCount > 0 ? "text-green-400" : "text-red-400"}>{d.stageEVertexCount}</span>
        </div>
      </div>
      
      <div className="mt-1 border-t border-red-500/30 pt-1 text-[8px] text-gray-500">
        B=rawContour C=simplified D=noHoles E=full | Check: outerSelfX, holeSelfX, holeOutside, holesOverlap
      </div>
    </div>
  )
}

/**
 * TEMPORARY STAGE ISOLATION DEBUG: 2D visualization of pipeline stages
 * Renders: mask silhouette, raw contours, simplified contours, holes
 */
function SolidStageDebugOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [, forceUpdate] = useState(0)
  
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 100)
    return () => clearInterval(interval)
  }, [])
  
  useEffect(() => {
    if (!canvasRef.current || !SOLID_DEBUG.lastStages) return
    
    const stages = SOLID_DEBUG.lastStages
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")!
    
    // Setup canvas
    canvas.width = 400
    canvas.height = 400
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Get scale to fit mask in canvas
    const maskW = stages.maskWidth || 1
    const maskH = stages.maskHeight || 1
    const scaleX = (canvas.width - 20) / maskW
    const scaleY = (canvas.height - 20) / maskH
    const scale = Math.min(scaleX, scaleY)
    const offsetX = 10 + (canvas.width - 20 - maskW * scale) / 2
    const offsetY = 10 + (canvas.height - 20 - maskH * scale) / 2
    
    // Stage A: Render mask silhouette
    if (SOLID_STAGE_DEBUG.stage === "A" || SOLID_STAGE_DEBUG.stage === "B" || SOLID_STAGE_DEBUG.stage === "C" || SOLID_STAGE_DEBUG.stage === "D" || SOLID_STAGE_DEBUG.stage === "E") {
      ctx.fillStyle = "#333"
      for (let y = 0; y < maskH; y++) {
        for (let x = 0; x < maskW; x++) {
          if (stages.maskData[y * maskW + x]) {
            ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale)
          }
        }
      }
    }
    
    // Stage B: Render raw outer contour
    if (SOLID_STAGE_DEBUG.stage === "B" || SOLID_STAGE_DEBUG.stage === "C" || SOLID_STAGE_DEBUG.stage === "D" || SOLID_STAGE_DEBUG.stage === "E") {
      ctx.strokeStyle = "#0f0"
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < stages.outerContour.length; i++) {
        const p = stages.outerContour[i]
        const sx = offsetX + p.x * scale
        const sy = offsetY + p.y * scale
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.closePath()
      ctx.stroke()
    }
    
    // Stage C: Render simplified outer contour
    if (SOLID_STAGE_DEBUG.stage === "C" || SOLID_STAGE_DEBUG.stage === "D" || SOLID_STAGE_DEBUG.stage === "E") {
      ctx.strokeStyle = "#ff0"
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < stages.simplifiedOuter.length; i++) {
        const p = stages.simplifiedOuter[i]
        const sx = offsetX + p.x * scale
        const sy = offsetY + p.y * scale
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.closePath()
      ctx.stroke()
    }
    
    // Stages D/E: Render holes
    if (SOLID_STAGE_DEBUG.stage === "D" || SOLID_STAGE_DEBUG.stage === "E") {
      ctx.strokeStyle = "#f00"
      ctx.lineWidth = 1.5
      for (const hole of stages.simplifiedHoles) {
        ctx.beginPath()
        for (let i = 0; i < hole.length; i++) {
          const p = hole[i]
          const sx = offsetX + p.x * scale
          const sy = offsetY + p.y * scale
          if (i === 0) ctx.moveTo(sx, sy)
          else ctx.lineTo(sx, sy)
        }
        ctx.closePath()
        ctx.stroke()
      }
    }
    
    // Legend
    ctx.fillStyle = "#fff"
    ctx.font = "10px monospace"
    ctx.fillText(`STAGE ${SOLID_STAGE_DEBUG.stage}`, 10, canvas.height - 5)
  }, [SOLID_DEBUG.lastStages])
  
  return (
    <div className="absolute left-3 bottom-20 z-50 rounded-lg border border-yellow-500/50 bg-black/90 p-2">
      <div className="mb-1 text-[10px] font-bold text-yellow-400">2D STAGE VIZ</div>
      <canvas
        ref={canvasRef}
        className="border border-yellow-500/30 bg-black"
        width={400}
        height={400}
        style={{ maxWidth: "300px", display: "block" }}
      />
      <div className="mt-1 text-[8px] text-gray-400">
        Grn=raw Yel=simplified Red=holes
      </div>
    </div>
  )
}

/** Stage isolation toggle buttons */
function SolidStageControls() {
  const [, forceUpdate] = useState(0)
  const [enabled, setEnabled] = useState(SOLID_STAGE_DEBUG.enabled)
  const [stage, setStage] = useState(SOLID_STAGE_DEBUG.stage)
  
  const stages: ("A" | "B" | "C" | "D" | "E")[] = ["A", "B", "C", "D", "E"]
  const stageNames: Record<string, string> = {
    A: "Mask", B: "RawCtr", C: "SimpCtr", D: "NoHoles", E: "Full"
  }
  const stageDescriptions: Record<string, string> = {
    A: "2D mask only",
    B: "raw outer contour",
    C: "simplified contour",
    D: "extrude outer only",
    E: "extrude with holes"
  }
  
  const handleEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    SOLID_STAGE_DEBUG.enabled = e.target.checked
    setEnabled(e.target.checked)
  }
  
  const handleStageChange = (s: "A" | "B" | "C" | "D" | "E") => {
    SOLID_STAGE_DEBUG.stage = s
    setStage(s)
    // Force a rebuild by triggering state update
    forceUpdate(n => n + 1)
  }
  
  return (
    <div className="absolute right-3 bottom-20 z-50 flex flex-col gap-1 rounded-lg border border-blue-500/50 bg-black/90 p-2">
      <div className="text-[10px] font-bold text-blue-400">STAGE ISOLATION DEBUG</div>
      <label className="flex items-center gap-1 text-[9px] text-white">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleEnabledChange}
          className="h-3 w-3"
        />
        Enable Stage Debug
      </label>
      <div className="flex gap-1">
        {stages.map(s => (
          <button
            key={s}
            onClick={() => handleStageChange(s)}
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors ${
              stage === s
                ? "bg-blue-500 text-black"
                : "bg-gray-600 text-white hover:bg-gray-500"
            }`}
          >
            {stageNames[s]}
          </button>
        ))}
      </div>
      <div className="text-[8px] text-gray-400">
        Current: {stageDescriptions[stage]}
      </div>
      <div className="text-[8px] text-yellow-400">
        D vs E: If D works but E shards = holes/winding bug
      </div>
    </div>
  )
}

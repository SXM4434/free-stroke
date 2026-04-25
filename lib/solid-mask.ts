/**
 * MASK-FIRST Solid Mode Pipeline - CLEAN RESET
 * 
 * Single deterministic pipeline:
 * 1. Render stroke to offscreen Canvas2D
 * 2. Create binary mask
 * 3. Label connected components, find largest
 * 4. Extract boundary edges and chain into ordered loop
 * 5. Validate contour (hard gate - no bypass)
 * 6. Build FLAT ShapeGeometry only (no extrusion for this checkpoint)
 */

import * as THREE from "three"

// ============= Types =============

export interface Point2D {
  x: number
  y: number
}

export interface TestStroke {
  points: Point2D[]
  color?: string
}

export interface MaskSolidResult {
  geometry: THREE.BufferGeometry | null
  geometryNoHoles: THREE.BufferGeometry | null
  stats: MaskSolidStats
  stages: MaskSolidStages
  diagnostics: MaskSolidDiagnostics
}

export interface MaskSolidDiagnostics {
  // Core geometry info
  geometryMode: "FLAT_BASE" | "EXTRUDE_FROM_FLAT_BASE"
  geometryType: "FLAT" | "EXTRUDE_FROM_FLAT_BASE" | "NULL"
  outerSignedArea: number
  outerWinding: "CCW" | "CW"
  // Raster stage fields - MUST be visible in debug panel
  rasterStageExecuted: "YES" | "NO"
  rasterInputSpace: string
  rasterCanvasWidth: number
  rasterCanvasHeight: number
  rasterMaskWidth: number
  rasterMaskHeight: number
  rasterThicknessPx: number
  rasterStrokeBoundsX: string
  rasterStrokeBoundsY: string
  rasterRejected: "YES" | "NO"
  rasterRejectReason: string
  // Validation gate fields - MUST be visible in debug panel
  gateExecuted: "YES" | "NO"
  contourClosed: "YES" | "NO"
  contourOrdered: "YES" | "NO"
  outerAreaAbs: number
  filledPixels: number
  areaToFillRatio: number
  contourRejected: "YES" | "NO"
  contourRejectReason: string
}

export interface MaskSolidStats {
  maskResolution: number
  filledPixelCount: number
  componentCount: number
  largestComponentPixels: number
  outerContourPoints: number
  simplifiedOuterPoints: number
  holeCount: number
  rebuildTimeMs: number
}

export interface MaskSolidStages {
  centerline: Point2D[]
  maskData: boolean[]
  maskWidth: number
  maskHeight: number
  outerContour: Point2D[]
  simplifiedOuter: Point2D[]
  holes: Point2D[][]
  simplifiedHoles: Point2D[][]
  rawOuter?: Point2D[]
  // Raster debug info for panel display
  rasterDebug?: {
    rasterStageExecuted: "YES" | "NO"
    rasterInputSpace: string
    rasterCanvasWidth: number
    rasterCanvasHeight: number
    rasterMaskWidth: number
    rasterMaskHeight: number
    rasterThicknessPx: number
    rasterStrokeBoundsX: string
    rasterStrokeBoundsY: string
    filledPixels: number
    rasterRejected: "YES" | "NO"
    rasterRejectReason: string
  }
  // Solid mode diagnostic info for panel display
  solidDiagnostics?: {
    geometryMode: "FLAT_BASE" | "EXTRUDE_FROM_FLAT_BASE"
    geometryType: "FLAT" | "EXTRUDE_FROM_FLAT_BASE" | "NULL"
    gateExecuted: "YES" | "NO"
    contourClosed: "YES" | "NO"
    contourOrdered: "YES" | "NO"
    outerAreaAbs: number
    filledPixels: number
    areaToFillRatio: number
    contourRejected: "YES" | "NO"
    contourRejectReason: string
  }
}

// ============= Constants =============

const MASK_RESOLUTION = 512

// ============= GEOMETRY MODE SWITCH =============
// FLAT_BASE = current known-good checkpoint (valid contour -> FLAT, invalid -> NULL)
// EXTRUDE_FROM_FLAT_BASE = same validated flat base, then extruded
//
// Default: FLAT_BASE (the validated checkpoint must remain stable)
const SOLID_GEOMETRY_MODE: "FLAT_BASE" | "EXTRUDE_FROM_FLAT_BASE" = "FLAT_BASE"

// Extrusion depth in world units (only used when mode is EXTRUDE_FROM_FLAT_BASE)
const EXTRUDE_DEPTH = 0.15

// ============= Main Entry Point =============

export function buildMaskSolid(
  stroke: TestStroke,
  thickness: number,
  _depth: number,
  canvasWidth: number = 800,
  canvasHeight: number = 600
): MaskSolidResult {
  const startTime = performance.now()
  
  console.log("[v0-solid] FLAT_OR_NULL pipeline executing")
  
  // Initialize empty structures
  const emptyStages: MaskSolidStages = {
    centerline: stroke.points,
    maskData: [],
    maskWidth: 0,
    maskHeight: 0,
    outerContour: [],
    simplifiedOuter: [],
    holes: [],
    simplifiedHoles: []
  }
  
  const emptyStats: MaskSolidStats = {
    maskResolution: MASK_RESOLUTION,
    filledPixelCount: 0,
    componentCount: 0,
    largestComponentPixels: 0,
    outerContourPoints: 0,
    simplifiedOuterPoints: 0,
    holeCount: 0,
    rebuildTimeMs: 0
  }
  
  const nullDiagnostics: MaskSolidDiagnostics = {
    geometryMode: SOLID_GEOMETRY_MODE,
    geometryType: "NULL",
    outerSignedArea: 0,
    outerWinding: "CCW",
    // Raster fields
    rasterStageExecuted: "NO",
    rasterInputSpace: "UNKNOWN",
    rasterCanvasWidth: canvasWidth,
    rasterCanvasHeight: canvasHeight,
    rasterMaskWidth: 0,
    rasterMaskHeight: 0,
    rasterThicknessPx: 0,
    rasterStrokeBoundsX: "",
    rasterStrokeBoundsY: "",
    rasterRejected: "NO",
    rasterRejectReason: "",
    // Validation fields
    gateExecuted: "NO",
    contourClosed: "NO",
    contourOrdered: "NO",
    outerAreaAbs: 0,
    filledPixels: 0,
    areaToFillRatio: 0,
    contourRejected: "YES",
    contourRejectReason: "not yet executed"
  }
  
  // Early exit for empty stroke
  if (stroke.points.length < 2) {
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: { ...emptyStats, rebuildTimeMs: performance.now() - startTime },
      stages: emptyStages,
      diagnostics: { ...nullDiagnostics, contourRejectReason: "stroke has <2 points" }
    }
  }
  
  // ========== STAGE 1: Render stroke to mask ==========
  const { mask, width, height, filledCount, rasterDebug } = renderStrokeToMask(stroke.points, thickness, canvasWidth, canvasHeight)
  
  emptyStages.maskData = mask
  emptyStages.maskWidth = width
  emptyStages.maskHeight = height
  emptyStages.rasterDebug = rasterDebug  // Store for panel access
  
  // HARD FAIL: If no filled pixels, stop immediately
  if (filledCount === 0) {
    emptyStages.solidDiagnostics = {
      geometryMode: SOLID_GEOMETRY_MODE,
      geometryType: "NULL",
      gateExecuted: "NO",
      contourClosed: "NO",
      contourOrdered: "NO",
      outerAreaAbs: 0,
      filledPixels: 0,
      areaToFillRatio: 0,
      contourRejected: "YES",
      contourRejectReason: "raster stage failed"
    }
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: { ...emptyStats, rebuildTimeMs: performance.now() - startTime },
      stages: emptyStages,
      diagnostics: {
        ...nullDiagnostics,
        // Raster debug fields
        rasterStageExecuted: rasterDebug.rasterStageExecuted,
        rasterInputSpace: rasterDebug.rasterInputSpace,
        rasterCanvasWidth: rasterDebug.rasterCanvasWidth,
        rasterCanvasHeight: rasterDebug.rasterCanvasHeight,
        rasterMaskWidth: rasterDebug.rasterMaskWidth,
        rasterMaskHeight: rasterDebug.rasterMaskHeight,
        rasterThicknessPx: rasterDebug.rasterThicknessPx,
        rasterStrokeBoundsX: rasterDebug.rasterStrokeBoundsX,
        rasterStrokeBoundsY: rasterDebug.rasterStrokeBoundsY,
        rasterRejected: "YES",
        rasterRejectReason: rasterDebug.rasterRejectReason || "no filled pixels",
        filledPixels: 0,
        contourRejectReason: "raster stage failed"
      }
    }
  }
  
  // ========== STAGE 2: Label connected components ==========
  const { labels, componentCount, componentSizes } = labelConnectedComponents(mask, width, height)
  
  if (componentCount === 0) {
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: { ...emptyStats, filledPixelCount: filledCount, rebuildTimeMs: performance.now() - startTime },
      stages: emptyStages,
      diagnostics: { ...nullDiagnostics, filledPixels: filledCount, contourRejectReason: "no components" }
    }
  }
  
  // Find largest component
  let largestLabel = 1
  let largestSize = 0
  for (let i = 1; i <= componentCount; i++) {
    if (componentSizes[i] > largestSize) {
      largestSize = componentSizes[i]
      largestLabel = i
    }
  }
  
  // Create binary mask for largest component only
  const componentMask = new Array(width * height).fill(false)
  for (let i = 0; i < mask.length; i++) {
    componentMask[i] = labels[i] === largestLabel
  }
  
  // ========== STAGE 3: Extract boundary edges and chain into ordered loop ==========
  const outerContour = traceOuterContour(componentMask, width, height)
  emptyStages.outerContour = outerContour
  emptyStages.rawOuter = outerContour
  
  // Compute signed area in mask space
  let outerSignedArea = 0
  for (let i = 0; i < outerContour.length; i++) {
    const p1 = outerContour[i]
    const p2 = outerContour[(i + 1) % outerContour.length]
    outerSignedArea += p1.x * p2.y - p2.x * p1.y
  }
  outerSignedArea /= 2
  
  const outerAreaAbs = Math.abs(outerSignedArea)
  
  // ========== STAGE 4: HARD VALIDATION GATE ==========
  // This gate CANNOT be bypassed. If contour is invalid, geometry is NULL.
  
  // Check 1: Closed loop (first point near last point)
  let contourClosed = false
  if (outerContour.length > 2) {
    const first = outerContour[0]
    const last = outerContour[outerContour.length - 1]
    const closeDist = Math.sqrt((last.x - first.x) ** 2 + (last.y - first.y) ** 2)
    contourClosed = closeDist < 2.0
  }
  
  // Check 2: Ordered loop (no self-intersection)
  const contourOrdered = !contourSelfIntersects(outerContour)
  
  // Check 3: Meaningful area
  const areaToFillRatio = largestSize > 0 ? outerAreaAbs / largestSize : 0
  
  // Determine rejection
  let contourRejected = false
  let contourRejectReason = ""
  
  if (outerContour.length < 3) {
    contourRejected = true
    contourRejectReason = "less than 3 points"
  } else if (!contourClosed) {
    contourRejected = true
    contourRejectReason = "loop not closed"
  } else if (!contourOrdered) {
    contourRejected = true
    contourRejectReason = "self-intersecting"
  } else if (outerAreaAbs < 10) {
    contourRejected = true
    contourRejectReason = `outerAreaAbs=${outerAreaAbs.toFixed(1)}<10`
  } else if (areaToFillRatio < 0.1) {
    contourRejected = true
    contourRejectReason = `areaToFillRatio=${areaToFillRatio.toFixed(4)}<0.1`
  }
  
  // Log gate execution
  console.log("[v0-solid] VALIDATION GATE:", {
    gateExecuted: "YES",
    outerContourPoints: outerContour.length,
    outerAreaAbs: outerAreaAbs.toFixed(2),
    filledPixels: largestSize,
    areaToFillRatio: areaToFillRatio.toFixed(4),
    contourClosed: contourClosed ? "YES" : "NO",
    contourOrdered: contourOrdered ? "YES" : "NO",
    contourRejected: contourRejected ? "YES" : "NO",
    contourRejectReason: contourRejectReason || "none"
  })
  
  // Build diagnostics (will be used for both success and failure)
  // geometryType depends on SOLID_GEOMETRY_MODE when contour is valid
  const successGeometryType: "FLAT" | "EXTRUDE_FROM_FLAT_BASE" =
    SOLID_GEOMETRY_MODE === "EXTRUDE_FROM_FLAT_BASE" ? "EXTRUDE_FROM_FLAT_BASE" : "FLAT"
  
  const diagnostics: MaskSolidDiagnostics = {
    geometryMode: SOLID_GEOMETRY_MODE,
    geometryType: contourRejected ? "NULL" : successGeometryType,
    outerSignedArea,
    outerWinding: outerSignedArea > 0 ? "CCW" : "CW",
    // Raster fields (from earlier stage)
    rasterStageExecuted: rasterDebug.rasterStageExecuted,
    rasterInputSpace: rasterDebug.rasterInputSpace,
    rasterCanvasWidth: rasterDebug.rasterCanvasWidth,
    rasterCanvasHeight: rasterDebug.rasterCanvasHeight,
    rasterMaskWidth: rasterDebug.rasterMaskWidth,
    rasterMaskHeight: rasterDebug.rasterMaskHeight,
    rasterThicknessPx: rasterDebug.rasterThicknessPx,
    rasterStrokeBoundsX: rasterDebug.rasterStrokeBoundsX,
    rasterStrokeBoundsY: rasterDebug.rasterStrokeBoundsY,
    rasterRejected: rasterDebug.rasterRejected,
    rasterRejectReason: rasterDebug.rasterRejectReason,
    // Validation fields
    gateExecuted: "YES",
    contourClosed: contourClosed ? "YES" : "NO",
    contourOrdered: contourOrdered ? "YES" : "NO",
    outerAreaAbs,
    filledPixels: largestSize,
    areaToFillRatio,
    contourRejected: contourRejected ? "YES" : "NO",
    contourRejectReason
  }
  
  // Mirror solid diagnostics into stages so the debug panel (which reads
  // SOLID_DEBUG.lastStages) can display them without touching geometry-engines.ts.
  emptyStages.solidDiagnostics = {
    geometryMode: diagnostics.geometryMode,
    geometryType: diagnostics.geometryType,
    gateExecuted: diagnostics.gateExecuted,
    contourClosed: diagnostics.contourClosed,
    contourOrdered: diagnostics.contourOrdered,
    outerAreaAbs: diagnostics.outerAreaAbs,
    filledPixels: diagnostics.filledPixels,
    areaToFillRatio: diagnostics.areaToFillRatio,
    contourRejected: diagnostics.contourRejected,
    contourRejectReason: diagnostics.contourRejectReason
  }
  
  // HARD FAIL: Return NULL geometry if validation fails
  if (contourRejected) {
    console.log("[v0-solid] REJECTED: Not building geometry")
    
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: {
        maskResolution: MASK_RESOLUTION,
        filledPixelCount: filledCount,
        componentCount,
        largestComponentPixels: largestSize,
        outerContourPoints: outerContour.length,
        simplifiedOuterPoints: 0,
        holeCount: 0,
        rebuildTimeMs: performance.now() - startTime
      },
      stages: emptyStages,
      diagnostics
    }
  }
  
  // ========== STAGE 5: Build FLAT geometry ==========
  // Transform contour to world coordinates
  const scaleX = canvasWidth / width
  const scaleY = canvasHeight / height
  const scale = Math.min(scaleX, scaleY)
  const normScale = 3 / Math.max(canvasWidth, canvasHeight)
  
  const toWorldX = (mx: number) => (mx - width / 2) * scale * normScale
  const toWorldY = (my: number) => -(my - height / 2) * scale * normScale
  
  // Convert to THREE.Vector2
  let shapePts = outerContour.map(p => new THREE.Vector2(toWorldX(p.x), toWorldY(p.y)))
  
  // Ensure CCW winding for THREE.Shape
  let worldSignedArea = 0
  for (let i = 0; i < shapePts.length; i++) {
    const p1 = shapePts[i]
    const p2 = shapePts[(i + 1) % shapePts.length]
    worldSignedArea += p1.x * p2.y - p2.x * p1.y
  }
  worldSignedArea /= 2
  
  if (worldSignedArea < 0) {
    shapePts = shapePts.slice().reverse()
  }
  
  // Build the validated THREE.Shape from the validated outer loop.
  // This shape is shared by both FLAT_BASE and EXTRUDE_FROM_FLAT_BASE.
  let validatedShape: THREE.Shape
  try {
    validatedShape = new THREE.Shape(shapePts)
  } catch (e) {
    console.error("[v0-solid] THREE.Shape construction failed:", e)
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: {
        maskResolution: MASK_RESOLUTION,
        filledPixelCount: filledCount,
        componentCount,
        largestComponentPixels: largestSize,
        outerContourPoints: outerContour.length,
        simplifiedOuterPoints: shapePts.length,
        holeCount: 0,
        rebuildTimeMs: performance.now() - startTime
      },
      stages: emptyStages,
      diagnostics: {
        ...diagnostics,
        geometryType: "NULL",
        contourRejected: "YES",
        contourRejectReason: "THREE.Shape construction threw exception"
      }
    }
  }
  
  // Build flat geometry (this is the FLAT_BASE checkpoint output).
  // It is ALSO used as the cap source for EXTRUDE_FROM_FLAT_BASE.
  let flatGeom: THREE.BufferGeometry | null = null
  try {
    flatGeom = new THREE.ShapeGeometry(validatedShape)
    
    console.log("[v0-solid] FLAT_BASE: Built FLAT geometry", {
      inputPoints: shapePts.length,
      vertexCount: flatGeom.getAttribute("position")?.count ?? 0
    })
  } catch (e) {
    console.error("[v0-solid] ShapeGeometry failed:", e)
    
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: {
        maskResolution: MASK_RESOLUTION,
        filledPixelCount: filledCount,
        componentCount,
        largestComponentPixels: largestSize,
        outerContourPoints: outerContour.length,
        simplifiedOuterPoints: shapePts.length,
        holeCount: 0,
        rebuildTimeMs: performance.now() - startTime
      },
      stages: emptyStages,
      diagnostics: {
        ...diagnostics,
        geometryType: "NULL",
        contourRejected: "YES",
        contourRejectReason: "ShapeGeometry threw exception"
      }
    }
  }
  
  // ========== SUCCESS — Branch on SOLID_GEOMETRY_MODE ==========
  emptyStages.simplifiedOuter = outerContour
  
  const successStats: MaskSolidStats = {
    maskResolution: MASK_RESOLUTION,
    filledPixelCount: filledCount,
    componentCount,
    largestComponentPixels: largestSize,
    outerContourPoints: outerContour.length,
    simplifiedOuterPoints: shapePts.length,
    holeCount: 0,
    rebuildTimeMs: performance.now() - startTime
  }
  
  // ----- FLAT_BASE: known-good checkpoint, return flat geometry -----
  if (SOLID_GEOMETRY_MODE === "FLAT_BASE") {
    return {
      geometry: flatGeom,
      geometryNoHoles: flatGeom,
      stats: successStats,
      stages: emptyStages,
      diagnostics
    }
  }
  
  // ----- EXTRUDE_FROM_FLAT_BASE: build extrusion from validated shape -----
  // Branches from the EXACT same validated shape used by FLAT_BASE.
  // No alternate contour, no second tracer, no second raster, no holes.
  let extrudedGeom: THREE.BufferGeometry | null = null
  try {
    extrudedGeom = new THREE.ExtrudeGeometry(validatedShape, {
      depth: EXTRUDE_DEPTH,
      bevelEnabled: false,
      curveSegments: 1
    })
    // Center extrusion around z=0
    extrudedGeom.translate(0, 0, -EXTRUDE_DEPTH / 2)
    
    console.log("[v0-solid] EXTRUDE_FROM_FLAT_BASE: Built extruded geometry", {
      inputPoints: shapePts.length,
      depth: EXTRUDE_DEPTH,
      vertexCount: extrudedGeom.getAttribute("position")?.count ?? 0
    })
  } catch (e) {
    console.error("[v0-solid] EXTRUDE_FROM_FLAT_BASE: ExtrudeGeometry failed, falling back to flat:", e)
    
    // FALLBACK: extrusion failed, return the validated flat base instead.
    // This preserves the checkpoint as a fallback per the requirements.
    return {
      geometry: flatGeom,
      geometryNoHoles: flatGeom,
      stats: successStats,
      stages: emptyStages,
      diagnostics: {
        ...diagnostics,
        geometryType: "FLAT",
        contourRejectReason: "extrusion failed, fell back to FLAT_BASE"
      }
    }
  }
  
  return {
    geometry: extrudedGeom,
    geometryNoHoles: extrudedGeom,
    stats: successStats,
    stages: emptyStages,
    diagnostics
  }
}

// ============= Stage 1: Render Stroke to Mask =============

interface RasterDebugInfo {
  rasterStageExecuted: "YES" | "NO"
  rasterInputSpace: string
  rasterCanvasWidth: number
  rasterCanvasHeight: number
  rasterMaskWidth: number
  rasterMaskHeight: number
  rasterThicknessPx: number
  rasterStrokeBoundsX: string
  rasterStrokeBoundsY: string
  filledPixels: number
  rasterRejected: "YES" | "NO"
  rasterRejectReason: string
}

function renderStrokeToMask(
  points: Point2D[],
  thickness: number,
  canvasWidth: number,
  canvasHeight: number
): { mask: boolean[], width: number, height: number, filledCount: number, rasterDebug: RasterDebugInfo } {
  const width = MASK_RESOLUTION
  const height = Math.round(MASK_RESOLUTION * (canvasHeight / canvasWidth))
  
  // Initialize raster debug info
  const rasterDebug: RasterDebugInfo = {
    rasterStageExecuted: "YES",
    rasterInputSpace: "WORLD",
    rasterCanvasWidth: canvasWidth,
    rasterCanvasHeight: canvasHeight,
    rasterMaskWidth: width,
    rasterMaskHeight: height,
    rasterThicknessPx: 0,
    rasterStrokeBoundsX: "",
    rasterStrokeBoundsY: "",
    filledPixels: 0,
    rasterRejected: "NO",
    rasterRejectReason: ""
  }
  
  // ========== COORDINATE SPACE DETECTION ==========
  // Input points come from geometry-engines.ts strokesToTestStroke() which converts
  // canvas pixel coords (0 to canvasWidth) to world coords (roughly -1.5 to +1.5).
  // The conversion is: worldX = (pixelX - canvasWidth/2) * (3 / max(canvasWidth, canvasHeight))
  //
  // We need to reverse this to get mask coordinates:
  // maskX = (worldX / worldScale + canvasWidth/2) * (maskWidth / canvasWidth)
  // where worldScale = 3 / max(canvasWidth, canvasHeight)
  
  const worldScale = 3.0 / Math.max(canvasWidth, canvasHeight)
  
  // Compute stroke bounds in world space
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  
  rasterDebug.rasterStrokeBoundsX = `${minX.toFixed(3)} to ${maxX.toFixed(3)}`
  rasterDebug.rasterStrokeBoundsY = `${minY.toFixed(3)} to ${maxY.toFixed(3)}`
  
  // Convert world coords to mask coords
  // World -> Canvas pixel: pixelX = worldX / worldScale + canvasWidth/2
  // Canvas pixel -> Mask: maskX = pixelX * (maskWidth / canvasWidth)
  // Combined: maskX = (worldX / worldScale + canvasWidth/2) * (maskWidth / canvasWidth)
  //         = worldX * (maskWidth / (canvasWidth * worldScale)) + maskWidth/2
  
  const toMaskX = (worldX: number) => {
    const pixelX = worldX / worldScale + canvasWidth / 2
    return pixelX * (width / canvasWidth)
  }
  
  const toMaskY = (worldY: number) => {
    // Note: world Y is flipped (negative = down), but canvas Y is normal (positive = down)
    // World -> Canvas pixel: pixelY = -worldY / worldScale + canvasHeight/2
    const pixelY = -worldY / worldScale + canvasHeight / 2
    return pixelY * (height / canvasHeight)
  }
  
  // Convert thickness from world units to mask pixels
  // thickness in world units * (maskWidth / canvasWidth) / worldScale
  const thicknessPx = thickness / worldScale * (width / canvasWidth)
  rasterDebug.rasterThicknessPx = thicknessPx
  
  // Create offscreen canvas
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  
  // Clear to black (background)
  ctx.fillStyle = "black"
  ctx.fillRect(0, 0, width, height)
  
  // Draw stroke in white (foreground)
  ctx.strokeStyle = "white"
  ctx.lineWidth = Math.max(1, thicknessPx) // Ensure at least 1px
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  
  ctx.beginPath()
  for (let i = 0; i < points.length; i++) {
    const mx = toMaskX(points[i].x)
    const my = toMaskY(points[i].y)
    
    if (i === 0) {
      ctx.moveTo(mx, my)
    } else {
      ctx.lineTo(mx, my)
    }
  }
  ctx.stroke()
  
  // Read pixel data
  const imageData = ctx.getImageData(0, 0, width, height)
  const pixels = imageData.data
  const mask: boolean[] = new Array(width * height)
  let filledCount = 0
  
  for (let i = 0; i < width * height; i++) {
    const isFilled = pixels[i * 4] > 127
    mask[i] = isFilled
    if (isFilled) filledCount++
  }
  
  rasterDebug.filledPixels = filledCount
  
  if (filledCount === 0) {
    rasterDebug.rasterRejected = "YES"
    rasterDebug.rasterRejectReason = `stroke bounds (${rasterDebug.rasterStrokeBoundsX}, ${rasterDebug.rasterStrokeBoundsY}) may be outside mask`
  }
  
  console.log("[v0-solid] RASTER DEBUG:", rasterDebug)
  
  return { mask, width, height, filledCount, rasterDebug }
}

// ============= Stage 2: Connected Component Labeling =============

function labelConnectedComponents(
  mask: boolean[],
  width: number,
  height: number
): { labels: number[], componentCount: number, componentSizes: number[] } {
  const labels = new Array(width * height).fill(0)
  const componentSizes: number[] = [0]
  let componentCount = 0
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (mask[idx] && labels[idx] === 0) {
        componentCount++
        let size = 0
        
        const queue: number[] = [idx]
        labels[idx] = componentCount
        
        while (queue.length > 0) {
          const ci = queue.shift()!
          size++
          const cx = ci % width
          const cy = Math.floor(ci / width)
          
          const neighbors = [
            cy > 0 ? ci - width : -1,
            cy < height - 1 ? ci + width : -1,
            cx > 0 ? ci - 1 : -1,
            cx < width - 1 ? ci + 1 : -1
          ]
          
          for (const ni of neighbors) {
            if (ni >= 0 && mask[ni] && labels[ni] === 0) {
              labels[ni] = componentCount
              queue.push(ni)
            }
          }
        }
        
        componentSizes.push(size)
      }
    }
  }
  
  return { labels, componentCount, componentSizes }
}

// ============= Stage 3: Boundary Edge Extraction and Chaining =============

interface BoundaryEdge {
  x1: number
  y1: number
  x2: number
  y2: number
}

function extractBoundaryEdges(mask: boolean[], width: number, height: number): BoundaryEdge[] {
  const edges: BoundaryEdge[] = []
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (!mask[idx]) continue
      
      // Top edge
      if (y === 0 || !mask[(y - 1) * width + x]) {
        edges.push({ x1: x, y1: y, x2: x + 1, y2: y })
      }
      
      // Bottom edge (reversed for CCW)
      if (y === height - 1 || !mask[(y + 1) * width + x]) {
        edges.push({ x1: x + 1, y1: y + 1, x2: x, y2: y + 1 })
      }
      
      // Left edge (reversed for CCW)
      if (x === 0 || !mask[y * width + (x - 1)]) {
        edges.push({ x1: x, y1: y + 1, x2: x, y2: y })
      }
      
      // Right edge
      if (x === width - 1 || !mask[y * width + (x + 1)]) {
        edges.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 })
      }
    }
  }
  
  return edges
}

function chainBoundaryEdges(edges: BoundaryEdge[]): Point2D[] {
  if (edges.length === 0) return []
  
  const endpointKey = (x: number, y: number) => `${x},${y}`
  const edgesByStart = new Map<string, BoundaryEdge[]>()
  
  for (const edge of edges) {
    const key = endpointKey(edge.x1, edge.y1)
    if (!edgesByStart.has(key)) edgesByStart.set(key, [])
    edgesByStart.get(key)!.push(edge)
  }
  
  const used = new Set<BoundaryEdge>()
  const loops: Point2D[][] = []
  
  for (const edge of edges) {
    if (used.has(edge)) continue
    
    const loop: Point2D[] = []
    let current: BoundaryEdge | undefined = edge
    const startKey = endpointKey(edge.x1, edge.y1)
    
    while (current && !used.has(current)) {
      used.add(current)
      loop.push({ x: current.x1, y: current.y1 })
      
      const nextKey = endpointKey(current.x2, current.y2)
      
      if (nextKey === startKey && loop.length > 2) {
        break
      }
      
      const candidates = edgesByStart.get(nextKey)
      if (!candidates) break
      
      current = undefined
      for (const cand of candidates) {
        if (!used.has(cand)) {
          current = cand
          break
        }
      }
    }
    
    if (loop.length >= 3) {
      loops.push(loop)
    }
  }
  
  if (loops.length === 0) return []
  
  let longest = loops[0]
  for (const loop of loops) {
    if (loop.length > longest.length) {
      longest = loop
    }
  }
  
  return longest
}

function traceOuterContour(mask: boolean[], width: number, height: number): Point2D[] {
  const edges = extractBoundaryEdges(mask, width, height)
  if (edges.length === 0) return []
  return chainBoundaryEdges(edges)
}

// ============= Utility: Self-Intersection Check =============

function contourSelfIntersects(contour: Point2D[]): boolean {
  const n = contour.length
  if (n < 4) return false
  
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 2; j < n; j++) {
      if (j === n - 1 && i === 0) continue
      if (segmentsIntersect(contour[i], contour[i + 1], contour[j], contour[(j + 1) % n])) {
        return true
      }
    }
  }
  return false
}

function segmentsIntersect(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): boolean {
  const d1 = (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y)
  const d2 = (p4.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p4.y - p1.y)
  const d3 = (p1.x - p3.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p1.y - p3.y)
  const d4 = (p2.x - p3.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p3.y)
  
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }
  return false
}

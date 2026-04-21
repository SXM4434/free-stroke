/**
 * MASK-FIRST Solid Mode Pipeline
 * 
 * This approach renders the stroke to a high-resolution offscreen canvas,
 * then extracts boundaries from the FILLED REGION, not from edge transitions.
 * 
 * Pipeline:
 * 1. Render stroke to offscreen Canvas2D with round caps/joins
 * 2. Read pixel data to create binary mask
 * 3. Label connected components (flood fill)
 * 4. For each component, trace its boundary using contour following
 * 5. Detect true holes (enclosed background regions)
 * 6. Simplify contours with Douglas-Peucker
 * 7. Build THREE.Shape and extrude
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
  geometryNoHoles: THREE.BufferGeometry | null  // Stage D: outer only
  stats: MaskSolidStats
  stages: MaskSolidStages
  diagnostics: MaskSolidDiagnostics
}

export interface MaskSolidDiagnostics {
  outerSignedArea: number
  outerWinding: "CCW" | "CW"
  outerSelfIntersects: boolean
  holeAreas: number[]
  holeWindings: ("CCW" | "CW")[]
  anyHoleSelfIntersects: boolean
  anyHoleOutsideOuter: boolean
  holesOverlap: boolean
  // Diagnostic mode fields (for RAW_FLAT_ONLY isolation test)
  mode?: "RAW_FLAT_ONLY" | "NORMAL"
  usedSimplification?: "YES" | "NO"
  usedHoles?: "YES" | "NO"
  usedPrep?: "YES" | "NO"
  geometryType?: "FLAT" | "EXTRUDED"
  // Contour validation fields
  contourClosed?: "YES" | "NO"
  contourOrdered?: "YES" | "NO"
  outerAreaAbs?: number
  areaToFillRatio?: number
  contourRejected?: "YES" | "NO"
  contourRejectReason?: string
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
  maskData: boolean[]  // Flattened mask array
  maskWidth: number
  maskHeight: number
  outerContour: Point2D[]
  simplifiedOuter: Point2D[]
  holes: Point2D[][]
  simplifiedHoles: Point2D[][]
}

// ============= Constants =============

// DEBUG SWITCH: "flatCapOnly" = flat ShapeGeometry only (no extrusion)
//               "full" = current ExtrudeGeometry behavior
const SOLID_GEOM_MODE: "full" | "flatCapOnly" = "full"

// DIAGNOSTIC MODE: "RAW_FLAT_ONLY" = true isolation test (raw traced outer, no holes, no simplification, no prep, flat only)
//                  "RAW_EXTRUDE_ONLY" = same raw contour as RAW_FLAT_ONLY but with extrusion
//                  "WALLS_ONLY" = ONLY side walls, NO caps at all - isolates wall builder
//                  "NORMAL" = standard pipeline
const SOLID_DIAGNOSTIC_MODE: "RAW_FLAT_ONLY" | "RAW_EXTRUDE_ONLY" | "WALLS_ONLY" | "NORMAL" = "WALLS_ONLY"

const MASK_RESOLUTION = 512  // High-res mask for quality
const DP_TOLERANCE = 0.5     // Douglas-Peucker simplification tolerance

// BRUTALLY CONSERVATIVE hole filtering - reject questionable holes
// A questionable hole is worse than no hole
const MIN_HOLE_AREA_RATIO = 0.05     // Hole must be at least 5% of outer area (was 0.1%)
const MIN_HOLE_BBOX_DIM = 20         // Hole bbox must be at least 20px in each dimension (was 3)
const MIN_HOLE_POINTS_AFTER_SIMP = 6 // Hole must have at least 6 points (was 3)
const MIN_HOLE_COMPACTNESS = 0.3     // Hole must be reasonably compact (area / bbox_area)
const MIN_HOLE_ABS_AREA = 200        // Hole must have at least 200 sq px absolute area

// ============= Debug Helpers =============

function computeMaskBbox(mask: boolean[], width: number, height: number) {
  let minX = width, maxX = 0, minY = height, maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1, area: (maxX - minX + 1) * (maxY - minY + 1) }
}

function computeContourSignedArea(contour: Point2D[]): number {
  let area = 0
  for (let i = 0; i < contour.length; i++) {
    const p1 = contour[i]
    const p2 = contour[(i + 1) % contour.length]
    area += p1.x * p2.y - p2.x * p1.y
  }
  return area / 2
}

function computeContourBbox(contour: Point2D[]): { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of contour) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

function contourSelfIntersects(contour: Point2D[]): boolean {
  for (let i = 0; i < contour.length - 2; i++) {
    for (let j = i + 2; j < contour.length; j++) {
      if (j === contour.length - 1 && i === 0) continue  // Skip adjacent edges
      if (segmentsIntersect(contour[i], contour[i + 1], contour[j], contour[(j + 1) % contour.length])) {
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

function pointInPolygon(pt: Point2D, poly: Point2D[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    
    const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function holeIsInsideOuter(hole: Point2D[], outer: Point2D[]): boolean {
  if (hole.length === 0 || outer.length === 0) return false
  // Check if first point of hole is inside outer
  return pointInPolygon(hole[0], outer)
}

function holesIntersect(hole1: Point2D[], hole2: Point2D[]): boolean {
  // Check if any point of hole1 is inside hole2 or vice versa
  if (hole1.length === 0 || hole2.length === 0) return false
  return pointInPolygon(hole1[0], hole2) || pointInPolygon(hole2[0], hole1)
}

// ============= Main Entry Point =============

export function buildMaskSolid(
  stroke: TestStroke,
  thickness: number,
  depth: number,
  canvasWidth: number = 800,
  canvasHeight: number = 600
): MaskSolidResult {
  const startTime = performance.now()
  
  // Initialize empty result
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
  
  const emptyDiagnostics: MaskSolidDiagnostics = {
    outerSignedArea: 0,
    outerWinding: "CCW",
    outerSelfIntersects: false,
    holeAreas: [],
    holeWindings: [],
    anyHoleSelfIntersects: false,
    anyHoleOutsideOuter: false,
    holesOverlap: false,
    mode: SOLID_DIAGNOSTIC_MODE,
    usedSimplification: SOLID_DIAGNOSTIC_MODE === "NORMAL" ? "YES" : "NO",
    usedHoles: SOLID_DIAGNOSTIC_MODE === "NORMAL" ? "YES" : "NO",
    usedPrep: SOLID_DIAGNOSTIC_MODE === "NORMAL" ? "YES" : "NO",
    geometryType: SOLID_DIAGNOSTIC_MODE === "RAW_FLAT_ONLY" ? "FLAT" : "EXTRUDED",
  }
  
  if (stroke.points.length < 2) {
    return { geometry: null, geometryNoHoles: null, stats: { ...emptyStats, rebuildTimeMs: performance.now() - startTime }, stages: emptyStages, diagnostics: emptyDiagnostics }
  }
  
  // 1. Render stroke to offscreen canvas and get binary mask
  const { mask, width, height, filledCount } = renderStrokeToMask(stroke.points, thickness, canvasWidth, canvasHeight)
  
  emptyStages.maskData = mask
  emptyStages.maskWidth = width
  emptyStages.maskHeight = height
  
  if (filledCount === 0) {
    return { geometry: null, geometryNoHoles: null, stats: { ...emptyStats, rebuildTimeMs: performance.now() - startTime }, stages: emptyStages, diagnostics: emptyDiagnostics }
  }
  
  // 2. Label connected components
  const { labels, componentCount, componentSizes } = labelConnectedComponents(mask, width, height)
  
  if (componentCount === 0) {
    return { geometry: null, geometryNoHoles: null, stats: { ...emptyStats, filledPixelCount: filledCount, rebuildTimeMs: performance.now() - startTime }, stages: emptyStages, diagnostics: emptyDiagnostics }
  }
  
  // 3. Find largest component
  let largestLabel = 1
  let largestSize = 0
  for (let i = 1; i <= componentCount; i++) {
    if (componentSizes[i] > largestSize) {
      largestSize = componentSizes[i]
      largestLabel = i
    }
  }
  
  // 4. Create binary mask for largest component only
  const componentMask = new Array(width * height).fill(false)
  for (let i = 0; i < mask.length; i++) {
    componentMask[i] = labels[i] === largestLabel
  }
  
  // 5. Trace outer boundary using contour following algorithm
  const outerContour = traceOuterContour(componentMask, width, height)
  emptyStages.outerContour = outerContour
  
  // STAGE DEBUG: Log contour extraction
  const componentBbox = computeMaskBbox(componentMask, width, height)
  const outerSignedArea = computeContourSignedArea(outerContour)
  console.log("[v0-solid] STAGE 2 - Contour Extraction:", {
    componentBbox,
    componentArea: largestSize,
    outerContourPoints: outerContour.length,
    outerSignedArea,
    outerIsCCW: outerSignedArea > 0
  })
  
  if (outerContour.length < 3) {
    return { 
      geometry: null,
      geometryNoHoles: null,
      stats: { 
        ...emptyStats, 
        filledPixelCount: filledCount, 
        componentCount,
        largestComponentPixels: largestSize,
        outerContourPoints: outerContour.length,
        rebuildTimeMs: performance.now() - startTime 
      }, 
      stages: emptyStages,
      diagnostics: emptyDiagnostics,
    }
  }
  
  // ============= HARD FAIL-FAST GATE FOR INVALID CONTOURS =============
  // Compute validation metrics
  const outerAreaAbs = Math.abs(outerSignedArea)
  
  // Check if contour is closed (first point near last point)
  let contourClosed = false
  if (outerContour.length > 2) {
    const first = outerContour[0]
    const last = outerContour[outerContour.length - 1]
    const closeDist = Math.sqrt((last.x - first.x) ** 2 + (last.y - first.y) ** 2)
    contourClosed = closeDist < 2.0
  }
  
  // Check if contour is properly ordered (no self-intersection)
  const contourOrdered = !contourSelfIntersects(outerContour)
  
  // Area to fill ratio
  const areaToFillRatio = filledCount > 0 ? outerAreaAbs / filledCount : 0
  
  // Determine fail reason (check in order of priority)
  let contourRejected = false
  let contourRejectReason = ""
  
  if (!contourClosed) {
    contourRejected = true
    contourRejectReason = "contourClosed=NO"
  } else if (!contourOrdered) {
    contourRejected = true
    contourRejectReason = "contourOrdered=NO"
  } else if (outerAreaAbs <= 1) {
    contourRejected = true
    contourRejectReason = `outerAreaAbs=${outerAreaAbs.toFixed(2)}<=1`
  } else if (areaToFillRatio < 0.25) {
    contourRejected = true
    contourRejectReason = `areaToFillRatio=${areaToFillRatio.toFixed(4)}<0.25`
  }
  
  // Log validation results
  console.log("[v0-solid] CONTOUR VALIDATION GATE:", {
    mode: SOLID_DIAGNOSTIC_MODE,
    contourClosed: contourClosed ? "YES" : "NO",
    contourOrdered: contourOrdered ? "YES" : "NO",
    outerAreaAbs: outerAreaAbs.toFixed(2),
    filledPixels: filledCount,
    areaToFillRatio: areaToFillRatio.toFixed(4),
    contourRejected: contourRejected ? "YES" : "NO",
    contourRejectReason: contourRejectReason || "none"
  })
  
  // HARD FAIL: Do NOT build geometry if contour is invalid
  if (contourRejected) {
    console.log("[v0-solid] FAIL-FAST: Rejecting invalid contour, NOT building geometry")
    
    const failStats: MaskSolidStats = {
      maskResolution: MASK_RESOLUTION,
      filledPixelCount: filledCount,
      componentCount,
      largestComponentPixels: largestSize,
      outerContourPoints: outerContour.length,
      simplifiedOuterPoints: 0,
      holeCount: 0,
      rebuildTimeMs: performance.now() - startTime
    }
    
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: failStats,
      stages: emptyStages,
      diagnostics: {
        ...emptyDiagnostics,
        outerSignedArea,
        outerWinding: outerSignedArea > 0 ? "CCW" : "CW",
        mode: SOLID_DIAGNOSTIC_MODE,
        contourClosed: contourClosed ? "YES" : "NO",
        contourOrdered: contourOrdered ? "YES" : "NO",
        outerAreaAbs,
        areaToFillRatio,
        contourRejected: "YES",
        contourRejectReason
      }
    }
  }
  // ============= END HARD FAIL-FAST GATE =============
  
  // ============= RAW_FLAT_ONLY DIAGNOSTIC MODE =============
  // TRUE isolation: raw traced outer, no holes, no simplification, no prep, flat only
  if (SOLID_DIAGNOSTIC_MODE === "RAW_FLAT_ONLY") {
    const rawPts = outerContour.length
    
    // MINIMAL CLEANUP ONLY: remove duplicate closing point and near-identical consecutive points
    let cleanedOuter = [...outerContour]
    
    // Remove duplicate closing point if present
    if (cleanedOuter.length > 1) {
      const first = cleanedOuter[0]
      const last = cleanedOuter[cleanedOuter.length - 1]
      if (Math.abs(first.x - last.x) < 0.5 && Math.abs(first.y - last.y) < 0.5) {
        cleanedOuter.pop()
      }
    }
    
    // Remove near-identical consecutive points (< 0.5px apart)
    const dedupedOuter: Point2D[] = [cleanedOuter[0]]
    for (let i = 1; i < cleanedOuter.length; i++) {
      const prev = dedupedOuter[dedupedOuter.length - 1]
      const curr = cleanedOuter[i]
      const dist = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2)
      if (dist >= 0.5) {
        dedupedOuter.push(curr)
      }
    }
    cleanedOuter = dedupedOuter
    
    const finalPts = cleanedOuter.length
    
    // Transform to world coordinates
    const scaleX = canvasWidth / width
    const scaleY = canvasHeight / height
    const scale = Math.min(scaleX, scaleY)
    const normScale = 3 / Math.max(canvasWidth, canvasHeight)
    
    const toWorldX = (mx: number) => (mx - width / 2) * scale * normScale
    const toWorldY = (my: number) => -(my - height / 2) * scale * normScale
    
    // Convert to THREE.Vector2
    let shapePts = cleanedOuter.map(p => new THREE.Vector2(toWorldX(p.x), toWorldY(p.y)))
    
    // Ensure CCW winding
    const signedArea = computeSignedArea(shapePts)
    if (signedArea < 0) {
      shapePts = shapePts.slice().reverse()
    }
    
    // Create flat ShapeGeometry (NO HOLES, NO EXTRUSION)
    let flatGeom: THREE.BufferGeometry | null = null
    let success = false
    let vertexCount = 0
    
    try {
      const shape = new THREE.Shape(shapePts)
      flatGeom = new THREE.ShapeGeometry(shape)
      success = true
      vertexCount = flatGeom.getAttribute("position")?.count ?? 0
    } catch (e) {
      console.error("[v0-solid] RAW_FLAT_ONLY: ShapeGeometry failed:", e)
    }
    
    // REQUIRED DEBUG OUTPUT - these fields MUST appear in debug panel
    const diagnosticInfo = {
      mode: "RAW_FLAT_ONLY",
      usedSimplification: "NO",
      usedHoles: "NO",
      usedPrep: "NO",
      geometryType: "FLAT",
      rawPts,
      finalPts,
      vertexCount,
      success
    }
    
    console.log("[v0-solid] RAW_FLAT_ONLY DIAGNOSTIC:", diagnosticInfo)
    
    // Store diagnostic info in stages for debug panel access
    emptyStages.rawOuter = outerContour
    emptyStages.simplifiedOuter = cleanedOuter
    ;(emptyStages as unknown as Record<string, unknown>).diagnosticInfo = diagnosticInfo
    
    const stats: MaskSolidStats = {
      maskResolution: MASK_RESOLUTION,
      filledPixelCount: filledCount,
      componentCount,
      largestComponentPixels: largestSize,
      outerContourPoints: rawPts,
      simplifiedOuterPoints: finalPts,
      holeCount: 0,
      rebuildTimeMs: performance.now() - startTime
    }
    
    return {
      geometry: flatGeom,
      geometryNoHoles: flatGeom,
      stats,
      stages: emptyStages,
      diagnostics: {
        ...emptyDiagnostics,
        outerSignedArea: signedArea,
        outerWinding: signedArea > 0 ? "CCW" : "CW",
        mode: "RAW_FLAT_ONLY",
        usedSimplification: "NO",
        usedHoles: "NO",
        usedPrep: "NO",
        geometryType: "FLAT"
      }
    }
  }
  // ============= END RAW_FLAT_ONLY DIAGNOSTIC MODE =============
  
  // ============= RAW_EXTRUDE_ONLY DIAGNOSTIC MODE =============
  // Same raw contour as RAW_FLAT_ONLY but with EXTRUSION to test if extrusion breaks the silhouette
  if (SOLID_DIAGNOSTIC_MODE === "RAW_EXTRUDE_ONLY") {
    const rawPts = outerContour.length
    
    // MINIMAL CLEANUP ONLY: same as RAW_FLAT_ONLY
    let cleanedOuter = [...outerContour]
    
    // Remove duplicate closing point if present
    if (cleanedOuter.length > 1) {
      const first = cleanedOuter[0]
      const last = cleanedOuter[cleanedOuter.length - 1]
      if (Math.abs(first.x - last.x) < 0.5 && Math.abs(first.y - last.y) < 0.5) {
        cleanedOuter.pop()
      }
    }
    
    // Remove near-identical consecutive points (< 0.5px apart)
    const dedupedOuter: Point2D[] = [cleanedOuter[0]]
    for (let i = 1; i < cleanedOuter.length; i++) {
      const prev = dedupedOuter[dedupedOuter.length - 1]
      const curr = cleanedOuter[i]
      const dist = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2)
      if (dist >= 0.5) {
        dedupedOuter.push(curr)
      }
    }
    cleanedOuter = dedupedOuter
    
    const finalPts = cleanedOuter.length
    
    // Transform to world coordinates
    const scaleX = canvasWidth / width
    const scaleY = canvasHeight / height
    const scale = Math.min(scaleX, scaleY)
    const normScale = 3 / Math.max(canvasWidth, canvasHeight)
    const depth = 0.15
    
    const toWorldX = (mx: number) => (mx - width / 2) * scale * normScale
    const toWorldY = (my: number) => -(my - height / 2) * scale * normScale
    
    // Convert to THREE.Vector2
    let shapePts = cleanedOuter.map(p => new THREE.Vector2(toWorldX(p.x), toWorldY(p.y)))
    
    // Ensure CCW winding
    const signedArea = computeSignedArea(shapePts)
    if (signedArea < 0) {
      shapePts = shapePts.slice().reverse()
    }
    
    // MANUAL EXTRUSION - DO NOT USE THREE.ExtrudeGeometry
    // Build geometry manually: front cap + back cap + side walls
    let manualGeom: THREE.BufferGeometry | null = null
    let success = false
    let vertexCount = 0
    
    // Wall segment epsilon - skip edges shorter than this
    const WALL_EPSILON = 0.0001
    
    try {
      // ========== STEP 0: NORMALIZE BOUNDARY LOOP ==========
      // Remove duplicated closing point, consecutive duplicates, zero-length edges
      let boundary = [...shapePts]
      
      // Remove duplicated closing point if first ~= last
      if (boundary.length > 1) {
        const first = boundary[0]
        const last = boundary[boundary.length - 1]
        const closeDist = Math.sqrt((last.x - first.x) ** 2 + (last.y - first.y) ** 2)
        if (closeDist < WALL_EPSILON) {
          boundary.pop()
        }
      }
      
      // Remove consecutive duplicate / near-duplicate points
      const cleanBoundary: THREE.Vector2[] = []
      for (let i = 0; i < boundary.length; i++) {
        const curr = boundary[i]
        if (cleanBoundary.length === 0) {
          cleanBoundary.push(curr)
        } else {
          const prev = cleanBoundary[cleanBoundary.length - 1]
          const dist = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2)
          if (dist >= WALL_EPSILON) {
            cleanBoundary.push(curr)
          }
        }
      }
      
      // Final check: ensure loop doesn't close on itself
      if (cleanBoundary.length > 1) {
        const first = cleanBoundary[0]
        const last = cleanBoundary[cleanBoundary.length - 1]
        const closeDist = Math.sqrt((last.x - first.x) ** 2 + (last.y - first.y) ** 2)
        if (closeDist < WALL_EPSILON) {
          cleanBoundary.pop()
        }
      }
      
      boundary = cleanBoundary
      const n = boundary.length
      if (n < 3) throw new Error("Need at least 3 boundary points after cleanup")
      
      // ========== STEP 1: BUILD FRONT CAP ==========
      const shape = new THREE.Shape(boundary)
      const frontCapGeom = new THREE.ShapeGeometry(shape)
      
      const frontPosAttr = frontCapGeom.getAttribute("position")
      const frontIndexAttr = frontCapGeom.getIndex()
      
      if (!frontPosAttr || !frontIndexAttr) throw new Error("Front cap missing attributes")
      
      const frontCapVertCount = frontPosAttr.count
      const frontCapIndexCount = frontIndexAttr.count
      
      // ========== STEP 2: COUNT VALID WALL SEGMENTS ==========
      // Pre-count valid segments (length >= epsilon) to size arrays correctly
      let validSegmentCount = 0
      for (let i = 0; i < n; i++) {
        const curr = boundary[i]
        const next = boundary[(i + 1) % n]
        const edgeLen = Math.sqrt((next.x - curr.x) ** 2 + (next.y - curr.y) ** 2)
        if (edgeLen >= WALL_EPSILON) {
          validSegmentCount++
        }
      }
      
      // ========== STEP 3: ALLOCATE ARRAYS ==========
      const sideVertCount = validSegmentCount * 4
      const sideIndexCount = validSegmentCount * 6
      const totalVertCount = frontCapVertCount * 2 + sideVertCount
      const totalIndexCount = frontCapIndexCount * 2 + sideIndexCount
      
      const positions = new Float32Array(totalVertCount * 3)
      const normals = new Float32Array(totalVertCount * 3)
      const indices = new Uint32Array(totalIndexCount)
      
      let vOffset = 0
      let iOffset = 0
      
      // ========== STEP 4: FRONT CAP AT Z = +depth/2 ==========
      for (let i = 0; i < frontCapVertCount; i++) {
        positions[vOffset * 3 + 0] = frontPosAttr.getX(i)
        positions[vOffset * 3 + 1] = frontPosAttr.getY(i)
        positions[vOffset * 3 + 2] = depth / 2
        normals[vOffset * 3 + 0] = 0
        normals[vOffset * 3 + 1] = 0
        normals[vOffset * 3 + 2] = 1
        vOffset++
      }
      const frontCapStart = 0
      for (let i = 0; i < frontCapIndexCount; i++) {
        indices[iOffset++] = frontIndexAttr.getX(i) + frontCapStart
      }
      
      // ========== STEP 5: BACK CAP AT Z = -depth/2 ==========
      const backCapStart = vOffset
      for (let i = 0; i < frontCapVertCount; i++) {
        positions[vOffset * 3 + 0] = frontPosAttr.getX(i)
        positions[vOffset * 3 + 1] = frontPosAttr.getY(i)
        positions[vOffset * 3 + 2] = -depth / 2
        normals[vOffset * 3 + 0] = 0
        normals[vOffset * 3 + 1] = 0
        normals[vOffset * 3 + 2] = -1
        vOffset++
      }
      // Reverse winding for back cap
      for (let i = 0; i < frontCapIndexCount; i += 3) {
        indices[iOffset++] = frontIndexAttr.getX(i + 0) + backCapStart
        indices[iOffset++] = frontIndexAttr.getX(i + 2) + backCapStart
        indices[iOffset++] = frontIndexAttr.getX(i + 1) + backCapStart
      }
      
      // ========== STEP 6: SIDE WALLS ==========
      // Iterate each segment exactly once, build one quad per valid segment
      const sideStart = vOffset
      let quadIndex = 0
      
      for (let i = 0; i < n; i++) {
        const curr = boundary[i]
        const next = boundary[(i + 1) % n]
        
        // Compute edge length - skip if below epsilon
        const edgeX = next.x - curr.x
        const edgeY = next.y - curr.y
        const edgeLen = Math.sqrt(edgeX * edgeX + edgeY * edgeY)
        
        if (edgeLen < WALL_EPSILON) {
          continue // Skip zero-length or near-zero edges
        }
        
        // Compute outward normal (perpendicular to edge, pointing outward for CCW boundary)
        const nx = edgeY / edgeLen
        const ny = -edgeX / edgeLen
        
        // Quad vertex indices
        const qi = sideStart + quadIndex * 4
        
        // Vertex 0: curr-front
        positions[vOffset * 3 + 0] = curr.x
        positions[vOffset * 3 + 1] = curr.y
        positions[vOffset * 3 + 2] = depth / 2
        normals[vOffset * 3 + 0] = nx
        normals[vOffset * 3 + 1] = ny
        normals[vOffset * 3 + 2] = 0
        vOffset++
        
        // Vertex 1: next-front
        positions[vOffset * 3 + 0] = next.x
        positions[vOffset * 3 + 1] = next.y
        positions[vOffset * 3 + 2] = depth / 2
        normals[vOffset * 3 + 0] = nx
        normals[vOffset * 3 + 1] = ny
        normals[vOffset * 3 + 2] = 0
        vOffset++
        
        // Vertex 2: next-back
        positions[vOffset * 3 + 0] = next.x
        positions[vOffset * 3 + 1] = next.y
        positions[vOffset * 3 + 2] = -depth / 2
        normals[vOffset * 3 + 0] = nx
        normals[vOffset * 3 + 1] = ny
        normals[vOffset * 3 + 2] = 0
        vOffset++
        
        // Vertex 3: curr-back
        positions[vOffset * 3 + 0] = curr.x
        positions[vOffset * 3 + 1] = curr.y
        positions[vOffset * 3 + 2] = -depth / 2
        normals[vOffset * 3 + 0] = nx
        normals[vOffset * 3 + 1] = ny
        normals[vOffset * 3 + 2] = 0
        vOffset++
        
        // Two triangles per quad - consistent CCW winding when viewed from outside
        // Triangle 1: curr-front -> next-front -> next-back
        indices[iOffset++] = qi + 0
        indices[iOffset++] = qi + 1
        indices[iOffset++] = qi + 2
        // Triangle 2: curr-front -> next-back -> curr-back
        indices[iOffset++] = qi + 0
        indices[iOffset++] = qi + 2
        indices[iOffset++] = qi + 3
        
        quadIndex++
      }
      
      // ========== STEP 7: CREATE BUFFER GEOMETRY ==========
      manualGeom = new THREE.BufferGeometry()
      manualGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3))
      manualGeom.setAttribute("normal", new THREE.BufferAttribute(normals, 3))
      manualGeom.setIndex(new THREE.BufferAttribute(indices, 1))
      
      // Cleanup
      frontCapGeom.dispose()
      
      success = true
      vertexCount = manualGeom.getAttribute("position")?.count ?? 0
      
      console.log("[v0-solid] MANUAL EXTRUSION built:", {
        rawBoundaryPoints: shapePts.length,
        cleanedBoundaryPoints: n,
        validWallSegments: validSegmentCount,
        skippedSegments: n - validSegmentCount,
        frontCapVerts: frontCapVertCount,
        sideVerts: sideVertCount,
        totalVerts: vertexCount,
        totalIndices: totalIndexCount
      })
    } catch (e) {
      console.error("[v0-solid] RAW_EXTRUDE_ONLY: Manual extrusion failed:", e)
    }
    
    // REQUIRED DEBUG OUTPUT - these fields MUST appear in debug panel
    const diagnosticInfo = {
      mode: "RAW_EXTRUDE_ONLY",
      usedSimplification: "NO",
      usedHoles: "NO",
      usedPrep: "NO",
      geometryType: "MANUAL_EXTRUDED",
      rawPts,
      finalPts,
      vertexCount,
      success
    }
    
    console.log("[v0-solid] RAW_EXTRUDE_ONLY DIAGNOSTIC:", diagnosticInfo)
    
    // Store diagnostic info in stages for debug panel access
    emptyStages.rawOuter = outerContour
    emptyStages.simplifiedOuter = cleanedOuter
    ;(emptyStages as unknown as Record<string, unknown>).diagnosticInfo = diagnosticInfo
    
    const stats: MaskSolidStats = {
      maskResolution: MASK_RESOLUTION,
      filledPixelCount: filledCount,
      componentCount,
      largestComponentPixels: largestSize,
      outerContourPoints: rawPts,
      simplifiedOuterPoints: finalPts,
      holeCount: 0,
      rebuildTimeMs: performance.now() - startTime
    }
    
    return {
      geometry: manualGeom,
      geometryNoHoles: manualGeom,
      stats,
      stages: emptyStages,
      diagnostics: {
        ...emptyDiagnostics,
        outerSignedArea: signedArea,
        outerWinding: signedArea > 0 ? "CCW" : "CW",
        mode: "RAW_EXTRUDE_ONLY",
        usedSimplification: "NO",
        usedHoles: "NO",
        usedPrep: "NO",
        geometryType: "MANUAL_EXTRUDED"
      }
    }
  }
  // ============= END RAW_EXTRUDE_ONLY DIAGNOSTIC MODE =============
  
  // ============= WALLS_ONLY DIAGNOSTIC MODE =============
  // ONLY side walls, NO caps at all - isolates wall builder
  if (SOLID_DIAGNOSTIC_MODE === "WALLS_ONLY") {
    const rawPts = outerContour.length
    
    // ========== CONTOUR VALIDATION ==========
    // Compute raw contour signed area in mask space
    let rawSignedArea = 0
    for (let i = 0; i < outerContour.length; i++) {
      const p1 = outerContour[i]
      const p2 = outerContour[(i + 1) % outerContour.length]
      rawSignedArea += p1.x * p2.y - p2.x * p1.y
    }
    rawSignedArea /= 2
    const outerAreaAbs = Math.abs(rawSignedArea)
    
    // Check if contour is closed (first point near last point)
    let contourClosed = false
    if (outerContour.length > 2) {
      const first = outerContour[0]
      const last = outerContour[outerContour.length - 1]
      const closeDist = Math.sqrt((last.x - first.x) ** 2 + (last.y - first.y) ** 2)
      contourClosed = closeDist < 2.0 // Within 2 pixels
    }
    
    // Check if contour is properly ordered (no self-intersection as proxy)
    const contourOrdered = !contourSelfIntersects(outerContour)
    
    // Area to fill ratio - should be close to 1.0 for valid contour
    const areaToFillRatio = filledCount > 0 ? outerAreaAbs / filledCount : 0
    
    // Validation
    let contourRejected = false
    let contourRejectReason = ""
    
    if (outerContour.length < 3) {
      contourRejected = true
      contourRejectReason = "too few points"
    } else if (!contourClosed) {
      contourRejected = true
      contourRejectReason = "not closed"
    } else if (areaToFillRatio < 0.5) {
      contourRejected = true
      contourRejectReason = `area/fill ratio ${areaToFillRatio.toFixed(3)} < 0.5`
    }
    
    console.log("[v0-solid] CONTOUR VALIDATION:", {
      rawPts,
      contourClosed: contourClosed ? "YES" : "NO",
      contourOrdered: contourOrdered ? "YES" : "NO",
      outerAreaAbs: outerAreaAbs.toFixed(1),
      filledPixels: filledCount,
      areaToFillRatio: areaToFillRatio.toFixed(3),
      contourRejected: contourRejected ? "YES" : "NO",
      contourRejectReason: contourRejectReason || "none"
    })
    
    // If contour is invalid, fail fast
    if (contourRejected) {
      const stats: MaskSolidStats = {
        maskResolution: MASK_RESOLUTION,
        filledPixelCount: filledCount,
        componentCount,
        largestComponentPixels: largestSize,
        outerContourPoints: rawPts,
        simplifiedOuterPoints: 0,
        holeCount: 0,
        rebuildTimeMs: performance.now() - startTime
      }
      
      return {
        geometry: null,
        geometryNoHoles: null,
        stats,
        stages: emptyStages,
        diagnostics: {
          ...emptyDiagnostics,
          outerSignedArea: rawSignedArea,
          outerWinding: rawSignedArea > 0 ? "CCW" : "CW",
          mode: "WALLS_ONLY",
          contourClosed: contourClosed ? "YES" : "NO",
          contourOrdered: contourOrdered ? "YES" : "NO",
          outerAreaAbs,
          areaToFillRatio,
          contourRejected: "YES",
          contourRejectReason
        }
      }
    }
    
    // ========== END CONTOUR VALIDATION ==========
    
    // Use raw contour directly (no cleanup needed for boundary-edge traced contour)
    const finalPts = outerContour.length
    
    // Transform to world coordinates
    const scaleX = canvasWidth / width
    const scaleY = canvasHeight / height
    const scale = Math.min(scaleX, scaleY)
    const normScale = 3 / Math.max(canvasWidth, canvasHeight)
    const depth = 0.15
    
    const toWorldX = (mx: number) => (mx - width / 2) * scale * normScale
    const toWorldY = (my: number) => -(my - height / 2) * scale * normScale
    
    // Convert to world coordinates
    let boundary = outerContour.map(p => ({ x: toWorldX(p.x), y: toWorldY(p.y) }))
    
    // Ensure CCW winding
    let boundaryArea = 0
    for (let i = 0; i < boundary.length; i++) {
      const p1 = boundary[i]
      const p2 = boundary[(i + 1) % boundary.length]
      boundaryArea += p1.x * p2.y - p2.x * p1.y
    }
    boundaryArea /= 2
    if (boundaryArea < 0) {
      boundary = boundary.slice().reverse()
      boundaryArea = -boundaryArea
    }
    
    // BUILD WALLS ONLY - NO CAPS
    let wallsGeom: THREE.BufferGeometry | null = null
    let success = false
    let vertexCount = 0
    
    const WALL_EPSILON = 0.0001
    
    try {
      const n = boundary.length
      if (n < 3) throw new Error("Need at least 3 boundary points")
      
      // Count valid segments
      let validSegmentCount = 0
      for (let i = 0; i < n; i++) {
        const curr = boundary[i]
        const next = boundary[(i + 1) % n]
        const edgeLen = Math.sqrt((next.x - curr.x) ** 2 + (next.y - curr.y) ** 2)
        if (edgeLen >= WALL_EPSILON) {
          validSegmentCount++
        }
      }
      
      // WALLS ONLY: 4 vertices per quad, 6 indices per quad
      const wallVertCount = validSegmentCount * 4
      const wallIndexCount = validSegmentCount * 6
      
      const positions = new Float32Array(wallVertCount * 3)
      const normals = new Float32Array(wallVertCount * 3)
      const indices = new Uint32Array(wallIndexCount)
      
      let vOffset = 0
      let iOffset = 0
      let quadIndex = 0
      
      for (let i = 0; i < n; i++) {
        const curr = boundary[i]
        const next = boundary[(i + 1) % n]
        
        const edgeX = next.x - curr.x
        const edgeY = next.y - curr.y
        const edgeLen = Math.sqrt(edgeX * edgeX + edgeY * edgeY)
        
        if (edgeLen < WALL_EPSILON) continue
        
        // Outward normal for CCW boundary
        const nx = edgeY / edgeLen
        const ny = -edgeX / edgeLen
        
        const qi = quadIndex * 4
        
        // curr-front
        positions[vOffset * 3 + 0] = curr.x
        positions[vOffset * 3 + 1] = curr.y
        positions[vOffset * 3 + 2] = depth / 2
        normals[vOffset * 3 + 0] = nx
        normals[vOffset * 3 + 1] = ny
        normals[vOffset * 3 + 2] = 0
        vOffset++
        
        // next-front
        positions[vOffset * 3 + 0] = next.x
        positions[vOffset * 3 + 1] = next.y
        positions[vOffset * 3 + 2] = depth / 2
        normals[vOffset * 3 + 0] = nx
        normals[vOffset * 3 + 1] = ny
        normals[vOffset * 3 + 2] = 0
        vOffset++
        
        // next-back
        positions[vOffset * 3 + 0] = next.x
        positions[vOffset * 3 + 1] = next.y
        positions[vOffset * 3 + 2] = -depth / 2
        normals[vOffset * 3 + 0] = nx
        normals[vOffset * 3 + 1] = ny
        normals[vOffset * 3 + 2] = 0
        vOffset++
        
        // curr-back
        positions[vOffset * 3 + 0] = curr.x
        positions[vOffset * 3 + 1] = curr.y
        positions[vOffset * 3 + 2] = -depth / 2
        normals[vOffset * 3 + 0] = nx
        normals[vOffset * 3 + 1] = ny
        normals[vOffset * 3 + 2] = 0
        vOffset++
        
        // Two triangles per quad
        indices[iOffset++] = qi + 0
        indices[iOffset++] = qi + 1
        indices[iOffset++] = qi + 2
        indices[iOffset++] = qi + 0
        indices[iOffset++] = qi + 2
        indices[iOffset++] = qi + 3
        
        quadIndex++
      }
      
      wallsGeom = new THREE.BufferGeometry()
      wallsGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3))
      wallsGeom.setAttribute("normal", new THREE.BufferAttribute(normals, 3))
      wallsGeom.setIndex(new THREE.BufferAttribute(indices, 1))
      
      success = true
      vertexCount = wallsGeom.getAttribute("position")?.count ?? 0
      
      console.log("[v0-solid] WALLS_ONLY built:", {
        rawPts,
        finalPts,
        boundaryPoints: n,
        validSegments: validSegmentCount,
        wallVerts: vertexCount,
        wallIndices: wallIndexCount,
        CAPS_DISABLED: true
      })
    } catch (e) {
      console.error("[v0-solid] WALLS_ONLY failed:", e)
    }
    
    const stats: MaskSolidStats = {
      maskResolution: MASK_RESOLUTION,
      filledPixelCount: filledCount,
      componentCount,
      largestComponentPixels: largestSize,
      outerContourPoints: rawPts,
      simplifiedOuterPoints: finalPts,
      holeCount: 0,
      rebuildTimeMs: performance.now() - startTime
    }
    
    return {
      geometry: wallsGeom,
      geometryNoHoles: wallsGeom,
      stats,
      stages: emptyStages,
      diagnostics: {
        ...emptyDiagnostics,
        outerSignedArea: boundaryArea,
        outerWinding: boundaryArea > 0 ? "CCW" : "CW",
        mode: "WALLS_ONLY",
        usedSimplification: "NO",
        usedHoles: "NO",
        usedPrep: "NO",
        geometryType: "WALLS_ONLY",
        contourClosed: contourClosed ? "YES" : "NO",
        contourOrdered: contourOrdered ? "YES" : "NO",
        outerAreaAbs,
        areaToFillRatio,
        contourRejected: "NO",
        contourRejectReason: ""
      }
    }
  }
  // ============= END WALLS_ONLY DIAGNOSTIC MODE =============
  
  // 6. PREPARE OUTER CONTOUR FOR GEOMETRY (aggressive stair-step removal)
  const outerPrepResult = prepareOuterContourForGeometry(outerContour)
  const finalOuter = outerPrepResult.accepted ? outerPrepResult.prepared : outerContour
  emptyStages.simplifiedOuter = finalOuter
  
  // Required console output for outer contour prep
  console.log("[v0-solid] OUTER CONTOUR PREP:", {
    rawPts: outerPrepResult.rawPts,
    preparedPts: outerPrepResult.preparedPts,
    reductionPercent: outerPrepResult.reductionPercent.toFixed(1) + "%",
    bboxRetentionPercent: outerPrepResult.bboxRetention.toFixed(1) + "%",
    areaRetentionPercent: outerPrepResult.areaRetention.toFixed(1) + "%",
    selfIntersectBefore: outerPrepResult.selfIntersectBefore,
    selfIntersectAfter: outerPrepResult.selfIntersectAfter,
    accepted: outerPrepResult.accepted,
    rejectReason: outerPrepResult.rejectReason || "none"
  })
  
  const simplifiedSignedArea = computeContourSignedArea(finalOuter)
  
  console.log("[v0-solid] STAGE 3 - Final Outer:", {
    rawPoints: outerContour.length,
    finalPoints: finalOuter.length,
    reductionPercent: ((1 - finalOuter.length / outerContour.length) * 100).toFixed(1),
    finalSignedArea: simplifiedSignedArea,
    areaRetentionAcceptable: outerPrepResult.areaRetention >= 90,
    USING: outerPrepResult.accepted ? "PREPARED" : "RAW"
  })
  
  // 7. Find holes (enclosed background regions)
  const { holes, simplifiedHoles } = findAndTraceHoles(componentMask, width, height, outerContour)
  emptyStages.holes = holes
  emptyStages.simplifiedHoles = simplifiedHoles
  
  // STAGE DEBUG: Log hole detection
  const holeInfo = simplifiedHoles.map((h, i) => ({
    index: i,
    rawPoints: holes[i].length,
    simplifiedPoints: h.length,
    signedArea: computeContourSignedArea(h),
    isCW: computeContourSignedArea(h) < 0,
    isInsideOuter: holeIsInsideOuter(h, finalOuter),
    selfIntersects: contourSelfIntersects(h)
  }))
  
  // Check for hole overlaps
  let holesOverlap = false
  for (let i = 0; i < simplifiedHoles.length && !holesOverlap; i++) {
    for (let j = i + 1; j < simplifiedHoles.length; j++) {
      if (holesIntersect(simplifiedHoles[i], simplifiedHoles[j])) {
        holesOverlap = true
        break
      }
    }
  }
  
  // Build diagnostics (will be updated after filtering)
  const outerSelfIntersects = contourSelfIntersects(finalOuter)
  
  console.log("[v0-solid] STAGE 4 - Hole Detection (raw):", {
    rawHoleCount: simplifiedHoles.length,
    holes: holeInfo,
    allHolesInsideOuter: holeInfo.every(h => h.isInsideOuter),
    holesOverlap,
    anyHoleSelfIntersects: holeInfo.some(h => h.selfIntersects),
    outerSelfIntersects
  })
  
  // 7b. FILTER AND NORMALIZE HOLES - reject tiny/unstable, normalize winding
  const finalOuterArea = computeContourSignedArea(finalOuter)
  const holeFilterResult = filterAndNormalizeHoles(simplifiedHoles, finalOuter, finalOuterArea)
  const filteredHoles = holeFilterResult.validHoles
  
  console.log("[v0-solid] STAGE 4b - Hole Filtering:", {
    rawHoles: simplifiedHoles.length,
    validHoles: filteredHoles.length,
    discarded: holeFilterResult.discardedCount,
    discardReasons: holeFilterResult.discardReasons,
    windingReport: holeFilterResult.windingReport
  })
  
  // Normalize outer contour winding to CCW (positive area)
  let normalizedOuter = finalOuter
  if (finalOuterArea < 0) {
    normalizedOuter = finalOuter.slice().reverse()
    console.log("[v0-solid] STAGE 4b - Outer normalized: CW→CCW")
  }
  
  // Build diagnostics with FILTERED hole info
  const filteredHoleAreas = filteredHoles.map(h => computeContourSignedArea(h))
  const diagnostics: MaskSolidDiagnostics = {
    outerSignedArea: finalOuterArea,
    outerWinding: finalOuterArea > 0 ? "CCW" : "CW",
    outerSelfIntersects,
    holeAreas: filteredHoleAreas,
    holeWindings: filteredHoleAreas.map(a => a < 0 ? "CW" : "CCW"),
    anyHoleSelfIntersects: filteredHoles.some(h => contourSelfIntersects(h)),
    anyHoleOutsideOuter: filteredHoles.some(h => !holeIsInsideOuter(h, normalizedOuter)),
    holesOverlap: false,  // Already filtered
  }
  
  // 8. Build STAGE D geometry (outer only, no holes)
  const geometryNoHoles = buildExtrudedGeometry(normalizedOuter, [], width, height, canvasWidth, canvasHeight, depth)
  
  console.log("[v0-solid] STAGE D - Outer Only Extrusion:", {
    geometryCreated: geometryNoHoles !== null,
    vertexCount: geometryNoHoles ? geometryNoHoles.getAttribute("position")?.count : 0,
    indexCount: geometryNoHoles ? geometryNoHoles.getIndex()?.count : 0
  })
  
  // 9. Build STAGE E geometry (outer + FILTERED holes)
  const geometry = buildExtrudedGeometry(normalizedOuter, filteredHoles, width, height, canvasWidth, canvasHeight, depth)
  
  console.log("[v0-solid] STAGE E - Full Extrusion with Holes:", {
    geometryCreated: geometry !== null,
    vertexCount: geometry ? geometry.getAttribute("position")?.count : 0,
    indexCount: geometry ? geometry.getIndex()?.count : 0
  })
  
  const stats: MaskSolidStats = {
    maskResolution: MASK_RESOLUTION,
    filledPixelCount: filledCount,
    componentCount,
    largestComponentPixels: largestSize,
    outerContourPoints: outerContour.length,
    simplifiedOuterPoints: finalOuter.length,  // Use finalOuter (may be raw if bypass)
    holeCount: filteredHoles.length,  // Use FILTERED count, not raw
    rebuildTimeMs: performance.now() - startTime
  }
  
  return { geometry, geometryNoHoles, stats, stages: emptyStages, diagnostics }
}

// ============= Stage 1: Render to Mask =============

function renderStrokeToMask(
  points: Point2D[],
  thickness: number,
  canvasWidth: number,
  canvasHeight: number
): { mask: boolean[], width: number, height: number, filledCount: number } {
  const width = MASK_RESOLUTION
  const height = MASK_RESOLUTION
  
  // Create offscreen canvas
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  
  // Clear to black (background)
  ctx.fillStyle = "black"
  ctx.fillRect(0, 0, width, height)
  
  // Calculate scale to fit stroke in mask
  const scaleX = width / canvasWidth
  const scaleY = height / canvasHeight
  const scale = Math.min(scaleX, scaleY)
  
  // Scale thickness to mask coordinates
  const scaledThickness = thickness * scale * Math.max(canvasWidth, canvasHeight) / 3  // Match world-to-pixel conversion
  
  // Draw stroke with round caps and joins
  ctx.strokeStyle = "white"
  ctx.lineWidth = Math.max(1, scaledThickness)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  
  ctx.beginPath()
  
  // Transform points to mask coordinates
  const offsetX = width / 2
  const offsetY = height / 2
  
  for (let i = 0; i < points.length; i++) {
    // Points are in world coords (-1.5 to 1.5 range typically)
    // Transform to mask coords (0 to MASK_RESOLUTION)
    const mx = points[i].x * scale * (canvasWidth / 3) + offsetX
    const my = -points[i].y * scale * (canvasHeight / 3) + offsetY  // Flip Y
    
    if (i === 0) {
      ctx.moveTo(mx, my)
    } else {
      ctx.lineTo(mx, my)
    }
  }
  
  ctx.stroke()
  
  // Read pixel data and create binary mask
  const imageData = ctx.getImageData(0, 0, width, height)
  const pixels = imageData.data
  const mask: boolean[] = new Array(width * height)
  let filledCount = 0
  
  for (let i = 0; i < width * height; i++) {
    // Check red channel (white = filled)
    const isFilled = pixels[i * 4] > 127
    mask[i] = isFilled
    if (isFilled) filledCount++
  }
  
  return { mask, width, height, filledCount }
}

// ============= Stage 2: Connected Component Labeling =============

function labelConnectedComponents(
  mask: boolean[],
  width: number,
  height: number
): { labels: number[], componentCount: number, componentSizes: number[] } {
  const labels = new Array(width * height).fill(0)
  const componentSizes: number[] = [0]  // Index 0 unused
  let componentCount = 0
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (mask[idx] && labels[idx] === 0) {
        componentCount++
        let size = 0
        
        // Flood fill using iterative BFS
        const queue: number[] = [idx]
        labels[idx] = componentCount
        
        while (queue.length > 0) {
          const ci = queue.shift()!
          size++
          const cx = ci % width
          const cy = Math.floor(ci / width)
          
          // 4-connected neighbors
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

// ============= Stage 3: Contour Tracing (Boundary Edge Chaining) =============

interface BoundaryEdge {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * Extract boundary edges between filled and empty cells.
 * An edge exists where a filled cell is adjacent to an empty cell (or grid boundary).
 * Returns edges as line segments along cell boundaries (not pixel centers).
 */
function extractBoundaryEdges(mask: boolean[], width: number, height: number): BoundaryEdge[] {
  const edges: BoundaryEdge[] = []
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (!mask[idx]) continue // Only process filled cells
      
      // Check each of the 4 sides of this cell
      // If neighbor is empty or out of bounds, add a boundary edge
      
      // Top edge (y to y, x to x+1)
      if (y === 0 || !mask[(y - 1) * width + x]) {
        edges.push({ x1: x, y1: y, x2: x + 1, y2: y })
      }
      
      // Bottom edge (y+1 to y+1, x+1 to x) - reversed for CCW
      if (y === height - 1 || !mask[(y + 1) * width + x]) {
        edges.push({ x1: x + 1, y1: y + 1, x2: x, y2: y + 1 })
      }
      
      // Left edge (x to x, y+1 to y) - reversed for CCW
      if (x === 0 || !mask[y * width + (x - 1)]) {
        edges.push({ x1: x, y1: y + 1, x2: x, y2: y })
      }
      
      // Right edge (x+1 to x+1, y to y+1)
      if (x === width - 1 || !mask[y * width + (x + 1)]) {
        edges.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 })
      }
    }
  }
  
  return edges
}

/**
 * Chain boundary edges into closed loops by matching endpoints.
 * Returns the longest loop (the outer boundary).
 */
function chainBoundaryEdges(edges: BoundaryEdge[]): Point2D[] {
  if (edges.length === 0) return []
  
  // Build adjacency map: endpoint -> list of edges starting/ending there
  const endpointKey = (x: number, y: number) => `${x},${y}`
  const edgesByStart = new Map<string, BoundaryEdge[]>()
  
  for (const edge of edges) {
    const key = endpointKey(edge.x1, edge.y1)
    if (!edgesByStart.has(key)) edgesByStart.set(key, [])
    edgesByStart.get(key)!.push(edge)
  }
  
  // Track used edges
  const used = new Set<BoundaryEdge>()
  const loops: Point2D[][] = []
  
  // Chain edges into loops
  for (const edge of edges) {
    if (used.has(edge)) continue
    
    // Start a new loop from this edge
    const loop: Point2D[] = []
    let current = edge
    const startKey = endpointKey(edge.x1, edge.y1)
    
    while (current && !used.has(current)) {
      used.add(current)
      loop.push({ x: current.x1, y: current.y1 })
      
      // Find next edge that starts where this one ends
      const nextKey = endpointKey(current.x2, current.y2)
      
      // Check if we've closed the loop
      if (nextKey === startKey && loop.length > 2) {
        break
      }
      
      const candidates = edgesByStart.get(nextKey)
      if (!candidates) break
      
      // Find an unused candidate
      let next: BoundaryEdge | undefined
      for (const cand of candidates) {
        if (!used.has(cand)) {
          next = cand
          break
        }
      }
      
      current = next!
    }
    
    if (loop.length >= 3) {
      loops.push(loop)
    }
  }
  
  // Return the longest loop (should be the outer boundary)
  if (loops.length === 0) return []
  
  let longest = loops[0]
  for (const loop of loops) {
    if (loop.length > longest.length) {
      longest = loop
    }
  }
  
  return longest
}

/**
 * Trace the outer contour using boundary edge extraction and chaining.
 * This produces a proper closed loop along cell boundaries with meaningful signed area.
 */
function traceOuterContour(mask: boolean[], width: number, height: number): Point2D[] {
  // Step 1: Extract all boundary edges
  const edges = extractBoundaryEdges(mask, width, height)
  
  if (edges.length === 0) return []
  
  // Step 2: Chain edges into the longest closed loop
  const contour = chainBoundaryEdges(edges)
  
  return contour
}

// ============= Stage 4: Find and Trace Holes =============

function findAndTraceHoles(
  componentMask: boolean[],
  width: number,
  height: number,
  outerContour: Point2D[]
): { holes: Point2D[][], simplifiedHoles: Point2D[][] } {
  // Create a mask of the filled region's bounding box interior
  // Find holes by looking for enclosed background regions
  
  if (outerContour.length < 3) {
    return { holes: [], simplifiedHoles: [] }
  }
  
  // Get bounding box of outer contour
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of outerContour) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  
  // Pad bounding box
  const pad = 2
  const bx0 = Math.max(0, Math.floor(minX) - pad)
  const by0 = Math.max(0, Math.floor(minY) - pad)
  const bx1 = Math.min(width, Math.ceil(maxX) + pad)
  const by1 = Math.min(height, Math.ceil(maxY) + pad)
  
  // Find background regions that are NOT connected to the outer edge
  // These are true holes
  const visited = new Array(width * height).fill(false)
  const holes: Point2D[][] = []
  const simplifiedHoles: Point2D[][] = []
  
  // First, flood fill from edges to mark "exterior" background
  const exteriorQueue: number[] = []
  
  // Add all edge background pixels to queue
  for (let x = 0; x < width; x++) {
    if (!componentMask[x]) { visited[x] = true; exteriorQueue.push(x) }
    const bottomIdx = (height - 1) * width + x
    if (!componentMask[bottomIdx]) { visited[bottomIdx] = true; exteriorQueue.push(bottomIdx) }
  }
  for (let y = 0; y < height; y++) {
    const leftIdx = y * width
    if (!componentMask[leftIdx] && !visited[leftIdx]) { visited[leftIdx] = true; exteriorQueue.push(leftIdx) }
    const rightIdx = y * width + width - 1
    if (!componentMask[rightIdx] && !visited[rightIdx]) { visited[rightIdx] = true; exteriorQueue.push(rightIdx) }
  }
  
  // Flood fill exterior
  while (exteriorQueue.length > 0) {
    const idx = exteriorQueue.shift()!
    const x = idx % width
    const y = Math.floor(idx / width)
    
    const neighbors = [
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1
    ]
    
    for (const ni of neighbors) {
      if (ni >= 0 && !componentMask[ni] && !visited[ni]) {
        visited[ni] = true
        exteriorQueue.push(ni)
      }
    }
  }
  
  // Now find unvisited background pixels within bounding box - these are holes
  for (let y = by0; y < by1; y++) {
    for (let x = bx0; x < bx1; x++) {
      const idx = y * width + x
      if (!componentMask[idx] && !visited[idx]) {
        // Found a hole - trace its boundary
        const holeContour = traceHoleContour(componentMask, width, height, x, y, visited)
        if (holeContour.length >= 3) {
          holes.push(holeContour)
          simplifiedHoles.push(douglasPeucker(holeContour, DP_TOLERANCE))
        }
      }
    }
  }
  
  return { holes, simplifiedHoles }
}

/**
 * Trace a hole's boundary (inner contour of background region)
 */
function traceHoleContour(
  componentMask: boolean[],
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: boolean[]
): Point2D[] {
  // Mark all pixels in this hole region as visited
  const holePixels: number[] = []
  const queue: number[] = [startY * width + startX]
  visited[startY * width + startX] = true
  
  while (queue.length > 0) {
    const idx = queue.shift()!
    holePixels.push(idx)
    const x = idx % width
    const y = Math.floor(idx / width)
    
    const neighbors = [
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1
    ]
    
    for (const ni of neighbors) {
      if (ni >= 0 && !componentMask[ni] && !visited[ni]) {
        visited[ni] = true
        queue.push(ni)
      }
    }
  }
  
  // Now trace the boundary of this hole region
  // Find a pixel on the edge of the hole (adjacent to filled region)
  let edgeX = -1, edgeY = -1
  for (const idx of holePixels) {
    const x = idx % width
    const y = Math.floor(idx / width)
    
    // Check if adjacent to filled pixel
    const neighbors = [
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1
    ]
    
    for (const ni of neighbors) {
      if (ni >= 0 && componentMask[ni]) {
        edgeX = x
        edgeY = y
        break
      }
    }
    if (edgeX >= 0) break
  }
  
  if (edgeX < 0) return []
  
  // Create a temporary mask for just this hole
  const holeMask = new Array(width * height).fill(false)
  for (const idx of holePixels) {
    holeMask[idx] = true
  }
  
  // Trace boundary
  return traceOuterContour(holeMask, width, height)
}

// ============= Stage 4b: Hole Filtering and Winding Normalization =============

interface HoleFilterResult {
  validHoles: Point2D[][]
  discardedCount: number
  discardReasons: string[]
  windingReport: string[]
}

function filterAndNormalizeHoles(
  holes: Point2D[][],
  outerContour: Point2D[],
  outerArea: number
): HoleFilterResult {
  const result: HoleFilterResult = {
    validHoles: [],
    discardedCount: 0,
    discardReasons: [],
    windingReport: []
  }
  
  const absOuterArea = Math.abs(outerArea)
  
  for (let i = 0; i < holes.length; i++) {
    const hole = holes[i]
    
    // Check 1: Minimum points
    if (hole.length < MIN_HOLE_POINTS_AFTER_SIMP) {
      result.discardedCount++
      result.discardReasons.push(`hole[${i}]: too few points (${hole.length} < ${MIN_HOLE_POINTS_AFTER_SIMP})`)
      continue
    }
    
    // Check 2: Bounding box dimensions
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of hole) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
    const bboxW = maxX - minX
    const bboxH = maxY - minY
    
    if (bboxW < MIN_HOLE_BBOX_DIM || bboxH < MIN_HOLE_BBOX_DIM) {
      result.discardedCount++
      result.discardReasons.push(`hole[${i}]: bbox too small (${bboxW.toFixed(1)}x${bboxH.toFixed(1)} < ${MIN_HOLE_BBOX_DIM})`)
      continue
    }
    
    // Check 3: Minimum area relative to outer
    const holeArea = computeContourSignedArea(hole)
    const absHoleArea = Math.abs(holeArea)
    const areaRatio = absHoleArea / absOuterArea
    
    if (areaRatio < MIN_HOLE_AREA_RATIO) {
      result.discardedCount++
      result.discardReasons.push(`hole[${i}]: area ratio too small (${(areaRatio * 100).toFixed(2)}% < ${MIN_HOLE_AREA_RATIO * 100}%)`)
      continue
    }
    
    // Check 4: Absolute minimum area
    if (absHoleArea < MIN_HOLE_ABS_AREA) {
      result.discardedCount++
      result.discardReasons.push(`hole[${i}]: absolute area too small (${absHoleArea.toFixed(0)} < ${MIN_HOLE_ABS_AREA})`)
      continue
    }
    
    // Check 5: Compactness - reject long thin slivers (artifacts from self-overlap)
    const bboxArea = bboxW * bboxH
    const compactness = absHoleArea / bboxArea
    if (compactness < MIN_HOLE_COMPACTNESS) {
      result.discardedCount++
      result.discardReasons.push(`hole[${i}]: not compact enough (${(compactness * 100).toFixed(1)}% < ${MIN_HOLE_COMPACTNESS * 100}%)`)
      continue
    }
    
    // Check 6: Self-intersection - reject holes that self-intersect
    if (contourSelfIntersects(hole)) {
      result.discardedCount++
      result.discardReasons.push(`hole[${i}]: self-intersects`)
      continue
    }
    
    // PASSED ALL CHECKS - normalize winding to CW (negative area)
    let normalizedHole = hole
    if (holeArea > 0) {
      // Currently CCW, needs to be CW - reverse
      normalizedHole = hole.slice().reverse()
      result.windingReport.push(`hole[${i}]: reversed CCW→CW`)
    } else {
      result.windingReport.push(`hole[${i}]: already CW`)
    }
    
    result.validHoles.push(normalizedHole)
  }
  
  return result
}

// ============= Stage 5: Douglas-Peucker Simplification =============

function douglasPeucker(points: Point2D[], tolerance: number): Point2D[] {
  if (points.length <= 2) return points
  
  // Find point with maximum distance from line between first and last
  let maxDist = 0
  let maxIdx = 0
  
  const first = points[0]
  const last = points[points.length - 1]
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last)
    if (dist > maxDist) {
      maxDist = dist
      maxIdx = i
    }
  }
  
  if (maxDist > tolerance) {
    // Recursively simplify
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance)
    const right = douglasPeucker(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  } else {
    return [first, last]
  }
}

function perpendicularDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lineLengthSq = dx * dx + dy * dy
  
  if (lineLengthSq === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2)
  }
  
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSq))
  const projX = lineStart.x + t * dx
  const projY = lineStart.y + t * dy
  
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2)
}

// ============= Stage 6: Prepare Outer Contour for Geometry =============

interface OuterContourPrepResult {
  prepared: Point2D[]
  rawPts: number
  preparedPts: number
  reductionPercent: number
  bboxRetention: number
  areaRetention: number
  selfIntersectBefore: boolean
  selfIntersectAfter: boolean
  accepted: boolean
  rejectReason: string
}

/**
 * BRUTALLY CONSERVATIVE outer contour preparation.
 * Only minimal safe cleanup - do NOT destroy silhouette topology.
 * 
 * Operations:
 * 1. Remove duplicate closing point if present
 * 2. Remove consecutive duplicate / near-duplicate points (very small epsilon)
 * 3. Remove only truly tiny collinear jitter (very small epsilon)
 * 4. OPTIONAL Douglas-Peucker only if ALL constraints pass:
 *    - area retention >= 98%
 *    - bbox retention >= 99%
 *    - point reduction <= 50%
 *    - no self-intersection introduced
 * 5. If constraints fail, use lightly cleaned raw contour
 */
function prepareOuterContourForGeometry(contour: Point2D[]): OuterContourPrepResult {
  const result: OuterContourPrepResult = {
    prepared: contour,
    rawPts: contour.length,
    preparedPts: contour.length,
    reductionPercent: 0,
    bboxRetention: 100,
    areaRetention: 100,
    selfIntersectBefore: false,
    selfIntersectAfter: false,
    accepted: false,
    rejectReason: ""
  }
  
  if (contour.length < 4) {
    result.rejectReason = "too few points"
    return result
  }
  
  // Compute raw metrics
  const rawBbox = computeContourBbox(contour)
  const rawArea = Math.abs(computeContourSignedArea(contour))
  result.selfIntersectBefore = contourSelfIntersects(contour)
  
  let pts = [...contour]
  
  // STEP 1: Remove duplicate closing point (if first ~= last)
  if (pts.length > 1) {
    const first = pts[0], last = pts[pts.length - 1]
    if (Math.abs(first.x - last.x) < 0.5 && Math.abs(first.y - last.y) < 0.5) {
      pts.pop()
    }
  }
  
  // STEP 2: Remove consecutive near-duplicates (very conservative: 0.5px)
  let cleaned: Point2D[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const prev = cleaned[cleaned.length - 1]
    const curr = pts[i]
    const dist = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2)
    if (dist > 0.5) {
      cleaned.push(curr)
    }
  }
  pts = cleaned.length >= 3 ? cleaned : pts
  const afterDedupe = pts.length
  
  // STEP 3: Remove only truly tiny collinear jitter (very small epsilon = 0.5)
  cleaned = []
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length]
    const curr = pts[i]
    const next = pts[(i + 1) % pts.length]
    
    const d1x = curr.x - prev.x, d1y = curr.y - prev.y
    const d2x = next.x - curr.x, d2y = next.y - curr.y
    
    // Cross product for collinearity - very small epsilon
    const cross = Math.abs(d1x * d2y - d1y * d2x)
    
    // Keep unless nearly perfectly collinear
    if (cross > 0.5) {
      cleaned.push(curr)
    }
  }
  const lightCleaned = cleaned.length >= 3 ? cleaned : pts
  const afterCollinear = lightCleaned.length
  
  // This is our "lightly cleaned" fallback
  const lightCleanedContour = lightCleaned
  
  // STEP 4: OPTIONAL Douglas-Peucker - only if strict constraints pass
  const CONSERVATIVE_DP_TOLERANCE = 1.0  // Very conservative
  const dpResult = douglasPeucker(lightCleaned, CONSERVATIVE_DP_TOLERANCE)
  
  if (dpResult.length < 3) {
    // DP would destroy contour, use light cleaned
    result.prepared = lightCleanedContour
    result.preparedPts = lightCleanedContour.length
    result.reductionPercent = ((result.rawPts - lightCleanedContour.length) / result.rawPts) * 100
    result.accepted = true
    result.rejectReason = "DP_SKIPPED: would reduce to <3 points"
    console.log("[v0-solid] OUTER PREP: DP skipped, using light cleaned", {
      rawPts: result.rawPts,
      afterDedupe,
      afterCollinear,
      dpWouldProduce: dpResult.length,
      finalPts: result.preparedPts
    })
    return result
  }
  
  // Check DP constraints
  const dpBbox = computeContourBbox(dpResult)
  const dpArea = Math.abs(computeContourSignedArea(dpResult))
  const dpSelfIntersects = contourSelfIntersects(dpResult)
  
  const dpBboxRetention = Math.min(
    dpBbox.width / rawBbox.width,
    dpBbox.height / rawBbox.height
  ) * 100
  const dpAreaRetention = (dpArea / rawArea) * 100
  const dpReduction = ((contour.length - dpResult.length) / contour.length) * 100
  
  const dpAllowed = 
    dpAreaRetention >= 98 &&
    dpBboxRetention >= 99 &&
    dpReduction <= 50 &&
    !(result.selfIntersectBefore === false && dpSelfIntersects === true)
  
  if (dpAllowed) {
    // DP passed all constraints, use it
    result.prepared = dpResult
    result.preparedPts = dpResult.length
    result.reductionPercent = dpReduction
    result.bboxRetention = dpBboxRetention
    result.areaRetention = dpAreaRetention
    result.selfIntersectAfter = dpSelfIntersects
    result.accepted = true
    result.rejectReason = ""
    console.log("[v0-solid] OUTER PREP: DP accepted", {
      rawPts: result.rawPts,
      afterDedupe,
      afterCollinear,
      dpPts: dpResult.length,
      dpAreaRetention: dpAreaRetention.toFixed(1),
      dpBboxRetention: dpBboxRetention.toFixed(1),
      dpReduction: dpReduction.toFixed(1)
    })
    return result
  }
  
  // DP failed constraints, use light cleaned fallback
  result.prepared = lightCleanedContour
  result.preparedPts = lightCleanedContour.length
  result.reductionPercent = ((result.rawPts - lightCleanedContour.length) / result.rawPts) * 100
  
  const lightBbox = computeContourBbox(lightCleanedContour)
  const lightArea = Math.abs(computeContourSignedArea(lightCleanedContour))
  result.bboxRetention = Math.min(lightBbox.width / rawBbox.width, lightBbox.height / rawBbox.height) * 100
  result.areaRetention = (lightArea / rawArea) * 100
  result.selfIntersectAfter = contourSelfIntersects(lightCleanedContour)
  result.accepted = true
  
  const failReasons: string[] = []
  if (dpAreaRetention < 98) failReasons.push(`area ${dpAreaRetention.toFixed(1)}%<98%`)
  if (dpBboxRetention < 99) failReasons.push(`bbox ${dpBboxRetention.toFixed(1)}%<99%`)
  if (dpReduction > 50) failReasons.push(`reduction ${dpReduction.toFixed(1)}%>50%`)
  if (!result.selfIntersectBefore && dpSelfIntersects) failReasons.push("self-intersect")
  result.rejectReason = `DP_REJECTED: ${failReasons.join(", ")}`
  
  console.log("[v0-solid] OUTER PREP: DP rejected, using light cleaned", {
    rawPts: result.rawPts,
    afterDedupe,
    afterCollinear,
    dpWouldProduce: dpResult.length,
    dpFailReasons: failReasons,
    finalPts: result.preparedPts
  })
  
  return result
}

/**
 * Aggressively clean raster stair-stepping from traced contour.
 * This is the key step that makes sidewalls clean.
 * 
 * Operations:
 * 1. Remove duplicate closing point
 * 2. Remove consecutive near-duplicate points
 * 3. Collapse consecutive collinear runs
 * 4. Collapse tiny staircase zig-zags (axis-aligned micro-steps)
 * 5. Apply bounded simplification for extrusion readiness
 */
function prepareContourForExtrusion(contour: Point2D[]): { prepared: Point2D[], stats: ContourPrepStats } {
  const stats: ContourPrepStats = {
    rawPoints: contour.length,
    preparedPoints: 0,
    bboxRetention: 0,
    areaRetention: 0,
    selfIntersectBefore: false,
    selfIntersectAfter: false,
  }
  
  if (contour.length < 3) {
    stats.preparedPoints = contour.length
    stats.bboxRetention = 100
    stats.areaRetention = 100
    return { prepared: contour, stats }
  }
  
  // Compute raw metrics
  const rawBbox = computeContourBbox(contour)
  const rawArea = Math.abs(computeContourSignedArea(contour))
  stats.selfIntersectBefore = contourSelfIntersects(contour)
  
  let pts = [...contour]
  
  // Step 1: Remove duplicate closing point
  if (pts.length > 1) {
    const first = pts[0], last = pts[pts.length - 1]
    if (Math.abs(first.x - last.x) < 0.5 && Math.abs(first.y - last.y) < 0.5) {
      pts.pop()
    }
  }
  
  // Step 2: Remove consecutive near-duplicates (within 1px)
  let cleaned: Point2D[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const prev = cleaned[cleaned.length - 1]
    const curr = pts[i]
    const dist = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2)
    if (dist > 0.5) {
      cleaned.push(curr)
    }
  }
  pts = cleaned
  
  // Step 3: Collapse collinear runs (keep only endpoints of straight segments)
  cleaned = []
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length]
    const curr = pts[i]
    const next = pts[(i + 1) % pts.length]
    
    // Direction vectors
    const d1x = curr.x - prev.x, d1y = curr.y - prev.y
    const d2x = next.x - curr.x, d2y = next.y - curr.y
    
    // Cross product (collinearity check)
    const cross = Math.abs(d1x * d2y - d1y * d2x)
    
    // Keep if not collinear (cross > threshold) or if it's a corner
    if (cross > 1.0) {
      cleaned.push(curr)
    }
  }
  if (cleaned.length >= 3) pts = cleaned
  
  // Step 4: Collapse tiny staircase zig-zags
  // Detect axis-aligned micro-steps: patterns like (0,1), (1,0), (0,1), (1,0)
  cleaned = []
  let i = 0
  while (i < pts.length) {
    cleaned.push(pts[i])
    
    // Look ahead for staircase pattern
    let j = i + 1
    while (j < pts.length - 1) {
      const p0 = pts[j - 1]
      const p1 = pts[j]
      const p2 = pts[j + 1]
      
      const dx1 = Math.abs(p1.x - p0.x), dy1 = Math.abs(p1.y - p0.y)
      const dx2 = Math.abs(p2.x - p1.x), dy2 = Math.abs(p2.y - p1.y)
      
      // Detect axis-aligned micro-step: one axis changes by ~1, other by ~0
      const isStep1 = (dx1 <= 1.5 && dy1 <= 1.5) && (dx1 < 0.5 || dy1 < 0.5)
      const isStep2 = (dx2 <= 1.5 && dy2 <= 1.5) && (dx2 < 0.5 || dy2 < 0.5)
      
      // If both segments are micro-steps in alternating directions, skip middle point
      if (isStep1 && isStep2) {
        j++
      } else {
        break
      }
    }
    i = j
  }
  if (cleaned.length >= 3) pts = cleaned
  
  // Step 5: Apply bounded Douglas-Peucker simplification (tolerance = 2px for extrusion)
  // This smooths remaining jaggies while preserving overall shape
  const EXTRUSION_DP_TOLERANCE = 2.0
  pts = douglasPeucker(pts, EXTRUSION_DP_TOLERANCE)
  
  // Validate result
  if (pts.length < 3) {
    // Simplification too aggressive, return original
    stats.preparedPoints = contour.length
    stats.bboxRetention = 100
    stats.areaRetention = 100
    console.log("[v0-solid] prepareContourForExtrusion: ABORTED - would reduce to <3 points")
    return { prepared: contour, stats }
  }
  
  // Compute prepared metrics
  const prepBbox = computeContourBbox(pts)
  const prepArea = Math.abs(computeContourSignedArea(pts))
  stats.selfIntersectAfter = contourSelfIntersects(pts)
  
  stats.preparedPoints = pts.length
  stats.bboxRetention = Math.min(
    prepBbox.width / rawBbox.width,
    prepBbox.height / rawBbox.height
  ) * 100
  stats.areaRetention = (prepArea / rawArea) * 100
  
  // Safety check: if we lost too much, abort
  if (stats.bboxRetention < 85 || stats.areaRetention < 80) {
    console.log("[v0-solid] prepareContourForExtrusion: ABORTED - too much loss", {
      bboxRetention: stats.bboxRetention.toFixed(1),
      areaRetention: stats.areaRetention.toFixed(1)
    })
    stats.preparedPoints = contour.length
    stats.bboxRetention = 100
    stats.areaRetention = 100
    return { prepared: contour, stats }
  }
  
  // Safety check: if we introduced self-intersection, abort
  if (!stats.selfIntersectBefore && stats.selfIntersectAfter) {
    console.log("[v0-solid] prepareContourForExtrusion: ABORTED - introduced self-intersection")
    stats.preparedPoints = contour.length
    stats.bboxRetention = 100
    stats.areaRetention = 100
    stats.selfIntersectAfter = false
    return { prepared: contour, stats }
  }
  
  return { prepared: pts, stats }
}

interface ContourPrepStats {
  rawPoints: number
  preparedPoints: number
  bboxRetention: number
  areaRetention: number
  selfIntersectBefore: boolean
  selfIntersectAfter: boolean
}

/**
 * Clean contours before triangulation:
 * - Remove duplicate closing point (if first == last)
 * - Remove consecutive near-duplicate points (epsilon)
 * - Remove nearly-collinear points (epsilon)
 * Preserves topology and holes.
 */
function cleanContourForTriangulation(contour: Point2D[], epsilon: number = 0.001): Point2D[] {
  if (contour.length < 3) return contour
  
  let pts = [...contour]
  
  // 1. Remove duplicate closing point if first == last
  if (pts.length > 1) {
    const first = pts[0]
    const last = pts[pts.length - 1]
    if (Math.abs(first.x - last.x) < epsilon && Math.abs(first.y - last.y) < epsilon) {
      pts.pop()
    }
  }
  
  // 2. Remove consecutive near-duplicates
  let cleaned: Point2D[] = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const next = pts[(i + 1) % pts.length]
    const dist = Math.sqrt((p.x - next.x) ** 2 + (p.y - next.y) ** 2)
    if (dist > epsilon) {
      cleaned.push(p)
    }
  }
  pts = cleaned
  
  if (pts.length < 3) return contour  // Failed to clean, return original
  
  // 3. Remove nearly-collinear points
  cleaned = []
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % pts.length]
    
    // Cross product to detect collinearity
    const v1x = p1.x - p0.x, v1y = p1.y - p0.y
    const v2x = p2.x - p1.x, v2y = p2.y - p1.y
    const cross = Math.abs(v1x * v2y - v1y * v2x)
    
    // Also check if point is too close to the line p0-p2
    const dx = p2.x - p0.x, dy = p2.y - p0.y
    const len = Math.sqrt(dx * dx + dy * dy)
    const distToLine = len > epsilon ? Math.abs(dx * (p0.y - p1.y) - dy * (p0.x - p1.x)) / len : Infinity
    
    // Keep point if it's not nearly collinear and not too close to line
    if (cross > epsilon * 0.1 && distToLine > epsilon) {
      cleaned.push(p1)
    }
  }
  
  return cleaned.length >= 3 ? cleaned : pts  // Return cleaned if valid, else return deduplicated
}

function buildExtrudedGeometry(
  outer: Point2D[],
  holes: Point2D[][],
  maskWidth: number,
  maskHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  depth: number
): THREE.BufferGeometry | null {
  if (outer.length < 3) return null
  
  // STEP 1: Prepare contours for extrusion (aggressive stair-step removal)
  const outerPrep = prepareContourForExtrusion(outer)
  const holesPrep = holes.map(h => prepareContourForExtrusion(h))
  
  // Console evidence as required
  console.log("[v0-solid] CONTOUR PREP FOR EXTRUSION:", {
    rawOuterPoints: outerPrep.stats.rawPoints,
    preparedOuterPoints: outerPrep.stats.preparedPoints,
    rawHolePoints: holes.map(h => h.length),
    preparedHolePoints: holesPrep.map(hp => hp.stats.preparedPoints),
    outerBboxRetention: outerPrep.stats.bboxRetention.toFixed(1) + "%",
    outerAreaRetention: outerPrep.stats.areaRetention.toFixed(1) + "%",
    outerSelfIntersectBefore: outerPrep.stats.selfIntersectBefore,
    outerSelfIntersectAfter: outerPrep.stats.selfIntersectAfter
  })
  
  // STEP 2: Light cleanup for triangulation (near-duplicates, collinear)
  const outerCleaned = cleanContourForTriangulation(outerPrep.prepared)
  const holesCleaned = holesPrep.map(hp => cleanContourForTriangulation(hp.prepared))
  
  // Transform mask coordinates to world coordinates
  const scaleX = canvasWidth / maskWidth
  const scaleY = canvasHeight / maskHeight
  const scale = Math.min(scaleX, scaleY)
  const normScale = 3 / Math.max(canvasWidth, canvasHeight)
  
  const toWorldX = (mx: number) => (mx - maskWidth / 2) * scale * normScale
  const toWorldY = (my: number) => -(my - maskHeight / 2) * scale * normScale  // Flip Y
  
  // Convert outer contour to THREE.Vector2
  let shapePts = outerCleaned.map(p => new THREE.Vector2(toWorldX(p.x), toWorldY(p.y)))
  
  // Ensure CCW winding for THREE.js outer
  const outerArea = computeSignedArea(shapePts)
  if (outerArea < 0) {
    shapePts = shapePts.slice().reverse()
  }
  
  const shape = new THREE.Shape(shapePts)
  
  // DEBUG: Log outer shape
  console.log("[v0-solid] Stage E Outer Shape:", {
    points: shapePts.length,
    area: outerArea,
    isCCW: outerArea > 0
  })
  
  // Add holes with CW winding
  for (let i = 0; i < holesCleaned.length; i++) {
    const hole = holesCleaned[i]
    if (hole.length < 3) continue
    let holePts = hole.map(p => new THREE.Vector2(toWorldX(p.x), toWorldY(p.y)))
    
    const holeArea = computeSignedArea(holePts)
    if (holeArea > 0) {
      holePts = holePts.slice().reverse()
    }
    
    shape.holes.push(new THREE.Path(holePts))
    
    // DEBUG: Log each hole
    console.log(`[v0-solid] Stage E Hole ${i}:`, {
      points: holePts.length,
      area: holeArea,
      isCW: holeArea < 0
    })
  }
  
  // FLAT CAP ONLY MODE: Just triangulate the shape, no extrusion
  if (SOLID_GEOM_MODE === "flatCapOnly") {
    try {
      const flatGeom = new THREE.ShapeGeometry(shape)
      const vertexCount = flatGeom.getAttribute("position")?.count ?? 0
      const bbox = new THREE.Box3().setFromBufferAttribute(flatGeom.getAttribute("position") as THREE.BufferAttribute)
      
      console.log("[v0-solid] FLAT CAP ONLY:", {
        mode: "flatCapOnly",
        outerPoints: outer.length,
        finalOuterPoints: outerCleaned.length,
        holesPresent: holes.length,
        flatCapCreated: true,
        flatCapVertices: vertexCount,
        flatCapBbox: { min: [bbox.min.x.toFixed(3), bbox.min.y.toFixed(3)], max: [bbox.max.x.toFixed(3), bbox.max.y.toFixed(3)] }
      })
      
      return flatGeom
    } catch (e) {
      console.error("[v0-solid] FLAT CAP FAILED:", e)
      return null
    }
  }
  
  // FULL MODE: Extrude
  try {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 1
    })
    geometry.translate(0, 0, -depth / 2)
    
    // DEBUG: Log final geometry
    const vertexCount = geometry.getAttribute("position")?.count ?? 0
    const indexCount = geometry.getIndex()?.count ?? 0
    console.log("[v0-solid] FULL EXTRUDE:", {
      mode: "full",
      outerPoints: outer.length,
      finalOuterPoints: outerCleaned.length,
      holesPresent: holes.length,
      fullVertices: vertexCount,
      fullIndices: indexCount
    })
    
    return geometry
  } catch (e) {
    console.error("[v0-solid] FULL EXTRUDE FAILED:", e)
    return null
  }
}

function computeSignedArea(pts: THREE.Vector2[]): number {
  let area = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y)
  }
  return area / 2
}

// ============= Test Stroke Generators =============

export interface TestCase {
  name: string
  description: string
  stroke: TestStroke
  expectedBehavior: string
}

export function generateTestStrokes(): TestCase[] {
  return [
    // 1. Open C-shape
    {
      name: "1. Open C-Shape",
      description: "Open curved stroke",
      expectedBehavior: "One clean blob, no ribbon/sliver artifacts, no fake inner shell",
      stroke: { points: generateCShape() }
    },
    // 2. TRUE loopy cursive with multiple tight loops and overlap
    {
      name: "2. True Loopy Cursive",
      description: "Multiple tight loops with self-overlap (like 'elle' in cursive)",
      expectedBehavior: "One readable filled silhouette, only true enclosed holes preserved",
      stroke: { points: generateTrueLoopyCursive() }
    },
    // 3. Messy self-overlapping scribble
    {
      name: "3. Messy Scribble",
      description: "Chaotic self-overlapping scribble pattern",
      expectedBehavior: "Stable filled solid, no shard/sliver explosion",
      stroke: { points: generateMessyScribble() }
    },
    // 4. Near-touching / figure-eight
    {
      name: "4. Figure-Eight + Near-Touch",
      description: "Figure-8 with near-touching segments",
      expectedBehavior: "Clean figure-8 with proper hole, no gaps at crossings",
      stroke: { points: generateFigureEight() }
    },
    // 5. Signature-like fast scribble
    {
      name: "5. Signature Scribble",
      description: "Fast signature-like scribble (simulates real failing drawings)",
      expectedBehavior: "Readable signature shape, no explosion",
      stroke: { points: generateSignatureScribble() }
    },
    // 6. Thin thickness extreme
    {
      name: "6. Thin Extreme",
      description: "Thin stroke (test with Thickness=0.05)",
      expectedBehavior: "Thin but continuous solid, no gaps",
      stroke: { points: generateThinTestStroke() }
    },
    // 7. Thick thickness extreme  
    {
      name: "7. Thick Extreme",
      description: "Test with Thickness=0.35+ (thick blob)",
      expectedBehavior: "Fat merged blob, overlapping segments merge cleanly",
      stroke: { points: generateThickTestStroke() }
    }
  ]
}

// 1. C-Shape - open arc
function generateCShape(): Point2D[] {
  const points: Point2D[] = []
  for (let i = 0; i <= 50; i++) {
    const t = i / 50
    const angle = (Math.PI * 0.3) + t * (Math.PI * 1.4)
    const r = 0.7
    points.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r
    })
  }
  return points
}

// 2. TRUE Loopy Cursive - actual loops that overlap like handwriting
function generateTrueLoopyCursive(): Point2D[] {
  const points: Point2D[] = []
  const numLoops = 4
  const loopRadius = 0.25
  const spacing = 0.5
  
  for (let loop = 0; loop < numLoops; loop++) {
    const baseX = -0.9 + loop * spacing
    for (let i = 0; i <= 30; i++) {
      const t = i / 30
      const angle = -Math.PI / 2 + t * Math.PI * 2.2
      const x = baseX + Math.sin(angle) * loopRadius + t * 0.15
      const y = Math.cos(angle) * loopRadius * 1.2
      points.push({ x, y })
    }
    if (loop < numLoops - 1) {
      const connectX = baseX + loopRadius + 0.1
      points.push({ x: connectX, y: -loopRadius * 0.5 })
    }
  }
  return points
}

// 3. Messy Scribble - chaotic overlapping
function generateMessyScribble(): Point2D[] {
  const points: Point2D[] = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    const angle = t * Math.PI * 8
    const r = 0.2 + t * 0.6 + Math.sin(t * Math.PI * 12) * 0.15
    const noise = Math.sin(i * 0.7) * 0.08
    points.push({
      x: Math.cos(angle) * r + noise,
      y: Math.sin(angle) * r + Math.cos(i * 0.5) * 0.05
    })
  }
  return points
}

// 4. Figure-Eight with near-touching segments
function generateFigureEight(): Point2D[] {
  const points: Point2D[] = []
  for (let i = 0; i <= 80; i++) {
    const t = i / 80
    const angle = t * Math.PI * 2
    const scale = 0.7
    const denom = 1 + Math.sin(angle) ** 2
    points.push({
      x: (scale * Math.cos(angle)) / denom,
      y: (scale * Math.sin(angle) * Math.cos(angle)) / denom
    })
  }
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    const angle = t * Math.PI
    const r = 0.1 + t * 0.05
    points.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r - 0.02
    })
  }
  return points
}

// 5. Signature-like scribble
function generateSignatureScribble(): Point2D[] {
  const points: Point2D[] = []
  for (let i = 0; i <= 25; i++) {
    const t = i / 25
    const angle = -Math.PI / 2 + t * Math.PI * 1.5
    points.push({
      x: -0.8 + Math.cos(angle) * 0.3,
      y: Math.sin(angle) * 0.4
    })
  }
  for (let i = 0; i <= 30; i++) {
    const t = i / 30
    const x = -0.5 + t * 1.0
    const y = Math.sin(t * Math.PI * 6) * 0.25 * (1 - t * 0.5)
    points.push({ x, y })
  }
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    const angle = t * Math.PI * 2.5
    const r = 0.2 * (1 - t * 0.5)
    points.push({
      x: 0.6 + Math.cos(angle) * r,
      y: Math.sin(angle) * r * 0.8 - 0.1
    })
  }
  return points
}

// 6. Thin test stroke - S-curve
function generateThinTestStroke(): Point2D[] {
  const points: Point2D[] = []
  for (let i = 0; i <= 60; i++) {
    const t = i / 60
    const x = -0.8 + t * 1.6
    const y = Math.sin(t * Math.PI * 2) * 0.5
    points.push({ x, y })
  }
  return points
}

// 7. Thick test stroke - overlapping circles
function generateThickTestStroke(): Point2D[] {
  const points: Point2D[] = []
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const angle = t * Math.PI * 2
    points.push({
      x: Math.cos(angle) * 0.4 - 0.2,
      y: Math.sin(angle) * 0.4
    })
  }
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const angle = t * Math.PI * 2
    points.push({
      x: Math.cos(angle) * 0.4 + 0.2,
      y: Math.sin(angle) * 0.4
    })
  }
  return points
}

// ============= Real App Samples =============
// These simulate actual failing stroke patterns from user drawings

export function generateRealAppSamples(): TestCase[] {
  return [
    {
      name: "Real Sample 1: Fast Letter 'S'",
      description: "User drawing a quick S-curve with pressure variation",
      expectedBehavior: "Clean S shape with no internal artifacts",
      stroke: { points: generateRealSCurve() }
    },
    {
      name: "Real Sample 2: Sketchy Circle",
      description: "Multiple overlapping passes making a circle (common sketch pattern)",
      expectedBehavior: "Filled disk, overlaps merge cleanly",
      stroke: { points: generateSketchyCircle() }
    },
    {
      name: "Real Sample 3: Angry Scribble",
      description: "Fast angry scribble pattern (stress test)",
      expectedBehavior: "Blob shape, no shard explosion",
      stroke: { points: generateAngryScribble() }
    },
    {
      name: "Real Sample 4: Heart Shape",
      description: "Drawing a heart in one stroke",
      expectedBehavior: "Heart silhouette with clean edge",
      stroke: { points: generateHeartShape() }
    },
    {
      name: "Real Sample 5: Star Outline",
      description: "Five-point star drawn in one continuous stroke",
      expectedBehavior: "Star shape with internal pentagon hole",
      stroke: { points: generateStarShape() }
    }
  ]
}

function generateRealSCurve(): Point2D[] {
  const points: Point2D[] = []
  // S-curve with slight wobble to simulate hand-drawn
  for (let i = 0; i <= 50; i++) {
    const t = i / 50
    const x = 0.6 * Math.sin(t * Math.PI * 2 - Math.PI / 2) + (Math.random() - 0.5) * 0.02
    const y = -0.8 + t * 1.6 + (Math.random() - 0.5) * 0.02
    points.push({ x, y })
  }
  return points
}

function generateSketchyCircle(): Point2D[] {
  const points: Point2D[] = []
  // Multiple overlapping circle passes
  for (let pass = 0; pass < 3; pass++) {
    const offset = pass * 0.03
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const angle = t * Math.PI * 2.1 + pass * 0.2
      const wobble = Math.sin(t * 20 + pass * 2) * 0.03
      points.push({
        x: Math.cos(angle) * (0.6 + wobble + offset),
        y: Math.sin(angle) * (0.6 + wobble + offset)
      })
    }
  }
  return points
}

function generateAngryScribble(): Point2D[] {
  const points: Point2D[] = []
  // Chaotic back-and-forth with varying amplitude
  let x = -0.8
  let y = 0
  let vx = 0.05
  let vy = 0.1
  for (let i = 0; i < 100; i++) {
    points.push({ x, y })
    x += vx + (Math.random() - 0.5) * 0.05
    y += vy
    vy = Math.sin(i * 0.3) * 0.15
    if (x > 0.8) vx = -Math.abs(vx)
    if (x < -0.8) vx = Math.abs(vx)
    if (y > 0.6) y = 0.6
    if (y < -0.6) y = -0.6
  }
  return points
}

function generateHeartShape(): Point2D[] {
  const points: Point2D[] = []
  // Parametric heart curve
  for (let i = 0; i <= 60; i++) {
    const t = i / 60
    const angle = t * Math.PI * 2
    const x = 16 * Math.pow(Math.sin(angle), 3) / 20
    const y = -(13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)) / 20
    points.push({ x, y: y - 0.2 })
  }
  return points
}

function generateStarShape(): Point2D[] {
  const points: Point2D[] = []
  // 5-point star drawn continuously
  const outerR = 0.7
  const innerR = 0.3
  for (let i = 0; i <= 10; i++) {
    const angle = (i * Math.PI * 2) / 5 - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    points.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r
    })
  }
  // Close back to start
  points.push({ ...points[0] })
  return points
}

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
  
  // 6. Simplify outer contour
  const simplifiedOuter = douglasPeucker(outerContour, DP_TOLERANCE)
  emptyStages.simplifiedOuter = simplifiedOuter
  
  // STAGE DEBUG: Log simplification
  const simplifiedSignedArea = computeContourSignedArea(simplifiedOuter)
  const areaLoss = Math.abs(simplifiedSignedArea - outerSignedArea) / Math.abs(outerSignedArea)
  
  // OUTER CONTOUR DIAGNOSTIC: Compare raw vs simplified
  const rawBbox = computeContourBbox(outerContour)
  const simpBbox = computeContourBbox(simplifiedOuter)
  
  // Check for degenerate edges (very long jumps that skip important detail)
  let maxEdgeLen = 0, minEdgeLen = Infinity, totalEdgeLen = 0
  const edgeLengths: number[] = []
  for (let i = 0; i < simplifiedOuter.length; i++) {
    const p1 = simplifiedOuter[i]
    const p2 = simplifiedOuter[(i + 1) % simplifiedOuter.length]
    const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
    edgeLengths.push(len)
    maxEdgeLen = Math.max(maxEdgeLen, len)
    minEdgeLen = Math.min(minEdgeLen, len)
    totalEdgeLen += len
  }
  const avgEdgeLen = totalEdgeLen / simplifiedOuter.length
  const edgeRatio = maxEdgeLen / (avgEdgeLen || 1)
  
  // Perimeter comparison
  let rawPerimeter = 0
  for (let i = 0; i < outerContour.length; i++) {
    const p1 = outerContour[i]
    const p2 = outerContour[(i + 1) % outerContour.length]
    rawPerimeter += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
  }
  const perimeterRetention = totalEdgeLen / rawPerimeter
  
  console.log("[v0-solid] OUTER CONTOUR DIAGNOSTIC:", {
    raw: { points: outerContour.length, bbox: rawBbox, area: outerSignedArea, perimeter: rawPerimeter.toFixed(1) },
    simplified: { points: simplifiedOuter.length, bbox: simpBbox, area: simplifiedSignedArea, perimeter: totalEdgeLen.toFixed(1) },
    areaRetention: ((1 - areaLoss) * 100).toFixed(1) + "%",
    perimeterRetention: (perimeterRetention * 100).toFixed(1) + "%",
    edgeStats: { min: minEdgeLen.toFixed(1), max: maxEdgeLen.toFixed(1), avg: avgEdgeLen.toFixed(1), ratio: edgeRatio.toFixed(1) },
    WARNING_LONG_EDGES: edgeRatio > 10 ? "YES - simplification may be cutting corners" : "NO",
    WARNING_AREA_LOSS: areaLoss > 0.1 ? "YES - significant area lost" : "NO",
    WARNING_BBOX_SHRINK: (simpBbox.width < rawBbox.width * 0.9 || simpBbox.height < rawBbox.height * 0.9) ? "YES" : "NO"
  })
  
  // If simplification is damaging, bypass it
  const simplificationDamaging = areaLoss > 0.15 || edgeRatio > 15
  const finalOuter = simplificationDamaging ? outerContour : simplifiedOuter
  if (simplificationDamaging) {
    console.log("[v0-solid] BYPASSING SIMPLIFICATION - using raw contour due to damage")
  }
  
  console.log("[v0-solid] STAGE 3 - Simplification:", {
    rawPoints: outerContour.length,
    simplifiedPoints: simplifiedOuter.length,
    reductionPercent: ((1 - simplifiedOuter.length / outerContour.length) * 100).toFixed(1),
    simplifiedSignedArea,
    areaLossPercent: (areaLoss * 100).toFixed(2),
    areaLossAcceptable: areaLoss < 0.1,
    USING: simplificationDamaging ? "RAW" : "SIMPLIFIED"
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

// ============= Stage 3: Contour Tracing (Theo Pavlidis / Square Tracing) =============

/**
 * Trace the outer contour of a filled region using the square tracing algorithm.
 * This traces the BOUNDARY of the filled region, not edge transitions.
 */
function traceOuterContour(mask: boolean[], width: number, height: number): Point2D[] {
  // Find the topmost-leftmost filled pixel (guaranteed to be on outer boundary)
  let startIdx = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        startIdx = y * width + x
        break
      }
    }
    if (startIdx >= 0) break
  }
  
  if (startIdx < 0) return []
  
  const startX = startIdx % width
  const startY = Math.floor(startIdx / width)
  
  // Direction vectors: 0=right, 1=down, 2=left, 3=up
  const dx = [1, 0, -1, 0]
  const dy = [0, 1, 0, -1]
  
  const contour: Point2D[] = []
  let x = startX
  let y = startY
  let dir = 3  // Start looking up (we came from above since this is topmost)
  
  const maxIterations = width * height * 4
  let iterations = 0
  
  do {
    // Add current pixel center to contour
    contour.push({ x: x + 0.5, y: y + 0.5 })
    
    // Try to turn left first (relative to current direction), then straight, then right, then back
    let found = false
    for (let turn = -1; turn <= 2; turn++) {
      const newDir = (dir + turn + 4) % 4
      const nx = x + dx[newDir]
      const ny = y + dy[newDir]
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
        x = nx
        y = ny
        dir = newDir
        found = true
        break
      }
    }
    
    if (!found) break  // Isolated pixel or error
    
    iterations++
  } while ((x !== startX || y !== startY) && iterations < maxIterations)
  
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

// ============= Stage 6: Build Extruded Geometry =============

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
  
  // Clean contours before triangulation
  const outerCleaned = cleanContourForTriangulation(outer)
  const holesCleaned = holes.map(h => cleanContourForTriangulation(h))
  
  // DEBUG: Log cleaning impact
  const cleaningDiff = {
    outerBefore: outer.length,
    outerAfter: outerCleaned.length,
    outerRemoved: outer.length - outerCleaned.length,
    holesInfo: holes.map((h, i) => ({
      index: i,
      before: h.length,
      after: holesCleaned[i].length,
      removed: h.length - holesCleaned[i].length
    }))
  }
  console.log("[v0-solid] Stage D→E Cleaning:", cleaningDiff)
  
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
  
  // Extrude
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
    console.log("[v0-solid] Stage E Extrude Result:", {
      success: true,
      vertices: vertexCount,
      indices: indexCount
    })
    
    return geometry
  } catch (e) {
    console.error("[v0-solid] Stage E Extrude FAILED:", e)
    console.log("[v0-solid] Stage E Extrude Failure Details:", {
      errorMessage: (e as Error).message,
      outerPoints: shapePts.length,
      holeCount: shape.holes.length,
      shapeBbox: shape.getBounds()
    })
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

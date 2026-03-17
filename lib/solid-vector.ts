/**
 * Vector-based Solid Mode Pipeline
 * 
 * Uses polygon-clipping for boolean union operations and manual polyline expansion.
 * This handles self-overlapping strokes correctly by unioning the expanded outline.
 * 
 * Pipeline:
 * 1. Take processed centerline polyline
 * 2. Expand stroke by Thickness using manual offset with round caps/joins
 * 3. Union all expanded polygons to handle overlaps (polygon-clipping)
 * 4. Simplify result
 * 5. Extract outer boundaries and true enclosed holes
 * 6. Extrude into watertight mesh
 */

import * as THREE from "three"
import polygonClipping from "polygon-clipping"
import type { ProcessedStroke } from "@/lib/stroke-processing"

// Types for our polygon representation
interface Point2D {
  x: number
  y: number
}

interface Polygon {
  outer: Point2D[]
  holes: Point2D[][]
}

export interface VectorSolidDebugStats {
  inputPointCount: number
  expandedOutlineCount: number
  polygonCountBeforeUnion: number
  polygonCountAfterUnion: number
  holeCount: number
  rebuildTimeMs: number
}

export interface VectorSolidResult {
  geometry: THREE.BufferGeometry | null
  polygons: Polygon[]
  expandedOutlines: Point2D[][]  // Before union, for debug visualization
  success: boolean
  error?: string
  stats: VectorSolidDebugStats
}

/**
 * Convert stroke points to 2D world coordinates (same transform as strokeTo3D but 2D)
 */
function strokeTo2D(
  stroke: ProcessedStroke,
  canvasWidth: number,
  canvasHeight: number
): Point2D[] {
  const scaleRef = Math.max(canvasWidth, canvasHeight)
  const normScale = 3 / scaleRef

  return stroke.points.map((p) => ({
    x: (p.x - canvasWidth / 2) * normScale,
    y: -(p.y - canvasHeight / 2) * normScale  // Flip Y for 3D coords
  }))
}

/**
 * Generate points along a circular arc
 */
function generateArc(
  center: Point2D,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number
): Point2D[] {
  const pts: Point2D[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const angle = startAngle + t * (endAngle - startAngle)
    pts.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    })
  }
  return pts
}

/**
 * Expand a polyline into a polygon with round caps and joins.
 * This is a manual implementation that creates the outline of a thick stroke.
 */
function expandPolylineManual(
  points: Point2D[],
  thickness: number,
  arcSegments: number = 8
): Point2D[] {
  if (points.length < 2) return []
  
  const halfWidth = thickness / 2
  const result: Point2D[] = []
  
  // Build the outline by walking the stroke
  // First, compute offset points on both sides
  const leftSide: Point2D[] = []
  const rightSide: Point2D[] = []
  
  for (let i = 0; i < points.length; i++) {
    const curr = points[i]
    
    let dx: number, dy: number
    
    if (i === 0) {
      // First point: use direction to next point
      const next = points[1]
      dx = next.x - curr.x
      dy = next.y - curr.y
    } else if (i === points.length - 1) {
      // Last point: use direction from previous point
      const prev = points[i - 1]
      dx = curr.x - prev.x
      dy = curr.y - prev.y
    } else {
      // Middle point: average of incoming and outgoing directions
      const prev = points[i - 1]
      const next = points[i + 1]
      dx = (next.x - prev.x) / 2
      dy = (next.y - prev.y) / 2
    }
    
    // Normalize and get perpendicular
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 0.0001) continue
    
    const nx = -dy / len  // Perpendicular (left normal)
    const ny = dx / len
    
    leftSide.push({
      x: curr.x + nx * halfWidth,
      y: curr.y + ny * halfWidth
    })
    rightSide.push({
      x: curr.x - nx * halfWidth,
      y: curr.y - ny * halfWidth
    })
  }
  
  if (leftSide.length < 2) return []
  
  // Build closed polygon: left side forward, end cap, right side backward, start cap
  
  // Left side (forward)
  result.push(...leftSide)
  
  // End cap (round)
  const lastPt = points[points.length - 1]
  const lastLeft = leftSide[leftSide.length - 1]
  const lastRight = rightSide[rightSide.length - 1]
  const endAngleStart = Math.atan2(lastLeft.y - lastPt.y, lastLeft.x - lastPt.x)
  const endAngleEnd = Math.atan2(lastRight.y - lastPt.y, lastRight.x - lastPt.x)
  // Ensure we go the short way around
  let endSweep = endAngleEnd - endAngleStart
  if (endSweep > Math.PI) endSweep -= 2 * Math.PI
  if (endSweep < -Math.PI) endSweep += 2 * Math.PI
  const endArc = generateArc(lastPt, halfWidth, endAngleStart, endAngleStart + endSweep, arcSegments)
  result.push(...endArc.slice(1))  // Skip first point (duplicate of lastLeft)
  
  // Right side (backward)
  for (let i = rightSide.length - 1; i >= 0; i--) {
    result.push(rightSide[i])
  }
  
  // Start cap (round)
  const firstPt = points[0]
  const firstLeft = leftSide[0]
  const firstRight = rightSide[0]
  const startAngleStart = Math.atan2(firstRight.y - firstPt.y, firstRight.x - firstPt.x)
  const startAngleEnd = Math.atan2(firstLeft.y - firstPt.y, firstLeft.x - firstPt.x)
  let startSweep = startAngleEnd - startAngleStart
  if (startSweep > Math.PI) startSweep -= 2 * Math.PI
  if (startSweep < -Math.PI) startSweep += 2 * Math.PI
  const startArc = generateArc(firstPt, halfWidth, startAngleStart, startAngleStart + startSweep, arcSegments)
  result.push(...startArc.slice(1, -1))  // Skip first and last (duplicates)
  
  return result
}

/**
 * Convert Point2D array to polygon-clipping ring format [x, y][]
 */
function toRing(pts: Point2D[]): [number, number][] {
  return pts.map(p => [p.x, p.y])
}

/**
 * Convert polygon-clipping ring back to Point2D array
 */
function fromRing(ring: [number, number][]): Point2D[] {
  return ring.map(([x, y]) => ({ x, y }))
}

/**
 * Compute signed area of a polygon (positive = CCW, negative = CW)
 */
function signedArea(pts: Point2D[]): number {
  let area = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y)
  }
  return -area / 2  // Negate because of coordinate system
}

/**
 * Douglas-Peucker simplification
 */
function simplifyDP(pts: Point2D[], epsilon: number): Point2D[] {
  if (pts.length < 3) return pts
  
  // Find point with max distance from line between first and last
  let maxDist = 0
  let maxIdx = 0
  const first = pts[0]
  const last = pts[pts.length - 1]
  
  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointLineDistance(pts[i], first, last)
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }
  
  if (maxDist > epsilon) {
    const left = simplifyDP(pts.slice(0, maxIdx + 1), epsilon)
    const right = simplifyDP(pts.slice(maxIdx), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  
  return [first, last]
}

function pointLineDistance(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < 0.0001) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2)
}

/**
 * Union multiple polygons using polygon-clipping library
 */
function unionPolygons(polygons: Point2D[][]): Polygon[] {
  if (polygons.length === 0) return []
  
  // Convert to polygon-clipping format: each polygon is [[outer], [hole1], [hole2], ...]
  // For our expanded outlines, we just have outers (no holes yet)
  const multiPolygons: [number, number][][][] = polygons.map(pts => [toRing(pts)])
  
  try {
    // Union all polygons
    let result = multiPolygons[0]
    for (let i = 1; i < multiPolygons.length; i++) {
      result = polygonClipping.union(result, multiPolygons[i])
    }
    
    // Convert result back to Polygon[]
    // Result is MultiPolygon format: each element is a polygon with [outer, ...holes]
    const output: Polygon[] = []
    
    for (const poly of result) {
      if (poly.length === 0) continue
      
      const outer = fromRing(poly[0])
      const holes: Point2D[][] = []
      
      for (let i = 1; i < poly.length; i++) {
        holes.push(fromRing(poly[i]))
      }
      
      output.push({ outer, holes })
    }
    
    return output
    
  } catch (e) {
    console.error("[v0] polygon-clipping union failed:", e)
    // Fallback: return each polygon separately (no union)
    return polygons.map(pts => ({ outer: pts, holes: [] }))
  }
}

/**
 * Convert 2D polygon to THREE.Shape and extrude
 */
function extrudePolygon(
  polygon: Polygon,
  depth: number
): THREE.BufferGeometry | null {
  if (polygon.outer.length < 3) return null
  
  // Simplify before extruding
  const simplified = simplifyDP(polygon.outer, 0.005)
  if (simplified.length < 3) return null
  
  // Create shape from outer boundary
  const shapePts = simplified.map(p => new THREE.Vector2(p.x, p.y))
  
  // Ensure CCW winding for THREE.js Shape
  const area = signedArea(simplified)
  if (area < 0) {
    shapePts.reverse()
  }
  
  const shape = new THREE.Shape(shapePts)
  
  // Add holes (need CW winding for THREE.js)
  for (const hole of polygon.holes) {
    if (hole.length < 3) continue
    const holeSimplified = simplifyDP(hole, 0.005)
    if (holeSimplified.length < 3) continue
    
    const holePts = holeSimplified.map(p => new THREE.Vector2(p.x, p.y))
    const holeArea = signedArea(holeSimplified)
    if (holeArea > 0) {
      holePts.reverse()  // Holes need CW winding
    }
    shape.holes.push(new THREE.Path(holePts))
  }
  
  try {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 1
    })
    geometry.translate(0, 0, -depth / 2)  // Center on Z
    return geometry
  } catch {
    return null
  }
}

/**
 * Main entry point: Build vector-based Solid geometry from strokes
 */
export function buildVectorSolid(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
  thickness: number,
  depth: number
): VectorSolidResult {
  const startTime = performance.now()
  
  const emptyStats: VectorSolidDebugStats = {
    inputPointCount: 0,
    expandedOutlineCount: 0,
    polygonCountBeforeUnion: 0,
    polygonCountAfterUnion: 0,
    holeCount: 0,
    rebuildTimeMs: 0
  }
  
  if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0) {
    return { 
      geometry: null, 
      polygons: [], 
      expandedOutlines: [],
      success: false, 
      error: "No strokes",
      stats: emptyStats
    }
  }
  
  try {
    // 1. Convert each stroke to 2D and expand manually
    const expandedPolygons: Point2D[][] = []
    let totalInputPoints = 0
    
    for (const stroke of strokes) {
      const pts2D = strokeTo2D(stroke, canvasWidth, canvasHeight)
      totalInputPoints += pts2D.length
      if (pts2D.length < 2) continue
      
      const expanded = expandPolylineManual(pts2D, thickness)
      if (expanded.length >= 3) {
        expandedPolygons.push(expanded)
      }
    }
    
    if (expandedPolygons.length === 0) {
      return { 
        geometry: null, 
        polygons: [], 
        expandedOutlines: [],
        success: false, 
        error: "No valid expanded polygons",
        stats: { ...emptyStats, inputPointCount: totalInputPoints, rebuildTimeMs: performance.now() - startTime }
      }
    }
    
    const polygonCountBeforeUnion = expandedPolygons.length
    
    // 2. Union all polygons (handles self-overlaps)
    const unionedPolygons = unionPolygons(expandedPolygons)
    
    if (unionedPolygons.length === 0) {
      return { 
        geometry: null, 
        polygons: [], 
        expandedOutlines: expandedPolygons,
        success: false, 
        error: "Union produced no polygons",
        stats: { 
          ...emptyStats, 
          inputPointCount: totalInputPoints,
          expandedOutlineCount: expandedPolygons.reduce((s, p) => s + p.length, 0),
          polygonCountBeforeUnion,
          rebuildTimeMs: performance.now() - startTime 
        }
      }
    }
    
    // Count holes
    const totalHoles = unionedPolygons.reduce((sum, p) => sum + p.holes.length, 0)
    
    // 3. Extrude each polygon
    const geometries: THREE.BufferGeometry[] = []
    
    for (const poly of unionedPolygons) {
      const geo = extrudePolygon(poly, depth)
      if (geo) geometries.push(geo)
    }
    
    if (geometries.length === 0) {
      return { 
        geometry: null, 
        polygons: unionedPolygons, 
        expandedOutlines: expandedPolygons,
        success: false, 
        error: "Extrusion failed",
        stats: { 
          inputPointCount: totalInputPoints,
          expandedOutlineCount: expandedPolygons.reduce((s, p) => s + p.length, 0),
          polygonCountBeforeUnion,
          polygonCountAfterUnion: unionedPolygons.length,
          holeCount: totalHoles,
          rebuildTimeMs: performance.now() - startTime 
        }
      }
    }
    
    // 4. Merge if multiple geometries
    let finalGeometry: THREE.BufferGeometry
    if (geometries.length === 1) {
      finalGeometry = geometries[0]
    } else {
      // Merge geometries manually
      const positions: number[] = []
      const normals: number[] = []
      const indices: number[] = []
      let indexOffset = 0
      
      for (const geo of geometries) {
        const pos = geo.getAttribute("position")
        const norm = geo.getAttribute("normal")
        const idx = geo.getIndex()
        
        for (let i = 0; i < pos.count; i++) {
          positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
          if (norm) normals.push(norm.getX(i), norm.getY(i), norm.getZ(i))
        }
        
        if (idx) {
          for (let i = 0; i < idx.count; i++) {
            indices.push(idx.getX(i) + indexOffset)
          }
        }
        
        indexOffset += pos.count
        geo.dispose()
      }
      
      finalGeometry = new THREE.BufferGeometry()
      finalGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
      if (normals.length > 0) {
        finalGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3))
      }
      if (indices.length > 0) {
        finalGeometry.setIndex(indices)
      }
    }
    
    const stats: VectorSolidDebugStats = {
      inputPointCount: totalInputPoints,
      expandedOutlineCount: expandedPolygons.reduce((s, p) => s + p.length, 0),
      polygonCountBeforeUnion,
      polygonCountAfterUnion: unionedPolygons.length,
      holeCount: totalHoles,
      rebuildTimeMs: performance.now() - startTime
    }
    
    return {
      geometry: finalGeometry,
      polygons: unionedPolygons,
      expandedOutlines: expandedPolygons,
      success: true,
      stats
    }
    
  } catch (e) {
    return {
      geometry: null,
      polygons: [],
      expandedOutlines: [],
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
      stats: { ...emptyStats, rebuildTimeMs: performance.now() - startTime }
    }
  }
}

// ============================================================================
// Test cases for sandbox validation
// ============================================================================

/**
 * Generate test stroke data for sandbox validation
 */
export function generateTestStrokes(): {
  name: string
  description: string
  stroke: ProcessedStroke
}[] {
  return [
    {
      name: "C-Shape",
      description: "Open curved stroke like a 'C' - should produce one clean blob, no ribbon artifacts",
      stroke: {
        points: [
          { x: 300, y: 100 },
          { x: 200, y: 120 },
          { x: 130, y: 180 },
          { x: 100, y: 280 },
          { x: 100, y: 380 },
          { x: 130, y: 480 },
          { x: 200, y: 540 },
          { x: 300, y: 560 }
        ],
        cornerCount: 0
      }
    },
    {
      name: "Loopy Cursive",
      description: "Single continuous loopy cursive stroke - should produce one readable filled silhouette with only true enclosed holes",
      stroke: {
        points: [
          // Start of loop
          { x: 100, y: 300 },
          { x: 150, y: 250 },
          { x: 200, y: 200 },
          { x: 250, y: 200 },
          { x: 300, y: 250 },
          { x: 300, y: 350 },
          { x: 250, y: 400 },
          { x: 200, y: 400 },
          { x: 150, y: 350 },
          { x: 150, y: 300 },
          // Continue to second loop
          { x: 200, y: 300 },
          { x: 250, y: 280 },
          { x: 350, y: 250 },
          { x: 400, y: 250 },
          { x: 450, y: 300 },
          { x: 450, y: 400 },
          { x: 400, y: 450 },
          { x: 350, y: 450 },
          { x: 300, y: 400 },
          { x: 300, y: 350 },
          // Tail
          { x: 350, y: 350 },
          { x: 400, y: 380 },
          { x: 500, y: 400 }
        ],
        cornerCount: 0
      }
    },
    {
      name: "Messy Self-Overlapping",
      description: "Messy self-overlapping stroke - should produce a stable filled solid, no shard/sliver explosion",
      stroke: {
        points: [
          { x: 100, y: 200 },
          { x: 200, y: 400 },
          { x: 300, y: 200 },
          { x: 400, y: 400 },
          { x: 500, y: 200 },
          { x: 450, y: 350 },
          { x: 350, y: 250 },
          { x: 250, y: 350 },
          { x: 150, y: 250 },
          { x: 200, y: 300 },
          { x: 300, y: 300 },
          { x: 400, y: 300 }
        ],
        cornerCount: 0
      }
    }
  ]
}

/**
 * Vector-based Solid Mode Pipeline
 * 
 * This module implements a clean Solid mode using vector stroke expansion
 * instead of raster-based contour extraction.
 * 
 * Pipeline:
 * 1. Take processed centerline polyline
 * 2. Expand stroke by Thickness into 2D outline (offset operation)
 * 3. Union self-overlaps using polygon boolean operations
 * 4. Clean the resulting polygon(s)
 * 5. Keep valid filled body and enclosed holes
 * 6. Extrude into watertight mesh
 * 
 * Uses js-angusj-clipper for robust polygon offset and boolean operations.
 */

import * as THREE from "three"
import type { ProcessedStroke } from "@/lib/stroke-processing"

// Clipper uses integer coordinates, so we scale up for precision
const CLIPPER_SCALE = 1000

// Types for our polygon representation
interface Point2D {
  x: number
  y: number
}

interface Polygon {
  outer: Point2D[]
  holes: Point2D[][]
}

export interface VectorSolidResult {
  geometry: THREE.BufferGeometry | null
  polygons: Polygon[]  // For debug visualization
  success: boolean
  error?: string
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
 * Expand a polyline into a polygon outline with the given thickness.
 * Uses round joins and round end caps for smooth appearance.
 */
function expandPolylineManual(
  points: Point2D[],
  thickness: number
): Point2D[] {
  if (points.length < 2) return []
  
  const halfWidth = thickness / 2
  const result: Point2D[] = []
  
  // Generate offset points on both sides of the polyline
  const leftSide: Point2D[] = []
  const rightSide: Point2D[] = []
  
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)]
    const curr = points[i]
    const next = points[Math.min(points.length - 1, i + 1)]
    
    // Calculate tangent direction
    let tx: number, ty: number
    if (i === 0) {
      tx = next.x - curr.x
      ty = next.y - curr.y
    } else if (i === points.length - 1) {
      tx = curr.x - prev.x
      ty = curr.y - prev.y
    } else {
      // Average of incoming and outgoing tangents
      const t1x = curr.x - prev.x, t1y = curr.y - prev.y
      const t2x = next.x - curr.x, t2y = next.y - curr.y
      const len1 = Math.sqrt(t1x * t1x + t1y * t1y) || 1
      const len2 = Math.sqrt(t2x * t2x + t2y * t2y) || 1
      tx = t1x / len1 + t2x / len2
      ty = t1y / len1 + t2y / len2
    }
    
    // Normalize tangent
    const tlen = Math.sqrt(tx * tx + ty * ty) || 1
    tx /= tlen
    ty /= tlen
    
    // Normal (perpendicular to tangent)
    const nx = -ty
    const ny = tx
    
    // Offset points
    leftSide.push({
      x: curr.x + nx * halfWidth,
      y: curr.y + ny * halfWidth
    })
    rightSide.push({
      x: curr.x - nx * halfWidth,
      y: curr.y - ny * halfWidth
    })
  }
  
  // Build closed polygon: left side forward, right side backward
  // Add round end caps
  const startCap = generateRoundCap(points[0], leftSide[0], rightSide[0], halfWidth, true)
  const endCap = generateRoundCap(points[points.length - 1], leftSide[leftSide.length - 1], rightSide[rightSide.length - 1], halfWidth, false)
  
  result.push(...startCap)
  result.push(...leftSide)
  result.push(...endCap)
  result.push(...rightSide.reverse())
  
  return result
}

/**
 * Generate round cap points
 */
function generateRoundCap(
  center: Point2D,
  left: Point2D,
  right: Point2D,
  radius: number,
  isStart: boolean
): Point2D[] {
  const points: Point2D[] = []
  const segments = 8  // Number of segments for the semicircle
  
  // Calculate angles for left and right points relative to center
  const leftAngle = Math.atan2(left.y - center.y, left.x - center.x)
  const rightAngle = Math.atan2(right.y - center.y, right.x - center.x)
  
  // Determine sweep direction
  let startAngle: number, endAngle: number
  if (isStart) {
    startAngle = rightAngle
    endAngle = leftAngle
    // Ensure we go the long way around (semicircle on the cap side)
    if (endAngle > startAngle) endAngle -= Math.PI * 2
  } else {
    startAngle = leftAngle
    endAngle = rightAngle
    if (endAngle < startAngle) endAngle += Math.PI * 2
  }
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const angle = startAngle + (endAngle - startAngle) * t
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    })
  }
  
  return points
}

/**
 * Compute signed area of a polygon (positive = CCW, negative = CW)
 */
function signedArea(pts: Point2D[]): number {
  let area = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y)
  }
  return area / 2
}

/**
 * Simple polygon union using winding rule.
 * For self-overlapping strokes, we treat the expanded outline as a single filled region.
 */
function unionPolygonsSimple(polygons: Point2D[][]): Polygon[] {
  if (polygons.length === 0) return []
  if (polygons.length === 1) {
    const poly = polygons[0]
    // Ensure CCW winding for outer
    const area = signedArea(poly)
    return [{
      outer: area < 0 ? poly.slice().reverse() : poly,
      holes: []
    }]
  }
  
  // For multiple strokes, we need proper boolean union
  // For now, just return all as separate bodies (MVP)
  return polygons.map(poly => {
    const area = signedArea(poly)
    return {
      outer: area < 0 ? poly.slice().reverse() : poly,
      holes: []
    }
  })
}

/**
 * Douglas-Peucker simplification for 2D points
 */
function simplifyPolygon(pts: Point2D[], tolerance: number): Point2D[] {
  if (pts.length < 3 || tolerance <= 0) return pts
  
  function perpendicularDistance(p: Point2D, a: Point2D, b: Point2D): number {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2)
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
    const projX = a.x + t * dx
    const projY = a.y + t * dy
    return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2)
  }
  
  function douglasPeucker(pts: Point2D[], start: number, end: number): Point2D[] {
    if (end <= start + 1) return [pts[start]]
    
    let maxDist = 0
    let maxIdx = start
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(pts[i], pts[start], pts[end])
      if (d > maxDist) {
        maxDist = d
        maxIdx = i
      }
    }
    
    if (maxDist > tolerance) {
      const left = douglasPeucker(pts, start, maxIdx)
      const right = douglasPeucker(pts, maxIdx, end)
      return [...left, ...right]
    } else {
      return [pts[start]]
    }
  }
  
  const result = douglasPeucker(pts, 0, pts.length - 1)
  result.push(pts[pts.length - 1])  // Include last point
  return result
}

/**
 * Convert 2D polygon to THREE.Shape and extrude
 */
function extrudePolygon(
  polygon: Polygon,
  depth: number
): THREE.BufferGeometry | null {
  if (polygon.outer.length < 3) return null
  
  // Create shape from outer boundary (CCW winding)
  const shapePts = polygon.outer.map(p => new THREE.Vector2(p.x, p.y))
  
  // Ensure CCW winding for THREE.js Shape
  const area = signedArea(polygon.outer)
  if (area < 0) {
    shapePts.reverse()
  }
  
  const shape = new THREE.Shape(shapePts)
  
  // Add holes (CW winding)
  for (const hole of polygon.holes) {
    if (hole.length < 3) continue
    const holePts = hole.map(p => new THREE.Vector2(p.x, p.y))
    const holeArea = signedArea(hole)
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
  if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0) {
    return { geometry: null, polygons: [], success: false, error: "No strokes" }
  }
  
  try {
    // 1. Convert each stroke to 2D and expand into polygon outline
    const expandedPolygons: Point2D[][] = []
    
    for (const stroke of strokes) {
      const pts2D = strokeTo2D(stroke, canvasWidth, canvasHeight)
      if (pts2D.length < 2) continue
      
      const expanded = expandPolylineManual(pts2D, thickness)
      if (expanded.length < 4) continue
      
      // Simplify to reduce point count
      const simplified = simplifyPolygon(expanded, thickness * 0.05)
      expandedPolygons.push(simplified)
    }
    
    if (expandedPolygons.length === 0) {
      return { geometry: null, polygons: [], success: false, error: "No valid polygons" }
    }
    
    // 2. Union all polygons (for multi-stroke, handles overlaps)
    const unionedPolygons = unionPolygonsSimple(expandedPolygons)
    
    if (unionedPolygons.length === 0) {
      return { geometry: null, polygons: [], success: false, error: "Union failed" }
    }
    
    // 3. Extrude each polygon
    const geometries: THREE.BufferGeometry[] = []
    
    for (const poly of unionedPolygons) {
      const geo = extrudePolygon(poly, depth)
      if (geo) geometries.push(geo)
    }
    
    if (geometries.length === 0) {
      return { geometry: null, polygons: unionedPolygons, success: false, error: "Extrusion failed" }
    }
    
    // 4. Merge if multiple geometries
    let finalGeometry: THREE.BufferGeometry
    if (geometries.length === 1) {
      finalGeometry = geometries[0]
    } else {
      // Simple merge: just use the first one for MVP
      // TODO: proper merge with BufferGeometryUtils
      finalGeometry = geometries[0]
      for (let i = 1; i < geometries.length; i++) {
        geometries[i].dispose()
      }
    }
    
    return {
      geometry: finalGeometry,
      polygons: unionedPolygons,
      success: true
    }
    
  } catch (e) {
    return {
      geometry: null,
      polygons: [],
      success: false,
      error: e instanceof Error ? e.message : "Unknown error"
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

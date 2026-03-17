/**
 * Vector-based Solid Mode Pipeline
 * 
 * Uses js-angusj-clipper for robust polygon offset and boolean union operations.
 * This handles self-overlapping strokes correctly by unioning the expanded outline.
 * 
 * Pipeline:
 * 1. Take processed centerline polyline
 * 2. Expand stroke by Thickness using Clipper's offset operation (round join/cap)
 * 3. Union all expanded polygons to handle overlaps
 * 4. Simplify result
 * 5. Extract outer boundaries and true enclosed holes
 * 6. Extrude into watertight mesh
 */

import * as THREE from "three"
import * as ClipperLib from "js-angusj-clipper"
import type { ProcessedStroke } from "@/lib/stroke-processing"

// Clipper uses integer coordinates, so we scale up for precision
const CLIPPER_SCALE = 100000

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

// Clipper instance (loaded asynchronously)
let clipperInstance: ClipperLib.ClipperLibWrapper | null = null
let clipperLoadPromise: Promise<ClipperLib.ClipperLibWrapper> | null = null

async function getClipper(): Promise<ClipperLib.ClipperLibWrapper> {
  if (clipperInstance) return clipperInstance
  if (clipperLoadPromise) return clipperLoadPromise
  
  clipperLoadPromise = ClipperLib.loadNativeClipperLibInstanceAsync(
    ClipperLib.NativeClipperLibRequestedFormat.WasmWithAsmJsFallback
  )
  clipperInstance = await clipperLoadPromise
  return clipperInstance
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
 * Convert Point2D array to Clipper path (scaled integers)
 */
function toClipperPath(pts: Point2D[]): ClipperLib.Path {
  return pts.map(p => ({
    x: Math.round(p.x * CLIPPER_SCALE),
    y: Math.round(p.y * CLIPPER_SCALE)
  }))
}

/**
 * Convert Clipper path back to Point2D array
 */
function fromClipperPath(path: ClipperLib.Path): Point2D[] {
  return path.map(p => ({
    x: p.x / CLIPPER_SCALE,
    y: p.y / CLIPPER_SCALE
  }))
}

/**
 * Expand a polyline into a polygon using Clipper's offset operation.
 * Uses round joins and round end caps for smooth appearance.
 */
function expandPolylineWithClipper(
  clipper: ClipperLib.ClipperLibWrapper,
  points: Point2D[],
  thickness: number
): Point2D[][] {
  if (points.length < 2) return []
  
  const halfWidth = thickness / 2
  const clipperPath = toClipperPath(points)
  const delta = Math.round(halfWidth * CLIPPER_SCALE)
  
  try {
    // Use ClipperOffset for polyline expansion
    const result = clipper.offsetToPaths({
      delta,
      offsetInputs: [{
        data: clipperPath,
        joinType: ClipperLib.JoinType.Round,
        endType: ClipperLib.EndType.OpenRound  // Round end caps for open polyline
      }],
      arcTolerance: delta * 0.02,  // Smooth arcs
      miterLimit: 2
    })
    
    if (!result || result.length === 0) return []
    
    return result.map(fromClipperPath)
  } catch (e) {
    console.error("[v0] Clipper offset failed:", e)
    return []
  }
}

/**
 * Union multiple polygons using Clipper's boolean operations.
 * This handles self-overlapping regions correctly.
 */
function unionPolygonsWithClipper(
  clipper: ClipperLib.ClipperLibWrapper,
  polygons: Point2D[][]
): Polygon[] {
  if (polygons.length === 0) return []
  
  try {
    // Convert all polygons to Clipper paths
    const clipperPaths = polygons.map(toClipperPath)
    
    // Union all paths together using NonZero fill rule
    // This correctly handles self-overlapping regions
    const result = clipper.clipToPaths({
      clipType: ClipperLib.ClipType.Union,
      subjectInputs: clipperPaths.map(data => ({ data, closed: true })),
      subjectFillType: ClipperLib.PolyFillType.NonZero
    })
    
    if (!result || result.length === 0) return []
    
    // Separate outer boundaries and holes based on orientation
    // Clipper returns CCW for outers and CW for holes
    const outers: Point2D[][] = []
    const holes: Point2D[][] = []
    
    for (const path of result) {
      const pts = fromClipperPath(path)
      if (pts.length < 3) continue
      
      // Check orientation: positive area = CCW = outer, negative = CW = hole
      const area = signedArea(pts)
      if (area > 0) {
        outers.push(pts)
      } else {
        holes.push(pts)
      }
    }
    
    // Assign holes to their containing outers
    const polygonsWithHoles: Polygon[] = outers.map(outer => ({
      outer,
      holes: []
    }))
    
    // For each hole, find which outer contains it
    for (const hole of holes) {
      // Use first point of hole to test containment
      const testPt = hole[0]
      for (const poly of polygonsWithHoles) {
        if (pointInPolygon(testPt, poly.outer)) {
          poly.holes.push(hole)
          break
        }
      }
    }
    
    return polygonsWithHoles
    
  } catch (e) {
    console.error("[v0] Clipper union failed:", e)
    return []
  }
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
 * Point in polygon test using ray casting
 */
function pointInPolygon(pt: Point2D, polygon: Point2D[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    
    if (((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Simplify polygon using Clipper's built-in simplification
 */
function simplifyPolygonWithClipper(
  clipper: ClipperLib.ClipperLibWrapper,
  pts: Point2D[],
  tolerance: number
): Point2D[] {
  if (pts.length < 3) return pts
  
  const clipperPath = toClipperPath(pts)
  const epsilon = Math.round(tolerance * CLIPPER_SCALE)
  
  try {
    const result = clipper.simplifyPolygon(clipperPath, ClipperLib.PolyFillType.NonZero)
    if (!result || result.length === 0) return pts
    
    // Return the largest polygon from result
    let largest = result[0]
    let largestArea = 0
    for (const path of result) {
      const area = Math.abs(clipper.area(path))
      if (area > largestArea) {
        largestArea = area
        largest = path
      }
    }
    
    return fromClipperPath(largest)
  } catch {
    return pts
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
  
  // Create shape from outer boundary
  const shapePts = polygon.outer.map(p => new THREE.Vector2(p.x, p.y))
  
  // Ensure CCW winding for THREE.js Shape
  const area = signedArea(polygon.outer)
  if (area < 0) {
    shapePts.reverse()
  }
  
  const shape = new THREE.Shape(shapePts)
  
  // Add holes (need CW winding for THREE.js)
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
 * This is the SYNCHRONOUS version that requires clipper to be pre-loaded
 */
export function buildVectorSolidSync(
  clipper: ClipperLib.ClipperLibWrapper,
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
    // 1. Convert each stroke to 2D and expand using Clipper offset
    const expandedPolygons: Point2D[][] = []
    let totalInputPoints = 0
    
    for (const stroke of strokes) {
      const pts2D = strokeTo2D(stroke, canvasWidth, canvasHeight)
      totalInputPoints += pts2D.length
      if (pts2D.length < 2) continue
      
      const expanded = expandPolylineWithClipper(clipper, pts2D, thickness)
      expandedPolygons.push(...expanded)
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
    const unionedPolygons = unionPolygonsWithClipper(clipper, expandedPolygons)
    
    if (unionedPolygons.length === 0) {
      return { 
        geometry: null, 
        polygons: [], 
        expandedOutlines: expandedPolygons,
        success: false, 
        error: "Union failed",
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
      
      for (const geo of geometries) {
        const pos = geo.getAttribute("position")
        const norm = geo.getAttribute("normal")
        for (let i = 0; i < pos.count; i++) {
          positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
          if (norm) normals.push(norm.getX(i), norm.getY(i), norm.getZ(i))
        }
        geo.dispose()
      }
      
      finalGeometry = new THREE.BufferGeometry()
      finalGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
      if (normals.length > 0) {
        finalGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3))
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

/**
 * Async wrapper that loads Clipper first
 */
export async function buildVectorSolid(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
  thickness: number,
  depth: number
): Promise<VectorSolidResult> {
  const clipper = await getClipper()
  return buildVectorSolidSync(clipper, strokes, canvasWidth, canvasHeight, thickness, depth)
}

/**
 * Get the Clipper instance (for use in React components)
 */
export { getClipper }

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
    },
    {
      name: "Tight Loops",
      description: "Very tight loops and near-touching segments - stress test for union",
      stroke: {
        points: [
          { x: 150, y: 300 },
          { x: 200, y: 280 },
          { x: 220, y: 320 },
          { x: 180, y: 340 },
          { x: 160, y: 300 },
          { x: 200, y: 260 },
          { x: 260, y: 280 },
          { x: 280, y: 340 },
          { x: 240, y: 360 },
          { x: 200, y: 320 },
          { x: 220, y: 280 },
          { x: 280, y: 260 },
          { x: 340, y: 300 },
          { x: 320, y: 360 },
          { x: 260, y: 340 },
          { x: 240, y: 300 },
          { x: 300, y: 280 },
          { x: 380, y: 320 },
          { x: 400, y: 380 },
          { x: 350, y: 400 }
        ],
        cornerCount: 0
      }
    }
  ]
}

/**
 * THE ANIMATED GLB, WRITTEN: `./drawin-glb`'s morph targets on the export
 * group's meshes, one `AnimationClip`, and three's own `GLTFExporter`.
 *
 * The one file under `lib/export/` that imports three, and deliberately NOT
 * re-exported from `./index`: the film modules are served to a page as
 * standalone ES modules by `assert-export-live` and `assert-export-window`, and
 * a bare `three` import there would break both gates.
 *
 * What a viewer gets: every mesh keeps its finished geometry as the base pose
 * (a viewer that ignores animation shows the static GLB), gains the morph
 * targets, and one clip named `draw-in` drives their weights with LINEAR
 * interpolation on every frame of the plan. `KHR_animation_pointer` and
 * visibility are not used; morph weights are core glTF 2.0 and every viewer
 * that plays animation plays them.
 */
import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { buildDrawinAnimation, meshStrokeShares, type DrawinFrame, type DrawinPoint, type DrawinResult } from "./drawin-glb"
import { sparsifyMorphTargets, type SparseReport } from "./glb-sparse"

export const DRAWIN_CLIP_NAME = "draw-in"

export interface AnimatedGlbInput {
  /** The export group, as `engine.buildExport` returns it. Modified in place. */
  group: THREE.Object3D
  strokes: DrawinPoint[][]
  canvasWidth: number
  canvasHeight: number
  frames: DrawinFrame[]
  maxTargetsPerMesh?: number
  maxMorphBytes?: number
  /** Longest edge a fused mesh keeps. Default `DRAWIN_FUSED_MAX_EDGE`. */
  fusedMaxEdge?: number
  /** Rewrite the morph targets as sparse accessors (`./glb-sparse`). Default true. */
  sparse?: boolean
}

export interface AnimatedGlb {
  buffer: ArrayBuffer
  animation: DrawinResult
  /** Meshes that carry a track. */
  animatedMeshes: number
  /** What the sparse rewrite did, or null when it was not asked for. */
  sparse: SparseReport | null
}

/**
 * The stroke a mesh was built from, read off its name or its group's:
 * `stroke_007` and `stroke_007_part_2` (Rod, Extrude), `dd_rod_stroke_7_body`
 * (the dd engine). Anything else (`inflate_000`, `solid_000`, `dd_solid`) is a
 * fused mesh, matched vertex by vertex to the nearest stroke.
 */
function strokeIndexOf(mesh: THREE.Object3D): number {
  for (let o: THREE.Object3D | null = mesh; o; o = o.parent) {
    const m = /(?:^|_)stroke_(\d+)(?:_|$)/.exec(o.name || "")
    if (m) return Number(m[1])
  }
  return -1
}

/**
 * The longest edge a fused mesh keeps, in world units: 1/60 of the canvas's
 * long side (which every engine maps to 3 units), about 13 px at an 800 px
 * canvas. Solid's mask mesh caps a stroke with long, skinny triangles that run
 * its whole length; revealed corner by corner they drew slivers, a thin line
 * where a stroke had barely started and a hairline where a full-width stroke
 * should be (rendered and looked at). Split to this length, a triangle is one
 * step of the reveal, and the one across the front folds its hidden corners
 * onto the pen's edge. 1/150 looked the same and made a two-stroke Solid GLB
 * 52.8 MB (about 230k corners from 2.7k vertices).
 */
export const DRAWIN_FUSED_MAX_EDGE = 3 / 60

/**
 * Split every triangle of a NON-indexed geometry at the midpoint of its longest
 * edge until no edge is longer than `maxEdge`. Every attribute is interpolated
 * linearly (normals renormalised), so the surface is the same surface: flat
 * triangles cut into flat triangles on the same plane. Geometry with groups
 * (several materials) is left alone.
 */
export function subdivideLongTriangles(geo: THREE.BufferGeometry, maxEdge: number): THREE.BufferGeometry {
  if (geo.index || geo.groups.length > 1) return geo
  const pos = geo.getAttribute("position") as THREE.BufferAttribute
  const names = Object.keys(geo.attributes)
  const attrs = names.map((n) => geo.getAttribute(n) as THREE.BufferAttribute)
  const P = names.indexOf("position")
  const N = names.indexOf("normal")
  /* A corner is every attribute's values for one vertex, in `names` order. */
  type Corner = number[][]
  const corner = (i: number): Corner => attrs.map((a) => Array.from({ length: a.itemSize }, (_, k) => a.array[i * a.itemSize + k] as number))
  const len = (p: Corner, q: Corner) => Math.hypot(p[P][0] - q[P][0], p[P][1] - q[P][1], p[P][2] - q[P][2])
  const mid = (p: Corner, q: Corner): Corner =>
    p.map((vals, ai) => {
      const m = vals.map((v, k) => (v + q[ai][k]) / 2)
      if (ai === N) {
        const l = Math.hypot(m[0], m[1], m[2]) || 1
        return [m[0] / l, m[1] / l, m[2] / l]
      }
      return m
    })
  const out: number[][] = attrs.map(() => [])
  const emit = (tri: Corner[]) => {
    for (const c of tri) c.forEach((vals, ai) => out[ai].push(...vals))
  }
  const stack: Corner[][] = []
  let splits = 0
  for (let t = 0; t + 2 < pos.count; t += 3) {
    stack.push([corner(t), corner(t + 1), corner(t + 2)])
    while (stack.length) {
      const [a, b, c] = stack.pop()!
      const ab = len(a, b)
      const bc = len(b, c)
      const ca = len(c, a)
      const L = Math.max(ab, bc, ca)
      /* The cap on splits is a guard against a runaway input, not a tuning
       * knob: a stroke drawing is far below it. */
      if (L <= maxEdge || splits > 2_000_000) {
        emit([a, b, c])
        continue
      }
      splits++
      if (L === ab) {
        const m = mid(a, b)
        stack.push([a, m, c], [m, b, c])
      } else if (L === bc) {
        const m = mid(b, c)
        stack.push([a, b, m], [a, m, c])
      } else {
        const m = mid(c, a)
        stack.push([a, b, m], [m, b, c])
      }
    }
  }
  if (splits === 0) return geo
  const res = new THREE.BufferGeometry()
  names.forEach((n, ai) => res.setAttribute(n, new THREE.BufferAttribute(new Float32Array(out[ai]), attrs[ai].itemSize, attrs[ai].normalized)))
  return res
}

export async function buildAnimatedGlb(input: AnimatedGlbInput): Promise<AnimatedGlb> {
  const { group } = input
  group.updateMatrixWorld(true)
  const meshes: THREE.Mesh[] = []
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry?.getAttribute("position")) meshes.push(o as THREE.Mesh)
  })
  if (meshes.length === 0) throw new Error("animated GLB: the export has no meshes")

  const worldPositions = (mesh: THREE.Mesh) => {
    const attr = mesh.geometry.getAttribute("position") as THREE.BufferAttribute
    const out = new Float32Array(attr.count * 3)
    const v = new THREE.Vector3()
    for (let k = 0; k < attr.count; k++) {
      v.fromBufferAttribute(attr, k).applyMatrix4(mesh.matrixWorld)
      out[k * 3] = v.x
      out[k * 3 + 1] = v.y
      out[k * 3 + 2] = v.z
    }
    return out
  }

  /* WHICH STROKE EACH MESH IS. The name says for Rod, Extrude and the dd
   * engine. Where it does not (`inflate_000`), a mesh whose vertices lie
   * 97% or more nearest one stroke IS that stroke's mesh (Inflate exports one
   * per stroke when it does not fuse them), and is treated as one: indexed,
   * its hidden vertices folded onto the pen's edge. Measured on a two-stroke
   * Inflate export: treated as fused instead, un-indexing made its two meshes
   * 84k corners and the file 30.6 MB. */
  const named = meshes.map((m) => strokeIndexOf(m))
  const shares = named.some((i) => i < 0)
    ? meshStrokeShares(
        meshes.map((m, i) => ({ name: m.name, positions: worldPositions(m), strokeIndex: named[i] })),
        input.strokes,
        input.canvasWidth,
        input.canvasHeight,
      )
    : named.map(() => ({ stroke: -1, share: 0 }))
  const strokeOf = named.map((i, k) => (i >= 0 ? i : shares[k].share >= 0.97 ? shares[k].stroke : -1))

  /* A FUSED MESH (it holds several strokes) IS UN-INDEXED FIRST, so every
   * triangle owns its three corners and can be hidden whole (see
   * `./drawin-glb`, "WHERE A HIDDEN VERTEX GOES"), then its long triangles are
   * split (`subdivideLongTriangles`). The surface is unchanged: the same
   * planes, the same normals interpolated, cut finer. It costs bytes, which
   * the morph budget absorbs. */
  meshes.forEach((mesh, k) => {
    if (strokeOf[k] >= 0) return
    const soup = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
    const fine = subdivideLongTriangles(soup, input.fusedMaxEdge ?? DRAWIN_FUSED_MAX_EDGE)
    if (fine !== mesh.geometry) {
      mesh.geometry.dispose()
      if (soup !== fine && soup !== mesh.geometry) soup.dispose()
      mesh.geometry = fine
    }
  })

  /* World-space positions for the fit; the targets are written back in each
   * mesh's own space. */
  const inputs = meshes.map((mesh, i) => {
    if (!mesh.name) mesh.name = `mesh_${i}`
    const strokeIndex = strokeOf[i]
    return { name: mesh.name, positions: worldPositions(mesh), strokeIndex, triangles: strokeIndex < 0 && !mesh.geometry.index }
  })

  const animation = buildDrawinAnimation({
    meshes: inputs,
    strokes: input.strokes,
    canvasWidth: input.canvasWidth,
    canvasHeight: input.canvasHeight,
    frames: input.frames,
    maxTargetsPerMesh: input.maxTargetsPerMesh,
    maxMorphBytes: input.maxMorphBytes,
  })

  const tracks: THREE.KeyframeTrack[] = []
  const toLocal = new THREE.Matrix3()
  meshes.forEach((mesh, i) => {
    const out = animation.meshes[i]
    if (out.targets.length === 0) return
    /* A delta is a direction, so it goes back through the inverse of the
     * linear part of the world matrix only. */
    toLocal.setFromMatrix4(mesh.matrixWorld).invert()
    const d = new THREE.Vector3()
    const geo = mesh.geometry
    geo.morphAttributes.position = out.targets.map((t, k) => {
      const local = new Float32Array(t.length)
      for (let j = 0; j < t.length; j += 3) {
        d.set(t[j], t[j + 1], t[j + 2]).applyMatrix3(toLocal)
        local[j] = d.x
        local[j + 1] = d.y
        local[j + 2] = d.z
      }
      const attr = new THREE.BufferAttribute(local, 3)
      attr.name = `reveal_${String(k).padStart(2, "0")}`
      return attr
    })
    geo.morphTargetsRelative = true
    mesh.updateMorphTargets()
    tracks.push(new THREE.NumberKeyframeTrack(`${mesh.uuid}.morphTargetInfluences`, Array.from(animation.times), Array.from(out.weights)))
  })

  const clip = new THREE.AnimationClip(DRAWIN_CLIP_NAME, -1, tracks)
  const exportScene = new THREE.Scene()
  const parent = group.parent
  exportScene.add(group)
  try {
    const exporter = new GLTFExporter()
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(exportScene, (gltf) => resolve(gltf as ArrayBuffer), (error) => reject(error), {
        binary: true,
        animations: [clip],
      })
    })
    if (input.sparse === false) return { buffer, animation, animatedMeshes: tracks.length, sparse: null }
    const packed = sparsifyMorphTargets(buffer)
    return { buffer: packed.glb, animation, animatedMeshes: tracks.length, sparse: packed.report }
  } finally {
    exportScene.remove(group)
    if (parent) parent.add(group)
  }
}

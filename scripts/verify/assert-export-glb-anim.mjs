// assert-export-glb-anim.mjs · DOES THE ANIMATED GLB PLAY THE DRAW-IN?
//
// Node only; the browser half is `assert-export-glb-anim-app.mjs`. The export
// group is built here the way Rod builds one (a tube per stroke named
// `stroke_###`, recentred on its bounding box) and, in a second run, fused
// into one mesh the way Inflate exports. It goes through the REAL adapter
// (`lib/export/drawin-glb-three.ts`), the real `buildDrawinAnimation` and
// three's real GLTFExporter. The file is then read two ways: by an independent
// GLB reader (`lib/glb-walk.mjs`) and by three's GLTFLoader plus an
// AnimationMixer, which is what a three-based GLB viewer runs.
//
// "Live" here is what the app's rebuild path shows: the spans each stroke is
// cut at. At the first planned frame of a grow reveal nothing is drawn; at the
// last, the whole mark is.
//
// Rows, each with an arm that MUST fail:
//   decodes          our reader and three's GLTFLoader both read it, one clip
//                                    | the same file cut to 60%
//   count            one keyframe per planned frame, at the plan's times
//                                    | the DISTINCT weight rows number the plan too
//   size             the last keyframe's bounds are the static GLB's bounds
//                                    | the first keyframe's bounds are too
//   first and last   first keyframe draws no area, last is the static mark exactly
//                                    | the previous build, which collapsed a hidden mesh
//                                      vertex by vertex (slivers where the path bends)
//   growth           visible area never shrinks from one keyframe to the next,
//                    and a mid-take keyframe is partly drawn
//                                    | a build that hides what should show
//   fit              vertices sit a tube radius from their matched centreline
//                                    | the same fit with the centreline offset left at 0
//   fused mesh       the first and last rows hold on one fused mesh too; at every
//                    stored state a triangle with all corners moved has no area
//                    and a front corner moves no farther than its triangle's edge
//                                    | the previous build, which left the fused mesh
//                                      indexed and folded hidden vertices one by one
//   viewer           three's AnimationMixer puts the same weights on the meshes
//                    at the first and last keyframe times
//                                    | the mixer's weights at mid-take equal the first
//   inferred stroke  meshes named like fused ones (inflate_000) that each hold one
//                    stroke are treated as per-stroke: indexed, first/last hold
//                                    | inference switched off (the 97% bar raised past 100%)
//   sparse           the morph targets are sparse accessors that decode, by our
//                    reader and by three's loader, to exactly the dense targets
//                                    | a sparsifier that drops each target's last entry
//   hold             through a pen pause (spans unchanged) every weight row is
//                    the same, with few targets so states must be blended
//                                    | the previous build, which blended by frame index
//
//   node scripts/verify/assert-export-glb-anim.mjs
import ts from "typescript"
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { ROOT, loadTs } from "./_ts-load.mjs"
import { makePaired } from "./lib/paired.mjs"
import { readGlb, weightsAt, morphed, areaOf, boundsOf, cornersOf } from "./lib/glb-walk.mjs"

const { planFrames } = loadTs("lib/export/frame-plan.ts")
const DIR = mkdtempSync(join(tmpdir(), "fs-glbanim-"))

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
const paired = makePaired(row)

/* ---- node has no FileReader; GLTFExporter's binary path uses one ------ */
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((ab) => {
      this.result = ab
      this.onload?.({ target: this })
      this.onloadend?.({ target: this })
    })
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((ab) => {
      this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(ab).toString("base64")}`
      this.onload?.({ target: this })
      this.onloadend?.({ target: this })
    })
  }
}

/* ---- the adapter as an ES module, with optional text edits ------------ */
let modN = 0
async function loadAdapter(edits = []) {
  const url = (spec) => import.meta.resolve(spec)
  const tag = `v${modN++}`
  const emit = (file, rewrite) => {
    let src = readFileSync(join(ROOT, "lib/export", file), "utf8")
    /* GATE_MUTATE_FILE, the same offset edits `_ts-load.mjs` applies, so an
     * outside driver (assert-export-formats.mjs) can sabotage these modules
     * too. Unset changes nothing. */
    const outside = process.env.GATE_MUTATE_FILE ? JSON.parse(readFileSync(process.env.GATE_MUTATE_FILE, "utf8"))[`lib/export/${file}`] : null
    for (const e of [...(outside ?? [])].sort((x, y) => y.pos - x.pos)) {
      if (e.was != null && src.slice(e.pos, e.end) !== e.was) throw new Error(`GATE_MUTATE_FILE: stale offset in ${file}`)
      src = src.slice(0, e.pos) + e.text + src.slice(e.end)
    }
    for (const [was, now] of edits.filter((e) => e[2] === file)) {
      const first = src.indexOf(was)
      if (first < 0 || src.indexOf(was, first + 1) >= 0) throw new Error(`mutant: ${file} must contain ${JSON.stringify(was)} exactly once`)
      src = src.replace(was, now)
    }
    let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: file }).outputText
    js = rewrite(js)
    const out = join(DIR, `${file.replace(/\.ts$/, "")}-${tag}.mjs`)
    writeFileSync(out, js)
    return out
  }
  const core = emit("drawin-glb.ts", (js) => js)
  const sparse = emit("glb-sparse.ts", (js) => js)
  const three = emit("drawin-glb-three.ts", (js) =>
    js
      .replace(/from\s+["']three["']/g, `from "${url("three")}"`)
      .replace(/from\s+["']three\/examples\/jsm\/exporters\/GLTFExporter\.js["']/g, `from "${url("three/examples/jsm/exporters/GLTFExporter.js")}"`)
      .replace(/from\s+["']\.\/drawin-glb["']/g, `from "${pathToFileURL(core).href}"`)
      .replace(/from\s+["']\.\/glb-sparse["']/g, `from "${pathToFileURL(sparse).href}"`),
  )
  return {
    three: await import(pathToFileURL(three).href),
    core: await import(pathToFileURL(core).href),
    sparse: await import(pathToFileURL(sparse).href),
  }
}

/* ---- a Rod-like export group ------------------------------------------ */
const CW = 900
const CH = 600
const RADIUS = 0.04
const STROKES = [
  Array.from({ length: 40 }, (_, i) => ({ x: 120 + i * 9, y: 300 - 140 * Math.sin((i / 39) * Math.PI) })),
  Array.from({ length: 30 }, (_, i) => ({ x: 520 + i * 8, y: 420 - 90 * Math.sin((i / 29) * Math.PI * 1.5) })),
]
const K = 3 / Math.max(CW, CH)
const to3 = (p) => new THREE.Vector3((p.x - CW / 2) * K, -(p.y - CH / 2) * K, 0)

function buildGroup({ fused = false, names = null } = {}) {
  const geos = STROKES.map((pts) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(to3), false, "centripetal")
    const g = new THREE.TubeGeometry(curve, 160, RADIUS, 12, false)
    const a = new THREE.SphereGeometry(RADIUS, 12, 8).translate(...to3(pts[0]).toArray())
    const b = new THREE.SphereGeometry(RADIUS, 12, 8).translate(...to3(pts[pts.length - 1]).toArray())
    return mergeGeometries([g, a, b], false)
  })
  const group = new THREE.Group()
  group.name = "FreeStroke"
  const material = new THREE.MeshStandardMaterial({ color: 0x222222 })
  if (fused) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), material)
    m.name = "inflate_fused"
    group.add(m)
  } else {
    geos.forEach((g, i) => {
      const m = new THREE.Mesh(g, material)
      m.name = names ? names[i] : `stroke_${String(i).padStart(3, "0")}`
      group.add(m)
    })
  }
  // Recentre on the bounding box, exactly as the engines' buildExport does.
  const box = new THREE.Box3().setFromObject(group)
  const c = box.getCenter(new THREE.Vector3())
  group.traverse((o) => o.isMesh && o.geometry.translate(-c.x, -c.y, -c.z))
  return { group, centre: c }
}

/* ---- the plan and the live spans (identity schedule, grow) ------------- */
const plan = planFrames({ penDurationMs: 1400, fps: 24, timebase: "pen", holdMs: 300 })
const N = plan.frames.length
const lens = STROKES.map((pts) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0))
const total = lens.reduce((a, b) => a + b, 0)
function spansAt(p) {
  // `filterStrokesByProgress`'s global arc prefix, which is what
  // `strokeSpansIn` returns at the identity schedule under `grow`.
  const out = new Float64Array(STROKES.length * 2)
  let acc = 0
  for (let s = 0; s < STROKES.length; s++) {
    const f1 = Math.max(0, Math.min(1, (p * total - acc) / lens[s]))
    out[s * 2] = 0
    out[s * 2 + 1] = f1
    acc += lens[s]
  }
  return [out]
}
const frames = plan.frames.map((f) => ({ timeMs: f.timeMs, spans: spansAt(f.clock) }))

async function exportAnimated(adapter, opts = {}) {
  const { group } = buildGroup({ fused: opts.fused, names: opts.names })
  const res = await adapter.three.buildAnimatedGlb({
    group,
    strokes: STROKES,
    canvasWidth: CW,
    canvasHeight: CH,
    frames: opts.frames ?? frames,
    maxTargetsPerMesh: opts.maxTargetsPerMesh,
    sparse: opts.sparse,
  })
  return { bytes: new Uint8Array(res.buffer), res }
}
async function exportStatic(opts = {}) {
  const { group } = buildGroup(opts)
  const scene = new THREE.Scene()
  scene.add(group)
  const buf = await new Promise((resolve, reject) => new GLTFExporter().parse(scene, resolve, reject, { binary: true }))
  return new Uint8Array(buf)
}

/** Evaluate every primitive of a GLB at keyframe k (null = base pose). */
function poseAt(glb, k) {
  const anim = glb.animations[0]
  let area = 0
  const all = []
  const corners = []
  for (const pr of glb.prims) {
    const w = k === null ? null : weightsAt(anim, pr.node, k, pr.targets.length)
    const pos = morphed(pr, w)
    area += areaOf(pr, pos)
    all.push(pos)
    corners.push(cornersOf(pr, pos))
  }
  const cflat = new Float64Array(corners.reduce((a, p) => a + p.length, 0))
  let co = 0
  for (const p of corners) {
    cflat.set(p, co)
    co += p.length
  }
  const flat = new Float64Array(all.reduce((a, p) => a + p.length, 0))
  let o = 0
  for (const p of all) {
    flat.set(p, o)
    o += p.length
  }
  return { area, pos: flat, corners: cflat, bounds: boundsOf(flat) }
}
const maxAbs = (a, b) => {
  if (a.length !== b.length) return Infinity
  let m = 0
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]))
  return m
}
/* The same surface, for a fused mesh the animated file carries subdivided
 * (`subdivideLongTriangles`): equal area to 1e-6 of itself, equal bounds. */
const sameSurface = (a, b) => Math.abs(a.area - b.area) <= b.area * 1e-6 && boundsEq(a.bounds, b.bounds)
const boundsEq = (a, b, eps = 1e-6) => [0, 1, 2].every((c) => Math.abs(a.min[c] - b.min[c]) <= eps && Math.abs(a.max[c] - b.max[c]) <= eps)

/* ======================================================================= */
const REAL = await loadAdapter()
const { bytes, res } = await exportAnimated(REAL)
const staticBytes = await exportStatic()
console.log(`animated GLB ${bytes.length} bytes (static ${staticBytes.length}) · ${res.animatedMeshes} animated meshes · morph ${res.animation.morphBytes} bytes · targets ${res.animation.meshes.map((m) => m.targets.length).join("/")} · fit offset ${res.animation.offset.x.toFixed(5)},${res.animation.offset.y.toFixed(5)}`)

/* 1 · decodes */
let glb = null
let loaded = null
{
  let err = ""
  try {
    glb = readGlb(bytes)
    loaded = await new Promise((resolve, reject) => new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "", resolve, reject))
  } catch (e) {
    err = e.message
  }
  const cut = bytes.subarray(0, Math.floor(bytes.length * 0.6))
  paired(
    "our reader and three's GLTFLoader both read the file, which carries one clip named draw-in",
    () => !!glb && !!loaded && glb.version === 2 && glb.animations.length === 1 && loaded.animations.length === 1 && loaded.animations[0].name === "draw-in",
    "the same file cut to 60% reads too",
    () => {
      try {
        readGlb(cut)
        return true
      } catch {
        return false
      }
    },
    glb ? `glTF ${glb.version} · ${glb.prims.length} primitives · ${glb.animations.length} animation(s), ${glb.animations[0]?.channels.length} channels · three loaded ${loaded?.animations.length} clip(s) ${loaded?.animations[0]?.name}` : err,
  )
}

/* 2 · count */
{
  const anim = glb.animations[0]
  const inputs = anim.channels.map((c) => c.input)
  const timesOk = inputs.every((inp) => inp.count === N && plan.frames.every((f, i) => Math.abs(inp.data[i] - f.timeMs / 1000) < 1e-5))
  const rows = new Set()
  for (const ch of anim.channels) {
    const n = ch.output.count / ch.input.count
    for (let k = 0; k < ch.input.count; k++) rows.add(`${ch.node}:` + Array.from(ch.output.data.subarray(k * n, k * n + n)).join(","))
  }
  const perChannelDistinct = rows.size / anim.channels.length
  paired(
    "one keyframe per planned frame on every channel, at the plan's own times",
    () => timesOk && anim.channels.every((c) => c.path === "weights"),
    "the DISTINCT weight rows per channel number the plan too (a coalescing writer's count)",
    () => perChannelDistinct === N,
    `plan ${N} frames · channel keyframes ${inputs.map((i) => i.count).join("/")} · distinct rows per channel ${perChannelDistinct.toFixed(1)}`,
  )
}

/* 3 · size, 4 · first and last */
const staticGlb = readGlb(staticBytes)
const statPose = poseAt(staticGlb, null)
const first = poseAt(glb, 0)
const last = poseAt(glb, N - 1)
paired(
  "the last keyframe's bounds are the static GLB's bounds",
  () => boundsEq(last.bounds, statPose.bounds),
  "the first keyframe's bounds are the static GLB's too",
  () => boundsEq(first.bounds, statPose.bounds),
  `static min ${statPose.bounds.min.map((v) => v.toFixed(4))} max ${statPose.bounds.max.map((v) => v.toFixed(4))} · last ${last.bounds.min.map((v) => v.toFixed(4))} / ${last.bounds.max.map((v) => v.toFixed(4))} · first max ${first.bounds.max.map((v) => v.toFixed(4))}`,
)
{
  const Flip = await loadAdapter([["      if (hiddenCount === n) {", "      if (false) {", "drawin-glb.ts"]])
  const flip = readGlb((await exportAnimated(Flip)).bytes)
  const fFirst = poseAt(flip, 0)
  const fLast = poseAt(flip, N - 1)
  const lastErr = maxAbs(last.corners, statPose.corners)
  const ok = (f, l, e) => f.area <= statPose.area * 1e-9 && e <= 1e-6
  paired(
    "first keyframe draws no area (live shows nothing), last keyframe is the static mark to 1e-6",
    () => ok(first, last, lastErr),
    "the previous build (a hidden mesh collapsed vertex by vertex onto the centreline) passes too",
    () => ok(fFirst, fLast, maxAbs(fLast.corners, statPose.corners)),
    `first area ${first.area.toExponential(3)} of ${statPose.area.toFixed(4)} · last max |d| ${lastErr.toExponential(2)} · previous build first area ${fFirst.area.toExponential(3)}`,
  )
}

/* 5 · growth */
{
  const areas = []
  for (let k = 0; k < N; k++) areas.push(poseAt(glb, k).area)
  const Inv = await loadAdapter([["    if (f1 > f0 && u >= f0 - 1e-9 && u <= f1 + 1e-9) return true\n  }\n  return false", "    if (f1 > f0 && u >= f0 - 1e-9 && u <= f1 + 1e-9) return false\n  }\n  return true", "drawin-glb.ts"]])
  const inv = readGlb((await exportAnimated(Inv)).bytes)
  const invAreas = []
  for (let k = 0; k < N; k++) invAreas.push(poseAt(inv, k).area)
  const grows = (a) => a.every((v, i) => i === 0 || v >= a[i - 1] - statPose.area * 1e-6)
  const mid = areas[Math.floor(N / 2)] / statPose.area
  paired(
    "visible area never shrinks keyframe to keyframe, and mid-take is partly drawn",
    () => grows(areas) && mid > 0.1 && mid < 0.95,
    "a build that hides what should show grows too",
    () => grows(invAreas),
    `area ${areas[0].toFixed(4)} -> ${areas[Math.floor(N / 2)].toFixed(4)} -> ${areas[N - 1].toFixed(4)} (mid ${(mid * 100).toFixed(1)}%) · hide-the-shown: ${invAreas[0].toFixed(4)} -> ${invAreas[N - 1].toFixed(4)}`,
  )
}

/* 6 · fit */
{
  const Zero = await loadAdapter([["  for (let iter = 0; iter < 6; iter++) {", "  ox = 0\n  oy = 0\n  for (let iter = 0; iter < 0; iter++) {", "drawin-glb.ts"]])
  const z = await exportAnimated(Zero)
  const fit = res.animation.fitMeanDistance
  const zfit = z.res.animation.fitMeanDistance
  paired(
    "vertices sit about a tube radius from their matched centreline (the recentre offset was recovered)",
    () => fit <= RADIUS * 1.25,
    "the same fit with the offset left at 0 sits as close",
    () => zfit <= RADIUS * 1.25,
    `mean distance ${fit.toFixed(5)} (radius ${RADIUS}) · offset left at 0: ${zfit.toFixed(5)}`,
  )
}

/* 7 · the fused mesh
 * The defect here was never the first frame: it was mid-take, where the first
 * build folded hidden vertices one by one and a fused mesh's long triangles
 * became hairlines along the part not yet drawn (seen on a real Solid export).
 * At every STORED-STATE keyframe (one weight at 1, the rest 0, or all 0):
 *   a triangle whose three corners all moved has no area, and
 *   a corner of a partly moved triangle (the reveal front) moved no farther
 *   than that triangle's own longest edge, so nothing spikes across the mark. */
function movedStats(glb, k) {
  const anim = glb.animations[0]
  let hiddenArea = 0
  let worstReach = 0
  for (const pr of glb.prims) {
    const w = weightsAt(anim, pr.node, k, pr.targets.length)
    if (!w) continue
    const nz = Array.from(w).filter((x) => x !== 0)
    if (!(nz.length === 0 || (nz.length === 1 && nz[0] === 1))) return null
    const base = cornersOf(pr, morphed(pr, null))
    const pos = cornersOf(pr, morphed(pr, w))
    for (let t = 0; t < pos.length; t += 9) {
      const moved = [0, 1, 2].map((c) => Math.hypot(pos[t + c * 3] - base[t + c * 3], pos[t + c * 3 + 1] - base[t + c * 3 + 1], pos[t + c * 3 + 2] - base[t + c * 3 + 2]))
      const nMoved = moved.filter((d) => d > 1e-9).length
      if (nMoved === 0) continue
      if (nMoved === 3) {
        const ax = pos[t + 3] - pos[t], ay = pos[t + 4] - pos[t + 1], az = pos[t + 5] - pos[t + 2]
        const bx = pos[t + 6] - pos[t], by = pos[t + 7] - pos[t + 1], bz = pos[t + 8] - pos[t + 2]
        hiddenArea += 0.5 * Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx)
      } else {
        let L = 0
        for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) L = Math.max(L, Math.hypot(base[t + a * 3] - base[t + b * 3], base[t + a * 3 + 1] - base[t + b * 3 + 1], base[t + a * 3 + 2] - base[t + b * 3 + 2]))
        worstReach = Math.max(worstReach, Math.max(...moved) / L)
      }
    }
  }
  return { hiddenArea, worstReach }
}
function worstMoved(glb) {
  let worst = 0
  let reach = 0
  let states = 0
  const K = glb.animations[0].channels[0].input.count
  for (let k = 0; k < K; k++) {
    const m = movedStats(glb, k)
    if (m === null) continue
    states++
    worst = Math.max(worst, m.hiddenArea)
    reach = Math.max(reach, m.worstReach)
  }
  return { worst, reach, states }
}
{
  const f = await exportAnimated(REAL, { fused: true })
  const fg = readGlb(f.bytes)
  const fStatic = poseAt(readGlb(await exportStatic({ fused: true })), null)
  const f0 = poseAt(fg, 0)
  const fN = poseAt(fg, N - 1)
  const fMid = poseAt(fg, Math.floor(N / 2))
  const w = worstMoved(fg)
  const Indexed = await loadAdapter([["    if (strokeOf[k] >= 0) return\n", "    return\n", "drawin-glb-three.ts"]])
  const ig = readGlb((await exportAnimated(Indexed, { fused: true })).bytes)
  const iw = worstMoved(ig)
  paired(
    "one fused mesh (a subdivided triangle soup matched corner by corner): first keyframe no area, last the static surface, mid partly drawn; at every stored state hidden triangles have no area and front corners stay within their triangle's reach",
    () =>
      fg.prims.length === 1 &&
      f0.area <= fStatic.area * 1e-9 &&
      sameSurface(fN, fStatic) &&
      fMid.area > 0.05 * fStatic.area &&
      w.states > 2 &&
      w.worst <= fStatic.area * 1e-9 &&
      w.reach <= 1 + 1e-6,
    "the previous build (fused mesh left indexed and unsplit, hidden vertices folded one by one) passes too",
    () => iw.states > 2 && iw.worst <= fStatic.area * 1e-9 && iw.reach <= 1 + 1e-6,
    `${fg.prims.length} primitive · targets ${f.res.animation.meshes[0].targets.length} · first area ${f0.area.toExponential(2)} · last keyframe area ${fN.area.toFixed(6)} vs static ${fStatic.area.toFixed(6)}, bounds equal ${boundsEq(fN.bounds, fStatic.bounds)} (same surface: the animated mesh is un-indexed and subdivided, ${fg.prims[0].position.count} corners vs ${fStatic.corners.length / 3}) · mid ${((fMid.area / fStatic.area) * 100).toFixed(1)}% · hidden-triangle area, worst of ${w.states} stored states: ${w.worst.toExponential(2)}, front reach ${w.reach.toFixed(3)} of a triangle's longest edge · previous build: hidden area ${iw.worst.toExponential(2)} (${((iw.worst / fStatic.area) * 100).toFixed(3)}% of the mark)`,
  )
}

/* 8 · the viewer: three's AnimationMixer */
{
  const scene = loaded.scene
  const clip = loaded.animations[0]
  const meshes = []
  scene.traverse((o) => o.isMesh && o.morphTargetInfluences && meshes.push(o))
  /* A fresh mixer per instant, played once and held, as a viewer's timeline
   * scrub does: a looping action wraps to 0 at exactly the clip's end (the
   * last keyframe), and a finished action stops writing. */
  const at = (t) => {
    const mixer = new THREE.AnimationMixer(scene)
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.play()
    mixer.setTime(t)
    const w = meshes.map((m) => Array.from(m.morphTargetInfluences))
    mixer.stopAllAction()
    mixer.uncacheRoot(scene)
    return w
  }
  const anim = glb.animations[0]
  const ours = (k) =>
    anim.channels.map((ch) => {
      const n = ch.output.count / ch.input.count
      return Array.from(ch.output.data.subarray(k * n, k * n + n))
    })
  const diff = (a, b) => {
    let m = 0
    a.forEach((row, i) => row.forEach((v, j) => (m = Math.max(m, Math.abs(v - (b[i]?.[j] ?? NaN))))))
    return Number.isNaN(m) ? Infinity : m
  }
  const t0 = plan.frames[0].timeMs / 1000
  const tN = plan.frames[N - 1].timeMs / 1000
  const m0 = at(t0)
  const mN = at(tN)
  const mMid = at(plan.frames[Math.floor(N / 2)].timeMs / 1000)
  const d0 = diff(m0, ours(0))
  const dN = diff(mN, ours(N - 1))
  paired(
    "three's AnimationMixer binds the clip and puts our weights on the meshes at the first and last keyframe times",
    () => meshes.length === glb.prims.length && d0 <= 1e-6 && dN <= 1e-6,
    "the mixer's weights at mid-take equal the first keyframe's",
    () => diff(mMid, ours(0)) <= 1e-6,
    `${meshes.length} meshes bound · |mixer - file| first ${d0.toExponential(2)}, last ${dN.toExponential(2)} · mid vs first ${diff(mMid, ours(0)).toFixed(3)}`,
  )
}

/* 11 · a per-stroke mesh with a fused-looking name */
{
  const names = ["inflate_000", "inflate_001"]
  const inf = await exportAnimated(REAL, { names })
  const ig = readGlb(inf.bytes)
  const Off = await loadAdapter([["shares[k].share >= 0.97", "shares[k].share >= 1.01", "drawin-glb-three.ts"]])
  const og = readGlb((await exportAnimated(Off, { names })).bytes)
  const i0 = poseAt(ig, 0)
  const iN = poseAt(ig, N - 1)
  const ok = (g) => g.prims.length === 2 && g.prims.every((p) => !!p.indices)
  paired(
    "meshes named inflate_000/001 that each hold one stroke are treated as per-stroke: still indexed, first keyframe no area, last the static mark",
    () => ok(ig) && i0.area <= statPose.area * 1e-9 && maxAbs(iN.corners, statPose.corners) <= 1e-6,
    "with inference switched off they stay indexed too",
    () => ok(og),
    `indexed ${ig.prims.map((p) => !!p.indices).join("/")} · first area ${i0.area.toExponential(2)} · last max |d| ${maxAbs(iN.corners, statPose.corners).toExponential(2)} · inference off: indexed ${og.prims.map((p) => !!p.indices).join("/")}, ${og.prims.map((p) => p.position.count).join("/")} corners`,
  )
}

/* 10 · sparse targets decode to the dense ones */
{
  const dense = readGlb((await exportAnimated(REAL, { sparse: false })).bytes)
  const Drop = await loadAdapter([["    sparseFor.set(ai, { idx: Uint32Array.from(idx), vals: Float32Array.from(vals) })", "    sparseFor.set(ai, { idx: Uint32Array.from(idx.slice(0, -1)), vals: Float32Array.from(vals.slice(0, -3)) })", "glb-sparse.ts"]])
  const dropped = readGlb((await exportAnimated(Drop)).bytes)
  const sameTargets = (x, y) =>
    x.prims.length === y.prims.length &&
    x.prims.every((p, i) => p.targets.length === y.prims[i].targets.length && p.targets.every((t, k) => maxAbs(t.data, y.prims[i].targets[k].data) === 0))
  const nSparse = glb.prims.reduce((a, p) => a + p.targets.filter((t) => t.sparse).length, 0)
  const nAll = glb.prims.reduce((a, p) => a + p.targets.length, 0)
  /* three's loader, which applies sparse itself: its morph attributes must be
   * the dense file's, value for value. */
  let threeOk = true
  loaded.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry.morphAttributes.position) return
    const pr = dense.prims.find((p) => p.name === o.name)
    if (!pr) {
      threeOk = false
      return
    }
    o.geometry.morphAttributes.position.forEach((attr, k) => {
      const want = pr.targets[k].data
      for (let i = 0; i < attr.array.length; i++) if (Math.abs(attr.array[i] - want[i]) > 0) threeOk = false
    })
  })
  paired(
    `the morph targets are sparse accessors (${nSparse} of ${nAll}) that decode, by our reader and by three's GLTFLoader, to exactly the dense targets`,
    () => nSparse > 0 && sameTargets(glb, dense) && threeOk,
    "a sparsifier that drops each target's last entry decodes to the dense targets too",
    () => sameTargets(dropped, dense),
    `${bytes.length} bytes sparse vs ${dense.length} dense`,
  )
}

/* 9 · a pause holds */
{
  // The same take with the pen held still for 20 frames after 40% of it.
  const PAUSE = 20
  const cut = Math.floor(N * 0.4)
  const paused = []
  for (let i = 0; i < N + PAUSE; i++) {
    const src = i < cut ? i : i < cut + PAUSE ? cut : i - PAUSE
    paused.push({ timeMs: (i * 1000) / 24, spans: frames[src].spans })
  }
  const rowsIn = (r, lo, hi) => {
    const out = new Set()
    for (const m of r.animation.meshes) {
      const K = m.targets.length
      for (let f = lo; f < hi; f++) out.add(`${m.name}:${Array.from(m.weights.subarray(f * K, f * K + K)).join(",")}`)
    }
    return out.size / r.animation.meshes.length
  }
  const real = await exportAnimated(REAL, { frames: paused, maxTargetsPerMesh: 4 })
  const Creep = await loadAdapter([
    [
      "        const jf = p.changeOf[f]\n",
      "        const jf = (() => { const j = p.changeOf[f]; const a = p.changes[j]; const b = j + 1 < p.changes.length ? p.changes[j + 1] : a; return b > a ? j + (f - a) / (b - a) : j })()\n",
      "drawin-glb.ts",
    ],
  ])
  const creep = await exportAnimated(Creep, { frames: paused, maxTargetsPerMesh: 4 })
  const r = rowsIn(real.res, cut, cut + PAUSE + 1)
  const c = rowsIn(creep.res, cut, cut + PAUSE + 1)
  paired(
    "through a 20-frame pen pause every weight row is the same (4 targets a mesh, so states are blended)",
    () => r === 1 && real.res.animation.meshes.every((m) => m.targets.length <= 4),
    "the previous build, blending by frame index, holds too",
    () => c === 1,
    `distinct rows per mesh across the pause: ${r} · frame-index blend: ${c}`,
  )
}

rmSync(DIR, { recursive: true, force: true })
console.log(`\nassert-export-glb-anim: ${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)

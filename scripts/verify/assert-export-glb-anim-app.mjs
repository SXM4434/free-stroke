// assert-export-glb-anim-app.mjs · THE ANIMATED GLB, DRIVEN THE WAY A USER DRIVES IT.
//
// Two real strokes on Rod, the Video panel at 24 fps, then the real GLB button
// and the real Anim GLB button. Both downloads are read by an independent GLB
// reader (`lib/glb-walk.mjs`) and by three's GLTFLoader with an AnimationMixer,
// which is what a three-based GLB viewer runs. "Live" is the app itself: its
// own PNG export (transparent, 1x) with the playhead at the first and last
// planned instants, and its own static GLB for the finished geometry.
//
// Rows, each with an arm that MUST fail:
//   decodes          our reader and three's loader read it, one clip "draw-in"
//                                    | the same file cut to 60%
//   count            one keyframe per planned frame at the plan's times
//                                    | the DISTINCT weight rows number the plan too
//   size             last keyframe's bounds are the static GLB's
//                                    | first keyframe's bounds are too
//   first and last   live draws at most Rod's one-ring start dot (under 1% of the
//                    mark's ink) at the first instant and the GLB's first
//                    keyframe has no area; live draws the mark at the last and
//                    the GLB's last keyframe IS the static GLB, to 1e-6
//                                    | the parked known-bad: the whole mark on every
//                                      frame (window.__fsAnimGlbReveal = "off")
//   growth           area never shrinks and mid-take is partly drawn
//                                    | the same known-bad
//   viewer           three's AnimationMixer puts the file's weights on the meshes
//                                    | its weights at mid-take equal the first
//   Solid (fused)    the same two strokes on Solid, whose export is ONE mesh for
//                    both: first keyframe no area, last keyframe the static
//                    Solid GLB's surface, hidden triangles never drawn
//                                    | the same known-bad on Solid
//
//   FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-export-glb-anim-app.mjs [--keep]
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { makePaired } from "./lib/paired.mjs"
import { readGlb, weightsAt, morphed, areaOf, boundsOf, cornersOf } from "./lib/glb-walk.mjs"
import { openApp, clickDownload, inPanel, stillRgba, parsePlanNote } from "./lib/export-app.mjs"

const TMP = mkdtempSync(join(tmpdir(), "fs-glbanimapp-"))
const KEEP = process.argv.includes("--keep")

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
const paired = makePaired(row)

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
const boundsEq = (a, b, eps = 1e-6) => [0, 1, 2].every((c) => Math.abs(a.min[c] - b.min[c]) <= eps && Math.abs(a.max[c] - b.max[c]) <= eps)
const alphaInk = (px) => {
  let n = 0
  for (let i = 3; i < px.length; i += 4) if (px[i] > 0) n++
  return n
}

const { browser, page, pageErrors } = await openApp({ tmp: TMP })
try {
  /* Two strokes, back to back, so the take has a reveal across strokes. */
  const box = await page.locator('canvas[aria-label*="Drawing canvas"]').boundingBox()
  const stroke = async (x0, y0, x1, y1, arc) => {
    await page.mouse.move(box.x + box.width * x0, box.y + box.height * y0)
    await page.mouse.down()
    for (let i = 1; i <= 16; i++) {
      const t = i / 16
      await page.mouse.move(box.x + box.width * (x0 + t * (x1 - x0)), box.y + box.height * (y0 + t * (y1 - y0) - arc * Math.sin(t * Math.PI)))
      await page.waitForTimeout(20)
    }
    await page.mouse.up()
  }
  await stroke(0.12, 0.45, 0.46, 0.45, 0.16)
  await stroke(0.54, 0.62, 0.88, 0.62, -0.12)
  await page.waitForTimeout(2500)
  const info = await page.evaluate(() => ({ pen: window.__revealHarness.getTotalDuration(), strokes: window.__fsSchedule?.strokeCount ?? null }))
  row(info.pen > 200 && info.strokes === 2, "two real strokes were drawn", `totalDuration=${info.pen.toFixed(1)} ms · schedule strokes ${info.strokes}`)

  const order = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("button")].map((b) => b.textContent.trim())
    return ["PNG", "Video", "GIF", "GLB", "Anim GLB"].map((l) => labels.indexOf(l))
  })
  row(
    order.every((i) => i >= 0) && order.every((v, i) => i === 0 || v > order[i - 1]),
    "the export bar carries Anim GLB right after GLB, no new panel",
    `order ${order.join(" < ")}`,
  )

  let note = ""
  await inPanel(page, "Video export settings", async () => {
    await page.locator('button:has-text("24")').first().click()
    await page.waitForTimeout(150)
    note = await page.locator("text=the time this took you to draw").first().innerText().catch(() => "")
  })
  const plan = parsePlanNote(note)
  console.log(`  panel: ${JSON.stringify(note)}`)
  await page.evaluate(() => {
    window.__revealHarness.setEase("linear")
    window.__revealHarness.setPlaying(false)
  })

  const glbBtn = page.locator("button", { hasText: /^GLB$/ })
  const animBtn = page.locator("button", { hasText: /^Anim GLB$/ })
  const stat = await clickDownload(page, glbBtn, TMP, "static")
  const anim = await clickDownload(page, animBtn, TMP, "anim")
  const toast = await page.locator("[data-sonner-toast]").last().innerText().catch(() => "")
  console.log(`  static ${stat.name} · animated ${anim.name}`)
  console.log(`  toast: ${JSON.stringify(toast.replace(/\s+/g, " ").slice(0, 260))}`)
  row(/_anim_.*\.glb$/.test(anim.name), "the animated file follows the app's naming law and is a .glb", anim.name)
  await page.evaluate(() => {
    window.__fsAnimGlbReveal = "off"
  })
  const bad = await clickDownload(page, animBtn, TMP, "anim-reveal-off")
  await page.evaluate(() => {
    delete window.__fsAnimGlbReveal
  })

  /* live: the PNG export, transparent, at 1x */
  await inPanel(page, "PNG export settings", async () => {
    await page.locator('button:has-text("1×")').first().click()
    await page.getByRole("button", { name: "Transparent", exact: true }).click()
  })
  const pngBtn = page.locator("button", { hasText: /^PNG$/ })
  const liveAt = async (p, tag) => {
    await page.evaluate((v) => window.__revealHarness.setProgress(v), p)
    await page.waitForTimeout(400)
    return stillRgba((await clickDownload(page, pngBtn, TMP, tag)).path)
  }
  const liveFirst = await liveAt(0, "live-first")
  const liveLast = await liveAt(1, "live-last")

  const bytes = readFileSync(anim.path)
  let glb = null
  let loaded = null
  let err = ""
  try {
    glb = readGlb(bytes)
    loaded = await new Promise((resolve, reject) => new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "", resolve, reject))
  } catch (e) {
    err = e.message
  }

  /* decodes */
  paired(
    "our reader and three's GLTFLoader both read the animated GLB, one clip named draw-in",
    () => !!glb && !!loaded && glb.animations.length === 1 && loaded.animations[0]?.name === "draw-in",
    "the same file cut to 60% reads too",
    () => {
      try {
        readGlb(bytes.subarray(0, Math.floor(bytes.length * 0.6)))
        return true
      } catch {
        return false
      }
    },
    glb ? `${bytes.length} bytes · ${glb.prims.length} primitives · ${glb.animations[0]?.channels.length} channels · three: ${loaded?.animations.length} clip` : err,
  )
  if (!glb) throw new Error(`cannot continue: ${err}`)

  /* count */
  {
    const a = glb.animations[0]
    const fps = plan.fps
    const timesOk = a.channels.every((c) => c.input.count === plan.frames && Array.from(c.input.data).every((t, i) => Math.abs(t - i / fps) < 1e-4))
    const rows = new Set()
    for (const ch of a.channels) {
      const n = ch.output.count / ch.input.count
      for (let k = 0; k < ch.input.count; k++) rows.add(`${ch.node}:` + Array.from(ch.output.data.subarray(k * n, k * n + n)).join(","))
    }
    const distinct = rows.size / a.channels.length
    paired(
      "one keyframe per planned frame on every channel, at the plan's times",
      () => timesOk && a.channels.every((c) => c.path === "weights"),
      "the DISTINCT weight rows per channel number the plan too (a coalescing writer's count)",
      () => distinct === plan.frames,
      `plan ${plan.frames} frames at ${fps} fps · keyframes ${a.channels.map((c) => c.input.count).join("/")} · distinct per channel ${distinct.toFixed(1)}`,
    )
  }

  const statGlb = readGlb(readFileSync(stat.path))
  const S = poseAt(statGlb, null)
  const N = glb.animations[0].channels[0].input.count
  const first = poseAt(glb, 0)
  const last = poseAt(glb, N - 1)
  /* size */
  paired(
    "the last keyframe's bounds are the static GLB's bounds",
    () => boundsEq(last.bounds, S.bounds),
    "the first keyframe's bounds are too",
    () => boundsEq(first.bounds, S.bounds),
    `static ${S.bounds.min.map((v) => v.toFixed(3))} / ${S.bounds.max.map((v) => v.toFixed(3))} · last ${last.bounds.min.map((v) => v.toFixed(3))} / ${last.bounds.max.map((v) => v.toFixed(3))} · first max ${first.bounds.max.map((v) => v.toFixed(3))}`,
  )

  /* first and last match live */
  const badGlb = readGlb(readFileSync(bad.path))
  const bFirst = poseAt(badGlb, 0)
  const bN = badGlb.animations[0]?.channels[0]?.input.count ?? 0
  {
    const inkFirst = alphaInk(liveFirst.rgba)
    const inkLast = alphaInk(liveLast.rgba)
    const d = maxAbs(last.corners, S.corners)
    /* ⚠ LIVE ROD IS NOT QUITE EMPTY AT PLAYHEAD 0, measured on this gate's
     * first run: 21 ink px against 4421 at the end. On the identity path a
     * stroke counts as started at `t == tStart` and Rod draws one ring of it
     * (`visibleRings = ringIndex + 1`), the triangles from ring 0 to ring 1.
     * Under a non-identity schedule the same instant draws nothing, and so do
     * the spans the GLB follows. So the row bounds live's first frame to that
     * one-ring dot (under 1% of the finished mark's ink) and requires the GLB's
     * first keyframe to have no area; the dot is an open question in LOG.md. */
    const ok = (f, dLast) => inkFirst <= inkLast * 0.01 && f.area <= S.area * 1e-9 && inkLast > 0 && dLast <= 1e-6
    paired(
      "first instant: live draws at most Rod's one-ring start dot and the GLB's first keyframe has no area; last: live draws the mark and the GLB's last keyframe is the static GLB",
      () => ok(first, d),
      "the parked known-bad (the whole mark on every frame) matches live too",
      () => ok(bFirst, maxAbs(poseAt(badGlb, bN - 1).corners, S.corners)),
      `live first ${inkFirst} ink px (${((inkFirst / Math.max(1, alphaInk(liveLast.rgba))) * 100).toFixed(2)}% of last) · GLB first area ${first.area.toExponential(2)} of ${S.area.toFixed(4)} · live last ${inkLast} ink px · GLB last max |d| ${d.toExponential(2)} · known-bad first area ${bFirst.area.toFixed(4)}`,
    )
  }

  /* growth */
  {
    const areas = []
    for (let k = 0; k < N; k++) areas.push(poseAt(glb, k).area)
    const bAreas = []
    for (let k = 0; k < bN; k++) bAreas.push(poseAt(badGlb, k).area)
    const grows = (a) => a.length > 2 && a.every((v, i) => i === 0 || v >= a[i - 1] - S.area * 1e-6)
    const midOf = (a) => a[Math.floor(a.length / 2)] / S.area
    paired(
      "visible area never shrinks keyframe to keyframe, and mid-take is partly drawn",
      () => grows(areas) && midOf(areas) > 0.05 && midOf(areas) < 0.95,
      "the parked known-bad does the same",
      () => grows(bAreas) && midOf(bAreas) > 0.05 && midOf(bAreas) < 0.95,
      `area ${areas[0].toExponential(1)} -> mid ${(midOf(areas) * 100).toFixed(1)}% -> ${((areas[N - 1] / S.area) * 100).toFixed(1)}% · known-bad: ${bAreas.length ? `mid ${(midOf(bAreas) * 100).toFixed(1)}%` : "no animation at all, nothing is ever hidden"}`,
    )
  }

  /* viewer */
  {
    const scene = loaded.scene
    const clip = loaded.animations[0]
    const meshes = []
    scene.traverse((o) => o.isMesh && o.morphTargetInfluences && meshes.push(o))
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
    const a = glb.animations[0]
    const ours = (k) => a.channels.map((ch) => Array.from(ch.output.data.subarray(k * (ch.output.count / ch.input.count), (k + 1) * (ch.output.count / ch.input.count))))
    const diff = (x, y) => {
      if (x.length !== y.length) return Infinity
      let m = 0
      x.forEach((r, i) => r.forEach((v, j) => (m = Math.max(m, Math.abs(v - (y[i]?.[j] ?? NaN))))))
      return Number.isNaN(m) ? Infinity : m
    }
    const times = a.channels[0].input.data
    const d0 = diff(at(times[0]), ours(0))
    const dN = diff(at(times[N - 1]), ours(N - 1))
    const dMid = diff(at(times[Math.floor(N / 2)]), ours(0))
    paired(
      "three's AnimationMixer binds every track and puts the file's weights on the meshes at the first and last keyframes",
      () => meshes.length === a.channels.length && d0 <= 1e-6 && dN <= 1e-6,
      "the mixer's weights at mid-take equal the first keyframe's",
      () => dMid <= 1e-6,
      `${meshes.length} animated meshes bound of ${a.channels.length} channels · first ${d0.toExponential(1)} · last ${dN.toExponential(1)} · mid vs first ${dMid.toFixed(3)}`,
    )
  }

  /* ---- Solid: a fused mesh, through the real button ------------------ */
  {
    await page.evaluate(() => window.__styleHarness.setMode("solid"))
    await page.waitForTimeout(4000)
    const sStat = readGlb(readFileSync((await clickDownload(page, glbBtn, TMP, "solid-static")).path))
    const sAnim = readGlb(readFileSync((await clickDownload(page, animBtn, TMP, "solid-anim")).path))
    await page.evaluate(() => {
      window.__fsAnimGlbReveal = "off"
    })
    const sBad = readGlb(readFileSync((await clickDownload(page, animBtn, TMP, "solid-anim-off")).path))
    await page.evaluate(() => {
      delete window.__fsAnimGlbReveal
    })
    const SS = poseAt(sStat, null)
    const K = sAnim.animations[0]?.channels[0]?.input.count ?? 0
    const s0 = poseAt(sAnim, 0)
    const sN = poseAt(sAnim, Math.max(0, K - 1))
    const b0 = poseAt(sBad, 0)
    /* Triangles with all three corners moved, at stored states only. */
    let hidden = 0
    const anim = sAnim.animations[0]
    for (let k = 0; k < K; k++) {
      for (const pr of sAnim.prims) {
        const w = weightsAt(anim, pr.node, k, pr.targets.length)
        if (!w) continue
        const nz = Array.from(w).filter((x) => x !== 0)
        if (!(nz.length === 0 || (nz.length === 1 && nz[0] === 1))) continue
        const base = cornersOf(pr, morphed(pr, null))
        const pos = cornersOf(pr, morphed(pr, w))
        for (let t = 0; t < pos.length; t += 9) {
          let moved = 0
          for (let c = 0; c < 3; c++) if (Math.hypot(pos[t + c * 3] - base[t + c * 3], pos[t + c * 3 + 1] - base[t + c * 3 + 1], pos[t + c * 3 + 2] - base[t + c * 3 + 2]) > 1e-9) moved++
          if (moved < 3) continue
          const ax = pos[t + 3] - pos[t], ay = pos[t + 4] - pos[t + 1], az = pos[t + 5] - pos[t + 2]
          const bx = pos[t + 6] - pos[t], by = pos[t + 7] - pos[t + 1], bz = pos[t + 8] - pos[t + 2]
          hidden += 0.5 * Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx)
        }
      }
    }
    const same = Math.abs(sN.area - SS.area) <= SS.area * 1e-6 && boundsEq(sN.bounds, SS.bounds)
    paired(
      "Solid (one fused mesh): first keyframe no area, last keyframe the static Solid GLB's surface, hidden triangles never drawn at a stored state",
      () => sAnim.prims.length === 1 && K > 2 && s0.area <= SS.area * 1e-9 && same && hidden <= SS.area * 1e-9,
      "the parked known-bad on Solid does the same",
      () => b0.area <= SS.area * 1e-9,
      `${sAnim.prims.length} mesh · ${sAnim.prims[0]?.position.count} corners (static ${SS.corners.length / 3}) · ${K} keyframes · first area ${s0.area.toExponential(2)} · last area ${sN.area.toFixed(5)} vs static ${SS.area.toFixed(5)}, bounds equal ${boundsEq(sN.bounds, SS.bounds)} · hidden-triangle area over stored states ${hidden.toExponential(2)} · known-bad first area ${b0.area.toFixed(4)}`,
    )
  }

  row(pageErrors.length === 0, "no page errors", pageErrors.slice(0, 2).join(" | ") || "0 errors")
} finally {
  await browser.close()
  if (!KEEP) rmSync(TMP, { recursive: true, force: true })
  else console.log(`kept ${TMP}`)
}
console.log(`\nassert-export-glb-anim-app: ${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)

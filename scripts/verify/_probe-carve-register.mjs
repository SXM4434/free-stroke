// _PROBE-CARVE-REGISTER — is the pen field an ENVELOPE of the mesh, or not?
//
// `_probe-carve-sweep-live.mjs` measured the carve at 0.001 — the TUBE channel
// with essentially none of the pen in it — removing 38.3 % of the mark and
// taking it from 7 connected components to 16. The carve's founding claim is the
// opposite (`lib/flat-ink.ts`, PEN_FIELD_TUBE_SLACK: *"a field baked at exactly
// R would bite into the form the moment it was switched on at zero strength"*,
// 1.35 chosen to clear it). So either the field is mis-REGISTERED against the
// mesh, or it is registered and simply too small.
//
// Those are different bugs with different fixes, and the difference is one
// measurement: the mesh's own bounding box in the flatten group's LOCAL frame,
// against the field's box in that same frame (`__heroPenField.boxLocal`).
//
// Usage: node scripts/verify/_probe-carve-register.mjs [--engine=free-stroke]
import { chromium } from "playwright-core"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const ENGINE = arg("engine", "free-stroke")
const OUT = join(ROOT, "docs", "verification", "drawin-holes")

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] })
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.on("pageerror", (e) => console.log("PAGE ERROR", String(e).slice(0, 200)))
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)
  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(3500)

  /* THE POSE, SET AND RECORDED — 2026-08-07.
   *
   * Explainer 39 §3.3 names this file as one of two that "publish a number at a
   * pose they do not record": `:48` clicked the engine and `:51` drove the
   * carve, and whatever beat the page happened to be on after the waits WAS the
   * pose. The engine is state; the PLAYHEAD is a different axis and nothing here
   * ever touched it. It is read and published beside the table now, so a reading
   * is attributable to a frame instead of to a wall-clock timeout. */
  const pose = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-phase]")
    const scrub = document.querySelector("[data-hero-scrub]")
    return {
      phase: el?.getAttribute("data-hero-phase") ?? null,
      phaseT: el ? Number(el.getAttribute("data-hero-phase-t")) : null,
      carve: el ? Number(el.getAttribute("data-hero-carve")) : null,
      carveLaw: el?.getAttribute("data-hero-carve-law") ?? null,
      scrub: scrub ? Number(scrub.value) : null,
    }
  })
  console.log(`[pose] ${JSON.stringify(pose)}   engine=${ENGINE}`)

  /* The carve has to be ON once, or the field is never baked (it is lazy).
   * AND THE ARM READS WHAT THE DRIVER RETURNED — explainer 39 §4 rule 1. A
   * refused arm bakes no field, and every number below would then describe a
   * field that was never built, under a filename that says it was. */
  const took = await page.evaluate(() => window.__captureHarness.setFlatten({ penCarve: 0.5 }))
  if (took !== true) {
    console.error(`REFUSED — setFlatten({penCarve: 0.5}) returned ${took}. The field is not baked; there is nothing to register.`)
    writeFileSync(join(OUT, `register-${ENGINE}.json`), JSON.stringify({ error: "setFlatten refused", returned: took, pose }, null, 2))
    await context.close()
    await browser.close()
    process.exit(1)
  }
  await page.waitForTimeout(1200)

  const res = await page.evaluate(() => {
    const w = window
    const pf = w.__heroPenField
    /* THE SCENE, THROUGH R3F'S OWN CANVAS HANDLE. `__r3f` is attached to the
     * canvas element by the renderer; reading it is read-only and touches
     * nothing. Fall back to walking every canvas until one has it.
     *
     * 🔴 WHEN THIS FAILS IT NOW SAYS WHAT IT LOOKED FOR AND WHAT IT FOUND.
     * Run bare on 2026-08-07 this probe printed `{"error":"no r3f scene found"}`
     * and **exited 0**, having written that error object into
     * `register-free-stroke.json` under a success code — so the published table
     * below had been silently skipped by the `if (res.penField && res.meshLocal)`
     * guard, and a downstream reader could not tell a missing measurement from a
     * measurement of zero. A census that cannot describe its own failure is the
     * same defect this file was written to measure, one level up. */
    const canvases = []
    let root = null
    for (const c of document.querySelectorAll("canvas")) {
      const r3f = c.__r3f
      const store = r3f?.store ?? r3f?.root?.getState?.() ?? null
      const st = store?.getState ? store.getState() : store
      canvases.push({ w: c.width, h: c.height, hasR3f: !!r3f, ownKeys: Object.keys(c).slice(0, 8), hasScene: !!st?.scene })
      if (st?.scene && !root) root = st.scene
    }
    if (!root) {
      return {
        error: "no r3f scene found",
        lookedFor: "`__r3f` on a <canvas>, then `.store` / `.root.getState?.()`, then `.scene`",
        found: canvases,
      }
    }

    // The flatten group is the ancestor the carve inverts by. Find it as the
    // object whose children include a group containing the tube meshes — it is
    // the one the frame loop writes scale.z on.
    let flat = null
    root.traverse((o) => {
      if (flat) return
      if (o.type === "Group" && o.children.length === 1 && o.children[0].type === "Group") {
        let meshes = 0
        o.children[0].traverse((q) => { if (q.isMesh) meshes++ })
        if (meshes > 0) flat = o
      }
    })
    if (!flat) return { error: "no flatten group found" }

    flat.updateWorldMatrix(true, true)
    const inv = flat.matrixWorld.clone().invert()
    const bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9, n: 0, verts: 0 }
    const v = new (root.constructor.prototype.constructor === Object ? Object : Object)()
    // three is not importable here; use the objects' own classes off an existing
    // vector to stay dependency free.
    const meshList = []
    flat.traverse((o) => { if (o.isMesh && o.geometry?.attributes?.position) meshList.push(o) })
    for (const m of meshList) {
      m.updateWorldMatrix(true, false)
      const pos = m.geometry.attributes.position
      const mw = m.matrixWorld
      const e = mw.elements
      const ie = inv.elements
      bb.n++
      const step = Math.max(1, Math.floor(pos.count / 4000))
      for (let i = 0; i < pos.count; i += step) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
        // world = mw * p
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12]
        const wy = e[1] * x + e[5] * y + e[9] * z + e[13]
        const wz = e[2] * x + e[6] * y + e[10] * z + e[14]
        // local = inv * world
        const lx = ie[0] * wx + ie[4] * wy + ie[8] * wz + ie[12]
        const ly = ie[1] * wx + ie[5] * wy + ie[9] * wz + ie[13]
        if (lx < bb.x0) bb.x0 = lx
        if (lx > bb.x1) bb.x1 = lx
        if (ly < bb.y0) bb.y0 = ly
        if (ly > bb.y1) bb.y1 = ly
        bb.verts++
      }
    }
    return {
      penField: pf,
      meshLocal: bb,
      flatScale: [flat.scale.x, flat.scale.y, flat.scale.z],
      flatPos: [flat.position.x, flat.position.y, flat.position.z],
      meshes: meshList.length,
    }
  })

  console.log(JSON.stringify(res, null, 2))

  /* 🔴 A MISSING MEASUREMENT IS NOT A MEASUREMENT OF ZERO — added 2026-08-07.
   *
   * `if (res.penField && res.meshLocal)` below is the whole published table, and
   * when the scene walk returns an error object that condition is simply false:
   * the table never printed, `register-<engine>.json` was written containing
   * `{"error": …}`, and the process exited **0**. Measured first-hand on this
   * tree — the run printed `{ "error": "no r3f scene found" }` and returned
   * success. Every consumer of that file, and every sweep reading this exit
   * code, was told the probe had run.
   *
   * "A `.catch(() => exit(1))` explicitly does not count: that says the script
   * CRASHED, never that the subject failed" — `assert-gate-integrity` channel B,
   * quoted in explainer 27 §4. This is the same distinction from the other side:
   * a probe that cannot reach its subject must say so in its exit code, or a
   * battery counts silence as agreement. */
  if (res.error) {
    console.error(
      `\n🔴 NO MEASUREMENT. ${res.error}\n` +
        `   looked for: ${res.lookedFor ?? "(not recorded)"}\n` +
        `   found:      ${JSON.stringify(res.found ?? null)}\n` +
        `   pose:       ${JSON.stringify(pose)}\n` +
        `   Nothing below this line ran. The JSON is written so the failure is inspectable,\n` +
        `   and the exit code is NON-ZERO so nothing reads it as a result.`,
    )
    writeFileSync(join(OUT, `register-${ENGINE}.json`), JSON.stringify({ ...res, pose }, null, 2))
    await context.close()
    await browser.close()
    process.exit(1)
  }

  if (res.penField && res.meshLocal) {
    const [xA, yA, xB, yB] = res.penField.boxLocal
    const u = res.penField.localUnitsPerStrokeUnit
    const pad = res.penField.radius * (1.35 + 1) * u
    console.log(`\nunits/stroke-unit ${u}`)
    console.log(`FIELD box local        x [${xA.toFixed(4)}, ${xB.toFixed(4)}]  y [${Math.min(yA, yB).toFixed(4)}, ${Math.max(yA, yB).toFixed(4)}]`)
    console.log(`FIELD centreline bbox  x [${(xA + pad).toFixed(4)}, ${(xB - pad).toFixed(4)}]  y [${(Math.min(yA, yB) + pad).toFixed(4)}, ${(Math.max(yA, yB) - pad).toFixed(4)}]`)
    const b = res.meshLocal
    console.log(`MESH  bbox local       x [${b.x0.toFixed(4)}, ${b.x1.toFixed(4)}]  y [${b.y0.toFixed(4)}, ${b.y1.toFixed(4)}]`)
    const clW = xB - pad - (xA + pad)
    const clH = Math.max(yA, yB) - pad - (Math.min(yA, yB) + pad)
    console.log(`\ncentreline extent (field)  ${clW.toFixed(4)} x ${clH.toFixed(4)}`)
    console.log(`mesh extent                ${(b.x1 - b.x0).toFixed(4)} x ${(b.y1 - b.y0).toFixed(4)}`)
    const halfX = ((b.x1 - b.x0) - clW) / 2
    const halfY = ((b.y1 - b.y0) - clH) / 2
    console.log(`\nIMPLIED MESH HALF-WIDTH (x) ${halfX.toFixed(5)} local = ${(halfX / u).toFixed(2)} stroke units`)
    console.log(`IMPLIED MESH HALF-WIDTH (y) ${halfY.toFixed(5)} local = ${(halfY / u).toFixed(2)} stroke units`)
    console.log(`FIELD nominal R             ${res.penField.radius.toFixed(2)} stroke units`)
    console.log(`FIELD tube channel boundary ${(res.penField.radius * 1.35).toFixed(2)} stroke units (1.35 R)`)
  }
  writeFileSync(join(OUT, `register-${ENGINE}.json`), JSON.stringify({ ...res, pose }, null, 2))
  await context.close()
  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })

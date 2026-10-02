/* ============================================================================
 * assert-keyed-playback.mjs: REVIEW.md "Review 1: layout and keyed style",
 * findings 1, 2, 5, 6, 7, 10 and 11, the parts Node can reach.
 *
 *   node scripts/verify/assert-keyed-playback.mjs              rows, then every mutant
 *   node scripts/verify/assert-keyed-playback.mjs --rows-only  rows only (a mutant child runs this)
 *
 * Node only, through scripts/verify/_ts-load.mjs. Mutants go through
 * GATE_MUTATE_FILE, so nothing on disk changes. Exits 0 only when every row
 * passes, every mutant turns its rows red, and every row has a mutant.
 *
 * What a browser has to show (the 3D canvas and a film's frames changing with
 * a keyed value) is scripts/verify/assert-keyed-playback-live.mjs.
 * ========================================================================== */
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")

const rows = []
const row = (id, ok, what, detail) => rows.push({ id, ok: !!ok, what, detail })
function check(id, what, fn) {
  try {
    fn()
  } catch (e) {
    row(id, false, what, `threw: ${e && e.message}`)
  }
}
const lin = (tMs, value, easeOut = "linear") => ({ tMs, value, easeOut, easeIn: "linear" })

/* A seeded generator, so a red row names the same input every run. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function runRows() {
  const K = loadTs("lib/keyframes.ts")
  const S = loadTs("lib/style-system.ts")
  const base = S.DEFAULT_STYLE_STATE

  /* ---- F1-LOOP: a keyed loop speed read through loopPhaseAt --------------
   * Frames of random length (8 to 60 ms) walk the key clock from 0 to 4 s
   * over a speed held at 1 that steps to 3 at 2 s, then ramps to 0.5. The
   * loop's travel, the sum of loopSpeedOver times each step, must equal
   * loopPhaseAt at every frame (the area under the speed): the step inside a
   * frame is neither skipped nor overshot. Unkeyed, loopSpeedOver is the doc's
   * speed exactly. */
  check("F1-LOOP", "a keyed loop speed travels the area under its curve, however the frames fall", () => {
    const keys = K.acceptKeys({ textureSpeed: [lin(0, 1, "hold"), lin(2000, 3), lin(3500, 0.5)] })
    const r = rng(20261002)
    let worst = 0
    let worstAt = null
    let frames = 0
    for (let run = 0; run < 40; run++) {
      let c = 0
      let travel = 0
      while (c < 4000) {
        const step = 8 + r() * 52
        const next = c + step
        travel += (K.loopSpeedOver(base, keys, "textureSpeed", c, next) * step) / 1000
        c = next
        frames++
        const want = K.loopPhaseAt(base, keys, "textureSpeed", c)
        const err = Math.abs(travel - want)
        if (err > worst) {
          worst = err
          worstAt = { clockMs: +c.toFixed(2), travel: +travel.toFixed(6), want: +want.toFixed(6) }
        }
      }
    }
    const flat = [[0, 16], [100, 133], [5, 4000]].every(([a, b]) => K.loopSpeedOver(base, undefined, "textureSpeed", a, b) === base.textureSpeed)
    const paused = K.loopSpeedOver(base, keys, "textureSpeed", 2500, 2500) === K.styleAt(base, keys, 2500).textureSpeed
    row("F1-LOOP", worst < 1e-6 && flat && paused, "a keyed loop speed travels the area under its curve, however the frames fall",
      `${frames} frames over 40 runs, worst |travel - loopPhaseAt| ${worst.toExponential(2)} ${JSON.stringify(worstAt)}; unkeyed is the doc's speed: ${flat}; paused reads the speed at the clock: ${paused}`)
  })

  /* ---- F1-GLB: keyed material values ride the animated GLB --------------- */
  check("F1-GLB", "keyed material values become KHR_animation_pointer channels on the draw-in clip", () => {
    const G = loadTs("lib/export/glb-sparse.ts")
    const M = loadTs("lib/export/glb-material-keys.ts")
    // A minimal file: two materials (one with clearcoat written, one without), a draw-in clip.
    const json = {
      asset: { version: "2.0" },
      materials: [
        { pbrMetallicRoughness: { roughnessFactor: 0.9, metallicFactor: 0 } },
        { pbrMetallicRoughness: { roughnessFactor: 0.9, metallicFactor: 0 }, extensions: { KHR_materials_clearcoat: { clearcoatFactor: 0.5 } } },
      ],
      accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: "SCALAR" }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
      buffers: [{ byteLength: 4 }],
      animations: [{ name: "draw-in", samplers: [], channels: [] }],
    }
    const glb = G.writeGlb(json, new Uint8Array([0, 0, 128, 63]))
    const times = [0, 0.5, 1, 1.5]
    const rough = [0.1, 0.4, 0.7, 0.9]
    const coat = [0, 0.25, 0.5, 0.5]
    const res = M.addMaterialTracks(glb, times, [
      { field: "roughness", values: rough },
      { field: "clearcoat", values: coat },
      { field: "metalness", values: [0, 0, 0, 0] },
      { field: "sheen", values: [0, 1, 1, 1] },
    ], "draw-in")
    const back = G.readGlb(res.glb)
    const j = back.json
    const dv = new DataView(back.bin.buffer, back.bin.byteOffset, back.bin.byteLength)
    const read = (a) => {
      const acc = j.accessors[a]
      const v = j.bufferViews[acc.bufferView]
      return Array.from({ length: acc.count }, (_, i) => dv.getFloat32((v.byteOffset ?? 0) + (acc.byteOffset ?? 0) + i * 4, true))
    }
    const anim = j.animations.find((a) => a.name === "draw-in")
    const chans = anim.channels.map((c) => ({ pointer: c.target.extensions.KHR_animation_pointer.pointer, s: anim.samplers[c.sampler] }))
    const near = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-6)
    const want = [
      ["/materials/0/pbrMetallicRoughness/roughnessFactor", rough],
      ["/materials/1/pbrMetallicRoughness/roughnessFactor", rough],
      ["/materials/0/extensions/KHR_materials_clearcoat/clearcoatFactor", coat],
      ["/materials/1/extensions/KHR_materials_clearcoat/clearcoatFactor", coat],
    ]
    const found = want.filter(([p, v]) => chans.some((c) => c.pointer === p && near(read(c.s.output), v) && near(read(c.s.input), times) && c.s.interpolation === "LINEAR"))
    const extAdded = typeof j.materials[0].extensions?.KHR_materials_clearcoat?.clearcoatFactor === "number"
    const used = (j.extensionsUsed ?? []).includes("KHR_animation_pointer") && j.extensionsUsed.includes("KHR_materials_clearcoat")
    const noFlat = !chans.some((c) => c.pointer.endsWith("metallicFactor"))
    const sheenNamed = res.dropped.some((d) => d.field === "sheen" && /no sheen weight/.test(d.reason))
    const ok = found.length === want.length && chans.length === want.length && extAdded && used && noFlat && sheenNamed && res.channels === 4
    row("F1-GLB", ok, "keyed material values become KHR_animation_pointer channels on the draw-in clip",
      `${found.length}/${want.length} channels hold the keyed values at the frame times (${chans.length} written); clearcoat extension added where missing: ${extAdded}; extensionsUsed: ${used}; an unkeyed value adds none: ${noFlat}; sheen named as not in glTF: ${sheenNamed}`)
  })
}

/* ---- the must-fails ----------------------------------------------------- */
const MUTANTS = [
  { name: "the loop runs on the speed at the frame's end", file: "lib/keyframes.ts", find: "  return ((loopPhaseAt(state, keys, speedPath, toMs) - loopPhaseAt(state, keys, speedPath, fromMs)) * 1000) / step\n", text: "  return valueAt(track, toMs)!\n", red: ["F1-LOOP"] },
  { name: "the loop's mean speed is read over the wrong span", file: "lib/keyframes.ts", find: "  return ((loopPhaseAt(state, keys, speedPath, toMs) - loopPhaseAt(state, keys, speedPath, fromMs)) * 1000) / step\n", text: "  return ((loopPhaseAt(state, keys, speedPath, toMs) - loopPhaseAt(state, keys, speedPath, fromMs)) * 1000) / (step * 1.01)\n", red: ["F1-LOOP"] },
  { name: "the GLB writes no material channel", file: "lib/export/glb-material-keys.ts", find: "      anim!.channels.push({", text: "      if (false) anim!.channels.push({", red: ["F1-GLB"] },
  { name: "the GLB points a channel at an extension the file does not have", file: "lib/export/glb-material-keys.ts", find: "        const e = (exts[p.ext] ??= {})\n", text: "        const e = exts[p.ext] ?? {}\n", red: ["F1-GLB"] },
  { name: "the GLB writes a value that never changes", file: "lib/export/glb-material-keys.ts", find: "    if (!varies(t.values)) return false\n", text: "\n", red: ["F1-GLB"] },
]

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-keyed-playback-mut-"))
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const src = readFileSync(join(ROOT, m.file), "utf8")
      const at = src.indexOf(m.find)
      if (at < 0 || src.indexOf(m.find, at + 1) >= 0) throw new Error(`mutant text not unique in ${m.file}`)
      const jf = join(dir, "m.json")
      writeFileSync(jf, JSON.stringify({ [m.file]: [{ pos: at, end: at + m.find.length, text: m.text, was: m.find }] }))
      const r = spawnSync(process.execPath, [SELF, "--rows-only"], { env: { ...process.env, GATE_MUTATE_FILE: jf }, encoding: "utf8", maxBuffer: 1 << 26 })
      const line = (r.stdout || "").split("\n").find((l) => l.startsWith("ROWS_JSON "))
      if (!line) note = `child did not finish (exit ${r.status}): ${(r.stderr || "").trim().split("\n").slice(-1)[0]}`
      else {
        const got = JSON.parse(line.slice(10))
        const red = m.red.filter((id) => got.find((x) => x.id === id && !x.ok))
        caught = red.length === m.red.length
        note = `red: ${red.join(", ") || "none"} of ${m.red.join(", ")}; other reds: ${got.filter((x) => !x.ok && !m.red.includes(x.id)).map((x) => x.id).join(", ") || "none"}`
      }
    } catch (e) {
      note = `mutant could not be built: ${e.message}`
    }
    out.push({ ...m, caught, note })
  }
  rmSync(dir, { recursive: true, force: true })
  return out
}

/* ---- main ---------------------------------------------------------------- */
try {
  await runRows()
} catch (e) {
  row("RUN", false, "the rows ran to completion", String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e))
}
if (ROWS_ONLY) {
  console.log("ROWS_JSON " + JSON.stringify(rows.map(({ id, ok }) => ({ id, ok }))))
  process.exit(rows.every((r) => r.ok) ? 0 : 1)
}
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(9)} ${r.what}\n      ${r.detail}`)
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
const unguarded = rows.filter((r) => r.id !== "RUN" && !MUTANTS.some((m) => m.red.includes(r.id))).map((r) => r.id)
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught; rows with no must-fail: ${unguarded.join(", ") || "none"}`)
process.exit(pass === rows.length && caught === muts.length && unguarded.length === 0 ? 0 : 1)

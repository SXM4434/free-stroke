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

  /* ---- F2-RELOAD: style keys survive a reload ----------------------------
   * The session doc as the save path writes it, with a textureSpeed track, a
   * customMaterial.roughness track and a turn track, read back through
   * validateSession: all three come back exactly and there is no repair (so no
   * "Restored with repairs" toast). A style key outside its slider's range,
   * and a name that is no keyable property, are still dropped and named. */
  check("F2-RELOAD", "style keys read back on reload, with no repair for a valid one", () => {
    const D = loadTs("lib/doc-store.ts")
    const keys = {
      textureSpeed: [lin(0, 1), lin(1500, 2.5)],
      "customMaterial.roughness": [lin(200, 0.2), lin(900, 0.8)],
      turn: [lin(0, 0), lin(1000, 30)],
    }
    const saved = JSON.parse(JSON.stringify({ ...D.defaultSession(), keys }))
    const v = D.validateSession(saved)
    const same = !!v && JSON.stringify(v.session.keys) === JSON.stringify(keys)
    const clean = !!v && v.repairs.length === 0
    const bad = JSON.parse(JSON.stringify({ ...D.defaultSession(), keys: { ...keys, ditherLevels: [lin(0, 2), lin(500, 40)], notAPath: [lin(0, 1)] } }))
    const vb = D.validateSession(bad)
    const badKeys = vb ? Object.keys(vb.session.keys ?? {}).sort().join(",") : "none"
    const named = !!vb && vb.repairs.some((r) => /keys\.ditherLevels dropped: .*outside 2\.\.8/.test(r)) && vb.repairs.some((r) => /keys\.notAPath: not a keyable property/.test(r))
    row("F2-RELOAD", same && clean && named && badKeys === "customMaterial.roughness,textureSpeed,turn", "style keys read back on reload, with no repair for a valid one",
      `round trip equal: ${same}; repairs on a valid doc: ${v ? v.repairs.length : "none"}${v && v.repairs.length ? " (" + v.repairs.join("; ") + ")" : ""}; with an out-of-range style track and an unknown name, kept ${badKeys}, both named: ${named}`)
  })

  /* ---- F5: a refused key says why, and never takes other keys with it ----
   * EDIT: a preset-shaped edit moves two keyed values at once, textureIntensity
   * to 0.7 (fine) and asciiCellSize to 26 (Slow Code Crawl's value, outside
   * 4..24). textureIntensity gets its key at the playhead, asciiCellSize keeps
   * its track exactly, and the refusal names it in words.
   * WORDS: the review's remove case, keys 0.1 (easeOut {1/3, -1}), 0.15, 1 on
   * textureIntensity: taking the middle one away is refused, and the words say
   * the curve would leave 0 to 1. A key out of range says its number and the
   * range. */
  check("F5-EDIT", "a refused path in a multi-path edit keeps the other paths' keys and names itself", () => {
    const E = loadTs("lib/key-edit.ts")
    const keys = { textureIntensity: [lin(0, 0.2), lin(1000, 0.4)], asciiCellSize: [lin(0, 8), lin(1000, 12)] }
    const prev = { ...base, textureIntensity: 0.3, asciiCellSize: 10 }
    const next = { ...prev, textureIntensity: 0.7, asciiCellSize: 26 }
    const r = E.keyedStyleEdit(prev, next, keys, 500)
    const ti = r?.keys?.textureIntensity
    const keyedTi = !!ti && ti.length === 3 && ti[1].tMs === 500 && ti[1].value === 0.7
    const keptCell = !!r && JSON.stringify(r.keys.asciiCellSize) === JSON.stringify(keys.asciiCellSize)
    const named = !!r && r.refused.length === 1 && r.refused[0].path === "asciiCellSize"
    const words = named ? E.refusalWords("edit", r.refused[0].reasons) : ""
    row("F5-EDIT", keyedTi && keptCell && named && words === "Not keyed: 26 is outside 4 to 24",
      "a refused path in a multi-path edit keeps the other paths' keys and names itself",
      `textureIntensity keyed 0.7 at 500 ms: ${keyedTi}; asciiCellSize track unchanged: ${keptCell}; refused: ${r ? JSON.stringify(r.refused.map((x) => x.path)) : "null"}; words: "${words}"`)
  })
  check("F5-WORDS", "a refused add or remove says why in words", () => {
    const E = loadTs("lib/key-edit.ts")
    const K2 = loadTs("lib/keyframes.ts")
    const three = { textureIntensity: [{ tMs: 0, value: 0.1, easeOut: { x: 1 / 3, y: -1 }, easeIn: "linear" }, lin(500, 0.15), lin(1000, 1)] }
    const accepted = K2.validateKeys(three).length === 0
    const without = E.withoutKeyAt(three, "textureIntensity", 500)
    const bad = K2.validateKeys(without)
    const rm = E.refusalWords("remove", bad.map((b) => b.replace(/^textureIntensity: /, "")))
    const add = E.withKeyAt(undefined, "asciiCellSize", 250, 26)
    const addBad = K2.validateKeys(add).map((b) => b.replace(/^asciiCellSize: /, ""))
    const addWords = E.refusalWords("add", addBad)
    const okRm = accepted && bad.length > 0 && /^Not removed: without this key the curve would swing to -0\.\d+, outside 0 to 1$/.test(rm)
    // A reason it has no words of its own for still shows, as the validator wrote it.
    const other = "key 1 at 0 ms is not after the key before it at 0 ms: unsorted"
    const otherWords = E.refusalWords("add", [other])
    row("F5-WORDS", okRm && addWords === "Not keyed: 26 is outside 4 to 24" && otherWords === `Not keyed: ${other}`, "a refused add or remove says why in words",
      `three keys accepted: ${accepted}; removing the middle: "${rm}"; adding 26 to Cell size: "${addWords}"; any other reason: "${otherWords}"`)
  })

  /* ---- F6-CADENCE: the clock the picture shows under Twos ----------------
   * cadenceClock is the one function live playback and every export step the
   * clock through. On a 2 s take sampled at 30 fps, Twos shows clocks only on
   * 12 Hz steps of take time (each a multiple of 1/24 of the take), 24 of them
   * over the take, each held 2 or 3 frames; Ones gives every clock back as it
   * came. */
  check("F6-CADENCE", "Twos steps the shown clock at 12 Hz of take time; Ones leaves it", () => {
    const SS = loadTs("lib/stroke-schedule.ts")
    const L = 2000
    const clocks = Array.from({ length: 61 }, (_, i) => i / 60)
    const twos = clocks.map((c) => SS.cadenceClock(c, L, "twos"))
    const onStep = twos.every((v) => Math.abs(v * 24 - Math.round(v * 24)) < 1e-9)
    const distinct = new Set(twos.map((v) => v.toFixed(9))).size
    const runs = []
    let run = 1
    for (let i = 1; i < twos.length; i++) {
      if (twos[i] === twos[i - 1]) run++
      else {
        runs.push(run)
        run = 1
      }
    }
    const holds = runs.slice(0, -1).every((r) => r === 2 || r === 3)
    const ones = clocks.every((c) => SS.cadenceClock(c, L, "ones") === c)
    const behind = twos.every((v, i) => v <= clocks[i] + 1e-12 && clocks[i] - v < 1 / 24 + 1e-12)
    row("F6-CADENCE", onStep && distinct === 25 && holds && ones && behind, "Twos steps the shown clock at 12 Hz of take time; Ones leaves it",
      `Twos: on 12 Hz steps ${onStep}, ${distinct} distinct over 61 frames, holds ${[...new Set(runs.slice(0, -1))].join("/")} frames, never ahead and under a step behind ${behind}; Ones unchanged ${ones}`)
  })

  /* ---- F7: the key clock and the readout read the frame loop's playhead --
   * CLOCK: keyClockMs reads the transport's playheadRef, not the readout.
   * THROTTLE: a 2 s pass at 60 fps reports every frame to the throttle on a
   * fake clock; the pass ends (playhead exactly 1) on a frame while a write is
   * pending. The readout lands on 1. A Pause at 1234 ms, mid-period, flushes:
   * the readout is that frame's playhead at once. */
  check("F7-CLOCK", "the key clock is the frame loop's playhead times the keyed length", () => {
    const T = loadTs("lib/take-transport.ts")
    const store = T.createTakeTransport()
    store.publishDerived({ totalDuration: 2000, takeLen: 2000, revealEase: "linear", revealMode: "hybrid", seamWindow: { mode: "grow", length: 1 } })
    store.playheadRef.current = 0.75
    store.progress.set(0.7)
    const ms = T.keyClockMs(store)
    row("F7-CLOCK", ms === 1500 && T.keyClockMs(null) === 0, "the key clock is the frame loop's playhead times the keyed length", `playhead 0.75, readout 0.7, length 2000: key clock ${ms} ms`)
  })
  check("F7-THROTTLE", "the readout lands on the frame loop's playhead at the end of a pass and on a Pause", () => {
    const T = loadTs("lib/take-transport.ts")
    // A fake clock: timers run when `now` passes them.
    let now = 0
    let timers = []
    const fake = { setTimeout: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t }, clearTimeout: (t) => { timers = timers.filter((x) => x !== t) } }
    const advance = (to) => {
      for (;;) {
        const due = timers.filter((t) => t.at <= to).sort((a, b) => a.at - b.at)[0]
        if (!due) break
        now = due.at
        timers = timers.filter((x) => x !== due)
        due.fn()
      }
      now = to
    }
    const pass = (pauseAtMs) => {
      now = 0
      timers = []
      let playhead = 0
      let readout = 0
      const th = T.createProgressThrottle(() => playhead, (p) => (readout = p), 66, fake)
      const frame = 1000 / 60
      let pendingAtEnd = false
      for (let t = frame; ; t += frame) {
        advance(t)
        if (pauseAtMs !== null && t >= pauseAtMs) {
          th.flush()
          return { playhead, readout, pendingAtEnd }
        }
        playhead = Math.min(1, t / 2000)
        th.tick()
        if (playhead >= 1) {
          pendingAtEnd = timers.length > 0
          advance(t + 200)
          return { playhead, readout, pendingAtEnd }
        }
      }
    }
    const end = pass(null)
    const pause = pass(1234)
    row("F7-THROTTLE", end.pendingAtEnd && end.readout === 1 && pause.readout === pause.playhead, "the readout lands on the frame loop's playhead at the end of a pass and on a Pause",
      `end of pass: a write pending on the last frame ${end.pendingAtEnd}, readout ${end.readout} for playhead ${end.playhead}; Pause at 1234 ms: readout ${pause.readout.toFixed(4)} for playhead ${pause.playhead.toFixed(4)}`)
  })
}

/* ---- the must-fails ----------------------------------------------------- */
const MUTANTS = [
  { name: "the loop runs on the speed at the frame's end", file: "lib/keyframes.ts", find: "  return ((loopPhaseAt(state, keys, speedPath, toMs) - loopPhaseAt(state, keys, speedPath, fromMs)) * 1000) / step\n", text: "  return valueAt(track, toMs)!\n", red: ["F1-LOOP"] },
  { name: "the loop's mean speed is read over the wrong span", file: "lib/keyframes.ts", find: "  return ((loopPhaseAt(state, keys, speedPath, toMs) - loopPhaseAt(state, keys, speedPath, fromMs)) * 1000) / step\n", text: "  return ((loopPhaseAt(state, keys, speedPath, toMs) - loopPhaseAt(state, keys, speedPath, fromMs)) * 1000) / (step * 1.01)\n", red: ["F1-LOOP"] },
  { name: "the GLB writes no material channel", file: "lib/export/glb-material-keys.ts", find: "      anim!.channels.push({", text: "      if (false) anim!.channels.push({", red: ["F1-GLB"] },
  { name: "the GLB points a channel at an extension the file does not have", file: "lib/export/glb-material-keys.ts", find: "        const e = (exts[p.ext] ??= {})\n", text: "        const e = exts[p.ext] ?? {}\n", red: ["F1-GLB"] },
  { name: "readKeys keeps only the seven take tracks", file: "lib/doc-store.ts", find: "    if (!isKeyPath(name)) {\n", text: "    if (!(KEY_PROPERTIES as readonly string[]).includes(name)) {\n", red: ["F2-RELOAD"] },
  { name: "readKeys checks a style track without its range", file: "lib/doc-store.ts", find: "    const bad = validateTrack(track, name)\n", text: "    const bad = validateTrack(track)\n", red: ["F2-RELOAD"] },
  { name: "a refused path drops every key in the edit (the old null)", file: "lib/key-edit.ts", find: "      refused.push({ path, reasons: bad })\n      continue\n", text: "      return null\n", red: ["F5-EDIT"] },
  { name: "a refused path is written anyway", file: "lib/key-edit.ts", find: "    if (bad.length) {\n      if (KEY_UI_MUTANT", text: "    if (false) {\n      if (KEY_UI_MUTANT", red: ["F5-EDIT"] },
  { name: "the refusal says no reason", file: "lib/key-edit.ts", find: "  return reasons.length ? `${verb}: ${reasons[0]}` : verb\n", text: "  return verb\n", red: ["F5-WORDS"] },
  { name: "the refusal's range words are dropped", file: "lib/key-edit.ts", find: "    if (range) return `${verb}: ${num(range[1])} is outside ${num(range[2])} to ${num(range[3])}`\n", text: "\n", red: ["F5-EDIT", "F5-WORDS"] },
  { name: "Twos is ignored", file: "lib/stroke-schedule.ts", find: "  if (cadence !== \"twos\" || !(totalDurationMs > 0)) return clock\n", text: "  if (true) return clock\n", red: ["F6-CADENCE"] },
  { name: "Twos steps on wall seconds, not take time", file: "lib/stroke-schedule.ts", find: "  return quantiseToCadence(clock * sec, CADENCE_HZ) / sec\n", text: "  return quantiseToCadence(clock, CADENCE_HZ)\n", red: ["F6-CADENCE"] },
  { name: "the key clock reads the throttled readout", file: "lib/take-transport.ts", find: "  return store ? store.playheadRef.current * (store.derived()?.totalDuration ?? 0) : 0\n", text: "  return store ? store.progress.get() * (store.derived()?.totalDuration ?? 0) : 0\n", red: ["F7-CLOCK"] },
  { name: "the throttle writes the value captured when its timer was armed", file: "lib/take-transport.ts", find: "      if (pending !== null) return\n      pending = timers.setTimeout(() => {\n        pending = null\n        write(readPlayhead())\n", text: "      if (pending !== null) return\n      const armed = readPlayhead()\n      pending = timers.setTimeout(() => {\n        pending = null\n        write(armed)\n", red: ["F7-THROTTLE"] },
  { name: "a Pause does not flush the readout", file: "lib/take-transport.ts", find: "      pending = null\n      write(readPlayhead())\n    },\n    cancel() {", text: "      pending = null\n    },\n    cancel() {", red: ["F7-THROTTLE"] },
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

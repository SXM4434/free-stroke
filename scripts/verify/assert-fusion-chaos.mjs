/* ============================================================================
 * assert-fusion-chaos.mjs: coverage item 12, rows 82 and 83
 * (docs/research-2026-09-26/animation-asks-coverage.md). Fusion chaos, reveal
 * influence, completion behaviour, and the Phase 23 sync list: shimmer riding
 * the tip, dither freezing on pause, a fusion bloom at completion.
 *
 *   node scripts/verify/assert-fusion-chaos.mjs              rows, then every mutant
 *   node scripts/verify/assert-fusion-chaos.mjs --rows-only  rows only (a mutant child runs this)
 *
 * Node only, through scripts/verify/_ts-load.mjs. Mutants go through
 * GATE_MUTATE_FILE, so nothing on disk changes; the two files this gate reads
 * as text (the panel and the viewport) take the same edits through `readSrc`.
 * Exits 0 only when every row passes, every mutant turns its rows red, and
 * every row has a mutant.
 *
 * IDENT is the "off is byte-identical" row. Its reference is not this
 * branch's code with the new fields absent (that would be the code under test
 * grading itself): it is `lib/style-fusion.ts` as it stood at BASE, loaded
 * from git beside the new one, and every frame is compared with Object.is on
 * every number. What it cannot see: the viewport. The frame loop's new lines
 * are a source check (WIRE), not a render; no browser ran in this lane.
 * ========================================================================== */
import { spawnSync, execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")
/** The snapshot this lane started from: the fusion engine before rows 82 and 83. */
const BASE = "2cc9e98"

const rows = []
const row = (id, ok, what, detail) => rows.push({ id, ok: !!ok, what, detail })
function check(id, what, fn) {
  try {
    fn()
  } catch (e) {
    row(id, false, what, `threw: ${e && e.message}`)
  }
}

/** A file read as text, with this run's GATE_MUTATE_FILE edits applied, the
 *  same substitution `loadTs` makes for the modules it loads. */
function readSrc(rel) {
  let src = readFileSync(join(ROOT, rel), "utf8")
  const f = process.env.GATE_MUTATE_FILE
  if (f) {
    if (!existsSync(f)) throw new Error(`GATE_MUTATE_FILE names ${f}, which does not exist`)
    const edits = JSON.parse(readFileSync(f, "utf8"))[rel] || []
    for (const e of [...edits].sort((a, b) => b.pos - a.pos)) {
      if (e.was != null && src.slice(e.pos, e.end) !== e.was) throw new Error(`stale mutant offset in ${rel}`)
      src = src.slice(0, e.pos) + e.text + src.slice(e.end)
    }
  }
  return src
}

/** BASE's style-fusion.ts, loaded from a temp dir with its relative imports
 *  pointed back at this tree's lib/ (style-clock and dither-shader did not
 *  change in this lane). */
function loadBaseFusion() {
  const src = execFileSync("git", ["-C", ROOT, "show", `${BASE}:lib/style-fusion.ts`], { encoding: "utf8", maxBuffer: 1 << 26 })
  const dir = mkdtempSync(join(tmpdir(), "fs-fusion-base-"))
  const file = join(dir, "style-fusion-base.ts")
  writeFileSync(file, src.replace(/from "\.\/([^"]+)"/g, (_, p) => `from "${join(ROOT, "lib", p)}"`))
  try {
    return loadTs(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Every number and string in two frames, compared with Object.is. */
function sameFrame(a, b) {
  if (a === null || b === null) return a === b
  const ka = Object.keys(a).sort()
  const kb = Object.keys(b).sort()
  if (ka.join() !== kb.join()) return false
  for (const k of ka) {
    const x = a[k]
    const y = b[k]
    if (x !== null && typeof x === "object") {
      if (y === null || typeof y !== "object" || !sameFrame(x, y)) return false
    } else if (!Object.is(x, y)) return false
  }
  return true
}

const NUM_FIELDS = (f) => Object.entries(f).filter(([, v]) => typeof v === "number")

function runRows() {
  const F = loadTs("lib/style-fusion.ts")
  const S = loadTs("lib/style-system.ts")
  const D = S.DEFAULT_STYLE_STATE

  /* ---- the corpus every frame row walks ---------------------------------- */
  const custom = F.newCustomFusion("Mine")
  const every = F.fuseEverything("All")
  const combos = F.FUSION_COMBO_LIST.filter((c) => !c.empty)
  const presetIds = [
    ...S.FUSION_PRESET_DEFS.map((p) => p.id),
    ...Object.keys(F.BUILTIN_LINK_FUSIONS),
    ...combos.filter((_, i) => i % 6 === 0).map((c) => `combo:${c.key}`),
    F.customFusionKey(custom.id),
    F.customFusionKey(every.id),
  ]
  const uniqueIds = [...new Set(presetIds)]
  const DRIVES = ["loop", "arc", "burst"]
  const stateFor = (id, drive, extra = {}) => ({
    ...D,
    motionMode: "independent",
    fusionPreset: id,
    fusionDrive: drive,
    fusionAnimationEnabled: drive !== "loop",
    fusionIntensity: 0.6,
    customFusions: [custom, every],
    ...extra,
  })
  const signalsAt = (t) => ({ asciiTime: t * 1.3, ditherTime: t * 0.7 + 0.2, textureTime: t * 0.9, stackTime: Math.sin(t) * 0.4, stackAmount: 0.8, orbit: 0.3 })
  const clocks = []
  for (const elapsed of [0.3, 1.7, 4.2, 9.9])
    for (const reveal of [0, 0.35, 1])
      for (const sinceCompletion of [Infinity, 0.05, 0.4, 2.5])
        for (const sinceArmed of [0, 0.8, 3.5, 12]) clocks.push({ elapsed, reveal, sinceCompletion, sinceArmed })
  const clockOf = (c) => ({ elapsed: c.elapsed, reveal: c.reveal, sinceCompletion: c.sinceCompletion, strokeDurationMs: 1800 })

  /* ---- IDENT: off is byte-identical to BASE ------------------------------ */
  check("IDENT", "every new control at its default gives BASE's frame, number for number", () => {
    const B = loadBaseFusion()
    let n = 0
    let same = 0
    let absentSame = 0
    const misses = []
    for (const id of uniqueIds)
      for (const drive of DRIVES)
        for (const motionMode of ["independent", "off"])
          for (const c of clocks) {
            const st = stateFor(id, drive, { motionMode })
            const absent = { ...st }
            for (const k of ["fusionChaos", "fusionRevealInfluence", "fusionCompletion", "fusionTipShimmer", "fusionPauseHold"]) delete absent[k]
            const want = B.evaluateFusion(st, clockOf(c), signalsAt(c.elapsed), c.sinceArmed)
            const got = F.evaluateFusion(st, clockOf(c), signalsAt(c.elapsed), c.sinceArmed)
            const gotAbsent = F.evaluateFusion(absent, clockOf(c), signalsAt(c.elapsed), c.sinceArmed)
            n++
            if (sameFrame(got, want)) same++
            else if (misses.length < 2) misses.push(`${id}/${drive}/${motionMode} t=${c.elapsed} rv=${c.reveal} since=${c.sinceCompletion}`)
            if (sameFrame(gotAbsent, want)) absentSame++
          }
    // The control: BASE against itself on one moved number must NOT be the same.
    const lit = { elapsed: 4.2, reveal: 1, sinceCompletion: Infinity, sinceArmed: 3.5 }
    const ctl = sameFrame(
      B.evaluateFusion(stateFor("terminalGel", "loop"), clockOf(lit), signalsAt(4.2), 3.5),
      B.evaluateFusion(stateFor("terminalGel", "loop", { fusionIntensity: 0.61 }), clockOf(lit), signalsAt(4.2), 3.5),
    )
    row("IDENT", same === n && absentSame === n && !ctl && n > 1000, "every new control at its default gives BASE's frame, number for number",
      `${same} of ${n} frames identical with the defaults set, ${absentSame} of ${n} with the fields absent (a state saved before them); ` +
      `${uniqueIds.length} relationships x 3 drives x 2 motion modes x ${clocks.length} clocks; control (Link 0.60 vs 0.61) ${ctl ? "WRONGLY SAME" : "differs"}; misses: ${misses.join("; ") || "none"}`)
  })

  /* ---- CHAOS: the fused systems drift apart by the lag law ---------------- */
  check("CHAOS", "each system runs the relationship chaos x its lag behind; texture is the reference", () => {
    const L = F.FUSION_CHAOS_LAG
    const owner = (k) => (k.startsWith("texture") ? "texture" : k.startsWith("dither") ? "dither" : k.startsWith("ascii") ? "ascii" : "material")
    let n = 0
    let lawOk = 0
    let moved = 0
    let movedOf = 0
    let frozenSame = 0
    let frozenN = 0
    const misses = []
    for (const id of uniqueIds)
      for (const drive of DRIVES)
        for (const chaos of [0.25, 0.6, 1]) {
          const c = { elapsed: 6.3, reveal: 1, sinceCompletion: 5, sinceArmed: 7.1 }
          const st = stateFor(id, drive, { fusionChaos: chaos })
          const got = F.evaluateFusion(st, clockOf(c), signalsAt(c.elapsed), c.sinceArmed)
          const zero = stateFor(id, drive)
          let ok = true
          for (const [k, v] of Object.entries(got)) {
            const lag = chaos * L[owner(k)]
            const ref = F.evaluateFusion(zero, { ...clockOf(c), elapsed: c.elapsed - lag }, signalsAt(c.elapsed), Math.max(0, c.sinceArmed - lag))
            const w = ref[k]
            if (!(typeof v === "object" && v !== null ? sameFrame(v, w) : Object.is(v, w))) ok = false
          }
          n++
          if (ok) lawOk++
          else if (misses.length < 2) misses.push(`${id}/${drive}/chaos ${chaos}`)
          if (chaos === 1 && drive === "loop") {
            movedOf++
            const z = F.evaluateFusion(zero, clockOf(c), signalsAt(c.elapsed), c.sinceArmed)
            if (!sameFrame(got, z)) moved++
          }
          frozenN++
          const fz = F.evaluateFusion({ ...st, motionMode: "off" }, clockOf(c), signalsAt(c.elapsed), c.sinceArmed)
          const fz0 = F.evaluateFusion({ ...zero, motionMode: "off" }, clockOf(c), signalsAt(c.elapsed), c.sinceArmed)
          if (sameFrame(fz, fz0)) frozenSame++
        }
    // Spread: the three lagged systems sit at three different lags, none at texture's.
    const lags = [L.dither, L.ascii, L.material]
    const spread = L.texture === 0 && new Set(lags).size === 3 && lags.every((x) => x > 0)
    row("CHAOS", lawOk === n && moved >= Math.ceil(movedOf * 0.6) && frozenSame === frozenN && spread,
      "each system runs the relationship chaos x its lag behind; texture is the reference",
      `lag law exact in ${lawOk} of ${n} (relationship, drive, chaos 0.25/0.6/1); chaos 1 on Loop moves the frame in ${moved} of ${movedOf} relationships (bar 60%); ` +
      `Motion Off holds chaos inert in ${frozenSame} of ${frozenN}; lags texture ${L.texture}, dither ${L.dither}, ascii ${L.ascii}, surface ${L.material} s; misses: ${misses.join("; ") || "none"}`)
  })

  /* ---- REVEAL: how much the draw gates the relationship ------------------- */
  check("REVEAL", "influence 1 is the smoothstep gate, 0 opens it, and between is monotone", () => {
    let exact = 0
    let open = 0
    let mono = 0
    const rs = Array.from({ length: 41 }, (_, i) => i / 40)
    for (const r of rs) {
      const sm = r * r * (3 - 2 * r)
      if (Object.is(F.revealGate(r, 1), sm) && Object.is(F.revealGate(r, undefined), sm)) exact++
      if (F.revealGate(r, 0) === 1) open++
      let m = true
      for (let i = 1; i <= 20; i++) if (F.revealGate(r, i / 20) > F.revealGate(r, (i - 1) / 20) + 1e-15) m = false
      if (m) mono++
    }
    // Through the engine: before the draw (reveal 0), influence 1 is unlinked and 0 is linked.
    const c = { elapsed: 2.2, reveal: 0, sinceCompletion: Infinity, strokeDurationMs: 1800 }
    const ident = F.evaluateFusion({ ...D, fusionPreset: "none" }, c, signalsAt(2.2), 1) // null
    const shut = F.evaluateFusion(stateFor("terminalGel", "loop"), c, signalsAt(2.2), 1)
    const opened = F.evaluateFusion(stateFor("terminalGel", "loop", { fusionRevealInfluence: 0 }), c, signalsAt(2.2), 1)
    const shutStill = NUM_FIELDS(shut).every(([k, v]) => v === (k.endsWith("Mul") || k === "colorScale" ? 1 : 0) || Object.is(v, -0))
    const openMoves = NUM_FIELDS(opened).some(([k, v]) => v !== (k.endsWith("Mul") || k === "colorScale" ? 1 : 0))
    row("REVEAL", exact === rs.length && open === rs.length && mono === rs.length && ident === null && shutStill && openMoves,
      "influence 1 is the smoothstep gate, 0 opens it, and between is monotone",
      `smoothstep exact at influence 1 in ${exact} of ${rs.length} reveals; gate open at 0 in ${open}; monotone in influence in ${mono}; ` +
      `Terminal Gel before the draw: influence 1 ${shutStill ? "unlinked" : "LINKED"}, influence 0 ${openMoves ? "linked" : "STILL UNLINKED"}`)
  })

  /* ---- COMPLETION: pulse, bloom, off -------------------------------------- */
  check("COMPLETE", "pulse is today's kick, bloom swells longer to the same peak, off is no accent", () => {
    const ts = Array.from({ length: 801 }, (_, i) => i * 0.01)
    const pulseExact = ts.every((t) => Object.is(F.completionEnvelope("pulse", t), Math.exp(-t / 0.5)) && Object.is(F.completionEnvelope(undefined, t), Math.exp(-t / 0.5)))
    const off = ts.every((t) => F.completionEnvelope("off", t) === 0) && F.completionEnvelope("bloom", Infinity) === 0
    const b = ts.map((t) => F.completionEnvelope("bloom", t))
    const rise = F.FUSION_BLOOM_RISE
    const peakAt = ts[b.indexOf(Math.max(...b))]
    const peak = Math.max(...b)
    let riseMono = true
    let fallMono = true
    for (let i = 1; i < ts.length; i++) {
      if (ts[i] <= rise && b[i] < b[i - 1]) riseMono = false
      if (ts[i - 1] >= rise && b[i] > b[i - 1] + 1e-15) fallMono = false
    }
    const area = (xs) => xs.reduce((s, v) => s + v * 0.01, 0)
    const pArea = area(ts.map((t) => Math.exp(-t / 0.5)))
    const bArea = area(b)
    const startsSoft = b[0] === 0 && b[1] < 0.01
    // Through the engine: Terminal Gel just after completion, off equals no completion at all.
    const c = { elapsed: 3, reveal: 1, sinceCompletion: 0.12, strokeDurationMs: 1800 }
    const never = { ...c, sinceCompletion: Infinity }
    const offFrame = F.evaluateFusion(stateFor("terminalGel", "loop", { fusionCompletion: "off" }), c, signalsAt(3), 40)
    const neverFrame = F.evaluateFusion(stateFor("terminalGel", "loop"), never, signalsAt(3), 40)
    const pulseFrame = F.evaluateFusion(stateFor("terminalGel", "loop"), c, signalsAt(3), 40)
    const bloomLate = F.evaluateFusion(stateFor("terminalGel", "loop", { fusionCompletion: "bloom" }), { ...c, sinceCompletion: 1.5 }, signalsAt(3), 40)
    const pulseLate = F.evaluateFusion(stateFor("terminalGel", "loop"), { ...c, sinceCompletion: 1.5 }, signalsAt(3), 40)
    const engineOk = sameFrame(offFrame, neverFrame) && !sameFrame(pulseFrame, neverFrame) && bloomLate.asciiDensityAdd > pulseLate.asciiDensityAdd
    row("COMPLETE", pulseExact && off && Math.abs(peak - 1) < 1e-9 && Math.abs(peakAt - rise) < 0.011 && riseMono && fallMono && bArea > 2 * pArea && startsSoft && engineOk,
      "pulse is today's kick, bloom swells longer to the same peak, off is no accent",
      `pulse exact in ${pulseExact ? 801 : "NOT all"} of 801 times; off silent ${off}; bloom peak ${peak.toFixed(4)} at ${peakAt.toFixed(2)} s (rise ${rise}); ` +
      `rises ${riseMono ? "monotone" : "NOT monotone"}, settles ${fallMono ? "monotone" : "NOT monotone"}, starts at ${b[0]} then ${b[1].toFixed(5)}; area bloom ${bArea.toFixed(3)} vs pulse ${pArea.toFixed(3)} (bar 2x); ` +
      `engine: off = never completed ${sameFrame(offFrame, neverFrame)}, pulse differs ${!sameFrame(pulseFrame, neverFrame)}, bloom at 1.5 s density ${bloomLate.asciiDensityAdd.toFixed(4)} > pulse ${pulseLate.asciiDensityAdd.toFixed(4)}`)
  })

  /* ---- TIP: the shimmer rides the draw front ------------------------------ */
  check("TIP", "the band sits at the draw front, only while the take plays, and never dims a brighter band", () => {
    const base = F.evaluateFusion(stateFor("terminalGel", "loop"), { elapsed: 2, reveal: 0.5, sinceCompletion: Infinity, strokeDurationMs: 1800 }, signalsAt(2), 2)
    const rs = Array.from({ length: 99 }, (_, i) => (i + 1) / 100)
    let track = 0
    let inside = 0
    let prev = -Infinity
    let mono = true
    for (const r of rs) {
      const f = F.withTipShimmer(base, r, 0.8)
      const want = -0.95 + 1.9 * r
      if (f.sweep && Math.abs(f.sweep.pos - want) < 1e-12) track++
      if (f.sweep && Math.abs(f.sweep.pos) <= 0.95 + 1e-12) inside++
      if (f.sweep.pos <= prev) mono = false
      prev = f.sweep.pos
    }
    const offEnds = F.withTipShimmer(base, 0, 1) === base && F.withTipShimmer(base, 1, 1) === base
    const zero = F.withTipShimmer(base, 0.5, 0) === base
    const bright = { ...base, sweep: { pos: 0.3, amt: 0.9, width: 0.42, dirX: 1, dirY: 0 } }
    const keeps = F.withTipShimmer(bright, 0.5, 0.5) === bright
    const fadeIn = F.withTipShimmer(base, 0.01, 1).sweep.amt < F.withTipShimmer(base, 0.5, 1).sweep.amt
    // Through the engine: the state field reaches the band.
    const viaState = F.evaluateFusion(stateFor("terminalGel", "loop", { fusionTipShimmer: 1 }), { elapsed: 2, reveal: 0.5, sinceCompletion: Infinity, strokeDurationMs: 1800 }, signalsAt(2), 2)
    const reaches = !!viaState.sweep && Math.abs(viaState.sweep.pos) < 1e-12 && viaState.sweep.amt > 0.5
    row("TIP", track === rs.length && inside === rs.length && mono && offEnds && zero && keeps && fadeIn && reaches,
      "the band sits at the draw front, only while the take plays, and never dims a brighter band",
      `band at the front in ${track} of ${rs.length} reveals, on the mark in ${inside}, ${mono ? "strictly advancing" : "NOT advancing"}; none at 0 or 1 ${offEnds}; amount 0 is the same frame ${zero}; ` +
      `a brighter band kept ${keeps}; fades in ${fadeIn}; fusionTipShimmer 1 at reveal 0.5 puts the band at ${viaState.sweep ? viaState.sweep.pos.toFixed(3) : "none"}`)
  })

  /* ---- PAUSE: dither freezes on pause ------------------------------------ */
  check("PAUSE", "a stalled playhead inside the take holds; playing, the ends and one still frame do not", () => {
    const dt = 1 / 60
    const run = (seq) => {
      const w = F.createPauseWatch()
      return seq.map((p) => F.watchPause(w, p, dt))
    }
    const playing = run(Array.from({ length: 180 }, (_, i) => i / 180))
    const paused = run([...Array.from({ length: 30 }, (_, i) => i / 100), ...Array(30).fill(0.3)])
    const pausedFrom = paused.indexOf(true)
    const atEnd = run(Array(60).fill(1))
    const atStart = run(Array(60).fill(0))
    const hiccup = run([0.1, 0.11, 0.11, 0.12, 0.13, 0.13, 0.14, 0.15])
    const settleFrames = Math.ceil(F.PAUSE_SETTLE / dt)
    const pauseOk = pausedFrom > 30 && pausedFrom <= 30 + settleFrames && paused.slice(pausedFrom).every(Boolean)
    // The latch: one held value per layer, released on the first free frame.
    const slot = { v: null }
    const held = [F.holdValue(slot, false, 1), F.holdValue(slot, true, 2), F.holdValue(slot, true, 3), F.holdValue(slot, true, 4), F.holdValue(slot, false, 5)]
    const latchOk = held.join() === "1,2,2,2,5" && slot.v === null
    const L = (m) => JSON.stringify(F.pauseHoldLayers(m))
    const layersOk =
      L("off") === JSON.stringify({ dither: false, texture: false, ascii: false, fusion: false }) &&
      L(undefined) === L("off") &&
      L("dither") === JSON.stringify({ dither: true, texture: false, ascii: false, fusion: false }) &&
      L("surface") === JSON.stringify({ dither: true, texture: true, ascii: true, fusion: true })
    row("PAUSE", !playing.some(Boolean) && pauseOk && !atEnd.some(Boolean) && !atStart.some(Boolean) && !hiccup.some(Boolean) && latchOk && layersOk,
      "a stalled playhead inside the take holds; playing, the ends and one still frame do not",
      `playing ${playing.filter(Boolean).length} of 180 frames read paused; a stall at 0.3 holds from frame ${pausedFrom} (stall began at 30, settle ${settleFrames} frames); ` +
      `at 1: ${atEnd.filter(Boolean).length}, at 0: ${atStart.filter(Boolean).length}, one-frame hiccups: ${hiccup.filter(Boolean).length}; latch ${held.join(",")}; layers off/dither/surface ${layersOk ? "as named" : "WRONG"}`)
  })

  /* ---- FIELDS: real fields, keyable, listed by Customize, reset by a pick --- */
  const NEW = ["fusionChaos", "fusionRevealInfluence", "fusionCompletion", "fusionTipShimmer", "fusionPauseHold"]
  const NEW_NUM = ["fusionChaos", "fusionRevealInfluence", "fusionTipShimmer"]
  check("FIELDS", "every fusion preset sets the five, Customize lists them, a pick resets them, the numbers are keyable", () => {
    const K = loadTs("lib/keyframes.ts")
    const M = loadTs("lib/style-key-meta.ts")
    // Both fusion rails: the relationships and their animated variants.
    const defs = [...S.PRESET_REGISTRY.fusion.map((p) => ["fusion", p]), ...S.PRESET_REGISTRY.animatedFusion.map((p) => ["animatedFusion", p])]
    const listed = defs.filter(([, p]) => NEW.every((k) => S.presetFields(p).includes(k))).length
    const dirty = { ...D, fusionChaos: 0.8, fusionRevealInfluence: 0.2, fusionCompletion: "bloom", fusionTipShimmer: 0.7, fusionPauseHold: "surface" }
    const resetBy = (fam, p) => {
      const s = S.applyPresetToStyleState(dirty, fam, p.id)
      return NEW.every((k) => s[k] === D[k])
    }
    const resets = defs.filter(([fam, p]) => resetBy(fam, p)).length
    // The other composition rails set none of the five, so only the rail reset
    // (COMPOSITION_RAIL_KEYS) puts them back: a chaos or a hold must not wait,
    // hidden, for the next fusion picked by hand.
    const COMP = ["texture", "animatedTexture", "dither", "animatedDither", "ascii", "animatedAscii", "layerStack"]
    const others = COMP.flatMap((fam) => S.PRESET_REGISTRY[fam].map((p) => [fam, p]))
    const othersReset = others.filter(([fam, p]) => resetBy(fam, p)).length
    const defaultsOff = D.fusionChaos === 0 && D.fusionRevealInfluence === 1 && D.fusionCompletion === "pulse" && D.fusionTipShimmer === 0 && D.fusionPauseHold === "off"
    const keyable = NEW_NUM.filter((p) => K.KEYABLE_PATHS.some((r) => r.path === p) && !K.KEY_DISABLED[p] && M.styleKeyMeta(p)?.family.id === "fusion" && !M.UNLABELLED_KEY_PATHS.includes(p))
    row("FIELDS", listed === defs.length && resets === defs.length && othersReset === others.length && others.length > 0 && defaultsOff && keyable.length === NEW_NUM.length && defs.length > 0,
      "every fusion preset sets the five, Customize lists them, a pick resets them, the numbers are keyable",
      `${listed} of ${defs.length} fusion and animated-fusion presets list all five in presetFields; picking each resets all five in ${resets} of ${defs.length}; ` +
      `picking a texture, dither, ASCII or stack preset resets them in ${othersReset} of ${others.length}; defaults are today's ${defaultsOff}; ` +
      `keyable in the Fusion family: ${keyable.join(", ") || "none"} of ${NEW_NUM.join(", ")}`)
  })

  /* ---- PANEL: the controls sit in the Fusion panel, inside Customize's Field --- */
  check("PANEL", "each field has its control in FusionControl, wrapped in a Field of its own key", () => {
    const src = readSrc("components/style-panel-scaffold.tsx")
    const start = src.indexOf("function FusionControl(")
    const end = src.indexOf("\nfunction ", start + 10)
    const body = src.slice(start, end)
    const found = []
    const missing = []
    for (const k of NEW) {
      const field = new RegExp(`<Field k=\\{"${k}"\\}>`).test(body)
      const ctl = NEW_NUM.includes(k)
        ? new RegExp(`value=\\{styleState\\.${k}\\}`).test(body) && new RegExp(`\\.\\.\\.s, ${k}: Number\\(e\\.target\\.value\\)`).test(body)
        : new RegExp(`${k}: [a-zA-Z.]+ \\}\\)\\)`).test(body) && new RegExp(`styleState\\.${k} === `).test(body)
      ;(field && ctl ? found : missing).push(k)
    }
    // The group Field that greys the dials when fusion is off must name them too.
    const group = /<Field k=\{\[[^\]]*"fusionChaos"[^\]]*\]\} group>/.test(body)
    row("PANEL", missing.length === 0 && group && start > 0,
      "each field has its control in FusionControl, wrapped in a Field of its own key",
      `${found.length} of ${NEW.length} have a Field and a control that writes them; in the panel's group Field ${group}; missing: ${missing.join(", ") || "none"}`)
  })

  /* ---- WIRE: the frame loop reads the pause hold (a source check) ---------- */
  check("WIRE", "the frame loop watches the playhead and holds the layers the field names", () => {
    const src = readSrc("components/viewport-3d.tsx")
    const need = [
      /watchPause\(pauseWatchRef\.current, playheadRef\.current, delta\)/,
      /pauseHoldLayers\(styleState\?\.fusionPreset !== "none" \? styleState\?\.fusionPauseHold : "off"\)/,
      /d\.uFsDitTime\.value = holdValue\(pauseSlotsRef\.current\.dit, hold\.dither && pausedNow, d\.uFsDitTime\.value\)/,
      /u\.uFsTexTime\.value = holdValue\(pauseSlotsRef\.current\.tex, hold\.texture && pausedNow, u\.uFsTexTime\.value\)/,
      /a\.uFsAscTime\.value = holdValue\(pauseSlotsRef\.current\.asc, hold\.ascii && pausedNow, a\.uFsAscTime\.value\)/,
      /hold\.fusion && pausedNow && heldFusionRef\.current/,
    ]
    const hits = need.filter((re) => re.test(src)).length
    row("WIRE", hits === need.length, "the frame loop watches the playhead and holds the layers the field names",
      `${hits} of ${need.length} wiring lines present in components/viewport-3d.tsx (source only; not rendered in this lane)`)
  })
}

/* ---- the must-fails ----------------------------------------------------- */
const SF = "lib/style-fusion.ts"
const SS = "lib/style-system.ts"
const SP = "components/style-panel-scaffold.tsx"
const VP = "components/viewport-3d.tsx"
const MUTANTS = [
  { name: "the pulse's half-life moves", file: SF, find: "return Math.exp(-trigger / 0.5)\n}", text: "return Math.exp(-trigger / 0.55)\n}", red: ["IDENT", "COMPLETE"] },
  { name: "influence 1 stops being the smoothstep", file: SF, find: "if (inf >= 1) return smooth", text: "if (inf >= 1) return rv", red: ["IDENT", "REVEAL"] },
  { name: "chaos lags nothing", file: SF, find: "const lag = c * FUSION_CHAOS_LAG[sys]", text: "const lag = 0 * FUSION_CHAOS_LAG[sys]", red: ["CHAOS"] },
  { name: "chaos runs the systems ahead, not behind", file: SF, find: "elapsed: clock.elapsed - lag }", text: "elapsed: clock.elapsed + lag }", red: ["CHAOS"] },
  { name: "chaos becomes noise on top", file: SF, find: "if (owner === sys) write[field] = (lagged as unknown as Record<string, unknown>)[field]", text: "if (owner === sys && typeof write[field] === \"number\") write[field] = (write[field] as number) + c * (hash01(lag * 97) - 0.5)", red: ["CHAOS"] },
  { name: "reveal influence ignored", file: SF, find: "return 1 - inf * (1 - smooth)", text: "return smooth", red: ["REVEAL"] },
  { name: "completion off still pulses", file: SF, find: "  if (mode === \"off\") return 0\n", text: "", red: ["COMPLETE"] },
  { name: "bloom is the pulse", file: SF, find: "if (mode === \"bloom\") {", text: "if (mode === \"bloom-never\") {", red: ["COMPLETE"] },
  { name: "the tip band parks in the middle", file: SF, find: "pos: -TIP_BAND_REACH + 2 * TIP_BAND_REACH * rv,", text: "pos: 0,", red: ["TIP"] },
  { name: "the tip band dims a brighter one", file: SF, find: "if (f.sweep && f.sweep.amt >= amt) return f", text: "if (false) return f", red: ["TIP"] },
  { name: "one still frame reads as a pause", file: SF, find: "return inside && w.still >= PAUSE_SETTLE", text: "return inside && w.still >= 0", red: ["PAUSE"] },
  { name: "the end of the take reads as a pause", file: SF, find: "const inside = playhead > 0 && playhead < 1", text: "const inside = playhead > 0 && playhead <= 1", red: ["PAUSE"] },
  { name: "chaos left out of the fusion presets", file: SS, find: "  fusionChaos: 0,\n  fusionRevealInfluence: 1,\n  fusionCompletion: \"pulse\",\n  fusionTipShimmer: 0,\n  fusionPauseHold: \"off\",\n  // Fusion's ambient drives", text: "  fusionRevealInfluence: 1,\n  fusionCompletion: \"pulse\",\n  fusionTipShimmer: 0,\n  fusionPauseHold: \"off\",\n  // Fusion's ambient drives", red: ["FIELDS"] },
  { name: "a pick no longer resets the hold", file: SS, find: "\"fusionTipShimmer\", \"fusionPauseHold\",\n", text: "\"fusionTipShimmer\",\n", red: ["FIELDS"] },
  { name: "the Chaos slider is not in a Field", file: SP, find: "<Field k={\"fusionChaos\"}>", text: "<Field k={[]}>", red: ["PANEL"] },
  { name: "the Hold pills write nothing", file: SP, find: "fusionPauseHold: h.id }))", text: "}))", red: ["PANEL"] },
  { name: "the frame loop never holds the dither", file: VP, find: "d.uFsDitTime.value = holdValue(pauseSlotsRef.current.dit, hold.dither && pausedNow, d.uFsDitTime.value)", text: "void 0", red: ["WIRE"] },
]

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-fusion-chaos-mut-"))
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const src = readFileSync(join(ROOT, m.file), "utf8")
      const at = src.indexOf(m.find)
      if (at < 0 || src.indexOf(m.find, at + 1) >= 0) throw new Error(`mutant text not unique in ${m.file}`)
      const jf = join(dir, "m.json")
      writeFileSync(jf, JSON.stringify({ [m.file]: [{ pos: at, end: at + m.find.length, text: m.text, was: m.find }] }))
      const r = spawnSync(process.execPath, [SELF, "--rows-only"], { env: { ...process.env, GATE_MUTATE_FILE: jf }, encoding: "utf8", maxBuffer: 1 << 28 })
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
  runRows()
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

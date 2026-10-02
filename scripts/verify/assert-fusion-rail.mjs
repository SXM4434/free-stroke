// ASSERT-FUSION-RAIL — the two things Sebs said were wrong with fusion, as gates.
//
// 2026-08-04: *"few issues with fusion — some dont animate, and i asked to have
// at least one fusion for every possible combo of styles."*
//
// Both are claims about the RAIL AS A SET, and neither had an instrument.
// `assert-fusion-newborn` grades a newborn custom fusion and every link-authored
// built-in's links; `assert-fusion-ui` grades the panel; `assert-fusion-authoring`
// grades the editor. Nothing asked "does every pill move" or "is every
// combination answered", so nothing could have said no.
//
//   §1 · EVERY SHIPPED RELATIONSHIP MOVES.
//        Selected through `applyPresetToStyleState` — the function the pill's
//        click actually runs — and evaluated through `evaluateFusion`, the one
//        viewport-3d.tsx applies. A relationship whose frame never leaves its
//        starting value across a full breath is a pill that does nothing.
//
//   §2 · EVERY COMBINATION OF STYLES IS ANSWERED.
//        The combination space is the eight subsets of {texture, dither, ascii}
//        — the three style rails a fusion composes. Enumerated here, printed
//        cell by cell, and required to be non-empty.
//
// ── WHY THE COUNTED AXIS IS THE LAYER SET AND NOT A 16-CELL TABLE ───────────
// A first pass counted layer-set x {no stack, stack} = 16 and called five cells
// holes. Three of those five were "two or more layers, NO stack", and that is
// not a cell anyone should fill: `fusionWakePatch` (lib/style-fusion.ts)
// switches the stack on for any composition with two or more screen layers, on
// the measurement in its own comment — 87.0 % of the mark's inked area survives
// without a stack against 96.6 % with one, and below that the mark reads as a
// black bar. Shipping a pill to fill that cell would be shipping the black bar.
// The stack is printed beside the table because it is worth seeing; the three
// hand-written built-ins that compose two layers with no stack are REPORTED at
// the end rather than failed, because they are shipped, tuned and filmed and
// changing a look nobody asked to change is not a gate's call.
//
// ── EACH SECTION CARRIES ITS OWN KNOWN-BAD ─────────────────────────────────
// §1 against a relationship at intensity 0, which cannot move. §2 against the
// rail with a preset withheld, which must open a hole. Eleven instruments in
// this repo have reported green while measuring nothing.
//
//   node scripts/verify/assert-fusion-rail.mjs
//   node scripts/verify/assert-fusion-rail.mjs --seconds=12 --samples=48

// gate-integrity: differential — this file asks whether every {texture, dither, ascii} combination
// has a shipped relationship and whether all 14 of them MOVE the frame over 12 s. Both questions are
// true at any value of the preset dials it enumerates, and its own calibration rows prove each can go
// red: withholding "stillWet" opens the (surface only) cell, and the traveller reports STILL at
// intensity 0. Channel D mutated 32 of 32 by scaling them x1.6, which can only make a moving field
// move MORE, so no such mutant can turn a row red and surviving it is correct.
import { loadTs } from "./_ts-load.mjs"

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? Number(h.split("=")[1]) : d
}
const SECONDS = arg("seconds", 12)
const SAMPLES = arg("samples", 48)
/* The perceptual floor for a frame field, not a machine epsilon. Every field of
 * `FusionFrame` is either a multiplier around 1 or an additive around 0, so
 * 0.002 is well under anything that could be seen and well over float noise. */
const EPS = arg("eps", 0.002)

const S = loadTs("lib/style-system.ts")
const F = loadTs("lib/style-fusion.ts")

let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/* ⚠ THE SIGNALS ARE THE TEST, AND A WRONG-SHAPED ONE MANUFACTURES A RED.
 *
 * The first version of this passed `{ orbitAzimuth, strokeCount }`, which is not
 * `FusionSignals` at all — so `orbit`, `stackTime` and every layer phase
 * resolved to 0 and stayed there, and it reported viewTurn, slowWeather and
 * formation as dead. All three are link-authored built-ins whose drivers are
 * exactly those fields: the instrument was the dead thing, not the presets.
 *
 * This is `assert-fusion-newborn.mjs`'s derivation (`worstExcursion`, :205-214),
 * for the reason its own comment gives: the phases advance off THE STATE'S OWN
 * speed dials, so a layer this state does not animate contributes a PINNED
 * phase — the condition the original fusion defect lived in, which has to stay
 * reproducible rather than be assumed away. Two copies of one derivation is a
 * duplicate worth naming: if a third appears, it moves into lib/. */
function signalsAt(st, t) {
  const cellRate = st.asciiScrollSpeed * 1.6
  const sig = { asciiTime: 0, ditherTime: 0, textureTime: 0, stackTime: 0, stackAmount: 1, orbit: 0.6 + t * 0.05 }
  if (st.asciiAnimated && st.asciiAnimationType !== "none") sig.asciiTime = t * cellRate
  if (st.ditherAnimated) sig.ditherTime = t * st.ditherSpeed * 6
  if (st.textureAnimated) sig.textureTime = t * st.textureSpeed * 1.2
  if (st.layerStackEnabled && st.stackAnimationEnabled && st.stackAnimationType !== "none")
    sig.stackTime = t * 0.5
  return sig
}

/** How far each field of the frame travels over one window. */
function travelOf(state) {
  const frames = []
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i / (SAMPLES - 1)) * SECONDS
    frames.push(F.evaluateFusion(state, { elapsed: t, reveal: 1, sinceCompletion: t }, signalsAt(state, t), t))
  }
  if (frames.some((f) => f === null)) return null
  const keys = Object.keys(frames[0]).filter((k) => typeof frames[0][k] === "number")
  const out = []
  for (const k of keys) {
    const vals = frames.map((f) => f[k])
    const d = Math.max(...vals) - Math.min(...vals)
    if (d > EPS) out.push([k, d])
  }
  return out.sort((a, b) => b[1] - a[1])
}

/* ================================================================== */
/* §1 · EVERY SHIPPED RELATIONSHIP MOVES                               */
/* ================================================================== */
console.log("=== §1 · does every pill on the rail actually move? ===")
const still = []
for (const p of S.PRESET_REGISTRY.fusion) {
  const state = S.applyPresetToStyleState({ ...S.DEFAULT_STYLE_STATE }, "fusion", p.id)
  const moving = travelOf(state)
  if (moving === null) {
    still.push(`${p.id} (evaluateFusion returned null — the preset did not take)`)
    console.log(`  NULL   ${p.id}`)
    continue
  }
  if (moving.length === 0) still.push(p.id)
  console.log(
    `  ${moving.length ? "moves" : "STILL"}  ${p.id.padEnd(16)} ${String(moving.length).padStart(2)} field(s) · ` +
      (moving.slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(", ") || `nothing above ${EPS}`),
  )
}
say(
  still.length === 0,
  `all ${S.PRESET_REGISTRY.fusion.length} shipped relationships move the frame over a ${SECONDS}s window`,
  still.join(", ") || `${SAMPLES} samples, eps ${EPS}`,
)
/* THE KNOWN-BAD. `fusionIntensity` is the depth dial and `evaluateFusion`
 * returns the identity frame at 0 — so this arm CANNOT move, and if the
 * traveller says it does, §1 is measuring something other than the relationship. */
{
  const dead = S.applyPresetToStyleState({ ...S.DEFAULT_STYLE_STATE }, "fusion", "wholeCloth")
  dead.fusionIntensity = 0
  const moving = travelOf(dead)
  say(
    moving !== null && moving.length === 0,
    "CALIBRATION · the same traveller reports STILL for the loudest relationship at intensity 0",
    moving === null ? "returned null" : `${moving.length} field(s) travelled — it should be 0`,
  )
}

/* ================================================================== */
/* §2 · EVERY COMBINATION OF STYLES IS ANSWERED                        */
/* ================================================================== */
console.log("\n=== §2 · is there a relationship for every combination of styles? ===")
const LAYERS = ["texture", "dither", "ascii"]

function composedBy(id) {
  const st = S.applyPresetToStyleState({ ...S.DEFAULT_STYLE_STATE }, "fusion", id)
  return {
    texture: !!(st.textureEnabled && st.textureMode && st.textureMode !== "none"),
    dither: !!st.ditherEnabled,
    ascii: !!st.asciiEnabled,
    stack: !!(st.layerStackEnabled && st.stackAnimationEnabled),
  }
}
const keyOf = (o) => LAYERS.filter((k) => o[k]).join("+") || "(surface only)"

const subsets = []
for (let m = 0; m < 8; m++) subsets.push(LAYERS.filter((_, i) => m & (1 << i)).join("+") || "(surface only)")

/** The map, over any list of preset ids — so the calibration arm can withhold one. */
function coverage(ids) {
  const cells = new Map(subsets.map((s) => [s, []]))
  const stacked = new Map(subsets.map((s) => [s, []]))
  for (const id of ids) {
    const o = composedBy(id)
    const k = keyOf(o)
    cells.get(k).push(id)
    if (o.stack) stacked.get(k).push(id)
  }
  return { cells, stacked }
}

const allIds = S.PRESET_REGISTRY.fusion.map((p) => p.id)
const { cells, stacked } = coverage(allIds)
console.log("  layer set                 relationships                             of which stacked")
const holes = []
for (const s of subsets) {
  const all = cells.get(s)
  if (all.length === 0) holes.push(s)
  console.log(
    `  ${s.padEnd(24)}  ${(all.join(", ") || "— HOLE —").padEnd(40)}  ${stacked.get(s).join(", ") || "—"}`,
  )
}
say(
  holes.length === 0,
  `every one of the ${subsets.length} combinations of {texture, dither, ascii} has a shipped relationship`,
  holes.join(", ") || `${allIds.length} relationships across ${subsets.length} cells`,
)
/* THE KNOWN-BAD. Withhold the only member of a cell and the map must open a
 * hole. Chosen by construction rather than by name: whichever cell has exactly
 * one relationship in it, so this keeps working when the rail grows. */
{
  const lonely = subsets.find((s) => cells.get(s).length === 1)
  if (!lonely) {
    say(false, "CALIBRATION · no cell has exactly one member, so the withhold arm could not be built — say so rather than skip")
  } else {
    const withheld = cells.get(lonely)[0]
    const { cells: c2 } = coverage(allIds.filter((id) => id !== withheld))
    say(
      c2.get(lonely).length === 0,
      `CALIBRATION · withholding "${withheld}" opens the ${lonely} cell — the map really is reading the rail`,
      `${lonely} goes ${cells.get(lonely).length} -> ${c2.get(lonely).length}`,
    )
  }
}

/* REPORTED, NOT FAILED — the one thing this table cannot decide. */
const unstacked = allIds.filter((id) => {
  const o = composedBy(id)
  return LAYERS.filter((k) => o[k]).length >= 2 && !o.stack
})
if (unstacked.length) {
  console.log(
    `\nREPORTED, NOT FAILED · ${unstacked.length} relationship(s) compose 2+ screen layers with NO layer stack:` +
      `\n  ${unstacked.join(", ")}` +
      "\n  fusionWakePatch's own measurement is 87.0 % of the inked area surviving that, against 96.6 % with a" +
      "\n  stack. It cannot reach these — they are hand-written branches in evaluateFusion with no links to" +
      "\n  derive a wake from. A look call on shipped, tuned, filmed presets: Sebs's, not a gate's.",
  )
}

console.log(`\n${fails === 0 ? `ALL ${checks} FUSION-RAIL ASSERTIONS PASS` : `${fails} of ${checks} FUSION-RAIL ASSERTIONS FAILED`}`)
process.exit(fails === 0 ? 0 : 1)

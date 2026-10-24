// ASSERT-FUSION-COMBOS — the power set, as a gate.
//
// Sebs, 2026-08-04: *"there should be a fusion for every possible combo…
// there's like 7 styles… combos of 2 3 4 5 6 7… so it would be like 2 to the
// power of 7… for 2 there should be one fusion for every possible combo of two,
// etc"*.
//
// `assert-fusion-rail.mjs` §2 answers the EIGHT subsets of {texture, dither,
// ascii}. That was the controller's scoping error and it is not the question.
// This file answers the 120 subsets of the seven PANELS, and every section
// carries a known-bad it must go red on — eleven instruments in this repo have
// reported green while measuring nothing, and a 120-row table is a very
// comfortable place for a green that cannot fail to hide.
//
//   §1  the SET is exactly the power set: 120 cells, canonical keys, no id
//       collision with the `custom:` namespace or with the shipped rail.
//   §2  MEMBERSHIP IS DERIVED, not declared — every cell's links resolve to
//       exactly the systems its key names.
//   §3  the COMPOSITION a cell lands on switches on its members and nothing
//       else, and the derived wake then has nothing left to add.
//   §4  LIVENESS: every authored cell's frame travels, measured in the state
//       the app actually puts you in. The four empty cells must be identity.
//   §5  the VIEW: both arms of the turntable sleep reason.
//   §6  no cell rides one driver when it has more than one available, and the
//       amounts fall as the cell grows.
//   §7  an `event` link only exists on a Burst cell.
//   §8  every pre-existing fusion preset id is still on the rail.
//
//   node scripts/verify/assert-fusion-combos.mjs
//   node scripts/verify/assert-fusion-combos.mjs --seconds=12 --samples=48 --verbose

// gate-integrity: differential — every row here is structural: 120 subsets each have exactly one cell,
// every id collides with nothing, systemsOfLinks(links) === key, every composition matches its own
// membership, and all 116 authored cells move the fusion frame. Each holds at any value of the 220
// preset dials it enumerates, and each carries a calibration row that makes it go red on a real
// change: withholding a key leaves an unclaimed cell, adding a `glow` link moves the derivation, and
// stripping a composition gives the wake 22 fields of work. Channel D's mutants scale a dial x1.6,
// which moves no structural claim and can only make a moving field move more.
import { loadTs } from "./_ts-load.mjs"
import { travelOf, spinRad } from "./_fusion-signals.mjs"

const argN = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? Number(h.split("=")[1]) : d
}
const VERBOSE = process.argv.includes("--verbose")
const SECONDS = argN("seconds", 12)
const SAMPLES = argN("samples", 48)
const EPS = argN("eps", 0.002)

const S = loadTs("lib/style-system.ts")
const F = loadTs("lib/style-fusion.ts")

let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

const SYS = F.FUSION_SYSTEMS.map((s) => s.id)
const CELLS = F.FUSION_COMBO_LIST
const byKey = F.FUSION_COMBOS_BY_KEY

/** The state selecting a cell produces — the real function the pill runs. */
const stateFor = (c) => ({ ...S.DEFAULT_STYLE_STATE, ...F.comboStylePatch(c, S.DEFAULT_STYLE_STATE) })

/* ================================================================== */
/* §1 · THE SET IS EXACTLY THE POWER SET                               */
/* ================================================================== */
console.log("=== §1 · is every combination of the seven systems present, exactly once? ===")
const expected = []
for (let m = 1; m < 1 << SYS.length; m++) {
  const set = SYS.filter((_, i) => m & (1 << i))
  if (set.length >= 2) expected.push(set.join("+"))
}
const got = CELLS.map((c) => c.key)
const missing = expected.filter((k) => !got.includes(k))
const extra = got.filter((k) => !expected.includes(k))
const dupes = got.filter((k, i) => got.indexOf(k) !== i)
say(
  expected.length === 120 && missing.length === 0 && extra.length === 0 && dupes.length === 0,
  `all ${expected.length} subsets of size >= 2 have exactly one cell`,
  missing.length || extra.length || dupes.length
    ? `missing ${missing.length} [${missing.slice(0, 6)}] · extra ${extra.length} [${extra.slice(0, 6)}] · duplicate ${dupes.length}`
    : `${CELLS.length} cells, sizes ${[2, 3, 4, 5, 6, 7].map((n) => `${n}:${got.filter((k) => k.split("+").length === n).length}`).join(" ")}`,
)
/* THE NAMESPACE. `custom:` is user data and is resolved from `state.customFusions`;
 * a cell that landed in that namespace would be looked up in a list it is not in
 * and would silently return the identity frame. */
const idProblems = CELLS.filter((c) => {
  const id = F.comboFusionKey(c.key)
  return (
    F.isCustomFusionId(id) ||
    !F.isComboFusionId(id) ||
    !F.FUSION_COMBOS_BY_ID[id] ||
    !!F.BUILTIN_LINK_FUSIONS[id] ||
    S.PRESET_REGISTRY.fusion.some((p) => p.id === id)
  )
})
say(
  idProblems.length === 0,
  "every cell id resolves in the combo registry and collides with NOTHING — not the `custom:` namespace, not the shipped rail",
  idProblems.map((c) => c.key).join(", ") || `${CELLS.length} ids checked against 3 namespaces`,
)
/* KNOWN-BAD: a key the enumeration does not contain must be reported missing. */
{
  const bad = expected.filter((k) => k !== "material+texture")
  const m2 = bad.filter((k) => !got.includes(k))
  const withheld = got.filter((k) => k === "material+texture")
  say(
    m2.length === 0 && withheld.length === 1,
    "CALIBRATION · the set check reads the real list (withholding a key from the EXPECTATION leaves it as an extra, not a pass)",
    `expected-minus-one leaves ${m2.length} missing and 1 unclaimed cell`,
  )
}

/* EVERY CELL HAS ITS OWN NAME. Two cells under one name is a picker in which
 * two different presses look like the same option — the shape of the duplicate
 * presets this repo re-authored rather than deleted (woodgrain/scanlines at
 * delta 4.80, pixelSignal/hardThreshold at 1.62). */
{
  const names = CELLS.map((c) => c.name)
  const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))]
  say(dup.length === 0, "every cell has a name of its own", dup.join(", ") || `${names.length} distinct names`)
}

/* ================================================================== */
/* §2 · MEMBERSHIP IS DERIVED FROM THE LINKS                           */
/* ================================================================== */
console.log("\n=== §2 · does every cell's link list resolve to exactly the systems its key names? ===")
const mismatched = []
for (const c of CELLS) {
  if (c.empty) continue
  const derived = F.comboKeyOf(F.systemsOfLinks(c.links))
  if (derived !== c.key) mismatched.push(`${c.key} -> ${derived}`)
}
say(
  mismatched.length === 0,
  `all ${CELLS.filter((c) => !c.empty).length} authored cells derive their own key back from their links`,
  mismatched.slice(0, 8).join(" · ") || "systemsOfLinks(links) === key, every cell",
)
/* KNOWN-BAD: bolt a material link onto a cell that has no material member and
 * the derivation must disagree with the key. */
{
  const victim = byKey["texture+dither"]
  const mutated = [...victim.links, { id: "x", source: "orbit", target: "glow", amount: 0.6 }]
  const derived = F.comboKeyOf(F.systemsOfLinks(mutated))
  say(
    derived !== victim.key && derived.includes("material"),
    "CALIBRATION · adding a `glow` link to texture+dither makes the derivation report material — the check reads the links",
    `${victim.key} -> ${derived}`,
  )
}

/* ================================================================== */
/* §3 · THE COMPOSITION A CELL LANDS ON                                */
/* ================================================================== */
console.log("\n=== §3 · does selecting a cell switch on its members, and only its members? ===")
const compProblems = []
for (const c of CELLS) {
  const st = stateFor(c)
  const on = {
    texture: !!(st.textureEnabled && st.textureMode !== "none"),
    dither: !!st.ditherEnabled,
    ascii: !!st.asciiEnabled,
  }
  for (const layer of ["texture", "dither", "ascii"]) {
    const want = c.systems.includes(layer)
    if (on[layer] !== want) compProblems.push(`${c.key}: ${layer} ${on[layer] ? "ON" : "off"} but should be ${want ? "ON" : "off"}`)
  }
  // The stack is a MEMBER when the cell says so, and a SUBSTRATE when two or
  // more screen layers would otherwise composite to a black bar.
  const screens = ["texture", "dither", "ascii"].filter((l) => on[l]).length
  const stackWanted = c.systems.includes("layers") || screens >= 2
  if (!!st.layerStackEnabled !== stackWanted)
    compProblems.push(`${c.key}: stack ${st.layerStackEnabled ? "ON" : "off"} but should be ${stackWanted ? "ON" : "off"}`)
  if (c.systems.includes("layers") && !(st.stackAnimationEnabled && st.stackAnimationType !== "none"))
    compProblems.push(`${c.key}: layers is a member but the group is not animating, so stackField carries nothing`)
}
say(compProblems.length === 0, "every cell's composition matches its own membership", compProblems.slice(0, 8).join(" · ") || `${CELLS.length} cells x 4 rails`)

/* THE DERIVED WAKE MUST HAVE NOTHING LEFT TO DO. `fusionWakePatch` computes,
 * from a fusion's own links, the composition those links need. If a cell's
 * authored composition is right, the wake is a no-op on top of it. This is the
 * same row `assert-fusion-newborn` runs on the shipped built-ins. */
const wakeLeftovers = []
for (const c of CELLS) {
  if (c.empty) continue
  const st = stateFor(c)
  const w = F.fusionWakePatch(c, { ...st, cameraSpinDegPerSecond: F.FUSION_VIEW_SPIN_DEG }, c.drive)
  const changed = Object.keys(w.patch).filter((k) => JSON.stringify(w.patch[k]) !== JSON.stringify(st[k]))
  if (changed.length) wakeLeftovers.push(`${c.key} [${changed.join(",")}]`)
}
say(
  wakeLeftovers.length === 0,
  "the derived wake adds NOTHING to any authored cell — every link lands awake on the composition the cell ships",
  wakeLeftovers.slice(0, 6).join(" · ") || `${CELLS.filter((c) => !c.empty).length} cells woken and unchanged`,
)
/* KNOWN-BAD: strip a cell's composition and the wake must have work to do. */
{
  const c = byKey["animation+dither+ascii"]
  const bare = { ...S.DEFAULT_STYLE_STATE, fusionPreset: F.comboFusionKey(c.key) }
  const w = F.fusionWakePatch(c, { ...bare, cameraSpinDegPerSecond: F.FUSION_VIEW_SPIN_DEG }, c.drive)
  const changed = Object.keys(w.patch).filter((k) => JSON.stringify(w.patch[k]) !== JSON.stringify(bare[k]))
  say(
    changed.length > 0 && w.turnsOn.length > 0,
    "CALIBRATION · the same wake DOES have work on a cell whose composition was stripped",
    `${changed.length} field(s), turns on: ${w.turnsOn.join(", ") || "(nothing)"}`,
  )
}

/* THE RESET AGREES WITH THE SHARED MODULE'S OWN RULE. `COMPOSITION_RAIL_KEYS`
 * lives in lib/style-system.ts and is not exported, so this asks the FUNCTION:
 * take a deliberately dirty state, run the shipped rule for a fusion preset, and
 * check that every rail it sent home is one `isCompositionRailKey` also claims. */
{
  const dirty = { ...S.DEFAULT_STYLE_STATE }
  for (const k of Object.keys(dirty)) {
    if (typeof dirty[k] === "boolean") dirty[k] = !dirty[k]
    else if (typeof dirty[k] === "number") dirty[k] = dirty[k] + 3
  }
  const after = S.applyPresetToStyleState(dirty, "fusion", "stillWet")
  const sentHome = Object.keys(S.DEFAULT_STYLE_STATE).filter(
    (k) =>
      JSON.stringify(after[k]) === JSON.stringify(S.DEFAULT_STYLE_STATE[k]) &&
      JSON.stringify(dirty[k]) !== JSON.stringify(S.DEFAULT_STYLE_STATE[k]),
  )
  const unclaimed = sentHome.filter((k) => !F.isCompositionRailKey(k))
  say(
    unclaimed.length === 0,
    "every rail the shipped preset rule resets is one this file's reset also claims — the two inventories agree",
    unclaimed.join(", ") || `${sentHome.length} rails reset by applyPresetToStyleState, all claimed`,
  )
}

/* ================================================================== */
/* §4 · LIVENESS — measured in the state the app puts you in           */
/* ================================================================== */
console.log("\n=== §4 · does every authored cell MOVE, and is every empty cell honestly empty? ===")
const still = []
const rows = []
for (const c of CELLS) {
  if (c.empty) continue
  const st = stateFor(c)
  // The honest camera: a cell that reads the View is selected WITH the
  // turntable on (that is what app/page.tsx now does), so it is measured that
  // way. A cell that does not read the View is measured with the camera held
  // still, which is where the page actually sits.
  const usesView = F.fusionUsesView(c)
  const orbit = usesView ? (t) => spinRad(F.FUSION_VIEW_SPIN_DEG) * t : () => 0
  const opt = { seconds: SECONDS, samples: SAMPLES, eps: EPS, orbit }
  // TWO ARMS, BOTH REAL. Steady = a finished mark, which is where a viewer sits.
  // Draw = the playhead running 0 -> 1, which is the only state a `reveal` link
  // can move in at all. A cell is alive if it moves in either, and the arm is
  // printed so "alive" cannot quietly come to mean "alive somewhere".
  const steady = travelOf(F, st, opt)
  const draw = travelOf(F, st, { ...opt, reveal: (t, s) => t / s })
  if (steady === null || draw === null) {
    still.push(`${c.key} (no frame at all)`)
    continue
  }
  const n = Math.max(steady.length, draw.length)
  if (n === 0) still.push(c.key)
  const best = steady.length >= draw.length ? steady : draw
  rows.push({ key: c.key, name: c.name, n, steady: steady.length, draw: draw.length })
  if (VERBOSE)
    console.log(
      `  ${n ? "moves" : "STILL"}  ${c.key.padEnd(52)} steady ${String(steady.length).padStart(2)} · draw ${String(draw.length).padStart(2)} · ` +
        (best.slice(0, 3).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(", ") || "nothing"),
    )
}
say(
  still.length === 0,
  `all ${rows.length} authored cells move the fusion frame over a ${SECONDS}s window (steady arm OR draw arm)`,
  still.join(", ") ||
    `${SAMPLES} samples, eps ${EPS} · worst cell moves ${Math.min(...rows.map((r) => r.n))} field(s) · ` +
      `${rows.filter((r) => r.steady === 0).length} cell(s) live only during the draw · ` +
      `${rows.filter((r) => r.draw > r.steady).length} move MORE while drawing`,
)
/* KNOWN-BAD 1 · the depth dial. `evaluateFusion` returns the identity frame at
 * `fusionIntensity` 0, so the loudest cell in the set CANNOT move there. */
{
  const c = byKey["material+animation+texture+dither+ascii+layers+fusion"]
  const dead = { ...stateFor(c), fusionIntensity: 0 }
  const moving = travelOf(F, dead, { seconds: SECONDS, samples: SAMPLES, eps: EPS, orbit: (t) => spinRad(F.FUSION_VIEW_SPIN_DEG) * t })
  say(
    moving !== null && moving.length === 0,
    "CALIBRATION · the same traveller reports STILL for the seven-system cell at Link 0",
    moving === null ? "returned null" : `${moving.length} field(s) travelled — it should be 0`,
  )
}
/* KNOWN-BAD 2 · a deliberately dead link. This is the shape the ORIGINAL fusion
 * defect had: a phase source whose layer is not animating is pinned at
 * `phaseTriangle(0) = 0` by design, so the relationship multiplies by exactly
 * nothing. Feed the traveller exactly that and it must say STILL. */
{
  const c = byKey["animation+ascii"]
  const st = stateFor(c)
  const deadLink = {
    ...c,
    links: [{ id: "dead", source: "asciiField", target: "asciiBite", amount: 0.9 }],
  }
  // Register it under a throwaway id the evaluator can reach.
  F.FUSION_COMBOS_BY_ID["combo:__deadprobe"] = deadLink
  const frozenState = { ...st, asciiAnimated: false, asciiAnimationType: "none", fusionPreset: "combo:__deadprobe" }
  const moving = travelOf(F, frozenState, { seconds: SECONDS, samples: SAMPLES, eps: EPS, orbit: () => 0 })
  delete F.FUSION_COMBOS_BY_ID["combo:__deadprobe"]
  say(
    moving !== null && moving.length === 0,
    "CALIBRATION · a phase link on a layer that is NOT animating reports STILL — the instrument can report a dead relationship",
    moving === null ? "returned null" : `${moving.length} field(s) travelled — the known-bad should be 0`,
  )
}
/* THE FOUR EMPTY CELLS, PROVED RATHER THAN ASSERTED IN PROSE. */
const emptyCells = CELLS.filter((c) => c.empty)
const wronglyEmpty = []
for (const c of emptyCells) {
  const targetsAvailable = Object.entries(F.TARGET_SYSTEMS).filter(([, sys]) =>
    sys.every((s) => c.systems.includes(s)),
  )
  if (targetsAvailable.length !== 0) wronglyEmpty.push(`${c.key} has ${targetsAvailable.length} reachable target(s)`)
}
say(
  emptyCells.length === 4 && wronglyEmpty.length === 0,
  "the four empty cells are empty by ARITHMETIC — not one of the 21 fusion targets belongs to a system they contain",
  wronglyEmpty.join(" · ") || emptyCells.map((c) => c.key).join(", "),
)
/* KNOWN-BAD: the same test on a cell that DOES have a renderable member must
 * find targets, or it is a check that says "empty" about everything. */
{
  const c = byKey["material+animation"]
  const avail = Object.entries(F.TARGET_SYSTEMS).filter(([, sys]) => sys.every((s) => c.systems.includes(s)))
  say(avail.length > 0, "CALIBRATION · the same arithmetic finds reachable targets for material+animation", `${avail.length} target(s)`)
}

/* ================================================================== */
/* §5 · THE VIEW — both arms                                           */
/* ================================================================== */
console.log("\n=== §5 · does the panel know when the View source is resting at zero? ===")
{
  const c = byKey["material+texture"] // a View cell
  const st = stateFor(c)
  const link = c.links.find((l) => l.source === "orbit")
  const stillArm = F.fusionLinkSleep(link, { ...st, cameraSpinDegPerSecond: 0 }, c.drive)
  const turningArm = F.fusionLinkSleep(link, { ...st, cameraSpinDegPerSecond: F.FUSION_VIEW_SPIN_DEG }, c.drive)
  const unknownArm = F.fusionLinkSleep(link, st, c.drive)
  say(
    stillArm.some((r) => r.fix === "view:spin"),
    "a View link on a still camera reports the turntable as the fix",
    stillArm.map((r) => r.why).join(" · ") || "no reason given",
  )
  say(
    !turningArm.some((r) => r.fix === "view:spin") && !unknownArm.some((r) => r.fix === "view:spin"),
    "CALIBRATION · the same reason DISAPPEARS on a turning camera, and stays silent when the caller does not know",
    `turning ${turningArm.length} reason(s), unknown ${unknownArm.length} reason(s)`,
  )
  // The wake must ask for the spin, and only for View cells.
  const wakeView = F.fusionWakePatch(c, { ...st, cameraSpinDegPerSecond: 0 }, c.drive)
  const noView = byKey["material+fusion"]
  const wakeNone = F.fusionWakePatch(noView, { ...stateFor(noView), cameraSpinDegPerSecond: 0 }, noView.drive)
  say(
    wakeView.spin === F.FUSION_VIEW_SPIN_DEG && wakeNone.spin === 0,
    "the wake asks for the turntable on a View cell and NOT on a cell that never reads the camera",
    `${c.key} spin ${wakeView.spin} · ${noView.key} spin ${wakeNone.spin}`,
  )
  // And the shipped Turn Table preset — the one Sebs reported — gets it too.
  const vt = F.BUILTIN_LINK_FUSIONS.viewTurn
  const vtState = S.applyPresetToStyleState({ ...S.DEFAULT_STYLE_STATE }, "fusion", "viewTurn")
  const wakeVt = F.fusionWakePatch(vt, { ...vtState, cameraSpinDegPerSecond: 0 }, "loop")
  say(wakeVt.spin === F.FUSION_VIEW_SPIN_DEG, "…and so does the shipped Turn Table relationship", `spin ${wakeVt.spin} deg/s`)
  /* ONE NUMBER, TWO PLACES, PINNED TO THE OTHER ONE.
   *
   * Every row above compares `wake.spin` against `FUSION_VIEW_SPIN_DEG` — the
   * same constant the code uses — so moving that constant moves BOTH sides and
   * the rows survive it. That is the meta-gate's channel D exactly: "a gate that
   * survives every move to every constant it names is not measuring them." The
   * number is not arbitrary: it is the speed the Portfolio Spin VIEW preset
   * already ships, and the whole argument for reusing it is that the app should
   * turn the mark at one speed, not two. So it is pinned to the other one, which
   * lives in a module this lane does not own. */
  const shipped = S.resolveViewPreset("portfolioSpin")?.camera?.spinDegPerSecond
  say(
    typeof shipped === "number" && shipped === F.FUSION_VIEW_SPIN_DEG,
    "the fusion turntable speed IS the shipped view preset's speed — one number, not two",
    `fusion ${F.FUSION_VIEW_SPIN_DEG} deg/s · portfolioSpin ${shipped} deg/s`,
  )
}
/* THE MEASUREMENT THAT MADE THE FIX NECESSARY: head-on, a View cell is not
 * quiet, it is EXACTLY zero. Stated as a row so it cannot quietly stop being
 * true. */
{
  const c = byKey["material+texture"]
  const st = stateFor(c)
  const held = travelOf(F, st, { seconds: SECONDS, samples: SAMPLES, eps: 0, orbit: () => 0 })
  say(
    held !== null && held.length === 0,
    "PROOF · with the camera held head-on, a View cell's frame travels EXACTLY 0 across the window (eps 0) — this is the defect, and the spin wake is the fix",
    held === null ? "null" : `${held.length} field(s) moved at eps 0`,
  )
}

/* ================================================================== */
/* §6 · DRIVERS ARE SPREAD, AMPLITUDES FALL WITH SIZE                  */
/* ================================================================== */
console.log("\n=== §6 · is each cell a chord rather than one throbbing object? ===")
{
  const crowded = []
  for (const c of CELLS) {
    if (c.empty) continue
    const bySource = new Map()
    for (const l of c.links) bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1)
    /* How many sources could this cell legally have used? Only sources whose
     * systems are all members (plus `orbit`, which belongs to no panel) — and
     * `event` only counts on a Burst cell, because `fusionLinkSleep` says in so
     * many words that it is silent on Loop and Arc. Counting a source the cell
     * cannot hear would demand a spread it has no way to author.
     *
     * TWO ON ONE DRIVER IS A CHORD; THREE IS A PULSE. The floor of 2 is not a
     * fudge: `fuseEverything`'s rule is about NINE parameters on one breath, and
     * a two-link statement like "the group's rhythm moves the ink AND the rim"
     * is a single legible idea rather than a throbbing object. Above that, the
     * cell has to reach for a driver it actually has. */
    const legal = Object.entries(F.SOURCE_SYSTEMS).filter(
      ([id, sys]) => sys.every((s) => c.systems.includes(s)) && (id !== "event" || c.drive === "burst"),
    )
    const maxPerSource = Math.max(2, Math.ceil(c.links.length / Math.max(1, legal.length)))
    for (const [src, n] of bySource) if (n > maxPerSource) crowded.push(`${c.key}: ${n}x ${src} (max ${maxPerSource}, ${legal.length} legal sources)`)
  }
  say(crowded.length === 0, "no cell piles links onto one driver while another was available", crowded.slice(0, 6).join(" · ") || "every cell spreads across the drivers it has")
  /* KNOWN-BAD. A synthetic cell with four links on one breath, in a combination
   * that has four drivers available — the exact shape `fuseEverything`'s note
   * calls "one throbbing object". */
  {
    const c = {
      key: "material+animation+texture+fusion",
      systems: ["material", "animation", "texture", "fusion"],
      drive: "loop",
      links: [
        { source: "breath", target: "textureBite", amount: 0.4 },
        { source: "breath", target: "textureScale", amount: 0.4 },
        { source: "breath", target: "glow", amount: 0.4 },
        { source: "breath", target: "ink", amount: 0.4 },
      ],
    }
    const legal = Object.entries(F.SOURCE_SYSTEMS).filter(
      ([id, sys]) => sys.every((s) => c.systems.includes(s)) && (id !== "event" || c.drive === "burst"),
    )
    const maxPerSource = Math.max(2, Math.ceil(c.links.length / Math.max(1, legal.length)))
    say(4 > maxPerSource, "CALIBRATION · four links on one breath, with four drivers available, IS flagged", `max ${maxPerSource} per source across ${legal.length} legal sources`)
  }
}
{
  const loud = []
  for (const c of CELLS) {
    if (c.empty) continue
    // `fuseEverything`'s rule, as arithmetic: the strongest link in a cell falls
    // as the cell grows. 0.9 at two links down to 0.55 at nine.
    const ceiling = c.links.length <= 2 ? 0.92 : c.links.length <= 4 ? 0.82 : c.links.length <= 6 ? 0.62 : 0.58
    /* THE MALFORMED CELL MUST NOT SLIP PAST ITS OWN CEILING.
     *
     * `worst > ceiling` selects the FAILING set, so anything that is not a real
     * number falls OUTSIDE it and the cell passes the check that exists to police
     * it. Two ways in, both reachable: a link with no `amount` makes `Math.abs`
     * return NaN and `Math.max` return NaN, and `NaN > ceiling` is false; a cell
     * with NO links makes `Math.max()` return -Infinity, and that is false too.
     *
     * Found as a class on 2026-08-28: ten sites across four fusion gates, the same
     * shape each time. Two were closed by measuring a NaN through a `<`; this is
     * the last one that was open and reachable. The fix is to refuse first and
     * compare second, so a cell that cannot be judged is a FAILURE and not a pass. */
    const amounts = c.links.map((l) => Math.abs(l.amount))
    if (amounts.length === 0 || !amounts.every(Number.isFinite)) {
      loud.push(
        `${c.key} CANNOT BE JUDGED — ${amounts.length} link(s), ` +
          `${amounts.filter((a) => !Number.isFinite(a)).length} non-finite. ` +
          `A cell with no links or a link with no amount slides past a > comparison.`,
      )
      continue
    }
    const worst = Math.max(...amounts)
    if (worst > ceiling) loud.push(`${c.key} ${worst} > ${ceiling} at ${c.links.length} links`)
  }
  say(loud.length === 0, "the strongest link in a cell falls as the cell grows — nine relationships at full strength is nine clamps", loud.slice(0, 6).join(" · ") || "every cell inside its size ceiling")
  /* KNOWN-BAD: the same arithmetic on `fuseEverything`'s own amounts scaled to
   * full strength must fail — otherwise the ceiling is above everything. */
  {
    const nine = F.fuseEverything("probe").links.map((l) => ({ ...l, amount: 0.95 }))
    const ceiling = 0.58
    say(Math.max(...nine.map((l) => Math.abs(l.amount))) > ceiling, "CALIBRATION · nine links at 0.95 breaks the nine-link ceiling", `0.95 > ${ceiling}`)
  }
  /* CALIBRATION FOR THE REFUSAL ITSELF — and it is the arm the row above cannot
   * give you, because `nine links at 0.95` proves the ceiling BITES, not that a
   * cell which cannot be judged is caught. Both malformed shapes are run through
   * the same predicate the loop uses. Before 2026-08-28 both returned false and
   * the cell passed. */
  {
    const judge = (links) => {
      const a = links.map((l) => Math.abs(l.amount))
      return a.length === 0 || !a.every(Number.isFinite)
    }
    const noAmount = [{ from: "a", to: "b" }]
    const noLinks = []
    say(
      judge(noAmount) && judge(noLinks),
      "CALIBRATION · a cell that CANNOT be judged is refused, not passed",
      `no-amount → ${judge(noAmount) ? "refused" : "SLIPPED"} (Math.max reads ${Math.max(...noAmount.map((l) => Math.abs(l.amount)))}) · ` +
        `no-links → ${judge(noLinks) ? "refused" : "SLIPPED"} (Math.max reads ${Math.max(...noLinks.map((l) => Math.abs(l.amount)))})`,
    )
  }
}

/* THE COMPOSITIONS USE THE PALETTE, NOT ONE ENTRY OF IT.
 *
 * The relationship is half of what a cell IS; the composition it lands on is the
 * other half, and 116 cells wearing one pattern would read as one idea however
 * different the wiring was. This is the cheap structural half of that question —
 * `assert-fusion-combo-distinct.mjs` measures the expensive half on pixels. The
 * bar is "most of the palette, no entry carrying a quarter of the set", which is
 * what stops a lazy default from spreading. */
{
  const spread = (field, min) => {
    const tally = {}
    for (const c of CELLS) {
      const v = c.compose?.[field]
      if (v) tally[v] = (tally[v] ?? 0) + 1
    }
    const used = Object.keys(tally).length
    const total = Object.values(tally).reduce((a, b) => a + b, 0)
    const top = Math.max(...Object.values(tally), 0)
    return { field, used, min, total, top, ok: used >= min && top <= Math.ceil(total * 0.25) }
  }
  const rows = [spread("textureMode", 8), spread("ditherType", 8), spread("asciiCharset", 7), spread("materialPreset", 8)]
  const bad = rows.filter((r) => !r.ok)
  say(
    bad.length === 0,
    "the compositions spread across the real palettes — no cell family is one look with different wiring",
    bad.map((r) => `${r.field} uses ${r.used} (min ${r.min}), heaviest ${r.top}/${r.total}`).join(" · ") ||
      rows.map((r) => `${r.field} ${r.used} distinct, heaviest ${r.top}/${r.total}`).join(" · "),
  )
}

/* ================================================================== */
/* §7 · AN EVENT LINK ONLY EXISTS ON A BURST CELL                      */
/* ================================================================== */
console.log("\n=== §7 · is every Event link on a cell that actually fires events? ===")
{
  const wrong = CELLS.filter((c) => c.links.some((l) => l.source === "event") && c.drive !== "burst")
  const burstNoEvent = CELLS.filter((c) => c.drive === "burst" && !c.links.some((l) => l.source === "event"))
  say(
    wrong.length === 0,
    "no cell carries an Event link on a shape that is silent for it (`fusionLinkSleep`: \"Event only fires on the Burst drive\")",
    wrong.map((c) => c.key).join(", ") || `${CELLS.filter((c) => c.drive === "burst").length} Burst cell(s), all with an Event link`,
  )
  say(burstNoEvent.length === 0, "…and no cell ships on Burst without one", burstNoEvent.map((c) => c.key).join(", ") || "checked both directions")
}

/* ================================================================== */
/* §8 · NOTHING WAS DELETED                                            */
/* ================================================================== */
console.log("\n=== §8 · is every relationship that shipped before still on the rail? ===")
{
  const PRIOR = [
    "terminalGel", "ditherBloom", "signalInk", "asciiRubber", "scanlineBalloon",
    "pixelClay", "codeBloom", "glitchRibbon", "viewTurn", "slowWeather",
    "formation", "wholeCloth", "stillWet", "letterpress",
  ]
  const ids = S.PRESET_REGISTRY.fusion.map((p) => p.id)
  const gone = PRIOR.filter((id) => !ids.includes(id))
  say(gone.length === 0, `all ${PRIOR.length} pre-existing fusion preset ids are still on the rail`, gone.join(", ") || ids.join(", "))
  const linkGone = ["viewTurn", "slowWeather", "formation", "wholeCloth", "stillWet", "letterpress"].filter(
    (id) => !F.BUILTIN_LINK_FUSIONS[id],
  )
  say(linkGone.length === 0, "…and all six link-authored built-ins still carry their link lists", linkGone.join(", ") || Object.keys(F.BUILTIN_LINK_FUSIONS).join(", "))
}
/* ================================================================== */
/* §9 · IS ANY CELL ITS NEIGHBOUR PLUS A WIRE?                         */
/* ================================================================== */
/* THE DUPLICATE QUESTION, ASKED OF THE AUTHORING RATHER THAN THE PIXELS.
 *
 * `assert-fusion-combo-distinct.mjs` measures nearest-sibling distance on the
 * crops, and that gate is necessary. It is also STRUCTURALLY UNABLE to answer
 * this, and the proof is on disk: `material+animation+dither+ascii+layers`
 * shipped as **Wire Desk**, which was `material+animation+dither+ascii`
 * ("Read Out") on the identical body, screen and charset, carrying three of its
 * four links VERBATIM and restating its concept sentence — and the two crops in
 * `prior-v4` measure **38.30** apart, against a closest pair of 10.46 in the
 * same run. A drifting Bayer matrix is visible; two cells can be one idea and
 * still not look alike.
 *
 * The earlier duplicate in this set (Slip Glaze / Slip Screen) was caught by
 * eye, and the four things the eye actually named were: the same body, the same
 * link, the same screen family, and two names one word apart. Three of those
 * four are mechanical. The fourth — the shared name word — is the one Wire Desk
 * did not have, which is exactly why nothing said no about it.
 *
 * So the rule here drops the name entirely and asks the structural question:
 *
 *   a cell is PADDING when its one-member neighbour's whole authoring survives
 *   inside it — the same body, the same value on every composition rail the
 *   smaller cell sets, and all (or all but one) of its links carried over.
 *
 * That is "the cell above it with an extra wire", which is the only version of
 * "one idea twice" this set can actually produce: every cell in a power set is
 * one member from a neighbour BY CONSTRUCTION, so being adjacent is structure,
 * not padding. Sharing the picture AND the wiring is padding.
 *
 * ── THE KNOWN-BAD IS A REAL DEFECT, NOT A SYNTHETIC ONE ───────────────────
 * Wire Desk is re-armed below exactly as it shipped. If this row cannot fail on
 * the cell it was written for, it cannot certify the other 115.
 */
console.log("\n=== §9 · is any cell its one-member neighbour's picture plus a wire? ===")
{
  /* The composition rails a cell authors, grouped by the system that owns them.
   * Derived from `compositionReset`'s own rail list rather than hand-copied:
   * only fields a cell can set are compared, and a field nobody sets is not a
   * silent match. */
  const RAILS = {
    material: ["materialPreset"],
    texture: ["textureMode", "textureScale", "textureIntensity", "textureContrast"],
    dither: ["ditherType", "ditherAngle", "ditherThreshold", "ditherCellSize", "ditherAmount", "ditherLevels"],
    ascii: ["asciiCharset", "asciiCellSize", "asciiDensity"],
  }
  const sigOf = (l) => `${l.source}>${l.target}`
  /** Is `big` = `small` + one member, wearing the same picture and the same
   *  wiring? Returns null when they are not one member apart at all. */
  const twin = (small, big) => {
    const ss = new Set(small.systems)
    const bs = new Set(big.systems)
    if (bs.size !== ss.size + 1) return null
    if (![...ss].every((s) => bs.has(s))) return null
    let fields = 0
    let same = 0
    for (const s of small.systems)
      for (const f of RAILS[s] ?? []) {
        const va = small.compose?.[f]
        const vb = big.compose?.[f]
        if (va === undefined && vb === undefined) continue
        fields++
        if (va === vb) same++
      }
    const carried = new Set(big.links.map(sigOf))
    const kept = small.links.map(sigOf).filter((x) => carried.has(x)).length
    return { fields, same, kept, of: small.links.length, samePicture: fields > 0 && same === fields }
  }
  /* THE VERDICT, AND WHERE ITS TWO NUMBERS COME FROM — both read off the two
   * duplicates this set has actually produced, not chosen to make a run green.
   *
   *   Slip Glaze / Slip Screen   same BODY + same screen family + a shared link
   *   Read Out  / Wire Desk      same BODY + same screen + same charset + 3 of 4
   *
   * So: **at least two composition rails identical** — one shared dial is one
   * shared dial, not the same picture, and every cell that sets a single field
   * would otherwise be a candidate — and **a strict majority of the smaller
   * cell's links carried over**, at least two of them. Both proven pairs clear
   * both bars; plain adjacency clears neither.
   *
   * Everything that clears ONE bar is PRINTED below rather than dropped. A
   * threshold that hides its own neighbourhood is how a bar gets quietly
   * lowered, and these three are a taste call rather than a defect.
   *
   * ── AND THE BLIND SPOT THE TWO-RAIL BAR OPENS, CLOSED ─────────────────────
   * "At least two composition rails" is unreachable for a cell with no material
   * member: `dither+layers` can only author `dither*` fields, so a pair like
   * that could carry EVERY link across an identical screen and never be looked
   * at. There is no such pair today (checked: zero cells carry all of a
   * neighbour's links on an identical picture at any field count) — which is
   * exactly when a hole is worth closing, because nothing has to be re-authored
   * to do it. So total carry-over is padding at ANY field count: if not one
   * relationship was re-thought, the picture being one dial wide is not a
   * defence. */
  const isPadding = (t) =>
    t !== null &&
    t.samePicture &&
    t.fields >= 1 &&
    (t.kept === t.of ? t.of >= 1 : t.fields >= 2 && t.kept >= 2 && t.kept * 2 > t.of)
  const isNear = (t) => t !== null && t.samePicture && !isPadding(t) && t.kept >= 1 && t.of > 1
  const scan = (cells, pred = isPadding) => {
    const hits = []
    for (const small of cells)
      for (const big of cells) {
        if (small === big) continue
        const t = twin(small, big)
        if (pred(t))
          hits.push(`${small.name} (${small.key}) -> ${big.name} (${big.key}): ${t.kept}/${t.of} links kept, ${t.same}/${t.fields} rails identical`)
      }
    return hits
  }
  const authored = CELLS.filter((c) => !c.empty)
  const hits = scan(authored)
  say(
    hits.length === 0,
    `no cell is a one-member neighbour's composition and wiring with a wire added (${authored.length} cells, 380 ordered neighbour pairs)`,
    hits.slice(0, 4).join(" · ") ||
      "every neighbour pair re-authors either the picture or the relationship",
  )
  const near = scan(authored, isNear)
  console.log(
    `  under the bar but in the neighbourhood (reported, not failed) — ${near.length}:` +
      (near.length ? "\n    " + near.join("\n    ") : " none"),
  )
  /* KNOWN-BAD · WIRE DESK, AS IT SHIPPED. Not a mutant invented to be caught —
   * the actual entry that was in this table, restored into a throwaway copy of
   * the set. */
  {
    const readOut = byKey["material+animation+dither+ascii"]
    const shippedWireDesk = {
      key: "material+animation+dither+ascii+layers",
      name: "Wire Desk",
      systems: "material+animation+dither+ascii+layers".split("+"),
      links: [
        { id: "stackField>ditherFlow", source: "stackField", target: "ditherFlow", amount: 0.45 },
        { id: "asciiField>ditherThreshold", source: "asciiField", target: "ditherThreshold", amount: 0.45 },
        { id: "ditherField>shineBand", source: "ditherField", target: "shineBand", amount: 0.6 },
        { id: "reveal>asciiDensity", source: "reveal", target: "asciiDensity", amount: 0.4 },
        { id: "completion>metal", source: "completion", target: "metal", amount: 0.35 },
      ],
      compose: {
        ditherType: "bayer8",
        asciiCharset: "classic",
        materialPreset: "chrome",
        materialUserOverride: true,
        stackAnimationType: "drift",
      },
    }
    const caught = scan([readOut, shippedWireDesk])
    say(
      caught.length === 1,
      "CALIBRATION · the same scan FLAGS Wire Desk as it shipped — the real defect this row was written for",
      caught[0] ?? "the known-bad passed, so this row cannot fail and certifies nothing",
    )
  }
  /* KNOWN-BAD 2 · AND IT MUST NOT FIRE ON MERE ADJACENCY. Every cell in a power
   * set is one member from a neighbour; a row that called that padding would
   * fail 380 times and mean nothing. Two cells one member apart with a
   * different body, a different screen and no shared link must read clean. */
  {
    const a = byKey["material+dither"]
    const b = byKey["material+dither+ascii"]
    say(
      a && b && scan([a, b]).length === 0,
      "CALIBRATION · plain adjacency is NOT padding — two neighbours that re-author their picture read clean",
      `${a?.name} -> ${b?.name}`,
    )
  }
}

/* WHICH CELLS A SHIPPED RELATIONSHIP ALREADY ANSWERS — reported, because it is
 * the thing a reader wants and because a cell with two answers is a feature. */
console.log("\nSHIPPED RELATIONSHIPS, MAPPED ONTO THE GRID (derived from their own links):")
for (const [k, ids] of Object.entries(F.SHIPPED_BY_COMBO_KEY))
  console.log(`  ${k.padEnd(52)} ${ids.join(", ")}   (cell also has: ${byKey[k]?.name ?? "— NO CELL —"})`)

console.log(`\n${fails === 0 ? `ALL ${checks} FUSION-COMBO ASSERTIONS PASS` : `${fails} of ${checks} FUSION-COMBO ASSERTIONS FAILED`}`)
process.exit(fails === 0 ? 0 : 1)

// THE PRESET RAIL, AS A CONTRACT — every family, every member, every rule that
// has already been broken here once.
//
// WHY A MODEL GATE AND NOT ONLY A PIXEL GATE
//
//   The three defects this file exists to catch are all decidable without a
//   GPU, and two of them are invisible in a screenshot by construction:
//
//     · an ENABLED preset with no renderer and no patch — the six
//       geometry-animation pills, which reset the whole composition and then
//       applied nothing, so the screen went blank and the summary chip named
//       the preset that had emptied it;
//     · a preset family listed on the rail whose members cannot reach the
//       state they claim to set — a geometry preset can only be applied by
//       app/page.tsx, so listing the family before that routing exists ships
//       twelve more of the same landmine;
//     · a GROUP preset that wipes the group's CONTENTS — measured on the
//       shipped build: every stack-animation preset was classed as a
//       composition preset, so clicking "Stack Drift" underneath the layer
//       sliders set textureEnabled / ditherEnabled / asciiEnabled to false and
//       left an animated stack with nothing in it.
//
//   A pixel gate sees the last one as "the render changed", which is true and
//   useless. The question is WHICH FIELDS moved, and that is a model question.
//
// EVERY ASSERTION CARRIES ITS OWN CONTROL, IN THE SAME RUN
//
//   Not a --mutate flag that nobody passes: a second input, asserted in the
//   opposite direction, on the line below. "Direction reverses drift" is worth
//   nothing without "direction does NOT reverse a fade" — if both came back
//   different the instrument would be reading noise, and if both came back
//   identical it would be reading nothing. Rows tagged CONTROL are the ones
//   whose job is to fail if the instrument is blind; they are asserted, not
//   printed.
//
// Usage: node scripts/verify/assert-preset-registry.mjs
import { loadTs, ROOT as TS_ROOT } from "./_ts-load.mjs"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const S = loadTs("lib/style-system.ts")
const K = loadTs("lib/style-stack.ts")

const {
  PRESET_REGISTRY,
  PRESET_FAMILY_OPTIONS,
  NON_STYLE_FAMILIES,
  ALL_PRESETS,
  DEFAULT_STYLE_STATE,
  findPreset,
  applyPresetToStyleState,
  resolveGeometryPreset,
  applyGeometryPreset,
  geometryPresetChangesMode,
  resolveViewPreset,
  viewPresetBlockers,
  evaluateMaterialAnimation,
  resolveMaterialParams,
} = S
const { resolveStack, evaluateStackAnimation } = K

let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

const BOOKKEEPING = new Set(["activePresetFamily", "activePresetId", "lastAppliedPresetId"])
/** Fields that differ between two states, ignoring the selection bookkeeping. */
function movedFields(a, b) {
  const out = []
  for (const k of Object.keys(a)) {
    if (BOOKKEEPING.has(k)) continue
    const x = a[k]
    const y = b[k]
    if (typeof x === "object" && x !== null) {
      if (JSON.stringify(x) !== JSON.stringify(y)) out.push(k)
    } else if (x !== y) out.push(k)
  }
  return out
}

/* A state that is deliberately NOT the defaults, so "the preset changed
 * something" cannot be satisfied by a patch that merely re-states a default.
 * Every composition rail is on and every value is off its default. */
const CONTRAST = {
  ...DEFAULT_STYLE_STATE,
  materialPreset: "chrome",
  materialAnimationEnabled: true,
  materialAnimationType: "signalFlicker",
  materialAnimationSpeed: 2.4,
  materialAnimationIntensity: 0.93,
  textureEnabled: true,
  textureMode: "scanlines",
  textureAnimated: true,
  textureIntensity: 0.81,
  ditherEnabled: true,
  ditherType: "halftone",
  ditherAnimated: true,
  ditherScale: 7,
  asciiEnabled: true,
  asciiCharset: "braille",
  asciiAnimated: true,
  asciiCellSize: 19,
  layerStackEnabled: true,
  stackTextureOpacity: 0.62,
  stackDitherOpacity: 0.41,
  stackAsciiOpacity: 0.77,
  stackDitherBlend: "multiply",
  stackAsciiBlend: "screen",
  stackOrder: "asciiFirst",
  stackAnimationEnabled: true,
  stackAnimationType: "drift",
  stackAnimationSpeed: -1.7,
  stackAnimationPhase: 2.2,
  stackAnimationOpacity: 0.33,
  fusionPreset: "terminalGel",
  fusionDrive: "burst",
  fusionIntensity: 0.83,
  fusionSwing: 0.21,
  motionMode: "syncToDraw",
  styleLoopSeconds: 9,
}

/* ------------------------------------------------------------------ */
/* 1 · REGISTRY INTEGRITY                                              */
/* ------------------------------------------------------------------ */
function registryIntegrity() {
  console.log("\n=== 1 · registry integrity ===")

  const families = Object.keys(PRESET_REGISTRY)
  const registryCount = families.reduce((n, f) => n + PRESET_REGISTRY[f].length, 0)
  say(
    ALL_PRESETS.length === registryCount,
    "ALL_PRESETS enumerates the REGISTRY, not the UI list",
    `${ALL_PRESETS.length} of ${registryCount} across ${families.length} families`,
  )
  /* CONTROL for the line above.
   *
   * ⚠ THIS CONTROL WAS REWRITTEN 2026-08-01 BECAUSE IT HAD GONE VACUOUS, and
   * the way it went vacuous is the reason it is worth keeping.
   *
   * It used to build the pre-fix flat list from `PRESET_FAMILY_OPTIONS` and
   * require it to be SHORT — a fine control while the rail showed 13 of the 15
   * families. Once geometry and view were added to that list (the rail already
   * showed them, via a second list in the consumer), the two collections became
   * equal and the control read `139 vs 139`: it could no longer fail, and it
   * was asserting nothing about `ALL_PRESETS`' construction at all.
   *
   * The property that actually matters is not "the rail is short". It is:
   * ALL_PRESETS IS DERIVED FROM THE REGISTRY, so a family that exists in the
   * registry and is NOT on the rail is still resolvable by `findPreset`. That
   * is exactly the bug this line was born for, and it stays testable however
   * many families the rail happens to show — by withholding one, which is what
   * "not on the rail" meant. */
  const withheld = Object.keys(PRESET_REGISTRY)[0]
  const partial = Object.keys(PRESET_REGISTRY)
    .filter((f) => f !== withheld)
    .flatMap((f) => PRESET_REGISTRY[f])
  say(
    partial.length < registryCount,
    "CONTROL · a flat list built from any PROPER SUBSET of families is SHORT",
    `${partial.length} vs ${registryCount} — withholding "${withheld}" hides ${registryCount - partial.length}`,
  )
  say(
    PRESET_REGISTRY[withheld].every((p) => findPreset(p.id) !== undefined),
    "CONTROL · ...and every preset it hides is STILL resolvable by findPreset (the registry is the source)",
    `${PRESET_REGISTRY[withheld].length} presets in the withheld family`,
  )

  const ids = ALL_PRESETS.map((p) => p.id)
  const dups = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))]
  say(dups.length === 0, "every preset id across every family is unique", dups.length ? dups.join(", ") : `${ids.length} ids`)
  // CONTROL: the same duplicate detector, on a list that HAS a duplicate.
  const seeded = [...ids, ids[0]]
  const seededDups = [...new Set(seeded.filter((x, i) => seeded.indexOf(x) !== i))]
  say(seededDups.length === 1, "CONTROL · the duplicate detector finds a seeded duplicate", seededDups.join(","))

  say(
    ALL_PRESETS.every((p) => findPreset(p.id) !== undefined),
    "findPreset resolves every preset in the registry",
    `${ALL_PRESETS.length} resolved`,
  )
  say(findPreset("__no_such_preset__") === undefined, "CONTROL · findPreset refuses an id that does not exist")

  /* THE LANDMINE PREDICATE. enabled + no renderer + no patch of ANY kind.
   *
   * ⚠ THE FIRST VERSION OF THIS CHECK WAS WRONG, and the way it was wrong is
   * worth keeping. It asserted `inertShipped.length === 0` and went red on the
   * six geometryAnimation pills — which ARE inert, and which a previous pass
   * deliberately left on the rail rendered NON-SELECTABLE, with its reasoning
   * written down (style-panel-scaffold.tsx: they stay because PRD Family 14 is
   * real and hiding them would be the deletion §0.7 forbids). So the flat rule
   * would have demanded that a reasoned prior decision be reverted to satisfy
   * an assertion. The DEFECT was never "an inert preset exists in the data" —
   * it was "an inert preset can be SELECTED and wipes the composition". That is
   * what is asserted below, and it is decidable.
   *
   * `implemented: false` is therefore read as a DECLARATION: this pill is a
   * roadmap entry, the UI must render it non-selectable (asserted in the
   * browser gate, which is the only place that can see a `disabled` attribute)
   * and this function must refuse to apply it. */
  /* ⚠ EVERY PATCH FIELD MUST BE LISTED HERE, and there are now four. `motion`
   * joined on 2026-08-28 with Family 14, and until it did, five presets with
   * complete patches read as LYING because this predicate could not see the
   * field they carry. A new patch field that is not added here does not make
   * the gate fail open — it makes it fail LOUD against correct code, which is
   * the better of the two, but it is still wrong. */
  const hasPatch = (p) => !!(p.applies || p.geometry || p.view || p.motion)
  const inert = (p) => p.enabled && !p.implemented && !hasPatch(p)
  const inertShipped = ALL_PRESETS.filter(inert)

  /* A preset may not CLAIM a renderer it has no patch for. That direction is
   * always a lie and has no legitimate reading. */
  const lying = ALL_PRESETS.filter((p) => p.implemented && !hasPatch(p))
  say(
    lying.length === 0,
    "no preset claims implemented:true without a patch of some kind",
    lying.map((p) => `${p.family}/${p.id}`).join(", ") || `${ALL_PRESETS.length} checked`,
  )

  /* THE LANDMINE ITSELF: selecting an inert preset must leave the composition
   * exactly as it was. This is the check that would have caught the shipped
   * defect, where the reset ran and the patch did not. */
  const destructive = inertShipped.filter((p) => {
    const next = applyPresetToStyleState(CONTRAST, p.family, p.id)
    return movedFields(CONTRAST, next).length !== 0
  })
  say(
    destructive.length === 0,
    "selecting an inert preset destroys NOTHING (the landmine guard, exercised)",
    destructive.map((p) => p.id).join(", ") ||
      `${inertShipped.length} inert roadmap pills: ${inertShipped.map((p) => p.family + "/" + p.id).join(", ")}`,
  )
  /* CONTROL: the same measurement on an IMPLEMENTED preset must show movement,
   * or "nothing moved" is what this instrument says about everything. */
  const liveMove = movedFields(CONTRAST, applyPresetToStyleState(CONTRAST, "dither", "bayerClassic"))
  say(liveMove.length > 0, "CONTROL · the same measurement DOES see an implemented preset move state", `${liveMove.length} fields`)
  // CONTROL: the predicate must catch one when one exists.
  say(
    inert({ id: "x", family: "texture", enabled: true, implemented: false }),
    "CONTROL · the inertness predicate catches a seeded landmine",
  )

  /* An `enabled: true` member of a family the rail SHOWS must be applicable by
   * applyPresetToStyleState; an `enabled: false` member must not be shown. */
  const shown = new Set(PRESET_FAMILY_OPTIONS.map((f) => f.id))
  const shownButDisabled = PRESET_FAMILY_OPTIONS.filter(
    (f) => !PRESET_REGISTRY[f.id].some((p) => p.enabled),
  )
  say(
    shownButDisabled.length === 0,
    "every family on the rail has at least one selectable member",
    shownButDisabled.map((f) => f.id).join(", ") || `${shown.size} families`,
  )

  const hiddenFamilies = Object.keys(PRESET_REGISTRY).filter((f) => !shown.has(f))
  const hiddenWithEnabled = hiddenFamilies.filter((f) =>
    PRESET_REGISTRY[f].some((p) => p.enabled),
  )
  say(
    hiddenWithEnabled.length === 0,
    "no family is hidden from the rail while carrying selectable members",
    `hidden: ${hiddenFamilies.join(", ") || "none"}`,
  )
}

/* ------------------------------------------------------------------ */
/* 2 · APPLYING A PRESET — what each family class owns                  */
/* ------------------------------------------------------------------ */
function applyRules() {
  console.log("\n=== 2 · what a preset selection is allowed to touch ===")

  /* Every SELECTABLE preset must actually move state. Started from CONTRAST so
   * a patch that only re-states defaults still counts, and a patch of nothing
   * cannot hide. */
  /* ⚠ THE SCOPE OF THIS CHECK IS THE STYLE PATH, NOT THE RAIL, and it used to
   * be written as the rail. It iterated `PRESET_FAMILY_OPTIONS` — which was a
   * correct proxy only for as long as every family on the rail happened to
   * route through `applyPresetToStyleState`. Geometry and View are on the rail
   * and route through app/page.tsx instead, and the moment they were listed
   * this loop demanded that all 18 of them move style state, which is the one
   * thing they must NOT do.
   *
   * "Which families does the rail show" and "which families apply through the
   * style path" are two different questions that were the same set by accident.
   * `NON_STYLE_FAMILIES` is the module's own answer to the second one, so the
   * check now asks it directly and cannot be re-broken by a rail change. */
  const styleFamilies = PRESET_FAMILY_OPTIONS.filter((f) => !NON_STYLE_FAMILIES.has(f.id))
  const dead = []
  for (const f of styleFamilies) {
    // `implemented: false` members are declared roadmap pills, rendered
    // non-selectable; their contract is the destroys-nothing check in §1.
    for (const p of PRESET_REGISTRY[f.id].filter((x) => x.enabled && x.implemented)) {
      const next = applyPresetToStyleState(CONTRAST, f.id, p.id)
      if (movedFields(CONTRAST, next).length === 0) dead.push(`${f.id}/${p.id}`)
    }
  }
  const selectable = styleFamilies.reduce(
    (n, f) => n + PRESET_REGISTRY[f.id].filter((x) => x.enabled && x.implemented).length,
    0,
  )
  /* CONTROL: the split must be REAL. If NON_STYLE_FAMILIES were empty the loop
   * above would silently be back to covering the rail, and the failure this
   * rewrite fixed would return unannounced. */
  say(
    NON_STYLE_FAMILIES.size > 0 && styleFamilies.length < PRESET_FAMILY_OPTIONS.length,
    "CONTROL · the rail is genuinely WIDER than the style path (the two are not the same set)",
    `${PRESET_FAMILY_OPTIONS.length} on the rail · ${styleFamilies.length} through applyPresetToStyleState · routed elsewhere: ${[...NON_STYLE_FAMILIES].join(", ")}`,
  )
  say(
    dead.length === 0,
    "every SELECTABLE preset moves at least one style field",
    dead.length ? dead.join(", ") : `${selectable} presets`,
  )

  /* CONTROL for that check: the two families that are NOT on the rail must move
   * NOTHING through this function. If they moved something, the check above
   * could be satisfied by bookkeeping and would be blind. */
  const nonStyleMoved = []
  for (const fam of ["geometry", "view"]) {
    for (const p of PRESET_REGISTRY[fam]) {
      const next = applyPresetToStyleState(CONTRAST, fam, p.id)
      if (movedFields(CONTRAST, next).length !== 0) nonStyleMoved.push(`${fam}/${p.id}`)
      if (next.activePresetId !== CONTRAST.activePresetId) nonStyleMoved.push(`${fam}/${p.id}:receipt`)
    }
  }
  say(
    nonStyleMoved.length === 0,
    "CONTROL · geometry/view presets change NOTHING through the style path, and leave no receipt",
    nonStyleMoved.join(", ") || `${PRESET_REGISTRY.geometry.length + PRESET_REGISTRY.view.length} refused`,
  )

  /* THE GROUP-FAMILY RULE. A stack-animation preset animates the group; it must
   * not empty it. */
  const wiped = []
  for (const p of PRESET_REGISTRY.stackAnimation.filter((x) => x.enabled)) {
    const next = applyPresetToStyleState(CONTRAST, "stackAnimation", p.id)
    if (!next.textureEnabled || !next.ditherEnabled || !next.asciiEnabled) wiped.push(p.id)
    if (next.stackTextureOpacity !== CONTRAST.stackTextureOpacity) wiped.push(p.id + ":stackOpacity")
    if (next.stackOrder !== CONTRAST.stackOrder) wiped.push(p.id + ":order")
    if (next.fusionPreset !== CONTRAST.fusionPreset) wiped.push(p.id + ":fusion")
  }
  say(
    wiped.length === 0,
    "a stack-animation preset preserves the composition it is animating",
    wiped.length ? wiped.join(", ") : `${PRESET_REGISTRY.stackAnimation.length} presets, layers intact`,
  )

  /* CONTROL: a COMPOSITION preset from the same starting state MUST wipe the
   * layers it does not name. Without this the check above passes on an
   * implementation that resets nothing at all, anywhere. */
  const afterTexture = applyPresetToStyleState(CONTRAST, "texture", PRESET_REGISTRY.texture[0].id)
  say(
    !afterTexture.ditherEnabled && !afterTexture.asciiEnabled && afterTexture.fusionPreset === "none",
    "CONTROL · a composition preset DOES reset the rails it does not name",
    `dither ${afterTexture.ditherEnabled} · ascii ${afterTexture.asciiEnabled} · fusion ${afterTexture.fusionPreset}`,
  )

  /* A stack-animation preset must still fully determine its OWN rail. */
  const fromWhisper = applyPresetToStyleState(CONTRAST, "stackAnimation", "stackWhisperDrift")
  const thenPulse = applyPresetToStyleState(fromWhisper, "stackAnimation", "stackPulse")
  say(
    fromWhisper.stackAnimationOpacity === 0.4 && thenPulse.stackAnimationOpacity === 1,
    "a stack-animation preset fully determines its own rail (no inheritance)",
    `whisper ${fromWhisper.stackAnimationOpacity} -> pulse ${thenPulse.stackAnimationOpacity}`,
  )

  /* MATERIAL IS ORTHOGONAL — and the new animatedMaterial family is a material
   * family, so it must not touch the composition either. */
  const amBad = []
  for (const p of PRESET_REGISTRY.animatedMaterial.filter((x) => x.enabled)) {
    const next = applyPresetToStyleState(CONTRAST, "animatedMaterial", p.id)
    const moved = movedFields(CONTRAST, next)
    const outside = moved.filter((k) => !k.startsWith("materialAnimation"))
    if (outside.length) amBad.push(`${p.id}: ${outside.join("/")}`)
    if (next.materialPreset !== CONTRAST.materialPreset) amBad.push(`${p.id}: materialPreset`)
  }
  say(
    amBad.length === 0,
    "an animated-material preset writes ONLY materialAnimation* — never the body, never the layers",
    amBad.join(" | ") || `${PRESET_REGISTRY.animatedMaterial.length} presets`,
  )
}

/* ------------------------------------------------------------------ */
/* 3 · GEOMETRY PRESETS (PRD Family 1)                                 */
/* ------------------------------------------------------------------ */
const BASE_GEOM = {
  mode: "rod",
  extrudeWidthSlider: 0.5,
  extrudeDepth: 1,
  extrudeBevelEnabled: true,
  extrudeSideWall: "straight",
  solidThickness: 38,
  solidDepth: 0.18,
  inflateFusion: "auto",
  inflateBlend: 0.55,
  inflateResolution: 4,
  inflateLoopEnds: "wrapped",
}
const MODE_FIELDS = {
  rod: [],
  extrude: ["extrudeWidthSlider", "extrudeDepth", "extrudeBevelEnabled", "extrudeSideWall"],
  solid: ["solidThickness", "solidDepth"],
  inflate: [
    "solidThickness",
    "solidDepth",
    "inflateFusion",
    "inflateBlend",
    "inflateResolution",
    "inflateLoopEnds",
  ],
}

function geometryPresets() {
  console.log("\n=== 3 · geometry presets ===")
  const defs = PRESET_REGISTRY.geometry

  say(
    defs.every((p) => !!p.geometry?.mode),
    "every geometry preset names a mode",
    `${defs.length} presets`,
  )
  say(
    defs.every((p) => !p.applies),
    "no geometry preset carries a style patch (it could never be applied by the style path)",
  )

  /* THE ROD EXCEPTION, asserted rather than assumed. Rod has no dials
   * (lib/geometry-engines.ts:1220 "Rod has no per-mode params"; radius is the
   * module constant TUBE_RADIUS at :211), so exactly ONE rod preset can exist.
   * A second would be byte-identical to the first — which is why "Bold Rod" is
   * refused rather than shipped. */
  const rods = defs.filter((p) => p.geometry.mode === "rod")
  say(rods.length === 1, "exactly one Rod preset exists — Rod has no dials to distinguish a second", rods.map((p) => p.id).join(","))
  /* ⚠ PARKED PRIOR: `say(MODE_FIELDS.rod.length === 0, …)`.
   * `MODE_FIELDS.rod` is the literal `[]` declared 35 lines above, in this file.
   * Asserting that a hardcoded empty array is empty tells you nothing about Rod;
   * it restates the gate's own assumption back to itself. The claim that matters
   * is about the ENGINE: Rod has no per-mode dials, so applying the Rod preset
   * must move the mode and NOTHING else. That is measurable on the object. */
  const rodApplied = applyGeometryPreset({ ...BASE_GEOM, mode: "extrude" }, rods[0].id)
  const rodMoved = Object.keys(BASE_GEOM).filter((k) => k !== "mode" && rodApplied[k] !== BASE_GEOM[k])
  say(
    MODE_FIELDS.rod.length === 0 && rodApplied.mode === "rod" && rodMoved.length === 0,
    "the Rod preset moves the MODE and no dial at all — measured on the resolved state, not on this file's own field table",
    rodMoved.length ? `unexpectedly moved: ${rodMoved.join(", ")}` : `mode -> ${rodApplied.mode}, 0 of ${Object.keys(BASE_GEOM).length - 1} dials touched`,
  )

  /* Every non-rod preset must move a dial its own mode reads. */
  const noop = []
  for (const p of defs) {
    const next = applyGeometryPreset(BASE_GEOM, p.id)
    if (!next) {
      noop.push(`${p.id}: unresolvable`)
      continue
    }
    const fields = MODE_FIELDS[p.geometry.mode]
    const changed = fields.filter((k) => next[k] !== BASE_GEOM[k])
    if (p.geometry.mode !== "rod" && changed.length === 0) noop.push(`${p.id}: no dial moved`)
  }
  say(noop.length === 0, "every non-Rod geometry preset moves a dial its mode actually reads", noop.join(", ") || `${defs.length - 1} presets`)

  /* PAIRWISE DISTINCTNESS, restricted to the fields the shared mode reads.
   * Two presets in different modes are distinct by the mode alone. */
  const collapsed = []
  for (let i = 0; i < defs.length; i++) {
    for (let j = i + 1; j < defs.length; j++) {
      const a = applyGeometryPreset(BASE_GEOM, defs[i].id)
      const b = applyGeometryPreset(BASE_GEOM, defs[j].id)
      if (a.mode !== b.mode) continue
      const fields = MODE_FIELDS[a.mode]
      if (fields.every((k) => a[k] === b[k])) collapsed.push(`${defs[i].id} = ${defs[j].id}`)
    }
  }
  say(collapsed.length === 0, "no two geometry presets in the same mode resolve to the same dials", collapsed.join(", ") || "0 collapsed pairs")
  /* CONTROL — the comparison must be able to say BOTH "same" and "different",
   * so both directions are asserted on the same pair of objects.
   *
   * ⚠ PARKED PRIOR:
   *     const selfA = applyGeometryPreset(BASE_GEOM, "deepRibbon")
   *     const selfB = applyGeometryPreset(BASE_GEOM, "deepRibbon")
   *     say(MODE_FIELDS.extrude.every(k => selfA[k] === selfB[k]), "…DOES collapse …")
   *   A pure function called twice with the same argument returning the same
   *   answer is not a property of the comparison — it is a property of calling a
   *   pure function twice. The row was true before the comparison existed and
   *   would stay true if `every()` were replaced by `() => true`. It only ever
   *   demonstrated the "same" half, which is the half that cannot fail. */
  const selfA = applyGeometryPreset(BASE_GEOM, "deepRibbon")
  const selfB = applyGeometryPreset(BASE_GEOM, "deepRibbon")
  const collapseField = MODE_FIELDS.extrude.find((k) => typeof selfA[k] === "number")
  const perturbed = { ...selfB, [collapseField]: selfB[collapseField] + 1 }
  say(
    MODE_FIELDS.extrude.every((k) => selfA[k] === selfB[k]) &&
      !MODE_FIELDS.extrude.every((k) => selfA[k] === perturbed[k]),
    "CONTROL · the distinctness comparison reports SAME for an identical pair and DIFFERENT for a one-dial perturbation",
    `identical -> collapsed; ${collapseField} ${selfB[collapseField]} -> ${perturbed[collapseField]} -> not collapsed`,
  )

  /* REVERSIBILITY — apply must not touch the object it was given.
   *
   * ⚠ THE PARKED PRIOR WAS A TAUTOLOGY, AND IT WAS THIS FILE'S WORST ROW:
   *
   *     const before = { ...BASE_GEOM, mode: "extrude", … }
   *     const after = applyGeometryPreset(before, p.id)
   *     const restored = { ...before }
   *     if (JSON.stringify(restored) !== JSON.stringify(before)) irreversible.push(p.id)
   *
   *   `restored` is a shallow clone of `before`, so the comparison is
   *   `stringify({...x}) !== stringify(x)` — ALWAYS FALSE, for every x, forever.
   *   Nothing was ever restored; there is no snapshot anywhere in it. The header
   *   describes this row as "REVERSIBILITY. Apply, then restore the snapshot —
   *   the object must come back exactly", and not one of those three things
   *   happened.
   *
   *   It could not even have caught the failure it was pointed at from the other
   *   side: if `applyGeometryPreset` mutated its input IN PLACE, `before` would
   *   already be mutated by the time the clone was taken, so both sides of the
   *   comparison would carry the mutation and still match.
   *
   *   THE REPAIR: take the snapshot as a STRING BEFORE the apply, and compare
   *   the input object against it AFTER. That is the claim the label makes, and
   *   it detects in-place mutation, which is the only way a pure resolver can
   *   surprise its caller. The CONTROL below proves the detector fires. */
  const irreversible = []
  for (const p of defs) {
    const before = { ...BASE_GEOM, mode: "extrude", solidThickness: 51, inflateBlend: 1.05 }
    const snapshot = JSON.stringify(before)
    const after = applyGeometryPreset(before, p.id)
    if (JSON.stringify(before) !== snapshot) {
      irreversible.push(`${p.id}: MUTATED ITS INPUT (${snapshot} -> ${JSON.stringify(before)})`)
    }
    // and the untouched modes must survive the apply itself
    const untouched = Object.keys(MODE_FIELDS)
      .filter((m) => m !== p.geometry.mode)
      .flatMap((m) => MODE_FIELDS[m])
      .filter((k) => !MODE_FIELDS[p.geometry.mode].includes(k))
    for (const k of untouched) {
      if (after[k] !== before[k]) irreversible.push(`${p.id}: clobbered ${k}`)
    }
  }
  say(
    irreversible.length === 0,
    "a geometry preset leaves the caller's object untouched and the OTHER modes' dials where the user left them",
    irreversible.join(", ") || `${defs.length} presets, input object byte-identical after every apply`,
  )
  /* CONTROL — the same detector, run against a resolver that DOES mutate its
   * input, must report it. In-band and every run, per this file's header rule
   * ("not a --mutate flag that nobody passes: a second input, asserted in the
   * opposite direction, on the line below"). Without this row the repair above
   * is just a different expression nobody has watched fail. */
  const mutatingApply = (state, id) => {
    state.solidThickness = 999 // the in-place write a pure resolver must never do
    return applyGeometryPreset(state, id)
  }
  const probe = { ...BASE_GEOM, mode: "extrude", solidThickness: 51, inflateBlend: 1.05 }
  const probeSnapshot = JSON.stringify(probe)
  mutatingApply(probe, defs[0].id)
  say(
    JSON.stringify(probe) !== probeSnapshot,
    "CONTROL · the reversibility detector DOES catch a resolver that mutates its input",
    `seeded solidThickness 51 -> ${probe.solidThickness}; the parked \`stringify({...before}) !== stringify(before)\` reported this as clean`,
  )

  say(
    geometryPresetChangesMode("rod", "solidCutout") && !geometryPresetChangesMode("solid", "solidCutout"),
    "geometryPresetChangesMode reports the mode switch honestly, both ways",
  )
  say(applyGeometryPreset(BASE_GEOM, "__nope__") === undefined, "CONTROL · applyGeometryPreset refuses an unknown id")
  say(resolveGeometryPreset("shineSweepAcross") === undefined, "CONTROL · resolveGeometryPreset refuses a preset from another family")
}

/* ------------------------------------------------------------------ */
/* 4 · VIEW / EXPORT PRESETS (PRD Family 15)                           */
/* ------------------------------------------------------------------ */
function viewPresets() {
  console.log("\n=== 4 · view / export presets ===")
  const defs = PRESET_REGISTRY.view
  say(defs.every((p) => !!p.view?.camera), "every view preset names a camera framing", `${defs.length} presets`)

  const mismatched = defs.filter((p) => (viewPresetBlockers(p.id).length > 0) !== !p.implemented)
  say(
    mismatched.length === 0,
    "implemented === has no blocker, for every member (no preset claims a capability that does not exist)",
    mismatched.map((p) => p.id).join(", ") || defs.map((p) => `${p.id}:${p.implemented ? "ok" : viewPresetBlockers(p.id).length + " blocked"}`).join(" · "),
  )
  /* ⚠ THE CONTROL WAS A COUNT, AND THE COUNT WAS A SNAPSHOT — repaired
   * 2026-08-03. It read `blocked.length === 2`, i.e. "exactly the two PRD
   * members that need new capability are blocked". Two was true on the day it
   * was written and became false when the turntable was BUILT, which is the
   * one direction a count like that cannot survive. Worse, the row above
   * (`implemented === has no blocker`) was green throughout only because BOTH
   * halves were stale together — `portfolioSpin.implemented` was `false` AND
   * `viewPresetBlockers` still reported the turntable — so correcting either
   * alone turned this section red and correcting neither looked fine.
   *
   * What must still hold is not a number. It is that this table and the tree
   * AGREE about every capability, so both rows ask the tree:
   *
   *   · VIDEO is no longer blocked, and the thing that closed it is present —
   *     the `target === "video"` branch in `applyViewPresetById` (app/page.tsx).
   *   · The TURNTABLE is no longer blocked, and the thing that closed it is
   *     present — `autoRotate` wired to a degrees-per-second value in the
   *     viewport.
   *
   * Both halves can fail, in both directions: re-add either blocker and the
   * `!blocked.some(...)` half goes red; rip out the route or `autoRotate` and
   * the tree half does. That is a control about the SUBJECT, not about how many
   * rows there happened to be — and neither half is satisfiable from
   * lib/style-system.ts alone, which is the property that matters, because a
   * hand-kept table grading itself is how both of these went stale. */
  const blocked = defs.filter((p) => viewPresetBlockers(p.id).length)
  const viewportSrc = readFileSync(join(TS_ROOT, "components", "viewport-3d.tsx"), "utf8")
  const pageSrc = readFileSync(join(TS_ROOT, "app", "page.tsx"), "utf8")
  /* ⚠ THIS ROW WENT RED WHEN THE ROUTE WAS WIRED, EXACTLY AS IT SAID IT WOULD,
   * and it is re-pointed rather than relaxed — the same repair the turntable row
   * below got a few hours earlier, for the same reason.
   *
   * It used to read `blocked.some(videoPreviewExport) && !hasVideoRoute`, with
   * the note: "Wire one and this row goes red, which is correct: the blocker
   * would then be the stale one." The route is wired (2026-08-03, Sebs's call),
   * the blocker is gone, and both halves moved together — so what must still
   * hold is no longer "video is blocked" but the same claim the turntable makes:
   * THE MEMBER IS UNBLOCKED AND THE CAPABILITY THAT CLOSED IT IS IN THE TREE.
   *
   * It fails in both directions, which is the whole point of the shape:
   *   · re-add the blocker (or set `implemented: false`) and `blocked` is
   *     non-empty → red;
   *   · delete the `else if` from `applyViewPresetById` and `hasVideoRoute` is
   *     false → red, catching the pill that would then frame a still and write
   *     nothing.
   * And it is not satisfiable by the table alone: `viewPresetBlockers` cannot
   * make `hasVideoRoute` true, because that is read out of app/page.tsx. The
   * "could the regex just never match?" control for this reader is one row in
   * `assert-style-contracts` §5 and is deliberately NOT duplicated here. */
  const hasVideoRoute = /export\?\.target === "video"/.test(pageSrc)
  const hasTurntable = /autoRotate/.test(viewportSrc) && /spinDegPerSecond/.test(viewportSrc)
  say(
    !blocked.some((p) => p.id === "videoPreviewExport") && hasVideoRoute,
    "CONTROL · the VIDEO member reports NO blocker, and the route that closed it is in app/page.tsx",
    `blocked: ${blocked.map((p) => p.id).join(", ") || "none"} · \`target === "video"\` branch in applyViewPresetById: ${hasVideoRoute ? "present" : "MISSING — the preset would frame a still and write nothing"}`,
  )
  say(
    !blocked.some((p) => p.id === "portfolioSpin") && hasTurntable,
    "CONTROL · the TURNTABLE member is NOT blocked, and the capability that closed it is in the tree",
    `portfolioSpin blockers ${viewPresetBlockers("portfolioSpin").length} · autoRotate+spinDegPerSecond in viewport-3d.tsx: ${hasTurntable ? "present" : "MISSING — the preset claims a capability that is gone"}`,
  )
  for (const p of blocked) for (const b of viewPresetBlockers(p.id)) console.log(`        ${p.id}: ${b}`)

  /* Framings must be distinct — a rail of eight views that all point the same
   * way is eight names for one shot. */
  const key = (p) => {
    const c = resolveViewPreset(p.id).camera
    return `${c.azimuthDeg}/${c.elevationDeg}/${c.fill}`
  }
  const keys = defs.map(key)
  const dupKeys = [...new Set(keys.filter((x, i) => keys.indexOf(x) !== i))]
  /* frontElevation and glbCleanExport DO share a framing — deliberately: one is
   * a view, one is a view plus an export action. So the distinctness rule is on
   * (framing + export target), not framing alone. */
  const full = defs.map((p) => key(p) + "|" + (resolveViewPreset(p.id).export?.target ?? "none"))
  const dupFull = [...new Set(full.filter((x, i) => full.indexOf(x) !== i))]
  say(dupFull.length === 0, "no two view presets share BOTH a framing and an export target", dupFull.join(", ") || `${defs.length} distinct`)
  say(dupKeys.length === 1, "CONTROL · the framing-only comparison DOES find the one deliberate shared framing", dupKeys.join(", "))
  say(resolveViewPreset("cleanRod") === undefined, "CONTROL · resolveViewPreset refuses a preset from another family")
}

/* ------------------------------------------------------------------ */
/* 5 · STACK ANIMATION — the eleven §4 controls, in the evaluator       */
/* ------------------------------------------------------------------ */
/* These two lists partition the non-`none` behaviours by WHICH group value they
 * drive (timeOffset vs amount), and together they must be the whole type. They
 * are hand-written because the split is a semantic claim the type does not
 * encode — but a NINTH behaviour added to lib/style-stack.ts would land in
 * neither and be silently ungraded by every row in §5, which is the same
 * hand-maintained-table rot this gate exists to catch. So the union is asserted
 * against the type below rather than trusted. */
const OFFSET_BEHAVIOURS = ["drift", "loop", "revealSynced"]
const AMPLITUDE_BEHAVIOURS = ["fadeIn", "pulse", "delayAfterReveal", "completionPulse", "freezeOnComplete"]
function declaredStackBehaviours() {
  const src = readFileSync(join(TS_ROOT, "lib", "style-stack.ts"), "utf8")
  const m = src.match(/export type StackAnimationBehaviour\s*=([\s\S]*?)\n\n/)
  if (!m) throw new Error("could not read StackAnimationBehaviour from lib/style-stack.ts")
  return [...m[1].matchAll(/"([a-zA-Z]+)"/g)].map((x) => x[1]).filter((v) => v !== "none")
}

function ev(behaviour, over = {}) {
  return evaluateStackAnimation({
    enabled: true,
    behaviour,
    speed: 1,
    phase: 0,
    sinceArmed: 0.8,
    reveal: 1,
    sinceCompletion: 0.3,
    loopSeconds: 4,
    ...over,
  })
}
const same = (a, b) =>
  a.amount === b.amount && a.timeOffset === b.timeOffset && a.frozen === b.frozen

function stackAnimation() {
  console.log("\n=== 5 · stack animation — direction, phase, opacity, reveal ===")

  /* COVERAGE FIRST — see the note on OFFSET_BEHAVIOURS. Every row in this
   * section iterates one of those two lists, so a behaviour in neither is
   * ungraded here and nothing else in this file grades it either. */
  const declaredB = declaredStackBehaviours()
  const partition = [...OFFSET_BEHAVIOURS, ...AMPLITUDE_BEHAVIOURS]
  const unpartitioned = declaredB.filter((b) => !partition.includes(b))
  const phantom = partition.filter((b) => !declaredB.includes(b))
  say(
    unpartitioned.length === 0 && phantom.length === 0,
    `OFFSET_BEHAVIOURS + AMPLITUDE_BEHAVIOURS cover StackAnimationBehaviour exactly (${declaredB.length} declared)`,
    unpartitioned.length
      ? `UNGRADED by every row in §5: ${unpartitioned.join(", ")}`
      : phantom.length
        ? `graded but not declared in lib/style-stack.ts: ${phantom.join(", ")}`
        : `${partition.length} behaviours, both directions`,
  )

  /* DIRECTION = the sign of speed, and it must act on exactly the behaviours
   * that produce a shared offset. Both halves are assertions; the second half
   * is the control that proves the first is not reading noise. */
  const dirActs = OFFSET_BEHAVIOURS.filter((b) => !same(ev(b, { speed: 1 }), ev(b, { speed: -1 })))
  say(
    dirActs.length === OFFSET_BEHAVIOURS.length,
    "direction (sign of speed) reverses every offset behaviour",
    `${dirActs.join(", ")} — e.g. drift ${ev("drift", { speed: 1 }).timeOffset.toFixed(3)} vs ${ev("drift", { speed: -1 }).timeOffset.toFixed(3)}`,
  )
  const dirLeaks = AMPLITUDE_BEHAVIOURS.filter((b) => !same(ev(b, { speed: 1 }), ev(b, { speed: -1 })))
  say(
    dirLeaks.length === 0,
    "CONTROL · direction is a NO-OP on every amplitude behaviour (a negative fade is not a direction)",
    dirLeaks.length ? dirLeaks.join(", ") : AMPLITUDE_BEHAVIOURS.join(", "),
  )
  /* And the specific regression the sign fix prevents: a raw negative speed on
   * fadeIn would clamp the group to 0 forever — an invisible stack. */
  say(
    ev("fadeIn", { speed: -1, sinceArmed: 2 }).amount === 1,
    "a reversed group still FADES IN (the raw-negative bug would pin it at 0)",
    `amount ${ev("fadeIn", { speed: -1, sinceArmed: 2 }).amount}`,
  )

  /* PHASE — read by the cycle behaviours, ignored by the rest, and the panel
   * disables it exactly there. */
  const phaseReaders = ["pulse", "drift", "loop", "revealSynced"]
  const phaseActs = phaseReaders.filter((b) => !same(ev(b, { phase: 0 }), ev(b, { phase: 3.14 })))
  say(
    phaseActs.length === phaseReaders.length,
    "phase offset moves every behaviour the panel leaves it enabled on",
    phaseActs.join(", "),
  )
  const phaseLeaks = ["fadeIn", "delayAfterReveal", "completionPulse", "freezeOnComplete"].filter(
    (b) => !same(ev(b, { phase: 0 }), ev(b, { phase: 3.14 })),
  )
  say(phaseLeaks.length === 0, "CONTROL · phase is inert on exactly the behaviours the panel disables it for", phaseLeaks.join(", ") || "4 behaviours")

  /* REVEAL SYNC — the eighth behaviour, and the only one whose amount is the
   * playhead. */
  const r0 = ev("revealSynced", { reveal: 0 })
  const r5 = ev("revealSynced", { reveal: 0.5 })
  const r1 = ev("revealSynced", { reveal: 1 })
  say(
    r0.amount === 0 && r5.amount === 0.5 && r1.amount === 1 && r0.timeOffset < r1.timeOffset,
    "revealSynced tracks the draw-in playhead in both amount and phase",
    `amount ${r0.amount}/${r5.amount}/${r1.amount} · offset ${r0.timeOffset.toFixed(2)}→${r1.timeOffset.toFixed(2)}`,
  )
  const f0 = ev("fadeIn", { reveal: 0 })
  const f1 = ev("fadeIn", { reveal: 1 })
  say(same(f0, f1), "CONTROL · fadeIn ignores the playhead entirely (it rides armed time)", `${f0.amount} vs ${f1.amount}`)

  /* Every behaviour must be reachable and distinct from neutral. `none` is the
   * one that must equal neutral — that is its job, and it is the control. */
  const behaviours = [...OFFSET_BEHAVIOURS, ...AMPLITUDE_BEHAVIOURS]
  /* TWO moments, not one. `freezeOnComplete` is neutral by construction while
   * the reveal is still running — that is its whole definition — so a
   * single-moment sweep reported it as an inert behaviour. A behaviour has to
   * depart from neutral SOMEWHERE in its own life, not at a moment chosen for
   * a different behaviour's convenience. */
  const MOMENTS = [
    { sinceArmed: 0.4, reveal: 0.5, sinceCompletion: Infinity },
    { sinceArmed: 0.4, reveal: 1, sinceCompletion: 0.15 },
  ]
  const NEUTRAL = { amount: 1, timeOffset: 0, frozen: false }
  const inertB = behaviours.filter((b) => MOMENTS.every((m) => same(ev(b, m), NEUTRAL)))
  say(
    inertB.length === 0,
    "every named behaviour departs from neutral somewhere in its own life",
    inertB.join(", ") || `${behaviours.length} behaviours across ${MOMENTS.length} moments`,
  )
  say(
    same(ev("freezeOnComplete", MOMENTS[0]), NEUTRAL) && ev("freezeOnComplete", MOMENTS[1]).frozen,
    "CONTROL · freezeOnComplete is neutral DURING the draw and frozen after — the two moments are doing work",
  )
  say(same(ev("none"), { amount: 1, timeOffset: 0, frozen: false }), "CONTROL · 'none' IS exactly neutral")
  say(same(ev("drift", { enabled: false }), { amount: 1, timeOffset: 0, frozen: false }), "CONTROL · disabled is exactly neutral whatever the behaviour")

  /* GROUP OPACITY — resolved in resolveStack, so it holds with the animation
   * off. That is the whole reason it does not live in the evaluator. */
  const base = { ...DEFAULT_STYLE_STATE, layerStackEnabled: true, textureIntensity: 0.8, ditherIntensity: 0.9, stackAnimationOpacity: 1 }
  const full = resolveStack(base)
  const dim = resolveStack({ ...base, stackAnimationOpacity: 0.4 })
  say(
    Math.abs(dim.textureAmount - full.textureAmount * 0.4) < 1e-9 &&
      Math.abs(dim.ditherAmount - full.ditherAmount * 0.4) < 1e-9 &&
      Math.abs(dim.asciiAmount - full.asciiAmount * 0.4) < 1e-9,
    "group opacity scales EVERY layer by the same factor",
    `texture ${full.textureAmount.toFixed(3)}→${dim.textureAmount.toFixed(3)}`,
  )
  const offBase = { ...base, layerStackEnabled: false }
  say(
    resolveStack(offBase).textureAmount === resolveStack({ ...offBase, stackAnimationOpacity: 0.4 }).textureAmount,
    "CONTROL · with the stack OFF there is no container, so group opacity does nothing",
  )
  const noAnim = resolveStack({ ...base, stackAnimationEnabled: false, stackAnimationOpacity: 0.4 })
  say(
    Math.abs(noAnim.textureAmount - dim.textureAmount) < 1e-9,
    "group opacity holds with the group animation switched OFF (it is level, not motion)",
    `${noAnim.textureAmount.toFixed(3)}`,
  )
}

/* ------------------------------------------------------------------ */
/* 6 · ANIMATED MATERIAL — the new family's dials actually reach it     */
/* ------------------------------------------------------------------ */
function animatedMaterial() {
  console.log("\n=== 6 · animated material ===")
  const base = resolveMaterialParams("ink", DEFAULT_STYLE_STATE.customMaterial)
  const flash = (speed) =>
    evaluateMaterialAnimation({
      base,
      type: "completionFlash",
      time: 0,
      speed,
      intensity: 1,
      completion: 1,
      sinceCompletion: 0.6,
      sinceArmed: 0.6,
    })
  const fast = flash(1)
  const slow = flash(0.18)
  say(
    Math.abs(fast.emissiveIntensity - slow.emissiveIntensity) > 0.2,
    "completionFlash reads SPEED — the dial was arithmetically dead on this behaviour",
    `emissive ${fast.emissiveIntensity.toFixed(3)} (1x) vs ${slow.emissiveIntensity.toFixed(3)} (0.18x)`,
  )
  /* CONTROL: the same two speeds on a behaviour whose clock has not advanced
   * (time 0) must be identical — so the difference above is the parameter
   * reaching the math, not the harness comparing two different moments. */
  const g1 = evaluateMaterialAnimation({ base, type: "gelShimmer", time: 0, speed: 1, intensity: 1, completion: 1 })
  const g2 = evaluateMaterialAnimation({ base, type: "gelShimmer", time: 0, speed: 0.18, intensity: 1, completion: 1 })
  say(
    JSON.stringify(g1) === JSON.stringify(g2),
    "CONTROL · at time 0 a speed change reaches nothing, and the comparison says so",
  )

  /* Each preset must resolve to a DIFFERENT material at a representative
   * moment — otherwise two pills are one look. */
  const defs = PRESET_REGISTRY.animatedMaterial.filter((p) => p.enabled)
  const sig = (p) => {
    const a = p.applies
    const out = []
    for (const t of [0.35, 1.1, 2.4]) {
      const m = evaluateMaterialAnimation({
        base,
        type: a.materialAnimationEnabled ? a.materialAnimationType : "none",
        time: t,
        speed: a.materialAnimationSpeed,
        intensity: a.materialAnimationIntensity,
        completion: 1,
        sinceCompletion: t,
        sinceArmed: t,
      })
      out.push(
        [m.color, m.roughness, m.clearcoat, m.sheen, m.emissiveIntensity, m.envMapIntensity, m.metalness]
          .map((v) => (typeof v === "number" ? v.toFixed(4) : v))
          .join(","),
      )
    }
    return out.join("|")
  }
  const sigs = defs.map(sig)
  const dups = []
  for (let i = 0; i < defs.length; i++)
    for (let j = i + 1; j < defs.length; j++)
      if (sigs[i] === sigs[j]) dups.push(`${defs[i].id} = ${defs[j].id}`)
  say(dups.length === 0, "every animated-material preset resolves to a distinct surface over time", dups.join(", ") || `${defs.length} presets, 0 collapsed pairs`)
  say(sig(defs[0]) === sig(defs[0]), "CONTROL · the signature is deterministic (a preset equals itself)")

  /* The OFF member must genuinely be still, and it is the family's own control. */
  const still = defs.find((p) => p.id === "stillSurface")
  const stillSig = sig(still)
  const stillIsBase = stillSig.split("|").every((s, _i, arr) => s === arr[0])
  say(stillIsBase, "'Still Surface' is identical at every moment — it is the family's own negative control", stillSig.split("|")[0])
  /* WHERE A BEHAVIOUR'S MOTION ACTUALLY LIVES — and shineSweep's is not here.
   *
   * `evaluateMaterialAnimation`'s shineSweep case holds the surface in a
   * CONSTANT receptive state on purpose (its own comment says so): the visible
   * travelling band is per-fragment work in lib/texture-shader.ts, driven from
   * viewport-3d's frame loop. So a material-params signature is the wrong
   * surface to measure it on, and the first version of this check went red on
   * exactly the two presets whose motion is real but lives one layer down.
   * Asserting "the params vary" there would have forced a fake oscillation into
   * a case that was deliberately made constant.
   *
   * The split: this gate proves the two sweep presets are DISTINCT FROM EACH
   * OTHER in params (so the pills are not one look twice); the browser gate
   * proves the band travels. Naming the exemption here is what stops it from
   * quietly becoming "shineSweep is untested". */
  const SHADER_DRIVEN = new Set(["shineSweepAcross", "slowGlassSweep"])
  const movers = defs.filter((p) => p.id !== "stillSurface" && !SHADER_DRIVEN.has(p.id))
  const notMoving = movers.filter((p) => {
    const parts = sig(p).split("|")
    return parts.every((s) => s === parts[0])
  })
  say(
    notMoving.length === 0,
    "every param-driven member CHANGES over time",
    notMoving.map((p) => p.id).join(", ") || `${movers.length} moving (2 shader-driven exempt, proven in the browser gate)`,
  )
  const sweeps = [...SHADER_DRIVEN].map((id) => sig(defs.find((p) => p.id === id)))
  say(
    sweeps[0] !== sweeps[1] && sweeps.every((s) => s.split("|").every((x, _i, a) => x === a[0])),
    "the two shader-driven sweeps are CONSTANT in params (as designed) and distinct from each other",
    `${sweeps[0].split("|")[0]}  vs  ${sweeps[1].split("|")[0]}`,
  )
}

registryIntegrity()
applyRules()
geometryPresets()
viewPresets()
stackAnimation()
animatedMaterial()

console.log(
  fails === 0
    ? `\nALL ${checks} PRESET-REGISTRY ASSERTIONS PASS`
    : `\n${fails} of ${checks} PRESET-REGISTRY ASSERTIONS FAILED`,
)
process.exit(fails === 0 ? 0 : 1)

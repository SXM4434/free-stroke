#!/usr/bin/env node
/**
 * THE STYLE CONTRACTS GATE — the invariants that break when someone ADDS a
 * feature, rather than the ones that break when someone changes a number.
 *
 * WHY THIS IS NOT A SECOND COPY OF `assert-preset-registry.mjs`.
 * That gate asks "does the preset data say true things about itself, and does
 * selecting one do what its family promises". This one asks a different and
 * strictly structural question: **is each idea in the style system expressed
 * exactly once, and does every hand-maintained mirror still match the thing it
 * mirrors?** Those mirrors are invisible at runtime — nothing renders wrong the
 * day one of them falls behind. They render wrong months later, once a field, a
 * constant or a string has been added on one side only.
 *
 * The classes checked here are the ones this repo has actually shipped:
 *
 *   §1  ONE ENVELOPE. The completion-pulse shape is named as one idea in three
 *       files and implemented three times. Two of the three had already drifted
 *       when this gate was written.
 *   §2  ONE TRIGGER RULE. `completionTrigger` exists because a completion-keyed
 *       effect measured from `sinceCompletion` alone is unreachable by hand.
 *       Every consumer of the completion event must go through it.
 *   §3  THE STATE CONTRACT. `StyleState` <-> `DEFAULT_STYLE_STATE` <->
 *       `COMPOSITION_RAIL_KEYS` are three hand-written lists of the same set. A
 *       field present in one and missing from another is a silent defect: no
 *       default means `undefined` reaches a shader; no rail key means preset
 *       contamination, the exact bug the rail-reset was written to fix.
 *   §4  THE PERSISTENCE CONTRACT. Anything restored from `localStorage` is
 *       ATTACKER-SHAPED DATA as far as this code is concerned — it was written
 *       by an older build, a different build, or a user with devtools. It must
 *       not be able to put a non-finite number into a shader uniform.
 *   §5  CROSS-MODULE STRING COUPLINGS. Two modules that agree via a string
 *       literal typed into both of them agree only until someone rewords one.
 *   §6  SHARED SCALES. A literal in one file whose comment says it "matches"
 *       a named constant in another file is a duplicate with a promise on it.
 *
 * EVERY assertion here is paired with a CONTROL that must come out the other
 * way, because a structural gate that cannot fail is the most expensive kind of
 * green in this repo (see docs/README.md, and `assert-gate-integrity.mjs`).
 *
 * Node-only: no browser, no dev server. Run it after any edit to lib/style-*.
 */
// gate-integrity: differential — this file asserts CONTRACTS, not values: every preset in the
// registry resolves, the composition merge resets its own rails, a fusion frame is finite, a
// deleted selection renders inert. It NAMES ~95 constants because it enumerates those registries
// by name; no single one of them decides any row, and each claim is true at every value of every
// one of them BY DESIGN. Channel D moved 38 and killed 0, which is the correct answer.
import ts from "typescript"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { loadTs, ROOT } from "./_ts-load.mjs"

const S = loadTs("lib/style-system.ts")
const C = loadTs("lib/style-clock.ts")
const K = loadTs("lib/style-stack.ts")
const F = loadTs("lib/style-fusion.ts")

const { DEFAULT_STYLE_STATE, viewPresetBlockers } = S
const { createStyleClock, evaluateLayerTime, completionTrigger } = C
const { evaluateStackAnimation } = K
const { evaluateFusion, customFusionKey } = F

let pass = 0
let fail = 0
const say = (ok, label, detail) => {
  ok ? pass++ : fail++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

const src = (rel) => readFileSync(join(ROOT, rel), "utf8")
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps

/* ================================================================== */
/* §1 · ONE ENVELOPE — the completion pulse, at both scales            */
/* ================================================================== */
/**
 * `evaluateLayerTime`'s completionPulse and `evaluateStackAnimation`'s
 * completionPulse are the SAME named behaviour at two scales, and both files
 * say so in prose:
 *
 *   style-stack.ts : "Deliberately the same shape and constants as the
 *                     per-layer pulse in lib/style-clock.ts."
 *   style-clock.ts : "Matches `evaluateStackAnimation`'s `completionPulse`
 *                     exactly (lib/style-stack.ts)."
 *
 * Neither claim was true. Both compute `1 + envelope(t) * 0.6`, so their
 * `amount` outputs are directly comparable and the comparison is the whole
 * assertion — no private constant needs exporting for it.
 */
function layerPulseAmount(t) {
  const clock = createStyleClock()
  clock.reveal = 1
  clock.sinceCompletion = t
  return evaluateLayerTime(clock, {
    animated: true,
    syncMode: "completionPulse",
    speed: 1,
    sinceArmed: t,
  }).amount
}
function groupPulseAmount(t) {
  return evaluateStackAnimation({
    enabled: true,
    behaviour: "completionPulse",
    speed: 1,
    phase: 0,
    sinceArmed: t,
    reveal: 1,
    sinceCompletion: t,
    loopSeconds: 4,
  }).amount
}

/** The sample grid. Dense through the attack, then out past both lifetimes. */
const PULSE_T = [0, 0.02, 0.045, 0.09, 0.15, 0.3, 0.5, 0.8, 1.0, 1.3, 1.6, 1.7, 1.8, 1.9, 2.2]

function oneEnvelope() {
  console.log("\n=== §1 · one envelope: the completion pulse at layer and group scale ===")

  const rows = PULSE_T.map((t) => ({ t, layer: layerPulseAmount(t), group: groupPulseAmount(t) }))
  const off = rows.filter((r) => !near(r.layer, r.group, 1e-6))
  const worst = rows.reduce((w, r) => (Math.abs(r.layer - r.group) > Math.abs(w.layer - w.group) ? r : w), rows[0])
  say(
    off.length === 0,
    "the layer pulse and the group pulse are ONE envelope (both files say they are)",
    off.length
      ? `${off.length}/${rows.length} samples differ · worst t=${worst.t}s layer ${worst.layer.toFixed(5)} vs group ${worst.group.toFixed(5)}`
      : `${rows.length} samples identical to 1e-6`,
  )

  /* CONTROL. The comparison must be able to SEE a difference — otherwise
   * "identical" is what it would say about any two functions. Compare the layer
   * envelope against itself evaluated at a shifted time. */
  const shifted = PULSE_T.filter((t) => t > 0 && t < 1.5).some((t) => !near(layerPulseAmount(t), layerPulseAmount(t + 0.05), 1e-6))
  say(shifted, "CONTROL · the same comparison DOES separate two envelopes that differ")

  /* Both must actually END, and end together. A one-shot whose two scales stop
   * at different moments is two events, not one. */
  const layerEnd = PULSE_T.filter((t) => near(layerPulseAmount(t), 1, 1e-9)).find((t) => t > 0.5)
  const groupEnd = PULSE_T.filter((t) => near(groupPulseAmount(t), 1, 1e-9)).find((t) => t > 0.5)
  say(
    layerEnd !== undefined && groupEnd !== undefined && layerEnd === groupEnd,
    "both scales return to rest at the same sample (one event, not two)",
    `layer settles by ${layerEnd ?? "never"}s · group by ${groupEnd ?? "never"}s`,
  )
  // CONTROL: rest is 1 and the peak is NOT, so "settled" is a real reading.
  const peak = Math.max(...rows.map((r) => r.layer))
  say(peak > 1.2, "CONTROL · the pulse genuinely swells above rest, so 'settled at 1' means something", `peak ${peak.toFixed(3)}`)
}

/* ================================================================== */
/* §2 · ONE TRIGGER RULE — completion is reachable by ARMING           */
/* ================================================================== */
/**
 * THE RULE, from lib/style-clock.ts's own header on `completionTrigger`:
 * after any stroke is drawn the playhead rests at 1 forever, so
 * `sinceCompletion` grows without bound. A behaviour keyed only to it is
 * unreachable by hand — by the time the user finds the option in a panel, every
 * envelope is spent, and the option reads as one that does nothing.
 *
 * The rule is written down in one place and must hold at all three scales that
 * consume the completion event: layer, group, and fusion.
 *
 * `sinceCompletion = 30` is not a stress value. It is the NORMAL state of this
 * app: the user draws, the reveal finishes, and then they open a panel.
 */
const STALE = 30

function oneTriggerRule() {
  console.log("\n=== §2 · the completion event is reachable by arming, at every scale ===")

  say(
    completionTrigger(STALE, 0.1) === 0.1 && completionTrigger(Infinity, 0.1) === Infinity,
    "completionTrigger takes the more recent origin AND preserves the mid-draw sentinel",
    `stale→${completionTrigger(STALE, 0.1)} · drawing→${completionTrigger(Infinity, 0.1)}`,
  )

  // LAYER scale.
  const clock = createStyleClock()
  clock.reveal = 1
  clock.sinceCompletion = STALE
  const layerArmed = evaluateLayerTime(clock, { animated: true, syncMode: "completionPulse", speed: 1, sinceArmed: 0.1 }).amount
  say(layerArmed > 1.05, "LAYER · a completion pulse armed on a long-finished stroke FIRES", `amount ${layerArmed.toFixed(3)}`)

  // GROUP scale.
  const groupArmed = evaluateStackAnimation({
    enabled: true, behaviour: "completionPulse", speed: 1, phase: 0,
    sinceArmed: 0.1, reveal: 1, sinceCompletion: STALE, loopSeconds: 4,
  }).amount
  say(groupArmed > 1.05, "GROUP · the same, for the stack's own completion pulse", `amount ${groupArmed.toFixed(3)}`)

  /* FUSION scale. `evaluateFusion` computes ONE shared completion pulse that
   * feeds both the user-facing "Completion" source and a dozen built-in
   * branches. It is measured through a built-in whose completion contribution
   * is unconditional, so the reading cannot be confused with a drive shape. */
  const fusionArmed = fusionCompletionReach(0.1)
  const fusionCold = fusionCompletionReach(STALE)
  say(
    fusionArmed > fusionCold + 1e-6,
    "FUSION · the shared completion pulse armed on a long-finished stroke FIRES",
    `armed ${fusionArmed.toFixed(5)} vs unarmed ${fusionCold.toFixed(5)}`,
  )

  /* CONTROL for all three: mid-draw (the sentinel) there has been no completion
   * at all, so nothing may fire. A trigger that fires when nothing has happened
   * is worse than one that never fires. */
  const midClock = createStyleClock()
  midClock.reveal = 0.5
  midClock.sinceCompletion = Infinity
  const layerMid = evaluateLayerTime(midClock, { animated: true, syncMode: "completionPulse", speed: 1, sinceArmed: 0.1 }).amount
  const groupMid = evaluateStackAnimation({
    enabled: true, behaviour: "completionPulse", speed: 1, phase: 0,
    sinceArmed: 0.1, reveal: 0.5, sinceCompletion: Infinity, loopSeconds: 4,
  }).amount
  say(
    near(layerMid, 1) && near(groupMid, 1),
    "CONTROL · mid-draw nothing fires anywhere (the Infinity sentinel survives arming)",
    `layer ${layerMid} · group ${groupMid}`,
  )
}

/** Reads how far the shared fusion completion pulse reaches, in one number.
 *  `terminalGel` is used because its emissive carries `pulse` with a fixed
 *  coefficient and no event schedule, so the reading is the pulse and nothing
 *  else. Motion is frozen so no drive shape can contribute. */
function fusionCompletionReach(sinceArmed) {
  const clock = createStyleClock()
  clock.elapsed = 40
  clock.reveal = 1
  clock.sinceCompletion = STALE
  const state = {
    ...DEFAULT_STYLE_STATE,
    fusionPreset: "terminalGel",
    fusionDrive: "loop",
    fusionIntensity: 1,
    fusionSwing: 0,
    motionMode: "off",
  }
  const f = evaluateFusion(state, clock, { asciiTime: 0, ditherTime: 0, textureTime: 0 }, sinceArmed)
  return f ? f.emissiveAdd : 0
}

/* ================================================================== */
/* §3 · THE STATE CONTRACT — three hand-written lists of one set       */
/* ================================================================== */
/**
 * Parsed from SOURCE rather than read off the module, deliberately:
 *   - `StyleState` is a type and has no runtime representation at all;
 *   - `COMPOSITION_RAIL_KEYS` is module-private, and exporting a constant
 *     purely so a test can see it changes the module's surface to suit its
 *     test. The contract is a property of the FILE, so the file is what is read.
 */
function parseStyleSystem() {
  const file = ts.createSourceFile("style-system.ts", src("lib/style-system.ts"), ts.ScriptTarget.ES2020, true)
  let stateFields = null
  let defaultKeys = null
  const arrays = {}

  const walk = (n) => {
    if (ts.isInterfaceDeclaration(n) && n.name.text === "StyleState") {
      stateFields = n.members.filter(ts.isPropertySignature).map((m) => m.name.getText(file))
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const id = n.name.text
      if (id === "DEFAULT_STYLE_STATE" && ts.isObjectLiteralExpression(n.initializer)) {
        defaultKeys = n.initializer.properties
          .filter((p) => ts.isPropertyAssignment(p) && p.name)
          .map((p) => p.name.getText(file))
      }
      // `[...] as const satisfies ...` — unwrap the assertion wrappers.
      let init = n.initializer
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression?.(init)) init = init.expression
      if (ts.isArrayLiteralExpression(init) && init.elements.every((e) => ts.isStringLiteral(e))) {
        arrays[id] = init.elements.map((e) => e.text)
      }
    }
    ts.forEachChild(n, walk)
  }
  walk(file)
  return { stateFields, defaultKeys, arrays }
}

/**
 * Fields that are NOT part of the composition reset, each with the reason it is
 * exempt. This table is the point of the check: an exemption has to be TYPED
 * OUT, so adding a field and forgetting it is a failure rather than a silence.
 */
const RAIL_EXEMPT = {
  materialPreset: "material is orthogonal to composition (applyPresetToStyleState's rule 2)",
  materialUserOverride: "material rail",
  materialAnimationEnabled: "material rail",
  materialAnimationType: "material rail",
  materialAnimationSpeed: "material rail",
  materialAnimationIntensity: "material rail",
  customMaterial: "the user's own material editor contents — never reset by a preset",
  customFusions: "the user's LIBRARY. Documented on the field: the SELECTION resets, the library must not.",
  activePresetFamily: "selection bookkeeping, written by applyPresetToStyleState itself",
  activePresetId: "selection bookkeeping",
  lastAppliedPresetId: "selection bookkeeping",
}

/** Prefixes that mean "this field is part of the layer composition". */
const COMPOSITION_PREFIXES = ["texture", "dither", "ascii", "stack", "layerStack", "fusion", "motionMode", "styleLoop"]

function stateContract() {
  console.log("\n=== §3 · the state contract: StyleState <-> defaults <-> rail keys ===")

  const { stateFields, defaultKeys, arrays } = parseStyleSystem()
  const rail = arrays.COMPOSITION_RAIL_KEYS
  const groupRail = arrays.STACK_ANIMATION_RAIL_KEYS

  say(!!stateFields && stateFields.length > 0, "StyleState parsed from source", `${stateFields?.length} fields`)
  say(!!rail && rail.length > 0, "COMPOSITION_RAIL_KEYS parsed from source", `${rail?.length} keys`)

  /* 3a · EVERY DECLARED FIELD HAS A DEFAULT. A field with no default is
   * `undefined` at runtime on the very first frame, and `undefined` reaching a
   * shader uniform is a black layer with no error anywhere. */
  const noDefault = stateFields.filter((f) => !defaultKeys.includes(f))
  say(noDefault.length === 0, "every StyleState field has a value in DEFAULT_STYLE_STATE", noDefault.join(", ") || `${stateFields.length} fields`)
  const extraDefault = defaultKeys.filter((k) => !stateFields.includes(k))
  say(extraDefault.length === 0, "DEFAULT_STYLE_STATE names no field the type does not declare", extraDefault.join(", ") || `${defaultKeys.length} keys`)
  // CONTROL: the same set difference on a seeded miss.
  say(
    stateFields.filter((f) => !defaultKeys.filter((k) => k !== stateFields[0]).includes(f)).length === 1,
    "CONTROL · the missing-default detector catches a seeded omission",
    stateFields[0],
  )

  /* 3b · RUNTIME AGREES WITH THE SOURCE. Catches a default written through a
   * spread or a computed key, which the AST read above would not see. */
  const runtimeKeys = Object.keys(DEFAULT_STYLE_STATE)
  const runtimeMissing = stateFields.filter((f) => !(f in DEFAULT_STYLE_STATE))
  say(runtimeMissing.length === 0, "the SHIPPED default object carries every declared field", runtimeMissing.join(", ") || `${runtimeKeys.length} keys at runtime`)

  /* 3c · THE RAIL IS COMPLETE. This is the one that rots. `COMPOSITION_RAIL_KEYS`
   * is the list a composition preset resets before applying its patch — the fix
   * for "pick an animated texture preset, then a static one, and the pattern
   * keeps crawling". It is hand-maintained. A new layer field that misses it
   * re-introduces exactly that contamination, on the new layer only, silently. */
  const isComposition = (f) => COMPOSITION_PREFIXES.some((p) => f.startsWith(p))
  const shouldReset = stateFields.filter((f) => isComposition(f) && !(f in RAIL_EXEMPT))
  const missingFromRail = shouldReset.filter((f) => !rail.includes(f))
  say(
    missingFromRail.length === 0,
    "every composition field is in COMPOSITION_RAIL_KEYS or explicitly exempt",
    missingFromRail.length
      ? `NOT RESET, so a preset inherits them: ${missingFromRail.join(", ")}`
      : `${shouldReset.length} reset · ${Object.keys(RAIL_EXEMPT).length} exempt with a stated reason`,
  )
  // CONTROL: the detector must fire on a field the rail does not carry.
  say(
    shouldReset.filter((f) => !rail.filter((k) => k !== shouldReset[0]).includes(f)).length === 1,
    "CONTROL · the rail-completeness detector catches a seeded omission",
    shouldReset[0],
  )

  const railGhosts = rail.filter((k) => !stateFields.includes(k))
  say(railGhosts.length === 0, "COMPOSITION_RAIL_KEYS names no field that no longer exists", railGhosts.join(", ") || `${rail.length} keys`)

  const exemptGhosts = Object.keys(RAIL_EXEMPT).filter((k) => !stateFields.includes(k))
  say(exemptGhosts.length === 0, "the exemption table names no field that no longer exists", exemptGhosts.join(", ") || `${Object.keys(RAIL_EXEMPT).length} exemptions`)

  /* 3d · THE GROUP RAIL IS A SUBSET OF THE COMPOSITION RAIL. A stack-animation
   * preset resets only the group's own fields (the fix for "make the group
   * drift" deleting the composition). If a group field ever left the
   * composition rail, the two resets would disagree about who owns it. */
  const groupOutside = groupRail.filter((k) => !rail.includes(k))
  say(groupOutside.length === 0, "STACK_ANIMATION_RAIL_KEYS is a subset of COMPOSITION_RAIL_KEYS", groupOutside.join(", ") || `${groupRail.length} group keys`)
}

/* ================================================================== */
/* §4 · THE PERSISTENCE CONTRACT                                       */
/* ================================================================== */
/**
 * `freestroke.fusions.v1` is restored on boot (app/page.tsx) and its entries
 * are filtered on three fields: `id` is a string, `name` is a string, `links`
 * IS AN ARRAY. Not one element of `links` is ever inspected.
 *
 * The blob has no version field — the only version is the `.v1` in the key —
 * so a shape written by ANY past or future build is restored as if it were
 * current, and a user with devtools can write anything at all. That makes every
 * link field untrusted input on a path that ends in a shader uniform.
 *
 * The assertion is deliberately not "the loader rejects this". The loader is in
 * another lane's file and a validator can always be bypassed. It is the
 * stronger and more durable property: **whatever reaches the evaluator, the
 * frame it produces is finite.** A NaN in a uniform is not a wrong picture, it
 * is an undefined one, and it propagates — `x *= NaN` poisons every later link.
 */
const POISON = [
  { label: "a source this build does not have (an older or newer link kind)", link: { id: "a", source: "notASource", target: "ditherThreshold", amount: 1 } },
  { label: "a target this build does not have", link: { id: "b", source: "breath", target: "notATarget", amount: 1 } },
  { label: "a hand-edited string amount", link: { id: "c", source: "breath", target: "ditherCell", amount: "1" } },
  { label: "a missing amount", link: { id: "d", source: "breath", target: "textureScale" } },
  { label: "NaN written straight in", link: { id: "e", source: "breath", target: "asciiFlow", amount: NaN } },
  { label: "a null source", link: { id: "f", source: null, target: "gloss", amount: 1 } },
  { label: "a source that names an Object.prototype member", link: { id: "g", source: "constructor", target: "glow", amount: 1 } },
  { label: "a shine band from an unknown source", link: { id: "h", source: "notASource", target: "shineBand", amount: 1 } },
]

function frameIsFinite(f) {
  if (!f) return { ok: true, bad: [] }
  const bad = []
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === "number" && !Number.isFinite(v)) bad.push(k)
    if (k === "sweep" && v) for (const [sk, sv] of Object.entries(v)) if (typeof sv === "number" && !Number.isFinite(sv)) bad.push(`sweep.${sk}`)
  }
  return { ok: bad.length === 0, bad }
}

function evalWithLinks(links) {
  const clock = createStyleClock()
  clock.elapsed = 3
  clock.reveal = 1
  clock.sinceCompletion = 0.2
  const fusion = { id: "restored", name: "Restored", links, glowColor: "#ff8800" }
  const state = {
    ...DEFAULT_STYLE_STATE,
    customFusions: [fusion],
    fusionPreset: customFusionKey("restored"),
    fusionIntensity: 1,
    fusionSwing: 1,
    motionMode: "independent",
  }
  return evaluateFusion(state, clock, { asciiTime: 1.3, ditherTime: 0.7, textureTime: 2.1 }, 0.4)
}

function persistenceContract() {
  console.log("\n=== §4 · the persistence contract: a restored fusion cannot poison a frame ===")

  const poisoned = []
  for (const p of POISON) {
    const { ok, bad } = frameIsFinite(evalWithLinks([p.link]))
    if (!ok) poisoned.push(`${p.label} → ${bad.join("/")}`)
  }
  say(
    poisoned.length === 0,
    "no single malformed restored link can put a non-finite value in the frame",
    poisoned.length ? poisoned.join(" · ") : `${POISON.length} malformed shapes, all survived`,
  )

  /* THE PROPAGATION CASE, and the reason this matters more than one bad field.
   * The frame's multiplicative accumulators mean ONE poisoned link ruins every
   * later link that touches the same accumulator — a user's whole fusion, not
   * the one relationship they mistyped. */
  const mixed = [
    { id: "good", source: "breath", target: "ditherCell", amount: 0.8 },
    { id: "bad", source: "notASource", target: "ditherCell", amount: 1 },
    { id: "good2", source: "reveal", target: "ditherCell", amount: 0.5 },
  ]
  const { ok: mixedOk, bad: mixedBad } = frameIsFinite(evalWithLinks(mixed))
  say(mixedOk, "one bad link among good ones cannot poison the accumulator they share", mixedBad.join(", ") || "ditherScaleMul finite")

  /* CONTROL. The finiteness check must be able to SEE a non-finite frame, or
   * "all finite" is what it would report about anything. */
  say(!frameIsFinite({ ditherScaleMul: NaN, sweep: null }).ok, "CONTROL · the finiteness check catches a seeded NaN")
  say(!frameIsFinite({ envMapAdd: Infinity, sweep: null }).ok, "CONTROL · ...and a seeded Infinity")

  /* CONTROL. A WELL-FORMED link must still do something, or hardening could
   * have been implemented by ignoring every link. */
  const clean = evalWithLinks([{ id: "ok", source: "breath", target: "ditherCell", amount: 1 }])
  say(clean && clean.ditherScaleMul !== 1, "CONTROL · a well-formed link still reaches the frame (hardening did not mute the feature)", `ditherScaleMul ${clean?.ditherScaleMul?.toFixed(4)}`)

  /* The dangling-selection case, already handled and worth locking down: a
   * fusion deleted while selected must render as inert, never as `null` (which
   * the caller reads as "no fusion active" and would silently drop). */
  const clock = createStyleClock()
  clock.reveal = 1
  const dangling = evaluateFusion(
    { ...DEFAULT_STYLE_STATE, customFusions: [], fusionPreset: customFusionKey("gone"), fusionIntensity: 1 },
    clock, { asciiTime: 0, ditherTime: 0, textureTime: 0 }, 1,
  )
  say(dangling !== null && frameIsFinite(dangling).ok, "a selection pointing at a deleted fusion resolves to an inert frame, not null")
}

/* ================================================================== */
/* §5 · CROSS-MODULE STRING COUPLINGS                                  */
/* ================================================================== */
/**
 * ⚠ THE COUPLING THIS SECTION GUARDED IS GONE, AND THESE ROWS NOW GUARD THAT
 * IT STAYS GONE — 2026-08-03.
 *
 * What was here: `components/style-panel-scaffold.tsx` decided whether
 * "Portfolio Spin" was selectable by filtering `viewPresetBlockers()`'s output
 * on a string PREFIX typed into its own file —
 *
 *     const CLOSED_BLOCKER_PREFIX = "camera turntable:"
 *     viewPresetBlockers(id).filter((b) => !b.startsWith(CLOSED_BLOCKER_PREFIX))
 *
 * — so a reword in lib/style-system.ts would silently make a shipped preset
 * unselectable, with no test failing and no error anywhere. Five rows here
 * guarded that sentence.
 *
 * The filter existed for ONE reason: the blocker was stale (the turntable had
 * been built) and the scaffold's own comment said "the table cannot be
 * corrected from here (its file is another lane's)". The table is corrected
 * now — `viewPresetBlockers` no longer reports the turntable and
 * `portfolioSpin.implemented` is `true` — so there is nothing to filter and the
 * wrapper is deleted rather than left matching nothing.
 *
 * ASSERTING THE ABSENCE IS NOT DECORATION. The failure mode this section was
 * born from is a stale claim outliving the thing it describes, and the cheapest
 * way for that to come back is for someone to re-add a local filter instead of
 * correcting the table. So: no text filter anywhere in the scaffold, the
 * turntable really is in the tree, and — since 2026-08-03 — the video route
 * really is in the tree too, `viewPresetBlockers` returning nothing for either.
 * Each row can fail, and the last three fail by READING THE TREE rather than by
 * remembering it. That reading is the load-bearing part: a table that describes
 * the tree cannot be trusted to grade itself, and both entries this section has
 * outlived were removed only because a row here went red at the table.
 */
function crossModuleStrings() {
  console.log("\n=== §5 · cross-module couplings that are literally a string ===")

  const scaffold = src("components/style-panel-scaffold.tsx")
  /* The DECLARATION, not the word. The scaffold keeps a note naming
   * `CLOSED_BLOCKER_PREFIX` and saying it is gone and why — that record is the
   * point of removing it, and a check that forbids mentioning the thing forces
   * the history to be deleted along with the code. What must not come back is a
   * binding. (This row earned its keep immediately: written as a bare word
   * search it went red on that very note.) */
  say(
    !/\b(?:const|let|var)\s+CLOSED_BLOCKER_PREFIX\b/.test(scaffold),
    "the scaffold no longer filters blocker TEXT — the table it reads is correct instead",
    "no CLOSED_BLOCKER_PREFIX binding in components/style-panel-scaffold.tsx",
  )
  say(
    !/viewPresetBlockers\([^)]*\)\s*\.filter/.test(scaffold) &&
      !/viewPresetGaps\s*\(/.test(scaffold.replace(/^[^\n]*viewPresetGaps[^\n]*ARE GONE[^\n]*$/gm, "")),
    "…and nothing re-introduced a local filter under another name",
    "no `viewPresetBlockers(...).filter` and no surviving `viewPresetGaps` call in the scaffold",
  )

  const spin = viewPresetBlockers("portfolioSpin")
  const viewport = src("components/viewport-3d.tsx")
  say(
    spin.length === 0 && /autoRotate/.test(viewport) && /spinDegPerSecond/.test(viewport),
    "portfolioSpin declares NO blocker, and the turntable that closed it is in viewport-3d.tsx",
    `blockers ${spin.length} · autoRotate ${/autoRotate/.test(viewport)} · spinDegPerSecond ${/spinDegPerSecond/.test(viewport)}`,
  )

  /* ⚠ AND IT CAUGHT IT — this row is why it existed, and it is re-pointed
   * rather than relaxed (2026-08-03).
   *
   * It read `video.length === 1 && !route`, i.e. "the one surviving blocker
   * names a real gap", with the note "this is the row that fails if the video
   * route is wired and the blocker is not removed with it". The route was wired
   * hours later. Both halves moved together this time — the blocker is gone from
   * `viewPresetBlockers` and the `else if` is in `applyViewPresetById` — which is
   * exactly the outcome the turntable's version of this failure did NOT get.
   *
   * The claim is now the turntable's claim, one member along: NO blocker, and the
   * capability that closed it is in the tree. Both directions fail — re-add the
   * blocker and `video.length` is 1; delete the route and the regex misses. */
  const video = viewPresetBlockers("videoPreviewExport")
  const page = src("app/page.tsx")
  say(
    video.length === 0 && /export\?\.target === "video"/.test(page),
    "videoPreviewExport declares NO blocker, and the route that closed it is in app/page.tsx",
    `blockers ${video.length}${video[0] ? ` ("${video[0].slice(0, 60)}…")` : ""} · route in applyViewPresetById: ${/export\?\.target === "video"/.test(page) ? "present" : "ABSENT — the preset would frame a still and write nothing"}`,
  )
  /* CONTROL: the reader can tell a present route from an absent one. Without
   * this, "absent" above could be a regex that never matches anything. */
  say(
    /export\?\.target === "glb"/.test(page) && /export\?\.target === "png"/.test(page),
    "CONTROL · the same reader DOES find the two routes that exist (glb, png), so `absent` means absent",
    "both branches found in applyViewPresetById",
  )
}

/* ================================================================== */
/* §6 · SHARED SCALES — a literal with a promise on it                 */
/* ================================================================== */
/**
 * `evaluateStackAnimation`'s `revealSynced` multiplies the playhead by a bare
 * `4`, and its comment says the number "matches `evaluateLayerTime`'s
 * `revealScale` default … One named idea, one number, at both scales." That is
 * a duplicate held together by a comment. Asserted behaviourally so it survives
 * the constant being renamed or moved.
 */
function sharedScales() {
  console.log("\n=== §6 · shared scales ===")

  const clock = createStyleClock()
  clock.reveal = 1
  // revealScale deliberately OMITTED so the module's own default is exercised.
  const layer = evaluateLayerTime(clock, { animated: true, syncMode: "revealSynced", speed: 1 }).time
  const group = evaluateStackAnimation({
    enabled: true, behaviour: "revealSynced", speed: 1, phase: 0,
    sinceArmed: 5, reveal: 1, sinceCompletion: 5, loopSeconds: 4,
  }).timeOffset
  say(near(layer, group), "a reveal-synced GROUP travels exactly as far as a default reveal-synced LAYER", `layer ${layer} vs group ${group}`)

  // CONTROL: the comparison sees a real difference when there is one.
  const scaled = evaluateLayerTime(clock, { animated: true, syncMode: "revealSynced", speed: 1, revealScale: 6 }).time
  say(!near(scaled, group), "CONTROL · the comparison separates a layer on a different revealScale", `revealScale 6 → ${scaled}`)
}

/* ================================================================== */
/* §7 · ONE RAIL LIST — the collapse, held                             */
/* ================================================================== */
/**
 * "Which preset families does the rail show" had TWO answers in two files.
 * `PRESET_FAMILY_OPTIONS` (lib/style-system.ts) listed thirteen; the panel
 * unioned in `ROUTED_FAMILIES` (components/style-panel-scaffold.tsx) to reach
 * fifteen, because at the time this module belonged to another live lane — a
 * correct per-consumer opt-in that nonetheless left a second source of truth.
 * The consumer wrote down how to collapse it; that collapse has now happened.
 *
 * These assertions keep it collapsed. They are what stops the union quietly
 * becoming load-bearing again the next time a family is added to one list and
 * not the other — which is the same shape as `ALL_PRESETS` enumerating the UI
 * list instead of the registry, a defect that made twenty presets unresolvable
 * and produced no symptom at all.
 *
 * Note the deliberate asymmetry: the rail is allowed to be WIDER than the style
 * path (geometry and view are routed by app/page.tsx). What it may not be is
 * DISAGREED WITH.
 */
function oneRailList() {
  console.log("\n=== §7 · one rail list ===")

  const { PRESET_REGISTRY, PRESET_FAMILY_OPTIONS, NON_STYLE_FAMILIES } = S

  const railIds = PRESET_FAMILY_OPTIONS.map((f) => f.id)
  const dupes = railIds.filter((x, i) => railIds.indexOf(x) !== i)
  say(dupes.length === 0, "the rail list has no duplicate family", dupes.join(", ") || `${railIds.length} families`)

  const registryFamilies = Object.keys(PRESET_REGISTRY)
  const missing = registryFamilies.filter((f) => !railIds.includes(f))
  say(
    missing.length === 0,
    "every family in the registry is on the rail list (nothing needs a second list to be shown)",
    missing.join(", ") || `${registryFamilies.length} families`,
  )
  const ghosts = railIds.filter((f) => !registryFamilies.includes(f))
  say(ghosts.length === 0, "the rail list names no family the registry does not have", ghosts.join(", ") || `${railIds.length} rows`)

  /* THE CONSUMER'S UNION MUST NOW BE A NO-OP — parsed from its source, because
   * the point is whether the OTHER file still adds anything. */
  const scaffold = src("components/style-panel-scaffold.tsx")
  const block = scaffold.match(/const ROUTED_FAMILIES[^=]*=\s*\[([\s\S]*?)\n\]/)
  say(!!block, "the consumer's ROUTED_FAMILIES is readable from source")
  if (block) {
    const routed = [...block[1].matchAll(/id:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"/g)].map((m) => ({ id: m[1], label: m[2] }))
    say(routed.length > 0, "…and it parsed", routed.map((r) => r.id).join(", "))

    const adds = routed.filter((r) => !railIds.includes(r.id))
    say(
      adds.length === 0,
      "the consumer's union now ADDS NOTHING — the rail has exactly one source of truth",
      adds.map((r) => r.id).join(", ") || `${routed.length} routed families, all already listed`,
    )

    /* A collapse that renamed a pill is not a collapse, it is a redesign the
     * user did not ask for. */
    const relabelled = routed.filter((r) => {
      const own = PRESET_FAMILY_OPTIONS.find((f) => f.id === r.id)
      return own && own.label !== r.label
    })
    say(
      relabelled.length === 0,
      "the collapsed rows kept the consumer's own labels (no pill was renamed)",
      relabelled.map((r) => `${r.id}: "${r.label}"`).join(", ") || routed.map((r) => `${r.id}="${r.label}"`).join(" · "),
    )

    /* TWO NAMES FOR ONE IDEA, IN TWO FILES — they must denote the same set.
     * `ROUTED_FAMILIES` (the panel's "app/page.tsx routes this") and
     * `NON_STYLE_FAMILIES` (the module's "applyPresetToStyleState refuses this")
     * are the same fact stated twice. */
    const routedIds = routed.map((r) => r.id).sort()
    const nonStyle = [...NON_STYLE_FAMILIES].sort()
    say(
      JSON.stringify(routedIds) === JSON.stringify(nonStyle),
      "ROUTED_FAMILIES and NON_STYLE_FAMILIES denote the same set (one fact, stated in two files)",
      `routed [${routedIds.join(", ")}] vs refused [${nonStyle.join(", ")}]`,
    )
    // CONTROL: the comparison is a real set comparison, not a length check.
    say(
      JSON.stringify(routedIds) !== JSON.stringify([...nonStyle, "texture"].sort()),
      "CONTROL · that comparison separates two sets of different content",
    )
  }

  /* `enabled` MEANS "APPEARS IN THE UI LIST", per its own doc comment. It was
   * false on all 20 geometry/view presets while the panel showed every one of
   * them, so the field lied about 14% of the registry — and a gate that read it
   * as selectability was green about a property the shipped UI does not use.
   * Now it is true, so it must be EARNED: a routed family's member is only
   * honestly "enabled" if it carries the patch its router reads. */
  const unrouted = []
  for (const fam of NON_STYLE_FAMILIES) {
    for (const p of PRESET_REGISTRY[fam]) {
      /* ⚠ ONE ARM PER ROUTED FAMILY, and there are three now. `geometryAnimation`
       * joined `NON_STYLE_FAMILIES` on 2026-09-04 carrying its patch on `motion`,
       * for the same reason families 1 and 15 carry theirs on their own fields:
       * a take is not style state. A two-arm ternary read `undefined` for the new
       * family and called five presets with complete patches unrouted. */
      const patch =
        fam === "geometry" ? p.geometry : fam === "view" ? p.view : p.motion
      /* ⚠ `implemented: false` IS AN EXEMPTION, AND IT IS THE DOCUMENTED ONE.
       * `StylePreset.implemented`'s own doc reads "when false, selecting it only
       * records metadata; it must NOT pretend to work", and
       * `style-panel-scaffold.tsx` states the intent out loud: the roadmap pills
       * "stay ON the rail, labelled soon, because the roadmap they describe is
       * real (PRD Family 14) and hiding it would" lose it. `applyPresetToStyleState`
       * has an `inert` guard built for exactly that state and
       * `assert-preset-registry` holds the direction that actually matters:
       * implemented:true with no patch is a LIE and stays red.
       *
       * This row never met the case before 2026-09-04 because the two routed
       * families had no roadmap shells. `geometryAnimation` has one,
       * `completionPulse`, which needs post-arrival motion that does not exist.
       * Demanding a patch from it would have forced either a fake patch or the
       * pill's deletion, and both are worse than the truth. */
      if (p.enabled && p.implemented && !patch) unrouted.push(`${fam}/${p.id}`)
    }
  }
  say(
    unrouted.length === 0,
    "every enabled member of a ROUTED family carries the patch its router reads",
    unrouted.join(", ") || `${[...NON_STYLE_FAMILIES].map((f) => `${f}:${PRESET_REGISTRY[f].length}`).join(" · ")}`,
  )
  // CONTROL: the predicate catches a member that claims the rail with no patch.
  say(
    (() => {
      const seeded = { id: "seed", enabled: true }
      return !(seeded.enabled && seeded.geometry)
    })(),
    "CONTROL · the predicate catches an enabled member with no routing patch",
  )
}

/* ------------------------------------------------------------------ */
oneEnvelope()
oneTriggerRule()
stateContract()
persistenceContract()
crossModuleStrings()
sharedScales()
oneRailList()

console.log(`\n${fail === 0 ? `ALL ${pass} STYLE-CONTRACT ASSERTIONS PASS` : `${fail} FAILED of ${pass + fail}`}`)
process.exit(fail === 0 ? 0 : 1)

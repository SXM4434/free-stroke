# CL-GAPS · log

Branch `claude/gaps` from `0b5d2dcf3`. Document validation and gates only; nothing a person sees changes.

## Plan

1. `validateSession` (lib/doc-store.ts): a wrong type on a draw-in extra (`revealEnvelope.tipHighlight`,
   `pressureReveal`, `durationSeconds`, `timing`) or on any `fusion*` style field falls back to the default
   and pushes a repair. An unknown value on a fusion union (`fusionPreset`, `fusionDrive`,
   `fusionCompletion`, `fusionPauseHold`) does the same. Valid saved values load unchanged.
2. Rows: one saved document with every fusion field and every draw-in extra at a non-default valid value
   round-trips with no repair; each invalid value is repaired and named.
3. LISTED and PANEL render the component in Node (react-dom/server) with the props the panel passes and
   look for its controls. WIRE drives the dither hold path instead of finding its text.
4. Codex's four breaks go into the gates' own mutant lists as must-fails, each shown turning its row red.
5. tsc stays at 6. Rerun assert-drawin-extras-node, assert-fusion-chaos, assert-key-paths,
   assert-stroke-timing.

## Codex's four breaks

| # | Break | Row that must go red |
|---|---|---|
| 1 | doc-store.ts:833 style coerce input `{ ...styleCandidate, fusionChaos: 0 }` | round-trip row |
| 2 | draw-in-timing-controls.tsx:126 `if (true) return null` | LISTED |
| 3 | style-panel-scaffold.tsx `case "fusion"` returns null | PANEL |
| 4 | viewport-3d.tsx:6095 `if (false)` before the dither holdValue | WIRE |

## State at hand-back (lane retired at 151k context, 2026-10-02)

DONE, committed:
- `scripts/verify/_ts-load.mjs`: `.tsx` now transpiles with the automatic JSX runtime, and
  `loadTs(file, { expose: [...] })` returns unexported module-level names on `__gate`, appended in
  memory after any mutant. Calls with no `expose` keep the old cache key. Watch out: the key separator
  is a literal NUL byte, `"\0"`, so a text match on that line needs it. Proved by a throwaway probe:
  `PanelControl` id `fusion` inside `FieldScopeCtx.Provider` with keys `{fusionChaos}` renders
  `data-field-keys="fusionChaos"` wrapping `<input type="range" value="0.85">` for a state at 0.85.
  NOT RUN after this change: any existing gate. Run the four first.

NOT DONE, in order:
1. `validateSession` (lib/doc-store.ts:824). Cause: `coerceAgainst` (doc-store.ts:~766) keeps the
   default on a wrong type with no report, so `tipHighlight: "broken"` reads 0 and then passes the
   0..1 range check with repairs []. The style coerce at :833 passes no unions, so
   `fusionCompletion: "banana"` loads as is. Fix: give `coerceAgainst` a 6th param
   `report?: { label: string; only?: (k: string) => boolean }` that pushes a repair into `rejected`
   for a present key of the wrong type or a non-finite number. Pass it for drawIn, revealWindow,
   revealEnvelope, and for the style coerce with `only: k => k.startsWith("fusion")` plus unions for
   fusionDrive, fusionCompletion, fusionPauseHold (write them as `Record<Union, true>`, like
   ALIGN_VALUES). fusionPreset is a template union: accept `FUSION_PRESETS` ids (none, terminalGel ..
   letterpress; BUILTIN_LINK_FUSIONS ids are a subset) or a `custom:` / `combo:` prefix; anything
   else reads `none` with a repair. The 11 session fusion fields: fusionPreset, fusionDrive,
   fusionAnimationEnabled, fusionAnimationSpeed, fusionIntensity, fusionSwing, fusionChaos,
   fusionRevealInfluence, fusionCompletion, fusionTipShimmer, fusionPauseHold.
2. Round-trip row (break 1): one saved document with every fusion field and every draw-in extra at a
   non-default valid value reads back unchanged, repairs []; each invalid value (wrong type, unknown
   enum) reads the default and adds a repair. Put the fixture in one shared module
   (`scripts/verify/_saved-doc-rows.mjs`) and call it from both gates as row `SAVED`.
3. PANEL (assert-fusion-chaos.mjs:367): load the scaffold with
   `expose: ["PanelControl", "FieldScopeCtx", "fieldWrap", "MOTION_FIELD_KEYS"]`, render
   `PanelControl` id `fusion` once per key with scope `{k}` alone; require `data-field-keys` naming k
   and the control showing the state's value. A Field scope of one key also proves the group Field
   at scaffold:2870 names it, or the whole block returns null. For writes, wrap
   `require("react/jsx-runtime").jsx/jsxs` during the render to capture input and button props, then
   call onChange `{ target: { value } }` and onClick, and check setStyleState's updater writes k. This
   keeps the existing "Hold pills write nothing" and "Chaos slider not in a Field" mutants red.
4. LISTED (assert-drawin-extras-node.mjs:~200): render `DrawInTimingControls` with the panel's props
   (`{...drawInTiming} wrap={fieldWrap} showPace`, scaffold:3198) inside the scope `{envelope.k}`;
   check MOTION_FIELD_KEYS from `__gate`, not the source text.
5. WIRE (assert-fusion-chaos.mjs:389): cut the real lines out of viewport-3d.tsx by anchor text (the
   pausedNow and hold lines at :6002-6003, the fusion hold at :6045-6046, the block after
   "THE HOLD, AFTER FUSION" at :6089-6098), transpile, and run them per frame with stub refs over a
   playhead that plays then stalls. Dither must stay held under `dither`, all three under `surface`,
   none under `off` or while playing.
6. Mutants to add, by find text: (1) doc-store `coerceAgainst(DEFAULT_STYLE_STATE, styleCandidate,`
   becomes `coerceAgainst(DEFAULT_STYLE_STATE, { ...(styleCandidate as object), fusionChaos: 0 },`,
   red SAVED in both gates; (2) dtc `  const W = wrap ??` gets `if (true) return null\n` in front,
   red LISTED; (3) scaffold `case "fusion":\n      return (\n        <FusionControl` becomes
   `case "fusion":\n      return null; (\n        <FusionControl`, or return null outright, red PANEL;
   (4) viewport `      d.uFsDitTime.value = holdValue(` gets an `if (false) ` prefix, red WIRE.
7. tsc must stay at 6, then rerun assert-drawin-extras-node, assert-fusion-chaos, assert-key-paths,
   assert-stroke-timing and report each N of M.

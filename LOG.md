MERGE-READY

# PERSTROKE cloud log, 2026-10-02

Branch `cloud/perstroke`, from the integration snapshot `cloud/integrate-1001` at 2cc9e98 (main plus the dockview layout, keyframe anything, Hand Draw phase 3, the carve fix). Coverage item 9 (rows 54, 55, 58) and plan section 3d: motion on a stroke after it lands. Three steps, one commit each, each pushed. Nothing under `docs/thinking` or `docs/verification` is committed. No browser in this lane, as asked: everything below is code checks.

Off is byte-identical by construction. With `styleState.landing` absent (Off), no group is written, the transport length and the key reader are what they were, and the session saves without the key.

## Step 1 · 27fd455 · the math, `lib/landing-motion.ts`, and its gate

No React, no three.js. Four effects, each a pose (uniform scale and a turn about the view axis) of time since the landing:
- **Spring**, Desk Doodles' dd-land: 0.92 at the landing, 1.015 at 62 %, 1 at the end, each keyframe segment on dd-land's own curve. Read, not retyped: `DESK_DOODLES.motion` in `lib/registers.ts` (`settleFrom` 0.92, `settleMs` 420, `staggerMs` 50, and the `ease` string, parsed and run through `cubicBezierEase` from `lib/flip-pose.ts`). The only new numbers are dd-land's middle keyframe, 1.015 at 0.62, which the register does not carry (plan quotes Desk Doodles' `DeskPage.tsx:2728-2737`).
- **Settle**, the lab's pop-in from `lib/hero-motion.ts`: `popScale + (1 - popScale) * easeOutStrong(u)` over `popSettleSec`, about the contact (the lowest edge), as the lab pins its own.
- **Pulse**, `pulseEnvelope` from `lib/style-clock.ts`, the envelope both existing completion pulses share, as scale, lifted off its 4 % cutoff so it meets rest instead of dropping the last 4 % in one frame. `PULSE_ATTACK_SECONDS` is now exported (no value change) so the peak is read.
- **Wobble**, the one new curve: `amount * sin(2 pi 2 u) * (1 - u)^2`, leaving the landing at rest and arriving at rest with no velocity.
- **Stagger**: units start in landing order, none sooner than `staggerMs` after the one before. Landings already further apart keep their own times; tied ones ripple 50 ms apart.
- Reduced motion is rest throughout (dd-land drops its scale under reduced motion; a stroke has no fade to keep).

## Step 2 · 8eb5ab3 · the viewport

- Each mesh's group in `AnimatedStrokes` (tube, caps, joints) gets a ref. A block at the end of the frame loop writes the pose onto it about the stroke's own pivot (`poseOffset` holds the pivot still).
- When a stroke lands is read from the clock its engine draws by: a timed take's slot end; Rod's own per-stroke clock (`timelines`) when nothing reorders it; otherwise the first playhead where `revealDistanceFraction` reaches the stroke's end in the schedule (`firstReach`, which finds the first crossing, not the end of a pen-lift flat), which is what Solid, Extrude and Inflate cut by.
- Which stroke a mesh is comes from its key (`stroke-<i>`, `dd-<mode>-<i>`, `inflate-svfi-<i>`). Fused meshes (Solid, Desk Doodles solid, Inflate's implicit surface) pose as the whole mark. Rebuilt pieces (Solid, Extrude, Inflate loft) map back through the list of strokes the reveal has reached; their pivots come from the whole stroke's ink so they do not slide while drawing.
- The last stroke lands as the take ends, so the transport runs on by `landingTailMs` and builds the key reader: the flip's own mechanism (FLIP-3), so the reveal holds whole and the spring plays live and in export.
- `__fsTake.get().landing` reports the last frame's poses, for a browser gate later.

## Step 3 · 1d77279 · Completion Pulse, the controls, the session

- **Completion Pulse is implemented**: Authentic Draw's take, then the whole mark swells once as the last stroke lands. `MotionPresetPatch` gains a `landing` part. A preset is spread onto Off, so any other draw-in preset turns a landing off.
- **Landing block in the draw-in controls** (`components/draw-in-timing-controls.tsx`), in the Animation panel and the dock, through `drawInTiming` like the flip: Off, Spring, Settle, Wobble, Pulse; Each stroke or Whole mark; Amount, Length, Stagger. Picking an effect loads its own numbers.
- Customize lists the five landing fields under Completion Pulse with Reset; Save as mine keeps them.
- `doc-store` reads a stored landing back through `resolveLanding`, turns an unknown effect off and names every repair, including a clamped number.

## Checks

| check | unchanged branch (2cc9e98) | this branch (1d77279) |
|---|---|---|
| tsc | 6 (5 `lib/geometry-engines.ts`, 1 `lib/dd-engine/handFeel.ts`) | 6, the same 6 |
| assert-keyframes | 16/16 rows, 21/21 mutants | 16/16, 21/21 |
| assert-key-paths | 6/7 rows, 8/8 mutants (EXISTING throws, see below) | 6/7, 8/8, the same row |
| assert-width-keys | 12/12, 9/9 | 12/12, 9/9 |
| assert-camera-moves | 11/11, 20/20 | 11/11, 20/20 |
| assert-flip-pose | 8/8, 10/10 | 8/8, 10/10 |
| assert-stroke-timing | 0/1 rows, 0/12 mutants (RUN throws, see below) | 0/1, 0/12, the same throw |
| **assert-landing-motion** (new) | n/a | **23/23 rows, 28/28 mutants caught, no unguarded row** |

The new gate's rows: SP-START, SP-PEAK (1.015 +- 0.003 at 62 % of the length and the highest point, plan SP1), SP-REST, SP-REDUCED (plan SP1's second half), SP-REUSE, SE-START, SE-PEAK, SE-REST, SE-REUSE, WO-START, WO-PEAK, WO-REST, PU-START, PU-PEAK, PU-REST, PU-REUSE, STAGGER, PIVOT, REACH, UNITS, OFF, PRESET, SESSION. Every row is turned red by at least one of the 28 mutants (run through `GATE_MUTATE_FILE`, nothing on disk changes), and all 28 were shown firing.

Also run on both trees, line for line identical: assert-drawin-monotone 16 pass; assert-fusion-combos 34 pass; assert-fusion-rail 4 pass; assert-hero-camera, -ledger, -rise, -twos, -windup SOUND; assert-hero-carve, -hold, -options, -return, -turn, -word-legible red on both; assert-motion-paste 3/7 red on both; assert-preset-registry 61 pass; assert-style-contracts 5 of 44 red on both; assert-timing-origin 42 pass. One detail moved inside an already-red row: assert-style-contracts' two "every StyleState field has a default" rows, red on the snapshot for `flip`, now read "flip, landing". Same rows, same count. See question 3.

## What I could not run

- **No browser**, by the lane's terms. The landing has not been seen on screen on any engine. The browser gates were not run.
- **assert-key-paths EXISTING** and **assert-stroke-timing RUN** read commits 747af8fa0 and b0da66626 from git history. This snapshot is one commit with no history, and neither commit can be fetched from origin. Red on the unchanged branch for that reason alone.
- **assert-drawin-2d-parity** is killed (exit 137) on the unchanged snapshot too, run alone. Out of memory in this container.

## Known limits

- **Inflate's implicit surface is one fused mesh**, so on the default engine every effect plays on the whole mark when the last stroke lands, not stroke by stroke. Per stroke there needs a per-vertex stroke index and a shader transform, the letter path's machinery (`FS_LETTER_MAX = 16`). Not built here.
- **No held pose under the pen's field.** Meshes carrying the pen tip and carve (Inflate with reveal keys) stay at rest until they land, because the field reads world positions back through the flatten group. So on Inflate a spring or settle starts with a jump to 92 % or 86 % at completion. Rod, Extrude, Solid and Desk Doodles draw at the landing pose and spring from it with no jump.
- Only the Grow window lands. Under Travel, Vanish and Shrink the ink leaves again, so the landing is off there.
- With drawProgress keys, the landing is placed on the take's own clock, not the keyed reveal.
- A GLB exported mid-landing carries the pose. At rest it is identity.
- Under a reordered schedule on Solid or Extrude, a piece can map to the wrong stroke for one rebuild (about 22 ms) when a stroke starts mid-list.
- The tail is conservative: duration plus stagger times (strokes minus 1), so a long drawing on Spring can hold still at the end for a beat longer than it needs.
- The viewport's own Timing popover has no Landing block, as it has no Flip pills. The Animation panel and dock do.

## Questions for the owner

1. **Spring length: 420 ms or 360 ms?** The register (`DESK_DOODLES.motion.settleMs`) says 420 and the spring reads it. The plan quotes Desk Doodles' `dd-land` at 360 ms. Length is a slider, so 360 is one drag, but the default should be one of them.
2. **Should a stroke spring at all?** The plan flags it: Desk Doodles calls its motion "weighted calm" and "paper doesn't bounce", and its spring is a doodle landing on the desk, not a stroke being drawn. Everything here is off until he picks it.
3. **Keying the landing.** "Keyframe anything" wants a key on Amount, Length and Stagger. They can only be keyed once `landing` has a value in `DEFAULT_STYLE_STATE` and a scaffold slider per number, which is what `KEYABLE_PATHS` and assert-key-paths' SLIDERS row read. Today `landing` is optional (absent is Off) like `flip`, and left out of `StyleNumericPath`. Move both into the default and give the scaffold their sliders, or keep them optional and exempt them in assert-style-contracts?
4. **Per stroke on Inflate.** Worth building the per-vertex stroke index so the default engine lands stroke by stroke, or is the whole-mark landing enough there?

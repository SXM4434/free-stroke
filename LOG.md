NOT MERGE-READY: the code is done and every check matches this branch's own unchanged run, but two of the six required Node gates cannot run in this snapshot (their reference commits are not in it), and nothing was seen in a browser.

# FUSION-CHAOS cloud log, 2026-10-02

Coverage item 12, rows 82 and 83 (`docs/research-2026-09-26/animation-asks-coverage.md`): fusion chaos, and the Phase 23 sync list. Branch `claude/fusion-chaos-phase-23-s3zo29`, from the snapshot `2cc9e98`. The brief said `cloud/<job-name>`; this session's harness pins the branch name above and forbids pushing any other, so the work is here. Four steps, one commit each, each pushed. Nothing under `docs/thinking` or `docs/verification` was written or committed.

## What the rows asked, and what each became

Row 82 (PRD §4, animated fusion): "chaos/readability, reveal influence, completion behavior". Row 83 (plan Phase 23): "shimmer riding the tip, dither freezing on pause, a fusion bloom at completion". Five fields, all in the Fusion panel, all in every fusion preset (so Customize lists them), all reset by any composition pick. Each is the identity at its default.

| Field | Control | Default (= today) | What it does |
|---|---|---|---|
| `fusionChaos` 0..1 | Chaos slider, keyable | 0 | How far the fused systems drift from each other. Each system runs the same relationship on its own lagged clock: texture 0, dither 0.9 s, ASCII 1.7 s, surface 2.6 s, times chaos. Breath, arrival and burst events come apart. Never a new random signal. Inert under Motion Off. |
| `fusionRevealInfluence` 0..1 | Reveal slider, keyable | 1 | How much the draw gates the link. 1 is the smoothstep gate; 0 runs at full strength from the first frame. |
| `fusionCompletion` | Pulse / Bloom / Off pills | Pulse | Pulse is today's kick. Bloom (Phase 23) rises over 0.35 s and settles over 1.4 s to the same peak, about 3x the pulse's area. Off has no accent. |
| `fusionTipShimmer` 0..1 | Tip shimmer slider, keyable | 0 | A shine band at the draw front while the take plays, fading at both ends. It never dims a brighter band a relationship already has. |
| `fusionPauseHold` | Off / Dither / Surface pills | Off | With the take paused part way (playhead still inside 0..1 for 0.12 s), Dither holds the dither phase. Surface holds dither, texture and ASCII, plus the fusion frame from before the pause. |

## Steps

1. **1f629a0** · Fields and controls. `lib/style-system.ts`: the five fields, `FusionCompletion` and `FusionPauseHold` types, defaults, `STYLE_RANGES` rows, `FUSION_BASE`, `COMPOSITION_RAIL_KEYS`. `lib/style-key-meta.ts`: lane labels (Chaos, Reveal, Tip shimmer). `components/style-panel-scaffold.tsx`: three sliders under Link, Swing and Speed, then the two pill rows, each in a `Field` of its own key and in the panel's group `Field`. The dials stay above them, so the fold the old comments warn about is not touched by this change (not measured, see below). Keyable paths 38 to 41.
2. **aee13e0** · Engine, `lib/style-fusion.ts`. `evaluateFusion` wraps the old body (`evaluateFusionCore`). New pure functions: `driftFusionFrame`, `revealGate`, `completionEnvelope`, `withTipShimmer`, `watchPause`, `pauseHoldLayers`, `holdValue`. At the defaults the wrapper returns the core's frame object.
3. **3eac4eb** · Viewport, `components/viewport-3d.tsx`. The frame loop watches the playhead every frame. Under a fusion it applies the hold after fusion's own time push, so what stands still is what the screen shows. Tip shimmer arrives as the fusion frame's `sweep`, which the loop already applied.
4. **5725bea** · Gate, `scripts/verify/assert-fusion-chaos.mjs`. Node only.

## Checks

The baseline is this branch unchanged (`2cc9e98`), run in a separate worktree. The after-run is the branch head.

| Check | Baseline | After |
|---|---|---|
| tsc | 6 errors (5 geometry-engines, 1 handFeel) | 6, the same 6 |
| **assert-fusion-chaos** (new) | n/a | **9 of 9 rows; 17 of 17 must-fails caught; no row without one** |
| assert-keyframes | 16/16 rows, 21/21 mutants | 16/16, 21/21 |
| assert-key-paths | 6/7 rows (EXISTING), 8/8 mutants | 6/7 (EXISTING), 8/8; PATHS 41 of 41, SLIDERS 41 of 41 |
| assert-width-keys | 12/12, 9/9 | 12/12, 9/9 |
| assert-camera-moves | 11/11, 20/20 | 11/11, 20/20 |
| assert-flip-pose | 8/8, 10/10 | 8/8, 10/10 |
| assert-stroke-timing | 0/1 (RUN), 0/12 | 0/1 (RUN), 0/12 |
| assert-fusion-combos | 34/34 | 34/34 |
| assert-fusion-rail | 4/4 | 4/4 |
| assert-preset-registry | 61/61 | 61/61 |
| assert-style-contracts | 39/44, 5 failed | 39/44, the same 5 rows |

The new gate's rows:
- **IDENT.** Off is byte-identical. The reference is `lib/style-fusion.ts` at `2cc9e98`, loaded from git beside the new one. 41,472 of 41,472 frames are identical, Object.is on every number: 36 relationships (14 shipped, the link built-ins, every sixth combination cell, two of the user's own) x 3 drives x 2 motion modes x 192 clocks. Also 41,472 of 41,472 with the fields absent (a state saved before them). Its control: Link 0.60 vs 0.61 must differ, and does.
- **CHAOS.** The lag law is exact in 324 of 324. Chaos 1 on Loop moves 26 of 36 relationships (bar 60%). Inert under Motion Off in 324 of 324.
- **REVEAL.** Smoothstep exact at 1, open at 0, monotone between; checked through the engine on Terminal Gel before the draw.
- **COMPLETE.** Pulse exact at 801 of 801 times. Bloom peaks at 1.0000 at 0.35 s, area 1.569 against the pulse's 0.505. Off equals never completed.
- **TIP.** The band is at the front in 99 of 99 reveals, stays on the mark, advances, is absent at 0 and 1, and keeps a brighter band.
- **PAUSE.** Playing: 0 of 180 frames read paused. A stall holds from frame 38 (began 30). No hold at 0 or 1, no one-frame hiccups.
- **FIELDS.** 42 of 42 fusion and animated-fusion presets list the five and reset them. 53 of 53 texture, dither, ASCII and stack presets reset them. The three numbers are keyable in the Fusion family.
- **PANEL** and **WIRE** are source checks.

Must-fails are listed in the gate. One was MISSED on the first run: dropping `fusionPauseHold` from the rail keys did nothing, because the fusion presets set it anyway. FIELDS now also picks the 53 other composition presets, and it fires.

Fixes the gate forced on my own code and instruments, before step 2:
- Chaos changed 48 of 324 frames under Motion Off. It is now skipped with style time stopped.
- The IDENT control sat at reveal 0, where every frame is the identity. It now sits at reveal 1.
- The bloom settle check flagged the step across its own peak. It now starts after the rise.

## What I could not run

- **assert-key-paths EXISTING** and **assert-stroke-timing** (its single RUN row) fail identically before and after. Each reads a commit by hash (`747af8fa0`, `b0da66626`) that this one-commit snapshot does not contain. Their other rows and mutants are unchanged. They need a clone with main's history.
- **assert-fusion-combo-liveness, -two-dead, -combo-distinct, assert-inflate-fusion** read browser captures under `docs/verification`, which the snapshot leaves out. **assert-custom-presets** imports `jiti`, which is not installed. All fail identically before and after.
- **No browser** (this lane's brief). Not run: assert-fusion-ui (the dial-fold check), assert-fusion-authoring, assert-key-buttons, assert-motion-customize, assert-layer-flicker. Nobody has seen the new controls, the bloom, the tip band or the pause hold on screen. assert-fusion-ui is the one most likely to move: the panel is taller now, though the new rows sit below the dials it measures.

## Questions for the owner

1. **Tip shimmer rides the draw front, not the pen point.** The band travels left to right across the mark as the take plays, which matches writing. A stroke drawn right to left still has its band go left to right. Riding the exact pen point needs the tip's position published in the frame loop. Do you want that next?
2. **Hold on pause sits in the Fusion panel and acts only while a fusion is on**, because that is where the rows put it. Should dither freeze on pause with no fusion too? If so, it moves to the Dither or Animation panel.
3. **Chaos is drift in time only**: lag up to 2.6 s at 1. If you want chaos to also loosen the relationships (shuffled strengths, not only timing), that is a second dial, not this one.
4. **Bloom's numbers** (0.35 s rise, 1.4 s settle, same peak as the pulse) are first guesses for your eye.

**124 asks: 58 PRESENT, 32 PARTIAL, 26 MISSING, 0 CUT BY HIM, 8 UNKNOWN.**

# What he asked for in animation, and what the code has for each, 2026-09-26

Read-only lane on main at `95f724f87`. Nothing was run, no browser was opened, no code changed.

The keyframing he was angry about on 09-25 is in now: keys, a curve between them, a stroke strip he can drag, Perform, camera moves and width all have a reachable control and a code path on `/`. What is still missing is mostly what sits around them. His named sequences never left the lab. The pen still doesn't write like a hand on `/`. He can't save his own motion, and nothing is keyed per stroke except timing.

58 UNKNOWN is a big number, and it doesn't mean broken. Those asks live outside the nine files this lane traced: surface animation, export, the hero films, and quality asks only an eye can grade. The next lane should trace them from `components/style-panel-scaffold.tsx` and `lib/export/`.

**Sources.** R = `docs/research-2026-09-25/animation-asks/REPO.md` row number. R2 = `REPO-2.md`, N number or note. TR = `TRANSCRIPTS.md` section. PLAN = `plan-pasted-2026-07-28.txt` line. DES = `docs/research-2026-09-25/animation-tools/DESIGN.md`. RUL = `docs/rulings/2026-09-25-animation-comes-back.md`, build-order item.

**Files.** strip = `components/stroke-strip.tsx`, lanes = `components/key-lanes.tsx`, perform = `components/perform-take.tsx`, scaffold = `components/style-panel-scaffold.tsx`, vp = `components/viewport-3d.tsx`, dtc = `components/draw-in-timing-controls.tsx`, which the strip and the Animation tab both render.

**Nothing was cut by him.** PLAN:2854 says "Do not build a timeline." It is one line in the Material branch's hard rules, next to "Do not touch geometry", and the same plan lists "timeline/keyframes" under the full animation tools to come (PLAN:2419). A scope limit on one branch, not a ruling.

## The table

| # | ask | source | his words | grade | evidence |
|---|---|---|---|---|---|
| **A** | **Authoring motion** | | | | |
| 1 | Keyframe the motion | R#1, TR A, PLAN:2419, RUL 3 | "Where's all the keyframing stuff" | PRESENT | Control: lanes:809-813, "Add a key at the playhead", shown when the page passes `setKeys` (strip:425, strip:662, provider `app/page.tsx:1790`). Path: `lib/keyframes.ts:237` `sampleKeys`, read at vp:7827 and vp:7840 |
| 2 | Edit the motion of one stroke | R#2 | "editing any of the motion of the strokes outside of the textures" | PRESENT | Control: strip:497 bar drag. Path: strip:370-379 writes the row, strip:325 `withRow`, `lib/stroke-timing.ts:346` `buildTimedSchedule`, sampled at vp:6538 |
| 3 | Perform the pen's motion himself | R#3, TR A, RUL 2 | "as if you wre somoen in control of the pen thorugh a motion tool" | PRESENT | Control: strip:619-627 Perform. Path: perform to `fitPerformed` `lib/stroke-timing.ts:752`, `withPerformed` :876, the row's `performed` field :85 |
| 4 | A full animation side of the app | R#4 | "oh wait u never built our the full animation part of the app did u" | PARTIAL | The tools are split: the drawer's Animation tab (scaffold:200, :3504, rendering dtc at scaffold:3018) and the dock under the transport (vp:14381). No animation workspace of its own, and the dock card is capped at 55% of the viewport height, vp:14372 |
| 5 | An animation panel he can find | R#5, R#6, R2 note #5 | "there's like no animation panel whatsoever" | PARTIAL | The Animation tab exists, scaffold:200-201. The keys live only in the dock, not the tab. Whether the dock shows before a stroke exists was not traced |
| 6 | His named sequences as toggles: 2D+3D draw-in, 3D first, a letter flip after all are drawn in 2D-first, 3D-first and both | TR E, R#6, R2 N21 | "I WANT AOPTIONS FOR DIFFRENET ANIMTIOSN ... ONE THAT STARTE WITH THE 3D AS FIRST , OBE THAT FLIPS LETTER BY LETTER" | MISSING | `solidFirst` (`lib/hero-motion.ts:197`) and `letterByLetter` (:302) have zero hits in `app/page.tsx`, vp and dtc. They play only on `/desk-doodles` |
| 7 | Claude's own animation ideas | R#7, TR E | "remmber i asked to come up with some of ur own as well" | UNKNOWN | Nothing in the code is marked as answering it. The four camera moves at `lib/camera-moves.ts:204-292` are agent ideas; whether they count is his call |
| 8 | Desk Doodles' animation used directly in the app | R#8, TR M, R2 note #8 | "recreating will nevr fele right diecet usuage alway will" | PARTIAL | The pen-model clock `stampPenClock` (`lib/pen-reveal.ts:1740`) is called only from `app/desk-doodles/page.tsx:175` and :380. The films don't reach `/`, see row 6 |
| 9 | A timeline he can edit, not only scrub (the DialKit ask) | TR C, R#15, R#16 | "GET TEH FCKIG DILA KIT TIMELINE UP AND RUNNING" | PRESENT | `components/take-timeline.tsx:285-286` swaps in the editable strip when the page provides the take. Not DialKit: the DialKit dock stays on `/desk-doodles` |
| 10 | Storyboard key scenes, then the frames between | TR H | "GIEV LOCIC KEY SCNES AND THEN YOU CREATE THE FRAMES BETWEEN" | UNKNOWN | A working method. No code can show it |
| **B** | **Curves and easing** | | | | |
| 11 | Easing on the draw-in | R#9, TR I, PLAN:1783 | "the aniamtion suck dikc no easing wayy to fast" | PRESENT | Control: dtc:457. Path: `easeReveal`, `lib/stroke-timing.ts:255` |
| 12 | A curve he shapes on the draw-in itself, overshoot included | R#10, R2 note #10, PLAN:1817 | "no custom" | PARTIAL | Keys get a bezier (row 16). The draw-in's own ease and each stroke's ease are still four presets: dtc:557 says "Ease is the four presets for now", and the `bezier` kind at `lib/stroke-timing.ts:66` has no writer. The only write is a preset, dtc:643 |
| 13 | Hold, or stepped, keys | R2 N10 | doc | PRESENT | Control: lanes:278 Hold. Path: `lib/keyframes.ts:70` |
| 14 | Stagger as a curve over stroke index | R2 N11 | doc | MISSING | No stagger in `components/`, `lib/` or `app/`, apart from a register constant at `lib/registers.ts:97` |
| 15 | Reveal styles: authentic, smooth, presentation, snappy, slow gel | R#13, PLAN:1788-1793 | plan | PARTIAL | Presets at `lib/style-system.ts:4665-4727`. No "presentation" |
| 16 | A curve he shapes between two keys | RUL 3, DES Phase 3 | ruling: "a curve he shapes between the keys" | PRESENT | Control: `CurveEditor` lanes:784, drag handles lanes:328, x1 to y2 fields lanes:351-354. Path: `lib/keyframes.ts:228` |
| **C** | **Timeline** | | | | |
| 17 | Play, replay, scrub, speed | R#14, PLAN:1777 | PRD | PRESENT | Play vp:14399, scrub vp:8101, 0.5x/1x/2x vp:14483 |
| 18 | Drag each stroke's start and end | RUL 1, DES 1b | ruling | PRESENT | strip:497. Body, end and start at strip:370-379 |
| 19 | Duration control | R#17, PLAN:1778 | plan | PARTIAL | Only the speed buttons (vp:14483) and per-stroke speed. No field sets the take's length in seconds |
| 20 | Delay before it starts | R#18 | PRD | PRESENT | dtc:366 |
| 21 | Loop and reverse | R#19 | PRD | PRESENT | Reverse dtc:523, Loop dtc:536 |
| 22 | Restart behaviour | PLAN:1784 | plan | PRESENT | Third pass. Control: Play in the dock's transport row, `components/workspace/timeline-panel.tsx:119-123`, handed `handlePlayPause` at vp:14034. Path: Play at the end restarts from the start, vp:12232-12245, and under Reverse the start is 1, not 0. Loop dtc:759-768 wraps the clock and re-arms the delay each pass, vp:8333-8361; without Loop the pass ends, vp:8364, and the transport pauses, vp:11476. The plan file is not in the repo, so PLAN:1784's own words are still unread |
| 23 | Select a stroke, nudge it, reset it, ripple the rest | DES 1b | doc | PRESENT | Nudge strip:418, Reset dtc:674, Ripple strip:646 |
| **D** | **Per-stroke control** | | | | |
| 24 | Stroke order | R#21, PLAN:1786 | PRD | PRESENT | Menu dtc:124-137, and any stroke can be dragged to any time, strip:497. The byPosition-equals-default defect in R2 was not re-checked |
| 25 | Strokes at the same time, overlap, align | R#22 | doc | PRESENT | dtc:172 |
| 26 | Each stroke its own delay, speed and ease, and one held back to land last | RUL 1, R#11, R#23 | ruling: "any stroke can be held back to land last" | PRESENT | Block dtc:558, mounted dtc:99. Hold back strip:604-609. Row type `lib/stroke-timing.ts:69-86` |
| 27 | Unit: letter group or single stroke | R#24 | doc | PRESENT | dtc:62 `drawInUnitCount`. R2 puts the control at dtc:210; that line was not re-confirmed |
| 28 | Which way each unit draws | R#25 | doc | PRESENT | R2 puts it at dtc:242-245; not re-confirmed |
| 29 | Reveal window: grow, travel, vanish, shrink | R#26 | doc | PRESENT | Window length dtc:337 |
| 30 | Animate on ones or twos | R2 N15 | doc | PRESENT | dtc:480-512 |
| 31 | Reverse one stroke | R2 N12 | doc: "'Reverse this one stroke' is one boolean and it is missing." | MISSING | `StrokeTiming` (`lib/stroke-timing.ts:69-86`) has no reverse field, and the stroke block at dtc:558 has no control for it |
| 32 | Clamp the pauses between strokes | R2 N13 | doc | MISSING | Zero hits for any max-gap name |
| 33 | Order strokes by distance from a point he taps | R2 N14 | doc | MISSING | Zero hits |
| 34 | Each stroke pops solid at its pen-up; ink solid off the nib | R#27, R2 N22 | doc: "his idea #1: the ink is solid off the nib" | MISSING | Depth is one track for the whole mark, `lib/keyframes.ts:41`. No per-stroke depth anywhere traced |
| 35 | Letter by letter on `/`, a clean turn, no overlap | R#28, TR K | "the way they turn and then overlap into the next letter is so dog shit" | MISSING | `lib/hero-motion.ts:1938`, lab only |
| **E** | **Writing like a hand** | | | | |
| 36 | A draw-in that writes like a hand | R#29, TR D | "teh hwoel reason im usuing the free stroke ap was for its drawing anaimtion" | PARTIAL | Perform lets him write the pace himself (row 3). The default still plays the recorded pace, and the pen-model clock is lab only (row 8) |
| 37 | Order that follows how a hand writes the letter | R2 N2 | doc | PARTIAL | Third pass. The hand order exists, lab only: the single-stroke font lists each glyph's strokes in pen order, stem before bowl, `scripts/capture/letters.mjs:160-161`, laid out by `layoutWord` :1045, whose one caller is `app/desk-doodles/page.tsx:129` and :334. On `/` there is no traced or typed word, only his own strokes, and the Order menu (dtc:159-178) offers As drawn, Reversed, Short first, Left to right and Random (`ORDER_LABELS` `lib/stroke-schedule.ts:1528-1534`). Missing: the font on `/`, and an order that puts a stroke set into how a hand writes it |
| 38 | The pen lifts between strokes | R2 N3 | doc | PRESENT | Third pass. Control: Natural / Authentic in the transport, `components/workspace/timeline-panel.tsx:143-167`, and Clock, Recorded or Hand, dtc:583-610. Path: `/` passes `liftsLandBetweenStrokes` into `revealDistanceFraction` at vp:6359-6364, :6406 and :9596-9603, and Natural then holds still for each lift's full length (`lib/pen-reveal.ts:168-187`). Under Hand, `stampPenClock` times the lifts on `/`, `app/page.tsx:2659`. Strokes drawn on `/` are separate strokes, so the word is not one extrusion. Limit: the hold switches off under a reorder, overlap, Align end, Travel or Shrink, where it would freeze a stroke half drawn, `lib/pen-reveal.ts:207-216` |
| 39 | Lifts that vary like a hand, 90 to 600 ms | R2 N4 | doc | PARTIAL | `humanLiftsMs` (`lib/pen-reveal.ts:1692`) runs inside `stampPenClock` (:1740), whose only callers are `app/desk-doodles/page.tsx:175` and :380 |
| 40 | No stroke on screen for under 100 ms | R2 N5 | doc | MISSING | No floor constant found. The grep went by name only |
| 41 | A reveal that reads pen pressure | R#30, PLAN:1814 | plan | MISSING | Recorded at `components/drawing-canvas.tsx:333` and :352. vp:14730 says no engine reads it |
| 42 | Tip highlight | R#31, PLAN:1816 | plan | PARTIAL | The pen tip renders (vp:4135-4525). No tip control found in dtc |
| 43 | A taper-aware reveal | PLAN:1815 | plan | PARTIAL | Third pass. The moving end is taper-aware on Inflate: the frame loop reads `readPenTipShape` (default `reed`, nose 1, taper 1.6, `lib/pen-reveal.ts:1147`, :1195) and writes `uFsTipTaper`, vp:7084-7149, which the shader puts in the arrival test, vp:2791-2792. Missing: no control on `/` picks or tunes the tip; it is set only through the doc (`lib/doc-store.ts:949-954`) and the dev harness, vp:12051. And it runs only where an Inflate mesh carries reveal keys, the one place `revealFracNow` is set, vp:6357-6366 |
| 44 | Smoothing on a performed take | R2 N9 | doc | PRESENT | perform:256-259, `SMOOTH_MS_MAX` `lib/stroke-timing.ts:742` |
| 45 | Perform slowly | DES Phase 2 | doc | PRESENT | perform:262-265, `CAPTURE_SPEEDS` `lib/stroke-timing.ts:739` |
| 46 | Perform the whole word | DES Phase 2 | doc | PRESENT | perform:251, "All, in order" |
| 47 | Authored vs recorded timing, as a choice | R2 N1 | doc | PARTIAL | Authored rows sit over the recording, and Reset (dtc:674) hands one stroke back. No single switch for the whole take was found |
| **F** | **Camera and the object** | | | | |
| 48 | Camera moves that ease, each for a reason | R#12, R#34, TR G, RUL 5 | "TEH CAMERA ANGLES CHNAGE ARE ADRUPT AND DONT HAVE ANY EASING" | PRESENT | Four moves, each with a `reason`, `lib/camera-moves.ts:204-292`. Placed from lanes:391-420, played by `KeyCamera` vp:10474-10475 through `orbitView` vp:7918-7920 |
| 49 | Camera keys: orbit, tilt, distance | RUL 3 | ruling | PRESENT | lanes:93-95, vp:7918-7920 |
| 50 | Animate the object: depth and turn keys | R#36, RUL 3 | PRD north star | PRESENT | lanes:91-92, read at vp:6556 |
| 51 | Width keys | RUL 3, DES 3b | ruling | PRESENT | lanes:96. Rod vp:4270, the other engines vp:9172-9180, `lib/width-keys.ts` |
| 52 | Width per stroke | DES §3 | doc | PARTIAL | One width track for the whole mark, `lib/keyframes.ts:41` |
| 53 | Draw-progress keys per stroke | DES §3, RUL 3 | ruling: "Keys on draw progress" | PARTIAL | `drawProgress` is one track over the whole reveal, `lib/keyframes.ts:41`, :265 |
| 54 | Settle, wobble, secondary motion after the draw | R#32, PLAN:1818-1820 | plan | PARTIAL | He can key turn and depth on the whole mark by hand (row 50). No settle, wobble or secondary motion control, nothing per stroke, and `lib/style-system.ts:4656-4663` says the reveal can't express a settle |
| 55 | A completion pulse on the mark | R#33, PLAN:1821 | plan | MISSING | `lib/style-system.ts:4730-4736`, `implemented: false` |
| 56 | A 2D-to-3D change you can see | R#35, TR F | "HARD TO TELLL IT WENT FRO  2D TO 3D" | PARTIAL | Shading dtc:398, Turn dtc:436, and the Depth and Turn lanes. The flat-to-solid flip he asked to push further is in the lab films only |
| 57 | View presets: Portfolio Spin, Top-Down Mark | R#37 | PRD | PRESENT, needs his eye | Control: View / Export on the rail, scaffold:113 and :122-125. Portfolio Spin `lib/style-system.ts:1789` and Top-Down Mark :1820, both `implemented: true`. Path: `applyViewPresetById` `app/page.tsx:1413`, which refuses with a toast when `viewPresetBlockers` names a gap, then hands the framing to the viewport API. The comment row 57 first cited is out of date. `lib/style-system.ts:1866` says Top-Down Mark once came out the same shot as another preset |
| **G** | **Presets and custom** | | | | |
| 58 | Six draw-in presets | R#38 | PRD | PARTIAL | Five at `lib/style-system.ts:4665-4727`. Completion Pulse is not implemented, :4730-4736 |
| 59 | Custom under every preset | RUL 4, TR B | plan: "They should not hide broken systems or replace editable controls." | PARTIAL | Customize renders for dither, texture, ASCII, material, stack and fusion (scaffold:3269-3281). For geometry, Geometry Animation and view it renders nothing: `customizeControlsFor` returns an empty list (scaffold:3282), `presetFields` reads only `applies` (`lib/style-system.ts:5150`), and the draw-in presets carry `motion` instead, so `PresetCustomize` returns null at scaffold:3366 |
| 60 | Save his own motion | R#39, RUL 4 | ruling: "he can save his own" | MISSING | "Save as mine" (scaffold:3393) sits inside `PresetCustomize`, which never renders for a draw-in preset (row 59). The take and the keys have no save-as-preset path |
| 61 | Custom Geometry Animation | PLAN:2355, :2574, RUL 4 | plan | MISSING | Rows 59 and 60 |
| 62 | Custom Material Animation | PLAN:2356 | plan | PRESENT | scaffold:3272 to `MaterialControl`, Material Animation at scaffold:517, save scaffold:3425 |
| 63 | Custom Texture Animation | PLAN:2357 | plan | PRESENT | scaffold:3274, :841 |
| 64 | Custom Dither Animation | PLAN:2358 | plan | PRESENT | scaffold:3271, :1129 |
| 65 | Custom ASCII Animation | PLAN:2359 | plan | PRESENT | scaffold:3276, :1341 |
| 66 | Custom Stack Animation | PLAN:2361 | plan | PRESENT | scaffold:3278 maps Stack Animation to `LayersControl`, whose Stack Animation block is scaffold:1596-1830: switch, eight behaviours, speed, direction, phase and its preset pills. Path as row 78 |
| 67 | Custom Fusion and Custom Animated Fusion | PLAN, TR N | "FUSION DOESNT HAVE A WAY FR AUSER TO MAKE THEIRIR FUSINS" | PRESENT | scaffold:3279-3280, `CustomFusionEditor` scaffold:2204 |
| 68 | Stack animation presets | R#40 | PRD | PRESENT, needs his eye | Pills at scaffold:1826-1830 from `PRESET_REGISTRY.stackAnimation`, eight defs at `lib/style-system.ts:3606-3728`, family on the rail at :4818. Picking one starts the clock, :5105-5106 |
| 69 | Animated material, texture, dither and ASCII presets | R#41 | PRD | PRESENT, needs his eye | All four families are on the rail, `lib/style-system.ts:4810-4816`, joined at scaffold:122-125. Defs: material :1961-2068, dither :2318-2457, ASCII :2637-2729, texture :3024-3158. Material presets start the clock at :5095; the dither, ASCII and texture presets carry `motionMode: independent` themselves, e.g. :2343, :2644, :3032 |
| 70 | Animated fusion presets | R#42 | PRD | PRESENT, needs his eye | Animated Fusion is a rail family, `lib/style-system.ts:4820`, defs `ANIMATED_FUSION_PRESET_DEFS` :4410. Inside the Fusion panel the second row of pills became the Drive dial, Loop, Arc or Burst (scaffold:1870-1899), because five of the seven old pills moved less than their sibling. R2 says Signal Ink has gone plain (RQ:6866) |
| 71 | A preset browser | R#43, PLAN Phase 27 | plan | PARTIAL | The rail groups presets by the fifteen families Phase 27 lists, `lib/style-system.ts:4808-4826`, scaffold:122-125. No browser across families was found, and the plan's example presets were not checked by name |
| **H** | **Surface animation** | | | | |
| 72 | Animated material | R#44 | PRD | PRESENT, needs his eye | Control: Material Animation switch scaffold:497-517, which starts the clock itself at :512; type :528-549, speed :551, intensity :571. Path: vp:5961-5963 gates on Motion mode and the switch, then `evaluateMaterialAnimation` vp:6046-6052 writes `liveMaterial` (made at vp:4434) every frame |
| 73 | Animated texture | R#45 | PRD | PRESENT, needs his eye | Control: Texture Animation switch scaffold:825-841, speed :846, sync and delay :885. Path: vp:5673-5700, `resolveSyncMode`, then `evaluateLayerTime` (`lib/style-clock.ts:320`) into `uFsTexTime`, which `lib/texture-shader.ts` reads 16 times |
| 74 | Animated dither | R#46 | PRD | PRESENT, needs his eye | Control: Dither Animation switch scaffold:1114-1129, speed :1134, motion :1154, sync :1174. Path: vp:5738-5740 `evaluateLayerTime` into `uFsDitTime`, read in `lib/dither-shader.ts` |
| 75 | Animated ASCII | R#47 | PRD | PRESENT, needs his eye | Control: ASCII Animation switch scaffold:1324-1341, type :1346, speed :1369, sync :1413. Path: vp:5789-5823, `uFsAscAnim` :5814 and `uFsAscTime` :5821, read in `lib/ascii-shader.ts` |
| 76 | A timing system with sync modes | R#48 | PRD | PRESENT | Control: Motion mode, Off, Independent or Sync to Draw, scaffold:3025-3037, and a five-mode sync menu on each layer, `LayerTimingControl` scaffold:627-637. Path: `resolveSyncMode` `lib/style-clock.ts:463`, `evaluateLayerTime` :320, called at vp:5673, :5738 and :5789 |
| 77 | Each layer on its own clock | R#49 | PRD | PRESENT | Texture, dither and ASCII each render `LayerTimingControl` (scaffold:885, :1174, :1413) with their own sync mode and delay, and each is timed on its own arm at vp:5675, :5740 and :5795. Material has no sync menu; it follows Motion mode, vp:6000-6003 |
| 78 | The whole stack animating as a group | R#50, TR B | plan: "an After Effects precomp" | PRESENT, needs his eye | Control: Stack Animation switch scaffold:1598-1639, eight behaviours :1679-1700, speed :1713, phase :1790. Path: `evaluateStackAnimation` vp:5611-5632; its amount and offset ride every layer's clock, the texture clock inside vp:5673-5700 and ASCII at :5821-5823, and a freeze holds all three phases |
| 79 | Every fusion combination | R#51 | "right you get fusions up to 7 and for each yu get every possibel combo" | PRESENT, needs his eye | Control: `FusionCombinationPicker` scaffold:2432, sizes 2 to 7 at :2455 over every entry of `FUSION_COMBO_LIST`. Path: `handleSelectCombo` `app/page.tsx:1580-1589` merges `comboStylePatch` (`lib/style-fusion.ts:3799`) and `fusionWakePatch`, and spins the camera when the combo uses the view |
| 80 | A custom fusion that applies | R#52 | "i can make a new custom fusion but nhting actually apples" | PRESENT, needs his eye | Control: `CustomFusionEditor` scaffold:2204 writes `customFusions` (:2219-2223) and selects one as `fusionPreset: custom:<id>`, as the Duplicate button does at :2303. Path: `evaluateFusion` `lib/style-fusion.ts:1963` finds the custom fusion at :2046 and runs `applyCustomLinks` :2052, called from vp:5842. When a link needs a layer that is off, the editor shows a wake banner, `fusionWakePatch` scaffold:2226 |
| 81 | Slow Weather and Turntable animate | R#53 | "slow weather and turntabel dont aniamte" | PRESENT, needs his eye | Control: the fusion preset rail in `FusionControl` scaffold:2583. Both presets carry `FUSION_BASE`, which sets Motion mode to Independent (`lib/style-system.ts:3818`). Turntable writes `fusionPreset: viewTurn` (:4125) and moves only while the camera does; the spin is `FUSION_VIEW_SPIN_DEG` = 12 (`lib/style-fusion.ts:3741`), sent through `onSpin` scaffold:2083. That the pick itself starts the spin rests on a comment, `lib/style-system.ts:4116`. Slow Weather writes `fusionPreset: slowWeather` (:4148). Both reach `evaluateFusion` from vp:5842 |
| 82 | Fusion controls: chaos or readability, reveal influence, completion behaviour | R#54 | PRD | PARTIAL | No "chaos" anywhere in scaffold. The others were not traced |
| 83 | Surface and geometry moving together, the Phase 23 list | R#55, PLAN:1799-1808 | plan: "A user can choreograph the object and its surface together." | PARTIAL | Sync to Draw, scaffold:594. Shimmer riding the tip, dither freezing on pause and a fusion bloom at completion were not found |
| 84 | Motion Off stops everything | R2 N31 | doc | PRESENT | Control: Motion mode Off, scaffold:3035. Path: read once at vp:5568, reduced motion folded in. Stack vp:5612, texture, dither and ASCII through `resolveSyncMode`, which returns `animated: false` on Off (`lib/style-clock.ts:467`), material vp:5962, fusion `lib/style-fusion.ts:673`. The Material gap R2 N31 named is closed on main. It covers the style layers only; the draw-in and the camera keys do not ride it |
| 85 | Texture motion you can read under drift | R2 N33 | doc | MISSING | Texture travels along one axis he picks for every pattern, vp:5668-5670. Dither has a per-type travel axis, `ditherTravelDirection` `lib/style-fusion.ts:560`; texture has no counterpart. Grep by name only |
| 86 | No flash on start or replay | R2 N34 | doc | PRESENT, needs his eye | Control: Play, vp:14399. Path: a layout effect syncs the reveal to the playhead before the first paint when play starts from the end, vp:9330-9352 |
| 87 | Surface motion that shows, with more options | TR N, R2 note #44 | "a lot of teh aniamtions for etxures are hard ro notice are just dont do anythung need more options" | PARTIAL | More options: Texture Animation has one motion, travel along a direction, with speed and sync (fields at scaffold:823), where material, dither and ASCII each have a type menu (:528, :1154, :1346). Whether any of it shows is his eye |
| 88 | Turn systems on and off, reorder them, choose which animate | PLAN:283 | plan | PARTIAL | On and off and which ones animate are there: each system's own switch, and each Animation switch (scaffold:497, :825, :1114, :1324) gates vp:5674, :5792 and :5962. Reorder is a two-way pick, Dither then ASCII or ASCII then Dither, scaffold:1573-1580 into `uFsStackOrder` vp:5574. Texture and material cannot move, scaffold:1440 |
| 89 | Completion effects on surfaces: bloom, ASCII burst, dither flash on restart | PLAN:1822-1825 | plan | PARTIAL | Completion pulse is one of the five sync modes on texture, dither and ASCII (scaffold:636), the stack has a completion swell (:1697), material has Completion Flash (`lib/style-system.ts:2051`), and fusion has the Arc drive that arrives and settles (scaffold:1908). A dither flash on loop restart, PLAN:1824, was not found |
| **I** | **Export** | | | | |
| 90 | Video export | R#56, TR O | "ye sofc wire vidoe export" | PRESENT | Handler vp:13078 (webm, anim), `lib/export/frame-plan.ts`. The button that calls it was not re-located |
| 91 | Export carries the take and the keys | DES Phase 1a | doc | PRESENT | The export host's `seek` sets `clockRef` and `playheadRef` (the host passed to `exportAnimation`, vp:13391 onward). Keys: `makeKeyReader` samples off `playheadRef`, vp:11297 and :7815-7827. The take: the Rod reads `timedRef` forward from the clock, vp:6538. Nothing was run |
| 92 | Animated GLB | R#57, PLAN Export v5 | plan | MISSING | Zero `AnimationClip` hits |
| 93 | Texture, dither and ASCII baked into export | R#58 | PRD | PRESENT, needs his eye | Texture, dither, ASCII and material draw into the same canvas the export grabs each frame (`grabFrame` in the host, vp:13391 onward). `hasAnimatedStyleLayer` (vp:13210) makes the recorder refuse a host that cannot set the style clock, `lib/export/recorder.ts:112` |
| 94 | GIF export | R2 N37 | doc | MISSING | Zero hits |
| 95 | A scroll-driven embed | R2 N38 | doc | MISSING | No scroll or embed output in `lib/export/`; the formats are webm and APNG, `lib/export/index.ts:53`. Grep by name only |
| 96 | Transparent video | R2 N39 | doc | MISSING | vp:10921 says transparent means APNG only |
| 97 | Export runs as long as the drawing took | R2 N40 | doc | PRESENT | Control: Pen or Fixed timebase, vp:14901, fixed lengths at :14918. Path: `penDurationMs: exportMs` and `timebase` into `exportAnimation` (vp:13391 onward), then `planFrames` `lib/export/frame-plan.ts:265` |
| 98 | Style clock driven frame by frame on export | R2 N41 | doc | PRESENT | The shipped export clock law is `drive`, vp:13299. The host's `setSceneTimeMs` writes `STYLE_CLOCK_DRIVE.exactMs`, vp:13458, and the recorder calls it every frame, `lib/export/recorder.ts:165`. Wall time is a dev override only, `readDevLaw` vp:1439. Not run; RQ:6433 called it unmeasured |
| 99 | A hold on an empty frame at the end | R2 N25 | doc | MISSING | The planner takes `holdOnEmpty` (`lib/export/index.ts:89`, passed on at :136), but nothing passes it and no control sets it, as `lib/export/recorder.ts:124` says: "AND THAT CONTROL DOES NOT EXIST". The export holds 600 ms on whatever the reveal ends on and drops the hold when that is empty |
| 100 | Film length against the pauses the hand took | R2 N26 | doc | UNKNOWN | His call, R2 N26. What the code offers: Pen plays the hand's own pauses, Fixed stretches the take to a length he picks (vp:14901, :14918). No pause clamp in `lib/export/frame-plan.ts` |
| **J** | **Quality** | | | | |
| 101 | Smooth, no lag, no jag | R#59, TR J | "It looks like a jaggy fucking mess" | UNKNOWN | A screen property |
| 102 | No white spots in the strokes | TR J | "shit still has these artifacting things, these white spots" | UNKNOWN | A screen property |
| 103 | Every animation eyed, frame by frame | R#60 | "every animation, every frame" | UNKNOWN | A process |
| 104 | An iOS-style control panel | R#61, PLAN Layer H | plan: "It cannot be forgotten." | PARTIAL | Grouped family panels, the preset rail and sliders are there (`StylePanelScaffold` scaffold:3662, rail :122). The preset browser in the same Layer H list is row 71. Whether it reads as iOS-grade is his eye |
| 105 | Works in 2D and in 3D | R2 N35, TR L | "we ned it to work for 2d and 3d as well" | PRESENT, needs his eye | Third pass. Control: Shading, Lit object or Flat ink, dtc:421-438, through `handleFlattenChange` `app/page.tsx:690` and the `flatten` prop at :2517. Path: the frame loop reads `flatten.ink` every frame and lerps the material to one flat ink, vp:6641-6675. The reveal reads only the playhead and the schedule, never `flatten` (vp:6357-6366, :9596-9603), so the draw-in plays the same in flat ink and lit. 2D here is flat shading on the same mesh: the 2D canvas renderer `makeFlatRenderer` (`lib/flat-ink.ts:350`) still has no caller outside two comments in `lib/hero-motion.ts` |
| 106 | The 2D draw-in matches the 3D one | R2 N6 | doc | PRESENT, needs his eye | Third pass. On `/` the 2D draw-in and the 3D one are one reveal under two shadings (row 105): Flat ink changes the material at vp:6641-6675 and nothing in the reveal path. So they match by construction. The mismatch R2 N6 measured was in the separate 2D renderer, `makeFlatRenderer` `lib/flat-ink.ts:350`, which nothing calls; no fix for its `ink(d)` was found, and none is needed for `/` while it stays uncalled |
| **K** | **Hero and films** | | | | |
| 107 | The hero choreography, K1 to K7 | R2 N17, TR P | "complete average, complete garbage" | PARTIAL | Lab only. No hero shape reaches `/` (row 6) |
| 108 | Real key poses for the hero beat | R2 N18 | doc | MISSING | Third pass. The beat is still the twelve phases of `HERO_PHASES`, `lib/hero-motion.ts:328-341`, with no key-pose table by name beside them. The only piece of the beat on `/` is the Flip (dtc:447-480), which takes one phase's numbers, `emerge` or `returnTurn`, from `DEFAULT_HERO_MOTION`, vp:7939-7951. Grep by name only |
| 109 | The land shadow after the turn | R2 N19 | doc | MISSING | Zero hits for any land-shadow name in `lib/`, `components/`, `app/` or `scripts/`. R2 N19 had it computed and drawn by nothing; the computation is not found now either. Grep by name only |
| 110 | Which hero film ships | R2 N20 | doc | UNKNOWN | His decision |
| 111 | The drawing stands up, hinged at the baseline | R2 N23 | doc | PARTIAL | Lab only, and as a camera move: `standup` is an az/el/fill camera channel in the shipped program, `lib/hero-motion.ts:48`, :65, :97. The drawing itself does not hinge at the baseline, and nothing reaches `/` (row 6) |
| 112 | His fourth hero idea | R2 N24 | doc | UNKNOWN | May be lost |
| 113 | Motion constants copied out of the lab | R2 N27 | doc | PARTIAL | `toMotionMjsSource` (`lib/hero-motion.ts:4178`) is a copy-to-clipboard on the lab, `app/desk-doodles/page.tsx:2417`. The paste into `scripts/capture/motion.mjs:88` is by hand, "Replace this whole block", with no gate |
| 114 | A test that the change to 3D never morphs at a beat boundary | R2 N28 | doc | MISSING | No beat-boundary or continuity check found by name in `lib/`, `scripts/` or `app/`. Grep by name only |
| 115 | Page-to-page morph | R2 N29 | "whatevr happedn to teh page to page aniamtion the morphs tuff" | MISSING | No page morph or view transition found by name. R2 cites a ledger line saying the morph work was dropped; that is not his ruling |
| 116 | Drawing lines morphing into code | R2 N30 | "the liens in drswing become code" | MISSING | Zero hits. Nothing turns the drawing's lines into code |
| 117 | The original eased flip back | R2 N43, TR F | "the flip was basic but solid finduation" | PARTIAL | Lab only: `ddFlipEase` `lib/hero-motion.ts:2167`, cubic-bezier 0.45, 0, 0.2, 1, with the 87% breakdown at :1535 and :2375. Not on `/` (row 6) |
| 118 | Type a word and it draws itself | R2 N42 | doc | PARTIAL | Third pass. Lab: "Any text" and its input, `app/desk-doodles/page.tsx:2953-2958` (state :1490-1491), feed `layoutWord` at :334 (`scripts/capture/letters.mjs:1045`), and the word draws in. Missing on `/`: no text input, and `layoutWord` is imported nowhere but the lab. R2 N42 says whether `/` gets it is his call |
| 119 | One temperature dial, legibility against liveliness | R2 N44 | doc | MISSING | Zero hits for a temperature dial. The one "temperature" at `lib/style-system.ts:895` is a material colour note |
| 120 | Desk Doodles' spring landing and 40 to 60 ms stagger | R2 N45 | doc | MISSING | No 0.92-to-1 landing spring and no 40 to 60 ms stagger in the motion code. The 0.92 hits are a material and a fusion score. Grep by value only |
| 121 | The per-unit cascade and its 16-unit cap | R2 N16 | doc | PARTIAL | Third pass. The cap is `FS_LETTER_MAX = 16`, vp:2907: how many letters the per-letter pass can turn. The shader walks at most 16 slots and leaves any other letter at rest, vp:3080-3085, rod caps fold an index past it into the last slot, vp:4677-4682, and the frame loop writes at most 16, vp:6929. The cascade turns letters from `flatten.letters`, vp:6925-6989, but only when a `letterMap` is passed, and only the lab passes one, `app/desk-doodles/page.tsx:2650`; `/` passes none at `app/page.tsx:2517`, so the pass sits idle there. Missing: the cascade on `/` |
| 122 | A pen shadow one nib ahead of the ink | R2 N7 | doc | MISSING | Zero hits for a pen shadow or a mask one nib ahead. Grep by name only |
| 123 | Leading-edge fade split into thickness and opacity | R2 N8 | doc | PARTIAL | Third pass. The thickness half is there on Inflate: the tip's `taper` thins the edges behind the centre so the moving end comes to a point, vp:2791-2792, fed at vp:7149 (row 43). The opacity half is not: the tip is a hard cut with a coverage ramp about one pixel wide for antialiasing, vp:2810-2830, and no fade dial exists. No control on `/` for either half |
| 124 | The reveal survives when Inflate falls back to the loft | R2 N32 | doc | PRESENT, needs his eye | vp:9309-9317: `meshesCarryRevealKeys` flips when the built meshes carry no reveal table, which a loft fallback produces, and the next build goes through the draw-range path, `inflateRevealsByDrawRange` vp:9318 |

## What is still missing or partial, by how much he talked about it

1. **A draw-in that writes like a hand** (rows 36, 39, 40). Twelve or more times, and he called it the biggest blocker. Building it means calling the pen-model clock `stampPenClock` from the `/` schedule instead of only from the lab, which touches `lib/pen-reveal.ts`, `lib/stroke-schedule.ts` and the beat block in `components/viewport-3d.tsx`.
2. **Desk Doodles' animation, used directly** (row 8). About nine times, and "recreating will nevr fele right". The same wiring as item 1, plus a written list of what else comes over from `app/desk-doodles/page.tsx`.
3. **The animation panel** (rows 4, 5). Nine times. The keys need a home in the Animation tab as well as the dock, so both doors show the same tools; that touches `components/style-panel-scaffold.tsx` around :3504 and `components/stroke-strip.tsx`.
4. **A 2D-to-3D change you can see** (row 56). Eight times. The flip he liked lives in `lib/hero-motion.ts`; bringing it to `/` means a film pick that feeds the `flatten` path in `components/viewport-3d.tsx`.
5. **His named sequences, letter by letter, and 3D first** (rows 6, 35, 107). Four times for the toggles and twice about the letter turn, the second time furious. Same film pick as item 4, offered in `components/draw-in-timing-controls.tsx`, and the letter turn needs fixing before it ships, since he called it "dog shit".
6. **"No custom": save his own motion, Customize under the draw-in presets** (rows 59, 60, 61). His 09-25 message and ruling item 4. `presetFields` and `saveMinePreset` in `lib/style-system.ts` have to carry a preset's `motion`, take and keys, and `PresetCustomize` in the scaffold has to open the draw-in controls under a Geometry Animation preset.
7. **A curve on the draw-in and on each stroke** (row 12). Part of "no custom" and ruling item 3. Give the stroke block at dtc:558 a writer for the `bezier` ease, reusing `CurveEditor` from `components/key-lanes.tsx`.
8. **Keys per stroke, on draw progress and width** (rows 52, 53). Ruling item 3. Add a stroke index to the tracks in `lib/keyframes.ts` and one lane per stroke in `components/key-lanes.tsx`; width per stroke also needs per-stroke geometry in `lib/width-keys.ts`.
9. **Settle, wobble, completion pulse on the mark** (rows 54, 55, 58). From his pasted plan, twice over. Needs a transform per stroke after it lands, which `lib/style-system.ts:4656-4663` says the prefix reveal can't do today; the work is in `components/viewport-3d.tsx`.
10. **Tip highlight and a pressure-aware reveal** (rows 41, 42). His plan. The tip needs a control in dtc; pressure needs a reader in `lib/pen-reveal.ts`.
11. **Duration, the fifth reveal style, authored vs recorded** (rows 15, 19, 47). His plan's Phase 22. Small controls in dtc.
12. **Fusion chaos and the Phase 23 sync list** (rows 82, 83). His plan. Scaffold work in the fusion and animation controls.
13. **Per-stroke reverse, stagger curve, max gap, tap order** (rows 14, 31, 32, 33). Agent research, never his words. A `reverse` field on `StrokeTiming` in `lib/stroke-timing.ts` covers the first; the others are schedule work in `lib/stroke-schedule.ts`.
14. **GIF, transparent video, animated GLB** (rows 92, 94, 96). Docs asked, he never did. New encoders in `lib/export/`.

## Limits

- **Source-level PRESENT does not mean it works on screen.** PRESENT here means a control that renders and a code path that reads what it writes. Nothing was run, and none of the 32 has passed his eye.
- Code was traced from nine files: the strip, key lanes, Perform, the style panel, the viewport, and `lib/stroke-timing.ts`, `keyframes.ts`, `camera-moves.ts`, `width-keys.ts`, plus `draw-in-timing-controls.tsx` because both doors render it. Surface animation, export and the hero films were not followed, and that is why 58 rows are UNKNOWN.
- Rows 27 and 28 take their control line from REPO-2 without re-confirming it. Row 90's button was not re-located.
- MISSING rows 14, 32, 33, 40, 92 and 94 rest on greps by name. A feature under another name would not show up.
- The pasted plan was read at the animation headings only: lines 71 to 109, 283, 1158 to 1172, 1775 to 1830, 1950 to 1962, 2350 to 2364, 2412 to 2424 and 2848 to 2858. The second copy past line 2888 repeats the first and was skipped.
- The ask list is the four ledgers plus DESIGN.md. Anything those files missed, this file missed too.

## Second pass, the 58 UNKNOWN rows, 2026-09-26

Read-only lane on main at `95f724f87`. Nothing was run, no browser was opened, no code changed. Traced from `components/style-panel-scaffold.tsx`, the surface block of `components/viewport-3d.tsx` (:5563-6075), `lib/style-clock.ts`, `lib/style-fusion.ts`, `lib/export/`, `app/page.tsx` and `lib/hero-motion.ts`.

**Where the 58 went: 22 PRESENT, 8 PARTIAL, 10 MISSING, 0 CUT BY HIM, 18 still UNKNOWN.** 15 of the 22 PRESENT are about how something looks and say "needs his eye": the code path is there, the look is his to judge.

Surface animation was the biggest unknown, and most of it is wired. Material, texture, dither, ASCII, the stack as a group, the sync modes, Motion Off, custom fusions and every fusion combination each have a control and a reader in the frame loop. Export carries the take, the keys and the style clock frame by frame. What's left is the hero films, which still live only on the lab, and a handful of asks nobody built.

Of the 18 still UNKNOWN, six are his call or a way of working, not code (7, 10, 100, 103, 110, 112). Two are screen properties (101, 102). Ten were found in part and not traced to `/` (22, 37, 38, 43, 105, 106, 108, 118, 121, 123).

### Newly found missing or partial, by how much he talked about them

1. **Texture motion you can see, with more options** (row 87, PARTIAL). His words, TR N: "a lot of teh aniamtions for etxures are hard ro notice are just dont do anythung need more options." Texture Animation has one motion, travel, where material, dither and ASCII each get a type menu. Building it means a motion-type menu in `TextureControl` (`components/style-panel-scaffold.tsx`, near :846) and a matching switch in `lib/texture-shader.ts`, then his eye on each type.
2. **The original eased flip, on `/`** (row 117, PARTIAL). "the flip was basic but solid finduation", and it feeds row 56, which he raised eight times. `ddFlipEase` and its beat sit in `lib/hero-motion.ts:2167`; bringing them over is the same film pick as rows 6 and 56, feeding the `flatten` path in `components/viewport-3d.tsx`.
3. **Desk Doodles' landing spring and stagger** (row 120, MISSING). A doc ask, but it is the motion half of row 8, "recreating will nevr fele right", about nine times. The spring needs a transform per stroke after it lands, the same blocker as row 54, so the work is in the beat block of `components/viewport-3d.tsx`, with the stagger in `lib/stroke-schedule.ts`.
4. **Page-to-page morph** (row 115, MISSING). Once, 07-05: "whatevr happedn to teh page to page aniamtion the morphs tuff." He has to say which pages first. Then it is a route transition in `app/`, where nothing exists today.
5. **Drawing lines that turn into code** (row 116, MISSING). Once, 07-16. A new film with nothing to extend, beside the others in `lib/hero-motion.ts`.
6. **The drawing stands up, hinged at the baseline** (row 111, PARTIAL). A doc ask on the hero he called "complete garbage". Today `standup` is a camera channel. Hinging the mark means a rotation about the baseline in the film's flat state (`FlatState.pitch`, `lib/hero-motion.ts`).
7. **An iOS-style panel and a preset browser** (rows 104, 71, PARTIAL). His plan: "It cannot be forgotten." The rail already groups all fifteen families. A browser across them is new UI in `components/style-panel-scaffold.tsx`, reading `PRESET_REGISTRY`.
8. **Reorder every system** (row 88, PARTIAL). His plan, line 283. Only dither and ASCII swap. Texture and material hold fixed places in the shader order (scaffold:1440), so a full reorder is shader work in `lib/style-stack.ts` and the layer shaders, not only a menu.
9. **A dither flash on loop restart** (row 89, PARTIAL). His plan, line 1824. A loop-restart event in `lib/style-clock.ts` and a flash in `lib/dither-shader.ts`.
10. **A gate on the lab's motion constants** (row 113, PARTIAL). Doc. A check in `scripts/verify/` that compares `toMotionMjsSource()` output with the block in `scripts/capture/motion.mjs`.
11. **A travel axis per texture pattern** (row 85, MISSING). Doc. A `textureTravelDirection` beside `ditherTravelDirection` in `lib/style-fusion.ts:560`, read at vp:5668.
12. **A hold on an empty frame at the end** (row 99, MISSING). Doc, and an agent advised against it. The planner already takes `holdOnEmpty`, so building it is one toggle in the video export options near vp:14980.
13. **Scroll embed, land shadow, beat-boundary test, temperature dial, pen shadow** (rows 95, 109, 114, 119, 122, MISSING). Docs only, never his words. The land shadow and the beat-boundary test belong to the hero lab (`lib/hero-motion.ts`, `scripts/verify/`), the pen shadow to `lib/pen-reveal.ts`, the embed to `lib/export/`.

### Limits of the second pass

- PRESENT still means source level: a control that renders and a reader that uses what it writes. None of the 22 was run.
- `components/viewport-3d.tsx` has 16,072 lines. Only the surface block (:5563-6075), the export handler (:13247-13560), the export options (:14900-14995) and the lines cited were read.
- MISSING rows 85, 95, 109, 114, 116, 119, 120 and 122 rest on greps by name or value. A feature under another name would not show up.
- Rows 57 and 81 stop at the viewport API and at a comment: the camera side of the View presets, and Turntable spinning on pick, were not followed.
- Some vp ranges in rows 73 and 78 come from reads that skipped comment lines, so the end of a range can be a few lines off.

## Third pass, 2026-10-02

Read-only lane on `integrate/cloud-1001` (snapshot `2cc9e98`: main plus the dockview layout, keyframe anything, Hand Draw phase 3 and the carve fix). Nothing was run in a browser and no product code changed. The ten rows found in part and not traced to `/` (22, 37, 38, 43, 105, 106, 108, 118, 121, 123) were traced from the control that would show each: the transport in `components/workspace/timeline-panel.tsx`, `components/draw-in-timing-controls.tsx`, `components/dock-shell.tsx`, `components/style-panel-scaffold.tsx` and `lib/export/`. Line numbers in these ten rows are on this snapshot; the other rows still cite main at `95f724f87`, and their lines have moved.

**Where the 10 went: 4 PRESENT, 5 PARTIAL, 1 MISSING, 0 still UNKNOWN.** The 8 left UNKNOWN are the six that are his call or a way of working (7, 10, 100, 103, 110, 112) and the two screen properties (101, 102).

- **PRESENT (22, 38, 105, 106).** Restart is Play from the end plus Loop, and both reach the frame loop. The pen lifts hold on `/` under Natural and are timed by the Hand clock; Hand Draw phase 3 is why `stampPenClock` now has a caller on `/` (`app/page.tsx:2659`). 2D on `/` is Flat ink over the same mesh and the same reveal, so the draw-in plays in both, and the two match by construction. 105 and 106 need his eye.
- **PARTIAL (37, 43, 118, 121, 123).** Each has working code that stops short of `/` or of a control. The hand-ordered font and the typed word live on the lab only (37, 118). The letter cascade and its 16-letter cap are real, but `/` passes no letter map (121). The taper-aware tip runs on Inflate with no control to pick it (43), and its opacity half was never built (123).
- **MISSING (108).** No key-pose table; the beat is still twelve phases, and only the Flip's one turn reaches `/`.

### Corrections the third pass found in other rows

These rows were not regraded, because this pass was asked to change only the ten. They are noted so the next pass starts from them.

- Rows 8, 36 and 39 say `stampPenClock` and `humanLiftsMs` are lab only. On this snapshot `/` calls `stampPenClock` under Clock: Hand (dtc:583-610 to `app/page.tsx:2659`), and `humanLiftsMs` runs inside it.
- Rows 6 and 56 say the flat-to-solid flip and 3D first are lab only. The Form block now has a Flip row, Off, Flat to solid or 3D first (dtc:447-480), timed onto the take at vp:7939-7951.
- Rows 4 and 5 say there is no animation workspace and the keys live only in the dock. The dockview layout adds an Animate workspace on the left rail, key 3 (`components/workspace/workspaces.ts:36`), which opens the dock with its Timeline, Draw-in and Export panels (`components/workspace/workspaces.ts:101` and :133). Whether the 55% height cap row 4 names still applies was not checked.

### Limits of the third pass

- PRESENT is still source level. No browser was opened for these rows, so 105 and 106 rest on the reveal not reading `flatten`, not on a look at the screen.
- Row 108's MISSING rests on a grep by name for a key-pose table.
- Row 22 is graded on what the code does at the end of a pass. The plan file it cites is not in the repo, so his plan's own words for restart behaviour are still unread.

## Build list

One line for every MISSING or PARTIAL row, in table order: what building it takes, the files, and the branch it overlaps. **TAKEN** means one of the five branches being built elsewhere covers it (codex/export, codex/drawin, codex/schedule, codex/perstroke, codex/fusion). None of the five is on origin, so the match is by branch name and the area of the work, not by reading their diffs. **Open** means none of the five covers it. Two other branches on origin touch the same ground: `claude/drawin-extras-animation-asks-yj9zyt` has commits for a whole-draw duration, Presentation and an authored-or-recorded switch (rows 19, 15, 47), and `claude/export-formats-implementation-rs226x` works in `lib/export/`. File paths are on this snapshot.

- **4** (PARTIAL) Lift the dock's 55% height cap in the Animate workspace, or give the strip and the key lanes their own dockview panel there. `components/workspace/workspaces.ts`, `components/workspace/dock-hosts.tsx`, `components/dock-shell.tsx`. Open.
- **5** (PARTIAL) Render the key lanes in the drawer's Animation tab as well as the dock, and check the dock shows before the first stroke. `components/style-panel-scaffold.tsx`, `components/key-lanes.tsx`, `components/stroke-strip.tsx`. Open.
- **6** (MISSING) A sequence pick on `/` (2D then 3D, 3D first, letter flip after the draw) that feeds `solidFirst` and `letterByLetter` from `lib/hero-motion.ts` into the `flatten` path; the Flip row (dtc:447-480) is the start. `components/draw-in-timing-controls.tsx`, `components/viewport-3d.tsx`, `app/page.tsx`. Overlaps codex/drawin at the control; the film wiring is open.
- **8** (PARTIAL) Write down what else comes over from the lab beyond `stampPenClock`, which `/` now calls under Clock: Hand, and wire each piece. `app/desk-doodles/page.tsx`, `app/page.tsx`, `lib/pen-reveal.ts`. Open.
- **12** (PARTIAL) A writer for the `bezier` ease on the whole draw and on each stroke, reusing `CurveEditor`, overshoot allowed. `components/draw-in-timing-controls.tsx`, `components/key-lanes.tsx`, `lib/stroke-timing.ts`. **TAKEN: codex/drawin** (the per-stroke half also touches codex/perstroke).
- **14** (MISSING) A stagger curve over stroke index that offsets each slot's start. `lib/stroke-schedule.ts`, a control in `components/draw-in-timing-controls.tsx`. **TAKEN: codex/schedule**.
- **15** (PARTIAL) A Presentation reveal preset beside the five. `lib/style-system.ts` (the draw-in presets). **TAKEN: codex/drawin**.
- **19** (PARTIAL) A field that sets the take's length in seconds and scales the clock to it. `components/draw-in-timing-controls.tsx`, `app/page.tsx` (`revealEnvelope`). **TAKEN: codex/drawin**.
- **31** (MISSING) A `reverse` field on `StrokeTiming` and a toggle in the stroke block. `lib/stroke-timing.ts`, `components/draw-in-timing-controls.tsx`, `lib/stroke-schedule.ts`. **TAKEN: codex/perstroke**.
- **32** (MISSING) A max-gap clamp on the pauses between strokes. `lib/stroke-schedule.ts`, `lib/pen-reveal.ts` (the lift holds), a control in dtc. **TAKEN: codex/schedule**.
- **33** (MISSING) An order by distance from a tapped point, a sixth `StrokeOrder` plus a tap on the canvas. `lib/stroke-schedule.ts`, `components/draw-in-timing-controls.tsx`, `components/viewport-3d.tsx`. **TAKEN: codex/schedule**.
- **34** (MISSING) Depth per stroke, so each stroke goes solid at its own pen-up. A stroke index on the depth track in `lib/keyframes.ts`, read per stroke in `components/viewport-3d.tsx`. **TAKEN: codex/perstroke**.
- **35** (MISSING) Fix the letter turn and its overlap in `lib/hero-motion.ts`, then bring it to `/` with the letter map row 121 needs. `lib/hero-motion.ts`, `app/page.tsx`, `components/viewport-3d.tsx`. Open.
- **36** (PARTIAL) Check Clock: Hand against his eye and decide whether it becomes the default for new drawings. `lib/doc-store.ts` (the default envelope), `app/page.tsx`. Overlaps codex/drawin at the default; otherwise open.
- **37** (PARTIAL) Bring the font's authored pen order to `/`, or an order that reorders a stroke set by where a hand starts each letter. `scripts/capture/letters.mjs`, `lib/stroke-schedule.ts`. **TAKEN: codex/schedule** for the order; the font on `/` goes with row 118.
- **39** (PARTIAL) `humanLiftsMs` already runs on `/` under Clock: Hand. Left: a gate that the lifts land in 90 to 600 ms on `/`. `scripts/verify/`, `lib/pen-reveal.ts`. Open.
- **40** (MISSING) A 100 ms floor on any stroke's time on screen. `lib/stroke-schedule.ts` or `lib/stroke-timing.ts` (`placeSlots`). **TAKEN: codex/schedule**.
- **41** (MISSING) A reader for the recorded pressure in the reveal's pace or width. `lib/pen-reveal.ts`, `components/viewport-3d.tsx`. Open.
- **42** (PARTIAL) A tip highlight control and its uniform on the pen tip. `components/draw-in-timing-controls.tsx`, `components/viewport-3d.tsx` (`applyPenTip`). **TAKEN: codex/drawin**.
- **43** (PARTIAL) A tip-shape pick on `/` over `PEN_TIP_SHAPES`, and the tip on the engines past Inflate. `components/draw-in-timing-controls.tsx`, `app/page.tsx` (`penTip` is already doc state), `components/viewport-3d.tsx`. **TAKEN: codex/drawin** for the pick; the other engines are open.
- **47** (PARTIAL) One switch for the take: authored rows or the recording. `components/draw-in-timing-controls.tsx`, `lib/stroke-timing.ts`. **TAKEN: codex/drawin**.
- **52** (PARTIAL) A stroke index on the width track and per-stroke width in the geometry. `lib/keyframes.ts`, `lib/width-keys.ts`, `components/key-lanes.tsx`. **TAKEN: codex/perstroke**.
- **53** (PARTIAL) Draw-progress keys per stroke, one lane per stroke. `lib/keyframes.ts`, `components/key-lanes.tsx`, `lib/stroke-timing.ts`. **TAKEN: codex/perstroke**.
- **54** (PARTIAL) A transform per stroke after it lands (settle, wobble), which the prefix reveal can't carry today. `components/viewport-3d.tsx`, `lib/style-system.ts` (:4656-4663). **TAKEN: codex/perstroke**.
- **55** (MISSING) A completion pulse on the mark, then flip `implemented` on its preset. `components/viewport-3d.tsx`, `lib/style-system.ts` (:4730-4736). **TAKEN: codex/perstroke** for the transform; open for the preset.
- **56** (PARTIAL) The Flip now reaches `/` (dtc:447-480). Left: pushing the flat-to-solid change further, with his eye on it. `components/viewport-3d.tsx` (`flipOptsFor`), `lib/hero-motion.ts`. Overlaps codex/drawin at the control; open otherwise.
- **58** (PARTIAL) The sixth preset, Completion Pulse, once row 55 exists. `lib/style-system.ts`. **TAKEN: codex/drawin** (depends on codex/perstroke for row 55).
- **59** (PARTIAL) `presetFields` reads `motion` as well as `applies`, so `PresetCustomize` opens the draw-in controls under Geometry Animation and View presets. `lib/style-system.ts` (:5150), `components/style-panel-scaffold.tsx`. Open.
- **60** (MISSING) Save as mine for a draw-in preset that stores the envelope, the take and the keys. `lib/style-system.ts` (`saveMinePreset`), `components/style-panel-scaffold.tsx`, `lib/doc-store.ts`. Open.
- **61** (MISSING) Custom Geometry Animation, which is rows 59 and 60 together. Same files. Open.
- **71** (PARTIAL) A browser across all fifteen families reading `PRESET_REGISTRY`. `components/style-panel-scaffold.tsx`, `lib/style-system.ts`. Open.
- **82** (PARTIAL) A chaos or readability dial, and trace reveal influence and completion behaviour. `components/style-panel-scaffold.tsx` (`FusionControl`), `lib/style-fusion.ts`. **TAKEN: codex/fusion**.
- **83** (PARTIAL) The Phase 23 list: shimmer riding the tip, dither freezing on pause, a fusion bloom at completion. `lib/style-clock.ts`, `lib/style-fusion.ts`, `components/viewport-3d.tsx`. **TAKEN: codex/fusion** for the bloom; the tip shimmer and the pause freeze are open.
- **85** (MISSING) A travel axis per texture pattern, beside `ditherTravelDirection`. `lib/style-fusion.ts`, `components/viewport-3d.tsx`. Open.
- **87** (PARTIAL) A motion-type menu for Texture Animation and the shader switch behind it. `components/style-panel-scaffold.tsx` (`TextureControl`), `lib/texture-shader.ts`. Open.
- **88** (PARTIAL) A full reorder of the stack, texture and material included. `lib/style-stack.ts`, the layer shaders, `components/style-panel-scaffold.tsx`. Open.
- **89** (PARTIAL) A dither flash on loop restart. A loop-restart event in `lib/style-clock.ts`, the flash in `lib/dither-shader.ts`. Open (the fusion bloom half sits with row 83).
- **92** (MISSING) An animated GLB with `AnimationClip`s for the reveal and the keys. `lib/export/`, a GLB writer. **TAKEN: codex/export**.
- **94** (MISSING) A GIF encoder. `lib/export/encoders.ts`, `lib/export/index.ts`. **TAKEN: codex/export**.
- **95** (MISSING) A scroll-driven embed output. `lib/export/`. **TAKEN: codex/export**.
- **96** (MISSING) Transparent video, an alpha WebM path beside APNG. `lib/export/webm.ts`, `lib/export/recorder.ts`. **TAKEN: codex/export**.
- **99** (MISSING) A toggle that passes `holdOnEmpty`. `components/workspace/export-panel.tsx`, `lib/export/index.ts`. **TAKEN: codex/export**.
- **104** (PARTIAL) Polish of the grouped panels to the plan's Layer H, with row 71's browser. `components/style-panel-scaffold.tsx`, `components/dock-shell.tsx`. Open.
- **107** (PARTIAL) The hero choreography on `/` as a film pick, the same wiring as row 6. `lib/hero-motion.ts`, `components/viewport-3d.tsx`. Open.
- **108** (MISSING) A key-pose table for the hero beat that replaces the in-between phases. `lib/hero-motion.ts`. Open.
- **109** (MISSING) The land shadow after the turn, computed and drawn. `lib/hero-motion.ts`, `components/viewport-3d.tsx`. Open.
- **111** (PARTIAL) A rotation about the baseline in the film's flat state instead of a camera channel. `lib/hero-motion.ts` (`FlatState.pitch`), `lib/flat-ink.ts`. Open.
- **113** (PARTIAL) A gate comparing `toMotionMjsSource()` with the block in `scripts/capture/motion.mjs`. `scripts/verify/`. Open.
- **114** (MISSING) A gate that the change to 3D never morphs at a beat boundary. `scripts/verify/`, `lib/hero-motion.ts`. Open.
- **115** (MISSING) He names the pages first; then a route transition. `app/`. Open.
- **116** (MISSING) A new film where the drawing's lines become code. `lib/hero-motion.ts`. Open.
- **117** (PARTIAL) `ddFlipEase` on the `/` Flip, which today takes only `DEFAULT_HERO_MOTION`'s beat numbers. `components/viewport-3d.tsx` (`flipOptsFor`), `lib/hero-motion.ts`. Open.
- **118** (PARTIAL) His call first. Then a text input on `/` that lays the word out with `layoutWord` as strokes. `app/page.tsx`, `scripts/capture/letters.mjs`. Open.
- **119** (MISSING) One temperature dial that moves legibility against liveliness across the draw-in. `components/draw-in-timing-controls.tsx`, `lib/stroke-schedule.ts`. Open; it would sit on codex/drawin's controls.
- **120** (MISSING) The 0.92-to-1 landing spring (a transform per stroke) and a 40 to 60 ms stagger. `components/viewport-3d.tsx`, `lib/stroke-schedule.ts`. **TAKEN: codex/perstroke** (spring) and **codex/schedule** (stagger).
- **121** (PARTIAL) Pass a letter map from `/` (`assignLetters` is already imported in `app/page.tsx`) so the per-letter pass runs there. `app/page.tsx`, `components/viewport-3d.tsx`. Open.
- **122** (MISSING) A pen shadow one nib ahead of the ink. `lib/pen-reveal.ts`, `components/viewport-3d.tsx`. Open.
- **123** (PARTIAL) An opacity fade at the moving end beside the taper, with a dial. `components/viewport-3d.tsx` (`applyPenTip`), `lib/pen-reveal.ts`. **TAKEN: codex/drawin** if it carries the tip controls (rows 42, 43); open otherwise.

Of the 58: 27 TAKEN in full or in part, 31 open. Three of the open ones (6, 36, 56) touch codex/drawin only at a control.

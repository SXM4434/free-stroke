# Animation asks, second pass: what REPO.md missed, and where the code really is

Read-only lane, 2026-09-25, working tree at `c967dc76d`. Nothing was run, no browser was opened, and no code was changed. This file adds to `REPO.md`. It does not repeat it.

**45 new asks, and the combined count is 106.** 22 BUILT, 32 PARTIAL, 45 NOT BUILT, 7 UNKNOWN (sections 4 and 6). BUILT still means the code exists and a gate or measurement saw it move. None of the 95 has passed his eye.

**The code column in REPO.md had drifted on almost every line.** The draw-in controls moved out of `components/viewport-3d.tsx` into `components/draw-in-timing-controls.tsx` (short name **dtc**), and every `vp:13xxx` reference in REPO.md now points at unrelated debug text. Section 2 below has the corrected line for each ask.

## What this lane read, and what it did not

Read in full by this lane and its sub-lanes: `docs/RUN-QUEUE.md` 1 to 6869 (short name **RQ**), `SESSION-HANDOFF.md` 1 to 3415 (**SH**), `docs/hero-beat-storyboard.md` 1 to 3846 (**HBS**), `docs/hero-animation-options-board.md` 1 to 681 (**board**), complaint parts 1, 2, 3, 5, 6 and 6b, and these research docs: `stroke-animation-toolsets` (**toolsets**), `write-on-timing` (**wot**), `storyboarding`, `reference-film-mechanics`, `online-reference-mechanics`, `reveal-cost-and-timeline-ownership`, `timing-and-stack-phases`, `hero-2d-to-3d-transition`, `stroke-width-models`, `rock-3d`, `undo-redo-conventions` and `extrude-solid-quality`.

Three more sub-lanes finished after sections 1 to 5 were written. Their files are `HANDOFF-2026-08-02.md`, `HANDOFF-TO-FAE.md`, `MORNING-BRIEF.md`, all 10 files in `docs/rulings/`, `docs/2d-register-board.md`, `docs/animation-port-audit.md`, and the 14 research docs that remained. Every line of them was read. What they found is in **section 6** at the bottom, and the count there replaces the one in section 4.

**Not reached:** the two hero-direction outlines he pasted on 07-12 and 07-13. `docs/complaints/part-1.md:5` says the ledger skipped them, and nobody has read them since. `docs/animation-toolset-map.md` §5, which `animation-port-audit.md:307` cites as the place the curve editor was killed, was not reopened here.

Asks from his other projects (Frankendoodle rig, portfolio tape, Elara tabs), which turned up in part-1 and part-2, are left out.

Each code check in this file is a grep over `components/`, `lib/` and `app/` run by this lane. Positive control: `REVEAL_EASES` is found at `dtc:44` and in vp, so the sweep can see the draw-in code. The grep was `/usr/bin/grep -RS`, which follows symlinks.

---

## 1 · New asks, not in REPO.md

Numbered N1 to N34 so they don't collide with REPO.md's 1 to 61.

### Draw-in that writes like a hand

| # | ask | words | source, date | status, from the record and the code |
|---|---|---|---|---|
| N1 | Authored vs recorded timing, as a choice | DOC "timeline · authored vs recorded timing · product route or lab · iOS pass \| HIS" | RQ:397, 08-28 | NOT BUILT. Parked as his pick, then dropped off the final "His picks, still his" list at RQ:2245 |
| N2 | Stroke order that follows how a hand writes the letter, not trace order | DOC "6 of 21 strokes put the pen down LEFT of the previous stroke's pen-down" · "The trace is a trace, not a recording." | RQ:935 (F30), RQ:314-317, wot:677-680 "needs Sebs and a stylus", 08-28 | NOT BUILT. By 09-24 the hero word was retraced with "one authored table of where a hand starts each letter" (RQ:6237), but only for the hero word, and the schedule still overlaps (RQ:6253) |
| N3 | The draw-in lifts the pen between strokes | DOC "it cannot lift the pen, so a word becomes one continuous extrusion, and its order is contour order, not ductus" | RQ:975-978, 08-28 | NOT BUILT. No fix in the record |
| N4 | Pen lifts that vary like a hand: 90-150 ms within a letter, 150-300 between letters, 300-600 between words | DOC "replace the 60 ms constant with a three-tier lift band" | RQ:934 (F29), RQ:982-985, wot:671-676, 08-28 | PARTIAL. `LIFT_BANDS_MS` and `humanLiftsMs` exist at `lib/pen-reveal.ts:1601-1633`, but **nothing outside that file calls `humanLiftsMs`**. RQ:6438-6440 says the viewport patch was "NOT applied on the main tree", and the grep agrees |
| N5 | No stroke shorter than 100 ms on screen, so the pen moves at a human speed | DOC "the literature's floor for a real hand movement: 100 ms" | SH:168-170, RQ:936 (F31), HBS:3082-3091, 07-31 to 08-28 | NOT BUILT. Still "66.9 ms at 3.60× compression against a 100 ms floor". SH:251 "left FAILING deliberately" |
| N6 | The 2D draw-in matches the 3D draw-in | DOC F38 "CAUSE FOUND, and the tolerance was not touched" | RQ:2434-2452, 08-28 | PARTIAL. The cause (`ink(d)` not monotone) is named. No fix recorded |
| N7 | A pen shadow or soft mask one nib ahead of the ink, so the lifts have something carrying them | DOC "This is my call, not a finding… stays open for Sebs." | wot:557-563, :689-692, 08-28 | NOT BUILT |
| N8 | Leading-edge fade split into thickness and opacity | DOC | toolsets:124-128, undated | PARTIAL. The nib is built (toolsets:125-127) |
| N9 | A smoothing dial on a performed take | DOC "It would need renaming, not building" | toolsets:309-315, undated | PARTIAL. `hybridBlend` exists and has no dial named for this |

### Keyframes, curves, per-stroke control

| # | ask | words | source, date | status |
|---|---|---|---|---|
| N10 | Hold, or stepped, interpolation | DOC "Free Stroke's `easeReveal` has four curves and no hold" | toolsets:370-372 | NOT BUILT. `REVEAL_EASES` at dtc:44-48 is four monotone curves |
| N11 | Stagger as a curve over stroke index | DOC "'delay per stroke' stops being a number and becomes a shape" | toolsets:247-253 | NOT BUILT. No stagger in `lib/stroke-schedule.ts` |
| N12 | Reverse one stroke's direction | DOC "'Reverse this one stroke' is one boolean and it is missing." | toolsets:217-219 | NOT BUILT. `ReverseMode` is off, all or alternate (dtc:245) |
| N13 | Clamp the replayed pauses between strokes (a maximum gap) | DOC "Clamping it is required, not optional… does not clamp it or expose it" | toolsets:116-120 | NOT BUILT. Zero hits for any max-gap name |
| N14 | Order strokes by distance from a point he taps | DOC "a genuinely playful control that costs a sort" | toolsets:121-123 | NOT BUILT. `ORDER_LABELS` has five entries, `lib/stroke-schedule.ts:1399-1405` |
| N15 | Animate on ones or twos | DOC "Ease with Cadence twos" | RQ:6317, :6665, SH:201-205, 07-31 to 09-25 | BUILT. Cadence at dtc:480-504. RQ:6665 says the filmed pictures were never opened |
| N16 | The per-unit cascade and its 16-unit cap | DOC "Still open and still HIS" | RQ:3647, 09-04 | UNKNOWN. The record doesn't say what it does |

### The hero beat, the films, the look of the change to 3D

| # | ask | words | source, date | status |
|---|---|---|---|---|
| N17 | The hero choreography: anticipation squash, edge-on turn, hold, rise with overshoot, ¾ hold, return turn | DOC K1 to K7 | HBS:326-570, SH:23-25, 07-30 to 08-01 | BUILT on `/desk-doodles` only (HBS:2007-2963). **He rejected it:** *"The beat anime hero beat animations are still complete average, complete garbage."* (part-6b:30, 09-24) |
| N18 | Real key poses for the hero beat | DOC "Nine of the twelve are in-betweens holding a phase name" | RQ:4559-4582, 09-05 | PARTIAL. "24.4% of the beat (30 of 123 samples) changes strictly 0 pixels" (RQ:4567) |
| N19 | The land shadow, the secondary action after the turn | DOC "computed, correctly timed, and drawn by nothing" | RQ:4470-4500, 09-05 | NOT BUILT. The page says "Not on screen yet" (RQ:4482) |
| N20 | A decision on which hero film ships | DOC "which film ships (four, not seven)" | RQ:3441, :3646, 08-28 and 09-04 | NOT BUILT. Still on his pick list |
| N21 | 3D first, a film that opens solid and ends on flat ink | DOC "his idea #2: the object confesses it is a doodle", "he asked for 3D-first" | board:390, :425, ~08-01 | NOT BUILT. RQ:429-430 cut `solidFirst` without him |
| N22 | Ink that is solid off the nib, so the draw and the 3D change are one pass | DOC "his idea #1: the ink is solid off the nib", "he asked for it" | board:342-386, ~08-01 | NOT BUILT. The per-stroke pop is REPO #27. The "wake" front 400-450 ms behind the pen is new |
| N23 | The drawing stands up off the page, hinged at the baseline | DOC "VIDEO-DIRECTION §2.4" | board:294-338, HBS:486-488 | PARTIAL. The rise is built on the lab (HBS:2053-2066). board:146 cut standup as a camera move |
| N24 | His fourth hero idea | DOC "his four boarded properly, plus four of ours" | board:4, ~08-01 | UNKNOWN. Only three are labelled his. **The fourth may be lost** |
| N25 | A hold on an empty frame at the end of an export | DOC `holdOnEmpty` pill | RQ:393, :661 (F18), :3442 | NOT BUILT. An agent recommended against it (section 3) |
| N26 | Film length vs the pauses the hand took | DOC "should an exported film spend 90 % of its length on a pause the hand took?" | RQ:662 (F19), 08-28 | NOT BUILT, marked his |
| N27 | Copy motion constants out of the lab page | DOC `toMotionMjsSource` | RQ:3219, :3241, 08-28 | BUILT. 7 of 7. HBS:3661 says the paste into the film is still manual with no gate |
| N28 | A test that the change to 3D never morphs at a beat boundary | DOC "the single highest-value item in this document" | rock-3d:1273-1307 | NOT BUILT. "nothing checks continuity at a beat boundary" (:1291) |
| N29 | Page-to-page morph animation | HIS "whatevr happedn to teh page to page aniamtion the morphs tuff" | part-1:172, 07-05 | UNKNOWN. The ledger says "morph work dropped" |
| N30 | Drawing lines morphing into code | HIS "it could been teh en draiwng and then does coool morph thing whre the liens in drswing become code" | part-1:278, 07-16 | UNKNOWN |

### Surface motion and playback

| # | ask | words | source, date | status |
|---|---|---|---|---|
| N31 | Motion Off actually stops everything | DOC "Motion Off does not stop Material" | RQ:6311-6312, :6422-6433, 09-25 | PARTIAL. The preset wake is committed (`baabfc6ff`). The viewport patch is not committed (RQ:6431) |
| N32 | The reveal survives when Inflate falls back to the loft | DOC "the draw-in would show the finished word at once" | SH:459-462 | NOT BUILT. "Named in the code" |
| N33 | Texture motion you can read under group drift, on every pattern | DOC "a per-pattern natural travel axis would fix it" | SH:3012-3014 | NOT BUILT |
| N34 | No flash of the full mesh on start or replay | DOC "Start/reset flash is eliminated" | SH:954 | BUILT |

### New dates, new words and new facts for REPO.md's asks

- **#1, #3, keyframes.** SH:1649-1651, before 07-31: *"No timeline, no keyframes, no advanced stroke-animation controls."* SH:772: *"No advanced animation editing yet."* The scope was set without keyframes from the first branch. His 09-24 words (part-6b:39): *"Like, I see a keyframe and that's it. I don't see any of the animation settings whatsoever."* And part-6b:63: *"which you said we had so I don't know what the fuck happened"*.
- **#7, #52, "no custom".** SH:1762-1767: `futureCustomAnimationReserved`, *"Only Custom Material is implemented this branch."* Custom animation, texture, dither, ASCII and fusion were reserved flags and never built. This is the record behind "no custom". Custom fusion was his ask by 08-01: *"FUSION DOESNT HAVE A WAY FR AUSER TO MAKE THEIRIR FUSINS"* (part-1:130).
- **#4, #5, panel.** Since `9bfdaf90a` (09-25 03:24) the Animation tab renders the draw-in controls (`components/style-panel-scaffold.tsx:2868`), with nothing drawn too (RQ:6783). Not eyed, and the Timing popover is clipped at the drawer edge (RQ:6803-6805). His words (part-5:33, part-6:38): *"oh wait u never built our the full animation part of the app did u"*. Part-5 dates it before 09-04 and part-6 dates it 09-22.
- **#8, Desk Doodles port.** HIS: *"so what baout te ypart whre i looked at the dek doodles rto see what can be sueful for the catula app wiat so it wasnt in the app causi nevr saw naythigf"* (part-5:63, part-1:223, 08-29). And: *"DO NOT RECREATE WHEN WE HAVE THE CODE."* (hero-2d-to-3d-transition:22-24). The hero now opens on the Desk Doodles engine: "CHANGED, filmed, GATES NOT RUN" (RQ:6493).
- **#10, curves.** The lab's Overshoot dial is *"a 0/not-0 SWITCH sold as a 0–4 coefficient"* (HBS:3453-3463, SH:53). No fix recorded.
- **#12, #34, camera.** Earliest words, 07-31 (part-1:96-97): *"i also dont full geth janky can angels once it turn 3d"*, *"what the point of these cameer angels we get randomly"*. The lab's camera seams were fixed, `assert-hero-camera` 9/9 (HBS:3109). The default beat still loads `camera: "prior"`, *"the one carrying the unmotivated camera moves he ruled against"* (RQ:438-449). **#12 moves to PARTIAL. #34 stays NOT BUILT.**
- **#16, draggable timeline.** Dragging a clip edge retimes the hero on `/desk-doodles`. After F49, 8 of 12 clips move (RQ:2421-2427). Dragging a clip body snaps back, since an agent fixed the phase order (HBS:1441-1450). At 1280x720 the dock leaves the 3D stage 121 px tall (RQ:4990-5013).
- **#21, order.** `byPosition` gives the same result as the default on both trees (RQ:6408-6409). Not fixed.
- **#24.** HIS, 09-24 (part-6b:32): *"this thing where you have when each group draws and stuff, like I'm playing that and bro this is like, this is like absolute fucking garbage"*.
- **#28, letter by letter.** He named three versions: 2D first, 3D first, and both (board:469-488). An agent redefined his "both" as a single lie-down beat (board:483-488).
- **#29, the draw-in.** More words from him: *"th fucking drawig is fast aand janky"* (part-1:145, HBS:2210, 08-01), *"if swicth engine to desk dddoles teh word just auto appears"* (part-1:144, 07-31), *"the desk doodles like its all kind of crappy and the way it writes in is ass still."* (RQ:191-193, 08-28), and *"what was all this research we did"* (HBS:3057, 07-31). F118: "every lift showed 0.0 ms of screen hold at all 11 boundaries" (RQ:6395).
- **#33, pulse.** "Completion Pulse, build or cut" is still his (RQ:3646). F86, the one-frame pop at the end of the dither pulse: "E3 shipped NO fix" (RQ:3739).
- **#38, presets.** Graded "8 to 28 of 100" (RQ:6669). Snappy Draw "Reads as a stall on one stroke". Slow Gel has "3.4 s of near-blank page" (RQ:6643-6644).
- **#44, #45, texture and material.** HIS, before 07-31 (SH:2507-2509): *"a lot of the animations for textures are hard to notice or just don't do anything · need more options · a lot of the options are just weak · texture and material are the easiest to make and they suck"*.
- **#51.** HIS (part-6:62, 09-22): *"right you get fusions up to 7 and for each yu get every possibel combo"*.
- **#59, lag.** *"ITS ALSO LAGGY AT MARTS"* is dated 08-01 14:55 (part-1:99). *"smeared all over the place"* (part-6b:24, :55, 09-24). A looping play leaked about 88 MB a minute; that is down to 2.3 in dev, and "The per-frame full-tree re-render during play is the root... Not touched" (RQ:6383-6391). A play with loop off stops at 0.988, not 1 (RQ:6330).
- **#60, checks.** HIS (part-5:26): *"also u betetr makse sur ethat animtion is peefe af every time u say it i play ist a crpa"*. RQ:5975-5979, 09-24: *"I'm going to assume everything's crap."* RQ:6309-6311: 112 controls, 0 eyed, 11 alive but drawing nothing.

---

## 2 · The code column, re-checked on 2026-09-25

Every line below was grepped by this lane. When REPO.md's reference no longer holds, the old one is struck through in words ("was").

| REPO # | where it is now | note |
|---|---|---|
| 1 | `keyframe` appears only in `lib/export/encoders.ts:138-183` and `lib/export/webm.ts:39-278` (video codec), a comment at vp:6062, and the ruling comments at `lib/stroke-schedule.ts:91-102` and `:232-242` | the ruling comment was cited as :224-234 |
| 4, 5, 6 | Timing button vp:13244, popover vp:13263, controls vp:13293. The Animation tab renders the same controls at `style-panel-scaffold.tsx:2868`, inside `AnimationControl` at :2837 | vp:13061 and :13080 now hold debug text. **The Animation tab is new since REPO.md** |
| 8 | `app/page.tsx:2406` now passes `flatten`. It still passes no `letterMap` and no `revealRef`. `lib/hero-motion.ts` is imported by the lab, vp, `lib/stroke-schedule.ts` and `lib/flat-ink.ts` | REPO said page.tsx passes no `flatten` |
| 9 | `REVEAL_EASES` dtc:44-48, the control dtc:445-461, `easeReveal` vp:7215, `unEaseReveal` vp:7239 | was vp:7161 and :13465 |
| 13 | Natural vp:13157, Authentic vp:13169, both in the transport bar. Smooth is debug only, vp:13332 | was vp:12974 and :12986 |
| 14 | Play vp:13131, scrubber vp:13150, speed 0.5x/1x/2x vp:13217 | was vp:12938, :12961, :13034 |
| 15, 20 | `LiveTakeTimeline` vp:13116. `components/take-timeline.tsx:13` says "IT IS A VIEW. IT IS NOT THE AUTHORING MODEL" | was vp:12923 |
| 16 | `DialTimeline` from the `dialkit` package, `app/desk-doodles/page.tsx:32`, `:1347`, `:4143` | REPO had no file |
| 18 | dtc:345-365 | was vp:13370 |
| 19 | Reverse dtc:512-521, Loop dtc:525-534 | was vp:13529 and :13542 |
| 21 | Order dtc:112, `ORDER_LABELS` `lib/stroke-schedule.ts:1399-1405` | was vp:13132 and `:1387` |
| 22 | Overlap dtc:147-173, Align dtc:180 | was vp:13176 and :13200 |
| 24 | Unit dtc:210 | was vp:13230 |
| 25 | Direction dtc:242-245 | was vp:13262 |
| 26 | Window dtc:278-307, Length dtc:314-341, `RevealWindowMode` `lib/stroke-schedule.ts:275` | was vp:13306 and :13344 |
| 27 | `lib/hero-motion.ts:155-157` | holds |
| 29 | `lib/pen-reveal.ts`, `lib/stroke-schedule.ts`. The lift bands at `lib/pen-reveal.ts:1601` have no caller | see N4 |
| 30 | pressure recorded at `components/drawing-canvas.tsx:333` and `:352`. "no reveal or geometry path reads it" is at `lib/pen-reveal.ts:1207` | was `:324` and `:1039` |
| 35 | Shading dtc:389, Turn dtc:416 | was vp:13409 and :13440 |
| 37 | Portfolio Spin `lib/style-system.ts:1782`, Top-Down Mark `:1813`, both `implemented: true` | **UNKNOWN becomes BUILT**, not eyed |
| 38 | draw-in presets `lib/style-system.ts:4659-4724`. Completion Pulse at :4723 is `implemented: false` | was :4648 |
| 40 | `STACK_ANIMATION_PRESET_DEFS` `lib/style-system.ts:3606` | holds |
| 42 | `ANIMATED_FUSION_PRESET_DEFS` `lib/style-system.ts:4410`, "Terminal Gel Reveal Build" :4415 | was :4402. **UNKNOWN becomes PARTIAL**: they exist, and Signal Ink "has gone plain" (RQ:6866) |
| 43 | no hit for any preset-browser name | stays UNKNOWN. The grep went by name only |
| 44 | Material Animation scaffold:498, Motion mode scaffold:2875-2885 | was :471-560 |
| 45 | Texture Animation scaffold:800, its timing :839 | holds near :779-831 |
| 46 | Dither Animation scaffold:1060, timing :1100 | holds near :1040-1092 |
| 47 | ASCII Animation scaffold:1252, timing :1317 | holds near :1230-1309 |
| 48 | `lib/style-clock.ts:36` | holds |
| 49 | `LayerTimingControl` scaffold:580 | was :571 |
| 50 | Stack Animation scaffold:1528, modes :1578-1585 | holds near :1335 |
| 51 | `FusionCombinationPicker` scaffold:2305 | was :2296 |
| 52 | `CustomFusionEditor` scaffold:2077 | was :2068 |
| 54 | Drive scaffold:2693, Link :2721, Swing :2742, Speed :2762 | was :2683-2752 |
| 55 | Sync to Draw scaffold:2885 | was :2839 |
| 56 | export entry vp:11866, format pick vp:12187, filename vp:12308, `lib/export/frame-plan.ts` | was vp:13733-13814 |
| 57 | zero hits for `AnimationClip` in `lib/`, `components/`, `app/` | NOT BUILT, now checked |
| 58 | nothing bakes animated surfaces. SH:1645-1646 "animated material export/baking is out of scope" | **UNKNOWN becomes NOT BUILT** |

Not re-checked, because REPO.md gives no code line for them: 2, 3, 7, 10, 11, 12, 17, 23, 28, 31, 32, 33, 34, 36, 39, 53, 59, 60, 61. For 10, 11, 23 and 39 the greps in N10 to N14 found no per-stroke ease, delay or speed, no curve editor and no motion save.

---

## 3 · Where an agent, not him, ruled a feature out

None of these has a line in the record where he agreed.

**Keyframes, curves and the tool itself**
- `docs/research/stroke-animation-toolsets.md:643-654`, the "Refuse" list. Graph editor: *"the loudest 'professional animation tool' signal available on a product whose pitch is that it is not one"*. Node graph, state machine, and frames are refused too. `:362-363` says Rive's model is *"mostly a 'no'"*.
- `lib/stroke-schedule.ts:91-102` and `:232-242`, in the code: *"No keyframes, no dock, no tracks UI"*, because *"independently keyframed edges would be two clocks."* The thinking log at 09-05:2217 closed keyframes on this comment (REPO.md).
- `SESSION-HANDOFF.md:1649-1651`: *"No timeline, no keyframes, no advanced stroke-animation controls."* Branch scope, with no ruling from him.
- `SESSION-HANDOFF.md:1764-1767`: custom texture, dither, ASCII, animation and fusion left *"reserved-but-unimplemented"*.

**Easing, the ask he made first**
- `docs/RUN-QUEUE.md:986`: *"Do not add easing to the draw-in"*.
- `docs/research/write-on-timing.md:17-18`, `:706-709`: *"Anyone about to 'add easing to the draw-in' is about to make it worse."*

**The draw-in and its pace**
- `SESSION-HANDOFF.md:204-205`, `HBS:1577-1585`: the draw-in on twos, *"not taken here"*. Cadence was built later (N15).
- `HBS:1520-1528`: the full human-speed draw, *"4.666 s is the defensible value, and 6.971 s is not"*. The pen stays 3.6 times faster than a hand.
- `RQ:1382-1397`: the lift band and the 100 ms floor, *"JOB 4 NOT ATTEMPTED... Both are his."* Never put to him.
- `RQ:1311-1312`: giving the dropped stubs' time to other strokes, *"considered and rejected"*.
- `RQ:6478-6481`: decided that what he praised on 08-01 *"was the moving end..., not the timing"*, so a longer beat *"would move us AWAY from it."* No code changed.
- `wot:726-728`: wet-ink settle, *"an invention, and it should be argued for as one"*. `RQ:964`: *"a wet-ink settle beat has no support here."*
- `wot:710-720`: a curvature-to-speed term, per-stroke jitter and random lifts. `wot:416-417`: *"This strand is done and the build lane should leave it alone."*
- `stroke-width-models.md:1328-1341`, `:1368-1371`: velocity-driven width and a per-stroke nib angle called *"dead ends"*.
- `RQ:1275-1276`: the hand *"is not yet a calligraphic hand either, and it should not be."*

**Camera and the hero**
- `board:178-182`: *"Cut with them, permanently: any el/az transit during the beat"*, because *"It communicates nothing and spends stillness doing it."* He asked for camera moves that make sense, with easing. He never said no camera motion at all.
- `board:144-148`: the `solid` hold, the `tilt` dive, `standup` as a camera move and `descend` all cut.
- `board:586-600`: the weak bucket, *"recorded so nobody rebuilds one by accident"*. It kills an orbit, a push-in, a morph in place, an all-letters flip, ink boil and Ken-Burns drift.
- `HBS:1223-1226`, `:1192`, `reference-film-mechanics.md:93-125`: Ken-Burns drift deleted, overriding VIDEO-DIRECTION §1.
- `RQ:429-430`: the `solidFirst` and `cutaway` films ruled OUT. `RQ:414` says *"applying them is not deciding for him"*. N21 was his idea.
- `RQ:449-452`: the default camera left on the moves he ruled against, *"deliberately"*.
- `board:483-488`: his "both" letter-by-letter version redefined.
- `rock-3d.md:977`: the rotatable stage called *"a strict downgrade"*.
- `rock-3d.md:845-847`, `:1213-1214`: any crossfade or fade reveal banned, carried over from Rock-3D's own contract.
- `RQ:4584-4590`: the dead `orbit` hold ruled *"Deliberate, correct"*.
- `RQ:6260-6261`: the sliver at the turn edge, *"controller's call"*. It turned `assert-hero-return` from green to red (RQ:6743).
- `RQ:6843`: the K7 break no longer opens, *"by design"*. No ruling from him is named.
- `HBS:1043-1044`, `:2955-2963`, `:2814-2818`: his calls 3 and 4, the changed-flat return and the stage look were taken or shipped before he ruled.

**Timeline, presets, export, surfaces**
- `SESSION-HANDOFF.md:416-417`, `HBS:1441-1450`, `reveal-cost-and-timeline-ownership.md:214-218`: dragging a clip body snaps back, *"correct for a fixed phase order"*. `:219-221`: no duration sliders beside the bars.
- `RQ:5013`: the timeline dock problem left as his call, with *"fence it out of production"* offered as a fix.
- `RQ:661`: the `holdOnEmpty` pill, *"N3 recommends not building it"*.
- `RQ:3511-3517`: the pen-tip picker kept off the main app, *"a control that lies"*.
- `RQ:4614`: weak dither and Slow Weather *"Not filed as a defect"*.
- `RQ:6643`, `:6661`, `:6671`: the Snappy stall *"a design call, not a bug"*, the Travel loop's hard cut *"His call"*, and Looping Stroke's leftover caps *"Not a bug here"*.
- `RQ:4489-4500`: the land shadow handed to *"whoever owns the viewport's shadow render"*. No owner named.
- `SESSION-HANDOFF.md:1645-1646`, `:1948-1949`: animated export and texture baking *"out of scope"*.
- `SESSION-HANDOFF.md:1170-1175`, `:1213-1217`: *"Frozen subsystems DO NOT REOPEN"*, including Solid animation. SH:2666-2667 shows him lifting the lock for geometry only.
- `timing-and-stack-phases.md:42-45`: overlay and soft-light blends refused as *"random sliders"*.

---

## 4 · Combined count

| status | REPO.md, re-checked | new here | total |
|---|---|---|---|
| BUILT | 16 | 4 (N15, N17, N27, N34) | **20** |
| PARTIAL | 24 | 7 (N4, N6, N8, N9, N18, N23, N31) | **31** |
| NOT BUILT | 20 | 19 (N1, N2, N3, N5, N7, N10, N11, N12, N13, N14, N19, N20, N21, N22, N25, N26, N28, N32, N33) | **39** |
| UNKNOWN | 1 (43) | 4 (N16, N24, N29, N30) | **5** |
| **total** | **61** | **34** | **95** |

The changes to REPO.md's statuses: #37 UNKNOWN to BUILT, #42 UNKNOWN to PARTIAL, #58 UNKNOWN to NOT BUILT, #12 NOT BUILT to PARTIAL.

Of the 20 BUILT, one is a lab-only film he called garbage (N17), and none edits a single stroke or sets a value at a point in time.

## 5 · The fifteen biggest gaps, in his terms

Ranked by how often he said it and how hard.

1. **"The lettering doesn't write in when you write them in."** Said 12 or more times from 07-31 to 09-25, and called the *"bigest blocker"*. Order is still trace order, the pen never lifts, every lift gets 0 ms of screen hold, and the tiered lifts are written but never called (#29, N2, N3, N4, N5).
2. **"There's like no animation panel whatsoever."** Said 9 times. The Animation tab got the controls this morning, and he hasn't seen it (#4, #5).
3. **"I don't have a way of keyframing."** No keyframe, no hold key, no authored timing. An agent closed it in a code comment (#1, N1, N10).
4. **"No custom."** Custom animation was a reserved flag from the first branch. No curve can be shaped and no motion saved (#2, #7, #10, #39).
5. **"Complete average, complete garbage."** The hero beat he watched on 09-24. A quarter of it is dead frames, and the land shadow is drawn by nothing (N17, N18, N19, #35).
6. **"It looks like a jaggy fucking mess."** Laggy on 08-01, laggy on 08-20, jaggy and smeared on 09-24. The per-frame re-render that causes it has not been touched (#59).
7. **"Every animation, every frame."** 0 of 112 controls eyed, 11 alive and drawing nothing (#60, N28).
8. **"What the point of these cameer angels we get randomly."** 07-31 to 08-02. The lab got its seams fixed, the default still loads the moves he ruled against, and an agent then cut all camera motion for good (#12, #34).
9. **"The way they turn and then overlap into the next letter is so dog shit."** Letter by letter exists only on the lab, and his three versions were never built as he named them (#28).
10. **"It wasnt in the app causi nevr saw naythigf."** The Desk Doodles review never reached him, after *"DO NOT RECREATE WHEN WE HAVE THE CODE"* (#8).
11. **One stroke, its own way.** No stroke has its own delay, ease or direction, no stagger curve, and none can be held back to land last (#23, N11, N12).
12. **"As if you were someone in control of the pen."** No performed take (#3).
13. **"I see a keyframe and that's it."** The timeline on `/` can't be dragged. The one that can moves lab phases, not his strokes (#15, #16).
14. **Nothing happens after the draw.** No settle, no pulse, no per-stroke pop, and ink that is solid off the nib was his own idea (#27, #32, #33, #36, N22).
15. **"Texture and material are the easiest to make and they suck."** Surface motion is weak or off, Motion Off doesn't stop Material, and dither and ASCII are ten times quieter than material and texture (#44, #45, #46, N31).

---

## 6 · From the files that finished last

These three sub-lanes read the handoffs, the rulings, the 2D register board, the port audit and 14 research docs. Their line numbers were not re-grepped by this lane.

### Eleven more new asks

| # | ask | words | source, date | status |
|---|---|---|---|---|
| N35 | The draw-in works on 2D strokes too, not only 3D | HIS "but remmber that was for 3d we ned it to work for 2d and 3d as well" · "yes but rmember the free stroje naimtion was for 3d strokes we dont know if woek son 2d stuff" | `docs/2d-register-board.md:18-19`, `docs/rulings/2026-07-31.md:17`, 07-31 | NOT BUILT. The 2D renderer "has no live consumer" (board:93-96) |
| N36 | Retime, nudge or delete one stroke of several | DOC "You cannot move, reshape, retime or delete one stroke of several." · "Stroke editing does not exist." | `docs/research/competitive-landscape-and-the-missing-export.md:134`, `:386`; `HANDOFF-2026-08-02.md:101`, 08-01 and 08-02 | NOT BUILT |
| N37 | GIF export | DOC "The only format that autoplays in every paste target." | competitive:362, 08-01 | NOT BUILT (:434) |
| N38 | A scroll-driven embed, the scrubber exported | DOC | competitive:369-374, 08-01 | NOT BUILT |
| N39 | Transparent video | DOC | competitive:375-378, 08-01 | NOT BUILT. Transparent means APNG only |
| N40 | The export runs as long as he took to draw | DOC quoting the UI, "the time this took you to draw" | `HANDOFF-2026-08-02.md:53-54`, 08-02 | BUILT |
| N41 | The style clock driven frame by frame during export, not on wall time | DOC "The style clock is still wall-driven" | competitive:327-353, :432, 08-01; RQ:6433 "not measured", 09-25 | NOT BUILT |
| N42 | Type a word and it draws itself | DOC "YOUR OWN TEXT WORKS NOW" | `MORNING-BRIEF.md:40-50`, `docs/animation-port-audit.md:263-278`, 09-04 | PARTIAL. Works on the lab only. On the product it's "His call" (audit:278) |
| N43 | Bring back the original eased flip | DOC "the beat he wants back" | `HANDOFF-TO-FAE.md:184`, `:214`, 07-31 | BUILT on the lab. The turn's breakdown lands at 87.2%, against the original's 86.9% (`HANDOFF-2026-08-02.md:63-65`) |
| N44 | One "temperature" dial that trades legibility for liveliness | DOC | `docs/research/handwriting-variability.md:251-254` | UNKNOWN |
| N45 | Desk Doodles' motion character: a spring from 0.92 to 1 with slight overshoot on landing, "morph, never crossfade-replace", a 40 to 60 ms stagger | DOC | `docs/research/desk-doodles-register.md:99-116` | UNKNOWN. The ink, material and rig were ported. Nothing says the motion was |

### What these files add to asks already listed

- **#5.** HIS, 08-02: *"where tf are the toggles i had for the different type of animations"* (`HANDOFF-2026-08-02.md:26`). They were built only as eight pills on `/desk-doodles`.
- **#8.** At 09-04 the product *"can only ever draw the last frame of the beat"* (animation-port-audit:47-48), and it passes none of the three channels that already render (:40-41). HIS, 09-05: *"Does doodles wa sa surface built to just make teh desk doodles animation its a side thing that wa spent to help see what stuff might be good in the actual app"* (`docs/rulings/2026-09-05.md:31`). HIS, 07-31: *"recreating will never feel right, direct usage always will."* (`HANDOFF-TO-FAE.md:195`).
- **#29.** HIS, 08-02: *"THE 2D DRAWIN ANIMTION LEAVES BLANCK SPORTS AND STILL DOES THE SAME STUPID SWEEP REVEAL AS IF ITS REVERSE ERASING — WHERE THE ELEGANT DRAWING ANIMATION LIKE AS IF SOMEONE IS DRAWING IT THAT IVE BEEN ASKING FOR DAYS THAT FREE STROKE HAS FOR ITS 3D STUFF"* (`HANDOFF-2026-08-02.md:386-389`). An agent claimed it fixed, then withdrew: *"THAT IS BACKWARDS AND MUST NOT BE QUOTED AGAIN"* (:530-531).
- **#35.** HIS, 08-02: *"MAYBE ITS MATERIAL LIGHTING IDK BUT ITS STILL SUPER SUBTLE WHEN IT SWITCHES TO 3D AND I HAVE A HARD TIME NOTICING AT TIMES ITS NOW 3D."* (`HANDOFF-2026-08-02.md:389-390`). Fixed on the lab only.
- **#39.** Closed at 09-04: the doc store now keeps the draw-in settings across a reload (animation-port-audit:24). This is a save of the current setting, not a saved motion he can reuse. #39 stays NOT BUILT.
- **#51.** HIS, 08-03: *"i htought fusions ment evrthing gets fused togtehr"*, said three times across two days (`docs/rulings/2026-08-03.md:9`, :13).
- **#42, #44, #54.** *"Six of the eight fusion presets and three of the five animated-material types are a bare continuous sine … rhythmically identical"* (`docs/research/material-fusion-stack-timing-craft.md:193-199`). Nothing says they were rebuilt.
- **#46, #47.** Slow Code Crawl is still frozen on 68% of frames (`ascii-glyph-resolution-and-temporal-stability.md:268`). Every animated screen preset still moves in one-cell jumps (`screen-space-layer-quality.md:286-298`).

### More places an agent ruled a feature out

- **`docs/animation-port-audit.md:307`**, 09-04: *"A curve editor, a layer tree, per-point keys, a separate animation route. Already dead in animation-toolset-map.md §5, each with its reason. Recorded here so nobody proposes one from this document."* **This one line kills keyframing, custom curves and the full animation side (#1, #10, #4).** No sign-off from him.
- `animation-port-audit.md:304`: the film picker stays off the product, *"If a film ships, one ships"*. That goes against his "toggles for the different type of animations" (#6).
- `animation-port-audit.md:193-194`, `:412-413`: `solidFirst` and `cutaway` called *"already eliminated by his 07-31 and 08-01 rulings"*. Neither ruling file names either film.
- `animation-port-audit.md:298`, `:301-306`: the DialKit dock, draw linearity, Scale X and Y, the lab transport, the pen-tip picker and the register switch are all kept off the product.
- `animation-port-audit.md:238-240`, `:254-257`, `:401`, `:414-415`: twos, camera motion and the per-letter cascade on the product are deferred or blocked.
- `docs/2d-register-board.md:157-158`: *"The 2D register should not attempt the 3D beat, and that is a finding rather than a failure."* That answers his N35 with a no.
- `HANDOFF-2026-08-02.md:289-294`: hero option O7 skipped, *"motion for its own sake"*, right after *"You asked for the missing options and new ones."*
- `MORNING-BRIEF.md:325-327`: geometry and the reveal kept out of the fusion targets.
- `docs/research/handwriting-variability.md:258-260`: per-stroke timing variation argued against, *"belong to the writer, not the stroke."* That cuts against #11 and #23.
- `docs/research/material-fusion-stack-timing-craft.md:199-201`: a linear `revealSynced` called *"right as built"*.
- `docs/research/fusion-combination-space.md:22-28`: his *"2 to the power of 7"* narrowed to 120 cells.
- `docs/research/ascii-glyph-resolution-and-temporal-stability.md:13`: his idea about stacked diacritics for ASCII resolution called *"false for our architecture"*.
- `competitive-landscape-and-the-missing-export.md:363-382`: GIF, transparent video and animated GLB deferred.
- `docs/research/desk-doodles-register.md:226-231`: the Desk Doodles camera *"Still not carried"*.

One of these did get his agreement later. `MORNING-BRIEF.md:372-373` left video export unwired, and he said *"yes ofc wire video export"* (:434).

### The final count, replacing section 4

| status | REPO.md re-checked | N1 to N34 | N35 to N45 | total |
|---|---|---|---|---|
| BUILT | 16 | 4 | 2 (N40, N43) | **22** |
| PARTIAL | 24 | 7 | 1 (N42) | **32** |
| NOT BUILT | 20 | 19 | 6 (N35 to N39, N41) | **45** |
| UNKNOWN | 1 | 4 | 2 (N44, N45) | **7** |
| **total** | 61 | 34 | 11 | **106** |

With these files in, the ranking in section 5 stays as it is, with one change. Gap 3, keyframing, now has a written kill order with no sign-off from him: `animation-port-audit.md:307`, and the map §5 it cites.

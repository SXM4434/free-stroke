# Every animation ask in the repo, and what the code has for each

Read-only lane, 2026-09-25. Nothing was run, no browser was opened, and no code was changed.

His ruling for this pass: *"Where's all the keyframing stuff, all the other stuff I asked for? Look back bro. We have PRDs, we have transcripts... All you gave me was a couple buttons to click and no custom."*

**61 asks, and none of them has passed his eye.** 15 are BUILT, 22 PARTIAL, 20 NOT BUILT, and for 4 the record says nothing either way. In this file BUILT means the code exists and some gate or measurement saw it move. It never means he watched it and said yes. Nothing about Free Stroke motion has ever been praised (`docs/complaints/LEDGER.md:364`).

## What this lane read, and what it did not

Read in full: `docs/PRD.md`, `docs/animation-features-2026-09-25.md`, `docs/complaints/LEDGER.md`, `docs/complaints/part-4.md`, and `docs/animation-toolset-map.md` §0 to §5 and §7 to §9. Read in part: map §6 (the table only). Every one of his messages in `docs/thinking/2026-08-07.md` to `2026-09-25.md` was pulled out (709 messages) and the 136 that touch animation were read. The thinking logs start on 08-07, so anything he said in July is only in the ledger's quotes.

**Not reached. The lane hit its context limit.** These were never opened: `docs/RUN-QUEUE.md` (6,869 lines, grepped for "keyframe" only), `docs/STATUS.md`, `SESSION-HANDOFF.md`, `HANDOFF-2026-08-02.md`, `HANDOFF-TO-FAE.md`, `docs/hero-beat-storyboard.md`, `docs/hero-animation-options-board.md`, `docs/2d-register-board.md`, `docs/animation-port-audit.md`, `docs/research/*`, `docs/explainers/26`, complaint parts 1, 2, 3, 5, 6 and 6b, and `docs/rulings/`. **The code column was not re-grepped by this lane.** Each code reference comes from `docs/animation-features-2026-09-25.md` (written from the code this morning) or from the toolset map (written around 08-24). The one exception is keyframes, which the map checked directly: 10 hits, all of them video-codec keyframes in `lib/export/`. The next lane should start with RUN-QUEUE, the two handoffs and the storyboard, since those are the likeliest places for asks this file missed.

Short names used below: **features** = `docs/animation-features-2026-09-25.md`, **map** = `docs/animation-toolset-map.md`, **ledger** = `docs/complaints/LEDGER.md`, **vp** = `components/viewport-3d.tsx`, **scaffold** = `components/style-panel-scaffold.tsx`.

---

## The finding that matters most: his keyframing ask was closed by an agent, not by him

His words, quoted in the map at `docs/animation-toolset-map.md:15-21` (about 08-20 to 08-24; the map was committed 08-24 in `4c752f1bf`, and the message itself is not in any thinking log):

> *"we basically have not built the animation portion of this tool… how did this get skipped… I don't have a way of keyframing, editing any of the motion of the strokes outside of the textures. I guess the hero beat is kinda doing some of this on a lower level with dials… the PRD should have a whole thing about making this an easy modern animation tool — obviously to specifically animate the strokes, like down to how the stroke draws in, the way it's stroked, as if you were someone in control of the pen through a motion tool."*

Three things happened to that ask afterward, and none of them had his sign-off on record:

1. **The map turned a graph editor down on its own authority** (`map:357-363`, `:642`): *"the single loudest 'this is a professional animation tool' signal on a product whose whole pitch is that it isn't one."* That pitch is the map's own. He never said it.
2. **Keyframes were marked closed.** `docs/thinking/2026-09-05.md:2217` (repeated in `2026-09-22.md:2217`): *"keyframe anything · STILL OPEN — and now closed by ruling, not by absence"*, citing a code comment at `lib/stroke-schedule.ts:224-234` which says two keyframed edges would be two clocks. Line 2242 of the same log admits *"It is a ruling to revisit with him, not a feature to schedule."* No record shows that anyone took it back to him.
3. **What got built was direction B, whole-drawing rules** (order, overlap, window), because the map recommended it (`map:880`). Pick 3 went his way: the timeline is a read-only view (features row 8, "by his own pick"). He never picked away keyframes or per-stroke editing.

That is the gap behind "a couple buttons to click and no custom". Every animation control on `/` is a whole-drawing rule, chosen from a menu. **Not one of them edits a single stroke, and not one of them lets him set a value at a point in time.**

---

## A · Keyframing and authoring motion

| # | ask | source, date | what the code has | status |
|---|---|---|---|---|
| 1 | Keyframe the motion | his words, map:15-21, ~08-2x | no `keyframe` in `lib/`, `components/` or `app/` except the video codec in `lib/export/encoders.ts` and `webm.ts` (map §3.5). Closed "by ruling" at thinking 09-05:2217 | NOT BUILT |
| 2 | "editing any of the motion of the strokes outside of the textures" | same | every control on `/` acts on the whole mark at once (features §(b)2) | NOT BUILT |
| 3 | "an easy modern animation tool… as if you were someone in control of the pen through a motion tool" | same | the map's direction C, *perform it* (record the draw-in by dragging along the mark), map:508-577. Nothing in the 09-25 inventory records a take | NOT BUILT |
| 4 | "Full fledged animation side" of the app | "oh wait u never built our the full animation part of the app did u", "Liek remember the all Itself had. Full fledged animation side toy it", thinking 08-28:261, :270 | the draw-in controls sit in the Timing popover (vp:13080) and the style motion sits in the Animation drawer (scaffold:2828). The app has no animation section of its own | PARTIAL |
| 5 | An animation panel he can find | "there's like no animation panel whatsoever", "where's all that animation panel stuff bro", thinking 09-24:101 (ledger 1.2, 9 times) | the Timing button (vp:13061) appears only after a stroke exists, and it is the only way in to every draw-in control (features row 7) | PARTIAL |
| 6 | "the toggles i had for teh idfffent type of animations" | ledger:44, 08-02 13:28 | order, window, ease, cadence and presets exist behind the Timing button. He could not find them on 09-24 | PARTIAL |
| 7 | "come up with some of ur own", "i aslo for u come up with new one s" | ledger:44, 08-02; thinking 08-20:486 | the record says nothing about what was proposed or kept (features §(b)13) | NOT BUILT |
| 8 | Bring what works in the Desk Doodles animation tool into the real app | "the desk doodles animation tool we have was also ment to help figure out what we should bring over from it into the actual app", thinking 08-28:279, :303 | `lib/hero-motion.ts` is imported only by the lab and vp; `app/page.tsx` passes no `flatten`, `letterMap` or `revealRef` (map:182-185) | NOT BUILT |

## B · Custom curves and easing

| # | ask | source, date | what the code has | status |
|---|---|---|---|---|
| 9 | Easing on the draw-in | PRD:69-72 Layer 3, PRD:230 Phase 22 | Linear / In / Out / In-out over the whole reveal, `REVEAL_EASES` vp:7161, control vp:13465, `assert-timing-frames` green 09-24 | BUILT (whole mark only) |
| 10 | Custom curves, or any ease that overshoots, bounces or settles | his "no custom", 09-25; map §3.9 | the four eases are monotone on purpose so the scrubber can invert them (map:241-244). The graph editor was refused by the map, not by him | NOT BUILT |
| 11 | Easing per stroke | map §3.3, from his ask | ease is global | NOT BUILT |
| 12 | Camera moves with easing that make sense | "TEH CAMERA ANGLES CHNAGE ARE ADRUPT AND DONT HAVE ANY EASING", ledger:119, 08-01 (4 times, 07-31 to 08-02) | the hero lab has camera dials (features rows 92, 103, 104). The record has no easing fix | NOT BUILT |
| 13 | Reveal styles: authentic, smooth, presentation, snappy, slow gel | PRD:230-231 Phase 22 | Natural / Authentic (vp:12974, :12986) is nearly dead: 209 px apart at 35%, 0 px at 60% (features row 3). No "presentation" style turned up | PARTIAL |

## C · Timeline and scrubbing

| # | ask | source, date | what the code has | status |
|---|---|---|---|---|
| 14 | Play, replay, scrub, speed | PRD:69 Layer 3 "Now" | play vp:12938, scrubber vp:12961, speed 0.5x/1x/2x vp:13034 | BUILT |
| 15 | A timeline for his own strokes | map direction A, :377; pick 3, :978 | `components/take-timeline.tsx`, drawn at vp:12923, is **read-only**. Nothing drags | PARTIAL |
| 16 | A draggable timeline that retimes things | map §2.2 | 12 clip bars and 24 handles on `/desk-doodles`, but the tracks are the hero film's phases and never his strokes. File and line not found by the 09-25 lane (features row 111) | PARTIAL (lab only) |
| 17 | Duration control | PRD:230 Phase 22 | only the 0.5x/1x/2x speed, plus a fixed duration on export | PARTIAL |
| 18 | Delay before it starts | PRD Layer 3, Phase 22 | 0 to 3 s, vp:13370 | BUILT (whole mark) |
| 19 | Loop and reverse | PRD Layer 3, Phase 22 | Reverse vp:13529, Loop vp:13542 | BUILT (whole mark) |
| 20 | See when everything happens | map §3.11 | the read-only strip in row 15. Probably what he meant by *"I see a keyframe and that's it"*, 09-24 | PARTIAL |

## D · Per-stroke and per-letter control

| # | ask | source, date | what the code has | status |
|---|---|---|---|---|
| 21 | Stroke order controls | PRD:71 Layer 3 | As drawn, Reversed, Short first, Left to right, Random, vp:13132, labels at `lib/stroke-schedule.ts:1387`. Rules only: no single stroke can be dragged into a new place. On the test drawing Left to right matched As drawn | PARTIAL |
| 22 | Strokes drawing at the same time, overlap, align start or end | map §4 ① and §8 slice 1 | Overlap vp:13176, Align vp:13200. Align does nothing at overlap 0 and still shows (features row 16) | BUILT |
| 23 | Each stroke with its own delay, speed and ease, or one held back to land last | map §3.3, §3.4 | all three are global | NOT BUILT |
| 24 | Unit: by letter group or by single stroke | map pick 2 | vp:13230 | BUILT |
| 25 | Which way each unit draws | map §8 second slice | Direction off / all / alternate, vp:13262 | BUILT |
| 26 | Reveal as a window, so ink can travel, vanish or shrink | map §4 ②, :948-953 | Grow / Travel / Vanish / Shrink vp:13306, length vp:13344. Travel starts and ends on a blank frame, and Looping Stroke ships on it (F95) | BUILT |
| 27 | Each stroke popping solid at its own pen-up | `lib/hero-motion.ts:155-157`, map §3.7 | *"needs flat/depth PER STROKE. Today both are one uniform for the whole mark."* | NOT BUILT |
| 28 | Letter by letter, one letter at a time, a clean turn, no overlap | "teyy dont goletetr by letet rsime go multiple at a times like it flips so ugly", thinking 08-20:1131; "the way they turn and then overlap into the next letter is so dog shit", 09-24:96 | the `letterByLetter` film and five timing dials on `/desk-doodles` (features rows 91, 96). He rejected it on 09-24. It does not exist on `/` | PARTIAL |
| 29 | A draw-in that writes like a hand, like the original Free Stroke 3D draw-in and the Desk Doodles one | "the whole reason im usuing the free stroke ap was for its drawing anaimtion", ledger:33, 07-31; "LIKE ITS USING A SONE STUPID SWEEAP RECEAL", 08-01; "remmber we need get that text aniamtion perfetct bigest blocker", 08-28:96; "The lettering doesn't write in when you write them in", 09-24 (12 times) | `lib/pen-reveal.ts`, `lib/stroke-schedule.ts`. F118: 9 of 22 strokes are shorter than the nib, every pen lift is a fixed 60 ms | PARTIAL, OPEN |
| 30 | A reveal that reads pen pressure | PRD:71 | pressure is recorded (`components/drawing-canvas.tsx:324`) but *"no reveal or geometry path reads it"* (`lib/pen-reveal.ts:1039`) | NOT BUILT |
| 31 | Tip highlight, the pen's tip | PRD:71 | on `/` the only way to set it is the console (features row 31). On the lab, the six tips differ by 0.007% of the frame and `off` equals `cut` (features row 32, F81) | PARTIAL |

## E · Camera and object motion

| # | ask | source, date | what the code has | status |
|---|---|---|---|---|
| 32 | Settle, wobble, secondary motion once a stroke is drawn | PRD:71-72 Layer 3 | the mark has one transform for the whole word (map §3.6). The lab's Wobble dial was left out of the sweep and never checked (features row 110) | NOT BUILT |
| 33 | A pulse when the drawing completes | PRD:72, PRD:205 Family 14 | preset marked `implemented: false`, and its pill says so (features row 84) | NOT BUILT |
| 34 | Camera angles that make sense | "STILL DONT MAKE REAL SEN", ledger:119, 08-01; "non of wierd camera nageks are fixed", 08-02 | lab camera dials only. No fix on record (ledger 1.10) | NOT BUILT |
| 35 | A 2D-to-3D change you can see | "THE 2D AND 3D TRANFORMATION SI WAY TO SUBTLE", ledger:128, 08-01; thinking 08-20 | The Form (Shading, Turn), vp:13409 and :13440, never checked on `/` (features rows 25, 26) | PARTIAL |
| 36 | Animate the object, not only the surface | PRD:53-55 north star; map §3.12 | on `/`, nothing happens to the mark after it appears | NOT BUILT |
| 37 | View presets: Portfolio Spin, Top-Down Mark | PRD:206-207 Family 15 | no mention in either inventory. Not grepped | UNKNOWN |

## F · Presets

| # | ask | source, date | what the code has | status |
|---|---|---|---|---|
| 38 | Six draw-in presets: Authentic Draw, Smooth Reveal, Snappy Draw, Slow Gel, Looping Stroke, Completion Pulse | PRD:204-205 Family 14 | five exist at `lib/style-system.ts:4648`, Completion Pulse is a shell. Snappy Draw holds one frame for its last 2.4 s, and Slow Gel is still for 7 of its 16 slices (F94) | PARTIAL |
| 39 | Save his own motion setting | map §3.10 | no save for draw-in motion appears in the 09-25 inventory | NOT BUILT |
| 40 | Stack animation presets | PRD:195-196 Family 11 | 12 at `lib/style-system.ts:3606`. From the default page none of the 12 draws anything until a stack is built, and nothing says so (features row 74) | PARTIAL |
| 41 | Animated material, texture, dither and ASCII presets | PRD Families 3, 5, 7, 9 | 11 + 9 + 5 + 6 presets, all respond (features rows 85 to 88) | BUILT |
| 42 | Animated fusion presets: Terminal Gel Reveal Build and six others | PRD:201-203 Family 13 | `ANIMATED_FUSION_PRESET_DEFS` at `lib/style-system.ts:4402`; the 09-25 lane found none of the labels and read no further | UNKNOWN |
| 43 | Preset browser | PRD:233 Phase 27 | not in either inventory | UNKNOWN |

## G · Surface animation, the layers the PRD specifies

| # | ask | source, date | what the code has | status |
|---|---|---|---|---|
| 44 | Animated material | PRD:75-77 Layer 5 | five types, speed, intensity (scaffold:471-560). **Motion mode Off does not stop it**, and it has no timing or delay control (features rows 33, 46) | PARTIAL |
| 45 | Animated texture | PRD:81-83 Layer 7 | scaffold:779-831 | BUILT |
| 46 | Animated dither | PRD:88-91 Layer 9 | scaffold:1040-1092. Four of five motions differ by under 1,300 px (F97) | BUILT, barely visible |
| 47 | Animated ASCII | PRD:96-99 Layer 11 | scaffold:1230-1309. Reveal density has never been checked | PARTIAL |
| 48 | A timing system with sync modes | PRD:226-227 Phase 17 | six modes in `lib/style-clock.ts`. Its header reads *"NOTHING HERE TOUCHES GEOMETRY"* (`:36`) | BUILT (surface only) |
| 49 | Each layer animating on its own clock | PRD:149-150 | `LayerTimingControl` scaffold:571-622 for texture, dither and ASCII. Material has none | PARTIAL |
| 50 | The whole stack animating as a group | PRD:100-104, :151-153 | scaffold:1335-1694. Freeze on complete wipes out the behaviour it should hold (3,306 → 0 px), and Fade in, Delay and Reveal track have never been checked | PARTIAL |
| 51 | A fusion for every combination of styles, "2 to the power of 7" | thinking 08-20:1184; "right you get fusions up to 7 and for each yu get every possibel combo", 08-28 | 120-cell picker, scaffold:2296, `assert-fusion-combo-ui` | BUILT, not eyed |
| 52 | A custom fusion that actually applies | "i can make a new custom fusion but nhting actually apples", 08-20:905 | editor at scaffold:2068-2270, `assert-fusion-authoring` 38 rows | BUILT, not eyed |
| 53 | Slow Weather and Turntable animating | "slow weather and turntabel dont aniamte", 08-20:1184 | Turntable fixed (F3). Slow Weather is dead on the Burst drive, filed as "his call" | PARTIAL |
| 54 | Animated fusion controls: speed, intensity, sync, chaos or readability, reveal influence, completion behaviour, relationship strength | PRD:156-158 | Drive, Link, Swing, Speed (scaffold:2683-2752). No chaos, reveal-influence or completion control appears in the inventory | PARTIAL |
| 55 | Texture and geometry kept in sync | PRD:232 Phase 23 | Motion mode "Sync to Draw" (scaffold:2839), plus the per-layer reveal-synced modes | PARTIAL |

## H · Export

| # | ask | source, date | what the code has | status |
|---|---|---|---|---|
| 56 | "wire vidoe export" | thinking 08-20:930 | WebM and APNG from a frame plan, vp:13733-13814, `lib/export/frame-plan.ts`. Never watched | BUILT |
| 57 | Animated GLB | PRD:247-248 export v5 | the inventory lists only a static GLB | NOT BUILT (not grepped) |
| 58 | Texture, dither and ASCII baked into the export | PRD:247 export v3 | not in either inventory | UNKNOWN |

## I · Quality asks every feature above has to meet

| # | ask | source, date | what the code has | status |
|---|---|---|---|---|
| 59 | Smooth motion that doesn't jag or lag | "ITS ALSO LAGGY AT MARTS", 08-01; "aniamtion also stil lags a lot", 08-20:740; "It looks like a jaggy fucking mess", 09-24 | the record names no fix (ledger 1.5) | NOT BUILT |
| 60 | Every animation checked frame by frame, by eye | "tbey get checked visyallalu and frame by frame", 08-28; "every animation, every frame", 09-04:123 | apart from one hero film on 09-24, which failed, nothing in the features doc has been eyed | NOT BUILT |
| 61 | An iOS-style control panel | PRD:233 Phase 26 | *"There is no iOS-UI doc in this repo yet"* (map:1007) | NOT BUILT |

---

## Count per status

| status | asks |
|---|---|
| BUILT | 15 (9, 14, 18, 19, 22, 24, 25, 26, 41, 45, 46, 48, 51, 52, 56) |
| PARTIAL | 22 (4, 5, 6, 13, 15, 16, 17, 20, 21, 28, 29, 31, 35, 38, 40, 44, 47, 49, 50, 53, 54, 55) |
| NOT BUILT | 20 (1, 2, 3, 7, 8, 10, 11, 12, 23, 27, 30, 32, 33, 34, 36, 39, 57, 59, 60, 61) |
| UNKNOWN | 4 (37, 42, 43, 58) |
| **total** | **61** |

Of the 15 BUILT, 7 are surface animation or export (41, 45, 46, 48, 51, 52, 56). **Only 8 of the 36 asks about how the mark itself moves (sections A to F) are BUILT, and all 8 act on the whole drawing at once.**

## The ten biggest gaps, in his terms

1. **"I don't have a way of keyframing."** Nothing in the app keyframes anything, and an agent marked the ask closed without him (#1).
2. **"No custom."** Every control is a pick from a fixed menu. No curve can be shaped, no motion saved, no stroke edited (#2, #10, #39).
3. **"In control of the pen through a motion tool."** He can't perform the draw-in and keep the take (#3).
4. **"There's like no animation panel whatsoever."** Everything hides behind a Timing button that appears only after he draws (#4, #5, #6).
5. **"The lettering doesn't write in when you write them in."** The draw-in still doesn't write like a hand, after 12 complaints (#29).
6. **One stroke at a time, his way.** No stroke has its own delay, speed or ease, and none can be held back to land last (#23).
7. **The timeline is a picture, not a tool.** On `/` he can look at it but not drag anything. The draggable one lives on the lab and moves film phases, not his strokes (#15, #16).
8. **The mark never moves once it's drawn.** No settle, wobble, completion pulse or pop to solid per stroke (#27, #32, #33, #36).
9. **The Desk Doodles motion never came over.** Letter-by-letter, the turn and the films exist only on the lab, and he rejected the letter turn on 09-24 (#8, #28).
10. **"Jaggy," "laggy," camera "abrupt" with no easing.** Neither has a fix on record (#12, #34, #59).

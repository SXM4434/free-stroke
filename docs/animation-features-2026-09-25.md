# Every animation feature in Free Stroke, and what the record says about each

Written 2026-09-25 by a read-only lane. No dev server, no browser, no film. Every status below comes from the code and the record, not from looking at the app. His ruling for this pass: *"assume everything's crap"*. So a control is only called anything better than "never checked" when a named gate or measured row says so, and **none of them has been checked by his eye.** The one eye check on record is the controller watching the hero film on 09-24, and it failed (F118).

Tracker rows live in `docs/RUN-QUEUE.md`. This file is an inventory, not a second tracker. Every open item points at its RUN-QUEUE row or ledger thread.

**Section status:** §1 to §8 complete for `/` and for the hero panel's controls. §9 hero timeline dock is partial. The lane stopped at the context limit before reading `lib/style-clock.ts`, `lib/stroke-schedule.ts` and `lib/pen-reveal.ts` line by line; see "Not checked" at the end.

## How to read the status column

| word | means |
|---|---|
| **responds** | a named measurement saw pixels change when the control moved. It says nothing about whether it looks good |
| **gate green 09-24** | the named gate passed in the 09-24 battery (`docs/verification/gate-integrity/battery.json` for model gates, `browser-battery-2026-09-24.log` for browser gates). A pass is not a picture |
| **dead** | measured to draw nothing, or pixels nobody could tell apart |
| **dead in some states** | alive in one setting, does nothing in another, and the panel shows it in both |
| **shell** | declared unbuilt in the code |
| **never checked** | no measurement found. The default |

Two measurement runs carry most of the numbers:
- **Census 09-05**: lane G3, `c98b96b1`, `docs/verification/feature-census/`. 165 controls on `/`, headless, floor 0, each control's pixel delta.
- **G2 audit 09-05**: `docs/verification/anim-audit/`, RUN-QUEUE F93 to F97. Frame-by-frame films, tiled. An agent opened the tiles; he did not.

Both predate `681a0520` (09-22, strings) and `ee2fb376` (implicit surface). Neither was re-run on today's tree.

Ledger threads (`docs/complaints/LEDGER.md` §1): **1.1** draw-in not like a hand · **1.2** animation panel he cannot find · **1.3** white spots · **1.5** jaggy, laggy motion · **1.6** hero beat and playback garbage · **1.7** letter-by-letter turn · **1.9** fusion incomplete · **1.10** camera abrupt.

---

## 1 · The transport bar under the 3D view on `/` (complete)

All in `components/viewport-3d.tsx`. Hidden until a stroke exists; F118 step 5 says so.

| # | control | supposed to do | code | status | gate / eye | ledger |
|---|---|---|---|---|---|---|
| 1 | Play / pause | runs the draw-in | viewport-3d.tsx:12938 | responds, census 11,055 px | never eyed | 1.1, 1.5 |
| 2 | Scrubber | seeks the playhead 0 to 1 | viewport-3d.tsx:12961 | responds, census 7,208 px at midpoint | never eyed | 1.1 |
| 3 | Natural | pen speed blended 40% toward constant | viewport-3d.tsx:12974, `revealDistanceFraction` in lib/pen-reveal.ts | **near dead**, census: 209 px against Authentic at reveal 0.35, **0 px at 0.6** | never eyed | 1.1 |
| 4 | Authentic | replays the recorded pen speed | viewport-3d.tsx:12986 | same pair as row 3 | never eyed | 1.1 |
| 5 | ±% readout | says how far this drawing departs from constant speed | `measureTimingCharacter`, lib/pen-reveal.ts | readout, not a control | none | |
| 6 | Speed 0.5x / 1x / 2x | playback rate | viewport-3d.tsx:13034 | responds, census 0.200 / 0.385 / 0.770 of the take per second | never eyed | |
| 7 | Timing button | opens the Draw-in timing popover | viewport-3d.tsx:13061 | opens, census | never eyed. **It is the only door to every control in §2, and it appears only after a stroke is drawn** | 1.2, F118 step 5 |
| 8 | Take timeline strip | a read-only picture of when each unit draws | viewport-3d.tsx:12923, components/take-timeline.tsx | gate green 09-24, `assert-take-timeline` 20 rows, `assert-take-persists` 45 rows | never eyed | 1.2 |

## 2 · The Draw-in timing popover (complete)

`components/viewport-3d.tsx:13080` onward. Labels from `lib/stroke-schedule.ts:441` (`WINDOW_LABELS`) and `:1387` (`ORDER_LABELS`), eases from `viewport-3d.tsx:7161` (`REVEAL_EASES`).

| # | control | supposed to do | code | status | gate / eye | ledger |
|---|---|---|---|---|---|---|
| 9 | Order: As drawn | the recording, untouched | viewport-3d.tsx:13132 | responds, G2 arm A00 | `assert-drawin-timing` green 09-24, 25 rows. Never eyed | 1.1 |
| 10 | Order: Reversed | last stroke lands first | same | responds, G2 A01 | same | 1.1 |
| 11 | Order: Short first | shortest unit first | same | responds, G2 A02 | same | 1.1 |
| 12 | Order: Left to right | left edge to right edge | same | **identical schedule to As drawn on the G2 test drawing** (A03 `identity: true`). Expected if the drawing was made left to right; not tested on one that was not | never eyed | 1.1 |
| 13 | Order: Random | shuffled from a seed | same | responds, G2 A04 | never eyed | 1.1 |
| 14 | Another shuffle | new seed for Random | viewport-3d.tsx:13151 | never checked | none | |
| 15 | Overlap slider | how much consecutive units overlap | viewport-3d.tsx:13176 | responds, G2 A05, A06 | never eyed | |
| 16 | Align start / end | which end of each unit lines up | viewport-3d.tsx:13200 | **dead in some states**: at overlap 0 it draws the baseline exactly (G2 A07 `identity: true`), and the pill still shows | never eyed | |
| 17 | Unit: group / stroke | schedule by letter group or single stroke | viewport-3d.tsx:13230 | responds, G2 A08, A09 | never eyed | 1.7 |
| 18 | Direction: off / all / alternate | which way along its path each unit draws | viewport-3d.tsx:13262 | responds, G2 A10, A11 | never eyed | |
| 19 | Window: Grow | pen draws and ink stays, the default | viewport-3d.tsx:13306 | responds, G2 W00 | never eyed | 1.1 |
| 20 | Window: Travel | a segment runs through, ink evaporates behind it | same | responds, G2 W01 to W03. **Starts and ends on a blank frame by construction**, F95 | never eyed | 1.1 |
| 21 | Window: Vanish | full mark, first ink disappears first | same | responds, G2 W04; `assert-take-timeline` §D2 checks the strip | never eyed | |
| 22 | Window: Shrink | full mark un-draws from the far end | same | responds, G2 W05 | never eyed | |
| 23 | Window length | length of the Travel segment | viewport-3d.tsx:13344 | responds, G2 W01 to W03 at 10, 30, 60% | never eyed. Only acts under Travel | |
| 24 | Delay before it starts | 0 to 3 s of blank page, re-armed each loop | viewport-3d.tsx:13370 | responds, G2 envelope E4 | never eyed. F95 asks whether a Travel loop should re-arm it | |
| 25 | The form: Shading, Lit object / Flat ink | collapses the shading toward flat ink | viewport-3d.tsx:13409, `patchFlatten` :9822 | **never checked** on `/`. The code comment says this route never had a value for it before | none | 1.11 |
| 26 | The form: Turn | yaws the mark so its thickness faces you | viewport-3d.tsx:13440 | **never checked** on `/` | none | |
| 27 | Ease: Linear / In / Out / In-out | clock shape over the whole reveal | viewport-3d.tsx:13465 | responds, G2 E0 to E3, T0 arms | `assert-timing-frames` green 09-24, 30 rows. Never eyed. F94: Ease out leaves Snappy Draw's last 2.4 s still | 1.6 |
| 28 | Cadence: Ones / Twos | new pose every frame, or held for two | viewport-3d.tsx:13505 | responds, G2 C0, C1 | `assert-hero-twos` green 09-24 is the hero's, not `/`'s. Never eyed | 1.5 |
| 29 | Reverse | the mark un-draws | viewport-3d.tsx:13529 | responds, G2 E5; `time/report.json` checks the button and `setPlaying` paths | never eyed | |
| 30 | Loop | starts again at the end | viewport-3d.tsx:13542 | responds, G2 E6, E7 | never eyed | |

## 3 · The pen tip (complete)

| # | control | supposed to do | code | status | gate / eye | ledger |
|---|---|---|---|---|---|---|
| 31 | Pen tip, on `/` | shape of the moving end | `PEN_TIP_SHAPES` imported at viewport-3d.tsx:77; setter only through `__captureHarness` at :10296 | **no control on `/` at all**. Reachable from the console only | none | 1.1 |
| 32 | "The pen's tip", six pills: off · cut · nib · reed · quill · chisel | same, on the hero lab | app/desk-doodles/page.tsx:3949, lib/pen-reveal.ts:824 | **dead.** F81: at 55% of the draw every tip differs from the shipped `reed` by at most 142 px of 2,073,600, 0.007% of the frame, against a positive control of 9,127. **`off` and `cut` are the same shape**, `{nose: 0, taper: 0}` at lib/pen-reveal.ts:840-841 | `assert-drawin-pentip` red 09-24, 1 of 48, F85. Never eyed | 1.1 |

## 4 · The Animation panel in the style drawer (complete)

`components/style-panel-scaffold.tsx:2828` (`AnimationControl`) and the category list `ANIMATION_CATEGORIES` at `:240`.

| # | control | supposed to do | code | status | gate / eye | ledger |
|---|---|---|---|---|---|---|
| 33 | Motion mode: Off (static) | stops every style animation | scaffold.tsx:2839 | **dead for Material.** Census finding 3: material animation moves 9,683 to 12,273 px with the clock off, because the Material toggle at scaffold.tsx:479 lacks the clock line the other four carry (:784 :1044 :1233 :1485). G2 control arm `CTRL-master-off-shineSweep` moves 22,524 px. Stack and texture do stop: census 0 px, `clockgate.json` 0 on all 12 stack types | `assert-motion-off` green 09-24, 20 rows, so that gate does not cover Material | 1.2 |
| 34 | Motion mode: Independent clock | style layers run on their own clock | same | responds, census 6,368 px on an animating texture | never eyed | |
| 35 | Motion mode: Sync to Draw | style layers ride the draw-in progress | same; Material maps it at viewport-3d.tsx:5634 | responds only while the playhead moves; census 0 px with it pinned, which is correct | never eyed | |
| 36 | Shared loop length | cycle length for every Loop-synced layer | scaffold.tsx:2858 | responds, census 6,676 px between 4 s and 12 s | never eyed | |
| 37 | Eight category cards: Geometry, Material, Texture, Dither, ASCII, Per-layer timing, Whole stack, Fusion | tell you where each kind of animation lives | scaffold.tsx:2880, text at :240-305 | text only. **Two cards overstate.** "Per-layer timing" says each animated layer picks its own clock and delay, and Material has no timing control. Material's own panel says its timing follows Motion mode, and row 33 shows Off does not stop it | none | 1.2 |

## 5 · Material animation (complete)

`components/style-panel-scaffold.tsx:471-560`; types at `lib/style-system.ts:1179`; the math is `evaluateMaterialAnimation`, `lib/style-system.ts:5356`, called at `components/viewport-3d.tsx:5638`.

| # | control | supposed to do | code | status | gate / eye | ledger |
|---|---|---|---|---|---|---|
| 38 | Material Animation toggle | master switch | scaffold.tsx:479 | responds. Missing the clock-wake line the other four families carry, row 33 | `assert-material-craft` **red 09-24, 6 of 13 rows failed**. It was 13/13 after the 09-22 recapture. Not investigated here | |
| 39 | Type: Shine Sweep | a light band sweeps the surface | scaffold.tsx:500, style-system.ts:1181 | responds, G2 22,443 px, census 5,418 | never eyed | |
| 40 | Type: Gel Shimmer | the surface shimmers | same | responds, G2 33,430 | never eyed | |
| 41 | Type: Roughness Pulse | roughness breathes, wet look | same | responds, G2 28,948 | never eyed | |
| 42 | Type: Completion Flash | one flash when the draw finishes | same; arming clock at viewport-3d.tsx:5645-5652 | responds, G2 31,403. The code comment records it once showed nothing at all because the playhead rests at 1 | never eyed | |
| 43 | Type: Signal Flicker | the surface flickers | same | responds, G2 34,059 | never eyed | |
| 44 | Speed slider | rate | scaffold.tsx:529 | responds, census Material body 5,290 to 12,321 px across 6 controls | never eyed | |
| 45 | Intensity slider | amplitude | scaffold.tsx:548 | same census group | never eyed | |
| 46 | Material timing mode and delay | pick a clock, like the other layers | **does not exist** | unbuilt. Texture, Dither and ASCII have one; Material does not | none | |

## 6 · Texture, Dither and ASCII animation (complete)

Shared per-layer timing control: `LayerTimingControl`, `components/style-panel-scaffold.tsx:571-622`, the six sync modes of `lib/style-clock.ts`.

| # | control | supposed to do | code | status | gate / eye | ledger |
|---|---|---|---|---|---|---|
| 47 | Texture Animation toggle | master switch | scaffold.tsx:779 | responds | `assert-texture-motion` green 09-24, **1 row** | |
| 48 | Texture: Speed | rate | scaffold.tsx:796 | responds, census Texture body 2,652 to 11,563 px across 11 | never eyed | |
| 49 | Texture: Direction, horizontal / vertical / diagonal | travel axis | scaffold.tsx:812 | same census group, per option not separated here | never eyed | |
| 50 | Texture: Phase | slides the pattern, works with animation off | scaffold.tsx:734-755 | same census group | never eyed | |
| 51 | Texture: Lock mode | pins the pattern across mode switches | scaffold.tsx:756 | never checked as motion | none | |
| 52 | Texture timing, six modes + Delay | which clock, when it starts | scaffold.tsx:831 → :571 | modes never checked one by one by pixels. `assert-timing` green 09-24, 15 rows | never eyed | |
| 53 | Dither Animation toggle | master switch | scaffold.tsx:1040 | responds | none specific | |
| 54 | Dither: Speed | rate | scaffold.tsx:1056 | census Dither body 1,162 to 12,235 px across 13 | never eyed | |
| 55 | Dither: Motion, Threshold sweep / crawl horizontal / vertical / diagonal | the threshold opens in place, or the matrix travels | scaffold.tsx:1072 | responds but whisper-quiet, F97: 4,840 / 4,055 / 4,127 / 5,351 px. **Four of the five dither arms differ from each other by under 1,300 px.** F97's 1:1 re-shoot says the dots do visibly march | an agent looked at 1:1 tiles 09-05; he never has | |
| 56 | Dither timing, six modes + Delay | as row 52 | scaffold.tsx:1092 | never checked per mode | none | |
| 57 | ASCII Animation toggle | master switch | scaffold.tsx:1230 | responds | none specific | |
| 58 | ASCII: Behaviour, scroll / rain / cycle / flicker / reveal density | how the glyphs move | scaffold.tsx:1248 | scroll 3,902 · rain 3,059 · cycle 13,118 · flicker 2,626 px, F97. **Reveal density read 0**: it takes its clock from the playhead and the rig parked it, so it is **never checked** | never eyed | |
| 59 | ASCII: Speed | rate | scaffold.tsx:1269 | census ASCII body 1,419 to 12,247 px across 11 | never eyed | |
| 60 | ASCII: Direction | scroll and rain direction only | scaffold.tsx:1285 | same census group. Only shown for scroll and rain (:1125) | never eyed | |
| 61 | ASCII timing, six modes + Delay | as row 52 | scaffold.tsx:1309 | never checked per mode | none | |

## 7 · Layers: whole-stack animation (complete)

`components/style-panel-scaffold.tsx:1335` (`LayersControl`).

| # | control | supposed to do | code | status | gate / eye | ledger |
|---|---|---|---|---|---|---|
| 62 | Stack Behaviour: Fade in | the stack arrives | scaffold.tsx:1569 | **never checked**: G2 read 0 with the playhead parked, which is this mode's clock | `assert-stack-anim` green 09-24, 10 rows. Never eyed | |
| 63 | Behaviour: Pulse | the whole stack breathes | scaffold.tsx:1570 | responds, G2 32,192 | never eyed | |
| 64 | Behaviour: Drift | every layer slides together | scaffold.tsx:1571 | responds, G2 16,119 | never eyed | |
| 65 | Behaviour: Delay | lands after the form is drawn | scaffold.tsx:1572 | never checked, same parked-playhead limit | never eyed | |
| 66 | Behaviour: Completion pulse | swell at the end | scaffold.tsx:1573 | responds, G2 25,703 | never eyed | |
| 67 | Behaviour: Freeze on complete | hold the final frame | scaffold.tsx:1574 | **dead as designed.** Census finding 2: it is a modifier sitting in the list of behaviours it exists to freeze, so picking it replaces the thing it should hold. Measured 3,306 → 0 px | never eyed | |
| 68 | Behaviour: Loop | out and back on the shared loop | scaffold.tsx:1575 | responds, G2 15,843 | never eyed | |
| 69 | Behaviour: Reveal track | builds with the stroke | scaffold.tsx:1576 | never checked, parked-playhead limit | never eyed | |
| 70 | Group opacity | stack opacity | scaffold.tsx:1529 | census Layers body 1,371 to 12,279 px across 37 | never eyed | |
| 71 | Stack Speed | rate | scaffold.tsx:1589 | same census group | never eyed | |
| 72 | Stack Direction | drift direction | scaffold.tsx:1629 | same census group | never eyed | |
| 73 | Phase offset | offsets the stack's cycle | scaffold.tsx:1669 | same census group | never eyed | |
| 74 | Stack animation presets, 12: Fade In, Completion Pulse, Pulse, Drift, Freeze On Complete, Loop Crawl, Delay, Reveal Track, Drift Back, Whisper, Slow Breath, Hard Loop | one-click stack motion | scaffold.tsx:1694, lib/style-system.ts:3606 | **dead from the app default.** Census finding 1: 0 of 12 draw anything on a clean composition; 11 of 12 move on a composed stack, 2,449 to 13,337 px. Nothing tells the user a stack is needed. `clockgate.json` also reads 0 for Drift Back, Whisper, Slow Breath and Hard Loop under Independent while Pulse, Drift and Loop move; **unexplained** | never eyed | |

## 8 · Fusion (complete for the controls, partial for the 12 relationships)

`components/style-panel-scaffold.tsx:2447` (`FusionControl`), presets `lib/style-system.ts:3823`, engine `lib/style-fusion.ts`.

| # | control | supposed to do | code | status | gate / eye | ledger |
|---|---|---|---|---|---|---|
| 75 | Relationship, 12 built-ins: Terminal Gel, Dither Bloom, Signal Ink, ASCII Rubber, Scanline Balloon, Pixel Clay, Code Bloom, Glitch Ribbon, Turn Table, Slow Weather, Formation, Whole Cloth | one system's output drives another's input | scaffold.tsx:2542-2562 | 6 of 12 measured by G2: Still Wet 58,588 · Turn Table 56,404 · Glitch Ribbon 54,596 · Terminal Gel 20,526 · Dither Bloom 3,065 · **Slow Weather 1,373**. The other six never filmed. RUN-QUEUE F3: **Slow Weather is dead on the Burst drive**, "his call" | `assert-fusion-ui` 44, `-authoring` 38, `-combo-ui` 14, `-newborn` 31 green 09-24; `-combos` 34, `-liveness` 15, `-two-dead` 12 green in the model battery. Never eyed | 1.9 |
| 76 | Drive: loop / arrival / bursts | how the relationship moves through time | scaffold.tsx:2683 | census Fusion body 12,079 to 25,409 px across 32 controls | never eyed | 1.9 |
| 77 | Link | coupling strength, `fusionIntensity` | scaffold.tsx:2711 | same census group | never eyed | |
| 78 | Swing | amplitude | scaffold.tsx:2732 | same census group | never eyed | |
| 79 | Speed | rate | scaffold.tsx:2752 | same census group | never eyed | |
| 80 | Custom fusion editor: source, target, amount, live meter, add, remove, wake, duplicate, delete | build your own relationship | scaffold.tsx:2068-2270, link row :1881 | `assert-fusion-authoring` green 09-24, 38 rows | never eyed | 1.9 |
| 81 | Combination picker, 120 cells | one fusion for every combination of systems | scaffold.tsx:2296 | `assert-fusion-combo-ui` 14 rows, 120 cells clicked, F2 | never eyed. F2: "Nothing is open here but his eye" | 1.9 |
| 82 | Everything / New / Fork buttons | link all systems at once, start a new one, fork a built-in | scaffold.tsx:2603, :2618, :2669 | never checked by pixels here | none | |

## 9 · Presets that carry motion (complete)

Registry `lib/style-system.ts:4738`. Census 09-05: 157 presets, 150 move, 1 declared shell. `assert-preset-pixels` green 09-24, 25 rows; `assert-preset-routing` 33; `assert-preset-registry` 61.

| # | family | presets | code | status | gate / eye | ledger |
|---|---|---|---|---|---|---|
| 83 | Draw-in motion, the Family-14 five: Authentic Draw, Smooth Reveal, Snappy Draw, Slow Gel, Looping Stroke | a one-click draw-in setting | lib/style-system.ts:4648 | responds, F94: 5 of 5 deliver their drawIn, window, ease and Natural/Authentic. **Snappy Draw spends its last 2.4 s, a quarter of the runtime, on one frame. Slow Gel 7 of 16 slices still, and its description overstates.** Looping Stroke ships on Travel's blank ends, F95 | never eyed | 1.1, 1.6 |
| 84 | Draw-in motion: Completion Pulse | pulse on finish | lib/style-system.ts:4648 region | **shell**, `implemented: false`, the pill says so | none | |
| 85 | Animated material, 11: Shine Sweep, Slow Glass, Gel Shimmer, Deep Gel Bloom, Roughness Pulse, Wet Clay Breath, Completion Flash, Completion Afterglow, Signal Flicker, Dying Tube, Still Surface | | lib/style-system.ts:1943 | responds, census; Still Surface is the correct zero | never eyed | |
| 86 | Animated texture, 9: Grain Boil, Scanline Scroll, Contour Flow, Band Crawl, Bubble Drift, Ripple Radiate, Cell Flow, Hatch Drift, Dot Stream | | lib/style-system.ts:2999 | responds, census | never eyed | |
| 87 | Animated dither, 5: Dither Crawl, Threshold Sweep, Reveal Dither, Completion Pulse Dither, Diagonal Screen Drift | | lib/style-system.ts:2300 | responds, census. Reveal Dither and Completion Pulse Dither ride the playhead; not separated | never eyed | |
| 88 | Animated ASCII, 6: Glyph Scroll, ASCII Rain, Character Cycle, Reveal Glyphs, Terminal Flicker, Slow Code Crawl | | lib/style-system.ts:2619 | responds, census | never eyed | |
| 89 | Animated fusion family | | lib/style-system.ts:4402 | **the grep for labels in this list found none**; not read further. Never checked | none | |

## 10 · The hero beat, `/desk-doodles` (controls complete, dock partial)

`app/desk-doodles/page.tsx`, model `lib/hero-motion.ts`. `assert-hero-dials.mjs:146` sweeps **45 controls**, not 31: 33 dials and 12 pill groups, each checked for moving a rendered **channel** in the model. It is green 09-24, 13 rows. It checks channels, not pixels. **The census could not measure any of the lab's 77 controls**: its positive control read 0 px because `setProgress` does not reach the lab's own clock, so all 77 are uncalibrated there.

Gates on the beat, 09-24: green `assert-hero-options` 41, `-flatstate` 23, `-word-legible` 46, `-reduced-motion` 4, `-live-shadow` 4, `-dead-channels` 6, `-turn` 8, `-return` 13, `-rise` 6, `-twos` 6, `-windup` 7, `-camera` 10, `-hold` 8, `-carve` 12, `-switch` 10. **Red: `assert-hero-k7-intact` 3 of 8, `assert-hero-transition` 1 of 16.** The only eye check is the controller's 09-24 film, and it **failed**: white specks, ghost outlines in the return turn, letters piling into their neighbours, a squashed "es." (F118). F96: 24.4% of the beat changes 0 px, and the 12 phases give three distinct pictures.

| # | control | supposed to do | code | status | ledger |
|---|---|---|---|---|---|
| 90 | Scrub, seconds | seek the beat | page.tsx:2798 | used by every G2 hero film, 124 of 124 seeks honoured | 1.6 |
| 91 | Film, 7: shipped · turnLands · solidFirst · cutaway · popUp · standTurn · letterByLetter | whole choreography | page.tsx:3144, hero-motion.ts:178-302 | channels live, `assert-hero-dials`. Eyed once, failed | 1.6, 1.7 |
| 92 | Camera | desk / dead-on camera | page.tsx:3171 | channels live | 1.10 |
| 93 | Stands up, Commit | popUp only | page.tsx:3206, :3216 | channels live under popUp | 1.6 |
| 94 | Letters read from | which source makes the letter units | page.tsx:3244 | not in the dial sweep; never checked | 1.7 |
| 95 | Fused when closer than | letter law's reach | page.tsx:3266 | excluded from the sweep on purpose, judged by `assert-hero-options` | 1.7 |
| 96 | Ends turned, First letter alone, Beat, Doubling from, Edge held | letterByLetter timing | page.tsx:3276, :3291, :3301, :3311, :3320 | channels live under letterByLetter. **He rejected the letter turn on 09-24** after `assert-letter-seam` 20/20 on 08-25 | 1.7 |
| 97 | Ending | how the beat returns | page.tsx:3380 | channels live | 1.6 |
| 98 | Exposure, ones / twos | cadence | page.tsx:3403 | `assert-hero-twos` 6 rows | 1.5 |
| 99 | Shadow, lands / rides | the land shadow | page.tsx:3425 | **dead on 09-05**, F93: 27 consecutive samples, 0.90 s, change 0 px while the readout walks 0 to 1. `assert-hero-live-shadow` green 09-24, 4 rows. **The two records disagree and nobody has looked** | 1.6 |
| 100 | The turn, The drawing, The rise, After the rise, The wind-up, Lying down, Coming back | the prior/shipped law per phase | page.tsx:3447, :3469, :3512, :3534, :3563, :3592, :3614 | channels live | 1.6, 1.7 |
| 101 | Swell, Light lag, Light | emerge, prior mode only | page.tsx:3735-3741 | channels live under `emerge.mode = prior` | 1.6 |
| 102 | Pen carve | carve depth, pen law only | page.tsx:3766 | channels live under `carveLaw = pen` | 1.3 |
| 103 | Desk azimuth, Desk elevation | desk camera | page.tsx:3793, :3796 | channels live under desk camera | 1.10 |
| 104 | Lying elevation, Stand az/el, Hold az/el | camera parks | page.tsx:3805-3820 | channels live. Stand dials only under the prior park; the gate says showing them elsewhere is the defect | 1.10 |
| 105 | Lying, Standing, Held | framing fill | page.tsx:3836, :3840, :3852 | channels live | |
| 106 | Overshoot, Wind-up depth, Wind-up length, Rise overshoot, Drift cut | rise curve | page.tsx:3868-3885 | channels live | 1.6 |
| 107 | Draw linearity | blends the draw toward constant speed | page.tsx:3889 | channels live. F96: the draw is 30x quieter than the rest of the beat | 1.1 |
| 108 | The pen's clock section | pen timing on the lab | page.tsx:3900 | never checked, not read past its heading | 1.1 |
| 109 | Compress, Hold tension, Release, Scale Y, Scale X | anticipation | page.tsx:4012-4025 | channels live. Hold tension was a known dead dial before, now in the sweep | 1.6 |
| 110 | Wobble | the hand's tremor | page.tsx:3092 | excluded from the sweep; never checked | 1.1 |
| 111 | Timeline dock: 12 clip bars, 24 drag handles, play, reset, preset, copy-out | retime the 12 phases by dragging | read off the live DOM by `docs/animation-toolset-map.md` §2.2; **file:line not found by this lane** | never checked by pixels. Map §2.2 says the tracks are film phases, never your strokes | 1.2, 1.6 |

## 11 · Export (complete, short)

| # | control | supposed to do | code | status | gate / eye |
|---|---|---|---|---|---|
| 112 | PNG, Video WebM / APNG, GLB exports and their settings | frame-locked export of the draw-in | viewport-3d.tsx:13733-13814, lib/export/frame-plan.ts | census did not press them, they download. `assert-export-plan` 12, `assert-export-encoders` 8 green 09-24 | never eyed |

---

## (a) Controls that look alive but draw nothing, or draw pixels nobody can tell apart

1. **The pen's tip, six pills on `/desk-doodles`** (row 32). At most 142 px of 2,073,600 differ from the shipped tip. `off` and `cut` are the same shape. F81.
2. **Motion mode "Off (static)" does not stop Material animation** (row 33). Material moves 9,683 to 12,273 px with the clock off. The Material toggle at style-panel-scaffold.tsx:479 lacks the clock line the other four toggles carry. Census finding 3.
3. **All 12 stack-animation presets from the app default** (row 74). 0 of 12 draw anything until a stack is composed, and nothing says so. Census finding 1.
4. **Freeze on complete** (row 67). It replaces the behaviour it exists to freeze: 3,306 → 0 px. Census finding 2.
5. **Align start / end at overlap 0** (row 16). The G2 arm is identical to the baseline. The pill still shows and still toggles.
6. **Natural vs Authentic past mid-draw** (rows 3, 4). 209 px at reveal 0.35, 0 px at 0.6, on the census drawing. The ± readout admits it; the two pills still look like a real choice.
7. **Shadow, lands / rides, on the hero panel** (row 99). F93 measured 0.90 s of frozen frame while the shadow readout walks 0 to 1. A 09-24 gate says otherwise; nobody has looked.
8. **Slow Weather fusion on the Burst drive** (row 75). RUN-QUEUE F3: alive on Loop, dead on Burst. Filed as his call.
9. **The Travel window's first and last frames** (row 20). Blank by construction, F95, and Looping Stroke ships on it, so every loop seam shows an empty page.
10. **Snappy Draw's last 2.4 s** (row 83). Five frames change 530, 333, 298, 56 and 0 px, a quarter of the preset's runtime. F94.
11. **The "Per-layer timing" category card** (row 37). It says every animated layer picks its own clock. Material has no clock control at all (row 46).

Suspects to measure, not yet proven: Order "Left to right" matching As drawn (row 12, may just be the test drawing); the four dither motions within 1,300 px of each other (row 55); Stack Drift Back, Whisper, Slow Breath, Hard Loop reading 0 under Independent in `clockgate.json` (row 74); `assert-material-craft` going from 13/13 to 6 red between 09-22 and 09-24 (row 38).

## (b) Features he asked for that do not exist yet

1. **An animation panel he can find before drawing anything.** Every draw-in control sits behind the small Timing button, which appears only after a stroke exists. Ledger 1.2 (9 times, last 09-24), F118 step 5.
2. **Keyframing, or any way to edit a single stroke's motion.** Ledger 1.2, 08-28: *"u never built our the full animation part of the app"*. `docs/animation-toolset-map.md` §3. Every control on `/` acts on the whole mark at once.
3. **Per-stroke flat and depth**, so each stroke pops solid at its own pen-up. `lib/hero-motion.ts:155-157` names the gap; map §6.3.
4. **A draw-in that writes like a hand**, measured against the two things he praised: the original Free Stroke 3D draw-in and the Desk Doodles draw-in. Ledger 1.1 (12 times), F118 step 3: 9 of 22 strokes shorter than the nib, every pen lift a fixed 60 ms, the hand squeezed 3.60x. Lane nightC has the pen lifts.
5. **A pen tip whose six shapes actually differ.** F81; only five distinct shapes exist, and none of them shows.
6. **A pen tip control on `/` at all.** Console only (row 31).
7. **A timeline for your own strokes.** The take timeline on `/` is read-only by his own pick (map §9 pick 3). The draggable dock exists only for the hero film's phases on `/desk-doodles`.
8. **A land shadow that draws.** F93: computed, timed, and rendered by nothing.
9. **Material timing like the other layers**, a clock and a delay (row 46).
10. **Camera moves with easing that make sense.** Ledger 1.10, no fix on record.
11. **A letter-by-letter turn he accepts.** Ledger 1.7, rejected 09-24.
12. **A style drawer that does not push the 3D view down by 441 px.** F110, filed, parked with the UI work.
13. **"Come up with some of ur own" animation toggles.** Ledger 1.2, 08-02. No record of which were proposed or kept.

## (c) The ten most visible animation features nobody has checked by eye

Film these first. Each one is on `/` except 10.

1. **The default draw-in on Play** (row 1). The first thing he sees and ledger thread 1.1, 12 complaints.
2. **The Family-14 presets, all five, played end to end** (row 83). One click each, and F94 already says two of them stall.
3. **Window modes Travel, Vanish and Shrink** (rows 20 to 22). The most kinetic thing in the product by G2's count, and Travel's blank seam loops in Looping Stroke.
4. **Stroke order, all five, with Unit set to stroke** (rows 9 to 13, 17). The letter-order question he keeps raising lives here.
5. **Ease and Cadence twos together** (rows 27, 28). The twos cadence is what the hero ships on; ledger 1.5 is jaggy motion, and twos can read as jaggy.
6. **Loop plus Reverse plus Delay** (rows 24, 29, 30). What a looping export actually looks like at the seam.
7. **Material animation, all five types, with Motion mode Off and On** (rows 33, 39 to 43). The loudest style motion, and the one that ignores Off.
8. **The Form: Shading and Turn on `/`** (rows 25, 26). Never measured on this route at all.
9. **Fusion Turn Table, Still Wet and Glitch Ribbon** (row 75). The three loudest things in the product, 54,000 to 58,000 px per half second.
10. **The hero beat's letterByLetter film on `/desk-doodles`** (rows 91, 96). He rejected it on 09-24; after nightB and nightC land it needs a before and after film.

---

## Not checked by this lane

- `lib/style-clock.ts`, `lib/stroke-schedule.ts`, `lib/pen-reveal.ts`, `lib/style-fusion.ts` and `lib/hero-motion.ts` were grepped, not read line by line. The six sync modes were not traced to their pixels.
- The hero timeline dock's source location (row 111).
- `ANIMATED_FUSION_PRESET_DEFS` at `lib/style-system.ts:4402` (row 89).
- The six fusion relationships G2 did not film: Signal Ink, ASCII Rubber, Scanline Balloon, Pixel Clay, Code Bloom, Formation, Whole Cloth. Still Wet is filmed but is not in the built-in list this lane read, so its source is unconfirmed.
- Why `assert-material-craft` went red 6 of 13 on 09-24.
- Why F93 and `assert-hero-live-shadow` disagree.
- `docs/STATUS.md` beyond its gate tables, and `docs/animation-port-audit.md` §2, which holds the hero lab's own measurements.
- Nothing was run, and no number here was re-measured on today's tree. Both measurement runs are from 09-05.

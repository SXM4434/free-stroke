# One animation panel, the flip, and his sequences on `/`: build plan, 2026-09-26

Read-only planning lane on main at `eb27a5860`. Nothing was run, no browser was opened, no code changed. Line numbers are from that sha; the coverage ledger was written at `95f724f87`, so some of its numbers have moved and the ones below were re-read.

**Short names.** page = `app/page.tsx` · lab = `app/desk-doodles/page.tsx` · vp = `components/viewport-3d.tsx` · scaffold = `components/style-panel-scaffold.tsx` · dtc = `components/draw-in-timing-controls.tsx` · strip = `components/stroke-strip.tsx` · lanes = `components/key-lanes.tsx` · hm = `lib/hero-motion.ts` · flat = `lib/flat-ink.ts`.

## The order

| rank | ask | how often he asked | effort | build it |
|---|---|---|---|---|
| 1 | One animation panel | 9 times | small to medium: move one block, lift one open flag, delete a popover | first, because asks 2 and 3 need somewhere to be offered |
| 2 | The flip, flat to solid, on `/` | 8 times (row 56) plus row 117 | medium: one pose function, one fold point, one control | second |
| 3a | 3D first | 4 times for the toggles | small once 2 exists: the flip run backwards | with or right after 2 |
| 3b | Desk Doodles' stagger | doc ask | small: a preset that writes delays | any time |
| 3c | Letter by letter | twice, the second furious | large: a letter map for his own strokes, a new turn, four gates, his eye | after 2 and 3a |
| 3d | Desk Doodles' landing spring | doc ask | large: a per-stroke transform after landing that the reveal can't do today | last |

The ruling behind all three: *"All of it lives in the main app on `/`, not only on the hero page."* (`docs/rulings/2026-09-25-animation-comes-back.md`). A grep of `docs/rulings/` for "letter", "flip", "3D first", "sequence" and "panel" finds nothing else; no ruling of his covers these three beyond that line.

---

## 1 · One animation panel

### What he said
- *"there's like no animation panel whatsoever"* and *"where's all that animation panel stuff bro"* (`docs/research-2026-09-25/animation-asks/REPO.md:43`, thinking 09-24:101, nine times).
- *"oh wait u never built our the full animation part of the app did u"* (coverage row 4).
- *"where tf are the toggles i had for the different type of animations"* (08-02, `REPO-2.md:264`).

### What is there today
Three places, and each holds part of it.

| place | what it holds | where |
|---|---|---|
| The dock under the canvas | the stroke strip (bars, Hold back, Perform, Ripple), the transport, the key lanes and the curve editor | the dock box vp:14369-14375, `LiveTakeTimeline` vp:14381, which renders `StrokeStrip` at `components/take-timeline.tsx:286`; the strip renders `PerformTake` strip:630 and `KeyLanes` strip:662 |
| The Timing popover, floating over the canvas from the transport | the draw-in controls | vp:14529-14573, renders `DrawInTimingControls` at vp:14559 |
| The Animation tab in the style drawer | the same draw-in controls, then Motion mode | tab def scaffold:199-204, `AnimationControl` case scaffold:3504, the dtc section scaffold:3004-3021 |

REPO.md:43 says the only way in used to be a Timing button that shows up after the first stroke. Whether the dock itself shows before a stroke was not traced.

### The call: the dock becomes the one panel, and the popover goes away
Everything animation lives in the dock, top to bottom:

1. A title row: **Animation**, same type as the drawer's section heading (`text-xs font-semibold`, scaffold:3007).
2. The strip, as today.
3. The transport, as today. The **Timing** button is renamed **Draw-in** and opens a section inside the dock instead of a popover.
4. The key lanes, as today, collapsible.
5. The Draw-in section: `DrawInTimingControls` in the drawer's `columns-2xs` box (scaffold:3015), moved out of the popover. The new flip and sequence picks from asks 2 and 3 go in this section.

With no strokes the dock still shows, and the strip row reads *"Nothing drawn yet. Each stroke you draw gets a bar here."*, matching the drawer's own empty line at scaffold:3012.

The drawer's Animation tab keeps what it renders today and gains one row at the top: *"Strokes, keys and Perform are in the Animation panel under the canvas."* with a button, **Show animation panel**, that opens the dock with Draw-in expanded and scrolls it into view. Its subline at scaffold:3013 changes from *"The same controls as Timing under the 3D view."* to *"The same controls as Draw-in in the Animation panel."* Motion mode stays in the drawer; it is a style field, the clock the style systems run on.

### Why move and not mirror
- **The strip and lanes read state that only the viewport has.** `LiveTakeTimeline` takes `progressStore`, `processedStrokes`, `seamWindow`, `openingRef`, `totalDuration` (vp:14381-14393); `KeyLanes` takes `lengthMs`, `playhead` and `freezeAxis` (lanes:506). Rendering them in the drawer means lifting all of that out of a 16,072-line file. The draw-in controls need none of it, which is why they already work in two doors.
- **A timeline belongs under the thing it plays.** The strip's own reference is Jitter (strip:12), and the ripple word is Final Cut's (strip:14). Both put the bars under the canvas, against the playhead.
- **The popover is the part that hid things.** Its cap had to be re-measured because its title landed at y = -10 on a 13-inch screen (vp:14530-14552). Moving its contents into the dock ends that class of bug.

**The case against.** The drawer is where the app keeps its panels, so a "panel" he goes looking for may be expected there, and the dock has a 55% height cap (vp:14365-14368) that the Draw-in section now competes for. The title row and the drawer's Show button are how this plan answers the first; the lanes' shared scroll region, which already gives first, answers the second. If he still can't find it, mirroring the strip into the drawer is the fallback, and it costs the lift above.

### Shared state
Nothing new is stored twice.
- `StrokeTakeContext` (strip:78-121): `take`, `commit`, `keys`, `setKeys`, `mode`, `penMs`, `strokeCount`, `selected`, `slotsRef`, `liveRef`. Provided at page:1790, closed at page:2553, so it already wraps both the drawer (page:2353) and the viewport (page:2487).
- The draw-in host state in page: `drawIn`, `revealWindow`, `revealEnvelope`, `flatten` (page:421), written by dtc through the props built at page:2364 (dtc header, dtc:12-16).
- **New, one field:** `animationPanel: { drawInOpen: boolean }` in page, passed to vp as a prop and to the drawer beside `drawInTiming`, so the drawer's button can open the dock. Today the popover's open flag lives inside vp, which the drawer can't reach.

### The controls, by `interface-style-details`
- **One radius per container (rule 4).** The strip's Hold back, Perform and Ripple are `rounded-md` (strip:610, :625, :647). Dtc's Shading pills are `rounded-full` (dtc:401-407). Once both sit in the dock, pick one: `rounded-full` for every text toggle, since dtc has more of them and Desk Doodles keeps fully round pills as a house constant (`docs/research/desk-doodles-register.md:115`). The square icon buttons in the transport (vp, Play at `h-7 w-7 rounded-md`) stay square.
- **One pressed fill (rule 6).** Hold back and Ripple press to `bg-foreground text-background`. Every pressed toggle in the dock uses that.
- **One material (rule 5).** The docked box is solid `bg-background` with `border-border` (vp:14372). The floating version's `bg-background/80 backdrop-blur-sm` stays only on the undocked path. Nothing glass goes inside the docked panel.

### Files
page (the new flag), vp (dock title, Draw-in section, delete the popover, always-on dock), scaffold (the Show row, subline), strip (radius), `components/take-timeline.tsx` (empty line). Dtc itself does not change.

### Gate rows, `scripts/verify/assert-animation-panel`
| row | passes when | must fail when |
|---|---|---|
| P1 | on a fresh `/` with 0 strokes, `[data-animation-panel]` is visible with the empty line | the dock is gated on `strokeCount > 0` |
| P2 | inside `[data-animation-panel]`: one strip, `[data-strip-perform]`, the lanes toggle, and dtc's Overlap, Window length, Delay before it starts and Turn controls | dtc is left out of the dock |
| P3 | no element with `aria-label="Draw-in timing"` positioned `absolute bottom-full` exists | the popover is put back |
| P4 | a change to Overlap in the drawer shows in the dock's Overlap on the next render, and back | the dock is given a local copy of `drawIn` |
| P5 | Show animation panel leaves the dock intersecting the window with Draw-in open | the button is a no-op |
| P6 | at 1280 × 800 with Draw-in open the canvas keeps at least 45% of the root, as `docs/verification/keyframes/dock-after.json` measured | the `max-h-[55%]` cap is removed |
| P7 | computed `border-radius` is equal across Hold back, Perform, Ripple and the Shading pills | one of them goes back to `rounded-md` |

Positive control: run the gate on `eb27a5860` before building. P1, P2, P3 and P7 must be red there, or the gate can't see what it polices.

### Needs his eye
- Whether the drawer tab keeps its copy of the draw-in controls or becomes the pointer row only.
- Whether "Animation" is the word he looks for on the dock.

### Risks
- The live lane `~/.fs-lanes/motioncustom` works on Customize, which is scaffold and `lib/style-system.ts`; `~/.fs-lanes/handdraw` is on the pen clock and the beat block in vp. This touches both files. Build after they land, or commit by pathspec.
- If the drawer and the dock can be open together, the draw-in controls show twice on one screen. Not traced; the layout of the drawer against the canvas was not read.
- `docked` is off in compare-3-up, capture and chromeless (vp:13836). The panel stays hidden there, which is right for capture; the gate must not count those modes.

---

## 2 · The flip, flat to solid, on `/`

### What he said
- *"teh aniamtion needs to traition in acool way lke teh flip orbetetr from teh 2d flat text to teh 3d"* (07-29 17:35, `TRANSCRIPTS.md:94`)
- *"it just dollys side to on teh letter and loosk weird as fuck ... the flip was basic but solid finduation i wnated u to psuh furthr"* (07-30 04:34, :98)
- *"it does s a mroph from 2d to 3 dstill way worse form ethd ecent flip we had"* (07-30 05:45, :99)
- *"HARD TO TELLL IT WENT FRO  2D TO 3D"* (his eight-times ask, `TRANSCRIPTS.md:212`)

### Where it lives
- The curve: `ddFlipEase = cubicBezierEase(0.45, 0, 0.2, 1)`, hm:2167, ported from Desk Doodles' card flip (hm:2154-2166).
- The turn law: `turnPhase` hm:2327 and `turnPose` hm:2355, both private to hm. The 87% breakdown is noted at hm:1535.
- The lab feeds it to the viewport as a `FlatState` each frame: `ink`, `depth`, `yaw`, `pitch`, `shade`, `shadow`, `squashX/Y` (lab:2031-2062). `FlatState` is flat:2338, `SOLID_STATE` flat:2669.
- On `/`, `flatten` is a still value (page:421) that dtc's Shading pills set to 0 or 1 (dtc:398-407). Nothing on `/` moves it over time except Depth and Turn keys.

### The board
K1, **THE DRAWING.** The draw-in has finished. Flat ink, camera parked dead-on, nothing moving. Exists so the pen visibly stops before anything else happens; a flip that starts on the pen's last frame reads as the pen's overshoot.
K2, **THE EDGE.** The mark edge-on at yaw 90°, a sliver. The face swaps here: ink before, lit solid after. Exists because this is the moment, the one instant with a real before and after. Two frames, never one.
K3, **THE OBJECT.** Lit solid, landed at a three-quarter angle, held. Exists so the viewer can see it is solid, which is his complaint: it has to be obvious that it went from 2D to 3D.

Breakdown: the half-way pose lands at about 87% of the move on `ddFlipEase`, not the midpoint. The turn law is already non-linear, so do not add a second ease on top.

Exposure sheet, 30 fps. Start values; his eye sets the lengths.

| frames | shot | notation | note |
|---|---|---|---|
| 10 | K1 hold | ───── | pen stopped, zero motion |
| out-turn | K1 to K2 | ∿ | flat ink turning, shaded by `turnShade` |
| 2 | K2 | ✕ | edge-on dwell, face swap |
| in-turn | K2 to K3 | ∿ | lit solid landing on `ddFlipEase` |
| 15 | K3 hold | ───── | nothing moves |

Out-turn plus dwell plus in-turn start at 18 frames, the lab's letter turn with its dwell included (hm:1673), since it is the only turn length already measured in frames.

### The wiring, smallest version
1. **Move** `turnPhase` and `turnPose` out of hm into a small module, `lib/flip-pose.ts`, that hm imports back, so there is one copy of the law. Add `flipPoseAt(clockMs, flip)` returning `{ ink, depth, yaw, shade, shadow }`, with `flip = { on, direction: "flatToSolid" | "solidToFlat", startMs, turnMs, dwellMs, landYaw }`.
2. **Store** `flip` in page beside `flatten`, off by default, written through the same `edit()` path as the take so ⌘Z reaches it (strip header, strip:19-22).
3. **Fold** it at the one place the pose is read each frame, vp:6551-6567. Today the order is host pose, then keyed depth and turn, then the dev override. The flip goes between the host pose and the keys:

   `host flatten` then `flipPoseAt(clock)` then `keyed depth/turn` then `dev override`

   The clock is the one `keyReader.sample()` already reads (vp:6556), so scrub, loop and export see the same frame.
4. **Offer** it in dtc under Shading: a row of pills, **Off · Flat to solid · Solid to flat**, and a Start pick, **When the draw-in ends** (default) or **At the playhead**. It then shows up in both doors for free.
5. **Show** it on the strip as one marker after the last bar, so its timing is visible. Dragging it is later work.

### How it composes
- **Keys win per channel.** A Turn key overrides the flip's yaw and a Depth key its depth, which is the fold order that already exists. The flip still owns `ink`, which no key can set (`KeyProperty`, `lib/keyframes.ts:41`, has no ink). Dtc shows one line when a key overrides it: *"Turn keys override the flip's turn."*
- **The timeline.** `startMs` "when the draw-in ends" is read off the same schedule the strip lays out (`buildTimedSchedule`, strip:23-24), so Hold back or a dragged bar moves the flip with it.
- **Export.** A grep of `lib/export/` for `flatten`, `keyReader` and `clockMs` found nothing, so how export reaches the frame loop was not traced. Gate F6 has to prove it before this ships.

### Files
new `lib/flip-pose.ts`, hm (import the moved functions), page (state), vp (fold at :6551, pass the flip in), dtc (the pills), strip (the marker).

### Gate rows, `scripts/verify/assert-flip-slash`
| row | passes when | must fail when |
|---|---|---|
| F1 | flip off: the pose at 60 clock points equals today's, value for value | the flip defaults on |
| F2 | flip on: exactly 2 frames at yaw 90° ± 1°, silhouette width under 5% of rest, ink 1 before them and 0 after | the flip is swapped for a cross-fade, ink ramping with yaw held at 0 |
| F3 | the half-way pose lands between 85% and 89% of the out-turn | the ease is linear, which lands it at 50% |
| F4 | the drawing's centre moves under 1 px across the flip while its width changes | it turns about the origin instead of the drawing's pivot |
| F5 | with a Turn key, yaw equals the key at every frame and ink still flips | the flip is folded over the keys |
| F6 | the pose at clock t in the live view equals the exported frame at t | the flip reads `performance.now` instead of the transport clock |
| F7 | at least 10 frames of zero motion between the pen's last frame and the out-turn | the flip starts on the pen's last frame |

### Needs his eye
- The turn length and the landing angle on his own drawings. The lab's numbers were tuned on the traced word "Desk Doodles".
- What the flip does in 2D. He said *"but remmber that was for 3d we ned it to work for 2d and 3d as well"* (07-31 21:27). This plan builds it in the 3D view, where flat ink is a state of `flatten`; the 2D canvas was not traced.

### Risks
- Taking two functions out of a 4,284-line file the lab depends on. `assert-hero-options` and the lab films must stay green with the import swapped.
- Arbitrary drawings have no tuned pivot. F4 decides whether the drawing's bounding-box centre is good enough.

---

## 3 · His sequences on `/`

### What he said
*"ALOS I WANT AOPTIONS FOR DIFFRENET ANIMTIOSN I HAVE A FEW IDEAS TO STAT ONE TAT DRAWS IN THE 2D AND 3D,, ONE THAT STARTE WITH THE 3D AS FIRST , OBE THAT FLIPS LETTER BY LETTER AFTER ALL OF THEM AR DRAWN, AND THEN FOR THAT ONE U HAVE A 2D FIRST VERIOSN 3D FRIST VERIOSN AND A VERIOSN BITH 2D A DN 3D VERIOSN"* (08-01 14:55, `TRANSCRIPTS.md:83`)

*"recreating will nevr fele right diecet usuage alway will"* (coverage row 8)

### Where each lives today
| sequence | where | reaches `/`? |
|---|---|---|
| Draws in 2D and 3D | today's draw-in on `/` | yes, nothing to build |
| 3D first | `HeroShape` `"solidFirst"` hm:197, sheet hm:1774, `solidFirstForm` hm:3111, picked in `sampleForm` hm:3186; lab pill "solid first" lab:3156 | no. RQ:429-430 cut it without him (`REPO-2.md:182`); the 09-25 ruling voids that |
| Letter by letter | `"letterByLetter"` hm:302, sheet hm:1938, `sampleLetters` hm:2745, `letterFlip` hm:2682, the pivot glide `LetterState.settle` hm:2489-2535 and `letterSettle` hm:2717, defaults hm:1655-1680; per-letter channels on `FlatState.letters` flat:2642; the lab's letter map lab:1681, passed to vp at lab:2646 | no |
| Landing spring | Desk Doodles repo, `src/app/components/DeskDoodles/DeskPage.tsx:2728-2737`: `dd-land`, scale 0.92 at 0%, 1.015 at 62%, 1 at 100%, opacity 0 to 1, 360 ms `cubic-bezier(0.22, 1, 0.36, 1)`; reduced motion keeps the fade and drops the scale | no |
| Stagger, 40 to 60 ms | `docs/research/desk-doodles-register.md:99-116` only. No stagger code was found in the Desk Doodles repo by grep | no |

Worth knowing before building the last two: in Desk Doodles the spring is **a doodle landing on the desk** and the stagger is **a gallery loading**. Neither is a stroke being drawn. Putting them on strokes is this plan's reading of *"direct usage"*, not something he said.

### 3a · 3D first, the smallest wiring
Once ask 2 exists, 3D first is the flip with `direction: "solidToFlat"` and the draw-in set to reveal the lit solid. K1 is the object, lit and held, the lab's *"form that is simply there"* (hm:3563). K2 is the edge. K3 is flat ink, the drawing. One more pill in the sequence row, no new motion code.

### 3b · Stagger
A **Stagger** preset in the strip's row that writes each stroke's `delayMs` so starts fall 50 ms apart (40 to 60 allowed), through `commit` so it is one ⌘Z. It uses the take that already exists; no schedule change.

### 3c · Letter by letter, and what has to change first
**His words.** *"The letter-by-letter is complete garbage, bro. The way they turn is awful letter by letter, and the way they turn and then overlap into the next letter is so dog shit."* (09-25 01:17, `docs/thinking/2026-09-25.md:1027`; `docs/hero-defects-2026-09-24.md:46` logs the same message at 09-24 21:17, the other clock). The same message goes on to *"these artifacting things, these white spots"*. Earlier: *"they dont go letter by letter, some go multiple at a time"* (hero-defects:50), and 08-04, *"look how the [mesh] gets fucked on letter by letter"* (hm:2504).

That is three objections: the turn, the overlap, and more than one letter moving at once.

**What the code does, and why it overlaps.** Each letter turns about its own centre for the first half of its flip, then its pivot glides to the word's axis across the second half (`letterSettle`, hm:2717) and it lands at a shared 30° (`letterLandYaw`, hm:1666). Landing about the word's axis at 30° moves a letter sideways by 13.4% of its distance from that axis (the arithmetic is in hm:2519-2524). For a letter left of the axis, that move is to the right, into the next letter, which has not turned yet and still sits where it was drawn. The camera is affine when `flatten` is passed (vp:10865), so the depth move doesn't show; only the sideways slide does. **Derived from the code's own arithmetic, not measured.** The controller's 09-24 film also shows the word squeezing to about half its width in `returnTurn`, frames 1085 to 1115 (hero-defects:33-35), which the code says should be one rigid word (hm:2766-2772). Those two can't both be true; the lane measures first.

**More than one at a time.** The first letter's flip is 18 frames (`letterFlipSec`, hm:1673) and the beat between letters is 14 (`letterBeatSec`, hm:1671). Unless the lead (`letterLeadSec`, hm:1669, 20 frames) pushes the second slot out, the first two letters turn together for 4 frames. `slotStartSec` was not traced.

**The change, before it ships on `/`.**
1. Every letter flips about its own centre and lands **facing front**, yaw 0, the Desk Doodles card flip: turn to the edge as ink, swap, come back to 0 as solid. At yaw 0 the pivot doesn't show, so there is no seam and no glide. `settle` leaves the cascade.
2. The beat is never shorter than a flip, first letter included. One letter moving at a time.
3. When the last letter has landed and held, the **whole word turns as one** to the three-quarter angle about the word's axis. That is what shows it is solid, and one pivot means no seam.
4. The return stays as it is, everything home together (hm:2754-2775).

**The board.**
K1, **THE WORD, DRAWN.** Every letter flat ink, dead-on, still.
K2, **THE FIRST EDGE.** Letter one edge-on; its neighbours untouched. 2 frames.
K3, **HALF AND HALF.** The first few letters lit and facing front, the rest still ink. The frame you could print: half drawing, half object.
K4, **ALL LIT, HEAD-ON.** The last letter lands. Held long enough to read as stopped.
K5, **THE WORD TURNS.** One rigid turn to the three-quarter, on `easeOutStrong`.
K6, **HOME.** The return.

K4 to K5 needs a real stop, or the word's turn reads as the last letter overshooting.

**Wiring to `/`.** A **Letter by letter** pill in the sequence row. It needs a letter map for his own strokes. The lab builds one from the traced word (lab:1681); on `/` it has to come from the draw-in units dtc already counts (`drawInUnitCount`, dtc:62). Whether the lab's builder accepts arbitrary strokes was not traced. The per-letter uniforms in vp (vp:2886-3100) were built for the lab word and have to be checked on hand-drawn strokes.

His three variants, 2D first, 3D first and both, come after the single version passes his eye.

### 3d · The landing spring
Each stroke, or letter group, scales 0.92 to 1.015 to 1 over 360 ms about its own centre when it lands, with the `dd-land` curve, and reduced motion drops the scale. It needs a transform per stroke after it lands, which coverage row 54 says the reveal can't do today (`lib/style-system.ts:4656-4663`, not re-read here). That makes it the biggest single piece of work in this plan and the one with the weakest ask behind it. Last.

### Files
hm (`letterFlip` landing at 0, `settle` out of the cascade, a whole-word turn phase), `lib/flip-pose.ts` (from ask 2), page (sequence state), vp (the fold, the per-letter path on `/`), dtc (the sequence pills), strip (the Stagger preset), the lab's letter map at lab:1681 or a copy of it moved to `lib/` so both pages import one.

### Gate rows, `scripts/verify/assert-sequences-slash` and `assert-letter-turn`
| row | passes when | must fail when |
|---|---|---|
| S1 | pills Draw in, Flip, 3D first, Letter by letter are inside `[data-animation-panel]` | one is hidden |
| S2 | 3D first: frame 0 has ink 0, the last frame ink 1, and there is exactly one edge moment | it runs forward |
| ST1 | Stagger writes start times 40 to 60 ms apart, read from `__fsTake.get().slots` | the delays are 0 |
| L1 | at every frame, at most one letter is mid-flip | the beat is set shorter than the flip. Expect red on today's defaults; if it is green there, read `slotStartSec` before trusting it |
| L2 | at every frame, each letter's ink box overlaps its right neighbour's by no more than at rest, plus 1 px | the `settle` glide is put back |
| L3 | the word is never narrower than its rest width times the cosine of the word's turn, minus 2 px | letters turn on their own axes during the word's turn |
| L4 | `assert-letter-seam` stays green | a letter lands at a non-zero yaw about its own centre |
| L5 | no paper-coloured pixels inside the word's filled outline beyond what rest has | the per-letter pivots come back at a shared yaw |
| SP1 | a landed stroke's scale reads 1.015 ± 0.003 at 62% of 360 ms and 1.000 at the end; under reduced motion it stays 1 | there is no spring |

L2 and L3 are the rows that would have caught what he saw. `assert-letter-seam` went 20/20 and `assert-hero-options` 41/41 while it was on screen (hero-defects:86-91), because neither looks at overlap or width.

### Needs his eye
- Letters landing head-on and the word turning as one, against each letter landing at 30°. This plan recommends the first; the lab chose 30° for "wooden type on a shelf" (hm:281).
- What *"STARTE WITH THE 3D AS FIRST"* means. This plan reads it as solid first, ending on flat ink, which is the lab's `solidFirst`. The other reading is the 3D drawing in before the 2D.
- Whether a stroke should spring at all. Desk Doodles' own table calls its motion *"weighted calm"* and says *"paper doesn't bounce"* (register:101).

### Risks
- `~/.fs-lanes/handdraw` holds the pen clock and the beat block in vp. The letter path runs through the same frame loop. Wait for it.
- A letter map from draw-in units can group strokes that are not a letter. The lane has to show L1 to L3 on a hand-drawn word, not only on "Desk Doodles".
- Changing `letterFlip` changes the lab film too. Either the lab takes the new turn, which is what his complaint asks for, or the lab keeps a flag for the old one. Don't let the two drift.

---

## Production notes
- Lanes live now: `~/.fs-lanes/motioncustom`, `~/.fs-lanes/handdraw`. Ask 1 touches scaffold and vp; ask 3c touches vp's frame loop. Commit by pathspec: `git add <paths> && git commit -m "<msg>" -- <paths>`.
- Every gate row gets its must-fail run on purpose and recorded, and the panel gate's positive control runs on `eb27a5860` first.
- Not traced here: the drawer's position against the canvas, the export frame path, `slotStartSec`, the lab's letter-map builder, `lib/style-system.ts:4656-4663`, and Desk Doodles' own `FLIP_MS` (`DeskDoodlesHome.tsx:672`).

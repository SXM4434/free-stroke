# Hero beat defects, 2026-09-24

Four things Sebs named tonight about the hero beat, what he has said about each since July, where
each lives in the code as far as this lane got, and what a fix has to look like to him.

**This file is unfinished, and here is exactly where it stops.** The lane hit the 150k context line
after mining his words and reading the per-letter turn code. The white spots, the "s" and the
write-in are not yet mapped to code: each section says what is known, marks every guess as a
guess, and names the next file to open. "Next step" at the bottom is the handoff.

The film this is written against: `docs/verification/hero-beat-film/2026-09-24-look/frames/NNNN.png`,
1308 frames. Phases by frame: draw 0-462, breath 463, anticipation 573, emerge 603, land 695,
solid 725, tilt 785, standup 803, orbit 932, descend 1020, returnTurn 1060, hold 1146. I did not
open the frames myself. The frame numbers and what is in them come from the controller's brief.

## Where his words came from

- `docs/thinking/*.md` in this repo, 2026-08-07 to 2026-09-24. Agent hand-backs are stripped out.
- `~/.claude/thinking/general/2026-07-*.md` and `2026-08-0*.md`, for the July and early August
  sessions that ran in this repo before the local log existed. Sessions `5071f9d6` and `a04ad079`
  were checked against their transcripts: both ran with cwd `~/Desktop/Projects/free-stroke` or
  `~/free-stroke`, so their quotes are about this app.
- User messages in `~/.claude/projects/-Users-sebs/*.jsonl`, 47 files. That sweep returned only 6
  hits, and it missed the 2026-08-04 quotes that the journals hold, so treat it as partial. The
  journals are the record here.
- `docs/rulings/` (9 files) and `docs/RUN-QUEUE.md` (5969 lines, read by heading and by grep, not
  line by line).

---

## 1 · Letter by letter: each letter turns on its own axis and they pile into each other

**What the film shows (controller, by eye).** In returnTurn, about frames 1085 to 1115, each letter
turns on its own axis. The word squeezes to about half its width with letters overlapping, then
snaps back.

**His words, in order.**
- 2026-07-31 12:53, portfolio session `2e61417c`, so possibly about the portfolio hero and not this
  app: *"ARE YIUR TREATING EACH BEAT AS ITS OWN TEXT ELMENT ASSHOEL WTF ARE U DOING ITS ALL ONE
  THING FUCKKK"*
- 2026-08-04 15:58, `5071f9d6` (this app), `~/.claude/thinking/general/2026-08-04.md`: *"non of
  the herp stuf id fixed and look ho th e,shed gets fucked on letter by letter"*
- 2026-08-20, recovered, `5071f9d6`, `docs/thinking/2026-08-20.md`: *"also the letetr by letetr is
  muddy and teyy dont goletetr by letet rsime go multiple at a times  like it flips so ugly an
  ddurpt and feel like artifcating happens"*
- 2026-09-24 21:17, `docs/thinking/2026-09-24.md`: *"The letter-by-letter is complete garbage,
  bro. The way they turn is awful letter by letter, and the way they turn and then overlap into the
  next letter is so dog shit."*

**What he asked for, in his words.** One letter at a time, not several: *"they dont go letter by
letter, some go multiple at a time"*. No overlap into the next letter. And from 07-31, if it
applies here, the word reads as one thing.

**What was tried.**
- 2026-08-04 onward: whole-triangle ownership (`ownTrianglesWhole`) so no triangle is shared by two
  letters. `assert-letter-seam` went 20/20 on 2026-08-25, "0 of 148 060 triangles span two
  letters", "every landed letter turns about ONE axis" (`docs/RUN-QUEUE.md:57-72`).
- The `settle` channel, `lib/hero-motion.ts:2454-2497`: each letter turns about its own centre for
  the first half of its flip, then its pivot glides to the word's axis, and on the return it is
  "pinned at 1", so all letters unwind as one rigid word.
- `letterPairFrom` was set to −1 so no beat flips two letters at once
  (`lib/hero-motion.ts:1662-1663`). That is the direct answer to his 08-20 "multiple at a times".
- F37, F44, F45 (08-28): the cascade clip length is now derived from the letter count
  (`cascadeClipSec`, `lib/hero-motion.ts:2592`) instead of a typed 160 frames.

**Why it did not hold.** Not recorded as measured. The code comment says the return is one shared
pivot, and the controller's film says each letter turns on its own axis in returnTurn. Both cannot
be true of the same picture. **Guess:** either the renderer does not read `settle` on the return, or
the phase the controller saw as returnTurn is still carrying per-letter yaw from the cascade. The
next file to read is where `components/viewport-3d.tsx` applies `LetterState.settle` and `yaw`.

**The mechanism, for a designer.** Picture each letter as a card standing on the table. A card
spun about its own middle gets narrower in place, and gaps open between cards. Spin all the cards
about one shared line and the whole word narrows together like one sheet. The code's own comment
(`lib/hero-motion.ts:2462-2480`) proves this with arithmetic: two letters at the same angle but
different pivots drift apart by 13.4% of their spacing sideways and 50% in depth at 30°. When the
pivot then slides from "own" to "shared" partway through, the letters slide sideways to meet it,
and that slide is a likely source of the overlap. Guess, not measured.

**Proposed fix.** Measure first: log each letter's pivot and yaw per frame across 1060 to 1146 and
put them next to frames 1085 to 1115. If the return really is per-letter, turn the whole word as
one object for returnTurn and keep per-letter motion only in the cascade, one letter per beat.
**What it must look like to him:** one letter turning at a time, never two, never touching its
neighbour, and at no frame a word narrower than the turn explains.

**Gates that passed while this was visible.** `assert-letter-seam` (20/20) checks that no triangle
spans two letters and that landed letters share one axis. It says nothing about the return, and
nothing about whether two letters overlap on screen. `assert-hero-options` (41/41) checks clip
lengths and frame counts, not how the letters look. F96 (`docs/RUN-QUEUE.md:4559`) measured
returnTurn collapsing the word "to 1.6%" and called it a good moment, a gate reading the defect as
the feature.

**Locked ruling at risk.** None found that forces per-letter on the return. The cascade itself
("board §4 O5", one flip per letter) is the storyboard's design; changing the cascade, rather than
the return, would reopen it, and that is his call.

---

## 2 · White spots

**What the film shows.** White specks inside both "e"s and a white bar at the bottom-left of the
"D" in Doodles on the resting frames 1130 and 1250. White ghost outlines trailing the left edges of
D, o and l during returnTurn (1115). A white sliver through the "l" at emerge (640).

**His words.**
- 2026-08-02 16:19, `5071f9d6`: *"THE 2D DRAWIN ANIMTION LEAVES BLANCK SPORTS"*
- 2026-08-04 12:11, `5071f9d6`: *"there like artifcats that appear ahead of hwere the stroke i
  anmaitinga n if a a letetr covers anoteh rlike the d ove ro its leave part of the o jst like earses
  us see like the o shuuld still be fully drawn but its edge doenst get dorn on thhta side"*
- 2026-08-20, recovered: *"tej artofacting when drawing inad letetr piecees misisng stil happnes"*
- 2026-08-28 17:57, `docs/thinking/2026-08-28.md`: *"Still see lots of artifacts looks at these
  white spots in teh strokes ashsole"*. ⚠ Five minutes earlier he asked about looking at the Desk
  Doodles surface, so this one may be about Desk Doodles. Not settled.
- 2026-09-24 21:17: *"shit still has these artifacting things, these white spots."*

**What was tried.** N8, 2026-08-28, `52ed28a4` to `239414b3`: nine accidental pen taps shorter than
the nib removed, which killed the black almond on the "D" stem (`docs/RUN-QUEUE.md:1283`). That fixed
a black blob, not white spots. The seam work in section 1 found, in its own words, *"a white crack
straight through the `e|sk`, the `d|l` and the `e|s` joins"* (`lib/hero-motion.ts:2465-2467`), and
the shared pivot was the fix for that crack.

**Why it did not hold.** Not recorded. Nothing in the queue measures white pixels inside the ink on
a resting frame.

**The mechanism, as far as known.** Two kinds, and they probably have different causes.
- White ghosts and slivers while turning: **guess**, paper showing through where two letters have
  moved apart, the crack the code comment describes, returning whenever letters do not share one
  pivot. That ties this defect to section 1.
- White specks on the flat resting frame: **guess, not read.** Candidates from the brief, none
  checked: the flat ink layer and the 3D solid drawn at once with the solid's back faces or edges
  lighter than the ink, a crossfade that never reaches 100% ink, or two meshes at the same depth
  flickering through each other. Next file: how the resting frame composites the flat-ink layer
  (`lib/flat-ink.ts`) over the solid (`components/viewport-3d.tsx`).

**Proposed fix.** A paired check first: the resting frame against a frame of the flat ink alone,
counting pixels lighter than the ink inside the ink's own outline. That count is zero when it is
right. Then fix the layer that puts them there. **What it must look like to him:** solid black
letters with no light spot anywhere inside them, at rest and while turning.

**Gates that passed while this was visible.** `assert-drawin-attrs` (19/19) counts how much ink
there is (24 161, 25 098, 25 785 px). A speck inside a letter barely changes that total, so the gate
cannot see it: a ratio that "cannot see a counter close", `one-system` §4.5. `assert-letter-seam`
counts triangles, not pixels.

---

## 3 · The "s"

**What the film shows.** The "es." ending reads as a squashed zigzag fused with the period.

**His words.** 2026-09-24 21:17: *"There's a weird fucking way the S is made, and it is fucking
god-awful at the end."* No earlier quote about the "s" by itself was found. The nearest is 08-28:
*"two taps were bridging the `s` to the `k`"* in the queue (`docs/RUN-QUEUE.md:1522`), which is a
lane's finding, not his.

**What was tried.** N8's stub filter changed the letter count from 10 to 11 because two short taps
had joined the "s" to the "k" (`docs/RUN-QUEUE.md:1521-1522`). Nothing aimed at the shape of the
"s" or its separation from the period was found.

**The mechanism.** Not mapped. **Guess:** the traced strokes for "s" and "." come from one source
(possibly `scripts/capture/logo-strokes.json`, not opened), and either the period is part of the
"s" stroke or it sits close enough that the nib's width fuses them. The zigzag look suggests the
"s" is drawn from too few points, so its curves become corners. Next step: print the "s" and "."
strokes' point counts and gaps from the stroke source.

**Proposed fix.** Draw the "s" as one smooth curve with enough points that no corner shows at 1x,
and keep the period its own letter with a gap wider than the nib. **What it must look like to
him:** an "s" you read as an "s", and a period that stands apart from it.

**Gates that passed.** None found that checks letter shape. `assert-hero-word-legible` exists
(F39) but was not read.

---

## 4 · The write-in

**What the film shows.** Frames 0 to 462. His read: *"The lettering doesn't write in when you write
them in."*

**His words.**
- 2026-07-31 17:22, `a04ad079`: *"also teh drawing in naimtion is god awful fpr 2d we have such a
  beatiful ssytem that draws them in 3d in the free strek app ... teh hwoel reason im usuing the
  free stroke ap was for its drawing anaimtion of strakes"*
- 2026-08-01 10:55, ruling (`docs/rulings/2026-08-01.md`): *"THE SPECILA DRAIWNG ANAIMTION IN DESK
  DDDOELS ITS A LOT BTTER"*
- 2026-08-02 16:19: *"STSILL DOES THE SAME STUPI SWEEAP REVEAL AS IF ITS REVRSERE EARSING WHER TEH
  FUCKING ELEGANT DRAWING ANAIMTION LIKE AS IF SOME IS DRAWING IT THAT IV BEEN ASKING FOR DAYD"*
- 2026-08-28 01:44, `docs/thinking/2026-08-28.md`, about Desk Doodles: *"teh way it wrieys in is
  ass still"*
- 2026-09-24 21:17: *"The lettering doesn't write in when you write them in, and they don't animate
  well."*

**What he ruled.** 2026-08-01: Desk Doodles' draw-in is the benchmark, and the sweep reveal is
rejected. 2026-07-31, his own open risk: *"the free stroje naimtion was for 3d strokes we dont know
if woek son 2d stuff"*.

**What was tried.** R1, `c4c7632f`, `docs/research/write-on-timing.md`: the velocity model was
already right (22 of 22 strokes have a real speed peak), but 9 of 22 strokes were shorter than the
nib, all 21 pen lifts were a fixed 60 ms, and 6 of 21 pen-downs were out of order
(`docs/RUN-QUEUE.md:917-988`). N8 removed the nine stubs. F31: the hero compresses the hand 3.60x,
so the shortest stroke runs 66.9 ms against a 100 ms floor. Whether the lift timing and pen-down
order were fixed was not checked here.

**Why it did not hold.** Not recorded. F96 measured the draw at "30x quieter" than the rest of the
beat, 741 changed pixels a sample (`docs/RUN-QUEUE.md:4566`), which fits "doesn't write in".

**The mechanism.** Not mapped in `lib/stroke-schedule.ts` or `lib/pen-reveal.ts`. **Guess:** the
3.60x squeeze plus the fixed lifts make the pen move too fast to read as a hand, so the word appears
rather than being written.

**Proposed fix.** Start from R1's single recommended change (`docs/RUN-QUEUE.md:980`, not read in
full here), stop squeezing the hand below its 100 ms floor, and compare frames side by side with
the Desk Doodles draw-in, his benchmark. **What it must look like to him:** *"as if someone is
drawing it"*, one pen, in order, at a speed you can follow.

**Gates that passed.** `measure-drawin-pacing` passes `velocity-bell` 22/22, which proves each
stroke has a speed peak and says nothing about whether the whole word reads as written.
`assert-drawin-timing` fails under load and passes alone (F108), so it cannot be trusted either way.

---

## 5 · The grading gap he named

His words, 2026-09-24 21:21: *"You gotta look into our harness. There needs to be things for
grading, for evaluations, all this other stuff that makes our grading and our checking airtight."*
And 21:26: *"Your work was a month ago ... No change whatsoever. Everything looks equally as shit,
smeared all over the place."*

**What exists.** 104 of 113 gates green on 09-24 (`docs/RUN-QUEUE.md:5914`). They count triangles,
ink pixels, clip lengths and speed peaks. The `pairwise-visual-judging` skill exists: judge two
frames against a locked reference, never a score. One cold A/B was run on 2026-08-28 for the "D"
stem (`docs/verification/mark-2026-08-28/AB-stubs-Dstem.png`). The queue itself says, on 08-25:
*"A green gate is not his eye. ... F1 stays `NEEDS EYE`."*

**What is missing.** No frame he approved is stored as the reference, so no check can compare
against what "right" looks like to him, and nothing checks the four things he named: letters
overlapping, light pixels inside ink, the shape of a letter, and whether the draw reads as written.
The fix is a small set of reference frames he picks, one per phase, and a paired check per defect
(this frame against its reference, or against the flat ink alone), with each check first shown to
fail on today's film.

---

## Order to fix

1. **Build the four checks and show each one failing on today's film.** Without that, a fix is a
   claim, and a month of green gates is what that got.
2. **Letter by letter and the turning white ghosts together.** Both likely come from letters not
   sharing one pivot, so one measurement settles both.
3. **The white specks on the resting frame**, once the layer that paints them is found.
4. **The "s"**, from the stroke source.
5. **The write-in**, last because it is the biggest and R1 already mapped most of it.

## Next step, exactly

Not done by this lane, in order:
1. Find where `components/viewport-3d.tsx` reads `LetterState.settle` and `yaw`, and check whether
   returnTurn really pins `settle` at 1 on screen.
2. Find how the resting frame layers `lib/flat-ink.ts` over the solid, for the specks.
3. Open the stroke source for "s" and ".", possibly `scripts/capture/logo-strokes.json`.
4. Read `lib/stroke-schedule.ts` and `lib/pen-reveal.ts` for the lift timing and the 3.60x squeeze,
   and R1's recommendation at `docs/RUN-QUEUE.md:980`.
5. Open frames 640, 1085, 1100, 1115, 1130 and 1250 and confirm the controller's read by eye.

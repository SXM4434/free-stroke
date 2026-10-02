# The animation port audit

**Re-measured 2026-09-04, lane B2, against today's tree.** First written 2026-08-28 by lane E2
(`cb8f8bd3`). E2's own ledger said *"I did not drive the UI."* I drove both routes. **Ten of its
rows are stale and §0 says which one closed each.** The rest of the document is new.

> *"the desk doodles animation tool we have was also meant to help figure out what we should
> bring over from it into the actual app"*
> *"the desk doodles [surface] animates the Desk Doodles logo"*

**The second sentence is the whole question.** The lab makes a wordmark animate. So the port list
is not "which of the 53 lab controls come over". It is **what has to move before the product can do
that to the drawing you made.**

---

## 0 · What was stale in E2's version, and what closed it

E2 wrote this at 18:01 on 08-28. `262ecf0d` landed 33 minutes later and took out its sharpest row.
Six commits since then took out four more.

| E2's row | Now | What closed it |
|---|---|---|
| Claim 10 / **P1**: *"The draw-in you just authored does not survive a reload."* | 🟢 **CLOSED** | `262ecf0d` + `708a38d9`. `lib/doc-store.ts` now persists `drawIn`, `revealWindow`, `revealEnvelope` and `penTip`, each coerced against its own union. Find by text: `const drawIn: DrawInParams`. |
| **P2 / D2**: *"Six dead pills in the preset rail"*, all `implemented: false` | 🟢 **CLOSED for five** | `6eb19499`. Authentic Draw, Smooth Reveal, Snappy Draw, Slow Gel and Looping Stroke each carry a full `motion` patch in `GEOMETRY_ANIMATION_PRESET_DEFS`. Completion Pulse is still `implemented: false` and now says why on the pill instead of saying "soon". |
| **D1**: the Animation panel's Geometry card said easing, loop and reveal *"come later"* | 🟢 **CLOSED** | `44310c94`. The card is `state: "active"` and names the real control. |
| **D4**: *"Five debug controls ship to users unguarded"* | 🟢 **CLOSED** | `262ecf0d`. `debugSurfaceAllowed = process.env.NODE_ENV !== "production"` gates the whole block, and `scripts/verify/assert-debug-surface-fenced.mjs` holds it. |
| **Gap 11**: *"See the timing. No track list, no time axis."* | 🟢 **CLOSED** | `c6cddb2b` + `0a4fe050`, lane B1. `components/take-timeline.tsx`, 481 lines, one bar per unit of your own drawing. |
| **P6 / §2.1**: the pen tip picker, *"the engine already ships"* | 🔴 **WRONG, and it is now measured** | F81, `docs/RUN-QUEUE.md`. All six shapes draw identical pixels on both routes in all four geometry modes, against a positive control of 8,761 px and a noise floor of 0. E2 recommended against porting the picker for the right reason and the wrong fact. |
| **C3**: *"The thirteen `(prior)` pills"* | 🔴 **WRONG NUMBER. There are four.** | `grep -o "(prior)" app/desk-doodles/page.tsx` returns 4: `Chisel (prior)`, `Off (prior)`, `Uniform (prior)`, `the ink (prior)`. Same grep finds each by name, so it is not a broken pattern. The recommendation still holds. |
| **P3**: *"DRAW IN is in the wrong drawer"* | 🟡 **HALF** | The lie is gone. The control is still in the viewport popover and the Animation panel still only points at it. Placement is open and it is his. |
| **§5 counts**: *"Geometry motion, lab 54"* | ⚠ **Different instrument** | My census reads **56** visible control labels on the lab and **48** on the product, **53 on the lab and not on the product**. Method in §6. I am not calling E2's 54 wrong, I am saying it is not the number this document uses. |
| **Not E2's, the map's**: *"eight units where the ink fused `e-s-k` and `o-d`"* | 🔴 **STALE. The live page says 11.** | Read off `/desk-doodles` under the cascade film today: *"This word flips as 11 pieces, not 11 letters. Every piece is one letter."* `docs/RUN-QUEUE.md` F80 is the same fact hitting a gate that expects ten. §1. |
| **§1's frame**: *"the port question is not what do we move from the lab"* | 🔴 **INCOMPLETE, and it is the one that mattered** | The scheduler did go the other way, into the product. The **beat** did not. E2's audit has no row for `flatten` anywhere in it, and `flatten` is the channel that turns your drawing from 2D ink into a 3D object. That is what the lab is for. |

---

## 1 · The finding

**Three of the four channels the hero beat drives already render on the product, on strokes I drew
with a mouse. The product passes none of them and has no control for any of them.**

`grep -c flatten app/page.tsx` returns **0**. `grep -c drawIn` on the same file returns **13**, so the
grep works. `grep -c lighting` returns 0. `grep -c letterMap` returns 0.

So `components/viewport-3d.tsx` takes `flatten = SOLID_STATE` on the product route, every render,
forever. `SOLID_STATE` is `{ ink: 0, depth: 1, color: "#121110", yaw: 0, shade: 0 }`, which is
"already a finished 3D object, face on, not moving". **The product can only ever draw the last frame
of the beat.**

The fourth channel, the per-unit cascade, is inert on the product and I measured it at zero. §2 has
the calibration that makes that zero mean something.

**And the beat's grouping law is already running on your drawing.** `assignLetters` from
`lib/hero-letters.ts` is called on the product route twice, from `components/viewport-3d.tsx` (find
by text: `assignLetters(strokes, inkWidth).of` and `assignLetters(processedStrokes, inkWidth).count`)
and once more from B1's `components/take-timeline.tsx`. It is the same function the lab groups the
hero word with. The map §6.3 named grouping as one of three ways past the 16-unit cap. It is not a
proposal any more. It ships, on `/`, on your ink.

⚠ **But the number everyone is quoting for it is stale, and I read the live page.** The map says the
traced word measures *"eight units where the ink fused `e-s-k` and `o-d`"*, and that sentence is
carried into §9 pick 2. **The lab says on screen today: *"This word flips as 11 pieces, not 11
letters. Every piece is one letter."*** So no fusion is happening on the hero word at the current
reach and ink width, and `docs/RUN-QUEUE.md` F80 is the same fact arriving at a gate that still
expects ten. **This makes P2's cap worse, not better.** If a word designed to fuse comes out one unit
per letter, a forty-stroke drawing is not going to come out under sixteen.

---

## 2 · What I drove, and the numbers

**Instrument.** Headless Chrome through `scripts/verify/lib/browser.mjs`, its own profile, killed by
the driver. `FS_PORT=3105`, `LAB_URL` and `HERO_URL` imported from `scripts/verify/lib/dev-server.mjs`.
`domcontentloaded` plus 9 s on the product and 11 s on the lab. `__captureHarness.enable()` before
every grab. Frames flattened onto white before measuring, because `grab()` returns transparent PNG.
A pixel counts as differing at more than 8 grey levels on any channel. Backing buffer 1920×1080, so
every denominator below is **2,073,600 px**.

**On the product route, on five strokes I drew with the mouse**, two of them crossing on purpose:

| arm | differing px |
|---|---:|
| **NOISE FLOOR**, playhead 0.35 grabbed twice | **0** |
| **POSITIVE CONTROL**, playhead 0.35 vs 0.80 | **8,900** |
| `flatten.ink` 0 → 1, the 2D ink register | **34,117** |
| restore, ink cleared, against the original frame | **0** |
| `flatten.yaw` 0 → 0.6 rad, the mark turns on its own axis | **73,390** |
| `flatten.pitch` 0 → 0.7 rad, the mark hinges up off the page | **62,712** |
| `flatten.letters`, per-unit poses, the cascade | **0** |

**On the lab, traced word, timeline 12.37 s:**

| arm | differing px |
|---|---:|
| **NOISE FLOOR**, `shipped` at 55 % grabbed twice | **0** |
| **POSITIVE CONTROL**, `shipped` 55 % vs 80 % | **73,476** |
| `shipped` vs `letter by letter` at 55 % | **53,459** |
| `shipped` vs `pop-up` at 55 % | **69,660** |
| `shipped` vs `turn lands` at 55 % | **62,346** |
| `shipped` vs `stand & turn` at 55 % | **69,660** |
| `pop-up` vs `stand & turn` at 55 % | **0** |
| **CALIBRATION**, the identical `setFlatten({ letters })` payload used on `/` | **9,148** |
| restore, cleared, against the base frame | **0** |
| `twos` vs `ones` at 6.8017 s | **14,948**, against a control of 13,933 and a floor of 0 |
| camera `four moves` vs `desk ¾` at 6.8017 s | **52,420** |

**Two of those rows are the point.**

**The cascade's zero is real.** The same payload, the same setter, the same threshold: **0 px on `/`,
9,148 px on the lab.** That is what separates this from F81, where four instruments returned a
plausible zero before one was right. The setter is alive, the frames are real, and the difference
between the two routes is one prop. `components/viewport-3d.tsx` opens the letter path with
`if (!letterMap || letterMap.count <= 0) return null`, and the product passes no `letterMap`.

**Pop-up and stand & turn are the same picture at 55 %.** Zero pixels between them. That is not a
defect, it is `stand & turn` being `pop-up` plus a turn that has not started yet at that instant
(`if (p.shape === "standTurn" && tSec >= phaseOffsets(p).orbit)`). So I measured four films at one
instant and got **three distinguishable poses**, not four. Saying four would have been a claim my
own frames do not support.

---

## 3 · The port list, ranked

Ranked on engine already shipped over engine still to write. Every row carries what it is, where the
engine lives, and what it costs to reach `/`.

### P1 · The drawing turns into an object

**What it is.** Your mark starts as flat 2D ink and becomes a lit 3D form, turning about its own
vertical axis or hinging up off the page while it does. One scalar per channel: `ink`, `yaw`,
`pitch`, `depth`, `shade`.

**Where the engine is.** Shared, and already mounted on the product. `FlatState` and its shader
passes are in `components/viewport-3d.tsx`, which both routes mount through the same wrapper. The ink
register is `lib/flat-ink.ts`. Nothing here is lab-local.

**What it costs.** **Wiring.** `app/page.tsx` passes no `flatten`. Add the prop, add a control, and
the three channels I measured are on screen. No shader work, no new render path, no rebuild.

**Measured on `/`, on my own strokes:** ink 34,117 px, yaw 73,390 px, pitch 62,712 px, against a
noise floor of 0 and a positive control of 8,900. The clear-and-restore came back at 0, so the setter
is reversible and the numbers are not drift.

**The argument against.** A pose is not a beat. This row buys you a mark that can BE flat or turned,
not a mark that turns. P3 is the half that moves it. Ship P1 alone and you have five dials nobody
knows what to do with, which is the same failure as sixteen scheduler controls a user could not find.

---

### P2 · Each part of the drawing gets its own beat

**What it is.** The cascade. Every unit of your drawing carries its own `yaw`, `flat`, `depth`,
`shade` and `settle`, so the mark arrives as a run of moments instead of one. On the lab this is
`letter by letter` and it is the best thing the lab does.

**Where the engine is.** Shared and complete, and it is switched off by a missing prop.
`applyLetterMotion` reads the per-vertex `aFsLetter` attribute against a `FS_LETTER_MAX = 16` uniform
array, `ownTrianglesWhole` splits boundary vertices so a triangle straddling two units cannot stretch,
and the grouping law `assignLetters` **already runs on the product**. Every one of those is in
`components/viewport-3d.tsx` or `lib/hero-letters.ts`.

**What it costs.** **Wiring, plus one decision.** The wiring is passing the unit map the product
already computes into the `letterMap` prop, then handing per-unit poses through `flatten.letters`.
The decision is the cap. `FS_LETTER_MAX = 16` and the lookup clamps:
`const li = Math.min(letterMap.of[si] ?? 0, cap)` where `cap = min(count, 16) - 1`. **On a drawing
that groups into more than sixteen units, every unit past the sixteenth is stamped as unit fifteen
and moves with it.** That is a silent wrong answer, not an error. Either the grouping gets a second
merge pass that guarantees ≤16, or the uniform array becomes a data texture. There is no third option
and both are real work.

**Measured:** 0 px on `/`, **9,148 px on the lab with the identical payload**, floor 0 on both,
restore 0 on both.

**Two things that must be in any brief for this.** `applyLetterMotion` has to stay **last** on the
`onBeforeCompile` chain, because its `<project_vertex>` replace only works after the joint break has
assigned `vFsBreakWorld`. And the seam is an identity, not a tolerance: `Δ = (I − R)·(piv_A − piv_B)`,
so it closes only if every unit shares one pivot. The cascade solves that by making the pivot arrive.
A per-stroke version has to solve it again.

**One correction to the map.** `docs/animation-toolset-map.md` §6.3 says *"The stroke version is
`aFsStroke` and the identical mechanism."* **`grep -rn aFsStroke lib components app` returns 0 hits
in 0 files.** The same grep for `aFsLetter` returns hits in 3 files, so the grep works. There is no
stroke owner attribute. Reading that sentence as a description of something that exists would cost a
lane a day.

---

### P3 · A film, playing on your drawing

**What it is.** The program that walks P1's and P2's channels over a clock. Four of them survive his
07-31 and 08-01 rulings: `turn lands`, `pop-up`, `stand & turn`, `letter by letter`. `solidFirst` and
`cutaway` are already eliminated.

**Where the engine is.** `lib/hero-motion.ts`, 4,202 lines, in shared `lib/`. **But
`components/viewport-3d.tsx` does not import it.** `grep -c 'from "@/lib/hero-motion"'` on the
viewport returns 0; the same grep on `app/desk-doodles/page.tsx` returns 1. One file imports the film
library and it is the lab page.

**What it costs.** **Wiring, and one call that is his.** The wiring is a driver: sample
`sampleHeroMotion(params, t)` off the playhead the product already has, write the result into
`flatten`. That is roughly what the lab page does in its own render body. The call is which film
ships. **Do not flip `DEFAULT_HERO_MOTION`**, every camera assertion in `scripts/verify/` reads it.

🔴 **And the default is the trap.** `DEFAULT_HERO_MOTION.shape` is `"shipped"`, and `docs/STATUS.md`
says plainly: *"the one the app opens on is the one his own 07-31 ruling was written against."* So a
lane that wires P3 without picking a film gets the eliminated one, for free, silently. **The film id
has to be an explicit argument at the product's call site, never a default it inherits.**

**Measured on the lab at 55 %,** against `shipped`: letter by letter 53,459 px, pop-up 69,660,
turn lands 62,346, stand & turn 69,660. Floor 0, control 73,476. Pop-up and stand & turn are
identical at that instant, so three distinguishable poses from four films at one time.

**The argument against.** A film is a thing you choose, not a thing you author, and the toolset map's
own recommendation is that films are a garnish taken one at a time once the model underneath is real.
P1 and P2 are the model. Shipping a film picker before them gives the product a dropdown of four
canned results and no way to make a fifth.

---

### P4 · Drawing on twos

**What it is.** The clock quantised to 12 Hz, so the mark advances twelve times a second instead of
on every frame. That is the hand-inked animation convention, and it is why the lab's beat reads as
drawn rather than as interpolated.

**Where the engine is.** `lib/hero-motion.ts`, `cadence: "twos" | "ones"` and `cadenceHz: 12`, applied
by a pure scalar snap. Find by text: `if (p.cadence !== "twos" || !(p.cadenceHz > 0)) return tSec`.

**What it costs.** **Wiring, and it is the smallest row here.** The product's reveal is driven by one
scalar, `playheadRef`. Snapping one scalar is a function call. It rides on top of everything already
shipped and cannot conflict with the schedule, because the schedule is a function of the playhead.

**Measured on the lab at 6.8017 s:** twos vs ones **14,948 px**, against a positive control of 13,933
and a floor of 0. **Not measured on the product**, because the product has no cadence to drive. §7.

**The argument against.** Twos on a camera move reads as craft. Twos on the replay of your own hand
may read as dropped frames, and I have no measurement either way. This is the one row on the list
where the right next step is a fifteen-minute experiment, not a build.

---

### P5 · Where the camera is

**What it is.** Four camera parks and one move: `four moves`, `dead-on`, `desk ¾`, `one cut`. The
desk ¾ one is you looking at your own notebook, and it is the only park where the contact shadow is
worth anything.

**Where the engine is.** Split, and that is what puts it fifth. The orbit setter is shared
(`__captureHarness.orbitView`), the camera program is in `lib/hero-motion.ts`, and the loop that
connects them is in the lab page.

**What it costs.** **Wiring plus a real product decision.** The product's viewport already has orbit
controls the user drives with a mouse. A film that also moves the camera fights the user's own hand
on the same object. That has to be resolved before any of this is worth building, and it is not a
question code can answer.

**Measured on the lab:** four moves vs desk ¾ at 6.8017 s, **52,420 px**, floor 0.

---

### P6 · Type a word instead of drawing one

**What it is.** The lab's `Any text` source. Type a string, get a stroke set with a Sigma-Lognormal
pen clock over it, so the typed word draws itself with something like a hand's speed.

**Where the engine is.** Shared. `buildFontStrokes` and `PenClock` are in `lib/pen-reveal.ts`, the
kinematics in `lib/pen-kinematics.ts`. The lab page picks between it and the traced word in three lines.

**What it costs.** **Wiring.** It is the cheapest thing on the lab to move and I am ranking it last
on purpose.

**The argument against, and I think it wins.** The product's whole sentence is that this is YOUR
handwriting. A typed word rendered with a synthetic pen clock is not your handwriting, and putting it
in the same surface makes the product quietly less honest about what it is. **The one version I would
defend is an empty state**: nothing drawn yet, here is what it does to a word, now draw yours. That is
a demo, labelled as one, and it disappears the moment you make a mark. **His call.**

---

### Still open from E2, unchanged

| # | Row | Where | Cost |
|---|---|---|---|
| P7 | **Per-stroke speed** | neither route | **engine.** The uniform slope is what makes the pen tip cost two multiplications instead of a third texture channel. Per-stroke speed spends that channel. |
| P8 | **Stagger as a curve, and a "hold that one back" list** | neither | **engine, small.** Cavalry ships both because a pure rule cannot say "that one". |
| P9 | **Settle, wobble, secondary motion** | neither | **engine.** Same per-unit transform work as P2, and it is the same 16 cap. `Completion Pulse` is the preset waiting on it and it says so on its own pill. |

---

## 4 · The anti-list

**What should never come over.** This half gets skipped and it is worth as much as the list above.

| # | Thing | Why not |
|---|---|---|
| **N1** | **The DialKit dock**: `Add timeline version`, `Revert to captured values`, `Version 1`, `Collapse timeline`, `Copy parameters` | It is a third-party tuning dock, imported as `import { useDialTimeline, DialTimeline, DialStore } from "dialkit"`. `Copy parameters` is not even ours, it is the package's own button. `lib/stroke-schedule.ts` quotes the note: *"TODO(production): … then remove `useDialTimeline`"*. B1 has already shipped the thing a user needs, a picture of when each unit of their drawing draws, in 481 lines with no dependency. **Two timelines on one surface is the defect the lab already warns about in its own comment.** |
| **N2** | **The four `(prior)` pills**: `Chisel (prior)`, `Off (prior)`, `Uniform (prior)`, `the ink (prior)` | They exist to reproduce known defects so a gate can fail. Their whole purpose is to be wrong. Port the shipped arm of each and leave the priors where the sweep can reach them. |
| **N3** | **`Copy motion.mjs constants`** | An export of tuner state, aimed at a file in this repo. It is how a lane hands numbers to another lane. It has no meaning to somebody who drew a triangle. |
| **N4** | **Draw linearity** | The lab's own hint says it is *"a SECOND easing of the same axis the pen map already drives"* and that at 0.45 it is *"quietly cancelling part of what Authentic replays."* **A control the panel describes as fighting another control is one to cut, not one to move.** The product already has Natural / Authentic and a separate ease over the whole draw, and those two compose on purpose. |
| **N5** | **Scale X and Scale Y** | Two sliders between 0.85 and 1 with no hint on either. An unexplained number in that range is the arbitrary-value tell, and it is the one thing on the lab I would delete rather than port. |
| **N6** | **The lab's own transport**: two play buttons, four scrub surfaces, two resets on one playhead | The lab page argues against itself in its own comment: *"two playheads, two scrub bars, one frame."* The product has one transport and it is correct. |
| **N7** | **The seven-film picker as a picker** | Two of the seven are already ruled out. A picker that ships eliminated options is a rail of dead pills, which is exactly the defect `6eb19499` just finished fixing on the preset row. If a film ships, **one ships**, and it is his pick. |
| **N8** | **The pen tip picker** | F81. Six shapes, one picture, measured in all four geometry modes on both routes against a control of 8,761 px and a floor of 0. The field is persisted and no pill was added, which is the right call. **Do not add one until the render side is fixed.** |
| **N9** | **The register switch** as a user-facing control | `register.lighting` and `register.materialPreset` are how the lab wears two identities for a capture. The product has a material family with thirteen presets and a fusion system. A second thing called "register" that also changes the material is two answers to one question. **If the flat-ink colour needs the register palette, take the palette and leave the switch.** |
| **N10** | **A curve editor, a layer tree, per-point keys, a separate animation route** | Already dead in `animation-toolset-map.md` §5, each with its reason. Recorded here so nobody proposes one from this document. |

---

## 5 · Two live defects on the product, found on the way

Not port candidates. Recorded because dropping a confirmed defect when a document is rewritten is
how it gets found a third time.

| # | Defect | Where |
|---|---|---|
| **D3** | **Two controls, near-identical labels, one popover.** `Reverse` flips the **clock**, so the mark un-draws. `Direction` flips the **path**, so each unit draws from its far end. Both live in the Draw-in timing popover. `lib/stroke-schedule.ts` shows the author already caught this once and renamed the second one. It is still confusable. E2 raised it, I confirmed it, nothing has moved. | `components/viewport-3d.tsx`, find by text `REVERSE_LABELS` and `setRevealReverse` |
| **D5** | **Two stale paragraphs on the lab's own panel**, saying pop-up and letter-by-letter are *"Not built"* while both are live pills with sheets. E1's file. Flagged, not touched, and I did not re-verify the second paragraph. | `app/desk-doodles/page.tsx` |

---

## 6 · The counts, and how they were taken

**Method, one function, both routes.** Every `button`, `input[type=range|text|number]`, `select` and
`[role=switch]` with a non-zero bounding box, labelled by `aria-label`, then text, then placeholder,
then title, deduplicated. On the product I opened the Draw-in timing popover and the style panel
first, because a control behind a drawer is still a control.

| | visible control labels |
|---|---:|
| Product `/`, everything open | **48** |
| Lab `/desk-doodles` | **56** |
| **On the lab and not on the product** | **53** |

**The 53 is not a shortfall, and here it is broken down so it adds up.**

| what the label is | how many |
|---|---:|
| Option words inside one dial: `arrives` `changed` `clean` `continues` `drifts` `eases` `fades` `jumps` `kink` `lands` `long` `none` `pen` `protrude` `rides` `same` `snaps` `stops` `travels` `tube` `turns` `uncoils` | 22 |
| Film pills | 7 |
| Pen tip pills, including `Off (prior)` and `Chisel (prior)`. F81 measured all six as one picture | 6 |
| DialKit dock buttons | 5 |
| Camera parks | 4 |
| Word source: `Traced` · `Any text` · `Sigma-Lognormal` | 3 |
| Lab transport: `Replay` · `Reset` | 2 |
| Exposure pills: `ones` · `twos` | 2 |
| `Uniform (prior)` | 1 |
| `Copy motion.mjs constants` | 1 |
| **total** | **53** |

**So the 53 is mostly option words and instruments.** The rows this document ranks come out of the
film pills, the exposure pills, the camera parks and the word source, which is 16 of the 53. The
other 37 are either one dial's vocabulary, a tuning dock, a prior, or a picker F81 has already
measured as drawing one shape.

**The lab still has no drawing surface.** `grep -c 'DrawingCanvas\|onPointerDown\|onPointerMove'` on
`app/desk-doodles/page.tsx` returns **0**; the same grep on `app/page.tsx` returns **5**, so the
instrument works. Nothing about that changed in the last week, and it is why every lab control is
judged on "do I want this control" and never on "does this feel right on my own handwriting".

---

## 7 · Could not check

A skipped check is not a passed check.

- **Whether twos reads as craft or as dropped frames on a hand-drawn mark.** Measured on the lab's
  traced word only, 14,948 px. The product has no cadence to drive, so there is nothing to A/B on
  your own strokes until somebody builds it. **P4's rank is a guess about taste, not a measurement.**
- **How many units `assignLetters` returns on a busy drawing.** The count is computed inside
  `components/viewport-3d.tsx` and is not published on any harness, so I could not read it. The
  16-unit clamp in P2 is read off the code, not observed failing. **Nobody has yet seen a drawing
  break it.**
- **Whether the seam actually opens on a per-stroke pivot.** The identity in §6.3 says it must. I did
  not render it, because there is no per-stroke owner attribute to render it with.
- **The cascade on any engine family but the one the page loads with.** My product frames are the
  default mode. Inflate needs about 14 s for the marching-cubes rebuild and I did not re-run the
  matrix per mode. F81 did run all four for the pen tip.
- **Whether the lab's films look right**, as opposed to differing. Pixel counts say four films are
  three distinguishable pictures at one instant. They say nothing about which is better, and that
  question is his.
- **Anything on a stylus.** Mouse only.

---

## 8 · The order I would build it

**P1 → P3 → P2 → P4 → P5.**

**P1 first** because it is the only row where the engine already renders on your own drawing and the
only thing missing is a prop and a control. Three channels, three measurements, one afternoon.

**P3 second, not third**, and this is the one place I disagree with the toolset map's own advice.
The map says films are a garnish taken last. That is right when the alternative is authoring. It is
wrong here, because after P1 the product has five motion dials and no reason for anybody to touch
them. **One film is the reason.** It shows what the dials are for, and it is the sentence the lab has
been proving for a month.

**P2 third** because it is the biggest visible jump and it carries the only real decision on the
board, the 16-unit cap. **Do not start it before somebody answers what happens at unit seventeen.**

**P4 and P5 after that**, in that order, and P4 only after somebody has watched twos on a real
drawing for thirty seconds.

**P6 is his**, and the honest version of it is an empty state.

---

## 9 · What is blocked on him

1. **Which film ships.** Four, not seven. `solidFirst` and `cutaway` are already eliminated by his
   07-31 and 08-01 rulings.
2. **What happens at unit seventeen.** A second merge pass that guarantees ≤16 units, or a data
   texture instead of the uniform array. P2 cannot start without this.
3. **Whether the camera moves at all in the product**, given the user already has orbit controls on
   the same object. P5 is blocked on it.
4. **Where DRAW IN lives.** Still open from E2's P3. The lie is fixed, the placement is not.
5. **Whether `Any text` ships as an empty state.** P6.

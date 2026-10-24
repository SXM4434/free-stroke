# The 2D Register — a board

*Key shots first, then breakdowns, then in-betweens. Written the way
`docs/hero-beat-storyboard.md` was written and against the same sources
(`docs/research/storyboarding.md`), but not from its content: nothing below is
derived from a 3D shot by analogy. Every shot names a measurement or a source,
and where there is none it says so.*

> **PHASE 1. NOTHING IS BUILT.** This pass wrote this file and nothing else.
> `lib/`, `components/`, `app/`, `scripts/`, `docs/research/`,
> `docs/explainers/` and `docs/hero-beat-storyboard.md` were READ and, where an
> assert existed, RUN — never written. Three other lanes are live in them. No
> commits. This is a board for Sebs to react to, and no build fires off it until
> he has (`docs/DISPATCH.md` §0).

**The question this exists to answer, in his words:**

> *"but remmber that was for 3d we ned it to work for 2d and 3d as well"*
> *"yes but rmember the free stroje naimtion was for 3d strokes we dont know if woek son 2d stuff"*

**And the short answer, before the evidence: he is right, and it is worse than
he suspected. Nine of the twelve phases of the shipped beat do not exist in the
2D register, and three of the four devices it is built out of — thickness, the
camera, the contact shadow — are unavailable there. The 2D register cannot have
that beat. It can have a better one than a degraded copy, and §4 is what it
looks like.**

---

## 0. Read-proof ledger

Every doc the dispatch names, with a specific citation proving it was opened.

| doc | ✅ | citation |
|---|---|---|
| `~/…/portfolio-system-lab/docs/system/FABLE-GHOST-BRIEF-ENGINE.md` | ✅ | §0: *"**Phase 1 — IDEA CREATION (the map):** produce the 6-category / per-option map through the full pre-flight + online research + saved refs. → goes to Sebs (§2.11) → he gates."* And the failure it exists to stop: *"the Footer refill MAP was drafted from a ledger-skim with NO online research → it came back derivative… **You research to CREATE, not only to evaluate.**"* |
| `…/AGENT-DISPATCH-CONTRACT.md` §0.5, §0.7, §1 | ✅ | §0.5's image-gate correction: *"`page.goto()` **does not throw on an HTTP error status**… **A ref that 404'd cannot have a mechanism — the analysis was written from the URL slug.**"* §0.7: *"⚠️ REWORKING/IMPROVING a read IN PLACE is STILL a deletion"* — which is why §7 below **splits** the gate set rather than editing it. §1's ledger rule: *"a fabricated quote, or a missing citation on an applicable doc = the read didn't happen."* |
| `docs/DISPATCH.md` §0 | ✅ | *"The hero-beat storyboard is a Phase 1 deliverable. It is a plan for Sebs to react to, and no build fires off it until he has."* And §2.2: *"A citation is not evidence — it is a claim that evidence exists."* |
| `docs/hero-beat-storyboard.md` — IN FULL, §10 and §11 first | ✅ | §11.7.4: *"§7's four turns are four again, and its two moments are two."* §10.2 C7: *"K4's 18 frames is the payoff of the absence. Do not spend it."* §7's three numbers a rebuild must not lose (clamp `sx ≥ 0.035`, one centre, shade `0.35(1−sx)`) and §11.7.1's correction to #2: *"The property is affineness. It is portable; it just had to be bought from the camera."* §2's admission test, quoted below. §11.8's eight instrument bugs — *"not one of them makes anything look broken."* |
| `docs/research/reference-film-mechanics.md` | ✅ | §4.2: *"The frame is emptied for 625 ms (15 frames) before the payoff arrives… a measured frame-to-frame change of exactly **0.000**."* §6.5's bimodal spacing (arrival 9–37 %, wind-up 79–93 %, *"Nothing that has a silhouette is spaced evenly"*). §8: during EC's shuffle *"one band lights and the other two sit at mad < 0.15, a **100:1 separation**."* §9: *"An accent is bought with a hold, not with a move."* |
| `docs/research/online-reference-mechanics.md`, esp. §9 | ✅ | §9.1: *"**The genre's own answer to 'how do you change a flat state without shading it' is: put an occluder over it and take the occluder away.** The card never changes. What changes is how much of it you are allowed to see."* — verdict OCCLUSION on **7 of 7** frames of the open and **14 of 14** across open and close, against a rotation control and a shift control, with the discriminator required to say ROTATION on a synthetic first (§9.0 row 6). §9.2: *"**not one instance anywhere of a mark occluding itself at a crossing**"* and *"27 of 30 [transits] contain zero duplicate frames… **the dwell is ours**."* §6.2: *"Nothing in this set makes a flat mark read as dimensional by changing the mark."* |
| `docs/research/storyboarding.md` | ✅ | Whitaker/Halas/Sito p. 54, the admission test: *"**A held drawing can usually be extracted from the animation and works when framed and hung on the wall**, whereas most animation drawings do not."* Williams: *"If the breakdown or passing position is wrong, all the inbetweens will be wrong too."* And §6's honest finding: *"nobody has written this discipline up for interface motion"* — which is why the method is film's. |

**Also read, because the 2D register lives in them:** `lib/flat-ink.ts` (whole
file) · `lib/pen-reveal.ts` header · `lib/hero-motion.ts` (`HERO_PHASES`,
`PARKED_PHASES`, `DEFAULT_HERO_MOTION`, `HeroReturn`) · `components/viewport-3d.tsx`
`FlatState` (:552–:719) · `app/desk-doodles/page.tsx` (:184–:236, :780–:810) ·
`docs/research/hero-2d-to-3d-transition.md` · `docs/research/desk-doodles-register.md`
§7 · `docs/research/stroke-width-models.md` · `docs/research/handwriting-variability.md` §3 ·
`docs/research/reveal-cost-and-timeline-ownership.md` §1.2 ·
`docs/explainers/08-hero-beat-and-registers.md` · `SESSION-HANDOFF.md` head.

**Run first-hand on this machine, not cited from a brief:**

| command | result |
|---|---|
| `node scripts/verify/assert-drawin-2d-parity.mjs` | **ALL PASS** — clock disagreement **0.00e+0**, raster worst **1.70 %** against a 2.00 % tolerance, early ink at **7.8 %** across the word |
| `… --control=clock` | **SOUND — the control correctly FAILS** |
| `… --control=order` | **SOUND — the control correctly FAILS** (early ink 91.1 %) |
| `node scripts/verify/assert-hero-ledger.mjs` | **4/4**, 4/4 correctly FAIL on the prior beat, `SOUND` — the shipped 3D beat is **371 frames / 12.37 s**, twelve phases, four held shots, two moments, **36.1 %** read stillness |

**Looked at, with my own eyes, and reported in §2.3:**
`docs/verification/hero-k7/zoom/zoom-fused.png` · `zoom-open.png` ·
`smoke/k1-fused.png` · `smoke/k7-open.png` ·
`docs/verification/drawin-frames/after/dd_dense.png`.

---

## 1. The register audit — what actually survives

### 1.1 "The 2D register" is three different things in this repo, and only one of them is a register

Naming them apart is the first thing this board has to do, because two of the
three are why the question keeps getting answered wrong.

1. **`FlatState` — the 3D mesh driven to render as a drawing.** This is what the
   hero beat's "flat" is today. `components/viewport-3d.tsx:598`. Its own doc
   comment states the limit and it is the sharpest sentence on this subject
   anywhere in the repo: *"Collapsing shading flattens a SURFACE; it does not
   flatten a SHAPE."* Measured there at `:589-590`: the flat state's
   medial-axis half-width is **7.07 px, spread 0.493** and the settled solid's
   is **7.07 px, spread 0.493** — *"Identical to three decimals — the flat state
   IS the solid."* Sebs said the same thing without the number
   (`app/desk-doodles/page.tsx:879-881`): *"the animation just shows the 3D
   letter head-on — which yeah will look flat, but it's still 3D. What we had
   before was it changes between an actual flat lettering, like flat 2D SVG, to
   3D rubber."*
2. **`lib/registers.ts` — Desk Doodles vs Free Stroke.** A palette/type/motion
   value table (explainer 08 §4). Orthogonal to this board. Not the 2D register.
3. **`lib/flat-ink.ts` — the actual flat renderer.** Canvas 2D, polylines from
   the same processed strokes the 3D scene inflates, truncated at a cumulative
   arc length. **This is the 2D register, and it has no live consumer.** Verified
   by grep: `makeFlatRenderer` is imported by exactly one file in the repo,
   `scripts/verify/assert-drawin-2d-parity.mjs`. `viewport-3d.tsx` imports only
   `buildJointBreaks` and two types from it (`:61-64`). So the 2D register today
   is a library and a proven law with **no surface**.

### 1.2 Phase by phase

`HERO_PHASES` (`lib/hero-motion.ts:75`), against what the 2D register can render.

| phase | 2D? | why, with its evidence |
|---|---|---|
| `draw` | ✅ **native, and arguably more native than in 3D** | the pen path IS the mark. Parity run first-hand: same distance at the same playhead, **0.00e+0** |
| `breath` | ✅ register-independent | a still frame is a still frame. In 2D it is byte-identical for free |
| `anticipation` | ⚠️ **the squash ports; the story behind it does not** | explainer 08: *"a squash is a deformation of the object, which a 2D scale can honestly express."* But the 3D squash is pinned at the CONTACT so the mark presses into the page (`assert-hero-dead-channels`: `cy 501.0 → 505.0`). A drawing has no contact — it is already in the page. §4 F4 proposes what replaces it |
| `emerge` (the turn) | ❌ **impossible** | K3′'s entire content is *"the sliver is REAL THICKNESS — depth 1.0000 at edge-on"* (`assert-hero-turn.mjs`). A 2D mark has no depth channel to be 1.0000 |
| `land` (the shadow) | ❌ **impossible** | `assert-hero-return.mjs` asserts *"a drawing casts NO contact shadow"* at exactly 0 across K7. The shadow is the 3D register's, by definition |
| `solid` (K4) | ⚠️ **meaningless** | K4 is an A/B against K1 in the same framing. In 2D nothing changed dimension, so there is nothing to A/B |
| `tilt` · `standup` · `orbit` · `descend` | ❌ **all four are the camera** | there is no camera. `PARKED_PHASES` (`:110`) excludes exactly these three-plus-one because they *fly* it |
| `returnTurn` | ❌ | needs the turn |
| `hold` (K7) | ✅ the mark, held | but "return" is meaningless — it never left. §8 |

**Three of twelve.** And the three that survive are the setup, not the beat.

### 1.3 What ports exactly, and I ran it rather than citing it

`lib/pen-reveal.ts`'s header already splits this correctly and the split is the
answer to Sebs's second sentence:

> *"THE PROGRESS MODEL — time fraction → distance fraction along the pen's own
> path… **This IS register independent.** It is arithmetic over
> `ProcessedStroke.points[].t`, and a canvas, a tube and a marching-cubes surface
> all want the same answer. […] THE RENDERING MECHANISM — what you do with that
> number. **This is NOT register independent and must not be pretended to be.**"*

Run on this machine:

```
t 0.20   3D 0.22093   2D 0.22093
t 0.40   3D 0.42726   2D 0.42726
t 0.60   3D 0.62599   2D 0.62599
t 0.80   3D 0.83018   2D 0.83018
PASS  the 2D and 3D registers reach the same distance at the same playhead
      worst disagreement 0.00e+0
PASS  the 2D mechanism inks the distance the shared clock asks for
      worst |diff| 1.70 % against a 2.00 % tolerance
```

and **both negative controls correctly fail** — feeding the raw playhead breaks
row 1, drawing in reverse pen order puts the early ink at **91.1 %** across the
word against **7.8 %** clean. So: the clock is safe in 2D, proven, with a
control. The mechanism is a different mechanism (polyline truncation against
`setDrawRange` over a counting-sorted index buffer) and it works.

**Everything else about the draw-in ports too, because it is all clock:**
`draw: 140/30` = 4.667 s is the length at which the record's median stroke lands
exactly on the **100 ms** floor `docs/research/handwriting-variability.md:126`
takes from Djioua & Plamondon (*"Movement time is typically 100–500 ms, with the
velocity peak about 100 ms"*), the Sigma-Lognormal reconstruction's own duration
is 16.805 s, and the shipped lognormal clock reads Pearson **r = 0.8412** against
the uniform clock's **0.9986** (where 1.0000 is a machine). None of those four
numbers has a renderer in it.

### 1.4 The plain answer

**The 2D register should not attempt the 3D beat, and that is a finding rather
than a failure.** The 3D beat's spine is: flat → *thickness revealed at the
edge* → *stands up* → *held ¾* → *comes back*. Four of those five are the camera
or the depth channel. Porting the shape without them produces exactly what the
dispatch names: a slightly different version, one level up.

What the 2D register gets instead is its own beat, on its own claim, and §2 is
the argument for what that claim is.

---

## 2. Where the 2D register hides something, and what it is hiding

### 2.1 The corpus's question, and its answer

The board's hard constraint on any change to a settled flat state is
`hero-beat-storyboard.md` §10.5 call 1's: the change must be **occlusion, never
shading** — because gate 1 says a flat mark is one value inside a hard
silhouette, an intermediate value breaks it, and a gap does not.

`online-reference-mechanics.md` §9.1 measured whether the genre agrees, and it
does, unambiguously, with the instrument required to fail on a synthetic first
(§9.0: a card *rotated* into 70 rows must read ROTATION, and does):

> *"**The genre's own answer to 'how do you change a flat state without shading
> it' is: put an occluder over it and take the occluder away.** The card never
> changes. What changes is how much of it you are allowed to see."*

7 of 7 frames on the open, 14 of 14 across open and close, against both controls.

So in 2D the available devices are **occlusion** and **absence** — and absence is
a special case of occlusion where the occluder is the whole frame.

### 2.2 In a world with one plane and one value, the only thing that can occlude ink is ink — and the only thing that decides which ink wins is the order of the hand

That sentence is the board, and it is not an analogy to anything. Work it
through:

- The 2D register has **one plane** (the page) and **two legal values** (ink and
  paper). `desk-doodles-register.md` §1: *"It's ALL ONE PENCIL… VALUE = MARK
  DENSITY, NOT A TINT."*
- Therefore an occluder cannot be distinguished by depth, by light or by tone.
  It can only be distinguished by **being ink that was laid down later**.
- Which ink was laid down later is not an interpretation. It is the record —
  `app/desk-doodles/page.tsx:213`: *"the pen order is not an interpretation, it
  is the record."*
- **So the 2D register's only occlusion device is its record of authorship.** The
  mechanism and the claim are the same object.

That is stronger than the 3D case, where the device (a form turning) and the
claim (it has thickness) are two things that had to be staged together to read.

**And the hiding place already exists, natively, measured.** The word is 22
separate acts of the hand, and the settled mark hides every one of them.
`page.tsx:207-219`:

> *"The word is 22 separate acts of the hand, and the hero deliberately FUSES
> them… That fusion is what makes K1 one blob and the hand's 22 decisions
> invisible. […] On the traced word that is **22 junctions**… (18 at half the
> ink diameter, 29 at one and a half — so the count is the handwriting's, not
> the threshold's)."*

In 3D the fusion is a build option (`HERO_INFLATE.fusion: "implicit"`). In 2D it
is not optional — it is what a canvas does. Stroke B over stroke A with
`lineJoin: "round"` and one colour *is* a fused blob, by construction, and I saw
it (§2.3).

**One correction that has to be carried, because the 3D board states the
opposite.** §3 K4 and §10.5 call 1 both describe the news as *"the crossings
resolve into over/under."* On this word there are essentially no crossings:
`page.tsx:197-205` reports **one** true centreline intersection in 22 strokes
and 1078 points — stroke 10 against stroke 11, *"and stroke 11 is a three-point
tick four units wide."* The device is not an X-junction resolution. It is a
**fusion-boundary** device: 22 places where the pen laid one stroke *against*
another and the fusion erased the seam. Say it that way or the shot gets built
looking for something that is not on the mark.

### 2.3 What I saw, and it is the biggest craft risk on the board

I opened four frames rather than citing them.

**`zoom-fused.png`** (13 junction crops) — the word is one solid mass. Every
junction is a blob with no boundary anywhere. The counters of the `e` are slits.
Nothing in it says a hand made 22 decisions. The hiding place is real and it is
total.

**`zoom-open.png`** (the same 13 crops, breaks open) — and this is the finding.
Where a junction is **isolated** the break reads exactly as intended: a short
clean bar of paper across the under stroke, with ink resuming on both sides.
Crops 9, 10 and 11 are good. Where junctions **cluster** — crops 0, 1 and 3, the
`sk` overlap — the openings collapse into a scatter of white squares and a
stair-stepped diagonal, and what the eye reads is not pen order, it is damage.

**`k7-open.png` at real scale** (1120×841, word ≈ 450 px) confirms it and adds
the honest half: at viewing scale the isolated breaks on the `D` and the `o` read
as clean lifts, and the `esk` region reads as a shredded patch. Same frame, both
readings, ~200 px apart.

Two things follow, and both are load-bearing for §4:

1. **The break device works, and it works one at a time.** Twenty-two at once is
   not a moment, it is a texture change — which is exactly the failure the
   corpus's most consistent finding predicts: *"one thing moves at a time"*, a
   **100:1** band separation through Exquisite Corpse's shuffle
   (`reference-film-mechanics.md` §8) and a simultaneity of exactly 1 across
   Babbu's entire eleven-event cascade.
2. **In 2D there is nowhere to hide the change.** The 3D beat hides its state
   flip inside the turn — `assert-hero-turn.mjs`: *"the state change is hidden AT
   the edge — ink flips at frame 13, edge-on at frame 13."* The 2D beat has no
   edge. Whatever the change is, the audience is looking straight at it when it
   happens. That constraint alone rewrites the shot list.

*(Honest note on the smoke frames: they read "Desk Do" plus a detached tick, so
the capture is at a partial reveal or a clipped stage. I judged the break's
character from them, not the word's completeness.)*

---

## 3. What the 2D register has that 3D does not

The question that stops this being a lesser version. Seven, each with its number.

**1 · Registration is free by construction, and buying it cost the 3D beat its
camera.** The 3D turn broke `hold the centre, break the extent` at **`max cx step
46.50 px`**, and it was closed only by mounting an orthographic camera
(`Viewport3DProps.projection: "affine"`) — after which it reads **1.00 px**, one
quantisation step of a half-pixel bbox centre (§11.7.1). The honest cost is
stated there too: *"parallel projection removes near/far convergence from the
whole stage."* In 2D nothing translates and nothing projects. A break removes ink
from a static path; the silhouette's centre **cannot** move, for the same reason
§7 says the original flip's could not: *by construction*.

**2 · The silhouette is the pen's, and the 3D flat state's is not.** §3 K1's
complaint — *"The silhouette is a tube's, not a pen's: blunt round terminals,
constant width, bulges at the joints"* — is a permanent property of a flattened
tube, measured identical to the settled solid to three decimals. A canvas
polyline has the pen's outline because it *is* the pen's path. **The 2D register
passes the shape test the 3D flat state fails by construction.** (With one
caveat that is a real gap, §10 item 4: `flat-ink.ts:152` draws a constant
`lineWidth` with round caps — a monoline. The register's own spec is
`perfect-freehand` at `size 4, thinning 0.5, smoothing 0.7, streamline 0.78`,
filled polygon, `#121110` — `desk-doodles-register.md` §7.)

**3 · Redraw is nearly free, so the mark can BOIL.**
`reveal-cost-and-timeline-ownership.md` §1.2, measured in node on the hero word:
a full implicit rebuild is **531.5 ms**, and *"even at 5 percent of the word a
rebuild already costs 24 ms, over a 60 fps frame."* Re-stroking 22 polylines is
what a canvas does anyway. Which makes affordable in 2D the single texture that
makes the strongest reference film read as *drawn*: Exquisite Corpse's **4 Hz
ink boil** — a genuine redraw every 6 frames, ink centroid oscillating ±2 px
about a fixed mean with **zero net displacement** over 1.08 s, ink mass ±0.9 %
(`reference-film-mechanics.md` §2.1). That is a 2D-register capability with a
measured cost of approximately nothing and a measured 3D cost of 531 ms.

**4 · Occlusion is the medium's default rather than a recovered special case.**
The 3D beat had to buy over/under back with a shader discard whose law took
three drafts, each failure recorded in `lib/flat-ink.ts:520-536`: a perpendicular
band measured *"zero cut on 22 of 22 junctions"* because at a crossing both
strokes occupy the same perpendicular band; evaluating the over-distance at the
fragment produced *"a long thin white scratch running ALONG the stroke instead of
across it… a 9x33 px slash down a stem, and a 34x49 px shredded cluster."* In 2D,
over/under is what you get by drawing stroke B after stroke A with a
paper-coloured casing. Same law, no shader, and `buildJointBreaks` — which
already lives in `lib/flat-ink.ts` and is pure — is runnable in node today.

**5 · Tone without lifting a value.** `desk-doodles-register.md` §1: *"the grey
must EMERGE from black marks at varying density (hatch spacing / pressure), like
a real pencil — NEVER a flat grey surface tint."* §7 records that the 2D register
already has a solved pipeline for it — source darkness → Murray-Davies inverse →
8-band L\* table → coverage model → gap and weight, `gap ∈ [1.5, 12]`,
`weight ≤ 0.7 × gap`, coverage capped at **0.72** because past it *"dense
cross-hatch collapses into a structure-losing solid black blob."* The 3D register
makes tone from **light**; the 2D register makes it from **density**. Both are
legal under the one-value law; only one is available per register.

**6 · Width is a channel, not geometry.** `stroke-width-models.md`: the broad-nib
model is *"a global affine map"* — width from stroke direction against a fixed
nib angle, no pressure involved. Measured ceilings: the existing
`Point.pressure` channel caps contrast at **2.077 : 1**, a broad nib runs
**5:1 to 10:1**. In 2D changing the mark's weight is a parameter; in 3D it is a
rebuild (see item 3).

**7 · The page is a real plane and the mark is on it.** A ruling, a baseline, a
margin, a second sheet are all available and all free of a lit stage's problems.
Doodle Fonts does exactly this and the 3D board's own appendix recommends it —
*"it keeps metrics visible — ghost glyph, baseline, x-height, sidebearing bars…
the page's own ruling is the cheapest way to say so, and it costs no motion at
all."* **Lower confidence than 1–6: this repo has no engine for it.**

### What 2D loses, stated so nobody discovers it later

Thickness. The camera, and with it four phases. And the contact shadow — which
matters more than it sounds, because `online-reference-mechanics.md` §6.2
measured the closest clip in the whole set to our register (white paper, one
raking light) and found the shadow is *all* of it: *"The form itself is white
paper against white paper — its own tonal contrast against the ground is close to
nil, before and after. What makes it read as standing is entirely the shadow."*

Its transfer #3 says a dimensional read needs one of three things to arrive with
the form: **a cast shadow, an occlusion, or a shaded interior face.** The 2D
register has exactly one of the three. That is the whole constraint in one line,
and it is why the occlusion device is not a preference.

---

## 4. The key shots

Each is named for what it **tells**. Each states what is on screen, what the ink
is doing, why the shot exists, what it is derived from, and its verdict against
the hard gate — Whitaker/Halas/Sito p. 54, *"A held drawing can usually be
extracted from the animation and works when framed and hung on the wall."* A shot
that cannot pass it is an in-between with ambitions, and two below are marked as
such rather than promoted.

---

### F1 — THE PAGE · *the surface is an actor*

- **On screen** paper, empty, with its own ruling visible — baseline and margin.
- **The ink** none. Nothing has been drawn.
- **Why it exists** in 2D the page is the only other actor in the film, and every
  later shot is judged against it. It also establishes the subject as a **mark on
  a surface** rather than a picture, which is the claim F5 later cashes.
- **Derived from** Doodle Fonts keeps its metrics visible throughout
  (`reference-film-mechanics.md` §2.8, §5.4); `all4-idents` *"empties the frame
  completely for two frames immediately before each build"*
  (`online-reference-mechanics.md` §9.2); Exquisite Corpse buys its payoff with
  **625 ms** of empty ochre at a frame-to-frame difference of exactly **0.000**.
- **Admission test:** ⚠ **PASSES ONLY WITH THE RULING.** An unmarked page framed
  and hung tells nothing. With a baseline and a margin it is a page waiting to be
  written on, which is a picture. This is the shot most at risk of being an
  in-between with a name, and the ruling is what decides it. **No engine exists
  for the ruling** — §10 item 5.

---

### F2 — THE HAND ARRIVES · *a passage, not a key*

- **On screen** the word writing itself, left to right, at the pen's own speed.
- **The ink** growing along the recorded path. Hesitations, flicks and pen-up
  gaps are the recording's, not a curve's.
- **Why it exists** it is the beat's first claim and the product's other one, and
  it is the only 4.667 s in the film that nothing else can be.
- **Derived from** the clock, run first-hand (§1.3); the **100 ms** floor;
  r = 0.8412 against a machine's 0.9986.
- **Admission test:** ✗ **DOES NOT PASS, and should not** — a half-written word
  is the definition of an animation drawing. Its two **extremes** are keys and
  they are F2a (the first stroke lands on a page that was empty) and F2b (the
  last pen-lift). Recorded as extremes, not promoted to keys.

---

### F3 — THE MARK · *one thing, and it is hiding twenty-two*

- **On screen** the finished word. One value inside a hard silhouette. Held.
- **The ink** at rest. Every junction fused; not one of the hand's decisions is
  legible.
- **Why it exists** it is the state the moment has a *before* to be. Its whole
  content is what it does not show, and F6 is the A/B against it.
- **Derived from** what I saw in `zoom-fused.png`; the 22-junction measurement;
  `page.tsx:209` — *"a crossing IS one merged mass with a fillet."*
- **Admission test:** ✅ **PASSES cleanly.** This is a drawing. It is the one
  frame in the beat that is unambiguously a thing you could hang.
- **And it is where the 2D register beats the 3D one on its own gate.** The 3D
  flat state fails §3 K1's shape test permanently (7.07 px / 0.493, identical to
  the solid). F3's outline is the pen's because it is the pen's path.

---

### F4 — THE PRESS · *something is about to happen*

- **On screen** the same word, weight shifting: the mark bears down.
- **The ink** the wind-up. **In 2D the wind-up is pressure, not squash.** The pen
  presses harder; the stroke gains width at one unchanged value; then it holds.
- **Why it exists** it is the only shot that makes the moment *expected* rather
  than a glitch, and §2.3's second finding makes it mandatory here in a way it
  was optional in 3D: the 2D change has no hiding place, so the audience must be
  told to look before it happens.
- **Derived from** the register's own vocabulary — *"VALUE = MARK DENSITY…
  pressure, shading, hatch density"* (`desk-doodles-register.md` §1); the measured
  ceilings on width (2.077 : 1 through `Point.pressure`, 5:1–10:1 with a broad
  nib); the measured reach of the thing it is winding up for — *"1.25 caps the
  worst case at 2·R = 2.5 ink diameters of missing centreline, measured max 29.2
  units against an ink diameter of 22.6"* (`lib/flat-ink.ts:361-362`); and the
  reason a squash is the wrong instrument here — the 3D squash is
  pinned at the CONTACT so the form presses *into* the page
  (`assert-hero-dead-channels.mjs`: `cy 501.0 → 505.0`), and a drawing is already
  in the page.
- **Admission test:** ⚠ **BORDERLINE, and honest about it.** The 3D squash
  measures −4.57 % in height — a pose you read in a before/after, not one you
  hang. A pressure wind-up has the same problem at low amplitude and a different
  one at high (a 30 % heavier word is a different word). Frozen mid-press with
  the ink visibly heavier it *does* read as tension. **This shot is the one most
  likely to need its amplitude found by eye rather than by argument** — §10
  item 3.
- **Alternative, and it is a real one:** the wind-up is an **absence** — two
  frames of empty page immediately before F5. §9, call 2.

---

### F5 — THE LIFT · **THE MOMENT** · *the hand's order was there the whole time*

- **On screen** paper where ink was. At one junction, the earlier stroke breaks
  and the later one passes through whole.
- **The ink** nothing moves. Ink is removed and nothing else changes anywhere in
  the frame.
- **Why it exists** **this is the beat.** It is the only instant with a genuine
  before and after, and what it says is the 2D register's whole claim: this is
  not a shape, it is a sequence of acts, and here is the proof in the mark
  itself.
- **Derived from** §2.2's argument, and from the corpus's answer to the exact
  question — occlusion, 7/7 and 14/14 against two controls. The specific FORM has
  no precedent and that is recorded rather than hidden:
  `online-reference-mechanics.md` §9.1 — *"not one instance anywhere of a mark
  occluding itself at a crossing."* Ours, carried as ours, the same way the
  two-frame dwell is.
- **Admission test:** ✅ **PASSES, and it is the strongest frame on the board.**
  Freeze it and you have a drawing in which one stroke visibly crosses over
  another. That is a picture with information in it, and it is not the same
  picture as F3.

**Four properties this shot has that the 3D moment does not, all measured:**

1. **Registration is not at risk.** No stroke moves. `cx` and `cy` cannot change.
   The 3D moment cost 46.50 px and an orthographic camera to get the same
   guarantee (§3 item 1).
2. **It is one frame.** The corpus's answer to *how does a flat thing change
   state* is a substitution: `extrude-outline-reveal` f63→f64 and f303→f304,
   `stacked-extrude-pin` f44→f45 — three instances, and at the swap frame
   `mad` is **5.18** against a local baseline of ~2.5 with `hcorr` **0.996**,
   because the outline is shared. Babbu's label swap is one frame (42 ms), its
   eleven object pops are one frame each with **no** overshoot and **no** settle,
   and its reward beat is a one-frame colour change. So F5 does not need a curve,
   and §5 B1 says why it may not have one.
3. **It cannot break the value law.** `viewport-3d.tsx:687-695`: *"An alpha ramp
   would be the worst available answer: it puts intermediate values inside the
   mark, which is a shading wearing an occlusion's name."* A one-frame
   substitution has no intermediate state to be wrong.
4. **It is ONE junction, not twenty-two.** This is the correction §2.3 forces and
   it is the single most important line in this board. *One thing moves at a
   time* — 100:1 band separation, simultaneity exactly 1 — and I watched 22 at
   once read as damage.

---

### F6 — THE ORDER · *and it is true everywhere*

- **On screen** the rest of the junctions, open. The word carrying its own pen
  order. Held, dead still.
- **The ink** the remaining breaks land together, one frame, and then nothing
  moves for the rest of the shot.
- **Why it exists** F5 teaches the eye what a break IS on one clean example; F6
  spends that teaching on the whole word, where alone it would have read as
  noise. It is also the payoff hold — the shot the beat is *for*.
- **Derived from** Exquisite Corpse's shuffle, built from rather than copied: it
  runs **single → single → double**, with the stagger *"exactly 16 frames =
  667 ms… Not approximately — exactly, twice"*, and *"The rhythm doesn't
  accelerate; the content does"* (§4.4). Ours runs **single → all**. Hold length
  from the measured payoff holds: EC **958 ms**, Babbu **1210 ms**, Doodle Fonts
  **400–967 ms** — against the online set's **1.7–3.3 s**, which is 2–3× longer
  and belongs to the genre that actually performs our move.
- **Admission test:** ✅ **PASSES**, and it is the frame the beat exists to
  arrive at.
- ⚠ **The known risk, seen not predicted:** the `esk` cluster. If F6 opens every
  junction, that patch reads as shredding at real scale. Three ways out, all
  cheap, none free, and the pick is Sebs's (§9, call 3): open only the junctions
  that are spatially isolated and leave the cluster fused; open the cluster as
  one break rather than four; or narrow `breakK` in dense regions. The first is
  the most honest — a cluster genuinely has no over-and-under to show, which is
  the same reason `buildJointBreaks` already **drops** junctions that open
  nothing and returns the count so the caller can say so.

---

### F7 — THE CLOSE · *proposed and NOT recommended · §8 and §9 call 4*

- **On screen** the junctions fuse again. The word as F3, held.
- **Why it would exist** to assert that the order was always there and was only
  ever revealed, not added.
- **Why the evidence points against it** all three Desk Doodles films end on the
  **changed** state and hold it — Doodle Fonts resolves doodle→sans and holds
  400 ms; Babbu turns blue→green and holds 1.21 s; Exquisite Corpse reshuffles
  and holds 958 ms. Three for three. And the one clip in the online set that
  *does* close its occlusion — `origami-logo-fold`, whose close is *"the open run
  backwards, the same band heights in reverse order to within 2 px"* — closes
  because it is a **looping template running a second cycle with different
  content** (the same white packet uncovers "Place your Logo here", then
  **envato**). That is a staging requirement, not a design choice.
- **Admission test:** ✗ it is F3 again — *"if it is identical to K1, then two of
  the seven key shots are the same picture, and that is one key shot."*

---

## 5. The breakdowns

Williams, twice, because everything downstream is derived from these:
*"If the breakdown or passing position is wrong, all the inbetweens will be wrong
too."* And the anti-pattern from BAM Animation: *"the WRONG way… is to put a
drawing exactly in the center… it looks very mechanical."*

### B1 — the moment has no breakdown, and that is the finding

**In 3D the moment is a TRANSIT with a passing position at 87 %. In 2D it is a
SUBSTITUTION with no in-between at all.** Three independent reasons, and none of
them is a preference:

1. **The law forbids the in-between.** A gap that ramps its alpha puts
   intermediate values inside the mark. `viewport-3d.tsx:693`.
2. **A gap that grows has a sub-pixel phase, and a sub-pixel gap is grey.**
   Antialiasing puts exactly the banned values inside the mark for as long as the
   gap is under about a pixel. Whether that phase is short enough not to matter
   is the one thing here I cannot settle without building — §10 item 2.
3. **The corpus says a flat state changes in one frame.** Six instances across
   two sets, listed at F5.

So the 87 % wind-up law does not disappear; it **moves to the shot that leads
into the substitution**. B2 is where it lands.

### B2 — the wind-up, and where its passing position goes

The reference set is bimodal and there is no legal middle:
`reference-film-mechanics.md` §6.5 — **arrival at 9–37 % (15 of 22)**,
**wind-up at 79–93 % (3 of 22)**, and the only four transits near 50 % are
opacity fades with no pose to break down. *"There is no useful reason to build
anything at 42–58 % unless it is literally a crossfade."*

F4 is two things and they space differently:

- **the press** — reached fast and then held. `easeOutStrong` (`1 − (1−t)⁵`),
  arrival mode. The hold is what sells intent; a press that releases immediately
  is a wobble. This is §6 B3's own reasoning and it is register-independent.
- **the release** — the wind-up. Breakdown at **85–93 %**: hold near the pressed
  pose, then go.

**And the substitution fires on the first frame after the release has fully
arrived — zero overlap.** That is not a taste call, it is the corpus's structure:
`online-reference-mechanics.md` §9.1 measured `origami-logo-fold` as built the way
the board wants — *"the fold-down transit ends at f216, the uncover starts at
f217, no overlap by a frame"*, and again on the second cycle. One thing at a time,
enforced by adjacency rather than by argument. It also gives F5 a free property:
the pose is identical either side of the change, so the only difference between
the two frames is the ink.

### B3 — the interval between F5 and F6

One event then a group, so one interval matters. The measured candidates:

| interval | source | character |
|---|---|---|
| **667 ms** (20 fr) | EC's shuffle, *"exactly, twice"* | a beat you can count |
| 459 ms median (333–542) | Babbu's cascade, hand-placed | a rhythm |
| 233 ms | DF's stamps, *"the only perfectly regular interval anywhere"* | a metronome |
| 67 ms | DF's glyph resolve | *"the eye registers THAT something changed, never WHAT"* |

**667 ms.** It is the only one measured as exact and repeated, and 67 ms is
explicitly the wrong end — F5's whole job is that the eye reads *what* changed.

### B4 — the payoff hold

Measured payoff holds: Desk Doodles set **958 / 1210 / 400–967 ms**; online set
**1752 / 2135 / 3080 / 3270 ms** — *"roughly triple the original set's, and 2–3×
longer than the move that earned it."* Our register is Desk Doodles'; the genre
that performs our move is the online set. **1.2 s** (Babbu's own) is the
recommendation, with the online band as the ceiling and the arithmetic reason to
reach for it in §6.

### B5 — the exposure grid

**Twos, on everything except the draw.** `PARKED_PHASES` (`lib/hero-motion.ts:110`)
exists because *"it is dangerous to animate on double frames during a table move
or camera track"* — which in 2D excludes nothing, because there is no camera. So
the whole beat is eligible except `draw`, and `draw` is excluded for the same
hand-feel reason stated at `:105-108`: *"the draw-in is the one passage whose
motion IS the pen's own speed: quantising it quantises the handwriting."*

Twos has a second, independent justification here that the 3D beat does not get:
`online-reference-mechanics.md` §9.2 — *"In a 12-fps-on-24 film every held instant
is byte-identical by construction."* On the twos grid, F5's substitution occupies
two identical frames automatically rather than by an authored dwell.

---

## 6. The exposure sheet

30 fps. Director's shorthand per Whitaker/Halas/Sito p. 19 — `───` hold ·
`∿` action · `◠` anticipation · **✕** must happen on this exact frame.

> ⚠ **THIS IS A BUDGET, NOT A MEASUREMENT.** Every duration below is either
> ported from a measured value (named in the last column) or arithmetic on those.
> Nothing here has been rendered. The 3D beat's own ledger is a measurement —
> `assert-hero-ledger.mjs`, run above, **371 frames / 12.37 s, 36.1 % read
> stillness** — and this table is what the equivalent assertion would have to
> check.

| frames | t | n | shot / action | notation | derived from |
|---|---|---|---|---|---|
| 0–9 | 0.00–0.33 | 10 | **F1 — THE PAGE.** Empty, ruled. | `───` | all4's 2 empty frames; EC's 625 ms |
| 10–149 | 0.33–5.00 | 140 | **F2 — THE HAND ARRIVES.** Pen writes at its own clock. On ones. | `∿` | 100 ms floor; 16.805 s record; r 0.8412 |
| 150–182 | 5.00–6.10 | 33 | **F3 — THE MARK.** Fused, held, byte-identical. | `───` | `breath: 1.1`; accents bought with holds (4292 / 2586 ms) |
| 183–188 | 6.10–6.30 | 6 | **F4a — THE PRESS.** Weight on, `easeOutStrong`, arrival-spaced. | `◠` | `compressSec: 0.2` |
| 189–191 | 6.30–6.40 | 3 | **F4b — HELD PRESSED.** | `───` | `holdSec: 0.1`; §6 B3 |
| 192–199 | 6.40–6.67 | 8 | **F4c — THE RELEASE.** Wind-up spacing, breakdown at 85–93 %. | `∿` | 292 ms = the shorter of the set's two transition lengths |
| **200–201** | **6.67–6.73** | **2** | **★ F5 — THE LIFT.** One junction. Paper where ink was. Substitution, no in-between. Two frames = one state on the twos grid. | **✕** | 6 one-frame substitutions; zero-overlap adjacency (f216→f217) |
| 202–219 | 6.73–7.33 | 18 | **the clean read.** Nothing moves. | `───` | the remainder of B3's 667 ms stagger; clears EC's *"333 ms fully settled before anything changes"* twice over |
| **220–221** | **7.33–7.40** | **2** | **★ F6a — THE ORDER.** The rest land, one frame. | **✕** | EC's stagger, exactly 667 ms from F5's onset |
| 222–311 | 7.40–10.40 | 90 | **F6b — HELD.** Dead still. | `───` | payoff hold, online set's band |
| | | **312** | **total — 10.40 s** | | |

**Held, budgeted:** 10 + 33 + 3 + 18 + 90 = **154 frames = 49.4 %** genuinely
stopped, before counting twos repeats in F4 and F5 (a further ~9). Against C8's
**36 %** bar, taken from Exquisite Corpse's own payoff unit. **Moments: 2.**

**And the number that matters most, stated because it is uncomfortable.** The
accent — F5 — sits at frame 200 of 312 = **64.1 %** of the beat, before : after
= **1 : 0.56**. The reference placements:

| | accent at | before : after |
|---|---|---|
| Babbu — the word-flip thesis | 39.2 % | 1 : 1.55 |
| Exquisite Corpse — the reveal | 48.8 % | 1 : 1.05 |
| **this board** | **64.1 %** | **1 : 0.56** |
| Doodle Fonts — the wordmark resolve | 91.3 % | 10.5 : 1 |
| the online set (four clips) | — | 1 : 1.5 to 1 : 3.5 |

We are late, and we are late for a reason that cannot be traded away: the
draw-in's 4.667 s is derived from the **100 ms** hand floor, and shortening it
puts the pen back above human speed. Three responses, and the pick is Sebs's
(§9, call 5). One of them is that a late accent is *defensible*: Doodle Fonts is
the genre-neighbour — a type/doodle product film — and it puts its accent at
91.3 % and holds 400 ms.

---

## 7. What the gates must assert

The 3D set is `scripts/verify/assert-hero-transition.mjs` plus
`scripts/verify/lib/hero-moment.mjs`. **It must be split, not edited** — §0.7,
and because §11.8's items 6 and 8 are exactly what happens when a gate is left
pointed at a phase whose meaning changed underneath it (*"a gate that cannot pass
rather than a gate that failed"*).

| 3D gate | 2D verdict |
|---|---|
| 1 · flat beat is ONE VALUE (sd < 1) | ✅ **keep, and promote it** — in 2D this is not one phase's law, it is *every frame's* |
| 2 · flat beat has NO specular | ⚠ **VACUOUS BY CONSTRUCTION — declare it, never pass it.** There is no specular path in a canvas. A green row that cannot fail is the lie |
| 3 · held ¾ has real tonal range | ✗ **INAPPLICABLE — delete, do not repoint.** There is no ¾ and no tonal range. Repointing it is precisely bug #8 |
| 4a · no value wash | ✅ **keep, and it gets stronger** — see G2 |
| 4b · registration | ✅ **keep, and it needs a mutation control more than the 3D one did** — in 2D it passes for free (§3 item 1), so without a control it is a row that cannot fail |
| 5 · the beat contains a MOMENT (extent < 5 % of settled, ≥ 2 frames, centre < 1 px, sliver not blank, recovery ≥ 90 %) | ✗ **INAPPLICABLE.** The 2D moment does not collapse the extent — nothing narrows. Replace, do not loosen |
| 6 · stillness, net over the window across all of extent | ✅ **keep, and tighten** — in 2D a hold means *byte-identical frames*, which is cheaper and stronger than net displacement |

**And the four the 2D register needs that no 3D gate expresses:**

**G1 · THE MOMENT — local, not global.** *In a disc of radius 3 ink-diameters
about the junction, ink coverage steps by ≥ 25 % in one frame; outside that disc
not one pixel changes.* A whole-word ink fraction is the wrong instrument and it
is worth saying why: one break removes on the order of one ink diameter of
centreline, which on the traced word is under **1 %** of total ink — invisible to
a global statistic and unmissable to the eye. This is the same class as the
containment metric that was *"structurally incapable of failing"* and the area
metric that was *"BLIND TO DIRECTION"* (§11.8 item 7). The second clause is *one
thing at a time*, made checkable.

**G2 · NO VALUE IS EVER INVENTED.** *The interior histogram is bimodal — ink and
paper — with nothing in between beyond the antialiased boundary ring.* This is
gate 4a re-expressed for a register where the only legal values are two. Its
mutation control is the banned build: ramp the break's alpha and the row must go
red. **This is the gate that makes the alpha-ramp ban checkable instead of
commented.** Note the measurement trap already recorded in
`hero-2d-to-3d-transition.md` §7 — *"any statistic over a luminance-gated mask is
measuring the edge unless it was told not to"* — so the interior must be eroded
first, as §3 K3 already does (*"only the face's dark core (luma < 60)"*).

**G3 · THE PEN ORDER IS LEGIBLE, AND IT IS THE RIGHT ORDER.** *At F6, for every
opened junction, the stroke drawn LATER is whole and the stroke drawn EARLIER is
broken.* Checkable against the record, because the record is the stroke indices.
Its control is trivial and mandatory: invert the order and the row must reject —
and `buildJointBreaks` already documents the failure this catches, five junctions
of 22 where an earlier draft cut a *later* stroke, *"one of them removing 37.9
units… which would have asserted the reverse of the news."*

**G4 · THE BEAT IS ON TWOS WHERE IT CLAIMS TO BE.** `assert-hero-twos.mjs`
already exists for the 3D beat (6/6). In 2D the parked set is everything but the
draw, so the same assertion has more to check and a simpler predicate: adjacent
frames byte-identical on the grid, and *not* byte-identical off it.

---

## 8. Does the round trip mean anything in 2D, and what K7's news is here

**The 3D round trip's claim does not exist in 2D.** `HeroReturn`'s own header:
*"Going one way asserts a conversion. Coming back asserts an IDENTITY, which is
the pitch."* In 2D nothing was converted. The mark never stopped being a drawing,
so there is no identity to assert by returning.

**But there is a different round trip available, and it is not empty:** open →
closed. What it would assert is *the order was always there; you only just saw
it*. That is a real claim, and arguably a truer one, because it says the news was
revealed rather than added.

**The evidence is against taking it**, and it is 3-for-3 plus a mechanism: all
three reference films end on the changed state and hold it, and the one clip that
closes its occlusion does so because it is a looping template with a second
payload (§4 F7). **Recommendation: end open.** What the other branch costs: a
beat that ends on a mark carrying an annotation reads as a diagram of a drawing
rather than as a drawing. What *this* branch costs: the second half of the beat
has to be bought some other way, which is §6's placement problem and §9 call 5.

**And the sharpest structural finding on this page:** K7's news — *"at every
junction that has an over and an under to show, a hairline of PAPER, with the
LATER-drawn stroke passing through unbroken in front"* — **is a 2D-register
device living in the 3D beat.** It is a property of the drawing, not of the
renderer, which is why its law is in `lib/flat-ink.ts` and not in the viewport.
The consequence is not that the 3D beat should give it up. It is that **the 2D
beat cannot use it as a return, because it is the 2D beat's entire moment.** Each
register gets one thing to say; the 3D register's is thickness; the 2D
register's is order. The 3D beat says both because it can. The 2D beat has one,
and it has to spend it in the right place.

---

## 9. Decided vs Sebs's call

### Decided, because it is measured

- **Nine of the twelve phases have no 2D expression, and three of the four
  devices the beat is built from are unavailable.** §1.2.
- **The progress model ports and the mechanism does not** — the clock agrees to
  **0.00e+0** with both controls failing, run first-hand; the mechanisms are
  polyline truncation against `setDrawRange` over a counting-sorted index buffer.
- **The draw-in's 4.667 s ports unchanged**, because every number in its
  derivation is clock rather than renderer.
- **The 2D register's only occlusion device is its record of authorship**, and
  the corpus's answer to *change a flat state without shading it* is occlusion,
  7/7 and 14/14 against two controls.
- **The moment is a substitution, not a transit** — six one-frame instances
  across two reference sets, and the alpha ramp is banned by the value law.
- **It is one junction, not twenty-two** — the 100:1 separation, simultaneity 1,
  and what I watched happen in `zoom-open.png` and `k7-open.png`.
- **The board's "crossings resolve into over/under" is wrong on this word** —
  one true centreline intersection in 22 strokes, and its partner is a
  three-point tick four units wide. The device is a fusion-boundary device.
- **The whole beat is eligible for twos except the draw**, for the same two
  reasons the 3D beat's parked set is what it is.
- **Gates 3 and 5 are inapplicable and gate 2 is vacuous** in 2D, and each must
  be declared rather than repointed or passed.

### Sebs's, and each of these is a call I am not making

**Call 1 — is the 2D beat its own beat, or a stripped copy of the 3D one?**
Everything above says *its own*, and I would take that: a 2D register that runs
the 3D beat with nine phases deleted is the degraded-copy outcome by
construction, and its remaining three phases are all setup. The cost of taking it
is real, though, and it is not small: two beats means two boards, two exposure
sheets, two gate sets and two things to keep in step, and the product then has to
be legible as one thing anyway. The cheaper branch — one beat, 2D as a subset —
buys consistency and spends the 2D register's only claim.

**Call 2 — is the wind-up a press, or an absence?** I would take the **press**,
because it is in the register's own vocabulary (*value = mark density…
pressure*), it needs no cut, and it puts the tension in the mark rather than
around it. The absence branch is the stronger *reference* — it is the single
biggest device in the whole corpus, EC buys its accent with 625 ms of a frame at
exactly 0.000, `all4-idents` spends exactly two frames on it before every build,
and the two biggest accents in the set are preceded by 4292 ms and 2586 ms of
frozen frame. What it costs is that our beat is one continuous take on one page,
so removing the mark is a cut, and a cut between two near-identical framings is
the textbook jump cut — *"a device of disorientation"* (`storyboarding.md` §4).
There is a middle branch nobody has costed and it is the one I would explore
first if he wants absence: **partial absence** — everything except one stroke —
which is literally what Exquisite Corpse does for 7.8 s before its payoff
(*"the browser canvas shows only the head section. You never see below the
fold"*), and which does not undo the draw.

**Call 3 — what happens at the `esk` cluster.** I would **leave it fused** and
open only the junctions that have an over and an under to *show*, on the same
principle `buildJointBreaks` already applies when it drops a break that opens
nothing: *"Those junctions are not weak news, they are no news."* The cost is
that the word's densest, most characterful region is the one place the beat says
nothing, and a viewer who looks there first sees the least. The alternatives —
merging four breaks into one, or narrowing `breakK` locally — both keep the news
everywhere and both risk the shredding I saw.

**Call 4 — does the beat close?** I would **end open**, on 3-for-3 plus the
looping-template mechanism (§8). The cost is a final frame that reads slightly
like an annotated drawing rather than a drawing, and the counter-argument is
placement (call 5).

**Call 5 — how the second half of the beat gets paid for.** Our accent lands at
64.1 % against Exquisite Corpse's 48.8 %, and the draw-in's length is not
available to trade. Three branches. **Lengthen the payoff hold** into the online
set's 1.7–3.3 s: it is the genre that performs our move, it costs nothing but
runtime, and it moves the accent to about 55 %. **Add the close** (call 4): it
buys a second moment and a second hold and lands near 50 %, at the price of §8's
verdict. **Accept the placement**: Doodle Fonts is the closest film in the corpus
to what this product is and it accents at 91.3 %, so 64 % is not out of family. I
lean to the first, because it is the only one that is free.

**Call 6 — the drawing primitive.** `flat-ink.ts:152` draws a constant-width
round-cap monoline. The register's own spec is `perfect-freehand` at
`size 4, thinning 0.5, smoothing 0.7, streamline 0.78` as a filled polygon in
`#121110`, and `stroke-width-models.md` says the monoline is *written into the
definition of stroking in every graphics API*. This is a call because it changes
what the mark IS, not how it moves, and F3's whole content is that the outline is
the pen's. Left as his because *how heavy the pen is, is a brand call and not a
bug* (explainer 08 §3, on the sibling question).

---

## 10. What cannot be answered without building — and the smallest experiment for each

Each of these is a node experiment on `@napi-rs/canvas` unless it says otherwise.
None needs a GPU, a browser or a dev server, because `lib/flat-ink.ts` and
`lib/pen-reveal.ts` are pure and `assert-drawin-2d-parity.mjs` already
demonstrates the whole harness.

**1 · Does an isolated break read as a pen lift, or as damage, at real scale?**
I have one data point per reading and they are 200 px apart in the same frame.
*Smallest experiment:* render the word through `makeFlatRenderer` at the hero
footprint, apply `buildJointBreaks` at three values of `breakK` (0.25 / 0.35 /
0.5), tile all 22 junctions per value into one contact sheet at 1:1 **and** at
3×, and look. No new law, no new renderer — the break geometry already exists as
data. **~1 hour.**

**2 · Can the gap grow at all, or must it pop?** §5 B1's open half. *Smallest
experiment:* rasterise one break at gap widths from 0 to `0.35 × D` in ⅛-px
steps, erode the interior mask by 3 px (per `hero-2d-to-3d-transition.md` §7) and
measure SD at each width. If SD crosses 1.0 above about one pixel of gap, the
break **must** be a substitution and B1 is settled by measurement rather than by
argument. **~1 hour.**

**3 · What amplitude does the press need to read?** F4's admission test is
borderline and amplitude is exactly the kind of thing this repo has learned not
to argue about. *Smallest experiment:* the width channel is not wired into
`flat-ink.ts` at all, so this needs a real (small) build — a width multiplier on
the stroke — and then a static A/B at rest, +10 %, +20 %, +30 %, judged by eye at
real scale. **Flagging honestly: this one cannot be answered by measurement, only
by his eye.**

**4 · Is a 20 px round-cap monoline the mark?** Call 6's evidence. *Smallest
experiment:* render the same word at the same footprint through the current
renderer and through the register's own `perfect-freehand` parameters, and diff
the silhouettes — width spread, terminal shape, junction shape. It answers
whether the monoline is a defect or a decision. **~2 hours, one dependency.**

**5 · Is F1 a shot, or a blank?** It passes the admission test only with the
page's ruling and there is no engine for a ruling anywhere in this repo.
*Smallest experiment:* a still — paper, baseline, margin, ink height marks, at
the hero framing — as an image, not a build. If it does not read as a page
waiting to be written on, F1 is an in-between and the beat opens on F2a instead.

**6 · Does the beat FEEL right?** It cannot be answered here, by anyone, from
anything on this page. The board's own §11.6 makes the same admission and it is
the right one to end on.

---

## 11. What this board did not do

- **Nothing was built and nothing outside this file was written.** `lib/`,
  `components/`, `app/`, `scripts/`, `docs/research/`, `docs/explainers/`,
  `docs/hero-beat-storyboard.md` and `SESSION-HANDOFF.md` were read and, where an
  assert existed, run. Three other lanes are live in them.
- **No browser was launched.** Every number here is either from a checked-in
  measurement, from a node assert I ran, or from a frame I opened.
- **No new online research.** The two measured corpora
  (`reference-film-mechanics.md`, 2 942 frames; `online-reference-mechanics.md`,
  11 clips / 10 373 frames) already contain the cases this board needed, and each
  belongs to a lane that owns it. Where they are **silent** — and they are silent
  on the two things most specific to this proposal, a mark occluding itself and
  a held frame inside a transform — that silence is quoted rather than filled.
- **The exposure sheet in §6 is a budget, not a measurement**, and it says so
  where it stands.
- **I did not re-derive the junction set.** It is measured once, by
  `findHeroJunctions` in `app/desk-doodles/page.tsx`, and a second measurement of
  *where does this word touch itself* would be the two-sources-of-truth failure
  this repo keeps paying for — `lib/flat-ink.ts:334-336` says so in its own
  header.
- **One stale citation found in passing, not fixed** (not this lane's file):
  `lib/hero-motion.ts:757` cites `flat-ink.ts:59` for
  `INK_DIAMETER_IN_STROKE_SPACE`; it is at **`:97`** today. Line numbers rot —
  the contract's own warning, and this is a live instance of it.
- **Not verified:** that the 2D register can hold up at hero scale on paper at
  all. Everything in §4 assumes the mark reads as a mark at the framing the hero
  uses, and the only evidence I have for that is
  `docs/verification/drawin-frames/after/dd_dense.png`, which is the **3D**
  register's draw-in at a small stage scale and reads convincingly as
  handwriting. That is encouraging and it is not the same thing.

---

*Written against `docs/research/storyboarding.md`, the same method as
`docs/hero-beat-storyboard.md`. Method reusable via
`.claude/skills/storyboarding/SKILL.md`.*

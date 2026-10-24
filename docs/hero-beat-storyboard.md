# The Hero Beat — Storyboard

*Key shots first, then breakdowns, then in-betweens. The beat was built as a
parameter model — durations, easing curves, camera dials — with no board behind
it, which is backwards, and this is the board it never had.*

> **§10 is a later pass (2026-07-30).** It reconciles this board against two
> documents that landed after it — `docs/research/reference-film-mechanics.md`
> and `docs/explainers/18-the-reveal-stopped-rebuilding.md` — **corrects four
> claims the board rested on**, verifies §8's gate rewrite by running it, and
> closes §9's four open calls with a recommendation each. Where §10 corrects a
> passage, that passage carries a **⚠** or **✗** note in place. Read those notes;
> do not build from an uncorrected paragraph.

> 🔨 **§11 is a later pass again (2026-07-31), and it changes how §1–§9 must be
> read: THE BOARD HAS BEEN BUILT.** The turn (K3′), the ease-out-dominant rise,
> the phase reorder, the 1.1 s breath, the parked camera and the whole §8 gate
> rewrite have all landed in `lib/hero-motion.ts` and `scripts/verify/`, and
> there is a real capture of it at `docs/verification/hero-transition/turn3/`.
> **§1–§9 were written about a beat that no longer exists.** Every passage that
> is now false carries a **✓ BUILT** or **⚠** note in place — §7's exposure sheet
> is wrong in its durations throughout, and §9's "nothing was built" is wrong
> outright. Three things are still OPEN and two of them are failing gates
> (§11.4). Read §11 before acting on any of §1–§9.
>
> 🔨 **§11.7 and §11.8 are a later pass again (2026-07-31, evening), and the
> sentence directly above is the first thing they correct. NOTHING IN §11.4 IS
> OPEN. Both failing gates are closed — one of them by being ruled a
> non-defect — and so are the other three.** K4 and K7 are BUILT, so §7's four
> turns are four and its two moments are two; the contact-shadow channel is
> closed and root-caused; the camera's two seams are closed; and **the draw-in
> is the headline correction — it was never a lesser system, it was explainer
> 18's real reveal being fed a metronome** (§11.7.7). §11.3's three instrument
> bugs are now **eight** (§11.8).
>
> **AND ONE NUMBER IS STILL WRONG AND IS BLOCKING A FIX: the draw beat.** The
> word is drawn at **7.88× the speed of a real hand**, `assert-hero-ledger.mjs`
> asserts `draw: 64` frames against §10.3's stale ledger, and §10.3's ledger has
> been **RE-CUT** — twelve rows, `draw` at **140 frames / 4.667 s**, beat total
> **371 frames / 12.367 s**. Read the re-cut, not the table above it, and not
> §11.2's table either.
>
> 🔨 **§11.9 is a later pass again (2026-08-01), and the paragraph directly above
> is the first thing it closes: THE RE-CUT IS SHIPPED.** `beats.draw` is
> **140 frames / 4.6667 s** in the model, the beat is **371 frames / 12.3667 s**,
> and `assert-hero-ledger.mjs` reads **4/4 · SOUND** against it with 4/4
> correctly failing on the prior beat. The hand is at **3.60×**, not 7.88×.
> **§11.2's table is superseded by §11.2a**, which is the live one.
>
> Also landed and recorded: the wind-up now **releases INTO the turn** (§11.9.1);
> the dead-dial sweep found **eight**, and the panel is **31 live of 31**
> (§11.9.2); **K7's news RENDERS**, 8/8 on pixels (§11.9.3); **gate 1 is blind to
> a uniform re-value** and the board leans on gate 1 (§11.9.4); a shader trap
> that presents no frames while every diagnostic reads green (§11.9.5);
> `motion.mjs` regenerated **again** and now diffable against the model
> (§11.9.7). §11.8's eight instrument bugs are now **eleven**, and the three new
> ones are a class — scripts named `assert-*` that cannot fail — which now has
> its own standing meta-gate.
>
> **ONE GATE IS OPEN: `max cy step 2.00 px` against a ceiling of 2** (§11.9.6).
> `cx` is at the instrument's floor, so §11.7.1's projection fix is holding; the
> vertical axis alone is exactly on the ceiling. It belongs to another lane and
> is recorded, not diagnosed.
>
> ⚠ **THE STILLNESS MARGIN IS UNDER ONE FRAME.** 134 of 371 = **36.1 %** against
> C8's **36 %** bar. Drop one repeat frame and the row goes red. Anyone retiming
> a phase should read §11.2a before, not after.

**Method and sources:** `docs/research/storyboarding.md`.
**Thumbnails:** `docs/storyboard/key-shots.png` · `timing.png` · `ink-evidence.png` ·
`breakdowns.png`. Prose is not a storyboard; read the sheets alongside this.
**Foundation:** `docs/reference-original/compose.ORIGINAL-FLIP.mjs` (commit
`f9010da`) → `scripts/capture/desk-doodles-traced.webm`, `desk-doodles-font.webm`.
**Current:** `lib/hero-motion.ts` → `scripts/capture/desk-doodles-hero-v2.webm`.
⚠ **That film is superseded twice over** — it records the pre-fix stall (§10.3)
*and* predates the built turn. **The live evidence is
`docs/verification/hero-transition/turn3/`** (120 scrub frames, a 72-frame dense
emerge window, 0 console errors), judged by `scripts/verify/assert-hero-turn.mjs`,
`assert-hero-rise.mjs` and `assert-hero-transition.mjs --label=turn3`. §11.
The thumbnail sheets above show the *old* beat and have not been re-rendered.

⚠ **`turn3` IS NOW A HISTORICAL ARM TOO** (2026-08-01). It was shot 2026-07-31
13:50, before K4, K7, the retiming and the orthographic camera. It still runs and
still reads **8/9**, and the two `--gates=prior` arms taken from it are what make
§11.1.5's diagonal readable — so it is kept, not replaced. **The current capture
is `docs/verification/hero-transition/k7final/`** (2026-08-01 00:33), also 8/9,
and it is the one §11.9's numbers come from. There are now thirteen labels under
`docs/verification/hero-transition/`; the two that matter are named here.

The calibration this is designed against, verbatim:

> *"the morph is just subtle, like it's ehh — not ugly, just lame."*

**Not ugly** means the execution is fine, and it measurably is: seven of seven
craft gates pass. **Lame** means it has no dramatic weight. So this board's
question is not *how do we get from flat to 3D smoothly* — that problem is
solved. It is:

> **Where is the moment, and what happens at it?**

---

## 1. The diagnosis, proved three ways

Not an opinion. Each of these is a number already in the repo, or one measured
from a film already on disk.

### 1.1 The stated intent

`scripts/capture/motion.mjs`, in the comment above the handoff beat:

> **"The transition being near-invisible is the point."**

That sentence is the whole finding. The beat is not failing to have a moment —
it was **specified not to have one**. Everything below follows from it, and it
is why tuning cannot fix this: you cannot tune your way out of a design goal.

### 1.2 The gate

`scripts/verify/assert-hero-transition.mjs`, run just now on the checked-in
capture:

```
PASS  silhouette never jumps while the camera is parked
      max centre shift 0.00 px (< 4), max width step 0.00 px (< 6) across 31 frames
PASS  the change is gradual, not a cut
      tonal-range span 11.0, largest single-frame step 1.2 (needs < 4.9)

7/7 gates passed on "after"
```

Read those two as a storyboard artist would.

- **Gate 4** says the silhouette does not move. It is passing at **0.00 px**
  across **31 frames** — 1.03 seconds in which the extent of the thing on
  screen is *pixel-identical*. Nothing on screen has a before and an after.
- **Gate 5** is named **"the change is gradual, not a cut"** and its pass
  condition is `largestStep < span × 0.45`. That is **a formal upper bound on
  how much may happen in any one frame.** It is currently passing with the
  biggest single-frame event in the beat carrying 11% of the total change.

The codebase contains a machine-enforced prohibition on having a moment. The
beat is lame *by contract*.

> **✓ THE CONTRACT IS GONE, AND THE PROHIBITION WAS REAL — §11.1.5.** The gate
> quoted above is the parked arm now. Re-run 2026-07-31 against the built turn:
> `assert-hero-transition.mjs --label=turn3 --gates=prior` reads **4/7**, failing
> at `max width step 140.00 px` (ceiling 6) and `largest single-frame step 13.0`
> (ceiling 10.8) — **the shipped beat now violates the prohibition on purpose.**
> The default gate set on the same capture reads **7/9**, with `the beat contains
> a MOMENT` and `...and the moment is a SLIVER` both PASSING. The two rows that
> still fail are a different pair, and they are open (§11.4.1–2).
>
> The `7/7 PASS` block above is still reproducible, on the *pre-turn* capture:
> `--label=after --gates=prior`. Both arms are kept runnable on purpose — that
> diagonal is what shows the change actually changed something.

**These gates are not wrong.** They were written to kill a specific, real
defect — a two-canvas crossfade that mis-registered, documented at
`docs/research/hero-2d-to-3d-transition.md` §3 (four independent registration
failure modes, "a 2px offset at the handoff is visible as a jump"). Gates 1–3
are pure craft and must survive untouched. The error is narrower and is in
gate 4 and gate 5 only: **they conflate *registration*, which must hold, with
*continuity of extent*, which a moment must break.** §8 separates them.

### 1.3 The measurement

`docs/storyboard/tools/segment.mjs` reads the encoded films per frame and falls
out a beat structure from the pixels rather than the source. A *moment* is
defined operationally as an instant with a before and an after — a single-frame
step large enough to read as an event.

| | duration | held still | moments |
|---|---|---|---|
| **ORIGINAL** `desk-doodles-traced.webm` | 8.90s | **45%** | **2** |
| **CURRENT** `desk-doodles-hero-v2.webm` | 9.82s | **9%** | **0** |
| **PROPOSED** (this board) | 8.90s | 37% | 2 |

The current film is 10% longer, holds still for a fifth as much of its runtime,
and contains no instant at which anything happens. 45% of its runtime is drift
too slow to read as an event at all — 9 px of lateral creep over 4.43s.

> **⚠ Two amendments from §10, neither of which changes the conclusion.**
> **(a)** The CURRENT row was measured on `desk-doodles-hero-v2.webm`, a
> real-time capture dated 2026-07-29 — *before* the 1.1 s reveal stall was fixed
> on 2026-07-30. Its emerge received zero rendered frames, so the film's tempo is
> the stall's, not the beat's (§10.3). The **0 moments** finding survives and
> hardens: even in the capture where the emerge is compressed into a single
> frame, the extent still never changes. **(b)** The drift is not a curve
> under-shooting its target — it is a device built on a claim that 114 seconds of
> reference film disproves, and the centre in fact *arrives* (net 0.0 px over the
> final 40 frames). What never arrives is the size. §10.2 C1.

> **✓ THE TABLE NEEDS A FOURTH ROW — the BUILT beat, measured on `turn3` (§11.2).**
> **11.18 s · held 46.5 % · moments 1.** Compare it to the PROPOSED row, not to
> CURRENT: it runs 2.28 s longer than the plan, holds still for **more** of its
> runtime than the plan budgeted (37 %, against §10.2 C8's 36 % bar), and carries
> one genuine moment where the plan wants two. The missing one is the **return**
> turn, which is unbuilt (§11.4.4) — not a failure of the mechanic, which is
> gated 8/8 (§11.1.1). And the drift this row's prose describes is gone outright:
> 4.04 s of the runtime is now a frame that does not change by a single pixel
> (§11.1.4).

### 1.4 The sharpest version

`lib/hero-motion.ts` states, in its own doc comment, the thing that undoes it:

> *"Head-on, depth is nearly invisible — a tube seen down its own axis has the
> same outline whether it is 1mm or 10mm thick."*

The beat's one **physical** event is the mark acquiring thickness. That event is
staged dead-on, at the one camera angle where the file itself says thickness
cannot be seen. Gate 4 is the receipt: **the depth went from ~0 to full and the
silhouette did not move by one pixel.**

What is left to carry the beat is the light — and the light is a fade. Trace the
degrees of freedom:

| driven by | what it moves |
|---|---|
| `depth` | the form's z-scale — *invisible at this camera angle, by the file's own note* |
| `flat` | albedo, emissive, fresnel rim, env/reflectivity, **and** the contact shadow (`viewport-3d.tsx:3036` — `opacityScale={1 - flatten.ink}`) |

**Two scalars, one of which does not show.** Every visible thing in the beat —
including the contact shadow, the one element that could plausibly have *landed*
— rides the same single ramp on the same curve. Nothing has its own timing.
Nothing is caused by anything else.

That is what "it simply becomes" means, and it is why *lame* is the exactly
right word.

> **Correction to the earlier board.** An earlier pass recorded that K4 "has no
> shadow." That is wrong — the contact shadow is real, ported, and live
> (`studio-rig.tsx`, `CONTACT_SHADOW`). The accurate and more damaging finding is
> the one above: it exists but is tied to the same scalar as the light, so it
> **fades up instead of landing**. Corrected here rather than carried forward.

### 1.5 The finding that decides the mechanic

Run the original flip's numbers against the current gates.

Original, `desk-doodles-traced.webm`, the turn (measured at native 1920, full
word width 820 px):

| frame | t | bbox w | ink px | face dark-core |
|---|---|---|---|---|
| f152 | 5.07 | 473 | 8725 | 19.18 |
| f153 | 5.10 | 269 | 3988 | 18.05 |
| **f154** | **5.13** | **28** | **410** | **17.95** |
| **f155** | **5.17** | **28** | **410** | — |
| f156 | 5.20 | 476 | 4967 | 22.71 |

- **Gate 4 (centre)** — cx runs 479.0 → 479.5 through the whole turn. **PASSES**,
  by half a pixel, and by construction: both faces are scaled about the same
  point. Registration was solved by construction, not by measurement.
- **Gate 4 (width)** — the extent steps **241 px in one frame**. **FAILS** the
  6 px ceiling by forty times.
- **Gate 5 (gradual)** — one frame carries essentially the whole change.
  **FAILS.**

**The gates as written would reject the only thing in this project that has a
moment.** That is the proof that the fault is in the criterion, not in the film.
And it tells us precisely which half to keep: **hold the centre, break the
extent.**

> **✓ CONFIRMED ON OUR OWN FILM, not just on the original (§11.1.5).** This was
> an inference from the original's numbers; it is now a measurement of ours. The
> prior gates run against the built turn reject it at `max width step 140.00 px`
> — twenty-three times the 6 px ceiling — while the corrected registration gate
> reads `max cy step 1.00 px`. Extent broken, one axis of registration held.
>
> ⚠ **The other axis is NOT held, and that is the open defect.** `max cx step
> 24.50 px`, needs < 2. So "hold the centre, break the extent" is currently
> **half achieved**: we broke the extent and did not hold the centre. §11.4.1 has
> the per-frame series and the mechanism; a lane owns it.

---

## 2. What admits a shot to this board

Whitaker, Halas & Sito (*Timing for Animation*, p. 54), on which drawings can
carry a hold:

> *"A held drawing can usually be extracted from the animation and works when
> framed and hung on the wall, whereas most animation drawings do not."*

That is the admission test, and it is a hard gate here: **a key shot must be a
frame you could freeze and print.** Williams supplies the other half — a key is
*"the storytelling drawing… the drawing that shows what's happening in the
shot."* Not the prettiest frame; the one that carries the information.

So each shot below is named for what it *tells*, never for which phase it
belongs to, and each states four things: what is on screen, where the camera is,
what the mark is doing, and **why the shot exists**. A shot that cannot answer
the fourth is an in-between with ambitions.

---

## 3. The key shots

**Sheet: `docs/storyboard/key-shots.png`** — seven panels in order, real frames,
each with a camera inset (page in cross-section, orange = the mark's thickness,
dot = the eye).

### K1 — THE PEN LIFTS · *status: exists, wrong silhouette*

- **On screen** the finished word, flat, dead-on, filling the frame.
- **Camera** el 0°, az 0°, parked.
- **The mark** at rest. Nothing moving. The last pen-lift is the newest thing on
  screen.
- **Why it exists** it establishes the subject as a **MARK**, and it fixes the
  framing every later shot is judged against. K4 and K7 both return to this
  exact framing; without K1 there is nothing for them to be *a return to*.

**What is wrong.** The silhouette is a tube's, not a pen's: blunt round
terminals, constant width, bulges at the joints, bbox 418×99 that does not
change by one pixel through the entire handoff. A pen's outline tapers and
varies. This one cannot — it is a 3D tube with its shading zeroed, and a tube
seen head-on still has a tube's outline. See `ink-evidence.png` panel B: one ink
value (sd 0.00, which gate 1 correctly rewards) inside the wrong shape.

Disney, quoted in *The Illusion of Life* — *"Work in silhouette so that
everything can be seen clearly."* The flat state passes every **value** gate and
fails the **shape** test, and no value gate can see that.

### K2 — THE MARK TENSES · *status: exists, wrong place, wrong pose*

- **On screen** the same word, still flat, still dead-on, pressing *down* into
  the page and widening slightly.
- **Camera** el 0°, parked.
- **The mark** anticipation. Compress, then **hold** the compression.
- **Why it exists** a 2D squash is the only wind-up available to something with
  no thickness. It is also the only shot that makes the moment *expected* — the
  audience has to know something is about to happen before it happens, or the
  event reads as a glitch.

**What is wrong.** It fires at 4.43s — **1.33s after the mark already went solid
at 3.10s**. Anticipation *after* the event is not anticipation, it is a hiccup.
And it fires at el 65°, where the word is a 47 px-tall black bar: the squash is
measurably 0.80s of ±3 px jitter on an illegible frame.

> **⚠ HALF FIXED, AND THE OTHER HALF IS A NEW DEFECT — §11.4.3.** The *place* is
> fixed: `HERO_PHASES` now reads `… breath · anticipation · emerge …`, so the
> tense fires dead-on at el 0°, before the moment it winds up for, exactly as §7
> always specified.
>
> **The pose is not "wrong" — it is not drawn.** Measured on `turn3`: all four
> `anticipation` scrub samples are identical *to the digit* with the twelve
> `breath` samples before them (`w 648 · h 158 · cx 559.5 · ink 28371`).
> `scaleY 0.955` should read h ≈ 151 and `scaleX 1.018` should read w ≈ 660;
> neither moves. Cause, by grep: **`squashX` / `squashY` have no render
> consumer** — `sampleHeroMotion` computes them and the only reader in the repo
> is `page.tsx:1295`, which prints them as text in the dial panel. Same class as
> §10.2 C2's dead `pushScaleEnd`, and now the second of two.

### K3 — THE EDGE · **THE MOMENT** · *status: MISSING — 0 moments in the beat*

> **✓ BUILT (2026-07-31) — the status line above is superseded. §11.1.1.**
> `emerge.mode: "turn"` is the default. The shipped gate on the real capture:
> *"the beat contains a MOMENT — extent falls to 24 px = 3.7 % of settled 648,
> held 6 fr, centre drift 0.00 px"* and *"the moment is a SLIVER, not a blank or
> a blink."* The six samples are the authored two frames at 30 fps seen through a
> 75.6 Hz capture — six samples span 66.1 ms and `dwellSec` is `2/30` = 66.7 ms.
> The count of moments in the beat is **1**, not 0. The return turn is still
> unbuilt, so it is not yet 2 (§11.4.4).

- **On screen** the word narrows to nothing. For two frames there is a
  **sliver**. Then something else is there when it comes back.
- **Camera** parked, dead-on. The camera does not participate — if it moved, the
  change would belong to the viewpoint instead of to the object.
- **The mark** turning. Occlusion is an event; a ramp is not.
- **Why it exists** **this is the beat.** A key shot is defined by being a
  moment, and this is the only instant in the sequence with a genuine before and
  after. Everything else in the board is preparation for it or consequence of it.

This shot **exists in the original and is absent from the current beat.** Its
mechanic, measured from `compose.ORIGINAL-FLIP.mjs`:

```js
const sx = Math.max(Math.abs(Math.cos(angle)), 0.035)  // clamp: never a blank frame
const shade = 0.35 * (1 - sx)                          // the face darkens as it turns
```

The clamp at 0.035 is the craft decision that makes it work: an edge-on
**sliver always survives**, so there is never a blank frame, and the eye is
never handed a discontinuity it can call a cut. Measured: 14 px wide at 960,
28 px at 1920, held for exactly **2 frames**, cx parked at 479.0/479.5.

**The shade term reaches the film.** Verified rather than read off the source —
frames re-extracted from `desk-doodles-traced.webm` with alpha, composited over
`#E9B44C`, measuring only the face's dark core (luma < 60) so the antialiased
fringe cannot contaminate the statistic:

| half | t | sx | predicted `base×(1−0.35(1−sx))` | measured | Δ |
|---|---|---|---|---|---|
| 3D face out | 5.00 | 0.863 | 20.12 | 20.51 | +0.39 |
| 3D face out | 5.03 | 0.752 | 19.30 | 20.07 | +0.77 |
| 3D face out | 5.07 | 0.577 | 18.00 | 19.18 | +1.18 |
| logo face in | 5.20 | 0.580 | 22.35 | 22.71 | +0.36 |
| logo face in | 5.23 | 0.756 | 23.96 | 24.67 | +0.71 |
| logo face in | 5.33 | 0.971 | 25.93 | 26.63 | +0.70 |

The face genuinely darkens as it turns, tracking the source's own law within
about 1 luma across the readable part of the turn. (Only at the sliver frame
does it diverge — 949 px of almost pure fringe, where the statistic stops
meaning anything. Noted rather than smoothed over.) **The lighting on the turn
is real and is already paid for.**

### K3′ — MAKE THE EDGE TRUE · **the proposal** · *extends the flip, does not revert to it*

The original's edge-on sliver is *"a very well-executed way of hiding that the
transition was never solved"* (`docs/research/hero-2d-to-3d-transition.md` §2) —
the dwell exists to give a hard face-swap somewhere to happen unseen.

**Keep the mechanic exactly. Change what is behind it.**

Replace the `0.035` clamp — a squeezed ghost of a flat raster — with **the real
form seen edge-on**, where its thickness is the only thing on screen. Same
`|cos|` width law, same shade term, same one centre, same two-frame dwell.

And this is why it costs nothing: **the clamp is 14 px wide at 960; the form's
own stroke is 13 px (median run) and the flat face's is 8.** The fake sliver and
the true edge are *the same width to within a pixel*. Continuity is unaffected.
The one frame nobody could ever see becomes the one frame that says what the
product is.

The hiding place becomes the payload. That is the whole proposal.

> **✓ NO LONGER A PROPOSAL — SHIPPED, AND PORTED RATHER THAN RE-DERIVED
> (§11.1.1).** `assert-hero-turn.mjs` checks the built beat against the original's
> own numbers straight off the sampler and returns **8/8**, with **8/8 correctly
> failing** on the parked-ramp control. Three of those rows are this section's
> claims made checkable: *the width law is the original's, exactly* (max |Δ| vs
> `|cos(easeInOutCubic(u)·π)|` clamped = **3.22e-15**), *the sliver is REAL
> THICKNESS* (**depth 1.0000 at edge-on** — without which the sliver is a
> degenerate plane and the payload is empty), and *the state change is hidden AT
> the edge* (ink flips at frame 13, edge-on at frame 13).
>
> ⚠ **One thing this section did not anticipate.** It argues the swap costs
> nothing because the fake sliver and the true edge are the same width. True —
> and the *width* is not what broke. `max cx step 24.50 px` at the dwell exit
> (§11.4.1): a real form really turned under a perspective camera does not hold
> its projected centre, and a 2D `scaleX` about one point does so by construction.
> "Keep the mechanic exactly" turns out to have kept everything except the
> property §7 lists second among the three a rebuild must not lose.

**And it puts the depth where it can be seen.** §1.4's fault was that the mark
gains thickness at the one angle where thickness is invisible. Edge-on is the
one angle where thickness is *the entire image*. The same physical event,
staged so it reads.

### K4 — SOLID, DEAD-ON, HELD · *status: exists, never held*

- **On screen** the solid form at **K1's exact framing**.
- **Camera** el 0°, az 0°, parked and stopped.
- **The mark** landing and settling. Two things arrive: the crossings resolve
  into over/under, and the contact shadow **lands**.
- **Why it exists** so the change can be *read*. K1 and K4 are the same framing;
  the audience A/Bs K4 against its memory of K1 and gets the product's whole
  claim in one comparison. A held frame is the only place that comparison can
  happen.

**What is wrong.** It exists for 0.33s, is never held, and the tilt starts ten
frames later — the camera never stops again for the rest of the film. The
over/under resolution is already rendered (`ink-evidence.png` panel C, feature 3
— the crossing resolves, and it is the *only* real news in that panel) and it is
spent in a single frame nobody is given time to look at. The contact shadow is
present but ramps on the same scalar as everything else, so it never arrives.

> **⚠ STILL NOT BUILT, and the number is now worse, not better — §11.4.4.** The
> shipped timeline runs `emerge → tilt` with nothing between them: `tilt` begins
> on the frame after the turn ends and takes the camera to el 65° over 0.7 s. So
> K4's 0.33 s is now **0.00 s**. The camera *does* stop again — but 4.04 s later
> and at the ¾, not here (§11.1.4).
>
> This is the one place where landing part of the board made another part more
> urgent. §10.2 C7's mapping is explicit: *"K4's 18 frames is the payoff of the
> absence. Do not spend it."* The absence now exists and its payoff does not.

### K5 — THE RISE · *status: exists, bad approach*

- **On screen** the form comes up off the page to the three-quarter.
- **Camera** el 65° → 10°, az 0° → 30°, `easeInOutBack`, fill 1.0 → 0.86.
- **The mark** the one genuine dimensional move in the beat: ease-in, overshoot
  past vertical, rock back.
- **Why it exists** VIDEO-DIRECTION §2.4's literal instruction — *"stands up off
  the page… ease-in → overshoot → settle."* It is the beat's largest gesture and
  the payoff of the tense.

**What is wrong: the approach, not the move.** It is reached *through* 1.37s of
illegibility (tilt 0.57s + "anticipation" 0.80s), during which the bbox height
collapses 99 → 47 px and the hero mark is a black smear. You cannot cut from a
shot the audience cannot read. A detour through unreadability to arrive
somewhere direct.

> **✓ THE MOVE WAS REBALANCED — and the camera line above is out of date
> (§11.1.2).** `riseCurve` is now `riseOut`, not `easeInOutBack`, and the rise
> lands directly on the **held** pose (az 38°, el 10°, fill 0.80) rather than on
> the standup pose. `assert-hero-rise.mjs` returns **6/6**: velocity peak at
> **16.7 %** of the rise (frame 7 of 42, ceiling 35 %), decay/acceleration ratio
> **5.00×** (floor 3×), gather **−10.0 %** and overshoot **+10.0 %** both intact,
> arrival **100.00 %**. That is §10.5 call 3's recommendation taken in full:
> 1.4 s kept, 50:50 spacing replaced.
>
> ⚠ **The approach is still 1.06 s of illegibility, and it moved rather than
> shrank.** The 0.80 s of anticipation is gone from here — it now precedes the
> turn — but `tilt` grew 0.57 → **0.70 s**, and it still takes the word to el 65°
> before the rise begins. The "detour through unreadability" is shorter and it is
> not closed.
>
> ⚠ **Read the control honestly:** 3 of that instrument's 6 rows pass on *both*
> arms. The gather and the overshoot are properties of either curve, so only the
> three spacing rows can tell them apart.

### K6 — THE THREE-QUARTER HOLD · *status: exists, never still*

- **On screen** the money frame. The best ¾, closest framing in the sequence.
- **Camera** az 38°, el 10°, fill 0.80, **stopped**.
- **The mark** at rest, being looked at.
- **Why it exists** Desk Doodles' own note, from the demo plan: *"hold the orbit
  a beat longer than feels necessary."* **A hold only reads as a hold if
  something stopped.**

**What is wrong.** Final beat: cx creeps 527 → 536 px, height 113 → 139, ink
+15%, monotonic, never arriving. **2 px per second for 45% of the runtime.**
`driftEase` is designed to decelerate to exactly zero — and the film never gets
there, so the camera is always still slightly moving. This is precisely the
"it just dollies side-to" read.

> **⚠ Corrected in §10.2 C1, and the correction is sharper than this.** Measured
> on `hero-v2.tsv`: over the **final 40 frames** the centre moves a **net 0.0 px**
> — `driftEase` reaches zero in azimuth exactly as designed, and the 10 px of
> creep all happens earlier, in the orbit. What never arrives is the **size**:
> width +4 px, height +2 px, ink +2.9 %, monotonic, over the final 1.33 s. The
> frame is still growing when the film ends. So the fix is not "make the camera
> decelerate harder" — it is **do not travel at all** (park the camera; fold
> az 30° → 38° into the K5 settle), and the stillness gate in §8 must measure
> **extent**, not centre, or it looks straight past this.

> **✓ BOTH HALVES DONE, AND THE RESULT IS THE BEAT'S BIGGEST HOLD — §11.1.4.**
> `cameraPark: "parked"` is the default: the rise lands on the held pose and the
> orbit resolves az/el/fill to constants, so `driftEase` no longer runs (it
> survives on `cameraPark: "prior"`). And the stillness gate now measures net
> displacement across all of extent, not per-frame centre.
>
> Measured across **every** scrub frame tagged `orbit` or `hold` on `turn3`, not
> just the gate's window:
>
> ```
> t 7.14..11.18 = 4.04s over 44 frames
>   net: centre 0.00 px · w 0 px · h 0 px · ink 0.00%
>   largest per-frame centre step: 0.00 px
>   distinct widths: 683   distinct cx: 644   ink 42387 on all 44
> ```
>
> **4.04 seconds of a frozen frame** — against the reference set's two biggest
> accents at 4292 ms and 2586 ms (§10.2 C3). The gate's own row reads
> `0.00 / 0 / 0 / 0.00 %` where the pre-turn capture reads `1.12 px / 0 / 1 /
> 0.44 %` **FAIL**, so the row can fail. K6 is now a dead hold and the creep is
> gone.

### K7 — THE RETURN · *status: MISSING*

- **On screen** back to the opening state, at K1's framing.
- **Camera** el 0°, az 0°, parked.
- **The mark** flat again.
- **Why it exists** the pitch is a **round trip**: *your hand survives the
  round-trip*. Going one way asserts a conversion; coming back asserts an
  **identity**. It also bookends — VIDEO-DIRECTION's scene grammar, open-small →
  close-fuller-and-centred.

> **⚠ STILL ABSENT — and the sentence below is now half wrong (§11.4.4).** The
> film no longer ends on a *drifting* three-quarter: it ends on a dead-still one,
> held 4.04 s (§11.1.4 · K6's note). It still does not come back. The round trip
> is not closed, the `hold` phase is a ¾ and not K1's framing, and §7's four
> turns are shipped as **two**. Until K7 exists, §10.5's call 1 can be decided
> but not taken.

**What is wrong.** Absent. The current film ends hanging on a drifting
three-quarter. `key-shots.png` panel K7 shows the original flipping back to its
opening state (it runs 3D → flat → 3D, not flat → 3D). That symmetry is much of
why the original reads as a finished gesture rather than a run-out clock.

---

## 4. Where one shot does not get to the next

Williams's real test. A board that reads shot-by-shot but cannot get between
them is not a board.

| adjacency | does it make sense? |
|---|---|
| K1 → K2 | **No — the order is inverted.** The tense fires 1.33s *after* the object already went solid. There is no path from "at rest" to "tensed" because the beat does not go that way. **The single most broken adjacency, and it is free to fix: move the squash before the moment.** |
| K2 → K3 | **No — there is no K3.** The tense has nothing to release into. A wind-up that resolves into a fade is a promise the beat does not keep, and that broken promise is a large part of what "lame" is naming. |
| K3 → K4 | **Not yet built,** but the mechanic is measured and the timing is known (§6–7). This is the buildable one. |
| K4 → K5 | **No — it goes through 1.37s of illegibility.** The tilt collapses the word to a 47 px bar and the "anticipation" happens on that bar. Continuity editing's own rule: you cannot cut from a shot that cannot be read. |
| K5 → K6 | **Yes, and it is the one that works.** `easeInOutBack` overshoot into `driftEase` is a real ease-in → overshoot → settle. Keep it entirely. |
| K6 → K7 | **No — K7 does not exist.** The film stops rather than ends. |

> **⚠ FOUR OF THESE SIX ROWS HAVE CHANGED — re-read, do not build from the table
> above (§11).** Verdicts as of 2026-07-31, measured:
>
> | adjacency | table says | now |
> |---|---|---|
> | K1 → K2 | order inverted, "free to fix" | **half fixed.** `anticipation` precedes `emerge` in `HERO_PHASES` and fires dead-on. But the squash reaches no renderer, so the four anticipation frames are pixel-identical to the breath — §11.4.3. The adjacency is correct and the shot is still not on screen. |
> | K2 → K3 | "there is no K3" | **there is a K3.** Built, gated 8/8, a 24 px sliver held 66 ms — §11.1.1. The tense still has nothing visible to release, because of the row above. |
> | K3 → K4 | "not yet built, the buildable one" | **K3 built, K4 not.** `tilt` starts on the frame after `emerge`; K4's hold is 0.00 s — §11.4.4. |
> | K4 → K5 | 1.37 s of illegibility | **1.06 s.** The 0.80 s anticipation moved out; `tilt` grew 0.57 → 0.70 s. Shorter, not closed. |
> | K5 → K6 | "keep it entirely" — `easeInOutBack` into `driftEase` | **both halves replaced, deliberately.** Rise is `riseOut`; `driftEase` does not run under `cameraPark: "parked"`. §10.5 call 3 and §10.2 C1 each authorised one half. It is still the adjacency that works — it now works differently. |
> | K6 → K7 | K7 does not exist | **unchanged.** |

**One structural break, above all of these.** `scripts/capture/motion.mjs` — the
file that claims to be the single definition of the timeline — **has zero
consumers.** Its own header says *"Both capture-run.mjs and compose.mjs import
it"*; neither does. `compose.mjs` imports only `@napi-rs/canvas`; `capture-run.mjs`
imports only `playwright-core` and `./letters.mjs`. The checked-in film pipeline
still produces **the original card flip**. The hero beat exists only live, in
`lib/hero-motion.ts`, and only on `/desk-doodles`.

So the beat currently lives in two incompatible places, and the one that is
checked in and encodable is the one with the moment in it. **That is fortunate
rather than embarrassing: the mechanic K3′ needs is already the mechanic the
shipping compositor implements.**

---

## 5. The board, as a whole

**Sheet: `docs/storyboard/timing.png`** — the three timelines to the same scale.

```
                     ┌─ K3 ─┐                                ┌─ EDGE ─┐
draw-in ─── K1 ─ K2 ─┤MOMENT├─ K4 ─────── K5 ─────── K6 ─────┤ MOMENT ├─ K7
            HELD tense└──────┘ HELD       rise      HELD ¾    └────────┘  HELD
```

Total **8.90s** — the original's exact length, and 0.92s shorter than the
current film. Held still **37%**. Moments **2**.

> **⚠ AS BUILT: 11.18 s · held 46.5 % · moments 1 (§11.2).** The *shape* above is
> what shipped — holds separated by an event and one long rise — but not the
> proportions. The contrast the diagram is for is real and measurable now: 4.04 s
> of frozen frame against a 66 ms event (§11.1.4, §11.1.1). What is missing from
> the shipped diagram is the right-hand half — the **EDGE MOMENT (return)** and
> **K7**, neither built — and **K4's HELD**, which is 0.00 s (§11.4.4). So the
> real shipped shape is the left two-thirds of the diagram followed by a very
> long hold.

The shape is deliberate and it is the one thing the current beat has none of:
**contrast.** Whitaker/Halas/Sito — *"Timing gains meaning through contrast. A
fast action feels fast because something before it was slow."* Four holds
separated by two two-frame events and one long rise. The current beat is
monotone by construction; this one cannot be, because 37% of it is stopped.

---

## 6. The breakdowns

Williams, twice, because it is the load-bearing idea:

> *"If the breakdown or passing position is wrong, all the inbetweens will be
> wrong too."*

And the anti-pattern, from BAM Animation:

> *"the WRONG way to do break down drawings is to put a drawing exactly in the
> center… that creates a situation where you have EVEN SPACING between your
> drawings, and it looks very mechanical."*

**Sheet: `docs/storyboard/breakdowns.png`** — the spacing charts, drawn in the
notation (keys circled, breakdown underlined).

### B1 — the turn's passing position, measured off the original

The one breakdown that decides whether K3 reads as an event. **It is not the
midpoint, and this is measured rather than chosen.**

The original's turn is `sx = |cos(easeInOutCubic(t)·π)|`. Solving for
half-width: `easeInOutCubic(t) = 1/3` → `t = 0.4368` of the full 180°, i.e.
frame 11.36 of the 26-frame flip. The face-out half is 13 frames. So:

> **The half-width passing position sits at 87% of the turn-out, not 50%.**

Confirmed against the film — half width (410 of 820) falls between f152 (473)
and f153 (269), at f152.3, which is (152.3 − 141) / 13 = **86.9%**.

Read what that means: the card spends **87% of its turn** between full width and
half width, and covers half-width-to-nothing in the last 13%. A slow, readable
commit, then a whip. `compose.ORIGINAL-FLIP.mjs` says exactly this in its own
comment, and says why quart was rejected:

> *"quart stacked on cos left ~0.25s of visually dead card at each end (reads
> draggy) and a 1-frame blink through edge-on. Cubic keeps the commit/settle
> readable while still whipping through edge-on."*

**The symmetry matters as much as the number.** The turn is symmetric about the
edge, so the cushion sits on the **outside** of the turn on *both* sides: going
out, 87% of the time is spent above half width; coming in, half width is reached
in the first 13%. **Only the edge itself is whipped.** The commit is readable,
the settle is readable, and the event is over before the eye can resolve it —
which is exactly what `compose.ORIGINAL-FLIP.mjs` means by *"keeps the
commit/settle readable while still whipping through edge-on."*

**Note the compounding trap, because it is the thing most likely to be got
wrong on a rebuild:** `|cos|` is *already* slow at the ends and fast in the
middle. Easing the angle on top of it stacks two cushions. Cubic is the measured
answer; anything stronger goes draggy.

### B2 — the current beat's breakdown is at the midpoint

The comparison that makes the point. From `docs/explainers/14-the-flat-to-solid-beat.md`,
the emerge's per-frame tonal range:

```
1.98 → 2.13 → 2.67 → 3.57 → 4.44 → 5.13 → 5.37 → 5.83 → 6.35 → 6.54
```

Span 4.56; half-value 4.26 falls at frame 3.79 of 9 intervals = **42%**.

> **87% for the flip. 42% for the current beat.**

> **✓ CONFIRMED THREE TIMES OVER, by evidence this board did not have (§10.2 C5,
> §10.3).** `reference-film-mechanics.md` §6.5 measured 22 reference transits and
> found them bimodal — **arrival at 9–37 %**, **wind-up at 79–93 %**, nothing
> evenly spaced but four opacity fades. **87 % is the wind-up signature exactly**
> (title spring 91.9 %, pre-cut ramp 93.4 %). Re-measuring the flip off the
> extent series gives **89.7 %** (turn out) and **85.6 %** (turn back). And
> re-measuring the current beat off the checked-in scrub gives **value-half 42.2 %
> / extreme 42.2 %** — B2 reproduced with §6.5's two independent readings agreeing
> to *0.0 points*.
>
> **But §7's exposure sheet contradicts B1 and must change.** It authors the turn
> at **5 frames**; the original's is **13** (`traced.tsv` f140–155, and B1's own
> text says so). At 5 frames an 87 % breakdown puts the whip at 0.65 of a frame —
> shorter than a frame, so it cannot render as a whip. §10.2 C5.

That gap *is* the difference between an event and a fade. 42% is even spacing;
even spacing reads mechanical; mechanical is what "lame" describes. The largest
single-frame step in that series is **0.90** — nothing in the beat ever happens
faster than one-fifth of its own total change.

### B3 — the anticipation's passing position

The compress must not sit at the midpoint of the tense either. Use the existing
`easeOutStrong` (`1 − (1−t)⁵`) — instant start, long settle — so the compression
is **reached fast and then held**. The hold is what sells intent; a squash that
immediately releases reads as a wobble. That curve already exists in
`hero-motion.ts` and is already used for exactly this; it only needs to fire in
the right place (§4, K1→K2).

### B4 — the rise's passing position

Already correct. `easeInOutBack(c1 = 1.70158)` gives a −10% counter-dip and a
+10% overshoot, placing its passing position off-centre by construction. This is
the one part of the current beat that is properly broken down. **Do not touch it.**

> **⚠ "DO NOT TOUCH IT" WAS WRONG, AND §10.5 CALL 3 SAID SO BEFORE THE CHANGE
> LANDED.** `easeInOutBack` gives a counter-dip and an overshoot, but its
> **spacing is 50:50** — B4 read the dip and the overshoot and never examined the
> velocity profile between them. Call 3: *"B4's 'do not touch it' stands for the
> overshoot and for `backC1`; it should not be read as protecting the 50:50
> spacing, which B4 never examined."*
>
> **✓ The curve is now `riseOut` (§11.1.2)** — velocity peak at **16.7 %**, decay
> **5.00×** the acceleration. The dip (−10.0 %) and the overshoot (+10.0 %) are
> preserved to the tenth of a percent, and `backC1 = 1.70158` is untouched and
> still reachable as `riseCurve: "prior"`. So B4's real content survived; its
> instruction did not. **A passing position is not off-centre just because the
> curve has a dip in it.**

---

## 7. The in-betweens — the exposure sheet

> **⚠ Three rows of this table are superseded by §10.** The **five-frame turns**
> (f99–103, f106–110, f225–229, f232–236) must be **13 frames** each — B1's own
> number is unbuildable at five (§10.2 C5). **K1's 14-frame hold** must be the
> beat's longest, not its shortest — the rule it was sized against is falsified
> (§10.2 C3). **K6's `driftEase`** must not travel at all (§10.2 C1). The frame
> ledger that closes all three, at 270 frames / 9.00 s, is in §10.3. The table
> below is left standing so the two can be compared.

> 🔨 **⚠ AND NOW THE WHOLE TABLE IS WRONG IN ITS DURATIONS — §11.2. It is a
> record of what was planned, not of what runs.** The table below **used to be
> the beat's specification**: 30 fps, **267 frames, 8.90 s**, with K1 held 14
> frames, the turns 5 frames, K4 held 18, K6 36 on `driftEase`, and K7 held 30.
> None of those five numbers is what ships. **It is left standing, unedited, on
> §10's own precedent** — the superseded text stays beside the correction. Read
> §11.2 for the shipped table; read this one only to see what changed.
>
> The shipped `DEFAULT_HERO_MOTION.beats`, and `manifest.json` confirms
> `total 11.1767`:
>
> | phase | table above | **SHIPPED** | frames @30 |
> |---|---|---|---|
> | draw-in | 76 fr / 2.50 s | **2.60 s** | 78 |
> | K1 hold (`breath`) | 14 fr / 0.47 s | **1.10 s** | **33** |
> | K2 tense (`anticipation`) | 9 fr / 0.30 s | **0.36 s** | 11 |
> | the turn (`emerge`) | 5 + 2 + 5 = 12 fr / 0.40 s | **0.9167 s** = `0.85` + `2/30` | **27.5** |
> | land + settle · K4 held | 9 + 18 fr | **not built** — `tilt` 0.70 s runs here | 21 |
> | K5 rise (`standup`) | 42 fr / 1.40 s | **1.40 s** ✓ *duration held, curve replaced* | 42 |
> | settle | 9 fr | folded into `standup` | — |
> | K6 ¾ hold (`orbit`) | 36 fr, `driftEase` az 30→38 | **3.20 s, PARKED**, 0.00 px travel | **96** |
> | return turns ×2 + dwell | 12 fr | **not built** | — |
> | K7 held flat (`hold`) | 30 fr | **0.90 s, and it is a ¾, not flat** | 27 |
> | **total** | **267 fr / 8.90 s** | **11.177 s** | **335** |
>
> **Two rows changed direction, not just magnitude.** The `emerge` row is a real
> turn where the table's was 12 frames of one; the `orbit` row travels **zero**
> where the table drifts 8°. And two rows are **not built at all** — K4's hold and
> the whole K7 return, which is why §7's four turns ship as two.
>
> **The "Held: 98 frames = 37 %" line below is superseded too.** Measured on the
> real capture: `breath` 1.1 s + `orbit` 3.2 s + `hold` 0.9 s = **5.20 s = 46.5 %**,
> every frame proven pixel-static (§11.1.3, §11.1.4). **Moments: 1, not 2** — the
> return turn does not exist yet.
>
> 🔨 **AND NOW THAT CORRECTION IS ITSELF OUT OF DATE — 2026-07-31.** The table
> immediately above **used to be** the shipped column: **11.177 s / 335 frames**,
> eight phases, `orbit` 3.20 s / 96 frames, `hold` 0.90 s *"and it is a ¾, not
> flat"*, with `land`, `solid`, `descend` and `returnTurn` marked **not built**
> and *"Moments: 1, not 2"*. **Every one of those five statements is now false.**
> Measured off `DEFAULT_HERO_MOTION` on 2026-07-31 by
> `node scripts/verify/assert-hero-ledger.mjs`:
>
> **the beat is 295 frames / 9.833 s across TWELVE phases** — `draw 64 ·
> breath 33 · anticipation 9 · emerge 28 · land 9 · solid 18 · tilt 13 ·
> standup 42 · orbit 28 · descend 13 · returnTurn 28 · hold 11` — with **FOUR
> held shots that all genuinely stop** and **TWO moments, `emerge` and
> `returnTurn`**, which is §7's own count reached at last. K4 (`solid`, 18
> frames) and K7 (`descend` + `returnTurn` + `hold`) are BUILT; see §11.7.4.
> The read stillness is **45.4 %**.
>
> **The draw row is the one that is still wrong, and §10.3's re-cut moves it**
> to **140 frames / 4.667 s**, for a beat of **371 frames / 12.367 s**. Read the
> re-cut ledger, not this table and not the correction above it.

30 fps, 267 frames, 8.90s. One row per run. Director's shorthand per
Whitaker/Halas/Sito p. 19 — `───` hold · `∿` action · `◠` anticipation ·
**✕** must happen on this exact frame.

| frames | t | n | shot / action | camera | notation |
|---|---|---|---|---|---|
| 0–75 | 0.00–2.50 | 76 | **draw-in.** Pen writes L→R. `drawEase` blend 0.45 — near-constant pen speed, soft touch-down and lift. | el 0° az 0° fill 1.0 | `∿` |
| 76–89 | 2.53–2.97 | 14 | **K1 — THE PEN LIFTS.** Held. Flat, dead-on. | parked | `───` |
| 90–98 | 3.00–3.27 | 9 | **K2 — TENSE.** Compress on `easeOutStrong` over f90–95, **hold** f96–98. scaleY 0.955 / scaleX 1.018. | parked | `◠` |
| 99–103 | 3.30–3.43 | 5 | **turn out.** `sx = \|cos(easeInOutCubic·π)\|`. Half width lands **f103.3** — 87% of the f98.5→f104.0 span (B1). Shade `0.35(1−sx)`. | parked | `∿` |
| **104–105** | **3.47–3.50** | **2** | **★ K3 — THE EDGE.** sx clamped 0.035. The true edge, thickness only. **Held on twos.** | parked | **✕** |
| 106–110 | 3.53–3.67 | 5 | **turn in.** Mirror of the out-turn: half width at **f106.2** — 13% of f105.5→f111.0, i.e. *early*, because the cushion sits on the far side. | parked | `∿` |
| 111–119 | 3.70–3.97 | 9 | **land + settle.** Crossings resolve to over/under. **Contact shadow lands** — its own curve, `easeOutStrong`, ~4 frames behind the face (the 50–100ms secondary-action offset). | parked | `∿` |
| 120–137 | 4.00–4.57 | 18 | **K4 — SOLID, HELD.** K1's exact framing. Camera stopped. The A/B frame. | parked | `───` |
| 138–179 | 4.60–5.97 | 42 | **K5 — THE RISE.** `easeInOutBack`. el 65→10°, az 0→30°, fill 1.0→0.86. Dip to el 70.5°, overshoot to el 4.5°. | moving | `∿` |
| 180–188 | 6.00–6.27 | 9 | **settle.** Rock back to el 10°. | decelerating | `∿` |
| 189–224 | 6.30–7.47 | 36 | **K6 — THE ¾ HOLD.** `driftEase` az 30→38°, arriving at **exactly zero velocity by f224**. Then stopped. | stops | `───` |
| 225–229 | 7.50–7.63 | 5 | **turn out.** | parked | `∿` |
| **230–231** | **7.67–7.70** | **2** | **★ THE EDGE (return).** | parked | **✕** |
| 232–236 | 7.73–7.87 | 5 | **turn in.** | parked | `∿` |
| 237–266 | 7.90–8.87 | 30 | **K7 — HELD FLAT.** K1's framing. The round trip closes. | parked | `───` |

**Held:** 14 + 18 + 36 + 30 = **98 frames = 37%**.
**Moments:** f104–105 and f230–231. **Two.**

### Why two frames and not one

Whitaker/Halas/Sito: *"Most things can be animated sufficiently well on double
frames, 'twos'."* And the original does exactly this — f154 and f155 are
byte-identical (ink 410, w 14, cx 479.5 in both). One frame at 30 fps is 33 ms
and reads as a dropped frame; two frames is 67 ms and reads as a beat. **The
dwell is what makes it an event rather than a glitch.**

The same source warns against the opposite error: *"it is dangerous to animate
on double frames during a table move or camera track."* The turn is on twos
**only while the camera is parked**, which it is throughout K2–K4 and K7. The
rise (f138–188) is on ones, because the camera is moving.

### The three numbers a rebuild must not lose

1. **The clamp: `sx ≥ 0.035`.** Never a blank frame. The one frame everything
   turns on must always have something in it.
2. **One centre.** Both faces scale about the same point. cx 479.0 → 479.5 —
   half a pixel across the whole turn. This is solved *by construction*, and it
   is the reason the original can afford a 241 px extent step: nothing is
   mis-registered because there is nothing to register.
3. **The shade: `0.35 × (1 − sx)`.** Measured live to ±1 luma (§3, K3). Free,
   already working, and the only thing telling the eye that the face is a
   surface catching light rather than a picture being squeezed.

> 🔨 **SUPERSEDED 2026-07-31 — ALL THREE ARE KEPT. #2 IS RESTORED, and the
> paragraph below is the reasoning that found the fix, so it is left standing
> whole.** What this note **used to say**: *"✓ #1 and #3 KEPT. ✗ #2 LOST, and it
> is the beat's live defect (§11.4.1)"* — with `max cx step 24.50 px` against a
> 2 px ceiling. It is now **1.00 px**, which is one quantisation step of a
> half-pixel bbox centre, i.e. the floor of the instrument. Evidence, run
> first-hand: §11.7.1.
>
> And it was closed by exactly the move the last paragraph below points at. The
> text says *"the property was never portable; only the number was"* — the
> property is **affineness**, and it is portable after all, because a camera can
> have it. The hero stage now mounts an **orthographic** camera
> (`Viewport3DProps.projection: "affine"`, defaulted for any viewport driven by
> a `flatten` state), under which `Δcx` is identically zero for every θ, every
> framing and every word. Not a per-frame counter-translation — the term is
> removed rather than cancelled.
>
> The original note, unedited:
>
> **✓ #1 and #3 KEPT. ✗ #2 LOST, and it is the beat's live defect (§11.4.1).**
> The rebuild honoured the clamp — `edgeFloor: 0.035`, gated as *"the sliver is
> never a blank frame"*, floor 24 px / 3928 ink px — and the shade —
> `turnShade: 0.35`, ported from `compose.ORIGINAL-FLIP.mjs:200`. It did **not**
> keep **one centre**: `max cx step 24.50 px` against a 2 px ceiling.
>
> And #2's own text says why, in a clause that reads differently now: *"this is
> solved **by construction**."* It was solved by the medium — a 2D compositor
> scaling about one point cannot move `cx`. A real form really turned under a
> perspective camera moves its projected centre whether or not it is centred,
> because the half rotating toward the lens projects larger than the half
> rotating away. **The property was never portable; only the number was.** That
> is the thing to carry into whatever closes it.

---

## 8. What has to change in the gates

> **⚠ Verified in §10.4 — the direction is right, three details are wrong.** The
> proposed set was run against both films and four synthetic negative controls
> (`docs/storyboard/tools/assert-moment.mjs`). **As drafted it fails two of seven
> rows:** it rejects the original's *return* turn, and it **accepts a hard cut to
> two blank frames.** Three amendments, each forced by a measurement, are marked
> inline below. With them the set agrees with every wanted verdict.

> **✓ SHIPPED, ALL THREE AMENDMENTS, AS ONE IMPLEMENTATION — §11.1.5.** The
> criteria now live once, in `scripts/verify/lib/hero-moment.mjs`, and are called
> by **both** the shipped gate (`assert-hero-transition.mjs:72`) and the
> storyboard tool (`docs/storyboard/tools/assert-moment.mjs:46`). Verified by
> grep: those are the only two importers in the repo.
>
> **That sharing is the point, not tidiness.** The file's own header: *"a ported
> copy of a criterion is a criterion nobody tested — the storyboard tool's four
> negative controls only prove the SHIPPED gate is sound if the shipped gate runs
> this exact code."* The four controls are therefore a live mutation test of the
> gate that judges the real film, not of a lookalike.
>
> `assert-moment.mjs` re-run 2026-07-31: **SOUND, exit 0**, all seven wanted
> verdicts. The `§8-as-drafted` column still shows the two failures above, and
> `priorRegistrationGate` / `priorStillnessGate` are parked beside the corrected
> ones so the diagonal stays visible.

The gates encode the old goal. Leaving them as they are means the board cannot
be built without going red, and going red on a craft gate is how craft gates get
deleted.

**Keep unchanged — these are craft and they are right:**

| gate | why it stays |
|---|---|
| 1. flat beat is ONE VALUE (sd < 1) | a drawing is one value inside a hard silhouette. Non-negotiable. |
| 2. flat beat has NO specular (spread < 8) | same. |
| 3. held ¾ has real tonal range | the mirror gate; catches "flatness by dimming the lights". |
| 4a. **no value wash** (peak ≤ settled + 4) | brand law — tone from light and mark density, never from washing the ink out. |

**Split gate 4.** It currently asserts one thing and means two:

- **KEEP `maxCentreJump < 4`.** Registration must hold. The original passes this
  at 0.5 px. Tighten it to `< 2` — the original earns it.
  > **✗ AMENDMENT 1 (§10.4).** It does not. The **return** turn measures
  > **2.55 px** and is rejected. But `cx` is exact — 479.5 through the entire
  > event — and the 2.55 px is all `cy`, because at the sliver the bbox loses
  > letterform asymmetrically (`y0` +8, `y1` −3). A collapsing silhouette's
  > vertical midpoint is not a registration signal. **Split the axes:** `cx`
  > < 2 px on every frame; `cy` < 2 px only on frames with extent ≥ 20 % of
  > settled. A vertically-offset swap is still caught — tested with a control.
- **DELETE `maxWidthJump < 6`.** Extent continuity is exactly what a moment
  breaks. This clause, and only this clause, is what would reject the original.

**Replace gate 5 with its opposite.** "The change is gradual, not a cut" should
become **"the beat contains a moment"**:

> There exists at least one frame at which the silhouette's extent collapses
> below 5% of the settled width, held for ≥ 2 frames, **while the centre moves
> less than 1 px.**

The centre clause is what keeps this honest. It is not "allow a jump" — it is
"allow the *extent* to jump only while the *registration* holds perfectly." That
is precisely the distinction between a card turning and two layers swapping, and
it is the distinction the current gate cannot express.

> **✗ AMENDMENT 2 (§10.4) — as written, this accepts a hard cut to black.** A
> frame with *nothing in it* satisfies "below 5 % of settled", "held ≥ 2 frames"
> and "centre moves < 1 px". The synthetic two-blank-frame cut **passes**. That
> is exactly the discontinuity §7's own "three numbers a rebuild must not lose"
> puts first — *"Never a blank frame."* **Add a floor and a recovery:** the
> moment must be a **sliver, not a blank** (`ink > 0`, extent ≥ 2 px), and the
> extent must **return to ≥ 90 % of settled** afterwards. Headroom is ample —
> the original's sliver is 14 px = **3.4 %** of the 409–410 px settled word, on
> both turns.

**Add a gate the beat has never had.** All five existing gates measure value;
none measures stillness. The film's real defect is a camera that never stops:

> In the final hold, per-frame centre motion must be **< 0.5 px** for ≥ 20
> consecutive frames.

The current film fails this at 2 px/s of monotonic creep. `driftEase` is already
written to arrive at zero velocity; nothing checks that it does.

> **✗ AMENDMENT 3 (§10.4) — right instinct, wrong quantity, and it barely fires.**
> It catches the current film at **exactly 0.50 px** — one quantisation step of a
> half-pixel bbox centre. A verdict that turns on the last representable digit is
> a coin toss. And it is aimed at the thing that already stopped: over the final
> 40 frames the centre moves a **net 0.0 px**, while width goes +4 px, height
> +2 px and ink **+2.9 %**. **Measure net displacement over the window, across
> all of extent:** net centre < 1 px, net width < 2 px, net height < 2 px, net
> ink < 0.5 %. Current beat, last 20 frames → `0.50 px / 3 px / 1.60 %` **FAIL**.
> Original's final hold → `0.00 / 0 / 0 / 0.00 %` **PASS**.

---

## 9. What is decided here, and what is not

**Decided, because it is measured:**

- The beat has no moment, and that is provable three ways (§1).
- The mechanic for the moment already exists, works, and is already the one the
  checked-in compositor implements (§3).
- The turn's breakdown belongs at 87%, not 50%, and the current beat's sits at
  42% (§6).
- Gates 4b and 5 would reject the original flip and must change (§1.5, §8) — now
  **run** against both films and four negative controls, with three amendments
  the run forced (§10.4).

**Not decided — Sebs's calls, deliberately left open.** *Each now carries a
worked recommendation with its evidence and what the other branch costs, in
**§10.5**. They stay open: the recommendation is a position, not a default.*

> **Status as of 2026-07-31 (§11.5) — all four still Sebs's, two now carry real
> reference evidence, and two are effectively settled by what shipped.**
>
> | call | what changed |
> |---|---|
> | **1 · flat or changed flat** | **Re-run against `online-reference-mechanics.md` §9.1.** The hard constraint (occlusion, never shading) is **confirmed** — the one clip that modifies a settled flat state does it twice, occlusion on 14/14 frames against two controls. *One thing at a time* is confirmed structurally. But the **specific form has no precedent**: not one instance anywhere of a mark occluding itself at a crossing. And the footage offers a **third structure** neither §9 nor §10.5 costed — an unchanged flat carrier opening onto changed news. **Still OPEN, and blocked on K7 existing at all** (§11.4.4). |
> | **2 · how true is the true edge** | **Re-run against §9.2, and its biggest finding is negative.** *No clip in the set presents a form edge-on* — call 2's exact geometry has no precedent. *Prove it on the approach* is **supported** by a fidelity ladder on which our 3.4 % sliver sits **below the bottom rung**. The **two-frame dwell has no backing**: 27 of 30 transits contain zero duplicate frames, and the 3 exceptions are a 12-fps cadence, not craft. **The dwell is ours — an unreferenced invention.** Still OPEN. |
> | **3 · does the rise keep 1.4 s** | **Effectively taken, and taken the recommended way** — 1.4 s kept, curve rebalanced ease-out dominant, gated 6/6 (§11.1.2). Reversible on `riseCurve: "prior"`. |
> | **4 · film or page first** | **Taken — the page went first.** Item 4 of the recommendation is the one that did **not** land: `motion.mjs` still carries `breath: 0.5 // ("cuts land on motion")` and *"the transition being near-invisible is the point"* (§11.4.5). |

1. **Does the return (K7) go back to flat, or to a *changed* flat?** The original
   returns to the identical logo. A return to the flat mark with the crossings
   now resolved would say "your drawing came back different, and better." Richer,
   and a bigger claim than the product may want to make.
   → **§10.5 recommends *changed* flat**, moving the crossing resolution out of
   K4 so each shot carries one piece of news. Hard constraint either way: the
   change must be **occlusion, never shading**, or gate 1 fails.
2. **How true is "the true edge"?** K3′ shows the form's real thickness edge-on.
   How much of the stroke's own profile — the taper, the joint beads — should be
   legible in 14 px? A visible taper is the strongest possible proof it is the
   same mark; it may also be noise at that width.
   → **§10.5 recommends geometrically true, visually silent**: prove the taper on
   the 20–80 px *approach* frames, not at the sliver, and freeze the two dwell
   frames byte-identical as the original does.
3. **Does the rise keep its full 1.4s** once the beat is no longer carrying the
   whole burden of drama? With a real moment at f104, the rise becomes
   *consequence* rather than *climax*, and consequences can be shorter.
   → **§10.5 recommends keeping 1.4 s *only* if the curve is rebalanced
   ease-out-dominant; otherwise cut to 1.0 s.** The duration is not the real
   defect — the 50:50 spacing is.
4. **The film/page split (§4).** `motion.mjs` is orphaned and the checked-in
   pipeline still card-flips. Do we bring the hero beat into the film pipeline,
   or bring the moment into the live page first? The board is agnostic; the
   sequencing is a call.
   → **§10.5 recommends page first, and it is no longer a close call** — the film
   pipeline provably cannot yet record this beat truthfully, and the page now
   can. One correction to §4: `motion.mjs` has zero *code* importers but is not
   dead — `page.tsx:1309` has a "Copy motion.mjs constants" button.

   > 🔨 **⚠ THE LINE NUMBER ROTTED — it is `page.tsx:2003` now** (2026-08-01,
   > opened first-hand). The sentence used to cite `page.tsx:1309`, which today
   > is the timeline dock's phase read-out. Full correction at §10.5 call 4.

**Not built.** This is a board, not an implementation. Nothing in `lib/` or
`scripts/` was modified — by the original pass or by §10's. §10 added two
measuring tools under `docs/storyboard/tools/`; they read checked-in data and
render nothing.

> **✗ NO LONGER TRUE, AND THIS IS THE SENTENCE MOST LIKELY TO MISLEAD THE NEXT
> READER — §11.** It was accurate on 2026-07-30 and describes §1–§10's own
> restraint, which was correct. Since then the board has been **built**:
> `lib/hero-motion.ts` carries the ported turn, the ease-out-dominant rise, the
> reordered phases, the 1.1 s breath and `cameraPark: "parked"`;
> `scripts/verify/lib/hero-moment.mjs` carries the corrected gates as one shared
> implementation; `assert-hero-turn.mjs` and `assert-hero-rise.mjs` are new; and
> `docs/verification/hero-transition/turn3/` is a real capture of it.
>
> **§11 itself changed nothing** — it is documentation only, and it names what it
> did not verify. But the paragraph above must not be read as a description of
> the repo.

---

## 10. Reconciliation — what arrived after this board was written

*Added 2026-07-30. Two documents landed after §1–§9 were finalised:
`docs/research/reference-film-mechanics.md` (2,942 frames of the three reference
films, measured) and `docs/explainers/18-the-reveal-stopped-rebuilding.md` (the
1.1 s stall, fixed). Between them they falsify claims this board leans on, and
they remove the constraint that shaped its timing. This section reconciles the
board with both, verifies §8's gate rewrite against the films, and closes §9's
four open calls with a recommendation each.*

**Nothing was built. `lib/` and `scripts/` are untouched.** Two measuring tools
were added under `docs/storyboard/tools/`; they read checked-in data and render
nothing.

### 10.1 What is first-hand here, and what is cited

*A citation is not evidence — it is a claim that evidence exists. So, plainly:*

**Verified first-hand, by reading the numbers myself:**

| what | where | what I saw |
|---|---|---|
| the original flip's two turns | `docs/storyboard/measured/traced.tsv` f140–168, f225–248 | below |
| the current beat's emerge | `measured/hero-v2.tsv` f88–108, and the 71-frame scrub in `docs/verification/hero-transition/after/emerge/` | below |
| the current beat's final hold | `measured/hero-v2.tsv` f258–297 | below |
| **the reference films' own per-frame series** | `docs/verification/reference-films/measured/*.tsv` — 2,942 rows, checked in | below |
| the shipped gates' verdict on the current beat | `node scripts/verify/assert-hero-transition.mjs --label=after` | **7/7 PASS** |

**Cited, not re-derived:** the reference doc's *passage-level* Ken-Burns fit
(best whole-frame translation over ±8 px plus best uniform scale 0.97–1.03,
last frame onto first). That test is not recoverable from the checked-in
columns, which carry a per-frame translation series instead. What I could check
is the necessary condition, and it holds — §10.2 C1.

**Not attempted, and deliberately:** no new online reference gathering. The deep
pass on the reference films is a dedicated lane's, and duplicating it would
collide with a live owner. Everything below reads that lane's checked-in output
or our own.

**Verified first-hand, from `verification/reference-films/measured/`:**

```
held-frame fraction, all 2942 frames, swept by threshold
  mad < 0.15   1774/2942 = 60%      <- the doc's "61%" reproduces here
  mad < 0.50   2188/2942 = 74%      <- still by any visual standard

the cut into Exquisite Corpse's payoff, frame by frame
  f396  16.500  mad  0.222  hcorr 1.000   last frame of the Dali shot
  f397  16.542  mad 56.977  hcorr 0.420   THE CUT
  f398..f411    mad  0.000  hcorr 1.000   14 consecutive frames, EXACTLY zero
  f412  17.167  mad  9.551  hcorr 0.980   the sheet appears
  f413  17.208  mad  0.083                (duplicate — on twos)
```

**The empty frame is real and I saw it**: fourteen consecutive frames at a
frame-to-frame difference of *exactly* 0.000 and a histogram correlation of
*exactly* 1.000. 583 ms of nothing, 625 ms from the cut to the pop-in. That is
the strongest single device in the reference set and it is not an adjective.

Cuts on stillness, same source: of the hard cuts I found (`hcorr < 0.95` and
`mad > 20`), **f265 leaves STILL and arrives STILL**, **f397 leaves near-still
and arrives on mad 0.000**, **f730 leaves STILL**, Babbu **f477 arrives STILL**
and **f914 is dead still on both sides**. The written rule — *"cuts land on
motion, never on stillness"* — is false, and it is false at the most important
cut in the reference set.

---

### 10.2 Corrections — the board rested on four falsified claims

Each of these is a claim from Desk Doodles' own craft docs that the footage does
not support, traced to where it reached this board or this codebase.

#### C1 · There is no Ken-Burns, and the drift is not a tuning failure

*Falsified: VIDEO-DIRECTION §1 / CRAFT-VISUAL-PASS §1C — "a slow continuous
drift/Ken-Burns UNDER fast per-element pops. The frame is never static."
(mechanics §2.1.)*

**What I verified.** Of the six still passages the mechanics doc names, the
per-frame translation columns are **exactly zero on every frame** in three of
them — Exquisite Corpse's browser doodle (42 fr), Babbu's title card (81 fr),
Babbu's object field (59 fr). The other three carry **one or two** nonzero
frames out of 104, 199 and 235 — isolated spikes, not a run. A real drift is a
sustained same-sign series; nothing here is. No sustained translation exists in
any named still passage of any of the three films.

**Where it reached us.** §1.3 of this board diagnoses *"45 % of its runtime is
drift… 9 px of lateral creep over 4.43 s"* and §3 K6 calls it a tuning failure —
*"`driftEase` is designed to decelerate to exactly zero and the film never gets
there."* **That framing is too generous.** The drift is not a curve that
under-shoots its target; it is a device with no basis in 114 seconds of
reference film. The correction is not *arrive at zero velocity*, it is **do not
travel**: fold the az 30° → 38° into the K5 settle and make K6 a dead hold.

**And the diagnosis itself needs sharpening — I measured the wrong thing was
being blamed.** From `hero-v2.tsv`:

```
last 40 frames (f258-297)   cx 536.0 -> 536.0   NET 0.0 px
                            w 447 -> 451   h 137 -> 139   ink +2.9%
the 90 frames before that   cx 525.5 -> 535.5   NET 10.0 px
```

**The centre does arrive.** Over the final 1.33 s it moves a net zero pixels;
the 10 px of lateral creep all happens earlier, in the orbit. What never arrives
is the **size** — width +4 px, height +2 px, ink +2.9 % over the final 1.33 s,
monotonic. `driftEase` reaches zero in azimuth exactly as designed. The frame is
still *growing* when the film ends. This matters for §8 and is why the stillness
gate as drafted is the wrong instrument (§10.4).

#### C2 · The Ken-Burns claim is still in the parameter model, as a dead dial

`lib/hero-motion.ts:133` — `/** Tiny push over the hold so the frame is never
static. */` — and `:207` — `pushScaleEnd: 1.01`. `scripts/capture/motion.mjs:145`
spells out the provenance: *"the frame is 'never static, never frantic' (§1)"*,
citing the section the mechanics doc falsified.

**Good news, verified by grep across `lib/ components/ app/ scripts/`:
`pushScaleEnd` has no consumer.** It is declared, defaulted, emitted into
`toMotionMjsSource()`, and read by nothing that renders. So the claim reaches
the parameter model but not the screen, and §8's new stillness gate is not
blocked by a live dial.

**It should still go.** A named, defaulted, documented dial whose stated purpose
is "the frame is never static" is an instruction to the next person, and the
next person will wire it. Delete the dial and the comment, or re-comment it with
what 114 seconds of film actually show.

#### C3 · `breath`'s own doc comment cites the falsified claim — and it is the biggest correction here

`lib/hero-motion.ts:65`, verbatim:

```ts
  /**
   * Stillness before the move — "cuts land on motion, never on stillness".
   */
  breath: number
```

and `scripts/capture/motion.mjs:28` — `breath: 0.5, // beat of stillness before
the move ("cuts land on motion")`.

The claim is false (§10.1, verified). And the **corrected** rule points the
opposite way, which is why this is more than a comment fix. Mechanics §2.2 and
§9:

> *a cut is preceded by a hold* — nine of eighteen cuts preceded by ≥ 250 ms
> **· an accent is bought with a hold, not with a move** — and the two biggest
> accents in the reference set are preceded by **4292 ms** and **2586 ms** of
> completely frozen frame.

Under the false claim, `breath` is a throat-clear: something to cut *out of*, so
0.5 s is plenty. Under the measured rule, **`breath` is the device that buys the
accent**, and 0.5 s is roughly an order of magnitude below what the reference
set spends on its two biggest moments.

This board inherits the error. §7 gives K1 **14 frames — 0.47 s** — the
*shortest* of its four holds, sitting immediately before the beat's only moment.
It should be the **longest**. §10.3 has the frame ledger.

#### C4 · The board's appendix quoted a pan that does not exist

Corrected in place, at the appendix. Exquisite Corpse has no pan; the two shots
the claim describes are joined by a hard cut (mad 18.6, hcorr 0.701, one frame),
and both cuts leave a still frame (mechanics §2.7). The board's inference —
*the substrate is continuous and the event happens on it* — survives, because
the original flip's one centre is our own measurement of our own film. It is not
inherited and must stop being presented as such.

#### C5 · The turn is authored at 5 frames and needs 13 — B1's own number requires it

**B1 survives, strengthened by two independent confirmations.** The mechanics
doc's §6.5 places 22 reference transits into two modes — **arrival at 9–37 %**
and **wind-up at 79–93 %** — with nothing evenly spaced except four opacity
fades. The original flip's 87 % is the wind-up signature exactly, alongside the
title spring's 91.9 % and the pre-cut ramp's 93.4 %.

And measuring it a third way, off the extent series rather than by solving the
`cos` law (`docs/storyboard/tools/assert-moment.mjs`):

| | breakdown |
|---|---|
| original, turn out, f140–168 | **89.7 %** |
| original, turn back, f225–248 | **85.6 %** |
| board's B1, by solving `easeInOutCubic(t) = 1/3` | 86.9 % |

Three methods, three numbers, all inside the reference set's wind-up band.

**But §7 contradicts it.** The exposure sheet gives the turn-out **5 frames**
(f99–103) and the turn-in 5. B1's own text says *"the face-out half is 13
frames."* At 5 frames a breakdown at 87 % lands at frame 4.35 — so the readable
commit gets 4 frames and **the whip gets 0.65 of a frame.** A whip shorter than
a frame is not a whip; what renders is four frames of near-linear narrowing and
then a jump. **The 87 % is only expressible if there are enough frames to hold
it.**

What the original actually does, read off `traced.tsv` f140–155 — and note the
duplicated frames, which are the film animating on twos:

```
f140-146  w 409 409 409 409 409 409 409     the turn is underway and INVISIBLE
f147      w 403
f148-149  w 397 397
f150      w 355
f151-152  w 309 309
f153      w 135
f154-155  w  14  14        <- THE EDGE, held 2 frames, byte-identical
```

Two numbers fall out. The **authored** half-turn is 13 frames = 433 ms. The
**visible** narrowing is 8 frames = 267 ms, because `|cos|` is flat at the top —
so *the six frames immediately before the whip are indistinguishable from a
hold.* 433 ms also lands exactly on the reference set's transition-length
cluster (mechanics §6.3/transfer #10: *"292 ms or 433–467 ms. Two values, used
consistently. Nothing in between"*).

**So authoring the turn at the original's 13 frames buys the pre-moment
stillness for free**, from the shape of the cosine, and it satisfies mechanics
§2.2's corrected rule (*a cut is preceded by a hold*) without spending a frame
on it. The board's 5-frame turn destroys exactly that. **Correction: 13 frames
per half-turn, ×4 turns.**

#### C6 · Twos, everywhere the camera is parked — not just at the turn

Mechanics §4.3: *every* authored graphic passage in Exquisite Corpse is on twos
(parity ratios 9.9× to 19.4×); only the live-action video runs on ones. §7 of
this board puts only the turn on twos. Its reason for not going further — *"it
is dangerous to animate on double frames during a table move or camera track"* —
is right, and it excludes only the rise and the orbit. **K1, K2, the four turns,
the land, K4, K6 and K7 are all camera-parked and all eligible.** Quantise the
animation clock to 12 Hz across the parked portion. Transfer #4 prices it at one
clock quantisation.

#### C7 · The sliver IS our empty frame — and that mapping sizes the hold, not the dwell

Mechanics §4.7 and transfer #1: the strongest device in the set is **taking
something away**, and *"ours has a continuously-occupied frame… which is why
there is no instant to point at."* The board never makes the connection, and it
should, because K3′ **is** that device:

| | Exquisite Corpse | this board's K3 |
|---|---|---|
| the absence | cut to empty ochre | narrow to a 14 px sliver |
| duration | 625 ms (14 fr at mad 0.000) | 67 ms (2 fr, byte-identical) |
| as a share of its payoff unit | 13.8 % | ~7 % |
| absence : presence after it | **1 : 6.3** | 2 fr : 18 fr = **1 : 9** |

The dwell should **not** be lengthened toward 625 ms — EC's absence is a *cut to
a different shot*, ours is a continuous turn through edge-on, and a 14-frame
edge-on hold breaks the `|cos|` law and reads as a freeze mid-turn. What the
mapping tells us is the other half: **the ratio is already right, so the thing
to protect is the hold after it.** K4's 18 frames is the payoff of the absence.
Do not spend it.

#### C8 · 37 % held is not 24 points light — it is measured against the wrong unit

Mechanics §1 reports **61 % of all reference footage held** (I reproduce 60 % at
`mad < 0.15`, 74 % at `mad < 0.5`). This board budgets **37 %**, and read
side-by-side that looks like a large miss. It is not.

61 % is a **whole-film** number across 114 seconds and 22 cuts; most of that
stillness is *shot holds between cuts*, and our beat is one continuous take with
no cuts to hold between. The comparable unit is Exquisite Corpse's **payoff
unit**, and mechanics §4.5 measures it: 4.5 s of which **1.6 s — 36 % — is a
parked frame with nothing happening.**

**36 % is the bar, and the board's 37 % already meets it.** Stated so nobody
"fixes" a number that is right.

---

### 10.3 What the stall fix changes — the timing plan, re-examined

`docs/explainers/18-the-reveal-stopped-rebuilding.md`: worst frame **~1100 ms →
16.7 ms**, median 8.3 ms, **0 frames over 100 ms**, and the 0.54 s emerge went
from **0 rendered frames to 65**. (The dispatch brief quotes 10.4 ms; the
explainer's own table says 16.7 ms. Using the doc.)

Four consequences, in descending order of how much they change this board.

**1 · The board's central mechanic was unbuildable when the board was written.**
K3 is two frames at 30 fps. Pre-fix, the emerge received **zero** rendered
frames — a two-frame event scheduled inside it could be swallowed whole, and the
timeline's own `MAX_STEP = 0.25` clamp existed specifically to stop the stall
jumping `breath` straight past `emerge` to `tilt`. A 67 ms dwell was not
representable. Post-fix, 65 frames land on a 0.54 s window. **The one thing this
board is for is now purchasable.**

**2 · `desk-doodles-hero-v2.webm` is a record of the stall, not of the beat.**
The film is dated **2026-07-29 01:26**; the fix landed **2026-07-30 12:10**. In
`hero-v2.tsv` the whole emerge is a **single frame** — f92→f93, mean ink
luminance 37.7 → 58.0, ink +23 %, on an **unchanged 418 px bbox**. That is the
stall's signature, and it means §1.3's CURRENT row was measured on a distorted
capture.

*The conclusion survives, and gets stronger.* Even in the capture where the
emerge is compressed into one frame — the most event-like this beat could
possibly be — **the extent still never changes**, so it still registers zero
moments. The stalled film is the best case for the current beat's drama and it
has none.

*What does not survive is using that film to measure tempo.* The authoritative
substrate is the scrub capture in `verification/hero-transition/after/emerge/`,
which drives the page's own transport to 71 playhead positions and screenshots
each — seek-based, so the stall cannot touch it.

**3 · B2's 42 % reproduces exactly, on the right substrate, with both readings
agreeing to 0.0 points.** `docs/storyboard/tools/spacing-emerge.mjs`, using the
same interior-ink-SD statistic the shipped gate uses:

```
gate's parked window (breath tail + emerge)   span  5.23  value-half 64.5%  extreme 63.3%
emerge only, from first tonal movement        span  5.22  value-half 55.7%  extreme 54.2%
the whole tonal transit (runs into the tilt)  span 10.95  value-half 42.2%  extreme 42.2%
```

Mechanics §6.5 treats agreement between the two readings as the check that the
metric measures the move rather than the metric. On the full transit they agree
to **0.0 points at 42.2 %** — B2's number, independently reproduced. Every
narrower window lands at 47 %, 56 % or 65 %: **not one reading anywhere near
arrival (9–37 %) or wind-up (79–93 %).**

And the reason, which the board did not have:

```
THE POSE, over the 31 parked frames the gate judges:
  bbox width takes 1 distinct value: 540
  bbox cx    takes 1 distinct value: 559.5
```

§6.5's own explanation of the dead band is *"transitions with no pose to break
down."* **This beat does not merely space like an opacity fade — it is one.**
There is no pose to break down: the silhouette is 540 px on 31 of 31 frames, and
moves 540 → 546 (1.1 %) across the entire 1.285 s capture.

**4 · Holds, and twos, are now honest.** Pre-fix a "hold" could be a stall and
frame timing was not the beat's to control; C6's 12 Hz quantisation would have
been meaningless. Both are now authorable. And the timeline has one owner —
`HeroBeats` is derived from `tl.<phase>.duration`, so §7's exposure sheet is
directly expressible as clip durations.

**One thing got harder, and it is the board's own #1 fix.** §4 calls K1→K2 *"the
single most broken adjacency, and it is free to fix: move the squash before the
moment."* Under the new ownership it is **not** a drag. `HERO_PHASES`
(`hero-motion.ts:50`) is a fixed const array, phases are laid out by cumulative
sum, and explainer 18 §5 records that dragging a clip's body snaps back because
*"there is no meaning to moving a phase without reordering, and the order is
fixed."* Reordering `anticipation` before `emerge` is an edit to `HERO_PHASES`
and to `sampleHeroMotion`'s if-chain; DialKit then follows. Small — but it is
code, and it should land before anyone tries to tune this beat in the panel,
because otherwise the panel teaches its user that the order is immovable.

#### The frame ledger

C3 and C5 both want frames, and C5 spends 32 of them. Here is the arithmetic on
§7's 267-frame / 8.90 s budget, so the cost is visible rather than asserted.

| change | Δ frames |
|---|---|
| C5 — four turns at 13 frames instead of 5 | **+32** |
| C3 — K1's hold 14 → 33 frames (0.47 s → 1.10 s) | **+19** |
| call 3 — rise 42 → 30 frames (§10.5) | −12 |
| call 3 — settle 9 → 12 frames (ease-out tail) | +3 |
| call 1 — K7 30 → 11 frames (§10.5) | −19 |
| K6 28 instead of 36, az arriving inside the settle (C1) | −8 |
| draw-in 76 → 64 frames (2.53 s → 2.13 s) | −12 |
| | **+3** |

Which closes at 270 frames / 9.00 s — 0.10 s over the original, 1.20 s under the
current film. Authored holds 33 + 18 + 28 + 11 = **90 = 33 %**; add the ~6
leading and trailing frames of each 13-frame turn that are visually static by
`|cos|` and the *read* stillness is **≈ 43 %** — above C8's 36 % bar.

**The draw-in trim is the one line in that table I would not defend hard.**
Handwriting is the product's other claim and 0.40 s is real. If Sebs wants the
draw-in kept whole, take the 12 frames from K6 instead and let the beat run
9.40 s; nothing in the reference set says a beat must be 8.90 s, and mechanics
§10.4's actual budgeting rule is *"if our beat has 9 seconds, roughly half of
them should be spent not showing the thing."*

> 🔨 **THAT LAST PARAGRAPH WAS RIGHT AND THE TABLE ABOVE IS WHAT PROVED IT — see
> the re-cut below.** The draw-in trim is not merely undefended, it is
> **falsified by measurement**: the draw the ledger authorises runs the pen at
> **7.88× a real hand**. The re-cut is the next subsection. The table above is
> left standing, unedited, on §10's own precedent.

#### The frame ledger, RE-CUT — twelve rows, and a draw a hand could have made

> ⚠ **Added 2026-07-31. This supersedes the table above; it does not replace
> it.** What the ledger above **used to say, and what is now wrong with it:** it
> closed at **270 frames / 9.00 s** across **ten** rows, with **draw-in at 64
> frames / 2.13 s**, and it had **no row at all** for the two camera moves the
> beat cannot be shot without. That is not a historical note. It is a live
> constraint: `scripts/verify/assert-hero-ledger.mjs` hard-codes those ten rows
> as `LEDGER`, `draw: 64` among them, and asserts *"the beat lands on §10.3's
> ledger, row by row"* — so the stale table is the thing standing between the
> draw-in and its own measured floor.

**Why the draw row has to move, measured rather than argued.**
`node scripts/verify/measure-drawin-pacing.mjs`, run 2026-07-31 against the
shipped `lib/pen-reveal.ts` clock and the real traced word:

```
the app's own Play         16.805 s   (the Sigma-Lognormal reconstruction's own duration)
the hero beat's draw        2.133 s
compression                 7.88×  faster than the pen
median stroke               0.360 s recorded → 45.7 ms on screen
shortest stroke             0.241 s recorded → 30.6 ms on screen
the literature's floor for a real hand movement: 100 ms
draw beat that would clear it, MEDIAN stroke:    4.666 s
draw beat that would clear it, SHORTEST stroke:  6.971 s
```

The 100 ms floor is not a taste call. `docs/research/handwriting-variability.md`
§3, from Djioua & Plamondon's parameter-extraction report: *"Movement time is
typically **100–500 ms**, with the velocity peak about **100 ms** after `t0`."*
Below that band there is no hand that produces the stroke. At 2.133 s the beat
is asking for a word written at eight times human speed, and `measure-drawin-pacing`
already reports that row **FAIL**ing (`human-speed`, `30.6 ms at 7.88× compression`).

**4.666 s is the defensible value, and 6.971 s is not.** 6.971 s is sized off the
single shortest stroke, and that stroke is polyline **#1 — three raw points,
4.9 stroke units, 0.153 % of the word's travel** (measured off
`scripts/capture/logo-strokes.json` through `_hero-word.mjs`). Spending 2.3 extra
seconds of screen time to buy a floor for one six-hundredth of the ink is the
tail wagging the word — and it costs the beat its stillness (below). **4.666 s
puts the MEDIAN stroke exactly on the floor**, which is the honest reading of a
distribution rather than of its minimum. 4.666 s is **140 frames** at 30 fps.

**The re-cut, row by row.** Twelve rows, because the beat has twelve phases —
`HERO_PHASES` (`lib/hero-motion.ts:74`) is `draw · breath · anticipation ·
emerge · land · solid · tilt · standup · orbit · descend · returnTurn · hold`.
The ledger above has ten because `tilt` and `descend` were never given rows;
§7 puts K4 at el 0° and then K5 at *"el 65→10°"* with nothing in between that
gets the camera to 65, and it puts the return turns "parked" at K1's framing
with nothing in between that gets it back. Both moves have to exist for the
shots either side of them to be the shots the board describes.

| row | §10.3 above (10 rows) | shipped 2026-07-31 | **RE-CUT** | Δ |
|---|---|---|---|---|
| `draw` | 64 | 64 | **140** | **+76** |
| `breath` | 33 | 33 | 33 | — |
| `anticipation` | 9 | 9 | 9 | — |
| `emerge` | 28 | 28 | 28 | — |
| `land` | 9 | 9 | 9 | — |
| `solid` | 18 | 18 | 18 | — |
| `tilt` | **no row** | 13 | **13** | — |
| `standup` (rise + settle) | 42 | 42 | 42 | — |
| `orbit` | 28 | 28 | 28 | — |
| `descend` | **no row** | 13 | **13** | — |
| `returnTurn` | 28 | 28 | 28 | — |
| `hold` | 11 | 11 | 11 | — |
| **total** | **270 fr / 9.00 s** | **295 fr / 9.833 s** | **371 fr / 12.367 s** | **+76** |

The row sums come to 372 and the beat measures 371; the one frame is `emerge`
and `returnTurn` each being 27.5 frames (`0.85 + 2/30` at 30 fps) and each
rounding up. That is frame rounding, not slack, and it is the tolerance
`assert-hero-ledger.mjs` already carries.

**THE NEW BEAT TOTAL: 371 frames / 12.367 s at 30 fps.**

**THE READ STILLNESS: 36.1 %**, against C8's 36 % bar. Measured off the model,
not budgeted — 90 frames in shots that genuinely stop (`breath` 33 · `solid` 18 ·
`orbit` 28 · `hold` 11, every frame of each proven identical to its own first
frame) **+ 44 frames elsewhere identical to the frame before them** (the twos
grid, `anticipation` 6 · `emerge` 17 · `land` 6 · `returnTurn` 15) = 134 of 371.

⚠ **State the margin honestly: 36.1 % against a 36 % bar is a third of a frame.**
It clears, and it clears because the twos exposure earns 44 frames the §10.3
estimate had to hand-wave as *"the ~6 leading and trailing frames of each
13-frame turn that are visually static by `|cos|`"*. But one frame either way
flips it, so this is not a number to build a second decision on top of. Three
things are true about it and all three are measured:

1. **6.971 s does not clear the bar.** 440 frames, same 134 still frames,
   **30.5 %**. That is the second, independent reason the shortest-stroke figure
   is the wrong one — it is not merely expensive, it takes the beat below C8.
2. **`draw` is deliberately NOT in `PARKED_PHASES`** and that is where the
   margin went. `lib/hero-motion.ts:104-107`: *"`draw` is camera-parked and is
   NOT here, deliberately. C6's list does not name it, and the draw-in is the
   one passage whose motion IS the pen's own speed: quantising it quantises the
   handwriting. One line to add if that is wanted; it is not assumed."* If it
   were added, 140 frames on the 12 Hz grid hold **56 distinct states, so 84 of
   the 140 repeat**, and read stillness goes to **218 / 371 = 58.8 %**. That is
   a real option with a real cost and it is **not taken here** — it is a hand-feel
   call, and the code is right that it is not the ledger's to assume.
3. **The bar is being applied to the wrong unit, and C8 is the section that
   says so.** C8's whole argument is that 61 % is a *whole-film* number and
   *"the comparable unit is Exquisite Corpse's **payoff unit**"* — 4.5 s of
   which 1.6 s is parked. The draw-in is not in our payoff unit; it is the
   **setup**. Measured on everything from `breath` onward — 231 frames either
   way, because the draw contributes no still frames at all — the payoff unit is
   **134 / 231 = 58.0 % still, and that figure does not move by one frame no
   matter how long the draw runs.** The stillness of the payoff is simply not a
   function of the draw's length, which is the reason the draw's length should
   not be decided by the stillness bar.

**And the reference set says the longer setup is the more correct one.**
Mechanics §4.6 measures Exquisite Corpse's accent placement three ways and
records the setup-plus-payoff unit at 8.875 s with the accent at **48.8 %**,
*"Before : after = 4.334 s : 4.541 s = 1 : 1.05"*, and draws the conclusion in
its own bold: *"The film spends as long refusing to show you the thing as it
spends showing it. […] That 1 : 1 setup-to-payoff ratio, not any easing curve,
is what makes the reveal read as a reveal rather than as a transition."*
Measured on our beat, with the accent taken as the centre of the turn's dwell:

| | accent at | before : after |
|---|---|---|
| shipped, `draw` 64 fr | 40.6 % | 1 : 1.46 |
| **re-cut, `draw` 140 fr** | **52.8 %** | **1 : 0.90** |
| Exquisite Corpse — the reveal | 48.8 % | 1 : 1.05 |
| Babbu — the word-flip thesis | 39.2 % | 1 : 1.55 |

Both of ours sit inside the set. Lengthening the draw moves our accent off
Babbu's placement and onto Exquisite Corpse's, which is the film this board
takes its stillness bar, its absence device and its twos from.

**What this costs, stated so it is not discovered later.** The beat runs
12.367 s where it ran 9.833 s. §10.3's original budget was 8.90 s and its
worry was that 9.40 s was already long. That worry was written before K4, K7,
the two camera moves and the twos exposure existed, and before anyone had
measured what the draw was actually doing to the handwriting. The trade is
2.53 s of runtime for a pen that moves at a speed a hand can produce — on a
page whose other claim is handwriting.

---

### 10.4 §8's gate rewrite — run against both films, and it is not sound as drafted

**Tool:** `docs/storyboard/tools/assert-moment.mjs`. It runs the shipped gate 4/5
and the proposed 4a/5′/6 over the same per-frame series, on both films and on
four synthetic negative controls, and exits non-zero if any verdict is wrong.
Full output: paste it from `node docs/storyboard/tools/assert-moment.mjs`.

The claim §8 has to prove is not *"the new gate passes."* It is three claims, and
the third is the one that matters, because gate 4 exists to catch a real defect —
the two-canvas crossfade that mis-registered
(`hero-2d-to-3d-transition.md` §3). **A gate that is loosened and never re-tested
has been deleted.**

```
subject                                                  shipped  §8       §8+fixes  wanted
ORIGINAL FLIP — the turn out (flat logo -> 3D card)      REJECT   accept   accept    accept
ORIGINAL FLIP — the turn back (3D card -> flat logo)     REJECT   REJECT   accept    accept
CURRENT BEAT — the emerge, camera parked                 REJECT*  REJECT   REJECT    REJECT
NEGATIVE CONTROL — mis-registered layer swap (+6 px)     REJECT   REJECT   REJECT    REJECT
NEGATIVE CONTROL — layer swap offset VERTICALLY (+6 px)  REJECT   REJECT   REJECT    REJECT
NEGATIVE CONTROL — hard cut, 2 blank frames              REJECT   accept   REJECT    REJECT
NEGATIVE CONTROL — one-frame blink                       REJECT   REJECT   REJECT    REJECT
```

\* *the shipped gates ACCEPT the current beat — 7/7 PASS on the scrub capture,
run just now. They read REJECT in this table only because the film substrate is
the stalled real-time capture (§10.3 point 2), where a 0.43 s tonal ramp is
recorded as one 20-luma step. The **extent** verdict, which is the one at issue,
is identical on both substrates.*

**§8's direction is right and its central idea holds.** The proposed set is the
first thing in this project that accepts the original flip's moment while still
rejecting a mis-registered swap — including one offset *vertically*, which I
added as a control specifically because the axis fix below could have opened
that hole. It does not.

**But §8 as drafted fails two of the seven rows, and its third gate is measuring
the wrong quantity.** Three defects, each found by running it:

**Defect 1 — "tighten `maxCentreJump` to < 2 — the original earns it" is false.
The original's return turn measures 2.55 px and would be rejected.**

Read off `traced.tsv`, and this is the whole story:

```
f234  w 136  cx 479.5  cy 269.0   y0 223  y1 315
f235  w  14  cx 479.5  cy 271.5   y0 231  y1 312    <- the sliver
f236  w  14  cx 479.5  cy 271.5
f237  w 237  cx 479.0  cy 269.0   y0 224  y1 314
```

**`cx` does not move — 479.5 through the entire event.** What moves is `cy`, by
2.5 px, because at the sliver the bbox loses whichever parts of the letterforms
fall under threshold first, and it loses them asymmetrically: `y0` walks +8 px
while `y1` walks −3. Nothing has moved. The vertical bbox midpoint of a
collapsing silhouette is not a registration signal.

**Fix:** the turn is about a **vertical axis**, so registration is a `cx`
property and must hold on every frame. Judge `cy` only on frames that still have
a silhouette to register (extent ≥ 20 % of settled) — and a swap offset
vertically at the collapse is still caught, because the frames either side of
the gap get compared. Verified by the new vertical-offset control, which fails.

**Defect 2 — §8's gate 5′ accepts a hard cut to two blank frames.**

As written it requires only that *"the extent collapses below 5 % of the settled
width, held for ≥ 2 frames, while the centre moves less than 1 px."* A frame
with nothing in it satisfies all three. The synthetic 2-blank-frame cut **passes
§8 as drafted** — and that is precisely the discontinuity §7's own "three
numbers a rebuild must not lose" puts first: *"The clamp: `sx ≥ 0.035`. Never a
blank frame."* The gate does not encode its own doc's #1 constraint.

**Fix:** add a floor and a recovery. The moment must be a **sliver, not a
blank** (`ink > 0`, extent ≥ 2 px) and the extent must **return to ≥ 90 % of
settled** afterwards — otherwise a beat that collapses and stays collapsed also
passes. Measured headroom: the original's sliver is **14 px = 3.4 % of the 409–410 px
settled word**, on both turns, so a band of `0 < extent ≤ 5 %` clears the real
event by a comfortable margin.

**Defect 3 — the stillness gate measures the thing that already stopped.**

§8 proposes *"per-frame centre motion < 0.5 px for ≥ 20 consecutive frames."*
Two problems, both measured:

- It catches the current beat at **exactly 0.50 px** — a single quantisation
  step of a half-pixel bbox centre. A gate whose verdict turns on the last
  representable digit is a coin toss, not a criterion.
- It is aimed at the wrong quantity. C1: over the final 40 frames the centre
  moves a **net 0.0 px**. The centre *has* stopped. What has not stopped is the
  extent — width +4 px, height +2 px, ink +2.9 %.

**Fix:** measure **net displacement over the window, across all of extent** —
net centre < 1 px, net width < 2 px, net height < 2 px, net ink < 0.5 %. On the
current beat's last 20 frames that reads `net centre 0.50 px, net w 3 px, ink
1.60 %` → **FAIL**, decisively and on the right quantity. On the original's final
hold it reads `0.00 / 0 / 0 / 0.00 %` → **PASS**, perfectly.

**Verdict on §8: adopt it, with those three amendments.** With them the gate set
agrees with all seven wanted verdicts and the tool exits 0. Without them it
rejects half of the only thing in the project that has a moment, and accepts a
cut to black.

*Gates 1, 2, 3 and 4a-no-value-wash are untouched by all of this and stay exactly
as they are. They are pure craft and they are right.*

---

### 10.5 The four open calls — a recommendation each, and what each costs

*Sebs's calls. Each is presented with the option I would take, the evidence
behind it, and what the other branch costs — not as a menu.*

#### Call 1 · Does K7 return to flat, or to a *changed* flat?

**Recommendation: changed flat — and move the crossing resolution out of K4 and
into K7.**

**Evidence.** The original returns to a *pixel-identical* state: `traced.tsv`
f140–146 and f244–275 are the same numbers — ink 11423, w 409, h 91, cx 479.0,
mean 36.8. So identical-flat is what our own foundation does. But every
reference film ends on a **changed** state, and their final hold is spent on the
change, not on the original: Doodle Fonts resolves doodle → plain sans and holds
it 400 ms; Babbu's card turns blue → green and holds 1.21 s; Exquisite Corpse
*reshuffles* the figure after it has already assembled, then holds 958 ms.

**The argument that decides it is one the board does not make.** K4 currently
carries **two** arrivals in nine frames — *"the crossings resolve into over/under,
and the contact shadow lands."* That violates the most consistent finding in the
reference set: **one thing moves at a time** — 100:1 band separation during
Exquisite Corpse's shuffle, simultaneity of exactly 1 through Babbu's entire
eleven-event cascade. Splitting them gives K4 the shadow and K7 the crossings:
one piece of news each, and K7 becomes a key shot instead of a bookend.

It also passes §2's own admission test, which identical-flat does not. Freeze
and print K7: if it is identical to K1, then two of the seven key shots are the
same picture, and that is one key shot.

**Hard constraint, either way.** If changed-flat, the change must be **occlusion**
— a break in the under-stroke, paper showing through — and **never shading**. A
value difference at a crossing breaks gate 1 (flat ink SD < 1), which is
non-negotiable. An occlusion gap leaves every remaining ink pixel at one value,
so it passes. This constraint is not in the board and it decides how the shot
can be built at all.

**What identical-flat costs if he takes it:** it is safer, it is exactly what the
original does, and it keeps the claim modest — *your hand survives* rather than
*your hand came back better.* The price is that the beat's last second carries
no information. If he takes it, **shorten K7** — 30 frames of a frame the
audience already saw at f76–89 is dead air — and give the frames to K1, where
C3 says they belong. The ledger in §10.3 already assumes K7 at 11 frames, so
either branch closes.

#### Call 2 · How true is "the true edge"? How much profile in 14 px?

**Recommendation: geometrically true, visually silent. Show the real form's real
edge, add nothing to make it legible, and prove the taper on the *approach*
frames rather than at the sliver.**

**Evidence.** At 67 ms nothing detailed resolves. The reference set's own
evidence for that is direct: Exquisite Corpse's 4 Hz ink boil is a genuine
redraw of every line and it reads as *texture*, not as detail; Doodle Fonts'
glyph substitutions are 67 ms apart and read as *"a slot machine settling"* —
at that interval the eye registers **that** something changed, never **what**. A
taper across 14 px is a 2–6 px difference at the ends. It will not be read.

**But the sliver is not the only frame the edge appears in.** The turn-out passes
through 135 px and 355 px on its way down (`traced.tsv` f153, f150) and the
turn-in through 237 and 309 (f237, f238). **Those frames are 20–80 px of pure
edge-on form, they already exist, and the profile is genuinely resolvable there.**
Budget the proof to them. It costs nothing.

**One hard constraint, measured.** The original's two dwell frames are
**byte-identical** — f154 and f155 both read ink 410, w 14, cx 479.5, mean 99.4;
f235 and f236 both read ink 559, w 14, cx 479.5, mean 95.1. Whatever profile the
sliver shows must be **frozen across both frames**. A 1–2 px joint bead at 14 px
that aliases differently on the two frames converts the dwell from a held beat
into a two-frame shimmer, and the dwell is the entire reason K3 reads as an event
rather than a dropped frame.

**What the other branch costs.** Going *more* true — a visible taper, legible
joint beads — risks that shimmer, and risks a 14 px feature reading as an
encoding artifact rather than as craft. Going *less* true — a clean straight
edge — is worse: a rectangle at the sliver is indistinguishable from the
original's squeezed raster, and then K3′ buys nothing at all. The whole proposal
is that the hiding place becomes the payload; a fake edge that merely looks
different is still a hiding place.

#### Call 3 · Does the rise keep its full 1.4 s?

**Recommendation: keep 1.4 s only if the curve is rebalanced ease-out-dominant.
If it stays symmetric `easeInOutBack`, cut it to 1.0 s.**

**Evidence, and the duration is not actually the problem.** 1.4 s is longer than
**any single move in 114 seconds of reference film** — the longest is Doodle
Fonts' stamp scale-down at 1100 ms, which mechanics §6.4 flags as *"the only slow
continuous change"* in the entire set; the next longest are Babbu's dollies at
834/750/751 ms. So the rise is 27 % longer than the reference maximum.

But the sharper finding is §6.1: *"Every move in the reference set is **ease-out
dominant**: a short acceleration (≈ 4 frames), an early velocity peak, and a
long decay (3–4× the rise). Nothing eases in symmetrically."* Our rise is
`easeInOutBack` — **spaced 50:50**. That is the same defect as B2's 42 %, one
level up: a symmetric move reads as *travelling*; an ease-out-dominant move reads
as *arriving*. **1.4 s of ease-out-dominant motion is one arrival. 1.4 s of
symmetric motion is a camera move.**

So the recommendation preserves the gesture and fixes what is actually wrong with
it: 4-frame rise, early velocity peak, ~1.1 s of decay, overshoot intact.

**If the curve stays as it is, cut to 1.0 s.** The counter-dip survives that
comfortably — `easeInOutBack(c1 = 1.70158)` dips from t = 0 to t ≈ 0.36 with its
extreme at t ≈ 0.25, so at 30 frames the dip still occupies ~11 frames with its
low point 7–8 frames in. Nothing about the overshoot's legibility requires 42
frames.

**What each costs.** Keeping 1.4 s symmetric: the beat's largest gesture competes
with the moment for what you remember, and it is the one stretch where the
reference set's unanimous rule is broken. Cutting to 1.0 s: the one thing in this
beat that is genuinely ours — a drawing standing up — gets 29 % less screen time,
and if Sebs feels the rise **is** the product, that is the wrong trade. **B4's
"do not touch it" stands for the overshoot and for `backC1`; it should not be
read as protecting the 50:50 spacing, which B4 never examined.**

#### Call 4 · Film or page first?

**Recommendation: the page, and it is no longer a close call — the stall fix
decided it.**

**Evidence.**

1. **The film pipeline cannot currently record the truth about this beat, and
   the page now can.** `desk-doodles-hero-v2.webm` is the proof — captured
   2026-07-29 01:26, fix landed 2026-07-30 12:10, and its entire 0.54 s emerge is
   one frame (§10.3). Investing in the film path before the beat is settled
   produces more artifacts like it, and the board itself already measured one of
   them into §1.3.
2. **The timeline has exactly one owner and it is on the page.** `HeroBeats` is
   derived from `tl.<phase>.duration`; the page's own state is
   `Omit<HeroMotionParams, "beats">`, so *"a second copy of a beat is not
   discouraged — it is unrepresentable"* (explainer 18 §5). The film path is
   downstream by construction. Doing it the other way authors the beat twice.
3. **The bridge already exists and it is a clipboard, not an import.** I verified
   §4's orphan claim and it needs one correction: `motion.mjs` has **zero code
   importers** — `compose.mjs` imports only `@napi-rs/canvas` and node builtins;
   `capture-run.mjs` imports only `playwright-core` and `./letters.mjs` — but it
   is not dead. `app/desk-doodles/page.tsx:1309` renders a **"Copy motion.mjs
   constants"** button wired to `toMotionMjsSource(motion)`
   (`hero-motion.ts:619`), and `page.tsx:1315` tells you to paste it into
   `scripts/capture/motion.mjs` and re-capture. So page → film is a manual
   copy-paste, by design. Sequencing the page first costs nothing and the paste
   is the last step.

   > 🔨 **⚠ ALL THREE LINE NUMBERS IN THAT PARAGRAPH HAVE ROTTED. The claim is
   > intact; the citations are not** (2026-08-01, each re-opened first-hand —
   > §1's own rule, *"a citation is not evidence — OPEN THE LINE YOU CITE"*).
   > The paragraph **used to read** `page.tsx:1309` for the button,
   > `hero-motion.ts:619` for the generator and `page.tsx:1315` for the paste
   > instruction. Live: the button's label is
   > **`app/desk-doodles/page.tsx:2003`**, its handler `copyConstants` is
   > **`:1065`**, the paste instruction is **`:2005–2009`**, and
   > `toMotionMjsSource` is **`lib/hero-motion.ts:2101`**. `page.tsx:1309` today
   > is the phase read-out in the timeline dock — a real line, the wrong one,
   > which is the failure mode that makes a rotted citation worse than none.
4. **`motion.mjs` should be regenerated or deleted in the same pass, not left.**
   It carries two of the falsified claims in its comments — `:28`
   `breath: 0.5, // ... ("cuts land on motion")` and `:145` `PUSH_SCALE_END`
   citing *"never static"* — and it is the file this board quotes for *"the
   transition being near-invisible is the point."* A zero-consumer file that
   states the beat's design goal is exactly how a falsified rationale survives
   another pass.

**What page-first costs.** The encodable artifact stays the old card flip for
longer, so there is nothing new to cut into a submission film until the page
work lands. If a film is needed *sooner* than the beat can be finished, that is a
real reason to invert this — and it is the only one. **Film-first costs authoring
the beat twice, against a pipeline whose only current output is the thing this
board exists to extend past.**

---

### 10.6 What is not done

- **No online reference research, and one call is provisional because of it.**
  Out of lane (§10.1) — the reference-film deep pass has a dedicated owner, and
  that lane is **live**: `docs/refs-online/` holds eleven clips of *a flat mark
  becoming a dimensional form*, with contact sheets on disk, but its research doc
  `docs/research/online-reference-mechanics.md` **does not exist yet**. That is
  the first set of footage that contains our actual move. **Calls 1 and 2 should
  be re-run against it when it lands** — see the Appendix. Call 3 and call 4 do
  not depend on it.
  > **✗ STALE — "does not exist yet" is false. It landed 2026-07-31**
  > (`docs/research/online-reference-mechanics.md`, 60 KB, eleven clips,
  > 30 transits, per-frame TSVs checked in). Its own §9 carries a recency note
  > flagging this same line. **The re-run this bullet asks for has been done —
  > §11.5**, and §9's instrument passes six synthetic controls before it touches
  > footage, including one built to make the occlusion-vs-rotation discriminator
  > say ROTATION. Neither call is answered; both are better informed, and call 2's
  > geometry turns out to have no precedent in the set at all.
- **The Ken-Burns passage-level fit** (best translation + best uniform scale, last
  frame onto first) is cited, not re-derived; the checked-in columns carry a
  per-frame series instead. The necessary condition is verified (§10.2 C1).
- **No browser was launched.** Nothing here needed one — every number comes from
  checked-in per-frame data or checked-in capture frames. *Flagged for the
  controller:* `docs/DISPATCH.md` §3 (2026-07-30) now says headless is fine and
  is Sebs's preference, while the portfolio's `AGENT-DISPATCH-CONTRACT.md` §19
  (2026-07-29) still reads *"HEADED IS THE STANDARD. Headless is NOT an
  acceptable substitute… 'unaccepatbel.'"* Later date wins under the engine's own
  recency rule, but the two documents disagree in writing and §6 of the engine
  says a new standing rule is folded in the same session. Someone who owns that
  file should reconcile it.
- **The revised exposure sheet in §10.3 is a ledger, not a replacement for §7.**
  §7's table is left standing so the two can be compared; whichever way calls 1
  and 3 go changes two of its rows.

---

## 11. What is built, and what the build changed

*Added 2026-07-31. §10 reconciled this board against two **documents**. This
section reconciles it against the **code**. Since §10 was written the board
started being BUILT — the turn, the rise, the phase order, the camera park and
the gate rewrite have all landed — and §1–§9 still read as a plan for none of it.
A board that reads as unbuilt when half of it has shipped is stale scaffolding,
and the next reader re-derives decisions that are already closed. Where a §1–§9
passage is now false it carries a **⚠** or **✓** note in place, on §10's own
precedent: the superseded text is left standing beside the correction, never
deleted.*

### 11.0 What is first-hand here

Everything below was re-run or re-measured on this machine. No number in this
section is inherited from a brief or from another section of this file.

| what | how | result |
|---|---|---|
| the turn | `node scripts/verify/assert-hero-turn.mjs` | **8/8**, and **8/8 correctly FAIL** on the `emerge.mode="prior"` control |
| the rise | `node scripts/verify/assert-hero-rise.mjs` | **6/6**, 3 of 6 correctly fail on the symmetric control |
| the gates, new | `node scripts/verify/assert-hero-transition.mjs --label=turn3` | **7/9** — two FAILs, §11.4 |
| the gates, prior, on the turn capture | `… --label=turn3 --gates=prior` | **4/7** |
| the gates, prior, on the pre-turn capture | `… --label=after --gates=prior` | **7/7** — the old verdict, reproduced |
| the gates, new, on the pre-turn capture | `… --label=after` | **6/9** — the instrument rejects the old beat |
| films + 4 synthetic controls | `node docs/storyboard/tools/assert-moment.mjs` | **SOUND**, exit 0, all 7 wanted verdicts |
| the emerge series, per frame | own probe, reusing the gate's own `measure()` verbatim | tables below |
| the parked span, per frame | own probe over the `orbit`+`hold` scrub frames | §11.1.4 |
| §9 of the online-reference doc | read in full | §11.5 |

Nothing was written outside this file. No browser was launched — the captures
under `docs/verification/hero-transition/turn3/` already exist and every pixel
figure comes from them.

> 🔨 **⚠ FOUR ROWS OF THAT TABLE HAVE MOVED, AND BOTH NEW-GATE ROWS MOVED THE
> SAME WAY — 2026-08-01, every arm re-run first-hand.** The two `--gates=prior`
> rows still reproduce exactly (`turn3` **4/7**, `after` **7/7**), which is what
> makes the other two readable as a real change rather than a re-run:
>
> | arm | table above **used to say** | measured 2026-08-01 |
> |---|---|---|
> | `--label=turn3` (new gates) | **7/9** — two FAILs | **8/9** — one FAIL, registration |
> | `--label=after` (new gates) | **6/9** | **7/9** |
> | `--label=turn3 --gates=prior` | 4/7 | **4/7** — unchanged |
> | `--label=after --gates=prior` | 7/7 | **7/7** — unchanged |
>
> Both new-gate columns gained the same row: **the value wash**, which §11.7.2
> ruled a rake rather than a defect and re-stated against the brighter end. On
> `turn3` the moment and sliver rows also came back, because §11.8's item 3 —
> the parked window taken from the DWELL — was fixed. **The diagonal §11.1.5
> reads off this table still holds**: the old beat and the old gates agree, the
> new beat and the new gates agree, and each rejects the other's beat.
>
> ⚠ **AND THE ONE REMAINING `turn3` FAIL IS NOT THE ONE §11.4.1 NAMED.** Its
> registration row now reads *"cx every frame; the contact and the common mode
> where there is a silhouette"* — the row was re-cut after §11.7.3 found the
> squash moving the bbox midpoint by design. `turn3` is a 2026-07-31 13:50
> capture of a beat that has since been retimed twice; it is kept as the
> historical arm, not as a reading of what ships. **The current capture is
> `k7final`** (2026-08-01 00:33) and it reads **8/9** with the same single FAIL —
> see §11.9.6.

### 11.1 What is built

#### 11.1.1 K3′ — the turn. **BUILT.**

`lib/hero-motion.ts` `emerge.mode: "turn"` is the default, ported from
`docs/reference-original/compose.ORIGINAL-FLIP.mjs` (commit `f9010da`), with
`turnShade: 0.35`, `edgeFloor: 0.035`, `dwellSec: 2/30`. `assert-hero-turn.mjs`
judges the motion model directly off the sampler — no browser, no capture — and
re-runs every assertion against the parked ramp, which must fail. Run just now:

```
PASS  the turn's breakdown is a WIND-UP, not a midpoint
      half-width passing position at 87.2% of the turn-out
PASS  the moment is HELD — two frames, not one
PASS  the dwell frames are FROZEN
PASS  the sliver is never a blank frame          edge-on width 14 px at the original's scale
PASS  the sliver is REAL THICKNESS               depth 1.0000 at edge-on
PASS  the mark turns exactly to edge-on          max yaw 90.0 deg
PASS  the state change is hidden AT the edge     ink flips at frame 13, edge-on at frame 13
PASS  the width law is the original's, exactly   max |delta| 3.22e-15
8/8 … 8/8 correctly FAIL on the control.  SOUND
```

**87.2 %** is B1's number reached a fourth way. B1 solved it at 86.9 %; §10.2 C5
measured 89.7 % / 85.6 % off the extent series; the shipped sampler produces
87.2 %. All four sit inside the reference set's 79–93 % wind-up band.

**The dwell is real in pixels, and it is exactly the authored length.** The dense
emerge capture samples 72 positions over 0.939 s — 75.6 Hz, 2.5× the timeline's
own 30 fps. Six consecutive samples read an identical silhouette:

```
f33   w  58  cx 550.5   ink  7550
f34   w  24  cx 559.5   ink  3928   <- the sliver
f35   w  24  cx 559.5   ink  3928
f36   w  24  cx 559.5   ink  3928
f37   w  24  cx 559.5   ink  3928
f38   w  24  cx 559.5   ink  3928
f39   w  24  cx 559.5   ink  3928
f40   w 153  cx 535.0   ink 15159
```

Six samples span five intervals = **66.1 ms**, and the authored `dwellSec` is
`2/30` = **66.7 ms**. So the gate's "held 6 fr" is the board's two frames at 30 fps,
oversampled — nobody should "fix" the 6. The floor is **24 px = 3.7 % of the
648 px settled word**, against the original's 14 px = 3.4 %: the same fraction,
at this capture's scale.

#### 11.1.2 The rise. **BUILT, rebalanced ease-out dominant.**

`riseCurve: "riseOut"` is the default; `riseGatherFrac: 0.14`,
`riseGatherDepth: 0.1`. `assert-hero-rise.mjs`, run just now:

```
PASS  the velocity peak is EARLY      peak at 16.7% of the rise, frame 7 of 42 (needs <= 35%)
PASS  the decay is 3-4x the acceleration   rise 7 fr, decay 35 fr, ratio 5.00x
PASS  the acceleration is SHORT       7 frames to the velocity peak
PASS  the gather survives             dips to -10.0% before committing
PASS  the overshoot survives          overshoots to +10.0%
PASS  and it ARRIVES                  settles at 100.00%
6/6 … all 3 SPACING claims correctly FAIL on the symmetric control.
```

This is §10.5 call 3's recommendation taken: **1.4 s kept, spacing fixed.**
`beats.standup` is still `1.4`. B4's overshoot and `backC1` are untouched — the
control confirms it, because the gather and overshoot rows **pass on both arms**.
Stated plainly: **3 of that instrument's 6 rows cannot tell the two curves
apart.** Only the three spacing rows separate them, and those are the three the
change was for.

#### 11.1.3 The phase order and the breath. **BUILT.**

`HERO_PHASES` (`hero-motion.ts:65`) now reads
`draw · breath · anticipation · emerge · tilt · standup · orbit · hold`.
**`anticipation` precedes `emerge`.** §7's exposure sheet always put K2 before
K3; the code did not, and now does. §10.3 flagged this as the one fix the stall
work made *harder* (a fixed const array plus `sampleHeroMotion`'s if-chain, not a
drag in the panel) — it was made anyway.

`breath: 1.1` (was `0.5`). That is §10.2 C3 taken literally: 33 frames at 30 fps,
and the doc comment on the field now carries the corrected rule instead of the
falsified one. It is the beat's longest *authored* hold, and it sits immediately
before the moment. Measured in pixels: **12 consecutive scrub samples at
w 648 / h 158 / cx 559.5 / ink 28371, identical to the digit.**

#### 11.1.4 The camera parks after the rise. **BUILT — and this is the biggest single change to the film.**

`cameraPark: "parked"` is the default. Under it the `standup` branch lands
directly on `holdAz`/`holdEl`/`fillHold` and the `orbit` branch resolves
`e = 1`, so az/el/fill are constants for the whole orbit
(`hero-motion.ts:862-864`, `:885-888`). `driftEase` survives only on
`cameraPark: "prior"`.

I measured it rather than reading it. Every scrub frame tagged `orbit` or `hold`:

```
ORBIT+HOLD  t 7.14..11.18 = 4.04s over 44 scrub frames
  net across the WHOLE span:  centre 0.00 px   w 0 px   h 0 px   ink 0.00%
  largest per-frame centre step inside it: 0.00 px
  distinct widths: 683      distinct cx: 644      ink 42387 on all 44
```

**4.04 seconds of a frozen frame.** §3 K6's "cx creeps 527 → 536, 2 px per second
for 45 % of the runtime" and §10.2 C1's "what never arrives is the size" are both
closed, and closed the way C1 prescribed — *do not travel*, not *decelerate
harder*. For scale, §10.2 C3 notes the reference set's two biggest accents are
preceded by 4292 ms and 2586 ms of frozen frame; this hold is 4040 ms, on the far
side.

The shipped stillness gate agrees on its own narrower window: `net centre 0.00 px
/ net w 0 / net h 0 / net ink 0.00%` over the last 1.33 s — against `1.12 px /
0 / 1 / 0.44%` **FAIL** on the pre-turn capture, which is the negative control
that proves the row can fail.

#### 11.1.5 The gates. **ONE implementation, and all three §10.4 amendments landed.**

`scripts/verify/lib/hero-moment.mjs` holds the corrected criteria once. Both
consumers import it — `scripts/verify/assert-hero-transition.mjs:72` (the shipped
gate, judging the real capture) and `docs/storyboard/tools/assert-moment.mjs:46`
(judging both films plus four synthetic controls). Verified by grep: those are
the only two importers in the repo.

That sharing is load-bearing, and the file says why in its own header: *"a ported
copy of a criterion is a criterion nobody tested — the storyboard tool's four
negative controls only prove the SHIPPED gate is sound if the shipped gate runs
this exact code."*

All three amendments are in it:

1. **Split registration axes** — `maxCxJump < 2` on every frame; `maxCyJump < 2`
   only on frames at ≥ 20 % of settled (`LEGIBLE_MIN = 0.2`).
2. **A sliver is not a blank** — the moment needs `minInk > 0`, `minW ≥ 2`, and a
   recovery to ≥ 90 % of settled (`RECOVER_MIN = 0.9`).
3. **Stillness is net, across all of extent** — `stillnessGate` reads net centre,
   width, height and ink over the window; §8's per-frame proposal is parked
   beside it as `priorStillnessGate`, still runnable.

`assert-moment.mjs` run just now: **SOUND, exit 0**, agreeing with all seven
wanted verdicts including the two rows §10.4 found broken.

**`--gates=prior` reproduces the old verdict — with one correction to how the
brief for this pass stated it.** The flag belongs to
`assert-hero-transition.mjs`, not to `assert-moment.mjs` (passing it to the
latter changes nothing; its output is byte-identical either way). And it
reproduces **7/7 only on the pre-turn capture**:

| | new gates | prior gates |
|---|---|---|
| `--label=after` (pre-turn) | **6/9** | **7/7** |
| `--label=turn3` (the turn) | **7/9** | **4/7** |

> 🔨 **⚠ THE NEW-GATE COLUMN IS NOW 7/9 AND 8/9 — 2026-08-01, all four arms
> re-run.** The table **used to read** `after` **6/9** and `turn3` **7/9**; both
> gained the value-wash row when §11.7.2 re-stated it against the brighter end,
> and `turn3` also got its moment and sliver rows back when §11.8 item 3's
> dwell-sized window was fixed. **The `prior` column is byte-for-byte the same**,
> which is what makes the movement attributable to the gate rewrite rather than
> to a re-run. The diagonal below is unchanged and still the point. Full table
> and the one remaining `turn3` FAIL: the ⚠ note under §11.0.

Read the diagonal. On the old beat the old gates are perfect and the new gates
fail three rows — no moment, no sliver, no stillness. On the new beat that
inverts. **This is §1.5's prediction confirmed on our own film rather than on the
original's:** the prior gates reject the shipped turn at `max width step
140.00 px` (ceiling 6) and `largest single-frame step 13.0` (ceiling 10.8). The
machine-enforced prohibition on having a moment was real, and the beat now
violates it on purpose.

#### 11.1.6 The capture. **REAL, and it is the substrate for everything above.**

`docs/verification/hero-transition/turn3/` — 120 scrub frames over 11.177 s, a
72-frame dense emerge window, `play.webm`, `scrub.mp4`, `emerge.mp4`,
**0 console errors**. Captured through real Chrome with `--use-angle=metal`, on
the page's own transport, at 1440×1440.

`turn2` and `turn3` are two runs of the same build. Their measured series agree
on `w` and `cx` for **70 of 72 emerge samples**; the two that differ do so by
half a pixel of `cx` and one pixel of `w`, and raw ink counts differ at ~0.05 %.
**Both produce the identical gate verdict, `max cx step 24.50 px`.** (`turn`, the
first of the three, is not comparable — its settled word is 268 px against
turn2/turn3's 648, so it was shot at a different stage scale.)

### 11.2 The beat as shipped, against §7's exposure sheet

> 🔨 **⚠ THIS TABLE IS A SNAPSHOT OF 2026-07-31 MORNING AND THE BEAT MOVED UNDER
> IT THE SAME DAY. Left standing, unedited, on §10's own precedent — read §10.3's
> re-cut ledger for the live numbers.** What it says below and what is now false:
> **11.177 s / 335 frames** → **9.833 s / 295 frames**; **eight phases** →
> **twelve** (`land`, `solid`, `descend`, `returnTurn` all landed); `orbit`
> **3.20 s / 96 fr** → **0.933 s / 28 fr**; `tilt` **0.70 s / 21 fr** →
> **0.433 s / 13 fr**; and the two rows called out below as *"still unbuilt"* —
> **K4 and K7 — are both BUILT** (`assert-hero-hold.mjs` 8/8,
> `assert-hero-return.mjs` 13/13; §11.7.4). §7's four turns are four again, not
> two. The one row still wrong in BOTH tables is `draw`, and §10.3's re-cut is
> where it moves.

> 🔨 **⚠ AND THE CORRECTION ABOVE IS ITSELF SUPERSEDED — `draw` MOVED, WHICH
> MOVES EVERYTHING. 2026-08-01, measured off the model, not added up by hand.**
> The ⚠ block above **used to say** the live beat was **9.833 s / 295 frames**.
> It is now **12.3667 s / 371 frames**, and the whole difference is the row that
> block itself flagged as *"still wrong in BOTH tables"*: `beats.draw` went
> **64 → 140 frames** when the ledger was re-cut and the trim was given back.
> §10.3 records its own objection to that trim at the time — *"the draw-in trim
> is the one line in that table I would not defend hard. Handwriting is the
> product's other claim"* — and it is that objection being actioned, against
> Sebs's *"the fucking drawing is fast and janky."*
>
> **Verified first-hand** — `node scripts/verify/assert-hero-ledger.mjs`:
> `totalDuration` **12.366666…s**, `× 30 = 371` frames exactly, `beats.draw`
> **4.666666…s**. Twelve phases, `HERO_PHASES` in emission order:
> `draw · breath · anticipation · emerge · land · solid · tilt · standup ·
> orbit · descend · returnTurn · hold`. The live table is directly below the
> 2026-07-31 one; **neither is deleted**, and reading them side by side is how
> the two re-cuts stay visible.

§7 authors 267 frames / 8.90 s. The shipped `DEFAULT_HERO_MOTION.beats` sum to
**11.177 s / 335 frames at 30 fps**, and `manifest.json` confirms
`total 11.1767`. The ⚠ correction is in §7 itself; this is the table it points to.

| phase | shipped | frames @30 | §7's row | what changed |
|---|---|---|---|---|
| `draw` | 2.60 s | 78 | 76 fr / 2.50 s | ≈ unchanged; §10.3's −12 trim not taken |
| `breath` | **1.10 s** | **33** | 14 fr / 0.47 s | **C3 taken in full** — now the longest authored hold |
| `anticipation` | 0.36 s | 11 | 9 fr / 0.30 s | **order fixed** — now before `emerge`. But see §11.4.3 |
| `emerge` | **0.9167 s** | **27.5** | 12 fr / 0.40 s | **C5 taken** — `0.85` turn + `2/30` dwell, 13 fr per half-turn |
| `tilt` | 0.70 s | 21 | — | no §7 row; sits where §7 puts "land + settle" and "K4 held" |
| `standup` | 1.40 s | 42 | 42 fr / 1.40 s | duration held, **curve rebalanced** |
| `orbit` | **3.20 s** | **96** | 36 fr, `driftEase` | **parked** — 0.00 px of travel |
| `hold` | 0.90 s | 27 | 30 fr, K7 flat | parked, but at the ¾, **not** flat — K7 is not built |

**Held, measured rather than budgeted:** `breath` 1.1 s + `orbit` 3.2 s +
`hold` 0.9 s = **5.20 s = 46.5 %** of the 11.177 s runtime, every frame of it
proven pixel-static above. Add `anticipation`, which currently renders as a hold
because its squash never reaches the screen (§11.4.3), and it is **49.7 %**.
Either figure clears §10.2 C8's 36 % bar, and §10.3's ledger predicted ≈ 43 %.

**Two of §7's rows are still unbuilt and neither is a duration problem.** K4 —
the parked, held, dead-on solid at K1's framing — does not exist: `tilt` begins
on the frame after `emerge` ends and takes the camera to el 65° over 0.7 s. And
K7 does not exist: the beat ends on a held ¾, not on a return. §7's four turns
are therefore **two**, not four.

#### 11.2a The same table, LIVE — 2026-08-01

*The table above is kept exactly as written. This one is the beat as the model
samples it today, read out of `DEFAULT_HERO_MOTION.beats` rather than typed:
`node scripts/verify/assert-hero-ledger.mjs` **4/4**, and **4/4 correctly FAIL**
on the whole prior beat, `SOUND`.*

| phase | shipped | frames @30 | 2026-07-31 morning | what changed since |
|---|---|---|---|---|
| `draw` | **4.6667 s** | **140** | 2.60 s / 78 | **the trim given back** — the beat's largest single change, and the reason the runtime grew rather than shrank |
| `breath` | 1.10 s | 33 | 1.10 s / 33 | unchanged; still the longest *authored* hold |
| `anticipation` | 0.30 s | 9 | 0.36 s / 11 | shorter, and it now **releases INTO the turn** rather than snapping — §11.9.1 |
| `emerge` | 0.9167 s | 27.5 | 0.9167 s / 27.5 | unchanged |
| `land` | 0.30 s | 9 | — | new; the turn's arrival, separated from the hold it pays for |
| `solid` | 0.60 s | 18 | — | new; **K4**, and it is C7's *"do not spend it"* taken literally |
| `tilt` | **0.4333 s** | **13** | 0.70 s / 21 | shorter **and** re-shaped — it hands the camera over instead of stopping in front of the rise (§11.7.8) |
| `standup` | 1.40 s | 42 | 1.40 s / 42 | duration held; curve rebalanced (§11.1.2) |
| `orbit` | **0.9333 s** | **28** | 3.20 s / 96 | the ¾ hold is a hold, not a parking lot — the seconds moved into `draw` and the return |
| `descend` | 0.4333 s | 13 | — | new; the only camera move the exposure sheet has no row for |
| `returnTurn` | 0.9167 s | 27.5 | — | new; **K7**, the second moment, same law as the first |
| `hold` | **0.3667 s** | **11** | 0.90 s / 27 | now flat, at K1's framing, and **changed** — the round trip closes |

**Held, measured rather than budgeted, and the statistic changed with it.**
§11.2's *46.5 %* counted three phases' durations. The ledger assert counts
**frames that do not differ from the frame before them**, which is the honest
version of the same question and a stricter one:

```
90 frames in shots that genuinely stop (24.3%)
  breath 33fr still · solid 18fr still · orbit 28fr still · hold 11fr still
+ 44 frames elsewhere identical to the frame before them
= 134 of 371 = 36.1%
```

⚠ **AND THE MARGIN IS UNDER ONE FRAME.** C8's bar is **36 %**, so 371 frames
need **133.56**. We have **134**. Drop one repeat frame and the beat reads
**35.85 % and the row goes red** — the same instrument that passes it. §10.3
predicted ≈ 43 % and the re-cut spent the difference on the draw-in, knowingly.
**That is not slack, it is a tripwire**: any future trim to a held shot, or any
lengthening of a moving one, fails this row on the next run. It is recorded here
so the next reader does not read 36.1 % as comfortable.

The negative control is what makes the number mean anything: the whole prior
beat — its durations, the ramp instead of the turn, the drift instead of the
hold, no landing, no return, ones instead of twos — reads **46 of 306 = 15.0 %**
and fails all four rows.

### 11.3 Three instrument bugs, found by RUNNING the board's own tooling

> 🔨 **⚠ THREE WAS THE COUNT ON 2026-07-31 MORNING. IT IS NOW EIGHT.** The
> heading above **used to be** the complete tally; the five found since are the
> vacuous yaw claim, the overshoot window reading a flat 10.0° on both arms,
> `hold.png` landing on the flat return, the blind area-symmetric reversal
> control, and gate 2 sampling a phase that is flat by design. **All eight are
> recorded together in §11.8**, because the pattern only reads at eight. The
> three below are left exactly as written — they are §11.8's items 1–3.

> 🔨 **⚠ AND EIGHT WAS THE COUNT ON 2026-07-31 EVENING. IT IS NOW ELEVEN**
> (2026-08-01). The three found since are a **class**, not three unrelated bugs:
> `assert-taper-envelope.mjs`, `assert-joint-beading.mjs` and
> `assert-layer-flicker.mjs` are all named `assert-` and none of them could
> report a failure on its default invocation. They are §11.8's items **9–11**,
> and the class now has its own standing gate — see the ⚠ block under §11.8's
> heading. **The repo's own count, in `assert-gate-integrity.mjs`'s header, is
> eleven**; a briefing that reached this lane said twelve and I could not find a
> twelfth, so eleven is what is recorded.

These belong in the board because §10.4's whole lesson is that a gate must be
**run**, not read. Each was invisible to inspection and each produced a
confident, wrong output.

**1 · The capture's emerge window was derived by phase NAME, and the phase
reorder made it run BACKWARDS.** It looked up the phase named `anticipation` and
used its start as the window's end — silently assuming the tense comes *after*
the beat. §11.1.3 moved the tense *before* it, so the lookup returned an earlier
frame: `emerge window 4.04s..3.76s`, **72 frames sampled over a negative span,
every file correctly named**. The window is now derived by *position* — the first
phase after `emerge`, whatever it is called — and the capture **throws** rather
than writing a backwards window: *"Refusing to capture — a backwards window
writes correctly-named frames of the wrong thing"*
(`verify-hero-transition.mjs:173-194`).

This is the exact failure class this repo keeps paying for. The output was 72
plausible PNGs with correct names. Nothing about the artefact says it is wrong.

**2 · A "blank frame" at the moment was CLIPPING, not the beat.** The page
reserves height for the DialKit dock, so with the dock expanded the 3D stage came
out **1120×350 instead of 1120×702** — and *"a squeezed stage can CLIP the
turning mark, which reads as missing ink rather than as a framing problem"*
(`verify-hero-transition.mjs:84-96`). Every absolute pixel threshold in the gates
was simultaneously being read against a mark rendered at a third of the area.
Fixed by sizing the viewport 1440×1440 so the stage survives either dock state.

A capture must not be sensitive to what UI state the page was last left in, and
a missing-ink reading at the one frame the whole board turns on is the most
expensive possible place to be wrong.

**3 · The gate's parked window was a fixed `+0.55 s`, sized for the old 0.54 s
emerge — so `settled` was taken from the DWELL, and it reported "no moment" on a
beat whose moment is plainly in the frames.** The turn is 0.9167 s, so the
`+0.55 s` cut landed mid-recovery. `settled` is the **median of the last five
widths**, and the last five widths inside that truncated window are the sliver:

```
window cut at +0.55s  ->  samples 0..41
last five widths       ->  f37 24, f38 24, f39 24, f40 153, f41 219
median                 ->  24        <- "settled" = the sliver itself
```

Reproduced first-hand from the checked-in emerge series. Every threshold derived
from `settled` — the 5 % moment band, the 90 % recovery — was then being measured
against the very frames it existed to judge. The window is now the whole emerge
phase, derived from the capture's own data, *"so a retimed beat cannot desync
it"* (`assert-hero-transition.mjs:327-343`).

**What the three have in common:** none of them makes anything look broken. Two
produced clean-looking artefacts and one produced a clean-looking green-adjacent
verdict. They were found by running the tool against a beat that had changed
underneath it.

### 11.4 What is OPEN

> 🔨 **⚠ NOTHING IN §11.4 IS OPEN ANY MORE — 2026-07-31 evening. All five
> subsections are CLOSED and one of them was never a defect.** The section is
> left standing whole, unedited, on §10's own precedent; each subsection carries
> a one-line pointer and the evidence is in **§11.7**, run first-hand. In
> summary, and each is a link into §11.7:
>
> | | what §11.4 says | what is true now |
> |---|---|---|
> | 11.4.1 | registration fails, `max cx step 24.50 px` | **CLOSED** — 1.00 px on an orthographic stage; the excursion was the PROJECTION, proven two ways (§11.7.1) |
> | 11.4.2 | a second gate fails: the value wash | **NOT A DEFECT** — it is a rake, and two measurement faults were fixed (§11.7.2) |
> | 11.4.3 | K2's squash is a number in a panel | **CLOSED** — it renders, −4.57 % against a dialled −4.50 % (§11.7.3) |
> | 11.4.4 | K4 and K7 are not built | **CLOSED** — both built; `assert-hero-hold` 8/8, `assert-hero-return` 13/13 (§11.7.4) |
> | 11.4.5 | `motion.mjs` still carries the falsified rationale | **CLOSED** — regenerated; the falsified lines survive as struck history (§11.7.5) |
>
> A sixth thing closed that §11.4 never had a row for: **the contact-shadow
> channel** (§11.7.6). And the biggest correction of the lot is not in this
> table at all, because §11.4 did not know to look for it: **the draw-in**
> (§11.7.7).

#### 11.4.1 Registration fails. `max cx step 24.50 px`, needs < 2.

> ✅ **CLOSED. See §11.7.1.** The excursion is the PERSPECTIVE PROJECTION, and
> the section below is right about the mechanism and right to stop where it does
> — *"another lane owns this and is working it now"*. That lane landed.

The one gate that must hold — §1.5's *hold the centre, break the extent* — does
not. Run just now on `turn3`:

```
FAIL  REGISTRATION holds — cx on every frame, cy where there is a silhouette
      max cx step 24.50 px (needs < 2), max cy step on frames >= 20% of settled 1.00 px, across 72 parked frames
```

`cy` is fine. **`cx` is the whole failure**, and it is not a single jump — it is a
smooth excursion with one discontinuity in it. Measured from the emerge series:

```
f0    w 648   cx 559.5     at rest
f18   w 636   cx 536.5
f27   w 481   cx 502.0     <- the excursion's far point
f33   w  58   cx 550.5
f34   w  24   cx 559.5     <- the sliver, back ON the axis
f39   w  24   cx 559.5
f40   w 153   cx 535.0     <- the 24.50 px step, first frame out of the dwell
f45   w 458   cx 502.5     <- and out again, on the other face
f71   w 648   cx 559.5     at rest
```

**A claim in circulation about this failure does not survive measurement.** The
version being passed around is *"the sliver lands at cx 559.5 = the optical axis
while the word's ink centre at rest is 502"* — i.e. an off-axis mark whose rest
position and sliver position disagree. **That is not what the frames show.**
Measured: the canvas is 1120 px wide, so the optical axis is **559.5** — and at
rest the mark's **bbox centre is also 559.5**, with its **ink centroid at 555.2**,
4.3 px off. The mark is not off-axis; at rest it is centred on the axis to within
a few pixels, and rest and sliver **agree**. **502 is not a rest quantity at all**
— it is where the bbox centre swings to mid-turn, twice, once on each face.

Which changes the shape of the problem rather than the diagnosis, because the
**mechanism** that framing points at is right and the numbers support it — it
just does not need the mark to be off-axis. At f0 the bbox is symmetric
about the axis (`x0 236`, `x1 883`, 323.5 px each side); by f27 the left half has
lost 8 % and the right half 44 % (`x0 262`, `x1 742`). That is perspective. Under
a perspective camera the half of a yawing form that rotates *toward* the lens
projects larger than the half rotating *away* — for a point at ±L about the
pivot, `f·L·cosθ/(D − L·sinθ)` against `f·L·cosθ/(D + L·sinθ)` — **so the
projected bbox centre moves even for a form that is perfectly centred, with no
off-axis error to correct.** The original avoided this entirely by being a 2D
compositor doing `scaleX` about one point, where `cx` is invariant by
construction. That is §7's second "number a rebuild must not lose" — *one centre*
— and it was never a tuning target, it was a property of the medium.

**A measured-pivot fix reportedly produced byte-identical numbers, falsifying the
wrong-pivot hypothesis. I can corroborate the outcome but not attribute it:**
`turn2` and `turn3` agree on `w` and `cx` for 70 of 72 samples and return the
identical verdict, `max cx step 24.50 px`. Consistent with a change that moved
nothing. **Another lane owns this and is working it now. It is OPEN, the
recommendation is theirs, and this section deliberately stops here.**

#### 11.4.2 A SECOND gate fails, and it is one §8 explicitly protects: the value wash.

> ✅ **RULED — and the ruling is that it was never a defect. See §11.7.2.** The
> section below asks for exactly that: *"it should not be left red without a
> ruling"*, and it names both candidate answers correctly. The answer is the
> second one — the gate was reading a legitimately raked lit face against a
> reference that moved.

```
FAIL  ink never washes past the settled value
      peak mean 37.2 vs settled 23.4 (needs <= +4)
```

Gate 4a is in §8's **"keep unchanged — these are craft and they are right"**
list — the brand law that *tonal range comes from light and mark density, never
from washing the ink out*. It **passed on the pre-turn capture** (`peak 43.8 vs
settled 43.8`) and **fails on the turn**. That is a regression the turn work
introduced, and it is red today.

What I measured, and I am reporting the shape without asserting a cause:

- The peak sits on **f40 — the first frame out of the dwell**, the instant the
  new face is revealed at its steepest rake (`w 153`, mean 37.2).
- From there it decays **monotonically** across the turn-in: 37.2 → 34.5 → 32.6
  → 29.8 → … → 23.4. There is no midpoint excursion and no return, which is not
  the shape of the cross-dissolve the gate was written to catch.
- Both terms moved between captures, so this is **not** a like-for-like
  comparison: `settled` went 43.8 → 23.4, and the two captures were shot at
  different stage sizes (the `after` capture's mark is 19 654 ink px, the turn's
  28 371) after the clipping fix in §11.3.2.
- The settled head-on solid now measures **darker** than the held ¾ (23.4 against
  29.5), where before it measured brighter (43.8 against 29.7).

**So the honest statement is: the row is red, it was green, and I do not know
from this measurement whether the beat now violates the brand law or the gate is
reading a legitimately raked lit face against a reference that moved.** Both are
answerable and neither is answered. Given the gate is the one §8 explicitly
protects, it should not be left red without a ruling.

#### 11.4.3 K2 — the tense — is a number in a panel. It does not render.

> ✅ **CLOSED — IT RENDERS. See §11.7.3.** The diagnosis below is exactly right
> and its last line is the one that got acted on: *"The pose was never wrong — it
> was never drawn."* It is drawn now.

`HERO_PHASES` puts `anticipation` before `emerge` (§11.1.3), so §4's *"the single
most broken adjacency"* is **half** closed: the order is right. The shot is still
not on screen, for a new reason.

Measured. Four scrub samples are tagged `anticipation`, and every one of them is
identical **to the digit** with the twelve `breath` samples before it:

```
f39  t 3.66  breath        w 648  h 158  cx 559.5  cy 444.5  ink 28371
f40  t 3.76  anticipation  w 648  h 158  cx 559.5  cy 444.5  ink 28371
f41  t 3.85  anticipation  w 648  h 158  cx 559.5  cy 444.5  ink 28371
f42  t 3.94  anticipation  w 648  h 158  cx 559.5  cy 444.5  ink 28371
f43  t 4.04  anticipation  w 648  h 158  cx 559.5  cy 444.5  ink 28371
```

`scaleY 0.955` on `h 158` should read ≈ 151; `scaleX 1.018` on `w 648` should read
≈ 660. Neither moves, and the ink count does not change by one pixel.

The cause, verified by grep across `lib/ components/ app/ scripts/`:
**`squashX` and `squashY` have no render consumer.** `sampleHeroMotion` computes
them, and the only place in the repo that reads them is
`app/desk-doodles/page.tsx:1295`, which **prints them as text in the dial panel**.
The sample reaches the render through exactly three channels — the material memo
(`page.tsx:689-695`: `ink`, `depth`, `yaw`, `shade`), `__revealHarness.setProgress`
(`:706`) and `__captureHarness.orbitView` (`:707`) — and squash is in none of them.

**This is the same class as §10.2 C2's dead `pushScaleEnd` dial, found the same
way, and there are now two of them.** C2 ran the grep on `pushScaleEnd`; nobody
ran it on squash. §2's own admission test disposes of the shot as it stands: K2
is not a frame you could freeze and print, because it is the same frame as K1.

The board's own diagnosis of K2 therefore needs restating. §3 K2 says the defect
is *"wrong place, wrong pose"*. The place is fixed. The pose was never wrong — it
was never drawn.

#### 11.4.4 K4 and K7 are not built, and K7 blocks call 1.

> ✅ **CLOSED — BOTH ARE BUILT. See §11.7.4.** C7's *"K4's 18 frames is the
> payoff of the absence. Do not spend it"* was taken literally: `solid` is 18
> frames. And K7 exists, so **call 1 can now be taken, not only decided.**

K4 — the parked, held, dead-on solid at K1's framing, §7's 18 frames — does not
exist. `tilt` starts on the frame after `emerge` ends and takes the camera to
el 65° over 0.7 s, so §3 K4's *"exists for 0.33 s, is never held"* is unchanged
except that the number is now 0.00 s. §10.2 C7's warning applies directly: *"K4's
18 frames is the payoff of the absence. Do not spend it."* It is currently spent.

K7 does not exist. The beat ends on the held ¾. The round trip is not closed, and
call 1 cannot be *taken* — only decided — until it is.

#### 11.4.5 `motion.mjs` still carries the falsified rationale.

> ✅ **CLOSED. See §11.7.5.** The file was regenerated, and — better than call 4
> asked — the falsified lines are kept as an explicit ✗ list of what it used to
> say, so the rationale cannot quietly come back.

> 🔨 **⚠ STILL CLOSED, AND A BRIEFING THAT REACHED THIS LANE SAID OTHERWISE —
> so the check is recorded rather than the claim repeated (2026-08-01).** The
> claim handed over was *"`motion.mjs` still carries the falsified rationale."*
> **It does not, and it has not since §11.7.5.** Opened first-hand: the file's
> header carries both falsified lines as struck ✗ history with the measurement
> that killed each, `breath` reads **1.1**, and `PUSH_SCALE_END` is not exported
> at all. That is the one thing this subsection is about, and it was fixed.
>
> **What WAS wrong is a different defect, and it is now closed too — §11.9.7.**
> The CONSTANTS block had gone stale *again*: `draw: 2.1333` against a live
> **4.6667**, `tilt: 0.7` against **0.4333**, `DRAW_LINEAR_BLEND: 0.45` against
> **1** — and **five constants missing outright** (`RELEASE_LAW`,
> `RISE_OVERSHOOT`, `ANTICIPATION.releaseSec`, `TILT_LAW`, `DESCEND_LAW`,
> `MOVE_ACCEL_FRAC`), every one of them already emitted by
> `toMotionMjsSource()`. **The paste had simply not been made.** Worth naming as
> its own failure mode beside the falsified-rationale one: a rationale goes stale
> because nobody re-reads it; a *pasted constant* goes stale because the paste is
> a manual step with no gate on it, and the file looks perfectly current either
> way.

§10.5 call 4 item 4 asks for it to be *"regenerated or deleted in the same pass,
not left."* It was left. Verified just now: `scripts/capture/motion.mjs:28` still
reads `breath: 0.5, // beat of stillness before the move ("cuts land on motion")`,
`:117` still reads *"The transition being near-invisible is the point"*, and
`:146` still exports `PUSH_SCALE_END = 1.01`. The live model has moved to
`breath: 1.1` with the corrected rule in its doc comment; the film-side copy has
not. **A zero-consumer file that states the beat's design goal is exactly how a
falsified rationale survives another pass** — call 4's own words, and it is still
true.

### 11.5 Calls 1 and 2, re-run against `online-reference-mechanics.md` §9

§10.6 says these *"should be re-run against it when it lands."* **It has landed**
(2026-07-31, 60 KB, eleven clips, 30 transits). I read §9 in full. It does not
answer either call — it says so itself: *"Neither call is answered here… this
footage strengthens the hard constraint under call 1 and the approach-frames half
of call 2, gives the two-frame dwell no backing, and is silent on the parts that
are genuinely Sebs's taste."* **The calls stay open.** What follows is what
changed underneath them.

#### Call 1 — return to flat, or to a *changed* flat?

**The hard constraint is confirmed, and it is what the genre does.** §10.5's
constraint — *the change must be occlusion, never shading* — is the mechanism
`origami-logo-fold` uses, twice, and the doc separates occlusion from rotation
with a discriminator that had to pass a synthetic control first (§9.0 row 6:
a card *rotated* into 70 rows must read ROTATION, and does). Verdict OCCLUSION on
**7 of 7** frames of the open and **14 of 14** across open and close, against both
controls. The genre's answer to *how do you change a flat state without shading
it* is: **put an occluder over it and take the occluder away.**

**One-thing-at-a-time is confirmed structurally.** §10.5's sharper argument was
that K4 carries two arrivals. `origami-logo-fold` is built the way §10.5 wants
K4/K7 built: the fold-down ends at f216, the uncover starts at f217, **no overlap
by a frame** — and the same again on the second cycle (packet lands f622, uncover
starts f623).

**But the specific FORM §10.5 proposes has no precedent.** §9.1: every occlusion
in the set is a *separate occluder over a whole graphic* — flaps, a page, a pop-up
panel — and **"not one instance anywhere of a mark occluding itself at a
crossing."** So *"move the crossing resolution out of K4 and into K7"* keeps its
mechanism and loses its evidence.

**The footage is SILENT on identical-vs-changed as a designed choice**, and the
silence is honest rather than empty: the set's only true round trip is two
packets of **real paper, re-shot and re-lit** — the second sits further right than
a ±10 px shift search can reach and the whole plate is graded 13 luma brighter,
which is staging, not design.

**And it offers a third structure this board does not consider.** §9.1: an
**unchanged flat carrier that opens onto changed news** — the same white packet
with the same seam uncovers the "Place your Logo here" card in cycle 1 and the
**envato** brand card in cycle 2. If K7 wants to carry news *without* asserting
the mark came back different, that is where the set points, and neither §9 nor
§10.5 costs it.

**One thing the set explicitly cannot do:** arbitrate gate 1's `SD < 1` threshold.
The same green card measures 0.72 in one shot and 1.35 in another, and a *vector*
flat logo measures 2.74 — an 8-bit compressed plate has a noise floor our render
does not. What it *can* say is that flat-vs-dimensional is a 20–90× separation in
interior value (0.7–2.7 against 45–63), which is why shading a flat state would
read as un-flattening it. Mechanism, not number.

#### Call 2 — how true is "the true edge"?

**The largest finding is negative, and §10.5 could not have known it.** §9.2:
**there is no edge-on pass anywhere in these eleven clips.** *"Nothing in the set
presents a form edge-on, with its thickness the only thing on screen. Call 2's
exact geometry has no precedent in this footage."* The three rotating clips were
checked and one was a misread the measurement corrected — `stacked-extrude-pin`
*looks* edge-on on the sheet and is a stroke **drawing on** (ink 22 → 3 231 px
while the bbox grows in *both* axes).

**"Prove it on the approach, not at the sliver" is supported**, by the nearest
available analogue read as a fidelity ladder. At 4.7 % of its own extent the
picture sits **5.89×** further from the object than at 92.5 %; the curve is flat
from 26 % to 79 % and then falls off a cliff. **Our sliver is 3.4 % — below the
bottom rung of that ladder**, and §11.1.1 measures this build's at 3.7 %. The
20–80 px approach frames sit at 5–20 %, on the plateau. §9 states its own limit:
one object, one clip, wrong axis, a paper occluder rather than a turning solid.

**The two-frame dwell gets NO SUPPORT, and this is the sharpest thing §9 hands
us.** Across all 30 transits, **27 contain zero duplicate frames** — minimum
frame-to-frame difference inside the window runs 0.088–10.46 across those 27.
*Nothing stops.* The three exceptions are **cadence, not craft**:
`origami-crane-fold` shows 23 dupes in 48 frames because 57.2 % of that entire
film is duplicate pairs — it is animated on strict twos, and the maker says so in
his own description, quoted verbatim in §9.2. **This genre buys its accent with a
hold on the *far* side of the arrival (1.7–3.3 s) and never by stopping inside the
move.**

That does not make the dwell wrong. §9 is explicit that our own original flip
does it, that it is measured — and §7 of this board measures it too: f154 and
f155 byte-identical, f235 and f236 byte-identical. **It makes it OURS: an
unreferenced invention, which is a different thing from a mistake and should be
carried as such.**

**And §9 hands C6 a second, independent reason to exist.** §9.2: *"In a
12-fps-on-24 film every held instant is byte-identical by construction… running
the beat on twos through the dwell is the reference-backed way to guarantee the
two frames are identical rather than a two-frame shimmer — which is precisely the
failure the board is trying to prevent."* C6 argued the 12 Hz quantisation from
Exquisite Corpse's parity ratios. This argues it from the *dwell's* own
constraint. Same change, two unrelated justifications.

**One aside that bears on the whole proposal.** §9.2: `all4-idents` empties the
frame for two frames before each build and comes back with the object **already
dimensional** — *"the set never shows the flat, one-value state of the thing it is
about to make dimensional. It cuts away and comes back."* **Our beat proposes the
opposite: stay on the mark through the seam and make that the payload.** Nothing
in eleven clips does that, in either direction. That is not an argument against
K3′; it is the measure of how unreferenced it is, and it belongs beside the claim
that *the hiding place becomes the payload*.

#### Calls 3 and 4

Untouched by §9, as §10.6 said they would be. Call 3's recommendation is **built**
(§11.1.2). Call 4's recommendation is **taken** — the page moved first — except
for item 4, which is still open (§11.4.5).

### 11.6 What §11 does not do

- **No code was written.** Only this file. `lib/`, `components/`, `app/`,
  `scripts/` and `docs/research/` were read, never written — three other lanes are
  live in them.
- **No browser was launched.** Every pixel figure comes from checked-in captures
  under `docs/verification/hero-transition/`.
- **The registration failure is not diagnosed here** beyond corroborating the
  measurement and correcting the in-circulation account of it. Another lane
  owns it.
- **The value-wash regression (§11.4.2) is reported, not resolved.** I could not
  tell from the numbers whether it is a real brand-law violation or a gate reading
  a moved reference, and I did not guess.
- **§7's table is left standing** beside its correction, on §10's precedent, and
  the shipped durations are in §11.2 rather than pasted over it.
- **Not re-verified:** K1's silhouette complaint (§3 K1 — the tube-not-a-pen
  outline) is a shape judgement I did not re-measure, and `ink-evidence.png` /
  `key-shots.png` were not re-rendered against the new beat, so those sheets now
  show a film that no longer exists.

> 🔨 **Three of these six are no longer true, and saying so is the point of
> §11.7.** The registration failure IS diagnosed and fixed (§11.7.1); the
> value-wash regression IS resolved, as a non-defect (§11.7.2); and §11.2's
> shipped durations are themselves superseded. The other three still hold, and
> §11.7 adds its own version of the first two: **no code was written for §11.7
> either, and every browser figure in it comes from re-running the repo's own
> asserts, not from a capture written by this pass.**

---

### 11.7 What has CLOSED since §11.4 was written

*Added 2026-07-31 evening. §11.4 was written in the morning of the same day and
it is a list of five open defects. All five are closed, one of them by being
ruled a non-defect. Two more things closed that §11.4 had no row for. Nothing in
§11.4 is edited — each subsection carries a pointer and this is what it points
to.*

**What is first-hand here.** Every row below was produced by running the named
command on this machine on 2026-07-31, against the working tree as it stood.
Nothing is inherited from a brief. Where a handed number did not reproduce, the
number I measured is given instead and the discrepancy is stated.

| what | command | result |
|---|---|---|
| the frame ledger | `node scripts/verify/assert-hero-ledger.mjs` | **4/4**, 4/4 correctly FAIL on the prior beat, `SOUND` |
| registration, shipped arm | `node scripts/verify/assert-hero-transition.mjs --label=reg-affine` | **9/9** |
| registration, forced-perspective control | `… --label=reg-persp` | **8/9** — and the one failure is the registration gate, alone |
| the projection, both proofs | `node scripts/verify/_probe-hero-projection.mjs --persp=reg-persp --affine=reg-affine` | intervention 46.50 vs 1.00 px; prediction rms 3.31 vs null 30.10 px |
| the wash, prior statistic | `… --label=turn3 --gates=prior` | reproduces §11.4.2's FAIL verbatim: `peak mean 37.2 vs settled 23.4` |
| the wash, mutation control | `… --label=reg-affine --mutate=wash` | the row goes **RED** — the new gate can fail |
| the squash | `node scripts/verify/assert-hero-dead-channels.mjs` | **ALL PASS** |
| the flat state + shadow channel | `node scripts/verify/assert-hero-flatstate.mjs` | **all rows passed**, 0 console errors |
| K4 | `node scripts/verify/assert-hero-hold.mjs` | **8/8**, `SOUND` |
| K7 / the return | `node scripts/verify/assert-hero-return.mjs` | **13/13**, both controls behave, `SOUND` |
| the camera | `node scripts/verify/assert-hero-camera.mjs` | **9/9**, 8/8 correctly FAIL on the prior camera, `SOUND` |
| reduced motion | `node scripts/verify/assert-hero-reduced-motion.mjs` | **4/4** |
| the exposure | `node scripts/verify/assert-hero-twos.mjs` | **6/6**, `SOUND` |
| the pen clock | `node scripts/verify/measure-drawin-pacing.mjs` and `--clock=uniform` | 6/8, and the two failures are the finding |
| 2D/3D draw-in parity + both controls | `node scripts/verify/assert-drawin-2d-parity.mjs [--control=order|clock]` | ALL PASS; both controls correctly FAIL |

⚠ **The model moved under this measurement mid-pass.** `lib/hero-motion.ts` was
edited by a live lane at 20:45; readings taken before that point gave 43 repeat
frames / 45.1 % read stillness and readings after it give 44 / 45.4 %. Every
figure quoted here and in §10.3's re-cut is the **later** one. A number in this
section is true of a working tree at a timestamp, not of a released artefact.

> 🔨 **⚠ AND THAT SENTENCE PREDICTED ITS OWN EXPIRY CORRECTLY — read stillness
> is 36.1 %, not 45.4 % (2026-08-01).** The repeat-frame count is still **44**;
> what moved is the denominator. `beats.draw` went 64 → 140 frames, so the beat
> is 371 frames instead of 295 and the same 44 repeats plus 90 genuinely-stopped
> frames now read **134 of 371 = 36.1 %** against C8's 36 % bar. **The margin is
> under one frame** — see §11.2a. This is the third time a number in §11 has been
> true of a working tree at a timestamp; the note above is the right instinct and
> the arithmetic behind it is what needs re-running, not just the number.

#### 11.7.1 Registration — CLOSED, and §7's third number is restored

`max cx step` is **1.00 px** against a 2 px ceiling, across 67 parked frames, on
`reg-affine` — 9 of 9 gates green. 1.00 px is one quantisation step of a
half-pixel bbox centre, i.e. the instrument's own floor.

**It was the projection, and that is proven two ways, neither of which would be
enough alone.** An intervention without a model shows *that* the projection
matters but not that the mechanism is understood; a model fitted to the series
it predicts is a curve fit wearing a theory's clothes.

**1 · INTERVENTION.** Two captures of the same beat, same window, same frame
count, differing in exactly one flag:

```
                        max single-frame cx step      total cx excursion
  perspective                46.50 px                     46.50 px
  affine (shipped)            1.00 px                      1.00 px
```

And the control is specific, not blanket: on `reg-persp` the beat still passes
**8 of 9** gates. The one that fails is registration. A control that broke
everything would prove nothing about this gate.

**2 · PREDICTION, WITH NO CENTRE PARAMETER.** For a planar mark of half-width
`a` yawed by θ at camera distance `d`:

```
WIDTH   W(θ) = W₀ · cosθ / (1 − k² sin²θ),    k = a/d
CENTRE  Δcx  = (W(θ)/2) · k · sinθ
```

θ is read out of `lib/hero-motion.ts`'s own sampler at each captured frame's
timestamp. `W₀` and `k` are fitted to the measured **WIDTHS ONLY** (612.0 px and
k = 0.366, width rms 0.55 px). `cx₀` is read off the frames where the mark is not
turning. The entire cx series is then a **prediction**:

```
  predicted cx across 60 frames   rms 3.31 px   worst 5.61 px
  null model (cx never moves)     rms 30.10 px
```

Sign, both zeroes and the peak, all in place. The fitted `k` also agrees with the
scene independently: bounds radius 1.447 at `TOP_K` 2.5 gives d = 3.618 and
a ≈ 1.32–1.41, i.e. k ≈ 0.37–0.39. Stated limit, not smoothed over: within ~10°
of edge-on the silhouette is the form's own THICKNESS rather than its face, so
those six frames sit outside a face model's domain and are excluded from the fit
and reported separately.

**The fix is the projection, not a compensation.** `Viewport3DProps.projection`
defaults to `"affine"` — an **orthographic camera framed to show exactly the same
half-height at the pivot plane** — for any viewport driven by a `flatten` state,
which is what "the hero stage" means; the drawing lab, which passes no `flatten`,
stays on `"perspective"` and is untouched. Under a parallel projection `Δcx` is
identically zero for every θ, every framing and every word, because a scale about
the projected centre is what the projection IS. A per-frame counter-translation
would have cancelled this one measurement; the camera removes the term.

**So §7's second "number a rebuild must not lose" — one centre — is KEPT, and
§7's own explanation of why it could not be is now the explanation of how it
was.** §7 says registration was *"solved by construction"* and concludes *"the
property was never portable; only the number was."* The property is affineness.
It is portable; it just had to be bought from the camera rather than from a
compositor. §11 currently says it is lost, in §11.4.1 and in the ⚠ note under §7
— both now carry a pointer here.

**Two honest limits.** (a) It **changes the look**, and that is a taste call this
board does not get to make: parallel projection removes near/far convergence
from the whole stage — at the held ¾ the far end of the word no longer reads
smaller than the near end, and the ground grid stops converging. Axonometric
rather than photographic. Two things were measured alongside it and both are in
the shipped gates: the ¾'s tonal range is **not** reduced (sd 9.1 / spread 129.6
affine against 8.6 / 113.6 perspective — the form's dimensionality comes from the
light, not the projection), and the edge-on sliver measures **17 px against
perspective's 24 px**, where §3 K3′ predicts ~16 px at this stage width. The
affine sliver is the form's true thickness; the perspective one is that thickness
magnified by proximity. (b) The control **did not exist until 2026-07-31** — the
comment named a script that never drove it, and *a fix whose control cannot be
run is a fix nobody tested*. The capture now takes `--projection`, asserts the
arm it mounted by reading `isOrthographicCamera` off the live camera, and refuses
to write frames if it did not take.

#### 11.7.2 The value wash — NOT A DEFECT. It is a rake.

§11.4.2 asked for a ruling and named both candidates correctly. **The answer is
the second one**, and the two things that were wrong were both about how it was
measured, not about the beat.

**(a) The statistic was the MEAN, and a mean cannot tell a wash from a rake.**
Percentiles of the same eroded interior, first frame out of the dwell against the
settled solid, on `turn3` — the capture §11.4.2 was written from:

```
frame        p05    p25    med    p95
f40 (w 153)  12.6   20.6   27.8   87.0
settled      12.6   18.7   23.6   35.0
```

**The dark core does not move — 12.6 against 12.6, to the digit. What rises is
the lit end, 87.0 against 35.0.** That is a face caught at a raking angle
presenting more of its lit shoulder, which is the brand law working, not
breaking. **A cross-dissolve cannot do that**: fading a mark toward paper lifts
every pixel including the darkest, so it shows up in the core immediately. The
core is also the statistic **this board already uses** — §3 K3 measures *"only
the face's dark core (luma < 60) so the antialiased fringe cannot contaminate the
statistic."*

**(b) The reference was one endpoint.** *"No frame may be lighter than the
SETTLED form"* was written when the flat mark was the darker of the two ends
(turn3: flat 3.2, settled 23.4). It is not any more — on `reg-affine` the flat
mark reads 20.6 and the settled solid's core 13.6, so the rule as written asks
the beat never to be as light as the drawing it starts from. The defect the gate
exists to catch is a **midpoint excursion**: a frame lighter than **both** ends.
Comparing against the brighter end is the correctly stated version of the same
rule, not a loosening of it — a crossfade goes through paper and clears either
end by two hundred luma.

**What the row reads now, on the shipped arm:**

```
PASS  ink never washes past the settled value
      peak dark core 20.6 vs the brighter end 20.6 (flat 20.6 / settled 13.6, needs <= +4)
      [prior statistic, not the verdict] peak interior MEAN 26.0 vs settled 23.4
      — its lit end reads 60.6 against 34.0, i.e. rake
```

Equal to the digit on the core; the rake visible beside it. And **both halves of
the ruling are falsifiable rather than asserted**: `--gates=prior` on `turn3`
still reproduces §11.4.2's exact FAIL — `peak mean 37.2 vs settled 23.4` — so the
overturned row stays reproducible instead of remembered, and `--mutate=wash`
lifts a mid-window frame's core and drives the new row **RED** (`peak dark core
28.4 vs the brighter end 20.6`), so the gate can still fail.

#### 11.7.3 The squash — IT RENDERS

`squashX` / `squashY` reach the render. `assert-hero-dead-channels.mjs`, driving
the real page:

```
breath  w 716 h 175   ->   anticipation  w 730 (1.96 %)  h 167 (-4.57 %)
the dials say scaleY 0.955 (-4.50 %) and scaleX 1.018 (+1.80 %)
PASS  the anticipation SQUASH renders — the mark loses height — -4.57 %
PASS  the anticipation WIDEN renders — the mark gains width — 1.96 %
PASS  the squash is pinned at the CONTACT, not the centre — cy 501.0 -> 505.0
```

Predicted against measured on both axes, and a third row nobody asked for that
turns out to matter: the squash is **pinned at the contact**, so the mark's
baseline holds and it compresses downward like a thing on a surface rather than
scaling about its own middle. `assert-hero-flatstate.mjs` proves the same
channels can fail — at `squashY 0.85` the height drops 149 → 127 px, at
`squashX 1.15` the width goes 612 → 704, and its identity control (`squash 1` vs
no squash) reads equal, so the rows are measuring the squash and not the
override.

**That pinning then paid for itself somewhere else, and it is worth recording as
a lesson in what a gate is for.** Because the squash is a non-uniform scale
pinned at the contact, it moves the bbox's vertical midpoint **by design**, at
full extent, on exactly the frames the registration gate's `cy` clause trusts
most — measured on `reg-affine`, the wind-up's release steps `cy 424.0 -> 421.0`,
3.00 px, which the gate reported as a **failed registration on a beat whose
registration is exact**. The parked window now starts where the turn starts. The
narrowing is checked rather than asserted: `--mutate=cy` puts a 6 px vertical
displacement inside the turn and the row still has to go red.

#### 11.7.4 K4 and K7 — BOTH BUILT

**K4** is `solid`, **18 frames**, and it is C7's *"the payoff of the absence. Do
not spend it"* taken literally. `assert-hero-hold.mjs`: **8/8**, `SOUND`, with
two negative controls that each kill a different pair of rows — `shadowSec 0.9`
(the landing runs past its own beat) kills the beat-fit and the K4-held rows;
`ret.mode "prior"` kills only the junction row. The contact shadow lands **late,
on its own beat, ease-out dominant, on its own twos step** — one piece of news at
a time.

**K7** exists: `descend` → `returnTurn` → `hold`, and the round trip closes.
`assert-hero-return.mjs`: **13/13**, `SOUND`. The control matrix is per claim
rather than blanket, which is the honest shape — `ret.mode "prior"` (no return at
all) kills 12 of 13, and `ret.mode "identical"` (the return runs but the drawing
comes back unchanged) kills exactly **one**, *"the drawing comes back CHANGED —
and only at the edge"*, which is the only row it should touch. And the one claim
no arm of the model can falsify — *"K7 is HELD"*, true by construction — is
**mutation-tested instead of asserted**: the stillness predicate is fed a series
with one frame nudged 0.5° and required to say no. It does.

**So §7's four turns are four again, and its two moments are two.**
`assert-hero-ledger.mjs` reads `TWO moments, and exactly two — emerge and
returnTurn`, and `FOUR held shots, and every one of them actually STOPS —
breath 33fr still · solid 18fr still · orbit 28fr still · hold 11fr still`.

**And call 1 can now be TAKEN, not only decided.** §11.4.4's *"call 1 cannot be
taken — only decided — until it is"* was the blocker; it is gone. The shipped
answer is the **changed** flat: the return's own gate reads *"K1 fused on every
frame (true), K7 open on every frame (true), change at frame 13 of the return,
edge-on at 13 — hidden inside the moment"*, and a companion row asserts *"a
drawing casts NO contact shadow"* at exactly 0 across K7. The change is an
occlusion revealed at the edge, never a shading. **The pick between that and a
literal return is still Sebs's** — `ret.mode: "identical"` is parked and
reachable, and it is a real, shippable read of this beat rather than a straw man.

#### 11.7.5 `motion.mjs` — REGENERATED

`scripts/capture/motion.mjs` now carries `breath: 1.1` and the twelve-phase
`PHASES` array, and `PUSH_SCALE_END` is no longer exported. Better than call 4
asked for: the falsified lines are kept at the head of the file as an explicit ✗
list of **what it used to say** — `breath: 0.5, // beat of stillness before the
move ("cuts land on motion")` and `PUSH_SCALE_END = 1.01` — each with the
measurement that killed it. Call 4's own worry was that *"a zero-consumer file
that states the beat's design goal is exactly how a falsified rationale survives
another pass."* A file that records the rationale **as struck** cannot do that.

#### 11.7.6 The contact-shadow channel — CLOSED, and root-caused

§11.4 has no row for this because §11.4 did not know it was broken. The channel
measured **inert**: driving `shadow` 0 → 1 through `__captureHarness.setFlatten`
changed **0 of 943,040 pixels**, worst channel delta 0, at el 35 **and** el 55,
under **both** projections.

**The root cause is structural and it is a React one, not a graphics one.**
`setFlatOverride` notifies `flatOverrideSubs` and `AnimatedStrokes` subscribes —
but the second consumer is not inside `AnimatedStrokes`. **`StudioContactShadow`
is rendered in `Scene`, off `Scene`'s own `flatten` prop, and re-rendering a
child cannot change a parent's prop.** So the shadow channel never saw the
override at all. Note what the identical reading on the perspective arm bought:
it is what rules the registration work out as the cause.

It reads live now (`assert-hero-flatstate.mjs`, all rows pass):

```
PASS  shadow is its OWN channel — the pool answers to it, not to ink
      at el 35, ground tone under the mark 249.79 -> 244.73 (darker by 5.06)
PASS    ...and it OVERRIDES the derived `1 - ink` law
PASS    ...and DEAD-ON THE POOL IS INVISIBLE — reported, not asserted away
```

That third row is the good kind of honesty: a contact pool is a horizontal plane,
so at the beat's parked elevation it is edge-on and worth nothing until the
camera leaves el 0 — which the tilt does 0.26 s later. Production is untouched by
construction: `readFlatOverride()` returns null outside development and whenever
no probe has set anything, so `flatten` is the prop, byte for byte, on every
shipped render.

⚠ **One handed figure did not reproduce.** An "after" count of *135,509 pixels
changed* is not recorded anywhere on disk and this pass did not reproduce it; the
before-figure (**0 of 943,040**) is quoted verbatim in `components/viewport-3d.tsx`
and the channel's liveness is instead evidenced by the flat-state assert above,
which is a stronger artefact because it is re-runnable.

#### 11.7.7 The draw-in — the headline correction, and it is the answer to *"what was all this research we did"*

**The draw-in was never a lesser system standing in for the real one. It WAS
explainer 18's real reveal — fed synthesised timestamps.**

`lib/pen-reveal.ts` stamped the traced word at a flat **12 ms per point on a 4 px
arc-length grid**. The file's own statement of why that is wrong is the sharpest
sentence in this whole reconciliation:

> *"`docs/research/handwriting-variability.md` §2 […]: a lognormal's active
> duration `T = 2 e^mu sinh(3 sigma)` 'depends only on the WRITER's mu and sigma,
> not on the amplitude — which is the model saying that a bigger stroke is
> executed FASTER rather than for LONGER.' Twelve milliseconds per point on a
> 4 px arc-length grid says the exact opposite: every stroke at one speed,
> duration strictly proportional to length. The research is in this repo,
> implemented, with its provenance — and the hero word was handing the reveal a
> metronome."*

**Measured, and the number is unambiguous.** Pearson r between per-stroke arc
length and per-stroke duration, where **1.0000 is a machine**:

```
--clock=uniform  (the parked prior, 12 ms/point)   r = 0.9986
--clock=lognormal (shipped)                        r = 0.8412
```

**0.9986.** Not "close to a machine" — a machine, to four places.

**And the model that fixes it was already in the repo, already correct, and
wired shut.** `lib/pen-kinematics.ts` computes both halves of the answer and the
pipeline was throwing one away:

- **WITHIN a stroke** — `timeNorm`, documented as *"Reconstructed time,
  normalised 0..1 over the stroke, so a caller can re-time its own `t` channel
  without changing the stroke's total duration."* This half was already consumed.
- **BETWEEN strokes** — `stats.durationSec`, the span of that stroke's own action
  plan. This half was discarded, because `PenKinematicsSettings.retime` is
  documented to preserve *"the stroke's own first/last timestamps exactly — only
  the distribution WITHIN a stroke changes."*

**So the model was allowed to say when the pen was fast inside a stroke, and
forbidden to say that one stroke took longer than another.** That is what pinned
r at 1.0. The research had been done, implemented, documented with its
provenance — and then the one clause that would have let it speak was closed. It
is the direct answer to Sebs's *"what was all this research we did"*: the answer
is that it was all there, and a single preservation clause was holding it shut.

**What it buys, measured on the shipped word:**

```
timing character, the parked uniform clock   2.23 %
timing character, AS SHIPPED                 7.59 %      (threshold to render differently at all: 1.00 %)
per-stroke speed spread                      102.9 … 849.8 units/s  (×8.26)
AUTHENTIC vs SMOOTH, peak lead/lag           7.70 %  =  13.6 ink diameters
```

Thirteen ink diameters is not a statistic, it is a distance the eye can see.

> 🔨 **⚠ BOTH OF THOSE ROWS HAVE MOVED, AND ONE OF THEM HAS CLOSED —
> 2026-08-01, `node scripts/verify/measure-drawin-pacing.mjs` re-run.**
>
> **`velocity-bell` is 22 of 22.** The paragraph below **used to say** *"fails at
> 10 of 22"*, and its diagnosis — a resolution limit in the arc-length carry-over
> rather than a failure of the model — is what got acted on. It is now the
> instrument's own line: *"most scorable strokes carry a lognormal velocity peak
> rather than a flat sweep — 22/22"*, flattest scored stroke **#15 at peak/mean
> 1.459** against a 1.25 bar. The paragraph is left standing because the
> reasoning in it is the reason the fix was findable.
>
> **`human-speed` still fails, and it is still the finding — but the numbers
> below are stale in the direction that matters.** It **used to read** `30.6 ms
> at 7.88× compression`; it now reads **66.9 ms at 3.60× compression** against a
> 100 ms floor. That is not the instrument softening: `beats.draw` went
> **64 → 140 frames**, so the model's own 16.805 s of pen time is being squeezed
> into 4.667 s instead of 2.133 s, and the compression fell by exactly that
> ratio. **The row is more than half closed by the re-cut alone**, which is the
> clearest single piece of evidence that giving the draw-in trim back was a
> correction and not a preference. Left failing, per the paragraph below, so it
> cannot be forgotten at 66.9.

**Two rows are left FAILING deliberately, and both are the finding rather than a
defect in the instrument.** `human-speed` fails at `30.6 ms at 7.88×
compression` — that is §10.3's re-cut ledger's whole reason to exist.
`velocity-bell` fails at 10 of 22, and the cause is **located, not guessed**: the
strokes that come out flat are the ones whose RDP reduction leaves few anchors,
where `handFeelPass` carries `t` across by arc-length fraction and the final
`resampleStroke` then interpolates `t` **linearly** inside each anchor span —
with two spans there is nothing left of the lognormal but its endpoints. It is a
resolution limit of the carry-over, not a failure of the model, which computed
the same bell for every stroke. It is not fixed there because
`lib/stroke-processing.ts` is shared with the live drawing canvas, where `t` is
**real recorded input** and must not be re-derived. Left failing so it cannot be
forgotten.

#### 11.7.8 The camera — two seams root-caused, and a dial that was lying

`assert-hero-camera.mjs`: **9/9** on the shipped camera, **8/8 correctly FAIL**
on the whole prior camera, `SOUND`.

**Seam 1 · `orbit` → `descend`.** The return move left a parked camera at full
speed: **0 → 375.9 deg/s of azimuth in ONE FRAME**, out of a 933 ms hold in which
nothing had moved. Now `descend` accelerates into its own move — first frame is
**10 %** of the move's own peak step, against a 25 % ceiling sourced from Babbu's
dolly (3 of 21 frames = 14 %).

**Seam 2 · `tilt` → `standup`, and this one is worse than a stop.** The prior
camera crossed that seam at **el 0.8 → 84.0 deg/s in the SAME direction** — a
**105× re-acceleration with no turnaround to hide it**. Shipped: 80.1 → 76.4
deg/s, a 4.7 % change, against a 25 % ceiling.

**The elevation arc's kick, end to end:** worst same-direction step ratio
**56.0× → 5.1×**, against an 8× ceiling.

**And `lieEl: 65` was lying.** The dial names the deepest look-down; the camera
actually reached **70.35°**. The rise's gather is a fraction of its own TRAVEL
and stacked 5.5° on top of a destination the tilt had already arrived at, so the
beat's least legible frame sat in the rise's anticipation, **past the pose
everything was authored against**. It now reads `max elevation 64.86 deg against
lieEl 65`. This is §2's names-match-behaviour rule catching a camera rather than
a control.

**The rise rebalance had silently broken `prefers-reduced-motion`, and the
mechanism is named rather than guessed.** `page.tsx:661` zeroes `backC1` and
`emerge.overshoot`, but `riseOut` reads `riseGatherDepth` — so the switch had
stopped reaching the counter-dip. Measured: the prior camera **sails 3.80 past
its target** under the page's own reduced-motion params; shipped, **0.00**.
`assert-hero-reduced-motion.mjs` is **4/4**, and its fourth row is the control
that makes the other three mean anything: *"the overshoot IS present without the
preference — el dips 5.0°, az 3.8°, fill +0.020 — the gate can fail."*

⚠ **One handed figure did not reproduce as stated.** The reduced-motion count was
handed as *"2/4 → 4/4"*. The current run is **4/4**, verified; the 2/4 before-state
is not reproducible from the shipped script, which has no parked arm for it. The
*mechanism* of the breakage is confirmed first-hand in the camera assert's own
per-dial control matrix (`reduced-motion pre-fix → breaks: reduced`).

---

### 11.8 EIGHT instrument bugs, all found by RUNNING rather than reading

*§10.4's whole lesson is that a gate must be **run**, not read, and §11.3
recorded three cases. There are now eight, found across the same beat by the same
method. Recorded together because the pattern only reads at eight: **not one of
them makes anything look broken.** Six produced clean-looking artefacts or
confident green verdicts; the two that were red were red for the wrong reason.*

> 🔨 **⚠ THE HEADING SAYS EIGHT. IT IS ELEVEN — and the three added on
> 2026-08-01 are ONE STRUCTURE, which is why they finally bought a standing
> gate.** Items **9, 10 and 11** are below, after item 8. The heading and the
> paragraph above are left exactly as written; what they say about the first
> eight is still true.
>
> **The three share a shape the first eight do not: they are not gates at all.**
> Each is named `assert-*`, each sits in a sweep, and none of them could report
> a failure on the invocation a sweep actually makes. They are not measuring the
> wrong thing — they are not measuring. That is a different defect from items
> 1–8 and it does not decay in one place, so the audit of it is now itself an
> assertion: **`scripts/verify/assert-gate-integrity.mjs`**, the meta-gate. Run
> first-hand, exit **1**, and it names the two still red:
>
> ```
> assert-joint-beading.mjs   NO   NO   LIVE          *** NOT A GATE: no-verdict, exit-uncoupled ***
> assert-layer-flicker.mjs   NO   NO   LIVE+STORED   *** NOT A GATE: no-verdict, exit-uncoupled ***
> assert-taper-envelope.mjs  yes  yes  LIVE+STORED   gate
> 2 FAILURE(S) — scripts named assert-* that cannot report a failure.
> ```
>
> It checks three independent channels — **EMITS** (a PASS/FAIL row is reachable
> with no flags), **EXIT-COUPLED** (a non-zero exit is reachable from the
> script's own judgement, and `.catch(() => exit(1))` explicitly does not count,
> because that reports the script crashed and never that the subject failed), and
> a stored-evidence probe that runs each capture-reading gate against a label
> that does not exist and requires it to REFUSE. Its own not-probed row is named
> rather than skipped — *"a SKIP IS NOT A PASS."*

**1 · The capture's emerge window was derived by phase NAME, and the phase
reorder made it run BACKWARDS.** (§11.3, item 1.) It looked up `anticipation` and
used its start as the window's *end*, silently assuming the tense comes after the
turn. §11.1.3 moved the tense before it. Result: `emerge window 4.04s..3.76s`,
**72 frames sampled over a negative span, every file correctly named**. Now
derived by *position* — the first phase after `emerge`, whatever it is called —
and the capture **throws** rather than writing a backwards window.

**2 · A "blank frame" at the moment was CLIPPING, not the beat.** (§11.3, item
2.) The page reserves height for the DialKit dock, so with the dock expanded the
stage came out **1120×350 instead of 1120×702**, and every absolute pixel
threshold in the gates was simultaneously reading a mark rendered at a third of
the area. **A missing-ink reading at the one frame the whole board turns on is
the most expensive possible place to be wrong.** Fixed by sizing the capture
viewport 1440×1440 so the stage survives either dock state.

**3 · The gate's parked window was a fixed `+0.55 s`, so `settled` was taken from
the DWELL.** (§11.3, item 3.) Sized for the old 0.54 s emerge, run against a
0.9167 s turn, the cut landed mid-recovery; `settled` is the median of the last
five widths and those five were the sliver — **`settled` = 24 px**. Every
threshold derived from it was being measured against the very frames it existed
to judge, and it reported *"no moment"* on a beat whose moment is plainly in the
frames. The window is now the whole emerge phase, derived from the capture's own
data, *"so a retimed beat cannot desync it."*

**4 · The yaw claim was VACUOUS — it passed on a beat with no turn in it.**
Written as `yaw <= 90` alone, the row *"the mark turns exactly to edge-on"*
passed on the parked-ramp control, **whose yaw is 0 on every frame**. Satisfied
by nothing happening at all. It is two-sided now — `89 <= maxYaw <= 90` — which
asks the real question: far enough to present the form's thickness, never far
enough to show the mark reversed. (`assert-hero-turn.mjs`.) This is the one the
camera assert's header points back at: *"an assertion that passed on a beat with
no turn in it because it was vacuously true. A green row that cannot fail is the
lie."*

**5 · The overshoot window read a flat 10.0° on BOTH arms.** The reduced-motion
sweep was hardcoded at `4.30 + 2.60·i/90`. 4.30 s lands inside `emerge`/`land`,
where the camera is parked dead-on at el 0 — so `min(el)` over the window was 0
on **every** arm and `elBelow = 10 − 0` reported **10.0° on the reduced arm and
10.0° on the control**. A number that never moved, describing the parked frames
*before* the rise instead of the rise's overshoot. It also silently desynced
every time the beat was retimed, and the beat has been retimed twice. Now derived
from the model's own phase offsets and narrowed to `standup`, the only phase that
contains either the gather or the overshoot.

**6 · `hold.png` was landing on the flat return, so a row asserted "lit object"
on a drawing.** The lit-hold screenshot was taken at a hardcoded
`setPlayhead(9.8)`. **K7 landing moved that shot out from under its own name**:
`descend → returnTurn → hold` takes the camera back to K1's framing and turns the
mark back to FLAT, so 9.8 s lands on a one-value drawing. The row then asserted
`sd > 6` and `spread > 60` on a flat mark — **a gate that cannot pass rather than
a gate that failed** — reading `ink sd 0.0, spread 0.0` on both arms. Now taken
from the middle of `orbit`, so a retimed beat cannot slide off the end.

**7 · The area metric was BLIND TO DIRECTION, and its control proved it.** In the
2D/3D draw-in parity assert, row 2 asks whether the raster inked the distance the
shared clock asked for. **Inked AREA is symmetric under reversal**, so drawing
the strokes in reverse pen order inks the right amount in the wrong place and an
area metric cannot tell. The `--control=order` arm exists for exactly this, and
run today it separates them decisively on the row that carries POSITION and only
marginally on the row that carries area: at playhead 0.12 the ink centroid sits
**7.8 % across the word clean against 91.1 % reversed**, while the area row misses
by 2.35 % against a 2.00 % tolerance — a hair, and not a direction signal. Row 3
asks **where** the ink is instead of how much, which is the property a reveal is
actually defined by. Same class of blindness the crease census had.

**8 · Gate 2 was sampling a phase that is FLAT BY DESIGN.** *"The held ¾ has real
tonal range"* has always sampled the phase named `hold`, which used to **be** the
held three-quarter. K7 landed, and the beat's `hold` is now a flat drawing by
design — measured on `reg-affine` it reads **sd 0.00 / spread 0.0, identical to
the flat beat to the digit, because it IS the flat beat coming back**. Left
pointed there, gate 2 asked the settled DRAWING to have the tonal range of a lit
solid — the opposite of what the beat is now for. It samples `orbit` now, with a
fallback that keeps every pre-K7 capture judged exactly as it was, **and it
prints the phase it actually read** (`— sampled in "orbit" f93`) so it can never
quietly drift again.

**9 · `assert-taper-envelope.mjs` CONTAINED NO CHECK AT ALL, and had been
printing "NOT CONFIRMED" for a cycle with nobody reading it.** It measured the
right thing, printed a table and a verdict, and **exited 0 whichever way the
numbers went**. There was no threshold anywhere in the file — not a loose one, a
missing one. Its own comment now states it plainly: *"this file is named
`assert-` and contained NO check at all… a script that cannot fail, which is this
repo's own definition of the lie."*

⚠ **AND IT IS ALREADY FIXED — the item is history, not an open defect** (verified
first-hand 2026-08-01: `ALL TAPER-ENVELOPE ASSERTIONS PASS`, three rows, exit 0,
and the file's own `process.exit(failures === 0 ? 0 : 1)`). The fix is worth
reading because of *what* it asserted. The reading the script had been printing
unread was **a fix landing, not a prediction failing**: `stroke-width-models.md`
§3.2 predicted the two fusion modes would disagree by ~18 % through the taper
because the loft placed its rings perpendicular to the tangent; explainer 17 §1
rebuilt the loft AS the canal surface, so they now describe the same solid.
Measured **0.981 — 1.9 % apart**, and the negative control is not synthetic: it
is what the loft measured *before* that rebuild, from the doc's own closed form,
and the same predicate rejects it at **2.130**. **A closed prediction sat
unclaimed for a cycle because the script that proved it could not speak.** One
cosmetic residue kept deliberately: the line still prints the words `NOT
CONFIRMED` beside a PASS, because that string is the §3.2 *prediction's* verdict
— the prediction is not confirmed, precisely because it was fixed.

**10 · `assert-joint-beading.mjs` emits ZERO PASS/FAIL rows on the invocation a
sweep makes.** Run with no flags it captures frames and prints counts —
`joints=2 caps=26 meshes=44 verts=16014` — and exits 0. It is a capture wearing
an `assert-` name. Its judgements are real and they are all behind `--compare=`
or `--holdsteady=`, which nothing calls. The meta-gate enumerates every one:
twelve unreachable-by-default paths, plus two `exit(1)`s that sit **inside a
`.catch`** and therefore only ever report that the script crashed.

**11 · `assert-layer-flicker.mjs` emits zero rows on its default invocation
too, and it has TEN assertion paths.** All of them sit behind `--fusion`,
`--guard`, `--calibrate` or `--reduced`. Default: 17 lines of per-preset
telemetry, one of which reads `STROBE`, and exit 0. **The most expensive detail
is that it prints a defect verdict and passes anyway** — `asc_flicker … STROBE`
is in the default output, unjudged. A row that names the failure and does not
raise it is worse than a silent one, because the evidence is on screen and reads
as informational.

**What the eight have in common, and why the tally is worth keeping.**

- **Six of eight were caused by the beat changing underneath a constant.** A
  phase reorder (1), a hardcoded second (5, 6), a hardcoded window length (3), a
  phase whose meaning changed while its name did not (8), a control arm whose
  yaw was zero (4). **Every hardcoded time in this beat's tooling has now been
  wrong at least once.** The fix in each case was the same shape: derive it from
  the model's own phase offsets, and print what was actually read.
- **Three of them could not fail** (4, 5, 6) and one **could not pass** (6's
  other half, and 8). Both are the same defect wearing opposite colours, and both
  are invisible without a control.
- **They were found by running the tool against a beat that had changed under
  it** — never by reading the tool. §10.4's lesson, at eight for eight.

> 🔨 **⚠ THE THREE BULLETS ABOVE ARE ABOUT ITEMS 1–8 AND STAY. Items 9–11 have
> nothing in common with them, and that is the finding.** Nothing changed
> underneath 9, 10 or 11 — no phase reorder, no hardcoded second, no beat
> retimed. They were **born unable to fail** and would read green for as long as
> they existed. So the two classes need different defences:
>
> - **1–8 are a DRIFT class.** The defence is derivation: take every window from
>   the model's own phase offsets, and print what was actually read. That defence
>   is now in the tooling and it works.
> - **9–11 are a CONSTRUCTION class.** No amount of deriving helps a script with
>   no threshold in it. The only defence is an audit — and a one-off audit decays
>   the moment the next script is written, which is why it became
>   `assert-gate-integrity.mjs` rather than a paragraph here.
>
> **The tally reads eleven for eleven on §10.4's lesson, and the eleventh row
> is the reason the lesson needed a machine.** Two of the three are still red as
> of 2026-08-01 and are named above rather than quietly fixed — `scripts/verify/`
> belongs to another lane.

---

### 11.9 What has landed since §11.7 — 2026-08-01

*§11.7 was written on the evening of 2026-07-31 and closed §11.4's five open
defects. The beat kept moving overnight. This subsection is the same shape as
§11.7 and follows the same rule: **nothing above it is edited except by a ⚠ note
in place**, and every number below was produced by running the named command on
this machine rather than inherited from the briefing that sent me here.*

**Four things I was handed did not survive contact with the code, and they are
called out where they belong** — §11.4.5's ⚠ (`motion.mjs` does *not* still carry
the falsified rationale), §11.3's ⚠ (the instrument tally is **eleven**, not
twelve), §11.0's ⚠ (`--label=turn3` is **8/9**, not the 7/9 I was told to keep),
and item 9 below (`assert-taper-envelope.mjs` **has** checks now). A briefing is
a claim that evidence exists, not the evidence.

#### 11.9.0 What is first-hand here

| what | command | result |
|---|---|---|
| the frame ledger | `node scripts/verify/assert-hero-ledger.mjs` | **4/4**, 4/4 correctly FAIL on the prior beat, `SOUND` |
| the wind-up | `node scripts/verify/assert-hero-windup.mjs` | **7/7**, 4/4 discriminating rows correctly FAIL on `releaseLaw: "prior"`, `SOUND` |
| the panel | `node scripts/verify/assert-hero-dials.mjs` | **3/3**, 31 controls, **31 live**, `SOUND` |
| K7's news | `node scripts/verify/assert-hero-k7-news.mjs` | **8/8**, 0 console errors |
| K7's news, uniform-re-value control | `… --mutate=shade` | the survives-keeps-its-value row goes **RED**; **gate 1 stays green** — §11.9.4 |
| K7's news, value-at-the-crossing control | `… --mutate=wash` | **gate 1 goes RED**, sd 0.000 → 18.808 — the control that matches §10.5's sentence |
| the pen clock | `node scripts/verify/measure-drawin-pacing.mjs` | **7/8** — `velocity-bell` now **22/22**, `human-speed` still the finding |
| the gates, current capture | `node scripts/verify/assert-hero-transition.mjs --label=k7final` | **8/9** — one FAIL, §11.9.6 |
| the gates, all four historical arms | `… --label={after,turn3} [--gates=prior]` | 7/9 · 8/9 · 7/7 · 4/7 — the ⚠ under §11.0 |
| the meta-gate | `node scripts/verify/assert-gate-integrity.mjs` | exit **1**, 2 scripts named `assert-*` that cannot report a failure |
| the three no-verdict instruments | each run with no flags, exit code read | taper **0 / has checks**; beading **0 / zero rows**; flicker **0 / zero rows** |
| the beat itself | `toMotionMjsSource(DEFAULT_HERO_MOTION)` via `_ts-load.mjs` | 12.3667 s · 371 fr · `draw` 4.6667 s |
| `motion.mjs` ⇄ the model | own parity probe over all 372 program frames | max \|Δ\| az 1.83e-3° · el 1.28e-3° · fill 9.6e-6; **19.57°** against the parked laws |

No code outside `scripts/capture/motion.mjs` was written. `lib/`, `components/`,
`app/` and `scripts/verify/` were read, never written — three other lanes are
live in them.

#### 11.9.1 The wind-up now releases INTO the turn

`releaseLaw: "overlap"` is the default and `anticipation.releaseSec` is
**0.2917 s**. The tense no longer snaps back on the frame before the turn; it
unwinds across the turn's own silent leading frames, so the release and the
event are one gesture. `assert-hero-windup.mjs`: **7/7**.

The two rows that carry the idea:

```
PASS  the tense is STILL LETTING GO while the mark is turning
      4 rendered exposures carry both a live squash and a departed yaw
      — e.g. squashY 0.9551 at yaw 0.08 deg
PASS  no DEAD exposure between the wind-up and the turn
      0 exposures where the tense is over and the yaw has not moved
```

On `releaseLaw: "prior"` those read **0** and **1**. That single dead exposure is
the whole defect stated in one number: the prior law compressed, held to the
phase end, and then left the beat sitting still for one exposure between its own
wind-up and its own event.

**And the release is shaped, not just present.** It accelerates out of the hold —
five exposures stepping `0.02 → 0.54 → 2.03 → 4.52 → 0.00` px of height, first
step **0.5 %** of the largest against a 15 % ceiling; the prior law does it in
**one** exposure of 7.11 px, i.e. 100 %. And the biggest release step is small
against what the turn is doing on the same exposure — height moves 4.52 px while
width moves 70.68 px, **6.4 %** against a 25 % ceiling. *A step out of stillness
reads as a pop; the same step inside a bigger move reads as speed.*

**The spacing row is the one with a calibration attached, which is why it is
worth trusting.** The release is back-loaded on `t³`: value-half measured at
**77.8 %** against **79.4 %** authored, read 1.6 points low by the twos grid,
needing ≥ 70 %. §6.5's crossfade dead band is 42–58 %, and the instrument prints
what a **linear** release of the same duration over the same window would
measure: **55.6 %** — inside the dead band, rejected. A bar that is only ever
shown the shape it was written for is not a bar.

⚠ **Stated plainly, because the instrument does:** three of its seven rows
(*reaches its authored depth*, *nothing unwinding at the edge*, *back-loaded*)
**pass on both arms** and are marked as shape rows rather than counted as
discrimination. Four rows separate the two laws. And the clamp is
mutation-tested rather than trusted — `releaseSec` dragged to 2.0 s, far past the
half-turn, and the edge row still has to hold. It does.

#### 11.9.2 The dead-dial sweep found EIGHT, and the panel is now 31 live of 31

`assert-hero-dials.mjs` sweeps every control the panel shows over the whole
12.37 s beat, **each judged in the state the panel shows it in** — which is the
detail that makes it honest, because half these dials are parked-arm dials and a
sweep run only at the defaults would call them dead. **31 controls, 31 live**,
3/3 rows, `SOUND`. The row that matters most is the second one: *"no control
moves ONLY a channel nothing draws"* — **0**, the `squashX` class.

**Eight were dead, not three.** The instrument reproduces the pre-fix panel as
its own calibration rather than asking to be believed:

```
reproduced, correctly  the pre-fix panel showed these unconditionally:
   Stand azimuth DEAD · Stand elevation DEAD · Standing DEAD · Drift cut DEAD
   · Light lag DEAD · Light DEAD · Overshoot DEAD
reproduced, correctly  Hold tension under the PRIOR wind-up law reports DEAD
   — it was dead on every read until the release wired it
```

Seven plus one. **Three of the eight are worth naming individually, because each
is a different way for a dial to lie:**

- **Hold tension was read by NOTHING, on any arm.** `anticipation.holdSec` sat
  between a compress and a snap, so the hold's length changed when the snap
  happened and never what the frame looked like. §11.9.1's release is what gave
  it a consumer — the wind-up gained a third act and the hold became the thing
  the release starts from. **A dial can be dead because the beat around it has a
  hole, not because the wiring is broken**, and no amount of tracing the wire
  finds that.
- **Overshoot is a 0/not-0 SWITCH sold as a 0–4 coefficient.**
  `app/desk-doodles/page.tsx:1894` renders `<Dial label="Overshoot"
  value={motion.backC1} min={0} max={4} step={0.01} />` — 400 reachable
  positions. Under the shipped `riseCurve: "riseOut"` the only thing that reads
  it is `hero-motion.ts:1931`: `const gather = p.backC1 === 0 ? 0 :
  p.riseGatherDepth`. **Every value from 0.01 to 4.00 renders identically.** It
  is not dead — 0 does something real, and it is load-bearing: the page zeroes
  `backC1` under `prefers-reduced-motion`, which is the contract §11.7.8 found
  broken. But a slider whose 400 positions are two states is a **names-match-
  behaviour** failure of a kind the §2 rule does not quite name, because the name
  is right and the *affordance* is the lie.
- **Swell was mislabelled, and the correction is in the code's own words.**
  `emerge.overshoot` is hinted *"how far past full thickness the ink puffs before
  settling"* — and under `emerge.mode: "turn"` that ink swell does not exist at
  all; the turn's depth is `easeInOutCubic`. What the dial actually moved:
  *"az 19.1° / el 25.2° / fill 0.10 and depth by exactly nothing."* **One
  control, wrong name, the other end of the beat** — it was the *rise's*
  overshoot wearing the ink's label. Split into `riseOvershoot` at no behavioural
  cost, because the default is the value the rise was already reading.

⚠ **What the sweep explicitly does NOT cover, named so 31/31 is not misread as a
clean bill:** controls outside the motion model — Look, Engine, the word source,
the hand's Wobble and stroke-ending pills, the pen's clock. They change what the
DRAWING is, not how the beat moves. They want their own sweep. And the
consumer-side `RENDERED` column is a hand-checked **map**, not a measurement; it
can rot. `assert-hero-dead-channels.mjs` is the pixel-level check on the two
channels that actually went dead once.

#### 11.9.3 K7's news RENDERS — and the round trip says something

`assert-hero-k7-news.mjs`: **8/8**, 0 console errors. This is call 1's shipped
answer proven on pixels rather than argued, and every row is a different way for
an occlusion to turn out to be something else:

```
PASS  the RETURN lands on K1's own picture — before the news
      ink px K1 25460 vs K7-fused 25460 (0.00 % apart)
PASS  GATE 1 HOLDS ON THE RETURNED FLAT — one value inside a hard silhouette
      interior sd 0.000 over 11335 px, spread 0.0.  K1 reads sd 0.000
PASS  K7 IS MEASURABLY DIFFERENT FROM K1
      1544 px of ink became paper (needs > 200)
PASS    ...and the change is INK -> PAPER ONLY
      paper -> ink 0 px (needs 0)
PASS    ...and every ink pixel that SURVIVES keeps its exact value
      11335 interior px in both frames, 0 moved by more than 2 luma, worst delta 0.00
PASS  the ink lost MATCHES the break model
      predicted 1625 px, measured 1544, ratio 0.95 (needs 0.6-1.4)
PASS  every junction with news to tell REACHED the shader
      truncated 0.  22 junctions published, 19 opened, 3 dropped (no over/under to show)
```

**`0.00 % apart` on the first row is what makes the rest comparable at all** — if
the return did not land on K1's own framing there would be no way to tell news
from a different shot. **`0 px paper → ink` is the row that rules out the whole
family of impostors**: a fade, a wash and a drawn outline all put something back,
and an occlusion can only ever take ink away. **`worst delta 0.00`** is the same
argument on the surviving pixels: a shading changes the ink, an occlusion only
decides whether there IS ink.

**The predicted-vs-measured row is the one that keeps the shader and the table
from drifting apart silently.** 1625 px predicted from 256.2 units of centreline
× 22.6 ink at 0.5301 px/unit, 1544 measured — a slab across the stroke, so its
area is arc length × diameter and the 5 % gap is the two rounded ends plus the
antialiased edge. Neither number is free to move without the other.

**The wiring, since the board recorded this channel as unrendered.** §11.7.4's
`jointBreak` was published by the model and read by nothing —
`assert-hero-dials.mjs` still prints the asterisk for it. It is now consumed:
`app/desk-doodles/page.tsx:957` puts `jointBreak: sample.jointBreak` into the
flatten memo and `:967` lists it in that memo's dependency array. **The
dependency-array half is not a formality** — a value threaded into a memo whose
deps do not mention it is a channel that renders once and then freezes, which is
the same defect wearing a third costume.

#### 11.9.4 Gate 1 is BLIND to a uniform re-value, and the board leans on gate 1

Recorded as its own item because §10.5 states the rule the other way round —
*"a value difference at a crossing breaks gate 1"* — and that sentence is true of
a difference **at a crossing** and false of a wash over the whole mark.

Proven by running the instrument's own control, `--mutate=shade`, which drives K7
by `shade` on the real page instead of by the break:

```
PASS  GATE 1 HOLDS — interior sd 0.000 over 13934 px
FAIL  ...and every ink pixel that SURVIVES keeps its exact value
      13934 interior px in both frames, 13934 moved by more than 2 luma, worst delta 8.35
```

**Every single interior pixel changed value and gate 1 did not move.** A standard
deviation measures spread, and multiplying a one-value silhouette by a constant
leaves the spread at zero. So gate 1 is a **flatness** gate and was never a
**value** gate, and the two are not the same claim.

That is not an argument to loosen it. It is an argument that gate 1 alone cannot
carry call 1, and it is why the assert ships `--mutate=wash` beside it: render
the break region as **lighter ink** instead of as paper — a value difference at
the crossings, exactly the forbidden shot. Run first-hand, that arm reads:

```
FAIL  GATE 1 HOLDS ON THE RETURNED FLAT
      interior sd 18.808 over 13934 px, spread 127.9 (needs sd < 1)
FAIL  ...and every ink pixel that SURVIVES keeps its exact value
      1325 moved by more than 2 luma, worst delta 127.86
```

**So the two controls separate the two claims cleanly.** `shade` moves
**13934 of 13934** pixels and gate 1 does not blink; `wash` moves **1325** — a
twentieth as many — and gate 1 goes to sd 18.8. The gate is not weak; it is
answering a different question, and the question it answers is the one call 1
needs. **The sentence §10.5 wrote has a control that matches it. It just is not
the obvious one, and reaching for the obvious one would have produced a
confident green.**

#### 11.9.5 A shader trap worth writing down: `discard` inside a dynamically-bounded loop

Recorded because it cost an hour and because nothing about it looks like a bug.
`components/viewport-3d.tsx:912-922`, in the file's own words, bisected on the
real page:

> *"Written the obvious way — `discard` as the loop body's last statement — this
> HANGS Chrome's Metal backend: the page keeps ticking (rAF 121/s, JS
> responsive, zero console errors, `__heroBreaks` correct) and stops presenting
> frames, so a screenshot times out at 6 s and the compositor eventually takes
> the tab down."*

**Every diagnostic this repo trusts reads green while nothing is on screen.**
rAF is ticking at 121/s — the number §3 of `docs/DISPATCH.md` uses to prove the
loop is alive. The console is clean. The published break table is correct. The
only symptom is a screenshot timeout, which reads as a flaky harness.

The bisect is what makes it a finding rather than a superstition: the same loop
with `break` in place of `discard` renders in **46 ms**; the same `discard`
hoisted out of the loop behind a flag renders in **60 ms**. The trigger is the
`discard` *inside* the dynamically-bounded loop, not the loop and not the
`discard`. It is written into the shader rather than tidied away, and it belongs
in this board because **"the page is alive and presenting nothing" is a state
none of this beat's instruments can distinguish from "the page is fine."**

#### 11.9.6 What is OPEN: `max cy step 2.00 px`, against a ceiling of 2

One gate fails on the current capture, and it is the only one.
`assert-hero-transition.mjs --label=k7final` (2026-08-01 00:33) reads **8/9**:

```
FAIL  REGISTRATION holds — cx on every frame, cy where there is a silhouette
      max cx step 1.00 px (needs < 2), max cy step on frames >= 20% of settled
      2.00 px (needs < 2), across 69 parked frames — the turn and its landing
      — 3 leading "anticipation" frames excluded
```

**`cx` is unmoved at 1.00 px**, the instrument's own floor — §11.7.1's
orthographic fix is holding. The failure is the vertical axis alone, and it is
**exactly on** the ceiling rather than past it.

⚠ **This is LANE 6's, and it is recorded here rather than diagnosed.** What I
verified first-hand is the reading above and the arm it came from. The ruling I
was handed — that it is **not** caused by the K7 break, a control with the break
disabled reading an identical 2.00 px across 72 byte-identical frames, and that
it arrived with the retiming moving the sample positions — **I did not
reproduce**, and it is theirs to prove. It is written down as OPEN with the
attribution visible, because a citation is a claim that evidence exists.

One thing the board can usefully say about it: **§11.7.3 already narrowed this
row once**, when the contact-pinned squash was found moving the bbox's vertical
midpoint *by design* at full extent, on exactly the frames the `cy` clause trusts
most. The window now starts where the turn starts. A second narrowing would want
the same treatment that one got — `--mutate=cy` puts a 6 px vertical displacement
inside the turn and the row still has to go red — or the fix is a fix to the
gate's patience rather than to the beat.

#### 11.9.7 `motion.mjs` — regenerated again, and now checkable

The full account of what was stale is the ⚠ under §11.4.5. What changed in the
file:

1. **The CONSTANTS block was re-emitted** from
   `toMotionMjsSource(DEFAULT_HERO_MOTION)` — `draw` 2.1333 → **4.6667**, `tilt`
   0.7 → **0.4333**, `DRAW_LINEAR_BLEND` 0.45 → **1**, and the five missing
   exports added.
2. **`cameraProgram()` was rewired to READ them**, because pasting a block that
   names three laws over a program that ignores all three is the same defect as
   the falsified rationale in a different costume — an intent nothing implements.
   Three poses were second opinions: `tilt` ran the parked symmetric ease and
   started the rise from `lieEl`; `standup` took its overshoot from
   `EMERGE.overshoot`, the *ink's* swell dial (§11.9.2); `descend` left the hold
   at full speed. `handoffEase`, `riseStartEl` and `tiltHandoverSlope` are ported
   verbatim beside the curves that were already there.
3. **Parity is now measured, with a negative control.** Every pose diffed against
   `sampleHeroMotion()`'s own az/el/fill at the matching phase-local u, all 372
   program frames, twelve phases: **az 1.83e-3° · el 1.28e-3° · fill 9.6e-6**.
   Against `tiltLaw: "prior"` / `descendLaw: "prior"` the same diff reads
   **19.57°** — four orders of magnitude, so the check is not blind.

**And the residual turned out to be worth a number.** It is not floating point:
`toMotionMjsSource` emits `Number(v.toFixed(4))`, so `MOVE_ACCEL_FRAC` arrives as
**0.1905** against the model's `4/21 = 0.190476…`, and the entire residual sits
inside `handoffEase`'s nose where that fraction is the denominator. Feed the model
the same 4-decimal values and the three channels agree to **2.2e-13 / 8.0e-8 /
1.1e-15**. **So the film and the page can never be bit-identical across this
transfer, and the size of that gap is now 0.0018° of azimuth rather than an
assumption.**

⚠ **The program emits 372 frames where the timeline is 371, and that must not be
"fixed" by trimming a phase.** The walk rounds each beat to frames individually;
the transport rounds the total once. `assert-hero-ledger.mjs` prints the same
arithmetic — *"372 of 371 total"* — and is the honest place to see it.

⚠ **The paste is still a manual step with no gate on it.** That is deliberate
(§10.5 call 4: an explicit mechanical transfer rather than a pretend-automatic
import), and this pass is the second time in two days it has been found stale.
The parity probe above is a check that *could* be a gate; it is not one yet, and
`scripts/verify/` is another lane's.

#### 11.9.8 A LINE-NUMBER ROT SWEEP — eleven citations in this board point at the wrong line

*§1's own rule: **"A citation is not evidence — OPEN THE LINE YOU CITE. Line-numbers
rot."** Every `file:line` reference in this board, in `docs/README.md` and in
`SESSION-HANDOFF.md` was opened on 2026-08-01 and compared with what it claims.
Eleven had rotted. **Nothing below is deleted** — the corrections are here, in one
place, because eleven scattered ⚠ notes would be less readable than one table and
each rotted line is the same defect.*

**The class is worse than a broken link, and the first row shows why.** A rotted
`file:line` almost never lands on nothing. It lands on **a real line of real
code**, so a reader who follows it gets an answer — the wrong one — and has no
signal that anything is off. `page.tsx:1309` used to be the "Copy motion.mjs
constants" button; today it is the timeline dock's phase read-out. Both are
plausible. That is the failure.

| passage | citation as written | what is at that line NOW | verified live location |
|---|---|---|---|
| §3, the driven-by table | `viewport-3d.tsx:3036` — `opacityScale={1 - flatten.ink}` | `extrudeParams?: ExtrudeParams` | **`components/viewport-3d.tsx:3937`** — and the expression is now `opacityScale={flatten.shadow ?? 1 - flatten.ink}`, so the citation is stale about the **mechanism** too: the shadow got its own channel in §11.7.6 and is no longer derived from ink |
| §3 K2 · §11.4.3 | `page.tsx:1295` prints squash as text | a comment fragment in the dial panel | **`:1978`** for the read-out — and the claim it supports is closed: squash is in the flatten memo at **`:941-942`**, deps at **`:965-966`** (§11.7.3) |
| §11.4.3 | `page.tsx:689-695` — the material memo's channels | `...motion,` inside the *reduced-motion* memo | **`:921-925`** |
| §8 · §11.1.5 | `assert-hero-transition.mjs:72` imports `hero-moment.mjs` | a bare `//` | **`scripts/verify/assert-hero-transition.mjs:86`** |
| §10.3 | `hero-motion.ts:50` — `HERO_PHASES` is a fixed const array | the string `"descend"` *inside* that array | **`lib/hero-motion.ts:75`** |
| §10.3 | `lib/hero-motion.ts:74` — `HERO_PHASES` | `*/` | **`:75`** — off by one |
| §11.1.3 | `hero-motion.ts:65` — `HERO_PHASES` now reads … | prose inside the phases doc comment | **`:75`** |
| §11.1.4 | `hero-motion.ts:862-864`, `:885-888` — the parked camera | a comment about mark height | the `orbit` branch's `e = 1` is **`:1971`**; the rise's endpoints are **`:1941-1943`** |
| §11.3 item 1 | `verify-hero-transition.mjs:173-194` — the backwards-window throw | `if (RELEASE) {` | the quoted throw is **`:274`** |
| §11.3 item 2 | `verify-hero-transition.mjs:84-96` — the clipping note | prose about the projection | the quoted sentence is **`:120`**; the 1440×1440 fix is **`:127-128`** |
| §11.7.8 | `page.tsx:661` zeroes `backC1` and `emerge.overshoot` | `const [rest, setRest] = useState(...)` | **`app/desk-doodles/page.tsx:690-697`** — and it zeroes **three** things now, not two: `emerge.overshoot`, `riseOvershoot` and `backC1`. The comment there says why: *"It used to be read off `emerge.overshoot` — an ink dial — so zeroing the ink quieted the camera by accident, and the accident was load-bearing."* |

**Checked and NOT rotted, stated so the sweep reads as a sweep and not as a list
of hits:** `lib/hero-motion.ts:104-107` (cited twice, here and in
`SESSION-HANDOFF.md`) · `lib/hero-motion.ts:1931` · `lib/hero-motion.ts:2101` ·
`components/viewport-3d.tsx:912-922` · `app/desk-doodles/page.tsx:957` · `:1894` ·
`:2003` · `docs/storyboard/tools/assert-moment.mjs:46` ·
`docs/reference-original/compose.ORIGINAL-FLIP.mjs:200`.

**Two are HISTORICAL BY DESIGN and must not be "fixed".** §10.2 C2 cites
`lib/hero-motion.ts:133` / `:207` for the `pushScaleEnd` dial and §10.2 C3 cites
`:65` for `breath`'s falsified doc comment. Both quote text that **no longer
exists anywhere**, because both defects were closed — which is the point of those
subsections. For the reader who wants to see what replaced them: the
`pushScaleEnd` comment survives as struck history at **`lib/hero-motion.ts:575`**,
and `breath`'s corrected rule — *"an accent is bought with a hold, not with a
move"* — is at **`:135`**.

🔴 **AND ONE ROTTED CITATION IS IN THE CODE, NOT IN A DOC — reported here
because `lib/` belongs to another lane.**

```
lib/hero-motion.ts:757   ...it is expressed as a RATIO because the
                         ink diameter is itself derived from stroke-coordinate
                         space (`flat-ink.ts:59`, `INK_DIAMETER_IN_STROKE_SPACE = 22`)
```

`INK_DIAMETER_IN_STROKE_SPACE = 22` is at **`lib/flat-ink.ts:97`**. `flat-ink.ts:59`
is inside the doc comment for `draw` / `drawAtTime` and has nothing to do with the
constant. **The exact fix is one token: `flat-ink.ts:59` → `flat-ink.ts:97`,
in the `breakK` doc comment on `HeroReturn`.** The claim the citation supports is
correct — the constant is real, the value is 22, and the ratio argument holds; only
the number rotted. Worth noting *why* it matters more than most: `breakK` is the
dial that sizes K7's news, which is the beat's second moment, so the next person
reading that comment is someone changing the thing §11.9.3 just gated.

⚠ **THE REAL FIX IS NOT THIS TABLE.** This table will rot too, and probably
within the week — six of these eleven citations were written *after* the
2026-07-31 morning pass and had already gone stale by the evening of the same
day. **A `file:line` citation in a long-lived doc is a hardcoded constant, and
§11.8's own conclusion about hardcoded constants applies to it exactly: *"every
hardcoded time in this beat's tooling has now been wrong at least once… derive it
from the model's own offsets, and print what was actually read."*** The
doc-side equivalent is to cite a **symbol** — `HERO_PHASES`, `readFlatOverride`,
the quoted sentence itself — which is greppable and cannot silently point at the
wrong thing. Every new citation in §11.9 quotes text or names a symbol beside the
number for exactly that reason.

#### 11.9.9 What §11.9 does not do

- **The `cy` step is not diagnosed** (§11.9.6). Another lane owns it.
- **`assert-joint-beading.mjs` and `assert-layer-flicker.mjs` are named, not
  fixed** — items 10 and 11. `scripts/verify/` is another lane's.
- **No frames were rendered for this pass** beyond re-running the asserts, which
  drive the page themselves. `key-shots.png` and `ink-evidence.png` still show a
  film that no longer exists — §11.6's last bullet, now two re-cuts out of date
  rather than one.
- **K1's silhouette complaint (§3 K1) is still not re-measured.** It is a shape
  judgement and it has now survived three passes unexamined, which is worth
  saying out loud rather than leaving in a list.
- **`lib/hero-motion.ts:757`'s rotted citation is reported, not fixed**
  (§11.9.8). `lib/` is another lane's, and a one-token edit to a live engine file
  from a doc lane is exactly the concurrency failure `docs/DISPATCH.md` §4 exists
  to stop.
- **The shader trap (§11.9.5) is recorded from the source's own bisect, not
  re-bisected.** Re-running it means deliberately hanging the page, and three
  lanes are live on it. The comment states it was bisected first-hand and gives
  both timings; that provenance is quoted rather than re-earned, and it is
  labelled here as quoted.
- *(Was listed here as not-run and then run: `--mutate=wash`. The numbers are in
  §11.9.4 and both arms are first-hand.)*

---

## Appendix — the reference films, honestly

`docs/refs/README.md`, verbatim:

> *"None of the three contains a **flat-drawing-stands-up-into-3D** beat. That
> hero beat is ours and has **no reference footage** — the bar these films set is
> on surface craft, paper physicality and pacing, not on the 3D move itself."*

> **⚠ TRUE OF THOSE THREE FILMS — and about to stop being true in general.**
> Confirmed for the original set: `reference-film-mechanics.md` §10.1 checked all
> 2,942 frames and found *no perspective change, no rotation about a horizontal
> axis, no occlusion-order change, no cast shadow appearing.*
> **But a live lane is closing the gap right now.** `docs/refs-online/README.md`
> describes **eleven downloaded clips that do contain the move** — *"a flat mark
> becoming a dimensional form (or the inverse — a dimensional form resolving onto
> a flat mark)"* — with contact sheets already on disk under
> `docs/verification/refs-online/`, including `extrude-outline-reveal`,
> `pencil-sketch-extrude` and an `extruded-logo-resolve/02-deextrude` sheet that
> is literally a 3D form returning to flat. Its measurements
> (`docs/research/online-reference-mechanics.md`) **had not landed when §10 was
> written** and are deliberately not read here — that is the other lane's
> deliverable in flight, and duplicating it would collide with a live owner.
> **When it lands, calls 1 and 2 in §10.5 should be re-run against it first**:
> a de-extrude is direct evidence for call 1, and an outline-reveal is direct
> evidence for how much edge profile survives at small scale (call 2).
>
> **✓ IT LANDED 2026-07-31, AND THE RE-RUN IS §11.5 — but the two clips this
> paragraph nominates did not turn out to be the evidence it expected.**
> `extruded-logo-resolve` *"orbits to head-on and removes depth by shrinking it
> over 2 002 ms, never by turning through the edge"* — so the de-extrude is not a
> return through an edge and is not direct evidence for call 1; the call-1
> evidence came instead from `origami-logo-fold`'s occluder. And
> `extrude-outline-reveal` *"rotates throughout and never narrows to a sliver"* —
> **no clip in the set presents a form edge-on at all**, so the set cannot say how
> much edge profile survives at small scale. **A citation is a claim that
> evidence exists; this one was made before the evidence was measured, and the
> measurement did not bear it out.** What the set does give is a fidelity ladder
> (call 2's approach frames) and a hard negative on the two-frame dwell.

So they cannot be reverse-engineered for the move. What they give is **how a
moment is constructed around a move**, and §10 works that through.

> **✗ CORRECTED — this appendix originally rested on a claim that is false.** It
> quoted `docs/refs/README.md`: *"Camera **pans down the sheet** between beats
> rather than cutting; the paper stays continuous"*, and called it the one
> editing mechanic the films give us.
> `docs/research/reference-film-mechanics.md` §2.7 measured it: **there is no pan
> anywhere in Exquisite Corpse.** Between the head close-up (11.04 s) and the
> torso close-up (11.67 s) — the only two shots the claim could describe — there
> is a hard cut, mad 18.6, hcorr 0.701, one frame. The paper is re-framed by
> **cutting**, twice, and both cuts leave a still frame.
>
> The board's inference from it — *"the substrate is continuous and the event
> happens on it"* — is still true, because the original flip's one centre is
> **our** measurement of **our** footage (§7). It is not inherited from Exquisite
> Corpse and must stop being presented as such.

What Exquisite Corpse actually does with its seams is more useful to us than the
pan would have been. It **hides them by never showing them** for 7.8 s, then buys
the payoff by **cutting to an empty ochre field and holding on nothing for
625 ms** — frame-to-frame change exactly 0.000 for the whole 625 ms (mechanics
§4.1–4.2). That is the same device as K3′ — take the subject away — at a
different scale, and §10.2 C7 maps the two onto each other.

The genre-neighbour (Doodle Fonts) contributes two things. One for K1: it keeps
*metrics visible* — ghost glyph, baseline, x-height, sidebearing bars. If K1 is
meant to establish the subject as a MARK rather than an object, the page's own
ruling is the cheapest way to say so, and it costs no motion at all. One for K7:
its closing gesture is **doodle → plain sans**, not sans → doodle — *"it hands
the artifact back to plain type at the end, rather than converting plain type
into the artifact"* (mechanics §2.8). That is a **changed** return, and it is
evidence in open call 1 (§10.5).

---

*Board written against `docs/research/storyboarding.md`; method reusable via
`.claude/skills/storyboarding/SKILL.md`.*

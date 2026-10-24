# Write-on timing: how the ink arrives, and why a trim path never reads as a hand

*The other half of [`stroke-width-models.md`](stroke-width-models.md). That one
covers how thick the mark is. This one covers WHEN each piece of it shows up:
order, lifts, speed, and what the frontier looks like. Nothing here is about
width; where a width question came up it was handed back to that doc.*

---

## The bottom line

**The velocity model is already right and is not the problem.** The shipped hand
is `mu = -1.888`, `sigma = 0.243`, overlap `0.494` (measured, §3.3). All three sit
inside the admissible ranges [`handwriting-variability.md:123-128`](handwriting-variability.md)
quotes from Djioua & Plamondon, and the overlap lands on that doc's recommended
`Δt ≈ 0.5` to within 1%. The repo's own pacing instrument scores 22 of 22 strokes
as carrying a real lognormal velocity peak. **Anyone about to "add easing to the
draw-in" is about to make it worse.** Go and read §6 first.

**What is wrong is upstream of the animation, in the recording it replays.**
Measured through the real builders (§0):

- **Nine of the twenty-two strokes are shorter than the nib is wide.** The
  shortest is 4.9 units against a 22.6-unit nib, a fifth of a nib. They carry
  2.03% of the pen travel and **2,289 ms of the 16,805 ms record, 13.6% of the
  clock**. Each renders as a mark roughly 5.6× longer than the path that made it (4.9
  units of travel plus 22.6 units of nib),
  and each pops into being detached from the pen. I counted eight detached
  new-ink islands in twenty-nine frames of the shipped write-in (§4.1).
- **Every one of the twenty-one pen lifts is exactly 60 ms.** Not a distribution,
  a constant: `MS_GAP_BETWEEN_STROKES = 60` at `lib/pen-reveal.ts:1240`. The
  lowest adult figure I could verify in a primary source is 90 ms (§2.2).
- **Six of the twenty-one strokes put the pen down to the LEFT of where the
  previous stroke started.** "Desk Doodles" has no letter a hand writes out of
  left-to-right order.
- **The hero beat compresses the draw 3.60×**, which takes the shortest stroke to
  **66.9 ms on screen**. The repo's own gate already fails on this and says why:
  100 ms is the literature's floor for a real hand movement.

**And the trim-path answer, which is the one that decides the build (§6).** The
tell is not the average rate. Averaged over a character, real handwriting is
almost exactly constant speed: the mean time→length curve across 2,858 real
samples departs from a straight line by at most **5.2%** (§3.2). But each
individual character departs by a median of **12.9%** and up to **34.8%**, because
each carries **3.4 accelerate-decelerate cycles at a 130 ms period** and they land
in a different place every time. **A trim path has exactly one such cycle, or
zero.** No global easing curve can add the other 2.4, because averaging is what
destroyed them. That is the mechanism, stated as a number.

---

## 0. What we ship now, measured

Every number in this section came out of the real modules, not a re-implementation.
Two probes live at `write-on-references/_measure/` and one is the repo's own
instrument.

### 0.1 The stroke inventory

`node docs/research/write-on-references/_measure/probe-stroke-inventory.mjs`,
which calls `processedHeroStrokes("lognormal")`, the same builder the page calls.

```
nib diameter 22.6 units;  22 strokes;  total travel 3159.0
  #   pts      len   len/nib     x0     x1     dur_ms   gap_before_ms
  0   133    515.5     22.83      0    125       1432              -
  1     4      4.9      0.22      0      5        241             60  <- SHORTER THAN THE NIB IS WIDE
  2     6     15.7      0.69    104    114        241             60  <- SHORTER THAN THE NIB IS WIDE
  3    78    270.2     11.97    165    244       1432             60
  …
 21     4      5.2      0.23   1087   1090        241             60  <- SHORTER THAN THE NIB IS WIDE

9 of 22 strokes are shorter than one nib width.
They carry 64.3 of 3159.0 units = 2.03% of the pen travel,
and 2289 ms of the record.
pen-up gaps: 21 of 21 are positive; median 60 ms, range 60..60 ms
```

Three findings, and they are independent of each other.

**The nine stubs are not strokes.** Four points, five units of travel, and a nib
22.6 units across. Geometrically that is a capsule whose length is a fifth of its
diameter: a dot. A person tracing over an image taps the surface by accident; the
trace kept every tap. `scripts/capture/logo-strokes.json` is described in the page
as *"Sebs's traced handwriting — the logo as actually drawn"*, and it is, faithfully,
including the parts where the pen touched down and went nowhere.

**They cost 13.6% of the clock to draw 2% of the ink.** That is the part that
matters for timing rather than for tidiness. `timeStrokesByPenModel` gives every
stroke at least one full lognormal submovement, and one submovement is 241.1 ms
(§3.3). So a 4.9-unit stub is allotted the same 241 ms a real 200-unit stroke
would need. Nine of them, plus their 60 ms lifts, is 2.8 s of a 16.8 s record
spent laying nine dots.

**The lift is one hard-coded number used twenty-one times.** `lib/pen-reveal.ts:1240`,
`const MS_GAP_BETWEEN_STROKES = 60`, applied at `:1307` as
`t += durMs + MS_GAP_BETWEEN_STROKES`. Every gap identical, to the millisecond.
[`handwriting-variability.md:41-43`](handwriting-variability.md) already names why
that is the failure and not the fix:

> The corollary, from the 2025 handwriting-synthesis survey, is that **regularity
> is the tell, not irregularity**

### 0.2 The order

Same probe, stroke pen-down x in draw order:

```
6  0  104  244  325  297  332  343  342  394  517  581  645  755  853  880  1001  941  1060  1029  1028  1090
strokes whose pen-down point is LEFT of the previous stroke's pen-down point: 6 of 21
  1(0 after 6)  5(297 after 325)  8(342 after 343)  17(941 after 1001)  19(1029 after 1060)  20(1028 after 1029)
```

Five of those six are the stubs. Strokes 17, 19 and 20 are the interesting case:
20 is a real 68.6-unit stroke that starts at x 1028, after stroke 18 already
started at 1060. So the pen genuinely goes back and forth near the end of the
word, and it is not only the stubs doing it.

### 0.3 The pacing, from the repo's own instrument

`node scripts/verify/measure-drawin-pacing.mjs`. It runs off the real modules and
it has a calibration control (`--control`), which is why I trusted it. Abridged:

```
   recorded duration          16.805 s
   pen in the air             1.260 s  = 7.5 % of the record
   r(stroke length, stroke duration)   0.8407   (1.0000 = a machine)
   per-stroke speed spread             102.9 … 849.8 units/s  (×8.26)
   the app's own Play         16.805 s
   the hero beat's draw        4.667 s
   compression                 3.60×  faster than the pen
   shortest stroke              0.241 s recorded → 66.9 ms on screen
   median stroke                0.360 s recorded → 100.0 ms on screen
   strokes with a real velocity peak (peak/mean > 1.25): 22 of 22
FAIL  the shortest stroke still takes >= 100 ms on screen
      66.9 ms at 3.60× compression
```

**7 of 8 assertions pass.** The one that fails is the one this lane was asked
about. And "22 of 22 carry a velocity peak" is the finding that redirects the
whole job: the per-stroke shape is there. What is missing is everything between
and around the strokes.

---

## 1. Order, and ductus

**Ductus** is the number, order and direction of the strokes that make a letter.
It is the oldest thing in this whole subject and the only part of it that is
genuinely standardised anywhere: CJK stroke order is taught as a rule set
(top-to-bottom, left-to-right, horizontal-before-vertical, outside-before-inside),
and the KanjiVG project encodes it per stroke in the SVG itself, as
`kvg:StrokePaths` groups carrying an explicit per-stroke number. There is no
equivalent machine-readable ductus for the Latin alphabet; the school curricula
(Palmer, Nelson, Zaner-Bloser, D'Nealian) publish it as a printed chart of arrows.

⚠ **Provenance note.** The gathering lane's `duc-*.txt` files in
`write-on-references/_raw/` are the agent's SUMMARIES of those pages, not the
pages, despite headers that say otherwise. See
`_raw/_PROVENANCE-WARNING.txt`. The paragraph above is what I can state from the
one artefact in that set that is real, `duc-kanjivg-example-04e00.svg`, which is
the actual KanjiVG file for 一 and does carry the stroke numbering. **I have not
read a Latin ductus chart first-hand and this document claims none.**

### 1.1 Why it matters here, and why it is not obvious

The intuition is that ductus matters because it looks right. That is true and it
is the weaker half. The stronger half is mechanical: **ductus is what makes the
pen's position a continuous function of time.** A hand that writes `D` as
stem-then-bowl has the pen in one place at every instant, with one lift between.
A trace that draws the bowl, then a stub, then the stem, has the pen teleporting.
Teleporting is exactly what produces a detached island (§4).

So ductus is not a polish item that comes after the animation works. It is the
precondition for the animation being an animation of anything.

### 1.2 What our recording actually is

It is a trace over an image, not a recording of writing. That distinction is not
a criticism of the trace; it is the whole diagnosis. When you write, the order is
forced by the hand. When you trace, the order is whatever was convenient, and
convenience produces exactly what we measured: strokes out of left-to-right
order, and taps that left dots.

Two honest options, and they are genuinely different jobs:

- **Clean the recording.** Drop strokes below one nib width, and re-order the
  remainder into writing order. Cheap, and it fixes what was measured.
- **Re-record it.** Have the word written once, live, with real timestamps. That
  gives real order, real lifts and real speed in one go, and it retires
  `stampPenClock`'s reconstruction for this word entirely. Expensive, and it
  needs Sebs and a stylus.

The first is a lane's evening. The second is the only one that ends the question.

---

## 2. Pen lifts

### 2.1 What we do

One constant, 60 ms, twenty-one times (§0.1). During the gap nothing happens: the
reveal simply does not advance. `lib/pen-reveal.ts:91` states the intent plainly:
*"nothing advances while the pen was in the air, exactly like Rod."*

### 2.2 What a real hand does

⚠ Everything in this subsection I fetched and read myself. The full extracted
page is at `write-on-references/_raw/VERIFIED-pmc9853007-handwriting-pauses.txt`
(80,986 characters, HTTP 200), because the gatherer's 2 KB version of the same
page was a paraphrase.

From *In a split second: Handwriting pauses in typical and struggling writers*
(PMC9853007), quoting Kandel et al. 2008:

> a study with adults comparing inter-letter intervals in simple and complex
> syllabic structures reported average values of around 90 ms in simple syllables
> and of up to 155 ms for complex syllables

and the authors' own conclusion from it:

> pauses at or around 100 ms are related to the motor execution of handwriting in
> adults, but children may require longer

Their own measurements, on children, from Table 3:

| | Grade 3 | Grade 5 |
|---|---|---|
| mean pause duration per letter | **414.15 ms** (SD 359.97) | **358.52 ms** (SD 282.37) |
| pauses per letter | ~1.8 | 1.42 |

And the taxonomy the same paper quotes from Prunty et al. 2014, which is the most
directly usable thing in it because it is a set of bands rather than one number:

> (1) between 30 to 250 ms, which were assumed to indicate letter-formation
> processes; (2) between 250 ms to 2 s, considered to indicate between-letter
> pauses; (3) between two to 4 s, signaling word-level pauses; and (4) above 4 s

Note the paper's own caveat on that taxonomy, which it makes itself and which I
am repeating rather than hiding: *"the pause duration range for handwriting
execution was based on a study with only five participants."*

### 2.3 The measurement I made myself

The Latin-handwriting sources above are about intervals, not about how much of
the elapsed time the pen spends off the page. For that I measured real data.

**Quick, Draw!** raw (`storage.googleapis.com/quickdraw_dataset/full/raw/face.ndjson`,
a 6 MB slice, 1,479 recognised multi-stroke drawings with real millisecond
timestamps):

| | mean | median | p10 | p90 |
|---|---|---|---|---|
| strokes per drawing | 6.31 | 6 | 4 | 9 |
| stroke duration (s) | 0.741 | 0.555 | 0.203 | 1.493 |
| **pen-lift gap (s)** | **0.590** | **0.452** | 0.208 | 1.074 |
| **lift time / total time** | **0.388** | **0.374** | 0.252 | 0.541 |
| end-of-stroke speed / that stroke's mean | 0.545 | 0.485 | 0.185 | 0.962 |

Gap distribution: under 100 ms 1.7% · 100–300 ms 22.4% · 300–600 ms 44.0% ·
over 600 ms 31.9%.

**Read this with its caveat.** Quick, Draw! is doodling under a 20-second timer
with a mouse or a finger, and the gaps include deciding what to draw next. It is
not handwriting and its 452 ms median is certainly inflated relative to writing a
known word. What survives the caveat is the shape rather than the level:
**37.4% of elapsed time with the pen in the air, only 1.7% of gaps under 100 ms,
and the pen at half its own mean speed as it leaves the page.** Our record is at
7.5% air, 100% of gaps at exactly 60 ms, and no deceleration into the lift
because the lift is a pause in a clock, not a movement.

### 2.4 What to do with that

The band that fits a known word written at speed is Prunty's (1) and (2) meeting:
**letter-formation gaps in the low hundreds, between-letter gaps a few hundred**.
A defensible starting distribution, stated as a recommendation and not as a
measurement:

- **Within a letter** (the `k` stem to its arms): 90–150 ms, the Kandel band.
- **Between letters**: 150–300 ms.
- **Between words**: 300–600 ms.
- **Drawn from one per-instance seed, not per gap.** This is the shared-draw rule
  from [`handwriting-variability.md:31-32`](handwriting-variability.md), which says: *"The
  perturbation is one draw per rendering, shared by every stroke — not independent
  per stroke"*. Applied to the lift channel, which currently has no channel at all.

Three tiers, not one constant, and they need the letter map that
`lib/hero-letters.ts` already computes.

**And the gap must not be dead.** In real writing the pen decelerates into the
lift (measured above at 0.485 of the stroke's own mean speed), travels through
the air, and accelerates into the next contact. Our reveal freezes. That is
`motion-doctrine`'s dead beat, exactly: *"Settling to rest before the cut, or
starting from rest after it, is a dead beat."* If the pen is drawn (§5), the gap
is where it does its best work. If it is not, the gap is 60 ms of nothing
happening twenty-one times, which is 1.26 s of a 4.67 s beat.

---

## 3. Velocity through a stroke

### 3.1 What real pen movement does, measured

**Source: UCI Character Trajectories** (archive.ics.uci.edu/static/public/175),
downloaded and opened here. 2,858 handwritten character samples, 20 letter
classes, **one writer**, captured on a WACOM tablet at **200 Hz**, stored as pen-tip
velocity. Only single-pen-down characters were kept by its authors, which suits
this section exactly: it isolates what happens *within* one stroke.

Measured across all 2,858 samples (`_measure/measure_ct*.py`, results cached at
`_measure/uci-ct-metrics.json`):

| | mean | median | p10 | p90 |
|---|---|---|---|---|
| peak speed / mean speed | 2.257 | **2.196** | 1.694 | 2.924 |
| min speed / mean speed | 0.066 | **0.054** | 0.011 | 0.136 |
| coefficient of variation of speed | 0.593 | **0.564** | 0.396 | 0.822 |
| **velocity peaks per character** | 3.355 | **3** | 2 | 4 |
| gap between velocity peaks (s) | 0.138 | **0.130** | 0.095 | 0.200 |
| fraction of time below ¼ of mean speed | 0.114 | **0.090** | 0.035 | 0.242 |
| character duration (s) | 0.595 | **0.605** | 0.438 | 0.715 |
| first 10% of the stroke's speed / mean | 0.442 | **0.330** | 0.152 | 0.883 |
| last 10% of the stroke's speed / mean | 0.690 | **0.736** | 0.181 | 1.137 |

**The peak count tracks the letterform's own structure, and that is the finding.**

| letter | n | mean peaks | | letter | n | mean peaks |
|---|---|---|---|---|---|---|
| c | 142 | 1.92 | | a | 171 | 3.98 |
| l | 174 | 1.94 | | d | 157 | 3.97 |
| v | 155 | 2.07 | | h | 127 | 4.06 |
| e | 186 | 2.86 | | n | 130 | 4.17 |
| s | 133 | 2.88 | | w | 125 | 4.27 |
| z | 171 | 3.05 | | **m** | **125** | **6.14** |

`l` and `c` are two submovements. `m`, with its three arches, is six. Nobody
labelled that; it falls out of the speed signal. **The number of accelerate-
decelerate cycles in a letter is a property of the letter, not a style knob.**
This is the same claim the ΣΛ model makes, arrived at from the data.

The dataset was Gaussian-smoothed by its authors (σ = 2 samples = 10 ms), and
smoothing removes peaks. So **3.4 per character is a lower bound.**

### 3.2 The two-thirds power law does not survive

The obvious place to look for "slower on tight curves" is the 2/3 power law,
`v ∝ κ^(-1/3)`. Fitting `log v` against `log κ` per sample on the same 2,858
samples:

| | mean | median | p10 | p90 |
|---|---|---|---|---|
| exponent β in `v ∝ κ^(-β)` | 0.171 | **0.175** | 0.080 | 0.247 |
| R² of that fit | 0.337 | **0.312** | 0.082 | 0.634 |

**β is about half of the predicted ⅓, and the fit explains under a third of the
variance.** The correlation is real and it has the right sign (median
`corr(log v, log κ) = -0.507`), so the pen genuinely does slow at high curvature;
but a power law with a fixed exponent is a poor description of it, on this data.

That agrees with [`handwriting-variability.md:199-202`](handwriting-variability.md),
which already says the law *"is contested, with documented breakdown as movement
size and speed increase, and its constant K unspecified in the literature"*, and
with its instruction not to implement it separately because ΣΛ gives the coupling
for free. **This is now measured rather than cited. Do not add a curvature→speed
term.**

⚠ One writer, one tablet, smoothed. β on another writer could differ. What I can
defend is that ⅓ is not a constant of nature that we should be hard-coding.

### 3.3 What we ship, against that

`node docs/research/write-on-references/_measure/probe-hand.mjs`:

```
hand: mu -1.8884  sigma 0.24336  overlap 0.5  t0Scale 0.98794  dScale 1.00414
T   = 2 e^mu sinh(3 sigma) = 241.1 ms   (one submovement's active span)
K_t = T * overlap * t0Scale = 119.1 ms  (spacing between submovement onsets)
overlap ratio K_t / T       = 0.494
onset e^(mu-3s) = 72.9 ms   tail e^(mu+3s) = 314.0 ms
mu -1.888 IN range; sigma 0.243 IN range
```

Against `handwriting-variability.md`'s Table (`:123-128`): `mu` −2.2…−1.6, `sigma`
0.1…0.45, movement time 100–500 ms, velocity peak about 100 ms after `t0`. Ours:
`mu` −1.888, `sigma` 0.243, movement time 241 ms, onset at 72.9 ms. **Every one
inside the envelope, and the overlap within 1.2% of the doc's recommended 0.5.**

The consequence is worth stating because it looks like a bug and is not. Since
`T` depends only on the writer's `mu` and `sigma`, every submovement takes the
same 241.1 ms, so a stroke's duration is `k × 119.1 ms` for an integer component
count `k`. The 22 strokes therefore take only **8 distinct durations**:

```
241.1  360.2  479.3  955.6  1193.8  1312.9  1432.0  1551.1
```

**Nine strokes share 241.1 ms exactly, and eight of the nine are the stubs.** That
is regularity, and regularity is the tell, but it is regularity the model
asserts, not an artefact. The code says so at `lib/pen-kinematics.ts:597-603`:
*"a bigger stroke is executed faster rather than for longer […] if they were
per-stroke, every stroke would take its own time and the comparison between
strokes would mean nothing."* **Do not fix this by jittering `mu` per stroke.**
That doc's "what not to do" list forbids it in terms (`:258-260`), and
Carmona-Duarte's `eps_t` timing jitter is labelled child-like at ±0.02 and zero
for adults. Delete the stubs and eight of the nine go with them.

The ninth is the one to keep in view. **Stroke 15 is a real 173.6-unit stroke and
it also takes 241.1 ms**, because at one component the model's floor is one
submovement whatever the amplitude. That single stroke is what keeps the
movement-time gate failing after the stubs are gone (§7 item 4).

### 3.4 The one thing genuinely missing inside a stroke

Nothing. §0.3's instrument scores 22 of 22 with a real velocity peak, and the
flattest is peak/mean 1.459. The measured human median is 2.196, so ours are
flatter than a real hand, but they are bells and not sweeps. **This strand is
done and the build lane should leave it alone.**

---

## 4. The leading edge

### 4.1 What ours does, measured off the shipped frames

Frames: `docs/verification/writein-2026-08-28/seq/000..029.png`, the write-in as
filmed tonight. I looked at all thirty as a contact sheet
(`_frames/shipped-writein-seq.png`), then instrumented them.

The instrument colours every ink pixel by the frame it first appeared in
(`_frames/reveal-order-map.png`). Then, per frame, it takes the connected islands
of NEW ink and measures each one's distance to every pixel of ink already on
screen:

```
8 of 42 new-ink islands (>=60px) were DETACHED from all existing ink = 19.0%
```

Detachment alone is not a defect. A pen lift to a new letter lands detached by
definition. The test that separates them is what happens next: **a lift grows
forward from where it landed; a reveal-order defect gets filled in behind it.**

```
  f04 island x[747,770] area   113 gap  70.1px  -> next x[694,752]  DEFECT: filled in BEHIND it by 53px
  f07 island x[791,813] area   285 gap  39.8px  -> next x[770,812]  DEFECT: filled in BEHIND it by 21px
  f13 island x[915,942] area  1267 gap  28.9px  -> next x[914,995]  lift: next frame grows forward
  f16 island x[1013,1043] area  215 gap  15.0px -> next x[1013,1064] lift: next frame grows forward
  f18 island x[1089,1122] area  280 gap  29.1px -> next x[1086,1134] lift: next frame grows forward
  f20 island x[1158,1179] area  720 gap  51.0px -> next x[1155,1182] lift: next frame grows forward
  f23 island x[1262,1279] area   83 gap  80.2px -> next x[1213,1266] DEFECT: filled in BEHIND it by 49px
  f26 island x[1278,1320] area  411 gap  19.9px -> next x[1274,1345] lift: next frame grows forward
```

**Three reveal-order defects in one word.** Independently, mapping each frame's
new ink back onto the pen path and taking the 95th percentile of its arc position
gives the same answer in the pen's own coordinate:

```
frames where the ink FRONT went backwards: 5
  frame  5: front was at 31.9% of the word, next frame's furthest ink only 25.1%  (retreat 6.8 points)
  frame 22: front was at 80.0% of the word, next frame's furthest ink only 73.1%  (retreat 6.9 points)
  frame 25: front was at 92.8% of the word, next frame's furthest ink only 89.3%  (retreat 3.5 points)
  (plus two retreats of ~1 point, within the instrument's noise)
spread of ONE frame's new ink along the pen path: median 9.1 points of the word, max 31.7 at frame 4
```

Frame 4 laid ink in two places **31.7% of the word apart, in one frame.**

I then cropped and contrast-stretched frames 3–6 and 22–25
(`_frames/shipped-leading-edge-defect.png`) and looked at them. At frame 4, after
the `D` is finished, a small horizontal dash is floating in clear air to the
right of it; by frame 5 the `e` has grown backward to meet it. At frame 23,
after `Dood`, the identical thing happens at the second `e`. **Both failures are
on the letter `e`, both times.**

### 4.2 What causes it

I chased the wrong thing first and it is worth recording, because a later reader
will chase it too. `lib/implicit-surface.ts:1215` keys every surface vertex by
`field.nearestIndex(...)`, the reveal position of the NEAREST capsule, not of the
capsule that put ink there. That looked like the answer. I wrote a positive
control that runs the same rule in 2D over a path that approaches itself
(`_measure/nearest-index-positive-control.py`), against a control key of "the
first sample that covers this pixel". **Both produced zero detached islands.**
The nearest-index rule is not, on its own, sufficient to produce the symptom.
It may still contribute at tighter self-approaches than my test path had; what I
can say is that I could not make it fail.

The cause that IS sufficient, and that is measured, is §0.1: **nine strokes
shorter than the nib is wide.** A 4.9-unit capsule with a 22.6-unit nib renders as
a disc, and the reveal reaches it as one indivisible unit. At the render's scale
(0.735 px per trace unit) that disc is about 25 px across, roughly 490 px of area.
The detached islands I measured are 83, 113, 215, 280, 411 and 720 px. A dot,
appearing whole, in clear air, between two letters. That is what a stub is.

### 4.3 What a frontier should look like

Two answers, and the first one surprised me.

**In real writing there is no visible leading edge, because the pen covers it.**
I downloaded *Writing with fountain pen* from Wikimedia Commons (CC BY-SA 4.0,
1886×964, 25 fps, 15.68 s), extracted all 392 frames, and looked at them
(`_frames/ref-fountain-overview.png`, then `_frames/ref-fountain-nib-zoom.png` at
frames 297–327). What I saw:

- The nib is a large opaque wedge sitting directly ON the newest mark. Measured on
  frame 297: **the dark mass of nib plus fingers is 8.8× the area of all the ink
  written so far in that frame.** You never see ink appear. You see ink emerge
  from behind a moving object.
- The nib holds a constant angle to the page across the frames and does not rotate
  as it travels, which is the same fixed-nib fact `stroke-width-models.md` §3.4
  establishes from the other direction.
- A soft grey cast shadow travels with the pen, ahead of and around the tip, and
  it is considerably larger than the nib.
- After the pen leaves, the ink does not change. No darkening, no drying, no
  settle. **A "wet ink settles" beat has no support in this reference.**

**When no pen is drawn**, the frontier still should not be a straight cut. A trim
path's frontier is a chord perpendicular to the path, which is the one shape a
nib never leaves; a round cap is the shape a ballpoint leaves and a broad nib does
not. The nib-shaped terminal is a width question and it belongs to
`stroke-width-models.md`. The timing half is simpler and is entirely ours:
**the frontier must be a single point that moves continuously.** Every detached
island in §4.1 is a violation of that and of nothing else.

---

## 5. Is the pen visible?

The brief asked which reads better. I can answer the mechanical half and I will
mark the taste half as a taste call.

**What the reference shows.** In the fountain-pen footage the pen is not merely
visible, it is the largest object in the frame and it hides the newest ink (§4.3).
So the honest statement is not "convincing write-ons show the nib". It is that
**every write-on with no pen is showing a state that never occurs in reality**:
fresh ink in clear air, unoccluded, at the exact instant it is laid.

**What a drawn pen buys us, mechanically:**

1. **It gives the gaps something to do.** §2.4's dead beat disappears the moment
   there is an object to carry across the lift. This is `motion-doctrine`'s carrier
   rule almost verbatim: *"The strongest seams hand a concrete carrier across the
   cut at matched position AND velocity."* Twenty-one lifts, twenty-one carries.
2. **It makes the frontier honest.** A detached island is instantly readable as
   wrong when there is a pen, because the pen is visibly somewhere else. Right now
   the defect is invisible unless you contrast-stretch the frames, which is how it
   survived weeks.
3. **It is the only thing that can express deceleration into a lift.** Ink cannot
   show speed. A moving object can.

**What it costs.** A drawn pen is a second render problem with its own occlusion,
shadow and scale questions, and it competes with the word for attention at exactly
the moment the word is the subject. `less-is-more` applies. And the hero beat has
to hand off from the drawn pen to the 2D→3D transformation, which is a seam that
does not currently exist.

**The recommendation, and it is a recommendation.** Do not draw a pen. Draw the
**pen's shadow**, or a soft occluding mask that travels the path one nib ahead of
the ink. It is one moving soft ellipse. It buys the carrier, the occlusion and the
velocity read, and it costs none of the attention a literal nib costs. The
reference supports it directly: the cast shadow in the footage is larger, softer
and more legible as motion than the nib itself. **This is my call, not a finding,
and it is the kind of pick §2 of `DISPATCH.md` says stays open for Sebs.**

---

## 6. Why `stroke-dasharray` and trim path look fake, precisely

This is the deliverable. Three mechanisms, ranked by how much each contributes.

### 6.1 The rate has no local structure, and averaging is why nobody notices

A trim path is `t → (start, end)`, one monotone parameter over one path, shaped
by one easing curve. Everything it can express about pacing is in that curve.

Averaged over a character, that is very nearly right. Resampling all 2,858 UCI
characters onto a common time axis and averaging their time→length curves:

```
 t:      0.00   0.10   0.20   0.30   0.40   0.50   0.60   0.70   0.80   0.90   1.00
 real:  0.001  0.053  0.184  0.296  0.416  0.524  0.625  0.744  0.851  0.931  1.000
 const: 0.000  0.100  0.200  0.300  0.400  0.500  0.600  0.700  0.800  0.900  1.000
 delta:+0.001 -0.047 -0.016 -0.004 +0.016 +0.024 +0.025 +0.044 +0.051 +0.031 +0.000

max |real - const| over the whole curve: 0.052 at t = 0.78
```

**5.2%.** A gentle ease-in-out reproduces the mean curve of real handwriting to
within a twentieth of the word. That is why "add easing" keeps being proposed and
keeps not working.

Now the same measurement per sample, on its own curve rather than on the average:

```
PER-SAMPLE max |time->length curve - constant speed|
  n=2858  mean=0.1382  median=0.1293  p10=0.0682  p90=0.2235  max=0.3483
```

**Median 12.9%, p90 22.3%, max 34.8%, two and a half times the mean-of-curves
figure.** The averaging cancels because each character's dwells and dashes land in
a different place. That cancellation is precisely the operation a single easing
curve performs.

So: **a trim path is not too fast or too slow. It is right on average and wrong at
every instant.** The missing content is §3.1's 3.4 accelerate-decelerate cycles
per character at a 130 ms period, with the pen dropping to 5.4% of its mean speed
at the corners and spending 9% of its time below a quarter of mean. One easing
curve has one such cycle. A linear one has none.

This is `timing-mastery`'s rule stated as a measurement: *"Timing is relative.
Fast only feels fast next to slow."* A trim path has no next-to.

### 6.2 It cannot lift the pen

A trim path's revealed region is a connected interval of the path, by definition.
`[0, p]` on one path, `[start, end]` at best. There is no way to express "no ink
is being laid right now, and the pen is over there."

The consequences, in order of how badly they read:

- **The word becomes one continuous extrusion.** Every letter grows out of the
  previous letter's last point. A hand lifts 21 times in this word.
- **The gaps have to be faked by concatenating paths**, at which point the tool is
  no longer doing the animating and the practitioner is hand-timing 22 tweens.
- **Nothing decelerates into a lift.** Measured on real data (§2.3), the pen leaves
  the page at 0.485 of its own mean speed. A trim path's rate at a letter boundary
  is whatever the global curve says, which is usually its maximum, because letter
  boundaries cluster in the middle of the word.

Note that this is a *stronger* objection than 6.1 for a whole word and a *weaker*
one for a single glyph. Which one dominates depends on how much of the subject is
one continuous stroke.

### 6.3 Its order is contour order, not ductus

`getTotalLength()` walks the `d` attribute. For a traced SVG that is the order the
tracer emitted contours. For an outlined font it is the order the outline is
stored in, which for a letter with a counter is "outer contour, then inner
contour", so an `o` writes its outside and then its inside, which no hand has
ever done. For a stroke-based path it is whatever the drawing tool recorded.

None of those is ductus. **A trim path always animates the order the file happens
to be in.** Ours is the traced order (§0.2), which at least came from a human
drawing, and it still goes backwards six times.

### 6.4 What this means for us

We are not using `stroke-dasharray`. We use `setDrawRange` over an index buffer
counting-sorted by arc length (`lib/pen-reveal.ts` header). **That is a trim path
in a different representation**, and it inherits 6.2 and 6.3 exactly. What it does
NOT inherit is 6.1: the pen clock is a real ΣΛ reconstruction, and §3.3 confirms
it is well-tuned. We already fixed the hardest of the three and it did not help
enough, because the other two are still there.

That is the whole answer to "we failed for weeks getting it right." The weeks went
into 6.1, which was the interesting problem. The complaint is 6.2 and 6.3, which
are the boring ones.

---

## 7. Ranked: what to change

Ordered by measured effect on the complaint, divided by cost.

1. **Drop the nine sub-nib strokes.** One filter, one threshold, one line. It
   removes 2,289 ms of dead clock (13.6% of the record), removes the mechanism
   that puts detached dots in clear air, and removes the nine identical 241 ms
   durations that are the regularity tell. **Nothing else on this list is close on
   either axis.** Threshold: one nib diameter, which is already in scope as
   `HERO_INK_WIDTH_PX`.
2. **Give the lifts a real distribution.** Replace `MS_GAP_BETWEEN_STROKES = 60`
   with the three-tier band of §2.4 (90–150 within a letter, 150–300 between
   letters, 300–600 between words), drawn from **one per-instance seed shared by
   every gap**, per the shared-draw rule (`handwriting-variability.md:31-32`). The letter map exists
   (`lib/hero-letters.ts`). This is the largest change to how the beat *feels* per
   line of diff.
3. **Fix the order.** Sort the surviving strokes into writing order and fix the
   six backward pen-downs. Cheap version: stable sort by letter, then by
   within-letter ductus for the six letterforms in the word. Expensive version:
   re-record (§1.2), which subsumes items 1, 2, 3 and 5 at once.
4. **Stop compressing past the movement-time floor.** The repo's own gate already
   fails: 66.9 ms for the shortest stroke against the literature's 100 ms floor.
   ⚠ **Item 1 does NOT fix this**, and I checked rather than assuming: stroke 15
   is a real 173.6-unit stroke that also takes 241.1 ms, so it survives the stub
   filter and still renders in 66.9 ms at 3.60×. The instrument already prints the
   answer, *"draw beat that would clear it, SHORTEST stroke: 6.971 s"*, against the
   current 4.667 s. Either lengthen the beat or accept the failure explicitly. Do
   not close the gate by deleting its subject.
5. **Make the gap carry something.** The shadow-only pen of §5, or any carrier.
   This is where the "it writes in like ass" feeling most likely lives once 1–3
   are done, and it is the one item on this list that is a taste call rather than
   a defect.
6. **Deepen the velocity bells.** Ours are peak/mean 1.459 at the flattest; the
   measured human median is 2.196. There is room, and `sigma` is the knob, and it
   is currently at 0.243 in a 0.1–0.45 window. Small effect, near-zero cost, do it
   last so it is tuned against a beat that is otherwise correct.
7. **A `nearestIndex` audit.** Not established as a live defect (§4.2) and my
   control could not reproduce it. Worth ten lines that count, per surface vertex,
   whether `nearestIndex` disagrees with the generating capsule by more than one
   bucket. If the count is zero on the hero word, close the question.

---

## 8. Dead ends, and why

- **Adding an easing curve to the draw-in progress.** §6.1, measured: the mean
  curve of real handwriting is within 5.2% of linear. An easing curve is the
  operation that produced that 5.2% figure by cancelling the structure that
  matters. It cannot put the structure back.
- **A curvature→speed term.** §3.2, measured: β = 0.175 with R² = 0.31, against a
  predicted ⅓. And `handwriting-variability.md:233` already says the coupling
  comes free from ΣΛ and adding it would double-count.
- **Per-stroke jitter on `mu` or `sigma` to break the eight identical durations.**
  Forbidden in terms by `handwriting-variability.md:258-260` ("neuromuscular
  *system* parameters — they belong to the writer, not the stroke"), and
  Carmona-Duarte's timing jitter `eps_t` is 0 for adults. Delete the stubs
  instead; that is where eight of the nine 241 ms strokes come from.
- **Per-gap random lift durations.** Same rule from the other side. One draw per
  instance, shared, with the tier chosen by the letter map. Independent per-gap
  randomness is the noise failure the sibling doc names as the most common one.
- **Making the trailing edge do the work** (un-drawing, travelling windows,
  Blender's Shrink/Vanish). `stroke-animation-toolsets.md` covers the reveal-as-a-
  window finding and it is a good one, but it is orthogonal to this complaint. A
  window with no lifts and the wrong order reads exactly as wrong as a prefix with
  no lifts and the wrong order.
- **A wet-ink settle or dry-down beat.** §4.3: I watched 392 frames of a real
  fountain pen and the ink does not change after the pen leaves. If we want one it
  is an invention, and it should be argued for as one.
- **Drawing a literal nib.** §5. My recommendation is the shadow, and the
  reasoning is that the shadow carries the same three mechanical benefits at a
  fraction of the attention cost.

---

## 9. What I could not verify

Listed because a documented gap is worth more than a confident sentence.

**The gathered `duc-*`, `tp-*` and `pen-*` text files are summaries, not sources.**
Every one is about 2 KB, carries a `SOURCE_URL` and `HTTP_OK: yes` header, and
contains the gathering agent's own prose under its own headings; one of them ends
with a section of the agent's opinion set under the source's name. I caught this
by looking at the file sizes, and I have written `_raw/_PROVENANCE-WARNING.txt`
next to them. **Nothing in this document is sourced to one of them.** Where I
needed a number from that set I re-fetched the page myself; that is what
`VERIFIED-pmc9853007-handwriting-pauses.txt` is.

**I have not read a Latin-alphabet ductus chart first-hand.** §1 therefore states
the CJK case, where I have the real KanjiVG file, and states that no
machine-readable Latin equivalent exists, and claims nothing about what Palmer or
Zaner-Bloser actually specify per letter. The Zaner-Bloser chart is a PDF the
gatherer could not parse. Getting one real chart would let §7 item 3 be specified
per letter instead of hand-waved.

**The pen-lift percentages in §2.3 are from doodling, not writing.** Quick, Draw!
under a 20-second timer with a finger. I flagged it inline. The Latin-handwriting
inter-letter numbers (90 / 155 ms) are from a source I read, but they are Kandel
et al. 2008 *as quoted by* the 2023 paper, and I did not read Kandel. The
recommendation in §2.4 is built on both and is a recommendation.

**The UCI velocity data is one writer.** 2,858 samples, one hand, one tablet,
Gaussian-smoothed by its authors at σ = 10 ms. Every number in §3.1 and §3.2 is
one person's motor system. The peak counts per letter are so cleanly structured
that I do not think they are idiosyncratic, but I have not checked a second writer.

**`ndollar.zip` and `mmg.zip`** (Wobbrock's $N multistroke gesture data, real
stylus, real timestamps, multi-stroke) are downloaded and verified as real zips
in `_raw/`, and **I did not open them.** They would give pen-lift intervals for
real stylus input on letterform-like shapes, which is the exact gap in §2.3.
That is the cheapest next measurement anyone can make here.

**The `nearestIndex` question is open, not closed.** §4.2. My positive control
returned zero on both keys, which means my test path was not adversarial enough,
not that the rule is safe. §7 item 7 is the ten-line check that would settle it.

**I did not capture a reference software write-on frame by frame.** The lane that
was going to download Lottie/GSAP/AE demo media was blocked by the fan-out gate
and I did the video work myself, which got me real handwriting but not a reference
animation. So §6 is argued from mechanism and from our own measured frames, not
from a side-by-side against a good software write-on. If someone wants that
comparison it is an hour.

---

## Sources

**Data I downloaded and measured myself** (all under `write-on-references/_raw/`)

- [UCI Character Trajectories](https://archive.ics.uci.edu/static/public/175/character+trajectories.zip). Ben H Williams, University of Edinburgh. 2,858 samples, 20 classes, one writer, WACOM, 200 Hz, pen-tip velocity. `uci-ct/mixoutALL_shifted.mat`. All of §3.1, §3.2, §6.1.
- [Quick, Draw! raw](https://storage.googleapis.com/quickdraw_dataset/full/raw/face.ndjson). Google. 6 MB slice, 1,479 recognised multi-stroke drawings with millisecond timestamps. All of §2.3.
- [*Writing with fountain pen*](https://upload.wikimedia.org/wikipedia/commons/7/73/Writing_with_fountain_pen.mpg). Wikimedia Commons, CC BY-SA 4.0. 1886×964, 25 fps, 15.68 s, 392 frames extracted. All of §4.3 and §5.
- [KanjiVG 04e00.svg](https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/04e00.svg). The real file, §1.

**Papers I fetched and read** (extracted text saved, not summarised)

- [*In a split second: Handwriting pauses in typical and struggling writers*](https://pmc.ncbi.nlm.nih.gov/articles/PMC9853007/). Frontiers in Psychology / PMC9853007. §2.2. Quotes within it: Kandel et al. 2008 (90 / 155 ms), Prunty et al. 2014 (the four pause bands), Soler-Vilageliu & Kandel 2012.

**Our own code and artefacts**

- `docs/verification/writein-2026-08-28/seq/000..029.png`. The filmed write-in. §0, §4.1.
- `scripts/capture/logo-strokes.json`. The traced word. §0.1, §0.2.
- `lib/pen-reveal.ts`. `MS_GAP_BETWEEN_STROKES` at `:1240`, `timeStrokesByPenModel` at `:1276-1310`.
- `lib/pen-kinematics.ts`. `T = 2 e^mu sinh(3 sigma)` at `:604`, the writer-level argument at `:597-603`.
- `lib/implicit-surface.ts:1215`. The `nearestIndex` vertex key. §4.2.
- `scripts/verify/measure-drawin-pacing.mjs`. The repo's own pacing instrument, with a calibration control. §0.3.

**Sibling docs**

- [`handwriting-variability.md`](handwriting-variability.md). The shared-draw rule (`:31-32`), the admissible ranges (`:123-128`), "regularity is the tell" (`:41-43`), the power-law warning (`:199-202`), the what-not-to-do list (`:258-260`).
- [`stroke-width-models.md`](stroke-width-models.md). The width half. The fixed-nib finding at `:938-951` is the one place the two docs touch.
- [`stroke-animation-toolsets.md`](stroke-animation-toolsets.md). What other tools expose, including the reveal-as-a-window finding.

**Reference files that are NOT sources.** `_raw/duc-*.txt`, `_raw/tp-*.txt`,
`_raw/pen-*.txt`. See `_raw/_PROVENANCE-WARNING.txt`. They are pointers to URLs.
Re-fetch before quoting. The real artefacts among the gathered set are
`pen-perfect-freehand-source.ts`, `pen-hobby-rasterizing-curves.pdf`,
`pen-kilgard-polar-stroking.pdf` and `duc-kanjivg-example-04e00.svg`.

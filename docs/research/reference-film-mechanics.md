# Reference film mechanics — measured

*The three Desk Doodles reference films, read frame by frame: where every cut
lands, how long every hold runs, how transits start and stop, and where each
beat's accent falls. Timing and staging you can build from — not adjectives.*

**Source films** (read-only, 1200×674):
`desk-doodles/docs/refs/videos/{exquisite-corpse,babbu,doodle-fonts}.mp4`
— 40.0 s @ 24 fps · 39.0 s @ 23.976 fps · 35.0 s @ 30 fps.

**Frame evidence:** [`verification/reference-films/`](../verification/reference-films/) —
21 labelled contact sheets, every tile stamped with its exact timestamp and
source frame number. **Read them alongside this.** Tools to regenerate:
[`verification/reference-films/tools/`](../verification/reference-films/tools/).

**What is being measured against:** `desk-doodles/docs/submission/VIDEO-DIRECTION.md`
§1 and `CRAFT-VISUAL-PASS.md` §1–§2, which describe these films but were written
from frame dumps that were later lost. Several of their claims do not survive
contact with the footage. Those corrections are §2, flagged rather than smoothed
over, because at least two of them are the reason our hero beat is built the way
it is.

---

## 0. Method, and what "measured" means here

The 1 fps sweeps on disk are far too coarse to read craft — a 1 fps sample can
miss an entire 250 ms transition. Everything below is measured at **native frame
rate** from the source files.

| Quantity | How |
|---|---|
| `mad` | mean absolute frame-to-frame difference on a 600×336 greyscale reduction, 0–255 scale. The primary motion signal. |
| `hcorr` | 16-bin luminance-histogram correlation between adjacent frames. Breaks (< 0.95) mark a *content replacement* rather than motion. |
| `dx, dy, peak` | global translation by phase correlation, plus its confidence. Detects pans/dollies/drift. |
| `resid` | `mad` recomputed after compensating `dx, dy`. If `resid ≈ mad`, the change is **not** a camera move. |
| `cells` | 10×6 grid; count of cells whose own mad > 1.5. "How many separate things are moving." |
| bboxes | thresholded extents (paper > 225, ink < 140–150) tracked per frame, for scale/position curves. |

**Estimates are marked.** Curve character (ease-in / ease-out / spring) is
*inferred from frame spacing* — the per-frame deltas of a tracked bbox — and the
inference method is stated at each point. Where a fit is quoted (a spring's
damping ratio, a settle's time constant), it is labelled as a fit with its
residual behaviour described. Durations, cut times and stagger intervals are
direct reads and are not estimates.

**Working resolution is 600×336**, half the source. Pixel figures are given in
that space unless marked "source px"; multiply by 2 for source.

**No playback was used.** The films were read as dense per-frame sweeps plus the
numeric series above, which is strictly more precise than watching, and is why
every number here has a frame number attached.

---

## 1. The one-paragraph answer

> **These films are slideshows.** 61 % of all reference footage (1798 of 2942
> frames) is a *held frame*. Two of the three have essentially no camera motion
> anywhere; the third has none at all. Babbu's "reveal cascade" is eleven
> single-frame pops separated by 460 ms of pixel-identical stillness, with **zero**
> scale animation on any element. Doodle Fonts is one 26-second locked-off take.
> Exquisite Corpse's payoff is set up by **cutting to an empty field and holding
> on nothing for 625 ms**. What reads as craft in all three is *rhythm and
> stillness*, not motion polish — and where motion is used it is used once, hard,
> and then stopped.

And the spacing result, which is the most directly actionable number in the
document (§6.5):

> **No move in the reference set is spaced evenly.** Of 22 measurable transits,
> the only four whose breakdown falls anywhere near 50 % are opacity fades with
> no pose to break down. Everything with a silhouette is either an **arrival**
> (breakdown at 9–37 % of the move) or a **wind-up** (79–93 %). Our beat's
> breakdown sits at **42 %** — in the gap, spaced like a crossfade.

Per film:

| | held | hard cuts | camera moves | mean shot |
|---|---|---|---|---|
| Exquisite Corpse | **39 %** (370/959 fr) | 14 in the authored 36.4 s (1 per 2.6 s) + 4 inside the supplied Config sting | none | 2.4 s |
| Babbu | **65 %** (610/934 fr) | **3** in 39 s | 3 identical lateral slides, 33.5–36.1 s | 6.5 s |
| Doodle Fonts | **78 %** (818/1049 fr) | **1** in 35 s | one 1.1 s scale-down, 27.7–28.8 s | 8.75 s |

---

## 2. Corrections to Desk Doodles' own craft docs

Each of these is a documented claim about these three films that the footage
does not support. They are listed worst-first by how much they have shaped our
own build.

### 2.1 ✗ "Two motion timescales at once: a slow continuous drift/Ken-Burns UNDER fast per-element pops. The frame is never static."

*(VIDEO-DIRECTION §1; CRAFT-VISUAL-PASS §1C; actioned as A2 "Ken-Burns")*

**There is no Ken-Burns anywhere in any of the three films.** Not slow, not fast,
not at all.

The test: take each still passage, and find the best whole-frame translation
(±8 px search) and the best uniform scale (0.97–1.03) that maps its last frame
onto its first. A genuine Ken-Burns over 2–4 s needs ≥ 4 px or ≥ 1 % scale.

```
EXQUISITE-CORPSE
  Dali long hold (4.15s)      adj-frame mad 0.228 | best shift (+0,+0)px | best scale 1.0000
  browser doodle (1.75s)      adj-frame mad 0.081 | best shift (+0,+0)px | best scale 1.0000
  origami hold (1.5s)         adj-frame mad 0.211 | best shift (+0,+0)px | best scale 0.9950
BABBU
  title card (3.35s)          adj-frame mad 0.002 | best shift (+0,+0)px | best scale 1.0000
  object field (2.5s)         adj-frame mad 0.001 | best shift (+0,+0)px | best scale 1.0000
DOODLE-FONTS
  editor idle (6.6s)          adj-frame mad 0.078 | best shift (+1,+0)px | best scale 1.0075
  editor idle 2 (7.8s)        adj-frame mad 0.025 | best shift (+0,+0)px | best scale 1.0000
```

Zero in every case. Babbu's holds are **bit-identical** — adjacent-frame mad of
0.001–0.002 is the encoder, not content. Doodle Fonts' `1.0075` is the drawing
inside the app changing, not the frame moving.

This matters directly. The hero-beat diagnosis in
[`hero-beat-storyboard.md`](../hero-beat-storyboard.md) is "4.43 s of orbit with
9 px of lateral creep… 45 % of the runtime is drift". That drift was put there on
the authority of this claim. **The references do the exact opposite: they park
the camera and let one thing move.**

**What the claim was probably reaching for, and it is real:** two of the films
do run a second, faster timescale *underneath* — but it is a texture, not a
camera.

- **Exquisite Corpse, 20.13–21.04 s (the payoff hold).** The frame is otherwise
  dead. Every **6 frames — 250 ms, 4 Hz** — the drawing is re-rendered as a
  slightly different variant. Ink centroid oscillates ±2 px about a fixed mean
  (cy 160.34 → 158.28 → 160.59 → 160.32) with **zero net displacement** over
  1.08 s; ink mass varies 2356↔2397 px (±0.9 %). Not a shift — the lines are
  genuinely redrawn ([`07-ink-boil-4hz-24fps.png`](../verification/reference-films/exquisite-corpse/07-ink-boil-4hz-24fps.png),
  compare f488/f489 and f494/f495). This is a **hand-drawn boil on a locked
  frame**, and it is confined to that shot — autocorrelation of the change signal
  peaks at lag 6 with +0.78 there and nowhere else in the film.
- **Doodle Fonts, 27.67–28.80 s.** A physical stamp tile shrinks steadily from
  179 px wide to 119 px over 33 frames — a constant **−1.23 % per frame**
  exponential scale-down — while the *tile itself swaps every 7 frames
  (233 ms)*. This is the only genuine two-timescale construction in the whole
  reference set: a slow continuous ramp under a metronomic swap. It lasts 1.1
  seconds.

### 2.2 ✗ "Cuts land on motion, never on stillness."

*(VIDEO-DIRECTION §2, editing grammar)*

Two problems. First, there are barely any cuts to generalise from: **22 hard
cuts across 114 seconds of film** — 18 of them authored, since 4 belong to the
supplied Config sting. Doodle Fonts has one. Babbu has three. All the rest are
Exquisite Corpse's.

Second, where cuts exist the rule is broken, including at the most important cut
in the reference set. For each cut, the mean mad of the 6 frames *before* and
*after*:

```
EXQUISITE-CORPSE
   CUT @   frame     mad  hcorr | OUTGOING tail          | INCOMING head
   5.417s    130    27.4  0.249 |  6.883 MOVING          |  8.666 MOVING
   7.500s    180    27.0  0.796 | 16.982 MOVING          |  4.948 MOVING
  11.042s    265    37.5  0.701 |  0.052 STILL           |  0.097 near-still
  16.542s    397    57.0  0.420 |  0.231 near-still      |  0.000 STILL      <-- the reveal
  21.083s    506   184.1 -0.088 |  0.335 near-still      |  1.551 MOVING
  26.500s    636   132.1  0.026 |  0.466 near-still      |  3.262 MOVING
  30.417s    730    24.5  0.938 |  0.033 STILL           |  3.557 MOVING
  32.792s    787   100.2  0.392 |  1.667 MOVING          |  6.525 MOVING
BABBU
  19.895s    477    29.4  0.035 |  1.109 MOVING          |  0.022 near-still
  38.121s    914   223.2 -0.076 |  0.002 STILL           |  0.000 STILL
```

**5 of Exquisite Corpse's 8 measurable cuts leave a still or near-still frame.**
Babbu's final cut is dead still on both sides. And the cut *into* the film's
payoff — 16.542 s — leaves a shot that has been frozen for 4.29 seconds and
arrives on a frame with literally nothing in it.

The pattern that *is* there, and it is a better rule than the one written down:
**a cut is preceded by a hold.** Nine of the eighteen cuts are immediately
preceded by a hold of ≥ 250 ms. The film stops, then cuts. It does not cut
through a move.

### 2.3 ✗ "One-element-at-a-time reveal cascade **with a slight scale-overshoot/settle**."

*(VIDEO-DIRECTION §1; CRAFT-VISUAL-PASS §1C; actioned as A3)*

The cascade is real and beautifully timed (§5). **The scale-overshoot does not
exist.** Every element in Babbu appears in a single frame at final size and is
then pixel-frozen:

```
SHOES object pop        ROI x60-210 y170-290
frame     t      darkpx  bbox(w x h)   mad-vs-prev
  155   6.465       0     -              0.000
  156   6.506    6500  127 x  95        33.096     <-- fully present, one frame
  157   6.548    6500  127 x  95         0.003
  ...   ...      6500  127 x  95        <0.06      (frozen for 11 frames)
DOG object pop
  219   9.134       0     -              0.000
  220   9.176    6729  108 x 107        39.508     <-- one frame
  221+  ...      6729  108 x 107        <0.06
```

No growth, no overshoot, no settle — [`03-object-pop-24fps.png`](../verification/reference-films/babbu/03-object-pop-24fps.png).
Exquisite Corpse's archival-card cascade does settle, but by ≤ 2.5 % in *area*
(≈ 1 % linear), which is at the measurement floor and reads as a settle, not an
overshoot. The one genuine, large overshoot in the reference set is Exquisite
Corpse's title — §7 — and it is +40.6 %.

### 2.4 ✗ "Babbu's baby-word → real-word **width-tween** IS the product thesis made visible."

*(CRAFT-VISUAL-PASS §1D; VIDEO-DIRECTION §1)*

There is no tween. The word chip swaps in one frame, 42 ms:

```
WATERMELON label   ROI x430-580 y90-140
  336  14.014    1183  105 x  30   mad 0.002
  337  14.056    1183  105 x  30   mad 0.006
  338  14.097    1276  130 x  31   mad 31.989   <-- "xia" -> "sindria/watermelon"
  339  14.139    1276  130 x  31   mad 0.031
```

[`04-label-swap-24fps.png`](../verification/reference-films/babbu/04-label-swap-24fps.png)
shows it: `xia` at f336, `síndria/watermelon` at f337, nothing between. The
thesis *is* made visible — but by **rhythm**, not by animation: the field sits
completely frozen for 2.59 s after the last object lands, and *then* the words
start flipping, six of them, accelerating (792 → 501 → 458 → 334 → 334 ms).
The stillness before the flip is what makes the flip land.

### 2.5 ✗ "Reward beat sized to the achievement (confetti for the full flow)."

*(VIDEO-DIRECTION §1; actioned as A4 "ink-confetti reward beat")*

**There is no confetti in Babbu.** Scanning the whole film for frames where many
regions move at once (≥ 25 of 60 cells) returns seven segments, all of them
transitions:

```
BABBU — many regions moving at once
    4.505 ->  4.713s  (250 ms)  peak cells 60/60   [title -> object field dissolve]
   16.350 ->  16.350s ( 42 ms)  peak cells 60/60   [hard cut]
   16.975 ->  17.726s (792 ms)  peak cells 33/60   [3-phone shot settling]
   19.895 ->  19.895s ( 42 ms)  peak cells 60/60   [hard cut]
   33.533 ->  34.284s (792 ms)  peak cells 32/60   [dolly slide 1]
   36.578 ->  36.870s (334 ms)  peak cells 60/60   [dissolve to outro]
   38.121 ->  38.121s ( 42 ms)  peak cells 60/60   [hard cut to black]
```

What Babbu actually does on completion (31.6–33.5 s,
[`05-save-beat-12fps.png`](../verification/reference-films/babbu/05-save-beat-12fps.png))
is: the word card changes **colour** from blue to green in one frame at 32.43 s,
the "Save/Cancel" row is replaced by "Edit Word / Remove Word", and the card
grows to fill more of the screen. That is the whole reward. It is a state change
held for 1.0 s, not a particle effect.

### 2.6 ✗ "The film is ONE WORLD. Same palette, same paper, same ink, same hand — title card → every UI surface → outro."

*(VIDEO-DIRECTION, stated as the rule above all others, attributed to both refs)*

Modal background colour per shot, from the RGB frames:

```
EXQUISITE-CORPSE                        dur     modal      hue/sat/val
  title on ochre                       2.20s  #F8C868    40deg 0.58 0.97
  archival cards on ochre              3.00s  #F8C868    40deg 0.58 0.97
  Dali at computer (live action)       2.05s  #F8C878    38deg 0.52 0.97
  app lobby card on ochre              1.10s  #F8C868    40deg 0.58 0.97
  browser draw canvas                  2.10s  #F8C868    40deg 0.58 0.97
  paper close-up: head                 0.55s  #F8F8F8     0deg 0.00 0.97
  Dali at desk (live action)           4.25s  #F8F8F8     0deg 0.00 0.97
  ASSEMBLED FIGURE                     3.85s  #F8C868    40deg 0.58 0.97
  Figma Make prompt (dark UI)          5.35s  #181818     0deg 0.00 0.09   <--
  Figma Make build + canvases          6.20s  #F8C868    40deg 0.58 0.97
  sofa (live action)                   3.50s  #F8F8F8     0deg 0.00 0.97   <--
  Config Makeathon sting               3.55s  #485858   180deg 0.18 0.35   <--
```

Exquisite Corpse is a **Figma Make submission film**, and it visits four
distinct grounds: warm ochre (≈ 46 % of runtime), white paper, a near-black
product UI (`#181818`, 5.35 s), and a supplied blue/green Config sting (3.55 s,
9 % of the film) with its own palette and its own type. It also cuts twice into
photographic live-action stock (5.4–7.5 s at a computer, 32.8–36.4 s on a sofa).
[`00-overview-2fps.png`](../verification/reference-films/exquisite-corpse/00-overview-2fps.png)
shows the whole thing at a glance.

Babbu *is* close to one world (cream `#F8F8E8` → white → lavender-white
`#E8E8F8` → cream), and Doodle Fonts genuinely is one — `#F8F8F8`, one ground,
35 seconds, no exceptions. **The claim is true of the film the doc names least,
and false of the film it names first.**

### 2.7 ✗ "Camera pans down the sheet between beats rather than cutting; the paper stays continuous."

*(refs/README.md, on Exquisite Corpse)*

There is no pan anywhere in Exquisite Corpse. Between the head close-up
(11.04 s) and the torso close-up (11.67 s) — the two shots this claim would have
to describe — there is a **hard cut**: mad 18.6, hcorr 0.701, one frame. The
paper is not continuous; it is re-framed by cutting, twice, and both cuts leave
a still frame.

### 2.8 ✗ "The wordmark + chrome animate from a sans INTO the doodle font being made."

*(CRAFT-VISUAL-PASS §5, on Doodle Fonts — cited as the strongest possible version of A5)*

Backwards at both ends
([`01-open-15fps.png`](../verification/reference-films/doodle-fonts/01-open-15fps.png),
[`03-wordmark-resolve-15fps.png`](../verification/reference-films/doodle-fonts/03-wordmark-resolve-15fps.png)):

- **Opening (0.23–0.73 s):** the wordmark is in the doodle font from its first
  visible frame. It *assembles glyph by glyph* — `D  f  s` → `D  e f  s` →
  `D  le fo  s` → `D odle fon s` → `Doodle fonts` — seven events over 500 ms.
  There is no sans at any point.
- **Closing (32.30–34.60 s):** the doodle wordmark **resolves into a plain
  sans**. 35 discrete glyph events over 2.30 s, median gap 2 frames (67 ms),
  most affecting a single ~20 px glyph slot at a time, converging on
  `Doodle Fonts` in a neutral grotesque at 34.60 s, then held dead still for
  400 ms to the end of the film.

The film's actual gesture is **doodle → neutral**, immediately after the line
"design matters now more than ever". That is a different and arguably better
idea than the one in the doc: it hands the artifact back to plain type at the
end, rather than converting plain type into the artifact.

### ✓ What does hold up

- **"Type breathes on entry"** — true, and it is a real damped spring, measured
  in §7. Exquisite Corpse only.
- **"One-element-at-a-time reveal cascade"** — true, in all three films, with
  very consistent intervals (§5).
- **"Crossfade-through-white between scenes"** — true in Babbu, twice, and now
  measured (§6.3). Not present in the other two.
- **"The product's core idea IS the hero motion beat"** — true in structure. In
  Exquisite Corpse the assembly *is* the payoff; in Babbu the word-flip *is* the
  thesis. But in both cases the "motion beat" is a **cut and a hold**, not an
  animation.
- **"Surgical realism"** — true. Babbu's phone shots carry a live status bar
  with a red recording dot and a real clock (16:41 → 16:33), visible in
  [`05-save-beat-12fps.png`](../verification/reference-films/babbu/05-save-beat-12fps.png).

---

## 3. Shot tables

Times are the first frame of each shot. `→` = hard cut unless marked.

### 3.1 Exquisite Corpse — 40.0 s, 24 fps

| # | in | out | dur | what | transition in | held? |
|---|---|---|---|---|---|---|
| 1 | 0.000 | 2.250 | 2.25 s | title "Exquisite Corpse" springs on to ochre | (film start) | settles 2.08 s |
| 2 | 2.250 | 4.417 | 2.17 s | 4 archival corpse drawings fan in over the title | element cascade | — |
| 3 | 4.417 | 5.417 | 1.00 s | cards fill frame / take over | scale-up | — |
| 4 | 5.417 | 7.500 | 2.08 s | Dali actor at a computer (live action, ochre-graded) | → | none |
| 5 | 7.500 | 8.775 | 1.28 s | app lobby card on ochre; player rows cascade in | → | 0.71 s |
| 6 | 8.775 | 11.042 | 2.27 s | browser + draw canvas — **one section only** (the masked seam) | → then 292 ms scale-in | 1.92 s |
| 7 | 11.042 | 11.667 | **0.63 s** | paper close-up, deckled edge: the coloured head | → | 0.58 s |
| 8 | 11.667 | 12.208 | **0.54 s** | paper close-up: the suit/torso section | → | 0.33 s |
| 9 | 12.208 | 16.542 | **4.33 s** | Dali at a desk, drawing beside him (live action) | → | **4.29 s dead** |
| 10 | 16.542 | 17.167 | **0.63 s** | **EMPTY OCHRE — nothing on screen** | → | 0.58 s at mad 0.000 |
| 11 | 17.167 | 21.083 | 3.92 s | **THE ASSEMBLED FIGURE** — pop-in, settle, 3 staggered section swaps, final hold | pop-in at 86 % scale | see §4 |
| 12 | 21.083 | 25.333 | 4.25 s | Figma Make prompt, dark UI; prompt types in | → | 2.00 s + 0.71 s + 0.38 s |
| 13 | 25.333 | 26.483 | 1.15 s | code + live preview | → | — |
| 14 | 26.483 | 28.417 | 1.93 s | zoom out of the browser chrome into the ochre world | → then 292 ms scale | 0.54 s + 0.25 s |
| 15 | 28.417 | 30.417 | 2.00 s | the corpse placed on the ochre wall | → | 0.96 s |
| 16 | 30.417 | 32.792 | 2.38 s | white canvas, an origami-style figure | → | 0.58 s + 1.58 s |
| 17 | 32.792 | 36.417 | 3.63 s | three people on a sofa with phones (live action) | → | none |
| 18 | 36.417 | 40.000 | 3.58 s | **Config Makeathon sting** (supplied; blue/green; 4 internal cuts) | → | none |

**14 cuts in the authored 36.4 s = 1 per 2.6 s.** The two 0.5–0.6 s close-ups
(#7, #8) are the only short shots in the film; everything else is ≥ 1 s, and the
two longest — #9 at 4.33 s and #11 at 3.92 s — bracket the payoff.

### 3.2 Babbu — 39.0 s, 23.976 fps

| # | in | out | dur | what | transition in |
|---|---|---|---|---|---|
| 1 | 0.000 | 4.421 | 4.42 s | title card; wordmark + shapes fade up in 125 ms, phone fades in 0.751–0.959, then **frozen for 3.46 s** | 125 ms opacity |
| — | 4.421 | 4.755 | 0.33 s | **dissolve up through near-white** (Y 224.9 → 248.4 over 7 frames) | dissolve |
| 2 | 4.755 | 16.350 | 11.60 s | the object field: 11 single-frame pops, then a 2.59 s freeze, then 6 label flips | — |
| 3 | 16.350 | 19.895 | 3.55 s | three phones; 1.5 s of settling, then holds | → (from a frozen frame) |
| 4 | 19.895 | 33.533 | 13.64 s | single phone product shot, screen recording; 14 holds inside it | → |
| 5 | 33.533 | 36.078 | 2.55 s | **3 identical lateral slides** across three phones, 1.06 s cycle | → |
| — | 36.078 | 36.578 | 0.50 s | fade out to near-white (ease-out) | dissolve |
| — | 36.578 | 36.870 | 0.29 s | fade in to the outro card (ease-in) | dissolve |
| 6 | 36.870 | 38.121 | 1.25 s | outro card — **bit-identical for 1.21 s** | — |
| 7 | 38.121 | 39.000 | 0.88 s | **black** | → **hard cut, not a fade** |

Six shots in 39 seconds. Note #7: `VIDEO-DIRECTION` calls for "fade-to-black at
the end". Babbu **cuts** to black (mad 223.2, hcorr −0.076, one frame) after
1.21 s of a frozen card, and holds the black for 0.88 s. None of the three films
fades to black.

### 3.3 Doodle Fonts — 35.0 s, 30 fps

| # | in | out | dur | what |
|---|---|---|---|---|
| 1 | 0.000 | 1.100 | 1.10 s | wordmark assembles glyph-by-glyph on white (7 events, 0.233–0.733 s), then 0.30 s hold |
| — | 1.100 | 1.567 | 0.47 s | scale/dissolve into the app (mad decays 12.2 → 0.3 — ease-out) |
| 2 | 1.567 | 27.633 | **26.07 s** | **the editor — one continuous locked take.** In-app view changes at 23.233 s and 25.400 s; 20 holds inside it, the longest 6.10 s |
| 3 | 27.633 | 28.800 | 1.17 s | physical stamp tiles on a desk — **6 tiles, one every 233 ms**, each shrinking −1.23 %/frame |
| 4 | 28.800 | 30.733 | 1.93 s | "design matters now / more than ever" types on at **5 frames (167 ms) per letter**, second line pops at 30.433 with a 433 ms settle |
| — | 30.733 | 31.700 | 0.97 s | **frozen** |
| 5 | 31.700 | 34.600 | 2.90 s | the line dissolves letter-by-letter, surviving glyphs recompose into the wordmark, which then **resolves into a plain sans** (35 events, median 67 ms) |
| 6 | 34.600 | 35.000 | 0.40 s | "Doodle Fonts" in sans, dead still |

**One hard cut in 35 seconds.** 78 % of the film is held.

---

## 4. Exquisite Corpse's assembled-figure reveal — the deep read

16.500 → 21.083 s. `CRAFT-VISUAL-PASS` calls this the payoff of the film. Frame
evidence: [`04-reveal-A-24fps.png`](../verification/reference-films/exquisite-corpse/04-reveal-A-24fps.png),
[`05-reveal-B-24fps.png`](../verification/reference-films/exquisite-corpse/05-reveal-B-24fps.png),
[`06-section-swaps-zoom-24fps.png`](../verification/reference-films/exquisite-corpse/06-section-swaps-zoom-24fps.png).

### 4.1 What is hidden, and how

The game is exquisite corpse: three players each draw one third of a figure and
can only see their own section. The film sets this up literally, and the "mask"
is a **framing** device, not an effect:

- **8.775–11.042 s** — the browser canvas shows **only the head section**, drawn
  with a red nose. You never see below the fold.
- **11.042–11.667 s** — cut to a paper close-up of the finished head, coloured.
- **11.667–12.208 s** — cut to a paper close-up of the suit/torso. A *different*
  section, no transition, no reveal of how they join.
- **12.208–16.542 s** — the actor at his desk with a sheet beside him, held
  **dead still for 4.29 s** (mean mad 0.230, no camera move at all).

So the seams are hidden by *never showing them* for 7.8 s, and the last thing
before the payoff is the longest, stillest shot in the film. That 4.29 s is the
setup: nothing happens, nothing moves, and the audience has been given three
partial views to hold in their head.

### 4.2 The release, frame by frame

Sheet bbox tracked at 24 fps (paper > 225 on the ochre ground):

```
frame     t       sheet-bbox            w    h    cx     cy    ink
  396  16.500   0,  7,599,335         600  329  299.5 171.0  38584   last frame of the Dali shot
  397  16.542   -- empty ochre --                                    CUT. nothing on screen.
  ...            (15 frames)                                         mad = 0.000 throughout
  411  17.125   -- empty ochre --
  412  17.167   225, 38,374,298        150  261  299.5 168.0   1591  sheet appears at 86% scale
  413  17.208   225, 38,374,298        150  261  299.5 168.0   1591  (duplicate — on twos)
  414  17.250   219, 27,380,308        162  282  299.5 167.5   1986
  416  17.333   217, 24,382,312        166  289  299.5 168.0   2069
  418  17.417   216, 22,383,314        168  293  299.5 168.0   2272
  420  17.500   215, 21,384,315        170  295  299.5 168.0   2304
  422  17.583   214, 20,384,316        171  297  299.0 168.0   2340
  424  17.667   214, 19,385,317        172  299  299.5 168.0   2364
  426  17.750   214, 18,385,317        172  300  299.5 167.5   2370
  428  17.833   214, 18,386,318        173  301  300.0 168.0   2342
  430  17.917   213, 17,386,318        174  302  299.5 167.5   2383  SETTLED
  432+ 18.000   213, 17,386,318        174  302  299.5 167.5   2410  parked to f505
```

**The single most transferable fact in this entire document:**

> **The frame is emptied for 625 ms (15 frames) before the payoff arrives.**
> Not dimmed, not blurred, not crossfaded — cut to a flat ochre field with a
> measured frame-to-frame change of exactly **0.000** for the whole 625 ms.

Then:

- **The sheet does not grow from nothing.** It appears in one frame at **86.2 %
  of final width / 86.4 % of final height** and closes the remaining 14 %.
- **Settle duration 750 ms** (f412 → f430), on a fixed centre (cx 299.5 ± 0.5,
  cy 167.75 ± 0.25) — a pure centred scale, no travel.
- **Ease character: ease-OUT only, no ease-in, no overshoot.** Height deltas per
  2-frame update: `+21, +7, +4, +2, +2, +2, +1, +1, +1, 0`. Monotonically
  decreasing from the very first update; the bbox never exceeds its final size
  in either axis. *Method: remaining-distance-to-target after each update runs
  41, 20, 13, 9, 7, 5, 3, 2, 1, 0 px; ratios of successive remainders average
  0.66 per 83 ms step (excluding the first), i.e. an exponential settle with
  **τ ≈ 200 ms** — a fit, ±30 ms, and the first step is larger than the fit
  predicts.* Practically: **half the remaining distance closes in the first
  83 ms, and 90 % of the visible size change is over within 250 ms** even though
  the settle formally runs 750 ms.
- **It animates on twos.** f412=f413, f414=f415, f416=f417 … Every state is held
  two frames. The whole reveal runs at an effective 12 fps inside a 24 fps film.

### 4.3 On twos — measured across the film

Mean adjacent-frame mad split by frame parity. A ratio ≫ 1 means every second
frame is a duplicate:

```
  title + archival cards 0.3-5.3    even 7.730   odd 0.785   ratio  9.9x   ON TWOS
  Dali typing 5.5-7.6               even 25.690  odd 1.327   ratio 19.4x   ON TWOS
  reveal settle 17.2-18.1           even 2.699   odd 0.658   ratio  4.1x   ON TWOS
  section shuffle 18.2-20.1         even 1.489   odd 0.615   ratio  2.4x   ON TWOS
  sofa live-action 32.9-36.3        even 6.014   odd 4.503   ratio  1.3x   on ones
  Config outro 36.5-39.9            even 7.468   odd 5.507   ratio  1.4x   on ones
```

**Every graphic/animated passage in Exquisite Corpse is on twos; only the
live-action video runs on ones.** That is a deliberate hand-animation cadence and
it is a large part of why the film reads as drawn rather than rendered. It costs
nothing to reproduce: sample the animation clock at 12 Hz.

### 4.4 The shuffle — three staggered section swaps

After the figure settles at 18.000 s, the three thirds of the corpse are
*replaced*, one at a time, bottom to top. Per-band frame-to-frame change inside
the parked sheet (bands read off the settled frame: head y17–115, torso
y115–235, legs y235–319):

```
frame     t         HEAD    TORSO    LEGS
  438  18.250       0.11     0.39     7.71   *      LEGS swap starts
  440  18.333       0.13     0.96    12.00   *
  442  18.417       0.10     0.75    13.81   *
  444  18.500       0.09     0.80    15.51   *      peak
  446  18.583       0.11     0.80    14.39   *
  448  18.667       0.09     0.81    13.37   *
  450  18.750       0.06     0.67    11.10   *
  452  18.833       0.07     0.51     1.19          LEGS done   (583 ms)
  454  18.917       0.10    11.54     0.07   *      TORSO swap starts   (+667 ms)
  456  19.000       0.12    15.57     0.07   *
  458  19.083       0.10    15.34     0.07   *
  460  19.167       0.13    13.82     0.08   *
  462  19.250       0.08    13.19     0.08   *
  464  19.333       0.08    12.11     0.10   *
  466  19.417       0.04     6.00     0.06          TORSO done  (500 ms)
  470  19.583       8.21     1.19    10.33   *      HEAD + LEGS together  (+667 ms)
  472  19.667      11.31     2.29    17.19   *
  474  19.750      11.61     2.39    20.05   *
  476  19.833      12.02     2.73    19.90   *
  478  19.917      11.02     2.53    19.38   *
  480  20.000      10.18     1.94    16.50   *
  482  20.083       5.37     0.73     7.00          done        (500 ms)
  483+ 20.125       parked, 4 Hz boil only, until the cut at 21.083   (958 ms)
```

- **Stagger: exactly 16 frames = 667 ms** between swap onsets. f438 → f454 →
  f470. Not approximately — exactly, twice.
- Each swap runs **500–583 ms**, and every swap updates only on even frames.
- The third beat **doubles up** (head *and* legs simultaneously) while the
  interval stays constant. The rhythm doesn't accelerate; the *content* does.
- Direction is bottom → middle → top: the least important third first, the face
  last.
- Within a band the old section leaves and the new arrives as a **vertical
  slot-machine slide** — the per-band best-match shift saturates the ±26 px
  search range at 12 fps, i.e. > 624 source px/s. Fast enough to read as a wipe,
  not as a scroll.

### 4.5 How long the audience gets to register it

| moment | window | what you can read |
|---|---|---|
| empty field | 16.542 → 17.167 | **625 ms of nothing** |
| pop-in → settled | 17.167 → 17.917 | the figure arriving; 90 % of the scale change is done by 17.42 |
| clean read, assembly 1 | 17.917 → 18.250 | **333 ms fully settled** before anything changes |
| the shuffle | 18.250 → 20.083 | 1.83 s, three staggered swaps |
| clean read, final assembly | 20.125 → 21.083 | **958 ms fully settled**, then hard cut |

So the payoff is: **0.63 s of nothing → 0.75 s of arrival → 0.33 s of stillness
→ 1.83 s of change → 0.96 s of stillness → cut.** Total 4.5 s, of which
1.6 s — 36 % — is a parked frame with nothing happening.

### 4.6 Spacing of the reveal — where the moment sits

Three framings, because "the beat" can honestly be drawn at three scales. All
percentages are of the unit named.

**As a payoff unit** (16.542 → 21.083, 4.541 s):

| phase | dur | % of the payoff |
|---|---|---|
| empty field — **absence** | 0.625 s | **13.8 %** |
| pop-in → settled | 0.750 s | 16.5 % |
| clean read, assembly 1 | 0.333 s | 7.3 % |
| the shuffle | 1.833 s | 40.4 % |
| clean read, final assembly | 0.958 s | 21.1 % |

The release — the frame the sheet appears on — sits at **13.8 %** of the payoff.
**Before : after the release = 1 : 6.3.** The absence is short and the presence
is long, which is the correct way round: absence is a promissory note, and you
do not hold it longer than you have to.

**As a setup-plus-payoff unit** (12.208 → 21.083, 8.875 s): the accent — the cut
to empty at 16.542 — sits at **48.8 %**, almost exactly the midpoint.
**Before : after = 4.334 s : 4.541 s = 1 : 1.05.**

> **The film spends as long refusing to show you the thing as it spends showing
> it.** 4.3 seconds of a dead-still shot in which nothing whatsoever happens,
> then 4.5 seconds of payoff. That 1 : 1 setup-to-payoff ratio, not any easing
> curve, is what makes the reveal read as a reveal rather than as a transition.

**Internally**, the arrival is spaced at **19.5 %** (value-half) / **22.2 %**
(extreme) — front-loaded, in the "arrival" mode of §6.5. The *event* that
precedes it — the cut — has no spacing at all; it is one frame.

For comparison, the other two films' central accents:

| film | unit | accent at | before : after |
|---|---|---|---|
| Exquisite Corpse — the reveal | 12.208 → 21.083 | **48.8 %** | 1 : 1.05 |
| Babbu — the word-flip thesis | 9.760 → 16.350 | **39.2 %** | 1 : 1.55 |
| Doodle Fonts — the wordmark resolve | 30.400 → 35.000 | **91.3 %** | 10.5 : 1 |

There is no universal placement of an accent inside a beat — 14 %, 39 % and 91 %
are all used. What *is* universal is what surrounds it: **every accent in the
reference set has a held frame on at least one side, and the two biggest have
4.29 s and 2.59 s of frozen frame immediately before them.**

### 4.7 Where the accent is

**16.542 s.** The cut to empty.

That is the one instant in the film with an unambiguous before and an after: the
frame goes from its most content-dense state (a live-action shot with an actor
and a drawing, ink coverage 38 584 px) to its least (zero). The pop-in at
17.167 s is the *release*, not the accent — by the time the sheet appears the
audience has already been told something is coming, by 625 ms of absence.

**This is the thing our hero beat does not have.** "Not ugly, just lame" is what
a beat feels like when nothing is ever taken away. Exquisite Corpse buys its
moment with an empty frame; ours has a continuously-occupied frame with a
continuously-moving camera, which is the same information density from start to
finish, which is why there is no instant to point at.

---

## 5. Reveal cascades — every one, measured

### 5.1 Babbu's object field — the cleanest cascade in the set

4.755 → 9.718 s. Eleven events. Each is a **single frame**; between events the
frame is bit-identical.
[`02-cascade-4fps.png`](../verification/reference-films/babbu/02-cascade-4fps.png).

| t | frame | what | ROI (600×336) | Δ from previous |
|---|---|---|---|---|
| 5.130 | 123 | moon **label** | 71,96–133,132 | — |
| 5.631 | 135 | watermelon **object** | 442,40–569,122 | **501 ms** (12 fr) |
| 6.048 | 145 | watermelon label | 441,94–489,131 | **417 ms** (10 fr) |
| 6.506 | 156 | shoes object | 67,178–199,278 | **458 ms** (11 fr) |
| 6.965 | 167 | shoes label | 115,255–167,292 | **459 ms** (11 fr) |
| 7.341 | 176 | doll object | 271,205–375,326 | **376 ms** (9 fr) |
| 7.674 | 184 | doll label | 333,275–389,313 | **333 ms** (8 fr) |
| 8.175 | 196 | ball object | 469,156–576,265 | **501 ms** (12 fr) |
| 8.634 | 207 | ball label | 454,236–516,272 | **459 ms** (11 fr) |
| 9.176 | 220 | dog object | 247,43–358,156 | **542 ms** (13 fr) |
| 9.718 | 233 | dog label | 269,150–330,185 | **542 ms** (13 fr) |

**Beat interval: 8–13 frames, median 11 = 459 ms.** Not metronomic — it tightens
to 333 ms in the middle and opens back out to 542 ms at the end. That
irregularity is almost certainly hand-placed to music, and it is what stops the
cascade reading as a loop.

**The structural idea worth stealing:** each item is *two* beats — the object,
then its name, ~450 ms later. Never both at once. The object gets a beat of
being just a shape before it is labelled.

Then: **2.59 s of complete stillness** (9.760 → 12.304 s, mean mad 0.001), and
only then the six label flips, accelerating:
`12.346 → 13.138 → 13.639 → 14.097 → 14.431 → 14.765` = `792, 501, 458, 334,
334 ms`. Then **1.17 s more stillness** before the transition out.

### 5.2 Exquisite Corpse — the archival cards

2.250 → 4.417 s. Four cards fan in over the title. Card arrivals at f54, f64,
f76, f88 = intervals **417, 500, 500 ms**. Each card's growth shows decaying
deltas (ease-out) over ~10 frames = 417 ms, on twos.

The **exit** is the interesting number: the full stack is gone in f106 → f112 =
**6 frames = 250 ms**. Elements arrive at 417–500 ms apart and leave four times
faster than they arrived, all at once. Arrivals are staggered; departures are
not.

### 5.3 Exquisite Corpse — the lobby card

7.633 → 8.467 s. The room-code card fills in one row at a time: code → card →
player 1 → player 2 → player 3 → "Start Game", at roughly **167 ms** intervals.
[`02-setup-masked-canvas-6fps.png`](../verification/reference-films/exquisite-corpse/02-setup-masked-canvas-6fps.png).
A tighter cascade than the object cascade because the elements are smaller and
share a container.

### 5.4 Doodle Fonts — three different cadences in 7 seconds

| beat | window | interval | character |
|---|---|---|---|
| wordmark assembles | 0.233 → 0.733 | ~67 ms | glyph slots filling, 7 events |
| stamp tiles | 27.867 → 28.800 | **exactly 233 ms** (7 fr), 5 gaps, zero drift | a metronome |
| line types on | 28.833 → 29.733 | **167 ms** (5 fr) per letter | typing |
| second line pops | 30.400 → 30.733 | one event + 433 ms settle | a punch |
| wordmark resolves | 32.300 → 34.600 | median **67 ms**, 35 events | a slot machine settling |

The stamp cadence is the only perfectly regular interval anywhere in the three
films — 27.867, 28.100, 28.333, 28.567, 28.800, to the frame. Everything else is
hand-placed.

---

## 6. Transits — how moves start and stop

### 6.1 The two-sentence summary

Every move in the reference set is **ease-out dominant**: a short acceleration
(≈ 4 frames), an early velocity peak, and a long decay (3–4× the rise). Nothing
eases in symmetrically, nothing coasts at constant velocity, and — apart from
the title spring — nothing overshoots.

### 6.2 Babbu's three-phone dolly — the only sustained camera move in the set

33.533 → 36.161 s. Three identical horizontal slides. Per-frame global `dx`
(600-space; ×2 for source):

```
33.575  +3     ease-in, 4 frames
33.617  +5
33.659  +8
33.700  +21    PEAK  (= 504 px/s here, ~1008 source px/s)
33.742  +12
33.784  +11
33.825  +10
33.867  +17
33.909  +7
33.951  +6
33.992  +5     long ease-out, ~16 frames
34.034  +9
34.076  +3
34.117  +3
34.159  +2
34.201  +4
34.242  +1
34.284  +1
34.326  +1
34.368  +1
34.409   0     STOPPED
34.618   0     209 ms of dead hold, then the next slide
```

- **Rise 4 frames (167 ms), fall ~17 frames (708 ms) — a 1 : 4 asymmetry.**
- Travel ≈ 130 px (260 source px) per slide; total move 875 ms.
- **Cycle: 1.06 s** — 0.85 s of move + **0.21 s of full stop**. The camera stops
  completely between slides. It does not creep.
- `resid` after compensation collapses to near-zero, so this really is a rigid
  translation of the whole frame, not parallax.

*Method note: the `+17` and `+9` outliers mid-decay are phase-correlation
confidence dips (peak drops to 0.28 and 0.43) as three near-identical phones
pass through the frame, not real velocity spikes; the underlying decay is
monotonic.*

### 6.3 Dissolves

| film | window | dur | shape |
|---|---|---|---|
| Babbu, title → object field | 4.421 → 4.755 | **292 ms** (7 fr) | Y ramps 224.9 → 248.4 monotonically; the new field is fully present on the first frame after. Fade-out-through-near-white, not a true cross-dissolve. |
| Babbu, phones → outro card | 36.078 → 36.870 | **751 ms** | Two halves. Out: 459 ms, mad decaying 1.9 → 0.2 (**ease-out**), reaching Y 238.9. In: 292 ms, mad rising 1.55 → 5.07 (**ease-in**), landing on a frozen card. The midpoint at 36.55 s is the near-white frame. |
| Doodle Fonts, title → app | 1.100 → 1.567 | **467 ms** | mad decays 12.2, 9.9, 6.5, 4.7, 3.5, 2.5, 1.7, 1.0, 0.45, 0.33 — a clean **ease-out**, ratio ≈ 0.7 per frame. |
| Doodle Fonts, app → stamps | 27.200 → 27.633 | **433 ms** | mad *rises* 1.0 → 12.9 over 13 frames then hard-swaps at 27.633 — an **ease-in** into a cut. The only accelerating transition in the set. |
| Exquisite Corpse, into browser | 8.775 → 9.042 | 292 ms | hard cut at 8.775 followed by a 292 ms scale-in settle. |
| Exquisite Corpse, out of chrome | 26.708 → 26.958 | 292 ms | scale-up past the browser frame into the ochre world. |

**292 ms and 433–467 ms are the two transition lengths these films use.** There
is nothing between 200 ms and 290 ms, and nothing above 500 ms except the
double-ended Babbu dissolve.

### 6.4 The single fastest and slowest things on screen

- **Fastest:** the section slot-machine slides in Exquisite Corpse's shuffle —
  > 624 source px/s, resolved in 500 ms.
- **Slowest:** Doodle Fonts' stamp scale-down — −1.23 %/frame, 179 → 119 px over
  1.1 s. This is the *only* slow continuous change in 114 seconds of film.

### 6.5 ★ Spacing — where inside the move the breakdown falls

Duration is the least interesting thing about a transit. What gives it character
is **where inside its own runtime the defining in-between sits**. Two independent
readings, both as a percentage of the transit's own duration
([`tools/spacing.py`](../verification/reference-films/tools/spacing.py)):

- **value-half** — the instant at which 50 % of the total change has happened.
  50 % is even spacing. Below 50 % is front-loaded (the move resolves early and
  then creeps in); above 50 % is back-loaded (it holds near its start pose and
  then goes).
- **extreme** — the frame maximising `min(distance to start, distance to end)`:
  the frame that is *least like either key*. This is the breakdown in the
  animator's sense. For a linear tween it lands at 50 % by construction.

The two agree to within a few points on every single transit, which is the check
that the metric is measuring the move and not the metric.

```
EXQUISITE-CORPSE                                      dur   frames  value-half  extreme
  reveal: sheet pop-in -> settled                    750 ms  18 fr     19.5%     22.2%
  title: onset -> first spring peak                  417 ms  10 fr     91.9%     90.0%   <-- wind-up
  title: first peak -> first trough                  250 ms   6 fr     32.3%     50.0%
  title: whole spring, onset -> settled             2000 ms  48 fr     16.5%     22.9%
  shuffle: LEGS swap                                 583 ms  14 fr     36.3%     35.7%
  shuffle: TORSO swap                                500 ms  12 fr     28.3%     25.0%
  shuffle: HEAD swap                                 500 ms  12 fr     28.8%     33.3%
  archival card 4 grows in                           416 ms  10 fr     37.1%     40.0%
  archival cards give way (scale + dissolve)         250 ms   6 fr     52.5%     50.0%
  browser scale-in after the cut                     291 ms   7 fr     13.8%     14.3%
  zoom out of the browser chrome                     250 ms   6 fr     30.0%     33.3%
BABBU
  dolly slide 1                                      834 ms  20 fr     33.3%     30.0%
  dolly slide 2                                      750 ms  18 fr     19.5%     27.8%
  dolly slide 3                                      751 ms  18 fr     16.8%     16.7%
  wordmark opacity fade-up                            84 ms   2 fr     57.6%     50.0%
  phone fade-in                                      208 ms   5 fr     66.2%     60.0%
  dissolve up through near-white                     334 ms   8 fr     53.6%     50.0%
  cross-dissolve to outro card                       792 ms  19 fr     80.8%     78.9%   <-- wind-up
DOODLE-FONTS
  title -> app scale/dissolve                        467 ms  14 fr      9.9%      7.1%
  app -> stamps (accelerating into a cut)            433 ms  13 fr     93.4%     92.3%   <-- wind-up
  stamp tile scale-down (the slow layer)            1100 ms  33 fr     27.3%     39.4%
  "more than ever" pops + settles                    333 ms  10 fr      8.7%     10.0%
  wordmark doodle -> sans *                         2300 ms  69 fr      5.6%     33.3%
```

\* *Not a single transit — 35 independent glyph substitutions. The two readings
disagree because the difference metric saturates after the first few glyphs. Its
spacing number is not comparable to the others and is listed only for
completeness.*

**The finding:**

> **The reference set contains no evenly spaced move.** Of 22 comparable
> transits, the four that land anywhere near 50 % — the archival cards giving
> way (52.5 %), Babbu's white dissolve (53.6 %), its 2-frame wordmark fade
> (57.6 %) and its phone fade-in (66.2 %) — are **all opacity-dominated**, i.e.
> transitions with no pose to break down. Every transit that moves an actual
> object is either strongly front-loaded or strongly back-loaded. **Nothing that
> has a silhouette is spaced evenly.**

The distribution is bimodal, and the two modes mean different things:

| mode | range | count | what it is |
|---|---|---|---|
| **arrival** | value-half **9–37 %** | **15** of 22 | something lands and settles: pop-in, scale-in, dolly, swap, card, type-pop. Big first step, long decay. |
| **wind-up** | value-half **79–93 %** | **3** of 22 | the move holds near its start and then *goes*: the title's rise into its overshoot peak (91.9 %), the accelerating ramp into Doodle Fonts' only hard cut (93.4 %), the cross-dissolve out of Babbu's last shot (80.8 %). |
| *(fades)* | 52–66 % | **4** of 22 | opacity only. No pose to space. |

**This is the number that indicts our beat directly.** The storyboard lane
measured the original card flip's breakdown at **87 %** and the current beat's at
**42 %**. 87 % sits squarely in the reference set's wind-up cluster — the same
signature as the title spring's 91.9 % and the pre-cut ramp's 93.4 %. **42 % sits
in the dead band**, adjacent only to four opacity crossfades with nothing on
screen to break down, and 15 points away from the nearest real move. The current
beat is spaced like a dissolve, and a dissolve is exactly what "not ugly, just
lame" describes.

**How to use it.** A beat that is *one* event wants a wind-up: hold near the
start pose, put the breakdown at 85–93 %, then resolve fast. A beat that is
*arriving* — landing, settling, coming to rest — wants 10–37 %. There is no
useful reason to build anything at 42–58 % unless it is literally a crossfade.

---

## 7. Type behaviour — what "breathes" actually is

### 7.1 Exquisite Corpse's title: a damped spring, 4 visible bounces

Ink bbox width relative to settled width, tracked at 24 fps
([`01-title-spring-24fps.png`](../verification/reference-films/exquisite-corpse/01-title-spring-24fps.png)).
Every value is held for 2 frames — the spring is sampled at 12 Hz:

```
  t(s)   0.083 0.167 0.250 0.333 0.417 0.500 0.583 0.667 0.750 0.833 0.917 1.000
  w/wf   0.065 0.238 0.467 0.777 1.243 1.406 1.175 0.855 0.754 0.897 1.090 1.152
                                        ^peak1                  ^trough1     ^peak2
  t(s)   1.083 1.167 1.250 1.333 1.417 1.500 1.583 1.667 1.750 1.833 1.917 2.000
  w/wf   1.064 0.946 0.910 0.962 1.034 1.057 1.024 0.982 0.969 0.989 1.015 1.021
                     ^trough2              ^peak3              ^trough3       ^peak4
```

| property | measured |
|---|---|
| onset → first peak | **417 ms** |
| first overshoot | **+40.6 %** |
| first undershoot | **−24.6 %** |
| oscillation period | **500 ms, constant across all 4 cycles** (peaks at 0.500 / 1.000 / 1.500 / 2.000) |
| overshoot decay ratio | **0.372 per cycle** — measured as 0.374, 0.375, 0.368 over three successive cycles |
| settled within ±1 % | ~2.00 s after onset |
| centre | fixed: cx 292.0 ± 0.5, cy 167 ± 2 — pure centred scale, no travel |
| sampling | on twos (12 fps) |

**Buildable form.** The decay is geometric to three decimal places, so a damped
sinusoid reproduces it exactly:

```
s(t) = 1 + A · exp(−t / τ) · cos(2π t / T)
       A ≈ 0.41    T = 0.500 s    τ = T / ln(1/0.372) = 0.506 s
```

Expressed as a spring: logarithmic decrement δ = 0.989 → **damping ratio
ζ ≈ 0.155**, damped period 500 ms → ω_n ≈ 12.7 rad/s (**f_n ≈ 2.02 Hz**).
*This is a fit. It reproduces the peaks and troughs to within ±1.5 % from cycle
1 onward; the initial rise is slower than a pure step response (417 ms to the
first peak against 250 ms for an ideal ζ = 0.155 step), so the drive is itself
ramped — if you implement it as a literal spring, drive it with a ~0.25 s ramp,
not a step.*

Four visible bounces over two full seconds is far more than modern UI motion
convention allows. It is also 5 % of the entire film spent on the title
breathing.

### 7.2 Babbu's type: no spring at all

The wordmark and shapes fade up over **3 frames (125 ms)**, at final position and
final size, pure opacity — mass 1175 → 13 770 → 20 096, bbox identical from the
second frame. The phone follows at 0.751–0.959 s: **6 frames (250 ms)**, also at
final position, opacity ramping with an accelerating profile (ΔY = −3.2, −4.2,
−4.4, −4.9, −6.1, −11.9 → **ease-in**) that hard-stops. Then frozen for 3.46 s.

### 7.3 Doodle Fonts' type: assembly and resolution, no scale

Neither the opening nor the closing wordmark scales, springs, or fades as a
block. Both are **per-glyph substitutions** — glyph slots filling in on entry
(67 ms apart), glyph faces cycling and converging on exit (median 67 ms apart,
35 events over 2.30 s). The letterforms change; the layout does not move.

**So "type breathes on entry" is one film's idea, not the house style.** All
three films agree only on this much: *the type arrives fast (125–500 ms) and
then the frame stops completely* — 3.46 s in Babbu, 0.30 s in Doodle Fonts,
2.25 s in Exquisite Corpse before the next element.

---

## 8. How many things move at once

Counting 10×6 grid cells with their own mad > 1.5, across whole films:

- **Babbu:** seven segments in 39 s where ≥ 25 of 60 cells are active, and every
  one of them is a transition. During the entire object cascade, exactly **one**
  region changes per event. Simultaneity: 1.
- **Doodle Fonts:** four segments in 35 s. The editor take is single-locus
  throughout — the pen, or a panel.
- **Exquisite Corpse:** high-cell-count segments cluster in the live-action
  passages (5.4–7.7 s, 32.8–36.4 s) and in the supplied Config sting, where the
  count saturates at 60/60. In the *authored graphic* passages the count is low:
  during the shuffle, one band lights and the other two sit at mad < 0.15, a
  **100:1 separation**.

**The rate ratio the doc was reaching for exists in exactly one place** —
Doodle Fonts' stamp beat — and it is roughly **7 : 1** (a 233 ms swap over a
continuous 1.23 %/frame ramp), not "slow drift under fast pops" but "a metronome
over a ramp".

---

## 9. Where each beat's accent falls

The accent is the *instant the beat is about* — the frame with a genuine before
and after. Listed only where one exists.

| film | beat | accent | what makes it an accent |
|---|---|---|---|
| EC | title | **0.500 s** | peak of a +40.6 % overshoot; the wordmark is at maximum and about to snap back |
| EC | lobby | 8.333 s | the "Start Game" button — the last element of the cascade |
| EC | **the reveal** | **16.542 s** | frame goes from maximum content to *nothing*; released 625 ms later |
| EC | the shuffle | 19.583 s | the third swap doubles up (head + legs together) after two single ones |
| EC | Dali at desk | *none* | 4.29 s of nothing. It is a rest, and it is deliberate |
| Babbu | object cascade | 11 accents, ~460 ms apart | each single-frame pop |
| Babbu | **the thesis** | **12.346 s** | the first label flip, after **2.59 s of frozen frame** |
| Babbu | save | 32.433 s | card turns blue → green in one frame |
| Babbu | ending | **38.121 s** | hard cut to black out of a 1.21 s freeze |
| DF | stamps | 6 accents, exactly 233 ms apart | tile swaps |
| DF | closing line | 30.433 s | "more than ever" lands with a 433 ms settle, then 967 ms of freeze |
| DF | wordmark | 34.600 s | last glyph resolves to sans; 400 ms hold, then the film ends |

**The pattern, stated as a rule you can build to:**

> An accent is bought with a hold, not with a move.

Every accent above has a measured hold on at least one side of it. The
distribution of *how much*:

| accent | still before | still after |
|---|---|---|
| EC, the reveal (16.542) | **4292 ms** | 583 ms |
| Babbu, the thesis (12.346) | **2586 ms** | 751 ms |
| Babbu, ending (38.121) | 1210 ms | 834 ms |
| DF, closing line (30.433) | 300 ms | **1000 ms** |
| Babbu, each cascade pop | 292–542 ms | 292–542 ms |
| Babbu, save (32.433) | 500 ms | 459 ms |
| DF, wordmark resolves (34.600) | — (glyph churn) | 400 ms |
| DF, each stamp swap | ~200 ms | ~200 ms |
| EC, each shuffle swap | ~125 ms | ~125 ms |
| EC, title peak (0.500) | — | — |

Only the title's spring peak has no hold on either side, and it is the one
accent that is *itself* an extreme pose rather than a change of state. **The two
biggest accents in the reference set are preceded by 4.29 s and 2.59 s of
completely frozen frame** — an order of magnitude more stillness than any other
beat gets.

---

## 10. What transfers to our hero beat — and what does not

### 10.1 The honest limit, restated with evidence

**None of the three films contains a flat-drawing-stands-up-into-3D beat, and
none contains any dimensional transform at all.** Confirmed across all 2942
frames: no perspective change, no rotation about a horizontal axis, no
occlusion-order change, no cast shadow appearing. Exquisite Corpse's payoff is a
*substitution* (sections swap in-plane); Babbu's is a *state change* (a chip
changes text and colour); Doodle Fonts' is a *font resolution*. All three are 2D
compositing events.

So these films cannot tell us **what our move should look like**. They can only
tell us **how a moment is constructed around a move** — and on that they are
unanimous and specific.

### 10.2 What transfers, ranked by how much it costs us

| # | finding | number | why it transfers |
|---|---|---|---|
| 0 | **Never space a move evenly** | 0 of 22 transits sit at 50 % except three opacity fades; moves are 9–37 % (arrival) or 79–93 % (wind-up) | §6.5. Our beat's breakdown is at **42 %** — in the fade band, where nothing in the reference set that has a silhouette lives. The original card flip's **87 %** is the reference set's wind-up signature exactly. |
| 1 | **Empty the frame before the payoff** | 625 ms at mad 0.000 | The single strongest device in the reference set, and free. Our beat never removes anything. |
| 2 | **Park the camera** | 0 px of drift in 114 s of reference film | Directly contradicts the 4.43 s / 9 px creep in our current beat. Removing motion is the cheapest possible edit. |
| 3 | **Hold the payoff** | EC 958 ms, Babbu 1.21 s, DF 400–967 ms, all bit-still | Our beat's post-transform hold is a drift, so nothing ever "arrives". |
| 4 | **Animate the graphic layer on twos** | 12 fps inside 24; 9.9–19.4× parity ratio | Costs one clock quantisation. It is a large part of why EC reads as drawn. |
| 5 | **One thing moves at a time** | 100:1 band separation during EC's shuffle | Our beat moves the mark, the camera and the material simultaneously. |
| 6 | **Ease-out only, 1:4 rise:fall** | Babbu dolly 167 ms rise / 708 ms fall; EC settle τ ≈ 200 ms | Every transit in the set. No ease-in-out anywhere. |
| 7 | **Stagger at 460–667 ms, and vary it** | EC exactly 667 ms ×2; Babbu 333–542 ms, median 459 | If we cascade anything (restyle, multiple doodles), this is the interval. |
| 8 | **Arrive at 86 %, not 0 %** | EC's sheet pops in at 86.2 % and settles the last 14 % | Cheaper and punchier than growing from nothing, and it keeps the silhouette legible for the whole settle. |
| 9 | **Type: 40 % overshoot, 500 ms period, 0.372 decay, 2 s total** | §7.1 | If a wordmark breathes, this is the measured recipe. Only one film does it. |
| 10 | **Transition lengths are 292 ms or 433–467 ms** | §6.3 | Two values, used consistently. Nothing in between. |

### 10.3 What does not transfer, and should not be copied

- **Confetti / particle rewards.** Not in any of the three films (§2.5). If we
  build A4 it is our idea, not theirs.
- **"One world" as an absolute.** Exquisite Corpse breaks it four times and is
  still the strongest film in the set (§2.6). World consistency is worth a lot;
  it is not worth refusing a cut to a dark UI when the dark UI is the point.
- **Their cut rhythm.** 1 cut per 2.6 s (EC) is a *promo* rhythm carrying a
  narrative across five locations. A single hero beat has no locations to cut
  between; borrowing the cut rate would produce chop, not pace.
- **Long single takes.** Doodle Fonts' 26-second locked take works because the
  artifact is being *made* on screen. Our transform is 1–2 s of event; a 26 s
  take would be dead air.
- **Live-action realism inserts.** Both EC's stock footage passages are the
  weakest, most generic material in the reference set and are the only places
  where the film's own hand disappears.

### 10.4 The one-line version for the board

> **Take something away, stop the camera, let one thing move on twos — spaced
> late, not evenly — and then hold, for a full second, while nothing happens at
> all.** That is what all three of these films do at their best moment, and it
> is the five things our beat currently does not do.

And the ratio to budget against: **Exquisite Corpse spends as long setting the
reveal up (4.33 s, dead still, nothing happening) as it spends paying it off
(4.54 s).** If our beat has 9 seconds, roughly half of them should be spent not
showing the thing.

---

## 11. Frame evidence index

All sheets are labelled with exact timestamps and source frame numbers.
Regenerate any of them with
[`tools/sheet.py`](../verification/reference-films/tools/sheet.py):

```bash
python3 docs/verification/reference-films/tools/sheet.py \
    <video.mp4> <start_s> <end_s> <fps> <cols> <tile_width_px> <out.png> \
    [--crop x,y,w,h]
```

| sheet | window | rate | shows |
|---|---|---|---|
| [`exquisite-corpse/00-overview-2fps.png`](../verification/reference-films/exquisite-corpse/00-overview-2fps.png) | 0–40 s | 2 fps | the whole film; the four worlds; §2.6 |
| [`exquisite-corpse/01-title-spring-24fps.png`](../verification/reference-films/exquisite-corpse/01-title-spring-24fps.png) | 0–2.4 s | 24 fps | the 4-bounce type spring; §7.1 |
| [`exquisite-corpse/02-setup-masked-canvas-6fps.png`](../verification/reference-films/exquisite-corpse/02-setup-masked-canvas-6fps.png) | 7.3–12.7 s | 6 fps | the lobby cascade, the masked single section, the two close-ups; §4.1 |
| [`exquisite-corpse/03-cut-into-browser-24fps.png`](../verification/reference-films/exquisite-corpse/03-cut-into-browser-24fps.png) | 8.65–9.15 s | 24 fps | a hard cut + 292 ms scale-in settle; §6.3 |
| [`exquisite-corpse/04-reveal-A-24fps.png`](../verification/reference-films/exquisite-corpse/04-reveal-A-24fps.png) | 16.2–18.6 s | 24 fps | **the 625 ms empty field and the pop-in**; §4.2 |
| [`exquisite-corpse/05-reveal-B-24fps.png`](../verification/reference-films/exquisite-corpse/05-reveal-B-24fps.png) | 18.6–21.2 s | 24 fps | the three section swaps and the final hold; §4.4 |
| [`exquisite-corpse/06-section-swaps-zoom-24fps.png`](../verification/reference-films/exquisite-corpse/06-section-swaps-zoom-24fps.png) | 18.15–20.3 s | 24 fps | sheet-only crop: the slot-machine mechanic; §4.4 |
| [`exquisite-corpse/07-ink-boil-4hz-24fps.png`](../verification/reference-films/exquisite-corpse/07-ink-boil-4hz-24fps.png) | 20.28–20.72 s | 24 fps | high zoom: the 4 Hz boil on a parked frame; §2.1 |
| [`exquisite-corpse/08-figma-build-12fps.png`](../verification/reference-films/exquisite-corpse/08-figma-build-12fps.png) | 25.15–28.15 s | 12 fps | the dark-UI world and the zoom out of the chrome |
| [`exquisite-corpse/09-config-sting-12fps.png`](../verification/reference-films/exquisite-corpse/09-config-sting-12fps.png) | 36.3–40 s | 12 fps | the supplied Config sting; §2.6 |
| [`babbu/00-overview-2fps.png`](../verification/reference-films/babbu/00-overview-2fps.png) | 0–39 s | 2 fps | the whole film |
| [`babbu/01-open-12fps.png`](../verification/reference-films/babbu/01-open-12fps.png) | 0–5.2 s | 12 fps | 125 ms fade-up, phone at 250 ms, 3.46 s freeze; §7.2 |
| [`babbu/02-cascade-4fps.png`](../verification/reference-films/babbu/02-cascade-4fps.png) | 4.4–10.1 s | 4 fps | the object/label cascade; §5.1 |
| [`babbu/03-object-pop-24fps.png`](../verification/reference-films/babbu/03-object-pop-24fps.png) | 6.4–6.75 s | 24 fps | **a pop with no overshoot — one frame**; §2.3 |
| [`babbu/04-label-swap-24fps.png`](../verification/reference-films/babbu/04-label-swap-24fps.png) | 13.95–14.3 s | 24 fps | **the "width-tween" is a one-frame swap**; §2.4 |
| [`babbu/05-save-beat-12fps.png`](../verification/reference-films/babbu/05-save-beat-12fps.png) | 31.6–33.6 s | 12 fps | the actual reward beat — a colour change; §2.5 |
| [`babbu/06-outro-and-black-8fps.png`](../verification/reference-films/babbu/06-outro-and-black-8fps.png) | 36.2–39 s | 8 fps | crossfade through white, then a hard cut to black; §3.2 |
| [`doodle-fonts/00-overview-2fps.png`](../verification/reference-films/doodle-fonts/00-overview-2fps.png) | 0–35 s | 2 fps | the 26-second single take |
| [`doodle-fonts/01-open-15fps.png`](../verification/reference-films/doodle-fonts/01-open-15fps.png) | 0–1.45 s | 15 fps | glyph-by-glyph assembly, already in the doodle font; §2.8 |
| [`doodle-fonts/02-stamps-and-line-6fps.png`](../verification/reference-films/doodle-fonts/02-stamps-and-line-6fps.png) | 27.3–31.8 s | 6 fps | the 233 ms metronome and the 167 ms/letter line; §5.4 |
| [`doodle-fonts/03-wordmark-resolve-15fps.png`](../verification/reference-films/doodle-fonts/03-wordmark-resolve-15fps.png) | 31.7–35 s | 15 fps | **doodle resolving into sans**; §2.8 |

### Reproducing the numbers

The per-frame series is **checked in** as
[`measured/<film>.tsv`](../verification/reference-films/measured/) — 2942 rows,
one per frame, columns `n t mad hcorr dx dy peak resid cells b0 b1 b2`. §1, §2.2
and §3 regenerate from those alone:

```bash
cd docs/verification/reference-films/tools
python3 cuts.py      # §2.2 — every hard cut + the motion state either side
python3 holds.py     # §1, §3 — every hold, and the % of each film that is held
```

§2.1 and §6.5 need the frames themselves, because they compare non-adjacent
frames. Dump them first (≈ 200 MB, discardable):

```bash
ffmpeg -v error -i <video.mp4> -vf "scale=600:336,format=gray" \
       -f rawvideo -pix_fmt gray <raw_dir>/<name>.gray.raw

python3 kenburns.py <raw_dir>   # §2.1 — the drift/zoom test
python3 spacing.py  <raw_dir>   # §6.5, §4.6 — breakdown position
python3 measure.py  <raw_dir>   # rebuilds measured/*.tsv from scratch
```

`measure.py` reproduces the checked-in TSVs byte for byte.

To measure a *new* transit — one of ours — add a line to `spacing.py`:

```python
spacing('<name>', <fps>, <t_start>, <t_end>, '<label>', roi=(x0,y0,x1,y1))
```

It prints `value-half` and `extreme` as percentages of that transit's own
duration, directly comparable to the table in §6.5.

`measure.py` expects the raw dumps in `../raw/` relative to itself; point it
wherever they are. The films themselves stay read-only in the desk-doodles repo.

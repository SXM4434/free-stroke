# Online reference mechanics — measured

Eleven downloaded clips, 10 373 frames, measured at native frame rate. These
were fetched because the three Desk Doodles reference films contain **no
dimensional transform at all** — confirmed across 2 942 frames in
[`reference-film-mechanics.md`](reference-film-mechanics.md) §10.1 — and our
hero beat is exactly that: flat 2D ink lettering becoming a dimensional 3D form
which then holds a ¾ angle.

Provenance for all eleven: [`../refs-online/README.md`](../refs-online/README.md).
Frame evidence, per-frame series and tools:
[`../verification/refs-online/`](../verification/refs-online/).

> **If you came here from the storyboard, go to [§9](#9-the-storyboards-open-calls-1-and-2-re-run-against-this-footage).**
> [`hero-beat-storyboard.md`](../hero-beat-storyboard.md) §10.6 asks for calls 1
> and 2 to be re-run against this footage; §9 is that re-run, and it marks every
> finding SUPPORT / SILENT / NO SUPPORT. §1–§8 are the general measurement.

> **What "measured" means here, and what it does not.** Every window in §3 was
> bracketed off a contact sheet that was opened and read frame by frame; the
> sheet and the frame numbers are printed next to every row in
> [`tools/transits.py`](../verification/refs-online/tools/transits.py) so any
> number can be walked back to the picture it came from. Where a claim rests on
> something I could not measure, it says so. Where a predecessor's note about a
> clip turned out not to be in the clip, §6 says that too.

---

## 0. Method, and the instrument's own errors

Working space is 600×336 greyscale — the same as
[`../verification/reference-films/`](../verification/reference-films/) — so
every number here sits on the same scale as `reference-film-mechanics.md`. The
per-frame series (`n t mad hcorr dx dy peak resid cells b0 b1 b2`) are checked
in at [`measured/<film>.tsv`](../verification/refs-online/measured/), 10 373
rows, and regenerate byte-for-byte from
[`tools/measure.py`](../verification/refs-online/tools/measure.py).

Frames are **memory-mapped**. The set would be 8 GB resident as float32; only
the requested window is ever cast.

### 0.1 The spacing instrument was wrong twice, and the harness caught it

[`tools/calibrate.py`](../verification/refs-online/tools/calibrate.py) renders
twelve synthetics whose spacing answer is known in closed form and requires the
tool to reproduce it — including four built to be *unmeasurable*, on which the
tool must FAIL rather than print a number. Saved run:
[`measured/_calibration.txt`](../verification/refs-online/measured/_calibration.txt).

It failed three times before it passed, and each failure changed a number that
would otherwise have gone into this document:

| # | what broke | how it showed | what it cost |
|---|---|---|---|
| 1 | **VALUE-HALF saturates.** For a shape of extent `S` moving `T`, difference-to-key ∝ `min(x,S)`, not `x`, so `prog(x) = min(x,S)/(min(x,S)+min(T−x,S))` has a *plateau at exactly 0.5* whenever `T > 2S`, and the estimator reports the plateau's leading edge. | Linear translation with `T = 4S` measured **25.0%**, not 50%. That is `S/T` — the closed form, to three digits. The identical easing applied to a wipe measured 50.0%. | Added **FLOW-HALF** (cumulative adjacent-frame change ∝ distance travelled, so no saturation). It returns 50.0 / 20.6 / 79.4 for both families. **VALUE-HALF is biased front-loaded for any move that travels further than the moving element is wide** — which includes §6.3 of the original doc, since it is stated in VALUE-HALF. |
| 2 | **The SEP guard rejected short transits by construction.** First version demanded `\|A−B\| > 6 ×` the median adjacent-frame difference. In an N-frame transit each frame carries ~1/N of the change, so that ratio *is* N. | 27 of 30 real transits failed, including every 6-frame pop-up in `popup-book`. | Re-expressed against the window's largest excursion (`\|A−B\| ≥ 0.40 ×` excursion), which has no N-dependence, plus a separate dead-window floor. A 6-frame calibration case now pins it. |
| 3 | **The CUT guard fired on things that are not cuts.** `hcorr < 0.95` alone flags a page turning to a differently-coloured spread, a dissolve through white, paper folding under a raking light. | 15 real transits killed, 0 real cuts found. | Now uses the same three-part test `measure.py` and `segment.py` use: `hcorr < 0.95` **and** adjacent difference > 10 **and** > 4× the window median. |

A fourth guard was tried and **abandoned**: monotonicity of the progress curve.
Saturation flattens exactly the backwards excursion it looks for, and an
overshoot-and-settle is a legitimate single transit anyway. The calibration case
that defeated it is kept in the file.

**Three guards survive, all proven to fire:** SEP (the move returns toward its
start — the shape of the failure that produced a bogus 620° turn in the parallel
lane), CUT, and MULTI (the window swallowed two events). A fourth signal, `bg`,
is reported but is *not* a guard: it is activity-per-pixel outside the ROI over
activity-per-pixel inside it, and above 0.30 it means the whole frame is moving,
so the row is partly measuring a camera rather than a move.

### 0.2 What is estimated rather than measured

- **Which frame is "the accent"** (§4) is a judgement about what the beat is
  *about*, made from the sheets. The holds either side of it are measured.
- **`origami-crane-fold` and `origami-logo-fold` are real paper**, not CG. That
  is the makers' own statement (§1.1), not my measurement — I cannot tell paper
  from a good render at 600×336.
- **Setup:payoff ratios** (§5) treat "setup" as everything before the transit
  in that clip. For a 20-second sales template that boundary is arbitrary in a
  way it was not for a 40-second promo; the numbers are given with that caveat.
- `cartoon-network-popup` opening **B** is the one transit in the set I could
  not measure: there is a real hard cut inside the swing (hcorr 0.789 at f1653).
  It is reported as a failure, not estimated.

---

## 1. The one-paragraph answer

**In this genre the flat→dimensional move is not animated. It is hidden.** Of
the eleven clips, the three purpose-built "extrude" templates — the ones whose
whole job is our beat — cross the 2D/3D seam either in **one frame** (`f63→f64`
and `f303→f304` in `extrude-outline-reveal`; `f44→f45` in `stacked-extrude-pin`)
or under a **white blow-out cross-dissolve** (`pencil-sketch-extrude`, both
idents; `extruded-logo-resolve` at 8.1–8.9 s). Where the transform *is* shown,
it is shown by a **hinge** — paper folding or a panel rotating about a fixed
edge — and never by a shape morphing into a deeper version of itself. And the
spacing answer is the opposite of the one the original set gave: 16 of 23 clean
transits sit in the **40–60% band**, median flow-half **48.7%**, where the
Desk Doodles set had *nothing with a silhouette*. Our genre spaces its moves
**evenly**, and buys its moment somewhere else entirely — with a **1.7–3.3 s
dead hold** on the finished form, roughly triple Exquisite Corpse's 958 ms.

### 1.1 What the makers said, in their own words

Per the dispatch rule, the post text was read for every clip
(`yt-dlp --write-info-json`, saved under
[`../refs-online/meta/`](../refs-online/meta/)). Two of them state technique
outright, and one of those independently confirms a measurement:

- **`origami-crane-fold`** — stephmotion: *"See the Magic of Origami in this
  Stop Motion animated short. After watching Kubo and the two strings I wanted
  to try out some Origami Stop Motion Animation as it was seen in the movie. I
  animated this video of a piece of paper folding itself to an origami crane.
  BTS Info: This video was animated at 12fps (I normaly animate at 24fps). I
  just think it gives the animation a special look and it takes much less
  time :)"* — **Measured independently before the description was read:** the
  file is a 24 fps container in which every second frame is a duplicate, strict
  alternation from f185 to f220 and beyond
  ([`_cadence.txt`](../verification/refs-online/measured/_cadence.txt); the
  2 s fold de-duplicates from 48 frames to 22). The maker's "12fps" and the
  measurement agree. **This is real paper on a real table, shot on twos.**
- **`origami-logo-fold`** — Yuval Nathan: *"Reveal your logo through origami
  white paper folding stop motion animation. — The animation was shot in high
  resolution photographs…"*. Also real paper, photographed, sold as an After
  Effects project.
- **`cartoon-network-popup`** — Nightowl Studio (archivist, not the original
  maker): *"These all seem to be fully functional papercrafts with no digital or
  animated components. Very impressive!"* Flagged as the uploader's reading,
  not the broadcaster's statement.
- **`pulltab-popup-crane`** — Nicolas Codron: *"A simple pull-tab-animated
  movable crane or designer's lamp (crafted in 2019)… a simple and effective
  mechanism for an enjoyable pop-up experiment."*
- **`extruded-logo-resolve`**, **`stacked-extrude-pin`** (Fast Video Store),
  **`pencil-sketch-extrude`** (Fiverr) — sales copy only; *"extruded depth,
  strong shadows, and smooth cinematic motion"* is the whole of the technique
  content. **`extrude-outline-reveal`** — description is its own title.
  **`popup-book`** — description is the single word *"reference"*.
  **`all4-idents`** and **`paper-street-stopmotion`** — descriptions empty.

**Replies:** comment threads were fetched for all eleven. Four have zero
comments (`extrude-outline-reveal`, `extruded-logo-resolve`,
`pencil-sketch-extrude`, `origami-logo-fold` — none exist, not unreachable);
`pulltab-popup-crane` likewise has none. The threads that do exist carry **no
technique** except one: on `origami-crane-fold` the maker replies *"I remember
it took quite some time but was a fun experience"*. `popup-book`'s nine comments
are all people asking for a tutorial and getting no answer — including *"can I
ask what software did you use?"*, unanswered, which is why that clip is treated
as CG on the evidence of the frames alone. `all4-idents`' thirty comments are
nostalgia.

---

## 2. Film table

Durations, rates and frame counts probed from the files, never hardcoded
([`_profile.txt`](../verification/refs-online/measured/_profile.txt)).

| film | dur | container fps | content fps | source px | frames | held | camera |
|---|---|---|---|---|---|---|---|
| `extrude-outline-reveal` | 20.06 s | 24 | 24 | 1280×720 | 480 | 38% | locked, object rotates |
| `extruded-logo-resolve` | 33.20 s | 29.97 | 29.97 | 1280×720 | 993 | 24% | slow orbit → head-on |
| `cartoon-network-popup` | 54.17 s | 59.94 | ~58.6 | 960×720 | 3 244 | 12% | handheld |
| `pulltab-popup-crane` | 7.48 s | 30 | 30 | 1280×720 | 222 | 57%\* | handheld |
| `paper-street-stopmotion` | 10.10 s | 23.98 | 23.7 | 1280×542 | 241 | 28% | locked |
| `origami-crane-fold` | 14.05 s | 24 | 17.4 · **12 through the fold** ✗ | 1280×720 | 336 | 39% | locked |
| `origami-logo-fold` | 30.58 s | 25 | ~22.5 | 854×480 | 763 | 46% | locked, top-down |
| `popup-book` | 49.53 s | 25 | 24.6 | 1280×720 | 1 236 | 17% | slow continuous drift |
| `all4-idents` | 85.12 s | 25 | 24.4 | 640×360 | 2 125 | 16% | **locked, one fixed ¾ angle** |
| `pencil-sketch-extrude` | 20.20 s | 25 | 24.9 | 854×480 | 502 | 69% | locked |
| `stacked-extrude-pin` | 8.13 s | 29.97 | 27.9 | 1280×720 | 242 | 41% | locked, object rotates |

\* `pulltab-popup-crane` is handheld and never actually still; its hold floor
(mad 3.93) is set by its own shake, so "57% held" means "57% of the film is only
shake". Read it as a null.

**24% of the eleven films is a held frame**, against **61%** for the three
Desk Doodles films. That difference is real but it is not the interesting
number — see §5.

---

## 3. ★ Spacing — where the breakdown falls in a 2D→3D transit

The question this whole exercise exists to answer. Full run:
[`_transits.txt`](../verification/refs-online/measured/_transits.txt).
Percentages are of each transit's own duration. **FH (flow-half) is the number
to trust**; VH is carried only so these rows sit on the same scale as
`reference-film-mechanics.md` §6.5, and a large VH↔FH gap is the signature of a
long-travel move (§0.1).

```
                                                        dur    VH     FH     EX    bg
EXTRUDE-OUTLINE-REVEAL
  A: white solid -> blue material sweep                375 ms  62.9%  63.0%  66.7%  0.37 BG
  B: white solid -> black material sweep               500 ms  65.3%  69.4%  66.7%  0.09
STACKED-EXTRUDE-PIN
  slice stack fuses into one solid                     267 ms  38.3%  42.0%  37.5%  0.14
  fused solid swings to head-on and settles            434 ms  33.3%  34.8%  30.8%  0.24
PENCIL-SKETCH-EXTRUDE
  ident1: pencil hatch -> chrome solid                 360 ms  24.1%  26.6%  22.2%  0.21
  ident2: pencil hatch -> red solid                    400 ms  28.4%  29.4%  30.0%  0.23
EXTRUDED-LOGO-RESOLVE
  3D depth shrinks away (dimension removed)           2002 ms  48.2%  43.8%  48.3%  0.02
  pale dip: 3D render -> flat vector                   801 ms  60.1%  58.2%  58.3%  0.01
PAPER-STREET-STOPMOTION
  cut-out stands up off the sheet                      542 ms  77.4%  67.2%  76.9%  0.11
CARTOON-NETWORK-POPUP
  A: flat framed picture opens into a room             317 ms  42.2%  56.3%  42.1%  0.26
  B: flat poster opens into a scene                    367 ms   FAIL: hard cut inside the swing (hcorr 0.789)
  C: flat card opens into the lab                      367 ms  40.4%  46.1%  40.9%  0.23
PULLTAB-POPUP-CRANE          (all six background-contaminated; see below)
  crane rises 1                                        267 ms  72.8%  66.3%  75.0%  0.40 BG
  crane lies back down 1                               433 ms  41.1%  47.9%  38.5%  0.56 BG
  crane rises 2                                        467 ms  51.0%  44.5%  50.0%  0.33 BG
  crane lies back down 2                               167 ms  51.0%  49.9%  60.0%  0.41 BG
  crane rises 3                                        200 ms  47.0%  48.3%  50.0%  0.28
  crane lies back down 3                               200 ms  48.4%  47.9%  50.0%  0.36 BG
ORIGAMI-CRANE-FOLD
  flat sheet folds into a crane (de-duped from twos)  2000 ms  26.9%  42.7%  36.4%  0.19
ORIGAMI-LOGO-FOLD
  dimensional form folds down to a flat card          1440 ms  13.4%  49.3%  19.4%  0.02
  white packet uncovers the green card ✎               280 ms  53.2%  55.3%  57.1%  0.02
  flat card unfolds back into a form                  1640 ms   7.8%  40.5%   7.3%  0.03
  form folds down to flat again                       1680 ms  77.5%  48.7%  83.3%  0.13
POPUP-BOOK
  spread 1: flat panels stand up (stage)               360 ms  43.9%  52.7%  44.4%  0.07
  spread 2: flat panels stand up (orchestra)           240 ms  69.1%  55.3%  66.7%  0.08
  spread 3: flat panels stand up (travel)              240 ms  42.9%  47.0%  50.0%  0.09
  spread 4: flat panels stand up (coffee)              240 ms  59.6%  52.7%  66.7%  0.09
  spread 5: flat panels stand up (park)                240 ms  48.6%  46.7%  50.0%  0.08
ALL4-IDENTS
  flat plates extrude up out of the ground plane 1     560 ms  71.1%  66.1%  71.4%  0.02
  flat plates extrude up out of the ground plane 2     720 ms  70.1%  67.4%  72.2%  0.02
```

30 attempted → **23 clean, 6 background-contaminated, 1 guard failure.**

> ✎ **One label corrected, 2026-07-31; the numbers are unchanged.** The
> `origami-logo-fold` row at 8.68–8.96 s read *"flat card takes its colour"*.
> Nothing takes a colour. The white packet's two flaps retract and **uncover** a
> green card that is already at its final size and its final value — measured in
> §9.1, calibrated in §9.0, and visible at zoom in
> [`03-uncover-zoom-25fps.png`](../verification/refs-online/origami-logo-fold/03-uncover-zoom-25fps.png).
> The window, the spacing figures and every other row are untouched;
> [`_transits.txt`](../verification/refs-online/measured/_transits.txt) was
> regenerated and differs from the previous run in that label alone.
>
> ⚠️ **A second caveat on the row below it, found the same day and *not* fixed.**
> `form folds down to flat again` is bracketed 23.600–25.280 s = f590–f632, but
> the fold is done by f622 and the clip's **second** uncover starts at f623 — so
> that window carries about 9 frames of a different event, and MULTI did not
> fire. Re-measured on the fold alone (f590–f622): **FH 45.2 % against the 48.7 %
> printed**, still inside the mechanism band, so §3.1 is unaffected. VH moves
> 77.5 → 10.1, which is §3.2's saturation signature again and is why FH is the
> column to trust. Left as printed with this note rather than silently re-cut.

### 3.1 The finding

> **In the online set, 16 of 23 clean transits sit in the 40–60% band. Median
> flow-half 48.7%, range 26.6–69.4%. The distribution is unimodal and centred on
> even spacing.**

| band | flow-half | online set (23 clean) | Desk Doodles set (22 transits, §6.5) |
|---|---|---|---|
| arrival / front-loaded | 0–40% | **3** | **15** |
| even | 40–60% | **16** | 4 — *and all four were opacity fades* |
| wind-up / back-loaded | 60–100% | **4** | 3 |

**These two sets disagree almost completely, and the disagreement is the
result.** The Desk Doodles films are 2D compositing events — a card pops in, a
label swaps, a tile scales — and those are spaced late or early because that is
what gives a *substitution* a character. The online films are performing a
**mechanism**: a hinge opening, a sheet folding, a plate extruding. A hinge
driven at constant angular rate reads as even, and every one of the five
`popup-book` spreads (46.7 / 47.0 / 52.7 / 52.7 / 55.3%) and every one of the
six pull-tab strokes lands there. **A mechanism does not ease; a graphic does.**

So the honest reading is not "our genre says space evenly". It is:

> **You get to choose which thing your beat is.** If the mark *becomes* a solid
> — a material event — the set says put the breakdown at 20–30%
> (`pencil-sketch-extrude`, both idents: 26.6% and 29.4%) or make it a single
> frame. If the mark *stands up* — a mechanical event, a hinge — the set says
> even, 45–55%, and the reference for that is five pop-up spreads and six
> pull-tab strokes agreeing to within 9 points.

**Our current beat sits at 42%.** Against the Desk Doodles set that was a dead
band. Against *this* set it is squarely inside the mechanism cluster. The 42% is
therefore **not the fault** — which is a real correction to the brief's premise.
The fault is that our beat is spaced like a mechanism while being staged like a
graphic: nothing hinges, nothing occludes, no shadow appears, so the even
spacing reads as a dissolve rather than as a mechanism.

### 3.2 Where the two estimators disagree, and why that is itself a reading

`origami-logo-fold` gives VH 13.4 / FH 49.3, VH 7.8 / FH 40.5, VH 77.5 /
FH 48.7 — gaps of 29–36 points, the largest in the set. That is the saturation
signature from §0.1: these are the moves where the paper travels many times its
own width. `paper-street-stopmotion` (77.4 vs 67.2) and `popup-book` spread 2
(69.1 vs 55.3) are milder cases of the same. Everywhere the element stays inside
its own footprint — the material sweeps, the pale dip, the `all4` extrusions —
the two agree to within 3 points. **The agreement between them is the check that
the ROI was right**, and it is why §3 quotes both.

---

## 4. Where the accent falls

The accent is the instant the beat is *about* — the frame with a genuine before
and an after. In the original set the rule was *an accent is bought with a hold,
not with a move*, and every accent had a measured hold on at least one side.
That survives here, and gets sharper.

| film | accent | what it is | still before | still after |
|---|---|---|---|---|
| `extrude-outline-reveal` | **2.667 s** (f64) | the wire becomes a solid — **one frame** | 0 (mid-rotation) | 0 (mid-rotation) |
| `extrude-outline-reveal` | 12.667 s (f304) | same, second ident | 0 | 0 |
| `stacked-extrude-pin` | **1.502 s** (f45) | the stack arrives complete — **one frame** | 0 | 0 |
| `stacked-extrude-pin` | 2.568 s | the stack has finished fusing | 0 | **3 270 ms** |
| `pencil-sketch-extrude` | 2.560 s | pencil has become chrome | 0 | 2 200 ms |
| `pencil-sketch-extrude` | 12.560 s | same, second ident | 0 | 2 440 ms |
| `extruded-logo-resolve` | 8.909 s | 3D has become flat vector | 0 | **2 135 ms** |
| `paper-street-stopmotion` | **4.463 s** (f107) | the cut-out is up and its shadow lands | 0 — see note | 1 752 ms |
| `popup-book` ×5 | end of each rise | the spread is standing | 0 | 360–1 000 ms |
| `all4-idents` ×4 | 45.60, 60.78, … | the extrusion tops out | **480–3 800 ms of empty white** | 960–3 520 ms |
| `cartoon-network-popup` | 16.117 / 27.667 / 43.467 | the card is fully open | 0 | 320–770 ms |

*Note on `paper-street-stopmotion`.* An earlier draft of this table claimed
1 043 ms of stillness before that accent. **That was wrong and the series
disproves it**: mad decays 1.52 → 0.157 across f85–f96 as the blade withdraws
and never sits at a hold floor;
[`holds.py`](../verification/refs-online/tools/holds.py) finds only two holds in
the whole clip, both *after* the stand-up (1 752 ms at 5.80 s, 1 084 ms at
8.97 s). There is no dead frame before this accent — the quietest single frame
(f96, mad 0.157) is immediately followed by the rise.

Two things follow.

**1. The one-frame accents have no hold at all — because they are hidden, not
shown.** `extrude-outline-reveal` swaps its wire outline for a solid slab in a
single frame *while the object is mid-rotation*, and the pixel evidence is that
almost nothing happens: mad at the swap frame is **5.18** against a local
baseline of ~2.5, and `hcorr` is **0.996**
([`measured/extrude-outline-reveal.tsv`](../verification/refs-online/measured/extrude-outline-reveal.tsv),
f60–f68). A substitution that big should be a spike. It is not, because the
outline's outer contour **is** the solid's silhouette (see
[`04-A-the-swap-zoom-24fps.png`](../verification/refs-online/extrude-outline-reveal/04-A-the-swap-zoom-24fps.png),
f63 vs f64). This is the same device as Babbu's "width tween" being a one-frame
swap, applied to the dimensional seam.

**2. The genuine accents are bought with a hold on the *far* side, not the
near side.** The Desk Doodles set front-loads its stillness — 4 292 ms of frozen
frame *before* the Exquisite Corpse reveal. This set back-loads it: 1.7–3.3 s of
dead frame *after* the form arrives. The exception is `all4-idents`, which does
both, and does the before-hold more aggressively than anything in either set:
**a 3 800 ms empty white screen** between idents 1 and 2 (f377–f471), and 480 ms
and 520 ms white gaps at the other two boundaries
([`_holds.txt`](../verification/refs-online/measured/_holds.txt); white gaps
detected as mean luminance > 235 with σ < 12).

---

## 5. Hold ratios and setup-to-payoff

**The whole-film hold ratio does not transfer, and should not be used.** 24%
here against 61% there, but the comparison is unfair in both directions: the
Desk Doodles films are 40-second promos with dead narrative passages, and seven
of these eleven are 8–33 second sales templates with no narrative at all. What
*is* comparable is the hold that pays off the transform:

| | payoff hold | source |
|---|---|---|
| Exquisite Corpse (original set) | 958 ms | §10.2 |
| Babbu | 1 210 ms | §10.2 |
| Doodle Fonts | 400–967 ms | §10.2 |
| **`stacked-extrude-pin`** | **3 270 ms** | hold at 4.74 s |
| **`pencil-sketch-extrude`** | **3 080 ms** (ident 1), 2 440 ms (ident 2) | holds at 5.16 s, 12.92 s |
| **`extruded-logo-resolve`** | **2 135 ms** | hold at 8.91 s |
| **`paper-street-stopmotion`** | **1 752 ms** | hold at 5.80 s |
| `origami-logo-fold` | 1 040 ms then 3 720 ms of empty ground | holds at 9.08 s, 11.64 s |
| `popup-book` | 360–1 000 ms per spread | five spreads |
| `all4-idents` | 960–3 520 ms | holds at 15.12 s, 21.44 s, 28.88 s |

> **The payoff hold in our genre is 1.7–3.3 s — roughly triple the original
> set's, and 2–3× longer than the move that earned it.**

**Setup-to-payoff.** The original set's ratio was 1 : 1.05 (Exquisite Corpse
spends 4.33 s setting up and 4.54 s paying off). Measuring the same way — time
before the transform's start against time from the transform's start to the end
of the clip — on the four clips where the boundary is unambiguous:

| clip | setup | payoff | ratio |
|---|---|---|---|
| `stacked-extrude-pin` | 2.30 s | 5.83 s | **1 : 2.5** |
| `pencil-sketch-extrude` ident 1 | 2.20 s | 7.80 s (to the cut at 10.0 s) | **1 : 3.5** |
| `paper-street-stopmotion` | 4.00 s | 6.10 s | **1 : 1.5** |
| `extrude-outline-reveal` ident A | 2.63 s | 7.37 s (to the cut at 10.0 s) | **1 : 2.8** |

*Estimate flag:* "setup" here is everything before the transform including the
draw-on, which for a template is also the entertainment. Treat 1 : 1.5 – 1 : 3.5
as the shape of the answer, not a precise figure. It points the same way as the
hold data — **this genre spends most of its runtime after the transform, not
before it**, which is the reverse of the Desk Doodles set.

---

## 6. How the transform is staged — camera, light, and registration

### 6.1 Camera

**Nine of eleven park the camera.** `all4-idents` is the extreme case: 85
seconds, every ident shot from the *same fixed ¾ angle*, verified across 170
sampled frames
([`04-dense-A-2fps.png`](../verification/refs-online/all4-idents/04-dense-A-2fps.png),
[`05-dense-B-2fps.png`](../verification/refs-online/all4-idents/05-dense-B-2fps.png)).
The two that move are `popup-book` (a slow continuous drift throughout) and
`extruded-logo-resolve` — and in that one the camera move *is* the mechanism
(§6.3). The three purpose-built extrude templates all rotate the **object** and
hold the camera.

This agrees with the original set (0 px of drift in 114 s) and contradicts the
4.43 s / 9 px creep in our current beat.

### 6.2 Light, and what actually sells the dimension

`paper-street-stopmotion` is the cleanest evidence in the set and the closest to
our register: white paper, one raking light, black ground. Reading
[`02-shadow-arrives-24fps.png`](../verification/refs-online/paper-street-stopmotion/02-shadow-arrives-24fps.png)
frame by frame: f95–f97 (3.95–4.03 s) is a flat sheet with a cut line in it and
**no shadow at all**; at f98 (4.075 s) a thin dark shadow appears beneath the
lifting edge; by f104 (4.325 s) it has become a dark mass running right across
the sheet, and by f110 it is the largest dark shape in the frame.

The form itself is **white paper against white paper** — its own tonal contrast
against the ground is close to nil, before and after. What makes it read as
standing is entirely the shadow. That is the whole lesson of this clip for a
white-ground ink beat. Same in
`cartoon-network-popup`: the papercraft rooms are legible as dimensional because
the interior walls fall into shade the instant the card opens
([`02-card-opens-A-60fps.png`](../verification/refs-online/cartoon-network-popup/02-card-opens-A-60fps.png)
f947→f966).

> **Nothing in this set makes a flat mark read as dimensional by changing the
> mark. They change what is *around* it: a cast shadow, an occlusion, a shaded
> interior face.** Our beat currently produces none of the three.

### 6.3 Registration — the question that has defeated us twice

Five distinct answers, all measured:

| # | film | how the flat state and the dimensional state are registered | transfers to ink-on-paper? |
|---|---|---|---|
| 1 | **`extrude-outline-reveal`** | **The outline's path *is* the solid's silhouette.** The wire and the slab share an outer contour exactly, so the one-frame substitution has nothing to register — `hcorr` 0.996 across it. And the swap happens mid-rotation, so the pose is continuous. | **Yes, and this is the strongest answer for us.** Our stroke already has an outline. Build the solid so its silhouette is that outline, then swap on a frame where the form is already turning. |
| 2 | **`all4-idents`** | **The flat state is the solid's base face.** Pieces begin as zero-height plates lying in the ground plane and grow *upward* along one axis from a footprint that never moves ([`06-assembly-25fps.png`](../verification/refs-online/all4-idents/06-assembly-25fps.png), f1126→f1140; [`07-assembly2-25fps.png`](../verification/refs-online/all4-idents/07-assembly2-25fps.png), f1501→f1520). Registration is free because nothing translates. | **Yes.** Extrude along the view axis from a fixed footprint and the flat mark is, by construction, the silhouette of the solid. |
| 3 | **`cartoon-network-popup`, `pulltab-popup-crane`, `popup-book`, both origami clips** | **A hinge.** The two states share a fixed edge; registration is a physical constraint, not a calculation. | Partly. A hinge needs an edge to pivot about, and a letterform has no obvious one. |
| 4 | **`pencil-sketch-extrude`, `extruded-logo-resolve`** | **Nothing is registered — the seam is destroyed.** Both cross-dissolve through a near-white blow-out ([`01-sketch-to-solid-25fps.png`](../verification/refs-online/pencil-sketch-extrude/01-sketch-to-solid-25fps.png) f55→f64; [`02-deextrude-10fps.png`](../verification/refs-online/extruded-logo-resolve/02-deextrude-10fps.png) f243→f267). For ~8 frames the screen is too bright to read an edge. | **No.** On white paper there is no brighter state to hide in. This is the one trick in the set our ground forbids. |
| 5 | **`extruded-logo-resolve`** (second mechanism) | **The camera does the registering.** It orbits to head-on, and the flat mark is what the 3D form looks like from there; then the extrusion depth is separately shrunk to zero over 2 002 ms (FH 43.8%). | Conditionally. It requires the flat mark to be a true orthographic projection of the solid. |

**What is *not* in the set, anywhere:** an overlay of a flat state and a
dimensional state cross-faded in place while both are legible. Our failed
overlay attempt has no precedent here — eleven professional and semi-professional
clips, and not one of them tries it. The card flip that worked (scaling both
faces about the same point) is mechanism #1 in disguise: shared silhouette,
continuous pose.

### 6.4 Is the flat state ever genuinely flat?

Only in three clips, and this is where a predecessor's note has to be corrected.

- **Genuinely flat:** `all4-idents` (zero-height plates in the ground plane),
  `paper-street-stopmotion` (a sheet on a table), `origami-logo-fold` (a card on
  white paper, with a soft drop shadow), `cartoon-network-popup` (a framed
  picture on a wall), `popup-book` (printed panels lying on the page).
- **Never flat:** `extrude-outline-reveal` — the "outline" is a **swept tube in
  perspective with specular highlights**, rotating in 3D from the first frame
  ([`03-A-close-and-fill-24fps.png`](../verification/refs-online/extrude-outline-reveal/03-A-close-and-fill-24fps.png),
  f31 onward). It is a 3D wire, not a drawn line.
- **Never flat:** `pencil-sketch-extrude` — the pencil state is a **shaded 3D
  object with a hatching texture**, spinning in perspective
  ([`01-sketch-to-solid-25fps.png`](../verification/refs-online/pencil-sketch-extrude/01-sketch-to-solid-25fps.png),
  f40–f55). The `refs-online/README.md` entry called this "the only clip where
  the flat state is drawn in pencil". **That is wrong** and has been corrected;
  the clip is still worth keeping, because the *handover* between a hand-made
  surface and a manufactured one is exactly our seam, but there is no flat state
  in it.

### 6.5 The `all4-idents` claim was not in the file

The `refs-online/README.md` described this clip as *"coloured blocks scattered
in 3D space align, from one viewpoint only, into the flat '4'"* and called it
*"the strongest answer to the registration question in the whole set"*.

**No aligned flat "4" appears anywhere in the 85 seconds.** Checked at 2 fps
across the whole file — 170 frames, both dense sheets above — plus native-rate
sheets at all three ident boundaries
([`02-ident2-end-12.5fps.png`](../verification/refs-online/all4-idents/02-ident2-end-12.5fps.png),
[`03-ident3-end-12.5fps.png`](../verification/refs-online/all4-idents/03-ident3-end-12.5fps.png)).
The blocks are assembled and oblique for the entire runtime; the idents end by
cutting to white or shrinking away. That description was written from knowledge
of the Channel 4 brand, not from these frames — the same failure mode as the
sibling doc that cited mechanisms for images that had 404'd.

What the file *does* contain is better for us anyway, and it is measured:
**flat plates extruding upward out of the ground plane from a fixed camera**,
four times, 560–720 ms, FH 66.1% and 67.4%. That is registration answer #2 above,
and it is the only genuinely flat→dimensional move in the set that is neither a
hinge nor a substitution.

---

## 7. What transfers to our hero beat

Ranked by how cheaply it buys a moment. Every row names the frames it came from.

| # | finding | number | where |
|---|---|---|---|
| 1 | **Make the flat mark the solid's silhouette, then swap or extrude.** Two independent mechanisms in the set do this and both make registration a non-problem. | `hcorr` 0.996 across a full material substitution | §6.3 #1, #2 |
| 2 | **Hold the finished form for 1.7–3.3 s, dead still.** This is the single biggest difference from our beat, which drifts after arriving. | 3 270 / 3 080 / 2 135 / 1 752 ms | §5 |
| 3 | **A cast shadow, an occlusion, or a shaded interior face must arrive with the form.** Nothing in the set sells dimension by changing the mark alone. | `paper-street` f96→f107 | §6.2 |
| 4 | **Park the camera; rotate the object instead.** 9 of 11, including all three purpose-built extrude templates. | 0 px drift | §6.1 |
| 5 | **Decide whether the beat is a mechanism or a material event, then space it accordingly.** Mechanism → 45–55% (11 instances agreeing within 9 points). Material → 20–30%, or one frame. | median FH 48.7% | §3.1 |
| 6 | **Empty the frame before the payoff.** Confirms the original set's strongest device, at larger scale. | 3 800 ms of white; also a 2-frame full empty immediately before each `all4` build (f1501–f1502) | §4 |
| 7 | **Twelve frames per second is enough, and a maker chose it on purpose.** Independently measured as strict twos, then confirmed by the maker's own note. | `origami-crane-fold`, 12 fps in a 24 fps container | §1.1 |
| 8 | **A one-frame substitution is a legitimate professional answer to "how does the flat thing become solid".** Three instances in two clips. | f63→f64, f303→f304, f44→f45 | §4 |

### 7.1 What does not transfer

- **The white blow-out cross-dissolve.** Two of the eleven hide the seam by
  overexposing through near-white for ~8 frames. **Our ground is white paper.**
  There is no brighter state available, and attempting it on paper produces a
  hole, not a flash. This is the most-used trick in the commercial-template
  corner of the set and we cannot have it.
- **Chrome, bevels, specular sweeps.** `extrude-outline-reveal`,
  `extruded-logo-resolve` and `pencil-sketch-extrude` all pay off into a glossy
  manufactured object. That is the opposite register from ink on paper, and it
  is doing most of the work of "this is now a solid" in all three.
- **The hinge, taken literally.** It is the honest mechanism (five clips) and it
  is why the paper ones read as real, but a letterform has no natural pivot
  edge. Borrowing the *evenness* of hinge timing without the hinge is exactly
  the trap our current 42% beat has fallen into (§3.1).
- **`popup-book`'s prop cascade.** Each spread finishes with 6–12 single-frame
  prop pops. Charming, and it is the Babbu cascade again — but it is set
  dressing arriving, not a transform, and we have one mark, not twelve props.
- **Long draw-on preambles.** Four of the templates spend 2–4 s drawing a line
  before anything dimensional happens. For a template that is the product; for a
  hero beat it is a wait.

### 7.2 The one-line version

> **Build the solid so the flat stroke is its silhouette; extrude it along one
> axis from a footprint that never moves, with the camera parked; let a cast
> shadow arrive at the same instant; and then stop dead for two and a half
> seconds.** That is what the measurable half of this set does, and the half we
> cannot copy is the half that hides the seam in a white flash.

---

## 8. Frame evidence index

All sheets labelled with exact timestamps and source frame numbers. Regenerate
with [`tools/sheet.py`](../verification/refs-online/tools/sheet.py):

```bash
python3 docs/verification/refs-online/tools/sheet.py \
    <film-slug> <start_s> <end_s> <rate> <cols> <tile_px> <out.png> [--crop x,y,w,h]
```

| sheet | window | rate | shows |
|---|---|---|---|
| [`extrude-outline-reveal/00-overview-2fps.png`](../verification/refs-online/extrude-outline-reveal/00-overview-2fps.png) | 0–20 s | 2 | both idents end to end |
| [`extrude-outline-reveal/03-A-close-and-fill-24fps.png`](../verification/refs-online/extrude-outline-reveal/03-A-close-and-fill-24fps.png) | 1.3–3.1 s | 24 | the "flat" state is a 3D wire; §6.4 |
| [`extrude-outline-reveal/04-A-the-swap-zoom-24fps.png`](../verification/refs-online/extrude-outline-reveal/04-A-the-swap-zoom-24fps.png) | 2.4–2.95 s | 24 | **the one-frame substitution, f63 vs f64**; §4, §6.3 |
| [`extrude-outline-reveal/02-B-extrude-24fps.png`](../verification/refs-online/extrude-outline-reveal/02-B-extrude-24fps.png) | 12–15 s | 24 | the same trick in ident B, f303 vs f304 |
| [`stacked-extrude-pin/01-stack-and-fuse-30fps.png`](../verification/refs-online/stacked-extrude-pin/01-stack-and-fuse-30fps.png) | 1.1–3.4 s | 30 | stack arrives in one frame, then fuses; §4 |
| [`pencil-sketch-extrude/01-sketch-to-solid-25fps.png`](../verification/refs-online/pencil-sketch-extrude/01-sketch-to-solid-25fps.png) | 1.6–3.2 s | 25 | **the white blow-out handover**; §6.3 #4, §6.4 |
| [`pencil-sketch-extrude/02-ident2-25fps.png`](../verification/refs-online/pencil-sketch-extrude/02-ident2-25fps.png) | 11.9–13.1 s | 25 | the same handover, second ident |
| [`extruded-logo-resolve/01-ident1-6fps.png`](../verification/refs-online/extruded-logo-resolve/01-ident1-6fps.png) | 0–11 s | 6 | the orbit to head-on; §6.3 #5 |
| [`extruded-logo-resolve/02-deextrude-10fps.png`](../verification/refs-online/extruded-logo-resolve/02-deextrude-10fps.png) | 5.4–10.2 s | 10 | depth shrinking, then the pale dip to flat |
| [`paper-street-stopmotion/01-standup-24fps.png`](../verification/refs-online/paper-street-stopmotion/01-standup-24fps.png) | 3.6–5.0 s | 24 | **the shadow arriving, f96→f107**; §6.2 |
| [`cartoon-network-popup/02-card-opens-A-60fps.png`](../verification/refs-online/cartoon-network-popup/02-card-opens-A-60fps.png) | 15.65–16.45 s | 60 | a hinge opening, real paper |
| [`cartoon-network-popup/03-card-opens-B-60fps.png`](../verification/refs-online/cartoon-network-popup/03-card-opens-B-60fps.png) | 27.2–28.3 s | 60 | opening B — contains the hard cut that failed the guard |
| [`cartoon-network-popup/04-card-opens-C-60fps.png`](../verification/refs-online/cartoon-network-popup/04-card-opens-C-60fps.png) | 43.0–44.3 s | 60 | opening C, f2586→f2608 |
| [`pulltab-popup-crane/01-rise1-30fps.png`](../verification/refs-online/pulltab-popup-crane/01-rise1-30fps.png) | 0–0.9 s | 30 | the pull-tab mechanism, first stroke |
| [`origami-crane-fold/01-fold-12fps.png`](../verification/refs-online/origami-crane-fold/01-fold-12fps.png) | 7.6–10.7 s | 12 | **the fold, sampled at the content rate**; §1.1 |
| [`origami-logo-fold/01-foldup-25fps.png`](../verification/refs-online/origami-logo-fold/01-foldup-25fps.png) | 7.2–9.2 s | 25 | dimensional → genuinely flat, on white |
| [`popup-book/01-spread1-stage-25fps.png`](../verification/refs-online/popup-book/01-spread1-stage-25fps.png) | 2.9–5.3 s | 25 | page turn, panel rise, prop cascade |
| [`popup-book/02..05-*.png`](../verification/refs-online/popup-book/) | spreads 2–5 | 25 | four more instances of the same rise |
| [`all4-idents/04-dense-A-2fps.png`](../verification/refs-online/all4-idents/04-dense-A-2fps.png) · [`05-dense-B-2fps.png`](../verification/refs-online/all4-idents/05-dense-B-2fps.png) | 0–85 s | 2 | **the whole film — no aligned flat "4" anywhere**; §6.5 |
| [`all4-idents/06-assembly-25fps.png`](../verification/refs-online/all4-idents/06-assembly-25fps.png) · [`07-assembly2-25fps.png`](../verification/refs-online/all4-idents/07-assembly2-25fps.png) | 44.9–46.3 s · 59.9–61.0 s | 25 | **flat plates extruding upward**; §6.3 #2 |
| [`origami-logo-fold/03-uncover-zoom-25fps.png`](../verification/refs-online/origami-logo-fold/03-uncover-zoom-25fps.png) | 8.56–9.12 s | 25 | **the occlusion reveal, zoomed, f214–f227**; §9.1 |
| [`origami-logo-fold/04-recover-zoom-25fps.png`](../verification/refs-online/origami-logo-fold/04-recover-zoom-25fps.png) | 18.60–19.06 s | 25 | **the same reveal run backwards, f465–f475**; §9.1 |
| [`all4-idents/08-plate-to-solid-zoom-25fps.png`](../verification/refs-online/all4-idents/08-plate-to-solid-zoom-25fps.png) | 59.96–60.52 s | 25 | **2 empty frames, then plate → solid, zoomed**; §9.1, §9.2 |
| [`stacked-extrude-pin/02-drawing-on-not-edge-on-30fps.png`](../verification/refs-online/stacked-extrude-pin/02-drawing-on-not-edge-on-30fps.png) | 0–0.80 s | 30 | **the "edge-on" opening is a stroke drawing on**; §9.2 |

### Reproducing the numbers

**Interpreter.** These tools need `numpy` and `PIL`, which on this machine are on
the *system* python only. Use `/usr/bin/python3` (3.9.6, numpy 2.0.2) — the
Homebrew `python3` on `PATH` has neither, and `python3 measure.py` fails at the
import. `../refs-online/README.md` already spells the path out; this block did
not, and said plain `python3`.

```bash
cd docs/verification/refs-online/tools
/usr/bin/python3 _films.py    # probe + dump raw greyscale (~1.9 GB, discardable)
/usr/bin/python3 measure.py   # regenerate measured/<film>.tsv byte-for-byte
/usr/bin/python3 calibrate.py # MUST pass before any spacing number is believed
/usr/bin/python3 transits.py  # section 3
/usr/bin/python3 holds.py     # sections 2, 5
/usr/bin/python3 cadence.py   # section 1.1 (twos detection)
/usr/bin/python3 segment.py   # per-film timeline of cuts, holds and events
/usr/bin/python3 calls2.py    # section 9 (storyboard calls 1 and 2)
/usr/bin/python3 roi.py FILM T0 T1     # activity box for a window
/usr/bin/python3 curve.py FILM T0 T1   # per-frame motion curve, for bracketing
```

Saved runs of each are checked in beside the TSVs as
[`measured/_*.txt`](../verification/refs-online/measured/).

---

## 9. The storyboard's open calls 1 and 2, re-run against this footage

[`hero-beat-storyboard.md`](../hero-beat-storyboard.md) §10.6 asks for exactly
this: *"Calls 1 and 2 should be re-run against it when it lands."* This is that
re-run. **It is evidence for a decision that is Sebs's, not a decision.**

Three things are stated plainly throughout, because a manufactured finding here
is worse than no finding:

- **SUPPORT** — the footage shows the thing.
- **SILENT** — the footage does not contain the case. *Silence is a result.*
  Both calls get a substantial one, and call 2's is the larger.
- **NO SUPPORT** — the footage contains the case and does not do it.

> **Recency note on §10.6.** The same bullet says this document *"does not exist
> yet."* That was true when the board was written and is now stale — the doc
> landed 2026-07-31. Nothing else in §10.6 is affected.

### 9.0 The instrument, and what it had to fail on first

[`tools/calls2.py`](../verification/refs-online/tools/calls2.py). Saved run:
[`measured/_calls.txt`](../verification/refs-online/measured/_calls.txt). It runs
on **source-resolution** frames, not the 600×336 working space, so every pixel
figure is a real source pixel and can be set against our own 14 px sliver
honestly.

`C0` renders synthetics whose answer is known and **requires the instruments to
get the known-bad ones wrong-side-up before any footage is touched**; the run
aborts if they do not. All six pass:

| instrument | case | expected | got |
|---|---|---|---|
| interior flatness | uniform fill | FLAT | SD 0.000 ✓ |
| interior flatness | uniform + noise σ 6 | not flat | SD 5.37 ✓ |
| interior flatness | linear ramp, 40 luma | not flat | SD 9.97 ✓ |
| interior flatness | top face + darker side wall | not flat | SD 16.94 ✓ |
| occlusion vs rotation | a card occluded to 70 rows | OCCLUSION | ✓ |
| occlusion vs rotation | a card **rotated** into 70 rows | ROTATION | ✓ |

That last row is the one that matters: the discriminator §9.1 leans on is
*able* to say ROTATION, and does, on a synthetic built to make it.

**Two instruments from the previous pass are not used, and why is on the record.**
`calls.py`'s v1 mask failed its own control on 2 of 3 rows (its note: the graded
ground meant *"'differs from the corners' selected the whole frame and the SD
being reported was the background's, not the mark's"*). And one row of this
pass's own first draft was **withdrawn after looking at it**: `all4-idents` f1126
measured SD 0.50 over 98 px and was the only gate-1 pass in the set. Zoomed 4×
it is a pale, motion-blurred fade-in smear, not a plate. The statistic was real
and it was measuring nothing. Assembly 2 is used instead, where the plates are
unambiguous.

---

### 9.1 Call 1 — does K7 return to flat, or to a *changed* flat?

#### SUPPORT — the hard constraint is right, and it is what the genre does

The board's constraint is *"the change must be **occlusion**, never **shading**"*
(§10.5 call 1). **One clip in this set delivers a change to a state that is
already at rest, it does it twice, and both times the mechanism is occlusion.**

*What that rests on:* the 30-transit inventory in §3 — bracketed off the dense
5 fps sheets that cover all eleven clips end to end (§0, `refs-online/README.md`)
— contains exactly one pair of transits that modify a settled flat state, and
both are the `origami-logo-fold` uncover measured below. The other ten clips
either never settle into a flat state (`extrude-outline-reveal`,
`pencil-sketch-extrude`; §6.4), end on one without touching it again
(`extruded-logo-resolve`), or move in one direction and stop. **I did not
personally re-read all 10 373 frames** — the claim is over the transit inventory,
not over every frame, and it is stated that way deliberately.

`origami-logo-fold`, 8.68–8.96 s. The white paper packet's two flaps retract and
uncover a green logo card:

| | f217 | f218 | f219 | f220 | f221 | f222 | f223 | f224 |
|---|---|---|---|---|---|---|---|---|
| exposed height, px | 16 | 40 | 62 | 90 | 128 | 176 | 204 | 214 |
| card width, px | 216 | 214 | 214 | 214 | 216 | 216 | 216 | 216 |
| centre y | 243.5 | 243.5 | 240.5 | 244.5 | 245.5 | 245.5 | 241.5 | 240.5 |

Constant width about a fixed centre is produced *both* by an occluder retracting
and by a card rotating about a horizontal axis, so the bounding box cannot
settle it. This does: **if it is occlusion the exposed band is the same rows of
the settled card; if it is rotation it is the whole card squashed into those
rows.**

```
       f    t(s)        rows    n  same rows  wrong rows  rotation   verdict
     217   8.680     239-248   10      33.04       41.28     41.05   OCCLUSION
     218   8.720     227-260   34      16.37       47.81     44.73   OCCLUSION
     219   8.760     213-268   56      14.93       46.94     38.61   OCCLUSION
     220   8.800     203-286   84      12.77       47.55     38.89   OCCLUSION
     221   8.840     185-306  122      14.15       54.70     43.82   OCCLUSION
     222   8.880     161-330  170      11.75       55.13     27.78   OCCLUSION
     223   8.920     143-340  198       5.61       61.65     14.10   OCCLUSION
```

Seven frames out of seven, against **both** controls. And the close at
18.72–18.96 s is the open run backwards — the same band heights in reverse order
to within 2 px (198, 172, 122, 84, 56, 36, 10), MAE 3.43–36.26 against 45.16–60.92
and 12.73–47.15. Fourteen frames, one mechanism, no exceptions.

What I saw, at 4× on
[`03-uncover-zoom-25fps.png`](../verification/refs-online/origami-logo-fold/03-uncover-zoom-25fps.png):
at f218 the word "Logo" is on screen **at full size** with "Place your" and
"here" simply absent, not compressed. That is a matte opening, not a card
standing up. The measurement and the picture say the same thing.

> **The genre's own answer to "how do you change a flat state without shading it"
> is: put an occluder over it and take the occluder away.** The card never
> changes. What changes is how much of it you are allowed to see.

#### SUPPORT — one piece of news per shot, structurally

The board's sharper argument for the split is that K4 currently carries two
arrivals. This clip is built the way the board wants K4/K7 built: **the fold
finishes, and only then does the change begin.** The fold-down transit ends at
f216 (7.20–8.64 s); the uncover starts at f217 and runs to f224. They do not
overlap by a frame. Same again in cycle 2: the packet lands at f622, the second
uncover starts at f623.

#### SILENT — on identical-vs-changed as a *designed* choice

`origami-logo-fold` is the only clip in the set that returns to a flat state it
has already shown, and it does not settle this. Its two flat packets are the
same *kind* of state and not the same picture:

```
    vs flat packet, cycle 1                  raw  level-norm  + best shift   at
    (itself)                               0.000       0.000         0.000   dx=0 dy=0
    flat packet, cycle 2                   8.338      12.321        11.641   dx=10 dy=-5
    [control] green card at rest          41.336      41.946        38.617   dx=-1 dy=10
```

The second packet is larger, sits further right — the shift search hit its ±10 px
bound — and the whole plate is graded **13 luma brighter** (bare-ground patches
G 201.9 → 215.2). This is real paper, re-shot and re-lit; hand-placement and a
regraded plate account for all of it. **So it is not evidence that a round trip
should return identical, and not evidence that it should not.** The only other
round trip in the set is `pulltab-popup-crane`'s three rise-and-lie-down cycles,
and §2 already rules it a null: it is handheld and its hold floor is its own
shake.

What the clip *does* show is a third structure the board does not consider:
**an unchanged flat carrier that opens onto changed news.** Cycle 1's packet
uncovers the green "Place your Logo here" card; cycle 2's packet — the same white
packet with the same horizontal seam — uncovers the **envato** brand card
(f623–f634). Same carrier, same mechanism, different payload. If K7 wants to
carry news without asserting the mark came back different, that is where the set
would point.

#### SILENT — on over/under at a crossing

Every occlusion in the set is a **separate occluder over a whole graphic** —
paper flaps, a page, a pop-up panel. **Not one instance anywhere of a mark
occluding itself at a crossing.** The proposal that K7's news be an over/under
resolution has support for its *mechanism* and none for its *specific form*.

#### What the set says about gate 1's threshold — and what it cannot say

Gate 1 is `flat ink SD < 1` on a 0–255 scale. Same statistic, same scale, on each
mark's deep interior (chroma-selected, then eroded so no boundary pixel is in the
sample):

| state | frame | interior px | SD | p95−p5 | gate 1 |
|---|---|---|---|---|---|
| `origami-logo-fold` green card, flat | f460 | 21 005 | **0.72** | 1.8 | **PASS** |
| `origami-logo-fold` green card, flat | f230 / f245 | 21 010 | 1.35 / 1.34 | 4.0 | fail |
| `extruded-logo-resolve` flat **vector** logo | f290 / f300 | 27 633 / 27 635 | 2.74 / 2.73 | 7.2 | fail |
| `extruded-logo-resolve` glossy 3D logo | f162 / f180 | 76 348 / 53 546 | 57.22 / 45.56 | 155.4 | fail |
| `all4-idents` element, first visible frame | f1504 | 511 | 18.69 | 61.0 | fail |
| `all4-idents` same element, settled | f1520 | 20 391 | 63.47 | 177.2 | fail |

Two readings, and the second is the useful one.

1. **The flat/dimensional separation is enormous and it is entirely interior
   value** — 0.7–2.7 flat against 45–63 dimensional, a 20–90× ratio. Dimension in
   this genre *is* a value split inside the mark. That is §6.2 restated as a
   number, and it is why shading a flat state would read as un-flattening it.
2. **The footage cannot arbitrate the `< 1` threshold.** The same card measures
   0.72 in one shot and 1.35 in another; a *vector* flat logo measures 2.74. An
   8-bit compressed plate has a noise floor our own render does not. Gate 1's
   number is about our render and this set can neither confirm nor refute it. It
   can only speak to mechanism — and on mechanism it is unambiguous.

---

### 9.2 Call 2 — how true is "the true edge"?

#### SILENT — there is no edge-on pass anywhere in these eleven clips

This is the biggest single finding of the re-run, and it is a negative one.
**Nothing in the set presents a form edge-on, with its thickness the only thing
on screen.** Call 2's exact geometry has no precedent in this footage.

I went looking for it in the three clips that rotate an object, and the most
promising one was a misread on my part that the measurement corrected:

- `stacked-extrude-pin` f4–f20 *looks* edge-on on the overview sheet — a thin
  curved sliver on black. It is not. Ink grows **22 → 3 231 px** while the
  bounding box grows in **both** axes (111×96 → 305×179). It is a stroke
  **drawing on**, which §7.1 already flags as this corner of the set's habit.
  [`02-drawing-on-not-edge-on-30fps.png`](../verification/refs-online/stacked-extrude-pin/02-drawing-on-not-edge-on-30fps.png).
- `extrude-outline-reveal` rotates throughout and never narrows to a sliver; its
  seam is the one-frame substitution at f63→f64 (§4).
- `extruded-logo-resolve` orbits to head-on and removes depth by **shrinking it**
  over 2 002 ms, never by turning through the edge.

So the set cannot tell us how much profile to put in the sliver. It can tell us
something adjacent and useful, below.

#### SUPPORT — "prove it on the approach, not at the sliver"

The nearest available analogue is the `origami-logo-fold` uncover read as a
**fidelity ladder**: at each extent, how far what is on screen sits from the
truth it is a band of. Extent is given as a fraction of the object's *own*
settled extent, which is the scale our sliver has to be judged on — **14 px of a
409 px wordmark is 3.4 %.**

| frame | extent px | % of its own extent | MAE vs truth | × the floor |
|---|---|---|---|---|
| f217 | 10 | **4.7 %** | 33.04 | **5.89×** |
| f218 | 34 | 15.9 % | 16.37 | 2.92× |
| f219 | 56 | 26.2 % | 14.93 | 2.66× |
| f220 | 84 | 39.3 % | 12.77 | 2.28× |
| f221 | 122 | 57.0 % | 14.15 | 2.52× |
| f222 | 170 | 79.4 % | 11.75 | 2.09× |
| f223 | 198 | 92.5 % | 5.61 | 1.00× |

The curve is flat from 26 % to 79 % and then falls off a cliff: **at 4.7 % of its
own extent the picture is 5.9× further from the object than at 92.5 %.** The
sheet shows why — that band is mostly the moving paper edge and its motion blur,
not the card.

**Our sliver sits at 3.4 %, below the bottom rung of this ladder.** The direct
implication for the call: at that scale the frame is not carrying the object's
detail whatever the geometry underneath is doing. That is support for
*geometrically true, visually silent* — and it is support for the second half of
the recommendation too, since the 20–80 px approach frames sit at 5–20 % of the
mark's extent, where this ladder is still on its plateau.

*Stated as an estimate:* this is one object in one clip, on the wrong axis
(a height collapse, not a rotation through the edge), and it is a paper occluder
rather than a turning solid. It is an analogue, not a measurement of our case.

#### NO SUPPORT — nothing in this set holds a frame inside a transform

The board's other hard constraint for call 2 is that the two dwell frames be
byte-identical. Across **all 30 transits**, counting adjacent pairs with
`mad < 0.05`:

- **27 of 30 contain zero duplicate frames.** Minimum `mad` inside the window
  runs 0.088–10.46 across those 27. Nothing stops.
- The 3 exceptions are **cadence, not craft.** `origami-crane-fold` shows 23
  dupes in 48 frames — and 57.2 % of that whole film is duplicate pairs, because
  it is shot on strict twos (§1.1). `origami-logo-fold`'s fold-down shows 2 in
  36, against 43.2 % film-wide. `all4-idents` assembly 2 shows 1 in 18.

So **the dwell is ours.** This genre buys its accent with a hold on the *far*
side of the arrival — 1.7–3.3 s (§5) — and never by stopping inside the move.
That does not make the dwell wrong: the original Desk Doodles flip does it, it is
measured, and §4's one-frame substitutions are a different way of solving the
same problem. But it should be taken as **an unreferenced invention**, not as
something the genre backs.

**There is, however, a clean precedent for the *technique*.** In a 12-fps-on-24
film every held instant is byte-identical by construction, and a maker chose that
rate deliberately. Re-read first-hand out of
[`meta/origami-crane-fold.info.json`](../refs-online/meta/origami-crane-fold.info.json)
rather than taken from §1.1: *"BTS Info: This video was animated at 12fps (I
normaly animate at 24fps). I just think it gives the animation a special look and
it takes much less time :)"* — stephmotion, verbatim, `description` field, video
id `djeRnWMDjyc`. (Spot-checking the rest of §1.1 while I was in there: all
eleven `comment_count` fields are present, and the five clips it calls
comment-less really do read `comment_count=0` rather than being unreachable.) If
the dwell is authored, running
the beat on twos *through the dwell* is the reference-backed way to guarantee the
two frames are identical rather than a two-frame shimmer — which is precisely the
failure the board is trying to prevent.

#### An aside that bears on how the sliver is reached

`all4-idents` empties the frame completely for **two frames** (f1502, f1503)
immediately before each build, then the first element appears already carrying a
value split — SD 18.69 at its first visible frame (f1504)
([`08-plate-to-solid-zoom-25fps.png`](../verification/refs-online/all4-idents/08-plate-to-solid-zoom-25fps.png)).
**The set never shows the flat, one-value state of the thing it is about to make
dimensional.** It cuts away and comes back with the object already dimensional.
Our beat proposes the opposite — to stay on the mark through the seam and make
that the payload. Worth knowing that nothing here does that, in either direction.

---

### 9.3 What §9 does not settle

- **Calls 3 and 4 are untouched**, as §10.6 says they should be — neither depends
  on this footage.
- **No browser was launched** (a hold was in force); nothing here needed one.
  Every number comes from the checked-in clips, the per-frame TSVs, and frames
  decoded on this machine.
- **The fidelity ladder is one object in one clip**, on the wrong axis. It is the
  best analogue the set contains and it is not our case.
- **The `origami-logo-fold` round trip is real paper, re-shot.** Its two flat
  states differ, and that difference is explained by staging rather than by
  design. Treated as silence, not as a finding either way.
- **Neither call is answered here.** The board recommends *changed flat* and
  *geometrically true, visually silent*. This footage strengthens the hard
  constraint under call 1 and the approach-frames half of call 2, gives the
  two-frame dwell no backing, and is silent on the parts that are genuinely
  Sebs's taste.

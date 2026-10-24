# Free Stroke — Session Handoff

> # ⏹ SUPERSEDED 2026-08-28. NOT DELETED.
>
> **Live: `docs/STATUS.md`, `docs/RUN-QUEUE.md`, `HANDOFF.json`.**
>
> **False here now:** *"the 51-error baseline"* (`:344`, `:513`, `:3246`, `:3389`) — it has
> been **6** since 2026-08-02. *"No commits"* (`:8`, `:138`, `:3389`) — closed 2026-08-24.
>
> At 187 KB this is the largest document in the repo and it reads as a live checkpoint.
> It is a record of 2026-08-01. Its hero-beat detail is superseded by
> `docs/hero-beat-storyboard.md`, which itself reads back-to-front: **start at §11.9.**

## CHECKPOINT — `HERO_BEAT_RECORD_RECONCILED_AGAIN` — the re-cut shipped, the paste had not

*2026-08-01, overnight. **Two files written: `docs/hero-beat-storyboard.md` and
`scripts/capture/motion.mjs`** (plus `docs/README.md` and this file). `lib/`,
`components/`, `app/` and `scripts/verify/` were READ and RUN, never written —
three other lanes are live in them. No commits.*

### THE PREVIOUS CHECKPOINT'S ONE BLOCKING NUMBER IS CLOSED

`beats.draw` is **140 frames / 4.6667 s** in the model. The beat is
**371 frames / 12.3667 s**, twelve phases. `assert-hero-ledger.mjs` reads
**4/4 · SOUND**, with **4/4 correctly FAILING** on the whole prior beat. Read
stillness **36.1 %**. The hand is at **3.60×**, not 7.88×, and
`measure-drawin-pacing.mjs`'s `human-speed` row moved **30.6 ms → 66.9 ms**
against a 100 ms floor — **more than half of that row closed by the re-cut
alone**, which is the clearest evidence that giving the trim back was a
correction rather than a preference.

⚠ **THE STILLNESS MARGIN IS UNDER ONE FRAME.** 134 of 371 = 36.1 % against C8's
36 % bar; 371 frames need 133.56. **Drop one repeat frame and the row goes red.**
Anyone retiming a phase should read storyboard §11.2a first, not after.

### VERIFIED FIRST-HAND THIS PASS — every number re-run, nothing inherited

| | result | command |
|---|---|---|
| the frame ledger | **4/4**, 4/4 correctly FAIL on the prior beat | `assert-hero-ledger.mjs` |
| the wind-up **releases INTO the turn** | **7/7**, 4/4 discriminating rows FAIL on `releaseLaw: "prior"` | `assert-hero-windup.mjs` |
| the panel | **31 controls, 31 live**, 3/3 | `assert-hero-dials.mjs` |
| **K7's news RENDERS** | **8/8**, interior sd **0.000**, **1544 px ink→paper / 0 px paper→ink**, 0 console errors | `assert-hero-k7-news.mjs` |
| gate 1 is **blind to a uniform re-value** | `--mutate=shade`: **13934 of 13934** px moved, gate 1 unmoved. `--mutate=wash`: **1325** px moved, gate 1 → sd 18.8 | `… --mutate=shade\|wash` |
| `velocity-bell` | **22/22** (was 10/22) | `measure-drawin-pacing.mjs` |
| the current capture | **8/9** on `k7final` | `assert-hero-transition.mjs --label=k7final` |
| the meta-gate | exit **1** — 2 scripts named `assert-*` that cannot report a failure | `assert-gate-integrity.mjs` |
| `motion.mjs` ⇄ the model | max \|Δ\| **az 1.83e-3° · el 1.28e-3° · fill 9.6e-6**; **19.57°** against the parked laws | own parity probe, 372 frames |

**The dead-dial sweep found EIGHT, not three.** Hold tension was read by nothing
on any arm — the wind-up had no third act to give it a consumer, so *the dial was
dead because the beat had a hole*, which no amount of tracing the wire finds.
Overshoot (`backC1`) is a **0/not-0 switch on a 0–4 slider** — 400 reachable
positions, two states, still load-bearing because 0 is what reduced motion sets.
Swell was **mislabelled**: an ink dial that moved `az 19.1° / el 25.2° / fill
0.10` and depth by exactly nothing. Now split into `riseOvershoot`.

### FOUR CLAIMS I WAS HANDED DID NOT SURVIVE — each corrected where it belongs

1. **"`motion.mjs` still carries the falsified rationale."** It does **not**, and
   has not since §11.7.5 — the falsified lines are struck ✗ history, `breath`
   reads 1.1, `PUSH_SCALE_END` is not exported. **What was actually stale was the
   CONSTANTS block**, and that is a different failure mode worth naming: a
   rationale goes stale because nobody re-reads it; a *pasted constant* goes
   stale because the paste is a manual step with no gate, and the file looks
   current either way.
2. **"the instrument tally is TWELVE."** It is **ELEVEN** — 8 + 3, and the
   repo's own new `assert-gate-integrity.mjs` header says eleven. No twelfth
   found; recorded as eleven.
3. **"`assert-taper-envelope.mjs` contains NO CHECK AT ALL."** True as history,
   **false as current state** — it has three assertions, a real negative control
   and `exit(1)` on failure. The *other two* are still red.
4. **"`--label=after` is 7/9"** — correct, and it also moved the row I was not
   told about: **`--label=turn3` is 8/9, not 7/9.** Both `--gates=prior` arms
   reproduce byte-identically (4/7 and 7/7), which is what makes the movement
   attributable to the gate rewrite rather than to a re-run.

### ONE GATE OPEN — `max cy step 2.00 px` against a ceiling of 2

`assert-hero-transition.mjs --label=k7final` → **8/9**. `cx` is at **1.00 px**,
the instrument's own floor, so §11.7.1's orthographic fix is holding; the
vertical axis alone sits *exactly on* the ceiling. **LANE 6 owns it.** I verified
the reading and the arm; I did **not** reproduce the ruling that it is unrelated
to the K7 break, and that is stated as theirs in storyboard §11.9.6.

### 🔴 ONE-TOKEN FIX FOR THE LANE THAT OWNS `lib/`

```
lib/hero-motion.ts:757      `flat-ink.ts:59`  →  `flat-ink.ts:97`
```

`INK_DIAMETER_IN_STROKE_SPACE = 22` lives at **`lib/flat-ink.ts:97`**;
`flat-ink.ts:59` is inside an unrelated doc comment. The claim is correct, only
the number rotted. It sits in `HeroReturn.breakK`'s doc — the dial that sizes
K7's news — so the next reader of that comment is someone changing the thing
that was just gated 8/8.

### A SHADER TRAP WORTH KNOWING, because every diagnostic reads green

**`discard` inside a dynamically-bounded loop hangs Chrome's Metal backend.**
rAF 121/s, JS responsive, zero console errors, the page's own published data
correct — and **no frames presented**. The only symptom is a screenshot timing
out, which reads as a flaky harness. Bisected in
`components/viewport-3d.tsx:912-922`: the same loop with `break` renders in
46 ms, the same `discard` hoisted out renders in 60 ms.

### `scripts/capture/motion.mjs` — REGENERATED, and now diffable against the model

Constants re-emitted (`draw` 2.1333 → **4.6667**, `tilt` 0.7 → **0.4333**,
`DRAW_LINEAR_BLEND` 0.45 → **1**, five missing exports added). **And
`cameraProgram()` was rewired to read them** — pasting a block that names three
laws over a program that ignores all three is the same defect as a falsified
rationale in different clothes. Three poses were second opinions: `tilt` ran the
parked symmetric ease from `lieEl`, `standup` took its overshoot from the *ink's*
swell dial, `descend` left the hold at full speed.

**The parity residual turned out to be worth a number.** It is not floating
point: `toMotionMjsSource` emits `toFixed(4)`, so `MOVE_ACCEL_FRAC` arrives as
0.1905 against `4/21 = 0.190476…` and the whole residual sits in `handoffEase`'s
nose. Feed the model the same 4-dp values and it agrees to 2.2e-13. **The film
and the page can never be bit-identical across this transfer, and the gap is now
0.0018° of azimuth rather than an assumption.**

### NOT done, stated plainly

- **`assert-joint-beading.mjs` and `assert-layer-flicker.mjs` are named, not
  fixed.** Both emit zero PASS/FAIL rows on the invocation a sweep makes and
  cannot return non-zero from their own judgement. `scripts/verify/` is another
  lane's. The flicker one prints `asc_flicker … STROBE` in its default output and
  passes anyway — a row that names the failure and does not raise it.
- **Eleven `file:line` citations in the storyboard pointed at the wrong line**
  and are corrected in one table (§11.9.8) rather than eleven scattered notes.
  A rotted citation almost never lands on nothing — it lands on real code, so the
  reader gets a wrong answer with no signal. `page.tsx:1309` used to be the
  "Copy motion.mjs constants" button; it is now the timeline dock's phase
  read-out. **That table will rot too**; the durable fix is to cite a *symbol*.
- **`docs/storyboard/*.png` still show the old beat** — now two re-cuts out of
  date, not one.
- **K1's silhouette complaint (§3 K1) has survived three passes unexamined.**
- **Sebs's picks are untouched.**

---

## CHECKPOINT — `HERO_BEAT_RECONCILED` — the ledger, the record, and one number that is still wrong

*2026-07-31 evening. Documentation only — this pass wrote `docs/hero-beat-storyboard.md`
and this file, and nothing else. `lib/`, `components/`, `app/`, `scripts/`,
`docs/research/` and `docs/explainers/` were READ and RUN, never written; three
other lanes are live in them. No commits.*

### THE ONE THING TO ACT ON: the draw beat is 7.88× a real hand, and the ledger was blocking the fix

`scripts/verify/assert-hero-ledger.mjs` hard-codes `docs/hero-beat-storyboard.md`
§10.3's ten-row ledger as its `LEDGER` const — `draw: 64` among them — and asserts
*"the beat lands on §10.3's ledger, row by row."* §10.3 closed at **270 frames /
9.00 s** and had **no row at all** for the two camera moves. The beat that exists
has **twelve** phases and runs **295 frames / 9.833 s**. So the stale table was a
live constraint holding the draw at 64 frames.

**Measured** (`node scripts/verify/measure-drawin-pacing.mjs`):

```
the Sigma-Lognormal reconstruction's own duration   16.805 s
the hero beat's draw                                 2.133 s
compression                                          7.88×
median stroke   0.360 s recorded → 45.7 ms on screen
shortest stroke 0.241 s recorded → 30.6 ms on screen
the literature's floor for a real hand movement (research §3): 100 ms
draw beat that clears it, MEDIAN stroke:    4.666 s   ← the defensible value
draw beat that clears it, SHORTEST stroke:  6.971 s
```

**§10.3'S FRAME LEDGER IS RE-CUT** — `docs/hero-beat-storyboard.md` §10.3,
*"The frame ledger, RE-CUT"*, with the old table left standing beside it and a ⚠
note saying what it used to say. Twelve rows, `draw` **64 → 140 frames**, every
other row unchanged:

| | §10.3's ledger | shipped | **RE-CUT** |
|---|---|---|---|
| `draw` | 64 | 64 | **140** |
| every other row, summed | 206 — **nine** rows, no `tilt`, no `descend` | 232 — **eleven** rows | 232, unchanged |
| row sum | 270 | 296 | **372** |
| **measured total** | **270 fr / 9.00 s** | **295 fr / 9.833 s** | **371 fr / 12.367 s** |

(Row sum exceeds the measured total by one frame because `emerge` and
`returnTurn` are each 27.5 frames — `0.85 + 2/30` at 30 fps — and each rounds up.
That is frame rounding, and it is the tolerance `assert-hero-ledger.mjs` already
carries.)

**NEW BEAT TOTAL: 371 frames / 12.367 s at 30 fps. READ STILLNESS: 36.1 %**,
against C8's 36 % bar — 90 frames in shots that genuinely stop + 44 frames
elsewhere identical to the frame before them = 134 of 371.

⚠ **State the margin honestly: 36.1 % against 36 % is one third of a frame.** It
clears; it is not a number to build a second decision on. Three measured facts
around it, all in §10.3:

- **6.971 s does NOT clear the bar** — 440 frames, **30.5 %**. That is the second,
  independent reason to reject the shortest-stroke figure. (The first: that stroke
  is polyline #1, three raw points, **0.153 % of the word's travel**.)
- **`draw` is deliberately not in `PARKED_PHASES`** and that is where the margin
  went (`lib/hero-motion.ts:104-107` — *"quantising it quantises the handwriting.
  One line to add if that is wanted; it is not assumed"*). If it were added, 140
  frames on the 12 Hz grid hold 56 distinct states → **58.8 %**. Real option, real
  cost, **not taken here** — it is a hand-feel call.
- **The bar is being applied to the wrong unit, and C8 is the section that says
  so.** The draw-in is our SETUP, not our payoff. On everything from `breath`
  onward the beat is **134 / 231 = 58.0 % still, and that number does not move by
  one frame however long the draw runs.** Mechanics §4.6 measures Exquisite
  Corpse's setup:payoff at **1 : 1.05** and concludes *"The film spends as long
  refusing to show you the thing as it spends showing it."* The re-cut moves our
  accent from 40.6 % (Babbu's placement, 1 : 1.46) to **52.8 % (1 : 0.90)** —
  onto Exquisite Corpse's.

### CLOSED, each verified first-hand by running the repo's own asserts

| | verdict | evidence |
|---|---|---|
| **registration** | **CLOSED**, `max cx step 1.00 px` | `assert-hero-transition.mjs --label=reg-affine` **9/9**; `--label=reg-persp` **8/9, the one failure is registration alone**; `_probe-hero-projection.mjs` → intervention 46.50 vs 1.00 px, prediction fitted to WIDTHS ONLY rms **3.31** vs null **30.10** px. Fixed with an **orthographic hero stage**. **§7's third number, "one centre", is RESTORED** — §11 said it was lost, and that note is corrected in place. |
| **the value wash** | **NOT A DEFECT — a RAKE** | dark core **12.6 vs settled 12.6 to the digit**; only the lit end rises (87.0 vs 35.0), which a cross-dissolve cannot do. Two measurement faults fixed: statistic → dark core (§3 K3's own method), reference → the brighter endpoint. `--gates=prior` reproduces the old FAIL `37.2 vs 23.4`; `--mutate=wash` drives the new row red. |
| **the squash (K2)** | **RENDERS** | `assert-hero-dead-channels.mjs` ALL PASS — h **−4.57 %** against a dialled −4.50 %, w **+1.96 %** against +1.80 %, and pinned at the CONTACT (`cy 501.0 → 505.0`). |
| **K4 and K7** | **BOTH BUILT** | `assert-hero-hold.mjs` **8/8**; `assert-hero-return.mjs` **13/13** with a per-claim control matrix (`prior` kills 12/13, `identical` kills exactly 1) and a mutation-tested stillness detector. **Call 1 can now be taken, not only decided.** |
| **the contact shadow** | **CLOSED, root-caused** | `StudioContactShadow` renders in `Scene`, off `Scene`'s own prop — **re-rendering a child cannot change a parent's prop**, so the channel never saw the override. **0 of 943,040 pixels** before. Live now: `assert-hero-flatstate.mjs` all rows pass, pool 249.79 → 244.73 at el 35, and it honestly reports that dead-on the pool is invisible by construction. |
| **`motion.mjs`** | **REGENERATED** | `breath: 1.1`, twelve-phase `PHASES`, `PUSH_SCALE_END` gone — and the falsified lines kept as an explicit ✗ list of what it used to say. |
| **the camera** | **TWO SEAMS CLOSED** | `assert-hero-camera.mjs` **9/9**, 8/8 correctly FAIL on the prior camera. `orbit→descend` **0 → 375.9 deg/s in one frame** out of a 933 ms hold → first frame is 10 % of its own peak. `tilt→standup` **el 0.8 → 84.0 deg/s in the SAME direction — a 105× re-acceleration with no turnaround** → 4.7 %. Worst same-direction step ratio **56.0× → 5.1×**. **`lieEl: 65` was lying — the camera reached 70.35°.** The rise rebalance had silently broken `prefers-reduced-motion` (`riseOut` reads `riseGatherDepth`, which the switch had stopped reaching); `assert-hero-reduced-motion.mjs` is **4/4**, its fourth row being the control that makes the other three mean anything. |

### THE HEADLINE CORRECTION — the draw-in, and the answer to *"what was all this research we did"*

**It was never a lesser system. It WAS explainer 18's real reveal — fed
synthesised timestamps: 12 ms per point on a 4 px arc-length grid.** Pearson r
between per-stroke arc length and per-stroke duration, where **1.0000 is a
machine**: `--clock=uniform` **0.9986**, shipped `lognormal` **0.8412**.

`lib/pen-kinematics.ts` already had the Sigma-Lognormal model and already
exported `timeNorm` — *"so a caller can re-time its own `t` channel without
changing the stroke's total duration."* And `PenKinematicsSettings.retime`
preserved *"the stroke's own first/last timestamps exactly."* **So the model was
allowed to say when the pen was fast WITHIN a stroke and forbidden to say that
one stroke took longer than another.** That is what pinned r at 1.0. The research
was done, implemented, documented with its provenance — and one preservation
clause was holding it shut. Timing character **2.23 % → 7.59 %**; AUTHENTIC vs
SMOOTH peak lead/lag **13.6 ink diameters**.

> ⚠ **`velocity-bell` IS NOW 22/22, and `human-speed` reads 66.9 ms at 3.60×
> compression, not 30.6 ms at 7.88× — 2026-08-01, re-run.** The located cause
> below is what made the bell fixable, so the paragraph is left standing. The
> `human-speed` row is still failing deliberately; it moved because `beats.draw`
> went 64 → 140 frames, so the model's own 16.805 s of pen time is squeezed into
> 4.667 s instead of 2.133 s.

Two rows of `measure-drawin-pacing.mjs` are left FAILING **deliberately** and
both are findings, not instrument defects: `human-speed` (that is the ledger
re-cut's reason to exist) and `velocity-bell` at 10/22, whose cause is located
not guessed — RDP-reduced strokes keep only their endpoints through
`resampleStroke`'s linear `t` interpolation, and `lib/stroke-processing.ts` is
shared with the live canvas where `t` is real recorded input and must not be
re-derived.

### EIGHT instrument bugs, all found by RUNNING rather than reading

> ⚠ **ELEVEN as of 2026-08-01, and the three added are a DIFFERENT CLASS.** The
> eight below all had something change underneath a constant; the defence is to
> derive every window from the model's own offsets. Items 9–11 —
> `assert-taper-envelope.mjs`, `assert-joint-beading.mjs`,
> `assert-layer-flicker.mjs` — were **born unable to fail** and nothing changed
> underneath them, so deriving helps nothing and the only defence is an audit.
> That audit is now itself an assertion: **`scripts/verify/assert-gate-integrity.mjs`**,
> exit 1, naming the two still red. Storyboard §11.8 items 9–11.

Recorded together in `docs/hero-beat-storyboard.md` §11.8, because the pattern
only reads at eight. §10.4's whole lesson is that a gate must be RUN, not read,
and this is now the strongest evidence in the repo for it.

1. the emerge window derived by phase NAME → ran **backwards** after the reorder (72 frames, negative span, every filename correct)
2. a "blank frame" at the moment that was **CLIPPING** — an expanded dock squeezed the stage 1120×702 → 1120×350
3. the gate's fixed `+0.55 s` window → **`settled` taken from the DWELL** (24 px), every threshold measured against the frames it was judging
4. **the vacuous yaw claim** — `yaw <= 90` passed on the parked ramp, whose yaw is 0 on every frame
5. **the overshoot window read a flat 10.0° on BOTH arms** — hardcoded at 4.30 s, which lands where the camera is parked at el 0
6. **`hold.png` landing on the flat return** — K7 moved the shot out from under its name, so a row asserted "lit object" on a drawing and read `sd 0.0` on both arms: a gate that cannot PASS
7. **the blind area-symmetric reversal control** — inked area is symmetric under reversal, so an area metric cannot see direction; the position metric separates the arms 7.8 % vs 91.1 %
8. **gate 2 sampling a phase that is flat BY DESIGN** — `hold` is the returned drawing now, `sd 0.00 / spread 0.0`, and gate 2 was asking it for the tonal range of a lit solid

**Six of eight were caused by the beat changing underneath a constant.** Every
hardcoded time in this beat's tooling has now been wrong at least once. Three
could not fail and two could not pass — the same defect in opposite colours, and
both invisible without a control.

### Handed figures that did NOT survive checking — five of them, and none changes a conclusion

- *"median stroke 160.9 ms"* at a 4.67 s draw — **measured 100.1 ms.** 4.666 s is
  *defined* as the beat that puts the median stroke exactly on the 100 ms floor,
  so 100 ms is the number, and it is the cleaner statement.
- *"6.97 s still leaves the shortest stroke at 5.6 ms"* — **measured 100.0 ms**,
  also by construction. The 3-point tick and its 0.153 % of the word are both
  confirmed exactly; only the 5.6 ms is not, and the likeliest source is the
  projection probe's `worst 5.61 px`. **The argument against 6.97 s stands on
  different and better ground**: stillness 30.5 %, below the bar.
- *"read stillness 37.2 % / 31.4 %"* — **measured 36.1 % / 30.5 %.** Both handed
  figures assume 138 still frames; the model produces **134**. The 4.67 s case
  still clears the bar, by one third of a frame instead of by 1.2 points.
- Also: the contact shadow's *"135,509 pixels after"* is not on disk and was not
  reproduced (the before-figure is verbatim in the code); and reduced-motion's
  *"2/4 → 4/4"* — the 4/4 is verified, the 2/4 before-state is not reproducible
  from the shipped script, though the breakage mechanism is confirmed in the
  camera assert's per-dial control matrix.

⚠ **`lib/hero-motion.ts` was edited by a live lane at 20:45 mid-pass.** Readings
before that gave 43 repeat frames / 45.1 %; after, 44 / 45.4 %. Every figure above
is the later one. These numbers are true of a working tree at a timestamp.

### FOR THE LANE THAT OWNS `lib/hero-motion.ts` AND `scripts/verify/assert-hero-ledger.mjs`

**UNBLOCKED.** §10.3's re-cut ledger is landed and the value is expressible:
set `beats.draw` to **`140 / 30`** and `LEDGER.draw` to **`140`**. Nothing else in
the ledger moves. Expect `assert-hero-ledger.mjs` to report **371 frames /
12.37 s** and read stillness **36.1 %** — and note that the fourth row's margin
is one third of a frame, so if you also change any phase that contributes still
frames, re-read that row rather than assuming it.

### NOT done, stated plainly

> ⚠ **THE FIRST TWO BULLETS ARE CLOSED — 2026-08-01, verified by running
> `assert-hero-ledger.mjs`.** The model ships **`draw: 140` / 4.6667 s**, not
> `draw: 64`; the re-cut is landed, not a document. And the margin is stated
> exactly rather than as *"one third of a frame"*: **134 frames against a
> required 133.56 = 0.44 of a frame.** (The "one third" reading comes from
> 36.1 − 36.0 = 0.1 % of 371; the direct arithmetic is the safer one to quote.)
> The bullets are left standing per the never-delete rule.

- **No code was written and none should be inferred as written.** The re-cut is a
  document; the model still ships `draw: 64`.
- **The 36.1 % margin is not comfortable and this pass did not spend it.** The two
  ways to widen it (draw on twos; restating the bar against the payoff unit) are
  both named with their measured values and both left as calls.
- **`docs/storyboard/*.png` thumbnail sheets still show the old beat** and were
  not re-rendered.
- **Sebs's picks are untouched:** call 1's flat-vs-changed-flat is answered in
  code but the pick between it and the parked `ret.mode: "identical"` is his, and
  the orthographic stage **changes the look** (axonometric rather than
  photographic; measured: the ¾'s tonal range is not reduced, the sliver reads
  17 px vs perspective's 24 px).

---

## CHECKPOINT — The reveal stopped rebuilding, and DialKit took the clock

Write-up: `docs/explainers/18-the-reveal-stopped-rebuilding.md`.
Research: `docs/research/reveal-cost-and-timeline-ownership.md`.

### The previous agent's revert DID complete

It was cut off mid-sentence, so this was checked first. `app/desk-doodles/page.tsx`
carries the labelled pills, the `chromeless` viewport and the phase-progress
readout, and carries NO `FlatInkLayer` / `useDialTimeline` imports. Typecheck was
at the 51-error baseline. Nothing to unwind.

One thing the revert could not have restored: **`dialkit` was gone from
`node_modules` entirely** — it had never been in `package.json`, so some
`npm install` pruned it as extraneous. It and its `motion` peer are now real
dependencies (`dialkit@^1.4.3`, `motion@^12.43.0`).

### The 1.1s stall is gone at its source

**Measured first, in node.** `scripts/verify/measure-implicit-cost.mjs` runs the
real engine under `_ts-load.mjs` — none of the polygoniser touches WebGL — so the
cost split is readable at a hundred sample points with no compositor in the
signal. Hero word, `resolution: 5`:

    reveal 0.05 -> 24.5ms    0.50 -> 246.7ms    1.00 -> 531.5ms
    split: march 55% / normals 39% / audit 6% / acceleration grid ~0%

It is a **RAMP, not a cliff** (full/half = 2.15x, linear in revealed arc length),
already over a frame budget at five percent of the word, and one draw-in asks for
~120 of them inside 2.6s. That kills all four candidate fixes on the numbers:
`res 3` still costs 158ms; a signature cache does nothing for the FIRST play;
build-at-mount does nothing for a reveal that needs a different surface every
tick; building progressively IS the defect.

**So the rebuild stopped happening.** `lib/implicit-surface.ts` §6 derives an
arc-length ordering marching cubes does not give you — nearest-capsule key per
vertex, max per triangle, counting-sorted index buffer — and `AnimatedStrokes`
reveals Inflate/implicit by binary search + `setDrawRange`, which is Rod's
mechanism, unchanged since Rod. Zero geometry work per frame. Surcharge 39ms
once, on a build that already cost 600ms and now runs once instead of 120 times.

Real time, through the page's own Play button, headed Metal:
**worst frame 1100ms -> 10.4ms, 0 frames over 100ms, and the 0.54s emerge gets 65
frames where it used to get none.**

Proved, not asserted (`scripts/verify/assert-implicit-reveal.mjs`): the drawRange
reveal inks the same region the rebuild did (worst 0.52% of word width across six
playheads); the surface is byte-identical in positions and normals with the same
147,452 triangles, only reordered; and a NEGATIVE CONTROL with the keys reversed
FAILS at 100%, so the metric can fail.

### DialKit owns the beat

> 🔨 **⚠ Stale in its numbers, not in its mechanism (2026-07-31).** *"Eight
> phases, eight clips"* → **twelve** (`land`, `solid`, `descend`, `returnTurn`
> landed); *"the 0.54s emerge"* → **0.9167 s**; *"total 10.20s → 9.08s"* → the
> beat is **9.833 s**. And *"worst frame 1100ms → 10.4ms"* disagrees with
> `explainers/18`'s own table, which says **16.7 ms** —
> `hero-beat-storyboard.md` §10.3 uses the doc's figure. The derivation
> (`HeroBeats` from `tl.<phase>.duration`, a second copy unrepresentable) is
> unchanged and still correct. Left standing per §0.7.

Eight phases, eight clips. `HeroBeats` is DERIVED from `tl.<phase>.duration` and
the page's own state is `Omit<HeroMotionParams, "beats">`, so a second copy is
unrepresentable rather than merely discouraged. The playhead is `tl.time`; the
page's rAF loop is deleted. The Beats panel has NO sliders — it reports live
values and says where to drag.

`at` is derived: the phases are strictly sequential, so the page writes the
cumulative sum back into DialKit's store whenever it disagrees (DialKit's
`reconcileValues` preserves stored values against changed defaults, so a
config-side push is not an option). Edge-drag ripples; body-drag snaps back,
which is correct for a fixed phase order.

**This could not have landed before the stall was fixed.** `TimelineStore.tick`
advances on a raw unclamped `now - lastTick`; the page's old `MAX_STEP = 0.25`
clamp existed solely to stop the stall swallowing the emerge. Handing the clock
to DialKit with the stall still present would have restored the skipped beat.

Verified by driving the REAL dock: locate the ORBIT clip by DialKit's own
`title`, grab `[data-edge="end"]`, drag — `orbit 3.200s -> 2.080s`, total
`10.20s -> 9.08s`, then Revert restores both.

### Gates

- `verify-gates.mjs` **ALL GATES PASS**, 0 console errors.
- `verify-hero-page.mjs` 20/20, 0 console errors — `docs/verification/hero-page/final/`.
- `assert-implicit-reveal.mjs` all pass, negative control rejects.
- Frames: `docs/verification/hero-transition/drawrange/` (100 scrub + 72 emerge + video).
- Typecheck **51**, the unchanged pre-existing baseline.

### Pre-existing, NOT caused here

`assert-inflate-fusion.mjs` is 21/23. Both failures (`D2`, `D4`) are the single
`blend 0` data point — the hard-union control, where there is no smooth minimum
and therefore no k/6 law to obey, and whose 4.5% outlier is also what breaks D4's
monotonicity. Marching-cubes discretisation at a hard crease. That this pass did
not cause it is a measurement, not an argument: the reveal work is proved
index-order-only, byte for byte.

### Also fixed in passing

`AnimatedStrokes` read `strokeMeshData.jointFractions.length` on the same line it
guarded the next access with `?.[ji]`. `jointFractions` is optional, so that was a
real throw waiting for any Rod mesh without joints.

### NOT done / deliberately untouched

- **The beat's choreography, `lib/hero-motion.ts`'s timing model and the flat->3D
  mechanism** — all under redesign, all left alone. Nothing here tunes them; the
  work was to make the beat playable at whatever tempo the storyboard picks.
- **A geometry cache keyed on stroke signature is still absent.** Two identical
  builds measured 523.6ms then 530.8ms. It no longer matters inside the beat (the
  beat builds nothing), but it is still ~600ms on every hand-feel dial move.
- **Inflate/implicit falling back to the loft loses its reveal** — the loft mesh
  has no reveal table, so the draw-in would show the finished word at once. Named
  in the code at `inflateRevealsByDrawRange`; basing the flag on the built mesh
  would be circular.
- **DialKit's ruler keeps a dead tail** when the beat is shortened below the
  captured 10.2s. The page clamps its own transport to the clip sum, so the tail
  is unreachable through the page's controls but still drawn on the dock.

### Not committed

Nothing was committed. Working tree + index only, as instructed.

---

## CHECKPOINT — The rim and the bead (all-modes geometry, pass 4)

Write-up: `docs/explainers/16-the-rim-and-the-bead.md`.
Research updated: `docs/research/extrude-solid-quality.md` §7 ("what has landed").

### Landed, measured, verified on frames

1. **Rod's joint beading is fixed.** `detectJoints3D`'s predicate was inverted —
   it tested `π − acos(cosAngle)` (the interior angle) rather than `acos(cosAngle)`
   (the turn), so it fired on straight runs and stayed silent at hairpins. That
   is the 166-meshes-for-a-two-stroke-crossing census. With it corrected, both
   sphere passes take `RADIAL_SEGMENTS` (the old 8 was a compensation for the bug's
   own symptom — 44.22° max crease on every Rod fixture, 360/8).
   `assert-joint-beading.mjs --compare` holds **both** signs: `word` 205 → 2,
   `loopyS`/`openC` 0, and `zigzag` keeps all **7** of its real corners.
   Regression net: Rod −62% to −86% verts on all 8 shapes; Extrude/Solid/Inflate
   byte-identical on all 24 of their cases.
2. **`__geomDebug.stats()`'s joint census had gone structurally blind** and this
   nearly shipped as "the fix removed all the beads". It separated caps from
   joints by VERTEX COUNT ("225 vs 81, nothing else can land in these buckets"),
   which stopped being true the moment the two tessellations were unified: both
   became 289 verts, the `else if` became unreachable, `jointSpheres` became
   permanently 0. Now the meshes carry a part tag (`FS_PART_CAP`/`FS_PART_JOINT`)
   and the census reads the tag, with an `untagged` count so a pass that loses its
   tag shows up as a number rather than as a clean zero.
3. **Solid has a bevel.** `insetLoopAgainstMask` in `lib/solid-mask.ts` (inward
   offset, per-vertex miter clamped by probing the source raster) feeds a rewritten
   H3 **ring-stack** assembly. `mixed` bucket: was mean 90.0 / max 90.0 / *every*
   edge on every fixture; now `tick` and `circle` land on Extrude's exact signature
   (mean 15.3–15.9, **max 30.0**) and the over-30 count fell from 100% of edges to
   33–35%. The residual `max` on `square` (90) and `crossing` (89) is at genuine
   drawn corners, where a crease is correct.
   Frames: `docs/verification/gloss-rim/bevel_final/` — 4 fixtures × 72 orbit
   frames + video + 3 ink-gated closeups, glossy, headed, Metal. Compare
   `gloss-rim/after/crossing_solid/closeup_1.png` (hard black-to-cream terminator)
   against `bevel_final/crossing_solid/closeup_1.png` (graded highlight band).
4. **`assert-joint-beading.mjs` shipped with the explainer-13 `.entries()` closeup
   bug still in it** (written 14 minutes after that explainer was written). Its
   closeups were the same blank frames. Fixed the same way `verify-gloss-rim.mjs`
   was — `focusView` against `bounds()`, offsets as fractions of the form's radius,
   every frame ink-gated before it is written.
5. **`geometry-baseline.mjs` no longer degrades silently** (kept from the previous
   pass): `stats()` missing is now a hard failure instead of a fall-back to
   export-byte-length.

### Cost and gates

Only Solid moved on the net: verts ×2, tris ×4 (two rings → eight; the cap now
shares the ring-0 vertices instead of owning a block, which is why verts only
doubled). Rod/Extrude/Inflate `=`. `verify-gates.mjs`: **ALL GATES PASS**, 0
console errors, export works in all four modes, no geometry rebuild on style
change. Typecheck is at the unchanged 51-error pre-existing baseline.

### NOT done — the honest remainder of "all four modes"

- **Inflate's rim is untouched.** `assert-mode-rims.mjs` reports `cap max
  16.5–38.1` and `mixed max 85–90` on all four Inflate fixtures. Its 90s are the
  marching-cubes surface meeting its own dome caps, not a die-cut edge, so it is a
  different defect from Solid's and needs its own diagnosis. **Judge it on
  `glossyPlastic`, never `softGel`** — a broad sheen lobe averages over a
  discontinuity instead of tracing it.
- **`square/extrude`'s 153 non-manifold edges** (explainer 13 §5b) are still there:
  the ribbon passes through itself at the closed-loop seam. Unchanged this pass.
- **Every Extrude mesh still has 8–12 boundary edges** — the ribbon is not closed.
  Invisible under this rig; it is why an exported GLB is not watertight.
- **The Rod sparse-anchor port was measured and deliberately NOT done.** Desk
  Doodles' `detectJointPositions` carries the same inverted predicate verbatim, so
  their 63-vs-our-205 was never about sparse anchors, and porting it now would
  bead smooth curls. Explainer 15 §1 has the arithmetic and names the predicate
  that would actually be principled (curvature radius vs tube radius). A decision
  for Sebs, not a build.
- **`applyDraftTaper` is still un-wired** (unchanged; see the previous checkpoint).

### Tree health — the `ditherExposure` worry was unfounded

The brief warned that a style-layers agent may have over-applied a replace into
other agents' `FUSION_PRESET_DEFS` and `LAYER_STACK_PRESET_DEFS`. Checked:
`git show HEAD:lib/style-system.ts | grep -c ditherExposure` is **14**, and the
11 occurrences in those two preset families are all present **at HEAD**, committed
by the stack/fusion work itself with its own explanatory note (the "ditherExposure
everywhere dither is on" comment). Only **one** `ditherExposure` line is added in
the staged diff, and the 10 in the working diff are all in `DITHER_PRESET_DEFS` /
`ANIMATED_DITHER_PRESET_DEFS` with per-preset reasoning attached — that agent's own
area. Nothing to restore. Not touched.

### My own damage, reported

`geometry-baseline.mjs` takes `--save=`, not `--label=`. I ran it with `--label`,
so it defaulted and **overwrote `docs/verification/geometry/baseline/`** with the
current state. That directory was untracked, so the original is gone. The run
itself is preserved as `docs/verification/geometry/rodfix/` (post-Rod-fix,
pre-bevel) and `bevel_after/`, and `memofix/` remains as the pre-Rod-fix
reference the Rod comparison was made against. Worth making the two scripts agree
on a flag name.

---

## CHECKPOINT — Measuring the rim (Extrude/Solid quality, pass 3)

Scope: Extrude + Solid only. **Rod and Inflate untouched** — the regression net
(`geometry-baseline.mjs`, 8 shapes × 4 modes) is `=` on all 32 cases, and
`verify-gates.mjs` is ALL GATES PASS with 0 console errors.

Write-up: `docs/explainers/13-measuring-the-rim.md`.
Research: `docs/research/extrude-solid-quality.md` §7–8 (new).

### Landed

1. **The decimation ladder is finished and proven.** `smoothLatticeLoop` now
   retries steps 2–3 down `CONTOUR_DECIMATE_EPSILON_LADDER = [1.4, 0.9, 0.55,
   0.3, 0]` instead of surrendering to the raw staircase on the first area-guard
   rejection. Measured on `crossing/solid`: rim turn mean **90° → 7.74°**,
   alternation **0.987 → 0.058**, and it lands on rung 0.9 with `areaFallbacks:
   0`. Only fixture whose numbers moved at all in the net: `tick/solid`
   (verts −22 %, bytes −11 %).
2. **`__geomDebug.probeDihedral()`** — an order-, winding- and weld-independent
   faceting metric (crease angle across shared edges, keyed by rounded position
   pair, bucketed wall / cap / mixed, plus `boundaryEdges` and
   `nonManifoldEdges`). It exists because BOTH existing rim metrics are
   structurally blind on Extrude — see the explainer.
3. **`__captureHarness.bounds()`** — the form's world centre + radius, the
   accessor `focusView` always needed.
4. **Fixed: every `closeup_*.png` this project has ever captured was blank.**
   `for (const [k, [az, el, fill]] of [[0,[18,10,0.26]], …].entries())` —
   `.entries()` on rows that already lead with their own index, so `fill` was
   `undefined`, the camera went NaN, and the file NAMES were the only thing that
   came out right. `docs/verification/gloss-rim/after/` now has 24 distinct
   non-blank closeups + 8 orbit mp4s, gated by an ink check.
5. **`lib/dd-extrude-relief.ts`** — Desk Doodles' `EXTRUDE_BEVEL_PROFILES`,
   `EXTRUDE_DRAFT_AMOUNT` and `applyDraftTaper` copied verbatim with provenance,
   plus the ×0.3 world-scale conversion as separate `_FS` constants. Closes the
   handoff item "the draft taper port did not land". **Not wired** — see below.
6. **`useStrokeMeshes` deps are now derived, not transcribed.** Was a hand-listed
   set of scalars under a comment saying every consumed field must be listed;
   `bevelSize`/`bevelSegments` were consumed and never listed. Now one
   `paramSig = JSON.stringify([extrudeParams, solidParams, inflateParams])`.
   Closes the handoff item "adding a Bevel control gives a control that does
   nothing". Geometry unmoved on all 32 baseline cases; rebuild gate still passes.

### THE headline finding, measured and NOT fixed

**Solid has no bevel at all.** `probeDihedral` `mixed` bucket (cap face meeting
wall face): Extrude **mean 15.4° / max 30.1°** (the ported 3-segment rounded
profile), Solid **mean 90.0° / max 90.0° on every edge of every fixture** — a
spike, not a distribution. Visible directly in
`docs/verification/gloss-rim/after/crossing_solid/closeup_1.png`: a near-white cap
meeting a near-black wall at an absolutely hard terminator, versus
`word_extrude/closeup_1.png` where a graded cream band runs along the rim. Desk
Doodles' own comment on the constant says the profile is *"Shared by Extrude +
Solid"*; this repo ported the Extrude half.

Not attempted this pass because it is not a copy-paste: DD gets it free from
`THREE.ExtrudeGeometry`, Free Stroke's H3 assembles caps and walls by hand, so it
needs an **inward offset of a mask-derived contour with holes**. Research §7 lays
out the three candidate approaches and argues the right one for this codebase is
tracing the offset as an isoline of the coverage field already in `solid-mask.ts`
(topologically safe by construction; the bevel vanishes on a stem thinner than
2× the offset instead of inverting). Guard must be a ladder, same as §5b.

### Also measured, also not fixed

- **`square/extrude`: 153 non-manifold edges** — an edge shared by >2 faces, i.e.
  the ribbon passes through itself at the closed-loop seam. Its worst creases
  (`wall max 51°`, `mixed max 60.2°`) are at that overlap. Nothing had ever
  measured this. This is a literal instance of *"the edges and overlaps, the
  geometry gets all weird."*
- **Every Extrude mesh has 8–12 boundary edges** — the ribbon is not closed. Does
  not show under this rig; will show the first time anything does a boolean or a
  thickness op on an exported GLB.
- **Residual fray at the crossing notch** on `crossing/solid` (visible in the
  closeup) — the ladder took rung 0.9 there, so less staircase was collapsed than
  on a wide form. §7's "set the first epsilon from the local half-thickness the
  rasteriser already knows" would fix this properly.
- **`applyDraftTaper` is deliberately un-wired.** It shrinks toward *the
  geometry's own* bbox centre; DD hands it one pooled slab, Free Stroke's Extrude
  emits one geometry per stroke, so a verbatim call would taper each letter toward
  its own centre and a word would read as five separate mouldings.
  `applyDraftTaperAbout` in the same file takes the centre as an argument; wiring
  needs the aggregate mark bbox, a `sideWall` dial, and Sebs's eye.

### Operational hazard for the next agent

A concurrent agent ran `git stash` / `git stash pop` cycles on the shared tree
roughly every 1–3 minutes during this pass. Consequences seen: `lib/solid-mask.ts`
and `lib/geometry-engines.ts` silently reverted to HEAD twice mid-session; the dev
server served a broken bundle (`Export DEFAULT_INFLATE_PARAMS doesn't exist`)
because `app/page.tsx` was un-stashed while `geometry-engines.ts` was stashed;
three browser verification runs died with `window.__geomDebug?.stats is not a
function`. Everything recovered, and a copy of the three tracked files was taken
out-of-tree as insurance. **Do not start a long geometry edit or a multi-minute
capture without checking `git stash list` and `wc -l` on the file first.**

### Not committed

Nothing was committed. Working tree + index only, as instructed.

## Solid checkpoint

- **name:** Solid Checkpoint B — Extruded Filled Silhouette
- **status:** frozen / validated for filled silhouettes
- **active mode:** `EXTRUDE_FROM_FLAT_BASE`
- **validated result:** coherent extruded solids across tested filled-silhouette cases
- **limitation:** true hole preservation not implemented

### What is working

- FLAT_BASE is valid
- EXTRUDE_FROM_FLAT_BASE works for filled-silhouette extrusion
- rasterization is working
- outer contour extraction is working
- validation gate is working
- manual extrusion from the validated flat base is working
- no shredded / sliver / rib artifacts in the tested filled-silhouette cases

### Validated cases

- open C-shape
- loopy cursive
- messy / angular scribble
- thin extreme
- thick extreme
- near-touch / closed-looking loop as filled silhouette

### Important limitation

- true hole preservation is NOT supported yet
- a clean O / donut should ideally preserve the center hole, but the current pipeline fills it because it extracts and extrudes only the largest outer contour
- `contourClosed: YES` means the generated mask boundary is closed; it does NOT mean the original source stroke was closed
- `holes: 0` means inner negative-space preservation is not implemented yet

## Do not regress

These are non-negotiable for this checkpoint:

- do not reopen raster / contour / validation unless a specific new failure proves it is necessary
- do not touch FLAT_BASE
- do not touch EXTRUDE_FROM_FLAT_BASE without preserving the current checkpoint
- do not treat hole filling as a bug in this checkpoint; treat it as a future Solid subphase

## Future Solid subphase

### Solid Hole Preservation / Ring Support

- **goal:** detect inner contours and preserve holes for O / donut-style shapes
- **likely requires:** inner contour detection, Shape holes, inner wall generation, and export parity
- **scope:** this is separate from the current filled-silhouette checkpoint and must not regress it

## Solid preview / export parity

- **status:** CONFIRMED (verified by code inspection, no code changes required)
- **shared function:** `buildMaskSolid()` in `/lib/solid-mask.ts`
- **active mode in shared function:** `EXTRUDE_FROM_FLAT_BASE` (module-level constant `SOLID_GEOMETRY_MODE`, so both call sites receive the same mode)
- **preview call site:** `SolidEngine.buildPreview` in `/lib/geometry-engines.ts` (line 3168)
- **export call site:** `SolidEngine.buildExport` in `/lib/geometry-engines.ts` (line 3267), invoked from `handleExportGLB` in `/components/viewport-3d.tsx` (line 819) via `engine.buildExport(processedStrokes, ...)`
- **identical inputs across both paths:**
  - same `strokesToTestStroke(strokes, canvasWidth, canvasHeight)` conversion
  - same `coordScale = 3.0 / max(canvasWidth, canvasHeight)`
  - same `worldThickness = solidParams.thickness * coordScale`
  - same `solidParams.depth` value
  - same `canvasWidth`, `canvasHeight` arguments
- **no legacy paths in use:** neither path uses old `THREE.ExtrudeGeometry`, old contour code, or any disabled Solid branch
- **export-only post-processing:** `geometry.computeBoundingBox()` + translate-to-origin (centering for clean export); does not alter vertex topology

## Solid animation checkpoint

- **name:** Solid Basic Draw-In Animation — Smoothed
- **label:** `SOLID_BASIC_DRAW_IN_ANIMATION_PASS`
- **status:** frozen / visually acceptable for MVP

### What is working at this checkpoint

- active geometry path: `EXTRUDE_FROM_FLAT_BASE`
- validated `FLAT_BASE` fallback / base checkpoint still intact
- filled-silhouette extrusion working
- preview working
- GLB export working
- preview / export parity confirmed by code inspection
- manual GLB export smoke test passed
- debug panel gated behind Debug mode
- Debug OFF no longer blocks playback controls
- basic Solid draw-in animation working
- smoothed Solid animation now visually acceptable for MVP

### Animation implementation

- Solid animation uses partial stroke progress to rebuild Solid geometry during playback.
- The smoothing pass replaced raw point-count reveal with arc-length-based reveal.
- The current cut point is interpolated inside the active segment, instead of snapping to the next whole point.
- `progress <= 0` returns empty / near-empty state.
- `progress >= 1` returns the original full strokes unchanged, so final frame should match static preview.
- React animation state now updates often enough for a smoother MVP reveal.
- Rod and Extrude animation paths remain separate / untouched.
- Export still uses full unfiltered strokes.

### Known limitations at this checkpoint

- Solid reveal is rebuild-based, not shader-based.
- Long / dense drawings may still cause micro-stalls because Solid rebuilds raster + contour + extrusion during playback.
- Solid reveal uses uniform arc-length pacing, not authentic pen-speed timing yet.
- No advanced animation editing yet.
- No shader / gel-pen reveal yet.
- No hole preservation yet.
- No Inflate work yet.
- Do not reopen Solid raster / contour / validation / extrusion unless a regression appears.

### Next recommended steps

1. Run one quick cross-mode QA pass:
   - Rod playback / export
   - Extrude playback / export
   - Solid playback / export
2. Then start the Solid holes branch.
3. Keep Inflate after holes, because Inflate should branch from the stable Solid filled-silhouette base.

## Cross-mode QA checkpoint

- **name:** Cross-Mode QA Pass — post Solid animation smoothing
- **label:** `CROSS_MODE_QA_PASS`
- **status:** passed / no regressions across modes

### QA results

- Rod playback works
- Rod GLB export works
- Extrude playback works
- Extrude GLB export works
- Solid playback works
- Solid pause / replay works
- Solid GLB export works
- Debug gating works
- Debug OFF does not block playback controls

### Current locked Solid status

- active path: `EXTRUDE_FROM_FLAT_BASE`
- `FLAT_BASE` validated as stable base / fallback
- filled-silhouette extrusion validated
- Solid preview works
- Solid export works
- preview / export parity confirmed by code inspection
- manual GLB export smoke test passed
- debug panel gated behind Debug mode
- basic smoothed Solid draw-in animation passed
- Rod / Extrude remained working after Solid animation changes

### Known limitations carried into next phase

- no hole preservation yet
- Solid reveal is rebuild-based, not shader-based
- no advanced animation editing yet
- no Inflate work yet

## H1 hole detection checkpoint

- **name:** Solid Hole Support Phase H1 — Detection Only
- **label:** `SOLID_HOLE_SUPPORT_H1_DETECTION_PASS`
- **status:** complete / detection validated

### H1 scope

- detection only
- no geometry behavior change
- no cap cutting
- no inner walls
- no hole extrusion
- no export changes
- no animation changes

### What was added

- `detectInteriorHoles()` in `/lib/solid-mask.ts`
  - inverted-mask flood-fill hole detection
  - 4-connectivity with 4 conservative filters (min area, min bbox, min ratio, border inset)
- Extended `MaskSolidDiagnostics` interface with 7 H1 fields
- Extended `solidDiagnostics` output to include H1 fields in all code paths
- Visible debug panel fields:
  - `holeDetectionEnabled`
  - `detectedHoleCount`
  - `validHoleCount`
  - `rejectedHoleCount`
  - `largestHoleArea`
  - `holeAreas`
  - `holeRejectReasons`
- New "HOLE DETECTION (H1)" subsection in `SolidDebugOverlay` (viewport-3d.tsx)

### Empirical validation results

- open C-shape: reports zero valid holes ✓
- simple line: reports zero valid holes ✓
- big O / donut: reports at least one valid hole ✓
- near-touch open gap: reports zero valid holes (unless raster thickness bridges the gap) ✓
- loopy/messy strokes: do not produce bogus valid holes ✓

### Important limitation

- Holes are detected and reported in the debug panel
- 3D Solid output **still fills the interior** (no visible hole yet)
- This is expected, not a regression — H2/H3 have not been implemented
- Geometry output (caps, walls, extrusion) is byte-identical to locked `EXTRUDE_FROM_FLAT_BASE`

## Next branch — `SOLID_HOLE_SUPPORT_PHASE_H2_FLAT_CAP_WITH_HOLES`

- **scope:** use detected valid holes in flat cap only
- **goal:** prove `FLAT_BASE` can render a donut with a visible hole
- **explicitly out of scope for H2:**
  - no extrusion with holes yet
  - no inner side walls yet
  - no export/animation changes yet

## Extrude recovery checkpoint

- **name:** Extrude Continuous-Ribbon Width/Depth Recovery
- **label:** `EXTRUDE_CONTINUOUS_RIBBON_WIDTH_DEPTH_PASS`
- **status:** locked / usable enough to unblock Solid H3

### What is now true

- Extrude no longer relies on Rod fallback for normal loopy handwriting.
- Legacy offset-ribbon strategy still exists (still tried first).
- Raster trace strategy still exists as experimental / non-default.
- Rod fallback still exists only as emergency fallback (degenerate input only).
- Continuous-ribbon fallback is the usable fallback for normal handwriting when legacy contour fails.
- Depth works as a multiplier of effective width (decoupled from XY footprint).
- Width range is now more controlled (calibrated slider + safe-envelope clamp inside the engine).
- Depth range can be more expressive (multiplier max raised, world-space ceiling raised).
- Preview/export parity is preserved (both flow through the same `tryBuildExtrudeGeometry`).
- Debug panel shows width/depth trace values clearly (`widthSliderValue`, `effectiveWidthUsed`, `depthMultiplierSliderValue`, `effectiveDepthUsed`, `depthToWidthRatio`, `geometryBBoxZ`).
- Solid H1/H2 code was not touched.

### Important note

- This checkpoint does NOT mean Extrude is final-polished.
- It means Extrude is usable enough to stop blocking Solid H3.
- Future polish can improve joins, caps, and style quality later.

## Next branch — `SOLID_HOLE_SUPPORT_PHASE_H3_EXTRUDED_HOLES_AND_INNER_WALLS`

## Solid H3 control calibration checkpoint

- **name:** Solid H3 Control Calibration
- **label:** `SOLID_H3_CONTROL_CALIBRATION_PASS`
- **status:** locked / stable enough to unblock the next QA pass

### What is now true

- Solid H3 is functionally active.
- H3 uses H2 flat cap with holes as source.
- H3 builds front cap, back cap, outer walls, and inner hole walls.
- Solid Depth now affects actual H3 thickness.
- Thickness and Depth controls now use calibrated effective values.
- Mid-slider no longer enters breaking territory too early.
- Breaking / experimental territory is now reserved closer to the upper end of the Thickness slider.
- Preview/export parity is preserved through the same effective thickness/depth mapping.
- H3 debug panel exposes raw-vs-effective Thickness and Depth values.
- Rod, Extrude, and Inflate were untouched.

### Important note

- This does NOT mean Solid is final-polished.
- It means Solid H3 is stable enough to stop blocking the next QA pass.
- Future polish can still improve surface smoothness, edge cleanup, material feel, and extreme slider behavior.

## Next branch — `SOLID_H3_QA_EXPORT_ANIMATION_CLEANUP`

- verify GLB export preserves H3 through-holes
- verify exported mesh is non-empty
- verify animation final frame matches static H3 geometry
- confirm open C does not create fake holes
- confirm big O / donut exports with a through-hole
- confirm b-like counters remain viable at normal/default controls
- document any remaining limitations before Inflate

## Solid H3 animation cleanup checkpoint

- **name:** Solid H3 Animation Cleanup
- **label:** `SOLID_H3_ANIMATION_CLEANUP_PASS`
- **status:** locked / smoothness + reset behavior unblocked, ready for next QA

### What is now true

- Arc-length reveal with sub-segment interpolated cut point is confirmed in use (constants surfaced in the debug panel as proof, not assumption).
- Start/reset flash is eliminated: a `useLayoutEffect` in `Scene` synchronously snaps `solidAnimProgress` to `playheadRef.current` on the false→true `playing` transition when the playhead was just reset, so the first painted frame of playback is the empty/partial mesh — not the previously full mesh.
- SolidAnimationTick cadence is now time-dominated (~45 Hz, 22 ms gate). The prior 0.003 progress-delta floor was relaxed to a `> 1e-5` no-op guard, eliminating chunking at slow speeds and at extreme totalDuration values without spamming rebuilds.
- Boundary syncs at progress 0 and progress 1 are preserved, so the final frame is bit-equal to static H3 (filter short-circuits to the original strokes ref at `progress >= 1`).
- Animation diagnostics live in a new `SOLID_ANIM_DEBUG` singleton (in `lib/geometry-engines.ts`), written by `Scene` and polled by the existing `SolidDebugOverlay`. No new prop plumbing.
- Topology popping is **classified, not faked**: when `validHoleCount` changes during an active animation the panel increments `topologyChangeCount`. No hysteresis is applied; static H3 hole detection is untouched.
- Per-Play counter reset: `solidAnimationRebuildCount` and `topologyChangeCount` reset to 0 every time the user starts playback.
- Export path is unaffected: it always builds from full `processedStrokes`, never from animated subsets.
- Rod, Extrude, Inflate, H1/H2/H3 static geometry, and hole detection thresholds were not touched.

## Next branch — `SOLID_H3_ANIMATION_QA_AND_INFLATE_PREP`

- record clean playback at 0.5x / 1x / 2x and confirm no chunking
- replay 3x in a row, confirm no flash and no stale full-mesh frame
- confirm `finalFrameMatchesStatic = YES` at end of every replay
- confirm export GLB still uses full strokes (no animated subset)
- begin Inflate bridge from the locked Solid filled-silhouette base

## Solid H3 ANIMATION_GATED hole stabilization checkpoint

- **name:** Solid H3 Animation Hole Stabilization
- **label:** `SOLID_H3_ANIMATION_HOLE_STABILIZATION`
- **status:** wired end-to-end, behind animation gate only — static + export unaffected

### What is now true

- `buildMaskSolid` accepts an OPTIONAL `holeStabilization` parameter (mode `"ANIMATION_GATED"`, plus `activeFinalHolesWorld`). Static, Rod, Extrude, and Solid export paths never pass it; their behavior is byte-identical to before.
- On the animation path only, Scene snapshots the final-pass hole world contours from the currently-displayed static H3 (`SOLID_DEBUG.lastStages.solidDiagnostics.stableHolesWorld`) at the false→true `playing` transition. No extra `buildMaskSolid` call is needed — the static mesh the user was already looking at IS the reference.
- A per-final-hole activation state machine runs after each animated build: it matches `detectedPartialHoleCentroidsWorld` (newly stamped by `buildMaskSolid`) against the snapshotted final hole centroids using a per-hole tolerance of `0.7 * sqrt(area/π)`. Threshold = 1 hit (first-match activation), sticky for the rest of playback.
- The H2 gate in `buildMaskSolid` now also opens when `holeStabilization` carries at least one active final hole, so the override stays live across brief partial-detection drop-outs. When opened, the override replaces `orderedHoles`/`orderedAreas` with the topologically-safe subset of activated finals (centroid must lie inside the current partial outer), and that exact subset feeds cap triangulation, the H3 inner walls, and `stableHolesWorld` diagnostics.
- New diagnostics (panel-visible under `HOLE STABILIZATION` in the Solid Debug overlay): `holeStabilizationActive`, `finalHoleReferenceCount`, `activatedFinalHoleCount`, `lastPartialCentroidCount`, `perHoleHitStreaks`, `perHoleMissStreaks`, `perHoleActivationRadius`, `lastRejects`. The override's per-hole reject reasons (`degenerate-contour`, `centroid-outside-partial-outer`, `world-area~0`) are surfaced verbatim.
- Override clears automatically when playback stops or `solidAnimProgress >= 1`, so the static/final frame uses the unstabilized path and stays bit-equal to pre-animation static H3.

### Pipeline summary (animation, per frame)

1. Scene computes `animatedStrokes` from arc-length progress.
2. Scene reads `activationRef.current` and builds `holeStabilization` only when activation transitions; otherwise reuses the last ref. A signature key feeds `useStrokeMeshes`'s `useMemo` deps.
3. `SolidEngine.buildPreview` forwards `holeStabilization` to `buildMaskSolid`.
4. `buildMaskSolid` runs normal partial-frame H1/H2 detection AND, if the override has active holes, substitutes its filtered subset before cap triangulation and H3 wall assembly.
5. After the build, Scene reads partial centroids from `SOLID_DEBUG.lastStages.solidDiagnostics.detectedPartialHoleCentroidsWorld`, updates streaks, possibly flips activation, and (on flip) bumps the stabilization key.

### Next QA

- record clean playback on H, O, B, 8, & — confirm zero hole flicker once a hole has been seen once.
- replay multiple times in a row, confirm `finalHoleReferenceCount` matches static H3 hole count every time.
- confirm static H3 (paused or stopped) shows `holeStabilizationActive: NO`.
- confirm export GLB hole count == static H3 hole count == final animation frame hole count.

## Solid H3 animation hole stabilization RESTORED checkpoint

- **name:** Solid H3 Animation Hole Stabilization Restored
- **label:** `SOLID_H3_ANIMATION_HOLE_STABILIZATION_RESTORED_PASS`
- **status:** locked / visually acceptable for MVP — do not reopen

### What is now true

- The bad `FILLED_DURING_REVEAL_COMMIT_AT_END` strategy was removed.
- Solid animation is back on `STICKY_FINAL_HOLE_CONTOURS`.
- Active final holes are no longer re-evaluated against the partial silhouette every frame.
- Once a hole activates during playback, it stays active for that playback session.
- Final frame force-activates remaining final holes so it matches static H3.
- The huge filled-blob-to-holed-mesh snap is gone.
- Solid animation is visually acceptable for MVP and should not be reopened right now.
- Static Solid H3 geometry/export remain unchanged.
- Rod, Extrude, and Inflate were untouched.

### Important note

- This is not final animation polish.
- Some tiny topology weirdness may still exist because Solid animation rebuilds partial geometry.
- That is acceptable for MVP.
- Do not keep iterating on Solid animation unless a major regression appears.

## Next branch — `CROSS_MODE_SMOKE_TEST_BEFORE_INFLATE`

- Rod animation still plays.
- Extrude animation still plays progressively.
- Solid animation still plays with stable enough holes.
- Solid final frame matches static H3.
- Export still exports the full static model, not animated partial strokes.
- If smoke test passes, move to `INFLATE_MODE_PHASE_1`.

## Inflate Phase 2 preview lock checkpoint

- **name:** Inflate Phase 2 Preview Locked for MVP
- **label:** `INFLATE_PHASE_2_PREVIEW_LOCKED_FOR_MVP`
- **status:** locked / accepted for MVP preview — do not reopen Inflate geometry unless a major regression appears

### What this checkpoint records

- Inflate preview is accepted for MVP.
- Remaining Inflate visual polish (true balloon physics, metaball joins, export) is post-MVP.
- Do not reopen Inflate geometry/material tuning unless a major regression appears.
- Next branch is `INFLATE_EXPORT_AND_FINAL_PROJECT_QA`.

### Final cross-mode QA results (verified in-browser)

QA method: drew one loopy S-curve stroke (41 raw → 275 processed pts) and exercised every mode live in the running preview (Chromium via agent-browser). Zero JS console errors and zero server runtime errors across all mode switches and slider interactions (only cosmetic `/icon*.png` + `/icon.svg` 404s, out of scope).

- **Rod QA — PASS**
  - Preview renders a thin 3D tube.
  - Play button + speed controls (0.5x / 1x / 2x) present and toggle correctly.
  - Reveal completes and returns to the full static frame (reset/replay behavior intact).
  - Export GLB enabled.
- **Extrude QA — PASS**
  - Preview renders a flat continuous ribbon.
  - Width / Depth / Bevel controls present and functional.
  - Progressive reveal + replay/reset behavior intact.
  - Export GLB enabled.
  - Remains visually distinct from Inflate (flat ribbon vs rounded volume).
- **Solid QA — PASS**
  - Preview renders the filled extruded silhouette.
  - Thickness / Depth controls present and functional.
  - H3 holes/counters path intact (static H3 unchanged by this QA).
  - Animation acceptable for MVP; final frame matches static.
  - Export GLB enabled (full static geometry).
- **Inflate QA — PASS**
  - Preview renders a rounded, soft volumetric body (no empty viewport).
  - Width (Thickness) changes stroke thickness — verified 38px → 64px visibly thicker.
  - Puff changes fullness/roundness — verified 0.18 → 0.50 visibly fuller/rounder.
  - No shredded Solid-normal bands, no old raster dome seam.
  - Soft matte-with-sheen material is visibly distinct from the glossy Rod/Extrude/Solid material.
  - Export is intentionally disabled with a clear "Phase 1 preview · export disabled" label (Phase-2 export is the next branch).

### Visual distinction Inflate vs Extrude

- **CONFIRMED distinct enough for MVP.** Extrude reads as a flat directional ribbon/strip; Inflate reads as a soft, rounded, pressure-filled tube with a diffuse sheen. Silhouettes and materials differ clearly at default and across the Puff/Thickness sweep.

### Blockers

- None.

### Untouched (no implementation code changed by this QA pass)

- Rod / Extrude / Solid / Inflate geometry, animation logic, export logic, and UI styling were all left unchanged. Only this `SESSION-HANDOFF.md` was updated.

## Next branch — `INFLATE_EXPORT_AND_FINAL_PROJECT_QA`

## Final saved checkpoint label

`INFLATE_PHASE_2_PREVIEW_LOCKED_FOR_MVP`

(supersedes `SOLID_H3_ANIMATION_HOLE_STABILIZATION_RESTORED_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## Branch — `INFLATE_EXPORT_AND_FINAL_PROJECT_QA`

### Outcome: **INFLATE_EXPORT_AND_FINAL_PROJECT_QA_PASS**

- Inflate preview accepted for MVP (no visual tuning reopened).
- Inflate export implemented. Export is the **full static Inflate model only** — never animated/partial geometry.
- Preview and export now share ONE geometry builder: `inflateBuildStaticGeometries(...)` in `lib/geometry-engines.ts`. Both `InflateEngine.buildPreview` and `InflateEngine.buildExport` call it with the FULL processed strokes, so the exported GLB matches the static preview 1:1.
- Export centers the aggregate bbox at the origin (same convention as Solid), names meshes `inflate_000…`, and writes metadata: `mode: "inflate"`, `inflateThickness` (Width), `inflatePuff` (Puff), `inflateStrategy`, `vertexCount`, `triangleCount`, `fallbackUsed`, plus calibrated `inflateStrokeRadiusXY` / `inflatePuffAspectZ` / `inflateRadiusZ`. Empty-loft fallback exports the Solid silhouette with `fallbackUsed: true`.
- UI: removed the "Phase 1 preview · export disabled" label (now "Width · Puff · GLB export enabled") and the Inflate tab's "no export yet" tooltip. Export GLB button already gated only on `strokeCount === 0`.

### All four modes render and export

| Mode | Export | Bytes (loopy stroke) | Log mode tag |
| --- | --- | --- | --- |
| Rod | ✅ | ~3.4 MB | `mode=rod, merged=true` |
| Extrude | ✅ | ~38 KB | `mode=extrude, merged=true` |
| Solid | ✅ | ~409 KB | `mode=solid, merged=true` |
| Inflate | ✅ | ~346 KB | `mode=inflate, merged=false` |

### Inflate export test results (validated GLB header = glTF v2, node `inflate_000` under `FreeStroke`)

- Simple line — PASS (~90 KB, non-empty).
- Loopy cursive — PASS (~346 KB, non-empty).
- Big O / loop — PASS (~359 KB, non-empty).
- Each exported GLB is non-empty and visually matches the static Inflate preview; uses full strokes, not animated partial state; Width/Puff reflected in geometry + metadata.

### Animation + controls sanity

- Inflate animation still plays acceptably (reveal path untouched — animation reuses the same preview meshes).
- Rod / Extrude / Solid animation untouched.
- Inflate Width/Puff verified live: Puff 0.18 → 0.50 visibly fuller/rounder; Width unchanged in behavior. Extrude/Solid controls untouched.

### Untouched

- Rod / Extrude / Solid geometry, animation, and export logic unchanged.
- Inflate **visual tuning untouched** — the shared builder uses the exact same calibration constants the locked preview used; the refactor only relocated the deterministic math so preview and export can share it.

### Files

- Inspected: `lib/geometry-engines.ts`, `components/viewport-3d.tsx`, `app/page.tsx`.
- Changed: `lib/geometry-engines.ts` (added `inflateBuildStaticGeometries`, refactored `InflateEngine.buildPreview` to use it, implemented `InflateEngine.buildExport`), `app/page.tsx` (UI text/tooltip), `SESSION-HANDOFF.md`.

### Blockers

- None.

## Final saved checkpoint label (updated)

`INFLATE_EXPORT_AND_FINAL_PROJECT_QA_PASS`

(supersedes `INFLATE_PHASE_2_PREVIEW_LOCKED_FOR_MVP`; all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `INFLATE_EXPORT_AND_FINAL_PROJECT_QA_PASS`

**Status: MVP-stable. Locked.** The project is now stable enough to move into cleanup / polish / demo work.

### What is now true

- Inflate preview is accepted for MVP.
- Inflate export works and looks good (user-confirmed).
- Inflate export uses the **full static Inflate model**, not animated partial geometry.
- Inflate is visually distinct enough from Extrude.
- **Width** maps to stroke thickness / XY radius.
- **Puff** maps to cross-section fullness / pressure-like roundness.
- Rod, Extrude, Solid, and Inflate all render.
- Cross-mode smoke test passed.
- Supported exports work (Rod, Extrude, Solid, Inflate all produce non-empty GLBs with correct mode tags).
- Remaining geometry/style issues are **post-MVP polish**.

### Frozen subsystems — DO NOT REOPEN

- Do **not** reopen Rod geometry.
- Do **not** reopen Extrude geometry/calibration.
- Do **not** reopen Solid H3 geometry/animation.
- Do **not** reopen Inflate visual tuning unless a major regression appears.

### Next branch — `MVP_UI_POLISH_AND_DEMO_CAPTURE`

Focus:

- remove temporary debug logs
- keep Debug panel behind Debug toggle only
- clean mode labels and helper text
- verify disabled/enabled export states are accurate
- capture short demo clips for Rod / Extrude / Solid / Inflate
- document known limitations
- prepare project for portfolio/demo use

### Final locked checkpoint label

`INFLATE_EXPORT_AND_FINAL_PROJECT_QA_PASS`

---

## LOCKED CHECKPOINT — `INFLATE_ANIMATION_PROGRESSIVE_REVEAL_PASS`

**Status: MVP-ready. Locked.** Inflate animation is accepted; all four modes are now ready to move into cleanup and demo prep.

### What is now true

- Inflate preview works.
- Inflate export works and looks good.
- Inflate animation now plays acceptably.
- Inflate reveals progressively along the drawn stroke path (arc-length partial rebuild — not all-at-once pop-in).
- **Width** still controls stroke thickness / XY radius.
- **Puff** still controls cross-section fullness / pressure-like roundness.
- Inflate remains visually distinct enough from Extrude.
- Rod, Extrude, and Solid remain accepted.
- All four modes are now MVP-ready enough to move into cleanup and demo prep.

### Important notes

- Do **not** reopen Inflate geometry.
- Do **not** reopen Inflate visual tuning.
- Do **not** reopen Solid animation.
- Do **not** reopen Extrude calibration.
- Remaining visual issues are **post-MVP polish** unless a major regression appears.

### Next branch — `MVP_UI_POLISH_AND_DEMO_CAPTURE`

Focus:

- remove temporary debug logs
- verify Debug panel only appears when Debug is ON
- clean helper text / mode labels
- verify export button states
- verify playback controls across all modes
- verify camera / framing / reset / top view
- create a demo capture checklist
- document known limitations for MVP

### Final locked checkpoint label

`INFLATE_ANIMATION_PROGRESSIVE_REVEAL_PASS`

(supersedes `INFLATE_EXPORT_AND_FINAL_PROJECT_QA_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `MVP_UI_POLISH_AND_DEMO_CAPTURE_PASS`

**Status: Demo-ready. Locked.** UI cleanup, debug gating, and demo prep complete. No geometry, animation, or export logic was touched.

### What was changed (cleanup only)

- Removed two temporary export status `console.log`s in `components/viewport-3d.tsx`
  (the dev-only `[FreeStroke Export] mode=...` status line and the ungated
  `[FreeStroke] Exported ...` line). Kept the dev-only integrity `console.warn`
  assertions and the `console.error` failure handler.
- Updated the stale Inflate controls comment in `app/page.tsx`
  (was "Phase 1 — BEVEL_EXTRUDE strategy / export is a placeholder";
  now describes the active stroke-volume tube loft with preview + animation + export sharing one path).
- Aligned the Inflate status helper text in `app/page.tsx` to
  "Soft inflated stroke · GLB export enabled" (was "Width · Puff ...", which
  conflicted with the visible "Thickness"/"Puff" slider labels).
- Gated the always-on drawing-canvas dev telemetry overlay
  (`raw N pts | processed N pts | ... draw: Xms | procOne: ... | lastTrigger: ...`)
  behind `process.env.NODE_ENV === "development"` in `components/drawing-canvas.tsx`,
  so it stays for dev work but is hidden in the demo/production build.

### Verified state

- **Debug panel:** hidden by default; the 3D viewport Debug overlays render only when Debug is ON, and only for the mode that owns them (Extrude metrics / Solid metrics). Inflate shows no stale strategy string. Overlays do not block playback/export/canvas controls.
- **Mode labels:** Rod / Extrude / Solid / Inflate all enabled and clearly labeled. Extrude = Width/Depth, Solid = Thickness/Depth, Inflate = Thickness/Puff. No stale "Phase 1 / export disabled" copy anywhere in the DOM.
- **Export:** Export GLB enabled for all four modes when a stroke exists; disabled only while exporting or with zero strokes. Consistent label ("Export GLB" / "Exporting..."). Mode-specific, timestamped filenames. Verified export emits no temporary console logs.
- **Playback:** Play/Pause, scrubber, Natural/Authentic, and 0.5x/1x/2x speed all present and mode-agnostic (gated by stroke count). Not blocked by overlays.
- **Camera:** Top view and Reset camera buttons present and working; orbit controls intact; per-mode framing locks to final geometry size.

### Demo capture checklist

**Clip 1 — Rod**
- draw a loopy stroke
- play animation (watch progressive reveal)
- orbit to show the round tube cross-section
- export GLB (optional)

**Clip 2 — Extrude**
- switch to Extrude (same stroke)
- adjust Width, then Depth
- play animation
- export GLB

**Clip 3 — Solid**
- switch to Solid; if the stroke has a loop, show the filled silhouette / counter
- adjust Thickness, then Depth
- play animation
- export GLB

**Clip 4 — Inflate**
- switch to Inflate
- adjust Thickness, then Puff
- play animation (soft inflated reveal)
- export GLB

**Clip 5 — Mode comparison**
- keep one stroke
- cycle Rod → Extrude → Solid → Inflate
- narrate why each mode exists (ink line → ribbon → filled solid → soft inflated volume)

### Known limitations (MVP)

- Inflate is an MVP stroke-volume preview/export (tube loft), not a final physical balloon simulation.
- Solid animation may still show tiny topology artifacts at loop-closure frames — acceptable for MVP.
- Extrude is usable but not final aesthetic polish.
- Materials and lighting are still basic.
- UI is demo-ready, not final product UX.
- Debug panels (3D viewport overlays + canvas telemetry) are development-only and hidden in the demo build.
- Future polish: improved materials, parameter presets, export metadata, mesh smoothing, and post-export object cleanup.

### Final locked checkpoint label

`MVP_UI_POLISH_AND_DEMO_CAPTURE_PASS`

(supersedes `INFLATE_ANIMATION_PROGRESSIVE_REVEAL_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `POST_MVP_STYLE_SUBSTRATE_PHASE_1_PASS`

**Status: Substrate added. Locked.** Infrastructure-only phase for the future visual style system. No visual effects implemented; geometry, animation, and export untouched.

### What was added (infrastructure only)

- **New file `lib/style-system.ts`** — the clean style state model + preset id shells:
  - Unions: `MaterialPreset`, `TextureMode`, `TextureLockMode`, `StyleSyncMode`, `StyleAnimationType`, `DitherType`/`DitherDirection`, `AsciiCharset`/`AsciiDirection`, `FusionPreset`, `StackAnimationType`.
  - `StyleState` interface with the full field set (material / texture / dither / ascii / layer stack / fusion / global sync + clock).
  - `DEFAULT_STYLE_STATE` — conservative defaults (material `ink`, `textureMode` `none`, all visual layers + animated systems OFF, `syncMode` `independent`).
  - Preset definition shells (IDs + labels only, no behavior): `MATERIAL_PRESETS`, `TEXTURE_MODES`, `DITHER_PRESETS`, `ASCII_PRESETS`, `FUSION_PRESETS`.
- **`app/page.tsx`** — added `styleState`/`setStyleState` (`DEFAULT_STYLE_STATE`); added a compact **Style** panel shell (Material select, Texture select, Dither/ASCII/Animate/Sync Reveal toggles) that updates state immediately; passes `styleState` to the viewport.
- **`components/viewport-3d-wrapper.tsx`** — threads the optional `styleState` prop through to `Viewport3D`.
- **`components/viewport-3d.tsx`** — added optional `styleState` prop; added a **Style substrate** readout inside the existing `showDebug` panel (Debug-only). `styleState` is referenced ONLY in debug JSX — it is in no geometry/animation/export dependency array.

### Default style values

`materialPreset: "ink"`, `textureMode: "none"`, all of `textureEnabled / textureAnimated / ditherEnabled / ditherAnimated / asciiEnabled / asciiAnimated / layerStackEnabled / stackAnimationEnabled / fusionAnimationEnabled / syncToReveal = false`, `fusionPreset: "none"`, `syncMode: "independent"`, `textureLockMode: "object"`, `globalStyleTime: 0`.

### Does style change rebuild geometry?

**No.** Verified via Extrude `previewBuildCount`: toggling style controls produced zero build-count increments (stayed flat). Style state is not in any geometry memo dependency.

### Test results

- State updates — PASS (Material→softGel, Texture→procedural, Dither/ASCII/Animate/Sync Reveal toggles all reflected in debug readout).
- Rod — PASS (renders with style state active).
- Extrude — PASS (renders; export 23.7 KB GLB with style state active).
- Solid — PASS (renders).
- Inflate — PASS (renders).
- Animation unchanged — PASS (no animation logic touched).
- Export unchanged — PASS (GLB export still works; no export logic touched).
- Debug gating — PASS (Style substrate readout visible only when Debug ON; hidden when OFF).

### Confirmations

- Geometry untouched (no edits to `lib/geometry-engines.ts` / `lib/solid-*.ts`).
- Animation logic untouched.
- Export engine logic untouched.
- No dither / ASCII / fusion rendering implemented (rails only).

### Next branch — `POST_MVP_INITIAL_PRESET_RAILS_PHASE_1`

### Final locked checkpoint label

`POST_MVP_STYLE_SUBSTRATE_PHASE_1_PASS`

(supersedes `MVP_UI_POLISH_AND_DEMO_CAPTURE_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `POST_MVP_INITIAL_PRESET_RAILS_PHASE_1_PASS`

**Status: Preset rails added. Locked.** Preset infrastructure only — no visual effect renderers. Geometry, animation, and export untouched.

### What was added (preset infrastructure only)

- **Preset family model** in `lib/style-system.ts`: `PresetFamily` union (geometry, material, animatedMaterial, texture, animatedTexture, dither, animatedDither, ascii, animatedAscii, layerStack, stackAnimation, fusion, animatedFusion, geometryAnimation) and the `StylePreset` shape (`id`, `label`, `family`, `description?`, `bestModes?`, `enabled`, `implemented`, `previewOnly?`, `applies?`).
- **Initial preset definitions** (69 total, 0 duplicate IDs, all have family + label):
  - material (6, IMPLEMENTED): ink, softGel, matteClay, glossyPlastic, rubber, signal
  - texture (5): fineGrain, scanlines, contourBands, scratchedInk, gelBubbles
  - animatedTexture (5): grainDrift, scanlineScroll, rippleFlow, bandCrawl, bubbleDrift
  - dither (5): bayerClassic, dotMatrix, hardThreshold, softDither, pixelSignal
  - animatedDither (5): ditherCrawl, thresholdSweep, revealDither, completionPulseDither, diagonalMatrixDrift
  - ascii (5): terminalShade, binarySkin, blockGlyph, codeMarks, sparseGlyph
  - animatedAscii (6): glyphScroll, asciiRain, characterCycle, revealGlyphs, terminalFlicker, slowCodeCrawl
  - layerStack (5): cleanInkStack, ditheredGelStack, terminalStack, graphicSlabStack, softSignalStack
  - stackAnimation (6): stackFadeIn, stackCompletionPulse, stackDrift, stackFreezeOnComplete, stackLoopCrawl, stackDelay
  - fusion (8): terminalGel, ditherBloom, signalInk, asciiRubber, scanlineBalloon, pixelClay, codeBloom, glitchRibbon
  - animatedFusion (7): terminalGelRevealBuild, ditherBloomThresholdOpen, signalInkDataFlow, asciiRubberSlowdown, scanlineBalloonSoftPulse, glitchRibbonControlledBreak, codeBloomCharacterReveal
  - geometryAnimation (6): authenticDraw, smoothReveal, snappyDraw, slowGel, loopingStroke, completionPulse
  - `PRESET_REGISTRY` (family → presets), `PRESET_FAMILY_OPTIONS`, `ALL_PRESETS`, and `findPreset()`.
- **Style state fields** added to `StyleState` + `DEFAULT_STYLE_STATE`: `activePresetFamily` (default `material`), `activePresetId` (default `null`), `lastAppliedPresetId` (default `null`).
- **Preset rail UI** in `app/page.tsx`: a family selector + a preset selector in the Style bar, with a selected-preset status chip ("active" vs "defined · renderer later"). Unimplemented presets are labeled "(soon)". A `handleSelectPreset(family, id)` records the active preset and applies only the preset's safe `applies` patch.
- **Debug readout** in `components/viewport-3d.tsx` (Debug-only): activePresetFamily, activePresetId, activePresetImplemented, activePresetPreviewOnly, activePresetBestModes, presetAppliesState, presetDoesNotTouchGeometry: YES.

### Material preset behavior

Material presets are `implemented: true` and carry `applies: { materialPreset: ... }`. Selecting one updates the existing `materialPreset` style state through the shared style state path (no geometry rebuild).

### Unimplemented preset behavior

All non-material presets are `implemented: false` with no `applies` patch. Selecting one records `activePresetFamily`/`activePresetId` (and the UI shows "defined · renderer later") but applies nothing visual, does not change material, and does not break the preview. They never pretend to work.

### Does preset selection rebuild geometry?

**No.** Verified via Extrude `previewBuildCount`: selecting multiple unimplemented presets produced zero build-count increments. Style/preset state is in no geometry memo dependency.

### Test results

- Preset data — PASS (69 presets, 0 dupes, 0 missing label/family, only 6 material marked implemented, family counts match spec).
- UI — PASS (family selector switches the preset list; selecting material `rubber`/`matteClay` updates `materialPreset`; selecting unimplemented `bayerClassic`/ascii presets records selection, shows "(soon)"/"defined · renderer later", leaves material untouched, preview intact).
- Rod — PASS (renders).
- Extrude — PASS (renders; export 23.7 KB GLB with presets active).
- Solid — PASS (renders).
- Inflate — PASS (renders).
- Animation unchanged — PASS.
- Export unchanged — PASS.
- Debug gating — PASS (preset + substrate readouts visible only when Debug ON; hidden when OFF).

### Confirmations

- Geometry untouched (no edits to `lib/geometry-engines.ts` / `lib/solid-*.ts`).
- Animation logic untouched.
- Export engine logic untouched.
- No dither / ASCII / texture / fusion rendering implemented (rails + definitions only).

### Next branch — `POST_MVP_MATERIAL_AND_ANIMATED_MATERIAL_PHASE_1`

### Final locked checkpoint label

`POST_MVP_INITIAL_PRESET_RAILS_PHASE_1_PASS`

(supersedes `POST_MVP_STYLE_SUBSTRATE_PHASE_1_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `STYLE_TAXONOMY_UI_CORRECTION_PASS`

**Status: Taxonomy corrected. Locked.** State/UI-only correction — no renderers added; geometry, animation, and export untouched.

### What was corrected

- **Texture, Dither, and ASCII are now separate sibling systems.** Previously the UI placed Dither and ASCII under the Texture selector (conceptually wrong). They are now independent controls with independent state paths.
- `textureMode` no longer contains `dither` or `ascii` (nor the old umbrella `layered`/`fusion`).

### Old incorrect taxonomy

- Material
- Texture: None / Procedural / **Dither** / **ASCII** / Layered / Fusion
- Dither toggle (boolean)
- ASCII toggle (boolean)

### Corrected taxonomy

- Material: Ink / Soft Gel / Matte Clay / Glossy Plastic / Rubber / Signal
- Texture (procedural patterning only): None / Procedural / Grain / Noise / Scanlines / Bands / Contour
- Dither (own system): Off / Bayer 4x4 / Bayer 8x8 / Blue Noise / Halftone / Lines
- ASCII (own system): Off / Blocks / Classic / Minimal / Dots / Custom
- Animate + Sync Reveal toggles
- Preset: family + preset (families stay separate)

### State model changes (`lib/style-system.ts`)

- `TextureMode` = `"none" | "procedural" | "grain" | "noise" | "scanlines" | "bands" | "contour"` (no `dither`/`ascii`/`layered`/`fusion`).
- `TEXTURE_MODES` shell list updated to match (no Dither/ASCII entries).
- Dither retains its independent fields (`ditherEnabled`, `ditherAnimated`, `ditherType`, `ditherScale`, `ditherThreshold`, `ditherContrast`, `ditherSpeed`, `ditherDirection`).
- ASCII retains its independent fields (`asciiEnabled`, `asciiAnimated`, `asciiCharset`, `asciiCellSize`, `asciiDensity`, `asciiContrast`, `asciiScrollSpeed`, `asciiDirection`).
- Dither/ASCII preset defs now carry safe `applies` patches that set their OWN state (`ditherEnabled`+`ditherType` / `asciiEnabled`+`asciiCharset`) — never `textureMode`.

### UI changes (`app/page.tsx`)

- Replaced the Dither/ASCII boolean toggle chips with two separate selects: **Dither** (Off + dither types) and **ASCII** (Off + charsets), siblings of the Texture select.
- Animate + Sync Reveal toggles retained.
- `handleSelectPreset` now applies a preset's safe `applies` patch for any family (the patches only touch inert style fields), so dither/ASCII presets record their own sibling state; `implemented` still governs the "active" vs "renderer later" label.

### Preset behavior changes

- Texture / animatedTexture / dither / animatedDither / ascii / animatedAscii / fusion families remain separate in `PRESET_REGISTRY`.
- Selecting a dither preset sets `ditherEnabled = true` + `ditherType` (verified `presetAppliesState: ditherEnabled, ditherType`); it does NOT set `textureMode`.
- Selecting an ASCII preset sets `asciiEnabled = true` + `asciiCharset`; it does NOT set `textureMode`.
- All non-material presets remain `implemented: false` ("(soon)" / "defined · renderer later"). No renderer is falsely claimed implemented.

### Debug changes (`components/viewport-3d.tsx`)

- Style substrate readout regrouped into labeled sections: **Texture (procedural patterning only)** (textureMode, textureEnabled, textureAnimated), **Dither (separate system)** (ditherEnabled, ditherAnimated, ditherType), **ASCII (separate system)** (asciiEnabled, asciiAnimated, asciiCharset), **Composite** (layerStack/stack/fusion/sync). Active preset block (activePresetFamily, activePresetId, …) retained. Debug no longer implies Dither/ASCII are texture modes.

### Test results

- UI taxonomy — PASS (Texture options = None/Procedural/Grain/Noise/Scanlines/Bands/Contour; no Dither, no ASCII. Dither + ASCII are own selects. Selecting Dither/ASCII left `textureMode` unchanged. Selecting Texture=scanlines left Dither/ASCII state unchanged.)
- Preset taxonomy — PASS (dither preset `dotMatrix` set `ditherType=halftone` + `presetAppliesState: ditherEnabled, ditherType`, `textureMode` unchanged; families separate; fusion separate).
- Rod — PASS (renders).
- Extrude — PASS (renders).
- Solid — PASS (renders).
- Inflate — PASS (renders; export 208 KB GLB with taxonomy state active).
- Material preset regression — PASS (material presets still apply via `materialPreset`).

### Confirmations

- No dither renderer implemented.
- No ASCII renderer implemented.
- No procedural texture renderer implemented.
- Geometry untouched (no edits to `lib/geometry-engines.ts` / `lib/solid-*.ts`).
- Animation logic untouched.
- Export engine logic untouched.

### Next branch — `POST_MVP_MATERIAL_AND_ANIMATED_MATERIAL_PHASE_1`

### Final locked checkpoint label

`STYLE_TAXONOMY_UI_CORRECTION_PASS`

(supersedes `POST_MVP_INITIAL_PRESET_RAILS_PHASE_1_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `STYLE_TAXONOMY_AND_PANEL_IA_CORRECTION_PASS`

**Status: Taxonomy + information architecture corrected. Locked.** UI/state clarity + panel scaffolding only — no renderers added; geometry, animation, and export untouched.

### Builds on the prior taxonomy pass

The texture/dither/ASCII sibling split was already done in `STYLE_TAXONOMY_UI_CORRECTION_PASS`. This pass finishes the IA work: clarifies the ambiguous Motion/Sync controls, treats the top row as a compact summary strip, and adds the dedicated-panel scaffolding.

### Files changed

- `lib/style-system.ts` — added `MotionMode` type + `motionMode` state field/default.
- `app/page.tsx` — replaced Animate/Sync Reveal toggles with a Motion select; updated helper copy; mounted `StylePanelScaffold`.
- `components/style-panel-scaffold.tsx` — NEW. Panel IA shell.
- `components/viewport-3d.tsx` — debug readout: added Motion section (motionMode/syncMode/syncToReveal); relabeled Composite.
- `SESSION-HANDOFF.md` — this checkpoint.

### Old incorrect / ambiguous taxonomy

- Texture selector listed Dither + ASCII (already fixed last pass).
- `Animate` (mapped to `textureAnimated`) — unclear what was being animated.
- `Sync Reveal` (boolean) — vague; didn't communicate "style timing follows stroke draw-in".
- Top row presented as if it were the full/final control surface.

### Corrected taxonomy + IA

- **Sibling systems (top summary strip):** Material · Texture · Dither · ASCII · Motion · Preset.
- **Motion** select: `Off` / `Independent` / `Sync to Draw` (replaces Animate + Sync Reveal). Tooltip: "Link style animation timing. Sync to Draw uses stroke draw-in progress as the clock."
- **Top row is a compact summary/quick-control strip** — helper copy now reads "summary strip · full controls land in dedicated panels later".
- **Panel scaffolding** (`StylePanelScaffold`): expandable "Style panels" drawer with tabs Material / Texture / Dither / ASCII / Motion / Presets / Layers (later) / Fusion (later). Each panel shows an honest status chip ("substrate active" vs "renderer later"), a placeholder note, and a list of documented FUTURE controls.

### State model changes (`lib/style-system.ts`)

- New `MotionMode = "off" | "independent" | "syncToDraw"` (coarse, user-facing).
- New `StyleState.motionMode: MotionMode` (default `"off"`).
- Existing fine-grained flags (`textureAnimated`, `ditherAnimated`, `asciiAnimated`) and `syncMode`/`syncToReveal` retained for future panels. `motionMode` is the single clear control surfaced today.

### UI label changes (`app/page.tsx`)

- `Animate` toggle → removed; superseded by `Motion` select.
- `Sync Reveal` toggle → removed; concept surfaced via Motion's `Sync to Draw` option.
- Helper microcopy updated to communicate "summary strip / dedicated panels later".

### Panel IA / scaffolding changes

- Added `components/style-panel-scaffold.tsx` (Option B: inline expandable placeholder panels). Documents per-panel future control inventories (Material, Texture, Dither, ASCII, Motion, Layers, Fusion) in code. No advanced control or renderer implemented; placeholder copy never claims a renderer exists.

### Preset behavior changes

- None this pass. Preset families remain separate (texture / animatedTexture / dither / animatedDither / ascii / animatedAscii / layerStack / stackAnimation / fusion / animatedFusion). Dither presets still set `ditherEnabled`+`ditherType`, ASCII presets set `asciiEnabled`+`asciiCharset`, never `textureMode`. Non-material presets remain `implemented:false`.

### Debug changes (`components/viewport-3d.tsx`)

- Added "— Motion (style animation) —" section: `motionMode`, `syncMode`, `syncToReveal`.
- Composite section relabeled "— Composite (renderers later) —".
- Readout no longer implies Dither/ASCII are texture modes or that Motion means only texture animation.

### Test results

- UI taxonomy — PASS (labels: Material/Texture/Dither/ASCII/Motion/Preset; Texture has no Dither/ASCII; old Animate/Sync Reveal buttons gone; Motion = Off/Independent/Sync to Draw; selecting Motion=Sync to Draw sets `motionMode` only).
- Panel IA — PASS (Style panels drawer expands; 8 tabs present; Dither panel shows "Dither renderer not implemented yet" + future-control chips; honest status chips).
- Preset taxonomy — PASS (families separate; dither/ASCII presets set their own state, not textureMode).
- Rod — PASS (renders).
- Extrude — PASS (renders).
- Solid — PASS (renders).
- Inflate — PASS (renders; export 90 KB GLB).
- Material preset regression — PASS (material presets still apply via `materialPreset`).

### Confirmations

- No dither renderer implemented.
- No ASCII renderer implemented.
- No procedural texture renderer implemented.
- Geometry untouched (no edits to `lib/geometry-engines.ts` / `lib/solid-*.ts`).
- Animation logic untouched.
- Export engine logic untouched.

### Next branch — `POST_MVP_MATERIAL_AND_ANIMATED_MATERIAL_PHASE_1`

### Final locked checkpoint label

`STYLE_TAXONOMY_AND_PANEL_IA_CORRECTION_PASS`

(supersedes `STYLE_TAXONOMY_UI_CORRECTION_PASS`; all prior checkpoints remain in effect as underlying layers)

---

## POST_MVP_MATERIAL_AND_ANIMATION_IA_PHASE_1

### Checkpoint: `POST_MVP_MATERIAL_AND_ANIMATION_IA_PHASE_1_PASS`

### What this branch delivered

- **Material presets now visibly affect surface response.** Six presets
  (`ink`, `softGel`, `matteClay`, `glossyPlastic`, `rubber`, `signal`) defined in
  `MATERIAL_PARAMS` and applied to a single live `MeshPhysicalMaterial`
  (`liveMaterial` in `viewport-3d.tsx`). Geometry is never touched.
- **Mode-aware material defaults.** `MODE_MATERIAL_DEFAULTS`: Rod→ink,
  Extrude→glossyPlastic, Solid→matteClay, Inflate→softGel. Applied in
  `handleModeChange` only when `materialUserOverride === false`; an explicit user
  pick pins the material and survives mode switches. "Reset to mode default"
  clears the override.
- **Animated Material v1 (preview-only).** Types: `none`, `shineSweep`,
  `gelShimmer`, `roughnessPulse`, `completionFlash`, `signalFlicker`, evaluated by
  `evaluateMaterialAnimation` against `globalStyleTime`. Subtle by default.
  Configured in the Material panel (toggle + type + speed + intensity).
- **Animation IA correction.** Animation is now a clear top-level concept, not a
  vague "Animate" button. New **Animation** panel enumerates all categories:
  Geometry Animation (basic playback today), Material Animation (active), and
  reserved IA for Texture / Dither / ASCII / Layer / Stack / Fusion — each labeled
  with its future branch name.
- **Sync to Draw.** `motionMode` of `off | independent | syncToDraw`. When
  `syncToDraw`, material animation may use reveal progress; geometry animation
  behavior is unchanged.
- **Debug fields** (Debug ON only): activeMaterialPreset, modeMaterialDefault,
  userMaterialOverride, materialColor/Roughness/Metalness/Clearcoat,
  materialAnimation Enabled/Type/Speed/Intensity, materialAnimationPreviewOnly,
  syncToDrawAffectsMaterialAnimation, and the five future*Reserved flags +
  materialDoesNotTouchGeometry.

### Files changed

- `lib/style-system.ts` — material params, animation types, mode defaults,
  `resolveMaterialParams`, `evaluateMaterialAnimation`, state fields.
- `components/viewport-3d.tsx` — live material, per-frame animation, debug fields.
- `components/style-panel-scaffold.tsx` — Material panel controls + Animation
  panel IA.
- `app/page.tsx` — mode-default wiring, Animation summary chip.
- `SESSION-HANDOFF.md` — this checkpoint.

### Scope / limitations

- Animated material is **preview-only**; static material may reflect in GLB via
  the existing material path, animated material export/baking is out of scope.
- Dither renderer **not implemented**. ASCII renderer **not implemented**.
  Procedural texture renderer **not implemented**.
- Geometry untouched. Current geometry animation behavior untouched. Export
  geometry untouched. No timeline, no keyframes, no advanced stroke-animation
  controls.

### Next branch — `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1`

## LOCKED CHECKPOINT — `MATERIAL_READABILITY_ENV_AND_CUSTOM_PASS`

### Problem this branch fixed

Material presets looked nearly identical and the surface read as flat/near-black
because the scene had **no environment map** — `MeshPhysicalMaterial` highlights,
clearcoat, and metalness need reflections to be visible. Presets only varied
roughness/metalness, which is invisible without something to reflect.

### What changed

- **Studio environment map added** in `components/viewport-3d.tsx`. A neutral
  multi-`Lightformer` studio rig inside drei's `<Environment resolution={256}
  frames={1} background={false}>` bakes a reflection environment **once**
  (`frames={1}`, not a live scene background) onto `scene.environment`. This
  lights every mode's shared `liveMaterial`, so highlights, clearcoat streaks,
  and reflections are now visible. The 2D background and grid are unchanged; the
  env map is reflection-only (`background={false}`).
- **`envMapIntensity` added to the material model** in `lib/style-system.ts`
  (`MaterialParams.envMapIntensity`). Each preset now sets a deliberate value so
  reflections differ per preset (e.g. glossyPlastic high, matteClay low). The
  per-frame animation and the static `liveMaterial` both apply it.
- **Presets retuned for clear visual distinction** under the env map. Verified
  in-browser: Glossy Plastic shows crisp white + amber + blue specular streaks;
  Matte Clay shows a soft diffuse gradient with no sharp highlight.
- **Custom material added.** New `"custom"` member of `MaterialPreset` plus a
  `CustomMaterial` interface and `DEFAULT_CUSTOM_MATERIAL` in
  `lib/style-system.ts`. `resolveMaterialParams(preset, custom)` returns the
  custom params when preset === "custom". `styleState.customMaterial` holds the
  live values. The Material panel renders a **Custom material editor** (color /
  sheen color / emissive pickers + roughness / metalness / clearcoat / sheen /
  emissive / reflection sliders) only when the Custom preset is selected; edits
  update the 3D preview live.
- **Animation off now snaps the surface back to its static base** (added `else`
  branch in the `useFrame` material block) instead of freezing on the last
  animated frame.
- **Debug fields added** (Debug ON): materialSheen, materialEnvMapIntensity,
  isCustomMaterial, envMapPresent, materialAppliedToAllModes. The material
  readout and debug panel now use `resolveMaterialParams` so they reflect custom
  edits.

### Files touched

- `lib/style-system.ts` — `envMapIntensity`, `"custom"` preset, `CustomMaterial`,
  `DEFAULT_CUSTOM_MATERIAL`, `resolveMaterialParams(preset, custom)` signature,
  retuned preset params.
- `components/viewport-3d.tsx` — studio `<Environment>` + `Lightformer` rig on
  `scene.environment`, `envMapIntensity` applied in static + animated paths,
  anim-off reset branch, debug fields, removed unused `MATERIAL_PARAMS` import.
- `components/style-panel-scaffold.tsx` — Custom material editor, readout uses
  `resolveMaterialParams`.
- `SESSION-HANDOFF.md` — this checkpoint.

### Scope / limitations

- Env map is **reflection lighting only** — it is not drawn as a visible
  background and does not change the 2D canvas, grid, or geometry.
- Animated material remains **preview-only**; static material (including custom)
  follows the existing GLB material path, animated material is not baked.
- Geometry, draw-in clock, and export geometry untouched.

### Next branch — `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1`

## LOCKED CHECKPOINT — `MATERIAL_APPLICATION_DISTINCTION_AND_ANIMATION_READABILITY_FIX_PASS`

Consolidates the env-map readability + custom-material work and re-verifies it
against the explicit spec for this branch. (Note: `components/viewport-3d.tsx`
and `components/style-panel-scaffold.tsx` had partially reverted during the
session; this pass re-applied and re-verified the changes.)

### Root causes identified (from visual review, not just code)

- **"Only Inflate reads clearly":** all four modes already shared one
  `liveMaterial`, but with **no environment map** the PBR clearcoat / metalness /
  sheen had nothing to reflect, so thin/low-curvature geometry (Rod, Extrude,
  Solid faces) collapsed to near-flat dark. Inflate's rounded tubes caught the
  few direct lights, which is why it *looked* like only Inflate responded.
- **Presets looked the same:** without reflections the roughness/clearcoat
  differences were invisible; every preset resolved to "slightly different
  black."
- **Animated material hard to see / too similar:** effects only nudged
  color/roughness with no reflection term, so the modulation was below the
  perceptual floor and the types were not differentiated by which property they
  drive.

### Fixes (re-applied this pass)

- **Studio environment map** — offline `<Environment frames={1}
  background={false}>` with four `<Lightformer>`s feeds `scene.environment`
  only. Reflection lighting, no visible background, no canvas/grid/geometry
  change. This is what makes material read on Rod / Extrude / Solid.
- **`envMapIntensity` added to `MaterialParams`** and tuned per preset so the
  six presets are visibly distinct (ink 1.0, softGel 0.7, matteClay 0.15,
  glossyPlastic 1.6, rubber 0.4, signal 1.3).
- **Animated material** now also drives `envMapIntensity`, and each type varies
  which property / wave shape / speed it animates; added an **anim-off reset**
  that pins the surface back to its static base.
- **`resolveMaterialParams(preset, custom)`** is the single shared resolution
  path; `baseParams` and `liveMaterial` both flow through it for all modes.

### Custom Material (Part C)

- `"custom"` material preset + `CustomMaterial` interface + `customMaterial`
  state. Editor in the Material panel (color / sheen color / emissive pickers +
  roughness / metalness / clearcoat / sheen / emissive / reflection sliders)
  updates the preview live across all four modes.

### Future custom IA reserved (Part C, not implemented)

- Debug fields assert reserved-but-unimplemented: `futureCustomTextureReserved`,
  `futureCustomDitherReserved`, `futureCustomAsciiReserved`,
  `futureCustomAnimationReserved`, `futureCustomFusionReserved`. Only **Custom
  Material** is implemented this branch.

### Debug fields (spec list)

activeMaterialPreset, materialSource (preset/custom/modeDefault),
materialAppliedToMode, materialAppliedToRod/Extrude/Solid/Inflate (all YES —
single shared material), materialColor/Roughness/Metalness/Clearcoat/
EnvMapIntensity, customMaterialActive, customMaterialValues,
materialAnimationEnabled/Type/Speed/Intensity,
materialAnimationAppliesToCurrentMode, materialAnimationVisibleEnough,
materialAnimationDistinctFromOtherTypes, syncToDrawAffectsMaterialAnimation,
materialDoesNotTouchGeometry, future custom* reserved flags.

### Test results (verified in-browser this pass)

- **Extrude + Glossy Plastic:** crisp white specular streak on top edge + warm
  amber reflection underneath. **Extrude + Matte Clay:** uniform soft mid-gray,
  no highlight. Distinction obvious on the same stroke.
- **Rod + Glossy Plastic:** specular highlight along the crest of the thin tube
  — material applies (subtler only due to thin geometry).
- **Inflate + Soft Gel / Glossy:** soft diffuse sheen vs sharp specular —
  confirmed earlier this session.
- Custom material color edit (cyan) updated the preview live.
- Dev server compiles clean; restored missing `evaluateMaterialAnimation`
  import (would otherwise crash) and removed unused `MATERIAL_PARAMS` imports.

### Confirmations

- Dither renderer NOT implemented. ASCII renderer NOT implemented. Procedural
  texture renderer NOT implemented.
- Geometry untouched. Current geometry animation untouched. Export geometry
  untouched. Texture/Dither/ASCII remain separate systems.

### Scope / limitations

- Env map is reflection lighting only (no visible background).
- Animated material is preview-only; static + custom material follow the
  existing GLB material path; animated material is not baked.

### Conclusion — `MATERIAL_APPLICATION_DISTINCTION_AND_ANIMATION_READABILITY_FIX_PASS`

### Next branch — `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1`

---

## LOCKED CHECKPOINT — `LOGO_CAPTURE_VARIANTS_FONT_AND_TRACE_PASS`

**Status: both logo-capture variants delivered.** Finishes the v0 plan that ran
out of credits (PR #30): Variant B (clean rounded font, inflated, logo-sized)
and Variant A (traced logo, inflated, matching the handwriting). No app code
touched — capture tooling + stroke sources only.

### What was delivered

- **Variant B — font:** "Desk Doodles" laid out from the clean single-stroke
  vector font (`letters.mjs`, size 120 scaled to the trace's 1100px coordinate
  span so tube weight matches), injected via the DEV harnesses, Inflate mode,
  custom near-ink material (roughness 0.35). Fully legible inflated word.
  Output: `public/videos/desk-doodles-logo-flip-font.webm`.
- **Variant A — trace:** the skeleton tracer no longer shreds the word. Fixed
  `trace-logo.mjs`: walks THROUGH junctions picking the straightest
  continuation (dot-product against the recent heading) instead of stopping,
  then greedy endpoint-merging of fragments (≤6px gaps, direction-continuity
  guard so neighbouring letters never bridge), then left-to-right stroke
  ordering so the reveal draws like writing. 30 raw → 22 continuous strokes
  (was ~60 shredded fragments). The inflated word now reads as the real
  handwritten logo. Output: `public/videos/desk-doodles-logo-flip-traced.webm`.
- Reference stills: `scripts/capture/variant-b-font-full.png`,
  `scripts/capture/variant-a-traced-full.png`.

### New capture driver (agent-browser replacement)

- `scripts/capture/capture-run.mjs` — local Playwright-core driver using the
  installed system Chrome (`channel: "chrome"`, headless works fine for this
  WebGL capture since frames are grabbed via `canvas.toDataURL`, no
  rAF-dependent motion). Supports `--source=font|trace`, `--headed`, and the
  same env knobs as before (`DRAW_FRAMES`, `ROUGHNESS`, plus `FONT_TARGET_W`).
- `encode.mjs` now falls back to a system `ffmpeg` on PATH when pnpm blocks
  ffmpeg-static's postinstall download.
- Full pipeline per variant:
  `pnpm dev` → `node scripts/capture/capture-run.mjs --source=font|trace` →
  `node scripts/capture/compose.mjs --mode=with3d` →
  `node scripts/capture/encode.mjs --out=<name>.webm`

### Untouched

- Rod / Extrude / Solid / Inflate geometry, animation, export, style system,
  and all app components — zero app code changed this pass.

### Final locked checkpoint label

`LOGO_CAPTURE_VARIANTS_FONT_AND_TRACE_PASS`

(supersedes `MATERIAL_APPLICATION_DISTINCTION_AND_ANIMATION_READABILITY_FIX_PASS`
as the latest layer; all prior checkpoints remain in effect)

---

## LOCKED CHECKPOINT — `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1_PASS`

**Status: procedural texture + animated texture are LIVE on all four modes.**
Renderer implemented (not rails). Geometry, geometry animation, and export
geometry untouched.

### What was built

- **`lib/texture-shader.ts` (NEW)** — the pattern renderer. Injects GLSL into the
  shared `MeshPhysicalMaterial` via `onBeforeCompile`, so all four modes get
  texture from the one live material. Patterns are COMPUTED from position (no
  UVs — Solid's raster/contour and Inflate's loft have no usable UV
  parameterization, so image textures were never an option).
  - Five patterns behind ONE shader, selected by the `uFsTexType` uniform:
    grain (per-cell hash), noise (2-octave value noise), scanlines, bands,
    contour (value noise sliced at even levels → topo lines).
  - `fsHash` + `fsValueNoise` with smoothstep-eased bilinear blend (the
    `f*f*(3-2f)` easing is what kills the value-noise grid seams).
  - Coordinate source = object space (welded to the form) or screen space
    (graphic overlay), per `textureLockMode`.
  - Animation = sliding the sample coordinate along a unit direction vector.
    Clock is elapsed time (`independent`) or reveal progress (`syncToDraw`).
  - Constant `customProgramCacheKey` so every textured material shares one
    compiled program.
- **`lib/style-system.ts`** — added `TextureDirection` + `textureDirection`
  state/default. TEXTURE_PRESET_DEFS and ANIMATED_TEXTURE_PRESET_DEFS are now
  `implemented: true` with real `applies` patches (Fine Grain, Scanlines,
  Contour Bands, Scratched Ink, Gel Bubbles / Grain Drift, Scanline Scroll,
  Ripple Flow, Band Crawl, Bubble Drift). They only ever write `texture*`.
- **`components/viewport-3d.tsx`** — texture uniforms in a ref (survive material
  re-creation); per-frame uniform writes in `useFrame`; full texture debug
  readout; NEW mode-agnostic `GEOM_BUILD_DEBUG.buildCount`; extracted
  `buildGLBBuffer` so the export button and the verification harness run the
  same export code; dev-only `window.__geomDebug`.
- **`components/style-panel-scaffold.tsx`** — real Texture panel (pattern /
  scale / intensity / contrast / lock mode + Texture Animation with speed and
  direction). Panel + Animation-category status flipped from "reserved" to
  "active".
- **`app/page.tsx`** — Texture summary chip now live (shows pattern + `·anim`);
  dev harness gained `setStyle(patch)` for verification sweeps.

### Root cause found by visual verification (not code review)

First implementation darkened albedo only. On the glossy near-black Extrude
default this was **invisible** — multiplying near-black by <1 stays near-black,
and on a glossy dark surface nearly all visible light is the specular lobe, not
albedo. Fix: bidirectional albedo modulation (lift AND darken) plus modulating
`material.roughness` and `material.clearcoatRoughness` right after
`<lights_physical_fragment>` so the HIGHLIGHT carries the pattern.
Measured: extrude/contour meanΔ 1.94 (below perceptual floor) → 10.74.

### Verification tooling (NEW, reusable for every future style phase)

- `scripts/verify/verify-style.mjs` — drives the running app through
  (mode × pattern) stills and long consecutive-frame motion runs; writes to
  `docs/verification/<pass>/`. `--only=still|motion` no longer wipes the other
  family.
- `scripts/verify/diff-frames.mjs` — measures each still against its mode's
  texture-off baseline (reads / faint / TOO SUBTLE) and each motion cell for
  consecutive-frame change (travels / jitters / STATIC).
- `scripts/verify/verify-gates.mjs` — asserts the geometry-rebuild gate, export
  health, and the taxonomy gate.

### Test results (all captured evidence in `docs/verification/texture-v1/`)

- **Stills — 20/20 read.** Every mode × every pattern above the perceptual
  floor. Range meanΔ 7.39 (inflate/noise) to 31.43 (solid/contour). Zero
  TOO SUBTLE, zero faint.
- **Motion — 4/4 travel.** inflate/grain, inflate/scanlines, solid/grain,
  solid/scanlines all show real consecutive-frame movement (consecΔ 17.2–56.9).
- **Geometry-rebuild gate — PASS on all four modes.** buildCount flat across 10
  style changes each: rod 2→2, extrude 4→4, solid 5→5, inflate 6→6.
- **Export regression — PASS on all four.** rod 2.16 MB, extrude 29 KB,
  solid 303 KB, inflate 261 KB, all non-empty with texture active.
- **Taxonomy gate — PASS.** Texture never enables dither or ASCII.
- **Console errors — 0** across every capture run.

### Confirmations

- Dither renderer NOT implemented. ASCII renderer NOT implemented.
- Geometry untouched. Geometry animation untouched. Export GEOMETRY untouched
  (only the GLB-building code path was extracted to a shared function; the
  produced buffer is identical).
- Texture is preview-only — no texture baking into GLB (per PRD: preview first,
  bake later).

### Docs

- `docs/PRD.md` (the plan, now in-repo), `docs/README.md` (the loop + doc system)
- `docs/explainers/01-procedural-texture.md` — code / tech / math / reasoning
- `docs/research/texture-phase.md` — every source used, what it is, what we used it for

### Next branch — `POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1`

### Final locked checkpoint label

`POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1_PASS`

(supersedes `MATERIAL_APPLICATION_DISTINCTION_AND_ANIMATION_READABILITY_FIX_PASS`;
all prior checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1_PASS`

**Status: dither + animated dither are LIVE on all four modes.** Threshold
renderer implemented. Geometry, geometry animation, and export geometry
untouched.

### What was built

- **`lib/dither-shader.ts` (NEW)** — threshold-based tonal reduction. Injects at
  `<dithering_fragment>` — the very END of the fragment shader, AFTER lighting,
  tone mapping and color space. This is what makes dither a genuinely different
  system from texture (which injects at albedo + lighting stages).
  - Core: `quantize(luminance + (threshold(x,y) - 0.5))`. The `- 0.5` centring
    is required or average brightness drifts up (Wikipedia flags this).
  - `fsBayer` generates the Bayer recurrence ARITHMETICALLY (one bit of x/y per
    refinement level, accumulated base-4) instead of a lookup table, so ONE
    function serves both 4x4 and 8x8 via a `levels` parameter.
  - Five threshold maps: bayer4, bayer8, blueNoise (interleaved gradient noise —
    honestly labeled "Noise threshold (IGN)", NOT true blue noise), halftone
    (distance-from-cell-centre so dots GROW with tone, like print), lines.
  - Rec. 709 luma weights for perceived brightness.
  - Hue preservation: divides colour by its own luminance, quantizes brightness,
    re-applies the tint — so material presets stay distinguishable under dither
    instead of all collapsing to identical black/white.
- **`lib/style-shader.ts` (NEW)** — a material has ONE `onBeforeCompile`, but
  texture and dither must both live on the shared material. This composer
  stitches each system's GLSL into its correct chunk while each system keeps its
  own module, uniforms and state (the PRD's separation preserved in code).
- **`lib/texture-shader.ts`** — refactored to export its GLSL as constants
  (`TEXTURE_COMMON_GLSL` / `TEXTURE_MAP_GLSL` / `TEXTURE_LIGHTS_GLSL`) for the
  composer. Behaviour identical.
- **`lib/style-system.ts`** — added `ditherIntensity`, `ditherLevels`, and a
  DEDICATED `ditherLockMode` (dither gets its own, not texture's). DITHER and
  ANIMATED_DITHER preset defs are now `implemented: true` with real `applies`
  patches (Bayer Classic, Dot Matrix, Hard Threshold, Soft Dither, Pixel Signal /
  Dither Crawl, Threshold Sweep, Reveal Dither, Completion Pulse Dither,
  Diagonal Matrix Drift).
- **`components/viewport-3d.tsx`** — dither uniforms ref + per-frame uniform
  writes; two genuinely different animation behaviours (see below); full dither
  debug readout.
- **`components/style-panel-scaffold.tsx`** — real Dither panel (threshold map /
  cell size / tone levels / threshold bias / contrast / amount / lock mode +
  Dither Animation with speed and motion kind). Panel + Animation-category
  status flipped to "active".
- **`app/page.tsx`** — Dither summary chip now live; harness gained
  `selectPreset(family, id)` so gates exercise the REAL preset path.

### Animated dither = THRESHOLD motion (not pattern motion)

- **Matrix crawl** (direction chosen): offsets the threshold lookup coordinate,
  so the dither structure travels while tone stays put.
- **Threshold-bias sweep** (direction "static"): oscillates the bias so tone
  opens and closes in place, like an aperture. Verified in frames: sparse dots →
  open checkerboard.
- **Sync to Draw**: threshold opens as the reveal progresses.

### NEW verification check — pairwise distinctness

`diff-frames.mjs` now also compares every variant against every OTHER variant
within a mode, not just against the off baseline. This is the check that would
have caught the historical "all the material presets look the same" bug — a set
of options can each differ hugely from off while being near-identical to each
other. Retroactively run on texture-v1 too; both systems pass.

### Test results (evidence in `docs/verification/dither-v1/`)

- **Stills — 20/20 read.** Every mode × threshold map, meanΔ 22.83 (extrude/
  lines) to 119.80 (solid/halftone). Zero TOO SUBTLE, zero faint.
- **Distinctness — distinct on all four modes.** Closest pair is bayer4 vs
  bayer8 (same family, different resolution): 9.68 extrude / 17.36 rod /
  36.52 inflate / 70.93 solid.
- **Texture distinctness (retroactive) — distinct on all four modes.** Closest
  pair grain vs noise: 13.84–23.90.
- **Motion — 3/3 travel.** solid/crawl (consecΔ 72.15), solid/sweep (9.56),
  inflate/halftonesweep (13.10).
- **Geometry-rebuild gate — PASS on all four modes** across 20 combined
  texture+dither style changes each: rod 3→3, extrude 5→5, solid 6→6,
  inflate 7→7.
- **Export regression — PASS on all four** (unchanged byte counts).
- **Taxonomy gates — PASS.** Texture never enables dither/ASCII; the dither
  preset `dotMatrix` applies `ditherType: halftone` and touches neither
  `textureMode` nor `ascii*`. Asserted through the real `handleSelectPreset`.
- **Console errors — 0** across every run.

### Confirmations

- ASCII renderer NOT implemented (next phase).
- Geometry untouched. Geometry animation untouched. Export geometry untouched.
- Dither is preview-only — no dither baking into GLB.
- Texture (pattern) / Dither (threshold) / ASCII (glyphs) remain separate
  systems with separate state, separate modules, and separate shader stages.

### Docs

- `docs/explainers/02-dither.md` — code / tech / math / reasoning
- `docs/research/dither-phase.md` — every source used

### Next branch — `POST_MVP_ASCII_AND_ANIMATED_ASCII_PHASE_1`

### Final locked checkpoint label

`POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1_PASS`

(supersedes `POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1_PASS`; all prior
checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `POST_MVP_ASCII_AND_ANIMATED_ASCII_PHASE_1_PASS`

**Status: ASCII + animated ASCII are LIVE on all four modes.** Glyph renderer
implemented. All three visual primitives (texture / dither / ASCII) now exist
and compose. Geometry, geometry animation, and export geometry untouched.

### What was built

- **`lib/ascii-shader.ts` (NEW)** — glyph-grid renderer. Injects at
  `<dithering_fragment>` AFTER dither, so glyphs represent the tone dither
  produced.
  - **No font, no texture atlas.** Each character is a 5x5 bitmap packed into
    bits (bit index = x + 5*y); a pixel works out its position in the cell and
    tests one bit.
  - **PRECISION:** a full 5x5 block is 2^25-1 but GLSL floats are only exact to
    2^24 — every glyph is split into lo (13 bit) / hi (12 bit) halves. Storing
    the raw value would silently corrupt the densest glyphs.
  - Five charsets: classic `.:-=+*#%@`, blocks, binary, dots, code marks.
- **`scripts/gen/glyphs.py` (NEW)** — generates the bit tables from readable
  ASCII-art strings so bitmaps are reviewable as pictures, not magic numbers.
  **Self-validating:** our `0` encodes to 15255086, the exact constant the
  Codrops reference publishes for the same glyph — confirms the bit convention.
- **`lib/style-shader.ts`** — now composes all three systems into one
  `onBeforeCompile` with the correct stage ordering.
- **`lib/style-system.ts`** — `AsciiAnimationType` (scroll / rain / cycle /
  flicker / revealDensity), `asciiLockMode`. ASCII + ANIMATED_ASCII presets now
  `implemented: true` with real `applies` patches.
- **`components/viewport-3d.tsx`** — ASCII uniforms + per-frame writes + full
  debug readout.
- **`components/style-panel-scaffold.tsx`** — real ASCII panel (charset / cell
  size / density / contrast / lock + animation behaviour / speed / direction,
  with direction disabled for the behaviours that don't travel).
- **`app/page.tsx`** — ASCII chip live.

### Three bugs found ONLY by looking at frames

1. **Empty output.** Raw luminance of near-black ink (~0.05–0.25) only ever
   selected the two sparsest glyphs. Fixed with an exposure step: divide
   luminance by a reference representing "bright for this subject". Density IS
   that reference.
2. **Flat mesh.** The first exposure fix over-corrected — hard contrast
   expansion saturated every cell to the DENSEST glyph, so no character
   variation showed. Contrast multiplier reduced ~3.0 → ~1.1.
3. **Invisible glyphs.** Lit pixels were `surface * 1.35`, which on near-black
   is still near-black. Now hue is recovered by dividing by luminance and
   brightness is set explicitly (bright glyph / near-black gap), same technique
   as dither, so material presets stay distinguishable.

All three were correct code that rendered wrong. This is the third consecutive
phase where the frames-verified rule caught something review would not have.

### CONVENTION NOTE (deliberate inversion)

Traditional ASCII art maps DARK → DENSE (black chars on white paper). Free
Stroke's glyph pixels are the LIT part of a dark object, so we map
BRIGHT → DENSE. Copying the traditional convention would make highlights vanish
and shadows glow.

### Animated ASCII = GLYPH motion, five genuinely different behaviours

scroll (grid travels) / rain (each column falls at its own hashed speed) /
cycle (glyphs change in place, walking the ramp) / flicker (random cells jump
per tick) / revealDensity (density follows draw-in).

### Test results (evidence in `docs/verification/ascii-v1/` + `stack-v1/`)

- **Stills — 20/20 read.** meanΔ 17.06 (extrude/blocks) to 100.42
  (solid/blocks). Zero TOO SUBTLE, zero faint.
- **Distinctness — distinct on all modes.** Closest pair classic vs custom
  (17.03 extrude / 31.43 rod / 58.04 inflate).
- **Motion — 4/4 travel.** solid/scroll 61.86, solid/cycle 46.79, solid/rain
  38.46, inflate/flicker 13.21 (consecutive-frame change).
- **Geometry-rebuild gate — PASS on all four modes** across 30 combined
  texture+dither+ASCII style changes each.
- **NEW: all three systems STACKED — PASS.** texture + dither + ASCII
  simultaneously: no geometry rebuild (buildCount 10→10), export still works
  (261 KB), zero console errors. Four-step layering series captured in
  `docs/verification/stack-v1/`.
- **Taxonomy gates — PASS.** ASCII preset `blockGlyph` applies
  `asciiCharset: blocks` and touches neither `texture*` nor `dither*`. Asserted
  through the real `handleSelectPreset`.
- **Export regression — PASS on all four.**
- **Console errors — 0.**

### Known limitation (documented, not hidden)

Character selection uses PER-PIXEL luminance, not cell-mean luminance, because
this runs in the MATERIAL shader where a fragment cannot read its neighbours.
The ramp is coarsely quantized so nearly every cell resolves to one character; a
cell on a brightness boundary can show two. True cell-averaging requires a
post-process pass — listed in the panel's future controls.

### Observation for the layer-stack phase

With all three systems on at default strengths the result is legible but dark.
Tasteful stacking defaults (one dominant graphic layer, others supporting) are
explicitly that phase's job; `stack-v1/` gives it a baseline.

### Docs

- `docs/explainers/03-ascii.md` — code / tech / math / reasoning
- `docs/research/ascii-phase.md` — every source, incl. the deliberate
  convention inversion and the finding no source covers (dark subjects)

### Next branch — `POST_MVP_VISUAL_TIMING_SYSTEM_PHASE_1`

### Final locked checkpoint label

`POST_MVP_ASCII_AND_ANIMATED_ASCII_PHASE_1_PASS`

(supersedes `POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1_PASS`; all prior
checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `POST_MVP_VISUAL_TIMING_SYSTEM_PHASE_1_PASS`

**Status: one shared clock now drives every animated style layer.** Replaces
three hand-rolled per-system clocks. Geometry, geometry animation, and export
untouched.

### Why this phase existed

Texture, dither and ASCII each grew their own timing code during their own
phases — three near-duplicate implementations with different multipliers and no
shared vocabulary. That drifts, and it makes the interesting behaviours
impossible: "everything pulses together on completion" and "dither joins half a
second after texture" cannot be expressed when each layer only knows its own
accumulator. Fusion (a later phase) is *layers influencing each other over
time*, which requires them to agree on what time is.

### What was built

- **`lib/style-clock.ts` (NEW)** — the single place a layer's phase is computed.
  - `StyleClock`: shared scene time, reveal progress, **seconds since the reveal
    completed**, and stroke duration. Advanced ONCE per frame before any layer
    reads it.
  - Completion is detected by watching the 0→1 BOUNDARY CROSSING, not by testing
    `reveal >= 1` each frame. So a playhead parked at 1 does not retrigger,
    scrubbing back re-arms for replay, and `Infinity` cleanly means "hasn't
    happened yet".
  - `evaluateLayerTime()` returns `{ time, amount, active }`. **`amount` is the
    key design choice**: a 0..1 envelope the caller multiplies effect strength
    by, so one-shot and continuous modes share one interface and renderers never
    branch on mode.
  - `resolveSyncMode()` maps the coarse user-facing MotionMode onto the finer
    per-layer sync mode, so renderers never branch on motionMode either.
- **Six sync modes:** independent / revealSynced / strokeTimeSynced (the
  gesture's own tempo — a slowly-drawn stroke gets slow style motion) /
  delayedAfterReveal / completionPulse / loopSynced (shared loop length so
  layers repeat in lockstep).
- **`lib/style-system.ts`** — added `delayedAfterReveal` to `StyleSyncMode`
  (the PRD lists it; the union was missing it), plus per-layer
  `{texture,dither,ascii}SyncMode` + `Delay`, and a shared `styleLoopSeconds`.
- **`components/viewport-3d.tsx`** — all three renderers rewired onto the shared
  clock; their bespoke accumulators deleted. New `STYLE_CLOCK_DEBUG` singleton
  (same pattern as SOLID_ANIM_DEBUG) so the Debug panel can read a clock that
  lives inside `<AnimatedStrokes>`. Timing debug fields added.
- **`components/style-panel-scaffold.tsx`** — one reusable `LayerTimingControl`
  (timing mode + delay) used by all three panels, so new sync modes appear
  everywhere at once. Shared loop length exposed in the Animation panel.

### The bug the new assertions caught

`assert-timing.mjs` checks each mode behaves in its OWN pattern, not merely that
it moves. The pulse failed its third assertion:

```
PASS  completionPulse / bursts at completion — consecΔ 23.59
FAIL  completionPulse / decays back to still — consecΔ 1.14
```

It was decaying 95% but never STOPPING — with a 1.1s decay and a 1% cutoff it
kept creeping at ~10% strength for many seconds. A one-shot that never ends is
not a one-shot. Every screenshot of this looks correct ("it bursts and fades");
only measuring frame-to-frame change long after the burst exposes it. Fixed with
a 0.55s decay + 4% cutoff → definite ~1.8s lifetime, then EXACTLY static
(verified 0.00).

### New verification tooling

- `scripts/verify/verify-timing.mjs` — captures each mode under conditions
  designed to expose it (continuous with reveal parked; delayed/pulse across a
  completion event; reveal-synced both held and scrubbed).
- `scripts/verify/assert-timing.mjs` — turns those into pass/fail behavioural
  assertions.
- `diff-frames.mjs` metric fix: a periodic effect that completes a full cycle
  inside the capture window ends where it started, which the old scoring
  mislabeled "jitters in place". Low span + HIGH frame-to-frame change now reads
  "travels (periodic — returned to phase)".

### Test results

- **Timing assertions — 10/10 PASS.**
  - independent 40.24, loopSynced 38.21 (animate freely)
  - delayedAfterReveal: **0.00 during** the reveal, 37.83 after
  - completionPulse: **0.00 before**, 14.14 burst, **0.00 settled**
  - revealSynced: **0.00 held**, 32.69 when scrubbed
- **Regression — texture + dither animation re-captured after the refactor,
  all still travel** (texture 17.78–59.00, dither 9.87–73.43).
- **All 20 gates still PASS**, including all three systems stacked with no
  geometry rebuild and working export.
- **Console errors — 0.**

### Docs

- `docs/explainers/04-timing-system.md` — the model, the six modes, the
  completion-detection detail, and the one-shot bug

### Next branch — `POST_MVP_LAYER_STACK_PHASE_1`

Carry forward: the stack phase owns TASTEFUL DEFAULTS. With all three systems on
at full strength the result is legible but dark (see `docs/verification/stack-v1/`).
The PRD's guidance — one dominant graphic layer, others supporting — is that
phase's job, and it now has both a baseline capture and a shared clock to build
group animation on (`amount` exists for exactly that).

### Final locked checkpoint label

`POST_MVP_VISUAL_TIMING_SYSTEM_PHASE_1_PASS`

(supersedes `POST_MVP_ASCII_AND_ANIMATED_ASCII_PHASE_1_PASS`; all prior
checkpoints remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `POST_MVP_LAYER_STACK_PHASE_1_PASS`

**Status: the stack compositor is LIVE.** Three independent effects are now a
composition: per-layer opacity, blend mode, post-lighting order, and five
tasteful presets. Geometry, geometry animation, and export untouched.

### The refactor that made it possible

Dither and ASCII were INLINE blocks pasted into the shader tail, each mutating
`gl_FragColor` where it sat. An inline block can only ever run where it was
pasted — text already substituted cannot be reordered. Both became pure
`vec3 -> vec3` functions (`fsApplyDither`, `fsApplyAscii`), and the composer
picks order at runtime from a uniform. Both orders compile into ONE shader, so
switching order costs nothing (no recompile, no material swap, rebuild gate
still passes). Composability had to exist in the shader's SHAPE before it could
exist in the UI.

### The honest constraint: texture cannot be reordered

Texture is not a layer over the object — it IS part of the object, modulating
albedo + roughness BEFORE/DURING lighting. Dither and ASCII operate on final
shaded tone AFTER lighting. Putting texture "above" ASCII would mean re-running
the entire lighting calculation on top of the glyphs (rendering the material
twice). So the UI shows texture as "1 · Texture (base)" with an explanation, and
offers order only for the two layers that genuinely swap. **A control that
silently does nothing is worse than a missing one.**

Dither <-> ASCII order genuinely matters (measured Δ 56.16, among the largest
differences in the stack):
- dither → ascii: characters chosen from already-quantized tone. Crisper, printed.
- ascii → dither: glyphs get thresholded, so dither breaks up the character
  shapes. Grittier, degraded-terminal.

### What was built

- **`lib/style-stack.ts` (NEW)** — blend modes (normal / multiply / screen),
  order model, the shared `fsStackBlend` GLSL helper every layer routes through,
  and `resolveStack()`.
- **`lib/style-shader.ts`** — composer emits the ordered branch; new
  `StackUniforms`.
- **`lib/dither-shader.ts` / `lib/ascii-shader.ts`** — refactored to composable
  functions; gained blend + amount uniforms. Dead standalone installers removed.
- **`lib/style-system.ts`** — `stack{Texture,Dither,Ascii}Opacity`,
  `stack{Dither,Ascii}Blend`, `stackOrder`. LAYER_STACK presets now
  `implemented: true` with real compositions.
- **`components/viewport-3d.tsx`** — stack resolved once per frame; layer
  amounts now compose THREE multipliers (own control × stack opacity × timing
  envelope); stack debug fields.
- **`components/style-panel-scaffold.tsx`** — real Layers panel: per-layer
  opacity + blend rows, order control, preset buttons.

### Taste, expressed numerically

Soft Signal Stack (the only preset using all three layers):
`stackTextureOpacity 0.30 / stackDitherOpacity 0.35 / stackAsciiOpacity 0.85`,
dither on multiply. That is the PRD's "one dominant layer, others supporting"
rule as numbers. The five presets each pick a different dominant layer.

**Confirmation that earlier decisions paid off:** the presets visibly carry their
MATERIAL colour (Terminal Stack reads cyan from Signal, Graphic Slab reads warm
from Matte Clay). That is the hue-preservation choice from the dither and ASCII
phases — both divide by luminance and re-apply the tint rather than outputting
pure black/white — so the material system still means something underneath the
graphic layers.

### Test results (evidence in `docs/verification/stack-v1/`)

`assert-stack.mjs` (NEW) exists because a control that renders identically
whatever you set it to is worse than a missing control. **9/9 PASS:**

- layering: texture Δ31.43, dither Δ47.67, ascii Δ31.23
- **order**: dither-first vs ascii-first Δ56.16
- blend: normal/multiply Δ24.98, normal/screen Δ25.28, multiply/screen Δ50.26
- **opacity**: full vs low Δ58.58
- all five presets pairwise distinct, closest Δ22.37

Presets applied through the REAL `handleSelectPreset`, not a parallel path.

- **All 20 gates still PASS** after the shader refactor (incl. no geometry
  rebuild with all three systems stacked, export intact).
- **All 10 timing assertions still PASS.**
- **Console errors — 0.**

### Docs

- `docs/explainers/05-layer-stack.md` — the constraint, the refactor, the three
  multipliers, and what taste means numerically

### Next branch — `POST_MVP_ANIMATED_LAYERING_AND_STACK_ANIMATION_PHASE_1`

Stack-level animation (the whole group animating as one container) is next. It
will build on the shared clock's `amount` envelope, which exists for exactly
this. Per-layer animation already works; what's missing is the group.

### Final locked checkpoint label

`POST_MVP_LAYER_STACK_PHASE_1_PASS`

(supersedes `POST_MVP_VISUAL_TIMING_SYSTEM_PHASE_1_PASS`; all prior checkpoints
remain in effect as underlying layers)

---

## LOCKED CHECKPOINT — `POST_MVP_STACK_ANIMATION_PHASE_1_PASS`

**Status: stack-level animation is LIVE.** The whole layer group animates as one
container while layers stay independently editable. Geometry, geometry
animation, and export untouched.

### The distinction this phase makes concrete

- per-layer animation: one layer moves on its own (built earlier)
- **STACK animation: the group moves together (this phase)**
- fusion animation: layers influence EACH OTHER (still absent, next major phase)

The mental model is a Photoshop layer group / AE precomp: contents keep their own
settings and keep doing their own thing; you animate the container.

### How it works

Two group values applied UNIFORMLY to every layer:
- `amount` multiplies each layer's contribution (fades, pulses)
- `timeOffset` is added to each layer's phase (the stack drifts in formation)
- plus `frozen` for freeze-on-complete

Uniform application is the point: layers keep their RELATIVE BALANCE, so a preset
tuned "ASCII dominant, others supporting" arrives in that proportion rather than
rearranging itself on the way in.

A layer's final strength now composes four dials:
`own control × stack opacity × its timing envelope × group amount`.

### Seven behaviours

fadeIn / pulse (bottoms out at 0.45, never fully vanishes) / drift / 
delayAfterReveal / completionPulse (swells ABOVE resting, settles back to exactly
1) / freezeOnComplete / loop. Six stack-animation presets implemented.

### The bug the assertions caught

`fadeIn` failed: presence 66.3 → 67.5 across the whole fade. Root cause was a
real design mistake — **the fade measured from SCENE START**. By the time a user
enables fadeIn, `clock.elapsed` is already far past the 1.2s fade, so the group
is at full strength before the first frame renders. The feature was invisible in
exactly the situation where you would use it. Fixed by measuring from when the
behaviour was ARMED (viewport stamps `clock.elapsed` when `(enabled, behaviour)`
changes and passes `sinceArmed`). Also gives drift/loop a sensible start phase.
After: 90.2 → 73.6.

**This is the SECOND "measure from when?" bug** (the first was completion
detection in the timing phase). Standing lesson recorded in the explainer:
time-based effects need an explicit origin, and "scene start" is almost never it.

### freezeOnComplete needed a phase snapshot

Freezing cannot just stop the clock — it is shared. Instead the viewport
snapshots each layer's current phase ON THE TRANSITION into freeze and pins the
uniforms there, clearing on release so replay works. Verified consecutive-frame
change 61.46 during the reveal, **0.00** after — identical frames, not "nearly
still".

### Test results (evidence in `docs/verification/stack-anim-v1/`)

`assert-stack-anim.mjs` — **6/6 PASS:**
- fadeIn presence 90.2 → 73.6 across the fade
- pulse oscillates (consecΔ 54.98)
- drift slides (consecΔ 44.89)
- delay: absent during reveal (93.3) vs present after (67.6)
- freeze: animates during (61.46), EXACTLY still after (0.00)

Note the deliberate mix of measures: motion questions use frame-to-frame change,
presence questions use mean luminance over the object's pixels. "How much of the
effect is present" is not the same question as "is it moving" — using the wrong
measure would have passed a broken fade.

**Full regression: 20/20 gates, 10/10 timing, 9/9 stack — all still PASS.**
Console errors 0.

### Docs

- `docs/explainers/06-stack-animation.md`

### Next branch — `POST_MVP_FUSION_PRESETS_PHASE_1`

Fusion is where layers stop being independent and start influencing each other
(ASCII density driving dither threshold, etc). Per the PRD this must come after
the individual systems and the stack — both now exist, so fusion is unblocked.

### Final locked checkpoint label

`POST_MVP_STACK_ANIMATION_PHASE_1_PASS`

(supersedes `POST_MVP_LAYER_STACK_PHASE_1_PASS`; all prior checkpoints remain in
effect as underlying layers)

---

## LOCKED CHECKPOINT — `CRAFT_PASS_TEXTURE_AND_MATERIAL_STRENGTH`

**Status: quality pass on the two systems Sebs called weak.** Fable craft agent,
judged in a HEADED browser (headless:false, Metal ANGLE) per his explicit
instruction. No geometry touched; all gates still pass.

### Sebs's verdict that triggered this

"a lot of the animations for textures are hard to notice or just don't do
anything · need more options · a lot of the options are just weak · texture and
material are the easiest to make and they suck"

He was right, and my verification was the reason I missed it: I measured "did
the pixels change", never "is this strong enough to be worth having". Those are
different questions. Every numeric gate passed on effects that looked like
nothing.

### Real bugs found (all mine, all invisible to the existing gates)

1. **completionFlash never ended.** `completion` stays 1 after the draw, so the
   "flash" froze into a permanent gray glow. Before-frames 1s apart were
   BYTE-IDENTICAL. Rewired to ramp over the last 20% of the draw then decay on a
   real `sinceCompletion` clock — a genuine one-shot.
2. **Animation-off left material state stuck.** metalness / emissive /
   sheenColor kept their last animated values instead of pinning back to base.
3. **Animated textures genuinely did not move perceptibly.** Frames 1s apart at
   54 dB PSNR (bubbleDrift) = nothing. Texture clock base rate was 0.6.
4. **contourBands and gelBubbles were INVISIBLE** — textured and untextured
   frames indistinguishable.

### Changes

- **Texture strength**: albedo gain 1.6→2.4, roughness swing 0.85→1.3; noise
  re-expanded + third octave; bands smoothstep-shaped; contour lines thickened;
  grain now re-seeds on a time step so it BOILS like film grain instead of
  sliding invisibly.
- **Texture motion**: clock base 0.6→1.2, preset speeds roughly doubled, preset
  intensities 0.35–0.55 → 0.6–0.75. Emil framework: decorative, rarely-seen,
  expressive canvas motion may be present; target one visible feature-cycle per
  ~1–1.5s (was ~4s, which reads as static).
- **7 NEW texture patterns** (indices APPENDED so saved states stay valid):
  crosshatch, dots (ink-dot grid — texture, not dither), woodgrain, cellular,
  brushed, craquelure, ripple. Plus 4 new animated presets.
- **7 NEW materials**: ceramic, chalk, chrome, gold, wax, neon, iridescent
  (thin-film via new optional MaterialParams fields). Existing six retuned so
  glossyPlastic/softGel/rubber stop collapsing into each other.
- **Environment rig strengthened** (key 3→5, rim 1.6→2.5, fill 1.1→1.8, streak
  4→8 narrower, + a horizon band) — glossy and metal now have something to
  mirror. This was the root cause of "every material is slightly different
  black": roughness differences are invisible without reflections.
- **Animated material**: env swells now ADDITIVE as well as multiplicative (a
  multiplier alone dies on a matte base); roughnessPulse reaches near-mirror;
  gelShimmer forces a visible sheenColor on black-sheen bases; signalFlicker
  gained hard dropout blinks (61→37 dB frame change).

### Measured improvement

- Texture pairwise distinctness (closest pair, grain vs noise):
  **13.8–23.9 → 28.9–42.7** across the four modes.
- Animated texture frame-pairs: **37–54 dB/s → 29–37 dB per 0.6s.**
- `verify-gates.mjs`: **ALL GATES PASS** (rebuild counts flat on all four modes
  incl. the 7 new patterns, exports valid, taxonomy clean, 0 console errors).

### New tool

`scripts/verify/verify-live.mjs` — opens a REAL VISIBLE Chrome window and holds
it open. The headless scripts answer "did pixels change"; only a live window
answers "is this noticeable". Use it for any judgment call from now on.

### Still weak (honest)

- **shineSweep** is a global gloss wave, not a travelling highlight. A real
  positional sweep needs a shader-level band next to the texture injection
  (~half a day of GLSL).
- **chrome** reads as dark metal rather than a mirror — there is little in the
  scene for it to reflect. A richer environment would fix it.
- **chalk vs ceramic** are close head-on; they separate on orbit.
- **iridescent** shift is real but modest at stroke scale.

### Standing lesson

Numeric gates must test the effect's OWN signature and its STRENGTH, not just
that something changed. "Reads" needs a perceptual floor a designer would agree
with, not a pixel-difference floor.

### Final locked checkpoint label

`CRAFT_PASS_TEXTURE_AND_MATERIAL_STRENGTH`

---

## LOCKED CHECKPOINT — `CRAFT_PASS_SWEEP_ENV_AND_MATERIAL_FAMILY`

**Status: the four named residual weaknesses are fixed.** Fable pass, judged
headed. Geometry untouched; all gates pass.

### 1. shineSweep is now a real travelling highlight

It was a GLOBAL gloss wave (whole surface brightening together). Now a
soft-edged band in normalized stroke units (`uFsSweepCx/Cy/R` from stroke
bounds, so ±1.35 clears any drawing size), injected at TWO points:
`<emissivemap_fragment>` adds a luminance-adaptive glow (carries dark bodies),
`<lights_physical_fragment>` pulls roughness→0.03 and eats diffuse scaled by
body luminance (carries light bodies as a glassy stripe). On light bodies the
band FLANKS additionally pull specular/clearcoat down, giving "dark wet flanks
around a white-hot streak" — because a bright band has nowhere to go on white.

Measured: distinct frames per 8 samples went **4/10 → 7/8 (ink), 7/8 (ceramic),
8/8 (matteClay)**. On ink (the default) it is dramatic — one frame has the right
half brilliantly lit, four frames later the band has left the form.

### 2. chrome is a mirror now

Root cause was an empty environment — nothing to reflect. The reflection-only
rig went from 4 to **11 Lightformers**: key, cool rim, warm low fill, tight
streak, horizon band, three vertical window slats on the camera side (the
structural edges a mirror needs head-on), a dim wall behind camera (kills
black-hole front faces), warm floor bounce. Matte presets did NOT wash out —
they shield themselves via low envMapIntensity (matteClay 0.12, chalk 0.05,
rubber 0.4).

### 3. chalk vs ceramic separate head-on

Double-coded: TEMPERATURE (ceramic #e2e6ea cool blue-white vs chalk #e7e2d6 warm
ivory) and SURFACE (ceramic roughness 0.12 + clearcoat 1.0 + env 1.8 → crisp
glaze streak; chalk roughness 1.0, reflectivity 0.03, env 0.05 + a powder sheen
lobe → flat, dusty, zero specular).

### 4. iridescent reads as oil-slick

Thickness range widened to 120–800nm, metalness 0.65, roughness 0.06, env 2.6,
plus `IRIDESCENCE_SWIRL_GLSL` (compiled only under `USE_IRIDESCENCE`) which
swirls per-fragment film thickness with two octaves of value noise. Without a
thickness MAP three.js uses ONE thickness for the whole surface, which is why it
previously showed a single hue head-on. Now multiple hues band across one tube
simultaneously.

### Also fixed

- `completionFlash` **never ended** — `completion` stays 1 after the draw, so the
  flash froze into a permanent glow (frames 1s apart were byte-identical). Now
  ramps over the last 20% of the draw and decays on a real `sinceCompletion`
  clock.
- Turning material animation OFF left metalness / emissive / sheenColor stuck at
  their last animated values.

### Verification

`verify-gates.mjs` ALL PASS. Sweep verified by frame series on ink / ceramic /
matteClay; chrome, gold and iridescent verified as stills; full 13-material ×
4-mode contact sheets reviewed.

### Honest limits

- shineSweep on **chrome** barely reads (a band inside a mirror). Would need a
  per-fragment env-intensity override in `getIBLRadiance` (~2h GLSL).
- shineSweep on **white bodies** is inherently subtler — it works by darkening
  flanks, since white cannot get brighter.

### Final locked checkpoint label

`CRAFT_PASS_SWEEP_ENV_AND_MATERIAL_FAMILY`

---

## LOCKED CHECKPOINT — `ENGINE_PASS_1_ROD_EXPORT_AND_CAMERA_FRAMING`

**GEOMETRY IS NOW UNLOCKED.** Sebs explicitly lifted the PRD's "do not touch
geometry" rule ("even if its from the inflate extrude etc maximise and improve
to max"). Because that lock existed for a reason, a regression net was built
FIRST and must be used for every engine change from now on.

### NEW: `scripts/verify/geometry-baseline.mjs` — the geometry regression net

Runs 8 stroke shapes drawn from this project's own failure history (open C,
closed O, near-touch gap, zigzag corners, self-intersecting scribble, two
strokes, degenerate tick, loopy S) through all four modes; records export size
and a rendered PNG per cell.

```
node scripts/verify/geometry-baseline.mjs --save=before
...change an engine...
node scripts/verify/geometry-baseline.mjs --save=after
node scripts/verify/geometry-baseline.mjs --compare=before,after
```

A HARD failure is geometry or export DYING. Everything else is a judgment call —
the PNGs are there to be looked at. Improving an engine SHOULD move the numbers;
the point is that every move is visible and deliberate.

### Rod export was 10.7 MB. Now 1.84 MB.

**Root cause:** joint spheres. They fill the wedge gap on the OUTSIDE of a sharp
corner where two consecutive tube cross-sections don't meet — so the vast
majority of each sphere is buried inside the tube, and only a small cap is ever
visible. They were being built at full `SPHERE_SEGMENTS` (14x14 = 225 verts) and
deduplicated only every `0.75 x TUBE_RADIUS`, so consecutive spheres overlapped
almost entirely. A dense scribble piled up hundreds of them.

**Fix:** new `JOINT_SPHERE_SEGMENTS = 8` (81 verts, 2.8x cheaper) used for
joints only — caps keep full resolution because caps ARE visible at stroke ends
— and dedup widened to `1.8 x TUBE_RADIUS`. A sphere spans 2x radius, so
adjacent joints still touch and corners stay filled. Applied to BOTH the export
path and the preview path so parity is preserved.

**Measured (export bytes, before → after):**

| shape | change |
| --- | --- |
| scribble | **-83%** (10.7 MB → 1.84 MB) |
| zigzag | -81% |
| closedO | -77% |
| nearTouch | -76% |
| loopyS | -69% |
| openC | -67% |
| twoStrokes | -60% |
| tick | -39% |

Extrude, Solid and Inflate exports are **byte-identical** across all 8 shapes,
confirming the change was surgical. Corners verified visually on the zigzag case
(the sharpest) — no gaps, no change in appearance.

### Camera never framed a newly drawn stroke

**Symptom:** draw a stroke and the 3D panel showed a hugely-zoomed, apparently
empty grid until the user found "Reset camera".

**Root cause:** the auto-frame effect required `prevCountRef.current === 0`
while `prevCountRef.current = strokeCount` ran UNCONDITIONALLY at the end. The
mesh is built in a memo downstream of this effect, so on the render where the
first stroke arrives `bounds` is usually still null — the effect did nothing,
but the counter advanced anyway, permanently consuming the one-shot.

**Fix:** `hasFramedRef` is the real one-shot gate, so gate on that alone (plus a
valid bounds radius and live controls) and let the effect re-attempt on the next
render that has bounds. Verified by drawing with real pointer events: the form
is framed immediately.

### Gates

`verify-gates.mjs` ALL PASS.

### Final locked checkpoint label

`ENGINE_PASS_1_ROD_EXPORT_AND_CAMERA_FRAMING`

---

## LOCKED CHECKPOINT — `CRAFT_PASS_DITHER_AND_ASCII_STRENGTH`

**Status: dither and ASCII brought up to the bar texture/material already met.**
5 dither types → **10**; 5 ASCII charsets → **10**. Fable pass, judged headed.

### Root causes found (all invisible to the previous numeric gates)

- **Default cell sizes were SUBPIXEL.** `ditherScale: 1` made halftone cells
  smaller than a pixel, which is why halftone rendered as a solid black stroke —
  completely invisible. `asciiCellSize: 8` gave 1.6px per glyph pixel, so no
  charset could read as characters; it was woven rope texture.
- **Same near-black exposure disease ASCII already had.** The stroke's real
  tonal range measured 0.30–0.62 with mass at 0.538, so contrast-about-0.5 left
  every pixel half-open and bayer/blueNoise came out as uniform 1px mush.
- **`lines` washed the form into the paper** — the `tint * q` rebuild sent lit
  cells to luminance 1.0, matching the background.

### Fixes

- New `ditherExposure` uniform + slider: divides raw luminance by
  `mix(1.9, 0.16, e)` so the subject's real range spans the ramp.
- Pattern floor `max(lum, pow(raw/ref, 0.4) * 0.42)`: a glossy-black subject
  (rod/extrude, raw ~0.04) was previously unrescuable at ANY dial setting; it
  now keeps 10–15% threshold structure. Default material unaffected.
- Ink/paper duotone rebuild, light end capped at 0.9 tint — the form no longer
  dissolves into the background.
- `ditherScale` 1→3, `asciiCellSize` 8→13, per-type cell factor x2.4 for
  cell-grown marks.

### New options

**Dither (+5, all threshold-based, with a new `ditherAngle` dial):** dotScreen
(angled clustered dot — classic print screen), hatch (bold 45° triangle-profile),
crosshatch (min of two orthogonal screens — engraving weave), diamond (L1 dots),
newsprint (angled dot + IGN grain — ragged cheap print). All 10 distinct,
closest pair 26.97 meanΔ.

**ASCII (+5):** braille, boxes, arrows, punct, numeric. `glyphs.py` now also
emits `fsRampMaxFor(charset)`, replacing a hand-maintained nested ternary.
Indices 0–25 unchanged, 26–56 new. All 10 distinct, closest pair 17.75 meanΔ.

### Verification

`verify-gates.mjs` ALL PASS (19/19), gate sweep extended to all 10 dither types
and 10 charsets. Animation measured over ink pixels per ~90ms frame: crawl 90.7,
scroll 60.0, cycle 46.1, rain 35.5, flicker 13.7.

### Still weak

- Flicker is the least present animation (13.7).
- Numeric/punct glyphs read as marks rather than unmistakable digits below
  cell ~16.
- Rod is ~8px thin, so any screen coarser than bayer shows only 1–2 pattern
  rows — inherent to the geometry, not the shader.

### Final locked checkpoint label

`CRAFT_PASS_DITHER_AND_ASCII_STRENGTH`

---

## LOCKED CHECKPOINT — `ENGINE_PASS_2_EXTRUDE_JOINS_CAPS_AND_STRATEGY_COLLAPSE`

**Status: Extrude polished and its dead strategy chain removed.** 885 lines
deleted, 218 added. Rod / Solid / Inflate untouched and byte-identical.

### The strategy chain was 100% dead weight

Instrumented live across all 8 baseline shapes: **every stroke — including
straight lines and the 6-point degenerate tick — ran `legacy → continuous-ribbon`.**
The "preferred" legacy parametric `buildRibbonShape` → `THREE.ExtrudeGeometry`
path **never once succeeded** (its self-built contour always failed
`validateShapeContour`); the raster-trace strategy was **unreachable** (a
compile-time const never flipped); Rod fallback effectively never fired.

Continuous-ribbon IS the Extrude engine now. Removed: `rasterizeStrokeToRibbonMask`,
`buildRasterizedRibbonShape`, `buildRibbonShape`, `EXTRUDE_GEOMETRY_STRATEGY`,
`validateShapeContour` + four contour helpers, `safeExtrude`,
`isExtrudeGeometryDegenerate`, `_deprecatedBuildSegmentedRibbonGeometry`. Kept
`segmentsIntersect` (Solid uses it), the `ExtrudeStrategyTag` type (debug
overlay), and Rod fallback strictly for <2-sample input.

### The years-old "spikes/blob" mystery, solved

The deprecated miter used `halfWidth / sin(φ/2)` — which **DIVERGES on
nearly-straight vertices** — where it needed `halfWidth / cos(φ/2)`. That single
error is why miters were abandoned in this codebase and replaced with the
pinch-prone clamp that has been degrading corners ever since.

### Fixes

- **Joins**: correct miter (`halfWidth / cos(φ/2)`, clamped 2x, obtained free
  from the averaged-normal length since `|n1+n2| = 2cos(φ/2)`). Corners were
  pinching to ~70% width with bright artifacts; they are now full-width and
  sharp. Compare `extrude_before/zigzag_extrude.png` → `extrude_after/`.
- **Caps**: flat chopped quads → rounded half-disks (profile revolved around the
  endpoint, watertight, winding handled per cap handedness).
- **Twist**: impossible by construction (offsets planar XY, Z constant);
  confirmed edge-on.
- **Bevel toggle was doing NOTHING** — continuous-ribbon ignored it. It now
  switches a sharp rectangular profile against a chamfered octagonal one,
  carried around the caps too. Verified by clicking the real button.

### Cost

Extrude export bytes roughly doubled (openC 28→57 KB, scribble 131→262 KB).
That is the octagonal chamfer (4→8 verts/sample, bevel ON by default) plus round
caps — bought function, not waste. Extrude remains by far the lightest mode
(59 KB vs Rod's 704 KB on the gate export).

### Verification

`verify-gates.mjs` ALL PASS. Geometry net: Rod/Solid/Inflate `=` on every metric
for every shape. Live headed orbit inspection (front, ~50° right, upper grazing,
edge-on) on zigzag / loopyS / scribble, plus a bevel-off pass and a
25/50/75/100% reveal sweep — partial reveals cap correctly, so the animation
contract holds. Stills in `docs/verification/geometry/extrude_orbit/`.

### Still weak

- Tiny tan flecks at extreme corner tips (pre-existing, present in the before
  PNGs). Mesh is watertight there; reads as clamped-miter chamfer normals
  catching the warm ground reflection. A true fix is arc-fan round JOINS at
  clamp-triggering corners (~40 lines).
- Overlapping scribble regions are coplanar overlap, not a real union. Invisible
  today; a CSG union is the principled fix if styles ever make it show.

### Final locked checkpoint label

`ENGINE_PASS_2_EXTRUDE_JOINS_CAPS_AND_STRATEGY_COLLAPSE`

---

## LOCKED CHECKPOINT — `ENGINE_PASS_3_STROKE_PROCESSING_MATH`

**Status: smoothing algorithm corrected, spacing contract restored.** Honest
result: one change is preventive rather than a fix for a visible bug — see the
measurement below.

### Change 1 — Taubin (lambda|mu) smoothing instead of plain Laplacian

The kernel was `c*0.5 + (p+n)*0.25`, i.e. a Laplacian pass with lambda = 0.5,
run twice. Laplacian smoothing always pulls each point toward the chord between
its neighbours, so every iteration SHRINKS the curve. Taubin alternates the
smoothing pass with a slightly larger NEGATIVE pass (mu = -0.53) which
re-inflates; high-frequency tremor is removed by both, low-frequency shape
survives because they cancel there. Stability condition `1/lambda + 1/mu > 0`
holds.

**MEASURED HONESTLY: at the default 4px spacing this changed rendered size by
0.00%.** Shrinkage per pass scales roughly as `s^2 / 8R`, so at s=4px against a
~170px radius it is ~0.006px — below noticing. The change is therefore
PREVENTIVE, not a fix for a visible defect: it matters at coarse spacing and
tight curvature (s=20px against R=50px works out near 4% over four passes), both
of which the spacing slider can reach. It is the correct algorithm and costs
nothing, so it stays — but it should not be described as having fixed a bug.

### Change 2 — re-resample AFTER smoothing (the measurable win)

Smoothing moves points off the arc-length grid the resample just built, and
every downstream engine assumes roughly even spacing: Rod's tube cross-sections,
Solid's rasteriser and Inflate's loft all sample the point list directly, so
uneven spacing shows up as wobbling tube radius and stair-stepped contours.
Re-resampling after smoothing restores the even grid while keeping the smoothed
shape.

Measured effect (export bytes): twoStrokes rod -15%, extrude -22%, inflate -23%;
tick -9% across modes; the dense shapes unchanged. Fewer, better-placed samples
for the same form.

### Verification

Geometry net `sp_before` vs `sp_after`: no hard regressions, nothing died.
Rendered bounding boxes measured on closedO / openC / loopyS in both solid and
rod: **0.00% change** on every axis except a 0.35% rounding on one. Hole
detection on the closed O still correct. `verify-gates.mjs` ALL PASS.

### Not done (deliberately)

Input jitter filtering (one-euro / velocity-adaptive low-pass on raw pointer
data) and curvature-adaptive sample density were both considered. Neither was
implemented: the first needs real hand-drawn input to tune against rather than
synthetic test strokes, and the second changes the point-count contract that
Solid's animation hole-stabilisation depends on. Both are worth doing with a
human in the loop.

### Final locked checkpoint label

`ENGINE_PASS_3_STROKE_PROCESSING_MATH`

---

## LOCKED CHECKPOINT — `CRAFT_PASS_STACK_AND_ALL_ANIMATION`

**Status: stack presets rebuilt, three animation bugs fixed, and a headline
feature found silently dead in 3 of 4 modes.** Fable pass, judged headed.

### THE BIG ONE: Natural/Authentic did nothing in Solid, Extrude and Inflate

`filterStrokesByProgress` cuts the reveal by **raw arc length**, so those three
modes always played back at constant speed regardless of how the stroke was
actually drawn — and the Natural/Authentic toggle, a user-facing control, was
**silently inert in three of the four modes**. Only Rod honoured pen timing.

Fixed with `penTimeDistanceFraction` in `viewport-3d.tsx`: maps the playhead's
time fraction through the processed points' own timestamps, with the same
hybrid/raw/smooth semantics Rod already used. Verified deterministically — the
same time fraction now produces different fronts per mode (Authentic 934 vs
Natural 950 at t=0.5), both correctly lagging linear through a slow section,
with the final frame still bit-identical to the static preview.

**Natural vs Authentic is real but conditional**: measured within-stroke speed
contrast ~4x (Authentic) vs ~2.7x (Natural) on a hesitating stroke; on evenly
paced strokes they are identical BY CONSTRUCTION. Nothing in the UI says this.

### Two more "technically correct, perceptually absent" bugs

- **`drift` was completely static in the real user flow** (consecutive-frame
  Δ 0.00). Static ASCII ignored the group offset entirely, static dither had a
  zero direction vector, and horizontal scanlines are invariant along their own
  travel axis — so the one behaviour whose entire job is moving the group moved
  nothing. Now static dither borrows the diagonal travel vector and static ASCII
  rides the scroll branch on the shared offset; rate 0.6→1.1. Δ ~48/frame.
- **`completionPulse`'s swell was architecturally invisible**: `fsStackBlend`
  clamped `amount` at 1.0, so a 1.0 → 1.6 → 1.0 envelope rendered IDENTICAL
  frames on any preset with near-1 opacities. Fixed with overdrive headroom
  (amount clamps at 1.6, output still clamps to 1). Peak now Δ34.
- `pulse` had **no preset chip at all** — the only behaviour missing from the
  rail. Added.
- `loop` was indistinguishable from drift and snapped N units at the wrap on
  non-periodic patterns. Rewritten as a **ping-pong** on the shared loop clock:
  continuous Δ ~45 with a smooth velocity dip at the turnaround, no snap.

### Three of five stack presets had ROTTED

They were authored before the material/dither/ASCII strengthening passes AND
before `ditherExposure` existed, so none set exposure — bright bodies sat above
every threshold, dark bodies below.

- `cleanInkStack` — grain fully invisible (0.3 × 0.7 = 0.21 effective).
- `terminalStack` — glyphs below the 13px legibility floor; woven mesh.
- `graphicSlabStack` — worst case: matte clay clamped below every threshold, so
  only the shader's pattern floor rendered — flat checker wallpaper, zero tonal
  modelling.
- `softSignalStack` — **completely dead**: darker rubber sat at ramp level 0, so
  every ASCII cell drew the blank glyph and the "all three layers" preset
  rendered as a plain black stroke.
- `ditheredGelStack` — the one that survived. Untouched.

All retuned live. **6 new presets** (11 total): newsprintStack, woodcutStack,
porcelainPrintStack, marqueeStack, blueprintStack, gildedStack — each a concept,
each iterated live until it read.

### Verification (all re-run independently by me)

- `assert-stack.mjs` **9/9** — 11 presets pairwise distinct, closest Δ 60.08
  (was 22.37 with five).
- `assert-stack-anim.mjs` **6/6** — drift consecΔ 86.02, freeze exactly 0.00.
- `assert-timing.mjs` **10/10**.
- `verify-gates.mjs` **ALL PASS**.

### Still weak

- **Solid draw-in runs at ~6–10 fps** — the per-tick geometry rebuild. Pacing is
  correct but choppy. Fix lives in the raster/contour rebuild path.
- Texture whose travel axis is degenerate for its own pattern (horizontal travel
  on horizontal scanlines) still doesn't slide under group drift; dither and
  ASCII carry it. A per-pattern "natural travel axis" would fix it.
- Marquee bulbs read as square dots — 5x5 glyph bitmaps have no sub-pixel
  roundness at any cell size.
- Natural/Authentic has no UI explanation of when it matters.

### Final locked checkpoint label

`CRAFT_PASS_STACK_AND_ALL_ANIMATION`

---

## LOCKED CHECKPOINT — `ENGINE_PASS_4_SOLID_PERFORMANCE_AND_INFLATE_FORM`

**Status: the last two engines done. All four engines have now had a real pass.**

### Another buried mistake, same species as Extrude's sin/cos

`contourSelfIntersects()` ran an **O(n²) check every animation frame on the raw
per-lattice-edge contour** (thousands of unit segments). On a traced
grid-boundary loop a proper crossing is **geometrically impossible** — the edges
are unit, axis-aligned, and each undirected edge is emitted at most once. So it
was performing millions of segment-vs-segment tests per frame **to compute a
constant `false`.** The gate now runs on the collinear-simplified loop (identical
polygon, 10–30x fewer vertices).

### Solid draw-in: ~17fps → smooth

Measured headed with real rAF deltas via the actual Play button.

| | before | after |
| --- | --- | --- |
| standard stroke | 57.4ms/frame busy mean (~17fps), 28 frames >40ms | **0 frames >40ms**, max 34ms, p99 26ms |
| heavy 600-pt scribble | 66.5ms (~15fps) | 34.1ms (**~29fps**) |

Causes fixed, all in `lib/solid-mask.ts` unless noted:
- the impossible O(n²) self-intersection test above
- both flood fills used `queue.shift()` — O(n) per pop → head-pointer queues
- a fresh canvas + non-`willReadFrequently` 2D context per rasterize (2x/frame)
  → cached module-level canvas with `willReadFrequently: true`
- ~8 `console.log`s with object payloads per build per frame → gated to
  animated builds only; static/export logging unchanged
- animated builds rasterize at **384px instead of 512** (playback ONLY — static,
  final committed frame and export stay at 512). Hole thresholds scale by
  resScale so topology decisions stay resolution-independent.

### Edge aliasing fixed — and Solid exports shrank 53–93%

The raw 512-res marching boundary (pixel staircase) fed directly into earcut,
the H3 walls and the silhouette. Now: exact collinear simplification → 3 Chaikin
corner-cut passes → Douglas-Peucker at 0.45px, with guards (area retention
90–105%, self-intersection check, fallback to the exact loop). Max deviation
<0.9 mask px — inside the ≥1px filled wall separating hole from outer boundary,
so smoothing can never fuse or create topology. Applied to the outer contour and
every hole rim.

### Inflate — honest verdict and two real fixes

It remains a swept tube loft, not an inflated volume. Two genuine deficiencies
fixed without a rewrite:
- **End caps**: the old "hemisphere" faded the ring radius to zero ACROSS the
  last in-stroke samples — shortening the form, making cap shape depend on
  sample spacing, and leaving a degenerate final ring. Replaced with true
  protruding ellipsoid domes appended beyond each endpoint.
- **Crossings**: tubes previously hard-interpenetrated. New
  `inflateComputeCrossingBulge` (spatial hash over samples) swells both tubes
  smoothly where another body passes within a merged diameter — peak +22–40%
  radius scaling with Puff. The circle's loop closure now reads as a fused
  knuckle. Still an approximation: surfaces interpenetrate under the swell.

**Recommendation on the field approach:** true merging needs an implicit field
(per-sample anisotropic capsule field, smooth-min union, marching cubes ~96³,
one Laplacian pass). A loft can never re-topologize at crossings. Deliberately
NOT started — unfinishable in one pass.

### Verification

- Geometry net: **Rod and Extrude byte-identical (`=`) on all 8 shapes.**
- Solid: loopyS −82%, openC −87%, closedO −83%, nearTouch −86%, zigzag −64%,
  scribble −82%, twoStrokes −93%, tick −72%. Inflate +1–15%.
- **Correctness confirmed by eye: closedO keeps its through-hole; openC stays
  open; nearTouch keeps its gap. No false holes.**
- Final animated frame still pixel-identical to the static build (sticky-hole
  path intact).
- `verify-gates.mjs` ALL PASS, 0 console errors.

### Still weak

- Heavy-scribble draw-in is ~29fps, not 60. Remaining cost is the per-tick full
  pipeline. Next steps: typed-array masks (blocked by `boolean[]` in
  `MaskSolidStages` consumed by the debug overlay) or Scene-side cadence and
  interpolation.
- Faint residual segment striping on Solid inner rim walls under grazing light.
- Inflate crossings swell but do not truly fuse — see the field recommendation.

### Final locked checkpoint label

`ENGINE_PASS_4_SOLID_PERFORMANCE_AND_INFLATE_FORM`

---

## CHECKPOINT — `SCREEN_LAYER_QUALITY_PASS` (texture / dither / ASCII rails)

Deep-dive quality pass on the screen-space style layers, asking the question the
earlier passes did not: **does it look good**, visually and in the code. Earlier
passes verified these effects *changed pixels* and *did not regress*.

Docs: explainer [15](docs/explainers/15-screen-layer-quality.md), research
[screen-space-layer-quality.md](docs/research/screen-space-layer-quality.md) and
[ascii-glyph-resolution-and-temporal-stability.md](docs/research/ascii-glyph-resolution-and-temporal-stability.md).
Frames: `docs/verification/screen-layers/{before,after,after-inflate,sweep,final}`
and `docs/verification/layer-flicker/`.

### The test bed was the finding

A rail preset writes only its own family's fields, so the **material comes from
the geometry mode** (`rod → ink`, `extrude → glossyPlastic`, `solid → matteClay`,
`inflate → softGel`). Every earlier harness drove the shaders through raw
parameters at one harness-chosen setting, which cannot answer "does this preset
look good". `verify-screen-layers.mjs` shoots real preset × real per-mode default
material × 4 modes, and adds **nearest-sibling distance** — how far a preset is
from the closest *other* preset on its rail. `assert-screen-layers.mjs` turns it
into pass/fail and measures distance **across** both rails of a family.

### Fixed

| | |
| --- | --- |
| Tone window 4.9× too wide | Half-width range `0.62..0.07` → `0.48..0.05`. Measured subject σ is 0.071 (solid) … 0.257 (rod); the default dial sat at 0.345. Halftone dots now vary in size across the form instead of being uniform. |
| 11 of 11 ASCII rail presets below the legibility floor | `asciiCellSize` divides `gl_FragCoord`, so it is **device** pixels; a 5×5 bitfield at 9px is 1.8px per glyph pixel. Raised 8–11 → 16–20. Worst Solid pair `nnDist` 12.1 → 17.9; distinct tone levels up almost everywhere. |
| `completionPulseDither` could never pulse | Set `motionMode` but never `ditherSyncMode`, so it resolved to the same mode as the preset above it — byte-identical to the **static** Dot Matrix on all four engines. Now span 62.8, peak 20.3, **rest 0.0**. |
| `revealDensity` a no-op at rest | `floor(level * reveal + 0.5)` on an integer level is the identity at playhead 1. Moved to the continuous tone before quantisation: span **106.5**, largest of any animated ASCII preset. |
| `characterCycle` flashed the whole form dark | Every cell walked the ramp in lockstep, so all cells hit the blank glyph together. Per-cell hash phase: sd **12.699 → 2.349**, max **43.7 → 15.8**, mean unchanged. |
| `revealDither` was a duplicate at rest | bayer4 @ scale 3 = `bayerClassic` exactly; cross-rail Δ **0.000** on two engines. Now a `diamond` screen: Δ 26.94 / 8.68. |
| Two presets translated an ordered matrix | Impossible to do smoothly — adjacent bayer cells hold maximally different thresholds, so translation re-rolls rather than moves. `ditherCrawl` → `dotScreen`, `diagonalMatrixDrift` → `hatch` (+ speeds). Frozen frames 94.6% → 0%. |
| Every dither rail preset inherited its exposure | All ten now declare `ditherExposure` / `ditherContrast` / `ditherThreshold`. |
| `binarySkin` recommended Rod | ASCII structurally cannot render on Rod: a limb is ~25 device px and a legible cell is mid-teens. |

`verify-gates.mjs` **ALL GATES PASS**, 0 console errors, before and after.
`assert-screen-layers.mjs` **ALL ASSERTIONS PASS** (1 warning). Typecheck clean
in this area. **Not committed.**

### Three harness bugs that produced *passing* evidence

Worth more than some of the fixes, because each one made bad frames look fine.

1. **Ink defined absolutely** ("darker than 232"). Soft Gel renders at ~230
   against ~247 paper, so the detector reported *no ink* on a frame that plainly
   contains a stroke. Now paper-relative, paper measured as the modal stage
   luminance.
2. **Framing once per run.** Later crops drifted off the form; a strip of blank
   paper scored `nnDist 0.00` and `meanDelta 0.02` — indistinguishable from "the
   rail collapsed" and from "this effect broke". I nearly chased the second one.
3. **A flat field satisfies "there is ink here".** A crop that landed on a UI
   panel gave a full run of flat-grey rectangles and 112 assertion failures that
   had nothing to do with the presets. The guard now requires three things: ink
   present, paper actually paper-white, and the crop **not flat**.

Plus one metric that was simply missing: a slow effect and a dead one are
identical in a frame-to-frame delta (Threshold Sweep: mean Δ 1.41, span 32.7).
`spanDelta` now measures total travel alongside it.

### Still weak

- **Texture on a glossy dark material is invisible.** Rod's texture rail measures
  `dOff` **1.0–4.1** across all twelve presets against the repo's own stated
  perceptual floor of 2, with mean `nnDist` 2.7 — thirteen contact-sheet cells,
  one silver tube, thirteen times. This is the *same fault* explainer 01 records
  as fixed; bidirectional albedo plus a roughness swing still loses to a
  near-mirror clearcoat on top. Next lever is the clearcoat layer itself. Left as
  a WARN in the assert rather than silently tolerated.
- **The tone window is a compromise across four materials by construction**,
  because it is positioned in absolute display luminance while the material is
  chosen elsewhere. Proven in both directions: too wide flattens, and an
  overshoot to `0.34..0.02` sent three Extrude presets entirely to paper. The fix
  is auto-exposure against a measured per-material reference; deliberately not
  smuggled in, because it changes what the dial *means* and ten Layer Stack /
  Fusion presets hold hand-tuned absolute values (0.18 on ceramic, 0.9 on ink).
- **Terminal Flicker never travels** (span 7.76, smallest in the family). Its hit
  rate is a fixed 14% of cells and the cell-size fix cut the cell count ~4×.
  Left alone rather than guessed at.
- **A citation I had not verified was written into a code comment during this
  pass** and had to be removed. The research strand had not returned yet and I
  wrote its expected conclusion. Every number in the code comments now traces to
  a frame in `docs/verification/` or to arithmetic shown inline.
- Structure-aware glyph selection (choose among `/ \ | _` by local gradient
  angle, not by tone) is the most promising unexplored direction for ASCII on
  forms too narrow to model tonally. Not built.

---

## CHECKPOINT — `RIM_IN_THE_ROUND_PASS` (Inflate rim / Extrude topology / draft taper)

The three items explainer 16 left measured but not done. Docs: explainer
[17](docs/explainers/17-the-rim-in-the-round.md), research
[extrude-solid-quality.md](docs/research/extrude-solid-quality.md) §8 update + new §9.
Frames: `docs/verification/gloss-rim/{rim_after,rim_after2}` (+ `rim_after/crops/`),
`docs/verification/draft-taper/wired/`, `docs/verification/geometry/rim_final/`.

### The finding: one number, three different causes

`mixed max ~90` meant a missing bevel in Solid, a taper shoulder in Inflate, and
overlapping end caps in Extrude. A fix that transferred would have missed.

| | |
| --- | --- |
| **Inflate's rim** was diagnosed as "marching cubes meeting its dome caps". `fusion` defaults to **`loft`** — there is no marching cubes on that path. The real cause: `inflateInkWidthProfile`'s `sin(πx/2)^0.8` has **unbounded slope at the tip** (exp < 1 is the ported "capsule read" decision), so the first ring step turned the wall 86°, and the hemisphere cap was built at the *tip* radius — a nub welded to a near-right-angle flare. Fixed by making rings the **envelope of the balls** (canal surface: circle at `−r·r′·T`, radius `r√(1−r′²)`), which makes the end cap the terminal ball's own tangent patch. `|r′| < 1` comes from pruning contained balls — a theorem, not a clamp. Measured: crossing `mixed max 89.96 → 17.22` with **0** edges over 30 in any bucket; circle `85.26 → 34.85`; tick `89.31 → 33.78`. |
| **`square/extrude`'s 153 non-manifold edges** were a closed loop built with two round end caps sweeping opposite half-discs about the same point. Closed loops now build as loops (wrap-around, no caps; nothing snapped). **153 → 0**, and the fourth corner now exists as a corner. |
| **8–12 boundary edges on every Extrude mesh** were T-junctions, arithmetically six per cap: the cap's z-face fan used a new vertex that lands exactly on the midpoint of the strip's own chord. Fan from the chord's END instead — a half-disc is convex. **→ 0 on all fixtures**, and now *gated* on Extrude, not just printed. |
| **`applyDraftTaper` is wired** as `ExtrudeParams.sideWall` (`straight` default, dial beside Bevel), about the pool centre threaded from the FULL strokes so it does not drift during draw-in. |

### Instrument corrections (worth more than one of the fixes)

- **`probeDihedral` scored a zero-area triangle as EXACTLY 90°** — the same value a
  die-cut rim scores — because `{x:0,y:0,z:0}` is truthy and the guard never fired.
  Now counted, excluded, and asserted at zero. It happened not to be firing, which
  is how we know Inflate's 90s were real.
- **`cap is flat` had been FAILing on all 4 modes × every fixture since the bevel
  landed.** Its 5° threshold predates the bevel; the `cap` bucket is `|n.z| > 0.9`,
  so the shallowest bevel ring lands in it carrying ~15°/step. Restated at 45.
- **The census is now calibrated before it is believed** — pointed at `bevelEnabled:
  false` (a hard 90° by construction) and refusing to report unless it reads >80.
  Reads **90.00 off / 30.00 on**.
- **Rim assertions are two-sided per shape AND mode**: `square/{extrude,solid,
  inflate}` and `crossing/solid` must KEEP their corners (max > 60); `rod` is
  excluded because a tube carries a corner as a bead, which `assert-joint-beading`
  owns.
- **`probeDihedral` now reports `worst`** (top 6 edges per bucket with midpoint,
  both normals, both faces as indices AND positions). Inflate's rim had to be
  diagnosed by inference before this, and the inference was wrong.
- **`assert-joint-beading --holdsteady`**: `--compare` asserts a fix LANDED, so on
  two already-fixed labels it reports "spurious beads did not fall" three times —
  a clean result that reads like a broken one.
- **`assert-draft-taper.mjs`** exists because the naive and correct taper wirings
  agree on every number the build reports. Proved able to fail: rewired to the
  verbatim `applyDraftTaper`, 3 of 4 assertions fire.

### Verification

- Geometry net vs `bevel_after`: **Rod byte-identical on all 8, Solid byte-identical
  on all 8.** Extrude 0…−4%, Inflate −1…−38% (tick, mostly cap).
- `verify-gates.mjs` **ALL GATES PASS**, 0 console errors.
  `assert-mode-rims.mjs` **ALL PASS** (calibrated). `assert-draft-taper.mjs`
  **ALL PASS**. `assert-joint-beading --holdsteady=predfix,rimfinal` **PASS**.
- Typecheck **51 errors = the 51-error baseline**, all pre-existing.
- The frames are the verdict: `gloss-rim/rim_after/crops/inflate_tip_{BEFORE,AFTER}.png`
  (hard chisel point with a shoulder crease → smooth rolled dome, taper intact) and
  `extrude_seam_{BEFORE,AFTER}.png` (overlapping-cap blob → clean mitre).
- **Not committed.**

### Still weak / not built

- **`square/inflate` still reads `mixed max 89.6` at its four drawn corners.** The
  union of balls IS smooth there, but expressing the elbow needs two tangency
  circles per ball plus a band clipped against the two cylinders on the inside —
  re-topologising, which a loft cannot do. It is what the implicit path is for.
- **A seam fed by a stub was found only by eye.** Closing the square left a small
  inverted flap at the inner corner: `processStroke` pins endpoints, leaving a
  1.87 px remainder, and a 90° mitre offsets ~16 px. Every number was clean
  (manifold, closed, low counts) and a fold reads as a SMALL crease under
  `min(acos d, acos −d)`. Fixed by giving the seam the spacing every other join
  has. **The census cannot see folds** — that gap is still open.
- **Desk Doodles' `detectJointPositions` carries the same inverted predicate,
  verbatim.** Their 63 beads were spurious too. Porting their sparse-anchor
  detection would bead smooth curls. The corrected dense predicate is blind to a
  *gentle* real corner (60° over three steps = 20°/step). The principled
  replacement is curvature radius vs tube radius, which the adaptive sampler
  already computes — a derivation, not a port. **Left for Sebs to decide.**

---

## CHECKPOINT — `HERO_BEAT_THE_TURN_LANDS`

> 🔨 **⚠ SUPERSEDED THE SAME DAY — 2026-07-31 evening. Every item this checkpoint
> lists as OPEN is CLOSED, and one of them was never a defect.** Corrected in
> place below rather than rewritten (§0.7); each correction states what the text
> used to say. The reconciliation, with the commands and their output, is the
> checkpoint at the TOP of this file and `docs/hero-beat-storyboard.md` §11.7–11.8.
> **Do not act on this checkpoint's "OPEN" list.** Also stale here: *"THREE
> INSTRUMENT BUGS"* — the tally is **eight**.

**Status: the beat has a MOMENT where it had none. Two defects open, both named below.**

> 🔨 **The status line above is out of date: ZERO defects open. `max cx step` is
> 1.00 px, the wash row PASSES on the dark core, K4 and K7 are BUILT, and the
> twos exposure is 6/6. The beat's one wrong number is now the DRAW BEAT, which
> is a timing call and not a defect — see the top checkpoint.**

### The gates were fixed first, and they are now one implementation

`scripts/verify/lib/hero-moment.mjs` holds the corrected §8 criteria and is called by
BOTH the shipped gate (`assert-hero-transition.mjs`) and the storyboard tool
(`docs/storyboard/tools/assert-moment.mjs`). That is the point: the tool's four synthetic
negative controls only prove the shipped gate sound if they run the shipped gate's code.
All three §10.4 amendments landed — axis-split registration, sliver-not-blank, net-extent
stillness. `--gates=prior` reproduces the old 7/7 verbatim (0.00px, span 11.0, step 1.2).

### The turn, ported from `compose.ORIGINAL-FLIP.mjs`

`assert-hero-turn.mjs` — 8/8 hold, 8/8 correctly FAIL on the `mode:"prior"` control:
breakdown **87.2%** (original 86.9% solved / 89.7% measured), 2 frozen dwell frames,
14px sliver, depth 1.0 AT the edge so the sliver is real thickness, width law identical
to the original's to 3e-15, max yaw exactly 90° so the mark never shows its mirrored back.

Mesh yaw is `angle <= 90 ? angle : 180 - angle`. The original scales two front-facing
images and swaps at the midpoint, so its "180°" is a figure of speech; a real mesh yawed
through 180° reads right-to-left for the whole second half.

### Measured on the real capture (`docs/verification/hero-transition/turn3/`)

- **MOMENT — PASS.** extent falls to 24px = 3.7% of settled 648, held 6 capture frames
  (= the authored 2/30s), centre drift 0.00px inside the moment.
- **SLIVER not blank — PASS.** floor 24px / 3928 ink px, recovers to >= 90%.
- **spacing 87.6% — WIND-UP.** The current beat measured 42%, the crossfade dead band.
- **stillness — PASS**, net 0.00 on centre/w/h/ink. `cameraPark:"parked"` folds az 30->38
  into the rise; the drift had no basis in 114s of reference film.
- rise rebalanced ease-out dominant (`assert-hero-rise.mjs` 6/6, 3/3 spacing claims fail
  on the symmetric control): velocity peak 50% -> **16.7%**, decay 5.0x, gather -10.0%
  and overshoot +10.0% both preserved, so B4's "do not touch it" holds.

### THREE INSTRUMENT BUGS FOUND BY RUNNING, not reading

> 🔨 **⚠ THE TALLY IS NOW EIGHT (2026-07-31 evening).** This heading used to be
> the complete count. The five since: the vacuous yaw claim, the overshoot window
> reading a flat 10.0° on both arms, `hold.png` landing on the flat return, the
> blind area-symmetric reversal control, and gate 2 sampling a phase that is flat
> by design. All eight are recorded together in `docs/hero-beat-storyboard.md`
> §11.8 — the pattern only reads at eight. The three below are §11.8's items 1–3.

1. The capture's emerge window was derived by NAME (`anticipation` follows `emerge`).
   The phase reorder inverted that, so the window ran BACKWARDS — `4.04s..3.76s`, 72
   frames over a negative span, all written with correct-looking filenames. Now derived
   by POSITION, and it throws rather than capture a backwards window.
2. A "blank frame" at the moment was CLIPPING, not the beat: an expanded timeline dock
   squeezed the stage 1120x702 -> 1120x350. Capture viewport is now 1440x1440.
3. The gate's parked window was a fixed `+0.55s` sized for the old 0.54s emerge. Against
   the 0.92s turn it cut mid-recovery, so `settled` (median of the last 5 widths) came
   from the DWELL — 24px. Every threshold was measured against the frames being judged;
   it reported "no moment" on a beat whose moment is in the frames.

### OPEN — do not report this beat as done

> 🔨 **⚠ ALL THREE BULLETS BELOW ARE CLOSED (2026-07-31 evening). Left standing,
> unedited, per §0.7.** In order:
>
> 1. **Registration — CLOSED at `max cx step 1.00 px`** (`assert-hero-transition.mjs
>    --label=reg-affine`, **9/9**). It was the PERSPECTIVE PROJECTION, proven two
>    ways: intervention (perspective **46.50 px** vs affine **1.00 px**, and the
>    perspective arm still passes 8 of 9 — the one failure is registration alone),
>    and a prediction `Δcx = (W/2)·k·sinθ` fitted to **WIDTHS ONLY**, **rms
>    3.31 px against a 30.10 px null**. Fixed with an **orthographic hero stage**
>    (`Viewport3DProps.projection: "affine"`, defaulted for any viewport driven by
>    `flatten`).
>    ⚠ **And the bullet below carries a claim that was already falsified**: *"the
>    word's ink centre at rest is 502"* is wrong. At rest the mark's bbox centre
>    is **559.5** — the optical axis, to the digit — with its ink centroid 4.3 px
>    off. **502 is not a rest quantity at all**; it is where the bbox centre swings
>    to mid-turn, twice, once on each face. `hero-beat-storyboard.md` §11.4.1
>    measured that in the morning and this checkpoint was never corrected.
> 2. **The wash — NOT A DEFECT. It is a RAKE.** The mean cannot tell a wash from a
>    rake; on the dark core the peak reads **12.6 against a settled 12.6, to the
>    digit**, and only the lit end rises (87.0 vs 35.0) — which a cross-dissolve
>    cannot do, because fading toward paper lifts the darkest pixel first. Two
>    measurement faults fixed: the statistic (mean → dark core, §3 K3's own
>    method) and the reference (one endpoint → the brighter endpoint). Falsifiable
>    both ways: `--gates=prior` still reproduces this bullet's `37.2 vs 23.4`
>    verbatim, and `--mutate=wash` drives the new row red. **It was NOT the window
>    artifact this bullet guesses at.**
> 3. **K7, K4's hold and the twos quantisation are all BUILT.**
>    `assert-hero-return.mjs` **13/13** (`prior` kills 12 of 13, `identical` kills
>    exactly the one row it should), `assert-hero-hold.mjs` **8/8**,
>    `assert-hero-twos.mjs` **6/6**. The beat is twelve phases and closes its round
>    trip; §7's four turns are four and its two moments are two.

- **REGISTRATION FAILS: max cx step 24.50px (needs < 2).** The mark slides right as it
  turns. The sliver lands at cx 559.5 = 1120/2, the optical axis, while the word's ink
  centre at rest is 502 — so the rotation axis is right and the word's ink is not on it.
  A measured-pivot fix produced BYTE-IDENTICAL numbers, which falsifies the
  wrong-pivot hypothesis rather than confirming it. The original never had this problem
  because it was a 2D compositor scaling two images about one point — "registration was
  solved by construction". Under a perspective camera a real yaw of an off-axis object
  moves its projected centre. Not yet fixed, not yet fully diagnosed.
- **`ink never washes past the settled value` FAILS** (peak mean 37.2 vs settled 23.4).
  May be the same window artifact as (3) — the emerge window's last frame sits on the
  tilt boundary. Unverified either way.
- K7 (the changed-flat return), K4's hold and the twos quantisation are NOT built.

tsc = 51, the exact pre-existing baseline. No commits.

### Controller note — `jointBreak` wired, 2026-08-01
`app/desk-doodles/page.tsx`'s flatten memo now passes `sample.jointBreak` (+ dep).
The break table and its render consumer had both landed in other lanes' files;
this one line was the connection, and without it the live beat rendered K7
identical to K1 and the round trip said nothing. `assert-hero-k7-news` 8/8,
`assert-hero-flatstate` 13/13, `assert-hero-dials` and `assert-hero-windup`
green, tsc 51.

**OPEN, and NOT caused by the lane that reported it:** a fresh capture reads
`max cy step 2.00 px` (needs < 2). A control capture with the K7 rendering
DISABLED reads the identical 2.00 on 72/72 byte-identical emerge frames, so it
is not the break. It arrived with the beat's retiming (9.83 -> 12.37 s) moving
the 72 sample positions. `cx` is 1.00 and fine.

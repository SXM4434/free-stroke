# Explainer 40 — Refuse the frame, not the window

Prior: [27 §5](27-the-gates-that-measured-the-wrong-tree.md) (the incident),
[35](35-the-capture-that-grabbed-the-wrong-canvas.md) (the subject),
[37 §6](37-the-defect-that-was-a-path.md) (the measurement that came back clean).
New file: `scripts/verify/lib/frame-guard.mjs` — **20 rows, 20 PASS, exit 0**, seven of
them on frames the repo already had on disk.

This one is not a fix for a live fire, and saying so is the point of it.

Explainer 27 §5 found a capture that recorded nothing and produced a number that looked
like a signal: a rest-Δ of **5.931** which was `65.241 / 11` — one frame — and that frame
was blank paper at mean luminance **252.171**, after which it *"never moves again."* The
cause was read as a headed Chrome throttled by macOS until it stopped compositing.

Explainer 37 §6 then went to measure whether that reproduces, and **it did not**. Three
8-second arms and two 180-second arms, real GPU, never brought to front:

```
headless-A vs headless-B   mean|Δ| median 0.065   <- the noise floor
headless-A vs headed       mean|Δ| median 0.050
```

The headed-vs-headless difference is *smaller than the headless-vs-headless noise floor*,
and 0 of 56 frames in either arm sat at paper luminance. So the honest position is: the
blank in 27 §5 is real and is in the frames, and the trigger is not "headed + unattended"
on its own. Two variables could not be held — machine state, and genuine window occlusion,
which cannot be produced without taking over the machine's screen.

Which leaves exactly one recommendation, and it is 37 §6's own:

> *"flip nothing wholesale; **refuse the frame rather than the window** — a blank/frozen
> guard on the capture path fails whether or not the throttle reproduces, restages no
> stored evidence, and would have caught the original defect at the time."*

**So this is the instrument that would have caught the one that already happened.** Not a
repair. The distinction matters because it sets the bar: a guard justified by a defect
nobody can currently reproduce has to be judged almost entirely on its false-positive
behaviour, and that is where the whole design lives.

---

## 1. The design problem is the false positive, and getting it wrong kills the guard in a week

A guard that reddens on a legitimately blank or legitimately still frame is **worse than no
guard**, because it gets switched off and then the real one goes through. This product ships
three legitimate cases today, and they are not edge cases:

- **`Vanish` and `Shrink` end on a deliberately blank frame**, and the PRD ships
  final-frame matching. That frame *is* the product.
- **A draw-in at playhead 0 is legitimately empty.**
- **A held final frame in an export is legitimately identical** to the one before it.

The base rates were measured on the shipped healthy `dit_pulse` capture rather than
guessed, and they come out opposite:

| | in a capture with nothing wrong with it |
|---|---|
| **BLANK** | 2 of 56 frames — and both are frames 0–1 of the reveal, which the caller already knows about |
| **FROZEN** | **19 of 55 pairs are Δ EXACTLY 0 — 34.5 %** |

Opposite base rates, opposite defaults:

> **BLANK is checked on every frame; exceptions are declared.
> FROZEN is checked only where the caller has DECLARED motion.**

A default-on frozen arm would be red on a third of a good run on day one. That is not a
tuning problem — it is a category error about what stillness means in this app, and no
threshold fixes it.

### The guard is TOLD, and that is the interface

```js
const guard = createFrameGuard({
  label, subject,
  mayBeBlank: { first|last|frames|from|when|all: …, why: "…" },   // default: never
  mustMove:   { first|last|frames|from|when|all: …, why: "…" },   // default: never
  maxStillRun: 2,
  maxDeltaShare: null,
})
await guard.frame(buf, { index, grabInfo })   // throws FrameRefused
const report = guard.finish()
```

Four properties, each of which is a defect this repo has already paid for:

**Declared at construction, never per call.** A per-call flag lives inside the write loop,
so a flag added for the Vanish tail silently covers every frame that loop writes. A
construction-time policy sits in one place, is printed in the report, and can be audited by
reading one expression.

**A bare boolean is refused, and so is a missing `why`.** `createFrameGuard({ mayBeBlank: true })`
throws. This is `assert-one-knob`'s channel E applied one level down: that channel requires
every ALLOW entry to carry a written reason *and to still violate something*, and on
2026-08-07 three of its four such entries expired on schedule and were caught by exactly
that rule (37 §5). **An allowance nobody had to justify is an allowance nobody can retire.**
`finish()` therefore also names any allowance that never matched a frame — not as a failure,
but as a thing to delete.

**`{ last: n }` is necessarily deferred.** A streaming capture does not know which frame is
last until it stops, so those frames are held and resolved in `finish()`. Named as a
property of the policy rather than discovered later as a surprise.

**Every frame is re-judged at `finish()`.** A frame cleared at write time was judged against
a baseline built from three frames — a guess. The run's own evidence is better and by then
it exists.

The caller already knows all of this and had it written down. `verify-screen-layers.mjs`'s
motion table declares `reveal: true` per cell and the loop computes `completionIndex`; the
wiring declares from those two facts and nothing else.

---

## 2. BLANK is a collapse relative to the run, because no constant could work

The first version of the blank test was an absolute coverage floor. **Two real files that
must land on opposite sides of any such floor land 4 % apart, with the blank one HIGHER:**

```
verify-stack's 22 stored frames   markedFrac 0.016773   a real mark
qualitypass g0001 (blank paper)   markedFrac 0.017509   no mark at all
```

The reason is in `verify-screen-layers.mjs`'s own comment, arrived at from the other side:
*"the stage grid lines are 1-2px wide and a paper-relative ink test now sees them."* The
stage carries a faint grid, so a blank stage is not empty — it is covered in grid.

So 27 §5's blank is not "low coverage" in the abstract. It is a **collapse**: the frame lost
the mark that every other frame in the same run has. The test is therefore relative to the
run's own established coverage, and the absolute floor survives only for the degenerate case
where nothing establishes a baseline — a fully transparent grab, or an all-paper run.

### And the estimator was contaminated by exactly the frames it exists to judge

A plain median over the first three frames of the real `qualitypass` capture latched at
**0.017509** — the coverage of the two blank reveal-at-0 frames — so nothing could ever read
as a collapse, and an incident planted at frame 30 went straight through.

The estimate is now the median of frames within 4× of the best frame seen, which a blank
cannot enter. Re-measured baseline **0.474139**; the planted incident is caught at **27.1×**
against a 10× bar.

**The boundary, stated rather than papered over:** this catches a frame that LOST the mark.
It cannot catch a run that NEVER HAD one — there the blanks are the baseline and there is
nothing to collapse from. That case belongs to `reframe()`, and to the FLAT-RUN row below.

### Alpha-aware, because a WebGL grab has no paper behind it

`toDataURL` on a WebGL canvas returns the drawing buffer, not the page. **`verify-stack`'s
22 stored frames are 98.3 % transparent and every one of them carries a mark.** A
luminance-only test reads transparent as black — as heavy ink — and is exactly backwards.

This is also how 37 §6's first probe fooled itself: Δ came back exactly 0.000 in all three
arms *including the headless control*, because there was no mark on the page for the texture
to animate. **A control that comes back clean means the instrument is blind.** That failure
is now a row: a run in which every frame is a flat field (σ < 1.5) is refused outright, on
`verify-screen-layers.mjs`'s own already-calibrated constant for "the crop is a flat field".

---

## 3. One repeated frame is not a stall, and the real tool proved it

The first frozen predicate refused any byte-identical pair inside a declared-motion region.
It went red on `dit_sweep` frame 30 — **a frame carrying 45.4 % ink at σ 113.5**, a perfectly
good picture — because Threshold Sweep moves a tone bias on a 4.8 s period through a
**quantised** threshold map, so two consecutive frames land in the same bucket.

That is this repo's own finding one level up, in
`research/ascii-glyph-resolution-and-temporal-stability.md`: *"animating a quantised index
instead of the value that gets quantised."*

And 27 §5's signature was never one repeat. It was *"ten consecutive frames of exactly
0.00"* that *"never moves again"* — a compositor that stopped, not a quantiser that
repeated. So the predicate is the **run**, with `maxStillRun: 2`.

Worth keeping beside it: **an mp4 is the wrong place to ask whether two frames are
identical.** The same clip re-encoded reads **1** byte-identical pair of 55 against its own
report's **19** — H.264 moves the LSBs. A lane "verifying" frozen-ness off a video would be
reading the codec.

---

## 4. Calibrated on the incident itself, not on a reconstruction of it

Seven of the twenty rows run on frames the repo supplies. Two of them are the known-bad, and
the second is the one worth having:

```
MUST FIRE · [known-bad/incident] frame 6 carries NO MARK — 182x150 1389B ground=paper
            paper=252 meanLum=252.171 sd=0.376 marked=0.000%
            ⚠ AT THE 2026-08-04 BLANK SIGNATURE (252.171, sd<1)

MUST FIRE · [known-bad/incident-in-the-real-run] frame 30 LOST ITS MARK —
            coverage 1.751% against this run's own 47.414% (a 27.1x collapse, bar is 10x)
```

The second is the shipped `qualitypass` capture with **one mid-run frame replaced by that
same run's own blank frame** — a frame the real tool really wrote, standing in for a frame
the real tool really wrote. That is what the compositor stall did. Not a synthetic PNG
approximating it.

The first *is* synthetic, and how it is built matters. 27 §5's 252.171 is a **mean over a
frame**, not a pixel value; an 8-bit channel cannot hold it. Building it as `round(252.171)`
would produce a frame at 252 — a different and easier input than the one that happened. So
two adjacent integer levels are dithered in the exact proportion that lands the mean on the
explainer's number, giving σ 0.376.

### The clean side, which is the half that decides whether this survives

| case | result |
|---|---|
| `Vanish`/`Shrink`'s deliberate final blank, declared `{ last: 1, why }` | **0 refusals**, allowance matched 1 |
| a draw-in at playhead 0, declared `{ first: 1, why }` | **0 refusals** |
| a held final frame identical to its predecessor, no motion declared | **0 refusals**, 2 frozen pairs seen and ignored |
| ONE isolated repeat under DECLARED motion | **0 refusals**, longestStillRun 1 |
| the REAL shipped `qualitypass` capture, **56 frames** | **0 refusals**, baseline 0.474139, maxDeltaShare 0.1068 |
| `verify-stack`'s **22 REAL 98.3 %-transparent** frames | **0 refusals**, min markedFrac 0.016773 vs floor 0.002, **8.4× headroom** |

Lane F's control — *"a clean gate is NOT flagged"* — is the bar those six rows exist to
meet. And each allowance is proved **load-bearing** by removing it: the same 56-frame
capture without the reveal-at-0 declaration is refused `BLANK@0, BLANK@1`; the same
playhead-0 frame undeclared is refused `BLANK@0`. An allowance that changes nothing when you
delete it was never doing anything.

### The row count does not depend on which tree you run it in

```
a stripped lane tree (no docs/verification/)   15 PASS · 5 FAIL   exit 1
FS_EVIDENCE_ROOT=<a checkout that has it>      20 PASS · 0 FAIL   exit 0
```

**Twenty rows either way.** Each missing input is a named red row that says which directory
it could not find. A row that vanishes with its input is a row that cannot fail — which is
the finding this whole family of gates came out of (explainer 27 §3's `assert-moment`, *"in
no sweep because both runners scanned one directory"*).

The evidence root is derived from the file's own location and overridable by
`FS_EVIDENCE_ROOT`, never written down: a spelled path would be `assert-one-knob`'s channel
F, the defect 37 §1 opened and closed, and the name deliberately avoids
`*URL|PORT|HOST|ORIGIN` so it cannot trip channel C either.

---

## 5. `--only=motion`: the verdict is INSTRUMENT, and the file already said so

`verify-screen-layers.mjs:371` throws `reframe: no usable ink box after 6 attempts`, and it
had been hit by two lanes who could not chase it. 37 §6 measured it failing identically
headed and headless, so it is not the rAF trap.

The question was whether the motion cell genuinely renders no ink (the subject) or the ink
detection cannot see ink that is present (the instrument). **It is neither, exactly — and
the file's own comments settle it without a browser:**

- `:330` — *"4% of the span, not 1.2%: the stage grid lines are 1-2px wide and a
  paper-relative ink test now sees them, so a 1.2% floor would return the whole stage as
  'ink'."* The floor had to be **raised** because the grid was over-triggering.
- `:429` — *"the stage grid is enough 'not paper' to satisfy a bounding-box search on its
  own."*

`locate()` measures `PAPER` as the modal luminance, counts any pixel `|L − PAPER| > 5` as
ink per column and per row, and takes the **span** between the first and last qualifying
column. A grid line runs the full scanned height, clears the 4 % bar outright, and the span
is wide. **So "this cell renders no ink" cannot reach the throw.** Measured over 28 real app
states, at reveal progress 0 with no mark anywhere: `colsOver 10 · rowsOver 10 · box
0.715 × 0.623` — **14.3× and 31.2× over the bar.**

The throw is reachable only from a frame with essentially nothing in it, which makes this
line, indirectly and by accident, the tool's existing blank-frame detector. **It was refusing
correctly.** What it could not do is say so: `catch { /* no ink yet */ }` threw away every
reason, so the operator got "6 attempts" and no measurement. *The instrument deleted its own
evidence.* It now reports all six reasons, the crop in use, the live canvas census, harness
liveness, console errors, and writes the refused frame to disk.

**The bar is not relaxed.** `0.05 × 0.02` and the six attempts are byte-unchanged. A reframe
that proceeds without a usable box is how a capture measures the wrong region.

### And the mechanism underneath is explainer 35's sentence in a third file

`box` was measured **once**, before the first capture, and every crop for the rest of the run
came from it. The viewport is a flex child whose size follows the current mode's config strip
— `viewport-3d.tsx`'s own `stillSize` comment — which explainer 35 §2.2 measured at exactly
**40 px**, on a different tool. Caught in the act:

```
the crop this run had been using since startup   x 750.5  y  92  w 749.5  h 858
the canvas on the page at that moment            x 751    y 132  w 750    h 818
```

The tool was photographing a rectangle whose top 40 px is page chrome and which stops 40 px
short of the form. That is enough to put the macro crop on blank paper — and the frames that
came back were **422 bytes, pure white, σ 0**: 27 §5's signature arriving through a completely
different door, on a headless run, with no throttle anywhere near it. The guard caught that
one live.

---

## 6. 🔴 The fix is diagnosed and deliberately NOT applied, and the reason is the bed

Re-cropping to the live rectangle is the correct repair and it is one word away. It is
withheld because of what it would cost.

`assert-screen-layers` grades `crops/<mode>_<rail>_<preset>_macro.png` and `report.json`, and
**both come out of `rectOf()`**. A label re-shot with the fix in place is cropped up to 40 px
differently from one shot before it. Stored labels stay untouched and internally consistent,
but a new label would no longer be comparable to `final/` — which is exactly the reason 37 §6
gave for not flipping the headless default, and it is a call above a lane.

So the measurement runs and the crop does not move:

```js
await measureBox({ apply: true })            // once, at startup — the old behaviour exactly
const drift = await measureBox({ apply: false })   // every reframe — measures, prints, does not move
```

`apply` is the whole switch. This is not a compromise: **it is what makes the defect
falsifiable without restaging anything.** Before it, no run could say whether its crop had
drifted. Now every run says so, in the log and in the throw, and the decision about the bed
can be made with the drift in front of it rather than as an argument.

The guard itself is unconditionally additive. It reads the buffer the file was already going
to write, changes no timing, wait, crop, camera or preset order, and publishes to a
**sibling** `frame-guard.json` — never into `motion-report.json`, which `assert-screen-layers`
parses. Adding a field to a file the judge reads would have been the same class of mistake
one level up.

---

## 7. Three of the guard's own arms failed first, and each was a real defect

Recorded because the pattern is the point: every one was caught by a **real** input, and none
would have been caught by a synthetic one.

1. **The baseline was contaminated by the frames it judges** — §2. The estimator latched on
   the blanks, and the planted incident went straight through.
2. **An absolute coverage floor was impossible, and the real files said so** — §2. Two frames
   4 % apart with the blank one higher.
3. **One repeated frame is not a stall** — §3. Two clean runs measuring 0 of 55 identical
   pairs were a *sample*, not a proof, and the real tool produced the counter-example.

Which is DISPATCH §2.6 from the inside: *"calibrate the instrument against a known-bad input
and require it to fail."* Three times here the known-bad was not a mutant anybody wrote — it
was a file already on disk, and it disagreed with the design.

---

## 8. The shape of it

| what was checked | what it would have measured instead |
|---|---|
| a mean over a rest window | one step, divided by the window length |
| a luminance-only blank test | a transparent WebGL grab, as heavy ink |
| an absolute coverage floor | the stage grid |
| a median over the first frames | the blanks it exists to catch |
| any byte-identical pair | a quantiser doing its job |
| frozen-ness off an mp4 | H.264 |
| a capture's crop | a rectangle the viewport has since left |

Explainer 27 asked whether a gate is pointed at the thing whose name is on it. Explainer 35
asked the same of the **subject**. This one asks it of the **moment**: not which tree, not
which element, but *whether anything was on the screen when the shutter opened.*

The defence is the same one both of those arrive at, applied to time instead of place:
**deny the instrument the ability to decide what counts as nothing.** A blank it cannot wave
through, a stillness it has to be told about in writing, and a baseline it cannot build out
of the frames it is judging.

---

## 9. What is NOT done

- **A full clean twelve-cell motion run with the guard wired.** Lane R's was stopped by a
  browser stop-order after 2 of 12 cells, both clean. The self-test is browser-free and
  green, and the wiring is proved on real frames as far as `dit_sweep` — **but the wiring is
  not end-to-end verified and must not be reported as such.** The command:
  `FS_PORT=<port> SL_HEADLESS=1 node scripts/verify/verify-screen-layers.mjs --label=<x> --only=motion`
- **Whether to apply the crop fix** — §6. Reported, not taken.
- **Whether to flip this file's headless default** — still Sebs's call, untouched, and the
  structural answer is a shared launch module rather than 49 hand edits.

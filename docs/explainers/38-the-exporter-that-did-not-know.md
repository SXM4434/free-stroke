# 38 — The exporter that did not know the draw-in had changed

Map: [`docs/animation-toolset-map.md`](../animation-toolset-map.md) §6.5.
Prior: [26 — the draw-in became a decision](26-the-draw-in-became-a-decision.md).
New gate: `scripts/verify/assert-export-window.mjs` — **29 rows, ALL PASS.**
Files: `lib/export/frame-plan.ts`, `recorder.ts`, `index.ts`.

> **§9 (Part 2) LANDED THE ONE LINE §8 SAYS IS MISSING**, in
> `components/viewport-3d.tsx`. The row count above is deliberately left at 29:
> the seven `§D` rows that film the real Video button live in a version of
> `assert-export-window.mjs` that is **parked and not landed in this tree** —
> see the banner at §10. A header that counted rows this repo does not have
> would be the exact defect this file is about.

Two lanes made the draw-in authorable in one night — a per-stroke **schedule**
(`order` · `overlap` · `align` · `reverse`) and a reveal **window** (`Grow` ·
`Travel` · `Vanish` · `Shrink`). Nobody asked what the thing that *exports* it
made of that. One grep:

```
grep -c "stroke-schedule\|scheduleArc\|revealWindow" lib/export/*.ts
apng.ts:0  encoders.ts:0  frame-plan.ts:0  index.ts:0  recorder.ts:0  webm.ts:0
```

Six files, zero hits. GLB/video export is in the locked MVP and the PRD's north
star ends *"…and export a result that feels like a designed artifact"* (line 55),
so this is a product question, not a tidiness one.

---

## 1. The answer to the obvious question is yes, and that is the trap

**Does an export of a non-identity schedule contain the motion the viewport
shows? Yes — 0 of 51 frames differ, 0 pixels of 1 123 584.**

It could hardly not. `playheadRef` is the single scalar every render path reads,
the export's host writes exactly the three values `__revealHarness.setProgress`
writes (`viewport-3d.tsx:11487-11497`), and explainer 26 §7 records that the
window was *designed* against this file's constraint — Cavalry's two animatable
edges were deliberately not copied *"because `lib/export/frame-plan.ts` requires
the whole animation to be a pure function of one clock."*

**Which is exactly why it had to be measured rather than reasoned.** An
architecture where everything rides one scalar makes every export look correct
from the outside; that is its virtue and it is also what would hide a defect.
So the claim was decomposed into two that can each fail on their own:

| | what it isolates | measured |
|---|---|---|
| **(a)** one film rendered by `exportAnimation` walking its own plan, one rendered by the gate calling `setProgress` at that plan's own playheads — same host, same grab, same encoder | the export's **seek** | **0 / 51 frames differ, 0 px** |
| **(b)** the scheduled film against the **identity** film | whether the schedule **reaches** the export at all | **36 / 51 frames differ, worst 31 220 px = 2.8 %** |

(b) is (a)'s known-bad. A row that cannot tell a reordered word from an as-drawn
one is measuring the encoder. And the reorder is legible rather than merely
present: at frame 14 the ink's centroid sits at **x 0.325** scheduled against
**0.575** identity, IoU **0.3052** — the early ink is at the other end of the
page, which is what `order: reversed` means.

**The first version of (a) read 35 of 49 frames differing** and it was the
instrument. `exportAnimation` takes one probe grab before the loop to size the
encoder (`index.ts:118`, *"thrown away"*), and a seek counter riding `grabFrame`
was therefore one frame ahead from the first frame onwards. 49 − 14 identical
hold frames = 35: every frame where the picture was moving. A one-frame shift is
the most plausible way for this comparison to be wrong while looking like a
finding, so the counter is now its own.

---

## 2. The defect is one assumption, and it is false four ways

`planFrames` has three phases. `lead` sits at clock 0, `hold` at clock 1, and
both exist to hold **stillness** either side of the motion. That is only
meaningful while clock 0 is an empty page and clock 1 is the finished mark.

```
mode      d = 0                      d = 1
grow      lo 0.000 hi 0.000 EMPTY     lo 0.000 hi 1.000 WHOLE
travel    lo 0.000 hi 0.000 EMPTY     lo 1.000 hi 1.000 EMPTY
vanish    lo 0.000 hi 1.000 WHOLE     lo 1.000 hi 1.000 EMPTY
shrink    lo 0.000 hi 1.000 WHOLE     lo 0.000 hi 0.000 EMPTY
```

Three of the four window modes end empty; two start full. And there is a fourth
way in, which is the one that matters most:

> **`frame-plan.ts:193` flips the CLOCK and not the PHASE.**
> `clock: reverse ? 1 - clock : clock`. So the transport's **Reverse** toggle —
> shipped long before any of this, passed straight through at
> `viewport-3d.tsx:11472` — already put clock 1 on the `lead` frames and clock 0
> on the `hold` frames.

Counted over the eight (mode × reverse) states the app can reach, **five put
every hold frame on blank paper**: `travel`, `vanish`, `shrink`, `grow+reverse`,
`travel+reverse`. At the app's hard-coded `holdMs: 600` (`:11479`) that is 18
frames at 30 fps.

The sharp part is not the count, it is that the module contradicts its own
stated reason. The field's doc says:

> *"This is not padding: every completion-keyed style behaviour in the app
> (`completionPulse`, `delayedAfterReveal`, the stack's freeze-on-complete) only
> has anything to show AFTER the reveal reaches 1."*

On a reveal that ends empty there is nothing for those layers to show **on**. The
hold is exactly the padding the sentence disclaims. Filmed on the real app, the
unwired Vanish export is 50 frames of which **the final 31 are one still image of
bare paper**.

### And `PlannedFrame.clock`'s own doc was wrong

It said *"`lead` frames are 0 and `hold` frames are 1."* Under `reverse` they are
1 and 0. Corrected in place with the reason, because that sentence is what a
future caller would have inferred the phase from.

---

## 3. The fix: tell the plan, then let it decide one thing

`revealEnds` is a **fact** about the reveal — what it shows at clock 0 and clock
1, before `reverse`. It defaults to `grow`'s, which is what shipped, so an
unwired caller gets the previous behaviour exactly.

`reverse` is applied to the ends **inside** `planFrames`, not by the caller, and
that is load-bearing: the caller does not know this file flips the clock rather
than the phase. It is also what makes the transport's Reverse toggle correct with
**no change at any call site at all**.

What the plan does with the fact is the one product call, and it is a default
rather than a decision taken away:

- a hold that would be blank paper is **dropped** — `holdSuppressed: true`,
  `holdMsRequested` kept;
- `recordAnimation` raises a warning naming the reason and the override;
- `describePlan` says it in the panel: *"…128 frames · ends on empty paper, so
  there is no hold · opens on the finished mark"*;
- **`holdOnEmpty: true` puts it back**, because a blank beat at the end of a loop
  is a legitimate thing to want.

Measured: a Vanish film goes from 50 frames to 36 — **shorter by exactly its own
14-frame hold** — and its last frame carries 0.4 % of the mark's peak ink. A
forward `grow` film keeps all 14 and ends on **100 %** of its peak.

### `REVEAL_WINDOW_ENDS` is a copied fact, and it is gated

`lib/export/` imports no app module — `assert-export-live.mjs` serves these six
files to a page as standalone ES modules with only relative specifiers rewritten,
so an `@/lib/…` import breaks that gate outright. The four rows are therefore a
hand copy of what `windowAt` does at its endpoints, and a pasted constant that
goes stale while the file still looks current is a failure this repo has caught
twice. So every cell is recomputed from the real `windowAt` on every run, exactly
as `EXPORT_PAPER` is checked against `STILL_PAPER`.

---

## 4. 🔴 The defect underneath, which the hold had been covering

The row that found it was **wrong on its first draft, and said so.** It asserted
that the sliver of ink at a reversed film's final frame was the pen tip's nose
carried ahead of the playhead (explainer 26 §2.2), reasoning that a forward
film's first frame and a reversed film's last frame are the same instant. They
are not:

```
forward film frame 0:  0 px        reversed film FINAL frame: 1 577 px
```

`requestedFrames = floor(total/interval + eps) + 1` puts a frame at the last
**whole** interval. Unless the duration is an exact multiple of the frame
interval, **no frame lands on the end instant**:

```
1436 ms at 24 fps, holdMs 600 → 49 frames, last 3:
   [46] t=1916.7 hold clock=1.000000   [47] hold 1.000000   [48] hold 1.000000
1436 ms at 24 fps, holdMs 0   → 35 frames, last 3:
   [32] t=1333.3 draw clock=0.928505   [33] draw 0.957521   [34] draw 0.986537
```

**With no hold the reveal is never rendered at clock 1 at all** — the mark ends
1.35 % unfinished. Every export this module has produced has had a hold, and the
hold was supplying the closing frame; suppressing it on a reversed film put the
residue at the *empty* end, where it is obvious.

This is the exact bug class this file already carries a paragraph about, one
level up — *"the last frame never lands, which is the single most-reported bug
class in exported loops"* — sitting behind the hold the whole time.

The fix moves the last frame's **instant** to the end; its presentation time,
the frame count and `durationMs` are untouched. It cannot reach the shipped
default (which has a 600 ms hold), and on an exact multiple the final frame is
already `hold`/clock 1, so it is a no-op there too — which is why
`assert-export-plan.mjs`'s round-number rows do not move (**11 PASS, 0 FAIL**,
re-run after).

```
1436ms@24fps holdMs 0 : last clock 1 (was 0.986537) · reversed last clock 0
1000ms@30fps holdMs 0 : clamped = false, last clock 1     <- the no-op control
```

---

## 5. Two questions whose honest answer is "nothing is wrong"

### The frame plan's duration still matches the beat — and the premise that it might not is false

The dispatch's hypothesis was that `T = max(u_i + L_i)` moving under `overlap`
or a reorder would leave the plan truncated or padded. It does not, and the
reason is one line of the model: `S(a) = (u_i + (a − a_i)) / T` — **the division
by `T` IS the normalisation**, so `S` ranges over [0,1] whatever `T` is.

Swept rather than argued, over every combination of order × overlap × align ×
unit × reverse:

```
300 schedules · 20 distinct T in [0.4000 … 1.0000]
worst |max(track.end) − 1| = 2.220e-16      worst |min(track.start) − 0| = 0
```

The control on that row is that `T` really did move — 20 distinct values — or it
would be measuring one schedule three hundred times. **So `penDurationMs` is not
stale and the export is neither truncated nor padded.**

### GLB carries none of it, and that is correct

`buildGLBBuffer` (`viewport-3d.tsx:10503`) builds a fresh scene from
`processedStrokes` through `engine.buildExport` and reads no playhead, no
schedule and no window. PRD §12: v1 is *"static GLB geometry per mode"*; a true
animated GLB is **v5**, *"later/harder"*. So the right answer is "the schedule
cannot move it", and a GLB that *changed* would mean the static export had
started depending on where the scrubber happened to be.

**And that row needed its own zero first.** Its first draft compared one GLB at
the identity against one under a schedule, read two different hashes, and would
have been reported as a leak. It is not one — **a GLB exported twice from the
same state also differs**, so `GLTFExporter`'s byte stream is not reproducible
run to run and a hash was never able to answer this question. The row is rebuilt
on the mesh census, which is stable, with the hash's instability printed rather
than hidden:

```
GLB self-consistency at ONE state: bd41f9fd… vs 683fbe1f… → NOT reproducible
mesh census identity@1.0 vs reversed+overlap1+reverse-all+vanish@0.5: IDENTICAL · 6 meshes
```

*(That GLB non-determinism is a finding this lane did not chase. It is reported,
not fixed — `handleExportGLB` is not this lane's file.)*

---

## 6. The negative control, with the instrument calibrated first

The bar explainer 26 set: the default must be **byte-identical**, and the
comparison must be shown able to fail before it is trusted.

Four films, **one page session**, one real stroke — the module as it ships served
at one mount and this lane's snapshot of it *before* any edit served at another,
so before-vs-after is a comparison and not two sessions:

```
CALIBRATION   after/after identical · before/before identical · 224 716 800 decoded bytes
CLAIM         before 78af779cc4a7d8e7 (50f)  ·  after 78af779cc4a7d8e7 (50f)
```

The control on the claim is that the films are not all identical for a trivial
reason — a Vanish film must differ from the default, and it does.

---

## 7. The gate, and the four known-bads it carries

`scripts/verify/assert-export-window.mjs` — **29 rows, ALL PASS**, ten in plain
node and the rest on the real app with a real stroke drawn by real pointer
events. Every red row below is one the gate must be able to produce.

| known-bad | what it re-renders | measured |
|---|---|---|
| the **identity** schedule, same frames | an export faithfully filming a schedule that never rendered | 0 px → **31 220 px on 36/51 frames** |
| **`unwired: true`** — the call site *as it stands today*, which passes no `revealEnds` | the blank hold, on the real app | 36 frames → **50, its final 31 one still image of paper** |
| **`holdOnEmpty: true`** | the hold kept where it is blank | 128 frames → **146** |
| **an exact-multiple duration** (1000 ms @ 30 fps) | the closing-frame clamp firing where it must not | `clamped = false` |

The second is not a synthetic mutant. It is the product's own call site, filmed
on the same page, on the same stroke, in the same Vanish state — which is what
makes the wiring below load-bearing rather than decorative.

**And three of this gate's own rows were defects in the instrument**, each a
class rather than a slip:

1. **The seek counter rode the probe grab** — §1. 35 of 49 frames "differed".
2. **The state readback ran in the same tick as the setter.** `setDrawIn` writes
   React state and `__revealHarness` is reinstalled on it, so `drawIn()` returned
   the previous closure. The setters returned `true`, the picture changed, and
   the row asserting the state had taken went red while the feature worked —
   explainer 26 §13.1's defect, hit again one control over.
3. **The ink reference was the film's own last frame**, so `lastInk` was 0 by
   construction and a forward `grow` film that ends on the finished mark was
   reported as *"last frame 0 px of ink"*.

And a fourth was caught by a guard rather than by a person. The live canvas is
**799**×1408; `recorder.ts` `evenDown`s every export, so the film is **798**×1408.
`sameShape` — ported verbatim from `assert-stroke-schedule.mjs` per explainer 35
§3, *"the guard is IN the helpers, not beside them"* — logged **170 mismatches**
and every ink count came back at 1 123 576 of 1 123 584, the whole frame. The
reference is now built the way `recordAnimation` builds a frame: a canvas at the
film's dimensions, filled with `EXPORT_PAPER`, with the grab drawn at (0,0).

```
PASS  not one raster comparison in this run compared two DIFFERENT-SHAPED frames
      — 362 comparisons, 0 mismatches · grabs {"799x1408":51}
```

**The bar on "blank" was set from the measured gap, not from the number that
would have gone green.** Last frame as a fraction of that film's own peak ink:
vanish **0.4 %**, grow+reverse **0.0 %**, grow forward **100.0 %**. The bar is
10 %.

---

## 8. What is NOT done — the one line this lane did not take

> **§9 CLOSES THIS SECTION AND THE SECTION IS KEPT AS WRITTEN.** The line landed
> 2026-08-07. Everything below is Lane P's handover exactly as it was left,
> including its line numbers — which had already moved by the time anyone read
> them, and that is §9's first paragraph.

**`components/viewport-3d.tsx` is another lane's file and the wiring belongs
there.** The mechanism is built, gated and proved end-to-end on the real app
through the real module; what is missing is that the product's own call site
does not yet tell the plan which window mode the user picked. Consequences,
stated plainly:

- **`grow` + the transport's Reverse is fixed with no change at all** — the plan
  applies `reverse` to the ends itself. Filmed: 36 frames, last frame 0 px.
- **`Travel` / `Vanish` / `Shrink` still write the blank hold** until one line
  lands, and that arm is the gate's own known-bad so it cannot go quiet.

The diff, in `handleExportVideo` (`:11453`) and in `videoPlanNote` (`:11753`), so
the panel sentence and the file cannot disagree:

```ts
import { …, revealEndsFor } from "@/lib/export"
…
        /* What the reveal shows at the clock's two ends — frame-plan.ts §W.
         * Without it the plan assumes `grow` and welds 600 ms of blank paper to
         * the tail of every Travel / Vanish / Shrink film. */
        revealEnds: revealEndsFor(revealWindow.mode),
```

…plus `revealWindow` in both dependency arrays. The gate row that must land with
it: the same census taken on the file the **real Video button** downloads under
`Vanish`, so the product path is held to what the module path already is.

**Left open on purpose:** `holdOnEmpty` has no control in the export panel. It is
reachable in the module and the default is the honest one; whether a blank beat
at the end of a loop deserves a pill is Sebs's call, not this lane's.

**Not chased:** `GLTFExporter`'s run-to-run byte instability (§5). Real,
reproduced, and outside this lane's files.

---

# Part 2 — it reached the button

*Landed 2026-08-07 in `components/viewport-3d.tsx`. The measurements in §10 and
§11 were taken by the lane that authored the change against the real Video
button; the change itself is in this tree **byte-identically**, and §9 says how
that is known without re-filming it.*

## 9. Two lines, and the numbers that named them were already wrong

§8 gives the diff at `viewport-3d.tsx:11453` and `:11753`. **Those lines are
`:11606` and `:12067`**, and the file §8 was written against is byte-for-byte the
file the change landed on — sha256 `14d0c194…`, 14 564 lines. So nothing moved
underneath Lane P; the numbers were simply quoted from a tree that had already
been forward-synced. **A line number is a fact with a half-life**, which is why
the handover said *find them by name*, and why this section says what they are:

| | what | where |
|---|---|---|
| the import | `revealEndsFor` added to the existing `@/lib/export` import | `:227` |
| the parked prior | `readDevLaw("__fsExportRevealEnds", ["unwired"], "wired")` | `:11693` |
| `handleExportVideo` | `useCallback`, the export bar's Video button | `:11606` |
| ↳ `exportAnimation({…})` | the call | `:11746` |
| ↳ **the line** | `revealEnds: revealEndsFor(revealWindow.mode)` | `:11789` |
| ↳ its dependency array | gained `revealWindow` | `:11950` |
| `videoPlanNote` | `useMemo`, the panel sentence and the button's `title` | `:12067` |
| ↳ the same fact, so the note and the file cannot disagree | | `:12085` |
| ↳ its dependency array | gained `revealWindow` | `:12090` |

Both dependency arrays gained `revealWindow`, and that is not bookkeeping.
Without it, a user who picks Vanish and presses Video before anything else
re-renders the hook exports the **previous** window's plan — the stale-closure
class explainer 26 §13.1 records one control over, arriving here through a
dependency array instead of through a tick.

`reverse` is still **not** passed pre-swapped, for §3's reason: `planFrames`
applies it to the ends itself, because flipping the clock rather than the phase
is that file's own arithmetic and a caller that guessed at it would get it wrong.
So the transport's Reverse stays fixed with **no call-site change at all**,
exactly as §8 predicted.

### The known-bad is the call site, parked — and this is why the bare diff was not enough

Lane P's handover is a plain `revealEnds: revealEndsFor(revealWindow.mode)`. What
landed is that line behind
`readDevLaw("__fsExportRevealEnds", ["unwired"], "wired")` — the same shape as
`__fsExportClock` and `__fsExportGround` two screens up.

That is not decoration. §7's second known-bad is *"`unwired: true` — the call
site as it stands today"*, and it is the only one of the four that is **not a
synthetic mutant**: it is the product's own code, filmed through the product's
own button. Land the fix bare and that arm can never be rendered again — the
defect would become permanently unreproducible at the place it actually shipped.
**A fix whose absence cannot be re-rendered is a fix nobody can fail** (DISPATCH
§2.6).

`videoPlanNote` reads the law too. Under `unwired` the panel would otherwise
promise a film with no hold while the exporter wrote one, and a parked prior that
ships a panel contradicting its own export is not the prior.

---

> ## 🔴 BANNER — §10 AND §11 DESCRIBE A GATE THAT IS **NOT LANDED IN THIS TREE**
>
> The seven `§D` rows below live in a version of
> `scripts/verify/assert-export-window.mjs` that is parked at
> `docs/verification/unfinished-lane-S/scripts/verify/assert-export-window.mjs`
> (78 194 B). **This tree still carries the 29-row gate**, so the header at the
> top of this file still reads 29 and the numbers below cannot currently be
> re-run here. They are recorded because the four instrument defects in §11 are
> real findings that would otherwise be lost, and because §10 is the evidence
> that the line in §9 does what it claims.
>
> To land them: place that file, then
> `FS_PORT=<port> node scripts/verify/assert-export-window.mjs`.
> It also carries the fix for `assert-gate-integrity` channel B (§11.5), which
> is currently the one red channel blocking `assert-one-knob --record`.

## 10. §D — the unit of done is the downloaded file

§1–§7 drive `exportAnimation` from a host the gate wrote. That proves the module.
It cannot prove the product, and the map's standing example of failure is
`/desk-doodles` — *"a whole motion rig your own drawing cannot reach."* A fix
that lives in `lib/export/` and never reaches the button is that same failure at
the other end of the pipe.

So §D touches nothing but the real UI: the window mode is set by **clicking** the
Timing popover and the `Vanish` pill, the film is started by **clicking** the
`Video` button, and the artefact measured is the file Chrome downloaded. The
control set is read off the DOM first, because *"a whole panel in this repo once
rendered zero controls while harness assertions passed"*.

**The headline, on the downloaded files:**

```
                 frames   plan says   blank tail   last frame
vanish UNWIRED     59        59           42        212 px  (peak 45 691)
vanish  wired      41        41           24        212 px  =  0.5 %   (bar 10 %)
```

**18 frames** — that film's own 18-frame hold, less the closing frame it still
needs. Both counts are asserted against `planFrames` run on the app's own
`useState` defaults rather than against a number typed into the gate, because the
pen duration is the browser's own and moves run to run.

The claim is deliberately **not** "the last frames are blank". A Vanish animation
genuinely fades to nothing, so its closing draw frames are legitimately
near-empty and counting them would inflate the defect with correct behaviour.
The claim is the file's **length** against the plan's, and the known-bad's extra
frames being paper.

And the panel says it before the button is pressed:

```
vanish  "…1.37s at 30 fps — the time this took you to draw · 41 frames ·
         ends on empty paper, so there is no hold · opens on the finished mark"
grow    "…1.97s at 30 fps — the time this took you to draw · 59 frames"
```

### The no-op, and the only control that could see it

`revealEndsFor("grow")` **is** `REVEAL_ENDS_DEFAULT`, so the shipped default has
to survive this change bit for bit. Four films, one page session, one stroke,
through the real button:

```
CALIBRATION   wired/wired identical · unwired/unwired identical · 265 165 824 decoded bytes
CLAIM         before 78b127ab7b6f0709 (59f)  ===  after 78b127ab7b6f0709 (59f)
```

The calibration does two jobs. It is the comparison's zero, and it is also the
only honest answer to a question §1 avoided: the shipped container is **VP9**, and
hashing one asks whether libvpx is bit-reproducible. Here it is — and had it not
been, that row is what would have said so, instead of a red claim row implying a
regression that was really a codec.

**The control could not live in the `grow` state**, which is the whole difficulty
of proving a no-op: there the two arms are *supposed* to agree, so nothing inside
that block can show the parked law is read at all. Its control is the Vanish
pair, where the same law moved the file 59 → 41. A row asserting identity with a
control that cannot fail would have been the eleventh instrument in this repo to
report green while measuring nothing.

## 11. 🔴 Four things §D found, and every one was the instrument

**11.1 · The hash had a ceiling, and the product's own default cleared it.**
`pixelHash` decoded a whole film through `execFileSync` with `maxBuffer: 1 << 28`
— 268 435 456 bytes, which is **59 frames** of this fixture's 798×1408 RGBA. §B
films at 24 fps and lands at 47, so it squeaked under. The real Video button's
panel default is **30 fps**, and a 65-frame film decodes to 292 131 840 bytes.
Node answers that with `ENOBUFS`, which is **a THROW, not a FAIL**: the run died
mid-section and every later row was simply absent, and *"no rows" reads like "not
run", not like "red"*. Now streamed through `spawn` with no ceiling.

**11.2 · The reference was rendered by a different renderer — and it PASSED.**
§B builds its empty page from `__captureHarness.grab()`; the real button renders
through `STILL_EXPORT.grabCanvas`. They differ by **4 484 px**, so a BARE PAPER
frame read **4 516 px of "ink"** and the Vanish closing frame passed a 10 % bar at
**9.0 %**. Green, by one percent, while measuring the gap between two render paths
rather than the presence of a mark. **A green row a millimetre from red for a
reason that is not the subject is the same failure as a red one** — and the bar
was not what was wrong, so the bar did not move. §D's reference is now a `grow`
**download's** frame 0, carrying its own zero (two `grow` arms' frame 0 differ by
**0 px**). The same closing frame then read **0.5 %**.

**11.3 · The gate left the app in a state the next section did not want.** §B6
sets `{order: reversed, overlap: 1, reverse: all}` and nothing put it back, so §D
was filming a non-identity schedule while calling it the shipped default. Fixed
by resetting *and by reading the state back and asserting it*, rather than by
assuming the setter took.

**11.4 · A pixel-exact still run is a fact about the codec.** "Its final N frames
are one still image of paper" is exact on APNG and meaningless on VP9: eighteen
identical bare-paper frames re-quantise, and an exact run reads **29** where the
tail is **42**. `blankRun` was added beside it — trailing frames under the same
10 % ink bar the verdict already uses. **No assertion rests on the exact run.**

**11.5 · And one the meta-gate found: the gate named its own server.** This file
read `process.env.FS_PORT ?? "3000"` and built its own URL — which honours the
knob and is still wrong, because the rule is not *"read `FS_PORT`"*, it is that
**a gate must not be able to NAME its own server**. It now imports `PORT` and
`LAB_URL`. Until that lands, `assert-one-knob` channel B is red in this tree on
this file, and `--record` correctly refuses to write a baseline during a red run.

## 12. What is open

**`holdOnEmpty` has no pill — and this change made that visible.** It is
reachable in the module and has **zero references in `components/`**. That was
latent while the call site never made the plan suppress anything; it is not
latent now. The wired export raises the warning and the toast reads, verbatim:

> *"The 0.60s hold was dropped: this reveal ends on an empty page, so the hold
> would have been 18 frames of blank paper. **Turn on "hold on empty" to keep
> it.**"*

**That sentence instructs the user to operate a control that does not exist.**
Under DISPATCH §2.7 that is a defect; under §2.8 the fix is a product call. So
neither branch was taken — the pill was not added silently and the warning was
not quietly reworded to hide the gap.

**A GLB can never be byte-compared, confirmed twice.** One state, two exports:
`b6e79962d0f5a9ab` vs `5da0c2ac256c8a82`. No GLB gate can rest on a hash — not
for a change, not for a before/after, not for a baseline. §5's mesh census is the
shape that works.

**Two flag-gated arms.** The meta-gate reports two judgements on this gate that no
sweep reaches — the `--model` summary and §6's `--before=` block. Both are
structural to Lane P's file and present identically in canonical; §D added none.
Closing them means a runner passing those flags, and the runner is another lane's
file.

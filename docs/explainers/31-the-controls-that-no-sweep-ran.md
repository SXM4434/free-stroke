# Explainer 31 — The controls that no sweep ran

`docs/explainers/21-losing-your-work.md` §7 wrote this repo's law down on
2026-08-05:

> This repo has caught eleven instruments reporting green while measuring
> nothing, so the gate runs three kinds of control on the **default**
> invocation, never behind a flag.

Explainer 29 then found, underneath a different defect, that the arms hidden
behind flags *"are almost all NEGATIVE CONTROLS — the machinery that proves this
repo's instruments can fail is the machinery no sweep runs."*

Nobody had ever measured whether the repo obeys its own law. This pass measured
it, on all 89 gates, and fixed the four it was dispatched on.

**The number is 62 of 89** — and the more useful number is the one beside it:
**channel J, the gate built to catch this class, sees 2 of the 19 violations.**

---

## 1. The survey, and why it could not be a grep

Lane C counted this class by pattern and got nine. Lane G read the nine and got
six — *"only 2 of C's 9 survive reading; 4 they didn't list do have the
defect."* A pattern-matched survey is wrong in both directions, so this one was
read.

44,391 lines across 89 files is more than one lane can read serially, so the
read was fanned out eight ways, ~11 gates each, with one instruction that made
the result usable: **every verdict must carry a line number and a verbatim quote
from that line.** Then every citation was checked mechanically against the file:

```
VERIFIED 84 / 85 quotes byte-match (whitespace-normalised) at their cited line
  (the 85th is an exact prefix of its line, truncated at the 160-char cap)
```

Plus one verified by hand, for 86 in total. Three gates returned a *negative*
claim — no control anywhere — which no quote can support, so those three were
re-checked directly. All three held.

That is the difference between a survey and a summary of one. The handoff for
this project records what happens without it: *"21 of 185 quotes came back
mis-transcribed from its sub-lanes — two with invented wording."*

### The verdicts

| | | |
|---|---:|---|
| **control** | **62** | a known-bad runs on the bare invocation and its red is in the exit code |
| **partial** | **7** | something inert or two-sided runs, but no deliberately *wrong* input |
| **none** | **19** | nothing on the bare invocation can prove the instrument is awake |

Of the 19, **fifteen own a well-built control that is behind a flag** — the
class explainer 29 named — and **four have no control mechanism at all**:
`assert-material-craft`, `assert-timing`, `assert-timing-origin`,
`assert-tsc-baseline`. `assert-gloss-rim` is a fifth of a different shape: it
*calls* two rows "the control", and both are known-**good** fixtures required to
behave correctly. A specificity guard is not a negative control.

`assert-material-craft.mjs` is the plainest case. 452 lines, no control flag, no
parked arm, no known-bad. Its own comments at `:128`, `:298`, `:338` and `:409`
record mis-invocations that were *demonstrated by hand at the time* — evidence
that the instrument can fail, written down instead of executed.

---

## 2. The finding under the survey: channel J sees 2 of 19

Channel J asks a precise question — *is a judgement withheld behind a CLI flag
no sweep passes?* — and answers it from the syntax tree. The law is broader. A
gate can satisfy J perfectly and have no control anywhere in it.

But J undercounts even the withheld ones, and the reason is one regular
expression:

```js
const EMIT_RE = /\bPASS\b|\bFAIL\b/
```

J can only see a withheld arm that *emits*. Measured:

```
BLIND  "MUTATION CONTROL --mutate=prior: both subject rows went RED,"
BLIND  "MUTATION CONTROL --mutate=prior FAILED TO BITE: ..."
SEEN   "MUTATION CONTROL --mutate=cx: FAILED TO FAIL."
```

`\bFAIL\b` does not match `FAILED` — there is no word boundary between the `L`
and the `E`. So `assert-pen-field-alloc`'s withheld control, which announces
itself in capitals, is invisible to J, while `assert-hero-transition`'s is
visible **because its refusal happens to end in a full stop.**

That is the same accident Lane G recorded about `assert-hero-dials`, whose only
J-visible token was *"FAILED TO FAIL."* in a `console.error`. Two of the four
gates this pass fixed were found by a regex that matched them by luck.

---

## 3. The third way to be green, found in the controls this time

Explainer 29 §5 named it: a row that runs, judges correctly, and prints in a
format nothing reads. Both battery runners count rows with

```js
/^\s*(?:\*\*\* )?(?:PASS|FAIL)\b/gm
```

— the token must lead the line. `assert-layer-flicker.mjs` printed **every**
verdict behind a bracket:

```
[flicker] cal_dead   mean=  0.00 …  DEAD  PASS      <- PASS at the END
[calib] PASS  cal_offform  BROKEN — ink 1.6% …      <- PASS after a prefix
[guard] PASS  gd_blank  guard rejected …            <- ditto
[reduced] PASS  dit_crawl  motion=stopped …         <- ditto
```

None of those is counted. So the sweep saw **53 subject rows and zero controls**
— it counted the measurements and none of the evidence that the measurements
mean anything. Running `--fusion` and `--reduced` produced **0 counted rows
each**, five minutes and fifty seconds of work that no scoreboard could read.

The gate even said so out loud, and that is the part worth keeping:

> `[flicker] NOT RUN HERE, and it is a skip rather than a pass: the GUARD's own
> known-answer cases (--calibrate-guard) …`

An honest note, correct in every particular, printed as a `[flicker]` line — so
the sweep recorded 53 greens and no trace of the hole. **An admission nothing
parses is not an admission; it is a comment.**

---

## 4. The four gates

### `assert-drawin-parity` — the control whose known-bad had been repaired

`--expect-pop=<engine>` named the desk-doodles engine as the known-bad. That
engine was fixed months ago, so re-enabling the flag today fails — correctly and
uselessly. **A control whose known-bad has been repaired is not a control, it is
a memorial.** The flag could not simply be dropped; the subject had to be
re-armed.

It is now synthesised on the real stage every run: the shipped arm, with the
scrub pinned to the **end** of the draw span for all nine samples — which is
exactly the observable Sebs reported, *"the word just auto appears"*. Same page,
same pills, same screenshot, same ink counter; only the input is bad.

```
CONTROL__no-reveal   coverage: 1.000 ×9   first sample 100.0 % of final
PASS  CONTROL · KNOWN-BAD — a stage held at the END of the draw is REJECTED
      "starts near empty" = false (needs false), "popped" = true (needs true)
```

The four inline predicates were factored into one `judge()` first, so the
control grades the same judge the real arms do. Two clauses that a held stage
cannot reach — "never goes backwards" and "no single step reveals half the word"
— get a second control on deliberately bad *series*, and its row says
`predicate-level, not the page`, because a control that overstates its reach is
the defect one level in. **17 → 20 battery-visible rows.**

### `assert-hero-transition` — seven controls, and the gate runs them itself

Seven controls (`cx cy wash drift shading notch speckle`), all correct, all
behind `--mutate=`. The bare run now spawns **itself** once per control and
turns each child's exit code into a row. The mutation machinery is unchanged and
not duplicated — *the control is this gate, run against a deliberately broken
input.* Re-implementing the seven inline would have put two implementations of
one idea in the one place where a divergence is invisible: the copy would be the
thing certifying the original.

One detail is load-bearing. **The child's rows are not echoed.** A control run
makes rows red on purpose, and `^\s*` in the runners' regex means an *indented*
`FAIL` still counts — so echoing a child would post its required reds to the
scoreboard as this gate's failures. Only the child's own one-line verdict is
quoted, sanitised.

**9 → 16 rows, 1 s → 9 s.** Proved by mutation: with the cx/cy injection changed
from `+= 6` to `+= 0` so the control cannot fire, the run exits 1 with two red
CONTROL rows — while the nine subject rows are still **9 PASS / 0 FAIL**, which
is to say the pre-2026-08-07 gate exited 0 on it.

### `assert-hero-carve` — one predicate, two inputs

Here a child spawn would have doubled ~240 PNG decodes, so the controls ride the
existing loops instead. `curveLaw(samples)` is called on the shipped series *and*
on the +2-frame-shifted one; `diffFrames(x, y)` is called on `(shipped, prior)`
*and* on `(shipped, shipped)`. The blind control then evaluates
`armsDiffer(moved, n)` — the row's own predicate expression — on the self-pair
and requires it to return **false**.

```
PASS  CONTROL · a carve on its OWN CLOCK … is REJECTED by that same law
      4 of 371 samples off the law (needs > 0), first mismatch @6.483s in "emerge"
PASS  CONTROL · that same clause REJECTS a capture compared with ITSELF
      self-pair scores 0 of 70 and returns false; the real pair 70 of 70, returns true
```

**6 → 8 rows.** Both mutation-proved: shift `+2 → +0` → exit 1; blind operand
`(la,la) → (la,lb)` → exit 1. Both reverted → byte-identical output.

### `assert-layer-flicker` — the guard was never shown it could say no

Ten withheld judgements across three flags, and they are **not the same kind of
thing**, which is why they get different answers.

`--calibrate` withholds `calibrateGuard()` — the guard's own three known-bad
stages (blank stage, drawing-in form, half-drawn form). The guard is what decides
whether the sampler is looking at a readable subject; the metric's own known-bad
cases are *statements about which pixels are being read*, so they mean nothing
until the guard has been shown it can reject. **That is the §7 violation**, and
it now runs on the default path, in the order the file already argued for: the
guard before the metric.

`--fusion` and `--reduced` withhold **subjects**, not controls — each carries its
own calibration that runs whenever the arm runs. They are a coverage gap, not a
blindness one, and they are handed to the runner table rather than folded into a
gate that would then take seven minutes.

All the print formats are fixed regardless, because an arm nobody can read is
not worth scheduling:

| | before | after |
|---|---|---|
| bare | 53 rows, **0 of them controls** | **62 rows, 9 controls, 6 of them known-bad** |
| `--reduced` | **0** counted rows | **18** |
| bare runtime | 63 s | 86 s |

Mutation-proved, and the first attempt is worth recording. Setting the
blank-stage ink gate from `0.03` to `0.0` did **not** turn the control red — the
guard has a second, independent playhead channel that caught the blank stage
anyway. The mutation landed; the control held for a real reason. Blinding
`formReady` on every channel gives:

```
FAIL  CONTROL · guard gd_blank    guard ACCEPTED A BLANK STAGE
FAIL  CONTROL · guard gd_playing  guard ACCEPTED A DRAWING-IN FORM
FAIL  CONTROL · guard gd_partial  guard ACCEPTED A HALF-DRAWN FORM
[flicker] GUARD NOT CALIBRATED — 3 of 4 … Refusing to report a matrix.   (exit 1)
```

Before this change that same blinded guard produced 53 green rows and exit 0.

---

## 5. What stops it coming back

Two additions to `assert-gate-integrity.mjs`, both inside channel J's family
rather than beside it, because two implementations of one idea is this repo's
most expensive recurring defect.

**`selfSweeps()` — J learns to see a gate that passes its own flag.** After the
fix above, J still reports `assert-hero-transition`, and it is right to by its
own rule: the inverted-verdict block *is* still behind `--mutate=`, and it has to
be, because that block is what the children execute. What changed is that
something now passes the flag — the gate itself, on every bare run. An ALLOW
entry would be the wrong instrument here: an exemption says *"nothing runs this
and here is why that is right"*, and this is the opposite.

**Channel K — the control manifest.** No syntax tree can tell a control from a
measurement, because the difference is whether the input is *deliberately wrong*,
which is a claim about intent. So the ruling is human and written down, one entry
per gate, and what the machine owns is that the ruling cannot rot silently:

- every discovered gate has an entry (a new gate defaults to red);
- every entry names a discovered gate;
- **every `control` entry's cited line still contains its cited token**;
- the counts print every run, and the `none` gates are listed by name.

The third clause is the load-bearing one, and it is the ALLOW list's own lesson
applied: an exemption that matches nothing is a defect, so a ruling whose
evidence has moved is a defect too. Without it, this manifest becomes exactly
what it was written to prevent — a green nobody has re-read.

Both are proved against the real 89 gates and mutation-tested in all three
directions (a missing entry, a stale entry, a rotted citation), and both are
handed over as diffs: the meta-gate is not this lane's file.

---

## 6. The shape of it

| | what the sweep was counting instead |
|---|---|
| 19 gates | subject rows only — nothing that could come back red |
| `assert-layer-flicker` | 53 measurements and 0 of the evidence they mean anything |
| `assert-hero-transition` | nine greens no build had ever been rejected against |
| `assert-drawin-parity` | a control aimed at a bug that had been fixed |
| channel J | 2 of the 19, one of them by a word-boundary accident |

Explainer 27 asked whether a gate is pointed at the thing whose name is on it.
Explainer 29 asked, when the sweep ran it, how much of it ran. This one asks the
question underneath both, and it is the cheapest of the three to answer and the
most expensive to have left unasked: **when it ran, was anything in the room
able to say no?**

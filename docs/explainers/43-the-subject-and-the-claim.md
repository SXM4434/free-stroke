# 43 — The subject and the claim

Seven times now, in one repo, in one week, an instrument has been found measuring
something other than the thing its output was about. Not seven bugs — **seven
instances of one shape**, each found by accident, each written up separately,
each costing a night.

This file is the shape, stated once, so the eighth is recognised on sight.

> **An instrument has a SUBJECT — the thing it actually touched — and a CLAIM —
> the thing its output is about. Nothing in this repo made them equal, and
> nothing was checking.**

The seven are below with their measurements. Read the table first; the argument
is in the last column.

---

## 1. The seven

| # | the instrument | its CLAIM | its actual SUBJECT | the measurement |
|---|---|---|---|---|
| 1 | **the tree** — 35 browser gates | "your work passes" | whatever was on `:3000` | one lane's server logged `/` **six times** across a 48-gate battery, while `assert-mode-rims` printed **189 green rows** (explainer 27 §1) |
| 2 | **the checkout** — a capture naming an absolute path | "this lane's evidence" | the SHARED checkout's evidence — and `_probe-drawin-film.mjs` `rmSync`'d it first | **8 sites across 7 files**, invisible to a survey that read only URLs (explainer 37 §1) |
| 3 | **the canvas** — `querySelector("canvas")` | "the viewport" | the first canvas in document order | **2 canvases with byte-identical container class lists**; 7 frames came back 1584×1468 instead of 799×1468 (explainer 35 §1) |
| 4 | **the invocation** — a judgement behind a flag | "every panel control, judged" | the *model* of the panel | `assert-hero-dials` ran in **0.3 s** and never opened Chrome; **9 gates** have such a flag (explainer 27 §2) |
| 5 | **the scoreboard** — `\bFAIL\b` | "0 failures" | the failures spelled `FAIL`, not `FAILED` | `"…FAILED TO BITE"` → invisible; measured across **1033 rows** in 48 logs (`run-battery.mjs:126-128`) |
| 6 | **the pose** — an OFAT arm | "this channel is not the cause" | one playhead, one camera, one dial | `jointBreak` reads **0/0** at DRAW 80 % and 96 %, and **437 px** on the settled frame (explainer 39 §4) |
| 7 | **the launch mode** — a controller saying "headless" | "nothing will take your screen" | **48 files hardcoding `headless: false`** | the 48 is measured (explainer 37 §6 `:272`); the orphaned-Chrome count on 2026-08-07 is the **controller's report, not a number on disk** — flagged as such |

Every one of these was **green**, or silent, at the moment it was wrong. That is
the property that makes the family expensive: a wrong subject does not throw. It
produces a well-formed answer to a question nobody asked, in the format of an
answer to the question they did.

---

## 2. Why "the instrument was wrong" is the wrong summary

None of the seven is a badly written instrument. Read them individually and each
is careful, commented, and correct about what it does. `querySelector("canvas")`
returns the first canvas in document order, exactly as specified. `\bFAIL\b`
matches `FAIL`, exactly as specified. `setFlatten({jointBreak: 0})` sets the
joint break to zero, and the setter returns `true` because it did.

The defect is never in what the instrument DID. It is in the distance between
that and what its output was TAKEN to mean — and that distance lives in nobody's
code, which is precisely why nothing was checking it.

So the useful question is not *"is this instrument correct?"* — all seven were —
but **"can this instrument choose its own subject?"** Every one of the seven can:

- the gate chose its own server address (a string literal);
- the capture chose its own output directory (an absolute path);
- the grab chose its own canvas (a position in the DOM);
- the sweep chose which arm of the gate to run (by not passing a flag);
- the scoreboard chose which lines counted as verdicts (a regex);
- the arm chose its own pose (by never setting one);
- the tool chose its own launch mode (a literal in each of 48 files).

**Explainer 27 §6 and explainer 37 §7 arrive at the same sentence from opposite
ends, and it is the only defence in this file that has worked more than once:
make the instrument unable to choose its own subject.** A URL it cannot name, a
path it cannot write down, a canvas it holds by ref instead of by selector, a
baseline it cannot raise, a launch mode it does not own.

---

## 3. The two readings that separate a subject from a claim

Both are cheap, both were found the hard way, and neither is a new machine.

### 3.1 · Ask the instrument what it touched, and make it print the answer

Not what it meant to touch — what it touched. This is the reading that turned
three of the seven from arguments into measurements:

- `grabInfo()` reports `canvasesInDocument 1 · firstUnderContainer true` on every
  grab, so a run that ever reads `false` says so (explainer 35 §3);
- the dev server logs its own requests, which is how "35 gates measured a
  different tree" stopped being an inference and became **six requests**
  (explainer 27 §6);
- `sameShape()` records every raster comparison — **81 comparisons, 0
  mismatches** — so the greens above it are worth something (explainer 35 §3).

None of the three needed new infrastructure. Two of them were free: the
information already existed and nothing was reading it. *An admission nothing
parses is not an admission.*

### 3.2 · Ask whether the answer could have been different

A subject error and a real result are indistinguishable from one reading. They
separate the moment you have two.

That is the pair diff (explainer 39 §2) and it generalises past OFAT: drive the
thing to a LOW and a HIGH and difference the two arms **against each other**, not
against the shipped frame. Against the baseline, every one of the three failure
modes prints the same 0. Against each other, only a live channel moves.

⚠ And the reading has its own trap, which is this file one level up: `yaw −25`
and `yaw +25` each move the frame by ~6 300 px and differ from each other by
**82**, because at `depth 0.004` the mark is a sliver and `cos(+θ) = cos(−θ)`. A
pair-diff rule that did not know this would call two plainly live channels inert.
**The pair diff is a reading, not a verdict.**

---

## 4. The fourth axis, measured here

Explainer 39 §4 states the law for the sixth instance:

> A channel's OFAT verdict is a property of the surface, the pose AND the camera
> it was taken on.

Measured on `_probe-drawin-holes.mjs`'s own surface, that list is **one short**.
The `jointBreak` arm there reads 0 in both directions at *every* playhead —
DRAW 80 %, DRAW 96 %, the first breath frame and the last — so no re-posing
rescues it. Isolating one dial at a time on the settled frame:

| arm | junctions in `__heroJunctions.list` | pair |
|---|---:|---:|
| wobble 0.4 · endpoint **protrude** | 7 | **440** |
| wobble 0.4 · endpoint **clean** | 3 | **0** |
| wobble 0 · endpoint **protrude** | 6 | **337** |
| wobble 0 · endpoint **clean** — *the state Sebs reported from* | 2 | **0** |

`clean` collapses the junction list and the channel goes silent. Wobble moves the
pixels by a hundred and never silences it. So the fourth axis is **a dial the
harness does not own** — page state, set by the product, invisible to a sweep
that only records what it drove itself.

The repair is not to move the arm. It is to say, beside the number, what the arm
could and could not have shown — and to add the control that goes red if that
explanation is ever false.

---

## 5. What is now enforced, and what is not

`scripts/verify/assert-arm-took.mjs` closes exactly one edge of instance 6: **an
arm must read what its driver returned.** An arm that never reached the render
and an arm that reached it and changed nothing print the same number, and only
the boolean separates them.

Measured by parsing, 2026-08-07:

```
at Lane Q's scope (setFlatten only)   25 files fail   (Q predicted 24)
at every validating driver            96 files fail · 232 dropped arms
                                      …of which 23 are assert-* GATES
```

The one file clean on every `setFlatten` arm is `_probe-lane1-blank-tail.mjs` —
the file Lane Q itself converted — which the analyser found without being told.

**Say the size of this honestly.** It is an unguarded edge, not a fire. Lane Q
read twenty-five files in full and **no file in the survey passes an invalid
key**: `{flat: 0}` was one typo, not a class. Nothing in the tree is currently
lying because of this. What was missing is the ability to notice when one starts
to — and the discipline is already in these files, which is the strange part.
**At least eight of them check a *different* control's return on the same run.**
They skipped this one setter for a reason that was correct and then expired:
`setFlatten` returned `true` unconditionally until 2026-08-07, so reading it
proved nothing. The fix landed; the call sites did not hear about it.

> **A validator nobody reads the answer of is a validator that is not running.**

### Still open

- **Instance 6 is closed at the boundary, not at the pose.** Nothing yet requires
  an OFAT row to record the surface, pose, camera and dials it was taken at.
  That is the next channel and it is a real one.
- **`lit`, `pitch` and `color` have never had their picture graded by any gate**
  — legal by the validator, driven once by a probe *"which is not a gate"*.
- **Row 3 of explainer 24 §10.2 is still unfalsified**: no harness can set a mesh
  invisible, so nothing available can make `visible` say otherwise.
- **96 files carry the debt under a named exemption**, each with a written reason
  and a recorded arm count, because headroom is free violations (explainer 37 §4).

---

## 6. The shape of it

Explainer 27 asked whether a gate is pointed at the thing whose name is on it.
Explainer 29 asked how much of it ran when the sweep ran it. Explainer 31 asked
whether anything in the room could say no. Explainer 34 asked whether the machine
was listening for the word it used. Explainer 35 asked it of the evidence.
Explainer 39 asked it of the arm.

This one says they are the same question, and it has a cheap form:

> **Name the subject in the output, beside the number.** Which tree, which
> element, which pose, which invocation, which launch mode. Not because anyone
> will read it on a green run — but because it is the only thing that makes a
> green run falsifiable, and six of the seven above were green.

The seventh is the one worth ending on, because it did not cost a night of
debugging — it cost Sebs his machine. A controller said "headless"; forty-eight
files said otherwise, in a literal, one per file. Nobody was lying and nobody was
careless. **The claim and the subject had simply never been required to agree.**

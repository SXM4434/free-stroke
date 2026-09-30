# Explainer 34 — What counts as a judgement

Explainer 31 measured the repo against its own control law and found **62 of 89**
gates obeying it. Then it measured the instrument built to catch the other 27 and
found something worse:

> **channel J, the gate built to catch this class, sees 2 of the 19 violations** —
> and one of those two by a word-boundary accident.

This pass made the instrument see them. The number it reports got worse, which is
the correct outcome, and none of it came from lowering a bar.

|  | before | after |
|---|---|---|
| gates surveyed | 89 | **95** (six landed overnight) |
| run a control on the bare invocation | 62 | **75** |
| run none | 19 | **13** |
| of the 19, **channel J** catches | **2** | **9** |
| of the 19, reported by name every run (J + K) | 2 | **18** |

The nineteenth is `assert-drawin-parity`, which is not reported because lane I
actually fixed it.

---

## 1. `\bFAIL\b` does not match `FAILED`

The whole of channel J's reach was bounded by one regular expression:

```js
const EMIT_RE = /\bPASS\b|\bFAIL\b/
```

There is no word boundary between the `L` and the `E`. Measured on real gate
output:

```
BLIND  "MUTATION CONTROL --mutate=prior FAILED TO BITE: …"
SEEN   "MUTATION CONTROL --mutate=cx: FAILED TO FAIL."
```

`assert-hero-transition`'s withheld control was visible **only because its
refusal sentence happens to end in a full stop**, which restores the boundary.
`assert-pen-field-alloc`'s, which announces itself in capitals, was invisible.
That is the same accident lane G recorded for `assert-hero-dials`, whose live arm
printed `live`/`DEAD` and was counted as zero rows.

The same hole sat in both battery runners. Lane K found and fixed it there the
same night, and measured the fix over the 48 real logs the browser battery had
already written: **1032 → 1033 rows, zero false positives.**

### The tidy-up that looks right and is wrong

The obvious move is one alternation shared by both readers. It is wrong, and lane
K is the one who proved it: **the two readers' risk runs in opposite directions.**

- At the **scoreboard**, the pattern decides how many rows are COUNTED.
  Over-matching inflates a total — nine gates print `assert-one-knob: 5 PASS · 0
  FAIL` and that is a summary, not a row.
- At the **meta-gate**, it decides whether a console call IS a judgement.
  Under-matching blinds channel J; but over-matching lets a capture-only script
  pass channel A **on prose** — the exact false green channel A exists to catch,
  reached by widening the thing that catches it.

So `scripts/verify/lib/verdict-rows.mjs` holds one alphabet core and **two
deliberate anchorings**, each with its own controls. The row half is anchored,
carries an optional `[channel]` prefix, and stops at `FAILED`. The source half is
unanchored and admits `PASSED`, `PASSES`, `FAILS`, `UNSOUND` and `NOT SOUND`.

Every candidate was counted across all 95 gates and **read** before admission:

| token | hits in string literals | ruling |
|---|---:|---|
| `PASSED` | 8 | in — all verdicts (*"UNSOUND — the control PASSED"*) |
| `PASSES` | 1 | in — `"PASSES <- WRONG"` |
| `FAILED` | 40 | in — *"CONTROL FAILED"*, *"CALIBRATION FAILED"* |
| `FAILS` | 6 | in — *"SOUND — the control correctly FAILS."* |
| `FAILURE(S)` | 39 | **out** — a count, not a verdict; every one a summary |

The file's `--break=one-rule-for-both` mode runs the fixture set under the merged
alphabet and requires it to go red. It does: two fixtures fail, both summary
lines that become counted rows. **The tidy-up is a rule nobody had watched fail.**

`assertReadersAgree()` then proves the two implementations are the same function
on the 48 real logs, every sweep — 1033 rows, 0 red, identical to
`run-battery.mjs`'s `ROW_RE`. Fixtures alone would not have done: this class of
defect is made of formats nobody thought to write a fixture for.

---

## 2. The alphabet fixed 2 of the 17. The other three blindnesses were structural

Widening the token set is not what moved the number. Three separate structural
holes did, and each was a spelling the analyser did not know:

**`FLAG === "prior"`.** `condFalsyByDefault` handled a bare `if (MUTATE)` and
nothing else. Most gates select *which* known-bad to arm by comparing a string
flag against a literal, so the entire control block read as reachable by default.
The two gates J could see are the two that happen to write it the other way.

**The hand-rolled `arg()`.** `assert-drawin-2d-parity.mjs:85` is

```js
const CONTROL = (process.argv.find((a) => a.startsWith("--control=")) ?? "").split("=")[1] ?? ""
```

— `arg("control", "")` written out longhand. Because it is not the repo's helper,
`CONTROL` never joined the falsy-flag set, and a gate whose control is *entirely*
behind `--control=` produced no finding at all.

**A judgement is a verdict that reaches the exit code.** The remaining gates
announce their control's verdict in a vocabulary no token rule can ever chase —
*"both subject rows went RED, as required"*, *"NOT SOUND"*, *"STAYED GREEN ✗"*.
Widening the alphabet until it matched those would end with it matching prose.

But every one of those blocks ends the same way, and it is the way this file's
own header already defines a judgement, for channel **B**: *a non-zero exit
reachable from the script's own judgement.* **Channel J was defining a judgement
lexically while channel B defined it structurally — two halves of one file
disagreeing about what a judgement is.** `s.exits` had been computed on every
sweep since the file was written and read only by B. That is precisely the shape
of the `deadEmissions` finding that created channel J in the first place, one
level deeper.

Two exclusions keep it honest, and both were found by the channel firing on
things it should not have:

- **`process.exit(2)` is a refusal, not a verdict.** Measured across all 95
  gates: every occurrence is *"unknown `--control="x"`"*, *"no capture at `<dir>`"*,
  *"frame counts differ. Re-capture both."*, *"the mutant did not ARM; refusing to
  grade it"*. The gate is declining to judge, which is the opposite of a withheld
  judgement. Same exclusion, same reason, as B's `.catch` rule.
- **The shortcut this file documents about itself.** `main()` has
  `if (CALIBRATE) process.exit(calibrate() === 0 ? 0 : 1)` beside an
  unconditional `failed += calibrate()`. The exit is behind a flag; the judgement
  is not. The call-arm has guarded that since it was written; the first draft of
  the exit-arm re-introduced the identical false positive **on this very file**,
  which is how it was caught.

Through all of it the A/B/C verdict table across all 95 gates is **byte-identical
to the baseline**. Nothing became a gate that was not one; nothing stopped being
one. Lane K's required before/after control, run and diffed.

---

## 3. Channel K — the ruling is human, the rot is not

No syntax tree can tell a control from a measurement, because the difference is
whether the input is *deliberately wrong*, which is a claim about intent. Lane C
counted this class by pattern and got nine; lane G read the nine and got six —
*"only 2 of C's 9 survive reading; 4 they didn't list do have the defect."*

So the ruling is written down, one entry per gate, and the machine owns only that
it cannot rot silently: every gate has an entry (**a new gate defaults to red**),
every entry names a gate, every `control` entry's cited line still contains its
cited token, and the `none` gates print **by name** every run.

That is Sebs's standing pattern for a systemic drift, exactly: the pass, plus a
gate that fails on the *next* violation, plus an explicit exemption list with
written reasons. The 13 remaining violations are the named backlog; a fourteenth
gate landing without a ruling is a failure.

**The number that argues for the whole channel is how fast it rotted.** Lane I
verified all 89 citations against the tree when it wrote them. Re-checked a few
hours later:

- **2 had already rotted** — `assert-fusion-authoring` :214 → :219,
  `assert-fusion-ui` :171 → :193;
- **6 gates had landed with no entry at all**;
- **3 `control` rulings carried no citation at all** (`line: 0`) — and those were
  lane I's own three fixes, i.e. **the three most recently changed rulings in the
  file were the three the rot check skipped**, because it was guarded by
  `e.line > 0`. An uncitable ruling is not a ruling; it is a claim. That is now
  clause K4.

Two more rotted during this lane's own edits, one of them the manifest's entry
for the meta-gate itself. A file that cites itself is maximally fragile, which is
why `--recite` exists — and why it **refuses** when the cited token appears
nowhere in the file. That is not a control that moved, it is a control that is
gone, and re-ruling it is a human call. The same shape as channel E's
`--rebaseline`, with the one case it must not launder carved out.

---

## 4. The four gates that had no control at all

### `assert-material-craft` — the disease in one file

452 lines, no control flag, no parked arm, no known-bad anywhere. Every row
asserted the subject and the only refusals were anti-vacuity guards.

And yet the evidence was already there. Four mis-invocations are written into the
comments at `:128`, `:298`, `:338` and `:409` — **each one demonstrated by hand at
the time**, each with the exact command and the exact wrong answer:

| recorded at | the command | what it did |
|---|---|---|
| `:128` | `--phase=matanim --label=presets` | six cells skipped → *"all checks pass"* → exit 0 |
| `:298` | `--phase=stack --label=presets` | `TypeError` out of a top-level await |
| `:338` | `--phase=timing --label=presets` | *"sync modes … all six differ"* on zero files |
| `:409` | `--phase=zzz --label=iridescence` | silently ran `presets()` → exit 0 |

**Somebody did the right experiment and then stored it as prose.** A
demonstration that lives in a comment cannot notice when the fix it describes
stops working.

They now run, on the bare invocation, by spawning the file the way the comment
says it was invoked — the `assert-hero-transition` shape, so `selfSweeps()`
already recognises it. Each asserts three things, and the third matters most: the
child must have refused, must have said so **in words**, and must not have
claimed a clean sweep. An exit code alone would be satisfied by a crash, and a
crash is exactly what `:298` was fixed to stop. A fifth control covers the
zero-check guard. **5 controls, 13 checks, exit 0.** Break-proved: restoring
`await (run[PHASE] || presets)()` turns control 1 red with *"exit 3, NO stated
refusal in its output"*.

It also had a hole nobody had named: **a bare run on a tree with no frames exited
1**, making it a red in every lane tree. Under lane K's ladder that is exit **3**,
PARTIAL, with an `UNSWEPT` line — and the controls run *first*, because a gate
that skips its own controls when the subject's evidence is missing has the
dependency backwards.

### `assert-timing` — the counter-evidence was in a detail string

The parked prior `delayedAfter > delayedDuring * 3` degenerates whenever
`delayedDuring` is 0.00, which is what it measures on every capture this gate has
ever graded. It was described in a comment and **quoted inside a detail string**,
where it changed no verdict.

Both predicates are now functions, run against the same deliberately-wrong input,
in both directions:

```
a layer that barely twitches once:  after 0.01, during 0.00
  PARKED   after > during * 3   ->  ACCEPTS  (blind)
  SHIPPED  after - during > 10  ->  REJECTS  (bites)
```

A control that only proved the new rule works would not have shown the old one
was broken, and "we replaced it" is the claim being tested. **3 controls.**
Break-proved: `CLEARLY_LIVELIER * 0` turns 2 of 3 red.

### `assert-timing-origin` — installed, and unreachable

The pre-fix behaviour *is* in the file, at `:45-69` — but as `??` **fallbacks**,
which only take effect when the export is missing. On any current checkout
`completionTrigger` exists, `FIXED` is true, and the parked consumer never
executes. Lane I read this as needing a different checkout rather than an
argument.

It needs neither. The pre-fix consumer is a two-line function and can simply be
**called**. `sweepLayer` now takes the amount reader as a parameter, so the same
sweep through the same `evaluateLayerTime` runs through the pre-fix reading, and
row 1a's own predicate is required to reject it:

```
pre-fix peak 1.000  ->  row1a(peak > 1.2) = false   REJECTED
shipped peak 1.589  ->  row1a(peak > 1.2) = true    accepted
```

A third row requires the two readings to actually differ — a control whose two
arms are secretly the same input is the commonest way this class goes quiet.
**3 controls, 42 assertions, exit 0.** Break-proved.

### `assert-gloss-rim` — worse than having none

This one *called* two rows "the control", and both are known-**good** fixtures
required to behave correctly: the circle must still smooth at the coarsest rung,
the square's drawn corners must survive. Those are useful — they guard against
the fix being a blanket loosening — but they are **specificity guards, not
negative controls.** Nothing was wrong on purpose, so nothing could prove the
instrument was awake: `notAComb` could have returned `true` unconditionally and
every row would have stayed green.

**A gate that believes it has a control and does not is more dangerous than one
that knows it has none, because the first one stops anybody looking.**

Renamed to `SPECIFICITY`. The real control grades check 2's own predicate against
the measured pre-fix reading quoted in the file's own header — **rimTurnMeanDeg
90 / alternation 0.987**, sample `90,-90,90,-90` — plus one known-bad per clause,
so neither clause can be decorative, plus an accept arm. They run before the
browser opens, so they hold on a tree with no dev server. A predicate blinded to
return `true` fails 3 of 4; before this change it would have failed 0, because
there were none.

---

## 5. The shape of it

Explainer 27 asked whether a gate is pointed at the thing whose name is on it.
Explainer 29 asked, when the sweep ran it, how much of it ran. Explainer 31 asked
whether anything in the room was able to say no.

This one asks the question underneath the instrument itself: **when something did
say no, was the machine listening for the word it used?**

For nineteen gates the answer was no, and for seventeen of those the reason was
not that the evidence was missing. It was written down — in a comment, in a
detail string, in an installed-but-unreachable fallback, in a refusal sentence
whose only crime was ending without a full stop. **The counter-evidence was
already in the building, and nothing was running it.**

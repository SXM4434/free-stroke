# Explainer 36 — The known-bad that was written, and parked

Explainer 31 measured the repo against its own law — *"the gate runs three kinds
of control on the **default** invocation, never behind a flag"*
(`docs/explainers/21-losing-your-work.md` §7) — and found **19 of 89 gates
breaking it**. Four of those had no control mechanism at all. The other fifteen
are the interesting half, and thirteen of them are this pass:

**someone wrote a real known-bad, wired it correctly, gave it a required-red
table — and put it behind a flag nothing types.**

That is a stranger failure than not writing one. The work exists. It is correct.
It has simply never run, so every green above it was worth what an unrun control
is worth. All thirteen now run bare, and all thirteen have been shown to fail.

---

## 1. The tally, and the one number that matters

| | |
|---|---:|
| gates moved onto the default path | **13 / 13** |
| controls now running bare | **31** |
| of those, proved to fail by mutation | **31** |
| battery-visible rows, these thirteen | **78 → 110** |
| model battery, wall clock | **15.15 s → 16.90 s** |
| **real defects found on first running a control** | **1** |

The last row is the one this pass exists for, and it is §5.

---

## 2. Three answers, applied per arm — and the cost that decided them

Explainer 29 §5 established the choice: delete the flag, teach the runner to pass
it, or schedule the arm elsewhere with a **named** skip. It also argued for the
first as the default, because *"a runner-passed flag only helps people who go
through a runner; anyone typing the gate's name still gets"* the half that cannot
fail.

**Every one of the thirteen took answer 1.** Not by policy — by measurement.
Answer 3 needs an arm that is genuinely too expensive for every run, and the
deciding evidence is a number:

| gate | bare, before | bare, after | what the control costs |
|---|---:|---:|---|
| `assert-citations` | 0.17 s | 0.21 s | 5 controls, all arithmetic |
| `assert-stack-anim` | 0.38 s | 0.61 s | 2 arms, 4 extra frame reads |
| `assert-stack` | 0.88 s | 1.07 s | 2 arms, one extra image pair |
| `assert-pen-field` | 1.79 s | 1.82 s | 5 controls on **copies of one bake** |
| `assert-drawin-2d-parity` | 1.24 s | 3.62 s | 3 full arms, in-process |
| `assert-hero-k7-news` | 9.0 s | 9.7 s | **4 controls, one extra screenshot** |
| `assert-hero-live-shadow` | 10.5 s | 10.9 s | same page, same playheads, 2 shots |
| `assert-flat-silhouette` | 9.4 s | 18.9 s | self-spawn ×1 |
| `assert-still-export` | 7.6 s | 20.8 s | 2 arms, own context each |
| `assert-hero-k7-intact` | 7.7 s | 29.0 s | 3 arms, own context each |
| `assert-pen-field-alloc` | 23.9 s | 47.1 s | 1 arm, own **page** (see §4) |
| `assert-sweep-release` | 19.5 s | 58.2 s | 2 arms, one browser |
| `assert-hero-option-panel` | 57.1 s | 113.8 s | self-spawn ×1 |

Nothing here approaches the cost that earns answer 3. Lane I's accepted example
is `assert-layer-flicker --fusion` at **304 seconds**; the most expensive arm in
this set is 57. **So no arm was scheduled elsewhere and no skip is named, because
there is nothing to name** — a schedule with nothing on it is worse than no
schedule, because it looks like an argument.

The cheap end is the part worth generalising. `assert-pen-field` bakes a
signed-distance field once — that bake *is* the gate's runtime — so its four
known-bads run on `Float32Array.from(field.data)` copies and cost **30
milliseconds**. `assert-hero-k7-news` gets four controls for **one extra
screenshot**, because one of them (`nobreak`) is literally the frame the gate had
already taken two statements earlier, and two more are pixel-side arithmetic
applied after the browser closes. **A control is expensive when you re-run the
gate to get it, and most of the time you do not have to.**

### The whole-battery number, stated as a trade-off rather than a shrug

```
MODEL BATTERY      before            after
wall clock         15.15 s           16.90 s      (+1.75 s, +11.6 %)
green              28/43             30/43
rows (clean)       606               641
```

Two of those three gains are not mine to claim: `assert-stack` and
`assert-stack-anim` were red **environmentally** in a lane tree (0 rows, exit 1,
no `docs/verification/`), and copying 12.3 MB of stored frames in is what turned
them green. The honest attribution of the +1.75 s is: **+2.36 s of added CPU
across five model gates, four-way parallel, against a critical path
(`assert-drawin-monotone`, 13.4 s) that none of them is on.** Unrelated gates in
the same run drifted 2–5 % slower from sibling-lane load, which is the same order
as the signal — so the honest statement is that the model battery absorbed
thirteen gates' worth of controls without a legible cost.

---

## 3. Naming the row the control must redden

Every control here asserts **which** row goes red, never "the run failed". That
distinction is not fastidiousness; it caught four mutants that a looser control
would have passed.

`assert-drawin-2d-parity` has three arms. Pin its clock statistic at zero —
`worstClock = Math.max(worstClock, 0)`, a row that can no longer disagree — and
the `clock` and `raw` control arms **still make a row go red**, because the
downstream `ink` row fails too. A control asking "did anything fail?" reports
SOUND and the gate exits 0 with its central row unfalsifiable. Asking "did the
`clock` row fail?" exits 1:

```
FAIL  CONTROL · KNOWN-BAD `clock` … is REJECTED by the "clock" row
      1 of 6 row(s) red: ink · target "clock" STAYED GREEN
```

The same shape appeared three more times: `assert-sweep-release` under a blinded
row 2 (`hazard` still reddens rows 3 and 4), and `assert-still-export` under a
blinded row 7 (`nocompensate` still reddens row 9).

And the inverse matters just as much. `assert-sweep-release`'s `prior` arm is
required to redden row 3 **and to leave row 2 green** — because this repo already
knows why: the invariant is held by the execution order of two blocks that know
nothing about each other, so the pre-fix branch really does pass on the strength
and really does fail on the geometry. `assert-hero-k7-news`'s `shade` arm must
break the value row and must **not** break gate 1, because a uniform re-value has
no spread. A control that reddened everything would delete the finding.

---

## 4. The control that could not bite, and why

`assert-pen-field-alloc` reproduces the eraser Sebs reported for days: three r175
sizes a `DataTexture`'s storage with `texStorage2D` at the **first** upload and
`texSubImage2D`s every one after, so a re-bake at a different size leaves the
shader scanning the old rectangle.

The first version ran both arms in one warm page. **The control stayed green:**

```
control read: free-stroke: field 1152x294 / GL 1152x294   ·  desk-doodles: field 1152x294 / GL 1152x294
```

Not a weak mutation — the defect's own definition. The shipped arm had already
driven the dials, so the allocation was *already* at the size the control's
re-bakes produce. A second arm in a warm page cannot express a first-upload
defect. With a fresh page per arm:

```
control read: free-stroke: field 1152x294 / GL 1192x324  MISMATCH
              carved 18 comps / 6 specks / 17735 px  vs un-carved 7 comps / 36988 px
```

Recorded because it generalises: **any control whose subject is a first
allocation is unmeasurable on a reused page.** Had it not been mutation-tested,
this pass would have shipped a control that ran every sweep, printed green, and
measured nothing — the lie one layer down, which is the most embarrassing
available outcome of a lane like this one.

A second, milder version of the same lesson in `assert-still-export`: two arms
sharing a browser **context** inherit each other's `localStorage`, and this app
restores a drawing from it by design (explainer 21). Row 1, "the empty state
speaks", came back red in both control arms — for a reason neither law causes.
The verdicts were still correct, because they name their target row; but a
control arm carrying reds it did not cause is one refactor from "something went
red, therefore it bit". A fresh **context** per arm, not just a fresh page.

### One absorbed mutation, with its cause established rather than assumed

Lane I's discipline: do not escalate a mutation until you know why the first one
was absorbed. `assert-hero-live-shadow`'s control takes the same two playheads
with the camera dead-on at el 0 and requires the ground tone **not** to move —
a horizontal contact pool is edge-on there. Moving the sampling band to overlap
the ink's lower edge, a deliberately wrong "ground", did **not** redden it.

The mutation landed — the el-35 drop moved 4.95 → 3.36 — but at el 0 the two
playheads are identical **wherever** you sample (Δ 0.00 in both band positions),
because the mark is the settled solid at both. The control's claim is about the
*scene*, not about where the band sits. So a band-placement defect is orthogonal
to it, and the mutation that does bite is the one that removes the difference
between the arms: forcing the control's camera to the lifted pose.

---

## 5. 🔴 The defect that was hiding behind the flag

`assert-hero-k7-intact` grades three junction laws. Two are negative controls.
The third, `terminals`, is not: it is the **parked prior law** — still selectable,
still rendering, kept under §0.7's never-delete rule — and the file grades it
normally. Its header has always said it *"is expected to PASS"*.

Nothing had ever run it. First bare run, 2026-08-07:

```
junction law: terminals · 9 junctions · pen carve 0.70
FAIL  K7 DOES NOT TAKE THE MARK APART — the drawing is still assembled
      connected ink components: K1 5, K7 6 (must be equal).
      K1 sizes 6026, 4604, 4100, 3584, 3232  ·  K7 sizes 5913, 4604, 4100, 3584, 2330, 777
```

A 3232 px part splits into **2330 + 777**. A 777-pixel fragment of the word is
set adrift. On the same frame, in the same run, with the same instrument, the
shipped `selfcross` law holds K1 5 → K7 5.

**Decided by measurement, not argument.** A control that fails is either a broken
control or a broken subject; this instrument passes the shipped law and reddens
on both of its own known-bads, so the subject is what changed. The mechanism is
already named in the file's own header: the break is sized against the **tube**
radius (`JOINT_BREAK_KEEP_K · inkDiameter / 2`, `lib/flat-ink.ts`) while a carved
stroke is ~0.69 R, so the paper band starts beyond the ink meant to hide it — the
"ink collar" failure mode.

It is left **red**, with the mechanism in the failure detail, so it turns green
the moment the fix lands. Not softened, not put back behind the flag.

And the mutation makes the cost of the old arrangement vivid. Pin the intactness
predicate at `true`:

```
PASS  K7 DOES NOT TAKE THE MARK APART …            (4 subject rows PASS, 0 FAIL)
FAIL  CONTROL · KNOWN-BAD `prior`     …
FAIL  CONTROL · KNOWN-BAD `nofarside` …
PASS  the PARKED `terminals` junction law … still holds the mark together
```

Blinding one predicate turns the **real red green** and reddens both controls.
Before this pass that mutant exited **0** — a live defect and a blind instrument,
neither visible to any sweep.

### Two stale claims the same run corrected

The file's own header block, *"🔴 THIS ROW IS RED AT THE SHIPPED CARVE"*, no
longer holds: the shipped law reads 5 → 5 and every bare subject row is green.
And the law it names as shipped has moved `crossings` → `selfcross`. Both are
reported rather than rewritten, because prose about a beat this lane does not own
is not this lane's to re-argue.

### 🔴 Corrected the next day by the lane that took the finding

Everything above is what this pass measured, and it stands — **except the
mechanism**, which this pass did not measure. It quoted it, and said so:
*"The mechanism is already named in the file's own header."* The header was
wrong, and explainer 42 is the diagnosis. In short:

- **The cause is the junction SET, not the break's radii.** `crossings` and
  `terminals` run the same radii, the same carve, the same shader and the same
  frame, and differ only in which junctions they publish. `crossings` holds the
  mark at K1 5 → K7 5; `terminals` splits 3232 into 2330 + 777. A quantity that
  is identical across two arms cannot be what separates them.
- **The ink collar had already been fixed.** The per-break carved radii are
  wired — `syncBreakTable` writes them and the fragment shader reads them. The
  sentence that said otherwise was a stale to-do in `lib/flat-ink.ts`, mirrored
  into the gate's header, and from there into this section, the lane state and
  the gate's own failure detail. **One stale doc sentence pointed four documents
  at the wrong layer**, and the second-best outcome of this pass is that running
  a control is what exposed it.
- **The severance is one junction: 18→20**, admitted by the parked margin at
  `aEnd 30.7` against `reach 28.23`, where the pen lifted inside the other
  stroke's paper band. It is also the single junction that reddens `nofarside`
  and `prior`, which is why the row is now graded as a **third known-bad**
  rather than repaired: closing it would blind all three controls at once.

The gate is 7 → **8** rows and exits 0 on the bare invocation. The count in §6's
table is this pass's, and correct as of this pass.

---

## 6. The rows have to be visible, and the scoreboard moved underneath them

Explainer 29 §5 and explainer 31 §3 are about the third way to be green: a row
that runs, judges correctly, and prints in a format nothing reads. One of these
thirteen was exactly that. `assert-pen-field-alloc` announced its control as

```
MUTATION CONTROL --mutate=prior: both subject rows went RED, as required.
MUTATION CONTROL --mutate=prior FAILED TO BITE: …
```

and `\bFAIL\b` does not match `FAILED` — explainer 31 §2 names this file as the
one channel J could not see for that reason. It is a `PASS`/`FAIL` token at line
start now.

Counted against Lane K's landed `lib/verdict-rows.mjs` — one rule, two deliberate
anchorings, calibrated on 48 real logs at 1032 → 1033 rows and 0 false positives
— the thirteen go **78 → 110 battery-visible rows** — 32 added, of which **31 are
control rows** and one is `assert-citations` gaining a second real subject row
when two hardcoded `PASS` strings became verdicts read off their own counts:

| gate | before | after | | gate | before | after |
|---|---:|---:|---|---|---:|---:|
| `assert-citations` | 2 | **7** | | `assert-hero-live-shadow` | 3 | **4** |
| `assert-stack` | 10 | **12** | | `assert-pen-field-alloc` | 4 | **5** |
| `assert-stack-anim` | 8 | **10** | | `assert-still-export` | 9 | **11** |
| `assert-pen-field` | 8 | **13** | | `assert-hero-k7-intact` | 4 | **7** |
| `assert-drawin-2d-parity` | 6 | **9** | | `assert-hero-k7-news` | 8 | **12** |
| `assert-sweep-release` | 5 | **7** | | `assert-hero-option-panel` | 7 | **8** |
| `assert-flat-silhouette` | 4 | **5** | | | | |

One rule is load-bearing throughout and it is Lane I's: **a control arm's rows are
never echoed.** A control run makes rows red on purpose, and both runners count an
*indented* `FAIL`, so echoing a control arm posts a gate's own evidence as its
failures. Only the one-line verdict is printed, sanitised.

---

## 7. What stops it coming back

Channel K — the control manifest — names every `none` gate **by name, every
run**. Before this pass it listed thirteen; twelve were these, and the
thirteenth is `assert-tsc-baseline` (another lane's). The manifest is another
lane's landed file, so the thirteen replacement entries are handed over as a
diff rather than applied — with **real line numbers and tokens**, not the `line:
0` opt-out, so channel K's rot check actually guards them.

That check is already earning its keep: it currently reports four rotted
citations, all four of them the *other* control lane's own gates outrunning their
manifest entries. An exemption whose evidence has moved is a defect, and the
machine says so without anyone re-reading anything.

---

## 8. The shape of it

| | what the sweep was counting instead |
|---|---|
| 13 gates | subject rows only — 78 of them, and not one thing that could come back red |
| `assert-hero-k7-intact` | a parked law nobody had run, with a 777 px fragment adrift in it |
| `assert-pen-field-alloc` | a control whose verdict no scoreboard could parse |
| `assert-flat-silhouette` | *"a green run on the unfixed build is the failure condition"* — and the unfixed build was never run |
| `assert-hero-option-panel` | seven films checked against an inventory this file defined itself |

Explainer 29 asked how much of a gate runs when the sweep runs it. Explainer 31
asked whether anything in the room could say no. This one asks the question that
survives both being answered: **the no was written down, and then filed where
nothing would ever read it.**

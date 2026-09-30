# Explainer 29 — The gate that never opened the browser

`docs/README.md:198` says this, and has said it for weeks:

```bash
node scripts/verify/assert-hero-dials.mjs       # every panel control, judged in the state it is SHOWN in
```

In the browser battery that gate ran in **0.3 seconds, emitted 4 rows, and never
opened Chrome.** Explainer 27 found it while chasing a different defect and named
it as one of a class of nine. This pass took the class apart.

Three things came out, and the second is the one worth the night:

1. **The class is six, not nine** — and only two of the original nine survive
   reading. The other seven are three different things wearing one shape.
2. **The withheld arms are almost all NEGATIVE CONTROLS.** The instruments that
   prove this repo's instruments can fail are the ones nobody runs.
3. **The meta-gate had been computing the answer since the day it was written**,
   and reading it in exactly one place — the place that only executes for gates
   which have already failed.

---

## 1. What "in a sweep" was still hiding

Explainer 27 §2 lists nine gates that "keep a judgement behind a flag no runner
passes". Every one was re-derived here from the syntax tree rather than from the
flag's name, and then read by hand. The list does not hold:

| gate | flag | verdict on reading |
|---|---|---|
| `assert-hero-dials` | `--live` `--freeze` | **stands** — the whole browser arm |
| `assert-layer-flicker` | `--fusion` `--reduced` `--calibrate` | **stands** — 10 arms |
| `assert-export-live` | `--app` | **inverted.** `:132` and `:355` are `if (!APP_MODE)` |
| `assert-tsc-baseline` | `--no-http` | **inverted.** `:132 if (NO_HTTP)` prints a SKIP |
| `assert-drawin-timing` | `--save` | records a baseline; emits no judgement |
| `assert-geometry-presets` | `--save` | same |
| `assert-preset-pixels` | `--save` | same |
| `assert-preset-routing` | `--save` | same |
| `assert-view-presets` | `--save` | same |

Two of those groups are worth separating properly, because conflating them is
what produced a list of nine.

**An inverted flag is the opposite defect.** `--no-http` does not hide a
judgement; it *removes* one. The default run of `assert-tsc-baseline` checks both
routes, and the flag is how you ask it not to. Reading `if (NO_HTTP)` as "a
judgement behind a flag" gets the polarity backwards — the bare invocation is
already the fuller one. Same for `assert-export-live --app`: the default arm is
the synthetic page, fully judged, and the flag swaps the subject rather than
unlocking a row.

**A `--save` arm is not a judgement, and running it would destroy one.** These
five re-record the stored reference that the gate's other rows are compared
against. A sweep that ran them could never report a regression, because it would
have just made the regression the new baseline. That is not a slow arm to be
scheduled; it is an arm whose execution deletes the question.

And four gates that were not on the list are:

```
assert-hero-carve.mjs:336        --mutate=blind | --mutate=clock
assert-hero-transition.mjs:1280  --mutate=…
assert-drawin-parity.mjs:170     --expect-pop=<engine>
assert-joint-beading.mjs:688,695 --holdsteady=a,b | --compare=a,b
```

Six gates, sixteen withheld arms (1 + 10 + 2 + 1 + 1 + 1). The pattern-shaped
answer and the read answer overlap on two.

---

## 2. The finding under the finding: they are the controls

Look at what those four added gates actually withhold.

`assert-hero-carve --mutate=blind` runs the comparison against the *same capture
twice* and requires the row to go red — because a comparison that cannot tell two
identical inputs apart is blind. `--mutate=clock` re-runs the curve row against a
synthetic sampler. `assert-hero-transition --mutate=` injects a deliberate defect
and requires **every** named row to fail, not merely one. `assert-drawin-parity
--expect-pop=desk-doodles` requires the known-bad engine to POP, *"or this
instrument is blind"* — its own words.

These are the negative controls. They are the machinery that answers the question
this whole repo is organised around, stated in `docs/README.md`:

> **a script named `assert-` that cannot fail.** Eleven instruments in this repo
> have reported green while measuring nothing.

And explainer 21 §7 already wrote the rule down:

> This repo has caught eleven instruments reporting green while measuring
> nothing, so the gate runs three kinds of control on the **default** invocation,
> never behind a flag.

Three gates put their controls behind a flag anyway, and no sweep passes it. So
the controls have never run in a sweep. A control that has never run cannot show
the instrument is awake — which means the greens above it are worth exactly what
an unrun control is worth.

This is the original defect, recursed. Explainer 27's headline was a gate nobody
runs; this is a gate that runs while the part proving it *can fail* does not.

---

## 3. The meta-gate already knew, and threw it away

`assert-gate-integrity.mjs` channel A asks: *is at least one judgement reachable
on the default invocation?* That question is satisfied by one row.

`assert-hero-dials` emits four model rows bare. A is satisfied, the sweep prints
`gate`, the battery prints `pass`. The browser arm — the panel, the thing the
index advertises — was behind `--live`. **A gate can be partly swept, and partly
reads exactly like fully.**

The complement of A's set was already being computed. `analyse()` has returned

```js
deadEmissions: [...info].flatMap(([owner, s]) =>
  s.emits.filter((e) => e.blocked || !reachable.has(owner)) …
```

since the file was written, and it is read in **one** place: the block headed
`--- why each red row is red ---`, which iterates `rows.filter((r) => !r.verdict.ok)`.
For every gate that *passes* A, its list of withheld judgements is computed on
every single sweep and discarded unread.

So channel J is not a new instrument. It is A's mirror, printed:

```
--- J · judgements behind a flag, against what actually passes that flag ---
  FAIL  assert-hero-dials.mjs      --freeze --live    1 judgement(s) no sweep reaches  (:861)
  FAIL  assert-layer-flicker.mjs   --reduced          4 judgement(s) no sweep reaches  (:1356 :1367 :1382)
  …
```

### Two shapes of withheld arm, and the second is the one that matters

A direct `console.log("PASS …")` under `if (FLAG)` is the easy case. The case that
matters is a **call to an emitting function** under `if (FLAG)` — which is exactly
what `assert-hero-dials` does (`liveArm()` under `if (LIVE)`). A checker that only
looked for direct emissions would have missed the very gate it was written for.

---

## 4. The channel found two false positives in itself first

Both are worth recording, because a meta-gate that cries wolf gets switched off,
and then A, B, C, D, E, F, G and I stop running too — they live in the same file.

**It reported `assert-mode-rims` for a flag that does not exist.** The line is
`assert-mode-rims.mjs:811`:

```js
const corners = HAS_DRAWN_CORNERS.has(key)
```

`collectFalsyFlags` matched CLI flags with `/(^|\.)has$/` — and that pattern
matches **any** `.has(…)`. A Set membership test on a data table was being read as
a command-line flag, so `corners` joined the falsy-flag set and every judgement
under `if (corners)` was scored as unreachable-by-default.

That is a pre-existing defect in channels A and B, not only in J, and it points
the dangerous way: an inflated flag set makes real rows look unreachable, and this
file's entire job is knowing which rows a bare run reaches. Tightened to a bare
`has` identifier; the A/B verdict table was diffed before and after and is
**byte-identical, 0 NOT-A-GATE either way**.

**It reported itself.** `main()` contains both

```js
if (CALIBRATE) { process.exit(calibrate() === 0 ? 0 : 1) }   // the shortcut
failed += calibrate()                                         // …and the real one
```

The flagged call is a shortcut to a path that already runs every sweep. But the
naive fix — "ignore a blocked call to a function that is also called unblocked" —
silently dropped `assert-drawin-parity.mjs:170`, where the blocked call is to
`say`, the row helper used fifty times elsewhere. There, the blocked call **is** a
distinct row.

The distinction is the arguments. `calibrate()` blocked and `calibrate()` unblocked
produce the same rows; `say("…KNOWN-BAD control…")` and `say("…the draw STARTS
near empty…")` do not. Keying on callee **and** argument text keeps both answers
right.

---

## 5. The rows the scoreboards could not read

Removing `--live` was not enough, and finding out why took reading the arm's
output format rather than its logic.

`liveArm()` printed its verdicts like this:

```js
`${r.moved > FLOOR ? "live" : "DEAD"}  ${r.label.padEnd(18)} …`
```

Nothing in this repo reads `live` / `DEAD`. Both battery runners count rows with

```js
/^\s*(?:\*\*\* )?(?:PASS|FAIL)\b/gm
```

and the meta-gate finds judgements with `EMIT_RE = /\bPASS\b|\bFAIL\b/`. So even
with `--live` passed, the browser battery would have printed **`assert-hero-dials
… 4 rows`** — the model rows — and the four real panel judgements would have been
invisible to every scoreboard in the tree. Channel A could not see the arm at all;
the only reason channel J caught this gate is the `--freeze` control's
`console.error("… FAILED TO FAIL.")`, which contains the token by accident.

A judgement nobody's reader can parse is a judgement nobody reads. The rows now
carry `PASS` / `FAIL` and keep their detail verbatim after the token.

**The verdict inverts under the control.** With the panel's dials held inert a
DEAD row is the *correct* answer, so the control's rows are scored the other way
round — otherwise the control succeeding would print four FAILs.

### What the fix is, and why not the other one

Two answers were available: have the runners pass `--live`, or delete the flag.

The flag is deleted. A runner-passed flag only helps people who go through a
runner — anyone typing the gate's own name still gets the model sweep wearing the
panel's name, and this gate's whole history is that its name and its behaviour
disagreed. An arm that always runs cannot drift out of a table, needs no
exemption, and needs nobody to remember it.

The control runs by default too, at the cost of a second Chrome launch, which the
output states rather than hides. `controlFailed` is now in the exit code; it used
to be exit-coupled only on `--live --freeze`, an invocation no sweep ever typed.

The mechanism for the other answer exists anyway, because `assert-layer-flicker`
and friends may need it: `EXTRA_ARGS` in `run-battery.mjs`, **one table, three
readers** — both runners spawn from it, and channel J imports it to check its own
exemptions. `assert-hero-dials` is absent from it, with a comment saying why,
because "why is the headline gate missing from the flag table" is a question the
file should answer itself.

### Measured, before and after

| | before | after |
|---|---|---|
| runtime, bare | **0.3 s** | **25.9 s** |
| Chrome launches | 0 | 2 |
| rows the battery's regex counts | 4 | **13** |
| panel dials actually driven | 0 | 4, all live (58 282 / 13 964 / 2 256 / 76 444 px moved) |
| the frozen-panel control | never ran | runs, 4/4 DEAD as required |

And the fix is exit-coupled, proved by mutation rather than by reading. With the
freeze's init script disabled — the control unable to fire — the bare invocation
goes red:

```
FAIL  CONTROL · Lying elevation -> 25   live (inert panel: DEAD is required)   58282 px changed
FAIL  CONTROL · FAILED TO FAIL. 4 row(s) still reported the render moving while the
      panel's dials were held inert, so the live arm's green means nothing.
NOT SOUND                                                             (exit 1)
```

Reverted, the run is byte-identical to the pre-mutation one and exits 0. Before
this change that same mutant would have exited **0**, because the control was
behind a flag no sweep typed.

---

## 6. The exemption list is the part that keeps the gate alive

A gate with no exemption mechanism gets disabled the first time it is wrong, and
this channel *will* be wrong. `assert-joint-beading`'s `--compare=a,b` grades two
named capture runs against each other and refuses when either directory is absent.
There is no bare invocation of it to have. Failing it forever would teach the next
person to comment channel J out — and the other eight channels with it.

So an entry costs two sentences: **why** the arm is not on the default path, and
**what does** run it. "It is slow" is not a reason; every browser gate is slow and
they all run. The question an entry must answer is why running it would be
*wrong*.

Three properties make the list survive rather than rot:

- **Every entry prints on every run.** A list nobody reads is a list that rots,
  and an exemption that is invisible is indistinguishable from the defect.
- **An entry claiming a runner passes the flag is checked against `EXTRA_ARGS`**,
  never against the sentence in the exemption. An exemption describing a sweep
  that does not happen is this channel's own defect one level up.
- **A stale exemption is itself a failure.** If nothing withheld matches an entry,
  the run goes red. This is how an exemption list kills its gate: the arm is fixed
  or renamed, the entry stays, and the next arm to land under that flag name is
  excused by an argument nobody made about it.

The channel is mutation-tested against a pair. `bad-withheld-arm.mjs` is
deliberately **not** `bad-flag-gated.mjs` — that fixture hides every judgement and
is caught by channel A, so it would prove A's point and not J's. The new one emits
two good rows bare, passes A and B, and hides one arm behind `--live`; J must
catch it. `good-arm-always-runs.mjs` carries `--verbose` and `--label=` and must
be judged **clean**, because a `--label=` selects which stored capture to grade —
that is channels F and I, and a sweep declining to pass one is deliberate.

```
PASS  bad-withheld-arm      passes A and B first (3 reachable row(s)) — otherwise J would be proving A's point, not its own
PASS  bad-withheld-arm      J CAUGHT the arm behind --live — wanted CAUGHT
PASS  good-arm-always-runs  judged CLEAN — --verbose and --label= are not withheld arms
CALIBRATED — 23/23
```

---

## 7. The bar that carried its own counter-evidence

`scripts/verify/assert-export-app.mjs:470` demanded

```js
driveNoise.px === 0,
"REPRODUCIBLE: the same mark exported twice is the same file, pixel for pixel",
```

while a comment eleven lines below it said the residual is *"0–2 pixels of
39,325,440, intermittent… the GPU's own run-to-run rasterisation."* A file
carrying both the bar and the evidence the bar cannot be met produces an
intermittent red — which is worse than a steady one, because a steady red gets
fixed and an intermittent one teaches everyone to ignore the gate.

**First, the gate could not run at all here**, and that is its own finding.
`:44` read `const BASE = "http://localhost:3000"` — one of the 35 port-blind
browser gates explainer 27 §1 measured. With :3000 down it cannot start; with
:3000 *up* it reports on somebody else's tree, in green. It now takes `LAB_URL`
from `lib/dev-server.mjs`, because the rule that closes this is not "add FS_PORT
here" but that a gate must not be able to name its own server.

**Then the question was made answerable in one run instead of by argument.**
"It is rasterisation" was an assertion. Rasterisation jitter lands on
**anti-aliased edges** — pixels halfway between ink and paper, whose coverage the
rasteriser may round either way. A real defect lands on **flat interior**, where
the neighbours agree and no rounding is available to explain it. So every differing
pixel is now classified by the local gradient in the reference frame and the split
is printed with the row. One pixel on flat interior is worth more than a hundred
on an edge.

**And the residual did not reproduce.** The real gate, run end to end 24 times
against this lane's own dev server, on a machine with three sibling lanes live —
10.2 minutes of wall clock, ~25.3 s per run:

```
=== DISTRIBUTION of driveNoise.px over 24 runs ===
  0 px : 24 run(s)
  max 0   mean 0.000
  reds under the `=== 0` bar: 0/24
  differing SUBPIXELS across all runs: 0 on an anti-aliased edge, 0 on FLAT interior
```

Zero, twenty-four times out of twenty-four. **The bar is met, not missed.**

But the sweep did find the number the comment was describing — on a *different
quantity*. `driveStall`, the 0 ms-vs-90 ms arm, is the one with a residual:

```
driveStall.px : 0px×19  4px×1  5px×1  6px×2  7px×1      (bar = max(driveNoise*4, 64) = 64)
```

Five runs of twenty-four, 4–7 px, against a 64 px bar it never came close to.
So the comment's "0–2 pixels of 39,325,440, intermittent" was a real observation
**about the row above the one it was written under**, and it was being used to
explain away a red on the `=== 0` row — a quantity that is 0 every time.

Two rows, two residuals, one sentence covering both, and the sentence had never
been measured. That is the same defect as a window sized in the wrong unit
(`docs/README.md`'s *drift* class): a number that was true of something, attached
to something else, and never re-read.

The bar stays at `=== 0`. It is met on every run of the tree it is pointed at,
and it is the only row that can notice the export becoming nondeterministic.

Moving a number until it passes, on a defect that did not reproduce, would have
been inventing a tolerance for a phenomenon nobody had measured — and it would
have deleted the row. The failure detail now carries the edge/flat split and the
24-run baseline, so if it ever does fire, the next person decides in one run
instead of re-arguing from a comment.

**What it cannot settle** is why Lane C saw 2 px on the canonical tree. That run
was on :3000, on Turbopack, under a different load; this one is on 3107 under
webpack. Not reproduced is not the same as not real — it is stated as what it is.

---

## 8. Six rows, and what each of them was measuring instead

| | what the sweep was measuring instead |
|---|---|
| `assert-hero-dials` | the model of the panel — 0.3 s, no Chrome |
| `assert-hero-carve` | the subject, with its blindness control unrun |
| `assert-hero-transition` | the subject, with its mutation control unrun |
| `assert-drawin-parity` | the subject, with its known-bad control unrun |
| `assert-layer-flicker` | 53 rows bare, with 10 judgements behind `--fusion` / `--reduced` / `--calibrate` |
| `assert-joint-beading` | its default arm — correctly; the pair-comparison has no bare form |

Explainer 27 closed with the observation that the meta-gate proves a gate **can**
fail, the batteries prove a gate **is run**, and neither asks whether it is
pointed at the thing whose name is on it. There is a fourth question, and it is
cheaper than all of them: **when the sweep ran it, how much of it ran?**

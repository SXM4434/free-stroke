# Explainer 33 — A grep cannot tell code from prose

Explainers 27 and 29 are about gates that could not fail. This one is about the
machine that decides **which sweep runs them**, and it is upstream of both: a gate
in the wrong battery is a gate in no sweep, arrived at from a third direction.

`run-battery.mjs` split 94 gates into MODEL and BROWSER like this:

```js
export const isBrowser = (path) =>
  /chromium\.launch|playwright|puppeteer|\/\/ battery: browser/.test(readFileSync(path, "utf8"))
```

It matched the file's **raw text**. So a token inside a string, inside a
negative-control fixture, or inside **a comment explaining the rule** decided
which battery ran the file.

---

## 1. The scar Lane F left in the file she could not fix

`assert-one-knob.mjs` is the gate that says no script in `scripts/verify` may name
its own dev server — written because `dev-server.mjs`'s blacklist of legacy names
had been found short twice, and because *"a grep flags both and the gate is wrong
on day one"* (`:64`). It is, in other words, a gate written from the premise that
text matching is the wrong instrument. Its own header says so:

> So this walks the real syntax tree and reads only string and template literals.

And then this, at `:211`:

> ⚠ **NO FIXTURE, AND NO COMMENT IN THIS FILE, MAY SPELL THE BROWSER-CLASSIFIER
> TOKENS** … It took TWO passes to fix, and the second one is the interesting
> one: the first fix removed the token from the fixture and left it in a comment
> explaining the rule — **and the gate stayed misclassified, because the
> classifier is a grep and a grep cannot tell code from prose.**

The gate needs the tokens in its fixtures, because *"a negative control that does
not contain the known-bad input cannot prove the gate catches it."* It needs them
in its comments, because that is where it explains itself. It got neither. The
landed state was not a fix; it was **a file forbidden from documenting itself**,
with a warning at the top telling the next person to keep it that way.

That cost is the whole finding. Nothing was *wrong* on disk afterwards. The
classifier had simply reached into a gate's source and deleted three identifiers
from its vocabulary.

### Reproducing it, on the real file, without touching it

The fixture set below is synthetic and synthetic fixtures only prove the analyser
agrees with whoever wrote them. So the calibration also reconstructs the real
case: it reads `assert-one-knob.mjs` off disk, puts the token back in each of the
two places Lane F had it, writes the result to a temp directory, and requires the
two classifiers to disagree.

```
PASS  assert-one-knob.mjs AS IT STANDS is MODEL on both classifiers
      — F fixed it by DELETING the token; the two only agree because the file was censored
PASS  assert-one-knob.mjs, pass 1 · token in a FIXTURE STRING
      — OLD grep -> BROWSER (the defect, reproduced) · PARSED -> MODEL
PASS  assert-one-knob.mjs, pass 2 · token in A COMMENT explaining the rule
      — OLD grep -> BROWSER (the defect, reproduced) · PARSED -> MODEL
```

---

## 2. It failed in the other direction too, and that half is worse

A false BROWSER is loud — the model battery refuses the gate and the browser
battery runs it slowly. A false MODEL is silent, and the grep produced one,
because it is **source-local**: it cannot see through a child process.

```
assert-hero-word-legible.mjs:291
  execFileSync("node", [join(__dirname, "_probe-word-ladder.mjs"), …])

_probe-word-ladder.mjs:33
  import { chromium } from "playwright-core"
```

That gate sat in the battery whose header promises *"no browser, no dev server,
seconds each"*, launching Chrome against a hardcoded `:3000`. Lane C and Lane G
each found it as a red row and correctly filed it as a port defect — it is that,
and it is **also a misclassification**, and nobody had said so.

`assert-hero-transition.mjs` has the identical shape. It escaped only by
**declaring itself**, in a comment whose own text names the reason:

> `battery: browser` — NOT decoration … this gate drives one THROUGH A CHILD
> (`verify-hero-transition.mjs`) on its bare invocation, so neither regex could
> see it.

That marker is an honest workaround for a blind instrument. Once the instrument
can see, it is redundant — and the classifier now says so out loud, on every
`--list`:

```
· assert-hero-transition.mjs: REDUNDANT DIRECTIVE `battery: browser` at :129 — the parser
  reaches the same answer without it (spawns verify-hero-transition.mjs (:627) which
  imports playwright-core (:51))
```

All four directives in the tree are redundant. Deleting them is their owners'
call; the point is that none of them is load-bearing any more.

---

## 3. What it asks instead

MODEL unless one of four things is true **of the syntax tree**:

1. **IMPORT** — an `ImportDeclaration`, dynamic `import()`, or `require()` whose
   *specifier node* is a driver (`playwright*`, `puppeteer*`, `@playwright/test`).
   The same nine characters inside a message are not a specifier.
2. **LAUNCH** — a `CallExpression` whose *callee* is
   `<driver>.launch | launchPersistentContext | launchServer | connect | connectOverCDP`.
3. **SPAWN** — a child process handed a repo script that itself classifies
   BROWSER. Followed through one level of local indirection, because
   `assert-param-guards.mjs:88` wraps its `spawnSync` in `run(script)` and a check
   defeated by a helper function is not a check. A script named only in a
   *message* — `assert-hero-transition.mjs:651` prints *"run
   verify-hero-transition.mjs first"* — is not followed: a `console.error` is not
   a spawn and not a call to one.
4. **DIRECTIVE** — a comment line that is exactly `battery: browser|model`.

### Rule 4 is the defect wearing a hat, and the difference is the whole point

**An accidental mention cannot classify. A deliberate directive can.**

A directive is a whole trimmed comment line and nothing else; there may be only
one kind per file; it is printed on every `--list`; and a directive that
**contradicts** the structural answer is a **failure** unless `CLASSIFY_ALLOW`
carries a written reason. That last clause is what stops rule 4 becoming rule 0
again: a marker that has gone stale is silent by construction, which is the
property every defect in explainer 21 shares.

The exemption list is **empty**, and that is a measurement rather than an
omission — every directive in the tree agrees with the parser. The machinery is
proved anyway, because an exemption mechanism nobody has exercised is an
exemption mechanism nobody knows the shape of:
`directive-says-browser.mjs` fails without an entry and is clean with one, and a
planted entry matching nothing fails as `STALE EXEMPTION`.

---

## 4. The bug I put in, and the fixture that now holds it down

The first comment extractor used `ts.createScanner()` in a bare `while (scan())`
loop. It is wrong, and it took a measurement to notice: continuing a template
literal requires `reScanTemplateToken`, which only the parser calls, so the
scanner **desynchronises at the first template with a substitution**.
`assert-hero-transition.mjs:122` is

```js
const arg = (k, d) => { const hit = process.argv.find((a) => a.startsWith(`--${k}=`)) … }
```

and after it the scanner missed that file's `battery: browser` marker at `:129`
entirely. A classifier that silently loses a directive is the grep's defect with a
syntax tree bolted on.

Comment ranges now come off the **parser's** trivia. `url-and-regex-slashes.mjs`
is the control, and it carries all three traps at once:

- `"http://localhost/app"` — a `//` inside a string, which the naive `//.*$`
  stripper eats along with the evidence it was hunting (`assert-one-knob.mjs:66`
  records the same finding about the same class of check);
- `/^https?:\/\/[a-z]+/` — the same shape inside a regex literal;
- a line reading `battery: browser` **inside a template literal**, which a
  raw-text scan honours as a directive and the parser reports as 0.

---

## 5. The partition, asserted rather than assumed

Lane C made the two runners share one classifier because *"a partition maintained
by two independent copies of one rule is a partition that will eventually drop a
gate into neither list with nothing to say so."* Sharing it makes drift impossible
**by construction** — and a property that holds by construction is exactly the
kind nobody notices breaking. So it is checked, on every invocation of either
runner:

```
partition OK — 94 discovered = 43 MODEL + 51 BROWSER, overlap 0
```

`partition()` refuses the sweep if a gate lands in neither list or both, if a file
carries two conflicting directives, if a directive contradicts the parser with no
written exemption, or if an exemption matches nothing. The classifier calibrates
against its fixtures **on every battery run** — 17/17, about half a second — for
the reason `assert-gate-integrity.mjs:1478` gives about itself: *"The sweep
calibrates FIRST, every run."*

---

## 6. The gate that exited 0 against a dead port

Lane F, sweeping 32 gates against a port with nothing on it, found exactly one
that stayed green: `assert-tsc-baseline.mjs`. It printed

```
PASS  the typecheck is EXACTLY the baseline (6) …
PASS  …and they are the same six, in the same two files …
SKIP  / — no dev server on :3199 (ERR TypeError: fetch failed)
SKIP  /desk-doodles — no dev server on :3199 (ERR TypeError: fetch failed)
TSC BASELINE HOLDS                                                     (exit 0)
```

F reported it rather than editing it, which was right twice over: it was not F's
file, and *"it has a good reason" is not the same as "it is right."* The reason is
good — the typecheck really is the subject and the HTTP ping is a second channel
with a **printed** skip.

**And the meta-gate could not catch it.** Channel G exists for precisely this and
fires on a conjunction: the run skipped something, claimed an all-pass summary,
and exited 0. Its summary matcher is

```js
const ALLPASS_RE = /ALL[^\n]*PASS|ASSERTIONS PASS|all checks pass|ALL GATES PASS/
```

and this gate's summary is `TSC BASELINE HOLDS`. Three conditions, one of them
missed by a word — a blacklist of summary phrasings, found short, which is the
same shape as `dev-server.mjs`'s blacklist of knob names being found short twice.

### The ruling: three exit codes

| | |
|---|---|
| **0** | every channel the run set out to judge was judged, and passed |
| **1** | a judgement FAILED — a real failure outranks a partial, always |
| **3** | **PARTIAL** — nothing failed, and something was never reached |

A partial run prints an `UNSWEPT` line per channel naming it *and the command
that would answer it*. `UNSWEPT` is deliberately not a `PASS`/`FAIL` row: both
batteries count those, and an unanswered question is neither.

`--no-http` exits 3 as well. It is the operator withdrawing the question rather
than the environment eating it, and that distinction is real — but a flag that
bought an exit 0 would be a switch for turning a partial run green.

**The runners carry the same ladder** (`red ? 1 : partial ? 3 : 0`). Without it
PARTIAL is a laundering channel: a gate that stopped exiting 1 for "I could not
start" would drop out of the red count and take the whole battery green on a tree
nothing was measured against.

In the runner's own words, same tree, same command, dead port:

```
BEFORE   pass      assert-tsc-baseline.mjs              2 rows  5.5s
AFTER    PARTIAL   assert-tsc-baseline.mjs              2 rows  2.0s
```

and with a dev server actually up, `pass … 4 rows`. Its green is now conditional
on reaching the routes. It was not before.

---

## 7. Eighty-five passing rows, and then it fails

`assert-data-safety.mjs` emits **85 PASS rows before failing** against an
unreachable tree — more than any other gate here, measured by Lane F and
reproduced exactly. Its §1 and §2 grade `lib/` modules in node; §3 drives the live
app. So the entire model half scrolls past in green and `page.goto` throws eighty
six lines later.

This is the inverse of explainer 29 §5. There, `assert-hero-dials`'s live arm
printed `live`/`DEAD` — a format **no scoreboard in this repo can parse** — so four
real verdicts were invisible. Here the rows *are* parsed, and they drown the
verdict.

**In the file:** the reachability check runs before the first row, so the operator
learns on line one rather than line eighty-six; §1 and §2 still run, because they
are free and real; the run ends PARTIAL and **never prints an all-pass summary**,
because "an all-pass summary, exit 0, with a skip in the output" is channel G's
known-bad by name. The crash path — the case the pre-flight cannot catch — now
says how many rows had already printed, because a reader scrolling back cannot
tell a finished run from an abandoned one.

That change turns a red into a partial, which is the exact move this lane exists
not to make, so it is argued rather than assumed: **the old exit 1 came out of
`main().catch(…)`**, and the meta-gate's own channel-B definition says that shape
*"says the script CRASHED, never that the subject failed."* The old red was never
a verdict about the subject.

**In the scoreboard**, and this is the part that generalises: a runner that sums
`PASS` rows across every result, red ones included, prints a number that does not
mean what a reader thinks. Rows are now split by the exit code of the run that
emitted them and never added together:

```
28/43 model gates green, 606 rows on gates that finished clean.
1 PARTIAL — 2 row(s), and a channel each of them could not reach. A SKIP IS NOT A PASS.
14 RED — 11 row(s), of which 6 PASSED before the failure. Those are not evidence:
         the run that printed them did not finish.
```

### …and the same parser was blind in the opposite direction

Lane I measured the other half while this was being written, and it is the same
sentence again: **`\bFAIL\b` does not match `FAILED`.** A control that announces
its refusal in the natural English form is invisible to the scoreboard, and
`assert-hero-transition`'s was visible only because its sentence ends in a full
stop. So one class of row is counted and drowns the verdict, and another class is
not counted and vanishes.

Widening is where this gets interesting, because **the verdict words appear in
three kinds of line and only one of them is a row**:

| | example | counts? |
|---|---|---|
| a channel-prefixed row | `[reduced] FAIL  ascii layer not renderable` — `assert-layer-flicker.mjs:1371` | **yes**, and it did not |
| a summary | `assert-one-knob: 5 PASS · 0 FAIL` — nine gates print this shape | no |
| prose | `REPORTED, NOT FAILED` (`assert-fusion-rail.mjs:221`); `NOT A PASS AND NOT A FAILURE` (this file's own new line) | no |

A blind widening to `\bFAIL\b` counts every summary as rows and every sentence
about failure as a failure — **a grep failing to tell code from prose, at the
scoreboard layer, which is this explainer's title arriving one floor up.**

So the widening is narrow and anchored (an optional `[channel]` prefix, and
`FAILED` as a verdict word, both still at line start), and what cannot be parsed
is **named rather than guessed at**: a short list of *measured* idioms is reported
as `N UNCOUNTED failure announcement(s)`, never converted into a row count,
because nobody can say from outside how many verdicts an English sentence
carries. And a run that announces a failure **while exiting 0** is red — a control
reporting itself blind under a green gate is the lie the whole repo is organised
around.

Replayed old against new over the canonical tree's 48 real browser-battery logs —
real output from a real sweep, not fixtures:

```
48 real logs · rows 1032 -> 1033 · fails 0 -> 0 · announced-uncounted 0
the ONE row that moved: assert-layer-flicker.log  53 -> 54   ([calib] PASS)
```

One recovered row, zero false positives. Twelve known-answer controls hold it
down, each one a real string from a real gate, and four of them exist only to
prove the widening did **not** happen: the summary line, the prose line, this
gate's own `UNSWEPT` line, and the text of the law itself quoted in output.

### One more thing these two files now owe everyone

`assert-gate-integrity.mjs` imports from `run-battery.mjs`. Lane I hit the failure
mode head-on — a current meta-gate against an old runner gives

```
SyntaxError: does not provide an export named 'EXTRA_ARGS'
```

and **a meta-gate that cannot load does not fail a row; it fails to run**, which
every sweep above it reads as nothing to report. That is caused by editing the
runner. So the export contract is now a row: this module's exports are read off
its own syntax tree, every consumer's named imports are read off theirs, and the
second must be a subset of the first.

---

Six gates print passing rows before failing. Measured here against a dead port,
at `file:line`:

| gate | PASS rows before the failure | browser arm |
|---|---|---|
| `assert-hero-word-legible.mjs` | 14 | `:291` — and it was in the MODEL battery |
| `assert-rod-caps.mjs` | 12 | `:87` |
| `assert-elbow.mjs` | 7 | `:241` |
| `assert-fold-census.mjs` | 3 | `:383` |
| `assert-taper-envelope.mjs` | 3 | `:216` |
| `assert-form-orbit.mjs` | *not reproduced here* | `:190` |

`assert-form-orbit` refuses before it ever reaches its browser arm in a lane tree
— `no frames at docs/verification/form-orbit/after`, explainer 27 §4 — so its rows
are real in a tree with the evidence and unmeasured in this one. Said rather than
carried forward.

---

## 8. The headline got worse, and that is the answer

| | before | after (same tree, same dead port) |
|---|---|---|
| model gates | 44 | **43** |
| green | 29 | **28** |
| headline "rows" | **633** | **606** |
| PARTIAL | — | 1 |
| RED | 15 | 14 |
| browser gates not run | 50 | **51** |

Every number that moved, moved because something stopped being counted as
evidence, and the accounting closes exactly:

```
633  =  606 (clean)  +  2 (the partial's rows)  +  11 (rows on red gates)  +  14 (hero-word-legible, now a browser gate)
```

Nothing was fixed to produce this. One gate moved to the battery it belongs in,
one gate stopped calling an unreachable server a pass, and the row total stopped
including rows printed by runs that did not finish.

---

## 9. What this does not close

- **There is a THIRD copy of the partition rule, and it is inside the meta-gate.**
  `assert-gate-integrity.mjs:815` computes `drivesBrowser` with the same raw-text
  regex, and channels D, G and I use it to decide what to skip — so
  `assert-hero-word-legible` was mutated and run bare by the meta-gate as a model
  gate while it drives Chrome through a child. That file is another lane's; the
  fix is a two-line import of `classify` from `run-battery.mjs` (the import edge
  already exists — it imports `EXTRA_ARGS`) and is handed over as a diff rather
  than applied.
- **Channel I does not know about exit 3.** Until it does, a partial run reads as
  a bare red in every lane tree, and that is a false red with a name.
- **Five gates still print passing rows before failing.** The counting no longer
  lies about them; the gates are their owners'.
- The classifier follows a spawned child through **one** level of local
  indirection. A two-hop helper, or a script path assembled at runtime, is not
  followed — no such gate exists today, and if one is written the failure mode is
  a silent MODEL, which is the direction that costs a wrong tree.

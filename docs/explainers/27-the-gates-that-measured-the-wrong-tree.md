# Explainer 27 — The gates that measured the wrong tree

`docs/DISPATCH.md` §3 records a number: on 2026-08-03, **73 of this repo's 81
`assert-*` scripts were in no sweep at all**, and *"a gate nobody runs cannot fail
in practice, whatever the meta-gate says about it in principle."* Two battery
runners were written to close that hole, and they did.

This pass re-measured it. The headline number is now **1 of 89**, which is the
good news and also the least interesting sentence here. The interesting part is
that "in a sweep" turned out to be three different claims wearing one name, and
the repo was only ever measuring the first of them:

1. **Is the FILE reachable by the sweep?** — 88 of 89. One was not.
2. **Does the sweep run the gate's JUDGEMENT, or only its cheapest arm?** — nine
   gates keep a judgement behind a flag no runner passes.
3. **Is the gate pointed at the TREE the operator thinks it is?** — 35 of 48
   browser gates were not, and this is the one that cost the night.

All three are the same defect as the original 73, arrived at from different
directions. A gate in no sweep and a gate swept while aimed at somebody else's
server are both gates that cannot fail in practice.

---

## 1. Thirty-five gates that ignore the knob and talk to :3000

`scripts/verify/lib/dev-server.mjs` exists because this repo once had **three
names for one knob** — `HERO_URL`, `LAB_URL`, `FS_PORT`. Its header states the
failure in plain words:

> *"set the one your muscle memory has and half the battery talks to the shared
> server on :3000 anyway, with no error, and the run is attributed to the wrong
> tree."*

The fix made `FS_PORT` the single name, derived both surfaces from it once, and
made a legacy name **throw** rather than be ignored. It landed in 46 scripts.

**It missed 35 of the 48 browser gates**, which never import the module at all:

```
scripts/verify/assert-shell-states.mjs:46    const URL  = "http://localhost:3000"
scripts/verify/assert-export-app.mjs:44      const BASE = "http://localhost:3000"
scripts/verify/assert-texture-relief.mjs:79  await page.goto("http://localhost:3000", …)
scripts/verify/assert-hero-dead-channels.mjs:133
                                             await page.goto("http://localhost:3000/desk-doodles", …)
```

…and 31 more. The complete list is in `docs/verification/gate-integrity/`.

On the shared checkout this is invisible: `FS_PORT` is unset, the dev server is on
3000, and the hardcoded literal and the derived URL are the same string. **It only
bites when someone runs a battery somewhere else** — which is exactly what an
isolated lane is for. A lane on port 3103 sets `FS_PORT=3103`, runs the browser
battery, gets 48 rows of `pass`, and 35 of those rows are statements about a tree
it never touched.

Worse than a wrong answer: it is a **confidently green** wrong answer, because the
tree it silently measured is the one that was last verified green.

### The proof is a listener, not a grep

A `grep` for `localhost:3000` shows a string. It does not show which socket a
gate opens, and the whole lesson of this file is that reading the source is not
the same as watching the behaviour. So: a nine-line HTTP server that logs every
request it receives, pointed at by `FS_PORT`, and two gates run against it.

Both gates were run with `FS_PORT=3199`, the witness's port:

| gate | imports `dev-server.mjs` | requests seen by the witness |
|---|---|---|
| `assert-carve-graze.mjs` | yes | **2** — `/desk-doodles`, `/favicon.ico` |
| `assert-texture-relief.mjs` | no | **0** |

The silence is the measurement.

**And then the experiment finished itself.** By the time the second gate ran, the
dev server on :3000 had gone away. So `assert-texture-relief.mjs` — pointed at a
live witness by `FS_PORT`, with this lane's own server up and healthy on 3103 —
died like this:

```
page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
    at scripts/verify/assert-texture-relief.mjs:79
```

One hour earlier, in the browser battery, **the same gate printed `pass`, 7 rows,
27.2 s.** Nothing about this lane changed in between. The only thing that changed
is that the tree it had silently been grading stopped answering. A gate whose
verdict flips from green to unrunnable because *somebody else's* server went down
was never measuring your work.

### And there is a fourth name for the knob, still live

`dev-server.mjs` throws on `HERO_URL` and `LAB_URL`. It has never heard of
`FS_URL`, and two gates read it:

```
scripts/verify/assert-still-export.mjs:37   const URL_ = process.env.FS_URL ?? "http://localhost:3000/"
scripts/verify/assert-sweep-release.mjs:35  const URL  = process.env.FS_URL ?? "http://localhost:3000/"
```

The throw was the good half of that fix — it converts a silent
misdirection into a loud one. It only works on the names it knows about, and the
list was written from the three names that had already caused a problem.

**The fix is not "add `FS_URL` to the list."** It is that a gate must not be able
to name its own server: the URL comes from one module or the gate does not get
one. A list of banned names is a blacklist, and this is the second time the
blacklist has been found short.

---

## 2. A gate that is in a sweep while its judgement is not

`run-browser-battery.mjs` says so itself, deliberately:

> *"It does not pass `--label=` to anything. That is deliberate: the bare
> invocation is the one the next person types."*

That is the right call, and it has a consequence nobody had counted. Neither
runner passes **any** flag, so any judgement behind one is in no sweep — the
original finding, at the level of a branch instead of a file. Nine gates have
one. Most are `--save` baseline-recording arms, which is fine. One is not:

```
scripts/verify/assert-hero-dials.mjs:613   const LIVE = process.argv.includes("--live")
scripts/verify/assert-hero-dials.mjs:672   async function liveArm() { … chromium.launch … }
scripts/verify/assert-hero-dials.mjs:842   const { live, FLOOR } = await liveArm()   // under `if (LIVE)`
```

`docs/README.md` advertises this gate as *"every panel control, judged in the
state it is SHOWN in."* In the browser battery it ran in **0.3 seconds, emitted 4
rows, and never opened Chrome.** Its log is the 44-control model table and
nothing else.

So the gate whose entire subject is the real panel sweeps the *model of* the
panel, and the 44 controls in a real browser — the half that needs Chrome, the
half the flag exists for — are run by nothing. It is classified BROWSER (the
classifier greps for `chromium.launch`, which is present), so `run-battery.mjs`
refuses to run it as a model gate, and `run-browser-battery.mjs` runs it without
the flag that makes it a browser gate. **It falls between the two runners while
appearing in both their inventories.**

---

## 3. An inventory scoped to one directory

Both runners discovered gates with `readdirSync(VERIFY)`. So the question "is
every gate swept?" was really "is every gate *in `scripts/verify/`* swept?", and
one gate is not in `scripts/verify/`:

```
docs/storyboard/tools/assert-moment.mjs
```

It is not a stub. It emits PASS/FAIL (`:192`), it is exit-coupled
(`:245 process.exit(sound ? 0 : 1)`), and it carries **four synthetic negative
controls** — a mis-registered layer swap, the same swap offset vertically, a hard
cut to blank frames, and a one-frame blink — because it was written to test a
proposal to *delete a clause from a passing gate*:

> *"a gate that is loosened and never re-tested is a gate that has been deleted."*

Run by hand it exits 0 and prints a seven-subject truth table. It had been
sitting there, correct and unrun, invisible for the most boring possible reason.

**Both runners also restated the discovery and the browser-classification regex
independently** — two copies of one partition rule. The two lists must together
be exactly the set of gates; maintained by two copies, they can drift until a
gate lands in *neither*, and nothing in either output would say so. That is the
parallel-implementation defect this repo names as its most expensive recurring
one, sitting inside the very files whose job is to catch it.

Both are fixed here. `run-battery.mjs` now exports `discover()`, `isBrowser()`
and `rel()`, walks the repo rather than one directory, and guards its own
execution behind `IS_MAIN` so that importing it is not a fork bomb;
`run-browser-battery.mjs` imports all three. Verified as a partition, not
assumed: **88 discovered = 40 model + 48 browser, overlap 0.**

---

## 4. Ten gates blinded by the thing that made the lane cheap

A lane tree is built without `docs/verification/` — 6.7 GB of stored frames that
a lane editing source does not need. It is the right call for disk, and it has a
measurement consequence nobody had written down: **10 of the 39 model gates read
stored evidence, so in a stripped tree they are red on arrival.** Not failing —
*blind*. `assert-stack`, `assert-timing`, `assert-screen-layers`,
`assert-material-craft`, `assert-inflate-fusion`, both `pentip` gates,
`assert-hero-carve`, `assert-stack-anim`, `assert-timing-frames`.

Nine of the ten print `no capture at <path> — run <script> first`. One did not:
`assert-screen-layers.mjs` read its report with a bare
`JSON.parse(readFileSync(...))` and died on an unhandled ENOENT with a Node stack
trace and **zero PASS/FAIL rows**.

That distinction matters more than it looks, because `run-battery.mjs` collapses
both shapes into one line in its red summary — `(no FAIL row — non-zero exit
without one)` — and the operator cannot tell **a missing capture** from **a
subject that failed** without opening the gate by hand. It is the same
distinction `assert-gate-integrity.mjs`'s channel B is built on:

> *"a `.catch(() => exit(1))` explicitly does not count: that says the script
> CRASHED, never that the subject failed."*

A bare ENOENT is that crash, reached by omission instead of by a catch. Fixed:
the gate now refuses with a readable row naming the missing file and the command
that makes it, and **still exits non-zero**, so the meta-gate's channel C —
"a stored-evidence gate must refuse missing evidence" — is answered exactly as
before. No bar moved; the refusal just says what it is.

---

## 5. What the pulse turned out to be

`assert-screen-layers`'s `dit_pulse` row had been carried in the open-defects
list as **rest Δ 1.14–1.21**, attributed to `lib/dither-shader.ts` on the
grounds that the file was *"modified 14:03 on 2026-08-04, before the blank-tail
lane's first edit at 17:25 — not that lane's, unowned."*

Three things were wrong with that, and each one is a different way of trusting a
document over a measurement.

**The month.** `lib/dither-shader.ts` was last modified **2026-07-29 14:03**, six
days before the blank-tail work, not three hours before it. The `lib/` file with
an Aug-4 early-afternoon mtime is `lib/style-system.ts` (13:45). The entire
"therefore unowned" inference rests on a misread date.

**The file.** `grep -ic "pulse|one-shot|reveal|completion" lib/dither-shader.ts`
returns **0**. The file has one time input, used once:

```glsl
fsDCo += vec2(uFsDitDirX, uFsDitDirY) * uFsDitTime;   // lib/dither-shader.ts:236
```

That is the matrix-crawl offset from explainer 02 §5. There is no envelope, no
decay, no one-shot anywhere in it. The pulse envelope is `lib/style-clock.ts:205`
(`PULSE_LIFETIME = 0.09 + 0.55·ln(1/0.04) = 1.8604 s`) and the preset is
`lib/style-system.ts:2349`. The assigned file is not an unlikely home for the
defect; it is **structurally incapable** of holding it.

**The number.** It was a *pre-fix* reading, carried forward into an OPEN list
without being re-measured. The defect was real and it was in the instrument: the
rest window used to be *the last 20 % of frames*, an index fraction, judged
against a lifetime measured in **seconds** at an uncontrolled ~84 ms cadence. It
opened about three frames early, so a mean over three live frames and eight dead
ones came out ≈2.0 against a 0.5 bar, and the row printed *"a one-shot that never
stops"* about a pulse that stops hard.

That is the drift class `docs/README.md` already names — *a window sized in the
wrong unit* — and it was fixed on 2026-08-04 at
`scripts/verify/verify-screen-layers.mjs:626-631`, which derives the window from
the model's own `PULSE_LIFETIME` and the run's measured wall clock and publishes
`restFromIndex` / `restStartsSec` / `pulseLifetimeSec` into the report so the
judge prints what it read. The same-day brief recorded the result — *"`dit_pulse`
DOES stop … now reads Δ 0 over 12 frames"* — and every stored capture since
agrees.

**The open item outlived the fix by three days.** Which is the lesson: a defect
list is a cache, and nothing was invalidating it. The fix updated the code, the
report, and the brief, and did not reach back into the list that had first
recorded the symptom.

### …and re-measuring it nearly produced the same false red a second time

Re-capturing `dit_pulse` in this lane gave **rest Δ 5.931** — worse than the
number in the open item. It would have been very easy, and completely wrong, to
report that as confirmation.

The per-frame deltas say otherwise:

```
…  4.40  5.24  8.78  4.03  12.85  ||  65.24  0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00
                                  ^ rest window opens
```

**The entire statistic is one frame.** `65.241 / 11 = 5.931`, exactly the reported
value, followed by ten consecutive frames of *exactly* 0.00. The pulse stops dead;
one enormous discontinuity sits on the window boundary.

Pulling the two frames either side out of the capture's own mp4 shows what that
discontinuity is. Frame 41: the mark, dithered, correct. Frame 42: **blank paper**
— 140 KB of PNG becomes 17.6 KB, mean luminance pins at 252.171 and never moves
again.

The mark did not vanish. **The capture ran HEADED**:

```js
// scripts/verify/verify-screen-layers.mjs:213
headless: process.env.SL_HEADLESS === "1",
```

The default is a *headed* Chrome. On macOS a headed window that is not in front
gets its rAF throttled and eventually stops compositing — so the "frames" are the
same frame, the motion statistics are noise, and one reframe on a stale
compositor yields a blank. Exactly the failure mode `--use-angle=metal` exists to
prevent, arriving through a different door: **the flag was correct and the
window was not.**

Same command, same tree, `SL_HEADLESS=1`:

```
[layers] motion dit_pulse: meanΔ=3.61  rest=0  (11 frames from index 44, 1.923s after completion)
deltas … 4.20 4.40 5.24 8.78 4.03 12.85 || 0.00 ×11
maxDelta 22.27   (headed: 65.24 — the blank)
```

and the gate:

> `PASS  motion/dit_pulse is a one-shot that ENDS — rest Δ 0 over 11 frame(s)
> from 1.923s after completion, i.e. one full pulse lifetime (1.8604s) later`

So the honest reading of `1.14–1.21` is that it is **the same artefact at a
different window length** — one blank-frame discontinuity divided by however many
frames the rest window happened to hold. It was never a property of the pulse,
and it was certainly never a property of `lib/dither-shader.ts`.

Two things follow. **`verify-screen-layers.mjs:213` should default to headless**,
because every other browser instrument here does and the repo measured the
difference at 121 rAF ticks headless against 120 headed. And more generally:
*a motion number taken headed on an unattended machine is not a measurement.*
The mean is also the wrong statistic for the question — "does it stop" is a claim
about the frames *after* any settling step, and a mean over a window containing
one step cannot distinguish a step from continuous motion. Ten exact zeros are a
much stronger answer than a mean of 5.931 is a denial.

---

## 6. The shape of all five

Every one of these is a gate that could not fail, and none of them is a gate that
was written badly:

| | what it measured instead |
|---|---|
| 35 browser gates | a different tree |
| `assert-hero-dials` | the model of the panel, not the panel |
| `assert-moment` | nothing — nobody ran it |
| 10 stored gates in a lane | nothing — no evidence to grade |
| `dit_pulse` | the tail of the pulse, in the wrong unit |

The meta-gate `assert-gate-integrity.mjs` proves a gate **can** fail. The
batteries prove a gate **is run**. Neither of them asks the third question, which
is the one that keeps turning out to matter: **is it pointed at the thing whose
name is on it?** A green row means "this assertion passed." It has never meant
"this assertion was about your work," and four of the five rows above are green.

The cheapest defence found in this pass is the one that needs no new machinery:
**make the gate unable to choose its own subject.** The thirteen gates that could
not get the tree wrong are the thirteen that do not own their server address —
ten take the whole URL from `dev-server.mjs`, three take only the port and build
the path themselves, which is enough because the port is the knob. Every gate
that was free to write its own string eventually wrote the wrong one.

The corroborating measurement is free and nobody had looked at it: **the dev
server logs its own requests.** Across the whole 48-gate browser battery this
lane's server was asked for `/desk-doodles` 228 times and `/` **six** times — and
all six are accounted for by one manual probe, two `assert-tsc-baseline` runs,
and `assert-fusion-newborn`, which is the only lab-surface gate in the battery
that reads the port. Twenty-one gates whose entire subject is the lab surface —
including `assert-mode-rims`, which printed **189 green rows** — never once
asked this tree for the page they were grading.

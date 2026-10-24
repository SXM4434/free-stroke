# Explainer 44 — The window that outlived its lane, and the flag nobody could overrule

Explainers 27, 28, 33 and 37 are one long argument about a tool that cannot say
which tree it measured. This is the same argument about a different knob, and it
was written the morning after that knob cost Sebs his machine.

At about 09:00 on 2026-08-07 four lanes ran browser gates at once. **The controller
instructed every one of them to run headless.** It was not a suggestion and it was
not ambiguous, and it did not work: fifty files carried `headless: false` in their
own source and the instruction had no way to reach them. Chrome windows surfaced
on his screen every few seconds for a morning. Then the lanes hit a session limit
and died, and left **93 Chrome processes behind — 4h48m old, spawned about 20 s
apart, parented to launchd.** His instruction afterwards was four words: *"make
sure it is enforced."*

The word that matters is **enforced**. "Headless" was a hope — a thing the
controller said, that fifty call sites privately contradicted, with nothing in
between to notice. This is the pass that makes it a property, and the gate that
keeps it one.

⚠ **Every number below was taken by parsing, by fixture, or against a deliberately
fake browser. This lane was forbidden to launch Chrome, and did not.** §7 lists
what that leaves unverified, with the command that would settle it.

---

## 1. The census was scoped by a spelling, for the third time

The controller's brief carried three measured numbers: **198 launchers, 48 with
`headless: false`, and 3 with no `headless` key at all.** Explainer 37 §7 has a row
that says exactly what to do with a number like that — *"a grep `headless: false`
measures the tools that spell the flag that way"* — so the first move was to
re-measure by walking the syntax tree of all 385 `.mjs` under `scripts/verify`,
counting a launch by its **callee** and classifying its `headless` initialiser by
its **AST node kind**.

| | brief | measured by parsing |
|---|---|---|
| files with a browser launch call | 198 | **202** (203 sites) |
| hardcoded `headless: false` | 48 | **50** |
| `headless` COMPUTED | 1 | **1** |
| **no `headless` key at all** | **3** | **0** |
| launches with **no `--use-angle=metal`** | — | **3** |
| launchers that never call `.close()` anywhere | — | **27** |

198→202 and 48→50 are four hours of sibling-lane writes; the trees were re-checked
against canonical and were byte-identical, so the drift is time, not tree.

The interesting row is the one that came back **zero**. Every launch site in the
repo named `headless`; not one relied on Playwright's default. And there *are*
exactly three of something — **three launches carrying no `--use-angle=metal`**
(`_probe-lane-o5-panel.mjs:4`, `_probe-lane-o5-smoke.mjs:3`,
`_probe-lane13-smoke.mjs:9`), which is a strictly worse defect than the one that
was reported, because DISPATCH §3 is unambiguous about it: *"without it Chrome
falls back to SwiftShader, which silently pauses the rAF loop with no error — a
frozen animation and a still one are identical in a screenshot."* All three were
headed, so all three were shipping the worst pair of properties available.

**A number inherited is a number unmeasured**, and the two rows that mattered most
here — the 27 that never close, and the 3 with no GPU flag — were not in any
survey because nobody had asked those questions. The survey was shaped like the
complaint.

---

## 2. One knob, one name, and a third state that is the whole point

`docs/DISPATCH.md` §3:130 is the design brief, one knob over:

> *"One knob, one name: `FS_PORT` … two names for one knob is how a control
> silently stops reaching the thing it names."*

`scripts/verify/lib/browser.mjs` is `dev-server.mjs` for the window. It pins
`channel: "chrome"` and `--use-angle=metal` so a caller cannot remove either, it
throws on five legacy names, and it resolves one knob:

```
FS_HEADED unset   the call site's own request decides, and its DEFAULT is headless
FS_HEADED=1       EVERY browser is headed. A human is watching.
FS_HEADED=0       EVERY browser is HEADLESS — including the call sites that ask
                  to be headed.
```

The third state is the one that answers the morning, and it is worth being exact
about why the other two are not enough. A launcher whose default is headless still
loses to fifty call sites that ask for headed — and they *should* be allowed to
ask, because explainer 37 §6 settled that question and settled it against
flipping:

> *"Lane J then found that 26 of its 83 captures launch headed and deliberately
> changed none of them, on the correct grounds that flipping a tool changes what it
> records."*

So the conversion is **behaviour-preserving**. Every file that was headed still
says `headed: true`, out loud, in one place per file, and not one frame of stored
evidence is restaged. What changed is that the request is now a *request*.
`FS_HEADED=0` overrules all fifty at once, prints which way it resolved and why,
and needs the controller to know exactly one spelling instead of fifty.

That is the unit of done for this lane: **the controller can say "headless" and be
right.** This morning it said it and was wrong fifty times.

Lane R, killed mid-flight the night before, had already written the design down —
and reading a dead lane's parked note is how this one started:

> *"The real fix is one level up and is not a lane's: a shared
> `scripts/verify/lib/launch.mjs` that every capture imports, holding
> `--use-angle=metal` and the headless decision in ONE place, plus an
> `assert-one-knob`-shaped channel that fails any capture naming its own launch
> options. Then a tool that opts out is a red row rather than a window."*

R named its own override `FS_HEADLESS`. That name is now in the launcher's legacy
throw, which is the second-name defect being prevented rather than repeated — if
R's parked work ever lands, an operator setting `FS_HEADLESS` gets an error naming
the replacement instead of silence.

---

## 3. The conversion almost moved 53 browser gates into the model battery

This is the finding worth keeping, because it is a coupling nobody would have
predicted and it would have been silent.

`run-battery.mjs` was rewritten by Lane K to classify MODEL vs BROWSER by
**parsing** — which is the right fix and closes a real defect — and it reads three
structural signals: a driver **module specifier**, a **`<driver>.launch` callee**,
and a spawned browser child. A converted gate has none of them. It imports
`./lib/browser.mjs`, which is not a driver specifier.

So the obvious conversion — `import { launchBrowser } from "./lib/browser.mjs"` —
**re-classifies every browser gate as MODEL.** The model battery advertises "no
browser, no dev server, seconds each" and runs four at a time; it would have taken
53 gates that need a dev server and run them in parallel against nothing. And the
directive escape hatch makes it worse rather than better: a `// battery: browser`
comment that contradicts the parser is a **failure without a `CLASSIFY_ALLOW`
entry**, and a broken partition makes both runners `process.exit(1)` — *"Refusing
to sweep on a broken partition — the lists are what the sweep is ABOUT."* Fifty
written exemptions in another lane's file is not a conversion, it is a hostage
situation.

The resolution is a compromise, and it is recorded rather than hidden. The shared
module exports an object **named `chromium`, with a `.launch()` method**, so the
call sites read exactly as they did and the classifier reaches the same answer it
did before:

```
before   import { chromium } from "playwright-core"
         await chromium.launch({ channel: "chrome", headless: false, args: ["--use-angle=metal"] })
after    import { chromium } from "./lib/browser.mjs"
         await chromium.launch({ headed: true })
```

Verified, because "the partition survived" is exactly the kind of claim that is
believed and never checked:

```
before   partition OK — 96 discovered = 43 MODEL + 53 BROWSER, overlap 0
after    partition OK — 98 discovered = 45 MODEL + 53 BROWSER, overlap 0
         classifier CALIBRATED — 31/31 known answers
```

**53 before, 53 after.** The two extra MODEL gates are this lane's own and a
sibling's.

The cost of the compromise is that `chromium.launch` now means two different
things depending on the import, which is the inverse of the defect this family is
about. It is paid for in exactly one place — **`assert-one-browser.mjs` resolves
the BINDING, never the name** — and the structural fix is handed to
`run-battery.mjs`'s owner as a one-line change: teach the classifier that
importing `lib/browser.mjs` is a browser signal, and the callee coupling can go.
Until then, this paragraph is the reason the export is misleadingly named.

---

## 4. What survives what, measured against a fake browser

A teardown nobody has fired is a teardown nobody knows the shape of. The launcher
closes what it opened on `exit`, `SIGINT`, `SIGTERM`, `SIGHUP`, `uncaughtException`
and `unhandledRejection` — and since this lane could not open a Chrome, the
mechanism was driven in a child process against a **fake browser whose `close()`
writes a flag file**. That is not a compromise; it is a better control than a real
browser, because a fake can prove `close()` was *called* rather than that a process
happened to vanish.

| the child dies by | exit | the browser was closed | registry record left behind |
|---|---|---|---|
| `throw` | 1 | **yes** | no |
| unhandled rejection | 1 | **yes** | no |
| `SIGTERM` | 143 | **yes** | no |
| normal `exit` | 0 | killed, not awaited¹ | no |
| **`kill -9`** | — | **NO** | **YES** |
| *(control)* a child that tracks nothing | 1 | no | — |

¹ `process.on("exit")` cannot await, so the browser pids are `SIGKILL`ed
synchronously instead. The registry record still goes.

The last two rows are the honest ones. **A session limit is a `kill -9`**, and
nothing running inside the dying process gets a turn — not this launcher's
handlers, not Playwright's own. That is why the 93 survived, and it is why an
in-process teardown alone would have been a fix that did not fix the thing that
happened. The row that reads `YES` is not a defect in the launcher; it is the
launcher's last act, and §5 is what reads it.

The control matters as much as the five rows above it: a child that tracks nothing
writes no flag, so the flag file is evidence rather than weather.

---

## 5. The sweep, and the false positive its own first live control caught

`scripts/verify/sweep-browsers.mjs` finds browsers this repo left behind. To find
the 93, the controller had to filter `ps` on `--disable-field-trial-config` — an
internal Playwright flag that is nobody's contract and can change in a patch
release. So attribution is now explicit, on two channels:

1. **A registry record** per launch in the OS temp dir, naming the owner pid, the
   script, the tree and the browser pids. It needs nothing but a filesystem, and a
   record whose owner pid is dead is an orphan by definition. It spans trees on
   purpose — this morning's 93 came from four lanes, and a sweep that could only
   see its own checkout would have found a quarter of them.
2. **A marker switch**, `--fs-browser=<tree>:<ownerPid>:<label>:<n>`, on the
   browser's own command line.

The judgement is a pure function of a `ps` table and a registry, so it can be
driven with fabricated input; there are eleven controls, including a bystander
Chrome that must **not** be swept and a clean machine that must produce nothing.

Then it was planted against a **real** orphan — a detached process carrying the
real marker, reparented to launchd — and the very first live run is the finding:

```
marked browser processes: 2  ·  orphans: 2
  ORPHAN  pid 48501  ppid 92903  owner 999999 GONE   <- WRONG
  ORPHAN  pid 48504  ppid      1  owner 999999 GONE
```

The first row is **the process that planted the orphan**, swept because its own
command line *contained the marker inside a quoted script body*. `markerOf()` was
doing `args.indexOf(MARKER)` — the marker anywhere in the string.

A sweep that kills a process for **mentioning** a string is explainer 28 §4's grep
defect with a `kill -9` on the end of it, and it is the single most expensive
version of it in this repo, because the other instances print a wrong row and this
one ends somebody's work. The marker must now start a whole argv token, the
sweeper excludes itself by name, and both cases are permanent rows in the
self-test. Re-planted:

```
DRY RUN   marked 1 · orphans 1     ORPHAN pid 48939 ppid 1 owner 999999 GONE  free-stroke/PLANTED-ORPHAN
--kill    killed 1 process(es)
AFTER     nothing to sweep.
```

One of 976 processes on the machine, found, killed, clean — with no browser
involved at any point.

**The command that would have saved the morning**, and it is a dry run by
construction:

```bash
node scripts/verify/sweep-browsers.mjs            # names them; kills nothing
node scripts/verify/sweep-browsers.mjs --kill     # kills only the orphans
node scripts/verify/sweep-browsers.mjs --legacy   # ALSO the pre-marker Chromes (heuristic, labelled)
```

`--legacy` is the only channel that could have seen this morning's 93, because
they predate the marker. It is behind a flag and every row it produces is labelled
`legacy-heuristic`, because a heuristic that runs by default is a heuristic that
kills somebody's real browser one morning.

---

## 6. The gate deleted its own exemption on the first run

`assert-one-browser.mjs` has seven channels and the shape is copied wholesale from
`assert-one-knob.mjs`, including both of the lessons that produced it: the
ratchet's baseline lives in `browser-baseline.json` so any lane can `--record`
what it paid down, and `--record` runs **last** and refuses while any non-ratchet
channel is red, because the first version of that elsewhere took a lane's failure
and wrote it down as the new floor.

Two channels are worth explaining rather than listing.

**Channel B resolves the binding, not the name.** After the conversion these two
files contain the identical launch call, and only the import specifier separates a
converted file from an unconverted one:

```js
import { chromium } from "playwright-core"      →  a violation
import { chromium } from "./lib/browser.mjs"    →  the good shape
await chromium.launch(…)                        //  ← identical in both
```

A name-based check scores them the same. This is Lane F's bar, unchanged and
applying without modification to a different knob: ***"reads `FS_PORT` is not the
bar; imports the shared resolver is."***

**Channel C refuses the word `headless` entirely**, in every spelling — property,
shorthand, string key, destructured binding — and `headless: true` fails as loudly
as `false`. A file that privately computes the *right* answer is still a file the
controller cannot overrule. Its headline known-bad is not synthetic: it is the
exact line that was live in `verify-screen-layers.mjs`,

```js
headless: process.env.SL_HEADLESS === "1",
```

which **defaulted to headed, was invisible to every survey of the literal**, was
missing from Lane J's census of 48 and had to be found by reading. The gate's
`--mutate` restores it verbatim, requires channel C and channel D to fire on it,
and — in the same row — asserts that a grep for `headless: false` finds **nothing**
in it. That pair of assertions is the whole argument for parsing, stated as a test
rather than as a paragraph.

And then channel G, which requires every ALLOW entry to carry a written reason
**and to still actually violate something**, went red on the first bare run:

```
FAIL  G · scripts/verify/assert-one-browser.mjs: allowed but no longer violates
          anything — DELETE THIS ENTRY
```

The entry had been copied from `assert-one-knob.mjs`, which genuinely needs one:
its analyser reads **string literals**, and its fixtures are strings spelling
`http://localhost:3000`, so it violates its own channel A by construction. This
analyser reads **property names, import specifiers and `process.env` accesses** —
none of which a fixture string contains. Same family, same reasoning, wrong
conclusion. **An exemption inherited from a sibling gate is an exemption nobody
checked**, and that is precisely how a list stops describing reality. The entry was
deleted; the gate reads 8 PASS · 0 FAIL.

The rest of the list is not padding and is meant to expire: five entries read
`OWNERSHIP, NOT JUDGEMENT`, name the lane holding the file, and end `REMOVE THIS
ENTRY once <lane> lands`.

### Proved twice, and in both directions

Once at the analyser — **24 rows under `--mutate`**, of which five are controls
that must come back clean (a converted file, a file mentioning the flag only in
comments, a file mentioning it only in a string, a child that tracks nothing, and
the launcher itself, which *must* violate A and C or the analyser is blind).

And once end to end, by planting known-bads in a mirror of `scripts/verify` and
requiring the real sweep to go red:

```
MIRROR CLEAN     8 PASS · 0 FAIL   exit 0
PLANTED          4 PASS · 4 FAIL   exit 1   (A, B, C and D all fire)
  --record       REFUSED — 4 channel(s) other than the ratchet are RED. Nothing was written.
PLANTS REMOVED   8 PASS · 0 FAIL   exit 0
```

The middle line is the anti-laundering property, exercised rather than assumed:
the baseline file was unchanged after the refusal.

Finally, the analyser **calibrates itself on every bare run**, not only under
`--mutate` — three `createSourceFile` calls on ~100 bytes each, so there is no
version of it behind a flag. Blinding channel C in a mirror produces
`Refusing to sweep on an uncalibrated analyser` and exit 1, rather than eight green
rows about nothing.

---

## 7. What is not verified, and the one command that would settle it

**The marker switch has never been on a real Chrome.** Chromium's command-line
parser collects unknown switches and never queries them, so `--fs-browser=…` is
expected to survive onto the process's command line — but *expected* is not
*measured*, and this lane was forbidden to launch a browser. If it turns out
Chrome strips it, the registry channel carries the sweep alone, which is why there
are two. The confirmation is one command, on a machine nobody is working on:

```bash
FS_HEADED=0 node -e 'import("./scripts/verify/lib/browser.mjs").then(async m => {
  const b = await m.chromium.launch({ label: "marker-check" })
  console.log(require("child_process").execFileSync("ps",["-axww","-o","command="],{encoding:"utf8"})
    .split("\n").filter(l => l.includes("--fs-browser=")).length, "process(es) carry the marker")
  await b.close() })'
```

Likewise **not one of the 191 converted files has been run against a browser.**
What *is* verified is stronger than a spot check and weaker than a sweep: all 386
`.mjs` parse (`node --check`, 386/386), `tsc --noEmit` sits at the known baseline
of **6**, the model battery's RED set is **identical before and after the codemod
except for one gate that turned green**, and the browser partition is unchanged at
53. The 53 browser gates need `pnpm dev` and a machine Sebs is not using:

```bash
node scripts/verify/run-browser-battery.mjs        # and it should be run with FS_HEADED=0
```

---

## 8. The shape of it

| what was measured | what it turned out to measure instead |
|---|---|
| `grep 'headless: false'` | the tools that spell the flag that way — not the one that computed it |
| "does the launcher default to headless?" | the half of the contract that is not the override |
| a teardown on exit and signals | the deaths that are not `kill -9`, which is the one that happened |
| a marker anywhere in a command line | the processes that *mention* it, including the one doing the sweeping |
| an exemption copied from a sibling gate | that gate's analyser, not this one's |

Every row is explainer 28 §6's sentence again — *an instrument scoped by a
description of the problem, rather than by the problem* — and the row that
generalises furthest is the fourth, because it is the first one in this family
where being wrong costs a process instead of a verdict.

The defence is the same one both 27 and 37 arrive at from opposite ends: **deny
the tool the ability to choose its own subject.** A URL it cannot name, a path it
cannot write down, a baseline it cannot raise — and now a window it cannot open,
and cannot insist on.

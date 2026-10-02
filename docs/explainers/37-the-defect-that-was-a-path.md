# Explainer 37 — The defect that was a path, and the ratchet that laundered

Explainers 27, 28 and 33 are about a tool that cannot say which tree it measured.
Each one closes the question from a different direction and each one, on the way,
finds the previous instrument scoped by a description of the problem rather than
by the problem. This is the fourth pass, and it holds to form: **the two defects
it fixes were structurally invisible to the gate written to catch their family,
and the gate's own ratchet turned out to launder as readily as it ratcheted.**

The one-sentence version, from Lane J, who found it and could not fix it:

> *"`assert-one-knob` cannot see this: **the defect is a PATH, not a URL.**"*

---

## 1. Eight sites the survey could never have counted

`assert-one-knob.mjs` walks the syntax tree and reads **string and template
literals**. That was a deliberate, well-argued choice — explainer 28 §4 records
why a grep is wrong on day one here, and it is right. But a scope is also a
blind spot, and this one had two.

```
path   verify-stack.mjs:17           docs/verification/stack-v1
path   _probe-drawin-film.mjs:15     docs/verification/drawin-vanish/play-after
path   _diag.mjs:5                   docs/verification/style-craft/diag
path   _diag-fade-direction.mjs:20   docs/verification/stack-anim-v1
path   _probe-lane-patch.mjs:14      (the shared checkout itself)
path   assert-texture-motion.mjs:18  docs/verification/texture-motion
path   assert-texture-motion.mjs:32  lib/style-system.ts   <- an INPUT
regex  _probe-root-wedge.mjs:146     a dev server inside /\(http:\/\/…/

TOTAL 8 sites across 7 files — against the 92 the survey could see, +8.7%
```

Eight is a small number and it is the wrong statistic. **Two of these eight are
worse than any of the ninety-two**, and the reason is what a URL defect can and
cannot do.

A tool pointed at the wrong **server** photographs the wrong tree and files the
picture under your label. Bad, recoverable: the frame is wrong, and a wrong frame
can be re-graded. A tool pointed at the wrong **path** does two things a URL
never can.

**It can delete.** `_probe-drawin-film.mjs` named the canonical checkout's
`play-after` directory absolutely, and the next line `rmSync`'d it. So a lane
running that capture on its own port did not merely file wrong evidence in the
shared checkout — **it destroyed the shared checkout's stored evidence first.**
That asymmetry is the whole finding: a wrong frame can be re-graded, a deleted one
cannot.

**And it can be an INPUT.** This is the one nobody had named, and it is the
sharper of the two.

---

## 2. The gate that graded the wrong tree's *source*

`assert-texture-motion.mjs` measures whether every texture animation is
noticeable. Its own header explains, at length and correctly, why its matrix must
not be a hand-written list:

> *"`PATTERNS` was twelve string literals. `TextureMode` declares THIRTEEN
> non-`none` members, and the one the list left out — `procedural` — is the first
> entry in the type. A hand-copied list is exactly the rot this file exists to
> catch one level down: a mode nobody enumerated is a mode whose animation nobody
> has ever measured, and it reads identically to a mode that passed."*

The fix was to derive both axes from the type. The derivation read:

```js
const SRC = readFileSync("/Users/…/free-stroke/lib/style-system.ts", "utf8")
```

So the gate stopped restating the matrix and started reading it **from one
specific checkout, whichever tree it was run in.** A lane that added, renamed or
removed a texture mode in its own tree got a green matrix over the *shared*
tree's mode list — and the rows would still be headed with the right pattern
names, because the names came from the same file. The header's own sentence
applies to its own fix: an absolutely-pathed list *reads identically to the
caller's list*. It is the same lie, sourced one directory further out.

**Re-pointing a tool's URL fixes which tree it reads over HTTP. It says nothing
about which tree it reads off disk, and nothing at all about which tree it
writes to.**

Measured, because the number is the argument: **23 gates read
`lib/style-system.ts`.** Exactly one of them read it by absolute path. That one
was the gate whose entire subject is a list held in that file.

### Did it actually mis-grade anything?

No — and the answer had to be measured rather than assumed. Lane A held
`lib/style-system.ts` on the night this was found, and its tree
(`scratchpad/lane-fusion`) is a real separate checkout whose copy of that file
differs from canonical by 21 lines. If any of those 21 lines had touched a
texture union, every `assert-texture-motion` row taken in that tree would have
been about canonical's list.

```
TextureMode       LANE-A (13) == CANONICAL (13)   procedural, grain, noise, scanlines,
                                                  bands, contour, crosshatch, dots,
                                                  woodgrain, cellular, brushed,
                                                  craquelure, ripple
TextureDirection  LANE-A  (3) == CANONICAL  (3)   horizontal, vertical, diagonal
diff hunks touching either union: 0
```

The matrix is the same set either way, so no result was mis-scoped **in fact**.
It was mis-scoped **in principle**, continuously, and the difference between
those two is one edit to a type nobody would have thought to check.

That is the honest shape of most of this family. Nothing was wrong on disk. The
gate had simply been given the ability to choose its own subject, and explainer
27 §6 already said what to do about that: *"make the gate unable to choose its
own subject."* This is that sentence applied to `readFileSync`.

---

## 3. What the two new channels can see, and why they parse

**Channel F — a string or template literal naming a checkout by absolute path.**
**Channel G — a dev-server address inside a `RegularExpressionLiteral`.**

G is the smaller and more obviously correct of the two. `_probe-root-wedge.mjs`
stripped an origin off stack-trace lines with

```js
l.trim().replace(/\(http:\/\/localhost:3000/, "(")
```

which is a hardcoded dev server by any reading, and was invisible because a
regex literal is not a string literal. The analyser now unescapes the pattern, so
`\/` reads as `/`; and a pattern built around a derived port — `localhost:\d+` —
unescapes to `localhost:d+` and correctly does **not** match, exactly as
`localhost:${PORT}` does not. The port is the knob. **463 RegExp literals across
127 of the 380 files under `scripts/verify` were outside the analyser's reach
until this pass.**

F has to parse for a reason that is almost funny: `assert-gate-integrity.mjs:1502`
discusses this exact defect class **in a comment that spells an absolute path**. A
grep-based F is red on day one, on a file that is not violating anything, and gets
switched off on day two. That is explainer 28 §4's finding about URLs holding
without modification for paths — *a comment is source text too* — and the file is
now a **real in-tree negative control**, supplied by the repo instead of invented
for the test.

### The anchor, and the mutant that caught it

F's first rule anchored on `^/`. A template expression is reconstructed with `${}`
standing in for each substitution, so

```js
`${process.env.HOME}/Projects/free-stroke/docs/verification/x`
```

reconstructs as `${}/Projects/free-stroke/docs/verification/x` — the identical
defect wearing a variable — and the anchored rule read **0 hits** on it. The
mutant written to prove F catches an interpolated path is the only reason that is
not still true. The anchor now admits one optional leading placeholder, and still
refuses a genuinely derived path (`` `${ROOT}/docs/verification/${label}` ``) and
a file merely *named* for the repo (`` `${OUT}/free-stroke.png` `` — the segment
must be followed by `/` or end).

Both channels are then proved twice: once at the analyser, and once end to end,
by planting a known-bad of each class in a mirror of `scripts/verify` and
requiring the real sweep to go red.

```
MIRROR CLEAN            7 PASS · 0 FAIL   exit 0
PLANTED                 2 PASS · 5 FAIL   exit 1   (A, B, D, F and G all fire)
PLANTS REMOVED          7 PASS · 0 FAIL   exit 0
```

---

## 4. The ratchet was welded shut in one direction and leaky in the other

This is the part worth keeping, because it is a defect in the *shape* of a gate
rather than in a line of it.

`assert-one-knob`'s channel D is a ratchet: the count of hardcoded sites in
non-gate tools may fall, never rise. The baseline lived in
`const NON_GATE_DEBT_BASELINE = 92`, **in the file that reads it.**

Then Lane J converted 85 sites and could not record the gain, because lowering
the number meant editing a gate it did not own, and two live lanes may never hold
the same file. Its note is the finding:

> *"the ratchet's baseline is a private constant in the file that reads it, so a
> lane that pays debt down cannot record the gain."*

The gate itself prints the instruction — *"it FELL by 85; lower
`NON_GATE_DEBT_BASELINE` to 7 to hold the ground"* — to a reader who is
structurally unable to follow it. **A ratchet only its author can lower is not a
gate, it is a debt counter**, and it drifts upward from reality until nobody
believes it, which is the same failure as a stale exemption one level up.

So the baselines moved out to `scripts/verify/one-knob-baseline.json`, and any
lane can run `--record`. **No gate is edited; a data file is.**

### And then the paydown path turned out to be a laundry

`--record` refuses to raise a count. That felt sufficient. It was not, and the
planted known-bads are what said so: with two fresh absolute paths planted, the
sweep went **red on A, B and G** — and `--record` **still wrote `absPathSites: 2`**,
because 2 was below the 7 it was being compared against.

Read slowly, that is a mechanism which takes a lane's *failure* and writes it down
as the new floor. Every later run then compares against a number that was never
green. It is explainer 28 §4's own sentence — *"the ratchet sat green while the
debt grew"* — reappearing inside the machinery built from it, which by now is less
a coincidence than a property of the genre.

Two things come out of it.

**`--record` runs last, and refuses while any non-ratchet channel is red.**

```
REFUSED — 3 channel(s) other than the ratchets are RED. Nothing was written.
  Recording a baseline during a red run grandfathers whatever made it red.
```

**And headroom is free violations.** While a ratchet sits above the true count, a
new violation costs nothing. That is inherent — it is what grandfathering *means* —
and it reframes why J's blocker mattered. It was never about a tidy number: **85
sites of headroom is 85 free violations**, sitting open for as long as nobody with
write access to the gate happened to look. Recording promptly is the mitigation,
and the effect is directly measurable:

| | plants in a mirror |
|---|---|
| baseline stale at 92 / 7 | D and F **green** — the plants are absorbed |
| baseline recorded at 6 / 0 | D and F **red** — `a NEW absolute path was added` |

Nothing about the plants changed between those two rows.

---

## 5. Three of the four exemptions expired, on schedule

Channel E requires every ALLOW entry to carry a written reason **and to still
actually violate something**. Four of the five entries read `OWNERSHIP, NOT
JUDGEMENT`, named the lane holding the file, and ended `REMOVE THIS ENTRY once
<lane> lands`. Explainer 28 §4 predicted their fate exactly: *"They are meant to
expire, and channel E is what notices when they have."*

Lanes A and G landed. Channel E went red on `assert-fusion-ui.mjs`,
`assert-fusion-authoring.mjs` and `assert-export-app.mjs` — *allowed but no longer
violates anything* — and stayed red until they were deleted. That is the first
real test of the mechanism and it passed it. Verified before deleting rather than
assumed: all three now import the shared resolver and none names a server.

The remaining two exemptions are the resolver itself and this gate, and both are
structural rather than temporary.

---

## 6. The headed captures, measured rather than flipped

Explainer 27 §5 is the reason anybody cares about a headless flag here. A rest-Δ
of **5.931** turned out to be one frame of eleven, and that frame was blank paper:
*"140 KB of PNG becomes 17.6 KB, mean luminance pins at 252.171 and never moves
again."* The cause was a headed Chrome, backgrounded, throttled by macOS until it
stopped compositing. Lane J then found that **26 of its 83 captures launch
headed** and deliberately changed none of them, on the correct grounds that
flipping a tool changes what it records.

The census is itself scoped by a spelling, which by now should be predictable:

```
headed launchers under scripts/verify (literal `headless: false`)   48 files
  capture tools (_probe-* / verify-*)                               27
  assert-* GATES                                                    14
  other tools                                                        7
…and one the grep cannot see:
  verify-screen-layers.mjs:220   headless: process.env.SL_HEADLESS === "1"
```

That last file **defaults to headed**, is invisible to every `headless: false`
survey, and **is the one file where the blank was actually observed.** So the
headed capture population is 28, not 26, and the headed population overall is 49.

**And fourteen of them are gates**, which an 83-capture-tool scope could not have
counted. That is the sharper half of the exposure: a capture that records a
throttled frame produces bad evidence; a **gate** that reads a throttled motion
statistic prints a **verdict**.

### It did not reproduce

Three 8-second arms and two 180-second arms, on the real lab surface with a real
animated texture, at 1440×1440 with `--use-angle=metal`, never brought to front:

```
8 s     headless-A  rAF/s 125.2 · flat 0/16 · frozen 0/15
        headless-B  rAF/s 125.0 · flat 0/16 · frozen 0/15
        headed      rAF/s 124.8 · flat 0/16 · frozen 0/15

  headless-A vs headless-B   mean|Δ| median 0.065   <- the noise floor
  headless-A vs headed       mean|Δ| median 0.050

180 s   headless    rAF/s 118.8–120.5 · first frozen frame NONE · first rAF<30/s NONE
        headed      rAF/s 118.6–120.5 · first frozen frame NONE · first rAF<30/s NONE
```

The headed-vs-headless difference is **smaller than the headless-vs-headless noise
floor.** And on the exact tool where the blank was seen — run both ways using the
switch it already has, so nothing was edited — 0 of 56 frames in either arm sat at
paper luminance, and where the two arms differ, headed is marginally healthier.

**The first version of that probe measured nothing**, and its own control is what
said so: Δ was exactly 0.000 on every frame of all three arms, *including
headless*, because there was no mark on the page for the texture to animate. Read
carelessly that is "headed is fine". A control that comes back clean means the
instrument is blind, and this one was.

This does not overturn explainer 27 §5. The blank there is real and is in the
frames. It says the trigger is not "headed + unattended + long" on its own. Two
variables could not be held: machine state — the contract records that the earlier
janky-frame numbers were taken on a machine over 95 % disk and *"could not
separate a code defect from the environment"*, where this pass ran at 4 % — and
genuine window occlusion, which macOS throttles and which cannot be produced
without taking over the machine's screen.

So the recommendation is to flip nothing, and to **refuse the frame rather than
the window**: a blank/frozen guard on the capture path fails whether or not the
throttle reproduces, restages no stored evidence, and would have caught the
original defect at the time. Whether to flip `verify-screen-layers.mjs:220` — the
one flip with a real argument behind it — restages evidence that
`assert-screen-layers` grades, and is therefore not a lane's call.

Explainer 35 is this question from the other side and the two belong together.
There, `apiGrab` resolved its target with `querySelector("canvas")` — first in
document order — on a page carrying two canvases whose containers have
byte-identical class lists, so the harness silently photographed a different
**subject**. Here the question was whether it silently records a **blank** one.
Different failure, one sentence: *the instrument was not looking at what its name
says.* Both arms above ran after that fix and both used the same grab, which is
weak corroboration that the target is now stable — and a reminder that a capture
has at least three ways to be about the wrong thing: the wrong tree, the wrong
element, and the wrong moment.

---

## 7. The shape of it

| what was measured | what it turned out to measure instead |
|---|---|
| a URL in a string literal | the violations spelled as strings |
| `grep 'headless: false'` | the tools that spell the flag that way |
| a ratchet its author can lower | debt, once its author stops looking |
| a ratchet checked before the sweep | a floor, including whatever is currently broken |
| a capture's URL | which tree it READ over HTTP, and nothing else |

Every row is explainer 28 §6's sentence again — *an instrument scoped by a
description of the problem, rather than by the problem* — and the row that
generalises furthest is the last one. Lane F measured "a gate reaches its tree
through a capture tool" at n=1 from the gates' end. Lane J measured it at **28 of
96** from the tools' end and wrote the line worth keeping: **n=1 was an artefact
of the viewing angle.**

Adding paths and RegExps to the survey moves that angle again, by 8 sites and 463
newly-parsed literals. It will not be the last move. The defence that keeps
working is not a longer list of shapes to look for — it is the one both explainer
27 and this file arrive at from opposite ends: **deny the tool the ability to
choose its own subject.** A URL it cannot name, a path it cannot write down, and a
baseline it cannot raise.

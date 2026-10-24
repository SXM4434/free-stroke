# 46 — The gate that watched seven files

Explainer 43 stated the shape and closed with a sentence that reads, now, like a
prediction:

> *"This file is the shape, stated once, so the **eighth** is recognised on
> sight."*

This is the eighth, and it is the one where the claim is most literally a claim:

> **A citation says "the evidence is at this line." `assert-citations.mjs` exists
> to check that. Its `SCAN` list was seven files, and the source tree has 123.**

Lane X found four rotted citations in `lib/flat-ink.ts` — one of them lane T's
own, rotted *by the same edit that wrote it*: T inserted 25 comment lines above
the clause it was citing, so `:848` became `:880` while the sentence describing
it was being typed. Then X found why nothing caught them, and wrote it down
(explainer 42 §4):

> *"`assert-citations.mjs` exists precisely to catch this and would have caught
> all of it — but its `SCAN` list is seven engine modules, and `lib/flat-ink.ts`
> is not one of them, **despite the gate's own header naming it** as a file whose
> citations move."*

---

## 1. The number nobody had

| | |
|---|---:|
| citations in the application source tree | **1 159** |
| **ROTTED** — the line no longer holds the claim, or the file is gone | **44** |
| … pointing at a **stale line** | 27 |
| … naming a **missing file** | 17 |
| drift (inside one screen — a reader still lands right) | 36 |
| ungradeable (no anchor, or the path names two files) | 44 |
| exact | 860 |

And the coverage it replaces, which is the finding:

| | before | after |
|---|---:|---:|
| files scanned | 7 | **123** |
| `:line` citations in scope | 14 | **144** |
| **share of its own subject the gate watched** | **9.7 %** | **100 %** |

Ninety percent of the thing the gate is named after was outside it.

### Rot by file

```
 9  components/viewport-3d.tsx      2  app/page.tsx
 5  lib/pen-kinematics.ts           2  lib/dd-engine/deskRenderMode.ts
 5  lib/style-system.ts             2  lib/stroke-schedule.ts
 4  lib/hero-motion.ts              2  lib/wobble-field.ts
 4  lib/style-fusion.ts             1  ×6 (page.tsx, style-panel-scaffold,
 3  lib/dd-engine/handFeel.ts          coverage, strokeTo3d, storage, undo-stack)
```

---

## 2. The criterion, and why it is a scope rather than a list

A hand-list produced the hole, so it is not replaced with a longer hand-list.

> **Every `.ts` / `.tsx` file under `app/`, `components/`, `hooks/`, `lib/`.**

Found by walking, so a new module is picked up **with no edit to the gate** —
`docs/README.md:311`'s promise for gates (*"Add a new `assert-*` and it will be
checked automatically"*) applied to their subject.

There is deliberately **no size or citation-count threshold.** "Files over N
lines" was available and is worse twice over: a threshold is a place for a file
to hide by losing a citation, and it would have excluded `lib/hand-feel.ts` —
**237 lines carrying 19 `:line` citations, more than the entire previous SCAN.**

---

## 3. Five invented defects, found inside the instrument while widening it

This is the part worth carrying. The gate's own header already says an instrument
that invents defects is worse than one that misses them. Widening it surfaced
**five** ways it was doing exactly that — every one of them silent while `SCAN`
was seven files, because seven hand-picked files avoided all five.

**1 · The regex fix that was half a fix.** The header records a phantom-file bug
fixed by ordering `tsx` before `ts`. It had no *trailing* boundary, so
`package.json` was read as the file `package.js`, `tsconfig.json` as
`tsconfig.js`, `logo-strokes.json` as `logo-strokes.js` — **seven phantom missing
files, the same class the sentence above them calls fixed**, surviving in the
half nobody re-read.

**2 · The resolver was the same defect one layer down.** `SEARCH_DIRS` was an
eleven-entry hand-list of directories a bare filename "can mean".
`compose.ORIGINAL-FLIP.mjs` (6 citations) and `motion.mjs` (3) resolved nowhere
because `docs/reference-original/` and `scripts/capture/` were not on it. **Nine
citations reported missing against files that are on disk.** It indexes the tree
now, and an ordered list's real cost is that it answers an ambiguous name with
its first hit — silently.

**3 · `./foo.ts` was rewritten to `lib/foo.ts`, unconditionally.** Correct while
every scanned file lived in `lib/`; wrong the moment SCAN reached `components/`
and `app/`. A relative path resolved against the wrong directory is the citation
defect this gate exists to catch, committed by the gate.

**4 · The evidence tree shadowed the source tree.**
`docs/verification/unfinished-lane-T/lib/flat-ink.ts` is a dead lane's snapshot.
Indexing it made a bare `flat-ink.ts` ambiguous, and `flat-ink.ts`, `page.tsx`,
`viewport-3d.tsx`, `style-fusion.ts` and four gate names came back as **missing
files because there were two of each.** Live paths now win over snapshots.

**5 · A citation wrapped across two comment lines was read as its tail.**

```
`docs/research/competitive-landscape-and-the-      ->  missing-export.md
 missing-export.md`
(RUNNING-TODO-ARCHIVE                              ->  -pre-2026-06-19.md
 -pre-2026-06-19.md:111)
```

All three name real files; all three read as MISSING. `quality.md` is the
dangerous one — it looks exactly like a file somebody deleted. DISPATCH's trap is
the instruction: *a grep cannot tell code from prose — parse.*

> ⚠ **And the obvious fix was wrong, which is why it is a pre-pass.** Joining
> line *i* to line *i+1* and then scanning *i+1* again counts every citation on a
> continuation line **twice** — measured, 1157 → 1187, an instrument inflating
> its own subject. The continuation token is **moved**, not copied.

**None of the five was a judgement error.** Each is the gate doing precisely what
it said, on a subject it had chosen for itself — 43 §2 exactly: *"can this
instrument choose its own subject?"*

---

## 4. What was NOT softened

The temptation in a widening pass is to make the number small. Named, so it can
be checked: the drift window is **still 40**; the anchor match is **unchanged**;
no file is exempt from the scan; and every one of the five fixes above **removes
a false positive**, never a true one. The rot count went 1 → 44 and stayed there.

Two mechanisms absorb the volume instead, and **neither is new** — a third
implementation of one idea is this repo's most expensive recurring defect.

**The ratchet is Lane O's** (`assert-one-knob.mjs` + `one-knob-baseline.json`),
including both halves that were learned the hard way:

- **the ground lives in a data file, not a private const** — Lane J paid 85 sites
  down and *could not record it*, because lowering the number meant editing a
  gate it did not own. Every lane is in that position here: the rot is in
  `viewport-3d.tsx` and `style-system.ts`. Any lane that fixes one runs
  `--record` and holds the ground, owning nothing.
- **`--record` refuses while any non-ratchet channel is red**, and refuses any
  rise. O's first version ran *before* the sweep and wrote a red run's numbers
  down because it had headroom.

**The exemption list is Lane F's shape and explainer 34 §3's argument.** No
analyser can tell `assert-hero-letters.mjs` — a false claim that a gate exists —
from `rough.js` in *"no DOM, no rough.js, no deps"*, because the difference is
whether the author was citing something. So the ruling is human, written, and
**printed every run**; the machine owns only that it cannot rot silently. Twelve
rulings cover 24 mentions. A ruled token that becomes **resolvable** fails; a
ruling nothing cites any more fails.

### `--recite`, and the distinction that is the whole design

Lane L's mechanism, and L's warning kept verbatim — *"LOOK at each move before
trusting it."* A target that **moved** is mechanical. A target whose token is
**gone** is a claim that has become false, and re-pointing it at a nearby line
would launder a lie. Run on this tree: **58 moves offered, 4 refused, exit 2.**

One deliberate deviation, stated because a silent deviation from a proven
mechanism is how a third implementation gets born: L's `--recite` wrote a JSON
manifest L owned; these citations live in source files **other live lanes hold**,
so the default is a dry run and `--write` applies. The refusal is not weakened —
`gone` refuses in both modes, before anything is written.

---

## 5. The rot, routed rather than fixed

**This lane fixed none of it, on purpose.** A rotted citation reported is a
finding; one fixed inside another lane's file is a collision. The gate plus the
list is the deliverable.

**`viewport-3d.tsx` moved from 14 606 to 14 895 lines under a live lane while
this was being measured** — which is the whole argument for the ratchet in one
sentence, and every number here is on the 14 895 version.

Sample, with what each claims and what is actually there:

| citation | claims | actually |
|---|---|---|
| `app/page.tsx:349` → `lib/geometry-engines.ts:963` | `materialPreset` | `:1070` |
| `app/page.tsx:1033` → `components/viewport-3d.tsx:5367` | `ViewportErrorBoundary` | `:18` |
| `components/viewport-3d.tsx:296` → `lib/style-fusion.ts:768` | `if (fz.sweep)` | `:1694` |
| `lib/pen-kinematics.ts:41` → `app/desk-doodles/page.tsx:110` | `pressure: 0.6` | **NOWHERE — gone, a human call** |
| `lib/style-fusion.ts:422` → `lib/texture-shader.ts:453` | — | moved |

The 17 missing-file citations split cleanly, and the first group is a **known,
documented class**: `assert-hero-letters.mjs` (×3) is named in `docs/README.md`
as *"cited from three call sites and never written."* Beside it,
`_probe-fusion-coverage.mjs` (×3), `assert-pen-kinematics.mjs`,
`_probe-tipfield.mjs`, `_probe-fusion-builtin-sleep.mjs`,
`_probe-fusion-animates.mjs`, `assert-preset-families.mjs` — **eleven citations
to instruments that do not exist.** The rest are Desk Doodles docs that have
since left that checkout.

---

## 6. The gap that is still open, measured rather than waved at

The criterion is the **application source tree**. `scripts/` is not in it, and
that is a real hole with a number:

> **333 `.mjs` files under `scripts/`, 1 711 citations, 169 carrying a `:line`
> — more `:line` citations than the entire source tree.**

It is where `run-battery.mjs:177` lived: a citation to
`assert-hero-k7-intact:379 "…FAILED TO FAIL…"` — **a string at no line of that
gate**, `:379` being a blank `*` in a comment. Lane X found it by hand. The gate
built here would not have found it either.

It was **corrected rather than deleted**, because the block's own claim is *"every
one of these is a real string from a real gate"* and the idiom is real — four
gates emit it. The replacement was chosen by opening the line:
`assert-hero-dials.mjs:925`.

Sweeping `scripts/` is the obvious next pass and it is **not** a copy of this one:
that tree is full of gates whose headers quote deliberately-bad citations as
fixtures — **this file's own header cites `docs/explainers/08-implicit-fusion.md`,
a file that has never existed, while explaining that it never existed.** A gate
pointed at that corpus grades prose about defects as defects. It needs the
ruling mechanism from §4 doing most of the work, and it should be dispatched
knowing that.

---

## 7. The shape

| | |
|---|---|
| **the instrument** | `assert-citations.mjs` |
| **its CLAIM** | "every `file:line` citation still points at what it claims" |
| **its actual SUBJECT** | seven hand-listed files — **9.7 %** of the citations |
| **the measurement** | 14 of 144 `:line` citations in scope; 44 rotted in the 130 nobody was watching |

The eighth instance, and the most self-referential one in the set: **the
instrument that checks whether a claim points at its evidence was itself a claim
that did not point at its evidence.** Its header even named the file it was not
watching.

43 §2's question is the one that generalises, and the answer here was yes:

> *"Can this instrument choose its own subject?"*

A list in the file **is** the instrument choosing its own subject. The fix is not
a longer list — it is taking the choice away, which is why the criterion is a
directory walk and not seven more lines.

And the sentence explainer 42 ended on, which this file is the receipt for:

> **A to-do that outlives its fix is not clutter. It is a wrong answer with a
> citation attached, and citations are how this repo decides where to look.**

**44 of them, in the files nobody was looking at.**

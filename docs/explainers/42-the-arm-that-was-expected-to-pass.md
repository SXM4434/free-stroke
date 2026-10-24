# 42 — The arm that was expected to pass

Explainer 36 moved thirteen gates' known-bads onto the default path and counted
one line that mattered more than the other twelve:

| | |
|---|---:|
| **real defects found on first running a control** | **1** |

This is that defect, diagnosed. It is worth reading for three separate reasons,
and only the first one is about junctions.

---

## 1. What one bare run bought

`assert-hero-k7-intact` grades the hero word's junction laws. It had four arms
and only one of them ran, because the other three sat behind `--control=` and no
sweep has ever typed that flag. One of the three was not a negative control at
all: `terminals`, the **parked prior law** (§0.7 — still selectable, still
rendering), which the file's own header said *"is graded normally and is
expected to PASS."*

First bare run, 2026-08-07, at the shipped carve of 0.70:

```
junction law: terminals · 9 junctions · pen carve 0.70
FAIL  K7 DOES NOT TAKE THE MARK APART — the drawing is still assembled
      connected ink components: K1 5, K7 6 (must be equal).
      K1 sizes 6026, 4604, 4100, 3584, 3232  ·  K7 sizes 5913, 4604, 4100, 3584, 2330, 777
```

A 3232-pixel part splits into 2330 + 777. On the same frame, in the same run,
with the same instrument, the shipped `selfcross` law holds K1 5 → K7 5.

**The claim and the defect arrived on the same day.** The margin was replaced by
`crossings` on 2026-08-01 *because it was backwards*, the parked arm was created
in that edit, and the sentence saying it was expected to pass was written beside
it. Six days later nothing had run it once.

---

## 2. The mechanism, at one junction and one line

The parked law is a **margin** (`app/desk-doodles/page.tsx:880-881`):

```ts
if (law === "terminals" || c === 0) {
  if (!(aEnd > reach) || !(bEnd > keep)) continue
}
```

`aEnd` is the distance from the contact to the nearer end of the under stroke.
The clause admits a junction when the contact is **far** from a stroke end.

Measured first off the live page, then **re-derived in node with no browser at
all** — which is the form this diagnosis should always have had.
`findHeroJunctions` and the five `JunctionLaw` members are pure functions over
processed strokes, so they do not need a renderer to answer this. The node run
does not re-type the law: it slices the LITERAL SOURCE TEXT of `page.tsx`'s
junction block out of the file, asserts seven anchors inside it, and evaluates
that; the strokes are rebuilt exactly as `_probe-hero-junctions.mjs` rebuilds
them. A re-typed mirror that agrees with a bug is this repo's most expensive
defect class, so the only text that runs is the page's own bytes.

It reproduces every set, exactly:

| law | junctions | node | browser |
|---|---|---:|---:|
| `selfcross` | `7-8 7-9 13-14` + 4 self-crossings | 7 | 7 |
| `crossings` | `0-2 4-5 7-8 7-9 10-11 13-14 18-19` | 7 | 7 |
| `terminals` | …+ `0-1` **`18-20`** | 9 | 9 |
| `nofarside` | …+ `18-21` and 12 more | 21 | 21 |
| `prior` | the unguarded contacts | 22 | 22 |

`terminals` = `crossings` + `{0-1, 18-20}`, and `0-1` opens no break at 0.70.
The instrumented contact:

```
pair   gap  aEnd/aLen     >reach  bEnd  >keep  keepOver  fwd exit             bwd exit
18-20  1.4  142.3/172.9   true    21.0  true   11.03     NONE, ran off end    left@21.8, 120.5 free
18-19  1.6   52.0/172.9   true    21.3  true   11.29     left@24.8            left@29.5  OUTSIDE-WINDOW
18-21  1.1  146.3/172.9   FALSE   18.9  true   11.44     NONE, ran off end    left@20.9
ink 22.58 · reach 28.23 · keep 11.97 · band 7.90 · carve 0.70
```

`aEnd 30.7` against `reach 28.23`. Admitted, by two and a half stroke units.

And those 30.7 units are the part of stroke 18 lying **forward** of the contact —
every one of which is inside stroke 20's paper band when the pen lifts. That is
the `fwd exit: NONE` column: walking stroke 18 forward from the contact, it runs
off its own end without ever leaving the band. It is exactly the case
`comesOut` was written to reject (`page.tsx:565`, called at `:919`), and it is
why `crossings` and `selfcross` throw 18→20 away.

`buildJointBreaks` (`lib/flat-ink.ts:1413-1431`) then removes an 8.72-unit slab
of centreline at the contact, and the whole forward tail comes free: **the upper
half of the final `s` of *Doodles*, 777 px**, floating.

Run in node, the break sets fall out the same way, and they are the whole story:

```
selfcross  7 junctions ->  4 breaks   7-8 · 3-3 · 10-10 · 16-16
crossings  7 junctions ->  2 breaks   7-8 · 18-19
terminals  9 junctions ->  3 breaks   7-8 · 18-19 · 18-20        <- one more
nofarside 21 junctions -> 12 breaks   …incl. 18-19 · 18-20 · 18-21
prior     22 junctions ->  9 breaks   …incl. 18-19 · 18-20 · 18-21
```

**18→20 is the only junction that opens on every arm that splits and on no arm
that holds.** That is not an inference from an OFAT sweep, it is set arithmetic
over five measured break sets: the three red arms intersect in
`{7-8, 18-19, 18-20}`, the two green arms cover `{7-8, 18-19, 3-3, 10-10,
16-16}`, and the difference is a single pair.

Which is precisely what the margin's own docstring predicted, one paragraph
above the clause:

> *"`aEnd > reach` is a MARGIN, and the failure it names is not a margin's shape:
> the further from the end a junction is, the BIGGER the piece the break leaves
> floating, so the clause pushes the wrong way."*

**The margin admits this junction because the piece it strands is big.** The
defect is the clause's stated failure mode, running.

### Looked at, not inferred

A component count says the number changed. It cannot say what the reader sees.
At 5×, same window, K1 against K7 on the parked arm: the final `s` takes two
white bars — one across the top-right terminal (18→19), one across the spine
(18→20) — and the piece between them is not attached to anything. On the shipped
arm the `s` is untouched, and the only break in that window is the 16→16
self-crossing at the `e`, which reads as an over/under: the loop passes behind
its own tail, ink above and ink below.

---

## 3. Three endings, and only one of them was available

The choice was **not** made by argument. Each of the other two was closed by a
measurement.

**Could the law be fixed?** Not through the set: the margin admitting 18→20 *is*
`terminals`. Removing the clause produces `crossings`, which already exists, and
§0.7 forbids reworking a parked option in place. There would be nothing left
parked.

**Could the break law be fixed instead?** This is the one that had to be
measured rather than reasoned, because a drop rule that rejected 18→20 would
look like a clean fix. One junction removed at a time, on the live page
(`_probe-lane31-ofat.mjs --carve=0.70`):

```
terminals  without 18-20 → 5 comps [5913 4604 4100 3584 3152]   <-- THIS ONE SPLITS
nofarside  without 18-20 → 5 comps [5605 4604 4050 3584 2992]   <-- THIS ONE SPLITS
prior      without 18-20 → 5 comps [5673 4604 4100 3584 3034]   <-- THIS ONE SPLITS
```

**18→20 is the only junction that severs the mark on any of the three arms.**
Take it out of the break law and `nofarside` and `prior` — the gate's two
required-red controls — both go green. The fix that makes this row pass is the
same edit that blinds the instrument, which is DISPATCH §2.6 stated as a
geometry problem:

> *"A green row that cannot fail is the lie."*

**Could the threshold be measuring the wrong thing?** Ruled out four ways, not
assumed. The first three: the instrument passes `selfcross` **and** `crossings`
on the same frame in the same run; a second instrument with different mask code
and a different K1 reproduces the split and attributes it to a single junction;
and the severance is visible in ink at 5×.

The fourth is the cheapest and should have been first — **re-measure the frames
that are already on disk.** The gate writes every arm's K1 and K7 to
`docs/verification/hero-k7/intact/`, so its own component counter can be run
over the stored PNGs afterwards, in node, with no browser and no page:

```
SHIPPED    K1 5 -> K7 5  ✓   K7 [5845 4604 4050 3584 3187]
terminals  K1 5 -> K7 6  ✗   K7 [5913 4604 4100 3584 2330  777]
nofarside  K1 5 -> K7 6  ✗   K7 [5605 4604 4050 3584 2189  777]
prior      K1 5 -> K7 6  ✗   K7 [5673 4604 4100 3584 2231  777]
```

**The same 777-pixel fragment on all three red arms**, and the K1 frames are
byte-identical across arms (`18e3bf74…`), so nothing upstream of the break
differs. Those four are the arms that run existed at the time; the fifth comes
from the post-change run log beside them, where `crossings` — which opens 18→19
and **not** 18→20 — holds that same part whole at **3152**.

So the whole of it is one subtraction: `crossings` leaves the part at 3152,
`terminals` adds one junction and leaves 2330 + 777. Nothing else about the two
arms differs.

So the third ending is the one that was true all along: **the law is broken and
correctly so, and the gate's expectation is what was wrong.** `terminals` is now
graded as a third known-bad, required RED.

### The expectation was never true at any carve

The header's stated ground was *"at carve 1.00 the break law drops all but 7→8 on
that set too."* Measured:

| carve | junctions | opened | K1 → K7 |
|---|---:|---|---|
| 0.70 | 9 | 7-8 · 18-19 · **18-20** | 5 → **6** |
| 1.00 | 9 | 0-1 · 7-8 · 18-19 · **18-20** | 6 → **8** |
| 0 | 9 | — | 5 → 5 |

It is worse at 1.00, not better. The drop-all-but-7→8 sentence describes the
**`crossings`** set's six junctions — `page.tsx`'s own census, two files over —
and had been copied onto a set it was never about. The arm passes at carve 0
only because at carve 0 *every* law collapses onto this same clause, so there is
no arm there to grade.

---

## 4. 🔴 And the mechanism that was reported was the wrong layer

This is the part worth carrying to other lanes.

The red row, the lane state that found it, and explainer 36 §5 all named the same
cause: the **ink collar** — *"the break is sized against the TUBE radius
(`JOINT_BREAK_KEEP_K · inkDiameter / 2`) while a carved stroke is ~0.69 R, so the
paper band starts beyond the ink meant to hide it."* The lane that found the
defect said plainly that it was quoting the file's own header rather than
deriving it, which is the only reason this was cheap to catch.

It is not the mechanism, and one measurement is enough to say so:

> `crossings` and `terminals` run the **same radii, the same carve, the same
> shader, on the same frame**, and differ only in which junctions are in the set.
> `crossings` holds K1 5 → K7 5. `terminals` splits 3232 into 2330 + 777. A
> quantity that is identical across two arms cannot be what separates them.

And the collar had already been fixed. `syncBreakTable` calls
`buildJointBreaks(strokes, list, inkWidth, breakK, carve)` and writes the
per-junction `keepUnder` / `keepOver` into the fourth `vec4` of `uFsBreakData`
(`components/viewport-3d.tsx:4886-4887`); the fragment shader reads them as
`fsK.x` / `fsK.y` (`:1878`, `:1887-1888`). At `carve > 0` the shipped shader runs
the carved radii, per break.

**So where did four documents get it from?** From one stale sentence in
`lib/flat-ink.ts` — item 6 of the renderer hand-over note, *"WHAT THE BREAK NEEDS
FROM THE RENDERER, AND IT IS NOT YET WIRED"* — written when it was true, left
standing after the other lane landed it. The gate's header mirrored that
sentence; the failure detail was written from the header; the lane state was
written from the failure detail; explainer 36 was written from the lane state.

> **A to-do that outlives its fix is not clutter. It is a wrong answer with a
> citation attached, and citations are how this repo decides where to look.**

Both sentences are corrected now, with the old text quoted rather than deleted,
because the chain is the finding.

### Four citations rotted around this paragraph, and nothing was watching

Correcting item 6 meant opening the lines it cites, which is the rule this repo
already has (*"a citation is not evidence — OPEN THE LINE YOU CITE"*). Both were
off by one: the per-break upload is `viewport-3d.tsx:4886-4887`, not `:4885-4886`,
and the shader reads them at `:1887-1888`, not `:1886-1887`. Every `page.tsx`
citation written for this diagnosis was stale too, for a funnier reason — the
diagnosis added 25 lines of comment ABOVE the clause it was citing, so the clause
moved from `:848` to `:880` **as the sentence describing it was being written.**

And one older citation in the same file had rotted completely:
`lib/flat-ink.ts:110` cited `components/viewport-3d.tsx:579` for *"collapsing
shading flattens a SURFACE and not a SHAPE"*. Line 579 is now
`const paramSig = JSON.stringify(…)`. The real text is at `:929-931`.

`assert-citations.mjs` exists precisely to catch this and would have caught all
of it — but its `SCAN` list is seven engine modules, and **`lib/flat-ink.ts` is
not one of them**, despite the gate's own header naming it as a file whose
citations move. 2 310 lines whose comments ARE the documentation, checked by
nothing. That is item 6's failure one level up: the guard exists, and the file it
was written about is outside it.

---

## 5. What the flag actually cost

Six days, and the arithmetic is unkind:

- The parked arm was **selectable and rendering** the whole time
  (`window.__heroJunctionLaw = "terminals"`, and the same clause every law
  collapses onto at carve 0).
- A gate sat **directly beside it** saying it was expected to pass.
- That gate ran in every sweep that ran anything — it is
  `scripts/verify/_lane-gates.sh:40` — and printed green.
- The green was true. It was green **about the arm nobody had asked it about.**

And the mutation makes the shape vivid. Pin the intactness predicate at `true`
on the pre-2026-08-07 file and the run exits **0**: the real red turns green and
both controls redden, and nothing in any sweep could see either half. A live
defect and a blind instrument, in the same file, invisible for the same reason.

That is the cost of a flag nothing types, stated as a number for once: **one real
rendering defect, six days, on a gate that was passing.**

---

## 6. The instrument that failed, reported rather than buried

Diagnosing this without a browser meant asking whether the *pixel* half could be
done in node too. It can be, at one carve and not at the other, and the way it
failed is worth more than the way it worked.

A node rasteriser was built over the repo's own `buildPenField` and the repo's
own `buildJointBreaks` output, combining them with the two expressions copied
from the shader source (`viewport-3d.tsx:2501-2503` and `:1887-1888`). At
**carve 1.00** it reproduces four independently documented numbers — K1 6, the
shipped law holding 6 → 6, `terminals` at 6 → **8**, and `crossings` at **7**,
which is `comesOut`'s own docstring (*"7 components with it, 6 without"*).

At the shipped **carve 0.70** it does not. Its first version came back **intact
on all five arms**, including the two arms the gate has mutation-proved red —
so it was not measuring anything, and the cause is exact: it substituted the
pen field's TUBE channel for the mesh silhouette, and that channel is a
deliberately over-wide envelope (`PEN_CARVE_ENVELOPE_R` 1.6 R against the mark's
measured 1.06 R). A mark rendered too fat is a mark a correctly-sized slab no
longer severs. Re-modelled at the measured 1.06 R it agrees with the browser on
**five arms of six** — and disagrees on `crossings`, which it splits at 18→19
and the real render does not, because the implicit fusion fillet the mesh has
and a union of nib stamps does not is what bridges that one cut.

So it is **not** used to attribute the severance. The attribution rests on the
junction sets (node, exact) and on the stored frames (the gate's own counter,
on disk). Written down because the failure generalises: **a node twin of a
shader is only as good as the silhouette it assumes**, and the tube channel of
a signed-distance field is an envelope, never an outline.

### ⚠ And it left one question open rather than closing it

`comesOut`'s docstring says of 18→19: *"the only one of the five open breaks that
splits the drawing: 7 components with it, 6 without … **at 0.70 and at 1.00
alike**"* (`page.tsx:513-519`). Yet `crossings` opens 18→19 and measures **5 → 5,
intact, at 0.70**. Both cannot be true.

The rasteriser sides with the docstring and does not get a vote, for the reason
just given. The likely answer is that the docstring's number was taken when that
arm had **five** open breaks and today's `crossings` has **two**, so the split was
joint rather than 18→19's alone — and the "at 0.70 and at 1.00 alike" clause
outlived the set it was measured on. **That is a guess and it is flagged as one.**
It does not touch this file's finding, which is a difference of exactly one
junction between two arms that are otherwise identical. It does mean one gate row
currently rests on a single browser measurement, and one sentence two files over
may be stale.

---

## 7. The gate now

Eight rows, exit 0 on the bare invocation, five arms — the rows below are read
off the run log `k7-after.log`, which is **not re-run since**; see the note at
the end of this section. (The wall clock, ~38 s, is the running lane's own
report and is not in that log, so it is quoted as an estimate rather than a
measurement.)

```
PASS  the LIVE beat reaches K7 with the break OPEN — no override anywhere
PASS  K7 DOES NOT TAKE THE MARK APART — the drawing is still assembled
PASS  ...and it does not shed crumbs either
PASS  console clean
PASS  the PARKED `crossings` junction law is still REACHABLE and still holds the mark together
PASS  CONTROL · KNOWN-BAD `prior`     … is REJECTED by the intactness row
PASS  CONTROL · KNOWN-BAD `nofarside` … is REJECTED by the intactness row
PASS  CONTROL · KNOWN-BAD `terminals` … is REJECTED by the intactness row
```

Five things about that block are deliberate.

1. **`terminals` is a control now, and controls assert two things.** Not just
   "the row went red" — also `admits over the shipped law: [0-1 0-2 4-5 10-11
   18-19 18-20]`. A control that only asks whether *something* failed passes at
   `--carve=0`, where the arm is the shipped arm wearing another name. The gate
   prints `NOTHING — THIS ARM IS THE SHIPPED ARM` and fails instead.
2. **`crossings` is graded at all.** It is the *second* parked, still-selectable
   law, and until this pass no row anywhere in the battery watched it. That is
   explainer 36 §5's shape exactly, one law over — so it was measured (7
   junctions, K1 5 → K7 5) rather than assumed, and it is asserted on both
   halves: it must hold the mark together **and** publish a different set.
3. **The shipped law is one name.** `SHIPPED_LAWS = ["selfcross", "crossings"]`
   accepted either, from a transition that has since landed
   (`page.tsx:1753`). Accepting a *parked* arm as the shipped one is a hole with
   a name: the same run would be graded twice, once as what it is and once as
   what it is not.
4. **`--control=` throws.** The flag's meaning was deleted; the parser was not.
   A flag that is silently ignored is how a run gets attributed to an arm it
   never took — this file's own six-day lesson — so it now errors with the
   replacement command, which is the rule `lib/dev-server.mjs` already applies to
   a legacy knob name.
5. **Every claim above was mutation-proved**, both directions and one from the
   input side:

| mutation | result |
|---|---|
| `intact → true` | 3 controls RED, 4 subject rows PASS, exit 1 |
| `intact → false` | subject `intact` RED **and** the new `crossings` row RED, 3 controls PASS, exit 1 |
| `--carve=0` (an input, no source edit) | `crossings` row + `nofarside` + `terminals` RED, all printing `NOTHING — THIS ARM IS THE SHIPPED ARM`, exit 1 |

### ⚠ What has and has not been re-run, stated exactly

The three tables above are read off run logs on disk — `k7-after.log`,
`m1.log`, `m2.log` — from the run that produced this change. **Nothing in this
file has been re-run since**, because a browser freeze was in force for the whole
of the pass that finished it: 93 orphaned Chromes had taken over the machine that
morning and no lane was permitted to launch one.

What that pass could still do without a browser, it did: the junction sets and
break sets were re-derived in node from `page.tsx`'s own source bytes, and the
component counts were re-measured by extracting the gate's own counter and
running it over the stored PNGs. Both agree with the logs. What is left is
confirmation that the *file as it now stands* still runs green — and since the
only edits after those logs were comment text (verified: every changed line
outside a comment is zero), the expected answer is "unchanged". Expected is not
measured. The command is:

```bash
FS_PORT=3122 node scripts/verify/assert-hero-k7-intact.mjs
```

**`assert-letter-seam` is also unrun.** Its 20-rows-ALL-PASS result is from the
same pre-freeze log set, taken after the change. Explainer 23's identity — *"the
seam is closed if and only if every letter shares one pivot. Not a tolerance to
tune; an identity"* — is untouched by anything here, and for once that is
provable by reading two signatures rather than by taking a frame.

Two letters at one yaw about different pivots differ by exactly `(I − R)·Δpiv`,
so the seam closes iff `Δpiv = 0` at the settled pose. `Δpiv` comes from one
place:

```ts
buildLetterGeometry(meshes, strokes, letterMap, canvasWidth, canvasHeight)   // :3416
piv[i * 2] = own + (geo.wordX - own) * settle                                // :6644
```

Meshes, processed strokes, the letter map, the canvas size — and the memo that
calls it lists exactly those five as its dependencies. **No junction argument,
no junction dependency, and `letterMap` itself is `assignLetters(strokes,
inkWidth, …)`.** `lib/hero-letters.ts` names junctions once, in a prose comment,
and nowhere in code. The junction law decides which *contacts the flatten memo
breaks*; the pivot decides which *rigid motion each letter takes*. They are
disjoint channels that meet only in the final image.

And the stronger statement is available here anyway: **this pass changed zero
executable lines.** Every edit is comment text, verified by filtering the diff
for non-comment lines and getting an empty result. A run that could differ from
the pre-change run would have to differ for a reason no line in the tree
supplies. The command that would confirm it regardless:

```bash
FS_PORT=3122 node scripts/verify/assert-letter-seam.mjs
```

`tsc --noEmit` is **6**, exactly the documented baseline — re-run after every
edit in this pass, and none of the six is in a file this pass touched.

---

## 8. The shape of it

Explainer 36 asked what a control is worth when nothing runs it. This one is the
receipt, and it has two halves that are easy to conflate:

> **The control found the defect. The documentation sent it to the wrong file.**

A row that says `FAIL` is only half of an instrument. The other half is the
sentence in the failure detail telling the next person where to look — and that
sentence is written by hand, copied forward, and gated by nothing. Six days of a
green sweep hid a severed letter; one stale to-do would have hidden it a second
time, in the one place it was finally visible.

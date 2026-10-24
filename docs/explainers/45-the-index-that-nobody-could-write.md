# Explainer 45 — The index that nobody could write

Twenty-six lanes ran on 2026-08-07. **Every one of them was forbidden from editing
`docs/README.md`, and every one was told to RETURN its index rows so the controller
could add them.** Counted: **19 discrete, lettered, paste-ready rows** were returned across
five lanes (C 4 · F 4 · G 4 · J 4 · K 3), and a further fourteen explainer rows were returned
in prose by the lanes that wrote them. **Three of the nineteen were landed** — all three from
the first lane to return any.

By morning the index was the least accurate document in the repo. It advertised a
gate that had not opened a browser in weeks, carried gate counts from a population
that had grown by seventeen files, described three instruments as broken that had
been fixed, and named none of the fourteen explainers written that night.

That is exactly the failure an index exists to prevent, and this repo has already
paid for it twice: `assert-moment.mjs` sat in **no sweep for a week** because of a
scoping line nobody updated, and `assert-carve-graze.mjs` was described as *"has
never existed"* four days after it existed — a sentence still sitting in
`components/viewport-3d.tsx:9176` at the time of writing.

This file is about why the protocol produced that result, and it is not because
anybody was lazy. **The protocol had twenty producers and one writer, and the
writer was also the thing dispatching the twenty producers.**

---

## 1 · Four answers to "how many gates are there", all correct

On one day, in one repo, the question *how many gates does free-stroke have* was
answered four different ways by four lanes that each measured carefully:

| when | who | answer |
|---|---|---|
| pre-existing | `docs/README.md:283-284` | **36 model / the other 45** |
| ~06:00 | Lane C | **89 gates · 88 swept · 40 MODEL + 48 BROWSER + 1 meta** |
| ~04:50 | Lane K | **94 discovered = 43 MODEL + 51 BROWSER, overlap 0** |
| ~08:46 | Lane O | **97 gates, 285 tools, across 382 `.mjs`** |
| 10:0x | this pass | **97 discovered = 44 MODEL + 53 BROWSER**, + the meta-gate = **98** |
| 10:2x | this pass, again | **98 discovered = 45 MODEL + 53 BROWSER**, + the meta-gate = **99** — Lane W integrated `assert-arm-took.mjs` while this table was being typed |

Nobody was wrong. Two things were moving at once and neither is visible in a
number quoted on its own.

**The population grew all night.** 81 → 89 → 94 → 96 → 98. Lanes A, F, K, L, O, P
and W each landed at least one new `assert-*` file, and Lane L's freshness check
recorded the growth in the act: *"**95** `assert-*.mjs` under `scripts/verify/` —
**NOT 89**. The tree has moved since Lane I wrote the manifest: six new
`assert-fusion-*` gates have landed."* A count is a timestamp.

**And the counters were counting different sets.** Two live instruments disagree
by construction, and both are right:

- **`run-battery.mjs`'s `discover()`** walks the **whole repo**, skipping
  `node_modules`, `.next`, `.git`, `docs/verification` and `gate-fixtures`, and
  **EXCLUDES `assert-gate-integrity.mjs` by name** because the meta-gate is run as
  a third command rather than swept. It therefore **includes**
  `docs/storyboard/tools/assert-moment.mjs` and **excludes** the meta-gate.
- **`assert-one-knob.mjs`** scans **`scripts/verify/` only**. It therefore
  **includes** the meta-gate and **excludes** `assert-moment.mjs`.

They land on 97 apiece by one file in and one file out. They are not measuring the
same thing and they never were.

Measured this morning, on a tree byte-identical to canonical on `scripts/verify`:

```
$ node scripts/verify/run-battery.mjs --list
partition OK — 96 discovered = 43 MODEL + 53 BROWSER, overlap 0

$ node scripts/verify/assert-one-knob.mjs
scanned 382 .mjs under scripts/verify — 97 gates, 285 tools
```

The 96 is 97 in the canonical checkout: this lane's tree carries no
`docs/storyboard/`, so `assert-moment.mjs` is absent from it. Reconciled the only
honest way — by diffing the runner's own list against the filesystem:

```
on disk (repo-wide, same skip rule)   97
discovered by run-battery             96
on disk but NOT discovered            scripts/verify/assert-gate-integrity.mjs
discovered but not on disk            (none)
```

**The generalisation.** A count in prose is a claim about a set, and the set is
almost never stated. Lane C's 40/48 and Lane K's 43/51 look like a disagreement
and are two photographs of a moving object taken through two different windows.
The defence is not to pick a winner; it is to **stop putting the number in prose
at all**. `run-battery.mjs --list` prints the partition with the reason per gate
and cannot go stale, because it is the thing that decides.

---

## 2 · The measurement this pass was for: 67 of 98 — and the first draft of it was wrong

```bash
for f in scripts/verify/assert-*.mjs docs/storyboard/tools/assert-moment.mjs; do
  grep -q "$(basename $f)" docs/README.md || echo "$(basename $f)"
done | wc -l
```

**67 of 98** against the unedited file; **63 of 99** after this pass, the population
having grown by one in between.

> ⚠ **The first draft of this section said 64, and it was measured against a copy of
> `docs/README.md` this same pass had already half-edited** — the explainer rows added
> an hour earlier name a dozen gate files, and the loop counted them as "named". So the
> before-number was measured on an after-file. **That is instance eight of explainer 43's
> family, committed inside the paragraph describing it**, by the lane whose whole job was
> to stop it. It is recorded rather than quietly corrected because a self-caught instance
> is the only kind anyone can learn the shape from — and because the thing that caught it
> was re-running the measurement against a named baseline instead of trusting the number
> already written down.

Two thirds of the repo's gates are named nowhere in the index — including
`assert-mode-rims` (189 rows), `assert-data-safety` (134), `assert-stroke-schedule`
(60), `assert-layer-flicker` (62) and `assert-hero-k7-intact`, the gate whose first
bare run found the night's one real product defect.

`assert-hero-flatstate.mjs` is the sharpest of them: a **23-row browser gate**
(counted from source — 23 `record()` call sites, none in a loop; playwright-core at
`:23`, `chromium.launch` at `:129`) that grades whether `setFlatten` refuses an
object it cannot honour. `grep -n flatstate docs/README.md` returns nothing. It is
in **no section**, and it is the home of the subject explainer 24 §10 and explainer
39 both spend pages on.

---

## 3 · The cost of being unlisted changed last night, and nobody noticed

The index states its own lesson, twice, in the tool block: *"a gate missing from
this block stays off every regression list."* That sentence was **literally true**
when the runners named their gates by hand. `assert-moment.mjs` is the proof — it
was a good gate, exit-coupled, carrying four synthetic negative controls, and it
sat in no sweep for a week because both runners called `readdirSync(VERIFY)` and it
lives in `docs/storyboard/tools/`.

Lane C fixed that by making `discover()` walk the repo, and Lane K replaced the
grep classifier with a parse. **After those two changes, all 97 gates are swept
whatever the index says.** The coverage hole closed.

What is left is a **documentation** hole, and it is a different animal with a
different remedy. A reader who cannot find the gate that answers their question
does not go without an answer; they **write a second gate**. That is this repo's
most expensive recurring defect stated one layer up — the same failure as a
parallel harness, arrived at through a missing index row.

**So the fix is not to paste 64 blocks in.** Sixty-four hand-written blocks is
sixty-four things to go stale, and the file already demonstrates what that costs.
The fix is that the index says the number, states which inventory is authoritative,
and describes the gates whose *subject* a reader would come looking for. The
machine-readable list stays where it cannot rot.

---

## 4 · Twenty producers, one writer

The protocol was sound in intent. `docs/README.md` is a shared file; two live lanes
may never hold one file (DISPATCH §4); therefore lanes return rows and the
controller lands them. Every lane obeyed. Several went further than asked — Lane C,
F, G, J, K and O each wrote a `## docs/README.md ROWS I WANT ADDED` section with
the replacement markdown ready to paste, and each stated plainly *"I do not edit the
index."*

The rows were good. **Three of nineteen were landed, all from Lane C, the first lane to
return any** — which is the signature of a queue that was serviced until it was not, rather
than a decision. And a twentieth set never existed at all: Lane O's read-proof ledger says
*"rows in §9"* twice, **and its state file has no §9.** A returned row that was never written
looks, from outside, exactly like a returned row that was written and not landed.

The reason is structural:

- **The controller is the only writer**, and it is also the thing dispatching,
  merge-gating, and integrating twenty-six lanes.
- **Landing a row is not mechanical.** It is a judgement about whether a lane's
  claim about its own work is true — and this repo's standing rule is *never report
  a win on the agent's own claim*. So each row costs a verification, and the
  verifications queue behind the same single writer.
- **The queue is invisible.** A returned row that is not landed leaves no artefact.
  There is no red row, no failing gate, no list of pending rows anywhere. It is
  exactly the failure profile of the seven instrument defects this repo found the
  same night: **silent, self-consistent, and it survives.**

The same thing happened to `docs/LANES-2026-08-07.md`, one file over, for the same
reason. It is the controller's narrative of the night and it **stops after Lane O**.
Lanes P through Z are absent from it — including the lane that found the only real
product defect of the night and the lane that suspended browser access for everyone.

**And this is worth the whole file:** the lanes' own `LANE-STATE.md` files — nineteen
of them — are complete, because each was written by its own lane, continuously,
as each row landed. The rule that produced them was *"write it continuously, so a
death does not lose the work."* It also happens to be the only rule in the night's
dispatch that has **no single-writer bottleneck**, and it is the only part of the
record that did not go stale.

---

## 5 · What the two prior incidents actually cost

Both are in the record and both are the same shape.

**`assert-moment.mjs`, one week.** The gate was fine. A scoping line in two runners
decided the sweep, nobody updated it, and a good gate with four negative controls
never ran. Cost: a week of a hero-beat instrument that could have failed and did not
get the chance.

**`assert-carve-graze.mjs`, four days.** A correction note in
`components/viewport-3d.tsx` recorded, honestly and correctly, that a cited gate had
never been written and that the control was therefore ungated. **The gate was
written five minutes later.** The note was not updated, so a comment asserting a
control is ungated has been sitting above a control that is gated ever since — the
same defect class the comment was written to fix, pointing the other way. It then
propagated into the 01:55 handoff, which reported the gate as never written, which
sent a lane to look for it.

The generalisation both share, and the one this file exists for:

> **A document that self-labels done and is never read back against the artefact is
> an instrument that cannot fail.** Everything the repo learned last night about
> gates applies to its own prose. A stale index is a green row.

---

## 6 · What holds

Four things, in ascending order of how much they cost to maintain — which is the
order they should be trusted in.

1. **`run-battery.mjs --list`.** The partition with the reason per gate, printed by
   the thing that decides it. Cannot go stale. Prefer it to any count in any file.
2. **`scripts/verify/lib/control-manifest.json`, read by channel K.** 97 entries,
   one per gate, each carrying a verdict, a kind, and a **cited line that is
   re-checked every run** and reconciled against the discovered gate list in both
   directions. A stale entry is a FAILURE, and `--recite` is the affordance for
   fixing one. This is the only citation in the repo that is mechanically held.
3. **`docs/verification/lane-*/LANE-STATE.md`.** One writer per file, written
   continuously. No bottleneck, no queue, no silent loss.
4. **`docs/README.md`.** Hand-written, single-writer, and the most-read of the four.
   It should therefore carry the least perishable content: what a system *is*, why
   a decision was made, and where to run the thing that knows the current number.
   Every count it does carry now says the date it was measured and the command that
   re-measures it.

**And one rule, which is the only part of this that generalises past this repo:**
a number in prose is a claim about a set, and the set is almost never stated. Say
the set, or print the list.

---

## 7 · The numbering gaps, and why they stay

`30 · 32 · 41 · 44` are empty. They were allocated during the overnight run to
lanes that were stopped, died, or have not landed. `43-the-subject-and-the-claim.md` was **written and unlanded in a lane tree** when
this file was drafted and **landed while it was being written** — the gap list moved
under its own author, in a file about gap lists moving. `44` is a live lane's declared
and unwritten deliverable; `30` and `32` have no owner named anywhere in the record,
which is itself the finding.

**They are not closed up.** A renumber breaks every citation in every other
explainer, and §0.7's no-deletion rule applies to the record as much as to the code.
Verified: **no explainer in this repo cites 30, 32, 41 or 44**, so the gaps are
currently harmless — which is precisely the state a helpful renumber would end.

This file is 45 rather than 41 for that reason. 41 is free of citations today and
reusing it would work today. The rule that survives contact is *do not reuse a
number*, not *do not reuse a number that is currently cited*, because the second one
requires everybody to re-run the check and the first one does not.

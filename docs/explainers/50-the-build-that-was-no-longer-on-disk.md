# 50 · The build that was no longer on disk

Gap 11 of `docs/animation-toolset-map.md` §3 is closed. `/` now has a strip above
the transport that shows when each part of your drawing draws.

Two things came out of building it. The first is a design call about what a bar
means, and it took one wrong build to find. The second is why this file is in the
instrument series rather than the feature series:

> **For an hour the gate was red about code that had been correct the whole time,
> because the dev server was serving a build that no longer existed on disk.**

---

## 1. What got built

One row per unit, one bar per stroke, left to right across the beat. Row `k` is
the `k`-th unit your hand made and it never moves. The bar inside it moves to
wherever the `DRAW IN` dials put it, so `Reversed` runs the staircase down the
other diagonal and `Random` scatters it. Measured on a five-stroke test drawing:
stroke 0's bar moves **516 px right** and stroke 4's **488 px left** when `Order`
flips.

It is a view. `docs/animation-toolset-map.md` §9 pick 3, his call: *"yes, but as
a view of the stack, not as the authoring model."* No drag, no click, no
selection, and nothing on it that looks like a control.

**The axis is wall time, not travel.** `schedule.tracks` hands out slots in
`revealDistanceFraction`'s space, which is how far the pen has moved. Drawing
that directly would have made a bar's width the length of its ink. Every slot
edge is instead carried back through an inverse of that function and then through
`unEaseReveal`, so the axis is linear in seconds. What that buys: **the gaps
between bars are the pen's real air time**, and a stroke your hand dawdled
through is a wide bar even when it laid down almost nothing. That is the only
part of this nobody else can draw, because nobody else recorded the performance.

The inversion is a 129-sample table over the shipped function, memoised on
`[strokes, mode, blend]`. It runs when the drawing or the pace changes and never
per frame. §6.4's rule about rebuilds is not engaged at all: nothing here reaches
the renderer.

---

## 2. The wrong build, and what it taught

The first version filled each bar from the left up to the playhead. It looked
right, and it was right for exactly one of the four `WINDOW` modes.

| mode | what the mark does | what a left-fill strip did |
|---|---|---|
| **Grow** | ink grows from the pen | grows. Correct. |
| **Travel** | a segment runs the mark | grows. Wrong. |
| **Vanish** | the first ink laid goes first | grows. **Backwards.** |
| **Shrink** | un-draws from the far end | grows. **Backwards.** |

The fix is smaller than the bug. A bar is not filled to a playhead; it is inked
where its slot intersects `windowAt(revealWindow, playhead)`, the same interval
the renderer cuts with. One law, four modes, and `Grow` falls out of it as the
`[0, d]` case. Measured, inked pixels at playhead 0 / .25 / .5 / .75 / 1:

```
Grow      0 → 160 → 322 → 529 → 669
Vanish  669 → 510 → 348 → 140 →   0
```

**The general shape of the mistake:** the strip agreed with the model and
disagreed with the page. `schedule.tracks` was read correctly and drawn
correctly, and the picture still lied, because the schedule says where ink SITS
in the beat and the window says which of it is ON. A view built off one of two
inputs is a view that is right until somebody turns the other dial.

Explainer 26 §7.1 already had the constraint on how to read the window, and it is
why it is read once for the whole strip instead of once per row: *"The interval
lives in the beat's space, not per stroke… A per-unit window would have been a
second scheduling model beside the first."*

---

## 3. The hour that was spent on nothing

The gate has five known-bads. Two of them are mutations of the component itself:
lay the bars out by stroke index and ignore the schedule, or fill from the left
and ignore the window. Each must turn the gate red or the rows it kills are
decoration.

M1 went red. M2 went red. **M3, M4 and M5 all came back 20 PASS, including one
that deletes the axis ticks the gate counts three of.**

That is not a subtle result. A5 reads `ticks === 3` and the mutant renders zero.
The only way that row passes is if the component under test is not the component
on disk.

It was not. `next dev --webpack -p 3105` had been up **9 days 3 hours** and its
file watcher had stopped firing. Two edits compiled. Every edit after them was
invisible, including the `git checkout` that restored the file. So the gate spent
an hour reporting §D red about a build of `components/take-timeline.tsx` that no
longer existed anywhere except in that process's memory.

**Three checks, in the order they should have been run:**

| what it says | what it costs |
|---|---|
| does the mutation exist on disk? | `str.replace` with no match is a silent no-op. Assert the match count. |
| does the SERVER have it? | load the page and read one string back. 30 seconds. |
| is the server old? | `ps -o etime` on the pid listening on `FS_PORT`. Free. |

The third one was already written down. `docs/DISPATCH.md` §3: *"Restart the dev
server before a battery, and re-run a red before you write it down."* It was
written after 18 runs in which all six gate-by-mode cells disagreed with
themselves, and it names the same cause. **A rule in a doc did not reach the run.
So it is in the gate now**, printing the server's pid and uptime as provenance on
every invocation and naming staleness first whenever a row goes red on an old
server. It does not fail a row for it. An old server is a hazard, not a verdict.

### The part that is worth carrying

The instrument family in explainers 27, 35, 43, 46, 47 and 49 is all one
question: *is it pointed at the thing whose name is on it?* Every one of those
was a gate reading the wrong subject and printing **green**.

This one printed **red**, and that is worse in one specific way. A false green
gets found eventually, because the defect it was hiding shows up somewhere else.
A false red sends somebody to fix code that is already correct, and they will
change it until the red goes away. **The next lane that sees `assert-take-timeline`
go red on §D should read the uptime line before it reads the diff.**

---

## 4. The calibration, once the server was honest

Mutants were run against a server restarted for each one, on a sparse git
worktree with `node_modules` cloned by APFS `cp -Rc` (11 seconds, no measurable
disk). Five mutants, five distinct rows:

| mutant | kills |
|---|---|
| bars laid out by stroke index, schedule ignored | C1, C2, C3. C1 prints *"the control PASSED, so this row proves nothing"* |
| ink fills from the left, window ignored | D2, D3. Same warning on D2 |
| bar pixels drift from the interval they declare | B1, worst \|Δ\| 39.05 px against a 1.5 px bar |
| `cursor: grab` on a bar | F1, 10 hits |
| the three quarter ticks removed | A5, 0 of 3 |

Restored: 20 PASS · 0 FAIL · 0 VACUOUS.

⚠ **One more thing the isolated server taught.** The first worktree was under
`/private/tmp` and its watcher never fired at all, not even once. Moved to a path
under `~/Library`, the same server picked up the first change and then went deaf
in the same way as the shared one. So there are two separate problems here: a
watcher that never starts under `/private/tmp`, and a watcher that dies after a
change or two. **Restarting per mutant is the only thing measured to work.**

---

## 5. What is not there, and why

- **`Direction` cannot show.** `Start → end` and `End → start` decide which end
  of a unit's ink draws first, not when its slot is busy. `ScheduleTrack.reverse`
  says so itself: *"`start < end` STILL, ALWAYS."* The strip is silent about it
  and the hover title is the only place it appears. That is a real hole in "see
  the timing" and the fix belongs on the mark, not on the strip.
- **No row labels.** At 8 groups a number per row fits. At 22 strokes it does
  not, and a label that disappears at a threshold is worse than no label. So a
  row says when a unit draws and not which letter it is.
- **The as-drawn span is not ghosted under the bar.** It would show how far the
  schedule moved each unit, and it is two bars per row for a fact you can get by
  flipping `Order` back. Cut on purpose, written here so nobody re-proposes it as
  an oversight.
- **The bars got quieter after the first look.** Pitch capped at 12 gave 8 px
  bars, and four of them read as the heaviest thing on the screen, heavier than
  the transport's own filled pills. `/desk-doodles`' phase ruler does the same
  job at 3 px. The cap is 8 now, which is a 5 px bar.

---

## 6. Still true when this was written

**The dev server on `:3105` (pid 7765) is still serving the stale build**, which
includes the M2 mutant this lane injected during calibration. The file on disk
and at HEAD is correct and the gate is 20 PASS against a server compiled from
HEAD. Restarting `:3105` was refused by the sandbox and was not worked around.

```
node ./node_modules/.bin/next dev --webpack -p 3105
```

Until somebody runs that, every lane verifying against `:3105` is grading a build
from before its own edits.

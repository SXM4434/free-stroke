# HANDOFF TO OZ — free-stroke — 2026-08-07, 10:0x ET

> # ⏹ SUPERSEDED 2026-08-25. NOT DELETED.
>
> **The live documents are `docs/STATUS.md` (state, generated) and `docs/RUN-QUEUE.md`
> (the ledger). The machine-readable contract is `HANDOFF.json` — `handoff.py show`.**
>
> This file kept its own promise and then broke it. Its header says *"A handoff that is
> stale is worse than no handoff, because it is believed"*, and §7 records what the version
> before it got wrong. Seventeen days later the same thing happened to this one.
>
> **WHAT IS NOW FALSE IN IT, all on page one where it will be believed:**
> 1. *"NOTHING HAS BEEN COMMITTED SINCE 2026-07-28 ... 2 365 changed paths ... the largest
>    single risk in this repo."* **Closed 2026-08-24** by `5f3faa5f`, `4c752f1b`, `099e1ccc`.
> 2. *"NO LANE IN THIS REPO MAY LAUNCH A BROWSER ... Lane V is building the enforcement ...
>    until it lands, nothing here opens Chrome."* **Lane V LANDED.**
>    `scripts/verify/lib/browser.mjs` and `lib/dev-server.mjs` exist and the gates import
>    them. Every proof this file names as "left untaken" is now takeable.
> 3. **§6 STATE AT HANDOFF, in full.** Replaced by the generated block in `docs/STATUS.md`,
>    which no human types and which `.githooks/post-commit` refreshes on every commit.
> 4. ⚠️ **NOTHING replaced it.** An earlier version of this header claimed a 2026-08-20 lane
>    run had moved the repo on. **It did not.** Measured 2026-08-25: every engine file is
>    dated Aug 4 or Aug 7, and `docs/thinking/2026-08-20.md` is the only file in the repo
>    with an 8/20 date. That log holds agent returns describing work that is **not on this
>    machine**. §1, §2 and §3 of this file are therefore closer to current than that claim
>    was, and the real gap is only that §0 and §6 are wrong. See `docs/STATUS.md`.
>
> **WHAT IS STILL TRUE, re-measured 2026-08-25:**
> - **`tsc --noEmit` is exactly 6**, the same six in the same two files. Re-run today:
>   2 PASS, 0 FAIL, 2 UNSWEPT, exit 3 PARTIAL. A count **below** 6 is still a failure.
> - **§4, the sixteen picks.** This is the section worth keeping and the reason the file
>   is not archived. A question does not go stale the way a measurement does. Four moved on
>   8/20 (see `docs/STATUS.md`); the rest are exactly where he left them.
> - **§5, the traps.**
>
> Read §4 and §5. Treat §0, §1, §2, §3 and §6 as history.

> **THE 01:55 VERSION OF THIS FILE IS SUPERSEDED AND WAS MATERIALLY WRONG.** It is not
> deleted — §7 records exactly what it got wrong and why, because the two errors are the
> same class as the defect the whole night was about. In short: it reported the blank tail
> as the one open defect on the mark (it had been closed and independently audited) and
> `assert-carve-graze.mjs` as never written (it had existed since 21:34 on 2026-08-04 and
> passes 9/9). **A handoff that is stale is worse than no handoff, because it is believed.**

🔴 **NO LANE IN THIS REPO MAY LAUNCH A BROWSER.** 93 orphaned Chromes survived their lanes
by 4 h 48 m on the morning of 2026-08-07 and made Sebs's machine unusable. **Lane V is
building the enforcement** — one shared launcher, one knob, an orphan sweep, and a gate that
fails any capture naming its own launch options — and until it lands, nothing here opens
Chrome, not even headless, not even to check. Every browser-dependent proof in this file is
named with its exact command and left untaken.

**THE TREE IS GREEN.** `tsc --noEmit` = **exactly 6**, the same six in the same two files
(1 × `lib/dd-engine/handFeel.ts:470` · 5 × `lib/geometry-engines.ts:5235-5241`). A count
**below** 6 is a FAILURE, not a win.

🔴 **NOTHING HAS BEEN COMMITTED SINCE 2026-07-28.** `HEAD` is `9f4c23e` *("test: gate
distinguishes a hot-reload from a real rebuild regression")*, ten days old. The working tree
carries **2 365 changed paths** — 1 860 untracked, 178 staged-added, 156 staged-added-then-
modified, 156 modified, 14 both. A full day of twenty-six lanes' work sits uncommitted on
one machine, unbacked by anything. **That is the largest single risk in this repo right now
and it is not a technical one.**

---

## 0 · START HERE, IN THIS ORDER

1. `node scripts/verify/assert-tsc-baseline.mjs` — baseline **6**, both routes 200. It has
   three exit codes now: 0 judged-and-passed · 1 failed · **3 PARTIAL**, a channel it could
   not reach, printing an `UNSWEPT` line naming the command that answers it. It used to exit
   **0** against a dead port and it was the one gate of 32 that did.
2. **§4 of this file — Sebs's picks.** Sixteen decisions that are his alone have accumulated
   across a dozen returns and have never been in one place. He cannot act on a decision he
   has to reconstruct from twelve documents. **This is the highest-value section here.**
3. `node scripts/verify/run-battery.mjs`, then **separately** `run-browser-battery.mjs`
   *(browser battery blocked until Lane V lands)*. ⚠️ **Never run two batteries at once** —
   six false reds in one session came from two batteries contending for one dev server, and
   each one's own log said ALL PASS.
4. `node scripts/verify/run-battery.mjs --list` — the gate inventory, with the reason per
   gate. **This is the only inventory that cannot go stale**; `docs/README.md` named 31 of
   the 98 gates before this pass and 36 of 99 after it — the rest are swept anyway.
5. `docs/verification/lane-*/LANE-STATE.md` — twenty-six lanes, each written **continuously**
   rather than at the end, so the lanes that died still left their measurements. These are
   more precise than any summary of them, including this one.

---

## 1 · WHAT LANDED AND IS VERIFIED

Everything in this section was checked against an artefact — a file on disk, a row count run,
or a log already in the evidence tree — not against a lane's summary of itself.

### 1.1 · The instrument layer — the night's real subject

| | before | after |
|---|---|---|
| gates in no sweep at all | **73 of 81** (2026-08-03) | **0 of 98** |
| gates hardcoding `http://localhost:3000` | 35 of 48 browser gates | **0** |
| capture tools hardcoding it | 90 tools, 92 sites | **0** |
| scripts naming a checkout by absolute path | 7 sites, one of which `rmSync`'d the shared evidence | **0** |
| gates running a negative control on the bare invocation | 62 of 89 | **75 of 95**, and the rest named by name every run |
| known-bads written, wired, and behind a flag nothing types | 13 | **0** — all thirteen run bare, all thirteen proved to fail |
| the MODEL/BROWSER split | a **grep over raw text** | a syntax-tree question, calibrated on every run, partition asserted |

**The two that matter most are the ones where the number got WORSE on purpose.** The model
battery went from 29/44 green and "633 rows" to 28/43 and 606 — and the accounting closes
exactly: `633 = 606 clean + 2 partial + 11 on red gates + 14 on a gate that moved to the
browser battery where it belonged`. **Nothing was fixed to produce that number.** One gate
stopped calling an unreachable server a pass, one moved to the right battery, and the row
total stopped counting rows printed by runs that did not finish. Likewise the meta-gate's
channel-J red rows went 5 → 18, because the instrument started seeing violations it had been
computing and discarding since the day it was written.

### 1.2 · The product layer

- **The blank tail is CLOSED and independently audited.** An audit lane re-ran the whole
  investigation rather than reading it: **0 px lost on all 100 steps**, and its own readings
  are byte-identical to the original's control arm — it reproduced the control before
  trusting the claim. The open question is answered: **the re-stamp is the second half of the
  SAME fix, not a separate defect.** Either half alone closes the blank, but the drop closes
  the *silent* class and the stamp is what keeps the cascade alive. Explainer 24, now 1 040
  lines with five corrections and the original readings kept.
- **The draw-in became authorable.** `lib/stroke-schedule.ts` — a per-stroke translation of
  the arc axis at slope 1 — plus `DRAW IN` (`order`/`overlap`/`align`) and the reveal as a
  **window** (`Grow`/`Travel`/`Vanish`/`Shrink`, plus per-stroke reverse). Steps 1–3 of the
  build order Sebs gated. **Negative control 48/48 frames byte-identical across five
  independent pairings**, instrument calibrated before a line was written. Explainer 26.
- **The fusion power set: 120 cells, 0 duplicates, 0 dead dials.** The duplicate number was
  **3, not 1**, and the second measures 38.30 apart on pixels against a closest pair of 10.46
  — a pixel gate was never going to find it. Both dead dials resolved to mechanism at
  `file:line` and they were different faults wearing one sentence. Explainer 25.
- **The exporter now knows the draw-in changed.** `planFrames` had assumed the reveal ends
  FULL — false in 5 of the 8 states the app can reach — and with no hold it never emitted a
  clock-1 frame at all, leaving every export this module has ever produced 1.35 % unfinished
  under the hold. Explainer 38.
- **`assert-carve-graze.mjs` exists, and has since 2026-08-04 21:34.** 9 rows, ALL PASS, both
  mutants exit 1, reproducing its own header table bit-identically five days later on a
  different bundler.

---

## 2 · 🔴 THE ONE FINDING THAT OUTRANKS ALL THE OTHERS

**Seven separate defects were found in one week and they are one shape: an instrument
whose SUBJECT differs from its CLAIM.** It has its own explainer as of 10:0x today —
**[43 — The subject and the claim](docs/explainers/43-the-subject-and-the-claim.md)** —
which states it once so the eighth is recognised on sight. Its table is the authority;
this one is the summary, and where they differ, read 43.

| # | the instrument | its CLAIM | its actual SUBJECT | explainer |
|---|---|---|---|---|
| 1 | 35 browser gates | this lane's tree | whatever was on `:3000` | 27 |
| 2 | 90 capture tools, 92 sites | this lane's tree — and they **write evidence**; one deleted the shared set first | the shared checkout | 37 |
| 3 | `apiGrab` | the 3-D viewport's canvas | the **first** canvas in document order, on a page with two whose containers have byte-identical class lists | 35 |
| 4 | `assert-hero-dials` | *"every panel control, judged in the state it is SHOWN in"* | 44 model-table rows; Chrome never opened | 29 |
| 5 | the scoreboard | *"0 failures"* | the failures spelled `FAIL`, not `FAILED` — `"…FAILED TO BITE"` was invisible across 1 033 rows in 48 logs | 31, 34 |
| 6 | four probes | a channel's OFAT verdict | one frame, one pose, one dial position — none recorded | 39 |
| 7 | 48 capture launchers | an unattended headless run | headed Chrome, whose throttling produced a whole motion statistic from one blank frame | 27 §5, 40 |

**Why this is worth more than any individual fix:** none of the seven is a badly written
instrument — read individually each is careful, commented, and correct about what it does.
`querySelector("canvas")` returns the first canvas exactly as specified. **The defect is the
distance between what the instrument DID and what its output was TAKEN to mean, and that
distance lives in nobody's code**, which is precisely why nothing was checking it. And none
of the seven was caught by the defence built for the class. Deriving the window from the model does not help. A meta-gate
proving the instrument CAN fail does not help — it was already in place and green. **Every
one of these instruments was perfectly capable of failing; it was simply failing about
something else.** The defence that does work is uniform and now exists in four places: the
subject is **handed in** from one shared resolver, and the instrument **records what it
actually got**. `lib/dev-server.mjs` for the port · `grabInfo()` for the canvas ·
`lib/control-manifest.json` for the arms · `lib/frame-guard.mjs` for the frame.

**The eighth instance is the one nobody has closed, and it is Lane V's job:** 198 files
launch a browser and each spells its own launch options, so "headless" is a hope rather than
a property, and 93 orphaned Chromes is what that costs.

---

## 3 · OPEN, ATTRIBUTED

### 3.1 · Blocking, and it is not code

- 🔴 **NOTHING IS COMMITTED.** 2 365 changed paths on one machine since 2026-07-28. Two
  lanes have already reasoned about a tree that does not exist because of it, and a `git
  worktree` here silently produces a ten-day-old tree wearing today's name. **Whoever picks
  this up: commit before anything else.** *Attributed to nobody — it is a standing policy
  question and it is Sebs's.*
- 🔴 **THE BROWSER PROHIBITION IS IN FORCE.** Every browser-dependent proof below is named
  with its command and left untaken. *Lane V.*

### 3.2 · Live reds, each with an owner

- 🔴 **`assert-one-knob` is RED right now, on channel B** — `assert-export-window.mjs:73-74`
  carries `process.env.FS_PORT ?? "3000"` and builds its own URL. A **private copy of the
  port line**, the exact shape explainer 28 §3.2 exists for. Lane S fixed precisely this in
  a parked version of that gate; nobody owned the file when the fix was ready.
  ➜ *One-line fix: import `LAB_URL` from `./lib/dev-server.mjs`.*
- 🔴 **The one-knob ratchet is unrecorded because of that red.** `one-knob-baseline.json`
  holds `nonGateHardcodeSites: 6`; channel D measures **0**. `--record` refuses while any
  non-ratchet channel is red — correctly, since recording during a red run grandfathers
  whatever made it red. **Headroom is free violations: six sites of it is six of them.**
  ➜ *Fix the channel-B red, then `node scripts/verify/assert-one-knob.mjs --record`.*
- ⚠️ **`assert-hero-k7-intact`'s `terminals` arm is RED and is MEANT to be.** The parked
  junction law splits a 3232 px part into 2330 + 777 at the shipped carve. It is now a graded
  known-bad, required red. **Do not "fix" it** — §0.7 forbids reworking a parked arm, and the
  margin admitting junction 18→20 *is* `terminals`. Explainer 42.

### 3.3 · Measured, unfixed, owner named

- **`components/viewport-3d.tsx:9176`'s correction note still says `assert-carve-graze.mjs`
  "has never existed."** True at 21:29 on 2026-08-04, false by 21:34. A comment asserting a
  control is ungated, sitting above a control that is gated. **This is the second time this
  repo has paid for a stale scoping line** — the first left `assert-moment.mjs` in no sweep
  for a week.
- **`_probe-carve-register.mjs` publishes `{"error":"no r3f scene found"}` under exit 0.**
  The canvas carries no `__r3f` key at all, so its entire published table has been silently
  skipped and `register-free-stroke.json` contains an error object under a success code.
  Repaired in `~/.fs-lanes/laneW`, **not re-run** (needs a browser).
- **`__heroBreaks` is stale by one dial change** — read after a dial move, a full scrub walk
  and 600 ms, it equals the PREVIOUS state's junction count, across three transitions in a
  row. `_probe-drawin-holes.mjs:183` writes it into `globals.json`. *`lib/flat-ink.ts` /
  `viewport-3d.tsx`.*
- **`assert-citations.mjs`'s `SCAN` list is seven engine modules and `lib/flat-ink.ts` is not
  one of them** — 2 310 lines whose comments ARE the documentation, watched by nothing. Four
  rotted citations were found there by hand, one of which had propagated through **four
  documents** before anyone re-derived it.
- **28 of the 96 gates depend on a capture tool for the tree they grade** (1 live, 27
  stored), and **nothing in the evidence records which tree that was.** All 28 were clean by
  `assert-one-knob` the whole time, because the hardcode was one level down.
- **`docs/explainers/25-…`'s H1 still reads `# 24 ·`** — the renumber never reached the title.
- **`lib/export`'s GLB output is not byte-reproducible run to run** (`b6e79962…` vs
  `5da0c2ac…` on one state). Real, reproduced, and it means a GLB can never be byte-compared.
- **`assert-arm-took.mjs` is not in canonical.** It measured the dropped-driver-return class
  at its honest scope — **96 files, 232 dropped arms, 23 of them gates** — and exists only in
  `~/.fs-lanes/laneW`.

### 3.4 · Needs a browser — the exact commands, all untaken

```bash
# 1 · the frame guard, end to end over all twelve motion cells. R's run was stopped
#     after 2 of 12 (both clean). DO NOT report the wiring as end-to-end verified.
FS_PORT=<port> SL_HEADLESS=1 node scripts/verify/verify-screen-layers.mjs --label=<x> --only=motion
# 2 · the export fix at the real Video button, on the landed file
FS_PORT=<port> node scripts/verify/assert-export-window.mjs
# 3 · the k7 gate since its citation edits (comment-only changes; expected is not measured)
FS_PORT=<port> node scripts/verify/assert-hero-k7-intact.mjs
FS_PORT=<port> node scripts/verify/assert-letter-seam.mjs
# 4 · the one tension nobody resolved: `comesOut`'s docstring says 18→19 splits the
#     drawing "at 0.70 and at 1.00 alike", and `crossings` was measured intact at 0.70.
#     Both cannot be true. Likely the docstring outlived the set it was measured on.
FS_PORT=<port> node scripts/verify/_probe-lane31-ofat.mjs --carve=0.70
```

### 3.5 · Unmerged work sitting in lane trees

**`~/.fs-lanes/lane{B,H,M}/docs/verification/stroke-schedule/`** holds ten evidence
directories; canonical holds one (`refs/`). Explainer 26 cites numbers this checkout cannot
show you. Lanes B, H and M were merge-held behind F and J and the hold was never released.
Lane M's own state file names exactly which files to take and which are stale — **do not
merge that tree wholesale**, it would overwrite `app/page.tsx`, `docs/README.md` and ~200
`scripts/verify/*.mjs` with older copies.

---

## 4 · 🟡 SEBS'S PICKS — SIXTEEN DECISIONS, HIS ALONE, GATHERED HERE FOR THE FIRST TIME

DISPATCH §2.8: *"Open picks stay open. Sebs-only calls are kept as dials and surfaced in
prose with a recommendation. Never silently defaulted."* **Every one of these has been
honoured — nothing below was defaulted.** But they have been accumulating across a dozen
separate returns for four days, and a decision he has to reconstruct from twelve documents is
a decision he does not get to make. **Each row: the recommendation, what the other branch
costs, and where the evidence is.**

### The mark itself — carried forward from 2026-08-04, still parked

| # | pick | recommendation | what the other branch costs | evidence |
|---|---|---|---|---|
| 1 | **the `e`** — 6 rendered options | **C, widen the bowl 22 → 25** | C makes the `e`'s bowl 4 % larger than his `o`. ⚠️ Its guarding constant is ambiguous in the lane's own report — `FONT_R_CEILING` 0.1758 from a measure that lane calls wrong for this decision, against an eye-survival figure of 0.2486. Applying it unsupervised was declined for that reason. **It is the FONT `e`; his traced handwriting's `e` is open (42×18) and the page loads on traced** | `docs/verification/e-options/v2/SHEET-e-options.png` |
| 2 | **pen tip** — Quill 2.70 · **Reed 1.60 (shipped)** · Chisel 0.85 · Nib · Cut · Off | **Reed** | Quill reaches Desk Doodles (5.578 vs 5.796) but costs **12 blank px at the pen** against Chisel's 6; Reed is ⅔ the reach at **zero** cost on that channel | `docs/verification/pentip/` |
| 3 | **3D ink** — `#272727` (shipped, neutral) vs `#282623` (warm, token-disciplined) | **Neutral** | The warm value is token-disciplined, which is a real argument; but only the neutral one reads as graphite | — |
| 4 | **`envGain`** — 3.6 (shipped) vs 4.4 | **3.6** | 3.6 is the bottom of the measured 45–63 band; 4.4's underside loses the dark anchor | — |
| 5 | **which of the seven films ships** | **HIS ALONE. Do not decide it.** | — | `lib/hero-motion.ts`; films in `docs/verification/hero-transition/` |

### The animation toolset — map §9, gated 2026-08-04, four picks still open

He answered picks 1, 2 and 5 (*all, B's model first* · *both — group by default, stroke on
request* · *scheduling first, post-arrival motion later*). These four are open:

| # | pick | recommendation | what the other branch costs | evidence |
|---|---|---|---|---|
| 6 | **does the timeline ever appear?** | **Yes, but as a VIEW of the stack, not the authoring model** — modifiers stay the source of truth, so a drawing with 40 strokes still has 4 modifiers | Some things are genuinely easier to say by dragging a bar than by setting a rule, and you would occasionally hit that | `docs/animation-toolset-map.md:978` |
| 7 | **does authored motion override the recorded timing, or ride it?** | **Ride it** — the pen's own hesitations stay underneath; the modifier reshapes *when each stroke's beat happens*, not *what happens inside it*. Same compose-don't-replace rule `revealEase`/`revealMode` already follow | Two timing systems stacked is one more thing to explain, and a strong enough authored timing will bury the hand it is riding on | `:984` |
| 8 | **product route, or a lab first?** | **The product route, `/`** — `/desk-doodles` is the standing proof of what happens otherwise: *"a whole motion rig your own drawing cannot reach"* | It lands in the surface he uses daily, so it has to be right on the first pass rather than parked | `:998` |
| 9 | **is the iOS pass part of this, or after it?** | **After — with one exception:** whichever direction wins should be laid out to a thumb from day one, because a dock designed for a mouse does not survive being re-laid-out later | ⚠️ **There is no iOS-UI doc in this repo.** PRD item 35 is one line and nothing else — worth knowing before anyone treats it as a spec | `:1003` |

### Fusion — from the 120-cell power set

| # | pick | recommendation | what the other branch costs | evidence |
|---|---|---|---|---|
| 10 | **Slow Weather's pale body** | **Leave it.** It is alive on the shape it lands on (net 59.27) and quiet because its mark sits at **ink 222 against 255 paper** while every other arm sits at ~180 | §0.7 bars anyone else from re-tuning a relationship he can still pick. The louder answer at the same address (**Static Chrome, 98.56**) is one press away and named on the picker | `docs/verification/lane-a-fusion/` |
| 11 | **the 15 sub-threshold neighbour pairs** the duplicate gate prints under its bar every run | **A list to look at, not a defect list.** None is a duplicate by the criterion the three proven ones establish | Several are close enough that taste could go either way — and the night's lesson is that *pixels answer "do these look alike", not "are these the same idea"*, so the criterion is his, not the gate's | the §9 output, every run |
| 12 | **should more cells ship on Arc?** | **No change without his word.** 114 of 120 are on Loop, matching the shipped rail exactly | Every cell supports all three and the Drive dial sits directly under the picker, so nothing is lost by leaving it | — |

### The instrument bed — three calls that would restage stored evidence

These are the ones a lane deliberately refused to take, and the reason is the same in all
three: **changing what a tool records makes an old label and a new one look comparable when
they are not.**

| # | pick | recommendation | what the other branch costs | evidence |
|---|---|---|---|---|
| 13 | **flip the headed captures to headless?** — 28 capture tools plus 14 GATES launch headed | **Flip nothing wholesale, and instead refuse the FRAME rather than the window** (`lib/frame-guard.mjs`, built and landed). The blank did **not reproduce** in 6.5 minutes of trying: headed-vs-headless differs by *less than the headless-vs-headless noise floor* | Flipping restages what 28 tools record in exchange for a hazard that would not reproduce. **If exactly one flip is wanted it is `verify-screen-layers.mjs`'s `headless: process.env.SL_HEADLESS === "1"`, at `:264` today** — its flag is already computed so only the DEFAULT moves, it is the only tool where the blank was ever seen, and its evidence is `--label`led so old labels survive. ⚠️ That line has been cited as `:213`, `:220` and `:239` in four documents in one day and is at **`:264`** — checked by opening it. **Find it by its text, not its number.** ⚠️ **The 14 headed GATES are the sharper question and nobody has asked it** — they print verdicts, not frames | explainers 37 §3, 40 |
| 14 | **enable the crop re-measurement?** — one word, `apply: false` → `apply: true` in the `measureBox` call inside `reframe()` (at `:522` today — opened and checked, but see the warning on pick 13) | **His call.** The crop was measured ONCE before the first capture and every crop for the rest of the run came from it — a real defect, and the drift is now measured and printed on every reframe **without** changing the bed | Enabling it shifts a newly-shot label by up to 40 px from the stored `final/` that `assert-screen-layers` grades. Stored labels stay internally consistent, but a new label stops being comparable | explainer 40 |
| 15 | **`holdOnEmpty` has no panel pill** — 0 references in `components/` | **His call whether it becomes a control.** The export fix made `recordAnimation`'s warning REACHABLE for the first time, and it reads verbatim: *"The 0.60s hold was dropped: … Turn on \"hold on empty\" to keep it."* — **naming a control that does not exist** | Leaving it means a live toast tells him to press something that is not there; building it is a new control on a panel he has twice lost dials off the bottom of | explainer 38 |

### One ruling on the record itself

| # | pick | recommendation | what the other branch costs | evidence |
|---|---|---|---|---|
| 16 | **`assert-hero-flatstate`'s control-manifest entry** — its cited token moved from `:303` to `:557` | **Re-rule it to the real negative control** (`"line": 434`, token `the KNOWN-BAD REPRODUCES THE DEFECT`) — that row arms the parked prior inline on the bare invocation, requires the defect to reproduce, and disarms | The minimal alternative (un-rot only, `"line": 557`) keeps a ruling that cites a *reported* dead-cell rather than a deliberately-wrong input — the `assert-gloss-rim` shape explainer 34 §4 warns about. **Re-ruling is explicitly a human call** | `docs/verification/lane-q-ofat/LANE-STATE.md` |

---

## 5 · TRAPS — do not rediscover these

**New tonight, and each cost a lane real time:**

- **A grep cannot tell code from prose.** It bit three times in one night, in three different
  files: the battery classifier read a comment as a browser launch; a lane's own citation
  comment re-created the very defect its survey measures; and the naive `//.*$` comment
  stripper eats `//localhost:3000"` out of `"http://localhost:3000"`, deleting the exact
  evidence it was looking for. **Parse, do not grep — and remember a comment is source text.**
- **A ratchet can launder.** If `--record` runs before the sweep, a RED run writes its own
  failure down as the new floor. It runs last now and refuses while anything else is red.
- **A mutation that did not land looks exactly like a control that held.** A `perl -0pi`
  substitution silently did not apply and the run came back green. **Grep for the mutated
  token; never trust the substitution.**
- **A control that comes back clean means the instrument is blind.** Proved four separate
  times tonight — an opacity fixture built with `sharp`'s `alpha: 0.5` came out opaque; an
  empty-patch guard could not fire because the script is itself in its own ADDED list; a
  pen-field control ran second in a warm page and inherited the allocation it was testing for;
  a probe measured a still page and reported Δ 0.000 on all three arms including its control.
- **A row that prints in a format nothing parses is not a row.** Both runners require the
  verdict token to LEAD the line; `\bFAIL\b` does not match `FAILED`. Eight control rows and
  five minutes of work were invisible to every scoreboard for exactly these two reasons.
- **A node twin of a shader is only as good as the silhouette it assumes.** The tube channel
  of an SDF is a deliberate over-wide envelope, **never an outline** — a raster built on it
  came back intact on all five arms including two mutation-proved known-bads.
- **`page.evaluate(() => f(o))` ships the function SOURCE across the boundary** and leaves `o`
  undefined in the page. Serialise the payload as an ARGUMENT.

**Standing, and still true:**

- **tsc below baseline is a FAILURE.** A parse error halts tsc before it reaches the known
  six. Cost ~4 hours of both routes at HTTP 500.
- **A backtick inside a GLSL template literal terminates the string.** Has bitten four times.
- **`--use-angle=metal` is load-bearing** — without it Chrome falls back to SwiftShader, which
  silently pauses the rAF loop; a frozen animation and a still one are identical in a still.
- **ALWAYS `--label=`** · **re-capture BOTH arms of any stored-capture gate** · **captures
  ≥1440×1440** · **editing anything under `lib/` stales every provenance-gated capture**.
- **A contact sheet can lie** — assert crops are opaque and composite on the real paper.
- **`applyLetterMotion` MUST stay LAST on the `onBeforeCompile` chain.**
- **A worktree is cut from the last COMMIT and this repo never commits.** Isolate with a plain
  copy under `~/.fs-lanes/`, exclude `docs/verification` unless the lane genuinely needs it,
  and assert freshness by byte count before measuring anything.
- **`pnpm dev` PANICS in a lane copy** — Turbopack rejects the symlinked `node_modules`
  (`next.config.mjs` pins `turbopack.root` to the lane dir). Use
  `node node_modules/next/dist/bin/next dev --webpack -p <port>`. ⚠️ Webpack mode generates
  `.next/dev/types`, which `tsconfig.json` includes, which surfaces a **7th** tsc error that
  Sebs's own Turbopack server never sees. Clear `.next/dev/types/app/desk-doodles` before
  reading tsc.
- **Never edit a surface to make a check pass; never relax a bar to go green.** Fix the check
  when the check is wrong, the surface when the surface is wrong.

---

## 6 · STATE AT HANDOFF

```
tsc --noEmit                  6 — exactly the baseline, the same six in the same two files
HEAD                          9f4c23e  (2026-07-28 19:15)   — 2 365 changed paths uncommitted
gates                         99 assert-* scripts · 98 swept (45 MODEL + 53 BROWSER, overlap 0)
                              + assert-gate-integrity, run as the third command
                              ⚠ measured 10:2x and already old — `run-battery.mjs --list`
assert-one-knob               6 PASS · 1 FAIL  (channel B — assert-export-window.mjs)
control manifest              97 entries — 90 control · 6 partial · 1 none
explainers                    01-29, 31, 33-40, 42, 43.  GAPS: 30, 32, 41, 44 — DO NOT REUSE
                              43 landed at 10:0x; 45 written this pass. Next free: 46
dev server on :3000           DOWN, deliberately
Chrome processes              40 (Sebs's own; no lane may add to them until Lane V lands)
disk                          446 G free, 4 % used
components/viewport-3d.tsx    728 185 B      lib/flat-ink.ts        110 735 B
lib/hero-motion.ts            205 697 B      lib/stroke-schedule.ts  54 679 B
lib/pen-reveal.ts              60 598 B      lib/style-fusion.ts    219 073 B
app/desk-doodles/page.tsx     198 407 B
```

---

## 7 · WHAT THE PREVIOUS VERSION OF THIS FILE GOT WRONG — kept, not deleted

The 01:55 handoff is superseded. Two of its claims were **false at the moment it was written**,
and both were believed and acted on by later lanes, which is the cost.

1. **§2.1 and §4 reported the blank tail as "the one genuinely open defect on the mark."** It
   had been closed at 21:27 on 2026-08-04 and the write-up was already headed CLOSED. A lane
   was dispatched to audit the closure rather than take the claim — correctly — and the
   closure held on every measurement.
2. **§2.1 and §4 reported `assert-carve-graze.mjs` as "cited in `viewport-3d.tsx` and never
   written."** It was written at 21:34 on 2026-08-04, five minutes after the correction note
   that says it has never existed. **That note is still in the source at
   `viewport-3d.tsx:9176`.**
3. **§4's `dit_pulse` item was a pre-fix number outliving its fix by three days**, attributed
   to a file that is *structurally incapable* of holding the defect —
   `grep -ic "pulse|one-shot|reveal|completion" lib/dither-shader.ts` → **0**. The real
   mechanism was a rest window sized as an index fraction against a lifetime in seconds, and
   it had been fixed on 2026-08-04. The provenance claim was also a **misread month**: the
   file is dated Jul 29 14:03, not Aug 4 14:03.

**The pattern in all three is one thing: a document that self-labelled done and was never read
back against the artefact.** DISPATCH §1.6 already has the rule — *"any doc self-labelled
done/verified that a later finding supersedes gets QUARANTINED."* It was not applied to this
file. Apply it to this one too, the next time it is stale.

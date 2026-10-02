# Free Stroke docs

> **THIS INDEX WAS LAST RECONCILED AGAINST DISK ON 2026-08-28.** The 2026-08-07 pass is
> still the one that measured most of what is below; 08-28 corrected the Start-here block,
> where every claim about commits and handoffs had gone false, and added the gate count. Every count in it
> was re-measured that day rather than carried forward, and the ones that move —
> gate counts, row counts, the explainer numbering — say where to re-measure them.
> This file is the least reliable document in the repo when it is not maintained,
> because a reader trusts it: it has twice cost real time, once when a scoping line
> nobody updated left `assert-moment.mjs` in no sweep for a week, and once when a
> correction note called `assert-carve-graze.mjs` *"has never existed"* four days
> after it existed. **An index that is 90 % right is worse than one that is openly
> incomplete.** Where a claim here could not be verified, it says so.

## Start here

- 🔴 **[RUN-QUEUE.md](RUN-QUEUE.md)** — **THE LEDGER. READ IT FIRST AND WRITE ROWS INTO IT.**
  Created 2026-08-25, because this repo had been run for a month without one and the whole
  2026-08-20 lane run landed in a thinking log and nowhere else. A row goes in **before**
  dispatch; a return that Sebs has not seen at 1× is `NEEDS EYE`, **not** done. ⚠️ It marks
  every row `[MEASURED HERE]` or `[LANE CLAIM · NO ARTIFACT ON DISK]` — **do not quote an unchecked
  row as fact.** ⚠️ The other `RUN-QUEUE.md` files on this machine are the **portfolio's**
  and are a different scope; do not write engine rows there.
- **[PRD.md](PRD.md)** — the full project plan, phase map, and operating rules.
  Source of truth for *what* gets built and in what order.
- ⏹ **`HANDOFF-TO-OZ.md`** (repo root) — **NO LONGER THE CURRENT STATE.** Superseded
  2026-08-25, kept for its §4. **The state is [STATUS.md](STATUS.md)** (generated from
  disk by `scripts/gen/state.mjs` on every commit) and the contract a non-Claude-Code
  harness reads is **`HANDOFF.json`** (`handoff.py show`).
- ⏹ **All five other root handoffs are superseded in place as of 2026-08-28** —
  `HANDOFF-TO-FAE.md`, `HANDOFF-2026-08-02.md`, `HANDOFF-2026-08-04-OZ.md`,
  `SESSION-HANDOFF.md`, `MORNING-BRIEF.md`. Four of them said *"no commits"* on page
  one. Each now carries a header naming what is false in **that** file, with line
  numbers. **Do not read any of them for state.**
- **[DISPATCH.md](DISPATCH.md)** — how a lane is briefed here, and the rules a
  return is judged against. §5: *"stale scaffolding is drift with better formatting."*
- **[LANES-2026-08-07.md](LANES-2026-08-07.md)** — the overnight run: twenty-six
  lanes, what each owned, and what each found. ⚠ The controller's narrative stops
  after Lane O; **the per-lane truth is in `verification/lane-*/LANE-STATE.md`**,
  which every lane wrote continuously.
- **`SESSION-HANDOFF.md`** (repo root) — the older checkpoint series, a record of
  2026-08-01. At 187 KB it is the largest document here and it reads as live. It is not.
  It says *"the 51-error baseline"* four times; **the baseline has been 6 since 08-02.**
- ✅ **THE COMMIT EMERGENCY IS CLOSED.** This bullet said *"NOTHING HAS BEEN COMMITTED
  SINCE 2026-07-28 ... 2 365 changed paths"* for seventeen days after it stopped being
  true. **`5f3faa5f`, `4c752f1b` and `099e1ccc` landed 2026-08-24** and put a month of
  engine work in git. ⚠️ **The consequence underneath it still holds and still costs
  lanes:** a `git worktree` here is cut from an old commit and is not this repo, and
  `git status` inside one lies about what a lane changed. **Lanes run as plain copies
  under `~/.fs-lanes/`, never worktrees.** For live state read the generated block in
  [STATUS.md](STATUS.md), which no human types.
- **[hero-beat-storyboard.md](hero-beat-storyboard.md)** — the 2D-ink → 3D-object
  beat as key shots, breakdowns and in-betweens rather than as durations and
  dials. Names where the beat has no key shot at all, and proves it from the
  repo's own gates. Sheets in [storyboard/](storyboard/); method in
  [research/storyboarding.md](research/storyboarding.md) and
  `.claude/skills/storyboarding/`.
  > ⚠ **It is 3,700 lines and it reads back-to-front.** §1–§9 describe a beat
  > that no longer exists; §10, §11, §11.7 and §11.9 are successive reconciliation
  > passes and **each corrects the one before it in place**. Start at §11.9's
  > header note, then read backwards only as far as you need. The live beat is
  > **12.3667 s / 371 frames**, twelve phases; anything else you find in there is
  > a snapshot left standing on purpose.
- **The beat has one owner and it is `lib/hero-motion.ts`.**
  `scripts/capture/motion.mjs` is a downstream **manual paste** of its constants
  (the page's "Copy motion.mjs constants" button), and it has now been found
  stale twice in two days. If you change a beat, the paste is the last step and
  nothing gates it — see the storyboard §11.9.7.

## Explainers

One doc per system: the code, the tech, the math, and the reasoning. Written for
a designer — graphics/shader/math concepts are explained from first principles;
design reasoning stays brief. Read in order; each builds on the last.

| | System | The interesting part |
|---|---|---|
| [01](explainers/01-procedural-texture.md) | Procedural texture | Why patterns are *computed* from position instead of wrapped from an image, and how value noise avoids grid seams |
| [02](explainers/02-dither.md) | Dither | Ordered dithering, the Bayer matrix generated arithmetically, and why a pattern that only edits colour is invisible on glossy black |
| [03](explainers/03-ascii.md) | ASCII | Drawing letters with no font, the float-precision trap, and why a near-black subject breaks brightness ramps |
| [04](explainers/04-timing-system.md) | Timing | One clock, six sync modes, and why a one-shot that never quite stops isn't a one-shot |
| [05](explainers/05-layer-stack.md) | Layer stack | Why texture structurally can't be reordered, and what "taste" looks like as numbers |
| [06](explainers/06-stack-animation.md) | Stack animation | Animating the group vs animating the layers, and why time-based effects need an explicit origin |
| [07](explainers/07-engine-passes.md) | Engine passes | What changed when geometry was unlocked across all four engines, and the one bug pattern that turned up in three of them |
| [08](explainers/08-hero-beat-and-registers.md) | Hero beat + registers | Tuning the 2D→3D stand-up live instead of by capture run, why it had to be an elevation arc, and the one material number that forced its own preset |
| [09](explainers/09-four-gaps.md) | Four gaps | A control that worked and couldn't say so, curvature-adaptive tube sampling from the sagitta, and a half-pixel zig-zag rendered at full contrast |
| [10](explainers/10-extrude-and-solid-silhouettes.md) | Extrude + Solid silhouettes | Chasing "the weird joints, it looks like some stupid machine wrote it" into the silhouette itself |
| [11](explainers/11-gloss-rim-and-the-guard.md) | Gloss rim + the guard | Judging geometry on matte is judging it with the evidence turned off — and a guard whose failure mode was the worst available answer |
| [12](explainers/12-desk-doodles-engine-port.md) | Desk Doodles engine port | A second engine carried across as files, the empty array that killed the render loop and wrote fifty identical PNGs, which engine wins in which mode, and the taper prediction that only reproduces at heavy ink |
| [13](explainers/13-measuring-the-rim.md) | Measuring the rim | Two numbers that turned out not to mean what they said, and what it takes for a measurement to be evidence |
| [14](explainers/14-the-flat-to-solid-beat.md) | The flat→solid beat | The 2D→3D transition the whole product is about: why it is one mesh and not two layers, the flip Desk Doodles never actually built, and a dropped frame that was deleting the centrepiece |
| [15](explainers/15-screen-layer-quality.md) | Screen-layer quality | A tone window five times wider than its subject, a glyph cell measured in device pixels that put every ASCII preset under the legibility floor, four presets that were duplicates or dead, and three harness bugs that produced *passing* evidence |
| [16](explainers/16-the-rim-and-the-bead.md) | The rim and the bead | Rod's joint predicate was inverted and the census that measured it had gone structurally blind; Solid gets the bevel it never had, via an inward offset whose guard was noise until it stopped asking the raster questions finer than a cell — and then §4–§7 are the third time that same guard was noise (one cell was 1.7 too few, measured over 1329 vertices), the bevel whose two axes disagreed so a clamped vertex stood up as a 65.9° cliff instead of narrowing, the closed loop whose seam corner lost its bead to an exclusion whose reason had expired, and three census rows whose denominator made their own question unanswerable |
| [17](explainers/17-the-rim-in-the-round.md) | The rim in the round | The same 90° had three different causes: Inflate's was the ink taper's unbounded slope at the tip (fixed by making rings the envelope of the balls, so the end cap is tangent by construction), Extrude's 153 non-manifold edges were a closed loop built with two overlapping caps, its 8–12 boundary edges were T-junctions arithmetically guaranteed at six per cap, the draft taper is wired about the mark's centre and proved able to fail — and the census had been scoring a triangle with no normal as exactly 90 |
| [18](explainers/18-the-reveal-stopped-rebuilding.md) | The reveal stopped rebuilding | Measuring the 1.1s stall found a ramp rather than a cliff — a rebuild of the implicit surface already over a frame budget at five percent of the word, ~120 of them per draw-in — so the reveal became Rod's `setDrawRange` over an arc-length ordering derived from the field, proved index-order-only byte for byte; and only then was it safe to hand the playhead to DialKit, whose transport has no clamp |
| [19](explainers/19-the-elbow-and-the-fold.md) | The elbow, and the instrument that could not see it | `square/inflate`'s 89.6° was never a crease — the loft passes through itself at a corner because `r·κ < 1`, the other half of the embedding theorem, had never been checked anywhere; the crease census is *structurally* blind to that (a fold is antiparallel faces, which `min(acos d, acos −d)` scores as SMALL), proved on two synthetic tubes identical but for a spacing that decides the fold in closed form; the 620° corner probe rebuilt and bisected down to the exact 90 it should have read; and what `blend` actually does, which is nothing at a drawn corner and exactly `√2(r + k/6)` at a seam |
| [20](explainers/20-the-build-left-the-main-thread.md) | The build left the main thread | Every dial touch froze the app for a second; moving the geometry build to a worker fixed it and brought a deadlock with it — one `tsc` was *structurally* unable to notice, because it resolves no worker URLs and walks no bundle graph |
| [21](explainers/21-losing-your-work.md) | The five ways this app could lose your work | *Nobody pays for a tool that loses their work.* Five defects measured against that one sentence — all five had shipped, and every one is silent by construction, which is how they survived a product carrying 67 assertion gates |
| [22](explainers/22-the-ink-that-came-back-off.md) | The ink that came back off | Sebs's `o` losing its edge was never the `d` beside it — Desk Doodles' Inflate parametrises its radius on normalised position along the polyline it is HANDED, so a reveal that rebuilds from a growing clip re-shapes every millimetre already on the page (36 of 40 steps lossy, worst 16.07 %); the fix is explainer 18's, with the arc coordinate read off the builder's own uv V channel, and it turns the pen tip on for that engine as a side effect. Then 255 ms of React per gesture spent re-creating 22 meshes for a `flatten` object nothing rendered reads |
| [23](explainers/23-the-seam-the-slabs-were-hiding.md) | The seam the slabs were hiding | The slabs were removed and 11 gate rows read ALL PASS while the picture was still wrong — and the second wrong was worse, because the slabs had been *covering* a white crack through three joins. Two letters at the SAME yaw about DIFFERENT pivots are two different rigid motions, separated by `(I − R)·Δpiv`, so every join in the settled hold opened by `1 − cos 30°` of the pivot separation; the word never narrowed into its turn and the missing width became the gaps |
| [24](explainers/24-the-attribute-that-outlived-its-surface.md) | The attribute that outlived its surface | The font word went blank from DRAW 94 % to the end of the beat while submitting **335 820 valid indices at full opacity** — because WebGL validates a draw against EVERY enabled attribute, not just `position`, and **drops the whole call** when one is short. An off-thread rebuild refills the live geometry in place (which is the only way it reaches the screen without React), and `aFsLetter` survived it at the previous build's length: 59 936 against 58 998. Two of the three outcomes are silent — the crash was the lucky branch. Also: the message naming it was on the console at **warning** level, which every probe here filtered out — 181 times in the original run and 256 in the audit, because that count is a symptom (frames rendered while broken), not a property of the defect. Audited 2026-08-07 and the closure holds; the audit also found the gate could not fail on either half of the fix alone, which is now nineteen rows and two known-bad arms. **The file now carries FIVE corrections and a §10** (346 → 1040 lines): the fifth is a class it had no category for — the opening table's `indices out of range` row is not overstated but **wrong**, because `firstBadIndex` audits `position` only and the bad index was in `aFsLetter`, so the table printed "not it" beside the candidate whose name is the actual cause |
| [25](explainers/25-the-power-set-of-fusion.md) | The power set of fusion | *"there should be a fusion for every possible combo… so it would be like 2 to the power of 7"* — 120 reachable cells, and the two dials that read dead. **The duplicate count is 3, not 1, and the second measures 38.30 apart on pixels against a closest pair of 10.46**, so a pixel gate was never going to find it: *pixels answer "do these look alike", not "are these the same idea."* And the prior duplicate gate could not fail on its own question — it computed `nearest`, printed it, and asserted nothing about it, so all four runs read ALL PASS **including the one that contained the real duplicate**. Both dead dials resolved to mechanism at `file:line` and they were different faults wearing one sentence: `viewTurn` was genuinely inert in the state it is selected in (`atan2(camera.x, camera.z)` is 0 head-on, and `phaseTriangle`'s quarter-period offset makes `phaseTriangle(0, 2π)` exactly 0) — 0.13 → 36.96; `slowWeather` is **alive** on Loop at 59.27 and collapses on Burst at 6.01, left untouched under §0.7 and answered with a new cell rather than a change. ⚠ the file's own H1 still reads `# 24 ·` — the renumber to 25 never reached the title |
| [26](explainers/26-the-draw-in-became-a-decision.md) | The draw-in became a decision | *"I have no way of keyframing, editing any of the motion of the strokes."* Every control in the product shaped the draw-in's **clock**; not one could say which part of the mark draws when. `lib/stroke-schedule.ts` is a per-stroke translation of the arc axis at slope 1 — `S(a) = (u_i + (a − a_i)) / T` — and two properties carry the whole design: `order: asDrawn · overlap: 0` is the identity **exactly**, and every consumer short-circuits on it, so at the default *not one line of the feature executes*; and `dS/da = 1/T` is one constant for the whole word, which is what makes the pen tip two uniform multiplies instead of a third texture channel. Then the reveal became a **window** — `{ x : lo < S(x) ≤ hi }`, with `Grow` pinning `lo` at 0 and therefore being the identity again. The finding underneath it: **`min` and a remap do not commute.** The tip field's `arc` channel is a minimum over the samples covering a texel, and a remap commutes with `min` only while it is increasing over the whole word — true for `order`/`overlap`/`align`, **false under a reverse**, which keys the texel to when the nib *last* covered it and puts the nose one nib diameter off the ink. Negative control both times: **40/40 then 48/48 frames byte-identical** across five independent pairings, instrument calibrated before a line was written |
| [27](explainers/27-the-gates-that-measured-the-wrong-tree.md) | The gates that measured the wrong tree | *"73 of 81 in no sweep"* is now 1 of 89 — and that was only ever one of three questions. **35 of the 48 browser gates never import `lib/dev-server.mjs` and hardcode `http://localhost:3000`**, so a lane battery on its own port prints 48 greens of which 35 are about somebody else's tree — proved by request-counting, not by reading: one lane's own server logged `/` six times across a whole battery while `assert-mode-rims` printed 189 green rows. `FS_URL` is a fourth name for the knob that the legacy-name throw has never heard of; `assert-hero-dials` — advertised here as the panel gate — keeps its whole browser arm behind `--live`, which no runner passes, and ran in 0.3 s without opening Chrome; `assert-moment.mjs` was in no sweep because both runners scanned one directory; and 10 of 39 model gates are structurally blind in any tree built without `docs/verification/`. Plus the `dit_pulse` open item, which turned out to be a pre-fix number outliving its fix by three days, on a file that contains no pulse code at all |
| [28](explainers/28-the-knob-with-four-names.md) | The knob with four names | Explainer 27's 35 port-blind browser gates, closed — but every step of *proving* a conversion took turned up a defect the previous step could not see. `grep … assert-*.mjs` missed `geometry-baseline.mjs`, a DISPATCH §3 **required** tool whose hardcoded `:3000` poisons not one verdict but every later comparison. `assert-tsc-baseline.mjs` already honoured `FS_PORT` — through its own **private copy of the port line**, which opts out of the legacy-name throw and so ignored a set `HERO_URL` in silence; *"reads `FS_PORT`" was never the bar, "imports the resolver" is.* `FS_URL` was a fourth name the blacklist had never heard of, which is why the defence is now a **whitelist**: a script may not name a dev server at all. And `assert-one-knob.mjs`'s own ratchet had to be rewritten when its negative control showed a **file**-count sitting green while the debt grew inside an already-dirty file. 35 files converted, 31/31 reached a request witness that had been proved able to hear silence, and **zero went red against the tree they are now correctly pointed at** — `assert-mode-rims` printed the same 189 PASS, `assert-texture-relief` the same 7 rows in 27.3 s against 27.2 s. Identical judgement, corrected subject |
| [29](explainers/29-the-gate-that-never-opened-the-browser.md) | The gate that never opened the browser | This index advertised `assert-hero-dials` as the panel gate while it ran **0.3 s, emitted 4 rows and never launched Chrome** — its browser arm sat behind `--live`, and neither battery passes a flag. Explainer 27 called this a class of nine; read one by one it is **six**, and only two of the nine survive: `--no-http` and `--app` are INVERTED (the bare run is the *fuller* one) and five `--save` arms record baselines rather than judge, so running them would *delete* the judgement. Four gates nobody had listed do have the defect. The pattern under it is the finding: **the withheld arms are almost all NEGATIVE CONTROLS**, so the machinery proving these instruments can fail is the machinery no sweep runs — and the meta-gate had been computing that answer since the day it was written, reading it only for gates that had already failed. Plus: the live arm's rows printed `live`/`DEAD`, which **no scoreboard in this repo parses**, so even with the flag those four verdicts would have been invisible — a third way to be green while measuring nothing. And `assert-export-app`'s `=== 0` bar, re-measured across 24 end-to-end runs, is met **every time**; the *"0–2 px, intermittent"* comment used to excuse it was describing a different row |
| [31](explainers/31-the-controls-that-no-sweep-ran.md) | The controls that no sweep ran | Explainer 21 §7 is this repo's law — *"the gate runs three kinds of control on the default invocation, never behind a flag"* — and nobody had ever measured whether the repo obeys it. All 89 gates **READ**, fanned out eight ways with a mandatory line-cited verbatim quote per verdict and every citation then checked mechanically (84/85 exact line matches). **62 of 89 run a control bare; 7 partial; 19 none.** The sharper number is beside it: **channel J, the gate built to catch this class, sees 2 of the 19 — and one of those by accident**, because `EMIT_RE`'s `\bFAIL\b` does not match `FAILED`, so *"…FAILED TO BITE"* is invisible and *"…FAILED TO FAIL."* is visible only for ending in a full stop. Four gates have no control mechanism anywhere, and `assert-gloss-rim` calls two known-**GOOD** fixtures "the control", which is worse than having none. And every arm of `assert-layer-flicker` printed behind a bracket prefix, so **all eight control rows were invisible to every scoreboard** while 53 subject rows were counted — 5 min 50 s of work no sweep could read |
| [33](explainers/33-a-grep-cannot-tell-code-from-prose.md) | A grep cannot tell code from prose | The machine deciding WHICH battery runs a gate matched `chromium.launch\|playwright\|puppeteer` against **raw text**, so a token in a string, in a fixture, or **in a comment explaining the rule** classified the file — which is why `assert-one-knob.mjs` could not be fixed by moving the token and had to DELETE it, leaving a gate forbidden from naming three identifiers in its own documentation. It failed the other way too: source-local, so `assert-hero-word-legible.mjs` sat in the MODEL battery while spawning a child that launches Chrome. Parsed now — driver import specifier / launch callee / browser child / declared directive — calibrated on every battery run, with `assert-one-knob.mjs` **reconstructed in both of the states it failed in** as the known-bad. Plus: `assert-tsc-baseline` was the one gate of 32 that stayed GREEN against a dead port and now exits **3 · PARTIAL**; `assert-data-safety` printed **85 PASS rows** before failing and now refuses first; and the row parser was blind in the other direction as well. The headline went 29/44 green and *"633 rows"* to 28/43 and 606, and **every number that moved, moved because something stopped counting as evidence** |
| [34](explainers/34-what-counts-as-a-judgement.md) | What counts as a judgement | Explainer 31 found channel J seeing 2 of the 19, so this pass made the instrument see them — and the number it reports **got worse**, which is the correct outcome, with no bar lowered. The cause was one file disagreeing with itself: channel J defined a judgement **lexically** (a verdict token in a blocked `console.*`) while channel B, twelve hundred lines up, defined it **structurally** (*a verdict that reaches the exit code*). J now also counts a blocked, non-`catch`, failure-capable `process.exit()` — a value `s.exits` that had been computed on every sweep since the file was written and read only by B, the same shape as the `deadEmissions` finding that created J. The token alphabet was chosen by **measurement**, not taste: `PASSED` 8 hits, `PASSES` 1, `FAILED` 40, `FAILS` 6 all IN; `FAILURE`/`FAILURES` 39 hits **OUT**, because they are a count and not a verdict. Proved on the 48 real browser-battery logs: rows +0, red +0. **J: 2 → 9 of the 19; named every run by J + K: 2 → 18.** The nineteenth is not reported because it was actually fixed |
| [35](explainers/35-the-capture-that-grabbed-the-wrong-canvas.md) | The capture that grabbed the wrong canvas | Seven frames out of 360, on one take of three, in a directory nobody diffs — no page error, no GL warning, no exception, no red row. `apiGrab` resolved its target with `containerRef.current?.querySelector("canvas")`, i.e. **the first canvas in document order**, on a page with two canvases whose containers carry **byte-identical class lists**. Resolve-by-POSITION. Fixed to resolve by IDENTITY through the R3F canvas ref, and `grabInfo()` added so a capture can now **say what it grabbed**. The 40-px height change was found and attributed on the way — the viewport is a flex child whose size follows the geometry mode's config strip, which the file's own `stillSize` comment already said and nobody had connected to capture. The 1584-px width did **not** reproduce in 360 frames of deliberate repro, and is recorded as not-reproduced rather than as not-real. This is the night's defect family in one file: *an instrument whose SUBJECT differs from its CLAIM* |
| [36](explainers/36-the-known-bad-that-was-written-and-parked.md) | The known-bad that was written, and parked | Of explainer 31's nineteen, thirteen are the strange half: **someone wrote a real known-bad, wired it correctly, gave it a required-red table — and put it behind a flag nothing types.** The work exists and is correct and has simply never run, so every green above it was worth what an unrun control is worth. **13/13 now run bare; 31 control rows; 31 proved to fail by mutation** — at a cost of 1.75 s on the model battery. Naming the row each control must redden caught two mutants a *"some row went red"* control would have passed. One correction is worth the whole pass: `assert-pen-field-alloc`'s first version ran both arms in ONE warm page and **the control failed to bite**, because `texStorage2D` sizes storage at the first upload, so an arm run second inherits an allocation that already matches — the defect's own definition, defeating the control written for it. **And one bare run found a real defect** (explainer 42) |
| [37](explainers/37-the-defect-that-was-a-path.md) | The defect that was a path | *"`assert-one-knob` cannot see this: the defect is a PATH, not a URL."* Six scripts hardcoded an absolute path into the shared checkout for their **output**, and one `rmSync`'d it first — a lane running that capture on its own port did not merely file wrong evidence, it **deleted the shared checkout's stored evidence before writing**. Worse still is the INPUT case: `assert-texture-motion.mjs:32` read `lib/style-system.ts` absolutely, so the set of rows the gate grades came from the shared tree no matter which tree it ran in. Two new channels, both parsing (a grep-based path channel is wrong on day one, because another gate discusses this very defect in a comment that spells an absolute path). **And the ratchet was welded shut in one direction and leaky in the other**: nobody but the owner could lower the baseline, and a RED run could raise it — `--record` ran before the sweep and wrote a number produced by a failure. It runs last now and refuses while any non-ratchet channel is red. Headroom is free violations: 85 sites of it is 85 of them |
| [38](explainers/38-the-exporter-that-did-not-know.md) | The exporter that did not know | Two lanes made the draw-in authorable in one night and nobody asked what the thing that *exports* it made of that. `grep -c "stroke-schedule\|scheduleArc\|revealWindow" lib/export/*.ts` → **0 across all six files**. The export does carry the motion (0 of 51 frames differ, 0 px of 1 123 584; the identity-schedule control differs on 36/51), and the frame plan's duration is correct to 2.220e-16 — but `planFrames` **assumed the reveal ends FULL**, which is false in **5 of the 8** window×reverse states the app can reach, including the transport's shipped Reverse, welding 18 blank frames to the tail. Underneath it: with no hold, `planFrames` never emitted a clock-1 frame at all — last frame at 0.986537, the mark **1.35 % unfinished**, and the hold had been covering that for every export this module has ever produced. Measured at the real Video button afterwards: Vanish **59 → 41 frames**, `grow` byte-identical |
| [39](explainers/39-one-frame-is-not-a-channel.md) | One frame is not a channel | Explainer 24's ruled-out table shipped; a later lane re-ran it with a negative control and found two rows that **measured nothing**. This pass ran both directions on every channel, on three surfaces, and the answer was not the one anybody was set up for. **The dead key was a single occurrence — 25 files read in full, not one of them passes a key that does not exist** — so the obvious inference from 24 is wrong, and saying so is worth the night nobody now spends chasing it. What is real is the class underneath: **an OFAT arm reports about nothing for three different reasons that produce the identical sentence**, and only one is a typo. `lit` reads 0 in both directions as a single-key arm and is not a dead dial — the rim term is multiplied by `(1 − k)`, so at `ink 1` it is exactly zero whatever `lit` is; held at `ink 0` the pair separates by **25 390 px**. Every one of the eleven numeric channels is live on at least one surface, and **no single surface makes all eleven live**. Also: **1 of 28 files reads what `setFlatten` returns**, while at least eight of the other twenty-four check a *different* control's return in the same file — the discipline was in the file and skipped this one setter |
| [40](explainers/40-refuse-the-frame-not-the-window.md) | Refuse the frame, not the window | Explainer 27 §5 read a rest-Δ of **5.931** which was `65.241 / 11` — one frame — and that frame was blank paper at mean luminance **252.171**, after which it never moved again; the cause was read as a headed Chrome throttled by macOS. Explainer 37 §6 went to measure whether that reproduces and **it did not**: across three 8-second arms and two 180-second arms, *the headed-vs-headless difference is smaller than the headless-vs-headless noise floor.* So the defence is not the window, it is the frame. `scripts/verify/lib/frame-guard.mjs` refuses a frame that carries no mark, a run whose motion statistic is carried by one Δ, and a run of byte-identical frames where the caller **declared** motion — with opposite defaults from opposite measured base rates (BLANK is 2 of 56 in a healthy capture and is checked always; FROZEN is **19 of 55 pairs at Δ exactly 0** in the same capture and is checked only where motion was declared). Three of its own arms failed first, each a real defect — including a baseline contaminated by the frames it judges, and a frozen predicate that refused ONE repeated frame, which a quantised threshold map really does produce |
| [42](explainers/42-the-arm-that-was-expected-to-pass.md) | The arm that was expected to pass | Explainer 36 moved thirteen known-bads onto the default path and counted one line that mattered more than the other twelve: **real defects found on first running a control — 1.** This is that defect. `assert-hero-k7-intact`'s parked `terminals` junction law had **never been run by any sweep**, and the file's own header said it *"is expected to PASS"*. It does not: at the shipped carve 0.70 it splits a 3232 px part into **2330 + 777**, and the identical 777 px fragment — the upper half of the final `s` of *Doodles* — appears on all three red arms. The attribution is **set arithmetic, not an OFAT sweep**: the three red arms intersect in `{7-8, 18-19, 18-20}`, the two green arms cover `{7-8, 18-19}` plus self-crossings, and the difference is exactly **`18-20`**. The ending taken is that the law is wrong and correctly so — §0.7 forbids reworking a parked arm, and there is nothing to rework, because the margin admitting 18→20 *is* `terminals`. Two more things fell out: **the mechanism first reported was the wrong layer**, traced to one stale sentence (*"AND IT IS NOT YET WIRED"*) that had propagated through **four documents**; and a node twin of the shader came back intact on all five arms because it substituted the pen field's TUBE channel for the silhouette — *the tube channel of an SDF is an envelope, never an outline* |
| [43](explainers/43-the-subject-and-the-claim.md) | The subject and the claim | **The night's one finding that outranks the others, and it is not a defect — it is a shape.** Seven times in one week an instrument was found measuring something other than the thing its output was about, each found by accident and each written up separately. *"An instrument has a SUBJECT — the thing it actually touched — and a CLAIM — the thing its output is about. Nothing in this repo made them equal, and nothing was checking."* The seven: **the tree · the checkout · the canvas · the invocation · the scoreboard · the pose · the launch mode.** Every one was green or silent at the moment it was wrong, which is the property that makes the family expensive — **a wrong subject does not throw**; it produces a well-formed answer to a question nobody asked, in the format of an answer to the question they did. And none of the seven is a badly written instrument: `querySelector("canvas")` returns the first canvas exactly as specified, `\bFAIL\b` matches `FAIL` exactly as specified. **The defect lives in the distance between what the instrument did and what its output was taken to mean — which is in nobody's code.** So the question that catches the eighth is not *"is this correct?"* but *"can this choose its own subject?"* Read this one before the six explainers it generalises |
| [45](explainers/45-the-index-that-nobody-could-write.md) | The index that nobody could write | Twenty-six lanes ran, every one was forbidden from editing this file and told to RETURN its index rows — **19 discrete paste-ready rows came back across five lanes, and 3 were landed**, all three from the first lane to return any (and a twentieth set never existed: one lane's ledger says *"rows in §9"* twice and its state file has no §9) — so by morning **the index was the least accurate document in the repo**, which is the failure it exists to prevent. Four lanes answered *"how many gates are there"* four different ways on one day and **none of them was wrong**: the population grew 81 → 89 → 94 → 96 → 98 → 99 as lanes landed gates, twice while this row was being written, and the two live counters measure **different sets by construction** (`run-battery` walks the repo and excludes the meta-gate; `assert-one-knob` scans `scripts/verify` and includes it — they land on 97 apiece by one file in and one file out). **67 of the 98 gates were named nowhere here** (63 of 99 after this pass, and the first draft of that number was itself measured against a half-edited file — instance eight, committed inside the paragraph describing it), and the cost of that changed last night without anyone noticing: since discovery went repo-wide and the classifier started parsing, an unlisted gate is still swept, so what is left is a documentation hole whose failure mode is that a reader **writes a second gate**. The structural cause is that the protocol had twenty producers and one writer, and the writer was also the thing dispatching the twenty — a queue with no artefact, no red row and no list, which is the same silent-and-self-consistent profile as the seven instrument defects found the same night. **The only part of the record that did not go stale is the one with no bottleneck:** nineteen `LANE-STATE.md` files, one writer each, written continuously |

> **THE NUMBERING HAS GAPS, AND THEY ARE DELIBERATE. DO NOT REUSE A NUMBER.**
> **30 · 32 · 41 · 44 are empty.** They were allocated during the 2026-08-07 overnight run
> to lanes that were stopped, died, or have not landed. `docs/LANES-2026-08-07.md` names the
> owners of 28, 29, 31 and 33 and **never names an owner for 30 or 32** — the record cannot say
> who held them, and that is itself the finding. 41 sits between 40 and 42 with no claimant in
> any lane state. **43 landed at 10:0x on 2026-08-07, while this note was being written** — it had
> been written-and-unlanded in a lane tree an hour earlier, which is why the gap list moved
> under its own author. **44 is a live lane's declared, unwritten deliverable.**
> Renumbering to close a gap would break every citation in every other explainer, and §0.7's
> no-deletion rule applies to the record as much as to the code. Verified 2026-08-07: **no
> explainer in this repo cites 30, 32, 41 or 44**, so the gaps are currently harmless — which
> is exactly the state a helpful renumber would end. Explainer **45** is numbered 45 and not 41 for
> that reason: reusing 41 would work today, and the rule that survives contact is *do not reuse a
> number*, not *do not reuse a number that is currently cited* — the second requires everyone to
> re-run the check, and the first does not. **The next free number is 46.** Explainer 45 §7 is the
> full record of who held what.

## Research

Every online source used while building, with what it is, what it does, and what
we used it for.

- [handwriting-variability.md](research/handwriting-variability.md) — the
  Sigma-Lognormal model, real parameter envelopes, and why perturbation must be
  one draw per instance rather than per stroke
- [stroke-width-models.md](research/stroke-width-models.md) — the nib as an
  affine change of variables, and why width follows direction rather than speed
- [desk-doodles-register.md](research/desk-doodles-register.md) — where every
  number in the Desk Doodles register comes from, and the laws behind them
- [desk-doodles-handfeel-port.md](research/desk-doodles-handfeel-port.md) — what
  makes their marks read hand-drawn, and what ours is missing
- [extrude-solid-quality.md](research/extrude-solid-quality.md) — the silhouette
  audit behind explainers 10, 11, 13, 16, 17 and 19; §9 is Inflate's canal
  surface and §10 is the elbow — the *other* half of the embedding theorem
  (`r·κ < 1`), which had never been checked, and why no crease census could have
  found it
- [hero-2d-to-3d-transition.md](research/hero-2d-to-3d-transition.md) — what Desk
  Doodles actually shipped for its flip, why the two-layer build cannot register,
  and what the 3D path can be driven to instead (explainer 14)
- [material-fusion-stack-timing-craft.md](research/material-fusion-stack-timing-craft.md)
  — the material, fusion, stack and timing craft pass
- [reference-film-mechanics.md](research/reference-film-mechanics.md) — the three
  Desk Doodles reference films read frame by frame at native rate: every cut
  time, every hold duration, the spacing of all 22 transits (**nothing with a
  silhouette is spaced evenly** — moves are arrivals at 9–37 % or wind-ups at
  79–93 %), Exquisite Corpse's assembled-figure reveal down to the **625 ms of
  empty frame** that buys it, and eight measured corrections to Desk Doodles'
  own craft docs — including that there is **no Ken-Burns drift anywhere in any
  of the three films**, that Babbu's element pops have **no scale-overshoot**,
  and that its "width-tween" is a one-frame swap. Frames in
  [verification/reference-films/](verification/reference-films/)
- [storyboarding.md](research/storyboarding.md) — what a board is actually for,
  the key-poses → breakdowns → in-betweens workflow, the notation that turns a
  board into a timing plan, and the honest finding that nobody has written this
  discipline up for interface motion (behind [hero-beat-storyboard.md](hero-beat-storyboard.md))
- [texture-phase.md](research/texture-phase.md) — shader injection, GLSL noise
- [dither-phase.md](research/dither-phase.md) — ordered dithering, Bayer, IGN
- [ascii-phase.md](research/ascii-phase.md) — bitfield glyphs, and the one
  finding no source covers (dark subjects)
- [screen-space-layer-quality.md](research/screen-space-layer-quality.md) — why
  a rail preset cannot know its own material, the tone window measured against
  the subject's real σ (and the overshoot that proved it clips as easily as it
  flattens), device-pixels-per-glyph-pixel as the actual legibility constraint,
  and why braille's sub-cell trick is architecturally void for a bitfield shader
  (**does it look good** — every number labelled measured / derived / open)
- [ascii-glyph-resolution-and-temporal-stability.md](research/ascii-glyph-resolution-and-temporal-stability.md)
  — the exact braille bit formula from the standard, why stacked combining
  diacritics are a documented dead end (the vertical increment is GPOS
  mark-to-mark anchor data, which a fontless bitfield shader cannot have) with
  the dots-per-cell arithmetic, and the root cause behind "these options are
  weak": **animating a quantised index instead of the value that gets
  quantised** — including the proof that translating an ordered dither matrix
  can never be smooth, measured at the true 120 Hz frame rate
- [timing-and-stack-phases.md](research/timing-and-stack-phases.md) —
  Porter–Duff blend formulas, the layer-group interaction model, and the three
  findings that came from no source at all
- [rock-3d.md](research/rock-3d.md) — the sibling engine that reads a mark before
  rendering it, why its rotatable half never converged and ours has the same dead
  classifier, and the harness built to catch one specific lie
- [reveal-cost-and-timeline-ownership.md](research/reveal-cost-and-timeline-ownership.md)
  — the measured cost curve of the implicit reveal and why each of the four
  obvious fixes fails on the numbers, plus what DialKit actually does with clip
  values (read out of its bundle) and why that decided the wiring
- [rigid-transforms-and-the-letter-seam.md](research/rigid-transforms-and-the-letter-seam.md)
  — what "a rotation about a pivot" is as a map, why two of them at the same angle
  are *not* the same motion, and what the graphics literature already knows about
  geometry straddling two transforms (sources saved to `research/_sources/`)
- [webgl-attribute-validation.md](research/webgl-attribute-validation.md) — the
  WebGL 1.0 §6.6 normative text behind explainer 24: a draw is validated against
  every *consumed* enabled attribute, and a conforming implementation "may
  generate an `INVALID_OPERATION` error and **draw no geometry**" — or may hand
  the shader garbage instead, which means the blank screen was the *lucky* branch
  of an implementation-defined choice. Plus why `BufferGeometry` has no invariant
  tying its attributes to each other, why `dispose()` preserves the hazard, and
  why the message naming it is a console **warning** (sources saved)
- [stroke-animation-toolsets.md](research/stroke-animation-toolsets.md) — twenty-five
  references on how other tools let you animate a stroke being drawn, every one
  captured through the provenance gate and read first-hand; what each one *actually*
  does rather than what its marketing says. Behind
  [animation-toolset-map.md](animation-toolset-map.md) and explainer 26
- [fusion-combination-space.md](research/fusion-combination-space.md) — what was read
  before authoring 120 relationship cells, what each source actually says, the specific
  decision it changed, and — at the end — the part **no source covers**, which is most
  of the hard half. Behind explainer 25
- [off-thread-geometry.md](research/off-thread-geometry.md) — why touching a dial froze
  the page for a second, and which of the five candidate fixes survives contact with a
  profile. Behind explainer 20
- [undo-redo-conventions.md](research/undo-redo-conventions.md) — the evidence behind
  `lib/undo-stack.ts`'s five decisions (snapshot over command · a 500 ms coalescing
  window · a 100-step cap · linear redo · what ⌘Z deliberately cannot reach), who else
  landed on them, and **the two places the sources do not agree and we had to choose**
- [online-reference-mechanics.md](research/online-reference-mechanics.md) — eleven
  downloaded clips, **10 373 frames** measured at native rate, fetched because the three
  Desk Doodles films contain no dimensional transform at all (confirmed across 2 942
  frames) and the hero beat is exactly that. Provenance in [refs-online/](refs-online/)
- [competitive-landscape-and-the-missing-export.md](research/competitive-landscape-and-the-missing-export.md)
  — the landscape, the one thing, and the export that carries it; §0 is a re-run recipe
  for everything in the doc

## Verification

`verification/<pass>/` holds the frames proving each build pass. This is the
standing rule made concrete: every edit that changes rendered output gets frames
captured *and looked at*, at high frame counts.

| Directory | What it shows |
|---|---|
| `texture-v1/` | 5 patterns × 4 modes, plus animated motion runs |
| `dither-v1/` | 5 threshold maps × 4 modes, plus matrix crawl and threshold sweep |
| `ascii-v1/` | 5 charsets × 4 modes, plus 4 animation behaviours |
| `timing-v1/` | each sync mode under conditions designed to expose it |
| `stack-v1/` | progressive layering, order, blend, opacity, and the 5 presets |
| `stack-anim-v1/` | each group behaviour, including freeze-on-complete |
| `screen-layers/before`, `screen-layers/after`, `screen-layers/final` | every rail preset on its engine's own default material, 4 modes × 5 rails, plus dial sweeps, motion strips and mp4s — the evidence for explainer 15 |
| `reference-films/` | 21 timestamped contact sheets from the three Desk Doodles reference films at 2–24 fps, plus the measurement tools — the evidence behind [research/reference-film-mechanics.md](research/reference-film-mechanics.md) |
| `hero-transition/<label>/` | the hero beat, per capture run — scrub frames, a dense emerge window, `play.webm` / `scrub.mp4` / `emerge.mp4`. **Thirteen labels; two matter.** `k7final` is current (the round trip, the orthographic camera, the re-cut draw). `turn3` is kept as the historical arm because the `--gates=prior` readings taken from it are what make the gate rewrite's before/after readable. `reg-affine` / `reg-persp` are the projection intervention pair |
| `hero-k7/assert` | the K7 news frames — K1 against the returned flat, and the four mutation arms |
| `gate-integrity/report.json` | which scripts named `assert-*` are actually gates, per the meta-gate below |
| `gate-integrity/browser-logs/` | one log per browser gate from the last full sweep. **These are the repo's only real corpus of gate OUTPUT**, and three separate instrument fixes were replayed over them rather than asserted — the widened row parser moved 1032 rows to 1033 with 0 false positives across all 48 |
| `drawin-vanish/` + `BLANK-TAIL-FONT-WORD.md` | the blank-tail investigation and the twelve-row ruled-out table behind explainer 24. Its `laneD-audit/` sub-directory is the **independent re-run**, kept beside the original rather than overwriting it |
| `stroke-schedule/` | ⚠ **HOLDS ONLY `refs/` IN THIS CHECKOUT.** The schedule and reveal-window evidence — `before` / `before2` (the instrument's own calibration), `final` / `after*` (the negative control, 48 frames byte-identical across five pairings), `film-window/` (three films), `window-arms/` (a 384-frame OFAT sweep) — was measured but **has not been merged**, and sits in `~/.fs-lanes/lane{B,H,M}/docs/verification/stroke-schedule/`. Checked on disk 2026-08-07: canonical has one sub-directory, the lane trees have ten. Explainer 26 cites numbers this checkout cannot show you |
| `lane-*/LANE-STATE.md` · `unfinished-lane-*/LANE-STATE.md` | **the 2026-08-07 overnight returns, one directory per lane.** Each was written continuously rather than at the end, so a lane that died still left its measurements. They are the primary source for everything in explainers 27–42, and they carry the numbers at more precision than the explainers do. `unfinished-` marks a lane that was stopped mid-flight; its state file says exactly what was and was not measured |

## The tools

Run these with the dev server up (`pnpm dev`):

```bash
node scripts/verify/verify-style.mjs --pass=<name> --system=texture|dither|ascii
node scripts/verify/diff-frames.mjs  --pass=<name>   # reads / faint / too subtle
node scripts/verify/verify-gates.mjs                 # rebuild + export + taxonomy
node scripts/verify/verify-timing.mjs && node scripts/verify/assert-timing.mjs
node scripts/verify/verify-stack.mjs  && node scripts/verify/assert-stack.mjs
node scripts/verify/verify-stack-anim.mjs && node scripts/verify/assert-stack-anim.mjs

# Rail presets on the material they actually ship with, all four modes.
node scripts/verify/verify-screen-layers.mjs --label=before --only=stills
node scripts/verify/verify-screen-layers.mjs --label=before --only=sweep    # exposure x contrast
node scripts/verify/verify-screen-layers.mjs --label=after  --only=motion   # frames + mp4
node scripts/verify/assert-screen-layers.mjs --label=after   # floor, flattening,
                                                             # CROSS-rail duplicates

# Geometry: does a shell pass through ITSELF? The crease census structurally
# cannot answer this (a fold is antiparallel faces, which it scores as SMALL),
# so these ask a different question — sheets crossed by a ray, per component.
node scripts/verify/assert-elbow.mjs       --label=run   # square/inflate's corners
node scripts/verify/assert-fold-census.mjs --label=run   # every fixture x mode

# Any harness that drives the shared dev server can be poisoned by a sibling
# lane saving a file (fast-refresh remounts the scene mid-capture). Wrap it:
node scripts/verify/_run-clean.mjs scripts/verify/geometry-baseline.mjs --save=x

# THE HERO BEAT. Most of these judge the MODEL off the sampler — no browser, no
# capture — and every one of them re-runs its assertions against a parked prior
# arm that must FAIL. Run them after any change to lib/hero-motion.ts.
node scripts/verify/assert-hero-ledger.mjs      # the frame ledger + the 36% stillness bar
node scripts/verify/assert-hero-turn.mjs        # the moment: wind-up, dwell, sliver, edge
node scripts/verify/assert-hero-rise.mjs        # ease-out dominance, gather, overshoot
node scripts/verify/assert-hero-windup.mjs      # the tense releasing INTO the turn
node scripts/verify/assert-hero-camera.mjs      # the two seams, and lieEl telling the truth
node scripts/verify/assert-hero-hold.mjs        # K4
node scripts/verify/assert-hero-return.mjs      # K7, the round trip
# ...and EVERY PANEL CONTROL, judged in the state it is SHOWN in — the MODEL sweep,
# the panel DRIVEN in real Chrome, and the frozen-panel CONTROL, all on the bare
# invocation. ~26 s, and it opens Chrome TWICE (liveArm is called at :898 for the
# driven arm and :914 for the control). It used to run in 0.3 s and open nothing:
# the whole browser arm sat behind `--live`, and no runner passes a flag — which
# is why this line was a lie rather than a gap for weeks. Explainer 29.
node scripts/verify/assert-hero-dials.mjs
node scripts/verify/assert-hero-k7-news.mjs [--mutate=nobreak|shade|wash|alpha]
node scripts/verify/assert-hero-transition.mjs --label=k7final [--gates=prior]
# THE MOVING END OF THE LINE — is it a pen, or a cut? Its capture must be DENSE:
# 25- and 33-sample runs yield 1-7 measurable playheads and will correctly fail
# "enough playheads to judge". This was missing from this block, which is how it
# stayed off a regression list and shipped a broken control unnoticed.
node scripts/verify/_probe-pentip-sweep.mjs --label=<x> --samples=201
node scripts/verify/assert-drawin-pentip.mjs --label=<x>
# ...and DOES THE END COME APART? The shape dial is swept by _probe-pentip-shape
# (`--only=` picks arms, `--dsf=1` reproduces the raster the 2026-08-02 speck
# claim was made at — "a mark thirteen screen pixels wide"). Its known-bad is a
# tip that has been literally severed, because two gentler ones did not fire and
# both are recorded in the file.
node scripts/verify/_probe-pentip-shape.mjs --label=<x> --samples=201
node scripts/verify/assert-pentip-specks.mjs --label=<x>
# ...and WHAT DOES A BRAND-NEW FUSION DO? `assert-fusion-newborn` was NOT in this
# block, and that omission is the same one the pen-tip pair above records: a gate
# missing from the tool list stays off every regression list, and this one graded
# a feature that had shipped unable to act (a seed link reading a phase that is
# pinned to 0 by design, so a new fusion multiplied by exactly nothing).
node scripts/verify/assert-fusion-newborn.mjs
node scripts/verify/assert-fusion-authoring.mjs
node scripts/verify/assert-fusion-ui.mjs
# ...AND DOES EVERY PILL ON THE RAIL MOVE, AND IS EVERY COMBINATION OF STYLES
# ANSWERED? Sebs, 2026-08-04: "some dont animate, and i asked to have at least
# one fusion for every possible combo of styles." Neither question had an
# instrument — the three above grade a newborn fusion, the editor and the panel,
# so nothing could say no about the SET. §1 selects every pill through
# `applyPresetToStyleState` and requires its frame to travel; §2 enumerates the
# eight subsets of {texture, dither, ascii} and requires each to be non-empty.
# Both carry their own known-bad (a relationship at intensity 0, and the map with
# one preset withheld). Listed here because this file's own lesson is that a gate
# missing from this block stays off every regression list.
node scripts/verify/assert-fusion-rail.mjs

# ...AND DOES INK THAT IS ALREADY DRAWN EVER COME BACK OFF? A reveal is monotone
# BY DEFINITION and nothing about lights or the camera bears on that, so this
# asks the BUFFERS, in plain node. It runs BOTH mechanisms on BOTH engines and
# REQUIRES the rebuild-from-a-clipped-copy arm to fail — that arm is not a
# synthetic mutant, it is `filterStrokesByProgress`, the code that still drives
# Solid, Extrude and the Inflate loft. Explainer 22.
node scripts/verify/assert-drawin-monotone.mjs

# ...AND DOES THE MARK SURVIVE THE DIALS SEBS ACTUALLY MOVES? Every gate above
# loads a page and scrubs it. The font word's blank tail could not exist on a
# page that is only loaded — the first build of a slot never defers, and it takes
# a SECOND, off-thread build to leave `aFsLetter` describing the surface it
# replaced. So this one CLICKS the engine pill, CLICKS the word pill, DRAGS the
# wobble slider and CLICKS clean, and reads the buffers after each: every
# per-vertex attribute must span the index buffer at every dial position, because
# WebGL validates a draw against all of them and drops the WHOLE call when one is
# short. It reads the console at EVERY level (the message is a warning, which is
# why nothing here heard it), and its known-bad is the parked prior re-armed.
# Explainer 24. This is the second defect to live in the never-touched-a-dial
# hole; the r175 texStorage2D eraser was the first.
node scripts/verify/assert-drawin-attrs.mjs

# ...AND DOES THE SETTER REFUSE AN OBJECT IT CANNOT HONOUR? `setFlatten` returned
# `true` for a key that cannot exist while its two immediate neighbours already
# returned false, which is how `{flat: 0}` became a published OFAT verdict that
# had measured nothing. It validates and REFUSES THE OBJECT WHOLE now, guarded by
# a compile-time exhaustiveness check on the key list. This gate is that subject's
# home: 23 rows, a refused object moving 0 px against a MEASURED 0 px noise floor,
# and a known-bad that arms the parked prior inline on the bare invocation and
# disarms. Explainers 24 §10 and 39. It is a BROWSER gate.
node scripts/verify/assert-hero-flatstate.mjs

# ...AND IS EVERY GATE POINTED AT THE TREE WHOSE NAME IS ON IT? The meta-gate
# proves a gate CAN fail and the batteries prove it IS run; neither asks the third
# question, and on 2026-08-07 the answer was no for 35 of 48 browser gates. A
# script here may not name its own dev server: the URL comes from
# `lib/dev-server.mjs` or the script does not get one. Seven channels — hardcoded
# literal, a PRIVATE COPY of the port line (the subtle one: a gate can honour
# FS_PORT and still opt out of the legacy-name throw), a foreign knob name, a
# ratchet on the remaining capture-tool sites, a check that the ALLOW list has not
# gone stale, an ABSOLUTE CHECKOUT PATH (where a tool WRITES, and one of them
# rmSync'd the shared evidence first), and a URL hiding in a RegExp literal.
# It PARSES rather than greps, because two gates carry `localhost:3000` inside
# comments describing this defect — and because the naive //-stripper eats it out
# of the URL it was looking for. Explainers 28 and 37.
node scripts/verify/assert-one-knob.mjs             # 7 channels
node scripts/verify/assert-one-knob.mjs --mutate    # ...and can each of them FAIL?
node scripts/verify/assert-one-knob.mjs --list      # the remaining debt, by file
node scripts/verify/assert-one-knob.mjs --record    # pay debt down; REFUSES on a red run
# ⚠ RED as of 2026-08-07 10:0x, on channel B: `assert-export-window.mjs:73-74`
#   carries `process.env.FS_PORT ?? "3000"` and builds its own URL — a private copy
#   of the port line, the exact shape explainer 28 §3.2 exists for. Because
#   `--record` refuses while any non-ratchet channel is red, this one red is ALSO
#   why the ratchet still reads `nonGateHardcodeSites: 6` when the measurement is 0.

# ...AND DOES THE EXPORT CONTAIN THE MOTION THE VIEWPORT SHOWS? The draw-in became
# authorable and nothing asked what the exporter made of that; `grep -c` over all
# six `lib/export/*.ts` for the schedule and the window returned 0. It does carry
# the motion — but `planFrames` assumed the reveal ends FULL, which is false in 5
# of the 8 window x reverse states, and with no hold it never emitted a clock-1
# frame at all. Explainer 38.
node scripts/verify/assert-export-window.mjs

# ...AND IS THE FRAME ITSELF WORTH KEEPING? Not a gate — a LIBRARY a capture wires
# in, and the answer to the blank frame that carried a whole motion statistic
# (27 §5). It refuses a frame with no mark, a run whose motion is carried by one
# delta, and a RUN of identical frames where the caller DECLARED motion — never a
# single repeat, which a quantised threshold map really does produce. Blank is
# checked always, frozen only where motion was declared, because in a healthy
# capture blank is 2 of 56 and frozen is 19 of 55. Explainer 40.
node scripts/verify/lib/frame-guard.mjs --selftest   # 20 rows, seven on real frames

# ...AND IS THE CARVE'S ANTIALIASING DIVISOR ACTUALLY HELD? It was cited as
# having a gate (`assert-carve-graze.mjs`) and that file had NEVER EXISTED — the
# same class as `assert-hero-letters.mjs`, cited from three call sites and never
# written. It exists now: the divisor must be a LIVE control, and the shipped one
# must never be the worse of the two on white speckle at the frames the MODEL
# predicts are inside the carve fade band. It imports its statistic from
# `_probe-carve-graze.mjs` rather than restating it.
# ⚠ THAT PARAGRAPH IS HISTORY AND READS AS PRESENT. Written 2026-08-04 21:34,
#   re-verified 2026-08-07: 9 rows, ALL PASS, both mutants exit 1, reproducing its
#   own header table bit-identically five days later on a different bundler. The
#   correction note at `components/viewport-3d.tsx:9176` still says it "has never
#   existed" — true at 21:29 on 08-04 and false by 21:34, and that stale sentence
#   is the second time this repo has paid for a scoping line nobody updated.
node scripts/verify/assert-carve-graze.mjs

# THE META-GATE. Is every script named `assert-` actually a gate? Three were not,
# and all three exited 0 in every sweep, so all three read green forever.
# CHANNEL J asks the follow-up channel A cannot: when the sweep DID run it, how
# much of it ran? A gate can be partly swept — `assert-hero-dials` emitted 4 model
# rows bare while its whole browser arm sat behind `--live` — and partly reads
# exactly like fully. J counts a withheld arm when a BLOCKED emission carries a
# verdict token OR a blocked, failure-capable `process.exit()` is unreachable: one
# file had been defining a judgement lexically in J and structurally in B, and both
# `deadEmissions` and `s.exits` were computed on every sweep and thrown away.
# CHANNEL K is the control manifest — 97 entries, one per gate, each carrying a
# verdict, a kind, and a CITED LINE that is re-checked every run, reconciled against
# the discovered gate list in BOTH directions. A stale entry is a FAILURE.
# Explainers 29, 31 and 34.
node scripts/verify/assert-gate-integrity.mjs
node scripts/verify/assert-gate-integrity.mjs --recite   # re-cite lines an edit moved

# THE TYPECHECK, IN BOTH DIRECTIONS. The baseline is SIX, and a count BELOW it is
# a FAILURE, not an improvement — a parse error halts tsc before it reaches the
# known six. On 2026-08-04 a stray backtick inside a GLSL template literal took
# the app down for hours while tsc read "2" and everyone treated the smaller
# number as better. This also pings both routes, because a syntax error is one of
# the few faults that shows in both channels.
node scripts/verify/assert-tsc-baseline.mjs
# THREE EXIT CODES, NOT TWO: 0 = every channel this run set out to judge was judged
# and passed · 1 = a judgement FAILED, which outranks a partial always · 3 = PARTIAL,
# a channel it could not REACH, printing an UNSWEPT line naming both the channel and
# the command that answers it. This gate used to exit 0 against a DEAD PORT with two
# SKIP rows, and it was the one gate of 32 that did — the meta-gate's channel G could
# not catch it because `ALLPASS_RE` does not match its summary, "TSC BASELINE HOLDS".
# Both runners carry the same ladder, or PARTIAL becomes a way to launder a red.
# Explainer 33.

# ...AND IS EVERY GATE ACTUALLY RUN? The meta-gate proves a gate CAN fail; it
# proved nothing about any of them ever being executed, and measured 2026-08-03
# **73 of 81 were in no sweep at all**. These two are the scoreboard. Neither
# counts a skip as a pass: the model battery NAMES every browser gate it did not
# run, and the browser battery runs exactly those, serially, against the shared
# dev server, logging each to docs/verification/gate-integrity/browser-logs/.
# They discover gates ACROSS THE REPO, not just scripts/verify/ — that scoping
# is why docs/storyboard/tools/assert-moment.mjs sat in no sweep for a week —
# and the browser runner IMPORTS the inventory from the model runner rather than
# restating it, because a partition maintained by two copies of one rule can
# drop a gate into neither list with nothing to say so.
#
# THE MODEL/BROWSER SPLIT IS PARSED, NOT GREPPED. It used to match
# `chromium.launch|playwright|puppeteer` against the file's RAW TEXT, so a token in
# a string, in a fixture, or in a comment EXPLAINING the rule decided which battery
# ran the file — and it was wrong in both directions, leaving a gate that spawns a
# browser child sitting in the MODEL battery. It is now a syntax-tree question
# (driver import specifier · launch callee · a child process handed a repo script
# that itself classifies BROWSER · an explicit `battery:` directive), it calibrates
# against `lib/gate-fixtures/classify/` on EVERY run, and it ASSERTS the partition:
# model + browser = discovered, overlap 0. Explainer 33.
#
# ⚠ COUNTS MOVE, SO READ THEM OFF THE RUNNER, NOT OFF THIS FILE. Measured in this
# checkout at 2026-08-07 10:2x, verbatim:
#     partition OK — 98 discovered = 45 MODEL + 53 BROWSER, overlap 0
# plus `assert-gate-integrity.mjs`, EXCLUDEd by name and run as the third command:
# **99 `assert-*` gate scripts in total** *(on 2026-08-07. It is **100** today, 2026-08-28 —
# see the dated note below, and read it off the runner rather than off either number).*
# `assert-one-knob` reports a different
# number from a DIFFERENT scope (everything under `scripts/verify/`, meta-gate
# INCLUDED, `docs/storyboard/tools/assert-moment.mjs` EXCLUDED) — the two are not
# measuring the same set and never were. The population went
# 81 -> 89 -> 94 -> 96 -> 98 -> 99 during 2026-08-07 as lanes landed gates, twice
# [2026-08-28: it is 100 now, and 193 _probe-* scripts. The 08-07 numbers above are
#  left standing because they are a correct measurement of that day, and this
#  paragraph's whole point is that the population moves.]
# while this paragraph was being written, which is why four different answers to
# "how many gates are there" are all in the record and none was wrong when taken.
# THE NUMBER ABOVE IS ALREADY OLD. Run the command.
node scripts/verify/run-battery.mjs                 # the MODEL gates, no browser
node scripts/verify/run-browser-battery.mjs         # the BROWSER gates — needs a dev server
node scripts/verify/run-battery.mjs --list          # the partition, with the reason per gate
node scripts/verify/run-battery.mjs --classify-selftest   # ...and is the SPLIT itself provable?
```

⚠ **BEING ABSENT FROM THE BLOCK ABOVE NO LONGER MEANS BEING IN NO SWEEP — AND THAT
IS NEW.** Measured 2026-08-07: **67 of the 98 gates were named nowhere in this file**,
and after this pass it is **63 of 99** — including `assert-mode-rims` (189 rows),
`assert-data-safety` (134), `assert-stroke-schedule` (60), `assert-layer-flicker` (62)
and `assert-hero-k7-intact`. *(A first draft of this line said 64, measured against a
file this pass had already half-edited — the exact defect the paragraph below is about,
committed while writing it. The 67 and the 63 are measured against the unedited file and
the finished one respectively, at populations of 98 and 99 — `assert-arm-took.mjs` landed
between the two measurements.)* When the runners named
their gates by hand, that was a coverage hole, and this file's own lesson — *"a gate
missing from this block stays off every regression list"* — was literally true. It is
not any more: `discover()` walks the whole repo mechanically, so all 97 are swept
whatever this file says. **What is left is a documentation hole, and it is still a real
one** — a reader looking for the gate that answers their question will not find it here,
and will write a second one. The remedy is not to paste 64 blocks in; it is to run
`run-battery.mjs --list`, which is the only inventory that cannot go stale.

`verify-*` captures frames. `assert-*` and `diff-frames` turn them into pass/fail.
The split matters: capturing is cheap and rerunnable, asserting is where a claim
like "the pattern reads" or "the pulse is one-shot" gets settled.

⚠ **THAT SENTENCE IS NOT TRUE OF EVERY `assert-*`, AND THE EXCEPTIONS ARE WHY
`assert-gate-integrity.mjs` EXISTS.** Measured 2026-08-01, exit 1:
**`assert-joint-beading.mjs`** and **`assert-layer-flicker.mjs`** emitted **zero
PASS/FAIL rows** on the invocation a sweep makes and could not return non-zero
from their own judgement — every assertion in them sat behind `--compare`,
`--calibrate`, `--guard`, `--fusion` or `--reduced`. A third,
`assert-taper-envelope.mjs`, contained **no check at all** and printed
`NOT CONFIRMED` unread for a cycle. **All three have since been fixed** —
re-measured bare on 2026-08-07, joint-beading emits **25** rows and layer-flicker
**62** (53 subject rows plus 9 controls, six of them known-bad), both exit-coupled.
The meta-gate checks
three independent channels — **emits a row**, **exit-coupled to its own verdict**
(a `.catch(() => exit(1))` explicitly does not count: that says the script
crashed, never that the subject failed), and **refuses a label that does not
exist** — and names anything it could not probe rather than skipping it. Add a
new `assert-*` and it will be checked automatically.

⚠ **AND `assert-layer-flicker` IS ALSO THE THIRD WAY TO BE GREEN WHILE MEASURING
NOTHING.** Every one of its control arms printed behind a bracket prefix
(`[guard] PASS`, `[calib] PASS`, `[reduced] PASS`), and both battery runners
require the token to LEAD the line — so the sweep counted **53 subject rows and 0
controls**, and `--fusion` and `--reduced` produced **0 counted rows each**: five
minutes and fifty seconds of real work that no scoreboard could read. A row that
runs, judges correctly, and prints in a format nothing parses is not a row.

**The three questions no channel here asked, all measured 2026-08-07:**

1. **Is the gate pointed at the tree whose name is on it?** 35 of the 48 browser
   gates hardcoded `http://localhost:3000` and ignored `FS_PORT` (explainer 27).
   **CLOSED** — 35 gates plus 83 capture tools converted, and `assert-one-knob.mjs`
   now fails the next one (explainers 28, 37). The class that started at 92 + 35
   measures **0**.
2. **Does a gate that *can* emit rows actually run its real arm?** The flag pattern
   was fixed in three files and never as a class (explainer 29). **CLOSED** — the
   six flag-hidden gates and the thirteen parked known-bads all run bare, and
   channel J of the meta-gate now names the rest every sweep (explainers 31, 34, 36).
   `assert-hero-dials` — the gate this index advertises as the panel gate — went
   from 0.3 s and 4 rows to ~26 s, two real Chrome launches and 13 battery-visible
   rows, with its frozen-panel control on the default path.
3. **Does the tool point at the tree it WRITES to, and is the frame it wrote worth
   grading?** Newer, and only partly closed. Six scripts hardcoded an absolute path
   into the shared checkout and one deleted it before writing (explainer 37); the
   frame guard exists but is **wired into one capture arm and has never completed a
   full twelve-cell run** (explainer 40). **28 of the 96 gates depend on a capture
   tool for the tree they grade, and nothing in the evidence records which tree that
   was.**

## The build loop (per phase)

1. **Research** — search before writing code; save it to `research/`.
2. **Build** — smallest honest slice. Geometry stays locked.
3. **Verify with frames** — capture high-frame-count evidence and actually look
   at it, plus numeric assertions so nothing passes on vibes.
4. **Document** — an explainer, plus a checkpoint in `HANDOFF-TO-OZ.md`.
5. ~~**Commit and push** to the PR branch.~~ ⚠ **STEP 5 HAS NOT HAPPENED SINCE
   2026-07-28**, and describing it as the loop's last step made two lanes reason
   about a tree that does not exist. It is left here struck through rather than
   deleted, because it is what the loop *should* end in and the gap is the finding.

## A pattern worth knowing

Four separate bugs this project hit were **correct code that rendered wrong**,
and none would have survived a frame check:

- a texture pattern invisible on glossy black (albedo-only modulation)
- ASCII rendering as empty space (near-black subject vs a 0–1 brightness ramp)
- a "one-shot" pulse that never actually stopped
- a fade-in that measured from scene start, so it had always finished before you
  enabled it

The last two are the same mistake in different clothes: **time-based effects need
an explicit origin, and "scene start" is almost never it.**

There is now a fifth, and it is the one that costs the most time because the
evidence *looks* fine:

- **a shader that presents no frames while every diagnostic reads green.** A
  `discard` inside a dynamically-bounded loop hangs Chrome's Metal backend:
  rAF ticks at 121/s, JS stays responsive, the console is empty, and the page's
  own published data is correct. The only symptom is a screenshot timing out,
  which reads as a flaky harness. Bisected in
  `components/viewport-3d.tsx:912-922` — the same loop with `break` instead of
  `discard` renders in 46 ms.

And a sixth, which is about the tools rather than the code: **a script named
`assert-` that cannot fail.** Eleven instruments in this repo have reported green
while measuring nothing. Eight were the *drift* class — a hardcoded second, a
window sized for an old beat, a phase whose meaning changed while its name did
not — and the defence is to derive every window from the model's own offsets and
**print what was actually read**. Three were the *construction* class, born
unable to fail, and no amount of deriving helps there; that one needed a machine,
which is `assert-gate-integrity.mjs`. Both classes are written up in the
storyboard §11.8.

**2026-08-07 added a third sub-class, and it is larger than the other two
combined: an instrument perfectly capable of failing, about the WRONG SUBJECT.**
Neither existing defence helps — deriving the window from the model does not, and
a meta-gate proving the instrument CAN fail does not, because both were already in
place and green. **Seven instances were found in one week, each by accident and
each written up separately, before anyone noticed they were one shape.** They have
their own explainer now, and it is the one to read rather than this paragraph:

> **[43 — The subject and the claim](explainers/43-the-subject-and-the-claim.md).**
> *"An instrument has a SUBJECT — the thing it actually touched — and a CLAIM — the
> thing its output is about. Nothing in this repo made them equal, and nothing was
> checking."* The seven, with their measurements: **the tree** (35 gates on
> somebody else's server) · **the checkout** (a capture writing — and one deleting —
> the shared evidence) · **the canvas** (`querySelector` taking the first of two) ·
> **the invocation** (a judgement behind a flag no sweep types) · **the scoreboard**
> (`\bFAIL\b` not matching `FAILED`) · **the pose** (an OFAT arm that never set one) ·
> **the launch mode** (48 files each hardcoding their own).

**None of the seven is a badly written instrument** — each is correct about what it
does. `querySelector("canvas")` returns the first canvas exactly as specified. The
defect is the distance between what the instrument DID and what its output was TAKEN
to mean, and that distance lives in nobody's code, which is exactly why nothing was
checking it. So the question that finds the eighth is not *"is this instrument
correct?"* but **"can this instrument choose its own subject?"** All seven could.
The defence is uniform: the subject is **handed in** from one shared resolver, and
the instrument **records what it actually got** — `lib/dev-server.mjs` for the port,
`grabInfo()` for the canvas, `lib/control-manifest.json` for the arms,
`lib/frame-guard.mjs` for the frame, and `assert-one-knob`'s channel F for the path.
